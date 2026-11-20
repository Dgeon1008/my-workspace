import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {koreanDay, untilMidnight, loadDaily, parsePuzzle} from '../daily.js';
import {emptyState, restoreState, evaluateGuess, storageKey} from '../engine.js';
import {createAppServer} from '../server.mjs';
import {requestPuzzle} from '../bridge.js';

const today = id => ({answer_id:id, '1st_score':.5, '10th_score':.4, '1000th_score':.2, previous:{answer_id:id-1,key:'어제'}});
const data = id => ({answer_id:id,key:id === 1694 ? '의외로' : '새정답',top_scores:Array.from({length:1000},(_,i)=>[i+1,`단어${i}`, .5-i*.0003])});

test('Korean midnight is 15:00 UTC regardless of the device timezone', () => {
  const before = Date.parse('2026-11-19T14:59:59.999Z');
  assert.equal(untilMidnight(before),1);
  assert.equal(koreanDay(before+1),koreanDay(before)+1);
  assert.equal(untilMidnight(before+1),86400000);
});

test('daily load follows the official puzzle and never falls back to yesterday on failure', async () => {
  let id=1694;
  let fail=false;
  const fake = async url => {
    if (fail) return new Response('',{status:502});
    return Response.json(url==='/api/today' ? today(id) : data(Number(url.split('/').at(-1))));
  };
  const first = await loadDaily(fake);
  assert.equal(evaluateGuess('의외로',[],null,first.puzzle).rank,0);
  const saved = JSON.stringify({...emptyState(first.puzzle),guesses:[{word:'의외로'}]});
  assert.equal(restoreState(saved,null,first.puzzle).outcome,'won');
  id++;
  const next = await loadDaily(fake,undefined,first.puzzle);
  assert.equal(next.puzzle.answer,'새정답');
  assert.notEqual(storageKey(first.puzzle),storageKey(next.puzzle));
  assert.equal(restoreState(saved,null,next.puzzle).guesses.length,0);
  assert.equal(evaluateGuess('의외로',[],null,next.puzzle).needsLookup,true);
  fail=true;
  await assert.rejects(loadDaily(fake,undefined,next.puzzle));
  assert.throws(()=>parsePuzzle(data(1694),1695));
});

test('server serves official daily metadata, any past list, and exact new answer scoring', async t => {
  const server=createAppServer({fetchImpl:async url => {
    if(url.pathname==='/today') return Response.json(today(1694));
    if(url.pathname.startsWith('/top_scores/')) return Response.json(data(Number(url.pathname.split('/').at(-1))));
    assert.equal(decodeURIComponent(url.pathname),'/guess/1694/의외로');
    return Response.json({guess:'의외로',sim:1,rank:'정답!'});
  }});
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`;
  const daily=await fetch(base+'/api/today');
  assert.equal(daily.headers.get('cache-control'),'no-store');
  assert.equal((await daily.json()).answer_id,1694);
  assert.equal((await (await fetch(base+'/api/puzzle/1693')).json()).answer_id,1693);
  assert.equal((await fetch(base+'/api/puzzle/1695')).status,400);
  const score=await fetch(base+'/api/guess/1694/'+encodeURIComponent('의외로'));
  assert.equal(score.status,200);
  assert.equal((await score.json()).rank,'정답!');
});

test('embedded app server action follows current puzzle and validates routes', async t => {
  const calls=[];
  t.mock.method(globalThis,'fetch',async url => {
    calls.push(decodeURIComponent(url.pathname));
    if(url.pathname==='/today') return Response.json(today(1694));
    if(url.pathname==='/top_scores/1694') return Response.json(data(1694));
    return Response.json({guess:'의외로',sim:1,rank:'정답!'});
  });
  assert.equal((await requestPuzzle('/api/today')).body.answer_id,1694);
  assert.equal((await requestPuzzle('/api/puzzle/1694')).body.key,'의외로');
  assert.equal((await requestPuzzle('/api/guess/1694/'+encodeURIComponent('의외로'))).body.rank,'정답!');
  assert.ok(calls.includes('/guess/1694/의외로'));
  assert.equal((await requestPuzzle('/api/puzzle/999999')).status,400);
  assert.equal((await requestPuzzle('/api/puzzle/../../secret')).status,400);
});

test('static preview snapshot expires at Korean midnight', async () => {
  const fake = async url => url==='/api/today' ? new Response('',{status:404}) : Response.json({
    day:koreanDay()-1,today:today(1694),puzzles:{1694:data(1694)},
  });
  await assert.rejects(loadDaily(fake));
});
