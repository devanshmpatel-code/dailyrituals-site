import { esc } from '../ui';

// "Why patterns repeat": the habit loop as a small object in 3D (CSS 3D transforms, no library). A porcelain hoop lies in
// perspective; each step is a porcelain coin with a real edge, hovering over the hoop and casting a soft shadow on it, and a
// glowing bead keeps travelling the path. The old loop runs on autopilot: the bead races round without stopping. Switch to
// the new loop and the coins turn over (the automatic response becomes a chosen response, the short-term relief a steadier
// result) while a fourth coin, the pause, rises out of the hoop between the cue and the response; from then on the bead
// slows and rests at the pause for a breath before it goes on.
// Drag (or swipe) the ring to turn it, tap a coin, use the arrow keys, Back, Next or Play. With reduced motion the ring
// still turns to each step, but in one move, and nothing drifts or travels on its own.
// All explanatory text is placeholder copy for Claire (class "d"), written to match the page's own wording.
type Icon = 'notice' | 'bolt' | 'sigh' | 'pause' | 'lotus' | 'sprout';
type Step = { label: string; text: string; icon: Icon };
type Mode = 'old' | 'new';
const LOOPS: Record<Mode, { title: string; note: string; color: string; glow: string; steps: Step[] }> = {
  old: {
    title: 'The old loop', note: 'Runs on autopilot', color: '#8A5A3B', glow: '#D9953A',
    steps: [
      { label: 'Cue', icon: 'notice', text: 'A familiar trigger: a smell, a deadline, a crowded room.' },
      { label: 'Automatic response', icon: 'bolt', text: 'The usual reaction fires before you have chosen it.' },
      { label: 'Short-term relief', icon: 'sigh', text: 'It eases the moment, which teaches the loop to repeat.' },
    ],
  },
  new: {
    title: 'A new loop', note: 'A small pause changes the path', color: '#2F5249', glow: '#7FB5A3',
    steps: [
      { label: 'Cue', icon: 'notice', text: 'The same trigger shows up. Noticing it is the first step.' },
      { label: 'Pause', icon: 'pause', text: 'A small, practised pause. This is where coaching focuses.' },
      { label: 'Chosen response', icon: 'lotus', text: 'You try a different response, one small step at a time.' },
      { label: 'Steadier result', icon: 'sprout', text: 'Repeated daily, the new response gets easier.' },
    ],
  },
};

// 24 x 24 line icons
const ICONS: Record<Icon, string> = {
  notice: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  bolt: '<path d="M13 2L5 13.5h6L10 22l8-11.5h-6z"/>',
  sigh: '<path d="M3 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  lotus: '<path d="M12 20c-4 0-8-3-9-9 4 0 7 2 9 5 2-3 5-5 9-5-1 6-5 9-9 9z"/><path d="M12 16c-2-3-2-7 0-11 2 4 2 8 0 11z"/>',
  sprout: '<path d="M12 21v-9"/><path d="M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 15c0-3 2-5 6-5 0 3-2 5-6 5z"/>',
};
const icon = (k: Icon) => `<svg class="lp-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;

// Four coins serve both loops. Which step each coin is in each loop (null: the pause has no place in the old loop), and
// where on the hoop it sits (degrees round from the front, in the direction the loop runs).
const COIN_STEP: Record<Mode, (number | null)[]> = { old: [0, null, 1, 2], new: [0, 1, 2, 3] };
const COIN_ANGLE: Record<Mode, number[]> = { old: [0, 60, 120, 240], new: [0, 90, 180, 270] };
const COIN_OF = (m: Mode, step: number) => COIN_STEP[m].indexOf(step);
const RIM = 28; // segments in each coin's edge
/** the coins are laid out this many times larger and scaled back down in their transform: Chrome rasterises anything under a
 * perspective at the screen's own resolution, ignoring how far it has come towards the visitor, so a near coin's words would
 * otherwise be enlarged from too few pixels and blur. Laid out larger, they are drawn from more pixels than they need. */
const SS = 1.5;
/** the light: high, a little to the left of the visitor and behind them (as on the coins' glaze), so each coin's shadow falls on
 * the hoop a little to the right of it and away from the visitor (a fraction of a coin's width, in the scene's own x and z) */
const SHADOW_DX = 0.14, SHADOW_DZ = -0.1;

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mod = (n: number, m: number) => ((n % m) + m) % m;
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const rad = (d: number) => (d * Math.PI) / 180;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t: number) => { const c = 1.5; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
/** the shortest signed distance between two angles, in degrees */
const angDiff = (a: number, b: number) => mod(a - b + 180, 360) - 180;

/** a value that glides from one number to another over a set time */
class Tween {
  from: number; to: number; start = 0; dur = 0; delay = 0; ease = easeInOut;
  constructor(v: number) { this.from = this.to = v; }
  set(to: number, now: number, dur: number, delay = 0, ease = easeInOut) { this.from = this.at(now); this.to = to; this.start = now; this.dur = dur; this.delay = delay; this.ease = ease; }
  at(now: number) { if (!this.dur) return this.to; const t = clamp((now - this.start - this.delay) / this.dur, 0, 1); return this.from + (this.to - this.from) * this.ease(t); }
  busy(now: number) { return !!this.dur && now < this.start + this.delay + this.dur; }
}

/** one coin: a face for the old loop, its other face for the new loop, and an edge of short segments round the rim, lit
 * from above (lighter along the top, darker underneath), so it reads as a solid disc of porcelain from any angle */
function coinHTML(k: number): string {
  const face = (m: Mode) => {
    const step = COIN_STEP[m][k] ?? COIN_STEP.new[k]!, s = LOOPS[m === 'old' && COIN_STEP.old[k] == null ? 'new' : m].steps[step];
    const n = String(step + 1).padStart(2, '0');
    const words = s.label.split(' ');
    const label = words.length > 1 ? `${esc(words[0])}<br>${esc(words.slice(1).join(' '))}` : esc(s.label);
    return `<span class="lp-face f-${m}" aria-hidden="true"><span class="lp-n">${n}</span>${icon(s.icon)}<b>${label}</b></span>`;
  };
  const rim = Array.from({ length: RIM }, (_, i) => {
    const a = (i * 360) / RIM, l = Math.round(70 + 22 * (0.5 + 0.5 * Math.cos(rad(a))));
    return `<i style="--a:${a.toFixed(2)}deg;--l:${l}%"></i>`;
  }).join('');
  return `<button class="lp-coin" type="button" data-coin="${k}"><span class="lp-rim" aria-hidden="true">${rim}</span>${face('old')}${face('new')}</button>`;
}

export function wireLoop(app: HTMLElement) {
  const wrap = app.querySelector<HTMLElement>('#loopWrap');
  if (!wrap) return;
  const reduce = reduceMotion();
  let mode: Mode = 'old', active = 0, timer = 0;

  wrap.innerHTML = `<div class="loop lp3" data-loop="old">
      <div class="lp3-stage" tabindex="0" role="group" aria-roledescription="3D loop" aria-label="The habit loop. Drag the ring, or use the left and right arrow keys, to turn it.">
        <div class="lp3-tilt">
          <div class="lp3-floor" aria-hidden="true"></div>
          <div class="lp3-hub" aria-hidden="true"><b></b><span></span></div>
          ${[0, 1, 2, 3].map(coinHTML).join('')}
          <span class="lp3-bead" aria-hidden="true"></span>
        </div>
        <p class="lp3-hint" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"/></svg>Drag to turn the loop</p>
      </div>
    </div>
    <div class="loopcard">
      <div class="toggle" role="group" aria-label="Which loop">
        <button type="button" data-mode="old" aria-pressed="true">The old loop</button>
        <button type="button" data-mode="new" aria-pressed="false">A new loop</button></div>
      <span class="eyebrow lp-step"></span>
      <h3 style="font-size:clamp(34px,4vw,50px)" aria-live="polite"></h3>
      <p style="font-size:19px" class="lp-text"></p>
      <div class="loopnav"><button class="btn line" type="button" data-step="-1">Back</button>
        <button class="btn" type="button" data-step="1">Next step</button>
        <button class="btn line" type="button" data-play="1">Play the loop</button></div>
      <p class="muted small lp-help"></p>
    </div>`;

  const root = wrap.querySelector<HTMLElement>('.lp3')!;
  const stage = root.querySelector<HTMLElement>('.lp3-stage')!;
  const tiltEl = root.querySelector<HTMLElement>('.lp3-tilt')!;
  const floor = root.querySelector<HTMLElement>('.lp3-floor')!;
  const hub = root.querySelector<HTMLElement>('.lp3-hub')!;
  const bead = root.querySelector<HTMLElement>('.lp3-bead')!;
  const coins = [...root.querySelectorAll<HTMLButtonElement>('.lp-coin')];
  const card = wrap.querySelector<HTMLElement>('.loopcard')!;

  // where each coin is on the hoop, how far it has risen (the pause) and how far it has turned over (old face to new)
  const ang = COIN_ANGLE.old.map(a => new Tween(a));
  const rise = COIN_STEP.old.map(s => new Tween(s == null ? 0 : 1));
  const flip = coins.map((_, k) => new Tween(k === 1 ? 1 : 0)); // the pause only ever shows its new-loop face
  const dip = new Tween(0); // the ring tips up a little towards the visitor as one loop becomes the other (steeper, so the coins clear its name)
  let spin = 0, spinTarget = 0, tilt = -26, tiltBase = -26, R = 200, D = 118, lift = 30, floorY = 90, hoopH = 12;
  let beadAt = 300, beadHold = 0, raf = 0, last = 0, inView = !('IntersectionObserver' in window);
  let down = false, dragging = false, justDragged = false, sx = 0, sy = 0, sSpin = 0, sTilt = 0, lastX = 0, lastT = 0, vel = 0;
  let shadows: SVGEllipseElement[] = [], trail: SVGCircleElement[] = [], pool: HTMLElement | null = null, beadLight: HTMLElement | null = null, ripple: SVGCircleElement | null = null, rippleAt = -1;

  // ---- the floor: a soft ground, the hoop built up from stacked rings (so it has a side wall), and on its top the path,
  // its arrows, the coins' shadows and the bead's light. Rebuilt when the stage changes size.
  const arcs = (m: Mode) => {
    const steps = LOOPS[m].steps.map((_, i) => COIN_ANGLE[m][COIN_OF(m, i)]), n = steps.length, gap = (D * 0.62 / R) * (180 / Math.PI);
    const p = (t: number) => `${(R * Math.sin(rad(t))).toFixed(1)} ${(R * Math.cos(rad(t))).toFixed(1)}`;
    return steps.map((a, i) => { const b = i === n - 1 ? 360 : steps[i + 1], a0 = a + gap, a1 = b - gap;
      return `<path d="M${p(a0)} A${R} ${R} 0 0 0 ${p(a1)}" marker-end="url(#lpArrow-${m})"/>`; }).join('');
  };
  const buildFloor = () => {
    const F = Math.round(2 * (R + D * 0.75)), h = F / 2;
    const layers = 6, hw = Math.max(10, D * 0.15);
    hoopH = layers * 2.2;
    floor.style.width = floor.style.height = `${F}px`;
    floor.innerHTML = `<span class="lp3-ground"></span><span class="lp3-pool" style="width:${(D * 2).toFixed(0)}px;height:${(D * 2).toFixed(0)}px"></span><span class="lp3-beadlight" style="width:${(D * 0.8).toFixed(0)}px;height:${(D * 0.8).toFixed(0)}px"></span>
      ${Array.from({ length: layers }, (_, i) => `<svg class="lp3-hoop" viewBox="${-h} ${-h} ${F} ${F}" style="transform:translateZ(${(i * 2.2).toFixed(1)}px)"><circle r="${R}" stroke-width="${hw}" style="stroke:hsl(28 22% ${(66 + 18 * i / (layers - 1)).toFixed(1)}%)"/></svg>`).join('')}
      <svg class="lp3-top" viewBox="${-h} ${-h} ${F} ${F}" style="transform:translateZ(${hoopH.toFixed(1)}px)">
        <defs>
          <filter id="lpSoft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${(D * 0.07).toFixed(1)}"/></filter>
          ${(['old', 'new'] as Mode[]).map(m => `<marker id="lpArrow-${m}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9 z" class="lp3-head"/></marker>`).join('')}
        </defs>
        <circle class="lp3-face" r="${R}" stroke-width="${hw}"/>
        <circle class="lp3-groove" r="${R}"/>
        <g class="lp3-shadows" filter="url(#lpSoft)">${coins.map(() => `<ellipse rx="${(D * 0.4).toFixed(1)}" ry="${(D * 0.4).toFixed(1)}"/>`).join('')}</g>
        <g class="lp3-arcs a-old">${arcs('old')}</g><g class="lp3-arcs a-new">${arcs('new')}</g>
        <circle class="lp3-ripple" r="1"/>
        <g class="lp3-trail">${Array.from({ length: 24 }, () => '<circle r="3"/>').join('')}</g>
      </svg>`;
    shadows = [...floor.querySelectorAll<SVGEllipseElement>('.lp3-shadows ellipse')];
    trail = [...floor.querySelectorAll<SVGCircleElement>('.lp3-trail circle')];
    pool = floor.querySelector('.lp3-pool'); beadLight = floor.querySelector('.lp3-beadlight'); ripple = floor.querySelector('.lp3-ripple');
  };

  const layout = () => {
    const w = stage.clientWidth, hgt = stage.clientHeight; if (!w || !hgt) return;
    const phone = w < 520;
    R = phone ? clamp(w * 0.33, 96, 140) : clamp(w * 0.35, 150, 210);
    D = phone ? clamp(w * 0.235, 80, 92) : clamp(w * 0.2, 104, 120);
    lift = D * 0.24; floorY = hgt * (phone ? 0.16 : 0.15);
    tiltBase = phone ? -34 : -27; if (!dragging) tilt = tiltBase;
    stage.style.setProperty('--coin', `${(D * SS).toFixed(1)}px`);
    stage.style.setProperty('--thick', `${Math.round(D * 0.11 * SS)}px`);
    buildFloor();
    paint(performance.now());
  };

  // ---- one frame
  const pt = (deg: number, r = R) => ({ x: r * Math.sin(rad(deg)), z: r * Math.cos(rad(deg)) });
  const paint = (now: number) => {
    tiltEl.style.transform = `rotateX(${(tilt - dip.at(now) * 7).toFixed(2)}deg)`;
    floor.style.transform = `translate(-50%, -50%) translateY(${floorY.toFixed(1)}px) rotateX(90deg) rotateZ(${(-spin).toFixed(2)}deg)`;
    const untilt = -(tilt - dip.at(now) * 7);
    coins.forEach((c, k) => {
      const a = ang[k].at(now), r = rise[k].at(now), f = flip[k].at(now), w = a + spin, p = pt(w);
      // (they hover still: a coin that kept drifting would be harder to tap)
      const y = floorY - hoopH - lift * (0.35 + 0.65 * r) - D / 2;
      // coins turn a little to face across the ring as they go round, and lean back a touch so their top edge shows
      const yaw = Math.sin(rad(w)) * 16;
      c.style.transform = `translate(-50%, -50%) translate3d(${p.x.toFixed(1)}px, ${y.toFixed(1)}px, ${p.z.toFixed(1)}px) rotateX(${(untilt - 8).toFixed(2)}deg) rotateY(${(yaw + f * 180).toFixed(2)}deg) scale(${((0.15 + 0.85 * r) / SS).toFixed(3)})`;
      c.style.opacity = r < 0.02 ? '0' : Math.min(1, r * 1.6).toFixed(3);
      c.style.visibility = r < 0.02 ? 'hidden' : '';
      // its shadow on the hoop, thrown away from the light (worked out in the scene and turned back into the hoop's own frame,
      // which turns with the ring), a little larger and fainter the higher it floats
      const s = shadows[k]; if (s) {
        const q = pt(a), h = 0.35 + 0.65 * r, co = Math.cos(rad(spin)), sn = Math.sin(rad(spin)), ox = SHADOW_DX * D * h, oz = SHADOW_DZ * D * h;
        s.setAttribute('cx', (q.x + ox * co - oz * sn).toFixed(1)); s.setAttribute('cy', (q.z + ox * sn + oz * co).toFixed(1));
        s.setAttribute('rx', (D * 0.4 * (0.9 + 0.2 * h)).toFixed(1)); s.setAttribute('ry', (D * 0.36 * (0.9 + 0.2 * h)).toFixed(1));
        s.setAttribute('opacity', (r * (0.62 - 0.18 * h)).toFixed(3));
      }
      // the bead lights a coin as it passes beneath it
      const d = Math.abs(angDiff(beadAt, a)), hit = r > 0.5 ? clamp(1 - d / 26, 0, 1) : 0;
      c.style.setProperty('--hit', hit.toFixed(3));
    });
    // the warm light under the coin being read
    const ac = COIN_OF(mode, active), aa = ang[ac].at(now), q = pt(aa);
    if (pool) pool.style.transform = `translate(-50%, -50%) translate(${q.x.toFixed(1)}px, ${q.z.toFixed(1)}px) translateZ(${(hoopH + 0.5).toFixed(1)}px)`;
    // the bead, on top of the hoop, and its fading trail
    // (it rides just clear of the hoop, and its glow lies on the hoop: a quad that cut through the floor's planes would be
    // split and drawn in pieces)
    const b = pt(beadAt + spin), by = floorY - hoopH - 11, bl = pt(beadAt);
    if (beadLight) beadLight.style.transform = `translate(-50%, -50%) translate(${bl.x.toFixed(1)}px, ${bl.z.toFixed(1)}px) translateZ(${(hoopH + 1).toFixed(1)}px)`;
    bead.style.transform = `translate(-50%, -50%) translate3d(${b.x.toFixed(1)}px, ${by.toFixed(1)}px, ${b.z.toFixed(1)}px) rotateX(${untilt.toFixed(2)}deg)`;
    trail.forEach((c, i) => { const tp = pt(beadAt - (i + 1) * 1.25), f = 1 - i / trail.length; c.setAttribute('cx', tp.x.toFixed(1)); c.setAttribute('cy', tp.z.toFixed(1)); c.setAttribute('r', (D * 0.045 * (0.35 + 0.65 * f)).toFixed(2)); c.setAttribute('opacity', (f * f * 0.5).toFixed(3)); });
    // the pause's ripple as it rises out of the hoop
    if (ripple) {
      const rt = rippleAt < 0 ? 1 : clamp((now - rippleAt) / 1100, 0, 1), rp = pt(COIN_ANGLE.new[1]);
      ripple.setAttribute('cx', rp.x.toFixed(1)); ripple.setAttribute('cy', rp.z.toFixed(1));
      ripple.setAttribute('r', (4 + rt * D * 0.9).toFixed(1)); ripple.setAttribute('opacity', (rt >= 1 ? 0 : (1 - rt) * 0.9).toFixed(3));
    }
    // the loop's name stands in the middle, lifted just above the hoop
    hub.style.transform = `translate(-50%, -50%) translate3d(0px, ${(floorY - hoopH - D * 0.42).toFixed(1)}px, 0px) rotateX(${untilt.toFixed(2)}deg)`;
  };

  // ---- the frame loop: runs while anything moves (and, with motion, while the loop is on screen, for the bead)
  const frame = (now: number) => {
    raf = 0;
    if (!root.isConnected) { cleanup(); return; }
    const dt = Math.min(64, now - (last || now)); last = now;
    if (!dragging) {
      const d = spinTarget - spin;
      spin = reduce ? spinTarget : spin + d * (1 - Math.pow(0.002, dt / 1000));
      if (Math.abs(d) < 0.02) spin = spinTarget;
      const dt2 = tiltBase - tilt; tilt = reduce ? tiltBase : tilt + dt2 * (1 - Math.pow(0.05, dt / 1000));
      if (Math.abs(dt2) < 0.02) tilt = tiltBase;
    }
    if (!reduce) {
      // autopilot: round and round without a stop. The new loop: slower, and it rests at the pause for a breath.
      if (beadHold > 0) beadHold -= dt;
      else {
        const speed = mode === 'old' ? 360 / 3.4 : 360 / 7.5, before = beadAt;
        beadAt = mod(beadAt + speed * dt / 1000, 360);
        const pa = ang[1].at(now);
        if (mode === 'new' && rise[1].at(now) > 0.9 && angDiff(before, pa) < 0 && angDiff(beadAt, pa) >= 0) { beadAt = pa; beadHold = 1400; }
      }
    }
    paint(now);
    const moving = spin !== spinTarget || tilt !== tiltBase || dragging || ang.some(x => x.busy(now)) || rise.some(x => x.busy(now)) || flip.some(x => x.busy(now)) || dip.busy(now) || (rippleAt >= 0 && now - rippleAt < 1100);
    if (moving || (!reduce && inView && !document.hidden)) raf = requestAnimationFrame(frame); else last = 0;
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  // ---- the words beside the loop, the coins' names and states
  const sync = () => {
    const L = LOOPS[mode], s = L.steps[active], n = L.steps.length;
    root.dataset.loop = mode;
    card.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
    card.querySelector('.lp-step')!.textContent = `Step ${active + 1} of ${n}`;
    card.querySelector('h3')!.textContent = s.label;
    card.querySelector('.lp-text')!.innerHTML = `<span class="d">${esc(s.text)}</span>`;
    card.querySelector<HTMLButtonElement>('[data-step="-1"]')!.disabled = active === 0;
    card.querySelector('[data-step="1"]')!.textContent = active === n - 1 ? 'Start again' : 'Next step';
    card.querySelector('[data-play]')!.textContent = timer ? 'Pause playing' : 'Play the loop';
    card.querySelector('.lp-help')!.textContent = mode === 'old' ? 'Tap a step or drag the ring, then switch to “A new loop” to see where coaching focuses.' : 'The pause is where a new response can start. Tap each step to follow the new loop.';
    hub.querySelector('b')!.textContent = L.title; hub.querySelector('span')!.textContent = L.note;
    coins.forEach((c, k) => {
      const step = COIN_STEP[mode][k];
      const live = step != null;
      c.classList.toggle('lp-node', live); c.classList.toggle('gone', !live);
      c.classList.toggle('on', live && step === active);
      if (live) {
        c.dataset.node = String(step); c.tabIndex = 0; c.removeAttribute('aria-hidden');
        c.setAttribute('aria-label', `${L.steps[step].label}, step ${step + 1} of ${n}`); c.setAttribute('aria-pressed', String(step === active));
      } else { delete c.dataset.node; c.tabIndex = -1; c.setAttribute('aria-hidden', 'true'); c.removeAttribute('aria-label'); c.removeAttribute('aria-pressed'); }
    });
  };

  // turn the ring so step i faces the visitor, the short way round
  const go = (i: number) => {
    const n = LOOPS[mode].steps.length;
    active = mod(i, n);
    const want = -COIN_ANGLE[mode][COIN_OF(mode, active)];
    spinTarget = want + Math.round((spinTarget - want) / 360) * 360;
    sync(); kick();
  };
  const stop = () => { if (timer) { clearInterval(timer); timer = 0; } };

  const setMode = (m: Mode) => {
    if (m === mode) { go(0); return; }
    const now = performance.now(), toNew = m === 'new', dur = reduce ? 0 : 1;
    mode = m;
    // the coins turn over one after another, slide to their new places, and the pause rises (or sinks back)
    flip.forEach((f, k) => { if (k !== 1) f.set(toNew ? 1 : 0, now, 900 * dur, (k === 0 ? 0 : k === 2 ? 140 : 280) * dur); });
    ang.forEach((a, k) => a.set(COIN_ANGLE[m][k], now, 1100 * dur, 160 * dur));
    rise[1].set(toNew ? 1 : 0, now, (toNew ? 1000 : 600) * dur, (toNew ? 520 : 0) * dur, toNew ? easeOutBack : easeInOut);
    if (toNew && !reduce) rippleAt = now + 520;
    dip.set(1, now, 450 * dur); window.setTimeout(() => dip.set(0, performance.now(), 900 * dur), 450 * dur);
    go(0);
  };

  // ---- the controls
  card.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b => b.addEventListener('click', () => { stop(); setMode(b.dataset.mode as Mode); }));
  card.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(b => b.addEventListener('click', () => { stop(); go(active + Number(b.dataset.step)); }));
  card.querySelector<HTMLButtonElement>('[data-play]')!.addEventListener('click', () => {
    if (timer) { stop(); sync(); return; }
    timer = window.setInterval(() => { if (!root.isConnected) { cleanup(); return; } go(active + 1); }, 2600);
    sync();
  });
  coins.forEach(c => c.addEventListener('click', e => {
    if (justDragged) { e.preventDefault(); return; }
    const s = c.dataset.node; if (s == null) return;
    stop(); go(Number(s)); c.focus({ preventScroll: true });
  }));
  stage.addEventListener('keydown', e => {
    const k = e.key, n = LOOPS[mode].steps.length;
    if (k === 'ArrowRight' || k === 'ArrowDown') { e.preventDefault(); stop(); go(active + 1); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp') { e.preventDefault(); stop(); go(active - 1); }
    else if (k === 'Home') { e.preventDefault(); stop(); go(0); }
    else if (k === 'End') { e.preventDefault(); stop(); go(n - 1); }
  });

  // drag / swipe: sideways turns the ring; with a mouse, up and down tips it a little further towards you or away.
  // The pointer is only captured once it has moved, so a plain tap still lands on the coin under it.
  stage.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    down = true; dragging = false; sx = lastX = e.clientX; sy = e.clientY; sSpin = spin; sTilt = tilt; vel = 0; lastT = performance.now();
  });
  stage.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - sx, dy = e.clientY - sy, now = performance.now();
    if (!dragging) {
      if (Math.abs(dx) < 7 || Math.abs(dx) < Math.abs(dy) * 0.8) { if (Math.abs(dy) > 12 && e.pointerType !== 'mouse') down = false; return; }
      dragging = true; stop(); stage.setPointerCapture(e.pointerId); stage.classList.add('grab', 'turned'); sx = e.clientX; sy = e.clientY;
    }
    const k = 160 / Math.max(180, R * 1.15);
    spin = sSpin + (e.clientX - sx) * k;
    if (e.pointerType === 'mouse') tilt = clamp(sTilt - (e.clientY - sy) * 0.08, -40, -14);
    vel = 0.8 * vel + 0.2 * ((e.clientX - lastX) * k / Math.max(1, now - lastT));
    lastX = e.clientX; lastT = now; kick();
  });
  const release = (e: PointerEvent) => {
    if (!down) return;
    down = false;
    if (!dragging) return;
    dragging = false; stage.classList.remove('grab');
    if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
    // settle on the step nearest the front, carried on a little by the flick
    const proj = spin + vel * 160, steps = LOOPS[mode].steps.length;
    let best = 0, bd = 999;
    for (let i = 0; i < steps; i++) { const d = Math.abs(angDiff(COIN_ANGLE[mode][COIN_OF(mode, i)] + proj, 0)); if (d < bd) { bd = d; best = i; } }
    spinTarget = proj; active = best;
    const want = -COIN_ANGLE[mode][COIN_OF(mode, best)];
    spinTarget = want + Math.round((proj - want) / 360) * 360;
    justDragged = true; window.setTimeout(() => { justDragged = false; }, 60);
    sync(); kick();
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);

  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { inView = e.isIntersecting; if (inView) kick(); }), { rootMargin: '60px' }) : null;
  io?.observe(stage);
  const ro = 'ResizeObserver' in window ? new ResizeObserver(layout) : null;
  ro?.observe(stage);
  const onVis = () => { if (!root.isConnected) cleanup(); else if (!document.hidden) kick(); };
  document.addEventListener('visibilitychange', onVis);
  // the router replaces the page: the frame loop, the player and the observers all stop once the loop is gone
  function cleanup() { stop(); io?.disconnect(); ro?.disconnect(); document.removeEventListener('visibilitychange', onVis); if (raf) cancelAnimationFrame(raf); raf = 0; }

  sync();
  layout();
  kick();
}
