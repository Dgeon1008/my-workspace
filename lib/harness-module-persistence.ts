import type { DatabaseSync } from 'node:sqlite';
import { ProjectError } from './project.ts';
import { requireCategory, revealCategory } from './category-persistence.ts';
import { harnessModuleDefinitions, type HarnessModule } from './harness-modules.ts';

type ModuleRow = Omit<HarnessModule, 'position'> & { position: number; visible: number };

function seedHarnessModules(db: DatabaseSync) {
  const seed = db.prepare('INSERT OR IGNORE INTO harness_modules(id,moduleKey,name,categoryId,position) VALUES (?,?,?,?,?)');
  for (const [position, definition] of harnessModuleDefinitions.entries()) {
    const placeholders = definition.legacyNames.map(() => '?').join(',');
    const findLegacyCategory = db.prepare(`SELECT categoryId FROM projects WHERE lower(name) IN (${placeholders}) ORDER BY updatedAt DESC LIMIT 1`);
    const legacy = findLegacyCategory.get(...definition.legacyNames) as { categoryId: string | null } | undefined;
    const legacyCategory = legacy?.categoryId && db.prepare('SELECT id FROM project_categories WHERE id=?').get(legacy.categoryId)
      ? legacy.categoryId
      : null;
    const fallbackCategory = db.prepare('SELECT id FROM project_categories WHERE id=?').get(definition.categoryId)
      ? definition.categoryId
      : null;
    seed.run(definition.id, definition.moduleKey, definition.name, legacy ? legacyCategory : fallbackCategory, position);
  }
  // Rename the shipped module label while preserving any user-customized name.
  db.prepare("UPDATE harness_modules SET name=? WHERE id=? AND lower(name) IN (?, ?, ?, ?)")
    .run('태양계 여행', 'space-explorer', '우주 탐험', '은하 탐험', 'space explorer', 'galaxy explorer');
}

export function initializeHarnessModules(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS harness_modules (
    id TEXT PRIMARY KEY,
    moduleKey TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    categoryId TEXT,
    position INTEGER NOT NULL,
    visible INTEGER NOT NULL DEFAULT 1 CHECK(visible IN (0,1))
  )`);
  seedHarnessModules(db);
}

export function listHarnessModules(db: DatabaseSync): HarnessModule[] {
  // Add newly registered internal screens even when the workspace DB predates them.
  seedHarnessModules(db);
  const rows = db.prepare('SELECT id,moduleKey,name,categoryId,position,visible FROM harness_modules WHERE visible=1 ORDER BY position,id').all() as ModuleRow[];
  return rows.map(({ visible: _visible, ...module }) => module);
}

export function moveHarnessModule(db: DatabaseSync, id: unknown, target: unknown): HarnessModule {
  if (typeof id !== 'string' || !id) throw new ProjectError('프로젝트를 찾을 수 없습니다.', 404);
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!db.prepare('SELECT id FROM harness_modules WHERE id=? AND visible=1').get(id)) throw new ProjectError('프로젝트를 찾을 수 없습니다.', 404);
    const categoryId = requireCategory(db, target);
    const result = db.prepare('UPDATE harness_modules SET categoryId=? WHERE id=? AND visible=1').run(categoryId, id);
    if (!result.changes) throw new ProjectError('프로젝트를 찾을 수 없습니다.', 404);
    revealCategory(db, categoryId);
    db.exec('COMMIT');
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  }
  return listHarnessModules(db).find(module => module.id === id)!;
}

export function hideHarnessModule(db: DatabaseSync, id: unknown) {
  if (typeof id !== 'string' || !id) throw new ProjectError('삭제할 프로젝트를 선택해주세요.');
  const result = db.prepare('UPDATE harness_modules SET visible=0 WHERE id=? AND visible=1').run(id);
  if (!result.changes) throw new ProjectError('프로젝트를 찾을 수 없습니다.', 404);
  console.info('[harness] hidden module', id);
}
