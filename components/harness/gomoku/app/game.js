import {SIZE,STORAGE_KEY,createGame,playMove,restoreGame,serializeGame,undoMove,chooseComputerMove} from './engine.mjs';

const $=id=>document.getElementById(id);
let state=createGame(),timer,revision=0,pendingSettings;
let saved='';
try {
  const raw=localStorage.getItem(STORAGE_KEY);
  if(raw) {
    const restored=restoreGame(raw);
    if(restored) state=restored;
    else $('notice').textContent='저장된 판을 읽지 못해 새 판으로 시작합니다.';
  }
} catch {$('notice').textContent='저장 공간에 접근하지 못했습니다. 이 판은 저장되지 않을 수 있습니다.';}

const cells=[];
for(let index=0;index<SIZE*SIZE;index++) {
  const button=document.createElement('button');button.type='button';button.className='cell';button.role='gridcell';
  button.dataset.index=index;
  button.tabIndex=index===112?0:-1;
  button.style.gridRow=Math.floor(index/SIZE)+1;button.style.gridColumn=index%SIZE+1;
  button.setAttribute('aria-label',`${Math.floor(index/SIZE)+1}행 ${index%SIZE+1}열 빈 자리`);
  if([48,56,112,168,176].includes(index)) {const star=document.createElement('i');star.className='star';star.setAttribute('aria-hidden','true');button.append(star);}
  const stone=document.createElement('span');stone.className='stone';button.append(stone);
  button.addEventListener('focus',()=>{for(const cell of cells) cell.tabIndex=cell===button?0:-1;});
  button.addEventListener('click',()=>{
    if(state.winner||state.draw||state.board[index]||(state.mode==='ai'&&state.turn!==state.human)) return;
    commit(playMove(state,index));
  });
  button.addEventListener('keydown',event=>{
    const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-SIZE,ArrowDown:SIZE}[event.key];
    if(delta===undefined) return;
    event.preventDefault();
    const next=index+delta;
    if(next>=0&&next<SIZE*SIZE&&(!(Math.abs(delta)===1)||Math.floor(next/SIZE)===Math.floor(index/SIZE))) cells[next].focus();
  });
  cells.push(button);$('board').append(button);
}

function save() {
  const raw=serializeGame(state);
  if(raw===saved) return;
  try {localStorage.setItem(STORAGE_KEY,raw);saved=raw;}
  catch {$('notice').textContent='판을 저장하지 못했습니다. 새로고침하면 최근 수가 사라질 수 있습니다.';}
}
function render() {
  const thinking=state.mode==='ai'&&state.turn!==state.human&&!state.winner&&!state.draw;
  $('status').textContent=state.winner?`${state.winner===1?'흑돌':'백돌'} 승리!`:state.draw?'무승부입니다':thinking?'컴퓨터가 생각하고 있어요…':`${state.turn===1?'흑돌':'백돌'} 차례`;
  $('move-count').textContent=`${state.moves.length}수`;
  $('mode-ai').setAttribute('aria-pressed',state.mode==='ai');$('mode-local').setAttribute('aria-pressed',state.mode==='local');
  $('human-color').value=state.human;$('human-color').disabled=state.mode==='local';
  $('black-label').textContent=state.mode==='local'?'플레이어 1 · 선공':state.human===1?'나 · 선공':'컴퓨터 · 선공';
  $('white-label').textContent=state.mode==='local'?'플레이어 2 · 후공':state.human===2?'나 · 후공':'컴퓨터 · 후공';
  for(const [id,player] of [['black-player',1],['white-player',2]]) $(id).classList.toggle('current',!state.winner&&!state.draw&&state.turn===player);
  const winner=new Set(state.winningLine),last=state.moves.at(-1);
  for(const [index,button] of cells.entries()) {
    const value=state.board[index];
    button.dataset.player=value;button.dataset.last=index===last;button.dataset.win=winner.has(index);
    button.setAttribute('aria-label',`${Math.floor(index/SIZE)+1}행 ${index%SIZE+1}열 ${value===1?'흑돌':value===2?'백돌':'빈 자리'}`);
    button.setAttribute('aria-disabled',Boolean(value||state.winner||state.draw||thinking));
  }
  $('undo').disabled=!state.moves.length||(state.mode==='ai'&&!state.moves.some((_move,index)=>(index%2===0?1:2)===state.human));
  $('turn-caption').textContent=state.winner?'좋은 한 판이었어요. 새 게임으로 다시 도전해보세요.':state.draw?'바둑판이 가득 찼습니다. 새로운 판에서 다시 만나요.':'가로·세로·대각선으로 돌 5개를 이어보세요.';
  $('last-move').textContent=last===undefined?'첫 수를 놓아주세요':`최근 수 · ${Math.floor(last/SIZE)+1}행 ${last%SIZE+1}열`;
  $('history-count').textContent=state.moves.length;
  $('history').replaceChildren(...state.moves.map((index,number)=>{
    const item=document.createElement('li');item.textContent=`${number+1}수 · ${number%2===0?'흑':'백'} ${Math.floor(index/SIZE)+1}행 ${index%SIZE+1}열`;return item;
  }));
}
function scheduleComputer() {
  clearTimeout(timer);
  if(state.mode!=='ai'||state.winner||state.draw||state.turn===state.human) return;
  const expected=revision;
  timer=setTimeout(()=>{
    if(expected!==revision) return;
    const move=chooseComputerMove(state);
    if(move!==null) commit(playMove(state,move));
  },350);
}
function commit(next) {state=next;revision++;save();render();scheduleComputer();}
function requestNew(mode=state.mode,human=state.human) {
  pendingSettings={mode,human};
  if(state.moves.length&&!state.winner&&!state.draw) $('new-dialog').showModal();
  else commit(createGame(mode,human));
}
$('undo').onclick=()=>commit(undoMove(state));
$('new-game').onclick=()=>requestNew();
$('mode-ai').onclick=()=>{if(state.mode!=='ai') requestNew('ai');};
$('mode-local').onclick=()=>{if(state.mode!=='local') requestNew('local');};
$('human-color').onchange=()=>{const color=Number($('human-color').value);$('human-color').value=state.human;if(color!==state.human) requestNew(state.mode,color);};
$('cancel-new').onclick=()=>{$('new-dialog').close();pendingSettings=undefined;};
$('confirm-new').onclick=()=>{if(pendingSettings) {const {mode,human}=pendingSettings;pendingSettings=undefined;commit(createGame(mode,human));}$('new-dialog').close();};
window.addEventListener('pagehide',()=>clearTimeout(timer));
save();render();scheduleComputer();
