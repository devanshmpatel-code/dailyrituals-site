import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(base + '/'); await p.waitForSelector('.jhere', { state: 'attached' }); await p.waitForTimeout(1500);
const cs = (sel, prop) => p.evaluate(([s, pr]) => { const e = document.querySelector(s); return e ? getComputedStyle(e)[pr] || getComputedStyle(e).getPropertyValue(pr) : null; }, [sel, prop]);
// the home page is a day: each chapter's ground blends out of the colour of the one before it, with no hard edge and no see-through fade
const flow = await p.evaluate(() => [...document.querySelectorAll('main section.df')].map(el => ({ g: el.dataset.ground, bg: getComputedStyle(el).backgroundImage, mask: getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage || 'none', bt: getComputedStyle(el).borderTopWidth })));
ok('home: chapters flow through the colours of the day in order', flow.map(f => f.g).join(',') === 'sand,sage,rose,euc,plum,night,night-solid', flow.map(f => f.g).join(','));
ok('home: every chapter after the first blends from the previous colour', flow.filter(f => f.g !== 'night-solid').every(f => /linear-gradient/.test(f.bg)), flow.map(f => f.bg.slice(0, 30)).join(' | '));
ok('home: no see-through fades or hairlines between chapters', flow.every(f => f.mask === 'none' && f.bt === '0px'));
// the Discovery Kit chapter was removed (owner, October 2026), and Ritual on Repeat and Moon Drops (not open yet) became one
// "Opening soon" strip after the live chapters: the chapters left run 1 to 5 without a gap
ok('home: chapters are numbered 1 to 5 in journey order, with no gap', (await p.evaluate(() => [...document.querySelectorAll('main .chapter')].map(c => (c.textContent.match(/Chapter (\d)/) || [])[1]).filter(Boolean).join(''))) === '12345');
ok('home: the Discovery Kit chapter is gone', await p.evaluate(() => !document.querySelector('main .disc') && !/Discovery Kit/.test(document.querySelector('main').innerText)));
ok('home: the Ritualists are chapter 5', await p.evaluate(() => /Chapter 5 · Belong/.test(document.querySelector('.club').textContent)));
const soon = await p.evaluate(() => { const s = document.querySelector('main .soonflow');
  const ch = [...document.querySelectorAll('main .chapter')];
  return s && { after: ch.filter(c => s.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_PRECEDING).length, before: ch.filter(c => s.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING).length, notify: s.querySelectorAll('[data-notify]').length,
    names: s.innerText, links: [...s.querySelectorAll('a')].map(a => a.getAttribute('href')).join(' '), price: /\$\d/.test(s.innerText), h: s.getBoundingClientRect().height,
    gone: !document.querySelector('main .rep-grid, main .plans, main #calc, main .drop-grid, main #voteBox, main #cd') }; });
ok('home: Ritual on Repeat and Moon Drops share one short "Opening soon" strip after every live chapter, with one notify button', !!soon && soon.after === 5 && soon.before === 0 && soon.notify === 1 && /Ritual on Repeat/.test(soon.names) && /Moon Drops/.test(soon.names) && /subscribe/.test(soon.links) && /drops/.test(soon.links) && !soon.price && soon.h < 900 && soon.gone, JSON.stringify({ ...soon, names: undefined }));
ok('home: the strip gives the next new moon from the one drop state', await p.evaluate(() => /\w+ \d{1,2}/.test(document.querySelector('.soonflow [data-drop-date]')?.textContent ?? '')));
ok('home: no link to the missing /discovery page', (await p.locator('main a[href*="discovery"]').count()) === 0);
// chapter 1 leads with candles: a clear "Shop candles" action, and a candle first in the row
ok('home: chapter 1 offers "Shop candles" up front', (await p.locator('.moment-shop .head a.btn[href*="f=candle"]').count()) === 1);
await p.waitForSelector('#msGrid .card'); ok('home: the first product in chapter 1 is a candle from the catalogue, with its real price', await p.evaluate(() => { const c = document.querySelector('#msGrid .card'); return /Candle/i.test(c.querySelector('.sub')?.textContent ?? '') && /\$\d+\.\d\d/.test(c.querySelector('.meta')?.textContent ?? ''); }));
// the proof ribbon under the opening: a lit band turning round a drum (src/ribbon.ts). Its unconfirmed facts ("[Confirm: …]")
// are drafts for Claire: never shown to customers, not even as moving copies
await p.evaluate(() => document.querySelector('.proof-strip').scrollIntoView({ block: 'center' })); await p.waitForTimeout(1200);
const rib = await p.evaluate(() => { const s = document.querySelector('.proof-strip'); const vis = [...s.querySelectorAll('.rb-it')].filter(e => e.style.visibility !== 'hidden');
  return { on: s.classList.contains('rb-on'), band: !!s.querySelector('.rb-band .rb-shape')?.getAttribute('d'), text: s.innerText, copies: [...s.querySelectorAll('.rb-tx')].map(e => e.textContent).join('|'),
    seps: s.querySelectorAll('.rb-sep svg').length, n: vis.length, three: vis.some(e => /rotateY\((?!0\.00deg)/.test(e.style.transform) && /translate3d\([^)]*, -?[1-9]/.test(e.style.transform)), hidden: s.getAttribute('aria-label') && s.querySelector('.rb-stage').getAttribute('aria-hidden') }; });
ok('home: the proof strip is a lit 3D ribbon, its facts on the turning band with glowing star and flame glyphs', rib.on && rib.band && rib.n >= 3 && rib.three && rib.seps >= rib.n, JSON.stringify({ ...rib, text: undefined, copies: undefined }));
ok('home: the ribbon never shows a "[Confirm: …]" placeholder to customers', !/\[confirm/i.test(rib.text) && !/confirm/i.test(rib.copies) && (await p.locator('.proof-strip .confirm:visible').count()) === 0, rib.copies);
ok('home: screen readers get each fact once (the moving copies are hidden from them)', rib.hidden === 'true' && (await p.locator('.proof-strip .rb-src > span').count()) === 6);
const pos = () => p.evaluate(() => [...document.querySelectorAll('.proof-strip .rb-it')].map(e => e.style.transform).join('|'));
const pos0 = await pos(); await p.waitForTimeout(700);
ok('home: the ribbon turns slowly', pos0 !== await pos());
{ // the drafts toggle: Claire sees the placeholders in the ribbon; switching it off takes them away again
  await p.evaluate(() => document.getElementById('draftsToggle')?.click()); await p.waitForTimeout(400);
  const on = await p.evaluate(() => [...document.querySelectorAll('.proof-strip .rb-tx')].map(e => e.textContent).join('|'));
  await p.evaluate(() => document.getElementById('draftsToggle')?.click()); await p.waitForTimeout(400);
  const off = await p.evaluate(() => [...document.querySelectorAll('.proof-strip .rb-tx')].map(e => e.textContent).join('|'));
  ok('home: with "Show drafts for Claire" the ribbon shows the placeholders, and hides them again when it is off', /\[Confirm/.test(on) && !/Confirm/.test(off));
}
{ // reduced motion: the ribbon is still, lit and legible
  const rc = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const rp = await rc.newPage(); await setupMocks(rp);
  await rp.goto(base + '/'); await rp.waitForSelector('.proof-strip.rb-on'); await rp.evaluate(() => document.querySelector('.proof-strip').scrollIntoView({ block: 'center' })); await rp.waitForTimeout(900);
  const a = await rp.evaluate(() => [...document.querySelectorAll('.proof-strip .rb-it')].map(e => e.style.transform).join('|')); await rp.waitForTimeout(900);
  const r2 = await rp.evaluate(() => { const s = document.querySelector('.proof-strip'), r = s.getBoundingClientRect(); const mid = [...s.querySelectorAll('.rb-it')].find(e => { const q = e.getBoundingClientRect(); return q.left < innerWidth / 2 && q.right > innerWidth / 2; }); const q = mid?.getBoundingClientRect();
    return { t: [...s.querySelectorAll('.rb-it')].map(e => e.style.transform).join('|'), fits: !!q && q.left >= 0 && q.right <= innerWidth, size: mid ? parseFloat(getComputedStyle(mid.querySelector('.rb-tx')).fontSize) : 0, sw: document.documentElement.scrollWidth - innerWidth }; });
  ok('reduced motion (phone): the ribbon stands still, a whole fact readable in the middle, no sideways scroll', a === r2.t && r2.fits && r2.size >= 13 && r2.sw <= 1, JSON.stringify({ ...r2, t: undefined }));
  await rc.close();
}
ok('home: the first chapter eases down from the dark opening strip', /gradient/.test(await cs('.moment-shop', 'backgroundImage')));
ok('home: the footer rises out of a soft fade', /gradient/.test(await p.evaluate(() => getComputedStyle(document.querySelector('footer'), '::before').backgroundImage)));
const radii = await p.evaluate(() => [...document.querySelectorAll('#msGrid .card .ph')].map(e => getComputedStyle(e).borderTopLeftRadius));
ok('home: product pictures alternate arch and soft-window cutouts', new Set(radii).size >= 2 && radii.some(r => parseFloat(r) > 100), radii.join(' '));
const tiles = await p.evaluate(() => new Set([...document.querySelectorAll('.wall .tile img')].map(e => getComputedStyle(e).borderTopLeftRadius)).size);
ok('home: Ritual Wall photos use a mix of cutouts', tiles >= 3, `${tiles} shapes`);
const f = () => p.evaluate(() => getComputedStyle(document.querySelector('#msGrid .card .ph img.main, .wall .tile img')).filter);
ok('photo grade is on by default', /saturate/.test(await f()), await f());
await p.locator('#gradeToggle').uncheck(); await p.waitForTimeout(200); ok('the Photo grade switch turns it off', (await f()) === 'none', await f());
await p.reload(); await p.waitForSelector('#gradeToggle'); await p.waitForTimeout(500); ok('and the choice is remembered', !(await p.locator('#gradeToggle').isChecked()));
await p.locator('#gradeToggle').check();
await p.goto(base + '/coaching'); await p.waitForSelector('.c-hero'); await p.waitForTimeout(600);
ok('coaching: the green hero fades into the page', /gradient/.test(await cs('.c-hero', 'maskImage')));
ok('coaching: the hero picture has a leaf cutout', parseFloat(await cs('.c-hero .ph', 'borderTopLeftRadius')) > 100);
await p.goto(base + '/product/cabana'); await p.waitForSelector('.mainimg'); await p.waitForTimeout(500);
ok('product: the main photo has soft rounded corners', parseFloat(await cs('.mainimg', 'borderTopLeftRadius')) >= 24);
for (const r of ['/', '/shop', '/coaching', '/subscribe', '/drops']) { await p.goto(base + r); await p.waitForTimeout(900); const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(`${r}: no sideways scroll`, o <= 1, `${o}`); }
ok('product: photo pins are hidden from customers until checked against real photos', await (async () => { await p.goto(base + '/product/cabana-fragrance-roller'); await p.waitForTimeout(1200); return p.evaluate(() => [...document.querySelectorAll('.hs')].every(e => getComputedStyle(e).display === 'none')); })());
// the breathing pause on the home page is the glowing orb only (no separate section repeating it)
await p.goto(base + '/'); await p.waitForSelector('.breathorb'); await p.waitForTimeout(800);
ok('home: no separate breathing section repeats the orb', (await p.locator('.breathband, #app [data-breathe]').count()) === 0);
await p.locator('.breathorb').click(); await p.waitForSelector('.jbreathe.open'); ok('home: the glowing orb opens the breathing screen', true); await p.keyboard.press('Escape'); await p.waitForTimeout(600);
await p.goto(base + '/coaching'); await p.waitForSelector('[data-breathe]'); await p.locator('.c-hero [data-breathe]').click(); await p.waitForSelector('.jbreathe.open'); ok('coaching: one mindful minute is offered before the discovery call', true); await p.keyboard.press('Escape'); await p.waitForTimeout(600);
await p.goto(base + '/order-confirmed'); await p.waitForSelector('[data-breathe]'); await p.locator('main [data-breathe]').click(); await p.waitForSelector('.jbreathe.open'); ok('order confirmed: a breath while the order is packed', true); await p.keyboard.press('Escape'); await p.waitForTimeout(600);
await p.goto(base + '/shop'); await p.reload(); await p.waitForSelector('#skipBtn'); await p.waitForTimeout(900); await p.keyboard.press('Tab'); ok('the skip link is the first thing a keyboard user reaches', await p.evaluate(() => document.activeElement?.id === 'skipBtn'));
await p.keyboard.press('Enter'); ok('and it moves focus to the page content', await p.evaluate(() => document.activeElement?.id === 'app'));
ok('headings never skip a level for screen readers', await p.evaluate(() => { let prev = 0, bad = 0; document.querySelectorAll('main h1,main h2,main h3,main h4').forEach(h => { const l = Number(h.getAttribute('aria-level') || h.tagName[1]); if (prev && l > prev + 1) bad++; prev = l; }); return bad === 0; }));
ok('no JS errors', errs.length === 0, errs.join('|'));
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
