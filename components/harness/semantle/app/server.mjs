import http from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {puzzle} from './puzzle.js';
import {parseServiceGuess} from './scoring.js';
import {parseToday, parsePuzzle, koreanDay} from './daily.js';
const root = realpathSync.native(import.meta.dirname);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp','.woff2':'font/woff2'};
const portIndex = process.argv.indexOf('--port');
const port = Number(process.env.PORT || (portIndex >= 0 ? process.argv[portIndex + 1] : 5173));
export function createAppServer({fetchImpl = fetch, serviceUrl = process.env.SIMILARITY_SERVICE_URL || puzzle.source} = {}) {
const snapshots = new Map();
async function serviceJSON(route) {
  const response = await fetchImpl(new URL(route, serviceUrl), {signal: AbortSignal.timeout(8000), cache: 'no-store', redirect: 'error'});
  if (!response.ok) throw new Error(`Puzzle service HTTP ${response.status}`);
  return response.json();
}
async function snapshot(id) {
  if (snapshots.has(id)) return snapshots.get(id);
  const data = await serviceJSON(`/top_scores/${id}`);
  const current = parsePuzzle(data, id);
  if (snapshots.size >= 8) snapshots.delete(snapshots.keys().next().value);
  snapshots.set(id, {data, current});
  return snapshots.get(id);
}
let dailyCache;
async function today() {
  const now = Date.now();
  if (!dailyCache || now - dailyCache.at > 30000 || dailyCache.day !== koreanDay(now)) {
    dailyCache = {data: parseToday(await serviceJSON('/today')), at: now, day: koreanDay(now)};
  }
  return dailyCache.data;
}
return http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      if (pathname === '/api/today' || /^\/api\/puzzle\/\d+$/.test(pathname)) {
        if (req.method !== 'GET') {res.writeHead(405).end(); return;}
        try {
          const daily = await today();
          if (pathname === '/api/today') {res.end(JSON.stringify(daily)); return;}
          const id = Number(pathname.split('/').at(-1));
          if (!Number.isSafeInteger(id) || id < 1 || id > daily.answer_id) {res.writeHead(400).end(); return;}
          res.end(JSON.stringify((await snapshot(id)).data));
        } catch (error) {
          console.error('Daily puzzle service failed', error.message);
          res.writeHead(502).end(JSON.stringify({error:'Daily puzzle unavailable'}));
        }
        return;
      }
      const match = pathname.match(/^\/api\/guess\/(\d+)\/([^/]+)$/);
      if (req.method !== 'GET') {res.writeHead(405).end(JSON.stringify({error:'Method not allowed'})); return;}
      if (!match || (!Number.isSafeInteger(Number(match[1])) || Number(match[1]) < 1) || match[2].length > 100 || !/^[가-힣a-zA-Zㅏ-ㅣㄱ-ㅎ]+$/.test(match[2])) {
        res.writeHead(400).end(JSON.stringify({error:'Invalid puzzle or word'})); return;
      }
      const word = match[2].normalize('NFC');
      try {
        const id = Number(match[1]);
        if (id > (await today()).answer_id) {res.writeHead(400).end(); return;}
        const {current} = await snapshot(id);
        const response = await fetchImpl(new URL(`/guess/${id}/${encodeURIComponent(word)}`, serviceUrl), {
          signal: AbortSignal.timeout(8000), redirect: 'error',
        });
        const body = await response.json();
        if (response.status === 404 && (body.error === 'unknown' || body.detail?.type === 'InvalidGuess')) {
          res.writeHead(404).end(JSON.stringify({error:'unknown'})); return;
        }
        if (!response.ok) throw new Error(`Scoring service HTTP ${response.status}`);
        parseServiceGuess(body, word, current);
        res.writeHead(200).end(JSON.stringify({guess:body.guess, sim:body.sim, rank:body.rank}));
      } catch (error) {
        console.error('Similarity service failed', error.message);
        res.writeHead(502).end(JSON.stringify({error:'Similarity service unavailable'}));
      }
      return;
    }
    const name = pathname === '/' || /^\/nearest1k\/\d+\/?$/.test(pathname) ? 'index.html' : pathname.slice(1);
    if (name.split('/').some(part => part.startsWith('.') || ['node_modules','tests','dist'].includes(part)) || ['bridge.js','package.json','package-lock.json'].includes(name) || !types[path.extname(name)]) {res.writeHead(404).end();return;}
    const file = await realpath(path.resolve(root, name));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    const data = await readFile(file);
    res.setHeader('Cache-Control', 'no-cache');
    res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'}).end(data);
  } catch { res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'}).end('찾을 수 없는 페이지입니다.'); }
});
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  createAppServer().listen(port, '0.0.0.0', () => console.log(`Ready at http://localhost:${port}`));
}
