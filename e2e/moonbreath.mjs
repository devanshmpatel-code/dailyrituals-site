// The Moon Breath: the one-minute breathing pause (src/pages/journey.ts openBreathe, src/moonbreath.css).
// "?breath=fast" shortens every timing tenfold so one cycle takes about six seconds instead of a minute.
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const state = p => p.evaluate(() => { const e = document.querySelector('.jbreathe'); if (!e) return null; const s = e.querySelector('.mb-stage').style; return { k: Number(s.getPropertyValue('--k')), fl: Number(s.getPropertyValue('--fl')), w: document.getElementById('jbWord')?.textContent ?? '', lit: e.querySelectorAll(':scope > .mb-phases .mp.on').length, done: e.classList.contains('done') }; });
const lits = new Set(); // every count of lit phase marks seen while polling
const until = async (p, f, ms = 12000) => { const t0 = Date.now(); let s = null; while (Date.now() - t0 < ms) { s = await state(p); if (s) lits.add(s.lit); if (s && f(s)) return s; await p.waitForTimeout(25); } return null; };
for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const moonReqs = []; p.on('request', r => { if (/\/img\/studio\/moons\//.test(r.url())) moonReqs.push(r.url()); }); lits.clear();
  await p.goto(base + '/?breath=fast'); await p.waitForSelector('.breathorb'); await p.waitForTimeout(700);
  await p.locator('.breathorb').click(); await p.waitForSelector('.jbreathe.open');
  const dlg = await p.evaluate(() => { const e = document.querySelector('.jbreathe'); return [e.getAttribute('role'), e.getAttribute('aria-modal'), (e.getAttribute('aria-label') || '').length > 5]; });
  ok(`${label}: the orb opens a modal dialog with an accessible name`, dlg[0] === 'dialog' && dlg[1] === 'true' && dlg[2], dlg.join(','));
  await p.waitForSelector('.jbreathe .mb-img.ok'); await p.waitForFunction(() => Number(getComputedStyle(document.querySelector('.jbreathe .mb-img')).opacity) > 0.5);
  const im = await p.locator('.jbreathe .mb-img').evaluate(i => ({ src: i.getAttribute('src'), w: i.naturalWidth, shown: Number(getComputedStyle(i).opacity) > 0.5 }));
  ok(`${label}: a real candle moon is loaded at the centre`, /\/img\/studio\/moons\/[a-z-]+\.webp$/.test(im.src) && im.w > 100 && im.shown, JSON.stringify(im));
  ok(`${label}: only the chosen moon is fetched`, moonReqs.length === 1, `${moonReqs.length} requests`);
  ok(`${label}: the eyebrow names the candle`, /·\s*one moon, one minute/i.test(await p.locator('#mbEyebrow').innerText()), await p.locator('#mbEyebrow').innerText());
  const first = await p.locator('.jbreathe').getAttribute('data-moon');
  ok(`${label}: the page behind does not scroll while the pause is open`, await p.evaluate(() => getComputedStyle(document.documentElement).overflow === 'hidden'));
  // in: the shadow slides away (the moon waxes); at full the flame lights; out: it slides back
  const midIn = await until(p, s => s.w === 'Breathe in' && s.k > 0.3 && s.k < 0.95);
  const full = await until(p, s => s.fl > 0.9 && s.k > 0.97);
  const flame = full && await p.locator('.jbreathe .mb-fl').evaluate(e => Number(getComputedStyle(e).opacity));
  const shadowFull = full && await p.locator('.jbreathe .mb-shadow').evaluate(e => new DOMMatrix(getComputedStyle(e).transform).e);
  const out = await until(p, s => s.w === 'Breathe out' && s.k < 0.6 && s.k > 0.05);
  const shadowOut = out && await p.locator('.jbreathe .mb-shadow').evaluate(e => new DOMMatrix(getComputedStyle(e).transform).e);
  const dir = Number(await p.locator('.jbreathe .mb-stage').evaluate(e => e.style.getPropertyValue('--dir') || 1)); // some crescents sit on the left rim
  ok(`${label}: the words say Breathe in, then Breathe out`, !!midIn && !!out);
  ok(`${label}: the moon waxes on the in-breath`, !!midIn && midIn.k > 0.3, midIn ? `k=${midIn.k}` : 'no mid-in frame');
  ok(`${label}: the flame appears at full`, !!full && flame > 0.9, `flame opacity ${flame}`);
  ok(`${label}: the shadow slides back on the out-breath`, !!out && (shadowOut - shadowFull) * dir > 20, `${Math.round(shadowFull)} -> ${Math.round(shadowOut)}`);
  const lit0 = (await state(p)).lit; await until(p, s => s.lit > lit0 || s.done, 6000);
  ok(`${label}: the phase marks advance through the cycle`, lits.size >= 2 && Math.max(...lits) > Math.min(...lits), [...lits].sort((a, b) => a - b).join(','));
  // another moon swaps the picture (and loads only that one)
  await p.locator('.mb-another').click(); await p.waitForFunction(f => document.querySelector('.jbreathe')?.dataset.moon !== f, first); await p.waitForSelector('.jbreathe .mb-img.ok');
  const second = await p.locator('.jbreathe').getAttribute('data-moon'); const src2 = await p.locator('.jbreathe .mb-img').getAttribute('src');
  ok(`${label}: "Another moon" swaps to a different candle`, second !== first && src2.includes(second), `${first} -> ${second}`);
  ok(`${label}: the swap fetched one more image only`, moonReqs.length === 2, `${moonReqs.length}`);
  // the ending after six breaths
  await p.waitForSelector('.jbreathe .mb-end:not([hidden])', { timeout: 15000 }); await p.waitForTimeout(300);
  const card = await p.locator('.jbreathe .mb-end').innerText();
  ok(`${label}: the ending card reads "One moon, one minute" and names the candle`, /one moon, one minute/i.test(card) && (await p.locator('.mb-end h2').innerText()).length > 2, card.slice(0, 60).replace(/\n/g, ' '));
  const hrefs = await p.locator('.mb-end a').evaluateAll(a => a.map(x => x.getAttribute('href')));
  ok(`${label}: links go to the candle range, past moons and the free reset`, hrefs.length === 3 && /\/shop\?f=candle$/.test(hrefs[0]) && /\/drops$/.test(hrefs[1]) && /\/reset$/.test(hrefs[2]), hrefs.join(' '));
  ok(`${label}: the card never offers the past pour for sale`, !/add to cart|\$\d|buy now|shop this/i.test(card));
  ok(`${label}: no health or crystal claims`, !/anxiety|stress relief|heal|calms your|crystal|soy/i.test(card + await p.locator('.jbreathe > .mb-text').innerText()));
  ok(`${label}: focus moves to the primary link when the card appears`, await p.evaluate(() => document.activeElement?.classList.contains('mb-primary')));
  // focus stays inside while open
  for (let i = 0; i < 8; i++) await p.keyboard.press('Tab');
  ok(`${label}: Tab keeps focus inside the pause`, await p.evaluate(() => !!document.activeElement?.closest('.jbreathe')));
  await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Shift+Tab');
  ok(`${label}: Shift+Tab too`, await p.evaluate(() => !!document.activeElement?.closest('.jbreathe')));
  // breathe again restarts the cycle
  await p.locator('.mb-again').click(); await p.waitForTimeout(200);
  ok(`${label}: "Breathe again" starts a new cycle`, await p.evaluate(() => document.querySelector('.mb-end').hidden && !document.querySelector('.jbreathe').classList.contains('done')));
  // Escape closes and returns focus to the orb
  await p.keyboard.press('Escape'); await p.waitForSelector('.jbreathe', { state: 'detached', timeout: 3000 }).catch(() => {});
  ok(`${label}: Escape closes the pause`, (await p.locator('.jbreathe').count()) === 0);
  ok(`${label}: and focus returns to the orb`, await p.evaluate(() => document.activeElement?.classList.contains('breathorb')));
  ok(`${label}: the page scrolls again`, await p.evaluate(() => getComputedStyle(document.documentElement).overflow !== 'hidden'));
  // a link out of the card closes the pause and goes where it says
  await p.locator('.breathorb').click(); await p.waitForSelector('.jbreathe .mb-end:not([hidden])', { timeout: 15000 }); await p.locator('.mb-end .mb-primary').click(); await p.waitForURL(/\/shop\?f=candle/, { timeout: 6000 }).catch(() => {}); await p.waitForTimeout(500);
  ok(`${label}: "See the candles" opens the candle range`, /\/shop\?f=candle/.test(p.url()) && (await p.locator('.jbreathe').count()) === 0, p.url());
  ok(`${label}: no sideways scroll`, (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
  ok(`${label}: no JS errors`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}
{ // real timing: the first in-breath takes about four seconds, and nothing jumps
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  await p.goto(base + '/'); await p.waitForSelector('.breathorb'); await p.waitForTimeout(600); await p.locator('.breathorb').click(); await p.waitForSelector('.jbreathe.open');
  const t0 = Date.now(); const s1 = await until(p, s => s.w === 'Breathe in'); const t1 = Date.now(); const s2 = await until(p, s => s.w === 'Breathe out'); const t2 = Date.now();
  ok('real timing: the in-breath lasts about four seconds', !!s1 && !!s2 && t2 - t1 > 3200 && t2 - t1 < 5200, `${t1 - t0}ms lead, ${t2 - t1}ms in`);
  await p.keyboard.press('Escape'); await ctx.close();
}
{ // reduced motion: a still full moon, a steady flame, the words still change and the ending is reachable
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/?breath=fast'); await p.waitForSelector('.breathorb'); await p.waitForTimeout(600); await p.locator('.breathorb').click(); await p.waitForSelector('.jbreathe.open'); await p.waitForSelector('.jbreathe .mb-img.ok');
  const still = await p.evaluate(() => { const e = document.querySelector('.jbreathe'); return { shadow: getComputedStyle(e.querySelector('.mb-shadow')).display, flame: getComputedStyle(e.querySelector('.mb-fl')).animationName, flOp: Number(getComputedStyle(e.querySelector('.mb-fl')).opacity), star: getComputedStyle(e.querySelector('.mb-sky .tw')).animationName, inline: e.style.getPropertyValue('--k') }; });
  ok('reduced motion: no shadow slides and nothing flickers', still.shadow === 'none' && still.flame === 'none' && still.star === 'none' && still.inline === '', JSON.stringify(still));
  ok('reduced motion: the moon is full with a steady flame', still.flOp > 0.9, `flame ${still.flOp}`);
  const seen = new Set(); for (let i = 0; i < 40; i++) { seen.add((await state(p))?.w); await p.waitForTimeout(60); }
  ok('reduced motion: the words still cycle in and out', seen.has('Breathe in') && seen.has('Breathe out'), [...seen].join(' / '));
  await p.waitForSelector('.jbreathe .mb-end:not([hidden])', { timeout: 15000 });
  ok('reduced motion: the ending is reachable', (await p.locator('.mb-end a').count()) === 3);
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok('reduced motion: Escape closes at once', (await p.locator('.jbreathe').count()) === 0);
  ok('reduced motion: no JS errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
