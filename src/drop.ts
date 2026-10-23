// The Moon Drop date: once a season, on the first new moon of each season, computed, so the site never counts down to a
// date that has passed.
//
// Moon Drops are still a concept (no price, nothing to buy): the site only says when the next drop is and offers a
// "notify me". One state, worked out here, feeds every place that mentions it: the announcement bar, the home chapter,
// the Moon Drops page (date text, countdown and button).
//
// The cadence (owner, October 2026): four drops a year, one a season. Each season starts at its equinox or solstice
// (about Mar 20, Jun 21, Sep 22 and Dec 21), and its drop is the first new moon on or after that day in White Rock.
//
// The new moon is found with Jean Meeus' method (Astronomical Algorithms, 2nd ed., chapter 49): the mean phase plus the
// periodic terms for a new moon and the fourteen planetary corrections. Meeus gives the error of the full method as a few
// seconds against the modern lunar theory; with the fixed ΔT used here (TT − UT, about 70 s for the 2020s) the instant
// is good to within about a minute for the years this site will run, far finer than the whole-day date it shows.
// The equinoxes and solstices come from the same book (chapter 27: the mean instant, then the 24 periodic terms), good to
// about a minute too.
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

// ---------- the seasons (Meeus, chapter 27) ----------
/** The mean instants (JDE) of the March equinox, June solstice, September equinox and December solstice, years 2000–3000. */
const SEASON_MEAN: [number, number, number, number, number][] = [
  [2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057],
  [2451716.56767, 365241.62603, 0.00325, 0.00888, -0.00030],
  [2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078],
  [2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032],
];
/** The periodic terms A, B, C (Meeus table 27.C). */
const SEASON_TERMS: [number, number, number][] = [
  [485, 324.96, 1934.136], [203, 337.23, 32964.467], [199, 342.08, 20.186], [182, 27.85, 445267.112], [156, 73.14, 45036.886],
  [136, 171.52, 22518.443], [77, 222.54, 65928.934], [74, 296.72, 3034.906], [70, 243.58, 9037.513], [58, 119.81, 33718.147],
  [52, 297.17, 150.678], [50, 21.02, 2281.226], [45, 247.54, 29929.562], [44, 325.15, 31555.956], [29, 60.93, 4443.417],
  [18, 155.12, 67555.328], [17, 288.79, 4562.452], [16, 198.04, 62894.029], [14, 199.76, 31436.921], [12, 95.39, 14577.848],
  [12, 287.11, 31931.756], [12, 320.81, 34777.259], [9, 227.73, 1222.114], [8, 15.45, 16859.074],
];
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
/** The season each start opens (northern hemisphere: White Rock). */
export const SEASON_NAMES: Season[] = ['spring', 'summer', 'autumn', 'winter'];

/** The instant a season starts: i = 0 March equinox, 1 June solstice, 2 September equinox, 3 December solstice. */
export function seasonStart(year: number, i: 0 | 1 | 2 | 3): Date {
  const Y = (year - 2000) / 1000, [a, b, c, d, e] = SEASON_MEAN[i];
  const jde0 = a + b * Y + c * Y * Y + d * Y ** 3 + e * Y ** 4;
  const T = (jde0 - 2451545.0) / 36525, W = rad(35999.373 * T - 2.47);
  const dl = 1 + 0.0334 * Math.cos(W) + 0.0007 * Math.cos(2 * W);
  const S = SEASON_TERMS.reduce((n, [A, B, C]) => n + A * Math.cos(rad(B + C * T)), 0);
  const jde = jde0 + (0.00001 * S) / dl;
  return new Date((jde - 2440587.5) * 86400000 - DELTA_T * 1000);
}

export interface SeasonDrop { season: Season; start: Date; at: Date }
/** A season's Moon Drop: the first new moon on or after the day the season starts (days counted in White Rock). */
export function seasonDrop(year: number, i: 0 | 1 | 2 | 3): SeasonDrop {
  const start = seasonStart(year, i), startDay = localDay(start);
  let at = nextNewMoon(new Date(start.getTime() - 2 * 86400000));
  while (localDay(at) < startDay) at = nextNewMoon(new Date(at.getTime() + 86400000));
  return { season: SEASON_NAMES[i], start, at };
}

/** The first seasonal Moon Drop whose day (in White Rock) is today or later. */
export function nextSeasonDrop(now: Date = new Date()): SeasonDrop {
  const today = localDay(now);
  const y = Number(today.slice(0, 4));
  for (let year = y - 1; year <= y + 1; year++) {
    for (const i of [0, 1, 2, 3] as const) { const d = seasonDrop(year, i); if (localDay(d.at) >= today) return d; }
  }
  return seasonDrop(y + 2, 0);
}

/** "2026-11-08": the calendar day of an instant in the studio's time zone (White Rock, BC). */
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }); // (one formatter, made once)
export const localDay = (d: Date) => dayFmt.format(d);

export interface DropState {
  /** upcoming: the drop's new moon is on a later day; today: it is today in White Rock */
  state: 'upcoming' | 'today';
  /** the season's new moon (or the date Claire pinned) */
  at: Date;
  /** "Thursday, January 7" */
  dateText: string;
  /** the season the drop opens ("winter" for the new moon after the December solstice) */
  season: Season;
  /** true when the date comes from the config override rather than the sky */
  pinned: boolean;
}

const seasonOf = (d: Date): Season => {
  // the season a pinned date falls in (the last start on or before it)
  const y = Number(localDay(d).slice(0, 4));
  let s: Season = 'winter';
  for (const i of [0, 1, 2, 3] as const) if (localDay(seasonStart(y, i)) <= localDay(d)) s = SEASON_NAMES[i];
  return s;
};

/**
 * The one Moon Drop state. A date pinned in config (DROP_DATE_OVERRIDE) wins while it is today or later; once it has passed,
 * the computed seasonal new moon takes over again, so the site never shows a date in the past.
 */
export function dropState(now: Date = new Date()): DropState {
  const today = localDay(now);
  let at: Date | null = null, pinned = false, season: Season | null = null;
  if (DROP_DATE_OVERRIDE) {
    const o = new Date(DROP_DATE_OVERRIDE);
    if (!Number.isNaN(o.getTime()) && localDay(o) >= today) { at = o; pinned = true; season = seasonOf(o); }
  }
  if (!at) { const d = nextSeasonDrop(now); at = d.at; season = d.season; }
  return {
    state: localDay(at) === today ? 'today' : 'upcoming',
    at,
    dateText: at.toLocaleDateString('en-CA', { timeZone: TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric' }),
    season: season ?? 'winter',
    pinned,
  };
}

/** Fill every place that shows the drop: [data-drop-date], [data-drop-when], [data-drop-season], #cd (countdown) and [data-notify] buttons. */
export function applyDrop(root: ParentNode, now: Date = new Date()) {
  const s = dropState(now);
  root.querySelectorAll<HTMLElement>('[data-drop-date]').forEach(el => { el.textContent = s.state === 'today' ? `Tonight · ${s.dateText}` : s.dateText; });
  root.querySelectorAll<HTMLElement>('[data-drop-when]').forEach(el => { el.textContent = s.state === 'today' ? 'Moon Drop tonight' : 'Next Moon Drop'; });
  root.querySelectorAll<HTMLElement>('[data-drop-season]').forEach(el => { el.textContent = s.season; });
  root.querySelectorAll<HTMLElement>('[data-notify="drop"]').forEach(el => { el.textContent = s.state === 'today' ? 'Moon Drop tonight · get notified' : 'Coming soon · get notified'; });
  root.querySelectorAll<HTMLElement>('.countdown#cd, #cd').forEach(cd => {
    cd.dataset.state = s.state;
    cd.hidden = s.state === 'today';
    const b = cd.querySelectorAll('b');
    const ms = Math.max(0, s.at.getTime() - now.getTime());
    const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
    if (b.length >= 3) { b[0].textContent = String(d); b[1].textContent = String(h).padStart(2, '0'); b[2].textContent = String(m).padStart(2, '0'); }
    cd.setAttribute('aria-label', `${d} days, ${h} hours and ${m} minutes until the next Moon Drop`);
  });
  return s;
}

/**
 * The announcement bar's last, quieter item (a draft for Claire). The bar leads with what is live now (free shipping, gifting);
 * the Moon Drop date follows. Phones see the short form ("Moon Drop Jan 7"); the full line stays in the text for screen readers.
 * (The bar itself lives in the header; it only calls this.)
 */
export function dropBarHTML(now: Date = new Date()): string {
  const s = dropState(now);
  if (s.state === 'today') return '<span class="d">Moon Drop tonight · the new moon of the season</span>';
  const short = s.at.toLocaleDateString('en-CA', { timeZone: TIME_ZONE, month: 'short', day: 'numeric' }).replace('.', '');
  return `<span class="d"><span class="an-long">Moon Drops · once a season · next on the new moon of ${s.dateText}</span><span class="an-short" aria-hidden="true">Moon Drop ${short}</span></span>`;
}

/** True when today (in White Rock) is the day of a new moon, by the sky alone (a pinned drop date does not count). */
export function isNewMoonToday(now: Date = new Date()): boolean {
  return localDay(nextNewMoon(new Date(now.getTime() - 2 * 86400000))) === localDay(now)
    || localDay(nextNewMoon(new Date(now.getTime() - 3600000))) === localDay(now);
}
