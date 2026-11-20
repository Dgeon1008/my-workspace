import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ProjectError, statuses, validateProject, type Project, type ProjectStatus } from './project.ts';
import { desktopSchema, assertProjectUnlocked } from './desktop-store.ts';
import { initializeCategories, listCategories, addCategory, setCategoryCollapsed, removeCategory, requireCategory, revealCategory } from './category-persistence.ts';
import { initializeHarnessModules, listHarnessModules, moveHarnessModule, hideHarnessModule } from './harness-module-persistence.ts';

type Row = Omit<Project, 'tags' | 'favorite' | 'status'> & { status: string; tags: string; favorite: number };
const decode = (row: Row): Project => ({ ...row, status: statuses.includes(row.status as ProjectStatus) ? row.status as ProjectStatus : '완료', tags: JSON.parse(row.tags), favorite: Boolean(row.favorite) });

export function createProjectStore(filename: string) {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, path TEXT NOT NULL, path_key TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL, tags TEXT NOT NULL, status TEXT NOT NULL, color TEXT NOT NULL,
      favorite INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
    ); ${desktopSchema}`);
  initializeCategories(db);
  initializeHarnessModules(db);
  const get = (id: string) => {
    const row = db.prepare('SELECT id,name,path,description,tags,status,color,favorite,createdAt,updatedAt,categoryId FROM projects WHERE id=?').get(id) as Row | undefined;
    if (!row) throw new ProjectError('프로젝트를 찾을 수 없습니다.', 404);
    return decode(row);
  };
  return {
    get,
    categories: () => listCategories(db),
    modules: () => listHarnessModules(db),
    moveModule: (id: unknown, target: unknown) => moveHarnessModule(db, id, target),
    removeModule: (id: unknown) => hideHarnessModule(db, id),
    addCategory: (name: unknown) => addCategory(db, name),
    setCategoryCollapsed: (id: unknown, collapsed: unknown) => setCategoryCollapsed(db, id, collapsed),
    removeCategory: (id: unknown) => removeCategory(db, id),
    list: () => (db.prepare('SELECT id,name,path,description,tags,status,color,favorite,createdAt,updatedAt,categoryId FROM projects ORDER BY updatedAt DESC,id').all() as Row[]).map(decode),
    save(value: unknown, id?: string) {
      const input = validateProject(value);
      if (id) { get(id); assertProjectUnlocked(db, id); }
      if (!isAbsolute(input.path)) throw new ProjectError('폴더의 절대 경로를 입력해주세요.');
      let canonical: string;
      try {
        canonical = realpathSync.native(input.path);
        if (!statSync(canonical).isDirectory()) throw new Error('not-directory');
      } catch { throw new ProjectError('접근 가능한 로컬 폴더가 아닙니다. 경로와 권한을 확인해주세요.'); }
      const key = process.platform === 'win32' ? canonical.toLowerCase() : canonical;
      const duplicate = db.prepare('SELECT id FROM projects WHERE path_key=?').get(key) as { id: string } | undefined;
      if (duplicate && duplicate.id !== id) throw new ProjectError('이미 등록된 프로젝트 경로입니다.', 409);
      const now = new Date().toISOString();
      const projectId = id || randomUUID();
      try {
        db.exec('BEGIN IMMEDIATE');
        if (id) assertProjectUnlocked(db, id);
        const categoryId = input.categoryId === undefined ? (id ? get(id).categoryId || null : null) : requireCategory(db, input.categoryId);
        if (id) db.prepare('UPDATE projects SET name=?,path=?,path_key=?,description=?,tags=?,status=?,color=?,favorite=?,updatedAt=? WHERE id=?').run(input.name, canonical, key, input.description, JSON.stringify(input.tags), input.status, input.color, +input.favorite, now, id);
        else db.prepare('INSERT INTO projects (id,name,path,path_key,description,tags,status,color,favorite,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(projectId, input.name, canonical, key, input.description, JSON.stringify(input.tags), input.status, input.color, +input.favorite, now, now);
        db.prepare('UPDATE projects SET categoryId=? WHERE id=?').run(categoryId, projectId);
        revealCategory(db, categoryId);
        db.exec('COMMIT');
      } catch (error) {
        if (db.isTransaction) db.exec('ROLLBACK');
        if (error instanceof Error && error.message.includes('UNIQUE')) throw new ProjectError('이미 등록된 프로젝트 경로입니다.', 409);
        throw error;
      }
      console.info('[projects]', id ? 'updated' : 'created', projectId);
      return get(projectId);
    },
    favorite(id: string, value: boolean) {
      get(id);
      db.prepare('UPDATE projects SET favorite=? WHERE id=?').run(+value, id);
      return get(id);
    },
    moveCategory(id: string, target: unknown) {
      db.exec('BEGIN IMMEDIATE');
      try {
        get(id);
        const categoryId = requireCategory(db, target);
        // Classification only: never change a path, launcher, or running process.
        db.prepare('UPDATE projects SET categoryId=?,updatedAt=? WHERE id=?').run(categoryId, new Date().toISOString(), id);
        revealCategory(db, categoryId);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      console.info('[projects] category moved', id);
      return get(id);
    },
    remove(id: string) {
      get(id);
      db.exec('BEGIN IMMEDIATE');
      try {
        assertProjectUnlocked(db, id);
        db.prepare('DELETE FROM desktop_launch WHERE project_id=?').run(id);
        db.prepare('DELETE FROM desktop_launch_events WHERE project_id=?').run(id);
        db.prepare('DELETE FROM projects WHERE id=?').run(id);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      console.info('[projects] removed', id);
    },
    close: () => db.close(),
  };
}

let store: ReturnType<typeof createProjectStore> | undefined;
export function projectStore() {
  return store ??= createProjectStore(resolve(process.env.WORKSPACE_DB_PATH || './data/workspace.sqlite'));
}
