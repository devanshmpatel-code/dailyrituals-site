// The breathing pause: choose your candle at the foot of a Bodhi tree under the night sky, light it, breathe with it.
// Opened by the breathing orb. Stage 1 is a carousel of the shop's real candles (only Cabana and Verdant have photographs),
// unlit, standing on the ground at the trunk's foot, with the live price and Add to cart; the whole tree is in the picture,
// a dark silhouette against a starry navy-to-violet night; the breath already keeps its pace at the top. "Light it & breathe" lights the wooden wicks (canvas flames on the
// wicks, the lit glass fading in) and the in / hold / out cycle begins again with the candle: its light on the tree and the
// ground rises on the in-breath and settles on the out-breath. After three breaths a quiet offer appears.
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
// the flames' visible height (alpha over 120), as a fraction of the candle photo's width, one per wick
const flameSize = p => p.evaluate(() => { const ph = document.querySelector('.fb-c[aria-pressed="true"] .fb-ph'); return [...document.querySelectorAll('.jbreathe canvas.fb-flame')].map(c => {
  const s = c.width / c.clientWidth, d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let low = 0, top = 1e9;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 120) { low = Math.max(low, y); top = Math.min(top, y); }
  return (low - top) / s / ph.clientWidth;
}); });
// before this change, measured the same way at Hold (the most of three breaths, desktop and phone): the tumbler's flame and the tin's
const FLAME_BEFORE = [0.102, 0.078];
// the chosen candle's width (Cabana's photo, in CSS px) before the tree was shown whole, at the two viewports below: the
// candles now stand about a fifth smaller
const CANDLE_BEFORE = { desktop: 217, mobile: 142 };
// the tree: its canvas, where its trunk stands (data-foot, data-fork, data-trunk) and its light layer
const treeInfo = p => p.evaluate(() => {
  const c = document.querySelector('.jbreathe canvas.fb-bodhi'), g = c.getContext('2d'), W = c.width, H = c.height, d = g.getImageData(0, 0, W, H).data, s = W / c.clientWidth;
  let n = 0; for (let i = 3; i < d.length; i += 4 * 7) if (d[i] > 200) n++;
  // the crown across the top: how much of the top tenth of the window is painted, in each fifth across
  const band = [0, 1, 2, 3, 4].map(k => { let m = 0, t = 0; for (let y = 0; y < Math.round(H * 0.1); y += 3) for (let x = Math.round(W * k / 5); x < Math.round(W * (k + 1) / 5); x += 3) { t++; if (d[(y * W + x) * 4 + 3] > 120) m++; } return m / t; });
  const lit = document.querySelector('.jbreathe .fb-bodhi-lit');
  return { painted: n / (d.length / 4 / 7), band, ready: !!c.dataset.readyMs, foot: c.dataset.foot?.split(',').map(Number), fork: Number(c.dataset.fork), trunk: Number(c.dataset.trunk), flare: Number(c.dataset.flare), crown: c.dataset.crown?.split(',').map(Number), s,
    litOp: Number(getComputedStyle(lit).opacity), litPx: lit.width * lit.height };
});
// how dark the scene is behind a piece of text: the text is hidden for a moment, the box is photographed, and the contrast
// of the text's colour against the brightest tenth of what was behind it is worked out (WCAG relative luminance)
const contrastBehind = async (p, sel) => {
  const box = await p.locator(sel).boundingBox(), color = await p.evaluate(s => getComputedStyle(document.querySelector(s)).color, sel);
  await p.evaluate(s => document.querySelector(s).style.visibility = 'hidden', sel);
  const png = await p.screenshot({ clip: box, animations: 'disabled' });
  await p.evaluate(s => document.querySelector(s).style.visibility = '', sel);
  return p.evaluate(async ([b64, col]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }, L = (r, g2, b) => 0.2126 * lin(r) + 0.7152 * lin(g2) + 0.0722 * lin(b);
    const d = g.getImageData(0, 0, c.width, c.height).data, ls = []; for (let i = 0; i < d.length; i += 4) ls.push(L(d[i], d[i + 1], d[i + 2])); ls.sort((a, b) => a - b);
    const bg = ls[Math.floor(ls.length * 0.9)], [r, g2, b] = col.match(/[\d.]+/g).map(Number), fg = L(r, g2, b);
    return (fg + 0.05) / (bg + 0.05);
  }, [png.toString('base64'), color]);
};
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
  const sky = await p.evaluate(() => { const c = document.querySelector('.jbreathe .fb-stars'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 40) n++; return { n, tw: document.querySelectorAll('.jbreathe .fb-tw i').length, bright: document.querySelectorAll('.jbreathe .fb-tw i.b').length, anim: getComputedStyle(document.querySelector('.fb-tw i')).animationName, drift: getComputedStyle(document.querySelector('.fb-drift')).animationName }; });
  ok(`${label}: a night sky: many painted stars, stars that twinkle on their own cycles, a few brighter ones, a slow drift`, sky.n > 300 && sky.tw > 40 && sky.bright >= 3 && sky.anim !== 'none' && sky.drift !== 'none', JSON.stringify(sky));
  // a true night: deep navy high up, deepening to violet towards the horizon (no dusk blue or rose)
  const stops = await p.evaluate(() => (getComputedStyle(document.querySelector('.jbreathe .fb-sky')).backgroundImage.match(/rgb\(\d+, \d+, \d+\)/g) ?? []).slice(0, 5).map(s => s.match(/\d+/g).map(Number)));
  ok(`${label}: the sky is a true night, deep navy to violet`, stops.length === 5 && stops.every(([r, g, b]) => b > r && b > g && r + g + b < 200) && stops[0][2] < 30 && stops[4][0] > stops[4][1] + 6, JSON.stringify(stops));
  // the stars twinkle at random: over a third of a second many change, and at any moment they are not in step
  const twk = () => p.evaluate(() => [...document.querySelectorAll('.jbreathe .fb-tw i')].slice(0, 30).map(i => Number(getComputedStyle(i).opacity)));
  const tw1 = await twk(); await p.waitForTimeout(350); const tw2 = await twk();
  const changed = tw1.filter((v, i) => Math.abs(v - tw2[i]) > 0.02).length, distinct = new Set(tw1.map(v => v.toFixed(2))).size;
  ok(`${label}: the stars twinkle, each at its own moment`, changed >= 8 && distinct >= 12, `${changed} of 30 changed, ${distinct} different brightnesses`);
  // the Bodhi tree: painted (once, while the page is idle), its crown spreading right across the top of the window, unlit
  await p.waitForFunction(() => !!document.querySelector('.jbreathe canvas.fb-bodhi')?.dataset.readyMs, null, { timeout: 15000 });
  const tree0 = await treeInfo(p);
  ok(`${label}: the Bodhi tree is painted behind the candles`, tree0.ready && tree0.painted > 0.2, `${(tree0.painted * 100).toFixed(0)}% of the window`);
  // the whole tree in the picture: the top of the window is night sky, and the crown's dome rises below it, spreading
  // nearly across the window (on a wide screen within it, on a phone a little past its edges)
  const vw = await p.evaluate(() => innerWidth), [cTop, cL, cR] = tree0.crown;
  ok(`${label}: the whole crown is in the picture under the night sky, spreading across the window`, tree0.band.every(f => f < 0.15) && cTop > 40 && cR - cL > vw * 0.85 && (label === 'mobile' || (cL > -vw * 0.02 && cR < vw * 1.02)),
    `top band ${tree0.band.map(f => f.toFixed(2)).join(' ')}; crown from ${cTop}, ${cL} to ${cR}`);
  ok(`${label}: before a candle is lit, the tree is in the night (its light layer is off)`, tree0.litOp === 0 && tree0.litPx > 0, `${tree0.litOp}`);
  ok(`${label}: the tree is under the words and buttons, never over them`, await p.evaluate(() => { const z = n => Number(getComputedStyle(n).zIndex) || 0; const t = document.querySelector('.fb-tree'); return z(t) < 0 && getComputedStyle(t).pointerEvents === 'none' && ['.fb-head', '.fb-low', '.fb-bar', '.fb-stage'].every(s => z(document.querySelector(s)) >= 0); }));
  // the candles at its foot: the chosen one in the middle in front of the trunk, small beside it; the others smaller, dimmer and further back
  const foot = await p.evaluate(() => { const r = n => n.getBoundingClientRect(); const on = document.querySelector('.fb-c[aria-pressed="true"]'), off = document.querySelector('.fb-c[aria-pressed="false"]');
    const a = r(on.querySelector('.fb-ph')), b = r(off.querySelector('.fb-ph'));
    return { cx: (a.left + a.right) / 2, top: a.top, bottom: a.bottom, w: a.width, h: a.height, ow: b.width, obottom: b.bottom, oc: (b.left + b.right) / 2, dim: Number(off.style.getPropertyValue('--dim')), op: Number(getComputedStyle(off).opacity) }; });
  ok(`${label}: the chosen candle stands centred at the foot of the trunk, in front of it`, Math.abs(foot.cx - tree0.foot[0]) < tree0.trunk * 0.25 && foot.bottom > tree0.foot[1] && foot.bottom - tree0.foot[1] < foot.h * 0.6, `candle ${foot.cx.toFixed(0)},${foot.bottom.toFixed(0)} trunk foot ${tree0.foot.map(Math.round)}`);
  ok(`${label}: the tree is large beside the candles: its flared foot is broader than the three of them, and it forks well above them`, tree0.flare > foot.w && tree0.trunk > foot.w * 0.5 && tree0.fork < foot.top - foot.h * 0.12, `trunk ${tree0.trunk} (foot ${tree0.flare}) vs candles ${foot.w.toFixed(0)} wide; fork at ${tree0.fork}, candles' top ${foot.top.toFixed(0)}`);
  // the candles a fifth smaller than before, and never cut off: whole in the window, below the words, above their name
  const room = await p.evaluate(() => ({ head: document.querySelector('.fb-eyebrow').getBoundingClientRect().bottom, info: document.querySelector('.fb-mood').getBoundingClientRect().top, vw: innerWidth, vh: innerHeight }));
  ok(`${label}: the candles stand about a fifth smaller than before`, foot.w / CANDLE_BEFORE[label] > 0.78 && foot.w / CANDLE_BEFORE[label] < 0.86, `${foot.w.toFixed(0)} px wide, ${(foot.w / CANDLE_BEFORE[label]).toFixed(2)}x`);
  ok(`${label}: the chosen candle is whole in the picture, clear of the words above and below`, foot.top > room.head && foot.bottom < room.info && foot.cx - foot.w / 2 >= 0 && foot.cx + foot.w / 2 <= room.vw, JSON.stringify({ top: foot.top, bottom: foot.bottom, ...room }));
  ok(`${label}: the other candle stands smaller, dimmer and further back to the side, still in the carousel`, foot.ow < foot.w * 0.75 && foot.dim < 0.7 && foot.op > 0.3 && foot.obottom < foot.bottom && Math.abs(foot.oc - foot.cx) > foot.w * 0.6, JSON.stringify({ w: foot.ow / foot.w, dim: foot.dim, op: foot.op }));
  // only the shop's real candles, photographed, with their images loaded
  await p.waitForFunction(() => [...document.querySelectorAll('.jbreathe .fb-c img')].every(i => i.complete && i.naturalWidth > 0));
  const cands = await p.evaluate(() => [...document.querySelectorAll('.jbreathe .fb-c')].map(s => ({ slug: s.dataset.slug, label: s.getAttribute('aria-label'), imgs: [...s.querySelectorAll('img')].map(i => i.getAttribute('src')) })));
  ok(`${label}: the picker lists only the shop's photographed candles (Cabana, Verdant)`, cands.map(c => c.slug).join() === 'cabana,verdant' && cands.every(c => c.imgs.every(s => /^\/img\/studio\/picker\/(cabana|verdant)-(unlit|glow)-900\.webp$/.test(s))), cands.map(c => c.slug).join());
  ok(`${label}: the carousel is a labelled group of buttons with aria-pressed`, await p.evaluate(() => { const t = document.querySelector('.fb-track'); return !!t.getAttribute('aria-label') && t.getAttribute('role') === 'group' && document.querySelectorAll('.fb-track button.fb-c[aria-pressed="true"]').length === 1; }));
  await p.waitForFunction(() => /\$/.test(document.querySelector('.fb-price')?.textContent ?? ''));
  const prices = await p.evaluate(() => (document.querySelector('.jbreathe').textContent.match(/\$\d[\d,.]*/g) ?? []));
  ok(`${label}: prices come from the live catalogue, none invented`, prices.length > 0 && prices.every(x => allowed.has(x)), prices.join(' '));
  // a chosen size shows its own price (not "From" the cheapest), the same price Add to cart will use
  await p.waitForFunction(() => !/From/.test(document.querySelector('.fb-price').textContent), null, { timeout: 4000 }).catch(() => {});
  const own = await p.evaluate(() => ({ size: document.querySelector('.fb-size[aria-pressed="true"]')?.textContent, price: document.querySelector('.fb-price').textContent, add: document.querySelector('.fb-add').textContent }));
  ok(`${label}: the chosen size shows its exact price, not "From"`, !!own.size && /^\$\d+\.\d\d$/.test(own.price) && allowed.has(own.price) && own.add.endsWith(own.price), JSON.stringify(own));
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
  const seen = new Set(); let big = 0, small = 1e9, litHold = 0, litOut = 1, sizes = [0, 0];
  const litOp = () => p.evaluate(() => Number(getComputedStyle(document.querySelector('.jbreathe .fb-bodhi-lit')).opacity));
  for (let i = 0; i < 50; i++) {
    const ph = await p.evaluate(() => document.querySelector('.jbreathe').dataset.phase); seen.add(ph); const n = await flamePx(p);
    if (ph === 'Hold') { big = Math.max(big, n); litHold = Math.max(litHold, await litOp()); (await flameSize(p)).forEach((v, j) => (sizes[j] = Math.max(sizes[j], v))); }
    if (ph === 'Breathe out') { small = Math.min(small, n); litOut = Math.min(litOut, await litOp()); }
    await p.waitForTimeout(50);
  }
  ok(`${label}: the breath cycle runs with the candle: in, hold, out`, ['Breathe in', 'Hold', 'Breathe out'].every(w => seen.has(w)), [...seen].join(' / '));
  ok(`${label}: the flame swells with the in-breath and settles on the out-breath`, big > small * 1.15, `${big} vs ${small}`);
  ok(`${label}: the flames are about a third bigger than before, against the candle`, sizes.every((v, j) => v > FLAME_BEFORE[j] * 1.2), sizes.map((v, j) => `${(v / FLAME_BEFORE[j]).toFixed(2)}x`).join(', '));
  ok(`${label}: the candle's light on the tree and the ground rises with the in-breath and settles on the out-breath`, litHold > 0.6 && litHold > litOut * 1.4, `${litHold.toFixed(2)} at Hold, ${litOut.toFixed(2)} breathing out`);
  ok(`${label}: the tree is painted once: its lit and still layers are not redrawn per frame`, await p.evaluate(() => { const c = document.querySelector('.jbreathe canvas.fb-bodhi'); return !!c.dataset.readyMs && Number(c.dataset.buildMs) > 0; }));
  await p.waitForFunction(() => document.querySelector('.jbreathe').dataset.phase === 'Hold');
  const cWord = await contrastBehind(p, '.jbreathe .jb-word'), cEye = await contrastBehind(p, '.jbreathe .fb-eyebrow');
  ok(`${label}: the breath word and the candle's name stay legible over the lit crown`, cWord >= 4.5 && cEye >= 4.5, `${cWord.toFixed(1)}:1, ${cEye.toFixed(1)}:1`);
  ok(`${label}: the sub line keeps the original words`, /Stay as long as you like/.test(await p.locator('.jbreathe .jb-sub').textContent()));
  // after three breaths, the offer: quiet, never taking focus
  await p.waitForFunction(() => document.querySelector('.jbreathe').dataset.offer === 'shown');
  // its buttons are legible from the moment they appear and stay so through the breath (the scene dims, they do not)
  const seenOp = new Set(); let minOp = 1;
  for (let i = 0; i < 28; i++) {
    const [ph, o] = await p.evaluate(() => { const op = n => { let v = 1; for (; n; n = n.parentElement) v *= Number(getComputedStyle(n).opacity); return v; }; return [document.querySelector('.jbreathe').dataset.phase, Math.min(op(document.querySelector('.fb-home')), op(document.querySelector('.fb-pair')))]; });
    seenOp.add(ph); minOp = Math.min(minOp, o); await p.waitForTimeout(50);
  }
  ok(`${label}: the offer's buttons never fade below 0.85 opacity, through in, hold and out`, minOp >= 0.85 && ['Breathe in', 'Breathe out'].every(w => seenOp.has(w)), `${minOp.toFixed(2)} over ${[...seenOp].join(' / ')}`);
  await p.waitForTimeout(400);
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
  ok(`${label}: now and then a shooting star crosses the sky`, await p.evaluate(() => Number(document.querySelector('.jbreathe').dataset.meteors) >= 1));
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
  const still = await r.evaluate(() => [getComputedStyle(document.querySelector('.fb-drift')).animationName, getComputedStyle(document.querySelector('.fb-tw i')).animationName, document.querySelectorAll('.fb-sound').length, getComputedStyle(document.querySelector('.fb-meteor')).display]);
  ok(`${label}: reduced motion: the sky is still (no twinkle, no shooting star) and there is no sound`, still[0] === 'none' && still[1] === 'none' && still[2] === 0 && still[3] === 'none', still.join(','));
  await r.locator('.fb-light').click(); await r.waitForTimeout(800);
  const a = await flamePx(r); await r.waitForTimeout(400); const c2 = await flamePx(r);
  ok(`${label}: reduced motion keeps a steady, lit flame`, a > 30 && a === c2, `${a} / ${c2}`);
  const treeStill = () => r.evaluate(() => { const c = document.querySelector('.jbreathe .fb-bodhi-live'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) >>> 0; return [h, Number(getComputedStyle(document.querySelector('.jbreathe .fb-bodhi-lit')).opacity)]; });
  await r.waitForFunction(() => !!document.querySelector('.jbreathe canvas.fb-bodhi')?.dataset.readyMs, null, { timeout: 15000 }); await r.waitForTimeout(300);
  const ts1 = await treeStill(); await r.waitForTimeout(700); const ts2 = await treeStill();
  ok(`${label}: reduced motion: the tree stands still and lit, no leaf moves or falls`, ts1[0] === ts2[0] && ts1[1] === ts2[1] && ts1[1] > 0.5, `${ts1} / ${ts2}`);
  const seenR = new Set(); for (let i = 0; i < 30; i++) { seenR.add(await r.evaluate(() => document.querySelector('.jbreathe').dataset.phase)); await r.waitForTimeout(50); }
  ok(`${label}: reduced motion: the words still cycle`, ['Breathe in', 'Hold', 'Breathe out'].every(w => seenR.has(w)), [...seenR].join(' / '));
  ok(`${label}: reduced motion: no shooting star was sent`, await r.evaluate(() => !document.querySelector('.jbreathe').dataset.meteors));
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
