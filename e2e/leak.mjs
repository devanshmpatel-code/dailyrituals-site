import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const routes = ['/', '/shop', '/product/cabana', '/product/natural-deodorant', '/product/cabana-fragrance-roller', '/product/amber-rose-need-pics', '/coaching', '/help', '/story', '/account', '/explore', '/subscribe', '/drops'];
const bad = /38 left|\(sample\)|votes so far|\[Confirm|to be confirmed|Claire to confirm|Wording to confirm/i;
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
let fails = 0;
for (const drafts of [false, true]) {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(v => { try { localStorage.setItem('dr_drafts', v); } catch {} }, drafts ? '1' : '0');
  const p = await ctx.newPage(); await setupMocks(p);
  let seen = 0;
  for (const r of routes) {
    await p.goto(base + r); await p.waitForTimeout(1500);
    const t = await p.locator('main').innerText(); const m = t.match(bad);
    if (!drafts && m) { fails++; console.log('LEAK  ', r, '->', t.slice(Math.max(0, t.search(bad) - 40), t.search(bad) + 80).replace(/\n/g, ' ')); }
    if (drafts && m) seen++;
  }
  // cart promise
  await p.goto(base + '/product/cabana'); await p.waitForTimeout(1200); await p.locator('#app button:has-text("Add to cart")').first().click(); await p.click('#cartBtn'); await p.waitForTimeout(300);
  const drawer = await p.locator('.drawer').innerText();
  if (/Ritual Points/i.test(drawer)) { fails++; console.log('LEAK   cart promises Ritual Points'); }
  console.log(`drafts ${drafts ? 'ON ' : 'OFF'}: ${drafts ? seen + ' of ' + routes.length + ' pages show review notes for Claire' : (fails ? 'leaks found' : 'no review notes visible to customers')}`);
  await ctx.close();
}
await b.close(); process.exit(fails ? 1 : 0);
