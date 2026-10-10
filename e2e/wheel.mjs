// Find your scent: the scent atlas (src/pages/wheel.ts). Five constellations on a nocturne plate, one star per scent.
// Choosing a constellation turns the sky (about a second); the plate carries .moving while it turns, so the tests wait
// for it to settle instead of sleeping. Stars twinkle all the time, so taps on the sky are forced, as a visitor's tap is.
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const OF = { fresh: ['Citrus & Sun', 'Windy Beach', 'Sea Foam'], sunny: ['Cabana', 'Tropical Passion'], floral: ['Peony Bloom', 'Golden Apricot'], woody: ['Cedar Santal', 'Campfire Stories', 'Desert Vesper'], grounding: ['Inner Sanctum', 'Golden Meridian', 'Verdant'] };
for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'America/Vancouver' }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const h3 = () => p.locator('.wpanel h3').innerText();
  const settled = () => p.waitForFunction(() => { const pl = document.querySelector('.wplate'); return pl && !pl.classList.contains('moving'); });
  const tap = async sel => { await p.locator(sel).first().click({ force: true }); await settled(); };
  const shot = n => p.locator('.watlas').screenshot({ path: `${process.env.SHOTS ?? '/tmp'}/${label}-wheel-${n}.png` });
  const overflow = async () => (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1;
  const bbox = sel => p.locator(sel).first().boundingBox();
  const svgText = sel => p.evaluate(s => [...document.querySelectorAll(s)].map(e => e.textContent.trim()).join(' '), sel);
  const open = () => p.goto(base + '/explore').then(() => p.waitForSelector('.wheel svg')).then(settled);
  // where the chosen constellation's stars sit: under the index at the top of the chart
  const topOn = (pg, sel) => pg.evaluate(s => { const g = document.querySelector(s), r = g.querySelector('.wcore').getBoundingClientRect(), c = document.querySelector('.wsvg').getBoundingClientRect(); return (r.y + r.height / 2 - c.y) / c.height; }, sel);
  const atTop = sel => topOn(p, sel);

  await open();
  ok(`${label}: five constellations on the plate`, (await p.locator('.wcon').count()) === 5);
  ok(`${label}: the plate is labelled like a star atlas`, (await svgText('.wreg')) === 'FRESH SUNNY FLORAL WOODY GROUNDING', await svgText('.wreg'));
  ok(`${label}: one star per scent, in the mood's star colour`, (await p.locator('.wstar').count()) === 13 && (await p.locator('.wcon[data-mood="fresh"] .wstar').count()) === 3 && await p.evaluate(() => getComputedStyle(document.querySelector('.wcon[data-mood="fresh"] .whalo')).fill === 'rgb(163, 200, 192)'));
  ok(`${label}: tonight's moon is drawn with its phase named`, (await p.locator('.wmoon-l').count()) === 1 && /moon|crescent|quarter|gibbous/i.test(await svgText('.wcap.dim')), await svgText('.wcap.dim'));
  ok(`${label}: the plate is nocturne with moonstone type`, await p.evaluate(() => { const bg = getComputedStyle(document.querySelector('.wplate')).backgroundImage; return /42, 51, 88|2a3358/i.test(bg) && getComputedStyle(document.querySelector('.wreg')).fill === 'rgb(201, 163, 90)' && getComputedStyle(document.querySelector('.wname')).fill === 'rgb(237, 230, 218)'; }));
  ok(`${label}: starts by inviting you to read the sky`, /sky/.test(await h3()), await h3());
  ok(`${label}: no stars open before a constellation is chosen`, (await p.locator('.wstar.open').count()) === 0 && (await p.locator('.wplate.picked').count()) === 0);
  ok(`${label}: constellations are real buttons with labels`, await p.evaluate(() => [...document.querySelectorAll('.wcon-btn')].every(g => g.getAttribute('role') === 'button' && g.tabIndex === 0 && /scents?$/.test(g.getAttribute('aria-label')) && g.getAttribute('aria-pressed') === 'false')));
  ok(`${label}: hidden stars are out of the tab order and the accessibility tree`, await p.evaluate(() => [...document.querySelectorAll('.wstar')].every(g => g.tabIndex === -1 && g.getAttribute('aria-hidden') === 'true')));
  const hb = await bbox('.wcon-btn[data-mood="fresh"] .whit'); ok(`${label}: a constellation is a comfortable touch target`, hb.width >= 44 && hb.height >= 44, `${Math.round(hb.width)}px`);
  ok(`${label}: the sky is alive on screen (twinkle and ring run) and the lines have drawn`, await p.evaluate(() => document.querySelector('.wplate').classList.contains('live') && getComputedStyle(document.querySelector('.wtw')).animationName === 'wtw' && getComputedStyle(document.querySelector('.wouter')).animationName === 'wturn'));
  await p.waitForFunction(() => [...document.querySelectorAll('.wlines')].every(l => Number(getComputedStyle(l).strokeDashoffset.replace('px', '')) < .01), null, { timeout: 4000 }).then(() => ok(`${label}: the constellation lines draw themselves in`, true), () => ok(`${label}: the constellation lines draw themselves in`, false));
  await shot('start');

  // hover: the constellation under the pointer brightens, the others step back
  if (label === 'desktop') {
    await p.locator('.wcon-btn[data-mood="woody"] .whit').hover({ force: true });
    ok(`${label}: hovering a constellation dims the others`, await p.waitForFunction(() => Number(getComputedStyle(document.querySelector('.wcon[data-mood="fresh"]')).opacity) < .5 && Number(getComputedStyle(document.querySelector('.wcon[data-mood="woody"]')).opacity) === 1, null, { timeout: 3000 }).then(() => true, () => false));
    await shot('hover'); await p.mouse.move(5, 5);
  }

  // pointer: tap a constellation
  await tap('.wcon-btn[data-mood="woody"] .whit');
  ok(`${label}: tapping a constellation opens its mood`, /Warm and woody/.test(await h3()), await h3());
  ok(`${label}: the sky turns so the chosen constellation sits under the index`, await p.evaluate(() => document.querySelector('.wcon-btn[data-mood="woody"]').getAttribute('aria-pressed') === 'true') && (await atTop('.wcon[data-mood="woody"] .wstar:nth-of-type(2)')) < .36, String(await atTop('.wcon[data-mood="woody"] .wstar:nth-of-type(2)')));
  ok(`${label}: the index lights and the others wait, dimmed, still a tap away`, await p.evaluate(() => Number(getComputedStyle(document.querySelector('.windex')).opacity) === 1 && Number(getComputedStyle(document.querySelector('.wcon[data-mood="fresh"]')).opacity) < .5 && document.querySelector('.wcon-btn[data-mood="fresh"]').tabIndex === 0));
  const nOpen = await p.locator('.wstar.open').count(); ok(`${label}: its stars open and are named`, nOpen === 3 && (await p.locator('.wstar.open[data-mood="woody"]').count()) === 3 && await p.evaluate(() => [...document.querySelectorAll('.wstar.open')].every(g => g.tabIndex === 0 && g.getAttribute('aria-hidden') === 'false' && g.getAttribute('role') === 'button')), `${nOpen}`);
  await p.waitForFunction(() => [...document.querySelectorAll('.wcon.on .wname')].every(t => getComputedStyle(t).opacity === '1'), null, { timeout: 3000 }).then(() => ok(`${label}: the star names fade in`, true), () => ok(`${label}: the star names fade in`, false));
  ok(`${label}: star names stay upright after the turn and read moonstone`, await p.evaluate(() => [...document.querySelectorAll('.wcon.on .wname')].every(t => { const m = t.getScreenCTM(); const r = t.getBoundingClientRect(); return r.width > r.height && Math.abs(m.b) < .02 && getComputedStyle(t).fill === 'rgb(237, 230, 218)'; })));
  const sb = await bbox('.wstar.open .wshit'); ok(`${label}: a star is a comfortable touch target`, sb.width >= 40 && sb.height >= 40, `${Math.round(sb.width)}x${Math.round(sb.height)}`);
  ok(`${label}: the panel lists the scents and the ready-made ritual`, (await p.locator('[data-pick]').count()) === 3 && (await p.locator('[data-addpair]').count()) === 1 && /Desert Vesper diffuser \+ Cabana roller/.test(await p.locator('.writ').innerText()));
  await shot('mood');
  const cc = Number(await p.locator('#cartCount').innerText()); await p.locator('[data-addpair]').click(); await p.waitForFunction(n => Number(document.querySelector('#cartCount').textContent) === n + 2, cc, { timeout: 3000 }).catch(() => {});
  ok(`${label}: the ritual button adds both items to the cart`, Number(await p.locator('#cartCount').innerText()) === cc + 2, `${cc} -> ${await p.locator('#cartCount').innerText()}`);
  // every mood's ready-made pair is made of that mood's own scents (Night's ritual is woody + grounding, so floral builds its own)
  for (const m of Object.keys(OF)) {
    await p.locator(`.wmoods [data-mood-chip="${m}"]`).click(); await settled();
    const tx = (await p.locator('.writ').count()) ? await p.locator('.writ b').innerText() : '';
    const moods = await p.evaluate(t => t.split(' + ').map(x => x.replace(/ (diffuser|roller)$/i, '')), tx);
    ok(`${label}: the ${m} ritual leads with a ${m} scent`, moods.length === 2 && OF[m].some(s => s.toLowerCase() === moods[0].toLowerCase()), tx);
    ok(`${label}: the ${m} constellation comes to the top`, (await p.locator(`.wcon.on[data-mood="${m}"]`).count()) === 1 && (await atTop(`.wcon[data-mood="${m}"] .wstar`)) < .4);
  }
  const cf = Number(await p.locator('#cartCount').innerText()); await p.locator('[data-addpair]').click(); await p.waitForFunction(n => Number(document.querySelector('#cartCount').textContent) === n + 2, cf, { timeout: 3000 }).catch(() => {});
  ok(`${label}: a mood's own pair also adds both items`, Number(await p.locator('#cartCount').innerText()) === cf + 2);
  await p.locator('.wmoods [data-mood-chip="floral"]').click(); await settled();
  ok(`${label}: floral offers a floral pair, not the night ritual`, /Peony Bloom diffuser \+ Golden Apricot roller/.test(await p.locator('.writ').innerText()) && !/Campfire/.test(await p.locator('.writ').innerText()), await p.locator('.writ').innerText());
  await shot('floral');
  await p.locator('.wmoods [data-mood-chip="woody"]').click(); await settled();

  // pointer: tap a star, then a format chip
  await tap('.wstar.open[data-scent="Desert Vesper"] .wshit');
  ok(`${label}: tapping a star shows the scent`, (await h3()) === 'Desert Vesper' && (await p.locator('.wstar.sel[aria-pressed="true"]').count()) === 1, await h3());
  ok(`${label}: the chosen star wears its ring`, await p.waitForFunction(() => getComputedStyle(document.querySelector('.wstar.sel .wsel')).opacity === '1', null, { timeout: 3000 }).then(() => true, () => false));
  const fmts = await p.locator('.wpanel a.chip').count(); ok(`${label}: formats and prices are listed`, fmts === 3 && /\$\d+\.\d\d/.test(await p.locator('.wpanel a.chip').first().innerText()), `${fmts}`);
  await shot('scent');
  await p.locator('[data-back]').click(); await settled(); ok(`${label}: back returns to the mood`, /Warm and woody/.test(await h3()) && (await p.locator('.wstar.sel').count()) === 0);
  await p.locator('[data-pick]').first().hover(); await p.waitForTimeout(100);
  ok(`${label}: hovering a scent chip hints at its star`, (await p.locator('.wstar.hint[data-scent="Campfire Stories"]').count()) === 1);
  await p.locator('[data-pick]').first().click(); await settled(); ok(`${label}: a scent chip in the panel also picks it`, (await h3()) === 'Campfire Stories', await h3());
  await p.locator('.wpanel a.chip').first().click(); await p.waitForURL('**/product/**'); ok(`${label}: a format chip opens the product`, /\/product\//.test(p.url()), p.url().split('#')[1]);

  // tap the open sky near a constellation; tap the chosen one again to let the sky go
  await open(); await p.locator('.wsvg').scrollIntoViewIfNeeded(); await settled();
  const fb = await bbox('.wcon-btn[data-mood="floral"] .whit'); await p.mouse.click(fb.x + fb.width + 14, fb.y + fb.height / 2); await settled();
  ok(`${label}: tapping the sky near a constellation chooses it`, /Soft and floral/.test(await h3()), await h3());
  await tap('.wcon-btn[data-mood="grounding"] .whit'); ok(`${label}: a dimmed constellation switches the mood`, /Grounding/.test(await h3()));
  const rb = await bbox('.wcon.on .wreg'); await p.mouse.click(rb.x + rb.width / 2, rb.y + rb.height / 2); await settled();
  ok(`${label}: tapping the sky by the chosen constellation again releases it`, /sky/.test(await h3()) && (await p.locator('.wstar.open').count()) === 0 && (await p.locator('.wplate.picked').count()) === 0, await h3());
  ok(`${label}: the sky settles back to its home orientation`, await p.evaluate(() => /scale\(1\.000\) rotate\(0\.00\)/.test(document.querySelector('.wsky').getAttribute('transform'))), await p.evaluate(() => document.querySelector('.wsky').getAttribute('transform')));

  // keyboard
  await p.locator('.wcon-btn[data-mood="fresh"]').focus(); await p.keyboard.press('ArrowRight'); ok(`${label}: arrow keys move between constellations`, await p.evaluate(() => document.activeElement?.getAttribute('data-mood')) === 'sunny');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('Enter'); await settled();
  ok(`${label}: Enter on a constellation opens its mood`, /Fresh and coastal/.test(await h3()) && (await p.locator('.wcon-btn[data-mood="fresh"][aria-pressed="true"]').count()) === 1);
  ok(`${label}: focus stays on the chosen constellation with a visible ring`, await p.waitForFunction(() => { const g = document.activeElement; return g?.classList.contains('wcon-btn') && g.dataset.mood === 'fresh' && Number(getComputedStyle(g.querySelector('.wfoc')).opacity) > .5; }, null, { timeout: 2000 }).then(() => true, () => false));
  await p.keyboard.press('Tab'); ok(`${label}: Tab walks on to the open stars`, await p.evaluate(() => document.activeElement?.classList.contains('wstar')));
  await p.keyboard.press('ArrowRight'); await p.keyboard.press(' '); await settled();
  ok(`${label}: Space on a star picks it`, (await p.locator('.wstar.sel').count()) === 1 && (await h3()) === (await p.locator('.wstar.sel').getAttribute('data-scent')), await h3());
  ok(`${label}: the focused star shows its ring`, await p.waitForFunction(() => document.activeElement?.classList.contains('wstar') && getComputedStyle(document.activeElement.querySelector('.wsfoc')).opacity === '1', null, { timeout: 2000 }).then(() => true, () => false));
  await shot('focus');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('ArrowLeft'); ok(`${label}: arrows wrap around the open stars only`, await p.evaluate(() => document.activeElement?.classList.contains('open') && document.activeElement.dataset.mood === 'fresh'));
  await p.locator('.wmoods [data-mood-chip="sunny"]').click(); await settled(); ok(`${label}: the mood chips under the panel switch moods`, /Sunny and tropical/.test(await h3()) && (await p.locator('.wstar.open').count()) === 2);

  // guide me: two quick questions, then the sky turns to the answer
  await open(); await p.locator('[data-guide]').click();
  ok(`${label}: Guide me asks when you will reach for it`, /reach for it/.test(await h3()) && (await p.locator('[data-gmoment]').count()) === 5);
  await p.locator('[data-gmoment="golden"]').click();
  ok(`${label}: then how you would like it, from the formats this mood really comes in`, /Diffuse it/.test(await h3()) && (await p.locator('[data-gfmt]').evaluateAll(a => a.map(x => x.dataset.gfmt).join(','))) === 'candle,diffuser,roller,any');
  await p.locator('[data-gback]').click(); ok(`${label}: Back returns to the first question`, /reach for it/.test(await h3()));
  await p.locator('[data-gmoment="golden"]').click(); await p.locator('[data-gfmt="diffuser"]').click(); await settled();
  ok(`${label}: the answers turn the sky to the matching constellation`, /Warm and woody/.test(await h3()) && (await p.locator('.wcon.on[data-mood="woody"]').count()) === 1 && /golden hour/i.test(await p.locator('.wpanel .eyebrow').first().innerText()), await p.locator('.wpanel .eyebrow').first().innerText());
  ok(`${label}: scents without that format step aside until asked for`, (await p.locator('[data-pick]').count()) === 2 && (await p.locator('[data-allfmt]').count()) === 1, String(await p.locator('[data-pick]').count()));
  await shot('guided');
  await p.locator('[data-pick="Desert Vesper"]').click(); await settled(); ok(`${label}: the guided format leads the scent's chips`, (await p.locator('.wfmt.lead').count()) === 1 && /Mini Diffuser/.test(await p.locator('.wfmt.lead').innerText()));
  await p.locator('[data-back]').click(); await p.locator('[data-allfmt]').click(); await settled(); ok(`${label}: and the whole constellation can be shown again`, (await p.locator('[data-pick]').count()) === 3);

  // deep links and the rest of the page
  await p.goto(base + '/explore?mood=woody'); await p.waitForSelector('.wpanel h3'); await settled();
  ok(`${label}: ?mood= preselects a constellation (home hero and quiz link here)`, /Warm and woody/.test(await h3()) && (await p.locator('.wcon.on[data-mood="woody"]').count()) === 1 && (await atTop('.wcon[data-mood="woody"] .wstar:nth-of-type(2)')) < .36);
  await p.goto(base + '/explore?mood=nope'); await p.waitForSelector('.wpanel h3'); ok(`${label}: an unknown ?mood= falls back to the start`, /sky/.test(await h3()));
  await p.goto(base + '/explore'); await p.waitForSelector('#exp .fl-card'); ok(`${label}: full list still below`, (await p.locator('#exp .fl-card').count()) > 5);
  await p.locator('.findtabs a:has-text("Take the quiz")').click(); await p.waitForSelector('[data-ans]'); ok(`${label}: the quiz tab still opens`, (await p.locator('[data-ans]').count()) >= 4);
  ok(`${label}: leaving the atlas tears it down`, await p.evaluate(() => !document.querySelector('.wplate')));
  await p.goto(base + '/explore'); await p.waitForSelector('.wheel svg'); await p.locator('.wpanel .btn.line[href*="quiz"]').click(); await p.waitForSelector('[data-ans]'); ok(`${label}: the panel's quiz link opens the quiz`, true);
  ok(`${label}: no sideways scroll`, await overflow());
  ok(`${label}: no JS errors`, errs.length === 0, errs.join('|'));
  await ctx.close();

  // reduced motion: a still sky, still complete
  const rctx = await b.newContext({ viewport: vp, reducedMotion: 'reduce' }); const rp = await rctx.newPage(); rp.setDefaultTimeout(8000); await setupMocks(rp);
  await rp.goto(base + '/explore?mood=grounding'); await rp.waitForSelector('.wstar.open');
  ok(`${label}: reduced motion keeps the sky still`, await rp.evaluate(() => [...document.querySelectorAll('.wtw, .wouter, .wlines')].every(e => getComputedStyle(e).animationName === 'none') && !document.querySelector('.wplate').classList.contains('moving')));
  ok(`${label}: reduced motion still shows the lines, the open stars and the panel`, await rp.evaluate(() => [...document.querySelectorAll('.wlines')].every(l => Number(getComputedStyle(l).strokeDashoffset.replace('px', '')) === 0)) && (await rp.locator('.wstar.open').count()) === 3 && /Grounding/.test(await rp.locator('.wpanel h3').innerText()) && (await topOn(rp, '.wcon[data-mood="grounding"] .wstar')) < .4);
  await rp.locator('.wcon-btn[data-mood="sunny"] .whit').click({ force: true }); await rp.waitForTimeout(100);
  ok(`${label}: reduced motion turns the sky at once`, (await rp.locator('.wcon.on[data-mood="sunny"]').count()) === 1 && !(await rp.evaluate(() => document.querySelector('.wplate').classList.contains('moving'))));
  await rp.locator('.watlas').screenshot({ path: `${process.env.SHOTS ?? '/tmp'}/${label}-wheel-reduced.png` });
  await rctx.close();
}
{ // the plate pauses when the tab is hidden, and keeps its choice when the viewport crosses the phone breakpoint
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  await p.goto(base + '/explore?mood=floral'); await p.waitForSelector('.wstar.open');
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  ok('hidden tab: the twinkle and the ring pause', !(await p.evaluate(() => document.querySelector('.wplate').classList.contains('live'))));
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  ok('visible again: the sky comes back to life', await p.evaluate(() => document.querySelector('.wplate').classList.contains('live')));
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(300);
  ok('narrowing to a phone redraws the plate in portrait and keeps the choice', (await p.locator('.wplate.portrait').count()) === 1 && (await p.locator('.wcon.on[data-mood="floral"]').count()) === 1 && /Soft and floral/.test(await p.locator('.wpanel h3').innerText()));
  await ctx.close();
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
