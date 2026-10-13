import '../opening.css';
import { getSky } from './sky';

// The opening of the home page: "the sky wakes with you".
// On the first visit of a session the scene starts in deep night and, over about two and a half seconds, the real light of the
// visitor's hour rises into the sky, the sun or moon lifts into place, the mountains surface and settle on the lake, and the
// words rise with a slow breath. Later in the same session it is quick. Everything is in the DOM and clickable from the first
// frame: the opening is decoration layered over real content. With reduced motion nothing moves.
// After the opening, the layers of the scene lean gently with the pointer, or with the phone's tilt where that needs no permission.

const KEY = 'dr_opened';
let cleanups: (() => void)[] = [];
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function unmountOpening() { cleanups.forEach(f => f()); cleanups = []; }

export function mountOpening(app: HTMLElement) {
  unmountOpening();
  const hero = app.querySelector<HTMLElement>('#day');
  if (!hero || reduceMotion()) return;
  let seen = false;
  try { seen = sessionStorage.getItem(KEY) === '1'; sessionStorage.setItem(KEY, '1'); } catch { /* storage blocked: play the full opening */ }
  hero.classList.add('opening', 'opened'); if (seen) hero.classList.add('opening-quick');
  getSky()?.wake(seen ? 900 : 2600);
  const t = window.setTimeout(() => hero.classList.remove('opening', 'opening-quick'), seen ? 1600 : 3800);
  cleanups.push(() => { window.clearTimeout(t); hero.classList.remove('opening', 'opening-quick', 'opened'); });
  mountDepth(hero);
}

// ---------- depth: the scene leans with the pointer or the phone ----------
function mountDepth(hero: HTMLElement) {
  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
  const step = () => {
    raf = 0;
    cx += (tx - cx) * 0.1; cy += (ty - cy) * 0.1;
    hero.style.setProperty('--px', cx.toFixed(3)); hero.style.setProperty('--py', cy.toFixed(3));
    if (Math.abs(tx - cx) > 0.003 || Math.abs(ty - cy) > 0.003) raf = requestAnimationFrame(step);
  };
  const want = (x: number, y: number) => { tx = clamp(x); ty = clamp(y); if (!raf && !document.hidden) raf = requestAnimationFrame(step); };
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const onMove = (e: PointerEvent) => { const r = hero.getBoundingClientRect(); if (!r.width || !r.height) return; want(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * 2); };
    const onLeave = () => want(0, 0);
    hero.addEventListener('pointermove', onMove, { passive: true }); hero.addEventListener('pointerleave', onLeave);
    cleanups.push(() => { hero.removeEventListener('pointermove', onMove); hero.removeEventListener('pointerleave', onLeave); });
  } else if ('DeviceOrientationEvent' in window && typeof (DeviceOrientationEvent as unknown as { requestPermission?: unknown }).requestPermission !== 'function') {
    // Android and desktop browsers fire this without asking; iOS needs a permission prompt, which this never raises
    let base: number | null = null;
    const onTilt = (e: DeviceOrientationEvent) => { if (e.gamma == null || e.beta == null) return; if (base === null) base = e.beta; want(e.gamma / 28, (e.beta - base) / 28); };
    window.addEventListener('deviceorientation', onTilt, { passive: true });
    cleanups.push(() => window.removeEventListener('deviceorientation', onTilt));
  }
  cleanups.push(() => { cancelAnimationFrame(raf); raf = 0; hero.style.removeProperty('--px'); hero.style.removeProperty('--py'); });
}
