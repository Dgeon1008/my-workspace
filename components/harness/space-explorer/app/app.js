import { createSolarSystem3D } from './solar-system-3d.js';

const canvas = document.querySelector('#cosmos-canvas');
const labelsCanvas = document.querySelector('#labels-canvas');
const ctx = labelsCanvas.getContext('2d');
const stageButtons = [...document.querySelectorAll('.stage-step')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const orbitSpeeds = [1, 5, 20];
const JULIAN_UNIX_EPOCH = 2440587.5;
const MIN_DATE_TIME = '1800-01-01T00:00';
const MAX_DATE_TIME = '2050-12-31T23:00';
const BASE_SIMULATION_DAYS_PER_SECOND = 5;
function julianDayFromLocalDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? NaN : JULIAN_UNIX_EPOCH + date.getTime() / 86400000;
}
function dateFromJulianDay(value) { return new Date((value - JULIAN_UNIX_EPOCH) * 86400000); }
function localDateTimeValue(date) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
const MIN_JULIAN_DAY = julianDayFromLocalDateTime(MIN_DATE_TIME);
const MAX_JULIAN_DAY = julianDayFromLocalDateTime(MAX_DATE_TIME);
let scene = null;

const stages = [
  {
    at: 0, name: '태양계', kicker: 'THE SOLAR SYSTEM', subtitle: '태양을 중심으로 도는 행성과 위성',
    caption: '행성을 선택하면 그 행성과 위성 궤도로 가까이 들어갑니다.', distance: '태양에서 해왕성까지 · 약 30 AU',
    next: '카이퍼 벨트', nextCopy: '해왕성 너머에는 명왕성과 얼음 천체들이 모여 있는 카이퍼 벨트가 이어집니다.',
    factHeading: '태양계 거리의 기준', labelOne: '지구 궤도', valueOne: '1 <i>AU</i>', labelTwo: '해왕성 궤도', valueTwo: '약 30 <i>AU</i>',
    factNote: '행성 궤도 간격은 화면에서 보기 쉽게 압축해 그렸습니다.',
  },
  {
    at: 34, name: '카이퍼 벨트', kicker: 'KUIPER BELT', subtitle: '해왕성 바깥의 얼음 천체 영역',
    caption: '명왕성도 카이퍼 벨트에서 태양을 돌아요.', distance: '태양에서 약 30~50 AU',
    next: '태양권계면', nextCopy: '태양풍이 만든 거품은 행성 궤도보다 훨씬 바깥까지 뻗어 있습니다.',
    factHeading: '카이퍼 벨트', labelOne: '명왕성 평균 거리', valueOne: '약 39.5 <i>AU</i>', labelTwo: '태양빛이 도착하는 데', valueTwo: '약 5.5 <i>시간</i>',
    factNote: '카이퍼 벨트의 천체들은 실제로 한 줄의 고리가 아니라 넓은 띠에 분포합니다.',
  },
  {
    at: 67, name: '태양권계면', kicker: 'HELIOPAUSE', subtitle: '태양풍의 거품과 성간 공간이 만나는 경계',
    caption: '보이저 1호와 2호는 서로 다른 방향에서 이 경계를 통과했어요.', distance: '보이저 통과 지점 · 약 119~122 AU',
    next: '오르트 구름', nextCopy: '태양권계면을 지나도 태양의 중력에 묶인 혜성들이 아주 먼 곳까지 이어집니다.',
    factHeading: '보이저가 건넌 경계', labelOne: '보이저 1호', valueOne: '약 122 <i>AU · 2012</i>', labelTwo: '보이저 2호', valueTwo: '약 119 <i>AU · 2018</i>',
    factNote: '경계는 둥근 껍질처럼 단순화했으며 실제 태양권은 방향에 따라 모양과 거리가 다릅니다.',
  },
  {
    at: 100, name: '오르트 구름', kicker: 'OORT CLOUD', subtitle: '태양계를 둘러싼 먼 혜성의 고향',
    caption: '행성에서 출발한 여정이 태양계의 먼 가장자리에 닿았습니다.', distance: '바깥 범위 추정 · 최대 약 100,000 AU',
    next: '태양계로 돌아가기', nextCopy: '태양과 행성들이 도는 안쪽 태양계로 돌아가 다른 행성을 가까이 살펴보세요.',
    factHeading: '아주 먼 혜성의 영역', labelOne: '안쪽 경계 추정', valueOne: '약 5,000 <i>AU</i>', labelTwo: '바깥 경계 추정', valueTwo: '최대 100,000 <i>AU</i>',
    factNote: '오르트 구름은 직접 관측되지 않았으며 위치와 크기는 추정값입니다.',
  },
];

const planets = [
  { id: 'mercury', name: '수성', au: .39, period: .24, size: 2.5, color: '#aab2b9', phase: .25, kind: '행성 · 암석 행성', diameter: '4,879 km', diameterKm: 4879, year: '88일', summary: '태양에 가장 가까운 작은 암석 행성입니다. 표면에는 오래된 충돌구가 많아요.', moons: [] },
  { id: 'venus', name: '금성', au: .72, period: .62, size: 3.3, color: '#e7c58b', phase: 2.55, kind: '행성 · 암석 행성', diameter: '12,104 km', diameterKm: 12104, year: '224.7일', summary: '두꺼운 대기가 열을 가둬 태양계에서 가장 뜨거운 행성입니다.', moons: [] },
  { id: 'earth', name: '지구', au: 1, period: 1, size: 4, color: '#76c8e8', phase: 4.1, kind: '행성 · 암석 행성', diameter: '12,742 km', diameterKm: 12742, year: '365.25일', summary: '표면에 액체 상태의 물이 풍부하고, 현재까지 생명이 확인된 유일한 행성입니다.', moons: [{ id: 'moon', name: '달', diameter: '3,475 km', diameterKm: 3475, orbitKm: 384400, phase: .8, summary: '지구의 유일한 자연 위성입니다. 표면의 충돌구와 오래된 용암 평원은 태양계의 역사를 간직하고 있어요.' }] },
  { id: 'mars', name: '화성', au: 1.52, period: 1.88, size: 3.2, color: '#df886a', phase: 5.55, kind: '행성 · 암석 행성', diameter: '6,779 km', diameterKm: 6779, year: '687일', summary: '붉은 표면과 거대한 화산, 오래된 물의 흔적이 있는 암석 행성입니다.', moons: [{ id: 'phobos', name: '포보스', diameter: '약 22 km', diameterKm: 22, orbitKm: 9376, phase: 1.1, summary: '화성에 매우 가까이 도는 작은 위성입니다. 천천히 안쪽으로 나선형 이동을 하고 있어요.' }, { id: 'deimos', name: '데이모스', diameter: '약 12 km', diameterKm: 12, orbitKm: 23463, phase: 4.3, summary: '포보스보다 작고 화성에서 더 멀리 도는 불규칙한 모양의 위성입니다.' }] },
  { id: 'jupiter', name: '목성', au: 5.2, period: 11.86, size: 6.2, color: '#e2bd96', phase: .72, kind: '행성 · 가스 거대 행성', diameter: '139,820 km', diameterKm: 139820, year: '11.86년', summary: '태양계에서 가장 큰 행성입니다. 거대한 대기 소용돌이와 수많은 위성을 거느립니다.', moons: [{ id: 'io', name: '이오', diameter: '3,643 km', diameterKm: 3643, orbitKm: 421700, phase: .4, summary: '태양계에서 화산 활동이 가장 활발한 천체로 알려져 있습니다.' }, { id: 'europa', name: '유로파', diameter: '3,122 km', diameterKm: 3122, orbitKm: 671100, phase: 2.5, summary: '얼음 표면 아래에 액체 바다가 있을 가능성이 있어 탐사 대상이 되고 있습니다.' }, { id: 'ganymede', name: '가니메데', diameter: '5,268 km', diameterKm: 5268, orbitKm: 1070400, phase: 4.1, summary: '태양계에서 가장 큰 위성으로, 행성인 수성보다도 큽니다.' }, { id: 'callisto', name: '칼리스토', diameter: '4,821 km', diameterKm: 4821, orbitKm: 1882700, phase: 5.6, summary: '오래된 충돌구가 가득한 표면을 가진 목성의 큰 위성입니다.' }] },
  { id: 'saturn', name: '토성', au: 9.58, period: 29.46, size: 5.4, color: '#e8d495', phase: 3.65, kind: '행성 · 가스 거대 행성', diameter: '116,460 km', diameterKm: 116460, year: '29.46년', summary: '얼음과 암석 조각으로 이루어진 넓은 고리가 눈에 띄는 가스 거대 행성입니다.', moons: [{ id: 'titan', name: '타이탄', diameter: '5,150 km', diameterKm: 5150, orbitKm: 1221870, phase: 2, summary: '두꺼운 대기를 가진 큰 위성으로, 표면에는 메탄과 에탄으로 된 호수와 바다가 있습니다.' }, { id: 'enceladus', name: '엔셀라두스', diameter: '504 km', diameterKm: 504, orbitKm: 237950, phase: 5, summary: '남극의 얼음 틈에서 물기둥이 뿜어져 나와 얼음 아래 바다를 연구하는 단서가 됩니다.' }] },
  { id: 'uranus', name: '천왕성', au: 19.2, period: 84, size: 4.4, color: '#9cddd6', phase: 5, kind: '행성 · 얼음 거대 행성', diameter: '50,724 km', diameterKm: 50724, year: '84년', summary: '옆으로 누운 듯한 자전축과 차가운 대기가 특징인 얼음 거대 행성입니다.', moons: [{ id: 'titania', name: '티타니아', diameter: '1,578 km', diameterKm: 1578, orbitKm: 435910, phase: 1.4, summary: '천왕성의 가장 큰 위성입니다. 표면에는 협곡과 충돌구가 관측됩니다.' }, { id: 'miranda', name: '미란다', diameter: '약 472 km', diameterKm: 472, orbitKm: 129900, phase: 4.5, summary: '절벽과 계곡이 복잡하게 뒤섞인 독특한 지형을 가진 작은 위성입니다.' }] },
  { id: 'neptune', name: '해왕성', au: 30.05, period: 164.8, size: 4.4, color: '#7e9ff1', phase: 2.08, kind: '행성 · 얼음 거대 행성', diameter: '49,244 km', diameterKm: 49244, year: '약 165년', summary: '태양에서 가장 먼 행성입니다. 대기에는 매우 빠른 바람이 불어요.', moons: [{ id: 'triton', name: '트리톤', diameter: '2,707 km', diameterKm: 2707, orbitKm: 354800, phase: .6, summary: '해왕성과 반대 방향으로 공전하는 큰 위성입니다. 포획된 천체일 가능성이 연구되고 있어요.' }] },
  { id: 'pluto', name: '명왕성', au: 39.48, period: 248, size: 2.2, color: '#c5a98b', phase: 4.7, kind: '왜소행성 · 카이퍼 벨트', diameter: '2,377 km', diameterKm: 2377, year: '248년', summary: '카이퍼 벨트에 있는 왜소행성입니다. 작은 크기와 타원 궤도에도 다양한 지형이 있어요.', moons: [{ id: 'charon', name: '카론', diameter: '1,212 km', diameterKm: 1212, orbitKm: 19596, phase: 3.2, summary: '명왕성의 가장 큰 위성입니다. 두 천체의 공통 무게중심은 명왕성 바깥에 놓여 있어요.' }] },
];
try { scene = createSolarSystem3D(canvas, planets); }
catch (error) {
  const message = document.querySelector('#graphics-error');
  message.textContent = error instanceof Error ? error.message : '3D 화면을 시작하지 못했습니다.';
  message.hidden = false;
  console.error('[solar-system-3d]', error);
}
const anchors = stages.map(stage => stage.at);
let percent = 0;
let rotation = -.22;
let tilt = .68;
let selectedPlanetId = 'earth';
let selectedMoonId = 'moon';
let focusedPlanetId = '';
let focusZoom = 1;
let systemZoom = 1;
let orbitSpeedIndex = 0;
let orbitSpeed = orbitSpeeds[orbitSpeedIndex];
let orbitPaused = reducedMotion.matches;
let julianDay = clamp(julianDayFromLocalDateTime(localDateTimeValue(new Date())), MIN_JULIAN_DAY, MAX_JULIAN_DAY);
let compareMode = 'distance';
let width = 0;
let height = 0;
let pixelRatio = 1;
let dragging = false;
let movedDuringDrag = false;
let dragStartX = 0;
let dragStartY = 0;
let rotationStart = 0;
let tiltStart = .68;
let lastFrameTimestamp = null;
let lastTimelinePaintTimestamp = -Infinity;
let lastTimelineDay = -1;

function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }
function smooth(a, b, value) { const t = clamp((value - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function activeIndex(value) {
  for (let i = 0; i < anchors.length - 1; i++) if (value < (anchors[i] + anchors[i + 1]) / 2) return i;
  return anchors.length - 1;
}
function currentPlanet() { return planets.find(planet => planet.id === selectedPlanetId) || planets[2]; }
function setProgress(value) {
  percent = clamp(Number(value) || 0, 0, 100);
  focusedPlanetId = '';
  focusZoom = 1;
  systemZoom = 1;
  updateInterface();
}
function updateInterface() {
  const index = activeIndex(percent);
  const stage = stages[index];
  const planet = currentPlanet();
  const focused = Boolean(focusedPlanetId);
  const title = focused ? `${planet.name} 확대 보기` : stage.name;
  document.querySelector('#current-stage-short').textContent = focused ? planet.name : stage.name;
  document.querySelector('#scene-kicker').textContent = focused ? 'PLANET CLOSE-UP' : stage.kicker;
  document.querySelector('#scene-subtitle').textContent = focused ? `${planet.name} · ${planet.kind}` : stage.subtitle;
  document.querySelector('#scale-name').textContent = title;
  document.querySelector('#scale-distance').textContent = focused ? `태양에서 평균 ${planet.au} AU` : stage.distance;
  document.querySelector('#canvas-caption-text').textContent = focused ? `${planet.name} 주변의 대표 위성을 선택해 궤도를 살펴보세요.` : stage.caption;
  document.querySelector('#next-title').textContent = stage.next;
  document.querySelector('#next-copy').textContent = stage.nextCopy;
  document.querySelector('#fact-heading').textContent = stage.factHeading;
  document.querySelector('#fact-label-one').textContent = stage.labelOne;
  document.querySelector('#fact-value-one').innerHTML = stage.valueOne;
  document.querySelector('#fact-label-two').textContent = stage.labelTwo;
  document.querySelector('#fact-value-two').innerHTML = stage.valueTwo;
  document.querySelector('#fact-note').textContent = stage.factNote;
  document.querySelector('#focus-controls').hidden = !focused;
  document.querySelector('#focus-name').textContent = planet.name;
  document.querySelector('#zoom-label').textContent = `${(focused ? focusZoom : systemZoom).toFixed(1)}×`;
  document.querySelector('#stage-rail-fill').style.width = `${percent}%`;
  const nextButton = document.querySelector('#go-next');
  nextButton.innerHTML = index === stages.length - 1 ? '태양계로 돌아가기 <span aria-hidden="true">↺</span>' : '다음 지점으로 이동 <span aria-hidden="true">→</span>';
  stageButtons.forEach((button, buttonIndex) => {
    const active = buttonIndex === index;
    button.classList.toggle('is-active', active);
    button.classList.toggle('is-passed', buttonIndex < index);
    if (active) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
  });
}
function updateOrbitControls() {
  const toggle = document.querySelector('#orbit-toggle');
  toggle.textContent = orbitPaused ? '▶ 공전 재생' : 'Ⅱ 공전 정지';
  toggle.setAttribute('aria-pressed', String(orbitPaused));
  toggle.setAttribute('aria-label', orbitPaused ? '행성 공전 재생' : '행성 공전 일시 정지');
  document.querySelector('#orbit-speed').textContent = `속도 ${orbitSpeed}×`;
}
function syncTimelineControls(force = false) {
  const dateInput = document.querySelector('#simulation-datetime');
  const slider = document.querySelector('#simulation-timeline');
  const date = dateFromJulianDay(julianDay);
  const dayOffset = Math.floor(julianDay - MIN_JULIAN_DAY);
  if (force || document.activeElement !== dateInput) dateInput.value = localDateTimeValue(date);
  slider.value = String(clamp(Math.round(julianDay - MIN_JULIAN_DAY), 0, Number(slider.max)));
  document.querySelector('#simulation-date-label').textContent = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeStyle: 'short' }).format(date);
  slider.setAttribute('aria-valuetext', new Intl.DateTimeFormat('ko-KR', { dateStyle: 'long', timeStyle: 'short' }).format(date));
  lastTimelineDay = dayOffset;
}
function setJulianDay(value, pause = true) {
  if (!Number.isFinite(value)) return;
  julianDay = clamp(value, MIN_JULIAN_DAY, MAX_JULIAN_DAY);
  if (pause) orbitPaused = true;
  syncTimelineControls(true);
  updateOrbitControls();
}
function updatePlanetDetails() {
  const planet = currentPlanet();
  document.querySelector('#planet-kind').textContent = planet.kind;
  document.querySelector('#planet-name').textContent = planet.name;
  document.querySelector('#planet-summary').textContent = planet.summary;
  document.querySelector('#planet-distance').textContent = `${planet.au} AU`;
  document.querySelector('#planet-diameter').textContent = planet.diameter;
  document.querySelector('#planet-year').textContent = planet.year;
  document.querySelector('#planet-swatch').style.setProperty('--planet-color', planet.color);
  document.querySelectorAll('.planet-choice, .compare-row').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.planet === planet.id)));
  document.querySelector('#moon-heading').textContent = `${planet.name}의 위성`;
  document.querySelector('#moon-count').textContent = planet.moons.length ? `대표 위성 ${planet.moons.length}개` : '알려진 위성 없음';
  const moonPicker = document.querySelector('#moon-picker');
  const emptyMoon = document.querySelector('#moon-empty');
  const moonDetail = document.querySelector('#moon-detail');
  moonPicker.replaceChildren();
  if (!planet.moons.length) {
    selectedMoonId = '';
    moonPicker.hidden = true;
    moonDetail.hidden = true;
    emptyMoon.hidden = false;
    return;
  }
  moonPicker.hidden = false;
  emptyMoon.hidden = true;
  if (!planet.moons.some(moon => moon.id === selectedMoonId)) selectedMoonId = planet.moons[0].id;
  for (const moon of planet.moons) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'moon-choice'; button.dataset.moon = moon.id; button.textContent = moon.name;
    button.setAttribute('aria-pressed', String(moon.id === selectedMoonId));
    button.addEventListener('click', () => focusPlanet(planet.id, moon.id));
    moonPicker.append(button);
  }
  const moon = planet.moons.find(item => item.id === selectedMoonId) || planet.moons[0];
  moonDetail.hidden = false;
  document.querySelector('#moon-name').textContent = `${planet.name} · ${moon.name}`;
  document.querySelector('#moon-distance').textContent = `${moon.diameter} · 행성에서 평균 ${moon.orbitKm.toLocaleString()} km`;
  document.querySelector('#moon-summary').textContent = moon.summary;
}
function focusPlanet(id, moonId = '') {
  const planet = planets.find(item => item.id === id);
  if (!planet) return;
  selectedPlanetId = planet.id;
  selectedMoonId = moonId || planet.moons[0]?.id || '';
  focusedPlanetId = planet.id;
  focusZoom = 1;
  systemZoom = 1;
  percent = 0;
  updatePlanetDetails();
  updateInterface();
  canvas.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}
function buildPlanetPicker() {
  const picker = document.querySelector('#planet-picker');
  picker.replaceChildren();
  for (const planet of planets) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'planet-choice'; button.dataset.planet = planet.id;
    button.setAttribute('aria-pressed', String(planet.id === selectedPlanetId));
    const dot = document.createElement('span'); dot.className = 'planet-dot'; dot.style.background = planet.color; dot.style.color = planet.color;
    const copy = document.createElement('span');
    const name = document.createElement('strong'); name.textContent = planet.name;
    const distance = document.createElement('small'); distance.textContent = `${planet.au} AU`;
    copy.append(name, distance); button.append(dot, copy);
    button.addEventListener('click', () => focusPlanet(planet.id));
    picker.append(button);
  }
  updatePlanetDetails();
}
function renderComparison(mode = compareMode) {
  compareMode = mode;
  const container = document.querySelector('#planet-comparison');
  const isDistance = mode === 'distance';
  document.querySelector('#comparison-note').textContent = isDistance
    ? '태양에서 각 행성까지의 평균 거리를 AU 단위로 선형 비교합니다.'
    : '행성의 지름을 km 단위로 선형 비교합니다. 행성 모양은 보기 쉽게 키웠습니다.';
  document.querySelectorAll('[data-compare]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.compare === mode)));
  container.replaceChildren();
  const max = Math.max(...planets.map(planet => isDistance ? planet.au : planet.diameterKm));
  for (const planet of planets) {
    const value = isDistance ? planet.au : planet.diameterKm;
    const row = document.createElement('button');
    row.type = 'button'; row.className = 'compare-row'; row.dataset.planet = planet.id;
    row.setAttribute('aria-pressed', String(planet.id === selectedPlanetId));
    const name = document.createElement('strong'); name.className = 'compare-name'; name.textContent = planet.name;
    const track = document.createElement('span'); track.className = 'compare-track';
    const fill = document.createElement('i'); fill.className = 'compare-fill'; fill.style.width = `${Math.max(2, value / max * 100)}%`; fill.style.background = planet.color;
    track.append(fill);
    const number = document.createElement('span'); number.className = 'compare-value'; number.textContent = isDistance ? `${planet.au} AU` : `${planet.diameterKm.toLocaleString()} km`;
    row.append(name, track, number);
    row.addEventListener('click', () => focusPlanet(planet.id));
    container.append(row);
  }
  document.querySelectorAll('.compare-row').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.planet === selectedPlanetId)));
}
function resizeCanvas() {
  const rect = labelsCanvas.getBoundingClientRect();
  width = Math.max(1, rect.width); height = Math.max(1, rect.height);
  pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  labelsCanvas.width = Math.round(width * pixelRatio); labelsCanvas.height = Math.round(height * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  scene?.resize();
}
function drawLabel(text, x, y, alpha = 1, align = 'left', size = 10) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.font = `500 ${size}px "Segoe UI", "Malgun Gothic", sans-serif`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.shadowColor = '#06101b'; ctx.shadowBlur = 7; ctx.fillStyle = '#d5e6e8'; ctx.fillText(text, x, y); ctx.restore();
}
function drawSceneLabels() {
  if (!scene) return;
  ctx.clearRect(0, 0, width, height);
  if (focusedPlanetId) {
    const planet = currentPlanet();
    const center = scene.projectPlanet(planet.id);
    if (center.visible) drawLabel(planet.name, center.x, center.y + center.radius + 18, .98, 'center', 12);
    for (const moon of planet.moons) {
      const point = scene.projectMoon(planet, moon);
      if (point.visible) drawLabel(moon.name, point.x + 10, point.y - 10, .96, 'left', 9);
    }
    if (!planet.moons.length) drawLabel('알려진 자연 위성이 없습니다', width * .5, height * .84, .78, 'center', 9);
    else drawLabel('드래그해 행성 주위를 둘러보세요', width * .5, height * .88, .62, 'center', 8);
    return;
  }
  const sun = scene.projectSun();
  if (sun.visible) drawLabel('태양', sun.x + 12, sun.y - 12, 1, 'left', 9);
  if (percent < 82) {
    planets.forEach((planet, index) => {
      const point = scene.projectPlanet(planet.id);
      if (!point.visible || point.x < -30 || point.x > width + 30 || point.y < -25 || point.y > height + 25) return;
      const align = point.x < width * .42 ? 'left' : point.x > width * .58 ? 'right' : 'center';
      const x = point.x + (align === 'left' ? point.radius + 5 : align === 'right' ? -point.radius - 5 : 0);
      drawLabel(planet.name, x, point.y + (index % 2 ? 14 : -14), .94, align, 9);
    });
  }
  const stage = activeIndex(percent);
  const boundary = stage === 1 ? { name: '카이퍼 벨트', position: [4.5, 0, 0] }
    : stage === 2 ? { name: '태양권계면 · 약 120 AU', position: [8.1, 0, 0] }
      : stage === 3 ? { name: '오르트 구름 · 추정 범위', position: [18.5, 0, 0] } : null;
  if (boundary) {
    const point = scene.projectWorld(boundary.position);
    if (point.visible && point.x > -100 && point.x < width + 100 && point.y > -30 && point.y < height + 30) drawLabel(boundary.name, point.x, point.y - 14, .86, 'center', 9);
  }
}
function render(timestamp) {
  const elapsedSeconds = lastFrameTimestamp === null ? 0 : Math.min(.1, Math.max(0, (timestamp - lastFrameTimestamp) / 1000));
  lastFrameTimestamp = timestamp;
  if (!orbitPaused) {
    julianDay = Math.min(MAX_JULIAN_DAY, julianDay + elapsedSeconds * BASE_SIMULATION_DAYS_PER_SECOND * orbitSpeed);
    if (julianDay >= MAX_JULIAN_DAY) { orbitPaused = true; updateOrbitControls(); }
  }
  if (Math.floor(julianDay - MIN_JULIAN_DAY) !== lastTimelineDay || timestamp - lastTimelinePaintTimestamp >= 250) {
    syncTimelineControls();
    lastTimelinePaintTimestamp = timestamp;
  }
  if (!width || !height) resizeCanvas();
  if (scene) {
    scene.render(timestamp, { progress: percent, rotation, tilt, focusedPlanetId, focusZoom, systemZoom, orbitPaused, orbitSpeed, julianDay });
    drawSceneLabels();
  } else ctx.clearRect(0, 0, width, height);
  requestAnimationFrame(render);
}
function selectPlanetAtCanvas(clientX, clientY) {
  const solarVisibility = 1 - smooth(.83, .98, percent / 100);
  if (!scene || solarVisibility < .15 || focusedPlanetId) return;
  const rect = canvas.getBoundingClientRect(), x = clientX - rect.left, y = clientY - rect.top;
  for (const planet of planets) {
    const position = scene.projectPlanet(planet.id);
    if (position.visible && Math.hypot(x - position.x, y - position.y) <= Math.max(12, position.radius + 10)) { focusPlanet(planet.id); return; }
  }
}
function selectMoonAtCanvas(clientX, clientY) {
  if (!scene || !focusedPlanetId) return;
  const rect = canvas.getBoundingClientRect(), x = clientX - rect.left, y = clientY - rect.top;
  const planet = currentPlanet();
  for (const moon of planet.moons) {
    const point = scene.projectMoon(planet, moon);
    if (point.visible && Math.hypot(x - point.x, y - point.y) <= Math.max(12, point.radius + 8)) { focusPlanet(focusedPlanetId, moon.id); return; }
  }
}
function adjustZoom(direction) {
  if (focusedPlanetId) {
    focusZoom = clamp(focusZoom + direction * .2, .65, 3);
  } else {
    systemZoom = clamp(systemZoom * (direction > 0 ? 1.18 : 1 / 1.18), .5, 4.5);
  }
  updateInterface();
}

stageButtons.forEach(button => button.addEventListener('click', () => setProgress(button.dataset.stage)));
document.querySelector('#zoom-out').addEventListener('click', () => adjustZoom(-1));
document.querySelector('#zoom-in').addEventListener('click', () => adjustZoom(1));
document.querySelector('#orbit-toggle').addEventListener('click', () => {
  if (orbitPaused && julianDay >= MAX_JULIAN_DAY) julianDay = MIN_JULIAN_DAY;
  orbitPaused = !orbitPaused;
  syncTimelineControls(true);
  updateOrbitControls();
});
document.querySelector('#orbit-speed').addEventListener('click', () => {
  orbitSpeedIndex = (orbitSpeedIndex + 1) % orbitSpeeds.length;
  orbitSpeed = orbitSpeeds[orbitSpeedIndex];
  updateOrbitControls();
});
const simulationDateInput = document.querySelector('#simulation-datetime');
const simulationTimeline = document.querySelector('#simulation-timeline');
simulationDateInput.min = MIN_DATE_TIME;
simulationDateInput.max = MAX_DATE_TIME;
simulationDateInput.step = '60';
simulationTimeline.max = String(Math.ceil(MAX_JULIAN_DAY - MIN_JULIAN_DAY));
simulationDateInput.addEventListener('change', () => setJulianDay(julianDayFromLocalDateTime(simulationDateInput.value)));
simulationTimeline.addEventListener('input', () => setJulianDay(MIN_JULIAN_DAY + Number(simulationTimeline.value)));
document.querySelector('#timeline-today').addEventListener('click', () => setJulianDay(julianDayFromLocalDateTime(localDateTimeValue(new Date()))));
document.querySelector('#back-to-system').addEventListener('click', () => { focusedPlanetId = ''; focusZoom = 1; systemZoom = 1; updateInterface(); });
document.querySelector('#go-next').addEventListener('click', () => {
  const index = activeIndex(percent); setProgress(index === stages.length - 1 ? 0 : stages[index + 1].at);
  canvas.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
});
document.querySelector('#reset-view').addEventListener('click', () => { rotation = -.22; tilt = .68; setProgress(0); });
document.querySelectorAll('[data-compare]').forEach(button => button.addEventListener('click', () => renderComparison(button.dataset.compare)));
canvas.addEventListener('wheel', event => {
  event.preventDefault();
  adjustZoom(event.deltaY < 0 ? 1 : -1);
}, { passive: false });
canvas.addEventListener('pointerdown', event => {
  dragging = true; movedDuringDrag = false; dragStartX = event.clientX; dragStartY = event.clientY; rotationStart = rotation; tiltStart = tilt;
  canvas.classList.add('is-dragging'); canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (!dragging) return;
  if (Math.hypot(event.clientX - dragStartX, event.clientY - dragStartY) > 5) movedDuringDrag = true;
  rotation = rotationStart - (event.clientX - dragStartX) * .006;
  tilt = clamp(tiltStart + (event.clientY - dragStartY) * .004, .18, 1.32);
});
function endDrag(event, allowPick = false) {
  if (dragging && allowPick && !movedDuringDrag) {
    if (focusedPlanetId) selectMoonAtCanvas(event.clientX, event.clientY);
    else selectPlanetAtCanvas(event.clientX, event.clientY);
  }
  dragging = false; canvas.classList.remove('is-dragging');
}
canvas.addEventListener('pointerup', event => endDrag(event, true));
canvas.addEventListener('pointercancel', event => endDrag(event));
canvas.addEventListener('lostpointercapture', event => endDrag(event));
window.addEventListener('resize', resizeCanvas);
if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(canvas);
window.addEventListener('message', event => {
  if (event.source !== window.parent || !['light', 'dark'].includes(event.data?.theme) || (event.data?.type && event.data.type !== 'moa:theme')) return;
  document.documentElement.dataset.moaTheme = event.data.theme;
});

buildPlanetPicker();
renderComparison();
updateInterface();
updateOrbitControls();
syncTimelineControls(true);
resizeCanvas();
requestAnimationFrame(render);
