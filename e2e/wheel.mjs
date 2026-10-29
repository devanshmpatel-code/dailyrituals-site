// Find your scent: the route and its two tabs, now the Scent Sky (src/pages/scentsky.ts, tested in depth by e2e/sky.mjs) in
// place of the old scent atlas. Here: the tabs and labels, the "Scent Sky" name across the nav, the shop tile, the help FAQ
// and home; the full list under the sky (every scent on the owner's list, each format live or "Coming soon"); the old
// addresses (/quiz, /build, /sets, ?mood=) still land; nothing names moods, the atlas or the wheel any more.
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
for (const [label, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, timezoneId: 'America/Vancouver' }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/explore'); await p.waitForSelector('.ssky .sf-btn');
  ok(`${label}: the tabs read "Scent Sky" and "Take the quiz"`, (await p.locator('.findtabs [role="tab"]').allInnerTexts()).map(t => t.trim()).join('|') === 'Scent Sky|Take the quiz');
  ok(`${label}: the Scent Sky tab is selected`, (await p.locator('.findtabs [role="tab"][aria-selected="true"]').innerText()).trim() === 'Scent Sky');
  ok(`${label}: no "atlas", "wheel" or "mood" on the page`, !/atlas|scent wheel|\bmoods?\b/i.test(await p.locator('#app').innerText()));
  ok(`${label}: ten families on the sky`, (await p.locator('.sf-btn').count()) === 10);
  const fl = await p.evaluate(() => ({ cards: document.querySelectorAll('.fl-all .fl-card').length, soon: document.querySelectorAll('.fl-all .fl-soon').length, links: [...document.querySelectorAll('.fl-all a')].map(a => a.getAttribute('href')) }));
  ok(`${label}: the full list shows all 28 scents; 25 live formats link to product pages, 33 are "Coming soon"`, fl.cards === 28 && fl.links.length === 25 && fl.soon === 33 && fl.links.every(h => /product\//.test(h)), JSON.stringify({ ...fl, links: fl.links.length }));
  ok(`${label}: no sideways scroll`, (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
  // the quiz tab
  await p.locator('.findtabs [role="tab"]', { hasText: 'Take the quiz' }).click(); await p.waitForSelector('[data-ans]');
  ok(`${label}: the quiz tab opens the quiz`, (await p.locator('.findtabs [role="tab"][aria-selected="true"]').innerText()).trim() === 'Take the quiz');
  // old addresses
  for (const [route, sel] of [['/quiz', '[data-ans]'], ['/build', '.ssky'], ['/sets', '.ssky'], ['/explore?mood=fresh', '.ssf-list'], ['/explore?family=gourmand', '.ssf-list'], ['/explore?scent=lavender-haze', '.ssp-scent']]) {
    await p.goto(base + route);
    ok(`${label}: ${route} still lands`, await p.waitForSelector(sel).then(() => true, () => false));
  }
  ok(`${label}: no page errors`, errs.length === 0, errs.join('; '));
  await ctx.close();
}

// "Scent Sky" everywhere the old name was: nav, the shop tile, the help FAQ
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); await setupMocks(p);
await p.goto(base + '/shop'); await p.waitForSelector('.ways .way');
ok('the shop tile is "Scent Sky"', /Scent Sky/.test(await p.locator('.ways').innerText()) && !/Scent wheel/i.test(await p.locator('.ways').innerText()));
ok('the menu links to the Scent Sky and to every family', await p.evaluate(() => { const t = document.querySelector('header')?.innerHTML ?? document.body.innerHTML; return /Scent Sky/.test(t) && !/Scent atlas/i.test(t) && document.querySelectorAll('a[href*="explore?family="]').length >= 10; }));
await p.goto(base + '/help'); await p.waitForSelector('.help-faq');
ok('the help FAQ names the Scent Sky and scent families', /Scent Sky/.test(await p.locator('.help-faq').textContent()) && /scent family/.test(await p.locator('.help-faq').textContent()) && !/atlas|\bmood\b/i.test(await p.locator('.help-faq').textContent()));
await ctx.close();
await b.close();
const fails = res.filter(x => !x).length; console.log(fails ? `\n${fails} FAIL` : '\nall pass'); process.exit(fails ? 1 : 0);
