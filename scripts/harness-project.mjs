import { fileURLToPath } from 'node:url';
import { loadHarnessProject } from '../lib/harness-config.mjs';
import { startHarnessServer } from '../lib/harness-server.mjs';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const arg = key => { const index = process.argv.indexOf(key); return index < 0 ? undefined : process.argv[index + 1]; };
let runtime;
try {
  const config = await loadHarnessProject(arg('--project') || 'semantle', workspace);
  const override = arg('--port');
  if (override) {
    config.port = Number(override);
    if (!Number.isInteger(config.port) || config.port < 1024 || config.port > 65535) throw new Error('Invalid port');
  }
  const url = `http://127.0.0.1:${config.port}`;
  const current = await fetch(url + '/_moa/health', { signal: AbortSignal.timeout(700) }).then(response => response.json()).catch(() => null);
  if (current?.ready && current.id === config.id && current.sourceKey === config.sourceKey) {
    console.log(`[harness] Reusing ${config.name}: ${url}`);
    process.send?.({ ready: true, url });
    if (process.connected) process.disconnect();
  } else {
    runtime = await startHarnessServer(config);
    console.log(`[harness] ${config.name}: ${runtime.url}`);
    process.send?.({ ready: true, url: runtime.url });
  }
} catch (error) {
  console.error('[harness]', error.message);
  process.send?.({ error: '프로젝트를 시작하지 못했습니다. 실행 로그를 확인해주세요.' });
  process.exitCode = 1;
}
const close = async () => { await runtime?.close(); process.exit(0); };
process.on('SIGINT', close);
process.on('SIGTERM', close);
process.on('disconnect', () => { if (runtime) void close(); });
