import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve, join } from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { normalizeAccountUsage, readAccountUsage, UsageError, type AccountUsage } from '../lib/account-usage.ts';
import { createTokenStore } from '../lib/token-store.ts';
import { createTokenSync } from '../lib/token-sync.ts';

const identity = { userId: 'test', account: { type: 'chatgpt', email: 'test@example.test' } };
const fixture = resolve('tests/fixtures/account-server.mjs');
const sample = { summary: { lifetimeTokens: 300, peakDailyTokens: null }, dailyUsageBuckets: [{ startDate: '2026-11-17', tokens: 300 }] };
const readFixture = (mode: string) => readAccountUsage({ executable: process.execPath, args: [fixture, mode], timeoutMs: mode === 'timeout' ? 150 : 5000 });

test('공식 프로토콜 초기화·계정·집계 조회, 인증·개별 대화 정보 미노출', async () => {
  const usage = await readFixture('success');
  assert.equal(usage.days?.length, 2);
  assert.equal(usage.summary.lifetimeTokens, 300);
  assert.match(usage.accountKey, /^[a-f0-9]{64}$/);
  assert.ok(!JSON.stringify(usage).includes('private@example'));
  assert.ok(!JSON.stringify(usage).includes('do not forward'));
  for (const mode of ['malformed', 'signed-out', 'error', 'timeout']) {
    await assert.rejects(() => readFixture(mode), error => error instanceof UsageError && !error.message.includes('PRIVATE TOKEN'));
  }
  await assert.rejects(() => readAccountUsage({ executable: resolve('nonexistent-codex.exe') }), UsageError);
});

test('날짜별 null은 0과 다르게 처리, 중복·음수·잘못된 날짜 거부', () => {
  assert.equal(normalizeAccountUsage({ ...sample, dailyUsageBuckets: null }, identity).days, null);
  assert.deepEqual(normalizeAccountUsage({ ...sample, dailyUsageBuckets: [] }, identity).days, []);
  assert.equal(normalizeAccountUsage(sample, identity).summary.peakDailyTokens, null);
  for (const dailyUsageBuckets of [[...sample.dailyUsageBuckets, ...sample.dailyUsageBuckets], [{ startDate: '2026-02-30', tokens: 1 }], [{ startDate: '2026-11-17', tokens: -1 }], [{ startDate: '2026-11-17', tokens: null }]]) {
    assert.throws(() => normalizeAccountUsage({ ...sample, dailyUsageBuckets }, identity), UsageError);
  }
});

test('중복 갱신·동시 조회 병합·실패 후 보존·날짜 null·계정 변경 격리·재시작', async () => {
  const root = mkdtempSync(join(tmpdir(), 'moa-account-'));
  const filename = join(root, 'usage.sqlite');
  const store = createTokenStore(filename);
  let time = Date.parse('2026-11-18T00:00:00Z');
  let calls = 0;
  let fail = false;
  let usage: AccountUsage = normalizeAccountUsage(sample, identity);
  const sync = createTokenSync({ store, intervalMs: 1000, now: () => time, read: async () => { calls++; await Promise.resolve(); if (fail) throw new UsageError('일시적 오류'); return usage; } });
  try {
    const results = await Promise.all([sync.get(), sync.get(), sync.get()]);
    assert.equal(calls, 1);
    assert.ok(results.every(r => r.days[0].tokens === 300));
    await sync.get(); assert.equal(calls, 1);
    time += 1001; await sync.get(); assert.equal(calls, 2);
    assert.equal(store.accountSnapshot()?.days[0].tokens, 300);
    fail = true; time += 1001;
    const failed = await sync.get();
    assert.equal(failed.status, 'stale'); assert.equal(failed.days[0].tokens, 300);
    fail = false; usage = { ...usage, days: null }; time += 1001;
    const noDays = await sync.get();
    assert.equal(noDays.dailyAvailable, false); assert.equal(noDays.days[0].tokens, 300);
    usage = { ...usage, accountKey: 'different-account', days: null }; time += 1001;
    assert.deepEqual((await sync.get()).days, [], '새 계정은 이전 계정 잔디를 사용하지 않음');
    const reopened = createTokenStore(filename);
    try { assert.deepEqual(reopened.accountSnapshot(), store.accountSnapshot()); } finally { reopened.close(); }
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});
