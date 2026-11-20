const mapCanvas = document.createElement('canvas');
mapCanvas.width = 2048;
mapCanvas.height = 1024;
const map = mapCanvas.getContext('2d', { alpha: false });
const width = mapCanvas.width, height = mapCanvas.height;
const xy = ([lon, lat]) => [(lon + 180) / 360 * width, (90 - lat) / 180 * height];

function traceLand(polygons) {
  map.beginPath();
  for (const polygon of polygons) {
    for (const ring of polygon) {
      ring.forEach((point, index) => { const [x, y] = xy(point); index ? map.lineTo(x, y) : map.moveTo(x, y); });
      map.closePath();
    }
  }
}

function makeTexture(mapData) {
  const { landPolygons, countryBorders, rivers, mountains } = mapData;
  const ocean = map.createLinearGradient(0, 0, width, height);
  ocean.addColorStop(0, '#0b3855');
  ocean.addColorStop(.45, '#0b5770');
  ocean.addColorStop(.72, '#116779');
  ocean.addColorStop(1, '#092d4a');
  map.fillStyle = ocean;
  map.fillRect(0, 0, width, height);

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
    map.beginPath();
    for (const ring of polygon) {
      ring.forEach((point, index) => { const [x, y] = xy(point); index ? map.lineTo(x, y) : map.moveTo(x, y); });
      map.closePath();
    }
    map.fillStyle = land;
    map.fill('evenodd');
    map.shadowBlur = 0;
    map.lineWidth = 2.2;
    map.strokeStyle = '#c1d6a37d';
    map.stroke();
  }
  map.restore();

  // Broad climate colors and relief give the vector land a little depth.
  map.save();
  traceLand(landPolygons);
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

  const relief = [
    [[-130,58],[-123,52],[-119,46],[-116,40],[-112,35],[-108,31],[-105,25]],
    [[-74,8],[-73,0],[-72,-10],[-70,-20],[-69,-31],[-71,-42]],
    [[-5,43],[3,45],[10,46],[16,47],[22,48]],
    [[66,27],[73,31],[80,32],[88,30],[95,28],[103,29]],
    [[-110,22],[-102,20],[-96,19],[-90,17]],
    [[28,-3],[32,-12],[27,-19],[25,-26]],
  ];
  for (const line of relief) {
    map.beginPath();
    line.forEach((point, index) => { const [x, y] = xy(point); index ? map.lineTo(x, y) : map.moveTo(x, y); });
    map.lineWidth = 7; map.strokeStyle = '#394c3750'; map.stroke();
    map.lineWidth = 2.5; map.strokeStyle = '#e5d39a84'; map.stroke();
  }
  map.restore();

  // Natural Earth range areas add geographic context without a third-party map service.
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
void main() {
  float cy = cos(uYaw), sy = sin(uYaw);
  vec3 aroundY = vec3(aPosition.x * cy - aPosition.z * sy, aPosition.y, aPosition.x * sy + aPosition.z * cy);
  float cp = cos(uPitch), sp = sin(uPitch);
  vec3 globe = vec3(aroundY.x, aroundY.y * cp - aroundY.z * sp, aroundY.y * sp + aroundY.z * cp);
  vUv = aUv;
  vNormal = globe;
  gl_Position = vec4(globe.x * uScale / uAspect, globe.y * uScale, 0.0, 1.0);
}`;

const fragmentSource = `
precision mediump float;
uniform sampler2D uMap;
varying vec2 vUv;
varying vec3 vNormal;
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
    makeTexture(mapData);
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
    this.uniforms = Object.fromEntries(['uYaw','uPitch','uScale','uAspect','uMap'].map(name => [name, gl.getUniformLocation(program, name)]));
    const texture = gl.createTexture();
    if (!texture) throw new Error('지구 지형을 표시하지 못했습니다.');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    // The sphere's v=0 row is the north pole, matching the canvas texture's top row.
    // Flipping here mirrors land north-to-south while city markers keep their real coordinates.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mapCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
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
