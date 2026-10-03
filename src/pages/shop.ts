import Shop from '../canvas/pages/Shop.html?raw';
import { loadCatalogue, type Item } from '../wix';
import { cardHTML, fixImages, skeletonCards, errorBox, wireCommon } from '../ui';
import { wireQuickAdd } from './shared';
import { MOODS, type Mood, type Format } from '../config';

// The three concept cards from the canvas (not products in the live store yet).
function conceptCards(): string {
  const doc = new DOMParser().parseFromString(`<div>${fixImages(Shop)}</div>`, 'text/html');
  const out: string[] = [];
  doc.querySelectorAll('.grid > .card').forEach(card => {
    const href = card.querySelector('a')?.getAttribute('href') ?? '';
    if (['#/discovery', '#/drops', '#/subscribe'].includes(href)) {
      card.querySelector('.qa')?.remove();
      card.setAttribute('data-concept', '1');
      card.querySelector('.ph')?.insertAdjacentHTML('beforeend', '<span class="concept-tag">Concept · not in store yet</span>');
      out.push(card.outerHTML);
    }
  });
  return out.join('');
}

export async function renderShop(app: HTMLElement, params: URLSearchParams) {
  app.innerHTML = fixImages(Shop);
  wireCommon(app);
  const f = (params.get('f') ?? 'all') as Format | 'all';
  const m = (params.get('m') ?? 'all') as Mood | 'all';
  const s = params.get('s') ?? 'featured';

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
    sort.addEventListener('change', () => { location.hash = `#/shop?${new URLSearchParams({ f, m, s: sort.value })}`; });
  }

  const grid = app.querySelector<HTMLElement>('.grid')!;
  const countEl = [...app.querySelectorAll('span.small.muted')].find(el => /products/.test(el.textContent ?? ''));
  const concepts = conceptCards();
  grid.innerHTML = skeletonCards(8);

  let items: Item[];
  try { items = await loadCatalogue(); } catch (e) { grid.innerHTML = errorBox(String((e as Error).message ?? e)); return; }

  const order: Format[] = ['roller', 'diffuser', 'candle', 'deodorant'];
  let list = items.filter(i => (f === 'all' || i.format === f) && (m === 'all' || i.mood === m));
  if (s === 'low') list.sort((a, b) => a.priceMin - b.priceMin);
  else if (s === 'high') list.sort((a, b) => b.priceMin - a.priceMin);
  else list.sort((a, b) => order.indexOf(a.format) - order.indexOf(b.format) || a.scent.localeCompare(b.scent));

  const showConcepts = f === 'all' && m === 'all';
  grid.innerHTML = list.map(i => cardHTML(i, i.inStock ? undefined : 'Sold out')).join('') + (showConcepts ? concepts : '');
  if (!list.length) grid.insertAdjacentHTML('afterbegin', `<p class="muted" style="grid-column:1/-1">Nothing matches ${m !== 'all' ? MOODS[m].label.toLowerCase() : 'that filter'} right now.</p>`);
  if (countEl) countEl.textContent = `${list.length} product${list.length === 1 ? '' : 's'} · Hover a product to see its scent family`;
  wireQuickAdd(grid, items);
}
