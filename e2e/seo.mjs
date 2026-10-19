// Search and sharing tags per route (src/seo.ts), and the image loading that goes with them: unique title and description,
// canonical, Open Graph and Twitter tags, JSON-LD (Organization everywhere, Product with a live price on product pages),
// and below-the-fold pictures that load lazily at a known size. Run against a normal (path routing) build.
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const origin = (process.env.BASE ?? 'http://localhost:4173/#').replace(/\/#\/?$/, '');
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };

const ROUTES = ['/', '/shop', '/explore', '/coaching', '/book', '/subscribe', '/drops', '/gift', '/wall', '/club', '/story', '/giving', '/journal',
  '/journal/wooden-wick', '/journal/first-burn', '/journal/candle-safety', '/journal/wax-guide', '/journal/candle-and-roller',
  '/help', '/privacy', '/terms', '/accessibility', '/refund-policy', '/product/cabana', '/product/windy-beach-fragrance-roller'];

const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage(); p.setDefaultTimeout(10000); await setupMocks(p);
const errs = []; p.on('pageerror', e => errs.push(e.message));
const tags = () => p.evaluate(() => {
  const m = (a, k) => document.head.querySelector(`meta[${a}="${k}"]`)?.content ?? null;
  return {
    title: document.title, desc: m('name', 'description'), canon: document.head.querySelector('link[rel="canonical"]')?.href ?? null,
    ogt: m('property', 'og:title'), ogd: m('property', 'og:description'), ogu: m('property', 'og:url'), ogi: m('property', 'og:image'), ogty: m('property', 'og:type'),
    tw: m('name', 'twitter:card'), twi: m('name', 'twitter:image'), robots: m('name', 'robots'),
    ld: [...document.head.querySelectorAll('script[type="application/ld+json"]')].map(s => JSON.parse(s.textContent)),
  };
});

const seen = { title: new Map(), desc: new Map() };
const bad = { canon: [], og: [], ogi: [], len: [], ld: [] };
const imgChecked = new Map();
let productLd = 0;
for (const r of ROUTES) {
  await p.goto(origin + r);
  const want = new URL(r, origin).pathname;
  // the tags are set when the page has rendered: wait for this route's own canonical (and, on a product page, its JSON-LD)
  await p.waitForFunction(([path, product]) => document.head.querySelector('link[rel="canonical"]')?.href.endsWith(path) && (!product || document.getElementById('seo-ld')?.textContent.includes('"Product"')), [want === '/' ? '/' : want, r.startsWith('/product/')], { timeout: 10000 }).catch(() => {});
  const t = await tags();
  if (seen.title.has(t.title)) bad.len.push(`${r}: same title as ${seen.title.get(t.title)}`); else seen.title.set(t.title, r);
  if (seen.desc.has(t.desc)) bad.len.push(`${r}: same description as ${seen.desc.get(t.desc)}`); else seen.desc.set(t.desc, r);
  if (!t.title || t.title.length > 72) bad.len.push(`${r}: title length ${t.title?.length}`);
  if (!t.desc || t.desc.length < 40 || t.desc.length > 160) bad.len.push(`${r}: description length ${t.desc?.length}`);
  const expect = new URL(want, origin).href;
  if (!t.canon || new URL(t.canon).pathname !== want || t.canon.includes('?') || t.canon.includes('#')) bad.canon.push(`${r}: ${t.canon}`);
  if (t.ogt !== t.title || t.ogd !== t.desc || t.ogu !== t.canon || t.tw !== 'summary_large_image' || t.twi !== t.ogi) bad.og.push(`${r}: og/twitter tags do not match the page`);
  if (!/^https?:\/\//.test(t.ogi ?? '')) bad.ogi.push(`${r}: og:image is not an absolute address (${t.ogi})`);
  else if (!imgChecked.has(t.ogi)) {
    const u = new URL(t.ogi);
    if (u.origin === new URL(origin).origin) { const rs = await ctx.request.get(t.ogi); imgChecked.set(t.ogi, rs.status() === 200 && /^image\//.test(rs.headers()['content-type'] ?? '')); }
    else imgChecked.set(t.ogi, u.hostname === 'static.wixstatic.com'); // a product photograph from the Wix media library (the tests do not reach it)
    if (!imgChecked.get(t.ogi)) bad.ogi.push(`${r}: og:image does not resolve (${t.ogi})`);
  }
  const graph = t.ld.flatMap(j => j['@graph'] ?? [j]);
  const org = graph.find(g => g['@type'] === 'Organization');
  if (!org || !org.name || !org.url || !org.logo || org.sameAs) bad.ld.push(`${r}: Organization JSON-LD (${JSON.stringify(org)?.slice(0, 120)})`);
  if (r.startsWith('/product/')) {
    const prod = graph.find(g => g['@type'] === 'Product');
    const price = Number(prod?.offers?.price ?? prod?.offers?.lowPrice);
    if (!prod || !(price > 0) || prod.offers.priceCurrency !== 'CAD' || !/schema\.org\/(InStock|OutOfStock)$/.test(prod.offers.availability) || !prod.name || prod.offers.url !== t.canon || prod.aggregateRating || prod.review) bad.ld.push(`${r}: Product JSON-LD ${JSON.stringify(prod)?.slice(0, 200)}`);
    else productLd++;
  } else if (graph.some(g => g['@type'] === 'Product')) bad.ld.push(`${r}: Product JSON-LD on a page that is not a product`);
  if (t.robots !== 'noindex, nofollow') bad.ld.push(`${r}: preview build lost its noindex tag (${t.robots})`);
}
ok(`${ROUTES.length} routes: every title and description is unique`, !bad.len.some(x => /same/.test(x)), bad.len.filter(x => /same/.test(x)).join(' | '));
ok('titles fit (at most 72 characters) and descriptions are 40 to 160 characters', !bad.len.some(x => /length/.test(x)), bad.len.filter(x => /length/.test(x)).join(' | '));
ok('every route has a canonical path without a query or hash', bad.canon.length === 0, bad.canon.join(' | '));
ok('Open Graph title, description and url and the Twitter card match each page', bad.og.length === 0, bad.og.join(' | '));
ok('og:image is absolute and resolves (200, an image)', bad.ogi.length === 0, bad.ogi.join(' | '));
ok('Organization JSON-LD (name, url, logo, no invented sameAs) and no Product JSON-LD off product pages', bad.ld.length === 0, bad.ld.join(' | '));
ok('product pages: Product JSON-LD with a live price, CAD, availability, and no ratings or reviews', productLd === 2, `${productLd} of 2`);

// the home page's own title leads with what the business does
await p.goto(origin + '/'); await p.waitForTimeout(800);
ok('home title says what the site is (not just the name)', /Hand-poured candles/.test(await p.title()) && /White Rock/.test(await p.title()), await p.title());
// the address in the bar changes without a reload: tags follow the route
await p.locator('.mainnav a[data-nav="shop"]').click(); await p.waitForURL('**/shop'); await p.waitForFunction(() => document.head.querySelector('link[rel="canonical"]')?.href.endsWith('/shop'));
ok('moving to Shop updates the title and canonical without a reload', /^Shop/.test(await p.title()) && (await tags()).canon.endsWith('/shop'), await p.title());
// the shop filter does not make a new canonical address
await p.goto(origin + '/shop?f=roller&m=all&s=featured'); await p.waitForSelector('.grid .card');
ok('a filtered shop view keeps /shop as its canonical address', new URL((await tags()).canon).pathname === '/shop', (await tags()).canon);
ok('the old quiz address points at Find your scent', await (async () => { await p.goto(origin + '/quiz'); await p.waitForSelector('h1'); await p.waitForTimeout(600); return new URL((await tags()).canon).pathname === '/explore'; })());
ok('an unknown address has no canonical', await (async () => { await p.goto(origin + '/no-such-page'); await p.waitForTimeout(1000); const t = await tags(); return t.canon === null && /not found/i.test(t.title); })());
await ctx.close();

// ---------- pictures: lazy below the fold, sized, small ----------
for (const [label, vp, mobile] of [['desktop', { width: 1280, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const c = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 }); const q = await c.newPage(); q.setDefaultTimeout(10000); await setupMocks(q);
  const reqs = []; q.on('request', r => reqs.push(r.url()));
  const imgs = () => q.evaluate(() => [...document.querySelectorAll('#app img')].map(i => ({ src: i.currentSrc || i.getAttribute('src') || '', y: i.getBoundingClientRect().top + scrollY, h: i.getBoundingClientRect().height, lazy: i.loading === 'lazy', dims: !!(i.getAttribute('width') && i.getAttribute('height')), srcset: !!i.srcset, cls: i.className, concept: !!i.closest('[data-concept]') })));
  await q.goto(origin + '/shop'); await q.waitForSelector('.grid .scard'); await q.waitForTimeout(1200);
  const shop = (await imgs()).filter(i => i.h > 0 || i.src);
  const fold = vp.height;
  const eagerBelow = shop.filter(i => i.y > fold && !i.lazy);
  ok(`${label} /shop: every picture below the first screen is lazy (${shop.length} pictures)`, eagerBelow.length === 0, eagerBelow.map(i => i.src.slice(-40)).join(' | '));
  const noDims = shop.filter(i => !i.dims);
  ok(`${label} /shop: every picture has width and height`, noDims.length === 0, `${noDims.length} without: ${noDims.map(i => i.src.slice(-30)).join(' | ')}`);
  const concepts = shop.filter(i => i.concept);
  ok(`${label} /shop: the three concept cards use lazy, sized, webp pictures`, concepts.length === 3 && concepts.every(i => i.lazy && i.dims && /\.webp(\?|$)/.test(i.src)), concepts.map(i => i.src.slice(-30)).join(' | '));
  ok(`${label} /shop: discovery and moon drop offer small widths (srcset)`, concepts.filter(i => i.srcset).length === 2);
  ok(`${label} /shop: the canvas's sample card pictures are never fetched`, !reqs.some(u => /\/img\/(roller|diffuser|deodorant|candle-soy|mood)-?[a-z-]*\.(jpg|webp)/.test(u)), reqs.filter(u => /\/img\/(roller|diffuser|deodorant|candle-soy|mood)/.test(u)).slice(0, 3).join(' | '));
  await q.goto(origin + '/gift'); await q.waitForSelector('#gCard'); await q.waitForTimeout(1200);
  const gift = (await imgs()).filter(i => i.src);
  const giftEager = gift.filter(i => i.y > fold && !i.lazy);
  ok(`${label} /gift: every picture below the first screen is lazy (${gift.length} pictures)`, giftEager.length === 0, giftEager.map(i => i.src.slice(-40)).join(' | '));
  ok(`${label} /gift: the moon pictures and thumbnails have width and height`, gift.every(i => i.dims || !/moons|morning|midday|evening/.test(i.src)), gift.filter(i => !i.dims).map(i => i.src.slice(-30)).join(' | '));
  const homeReqs = []; q.on('request', r => homeReqs.push(r.url()));
  await q.goto(origin + '/'); await q.waitForSelector('#dProducts .sp-ritual'); await q.waitForTimeout(1500);
  ok(`${label} home: the picture renders are served as webp, no .jpg`, !homeReqs.some(u => /\/img\/(morning|midday|evening|mood-[a-z]+|candle-soy|roller-[a-z-]+|diffuser-[a-z-]+)\.jpg/.test(u)), homeReqs.filter(u => /\.jpg(\?|$)/.test(u) && u.startsWith(origin)).join(' | '));
  const heroImg = await q.evaluate(() => [...document.querySelectorAll('#app img')].filter(i => i.closest('#dStack')).map(i => i.getAttribute('src') ?? i.dataset.src));
  ok(`${label} home: the hero stack's pictures exist as webp`, heroImg.length > 0 && heroImg.every(s => /\.webp$/.test(s)), heroImg.join(','));
  await q.goto(origin + '/product/windy-beach-fragrance-roller'); await q.waitForSelector('#mainImg'); await q.waitForTimeout(800);
  const main = await q.evaluate(() => { const i = document.getElementById('mainImg'); return { lazy: i.loading, fp: i.getAttribute('fetchpriority'), dims: !!(i.width && i.height) }; });
  ok(`${label} product: the main photograph is the priority picture (eager, fetchpriority high)`, main.lazy !== 'lazy' && main.fp === 'high', JSON.stringify(main));
  await c.close();
}
// every webp the page code names exists
const files = ['/img/brand/og-1200x630.jpg', '/img/brand/logo.png', '/img/discovery-320.webp', '/img/discovery-640.webp', '/img/discovery.webp', '/img/moondrop-320.webp', '/img/moondrop-640.webp', '/img/moondrop.webp', '/img/morning.webp', '/img/mood-fresh.webp', '/img/midday.webp', '/img/mood-woody.webp', '/img/evening.webp', '/img/coaching.webp'];
const c2 = await b.newContext(); const missing = [];
for (const f of files) { const rs = await c2.request.get(origin + f); if (rs.status() !== 200 || !/^image\//.test(rs.headers()['content-type'] ?? '')) missing.push(f); }
ok('the new image files are served', missing.length === 0, missing.join(' | '));
ok('no JS errors', errs.length === 0, errs.join(' | ').slice(0, 200));
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
