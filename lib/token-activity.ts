export type TokenDay = { date: string; tokens: number; messages: number };
export type TokenSummary = { days: TokenDay[]; importedAt: string | null; totalMessages: number };
export type AccountSnapshot = {
  accountKey: string;
  days: TokenDay[];
  summary: { lifetimeTokens: number | null; peakDailyTokens: number | null };
  syncedAt: string;
  daysUpdatedAt: string | null;
  dailyAvailable: boolean;
};
export type AccountActivityResponse = {
  days: TokenDay[];
  summary: AccountSnapshot['summary'];
  syncedAt: string | null;
  daysUpdatedAt: string | null;
  status: 'ok' | 'stale' | 'unavailable';
  dailyAvailable: boolean;
  message: string | null;
  refreshIntervalMs: number;
};
export type ActivityMode = 'daily' | 'weekly' | 'cumulative';
export type ActivityCell = TokenDay & { value: number; level: number; future: boolean; weekStart: string };

export function seoulDay(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function addDays(day: string, count: number) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

// 53 Sunday-first columns. Date arithmetic uses UTC dates; source timestamps
// are converted to Korean calendar dates before entering this function.
export function activityCalendar(days: TokenDay[], today: string, mode: ActivityMode) {
  const end = new Date(`${today}T00:00:00Z`);
  const start = addDays(today, -end.getUTCDay() - 52 * 7);
  const byDay = new Map(days.map(day => [day.date, day]));
  let cumulative = days.filter(day => day.date < start).reduce((sum, day) => sum + day.tokens, 0);
  const cells: ActivityCell[] = [];
  for (let index = 0; index < 371; index++) {
    const date = addDays(start, index);
    const day = byDay.get(date) || { date, tokens: 0, messages: 0 };
    if (date <= today) cumulative += day.tokens;
    const weekStart = addDays(date, -(index % 7));
    const weekly = Array.from({ length: 7 }, (_, offset) => addDays(weekStart, offset))
      .filter(d => d <= today).reduce((sum, d) => sum + (byDay.get(d)?.tokens || 0), 0);
    cells.push({ ...day, value: mode === 'weekly' ? weekly : mode === 'cumulative' ? cumulative : day.tokens, level: 0, future: date > today, weekStart });
  }
  const maximum = Math.max(1, ...cells.filter(cell => !cell.future).map(cell => cell.value));
  return cells.map(cell => ({ ...cell, level: cell.future || !cell.value ? 0 : Math.min(4, Math.max(1, Math.ceil(cell.value / maximum * 4))) }));
}

export function formatTokens(value: number) {
  if (value >= 10000) return `${(value / 10000).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}만`;
  return value.toLocaleString('ko-KR');
}
