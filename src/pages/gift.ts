// Send a Sky: gift a candle without leaving the page.
// The candle list is the live catalogue (candles that are on sale and in stock, with their real sizes and prices); the gift
// sets stay "coming soon". "Add gift to cart" puts the chosen candle in the cart with the card details on the line (the
// note, who it is for, the day it should arrive on or after, the card's sky and "hide prices"), and the cart drawer shows
// them under the item. New customer-facing wording is a draft for Claire (span.d). Checkout stays switched off in the preview.
import { add, type GiftDetails } from '../cart';
import { loadProduct, money, type Item } from '../wix';
import { esc, toastAdded } from '../ui';
import '../giftbook.css';

const NOTE_MAX = 140;
const NAME_MAX = 60;
const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const longDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'short', month: 'long', day: 'numeric' });
const SKY_NAME: Record<string, string> = { dawn: 'Dawn', golden: 'Golden hour', night: 'Night' };

/** Candles a buyer can send today: on sale, in stock, with at least one size in stock. */
export function giftableCandles(items: Item[]): Item[] {
  return items
    .filter(i => i.format === 'candle' && i.inStock && (!i.choices.length || i.choices.some(c => c.inStock)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The gift details under a cart line (the cart drawer). */
export function giftLineHTML(g: GiftDetails): string {
  const bits = [
    g.to ? `<span><span class="d">For</span> ${esc(g.to)}</span>` : '',
    `<span><span class="d">${g.date ? `Arrives on or after ${esc(longDay(g.date))}` : 'Sent as soon as it is ready'}</span></span>`,
    g.hidePrices ? '<span><span class="d">No prices on the packing slip</span></span>' : '',
    g.sky && SKY_NAME[g.sky] ? `<span><span class="d">${SKY_NAME[g.sky]} card</span></span>` : '',
  ].filter(Boolean);
  return `<div class="li-gift"><span class="li-gift-tag"><span class="d">Gift</span></span><span class="li-gift-meta">${bits.join('<span aria-hidden="true"> · </span>')}</span>${g.note ? `<q class="li-gift-note">${esc(g.note)}</q>` : ''}</div>`;
}

export function wireGift(app: HTMLElement, items: Item[]) {
  const candles = giftableCandles(items);
  const live = app.querySelector<HTMLAnchorElement>('a.gr-live');
  const oldBtn = app.querySelector<HTMLButtonElement>('#gAdd');
  if (!candles.length || !live || !oldBtn) return; // no candle to send: the page keeps its "shop candles" link
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => app.querySelector<T>(s);

  // the "Gift a candle" tile turns from a link to the shop into the heading of the list right under it
  const head = document.createElement('div');
  head.className = 'gr-live on'; head.dataset.grLive = 'candle';
  head.innerHTML = `${live.firstElementChild!.outerHTML}<span class="gr-go"><span class="d">${candles.length} candles to choose from</span></span>`;
  // (the list sits above the coming-soon gift sets, outside their grid)
  const box = document.createElement('div'); box.className = 'gr-livebox';
  live.closest('.fmt-pick')!.before(box); live.remove(); box.appendChild(head);
  head.insertAdjacentHTML('afterend', `<div class="gpick" id="gPick">
    <div class="gp-list" role="group" aria-label="Choose a candle">${candles.map(c => `<button type="button" class="gp-c" data-gift-candle="${esc(c.id)}" aria-pressed="false">
      <img src="${esc(c.thumb)}" alt="" width="44" height="55" loading="lazy" decoding="async"><span><b>${esc(c.scent)}</b><em>${c.priceMin === c.priceMax ? money(c.priceMin) : `${money(c.priceMin)} to ${money(c.priceMax)}`}</em></span></button>`).join('')}</div>
    <div class="gp-size" id="gSizeRow" hidden><span class="eyebrow" id="gSizeLbl">Size</span><div class="chips" id="gSizes" role="group" aria-labelledby="gSizeLbl"></div></div>
    <p class="g-err" id="gPickErr" hidden></p></div>`);

  // what is in the box, under the card preview: the chosen candle's own photograph
  $('#gCard')?.insertAdjacentHTML('afterend', `<div class="g-sum" id="gSum" hidden aria-live="polite"><img alt="" width="64" height="80"><div><span class="eyebrow"><span class="d">In the box</span></span><b id="gSumName"></b><span id="gSumSize" class="small muted"></span></div></div>`);

  // a fresh button (the page's old one only said gifting was switched off)
  const btn = oldBtn.cloneNode(false) as HTMLButtonElement;
  btn.disabled = false; btn.removeAttribute('aria-disabled');
  oldBtn.replaceWith(btn);
  const why = $('#gAddWhy')!;
  why.classList.remove('muted'); why.setAttribute('aria-live', 'polite');
  const whyIdle = '<span class="d">Choose a candle, write your note, then add it to your cart. Gift sets are coming soon.</span>';
  why.innerHTML = whyIdle;

  // the note counter, kept in step as the buyer types
  const note = $<HTMLTextAreaElement>('#gNote')!, cnt = $('#gCount')!;
  const count = () => { cnt.textContent = `${note.value.length} of ${NOTE_MAX} characters`; };
  note.addEventListener('input', count); count();

  // the date: from today, up to a year ahead
  const date = $<HTMLInputElement>('#gDate')!;
  const today = new Date(); const yearOut = new Date(today); yearOut.setFullYear(today.getFullYear() + 1);
  date.min = isoDay(today); date.max = isoDay(yearOut);
  const to = $<HTMLInputElement>('#gTo')!;

  let chosen: Item | null = null;
  let size: string | undefined;
  let prices: Record<string, number> = {};
  let pending: Promise<void> = Promise.resolve();
  const priceNow = () => (chosen ? prices[size ?? ''] ?? (chosen.priceMin === chosen.priceMax ? chosen.priceMin : undefined) : undefined);
  const paint = () => {
    const p = priceNow();
    btn.innerHTML = `<span class="d">Add gift to cart</span>${chosen && p != null ? ` · ${money(p)}` : ''}`;
    const sum = $('#gSum')!;
    sum.hidden = !chosen;
    if (chosen) {
      const img = sum.querySelector('img')!;
      if (chosen.image) { img.src = chosen.image; img.hidden = false; } else img.hidden = true;
      $('#gSumName')!.textContent = `${chosen.scent} candle`;
      $('#gSumSize')!.textContent = [size, p != null ? money(p) : ''].filter(Boolean).join(' · ');
    }
  };
  const sizesFor = async (c: Item) => {
    const row = $('#gSizeRow')!, box = $('#gSizes')!;
    const open = c.choices.filter(x => x.inStock);
    size = open[0]?.name ?? c.choices[0]?.name;
    prices = {};
    row.hidden = c.choices.length < 2;
    const chips = () => {
      box.innerHTML = c.choices.map(x => `<button type="button" class="chip" data-gift-size="${esc(x.name)}" aria-pressed="${x.name === size}" ${x.inStock ? '' : 'disabled'}>${esc(x.name)}${x.inStock ? (prices[x.name] != null ? ` · ${money(prices[x.name])}` : '') : ' · sold out'}</button>`).join('');
      box.querySelectorAll<HTMLButtonElement>('[data-gift-size]').forEach(b => b.addEventListener('click', () => { size = b.dataset.giftSize; chips(); paint(); }));
    };
    chips(); paint();
    // the size prices come from the product itself (the catalogue only carries a range)
    try {
      const p = await loadProduct(c.slug);
      if (chosen !== c) return;
      for (const v of p?.variantsInfo?.variants ?? []) {
        const name = v.choices?.[0]?.optionChoiceNames?.choiceName; const amt = Number(v.price?.actualPrice?.amount);
        if (name && Number.isFinite(amt)) prices[name] = amt;
      }
      if (c.choices.length === 1 && c.priceMin === c.priceMax) prices[c.choices[0].name] = c.priceMin;
      chips(); paint();
    } catch { /* the range stays; the line is added at the catalogue's lowest price only if no size price is known */ }
  };
  app.querySelectorAll<HTMLButtonElement>('[data-gift-candle]').forEach(b => b.addEventListener('click', () => {
    chosen = candles.find(c => c.id === b.dataset.giftCandle) ?? null;
    app.querySelectorAll('[data-gift-candle]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    setErr('gPickErr', null);
    if (chosen) pending = sizesFor(chosen);
  }));
  paint();

  // ---------- checks: one message under each field that needs it, and the first one focused ----------
  function setErr(id: string, msg: string | null, field?: HTMLElement) {
    let el = app.querySelector<HTMLElement>(`#${id}`);
    if (!el && field) { el = document.createElement('p'); el.className = 'g-err'; el.id = id; field.insertAdjacentElement('afterend', el); }
    if (!el) return;
    el.hidden = !msg; el.innerHTML = msg ? `<span class="d">${msg}</span>` : '';
    if (field) { if (msg) { field.setAttribute('aria-invalid', 'true'); field.setAttribute('aria-describedby', [field.id === 'gNote' ? 'gCount' : '', id].filter(Boolean).join(' ')); } else { field.removeAttribute('aria-invalid'); if (field.id === 'gNote') field.setAttribute('aria-describedby', 'gCount'); else field.removeAttribute('aria-describedby'); } }
  }
  const check = () => {
    const bad: HTMLElement[] = [];
    const n = note.value.trim(), who = to.value.trim(), d = date.value;
    const pickErr = !chosen ? 'Choose a candle to send.' : (size && chosen.choices.find(c => c.name === size)?.inStock === false) ? 'That size is sold out. Choose another.' : null;
    setErr('gPickErr', pickErr); if (pickErr) bad.push(app.querySelector<HTMLElement>('[data-gift-candle][aria-pressed="true"]') ?? app.querySelector<HTMLElement>('[data-gift-candle]')!);
    const noteErr = !n ? 'Write a short note for the card.' : n.length > NOTE_MAX ? `Keep the note to ${NOTE_MAX} characters (it is ${n.length} now).` : null;
    setErr('gNoteErr', noteErr, note); if (noteErr) bad.push(note);
    const toErr = !who ? 'Add the name to print on the card.' : who.length > NAME_MAX ? `Keep the name to ${NAME_MAX} characters.` : null;
    setErr('gToErr', toErr, to); if (toErr) bad.push(to);
    let dateErr: string | null = null;
    if (date.validity.badInput) dateErr = 'Enter the date as day, month and year.';
    else if (d && d < date.min) dateErr = 'That day has passed. Choose today or a later day.';
    else if (d && d > date.max) dateErr = 'Choose a day within the next year.';
    setErr('gDateErr', dateErr, date); if (dateErr) bad.push(date);
    return bad;
  };
  [note, to, date].forEach(f => f.addEventListener(f === date ? 'change' : 'input', () => { if (f.hasAttribute('aria-invalid')) check(); }));

  btn.addEventListener('click', async () => {
    const bad = check();
    if (bad.length) {
      why.innerHTML = `<span class="d">${bad.length === 1 ? 'One thing to fix' : `${bad.length} things to fix`} before this gift can go in your cart.</span>`;
      why.classList.add('g-why-err');
      bad[0].focus();
      if (!bad[0].matches('[data-gift-candle]')) bad[0].scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      else $('#gPick')!.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      return;
    }
    await pending; // the size prices, if they are still on their way
    const c = chosen!;
    const gift: GiftDetails = {
      to: to.value.trim(), note: note.value.trim(), date: date.value || undefined,
      hidePrices: !!$<HTMLInputElement>('#gHide')?.checked,
      sky: app.querySelector<HTMLElement>('#gCard')?.dataset.t,
    };
    await add({ productId: c.id, slug: c.slug, name: c.name, price: priceNow() ?? c.priceMin, image: c.thumb, choice: size, optionName: c.optionName, gift });
    why.classList.remove('g-why-err');
    why.innerHTML = '<span class="d">Added, with your note. Checkout is switched off in this private preview, so nothing is sent yet.</span>';
    toastAdded(`${c.scent} candle, a gift for ${gift.to},`);
  });
}
