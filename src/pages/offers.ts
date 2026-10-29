// Live combos and discounts panel: shown on the shop, Find your scent and product pages.
//
// As the cart changes it shows what has been spent, the combos formed (the same scent in two formats is a Ritual Pair, in
// three a Ritual Trio), the savings ladder, and how far the next step is. It only reads the cart; it never touches a total.
//
// DRAFT: the ladder values below are placeholders for Claire to confirm, and Wix has no discount rules for them yet, so every
// figure here is labelled an estimate that "applies at checkout once live". See the list of Wix rules in the build notes.
import '../offers.css';
import { getLines, onCart, subtotal, type Line } from '../cart';
import { FREE_SHIPPING_THRESHOLD } from '../config';
import { classify, loadCatalogue, money, type Item } from '../wix';
import { esc } from '../ui';
import { isBuyable, scentDef, scentKey } from '../data/scents';

/** Draft ladder (confirm with Claire): the share off the whole order once the cart holds this many items. */
export const ITEM_TIERS: { items: number; pct: number }[] = [{ items: 2, pct: 10 }, { items: 3, pct: 15 }];

interface Combo { scent: string; name: string; formats: string[]; missing?: Item }
interface State { spend: number; items: number; pct: number; saving: number; combos: Combo[]; on: boolean[] }

const FORMAT_NAME: Record<string, string> = { candle: 'candle', roller: 'roller', diffuser: 'mini diffuser' };
const FORMAT_ORDER = ['candle', 'roller', 'diffuser'];
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
let catalogue: Item[] | null = null;

/** Everything the panel shows, worked out from the cart lines. Pure: the same lines always give the same state. */
export function offerState(lines: Line[], cat: Item[] | null = catalogue): State {
  const spend = Math.round(subtotal() * 100) / 100;
  const items = lines.reduce((n, l) => n + l.qty, 0);
  const tier = [...ITEM_TIERS].reverse().find(t => items >= t.items);
  const pct = tier?.pct ?? 0;
  const saving = Math.round(spend * pct) / 100;
  const byScent = new Map<string, Set<string>>();
  for (const l of lines) {
    const c = classify(l.name, []), format = c.format, scent = scentDef(c.scent)?.name ?? c.scent; // ("Amber + Rose" is the list's Amber & Rose)
    if (!FORMAT_ORDER.includes(format)) continue;
    byScent.set(scent, (byScent.get(scent) ?? new Set()).add(format));
  }
  const combos: Combo[] = [];
  for (const [scent, set] of byScent) {
    const formats = FORMAT_ORDER.filter(f => set.has(f));
    if (formats.length >= 2) combos.push({ scent, formats, name: formats.length >= 3 ? 'Ritual Trio' : 'Ritual Pair' });
    else if (cat) {
      // one format so far: the nearest way to a Ritual Pair is this scent's roller (or its candle, for a roller or diffuser)
      const want = formats[0] === 'candle' ? 'roller' : 'candle';
      const sib = cat.find(i => scentKey(i.scent) === scentKey(scent) && i.format === want && isBuyable(i));
      if (sib) combos.push({ scent, formats, name: '', missing: sib });
    }
  }
  const on = [...ITEM_TIERS.map(t => items >= t.items), spend >= FREE_SHIPPING_THRESHOLD];
  return { spend, items, pct, saving, combos, on };
}

/** The one sentence that says where the visitor stands and what is next. Read out by screen readers when it changes. */
export function nextMessage(s: State): string {
  const nextTier = ITEM_TIERS.find(t => s.items < t.items);
  const lead = s.pct ? `${s.pct}% off is yours. ` : '';
  if (nextTier) {
    const n = nextTier.items - s.items;
    return `${lead}Add ${n === 1 ? '1 more item' : `${n} items`} to unlock ${nextTier.pct}% off.`;
  }
  if (s.spend < FREE_SHIPPING_THRESHOLD) return `${lead}Add ${money(FREE_SHIPPING_THRESHOLD - s.spend)} more to unlock free shipping in Canada.`;
  return `All unlocked: ${s.pct}% off and free shipping in Canada.`;
}

const CHECK = '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="of-tick" d="M4.5 10.5l3.6 3.6 7.4-8"/></svg>';

function tierRows(s: State, just: boolean[]): string {
  const rows = [
    ...ITEM_TIERS.map((t, i) => ({ label: `${t.items}${i === ITEM_TIERS.length - 1 ? '+' : ''} items`, perk: `${t.pct}% off your order`, now: s.items, goal: t.items, left: `Add ${plural(Math.max(0, t.items - s.items), 'more item')}` })),
    { label: `${money(FREE_SHIPPING_THRESHOLD)}+`, perk: 'Free shipping in Canada', now: s.spend, goal: FREE_SHIPPING_THRESHOLD, left: `Add ${money(Math.max(0, FREE_SHIPPING_THRESHOLD - s.spend))} more` },
  ];
  return rows.map((r, i) => {
    const pct = Math.min(100, Math.round((r.now / r.goal) * 100));
    return `<li class="of-tier${s.on[i] ? ' on' : ''}${just[i] ? ' just' : ''}" data-tier="${i}">
      <span class="of-dot">${CHECK}</span>
      <span class="of-tx"><b>${esc(r.label)}</b> <span>${esc(r.perk)}</span></span>
      <span class="of-st">${s.on[i] ? 'Unlocked' : esc(r.left)}${just[i] ? ' <i class="of-yay" aria-hidden="true">Unlocked!</i>' : ''}</span>
      <span class="of-meter" role="meter" aria-label="Progress to ${esc(r.perk.toLowerCase())}" aria-valuemin="0" aria-valuemax="${r.goal}" aria-valuenow="${Math.min(r.goal, Math.round(r.now * 100) / 100)}"><i style="width:${pct}%"></i></span></li>`;
  }).join('');
}

function comboHTML(s: State): string {
  const formed = s.combos.filter(c => !c.missing);
  const near = s.combos.find(c => c.missing);
  const rows = formed.map(c => `<li class="of-combo"><span class="of-gem" aria-hidden="true"></span><span><b>${c.name}</b> <span class="muted">${esc(c.scent)} ${c.formats.map(f => FORMAT_NAME[f]).join(' + ')}</span></span></li>`).join('');
  const nudge = near?.missing ? `<p class="of-nudge small">Add the <a href="#/product/${near.missing.slug}">${esc(near.scent)} ${FORMAT_NAME[near.missing.format]}</a> to make a Ritual Pair.</p>` : '';
  return `<h3 class="of-sub">Combos</h3>${rows ? `<ul class="of-combos">${rows}</ul>` : `<p class="of-none small">${s.items ? 'No combos yet.' : 'None yet.'} A candle and a roller of the same scent make a Ritual Pair.</p>`}${nudge}`;
}

function moneyHTML(s: State): string {
  if (!s.items) return '';
  return `<dl class="of-sum"><div><dt>In your cart</dt><dd>${money(s.spend)}</dd></div>
    ${s.pct ? `<div class="of-save"><dt>Estimated savings (${s.pct}%)</dt><dd>&minus;${money(s.saving)}</dd></div><div><dt>Estimated total</dt><dd>${money(s.spend - s.saving)}</dd></div>` : ''}</dl>`;
}

const panels = new Set<HTMLElement>();
const hostOf = new WeakMap<HTMLElement, HTMLElement>();
const DESKTOP = '(min-width: 1024px)';
let wired = false;

/** Forget panels whose page has been replaced (a phone's bar lives on the body, outside the page that made it). */
function live(): HTMLElement[] {
  for (const p of [...panels]) if (!hostOf.get(p)?.isConnected) { p.remove(); panels.delete(p); }
  return [...panels];
}

/** A desktop's panel is the first thing in the page's wrap (its left column); a phone's bar sits on the body, because the
 *  page's entrance animation would otherwise carry a fixed bar along with the page. */
function place(el: HTMLElement) {
  const host = hostOf.get(el)!;
  if (window.matchMedia(DESKTOP).matches) { if (el.parentElement !== host) host.prepend(el); }
  else if (el.parentElement !== document.body) document.body.appendChild(el);
}

function paint(el: HTMLElement, announce: boolean) {
  const lines = getLines();
  const s = offerState(lines);
  const prev = (el.dataset.on ?? '').split(',').map(x => x === '1');
  const just = s.on.map((on, i) => announce && on && prev.length === s.on.length && !prev[i]);
  el.dataset.on = s.on.map(x => (x ? '1' : '0')).join(',');
  el.dataset.items = String(s.items);
  el.dataset.pct = String(s.pct);
  const msg = (just.some(Boolean) ? 'Unlocked! ' : '') + nextMessage(s);
  const live = el.querySelector<HTMLElement>('.of-live')!;
  const msgEl = live.querySelector<HTMLElement>('.of-msg')!;
  if (msgEl.textContent !== msg) msgEl.textContent = msg;
  live.querySelector<HTMLElement>('.of-money')!.textContent = `${money(s.spend)} · ${plural(s.items, 'item')}`;
  el.querySelector<HTMLElement>('.of-details')!.innerHTML = `${moneyHTML(s)}<h3 class="of-sub">Your savings ladder</h3><ol class="of-ladder">${tierRows(s, just)}</ol>${comboHTML(s)}
    <p class="of-est small"><span class="d">Estimate only. Discounts apply at checkout once live.</span></p>`;
  if (just.some(Boolean)) {
    el.classList.add('of-pop');
    window.setTimeout(() => { el.classList.remove('of-pop'); el.querySelectorAll('.of-tier.just').forEach(t => t.classList.remove('just')); }, 2600);
  }
  avoid(el);
}

/** On phones and tablets the bar steps aside whenever it would sit over an Add to cart button. */
function avoid(el: HTMLElement) {
  if (!el.isConnected) return;
  if (window.matchMedia(DESKTOP).matches) { el.classList.remove('of-away'); return; }
  el.classList.remove('of-away');
  const r = el.getBoundingClientRect();
  const hit = [...document.querySelectorAll<HTMLElement>('#addBtn, button.qa, a.qa, .lnav button, [data-add], .btn[data-qa], button[data-qa]')].some(b => {
    if (el.contains(b)) return false;
    const q = b.getBoundingClientRect();
    if (!q.width || !q.height || getComputedStyle(b).visibility === 'hidden') return false;
    return q.bottom > r.top - 6 && q.top < r.bottom + 6 && q.right > r.left - 6 && q.left < r.right + 6;
  });
  el.classList.toggle('of-away', hit && !el.classList.contains('open'));
}

function wire() {
  if (wired) return;
  wired = true;
  onCart(() => live().forEach(p => paint(p, true)));
  let raf = 0;
  const check = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => live().forEach(p => { place(p); avoid(p); })); };
  window.addEventListener('scroll', check, { passive: true });
  window.addEventListener('resize', check);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') panels.forEach(p => closeSheet(p)); });
  document.addEventListener('click', e => { panels.forEach(p => { if (p.classList.contains('open') && !p.contains(e.target as Node)) closeSheet(p); }); });
}

function closeSheet(el: HTMLElement) {
  if (!el.classList.contains('open')) return;
  el.classList.remove('open');
  el.querySelector('.of-toggle')?.setAttribute('aria-expanded', 'false');
  avoid(el);
}

/**
 * Mounts the panel on a page. On a desktop it is the left column of the page's main .wrap; on a phone or tablet it is a compact
 * bar near the bottom (beside the breathing orb, never over it) that opens into the full ladder.
 */
export function mountOffers(app: HTMLElement) {
  const wrap = app.querySelector<HTMLElement>(':scope > .wrap');
  if (!wrap || wrap.classList.contains('has-offers')) return;
  const el = document.createElement('aside');
  el.className = 'offers';
  el.setAttribute('aria-label', 'Combos and discounts');
  el.innerHTML = `<div class="of-top"><h2 class="of-h"><span class="eyebrow">Combos &amp; savings</span></h2>
      <div class="of-live" role="status" aria-live="polite" aria-atomic="true"><span class="of-money"></span><span class="of-msg"></span></div>
      <button type="button" class="of-toggle" aria-label="Show combos and savings details" aria-expanded="false" aria-controls="ofDetails"><span>Details</span><svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10l5-5 5 5"/></svg></button>
      <span class="of-tag">Estimate</span></div>
    <div class="of-details" id="ofDetails"></div>`;
  wrap.classList.add('has-offers');
  live();
  hostOf.set(el, wrap);
  panels.add(el);
  place(el);
  paint(el, false);
  el.querySelector<HTMLButtonElement>('.of-toggle')!.addEventListener('click', e => {
    e.stopPropagation();
    const open = el.classList.toggle('open');
    (e.currentTarget as HTMLElement).setAttribute('aria-expanded', String(open));
    avoid(el);
  });
  wire();
  // what the cart could still add (the missing half of a pair) comes from the catalogue the page has already loaded
  if (!catalogue) loadCatalogue().then(c => { catalogue = c; live().forEach(p => paint(p, false)); }).catch(() => { /* the panel works without it */ });
  else paint(el, false);
  window.setTimeout(() => avoid(el), 600);
}
