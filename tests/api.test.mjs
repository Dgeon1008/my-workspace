import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = 'http://127.0.0.1:3000';
const api = `${base}/api/projects`;
async function send(method, body, extraHeaders = {}) {
  return fetch(api, { method, headers: { 'Content-Type': 'application/json', Origin: base, ...extraHeaders }, body: JSON.stringify(body) });
}

test('실행 중인 서버: 페이지·등록·중복·수정·즐겨찾기·검색 데이터·삭제·요청 방어', async () => {
  const path = mkdtempSync(join(tmpdir(), 'moa-api-'));
  let id;
  try {
    assert.equal((await fetch(base)).status, 200);
    assert.equal((await fetch(api)).status, 200);
    const input = { name: 'API 검증용 임시 프로젝트', path, description: '테스트 후 삭제', tags: ['검증'], status: '진행 중', color: 'sage', favorite: false };
    const created = await send('POST', input);
    assert.equal(created.status, 200);
    id = (await created.json()).project.id;
    assert.equal((await send('POST', input)).status, 409);
    const updated = await send('PUT', { ...input, id, name: '수정된 임시 프로젝트' });
    assert.equal((await updated.json()).project.name, '수정된 임시 프로젝트');
    const starred = await send('PATCH', { id, favorite: true });
    assert.equal((await starred.json()).project.favorite, true);
    const list = await (await fetch(api)).json();
    assert.ok(list.projects.some(p => p.id === id && p.name === '수정된 임시 프로젝트'));
    assert.equal((await send('POST', input, { Origin: 'https://untrusted.example' })).status, 403);
    assert.equal((await send('PUT', null)).status, 400);
    assert.equal((await send('POST', { ...input, path: 'relative-path' })).status, 400);
    assert.equal((await send('DELETE', { id })).status, 200);
    assert.ok(existsSync(path));
    assert.equal((await send('DELETE', { id })).status, 404);
    id = undefined;
  } finally {
    if (id) await send('DELETE', { id });
    rmSync(path, { recursive: true, force: true });
  }
});
