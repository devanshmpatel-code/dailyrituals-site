import type { Moment } from '../config';

// A layered landscape behind the home hero. Mountains drift slowly, clouds and mist pass through, birds fly in the
// morning and evening, and at night there are stars (from the hero), a moon and fireflies. Colours per moment live in config.
// Everything is decorative (aria-hidden) and all motion stops for visitors who prefer reduced motion.

type Pt = [number, number];
const ridge = (pts: Pt[], bottom = 420): string => {
  const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) { const m = mid(pts[i], pts[i + 1]); d += ` Q${pts[i][0]},${pts[i][1]} ${m[0]},${m[1]}`; }
  const last = pts[pts.length - 1];
  return `${d} L${last[0]},${last[1]} L${last[0]},${bottom} L${pts[0][0]},${bottom} Z`;
};
const FAR = ridge([[-60, 250], [150, 165], [330, 235], [530, 135], [770, 235], [990, 160], [1210, 238], [1410, 148], [1660, 240]]);
const MID = ridge([[-60, 305], [120, 250], [300, 312], [545, 212], [765, 302], [1005, 228], [1245, 312], [1445, 244], [1660, 300]]);
const NEAR = ridge([[-60, 365], [200, 322], [425, 378], [685, 298], [905, 372], [1135, 314], [1385, 378], [1660, 330]]);

const bird = (n: number) => `<span class="bird b${n}"><svg viewBox="0 0 28 12" width="28" height="12"><path d="M2,8 Q8,0 14,7 Q20,0 26,8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg></span>`;
const fly = (n: number) => `<i class="ff f${n}"></i>`;

export function sceneHTML(): string {
  return `<div class="scene" id="scene" aria-hidden="true">
    <div class="sunorb" id="sunorb"></div>
    <div class="cloud c1"></div><div class="cloud c2"></div><div class="cloud c3"></div>
    <svg class="land" viewBox="0 0 1600 420" preserveAspectRatio="none" focusable="false">
      <path class="ml m1" d="${FAR}"></path><path class="ml m2" d="${MID}"></path><path class="ml m3" d="${NEAR}"></path></svg>
    <div class="mist k1"></div><div class="mist k2"></div>
    ${[1, 2, 3, 4, 5].map(bird).join('')}${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(fly).join('')}</div>`;
}

export function applyScene(app: HTMLElement, m: Moment) {
  const sc = app.querySelector<HTMLElement>('#scene');
  if (!sc) return;
  sc.style.setProperty('--m1', m.land[0]); sc.style.setProperty('--m2', m.land[1]); sc.style.setProperty('--m3', m.land[2]);
  sc.style.setProperty('--orb', m.orb);
  const n = parseInt(m.orb.slice(1), 16); // same colour as r,g,b so the glow can fade to a transparent version of itself
  sc.style.setProperty('--orb-rgb', `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`);
}

/** Put the sun (or moon) where the dial's sun is: x and y are the dial's own coordinates (0 to 1000 wide). */
export function placeOrb(app: HTMLElement, x: number, y: number) {
  const orb = app.querySelector<HTMLElement>("#sunorb");
  if (!orb) return;
  orb.style.left = `${(x / 10).toFixed(1)}%`;
  orb.style.top = `${(70 - ((140 - y) / 100) * 45).toFixed(1)}%`;
}
