import { readdirSync, realpathSync, statSync } from 'node:fs';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { ProjectError, type Project } from './project.ts';
import { desktopStore, idleRun, type DesktopConfig, type DesktopRun, type LaunchEvent } from './desktop-store.ts';
import { projectStore } from './project-store.ts';
import { windowsDesktopAdapter, type DesktopAdapter } from './windows-launcher.ts';

export type DesktopStatus = { config: DesktopConfig | null; run: DesktopRun; events: LaunchEvent[]; candidates: string[]; supported: boolean };
function inside(root: string, target: string) { const part = relative(root, target); return part !== '' && part !== '..' && !part.startsWith(`..${sep}`) && !isAbsolute(part); }

export function resolveDesktopFile(rootPath: string, file: unknown): DesktopConfig {
  if (typeof file !== 'string' || !file.trim() || file.length > 2048 || /[\r\n\0]/.test(file)) throw new ProjectError('실행할 파일 경로를 입력해주세요.');
  let root: string, target: string;
  try { root = realpathSync.native(rootPath); target = realpathSync.native(resolve(root, file.trim())); }
  catch { throw new ProjectError('프로젝트 폴더와 실행 파일이 실제로 존재하는지 확인해주세요.'); }
  if (!inside(root, target)) throw new ProjectError('등록한 프로젝트 폴더 안의 실행 파일만 선택할 수 있습니다.');
  const extension = extname(target).toLowerCase();
  if (!['.exe', '.bat', '.cmd'].includes(extension)) throw new ProjectError('exe, bat, cmd 파일만 실행할 수 있습니다.');
  // Batch dispatch passes through Windows file associations. Refuse characters
  // that a command interpreter could expand even inside a quoted path.
  if (extension !== '.exe' && /[%!&|<>^"()]/.test(target)) throw new ProjectError('배치 파일 경로에는 %, !, &, 괄호 등 명령 해석 문자를 사용할 수 없습니다.');
  const stat = statSync(target);
  if (!stat.isFile()) throw new ProjectError('폴더가 아닌 실행 파일을 선택해주세요.');
  const version = createHash('sha256').update(JSON.stringify([root, target, stat.size, stat.mtimeMs])).digest('hex');
  return { root, target, file: relative(root, target), version, kind: extension === '.exe' ? 'exe' : 'script', updatedAt: new Date().toISOString() };
}

export function discoverDesktopFiles(rootPath: string) {
  const found: string[] = [];
  let scanned = 0;
  try {
    const root = realpathSync.native(rootPath);
    const walk = (folder: string, depth: number) => {
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        if (++scanned > 1000 || found.length >= 40) return;
        if (entry.isSymbolicLink()) continue;
        const path = resolve(folder, entry.name);
        if (entry.isFile() && /\.(exe|bat|cmd)$/i.test(entry.name)) found.push(relative(root, path));
        if (depth < 2 && entry.isDirectory() && !entry.name.startsWith('.') && !['node_modules', 'venv', '__pycache__'].includes(entry.name)) {
          try { if (inside(root, realpathSync.native(path))) walk(path, depth + 1); } catch { /* inaccessible folder */ }
        }
      }
    };
    walk(root, 0);
  } catch { /* status still works when a folder is temporarily unavailable */ }
  return found.sort((a, b) => a.localeCompare(b));
}

export function createDesktopRunner(options: { store: ReturnType<typeof desktopStore>; getProject: (id: string) => Project; adapter: DesktopAdapter; supported?: boolean; now?: () => number }) {
  const now = options.now || Date.now;
  const supported = options.supported ?? process.platform === 'win32';
  const checks = new Map<string, { at: number; pending?: Promise<void> }>();
  const projectConfig = (id: string) => {
    const project = options.getProject(id);
    const config = options.store.config(id);
    let root = project.path;
    try { root = realpathSync.native(root); } catch { /* retain saved display path */ }
    return { project, config: config?.root === root ? config : null };
  };
  async function reconcile(id: string) {
    const previous = checks.get(id);
    if (previous?.pending) return previous.pending;
    if (previous && now() - previous.at < 5000) return;
    const check = { at: now(), pending: undefined as Promise<void> | undefined };
    check.pending = (async () => {
      const run = options.store.run(id);
      if (run.state === 'running') {
        const state = await options.adapter.inspect(run);
        if (state !== 'alive') options.store.updateRun(id, run.attemptId, { ...run, state: 'unverified', updatedAt: new Date(now()).toISOString(), message: state === 'gone' ? '초기 실행 프로세스가 종료됐습니다. 별도 프로그램 창이 남아 있을 수 있으니 확인해주세요.' : '프로그램 실행 여부를 확인할 수 없습니다. 프로그램 창을 확인해주세요.' });
      } else if (run.state === 'launching' && run.updatedAt && now() - Date.parse(run.updatedAt) > 30000) {
        options.store.updateRun(id, run.attemptId, { ...run, state: 'unverified', updatedAt: new Date(now()).toISOString(), message: '이전 실행 요청의 결과가 불명확합니다. 프로그램 창을 확인한 뒤 실행 잠금을 해제해주세요.' });
      }
    })();
    checks.set(id, check);
    try { await check.pending; } finally { check.pending = undefined; }
  }
  const status = (id: string, candidates = false): DesktopStatus => {
    const { project, config } = projectConfig(id);
    return { config, run: options.store.run(id), events: options.store.events(id), candidates: candidates ? discoverDesktopFiles(project.path) : [], supported };
  };
  return {
    async status(id: string, candidates = false) { options.getProject(id); await reconcile(id); return status(id, candidates); },
    configure(id: string, file: unknown) {
      const project = options.getProject(id);
      const config = resolveDesktopFile(project.path, file);
      options.store.saveConfig(id, config);
      return status(id, true);
    },
    unlink(id: string) {
      options.getProject(id);
      options.store.unlinkConfig(id);
      return status(id, true);
    },
    async start(id: string, confirmedVersion: unknown) {
      if (!supported) throw new ProjectError('Windows에서 실행할 수 있습니다.');
      const { project, config } = projectConfig(id);
      if (!config) throw new ProjectError('먼저 실행 파일을 설정해주세요.');
      const current = resolveDesktopFile(project.path, config.file);
      if (current.version !== config.version || confirmedVersion !== config.version) throw new ProjectError('실행 파일이나 설정이 변경됐습니다. 실행 설정을 다시 저장하고 확인해주세요.', 409);
      const attemptId = randomUUID();
      const reserved = options.store.reserve(id, config.version, attemptId);
      try {
        // Recheck immediately after the durable reservation.
        if (resolveDesktopFile(project.path, config.file).version !== config.version) throw new ProjectError('실행 파일이 변경됐습니다.');
        const process = await options.adapter.start(config);
        options.store.updateRun(id, attemptId, { ...reserved, ...process, state: config.kind === 'exe' && process.pid && process.processKey ? 'running' : 'unverified', updatedAt: new Date(now()).toISOString(), message: config.kind === 'exe' && process.pid && process.processKey ? '프로그램을 실행했습니다.' : '실행 요청을 전달했습니다. 별도로 열린 프로그램 창을 확인해주세요.' });
      } catch (error) {
        // A timed-out helper may already have launched the target: do not retry.
        options.store.updateRun(id, attemptId, { ...reserved, state: 'unverified', updatedAt: new Date(now()).toISOString(), message: error instanceof ProjectError ? error.message : '실행 결과를 확인할 수 없습니다. 프로그램 창을 확인해주세요.' });
      }
      checks.delete(id);
      return status(id);
    },
    async acknowledgeClosed(id: string, confirmed: unknown) {
      options.getProject(id);
      if (confirmed !== true) throw new ProjectError('프로그램 창을 닫았는지 먼저 확인해주세요.');
      const run = options.store.run(id);
      if (run.state === 'launching' && run.updatedAt && now() - Date.parse(run.updatedAt) < 30000) throw new ProjectError('실행 요청 처리 중입니다. 잠시 후 확인해주세요.', 409);
      if (run.pid && await options.adapter.inspect(run) !== 'gone') throw new ProjectError('기존 실행 프로세스가 남아 있거나 종료를 확인할 수 없습니다. 해당 프로그램을 정상 종료해주세요.', 409);
      options.store.updateRun(id, run.attemptId, { ...idleRun(), attemptId: randomUUID(), updatedAt: new Date(now()).toISOString(), message: '사용자가 프로그램 종료를 확인하고 실행 잠금을 해제했습니다.' });
      checks.delete(id);
      return status(id);
    },
  };
}

let runner: ReturnType<typeof createDesktopRunner> | undefined;
export function desktopRunner() {
  return runner ??= createDesktopRunner({ store: desktopStore(), getProject: id => projectStore().get(id), adapter: windowsDesktopAdapter });
}
