export const SIZE = 4;
export const STORAGE_KEY = 'moa.2048.v1';
export const BEST_KEY = 'moa.2048.best.v1';

function spawnTile(board, random) {
  const empty = [];
  for (let index = 0; index < board.length; index++) if (!board[index]) empty.push(index);
  if (!empty.length) return board;
  const location = Math.min(empty.length - 1, Math.floor(Math.max(0, Math.min(0.999999999, random())) * empty.length));
  const value = random() < 0.9 ? 2 : 4;
  const next = [...board];
  next[empty[location]] = value;
  return next;
}

export function createGame(random = Math.random) {
  const board = spawnTile(spawnTile(Array(SIZE * SIZE).fill(0), random), random);
  return { version: 1, board, score: 0, won: false, keepPlaying: false };
}

function indicesFor(direction, line) {
  if (direction === 'left') return Array.from({ length: SIZE }, (_, col) => line * SIZE + col);
  if (direction === 'right') return Array.from({ length: SIZE }, (_, col) => line * SIZE + SIZE - 1 - col);
  if (direction === 'up') return Array.from({ length: SIZE }, (_, row) => row * SIZE + line);
  return Array.from({ length: SIZE }, (_, row) => (SIZE - 1 - row) * SIZE + line);
}

function collapse(values) {
  const packed = values.filter(Boolean);
  const result = [];
  let gained = 0;
  for (let index = 0; index < packed.length; index++) {
    if (packed[index] === packed[index + 1]) {
      const merged = packed[index] * 2;
      result.push(merged);
      gained += merged;
      index++;
    } else result.push(packed[index]);
  }
  while (result.length < SIZE) result.push(0);
  return { values: result, gained };
}

export function moveGame(state, direction, random = Math.random) {
  if (!['left', 'right', 'up', 'down'].includes(direction)) return state;
  if (state.won && !state.keepPlaying) return state;
  const board = [...state.board];
  let gained = 0;
  for (let line = 0; line < SIZE; line++) {
    const indexes = indicesFor(direction, line);
    const collapsed = collapse(indexes.map(index => board[index]));
    gained += collapsed.gained;
    indexes.forEach((index, offset) => { board[index] = collapsed.values[offset]; });
  }
  if (board.every((value, index) => value === state.board[index])) return state;
  const spawned = spawnTile(board, random);
  return {
    version: 1,
    board: spawned,
    score: state.score + gained,
    won: state.won || spawned.some(value => value >= 2048),
    keepPlaying: state.keepPlaying,
  };
}

export function canMove(state) {
  const { board } = state;
  if (board.some(value => value === 0)) return true;
  for (let row = 0; row < SIZE; row++) {
    for (let col = 0; col < SIZE; col++) {
      const index = row * SIZE + col;
      if (col < SIZE - 1 && board[index] === board[index + 1]) return true;
      if (row < SIZE - 1 && board[index] === board[index + SIZE]) return true;
    }
  }
  return false;
}

export function restoreGame(raw) {
  try {
    const saved = JSON.parse(raw);
    if (saved?.version !== 1 || !Array.isArray(saved.board) || saved.board.length !== SIZE * SIZE ||
      !saved.board.every(value => Number.isSafeInteger(value) && value >= 0 && (value === 0 || Number.isInteger(Math.log2(value)))) ||
      !Number.isSafeInteger(saved.score) || saved.score < 0 || typeof saved.won !== 'boolean' ||
      typeof saved.keepPlaying !== 'boolean' || (saved.won !== saved.board.some(value => value >= 2048)) || (saved.keepPlaying && !saved.won)) return null;
    return { version: 1, board: [...saved.board], score: saved.score, won: saved.won, keepPlaying: saved.keepPlaying };
  } catch { return null; }
}

export function serializeGame(state) {
  return JSON.stringify({ version: 1, board: state.board, score: state.score, won: state.won, keepPlaying: state.keepPlaying });
}
