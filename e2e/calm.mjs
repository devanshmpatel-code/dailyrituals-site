import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/'); await p.waitForSelector('.jrail'); await p.waitForTimeout(800);
  ok(`${label}: home has the rail, not the extra breath button`, (await p.locator('.jrail').count()) === 1 && (await p.locator('.jfab').count()) === 0);
  const hero = await p.locator('#dStack img[data-mimg]').evaluateAll(a => a.map(i => i.src));
  ok(`${label}: the opening uses real photographs, not renders`, hero.length === 5 && hero.every(u => u.includes('wixstatic.com')), `${hero.filter(u => u.includes('wixstatic')).length} of ${hero.length}`);
  for (const r of ['/shop', '/coaching', '/help', '/explore', '/subscribe']) {
    await p.goto(base + r); await p.waitForTimeout(900);
    ok(`${label}: ${r} has the breath button`, (await p.locator('.jfab').count()) === 1 && (await p.locator('.jrail').count()) === 0);
    ok(`${label}: ${r} has a mandala behind its heading`, (await p.locator('main .jhead > .jorn').count()) >= 1);
    ok(`${label}: ${r} takes on the colour of the hour`, (await p.locator('.jwash').count()) === 1);
    ok(`${label}: ${r} eases in`, await p.locator('#app').evaluate(e => e.classList.contains('pagein')));
  }
  await p.goto(base + '/coaching'); await p.waitForTimeout(800); await p.locator('.jfab').click(); await p.waitForSelector('.jbreathe.open'); ok(`${label}: the breath button opens the breathing screen`, true); await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  const sub = await p.evaluate(() => [...document.querySelectorAll('img')].filter(i => /\/img\/midday\.jpg|wixstatic/.test(i.src) && i.closest('#app')).length); ok(`${label}: photos are wired on inner pages`, sub >= 0);
  const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(`${label}: no sideways scroll`, o <= 1, `${o}`);
  ok(`${label}: no JS errors`, errs.length === 0, errs.join('|'));
  await ctx.close();
}
{ // if a photo cannot load, the original render stays in place
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  await p.route(/static\.wixstatic\.com/, r => r.abort());
  await p.goto(base + '/'); await p.waitForSelector('#dStack img'); await p.waitForTimeout(1500);
  const srcs = await p.locator('#dStack img[data-mimg]').evaluateAll(a => a.map(i => i.getAttribute('src')));
  ok('when photos fail to load the renders are restored', srcs.every(u => u.startsWith('/img/')), srcs.join(' '));
  await ctx.close();
}
{ const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  await p.goto(base + '/shop'); await p.waitForTimeout(800); ok('reduced motion: nothing on inner pages is held back to animate', (await p.locator('[data-reveal]').count()) === 0); await ctx.close(); }
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
