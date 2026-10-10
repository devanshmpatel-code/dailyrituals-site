// A more realistic sky for the home opening, drawn on the graphics card (WebGL):
//  - sky colour from the sun's real height for today's date (scattering-style: blue overhead, warm near the horizon at low sun)
//  - soft drifting clouds lit by the sun (pink at dawn, gold at sunset, moonlit at night)
//  - sunbeams through the clouds when the sun is low
//  - stars and a faint Milky Way at night, and the moon in tonight's real phase
//  - a lake along the bottom that mirrors the sky (the mountains above it are mirrored with CSS)
// Sits behind the existing mountain canvases. If WebGL is not available nothing changes. With reduced motion it draws still frames.

const LAT = 49.28;           // Vancouver: the sun's height is worked out for the business's own sky
const SOLAR_NOON = 13.2;     // local clock hour of solar noon, roughly, in daylight time (MEDIUM: approximation, no equation of time)
const SYNODIC = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14); // a known new moon

/** 0 = new moon, 0.5 = full moon. */
export function moonPhase(d = new Date()) {
  const days = (d.getTime() - NEW_MOON_REF) / 86400000;
  return ((days / SYNODIC) % 1 + 1) % 1;
}

/** sin(solar elevation) for a clock hour today, at the business's latitude. */
export function sunElevation(hour: number, d = new Date()) {
  const start = Date.UTC(d.getFullYear(), 0, 0);
  const n = Math.floor((d.getTime() - start) / 86400000);
  const decl = (23.44 * Math.PI / 180) * Math.sin(2 * Math.PI * (284 + n) / 365);
  const phi = LAT * Math.PI / 180;
  const ha = (15 * (hour - SOLAR_NOON)) * Math.PI / 180;
  return Math.sin(phi) * Math.sin(decl) + Math.cos(phi) * Math.cos(decl) * Math.cos(ha);
}

const VS = `attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `precision highp float;
varying vec2 v;
uniform vec2 uRes, uSun;
uniform float uTime, uElev, uNight, uCloud, uPhase, uLake;
uniform vec3 uP0, uP1, uP2, uOrb;
float hash(vec2 q){ q = fract(q * vec2(123.34, 456.21)); q += dot(q, q + 45.32); return fract(q.x * q.y); }
float noise(vec2 q){ vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 q){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * noise(q); q = q * 2.03 + 17.1; a *= 0.5; } return s; }

vec3 sky(vec2 uv, out float cloudOut){
  float asp = uRes.x / uRes.y;
  float h = clamp((uv.y - uLake) / (1.0 - uLake), 0.0, 1.0);
  float e = uElev;
  float day = smoothstep(-0.04, 0.35, e);
  float low = (1.0 - smoothstep(0.04, 0.42, e)) * smoothstep(-0.22, 0.0, e);
  float lit = smoothstep(-0.3, 0.02, e);
  vec3 zen = mix(vec3(0.016, 0.02, 0.06), mix(vec3(0.24, 0.22, 0.46), vec3(0.17, 0.39, 0.74), day), lit);
  vec3 hor = mix(vec3(0.06, 0.05, 0.13), mix(vec3(1.0, 0.56, 0.30), vec3(0.72, 0.84, 0.93), day), lit);
  vec3 col = mix(hor, zen, pow(h, 0.55));
  float dx = uv.x - uSun.x;
  float side = exp(-dx * dx * 2.2);
  col += low * side * vec3(0.95, 0.40, 0.16) * pow(1.0 - h, 1.6) * 0.95;
  col += low * vec3(0.55, 0.25, 0.45) * smoothstep(0.3, 1.0, h) * 0.25;
  vec3 pal = mix(uP2, mix(uP1, uP0, smoothstep(0.45, 1.0, h)), smoothstep(0.0, 0.45, h));
  col = mix(col, pal, 0.2);

  vec2 a = vec2(uv.x * asp, uv.y), s = vec2(uSun.x * asp, uSun.y);
  float d = distance(a, s);
  float above = smoothstep(uLake - 0.02, uLake + 0.04, uSun.y);
  // clouds
  vec2 cq = vec2(uv.x * asp * 1.4 + uTime * 0.006, h * 3.2 + uTime * 0.0015);
  float n = fbm(cq * 1.7) + 0.35 * fbm(cq * 4.0 - uTime * 0.01);
  float c = smoothstep(1.02 - uCloud, 1.32 - uCloud, n) * smoothstep(0.04, 0.3, h) * (1.0 - smoothstep(0.8, 1.0, h));
  float under = fbm(cq * 1.7 + vec2(0.0, 0.22));
  vec3 cDay = mix(vec3(0.55, 0.55, 0.64), vec3(1.0, 0.99, 0.97), day) * (0.78 + 0.22 * (1.0 - under));
  vec3 cLow = mix(vec3(1.0, 0.55, 0.42), vec3(1.0, 0.78, 0.55), side) * (0.65 + 0.35 * side);
  vec3 cNight = vec3(0.10, 0.10, 0.17) + uNight * vec3(0.05, 0.05, 0.08) * step(0.3, abs(uPhase - 0.5));
  vec3 cc = mix(cNight, mix(cDay, cLow, low), lit);
  col = mix(col, cc, c * 0.92);
  cloudOut = c;
  // sun: glow, disc, sunbeams
  float sv = smoothstep(-0.06, 0.02, e) * above;
  col += uOrb * (exp(-d * 8.0) * 0.28 + exp(-d * 34.0) * 0.45) * sv * (1.0 - uNight);
  col = mix(col, vec3(1.0, 0.97, 0.9), smoothstep(0.034, 0.03, d) * sv * (1.0 - uNight) * (1.0 - c * 0.85));
  float ang = atan(a.y - s.y, a.x - s.x);
  float lowSun = 1.0 - smoothstep(0.02, 0.16, e);
  float rays = pow(noise(vec2(ang * 14.0, uTime * 0.04)), 3.0) * exp(-d * 2.2) * low * lowSun * (1.0 - c) * above;
  col += uOrb * rays * 0.36;
  // night: stars, Milky Way, moon
  float nt = uNight * (1.0 - c);
  vec2 sp = vec2(uv.x * asp, uv.y) * 90.0;
  vec2 g = floor(sp), f = fract(sp);
  float r = hash(g);
  vec2 at = vec2(hash(g + 3.1), hash(g + 7.7));
  float sd = length(f - at);
  float tw = 0.65 + 0.35 * sin(uTime * 1.7 + r * 60.0);
  float star = step(0.93, r) * smoothstep(0.09 * (0.6 + r), 0.0, sd) * (0.5 + 0.5 * hash(g + 1.3));
  col += star * tw * nt * smoothstep(0.05, 0.25, h) * vec3(0.92, 0.94, 1.0) * 1.4;
  float band = exp(-pow(uv.y - 0.42 - (uv.x - 0.5) * 0.55, 2.0) * 38.0);
  col += band * fbm(uv * vec2(asp, 1.0) * 5.0) * nt * 0.16 * vec3(0.72, 0.76, 1.0);
  float mr = 0.042;
  float md = d / mr;
  if (md < 1.0 && uNight > 0.02) {
    vec2 pq = (a - s) / mr;
    vec3 nrm = vec3(pq, sqrt(max(0.0, 1.0 - dot(pq, pq))));
    float th = uPhase * 6.2831853;
    vec3 L = vec3(sin(th), 0.0, -cos(th));
    float litm = smoothstep(-0.06, 0.06, dot(nrm, L));
    float crater = 0.85 + 0.15 * fbm(pq * 3.0 + 7.0);
    vec3 mc = mix(vec3(0.05, 0.05, 0.08), vec3(0.96, 0.93, 0.86) * crater, litm);
    col = mix(col, mc, smoothstep(1.0, 0.96, md) * uNight * (1.0 - c * 0.7));
  }
  float bright = 0.5 - 0.5 * cos(uPhase * 6.2831853);
  col += vec3(0.8, 0.82, 0.95) * exp(-d * 9.0) * 0.22 * bright * uNight * above;
  return col;
}

void main(){
  vec2 uv = v;
  float c;
  vec3 col;
  if (uv.y >= uLake) {
    col = sky(uv, c);
  } else {
    float k = 1.0 - uv.y / max(uLake, 0.001);
    float rip = (noise(vec2(uv.x * 46.0, uv.y * 320.0 - uTime * 0.8)) - 0.5) * 0.012 * (0.3 + k);
    vec2 m = vec2(uv.x + rip, uLake + (uLake - uv.y) * 1.6);
    col = sky(m, c) * mix(vec3(0.66, 0.73, 0.8), vec3(0.42, 0.5, 0.58), k);
    float dx = uv.x - uSun.x;
    float glint = exp(-dx * dx * 60.0) * pow(noise(vec2(uv.x * 90.0, uv.y * 420.0 - uTime * 1.4)), 5.0);
    col += uOrb * glint * (1.0 - uNight * 0.6) * smoothstep(-0.05, 0.05, uElev + uNight) * 1.6;
    col = mix(col, col * 0.75, smoothstep(0.0, 1.0, k));
  }
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

export interface SkyState { hour: number; night: number; pal: [string, string, string]; orb: [number, number, number]; sunX: number; sunY: number }

interface Sky { set(s: Partial<SkyState>): void; destroy(): void; light(): boolean }
let current: Sky | null = null;

const hex = (h: string) => { const m = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(m.slice(i, i + 2), 16) / 255) as [number, number, number]; };
const parseColor = (c: string): [number, number, number] => {
  if (c.startsWith('#')) return hex(c);
  const m = c.match(/[\d.]+/g); return m ? [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255] : [1, 1, 1];
};

/** Is the sky behind the hero words dark enough that the words should be light? (Same model as the shader, without clouds.) */
export function skyIsDark(hour: number, night: number) {
  const e = sunElevation(hour);
  const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const day = sm(-0.04, 0.35, e), lit = sm(-0.3, 0.02, e);
  const mix = (a: number[], b: number[], t: number) => a.map((x, i) => x + (b[i] - x) * t);
  const zen = mix([0.016, 0.02, 0.06], mix([0.24, 0.22, 0.46], [0.17, 0.39, 0.74], day), lit);
  const hor = mix([0.06, 0.05, 0.13], mix([1.0, 0.56, 0.30], [0.72, 0.84, 0.93], day), lit);
  const col = mix(hor, zen, Math.pow(0.62, 0.55));
  const lum = 0.2126 * col[0] + 0.7152 * col[1] + 0.0722 * col[2];
  return night >= 0.5 || lum < 0.3;
}

export function getSky() { return current; }

export function mountSky(scene: HTMLElement, lakeFraction: number): Sky | null {
  current?.destroy(); current = null;
  const canvas = document.createElement('canvas');
  canvas.className = 'glsky'; canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }) as WebGLRenderingContext | null;
  if (!gl) return null;
  // without a graphics chip the browser would draw this on the CPU, which is slow and drains batteries: keep the simpler sky
  // (?sky=gl forces it on, for testing)
  const force = new URLSearchParams(location.search).get('sky') === 'gl';
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = String(dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
  if (!force && /swiftshader|llvmpipe|software|basic render/i.test(renderer)) { gl.getExtension('WEBGL_lose_context')?.loseContext(); return null; }
  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!; gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n: string) => gl.getUniformLocation(prog, n);
  const u = { res: U('uRes'), sun: U('uSun'), time: U('uTime'), elev: U('uElev'), night: U('uNight'), cloud: U('uCloud'), phase: U('uPhase'), lake: U('uLake'), p0: U('uP0'), p1: U('uP1'), p2: U('uP2'), orb: U('uOrb') };

  scene.prepend(canvas);
  scene.classList.add('gl');
  scene.style.setProperty('--lake', `${(lakeFraction * 100).toFixed(1)}%`);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const st: SkyState = { hour: 18, night: 0, pal: ['#7A4F78', '#E9955B', '#F7CF94'], orb: [255, 182, 110], sunX: 0.7, sunY: 0.5 };
  const phase = moonPhase();
  let raf = 0, visible = true, last = 0, t0 = performance.now(), dirty = true;

  const size = () => {
    const scale = Math.min(window.devicePixelRatio || 1, 1.5) * (window.innerWidth < 820 ? 0.5 : 0.7);
    const w = Math.max(2, Math.round(canvas.clientWidth * scale)), h = Math.max(2, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); dirty = true; }
  };
  const draw = (now: number) => {
    size();
    const time = reduce ? 40 : (now - t0) / 1000;
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform2f(u.sun, st.sunX, st.sunY);
    gl.uniform1f(u.time, time);
    gl.uniform1f(u.elev, sunElevation(st.hour));
    gl.uniform1f(u.night, st.night);
    gl.uniform1f(u.cloud, 0.42 + 0.08 * Math.sin(st.hour * 0.7));
    gl.uniform1f(u.phase, phase);
    gl.uniform1f(u.lake, lakeFraction);
    const [p0, p1, p2] = st.pal.map(parseColor);
    gl.uniform3f(u.p0, ...p0); gl.uniform3f(u.p1, ...p1); gl.uniform3f(u.p2, ...p2);
    gl.uniform3f(u.orb, st.orb[0] / 255, st.orb[1] / 255, st.orb[2] / 255);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    dirty = false;
  };
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    if (reduce) { if (dirty) draw(now); return; }
    if (now - last < 33) return; // about 30 frames a second is plenty for a sky
    last = now; draw(now);
  };
  const io = new IntersectionObserver(es => { visible = es[0]?.isIntersecting ?? true; }, { threshold: 0 });
  io.observe(canvas);
  raf = requestAnimationFrame(loop);

  const sky: Sky = {
    set(s) { Object.assign(st, s); dirty = true; },
    destroy() { cancelAnimationFrame(raf); io.disconnect(); canvas.remove(); scene.classList.remove('gl'); current = null; gl.getExtension('WEBGL_lose_context')?.loseContext(); },
    light() { return skyIsDark(st.hour, st.night); },
  };
  current = sky;
  return sky;
}
