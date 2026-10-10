import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const settle = async p => { await p.waitForTimeout(400); let last = -1, same = 0; for (let i = 0; i < 40 && same < 2; i++) { const y = await p.evaluate(() => window.scrollY); same = y === last ? same + 1 : 0; last = y; await p.waitForTimeout(200); } };
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
for (const [label, vp, rm] of [['desktop', { width: 1280, height: 900 }, false], ['mobile', { width: 390, height: 780 }, false], ['reduced motion', { width: 1280, height: 900 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, reducedMotion: rm ? 'reduce' : 'no-preference' }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  await p.goto('http://localhost:4173/#/'); await p.waitForSelector('.jhere', { state: 'attached' }); await p.waitForTimeout(600);
  ok(`${label}: no "you are here" card on the opening`, !(await p.locator('.jhere.on').count()));
  const n = await p.locator('.jstop').count();
  for (const k of [2, 5, n - 1]) {
    await p.locator(`[data-stop="${k}"]`).evaluate(e => e.click()); await settle(p);
    const num = Number(await p.locator('.jh-n').innerText()); const now = await p.evaluate(() => [...document.querySelectorAll('.jstop')].findIndex(s => s.classList.contains('now')));
    ok(`${label}: card number ${num} matches the rail stop ${now} (stop ${k})`, num === now && num === k, `${num}/${now}`);
    ok(`${label}: card is visible on stop ${k}`, await p.locator('.jhere.on').count() === 1);
    const top = await p.evaluate(() => { const m = document.querySelector('.jmark').getBoundingClientRect(), s = document.querySelectorAll('.jstop')[Number(document.querySelector('.jh-n').textContent)].getBoundingClientRect(); return Math.round(m.top - s.top); });
    if (label === 'desktop') ok(`${label}: the sun marker sits within a stop's reach of the stop (${top}px)`, Math.abs(top) < 90, `${top}`);
  }
  await p.locator('[data-stop="2"]').evaluate(e => e.click()); await settle(p);
  const txt = await p.locator('.jhere').innerText();
  await p.locator('.jhere').click(); await settle(p);
  ok(`${label}: tapping the card goes to the next chapter`, Number(await p.locator('.jh-n').innerText()) === 3, txt.replace(/\s+/g, ' '));
  const w = await p.evaluate(() => { const r = document.querySelector('.jhere').getBoundingClientRect(); return [r.left >= 0, r.right <= innerWidth, r.bottom <= innerHeight]; }); ok(`${label}: the card fits on screen`, w.every(Boolean), w.join());
  ok(`${label}: no sideways scroll`, (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
  if (rm) ok('reduced motion: colour blobs do not drift', await p.evaluate(() => getComputedStyle(document.querySelector('.jaur i')).animationName === 'none'));
  else ok(`${label}: colour blobs drift`, await p.evaluate(() => getComputedStyle(document.querySelector('.jaur i')).animationName !== 'none'));
  await p.goto('http://localhost:4173/#/shop'); await p.waitForTimeout(800);
  ok(`${label}: card and blobs are removed on other pages`, (await p.locator('.jhere, .jaur').count()) === 0);
  await ctx.close();
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
