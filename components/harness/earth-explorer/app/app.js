import { Globe } from './globe.mjs';
import { findPlace, places } from './places.mjs';

const $ = id => document.getElementById(id);
const stage = $('globe-stage');
const canvas = $('globe-canvas');
const markers = new Map();
const labelElements = new Map();
const baseMapLabels = [
  { id: 'asia', text: '아시아', kind: 'continent', lat: 46, lon: 92, minZoom: .58, maxZoom: 1.3, priority: 8 },
  { id: 'europe', text: '유럽', kind: 'continent', lat: 52, lon: 17, minZoom: .58, maxZoom: 1.3, priority: 8 },
  { id: 'africa', text: '아프리카', kind: 'continent', lat: 2, lon: 20, minZoom: .58, maxZoom: 1.3, priority: 8 },
  { id: 'north-america', text: '북아메리카', kind: 'continent', lat: 47, lon: -106, minZoom: .58, maxZoom: 1.3, priority: 8 },
  { id: 'south-america', text: '남아메리카', kind: 'continent', lat: -19, lon: -61, minZoom: .58, maxZoom: 1.3, priority: 8 },
  { id: 'oceania', text: '오세아니아', kind: 'continent', lat: -25, lon: 135, minZoom: .58, maxZoom: 1.3, priority: 8 },
  { id: 'pacific-west', text: '태평양', kind: 'ocean', lat: 2, lon: -143, minZoom: .58, maxZoom: 1.3, priority: 4 },
  { id: 'pacific-east', text: '태평양', kind: 'ocean', lat: -7, lon: 148, minZoom: .58, maxZoom: 1.3, priority: 4 },
  { id: 'atlantic', text: '대서양', kind: 'ocean', lat: 5, lon: -29, minZoom: .58, maxZoom: 1.3, priority: 4 },
  { id: 'indian', text: '인도양', kind: 'ocean', lat: -20, lon: 82, minZoom: .58, maxZoom: 1.3, priority: 4 },
  { id: 'arctic', text: '북극해', kind: 'ocean', lat: 77, lon: 7, minZoom: .58, maxZoom: 1.3, priority: 4 },
  { id: 'southern', text: '남극해', kind: 'ocean', lat: -59, lon: 11, minZoom: .58, maxZoom: 1.3, priority: 4 },
];
let mapLabels = [...baseMapLabels];
let selected = places[0];
let globe;
let lastPointer = null;
let pinchStart = null;
const pointers = new Map();
const defaultLayerVisibility = { borders: true, terrain: true, cities: true, bathymetry: true };
const layerPreferenceKey = 'moa:earth-explorer:layers:v1';

function readLayerVisibility() {
  try {
    const saved = JSON.parse(localStorage.getItem(layerPreferenceKey) || 'null');
    return Object.fromEntries(Object.entries(defaultLayerVisibility).map(([key, fallback]) => [
      key, typeof saved?.[key] === 'boolean' ? saved[key] : fallback,
    ]));
  } catch {
    return { ...defaultLayerVisibility };
  }
}

let layerVisibility = readLayerVisibility();

function syncLayerControls() {
  for (const [key, visible] of Object.entries(layerVisibility)) {
    const control = $(`layer-${key}`);
    if (control) control.checked = visible;
  }
  $('layer-count').textContent = String(Object.values(layerVisibility).filter(Boolean).length);
  const depthLegend = $('depth-legend');
  if (depthLegend) depthLegend.hidden = !layerVisibility.bathymetry;
}

function setLayerVisibility(key, visible) {
  if (!(key in defaultLayerVisibility) || layerVisibility[key] === visible) return;
  if (globe && key !== 'cities' && !globe.setLayerVisibility(key, visible)) {
    $(`layer-${key}`).checked = layerVisibility[key];
    return;
  }
  layerVisibility = { ...layerVisibility, [key]: visible };
  try { localStorage.setItem(layerPreferenceKey, JSON.stringify(layerVisibility)); } catch {}
  syncLayerControls();
  updateMarkers();
}

const coordinate = (value, positive, negative, digits = 2) => `${Math.abs(value).toFixed(digits)}° ${value >= 0 ? positive : negative}`;
const detailedCoordinate = place => `${coordinate(place.lat, 'N', 'S', 4)}   ${coordinate(place.lon, 'E', 'W', 4)}`;

function makePlaceButton(place, index, marker = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.place = place.id;
  if (marker) {
    button.className = 'map-pin';
    button.setAttribute('aria-label', `${place.name}, ${place.region}`);
    const dot = document.createElement('span'); dot.className = 'pin-dot';
    const label = document.createElement('span'); label.className = 'pin-label'; label.textContent = place.name;
    button.append(dot, label);
  } else {
    button.className = 'place-row';
    const number = document.createElement('span'); number.className = 'place-number'; number.textContent = String(index + 1).padStart(2, '0');
    const copy = document.createElement('span'); copy.className = 'place-copy';
    const name = document.createElement('strong'); name.textContent = place.name;
    const region = document.createElement('small'); region.textContent = place.region;
    copy.append(name, region);
    const arrow = document.createElement('span'); arrow.className = 'place-arrow'; arrow.textContent = '↗';
    button.append(number, copy, arrow);
  }
  button.addEventListener('click', () => selectPlace(place));
  return button;
}

function buildPlaces() {
  $('places-count').textContent = `${String(places.length).padStart(2, '0')} PLACES`;
  const suggestions = $('place-suggestions');
  for (const place of places) {
    const option = document.createElement('option'); option.value = place.name; suggestions.append(option);
    const marker = makePlaceButton(place, 0, true); $('markers').append(marker); markers.set(place.id, marker);
  }
  renderList();
}

function buildMapLabels(features) {
  const layer = $('geo-labels');
  const countryLabels = features.countries.map((country, index) => ({
    id: `country-${index}`, text: country.name, kind: 'country', lat: country.lat, lon: country.lon,
    minZoom: country.populationRank >= 15 ? .86 : country.populationRank >= 12 ? 1.2 : country.populationRank >= 8 ? 1.55 : country.populationRank >= 5 ? 1.9 : 2.18,
    priority: 12 + Math.max(0, 18 - country.populationRank),
  }));
  const mountainLabels = features.mountains.map((mountain, index) => ({
    id: `mountain-${index}`, text: mountain.name, kind: 'mountain', lat: mountain.lat, lon: mountain.lon,
    minZoom: mountain.rank <= 1 ? 1.18 : mountain.rank <= 2 ? 1.43 : mountain.rank <= 3 ? 1.72 : 1.95,
    priority: 34 + mountain.rank,
  }));
  const riverLabels = features.rivers.map((river, index) => ({
    id: `river-${index}`, text: river.name, kind: 'river', lat: river.lat, lon: river.lon,
    minZoom: river.rank <= 1 ? 1.18 : river.rank <= 2 ? 1.4 : river.rank <= 3 ? 1.68 : 1.92,
    priority: 42 + river.rank,
  }));
  mapLabels = [...baseMapLabels, ...countryLabels, ...mountainLabels, ...riverLabels];
  for (const label of mapLabels) {
    const element = document.createElement('span');
    element.className = `geo-label ${label.kind} hidden`;
    element.textContent = label.text;
    element.setAttribute('aria-hidden', 'true');
    layer.append(element);
    labelElements.set(label.id, element);
  }
}

function renderList() {
  const list = $('place-list');
  list.replaceChildren(...places.map((place, index) => {
    const item = makePlaceButton(place, index);
    item.setAttribute('aria-current', String(place.id === selected.id));
    return item;
  }));
}

function selectPlace(place, fly = true) {
  selected = place;
  $('place-name').textContent = place.name;
  $('place-region').textContent = place.region;
  $('place-summary').textContent = place.summary;
  $('place-coords').textContent = detailedCoordinate(place);
  $('stage-place').textContent = `${place.name} · ${place.region.split(' · ')[0]}`;
  $('stage-coords').textContent = `${coordinate(place.lat, 'N', 'S')}   ${coordinate(place.lon, 'E', 'W')}`;
  $('place-query').value = '';
  renderList();
  for (const [id, marker] of markers) marker.classList.toggle('selected', id === place.id);
  if (fly) globe?.goTo(place.lat, place.lon, 1.2);
  updateMarkers();
  setRotationButton();
}

function updateMarkers() {
  if (!globe) return;
  const stageRect = stage.getBoundingClientRect();
  const occupied = [];
  for (const place of places) {
    const marker = markers.get(place.id);
    const point = globe.project(place.lat, place.lon);
    marker.style.left = `${point.x}px`;
    marker.style.top = `${point.y}px`;
    const shown = layerVisibility.cities && point.visible && (place.id === selected.id || globe.zoom >= 1.82);
    marker.classList.toggle('hidden', !shown);
    marker.classList.toggle('selected', place.id === selected.id);
    if (shown) {
      const width = marker.offsetWidth || 64, height = marker.offsetHeight || 26;
      occupied.push({ left: point.x - 8, right: point.x - 8 + width, top: point.y - height / 2, bottom: point.y + height / 2 });
    }
  }
  const activeLabels = mapLabels.filter(label =>
    globe.zoom >= label.minZoom &&
    (label.maxZoom === undefined || globe.zoom <= label.maxZoom) &&
    (label.kind !== 'country' || layerVisibility.borders) &&
    (!['mountain', 'river'].includes(label.kind) || layerVisibility.terrain),
  )
    .sort((a, b) => a.priority - b.priority);
  const visibleLabels = new Set();
  for (const label of activeLabels) {
    const element = labelElements.get(label.id);
    const point = globe.project(label.lat, label.lon);
    if (!point.visible) continue;
    const boxWidth = Math.max(12, element.offsetWidth), boxHeight = Math.max(10, element.offsetHeight);
    const candidate = { left: point.x - boxWidth / 2 - 3, right: point.x + boxWidth / 2 + 3, top: point.y - boxHeight / 2 - 2, bottom: point.y + boxHeight / 2 + 2 };
    if (candidate.left < 4 || candidate.right > stageRect.width - 4 || candidate.top < 4 || candidate.bottom > stageRect.height - 4) continue;
    const overlaps = occupied.some(box => candidate.left < box.right && candidate.right > box.left && candidate.top < box.bottom && candidate.bottom > box.top);
    if (overlaps) continue;
    element.style.left = `${point.x}px`;
    element.style.top = `${point.y}px`;
    visibleLabels.add(label.id);
    occupied.push(candidate);
  }
  for (const label of mapLabels) {
    const element = labelElements.get(label.id);
    const shouldHide = !visibleLabels.has(label.id);
    if (element.classList.contains('hidden') !== shouldHide) element.classList.toggle('hidden', shouldHide);
  }
}

function setRotationButton() {
  const button = $('rotate-toggle');
  button.classList.toggle('rotate-on', globe?.autoRotate);
  button.setAttribute('aria-pressed', String(Boolean(globe?.autoRotate)));
  button.title = globe?.autoRotate ? '자동 회전 끄기' : '자동 회전 켜기';
  document.querySelector('.rotate-label').textContent = globe?.autoRotate ? '회전 중' : '회전 시작';
}

function loadReliefImage() {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('육지 지형 음영을 불러오지 못했습니다.'));
    image.src = '/terrain-relief.jpg';
  });
}

buildPlaces();
syncLayerControls();
try {
  const [landResponse, featuresResponse, bathymetryResponse, terrainRelief] = await Promise.all([
    fetch('/world-land.json', { cache: 'force-cache' }),
    fetch('/world-features.json', { cache: 'force-cache' }),
    fetch('/world-bathymetry.json', { cache: 'force-cache' }),
    loadReliefImage(),
  ]);
  if ([landResponse, featuresResponse, bathymetryResponse].some(response => !response.ok)) {
    throw new Error('지구 지도 자료를 불러오지 못했습니다.');
  }
  const [land, features, bathymetry] = await Promise.all([
    landResponse.json(),
    featuresResponse.json(),
    bathymetryResponse.json(),
  ]);
  buildMapLabels(features);
  globe = new Globe(canvas, { ...features, landPolygons: land.polygons, bathymetry, terrainRelief, layerVisibility }, updateMarkers);
  stage.classList.remove('no-webgl');
} catch (error) {
  stage.classList.add('no-webgl');
  $('fallback-message').hidden = false;
  $('fallback-message').textContent = error instanceof Error && error.message.includes('3D 그래픽')
    ? '이 브라우저에서 3D 그래픽을 사용할 수 없습니다. 다른 브라우저에서 열어주세요.'
    : '해안선·해저 수심·지형 음영 자료를 불러오지 못했습니다. 모아 화면을 새로고침해주세요.';
  $('rotate-toggle').disabled = true;
  $('zoom-in').disabled = true;
  $('zoom-out').disabled = true;
}
selectPlace(selected, false);
setRotationButton();

$('search-form').addEventListener('submit', event => {
  event.preventDefault();
  const place = findPlace($('place-query').value);
  if (place) selectPlace(place);
  else {
    $('place-query').setCustomValidity($('place-query').value.trim() ? '목록에 있는 도시 이름을 검색해주세요.' : '도시 이름을 입력해주세요.');
    $('place-query').reportValidity();
  }
});
$('place-query').addEventListener('input', event => event.currentTarget.setCustomValidity(''));
$('layers-toggle').addEventListener('click', () => {
  const menu = $('layer-menu');
  const expanded = $('layers-toggle').getAttribute('aria-expanded') === 'true';
  $('layers-toggle').setAttribute('aria-expanded', String(!expanded));
  menu.hidden = expanded;
});
for (const key of Object.keys(defaultLayerVisibility)) {
  $(`layer-${key}`).addEventListener('change', event => setLayerVisibility(key, event.currentTarget.checked));
}
document.addEventListener('pointerdown', event => {
  if (event.target instanceof Element && !event.target.closest('.layer-control')) {
    $('layer-menu').hidden = true;
    $('layers-toggle').setAttribute('aria-expanded', 'false');
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('layer-menu').hidden) {
    $('layer-menu').hidden = true;
    $('layers-toggle').setAttribute('aria-expanded', 'false');
    $('layers-toggle').focus();
  }
});
$('rotate-toggle').addEventListener('click', () => { globe?.setAutoRotate(!globe.autoRotate); setRotationButton(); });
$('zoom-in').addEventListener('click', () => globe?.zoomBy(.16));
$('zoom-out').addEventListener('click', () => globe?.zoomBy(-.16));
$('reset-view').addEventListener('click', () => { selectPlace(places[0]); globe?.reset(); setRotationButton(); });
document.querySelector('.atlas-brand').addEventListener('click', event => { event.preventDefault(); $('reset-view').click(); });

stage.addEventListener('pointerdown', event => {
  if (event.target instanceof Element && event.target.closest('.map-pin, .layer-control')) return;
  stage.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 1) lastPointer = { x: event.clientX, y: event.clientY };
  if (pointers.size === 2) {
    const [first, second] = [...pointers.values()];
    pinchStart = { distance: Math.hypot(first.x - second.x, first.y - second.y), zoom: globe?.zoom || 1 };
    lastPointer = null;
  }
});
stage.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size > 1 && pinchStart) {
    const [first, second] = [...pointers.values()];
    const distance = Math.hypot(first.x - second.x, first.y - second.y);
    if (pinchStart.distance > 0) globe?.setZoom(pinchStart.zoom * distance / pinchStart.distance);
  } else if (lastPointer) {
    globe?.rotateBy(event.clientX - lastPointer.x, event.clientY - lastPointer.y);
    lastPointer = { x: event.clientX, y: event.clientY };
    setRotationButton();
    stage.classList.add('dragging');
  }
});
function releasePointer(event) {
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinchStart = null;
  lastPointer = pointers.size === 1 ? [...pointers.values()][0] : null;
  if (!pointers.size) stage.classList.remove('dragging');
}
stage.addEventListener('pointerup', releasePointer);
stage.addEventListener('pointercancel', releasePointer);
stage.addEventListener('wheel', event => {
  event.preventDefault();
  globe?.zoomBy(event.deltaY < 0 ? .09 : -.09);
}, { passive: false });
const solarClock = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function updateSolarClock() { $('solar-clock').textContent = solarClock.format(new Date()); }
updateSolarClock();
const solarClockTimer = window.setInterval(updateSolarClock, 30_000);
window.addEventListener('beforeunload', () => { window.clearInterval(solarClockTimer); globe?.destroy(); }, { once: true });
