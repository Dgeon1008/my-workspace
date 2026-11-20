import {storageKey, emptyState, restoreState, evaluateGuess, orderedGuesses} from './engine.js';
import {loadDaily, koreanDay, untilMidnight} from './daily.js';
import {lookupGuess} from './scoring.js';
// The same game runs standalone or inside Moa with a scoped document and fetch.
export async function mountGame({document = globalThis.document, location = globalThis.location, fetch = globalThis.fetch, isActive = () => true} = {}) {
const $ = id => document.getElementById(id);
const archive = location.pathname.match(/^\/nearest1k\/(\d+)\/?$/);
let daily;
$('guess-form').querySelector('button').disabled = true;
$('give-up').disabled = true;
try {
  daily = await loadDaily(fetch, archive ? Number(archive[1]) : undefined);
  if (!isActive()) return;
} catch (error) {
  console.error('Daily puzzle load failed', error);
  if (!isActive()) return;
  $('message').textContent = '오늘의 문제를 불러오지 못했습니다. 연결을 확인해주세요. 30초 후 다시 시도합니다.';
  setTimeout(() => {if (isActive()) void mountGame({document, location, fetch, isActive});}, 30000);
  return;
}
let {puzzle, today} = daily;
let words = puzzle.words;
let state = emptyState(puzzle);
let pending = false;
let syncing = false;
let ready = true;
let loadedDay = koreanDay();
try {
  state = restoreState(localStorage.getItem(storageKey(puzzle)), words, puzzle);
  const preferences = JSON.parse(localStorage.getItem('kkomantle-settings'));
  if (preferences) Object.assign(state, {dark:preferences.dark === true, sortScore:preferences.sortScore !== false});
}
catch (error) { console.warn('Local storage unavailable', error); }
function renderDaily() {
  $('puzzle-id').textContent = puzzle.id;
  for (const [id, key] of [['score-first','1st_score'], ['score-tenth','10th_score'], ['score-thousandth','1000th_score']]) $(id).textContent = (today[key] * 100).toFixed(2);
  $('previous-answer').textContent = today.previous.key;
  $('previous-link').href = `/nearest1k/${today.previous.answer_id}`;
}
async function refreshDaily() {
  if (syncing || !isActive()) return false;
  syncing = true;
  try {
    const next = await loadDaily(fetch, undefined, puzzle);
    if (!isActive()) return false;
    today = next.today;
    const changed = next.puzzle.id !== puzzle.id;
    if (changed) {
      save();
      const {dark, sortScore} = state;
      ({puzzle, today} = next);
      words = puzzle.words;
      try {state = restoreState(localStorage.getItem(storageKey(puzzle)), words, puzzle);}
      catch {state = emptyState(puzzle);}
      Object.assign(state, {dark, sortScore});
      save();
      $('guess_input').value = '';
      $('confirm-giveup').close();
      $('message').textContent = '새로운 꼬맨틀이 열렸습니다. 오늘의 단어를 맞혀보세요.';
    } else if (!ready) $('message').textContent = '';
    ready = true;
    loadedDay = koreanDay();
    renderDaily();
    return !changed;
  } catch (error) {
    console.warn('Daily puzzle refresh failed', error);
    ready = false;
    $('message').textContent = '오늘의 문제를 확인하지 못했습니다. 연결되면 자동으로 다시 불러옵니다.';
    return false;
  } finally {syncing = false; if (isActive()) render();}
}
async function ensureToday() {
  if (syncing) return false;
  if (!ready || koreanDay() !== loadedDay) return refreshDaily();
  return true;
}
function save() {
  try {
    localStorage.setItem(storageKey(puzzle), JSON.stringify(state));
    localStorage.setItem('kkomantle-settings', JSON.stringify({dark:state.dark, sortScore:state.sortScore}));
  }
  catch (error) {
    console.warn('Could not save progress', error);
    $('storage-note').textContent = '브라우저 저장 공간을 사용할 수 없어 새로고침하면 기록이 사라질 수 있습니다.';
  }
}
function render() {
  $('guess_input').disabled = !ready || syncing || pending;
  $('guess-form').querySelector('button').disabled = !ready || syncing || pending;
  document.documentElement.classList.toggle('dark', state.dark);
  $('dark-mode').checked = state.dark;
  $('sort-score').checked = state.sortScore;
  $('results').hidden = state.guesses.length === 0;
  const guesses = orderedGuesses(state.guesses, state.sortScore);
  $('guess-rows').replaceChildren(...guesses.map(guess => {
    const row = document.createElement('tr');
    if (guess === state.guesses.at(-1)) row.classList.add('latest-guess');
    for (const value of [guess.number, guess.word, guess.score.toFixed(2), guess.rank === 0 ? '정답!' : guess.rank === null ? '1000위 이상' : guess.rank]) {
      const cell = document.createElement('td'); cell.textContent = value; row.append(cell);
    }
    const barCell = document.createElement('td');
    const bar = document.createElement('div'); bar.className = 'rank-bar';
    bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label', guess.rank === 0 ? '정답!' : guess.rank === null ? '1000위 이상' : '유사도 순위 ' + guess.rank);
    const fill = document.createElement('span');
    fill.style.width = guess.rank === null ? '0%' : ((1000 - guess.rank) / 1000 * 100) + '%';
    bar.append(fill); barCell.append(bar); row.append(barCell);
    return row;
  }));
  $('finished').hidden = !state.outcome;
  $('give-up').disabled = !!state.outcome || pending || !ready || syncing;
  $('reset').disabled = pending || !ready || syncing;
  $('confirm-end').disabled = pending || !ready || syncing;
  if (state.outcome) {
    $('finished').replaceChildren();
    const title = document.createElement('p');
    title.textContent = (state.outcome === 'won' ? '정답입니다! ' : '') + `${puzzle.id}회 정답은 ‘${puzzle.answer}’입니다. 계속 단어를 추측하며 유사도를 확인할 수 있습니다.`;
    const link = document.createElement('a'); link.href = `/nearest1k/${puzzle.id}`; link.textContent = '상위 1,000개 단어 보기';
    $('finished').append(title, link);
  }
}
function showNearest() {
  const isToday = puzzle.id === today.answer_id;
  document.title = '꼬맨틀 — 유사한 단어 목록';
  document.body.replaceChildren();
  document.body.classList.add('nearest-page');
  const content = document.createElement('section');
  function showTable() {
    content.replaceChildren();
    const description = document.createElement('p');
    description.append(`꼬맨틀 #${puzzle.id}의 정답은 `);
    const bold = document.createElement('b'); bold.textContent = puzzle.answer; description.append(bold, '입니다.');
    description.append(' 가장 유사한 단어는 다음과 같습니다:');
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>유사도 순위</th><th>단어</th><th>유사도</th></tr></thead>';
    const body = document.createElement('tbody');
    const list = puzzle.words.filter(w => w.rank > 0).sort((a,b) => a.rank - b.rank);
    for (const word of list) {
      const row = document.createElement('tr');
      for (const value of [word.rank, word.word, word.score.toFixed(2)]) {
        const cell = document.createElement('td');cell.textContent = value;row.append(cell);
      }
      body.append(row);
    }
    table.append(body);content.classList.add('word-list');content.append(description, table);
  }
  if (isToday || puzzle.id === today.previous.answer_id) {
    const warning = document.createElement('button');warning.className = 'spoiler';
    warning.innerHTML = `<p><b>조심하세요!</b> 이 경고문을 클릭하면 <b>${isToday ? '오늘의 정답' : '어제의 정답'}</b>이 표시됩니다.</p>`;
    warning.addEventListener('click', showTable);
    content.append(warning);
  } else showTable();
  const home = document.createElement('a');home.href = '/';home.textContent = '메인 페이지로 돌아가기';
  document.body.append(content, home);
}
if (archive) {
  showNearest();
} else {
  renderDaily();
  render();
  // Timers resume safely after sleep; every action also checks the Korean date.
  function scheduleRefresh() {
    const timer = setTimeout(async () => {
      if (!isActive()) return;
      await refreshDaily();
      scheduleRefresh();
    }, Math.min(30000, untilMidnight() + 50));
    timer.unref?.();
  }
  scheduleRefresh();
  document.addEventListener('visibilitychange', () => {if (!document.hidden && isActive()) void refreshDaily();});
  document.defaultView?.addEventListener('focus', () => {if (isActive()) void refreshDaily();});
  $('guess-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (event.isComposing || pending || !await ensureToday()) return;
    const submittedPuzzle = puzzle.id;
    let guess = evaluateGuess($('guess_input').value, state.guesses, words, puzzle);
    if (guess.error) { $('message').textContent = guess.error;return; }
    if (guess.needsLookup) {
      pending = true;
      const controls = [$('guess_input'), $('guess-form').querySelector('button'), $('reset'), $('give-up')];
      controls.forEach(control => control.disabled = true);
      $('message').textContent = '유사도를 조회하고 있습니다…';
      try {
        guess = await lookupGuess(guess.word, fetch, puzzle);
        if (!guess.error) guess.source = 'service';
      } finally {
        pending = false;
        controls.forEach(control => control.disabled = false);
        if (isActive()) render();
      }
      if (!isActive()) return;
      if (guess.error) { $('message').textContent = guess.error; $('guess_input').focus(); return; }
    }
    if (!await ensureToday() || submittedPuzzle !== puzzle.id) return;
    state.guesses.push({...guess, number:state.guesses.length + 1});
    if (guess.rank === 0) state.outcome = 'won';
    $('guess_input').value = '';
    $('message').textContent = '';
    save();render();$('guess_input').focus();
  });
  $('settings-open').onclick = () => $('settings').showModal();
  $('settings-close').onclick = () => $('settings').close();
  for (const [id, key] of [['dark-mode','dark'],['sort-score','sortScore']]) {
    $(id).onchange = () => {state[key] = $(id).checked;save();render();};
  }
  $('give-up').onclick = async () => {if (await ensureToday()) $('confirm-giveup').showModal();};
  $('cancel-giveup').onclick = () => $('confirm-giveup').close();
  $('confirm-end').onclick = async () => {if (!await ensureToday()) return; state.outcome = 'gave-up';save();render();$('confirm-giveup').close();};
  $('reset').onclick = async () => {
    if (!await ensureToday()) return;
    if (!window.confirm('저장된 추측 기록을 초기화하시겠습니까?')) return;
    state = {...emptyState(puzzle),dark:state.dark,sortScore:state.sortScore};save();render();$('message').textContent = '추측 기록을 초기화했습니다.';
  };
}
}

// Preserve Craft Anything's standalone preview entry point.
if (typeof document !== 'undefined' && document.querySelector('script[type="module"][src="/game.js"]')) {
  void mountGame();
}
