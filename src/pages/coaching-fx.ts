// The coaching page's quieter motion: Claire's arch tilts a little toward the pointer (the words orbiting her sit at
// different depths, so they part as it turns), sections ease in as they arrive, and on phones the two free ways in
// stay one tap away in a small bar at the foot of the screen; the night's stars keep out of the words. With reduced motion
// nothing moves and every section shows.

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

/** Phones: a small bar with both free offers whenever the opening's buttons are out of sight (below the fold at first, or scrolled past), hidden at the last call to action. */
function dock(app: HTMLElement) {
  const bar = app.querySelector<HTMLElement>('#coDock');
  const heroCta = app.querySelector<HTMLElement>('#coHeroCta');
  const final = app.querySelector<HTMLElement>('#coFinal');
  document.querySelectorAll('body > .co-dock').forEach(n => n.remove());
  if (!bar || !heroCta || !final || !('IntersectionObserver' in window)) return;
  // the page wrapper keeps a transform from its entrance, which would pin a fixed bar to the page instead of the screen
  document.body.appendChild(bar);
  bar.hidden = false;
  let heroOut = false, atEnd = false;
  const sync = () => {
    if (!heroCta.isConnected) { gone(); return; }
    const show = heroOut && !atEnd;
    bar.classList.toggle('show', show);
    bar.toggleAttribute('inert', !show);
    document.body.classList.toggle('co-docked', show && matchMedia('(max-width: 820px)').matches);
  };
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.target === heroCta) heroOut = !e.isIntersecting;
    if (e.target === final) atEnd = e.isIntersecting;
    sync();
  }), { threshold: 0 });
  io.observe(heroCta); io.observe(final);
  // leaving the page: the bar goes with it, and the breathing orb drops back down
  const gone = () => { io.disconnect(); mo.disconnect(); bar.remove(); document.body.classList.remove('co-docked'); };
  const mo = new MutationObserver(() => { if (!heroCta.isConnected) gone(); });
  mo.observe(app, { childList: true });
  sync();
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

export function mountCoachingFx(app: HTMLElement) {
  document.body.classList.remove('co-docked');
  tiltPortal(app);
  reveal(app);
  dock(app);
  starsClearOfWords(app);
}
