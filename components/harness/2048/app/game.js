import { BEST_KEY, SIZE, STORAGE_KEY, canMove, createGame, moveGame, restoreGame, serializeGame } from './engine.mjs';

const $ = id => document.getElementById(id);
let game = createGame();
let previous = null;
let best = 0;
let noticeTimer;
let startPointer = null;
let saved = '';
const tiles = [];

try {
  best = readBest();
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const data = JSON.parse(raw);
    const restored = restoreGame(JSON.stringify(data?.game));
    const undo = data?.undo ? restoreGame(JSON.stringify(data.undo)) : null;
    if (restored) { game = restored; previous = undo; }
    else $('notice').textContent = '저장된 판을 확인할 수 없어 새 게임으로 시작합니다.';
  }
} catch { $('notice').textContent = '저장 공간에 접근하지 못했습니다. 브라우저 설정을 확인해주세요.'; }

function readBest() {
  const value = Number(localStorage.getItem(BEST_KEY));
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

for (let index = 0; index < SIZE * SIZE; index++) {
  const tile = document.createElement('div');
  tile.className = 'tile';
  tile.setAttribute('role', 'gridcell');
  tile.dataset.index = index;
  tiles.push(tile);
  $('board').append(tile);
}

function persist() {
  const raw = JSON.stringify({ game: JSON.parse(serializeGame(game)), undo: previous ? JSON.parse(serializeGame(previous)) : null });
  if (raw !== saved) {
    try { localStorage.setItem(STORAGE_KEY, raw); saved = raw; }
    catch { showNotice('게임을 저장하지 못했습니다. 새로고침하면 진행 상황이 사라질 수 있어요.'); }
  }
  if (game.score > best) {
    best = game.score;
    try { localStorage.setItem(BEST_KEY, String(best)); }
    catch { showNotice('최고 점수를 저장하지 못했습니다.'); }
  }
}

function showNotice(message) {
  $('notice').textContent = message;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { $('notice').textContent = ''; }, 3600);
}

function render() {
  $('score').textContent = game.score.toLocaleString('ko-KR');
  $('best').textContent = best.toLocaleString('ko-KR');
  $('undo').disabled = !previous;
  $('status').textContent = game.won && !game.keepPlaying ? '멋져요! 2048을 만들었습니다.' : !canMove(game) ? '더 움직일 수 없어요.' : '타일을 합쳐 2048을 만들어보세요.';
  $('result').hidden = !(game.won && !game.keepPlaying) && canMove(game);
  $('result-title').textContent = game.won && !game.keepPlaying ? '2048 달성!' : '게임 종료';
  $('result-copy').textContent = game.won && !game.keepPlaying ? '계속 큰 숫자에 도전하거나 새 게임을 시작하세요.' : `이번 점수는 ${game.score.toLocaleString('ko-KR')}점이에요.`;
  $('continue').hidden = !(game.won && !game.keepPlaying);
  $('board').setAttribute('aria-label', `2048 게임판. 현재 점수 ${game.score}점, 최고 점수 ${best}점`);
  for (const [index, tile] of tiles.entries()) {
    const value = game.board[index];
    tile.textContent = value || '';
    tile.dataset.value = value;
    tile.setAttribute('aria-label', value ? `${value}` : '빈칸');
  }
}

function commit(next) {
  if (next === game) return;
  previous = game;
  game = next;
  persist();
  render();
}

function move(direction) {
  if (game.won && !game.keepPlaying) return;
  commit(moveGame(game, direction));
}

function newGame() {
  if (game.score || game.board.some(Boolean)) $('new-dialog').showModal();
  else { game = createGame(); previous = null; persist(); render(); }
}

function undo() {
  if (!previous) return;
  game = previous;
  previous = null;
  persist();
  render();
}

window.addEventListener('keydown', event => {
  if ($('new-dialog').open) return;
  if (event.ctrlKey || event.metaKey) {
    if (event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); }
    return;
  }
  const target = event.target;
  if (target instanceof HTMLElement && target.closest('a,input,select,textarea,[contenteditable="true"]')) return;
  const directions = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };
  const direction = directions[event.key];
  if (direction) { event.preventDefault(); move(direction); }
});

$('board').addEventListener('pointerdown', event => { startPointer = { x: event.clientX, y: event.clientY }; });
$('board').addEventListener('pointerup', event => {
  if (!startPointer) return;
  const dx = event.clientX - startPointer.x, dy = event.clientY - startPointer.y;
  startPointer = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  move(Math.abs(dx) > Math.abs(dy) ? dx < 0 ? 'left' : 'right' : dy < 0 ? 'up' : 'down');
});
$('board').addEventListener('pointercancel', () => { startPointer = null; });
$('undo').addEventListener('click', undo);
$('new-game').addEventListener('click', newGame);
$('continue').addEventListener('click', () => { game = { ...game, keepPlaying: true }; persist(); render(); });
$('result-new-game').addEventListener('click', newGame);
$('cancel-new').addEventListener('click', () => $('new-dialog').close());
$('confirm-new').addEventListener('click', () => { game = createGame(); previous = null; persist(); render(); $('new-dialog').close(); });

persist();
render();
