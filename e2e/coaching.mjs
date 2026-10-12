// The coaching page: Claire's opening (on a phone, the headline before her photograph), the two free ways in, the 3D habit
// loop (porcelain coins over a hoop, a travelling bead, the old loop turning into the new one, drag, touch, keys, buttons),
// the 3D calm-cue loop round its pause light (no product in it; the light brightening as the loop completes), no selling in
// the middle of the story, one honest cue-kit section near the end (nothing to buy to begin, then real products at their
// real prices), the flat versions for reduced motion, lazy pictures below the fold, the phone bar with both free offers
// (never over the opening), no sideways scroll and no script errors.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const catalogue = JSON.parse(fs.readFileSync(new URL('./products.json', import.meta.url), 'utf8')).products;
const slugs = new Set(catalogue.map(p => p.slug));
// a product's price as the shop shows it (ui.ts priceText), from the captured catalogue
const money = n => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', currencyDisplay: 'narrowSymbol' }).format(n);
const priceOf = slug => { const p = catalogue.find(x => x.slug === slug), lo = Number(p.actualPriceRange.minValue.amount), hi = Number(p.actualPriceRange.maxValue.amount); return lo === hi ? money(lo) : `From ${money(lo)}`; };
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const noScroll = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const active = p => p.evaluate(() => document.querySelector('.cue-hl')?.textContent);
// the pause light in the calm-cue loop: the light level set on the loop, and how bright its inner light and its caustic are drawn
const light = p => p.evaluate(() => { const o = document.querySelector('.cue-orb .pl');
  return { lit: Number(getComputedStyle(document.querySelector('.cue')).getPropertyValue('--lit')), core: Number(getComputedStyle(o.querySelector('.pl-core')).opacity), caustic: Number(getComputedStyle(o.querySelector('.pl-caustic')).opacity) }; });
// the habit loop: its heading, its live coins, and the words each coin shows (the face for the loop on show)
const habit = p => p.evaluate(() => document.querySelector('#loopWrap .loopcard h3').textContent);
const coinWords = p => p.evaluate(() => { const mode = document.querySelector('.lp3').dataset.loop;
  return [...document.querySelectorAll('.lp-coin.lp-node')].map(c => ({ k: c.dataset.coin, rects: [...c.querySelectorAll(`.lp-face.f-${mode} b, .lp-face.f-${mode} .lp-n`)].map(e => e.getBoundingClientRect().toJSON()), coin: c.getBoundingClientRect().toJSON() })); });
const overlap = (x, y) => x.left < y.right && y.left < x.right && x.top < y.bottom && y.top < x.bottom;
const coinClash = ws => { const n = []; ws.forEach((a, i) => ws.forEach((b, j) => { if (j > i && a.rects.some(x => b.rects.some(y => overlap(x, y)))) n.push([a.k, b.k]); })); return n; };
const yawOf = (p, k) => p.evaluate(k => { const m = document.querySelector(`.lp-coin[data-coin="${k}"]`).style.transform.match(/rotateY\((-?[\d.]+)deg\)/); return m ? Number(m[1]) : NaN; }, k);
const pressed = p => p.evaluate(() => [...document.querySelectorAll('.cue-pill')].findIndex(x => x.getAttribute('aria-pressed') === 'true'));

for (const [label, vp, touch] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch }); const p = await ctx.newPage(); p.setDefaultTimeout(10000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto(base + '/coaching'); await p.waitForSelector('.co-hero .co-claire'); await p.waitForTimeout(900);

  // ---- the opening: Claire, loaded first, framed in the arch
  const claire = await p.evaluate(() => { const i = document.querySelector('.co-hero .co-arch img.co-claire'); const r = i.getBoundingClientRect(), a = i.closest('.co-arch').getBoundingClientRect();
    return { src: i.currentSrc || i.src, done: i.complete && i.naturalWidth > 0, lazy: i.loading === 'lazy', prio: i.getAttribute('fetchpriority'), top: r.top, h: innerHeight, alt: i.alt,
      clipped: getComputedStyle(i.closest('.co-arch')).overflow === 'hidden' && r.top < a.top && r.right > a.right && r.left < a.left }; });
  ok(`${label}: Claire is the opener, loaded from her cut-out`, /studio\/cut\/claire-(480|900)\.webp/.test(claire.src) && claire.done && /Claire/.test(claire.alt), claire.src);
  ok(`${label}: her picture loads first (eager, high priority) and is on the first screen`, !claire.lazy && claire.prio === 'high' && claire.top < claire.h, JSON.stringify({ top: Math.round(claire.top), lazy: claire.lazy }));
  ok(`${label}: the arch hides the cropped top and side of the photograph`, claire.clipped);
  ok(`${label}: the headline is the coaching promise`, /Small habits,\s*made easier/.test(await p.locator('.co-hero h1').innerText()));

  // ---- both ways in
  const hrefs = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#app [data-cta]')].map(a => [a.dataset.cta, a.getAttribute('href')])));
  ok(`${label}: the main call to action starts the free reset`, /\/reset$/.test(hrefs.reset) && /Start the free 7-day reset/.test(await p.locator('.co-hero [data-cta="reset"]').innerText()), hrefs.reset);
  ok(`${label}: the second call to action books the free discovery call`, /\/book(\/[\w-]+)?$/.test(hrefs.call) && /discovery call/i.test(await p.locator('.co-hero [data-cta="call"]').innerText()), hrefs.call);
  ok(`${label}: the reset and the call are offered again further down`, ['reset2', 'reset3', 'call2', 'call3'].every(k => hrefs[k] && /\/(reset|book)/.test(hrefs[k])), JSON.stringify(hrefs));
  ok(`${label}: one mindful minute is still offered in the opening`, (await p.locator('.c-hero [data-breathe]').count()) === 1);

  // ---- phones: the headline comes before Claire's photograph, and the bar never sits over the opening
  if (touch) {
    const order = await p.evaluate(() => ({ h1: document.querySelector('.co-hero h1').getBoundingClientRect().bottom, photo: document.querySelector('#coPortal').getBoundingClientRect().top, dock: document.querySelector('#coDock').classList.contains('show') }));
    ok('phone: the headline comes before the photograph', order.h1 <= order.photo + 1, JSON.stringify(order));
    ok('phone: the free-offers bar stays away while the opening is on screen (nothing of it covered)', !order.dock);
  }

  // ---- the 3D habit loop
  await p.evaluate(t => document.querySelector('#loopWrap').scrollIntoView({ block: t ? 'start' : 'center' }), touch); await p.waitForTimeout(1200);
  const h3d = await p.evaluate(() => { const coins = [...document.querySelectorAll('.lp-coin')], live = coins.filter(c => c.classList.contains('lp-node'));
    return { tilt: getComputedStyle(document.querySelector('.lp3-tilt')).transformStyle, coinStyle: getComputedStyle(coins[0]).transformStyle, rims: coins.map(c => c.querySelectorAll('.lp-rim i').length),
      faces: coins.map(c => c.querySelectorAll('.lp-face').length), live: live.length, depths: live.map(c => new DOMMatrix(getComputedStyle(c).transform).m43),
      flat: live.some(c => new DOMMatrix(getComputedStyle(c).transform).is2D), hoops: document.querySelectorAll('.lp3-floor .lp3-hoop').length, svg: document.querySelectorAll('#loopWrap > .loop > svg').length,
      hub: document.querySelector('.lp3-hub b').textContent, bead: !!document.querySelector('.lp3-bead') }; });
  ok(`${label}: the habit loop is a 3D ring, not a flat drawing: a hoop built up in layers, the steps as coins with two faces and an edge, at different depths`,
    h3d.tilt === 'preserve-3d' && h3d.coinStyle === 'preserve-3d' && h3d.rims.every(n => n >= 20) && h3d.faces.every(n => n === 2) && Math.max(...h3d.depths) - Math.min(...h3d.depths) > 100 && !h3d.flat && h3d.hoops >= 4 && h3d.svg === 0, JSON.stringify(h3d));
  ok(`${label}: it starts on the old loop's cue, three steps, named in the middle`, h3d.live === 3 && (await habit(p)) === 'Cue' && h3d.hub === 'The old loop');
  const b0 = await p.evaluate(() => document.querySelector('.lp3-bead').style.transform); await p.waitForTimeout(350);
  const b1 = await p.evaluate(() => document.querySelector('.lp3-bead').style.transform);
  ok(`${label}: a glowing bead travels the path`, h3d.bead && b0 !== b1);
  await p.locator('.lp-node[data-node="1"]').click(); await p.waitForTimeout(200);
  ok(`${label}: tapping a coin reads it`, (await habit(p)) === 'Automatic response' && (await p.locator('.lp-node.on').count()) === 1, await habit(p));
  await p.locator('#loopWrap [data-step="1"]').click(); ok(`${label}: Next step moves on`, (await habit(p)) === 'Short-term relief');
  await p.locator('#loopWrap [data-step="1"]').click(); ok(`${label}: and wraps back to the cue`, (await habit(p)) === 'Cue');
  ok(`${label}: Back is off on the first step`, await p.locator('#loopWrap [data-step="-1"]').isDisabled());
  await p.locator('.lp3-stage').focus(); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150);
  ok(`${label}: the arrow keys turn the habit loop`, (await habit(p)) === 'Automatic response');
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(1500);
  await p.locator('.lp-node[data-node="0"]').focus(); await p.keyboard.press('Enter');
  ok(`${label}: Enter on a coin reads it`, (await p.locator('.lp-node.on').count()) === 1 && (await habit(p)) === 'Cue');
  ok(`${label}: the step is real text for screen readers`, (await p.locator('#loopWrap h3[aria-live="polite"]').count()) === 1 && (await p.locator('.lp-node[aria-label="Cue, step 1 of 3"]').count()) === 1 && (await p.locator('.lp3-stage[aria-label]').count()) === 1);
  await p.locator('#loopWrap [data-play]').click(); await p.waitForTimeout(3000);
  ok(`${label}: Play the loop advances on its own`, (await habit(p)) !== 'Cue' && /Pause playing/.test(await p.locator('#loopWrap [data-play]').innerText()), await habit(p));
  await p.locator('#loopWrap [data-play]').click(); await p.waitForTimeout(1500);
  // at rest on every step, and halfway between steps, no coin's words lie over another's, nor over the loop's name
  const hcomp = [];
  const hubClash = () => p.evaluate(() => { const h = document.querySelector('.lp3-hub b').getBoundingClientRect(); return [...document.querySelectorAll('.lp-coin.lp-node')].filter(c => { const r = c.getBoundingClientRect(), m = { l: r.left + r.width * .15, r: r.right - r.width * .15, t: r.top + r.height * .15, b: r.bottom - r.height * .15 }; return m.l < h.right && h.left < m.r && m.t < h.bottom && h.top < m.b; }).length; });
  for (const m of ['old', 'new']) {
    if (m === 'new') {
      await p.locator('#loopWrap [data-mode="new"]').click(); await p.waitForTimeout(500);
      const mid = await p.evaluate(() => ({ pause: Number(document.querySelector('.lp-coin[data-coin="1"]').style.opacity) }));
      const y2 = await yawOf(p, 2);
      await p.waitForTimeout(1900);
      const fin = await p.evaluate(() => ({ live: document.querySelectorAll('.lp-coin.lp-node').length, hub: document.querySelector('.lp3-hub b').textContent, pause: document.querySelector('.lp-node[data-node="1"]')?.getAttribute('aria-label') }));
      const y2b = await yawOf(p, 2), mod = a => ((a % 360) + 360) % 360;
      ok(`${label}: switching to the new loop is a 3D change: the response coin turns over and the pause rises out of the ring`,
        fin.live === 4 && /^Pause, step 2 of 4$/.test(fin.pause) && fin.hub === 'A new loop' && mid.pause < 0.98 && Math.abs(mod(y2b) - 180) < 30 && Math.abs(mod(y2) - 180) > 8, JSON.stringify({ mid, fin, y2, y2b }));
      ok(`${label}: the new loop's second step is the pause`, (await p.locator('.lp-node[data-node="1"]').evaluate(e => e.getAttribute('aria-label'))) === 'Pause, step 2 of 4');
    }
    const n = m === 'old' ? 3 : 4;
    for (let k = 0; k < n; k++) {
      await p.locator('#loopWrap [data-step="1"]').click(); await p.waitForTimeout(220);
      const mid = await coinWords(p); await p.waitForTimeout(1500); const rest = await coinWords(p);
      hcomp.push({ m, k, mid: coinClash(mid).length, rest: coinClash(rest).length, hub: await hubClash() });
    }
  }
  ok(`${label}: no coin's words collide with another's at rest or mid-turn, and none covers the loop's name at rest`, hcomp.every(c => !c.mid && !c.rest && !c.hub), JSON.stringify(hcomp));
  // drag (or swipe) the habit loop round
  { const before = await habit(p), t0 = await p.evaluate(() => document.querySelector('.lp-coin[data-coin="0"]').style.transform);
    const box = await p.locator('.lp3-stage').boundingBox(), y = box.y + box.height * 0.85;
    if (touch) { const cdp = await ctx.newCDPSession(p); const x0 = box.x + box.width * 0.85;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
      for (let k = 1; k <= 12; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 - k * 16, y }] }); await p.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } else { await p.mouse.move(box.x + box.width * 0.85, y); await p.mouse.down(); for (let k = 1; k <= 12; k++) { await p.mouse.move(box.x + box.width * 0.85 - k * 22, y); await p.waitForTimeout(16); } await p.mouse.up(); }
    await p.waitForTimeout(1500);
    const after = await habit(p), t1 = await p.evaluate(() => document.querySelector('.lp-coin[data-coin="0"]').style.transform);
    ok(`${label}: ${touch ? 'a swipe' : 'dragging'} turns the habit loop to another step`, after !== before && t0 !== t1, `${before} -> ${after}`); }
  await p.locator('#loopWrap [data-mode="old"]').click(); await p.waitForTimeout(1800);
  ok(`${label}: and back to the old loop: three coins, the pause gone`, (await p.locator('.lp-coin.lp-node').count()) === 3 && (await p.locator('.lp-coin[data-coin="1"]').evaluate(e => e.getAttribute('aria-hidden'))) === 'true' && (await habit(p)) === 'Cue');
  // no wide band of empty page under the loop before Claire's story
  if (!touch) { await p.evaluate(() => document.querySelector('.co-story').scrollIntoView({ block: 'center' })); await p.waitForTimeout(1300);
    const gap = await p.evaluate(() => document.querySelector('.co-story .eyebrow').getBoundingClientRect().top - Math.max(document.querySelector('#loopWrap .loopcard').getBoundingClientRect().bottom, document.querySelector('.lp3-stage').getBoundingClientRect().bottom));
    ok('desktop: the habit loop runs on into the story without a big empty band', gap < 180, `${Math.round(gap)}px`); }

  // ---- no selling in the middle of the story
  const middle = await p.evaluate(() => { const kit = document.querySelector('#coKit'), before = e => !!(e.compareDocumentPosition(kit) & Node.DOCUMENT_POSITION_FOLLOWING);
    return { links: [...document.querySelectorAll('.co a[href*="/product/"]')].filter(before).length, pics: [...document.querySelectorAll('.co img')].filter(before).filter(i => /candle|tins|batch|picker|verdant|cabana|roller|diffuser/i.test(i.getAttribute('src'))).length,
      say: /products create a moment/i.test(document.querySelector('.co').innerText), craft: /hand pours/i.test(document.querySelector('.co-story').innerText) }; });
  ok(`${label}: nothing is sold in the middle of the coaching story (no product links or candle pictures before the cue-kit section, no "products create a moment" line)`, !middle.links && !middle.pics && !middle.say && !middle.craft, JSON.stringify(middle));

  // ---- the 3D cue loop
  await p.evaluate(() => document.querySelector('#method').scrollIntoView({ block: 'start' })); await p.waitForTimeout(600);
  await p.evaluate(() => document.querySelector('.cue-stage').scrollIntoView({ block: 'center' })); await p.waitForTimeout(500);
  const centre = await p.evaluate(() => { const st = document.querySelector('.cue-stage');
    return { orb: st.querySelectorAll('.cue-orb .pl .pl-ball').length, imgs: st.querySelectorAll('img').length, candle: st.querySelectorAll('.lc, .cue-candle').length, refr: st.querySelectorAll('.pl-refr .cue-arc').length }; });
  ok(`${label}: the loop has four steps orbiting a pause light (a glass sphere), not the candle: no product, no photograph in the ring`, (await p.locator('.cue-card').count()) === 4 && centre.orb === 1 && centre.imgs === 0 && centre.candle === 0 && centre.refr === 4, JSON.stringify(centre));
  // the night's stars keep out of the words: with the method's lead made invisible, nothing bright is left in its box
  const lead = await p.evaluate(() => { const e = document.querySelector('.co-method .co-sub'); e.style.color = 'transparent'; e.querySelectorAll('*').forEach(c => { c.style.color = 'transparent'; c.style.background = 'none'; }); const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  await p.waitForTimeout(100);
  const specks = await p.evaluate(async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, L = []; for (let i = 0; i < d.length; i += 4) L.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]); const m = [...L].sort((a, b) => a - b)[L.length >> 1]; return L.filter(l => l > m + 45).length; },
    (await p.screenshot({ clip: lead })).toString('base64'));
  await p.evaluate(() => { const e = document.querySelector('.co-method .co-sub'); e.style.color = ''; e.querySelectorAll('*').forEach(c => { c.style.color = ''; c.style.background = ''; }); });
  ok(`${label}: no star lands among the words`, specks === 0, `${specks} bright specks in the lead's box`);
  // the sphere's light wakes once the loop is on screen: a quarter of the way, for the first step
  await p.waitForFunction(() => Number(getComputedStyle(document.querySelector('.cue')).getPropertyValue('--lit')) > 0.2, null, { timeout: 6000 }).catch(() => {});
  await p.waitForTimeout(1900);
  const lit0 = await light(p);
  ok(`${label}: the first step wakes the pause light a little: its inner light and caustic glow, but far from full`, Math.abs(lit0.lit - 0.25) < 0.01 && lit0.core > 0.3 && lit0.core < 0.6 && lit0.caustic > 0.15 && lit0.caustic < 0.4, JSON.stringify(lit0));
  const is3d = await p.evaluate(() => { const cs = [...document.querySelectorAll('.cue-card')].map(c => new DOMMatrix(getComputedStyle(c).transform));
    return getComputedStyle(document.querySelector('.cue-tilt')).transformStyle === 'preserve-3d' && !cs[0].is2D && new Set(cs.map(m => Math.round(m.m43))).size > 1; });
  ok(`${label}: the steps sit at different depths in real 3D`, is3d);
  ok(`${label}: it starts on the cue`, (await active(p)) === 'Cue' && (await pressed(p)) === 0);
  // a clean composition: the sphere stands in the middle of the ring (its foot inside the floor's ellipse, near its middle,
  // which perspective draws above the middle of its box), and at every step, and halfway between steps, no words show on the
  // steps round the back, nor overlap words on another step
  const seat = await p.evaluate(() => { const c = document.querySelector('.cue-orb .pl-ball').getBoundingClientRect(), f = document.querySelector('.cue-floor').getBoundingClientRect();
    return { foot: (c.bottom - f.top) / f.height, mid: Math.abs((c.left + c.right) / 2 - (f.left + f.right) / 2) / f.width }; });
  ok(`${label}: the sphere stands in the middle of the ring`, seat.foot > 0.2 && seat.foot < 0.6 && seat.mid < 0.06, JSON.stringify(seat));
  const words = () => p.evaluate(() => [...document.querySelectorAll('.cue-card')].map(c => { const o = Number(getComputedStyle(c).opacity), z = new DOMMatrix(getComputedStyle(c).transform).m43;
    return { z, rects: [...c.querySelectorAll('b, .cue-t, .cue-n')].map(e => ({ r: e.getBoundingClientRect().toJSON(), o: o * Number(getComputedStyle(e).opacity) })).filter(w => w.o > 0.06) }; }));
  const clash = ws => { const n = []; ws.forEach((a, i) => ws.forEach((b, j) => { if (j <= i) return; for (const x of a.rects) for (const y of b.rects) if (x.r.left < y.r.right && y.r.left < x.r.right && x.r.top < y.r.bottom && y.r.top < x.r.bottom) n.push([i, j]); })); return n; };
  const comp = [];
  for (let k = 0; k < 4; k++) {
    await p.locator('.cue-stage').focus(); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(160);
    const mid = await words(); await p.waitForTimeout(1400); const rest = await words();
    const back = await p.evaluate(() => [...document.querySelectorAll('.cue-card')].filter(c => new DOMMatrix(getComputedStyle(c).transform).m43 < 0)
      .map(c => ({ o: Number(getComputedStyle(c).opacity), ic: Number(getComputedStyle(c).opacity) * Number(getComputedStyle(c.querySelector('.cue-ic')).opacity) })));
    comp.push({ k, midClash: clash(mid).length, restClash: clash(rest).length, backWords: rest.filter(w => w.z < 0).reduce((n, w) => n + w.rects.length, 0), back });
  }
  ok(`${label}: no step's words collide with another's, and the steps round the back show none`, comp.every(c => !c.midClash && !c.restClash && !c.backWords), JSON.stringify(comp));
  ok(`${label}: the two steps round the back still show, as dimmer arches with their icons, so the ring reads as four steps`, comp.every(c => c.back.length === 2 && c.back.every(b => b.o >= 0.45 && b.o <= 0.62 && b.ic >= 0.4)), JSON.stringify(comp.map(c => c.back)));
  await p.locator('.cue-stage').focus(); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(300);
  ok(`${label}: the right arrow key turns the ring to the pause`, (await active(p)) === 'Pause' && (await pressed(p)) === 1, await active(p));
  ok(`${label}: the pause offers the one-minute breathing practice`, await p.locator('.cue-try').isVisible());
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(300);
  ok(`${label}: the left arrow key turns it back`, (await active(p)) === 'Cue');
  const ring0 = await p.evaluate(() => document.querySelector('.cue-card[data-i="0"]').style.transform);
  const box = await p.locator('.cue-stage').boundingBox(); const cy = box.y + box.height * 0.3;
  if (touch) {
    const cdp = await ctx.newCDPSession(p); const x0 = box.x + box.width * 0.8;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: cy }] });
    for (let k = 1; k <= 12; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 - k * 18, y: cy }] }); await p.waitForTimeout(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await p.mouse.move(box.x + box.width * 0.75, cy); await p.mouse.down();
    for (let k = 1; k <= 12; k++) { await p.mouse.move(box.x + box.width * 0.75 - k * 22, cy); await p.waitForTimeout(16); }
    await p.mouse.up();
  }
  await p.waitForTimeout(900);
  const afterDrag = await active(p), ring1 = await p.evaluate(() => document.querySelector('.cue-card[data-i="0"]').style.transform);
  ok(`${label}: ${touch ? 'a swipe' : 'dragging'} turns the ring to another step`, afterDrag !== 'Cue' && ring1 !== ring0, afterDrag);
  await p.locator('.cue-pill[data-pick="0"]').click(); await p.waitForTimeout(200);
  for (let k = 0; k < 3; k++) { await p.locator('.cue-arrow[data-go="1"]').click(); await p.waitForTimeout(250); }
  ok(`${label}: the next button walks the loop to Repeat`, (await active(p)) === 'Repeat');
  await p.waitForTimeout(2600);
  const done = await p.evaluate(() => ({ c: document.querySelector('.cue').classList.contains('complete'), lit: getComputedStyle(document.querySelector('.cue')).getPropertyValue('--lit').trim(), arcs: document.querySelectorAll('.cue-floor .cue-arc.lit').length, through: document.querySelectorAll('.pl-refr .cue-arc.lit').length }));
  const lit1 = await light(p);
  ok(`${label}: the pause light glows in full as the loop completes, and the whole ring shows lit through the glass`, done.c && Number(done.lit) === 1 && done.arcs === 4 && done.through === 4 && lit1.core > 0.95 && lit1.core > lit0.core * 2 && lit1.caustic > 0.85, JSON.stringify({ ...done, lit0, lit1 }));
  const meter = await p.locator('.cue-mtx').innerText();
  ok(`${label}: the meter speaks of the pause light, not a flame`, /pause light: 4 of 4 steps lit/i.test(meter) && !/flame|candle/i.test(meter), meter);
  const fin = await p.evaluate(() => { const f = document.querySelector('.co-final'); return { light: f.querySelectorAll('.co-final-light .pl .pl-core').length, imgs: f.querySelectorAll('img').length, products: f.querySelectorAll('a[href*="/product/"]').length }; });
  ok(`${label}: the last call to action shows the same pause light, not a product`, fin.light === 1 && !fin.imgs && !fin.products, JSON.stringify(fin));
  ok(`${label}: a completed loop leads to the free reset`, await p.locator('.cue-done').isVisible() && /\/reset$/.test(await p.locator('.cue-done a').getAttribute('href')));
  ok(`${label}: the step text is real text for screen readers`, (await p.locator('.cue-h[aria-live="polite"]').count()) === 1 && (await p.locator('.cue-stage[aria-label]').count()) === 1);

  // ---- the cue kit: one section near the end, after the ways to begin and before the last call to action
  await p.evaluate(() => document.querySelector('#coKit').scrollIntoView({ block: 'center' })); await p.waitForTimeout(1500);
  const kit = await p.evaluate(() => { const k = document.querySelector('#coKit'), after = (a, b) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING);
    const drafts = [...k.querySelectorAll('.co-kit-tx p, .co-kit-tx h2, .co-kit-tx .eyebrow, .kit-scent .eyebrow, .kit-scent > span:last-child, .kit-use')].every(e => { const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let n, okk = true; while ((n = w.nextNode())) if (n.textContent.trim() && !n.parentElement.closest('.d')) okk = false; return okk; });
    return { sections: document.querySelectorAll('.co section#coKit').length, afterWays: after(k, document.querySelector('.co-work')), beforeFinal: after(document.querySelector('#coFinal'), k), text: k.innerText, drafts,
      items: [...k.querySelectorAll('.kit-item')].map(a => ({ slug: decodeURIComponent(a.getAttribute('href').split('/product/')[1]), kind: a.className.match(/k-(\w+)/)[1], price: a.querySelector('.kit-price').textContent, plinth: !!a.querySelector('.kit-plinth .kit-top') && !!a.querySelector('.kit-plinth .kit-side') })),
      depth: !new DOMMatrix(getComputedStyle(k.querySelector('.kit-item.k-candle')).transform).is2D, persp: getComputedStyle(k.querySelector('.co-kit-stage')).perspective,
      candle: k.querySelectorAll('.k-candle .lc canvas.lc-flame').length, prices: [...document.querySelectorAll('.co *')].filter(e => e.children.length === 0 && /\$\s?\d/.test(e.textContent)).map(e => !!e.closest('#coKitStage')) }; });
  ok(`${label}: one cue-kit section, after the ways to begin and before the last call to action`, kit.sections === 1 && kit.afterWays && kit.beforeFinal, JSON.stringify({ a: kit.afterWays, b: kit.beforeFinal }));
  ok(`${label}: it links the two honestly: a familiar scent as the cue for a pause, and nothing to buy to begin`, /familiar scent as the cue for a calm pause/i.test(kit.text) && /nothing to buy/i.test(kit.text) && /any scent you already have/i.test(kit.text) && /optional/i.test(kit.text));
  ok(`${label}: no health or healing claims in it`, !/\b(heal|healing|cure|treat|therapy|therapeutic|anxiety|stress relief|reduces? stress|nervous system|wellness benefits?)\b/i.test(kit.text));
  ok(`${label}: all its words are drafts for Claire`, kit.drafts);
  ok(`${label}: an optional cue kit of real products, a roller and a candle among them, at their real prices`, kit.items.length >= 2 && kit.items.length <= 3 && ['roller', 'candle'].every(k => kit.items.some(i => i.kind === k)) && kit.items.every(i => slugs.has(i.slug) && i.price === priceOf(i.slug)), JSON.stringify(kit.items));
  ok(`${label}: the kit is dimensional: each piece floats over a plinth, the set in perspective, the candle lit`, kit.items.every(i => i.plinth) && kit.depth && kit.persp !== 'none' && kit.candle === 2, JSON.stringify({ depth: kit.depth, persp: kit.persp, candle: kit.candle }));
  ok(`${label}: prices appear only in the cue kit`, kit.prices.length >= 2 && kit.prices.every(Boolean), JSON.stringify(kit.prices));

  // ---- only real products, pictures below the fold wait, the page fits
  const prods = await p.evaluate(() => [...document.querySelectorAll('#app a[href*="/product/"]')].map(a => decodeURIComponent(a.getAttribute('href').split('/product/')[1])));
  ok(`${label}: every product linked is a real product`, prods.length >= 2 && prods.every(s => slugs.has(s)), prods.join(','));
  const lazy = await p.evaluate(() => [...document.querySelectorAll('.co img')].filter(i => !i.closest('.co-hero')).every(i => i.loading === 'lazy'));
  ok(`${label}: pictures below the opening load lazily`, lazy);
  if (touch) {
    await p.evaluate(() => document.querySelector('.co-work').scrollIntoView()); await p.waitForTimeout(700);
    ok('phone: both free offers stay one tap away while reading', await p.evaluate(() => { const d = document.querySelector('#coDock'); const r = d.getBoundingClientRect(); return d.classList.contains('show') && r.top > innerHeight - 120 && r.bottom <= innerHeight &&/reset$/.test(d.querySelector('a').getAttribute('href')) && /\/book/.test(d.querySelectorAll('a')[1].getAttribute('href')); }));
    ok('phone: while the bar shows, anything scrolled to stops above it', await p.evaluate(() => parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom) >= document.querySelector('#coDock').offsetHeight + 12));
    // it never sits over a control: with the loops' buttons, the cue kit or the reset's own button at the foot of the screen, it steps aside
    const aside = [];
    for (const sel of ['#loopWrap .loopnav', '.cue-nav', '.co-kit-stage', '.co-reset-card .btn']) {
      await p.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); scrollBy(0, r.bottom - innerHeight + 30); }, sel); await p.waitForTimeout(500);
      aside.push([sel, await p.evaluate(() => document.querySelector('#coDock').classList.contains('show'))]);
    }
    ok('phone: the bar steps aside wherever the foot of the screen holds a control', aside.every(([, shown]) => !shown), JSON.stringify(aside));
    await p.evaluate(() => document.querySelector('.co-work').scrollIntoView()); await p.waitForTimeout(1200);
    // the bar is solid (the words it passes over never show through it), and the page ends with room to scroll clear of it
    const bar = await p.evaluate(() => { const d = document.querySelector('#coDock'), bg = getComputedStyle(d).backgroundColor, a = bg.match(/rgba?\(([^)]+)\)/)[1].split(',').map(Number)[3];
      return { bg, alpha: a ?? 1, op: Number(getComputedStyle(d).opacity), room: parseFloat(getComputedStyle(document.querySelector('footer.cel-night'), '::after').height) || 0, h: d.offsetHeight }; });
    ok('phone: the bar is opaque, and the page ends with room below it', bar.alpha === 1 && bar.op === 1 && bar.room >= bar.h + 12, JSON.stringify(bar));
    await p.evaluate(() => document.querySelector('#coFinal').scrollIntoView()); await p.waitForTimeout(700);
    ok('phone: the bar steps aside at the last call to action', await p.evaluate(() => !document.querySelector('#coDock').classList.contains('show')));
  } else ok('desktop: no phone bar on a wide screen', await p.evaluate(() => getComputedStyle(document.querySelector('#coDock')).display === 'none'));
  ok(`${label}: no sideways scroll`, (await noScroll(p)) <= 1, String(await noScroll(p)));
  // leaving the page clears the phone bar's lift on the breathing orb
  await p.goto(base + '/shop'); await p.waitForTimeout(700);
  ok(`${label}: leaving coaching leaves nothing behind`, await p.evaluate(() => !document.body.classList.contains('co-docked') && !document.querySelector('.co-dock')));
  ok(`${label}: no JS errors`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}

{ // reduced motion: the four steps are flat and all readable at once
  for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const ctx = await b.newContext({ viewport: vp, reducedMotion: 'reduce' }); const p = await ctx.newPage(); p.setDefaultTimeout(10000); await setupMocks(p);
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(base + '/coaching'); await p.waitForSelector('.cue'); await p.waitForTimeout(800);
    await p.evaluate(() => document.querySelector('.cue').scrollIntoView({ block: 'center' })); await p.waitForTimeout(300);
    const st = await p.evaluate(() => ({ stat: document.querySelector('.cue').classList.contains('is-static'), stage: document.querySelectorAll('.cue-stage').length,
      items: [...document.querySelectorAll('.cue-list li')].map(li => ({ t: li.querySelector('h3').textContent, p: li.querySelector('p').textContent.length, h: li.getBoundingClientRect().height, o: getComputedStyle(li).opacity })) }));
    ok(`reduced motion ${label}: the loop is shown flat, no 3D ring`, st.stat && st.stage === 0);
    ok(`reduced motion ${label}: the flat loop stands round the pause light, fully lit, not a candle`, await p.evaluate(() => document.querySelectorAll('.cue-flat-orb .pl-core').length === 1 && !document.querySelector('.cue .lc, .cue img') && Number(getComputedStyle(document.querySelector('.cue')).getPropertyValue('--lit')) === 1));
    // the habit loop keeps every control, but nothing drifts or travels on its own and the old loop becomes the new one in one move
    await p.evaluate(() => document.querySelector('#loopWrap').scrollIntoView({ block: 'center' })); await p.waitForTimeout(400);
    const bd0 = await p.evaluate(() => document.querySelector('.lp3-bead').style.transform); await p.waitForTimeout(400);
    const bd1 = await p.evaluate(() => document.querySelector('.lp3-bead').style.transform);
    await p.locator('#loopWrap [data-mode="new"]').click(); await p.waitForTimeout(120);
    const rm = await p.evaluate(() => ({ live: document.querySelectorAll('.lp-coin.lp-node').length, pause: Number(document.querySelector('.lp-coin[data-coin="1"]').style.opacity), arcs: getComputedStyle(document.querySelector('.lp3-arcs path')).animationName }));
    ok(`reduced motion ${label}: the habit loop holds still (no travelling bead, no marching path) and switches loops at once`, bd0 === bd1 && rm.live === 4 && rm.pause === 1 && rm.arcs === 'none', JSON.stringify({ bd0, bd1, rm }));
    ok(`reduced motion ${label}: all four steps are readable at once`, st.items.length === 4 && st.items.every(i => i.h > 40 && i.p > 20 && i.o === '1') && /Cue/.test(st.items[0].t) && /Pause/.test(st.items[1].t), JSON.stringify(st.items.map(i => i.t)));
    ok(`reduced motion ${label}: every section is visible without waiting for a scroll`, await p.evaluate(() => [...document.querySelectorAll('.co-rv')].every(e => getComputedStyle(e).opacity === '1')));
    ok(`reduced motion ${label}: no JS errors`, errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
