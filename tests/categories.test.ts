import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createProjectStore } from '../lib/project-store.ts';
import { createDesktopStore } from '../lib/desktop-store.ts';
import { categoryOf } from '../lib/category.ts';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'moa-category-'));
  const path = join(root, 'project'); mkdirSync(path);
  const filename = join(root, 'workspace.sqlite');
  return { root, path, filename, input: { name: '기존 프로젝트', path, description: '', tags: [], status: '진행 중', color: 'sage', favorite: false }, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('기존 DB의 프로젝트·경로를 보존하며 카테고리를 한 번만 추가', () => {
  const f = fixture();
  const legacy = new DatabaseSync(f.filename);
  legacy.exec(`CREATE TABLE projects(id TEXT PRIMARY KEY,name TEXT,path TEXT,path_key TEXT UNIQUE,description TEXT,tags TEXT,status TEXT,color TEXT,favorite INTEGER,createdAt TEXT,updatedAt TEXT)`);
  legacy.prepare('INSERT INTO projects VALUES(?,?,?,?,?,?,?,?,?,?,?)').run('legacy', '이전 프로젝트', f.path, f.path, '', '[]', '진행 중', 'sage', 0, '2026-01-01', '2026-01-01');
  legacy.close();
  const store = createProjectStore(f.filename);
  try {
    assert.equal(store.get('legacy').path, f.path);
    assert.equal(store.get('legacy').categoryId, null);
    assert.equal(categoryOf(store.get('legacy')), 'uncategorized');
    assert.deepEqual(store.categories().map(c => c.name), ['주식', '게임', '미분류']);
    const reopened = createProjectStore(f.filename);
    try { assert.equal(reopened.categories().length, 3); assert.equal(reopened.list().length, 1); } finally { reopened.close(); }
  } finally { store.close(); f.cleanup(); }
});

test('사용자 카테고리·접힘·프로젝트 분류 이동·재연결 복구', () => {
  const f = fixture();
  const store = createProjectStore(f.filename);
  try {
    const category = store.addCategory('  나의 작업  ');
    assert.equal(category.name, '나의 작업');
    assert.throws(() => store.addCategory('나의 작업'), /이미/);
    store.addCategory('Tools');
    assert.throws(() => store.addCategory('ＴＯＯＬＳ'), /이미/);
    for (const name of ['', ' '.repeat(4), 'a'.repeat(33), '\n']) assert.throws(() => store.addCategory(name));
    assert.throws(() => store.setCategoryCollapsed('absent', true), /찾을 수/);
    assert.throws(() => store.setCategoryCollapsed(category.id, 'true'), /접힘/);
    store.setCategoryCollapsed('stocks', true);
    const p = store.save({ ...f.input, categoryId: 'stocks' });
    assert.equal(p.categoryId, 'stocks');
    assert.equal(store.categories().find(c => c.id === 'stocks')?.collapsed, false, '등록하면 자동으로 펼침');
    store.setCategoryCollapsed(category.id, true);
    const moved = store.moveCategory(p.id, category.id);
    assert.equal(moved.path, p.path);
    assert.equal(moved.categoryId, category.id);
    assert.equal(store.categories().find(c => c.id === category.id)?.collapsed, false);
    assert.equal(store.save({ ...f.input, name: '구형 클라이언트 수정' }, p.id).categoryId, category.id, '분류 필드가 없는 기존 요청은 분류 보존');
    assert.throws(() => store.moveCategory(p.id, 'missing'), /존재/);
    assert.equal(store.get(p.id).categoryId, category.id);
    store.setCategoryCollapsed(category.id, true);
    const reopened = createProjectStore(f.filename);
    try { assert.equal(reopened.get(p.id).categoryId, category.id); assert.equal(reopened.categories().find(c => c.id === category.id)?.collapsed, true); } finally { reopened.close(); }
    assert.equal(store.moveCategory(p.id, 'uncategorized').categoryId, null);
    assert.throws(() => store.save({ ...f.input, categoryId: 'missing' }, p.id), /존재/);
    assert.equal(store.get(p.id).categoryId, null);
  } finally { store.close(); f.cleanup(); }
});

test('실행 잠금 중에도 분류만 옮길 수 있고 경로·실행 상태는 유지', () => {
  const f = fixture();
  const store = createProjectStore(f.filename);
  const desktop = createDesktopStore(f.filename);
  try {
    const p = store.save(f.input);
    desktop.saveConfig(p.id, { root: p.path, file: 'Test.exe', target: join(p.path, 'Test.exe'), kind: 'exe', version: 'test', updatedAt: new Date().toISOString() });
    const reserved = desktop.reserve(p.id, 'test', 'attempt');
    store.moveCategory(p.id, 'games');
    assert.equal(store.get(p.id).path, p.path);
    assert.deepEqual(desktop.run(p.id), reserved);
    assert.equal(desktop.config(p.id)?.file, 'Test.exe');
    assert.throws(() => store.remove(p.id), /프로그램을 닫고/);
  } finally { desktop.close(); store.close(); f.cleanup(); }
});
