import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const shot = n => p.screenshot({ path: `${process.env.SHOTS ?? '/tmp'}/${label}-j-${n}.png` });
  await p.goto(base + '/'); await p.waitForSelector('.jrail'); await p.waitForTimeout(1200);
  ok(`${label}: journey rail is on the home page`, (await p.locator('.jrail').count()) === 1);
  ok(`${label}: nine stops (the opening and eight chapters)`, (await p.locator('.jstop').count()) === 9, `${await p.locator('.jstop').count()}`);
  ok(`${label}: no flags under the opening`, (await p.locator('.flags, .jflag').count()) === 0);
  ok(`${label}: chapter headings carry a mandala`, (await p.locator('.jhead .jorn').count()) >= 8, `${await p.locator('.jhead .jorn').count()}`);
  // the page is a day passing: the sun moves down the rail as you scroll
  const y0 = await p.locator('.jmark').evaluate(e => parseFloat(e.style.top));
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.55)); await p.waitForTimeout(700);
  const y1 = await p.locator('.jmark').evaluate(e => parseFloat(e.style.top));
  ok(`${label}: scrolling moves the sun down the rail`, y1 > y0 + 30, `${y0.toFixed(0)}% -> ${y1.toFixed(0)}%`);
  ok(`${label}: the page remembers the chapter you are in`, (await p.locator('.jstop.now').count()) === 1 && (await p.locator('.jstop.past').count()) >= 2);
  await p.evaluate(() => window.scrollTo(0, 1800)); await p.waitForTimeout(700);
  const reveal = await p.evaluate(() => ({ total: document.querySelectorAll('[data-reveal]').length, shown: document.querySelectorAll('[data-reveal].in').length }));
  ok(`${label}: things below the fold ease in as you reach them`, reveal.total > 5 && reveal.shown > 0, JSON.stringify(reveal));
  const wash = await p.locator('.jwash').evaluate(e => getComputedStyle(e).backgroundImage); ok(`${label}: the page takes on the colour of the hour`, /rgb/.test(wash), wash.slice(0, 60));
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(500); const w0 = await p.locator('.jwash').evaluate(e => e.style.getPropertyValue('--w1'));
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(700); const w1 = await p.locator('.jwash').evaluate(e => e.style.getPropertyValue('--w1'));
  ok(`${label}: that colour changes from the top of the page to the bottom`, w0 !== w1 && w0 && w1, `${w0} -> ${w1}`);
  await p.evaluate(() => window.scrollTo(0, 1800)); await p.waitForTimeout(500);
  await shot('mid');
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300); await p.evaluate(() => window.scrollTo(0, 300)); await p.waitForTimeout(500);
  const par = await p.evaluate(() => Number(document.getElementById('day').style.getPropertyValue('--p'))); ok(`${label}: the opening's landscape drifts as you scroll away`, par > 0.15 && par <= 1, `--p ${par}`);
  // jump to a chapter from the rail
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
  await p.locator('.jstop').nth(6).evaluate(e => e.click()); await p.waitForTimeout(1500);
  const top = await p.evaluate(() => { const c = [...document.querySelectorAll('.chapter')].find(x => /Chapter 6/.test(x.textContent)); return Math.round(c.closest('section').getBoundingClientRect().top); });
  ok(`${label}: tapping a stop scrolls to that chapter`, Math.abs(top) < 160, `section top ${top}px`);
  // map: drill out, then zoom back in
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
  await p.locator('[data-jmap]').click(); await p.waitForSelector('.jmap.open'); await p.waitForTimeout(500);
  ok(`${label}: the map shows nine petals and a list`, (await p.locator('.jw').count()) === 9 && (await p.locator('.jlist li').count()) === 9);
  await shot('map');
  await p.keyboard.press('Escape'); await p.waitForTimeout(600); ok(`${label}: Escape closes the map`, (await p.locator('.jmap').count()) === 0);
  await p.locator('[data-jmap]').click(); await p.waitForSelector('.jmap.open'); await p.waitForTimeout(400);
  await p.locator('.jlist li button').nth(4).click(); await p.waitForTimeout(1900);
  const top4 = await p.evaluate(() => { const c = [...document.querySelectorAll('.chapter')].find(x => /Chapter 4/.test(x.textContent)); return Math.round(c.closest('section').getBoundingClientRect().top); });
  ok(`${label}: choosing a chapter on the map zooms in and scrolls there`, (await p.locator('.jmap').count()) === 0 && Math.abs(top4) < 160, `section top ${top4}px`);
  // breathe
  await p.locator('[data-jbreathe]').click(); await p.waitForSelector('.jbreathe.open'); const seen = new Set();
  for (let i = 0; i < 14; i++) { seen.add(await p.locator('#jbWord').innerText()); await p.waitForTimeout(700); }
  ok(`${label}: the breathing guide cycles in, hold, out`, ['Breathe in', 'Hold', 'Breathe out'].every(w => seen.has(w)), [...seen].join(' / '));
  await shot('breathe'); await p.locator('.jb-close').click(); await p.waitForTimeout(700); ok(`${label}: Done closes the breathing screen`, (await p.locator('.jbreathe').count()) === 0);
  // ripple on a button
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
  const btn = p.locator('#dCta .btn').first(); await btn.scrollIntoViewIfNeeded(); const bb = await btn.boundingBox(); await p.mouse.move(bb.x + 20, bb.y + 20); await p.mouse.down(); await p.waitForTimeout(120);
  ok(`${label}: a button gives a soft ripple when pressed`, (await p.locator('.rip').count()) >= 1); await p.mouse.up();
  const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(`${label}: no sideways scroll`, o <= 1, `${o}`);
  // the rail belongs to the home page only
  await p.goto(base + '/shop'); await p.waitForTimeout(600); ok(`${label}: the rail is removed on other pages`, (await p.locator('.jrail').count()) === 0 && (await p.locator('.jbar').count()) === 0);
  await p.goto(base + '/'); await p.waitForSelector('.jrail'); ok(`${label}: and comes back on the home page`, (await p.locator('.jrail').count()) === 1);
  ok(`${label}: no JS errors`, errs.length === 0, errs.join('|'));
  await ctx.close();
}
{ // reduced motion: nothing is hidden waiting to animate
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  await p.goto(base + '/'); await p.waitForSelector('.jrail'); await p.waitForTimeout(500);
  ok('reduced motion: no content is held back for reveal animations', (await p.locator('[data-reveal]').count()) === 0);
  ok('reduced motion: the rail still works', (await p.locator('.jstop').count()) === 9);
  await ctx.close();
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
