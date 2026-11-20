import { resolve } from 'node:path';
import { startHarnessServer } from '../lib/harness-server.mjs';

const root = resolve(process.argv[2]);
const runtime = await startHarnessServer({ id: 'fixture', root, entry: resolve(root, 'server.mjs'), factory: 'createAppServer', port: 0, settleMs: 120, sourceKey: 'fixture' });
console.log(JSON.stringify({ url: runtime.url }));
let closing = false;
const close = async () => { if (closing) return; closing = true; await runtime.close(); process.exit(0); };
process.stdin.resume();
process.stdin.on('data', close);
process.stdin.on('end', close);
process.on('SIGTERM', close);
