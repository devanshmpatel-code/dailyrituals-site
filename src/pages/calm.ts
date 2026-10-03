import { MOMENTS } from '../config';
import { openBreathe } from './journey';
import { ornament } from './symbols';
import { swapRenders } from '../photos';

// The calm layer shared by every page except the home journey: real photographs in place of renders, a faint mandala behind
// the page heading, things below the fold easing in, a tone that matches the hour, and a button for one mindful breath.
let io: IntersectionObserver | null = null;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function nowMoment() {
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
  const dist = (a: number, b: number) => { const x = Math.abs(a - b); return Math.min(x, 24 - x); };
  return MOMENTS.reduce((a, b) => (dist(b.hour, h) < dist(a.hour, h) ? b : a));
}

/** Keep heading levels in order for screen readers without changing how anything looks. */
function normalizeHeadings(root: HTMLElement) {
  let prev = 0;
  root.querySelectorAll<HTMLElement>('h1, h2, h3, h4').forEach(h => {
    const level = Number(h.getAttribute('aria-level') || h.tagName[1]);
    if (prev && level > prev + 1) h.setAttribute('aria-level', String(prev + 1));
    prev = Number(h.getAttribute('aria-level') || h.tagName[1]);
  });
}

export function decoratePage(app: HTMLElement, seg: string) {
  swapRenders(app);
  normalizeHeadings(app);
  document.querySelectorAll('.jfab').forEach(n => n.remove());
  io?.disconnect(); io = null;
  if (seg === '') return; // the home page has its own journey

  // a soft wash in the colour of the current hour
  if (!document.querySelector('.jwash')) {
    const m = nowMoment(), w = document.createElement('div');
    w.className = 'jwash'; w.setAttribute('aria-hidden', 'true'); w.style.setProperty('--w0', m.sky[0]); w.style.setProperty('--w1', m.sky[1]); w.style.opacity = '.14';
    document.body.appendChild(w);
  }
  // a mandala behind the page heading
  const h1 = app.querySelector<HTMLElement>('h1');
  const host = app.querySelector<HTMLElement>('.phead') ?? h1?.parentElement ?? null;
  if (host && !host.querySelector(':scope > .jorn')) { host.classList.add('jhead'); host.insertAdjacentHTML('afterbegin', ornament([...seg].reduce((n, c) => n + c.charCodeAt(0), 0))); }

  // things below the fold ease in
  if (!reduceMotion() && 'IntersectionObserver' in window) {
    const targets = [...app.querySelectorAll<HTMLElement>('.wrap > section, .wrap > div, main > section, main > div')]
      .filter(el => !el.classList.contains('jorn') && el.getBoundingClientRect().top > window.innerHeight * 0.95 && el.offsetHeight > 40);
    targets.forEach(t => t.setAttribute('data-reveal', ''));
    io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { (e.target as HTMLElement).classList.add('in'); io?.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px', threshold: 0.03 });
    targets.forEach(t => io!.observe(t));
  }

  // one mindful breath, on every page
  const b = document.createElement('button');
  b.className = 'jbtn jfab'; b.setAttribute('aria-label', 'Take a breath'); b.title = 'Take a breath';
  b.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 20c-4 0-8-3-9-9 4 0 7 2 9 5 2-3 5-5 9-5-1 6-5 9-9 9z"/><path d="M12 16c-2-3-2-7 0-11 2 4 2 8 0 11z"/></svg>';
  b.addEventListener('click', () => openBreathe(b));
  document.body.appendChild(b);
}
