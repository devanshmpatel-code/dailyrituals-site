// The breathing pause: the original pause (the sky of the hour, the tree, in / hold / out for as long as you like) with a candle
// flame in place of the old circle. It grows on the in-breath, rests on hold and softens on the out-breath. No products.
// Behind it a Bodhi tree painted on canvas, lit by the candle: the lower crown brightens with the breath and recedes after.
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
// the mean brightness of a screenshot of one box of the page, read back through a canvas in the page itself
const lum = (p, png) => p.evaluate(async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return s / (d.length / 4); }, png.toString('base64'));
// the lower crown, above the flame: the flame and the room glow are hidden so only the tree is measured
const crownBox = p => p.evaluate(() => { const st = document.querySelector('.jbreathe .fb-stage'), r = st.getBoundingClientRect(), ay = r.top + r.height * 0.74, sy = ay * 0.86, hw = Math.min(innerWidth * 0.25, 300);
  st.style.visibility = 'hidden'; document.querySelector('.jbreathe .fb-glow').style.visibility = 'hidden';
  return { x: Math.round(r.left + r.width / 2 - hw), y: Math.round(ay - sy * 0.6), width: Math.round(hw * 2), height: Math.round(sy * 0.35) }; });
const flamePx = p => p.evaluate(() => { const c = document.querySelector('.jbreathe .fb-flame'); const g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4 * 7) if (d[i] > 200 && d[i - 3] > 230 && d[i - 2] > 170) n++; return n; });
for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const p = await (await b.newContext({ viewport: vp })).newPage(); p.setDefaultTimeout(9000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/coaching?breath=fast'); await p.waitForSelector('.breathorb'); await p.waitForTimeout(700);
  await p.locator('.breathorb').click(); await p.waitForSelector('.jbreathe.open');
  const dlg = await p.evaluate(() => { const e = document.querySelector('.jbreathe'); return [e.getAttribute('role'), e.getAttribute('aria-modal'), !!e.getAttribute('aria-label')]; });
  ok(`${label}: the orb opens a modal dialog with a name`, dlg[0] === 'dialog' && dlg[1] === 'true' && dlg[2], dlg.join(','));
  ok(`${label}: no circle orb, a flame canvas instead`, (await p.locator('.jbreathe .jb-orb').count()) === 0 && (await p.locator('.jbreathe canvas.fb-flame').count()) === 1);
  ok(`${label}: the Bodhi tree and the stars are behind it`, (await p.locator('.jbreathe .jb-tree canvas.fb-bodhi').count()) === 1 && (await p.locator('.jbreathe .fb-stars circle').count()) > 40);
  await p.waitForFunction(() => !!document.querySelector('.jbreathe .fb-bodhi')?.dataset.readyMs); // painted in slices over the first frames
  const tree = await p.evaluate(() => { const c = document.querySelector('.jbreathe .fb-bodhi'); if (!c.width) return { n: 0, t: 1, ms: NaN }; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0, t = 0; for (let i = 3; i < d.length; i += 4 * 97) { t++; if (d[i] > 40) n++; } return { n, t, ms: Number(c.dataset.buildMs) }; });
  ok(`${label}: the tree is painted: trunk, limbs and a full crown cover a good part of the sky`, tree.n / tree.t > 0.1, `${Math.round(100 * tree.n / tree.t)}% of samples`);
  ok(`${label}: the tree is laid out without holding up the opening`, tree.ms < 100, `longest frame of painting ${tree.ms} ms`);
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
  r.setDefaultTimeout(9000); const rb = await crownBox(r); await r.waitForTimeout(200); const s1 = await lum(r, await r.screenshot({ clip: rb })); await r.waitForTimeout(600); const s2 = await lum(r, await r.screenshot({ clip: rb }));
  ok(`${label}: reduced motion keeps the tree still and lit`, s1 > 12 && Math.abs(s1 - s2) < 0.5, `${s1.toFixed(2)} / ${s2.toFixed(2)}`);
  // the candle lights the tree: the lower crown is brighter at the top of the breath than late in the out-breath (real speed)
  const q = await (await b.newContext({ viewport: vp })).newPage(); q.setDefaultTimeout(15000); await setupMocks(q);
  await q.goto(base + '/coaching?moment=night'); await q.waitForSelector('.breathorb'); await q.locator('.breathorb').click(); await q.waitForSelector('.jbreathe.open');
  const qb = await crownBox(q);
  await q.waitForFunction(() => document.querySelector('.jbreathe')?.dataset.phase === 'Hold'); const atHold = await lum(q, await q.screenshot({ clip: qb }));
  await q.waitForFunction(() => document.querySelector('.jbreathe')?.dataset.phase === 'Breathe out'); await q.waitForTimeout(4600); const lateOut = await lum(q, await q.screenshot({ clip: qb }));
  ok(`${label}: the candle lifts the lower crown at the top of the breath and it recedes on the out-breath`, atHold > lateOut * 1.08, `${atHold.toFixed(1)} vs ${lateOut.toFixed(1)}`);
}
await b.close();
const failed = res.filter(x => !x).length; console.log(failed ? `${failed} FAILED` : 'ALL PASSED'); process.exit(failed ? 1 : 0);
