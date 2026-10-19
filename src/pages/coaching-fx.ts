// The coaching page's quieter motion: Claire's arch tilts a little toward the pointer (the new loop orbiting her sits at
// different depths, so it parts as it turns), sections ease in as they arrive, and on phones the two free ways in
// stay one tap away in a small bar at the foot of the screen; the night's stars keep out of the words. With reduced motion
// nothing moves and every section shows.
import { CUE_STEPS } from './coaching-cue';

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- the opening: the new loop orbiting Claire ----------------
 * The page's new loop (cue, pause, chosen response, repeat: the same four steps and colours as the calm-cue loop further
 * down) as a ring in perspective round Claire's arch. Its back half is drawn behind the arch and its front half over it, so
 * the ring passes behind her head and in front of her; a lit bead travels it clockwise, through the four steps in order,
 * and rests a breath at the pause, each step's chip lighting in its own colour as the bead reaches it. The geometry is in
 * the portal's own units (its box is 500 x 610), so it scales with the portal. With reduced motion the bead rests at the
 * pause and nothing travels. */
const RING = { cx: 250, cy: 330, rx: 274, ry: 112, rot: -7 };
/** where each step sits round the ring, in degrees (clockwise from the right-hand end): cue and pause on the far side,
 * either side of her head; chosen response and repeat on the near side */
const STATION = [208, 332, 388, 512];
const PAUSE = 1;
const ringPt = (deg: number) => {
  const t = deg * Math.PI / 180, r = RING.rot * Math.PI / 180, dx = RING.rx * Math.cos(t), dy = RING.ry * Math.sin(t);
  return { x: RING.cx + dx * Math.cos(r) - dy * Math.sin(r), y: RING.cy + dx * Math.sin(r) + dy * Math.cos(r) };
};
/** the ring as a fine polyline (one point every two degrees) and the distance along it at each point, so the bead and its
 * lit trail agree exactly */
const RING_PTS = Array.from({ length: 181 }, (_, i) => ringPt(i * 2));
const RING_LEN = RING_PTS.reduce<number[]>((a, q, i) => { a.push(i ? a[i - 1] + Math.hypot(q.x - RING_PTS[i - 1].x, q.y - RING_PTS[i - 1].y) : 0); return a; }, []);
const RING_D = RING_PTS.map((q, i) => `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`).join('') + 'Z';
const along = (deg: number) => { const a = ((deg % 360) + 360) % 360 / 2, i = Math.floor(a), f = a - i; return RING_LEN[i] + (RING_LEN[Math.min(180, i + 1)] - RING_LEN[i]) * f; };
const TOTAL = RING_LEN[180];
const TRAIL = 120;

/** a chevron on the ring at `deg`, pointing the way the loop runs */
const chevron = (deg: number) => {
  const p = ringPt(deg), q = ringPt(deg + 1), a = Math.atan2(q.y - p.y, q.x - p.x) * 180 / Math.PI;
  return `<path d="M-5 -5.5 L1.5 0 L-5 5.5" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${a.toFixed(1)})"/>`;
};

const ringSVG = (k: 'b' | 'f') => {
  const front = k === 'f';
  // (no blur filters on anything that moves: a blurred trail would be blurred again every frame. The trail's glow is two soft
  // wide strokes, and the bead is an element of its own (heroLoop), moved by the compositor without painting the ring again)
  return `<svg viewBox="0 0 500 610" preserveAspectRatio="none" focusable="false"><defs>
    <linearGradient id="coRg${k}" gradientUnits="userSpaceOnUse" x1="-40" y1="0" x2="540" y2="0">
      <stop offset="0" stop-color="${CUE_STEPS[0].hue}"/><stop offset=".3" stop-color="#F3D29A"/><stop offset=".55" stop-color="${CUE_STEPS[1].hue}"/><stop offset=".8" stop-color="${CUE_STEPS[2].hue}"/><stop offset="1" stop-color="${CUE_STEPS[3].hue}"/></linearGradient>
    ${front ? `<clipPath id="coFr"><rect x="-400" y="${RING.cy}" width="1300" height="700" transform="rotate(${RING.rot} ${RING.cx} ${RING.cy})"/></clipPath>` : ''}
  </defs><g${front ? ' clip-path="url(#coFr)"' : ''}>
    ${front ? `<path class="co-rg-shade" d="${RING_D}"/>` : ''}
    <path class="co-rg-line" d="${RING_D}" stroke="url(#coRg${k})"/>
    <path class="co-rg-glow" d="${RING_D}" stroke-dasharray="${TRAIL} ${(TOTAL - TRAIL).toFixed(1)}"/>
    <path class="co-rg-glow g2" d="${RING_D}" stroke-dasharray="${TRAIL} ${(TOTAL - TRAIL).toFixed(1)}"/>
    <path class="co-rg-trail" d="${RING_D}" stroke-dasharray="${TRAIL} ${(TOTAL - TRAIL).toFixed(1)}"/>
    <g class="co-rg-arrows">${[0, 90, 180].map(chevron).join('')}</g>
  </g></svg><span class="co-bead"><i></i></span>`;
};

function heroLoop(app: HTMLElement) {
  const tilt = app.querySelector<HTMLElement>('#coPortal .co-tilt');
  const layers = [...app.querySelectorAll<HTMLElement>('#coPortal .co-orbit')];
  const chips = [...app.querySelectorAll<HTMLElement>('#coPortal .co-loop .co-chip')];
  if (!tilt || !layers.length || chips.length !== STATION.length) return;
  layers.forEach(l => { l.innerHTML = ringSVG(l.classList.contains('front') ? 'f' : 'b'); });
  // each chip's numbered coin sits on the ring at its step; the chip's words reach in towards Claire
  chips.forEach((c, i) => {
    const p = ringPt(STATION[i]);
    c.style.setProperty('--x', (p.x / 5).toFixed(2)); c.style.setProperty('--y', (p.y / 6.1).toFixed(2));
    c.style.setProperty('--hue', CUE_STEPS[i].hue);
  });
  const beads = layers.map(l => l.querySelector<HTMLElement>('.co-bead')!);
  const front = layers.findIndex(l => l.classList.contains('front'));
  const trails = layers.flatMap(l => [...l.querySelectorAll<SVGPathElement>('.co-rg-trail, .co-rg-glow')]);
  // the ring is drawn in the portal's own units (500 x 610); the bead is placed in px, so the portal's size is kept to hand
  let W = 500, H = 610, lastTrail = -1e9;
  let at = STATION[PAUSE];
  const measure = () => { W = layers[0].clientWidth || W; H = layers[0].clientHeight || H; };
  measure();
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { if (!tilt.isConnected) { ro?.disconnect(); return; } measure(); draw(at); }) : null; ro?.observe(layers[0]);
  const rr = RING.rot * Math.PI / 180;
  let on = -1;
  const draw = (deg: number, now = 0) => {
    at = deg;
    const p = ringPt(deg), d = along(deg), x = (p.x / 500) * W, y = (p.y / 610) * H;
    // in front of her only on the near half of the ring (the front layer's ring is clipped to that half; its bead follows,
    // fading over a few px at the ends, where the ring turns behind her)
    const side = -(p.x - RING.cx) * Math.sin(rr) + (p.y - RING.cy) * Math.cos(rr);
    beads.forEach((b, i) => { b.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`; if (i === front) b.style.opacity = Math.max(0, Math.min(1, side / 6 + 0.5)).toFixed(2); });
    // the lit trail is part of the drawn ring, so redrawing it costs a repaint of the ring: thirty times a second is plenty
    // for a soft trail, while the bead itself moves every frame
    if (now - lastTrail > 30 || !now) { lastTrail = now; trails.forEach(t => t.setAttribute('stroke-dashoffset', (((TRAIL - d) % TOTAL + TOTAL) % TOTAL).toFixed(1))); }
    // the step the bead is at lights up, and the bead takes on its colour
    const near = STATION.findIndex(s => { const x = ((deg - s) % 360 + 540) % 360 - 180; return x > -26 && x < 30; });
    if (near !== on) {
      on = near;
      chips.forEach((c, i) => c.classList.toggle('on', i === near));
      if (near >= 0) tilt.style.setProperty('--bead', CUE_STEPS[near].hue);
    }
  };
  if (reduce()) { draw(STATION[PAUSE]); return; }

  const SPEED = 360 / 11; // degrees a second: once round in eleven seconds, plus the rest at the pause
  let deg = STATION[0] - 40, hold = 0, last = 0, raf = 0, seen = true;
  const frame = (now: number) => {
    raf = 0;
    if (!tilt.isConnected) { ro?.disconnect(); return; }
    const dt = last ? Math.min(.25, (now - last) / 1000) : 0; last = now;
    if (now >= hold) {
      const next = deg + SPEED * dt;
      // arriving at the pause: rest there for a breath
      const k = Math.floor((next - STATION[PAUSE]) / 360), s = STATION[PAUSE] + 360 * k;
      if (deg < s && next >= s) { deg = s; hold = now + 1500; } else deg = next;
      if (deg > 720 + STATION[0]) deg -= 360;
    }
    draw(deg, now);
    if (seen) raf = requestAnimationFrame(frame);
  };
  draw(deg);
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => {
    seen = es.some(e => e.isIntersecting);
    if (!tilt.isConnected) { io?.disconnect(); return; }
    if (seen && !raf) { last = 0; raf = requestAnimationFrame(frame); }
  }) : null;
  if (io) io.observe(tilt); else raf = requestAnimationFrame(frame);
}

function tiltPortal(app: HTMLElement) {
  const portal = app.querySelector<HTMLElement>('#coPortal');
  const tilt = portal?.querySelector<HTMLElement>('.co-tilt');
  if (!portal || !tilt || reduce() || !window.matchMedia('(pointer: fine)').matches) return;
  let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
  const step = () => {
    raf = 0;
    cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
    tilt.style.setProperty('--ry', `${cx.toFixed(2)}deg`); tilt.style.setProperty('--rx', `${cy.toFixed(2)}deg`);
    if (Math.abs(tx - cx) > 0.01 || Math.abs(ty - cy) > 0.01) raf = requestAnimationFrame(step);
  };
  const hero = portal.closest<HTMLElement>('.co-hero') ?? portal;
  hero.addEventListener('pointermove', e => {
    const r = portal.getBoundingClientRect();
    tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width))) * 9;
    ty = -Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height))) * 6;
    if (!raf) raf = requestAnimationFrame(step);
  });
  hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(step); });
}

function reveal(app: HTMLElement) {
  const els = [...app.querySelectorAll<HTMLElement>('.co-rv')];
  if (reduce() || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
  els.forEach(e => { if (e.getBoundingClientRect().top < innerHeight * 0.92) e.classList.add('in'); else io.observe(e); });
}

/** Phones: a small bar with both free offers once the opening's buttons have been scrolled past (not before: on the first
 * screen it would sit over the opening's own words), hidden again at the last call to action. It also steps aside while the
 * foot of the screen holds something to work (the two loops and their controls, the cue kit, the call's own
 * buttons), so it never sits over a control. While it shows, the page keeps room for it: anything scrolled to or focused
 * stops above it rather than under it. */
function dock(app: HTMLElement) {
  const bar = app.querySelector<HTMLElement>('#coDock');
  const heroCta = app.querySelector<HTMLElement>('#coHeroCta');
  const final = app.querySelector<HTMLElement>('#coFinal');
  document.querySelectorAll('body > .co-dock').forEach(n => n.remove());
  if (!bar || !heroCta || !final || !('IntersectionObserver' in window)) return;
  // the page wrapper keeps a transform from its entrance, which would pin a fixed bar to the page instead of the screen
  document.body.appendChild(bar);
  bar.hidden = false;
  let heroOut = false, atEnd = false, busy = false;
  const work = [...app.querySelectorAll<HTMLElement>('.loopcard, .lp3-stage, .cue-stage, .cue-panel, .cue-flat, .co-kit-stage, .co-call-in')];
  const sync = () => {
    if (!heroCta.isConnected) { gone(); return; }
    const show = heroOut && !atEnd && !busy;
    bar.classList.toggle('show', show);
    bar.toggleAttribute('inert', !show);
    document.body.classList.toggle('co-docked', show && matchMedia('(max-width: 820px)').matches);
  };
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.target === final) atEnd = e.isIntersecting;
    sync();
  }), { threshold: 0 });
  io.observe(final);
  // whether the opening's buttons are above the screen: measured on scroll, since a jump down the page carries them from
  // below the screen to above it without ever crossing it (which is all an intersection observer would report)
  let raf = 0;
  const onScroll = () => { if (raf) return; raf = requestAnimationFrame(() => {
    raf = 0; if (!heroCta.isConnected) return;
    const out = heroCta.getBoundingClientRect().bottom < 0, foot = innerHeight - 96;
    const b = out && work.some(e => { const r = e.getBoundingClientRect(); return r.bottom > foot && r.top < innerHeight; });
    if (out !== heroOut || b !== busy) { heroOut = out; busy = b; sync(); }
  }); };
  addEventListener('scroll', onScroll, { passive: true });
  // leaving the page: the bar goes with it, and the breathing orb drops back down
  const gone = () => { io.disconnect(); mo.disconnect(); removeEventListener('scroll', onScroll); bar.remove(); document.body.classList.remove('co-docked'); };
  const mo = new MutationObserver(() => { if (!heroCta.isConnected) gone(); });
  mo.observe(app, { childList: true });
  sync(); onScroll();
}

// the blocks of words a star must never land in (the outermost of them: a paragraph, not each of its links)
const WORDS = 'h1, h2, h3, h4, p, li, blockquote, figcaption, label, .eyebrow, .crumbs, .btn, .cue-panel, .cue-hint';

/**
 * The night sections' starfield keeps out of the words: a star in the gap between two words reads as a typo ("the·ring").
 * Each starfield gets a mask with a soft hole over every block of words in its section, measured from the layout (offsets,
 * so the sections' entrance movement does not throw them off) and again whenever the section changes size. Without CSS
 * masks the stars simply stay where they are.
 */
function starsClearOfWords(app: HTMLElement) {
  if (!CSS.supports('mask-image', 'url("x.svg")') && !CSS.supports('-webkit-mask-image', 'url("x.svg")')) return;
  const PAD = 8;
  const fields = [...app.querySelectorAll<HTMLElement>('.co-stars')];
  const box = (el: HTMLElement, root: HTMLElement) => { // el's box in root's padding box, from offsets (transforms ignored)
    let x = 0, y = 0, n: HTMLElement | null = el;
    while (n && n !== root) { x += n.offsetLeft; y += n.offsetTop; const next = n.offsetParent as HTMLElement | null; if (next && next !== root && !root.contains(next)) return null; n = next; }
    return n === root ? { x, y, w: el.offsetWidth, h: el.offsetHeight } : null;
  };
  const paint = (field: HTMLElement) => {
    const sec = field.parentElement; if (!sec || !field.isConnected) return;
    const W = field.offsetWidth, H = field.offsetHeight; if (!W || !H) return;
    const all = [...sec.querySelectorAll<HTMLElement>(WORDS)].filter(e => e.offsetWidth && e.offsetHeight);
    const outer = all.filter(e => !all.some(o => o !== e && o.contains(e)));
    const holes = outer.map(e => box(e, sec)).filter(Boolean).map(r => `<rect x="${(r!.x - field.offsetLeft - PAD).toFixed(0)}" y="${(r!.y - field.offsetTop - PAD).toFixed(0)}" width="${(r!.w + PAD * 2).toFixed(0)}" height="${(r!.h + PAD * 2).toFixed(0)}" rx="${PAD * 2}"/>`).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><filter id="s"><feGaussianBlur stdDeviation="4"/></filter><mask id="m"><rect width="${W}" height="${H}" fill="#fff"/><g fill="#000" filter="url(#s)">${holes}</g></mask></defs><rect width="${W}" height="${H}" mask="url(#m)"/></svg>`;
    const url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    field.style.maskImage = url; field.style.setProperty('-webkit-mask-image', url);
    field.style.maskSize = field.style.webkitMaskSize = '100% 100%'; field.style.maskRepeat = field.style.webkitMaskRepeat = 'no-repeat';
  };
  let raf = 0;
  const all = () => { raf = 0; fields.forEach(paint); };
  const later = () => { if (!raf) raf = requestAnimationFrame(all); };
  const ro = 'ResizeObserver' in window ? new ResizeObserver(later) : null;
  fields.forEach(f => { if (f.parentElement) { ro?.observe(f.parentElement); f.parentElement.addEventListener('transitionend', later); } });
  document.fonts?.ready.then(later);
  // the router replaces the page: stop measuring once the sections are gone
  const mo = new MutationObserver(() => { if (!fields[0]?.isConnected) { ro?.disconnect(); mo.disconnect(); } });
  mo.observe(app, { childList: true });
  later();
}

/** The sections' never-ending motion (the stars, the loops' paths, the pause light's breath, the cue kit's drift) rests while
 * a section is off screen, so a page this long costs nothing for what nobody is looking at (the breathing screen opened over
 * it keeps its frames to itself). */
function restOffscreen(app: HTMLElement) {
  if (!('IntersectionObserver' in window)) return;
  const secs = [...app.querySelectorAll<HTMLElement>('.co > section')];
  const io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('co-idle', !e.isIntersecting)), { rootMargin: '120px 0px' });
  secs.forEach(s => io.observe(s));
  const mo = new MutationObserver(() => { if (!secs[0]?.isConnected) { io.disconnect(); mo.disconnect(); } });
  mo.observe(app, { childList: true });
}

export function mountCoachingFx(app: HTMLElement) {
  document.body.classList.remove('co-docked');
  restOffscreen(app);
  heroLoop(app);
  tiltPortal(app);
  reveal(app);
  dock(app);
  starsClearOfWords(app);
}
