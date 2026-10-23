// The hero offers both things the business sells: the scent ritual (two products as one) and the practice (coaching).
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const origin = (process.env.BASE ?? 'http://localhost:4173/#').replace(/\/#\/?$/, '');
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
// choose a moment and wait until the hero has switched to it (the sun glides there first; slower on a busy machine)
const pick = (p, k) => p.evaluate(k => { document.querySelector(`.moments [data-jump="${k}"]`).click(); }, k)
  .then(() => p.waitForFunction(k => document.querySelector('.dayhero')?.dataset.m === k, k, { timeout: 20000 })).then(() => p.waitForTimeout(400));
const money = s => Number((s.match(/\$(\d+\.\d{2})/) || [])[1]);
for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(origin + '/'); await p.waitForSelector('#dProducts .sp-ritual'); await p.waitForTimeout(600);
  ok(`${label}: the hero shows exactly two offers, a ritual and a practice`, (await p.locator('#dProducts .sp').count()) === 2 && (await p.locator('#dProducts .sp-ritual').count()) === 1 && (await p.locator('#dProducts .sp-coach').count()) === 1);
  // (the free 7-day reset is gone: owner, October 2026; every moment offers the free 20-minute discovery call)
  const expect = { dawn: '/book', morning: '/book', midday: '/book', golden: '/book', night: '/book' };
  // the mood of each ritual's lead scent (night leads with Campfire Stories, which is woody)
  const MOOD = { dawn: 'fresh', morning: 'sunny', midday: 'grounding', golden: 'woody', night: 'woody' };
  for (const k of Object.keys(expect)) {
    await pick(p, k);
    const rit = p.locator('#dProducts .sp-ritual');
    ok(`${label} ${k}: the ritual shows both products`, (await rit.locator('.sp-thumbs img').count()) === 2 && / \+ |two ways/.test(await rit.locator('b').innerText()), await rit.locator('b').innerText());
    const chipTotal = money(await rit.locator('em').innerText()), ctaTotal = money(await p.locator('#dCta [data-addmoment]').innerText());
    ok(`${label} ${k}: the ritual price matches the Add button`, chipTotal > 0 && chipTotal === ctaTotal, `${chipTotal} vs ${ctaTotal}`);
    ok(`${label} ${k}: the ritual links to the mood of its lead scent`, (await rit.getAttribute('href')).endsWith(`mood=${MOOD[k]}`), await rit.getAttribute('href'));
    const shopHref = await p.locator('#dCta a.btn.line').getAttribute('href');
    ok(`${label} ${k}: the Shop button follows the same mood as the ritual`, shopHref.includes(`m=${MOOD[k]}`), shopHref);
    const coach = p.locator('#dProducts .sp-coach');
    ok(`${label} ${k}: the practice offers the free discovery call`, (await coach.getAttribute('href')) === expect[k] && /Free 20-minute discovery call/.test(await coach.innerText()) && !/reset/i.test(await coach.innerText()), await coach.getAttribute('href'));
  }
  // following the offers
  await pick(p, 'golden'); await p.locator('#dProducts .sp-coach').click(); await p.waitForURL('**/book');
  await p.waitForSelector('.bk-title'); ok(`${label}: the call offer opens booking for the free discovery call`, /Book your free discovery call/.test(await p.locator('.bk-title').innerText()));
  await p.goto(origin + '/'); await p.waitForSelector('#dProducts .sp-ritual'); await pick(p, 'golden');
  await p.locator('#dProducts .sp-ritual').click(); await p.waitForURL('**/explore**');
  ok(`${label}: the ritual opens the scent wheel on its mood`, /Warm and woody/.test(await p.locator('.wpanel').innerText()));
  // the hero's own Add button is the only ritual CTA: no one-product bar rises later on the page
  await p.goto(origin + '/'); await p.waitForSelector('#dProducts .sp-ritual'); await p.waitForTimeout(500);
  await p.evaluate(() => window.scrollTo(0, (Number(document.querySelector('.daypin')?.dataset.len) || 0) + 1500)); await p.waitForTimeout(700);
  ok(`${label}: no one-product buy bar rises on the home page`, (await p.locator('.buybar').count()) === 0 && (await p.locator('#dCta [data-addmoment]').count()) === 1);
  ok(`${label}: offers fit on screen, no sideways scroll`, (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
  ok(`${label}: offers are reachable by keyboard`, await p.evaluate(() => [...document.querySelectorAll('#dProducts .sp')].every(a => a.tabIndex === 0 && a.getAttribute('aria-label'))));
  ok(`${label}: no JS errors`, errs.length === 0, errs.join(' | ').slice(0, 200));
  await ctx.close();
}
{ // the candle moons are unlit (owner, October 2026): no flame, no melt pool; each wick's shadow is a sundial for the hour
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  await p.goto(origin + '/'); await p.waitForSelector('.moonarc .cm canvas'); await p.waitForTimeout(1500);
  ok('no flame, ember or melt-pool overlay on any candle moon', await p.evaluate(() => document.querySelectorAll('.moonarc .cm').length === 5 && !document.querySelector('.moonarc .cm-flame, .moonarc [class*="cmf-"]')));
  const shadow = async k => {
    await pick(p, k); await p.waitForFunction(k => document.querySelector('#dStack')?.dataset.shown === k, k, { timeout: 20000 }).catch(() => {});
    return p.evaluate(() => {
      const el = document.querySelector('.moonarc .cm.full'), [dx, dy, len] = el.dataset.shadow.split(',').map(Number);
      const c = el.querySelector('canvas'), x = c.getContext('2d'), R = c.width / 2;
      // the wax a little way along the shadow, against the same distance the other side of the wick
      const at = s => { const d = x.getImageData(Math.round(R + s * dx * R * len * 0.45), Math.round(R + s * dy * R * len * 0.45 + R * 0.02), 1, 1).data; return d[0] + d[1] + d[2]; };
      return { dx, dy, len, shade: at(1) / at(-1) };
    });
  };
  const dawn = await shadow('dawn'), midday = await shadow('midday'), golden = await shadow('golden');
  ok('the sundial: the wick shadow falls right at dawn and left at golden hour', dawn.dx > 0.3 && golden.dx < -0.3, `${dawn.dx} / ${golden.dx}`);
  ok('the sundial: the shadow is short at midday and long at dawn and golden hour', midday.len < 0.2 && dawn.len > 2 * midday.len && golden.len > 2 * midday.len, `${dawn.len} / ${midday.len} / ${golden.len}`);
  ok('the sundial: the wax really is darker in the wick shadow', golden.shade < 0.97 && dawn.shade < 0.97, `${dawn.shade.toFixed(3)} / ${golden.shade.toFixed(3)}`);
  await ctx.close();
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
