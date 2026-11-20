import { fork } from 'node:child_process';
import { mkdirSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { loadHarnessProject } from './harness-config.mjs';

const state = globalThis as typeof globalThis & { moaProjectStarts?: Map<string, Promise<string>> };
const starts = state.moaProjectStarts ??= new Map<string, Promise<string>>();

export async function ensureHarnessProject(id: string): Promise<string> {
  const config = await loadHarnessProject(id);
  const url = `http://127.0.0.1:${config.port}`;
  try {
    const response = await fetch(url + '/_moa/health', { signal: AbortSignal.timeout(800), cache: 'no-store' });
    const status = await response.json();
    if (response.ok && status.ready && status.id === id && status.sourceKey === config.sourceKey) return url;
    throw new Error('다른 프로그램이 프로젝트 포트를 사용하고 있습니다.');
  } catch (error) {
    if (error instanceof Error && error.message === '다른 프로그램이 프로젝트 포트를 사용하고 있습니다.') throw error;
  }
  const pending = starts.get(id);
  if (pending) return pending;
  const start = new Promise<string>((ready, reject) => {
    const logFolder = resolve('data/harness');
    mkdirSync(logFolder, { recursive: true });
    const log = createWriteStream(resolve(logFolder, `${id}.log`), { flags: 'a' });
    const child = fork(resolve('scripts/harness-project.mjs'), ['--project', id], {
      cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    child.stdout?.pipe(log, { end: false });
    child.stderr?.pipe(log, { end: false });
    let settled = false;
    const timeout = setTimeout(() => fail(new Error('프로젝트 시작 시간이 초과되었습니다.')), 20000);
    function fail(error: Error) {
      if (settled) return;
      settled = true; clearTimeout(timeout); child.kill(); reject(error);
    }
    log.on('error', () => fail(new Error('프로젝트 로그를 저장하지 못했습니다.')));
    child.once('error', () => fail(new Error('프로젝트를 시작하지 못했습니다.')));
    child.on('message', (value: unknown) => {
      const message = value as { ready?: boolean; url?: string; error?: string };
      if (message.ready && message.url === url && !settled) {
        settled = true; clearTimeout(timeout); ready(url);
      } else if (message.error) fail(new Error(message.error));
    });
    child.once('exit', () => { log.end(); if (!settled) fail(new Error('프로젝트 서버가 종료되었습니다.')); });
  });
  starts.set(id, start);
  try { return await start; }
  finally { if (starts.get(id) === start) starts.delete(id); }
}
