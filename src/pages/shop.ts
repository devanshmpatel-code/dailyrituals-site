import Shop from '../canvas/pages/Shop.html?raw';
import { loadCatalogue, type Item } from '../wix';
import { cardHTML, fixImages, skeletonCards, errorBox, wireCommon } from '../ui';
import { wireQuickAdd, wireNotify } from './shared';
import { navigate } from '../router';
import { MOODS, type Mood, type Format } from '../config';

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
const glyph = (k: string) => `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPH[k]}</svg>`;

export async function renderShop(app: HTMLElement, params: URLSearchParams) {
  app.innerHTML = fixImages(Shop);
  wireCommon(app);
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

  const order: Format[] = ['candle', 'roller', 'diffuser', 'deodorant'];
  let list = items.filter(i => (f === 'all' || i.format === f) && (m === 'all' || i.mood === m));
  if (s === 'low') list.sort((a, b) => a.priceMin - b.priceMin);
  else if (s === 'high') list.sort((a, b) => b.priceMin - a.priceMin);
  else list.sort((a, b) => order.indexOf(a.format) - order.indexOf(b.format) || a.scent.localeCompare(b.scent));

  const showConcepts = f === 'all' && m === 'all';
  const GROUP: Record<Format, [string, string]> = {
    roller: ['Wear it', 'Fragrance rollers. Roll onto your wrists and carry the scent all day.'],
    diffuser: ['Diffuse it', 'Mini diffusers. A quiet, steady scent for a desk, bedside or small room.'],
    candle: ['Light it', 'Candles. For the moments you want to mark: home, evening, slowing down.'],
    deodorant: ['Wear it daily', 'Natural deodorant in our signature scents.'],
  };
  const card = (i: Item) => cardHTML(i, i.inStock ? undefined : 'Sold out');
  // Format imagery: the candle and deodorant group heads carry a real cut-out from Claire's photographs (Verdant, a candle
  // in the catalogue; Westcoast natural deodorant). No real photos of rollers or diffusers exist yet.
  const FORMAT_PHOTO: Partial<Record<Format, string>> = {
    candle: '<img class="ghead-ph cut" src="/img/studio/cut/verdant-480.webp" alt="Verdant: a lit candle in a white glass tumbler, a small lit black tin in front" width="480" height="449" loading="lazy" decoding="async">',
    deodorant: '<img class="ghead-ph cut tall" src="/img/studio/cut/westcoast.webp" alt="Westcoast natural deodorant: an open jar on its black-labelled tin" width="242" height="462" loading="lazy" decoding="async">',
  };
  grid.classList.toggle('grouped', s === 'featured');
  if (s === 'featured') {
    const fmts = order.filter(fm => list.some(i => i.format === fm));
    grid.innerHTML = fmts.map((fm, k) => { const g = list.filter(i => i.format === fm); return `<header class="ghead g${k % 4}">${FORMAT_PHOTO[fm] ?? ''}<span class="eyebrow">${GROUP[fm][0]}</span><h2>${g[0].formatLabel}s</h2><span class="gc">${g.length === 1 ? 'Choose your scent' : `${g.length} scents`}</span><p class="muted">${GROUP[fm][1]}</p></header>` + g.map(card).join(''); }).join('')
      + (showConcepts ? `<header class="ghead soon"><span class="eyebrow">Coming soon</span><h2>Kits and boxes</h2><p class="muted">Ideas we are getting ready. Not in the store yet.</p></header>${concepts}` : '');
  } else grid.innerHTML = list.map(card).join('') + (showConcepts ? concepts : '');
  if (!list.length) grid.insertAdjacentHTML('afterbegin', `<div class="shop-none"><p class="muted">Nothing matches ${m !== 'all' ? MOODS[m].label.toLowerCase() : 'that filter'} right now.</p><div class="cta"><a class="btn line" href="#/shop">See everything</a><a class="btn line" href="#/explore?tab=quiz">Take the scent quiz</a></div></div>`);
  if (countEl) {
    countEl.textContent = `${list.length} product${list.length === 1 ? '' : 's'} · ${matchMedia('(hover: hover) and (pointer: fine)').matches && innerWidth > 820 ? 'Hover over a product to see its scent family' : 'Tap a product for its scent and sizes'}`;
    // the sort sits with the count, where it is easy to find on a phone (not at the end of a sideways row of chips)
    const row = countEl.parentElement!; row.classList.add('shop-count');
    if (sort) row.append(...[app.querySelector('label[for="sort"]'), sort].filter((x): x is HTMLElement => !!x));
  }
  wireQuickAdd(grid, items);
  wireNotify(grid);
}
