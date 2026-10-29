import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
// the home page is long: on a busy machine the next page can take a moment to replace it, so wait until it has
const settleRoute = (p, r) => p.waitForFunction(home => home ? !!document.querySelector('.ritflow') : !document.querySelector('.ritflow'), r === '/', { timeout: 10000 }).catch(() => {});
const visText = p => p.evaluate(() => document.querySelector('main, #app')?.innerText ?? document.body.innerText);
for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  // no points or referral promises anywhere a customer can see while the Loyalty app is not set up, except the planned club
  // itself (the Ritualists chapter on home and the club page), which the owner approved showing as "coming soon" drafts
  for (const r of ['/', '/shop', '/product/roller-citrus-and-sun', '/club', '/wall', '/subscribe', '/order-confirmed', '/drops', '/account']) {
    await p.goto(base + r); await settleRoute(p, r); await p.waitForTimeout(1300);
    if (r === '/' || r === '/club') ok(`${label} ${r}: the planned club is marked coming soon, its points and perks drafts`, await p.evaluate(() => { const s = document.querySelector('.ritflow, .clubplan'); return !!s && /coming soon/i.test(s.innerText) && [...s.querySelectorAll('.tier li, .rt-value')].every(e => e.querySelector('.d')); }));
    const t = (await p.evaluate(() => { const club = [...document.querySelectorAll('.ritflow, .clubplan')]; club.forEach(e => { e.style.display = 'none'; }); const t = (document.querySelector('main, #app') ?? document.body).innerText; club.forEach(e => { e.style.display = ''; }); return t; })).replace(/pulse points/gi, '');
    ok(`${label} ${r}: no points or referral promises`, !/\bpoints?\b|\bpts\b|Give \$10/i.test(t), (t.match(/.{0,40}(\bpoints?\b|\bpts\b|Give \$10).{0,20}/i) || [''])[0]);
  }
  await p.goto(base + '/'); await p.waitForTimeout(800);
  ok(`${label}: no "Watch the day" button`, (await p.locator('#dayPlay').count()) === 0);
  await p.goto(base + '/shop'); await p.waitForSelector('.ghead');
  ok(`${label}: shop names each card's scent families, then the scents coming soon and the kits`, (await p.locator('.grid.grouped .ghead.soon').count()) >= 2 && (await p.locator('.grid .scard:not([data-soon]) .card-fams').count()) >= 10);
  ok(`${label}: "Kits and boxes" is marked coming soon`, /Coming soon/i.test(await p.locator('.ghead.soon').last().innerText()));
  if (label === 'mobile') ok('mobile: shop filters are one swipeable row', await p.evaluate(() => { const c = document.querySelector('.toolbar .chips'); return getComputedStyle(c).flexWrap === 'nowrap' && /auto|scroll/.test(getComputedStyle(c).overflowX); }));
  await p.goto(base + '/club'); await p.waitForSelector('.clubsoon');
  ok(`${label}: Ritualists page says opening soon`, /opening soon/i.test(await p.locator('.clubsoon').innerText()));
  ok(`${label}: planned club details are drafts only`, !(await p.locator('.club-plan').isVisible()));
  await p.goto(base + '/drops'); await p.waitForTimeout(1200);
  ok(`${label}: Moon Drops no longer says "available now"`, !/available now/i.test(await visText(p)));
  await p.goto(base + '/story'); await p.waitForSelector('.st-steps');
  ok(`${label}: story has the four beats and the quote`, (await p.locator('.st-steps li').count()) === 4 && (await p.locator('.st-quote blockquote').count()) === 1);
  ok(`${label}: the story page is "Meet the maker", headed "My story", in Claire's own words (drafts)`, /^My story$/i.test((await p.locator('#app h1').innerText()).trim()) && /Meet the maker/i.test(await p.locator('.st-tx > .eyebrow').innerText()) && await p.evaluate(() => [...document.querySelectorAll('.st-steps li p')].every(x => x.querySelector('.d') && /\b(I|my)\b/.test(x.textContent))) && /Meet the maker/.test(await p.title()));
  ok(`${label}: no "Our story" left in the header, menu or footer`, await p.evaluate(() => !/our story/i.test([...document.querySelectorAll('header, footer, #mobileMenu')].map(e => e.textContent).join(' ')) && [...document.querySelectorAll('footer a[href$="/story"]')].every(a => a.textContent.trim() === 'Meet the maker')));
  await p.goto(base + '/explore'); await p.waitForSelector('.fl-card');
  ok(`${label}: the full scent list shows every scent on the owner's list`, (await p.locator('.fl-all .fl-card').count()) === 28);
  for (const r of ['/', '/shop', '/club', '/story', '/explore', '/subscribe']) { await p.goto(base + r); await p.waitForTimeout(900); const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(`${label} ${r}: no sideways scroll`, o <= 1, `${o}`); }
  await ctx.close();
}
{ // drafts toggle shows the planned club for Claire
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); await setupMocks(p);
  await p.goto(base + '/club'); await p.waitForSelector('.clubsoon'); await p.evaluate(() => document.body.classList.add('show-drafts'));
  ok('drafts on: the planned club shows for Claire', await p.locator('.club-plan').isVisible()); await ctx.close();
}
{ // the club page shows the approved tiers, the points value and the waitlist (email and birthday month and day), as drafts
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p = await ctx.newPage(); await setupMocks(p);
  await p.goto(base + '/club'); await p.waitForSelector('.clubplan .rt-form');
  const c = await p.evaluate(() => { const s = document.querySelector('.clubplan'); const f = s.querySelector('.rt-form');
    return { t: s.innerText, tiers: [...s.querySelectorAll('.tier .tname')].map(e => e.textContent).join(','), email: !!f.querySelector('#csEmail[type=email]'), m: f.querySelector('select[name=month]').options.length, d: f.querySelector('select[name=day]').options.length,
      year: !!f.querySelector('[name=year], input[type=date]'), drafts: [...s.querySelectorAll('.tier li')].every(li => li.querySelector('.d')), h1: document.querySelectorAll('main h1, #app h1').length, sw: document.documentElement.scrollWidth - innerWidth }; });
  ok('club page: three tiers with the approved perks, 100 points = $5 off, coming soon, no free shipping', c.tiers === 'Dawn,Golden Hour,Midnight' && /100 points = \$5 off/.test(c.t) && /coming soon/i.test(c.t) && /300 points a year/.test(c.t) && /Early access to every Moon Drop/.test(c.t) && !/free shipping/i.test(c.t) && c.drafts, c.t.slice(0, 160));
  ok('club page: the waitlist asks for an email and a birthday month and day (no year), and says why', c.email && c.m === 13 && c.d === 32 && !c.year && /We'll only use your birthday to send your Solar Return gift\./.test(c.t) && /Give \$10, get \$10/.test(c.t) && c.sw <= 1, JSON.stringify({ ...c, t: undefined }));
  await p.locator('.cs-go').click(); await p.waitForTimeout(700);
  ok('club page: "Join the waitlist" takes you to the email field', await p.evaluate(() => document.activeElement?.id === 'csEmail'));
  await p.fill('#csEmail', 'test@example.com'); await p.click('.clubplan .rt-join'); await p.waitForTimeout(400);
  ok('club page: the waitlist is switched off in the preview (nothing is sent)', /switched off/i.test(await p.evaluate(() => document.getElementById('toast')?.textContent ?? '')) && /\/club$/.test(p.url()));
  await ctx.close();
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
  // (the studio photographs on the wall are switched off with From the studio, owner, October 2026: STUDIO_ON in src/moons.ts)
  ok(`${label} /wall: the studio tiles are switched off`, (await p.locator('.wall-studio, .studio-tile').count()) === 0);
  // the home page has no Ritual Wall line or photo teaser in the owner's new order
  await p.goto(base + '/'); await p.waitForTimeout(1500);
  ok(`${label} home: the wall is not presented as proof`, !/Ritualists use|proof/i.test(await visText(p)));
  ok(`${label} home: no photo teaser of the wall`, (await p.locator('main .wall img').count()) === 0);
  ok(`${label} home: chapter pictures are real studio photographs, not stock mockups`, await p.evaluate(() => [...document.querySelectorAll('.cf-ph img, .plans img, .disc .ph img')].every(i => (i.getAttribute('src') ?? '').startsWith('/img/studio/'))));
  // concepts: no price, no value maths, labelled coming soon, notify only
  for (const r of ['/', '/shop', '/subscribe', '/gift', '/explore', '/drops']) {
    await p.goto(base + r); await settleRoute(p, r); await p.waitForTimeout(1300);
    // (home: the owner approved the draft Solstice Box price, "$79 a box ($88 value)", in the compact Ritual on Repeat chapter)
    const t = r === '/' ? await p.evaluate(() => { const d = [...document.querySelectorAll('.repeatflow .plan .d')]; d.forEach(e => { e.style.display = 'none'; }); const t = document.querySelector('main').innerText; d.forEach(e => { e.style.display = ''; }); return t; }) : await visText(p);
    if (r === '/') ok(`${label} /: the Solstice Box shows the approved draft price ($79, $88 value) as a draft only`, await p.evaluate(() => [...document.querySelectorAll('.repeatflow .plan .d')].some(e => /\$79 a box \(\$88 value\)/.test(e.textContent))));
    ok(`${label} ${r}: no price or "value" on a concept (Discovery Kit, Moon Drop, Solstice Box, gift card)`, !CONCEPT_PRICE.test(t), (t.match(/.{0,40}(\$(18|28|79|88)|\bvalue\b).{0,20}/i) || [''])[0]);
    ok(`${label} ${r}: no add-to-cart for a concept`, (await p.locator('[data-add="discovery-kit"], [data-add="moon-drop-01"], [data-add="solstice-box"], [data-gr="giftcard"], [data-gr="discovery-kit"]').count()) === 0);
    // the gift sets have no contents or prices from the shop yet, so they are coming soon, never priced or selectable
    if (r === '/gift') ok(`${label} ${r}: the gift sets show no invented price and cannot be chosen`, (await p.locator('[data-gr^="set-"]').count()) === 0 && (await p.locator('[data-gr-soon^="set-"][disabled]').count()) === 3 && !/\$(34|36|46)\.00/.test(await p.locator('main, #app').first().innerText()));
  }
  await p.goto(base + '/shop'); await p.waitForSelector('[data-concept]');
  ok(`${label} /shop: every concept card says Coming soon and offers only "get notified"`, await p.evaluate(() => [...document.querySelectorAll('[data-concept]')].every(c => /Coming soon/i.test(c.textContent) && !/\$\d/.test(c.textContent) && !!c.querySelector('[data-notify]'))) && (await p.locator('[data-concept]').count()) === 3);
  ok(`${label} /shop: touch screens are told to tap`, label === 'desktop' || /Tap a product/.test(await visText(p)));
  // the drop date: the next seasonal new moon (once a season), in the future, one state everywhere
  for (const r of ['/', '/drops']) {
    await p.goto(base + r); await settleRoute(p, r); await p.waitForTimeout(1300);
    const d = await p.evaluate(() => ({ date: document.querySelector('[data-drop-date]')?.textContent ?? '', bar: document.getElementById('announceDrop')?.textContent ?? '', days: Number(document.querySelector('#cd b')?.textContent ?? -1), hidden: document.querySelector('#cd')?.hidden, btn: document.querySelector('[data-notify="drop"]')?.textContent ?? '' }));
    const y = new Date().getFullYear(), today = new Date(); today.setHours(0, 0, 0, 0);
    const when = [y, y + 1].map(yy => new Date(`${d.date.replace(/^Tonight · /, '').replace(/^\w+, /, '')} ${yy}`)).find(x => !isNaN(x) && x >= today);
    ok(`${label} ${r}: the drop date is the next seasonal drop, not a date that has passed`, !!when && (when - today) / 864e5 <= 120 && !/October 1[01]/.test(d.date), d.date);
    // (home: Moon Drops is its own chapter with the date and no countdown; /drops keeps the countdown)
    if (r === '/') ok(`${label} /: the chapter's date and the bar tell the same story, and the drop cannot be bought`, (d.bar.includes(d.date.replace(/^Tonight · /, '')) || /tonight/i.test(d.bar)) && !/\$28|Add to cart/i.test(await p.locator('.dropflow').innerText()), JSON.stringify(d));
    else {
      ok(`${label} ${r}: date, countdown, bar and button tell the same story`, d.bar.includes(d.date.replace(/^Tonight · /, '')) || /tonight/i.test(d.bar) ? (d.hidden || d.days >= 0) && /get notified/i.test(d.btn) : false, JSON.stringify(d));
      ok(`${label} ${r}: the drop shows no price and cannot be bought`, !/\$28|Add to cart/i.test(await p.locator('.drop-grid').innerText()));
    }
  }
  await p.goto(base + '/drops'); await p.waitForTimeout(1300);
  const dt = await visText(p);
  ok(`${label} /drops: "The archive" heading appears once`, (dt.match(/The archive/gi) ?? []).length === 1);
  ok(`${label} /drops: no "No caption yet" placeholders`, !/No caption yet/i.test(dt));
  ok(`${label} /drops: no lone grey moon disc`, (await p.locator('.drop-grid .moonrow .moon').count()) === 0);
  // Send a Sky
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
  for (const r of ['/shop', '/product/cabana', '/subscribe', '/gift', '/wall', '/coaching', '/book', '/reset']) {
    await p.goto(base + r); await settleRoute(p, r); await p.waitForTimeout(1300);
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
        if (hit) return `${hit.tagName}.${hit.className}`.slice(0, 60);
        // nor over words: no letter of the page drawn under its middle
        o.style.pointerEvents = 'none'; const cr = document.caretRangeFromPoint(x, yy); o.style.pointerEvents = '';
        const n = cr?.startContainer;
        if (n?.nodeType === 3 && n.textContent.trim() && !o.contains(n)) { const g = document.createRange(); g.setStart(n, Math.max(0, cr.startOffset - 1)); g.setEnd(n, Math.min(n.length, cr.startOffset + 1));
          if ([...g.getClientRects()].some(q => x >= q.left && x <= q.right && yy >= q.top && yy <= q.bottom)) return `words "${n.textContent.trim().slice(0, 30)}"`; }
        return null;
      });
      if (c) covered.push(c);
    }
    ok(`phone ${r}: the orb slips away while scrolling down`, hidDown);
    ok(`phone ${r}: after a pause the orb never sits over a button, link, field, price or words`, covered.length === 0, covered.join(' | '));
    await p.mouse.wheel(0, -900); await p.waitForTimeout(1300);
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(1300);
    // at the top it is out only where its spot is clear (the opening's words and buttons come first); focus always brings it out
    const top = await orb.evaluate(o => o.classList.contains('bo-tucked') ? 'aside' : 'out');
    await orb.focus(); await p.waitForTimeout(500);
    ok(`phone ${r}: back at the top the orb is out or aside (${top}), and focus brings it out to tap`, await orb.evaluate(o => getComputedStyle(o).opacity === '1' && getComputedStyle(o).pointerEvents !== 'none' && !o.classList.contains('bo-tucked')));
    await orb.evaluate(o => o.blur());
  }
  await ctx.close();
}
{ // Moon Drops come once a season: the first new moon on or after each equinox and solstice (Meeus), one state everywhere
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/Vancouver' }); const p = await ctx.newPage(); await setupMocks(p);
  await p.clock.setFixedTime(new Date('2026-10-19T12:00:00-07:00'));
  await p.goto(base + '/'); await p.waitForTimeout(1500);
  const a = await p.evaluate(() => ({ date: document.querySelector('.dropflow [data-drop-date]').textContent, season: document.querySelector('.dropflow [data-drop-season]').textContent, bar: document.getElementById('announceDrop').textContent }));
  // the December 2026 solstice is 21 Dec 20:50 UTC; the next new moon is 7 Jan 2027 20:24 UTC (12:24 pm in White Rock)
  ok('seasonal drop: from 19 October 2026 the next drop is the winter one, Thursday, January 7 (not the November new moon)', a.date === 'Thursday, January 7' && a.season === 'winter' && /once a season/.test(a.bar) && /January 7/.test(a.bar), JSON.stringify(a));
  await p.clock.setFixedTime(new Date('2027-01-07T09:00:00-08:00'));
  await p.goto(base + '/drops'); await p.waitForTimeout(1500);
  const s = await p.evaluate(() => ({ date: document.querySelector('[data-drop-date]').textContent, bar: document.getElementById('announceDrop').textContent, cd: document.querySelector('#cd').hidden, btn: document.querySelector('[data-notify="drop"]').textContent }));
  ok('drop day: date, bar, countdown and button all say tonight', /Tonight/.test(s.date) && /January 7/.test(s.date) && /tonight/i.test(s.bar) && s.cd && /tonight/i.test(s.btn), JSON.stringify(s));
  await p.clock.setFixedTime(new Date('2027-01-08T12:00:00-08:00'));
  await p.goto(base + '/'); await p.waitForTimeout(1500);
  const n = await p.evaluate(() => document.querySelector('[data-drop-date]').textContent);
  ok('the day after: it moves on to the spring drop (the March 2027 equinox, then the new moon of April 6), skipping the new moons between', /April 6/.test(n), n);
  await ctx.close();
}
// Send a Sky: the card is the sky, the note and the names only. The owner had the candle photograph taken off the card
// (October 2026) on every sky, on /gift and on home; the candle being sent shows under the card once one is chosen.
const inside = (a, c) => a.left >= c.left - 1 && a.right <= c.right + 1 && a.top >= c.top - 1 && a.bottom <= c.bottom + 1;
for (const [w, reduce] of [[1440], [1024], [768], [390], [360], [390, true]]) {
  const label = `${w}px${reduce ? ' reduced motion' : ''}`, phone = w < 500;
  const ctx = await b.newContext({ viewport: { width: w, height: phone ? 844 : 900 }, hasTouch: phone, isMobile: phone, reducedMotion: reduce ? 'reduce' : 'no-preference' }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/gift'); await p.waitForSelector('#gCard .gc-sky');
  const state = () => p.evaluate(() => {
    const card = document.querySelector('#gCard'), cr = card.getBoundingClientRect();
    const rng = document.createRange(); rng.selectNodeContents(card.querySelector('#gCardNote'));
    return { t: card.dataset.t, imgs: card.querySelectorAll('img').length, candle: card.querySelectorAll('.gc-candle, .gc-tin, .gc-flame').length, card: cr.toJSON(),
      note: [...rng.getClientRects()].map(r => r.toJSON()), to: card.querySelector('#gCardTo').getBoundingClientRect().toJSON(),
      bg: getComputedStyle(card.querySelector('.gc-sky i[data-layer="' + card.dataset.t + '"]')).backgroundImage, op: Number(getComputedStyle(card.querySelector('.gc-sky i[data-layer="' + card.dataset.t + '"]')).opacity),
      cap: !!document.querySelector('#gCandleCap'), text: card.parentElement.innerText, dur: getComputedStyle(card.querySelector('.gc-sky i')).transitionDuration };
  });
  for (const sky of ['dawn', 'golden', 'night']) {
    await p.locator(`button[data-sky="${sky}"]`).click(); await p.waitForTimeout(reduce ? 150 : 1200);
    const s = await state();
    ok(`${label} /gift ${sky}: no candle photograph on the card, only the sky, the note and the names`, s.t === sky && s.imgs === 0 && s.candle === 0 && s.op > .99, JSON.stringify({ imgs: s.imgs, candle: s.candle, op: s.op }));
    ok(`${label} /gift ${sky}: no line about a candle on the card under it`, !s.cap && !/on the card: a candle|no candle on the card|quiet sky before sunrise/i.test(s.text), s.text.slice(0, 200));
    ok(`${label} /gift ${sky}: the note and the recipient line sit inside the card`, s.note.length > 0 && s.note.every(r => inside(r, s.card)) && inside(s.to, s.card));
    if (sky === 'dawn') ok(`${label} /gift dawn: the sky is cool (lilac, blush, light blue), not amber`, /205, 184, 230/.test(s.bg) && /179, 217, 243/.test(s.bg) && !/242, 169, 126|224, 142, 90/.test(s.bg), s.bg);
  }
  if (reduce) ok(`${label} /gift: with reduced motion the sky simply swaps`, /^0s(, 0s)*$/.test((await state()).dur), (await state()).dur);
  else {
    await p.fill('#gNote', 'Happy birthday to my favourite person. Light this tonight, put your feet up and take a quiet moment that is all yours.'.slice(0, 140));
    await p.fill('#gTo', 'Alexandra Montgomery-Fitzwilliam'); await p.waitForTimeout(300);
    const l = await state();
    ok(`${label} /gift: a long note and a long name still fit inside the card`, l.note.every(r => inside(r, l.card)) && inside(l.to, l.card), JSON.stringify({ to: l.to, card: l.card }));
  }
  // the candle being bought (not the card) still shows under the card once one is chosen
  const pick = p.locator('#gPick .gp-c').first();
  if (await pick.count()) {
    await pick.click(); await p.waitForTimeout(300);
    const sum = await p.evaluate(() => { const g = document.querySelector('#gSum'), c = document.querySelector('#gCard'); return { shown: !!g && !g.hidden, after: !!g && c.nextElementSibling === g, name: document.querySelector('#gSumName')?.textContent.trim() }; });
    ok(`${label} /gift: the chosen candle shows under the card ("In the box")`, sum.shown && sum.after && !!sum.name, JSON.stringify(sum));
  }
  ok(`${label} /gift: no sideways scroll`, (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
  ok(`${label} /gift: no JS errors`, errs.length === 0, errs.join(' | '));
  await ctx.close();
}
{ // home: the Send a Sky card has no candle, and no candle tin photograph sits beside it, on any sky
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); await setupMocks(p);
  await p.goto(base + '/'); await p.waitForTimeout(1200);
  for (const sky of ['dawn', 'golden', 'night']) {
    const btn = p.locator(`.giftsec button[data-sky="${sky}"]`).first();
    if (await btn.count()) { await btn.scrollIntoViewIfNeeded(); await btn.click(); await p.waitForTimeout(300); }
    ok(`home ${sky}: the Send a Sky card has no candle, and no tin photograph beside it`, await p.evaluate(() => !!document.querySelector('#gCard') && !document.querySelector('#gCard img, #gCard .gc-candle, .gift-grid .ph-gift, .gift-grid .studio-cut, .gift-grid figure')));
  }
  await ctx.close();
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
