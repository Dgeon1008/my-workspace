import {puzzle} from './puzzle.js';

export function parseServiceGuess(data, word, current = puzzle) {
  if (!data || data.guess !== word || typeof data.sim !== 'number' ||
      !Number.isFinite(data.sim) || data.sim < -1 || data.sim > 1) {
    throw new Error('Invalid similarity response');
  }
  const rank = data.rank === '정답!' ? 0 : data.rank === '1000위 이상' ? null : data.rank;
  if (rank !== null && (!Number.isInteger(rank) || rank < 0 || rank > 1000)) {
    throw new Error('Invalid similarity rank');
  }
  if ((rank === 0) !== (word === current.answer) || (rank === 0 && data.sim !== 1)) {
    throw new Error('Mismatched answer');
  }
  return {word, score: Number((data.sim * 100).toFixed(2)), rank};
}

export async function lookupGuess(word, fetchImpl = fetch, current = puzzle) {
  try {
    const response = await fetchImpl(`/api/guess/${current.id}/${encodeURIComponent(word)}`, {
      signal: AbortSignal.timeout(12000), cache: 'no-store',
    });
    if (response.status === 404) return {error: '사전에 없는 단어입니다. 다른 단어를 입력해주세요.'};
    if (!response.ok) throw new Error(`Similarity HTTP ${response.status}`);
    return parseServiceGuess(await response.json(), word, current);
  } catch (error) {
    console.warn('Similarity lookup failed', error);
    return {error: '유사도를 조회하지 못했습니다. 잠시 후 다시 추측해주세요. 입력한 단어와 기록은 유지됩니다.'};
  }
}
