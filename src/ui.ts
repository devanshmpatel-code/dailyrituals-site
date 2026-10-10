import { MOODS } from './config';
import { money, type Item } from './wix';
import { cardOrbit, skeletonOrbit } from './celestial';

/** The mood colours lifted for a 2px star on a dark ground (see celestial tokens in site.css). */
const STAR: Record<string, string> = { fresh: '#A3C8C0', sunny: '#ECB76A', floral: '#CF8A7D', woody: '#C09571', grounding: '#8EAA86' };

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Canvas markup references images by bare filename; serve them from /img. */
export const fixImages = (html: string) => html.replace(/src="([a-z0-9-]+\.jpg)"/g, 'src="/img/$1"');

export const priceText = (i: Item) =>
  i.priceMin === i.priceMax ? money(i.priceMin) : `From ${money(i.priceMin)}`;

export const metaText = (i: Item) => (i.sizeLabel ? `${i.formatLabel} · ${i.sizeLabel}` : i.formatLabel);

export const productHref = (i: Item) => `#/product/${i.slug}`;

/** The canvas ProductCard, filled from a live product. */
export function cardHTML(i: Item, badge?: string): string {
  const mood = i.mood ? MOODS[i.mood] : undefined;
  const alt = mood ? `<img class="alt" src="${mood.backdrop}" alt="" loading="lazy">` : '';
  const sw = mood ? `<span class="swatch" style="background:${mood.swatch}"></span>` : '';
  const single = i.choices.length <= 1;
  const qa = single && i.inStock
    ? `<button class="qa" data-qa="${i.id}">Quick add · ${money(i.priceMin)}</button>`
    : `<a class="qa" href="${productHref(i)}">${i.inStock ? 'Choose an option' : 'Sold out'}</a>`;
  // --mood-c colours the label on hover; --mood-s is the star that lights at the top of the orbit ring
  const tone = mood ? ` style="--mood-c:${mood.swatch};--mood-s:${STAR[i.mood!] ?? mood.swatch}"` : '';
  return `<div class="card" data-format="${i.format}" data-mood="${i.mood ?? ''}"${tone}>
    <div class="ph">${badge ? `<span class="badge">${esc(badge)}</span>` : ''}
      <a href="${productHref(i)}" aria-label="${esc(i.name)}"><img class="main" src="${i.image}" alt="${esc(i.name)}" loading="lazy">${alt}</a>
      ${cardOrbit()}
      ${qa}
    </div>
    <a href="${productHref(i)}" style="text-decoration:none;display:flex;flex-direction:column;gap:4px">
      <div class="meta"><h3>${esc(i.scent)}</h3><span>${priceText(i)}</span></div>
      <div class="sub" style="display:flex;gap:8px;align-items:center">${sw}${esc(metaText(i))}</div>
    </a>
  </div>`;
}

export function skeletonCards(n: number) {
  return Array.from({ length: n }, () => `<div class="card sk"><div class="ph">${skeletonOrbit()}</div><div class="sk-line"></div><div class="sk-line short"></div></div>`).join('');
}

export function errorBox(msg: string) {
  return `<div class="live-error" role="status"><b>Live data could not load.</b> <span>${esc(msg)}</span></div>`;
}

let toastTimer = 0;
export function toast(msg: string) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg; el.classList.add('on');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => el!.classList.remove('on'), 2600);
}

/** Generic canvas behaviours: tab bars, chip toggles, accordions. */
export function wireCommon(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[role="tablist"]').forEach(bar => {
    const tabs = [...bar.querySelectorAll<HTMLButtonElement>('[role="tab"][data-tab]')];
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.setAttribute('aria-selected', String(x === t)));
      const scope = bar.parentElement!;
      scope.querySelectorAll<HTMLElement>('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== t.dataset.tab; });
    }));
  });
  root.querySelectorAll<HTMLButtonElement>('button[data-heart]').forEach(b =>
    b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))));
}
