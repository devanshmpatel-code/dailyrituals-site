import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  for (const r of ['/', '/shop', '/coaching', '/help']) {
    await p.goto(base + r); await p.waitForSelector('.treebg'); await p.waitForTimeout(900);
    const t = await p.evaluate(() => { const e = document.querySelector('.treebg'), cs = getComputedStyle(e); return { z: cs.zIndex, pe: cs.pointerEvents, leaves: e.querySelectorAll('.tb-leaves use').length, paths: e.querySelectorAll('path').length }; });
    ok(`${label}: ${r} has the tree of life behind the content`, t.z === '-1' && t.pe === 'none' && t.leaves > 80 && t.paths > 100, JSON.stringify(t));
  }
  await p.goto(base + '/help'); await p.waitForTimeout(900);
  const ty = () => p.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.treebg svg')).transform).f);
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500); const top = await ty();
  await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(700); const bottom = await ty();
  ok(`${label}: scrolling takes you from the canopy down to the roots`, bottom < top - 200, `${Math.round(top)} -> ${Math.round(bottom)}`);
  await p.goto(base + '/'); await p.waitForSelector('.jrail'); await p.waitForTimeout(900);
  const kinds = await p.evaluate(() => new Set([...document.querySelectorAll('.jhead > .jorn')].map(s => s.innerHTML.includes('ellipse') && !s.innerHTML.includes('translate') ? 'mandala' : s.innerHTML.includes('rotate(') && s.innerHTML.includes('translate(') ? 'leaf' : s.innerHTML.includes('r="9"') ? 'moons' : s.innerHTML.includes('r="22"') ? 'emblem' : 'lotus')).size);
  ok(`${label}: chapters use different symbols (not only the mandala)`, kinds >= 4, `${kinds} kinds`);
  ok(`${label}: a lotus divider sits above the footer`, (await p.locator('.lotusdiv').count()) === 1);
  await p.locator('[data-jbreathe]').click(); await p.waitForSelector('.jbreathe.open');
  ok(`${label}: the breathing screen has the tree growing behind the orb`, (await p.locator('.jbreathe .jb-tree svg').count()) === 1);
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(`${label}: no sideways scroll`, o <= 1, `${o}`);
  ok(`${label}: no JS errors`, errs.length === 0, errs.join('|'));
  await ctx.close();
}
{ const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  await p.goto(base + '/shop'); await p.waitForSelector('.treebg'); await p.waitForTimeout(500);
  ok('reduced motion: the tree does not sway', await p.evaluate(() => getComputedStyle(document.querySelector('.tb-leaves')).animationName === 'none')); await ctx.close(); }
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
