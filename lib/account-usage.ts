import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createHash } from 'node:crypto';
import type { TokenDay } from './token-activity.ts';

export type AccountUsage = {
  accountKey: string;
  days: TokenDay[] | null;
  summary: { lifetimeTokens: number | null; peakDailyTokens: number | null };
};
export class UsageError extends Error {}
const record = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
function count(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value;
  throw new UsageError('서버의 토큰 수 형식을 확인할 수 없습니다.');
}

export function normalizeAccountUsage(value: unknown, identity: unknown): AccountUsage {
  const user = record(identity);
  const account = record(user?.account);
  if (!account || !['chatgpt', 'chatgptAuthTokens', 'agentIdentity', 'personalAccessToken'].includes(String(account.type))) throw new UsageError('Codex 앱에서 ChatGPT 계정으로 로그인해주세요.');
  const identifier = user?.userId || account.email;
  if (typeof identifier !== 'string' || !identifier) throw new UsageError('로그인 계정을 확인할 수 없습니다.');
  const result = record(value);
  const summary = record(result?.summary);
  if (!result || !summary || !('dailyUsageBuckets' in result)) throw new UsageError('이 버전의 사용량 응답을 지원하지 않습니다.');
  let days: TokenDay[] | null = null;
  if (result.dailyUsageBuckets !== null) {
    if (!Array.isArray(result.dailyUsageBuckets)) throw new UsageError('날짜별 사용량 형식이 올바르지 않습니다.');
    const byDate = new Map<string, TokenDay>();
    for (const raw of result.dailyUsageBuckets) {
      const bucket = record(raw);
      const date = bucket?.startDate;
      const tokens = count(bucket?.tokens);
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date || tokens === null || byDate.has(date)) throw new UsageError('날짜별 사용량을 정확하게 확인할 수 없습니다.');
      byDate.set(date, { date, tokens, messages: 0 });
    }
    days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
  return {
    accountKey: createHash('sha256').update(JSON.stringify([identifier, account.email || null, account.workspaceName || null, user?.workspaceRouting || null])).digest('hex'),
    days,
    summary: { lifetimeTokens: count(summary.lifetimeTokens), peakDailyTokens: count(summary.peakDailyTokens) },
  };
}

// The official app server owns authentication. No auth file, credential,
// conversation body, or model turn is read or created by this integration.
export function readAccountUsage(options: { executable?: string; args?: string[]; timeoutMs?: number } = {}): Promise<AccountUsage> {
  return new Promise((resolve, reject) => {
    const executable = options.executable || process.env.CODEX_EXECUTABLE || 'codex';
    let args = options.args || ['app-server'];
    if (!options.args && process.env.CODEX_APP_SERVER_ARGS) {
      try {
        const configured: unknown = JSON.parse(process.env.CODEX_APP_SERVER_ARGS);
        if (!Array.isArray(configured) || !configured.every(arg => typeof arg === 'string')) throw new Error();
        args = configured;
      } catch { reject(new UsageError('CODEX_APP_SERVER_ARGS 설정이 올바르지 않습니다.')); return; }
    }
    const child = spawn(executable, args, { stdio: ['pipe', 'pipe', 'pipe'], shell: false, windowsHide: true });
    const lines = createInterface({ input: child.stdout });
    let settled = false;
    let identity: unknown;
    let size = 0;
    const finish = (error?: Error, usage?: AccountUsage) => {
      if (settled) return;
      settled = true; clearTimeout(timer); lines.close(); child.stdin.end(); child.kill();
      if (error) reject(error); else resolve(usage!);
    };
    const timer = setTimeout(() => finish(new UsageError('사용량 조회 시간이 초과됐습니다. 마지막 기록을 유지합니다.')), options.timeoutMs ?? 20000);
    const send = (message: unknown) => child.stdin.write(`${JSON.stringify(message)}\n`);
    child.stderr.on('data', () => {});
    child.stdin.on('error', () => finish(new UsageError('사용량 조회 연결이 종료됐습니다.')));
    child.on('error', () => finish(new UsageError('Codex 실행 파일을 찾거나 실행하지 못했습니다. 설치 상태와 CODEX_EXECUTABLE 설정을 확인해주세요.')));
    child.on('exit', () => finish(new UsageError('사용량 조회가 완료되기 전에 연결이 종료됐습니다.')));
    child.stdout.on('data', chunk => { size += chunk.length; if (size > 16 * 1024 * 1024) finish(new UsageError('사용량 응답이 허용 크기를 초과했습니다.')); });
    lines.on('line', line => {
      if (settled) return;
      let message: Record<string, unknown>;
      try { message = JSON.parse(line); } catch { return; }
      if (![1, 2, 3].includes(Number(message.id))) return;
      if (message.error) { finish(new UsageError('계정 사용량을 조회하지 못했습니다. ChatGPT 로그인 상태와 Codex 버전을 확인해주세요.')); return; }
      if (message.id === 1) {
        send({ method: 'initialized', params: {} });
        send({ method: 'account/read', id: 2, params: { refreshToken: false } });
      } else if (message.id === 2) {
        identity = message.result;
        if (!record(record(identity)?.account)) { finish(new UsageError('Codex 앱에서 ChatGPT 계정으로 로그인해주세요.')); return; }
        send({ method: 'account/usage/read', id: 3 });
      } else if (message.id === 3) {
        try { finish(undefined, normalizeAccountUsage(message.result, identity)); }
        catch (error) { finish(error instanceof UsageError ? error : new UsageError('사용량 응답을 확인하지 못했습니다.')); }
      }
    });
    send({ method: 'initialize', id: 1, params: { clientInfo: { name: 'moa_workspace_usage', title: 'Moa Workspace', version: '1.0.0' } } });
  });
}
