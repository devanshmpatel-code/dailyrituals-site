import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
// local time -> expected moment key and name
const cases = [['06:40', 'dawn', 'Dawn'], ['09:15', 'morning', 'Morning'], ['13:10', 'midday', 'Midday'], ['17:50', 'golden', 'Golden hour'], ['22:30', 'night', 'Night'], ['03:00', 'dawn', 'Dawn']];
for (const [hhmm, key, name] of cases) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/Vancouver', locale: 'en-CA' });
  const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  await p.clock.setFixedTime(new Date(`2026-10-03T${hhmm}:00-07:00`));
  await p.goto(base + '/'); await p.waitForSelector('#dClock .mname'); await p.waitForTimeout(600);
  const m = await p.locator('#day').getAttribute('data-m'); const clock = (await p.locator('#dClock').innerText()).replace(/\s+/g, ' ');
  const greet = await p.locator('.greet').innerText();
  ok(`${hhmm}: hero opens on ${name}`, m === key && new RegExp(name, 'i').test(clock), `data-m=${m} clock="${clock}"`);
  const h12 = String(((Number(hhmm.slice(0, 2)) + 11) % 12) + 1) + ':' + hhmm.slice(3);
  ok(`${hhmm}: clock shows the visitor's real time ${h12}`, clock.includes(h12), clock);
  ok(`${hhmm}: greeting agrees`, new RegExp(Number(hhmm.slice(0, 2)) < 12 ? 'Good morning' : Number(hhmm.slice(0, 2)) < 17 ? 'Good afternoon' : 'Good evening').test(greet), greet);
  if (hhmm === '17:50') {
    await p.locator('.moments [data-jump="night"]').click(); await p.waitForTimeout(1800);
    const c2 = (await p.locator('#dClock').innerText()).replace(/\s+/g, ' ');
    ok('after choosing Night the clock shows the moment time', /9:30/.test(c2) && /night/i.test(c2), c2);
    await p.screenshot({ path: `${process.env.SHOTS ?? '/tmp'}/hero-night.png` });
  }
  if (hhmm === '09:15') await p.screenshot({ path: `${process.env.SHOTS ?? '/tmp'}/hero-morning.png` });
  await ctx.close();
}
// cart suggestions
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
await p.goto(base + '/product/cabana-fragrance-roller'); await p.waitForSelector('#app h1'); await p.waitForTimeout(500);
await p.locator('#app button:has-text("Add to cart")').first().click(); await p.waitForTimeout(400);
await p.click('#cartBtn'); await p.waitForSelector('.drawer .li'); await p.waitForTimeout(800);
const sug = await p.locator('.complete .sug').count(); ok('cart suggests another format of the same scent', sug >= 1, `${sug} suggestion(s): ${(await p.locator('.complete .sug b').allInnerTexts()).join(', ')}`);
const before = Number(await p.locator('#cartCount').innerText());
await p.locator('[data-sug]').first().click(); await p.waitForTimeout(800);
ok('adding a suggestion adds it to the cart', Number(await p.locator('#cartCount').innerText()) === before + 1);
ok('the suggestion is no longer offered once in the cart', (await p.locator('.complete [data-sug]').count()) < sug);
await p.screenshot({ path: `${process.env.SHOTS ?? '/tmp'}/cart-complete.png` });
await ctx.close(); await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
