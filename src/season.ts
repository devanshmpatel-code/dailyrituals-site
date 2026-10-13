// The holiday layer: a seasonal look (cranberry, cream and antique gold) laid over the usual design, on by itself from
// November 15 to December 31 by the visitor's own calendar and off the rest of the year.
//
// Everything it adds is marked data-hol and comes out again when the layer is off, so the off state is the site as it
// always was: no extra markup, no extra styles (every rule in holiday.css is scoped to body.season-holiday or to the
// .hol-* pieces themselves), and no trail.
//
// Preview only (never on the launched build): a "Holiday look" toggle in the private-preview bar and ?season=holiday,
// ?season=off or ?season=auto in the address let the owner see either state on any date. LAUNCHED is a build-time
// constant, so on the launched build the override code is left out and only the calendar decides.
import './holiday.css';
import { LAUNCHED } from './config';
import { dropState } from './drop';
import { mountGoldDust, unmountGoldDust } from './golddust';
import { TIME_ZONE } from './config';

/** Nov 15 to Dec 31 inclusive, by the visitor's local date. */
export function inHolidaySeason(d: Date = new Date()): boolean {
  const m = d.getMonth(), day = d.getDate();
  return (m === 10 && day >= 15) || m === 11;
}

type Override = 'holiday' | 'off' | null;
const KEY = 'dr_season';
let override: Override = null;

if (!LAUNCHED) {
  // the address is read once, as the site loads (before the router tidies "#/…" addresses away)
  const fromUrl = (): string | null => {
    const q = new URLSearchParams(location.search).get('season');
    if (q) return q;
    const h = location.hash.indexOf('?');
    return h >= 0 ? new URLSearchParams(location.hash.slice(h + 1)).get('season') : null;
  };
  const p = fromUrl();
  try {
    if (p === 'holiday' || p === 'off') { override = p; localStorage.setItem(KEY, p); }
    else if (p === 'auto') localStorage.removeItem(KEY);
    else { const s = localStorage.getItem(KEY); if (s === 'holiday' || s === 'off') override = s; }
  } catch { if (p === 'holiday' || p === 'off') override = p; }
}

export const holidayOn = (): boolean => (override ? override === 'holiday' : inHolidaySeason());

// ---------- the pieces ----------

/** A torn-ticket stub: notched ends, a dashed inner border and a perforation before a small star. */
export const stubHTML = (inner: string, cls = '') =>
  `<span class="hol-stub${cls ? ` ${cls}` : ''}" data-hol><span class="hol-stub-t">${inner}</span><span class="hol-stub-end" aria-hidden="true"><svg viewBox="0 0 12 12" width="9" height="9"><path d="M6 0l1.4 4.6L12 6l-4.6 1.4L6 12 4.6 7.4 0 6l4.6-1.4z" fill="currentColor"/></svg></span></span>`;

/** A ribbon flag that hangs off the right corner of a card, folded under at the back. */
const flagHTML = (text: string) => `<span class="hol-flag" data-hol aria-hidden="true"><span class="d">${text}</span></span>`;

/** The round cream seal on Claire's arch: the next Moon Drop, from the one drop state in src/drop.ts. */
function sealHTML() {
  const s = dropState();
  const short = s.at.toLocaleDateString('en-CA', { timeZone: TIME_ZONE, month: 'short', day: 'numeric' }).replace('.', '');
  const day = s.state === 'today' ? 'Tonight' : short;
  const iso = s.at.toLocaleDateString('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
  return `<span class="hol-seal" data-hol data-date="${iso}" role="img" aria-label="Next Moon Drop: ${s.state === 'today' ? 'tonight' : s.dateText}">
    <svg class="hol-seal-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46.5"/><circle cx="50" cy="50" r="41" stroke-dasharray="1.2 3.1"/></svg>
    <span class="hol-seal-in" aria-hidden="true"><span class="d"><i>Next Moon Drop</i><b>${day}</b></span><svg viewBox="0 0 12 12" width="8" height="8"><path d="M6 0l1.4 4.6L12 6l-4.6 1.4L6 12 4.6 7.4 0 6l4.6-1.4z" fill="currentColor"/></svg></span></span>`;
}

/** Give a host a positioning context for an absolutely placed piece, without breaking a sticky or absolute host. */
function host(el: HTMLElement) {
  if (getComputedStyle(el).position === 'static') { el.classList.add('hol-host'); el.dataset.holHost = '1'; }
}

/** Add the holiday pieces inside root (idempotent). */
export function decorateHoliday(root: ParentNode = document) {
  if (!holidayOn()) return;
  // "Free shipping" in the announcement bar becomes a ticket stub (its own words, unchanged)
  root.querySelectorAll<HTMLElement>('.announce .an-live:not([data-hol-wrap])').forEach(el => {
    el.dataset.holWrap = '1';
    const inner = el.innerHTML;
    el.innerHTML = stubHTML(inner, 'cream');
  });
  // a stub beside each giving line (cart and product page): BC Children's naming stays a draft for Claire
  root.querySelectorAll<HTMLElement>('.gv-note').forEach(n => {
    if (n.previousElementSibling?.matches('.hol-stub')) return;
    n.insertAdjacentHTML('beforebegin', stubHTML(`<span class="d">$1 to BC Children's</span>`, 'give'));
  });
  // ribbon flags: the Moon Drops row in the Opening soon chapter, and the Send a Sunrise card
  root.querySelectorAll<HTMLElement>('.soon-list a[href$="drops"]').forEach(a => {
    if (a.querySelector(':scope > .hol-flag')) return;
    host(a); a.insertAdjacentHTML('beforeend', flagHTML('Next new moon'));
  });
  root.querySelectorAll<HTMLElement>('.gcard').forEach(c => {
    const p = c.parentElement; if (!p || p.querySelector(':scope > .hol-flag')) return;
    host(p); c.insertAdjacentHTML('beforebegin', flagHTML('Gift it'));
  });
  // the seal on Claire's arch (home)
  root.querySelectorAll<HTMLElement>('.claire-in .claire-cut').forEach(c => {
    c.querySelector(':scope > .hol-seal')?.remove();
    c.insertAdjacentHTML('beforeend', sealHTML());
  });
  // the gold dust in the home sky
  const sky = (root as ParentNode).querySelector?.<HTMLElement>('#day #sky');
  if (sky) mountGoldDust(sky);
}

/** Take every holiday piece out again. */
export function stripHoliday(root: ParentNode = document) {
  unmountGoldDust();
  root.querySelectorAll<HTMLElement>('[data-hol-wrap]').forEach(el => {
    const t = el.querySelector('.hol-stub-t'); if (t) el.innerHTML = t.innerHTML;
    delete el.dataset.holWrap;
  });
  root.querySelectorAll('[data-hol]').forEach(el => el.remove());
  root.querySelectorAll<HTMLElement>('[data-hol-host]').forEach(el => { el.classList.remove('hol-host'); delete el.dataset.holHost; });
}

/** Set the body class and the pieces to match the current state. */
export function applySeason() {
  const on = holidayOn();
  document.body.classList.toggle('season-holiday', on);
  if (on) decorateHoliday(document); else stripHoliday(document);
}

/** Preview bar: the "Holiday look" toggle (absent on the launched build). */
export function wireSeasonToggle(input: HTMLInputElement | null) {
  if (LAUNCHED || !input) return;
  input.checked = holidayOn();
  input.addEventListener('change', () => {
    // matching the calendar clears the override, so the preview goes back to following the date
    override = input.checked === inHolidaySeason() ? null : input.checked ? 'holiday' : 'off';
    try { if (override) localStorage.setItem(KEY, override); else localStorage.removeItem(KEY); } catch { /* ignore */ }
    applySeason();
  });
}
