// The selling flow on phones and desktop: the free-shipping meter, the add-to-cart that stays in reach on a phone, the shop's
// order and shortcuts, the same-scent cross-sell, the quiz's reasons, the Journal's next steps, no sideways scroll at 360px
// and tap targets of at least 44px on the shop, product, cart and the pages around them.
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const count = p => p.locator('#cartCount').innerText().then(Number);
const PAGES = ['/shop', '/shop?f=candle&m=all&s=featured', '/product/cabana', '/product/cabana-fragrance-roller', '/product/cabana-mini-diffuser', '/product/natural-deodorant', '/drops', '/subscribe', '/journal', '/journal/wooden-wick', '/help', '/account', '/wall', '/club', '/reset', '/book', '/gift', '/order-confirmed', '/explore', '/explore?tab=quiz'];
// visible controls in the page body that are smaller than 44px (inline text links in running text, radio dots inside a
// bigger label, and draft notes for Claire are left out)
const smallTargets = p => p.evaluate(() => [...document.querySelectorAll('#app :is(a, button, select, summary, input:not([type=radio]), [role=tab]), .drawer :is(a, button)')].filter(el => {
  const s = getComputedStyle(el), r = el.getBoundingClientRect();
  if (s.visibility === 'hidden' || s.display === 'none' || !r.width || !r.height || el.closest('[hidden], .d, .confirm, [aria-hidden="true"], .preview-bar')) return false;
  if (el.tagName === 'A' && s.display === 'inline' && el.closest('p, li, .crumbs, .dbody')) return false;
  if (el.closest('#overlay[hidden]')) return false;
  if (el.matches('input[type=checkbox]') && el.closest('label')) return false;
  // a text link may take its tap on an invisible margin around it (::after), so its underline stays where it is
  const af = getComputedStyle(el, '::after'); const grow = af.position === 'absolute' && af.content !== 'none' ? Math.max(0, -(parseFloat(af.top) || 0)) + Math.max(0, -(parseFloat(af.bottom) || 0)) : 0;
  return r.height + grow < 43.5 || r.width < 43.5;
}).map(el => `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`));

{ // phone (390): shop, product, cart, toast, gift, quiz, journal
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/shop'); await p.waitForSelector('.grid.grouped .ghead'); await p.waitForTimeout(500);
  const heads = await p.locator('.grid.grouped .ghead h2').allInnerTexts();
  // one card per scent: the shop is grouped by scent family first, then the products with no family yet, by format
  ok('phone /shop: scent families come first, then the formats', /Fresh and coastal/.test(heads[0] ?? '') && heads.some(h => /candles/i.test(h)) && /Kits and boxes/.test(heads.at(-1) ?? ''), heads.join(' / '));
  const jump = await p.locator('.shop-jump a').evaluateAll(as => as.map(a => [a.textContent.trim(), a.getAttribute('href'), a.getBoundingClientRect().height]));
  ok('phone /shop: a shortcut row of Candles, Rollers, Diffusers and Gifts sits near the top', jump.map(j => j[0]).join(',') === 'Candles,Rollers,Diffusers,Gifts' && /\/gift$/.test(jump[3][1]) && jump.every(j => j[2] >= 44) && await p.evaluate(() => document.querySelector('.shop-jump').getBoundingClientRect().top < innerHeight), JSON.stringify(jump));
  ok('phone /shop: the format heads keep their photograph clear of the words', await p.evaluate(() => [...document.querySelectorAll('.ghead .ghead-ph')].every(img => { const r = img.getBoundingClientRect(), h = img.closest('.ghead').querySelector('h2').getBoundingClientRect(); return r.bottom <= h.top + 1; })));
  ok('phone /shop: "Coming soon" is a full-width band, never beside a live product', await p.evaluate(() => { const s = document.querySelector('.ghead.soon'); return !!s && Math.abs(s.getBoundingClientRect().width - document.querySelector('.grid.grouped').getBoundingClientRect().width) < 2; }));
  ok('phone /shop: the sort sits with the product count', (await p.locator('.shop-count #sort').count()) === 1);
  ok('phone /shop: no link to a page that does not exist', (await p.locator('#app a[href$="/discovery"]').count()) === 0);
  // product: price and size above the fold (as launched, without the preview bar), the cross-sell, the sticky add
  await p.goto(base + '/product/cabana'); await p.waitForSelector('[data-choice]'); await p.waitForTimeout(600);
  const fold = await p.evaluate(() => { document.querySelector('.preview-bar')?.remove(); scrollTo(0, 0); const pr = document.querySelector('.buy .price').getBoundingClientRect(), ch = document.querySelector('[data-choice]').getBoundingClientRect(); return [Math.round(pr.bottom), Math.round(ch.bottom), innerHeight]; });
  ok('phone product: the price and the size choice are above the fold', fold[0] < fold[2] && fold[1] < fold[2], fold.join(' / '));
  const also = await p.locator('#p-also .card h3').allInnerTexts();
  ok('phone product: "Also in Cabana" shows the scent in its other formats', /Also in/i.test(await p.locator('#p-also h2').innerText()) && also.length >= 2 && also.every(t => /Cabana/.test(t)), also.join(', '));
  const like = await p.locator('#p-more .card h3').allInnerTexts();
  ok('phone product: "You may also like" does not repeat the same scent', like.length > 0 && !like.some(t => /^Cabana$/.test(t.trim())), like.join(', '));
  ok('phone product: the refill row reads as a secondary "coming soon", with no price', await p.evaluate(() => { const l = document.querySelector('.po label.po-soon'); return !!l && /Refill subscription · coming soon/i.test(l.textContent) && !/\$/.test(l.textContent) && !/save/i.test(l.textContent); }));
  let sticky = [];
  for (const id of ['p-details', 'p-also', 'p-practice', 'p-more']) {
    await p.evaluate(id => { const el = document.getElementById(id); scrollTo(0, el.getBoundingClientRect().top + scrollY + el.offsetHeight / 2 - innerHeight / 2); }, id); await p.waitForTimeout(450);
    sticky.push(await p.evaluate(() => { const a = document.querySelector('.lnav-add'), r = a.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.height >= 44 && /Add to cart/.test(a.getAttribute('aria-label')); }));
  }
  ok('phone product: add to cart stays on screen, 44px tall, all the way down the product page', sticky.every(Boolean), sticky.join(','));
  const c0 = await count(p); await p.locator('.lnav-add').click(); await p.waitForTimeout(500);
  ok('phone product: the sticky add puts it in the cart', (await count(p)) === c0 + 1);
  ok('phone product: the toast offers "View cart" and "Keep shopping"', (await p.locator('#toast.on .t-act').allInnerTexts()).join('|') === 'View cart|Keep shopping');
  await p.locator('#toast .t-act.pri').click(); await p.waitForTimeout(500);
  ok('phone: "View cart" opens the cart', await p.evaluate(() => !document.getElementById('overlay').hidden));
  // the free-shipping meter
  const ship1 = await p.evaluate(() => ({ t: document.querySelector('.drawer .ship')?.textContent ?? '', v: Number(document.querySelector('.drawer .ship .meter')?.getAttribute('aria-valuenow')), max: Number(document.querySelector('.drawer .ship .meter')?.getAttribute('aria-valuemax')) }));
  ok('cart: the meter counts toward free shipping at $150', ship1.max === 150 && ship1.v === 12 && /Add \$138\.00 more for free shipping/.test(ship1.t), JSON.stringify(ship1));
  for (let i = 0; i < 12; i++) { await p.locator('.drawer [data-inc]').first().click(); await p.waitForTimeout(150); }
  const ship2 = await p.evaluate(() => ({ t: document.querySelector('.drawer .ship')?.textContent ?? '', done: document.querySelector('.drawer .ship')?.classList.contains('done'), w: document.querySelector('.drawer .ship .meter div')?.style.width }));
  ok('cart: past $150 the meter is full and says shipping is free', ship2.done && /Free shipping/i.test(ship2.t) && ship2.w === '100%', JSON.stringify(ship2));
  const cs = await smallTargets(p);
  ok('cart: every control is at least 44px', cs.length === 0, cs.join(' | '));
  ok('cart: a "Keep shopping" way back', (await p.locator('.drawer .df .keep').count()) === 1);
  await p.locator('.drawer .df .keep').click(); await p.waitForTimeout(300);
  ok('cart: "Keep shopping" closes the cart', await p.evaluate(() => document.getElementById('overlay').hidden));
  // send as a gift
  await p.goto(base + '/product/cabana-fragrance-roller'); await p.waitForSelector('.gt-btn');
  ok('phone product: "Send as a gift" starts closed', (await p.getAttribute('.gt-btn', 'aria-expanded')) === 'false' && await p.locator('#giftPanel').isHidden());
  await p.click('.gt-btn');
  ok('phone product: "Send as a gift" opens and leads to Send a Sky', (await p.getAttribute('.gt-btn', 'aria-expanded')) === 'true' && await p.locator('#giftPanel a[href$="/gift"]').isVisible());
  // quiz: the best match first, the reason in the visitor's words, and a gift branch
  await p.goto(base + '/explore?tab=quiz'); await p.waitForSelector('[data-ans]');
  for (let i = 0; i < 4; i++) { await p.locator('[data-ans="3"]').click(); await p.waitForTimeout(120); }
  await p.waitForSelector('.qres');
  ok('quiz: the result says why, in the answers given', /Because you chose .*a cabin with a fire going/i.test(await p.locator('.qres-why').innerText()), await p.locator('.qres-why').innerText());
  ok('quiz: the best match comes first and leads with a candle', await p.evaluate(() => { const best = document.querySelector('.qbest'), grid = document.querySelector('#qGrid'); return !!best && best.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING && /Candle/.test(best.querySelector('.qbest-fmts a')?.textContent ?? ''); }));
  await p.click('[data-for="gift"]');
  ok('quiz: "A gift" turns the next step into sending it as a gift', /\/gift$/.test(await p.locator('#qCta a').first().getAttribute('href')));
  // the Journal ends with the two next steps
  for (const r of ['/journal', '/journal/candle-safety']) {
    await p.goto(base + r); await p.waitForSelector('.jr-end');
    const hrefs = await p.locator('.jr-end a').evaluateAll(as => as.map(a => a.getAttribute('href')));
    ok(`phone ${r}: ends with "Shop candles" and "Take the scent quiz"`, hrefs.some(h => /shop\?f=candle/.test(h)) && hrefs.some(h => /tab=quiz/.test(h)), hrefs.join(' '));
  }
  ok('journal: "draught", not "draft"', /Out of the draught/.test(await p.locator('.jr-body').innerText()));
  await p.goto(base + '/account'); await p.waitForSelector('.acct-panel');
  ok('/account: customer wording and a next step', !/Wix/.test(await p.locator('#app').innerText()) && (await p.locator('.acct-panel a[href$="/shop"]').count()) === 1);
  await p.goto(base + '/subscribe'); await p.waitForSelector('#calc'); await p.waitForTimeout(800);
  ok('/subscribe: the refill sums are labelled an estimate for a service not yet open', /estimate/i.test(await p.locator('#calc').innerText()));
  // tap targets of at least 44px on the pages of this pass
  for (const r of PAGES) {
    await p.goto(base + r); await p.waitForTimeout(1300);
    const s = await smallTargets(p);
    ok(`phone ${r}: tap targets are at least 44px`, s.length === 0, s.slice(0, 6).join(' | '));
  }
  ok('phone: no JS errors', errs.length === 0, errs.join(' | ').slice(0, 200));
  await ctx.close();
}
{ // Send a Sky: a live candle chosen on the gift page goes into the cart with the card details on its line
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
  await p.goto(base + '/gift'); await p.waitForSelector('[data-gift-candle]');
  const list = await p.locator('[data-gift-candle] b').allInnerTexts();
  ok('gift: the candles to choose from are the live, in-stock candles (no rollers, diffusers or deodorant)', list.length >= 6 && list.includes('Cabana') && !list.some(n => /Roller|Diffuser|Deodorant/i.test(n)), list.join(', '));
  ok('gift: "Gift a candle" no longer sends the buyer away to the shop', (await p.locator('#app a.gr-live, #app a[href*="shop?f=candle"]').count()) === 0);
  ok('gift: the gift sets stay coming soon and cannot be chosen', (await p.locator('[data-gr-soon][disabled]').count()) === 5 && (await p.locator('[data-gr^="set-"]').count()) === 0);
  ok('gift: the arrive-on date cannot start before today', (await p.getAttribute('#gDate', 'min')) === day(0));
  const c0 = await count(p);
  await p.click('#gAdd'); await p.waitForTimeout(200);
  ok('gift: adding with no candle chosen asks for one and adds nothing', await p.locator('#gPickErr').isVisible() && (await count(p)) === c0, await p.locator('#gPickErr').innerText().catch(() => ''));
  await p.locator('[data-gift-candle]', { hasText: 'Cabana' }).click();
  await p.waitForSelector('[data-gift-size="8 oz"]'); await p.waitForFunction(() => /\$32\.00/.test(document.querySelector('[data-gift-size="8 oz"]')?.textContent ?? ''));
  await p.click('[data-gift-size="8 oz"]'); await p.waitForTimeout(150);
  ok('gift: the chosen size shows its real price on the button and beside the card', /\$32\.00/.test(await p.locator('#gAdd').innerText()) && /Cabana/.test(await p.locator('#gSum').innerText()) && /8 oz · \$32\.00/.test(await p.locator('#gSum').innerText()), await p.locator('#gAdd').innerText());
  const note = 'For your new flat. Light it on a quiet evening.';
  await p.fill('#gNote', note); await p.fill('#gTo', 'Sam');
  await p.fill('#gDate', day(-1)); await p.click('#gAdd'); await p.waitForTimeout(200);
  ok('gift: a date in the past is refused, and nothing is added', await p.locator('#gDateErr').isVisible() && /passed/i.test(await p.locator('#gDateErr').innerText()) && (await p.getAttribute('#gDate', 'aria-invalid')) === 'true' && (await count(p)) === c0);
  await p.evaluate(() => { const t = document.getElementById('gNote'); t.value = 'x'.repeat(150); t.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.fill('#gDate', day(7)); await p.click('#gAdd'); await p.waitForTimeout(200);
  ok('gift: a note over 140 characters is refused', await p.locator('#gNoteErr').isVisible() && (await count(p)) === c0 && !(await p.locator('#gDateErr').isVisible()));
  await p.fill('#gNote', ''); await p.fill('#gTo', ''); await p.click('#gAdd'); await p.waitForTimeout(200);
  ok('gift: an empty note and no name are asked for', await p.locator('#gNoteErr').isVisible() && await p.locator('#gToErr').isVisible() && (await count(p)) === c0);
  await p.fill('#gNote', note); await p.fill('#gTo', 'Sam'); await p.click('[data-sky="dawn"]');
  await p.click('#gAdd'); await p.waitForTimeout(500);
  ok('gift: with a candle, a note, a name and a date it goes in the cart', (await count(p)) === c0 + 1 && /gift for Sam/i.test(await p.locator('#toast').innerText()), await p.locator('#toast').innerText());
  ok('gift: every message clears once fixed', (await p.locator('.g-err:not([hidden])').count()) === 0);
  await p.click('#cartBtn'); await p.waitForTimeout(500);
  const li = await p.evaluate(() => { const g = document.querySelector('.drawer .li-gift'); const l = g?.closest('.li'); return g ? { t: g.innerText, name: l.querySelector('a').textContent, size: l.textContent, price: l.querySelector(':scope > b').textContent } : null; });
  ok('cart: the gift line carries the note, the name, the date and "no prices"', !!li && li.t.includes(note) && /For Sam/.test(li.t) && /Arrives on or after/.test(li.t) && /No prices on the packing slip/.test(li.t) && /Dawn card/.test(li.t), JSON.stringify(li));
  ok('cart: the gift line is the chosen candle and size at its real price', !!li && li.name === 'Cabana' && /8 oz/.test(li.size) && li.price === '$32.00', JSON.stringify(li));
  ok('cart: it stays clear that checkout is off and nothing is sent', /checkout is switched off/i.test(await p.locator('.drawer .df').innerText()) && /nothing is sent/i.test(await p.locator('.drawer .df').innerText()));
  const cs = await smallTargets(p);
  ok('cart with a gift: every control is at least 44px, no sideways scroll', cs.length === 0 && (await p.evaluate(() => document.querySelector('.drawer').scrollWidth - document.querySelector('.drawer').clientWidth)) <= 1, cs.join(' | '));
  await p.locator('.drawer [data-x]').first().click(); await p.waitForTimeout(300);
  await p.click('#gAdd'); await p.waitForTimeout(400);
  ok('gift: a second gift is its own line with its own card, not merged', (await count(p)) === c0 + 2 && await p.evaluate(() => JSON.parse(localStorage.getItem('dr_cart')).filter(l => l.gift).length === 2));
  await p.reload(); await p.waitForTimeout(1200); await p.click('#cartBtn'); await p.waitForTimeout(500);
  ok('cart: the gift details survive a reload (kept with the cart in this browser)', (await p.locator('.drawer .li-gift').count()) === 2);
  ok('gift: no JS errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}
{ // 360px (small Android): no sideways scroll anywhere on these pages
  const ctx = await b.newContext({ viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  for (const r of PAGES) {
    await p.goto(base + r); await p.waitForTimeout(1200);
    const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(`360 ${r}: no sideways scroll`, o <= 1, `${o}px`);
  }
  await p.goto(base + '/product/cabana'); await p.waitForSelector('#addBtn'); await p.click('#addBtn'); await p.waitForTimeout(400); await p.click('#cartBtn'); await p.waitForTimeout(500);
  ok('360 cart: no sideways scroll with the cart open', (await p.evaluate(() => document.querySelector('.drawer').scrollWidth - document.querySelector('.drawer').clientWidth)) <= 1);
  await ctx.close();
}
for (const [w, h] of [[1440, 900], [390, 844]]) { // one card per scent: format chips switch the card, quick add puts the chosen format in the cart
  const phone = w < 600, ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: phone, hasTouch: phone }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/shop'); await p.waitForSelector('.grid .scard'); await p.waitForTimeout(700);
  const names = await p.locator('.grid .card:not([data-concept]) h3').allInnerTexts();
  ok(`${w} /shop: one card per scent (no scent twice)`, names.length === 16 && new Set(names).size === names.length, names.join(', '));
  const cab = p.locator('.scard[data-scent="cabana"]');
  const state = () => cab.evaluate(c => ({ href: c.querySelector('a.sc-link').getAttribute('href'), ph: c.querySelector('a.sc-ph').getAttribute('href'), price: c.querySelector('.sc-price').textContent, sub: c.querySelector('.sc-sub').textContent, img: c.querySelector('img.main')?.getAttribute('src'), add: c.querySelector('.sc-add').textContent.replace(/\s+/g, ' ').trim(), pressed: c.querySelector('.sc-fmt[aria-pressed="true"]').getAttribute('aria-label') }));
  ok(`${w} /shop: Cabana's card offers its candle, roller and diffuser`, (await cab.locator('.sc-fmt').evaluateAll(bs => bs.map(x => x.getAttribute('aria-label')).join())) === 'Candle,Roller,Diffuser');
  const s0 = await state();
  ok(`${w} /shop: the card opens on the candle, sizes as the product names them`, /product\/cabana$/.test(s0.href) && s0.price === 'From $12.00' && /Candle · 2 oz · 8 oz/.test(s0.sub) && /^Quick add · 2 oz/.test(s0.add), JSON.stringify(s0));
  await cab.locator('.sc-fmt[aria-label="Roller"]').click(); await p.waitForTimeout(200);
  const s1 = await state();
  ok(`${w} /shop: the Roller chip switches the photo, price, sizes and links`, /product\/cabana-fragrance-roller$/.test(s1.href) && s1.ph === s1.href && s1.price === '$25.00' && /Fragrance Roller · 10 ml/.test(s1.sub) && s1.img !== s0.img && s1.add === 'Quick add · 10 ml · $25.00' && s1.pressed === 'Roller', JSON.stringify(s1));
  await cab.locator('.sc-fmt[aria-label="Diffuser"]').click(); await p.waitForTimeout(200);
  const s2 = await state();
  ok(`${w} /shop: the Diffuser chip does the same`, /product\/cabana-mini-diffuser$/.test(s2.href) && s2.price === '$15.00' && /Mini Diffuser · 8 ml/.test(s2.sub) && s2.add === 'Quick add · 8 ml · $15.00', JSON.stringify(s2));
  const c0 = await count(p); await cab.locator('button.sc-add').click(); await p.waitForTimeout(500);
  ok(`${w} /shop: quick add puts the chosen format in the cart`, (await count(p)) === c0 + 1 && /Cabana Mini Diffuser added/.test(await p.locator('#toast.on').innerText()));
  await cab.locator('.sc-fmt[aria-label="Candle"]').click(); await p.waitForTimeout(600);
  ok(`${w} /shop: a candle's quick add names the size it adds and its own price`, /^Quick add · 2 oz · \$12\.00$/.test((await state()).add), (await state()).add);
  const c1 = await count(p); await cab.locator('button.sc-add').click(); await p.waitForTimeout(600);
  const line = await p.evaluate(() => JSON.parse(localStorage.getItem('dr_cart') ?? '[]').find(l => l.slug === 'cabana'));
  ok(`${w} /shop: quick add on a candle adds the first size at that size's price`, (await count(p)) === c1 + 1 && /Cabana \(2 oz\) added/.test(await p.locator('#toast.on').innerText()) && !!line && line.choice === '2 oz' && line.price === 12, JSON.stringify(line));
  ok(`${w} /shop: the natural deodorant is hidden for now (no card, no filter chip)`, (await p.locator('.scard a[href*="deodorant"]').count()) === 0 && (await p.locator('.toolbar a.chip[href*="f=deodorant"]').count()) === 0 && !/natural deodorant/i.test(await p.locator('main, #app').first().innerText()));
  ok(`${w} /shop: sizes read one way ("10 ml", never "10ml")`, !(await p.locator('.grid').innerText()).match(/\d(ml|oz)\b/i));
  const small = await p.locator('.scard :is(.sc-fmt, .sc-add)').evaluateAll(els => els.filter(e => { const r = e.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5; }).length);
  ok(`${w} /shop: format chips and quick add are at least 44px`, small === 0, String(small));
  await p.goto(base + '/shop?f=roller&m=all&s=featured'); await p.waitForSelector('.grid .scard'); await p.waitForTimeout(400);
  const rl = await p.locator('.grid .scard').evaluateAll(cs => cs.map(c => c.dataset.format));
  ok(`${w} /shop?f=roller: only scents with a roller, each card open on its roller`, rl.length === 11 && rl.every(x => x === 'roller'), rl.join());
  ok(`${w} /shop: no sideways scroll`, (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
  ok(`${w} /shop: no JS errors`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}
{ // tablets and small laptops: the product details tabs (About, How to use, Ingredients, Shipping) all fit, none cut off
  for (const w of [768, 860, 900, 960, 1024]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
    await p.goto(base + '/product/cabana'); await p.waitForSelector('.tabsbar [role=tab]'); await p.waitForTimeout(600);
    const t = await p.evaluate(() => { const bar = document.querySelector('.tabsbar'), br = bar.getBoundingClientRect();
      return [...bar.querySelectorAll('[role=tab]')].map(b => { const r = b.getBoundingClientRect(); return { n: b.textContent.trim(), inside: r.left >= br.left - 0.5 && r.right <= br.right + 0.5, h: r.height, fs: parseFloat(getComputedStyle(b).fontSize) }; }); });
    ok(`${w}px product: all four detail tabs fit in the bar, at least 44px tall and 13px type`, t.length === 4 && t.every(x => x.inside && x.h >= 44 && x.fs >= 13), JSON.stringify(t.filter(x => !x.inside || x.h < 44 || x.fs < 13)));
    await ctx.close();
  }
}
{ // desktop: the cards lift on hover; the quick add's toast
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  await p.goto(base + '/shop?f=roller&m=all&s=featured'); await p.waitForSelector('.grid .card:not(.sk) button[data-qa]'); await p.waitForTimeout(500);
  const card = p.locator('.grid .card:not(.sk):not(.ghead)').first();
  await card.hover(); await p.waitForFunction(() => /matrix3d/.test(getComputedStyle(document.querySelector('.grid .card:not(.sk) .ph')).transform), null, { timeout: 2500 }).catch(() => {});
  ok('desktop /shop: a card lifts in 3D on hover', /matrix3d|rotate/.test(await card.locator('.ph').evaluate(el => getComputedStyle(el).transform)), await card.locator('.ph').evaluate(el => getComputedStyle(el).transform));
  const c0 = await count(p); await card.locator('button[data-qa]').click(); await p.waitForTimeout(500);
  ok('desktop /shop: quick add adds and offers "View cart"', (await count(p)) === c0 + 1 && (await p.locator('#toast.on .t-act').count()) === 2);
  await ctx.close();
}
{ // copy changes: the deodorant is hidden, free shipping is Canada over $150 only, no return window on product pages, Send a Sky
  for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
    const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
    await p.goto(base + '/product/natural-deodorant'); await p.waitForSelector('h1'); await p.waitForTimeout(500);
    const t = await p.locator('#app').innerText();
    ok(`${label}: the deodorant's own address says it is not available right now, with a way to the shop`, /not available right now/i.test(t) && (await p.locator('#app a[href$="/shop"]').count()) >= 1 && (await p.locator('#addBtn').count()) === 0, t.slice(0, 120));
    await p.goto(base + '/shop?f=deodorant'); await p.waitForSelector('.scard'); await p.waitForTimeout(400);
    ok(`${label}: an old ?f=deodorant link shows the whole shop, without the deodorant`, (await p.locator('.scard').count()) > 6 && (await p.locator('.scard a[href*="deodorant"]').count()) === 0);
    await p.goto(base + '/'); await p.waitForTimeout(600);
    const bar = await p.locator('#announce').innerText();
    ok(`${label}: the announcement bar says free shipping on Canadian orders over $150`, /Free shipping on Canadian orders over \$150/.test(bar), bar);
    await p.goto(base + '/product/cabana'); await p.waitForSelector('#addBtn'); await p.waitForTimeout(500);
    await p.locator('[data-tab="3"]').click(); await p.waitForTimeout(200);
    const ship = await p.locator('[data-panel="3"]').innerText();
    ok(`${label}: the product page's shipping tab has no 10-day return line and no old $75`, !/10 days|\$75/.test(ship) && !/10 days to start a return/i.test(await p.locator('#app').innerText()), ship);
    const body = await p.locator('#app').innerText();
    ok(`${label}: the product page offers the discovery call, not the 7-day reset`, !/7-day|reset/i.test(body.replace(/moment to reset/i, '')) && (await p.locator('#app a[href$="/book"]').count()) >= 1);
    await p.goto(base + '/help'); await p.waitForSelector('.help-faq'); await p.waitForTimeout(300);
    const help = await p.locator('#app').evaluate(e => e.textContent);
    ok(`${label}: help says shipping is free on Canadian orders over $150`, /free on Canadian orders over \$150/.test(help) && !/\$75/.test(help));
    await p.goto(base + '/gift'); await p.waitForSelector('#gCard'); await p.waitForTimeout(400);
    const g = await p.locator('#app').innerText();
    ok(`${label}: the gift page is Send a Sky`, /Send a\s+Sky/i.test(g) && !/Sunrise/.test(g), g.slice(0, 100));
    ok(`${label}: the menus and footer say Send a Sky`, /Send a Sky/.test(await p.locator('footer').innerText()) && !/Sunrise/.test(await p.locator('footer').innerText()));
    await ctx.close();
  }
}
await b.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
