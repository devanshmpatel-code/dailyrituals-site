import Shop from '../canvas/pages/Shop.html?raw';
import { loadCatalogue, type Item } from '../wix';
import { cardHTML, fixImages, skeletonCards, errorBox, wireCommon } from '../ui';
import { wireQuickAdd } from './shared';
import { navigate } from '../router';
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
    sort.addEventListener('change', () => { navigate(`/shop?${new URLSearchParams({ f, m, s: sort.value })}`); });
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
  const GROUP: Record<Format, [string, string]> = {
    roller: ['Wear it', 'Fragrance rollers. Roll onto your wrists and carry the scent all day.'],
    diffuser: ['Diffuse it', 'Mini diffusers. A quiet, steady scent for a desk, bedside or small room.'],
    candle: ['Light it', 'Candles. For the moments you want to mark: home, evening, slowing down.'],
    deodorant: ['Wear it daily', 'Natural deodorant in our signature scents.'],
  };
  const card = (i: Item) => cardHTML(i, i.inStock ? undefined : 'Sold out');
  // Format imagery: the candle and deodorant group heads carry a real studio photograph (the candles are black tins, not the
  // amber-glass 3D render). The unnamed black-crescent moon stands for "a candle"; no real photos of rollers or diffusers exist yet.
  const FORMAT_PHOTO: Partial<Record<Format, string>> = {
    candle: '<img class="ghead-ph" src="/img/studio/moons/black-crescent.webp" alt="A candle from the studio seen from above: white wax in a black tin with a crescent of small black stones" width="520" height="520" loading="lazy" decoding="async">',
    deodorant: '<img class="ghead-ph" src="/img/studio/web/westcoast-round.webp" alt="Natural deodorant jars from the studio" width="480" height="480" loading="lazy" decoding="async">',
  };
  grid.classList.toggle('grouped', s === 'featured');
  if (s === 'featured') {
    const fmts = order.filter(fm => list.some(i => i.format === fm));
    grid.innerHTML = fmts.map((fm, k) => { const g = list.filter(i => i.format === fm); return `<header class="ghead g${k % 4}">${FORMAT_PHOTO[fm] ?? ''}<span class="eyebrow">${GROUP[fm][0]}</span><h2>${g[0].formatLabel}s</h2><span class="gc">${g.length === 1 ? 'Choose your scent' : `${g.length} scents`}</span><p class="muted">${GROUP[fm][1]}</p></header>` + g.map(card).join(''); }).join('')
      + (showConcepts ? `<header class="ghead soon"><span class="eyebrow">Coming soon</span><h2>Kits and boxes</h2><p class="muted">Ideas we are getting ready. Not in the store yet.</p></header>${concepts}` : '');
  } else grid.innerHTML = list.map(card).join('') + (showConcepts ? concepts : '');
  if (!list.length) grid.insertAdjacentHTML('afterbegin', `<p class="muted" style="grid-column:1/-1">Nothing matches ${m !== 'all' ? MOODS[m].label.toLowerCase() : 'that filter'} right now.</p>`);
  if (countEl) countEl.textContent = `${list.length} product${list.length === 1 ? '' : 's'} · ${matchMedia('(hover: hover)').matches ? 'Hover' : 'Tap'} a product to see its scent family`;
  wireQuickAdd(grid, items);
}
