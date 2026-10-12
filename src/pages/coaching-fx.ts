// The coaching page's quieter motion: Claire's arch tilts a little toward the pointer (the words orbiting her sit at
// different depths, so they part as it turns), sections ease in as they arrive, and on phones the two free ways in
// stay one tap away in a small bar at the foot of the screen. With reduced motion nothing moves and every section shows.

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

export function mountCoachingFx(app: HTMLElement) {
  document.body.classList.remove('co-docked');
  tiltPortal(app);
  reveal(app);
  dock(app);
}
