import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createAppServer} from '../server.mjs';
import {puzzle} from '../puzzle.js';
import {parseServiceGuess, lookupGuess} from '../scoring.js';

test('parse real service units, ranks, answer and invalid responses', () => {
  assert.deepEqual(parseServiceGuess({guess:'건조',sim:1,rank:'정답!'},'건조'),{word:'건조',score:100,rank:0});
  assert.deepEqual(parseServiceGuess({guess:'가수',sim:-0.015,rank:'1000위 이상'},'가수'),{word:'가수',score:-1.5,rank:null});
  for (const data of [null, {guess:'다름',sim:0.5,rank:1}, {guess:'가수',sim:'0.5',rank:1},
    {guess:'가수',sim:NaN,rank:null}, {guess:'가수',sim:1.1,rank:1},
    {guess:'가수',sim:1,rank:'정답!'}, {guess:'가수',sim:0.5,rank:1001}]) {
    assert.throws(() => parseServiceGuess(data,'가수'));
  }
});

test('same-origin scoring proxies exact puzzle, distinguishes invalid words from outages', async t => {
  let mode = 'success';
  let calls = 0;
  const server = createAppServer({fetchImpl:async (url, options) => {
    if (url.pathname === '/today') return Response.json({answer_id:1693, '1st_score':.49, '10th_score':.43, '1000th_score':.28, previous:{answer_id:1692,key:'??'}});
    if (url.pathname === '/top_scores/1693') return Response.json({answer_id:1693,key:puzzle.answer,top_scores:puzzle.words.filter(w=>w.rank>0).sort((a,b)=>a.rank-b.rank).map(w=>[w.rank,w.word,w.score/100])});
    calls++;
    assert.equal(url.pathname, '/guess/1693/%EA%B0%80%EC%88%98');
    assert.ok(options.signal);
    if (mode === 'outage') throw new Error('offline');
    if (mode === 'invalid') return Response.json({detail:{type:'InvalidGuess'}},{status:404});
    if (mode === 'missing-day') return Response.json({detail:{type:'MissingAnswer'}},{status:404});
    if (mode === 'malformed') return Response.json({guess:'다름',sim:0.5,rank:1});
    return Response.json({guess:'가수',sim:0.123456,rank:'1000위 이상'});
  }});
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(() => new Promise(resolve => {server.close(resolve);server.closeAllConnections();}));
  const base = `http://127.0.0.1:${server.address().port}`;
  const fetchLocal = (url,options) => fetch(base+url,options);
  assert.deepEqual(await lookupGuess('가수',fetchLocal),{word:'가수',score:12.35,rank:null});
  mode = 'invalid';
  assert.match((await lookupGuess('가수',fetchLocal)).error,/사전에 없는/);
  for (mode of ['outage','malformed','missing-day']) {
    assert.match((await lookupGuess('가수',fetchLocal)).error,/잠시 후/);
  }
  const before = calls;
  for (const route of ['/api/guess/999999/가수','/api/guess/1693/두 단어','/api/guess/1693/<img>']) {
    assert.equal((await fetch(base+route)).status,400);
  }
  assert.equal(calls,before);
  assert.equal((await fetch(base+'/api/guess/1693/가수',{method:'POST'})).status,405);
});
