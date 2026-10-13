// Giving back: "Light that travels" at the end of Meet the maker, the public ledger at /giving (driven only by
// src/data/giving.ts, which starts empty: an honest empty state and no invented totals), a filled ledger (entries injected
// through the preview-only test hook), the quiet line in the cart and under Add to cart, and no sideways scroll on phones.
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const noScroll = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const toGiving = h => /(^|\/|#\/)giving$/.test(h ?? '');
const ENTRIES = [
  { date: '2026-11-02', amount: 100, recipient: 'Test Recipient A', note: 'Test note for October.', orders: 100, proofUrl: '/giving/test-receipt.pdf' },
  { date: '2026-12-01', amount: 48.5, recipient: 'Test Recipient B', photo: '/img/studio/web/claire-round.webp', photoAlt: 'A test photo' },
];

for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 360, height: 780 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.setDefaultTimeout(10000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));

  // ---- the story section
  await p.goto(base + '/story'); await p.waitForSelector('.gv'); await p.waitForTimeout(500);
  const st = await p.evaluate(() => {
    const gv = document.querySelector('.gv'), quote = document.querySelector('.st-quote');
    const t = gv.innerText;
    return {
      after: !!(quote && (quote.compareDocumentPosition(gv) & Node.DOCUMENT_POSITION_FOLLOWING)),
      h2: gv.querySelector('h2')?.textContent.trim(),
      links: [...gv.querySelectorAll('a')].map(a => a.getAttribute('href')),
      dollar: /\$1 from every order|one dollar from (every|each)/i.test(t), white: /White Rock/.test(t) && /Semiahmoo/.test(t), proof: /proof|receipt/i.test(t),
      line: /Every candle you light here lights another/.test(t),
      bcDraft: [...gv.querySelectorAll('*')].filter(el => el.children.length === 0 && /BC Children/.test(el.textContent)).every(el => el.closest('.d')),
      bcNamed: /BC Children.s Hospital/.test(t), imgs: gv.querySelectorAll('img').length,
      paused: getComputedStyle(gv.querySelector('.gv-l')).animationPlayState,
    };
  });
  ok(`${label}: "Light that travels" follows Claire's story on Meet the maker`, st.after && /Light that travels/i.test(st.h2), st.h2);
  ok(`${label}: it explains $1 from every order, the causes and the proof`, st.dollar && st.bcNamed && st.white && st.proof && st.line, JSON.stringify(st));
  ok(`${label}: it links to the giving tracker and to the shop`, st.links.some(toGiving) && st.links.some(h => /shop/.test(h)), st.links.join(' '));
  ok(`${label}: every line naming BC Children's Hospital is a draft for Claire, and no logo is used`, st.bcDraft && st.imgs === 0);
  ok(`${label}: the lanterns rest while the section is off screen`, st.paused === 'paused', st.paused);
  await p.evaluate(() => document.querySelector('.gv').scrollIntoView({ block: 'center' })); await p.waitForTimeout(700);
  ok(`${label}: the lanterns rise once the section is in view`, await p.evaluate(() => getComputedStyle(document.querySelector('.gv-l')).animationPlayState === 'running'));
  ok(`${label}: the story page has no sideways scroll`, (await noScroll(p)) <= 1);

  // ---- the tracker, with the real (empty) data file
  await p.goto(base + '/giving'); await p.waitForSelector('.gvp'); await p.waitForTimeout(500);
  const em = await p.evaluate(() => {
    const app = document.getElementById('app'), t = app.innerText;
    return {
      title: document.title, h1: document.querySelectorAll('#app h1').length, empty: document.querySelector('.gvp-empty')?.innerText ?? '',
      list: !!document.querySelector('.gvp-list'), totals: !!document.querySelector('.gvp-totals'),
      amounts: [...t.matchAll(/\$\s?\d[\d,]*(?:\.\d+)?/g)].map(m => m[0].replace(/\s/g, '')),
      how: /How it works/i.test(t) && /How the amount is calculated/i.test(t),
      bcDraft: [...app.querySelectorAll('*')].filter(el => el.children.length === 0 && /BC Children/.test(el.textContent)).every(el => el.closest('.d')),
      impact: /helped \d|\d+ children/i.test(t), footer: [...document.querySelectorAll('footer a')].some(a => /giving$/.test(a.getAttribute('href')) && /Community/i.test(a.parentElement.querySelector('.fh')?.textContent ?? '')),
    };
  });
  ok(`${label}: /giving has its page title, one h1, and a link in the footer's Community column`, /^Giving back · Daily Rituals Co\.$/.test(em.title) && em.h1 === 1 && em.footer, em.title);
  ok(`${label}: with an empty data file the ledger shows the honest empty state`, /first giving report will be posted after our first month of orders/i.test(em.empty) && /receipt/i.test(em.empty) && !em.list, em.empty.slice(0, 90));
  ok(`${label}: no dollar total is shown (only the $1 rate; no invented numbers, no impact claims)`, !em.totals && em.amounts.every(a => /^\$(1|0|0\.00)$/.test(a)) && !em.impact, em.amounts.join(' '));
  ok(`${label}: How it works and how the amount is calculated are there, BC Children's always a draft`, em.how && em.bcDraft);
  ok(`${label}: /giving (empty) has no sideways scroll`, (await noScroll(p)) <= 1);

  // ---- the cart and the product page
  await p.goto(base + '/product/cabana'); await p.waitForSelector('#addBtn:not([disabled])'); await p.waitForTimeout(400);
  const pn = await p.evaluate(() => { const n = document.querySelector('.buy .gv-note'); return n ? { href: n.getAttribute('href'), t: n.textContent, d: !!n.querySelector('.d') } : null; });
  ok(`${label}: a quiet line under Add to cart links to the tracker`, pn && toGiving(pn.href) && /\$1 from this order/.test(pn.t) && pn.d, JSON.stringify(pn));
  await p.click('#addBtn'); await p.waitForTimeout(300); await p.click('#cartBtn'); await p.waitForSelector('.drawer .gv-note');
  const cn = await p.evaluate(() => { const n = document.querySelector('.drawer .gv-note'); return { href: n.getAttribute('href'), t: n.textContent, d: !!n.querySelector('.d') }; });
  ok(`${label}: the cart has the giving line, linking to the tracker`, toGiving(cn.href) && /\$1 from this order/.test(cn.t) && cn.d, JSON.stringify(cn));
  await p.click('.drawer .gv-note'); await p.waitForSelector('.gvp'); await p.waitForTimeout(300);
  ok(`${label}: following it opens the tracker and closes the cart`, /giving/.test(p.url()) && await p.evaluate(() => document.getElementById('overlay').hidden));
  ok(`${label}: no JS errors`, errs.length === 0, errs.join(' | ').slice(0, 200));
  await ctx.close();

  // ---- the tracker with entries (preview-only test hook; the data file stays empty)
  const ctx2 = await b.newContext({ viewport: vp }); const q = await ctx2.newPage(); q.setDefaultTimeout(10000); await setupMocks(q);
  await q.addInitScript(e => { window.__DR_GIVING__ = e; }, ENTRIES);
  await q.goto(base + '/giving'); await q.waitForSelector('.gvp-list'); await q.waitForTimeout(400);
  const f = await q.evaluate(() => ({
    total: document.querySelector('.gvp-total')?.textContent.trim(), n: document.querySelectorAll('ol.gvp-list > li').length,
    first: document.querySelector('.gvp-list li h3')?.textContent, empty: !!document.querySelector('.gvp-empty'),
    times: [...document.querySelectorAll('.gvp-list time')].map(t => t.getAttribute('datetime')),
    proof: [...document.querySelectorAll('.gvp-proof[href]')].map(a => a.getAttribute('href')), alt: document.querySelector('.gvp-photo img')?.getAttribute('alt'),
    note: /Test note for October/.test(document.querySelector('.gvp-list').innerText), orders: document.querySelector('.gvp-totals')?.innerText ?? '',
    lanterns: document.querySelectorAll('.gvp-hero .gv-l.float').length,
  }));
  ok(`${label}: with entries the total is added up from them`, f.total === '$148.50' && /100/.test(f.orders), `${f.total} | ${f.orders.replace(/\n/g, ' ')}`);
  ok(`${label}: each entry renders in a list, newest first, with date, recipient, note, receipt and photo alt`, f.n === 2 && !f.empty && f.first === 'Test Recipient B' && f.times.join() === '2026-12-01,2026-11-02' && f.proof.join() === '/giving/test-receipt.pdf' && f.alt === 'A test photo' && f.note, JSON.stringify(f));
  ok(`${label}: the sky shows one lantern per donation posted`, f.lanterns === 2, String(f.lanterns));
  ok(`${label}: /giving (with entries) has no sideways scroll`, (await noScroll(q)) <= 1);
  await ctx2.close();
}

// reduced motion: the lanterns stand still
const ctx = await b.newContext({ viewport: { width: 1024, height: 800 }, reducedMotion: 'reduce' }); const p = await ctx.newPage(); await setupMocks(p);
await p.goto(base + '/story'); await p.waitForSelector('.gv'); await p.evaluate(() => document.querySelector('.gv').scrollIntoView({ block: 'center' })); await p.waitForTimeout(500);
ok('reduced motion: the lanterns stand still', await p.evaluate(() => [...document.querySelectorAll('.gv-l, .gv-lb')].every(el => getComputedStyle(el).animationName === 'none')));
await ctx.close();
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
