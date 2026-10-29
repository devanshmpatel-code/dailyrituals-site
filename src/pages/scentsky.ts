// The Scent Sky (Find your scent > Scent Sky), in place of the old scent atlas.
//
// Level 1: the ten scent families of the owner's list (src/data/scents.ts) as ten constellations on a night sky. Each is a
// real button: its name, how many scents it holds, and a small star chart of those scents (decoration).
// Level 2: choosing a family turns the sky to it: its scents become named stars, each a real button, joined by gold
// hairlines. Choosing a scent brings the whole sky back with that scent lit in EVERY family it belongs to (Windy Beach
// glows in Marine Ozonic, Woody, Citrus, Floral and Amber) and a thread drawn between them, and opens a panel with its
// families, its formats (candle, mini diffuser, fragrance roller) and, for each, a link to the live product page with
// Wix's own price, or "Coming soon" when Wix does not have it yet. Nothing is invented: no price, size or photograph
// that is not in the live catalogue.
//
// Keyboard: every family and scent is a native button with a name; focus is always visible; Escape closes the scent
// panel (back to its family) and then the family (back to the whole sky), returning focus to what opened it. With
// reduced motion nothing twinkles, turns or draws itself. The layout is a grid, so it never scrolls sideways at 360px.
// Wording that is new is a draft for Claire (span.d).
import { FORMAT_LABEL } from '../config';
import { FAMILIES, FAMILY_ORDER, SCENTS, isFamily, offersOf, scentById, scentsIn, type Family, type ScentDef } from '../data/scents';
import { esc, priceText, productHref } from '../ui';
import type { Item } from '../wix';
import '../scentsky.css';

/** Old addresses (#/explore?mood=…) still open somewhere sensible. */
const LEGACY_MOOD: Record<string, Family> = { fresh: 'marine', sunny: 'fruity', floral: 'floral', woody: 'woody', grounding: 'green' };
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const prng = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const f1 = (n: number) => n.toFixed(1);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const fmtName = (f: string) => FORMAT_LABEL[f as keyof typeof FORMAT_LABEL];

/** A family's small star chart (160 x 110): its own star in the middle, one point per scent around it, a hairline loop. */
function chartSVG(f: Family): string {
  const list = scentsIn(f), n = list.length, rnd = prng(FAMILY_ORDER.indexOf(f) * 97 + 13);
  const pts = list.map((s, k) => {
    const a = k * 2.39996 + rnd() * .5, r = .42 + .58 * Math.sqrt((k + .6) / n);
    return { s, x: 80 + Math.cos(a) * 66 * r, y: 55 + Math.sin(a) * 40 * r };
  }).sort((a, b) => Math.atan2(a.y - 55, a.x - 80) - Math.atan2(b.y - 55, b.x - 80));
  const loop = `M${pts.map(p => `${f1(p.x)} ${f1(p.y)}`).join('L')}Z`;
  return `<svg class="sf-chart" viewBox="0 0 160 110" aria-hidden="true" focusable="false"><path class="sf-loop" d="${loop}" pathLength="1"/>
    ${pts.map(p => `<circle class="sd-h" data-scent="${p.s.id}" cx="${f1(p.x)}" cy="${f1(p.y)}" r="7"/><circle class="sd" data-scent="${p.s.id}" cx="${f1(p.x)}" cy="${f1(p.y)}" r="2.3"/>`).join('')}
    <circle class="sf-core-h" cx="80" cy="55" r="11"/><circle class="sf-core" cx="80" cy="55" r="4.2"/></svg>`;
}

let teardown: (() => void) | null = null;

export interface SkyStart { family?: string | null; scent?: string | null; mood?: string | null }

export function mountScentSky(el: HTMLElement, items: Item[], start: SkyStart = {}) {
  teardown?.();
  const live = (d: ScentDef) => offersOf(d, items);
  const inShop = (d: ScentDef) => live(d).some(o => o.buyable);
  const nShop = SCENTS.filter(inShop).length;

  // ---- state ----
  let view: 'all' | 'family' | 'scent' = 'all';
  let fam: Family | null = null, scent: ScentDef | null = null;
  const s0 = scentById(start.scent), f0 = isFamily(start.family) ? start.family : start.mood ? LEGACY_MOOD[start.mood] ?? null : null;
  if (s0) { scent = s0; fam = f0 && s0.families.includes(f0) ? f0 : s0.families[0]; view = 'scent'; }
  else if (f0) { fam = f0; view = 'family'; }

  // ---- the sky, drawn once ----
  const rnd = prng(29);
  const field = Array.from({ length: 150 }, () => {
    const x = rnd() * 1000, y = rnd() * 700, r = .5 + rnd() * 1.1, o = .2 + rnd() * .55;
    return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" style="--o:${o.toFixed(2)};--d:-${(rnd() * 6).toFixed(1)}s;--t:${(3 + rnd() * 4).toFixed(1)}s"/>`;
  }).join('');
  const famCells = FAMILY_ORDER.map((f, i) => {
    const x = FAMILIES[f], n = scentsIn(f).length;
    return `<li class="sf" data-family="${f}" style="--c:${x.star};--sw:${x.swatch};--i:${i}">
      <button type="button" class="sf-btn" data-family="${f}" aria-pressed="false" aria-label="${esc(x.label)}: ${plural(n, 'scent')}">${chartSVG(f)}
        <span class="sf-name">${esc(x.label)}</span><span class="sf-n">${plural(n, 'scent')}</span></button></li>`;
  }).join('');
  el.innerHTML = `<div class="ssky" data-view="all">
    <div class="ssky-stage">
      <svg class="ssky-field" viewBox="0 0 1000 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${field}</svg>
      <div class="ssky-cap" aria-hidden="true"><span>The Scent Sky</span><span>${FAMILY_ORDER.length} families · ${SCENTS.length} scents</span></div>
      <div class="ssky-all"><h3 class="sr-only" id="sskyAllH" tabindex="-1">The whole sky: ten scent families</h3>
        <ul class="ssky-fams" aria-labelledby="sskyAllH">${famCells}</ul>
        <svg class="ssky-threads" aria-hidden="true" focusable="false"></svg></div>
      <div class="ssky-focus" hidden></div>
    </div>
    <aside class="ssky-panel" aria-label="About your choice"></aside>
    <p class="sr-only" role="status" aria-live="polite" id="sskyStatus"></p>
  </div>`;
  const root = el.querySelector<HTMLElement>('.ssky')!, stage = root.querySelector<HTMLElement>('.ssky-stage')!;
  const allEl = root.querySelector<HTMLElement>('.ssky-all')!, focusEl = root.querySelector<HTMLElement>('.ssky-focus')!;
  const panel = root.querySelector<HTMLElement>('.ssky-panel')!, status = root.querySelector<HTMLElement>('#sskyStatus')!;
  const threads = root.querySelector<SVGSVGElement>('.ssky-threads')!;

  // ---- level 2: a family's scents as named stars ----
  const scentMeta = (d: ScentDef) => {
    const os = live(d), buy = os.filter(o => o.buyable);
    return buy.length ? buy.map(o => fmtName(o.format)).join(' · ') : os.some(o => o.item) ? 'Sold out' : 'Coming soon';
  };
  const focusHTML = (f: Family) => {
    const x = FAMILIES[f], list = scentsIn(f), r = prng(FAMILY_ORDER.indexOf(f) * 31 + 7);
    return `<div class="ssf" style="--c:${x.star};--sw:${x.swatch}">
      <div class="ssf-head"><span class="ssf-core" aria-hidden="true"></span><div><span class="eyebrow">Scent family · ${plural(list.length, 'scent')}</span>
        <h3 id="sskyFamH" tabindex="-1">${esc(x.label)}</h3><p><span class="d">${esc(x.desc)}</span></p></div>
        <button type="button" class="ssf-back" data-back="all">Whole sky</button></div>
      <div class="ssf-wrap"><svg class="ssf-lines" aria-hidden="true" focusable="false"></svg>
        <ul class="ssf-list" aria-labelledby="sskyFamH">${list.map((d, k) => {
          const soon = !inShop(d), meta = scentMeta(d);
          return `<li style="--dy:${f1((r() - .5) * 22)}px;--k:${k}"><button type="button" class="ss-btn${soon ? ' soon' : ''}" data-scent="${d.id}" aria-pressed="false" aria-label="${esc(d.name)}: ${esc(meta)}">
            <span class="ss-star" aria-hidden="true"></span><span class="ss-tx"><b>${esc(d.name)}</b><small>${esc(meta)}</small></span></button></li>`;
        }).join('')}</ul></div></div>`;
  };

  // ---- the panel ----
  const famChip = (f: Family, on = false) => `<button type="button" class="ssp-fam${on ? ' on' : ''}" data-family="${f}" style="--sw:${FAMILIES[f].swatch};--c:${FAMILIES[f].star}"><span class="swatch" aria-hidden="true"></span>${esc(FAMILIES[f].label)}</button>`;
  const panelHTML = () => {
    if (view === 'scent' && scent) {
      const d = scent, os = live(d), soon = !os.some(o => o.buyable);
      const rows = os.map(o => o.item
        ? `<li class="ssp-fmt${o.buyable ? '' : ' out'}" data-format="${o.format}"><a href="${productHref(o.item)}"><span>${esc(fmtName(o.format))}</span><b>${o.buyable ? esc(priceText(o.item)) : 'Sold out'}</b></a></li>`
        : `<li class="ssp-fmt soon" data-format="${o.format}"><span class="ssp-row"><span>${esc(fmtName(o.format))}</span><em>Coming soon</em></span></li>`).join('');
      return `<div class="ssp ssp-scent" data-scent="${d.id}">
        <button type="button" class="ssp-close" data-back="family" aria-label="Close ${esc(d.name)}"><svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
        <span class="eyebrow">${soon ? 'Coming soon' : 'In the shop'}</span><h3 id="sskyScentH" tabindex="-1">${esc(d.name)}</h3>
        <p class="ssp-lead"><span class="d">${d.families.length === 1 ? 'It shines in one family.' : `It shines in ${d.families.length} families: every one is lit in the sky.`}</span></p>
        <div class="ssp-fams" role="group" aria-label="${esc(d.name)} scent families">${d.families.map(f => famChip(f, f === fam)).join('')}</div>
        <span class="eyebrow ssp-sub">How it comes</span>
        <ul class="ssp-fmts">${rows}</ul>
        ${soon ? '<p class="small muted"><span class="d">Not in the shop yet. It will be here, with its price, as soon as it is added to the store.</span></p>' : ''}
        <div class="cta"><button type="button" class="btn line" data-back="family">Back to ${esc(FAMILIES[fam ?? d.families[0]].label)}</button></div></div>`;
    }
    if (view === 'family' && fam) {
      const x = FAMILIES[fam], list = scentsIn(fam), n = list.filter(inShop).length;
      return `<div class="ssp ssp-family"><span class="eyebrow">Scent family</span><h3>${esc(x.label)}</h3>
        <p><span class="d">${esc(x.desc)}</span></p>
        <p class="small muted">${plural(list.length, 'scent')} · ${n} in the shop now</p>
        <p class="muted"><span class="d">Choose a star to see where else that scent shines, how it comes and what it costs.</span></p>
        <div class="cta">${n ? `<a class="btn" href="#/shop?f=all&fam=${fam}&s=featured">Shop ${esc(x.label)}</a>` : ''}<button type="button" class="btn line" data-back="all">Whole sky</button></div></div>`;
    }
    return `<div class="ssp ssp-all"><span class="eyebrow">The Scent Sky</span><h3>Ten families, <span class="it">one sky.</span></h3>
      <p class="muted"><span class="d">Each family is a constellation and every star in it is a scent. Choose a family to see its scents, then a scent to see every family it shines in, how it comes and what it costs.</span></p>
      <p class="small muted">${SCENTS.length} scents · ${nShop} in the shop now</p>
      <div class="cta"><a class="btn line" href="#/explore?tab=quiz">Take the quiz instead</a></div></div>`;
  };

  // ---- the threads between one scent's stars across the sky ----
  const drawThreads = () => {
    threads.innerHTML = '';
    if (view !== 'scent' || !scent) return;
    const box = allEl.getBoundingClientRect();
    const pts = FAMILY_ORDER.filter(f => scent!.families.includes(f)).map(f => {
      const c = allEl.querySelector(`.sf[data-family="${f}"] .sd[data-scent="${scent!.id}"]`)?.getBoundingClientRect();
      return c ? [c.left + c.width / 2 - box.left, c.top + c.height / 2 - box.top] : null;
    }).filter((p): p is number[] => !!p);
    threads.setAttribute('viewBox', `0 0 ${f1(box.width)} ${f1(box.height)}`);
    if (pts.length > 1) threads.innerHTML = `<path class="st-path" pathLength="1" d="M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}"/>`;
    threads.innerHTML += pts.map(([x, y]) => `<circle class="st-pt" cx="${f1(x)}" cy="${f1(y)}" r="9"/>`).join('');
  };
  const drawLines = () => {
    const wrap = focusEl.querySelector<HTMLElement>('.ssf-wrap'), svg = focusEl.querySelector<SVGSVGElement>('.ssf-lines');
    if (!wrap || !svg) return;
    const box = wrap.getBoundingClientRect();
    const pts = [...wrap.querySelectorAll('.ss-star')].map(s => { const r = s.getBoundingClientRect(); return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top]; });
    svg.setAttribute('viewBox', `0 0 ${f1(box.width)} ${f1(box.height)}`);
    svg.innerHTML = pts.length > 1 ? `<path pathLength="1" d="M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}"/>` : '';
  };

  // ---- apply the state ----
  let shownFam: Family | null = null;
  const apply = (focus?: () => HTMLElement | null) => {
    root.dataset.view = view;
    const showFocus = view === 'family' && !!fam;
    allEl.hidden = showFocus; focusEl.hidden = !showFocus;
    if (showFocus && shownFam !== fam) { focusEl.innerHTML = focusHTML(fam!); shownFam = fam; }
    allEl.querySelectorAll<HTMLElement>('.sf').forEach(li => {
      const f = li.dataset.family as Family, has = !!scent && view === 'scent' && scent.families.includes(f);
      li.classList.toggle('lit', has); li.classList.toggle('dim', view === 'scent' && !has);
      li.querySelector('.sf-btn')!.setAttribute('aria-pressed', String(f === fam && view !== 'all'));
      li.querySelectorAll('.sd, .sd-h').forEach(c => c.classList.toggle('on', has && (c as SVGElement).dataset.scent === scent!.id));
    });
    focusEl.querySelectorAll<HTMLButtonElement>('.ss-btn').forEach(b => b.setAttribute('aria-pressed', String(!!scent && b.dataset.scent === scent.id)));
    panel.innerHTML = panelHTML();
    panel.dataset.view = view;
    status.textContent = view === 'scent' && scent ? `${scent.name}: lit in ${scent.families.map(f => FAMILIES[f].label).join(', ')}` : view === 'family' && fam ? `${FAMILIES[fam].label}: ${plural(scentsIn(fam).length, 'scent')}` : '';
    requestAnimationFrame(() => { drawThreads(); drawLines(); });
    const t = focus?.(); if (t) t.focus({ preventScroll: true });
  };

  const narrow = () => !window.matchMedia('(min-width: 1024px)').matches;
  const bring = (t: HTMLElement | null) => { if (t && narrow()) t.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'nearest' }); };
  const pickFamily = (f: Family) => {
    fam = f; if (scent && !scent.families.includes(f)) scent = null; view = 'family';
    apply(() => focusEl.querySelector<HTMLElement>('#sskyFamH')); bring(stage);
  };
  const pickScent = (d: ScentDef) => {
    scent = d; if (!fam || !d.families.includes(fam)) fam = d.families[0]; view = 'scent';
    apply(() => panel.querySelector<HTMLElement>('#sskyScentH')); bring(panel);
  };
  const back = (to: 'family' | 'all') => {
    if (to === 'family' && fam) { const s = scent; view = 'family'; apply(() => (s && focusEl.querySelector<HTMLElement>(`.ss-btn[data-scent="${s.id}"]`)) || focusEl.querySelector<HTMLElement>('#sskyFamH')); return; }
    const f = fam; view = 'all'; scent = null;
    apply(() => (f && allEl.querySelector<HTMLElement>(`.sf-btn[data-family="${f}"]`)) || null);
  };

  root.addEventListener('click', e => {
    const t = e.target as HTMLElement;
    const fb = t.closest<HTMLElement>('.sf-btn, .ssp-fam'); if (fb) { pickFamily(fb.dataset.family as Family); return; }
    const sb = t.closest<HTMLElement>('.ss-btn'); if (sb) { const d = scentById(sb.dataset.scent); if (d) pickScent(d); return; }
    const bk = t.closest<HTMLElement>('[data-back]'); if (bk) back(bk.dataset.back === 'family' ? 'family' : 'all');
  });
  // Escape: the scent panel closes back to its family, then the family back to the whole sky
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || view === 'all' || !root.isConnected) return;
    if (document.body.classList.contains('cart-open') || document.documentElement.classList.contains('mm-lock')) return;
    const a = document.activeElement;
    if (a && a !== document.body && !root.contains(a)) return;
    e.preventDefault(); back(view === 'scent' ? 'family' : 'all');
  };
  document.addEventListener('keydown', onKey);
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { drawThreads(); drawLines(); }) : null;
  ro?.observe(stage);
  const td = () => { document.removeEventListener('keydown', onKey); ro?.disconnect(); window.removeEventListener('hashchange', td); if (teardown === td) teardown = null; };
  teardown = td; window.addEventListener('hashchange', td);
  root.classList.toggle('calm', reduceMotion());
  apply();
}

/** The full list under the sky: every scent on the owner's list, its families and each format (a live link with Wix's
 *  price, or "Coming soon"). It is the plain-text way through the same information. */
export function fullListHTML(items: Item[]): string {
  const cards = SCENTS.map(d => {
    const os = offersOf(d, items), lead = FAMILIES[d.families[0]];
    return `<div class="fl-card" data-scent="${d.id}" style="--sw:${lead.swatch}"><h3>${esc(d.name)}</h3>
      <p class="fl-fams small">${d.families.map(f => esc(FAMILIES[f].label)).join(' · ')}</p>
      <div class="fl-fmts">${os.map(o => o.item
        ? `<a href="${productHref(o.item)}"><span>${esc(fmtName(o.format))}</span><b>${o.buyable ? esc(priceText(o.item)) : 'Sold out'}</b></a>`
        : `<span class="fl-soon"><span>${esc(fmtName(o.format))}</span><em>Coming soon</em></span>`).join('')}</div></div>`;
  }).join('');
  return `<h2 class="fl-title">Every scent</h2><p class="muted fl-lead"><span class="d">The whole list, in one place: each scent, its families and how it comes.</span></p><div class="fl-cards fl-all">${cards}</div>`;
}
