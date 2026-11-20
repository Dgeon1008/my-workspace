import {puzzle} from './puzzle.js';
export const storageKey = (current = puzzle) => `kkomantle-puzzle-${current.id}-v2`;
export const STORAGE_KEY = storageKey();
export const emptyState = (current = puzzle) => ({puzzleId: current.id, guesses: [], outcome: null, dark: false, sortScore: true});
export function restoreState(raw, words, current = puzzle) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.puzzleId !== current.id) return emptyState(current);
    const seen = new Set();
    const guesses = [];
    for (const entry of Array.isArray(parsed.guesses) ? parsed.guesses : []) {
      if (!entry || typeof entry.word !== 'string' || seen.has(entry.word)) continue;
      let known = evaluateGuess(entry.word, [], words, current);
      if (known.error) continue;
      if (known.needsLookup) {
        if (entry.source !== 'service' || !Number.isFinite(entry.score) || entry.score < -100 || entry.score > 100 ||
            !(entry.rank === null || Number.isInteger(entry.rank) && entry.rank > 0 && entry.rank <= 1000)) continue;
        known = {word: known.word, score: entry.score, rank: entry.rank, source: 'service'};
      }
      seen.add(entry.word);
      guesses.push({...known, number: guesses.length + 1});
    }
    return {...emptyState(current), guesses, outcome: guesses.some(g => g.rank === 0) ? 'won' : parsed.outcome === 'gave-up' ? 'gave-up' : null, dark: parsed.dark === true, sortScore: parsed.sortScore !== false};
  } catch { return emptyState(current); }
}
export function evaluateGuess(input, guesses, words, current = puzzle) {
  const word = input.trim().normalize('NFC');
  if (!word || word.length > 100 || !/^[가-힣a-zA-Zㅏ-ㅣㄱ-ㅎ]+$/.test(word)) return {error:'공백 없이 한 단어를 입력해주세요.'};
  if (guesses.some(g => g.word === word)) return {error:'이미 추측한 단어입니다.'};
  const entry = current.words.find(g => g.word === word);
  if (!entry) return {word, needsLookup: true};
  return {...entry};
}
export function orderedGuesses(guesses, sortScore = true) {
  const latest = guesses.at(-1);
  if (!latest) return [];
  const rest = guesses.slice(0, -1).sort(sortScore ? (a,b) => b.score - a.score || b.number - a.number : (a,b) => b.number - a.number);
  return [latest, ...rest];
}
