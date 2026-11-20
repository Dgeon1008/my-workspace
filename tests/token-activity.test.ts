import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parseChatGPTExport } from '../lib/chatgpt-import.ts';
import { activityCalendar, seoulDay, type TokenDay } from '../lib/token-activity.ts';
import { createTokenStore } from '../lib/token-store.ts';

const timestamp = Date.parse('2026-11-17T15:05:00Z') / 1000;
function exported(text = 'Hello world!') {
  return [{ id: 'conversation-1', title: 'DO NOT STORE THIS TITLE', mapping: {
    a: { message: { id: 'message-1', author: { role: 'user' }, create_time: timestamp, content: { parts: [text] } } },
    b: { message: { id: 'message-2', author: { role: 'assistant' }, create_time: timestamp, content: { parts: ['안녕하세요!'] } } },
    c: { message: { id: 'tool', author: { role: 'tool' }, create_time: timestamp, content: { parts: ['hidden'] } } },
    d: { message: { id: 'image', author: { role: 'user' }, create_time: timestamp, content: { parts: [{ content_type: 'image_asset_pointer' }] } } },
  } }];
}
const now = new Date('2026-11-18T12:00:00Z');

test('한영 텍스트 토큰 계산, 한국 날짜 변환, 도구·이미지 제외', () => {
  const result = parseChatGPTExport(exported(), now);
  assert.equal(result.messages.length, 2);
  assert.equal(result.messages[0].date, '2026-11-18');
  assert.equal(result.messages[0].tokens, 3);
  assert.ok(result.messages[1].tokens > 0);
  assert.equal(result.skipped, 1);
  assert.deepEqual(Object.keys(result.messages[0]).sort(), ['date', 'id', 'role', 'tokens']);
  assert.match(result.messages[0].id, /^[a-f0-9]{64}$/);
  assert.equal(seoulDay(new Date('2026-11-17T14:59:59Z')), '2026-11-17');
});

test('특수 토큰 문자열·중복 메시지·미래 날짜·잘못된 파일 처리', () => {
  assert.doesNotThrow(() => parseChatGPTExport(exported('<|endoftext|>'), now));
  const duplicate = exported();
  duplicate.push(duplicate[0]);
  assert.equal(parseChatGPTExport(duplicate, now).messages.length, 2);
  assert.throws(() => parseChatGPTExport(exported(), new Date('2020-01-01')), /찾지 못/);
  for (const invalid of [null, {}, [], [{ mapping: {} }]]) assert.throws(() => parseChatGPTExport(invalid, now));
});

test('중복 가져오기·메시지 갱신·재실행 보존 및 원문 미저장', () => {
  const root = mkdtempSync(join(tmpdir(), 'moa-token-'));
  const filename = join(root, 'usage.sqlite');
  const store = createTokenStore(filename);
  try {
    const first = parseChatGPTExport(exported(), now).messages;
    store.import(first);
    store.import(first);
    assert.equal(store.summary().totalMessages, 2);
    const oldTokens = store.summary().days[0].tokens;
    store.import(parseChatGPTExport(exported('A much longer edited message with additional words and details.'), now).messages);
    assert.ok(store.summary().days[0].tokens > oldTokens);
    const reopened = createTokenStore(filename);
    try { assert.deepEqual(reopened.summary(), store.summary()); } finally { reopened.close(); }
    const inspection = new DatabaseSync(filename, { readOnly: true });
    try {
      const columns = inspection.prepare('PRAGMA table_info(token_messages)').all().map(row => row.name);
      assert.deepEqual(columns, ['id', 'day', 'tokens', 'role']);
      const rows = JSON.stringify(inspection.prepare('SELECT * FROM token_messages').all());
      assert.ok(!rows.includes('DO NOT STORE THIS TITLE') && !rows.includes('Hello world'));
    } finally { inspection.close(); }
    const invalid = { ...first[0], id: 'bad', tokens: -1 };
    const before = store.summary();
    assert.throws(() => store.import([{ ...first[0], id: 'new' }, invalid]));
    assert.deepEqual(store.summary(), before, '실패한 파일은 전체를 롤백');
  } finally { store.close(); rmSync(root, { recursive: true, force: true }); }
});

test('53주 일별·주간·누적, 연도 경계, 미래 칸, 기록 없는 날', () => {
  const days: TokenDay[] = [
    { date: '2024-01-01', tokens: 100, messages: 1 },
    { date: '2025-12-31', tokens: 10, messages: 1 },
    { date: '2026-01-01', tokens: 20, messages: 2 },
  ];
  const daily = activityCalendar(days, '2026-01-01', 'daily');
  assert.equal(daily.length, 371);
  assert.equal(daily.find(c => c.date === '2026-01-01')?.value, 20);
  assert.equal(daily.find(c => c.date === '2025-12-30')?.level, 0);
  assert.ok(daily.find(c => c.date === '2026-01-02')?.future);
  const weekly = activityCalendar(days, '2026-01-01', 'weekly');
  assert.equal(weekly.find(c => c.date === '2025-12-31')?.value, 30);
  const cumulative = activityCalendar(days, '2026-01-01', 'cumulative');
  assert.equal(cumulative.find(c => c.date === '2026-01-01')?.value, 130);
  assert.ok(activityCalendar([], '2024-02-29', 'daily').some(c => c.date === '2024-02-29'));
  assert.ok(activityCalendar([], '2026-01-01', 'daily').every(c => c.level === 0));
});
