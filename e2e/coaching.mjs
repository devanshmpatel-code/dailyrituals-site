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
  ok(`${label}: the loop has four steps orbiting a candle`, (await p.locator('.cue-card').count()) === 4 && (await p.locator('.cue-candle svg').count()) === 1);
  const is3d = await p.evaluate(() => { const cs = [...document.querySelectorAll('.cue-card')].map(c => new DOMMatrix(getComputedStyle(c).transform));
    return getComputedStyle(document.querySelector('.cue-tilt')).transformStyle === 'preserve-3d' && !cs[0].is2D && new Set(cs.map(m => Math.round(m.m43))).size > 1; });
  ok(`${label}: the steps sit at different depths in real 3D`, is3d);
  ok(`${label}: it starts on the cue`, (await active(p)) === 'Cue' && (await pressed(p)) === 0);
  const flame0 = await p.evaluate(() => document.querySelector('.cue-flame').getBoundingClientRect().height);
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
  await p.waitForTimeout(1400);
  const done = await p.evaluate(() => ({ c: document.querySelector('.cue').classList.contains('complete'), lit: getComputedStyle(document.querySelector('.cue')).getPropertyValue('--lit').trim(), arcs: document.querySelectorAll('.cue-arc.lit').length, h: document.querySelector('.cue-flame').getBoundingClientRect().height }));
  ok(`${label}: the flame brightens as the loop completes`, done.c && Number(done.lit) === 1 && done.arcs === 4 && done.h > flame0 * 1.2, JSON.stringify({ ...done, flame0 }));
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
