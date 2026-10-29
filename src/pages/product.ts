import { replaceRoute } from '../router';
import { mountOffers } from './offers';
import { mountLocalNav } from '../nav';
import Product from '../canvas/pages/Product.html?raw';
import { loadCatalogue, loadProduct, toItem, imgSrc, money, type Item } from '../wix';
import { cardHTML, fixImages, errorBox, wireCommon, toast, toastAdded, esc } from '../ui';
import { add } from '../cart';
import { canvasSlugToLive, wireQuickAdd, previewOff } from './shared';
import { FAMILIES } from '../data/scents';
import { LOYALTY_ENABLED, SHOW_DEODORANT, FREE_SHIPPING_THRESHOLD, type Format } from '../config';
import { productStudioHTML } from '../moons';
import { givingNote } from './giving';

// Copy from the canvas product boards (roller = Product, diffuser = Cart drawer board).
// Candle and deodorant copy is new (not from the canvas): it states only what the site already says (soy wax, wooden wicks,
// poured by hand in small batches in White Rock, BC) and is wrapped as a draft for Claire. The candle care lines point to the Journal.
const CANVAS_COPY: Partial<Record<Format, { about: string; use: string[]; best: string; draft?: boolean; links?: [string, string][] }>> = {
  roller: {
    about: 'A glass roller bottle that slips into a pocket or bag. Roll onto wrists, neck and behind the ears whenever you want a moment to reset.',
    use: ['Roll onto pulse points: wrists, neck and behind the ears.', 'Reapply through the day as you like.', 'Patch test first if you have sensitive skin.', 'Store upright, away from heat and sunlight.'],
    best: 'A mindful pause',
  },
  diffuser: {
    about: 'A small reed diffuser sized for desks, bathrooms, bedside tables and cars. No flame, no plug, just a steady, gentle scent.',
    use: ['Place the reeds in the bottle.', 'Flip the reeds every few days to refresh the scent.', 'Keep away from heat, sunlight and finished surfaces.', 'Keep out of reach of children and pets.'],
    best: 'Getting ready',
  },
  candle: {
    about: 'Soy wax and a wooden wick, poured by hand in small batches in White Rock, BC, and finished by hand.',
    use: ['On the first burn, let the wax melt right to the edge before you put it out.', 'Trim the wooden wick short before each light.', 'Burn it in sight, away from draughts, children and pets.'],
    best: 'Coming home, evenings and slowing down',
    draft: true,
    links: [['How to burn a wooden-wick candle', '#/journal/wooden-wick'], ['Your first burn, and the memory ring', '#/journal/first-burn'], ['Candle safety, the short version', '#/journal/candle-safety']],
  },
  deodorant: {
    about: 'A natural deodorant in our signature scents, made in small batches in British Columbia.',
    use: ['Apply a small amount to clean, dry underarms.', 'Patch test first if you have sensitive skin.', 'Store away from heat.'],
    best: 'Every morning',
    draft: true,
  },
};
// Scent copy that exists on the canvas (draft until Claire approves).
const CANVAS_SCENT: Record<string, { line: string; notes: [string, string, string] }> = {
  'inner sanctum': { line: 'Quiet and centering. A scent for slowing down, breathing deeper and coming back to yourself.', notes: ['Frankincense', 'Cedar', 'Lavender'] },
  'peony bloom': { line: 'Fresh-cut petals in a bright room. Light, romantic and never overpowering.', notes: ['Peony', 'Rose petal', 'Soft musk'] },
};
const PLURAL: Record<Format, string> = { roller: 'Fragrance rollers', diffuser: 'Mini diffusers', candle: 'Candles', deodorant: 'Deodorant' };

const htmlToParas = (html?: string | null): string[] => {
  if (!html) return [];
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const blocks = [...doc.body.querySelectorAll('p, li')].map(e => e.textContent?.trim() ?? '').filter(Boolean);
  return blocks.length ? blocks : [doc.body.textContent?.trim() ?? ''].filter(Boolean);
};

export async function renderProduct(app: HTMLElement, slug: string) {
  app.innerHTML = `<div class="wrap" style="padding:80px 0">${'<div class="sk-line"></div>'.repeat(3)}</div>`;
  let items: Item[];
  try { items = await loadCatalogue(); } catch (e) { app.innerHTML = `<div class="wrap" style="padding:80px 0">${errorBox(String((e as Error).message ?? e))}</div>`; return; }

  let item = items.find(i => i.slug === slug);
  if (!item) {
    const live = canvasSlugToLive(items, slug);
    if (live) { replaceRoute(`/product/${live.slug}`); return; }
    if (!SHOW_DEODORANT && /deodorant/i.test(slug)) return renderUnavailable(app);
    // the canvas's own sample addresses (roller-…, diffuser-…, candle-…) are concepts; any other address is a product that is
    // not on the owner's list (hidden site-wide, src/data/scents.ts) or not in the store at all
    if (/^(roller|diffuser|candle|deodorant)-/.test(slug)) return renderNotInStore(app, slug);
    return renderUnavailable(app, false);
  }

  let p: any;
  try { p = await loadProduct(item.slug); } catch { p = null; }
  if (p) item = toItem(p);
  const it = item!;

  app.innerHTML = fixImages(Product);
  wireCommon(app);
  mountOffers(app);
  const $ = <T extends Element = HTMLElement>(sel: string) => app.querySelector<T>(sel);

  // candles: one photograph of Claire's real bench work under the gallery (a past pour, not named, so nothing reads as buyable)
  if (it.format === 'candle') $('.pdp > div:first-child')?.insertAdjacentHTML('beforeend', productStudioHTML());

  // breadcrumbs
  $('.crumbs')!.innerHTML = `<a href="#/">Home</a> / <a href="#/shop">Shop</a> / <a href="#/shop?f=${it.format}&fam=all&s=featured">${PLURAL[it.format]}</a> / <span aria-current="page">${esc(it.scent)}</span>`;

  // gallery: Claire's photos first; canvas renders only fill empty slots
  const live = (p?.media?.itemsInfo?.items ?? []).map((m: any) => imgSrc(m, 1000, 1250)).filter(Boolean);
  const photos: { src: string; render: boolean }[] = live.length ? live.map((src: string) => ({ src, render: false })) : [{ src: it.image, render: false }];
  // (renders no longer fill empty slots: they showed generic amber jars beside the real product)
  const mainImg = $<HTMLImageElement>('#mainImg')!;
  mainImg.src = photos[0].src; mainImg.alt = it.name; mainImg.classList.toggle('dimg', photos[0].render);
  $('.thumbs')!.innerHTML = photos.map((ph, n) =>
    `<button data-g="${n}" aria-pressed="${n === 0}" aria-label="Image ${n + 1}"><img src="${ph.src}" alt="" width="72" height="90" loading="lazy" decoding="async"${ph.render ? ' class="dimg"' : ''}></button>`).join('');
  $('.gallery')!.classList.toggle('one', photos.length < 2);
  app.querySelectorAll<HTMLButtonElement>('.thumbs button').forEach(b => b.addEventListener('click', () => {
    const ph = photos[Number(b.dataset.g)];
    mainImg.src = ph.src; mainImg.classList.toggle('dimg', ph.render);
    app.querySelectorAll('.thumbs button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));
  // hotspots describe the roller bottle only
  if (it.format !== 'roller') { $('#hsLayer')?.remove(); $('.hs-tip')?.remove(); $('#mainWrap + p, .gallery + p')?.remove(); }
  else {
    const tip = $('.hs-tip'); if (tip) tip.classList.add('d', 'confirm');
    $('#mainWrap + p, .gallery + p')?.classList.add('confirm');
    app.querySelectorAll<HTMLButtonElement>('.hs').forEach(h => h.addEventListener('click', () => {
      app.querySelectorAll('.hs').forEach(x => x.setAttribute('aria-expanded', String(x === h)));
      const t = $('.hs-tip'); if (t) { t.style.top = `calc(${h.style.top} + 24px)`; t.style.left = `calc(${h.style.left} - 17px)`; t.querySelector('b')!.textContent = h.getAttribute('aria-label'); }
    }));
  }
  if (it.format !== 'roller') $('#vidBtn')?.remove();
  else $('#vidBtn')?.addEventListener('click', () => toast('The how-to video has not been added yet.'));

  // title block
  // the scent's families from the owner's list (one compact line, so the price stays above the fold on a phone)
  const eyebrow = $('.buy .eyebrow')!;
  eyebrow.classList.add('p-fams');
  eyebrow.innerHTML = it.families.length
    ? it.families.map(f => `<span class="fam" data-family="${f}"><span class="swatch" style="background:${FAMILIES[f].swatch}" aria-hidden="true"></span>${esc(FAMILIES[f].label)}</span>`).join('<span class="fam-sep" aria-hidden="true"> · </span>')
    : `<span class="d confirm">[Confirm: scent family]</span>`;
  $('.buy h1')!.textContent = it.scent;
  const metaRow = $('.buy h1')!.nextElementSibling as HTMLElement;
  const metaSpan = metaRow.querySelector('span')!;
  const priceEl = metaRow.querySelector<HTMLElement>('.price')!;

  // description + notes
  const descP = $('.buy > p')!;
  const scentCopy = CANVAS_SCENT[it.scent.toLowerCase()];
  let liveDesc = htmlToParas(p?.plainDescription).join(' ');
  // Claire's descriptions often end with "Top notes: … · Base: …"; show those as the notes block.
  const liveNotes: [string, string][] = [];
  const noteRe = /\b(Top|Heart|Middle|Base)(?: notes?)?:\s*([^·|\n]+?)(?=\s*(?:·|\||$|\b(?:Top|Heart|Middle|Base)(?: notes?)?:))/gi;
  let nm: RegExpExecArray | null;
  while ((nm = noteRe.exec(liveDesc))) liveNotes.push([nm[1][0].toUpperCase() + nm[1].slice(1).toLowerCase(), nm[2].trim().replace(/[.,]$/, '')]);
  if (liveNotes.length) liveDesc = liveDesc.replace(/\s*\b(Top|Heart|Middle|Base)(?: notes?)?:.*$/i, '').trim();
  if (liveDesc) descP.textContent = liveDesc;
  else if (scentCopy) descP.innerHTML = `<span class="d">${esc(scentCopy.line)}</span>`;
  else descP.remove();
  const notes = $('.notes')!;
  notes.classList.remove('d');
  if (liveNotes.length) notes.innerHTML = liveNotes.map(([k, v]) => `<div><span class="eyebrow">${k}</span><span>${esc(v)}</span></div>`).join('');
  else if (scentCopy) { notes.classList.add('d'); notes.innerHTML = ['Top', 'Heart', 'Base'].map((k, n) => `<div><span class="eyebrow">${k}</span><span>${esc(scentCopy.notes[n])}</span></div>`).join(''); }
  else notes.innerHTML = `<div class="d confirm"><span class="eyebrow">Notes</span><span>[Confirm: top, heart and base notes]</span></div>`;

  // "Also in" chips across formats
  const siblings = items.filter(i => i.scent.toLowerCase() === it.scent.toLowerCase());
  const opts = $('.opts')!;
  if (siblings.length > 1) {
    opts.innerHTML = `<span class="eyebrow">Format</span><div class="chips">${siblings.map(s =>
      `<a class="chip" href="#/product/${s.slug}" aria-pressed="${s.id === it.id}">${s.formatLabel} · ${money(s.priceMin)}</a>`).join('')}</div>`;
  } else opts.remove();
  // the same-scent cross-sell: the scent's other formats as cards, right under the buy column
  const others = siblings.filter(x => x.id !== it.id);
  if (others.length) {
    const ORDER: Format[] = ['candle', 'roller', 'diffuser', 'deodorant'];
    others.sort((a, b) => ORDER.indexOf(a.format) - ORDER.indexOf(b.format));
    $('.pdp')!.insertAdjacentHTML('afterend', `<section class="also" id="p-also" aria-labelledby="alsoH"><div class="head"><div class="col"><span class="eyebrow">Same scent, another way</span><h2 id="alsoH">Also in <span class="it">${esc(it.scent)}</span></h2></div>
      <p class="muted"><span class="d">Wear it, diffuse it and light it: one scent through the whole day.</span></p></div>
      <div class="grid also-grid">${others.map(x => cardHTML(x, x.inStock ? undefined : 'Sold out')).join('')}</div></section>`);
    wireQuickAdd($('.also-grid')!, items);
  }

  // variants (size / scent)
  const variants: any[] = p?.variantsInfo?.variants ?? [];
  const priceOf = (choice?: string) => {
    const v = variants.find(v => (v.choices ?? []).some((c: any) => c.optionChoiceNames?.choiceName === choice));
    return Number(v?.price?.actualPrice?.amount ?? it.priceMin);
  };
  const stockOf = (choice: string) => it.choices.find(c => c.name === choice)?.inStock !== false;
  let choice = it.choices.find(c => c.inStock)?.name ?? it.choices[0]?.name;
  let qty = 1;
  const po = $('.po')!;
  if (it.choices.length > 1) {
    // the size (or scent) choice comes first, right under the name and price (before the story); the scent's other formats follow
    $('.buy > div:first-child')!.insertAdjacentHTML('afterend', `<div class="opts" id="varOpts"><span class="eyebrow">${esc(it.format === 'deodorant' ? 'Scent' : it.optionName ?? 'Option')}</span><div class="chips">${it.choices.map(c =>
      `<button class="chip" data-choice="${esc(c.name)}" aria-pressed="${c.name === choice}" ${c.inStock ? '' : 'disabled'}>${esc(c.name)}${c.inStock ? '' : ' · sold out'}</button>`).join('')}</div></div>`);
    app.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(b => b.addEventListener('click', () => {
      choice = b.dataset.choice!; app.querySelectorAll('[data-choice]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); refresh();
    }));
    // a sold-out size says so plainly and offers the nearest size that is in stock (or the scent's other formats)
    const out = it.choices.filter(c => !c.inStock);
    if (out.length) {
      const open = it.choices.filter(c => c.inStock);
      const near = (name: string) => { const k = it.choices.findIndex(c => c.name === name); return [...open].sort((a, b) => Math.abs(it.choices.indexOf(a) - k) - Math.abs(it.choices.indexOf(b) - k))[0]; };
      const n = near(out[0].name);
      $('#varOpts')!.insertAdjacentHTML('beforeend', `<p class="var-note small">${esc(out.map(c => c.name).join(', '))} ${out.length === 1 ? 'is' : 'are'} sold out right now.
        ${n ? `<button type="button" class="tlink" data-near="${esc(n.name)}">Choose ${esc(n.name)} instead</button>` : siblings.length > 1 ? `<a class="tlink" href="#p-also" data-scrollto="p-also">See ${esc(it.scent)} in another format</a>` : '<a class="tlink" href="#/shop">Browse the shop</a>'}</p>`);
      $('[data-near]')?.addEventListener('click', () => app.querySelector<HTMLButtonElement>(`[data-choice="${CSS.escape(n!.name)}"]`)?.click());
    }
  }
  const addBtn = $<HTMLButtonElement>('#addBtn')!;
  const refresh = () => {
    const price = priceOf(choice);
    priceEl.textContent = money(price);
    const size = choice ?? it.sizeLabel;
    metaSpan.textContent = it.format === 'deodorant' ? (size ? `Scent · ${size}` : '') : size ? `${it.formatLabel} · ${size}` : it.formatLabel;
    const [once, sub] = po.querySelectorAll('label');
    once.lastElementChild!.textContent = money(price);
    // Ritual on Repeat is not open yet: the refill choice is shown as coming soon and cannot be picked (no price promised)
    // (one plain line, visually secondary, so it can never read as the product itself being "coming soon")
    if (!sub.dataset.soon) {
      sub.dataset.soon = '1';
      sub.querySelector(':scope > span:nth-child(2)')!.innerHTML = '<span class="po-soon-t">Refill subscription · coming soon</span>';
      sub.querySelector(':scope > span:last-child')!.innerHTML = '<a class="tlink small" href="#/subscribe">How it will work</a>';
    }
    const subIn = sub.querySelector<HTMLInputElement>('input'); if (subIn) { subIn.disabled = true; subIn.checked = false; }
    sub.classList.add('po-soon'); sub.querySelector('select')?.setAttribute('disabled', '');
    const inStock = choice ? stockOf(choice) : it.inStock;
    addBtn.disabled = !inStock;
    addBtn.textContent = inStock ? `Add to cart · ${money(price * qty)}` : 'Sold out';
    const pts = $('.buy .points b'); if (pts) { pts.textContent = `${Math.floor(price * qty)} Ritual Points`; pts.classList.add('d'); }
    // no Loyalty app yet: never promise points to customers
    if (!LOYALTY_ENABLED) { const row = $('.buy .points span'); if (row && !row.dataset.fixed) { row.dataset.fixed = '1'; row.innerHTML = 'Made in small batches in British Columbia · Gift wrap available'; } }
  };
  // giving back: one quiet line under Add to cart (src/pages/giving.ts)
  $('.buy .points')?.insertAdjacentHTML('afterend', givingNote('product'));
  $('#qd')!.addEventListener('click', () => { qty = Math.max(1, qty - 1); $('#qv')!.textContent = String(qty); refresh(); });
  $('#qi')!.addEventListener('click', () => { qty = Math.min(20, qty + 1); $('#qv')!.textContent = String(qty); refresh(); });
  addBtn.addEventListener('click', async () => {
    const sub = po.querySelector<HTMLInputElement>('input[value="sub"]')?.checked;
    if (sub) { previewOff('Refill subscriptions (not set up in the store yet)')(); return; }
    await add({ productId: it.id, slug: it.slug, name: it.name, price: priceOf(choice), image: it.thumb, choice, optionName: it.optionName }, qty);
    toastAdded(`${it.name}${choice && it.choices.length > 1 ? ` (${choice})` : ''}`);
  });
  refresh();
  // when nothing can be bought, the next step is the same scent in another format
  if (!it.inStock && !it.choices.some(c => c.inStock) && siblings.some(x => x.id !== it.id && x.inStock))
    addBtn.parentElement!.insertAdjacentHTML('afterend', `<p class="var-note small">${esc(it.name)} is sold out right now. <a class="tlink" href="#p-also" data-scrollto="p-also">See ${esc(it.scent)} in another format</a></p>`);

  // Send as a gift: product pages have no recipient or note fields, so the toggle explains gift wrap and leads to Send a Sky
  addBtn.parentElement!.insertAdjacentHTML('afterend', `<div class="gift-tog">
    <button type="button" class="gt-btn" aria-expanded="false" aria-controls="giftPanel"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="9" width="16" height="4" rx="1"/><path d="M5.5 13v6.5A1.5 1.5 0 007 21h10a1.5 1.5 0 001.5-1.5V13M12 9v12"/><path d="M12 9c-1.5-3.5-5-4-5-1.8C7 9 12 9 12 9zM12 9c1.5-3.5 5-4 5-1.8C17 9 12 9 12 9z"/></svg><span>Send as a gift</span><span class="gt-sw" aria-hidden="true"></span></button>
    <div class="gt-panel" id="giftPanel" hidden><p><span class="d">Gift wrap is available on every order. To send it straight to someone with a note in Claire's card, use Send a Sky.</span></p><a class="btn line" href="#/gift">Send a Sky</a></div></div>`);
  const gt = $<HTMLButtonElement>('.gt-btn')!;
  gt.addEventListener('click', () => { const on = gt.getAttribute('aria-expanded') !== 'true'; gt.setAttribute('aria-expanded', String(on)); $('#giftPanel')!.hidden = !on; });
  // sticky local nav under the header: name + the leading family's mark, the page's sections, and an add pill that drives #addBtn.
  // Section labels are nav words, not product copy: draft for Claire.
  const sectionOf = (el: Element | null | undefined, id: string, label: string) => { if (!el) return null; el.id = id; return { id, label }; };
  const pageSections = app.querySelectorAll<HTMLElement>(':scope > .wrap > section');
  mountLocalNav(app, {
    name: it.scent, sub: it.formatLabel, family: it.families[0],
    sections: [
      sectionOf($('.pdp'), 'p-scent', 'Scent'),
      sectionOf($('.tabsbar')?.parentElement, 'p-details', 'Details'),
      sectionOf($('#p-also'), 'p-also', 'Also in'),
      sectionOf([...pageSections].find(s => s.querySelector('a[href$="/book"]')), 'p-practice', 'Practice'),
      sectionOf([...pageSections].find(s => s.querySelector('.grid') && !s.classList.contains('also')), 'p-more', 'More like this'),
    ].filter((s): s is { id: string; label: string } => !!s),
    addBtn,
  });

  // tabs
  const sections: any[] = p?.infoSections ?? [];
  const seen = new Set<string>();
  const sectionParas = sections.flatMap(sec => htmlToParas(sec.plainDescription))
    .filter(t => !/^~.*~$/.test(t) && !seen.has(t) && (seen.add(t), true));
  const isShip = (t: string) => /ship|return|replace|refund|pick ?up|deliver|happiness|business days|contact me/i.test(t);
  const isUse = (t: string) => /candle care|burn|trim your wick|melt pool|to use|apply|pulse point|unattended|tips and tricks|approximately \d+/i.test(t);
  const shipParas = sectionParas.filter(isShip);
  const useParas = sectionParas.filter(t => !isShip(t) && isUse(t));
  const aboutParas = sectionParas.filter(t => !isShip(t) && !isUse(t));
  const copy = CANVAS_COPY[it.format];
  const panel = (n: number) => app.querySelector<HTMLElement>(`[data-panel="${n}"]`)!;
  const paras = (arr: string[]) => arr.map(t => `<p>${esc(t)}</p>`).join('');
  const dw = (t: string) => copy?.draft ? `<span class="d">${esc(t)}</span>` : esc(t);
  panel(0).innerHTML = copy
    ? `<p>${dw(copy.about)}</p><p><b style="color:var(--ink)">Best for:</b> <span class="d">${esc(copy.best)}</span></p>`
    : paras(aboutParas.slice(0, 1)) || '<p><span class="d confirm">[Confirm: product description]</span></p>';
  panel(1).innerHTML = (copy
    ? `<ul style="padding-left:18px;display:flex;flex-direction:column;gap:6px">${copy.use.map(u => `<li>${dw(u)}</li>`).join('')}</ul>`
    : '') + paras(useParas) + (copy?.links ? `<div class="tab-links"><span class="eyebrow">From the Journal</span>${copy.links.map(([t, h]) => `<a href="${h}">${esc(t)}</a>`).join('')}</div>` : '') || '<p><span class="d confirm">[Confirm: how to use]</span></p>';
  panel(2).innerHTML = (aboutParas.length ? `${paras(aboutParas)}<p class="small muted">From the product information in the store.</p>` : '')
    + '<p><span class="d">Full ingredient list to be added by Claire.</span></p>';
  // the store's own policy text is the only shipping and returns information; the fallback only states the shipping threshold
  panel(3).innerHTML = shipParas.length
    ? `${paras(shipParas)}<p class="small muted">From the product information in the store.</p>`
    : `<p><span class="d">Ships in 2 to 3 business days. Free shipping on Canadian orders over ${money(FREE_SHIPPING_THRESHOLD).replace(/\.00$/, '')}.</span></p>`;

  // You may also like: the most families in common, then same format (the same scent's other formats have their own row above)
  const grid = app.querySelectorAll<HTMLElement>('section .grid');
  const g = grid[grid.length - 1];
  if (g) {
    const pool = items.filter(i => i.id !== it.id && i.inStock && i.scent.toLowerCase() !== it.scent.toLowerCase());
    const shared = (i: Item) => i.families.filter(f => it.families.includes(f)).length;
    const picks = [...pool.filter(i => shared(i) > 0).sort((a, b) => shared(b) - shared(a) || Number(b.format === it.format) - Number(a.format === it.format)), ...pool.filter(i => i.format === it.format)]
      .filter((x, n, a) => a.indexOf(x) === n).slice(0, 4);
    g.innerHTML = picks.map(i => cardHTML(i)).join('');
    wireQuickAdd(g, items);
  }
  document.title = `${it.name} · Daily Rituals Co.`;
}

/** A product that is switched off for now (the natural deodorant while SHOW_DEODORANT is false, or a Wix product that is not on
 *  the owner's list): a friendly page, not an error. */
function renderUnavailable(app: HTMLElement, deodorant = true) {
  document.title = 'Not available right now · Daily Rituals Co.';
  app.innerHTML = `<div class="wrap" style="padding-block:clamp(64px,8vw,112px);display:flex;flex-direction:column;gap:16px;max-width:640px">
    <span class="eyebrow">Not available right now</span><h1 style="font-size:clamp(36px,5vw,56px)"><span class="d">This one is <span class="it">resting for now</span></span></h1>
    <p class="muted"><span class="d">${deodorant ? 'The natural deodorant is' : 'This product is'} not available right now. Our candles, fragrance rollers and mini diffusers are all in the shop.</span></p>
    <a class="btn" href="#/shop" style="align-self:flex-start">Browse the shop</a></div>`;
}

function renderNotInStore(app: HTMLElement, slug: string) {
  const name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  app.innerHTML = `<div class="wrap" style="padding-block:clamp(64px,8vw,112px);display:flex;flex-direction:column;gap:16px;max-width:640px">
    <span class="eyebrow">Concept product</span><h1 style="font-size:clamp(36px,5vw,56px)">${esc(name)}</h1>
    <p class="muted">This product appears in the design canvas but is not in the live store yet. <span class="d confirm">[Confirm: add to the store or remove from the design]</span></p>
    <a class="btn" href="#/shop" style="align-self:flex-start">Browse the shop</a></div>`;
}
