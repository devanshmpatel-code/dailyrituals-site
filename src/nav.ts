// Global navigation and the product page's local nav.
//
//  - Desktop: top-level links with a disclosure button each; full-width frosted flyouts that open on hover
//    intent (300ms) or on click/keyboard, close after a 150ms grace, crossfade when switching, and sit over a
//    page scrim. Modelled on Apple's globalnav and the WAI-ARIA APG disclosure-navigation pattern:
//    aria-expanded + aria-controls, Esc closes and refocuses the button, focus leaving the item closes it.
//  - Phones: a full-screen night-sky overlay (role=dialog, aria-modal, focus trapped, page inert, scroll locked)
//    with large serif rows, accordions and the five-mood constellation.
//  - Product pages: an Apple-style sticky local nav (name + mood mark, scroll-spied section links, an
//    "Add to cart · $X" pill that drives the page's real add button). Transparent at rest, frosted once stuck.
//
// Timing lives in CSS custom properties (nav.css) so reduced motion is one override and JS reads the same values.
// Every route used here exists in main.ts's switch, static.ts's PAGES or the pages' own query handling.
import './nav.css';
import { MOODS, type Mood } from './config';
import { esc } from './ui';

const MOOD_KEYS = Object.keys(MOODS) as Mood[];
/** Lifted "star" variants of the mood swatches so a small star still reads on night blue (celestial brief, §3a). */
const STAR: Record<Mood, string> = { fresh: '#A3C8C0', sunny: '#ECB76A', floral: '#CF8A7D', woody: '#C09571', grounding: '#8EAA86' };
/** Where the five stars sit in the constellation (a layout choice in a 240 x 170 box, not a claim about any scent). */
const CST: Record<Mood, [number, number]> = { fresh: [34, 50], sunny: [116, 22], woody: [208, 60], grounding: [166, 144], floral: [74, 128] };
const CST_LINES: [Mood, Mood][] = [['fresh', 'sunny'], ['sunny', 'woody'], ['woody', 'grounding'], ['grounding', 'floral'], ['floral', 'fresh']];

interface Link { label: string; href: string; mood?: Mood }
interface Column { title?: string; kind?: 'elevated' | 'moods' | 'list'; links: Link[]; /** left out of the phone accordion (its links are rows of their own there) */ phone?: false }
interface Entry { id: string; label: string; href: string; columns?: Column[]; constellation?: boolean }

const moodLinks = (href: (m: Mood) => string): Link[] => MOOD_KEYS.map(m => ({ label: MOODS[m].label, href: href(m), mood: m }));

// Link labels reuse names already on the site (page titles, footer, shop groups, the home hero). The column
// headings "By mood", "More", "Start from a mood", "Still unsure?" and "About" are new: draft for Claire.
const MENU: Entry[] = [
  {
    id: 'shop', label: 'Shop', href: '#/shop', constellation: true, columns: [
      { kind: 'elevated', links: [{ label: 'Shop all', href: '#/shop' }, { label: 'Fragrance rollers', href: '#/shop?f=roller' }, { label: 'Mini diffusers', href: '#/shop?f=diffuser' }, { label: 'Candles', href: '#/shop?f=candle' }, { label: 'Natural deodorant', href: '#/shop?f=deodorant' }] },
      { title: 'By mood', kind: 'moods', links: moodLinks(m => `#/shop?f=all&m=${m}&s=featured`) },
      { title: 'More', phone: false, links: [{ label: 'Ritual on Repeat', href: '#/subscribe' }, { label: 'Moon Drops', href: '#/drops' }, { label: 'Send a Sunrise', href: '#/gift' }, { label: 'The Ritualists', href: '#/club' }, { label: 'Ritual Wall', href: '#/wall' }] },
    ],
  },
  {
    id: 'explore', label: 'Find your scent', href: '#/explore', columns: [
      { kind: 'elevated', links: [{ label: 'Browse the compass', href: '#/explore' }, { label: 'Take the quiz', href: '#/explore?tab=quiz' }] },
      { title: 'Start from a mood', kind: 'moods', links: moodLinks(m => `#/explore?mood=${m}`) },
      { title: 'Still unsure?', links: [{ label: 'Free 20-min call with Claire', href: '#/book' }, { label: 'Help and contact', href: '#/help' }] },
    ],
  },
  {
    id: 'coaching', label: 'Coaching', href: '#/coaching', columns: [
      { kind: 'elevated', links: [{ label: 'Free 7-day reset', href: '#/reset' }, { label: 'Free 20-min call with Claire', href: '#/book' }, { label: 'Neuro coaching', href: '#/coaching' }] },
      { title: 'About', links: [{ label: 'Our story', href: '#/story' }, { label: 'Help and contact', href: '#/help' }] },
    ],
  },
  { id: 'drops', label: 'Moon Drops', href: '#/drops' },
  { id: 'gift', label: 'Gifts', href: '#/gift' },
];
/** Phone-only rows and small links (all existing pages). */
const PHONE_ROWS: Link[] = [{ label: 'Ritual on Repeat', href: '#/subscribe' }];
const PHONE_SMALL: Link[] = [{ label: 'The Ritualists', href: '#/club' }, { label: 'Ritual Wall', href: '#/wall' }, { label: 'Our story', href: '#/story' }, { label: 'Help', href: '#/help' }, { label: 'My account', href: '#/account' }];

const fine = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
/** A time token from nav.css in milliseconds (the bundler may rewrite "300ms" as ".3s"). */
const token = (name: string, fallback: number) => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const v = parseFloat(raw);
  if (!Number.isFinite(v)) return fallback;
  return /ms$/.test(raw) ? v : /s$/.test(raw) ? v * 1000 : v;
};

/** A four-point star glyph. */
export const starGlyph = (color: string, size = 12, cls = 'star') =>
  `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="${color}" d="M12 1.5C12.7 8.3 15.7 11.3 22.5 12C15.7 12.7 12.7 15.7 12 22.5C11.3 15.7 8.3 12.7 1.5 12C8.3 11.3 11.3 8.3 12 1.5Z"/></svg>`;
const chevron = '<svg class="chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false"><path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** The five moods as a constellation: stars joined by hairlines that draw themselves; each star links to its mood on the compass. */
export function constellationHTML(extraClass = '', g = 0): string {
  const lines = CST_LINES.map(([a, b], i) => `<line x1="${CST[a][0]}" y1="${CST[a][1]}" x2="${CST[b][0]}" y2="${CST[b][1]}" pathLength="1" style="--i:${i}"/>`).join('');
  const stars = MOOD_KEYS.map((m, i) => `<a class="cst-star" href="#/explore?mood=${m}" style="--x:${(CST[m][0] / 240 * 100).toFixed(1)}%;--y:${(CST[m][1] / 170 * 100).toFixed(1)}%;--c:${STAR[m]};--i:${i}">${starGlyph('currentColor', 16)}<span class="cst-name">${esc(MOODS[m].label)}</span></a>`).join('');
  // draft for Claire: the caption under the constellation
  return `<div class="cst ${extraClass}" style="--g:${g}"><div class="cst-sky"><svg class="cst-lines" viewBox="0 0 240 170" aria-hidden="true" focusable="false">${lines}</svg>${stars}</div><span class="cst-cap">Five moods. Follow a star to see its scents on the compass.</span></div>`;
}

// ---------------------------------------------------------------- desktop flyouts
interface Item { el: HTMLElement; btn: HTMLButtonElement; panel: HTMLElement; inner: HTMLElement }
const items = new Map<string, Item>();
let mainnav: HTMLElement | null = null, scrim: HTMLElement | null = null;
let openId: string | null = null, openTimer = 0, closeTimer = 0;

function linkHTML(l: Link, i: number, cls: string) {
  return `<li class="gn-pi" style="--i:${i}"><a class="${cls}" href="${l.href}">${l.mood ? starGlyph(MOODS[l.mood].swatch, 12, 'star moodstar') : ''}<span>${esc(l.label)}</span></a></li>`;
}
function panelHTML(e: Entry) {
  const cols = e.columns!.map((c, g) => `<div class="gn-col gn-col-${c.kind ?? 'list'}" style="--g:${g}">${c.title ? `<span class="gn-eyebrow gn-pi" style="--i:0">${esc(c.title)}</span>` : ''}<ul>${c.links.map((l, i) => linkHTML(l, i + (c.title ? 1 : 0), c.kind === 'elevated' ? 'gn-big' : 'gn-sm')).join('')}</ul></div>`).join('');
  return `<div class="gn-panel" id="gn-panel-${e.id}"><div class="wrap gn-grid">${cols}${e.constellation ? constellationHTML('gn-pi gn-cst', e.columns!.length) : ''}</div></div>`;
}

function measure(it: Item) { return it.inner.offsetHeight; }

function openPanel(id: string) {
  clearTimeout(openTimer); clearTimeout(closeTimer);
  if (openId === id) return;
  const prev = openId ? items.get(openId) : undefined;
  const next = items.get(id)!;
  openId = id;
  if (prev) {
    prev.el.classList.remove('open'); prev.btn.setAttribute('aria-expanded', 'false'); prev.panel.classList.remove('open');
    // the new panel starts at the old height so the sheet reads as one surface changing height, not two
    next.panel.style.setProperty('--h', `${measure(prev)}px`); void next.panel.offsetHeight;
  }
  next.el.classList.add('open'); next.btn.setAttribute('aria-expanded', 'true'); next.panel.classList.add('open');
  next.panel.style.setProperty('--h', `${measure(next)}px`);
  mainnav!.classList.add('has-open'); scrim!.classList.add('on'); document.body.classList.add('gn-open');
}
/** Close the open flyout. With refocus, focus returns to its disclosure button (Esc). */
export function closeMenu(refocus = false) {
  clearTimeout(openTimer); clearTimeout(closeTimer);
  if (!openId) return;
  const it = items.get(openId)!; openId = null;
  it.el.classList.remove('open'); it.btn.setAttribute('aria-expanded', 'false'); it.panel.classList.remove('open');
  it.panel.style.setProperty('--h', '0px');
  mainnav!.classList.remove('has-open'); scrim!.classList.remove('on'); document.body.classList.remove('gn-open');
  if (refocus) it.btn.focus();
}

function mountDesktop(header: HTMLElement) {
  mainnav = header.querySelector<HTMLElement>('.mainnav');
  if (!mainnav) return;
  mainnav.innerHTML = MENU.map(e => `<div class="gn-item" data-id="${e.id}"><a class="gn-link" href="${e.href}" data-nav="${e.id}">${esc(e.label)}</a>${e.columns
    ? `<button class="gn-disclose" type="button" aria-expanded="false" aria-controls="gn-panel-${e.id}" aria-label="${esc(e.label)} menu">${chevron}</button>${panelHTML(e)}` : ''}</div>`).join('');
  scrim = document.createElement('div'); scrim.className = 'gn-scrim'; scrim.setAttribute('aria-hidden', 'true');
  header.insertAdjacentElement('afterend', scrim);
  scrim.addEventListener('click', () => closeMenu());

  mainnav.querySelectorAll<HTMLElement>('.gn-item').forEach(el => {
    const id = el.dataset.id!;
    const btn = el.querySelector<HTMLButtonElement>('.gn-disclose');
    const panel = el.querySelector<HTMLElement>('.gn-panel');
    if (!btn || !panel) {
      // plain items: hovering them closes an open flyout after the grace period
      el.addEventListener('pointerenter', () => { if (fine() && openId) { clearTimeout(openTimer); closeTimer = window.setTimeout(() => closeMenu(), token('--hover-close-delay', 150)); } });
      return;
    }
    items.set(id, { el, btn, panel, inner: panel.querySelector<HTMLElement>('.gn-grid')! });
    btn.addEventListener('click', () => { if (openId === id) closeMenu(); else openPanel(id); });
    el.addEventListener('pointerenter', () => {
      if (!fine()) return;
      clearTimeout(closeTimer); clearTimeout(openTimer);
      openTimer = window.setTimeout(() => openPanel(id), openId && openId !== id ? 60 : token('--hover-open-delay', 300));
    });
    el.addEventListener('pointerleave', () => {
      if (!fine()) return;
      clearTimeout(openTimer);
      closeTimer = window.setTimeout(() => closeMenu(), token('--hover-close-delay', 150));
    });
    el.addEventListener('focusout', e => { if (openId === id && !el.contains(e.relatedTarget as Node | null)) closeMenu(); });
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openId) { e.preventDefault(); closeMenu(true); } });
  window.addEventListener('resize', () => { if (openId) { const it = items.get(openId)!; it.panel.style.setProperty('--h', `${measure(it)}px`); } });
}

// ---------------------------------------------------------------- phone overlay
let overlay: HTMLElement | null = null, menuBtn: HTMLButtonElement | null = null, phoneOpen = false;

function skyHTML() {
  // a seeded scatter of faint stars so every open looks the same
  let s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const stars = Array.from({ length: 110 }, (_, i) => `<circle cx="${(r() * 400).toFixed(1)}" cy="${(r() * 800).toFixed(1)}" r="${(0.5 + r() * 1.1).toFixed(2)}" style="--o:${(0.25 + r() * 0.6).toFixed(2)};--tw:${(3 + r() * 3).toFixed(1)}s;--td:${(-(i % 7) * 0.9).toFixed(1)}s"/>`).join('');
  return `<svg class="mm-stars" viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><g fill="#EDE6DA">${stars}</g></svg>`;
}
function phoneRows() {
  let n = 0;
  const row = (inner: string, cls = '') => `<li class="mm-row ${cls}" style="--i:${n++}">${inner}</li>`;
  const acc = MENU.filter(e => e.columns).map(e => row(
    `<button class="mm-acc" type="button" aria-expanded="false" aria-controls="mm-sub-${e.id}"><span>${esc(e.label)}</span>${chevron}</button>
     <div class="mm-sub" id="mm-sub-${e.id}"><div class="mm-sub-in">${e.columns!.filter(c => c.phone !== false).map(c => `${c.title ? `<span class="mm-eyebrow">${esc(c.title)}</span>` : ''}<ul>${c.links.map((l, i) => `<li style="--i:${i}"><a href="${l.href}">${l.mood ? starGlyph(STAR[l.mood], 12, 'star moodstar') : ''}<span>${esc(l.label)}</span></a></li>`).join('')}</ul>`).join('')}
       <a class="mm-all" href="${e.href}">${esc(e.id === 'shop' ? 'Shop all' : e.label)} →</a></div></div>`)).join('');
  const plain = [...MENU.filter(e => !e.columns).map(e => ({ label: e.label, href: e.href })), ...PHONE_ROWS].map(l => row(`<a class="mm-link" href="${l.href}">${esc(l.label)}</a>`)).join('');
  return acc + plain;
}
function mountPhone(header: HTMLElement) {
  menuBtn = header.querySelector<HTMLButtonElement>('#menuBtn');
  if (!menuBtn) return;
  header.querySelector('#mnav')?.remove();
  overlay = document.createElement('div');
  overlay.id = 'mobileMenu'; overlay.className = 'mm'; overlay.hidden = true;
  overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', 'Menu');
  // "Coaching with Claire" eyebrow and the sign-off line are drafts for Claire; the two offers are the free ways in from the coaching page.
  overlay.innerHTML = `
    <div class="mm-sky" aria-hidden="true">${skyHTML()}</div>
    <div class="mm-top"><a class="mm-logo" href="#/">Daily Rituals Co.</a><button class="mm-close" type="button" aria-label="Close menu"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>
    <div class="mm-scroll">
      <nav aria-label="Menu"><ul class="mm-rows">${phoneRows()}</ul></nav>
      <div class="mm-coach mm-row" style="--i:7"><span class="mm-eyebrow">Coaching with Claire</span>
        <a href="#/reset"><b>Free 7-day reset</b><span>Self-paced, about 10 minutes a day</span></a>
        <a href="#/book"><b>Free 20-min call with Claire</b><span>See if coaching is a fit for you</span></a></div>
      <div class="mm-row" style="--i:8">${constellationHTML('mm-cst')}</div>
      <div class="mm-small mm-row" style="--i:9">${PHONE_SMALL.map(l => `<a href="${l.href}">${esc(l.label)}</a>`).join('')}</div>
    </div>
    <div class="mm-foot"><a class="mm-pill line" href="#/explore">Find your scent</a><a class="mm-pill" href="#/shop">Shop all</a></div>`;
  document.body.appendChild(overlay);
  menuBtn.setAttribute('aria-controls', 'mobileMenu'); menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.setAttribute('aria-haspopup', 'dialog');
  menuBtn.addEventListener('click', () => (phoneOpen ? closePhone() : openPhone()));
  overlay.querySelector('.mm-close')!.addEventListener('click', () => closePhone());
  overlay.querySelectorAll<HTMLButtonElement>('.mm-acc').forEach(b => b.addEventListener('click', () => {
    const open = b.getAttribute('aria-expanded') !== 'true';
    overlay!.querySelectorAll<HTMLButtonElement>('.mm-acc').forEach(x => { x.setAttribute('aria-expanded', String(x === b && open)); x.parentElement!.classList.toggle('open', x === b && open); });
  }));
  overlay.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePhone(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables(overlay!);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !overlay!.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}
function focusables(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')].filter(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
}
function openPhone() {
  if (!overlay || phoneOpen) return;
  phoneOpen = true;
  closeMenu();
  overlay.hidden = false; void overlay.offsetHeight; overlay.classList.add('open');
  menuBtn!.setAttribute('aria-expanded', 'true');
  document.documentElement.classList.add('mm-lock');
  const root = document.getElementById('root'); if (root) root.inert = true;
  overlay.querySelector<HTMLElement>('.mm-close')!.focus();
}
function closePhone(refocus = true) {
  if (!overlay || !phoneOpen) return;
  phoneOpen = false;
  overlay.classList.remove('open');
  menuBtn!.setAttribute('aria-expanded', 'false');
  document.documentElement.classList.remove('mm-lock');
  const root = document.getElementById('root'); if (root) root.inert = false;
  const done = () => { if (!phoneOpen) { overlay!.hidden = true; overlay!.querySelectorAll('.mm-acc[aria-expanded="true"]').forEach(b => { b.setAttribute('aria-expanded', 'false'); b.parentElement!.classList.remove('open'); }); } };
  if (reduce()) done(); else window.setTimeout(done, token('--dur-base', 240) + 40);
  if (refocus) menuBtn!.focus();
}

// ---------------------------------------------------------------- mount + route hook
/** Build the menus into the header (call once, after the header markup is in the DOM). */
export function mountNav() {
  const header = document.querySelector<HTMLElement>('header.top');
  if (!header) return;
  mountDesktop(header);
  mountPhone(header);
}
/** Called on every route change: closes any open menu and removes the previous page's local nav. */
export function navRouteChange() {
  closeMenu();
  closePhone(false);
  unmountLocalNav();
}

// ---------------------------------------------------------------- product page local nav
export interface LocalNavOptions {
  name: string;
  sub?: string;
  mood?: Mood;
  /** sections of the page, in order; only ones that exist should be passed */
  sections: { id: string; label: string }[];
  /** the page's real add-to-cart button: the pill mirrors its text and disabled state and clicks it */
  addBtn: HTMLButtonElement;
}
let lnavCleanup: (() => void) | null = null;

export function mountLocalNav(app: HTMLElement, o: LocalNavOptions) {
  unmountLocalNav();
  const secs = o.sections.filter(s => document.getElementById(s.id));
  const nav = document.createElement('nav');
  nav.className = 'lnav'; nav.setAttribute('aria-label', `${o.name}: on this page`);
  nav.innerHTML = `<div class="wrap lnav-in">
    <a class="lnav-name" href="#${secs[0]?.id ?? ''}" data-sec="${secs[0]?.id ?? ''}">${o.mood ? starGlyph(MOODS[o.mood].swatch, 14, 'star moodstar') : ''}<b>${esc(o.name)}</b>${o.sub ? `<em>${esc(o.sub)}</em>` : ''}</a>
    ${secs.length ? `<button class="lnav-more" type="button" aria-expanded="false" aria-controls="lnavLinks"><span class="lnav-cur">${esc(secs[0].label)}</span>${chevron}</button>
    <ul class="lnav-links" id="lnavLinks">${secs.map((s, i) => `<li style="--i:${i}"><a href="#${s.id}" data-sec="${s.id}"${i === 0 ? ' aria-current="true"' : ''}>${esc(s.label)}</a></li>`).join('')}</ul>` : ''}
    <button class="lnav-add" type="button"></button>
  </div>`;
  const sentinel = document.createElement('div'); sentinel.className = 'lnav-sentinel'; sentinel.setAttribute('aria-hidden', 'true');
  app.prepend(nav); app.prepend(sentinel);

  // the pill mirrors the real button
  const pill = nav.querySelector<HTMLButtonElement>('.lnav-add')!;
  const sync = () => {
    const t = o.addBtn.textContent?.trim() || 'Add to cart';
    const m = t.match(/^Add to cart(.*)$/);
    // phones show the short form ("Add · $25.00"); the accessible name stays the full label
    pill.innerHTML = m ? `<span class="lnav-add-l" aria-hidden="true">Add to cart</span><span class="lnav-add-s" aria-hidden="true">Add</span><span aria-hidden="true">${esc(m[1])}</span>` : esc(t);
    pill.setAttribute('aria-label', t);
    pill.disabled = o.addBtn.disabled;
  };
  sync();
  const mo = new MutationObserver(sync);
  mo.observe(o.addBtn, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  pill.addEventListener('click', () => { o.addBtn.click(); pill.classList.remove('did'); void pill.offsetWidth; pill.classList.add('did'); });

  // stuck state: a 1px sentinel above the bar leaves the viewport when the bar sticks
  let io: IntersectionObserver | null = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(([e]) => nav.classList.toggle('is-stuck', !e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(sentinel);
  }

  // section links: scroll with the bar's height taken off, no route change
  const more = nav.querySelector<HTMLButtonElement>('.lnav-more');
  const cur = nav.querySelector<HTMLElement>('.lnav-cur');
  const links = [...nav.querySelectorAll<HTMLAnchorElement>('.lnav-links a')];
  const setTray = (open: boolean) => { nav.classList.toggle('tray-open', open); more?.setAttribute('aria-expanded', String(open)); };
  more?.addEventListener('click', () => setTray(more.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', e => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-sec]');
    if (!a) return;
    e.preventDefault();
    const el = document.getElementById(a.dataset.sec!);
    if (!el) return;
    setTray(false);
    const top = el.getBoundingClientRect().top + window.scrollY - nav.offsetHeight - 12;
    window.scrollTo({ top, behavior: reduce() ? 'auto' : 'smooth' });
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  });
  const onDocClick = (e: MouseEvent) => { if (nav.classList.contains('tray-open') && !nav.contains(e.target as Node)) setTray(false); };
  document.addEventListener('click', onDocClick);
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && nav.classList.contains('tray-open')) { setTray(false); more?.focus(); } };
  document.addEventListener('keydown', onKey);

  // scroll-spy
  let ticking = false;
  const spy = () => {
    ticking = false;
    if (!secs.length) return;
    const line = nav.offsetHeight + 40;
    let at = 0;
    secs.forEach((s, i) => { const el = document.getElementById(s.id); if (el && el.getBoundingClientRect().top <= line) at = i; });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) at = secs.length - 1;
    links.forEach((a, i) => { if (i === at) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    if (cur) cur.textContent = secs[at].label;
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(spy); } };
  window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll);
  spy();

  lnavCleanup = () => {
    mo.disconnect(); io?.disconnect();
    window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll);
    document.removeEventListener('click', onDocClick); document.removeEventListener('keydown', onKey);
    nav.remove(); sentinel.remove();
  };
}
export function unmountLocalNav() { lnavCleanup?.(); lnavCleanup = null; }
