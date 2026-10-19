import Shop from '../canvas/pages/Shop.html?raw';
import { loadCatalogue, loadProduct, money, type Item } from '../wix';
import { esc, fixImages, cardImg, skeletonCards, errorBox, wireCommon, priceText, productHref, toastAdded } from '../ui';
import { wireNotify } from './shared';
import { add } from '../cart';
import { cardOrbit } from '../celestial';
import { navigate } from '../router';
import { MOODS, FORMAT_LABEL, type Mood, type Format } from '../config';
import { mountOffers } from './offers';
import '../shop.css';

// Their pictures sit at the end of the page and show at about 170 to 300 px: lazy, sized, and offered in small widths.
const CONCEPT_PIC: Record<string, { srcset?: string; w: number; h: number }> = {
  '#/discovery': { srcset: '/img/discovery-320.webp 320w, /img/discovery-640.webp 640w, /img/discovery.webp 1100w', w: 1100, h: 917 },
  '#/drops': { srcset: '/img/moondrop-320.webp 320w, /img/moondrop-640.webp 640w, /img/moondrop.webp 800w', w: 800, h: 1000 },
  '#/subscribe': { w: 560, h: 298 },
};

// The three concept cards from the canvas (not products in the live store yet).
function conceptCards(): string {
  const doc = new DOMParser().parseFromString(`<div>${fixImages(Shop)}</div>`, 'text/html');
  const out: string[] = [];
  doc.querySelectorAll('.grid > .card').forEach(card => {
    const href = card.querySelector('a')?.getAttribute('href') ?? '';
    if (['#/discovery', '#/drops', '#/subscribe'].includes(href)) {
      // not in the store: no price and no add button, only "get notified"; no stand-in render on hover either
      card.querySelector('.qa')?.replaceWith(Object.assign(doc.createElement('button'), { className: 'qa soon', textContent: 'Coming soon · get notified' }));
      card.querySelector('.qa')?.setAttribute('data-notify', 'concept');
      card.querySelector('img.alt')?.remove();
      card.setAttribute('data-concept', '1');
      const pic = card.querySelector('img.main'), cp = CONCEPT_PIC[href];
      if (pic && cp) {
        if (cp.srcset) { pic.setAttribute('srcset', cp.srcset); pic.setAttribute('sizes', '(max-width: 820px) 46vw, 300px'); }
        pic.setAttribute('width', String(cp.w)); pic.setAttribute('height', String(cp.h)); pic.setAttribute('loading', 'lazy'); pic.setAttribute('decoding', 'async');
      }
      // there is no Discovery Kit page yet: its picture and name lead to the scent atlas, the closest real thing
      if (href === '#/discovery') card.querySelectorAll('a[href="#/discovery"]').forEach(a => a.setAttribute('href', '#/explore'));
      card.querySelector('.ph')?.insertAdjacentHTML('beforeend', '<span class="concept-tag">Concept · not in store yet</span>');
      out.push(card.outerHTML);
    }
  });
  return out.join('');
}

// Line glyphs for the phone shortcut row (no real photographs of rollers or diffusers exist yet, so none of the four uses one).
const GLYPH: Record<string, string> = {
  candle: '<path d="M6 11h12v8.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 016 19.5z"/><path d="M6 13.5h12"/><path d="M12 11V8.5"/><path d="M12 3.5c1.3 1.5 1.6 2.6.8 3.6-.5.6-1.3.6-1.7 0-.6-.9-.2-2 .9-3.6z" fill="currentColor" stroke="none"/>',
  roller: '<rect x="9" y="3" width="6" height="5" rx="1"/><path d="M8.5 8h7v11.5a1.5 1.5 0 01-1.5 1.5h-4a1.5 1.5 0 01-1.5-1.5z"/><path d="M8.5 12.5h7"/>',
  diffuser: '<path d="M8 13h8l-.6 6.7a1.5 1.5 0 01-1.5 1.3h-3.8a1.5 1.5 0 01-1.5-1.3z"/><path d="M10.5 13v-2h3v2"/><path d="M11.4 11L8 3M12 11V2.5M12.6 11L16 3.5"/>',
  gift: '<rect x="4" y="9" width="16" height="4" rx="1"/><path d="M5.5 13v6.5A1.5 1.5 0 007 21h10a1.5 1.5 0 001.5-1.5V13M12 9v12"/><path d="M12 9c-1.5-3.5-5-4-5-1.8C7 9 12 9 12 9zM12 9c1.5-3.5 5-4 5-1.8C17 9 12 9 12 9z"/>',
};
const glyph = (k: string, s = 26) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPH[k]}</svg>`;

/** The canvas page without its sample grid (the grid is filled from the live catalogue, so the sample pictures are never fetched). */
function shopShell(): string {
  const doc = new DOMParser().parseFromString(`<div>${Shop}</div>`, 'text/html');
  doc.querySelector('.grid')?.replaceChildren();
  return fixImages(doc.body.firstElementChild!.innerHTML);
}

export async function renderShop(app: HTMLElement, params: URLSearchParams) {
  app.innerHTML = shopShell();
  wireCommon(app);
  mountOffers(app);
  const f = (params.get('f') ?? 'all') as Format | 'all';
  const m = (params.get('m') ?? 'all') as Mood | 'all';
  const s = params.get('s') ?? 'featured';

  // breadcrumbs name the filter you are in; the phone shortcut row (Candles · Rollers · Diffusers · Gifts) sits under the title
  const FMT_NAME: Record<Format, string> = { candle: 'Candles', roller: 'Fragrance rollers', diffuser: 'Mini diffusers', deodorant: 'Natural deodorant' };
  if (f !== 'all') app.querySelector('.phead .crumbs')!.innerHTML = `<a href="#/">Home</a> / <a href="#/shop">Shop</a> / ${FMT_NAME[f]}`;
  const jump: [string, string, string][] = [['candle', 'Candles', '#/shop?f=candle&m=all&s=featured'], ['roller', 'Rollers', '#/shop?f=roller&m=all&s=featured'], ['diffuser', 'Diffusers', '#/shop?f=diffuser&m=all&s=featured'], ['gift', 'Gifts', '#/gift']];
  app.querySelector('.ways.two')?.insertAdjacentHTML('beforebegin', `<nav class="shop-jump" aria-label="Shop by type">${jump.map(([k, label, href]) =>
    `<a href="${href}"${k === f ? ' aria-current="page"' : ''}><span class="sj-ic">${glyph(k)}</span><span>${label}</span></a>`).join('')}</nav>`);

  app.querySelectorAll<HTMLAnchorElement>('.toolbar a.chip').forEach(a => {
    const p = new URLSearchParams(a.getAttribute('href')!.split('?')[1]);
    const af = p.get('f') ?? 'all', am = p.get('m') ?? 'all';
    const isFormat = am === 'all' && a.closest('.chips') === app.querySelector('.toolbar .chips');
    const pressed = isFormat ? af === f && (f !== 'all' || m === 'all') : am === m;
    a.setAttribute('aria-pressed', String(pressed));
    // keep the other filter when switching one
    const np = new URLSearchParams({ f: isFormat ? af : f, m: isFormat ? m : am, s });
    a.setAttribute('href', `#/shop?${np}`);
  });
  const sort = app.querySelector<HTMLSelectElement>('#sort');
  if (sort) {
    sort.value = s;
    sort.addEventListener('change', () => { navigate(`/shop?${new URLSearchParams({ f, m, s: sort.value })}`); });
  }

  const grid = app.querySelector<HTMLElement>('.grid')!;
  const countEl = [...app.querySelectorAll('span.small.muted')].find(el => /products/.test(el.textContent ?? ''));
  const concepts = conceptCards();
  grid.innerHTML = skeletonCards(8);

  let items: Item[];
  try { items = await loadCatalogue(); } catch (e) { grid.innerHTML = errorBox(String((e as Error).message ?? e)); return; }

  // the products that match the filters (the count names these), then one card per scent for them
  const list = items.filter(i => (f === 'all' || i.format === f) && (m === 'all' || i.mood === m));
  const scents = scentGroups(items)
    .filter(g => (f === 'all' || g.items.some(i => i.format === f)) && (m === 'all' || g.mood === m))
    // a format filter opens each card on that format; otherwise on its first format (candle, roller, diffuser) in stock
    .map(g => ({ ...g, sel: (f !== 'all' && g.items.find(i => i.format === f)) || g.items.find(i => i.inStock) || g.items[0] }));
  if (s === 'low') scents.sort((a, b) => a.sel.priceMin - b.sel.priceMin || a.scent.localeCompare(b.scent));
  else if (s === 'high') scents.sort((a, b) => b.sel.priceMin - a.sel.priceMin || a.scent.localeCompare(b.scent));
  else scents.sort((a, b) => a.scent.localeCompare(b.scent));

  const showConcepts = f === 'all' && m === 'all';
  const GROUP: Record<Format, [string, string]> = {
    roller: ['Wear it', 'Fragrance rollers. Roll onto your wrists and carry the scent all day.'],
    diffuser: ['Diffuse it', 'Mini diffusers. A quiet, steady scent for a desk, bedside or small room.'],
    candle: ['Light it', 'Candles. For the moments you want to mark: home, evening, slowing down.'],
    deodorant: ['Wear it daily', 'Natural deodorant in our signature scents.'],
  };
  // Format imagery: the candle and deodorant group heads carry a real cut-out from Claire's photographs (Verdant, a candle
  // in the catalogue; Westcoast natural deodorant). No real photos of rollers or diffusers exist yet.
  const FORMAT_PHOTO: Partial<Record<Format, string>> = {
    candle: '<img class="ghead-ph cut" src="/img/studio/cut/verdant-480.webp" alt="Verdant: a lit candle in a white glass tumbler, a small lit black tin in front" width="480" height="449" loading="lazy" decoding="async">',
    deodorant: '<img class="ghead-ph cut tall" src="/img/studio/cut/westcoast.webp" alt="Westcoast natural deodorant: an open jar on its black-labelled tin" width="242" height="462" loading="lazy" decoding="async">',
  };
  const n = (k: number) => `${k} scent${k === 1 ? '' : 's'}`;
  const formatHead = (fm: Format, k: number, cards: number, more: boolean) => `<header class="ghead g${k % 4}">${FORMAT_PHOTO[fm] ?? ''}<span class="eyebrow">${GROUP[fm][0]}</span><h2>${more ? `<span class="d">More ${FORMAT_LABEL[fm].toLowerCase()}s</span>` : `${FORMAT_LABEL[fm]}s`}</h2><span class="gc">${cards === 1 ? 'Choose your scent' : n(cards)}</span><p class="muted">${GROUP[fm][1]}</p></header>`;
  const moodHead = (md: Mood, cards: number) => `<header class="ghead gmood" style="--mw:${MOODS[md].swatch}"><span class="eyebrow"><span class="swatch" style="background:${MOODS[md].swatch}"></span><span class="d">Scent family</span></span><h2>${MOODS[md].label}</h2><span class="gc">${n(cards)}</span></header>`;
  grid.classList.toggle('grouped', s === 'featured');
  let html = '';
  if (s === 'featured' && f === 'all') {
    // every scent once, under its scent family; scents with no family yet (and the deodorant) follow under their format
    (Object.keys(MOODS) as Mood[]).forEach(md => { const g = scents.filter(x => x.mood === md); if (g.length) html += moodHead(md, g.length) + g.map(scentCard).join(''); });
    const rest = scents.filter(x => !x.mood), shown = new Set(scents.filter(x => x.mood).map(x => x.sel.format));
    FORMAT_ORDER.filter(fm => rest.some(x => x.sel.format === fm)).forEach((fm, k) => { const g = rest.filter(x => x.sel.format === fm); html += formatHead(fm, k, g.length, shown.has(fm)) + g.map(scentCard).join(''); });
    if (showConcepts) html += `<header class="ghead soon"><span class="eyebrow">Coming soon</span><h2>Kits and boxes</h2><p class="muted">Ideas we are getting ready. Not in the store yet.</p></header>${concepts}`;
  } else if (s === 'featured') {
    if (scents.length) html = formatHead(f as Format, FORMAT_ORDER.indexOf(f as Format), scents.length, false) + scents.map(scentCard).join('');
  } else html = scents.map(scentCard).join('') + (showConcepts ? concepts : '');
  grid.innerHTML = html;
  if (!scents.length) grid.insertAdjacentHTML('afterbegin', `<div class="shop-none"><p class="muted">Nothing matches ${m !== 'all' ? MOODS[m].label.toLowerCase() : 'that filter'} right now.</p><div class="cta"><a class="btn line" href="#/shop">See everything</a><a class="btn line" href="#/explore?tab=quiz">Take the scent quiz</a></div></div>`);
  if (countEl) {
    countEl.textContent = `${list.length} product${list.length === 1 ? '' : 's'} · ${matchMedia('(hover: hover) and (pointer: fine)').matches && innerWidth > 820 ? 'Hover over a product to see its scent family' : 'Tap a product for its scent and sizes'}`;
    // the sort sits with the count, where it is easy to find on a phone (not at the end of a sideways row of chips)
    const row = countEl.parentElement!; row.classList.add('shop-count');
    if (sort) row.append(...[app.querySelector('label[for="sort"]'), sort].filter((x): x is HTMLElement => !!x));
  }
  wireScentCards(grid, items);
  wireNotify(grid);
}

// ---------- one card per scent ----------
const FORMAT_ORDER: Format[] = ['candle', 'roller', 'diffuser', 'deodorant'];
/** The mood colours lifted for the star at the top of the card's orbit ring (as in ui.ts cardHTML). */
const STAR: Record<Mood, string> = { fresh: '#A3C8C0', sunny: '#ECB76A', floral: '#CF8A7D', woody: '#C09571', grounding: '#8EAA86' };
interface ScentGroup { key: string; scent: string; mood?: Mood; items: Item[] }

/**
 * The catalogue as scents: a scent's candle, roller and diffuser share one card (grouped by scent name, as the product
 * page's "Also in" row and the scent atlas do). Products that are not a scent in several formats (the natural deodorant,
 * whose choice is its scent) keep a card of their own.
 */
function scentGroups(items: Item[]): ScentGroup[] {
  const by = new Map<string, ScentGroup>();
  items.forEach(i => {
    const key = i.format === 'deodorant' ? `id:${i.id}` : i.scent.toLowerCase();
    const g = by.get(key) ?? { key, scent: i.scent, mood: i.mood, items: [] };
    g.items.push(i); g.mood ??= i.mood; by.set(key, g);
  });
  by.forEach(g => g.items.sort((a, b) => FORMAT_ORDER.indexOf(a.format) - FORMAT_ORDER.indexOf(b.format)));
  return [...by.values()];
}

/** A size as the product's own choice names it, spaced the same way everywhere ("10ml" reads "10 ml", "2 oz" stays). */
const sizeText = (name: string) => name.replace(/^(\d+(?:\.\d+)?)\s*(ml|oz|g)$/i, (_, v: string, u: string) => `${v} ${u.toLowerCase()}`);
/** The option is a size (rather than, say, the deodorant's scent): only then may quick add pick the first one for you. */
const isSize = (i: Item) => /size/i.test(i.optionName ?? '') || i.choices.every(c => /^\d+(?:\.\d+)?\s*(ml|oz|g)$/i.test(c.name));
/** The choice quick add puts in the cart: the only one, or the first size in stock. */
const quickChoice = (i: Item) => (i.choices.length <= 1 ? i.choices[0] : i.choices.find(c => c.inStock));
const fmtWord = (fm: Format) => FORMAT_LABEL[fm].replace(/^(Mini|Fragrance|Natural) /, '');

function subText(i: Item): string {
  if (!i.choices.length) return esc(i.formatLabel);
  const sizes = isSize(i) ? i.choices.map(c => sizeText(c.name)).join(' · ') : i.sizeLabel;
  return `${esc(i.formatLabel)}${sizes ? ` · <span class="nw">${esc(sizes)}</span>` : ''}`;
}

/** Known variant prices (from the product's own record), by slug. The catalogue query only gives a range. */
const variantPrices = new Map<string, Promise<Map<string, number>>>();
function pricesOf(i: Item): Promise<Map<string, number>> {
  let pr = variantPrices.get(i.slug);
  if (!pr) {
    pr = loadProduct(i.slug).then(p => {
      const out = new Map<string, number>();
      (p?.variantsInfo?.variants ?? []).forEach((v: any) => {
        const amt = Number(v?.price?.actualPrice?.amount);
        (v.choices ?? []).forEach((c: any) => { const nm = c.optionChoiceNames?.choiceName; if (nm && amt > 0) out.set(nm, amt); });
      });
      return out;
    }).catch(() => { variantPrices.delete(i.slug); return new Map<string, number>(); });
    variantPrices.set(i.slug, pr);
  }
  return pr;
}
/** The price of the choice quick add would use, when it is certain: one price for the product, or the variant's own. */
function knownPrice(i: Item, prices?: Map<string, number>): number | undefined {
  if (i.priceMin === i.priceMax) return i.priceMin;
  const c = quickChoice(i);
  return c ? prices?.get(c.name) : undefined;
}

function addHTML(i: Item, price?: number): string {
  const c = quickChoice(i);
  if (!i.inStock || (i.choices.length && !c)) return `<a class="sc-add soft" href="${productHref(i)}">Sold out</a>`;
  if (i.choices.length > 1 && !isSize(i)) return `<a class="sc-add soft" href="${productHref(i)}">Choose an option</a>`;
  const size = c && isSize(i) ? sizeText(c.name) : '';
  const b = [size, price !== undefined ? money(price) : ''].filter(Boolean).join(' · ');
  return `<button type="button" class="sc-add" data-qa="${i.id}"${c ? ` data-choice="${esc(c.name)}"` : ''}><span class="sa-a">Quick add</span>${b ? `<span class="sa-dot" aria-hidden="true"> · </span><span class="sa-b">${esc(b)}</span>` : ''}</button>`;
}

function scentCard(g: ScentGroup & { sel: Item }): string {
  const i = g.sel, mood = g.mood ? MOODS[g.mood] : undefined;
  const tone = mood ? ` style="--mood-c:${mood.swatch};--mood-s:${STAR[g.mood!]}"` : '';
  const chips = g.items.length > 1
    ? `<div class="sc-fmts" role="group" aria-label="${esc(g.scent)} formats">${g.items.map(x =>
      `<button type="button" class="sc-fmt" data-pick="${x.id}" aria-pressed="${x.id === i.id}" aria-label="${esc(fmtWord(x.format))}">${GLYPH[x.format] ? glyph(x.format, 20) : ''}<span class="sc-fl">${esc(fmtWord(x.format))}</span></button>`).join('')}</div>`
    : '';
  return `<div class="card scard" data-scent="${esc(g.key)}" data-sel="${i.id}" data-format="${i.format}" data-formats="${g.items.map(x => x.format).join(' ')}" data-mood="${g.mood ?? ''}"${tone}>
    <div class="ph">${i.inStock ? '' : '<span class="badge">Sold out</span>'}
      <a class="sc-ph" href="${productHref(i)}" aria-label="${esc(i.name)}">${i.image ? cardImg(i) : ''}</a>
      ${cardOrbit()}
    </div>
    <a class="sc-link" href="${productHref(i)}">
      <div class="meta"><h3>${esc(g.scent)}</h3><span class="sc-price">${priceText(i)}</span></div>
      <div class="sub">${mood ? `<span class="swatch" style="background:${mood.swatch}"></span>` : ''}<span class="sc-sub">${subText(i)}</span></div>
    </a>
    <div class="sc-foot">${chips}${addHTML(i, knownPrice(i))}</div>
  </div>`;
}

/** Format chips switch the card (photo, price, sizes, links, quick add); quick add puts the chosen format in the cart. */
function wireScentCards(grid: HTMLElement, items: Item[]) {
  const byId = new Map(items.map(i => [i.id, i]));
  const selOf = (card: HTMLElement) => byId.get(card.dataset.sel ?? '');
  // a size's own price is shown once the product's record has it (only for cards near the screen)
  const fill = (card: HTMLElement) => {
    const i = selOf(card);
    if (!i || i.priceMin === i.priceMax || !card.querySelector('button[data-qa]')) return;
    pricesOf(i).then(pr => {
      if (selOf(card) !== i) return;
      const k = knownPrice(i, pr);
      // no certain price for that size: the product page shows the sizes and their prices instead of a guess
      card.querySelector('.sc-foot > .sc-add')!.outerHTML = k !== undefined ? addHTML(i, k) : `<a class="sc-add soft" href="${productHref(i)}">Choose an option</a>`;
    });
  };
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => {
    if (!grid.isConnected) { io!.disconnect(); return; }
    es.forEach(e => { if (e.isIntersecting) { io!.unobserve(e.target); fill(e.target as HTMLElement); } });
  }, { rootMargin: '300px 0px' }) : null;
  grid.querySelectorAll<HTMLElement>('.scard').forEach(c => (io ? io.observe(c) : fill(c)));

  grid.addEventListener('click', async e => {
    const t = e.target as HTMLElement;
    const pick = t.closest<HTMLButtonElement>('.sc-fmt');
    if (pick) {
      const card = pick.closest<HTMLElement>('.scard')!, i = byId.get(pick.dataset.pick!);
      if (!i) return;
      card.querySelectorAll('.sc-fmt').forEach(b => b.setAttribute('aria-pressed', String(b === pick)));
      card.dataset.format = i.format; card.dataset.sel = i.id;
      card.querySelectorAll<HTMLAnchorElement>('a.sc-ph, a.sc-link').forEach(a => a.setAttribute('href', productHref(i)));
      card.querySelector('a.sc-ph')!.setAttribute('aria-label', i.name);
      const ph = card.querySelector('a.sc-ph')!;
      // the format's own photograph; never another format's picture under its name
      ph.innerHTML = i.image ? cardImg(i) : '';
      const badge = card.querySelector('.ph .badge');
      if (!i.inStock && !badge) card.querySelector('.ph')!.insertAdjacentHTML('afterbegin', '<span class="badge">Sold out</span>');
      else if (i.inStock) badge?.remove();
      card.querySelector('.sc-price')!.textContent = priceText(i);
      card.querySelector('.sc-sub')!.innerHTML = subText(i);
      card.querySelector('.sc-foot > .sc-add')!.outerHTML = addHTML(i, knownPrice(i));
      fill(card);
      return;
    }
    const qa = t.closest<HTMLButtonElement>('button[data-qa]');
    if (!qa || qa.disabled) return;
    const i = byId.get(qa.dataset.qa!); if (!i) return;
    const c = quickChoice(i);
    let price = knownPrice(i);
    if (price === undefined) { qa.disabled = true; qa.setAttribute('aria-busy', 'true'); price = knownPrice(i, await pricesOf(i)); qa.disabled = false; qa.removeAttribute('aria-busy'); }
    // no certain price for that size: the product page shows the sizes and their prices instead of a guess
    if (price === undefined) { navigate(`/product/${i.slug}`); return; }
    await add({ productId: i.id, slug: i.slug, name: i.name, price, image: i.thumb, choice: c?.name, optionName: i.optionName });
    toastAdded(`${i.name}${c && i.choices.length > 1 ? ` (${sizeText(c.name)})` : ''}`);
  });
}
