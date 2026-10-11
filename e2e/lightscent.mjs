// Light & Scent: the one-minute breathing pause (src/pages/lightscent.ts openBreathe, src/lightscent.css).
// "?breath=fast" shortens every timing tenfold (the hold takes 120ms, a breath one second, the minute six seconds);
// "?moment=night" pins the moment of the day so the pair is always Campfire Stories (a diffuser and a candle in the saved catalogue).
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
import fs from 'node:fs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const state = p => p.evaluate(() => { const e = document.querySelector('.jbreathe'); if (!e) return null; return { ...e.dataset, hold: Number(e.style.getPropertyValue('--hold') || 0), lit: Number(e.style.getPropertyValue('--lit') || 0), warm: Number(e.style.getPropertyValue('--warm') || 0), w: document.getElementById('jbWord')?.textContent ?? '', sub: document.getElementById('lsSub')?.textContent ?? '', done: e.classList.contains('done') }; });
const until = async (p, f, ms = 12000) => { const t0 = Date.now(); let s = null; while (Date.now() - t0 < ms) { s = await state(p); if (s && f(s)) return s; await p.waitForTimeout(25); } return null; };
/** The flame on the canvas: the pixel a little above the wick of the candle photograph (the loop puts the wick on the arch as --wx/--wy, and the flame height as --fh). */
const flamePixel = p => p.evaluate(() => { const fig = document.querySelector('.jbreathe .ls-arch.candle'), c = document.querySelector('.jbreathe .ls-fx'); const r = fig.getBoundingClientRect(), s = fig.style;
  const x = r.left + r.width * parseFloat(s.getPropertyValue('--wx')) / 100, fh = r.height * parseFloat(s.getPropertyValue('--fh')) / 100, y = r.top + r.height * parseFloat(s.getPropertyValue('--wy')) / 100 - fh * 0.45;
  const d = c.width / c.clientWidth, px = c.getContext('2d').getImageData(Math.round(x * d), Math.round(y * d), 1, 1).data; return [...px]; });
/** A fingerprint of what the canvas shows in the sky band (between the words and the arches). */
const skySample = p => p.evaluate(() => { const c = document.querySelector('.jbreathe .ls-fx'), g = c.getContext('2d'), top = document.querySelector('.jbreathe .ls-say').getBoundingClientRect().bottom, bot = document.querySelector('.jbreathe .ls-stage').getBoundingClientRect().top; const d = c.width / c.clientWidth;
  const img = g.getImageData(0, Math.round(top * d), c.width, Math.max(1, Math.round((bot - top - 4) * d))).data; let sum = 0, lit = 0; for (let i = 3; i < img.length; i += 4 * 13) { sum += img[i]; if (img[i] > 8) lit++; } return { sum, lit }; });
const products = JSON.parse(fs.readFileSync(new URL('./products.json', import.meta.url), 'utf8')).products;

for (const [label, vp] of [['desktop', { width: 1280, height: 800 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const imgReqs = []; p.on('request', r => { if (/\/img\/(studio\/|diffuser-)/.test(r.url())) imgReqs.push(r.url()); });
  await p.goto(base + '/coaching?moment=night&breath=fast'); await p.waitForSelector('.breathorb'); await p.waitForTimeout(700); imgReqs.length = 0;
  await p.locator('.breathorb').click(); await p.waitForSelector('.jbreathe.open');
  const dlg = await p.evaluate(() => { const e = document.querySelector('.jbreathe'); return [e.getAttribute('role'), e.getAttribute('aria-modal'), (e.getAttribute('aria-label') || '').length > 5]; });
  ok(`${label}: the orb opens a modal dialog with an accessible name`, dlg[0] === 'dialog' && dlg[1] === 'true' && dlg[2], dlg.join(','));
  await p.waitForSelector('.jbreathe .ls-arch.candle img.ok'); await p.waitForSelector('.jbreathe .ls-arch.diffuser img.ok');
  await p.waitForFunction(() => [...document.querySelectorAll('.jbreathe .ls-arch img')].every(i => Number(getComputedStyle(i).opacity) > 0.5));
  const pics = await p.evaluate(() => [...document.querySelectorAll('.jbreathe .ls-arch img')].map(i => ({ src: i.getAttribute('src'), w: i.naturalWidth, shown: Number(getComputedStyle(i).opacity) > 0.5 })));
  ok(`${label}: a real studio candle photograph sits in the left arch`, /^\/img\/studio\/[a-z-]+\.jpg$/.test(pics[0].src) && pics[0].w > 500 && pics[0].shown, JSON.stringify(pics[0]));
  ok(`${label}: the diffuser of the hour (Campfire Stories at night) sits in the right arch`, pics[1].src === '/img/diffuser-campfire-stories.jpg' && pics[1].w > 500 && pics[1].shown, JSON.stringify(pics[1]));
  ok(`${label}: only those two pictures are fetched`, imgReqs.length === 2, imgReqs.join(' '));
  const s0 = await state(p);
  ok(`${label}: it starts unlit, asking you to hold`, s0.state === 'unlit' && /hold to light/i.test(s0.w) && s0.lit === 0, `${s0.state} "${s0.w}"`);
  ok(`${label}: the page behind does not scroll while the pause is open`, await p.evaluate(() => getComputedStyle(document.documentElement).overflow === 'hidden'));
  // geometry: the arches sit side by side under the words, the whole thing on one screen
  const geo = await p.evaluate(() => { const a = document.querySelector('.jbreathe .ls-arch.candle').getBoundingClientRect(), d = document.querySelector('.jbreathe .ls-arch.diffuser').getBoundingClientRect(), w = document.querySelector('.jbreathe .ls-words').getBoundingClientRect(), f = document.querySelector('.jbreathe .ls-foot').getBoundingClientRect(); return { side: Math.abs(a.top - d.top) < 2 && a.right < d.left, under: w.bottom < a.top - 40, fits: f.bottom <= innerHeight + 1 && a.bottom < f.top, aw: Math.round(a.width) }; });
  ok(`${label}: the candle and the diffuser sit side by side below the words, and everything fits the screen`, geo.side && geo.under && geo.fits, JSON.stringify(geo));
  // the tap fallback: a single click lights it on its own (120ms in fast mode)
  await p.mouse.click(vp.width / 2, vp.height * 0.45);
  const litS = await until(p, s => s.state !== 'unlit', 3000);
  ok(`${label}: a single tap lights the candle`, !!litS, litS ? litS.state : 'still unlit');
  await until(p, s => s.state === 'breathing' && s.lit > 0.95, 4000); await p.waitForTimeout(80);
  const px = await flamePixel(p);
  ok(`${label}: the flame appears on the wick (a bright warm pixel above it)`, px[3] > 100 && px[0] > 170 && px[1] > 90 && px[0] >= px[2], `rgba(${px.join(',')})`);
  // the words, the scent (the canvas is drawing in the sky), the warmth on the out-breath
  const inS = await until(p, s => s.phase === 'in' && s.w === 'Breathe in' && s.sub === 'the scent', 3000);
  await p.waitForTimeout(120); const a1 = await skySample(p); await p.waitForTimeout(160); const a2 = await skySample(p); // two frames while the ribbon is under way
  ok(`${label}: on the in-breath the words read "Breathe in / the scent"`, !!inS, JSON.stringify(inS && [inS.w, inS.sub]));
  ok(`${label}: the scent canvas is drawing in the sky (pixels change between frames)`, Math.max(a1.lit, a2.lit) > 20 && a1.sum !== a2.sum, `${a1.lit}/${a2.lit} lit samples, sums ${a1.sum} -> ${a2.sum}`);
  const outS = await until(p, s => s.phase === 'out' && s.w === 'Breathe out' && s.sub === 'into the light' && s.warm > 0.5, 3000);
  ok(`${label}: on the out-breath the words read "Breathe out / into the light" and the scene warms`, !!outS, JSON.stringify(outS && [outS.w, outS.sub, outS.warm]));
  const ring = await p.evaluate(() => ({ n: document.getElementById('lsRingN').textContent, off: Number(document.querySelector('.jbreathe .ls-ring .fg').style.strokeDashoffset), eyebrow: document.getElementById('lsEyebrow').textContent }));
  ok(`${label}: the ring shows the breath and the eyebrow counts it`, /^[1-6]$/.test(ring.n) && ring.off >= 0 && ring.off <= 1 && /^Breath [1-6] of 6$/.test(ring.eyebrow), JSON.stringify(ring));
  // six breath stars, then the constellation
  const starsSeen = new Set(); await until(p, s => { starsSeen.add(Number(s.stars || 0)); return s.done; }, 12000);
  const stars = await p.evaluate(() => ({ on: document.querySelectorAll('.jbreathe .ls-star.on').length, drawn: document.querySelector('.jbreathe .ls-const').classList.contains('drawn') }));
  ok(`${label}: each breath leaves a star, and six breaths make a constellation`, starsSeen.size >= 4 && stars.on === 6 && stars.drawn, `${[...starsSeen].sort((a, b) => a - b).join(',')} -> ${stars.on} on, drawn ${stars.drawn}`);
  // the ending: the pair from the live catalogue
  await p.waitForSelector('.jbreathe .ls-end:not([hidden])'); await p.waitForTimeout(600);
  const card = await p.locator('.jbreathe .ls-card').innerText();
  ok(`${label}: the card reads "Light & scent / One for the light, one for the scent"`, /light & scent/i.test(card) && /one for the light, one for the scent/i.test(card), card.slice(0, 80).replace(/\n/g, ' '));
  ok(`${label}: it names the real pair`, /Campfire Stories candle \+ Campfire Stories Mini Diffuser/.test(card), card.match(/Campfire[^\n]*/)?.[0]);
  const addTxt = await p.locator('.jbreathe .ls-add').innerText();
  ok(`${label}: "Add the pair" carries the catalogue price`, /^Add the pair · \$27\.00$/.test(addTxt), addTxt);
  ok(`${label}: focus moves to the primary action when the card appears`, await p.evaluate(() => document.activeElement?.classList.contains('ls-primary')));
  const geo2 = await p.evaluate(() => { const a = document.querySelector('.jbreathe .ls-arch.candle').getBoundingClientRect(), c = document.querySelector('.jbreathe .ls-card').getBoundingClientRect(); return { top: Math.round(a.top), gap: Math.round(c.top - a.bottom), fits: c.bottom <= innerHeight }; });
  ok(`${label}: the arches lift to the top and the card sits beneath them`, geo2.top < vp.height * 0.2 && geo2.gap > 0 && geo2.fits, JSON.stringify(geo2));
  const cartCount = () => p.evaluate(() => Number(document.getElementById('cartCount').textContent)); // the header does not paint while the pause is open
  const before = await cartCount();
  await p.locator('.jbreathe .ls-add').click(); await p.waitForTimeout(500);
  const after = await cartCount();
  const lines = await p.evaluate(() => JSON.parse(localStorage.getItem('dr_cart') || '[]').map(l => l.slug));
  ok(`${label}: "Add the pair" adds exactly the two catalogue products`, after === before + 2 && lines.includes('campfire-stories') && lines.includes('campfire-stories-mini-diffuser'), `${before} -> ${after}: ${lines.join(', ')}`);
  ok(`${label}: and says so`, /in your cart/i.test(await p.locator('.jbreathe .ls-add').innerText()) && await p.locator('.jbreathe .ls-add').isDisabled());
  const hrefs = await p.locator('.jbreathe .ls-card a').evaluateAll(a => a.map(x => x.getAttribute('href')));
  ok(`${label}: the only link out is Claire's free reset (the candle is in the pair already)`, hrefs.length === 1 && /\/reset$/.test(hrefs[0]), hrefs.join(' '));
  ok(`${label}: nothing from the studio archive is offered, and no health claims`, !/past pour|moon|anxiety|stress relief|heal|calms|crystal/i.test(card + await p.locator('.jbreathe').innerText()));
  // focus stays inside while open
  for (let i = 0; i < 6; i++) await p.keyboard.press('Tab');
  ok(`${label}: Tab keeps focus inside the pause`, await p.evaluate(() => !!document.activeElement?.closest('.jbreathe')));
  await p.keyboard.press('Shift+Tab'); await p.keyboard.press('Shift+Tab');
  ok(`${label}: Shift+Tab too`, await p.evaluate(() => !!document.activeElement?.closest('.jbreathe')));
  // breathe again restarts the breaths with the candle still lit
  await p.locator('.jbreathe .ls-again').click(); await p.waitForTimeout(150);
  const againS = await state(p);
  ok(`${label}: "Breathe again" starts a new round with the candle still lit`, againS && !againS.done && againS.state !== 'unlit' && againS.stars === '0' && (await p.locator('.jbreathe .ls-end').evaluate(e => e.hidden)), JSON.stringify(againS));
  // Escape closes and returns focus to the orb
  await p.keyboard.press('Escape'); await p.waitForSelector('.jbreathe', { state: 'detached', timeout: 3000 }).catch(() => {});
  ok(`${label}: Escape closes the pause`, (await p.locator('.jbreathe').count()) === 0);
  ok(`${label}: and focus returns to the orb`, await p.evaluate(() => document.activeElement?.classList.contains('breathorb')));
  ok(`${label}: the page scrolls again and is visible`, await p.evaluate(() => getComputedStyle(document.documentElement).overflow !== 'hidden' && getComputedStyle(document.querySelector('main')).visibility === 'visible'));
  ok(`${label}: the header shows the pair in the cart`, Number(await p.locator('#cartCount').innerText()) === after, await p.locator('#cartCount').innerText());
  // a link out of the card closes the pause and goes where it says
  await p.locator('.breathorb').click(); await p.waitForSelector('.jbreathe.open'); await p.mouse.click(vp.width / 2, vp.height * 0.45);
  await p.waitForSelector('.jbreathe .ls-end:not([hidden])', { timeout: 15000 }); await p.locator('.jbreathe .ls-card a[href$="/reset"]').click(); await p.waitForURL(/\/reset/, { timeout: 6000 }).catch(() => {}); await p.waitForTimeout(500);
  ok(`${label}: the reset link opens Claire's free 7-day reset`, /\/reset/.test(p.url()) && (await p.locator('.jbreathe').count()) === 0, p.url());
  ok(`${label}: no sideways scroll`, (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
  ok(`${label}: no JS errors`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}
{ // the catalogue has the diffuser but no candle of the mood: the diffuser alone is offered, with a link to the candle range
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const noCandles = products.filter(x => /roller|diffuser|deodorant/i.test(x.name));
  await p.route(/wixapis\.com.*\/stores\/v3\/products\/query/, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ products: noCandles, pagingMetadata: { count: noCandles.length, hasNext: false } }) }));
  await p.goto(base + '/coaching?moment=night&breath=fast'); await p.waitForSelector('.breathorb'); await p.waitForTimeout(600);
  await p.locator('.breathorb').click(); await p.waitForSelector('.jbreathe.open'); await p.mouse.click(640, 360);
  await p.waitForSelector('.jbreathe .ls-end:not([hidden])', { timeout: 15000 }); await p.waitForTimeout(400);
  const addTxt = await p.locator('.jbreathe .ls-add').innerText(); const hrefs = await p.locator('.jbreathe .ls-card a').evaluateAll(a => a.map(x => x.getAttribute('href')));
  ok('no candle in the catalogue: the button offers the diffuser alone, at its price', /^Add the diffuser · \$15\.00$/.test(addTxt), addTxt);
  ok('no candle in the catalogue: "See the candles" leads to the candle range', hrefs.some(h => /\/shop\?f=candle$/.test(h)) && hrefs.some(h => /\/reset$/.test(h)), hrefs.join(' '));
  const cc = () => p.evaluate(() => Number(document.getElementById('cartCount').textContent)); const before = await cc(); await p.locator('.jbreathe .ls-add').click(); await p.waitForTimeout(400);
  ok('no candle in the catalogue: adding puts one product in the cart', (await cc()) === before + 1, `${before} -> ${await cc()}`);
  await p.keyboard.press('Escape'); await ctx.close();
}
{ // real timing: the hold takes about 1.2 seconds, letting go early lets the match go out, Space works too, and a breath is 4 in
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  await p.goto(base + '/coaching?moment=night'); await p.waitForSelector('.breathorb'); await p.waitForTimeout(600); await p.locator('.breathorb').click(); await p.waitForSelector('.jbreathe.open'); await p.waitForTimeout(300);
  await p.mouse.move(640, 360); await p.mouse.down(); await p.waitForTimeout(500); const mid = await state(p); await p.mouse.up(); await p.waitForTimeout(700); const dropped = await state(p);
  ok('real timing: half a second of holding is not enough, and the match ebbs when you let go', mid.state === 'unlit' && mid.hold > 0.25 && mid.hold < 0.75 && dropped.state === 'unlit' && dropped.hold < mid.hold, `hold ${mid.hold} -> ${dropped.hold}`);
  await p.keyboard.down('Space'); const t0 = Date.now(); const litS = await until(p, s => s.state !== 'unlit', 4000); const tLit = Date.now() - t0; await p.keyboard.up('Space');
  ok('real timing: holding Space lights the candle after about 1.2 seconds', !!litS && tLit > 800 && tLit < 2200, `${tLit}ms`);
  const s1 = await until(p, s => s.phase === 'in', 5000); const t1 = Date.now(); const s2 = await until(p, s => s.phase === 'out', 8000); const t2 = Date.now();
  ok('real timing: the in-breath lasts about four seconds', !!s1 && !!s2 && t2 - t1 > 3300 && t2 - t1 < 5000, `${t2 - t1}ms in`);
  await p.keyboard.press('Escape'); await ctx.close();
}
{ // reduced motion: it lights at once, a steady flame, no particles in the sky, the words still cycle and the ending is reachable
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/coaching?moment=night&breath=fast'); await p.waitForSelector('.breathorb'); await p.waitForTimeout(600); await p.locator('.breathorb').click(); await p.waitForSelector('.jbreathe.open'); await p.waitForSelector('.jbreathe .ls-arch.candle img.ok');
  await p.mouse.click(640, 360); await p.waitForTimeout(150); const s0 = await state(p);
  ok('reduced motion: a tap lights the candle at once', s0.state !== 'unlit' && s0.lit === 1, JSON.stringify([s0.state, s0.lit]));
  await until(p, s => s.phase === 'in', 3000); await p.waitForTimeout(200);
  const px1 = await flamePixel(p); const sky = await skySample(p); await p.waitForTimeout(200); const px2 = await flamePixel(p);
  const warmPx = px => px[3] > 100 && px[0] > 170 && px[1] > 90;
  ok('reduced motion: a steady flame (lit in both samples, no particles in the sky)', warmPx(px1) && warmPx(px2) && sky.lit === 0, `${px1.join()} / ${px2.join()}, sky ${sky.lit}`);
  const still = await p.evaluate(() => ({ star: getComputedStyle(document.querySelector('.jbreathe .ls-sky .tw')).animationName }));
  ok('reduced motion: the stars do not twinkle', still.star === 'none', JSON.stringify(still));
  const seen = new Set(); for (let i = 0; i < 40; i++) { seen.add((await state(p))?.w); await p.waitForTimeout(60); }
  ok('reduced motion: the words still cycle in and out', seen.has('Breathe in') && seen.has('Breathe out'), [...seen].join(' / '));
  await p.waitForSelector('.jbreathe .ls-end:not([hidden])', { timeout: 15000 });
  ok('reduced motion: the ending is reachable', (await p.locator('.jbreathe .ls-add').count()) === 1);
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok('reduced motion: Escape closes at once', (await p.locator('.jbreathe').count()) === 0);
  ok('reduced motion: no JS errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
