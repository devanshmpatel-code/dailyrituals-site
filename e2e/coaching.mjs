// The coaching page: Claire's opening, the two free ways in, the 3D calm-cue loop (drag, touch, keys, buttons, the flame
// brightening as the loop completes), the flat version for reduced motion, real products only, lazy pictures below the fold,
// the phone bar with both free offers, no sideways scroll and no script errors.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const slugs = new Set(JSON.parse(fs.readFileSync(new URL('./products.json', import.meta.url), 'utf8')).products.map(p => p.slug));
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const noScroll = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const active = p => p.evaluate(() => document.querySelector('.cue-hl')?.textContent);
// Claire's candle in the loop: how many flame canvases it has, how many bright flame pixels they hold above their wicks, and how
// far the lit photograph has glowed in
const candle = p => p.evaluate(() => { const box = document.querySelector('.cue-candle'); let flame = 0;
  for (const c of box.querySelectorAll('canvas.lc-flame')) { const [, by] = c.dataset.base.split(',').map(Number), top = Math.floor(by * c.width / c.clientWidth), d = c.getContext('2d').getImageData(0, 0, c.width, top).data; for (let i = 3; i < d.length; i += 4) if (d[i] > 200 && d[i - 3] > 230 && d[i - 2] > 170) flame++; }
  return { canvases: box.querySelectorAll('canvas.lc-flame').length, flame, glow: Number(getComputedStyle(box.querySelector('.lc-glow')).opacity) }; });
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

  // ---- the 3D cue loop
  await p.evaluate(() => document.querySelector('#method').scrollIntoView({ block: 'start' })); await p.waitForTimeout(600);
  await p.evaluate(() => document.querySelector('.cue-stage').scrollIntoView({ block: 'center' })); await p.waitForTimeout(500);
  const photo = await p.evaluate(() => { const c = document.querySelector('.cue-candle'), i = c?.querySelector('img.lc-unlit'), g = c?.querySelector('img.lc-glow');
    return { unlit: i?.currentSrc || i?.src || '', glow: g?.currentSrc || g?.src || '', loaded: !!i && i.complete && i.naturalWidth > 0 && !!g && g.complete && g.naturalWidth > 0, drawn: c?.querySelectorAll('svg').length ?? -1 }; });
  ok(`${label}: the loop has four steps orbiting Claire's candle, her photograph (not a drawing)`, (await p.locator('.cue-card').count()) === 4 && photo.loaded && photo.drawn === 0
    && /\/img\/studio\/picker\/(verdant|cabana)-unlit-(480|900)\.webp$/.test(photo.unlit) && /\/img\/studio\/picker\/(verdant|cabana)-glow-(480|900)\.webp$/.test(photo.glow), JSON.stringify(photo));
  // the night's stars keep out of the words: with the method's lead made invisible, nothing bright is left in its box
  const lead = await p.evaluate(() => { const e = document.querySelector('.co-method .co-sub'); e.style.color = 'transparent'; e.querySelectorAll('*').forEach(c => { c.style.color = 'transparent'; c.style.background = 'none'; }); const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  await p.waitForTimeout(100);
  const specks = await p.evaluate(async b64 => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data, L = []; for (let i = 0; i < d.length; i += 4) L.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]); const m = [...L].sort((a, b) => a - b)[L.length >> 1]; return L.filter(l => l > m + 45).length; },
    (await p.screenshot({ clip: lead })).toString('base64'));
  await p.evaluate(() => { const e = document.querySelector('.co-method .co-sub'); e.style.color = ''; e.querySelectorAll('*').forEach(c => { c.style.color = ''; c.style.background = ''; }); });
  ok(`${label}: no star lands among the words`, specks === 0, `${specks} bright specks in the lead's box`);
  // the candle catches once the loop is on screen: the lit photograph begins to glow in and a flame stands on each wick
  await p.waitForFunction(() => Number(getComputedStyle(document.querySelector('.cue-candle .lc-glow')).opacity) > 0.2, null, { timeout: 6000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const lit0 = await candle(p);
  ok(`${label}: the first step lights the candle a little: a flame on each wick, the lit glass only beginning to glow`, lit0.canvases === 2 && lit0.flame > 8 && lit0.glow > 0.2 && lit0.glow < 0.7, JSON.stringify(lit0));
  const is3d = await p.evaluate(() => { const cs = [...document.querySelectorAll('.cue-card')].map(c => new DOMMatrix(getComputedStyle(c).transform));
    return getComputedStyle(document.querySelector('.cue-tilt')).transformStyle === 'preserve-3d' && !cs[0].is2D && new Set(cs.map(m => Math.round(m.m43))).size > 1; });
  ok(`${label}: the steps sit at different depths in real 3D`, is3d);
  ok(`${label}: it starts on the cue`, (await active(p)) === 'Cue' && (await pressed(p)) === 0);
  // a clean composition: the candle stands on the ring (its foot inside the floor's ellipse, near its middle, which perspective
  // draws above the middle of its box), and at every
  // step, and halfway between steps, no words show on the steps round the back, nor overlap words on another step
  const seat = await p.evaluate(() => { const c = document.querySelector('.cue-candle').getBoundingClientRect(), f = document.querySelector('.cue-floor').getBoundingClientRect(); return { foot: (c.bottom - f.top) / f.height, top: c.top }; });
  ok(`${label}: the candle stands on the ring, not floating above it`, seat.foot > 0.25 && seat.foot < 0.6, JSON.stringify(seat));
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
  const done = await p.evaluate(() => ({ c: document.querySelector('.cue').classList.contains('complete'), lit: getComputedStyle(document.querySelector('.cue')).getPropertyValue('--lit').trim(), arcs: document.querySelectorAll('.cue-arc.lit').length }));
  const lit1 = await candle(p);
  ok(`${label}: the candle comes fully alight as the loop completes: the flames grow and the lit photograph glows in`, done.c && Number(done.lit) === 1 && done.arcs === 4 && lit1.flame > lit0.flame * 1.4 && lit1.glow > 0.9, JSON.stringify({ ...done, lit0, lit1 }));
  const fin = await p.evaluate(() => { const i = document.querySelector('.co-final-flame img.lc-unlit'); return { photo: !!i && /\/img\/studio\/picker\//.test(i.getAttribute('src')), drawn: document.querySelectorAll('.co-final-flame svg').length }; });
  ok(`${label}: the candle under the last call to action is the same photograph`, fin.photo && fin.drawn === 0, JSON.stringify(fin));
  ok(`${label}: a completed loop leads to the free reset`, await p.locator('.cue-done').isVisible() && /\/reset$/.test(await p.locator('.cue-done a').getAttribute('href')));
  ok(`${label}: the step text is real text for screen readers`, (await p.locator('.cue-h[aria-live="polite"]').count()) === 1 && (await p.locator('.cue-stage[aria-label]').count()) === 1);

  // ---- only real products, pictures below the fold wait, the page fits
  const prods = await p.evaluate(() => [...document.querySelectorAll('#app a[href*="/product/"]')].map(a => decodeURIComponent(a.getAttribute('href').split('/product/')[1])));
  ok(`${label}: every product linked is a real product`, prods.length >= 2 && prods.every(s => slugs.has(s)), prods.join(','));
  ok(`${label}: no prices are invented on the page`, !/\$\s?\d/.test(await p.evaluate(() => document.querySelector('.co').innerText)));
  const lazy = await p.evaluate(() => [...document.querySelectorAll('.co img')].filter(i => !i.closest('.co-hero')).every(i => i.loading === 'lazy'));
  ok(`${label}: pictures below the opening load lazily`, lazy);
  if (touch) {
    await p.evaluate(() => document.querySelector('.co-work').scrollIntoView()); await p.waitForTimeout(700);
    ok('phone: both free offers stay one tap away while reading', await p.evaluate(() => { const d = document.querySelector('#coDock'); const r = d.getBoundingClientRect(); return d.classList.contains('show') && r.top > innerHeight - 120 && r.bottom <= innerHeight &&/reset$/.test(d.querySelector('a').getAttribute('href')) && /\/book/.test(d.querySelectorAll('a')[1].getAttribute('href')); }));
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
    ok(`reduced motion ${label}: all four steps are readable at once`, st.items.length === 4 && st.items.every(i => i.h > 40 && i.p > 20 && i.o === '1') && /Cue/.test(st.items[0].t) && /Pause/.test(st.items[1].t), JSON.stringify(st.items.map(i => i.t)));
    ok(`reduced motion ${label}: every section is visible without waiting for a scroll`, await p.evaluate(() => [...document.querySelectorAll('.co-rv')].every(e => getComputedStyle(e).opacity === '1')));
    ok(`reduced motion ${label}: no JS errors`, errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
