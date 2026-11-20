import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SIZE,createGame,playMove,restoreGame,serializeGame,undoMove,chooseComputerMove,winningLine} from '../components/harness/gomoku/app/engine.mjs';
import {createAppServer} from '../components/harness/gomoku/app/server.mjs';
import {once} from 'node:events';

test('five or more connected stones win horizontally, vertically and on either diagonal',()=>{
  for(const [start,delta] of [[105,1],[7,15],[0,16],[14,14]]) {
    const board=Array(225).fill(0);
    for(let i=0;i<5;i++) board[start+i*delta]=1;
    assert.equal(winningLine(board,start+2*delta,1).length,5);
  }
  const board=Array(225).fill(0);
  for(let i=0;i<6;i++) board[105+i]=2;
  assert.equal(winningLine(board,107,2).length,6);
  const boundary=Array(225).fill(0);for(const index of [13,14,15,16,17]) boundary[index]=1;
  assert.equal(winningLine(boundary,15,1).length,0);
});

test('moves alternate, preserve the previous board, reject illegal plays and stop after a win',()=>{
  let state=createGame('local');
  const initial=state;
  state=playMove(state,0);
  assert.equal(initial.board[0],0);assert.equal(state.board[0],1);assert.equal(state.turn,2);
  assert.throws(()=>playMove(state,0));
  for(const index of [-1,225,1.5,'1']) assert.throws(()=>playMove(state,index));
  for(const index of [15,1,16,2,17,3,18,4]) state=playMove(state,index);
  assert.equal(state.winner,1);assert.equal(state.winningLine.length,5);
  assert.throws(()=>playMove(state,20));
});

test('AI takes an immediate win, blocks an immediate loss and never overwrites a stone',()=>{
  assert.equal(chooseComputerMove(createGame()),112);
  let block=createGame('ai');
  for(const move of [105,0,106,2,107,4,108]) block=playMove(block,move);
  assert.ok([104,109].includes(chooseComputerMove(block)));
  let win=createGame('ai');
  for(const move of [0,105,2,106,4,107,6,108,30]) win=playMove(win,move);
  const choice=chooseComputerMove(win);
  assert.ok([104,109].includes(choice));
  assert.equal(playMove(win,choice).winner,2);
  assert.equal(win.board[choice],0);
});

test('undo removes a full human/computer turn, including an unanswered human move',()=>{
  let state=createGame();for(const move of [112,113,97,98]) state=playMove(state,move);
  assert.deepEqual(undoMove(state).moves,[112,113]);
  assert.deepEqual(undoMove(playMove(undoMove(state),97)).moves,[112,113]);
  let white=createGame('ai',2);for(const move of [112,113,97]) white=playMove(white,move);
  assert.deepEqual(undoMove(white).moves,[112]);
  assert.equal(undoMove(playMove(createGame('ai',2),112)).moves.length,1);
  assert.deepEqual(undoMove(playMove(playMove(createGame('local'),0),1)).moves,[0]);
});

test('saved games are replayed and untrusted boards, settings and duplicate moves are rejected',()=>{
  let state=createGame('local');for(const move of [112,113,97]) state=playMove(state,move);
  assert.deepEqual(restoreGame(serializeGame(state)),state);
  const raw=JSON.parse(serializeGame(state));raw.winner=2;raw.board=Array(225).fill(2);
  assert.deepEqual(restoreGame(JSON.stringify(raw)),state);
  for(const invalid of [null,{}, {version:1,moves:[]}, {...raw,moves:[1,1]}, {...raw,moves:[999]}, {...raw,human:5}]) assert.equal(restoreGame(JSON.stringify(invalid)),null);
});

test('the full board can end in a draw without treating edge wrapping as five',()=>{
  const black=[],white=[];
  for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) ((r+2*c)%4<2?black:white).push(r*SIZE+c);
  assert.equal(black.length,113);assert.equal(white.length,112);
  let state=createGame('local');
  for(let i=0;i<113;i++) {state=playMove(state,black[i]);if(i<112)state=playMove(state,white[i]);}
  assert.equal(state.draw,true);assert.equal(state.winner,0);
  assert.equal(chooseComputerMove(state),null);
});

test('the project serves its source and blocks server/config files and writes',async t=>{
  const server=createAppServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(base+'/engine.mjs')).status,200);
  assert.equal((await fetch(base+'/server.mjs')).status,404);
  assert.equal((await fetch(base+'/package.json')).status,404);
  assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
});
