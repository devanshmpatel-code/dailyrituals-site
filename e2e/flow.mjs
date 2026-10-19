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
// (the running order the owner approved, October 2026: Our candles, Meet Claire, Ritual on Repeat, coaching, Moon Drops, the
// Ritualists, Send a Sky; the grounds run sand, rose, eucalyptus, dusk, night and the next morning's first light)
ok('home: chapters flow through the colours of the day in order', flow.map(f => f.g).join(',') === 'sand,rose,euc,dusk,night,daybreak', flow.map(f => f.g).join(','));
ok('home: every chapter after the first blends from the previous colour', flow.filter(f => f.g !== 'night-solid').every(f => /linear-gradient/.test(f.bg)), flow.map(f => f.bg.slice(0, 30)).join(' | '));
ok('home: no see-through fades or hairlines between chapters', flow.every(f => f.mask === 'none' && f.bt === '0px'));
const order = await p.evaluate(() => [...document.querySelectorAll('main .chapter')].map(c => c.textContent.replace(/\s+/g, ' ').trim()));
ok('home: chapters are numbered 1 to 7 in journey order, with no gap', order.map(t => (t.match(/Chapter (\d)/) || [])[1]).filter(Boolean).join('') === '1234567', order.join(' | '));
ok('home: the new running order: Our candles, Meet Claire, Ritual on Repeat, coaching, Moon Drops, the Ritualists, Send a Sky', await p.evaluate(() => {
  const at = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect().top + scrollY : -1; };
  const ys = ['#day', '.moment-shop', '.claire', '.repeatflow', '.coachflow', '.dropflow', '.ritflow', '.giftsec', '.giftsec .jr-teaser'].map(at);
  return ys.every(y => y >= 0) && ys.every((y, i) => !i || y > ys[i - 1]) && /Our candles/.test(document.querySelector('.moment-shop .chapter').textContent) && /Meet Claire/.test(document.querySelector('.claire .chapter').textContent)
    && /Repeat/.test(document.querySelector('.repeatflow h2').textContent) && /Moon Drops/.test(document.querySelector('.dropflow .chapter').textContent) && /Ritualists/.test(document.querySelector('.ritflow .chapter').textContent)
    && /Send a Sky/.test(document.querySelector('.giftsec h2').textContent) && !document.querySelector('.giftsec .jr-teaser').nextElementSibling;
}));
ok('home: the Discovery Kit chapter is gone', await p.evaluate(() => !document.querySelector('main .disc') && !/Discovery Kit/.test(document.querySelector('main').innerText)));
ok('home: no 7-day reset, no free shipping, no "Send a Sunrise" and no "From first light" below the opening', await p.evaluate(() => { const hero = document.querySelector('#day'); const t = [...document.querySelectorAll('main > *')].filter(e => e !== hero).map(e => e.innerText).join(' ');
  return !/7-day|reset/i.test(t) && !/free shipping/i.test(t) && !/Send a Sunrise/i.test(t) && !/first light to/i.test(t) && !document.querySelector('main a[href$="/reset"]'); }));
ok('home: From the studio is switched off', (await p.locator('main .studio').count()) === 0);
ok('home: Meet Claire has the new paragraph and a clear "Read my story" button', await p.evaluate(() => { const c = document.querySelector('.claire'); const a = c.querySelector('a.btn[href$="/story"]');
  return /rewire their brains through neuroplasticity/.test(c.innerText) && /how the two are related\?/.test(c.innerText) && !!a && /Read my story/.test(a.textContent) && a.getBoundingClientRect().height >= 44; }));
const rep = await p.evaluate(() => { const s = document.querySelector('.repeatflow'); return { t: s.innerText, sub: !!s.querySelector('a[href$="/subscribe"]'), form: !!s.querySelector('form.nform #nemail'), plans: [...s.querySelectorAll('.plan h3')].map(h => h.textContent).join(',') }; });
ok('home: Ritual on Repeat is a compact, coming-soon version of the subscribe page with the Monthly Ritual sign-up', rep.plans === 'Single Refill,Ritual Pair,Solstice Box' && rep.sub && rep.form && /coming soon/i.test(rep.t) && /10% off every delivery/.test(rep.t) && /15% off/.test(rep.t) && /\$79/.test(rep.t) && /\$88 value/.test(rep.t) && !/free shipping/i.test(rep.t), JSON.stringify({ ...rep, t: undefined }));
ok('home: the coaching chapter opens with the segue line and leads to the free discovery call', await p.evaluate(() => { const c = document.querySelector('.coachflow'); return /The candle is the cue\. What happens next is where real change begins\./.test(c.querySelector('.say').getAttribute('aria-label') ?? c.querySelector('.say').textContent) && !!c.querySelector('a.btn[href$="/book"]'); }));
ok('home: the hero practice card offers the free discovery call', await p.evaluate(() => { const a = document.querySelector('#dProducts .sp-coach'); return !!a && /\/book$/.test(a.getAttribute('href')) && /discovery call/i.test(a.textContent); }));
ok('home: Moon Drops give the next seasonal drop from the one drop state', await p.evaluate(() => /\w+ \d{1,2}/.test(document.querySelector('.dropflow [data-drop-date]')?.textContent ?? '') && /once a season/i.test(document.querySelector('.dropflow').innerText)));
const rit = await p.evaluate(() => { const s = document.querySelector('.ritflow'); const f = s.querySelector('form.rt-form');
  return { t: s.innerText, email: !!f?.querySelector('input[type=email]'), month: f?.querySelector('select[name=month]')?.options.length, day: f?.querySelector('select[name=day]')?.options.length, year: !!f?.querySelector('[name=year], input[type=date]'),
    giving: !!s.querySelector('a[href$="/giving"]'), tiers: [...s.querySelectorAll('.tier .tname')].map(e => e.textContent).join(','), card: !!s.querySelector('.rit-card-wrap') }; });
ok('home: the Ritualists show three tiers, 100 points = $5 off, coming soon, and no free shipping', rit.tiers === 'Dawn,Golden Hour,Midnight' && /100 points = \$5 off/.test(rit.t) && /coming soon/i.test(rit.t) && /300 points a year/.test(rit.t) && /600 points a year/.test(rit.t) && /free roller on your birthday/i.test(rit.t) && /Early access to every Moon Drop/i.test(rit.t) && !/free shipping/i.test(rit.t), rit.t.slice(0, 200));
ok('home: the Ritualists waitlist asks for an email and a birthday (month and day, never a year), and says why', rit.email && rit.month === 13 && rit.day === 32 && !rit.year && /We'll only use your birthday to send your Solar Return gift\./.test(rit.t), JSON.stringify({ ...rit, t: undefined }));
ok('home: "Give $10, get $10" is shown as coming soon, and one line links to giving back', /Give \$10, get \$10/.test(rit.t) && rit.giving && rit.card);
{ // the waitlist goes nowhere while writes are off: it says so, like every other sign-up in the preview
  const sent = []; p.on('request', r => { if (r.method() === 'POST' && /wix/i.test(r.url())) sent.push(r.url()); });
  await p.fill('#ritEmail', 'test@example.com'); await p.selectOption('#ritMonth', '3'); await p.selectOption('#ritDay', '14'); await p.click('.ritflow .rt-join'); await p.waitForTimeout(400);
  ok('home: the waitlist does not submit to Wix in the preview, and says sign-ups are switched off', sent.length === 0 && /switched off/i.test(await p.evaluate(() => document.querySelector('.toast, [role="status"]')?.textContent ?? '')) && /#?\/?$/.test(new URL(p.url()).hash.replace('#', '') || '/'), sent.join(' '));
}
ok('home: no link to the missing /discovery page', (await p.locator('main a[href*="discovery"]').count()) === 0);
// chapter 1, Our candles: a clear "Shop candles" action and a fixed row, one card per type (not tied to the time of day)
ok('home: chapter 1 offers "Shop candles" up front', (await p.locator('.moment-shop .head a.btn[href*="f=candle"]').count()) === 1);
await p.waitForSelector('#msGrid .card'); ok('home: the first product in chapter 1 is a candle from the catalogue, with its real price', await p.evaluate(() => { const c = document.querySelector('#msGrid .card'); return /Candle/i.test(c.querySelector('.sub')?.textContent ?? '') && /\$\d+\.\d\d/.test(c.querySelector('.meta')?.textContent ?? ''); }));
const row = await p.evaluate(() => [...document.querySelectorAll('#msGrid .card')].map(c => c.querySelector('a[href*="/product/"]').getAttribute('href').split('/product/')[1]).join(','));
ok('home: Our candles is the fixed row: Citrus & Sun candle, Windy Beach roller, Citrus & Sun mini diffuser, Campfire Stories candle', row === 'citrus-sun,windy-beach-fragrance-roller,citrus-sun-mini-diffuser,campfire-stories', row);
ok('home: no time-of-day tabs, no heading "From first light", no deodorant in the row, and the chapter label is bold', await p.evaluate(() => !document.querySelector('.ms-tabs, [data-ms]') && !/first light/i.test(document.querySelector('.moment-shop').innerText) && !/deodorant/i.test(document.querySelector('#msGrid').innerText) && Number(getComputedStyle(document.querySelector('.moment-shop .chapter')).fontWeight) >= 600));
// the proof ribbon under the opening: a lit band turning round a drum (src/ribbon.ts). Its unconfirmed facts ("[Confirm: …]")
// are drafts for Claire: never shown to customers, not even as moving copies
await p.evaluate(() => document.querySelector('.proof-strip').scrollIntoView({ block: 'center' })); await p.waitForTimeout(1200);
const rib = await p.evaluate(() => { const s = document.querySelector('.proof-strip'); const vis = [...s.querySelectorAll('.rb-it')].filter(e => e.style.visibility !== 'hidden');
  return { on: s.classList.contains('rb-on'), band: !!s.querySelector('.rb-band .rb-shape')?.getAttribute('d'), text: s.innerText, copies: [...s.querySelectorAll('.rb-tx')].map(e => e.textContent).join('|'),
    seps: s.querySelectorAll('.rb-sep svg').length, n: vis.length, three: vis.some(e => /rotateY\((?!0\.00deg)/.test(e.style.transform) && /translate3d\([^)]*, -?[1-9]/.test(e.style.transform)), hidden: s.getAttribute('aria-label') && s.querySelector('.rb-stage').getAttribute('aria-hidden') }; });
ok('home: the proof strip is a lit 3D ribbon, its facts on the turning band with glowing star and flame glyphs', rib.on && rib.band && rib.n >= 3 && rib.three && rib.seps >= rib.n, JSON.stringify({ ...rib, text: undefined, copies: undefined }));
ok('home: the ribbon never shows a "[Confirm: …]" placeholder to customers', !/\[confirm/i.test(rib.text) && !/confirm/i.test(rib.copies) && (await p.locator('.proof-strip .confirm:visible').count()) === 0, rib.copies);
ok('home: screen readers get each fact once (the moving copies are hidden from them)', rib.hidden === 'true' && (await p.locator('.proof-strip .rb-src > span').count()) === 4);
ok('home: the ribbon says the four approved facts, and no stockist or returns line', await p.evaluate(() => [...document.querySelectorAll('.proof-strip .rb-src > span')].map(e => e.textContent).join(' · ')) === 'Hand poured in small batches in BC · 16 years of formulating experience · One scent, every format · Free 20-minute discovery call with Claire' && !/stockist|return/i.test(rib.copies), rib.copies);
const pos = () => p.evaluate(() => [...document.querySelectorAll('.proof-strip .rb-it')].map(e => e.style.transform).join('|'));
const pos0 = await pos(); await p.waitForTimeout(700);
ok('home: the ribbon turns slowly', pos0 !== await pos());
{ // the drafts toggle: the ribbon is rebuilt from what is shown, the same facts either way (no placeholders are left in it)
  await p.evaluate(() => document.getElementById('draftsToggle')?.click()); await p.waitForTimeout(400);
  const on = await p.evaluate(() => [...document.querySelectorAll('.proof-strip .rb-tx')].map(e => e.textContent).join('|'));
  await p.evaluate(() => document.getElementById('draftsToggle')?.click()); await p.waitForTimeout(400);
  const off = await p.evaluate(() => [...document.querySelectorAll('.proof-strip .rb-tx')].map(e => e.textContent).join('|'));
  ok('home: with or without "Show drafts for Claire" the ribbon shows the same facts, never a placeholder', /16 years/.test(on) && /16 years/.test(off) && !/Confirm/.test(on + off));
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
// (the Ritual Wall is not on home; its studio photographs are switched off with From the studio)
ok('home: no wall of studio photos', (await p.locator('main .wall .tile').count()) === 0);
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
{ // the bar and header lead with what is live; on a phone the home page is shorter (a sales review, October 2026)
  await p.goto(base + '/'); await p.waitForSelector('#announceDrop .d'); await p.waitForTimeout(600);
  const bar = await p.evaluate(() => { const a = document.querySelector('#announce'); return { kids: [...a.children].filter(e => !e.classList.contains('an-sep')).map(e => e.className), text: a.innerText.replace(/\s+/g, ' '), gift: a.querySelector('a.an-gift')?.getAttribute('href'), giftH: a.querySelector('a.an-gift')?.getBoundingClientRect().height }; });
  ok('desktop bar: free shipping first, then gifting (a link), then the next new moon, last', bar.kids.join(',') === 'an-live,an-gift,an-drop' && /^Free shipping on Canadian orders over \$75/.test(bar.text) && /gift$/.test(bar.gift ?? '') && bar.giftH >= 44 && /new moon/i.test(bar.text) && !/coming soon/i.test(bar.text), JSON.stringify(bar));
  const pill = await p.evaluate(() => { const a = document.querySelector('.club-pill'), r = a.getBoundingClientRect(), cs = getComputedStyle(a); return { href: a.getAttribute('href'), text: a.innerText.trim(), h: r.height, bg: cs.backgroundImage, border: cs.borderTopWidth }; });
  ok('desktop header: the Ritualists link is quiet (no "Soon" badge, no pill) and still goes to the club', /club$/.test(pill.href) && pill.text === 'The Ritualists' && pill.h >= 44 && pill.bg === 'none' && pill.border === '0px', JSON.stringify(pill));
  const pc = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const pp = await pc.newPage(); await setupMocks(pp);
  await pp.goto(base + '/'); await pp.waitForSelector('.ritflow .rit-card-wrap'); await pp.waitForTimeout(1200);
  const ph = await pp.evaluate(() => { const bar = document.querySelector('#announce'), r = bar.getBoundingClientRect(), row = document.querySelector('.jr-teaser .jr-cards'), cards = [...row.children].map(c => Math.round(c.getBoundingClientRect().top));
    return { bar: Math.round(r.height), barText: bar.innerText.replace(/\s+/g, ' '), rit: Math.round(document.querySelector('.ritflow').getBoundingClientRect().height), row: new Set(cards).size === 1 && row.scrollWidth > row.clientWidth && getComputedStyle(row).overflowX === 'auto', page: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth - innerWidth }; });
  ok('phone bar: two short lines, free shipping first and the next Moon Drop short ("Moon Drop Jan 7")', ph.bar <= 80 && /^Free shipping/.test(ph.barText) && /Moon Drop [A-Z][a-z]{2} \d{1,2}/.test(ph.barText), JSON.stringify(ph));
  // (the page is longer than the October "Opening soon" version: the owner's order gives Ritual on Repeat, Moon Drops and the
  // Ritualists a chapter each)
  ok('phone home: the Ritualists fit in about two and a half screens, the Journal is a swipe row, no sideways scroll', ph.rit < 2300 && ph.row && ph.page < 16000 && ph.sw <= 1, JSON.stringify(ph));
  await pc.close();
}
ok('no JS errors', errs.length === 0, errs.join('|'));
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
