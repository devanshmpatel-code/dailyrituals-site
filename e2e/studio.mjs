// The studio photographs: the moons panel and collage on the home page, Claire's portrait on the coaching page,
// the past-moons archive on Moon Drops (never buyable), and the real format photographs on the shop group heads.
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const noScroll = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const loaded = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s)].map(i => i.complete && i.naturalWidth > 0), sel);
const capVisible = (p, i) => p.evaluate(i => { const c = document.querySelectorAll('#moons .moon-pt')[i].querySelector('.moon-cap'); const s = getComputedStyle(c); return s.visibility === 'visible' && Number(s.opacity) > .9 ? c.textContent.trim() : ''; }, i);

for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.setDefaultTimeout(10000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));

  // ---- home: every candle is a moon
  await p.goto(base + '/'); await p.waitForSelector('#moons .moon-pt'); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('#moons').scrollIntoView({ block: 'center' })); await p.waitForTimeout(1200);
  const names = await p.evaluate(() => [...document.querySelectorAll('#moons .moon-pt .moon-name b')].map(e => e.textContent.trim()));
  ok(`${label}: the moons panel shows eight labelled moons`, names.length === 8 && names.every(Boolean) && new Set(names).size === 8, names.join(', '));
  ok(`${label}: every moon is a link into the archive with real alt text`, await p.evaluate(() => [...document.querySelectorAll('#moons .moon-pt')].every(li => { const a = li.querySelector('a.moon-link'); const img = li.querySelector('img'); return a && /drops\?moon=/.test(a.getAttribute('href')) && img.alt.length > 10 && img.getAttribute('loading') === 'lazy' && img.width > 0; })));
  // on phones the row scrolls sideways, so only the moons on screen have loaded (the rest are lazy)
  ok(`${label}: moon pictures load`, (await loaded(p, '#moons .moon-disc img')).slice(0, label === 'phone' ? 2 : 8).every(Boolean));
  ok(`${label}: captions are hidden until asked for`, (await capVisible(p, 4)) === '');
  if (label === 'desktop') {
    const bb = await p.locator('#moons .moon-pt').nth(4).boundingBox(); await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.waitForTimeout(700);
    ok('desktop: hovering a moon shows Claire\'s words', /Easter Bread, some call it Paska/.test(await capVisible(p, 4)), await capVisible(p, 4));
    await p.mouse.move(5, 5); await p.waitForTimeout(600);
  } else {
    ok('phone: the moons are one swipeable row', await p.evaluate(() => { const a = document.querySelector('#moons .moons-arc'); return getComputedStyle(a).display === 'flex' && a.scrollWidth > a.clientWidth; }));
  }
  await p.locator('#moons .moon-pt').nth(1).locator('a').focus();
  // the caption fades in over a third of a second; give a busy machine a little longer
  const focused = await p.waitForFunction(() => { const c = document.querySelectorAll('#moons .moon-pt')[1].querySelector('.moon-cap'); const s = getComputedStyle(c); return s.visibility === 'visible' && Number(s.opacity) > .9; }, null, { timeout: 4000 }).then(() => true, () => false);
  ok(`${label}: focusing a moon with the keyboard shows the words too`, focused && /Lavender Haze/.test(await capVisible(p, 1)), await capVisible(p, 1));
  const links = await p.evaluate(() => [...document.querySelectorAll('#moons .moons-tx a')].map(a => a.getAttribute('href')));
  ok(`${label}: the panel links to candles in the shop and to past moons`, links.some(h => /shop\?f=candle/.test(h)) && links.some(h => /drops/.test(h)), links.join(' '));

  // ---- home: the studio collage
  await p.evaluate(() => document.querySelector('.collage').scrollIntoView({ block: 'center' })); await p.waitForTimeout(1500);
  const cg = await loaded(p, '.collage .cg img');
  ok(`${label}: the six collage photographs load`, cg.length === 6 && cg.every(Boolean), cg.join(','));
  ok(`${label}: collage pictures are lazy, sized and captioned`, await p.evaluate(() => [...document.querySelectorAll('.collage .cg')].every(f => { const i = f.querySelector('img'); return i.getAttribute('loading') === 'lazy' && i.getAttribute('width') && i.getAttribute('height') && i.alt.length > 10 && f.querySelector('figcaption').textContent.trim(); })));
  const revealed = await p.waitForFunction(() => [...document.querySelectorAll('.collage .cg')].every(f => Number(getComputedStyle(f).opacity) > .9), null, { timeout: 5000 }).then(() => true, () => false);
  ok(`${label}: the collage is in view, not hidden by its reveal`, revealed);
  ok(`${label}: no soy or healing claims in the new copy`, !/soy|heal|crystal/i.test(await p.evaluate(() => (document.querySelector('#moons').innerText + document.querySelector('.studio').innerText))));
  ok(`${label}: home has no sideways scroll`, (await noScroll(p)) <= 1);

  // ---- coaching: Claire's portrait
  await p.goto(base + '/coaching'); await p.waitForSelector('.cel-portrait img', { state: 'attached' }); await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelector('.cel-portrait').scrollIntoView({ block: 'center' })); await p.waitForTimeout(900);
  const portrait = p.locator('.cel-portrait img[alt="Claire, founder of Daily Rituals Co."]');
  ok(`${label}: Claire's portrait is on the coaching page`, (await portrait.count()) === 1 && (await loaded(p, '.cel-portrait img')).every(Boolean) && /studio\/web\/claire/.test(await portrait.getAttribute('src')));
  const pb = await portrait.boundingBox();
  ok(`${label}: the portrait has a real size on screen`, pb && pb.width > 200 && pb.height > 200, JSON.stringify(pb));
  ok(`${label}: the approval note is a draft for Claire only`, !(await p.locator('.cel-portrait .confirm').isVisible()));
  ok(`${label}: coaching has no sideways scroll`, (await noScroll(p)) <= 1);

  // ---- moon drops: the past moons archive
  await p.goto(base + '/drops'); await p.waitForSelector('#pastMoons .pm-card'); await p.waitForTimeout(800);
  const cards = await p.evaluate(() => [...document.querySelectorAll('#pastMoons .pm-card')].map(c => c.querySelector('h4').textContent.trim()));
  ok(`${label}: the archive lists 15 named moons`, cards.length === 15 && new Set(cards).size === 15 && !cards.some(n => /crescent/i.test(n)), cards.join(', '));
  ok(`${label}: every card has a moon, and words where Claire gave them`, await p.evaluate(() => [...document.querySelectorAll('#pastMoons .pm-card')].every(c => c.querySelector('img').alt.length > 10 && (c.querySelector('q') || c.querySelector('.pm-noq')))));
  const archiveText = await p.locator('#pastMoons').innerText();
  ok(`${label}: nothing in the archive can be bought`, (await p.locator('#pastMoons button, #pastMoons [data-add], #pastMoons [data-qa], #pastMoons .qa').count()) === 0 && !/add to cart|quick add|\$\d/i.test(archiveText) && /not for sale/i.test(archiveText));
  ok(`${label}: the archive is grouped by season`, (await p.locator('#pastMoons .pm-season').count()) === 5);
  ok(`${label}: the "bring one back" idea is a draft for Claire only`, !/bring one back/i.test(archiveText));
  ok(`${label}: drops has no sideways scroll`, (await noScroll(p)) <= 1);
  await p.goto(base + '/drops?moon=jarrah'); await p.waitForSelector('#pm-jarrah'); await p.waitForTimeout(1200);
  ok(`${label}: a moon on the home arc deep-links to its card`, await p.evaluate(() => { const c = document.querySelector('#pm-jarrah'); const r = c.getBoundingClientRect(); return c.classList.contains('on') && r.top >= 0 && r.bottom <= innerHeight; }));

  // ---- shop: real format photographs on the candle and deodorant heads, the renders left for rollers and diffusers
  await p.goto(base + '/shop'); await p.waitForSelector('.ghead'); await p.waitForTimeout(600);
  ok(`${label}: candle and deodorant group heads carry a studio photograph`, await p.evaluate(() => { const h = [...document.querySelectorAll('.grid.grouped .ghead')]; const by = t => h.find(x => new RegExp(t, 'i').test(x.querySelector('h2')?.textContent ?? '')); return !!by('candle')?.querySelector('.ghead-ph[src*="studio"]') && !!by('deodorant')?.querySelector('.ghead-ph[src*="studio"]') && !by('roller')?.querySelector('.ghead-ph') && !by('diffuser')?.querySelector('.ghead-ph'); }));
  ok(`${label}: no JS errors`, errs.length === 0, errs.join(' | ').slice(0, 200));
  await ctx.close();
}
{ // drafts on: the review notes show for Claire
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addInitScript(() => { try { localStorage.setItem('dr_drafts', '1'); } catch {} });
  const p = await ctx.newPage(); await setupMocks(p);
  await p.goto(base + '/coaching'); await p.waitForSelector('.cel-portrait img'); await p.waitForTimeout(600);
  ok('drafts on: the portrait approval note shows for Claire', /approve this photo/i.test(await p.locator('.cel-portrait .confirm').innerText()));
  await p.goto(base + '/drops'); await p.waitForSelector('#pastMoons'); await p.waitForTimeout(600);
  ok('drafts on: the "bring one back" idea shows for Claire', /bring one back/i.test(await p.locator('#pastMoons').innerText()));
  await ctx.close();
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
