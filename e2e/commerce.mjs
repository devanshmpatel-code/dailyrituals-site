// The selling flow on phones and desktop: the free-shipping meter, the add-to-cart that stays in reach on a phone, the shop's
// order and shortcuts, the same-scent cross-sell, the quiz's reasons, the Journal's next steps, no sideways scroll at 360px
// and tap targets of at least 44px on the shop, product, cart and the pages around them.
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const count = p => p.locator('#cartCount').innerText().then(Number);
const PAGES = ['/shop', '/shop?f=candle&m=all&s=featured', '/product/cabana', '/product/cabana-fragrance-roller', '/product/cabana-mini-diffuser', '/product/natural-deodorant', '/drops', '/subscribe', '/journal', '/journal/wooden-wick', '/help', '/account', '/wall', '/club', '/reset', '/book', '/order-confirmed', '/explore', '/explore?tab=quiz'];
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
  ok('cart: the meter counts toward free shipping at $75', ship1.max === 75 && ship1.v === 12 && /Add \$63\.00 more for free shipping/.test(ship1.t), JSON.stringify(ship1));
  for (let i = 0; i < 6; i++) { await p.locator('.drawer [data-inc]').first().click(); await p.waitForTimeout(150); }
  const ship2 = await p.evaluate(() => ({ t: document.querySelector('.drawer .ship')?.textContent ?? '', done: document.querySelector('.drawer .ship')?.classList.contains('done'), w: document.querySelector('.drawer .ship .meter div')?.style.width }));
  ok('cart: past $75 the meter is full and says shipping is free', ship2.done && /Free shipping/i.test(ship2.t) && ship2.w === '100%', JSON.stringify(ship2));
  const cs = await smallTargets(p);
  ok('cart: every control is at least 44px', cs.length === 0, cs.join(' | '));
  ok('cart: a "Keep shopping" way back', (await p.locator('.drawer .df .keep').count()) === 1);
  await p.locator('.drawer .df .keep').click(); await p.waitForTimeout(300);
  ok('cart: "Keep shopping" closes the cart', await p.evaluate(() => document.getElementById('overlay').hidden));
  // send as a gift
  await p.goto(base + '/product/cabana-fragrance-roller'); await p.waitForSelector('.gt-btn');
  ok('phone product: "Send as a gift" starts closed', (await p.getAttribute('.gt-btn', 'aria-expanded')) === 'false' && await p.locator('#giftPanel').isHidden());
  await p.click('.gt-btn');
  ok('phone product: "Send as a gift" opens and leads to Send a Sunrise', (await p.getAttribute('.gt-btn', 'aria-expanded')) === 'true' && await p.locator('#giftPanel a[href$="/gift"]').isVisible());
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
  ok(`${w} /shop: one card per scent (no scent twice)`, names.length === 17 && new Set(names).size === names.length, names.join(', '));
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
  ok(`${w} /shop: the deodorant (a choice of scent) leads to its page instead of guessing`, (await p.locator('.scard a.sc-add[href*="natural-deodorant"]').count()) === 1 && (await p.locator('.scard button[data-qa]').evaluateAll(bs => bs.some(x => /natural-deodorant/.test(x.closest('.scard').querySelector('a.sc-link').getAttribute('href'))))) === false);
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
await b.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} passed`);
process.exit(res.every(Boolean) ? 0 : 1);
