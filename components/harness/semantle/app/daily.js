export const koreanDay = (now = Date.now()) => Math.floor((now + 9 * 3600000) / 86400000);
export const untilMidnight = (now = Date.now()) => (koreanDay(now) + 1) * 86400000 - 9 * 3600000 - now;

export function parseToday(data) {
  if (!Number.isInteger(data?.answer_id) || data.answer_id < 1 ||
      data.previous?.answer_id !== data.answer_id - 1 || typeof data.previous.key !== 'string' ||
      !['1st_score', '10th_score', '1000th_score'].every(key => Number.isFinite(data[key]) && Math.abs(data[key]) <= 1)) {
    throw new Error('Invalid daily puzzle');
  }
  return data;
}

export function parsePuzzle(data, id) {
  if (data?.answer_id !== id || typeof data.key !== 'string' || !data.key || data.top_scores?.length !== 1000) throw new Error('Invalid puzzle data');
  const seen = new Set([data.key]);
  const words = data.top_scores.map(([rank, word, sim], index) => {
    if (rank !== index + 1 || typeof word !== 'string' || seen.has(word) || !Number.isFinite(sim) || Math.abs(sim) > 1) throw new Error('Invalid puzzle score');
    seen.add(word);
    return {rank, word, score: Number((sim * 100).toFixed(2))};
  });
  return {id, answer: data.key, words: [...words, {word: data.key, score: 100, rank: 0}]};
}

export async function fetchJSON(url, fetchImpl = fetch) {
  const response = await fetchImpl(url, {cache: 'no-store', signal: AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error(`Puzzle HTTP ${response.status}`);
  return response.json();
}

export async function loadDaily(fetchImpl = fetch, requestedId, existing) {
  const day = koreanDay();
  let today;
  let preview;
  try {
    today = parseToday(await fetchJSON('/api/today', fetchImpl));
  } catch (error) {
    // Static previews can use build-time data only on the same Korean day.
    preview = await fetchJSON('/daily-snapshot.json', fetchImpl);
    if (preview.day !== koreanDay()) throw error;
    today = parseToday(preview.today);
  }
  const id = requestedId ?? today.answer_id;
  if (!Number.isInteger(id) || id < 1 || id > today.answer_id) throw new Error('Invalid puzzle number');
  if (day !== koreanDay()) throw new Error('Midnight crossed while loading daily puzzle');
  if (existing?.id === id) return {today, puzzle: existing};
  const puzzle = parsePuzzle(preview ? preview.puzzles[id] : await fetchJSON(`/api/puzzle/${id}`, fetchImpl), id);
  if (day !== koreanDay()) throw new Error('Midnight crossed while loading puzzle scores');
  return {today, puzzle};
}
