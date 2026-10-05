import { chromium } from 'playwright-core';
import { setupMocks, unmatched } from './mock.mjs';
const base = 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = [];
const ok = (name, cond, extra = '') => { res.push([cond ? 'PASS' : 'FAIL', name, extra]); };
for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await setupMocks(p);
  const shot = n => p.screenshot({ path: `${process.env.SHOTS ?? '/tmp'}/${label}-${n}.png`, fullPage: false });
  const overflow = async n => { const o = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); ok(`${label}: no sideways scroll on ${n}`, o <= 1, `overflow ${o}px`); };

  await p.goto(base + '/'); await p.waitForSelector('#msGrid .card:not(.sk), #dProducts .sp', { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(800); await shot('1-home'); await overflow('home');
  ok(`${label}: home hero shows live products`, (await p.locator('#dProducts .sp').count()) > 0);
  // moments
  const jump = p.locator('.moments [data-jump="night"]'); if (await jump.count()) { await jump.first().click(); await p.waitForTimeout(1700); ok(`${label}: hero switches to Night`, (await p.locator('#day').getAttribute('data-m')) === 'night'); await shot('2-home-night'); }
  // add the ritual
  const addM = p.locator('[data-addmoment]'); if (await addM.count()) { await addM.first().click(); await p.waitForTimeout(500); ok(`${label}: Add this ritual fills cart`, Number(await p.locator('#cartCount').innerText()) >= 1, 'count=' + await p.locator('#cartCount').innerText()); }

  // shop + filter
  await p.goto(base + '/shop'); await p.waitForSelector('#app .grid .card:not(.sk)'); await p.waitForTimeout(600);
  await shot('3-shop'); await overflow('shop');
  const all = await p.locator('#app .grid .card:not([data-concept])').count(); ok(`${label}: shop lists live products`, all === 28, `${all}`);
  await p.goto(base + '/shop?f=diffuser&m=all&s=low'); await p.waitForSelector('#app .grid .card:not(.sk)'); await p.waitForTimeout(400);
  const dif = await p.locator('#app .grid .card:not([data-concept])').count(); ok(`${label}: diffuser filter`, dif === 7, `${dif}`);
  await p.goto(base + '/shop?f=all&m=woody&s=featured'); await p.waitForSelector('#app .grid .card:not(.sk)'); await p.waitForTimeout(400);
  ok(`${label}: mood filter returns some`, (await p.locator('#app .grid .card:not([data-concept])').count()) > 0);

  // product with sizes (candle)
  await p.goto(base + '/product/cabana'); await p.waitForSelector('#app h1'); await p.waitForTimeout(700);
  await shot('4-product'); await overflow('product');
  ok(`${label}: title`, (await p.title()).startsWith('Cabana'), await p.title());
  const sizeBtns = p.locator('#app [data-choice], #app .segs button'); ok(`${label}: size choices render`, (await sizeBtns.count()) >= 2, `${await sizeBtns.count()}`);
  const addBtn = p.locator('#app button:has-text("Add to cart")'); ok(`${label}: add to cart button present`, (await addBtn.count()) > 0);
  const before = Number(await p.locator('#cartCount').innerText());
  if (await addBtn.count()) { await addBtn.first().click(); await p.waitForTimeout(600); }
  ok(`${label}: cart count increases`, Number(await p.locator('#cartCount').innerText()) > before, `${before} -> ${await p.locator('#cartCount').innerText()}`);

  // drawer
  await p.click('#cartBtn'); await p.waitForTimeout(400); await shot('5-cart');
  ok(`${label}: drawer shows lines`, (await p.locator('.drawer .li').count()) >= 1);
  const t0 = await p.locator('.drawer .df .row b').innerText();
  await p.locator('[data-inc]').first().click(); await p.waitForTimeout(300);
  const t1 = await p.locator('.drawer .df .row b').innerText(); ok(`${label}: quantity + changes subtotal`, t0 !== t1, `${t0} -> ${t1}`);
  await p.locator('[data-dec]').first().click(); await p.waitForTimeout(300);
  ok(`${label}: quantity - restores subtotal`, (await p.locator('.drawer .df .row b').innerText()) === t0);
  await p.click('#checkoutBtn'); await p.waitForTimeout(300);
  ok(`${label}: checkout is safely off in preview`, /switched off/i.test(await p.locator('#toast').innerText()));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  ok(`${label}: Escape closes drawer`, await p.locator('#overlay').isHidden());

  // other pages
  for (const [r, sel, n] of [['/explore', '#exp .fl-card', 'explore'], ['/help', '#app details', 'help'], ['/story', '#app h1', 'story'], ['/subscribe', '#calc', 'subscribe'], ['/drops', '#voteBox', 'drops'], ['/gift', '#gAdd', 'gift'], ['/club', '#spend', 'club'], ['/wall', '#upForm', 'wall']]) {
    await p.goto(base + r); await p.waitForSelector(sel, { timeout: 8000 }).catch(() => {}); await p.waitForTimeout(500);
    ok(`${label}: ${n} renders`, (await p.locator(sel).count()) > 0); await overflow(n); if (label === 'desktop' || n === 'explore') await shot('6-' + n);
  }
  ok(`${label}: no JS errors`, errs.length === 0, errs.join(' | ').slice(0, 200));
  await ctx.close();
}
console.log(res.map(r => r.join(' | ')).join('\n')); console.log('unmatched API calls:', [...new Set(unmatched)]);
await b.close();
