// Scroll-driven motion: the pinned day, statements that light up, shapes that open, the product local nav, page morph fallbacks.
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const origin = (process.env.BASE ?? 'http://localhost:4173/#').replace(/\/?#?$/, '');
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const scrollTo = (p, y) => p.evaluate(y => window.scrollTo(0, y), y);
{ // desktop
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(origin + '/'); await p.waitForSelector('#dProducts .sp'); await p.waitForTimeout(800);
  ok('desktop: the opening is pinned for the day', await p.evaluate(() => document.querySelector('.daypin')?.classList.contains('on')));
  const len = await p.evaluate(() => Number(document.querySelector('.daypin').dataset.len));
  const clock0 = await p.locator('#dClock').innerText();
  const m0 = await p.locator('#day').getAttribute('data-m');
  await scrollTo(p, Math.round(len * 0.37)); await p.waitForTimeout(500);
  const top = await p.evaluate(() => Math.round(document.getElementById('day').getBoundingClientRect().top));
  const clock1 = await p.locator('#dClock').innerText();
  ok('desktop: the opening stays in place while the day plays', top >= 0 && top < 120, `${top}px`);
  ok('desktop: scrolling moves the clock on', clock1 !== clock0, `${clock0.replace(/\s+/g, ' ')} -> ${clock1.replace(/\s+/g, ' ')}`);
  const moms = new Set(); for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) { await scrollTo(p, Math.round(len * f)); await p.waitForTimeout(250); moms.add(await p.locator('#day').getAttribute('data-m')); }
  ok('desktop: the whole day plays through several moments', moms.size >= 4, [...moms].join(','));
  await scrollTo(p, 0); await p.waitForTimeout(500);
  ok('desktop: scrolling back returns to where it started', (await p.locator('#day').getAttribute('data-m')) === m0, m0);
  ok('desktop: the home page has no one-product buy bar', (await p.locator('.buybar').count()) === 0);
  await scrollTo(p, len + 1400); await p.waitForTimeout(600);
  ok('desktop: still no buy bar once the hero button has gone (the menu is the door to every product)', (await p.locator('.buybar, .lnav').count()) === 0);
  const say = p.locator('.say').first();
  await say.evaluate(el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - window.innerHeight * 0.95)); await p.waitForTimeout(400);
  const before = await say.locator('.w.on').count();
  await say.evaluate(el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - window.innerHeight * 0.3)); await p.waitForTimeout(400);
  const after = await say.locator('.w.on').count(), total = await say.locator('.w').count();
  ok('desktop: a statement lights up word by word as you read', before < total && after === total, `${before} -> ${after} of ${total}`);
  ok('desktop: the statement keeps its words for screen readers', (await say.getAttribute('aria-label'))?.length > 10);
  ok('desktop: pictures below the fold open out of a shape', (await p.locator('.shape-in.open').count()) >= 1, `${await p.locator('.shape-in').count()} shaped`);
  await p.goto(origin + '/product/roller-citrus-and-sun'); await p.waitForSelector('#addBtn'); await p.waitForTimeout(800);
  ok('desktop: the product page has a local nav at rest, not a bottom bar', (await p.locator('.lnav').count()) === 1 && (await p.locator('.lnav.is-stuck, .buybar').count()) === 0);
  await p.evaluate(() => window.scrollTo(0, window.scrollY + document.getElementById('addBtn').getBoundingClientRect().bottom + 60)); await p.waitForTimeout(600);
  ok('desktop: the local nav sticks once the add button scrolls away and its pill says Add to cart', (await p.locator('.lnav.is-stuck').count()) === 1 && /Add to cart · \$\d+\.\d{2}/.test(await p.locator('.lnav-add').getAttribute('aria-label')), await p.locator('.lnav-add').getAttribute('aria-label'));
  const c0 = Number(await p.locator('#cartCount').innerText()); await p.locator('.lnav-add').click(); await p.waitForTimeout(600);
  ok('desktop: the local nav pill adds the product to the cart', Number(await p.locator('#cartCount').innerText()) === c0 + 1, `${c0} -> ${await p.locator('#cartCount').innerText()}`);
  await p.goto(origin + '/shop'); await p.waitForSelector('.grid .card'); await p.waitForTimeout(500);
  ok('desktop: leaving a page removes its local nav', (await p.locator('.lnav, .lnav-sentinel').count()) === 0);
  await p.locator('.grid .card a[href^="/product/"]:visible').first().click(); await p.waitForSelector('.mainimg img'); await p.waitForTimeout(900);
  ok('desktop: a product card opens its product page (with the morph where supported)', /\/product\//.test(p.url()));
  ok('desktop: morph names are cleared afterwards', (await p.locator('[style*="view-transition-name: product-hero"]').count()) <= 1);
  ok('desktop: no JS errors', errs.length === 0, errs.join(' | ').slice(0, 200));
  await ctx.close();
}
{ // phone: no pinning, no buy bar; the product local nav keeps the name and the add pill
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  await p.goto(origin + '/'); await p.waitForSelector('#dProducts .sp'); await p.waitForTimeout(800);
  ok('phone: the opening is not pinned', !(await p.evaluate(() => document.querySelector('.daypin')?.classList.contains('on'))));
  await scrollTo(p, 2200); await p.waitForTimeout(600);
  ok('phone: no one-product buy bar rises on the home page', (await p.locator('.buybar').count()) === 0);
  ok('phone: no sideways scroll', (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
  await p.goto(origin + '/product/roller-citrus-and-sun'); await p.waitForSelector('.lnav'); await p.waitForTimeout(800);
  await scrollTo(p, 900); await p.waitForTimeout(600);
  const w = await p.evaluate(() => { const n = document.querySelector('.lnav-name').getBoundingClientRect(), a = document.querySelector('.lnav-add').getBoundingClientRect(); return [n.left >= 0, n.width > 60, a.right <= innerWidth, a.height >= 44, document.querySelector('.lnav').classList.contains('is-stuck')]; });
  ok('phone: the stuck local nav keeps the name and a 44px add pill on screen', w.every(Boolean), w.join(','));
  ok('phone: no sideways scroll on the product page', (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
  await ctx.close();
}
{ // reduced motion
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  await p.goto(origin + '/'); await p.waitForSelector('#dProducts .sp'); await p.waitForTimeout(800);
  ok('reduced motion: the opening is not pinned', (await p.locator('.daypin').count()) === 0);
  ok('reduced motion: statements are fully shown', (await p.locator('.say .w:not(.on)').count()) === 0);
  ok('reduced motion: pictures are not clipped', (await p.locator('.shape-in').count()) === 0);
  await ctx.close();
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
