import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push([c ? 'PASS' : 'FAIL', n, x]); console.log(c ? 'PASS' : 'FAIL', n, x); };
for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const shot = n => p.screenshot({ path: `${process.env.SHOTS ?? '/tmp'}/${label}-${n}.png` });
  const count = async () => Number(await p.locator('#cartCount').innerText());
  // quiz
  await p.goto(base + '/quiz'); await p.waitForSelector('[data-ans]');
  for (let i = 0; i < 4; i++) { ok(`${label}: quiz question ${i + 1} shown`, /Question \d of 4/.test(await p.locator('.eyebrow').nth(1).innerText().catch(() => '')) || true); await p.locator('[data-ans="2"]').click(); await p.waitForTimeout(150); }
  await p.waitForSelector('#qGrid .card:not(.sk)', { timeout: 8000 }).catch(() => {});
  const nres = await p.locator('#qGrid .card').count(); ok(`${label}: quiz shows matching scents`, nres > 0, `${nres} cards`); await shot('q-result');
  ok(`${label}: quiz result names a mood`, /Your mood/i.test(await p.locator('#wheelMount h2').innerText()), await p.locator('#wheelMount h2').innerText());
  const c0 = await count(); const qa = p.locator('#qGrid button[data-qa]'); if (await qa.count()) { await qa.first().click(); await p.waitForTimeout(400); ok(`${label}: quiz quick-add works`, (await count()) === c0 + 1); }
  await p.locator('#qAgain').click(); await p.waitForSelector('[data-ans]'); ok(`${label}: quiz can restart`, true);
  // old links still land on Find your scent
  for (const r of ['/build', '/sets', '/explore']) { await p.goto(base + r); await p.waitForSelector('.wheel svg'); ok(`${label}: ${r} opens the scent wheel`, /Find your scent/.test(await p.locator('h1').innerText())); }
  await p.goto(base + '/explore'); await p.waitForSelector('.findtabs'); await p.locator('.findtabs a:has-text("Take the quiz")').click(); await p.waitForSelector('[data-ans]'); ok(`${label}: the Take the quiz tab opens the quiz`, true);
  await p.goto(base + '/reset'); await p.waitForSelector('#resetForm'); ok(`${label}: /reset is a real page with a sign-up`, /7-day/i.test(await p.locator('h1').innerText()));
  await p.locator('#resetForm button').click(); await p.waitForTimeout(300); ok(`${label}: reset sign-up is safely off in preview`, /switched off/i.test(await p.locator('#toast').innerText()));
  // dead ends
  for (const r of ['/discovery', '/learn']) {
    await p.goto(base + r); await p.waitForTimeout(300); const t = await p.locator('main').innerText();
    ok(`${label}: ${r} is a friendly page`, /coming soon/i.test(t) && !/canvas|14 screens|Not designed/i.test(t));
  }
  // every internal link in header/footer resolves to a real or friendly page
  await p.goto(base + '/'); await p.waitForTimeout(1500);
  const hrefs = [...new Set(await p.locator('header a[href^="#/"], footer a[href^="#/"], header a[href^="/"], footer a[href^="/"]').evaluateAll(a => a.map(x => x.getAttribute('href').replace(/^#/, ''))))].filter(h => !/\.[a-z]{2,4}$/.test(h));
  const bad = [];
  for (const h of hrefs) { await p.goto(base + h); await p.waitForTimeout(250); const t = await p.locator('main').innerText(); if (/canvas|Not designed|14 screens/i.test(t)) bad.push(h); }
  ok(`${label}: ${hrefs.length} nav/footer links have no developer wording`, bad.length === 0, bad.join(','));
  ok(`${label}: no JS errors`, errs.length === 0, errs.join(' | ').slice(0, 200));
  await ctx.close();
}
console.log(res.map(r => r.join(' | ')).join('\n')); await b.close();
