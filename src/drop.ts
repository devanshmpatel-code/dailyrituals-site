// The Moon Drop date: the next new moon, computed, so the site never counts down to a date that has passed.
//
// Moon Drops are still a concept (no price, nothing to buy): the site only says when the next new moon is and offers a
// "notify me". One state, worked out here, feeds every place that mentions it: the announcement bar, the home chapter,
// the Moon Drops page (date text, countdown and button).
//
// The new moon is found with Jean Meeus' method (Astronomical Algorithms, 2nd ed., chapter 49): the mean phase plus the
// periodic terms for a new moon and the fourteen planetary corrections. Meeus gives the error of the full method as a few
// seconds against the modern lunar theory; with the fixed ΔT used here (TT − UT, about 70 s for the 2020s) the instant
// is good to within about a minute for the years this site will run, far finer than the whole-day date it shows.
import { DROP_DATE_OVERRIDE, TIME_ZONE } from './config';

const rad = (d: number) => (d * Math.PI) / 180;
/** TT − UT in seconds. Close to 69–70 s through the 2020s; it changes by well under a second a year. */
const DELTA_T = 70;

/** The instant of new moon number k (k = 0 is the new moon of 6 January 2000; one step is one lunation). */
export function newMoonAt(k: number): Date {
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  let jde = 2451550.09766 + 29.530588861 * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const M = rad(2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3);
  const Mp = rad(201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4);
  const F = rad(160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4);
  const O = rad(124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3);
  const s = Math.sin;
  jde += -0.4072 * s(Mp) + 0.17241 * E * s(M) + 0.01608 * s(2 * Mp) + 0.01039 * s(2 * F)
    + 0.00739 * E * s(Mp - M) - 0.00514 * E * s(Mp + M) + 0.00208 * E * E * s(2 * M)
    - 0.00111 * s(Mp - 2 * F) - 0.00057 * s(Mp + 2 * F) + 0.00056 * E * s(2 * Mp + M)
    - 0.00042 * s(3 * Mp) + 0.00042 * E * s(M + 2 * F) + 0.00038 * E * s(M - 2 * F)
    - 0.00024 * E * s(2 * Mp - M) - 0.00017 * s(O) - 0.00007 * s(Mp + 2 * M)
    + 0.00004 * s(2 * Mp - 2 * F) + 0.00004 * s(3 * M) + 0.00003 * s(Mp + M - 2 * F)
    + 0.00003 * s(2 * Mp + 2 * F) - 0.00003 * s(Mp + M + 2 * F) + 0.00003 * s(Mp - M + 2 * F)
    - 0.00002 * s(Mp - M - 2 * F) - 0.00002 * s(3 * Mp + M) + 0.00002 * s(4 * Mp);
  // the planetary arguments A1…A14 and their coefficients
  const A: [number, number, number][] = [
    [299.77, 0.107408, 0.000325], [251.88, 0.016321, 0.000165], [251.83, 26.651886, 0.000164], [349.42, 36.412478, 0.000126],
    [84.66, 18.206239, 0.00011], [141.74, 53.303771, 0.000062], [207.14, 2.453732, 0.00006], [154.84, 7.30686, 0.000056],
    [34.52, 27.261239, 0.000047], [207.19, 0.121824, 0.000042], [291.34, 1.844379, 0.00004], [161.72, 24.198154, 0.000037],
    [239.56, 25.513099, 0.000035], [331.55, 3.592518, 0.000023],
  ];
  A.forEach(([a, b, c], i) => { jde += c * s(rad(a + b * k - (i === 0 ? 0.009173 * T2 : 0))); });
  return new Date((jde - 2440587.5) * 86400000 - DELTA_T * 1000);
}

/** The first new moon at or after an instant. */
export function nextNewMoon(from: Date = new Date()): Date {
  const yearsSince2000 = (from.getTime() - Date.UTC(2000, 0, 6)) / (365.25 * 86400000);
  let k = Math.floor(yearsSince2000 * 12.3685) - 1;
  let d = newMoonAt(k);
  while (d.getTime() < from.getTime()) d = newMoonAt(++k);
  return d;
}

/** "2026-11-08": the calendar day of an instant in the studio's time zone (White Rock, BC). */
export const localDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

export interface DropState {
  /** upcoming: the new moon is on a later day; today: it is today in White Rock */
  state: 'upcoming' | 'today';
  /** the new moon (or the date Claire pinned) */
  at: Date;
  /** "Sunday, November 8" */
  dateText: string;
  /** true when the date comes from the config override rather than the sky */
  pinned: boolean;
}

/**
 * The one Moon Drop state. A date pinned in config (DROP_DATE_OVERRIDE) wins while it is today or later; once it has passed,
 * the computed new moon takes over again, so the site never shows a date in the past.
 */
export function dropState(now: Date = new Date()): DropState {
  const today = localDay(now);
  let at: Date | null = null, pinned = false;
  if (DROP_DATE_OVERRIDE) {
    const o = new Date(DROP_DATE_OVERRIDE);
    if (!Number.isNaN(o.getTime()) && localDay(o) >= today) { at = o; pinned = true; }
  }
  if (!at) {
    // start a little before now so a new moon earlier today still counts as today's
    at = nextNewMoon(new Date(now.getTime() - 2 * 86400000));
    while (localDay(at) < today) at = nextNewMoon(new Date(at.getTime() + 86400000));
  }
  return {
    state: localDay(at) === today ? 'today' : 'upcoming',
    at,
    dateText: at.toLocaleDateString('en-CA', { timeZone: TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric' }),
    pinned,
  };
}

/** Fill every place that shows the drop: [data-drop-date], [data-drop-when], #cd (countdown) and [data-notify] buttons. */
export function applyDrop(root: ParentNode, now: Date = new Date()) {
  const s = dropState(now);
  root.querySelectorAll<HTMLElement>('[data-drop-date]').forEach(el => { el.textContent = s.state === 'today' ? `Tonight · ${s.dateText}` : s.dateText; });
  root.querySelectorAll<HTMLElement>('[data-drop-when]').forEach(el => { el.textContent = s.state === 'today' ? 'New moon tonight' : 'Next new moon'; });
  root.querySelectorAll<HTMLElement>('[data-notify="drop"]').forEach(el => { el.textContent = s.state === 'today' ? 'New moon tonight · get notified' : 'Coming soon · get notified'; });
  root.querySelectorAll<HTMLElement>('.countdown#cd, #cd').forEach(cd => {
    cd.dataset.state = s.state;
    cd.hidden = s.state === 'today';
    const b = cd.querySelectorAll('b');
    const ms = Math.max(0, s.at.getTime() - now.getTime());
    const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
    if (b.length >= 3) { b[0].textContent = String(d); b[1].textContent = String(h).padStart(2, '0'); b[2].textContent = String(m).padStart(2, '0'); }
    cd.setAttribute('aria-label', `${d} days, ${h} hours and ${m} minutes until the new moon`);
  });
  return s;
}

/** The announcement bar's first line (a draft for Claire). */
export function dropBarHTML(now: Date = new Date()): string {
  const s = dropState(now);
  return s.state === 'today'
    ? '<span class="d">New moon tonight · Moon Drops are coming soon</span>'
    : `<span class="d">Moon Drops are coming soon · next new moon ${s.dateText}</span>`;
}

/** True when today (in White Rock) is the day of a new moon, by the sky alone (a pinned drop date does not count). */
export function isNewMoonToday(now: Date = new Date()): boolean {
  return localDay(nextNewMoon(new Date(now.getTime() - 2 * 86400000))) === localDay(now)
    || localDay(nextNewMoon(new Date(now.getTime() - 3600000))) === localDay(now);
}
