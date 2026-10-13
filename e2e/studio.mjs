// The studio photographs: the opening's candle moons (five of Claire's candles seen from above, on one ring across the sky),
// Claire's cut-out, From the studio (cut-outs, tins from above, a row of photographs), Ritual on Repeat and Send a Sunrise on
// the home page, a bench photograph on candle pages, Claire's portrait on the coaching page,
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
  // ---- home: the opening shows five of Claire's real candles, seen from above, as moons on one ring across the sky (the
  // moment's candle is the full moon); past pours, so no scent is named and nothing links to a purchase
  await p.goto(base + '/'); await p.waitForSelector('#dStack img[data-mimg]', { state: 'attached' }); await p.waitForTimeout(800);
  const stack = await p.evaluate(() => [...document.querySelectorAll('#dStack img[data-mimg]')].map(i => ({ k: i.dataset.mimg, src: i.getAttribute('src') || i.dataset.src })));
  const per = stack.reduce((o, x) => (o[x.k] = (o[x.k] || 0) + 1, o), {});
  ok(`${label}: the opening's five moons are Claire's real photographs, one per moment`, stack.length === 5 && Object.keys(per).length === 5 && Object.values(per).every(n => n === 1) && new Set(stack.map(x => x.src)).size === 5 && stack.every(x => /^\/img\/studio\/moons\/[a-z-]+\.webp$/.test(x.src) && !/midnight-forest/.test(x.src)), JSON.stringify(per));
  const scentNames = /midnight forest|jarrah|sweet romance|lavender haze|spring blooms|sea salt|christmas eve|mulled wine|candy cane|hello cupcake|easter bread|apple cider|mother|tuscan|irish coffee/i;
  const pic = () => p.evaluate(() => { const s = document.querySelector('#dStack'); return { role: s.getAttribute('role'), label: s.getAttribute('aria-label') || '', alts: [...s.querySelectorAll('img')].map(i => i.alt) }; });
  const pic0 = await pic();
  ok(`${label}: the opening is one described picture of candles that names no past scent`, pic0.role === 'img' && pic0.label.length > 30 && /candles/i.test(pic0.label) && !scentNames.test(pic0.label) && pic0.alts.every(a => a === ''), pic0.label);
  ok(`${label}: exactly one moment's candle is chosen`, (await p.locator('#dStack .tset.on').count()) === 1);
  ok(`${label}: no tins and no knoll are drawn any more`, (await p.locator('canvas.tins3d, canvas.tins-knoll, canvas.tins-ground').count()) === 0);
  // the moons, as drawn: each canvas really painted (opaque in the middle, clear in the corner), where it is on screen
  const moons = () => p.evaluate(() => [...document.querySelectorAll('.moonarc .cm')].map(el => {
    const c = el.querySelector('canvas'), x = c.getContext('2d'), n = c.width, r = c.getBoundingClientRect();
    const mid = x.getImageData(n >> 1, n >> 1, 1, 1).data, corner = x.getImageData(1, 1, 1, 1).data;
    return { k: el.dataset.k, off: Number(el.dataset.off), full: el.classList.contains('full'), glow: Number(getComputedStyle(el).getPropertyValue('--glow')), painted: mid[3] > 250 && corner[3] < 5, cap: el.querySelector('.cm-cap').textContent, l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width };
  }));
  for (const k of ['dawn', 'night']) {
    await p.evaluate(k => document.querySelector(`.moments [data-jump="${k}"]`).click(), k);
    await p.waitForFunction(k => document.querySelector('.dayhero')?.dataset.m === k, k, { timeout: 20000 });
    const ready = await p.waitForFunction(k => document.querySelector('#dStack')?.dataset.shown === k, k, { timeout: 10000 }).then(() => true, () => false);
    await p.waitForTimeout(600);
    const st = await p.evaluate(() => { const s = document.querySelector('#dStack'); const on = [...s.querySelectorAll('.tset.on')]; return { on: on.map(f => f.dataset.mset), loaded: [...s.querySelectorAll('img')].every(i => i.complete && i.naturalWidth > 0), moons: Number(s.dataset.moons) }; });
    const ms = await moons(); const lab = (await pic()).label;
    const full = ms.filter(m => m.full), others = ms.filter(m => !m.full);
    ok(`${label}: at ${k} five moons are drawn from the photographs and the ${k} candle is the full moon`, ready && st.on.length === 1 && st.on[0] === k && st.loaded && st.moons === 5 && ms.length === 5 && ms.every(m => m.painted) && full.length === 1 && full[0].k === k && !scentNames.test(lab), JSON.stringify({ ...st, ms: ms.map(m => [m.k, m.off, m.painted]) }));
    ok(`${label}: at ${k} the full moon is the largest and glows; the others wax and wane round it, smaller`, full[0].glow > 0.9 && others.every(m => m.w < full[0].w * 0.85 && m.glow < 0.5) && others.filter(m => m.off < 0).length === 2 && others.filter(m => m.off > 0).length === 2 && /full moon/i.test(full[0].cap) && others.filter(m => Math.abs(m.off) === 1).every(m => /(waxing|waning) gibbous/i.test(m.cap)), JSON.stringify(ms.map(m => [m.k, m.off, Math.round(m.w), m.glow, m.cap])));
    ok(`${label}: at ${k} the moons' captions name times and phases, never a scent`, ms.every(m => !scentNames.test(m.cap)) && ms.some(m => /dawn|morning|midday|golden|night/i.test(m.cap)));
  }
  // clear of the words and the offers, inside the screen; on phones, in the picture band above the headline
  const lay = await p.evaluate(() => {
    const box = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
    const hero = box('#day'), copy = box('.day-copy'), offers = box('#dProducts'), h1 = box('#dTitle'), band = box('#dStack');
    return { vis: Math.min(hero.height, innerHeight - Math.max(0, hero.top)), w: innerWidth, heroT: hero.top, copy: { l: copy.left, t: copy.top, r: copy.right, b: copy.bottom }, offers: { l: offers.left, t: offers.top, r: offers.right, b: offers.bottom }, h1T: h1.top, bandT: band.top, bandB: band.bottom };
  });
  const ms = await moons();
  const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  const full = ms.find(m => m.full);
  ok(`${label}: no moon touches the words or the offers`, ms.every(m => !hit(m, lay.copy) && !hit(m, lay.offers)), JSON.stringify({ ms: ms.map(m => [m.k, Math.round(m.l), Math.round(m.t), Math.round(m.r), Math.round(m.b)]), lay }));
  if (label === 'desktop') ok(`${label}: the ring stands in the sky beside the words, inside the screen, the full moon a real size`,
    ms.every(m => m.l > lay.copy.r + 20 && m.r < lay.w - 8 && m.t > lay.heroT) && full.w > lay.vis * 0.15 && full.w < lay.vis * 0.32, JSON.stringify({ full: full.w, vis: lay.vis }));
  else ok(`${label}: the ring fits the phone's width in the picture band above the headline, the offers below the words`,
    ms.every(m => m.l >= 0 && m.r <= lay.w && m.t >= lay.bandT - 1 && m.b < lay.h1T) && full.w > 70 && lay.offers.t > lay.h1T, JSON.stringify({ ms: ms.map(m => [m.k, Math.round(m.l), Math.round(m.t), Math.round(m.r), Math.round(m.b)]), lay }));
  const before = await p.evaluate(() => document.querySelector('.dayhero').dataset.m + '/' + document.querySelector('#dStack').dataset.shown);
  await p.evaluate(() => window.scrollTo(0, 700)); await p.waitForTimeout(700);
  ok(`${label}: scrolling does not change the time of day or its moon (they are the visitor's to change)`, (await p.evaluate(() => document.querySelector('.dayhero').dataset.m + '/' + document.querySelector('#dStack').dataset.shown)) === before && (await p.locator('.daypin').count()) === 0);
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(400);
  ok(`${label}: the old moons panel is gone from home`, (await p.locator('#moons, .moons-arc').count()) === 0);
  ok(`${label}: no moon-phase rows on the home seams`, (await p.locator('.cel-div .cel-moonrow').count()) === 0 && (await p.locator('.cel-div').count()) > 0);
  ok(`${label}: footer and cart carry a star, not a moon`, (await p.locator('.foot-moon .cel-glyph, .dh-moon .cel-glyph').count()) === 2 && (await p.locator('.foot-moon [aria-label*="moon" i], .dh-moon [aria-label*="moon" i]').count()) === 0);
  for (const [sel, name] of [['.gift-grid .ph-gift', 'Send a Sunrise']]) {
    await p.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), sel); await p.waitForTimeout(900);
    const f = await p.evaluate(s => { const f = document.querySelector(s); const i = f.querySelector('img'); const r = f.getBoundingClientRect(); return { ok: i.complete && i.naturalWidth > 0 && i.alt.length > 15 && !!f.querySelector('figcaption .d'), w: r.width }; }, sel);
    ok(`${label}: ${name} carries a studio photograph with a draft caption`, f.ok && f.w > 150, JSON.stringify(f));
  }

  // ---- home: Claire's cut-out and From the studio
  await p.evaluate(() => document.querySelector('.claire-cut').scrollIntoView({ block: 'center' })); await p.waitForTimeout(1200);
  ok(`${label}: Meet Claire shows her own photograph, cut out in an arch (not a render)`, await p.evaluate(() => { const i = document.querySelector('.claire-in .claire-cut .cc-arch img'); return !!i && /studio\/cut\/claire/.test(i.currentSrc || i.src) && i.complete && i.naturalWidth > 0 && /Claire/.test(i.alt) && !document.querySelector('.claire-in img.dimg'); }));
  ok(`${label}: Meet Claire is ${label === 'phone' ? 'stacked: her photograph centred above comfortable lines of text' : 'two columns: photograph beside the words'}`, await p.evaluate(phone => {
    const ph = document.querySelector('.claire-in .claire-cut').getBoundingClientRect(), tx = document.querySelector('.claire-in .tx').getBoundingClientRect();
    return phone ? ph.bottom <= tx.top + 1 && ph.width >= innerWidth * 0.6 && Math.abs((ph.left + ph.right) / 2 - innerWidth / 2) < 12 && tx.width >= innerWidth * 0.75 : ph.right < tx.left;
  }, label === 'phone'));
  await p.evaluate(() => document.querySelector('.studio .shelf').scrollIntoView({ block: 'center' })); await p.waitForTimeout(1500);
  ok(`${label}: the shelf stands three real cut-outs that link to their products`, await p.evaluate(() => { const a = [...document.querySelectorAll('.studio .shelf a.sh-item')]; return a.length === 3 && a.every(x => { const i = x.querySelector('img'); return /studio\/cut\//.test(i.currentSrc || i.src) && i.complete && i.naturalWidth > 0 && i.alt.length > 15 && /\/product\//.test(x.getAttribute('href')) && x.querySelector('.sh-tag').textContent.trim(); }); }));
  ok(`${label}: the shelf names only scents in the catalogue (Verdant, Cabana, Westcoast)`, await p.evaluate(() => [...document.querySelectorAll('.studio .sh-tag')].map(t => t.textContent).join(' ')).then(t => /Verdant/.test(t) && /Cabana/.test(t) && /Westcoast/.test(t)));
  await p.evaluate(() => document.querySelector('.studio .above').scrollIntoView({ block: 'center' })); await p.waitForTimeout(1200);
  ok(`${label}: seen from above, four toppings are labelled, none cut off by the panel`, await p.evaluate(() => { const box = document.querySelector('.studio .above').getBoundingClientRect(); const ls = [...document.querySelectorAll('.studio .ab-l > span')]; return ls.length === 4 && ls.every(l => { const r = l.getBoundingClientRect(); return r.left >= box.left - 1 && r.right <= box.right + 1 && r.width > 30; }); }));
  // the strip under "Seen from above": single candle tops (the clean round crops), one per topping, set down at different
  // heights and angles, each captioned with its topping (a draft), never its scent; the old clusters of tins are gone
  await p.evaluate(() => document.querySelector('.studio .st-tops').scrollIntoView({ block: 'center' })); await p.waitForTimeout(1500);
  ok(`${label}: the clusters of tins are gone from From the studio`, (await p.locator('.studio .st-strip, .studio .sx, .studio img[src*="/tins/"]:not(.ab-tins img)').count()) === 0);
  const tops = await p.evaluate(() => [...document.querySelectorAll('.st-tops .tp')].map(f => { const i = f.querySelector('img'), r = f.querySelector('.tp-c').getBoundingClientRect();
    return { src: i.getAttribute('src'), done: i.complete && i.naturalWidth > 0, alt: i.alt, cap: f.querySelector('figcaption .d')?.textContent.trim() ?? '', rot: getComputedStyle(i).rotate, top: Math.round(r.top + scrollY), w: Math.round(r.width), lazy: i.getAttribute('loading') === 'lazy' }; }));
  ok(`${label}: seven single candle tops, each a clean round crop of Claire's own photograph`, tops.length === 7 && new Set(tops.map(t => t.src)).size === 7 && tops.every(t => /^\/img\/studio\/moons\/[a-z-]+\.webp$/.test(t.src) && t.lazy), tops.map(t => t.src).join(' '));
  ok(`${label}: the tops in view load`, tops.slice(0, label === 'phone' ? 2 : 7).every(t => t.done), tops.map(t => t.done).join(','));
  ok(`${label}: each top is captioned (a draft) with its topping, and described`, tops.every(t => t.cap.length > 3 && t.alt.length > 30) && ['Dried flowers', 'Sprinkles', 'Coffee beans', 'Lavender buds', 'Small stones', 'Citrus and spice', 'Wood chips'].every(c => tops.some(t => t.cap === c)), tops.map(t => t.cap).join(', '));
  ok(`${label}: the tops sit at different heights and angles, like things set down by hand`, new Set(tops.map(t => t.top)).size >= 5 && new Set(tops.map(t => t.rot)).size === 7 && new Set(tops.map(t => t.w)).size >= 4, JSON.stringify(tops.map(t => [t.top, t.rot, t.w])));
  ok(`${label}: every top has its contact shadow`, (await p.locator('.st-tops .tp .tp-sh').count()) === 7);
  if (label === 'desktop') {
    ok('desktop: all seven tops fit in one row inside the strip', await p.evaluate(() => { const s = document.querySelector('.st-tops').getBoundingClientRect(); return [...document.querySelectorAll('.st-tops .tp-c')].every(e => { const r = e.getBoundingClientRect(); return r.left >= s.left && r.right <= s.right; }); }));
    const tin = p.locator('.st-tops .tp').nth(3); const bb = await tin.boundingBox(); await p.mouse.move(bb.x + bb.width * 0.5, bb.y + bb.width * 0.5); await p.mouse.move(bb.x + bb.width * 0.8, bb.y + bb.width * 0.3, { steps: 4 });
    // (waits for the lean to settle: on a busy machine the .6s transition can take longer)
    ok('desktop: a top leans towards the pointer (3D tilt)', await p.waitForFunction(() => { const t = document.querySelectorAll('.st-tops .tp-tin')[3]; return /matrix3d/.test(getComputedStyle(t).transform) && t.style.getPropertyValue('--ry') !== ''; }, null, { timeout: 5000 }).then(() => true, () => false));
    await p.mouse.move(5, 5);
  } else ok('phone: the tops are a swipeable row', await p.evaluate(() => { const s = document.querySelector('.st-tops'); return s.scrollWidth > s.clientWidth + 40 && getComputedStyle(s).overflowX === 'auto'; }));
  const revealed = await p.waitForFunction(() => [...document.querySelectorAll('.studio .sh-item, .studio .above, .studio .tp')].every(f => Number(getComputedStyle(f).opacity) > .9), null, { timeout: 5000 }).then(() => true, () => false);
  ok(`${label}: the studio pieces are in view, not hidden by their reveal`, revealed);
  ok(`${label}: no past scent is named on the home page outside Moon Drops`, !/midnight forest|jarrah|sweet romance|lavender haze|spring blooms|sea salt|hello cupcake|irish coffee|mulled wine/i.test(await p.evaluate(() => document.querySelector('.studio').innerText + document.querySelector('.claire').innerText)));
  ok(`${label}: no healing or crystal claims in the new copy`, !/heal|crystal/i.test(await p.evaluate(() => (document.querySelector('.studio').innerText + document.querySelector('.claire').innerText + document.querySelector('.soonflow').innerText + document.querySelector('.gift-grid').innerText))));
  ok(`${label}: home has no sideways scroll`, (await noScroll(p)) <= 1);

  // ---- the Ritualists: a membership card with Claire's logo in place of the mood constellation; it promises nothing. (It sits
  // above the Monthly Ritual sign-up in the one "Opening soon" chapter now, a little smaller on a phone.)
  await p.evaluate(() => document.querySelector('.soonflow .soon-card').scrollIntoView({ block: 'center' })); await p.waitForTimeout(1200);
  const card = await p.evaluate(() => { const w = document.querySelector('.soonflow .rit-card-wrap'), i = w?.querySelector('.rc-logo'); return w && { label: w.getAttribute('role') + ':' + w.getAttribute('aria-label'), logo: i.complete && i.naturalWidth > 0 && /\/img\/brand\/logo-(600|1200)\.webp/.test(i.currentSrc || i.src), text: w.innerText, seal: !!w.querySelector('.rc-seal svg'), wd: w.getBoundingClientRect().width }; });
  ok(`${label}: the Ritualists show a membership card with the logo and a wax seal`, !!card && card.logo && card.seal && /^img:.*coming soon/i.test(card.label) && card.wd > 200, JSON.stringify(card));
  ok(`${label}: the mood constellation is gone from the Ritualists`, (await p.locator('.soonflow .cs-const, .soonflow .cel-const').count()) === 0);
  ok(`${label}: the card promises no points, tiers or rewards`, !!card && /coming soon/i.test(card.text) && !/\d|points?|reward|tier|member no/i.test(card.text), card?.text);

  // ---- the footer: Claire's logo, cut out clean and lit, in place of the star chart and the constellation
  await p.evaluate(() => document.querySelector('footer .foot-sign').scrollIntoView({ block: 'center' })); await p.waitForTimeout(1000);
  const flogo = await p.evaluate(() => { const a = document.querySelector('footer .foot-logo'), i = a?.querySelector('img'), r = i?.getBoundingClientRect(); return a && { href: a.getAttribute('href'), src: i.currentSrc || i.src, done: i.complete && i.naturalWidth > 0, alt: i.alt, w: r.width, inView: r.left >= 0 && r.right <= innerWidth }; });
  ok(`${label}: the footer is signed with the logo (transparent cut-out), linking home`, !!flogo && flogo.done && /\/img\/brand\/logo-(600|1200)\.webp$/.test(flogo.src) && /(#\/|\/)$/.test(flogo.href) && /Daily Rituals Co/.test(flogo.alt) && flogo.w > 250 && flogo.inView, JSON.stringify(flogo));
  ok(`${label}: the footer's star chart and constellation are gone`, (await p.locator('footer .foot-chart, footer .foot-const, footer .cel-const, footer [data-cel="astrolabe"]').count()) === 0);
  ok(`${label}: the logo really is see-through round the letters`, await p.evaluate(async () => { const i = document.querySelector('footer .foot-logo img'); const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; const x = c.getContext('2d'); x.drawImage(i, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data; let clear = 0, solid = 0; for (let k = 3; k < d.length; k += 4) { if (d[k] === 0) clear++; else if (d[k] === 255) solid++; } return clear / (d.length / 4) > 0.6 && solid > 1000; }));

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
  ok(`${label}: every card has a moon, Claire's words where she gave them, and no "No caption yet" placeholder`, await p.evaluate(() => [...document.querySelectorAll('#pastMoons .pm-card')].every(c => c.querySelector('img').alt.length > 10) && !/No caption yet/i.test(document.querySelector('#pastMoons').innerText) && document.querySelectorAll('#pastMoons .pm-card q').length >= 14));
  const archiveText = await p.locator('#pastMoons').innerText();
  // (its only buttons are "Tell me if it returns", one per candle, and the Monthly Ritual sign-up they lead to)
  ok(`${label}: nothing in the archive can be bought`, (await p.locator('#pastMoons button:not([data-return]):not(#pmForm button[type=submit]), #pastMoons [data-add], #pastMoons [data-qa], #pastMoons .qa, #pastMoons a[href*="product"]').count()) === 0 && !/add to cart|quick add|\$\d/i.test(archiveText) && /not for sale/i.test(archiveText));
  ok(`${label}: every past candle offers "Tell me if it returns"`, (await p.locator('#pastMoons .pm-card [data-return]').count()) === 15 && /tell me if it returns/i.test(archiveText));
  await p.locator('#pm-christmas-eve [data-return]').click(); await p.waitForTimeout(900);
  const asked = await p.evaluate(() => ({ focus: document.activeElement?.id, interest: document.querySelector('#pmInterest').value, ask: document.querySelector('#pmAsk').hidden ? '' : document.querySelector('#pmAsk').innerText, r: document.querySelector('#pmForm').getBoundingClientRect().top, h: innerHeight }));
  ok(`${label}: "Tell me if it returns" on Christmas Eve leads to the Monthly Ritual sign-up and notes the candle`, asked.focus === 'nemail' && asked.interest === 'returns:christmas-eve' && /Christmas Eve/.test(asked.ask) && /Monthly Ritual/.test(asked.ask) && asked.r > 0 && asked.r < asked.h, JSON.stringify(asked));
  await p.locator('#pmForm button[type=submit]').click(); await p.waitForTimeout(400);
  ok(`${label}: the sign-up stays switched off in the preview`, (await p.locator('#nemail').evaluate(i => i.validity.valueMissing)) || /switched off/i.test(await p.locator('#toast').innerText()));
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
