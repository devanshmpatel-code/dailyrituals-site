// Find your scent: the scent compass (src/pages/wheel.ts). Blooms drift a few units all the time, so Playwright never
// sees them as "stable"; clicks on them are forced, which is what a visitor's tap does anyway.
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'America/Vancouver' }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const h3 = () => p.locator('.wpanel h3').innerText();
  const tap = sel => p.locator(sel).first().click({ force: true }).then(() => p.waitForTimeout(350));
  const shot = n => p.locator('.wcompass').screenshot({ path: `${process.env.SHOTS ?? '/tmp'}/${label}-wheel-${n}.png` });
  const overflow = async () => (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1;
  const bbox = sel => p.locator(sel).first().boundingBox();

  await p.goto(base + '/explore'); await p.waitForSelector('.wheel svg'); await p.waitForTimeout(600);
  ok(`${label}: five mood blooms on the field`, (await p.locator('.wbloom').count()) === 5);
  const svgText = sel => p.evaluate(s => [...document.querySelectorAll(s)].map(e => e.textContent.trim()).join(' '), sel);
  ok(`${label}: four axis words frame the compass`, (await svgText('.wax')) === 'BRIGHT SOFT FRESH WARM', await svgText('.wax'));
  ok(`${label}: starts by asking how you want to feel`, /feel/.test(await h3()), await h3());
  ok(`${label}: no scents open before a mood is chosen`, (await p.locator('.wpetal:not(.out)').count()) === 0);
  ok(`${label}: blooms are real buttons with labels`, await p.evaluate(() => [...document.querySelectorAll('.wbloom')].every(g => g.getAttribute('role') === 'button' && g.tabIndex === 0 && /scents$/.test(g.getAttribute('aria-label')) && g.getAttribute('aria-pressed') === 'false')));
  const bb = await bbox('.wbloom[data-mood="fresh"]'); ok(`${label}: a bloom is a comfortable touch target`, bb.width >= 40 && bb.height >= 40, `${Math.round(bb.width)}px`);
  await shot('start');

  // pointer: tap a bloom
  await tap('.wbloom[data-mood="woody"]'); await p.waitForTimeout(900);
  ok(`${label}: tapping a bloom opens its mood`, /Warm and woody/.test(await h3()), await h3());
  ok(`${label}: the chosen bloom is pressed and sits at the centre`, await p.evaluate(() => { const g = document.querySelector('.wbloom[data-mood="woody"]'); const s = document.querySelector('.wsvg').getBoundingClientRect(); const r = g.querySelector('.worb circle').getBoundingClientRect(); return g.getAttribute('aria-pressed') === 'true' && Math.abs(r.x + r.width / 2 - (s.x + s.width / 2)) < 12 && Math.abs(r.y + r.height / 2 - (s.y + s.height / 2)) < 12; }));
  const open = await p.locator('.wpetal:not(.out)').count(); ok(`${label}: its scents open around it`, open === 3 && (await p.locator('.wpetal:not(.out)[data-mood="woody"]').count()) === 3, `${open}`);
  ok(`${label}: other moods wait at the rim, still buttons`, (await p.locator('.wbloom.rim[tabindex="0"]').count()) === 4);
  ok(`${label}: hidden scents are out of the tab order and the accessibility tree`, await p.evaluate(() => [...document.querySelectorAll('.wpetal.out')].every(g => g.tabIndex === -1 && g.getAttribute('aria-hidden') === 'true')));
  const sb = await bbox('.wpetal:not(.out)'); ok(`${label}: a scent orb is a comfortable touch target`, sb.width >= 40 && sb.height >= 40, `${Math.round(sb.width)}x${Math.round(sb.height)}`);
  ok(`${label}: the panel lists the scents and the ready-made ritual`, (await p.locator('[data-pick]').count()) === 3 && (await p.locator('[data-addpair]').count()) === 1 && /Desert Vesper diffuser \+ Cabana roller/.test(await p.locator('.writ').innerText()));
  await shot('mood');
  const cc = Number(await p.locator('#cartCount').innerText()); await p.locator('[data-addpair]').click(); await p.waitForTimeout(600);
  ok(`${label}: the ritual button adds both items to the cart`, Number(await p.locator('#cartCount').innerText()) === cc + 2, `${cc} -> ${await p.locator('#cartCount').innerText()}`);

  // pointer: tap a scent orb, then a format chip
  await tap('.wpetal:not(.out)[data-scent="Desert Vesper"]'); await p.waitForTimeout(500);
  ok(`${label}: tapping a scent orb shows the scent`, (await h3()) === 'Desert Vesper' && (await p.locator('.wpetal.sel[aria-pressed="true"]').count()) === 1, await h3());
  ok(`${label}: the centre bloom names the scent`, /Desert\s*Vesper/.test(await svgText('.wbloom.on .wbt')), await svgText('.wbloom.on .wbt'));
  const fmts = await p.locator('.wpanel a.chip').count(); ok(`${label}: formats and prices are listed`, fmts === 3 && /\$\d+\.\d\d/.test(await p.locator('.wpanel a.chip').first().innerText()), `${fmts}`);
  await shot('scent');
  await p.locator('[data-back]').click(); await p.waitForTimeout(300); ok(`${label}: back returns to the mood`, /Warm and woody/.test(await h3()));
  await p.locator('[data-pick]').first().click(); await p.waitForTimeout(300); ok(`${label}: a scent chip in the panel also picks it`, (await h3()) === 'Campfire Stories', await h3());
  await p.locator('.wpanel a.chip').first().click(); await p.waitForTimeout(600); ok(`${label}: a format chip opens the product`, /\/product\//.test(p.url()), p.url().split('#')[1]);

  // tap the open field near a bloom
  await p.goto(base + '/explore'); await p.waitForSelector('.wheel svg'); await p.locator('.wsvg').scrollIntoViewIfNeeded(); await p.waitForTimeout(600);
  const fb = await bbox('.wbloom[data-mood="floral"]'); await p.mouse.click(fb.x + fb.width / 2 + 28, fb.y + fb.height + 24); await p.waitForTimeout(700);
  ok(`${label}: tapping the field near a bloom chooses it`, /Soft and floral/.test(await h3()), await h3());
  ok(`${label}: a rim bloom switches the mood`, await tap('.wbloom.rim[data-mood="grounding"]').then(h3).then(t => /Grounding/.test(t)));
  await tap('.wbloom.on'); ok(`${label}: tapping the centre bloom again closes the mood`, /feel/.test(await h3()) && (await p.locator('.wpetal:not(.out)').count()) === 0);

  // keyboard
  await p.locator('.wbloom[data-mood="fresh"]').focus(); await p.keyboard.press('ArrowRight'); ok(`${label}: arrow keys move between blooms`, await p.evaluate(() => document.activeElement?.getAttribute('data-mood')) === 'sunny');
  await p.keyboard.press('ArrowLeft'); await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  ok(`${label}: Enter on a bloom opens its mood`, /Fresh and coastal/.test(await h3()) && (await p.locator('.wbloom[data-mood="fresh"][aria-pressed="true"]').count()) === 1);
  ok(`${label}: focus stays on the chosen bloom with a visible ring`, await p.evaluate(() => { const g = document.activeElement; return g?.classList.contains('wbloom') && getComputedStyle(g.querySelector('.wbring')).opacity === '1'; }));
  await shot('focus');
  await p.keyboard.press('Shift+Tab'); ok(`${label}: Shift+Tab walks back to the open scents`, await p.evaluate(() => document.activeElement?.classList.contains('wpetal')));
  await p.keyboard.press('ArrowRight'); await p.keyboard.press(' '); await p.waitForTimeout(400);
  ok(`${label}: Space on a scent orb picks it`, (await p.locator('.wpetal.sel').count()) === 1 && (await h3()) === (await p.locator('.wpetal.sel').getAttribute('data-scent')), await h3());
  ok(`${label}: the picked scent shows its ring`, await p.waitForFunction(() => getComputedStyle(document.querySelector('.wpetal.sel .wsring')).opacity === '1', null, { timeout: 3000 }).then(() => true, () => false));
  await p.locator('.wmoods [data-mood-chip="sunny"]').click(); await p.waitForTimeout(300); ok(`${label}: the mood chips under the panel switch moods`, /Sunny and tropical/.test(await h3()) && (await p.locator('.wpetal:not(.out)').count()) === 2);

  // deep links and the rest of the page
  await p.goto(base + '/explore?mood=woody'); await p.waitForSelector('.wpanel h3'); await p.waitForTimeout(300);
  ok(`${label}: ?mood= preselects a mood (home hero and quiz link here)`, /Warm and woody/.test(await h3()) && (await p.locator('.wbloom.on[data-mood="woody"]').count()) === 1);
  await p.goto(base + '/explore?mood=nope'); await p.waitForSelector('.wpanel h3'); ok(`${label}: an unknown ?mood= falls back to the start`, /feel/.test(await h3()));
  await p.goto(base + '/explore'); await p.waitForSelector('#exp .fl-card'); ok(`${label}: full list still below`, (await p.locator('#exp .fl-card').count()) > 5);
  await p.locator('.findtabs a:has-text("Take the quiz")').click(); await p.waitForSelector('[data-ans]'); ok(`${label}: the quiz tab still opens`, (await p.locator('[data-ans]').count()) >= 4);
  ok(`${label}: no sideways scroll`, await overflow());
  ok(`${label}: no JS errors`, errs.length === 0, errs.join('|'));
  await ctx.close();

  // reduced motion: a still compass, still complete
  const rctx = await b.newContext({ viewport: vp, reducedMotion: 'reduce' }); const rp = await rctx.newPage(); rp.setDefaultTimeout(8000); await setupMocks(rp);
  await rp.goto(base + '/explore?mood=grounding'); await rp.waitForSelector('.wpetal:not(.out)'); await rp.waitForTimeout(300);
  ok(`${label}: reduced motion keeps the compass still`, await rp.evaluate(() => [...document.querySelectorAll('.wdrift')].every(e => getComputedStyle(e).animationName === 'none')));
  ok(`${label}: reduced motion still shows the open scents and the panel`, (await rp.locator('.wpetal:not(.out)').count()) === 3 && /Grounding/.test(await rp.locator('.wpanel h3').innerText()));
  await rp.locator('.wcompass').screenshot({ path: `${process.env.SHOTS ?? '/tmp'}/${label}-wheel-reduced.png` });
  await rctx.close();
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
