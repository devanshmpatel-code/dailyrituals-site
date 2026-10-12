import '../giving.css';
import { GIVING, type GivingEntry } from '../data/giving';
import { LAUNCHED } from '../config';
import { money } from '../wix';
import { esc } from '../ui';

// Giving back: $1 from every order, for children's cancer care at BC Children's Hospital and local causes in White Rock and
// the Semiahmoo Peninsula. Three places use it:
//   - "Light that travels", the night panel at the end of Meet the maker (givingStoryHTML + mountGivingStory);
//   - the public ledger at /giving (renderGiving), driven ONLY by src/data/giving.ts;
//   - one quiet line where people buy (givingNote): the cart and under Add to cart.
// Honesty rules: totals are added up from the ledger entries and nothing else (no estimates, no progress bars, no impact claims).
// Every line that names BC Children's Hospital is a draft for Claire (.d): using a charity's name needs its permission first
// (see LAUNCH.md section 0). The hospital's logo is never used.

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The ledger: the entries in src/data/giving.ts, newest first. Preview builds (never the launched site) also accept entries
 *  from window.__DR_GIVING__ so the e2e suite can check how a filled ledger renders without touching the data file. */
export function givingEntries(): GivingEntry[] {
  let list: GivingEntry[] = [...GIVING];
  if (!LAUNCHED) {
    const injected = (window as unknown as { __DR_GIVING__?: unknown }).__DR_GIVING__;
    if (Array.isArray(injected)) list = list.concat(injected as GivingEntry[]);
  }
  return list
    .filter(e => e && typeof e.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && !Number.isNaN(Date.parse(e.date)) && Number.isFinite(Number(e.amount)) && Number(e.amount) > 0 && typeof e.recipient === 'string' && e.recipient.trim())
    .sort((a, b) => b.date.localeCompare(a.date));
}

const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
const monthYear = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { year: 'numeric', month: 'short' });
// only links that are plainly a web address or a file on this site
const safeUrl = (u?: string) => (u && /^(https:\/\/|\/)[^\s"'<>]*$/.test(u.trim()) ? u.trim() : '');

/** A small paper lantern (icons, the ledger's timeline). */
export const lanternSVG = (cls = '', lit = true) => `<svg class="gv-ico${lit ? ' lit' : ''}${cls ? ` ${cls}` : ''}" viewBox="0 0 24 30" aria-hidden="true" focusable="false">
  <path class="gv-ico-body" d="M4.6 5.2C4.6 3.4 8 2.2 12 2.2s7.4 1.2 7.4 3L17.4 22.4c-.3 1.4-2.6 2.2-5.4 2.2s-5.1-.8-5.4-2.2z"/>
  <path class="gv-ico-rib" d="M9.2 3.2 9.6 24M14.8 3.2 14.4 24" />
  <ellipse class="gv-ico-flame" cx="12" cy="26.6" rx="1.5" ry="2.3"/></svg>`;

/** The quiet line where people buy (cart and product page). */
export function givingNote(where: 'cart' | 'product') {
  return `<a class="gv-note gv-note-${where}" href="#/giving">${lanternSVG()}<span><span class="d">$1 from this order lights a lantern for BC Children's Hospital and local causes.</span> <u>See the tracker</u></span></a>`;
}

// ---------- the night scene: lanterns rising over Semiahmoo Bay, past the White Rock pier, into a constellation ----------
// [x %, depth px, seconds to rise, delay, drift px, size, resting progress for reduced motion]
const LANTERNS: [number, number, number, number, number, number, number][] = [
  [16, -40, 21, -2, 26, 1, .18], [31, -220, 25, -11, -18, .78, .62], [44, 30, 19, -6, 20, 1.18, .34], [58, -140, 23, -15, -24, .86, .8],
  [70, -10, 20, -9, 16, 1.06, .48], [82, -260, 27, -4, -14, .7, .3], [24, -300, 28, -19, 12, .64, .9], [51, -330, 30, -23, -10, .6, .12],
  [64, 40, 22, -18, 22, 1.14, .7], [38, -90, 24, -21, -20, .9, .55], [88, -60, 21, -13, -26, .92, .62], [9, -180, 26, -8, 14, .74, .44],
];
// the constellation the lanterns rise toward: a quiet shape, drawn once when the panel comes into view
const STARS: [number, number][] = [[14, 20], [27, 12], [41, 17], [53, 8], [66, 15], [78, 10], [88, 19]];
function skyStars(n: number, seed: number) {
  let s = seed; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  return Array.from({ length: n }, (_, i) => `<circle cx="${(r() * 100).toFixed(2)}" cy="${(r() * 62).toFixed(2)}" r="${(r() * .18 + .06).toFixed(2)}"${i % 6 === 0 ? ` class="tw" style="--tw:${(r() * 4).toFixed(1)}s"` : ''}/>`).join('');
}
const pierSVG = () => `<svg class="gv-shore" viewBox="0 0 400 120" preserveAspectRatio="xMaxYMax slice" aria-hidden="true" focusable="false">
  <defs><linearGradient id="gvSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2B2C52" stop-opacity=".9"/><stop offset=".45" stop-color="#15142A"/><stop offset="1" stop-color="#0D0B17"/></linearGradient>
    <radialGradient id="gvWarm" cx=".5" cy="0" r=".5" gradientTransform="matrix(1 0 0 .55 0 0)"><stop offset="0" stop-color="#F3B060" stop-opacity=".42"/><stop offset=".5" stop-color="#E2A04A" stop-opacity=".1"/><stop offset="1" stop-color="#E2A04A" stop-opacity="0"/></radialGradient>
    <linearGradient id="gvRock" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#F4EEE4"/><stop offset=".6" stop-color="#CFC6B8"/><stop offset="1" stop-color="#8F8778"/></linearGradient></defs>
  <rect x="0" y="62" width="400" height="58" fill="url(#gvSea)"/>
  <rect x="60" y="62" width="320" height="58" fill="url(#gvWarm)"/>
  <path class="gv-hills" d="M0 60C40 57 80 53 130 55s90 4 140 0 90-6 130-2V63H0z"/>
  <g class="gv-shimmer">${Array.from({ length: 12 }, (_, i) => `<path d="M${(48 + i * 61) % 380} ${70 + ((i * 7) % 6) * 6}h${10 + (i % 3) * 9}" style="--d:${(i * .55).toFixed(2)}s"/>`).join('')}</g>
  <g class="gv-pier"><path d="M378 99L48 69"/><path d="M378 95L48 67"/>${Array.from({ length: 26 }, (_, i) => { const t = i / 25, x = 378 - t * 330, y = 99 - t * 30, h = 9 - t * 7.4; return `<path d="M${x.toFixed(1)} ${(y - 3.6 + t * 1.6).toFixed(1)}v${(h + 3.6 - t * 1.6).toFixed(1)}"/>`; }).join('')}</g>
  <path class="gv-beach" d="M400 108C330 104 240 110 0 112V120H400z"/>
  <path class="gv-rock" fill="url(#gvRock)" d="M301 116.5l1.6-6.2c1-3.6 3.4-6.4 7-7.6l6.4-2.1c3.2-1 6.6-.6 9.2 1.3l4.6 3.3c2.4 1.8 4 4.4 4.6 7.3l.8 4z"/></svg>`;

export function lanternSky(opts: { lanterns?: string; cls?: string } = {}) {
  return `<div class="gv-stage${opts.cls ? ` ${opts.cls}` : ''}" aria-hidden="true">
    <svg class="gv-stars" viewBox="0 0 100 62" preserveAspectRatio="xMidYMid slice" focusable="false">${skyStars(70, 7)}</svg>
    <svg class="gv-const" viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false"><path pathLength="1" d="${STARS.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join('')}"/></svg>
    ${STARS.map(([x, y], i) => `<i class="gv-cstar" style="left:${x}%;top:${y}%;--i:${i}"></i>`).join('')}
    <div class="gv-glowline"></div>
    <div class="gv-field">${opts.lanterns ?? LANTERNS.map(([x, z, t, d, sw, s, p], i) => `<span class="gv-l${i >= 8 ? ' more' : ''}" style="--x:${x}%;--z:${z}px;--t:${t}s;--dl:${d}s;--sw:${sw}px;--s:${s};--p:${p}"><span class="gv-lb"></span></span>`).join('')}</div>
    ${pierSVG()}
  </div>`;
}

let skyIO: IntersectionObserver | null = null;
/** Light the scene only while it is on screen (paused otherwise), with a soft tilt toward the pointer on desktops. */
function wireSky(host: HTMLElement) {
  const stage = host.querySelector<HTMLElement>('.gv-stage');
  if (!stage) return;
  skyIO?.disconnect(); skyIO = null; // one scene per page: let the last page's go
  if ('IntersectionObserver' in window) {
    const io = skyIO = new IntersectionObserver(es => es.forEach(e => {
      host.classList.toggle('gv-on', e.isIntersecting);
      if (e.isIntersecting) host.classList.add('gv-seen');
      if (!host.isConnected) io.disconnect();
    }), { threshold: 0.12 });
    io.observe(host);
  } else host.classList.add('gv-on', 'gv-seen');
  if (reduceMotion() || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  let raf = 0;
  stage.addEventListener('pointermove', e => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0; const r = stage.getBoundingClientRect();
      stage.style.setProperty('--px', (((e.clientX - r.left) / r.width) - .5).toFixed(3));
      stage.style.setProperty('--py', (((e.clientY - r.top) / r.height) - .5).toFixed(3));
    });
  });
  stage.addEventListener('pointerleave', () => { stage.style.setProperty('--px', '0'); stage.style.setProperty('--py', '0'); });
}

// ---------- "How it works": the same three beats on the story and the tracker ----------
const HOW = () => [
  ['$1', 'Set aside from every order', 'One dollar from every order placed here goes into our giving fund.'],
  ['→', 'Sent where it matters', '<span class="d">To children’s cancer care at BC Children’s Hospital, and to local causes in White Rock and the Semiahmoo Peninsula.</span>'],
  ['✓', 'Posted with proof', 'We donate regularly, and every donation is posted publicly on our giving tracker, with its receipt.'],
];
const howList = (cls: string) => `<ol class="${cls}">${HOW().map(([n, t, d], i) => `<li style="--i:${i}"><span class="gv-n" aria-hidden="true">${n}</span><div><h3>${t}</h3><p>${d}</p></div></li>`).join('')}</ol>`;

/** "Light that travels": the giving section at the end of Meet the maker. */
export function givingStoryHTML() {
  return `<section class="wrap gv-sec" aria-labelledby="gvTitle"><div class="gv">
    <div class="gv-tx">
      <span class="eyebrow">Giving back</span>
      <h2 id="gvTitle">Light that <span class="it">travels</span></h2>
      <p class="gv-lead">Every order lights a small lantern. One dollar from each is set aside and sent on, <span class="d">to children’s cancer care and to the community this studio calls home.</span></p>
      ${howList('gv-steps')}
      <p class="gv-line">Every candle you light here lights another.</p>
      <div class="gv-cta"><a class="btn gv-gold" href="#/shop?f=candle">Shop the candles</a><a class="gv-link" href="#/giving">See the giving tracker <span aria-hidden="true">→</span></a></div>
      <p class="small gv-fine d confirm">Draft for Claire. BC Children’s Hospital Foundation to approve the use of its name before launch; local causes to be named.</p>
    </div>
    ${lanternSky()}
  </div></section>`;
}
export function mountGivingStory(app: HTMLElement) {
  const host = app.querySelector<HTMLElement>('.gv');
  if (host) wireSky(host);
}

// ---------- /giving: the public ledger ----------
export function renderGiving(app: HTMLElement) {
  const entries = givingEntries();
  const total = entries.reduce((s, e) => s + Number(e.amount), 0);
  const counted = entries.filter(e => Number.isFinite(Number(e.orders)) && Number(e.orders) > 0);
  const orders = counted.reduce((s, e) => s + Number(e.orders), 0);
  const recipients = new Set(entries.map(e => e.recipient.trim())).size;
  const first = entries.length ? entries[entries.length - 1].date : '';

  // the sky above the ledger shows one lit lantern per donation posted (up to a dozen), or a single unlit one waiting
  const shown = entries.slice(0, 12);
  const skyLanterns = entries.length
    ? shown.map((_, i) => { const n = shown.length, x = n === 1 ? 50 : 14 + (72 * i) / (n - 1), y = 30 + ((i * 37) % 34); return `<span class="gv-l float" style="--x:${x.toFixed(1)}%;--y:${y}%;--z:${-((i * 70) % 260)}px;--s:${(1.1 - ((i * 13) % 5) / 10).toFixed(2)};--dl:${-(i * 1.3).toFixed(1)}s"><span class="gv-lb"></span></span>`; }).join('')
    : '<span class="gv-l waiting" style="--x:50%;--s:1.25"><span class="gv-lb"></span></span>';

  const summary = entries.length
    ? `<dl class="gvp-totals">
        <div><dt>Given so far</dt><dd class="gvp-total">${money(total)}</dd></div>
        <div><dt>Donations posted</dt><dd>${entries.length}</dd></div>
        ${orders ? `<div><dt>Orders counted</dt><dd>${orders.toLocaleString('en-CA')}</dd></div>` : `<div><dt>Recipients</dt><dd>${recipients}</dd></div>`}
        <div><dt>Since</dt><dd>${monthYear(first)}</dd></div></dl>
      <p class="gvp-sum-note">Added up from the donations listed below, and nothing else.</p>`
    : `<div class="gvp-empty-hero"><p>No donations have been posted yet.</p></div>`;

  const ledger = entries.length
    ? `<ol class="gvp-list">${entries.map((e, i) => {
        const proof = safeUrl(e.proofUrl), photo = safeUrl(e.photo);
        const alt = e.photoAlt?.trim() || `Photo from our donation to ${e.recipient}, ${longDate(e.date)}`;
        return `<li class="gvp-e" style="--i:${i}">
          <span class="gvp-node" aria-hidden="true">${lanternSVG()}</span>
          <article class="gvp-card${photo ? ' has-photo' : ''}">
            <div class="gvp-meta"><time datetime="${esc(e.date)}">${longDate(e.date)}</time><span class="gvp-amt">${money(Number(e.amount))}</span></div>
            <div class="gvp-body"><h3>${esc(e.recipient)}</h3>
              ${e.note ? `<p>${esc(e.note)}</p>` : ''}
              ${Number(e.orders) > 0 ? `<p class="gvp-orders">Covers ${Number(e.orders).toLocaleString('en-CA')} orders, $1 from each.</p>` : ''}
              ${proof ? `<a class="gvp-proof" href="${esc(proof)}" target="_blank" rel="noopener">View the receipt<span class="gv-vh"> for ${esc(e.recipient)}, ${longDate(e.date)} (opens in a new tab)</span></a>` : '<span class="gvp-proof none">Receipt to be posted</span>'}
            </div>
            ${photo ? `<figure class="gvp-photo"><img src="${esc(photo)}" alt="${esc(alt)}" loading="lazy" decoding="async"></figure>` : ''}
          </article></li>`; }).join('')}</ol>`
    : `<div class="gvp-empty" role="status">
        <span class="gvp-empty-l" aria-hidden="true">${lanternSVG('', false)}</span>
        <p class="gvp-empty-h">The first lantern is waiting.</p>
        <p>Our first giving report will be posted after our first month of orders. Every donation will appear here with its receipt.</p></div>`;

  app.innerHTML = `<div class="gvp">
    <section class="wrap gvp-top" aria-labelledby="gvpTitle"><div class="gv gvp-hero">
      <div class="gv-tx">
        <span class="small gvp-crumbs"><a href="#/">Home</a> <span>/ Giving back</span></span>
        <span class="eyebrow">Giving back · the tracker</span>
        <h1 id="gvpTitle">Where the light <span class="it">goes</span></h1>
        <p class="gv-lead">A public ledger of what Daily Rituals Co. gives: $1 from every order, <span class="d">for children’s cancer care at BC Children’s Hospital and for local causes in White Rock and the Semiahmoo Peninsula.</span> Every donation is posted here, with its proof.</p>
        ${summary}
      </div>
      ${lanternSky({ lanterns: skyLanterns, cls: entries.length ? 'still' : 'still empty' })}
    </div></section>

    <section class="wrap gvp-ledger" aria-labelledby="gvpLedger">
      <div class="gvp-head"><span class="eyebrow">The ledger</span><h2 id="gvpLedger">Every donation, <span class="it">in the open</span></h2>
        <p class="muted">Newest first. Each entry shows the date, the amount, who received it and the receipt.</p></div>
      ${ledger}
    </section>

    <section class="wrap gvp-how" aria-labelledby="gvpHow">
      <div class="gvp-head"><span class="eyebrow">How it works</span><h2 id="gvpHow">One order, <span class="it">one dollar</span></h2></div>
      ${howList('gv-steps gvp-steps')}
      <div class="gvp-notes">
        <div class="gvp-note"><h3>How the amount is calculated</h3>
          <p><span class="d">At the end of each month we count the orders placed through this shop and set aside $1 for each one. Cancelled and fully refunded orders are not counted. The total is donated, and the donation is posted here with its receipt.</span></p>
          <p class="small muted d confirm">Draft for Claire: confirm how often donations are made and how the amount is split between causes.</p></div>
        <div class="gvp-note"><h3>Where it goes</h3>
          <p><span class="d">Children’s cancer care at BC Children’s Hospital, and local causes in White Rock and the Semiahmoo Peninsula.</span> Each local cause will be named here as it is chosen.</p>
          <p class="small muted"><span class="d">Donations are made by Daily Rituals Co. Your purchase is not itself a donation and is not tax-deductible.</span></p></div>
      </div>
      <div class="gvp-cta"><p class="gv-line">Every candle you light here lights another.</p>
        <div class="gv-cta"><a class="btn" href="#/shop?f=candle">Shop the candles</a><a class="btn line" href="#/story">Meet the maker</a></div></div>
    </section>
  </div>`;
  const hero = app.querySelector<HTMLElement>('.gvp-hero');
  if (hero) wireSky(hero);
}
