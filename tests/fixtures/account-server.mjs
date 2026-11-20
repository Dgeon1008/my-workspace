import { createInterface } from 'node:readline';
import { readFileSync, appendFileSync } from 'node:fs';

const setting = process.argv[2] || 'success';
const mode = () => setting.endsWith('.txt') ? readFileSync(setting, 'utf8').trim() : setting;
let initialized = false;
const reply = (id, result) => process.stdout.write(JSON.stringify({ id, result }) + '\n');
createInterface({ input: process.stdin }).on('line', line => {
  const request = JSON.parse(line);
  if (process.env.MOA_TEST_CALLS) appendFileSync(process.env.MOA_TEST_CALLS, `${request.method}\n`);
  if (mode() === 'timeout') return;
  if (request.method === 'initialize') reply(request.id, { userAgent: 'test' });
  else if (request.method === 'initialized') initialized = true;
  else if (!initialized) process.stdout.write(JSON.stringify({ id: request.id, error: { message: 'handshake missing' } }) + '\n');
  else if (request.method === 'account/read') reply(request.id, { userId: 'test-user', account: mode() === 'signed-out' ? null : { type: 'chatgpt', email: 'private@example.test', workspaceName: 'test' } });
  else if (request.method === 'account/usage/read') {
    if (mode() === 'error') process.stdout.write(JSON.stringify({ id: request.id, error: { message: 'PRIVATE TOKEN MUST NOT BE SHOWN' } }) + '\n');
    else reply(request.id, { summary: { lifetimeTokens: 300, peakDailyTokens: 200 }, dailyUsageBuckets: mode() === 'no-days' ? null : mode() === 'malformed' ? [{ startDate: '2026-02-30', tokens: -1 }] : [{ startDate: '2026-11-16', tokens: 100 }, { startDate: '2026-11-17', tokens: 200 }], threadUsage: { secret: 'do not forward' } });
  } else process.exit(1);
});
