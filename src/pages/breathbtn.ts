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
}
