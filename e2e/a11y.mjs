// Accessibility structure: the cart drawer is a real modal (aria-modal, Tab stays inside, the page behind is inert, Esc and
// focus return), the phone menu inerts the page and the orb too, the toast's live region exists from the first paint,
// heading levels never skip (the shop, the footer), and no readable text is smaller than 11.5px.
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };

const inDrawer = p => p.evaluate(() => !!document.activeElement?.closest('#overlay .drawer'));
const inertState = p => p.evaluate(() => ({
  app: document.getElementById('app').inert, header: document.querySelector('header.top').inert, footer: document.querySelector('footer').inert,
  orb: document.querySelector('.breathorb')?.inert ?? null, overlay: document.getElementById('overlay').inert, any: document.querySelectorAll('[inert]').length,
}));
// heading levels in document order: a heading may be at most one level deeper than the one before it
const skips = p => p.evaluate(() => {
  const hs = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter(h => h.getClientRects().length && !h.closest('[hidden], [aria-hidden="true"], #overlay'));
  let prev = 0; const out = [];
  for (const h of hs) { const l = +h.tagName[1]; if (prev && l > prev + 1) out.push(`${h.tagName} "${h.textContent.trim().slice(0, 24)}" after h${prev}`); prev = l; }
  return out;
});
// visible text smaller than 11.5px (SVG text scales with its drawing and is left out)
const tiny = p => p.evaluate(() => {
  const out = []; const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) {
    const t = n.nodeValue.trim(); const e = n.parentElement;
    if (t.length < 2 || !e || e.closest('svg, script, style, [hidden], .treebg, noscript')) continue;
    const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || !e.getClientRects().length) continue;
    if (parseFloat(cs.fontSize) < 11.5) out.push(`${e.tagName.toLowerCase()}${typeof e.className === 'string' && e.className ? '.' + e.className.split(' ')[0] : ''} ${cs.fontSize} "${t.slice(0, 20)}"`);
  }
  return out;
});

{ // desktop: toast region, cart drawer, headings
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/'); await p.waitForTimeout(1500);
  const t0 = await p.evaluate(() => { const t = document.getElementById('toast'); return t ? { role: t.getAttribute('role'), live: t.getAttribute('aria-live'), text: t.textContent, on: t.classList.contains('on') } : null; });
  ok('toast: the live region exists at load, empty, before any message', !!t0 && t0.role === 'status' && t0.live === 'polite' && t0.text === '' && !t0.on, JSON.stringify(t0));

  await p.goto(base + '/product/cabana'); await p.waitForSelector('#addBtn'); await p.click('#addBtn'); await p.waitForTimeout(500);
  ok('toast: the first message lands in the same region that was there from the start', await p.evaluate(() => document.querySelectorAll('#toast').length === 1 && /added to your cart/.test(document.getElementById('toast').textContent)));
  await p.waitForTimeout(300);
  await p.focus('#cartBtn'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  const dlg = await p.evaluate(() => { const d = document.querySelector('#overlay .drawer'); return { role: d.getAttribute('role'), modal: d.getAttribute('aria-modal'), label: d.getAttribute('aria-label') }; });
  ok('cart drawer: role=dialog, aria-modal=true and a name', dlg.role === 'dialog' && dlg.modal === 'true' && !!dlg.label, JSON.stringify(dlg));
  ok('cart drawer: focus moves inside it', await inDrawer(p));
  const st = await inertState(p);
  ok('cart drawer: the page, header, footer and the orb are inert, the drawer is not', st.app && st.header && st.footer && st.orb !== false && !st.overlay, JSON.stringify(st));
  let escaped = 0; const seen = new Set();
  for (let i = 0; i < 24; i++) { await p.keyboard.press('Tab'); if (!(await inDrawer(p))) escaped++; seen.add(await p.evaluate(() => document.activeElement?.getAttribute('aria-label') || document.activeElement?.textContent.trim().slice(0, 20))); }
  ok('cart drawer: 24 Tabs never leave it, and they cycle through its controls', escaped === 0 && seen.size >= 4, `${escaped} escapes, ${seen.size} distinct stops`);
  escaped = 0;
  for (let i = 0; i < 24; i++) { await p.keyboard.press('Shift+Tab'); if (!(await inDrawer(p))) escaped++; }
  ok('cart drawer: 24 Shift+Tabs never leave it either', escaped === 0, `${escaped} escapes`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const st2 = await inertState(p);
  ok('cart drawer: Esc closes it, nothing stays inert, focus returns to the cart button', await p.evaluate(() => document.getElementById('overlay').hidden) && st2.any === 0 && await p.evaluate(() => document.activeElement?.id === 'cartBtn'), JSON.stringify(st2));
  await p.click('#cartBtn'); await p.waitForTimeout(400); await p.locator('#overlay .scrim').click({ position: { x: 20, y: 300 } }); await p.waitForTimeout(300);
  ok('cart drawer: the scrim closes it and unlocks the page', await p.evaluate(() => document.getElementById('overlay').hidden && document.querySelectorAll('[inert]').length === 0));
  await p.click('#cartBtn'); await p.waitForTimeout(400); await p.goto(base + '/shop'); await p.waitForTimeout(800);
  ok('cart drawer: a route change while open also unlocks the page', await p.evaluate(() => document.querySelectorAll('[inert]').length === 0));

  await p.goto(base + '/shop'); await p.waitForSelector('.grid .card'); await p.waitForTimeout(800);
  const sk = await skips(p);
  ok('/shop: no heading skips (h1, then h2, then h3 cards)', sk.length === 0, sk.join(' | '));
  for (const r of ['/', '/shop', '/product/cabana', '/gift', '/coaching', '/drops', '/journal', '/help', '/story', '/giving']) {
    await p.goto(base + r); await p.waitForTimeout(1400);
    const s = await skips(p); const f = await p.evaluate(() => ({ h4: document.querySelectorAll('footer h4').length, h2: document.querySelectorAll('footer h2.fh').length }));
    ok(`${r}: no heading skips, and the footer uses h2 (no h4)`, s.length === 0 && f.h4 === 0 && f.h2 === 5, s.join(' | ') + ' ' + JSON.stringify(f));
  }
  ok('desktop: no JS errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}
{ // phone: the menu and the cart both lock the page, the orb included
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/'); await p.waitForTimeout(1500);
  ok('phone toast: the live region exists at load', await p.evaluate(() => document.getElementById('toast')?.getAttribute('role') === 'status' && document.getElementById('toast').textContent === ''));
  await p.click('#menuBtn'); await p.waitForTimeout(500);
  const sm = await p.evaluate(() => ({ root: document.getElementById('root').inert, orb: document.querySelector('.breathorb')?.inert, menu: document.getElementById('mobileMenu').inert }));
  ok('phone menu: the page and the breathing orb are inert, the menu is not', sm.root && sm.orb === true && !sm.menu, JSON.stringify(sm));
  let esc = 0; for (let i = 0; i < 30; i++) { await p.keyboard.press('Tab'); if (!(await p.evaluate(() => !!document.activeElement?.closest('#mobileMenu')))) esc++; }
  for (let i = 0; i < 6; i++) { await p.keyboard.press('Shift+Tab'); if (!(await p.evaluate(() => !!document.activeElement?.closest('#mobileMenu')))) esc++; }
  ok('phone menu: Tab and Shift+Tab stay inside it', esc === 0, `${esc} escapes`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  ok('phone menu: Esc unlocks everything and returns focus to the hamburger', await p.evaluate(() => document.querySelectorAll('[inert]').length === 0 && document.activeElement?.id === 'menuBtn'));
  await p.goto(base + '/product/cabana'); await p.waitForSelector('#addBtn'); await p.click('#addBtn'); await p.waitForTimeout(400);
  await p.evaluate(() => document.getElementById('cartBtn').click()); await p.waitForTimeout(500);
  let e2 = 0; for (let i = 0; i < 20; i++) { await p.keyboard.press('Tab'); if (!(await inDrawer(p))) e2++; }
  ok('phone cart: modal, inert page, and Tab stays inside', e2 === 0 && await p.evaluate(() => document.querySelector('.drawer').getAttribute('aria-modal') === 'true' && document.getElementById('app').inert && document.querySelector('.breathorb')?.inert !== false), `${e2} escapes`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok('phone cart: Esc unlocks the page', await p.evaluate(() => document.querySelectorAll('[inert]').length === 0));
  ok('phone: no JS errors', errs.length === 0, errs.join(' | '));
  await ctx.close();
}
for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }], ['small phone', { width: 360, height: 780 }]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: vp.width < 500, hasTouch: vp.width < 500 }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  let bad = [];
  for (const r of ['/', '/shop', '/product/cabana', '/drops', '/journal', '/gift', '/coaching', '/help']) {
    await p.goto(base + r); await p.waitForTimeout(1500);
    for (let y = 0; y < 14000; y += 700) { await p.evaluate(v => scrollTo(0, v), y); await p.waitForTimeout(50); }
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
    const t = await tiny(p); if (t.length) bad.push(`${r}: ${[...new Set(t)].slice(0, 4).join('; ')}`);
    if (vp.width <= 390) { const sw = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (sw > 1) bad.push(`${r}: sideways scroll ${sw}px`); }
  }
  ok(`${label}: no readable text under 11.5px${vp.width <= 390 ? ', no sideways scroll' : ''}`, bad.length === 0, bad.join(' | '));
  await ctx.close();
}
await b.close();
const f = res.filter(x => !x).length; console.log(`\n${res.length - f}/${res.length} passed`); process.exit(f ? 1 : 0);
