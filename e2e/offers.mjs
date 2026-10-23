// The live combos and discounts panel (src/pages/offers.ts) on the shop, Find your scent and product pages.
// Desktop (1024 and up): the left column. Phones and tablets: a compact bar above the bottom that never covers Add to cart or
// the breathing orb. It updates as the cart changes (an aria-live polite message), shows combos (Ritual Pair), the draft ladder
// (2 items 10%, 3+ items 15%, free shipping over the site's threshold), "Add X more to unlock Y", an Unlocked! moment that
// respects reduced motion, and says plainly that it is an estimate. It never changes a cart total.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const shots = process.env.SHOTS ?? '/tmp/pro-shots/quiz3';
fs.mkdirSync(shots, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const VPS = [[1440, 900], [1024, 768], [768, 1024], [390, 844], [360, 740]];
const num = t => Number(String(t).replace(/[^0-9.]/g, ''));
const msg = p => p.locator('.offers .of-msg').innerText();
const overlap = (a, c) => a && c && a.x < c.x + c.width && a.x + a.width > c.x && a.y < c.y + c.height && a.y + a.height > c.y;
const rect = (p, sel) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }, sel);
// add the first single-choice product's quick add on the shop (the cards' buttons are hidden until hover on a desktop: click in the page)
const quickAdd = (p, n = 0) => p.evaluate(i => document.querySelectorAll('button[data-qa]')[i].click(), n);
const ladder = p => p.evaluate(() => [...document.querySelectorAll('.offers .of-tier')].map(t => t.classList.contains('on')));

for (const [w, h] of VPS) {
  const mobile = w < 1024, tag = `${w}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, timezoneId: 'America/Vancouver' });
  const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/shop'); await p.waitForSelector('.offers'); await p.waitForSelector('button[data-qa]'); await p.waitForTimeout(500);
  const threshold = num(await p.locator('.offers .of-tier[data-tier="2"] .of-tx b').innerText());
  ok(`${tag}: the panel is on the shop, labelled for assistive tech`, (await p.locator('aside.offers[aria-label="Combos and discounts"]').count()) === 1);
  ok(`${tag}: updates are announced politely (aria-live polite status)`, (await p.locator('.offers .of-live[aria-live="polite"][role="status"]').count()) === 1);
  ok(`${tag}: an empty cart says what unlocks the first saving`, /Add 2 items to unlock 10% off/.test(await msg(p)), await msg(p));
  if (!mobile) {
    const pr = await rect(p, '.offers'), gr = await rect(p, '.grid.grouped, .toolbar');
    ok(`${tag}: desktop: the panel is the left column, beside the shop`, pr.x < gr.x && pr.x + pr.width <= gr.x && pr.width >= 200 && (await p.evaluate(() => getComputedStyle(document.querySelector('.offers')).position)) === 'sticky', `${Math.round(pr.x)}+${Math.round(pr.width)} | ${Math.round(gr.x)}`);
  } else {
    ok(`${tag}: phone/tablet: a fixed bar inside the viewport, near the bottom`, await p.evaluate(() => { const e = document.querySelector('.offers'), s = getComputedStyle(e), r = e.getBoundingClientRect(); return s.position === 'fixed' && r.bottom <= innerHeight && r.bottom >= innerHeight - 40 && r.left >= 0 && r.right <= innerWidth && r.height <= 80; }));
    const orb = await rect(p, '.breathorb'), bar = await rect(p, '.offers');
    ok(`${tag}: the bar never covers the breathing orb`, !overlap(orb, bar), JSON.stringify([orb, bar]));
    const tg = await rect(p, '.of-toggle');
    ok(`${tag}: the details button is at least 44px`, tg.width >= 43.5 && tg.height >= 43.5);
  }
  ok(`${tag}: no sideways scroll`, (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
  await p.screenshot({ path: `${shots}/${tag}-offers-empty.png` });

  // ---- live: add, add, add ----
  await quickAdd(p, 0); await p.waitForTimeout(250);
  const m1 = await msg(p);
  ok(`${tag}: one item: "Add 1 more item to unlock 10% off"`, /Add 1 more item to unlock 10% off/.test(m1), m1);
  ok(`${tag}: spend shows the cart total`, /\$\d+\.\d\d · 1 item/.test(await p.locator('.offers .of-money').innerText()) || !mobile);
  await quickAdd(p, 1); await p.waitForTimeout(300);
  const m2 = await msg(p);
  ok(`${tag}: two items unlock 10% off, announced "Unlocked!", and the next step is named`, /^Unlocked! 10% off is yours\. Add 1 more item to unlock 15% off\./.test(m2), m2);
  ok(`${tag}: the 10% rung lights, the others do not`, JSON.stringify(await ladder(p)) === '[true,false,false]');
  ok(`${tag}: the unlock plays its moment (the ring and tick animate)`, await p.evaluate(() => { const d = document.querySelector('.offers .of-tier.just .of-dot'); return !!d && getComputedStyle(d).animationName !== 'none'; }));
  ok(`${tag}: ...with an "Unlocked!" badge`, (await p.locator('.offers .of-tier.just .of-yay').count()) === 1);
  const cartTotal = async () => { await p.click('#cartBtn'); await p.waitForTimeout(600); const sub = num(await p.locator('.df .row b').first().innerText()), co = await p.locator('#checkoutBtn').innerText(), dmax = await p.locator('.drawer [role="meter"]').first().getAttribute('aria-valuemax'); return { sub, co, dmax }; };
  const c2 = await cartTotal();
  const lines = await p.evaluate(() => JSON.parse(localStorage.getItem('dr_cart')).reduce((n, l) => n + l.qty * l.price, 0));
  ok(`${tag}: the cart total is untouched: full price, no discount applied`, Math.abs(c2.sub - lines) < 0.005 && num(c2.co) === c2.sub, `${c2.sub} vs ${lines}`);
  ok(`${tag}: the ship threshold is the site's own ($${threshold} in the cart drawer too)`, num(c2.dmax) === threshold, `${c2.dmax} vs ${threshold}`);
  // take one away through the drawer: the savings lock again
  await p.locator('[data-dec]').first().click(); await p.waitForTimeout(250);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(`${tag}: removing an item locks the saving again, live`, JSON.stringify(await ladder(p)) === '[false,false,false]' && /Add 1 more item to unlock 10% off/.test(await msg(p)), await msg(p));
  await quickAdd(p, 0); await quickAdd(p, 2); await p.waitForTimeout(300);
  ok(`${tag}: three items unlock 15% off`, JSON.stringify((await ladder(p)).slice(0, 2)) === '[true,true]' && /15% off is yours/.test(await msg(p)), await msg(p));
  const spend = num((await p.locator('.offers .of-money').innerText().catch(() => '')) || '0');
  // push past free shipping with more rollers (each $25)
  for (let i = 0; i < 6 && !(await ladder(p))[2]; i++) { await quickAdd(p, 3 + i); await p.waitForTimeout(200); }
  const done = await ladder(p);
  ok(`${tag}: reaching the threshold unlocks free shipping in Canada`, done[2] === true && /All unlocked: 15% off and free shipping in Canada/.test(await msg(p)), await msg(p));
  ok(`${tag}: the estimate is labelled, never a promise`, await p.evaluate(() => { const t = document.querySelector('.offers').textContent; return /Estimate/i.test(t) && /Discounts apply at checkout once live/.test(t) && /Estimated savings/.test(t) && /Estimated total/.test(t); }));
  void spend;
  await p.waitForTimeout(2800);
  await p.screenshot({ path: `${shots}/${tag}-offers-full.png` });

  // ---- details (phones) by keyboard; the bar steps aside for Add to cart ----
  if (mobile) {
    await p.locator('.of-toggle').focus(); await p.keyboard.press('Enter');
    ok(`${tag}: the details button opens the ladder from the keyboard`, (await p.locator('.of-toggle').getAttribute('aria-expanded')) === 'true' && await p.locator('.of-details').isVisible());
    const open = await rect(p, '.offers'), orb = await rect(p, '.breathorb');
    ok(`${tag}: opened, it still stays clear of the orb and inside the screen`, !overlap(open, orb) && open.y >= 0 && open.x >= 0, JSON.stringify(open));
    await p.screenshot({ path: `${shots}/${tag}-offers-open.png` });
    await p.keyboard.press('Escape');
    ok(`${tag}: Escape closes it`, (await p.locator('.of-toggle').getAttribute('aria-expanded')) === 'false');
  } else {
    ok(`${tag}: desktop: the whole ladder is visible without opening anything`, await p.locator('.offers .of-ladder').isVisible() && (await p.locator('.offers .of-tier').count()) === 3);
  }

  // ---- the product page: a Ritual Pair, and the bar never over Add to cart ----
  await p.evaluate(() => localStorage.setItem('dr_cart', '[]')); await p.reload(); await p.waitForTimeout(500);
  await p.goto(base + '/product/cabana'); await p.waitForSelector('#addBtn'); await p.waitForSelector('.offers'); await p.waitForTimeout(500);
  await p.evaluate(() => document.querySelector('#addBtn').click()); await p.waitForTimeout(300);
  await p.goto(base + '/product/cabana-fragrance-roller'); await p.waitForSelector('#addBtn'); await p.waitForSelector('.offers'); await p.waitForTimeout(400);
  await p.waitForSelector('.offers .of-nudge', { state: 'attached' }).catch(() => {}); ok(`${tag}: one candle in the cart: the panel offers its roller to make a Ritual Pair`, (await p.locator('.offers .of-nudge a[href$="/product/cabana-fragrance-roller"]').count()) === 1);
  await p.evaluate(() => document.querySelector('#addBtn').click()); await p.waitForTimeout(400);
  if (!mobile) await p.waitForSelector('.offers .of-combo');
  const combos = await p.evaluate(() => [...document.querySelectorAll('.offers .of-combo')].map(x => x.textContent.trim()));
  ok(`${tag}: a candle and a roller of the same scent form a Ritual Pair, live`, combos.length === 1 && /Ritual Pair/.test(combos[0]) && /Cabana/.test(combos[0]) && /candle \+ roller/.test(combos[0]), combos.join('|'));
  if (mobile) {
    let bad = 0, hidden = 0;
    for (let y = 0; y <= 2600; y += 120) {
      await p.evaluate(v => scrollTo(0, v), y); await p.waitForTimeout(160);
      const st = await p.evaluate(() => {
        const bar = document.querySelector('.offers'), away = bar.classList.contains('of-away'), r = bar.getBoundingClientRect();
        const hit = [...document.querySelectorAll('#addBtn, .lnav button')].some(x => { const q = x.getBoundingClientRect(); return q.width && q.bottom > r.top && q.top < r.bottom && q.right > r.left && q.left < r.right; });
        return { away, hit };
      });
      if (st.hit && !st.away) bad++; if (st.away) hidden++;
    }
    ok(`${tag}: scrolling the product page, the bar is never over Add to cart (it steps aside)`, bad === 0, `${bad} overlaps, away for ${hidden} steps`);
  } else {
    await p.evaluate(() => scrollTo(0, 600)); await p.waitForTimeout(200);
    const pr = await rect(p, '.offers');
    ok(`${tag}: desktop product: the panel follows down the left and stays on screen`, pr.y >= 0 && pr.y < 200 && pr.x < 100 + 20, JSON.stringify(pr));
  }
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200);
  await p.screenshot({ path: `${shots}/${tag}-offers-product.png` });

  // ---- Find your scent ----
  await p.goto(base + '/explore?tab=quiz'); await p.waitForSelector('.offers'); await p.waitForTimeout(500);
  ok(`${tag}: the panel is on Find your scent too`, (await p.locator('.offers').count()) === 1 && (await p.locator('.offers .of-tier').count()) === 3);
  await p.screenshot({ path: `${shots}/${tag}-offers-explore.png` });
  ok(`${tag}: it does not stack up across pages (one panel)`, (await p.locator('.offers').count()) === 1);
  await p.goto(base + '/about').catch(() => {}); await p.waitForTimeout(400);
  ok(`${tag}: and it leaves with the page`, (await p.locator('.offers').count()) === 0);
  ok(`${tag}: no page errors`, errs.length === 0, errs.join('; '));
  await ctx.close();
}

// ---- reduced motion: the unlock still shows, without the animation ----
{
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  await p.goto(base + '/shop'); await p.waitForSelector('.offers'); await p.waitForSelector('button[data-qa]'); await p.waitForTimeout(400);
  await quickAdd(p, 0); await quickAdd(p, 1); await p.waitForTimeout(300);
  ok('reduced motion: the unlock is shown and announced, with no animation', /^Unlocked!/.test(await msg(p)) && await p.evaluate(() => { const d = document.querySelector('.offers .of-tier.just .of-dot'); return !!d && getComputedStyle(d).animationName === 'none' && getComputedStyle(document.querySelector('.offers .of-tier.just')).animationName === 'none'; }));
  await ctx.close();
}
await b.close();
const fails = res.filter(x => !x).length; console.log(fails ? `\n${fails} FAIL` : '\nall pass'); process.exit(fails ? 1 : 0);
