import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

test('자동 집계 HTTP·인증정보 미노출·조회 병합·실패/재시작 후 마지막 기록 보존', { timeout: 45000 }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'moa-token-api-'));
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const api = `${base}/api/token-activity`;
  const modeFile = join(root, 'mode.txt');
  const callsFile = join(root, 'calls.txt');
  let child;
  let exited;
  async function stop() {
    if (child && child.exitCode === null) child.kill();
    if (exited) await exited;
    child = null;
  }
  async function start(mode) {
    writeFileSync(modeFile, mode);
    child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
      env: { ...process.env, WORKSPACE_DB_PATH: join(root, 'isolated.sqlite'), CODEX_EXECUTABLE: process.execPath, CODEX_APP_SERVER_ARGS: JSON.stringify([resolve('tests/fixtures/account-server.mjs'), modeFile]), MOA_TEST_CALLS: callsFile },
      stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    exited = once(child, 'exit');
    for (let i = 0; i < 100; i++) {
      if (child.exitCode !== null) throw new Error(`서버 실행 실패: ${output}`);
      try { if ((await fetch(base)).ok) return; } catch { /* starting */ }
      await delay(100);
    }
    throw new Error(`서버 시작 시간 초과: ${output}`);
  }
  try {
    await start('success');
    const results = await Promise.all(Array.from({ length: 4 }, async () => (await (await fetch(api)).json())));
    assert.ok(results.every(data => data.status === 'ok' && data.days.length === 2));
    assert.equal(results[0].summary.lifetimeTokens, 300);
    assert.equal(results[0].days[1].tokens, 200);
    assert.ok(!JSON.stringify(results[0]).includes('private@example'));
    assert.ok(!JSON.stringify(results[0]).includes('do not forward'));
    assert.equal(readFileSync(callsFile, 'utf8').split('\n').filter(method => method === 'account/usage/read').length, 1);
    assert.equal((await fetch(api, { headers: { Origin: 'https://untrusted.example' } })).status, 403);
    assert.equal((await fetch(api, { method: 'POST', body: '[]' })).status, 405);
    await stop();
    await start('error');
    const stale = await (await fetch(api)).json();
    assert.equal(stale.status, 'stale');
    assert.deepEqual(stale.days, results[0].days);
    assert.equal(stale.syncedAt, results[0].syncedAt);
    assert.ok(!stale.message.includes('PRIVATE TOKEN'));
    await stop();
    await start('no-days');
    const missing = await (await fetch(api)).json();
    assert.equal(missing.dailyAvailable, false);
    assert.deepEqual(missing.days, results[0].days);
    assert.equal(missing.daysUpdatedAt, results[0].daysUpdatedAt);
  } finally {
    await stop();
    rmSync(root, { recursive: true, force: true });
  }
});
