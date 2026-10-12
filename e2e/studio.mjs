// The studio photographs: the hero arch, Claire's cut-out, From the studio (cut-outs, tins from above, a row of photographs), Ritual on
// Repeat and Send a Sunrise on the home page (no moons
// outside Moon Drops), a bench photograph on candle pages, Claire's portrait on the coaching page,
// the past-moons archive on Moon Drops (never buyable), and the real format photographs on the shop group heads.
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const noScroll = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const loaded = (p, sel) => p.evaluate(s => [...document.querySelectorAll(s)].map(i => i.complete && i.naturalWidth > 0), sel);

for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.setDefaultTimeout(10000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));

  // ---- home: the opening shows Claire's real candles, and moons live only on Moon Drops
  await p.goto(base + '/'); await p.waitForSelector('#dStack img[data-mimg]'); await p.waitForTimeout(800);
  const stack = await p.evaluate(() => [...document.querySelectorAll('#dStack img[data-mimg]')].map(i => ({ k: i.dataset.mimg, src: i.getAttribute('src') || i.dataset.src, alt: i.alt })));
  const per = stack.reduce((o, x) => (o[x.k] = (o[x.k] || 0) + 1, o), {});
  ok(`${label}: the opening holds two of Claire's pours per moment, cut out as whole tins`, Object.keys(per).length === 5 && Object.values(per).every(n => n === 2) && new Set(stack.map(x => x.src)).size === stack.length && stack.every(x => /^\/img\/studio\/tins\//.test(x.src) && x.alt.length > 15), JSON.stringify(per));
  ok(`${label}: no past scent is named in the opening's alt text`, !stack.some(x => /midnight forest|jarrah|sweet romance|lavender haze|spring blooms|sea salt|christmas eve|mulled wine|candy cane|hello cupcake|easter bread|apple cider|mother/i.test(x.alt)));
  ok(`${label}: exactly one pair is showing`, (await p.locator('#dStack .tset.on').count()) === 1);
  for (const k of ['dawn', 'night']) {
    await p.evaluate(k => document.querySelector(`.moments [data-jump="${k}"]`).click(), k);
    await p.waitForFunction(k => document.querySelector('.dayhero')?.dataset.m === k, k, { timeout: 20000 }); await p.waitForTimeout(1800);
    const shown = await p.evaluate(() => [...document.querySelectorAll('#dStack .tset')].filter(f => Number(getComputedStyle(f).opacity) > .9).map(f => [f.dataset.mset, [...f.querySelectorAll('img')].every(i => i.complete && i.naturalWidth > 0)]));
    ok(`${label}: at ${k} the opening shows the ${k} pair, loaded`, shown.length === 1 && shown[0][0] === k && shown[0][1], JSON.stringify(shown));
  }
  const before = await p.evaluate(() => document.querySelector('.dayhero').dataset.m);
  await p.evaluate(() => window.scrollTo(0, 700)); await p.waitForTimeout(700);
  ok(`${label}: scrolling does not change the time of day (it is the visitor's to change)`, (await p.evaluate(() => document.querySelector('.dayhero').dataset.m)) === before && (await p.locator('.daypin').count()) === 0);
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(400);
  ok(`${label}: the moons panel is gone from home`, (await p.locator('#moons, .moons-arc').count()) === 0);
  ok(`${label}: no moon-phase rows on the home seams`, (await p.locator('.cel-div .cel-moonrow').count()) === 0 && (await p.locator('.cel-div').count()) > 0);
  ok(`${label}: footer and cart carry a star, not a moon`, (await p.locator('.foot-moon .cel-glyph, .dh-moon .cel-glyph').count()) === 2 && (await p.locator('.foot-moon [aria-label*="moon" i], .dh-moon [aria-label*="moon" i]').count()) === 0);
  for (const [sel, name] of [['.rep-grid .ph-repeat', 'Ritual on Repeat'], ['.gift-grid .ph-gift', 'Send a Sunrise']]) {
    await p.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), sel); await p.waitForTimeout(900);
    const f = await p.evaluate(s => { const f = document.querySelector(s); const i = f.querySelector('img'); const r = f.getBoundingClientRect(); return { ok: i.complete && i.naturalWidth > 0 && i.alt.length > 15 && !!f.querySelector('figcaption .d'), w: r.width }; }, sel);
    ok(`${label}: ${name} carries a studio photograph with a draft caption`, f.ok && f.w > 150, JSON.stringify(f));
  }

  // ---- home: Claire's cut-out and From the studio
  await p.evaluate(() => document.querySelector('.claire-cut').scrollIntoView({ block: 'center' })); await p.waitForTimeout(1200);
  ok(`${label}: Meet Claire shows her own photograph, cut out in an arch (not a render)`, await p.evaluate(() => { const i = document.querySelector('.claire-in .claire-cut .cc-arch img'); return !!i && /studio\/cut\/claire/.test(i.currentSrc || i.src) && i.complete && i.naturalWidth > 0 && /Claire/.test(i.alt) && !document.querySelector('.claire-in img.dimg'); }));
  await p.evaluate(() => document.querySelector('.studio .shelf').scrollIntoView({ block: 'center' })); await p.waitForTimeout(1500);
  ok(`${label}: the shelf stands three real cut-outs that link to their products`, await p.evaluate(() => { const a = [...document.querySelectorAll('.studio .shelf a.sh-item')]; return a.length === 3 && a.every(x => { const i = x.querySelector('img'); return /studio\/cut\//.test(i.currentSrc || i.src) && i.complete && i.naturalWidth > 0 && i.alt.length > 15 && /\/product\//.test(x.getAttribute('href')) && x.querySelector('.sh-tag').textContent.trim(); }); }));
  ok(`${label}: the shelf names only scents in the catalogue (Verdant, Cabana, Westcoast)`, await p.evaluate(() => [...document.querySelectorAll('.studio .sh-tag')].map(t => t.textContent).join(' ')).then(t => /Verdant/.test(t) && /Cabana/.test(t) && /Westcoast/.test(t)));
  await p.evaluate(() => document.querySelector('.studio .above').scrollIntoView({ block: 'center' })); await p.waitForTimeout(1200);
  ok(`${label}: seen from above, four toppings are labelled, none cut off by the panel`, await p.evaluate(() => { const box = document.querySelector('.studio .above').getBoundingClientRect(); const ls = [...document.querySelectorAll('.studio .ab-l > span')]; return ls.length === 4 && ls.every(l => { const r = l.getBoundingClientRect(); return r.left >= box.left - 1 && r.right <= box.right + 1 && r.width > 30; }); }));
  await p.evaluate(() => document.querySelector('.studio .st-strip').scrollIntoView({ block: 'center' })); await p.waitForTimeout(1500);
  const sx = await loaded(p, '.st-strip .sx img');
  ok(`${label}: the row of five bench photographs loads`, sx.length === 5 && sx.slice(0, label === 'phone' ? 1 : 5).every(Boolean), sx.join(','));
  ok(`${label}: bench photographs are lazy, sized and captioned`, await p.evaluate(() => [...document.querySelectorAll('.st-strip .sx')].every(f => { const i = f.querySelector('img'); return i.getAttribute('loading') === 'lazy' && i.getAttribute('width') && i.getAttribute('height') && i.alt.length > 10 && f.querySelector('figcaption').textContent.trim(); })));
  if (label === 'desktop') ok('desktop: the bench photographs sit in one even row', await p.evaluate(() => { const r = [...document.querySelectorAll('.st-strip .sx-ph')].map(e => e.getBoundingClientRect()); return r.every(x => Math.abs(x.height - r[0].height) < 3 && Math.abs(x.top - r[0].top) < 2); }));
  else ok('phone: the bench photographs are a swipeable row', await p.evaluate(() => { const s = document.querySelector('.st-strip'); return s.scrollWidth > s.clientWidth; }));
  const revealed = await p.waitForFunction(() => [...document.querySelectorAll('.studio .sh-item, .studio .above, .studio .sx')].every(f => Number(getComputedStyle(f).opacity) > .9), null, { timeout: 5000 }).then(() => true, () => false);
  ok(`${label}: the studio pieces are in view, not hidden by their reveal`, revealed);
  ok(`${label}: no past scent is named on the home page outside Moon Drops`, !/midnight forest|jarrah|sweet romance|lavender haze|spring blooms|sea salt/i.test(await p.evaluate(() => document.querySelector('.studio').innerText + document.querySelector('.claire').innerText)));
  ok(`${label}: no soy or healing claims in the new copy`, !/soy|heal|crystal/i.test(await p.evaluate(() => (document.querySelector('.studio').innerText + document.querySelector('.claire').innerText + document.querySelector('.rep-grid').innerText + document.querySelector('.gift-grid').innerText))));
  ok(`${label}: home has no sideways scroll`, (await noScroll(p)) <= 1);

  // ---- coaching: Claire's portrait
  await p.goto(base + '/coaching'); await p.waitForSelector('.cel-portrait img', { state: 'attached' }); await p.waitForTimeout(800);
  await p.evaluate(() => document.querySelector('.cel-portrait').scrollIntoView({ block: 'center' })); await p.waitForTimeout(900);
  const portrait = p.locator('.cel-portrait img[alt="Claire, founder of Daily Rituals Co."]');
  ok(`${label}: Claire's portrait is on the coaching page`, (await portrait.count()) === 1 && (await loaded(p, '.cel-portrait img')).every(Boolean) && /studio\/web\/claire/.test(await portrait.getAttribute('src')));
  const pb = await portrait.boundingBox();
  ok(`${label}: the portrait has a real size on screen`, pb && pb.width > 200 && pb.height > 200, JSON.stringify(pb));
  ok(`${label}: Claire has approved the photo, so no approval note is left`, (await p.locator('.cel-portrait .confirm').count()) === 0);
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
  ok(`${label}: a deep link lights its card in the archive`, await p.evaluate(() => { const c = document.querySelector('#pm-jarrah'); const r = c.getBoundingClientRect(); return c.classList.contains('on') && r.top >= 0 && r.bottom <= innerHeight; }));

  // ---- shop: real format photographs on the candle and deodorant heads, the renders left for rollers and diffusers
  await p.goto(base + '/shop'); await p.waitForSelector('.ghead'); await p.waitForTimeout(600);
  ok(`${label}: candle and deodorant group heads carry a studio photograph`, await p.evaluate(() => { const h = [...document.querySelectorAll('.grid.grouped .ghead')]; const by = t => h.find(x => new RegExp(t, 'i').test(x.querySelector('h2')?.textContent ?? '')); return !!by('candle')?.querySelector('.ghead-ph[src*="studio"]') && !!by('deodorant')?.querySelector('.ghead-ph[src*="studio"]') && !by('roller')?.querySelector('.ghead-ph') && !by('diffuser')?.querySelector('.ghead-ph'); }));
  await p.goto(base + '/shop?f=candle'); await p.waitForTimeout(1500);
  const chref = await p.evaluate(() => document.querySelector('a[href*="/product/"]')?.getAttribute('href'));
  await p.goto(base + chref.replace(/^#?\//, '/')); await p.waitForSelector('.pdp'); await p.waitForTimeout(1200);
  ok(`${label}: a candle page shows a bench photograph under the gallery, scent unnamed`, await p.evaluate(() => { const f = document.querySelector('.pdp > div:first-child .ph-product'); return !!f && f.querySelector('img').alt.length > 15 && !/mother|florals/i.test(f.innerText); }));
  ok(`${label}: candle page has no sideways scroll`, (await noScroll(p)) <= 1);
  ok(`${label}: no JS errors`, errs.length === 0, errs.join(' | ').slice(0, 200));
  await ctx.close();
}
{ // drafts on: the review notes show for Claire
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); await ctx.addInitScript(() => { try { localStorage.setItem('dr_drafts', '1'); } catch {} });
  const p = await ctx.newPage(); await setupMocks(p);
  await p.goto(base + '/drops'); await p.waitForSelector('#pastMoons'); await p.waitForTimeout(600);
  ok('drafts on: the "bring one back" idea shows for Claire', /bring one back/i.test(await p.locator('#pastMoons').innerText()));
  await ctx.close();
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
