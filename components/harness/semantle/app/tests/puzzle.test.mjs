import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateGuess, restoreState, orderedGuesses, emptyState} from '../engine.js';
test('reference scores include words outside top 1000', () => {
  assert.deepEqual(evaluateGuess(' 아침 ', []), {word:'아침',score:31.09,rank:518});
  assert.deepEqual(evaluateGuess('점심', []), {word:'점심',score:25.25,rank:null});
  assert.deepEqual(evaluateGuess('저녁', []), {word:'저녁',score:24.76,rank:null});
  assert.deepEqual(evaluateGuess('건조', []), {word:'건조',score:100,rank:0});
  assert.deepEqual(evaluateGuess('세척', []), {word:'세척',score:49.36,rank:1});
  assert.deepEqual(evaluateGuess('사과', []), {word:'사과',score:24.63,rank:null});
});
test('latest guess stays above score-sorted history', () => {
  const guesses = ['아침','점심','저녁'].map((w,i) => ({...evaluateGuess(w,[]),number:i+1}));
  assert.deepEqual(orderedGuesses(guesses).map(g=>g.number), [3,1,2]);
  assert.deepEqual(orderedGuesses(guesses,false).map(g=>g.number), [3,2,1]);
});
test('reject invalid input and request real scores for uncached words', () => {
  for (const w of ['', '<img>', '두 단어', '가'.repeat(101)]) assert.ok(evaluateGuess(w,[]).error);
  assert.deepEqual(evaluateGuess('가수',[]), {word:'가수',needsLookup:true});
  assert.ok(evaluateGuess('아침',[{word:'아침'}]).error);
});

test('restore live scores and winning state without mixing puzzle data', () => {
  const restored = restoreState(JSON.stringify({...emptyState(),guesses:[
    {word:'가수',score:12.34,rank:null,source:'service'},
    {word:'건조',score:50,rank:99},
    {word:'없는단어예제',score:NaN,rank:null,source:'service'},
  ]}));
  assert.equal(restored.guesses.length,2);
  assert.equal(restored.guesses[0].score,12.34);
  assert.equal(restored.guesses[1].score,100);
  assert.equal(restored.outcome,'won');
  assert.ok(evaluateGuess('바나나',restored.guesses).needsLookup || evaluateGuess('바나나',restored.guesses).score !== undefined);
});
test('restore only this puzzle and recompute scores', () => {
  assert.equal(restoreState('{bad').guesses.length,0);
  assert.equal(restoreState(JSON.stringify({puzzleId:1692,guesses:[{word:'아침'}]})).guesses.length,0);
  const restored=restoreState(JSON.stringify({...emptyState(), guesses:[{word:'아침',score:999},{word:'아침'},null,{word:'가수'}]}));
  assert.equal(restored.guesses.length,1);
  assert.equal(restored.guesses[0].score,31.09);
});
