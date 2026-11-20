import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

test('분리된 DB의 실제 API: 기본 분류·추가·접기·등록·이동·재시작 복구', { timeout: 45000 }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'moa-categories-api-'));
  const projectPath = join(root, 'project'); mkdirSync(projectPath);
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  let child;
  let exited;
  const request = (path, method = 'GET', value, headers = {}) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', Origin: base, ...headers }, body: value === undefined ? undefined : JSON.stringify(value) });
  async function start() {
    child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)], { env: { ...process.env, WORKSPACE_DB_PATH: join(root, 'isolated.sqlite') }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    child.stdout.on('data', () => {}); child.stderr.on('data', () => {});
    exited = once(child, 'exit');
    for (let i = 0; i < 100; i++) { try { if ((await fetch(base)).ok) return; } catch {} await delay(100); }
    throw new Error('테스트 서버가 시작되지 않았습니다.');
  }
  async function stop() { if (child && child.exitCode === null) child.kill(); if (exited) await exited; child = null; }
  try {
    await start();
    const initial = await (await request('/api/categories')).json();
    assert.deepEqual(initial.categories.map(c => c.name), ['주식', '게임', '미분류']);
    const added = await request('/api/categories', 'POST', { name: '업무' });
    assert.equal(added.status, 200);
    const category = (await added.json()).category;
    assert.equal((await request('/api/categories', 'POST', { name: '  업무  ' })).status, 409);
    assert.equal((await request('/api/categories', 'POST', { name: '' })).status, 400);
    assert.equal((await request('/api/categories', 'POST', { name: '외부 요청' }, { Origin: 'https://untrusted.example' })).status, 403);
    assert.equal((await request('/api/categories', 'PATCH', { id: category.id, collapsed: 'true' })).status, 400);
    const folded = await request('/api/categories', 'PATCH', { id: category.id, collapsed: true });
    assert.equal((await folded.json()).category.collapsed, true);
    const input = { name: '카테고리 검증 프로젝트', path: projectPath, description: '', tags: [], status: '진행 중', color: 'sage', favorite: false, categoryId: category.id };
    const created = await request('/api/projects', 'POST', input);
    const createdData = await created.json();
    assert.equal(created.status, 200);
    const project = createdData.project;
    assert.equal(project.categoryId, category.id);
    assert.equal(createdData.categories.find(c => c.id === category.id).collapsed, false);
    const moved = await request('/api/projects', 'PATCH', { id: project.id, categoryId: 'games' });
    const movedData = await moved.json();
    assert.equal(movedData.project.categoryId, 'games');
    assert.equal(movedData.project.path, project.path);
    assert.equal((await request('/api/projects', 'PATCH', { id: project.id, categoryId: 'absent' })).status, 400);
    assert.equal((await request('/api/projects', 'PATCH', { id: project.id, categoryId: 'stocks', favorite: true })).status, 400);
    await request('/api/categories', 'PATCH', { id: 'games', collapsed: true });
    await stop(); await start();
    const restored = await (await request('/api/projects')).json();
    assert.equal(restored.projects[0].categoryId, 'games');
    assert.equal(restored.categories.find(c => c.id === 'games').collapsed, true);
    assert.equal(restored.categories.filter(c => c.name === '주식').length, 1);
    const unclassified = await (await request('/api/projects', 'PATCH', { id: project.id, categoryId: null })).json();
    assert.equal(unclassified.project.categoryId, null);
    assert.equal((await request('/api/projects', 'DELETE', { id: project.id })).status, 200);
  } finally { await stop(); rmSync(root, { recursive: true, force: true }); }
});
