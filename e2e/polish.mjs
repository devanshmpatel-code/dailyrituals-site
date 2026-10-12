import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const visText = p => p.evaluate(() => document.querySelector('main, #app')?.innerText ?? document.body.innerText);
for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  // no points or referral promises anywhere a customer can see while the Loyalty app is not set up
  for (const r of ['/', '/shop', '/product/roller-citrus-and-sun', '/club', '/wall', '/subscribe', '/order-confirmed', '/drops', '/account']) {
    await p.goto(base + r); await p.waitForTimeout(1300);
    const t = (await visText(p)).replace(/pulse points/gi, '');
    ok(`${label} ${r}: no points or referral promises`, !/\bpoints?\b|\bpts\b|Give \$10/i.test(t), (t.match(/.{0,40}(\bpoints?\b|\bpts\b|Give \$10).{0,20}/i) || [''])[0]);
  }
  await p.goto(base + '/'); await p.waitForTimeout(800);
  ok(`${label}: no "Watch the day" button`, (await p.locator('#dayPlay').count()) === 0);
  await p.goto(base + '/shop'); await p.waitForSelector('.ghead');
  ok(`${label}: shop is grouped by format`, (await p.locator('.grid.grouped .ghead').count()) >= 4);
  ok(`${label}: "Kits and boxes" is marked coming soon`, /Coming soon/i.test(await p.locator('.ghead.soon').innerText()));
  if (label === 'mobile') ok('mobile: shop filters are one swipeable row', await p.evaluate(() => { const c = document.querySelector('.toolbar .chips'); return getComputedStyle(c).flexWrap === 'nowrap' && c.scrollWidth > c.clientWidth; }));
  await p.goto(base + '/club'); await p.waitForSelector('.clubsoon');
  ok(`${label}: Ritualists page says opening soon`, /opening soon/i.test(await p.locator('.clubsoon').innerText()));
  ok(`${label}: planned club details are drafts only`, !(await p.locator('.club-plan').isVisible()));
  await p.goto(base + '/drops'); await p.waitForTimeout(1200);
  ok(`${label}: Moon Drops no longer says "available now"`, !/available now/i.test(await visText(p)));
  await p.goto(base + '/story'); await p.waitForSelector('.st-steps');
  ok(`${label}: story has the four beats and the quote`, (await p.locator('.st-steps li').count()) === 4 && (await p.locator('.st-quote blockquote').count()) === 1);
  ok(`${label}: the story page is "Meet the maker", with "My story" in Claire's own words (drafts)`, /^Meet the maker$/i.test((await p.locator('#app h1').innerText()).trim()) && /My story/i.test(await p.locator('.st-path > .eyebrow').innerText()) && await p.evaluate(() => [...document.querySelectorAll('.st-steps li p')].every(x => x.querySelector('.d') && /\b(I|my)\b/.test(x.textContent))) && /Meet the maker/.test(await p.title()));
  ok(`${label}: no "Our story" left in the header, menu or footer`, await p.evaluate(() => !/our story/i.test([...document.querySelectorAll('header, footer, #mobileMenu')].map(e => e.textContent).join(' ')) && [...document.querySelectorAll('footer a[href$="/story"]')].every(a => a.textContent.trim() === 'Meet the maker')));
  await p.goto(base + '/explore'); await p.waitForSelector('.fl-card');
  ok(`${label}: the full scent list is grouped by mood`, (await p.locator('.fl-group').count()) >= 5);
  for (const r of ['/', '/shop', '/club', '/story', '/explore', '/subscribe']) { await p.goto(base + r); await p.waitForTimeout(900); const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(`${label} ${r}: no sideways scroll`, o <= 1, `${o}`); }
  await ctx.close();
}
{ // drafts toggle shows the planned club for Claire
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); await setupMocks(p);
  await p.goto(base + '/club'); await p.waitForSelector('.clubsoon'); await p.evaluate(() => document.body.classList.add('show-drafts'));
  ok('drafts on: the planned club shows for Claire', await p.locator('.club-plan').isVisible()); await ctx.close();
}
// ---------- trust pass: nothing promised that is not live, the Ritual Wall honest, the drop date real, the orb out of the way ----------
const CONCEPT_PRICE = /\$(18|28|79|88)(\.00)?\b|\bvalue\b/i;
for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  // the Ritual Wall: no invented posts, no promises, an honest empty state, the form near the top, real studio photographs labelled as ours
  await p.goto(base + '/wall'); await p.waitForTimeout(1300);
  const wt = await visText(p);
  ok(`${label} /wall: no fake posts, points or prizes`, !/Real rituals|Ritualists use|50 points|\+50|wins the next|Moon Drop prize|@customer/i.test(wt) && (await p.locator('#app .heart').count()) === 0, (wt.match(/.{0,30}(Real rituals|50 points|wins the next|@customer).{0,20}/i) || [''])[0]);
  ok(`${label} /wall: an honest empty state`, /opens with your first photo/i.test(await p.locator('.wall-empty').innerText()));
  ok(`${label} /wall: the consent-based upload form sits near the top`, await p.evaluate(() => { const f = document.querySelector('#upForm'); return !!f && f.getBoundingClientRect().top + scrollY < innerHeight * 1.4 && !!f.querySelector('input[type=checkbox][required]'); }));
  const wallImgs = await p.locator('.wall-studio .studio-tile img').evaluateAll(a => a.map(i => i.getAttribute('src')));
  ok(`${label} /wall: one row labelled "From the studio", real studio photographs only`, wallImgs.length >= 4 && wallImgs.every(s => s.startsWith('/img/studio/')) && /From the studio/i.test(await p.locator('.wall-studio').innerText()), wallImgs.join(' '));
  ok(`${label} /wall: the studio photographs link to nothing (no past scent looks buyable)`, (await p.locator('.wall-studio a').count()) === 0);
  // the home teaser: not "Proof", studio photographs only
  await p.goto(base + '/'); await p.waitForTimeout(1500);
  const teaser = p.locator('section[data-ground="sage"]');
  ok(`${label} home: the wall teaser is not presented as proof`, !/proof|Ritualists use/i.test(await teaser.innerText()));
  const teaserImgs = await teaser.locator('.wall img').evaluateAll(a => a.map(i => i.getAttribute('src')));
  ok(`${label} home: the wall teaser shows studio photographs only`, teaserImgs.length >= 3 && teaserImgs.every(s => s.startsWith('/img/studio/')), teaserImgs.join(' '));
  ok(`${label} home: chapter pictures are real studio photographs, not stock mockups`, await p.evaluate(() => [...document.querySelectorAll('.cf-ph img, .plans img, .disc .ph img')].every(i => (i.getAttribute('src') ?? '').startsWith('/img/studio/'))));
  // concepts: no price, no value maths, labelled coming soon, notify only
  for (const r of ['/', '/shop', '/subscribe', '/gift', '/explore', '/drops']) {
    await p.goto(base + r); await p.waitForTimeout(1300);
    const t = await visText(p);
    ok(`${label} ${r}: no price or "value" on a concept (Discovery Kit, Moon Drop, Solstice Box, gift card)`, !CONCEPT_PRICE.test(t), (t.match(/.{0,40}(\$(18|28|79|88)|\bvalue\b).{0,20}/i) || [''])[0]);
    ok(`${label} ${r}: no add-to-cart for a concept`, (await p.locator('[data-add="discovery-kit"], [data-add="moon-drop-01"], [data-add="solstice-box"], [data-gr="giftcard"], [data-gr="discovery-kit"]').count()) === 0);
    // the gift sets have no contents or prices from the shop yet, so they are coming soon, never priced or selectable
    if (r === '/gift') ok(`${label} ${r}: the gift sets show no invented price and cannot be chosen`, (await p.locator('[data-gr^="set-"]').count()) === 0 && (await p.locator('[data-gr-soon^="set-"][disabled]').count()) === 3 && !/\$(34|36|46)\.00/.test(await p.locator('main, #app').first().innerText()));
  }
  await p.goto(base + '/shop'); await p.waitForSelector('[data-concept]');
  ok(`${label} /shop: every concept card says Coming soon and offers only "get notified"`, await p.evaluate(() => [...document.querySelectorAll('[data-concept]')].every(c => /Coming soon/i.test(c.textContent) && !/\$\d/.test(c.textContent) && !!c.querySelector('[data-notify]'))) && (await p.locator('[data-concept]').count()) === 3);
  ok(`${label} /shop: touch screens are told to tap`, label === 'desktop' || /Tap a product/.test(await visText(p)));
  // the drop date: the next new moon, in the future, one state everywhere
  for (const r of ['/', '/drops']) {
    await p.goto(base + r); await p.waitForTimeout(1300);
    const d = await p.evaluate(() => ({ date: document.querySelector('[data-drop-date]')?.textContent ?? '', bar: document.getElementById('announceDrop')?.textContent ?? '', days: Number(document.querySelector('#cd b')?.textContent ?? -1), hidden: document.querySelector('#cd')?.hidden, btn: document.querySelector('[data-notify="drop"]')?.textContent ?? '' }));
    const y = new Date().getFullYear(), today = new Date(); today.setHours(0, 0, 0, 0);
    const when = [y, y + 1].map(yy => new Date(`${d.date.replace(/^Tonight · /, '').replace(/^\w+, /, '')} ${yy}`)).find(x => !isNaN(x) && x >= today);
    ok(`${label} ${r}: the drop date is the next new moon, not a date that has passed`, !!when && (when - today) / 864e5 <= 31 && !/October 11/.test(d.date), d.date);
    ok(`${label} ${r}: date, countdown, bar and button tell the same story`, d.bar.includes(d.date.replace(/^Tonight · /, '')) || /tonight/i.test(d.bar) ? (d.hidden || d.days >= 0) && /get notified/i.test(d.btn) : false, JSON.stringify(d));
    ok(`${label} ${r}: the drop shows no price and cannot be bought`, !/\$28|Add to cart/i.test(await p.locator('.drop-grid').innerText()));
  }
  await p.goto(base + '/drops'); await p.waitForTimeout(1300);
  const dt = await visText(p);
  ok(`${label} /drops: "The archive" heading appears once`, (dt.match(/The archive/gi) ?? []).length === 1);
  ok(`${label} /drops: no "No caption yet" placeholders`, !/No caption yet/i.test(dt));
  ok(`${label} /drops: no lone grey moon disc`, (await p.locator('.drop-grid .moonrow .moon').count()) === 0);
  // Send a Sunrise
  await p.goto(base + '/gift'); await p.waitForSelector('#gAdd');
  ok(`${label} /gift: the gift card and the Discovery Kit are coming soon and cannot be chosen`, await p.evaluate(() => [...document.querySelectorAll('.fmt-pick button')].filter(b => /gift card|Discovery Kit/i.test(b.textContent)).every(b => b.disabled && /Coming soon/i.test(b.textContent))));
  ok(`${label} /gift: the card names nobody until a name is typed`, !/Maya/i.test(await p.locator('#gCardTo').innerText()));
  await p.fill('#gTo', 'Sam'); ok(`${label} /gift: the card follows the recipient field`, /For Sam/i.test(await p.locator('#gCardTo').innerText()));
  if (label === 'mobile') ok('mobile /gift: the card preview comes before "Add gift to cart"', await p.evaluate(() => document.querySelector('#gCard').getBoundingClientRect().bottom <= document.querySelector('#gAdd').getBoundingClientRect().top));
  // the refill calculator prices from the catalogue: the candle is a real size price, never the old $36
  await p.goto(base + '/subscribe'); await p.waitForTimeout(1500);
  const candleBtn = await p.locator('[data-ci="candle"]').innerText();
  ok(`${label} /subscribe: the candle refill names its size and uses the catalogue price`, /2 oz/.test(candleBtn) && /\$12\.00/.test(candleBtn) && !/\$36/.test(await visText(p)), candleBtn.replace(/\n/g, ' '));
  await p.locator('[data-ci="candle"]').click(); await p.waitForTimeout(200);
  ok(`${label} /subscribe: choosing the candle uses its price in the sum`, /^\$12\.00/.test(await p.locator('#cMath').innerText()), await p.locator('#cMath').innerText());
  // product page: no stock render in the gallery, the refill choice is not on sale
  await p.goto(base + '/product/cabana'); await p.waitForSelector('#addBtn');
  ok(`${label} product: no stand-in renders beside the real photographs`, (await p.locator('.thumbs img.dimg, #mainImg.dimg').count()) === 0);
  ok(`${label} product: the refill option is coming soon and cannot be chosen`, await p.evaluate(() => { const i = document.querySelector('.po input[value="sub"]'); return !!i && i.disabled && /Coming soon/i.test(i.closest('label').textContent) && !/\$/.test(i.closest('label').textContent); }));
  // the journal's sources and disclaimer are readable, and the page ends close to the footer
  await p.goto(base + '/journal/wooden-wick'); await p.waitForSelector('.jr-sources');
  ok(`${label} journal: the sources block is plain text on the page, not on purple`, await p.evaluate(() => { const s = document.querySelector('.jr-sources'); const bg = getComputedStyle(s).backgroundColor; const c = getComputedStyle(s.querySelector('.small')).color.match(/\d+/g).map(Number); return s.tagName !== 'FOOTER' && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') && c.slice(0, 3).every(v => v < 110); }));
  for (const r of ['/explore', '/journal/wooden-wick', '/gift']) {
    await p.goto(base + r); await p.waitForTimeout(1200);
    const gap = await p.evaluate(() => document.querySelector('footer.cel-night').getBoundingClientRect().top - document.getElementById('app').getBoundingClientRect().bottom);
    ok(`${label} ${r}: no tall empty band above the footer`, gap <= 120, `${Math.round(gap)}px`);
  }
  ok(`${label}: the hour's wash fades out instead of ending in a line`, await p.evaluate(() => /gradient/.test(getComputedStyle(document.querySelector('.jwash')).maskImage || getComputedStyle(document.querySelector('.jwash')).webkitMaskImage)));
  ok(`${label}: trust checks raise no JS errors`, errs.length === 0, errs.join('|'));
  await ctx.close();
}
{ // the breathing orb on a phone: smaller, labelled, focusable, out of the way while scrolling down, never left over a button
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  for (const r of ['/shop', '/product/cabana', '/subscribe', '/gift', '/wall', '/coaching']) {
    await p.goto(base + r); await p.waitForTimeout(1300);
    const orb = p.locator('.breathorb');
    const meta = await orb.evaluate(o => ({ w: o.querySelector('.bo-core').getBoundingClientRect().width, label: o.getAttribute('aria-label'), tab: o.tabIndex }));
    ok(`phone ${r}: the orb is small, labelled and focusable`, meta.w <= 46 && /breath/i.test(meta.label ?? '') && meta.tab >= 0, JSON.stringify(meta));
    let hidDown = true, covered = [];
    const H = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    for (let y = 300; y < H; y += 420) {
      const y0 = await p.evaluate(() => scrollY);
      await p.mouse.wheel(0, 420); await p.waitForTimeout(120);
      const y1 = await p.evaluate(() => scrollY);
      // judged only when the page really moved down (the last wheel at the foot of a page scrolls nothing)
      if (y1 > y0 + 40 && y1 > 100 && !(await orb.evaluate(o => o.classList.contains('bo-tucked')))) hidDown = false;
      await p.waitForTimeout(1100); // a pause: it may come back, but never over something pressable
      const c = await orb.evaluate(o => {
        if (o.classList.contains('bo-tucked')) return null;
        const r = o.getBoundingClientRect(), x = r.left + r.width / 2, yy = r.top + r.height / 2;
        const hit = document.elementsFromPoint(x, yy).find(el => !o.contains(el) && el.closest('a[href], button, input, select, textarea, .price, .btn'));
        return hit ? `${hit.tagName}.${hit.className}`.slice(0, 60) : null;
      });
      if (c) covered.push(c);
    }
    ok(`phone ${r}: the orb slips away while scrolling down`, hidDown);
    ok(`phone ${r}: after a pause the orb never sits over a button, link, field or price`, covered.length === 0, covered.join(' | '));
    await p.mouse.wheel(0, -900); await p.waitForTimeout(1300);
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(1300);
    ok(`phone ${r}: back at the top the orb is there to tap`, !(await orb.evaluate(o => o.classList.contains('bo-tucked'))));
  }
  await ctx.close();
}
{ // on the day of a new moon the one drop state says "tonight" everywhere
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/Vancouver' }); const p = await ctx.newPage(); await setupMocks(p);
  await p.clock.setFixedTime(new Date('2026-11-08T12:00:00-08:00')); // the new moon of 9 Nov 2026 07:02 UTC is 8 Nov, 11:02 pm in White Rock
  await p.goto(base + '/drops'); await p.waitForTimeout(1500);
  const s = await p.evaluate(() => ({ date: document.querySelector('[data-drop-date]').textContent, bar: document.getElementById('announceDrop').textContent, cd: document.querySelector('#cd').hidden, btn: document.querySelector('[data-notify="drop"]').textContent }));
  ok('new-moon day: date, bar, countdown and button all say tonight', /Tonight/.test(s.date) && /November 8/.test(s.date) && /tonight/i.test(s.bar) && s.cd && /tonight/i.test(s.btn), JSON.stringify(s));
  await p.clock.setFixedTime(new Date('2026-11-09T12:00:00-08:00'));
  await p.goto(base + '/'); await p.waitForTimeout(1500);
  const n = await p.evaluate(() => document.querySelector('[data-drop-date]').textContent);
  ok('the day after: it moves on to the next new moon (December 8)', /December 8/.test(n), n);
  await ctx.close();
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
