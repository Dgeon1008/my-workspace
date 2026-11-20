import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { connect } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const root = fileURLToPath(new URL('../', import.meta.url));
const url = 'http://127.0.0.1:3000';
const checkOnly = process.argv.includes('--check');
const noBrowser = process.argv.includes('--no-browser') || checkOnly;

async function ready() {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return response.ok && (await response.text()).includes('모아 — 나의 프로젝트 작업공간');
  } catch { return false; }
}
async function portOccupied() {
  return new Promise(resolve => {
    const socket = connect({ host: '127.0.0.1', port: 3000 });
    const finish = value => { socket.destroy(); resolve(value); };
    socket.setTimeout(1000, () => finish(true));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}
function openBrowser() {
  if (noBrowser || process.platform !== 'win32') return;
  const opener = spawn(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'rundll32.exe'), ['url.dll,FileProtocolHandler', url], { windowsHide: true, stdio: 'ignore' });
  opener.on('error', () => console.log(`Open ${url} in your browser.`));
  opener.unref();
}

if (await ready()) {
  console.log(`[OK] Moa is already running at ${url}. No second server was started.`);
  openBrowser();
} else if (checkOnly) {
  console.error('[OFFLINE] Moa is not ready on port 3000.');
  process.exitCode = 1;
} else if (await portOccupied()) {
  console.error('[ERROR] Port 3000 is occupied, but Moa is not responding. Check the existing server; no process was stopped.');
  process.exitCode = 1;
} else {
  const next = join(root, 'node_modules', 'next', 'dist', 'bin', 'next');
  if (!existsSync(next)) {
    console.error('[ERROR] Dependencies are missing. Run npm install in this folder first.');
    process.exitCode = 1;
  } else {
    console.log('Starting Moa. Keep this window open while using the workspace.');
    console.log('Close this window or press Ctrl+C to stop the Moa server.');
    const server = spawn(process.execPath, [next, 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', '3000'], { cwd: root, stdio: 'inherit', windowsHide: true });
    let ended = false;
    let spawnFailed = false;
    server.on('error', () => { ended = true; spawnFailed = true; console.error('[ERROR] Could not start the Moa server.'); process.exitCode = 1; });
    server.on('exit', code => { ended = true; process.exitCode = code ?? 1; });
    process.on('SIGINT', () => server.kill());
    process.on('SIGTERM', () => server.kill());
    const deadline = Date.now() + 60000;
    let healthy = false;
    while (!ended && Date.now() < deadline) {
      if (await ready()) { healthy = true; break; }
      await delay(500);
    }
    if (healthy) { console.log(`[OK] Moa is ready at ${url}`); openBrowser(); }
    else if (!spawnFailed) console.error('[ERROR] Moa did not become ready. Check the server output above.');
  }
}
