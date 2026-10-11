// The breathing pause: the original pause (the sky of the hour, the tree, in / hold / out for as long as you like) with a candle
// flame in place of the old circle. It grows on the in-breath, rests on hold and softens on the out-breath. No products.
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const flamePx = p => p.evaluate(() => { const c = document.querySelector('.jbreathe .fb-flame'); const g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4 * 7) if (d[i] > 200 && d[i - 3] > 230 && d[i - 2] > 170) n++; return n; });
for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const p = await (await b.newContext({ viewport: vp })).newPage(); p.setDefaultTimeout(9000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/coaching?breath=fast'); await p.waitForSelector('.breathorb'); await p.waitForTimeout(700);
  await p.locator('.breathorb').click(); await p.waitForSelector('.jbreathe.open');
  const dlg = await p.evaluate(() => { const e = document.querySelector('.jbreathe'); return [e.getAttribute('role'), e.getAttribute('aria-modal'), !!e.getAttribute('aria-label')]; });
  ok(`${label}: the orb opens a modal dialog with a name`, dlg[0] === 'dialog' && dlg[1] === 'true' && dlg[2], dlg.join(','));
  ok(`${label}: no circle orb, a flame canvas instead`, (await p.locator('.jbreathe .jb-orb').count()) === 0 && (await p.locator('.jbreathe canvas.fb-flame').count()) === 1);
  ok(`${label}: the tree and the stars are behind it`, (await p.locator('.jbreathe .jb-tree svg').count()) === 1 && (await p.locator('.jbreathe .fb-stars circle').count()) > 40);
  ok(`${label}: no products, prices or cart buttons`, await p.evaluate(() => { const e = document.querySelector('.jbreathe'); return !/\$\d|add to|cart|shop/i.test(e.innerText) && !e.querySelector('img, a[href*="product"], a[href*="shop"]'); }));
  // phases and the flame's size: bigger at the top of the in-breath than at the end of the out-breath
  const seen = new Set(); let big = 0, small = 1e9;
  for (let i = 0; i < 60; i++) { const ph = await p.evaluate(() => document.querySelector('.jbreathe').dataset.phase); seen.add(ph); const n = await flamePx(p); if (ph === 'Hold') big = Math.max(big, n); if (ph === 'Breathe out') small = Math.min(small, n); await p.waitForTimeout(60); }
  ok(`${label}: the words cycle in, hold, out`, ['Breathe in', 'Hold', 'Breathe out'].every(w => seen.has(w)), [...seen].join(' / '));
  ok(`${label}: the flame is drawn and lit`, big > 20, `${big} bright samples at hold`);
  ok(`${label}: the flame grows with the in-breath and softens on the out-breath`, big > small * 1.3, `${big} vs ${small}`);
  ok(`${label}: the glow in the room follows the breath`, await p.evaluate(() => Number(getComputedStyle(document.querySelector('.fb-glow')).opacity) > 0.3));
  ok(`${label}: the sub line keeps the original words`, /Stay as long as you like/.test(await p.locator('.jbreathe .jb-sub').innerText()));
  ok(`${label}: Done has focus`, await p.evaluate(() => document.activeElement?.classList.contains('jb-close')));
  await p.keyboard.press('Tab'); ok(`${label}: focus stays inside`, await p.evaluate(() => !!document.activeElement?.closest('.jbreathe')));
  await p.keyboard.press('Escape'); await p.waitForTimeout(600);
  ok(`${label}: Esc closes and returns focus to the orb`, (await p.locator('.jbreathe').count()) === 0 && await p.evaluate(() => document.activeElement?.classList.contains('breathorb')));
  const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(`${label}: no sideways scroll`, o <= 1, `${o}`);
  ok(`${label}: no JS errors`, errs.length === 0, errs.join('|'));
  // reduced motion: a steady flame, words still cycle
  const r = await (await b.newContext({ viewport: vp, reducedMotion: 'reduce' })).newPage(); await setupMocks(r);
  await r.goto(base + '/coaching?breath=fast'); await r.waitForSelector('.breathorb'); await r.locator('.breathorb').click(); await r.waitForSelector('.jbreathe.open'); await r.waitForTimeout(1500);
  const a = await flamePx(r); await r.waitForTimeout(300); const c2 = await flamePx(r);
  ok(`${label}: reduced motion keeps a steady, lit flame`, a > 20 && Math.abs(a - c2) <= Math.max(3, a * 0.05), `${a} / ${c2}`);
}
await b.close();
const failed = res.filter(x => !x).length; console.log(failed ? `${failed} FAILED` : 'ALL PASSED'); process.exit(failed ? 1 : 0);
