// Site-wide QA crawl. Prints findings; exits 1 if there are any "must fix" findings.
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = 'http://localhost:4173/#';
const routes = ['/', '/shop', '/product/cabana', '/product/natural-deodorant', '/product/cabana-fragrance-roller', '/explore', '/explore?tab=quiz', '/coaching', '/book', '/subscribe', '/drops', '/gift', '/club', '/wall', '/help', '/story', '/account', '/reset', '/order-confirmed', '/discovery', '/nope'];
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const finds = []; const add = (sev, page, msg) => finds.push({ sev, page, msg });
for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: label === 'mobile' }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text().slice(0, 120)); });
  for (const r of routes) {
    errs.length = 0;
    await p.goto(base + r); await p.waitForTimeout(1300);
    const tag = `${label} ${r}`;
    const rep = await p.evaluate((isMobile) => {
      const out = { overflow: document.documentElement.scrollWidth - innerWidth, h1: document.querySelectorAll('main h1').length, title: document.title, noalt: [], noname: [], nolabel: [], small: [], levels: [], empties: 0 };
      document.querySelectorAll('main img').forEach(i => { if (!i.hasAttribute('alt')) out.noalt.push((i.getAttribute('src') || '').slice(-30)); });
      document.querySelectorAll('main button, main a, header button, header a').forEach(e => { const t = (e.textContent || '').trim() || e.getAttribute('aria-label') || e.getAttribute('title') || e.querySelector('img')?.getAttribute('alt'); if (!t) out.noname.push(e.outerHTML.slice(0, 70)); });
      document.querySelectorAll('main input:not([type=hidden]), main select, main textarea').forEach(e => { const has = e.getAttribute('aria-label') || e.id && document.querySelector(`label[for="${e.id}"]`) || e.closest('label') || e.getAttribute('aria-labelledby'); if (!has && e.type !== 'range') out.nolabel.push(`${e.tagName.toLowerCase()}#${e.id || e.name}`); if (!has && e.type === 'range') out.nolabel.push('range#' + e.id); });
      if (isMobile) document.querySelectorAll('main button, main a.btn, main .chip, header button').forEach(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); if (r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && (r.height < 36 || r.width < 36) && !e.closest('[hidden]')) out.small.push(`${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 18)} ${Math.round(r.width)}x${Math.round(r.height)}`); });
      let last = 0; document.querySelectorAll('main h1,main h2,main h3,main h4').forEach(h => { const l = Number(h.getAttribute('aria-level') || h.tagName[1]); if (last && l > last + 1) out.levels.push(`${h.tagName} after H${last}`); last = l; });
      return out;
    }, label === 'mobile');
    if (rep.overflow > 1) add('FIX', tag, `sideways scroll ${rep.overflow}px`);
    if (r !== '/nope' && rep.h1 !== 1) add('FIX', tag, `${rep.h1} h1 elements`);
    if (rep.noalt.length) add('FIX', tag, `images without alt: ${rep.noalt.slice(0, 3).join(', ')}`);
    if (rep.noname.length) add('FIX', tag, `controls without a name: ${rep.noname.slice(0, 2).join(' | ')}`);
    if (rep.nolabel.length) add('FIX', tag, `fields without a label: ${[...new Set(rep.nolabel)].slice(0, 4).join(', ')}`);
    if (label === 'mobile' && rep.small.length) add('NOTE', tag, `small tap targets: ${[...new Set(rep.small)].slice(0, 5).join('; ')}`);
    if (rep.levels.length) add('NOTE', tag, `heading levels skip: ${[...new Set(rep.levels)].join(', ')}`);
    if (errs.length) add('FIX', tag, `JS errors: ${errs.slice(0, 2).join(' | ')}`);
  }
  // dead-button hunt on key pages: click each visible button and see if anything observable changes
  if (label === 'desktop') for (const r of ['/', '/subscribe', '/drops', '/gift', '/club', '/wall', '/coaching', '/shop', '/product/cabana', '/help', '/account']) {
    await p.goto(base + r); await p.waitForTimeout(1200);
    const n = await p.locator('main button:visible').count();
    for (let i = 0; i < Math.min(n, 60); i++) {
      await p.goto(base + r); await p.waitForTimeout(500);
      const btn = p.locator('main button:visible').nth(i); if (!(await btn.count())) break;
      const info = await btn.evaluate(e => ({ text: (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30), type: e.type, disabled: e.disabled }));
      if (info.disabled || info.type === 'submit') continue;
      const snap = () => p.evaluate(() => JSON.stringify([document.querySelector('main').innerHTML.length, location.hash, document.body.className, document.getElementById('toast')?.className, document.querySelectorAll('[aria-pressed="true"]').length, document.querySelector('#overlay')?.hidden, !!document.querySelector('.jmap,.jbreathe'), [...document.querySelectorAll('input,select,textarea')].map(x => x.value + x.checked).join('|')]));
      const before = await snap(); await btn.scrollIntoViewIfNeeded().catch(() => {}); await btn.click({ timeout: 2000 }).catch(() => {}); await p.waitForTimeout(450);
      const after = await snap(); const toast = await p.evaluate(() => document.getElementById('toast')?.textContent ?? '');
      if (before === after && !toast) add('FIX', `desktop ${r}`, `button does nothing: "${info.text}"`);
    }
  }
  await ctx.close();
}
await b.close();
const fix = finds.filter(f => f.sev === 'FIX');
const uniq = new Map(); finds.forEach(f => { const k = f.sev + f.msg; if (!uniq.has(k)) uniq.set(k, { ...f, pages: [f.page] }); else uniq.get(k).pages.push(f.page); });
for (const f of uniq.values()) console.log(`${f.sev}  ${f.msg}\n      on: ${f.pages.slice(0, 6).join(', ')}${f.pages.length > 6 ? ` (+${f.pages.length - 6} more)` : ''}`);
console.log(`\n${fix.length} must-fix findings, ${finds.length - fix.length} notes`);
process.exit(fix.length ? 1 : 0);
