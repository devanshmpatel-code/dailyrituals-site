// Motion that responds to scroll, in the spirit of product pages that "play" as you read:
//  - statements that light up word by word (.say)
//  - pictures that open out of a leaf or arch shape as they arrive
// (The product page's sticky local nav lives in src/nav.ts.)
// Scrolling is never hijacked: everything follows the visitor's own scroll. With reduced motion, content is simply shown.

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let cleanups: (() => void)[] = [];

export function cleanupMotion() {
  cleanups.forEach(f => f()); cleanups = [];
}

/** Run fn on scroll and resize, at most once a frame. */
function onScrollFrame(fn: () => void) {
  let ticking = false;
  const h = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; fn(); }); } };
  window.addEventListener('scroll', h, { passive: true }); window.addEventListener('resize', h);
  cleanups.push(() => { window.removeEventListener('scroll', h); window.removeEventListener('resize', h); });
  fn();
}

// ---------- statements that light up as you read ----------
export function mountSay(app: HTMLElement) {
  const lines = [...app.querySelectorAll<HTMLElement>('.say')];
  if (!lines.length) return;
  const sets = lines.map(el => {
    if (!el.dataset.split) {
      el.setAttribute('aria-label', el.textContent?.trim() ?? '');
      el.innerHTML = (el.textContent ?? '').trim().split(/\s+/).map(w => `<span class="w" aria-hidden="true">${w}</span>`).join(' ');
      el.dataset.split = '1';
    }
    return { el, words: [...el.querySelectorAll<HTMLElement>('.w')] };
  });
  if (reduce()) { sets.forEach(s => s.words.forEach(w => w.classList.add('on'))); return; }
  onScrollFrame(() => sets.forEach(({ el, words }) => {
    const r = el.getBoundingClientRect(), vh = window.innerHeight;
    // starts lighting when the line reaches 85% down the screen, fully lit by 40%
    const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (vh * 0.45)));
    const n = Math.round(p * words.length);
    words.forEach((w, i) => w.classList.toggle('on', i < n));
  }));
}

// ---------- pictures that open out of a shape ----------
const SHAPE_TARGETS = '.disc .ph, .claire-in .ph, .wall .tile, .coachflow .cf-ph, .drop-img, .st-ph, .giftsec .gcard';
export function mountShapes(app: HTMLElement) {
  if (reduce() || !('IntersectionObserver' in window)) return;
  const els = [...app.querySelectorAll<HTMLElement>(SHAPE_TARGETS)].filter(el => el.getBoundingClientRect().top > window.innerHeight * 0.95);
  if (!els.length) return;
  els.forEach((el, i) => { el.classList.add('shape-in'); el.style.setProperty('--sd', `${(i % 4) * 90}ms`); });
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('open'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
  els.forEach(el => io.observe(el));
  cleanups.push(() => { io.disconnect(); els.forEach(el => el.classList.remove('shape-in', 'open')); });
}

// ---------- page-to-page morph ----------
/** Mark the picture of a clicked product card so the view transition can glide it into the product page. */
export function markMorphSource(a: HTMLAnchorElement) {
  document.querySelectorAll<HTMLElement>('[style*="view-transition-name"]').forEach(el => { el.style.viewTransitionName = ''; });
  if (!/\/product\//.test(a.getAttribute('href') ?? '')) return;
  const img = a.closest('.card, .sp, .tile')?.querySelector<HTMLElement>('img') ?? a.querySelector<HTMLElement>('img');
  if (img) img.style.viewTransitionName = 'product-hero';
}
/** On a product page, the main picture is the morph target. Cleared once the transition has finished. */
export function markMorphTarget(app: HTMLElement) {
  const img = app.querySelector<HTMLElement>('.mainimg img');
  if (img) img.style.viewTransitionName = 'product-hero';
}
