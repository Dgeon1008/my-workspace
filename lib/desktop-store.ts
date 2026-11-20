import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { ProjectError } from './project.ts';

export type DesktopConfig = { root: string; file: string; target: string; version: string; kind: 'exe' | 'script'; updatedAt: string };
export type DesktopRun = { state: 'idle' | 'launching' | 'running' | 'unverified' | 'failed'; attemptId: string | null; pid: number | null; processKey: string | null; updatedAt: string | null; message: string };
export type LaunchEvent = { id: number; at: string; message: string };
export const activeLaunchStates = ['launching', 'running', 'unverified'];
export const idleRun = (): DesktopRun => ({ state: 'idle', attemptId: null, pid: null, processKey: null, updatedAt: null, message: '실행 대기' });
export const desktopSchema = `CREATE TABLE IF NOT EXISTS desktop_launch (
  project_id TEXT PRIMARY KEY, config TEXT, run TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS desktop_launch_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, project_id TEXT NOT NULL, at TEXT NOT NULL, message TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS desktop_events_project ON desktop_launch_events(project_id,id);`;

export function assertProjectUnlocked(db: DatabaseSync, id: string) {
  const row = db.prepare('SELECT run FROM desktop_launch WHERE project_id=?').get(id) as { run: string } | undefined;
  if (row && activeLaunchStates.includes((JSON.parse(row.run) as DesktopRun).state)) throw new ProjectError('프로그램을 닫고 실행 상태를 확인한 뒤 프로젝트를 변경하거나 삭제해주세요.', 409);
}

export function createDesktopStore(filename: string) {
  if (filename !== ':memory:') mkdirSync(dirname(resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; ${desktopSchema}`);
  const config = (id: string): DesktopConfig | null => {
    const row = db.prepare('SELECT config FROM desktop_launch WHERE project_id=?').get(id) as { config: string | null } | undefined;
    return row?.config ? JSON.parse(row.config) : null;
  };
  const run = (id: string): DesktopRun => {
    const row = db.prepare('SELECT run FROM desktop_launch WHERE project_id=?').get(id) as { run: string } | undefined;
    return row ? JSON.parse(row.run) : idleRun();
  };
  const event = (id: string, message: string) => {
    db.prepare('INSERT INTO desktop_launch_events(project_id,at,message) VALUES (?,?,?)').run(id, new Date().toISOString(), message);
    db.prepare('DELETE FROM desktop_launch_events WHERE project_id=? AND id NOT IN (SELECT id FROM desktop_launch_events WHERE project_id=? ORDER BY id DESC LIMIT 50)').run(id, id);
  };
  function transaction<T>(action: () => T): T {
    db.exec('BEGIN IMMEDIATE');
    try { const result = action(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  return {
    config, run,
    events: (id: string) => db.prepare('SELECT id,at,message FROM desktop_launch_events WHERE project_id=? ORDER BY id DESC LIMIT 30').all(id) as LaunchEvent[],
    unlinkConfig(id: string) {
      transaction(() => {
        db.prepare('UPDATE desktop_launch SET config=NULL WHERE project_id=?').run(id);
        event(id, '실행 파일 연결을 해제했습니다. 실행 중인 프로그램과 종료 확인 잠금은 유지합니다.');
      });
    },
    saveConfig(id: string, value: DesktopConfig) {
      transaction(() => {
        assertProjectUnlocked(db, id);
        db.prepare('INSERT INTO desktop_launch VALUES(?,?,?) ON CONFLICT(project_id) DO UPDATE SET config=excluded.config,run=excluded.run').run(id, JSON.stringify(value), JSON.stringify(idleRun()));
        event(id, `실행 파일 설정: ${value.file}`);
      });
    },
    reserve(id: string, version: string, attemptId: string) {
      return transaction(() => {
        assertProjectUnlocked(db, id);
        if (config(id)?.version !== version) throw new ProjectError('실행 설정이 변경됐습니다. 설정을 다시 확인해주세요.', 409);
        const value: DesktopRun = { ...idleRun(), state: 'launching', attemptId, updatedAt: new Date().toISOString(), message: '실행 요청을 전달하는 중' };
        db.prepare('UPDATE desktop_launch SET run=? WHERE project_id=?').run(JSON.stringify(value), id);
        event(id, '사용자가 실행을 요청했습니다.');
        return value;
      });
    },
    updateRun(id: string, attemptId: string | null, value: DesktopRun) {
      return transaction(() => {
        const previous = run(id);
        if (previous.attemptId !== attemptId) return previous;
        db.prepare('UPDATE desktop_launch SET run=? WHERE project_id=?').run(JSON.stringify(value), id);
        if (previous.state !== value.state || previous.message !== value.message) event(id, value.message);
        return value;
      });
    },
    close: () => db.close(),
  };
}

let store: ReturnType<typeof createDesktopStore> | undefined;
export function desktopStore() { return store ??= createDesktopStore(resolve(process.env.WORKSPACE_DB_PATH || './data/workspace.sqlite')); }
