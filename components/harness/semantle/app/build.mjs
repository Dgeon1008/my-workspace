import { mkdir, copyFile, cp, access, writeFile, rm } from 'node:fs/promises';
import {parseToday, parsePuzzle, koreanDay} from './daily.js';
const files = ['index.html', 'style.css', 'game.js', 'engine.js', 'puzzle.js', 'scoring.js', 'daily.js', 'words.json'];
await mkdir('dist', { recursive: true });
for (const file of files) {
  await access(file);
  await copyFile(file, `dist/${file}`);
}
await cp('assets', 'dist/assets', { recursive: true });
// The Craft checker serves static files. This snapshot expires at Korean midnight;
// normal operation continues through the live server/API, never a stale snapshot.
try {
  const day = koreanDay();
  const base = process.env.SIMILARITY_SERVICE_URL || 'https://semantle-ko.newsjel.ly';
  const read = async route => {
    const response = await fetch(new URL(route, base), {cache:'no-store', signal:AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error(`Preview data HTTP ${response.status}`);
    return response.json();
  };
  const today = parseToday(await read('/today'));
  const ids = [...new Set([today.answer_id, today.previous.answer_id, 1692, 1693])];
  const entries = await Promise.all(ids.map(async id => {
    const data = await read(`/top_scores/${id}`);
    parsePuzzle(data, id);
    return [id, data];
  }));
  if (day !== koreanDay()) throw new Error('Midnight crossed during snapshot');
  await writeFile('dist/daily-snapshot.json', JSON.stringify({day,today,puzzles:Object.fromEntries(entries)}));
} catch (error) {
  await rm('dist/daily-snapshot.json', {force:true});
  console.warn('Static preview snapshot unavailable; use npm start for live data:', error.message);
}
console.log('Build complete: dist/');
