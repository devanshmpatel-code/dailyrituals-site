import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const shot = n => p.screenshot({ path: `${process.env.SHOTS ?? '/tmp'}/${label}-j-${n}.png` });
  await p.goto(base + '/'); await p.waitForSelector('.jhere', { state: 'attached' }); await p.waitForTimeout(1200);
  ok(`${label}: no side rail or map button (the "you are here" card does that job)`, (await p.locator('.jrail, [data-jmap]').count()) === 0);
  ok(`${label}: the breathing orb is on the home page`, (await p.locator('.breathorb').count()) === 1);
  ok(`${label}: no flags under the opening`, (await p.locator('.flags, .jflag').count()) === 0);
  ok(`${label}: chapter headings carry a mandala`, (await p.locator('.jhead .jorn').count()) >= 8, `${await p.locator('.jhead .jorn').count()}`);
  // the "you are here" card follows the chapters as you scroll
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight * 0.55)); await p.waitForTimeout(700);
  ok(`${label}: the page remembers the chapter you are in`, Number(await p.locator('.jh-n').innerText()) >= 3, await p.locator('.jh-n').innerText());
  await p.evaluate(() => window.scrollTo(0, 1800)); await p.waitForTimeout(700);
  const reveal = await p.evaluate(() => ({ total: document.querySelectorAll('[data-reveal]').length, shown: document.querySelectorAll('[data-reveal].in').length }));
  ok(`${label}: things below the fold ease in as you reach them`, reveal.total > 5 && reveal.shown > 0, JSON.stringify(reveal));
  const wash = await p.locator('.jwash').evaluate(e => getComputedStyle(e).backgroundImage); ok(`${label}: the page takes on the colour of the hour`, /rgb/.test(wash), wash.slice(0, 60));
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(500); const w0 = await p.locator('.jwash').evaluate(e => e.style.getPropertyValue('--w1'));
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(700); const w1 = await p.locator('.jwash').evaluate(e => e.style.getPropertyValue('--w1'));
  ok(`${label}: that colour changes from the top of the page to the bottom`, w0 !== w1 && w0 && w1, `${w0} -> ${w1}`);
  await p.evaluate(() => window.scrollTo(0, 1800)); await p.waitForTimeout(500);
  await shot('mid');
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300); await p.evaluate(() => window.scrollTo(0, (Number(document.querySelector('.daypin')?.dataset.len) || 0) + 300)); await p.waitForTimeout(500);
  const par = await p.evaluate(() => Number(document.getElementById('day').style.getPropertyValue('--p'))); ok(`${label}: the opening's landscape drifts as you scroll away`, par > 0.15 && par <= 1, `--p ${par}`);
  // breathe
  ok(`${label}: the orb breathes (it is animated)`, await p.locator('.breathorb .bo-core').evaluate(e => getComputedStyle(e).animationName !== 'none'));
  await p.locator('.breathorb').click(); await p.waitForSelector('.jbreathe.open'); const seen = new Set();
  // Light & Scent starts unlit: a tap on the pill lights the candle (about 1.2s), then the words cycle 4 in, 6 out (see e2e/lightscent.mjs for the rest)
  await p.locator('.ls-light').click();
  for (let i = 0; i < 16; i++) { seen.add(await p.locator('#jbWord').innerText()); await p.waitForTimeout(700); }
  ok(`${label}: the breathing guide cycles in and out`, ['Breathe in', 'Breathe out'].every(w => seen.has(w)), [...seen].join(' / '));
  await shot('breathe'); await p.locator('.jb-close').click(); await p.waitForTimeout(700); ok(`${label}: Done closes the breathing screen`, (await p.locator('.jbreathe').count()) === 0);
  // ripple on a button
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300);
  const btn = p.locator('#dCta .btn').first(); await btn.scrollIntoViewIfNeeded(); const bb = await btn.boundingBox(); await p.mouse.move(bb.x + 20, bb.y + 20); await p.mouse.down(); await p.waitForTimeout(120);
  ok(`${label}: a button gives a soft ripple when pressed`, (await p.locator('.rip').count()) >= 1); await p.mouse.up();
  const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(`${label}: no sideways scroll`, o <= 1, `${o}`);
  // the chapter card belongs to the home page; the breathing orb is everywhere, once
  await p.goto(base + '/shop'); await p.waitForTimeout(600); ok(`${label}: the chapter card is removed on other pages`, (await p.locator('.jhere').count()) === 0 && (await p.locator('.jbar').count()) === 0);
  ok(`${label}: the breathing orb is on other pages too, just once`, (await p.locator('.breathorb').count()) === 1);
  await p.goto(base + '/'); await p.waitForSelector('.jhere', { state: 'attached' }); ok(`${label}: and the card comes back on the home page`, (await p.locator('.jhere').count()) === 1 && (await p.locator('.breathorb').count()) === 1);
  ok(`${label}: no JS errors`, errs.length === 0, errs.join('|'));
  await ctx.close();
}
{ // reduced motion: nothing is hidden waiting to animate
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  await p.goto(base + '/'); await p.waitForSelector('.breathorb'); await p.waitForTimeout(500);
  ok('reduced motion: no content is held back for reveal animations', (await p.locator('[data-reveal]').count()) === 0);
  ok('reduced motion: the orb stays still', await p.locator('.breathorb .bo-core').evaluate(e => getComputedStyle(e).animationName === 'none'));
  await ctx.close();
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
