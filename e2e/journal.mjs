// The Journal: an index of candle-care and ritual articles, each with sources and a way back to the shop; the home page
// teaser; the newsletter is the Monthly Ritual (no more "Sunday note"); the wax guide says the candles are soy (confirmed).
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
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
    ok(`${label}: ${slug} has a title, a way to the shop, and is marked as a draft`, a.h1?.length > 10 && a.shop.length >= 1 && a.shop.every(h => /^\/(shop|reset|explore|coaching)/.test(h) || /^#\//.test(h)) && a.draft, JSON.stringify(a.shop));
    if (slug !== 'candle-and-roller') ok(`${label}: ${slug} cites its sources`, a.src.length >= 1 && a.src.every(u => /^https:\/\//.test(u)), a.src.join(' '));
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
  ok(`${label}: the newsletter points to Ritual on Repeat for the candle itself`, (await p.locator('.newsflow a[href*="subscribe"]').count()) === 1);
  ok(`${label}: the footer links to the Journal`, (await p.locator('footer a[href*="journal"]').count()) >= 1);
  ok(`${label}: no JS errors`, errs.length === 0, errs.join(' | ').slice(0, 200));
  await ctx.close();
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
