import { readAccountUsage, UsageError, type AccountUsage } from './account-usage.ts';
import { tokenStore } from './token-store.ts';
import type { AccountActivityResponse, AccountSnapshot } from './token-activity.ts';

type SnapshotStore = { accountSnapshot: () => AccountSnapshot | null; saveAccountSnapshot: (value: AccountSnapshot) => void };
export function createTokenSync(options: { store: SnapshotStore; read?: () => Promise<AccountUsage>; intervalMs?: number; now?: () => number }) {
  const interval = options.intervalMs ?? 60000;
  const now = options.now || Date.now;
  let lastAttempt = -Infinity;
  let pending: Promise<AccountActivityResponse> | null = null;
  let error: string | null = null;
  function response(): AccountActivityResponse {
    const cached = options.store.accountSnapshot();
    return {
      days: cached?.days || [], summary: cached?.summary || { lifetimeTokens: null, peakDailyTokens: null },
      syncedAt: cached?.syncedAt || null, daysUpdatedAt: cached?.daysUpdatedAt || null,
      status: error ? cached ? 'stale' : 'unavailable' : cached ? 'ok' : 'unavailable',
      dailyAvailable: cached?.dailyAvailable ?? false,
      message: error || (cached && !cached.dailyAvailable ? '서버가 날짜별 기록을 제공하지 않았습니다. 기존 잔디가 있으면 마지막 기록으로 표시합니다.' : null),
      refreshIntervalMs: interval,
    };
  }
  return {
    async get(): Promise<AccountActivityResponse> {
      if (pending) return pending;
      if (now() - lastAttempt < interval) return response();
      lastAttempt = now();
      pending = (async () => {
        try {
          const usage = await (options.read || readAccountUsage)();
          const previous = options.store.accountSnapshot();
          const sameAccount = previous?.accountKey === usage.accountKey;
          const syncedAt = new Date(now()).toISOString();
          options.store.saveAccountSnapshot({
            accountKey: usage.accountKey, summary: usage.summary, syncedAt,
            days: usage.days ?? (sameAccount ? previous!.days : []),
            dailyAvailable: usage.days !== null,
            daysUpdatedAt: usage.days !== null ? syncedAt : sameAccount ? previous!.daysUpdatedAt : null,
          });
          error = null;
        } catch (reason) {
          error = reason instanceof UsageError ? reason.message : '사용량 동기화에 실패했습니다. 마지막 기록을 유지합니다.';
          console.warn('[token-activity] account synchronization failed');
        }
        return response();
      })();
      try { return await pending; } finally { lastAttempt = now(); pending = null; }
    },
  };
}
let sync: ReturnType<typeof createTokenSync> | undefined;
export function accountTokenActivity() {
  const intervalMs = Math.max(15, Math.min(3600, Number(process.env.TOKEN_SYNC_INTERVAL_SECONDS) || 60)) * 1000;
  sync ??= createTokenSync({ store: tokenStore(), intervalMs });
  return sync.get();
}
