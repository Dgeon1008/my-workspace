'use server';

// The embedded Next app uses a server action so no host API route is required.
export async function requestPuzzle(route) {
  if (typeof route !== 'string' || !(/^\/api\/today$/.test(route) || /^\/api\/puzzle\/[1-9]\d{0,5}$/.test(route) || /^\/api\/guess\/[1-9]\d{0,5}\/[가-힣a-zA-Zㅏ-ㅣㄱ-ㅎ%0-9]+$/.test(route))) {
    return {status:400, body:{error:'Invalid puzzle request'}};
  }
  try {
    const {parseToday, parsePuzzle} = await import('./daily.js');
    const {parseServiceGuess} = await import('./scoring.js');
    const base = new URL(process.env.SIMILARITY_SERVICE_URL || 'https://semantle-ko.newsjel.ly');
    if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password) throw new Error('Invalid service URL');
    const read = async path => {
      const response = await fetch(new URL(path, base), {cache:'no-store', redirect:'error', signal:AbortSignal.timeout(8000)});
      const body = await response.json();
      return {status:response.status, body};
    };
    const daily = await read('/today');
    if (daily.status !== 200) throw new Error('Daily service unavailable');
    const today = parseToday(daily.body);
    if (route === '/api/today') return daily;
    const [, , kind, number, encoded] = route.split('/');
    const id = Number(number);
    if (id > today.answer_id) return {status:400, body:{error:'Invalid puzzle'}};
    const snapshot = await read(`/top_scores/${id}`);
    if (snapshot.status !== 200) throw new Error('Puzzle service unavailable');
    const puzzle = parsePuzzle(snapshot.body, id);
    if (kind === 'puzzle') return snapshot;
    const word = decodeURIComponent(encoded).normalize('NFC');
    if (!word || word.length > 100 || !/^[가-힣a-zA-Zㅏ-ㅣㄱ-ㅎ]+$/.test(word)) return {status:400,body:{error:'Invalid word'}};
    const result = await read(`/guess/${id}/${encodeURIComponent(word)}`);
    if (result.status === 404 && (result.body.error === 'unknown' || result.body.detail?.type === 'InvalidGuess')) return {status:404,body:{error:'unknown'}};
    if (result.status !== 200) throw new Error('Scoring service unavailable');
    parseServiceGuess(result.body, word, puzzle);
    return result;
  } catch (error) {
    console.warn('Embedded daily puzzle request failed', error.message);
    return {status:502,body:{error:'Daily puzzle unavailable'}};
  }
}
