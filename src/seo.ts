// Search and sharing metadata for every route: <title>, description, canonical, Open Graph, Twitter card and JSON-LD.
// main.ts calls applySeo() once per route change, after the page has rendered; nothing else in the app touches these tags.
//
// - Canonical addresses are real paths (https://www.dailyritualsco.com/shop), the same form scripts/seo.mjs writes into
//   sitemap.xml, whichever routing mode the build uses. Filters and other query strings are not part of the address.
// - Descriptions reuse copy that is already on the page (they are not shown anywhere); nothing is added that the page does not say.
// - robots is not touched here: the preview build keeps the noindex tag from index.html and the launch build drops it (vite.config.ts).
// - Product pages get Product JSON-LD from the live catalogue (price, availability). There are no ratings or reviews in it.
import { LAUNCHED } from './config';
import { currentRoute } from './router';
import { loadCatalogue, type Item } from './wix';
import { FAMILIES } from './data/scents';
import { ARTICLES } from './pages/journal';

const SITE = 'Daily Rituals Co.';
const PRODUCTION = 'https://www.dailyritualsco.com';
/** Where the pictures and addresses point: the real domain once launched, this origin while previewing (so previews stay self-contained). */
const origin = () => (import.meta.env.VITE_SITE_URL || (LAUNCHED ? PRODUCTION : location.origin)).replace(/\/$/, '');
/** 1200 x 630, made from the logo in the brand purple (public/img/brand). */
const OG_IMAGE = '/img/brand/og-1200x630.jpg';
const LOGO = '/img/brand/logo.png';

interface Page { title: string; description: string; type?: 'website' | 'article' }

const HOME_TITLE = `${SITE} · Hand-poured candles & neuro coaching, White Rock BC`;
const HOME_DESC = 'Hand-poured scents and mindful rituals for every part of your day. Small batches, made in British Columbia.';

// Copy below is taken from each page's own introduction (see the pages in src/pages and src/canvas/pages).
const PAGES: Record<string, Page> = {
  '': { title: HOME_TITLE, description: HOME_DESC },
  shop: { title: `Shop candles, rollers & diffusers · ${SITE}`, description: 'Every scent comes in more than one format, so you can wear it, diffuse it and light it. Explore by scent, build a ritual or browse everything.' },
  explore: { title: `Find your scent · ${SITE}`, description: 'Two ways in: explore the Scent Sky, where each of ten scent families is a constellation and every star a scent, or answer four quick questions.' },
  coaching: { title: `Neuro coaching with Claire · ${SITE}`, description: 'Neuro coaching helps you build new responses through small, repeatable daily practice. The first call is free.' },
  book: { title: `Book your free discovery call · ${SITE}`, description: 'A free 20-minute call with Claire to talk about your goals and whether neuro coaching is a fit.' },
  subscribe: { title: `Ritual on Repeat · ${SITE}`, description: 'Coming soon: the scents that shape your day, sent before you run out. It is not open yet.' },
  drops: { title: `Moon Drops · ${SITE}`, description: 'Moon Drop No. 01: a quiet, resinous scent for long nights, with smoked cedar, black tea and a little vanilla. An idea we are getting ready, not in the store yet.' },
  gift: { title: `Send a Sky, a candle gift with a note · ${SITE}`, description: 'Choose a ritual, pick a sky for the card, write a note and choose the day it arrives. Any of Claire\'s candles can be sent as a gift.' },
  wall: { title: `Ritual Wall · ${SITE}`, description: 'Your rituals, in your own photos: a candle on the desk, a roller in your bag, a diffuser by the bed.' },
  club: { title: `The Ritualists · ${SITE}`, description: 'Our rewards club is opening soon. Join the Monthly Ritual to be first to hear, with a short practice from Claire each month.' },
  story: { title: `Meet the maker, Claire · ${SITE}`, description: 'Hi, I\'m Claire. I make clean products with intention, hand poured in small batches in British Columbia, and I coach people through the habits behind their days.' },
  giving: { title: `Giving back · ${SITE}`, description: 'A public ledger of what Daily Rituals Co. gives: $1 from every order. Every donation is posted here, with its proof.' },
  journal: { title: `Journal: candle care and rituals · ${SITE}`, description: 'Short, useful reads from the studio in White Rock, BC: how to burn a candle well, how candles are made, and how to make a scent part of your day.' },
  help: { title: `Help and contact · ${SITE}`, description: 'Shipping, returns, candle care and how to reach us. Orders are packed by hand, so small questions are welcome.' },
  privacy: { title: `Privacy policy · ${SITE}`, description: 'How Daily Rituals Co. collects, uses and protects your personal information.' },
  terms: { title: `Terms of service · ${SITE}`, description: 'The terms that apply when you use this website, buy products or book coaching.' },
  accessibility: { title: `Accessibility · ${SITE}`, description: 'We want everyone to be able to shop, book and find a calm moment here. If something is hard to use, let us know through Help.' },
  'refund-policy': { title: `Refund policy · ${SITE}`, description: 'Returns, exchanges and refunds for products and coaching.' },
  account: { title: `My account · ${SITE}`, description: HOME_DESC },
  checkout: { title: `Your cart · ${SITE}`, description: HOME_DESC },
  'order-confirmed': { title: `Order confirmed · ${SITE}`, description: HOME_DESC },
};
/** Older addresses that show another page: they point search engines at that page. */
const ALIAS: Record<string, string> = { quiz: 'explore', build: 'explore', sets: 'explore', reset: 'book' };

/** Tidy and shorten to about 155 characters, at a word end. */
export const clip = (s: string, max = 155) => {
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1), sp = cut.lastIndexOf(' ');
  return `${cut.slice(0, sp > 80 ? sp : cut.length).replace(/[\s,;:.\-–—]+$/, '')}…`;
};

function metaTag(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.content = content;
}
function linkTag(rel: string, href: string | null) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (href === null) { el?.remove(); return; }
  if (!el) { el = document.createElement('link'); el.rel = rel; document.head.appendChild(el); }
  el.href = href;
}
function jsonLd(graph: object[] | null) {
  let el = document.getElementById('seo-ld') as HTMLScriptElement | null;
  if (!graph) { el?.remove(); return; }
  if (!el) { el = document.createElement('script'); el.id = 'seo-ld'; el.type = 'application/ld+json'; document.head.appendChild(el); }
  el.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}

interface Resolved { title: string; description: string; path: string | null; image: string; type: string; product?: Item; imageAlt: string }

/** The visible "About" paragraph of the product page (set by renderProduct), when it is real copy and not a review note. */
const aboutOnPage = () => {
  const t = document.querySelector('#app [data-panel="0"] p')?.textContent?.trim() ?? '';
  return t && !/\[Confirm/i.test(t) ? t : '';
};

async function resolve(): Promise<Resolved> {
  const [path, query = ''] = currentRoute().split('?');
  void query;
  const [seg, arg] = path.split('/');
  const base = { image: origin() + OG_IMAGE, type: 'website', imageAlt: `${SITE}: hand-poured candles, made in White Rock, BC` };
  const page = (key: string, p: string | null): Resolved => ({ ...base, ...PAGES[key], description: clip(PAGES[key].description), path: p });

  if (seg === 'product' && arg) {
    const slug = decodeURIComponent(arg);
    let items: Item[] = [];
    try { items = await loadCatalogue(); } catch { /* no catalogue: the page is generic */ }
    const it = items.find(i => i.slug === slug);
    if (!it) return { ...base, title: /^(roller|diffuser|candle)-/.test(slug) ? `Product · ${SITE}` : `Not available right now · ${SITE}`, description: HOME_DESC, path: `/product/${encodeURIComponent(slug)}` };
    const about = it.description.trim() || aboutOnPage();
    const description = clip(about ? (about.toLowerCase().includes(it.scent.toLowerCase()) ? about : `${it.name}. ${about}`) : `${it.name}${it.sizeLabel ? `, ${it.sizeLabel}` : ''}. Made in small batches in British Columbia.`);
    return { ...base, title: `${it.name} · ${SITE}`, description, path: `/product/${encodeURIComponent(it.slug)}`, image: it.image || base.image, imageAlt: it.name, product: it };
  }
  if (seg === 'journal' && arg) {
    const a = ARTICLES.find(x => x.slug === decodeURIComponent(arg));
    return a ? { ...base, title: `${a.title} · ${SITE}`, description: clip(a.dek), path: `/journal/${a.slug}`, type: 'article' } : page('journal', '/journal');
  }
  if (seg === 'book') return { ...page('book', arg ? `/book/${arg}` : '/book'), title: document.title }; // the booking page names the service it shows
  const key = ALIAS[seg] ?? seg;
  if (key in PAGES) return page(key, key ? `/${key}` : '/');
  return { ...base, title: `Page not found · ${SITE}`, description: HOME_DESC, path: null };
}

export async function applySeo() {
  const r = await resolve();
  const url = r.path === null ? null : origin() + (r.path === '/' ? '/' : r.path);
  document.title = r.title;
  metaTag('name', 'description', r.description);
  linkTag('canonical', url);
  metaTag('property', 'og:site_name', SITE);
  metaTag('property', 'og:locale', 'en_CA');
  metaTag('property', 'og:type', r.type);
  metaTag('property', 'og:title', r.title);
  metaTag('property', 'og:description', r.description);
  if (url) metaTag('property', 'og:url', url); else document.head.querySelector('meta[property="og:url"]')?.remove();
  metaTag('property', 'og:image', r.image);
  metaTag('property', 'og:image:alt', r.imageAlt);
  metaTag('name', 'twitter:card', 'summary_large_image');
  metaTag('name', 'twitter:title', r.title);
  metaTag('name', 'twitter:description', r.description);
  metaTag('name', 'twitter:image', r.image);

  const org = { '@type': 'Organization', '@id': `${origin()}/#organization`, name: SITE, url: `${origin()}/`, logo: `${origin()}${LOGO}` };
  const graph: object[] = [org];
  const it = r.product;
  if (it && url) {
    const cur = 'CAD', availability = `https://schema.org/${it.inStock ? 'InStock' : 'OutOfStock'}`;
    const offers = it.priceMin === it.priceMax
      ? { '@type': 'Offer', url, priceCurrency: cur, price: it.priceMin.toFixed(2), availability }
      : { '@type': 'AggregateOffer', url, priceCurrency: cur, lowPrice: it.priceMin.toFixed(2), highPrice: it.priceMax.toFixed(2), availability };
    graph.push({ '@type': 'Product', '@id': `${url}#product`, name: it.name, description: r.description, url, category: it.families.length ? it.families.map(f => FAMILIES[f].label).join(', ') : undefined, image: it.image ? [it.image] : undefined, brand: { '@id': org['@id'] }, offers });
  }
  jsonLd(graph);
}
