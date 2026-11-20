import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createProjectStore } from '../lib/project-store.ts';
import { createDesktopStore } from '../lib/desktop-store.ts';
import { createDesktopRunner, resolveDesktopFile, discoverDesktopFiles } from '../lib/desktop-launch.ts';

function fixture() {
  const root = mkdtempSync(join(resolve('tests'), 'desktop-tmp-'));
  const path = join(root, 'project'); mkdirSync(path);
  writeFileSync(join(path, 'App.exe'), 'test fixture only; never execute');
  writeFileSync(join(path, 'launch.bat'), '@echo off');
  const dbFile = join(root, 'db.sqlite');
  const projects = createProjectStore(dbFile);
  const store = createDesktopStore(dbFile);
  const input = { name: '실행 테스트', path, description: '', tags: [], status: '진행 중', color: 'sage', favorite: false };
  const project = projects.save(input);
  let launches = 0;
  let state: 'alive' | 'gone' | 'unknown' = 'alive';
  let time = Date.now();
  const makeRunner = (start = async () => { launches++; await Promise.resolve(); return { pid: 123, processKey: 'birth-time' }; }) => createDesktopRunner({ store, getProject: id => projects.get(id), supported: true, now: () => time, adapter: { start, inspect: async () => state } });
  return { root, path, dbFile, project, projects, store, input, makeRunner, launches: () => launches, setState: (value: typeof state) => { state = value; }, tick: () => { time += 31000; }, cleanup() { store.close(); projects.close(); rmSync(root, { recursive: true, force: true }); } };
}

test('실행 파일 검증·폴더 경계·확장자·후보 탐색', () => {
  const f = fixture();
  try {
    assert.equal(resolveDesktopFile(f.path, 'App.exe').kind, 'exe');
    assert.equal(resolveDesktopFile(f.path, 'launch.bat').kind, 'script');
    writeFileSync(join(f.root, 'outside.exe'), 'outside');
    writeFileSync(join(f.path, 'unsafe&name.cmd'), 'no');
    writeFileSync(join(f.path, 'notes.txt'), 'notes');
    assert.throws(() => resolveDesktopFile(f.path, '../outside.exe'), /프로젝트 폴더/);
    assert.throws(() => resolveDesktopFile(f.path, 'unsafe&name.cmd'), /해석 문자/);
    assert.throws(() => resolveDesktopFile(f.path, 'notes.txt'), /exe/);
    assert.throws(() => resolveDesktopFile(f.path, 'missing.exe'), /존재/);
    assert.ok(discoverDesktopFiles(f.path).includes('App.exe'));
  } finally { f.cleanup(); }
});

test('실행 확인·파일 변경 차단·중복 실행 차단·재실행 후 상태 보존', async () => {
  const f = fixture();
  try {
    const runner = f.makeRunner();
    const config = runner.configure(f.project.id, 'App.exe').config!;
    assert.equal(f.launches(), 0, '설정 저장만으로 실행하지 않음');
    await assert.rejects(() => runner.start(f.project.id, 'wrong'), /변경/);
    const first = runner.start(f.project.id, config.version);
    await assert.rejects(() => runner.start(f.project.id, config.version), /프로그램을 닫고/);
    assert.equal((await first).run.state, 'running');
    assert.equal(f.launches(), 1);
    assert.throws(() => f.projects.remove(f.project.id), /프로그램을 닫고/);
    assert.throws(() => f.projects.save(f.input, f.project.id), /프로그램을 닫고/);
    const reopened = createDesktopStore(f.dbFile);
    try { assert.equal(reopened.run(f.project.id).state, 'running'); } finally { reopened.close(); }
    await assert.rejects(() => runner.acknowledgeClosed(f.project.id, true), /프로세스가 남아/);
    f.setState('gone'); f.tick();
    assert.equal((await runner.status(f.project.id)).run.state, 'unverified');
    assert.equal((await runner.acknowledgeClosed(f.project.id, true)).run.state, 'idle');
    writeFileSync(join(f.path, 'App.exe'), 'changed executable');
    await assert.rejects(() => runner.start(f.project.id, config.version), /변경/);
    assert.equal(f.launches(), 1);
    assert.ok(f.store.events(f.project.id).length >= 4, JSON.stringify(f.store.events(f.project.id)));
  } finally { f.cleanup(); }
});

test('배치 실행과 시간 초과는 별도 창 확인 필요, 자동 재시도하지 않음', async () => {
  const f = fixture();
  try {
    const runner = f.makeRunner();
    const config = runner.configure(f.project.id, 'launch.bat').config!;
    assert.equal((await runner.start(f.project.id, config.version)).run.state, 'unverified');
    await assert.rejects(() => runner.start(f.project.id, config.version));
    f.setState('gone');
    await runner.acknowledgeClosed(f.project.id, true);
    const failed = f.makeRunner(async () => { throw new Error('timeout'); });
    assert.equal((await failed.start(f.project.id, config.version)).run.state, 'unverified');
    await assert.rejects(() => failed.start(f.project.id, config.version));
  } finally { f.cleanup(); }
});

test('잘못된 실행 연결은 해제하되 프로세스 상태·중복 방지 잠금은 보존', async () => {
  const f = fixture();
  try {
    const runner = f.makeRunner();
    const config = runner.configure(f.project.id, 'launch.bat').config!;
    await runner.start(f.project.id, config.version);
    const before = f.store.run(f.project.id);
    const unlinked = runner.unlink(f.project.id);
    assert.equal(unlinked.config, null);
    assert.deepEqual(unlinked.run, before);
    await assert.rejects(() => runner.start(f.project.id, config.version), /먼저 실행 파일/);
    assert.throws(() => runner.configure(f.project.id, 'App.exe'), /프로그램을 닫고/);
    assert.equal(f.launches(), 1);
    assert.ok(f.store.events(f.project.id).some(event => event.message.includes('연결을 해제')));
  } finally { f.cleanup(); }
});
