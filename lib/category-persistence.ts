import type { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { ProjectError } from './project.ts';
import { validateCategoryName, UNCATEGORIZED, type Category } from './category.ts';

export function initializeCategories(db: DatabaseSync) {
  // Serialize this additive migration so multiple Next.js handlers/processes
  // cannot both attempt to add the same column. Existing projects stay intact.
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS project_categories (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE,
      collapsed INTEGER NOT NULL DEFAULT 0 CHECK(collapsed IN (0,1)), position INTEGER NOT NULL
    )`);
    db.exec('CREATE TABLE IF NOT EXISTS deleted_default_categories (id TEXT PRIMARY KEY CHECK(id IN (\'stocks\',\'games\')))');
    const seed = db.prepare(`INSERT OR IGNORE INTO project_categories(id,name,name_key,position)
      SELECT ?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM deleted_default_categories WHERE id=?)`);
    seed.run('stocks', '주식', '주식', 0, 'stocks');
    seed.run('games', '게임', '게임', 1, 'games');
    seed.run(UNCATEGORIZED, '미분류', '미분류', 2);
    const columns = db.prepare('PRAGMA table_info(projects)').all() as { name: string }[];
    if (!columns.some(column => column.name === 'categoryId')) db.exec('ALTER TABLE projects ADD COLUMN categoryId TEXT');
    db.exec('CREATE INDEX IF NOT EXISTS projects_category ON projects(categoryId)');
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function listCategories(db: DatabaseSync): Category[] {
  const rows = db.prepare('SELECT id,name,collapsed,position FROM project_categories ORDER BY CASE WHEN id=? THEN 1 ELSE 0 END,position,id').all(UNCATEGORIZED) as (Omit<Category, 'collapsed'> & { collapsed: number })[];
  return rows.map(row => ({ ...row, collapsed: Boolean(row.collapsed) }));
}

export function requireCategory(db: DatabaseSync, value: unknown): string | null {
  if (value === null || value === UNCATEGORIZED) return null;
  if (typeof value !== 'string' || !db.prepare('SELECT id FROM project_categories WHERE id=?').get(value)) throw new ProjectError('존재하는 카테고리를 선택해주세요.');
  return value;
}

export function addCategory(db: DatabaseSync, value: unknown): Category {
  const { name, key } = validateCategoryName(value);
  const id = randomUUID();
  try {
    db.prepare('INSERT INTO project_categories(id,name,name_key,position) SELECT ?,?,?,COALESCE(MAX(position),0)+1 FROM project_categories').run(id, name, key);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) throw new ProjectError('같은 이름의 카테고리가 이미 있습니다.', 409);
    throw error;
  }
  console.info('[categories] created', id);
  return listCategories(db).find(category => category.id === id)!;
}

export function setCategoryCollapsed(db: DatabaseSync, id: unknown, collapsed: unknown): Category {
  if (typeof id !== 'string' || typeof collapsed !== 'boolean') throw new ProjectError('카테고리 접힘 정보를 확인해주세요.');
  const result = db.prepare('UPDATE project_categories SET collapsed=? WHERE id=?').run(+collapsed, id);
  if (!result.changes) throw new ProjectError('카테고리를 찾을 수 없습니다.', 404);
  return listCategories(db).find(category => category.id === id)!;
}

export function removeCategory(db: DatabaseSync, value: unknown) {
  if (typeof value !== 'string' || !value) throw new ProjectError('삭제할 카테고리를 선택해주세요.');
  if (value === UNCATEGORIZED) throw new ProjectError('미분류 카테고리는 삭제할 수 없습니다.', 409);

  db.exec('BEGIN IMMEDIATE');
  try {
    const category = db.prepare('SELECT id,name FROM project_categories WHERE id=?').get(value) as { id: string; name: string } | undefined;
    if (!category) throw new ProjectError('카테고리를 찾을 수 없습니다.', 404);
    const projectIds = (db.prepare('SELECT id FROM projects WHERE categoryId=?').all(value) as { id: string }[]).map(row => row.id);
    db.prepare('UPDATE projects SET categoryId=NULL,updatedAt=? WHERE categoryId=?').run(new Date().toISOString(), value);
    db.prepare('UPDATE harness_modules SET categoryId=NULL WHERE categoryId=?').run(value);
    db.prepare('DELETE FROM project_categories WHERE id=?').run(value);
    if (value === 'stocks' || value === 'games') db.prepare('INSERT OR IGNORE INTO deleted_default_categories(id) VALUES (?)').run(value);
    revealCategory(db, null);
    db.exec('COMMIT');
    console.info('[categories] removed', value, 'projects', projectIds.length);
    return { category, projectIds };
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  }
}

export function revealCategory(db: DatabaseSync, id: string | null) {
  db.prepare('UPDATE project_categories SET collapsed=0 WHERE id=?').run(id || UNCATEGORIZED);
}
