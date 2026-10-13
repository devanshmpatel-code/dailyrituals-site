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
  // keyboard focus always brings it out; leaving it, it steps aside again if it is over something
  b.addEventListener('focus', () => b.classList.remove('bo-tucked'));
  b.addEventListener('blur', () => window.setTimeout(settle, 50));
  document.body.appendChild(b);
  // the label only shows on hover or focus: the breathing orb speaks for itself and never covers the page
  watchScroll();
  // on a phone or tablet it first looks at what the page has put under it (once the page has laid out, and again once
  // pictures and fonts have settled)
  window.clearTimeout(settleT1); window.clearTimeout(settleT2);
  settleT1 = window.setTimeout(settle, 450);
  settleT2 = window.setTimeout(settle, 1400);
}

// ---------- on phones and tablets the orb steps aside ----------
// The orb floats over the page's bottom-right corner, where on a phone the words, prices and buttons run right to the
// edge. It only shows where nothing lies under it: no words, and nothing to press (a button, a link, a field, a price),
// at the top of a page too. While the visitor scrolls down it slips away; when they scroll up or pause it comes back if
// the spot under it is clear, and otherwise waits for the next pause. Keyboard focus always brings it back (it stays in
// the tab order with its label throughout).
const PHONE = '(max-width: 820px)';
const PRESSABLE = 'a[href], button, input, select, textarea, label, summary, [role="button"], [role="tab"], .price, .btn';
let watching = false, lastY = 0, idle = 0, settleT1 = 0, settleT2 = 0;

/** True when a letter of the page's text (not the orb's own) is drawn at this point. */
function glyphAt(x: number, y: number, b: HTMLElement): boolean {
  const doc = document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null };
  const r = doc.caretRangeFromPoint?.(x, y);
  const n = r?.startContainer;
  if (!r || !n || n.nodeType !== 3 || b.contains(n) || !n.textContent?.trim()) return false;
  const t = n as Text, rg = document.createRange();
  rg.setStart(t, Math.max(0, r.startOffset - 1)); rg.setEnd(t, Math.min(t.length, r.startOffset + 1));
  return [...rg.getClientRects()].some(q => x >= q.left - 3 && x <= q.right + 3 && y >= q.top - 2 && y <= q.bottom + 2);
}

/** True when nothing to press and no words lie under the orb's footprint. */
export function orbSpotClear(b: HTMLElement): boolean {
  // the resting footprint (offset* ignore the slide while it is tucked away; a fixed element's offsets are viewport ones)
  const l = b.offsetLeft, t = b.offsetTop, w = b.offsetWidth, h = b.offsetHeight;
  if (!w || !h) return true;
  const pts: [number, number][] = [];
  for (const fx of [0.08, 0.3, 0.5, 0.7, 0.92]) for (const fy of [0.08, 0.3, 0.5, 0.7, 0.92]) pts.push([l + w * fx, t + h * fy]);
  const pe = b.style.pointerEvents; b.style.pointerEvents = 'none'; // (so the text hit test sees the page under it)
  try {
    return pts.every(([x, y]) => document.elementsFromPoint(x, y).every(el => b.contains(el) || !el.closest(PRESSABLE) || !!el.closest('.breathorb')) && !glyphAt(x, y, b));
  } finally { b.style.pointerEvents = pe; }
}

function setTucked(on: boolean) {
  const b = document.querySelector<HTMLElement>('.breathorb');
  if (!b) return;
  b.classList.toggle('bo-tucked', on && b !== document.activeElement);
}

/** Out where the spot is clear, aside where it is not (phones and tablets only). */
function settle() {
  const b = document.querySelector<HTMLElement>('.breathorb');
  if (!b) return;
  if (!window.matchMedia(PHONE).matches) { setTucked(false); return; }
  setTucked(!orbSpotClear(b));
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
    if (dy > 2 && y >= 80) setTucked(true);
    else if (dy < -2 || y < 80) setTucked(!orbSpotClear(b));
    // after a pause it comes back if the spot under it is free
    idle = window.setTimeout(settle, 900);
  }, { passive: true });
  window.addEventListener('resize', () => { window.clearTimeout(idle); idle = window.setTimeout(settle, 300); });
}
