// "Turn a scent into a calm cue": the coaching page's centrepiece.
// The four steps of the new loop orbit Claire's candle (her photograph) in real 3D (CSS 3D transforms, no library).
// Drag or swipe the ring, use the arrow keys, the arrows or the step buttons; each step you reach lights a quarter of the
// ring under the candle, and the candle comes alight a little more: the wicks catch, the lit glass and wax glow in and the
// flames grow, until the loop is complete and it burns as photographed.
// With reduced motion the same four steps are shown flat, all at once, around the candle, lit and still.
import { candlePhotoHTML, cueCandle, LitCandle } from './litcandle';
// The step names and most lines come from the page's habit loop (loop.ts) and Day 3 of the reset; every line is a draft for Claire.

type Icon = 'scent' | 'pause' | 'lotus' | 'sprout';
type Step = { label: string; title: string; text: string; icon: Icon; hue: string };

export const CUE_STEPS: Step[] = [
  { label: 'Cue', title: 'A familiar scent', icon: 'scent', hue: '#B9A3E0',
    text: 'You light your candle or roll on a familiar scent. The same scent shows up, and noticing it is the first step.' },
  { label: 'Pause', title: 'One slow breath', icon: 'pause', hue: '#8FC9B5',
    text: 'A small, practised pause. This is where coaching focuses.' },
  { label: 'Chosen response', title: 'A different response', icon: 'lotus', hue: '#EDB462',
    text: 'You try a different response, one small step at a time.' },
  { label: 'Repeat', title: 'Again tomorrow', icon: 'sprout', hue: '#EFA49B',
    text: 'Repeated daily, the new response gets easier, and the scent becomes your reminder to pause.' },
];

const ICONS: Record<Icon, string> = {
  scent: '<path d="M8 20c-2-2.5 2-4.5 0-7s2-4.5 0-7"/><path d="M13 20c-2-2.5 2-4.5 0-7s2-4.5 0-7"/><path d="M18 20c-2-2.5 2-4.5 0-7s2-4.5 0-7"/>',
  pause: '<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7M14 8.5v7"/>',
  lotus: '<path d="M12 20c-4 0-8-3-9-9 4 0 7 2 9 5 2-3 5-5 9-5-1 6-5 9-9 9z"/><path d="M12 16c-2-3-2-7 0-11 2 4 2 8 0 11z"/>',
  sprout: '<path d="M12 21v-9"/><path d="M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 15c0-3 2-5 6-5 0 3-2 5-6 5z"/>',
};
const icon = (k: Icon, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;

/** Claire's candle, photographed (Verdant: the white glass tumbler with the black Daily Rituals label, a small black tin and
 * its lid), unlit until the loop begins; it is lit a little more at every step (litcandle.ts). */
export const candlePhoto = (cls: string, sizes: string) => candlePhotoHTML(cueCandle(), cls, sizes);
/** light a candle photo made by candlePhoto */
export const lightCandle = (box: HTMLElement | null, reduce = reduceMotion()) => (box ? new LitCandle(box, cueCandle(), reduce) : null);

// The step being read sits front right, the one before it front left, so the candle between them is never hidden
// (--slot on the stage: how far round from the front, in degrees; narrower on a phone, so both fit either side of it).
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mod = (n: number, m: number) => ((n % m) + m) % m;
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function staticView(root: HTMLElement) {
  root.classList.add('is-static');
  root.style.setProperty('--lit', '1');
  root.innerHTML = `<div class="cue-flat">
    <div class="cue-flat-candle"><span class="cue-glow" aria-hidden="true"></span>${candlePhoto('cue-photo', '(max-width: 820px) 300px, 340px')}</div>
    <ol class="cue-list" aria-label="The calm cue loop, four steps">${CUE_STEPS.map((s, i) => `<li style="--hue:${s.hue}">
      <span class="cue-n">${String(i + 1).padStart(2, '0')}</span>${icon(s.icon, 'cue-ic')}
      <h3>${s.label}<small>${s.title}</small></h3><p><span class="d">${s.text}</span></p></li>`).join('')}</ol></div>
    <div class="cue-done cue-done-static"><p><span class="d">Practised daily, the scent becomes the start of a calm pause. Day 3 of the free reset walks you through it.</span></p>
      <a class="btn co-gold" href="#/reset">Try it in the free 7-day reset</a></div>`;
  // all four steps are read at once, so the loop is complete: the candle burns, steady
  lightCandle(root.querySelector<HTMLElement>('.cue-photo'), true)?.set(1);
}

export function mountCue(root: HTMLElement | null) {
  if (!root) return;
  if (reduceMotion()) { staticView(root); return; }
  const N = CUE_STEPS.length;
  root.innerHTML = `<div class="cue-grid">
    <div class="cue-stage" tabindex="0" role="group" aria-roledescription="3D loop" aria-label="The calm cue loop. Drag, or use the left and right arrow keys, to turn it." aria-describedby="cuePanelText">
      <span class="cue-glow cue-halo" aria-hidden="true"></span>
      <div class="cue-tilt">
        <div class="cue-floor" aria-hidden="true"><svg viewBox="-210 -210 420 420">
          <circle r="196" fill="none" class="cue-floor-glow"/><circle r="176" fill="none" class="cue-floor-dash"/>
          ${CUE_STEPS.map((s, i) => {
            const a0 = (i * 90 - 38) * Math.PI / 180, a1 = (i * 90 + 38) * Math.PI / 180, r = 176;
            const p = (t: number) => `${(r * Math.sin(t)).toFixed(1)} ${(r * Math.cos(t)).toFixed(1)}`;
            return `<path class="cue-arc" data-arc="${i}" d="M${p(a0)} A${r} ${r} 0 0 0 ${p(a1)}" style="--hue:${s.hue}"/><circle class="cue-dot" data-dot="${i}" cx="${(r * Math.sin(i * Math.PI / 2)).toFixed(1)}" cy="${(r * Math.cos(i * Math.PI / 2)).toFixed(1)}" r="5" style="--hue:${s.hue}"/>`;
          }).join('')}</svg></div>
        <div class="cue-candle" aria-hidden="true"><span class="cue-shadow"></span>${candlePhoto('cue-photo', '(max-width: 820px) 240px, 360px')}</div>
        ${CUE_STEPS.map((s, i) => `<button class="cue-card" type="button" data-i="${i}" tabindex="-1" aria-hidden="true" style="--hue:${s.hue}">
          <span class="cue-n">${String(i + 1).padStart(2, '0')}</span>${icon(s.icon, 'cue-ic')}<b>${s.label}</b><span class="cue-t">${s.title}</span></button>`).join('')}
      </div>
      <p class="cue-hint" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/></svg>Drag to turn the loop</p>
    </div>
    <div class="cue-panel">
      <span class="eyebrow cue-step">Step <b>1</b> of ${N}</span>
      <h3 class="cue-h" aria-live="polite"><span class="cue-hl">${CUE_STEPS[0].label}</span><span class="cue-ht">${CUE_STEPS[0].title}</span></h3>
      <p class="cue-p" id="cuePanelText"><span class="d">${CUE_STEPS[0].text}</span></p>
      <p class="cue-try" hidden><button class="btn line cue-breathe" type="button" data-breathe>Try the pause now: one mindful minute</button></p>
      <div class="cue-nav">
        <button class="cue-arrow" type="button" data-go="-1" aria-label="Previous step"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>
        <div class="cue-pills" role="group" aria-label="Steps">${CUE_STEPS.map((s, i) => `<button class="cue-pill" type="button" data-pick="${i}" aria-pressed="${i === 0}" style="--hue:${s.hue}"><i></i>${s.label}</button>`).join('')}</div>
        <button class="cue-arrow" type="button" data-go="1" aria-label="Next step"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg></button>
      </div>
      <div class="cue-meter"><span class="cue-bar"><i></i></span><span class="cue-mtx" aria-live="polite">The flame: <b>1</b> of ${N} steps lit</span></div>
      <div class="cue-done" hidden><p><span class="d">That is one full loop. Practised daily, the scent becomes the start of a calm pause. Day 3 of the free reset walks you through it.</span></p>
        <a class="btn co-gold" href="#/reset" data-cta="cue-reset">Try it in the free 7-day reset</a></div>
    </div></div>`;

  const stage = root.querySelector<HTMLElement>('.cue-stage')!;
  const cards = [...root.querySelectorAll<HTMLElement>('.cue-card')];
  const floor = root.querySelector<HTMLElement>('.cue-floor')!;
  const pills = [...root.querySelectorAll<HTMLButtonElement>('.cue-pill')];
  const visited = new Set<number>([0]);
  let rot = 0, target = 0, active = 0, raf = 0, last = 0, R = 300, tilt = -22, frontY = 0, SLOT = 58;
  let dragging = false, moved = 0, startX = 0, startRot = 0, vel = 0, lastX = 0, lastT = 0;
  let auto = 0, touched = false, inView = false;
  // the candle stays unlit until the loop is first on screen; then step 1 (the cue: "you light your candle") lights it
  const candle = lightCandle(root.querySelector<HTMLElement>('.cue-candle .cue-photo'));
  let lit = !('IntersectionObserver' in window);
  const lightUp = () => { if (lit) candle?.set(visited.size / N); };

  const layout = () => {
    const w = stage.clientWidth;
    R = w >= 560 ? Math.min(270, w * 0.34) : Math.max(120, w * 0.4);
    tilt = w >= 560 ? -20 : -24;
    const cs = getComputedStyle(stage);
    frontY = parseFloat(cs.getPropertyValue('--cardy')) || 0;
    SLOT = parseFloat(cs.getPropertyValue('--slot')) || 58;
    const d = R * 420 / 176; // the floor's svg ring (r 176 in a 420 viewBox) sits at radius R
    floor.style.width = floor.style.height = `${d}px`;
    root.querySelector<HTMLElement>('.cue-tilt')!.style.transform = `rotateX(${tilt}deg)`;
    root.style.setProperty('--untilt', `${-tilt}deg`); // the photograph faces the visitor, as the cards do
    paint();
  };

  const paint = () => {
    cards.forEach((c, i) => {
      const a = (i * 90 + rot + SLOT) * Math.PI / 180;
      const x = R * Math.sin(a), z = R * Math.cos(a);
      // the two front steps stay solid and readable; going round the back a step recedes: it shrinks and dims to a half-lit
      // arch peeking past the jar, its icon still showing (so the ring reads as four steps), its words faded out before it
      // gets there, so no words ever sit behind other words or behind the candle
      const front = smooth(-0.35, 0.3, Math.cos(a)), face = smooth(0.15, 0.45, Math.cos(a));
      c.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${frontY}px, ${z.toFixed(1)}px) rotateX(${-tilt}deg) scale(${(0.85 + 0.15 * front).toFixed(3)})`;
      c.style.opacity = (0.5 + 0.5 * front).toFixed(3);
      c.style.setProperty('--face', face.toFixed(3));
      c.classList.toggle('back', face < 0.02);
      c.classList.toggle('on', i === active);
    });
    floor.style.transform = `translate(-50%, -50%) translateY(var(--floory)) rotateX(90deg) rotateZ(${(-(rot + SLOT)).toFixed(2)}deg)`;
  };

  const setActive = (i: number, fromUser: boolean) => {
    i = mod(i, N);
    if (fromUser) stopAuto();
    const changed = i !== active;
    active = i; visited.add(i);
    const s = CUE_STEPS[i];
    root.style.setProperty('--hue', s.hue);
    root.style.setProperty('--lit', String(lit ? visited.size / N : 0));
    lightUp();
    root.querySelector('.cue-step b')!.textContent = String(i + 1);
    root.querySelector('.cue-hl')!.textContent = s.label;
    root.querySelector('.cue-ht')!.textContent = s.title;
    root.querySelector('.cue-p')!.innerHTML = `<span class="d">${s.text}</span>`;
    root.querySelector<HTMLElement>('.cue-try')!.hidden = s.label !== 'Pause';
    pills.forEach((p, k) => { p.setAttribute('aria-pressed', String(k === i)); p.classList.toggle('seen', visited.has(k)); });
    root.querySelectorAll<SVGElement>('[data-arc]').forEach(a => a.classList.toggle('lit', visited.has(Number(a.dataset.arc))));
    root.querySelectorAll<SVGElement>('[data-dot]').forEach(a => a.classList.toggle('lit', visited.has(Number(a.dataset.dot))));
    root.querySelector('.cue-mtx b')!.textContent = String(visited.size);
    root.querySelector<HTMLElement>('.cue-bar i')!.style.width = `${(visited.size / N) * 100}%`;
    const done = visited.size === N;
    root.classList.toggle('complete', done);
    root.querySelector<HTMLElement>('.cue-done')!.hidden = !done;
    if (changed) { root.classList.remove('pulse'); void root.offsetWidth; root.classList.add('pulse'); }
  };

  // turn the ring so step i faces the visitor, the short way round
  const go = (i: number, fromUser = true) => {
    const want = -i * 90;
    const k = Math.round((target - want) / 360);
    target = want + k * 360;
    setActive(i, fromUser);
    kick();
  };

  const frame = (t: number) => {
    raf = 0;
    if (!root.isConnected) { cleanup(); return; }
    const dt = Math.min(64, t - (last || t)); last = t;
    if (!dragging) {
      const diff = target - rot;
      rot += diff * (1 - Math.pow(0.0025, dt / 1000));
      if (Math.abs(diff) < 0.02) rot = target;
    }
    paint();
    if (dragging || rot !== target) raf = requestAnimationFrame(frame); else last = 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  // drag / swipe
  stage.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    dragging = true; moved = 0; startX = lastX = e.clientX; startRot = rot; vel = 0; lastT = performance.now();
    stage.setPointerCapture(e.pointerId); stage.classList.add('grab'); kick();
  });
  stage.addEventListener('pointermove', e => {
    if (!dragging) return;
    const now = performance.now(), dx = e.clientX - startX;
    moved = Math.max(moved, Math.abs(dx));
    const k = 150 / Math.max(160, R * 1.1); // degrees per pixel: about a quarter turn per card width
    rot = startRot + dx * k;
    vel = 0.8 * vel + 0.2 * ((e.clientX - lastX) * k / Math.max(1, now - lastT));
    lastX = e.clientX; lastT = now;
    if (moved > 6) { stopAuto(); stage.classList.add('turned'); }
  });
  const release = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false; stage.classList.remove('grab');
    if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
    if (moved > 6) {
      const proj = rot + vel * 160;
      const i = mod(Math.round(-proj / 90), N);
      target = Math.round(proj / 90) * 90; setActive(i, true);
    } else {
      // a tap: on a card, go to it
      const card = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest<HTMLElement>('.cue-card');
      if (card) go(Number(card.dataset.i));
    }
    kick();
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);
  stage.addEventListener('keydown', e => {
    const k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowDown') { e.preventDefault(); go(active + 1); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); go(active - 1); }
    else if (k === 'Home') { e.preventDefault(); go(0); }
    else if (k === 'End') { e.preventDefault(); go(N - 1); }
  });
  root.querySelectorAll<HTMLButtonElement>('[data-go]').forEach(b => b.addEventListener('click', () => go(active + Number(b.dataset.go))));
  pills.forEach(p => p.addEventListener('click', () => go(Number(p.dataset.pick))));

  // a slow turn on its own while the visitor watches, until they take the ring themselves
  function stopAuto() { touched = true; if (auto) { clearInterval(auto); auto = 0; } }
  const startAuto = () => { if (touched || auto || !inView) return; auto = window.setInterval(() => { if (!root.isConnected) { cleanup(); return; } if (document.hidden || !inView) return; go(active + 1, false); }, 3800); };
  const pauseAuto = () => { if (auto) { clearInterval(auto); auto = 0; } };
  stage.addEventListener('pointerenter', pauseAuto); stage.addEventListener('focus', pauseAuto);
  stage.addEventListener('pointerleave', () => { if (!dragging) startAuto(); });
  root.querySelector('.cue-panel')!.addEventListener('focusin', stopAuto);

  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
    inView = e.isIntersecting;
    if (inView && !lit) { lit = true; root.style.setProperty('--lit', String(visited.size / N)); window.setTimeout(lightUp, 350); }
    root.classList.toggle('inview', inView);
    if (inView) window.setTimeout(startAuto, 1400); else pauseAuto();
  }), { threshold: 0.35 }) : null;
  io?.observe(stage);

  const ro = 'ResizeObserver' in window ? new ResizeObserver(layout) : null;
  ro?.observe(stage);
  function cleanup() { io?.disconnect(); ro?.disconnect(); pauseAuto(); candle?.destroy(); if (raf) cancelAnimationFrame(raf); raf = 0; }
  // the router replaces the page: the frame loop and the slow turn both stop themselves once the ring is gone

  setActive(0, false);
  layout();
}
