const vertexShader = `
precision mediump float;
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUv;
attribute float aData;
uniform mat4 uMvp;
uniform mat4 uModel;
uniform float uKind;
uniform float uTime;
varying vec3 vLocal;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
varying float vData;
float vertexHash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1,0.2,0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vertexNoise(vec3 p) {
  vec3 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  float a=mix(vertexHash(i),vertexHash(i+vec3(1.0,0.0,0.0)),f.x);
  float b=mix(vertexHash(i+vec3(0.0,1.0,0.0)),vertexHash(i+vec3(1.0,1.0,0.0)),f.x);
  float c=mix(vertexHash(i+vec3(0.0,0.0,1.0)),vertexHash(i+vec3(1.0,0.0,1.0)),f.x);
  float d=mix(vertexHash(i+vec3(0.0,1.0,1.0)),vertexHash(i+vec3(1.0,1.0,1.0)),f.x);
  return mix(mix(a,b,f.y),mix(c,d,f.y),f.z);
}
void main() {
  vec3 direction=normalize(aPosition);
  float height=0.0;
  if (uKind > 1.5 && uKind < 2.5) {
    float land= smoothstep(0.47,0.56,vertexNoise(direction*4.8+vec3(1.7,0.3,2.2)));
    float ridge=smoothstep(0.64,0.86,vertexNoise(direction*25.0+vec3(0.3,2.2,4.1)));
    height=land*(0.003+ridge*0.018);
  } else if (uKind > 2.5 && uKind < 3.5) {
    float relief=vertexNoise(direction*8.0);
    float mountain=1.0-smoothstep(0.02,0.28,distance(direction,normalize(vec3(-0.30,0.12,0.94))));
    float canyon=1.0-smoothstep(0.015,0.075,abs(aPosition.z+sin(aPosition.x*7.0+0.8)*0.18));
    height=(relief-0.5)*0.014+mountain*0.038-canyon*0.012;
  } else if (uKind < -3.5) {
    height=(vertexNoise(direction*12.0)-0.5)*0.008;
  } else if (uKind < -2.5) {
    height=(vertexNoise(direction*18.0)-0.5)*0.036;
  } else if (uKind < -1.5) {
    height=(vertexNoise(direction*12.0)-0.5)*0.018;
  } else if (uKind < -0.5) {
    float craters=vertexNoise(direction*16.0);
    height=(craters-0.5)*0.028;
  }
  vec4 local = vec4(aPosition*(1.0+height), 1.0);
  vec4 world = uModel * local;
  gl_Position = uMvp * local;
  vLocal = aPosition;
  vWorld = world.xyz;
  vNormal = normalize((uModel * vec4(aNormal, 0.0)).xyz);
  vUv = aUv;
  vData = aData;
}`;

const fragmentShader = `
precision mediump float;
uniform mat4 uModel;
uniform vec3 uColor;
uniform vec3 uLightDirection;
uniform vec3 uCameraPosition;
uniform vec3 uShadowCenters[4];
uniform float uShadowRadii[4];
uniform float uShadowCount;
uniform float uKind;
uniform float uRing;
uniform float uGlow;
uniform float uTime;
varying vec3 vLocal;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
varying float vData;
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise3(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(hash3(i), hash3(i + vec3(1.0,0.0,0.0)), f.x);
  float b = mix(hash3(i + vec3(0.0,1.0,0.0)), hash3(i + vec3(1.0,1.0,0.0)), f.x);
  float c = mix(hash3(i + vec3(0.0,0.0,1.0)), hash3(i + vec3(1.0,0.0,1.0)), f.x);
  float d = mix(hash3(i + vec3(0.0,1.0,1.0)), hash3(i + vec3(1.0,1.0,1.0)), f.x);
  return mix(mix(a,b,f.y),mix(c,d,f.y),f.z);
}
void main() {
  vec3 normal = normalize(vNormal);
  vec3 viewDirection = normalize(uCameraPosition - vWorld);
  if (uRing > 0.5) {
    float division = 1.0 - smoothstep(0.012, 0.04, abs(vData - 1.62));
    float rings = 0.5 + 0.5 * sin(vData * 175.0 + noise3(vLocal * 22.0) * 2.0);
    vec3 ringColor = mix(vec3(0.39,0.34,0.25), vec3(0.88,0.80,0.62), 0.35 + 0.55 * rings);
    ringColor = mix(ringColor, vec3(0.20,0.19,0.17), division * 0.88);
    float light = 0.42 + 0.58 * abs(dot(normal, normalize(uLightDirection)));
    float alpha = mix(0.78, 0.34, division) * (0.78 + 0.22 * rings);
    gl_FragColor = vec4(ringColor * light, alpha);
    return;
  }
  if (uGlow > 0.5) {
    float edge = pow(1.0 - abs(dot(normal, viewDirection)), 2.0);
    gl_FragColor = vec4(uColor, 0.025 + edge * 0.14);
    return;
  }
  vec3 base = uColor;
  vec3 emission = vec3(0.0);
  float broad = noise3(vLocal * 4.0);
  float fine = noise3(vLocal * 21.0);
  if (uKind < -3.5) {
    float haze = smoothstep(0.28,0.75,noise3(vLocal * 11.0 + vec3(uTime * 0.025,0.0,0.0)));
    float lake = smoothstep(0.61,0.77,noise3(vLocal * 7.0 + vec3(1.2,3.1,0.4)));
    base = mix(vec3(0.70,0.38,0.13),vec3(0.94,0.73,0.43),haze * 0.55);
    base = mix(base,vec3(0.15,0.19,0.20),lake * 0.66);
  } else if (uKind < -2.5) {
    float lavaFlow = noise3(vLocal * 13.0 + vec3(uTime * 0.03,1.0,0.0));
    float hotSpot = smoothstep(0.72,0.91,noise3(vLocal * 24.0 + vec3(3.0,0.2,1.0)));
    base = mix(vec3(0.78,0.48,0.13),vec3(0.30,0.18,0.10),smoothstep(0.3,0.72,lavaFlow));
    base = mix(base,vec3(1.0,0.72,0.22),hotSpot * 0.78);
    base = mix(base,vec3(0.18,0.15,0.13),smoothstep(0.58,0.78,noise3(vLocal * 8.0)) * 0.42);
  } else if (uKind < -1.5) {
    float iceNoise = noise3(vLocal * 12.0);
    float crack = 1.0 - smoothstep(0.025,0.095,abs(sin(vLocal.x * 43.0 + vLocal.z * 27.0 + noise3(vLocal * 8.0) * 6.0)));
    base = mix(vec3(0.28,0.58,0.68),vec3(0.86,0.94,0.93),smoothstep(0.28,0.74,iceNoise));
    base = mix(base,vec3(0.10,0.28,0.38),crack * 0.72);
  } else if (uKind < -0.5) {
    float craterField = noise3(vLocal * 15.0);
    float craterRim = 1.0 - smoothstep(0.018,0.085,abs(craterField - 0.54));
    float craterFloor = smoothstep(0.24,0.42,noise3(vLocal * 7.0 + vec3(2.1,0.4,1.2)));
    base *= 0.68 + 0.43 * broad;
    base = mix(base, vec3(0.27,0.29,0.32), craterFloor * 0.36);
    base = mix(base, vec3(0.88,0.83,0.73), craterRim * 0.24);
  } else if (uKind < 0.5) {
    float craterField = noise3(vLocal * 17.0);
    float craterRim = 1.0 - smoothstep(0.02,0.095,abs(craterField - 0.55));
    float basin = smoothstep(0.44,0.72,noise3(vLocal * 6.0 + vec3(2.7,0.3,1.4)));
    base *= 0.72 + 0.39 * broad;
    base = mix(base, vec3(0.38,0.39,0.40), basin * 0.35);
    base = mix(base, vec3(0.91,0.82,0.66), craterRim * 0.20);
  } else if (uKind < 1.5) {
    float cloudFlow = noise3(vLocal * 9.0 + vec3(uTime * 0.08,0.0,-uTime * 0.05));
    float cloud = 0.5 + 0.5 * sin(vLocal.y * 32.0 + sin(vLocal.x * 7.0 + vLocal.z * 4.0 + uTime * 0.12) * 2.1 + cloudFlow);
    float veil = smoothstep(0.34,0.78,noise3(vLocal * 18.0 + vec3(0.0,uTime * 0.06,0.0)));
    base = mix(base * 0.73, vec3(1.0,0.87,0.66), smoothstep(0.27,0.73,cloud) * 0.48);
    base = mix(base, vec3(0.92,0.76,0.53), veil * 0.22);
  } else if (uKind < 2.5) {
    float landMass = noise3(vLocal * 4.8 + vec3(1.7,0.3,2.2));
    float coastline = landMass + (noise3(vLocal * 15.0) - 0.5) * 0.11;
    float land = smoothstep(0.485,0.545,coastline);
    float relief = noise3(vLocal * 29.0 + vec3(2.3,1.1,4.0));
    vec3 ocean = mix(vec3(0.012,0.10,0.25),vec3(0.035,0.30,0.48),smoothstep(0.38,0.74,broad));
    vec3 continent = mix(vec3(0.11,0.30,0.16),vec3(0.47,0.40,0.22),smoothstep(0.42,0.76,relief));
    float mountainRidges = smoothstep(0.68,0.88,noise3(vLocal * 24.0 + vec3(0.3,2.2,4.1))) * land;
    continent = mix(continent,vec3(0.72,0.67,0.48),mountainRidges * 0.78);
    base = mix(ocean,continent,land);
    float clouds = smoothstep(0.61,0.79,noise3(vLocal * 17.0 + vec3(uTime * 0.045,1.0,-uTime * 0.025)));
    base = mix(base, vec3(0.86,0.95,1.0), clouds * 0.76);
    float iceCaps = smoothstep(0.84,0.96,abs(vLocal.y));
    base = mix(base, vec3(0.82,0.91,0.94), iceCaps * 0.92);
    float cityMask = smoothstep(0.77,0.91,noise3(vLocal * 37.0 + vec3(3.0,1.0,2.0))) * land;
    float nightSide = 1.0 - smoothstep(-0.16,0.24,dot(normal,normalize(uLightDirection)));
    emission = vec3(1.0,0.56,0.19) * cityMask * nightSide * 0.78;
  } else if (uKind < 3.5) {
    float terrain = noise3(vLocal * 7.0);
    vec3 olympus = normalize(vec3(-0.30,0.12,0.94));
    float volcanoDistance = distance(normalize(vLocal),olympus);
    float volcanoRings = 1.0 - smoothstep(0.025,0.075,abs(volcanoDistance - 0.16));
    float summit = 1.0 - smoothstep(0.015,0.06,volcanoDistance);
    float canyon = 1.0 - smoothstep(0.018,0.075,abs(vLocal.z + sin(vLocal.x * 7.0 + 0.8) * 0.18));
    base *= 0.68 + terrain * 0.48;
    base = mix(base, vec3(0.40,0.15,0.09), smoothstep(0.48,0.68,broad) * 0.46);
    base = mix(base, vec3(0.22,0.10,0.08), canyon * 0.38);
    base = mix(base, vec3(0.72,0.34,0.20), volcanoRings * 0.34);
    base = mix(base, vec3(0.91,0.73,0.52), summit * 0.38);
    base = mix(base, vec3(0.92,0.83,0.70), smoothstep(0.84,0.94,abs(vLocal.y)) * 0.9);
  } else if (uKind < 4.5 || uKind < 5.5) {
    float band = 0.5 + 0.5 * sin((vLocal.y * 29.0 + (broad - 0.5) * 0.38 + sin(vLocal.x * 7.0 + uTime * 0.07) * 0.045) * 3.14159);
    base = mix(uColor * 0.52, min(uColor * 1.42 + vec3(0.09,0.07,0.04), vec3(1.0)), smoothstep(0.23,0.77,band));
    if (uKind < 4.5) {
      vec3 stormPoint = normalize(vec3(0.34,0.18,0.92));
      float storm = 1.0 - smoothstep(0.10,0.22,distance(normalize(vLocal),stormPoint));
      float stormEye = 1.0 - smoothstep(0.025,0.065,distance(normalize(vLocal),stormPoint));
      base = mix(base, vec3(0.75,0.28,0.15), storm * 0.88);
      base = mix(base, vec3(0.96,0.68,0.45), storm * smoothstep(0.70,0.91,fine) * 0.48);
      base = mix(base, vec3(0.55,0.20,0.12), stormEye * 0.48);
    } else {
      float ringPlane = abs(normalize(vLocal).y);
      float ringShadow = 1.0 - smoothstep(0.035,0.13,ringPlane);
      base *= 1.0 - ringShadow * 0.35;
    }
  } else if (uKind < 6.5) {
    float band = 0.5 + 0.5 * sin((vLocal.y * 21.0 + (broad - 0.5) * 0.12) * 3.14159);
    base = mix(uColor * 0.72, min(uColor * 1.22 + vec3(0.08,0.06,0.02),vec3(1.0)), smoothstep(0.30,0.74,band));
  } else if (uKind < 7.5) {
    float band = 0.5 + 0.5 * sin((vLocal.y * 22.0 + (broad - 0.5) * 0.14) * 3.14159);
    base = mix(uColor * 0.73, min(uColor * 1.22 + vec3(0.05,0.09,0.1),vec3(1.0)), smoothstep(0.3,0.72,band));
  } else if (uKind < 8.5) {
    float band = 0.5 + 0.5 * sin((vLocal.y * 23.0 + (broad - 0.5) * 0.16) * 3.14159);
    base = mix(uColor * 0.65, min(uColor * 1.23 + vec3(0.02,0.07,0.14),vec3(1.0)), smoothstep(0.28,0.74,band));
    vec3 stormPoint = normalize(vec3(0.30,0.08,0.95));
    float storm = 1.0 - smoothstep(0.12,0.24,distance(normalize(vLocal),stormPoint));
    base = mix(base, vec3(0.08,0.16,0.38), storm * 0.78);
  } else if (uKind < 9.5) {
    float ice = smoothstep(0.46,0.7,broad);
    base = mix(uColor * 0.67, vec3(0.89,0.79,0.66), ice * 0.66);
    float heart = 1.0 - smoothstep(0.07,0.20,length(vLocal.xy - vec2(-0.05,-0.18)));
    base = mix(base, vec3(0.88,0.78,0.62), heart * 0.82);
  } else {
    float flame = noise3(vLocal * 14.0 + vec3(3.0,1.0,4.0));
    base = mix(vec3(1.0,0.28,0.035), vec3(1.0,0.83,0.28), smoothstep(0.28,0.72,flame));
    gl_FragColor = vec4(base,1.0);
    return;
  }
  float reliefStrength = uKind < -0.5 ? 0.58 : (uKind < 3.5 ? 0.34 : (uKind < 8.5 ? 0.07 : 0.02));
  vec3 localNormal = normalize(vLocal);
  vec3 terrainStep = vec3(0.012,0.0,0.0);
  float reliefX = noise3((localNormal + terrainStep) * 25.0) - noise3((localNormal - terrainStep) * 25.0);
  terrainStep = vec3(0.0,0.012,0.0);
  float reliefY = noise3((localNormal + terrainStep) * 25.0) - noise3((localNormal - terrainStep) * 25.0);
  terrainStep = vec3(0.0,0.0,0.012);
  float reliefZ = noise3((localNormal + terrainStep) * 25.0) - noise3((localNormal - terrainStep) * 25.0);
  vec3 reliefGradient = vec3(reliefX,reliefY,reliefZ);
  reliefGradient -= localNormal * dot(reliefGradient,localNormal);
  vec3 worldRelief = (uModel * vec4(reliefGradient,0.0)).xyz / max(length(uModel[0].xyz),0.0001);
  normal = normalize(normal - worldRelief * reliefStrength);
  float moonShadow = 0.0;
  for (int shadowIndex=0; shadowIndex<4; shadowIndex++) {
    if (float(shadowIndex) < uShadowCount) {
      float angularDistance = distance(localNormal,uShadowCenters[shadowIndex]);
      float shadowDisc = 1.0 - smoothstep(uShadowRadii[shadowIndex] * 0.68,uShadowRadii[shadowIndex] * 1.28,angularDistance);
      moonShadow = max(moonShadow,shadowDisc);
    }
  }
  float lightFacing = dot(normal,normalize(uLightDirection));
  float diffuse = max(lightFacing,0.0);
  float rim = pow(1.0 - max(dot(normal,viewDirection),0.0),3.0);
  float terminator = smoothstep(-0.14,0.24,lightFacing);
  vec3 lit = base * (0.10 + 0.90 * max(diffuse,terminator * 0.10));
  vec3 atmosphere = uKind > 1.5 && uKind < 2.5 ? vec3(0.10,0.56,0.96) : vec3(0.04,0.16,0.25);
  lit += atmosphere * rim * (uKind > 1.5 && uKind < 2.5 ? 0.42 : 0.18);
  lit = lit * (1.0 - moonShadow * 0.88) + emission * (1.0 - moonShadow * 0.88);
  gl_FragColor = vec4(lit,1.0);
}`;

const lineVertexShader = `attribute vec3 aPosition; uniform mat4 uViewProjection; void main(){ gl_Position=uViewProjection*vec4(aPosition,1.0); }`;
const lineFragmentShader = `precision mediump float; uniform vec4 uColor; void main(){ gl_FragColor=uColor; }`;
const pointVertexShader = `
attribute vec3 aPosition; attribute vec3 aColor; attribute float aSize;
uniform mat4 uViewProjection; uniform float uFocalPixels;
varying vec3 vColor;
void main(){ vec4 clip=uViewProjection*vec4(aPosition,1.0); gl_Position=clip; gl_PointSize=clamp(aSize*uFocalPixels/max(1.0,clip.w),1.0,7.0); vColor=aColor; }`;
const pointFragmentShader = `
precision mediump float; varying vec3 vColor;
void main(){ vec2 p=gl_PointCoord-vec2(0.5); float d=length(p); if(d>0.5) discard; float alpha=1.0-smoothstep(0.30,0.5,d); gl_FragColor=vec4(vColor,alpha); }`;

const orbitalElements = {
  mercury: { a: .38709927, aRate: .00000037, e: .20563593, eRate: .00001906, inclination: 7.00497902, inclinationRate: -.00594749, meanLongitude: 252.25032350, meanLongitudeRate: 149472.67411175, longitudePerihelion: 77.45779628, longitudePerihelionRate: .16047689, ascendingNode: 48.33076593, ascendingNodeRate: -.12534081 },
  venus: { a: .72333566, aRate: .00000390, e: .00677672, eRate: -.00004107, inclination: 3.39467605, inclinationRate: -.00078890, meanLongitude: 181.97909950, meanLongitudeRate: 58517.81538729, longitudePerihelion: 131.60246718, longitudePerihelionRate: .00268329, ascendingNode: 76.67984255, ascendingNodeRate: -.27769418 },
  earth: { a: 1.00000261, aRate: .00000562, e: .01671123, eRate: -.00004392, inclination: -.00001531, inclinationRate: -.01294668, meanLongitude: 100.46457166, meanLongitudeRate: 35999.37244981, longitudePerihelion: 102.93768193, longitudePerihelionRate: .32327364, ascendingNode: 0, ascendingNodeRate: 0 },
  mars: { a: 1.52371034, aRate: .00001847, e: .09339410, eRate: .00007882, inclination: 1.84969142, inclinationRate: -.00813131, meanLongitude: -4.55343205, meanLongitudeRate: 19140.30268499, longitudePerihelion: -23.94362959, longitudePerihelionRate: .44441088, ascendingNode: 49.55953891, ascendingNodeRate: -.29257343 },
  jupiter: { a: 5.20288700, aRate: -.00011607, e: .04838624, eRate: -.00013253, inclination: 1.30439695, inclinationRate: -.00183714, meanLongitude: 34.39644051, meanLongitudeRate: 3034.74612775, longitudePerihelion: 14.72847983, longitudePerihelionRate: .21252668, ascendingNode: 100.47390909, ascendingNodeRate: .20469106 },
  saturn: { a: 9.53667594, aRate: -.00125060, e: .05386179, eRate: -.00050991, inclination: 2.48599187, inclinationRate: .00193609, meanLongitude: 49.95424423, meanLongitudeRate: 1222.49362201, longitudePerihelion: 92.59887831, longitudePerihelionRate: -.41897216, ascendingNode: 113.66242448, ascendingNodeRate: -.28867794 },
  uranus: { a: 19.18916464, aRate: -.00196176, e: .04725744, eRate: -.00004397, inclination: .77263783, inclinationRate: -.00242939, meanLongitude: 313.23810451, meanLongitudeRate: 428.48202785, longitudePerihelion: 170.95427630, longitudePerihelionRate: .40805281, ascendingNode: 74.01692503, ascendingNodeRate: .04240589 },
  neptune: { a: 30.06992276, aRate: .00026291, e: .00859048, eRate: .00005105, inclination: 1.77004347, inclinationRate: .00035372, meanLongitude: -55.12002969, meanLongitudeRate: 218.45945325, longitudePerihelion: 44.96476227, longitudePerihelionRate: -.32241464, ascendingNode: 131.78422574, ascendingNodeRate: -.00508664 },
  pluto: { a: 39.48168677, e: .24880766, inclination: 17.14175, meanLongitude: 238.92881, longitudePerihelion: 224.06676, ascendingNode: 110.30347, periodDays: 90560 },
};
const axialTilts = { mercury: .034, venus: 3.096, earth: .409, mars: .440, jupiter: .054, saturn: .466, uranus: 1.706, neptune: .494, pluto: 2.09 };
const moonOrbitalPeriods = { moon: 27.3217, phobos: .31891, deimos: 1.26244, io: 1.7691, europa: 3.5512, ganymede: 7.1546, callisto: 16.689, titan: 15.945, enceladus: 1.370, titania: 8.706, miranda: 1.413, triton: 5.877, charon: 6.3872 };

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || '3D shader compilation failed';
    gl.deleteShader(shader); throw new Error(message);
  }
  return shader;
}
function program(gl, vertex, fragment, attributes) {
  const result = gl.createProgram();
  gl.attachShader(result, compile(gl, gl.VERTEX_SHADER, vertex));
  gl.attachShader(result, compile(gl, gl.FRAGMENT_SHADER, fragment));
  attributes.forEach((name,index) => gl.bindAttribLocation(result,index,name));
  gl.linkProgram(result);
  if (!gl.getProgramParameter(result,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result) || '3D program linking failed');
  return result;
}
function buffer(gl, values, target = gl.ARRAY_BUFFER) {
  const result=gl.createBuffer(); gl.bindBuffer(target,result); gl.bufferData(target,values,gl.STATIC_DRAW); return result;
}
function hexColor(hex) {
  const value=parseInt(hex.slice(1),16);
  return [((value>>16)&255)/255,((value>>8)&255)/255,(value&255)/255];
}
function clamp(value,min,max) { return Math.max(min,Math.min(max,value)); }
function normalize(v) { const n=Math.hypot(v[0],v[1],v[2])||1; return [v[0]/n,v[1]/n,v[2]/n]; }
function cross(a,b) { return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
function dot(a,b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function perspective(fovy,aspect,near,far) {
  const f=1/Math.tan(fovy/2), nf=1/(near-far);
  return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
}
function lookAt(eye,center,up=[0,1,0]) {
  const z=normalize([eye[0]-center[0],eye[1]-center[1],eye[2]-center[2]]);
  const x=normalize(cross(up,z)), y=cross(z,x);
  return new Float32Array([
    x[0],y[0],z[0],0, x[1],y[1],z[1],0, x[2],y[2],z[2],0,
    -dot(x,eye),-dot(y,eye),-dot(z,eye),1,
  ]);
}
function multiply(a,b) {
  const out=new Float32Array(16);
  for(let c=0;c<4;c++) for(let r=0;r<4;r++) out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
  return out;
}
function modelMatrix(position,scale,rotateY=0,rotateX=0,rotateZ=0) {
  const cy=Math.cos(rotateY),sy=Math.sin(rotateY),cx=Math.cos(rotateX),sx=Math.sin(rotateX),cz=Math.cos(rotateZ),sz=Math.sin(rotateZ);
  const r00=cz*cy, r01=cz*sy*sx-sz*cx, r02=cz*sy*cx+sz*sx;
  const r10=sz*cy, r11=sz*sy*sx+cz*cx, r12=sz*sy*cx-cz*sx;
  const r20=-sy, r21=cy*sx, r22=cy*cx;
  return new Float32Array([r00*scale,r10*scale,r20*scale,0, r01*scale,r11*scale,r21*scale,0, r02*scale,r12*scale,r22*scale,0, position[0],position[1],position[2],1]);
}
function transformPoint(matrix,point) {
  const [x,y,z]=point;
  const cx=matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12];
  const cy=matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13];
  const cz=matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14];
  const cw=matrix[3]*x+matrix[7]*y+matrix[11]*z+matrix[15];
  return {x:cx/cw,y:cy/cw,z:cz/cw,w:cw};
}
function sphereGeometry(gl) {
  const rows=56, columns=80, vertices=[],indices=[];
  for(let y=0;y<=rows;y++) {
    const v=y/rows, lat=Math.PI*v, py=Math.cos(lat), ring=Math.sin(lat);
    for(let x=0;x<=columns;x++) {
      const u=x/columns, theta=2*Math.PI*u, px=ring*Math.cos(theta), pz=ring*Math.sin(theta);
      vertices.push(px,py,pz,px,py,pz,u,1-v,0);
    }
  }
  for(let y=0;y<rows;y++) for(let x=0;x<columns;x++) {
    const a=y*(columns+1)+x,b=a+columns+1;
    indices.push(a,b,a+1,b,b+1,a+1);
  }
  return {vertices:buffer(gl,new Float32Array(vertices)),indices:buffer(gl,new Uint16Array(indices),gl.ELEMENT_ARRAY_BUFFER),count:indices.length};
}
function ringGeometry(gl) {
  const steps=220, rows=8, inner=1.18, outer=2.12, vertices=[],indices=[];
  for(let row=0;row<=rows;row++) {
    const t=row/rows, radius=inner+(outer-inner)*t;
    for(let i=0;i<=steps;i++) {
      const angle=i/steps*Math.PI*2,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
      vertices.push(x,0,z,0,1,0,i/steps,t,radius);
    }
  }
  for(let row=0;row<rows;row++) for(let i=0;i<steps;i++) {
    const a=row*(steps+1)+i,b=a+steps+1; indices.push(a,a+1,b,a+1,b+1,b);
  }
  return {vertices:buffer(gl,new Float32Array(vertices)),indices:buffer(gl,new Uint16Array(indices),gl.ELEMENT_ARRAY_BUFFER),count:indices.length};
}
function lineGeometry(gl,positions) { return {buffer:buffer(gl,new Float32Array(positions)),count:positions.length/3}; }
function pointGeometry(gl,points) {
  const data=[]; for(const point of points) data.push(...point.position,...point.color,point.size);
  return {buffer:buffer(gl,new Float32Array(data)),count:points.length};
}
function celestialPosition(longitude,latitude,radius=96) {
  const lon=longitude*Math.PI/180,lat=latitude*Math.PI/180,ring=Math.cos(lat);
  return [Math.sin(lon)*ring*radius,Math.sin(lat)*radius,Math.cos(lon)*ring*radius];
}
function makeCircle(radius,segments=192,plane='xz',inclination=0) {
  const points=[],ci=Math.cos(inclination),si=Math.sin(inclination);
  for(let i=0;i<=segments;i++) {
    const a=i/segments*Math.PI*2,c=Math.cos(a)*radius,s=Math.sin(a)*radius;
    let x=c,y=0,z=s;
    if(plane==='xy'){x=c;y=s;z=0;}
    if(plane==='yz'){x=0;y=c;z=s;}
    const ty=y*ci-z*si,tz=y*si+z*ci;
    points.push(x,ty,tz);
  }
  return points;
}
function seededRandom(seed) {
  let value=seed>>>0;
  return ()=>{ value=(value*1664525+1013904223)>>>0; return value/4294967296; };
}

export function createSolarSystem3D(canvas,planets) {
  const gl=canvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'high-performance'});
  if(!gl) throw new Error('이 브라우저에서 3D 그래픽을 시작할 수 없습니다.');
  const surfaceProgram=program(gl,vertexShader,fragmentShader,['aPosition','aNormal','aUv','aData']);
  const lineProgram=program(gl,lineVertexShader,lineFragmentShader,['aPosition']);
  const pointProgram=program(gl,pointVertexShader,pointFragmentShader,['aPosition','aColor','aSize']);
  const sphere=sphereGeometry(gl),ring=ringGeometry(gl);
  const random=seededRandom(20917);
  const stars=[];
  for(let i=0;i<2200;i++) {
    const vertical=random()*2-1,azimuth=random()*Math.PI*2,horizontal=Math.sqrt(1-vertical*vertical);
    const direction=[horizontal*Math.cos(azimuth),vertical,horizontal*Math.sin(azimuth)],distance=110+random()*90;
    const intensity=.48+random()*.52,warm=random()<.14;
    const color=warm?[.98*intensity,.78*intensity,.57*intensity]:[.58*intensity,.73*intensity,.98*intensity];
    stars.push({position:direction.map(value=>value*distance),color,size:.24+random()*.56});
  }
  const constellationPaths=[
    [[-70,48],[-52,60],[-34,48],[-15,56],[5,42]],
    [[-52,60],[-43,42],[-28,34],[-15,56]],
    [[-36,8],[-18,18],[0,11],[15,25],[30,12],[47,22]],
    [[-18,18],[-7,1],[8,-12],[22,-8],[30,12]],
    [[-8,65],[10,58],[27,68],[42,55],[58,61]],
    [[10,58],[16,39],[30,28],[42,55]],
    [[-66,-8],[-48,2],[-31,-6],[-18,-24],[1,-30],[16,-18]],
    [[-48,2],[-40,-20],[-18,-24]],
    [[38,-24],[52,-10],[70,-16],[78,-38],[58,-48],[42,-38],[38,-24]],
    [[-5,-50],[8,-38],[22,-48],[34,-66]],
    [[-84,24],[-69,8],[-56,19],[-46,2]],
    [[72,34],[88,17],[102,26],[113,8],[128,17]],
  ];
  const constellationLines=constellationPaths.map(path=>lineGeometry(gl,path.flatMap(([longitude,latitude])=>celestialPosition(longitude,latitude))));
  const constellationStars=pointGeometry(gl,constellationPaths.flat().map(([longitude,latitude])=>({
    position:celestialPosition(longitude,latitude),color:[.4,.72,1],size:.9+random()*.35,
  })));
  const asteroidPoints=[];
  for(let i=0;i<1150;i++) {
    const angle=random()*Math.PI*2,au=2.15+random()*1.15,radius=.17+Math.sqrt(au)*.68;
    asteroidPoints.push({position:[Math.cos(angle)*radius,(random()-.5)*.12,Math.sin(angle)*radius],color:[.42+random()*.24,.43+random()*.22,.45+random()*.2],size:.018+random()*.028});
  }
  const kuiperPoints=[];
  for(let i=0;i<520;i++) {
    const angle=random()*Math.PI*2,au=31+random()*21,radius=.17+Math.sqrt(au)*.68;
    kuiperPoints.push({position:[Math.cos(angle)*radius,(random()-.5)*.12,Math.sin(angle)*radius],color:[.37+random()*.2,.61+random()*.19,.72+random()*.18],size:.016+random()*.026});
  }
  const starBuffer=pointGeometry(gl,stars),asteroidBuffer=pointGeometry(gl,asteroidPoints),kuiperBuffer=pointGeometry(gl,kuiperPoints);
  const gridPositions=[];
  for(let i=-18;i<=18;i++) {
    const p=i*.65; gridPositions.push(-12,-.08,p,12,-.08,p,p,-.08,-12,p,-.08,12);
  }
  const grid=lineGeometry(gl,gridPositions);
  const orbitBuffers=new Map(planets.map(planet=>[planet.id,orbitGeometry(gl,planet)]));
  const moonOrbitBuffers=new Map();
  for(const planet of planets) {
    const moons=planet.moons||[],max=Math.max(1,...moons.map(moon=>moon.orbitKm));
    for(const moon of moons) {
      const radius=.66+Math.sqrt(moon.orbitKm/max)*.44;
      moonOrbitBuffers.set(`${planet.id}:${moon.id}`,lineGeometry(gl,makeCircle(radius,120,'xz',.16)));
    }
  }
  const heliopauseLines=['xz','xy','yz'].map(plane=>lineGeometry(gl,makeCircle(8.1,200,plane,.16)));
  const oortLines=['xz','xy','yz'].map(plane=>lineGeometry(gl,makeCircle(18.5,240,plane,.2)));
  const locations=new Map(planets.map(planet=>[planet.id,planet]));
  const state={progress:0,rotation:-.22,tilt:.68,focusedPlanetId:'',focusZoom:1,systemZoom:1,orbitPaused:false,orbitSpeed:1,julianDay:2451545,time:0};
  let frameTimestamp=null,simulationTime=0;
  let projection=new Float32Array(16),view=new Float32Array(16),viewProjection=new Float32Array(16),skyViewProjection=new Float32Array(16),camera=[0,0,10],cssWidth=1,cssHeight=1,pixelRatio=1;

  const surfaceLocations={attributes:{aPosition:0,aNormal:1,aUv:2,aData:3}};
  const pointLocations={attributes:{aPosition:0,aColor:1,aSize:2}};
  function location(programObject,name) { return gl.getUniformLocation(programObject,name); }
  const surfaceUniforms=Object.fromEntries(['uMvp','uModel','uColor','uLightDirection','uCameraPosition','uShadowCenters[0]','uShadowRadii[0]','uShadowCount','uKind','uRing','uGlow','uTime'].map(name=>[name,location(surfaceProgram,name)]));
  const shadowCentersValue=new Float32Array(12),shadowRadiiValue=new Float32Array(4);
  const lineUniforms=Object.fromEntries(['uViewProjection','uColor'].map(name=>[name,location(lineProgram,name)]));
  const pointUniforms=Object.fromEntries(['uViewProjection','uFocalPixels'].map(name=>[name,location(pointProgram,name)]));
  function resize() {
    const rect=canvas.getBoundingClientRect(); cssWidth=Math.max(1,rect.width); cssHeight=Math.max(1,rect.height); pixelRatio=Math.min(2,window.devicePixelRatio||1);
    const w=Math.round(cssWidth*pixelRatio),h=Math.round(cssHeight*pixelRatio);
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    gl.viewport(0,0,w,h);
  }
  function bindMesh(mesh,programObject,attrs) {
    gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vertices);
    const stride=9*4;
    for(const [name,index,size,offset] of [['aPosition',attrs.aPosition,3,0],['aNormal',attrs.aNormal,3,3],['aUv',attrs.aUv,2,6],['aData',attrs.aData,1,8]]) {
      if(index<0) continue;
      gl.enableVertexAttribArray(index); gl.vertexAttribPointer(index,size,gl.FLOAT,false,stride,offset*4);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.indices);
  }
  function setSurfaceUniforms(model,color,kind,light,glow=0,ringMode=0,shadows=[]) {
    const mvp=multiply(viewProjection,model);
    gl.uniformMatrix4fv(surfaceUniforms.uMvp,false,mvp);
    gl.uniformMatrix4fv(surfaceUniforms.uModel,false,model);
    gl.uniform3fv(surfaceUniforms.uColor,color);
    gl.uniform3fv(surfaceUniforms.uLightDirection,normalize(light));
    gl.uniform3fv(surfaceUniforms.uCameraPosition,camera);
    shadowCentersValue.fill(0); shadowRadiiValue.fill(0);
    const visibleShadows=shadows.slice(0,4);
    visibleShadows.forEach((shadow,index)=>{
      shadowCentersValue.set(shadow.center,index*3);
      shadowRadiiValue[index]=shadow.radius;
    });
    gl.uniform3fv(surfaceUniforms['uShadowCenters[0]'],shadowCentersValue);
    gl.uniform1fv(surfaceUniforms['uShadowRadii[0]'],shadowRadiiValue);
    gl.uniform1f(surfaceUniforms.uShadowCount,visibleShadows.length);
    gl.uniform1f(surfaceUniforms.uKind,kind);
    gl.uniform1f(surfaceUniforms.uRing,ringMode);
    gl.uniform1f(surfaceUniforms.uGlow,glow);
    gl.uniform1f(surfaceUniforms.uTime,state.time*.0001);
  }
  function drawSphere(position,radius,color,kind,light,rotationY=0,glow=0,rotationX=0,rotationZ=0,shadows=[]) {
    const model=modelMatrix(position,radius,rotationY,rotationX,rotationZ);
    gl.useProgram(surfaceProgram); bindMesh(sphere,surfaceProgram,surfaceLocations.attributes);
    setSurfaceUniforms(model,color,kind,light,glow,0,shadows);
    gl.drawElements(gl.TRIANGLES,sphere.count,gl.UNSIGNED_SHORT,0);
  }
  function drawRing(position,radius,rotationY=0,light=[.3,.8,.2]) {
    const model=modelMatrix(position,radius,rotationY,.46,-.08);
    gl.useProgram(surfaceProgram); bindMesh(ring,surfaceProgram,surfaceLocations.attributes);
    setSurfaceUniforms(model,[.76,.66,.47],5,light,0,1);
    gl.drawElements(gl.TRIANGLES,ring.count,gl.UNSIGNED_SHORT,0);
  }
  function drawLines(geometry,color,mode=gl.LINE_STRIP,matrix=viewProjection) {
    gl.useProgram(lineProgram); gl.bindBuffer(gl.ARRAY_BUFFER,geometry.buffer);
    const attr=gl.getAttribLocation(lineProgram,'aPosition'); gl.enableVertexAttribArray(attr); gl.vertexAttribPointer(attr,3,gl.FLOAT,false,0,0);
    gl.uniformMatrix4fv(lineUniforms.uViewProjection,false,matrix); gl.uniform4fv(lineUniforms.uColor,color);
    gl.drawArrays(mode,0,geometry.count);
  }
  function drawPoints(geometry,pointScale=1,matrix=viewProjection) {
    gl.useProgram(pointProgram); gl.bindBuffer(gl.ARRAY_BUFFER,geometry.buffer);
    const stride=7*4;
    for(const [name,size,offset] of [['aPosition',3,0],['aColor',3,3],['aSize',1,6]]) {
      const attr=gl.getAttribLocation(pointProgram,name); gl.enableVertexAttribArray(attr); gl.vertexAttribPointer(attr,size,gl.FLOAT,false,stride,offset*4);
    }
    gl.uniformMatrix4fv(pointUniforms.uViewProjection,false,matrix);
    gl.uniform1f(pointUniforms.uFocalPixels,cssHeight*.5/Math.tan(Math.PI*27.5/180)*pointScale);
    gl.drawArrays(gl.POINTS,0,geometry.count);
  }
  function radiusFor(planet) { return .045+Math.sqrt(planet.diameterKm/139820)*.17; }
  function orbitRadius(au) { return .17+Math.sqrt(au)*.68; }
  function orbitalElementsAt(planet,julianDay) {
    const base=orbitalElements[planet.id]||{},centuries=(julianDay-2451545.0)/36525;
    if(planet.id==='pluto') {
      const meanAnomaly=((base.meanLongitude-base.longitudePerihelion)*Math.PI/180)+(julianDay-2451545.0)*Math.PI*2/base.periodDays;
      return {...base,meanAnomaly};
    }
    const longitudePerihelion=base.longitudePerihelion+base.longitudePerihelionRate*centuries;
    const meanLongitude=base.meanLongitude+base.meanLongitudeRate*centuries;
    const meanDegrees=((meanLongitude-longitudePerihelion)%360+360)%360;
    return {
      a:base.a+base.aRate*centuries,
      e:Math.max(0,Math.min(.99,base.e+base.eRate*centuries)),
      inclination:base.inclination+base.inclinationRate*centuries,
      longitudePerihelion,
      ascendingNode:base.ascendingNode+base.ascendingNodeRate*centuries,
      meanAnomaly:meanDegrees*Math.PI/180,
    };
  }
  function orbitalCoordinates(planet,eccentricAnomaly,elements=orbitalElementsAt(planet,2451545.0)) {
    const eccentricity=elements.e;
    const inclination=elements.inclination*Math.PI/180,node=elements.ascendingNode*Math.PI/180;
    const perihelion=elements.longitudePerihelion*Math.PI/180,argument=perihelion-node;
    const semiMajor=orbitRadius(elements.a),xPrime=semiMajor*(Math.cos(eccentricAnomaly)-eccentricity);
    const yPrime=semiMajor*Math.sqrt(1-eccentricity*eccentricity)*Math.sin(eccentricAnomaly);
    const cO=Math.cos(node),sO=Math.sin(node),ci=Math.cos(inclination),si=Math.sin(inclination),cw=Math.cos(argument),sw=Math.sin(argument);
    const x=(cw*cO-sw*sO*ci)*xPrime+(-sw*cO-cw*sO*ci)*yPrime;
    const eclipticY=(cw*sO+sw*cO*ci)*xPrime+(-sw*sO+cw*cO*ci)*yPrime;
    const eclipticZ=sw*si*xPrime+cw*si*yPrime;
    return [x,eclipticZ,eclipticY];
  }
  function solveEccentricAnomaly(meanAnomaly,eccentricity) {
    let estimate=meanAnomaly;
    for(let iteration=0;iteration<5;iteration++) {
      estimate-=(estimate-eccentricity*Math.sin(estimate)-meanAnomaly)/(1-eccentricity*Math.cos(estimate));
    }
    return estimate;
  }
  function orbitGeometry(glContext,planet) {
    const positions=[],elements=orbitalElementsAt(planet,2451545.0);
    for(let index=0;index<=240;index++) positions.push(...orbitalCoordinates(planet,index/240*Math.PI*2,elements));
    return lineGeometry(glContext,positions);
  }
  function axialTilt(planet) { return axialTilts[planet.id]||0; }
  function planetPosition(planet,julianDay) {
    const elements=orbitalElementsAt(planet,julianDay);
    return orbitalCoordinates(planet,solveEccentricAnomaly(elements.meanAnomaly,elements.e),elements);
  }
  function moonPosition(planet,moon,julianDay) {
    const max=Math.max(...planet.moons.map(item=>item.orbitKm)),radius=.66+Math.sqrt(moon.orbitKm/max)*.44;
    const orbitalPeriod=moonOrbitalPeriods[moon.id]||365.25;
    const angle=moon.phase+(julianDay-2451545.0)*Math.PI*2/orbitalPeriod;
    return [Math.cos(angle)*radius,Math.sin(angle)*radius*.16,Math.sin(angle)*radius*.76];
  }
  function inverseRotate(vector,spin,tiltX,tiltZ) {
    const cz=Math.cos(tiltZ),sz=Math.sin(tiltZ),cy=Math.cos(spin),sy=Math.sin(spin),cx=Math.cos(tiltX),sx=Math.sin(tiltX);
    const x1=cz*vector[0]+sz*vector[1],y1=-sz*vector[0]+cz*vector[1],z1=vector[2];
    const x2=cy*x1-sy*z1,y2=y1,z2=sy*x1+cy*z1;
    return normalize([x2,cx*y2+sx*z2,-sx*y2+cx*z2]);
  }
  function moonRadiusFor(planet,moon,planetRadius) {
    return Math.max(.012,planetRadius*moon.diameterKm/planet.diameterKm*.82);
  }
  function moonShadowCenters(planet,julianDay,planetRadius,sunlight,spin,tiltX,tiltZ) {
    const sunDirection=normalize(sunlight);
    return (planet.moons||[]).slice(0,4).flatMap(moon=>{
      const moonCenter=moonPosition(planet,moon,julianDay),along=dot(moonCenter,sunDirection);
      if(along<=0) return [];
      const distanceSquared=dot(moonCenter,moonCenter),intersection=along*along-(distanceSquared-planetRadius*planetRadius);
      if(intersection<=0) return [];
      const distanceToSurface=along-Math.sqrt(intersection),surfacePoint=moonCenter.map((value,index)=>value-sunDirection[index]*distanceToSurface);
      const center=inverseRotate(normalize(surfacePoint),spin,tiltX,tiltZ);
      const physicalRadius=moon.diameterKm/planet.diameterKm*planetRadius*.5;
      const angularRadius=clamp(Math.asin(Math.min(.95,physicalRadius/planetRadius)),.025,.19);
      return [{center,radius:angularRadius}];
    });
  }
  function stageCameraDistance(progress) {
    if(progress<20) return 9.5;
    if(progress<50) return 14;
    if(progress<84) return 30;
    return 61;
  }
  function frameMatrices() {
    const focused=locations.get(state.focusedPlanetId);
    const target=focused?[0,0,0]:[0,0,0];
    const focusReferenceRadius=radiusFor(locations.get('jupiter'));
    const distance=focused?2.55*radiusFor(focused)/focusReferenceRadius/state.focusZoom:stageCameraDistance(state.progress)/state.systemZoom;
    const pitch=focused?state.tilt:state.tilt;
    camera=[target[0]+Math.sin(state.rotation)*Math.cos(pitch)*distance,target[1]+Math.sin(pitch)*distance,target[2]+Math.cos(state.rotation)*Math.cos(pitch)*distance];
    projection=perspective(Math.PI*55/180,cssWidth/cssHeight,.08,280);
    view=lookAt(camera,target);
    viewProjection=multiply(projection,view);
    const skyView=new Float32Array(view);
    skyView[12]=0; skyView[13]=0; skyView[14]=0;
    skyViewProjection=multiply(projection,skyView);
  }
  function drawBoundary(lines,color) { for(const line of lines) drawLines(line,color); }
  function render(time,renderState={}) {
    resize();
    const delta=frameTimestamp===null?0:Math.min(100,Math.max(0,time-frameTimestamp));
    frameTimestamp=time;
    Object.assign(state,renderState);
    if(!state.orbitPaused) simulationTime+=delta*state.orbitSpeed;
    state.time=simulationTime;
    frameMatrices();
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(.006,.012,.022,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.depthMask(false); drawPoints(starBuffer,.8,skyViewProjection); gl.depthMask(true);
    for(const line of constellationLines) drawLines(line,[.08,.43,.72,.52],gl.LINE_STRIP,skyViewProjection);
    gl.depthMask(false); drawPoints(constellationStars,1.4,skyViewProjection); gl.depthMask(true);
    if(!state.focusedPlanetId) {
      drawLines(grid,[.07,.2,.29,.2],gl.LINES);
      for(const planet of planets) drawLines(orbitBuffers.get(planet.id),[.23,.44,.62,.36]);
      drawPoints(asteroidBuffer,1.0);
      if(state.progress>12) drawPoints(kuiperBuffer,1.0);
      if(state.progress>48) drawBoundary(heliopauseLines,[.22,.75,.76,.28]);
      if(state.progress>78) drawBoundary(oortLines,[.56,.69,.86,.2]);
      gl.depthMask(false); drawSphere([0,0,0],.58,[1,.39,.09],10,[0,1,0],simulationTime*.00008,1); gl.depthMask(true);
      drawSphere([0,0,0],.44,[1,.66,.19],10,[0,1,0],simulationTime*.00008,0);
      for(const planet of planets) {
        const pos=planetPosition(planet,state.julianDay),radius=radiusFor(planet),kind=kindFor(planet.id),light=[-pos[0],-pos[1],-pos[2]];
        const spin=simulationTime*.00004/(planet.period||1),tilt=axialTilt(planet),tiltZ=planet.id==='saturn'?-.08:0;
        drawSphere(pos,radius,hexColor(planet.color),kind,light,spin,0,tilt,tiltZ);
        if(planet.id==='saturn') { gl.depthMask(false); drawRing(pos,radius,spin,light); gl.depthMask(true); }
      }
    } else {
      const planet=locations.get(state.focusedPlanetId); if(!planet) return;
      const radius=radiusFor(planet),kind=kindFor(planet.id);
      const systemPosition=planetPosition(planet,state.julianDay),sunlight=[-systemPosition[0],-systemPosition[1],-systemPosition[2]];
      const spin=simulationTime*.00004,tilt=axialTilt(planet),tiltZ=planet.id==='saturn'?-.08:0;
      const shadows=moonShadowCenters(planet,state.julianDay,radius,sunlight,spin,tilt,tiltZ);
      drawSphere([0,0,0],radius,hexColor(planet.color),kind,sunlight,spin,0,tilt,tiltZ,shadows);
      if(planet.id==='saturn') { gl.depthMask(false); drawRing([0,0,0],radius,spin,sunlight); gl.depthMask(true); }
      const moons=planet.moons||[];
      for(const moon of moons) {
        const orbitLine=moonOrbitBuffers.get(`${planet.id}:${moon.id}`);
        if(orbitLine) drawLines(orbitLine,[.48,.66,.82,.28]);
        const pos=moonPosition(planet,moon,state.julianDay),moonRadius=moonRadiusFor(planet,moon,radius);
        drawSphere(pos,moonRadius,[.78,.84,.91],moonKindFor(moon.id),sunlight,simulationTime*.0001);
      }
    }
  }
  function project(position,radius=0) {
    const point=transformPoint(viewProjection,position);
    if(point.w<=0) return {visible:false,x:0,y:0,radius:0};
    const x=(point.x*.5+.5)*cssWidth,y=(.5-point.y*.5)*cssHeight;
    const edge=transformPoint(viewProjection,[position[0]+radius,position[1],position[2]]);
    const projectedRadius=Math.abs(edge.x-point.x)*cssWidth*.5;
    return {visible:point.z>-1.2&&point.z<1.2,x,y,radius:projectedRadius};
  }
  function projectPlanet(id) {
    const planet=locations.get(id); if(!planet) return {visible:false};
    const position=state.focusedPlanetId?[0,0,0]:planetPosition(planet,state.julianDay);
    return project(position,radiusFor(planet));
  }
  function projectWorld(position,radius=0) { return project(position,radius); }
  function projectSun() { return project([0,0,0],.44); }
  function projectMoon(planet,moon) {
    if(state.focusedPlanetId!==planet.id) return {visible:false};
    return project(moonPosition(planet,moon,state.julianDay),moonRadiusFor(planet,moon,radiusFor(planet)));
  }
  function kindFor(id) { return ({mercury:0,venus:1,earth:2,mars:3,jupiter:4,saturn:5,uranus:6,neptune:7,pluto:8})[id]??0; }
  function moonKindFor(id) {
    if(id==='titan') return -4;
    if(id==='io') return -3;
    if(['europa','ganymede','callisto','enceladus','titania','miranda','triton','charon'].includes(id)) return -2;
    return -1;
  }
  resize();
  return {render,projectPlanet,projectMoon,projectWorld,projectSun,resize};
}
