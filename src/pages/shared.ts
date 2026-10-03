import { add } from '../cart';
import { findLive, money, type Item } from '../wix';
import { toast } from '../ui';
import { navigate } from '../router';
import type { Format } from '../config';

/** Canvas product slugs look like "roller-citrus-and-sun"; map them to live products. */
export function canvasSlugToLive(items: Item[], canvasSlug: string): Item | undefined {
  const m = canvasSlug.match(/^(roller|diffuser|deodorant)-(.+)$/);
  if (!m) return undefined;
  const scent = m[2].replace(/-/g, ' ');
  // The canvas called the 2 oz / 8 oz scent items "deodorant"; in the live store they are candles.
  const format: Format = m[1] === 'deodorant' ? 'candle' : (m[1] as Format);
  return findLive(items, scent, format);
}

/**
 * Re-point every canvas product link, image and quick-add button at the live product.
 * Real product photos replace the canvas renders; cards with no live match keep the
 * render (marked as a draft image) and link to a "not in the store yet" page.
 */
export function bindCanvasProductLinks(root: HTMLElement, items: Item[]) {
  root.querySelectorAll<HTMLAnchorElement>('a[href^="#/product/"]').forEach(a => {
    const slug = a.getAttribute('href')!.slice('#/product/'.length);
    if (items.some(i => i.slug === slug)) return; // already live
    const live = canvasSlugToLive(items, slug);
    if (!live) return;
    a.setAttribute('href', `#/product/${live.slug}`);
    const img = a.querySelector<HTMLImageElement>('img.main, :scope > img');
    if (img && live.image) { img.src = live.image; img.classList.remove('dimg'); }
    const card = a.closest('.card');
    if (card) {
      const price = card.querySelector('.meta span');
      if (price) price.textContent = money(live.priceMin);
      const sub = card.querySelector('.sub');
      if (sub) sub.lastChild!.textContent = live.sizeLabel ? `${live.formatLabel} · ${live.sizeLabel}` : live.formatLabel;
    }
  });
  root.querySelectorAll<HTMLButtonElement>('button[data-add]').forEach(b => {
    const live = canvasSlugToLive(items, b.dataset.add!);
    if (!live) { b.addEventListener('click', previewOff('This item is not in the live store yet, so it')); return; }
    b.textContent = `Quick add · ${money(live.priceMin)}`;
    b.addEventListener('click', () => quickAdd(live));
  });
}

export async function quickAdd(i: Item) {
  if (i.choices.length > 1) { navigate(`/product/${i.slug}`); return; }
  await add({ productId: i.id, slug: i.slug, name: i.name, price: i.priceMin, image: i.thumb, choice: i.choices[0]?.name, optionName: i.optionName });
  toast(`${i.name} added to your cart`);
}

export function wireQuickAdd(root: HTMLElement, items: Item[]) {
  root.querySelectorAll<HTMLButtonElement>('button[data-qa]').forEach(b => {
    const i = items.find(x => x.id === b.dataset.qa);
    if (i) b.addEventListener('click', () => quickAdd(i));
  });
}

export const previewOff = (what: string) => () =>
  toast(`${what} is switched off in this private preview.`);
