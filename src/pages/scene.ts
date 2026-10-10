import { MOMENTS } from '../config';
import { drawLandscape } from './landscape';
import type { Look } from './daycycle';
import { getSky } from './sky';

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
    ${MOMENTS.map(m => `<canvas class="land" data-k="${m.key}"></canvas>`).join('')}
    <div class="mist k1"></div><div class="mist k2"></div>
    ${[1, 2, 3, 4, 5].map(bird).join('')}${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(fly).join('')}</div>`;
}

let started = false, resizeTimer = 0, photoKey = '';
function paintAll(app: HTMLElement) {
  MOMENTS.forEach(m => { const c = app.querySelector<HTMLCanvasElement>(`canvas.land[data-k="${m.key}"]`); if (c) drawLandscape(c, { sky: m.sky, land: m.land, orb: m.orb, dark: m.dark }); });
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

/** Show the landscape for any hour of the day: the two neighbouring moments cross-fade by how far along the hour is. */
export function setLook(app: HTMLElement, L: Look) {
  const sc = app.querySelector<HTMLElement>('#scene');
  if (!sc) return;
  if (!started) { started = true; paintAll(app); window.addEventListener('resize', () => { window.clearTimeout(resizeTimer); resizeTimer = window.setTimeout(() => paintAll(app), 220); }); }
  sc.querySelectorAll<HTMLCanvasElement>('canvas.land').forEach(c => { c.style.opacity = c.dataset.k === L.a.key && c.dataset.k === L.b.key ? '1' : c.dataset.k === L.a.key ? String(1 - L.t) : c.dataset.k === L.b.key ? String(L.t) : '0'; });
  sc.style.setProperty('--orb', L.orb);
  sc.style.setProperty('--orb-rgb', L.orbRgb.join(', '));
  if (L.nearest.key !== photoKey) { photoKey = L.nearest.key; tryPhoto(sc, photoKey); }
}

/** Put the sun (or moon) where the dial's sun is: x and y are the dial's own coordinates (0 to 1000 wide). */
export function placeOrb(app: HTMLElement, x: number, y: number) {
  const orb = app.querySelector<HTMLElement>("#sunorb");
  if (!orb) return;
  const top = 70 - ((140 - y) / 100) * 45;
  orb.style.left = `${(x / 10).toFixed(1)}%`;
  orb.style.top = `${top.toFixed(1)}%`;
  getSky()?.set({ sunX: x / 1000, sunY: 1 - top / 100 });
}
