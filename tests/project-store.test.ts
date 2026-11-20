import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProjectStore } from '../lib/project-store.ts';
import { validateProject, type ProjectInput } from '../lib/project.ts';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'moa-test-'));
  const path = join(root, 'project'); mkdirSync(path);
  const store = createProjectStore(join(root, 'db.sqlite'));
  const input: ProjectInput = { name: '테스트 프로젝트', path, description: '설명', tags: ['Next.js'], status: '진행 중', color: 'sage', favorite: false };
  return { root, path, store, input, cleanup() { store.close(); rmSync(root, { recursive: true, force: true }); } };
}
test('등록·수정·즐겨찾기·삭제 및 실제 폴더 보존', () => {
  const f = fixture();
  try {
    const p = f.store.save(f.input); assert.equal(f.store.list().length, 1);
    const edited = f.store.save({ ...f.input, name: '수정한 프로젝트' }, p.id); assert.equal(edited.name, '수정한 프로젝트');
    assert.equal(f.store.favorite(p.id, true).favorite, true);
    f.store.remove(p.id); assert.equal(f.store.list().length, 0);
    assert.doesNotThrow(() => mkdirSync(join(f.path, 'still-exists')));
    assert.throws(() => f.store.remove(p.id), /찾을 수 없/);
  } finally { f.cleanup(); }
});
test('DB를 다시 열어도 등록 정보 유지', () => {
  const f = fixture();
  try {
    const p = f.store.save(f.input);
    const reopened = createProjectStore(join(f.root, 'db.sqlite'));
    try { assert.equal(reopened.list()[0].id, p.id); } finally { reopened.close(); }
  } finally { f.cleanup(); }
});
test('중복 경로·누락된 폴더·상대 경로 차단', () => {
  const f = fixture();
  try {
    f.store.save(f.input);
    assert.throws(() => f.store.save(f.input), /이미 등록/);
    assert.throws(() => f.store.save({ ...f.input, path: join(f.root, 'missing') }), /로컬 폴더/);
    assert.throws(() => f.store.save({ ...f.input, path: 'relative/path' }), /절대 경로/);
    assert.equal(f.store.list().length, 1);
  } finally { f.cleanup(); }
});
test('유효하지 않은 입력과 태그 개수 차단', () => {
  assert.throws(() => validateProject(null));
  assert.throws(() => validateProject({ name: '' }), /이름/);
  const f = fixture();
  try {
    assert.throws(() => f.store.save({ ...f.input, tags: Array(9).fill('태그') }), /태그/);
    assert.throws(() => f.store.save({ ...f.input, status: 'invalid' }), /상태/);
    assert.deepEqual(validateProject({ ...f.input, tags: ['React', 'React'] }).tags, ['React']);
  } finally { f.cleanup(); }
});
