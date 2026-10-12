// The breathing orb: one floating button on every page that opens the one-minute breathing pause.
// It breathes on its own: four seconds in, four seconds out, with soft ripples, and its colours follow the time of day.
// A small label alternates "Breathe in" / "Breathe out" in time with it, on hover and focus only.
// With reduced motion it stays still.
import { openBreathe } from './journey';
import { MOMENTS } from '../config';

const LOTUS = '<svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M16 25c-3.2-3.4-3.2-9.6 0-15 3.2 5.4 3.2 11.6 0 15z"/><path d="M16 25c-5-1-8.6-5-8.6-11 4.6 1.2 7.4 4.6 8.6 11z"/><path d="M16 25c5-1 8.6-5 8.6-11-4.6 1.2-7.4 4.6-8.6 11z"/><path d="M7 27h18"/></svg>';

function hourNow() { const d = new Date(); return d.getHours() + d.getMinutes() / 60; }
function momentNow() { const h = hourNow(); return MOMENTS.reduce((a, b) => (Math.abs(b.hour - h) < Math.abs(a.hour - h) ? b : a)); }

export function mountBreathButton() {
  document.querySelectorAll('.breathorb').forEach(n => n.remove());
  const m = momentNow();
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'breathorb';
  b.setAttribute('aria-label', 'Take a breath: a one-minute guided pause');
  b.style.setProperty('--bo-a', m.orb);
  b.style.setProperty('--bo-b', m.sky[1]);
  b.style.setProperty('--bo-c', m.sky[0]);
  b.innerHTML = `<span class="bo-orb" aria-hidden="true"><i class="r r1"></i><i class="r r2"></i><i class="r r3"></i><span class="bo-core">${LOTUS}</span></span>
    <span class="bo-say" aria-hidden="true"><span class="in">Breathe in</span><span class="out">Breathe out</span></span>`;
  b.addEventListener('click', () => openBreathe(b));
  document.body.appendChild(b);
  // the label only shows on hover or focus: the breathing orb speaks for itself and never covers the page
  watchScroll();
}

// ---------- on phones the orb steps aside ----------
// The orb floats over the page's bottom-right corner, where on a phone the text, prices and buttons run right to the edge.
// While the visitor scrolls down it slips away; it comes back when they scroll up or pause, but only if nothing they can
// press (a button, a link, a field, a price) sits under it at that moment; otherwise it waits for the next pause. At the top
// of a page it always shows, and keyboard focus always brings it back (it stays in the tab order with its label throughout).
const PHONE = '(max-width: 820px)';
const PRESSABLE = 'a[href], button, input, select, textarea, label, summary, [role="button"], [role="tab"], .price, .btn';
let watching = false, lastY = 0, idle = 0;

/** True when no pressable thing lies under the orb's footprint. */
export function orbSpotClear(b: HTMLElement): boolean {
  // the resting footprint (offset* ignore the slide while it is tucked away; a fixed element's offsets are viewport ones)
  const r = { left: b.offsetLeft, top: b.offsetTop, right: b.offsetLeft + b.offsetWidth, bottom: b.offsetTop + b.offsetHeight, width: b.offsetWidth, height: b.offsetHeight };
  const pts: [number, number][] = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 4, r.top + 4], [r.right - 4, r.top + 4], [r.left + 4, r.bottom - 4], [r.right - 4, r.bottom - 4]];
  return pts.every(([x, y]) => document.elementsFromPoint(x, y).every(el => b.contains(el) || !el.closest(PRESSABLE) || !!el.closest('.breathorb')));
}

function setTucked(on: boolean) {
  const b = document.querySelector<HTMLElement>('.breathorb');
  if (!b) return;
  b.classList.toggle('bo-tucked', on && b !== document.activeElement);
}

function watchScroll() {
  if (watching) return;
  watching = true;
  lastY = window.scrollY;
  window.addEventListener('scroll', () => {
    if (!window.matchMedia(PHONE).matches) { setTucked(false); return; }
    const y = window.scrollY, dy = y - lastY; lastY = y;
    const b = document.querySelector<HTMLElement>('.breathorb');
    if (!b) return;
    window.clearTimeout(idle);
    if (y < 80) setTucked(false);
    else if (dy > 2) setTucked(true);
    else if (dy < -2) setTucked(!orbSpotClear(b));
    // after a pause it comes back if the spot under it is free
    idle = window.setTimeout(() => { if (window.scrollY < 80 || orbSpotClear(b)) setTucked(false); }, 900);
  }, { passive: true });
  window.addEventListener('resize', () => { if (!window.matchMedia(PHONE).matches) setTucked(false); });
}
