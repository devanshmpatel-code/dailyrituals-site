import type { Moment } from '../config';
import { drawLandscape } from './landscape';

// A layered landscape behind the home hero. Mountains drift slowly, clouds and mist pass through, birds fly in the
// morning and evening, and at night there are stars (from the hero), a moon and fireflies. Colours per moment live in config.
// Everything is decorative (aria-hidden) and all motion stops for visitors who prefer reduced motion.

const bird = (n: number) => `<span class="bird b${n}"><svg viewBox="0 0 28 12" width="28" height="12"><path d="M2,8 Q8,0 14,7 Q20,0 26,8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg></span>`;
const fly = (n: number) => `<i class="ff f${n}"></i>`;

export function sceneHTML(): string {
  return `<div class="scene" id="scene" aria-hidden="true">
    <div class="sunorb" id="sunorb"></div>
    <div class="cloud c1"></div><div class="cloud c2"></div><div class="cloud c3"></div>
    <img class="scenephoto" id="scenePhoto" alt="" hidden>
    <canvas class="land la on" id="landA"></canvas><canvas class="land lb" id="landB"></canvas>
    <div class="mist k1"></div><div class="mist k2"></div>
    ${[1, 2, 3, 4, 5].map(bird).join('')}${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(fly).join('')}</div>`;
}

let current: Moment | null = null, resizeTimer = 0, onA = true;
function paint(app: HTMLElement, m: Moment, instant: boolean) {
  const a = app.querySelector<HTMLCanvasElement>('#landA'), b = app.querySelector<HTMLCanvasElement>('#landB');
  if (!a || !b) return;
  const target = instant ? (onA ? a : b) : (onA ? b : a), other = target === a ? b : a;
  drawLandscape(target, { sky: m.sky, land: m.land, orb: m.orb, dark: m.dark });
  target.classList.add('on'); if (!instant) { other.classList.remove('on'); onA = target === a; }
}

/** If a real photograph exists at /img/scenes/<moment>.jpg it is used instead of the generated landscape. */
function tryPhoto(sc: HTMLElement, key: string) {
  const photo = sc.querySelector<HTMLImageElement>('#scenePhoto');
  if (!photo) return;
  const img = new Image();
  img.onload = () => { photo.src = img.src; photo.hidden = false; sc.classList.add('has-photo'); };
  img.onerror = () => { sc.classList.remove('has-photo'); photo.hidden = true; };
  img.src = `/img/scenes/${key}.jpg`;
}

export function applyScene(app: HTMLElement, m: Moment) {
  const sc = app.querySelector<HTMLElement>('#scene');
  if (!sc) return;
  if (!current) {
    window.addEventListener('resize', () => { window.clearTimeout(resizeTimer); resizeTimer = window.setTimeout(() => { if (current) paint(app, current, true); }, 220); });
  }
  const first = !current; current = m;
  paint(app, m, first);
  tryPhoto(sc, m.key);
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
