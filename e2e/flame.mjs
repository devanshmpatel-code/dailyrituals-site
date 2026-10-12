// The breathing pause: choose your candle under a night sky, light it, breathe with it.
// Opened by the breathing orb. Stage 1 is a carousel of the shop's real candles (only Cabana and Verdant have photographs),
// unlit, with the live price and Add to cart; the breath already keeps its pace at the top. "Light it & breathe" lights the
// wooden wicks (canvas flames on the wicks, the lit glass fading in) and the in / hold / out cycle begins again with the
// candle: the scene comes to life on the in-breath and cools on the out-breath. After three breaths a quiet offer appears.
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
import { readFileSync } from 'node:fs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const products = JSON.parse(readFileSync(new URL('./products.json', import.meta.url), 'utf8')).products;
const money = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', currencyDisplay: 'narrowSymbol' }).format(n);
// every price the pause may show: the two candles' and their rollers' prices from the catalogue, nothing else
const allowed = new Set(products.filter(p => /^(cabana|verdant)(-fragrance-roller)?$/.test(p.slug)).flatMap(p => [p.actualPriceRange.minValue.amount, p.actualPriceRange.maxValue.amount]).map(a => money(Number(a))));
// the mean brightness of a screenshot, read back through a canvas in the page itself
const lum = (p, png) => p.evaluate(async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return s / (d.length / 4); }, png.toString('base64'));
// the flames' bright pixels: only above each wick (data-base: the flame's base in CSS px of its canvas)
const flamePx = p => p.evaluate(() => { let n = 0; for (const c of document.querySelectorAll('.jbreathe canvas.fb-flame')) { const [, by] = c.dataset.base.split(',').map(Number), top = Math.floor(by * c.width / c.clientWidth); const d = c.getContext('2d').getImageData(0, 0, c.width, top).data; for (let i = 3; i < d.length; i += 4 * 3) if (d[i] > 200 && d[i - 3] > 230 && d[i - 2] > 170) n++; } return n; });
// where the bright pixels are: their middle over the wick, the lowest of them just above it (in flame heights)
const onWick = p => p.evaluate(() => [...document.querySelectorAll('.jbreathe canvas.fb-flame')].map(c => {
  const s = c.width / c.clientWidth, [bx, by] = c.dataset.base.split(',').map(Number), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let sx = 0, n = 0, low = 0, top = 1e9;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const i = (y * c.width + x) * 4; if (d[i + 3] > 200 && d[i] > 230 && d[i + 1] > 170) { sx += x; n++; low = Math.max(low, y); top = Math.min(top, y); } }
  const h = (low - top) / s || 1; return { n, off: n ? Math.abs(sx / n / s - bx) / h : 99, gap: n ? (by - low / s) / h : 99 };
}));
const open = async (p, q = '?breath=fast') => { await p.goto(base + '/coaching' + q); await p.waitForSelector('.breathorb'); await p.waitForTimeout(500); await p.locator('.breathorb').click(); await p.waitForSelector('.jbreathe.open'); };
const sel = p => p.evaluate(() => [document.querySelector('.fb-c[aria-pressed="true"]')?.dataset.slug, document.querySelector('.fb-name')?.textContent]);
const countAudio = () => { window.__audio = 0; const A = window.AudioContext; window.AudioContext = class extends A { constructor(...a) { super(...a); window.__audio++; } }; };

for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: label === 'mobile' }); await ctx.addInitScript(countAudio);
  const p = await ctx.newPage(); p.setDefaultTimeout(12000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await open(p);
  const dlg = await p.evaluate(() => { const e = document.querySelector('.jbreathe'); return [e.getAttribute('role'), e.getAttribute('aria-modal'), !!e.getAttribute('aria-label'), e.dataset.stage]; });
  ok(`${label}: the orb opens a modal dialog with a name, on the candle picker`, dlg[0] === 'dialog' && dlg[1] === 'true' && dlg[2] && dlg[3] === 'pick', dlg.join(','));
  const sky = await p.evaluate(() => { const c = document.querySelector('.jbreathe .fb-stars'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return { n, tw: document.querySelectorAll('.jbreathe .fb-tw i').length, anim: getComputedStyle(document.querySelector('.fb-tw i')).animationName, drift: getComputedStyle(document.querySelector('.fb-drift')).animationName }; });
  ok(`${label}: a night sky: painted stars, stars that twinkle on their own cycles, a slow drift`, sky.n > 100 && sky.tw > 30 && sky.anim !== 'none' && sky.drift !== 'none', JSON.stringify(sky));
  // only the shop's real candles, photographed, with their images loaded
  await p.waitForFunction(() => [...document.querySelectorAll('.jbreathe .fb-c img')].every(i => i.complete && i.naturalWidth > 0));
  const cands = await p.evaluate(() => [...document.querySelectorAll('.jbreathe .fb-c')].map(s => ({ slug: s.dataset.slug, label: s.getAttribute('aria-label'), imgs: [...s.querySelectorAll('img')].map(i => i.getAttribute('src')) })));
  ok(`${label}: the picker lists only the shop's photographed candles (Cabana, Verdant)`, cands.map(c => c.slug).join() === 'cabana,verdant' && cands.every(c => c.imgs.every(s => /^\/img\/studio\/picker\/(cabana|verdant)-(unlit|glow)-900\.webp$/.test(s))), cands.map(c => c.slug).join());
  ok(`${label}: the carousel is a labelled group of buttons with aria-pressed`, await p.evaluate(() => { const t = document.querySelector('.fb-track'); return !!t.getAttribute('aria-label') && t.getAttribute('role') === 'group' && document.querySelectorAll('.fb-track button.fb-c[aria-pressed="true"]').length === 1; }));
  await p.waitForFunction(() => /\$/.test(document.querySelector('.fb-price')?.textContent ?? ''));
  const prices = await p.evaluate(() => (document.querySelector('.jbreathe').textContent.match(/\$\d[\d,.]*/g) ?? []));
  ok(`${label}: prices come from the live catalogue, none invented`, prices.length > 0 && prices.every(x => allowed.has(x)), prices.join(' '));
  ok(`${label}: no other products are named`, await p.evaluate(() => !/Citrus|Campfire|Desert|Golden Meridian|Amber|Licorice|Lilac|Peony|Sea Foam|Windy/i.test(document.querySelector('.jbreathe').textContent)));
  ok(`${label}: Light it & breathe has focus`, await p.evaluate(() => document.activeElement?.classList.contains('fb-light')));
  // choosing: arrow keys, the ‹ › buttons, a drag
  const s0 = await sel(p); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(250); const s1 = await sel(p);
  const live = await p.locator('.jbreathe .fb-sr').innerText();
  ok(`${label}: the right arrow key chooses the next candle and it is announced`, s0[0] === 'cabana' && s1[0] === 'verdant' && s1[1] === 'Verdant' && /Verdant/.test(live), `${s0} -> ${s1} / "${live}"`);
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(250); ok(`${label}: the left arrow key goes back`, (await sel(p))[0] === 'cabana');
  await p.locator('.fb-nav.next').click(); await p.waitForTimeout(250); const n1 = (await sel(p))[0]; await p.locator('.fb-nav.prev').click(); await p.waitForTimeout(250);
  ok(`${label}: the ‹ › buttons choose too`, n1 === 'verdant' && (await sel(p))[0] === 'cabana');
  if (label === 'desktop') {
    const st = await p.locator('.fb-stage').boundingBox(), y = st.y + st.height * 0.6;
    await p.mouse.move(st.x + st.width * 0.7, y); await p.mouse.down(); for (let i = 1; i <= 8; i++) { await p.mouse.move(st.x + st.width * (0.7 - 0.05 * i), y); await p.waitForTimeout(16); } await p.mouse.up(); await p.waitForTimeout(400);
    const dragged = (await sel(p))[0]; await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(200);
    ok(`${label}: dragging the candles sideways chooses the next one`, dragged === 'verdant', dragged);
  } else {
    // a swipe on the phone (touch pointer events)
    const st = await p.locator('.fb-stage').boundingBox(), y = st.y + st.height * 0.6;
    const cdp = await ctx.newCDPSession(p); const tp = x => [{ x, y }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(st.x + st.width * 0.8) });
    for (let i = 1; i <= 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(st.x + st.width * (0.8 - 0.07 * i)) }); await p.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await p.waitForTimeout(400);
    const swiped = (await sel(p))[0]; await p.locator('.fb-nav.prev').click(); await p.waitForTimeout(200);
    ok(`${label}: swiping the candles chooses the next one`, swiped === 'verdant', swiped);
  }
  const o0 = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(`${label}: no sideways scroll on the picker`, o0 <= 1, `${o0}`);
  // the guide waits quietly while you choose; the breathing starts when a candle is lit
  const seen0 = new Set(); for (let i = 0; i < 30; i++) { seen0.add(await p.evaluate(() => document.querySelector('.jbreathe').dataset.phase)); await p.waitForTimeout(50); }
  ok(`${label}: while you choose, the guide invites you to light one and does not start the breath`, seen0.size === 1 && seen0.has('Choose one to light'), [...seen0].join(' / '));
  // Add to cart from the picker calls the cart
  await p.locator('.fb-add').click(); await p.waitForTimeout(300);
  const cart1 = await p.evaluate(() => JSON.parse(localStorage.getItem('dr_cart') ?? '[]'));
  ok(`${label}: Add to cart puts the chosen candle in the cart`, cart1.length === 1 && cart1[0].slug === 'cabana' && cart1[0].choice === '2 oz' && /in your cart/.test(await p.locator('.fb-status').innerText()), JSON.stringify(cart1.map(l => [l.slug, l.choice, l.qty])));
  // sound is off, and no audio is even created, until the toggle is tapped
  ok(`${label}: sound is off until it is turned on`, await p.evaluate(() => document.querySelector('.jbreathe').dataset.sound === 'off' && document.querySelector('.fb-sound').getAttribute('aria-pressed') === 'false' && window.__audio === 0));
  // light it
  ok(`${label}: no flame before it is lit`, (await p.locator('.jbreathe canvas.fb-flame').count()) === 0);
  await p.locator('.fb-light').click(); await p.waitForFunction(() => document.querySelector('.jbreathe').dataset.stage === 'lit');
  ok(`${label}: Done has focus once it is lit`, await p.evaluate(() => document.activeElement?.classList.contains('jb-close')));
  ok(`${label}: still no audio after lighting (sound stays off)`, await p.evaluate(() => window.__audio === 0));
  // lighting starts the breath again: "Take a moment", then in, then hold
  await p.waitForFunction(() => document.querySelector('.jbreathe').dataset.phase === 'Take a moment');
  await p.waitForFunction(() => document.querySelector('.jbreathe').dataset.phase === 'Breathe in');
  await p.waitForFunction(() => document.querySelector('.jbreathe').dataset.phase === 'Hold');
  const wick = await onWick(p), lit = await flamePx(p);
  ok(`${label}: Light it lights a flame on each wick`, wick.length === 2 && wick.every(w => w.n > 15) && lit > 30, JSON.stringify(wick.map(w => w.n)));
  ok(`${label}: each flame stands on its wick`, wick.every(w => w.off < 0.25 && w.gap > -0.1 && w.gap < 0.35), JSON.stringify(wick.map(w => [w.off.toFixed(2), w.gap.toFixed(2)])));
  ok(`${label}: the lit glass and wax glow in`, await p.evaluate(() => Number(getComputedStyle(document.querySelector('.fb-c[aria-pressed="true"] .fb-glow')).opacity) > 0.6));
  const seen = new Set(); let big = 0, small = 1e9;
  for (let i = 0; i < 50; i++) { const ph = await p.evaluate(() => document.querySelector('.jbreathe').dataset.phase); seen.add(ph); const n = await flamePx(p); if (ph === 'Hold') big = Math.max(big, n); if (ph === 'Breathe out') small = Math.min(small, n); await p.waitForTimeout(50); }
  ok(`${label}: the breath cycle runs with the candle: in, hold, out`, ['Breathe in', 'Hold', 'Breathe out'].every(w => seen.has(w)), [...seen].join(' / '));
  ok(`${label}: the flame swells with the in-breath and settles on the out-breath`, big > small * 1.15, `${big} vs ${small}`);
  ok(`${label}: the sub line keeps the original words`, /Stay as long as you like/.test(await p.locator('.jbreathe .jb-sub').textContent()));
  // after three breaths, the offer: quiet, never taking focus
  await p.waitForFunction(() => document.querySelector('.jbreathe').dataset.offer === 'shown'); await p.waitForTimeout(1400);
  const off = await p.evaluate(() => ({ vis: getComputedStyle(document.querySelector('.fb-offer')).opacity, focus: document.activeElement?.className, pair: document.querySelector('.fb-pair').getAttribute('href'), home: document.querySelector('.fb-home').textContent, words: document.querySelector('.jbreathe').dataset.phase }));
  ok(`${label}: after three breaths the offer appears without taking focus or stopping the breath`, Number(off.vis) > 0.3 && /jb-close/.test(off.focus) && !!off.words, JSON.stringify(off));
  ok(`${label}: it pairs Cabana with its roller`, /^#?\/product\/cabana-fragrance-roller$/.test(off.pair) && /Bring this candle home/.test(off.home), off.pair);
  await p.locator('.fb-home').click(); await p.waitForTimeout(300);
  const cart2 = await p.evaluate(() => JSON.parse(localStorage.getItem('dr_cart') ?? '[]'));
  ok(`${label}: the offer's Bring this candle home calls the cart`, cart2.length === 1 && cart2[0].slug === 'cabana' && cart2[0].qty === 2, JSON.stringify(cart2.map(l => [l.slug, l.qty])));
  // sound on: an audio context is created only now, from the tap
  await p.locator('.fb-sound').click(); await p.waitForTimeout(200);
  ok(`${label}: the sound toggle turns the crackle on`, await p.evaluate(() => window.__audio === 1 && document.querySelector('.fb-sound').getAttribute('aria-pressed') === 'true'));
  await p.locator('.fb-sound').click();
  // focus stays inside; Esc closes and returns focus
  for (let i = 0; i < 6; i++) await p.keyboard.press('Tab');
  ok(`${label}: focus stays inside`, await p.evaluate(() => !!document.activeElement?.closest('.jbreathe')));
  await p.keyboard.press('Shift+Tab'); ok(`${label}: and backwards`, await p.evaluate(() => !!document.activeElement?.closest('.jbreathe')));
  const cost = await p.evaluate(() => [Number(document.querySelector('.jbreathe').dataset.frameMs), Number(document.querySelector('.jbreathe').dataset.frameMaxMs)]);
  ok(`${label}: a frame's own work is small`, cost[0] < 4, `mean ${cost[0]} ms, longest ${cost[1]} ms`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(600);
  ok(`${label}: Esc closes and returns focus to the orb`, (await p.locator('.jbreathe').count()) === 0 && await p.evaluate(() => document.activeElement?.classList.contains('breathorb')));
  const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(`${label}: no sideways scroll`, o <= 1, `${o}`);
  // the last chosen candle comes back next time
  await p.locator('.breathorb').click(); await p.waitForSelector('.jbreathe.open'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200); await p.keyboard.press('Escape'); await p.waitForTimeout(600);
  await p.locator('.breathorb').click(); await p.waitForSelector('.jbreathe.open'); await p.waitForTimeout(200);
  ok(`${label}: the pause opens on the last chosen candle`, (await sel(p))[0] === 'verdant');
  ok(`${label}: Verdant has no roller in the shop, so the offer links to the rollers`, await p.evaluate(() => /^#?\/shop\?f=roller$/.test(document.querySelector('.fb-pair').getAttribute('href'))));
  await p.keyboard.press('Escape'); await p.waitForTimeout(600);
  ok(`${label}: no JS errors`, errs.length === 0, errs.join('|'));
  await ctx.close();

  // the scene comes to life at the top of the breath and cools late in the out-breath (real speed)
  const q = await (await b.newContext({ viewport: vp })).newPage(); q.setDefaultTimeout(20000); await setupMocks(q);
  await open(q, ''); await q.waitForTimeout(600); await q.locator('.fb-light').click();
  await q.waitForFunction(() => document.querySelector('.jbreathe')?.dataset.phase === 'Breathe in');
  await q.waitForFunction(() => document.querySelector('.jbreathe')?.dataset.phase === 'Hold'); await q.waitForTimeout(500); const atHold = await lum(q, await q.screenshot());
  await q.waitForFunction(() => document.querySelector('.jbreathe')?.dataset.phase === 'Breathe out'); await q.waitForTimeout(4600); const lateOut = await lum(q, await q.screenshot());
  ok(`${label}: the scene is brighter at Hold than late in the out-breath`, atHold > lateOut * 1.06, `${atHold.toFixed(1)} vs ${lateOut.toFixed(1)}`);
  await q.context().close();

  // reduced motion: no drift or twinkle, no sound toggle, a steady lit flame, the words still cycle
  const r = await (await b.newContext({ viewport: vp, reducedMotion: 'reduce' })).newPage(); r.setDefaultTimeout(9000); await setupMocks(r);
  await open(r);
  const still = await r.evaluate(() => [getComputedStyle(document.querySelector('.fb-drift')).animationName, getComputedStyle(document.querySelector('.fb-tw i')).animationName, document.querySelectorAll('.fb-sound').length]);
  ok(`${label}: reduced motion: the sky is still and there is no sound`, still[0] === 'none' && still[1] === 'none' && still[2] === 0, still.join(','));
  await r.locator('.fb-light').click(); await r.waitForTimeout(800);
  const a = await flamePx(r); await r.waitForTimeout(400); const c2 = await flamePx(r);
  ok(`${label}: reduced motion keeps a steady, lit flame`, a > 30 && a === c2, `${a} / ${c2}`);
  const seenR = new Set(); for (let i = 0; i < 30; i++) { seenR.add(await r.evaluate(() => document.querySelector('.jbreathe').dataset.phase)); await r.waitForTimeout(50); }
  ok(`${label}: reduced motion: the words still cycle`, ['Breathe in', 'Hold', 'Breathe out'].every(w => seenR.has(w)), [...seenR].join(' / '));
  await r.context().close();
}

// a candle the shop does not have: no price and no Add to cart, rather than an invented one
{ const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); p.setDefaultTimeout(9000); await setupMocks(p);
  await p.route(/wixapis\.com\/.*stores\/v3\/products\/query/, r => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ products: products.filter(x => x.slug !== 'verdant'), pagingMetadata: { count: products.length - 1, hasNext: false } }) }));
  await open(p); await p.waitForFunction(() => /\$/.test(document.querySelector('.fb-price')?.textContent ?? ''));
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300);
  const v = await p.evaluate(() => ({ name: document.querySelector('.fb-name').textContent, price: document.querySelector('.fb-price').hidden, add: document.querySelector('.fb-add').hidden, txt: document.querySelector('.fb-info').innerText }));
  ok('a candle missing from the shop shows no price and no Add to cart', v.name === 'Verdant' && v.price && v.add && !/\$/.test(v.txt), JSON.stringify(v));
  await p.context().close(); }
await b.close();
const failed = res.filter(x => !x).length; console.log(failed ? `${failed} FAILED` : 'ALL PASSED'); process.exit(failed ? 1 : 0);
