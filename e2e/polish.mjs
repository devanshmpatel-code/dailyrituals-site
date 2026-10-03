import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = 'http://localhost:4173/#';
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
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
