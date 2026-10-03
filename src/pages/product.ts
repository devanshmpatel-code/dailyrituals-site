import Product from '../canvas/pages/Product.html?raw';
import { loadCatalogue, loadProduct, toItem, imgSrc, money, type Item } from '../wix';
import { cardHTML, fixImages, errorBox, wireCommon, toast, esc } from '../ui';
import { add } from '../cart';
import { canvasSlugToLive, wireQuickAdd, previewOff } from './shared';
import { MOODS, type Format } from '../config';

// Copy from the canvas product boards (roller = Product, diffuser = Cart drawer board).
const CANVAS_COPY: Partial<Record<Format, { about: string; use: string[]; best: string }>> = {
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
    if (live) { location.replace(`#/product/${live.slug}`); return; }
    return renderNotInStore(app, slug);
  }

  let p: any;
  try { p = await loadProduct(item.slug); } catch { p = null; }
  if (p) item = { ...toItem(p), mood: item.mood };
  const it = item!;

  app.innerHTML = fixImages(Product);
  wireCommon(app);
  const $ = <T extends Element = HTMLElement>(sel: string) => app.querySelector<T>(sel);

  // breadcrumbs
  $('.crumbs')!.innerHTML = `<a href="#/">Home</a> / <a href="#/shop?f=${it.format}">${PLURAL[it.format]}</a> / ${esc(it.name)}`;

  // gallery: Claire's photos first; canvas renders only fill empty slots
  const live = (p?.media?.itemsInfo?.items ?? []).map((m: any) => imgSrc(m, 1000, 1250)).filter(Boolean);
  const photos: { src: string; render: boolean }[] = live.length ? live.map((src: string) => ({ src, render: false })) : [{ src: it.image, render: false }];
  if (photos.length < 3 && it.mood) photos.push({ src: MOODS[it.mood].backdrop, render: true });
  const mainImg = $<HTMLImageElement>('#mainImg')!;
  mainImg.src = photos[0].src; mainImg.alt = it.name; mainImg.classList.toggle('dimg', photos[0].render);
  $('.thumbs')!.innerHTML = photos.map((ph, n) =>
    `<button data-g="${n}" aria-pressed="${n === 0}" aria-label="Image ${n + 1}"><img src="${ph.src}" alt=""${ph.render ? ' class="dimg"' : ''}></button>`).join('');
  app.querySelectorAll<HTMLButtonElement>('.thumbs button').forEach(b => b.addEventListener('click', () => {
    const ph = photos[Number(b.dataset.g)];
    mainImg.src = ph.src; mainImg.classList.toggle('dimg', ph.render);
    app.querySelectorAll('.thumbs button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));
  // hotspots describe the roller bottle only
  if (it.format !== 'roller') { $('#hsLayer')?.remove(); $('.hs-tip')?.remove(); $('#mainWrap + p, .gallery + p')?.remove(); }
  else {
    const tip = $('.hs-tip'); if (tip) tip.classList.add('d');
    app.querySelectorAll<HTMLButtonElement>('.hs').forEach(h => h.addEventListener('click', () => {
      app.querySelectorAll('.hs').forEach(x => x.setAttribute('aria-expanded', String(x === h)));
      const t = $('.hs-tip'); if (t) { t.style.top = `calc(${h.style.top} + 24px)`; t.style.left = `calc(${h.style.left} - 17px)`; t.querySelector('b')!.textContent = h.getAttribute('aria-label'); }
    }));
  }
  if (it.format !== 'roller') $('#vidBtn')?.remove();
  else $('#vidBtn')?.addEventListener('click', () => toast('The how-to video has not been added yet.'));

  // title block
  const mood = it.mood ? MOODS[it.mood] : undefined;
  const eyebrow = $('.buy .eyebrow')!;
  eyebrow.innerHTML = mood ? `<span class="swatch" style="background:${mood.swatch}"></span>${mood.label}` : `<span class="d confirm">[Confirm: scent family]</span>`;
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
    opts.innerHTML = `<span class="eyebrow">Also in ${esc(it.scent)}</span><div class="chips">${siblings.map(s =>
      `<a class="chip" href="#/product/${s.slug}" aria-pressed="${s.id === it.id}">${s.formatLabel} · ${money(s.priceMin)}</a>`).join('')}</div>`;
  } else opts.remove();

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
    po.insertAdjacentHTML('beforebegin', `<div class="opts" id="varOpts"><span class="eyebrow">${esc(it.format === 'deodorant' ? 'Scent' : it.optionName ?? 'Option')}</span><div class="chips">${it.choices.map(c =>
      `<button class="chip" data-choice="${esc(c.name)}" aria-pressed="${c.name === choice}" ${c.inStock ? '' : 'disabled'}>${esc(c.name)}${c.inStock ? '' : ' · sold out'}</button>`).join('')}</div></div>`);
    app.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach(b => b.addEventListener('click', () => {
      choice = b.dataset.choice!; app.querySelectorAll('[data-choice]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); refresh();
    }));
  }
  const addBtn = $<HTMLButtonElement>('#addBtn')!;
  const refresh = () => {
    const price = priceOf(choice);
    priceEl.textContent = money(price);
    const size = choice ?? it.sizeLabel;
    metaSpan.textContent = it.format === 'deodorant' ? (size ? `Scent · ${size}` : '') : size ? `${it.formatLabel} · ${size}` : it.formatLabel;
    const [once, sub] = po.querySelectorAll('label');
    once.lastElementChild!.textContent = money(price);
    sub.querySelector(':scope > span:last-child')!.innerHTML = `<span class="d">${money(Math.round(price * 90) / 100)}</span>`;
    const inStock = choice ? stockOf(choice) : it.inStock;
    addBtn.disabled = !inStock;
    addBtn.textContent = inStock ? `Add to cart · ${money(price * qty)}` : 'Sold out';
    const pts = $('.buy .points b'); if (pts) { pts.textContent = `${Math.floor(price * qty)} Ritual Points`; pts.classList.add('d'); }
  };
  $('#qd')!.addEventListener('click', () => { qty = Math.max(1, qty - 1); $('#qv')!.textContent = String(qty); refresh(); });
  $('#qi')!.addEventListener('click', () => { qty = Math.min(20, qty + 1); $('#qv')!.textContent = String(qty); refresh(); });
  addBtn.addEventListener('click', async () => {
    const sub = po.querySelector<HTMLInputElement>('input[value="sub"]')?.checked;
    if (sub) { previewOff('Refill subscriptions (not set up in the store yet)')(); return; }
    await add({ productId: it.id, slug: it.slug, name: it.name, price: priceOf(choice), image: it.thumb, choice, optionName: it.optionName }, qty);
    toast(`${it.name}${choice && it.choices.length > 1 ? ` (${choice})` : ''} added to your cart`);
  });
  refresh();

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
  panel(0).innerHTML = copy
    ? `<p>${esc(copy.about)}</p><p><b style="color:var(--ink)">Best for:</b> <span class="d">${esc(copy.best)}</span></p>`
    : paras(aboutParas.slice(0, 1)) || '<p><span class="d confirm">[Confirm: product description]</span></p>';
  panel(1).innerHTML = (copy
    ? `<ul style="padding-left:18px;display:flex;flex-direction:column;gap:6px">${copy.use.map(u => `<li>${esc(u)}</li>`).join('')}</ul>`
    : '') + paras(useParas) || '<p><span class="d confirm">[Confirm: how to use]</span></p>';
  panel(2).innerHTML = (aboutParas.length ? `${paras(aboutParas)}<p class="small muted">From the product information in the store.</p>` : '')
    + '<p><span class="d">Full ingredient list to be added by Claire.</span></p>';
  // Shipping: the store's own policy text, then the canvas lines. They disagree, so both stay visible for Claire.
  panel(3).innerHTML = shipParas.length
    ? `${paras(shipParas)}<p class="small muted">From the product information in the store.</p><p><span class="d confirm">[Confirm: the canvas says "Ships in 2 to 3 business days. Free over $75 in Canada" and "10 days to start a return"; the store text above says otherwise. Which is current?]</span></p>`
    : `<p><span class="d">Ships in 2 to 3 business days. Free over $75 in Canada.</span></p><p>If something isn't right, you have 10 days from the date your order arrives to reach out and start the return process.</p>`;

  // You may also like: same scent family, then same format
  const grid = app.querySelectorAll<HTMLElement>('section .grid');
  const g = grid[grid.length - 1];
  if (g) {
    const pool = items.filter(i => i.id !== it.id && i.inStock);
    const picks = [...pool.filter(i => it.mood && i.mood === it.mood), ...pool.filter(i => i.format === it.format)]
      .filter((x, n, a) => a.indexOf(x) === n).slice(0, 4);
    g.innerHTML = picks.map(i => cardHTML(i)).join('');
    wireQuickAdd(g, items);
  }
  document.title = `${it.name} · Daily Rituals Co.`;
}

function renderNotInStore(app: HTMLElement, slug: string) {
  const name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  app.innerHTML = `<div class="wrap" style="padding:clamp(64px,8vw,112px) 0;display:flex;flex-direction:column;gap:16px;max-width:640px">
    <span class="eyebrow">Concept product</span><h1 style="font-size:clamp(36px,5vw,56px)">${esc(name)}</h1>
    <p class="muted">This product appears in the design canvas but is not in the live store yet. <span class="d confirm">[Confirm: add to the store or remove from the design]</span></p>
    <a class="btn" href="#/shop" style="align-self:flex-start">Browse the shop</a></div>`;
}
