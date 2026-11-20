export const SIZE = 15;
export const STORAGE_KEY = 'moa.gomoku.v1';
const directions = [[1,0],[0,1],[1,1],[1,-1]];

export function createGame(mode = 'ai', human = 1) {
  if (!['ai','local'].includes(mode) || ![1,2].includes(human)) throw new Error('게임 설정을 확인해주세요.');
  return { version:1, mode, human, moves:[], board:Array(SIZE*SIZE).fill(0), turn:1, winner:0, winningLine:[], draw:false };
}

export function winningLine(board, index, player) {
  const row = Math.floor(index/SIZE), col = index%SIZE;
  for (const [dr,dc] of directions) {
    const line = [index];
    for (const sign of [-1,1]) {
      let r=row+dr*sign,c=col+dc*sign;
      while (r>=0&&r<SIZE&&c>=0&&c<SIZE&&board[r*SIZE+c]===player) {
        if (sign===-1) line.unshift(r*SIZE+c); else line.push(r*SIZE+c);
        r+=dr*sign;c+=dc*sign;
      }
    }
    if (line.length>=5) return line;
  }
  return [];
}

export function playMove(state, index) {
  if (state.winner || state.draw) throw new Error('끝난 게임입니다. 새 게임을 시작해주세요.');
  if (!Number.isInteger(index)||index<0||index>=SIZE*SIZE) throw new Error('바둑판 안을 선택해주세요.');
  if (state.board[index]) throw new Error('이미 돌이 놓인 자리입니다.');
  const board = [...state.board]; board[index]=state.turn;
  const moves = [...state.moves,index];
  const line = winningLine(board,index,state.turn);
  return { ...state, board, moves, turn:3-state.turn, winner:line.length?state.turn:0, winningLine:line, draw:!line.length&&moves.length===SIZE*SIZE };
}

export function restoreGame(raw) {
  try {
    const saved = JSON.parse(raw);
    if (saved?.version!==1||!['ai','local'].includes(saved.mode)||![1,2].includes(saved.human)||!Array.isArray(saved.moves)||saved.moves.length>SIZE*SIZE) return null;
    let state=createGame(saved.mode,saved.human);
    for (const index of saved.moves) state=playMove(state,index);
    return state;
  } catch { return null; }
}

export function serializeGame(state) {
  return JSON.stringify({version:1,mode:state.mode,human:state.human,moves:state.moves});
}

export function undoMove(state) {
  let count=state.moves.length-1;
  if (state.mode==='ai') {
    while (count>=0 && (count%2===0?1:2)!==state.human) count--;
  }
  if (count<0) return state;
  let restored=createGame(state.mode,state.human);
  for (const index of state.moves.slice(0,count)) restored=playMove(restored,index);
  return restored;
}

function threat(board,index,player) {
  const row=Math.floor(index/SIZE),col=index%SIZE;
  let total=0;
  for(const [dr,dc] of directions) {
    let count=1,open=0;
    for(const sign of [-1,1]) {
      let r=row+dr*sign,c=col+dc*sign;
      while(r>=0&&r<SIZE&&c>=0&&c<SIZE&&board[r*SIZE+c]===player) {count++;r+=dr*sign;c+=dc*sign;}
      if(r>=0&&r<SIZE&&c>=0&&c<SIZE&&!board[r*SIZE+c]) open++;
    }
    if(count>=5) total+=1000000;
    else if(open) total+=([0,2,15,180,8000][count]||0)*(open===2?4:1);
  }
  return total;
}

export function chooseComputerMove(state) {
  if(state.winner||state.draw) return null;
  if(!state.moves.length) return Math.floor(SIZE*SIZE/2);
  const candidates=[];
  for(let index=0;index<SIZE*SIZE;index++) {
    if(state.board[index]) continue;
    const row=Math.floor(index/SIZE),col=index%SIZE;
    if(state.moves.some(move=>Math.abs(Math.floor(move/SIZE)-row)<=2&&Math.abs(move%SIZE-col)<=2)) candidates.push(index);
  }
  const ordered=candidates.sort((a,b)=>Math.abs(Math.floor(a/SIZE)-7)+Math.abs(a%SIZE-7)-Math.abs(Math.floor(b/SIZE)-7)-Math.abs(b%SIZE-7)||a-b);
  for(const player of [state.turn,3-state.turn]) {
    for(const index of ordered) {
      const board=[...state.board];board[index]=player;
      if(winningLine(board,index,player).length) return index;
    }
  }
  let best=ordered[0]??state.board.findIndex(cell=>!cell),score=-Infinity;
  for(const index of ordered) {
    const next=threat(state.board,index,state.turn)*1.05+threat(state.board,index,3-state.turn);
    if(next>score) {score=next;best=index;}
  }
  return best>=0?best:null;
}
