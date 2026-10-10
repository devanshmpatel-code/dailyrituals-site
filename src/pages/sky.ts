// A realistic sky for the home opening, drawn on the graphics card (WebGL):
//  - sky colour from the sun's real height for today's date (scattering-style: blue overhead, warm bands at the horizon when the sun is low,
//    a pale haze along the horizon by day, deep indigo at night)
//  - two layers of drifting clouds (fractal noise with domain warping), shaded in their cores, with silver linings where they thin toward the sun
//  - the sun as a disc with limb darkening, bloom, a flattened glow at the horizon and sunbeams at low sun
//  - stars (two sizes) and a faint Milky Way that fade as the light comes, and the moon in tonight's real phase on its own arc
//  - a lake along the bottom that mirrors the sky with ripples, and a sparkling sun or moon path (the mountains above it are mirrored with CSS)
//  - a "wake": on the first visit the sky starts in deep night and the real light rises into it (see opening.ts)
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

/** Where the moon is on its own arc for a clock hour: it rises after sunset and sets after sunrise, highest around 1 am.
 *  Returns x (0..1 across), a height factor (0 at the horizon, 1 at the top of its arc) and how much of it is up (0..1). */
export function moonArcAt(hour: number) {
  const t = ((((hour - 17.5) % 24) + 24) % 24) / 14; // 17:30 -> 0, 7:30 -> 1
  if (t < 0 || t > 1) return { x: 0.5, h: 0, up: 0 };
  return { x: 0.14 + 0.72 * t, h: Math.sin(Math.PI * t), up: Math.min(1, Math.sin(Math.PI * t) * 3) };
}

const VS = `attribute vec2 p; varying vec2 v; void main(){ v = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const FS = `precision highp float;
varying vec2 v;
uniform vec2 uRes, uSun, uMoon;
uniform float uTime, uElev, uNight, uCloud, uPhase, uLake, uWake, uMoonUp;
uniform vec3 uP0, uP1, uP2, uOrb;
float hash(vec2 q){ q = fract(q * vec2(123.34, 456.21)); q += dot(q, q + 45.32); return fract(q.x * q.y); }
float noise(vec2 q){ vec2 i = floor(q), f = fract(q); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 q){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(q); q = q * 2.03 + 17.1; a *= 0.5; } return s; }
float cloudN(vec2 q){ return fbm(q) * 0.78 + fbm(q * 3.1 + 2.0) * 0.22; }

// the clear sky by height (0 horizon, 1 top): twilight ramps, sunset bands by the sun, a pale haze along the horizon by day
vec3 clearSky(float h, float dx, float lit, float day, float low){
  vec3 zen = mix(vec3(0.010, 0.014, 0.045), mix(vec3(0.17, 0.15, 0.40), vec3(0.19, 0.41, 0.78), day), lit);
  vec3 hor = mix(vec3(0.045, 0.040, 0.100), mix(vec3(0.98, 0.55, 0.30), vec3(0.76, 0.86, 0.94), day), lit);
  vec3 col = mix(hor, zen, pow(h, 0.5));
  float side = exp(-dx * dx * 1.6);
  col += low * vec3(1.0, 0.50, 0.16) * pow(1.0 - h, 1.7) * (0.4 + 0.6 * side) * 1.1;
  col += low * vec3(0.98, 0.46, 0.44) * exp(-pow((h - 0.34) * 3.2, 2.0)) * (0.35 + 0.65 * side) * 0.6;
  col += low * vec3(0.46, 0.26, 0.62) * exp(-pow((h - 0.62) * 2.4, 2.0)) * 0.38;
  col = mix(col, vec3(0.90, 0.93, 0.96), day * pow(1.0 - h, 4.0) * 0.55);
  return col;
}

vec3 sky(vec2 uv, out float cloudOut){
  float asp = uRes.x / uRes.y;
  float h = clamp((uv.y - uLake) / (1.0 - uLake), 0.0, 1.0);
  float e = uElev;
  float day = smoothstep(-0.04, 0.28, e);
  float lit = smoothstep(-0.3, 0.02, e);
  float low = (1.0 - smoothstep(0.04, 0.42, e)) * smoothstep(-0.22, 0.0, e);
  float dark = (1.0 - smoothstep(-0.16, -0.03, e)) * (1.0 - day);
  float sunUp = smoothstep(-0.06, 0.04, e);
  vec2 a = vec2(uv.x * asp, uv.y), s = vec2(uSun.x * asp, uSun.y), mn = vec2(uMoon.x * asp, uMoon.y);
  float dx = uv.x - uSun.x;
  vec3 col = clearSky(h, dx, lit, day, low);
  // a light tint from the moment's own colours keeps the brand palette in the sky
  vec3 pal = mix(uP2, mix(uP1, uP0, smoothstep(0.45, 1.0, h)), smoothstep(0.0, 0.45, h));
  col = mix(col, pal, 0.16);

  float d = distance(a, s);
  // ---- clouds: warped fractal noise, shaded cores, lit edges toward the sun or moon
  vec2 cq = vec2(uv.x * asp * 1.25 + uTime * 0.0045, h * 2.4 + 0.2);
  vec2 wp = vec2(fbm(cq * 1.4 + uTime * 0.0025), fbm(cq * 1.4 + vec2(5.2, 1.3) - uTime * 0.002)) - 0.47;
  vec2 cw = cq * 1.7 + wp * 1.1;
  float n = cloudN(cw);
  float band = smoothstep(0.03, 0.26, h) * (1.0 - smoothstep(0.78, 1.0, h));
  float cov = uCloud;
  float c = smoothstep(0.98 - cov, 1.22 - cov, n) * band;
  vec2 toSun = normalize(s - a + vec2(0.0001, 0.0002));
  float nS = cloudN(cw + toSun * vec2(0.09, 0.16));
  float rim = clamp((n - nS) * 6.0, 0.0, 1.0);
  float thick = smoothstep(1.02 - cov, 1.4 - cov, n);
  vec3 cDay = mix(vec3(0.62, 0.64, 0.72), vec3(1.0, 0.99, 0.97), day);
  vec3 cLow = mix(vec3(0.55, 0.30, 0.40), vec3(1.0, 0.70, 0.46), exp(-dx * dx * 2.0));
  vec3 cNight = vec3(0.07, 0.07, 0.13);
  vec3 cc = mix(cNight, mix(cDay, cLow, low), lit);
  cc *= 1.0 - thick * 0.32 * (0.6 + 0.4 * lit);
  cc += mix(vec3(1.0, 0.95, 0.85), uOrb, low) * rim * (0.35 + 0.6 * low) * sunUp * exp(-d * 1.2);
  cc += vec3(0.55, 0.58, 0.75) * rim * dark * uMoonUp * 0.25 * exp(-distance(a, mn) * 2.0);
  col = mix(col, cc, c * 0.94);
  cloudOut = c;

  // ---- the sun: bloom, a flattened glow at the horizon, the disc with limb darkening, sunbeams
  vec3 sunCol = mix(vec3(1.0, 0.985, 0.95), uOrb, low);
  float lowSun = 1.0 - smoothstep(0.02, 0.2, e);
  col += sunCol * (exp(-d * 5.5) * (0.12 + 0.12 * low) + exp(-d * 22.0) * 0.5 + exp(-d * 2.6) * 0.22 * low) * sunUp * (1.0 - c * 0.7);
  float dy = uv.y - uSun.y;
  col += sunCol * exp(-dx * dx * 28.0 - dy * dy * 160.0) * low * 0.35 * (1.0 - c);
  float sd = d / (0.026 + 0.012 * lowSun);
  float limb = sqrt(max(0.0, 1.0 - sd * sd));
  float disc = (1.0 - smoothstep(0.86, 1.02, sd)) * sunUp * (1.0 - c * 0.85);
  col = mix(col, mix(sunCol * 0.86, vec3(1.0, 0.99, 0.95), limb), disc);
  float ang = atan(a.y - s.y, a.x - s.x);
  float rays = pow(noise(vec2(ang * 11.0, uTime * 0.035)), 2.5) * exp(-d * 1.8) * low * lowSun * (1.0 - c) * sunUp;
  col += sunCol * rays * 0.4;

  // ---- night: stars in two sizes, a faint Milky Way, the moon
  float nt = max(uNight * (1.0 - day), dark) * (1.0 - c);
  vec2 sp = a * 95.0; vec2 g = floor(sp), f = fract(sp); float r = hash(g);
  vec2 at = vec2(hash(g + 3.1), hash(g + 7.7)); float sdd = length(f - at);
  float tw = 0.7 + 0.3 * sin(uTime * 1.9 + r * 60.0);
  float star = step(0.925, r) * smoothstep(0.1 * (0.5 + r), 0.0, sdd) * (0.45 + 0.55 * hash(g + 1.3));
  col += star * tw * nt * smoothstep(0.03, 0.3, h) * mix(vec3(0.95, 0.9, 1.0), vec3(0.85, 0.92, 1.0), hash(g + 2.2)) * 1.5;
  vec2 sp2 = a * 30.0 + 3.0; vec2 g2 = floor(sp2), f2 = fract(sp2); float r2 = hash(g2 + 9.1);
  vec2 at2 = vec2(hash(g2 + 4.2), hash(g2 + 8.5)); float sdd2 = length(f2 - at2);
  col += step(0.965, r2) * (smoothstep(0.08, 0.0, sdd2) + exp(-sdd2 * 18.0) * 0.5) * nt * smoothstep(0.1, 0.4, h) * (0.8 + 0.2 * sin(uTime * 1.3 + r2 * 40.0)) * vec3(1.0, 0.97, 0.92) * 1.2;
  if (nt > 0.004) {
    float mw = exp(-pow(uv.y - 0.4 - (uv.x - 0.5) * 0.5, 2.0) * 30.0);
    col += mw * (fbm(a * 4.0 + 11.0) * 0.6 + fbm(a * 12.0) * 0.4) * nt * 0.14 * vec3(0.7, 0.75, 1.0) * smoothstep(0.1, 0.4, h);
  }
  float bright = 0.5 - 0.5 * cos(uPhase * 6.2831853);
  float moonV = dark * uMoonUp * smoothstep(0.03, 0.14, bright);
  float md = distance(a, mn) / 0.04;
  if (md < 1.0 && moonV > 0.01) {
    vec2 pq = (a - mn) / 0.04;
    vec3 nrm = vec3(pq, sqrt(max(0.0, 1.0 - dot(pq, pq))));
    float th = uPhase * 6.2831853;
    vec3 L = vec3(sin(th), 0.0, -cos(th));
    float litm = smoothstep(-0.05, 0.08, dot(nrm, L));
    float crater = 0.84 + 0.16 * fbm(pq * 3.5 + 7.0);
    vec3 mc = mix(col * 0.75 + vec3(0.02, 0.02, 0.03), vec3(0.97, 0.95, 0.89) * crater, litm);
    col = mix(col, mc, smoothstep(1.0, 0.95, md) * moonV * (1.0 - c * 0.7));
  }
  col += vec3(0.8, 0.83, 0.98) * exp(-distance(a, mn) * 7.0) * 0.26 * (0.3 + 0.7 * bright) * moonV;
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
    float rip = (noise(vec2(uv.x * 40.0, uv.y * 300.0 - uTime * 0.7)) - 0.5) * 0.014 * (0.3 + k) + (noise(vec2(uv.x * 9.0 + uTime * 0.2, uv.y * 60.0)) - 0.5) * 0.006;
    vec2 m = vec2(uv.x + rip, uLake + (uLake - uv.y) * 1.5);
    col = sky(m, c) * mix(vec3(0.70, 0.76, 0.84), vec3(0.40, 0.47, 0.56), k);
    float sunUp = smoothstep(-0.06, 0.04, uElev);
    float dark = (1.0 - smoothstep(-0.16, -0.03, uElev));
    float spark = pow(noise(vec2(uv.x * 110.0, uv.y * 500.0 - uTime * 1.6)), 6.0) * (0.5 + 0.5 * noise(vec2(uv.x * 30.0 + uTime * 0.4, uv.y * 90.0)));
    float dx = uv.x - uSun.x;
    col += uOrb * exp(-dx * dx * 50.0) * sunUp * (0.08 + spark * 2.2) * (1.0 - k * 0.5);
    float mdx = uv.x - uMoon.x;
    col += vec3(0.8, 0.85, 1.0) * exp(-mdx * mdx * 50.0) * dark * uMoonUp * (0.05 + spark * 0.8);
    col = mix(col, col * 0.72, smoothstep(0.0, 1.0, k));
  }
  col = mix(vec3(0.02, 0.02, 0.06), col, uWake);
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

export interface SkyState { hour: number; night: number; pal: [string, string, string]; orb: [number, number, number]; sunX: number; sunY: number }

interface Sky {
  set(s: Partial<SkyState>): void;
  destroy(): void;
  light(): boolean;
  /** Start the opening: the sky begins in deep night and the real light rises into it over `ms`. */
  wake(ms: number): void;
}
let current: Sky | null = null;

const hex = (h: string) => { const m = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(m.slice(i, i + 2), 16) / 255) as [number, number, number]; };
const parseColor = (c: string): [number, number, number] => {
  if (c.startsWith('#')) return hex(c);
  const m = c.match(/[\d.]+/g); return m ? [Number(m[0]) / 255, Number(m[1]) / 255, Number(m[2]) / 255] : [1, 1, 1];
};
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Is the sky behind the hero words dark enough that the words should be light? (The shader's clear-sky model, bands included, without clouds.) */
export function skyIsDark(hour: number, night: number) {
  const e = sunElevation(hour);
  const day = sm(-0.04, 0.28, e), lit = sm(-0.3, 0.02, e), low = (1 - sm(0.04, 0.42, e)) * sm(-0.22, 0, e);
  const mix = (a: number[], b: number[], t: number) => a.map((x, i) => x + (b[i] - x) * t);
  const zen = mix([0.010, 0.014, 0.045], mix([0.17, 0.15, 0.40], [0.19, 0.41, 0.78], day), lit);
  const hor = mix([0.045, 0.040, 0.100], mix([0.98, 0.55, 0.30], [0.76, 0.86, 0.94], day), lit);
  const h = 0.62, side = 0.4; // the words sit in the upper half, usually well to the side of the sun
  const col = mix(hor, zen, Math.sqrt(h));
  const bands = [
    [1.0, 0.50, 0.16].map(x => x * Math.pow(1 - h, 1.7) * (0.4 + 0.6 * side) * 1.1),
    [0.98, 0.46, 0.44].map(x => x * Math.exp(-Math.pow((h - 0.34) * 3.2, 2)) * (0.35 + 0.65 * side) * 0.6),
    [0.46, 0.26, 0.62].map(x => x * Math.exp(-Math.pow((h - 0.62) * 2.4, 2)) * 0.38),
  ];
  bands.forEach(b => b.forEach((x, i) => { col[i] += low * x; }));
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
  const u = { res: U('uRes'), sun: U('uSun'), moon: U('uMoon'), time: U('uTime'), elev: U('uElev'), night: U('uNight'), cloud: U('uCloud'), phase: U('uPhase'), lake: U('uLake'), wake: U('uWake'), moonUp: U('uMoonUp'), p0: U('uP0'), p1: U('uP1'), p2: U('uP2'), orb: U('uOrb') };

  scene.prepend(canvas);
  scene.classList.add('gl');
  scene.style.setProperty('--lake', `${(lakeFraction * 100).toFixed(1)}%`);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const st: SkyState = { hour: 18, night: 0, pal: ['#7A4F78', '#E9955B', '#F7CF94'], orb: [255, 182, 110], sunX: 0.7, sunY: 0.5 };
  const phase = moonPhase();
  const dayOfYear = Math.floor((Date.now() - Date.UTC(new Date().getFullYear(), 0, 0)) / 86400000);
  let raf = 0, visible = true, last = 0, t0 = performance.now(), dirty = true, wakeT0 = -1, wakeMs = 0;

  const size = () => {
    // DPR is capped at 1.5 and the sky is drawn at a fraction of the screen's pixels: it is soft by nature, and this keeps phones cool
    const scale = Math.min(window.devicePixelRatio || 1, 1.5) * (window.innerWidth < 820 ? 0.5 : 0.62);
    const w = Math.max(2, Math.round(canvas.clientWidth * scale)), h = Math.max(2, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); dirty = true; }
  };
  const draw = (now: number) => {
    size();
    const time = reduce ? 40 : (now - t0) / 1000;
    // the wake: 0 = deep night before the opening, 1 = the real hour (eased)
    const wk = reduce || wakeT0 < 0 ? 1 : Math.min(1, Math.max(0, (now - wakeT0) / wakeMs));
    const w = 1 - Math.pow(1 - wk, 3);
    const eReal = sunElevation(st.hour);
    const e = eReal + (Math.min(eReal, -0.22) - eReal) * (1 - w);
    // the moon has its own arc; sun and moon both rise into place during the wake
    const moon = moonArcAt(st.hour);
    // the sun's height follows its real elevation, scaled so that at sunset it sits just above the ridgeline and at noon near the top
    const sunY = Math.min(0.9, 0.54 + 0.7 * Math.max(-0.12, eReal));
    const moonY = lakeFraction + 0.26 + 0.5 * moon.h;
    gl.uniform2f(u.res, canvas.width, canvas.height);
    // across the day the sun keeps to the open sky between the words and the photo arch (the dial below shows the full east-to-west travel)
    const sunX = 0.44 + st.sunX * 0.22;
    gl.uniform2f(u.sun, sunX, (lakeFraction - 0.14) + (sunY - (lakeFraction - 0.14)) * w);
    gl.uniform2f(u.moon, moon.x, (lakeFraction + 0.05) + (moonY - (lakeFraction + 0.05)) * w);
    gl.uniform1f(u.moonUp, moon.up * (0.2 + 0.8 * w));
    gl.uniform1f(u.time, time);
    gl.uniform1f(u.elev, e);
    gl.uniform1f(u.night, st.night);
    gl.uniform1f(u.cloud, 0.4 + 0.09 * Math.sin(st.hour * 0.7 + dayOfYear * 0.37));
    gl.uniform1f(u.phase, phase);
    gl.uniform1f(u.lake, lakeFraction);
    gl.uniform1f(u.wake, 0.12 + 0.88 * w);
    const [p0, p1, p2] = st.pal.map(parseColor);
    gl.uniform3f(u.p0, ...p0); gl.uniform3f(u.p1, ...p1); gl.uniform3f(u.p2, ...p2);
    gl.uniform3f(u.orb, st.orb[0] / 255, st.orb[1] / 255, st.orb[2] / 255);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    dirty = false;
    if (wk >= 1) wakeT0 = -1;
  };
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (!visible || document.hidden) return;
    if (reduce) { if (dirty) draw(now); return; }
    if (now - last < 33) return; // about 30 frames a second is plenty for a sky
    last = now; draw(now);
  };
  // the hero is re-parented once while it mounts (the scrolling day pins it), so the first batch can hold a stale "not on screen"
  // entry followed by the real one: always take the latest
  const io = new IntersectionObserver(es => { visible = es[es.length - 1]?.isIntersecting ?? true; }, { threshold: 0 });
  io.observe(canvas);
  raf = requestAnimationFrame(loop);

  const sky: Sky = {
    set(s) { Object.assign(st, s); dirty = true; },
    destroy() { cancelAnimationFrame(raf); io.disconnect(); canvas.remove(); scene.classList.remove('gl'); current = null; gl.getExtension('WEBGL_lose_context')?.loseContext(); },
    light() { return skyIsDark(st.hour, st.night); },
    wake(ms) { if (reduce) return; wakeT0 = performance.now(); wakeMs = Math.max(1, ms); dirty = true; },
  };
  current = sky;
  return sky;
}
