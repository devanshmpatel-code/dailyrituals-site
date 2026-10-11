// Path routing (the default build) and launch pages. Run against a normal (not VITE_ROUTING=hash) build.
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const origin = (process.env.BASE ?? 'http://localhost:4173/#').replace(/\/#\/?$/, '');
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(origin + '/'); await p.waitForTimeout(1500);
  const hashLinks = await p.locator('a[href^="#/"]').count();
  ok(`${label}: links are real addresses (no "#/" links left)`, hashLinks === 0, `${hashLinks}`);
  if (label === 'desktop') { await p.locator('.mainnav a[data-nav="shop"]').click(); await p.waitForURL('**/shop'); await p.waitForSelector('.grid .card'); ok('desktop: clicking Shop goes to /shop without a reload', new URL(p.url()).pathname === '/shop'); await p.goBack(); await p.waitForURL(u => new URL(u).pathname === '/'); await p.waitForTimeout(800); ok('desktop: Back returns home', new URL(p.url()).pathname === '/' && (await p.locator('#day').count()) === 1); }
  await p.goto(origin + '/product/roller-citrus-and-sun'); await p.waitForTimeout(1500);
  ok(`${label}: a product address opens directly`, /Citrus/i.test(await p.locator('h1').first().innerText()));
  await p.goto(origin + '/#/coaching'); await p.waitForTimeout(1200);
  ok(`${label}: an old "#/" address is upgraded`, new URL(p.url()).pathname === '/coaching' && !p.url().includes('#'));
  await p.goto(origin + '/shop'); await p.waitForSelector('.toolbar a.chip');
  const chip = await p.locator('.toolbar a.chip').nth(1).getAttribute('href'); ok(`${label}: shop filter links are real addresses`, chip.startsWith('/shop?'), chip);
  for (const [r, h] of [['/privacy', 'Privacy policy'], ['/terms', 'Terms of service'], ['/refund-policy', 'Refund policy'], ['/accessibility', 'Accessibility']]) {
    await p.goto(origin + r); await p.waitForSelector('h1');
    ok(`${label} ${r}: page exists`, (await p.locator('h1').innerText()).includes(h));
    if (r !== '/accessibility') ok(`${label} ${r}: says it is being finalised, outline hidden`, /being finalised/i.test(await p.locator('main').innerText()) && !(await p.locator('.legal-draft').isVisible()));
  }
  ok(`${label}: footer links to the four policies`, (await p.locator('footer .legal a').count()) === 4);
  ok(`${label}: preview build still asks search engines not to index`, (await p.locator('meta[name="robots"]').count()) === 1);
  ok(`${label}: no JS errors`, errs.length === 0, errs.join(' | ').slice(0, 200));
  await ctx.close();
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
