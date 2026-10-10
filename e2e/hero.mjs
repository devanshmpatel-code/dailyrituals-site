// The hero offers both things the business sells: the scent ritual (two products as one) and the practice (coaching).
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const origin = (process.env.BASE ?? 'http://localhost:4173/#').replace(/\/#\/?$/, '');
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const pick = (p, k) => p.evaluate(k => { document.querySelector(`.moments [data-jump="${k}"]`).click(); }, k).then(() => p.waitForTimeout(1600));
const money = s => Number((s.match(/\$(\d+\.\d{2})/) || [])[1]);
for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(origin + '/'); await p.waitForSelector('#dProducts .sp-ritual'); await p.waitForTimeout(600);
  ok(`${label}: the hero shows exactly two offers, a ritual and a practice`, (await p.locator('#dProducts .sp').count()) === 2 && (await p.locator('#dProducts .sp-ritual').count()) === 1 && (await p.locator('#dProducts .sp-coach').count()) === 1);
  const expect = { dawn: '/reset', morning: '/book', midday: '/reset', golden: '/book', night: '/reset' };
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
    ok(`${label} ${k}: the practice offers a free way into coaching`, (await coach.getAttribute('href')) === expect[k] && /Free/.test(await coach.innerText()), await coach.getAttribute('href'));
  }
  // following the offers
  await pick(p, 'golden'); await p.locator('#dProducts .sp-coach').click(); await p.waitForURL('**/book');
  await p.waitForSelector('.bk-title'); ok(`${label}: the call offer opens booking`, /Book a session/.test(await p.locator('.bk-title').innerText()));
  await p.goto(origin + '/'); await p.waitForSelector('#dProducts .sp-ritual'); await pick(p, 'midday');
  await p.locator('#dProducts .sp-coach').click(); await p.waitForURL('**/reset'); await p.waitForSelector('h1');
  ok(`${label}: the reset offer opens the free reset`, /reset/i.test(await p.locator('h1').innerText()), await p.locator('h1').innerText());
  await p.goto(origin + '/'); await p.waitForSelector('#dProducts .sp-ritual'); await pick(p, 'golden');
  await p.locator('#dProducts .sp-ritual').click(); await p.waitForURL('**/explore**');
  ok(`${label}: the ritual opens the scent wheel on its mood`, /Warm and woody/.test(await p.locator('.wpanel').innerText()));
  // the buy bar names the same ritual
  await p.goto(origin + '/'); await p.waitForSelector('#dProducts .sp-ritual'); await p.waitForTimeout(500);
  const name = await p.locator('#dProducts .sp-ritual b').innerText();
  await p.evaluate(() => window.scrollTo(0, (Number(document.querySelector('.daypin')?.dataset.len) || 0) + 1500)); await p.waitForTimeout(700);
  ok(`${label}: the buy bar names the same ritual`, (await p.locator('.buybar em').innerText()) === name, name);
  ok(`${label}: offers fit on screen, no sideways scroll`, (await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
  ok(`${label}: offers are reachable by keyboard`, await p.evaluate(() => [...document.querySelectorAll('#dProducts .sp')].every(a => a.tabIndex === 0 && a.getAttribute('aria-label'))));
  ok(`${label}: no JS errors`, errs.length === 0, errs.join(' | ').slice(0, 200));
  await ctx.close();
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
