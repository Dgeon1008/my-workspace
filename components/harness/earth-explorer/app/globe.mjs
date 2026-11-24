function traceLand(context, polygons, project) {
  context.beginPath();
  for (const polygon of polygons) {
    for (const ring of polygon) {
      ring.forEach((point, index) => { const [x, y] = project(point); index ? context.lineTo(x, y) : context.moveTo(x, y); });
      context.closePath();
    }
  }
}

function tracePolygon(context, polygon, project) {
  context.beginPath();
  for (const ring of polygon) {
    ring.forEach((point, index) => { const [x, y] = project(point); index ? context.lineTo(x, y) : context.moveTo(x, y); });
    context.closePath();
  }
}

function makeTexture(mapData, maxTextureSize = 2048, layerVisibility = {}) {
  const mapCanvas = document.createElement('canvas');
  const width = Math.min(4096, Math.max(1024, maxTextureSize || 2048));
  const height = Math.floor(width / 2);
  mapCanvas.width = width;
  mapCanvas.height = height;
  const map = mapCanvas.getContext('2d', { alpha: false });
  const xy = ([lon, lat]) => [(lon + 180) / 360 * width, (90 - lat) / 180 * height];
  const { landPolygons, countryBorders, rivers, mountains, bathymetry, terrainRelief } = mapData;
  const ocean = map.createLinearGradient(0, 0, width, height);
  ocean.addColorStop(0, '#0b3855');
  ocean.addColorStop(.45, '#0b5770');
  ocean.addColorStop(.72, '#116779');
  ocean.addColorStop(1, '#092d4a');
  map.fillStyle = ocean;
  map.fillRect(0, 0, width, height);

  const depthColors = new Map([
    [0, '#0c5670'], [200, '#0b506d'], [1000, '#0a4a67'], [2000, '#094361'],
    [3000, '#083d5b'], [4000, '#073754'], [5000, '#06304e'], [6000, '#052a48'],
    [7000, '#042441'], [8000, '#03203b'], [9000, '#031b35'], [10000, '#02172f'],
  ]);
  map.save();
  map.lineJoin = 'round';
  map.lineCap = 'round';
  if (layerVisibility.bathymetry !== false) {
    for (const layer of bathymetry?.layers || []) {
      const color = depthColors.get(layer.depth);
      if (!color) continue;
      for (const polygon of layer.polygons) {
        tracePolygon(map, polygon, xy);
        map.fillStyle = color;
        map.fill('evenodd');
        if (layer.depth > 0) {
          map.lineWidth = width / 4096;
          map.strokeStyle = '#8de0e51b';
          map.stroke();
        }
      }
    }
  }
  map.restore();

  const currents = map.createRadialGradient(width * .48, height * .48, 70, width * .48, height * .48, width * .62);
  currents.addColorStop(0, '#4da1a31c');
  currents.addColorStop(.62, '#72c2aa0b');
  currents.addColorStop(1, '#020e2526');
  map.fillStyle = currents;
  map.fillRect(0, 0, width, height);

  map.save();
  map.strokeStyle = '#83cad020';
  map.lineWidth = 1;
  for (let lat = -75; lat <= 75; lat += 15) {
    const y = (90 - lat) / 180 * height;
    map.beginPath(); map.moveTo(0, y); map.lineTo(width, y); map.stroke();
  }
  for (let lon = -165; lon <= 180; lon += 15) {
    const x = (lon + 180) / 360 * width;
    map.beginPath(); map.moveTo(x, 0); map.lineTo(x, height); map.stroke();
  }
  map.restore();

  map.save();
  map.shadowColor = '#87dfb044';
  map.shadowBlur = 13;
  map.lineJoin = 'round';
  map.lineCap = 'round';
  const land = map.createLinearGradient(0, 40, 0, height - 30);
  land.addColorStop(0, '#8cae93');
  land.addColorStop(.18, '#7c9a76');
  land.addColorStop(.36, '#a09a69');
  land.addColorStop(.51, '#b2a16d');
  land.addColorStop(.68, '#77976d');
  land.addColorStop(.86, '#91a27b');
  land.addColorStop(1, '#d7ddd0');
  for (const polygon of landPolygons) {
    tracePolygon(map, polygon, xy);
    map.fillStyle = land;
    map.fill('evenodd');
    map.shadowBlur = 0;
    map.lineWidth = 2.2;
    map.strokeStyle = '#c1d6a37d';
    map.stroke();
  }
  map.restore();

  // Broad regional tints and relief give the vector land a little depth.
  if (layerVisibility.terrain !== false) {
    map.save();
    traceLand(map, landPolygons, xy);
    map.clip('evenodd');
    const glow = (lon, lat, rx, ry, color) => {
      const [x, y] = xy([lon, lat]);
      map.save(); map.translate(x, y); map.scale(rx, ry);
      const gradient = map.createRadialGradient(0, 0, .08, 0, 0, 1);
      gradient.addColorStop(0, color); gradient.addColorStop(1, '#00000000');
      map.fillStyle = gradient; map.beginPath(); map.arc(0, 0, 1, 0, Math.PI * 2); map.fill(); map.restore();
    };
    glow(18, 23, 290, 125, '#d6b47b67');
    glow(46, 26, 150, 77, '#d4a87461');
    glow(79, 24, 230, 74, '#c9a56b58');
    glow(-105, 39, 170, 180, '#a8ba7d47');
    glow(-61, -14, 100, 240, '#4b88674c');
    glow(22, -3, 140, 210, '#c3ac6c47');
    glow(134, -25, 170, 90, '#d7b97f48');

    if (terrainRelief?.complete) {
      map.globalCompositeOperation = 'multiply';
      map.globalAlpha = .39;
      map.drawImage(terrainRelief, 0, 0, width, height);
      map.globalAlpha = 1;
      map.globalCompositeOperation = 'source-over';
    }
    map.restore();
  }

  // Natural Earth range areas add geographic context without a third-party map service.
  if (layerVisibility.terrain !== false) {
    map.save();
    map.lineJoin = 'round';
    map.lineCap = 'round';
    for (const range of mountains) {
      map.beginPath();
      for (const ring of range.rings) {
        ring.forEach((point, index) => { const [x, y] = xy(point); index ? map.lineTo(x, y) : map.moveTo(x, y); });
        map.closePath();
      }
      map.fillStyle = '#ead7a61a';
      map.fill('evenodd');
      map.lineWidth = 1.2;
      map.strokeStyle = '#f0d9a85e';
      map.stroke();
    }
    map.restore();
  }

  if (layerVisibility.borders !== false) {
    map.save();
    map.lineJoin = 'round';
    map.lineCap = 'round';
    map.lineWidth = 1.7;
    map.strokeStyle = '#1b383bba';
    map.shadowColor = '#d5d7a954';
    map.shadowBlur = 1.5;
    for (const line of countryBorders) {
      map.beginPath();
      line.forEach((point, index) => { const [x, y] = xy(point); index ? map.lineTo(x, y) : map.moveTo(x, y); });
      map.stroke();
    }
    map.restore();
  }

  if (layerVisibility.terrain !== false) {
    map.save();
    map.lineJoin = 'round';
    map.lineCap = 'round';
    map.strokeStyle = '#4cc6d6a8';
    map.shadowColor = '#4bc8e06b';
    map.shadowBlur = 2;
    for (const river of rivers) {
      map.lineWidth = river.rank <= 2 ? 1.35 : 1;
      for (const line of river.lines) {
        map.beginPath();
        line.forEach((point, index) => { const [x, y] = xy(point); index ? map.lineTo(x, y) : map.moveTo(x, y); });
        map.stroke();
      }
    }
    map.restore();
  }

  // Subtle cloud bands sit above both land and ocean.
  map.save();
  map.globalAlpha = .12;
  map.lineCap = 'round';
  map.shadowColor = '#e6f6ed'; map.shadowBlur = 18;
  const cloudBands = [
    [[-166,48],[-145,53],[-125,48],[-109,54],[-91,51]],
    [[-97,4],[-82,9],[-68,3],[-53,7]],
    [[-26,58],[-8,61],[12,57],[28,61],[43,58]],
    [[43,-6],[61,-1],[74,-8],[94,-3],[110,-9]],
    [[125,23],[141,27],[157,22],[171,26]],
    [[-12,-49],[7,-43],[24,-47],[44,-42],[60,-47]],
    [[79,42],[96,47],[115,42],[132,48]],
  ];
  for (const band of cloudBands) {
    map.beginPath();
    band.forEach((point, index) => { const [x, y] = xy(point); index ? map.lineTo(x, y) : map.moveTo(x, y); });
    map.lineWidth = 13; map.strokeStyle = '#eaf6ea'; map.stroke();
    map.lineWidth = 3; map.strokeStyle = '#ffffff'; map.stroke();
  }
  map.restore();
  return mapCanvas;
}

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('3D 그래픽 셰이더를 만들지 못했습니다.');
  gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || '셰이더 컴파일 실패'; gl.deleteShader(shader); throw new Error(message);
  }
  return shader;
}

const vertexSource = `
attribute vec3 aPosition;
attribute vec2 aUv;
uniform float uYaw;
uniform float uPitch;
uniform float uScale;
uniform float uAspect;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vGeoNormal;
void main() {
  float cy = cos(uYaw), sy = sin(uYaw);
  vec3 aroundY = vec3(aPosition.x * cy - aPosition.z * sy, aPosition.y, aPosition.x * sy + aPosition.z * cy);
  float cp = cos(uPitch), sp = sin(uPitch);
  vec3 globe = vec3(aroundY.x, aroundY.y * cp - aroundY.z * sp, aroundY.y * sp + aroundY.z * cp);
  vUv = aUv;
  vNormal = globe;
  vGeoNormal = aPosition;
  gl_Position = vec4(globe.x * uScale / uAspect, globe.y * uScale, 0.0, 1.0);
}`;

const fragmentSource = `
precision mediump float;
uniform sampler2D uMap;
uniform vec3 uSunGeo;
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vGeoNormal;
void main() {
  vec3 normal = normalize(vNormal);
  if (normal.z < 0.0) discard;
  vec3 light = normalize(vec3(-0.42, 0.32, 0.86));
  float diffuse = max(dot(normal, light), 0.0);
  vec3 color = texture2D(uMap, vUv).rgb;
  color *= 0.34 + diffuse * 0.8;
  float limb = pow(1.0 - max(normal.z, 0.0), 2.4);
  color += vec3(0.035, 0.17, 0.29) * limb;
  float sheen = pow(max(dot(normal, normalize(vec3(-0.25, 0.2, 1.0))), 0.0), 18.0);
  color += vec3(0.13, 0.26, 0.31) * sheen * 0.14;
  float solarElevation = dot(normalize(vGeoNormal), normalize(uSunGeo));
  float daylight = smoothstep(-0.075, 0.035, solarElevation);
  float twilight = exp(-abs(solarElevation) * 20.0);
  color = mix(color * 0.24 + vec3(0.005, 0.016, 0.028), color, daylight);
  color += vec3(0.035, 0.13, 0.17) * twilight * 0.42;
  gl_FragColor = vec4(color, 1.0);
}`;

function sphereData(slices = 144, stacks = 72) {
  const positions = [], uvs = [];
  const point = (lon, lat) => [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
  const add = (lon, lat, u, v) => { positions.push(...point(lon, lat)); uvs.push(u, v); };
  for (let row = 0; row < stacks; row++) {
    const v0 = row / stacks, v1 = (row + 1) / stacks;
    const lat0 = Math.PI / 2 - v0 * Math.PI, lat1 = Math.PI / 2 - v1 * Math.PI;
    for (let col = 0; col < slices; col++) {
      const u0 = col / slices, u1 = (col + 1) / slices;
      const lon0 = -Math.PI + u0 * Math.PI * 2, lon1 = -Math.PI + u1 * Math.PI * 2;
      add(lon0, lat0, u0, v0); add(lon0, lat1, u0, v1); add(lon1, lat0, u1, v0);
      add(lon1, lat0, u1, v0); add(lon0, lat1, u0, v1); add(lon1, lat1, u1, v1);
    }
  }
  return { positions: new Float32Array(positions), uvs: new Float32Array(uvs) };
}

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

function solarDirection(date = new Date()) {
  const julianDay = date.getTime() / 86400000 + 2440587.5;
  const centuries = (julianDay - 2451545) / 36525;
  const radians = degrees => degrees * Math.PI / 180;
  const normalizeDegrees = degrees => ((degrees % 360) + 360) % 360;
  const meanLongitude = radians(normalizeDegrees(280.46646 + centuries * (36000.76983 + .0003032 * centuries)));
  const meanAnomaly = radians(normalizeDegrees(357.52911 + centuries * (35999.05029 - .0001537 * centuries)));
  const equationOfCenter = radians(
    Math.sin(meanAnomaly) * (1.914602 - centuries * (.004817 + .000014 * centuries)) +
    Math.sin(2 * meanAnomaly) * (.019993 - .000101 * centuries) +
    Math.sin(3 * meanAnomaly) * .000289,
  );
  const omega = radians(125.04 - 1934.136 * centuries);
  const apparentLongitude = meanLongitude + equationOfCenter - radians(.00569) - radians(.00478) * Math.sin(omega);
  const meanObliquity = 23.439291 - centuries * (.0130042 + centuries * (.00000016 - .000000504 * centuries));
  const obliquity = radians(meanObliquity + .00256 * Math.cos(omega));
  const rightAscension = Math.atan2(Math.cos(obliquity) * Math.sin(apparentLongitude), Math.cos(apparentLongitude));
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(apparentLongitude));
  const gmst = normalizeDegrees(280.46061837 + 360.98564736629 * (julianDay - 2451545) + .000387933 * centuries ** 2 - centuries ** 3 / 38710000);
  let subsolarLongitude = rightAscension - radians(gmst);
  if (subsolarLongitude > Math.PI) subsolarLongitude -= Math.PI * 2;
  if (subsolarLongitude < -Math.PI) subsolarLongitude += Math.PI * 2;
  return [
    Math.cos(declination) * Math.sin(subsolarLongitude),
    Math.sin(declination),
    Math.cos(declination) * Math.cos(subsolarLongitude),
  ];
}

export class Globe {
  constructor(canvas, mapData, onUpdate = () => {}) {
    this.canvas = canvas;
    this.onUpdate = onUpdate;
    this.yaw = 126.978 * Math.PI / 180;
    this.pitch = 37.5665 * Math.PI / 180;
    this.zoom = 0.92;
    this.autoRotate = false;
    this.flight = null;
    this.frame = 0;
    this.lastFrame = performance.now();
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power' });
    if (!gl) throw new Error('이 브라우저에서 3D 그래픽을 사용할 수 없습니다.');
    this.gl = gl;
    if (!Array.isArray(mapData?.landPolygons) || !mapData.landPolygons.length) throw new Error('정밀한 육지 경계 데이터를 찾지 못했습니다.');
    this.mapData = mapData;
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.layerVisibility = { borders: true, terrain: true, bathymetry: true, ...(mapData.layerVisibility || {}) };
    this.mapCanvas = makeTexture(mapData, this.maxTextureSize, this.layerVisibility);
    this.sunMinute = -1;
    this.sunDirection = solarDirection();
    this.setup();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.resize();
    this.frame = requestAnimationFrame(time => this.draw(time));
  }

  setup() {
    const gl = this.gl;
    const program = gl.createProgram();
    if (!program) throw new Error('3D 지구본을 준비하지 못했습니다.');
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || '3D 셰이더 연결 실패');
    this.program = program;
    const data = sphereData();
    this.count = data.positions.length / 3;
    const positionBuffer = gl.createBuffer(), uvBuffer = gl.createBuffer();
    if (!positionBuffer || !uvBuffer) throw new Error('지구본 표면을 준비하지 못했습니다.');
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); gl.bufferData(gl.ARRAY_BUFFER, data.positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer); gl.bufferData(gl.ARRAY_BUFFER, data.uvs, gl.STATIC_DRAW);
    this.buffers = [positionBuffer, uvBuffer];
    gl.useProgram(program);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
    const uv = gl.getAttribLocation(program, 'aUv');
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer); gl.enableVertexAttribArray(uv); gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 0, 0);
    this.uniforms = Object.fromEntries(['uYaw','uPitch','uScale','uAspect','uMap','uSunGeo'].map(name => [name, gl.getUniformLocation(program, name)]));
    const texture = gl.createTexture();
    if (!texture) throw new Error('지구 지형을 표시하지 못했습니다.');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // The sphere's v=0 row is the north pole, matching the canvas texture's top row.
    // Flipping here mirrors land north-to-south while city markers keep their real coordinates.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.mapCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    this.mapCanvas.width = 1; this.mapCanvas.height = 1; this.mapCanvas = null;
    this.texture = texture;
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    this.gl.viewport(0, 0, width, height);
  }

  draw(time) {
    const gl = this.gl;
    const dt = Math.min(.05, Math.max(0, (time - this.lastFrame) / 1000));
    this.lastFrame = time;
    if (this.autoRotate && !this.flight && !document.hidden) this.yaw += dt * .026;
    if (this.flight) {
      const t = clamp((time - this.flight.started) / this.flight.duration, 0, 1);
      const eased = t * t * (3 - 2 * t);
      this.yaw = this.flight.fromYaw + (this.flight.toYaw - this.flight.fromYaw) * eased;
      this.pitch = this.flight.fromPitch + (this.flight.toPitch - this.flight.fromPitch) * eased;
      this.zoom = this.flight.fromZoom + (this.flight.toZoom - this.flight.fromZoom) * eased;
      if (t >= 1) this.flight = null;
    }
    gl.useProgram(this.program);
    gl.uniform1f(this.uniforms.uYaw, this.yaw);
    gl.uniform1f(this.uniforms.uPitch, this.pitch);
    gl.uniform1f(this.uniforms.uScale, this.zoom * .86);
    gl.uniform1f(this.uniforms.uAspect, this.canvas.width / this.canvas.height);
    const minute = Math.floor(Date.now() / 60000);
    if (minute !== this.sunMinute) {
      this.sunDirection = solarDirection();
      this.sunMinute = minute;
    }
    gl.uniform3f(this.uniforms.uSunGeo, ...this.sunDirection);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texture); gl.uniform1i(this.uniforms.uMap, 0);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, this.count);
    this.onUpdate();
    this.frame = requestAnimationFrame(next => this.draw(next));
  }

  rotateBy(dx, dy) {
    this.flight = null; this.autoRotate = false;
    this.yaw -= dx * .0055;
    this.pitch = clamp(this.pitch + dy * .0055, -1.36, 1.36);
  }

  zoomBy(amount) { this.flight = null; this.zoom = clamp(this.zoom + amount, .58, 2.45); }

  setZoom(value) { this.zoom = clamp(value, .58, 2.45); }

  setLayerVisibility(layer, visible) {
    if (!['borders', 'terrain', 'bathymetry'].includes(layer) || this.layerVisibility[layer] === visible) return true;
    const nextVisibility = { ...this.layerVisibility, [layer]: visible };
    let nextCanvas;
    try {
      nextCanvas = makeTexture(this.mapData, this.maxTextureSize, nextVisibility);
      const gl = this.gl;
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, nextCanvas);
      gl.generateMipmap(gl.TEXTURE_2D);
      this.layerVisibility = nextVisibility;
      return true;
    } catch (error) {
      console.error('지도 레이어를 바꾸지 못했습니다.', error);
      return false;
    } finally {
      if (nextCanvas) { nextCanvas.width = 1; nextCanvas.height = 1; }
    }
  }

  goTo(lat, lon, zoom = 1.22) {
    let toYaw = lon * Math.PI / 180;
    let delta = (((toYaw - this.yaw + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    toYaw = this.yaw + delta;
    this.autoRotate = false;
    this.flight = {
      fromYaw: this.yaw, fromPitch: this.pitch, fromZoom: this.zoom,
      toYaw, toPitch: lat * Math.PI / 180, toZoom: zoom,
      started: performance.now(), duration: 1050,
    };
  }

  reset() {
    this.autoRotate = false;
    this.goTo(37.5665, 126.978, .92);
    this.autoRotate = false;
  }

  setAutoRotate(value) { this.autoRotate = value; }

  project(lat, lon) {
    const latitude = lat * Math.PI / 180, longitude = lon * Math.PI / 180;
    const x = Math.cos(latitude) * Math.sin(longitude), y = Math.sin(latitude), z = Math.cos(latitude) * Math.cos(longitude);
    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    const rx = x * cy - z * sy, rz = x * sy + z * cy;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const ry = y * cp - rz * sp, front = y * sp + rz * cp;
    const rect = this.canvas.getBoundingClientRect();
    const radius = rect.height * .5 * this.zoom * .86;
    return { x: rect.width * .5 + rx * radius, y: rect.height * .5 - ry * radius, visible: front > .015 && Math.abs(rx * radius) < rect.width * .68 && Math.abs(ry * radius) < rect.height * .68 };
  }

  destroy() {
    cancelAnimationFrame(this.frame); this.resizeObserver?.disconnect();
    this.gl.deleteTexture(this.texture); this.buffers?.forEach(buffer => this.gl.deleteBuffer(buffer));
    this.gl.deleteProgram(this.program);
  }
}
