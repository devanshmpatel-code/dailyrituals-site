// The Journal: an index of candle-care and ritual articles, each with sources and a way back to the shop; the home page
// teaser; the newsletter is the Monthly Ritual (no more "Sunday note"); the wax guide says the candles are soy (confirmed).
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
import { readFileSync } from 'node:fs';
// the saved catalogue: what "live and buyable" means here (in stock, priced, and not one of the -need-pics past seasonals)
const CAT = JSON.parse(readFileSync(new URL('./products.json', import.meta.url), 'utf8')).products;
const BUYABLE = new Set(CAT.filter(x => x.inventory?.availabilityStatus === 'IN_STOCK' && Number(x.actualPriceRange?.minValue?.amount) > 0 && !/-need-pics$/.test(x.slug)).map(x => x.slug));
const slugOf = h => (h.match(/product\/([^?#/]+)/) || [])[1];
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const noScroll = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.setDefaultTimeout(10000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/journal'); await p.waitForSelector('.jr-grid .jr-card'); await p.waitForTimeout(800);
  const cards = await p.evaluate(() => [...document.querySelectorAll('.jr-grid .jr-card')].map(a => [a.getAttribute('href'), a.querySelector('b').textContent.trim()]));
  ok(`${label}: the Journal lists five articles`, cards.length === 5 && cards.every(([h, t]) => /\/journal\//.test(h) && t.length > 10), cards.map(c => c[1]).join(' | '));
  ok(`${label}: the lead picture loads (a cut-out, no background)`, await p.evaluate(() => { const i = document.querySelector('.jr-card.lead img'); return i.complete && i.naturalWidth > 0 && /studio\/tins\//.test(i.currentSrc || i.src); }));
  ok(`${label}: the Journal has no sideways scroll`, (await noScroll(p)) <= 1);
  for (const slug of ['wooden-wick', 'first-burn', 'candle-safety', 'wax-guide', 'candle-and-roller']) {
    await p.goto(base + '/journal/' + slug); await p.waitForSelector('.jr-body'); await p.waitForTimeout(300);
    const a = await p.evaluate(() => ({ h1: document.querySelector('h1')?.textContent.trim(), shop: [...document.querySelectorAll('.jr-shop a')].map(x => x.getAttribute('href')), src: [...document.querySelectorAll('.jr-sources a')].map(x => x.getAttribute('href')), draft: !!document.querySelector('.jr-body.d') }));
    ok(`${label}: ${slug} has a title, a way to the shop, and is marked as a draft`, a.h1?.length > 10 && a.shop.length >= 1 && a.shop.every(h => /^\/(shop|book|explore|coaching)/.test(h) || /^#\//.test(h)) && a.draft, JSON.stringify(a.shop));
    if (slug !== 'candle-and-roller') ok(`${label}: ${slug} cites its sources`, a.src.length >= 1 && a.src.every(u => /^https:\/\//.test(u)), a.src.join(' '));
    // the way back to the shop: real product cards at the foot, and a product link in the text where it names a format
    await p.waitForSelector('.jr-picks:not([hidden]) .card', { timeout: 10000 }).catch(() => {});
    const pr = await p.evaluate(() => ({ cards: [...document.querySelectorAll('.jr-picks:not([hidden]) .card')].filter(c => c.offsetParent).map(c => ({ href: c.querySelector('a').getAttribute('href'), f: c.dataset.format, n: c.querySelector('h3').textContent.trim() })),
      hooks: [...document.querySelectorAll('.jr-body .jr-hook')].map(h => ({ href: h.getAttribute('href'), n: h.querySelector('b').textContent.trim(), price: /\$\d+\.\d\d/.test(h.textContent) })) }));
    ok(`${label}: ${slug} ends with product cards, each a live product that can be bought`, pr.cards.length >= 2 && pr.cards.every(c => BUYABLE.has(slugOf(c.href))), JSON.stringify(pr.cards));
    if (slug === 'candle-and-roller') ok(`${label}: ${slug} offers one scent two ways, a candle and its roller`, pr.cards.length === 2 && pr.cards[0].f === 'candle' && pr.cards[1].f === 'roller' && pr.cards[0].n === pr.cards[1].n, JSON.stringify(pr.cards));
    else ok(`${label}: ${slug} offers candles`, pr.cards.every(c => c.f === 'candle'));
    if (slug === 'candle-safety') ok(`${label}: the safety checklist carries no product links`, pr.hooks.length === 0);
    else ok(`${label}: ${slug} links a live product where the text names it, with its price`, pr.hooks.length >= 1 && pr.hooks.every(h => BUYABLE.has(slugOf(h.href)) && h.price), JSON.stringify(pr.hooks));
  }
  await p.goto(base + '/journal/wax-guide'); await p.waitForSelector('.jr-body');
  const text = await p.locator('.jr-body').innerText();
  ok(`${label}: the wax guide says plainly that our candles are soy (confirmed by Claire)`, /our candles are poured with soy wax/i.test(text) && !/coconut wax candles|our candles are (coconut|paraffin)/i.test(text));
  await p.goto(base + '/journal/not-a-real-article'); await p.waitForSelector('.jr-grid');
  ok(`${label}: an unknown article goes back to the Journal`, /\/journal$/.test(new URL(p.url()).pathname));
  // home: teaser and the Monthly Ritual
  await p.goto(base + '/'); await p.waitForSelector('.jr-teaser'); await p.waitForTimeout(500);
  ok(`${label}: home shows three Journal cards`, (await p.locator('.jr-teaser .jr-card').count()) === 3);
  const news = await p.locator('.newsflow').innerText();
  ok(`${label}: the newsletter is the Monthly Ritual, not the Sunday note`, /monthly ritual/i.test(news) && !/sunday/i.test(news), news.slice(0, 80));
  // (the sign-up is the notify-me of the coming-soon Ritual on Repeat chapter now)
  ok(`${label}: the newsletter sits in Ritual on Repeat`, (await p.locator('.repeatflow .newsflow').count()) === 1 && (await p.locator('.repeatflow a[href*="subscribe"]').count()) === 1);
  ok(`${label}: home has one Monthly Ritual sign-up`, (await p.locator('main form.nform').count()) === 1 && (await p.locator('main #nemail').count()) === 1);
  ok(`${label}: the footer links to the Journal`, (await p.locator('footer a[href*="journal"]').count()) >= 1);
  ok(`${label}: no JS errors`, errs.length === 0, errs.join(' | ').slice(0, 200));
  await ctx.close();
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
