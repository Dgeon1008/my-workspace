import http from 'node:http';
import { fork } from 'node:child_process';
import { watch } from 'node:fs';
import { fileURLToPath } from 'node:url';

const workerFile = fileURLToPath(new URL('../scripts/harness-worker.mjs', import.meta.url));
const clientScript = `(() => {
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.source === window || event.data?.type !== 'moa:theme') return;
    let origin; try { origin = new URL(event.origin); } catch { return; }
    if (!['127.0.0.1','localhost','[::1]'].includes(origin.hostname)) return;
    if (!['light','dark'].includes(event.data.theme)) return;
    document.documentElement.dataset.moaTheme = event.data.theme;
    window.dispatchEvent(new CustomEvent('moa:theme', {detail:event.data.theme}));
  });
  const expected = document.currentScript.dataset.revision;
  const key = '__moa_draft__:' + location.pathname;
  try {
    const draft = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (draft) {
      const input = document.getElementById(draft.id);
      if (input && input.type !== 'password') { input.value = draft.value; input.focus(); }
      sessionStorage.removeItem(key);
    }
  } catch {}
  const source = new EventSource('/_moa/events');
  source.addEventListener('revision', event => {
    if (String(JSON.parse(event.data).revision) === expected) return;
    const input = document.activeElement;
    try {
      if (input?.id && input.matches('input[type=text],input:not([type]),textarea')) {
        sessionStorage.setItem(key, JSON.stringify({id:input.id,value:input.value}));
      }
    } catch {}
    source.close(); location.reload();
  });
})();`;

export async function startHarnessServer(config) {
  const clients = new Set();
  const children = new Set();
  let worker;
  let revision = 1;
  let closing = false;
  let restarting = false;
  let restartAgain = false;
  let debounce;
  const ignored = name => !name || /(^|[\\/])(dist|node_modules|tests|\.git)([\\/]|$)/.test(name) || /(^|[\\/])\./.test(name);
  const notify = () => {
    for (const client of clients) client.write(`event: revision\ndata: ${JSON.stringify({revision})}\n\n`);
  };
  async function launchWorker() {
    return new Promise((resolveWorker, reject) => {
      const child = fork(workerFile, [], { cwd: config.root, windowsHide: true,
        env: { ...process.env, ...config.environment, MOA_WORKER_ENTRY: config.entry, MOA_WORKER_FACTORY: config.factory },
        stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      });
      children.add(child);
      let settled = false;
      const timeout = setTimeout(() => fail(new Error('프로젝트 서버 시작 시간이 초과되었습니다.')), 15000);
      function fail(error) {
        if (settled) return;
        settled = true; clearTimeout(timeout); child.kill(); reject(error);
      }
      child.once('error', fail);
      child.on('message', value => {
        if (value?.ready && Number.isInteger(value.port) && !settled) {
          settled = true; clearTimeout(timeout); resolveWorker({ child, port: value.port });
        }
      });
      child.once('exit', () => {
        children.delete(child);
        if (!settled) fail(new Error('프로젝트 서버를 시작하지 못했습니다.'));
        if (!closing && worker?.child === child) {
          worker = undefined;
          console.error('[harness] project worker exited', config.id);
          void restart();
        }
      });
    });
  }
  async function restart() {
    if (closing) return;
    if (restarting) { restartAgain = true; return; }
    restarting = true;
    try {
      const next = await launchWorker();
      if (closing) { next.child.kill(); return; }
      const previous = worker;
      worker = next;
      revision++;
      notify();
      // Retain the old working server until its replacement is ready.
      if (previous) { const timer = setTimeout(() => previous.child.kill(), 500); timer.unref(); }
    } catch (error) {
      console.error('[harness] reload failed; retaining last working server', config.id, error.message);
    } finally {
      restarting = false;
      if (restartAgain) { restartAgain = false; void restart(); }
    }
  }
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/_moa/health') {
      response.writeHead(worker ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify({ id: config.id, sourceKey: config.sourceKey, revision, ready: Boolean(worker) }));
      return;
    }
    if (pathname === '/_moa/client.js') {
      response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(clientScript); return;
    }
    if (pathname === '/_moa/events') {
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      clients.add(response);
      response.write(`event: revision\ndata: ${JSON.stringify({revision})}\n\n`);
      request.on('close', () => clients.delete(response));
      return;
    }
    if (!worker) { response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' }).end('프로젝트 서버를 준비하고 있습니다.'); return; }
    const upstream = http.request({ hostname: '127.0.0.1', port: worker.port, path: request.url, method: request.method,
      headers: { ...request.headers, host: `127.0.0.1:${worker.port}`, 'accept-encoding': 'identity' } }, result => {
      const headers = { ...result.headers, 'cache-control': 'no-store' };
      if (headers['content-type']?.includes('text/html')) {
        const parts = []; let size = 0;
        result.on('data', part => { size += part.length; if (size > 8 * 1024 * 1024) { result.destroy(); response.destroy(); } else parts.push(part); });
        result.on('end', () => {
          const html = Buffer.concat(parts).toString('utf8');
          const script = `<script src="/_moa/client.js" data-revision="${revision}"></script>`;
          delete headers['content-length']; delete headers['content-encoding']; delete headers.etag;
          response.writeHead(result.statusCode || 200, headers);
          response.end(/<\/body>/i.test(html) ? html.replace(/<\/body>/i, script + '</body>') : html + script);
        });
      } else { response.writeHead(result.statusCode || 200, headers); result.pipe(response); }
    });
    upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end('프로젝트 연결을 다시 시도해주세요.'); });
    request.on('aborted', () => upstream.destroy());
    request.pipe(upstream);
  });
  worker = await launchWorker();
  try {
    await new Promise((ready, reject) => { server.once('error', reject); server.listen(config.port, '127.0.0.1', ready); });
  } catch (error) { closing = true; for (const child of children) child.kill(); throw error; }
  const watcher = watch(config.root, { recursive: true }, (_event, filename) => {
    if (ignored(String(filename || ''))) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => void restart(), config.settleMs);
  });
  watcher.on('error', error => console.error('[harness] source watch failed', error.message));
  const heartbeat = setInterval(() => { for (const client of clients) client.write(': heartbeat\n\n'); }, 15000);
  heartbeat.unref();
  return { url: `http://127.0.0.1:${server.address().port}`, close: async () => {
    closing = true; watcher.close(); clearTimeout(debounce); clearInterval(heartbeat);
    for (const client of clients) client.end();
    for (const child of children) child.kill();
    server.closeAllConnections();
    await new Promise(ready => server.close(ready));
  }};
}
