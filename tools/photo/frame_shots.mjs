// Screenshots of every frame that shows Claire's portrait or a glass tumbler, at the widths the owner checks.
// Usage (with the preview running): CHROME=... MOCK_PHOTOS=1 BASE=http://localhost:4232/# OUT=/tmp/shots node tools/photo/frame_shots.mjs
// W=1440,390 limits the widths; ONLY=home,story limits the frames.
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { setupMocks } from '../../e2e/mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4232/#';
const out = process.env.OUT ?? '/tmp/frame-shots';
mkdirSync(out, { recursive: true });
// [name, route, selector to bring into view, optional action before the shot]
const all = [
  ['home', '/', '.claire-cut'],
  ['coach-hero', '/coaching', '.co-claire'],
  ['coach-meet', '/coaching', '.cel-portrait'],
  ['story', '/story', '.st-claire'],
  ['home-shelf', '/', 'img[src*="/cut/cabana"]'],
  ['shop-candles', '/shop', 'img[src*="/cut/verdant"]'],
  ['coach-kit', '/coaching', '.lc'],
  ['breathe', '/coaching', '.breathorb', async p => { await p.locator('.breathorb').click(); await p.waitForSelector('.jbreathe.open'); await p.waitForTimeout(2500); }],
];
const only = process.env.ONLY?.split(',');
const targets = only ? all.filter(t => only.includes(t[0])) : all;
const widths = (process.env.W ?? '1440,1024,390,360').split(',').map(Number);
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
for (const w of widths) {
  const ctx = await b.newContext({ viewport: { width: w, height: w > 800 ? 900 : 800 }, reducedMotion: 'reduce' });
  const p = await ctx.newPage(); await setupMocks(p);
  for (const [name, route, sel, act] of targets) {
    await p.goto(base + route); await p.waitForTimeout(1500);
    const found = await p.evaluate(s => { const e = document.querySelector(s); if (!e) return false; e.scrollIntoView({ block: 'center' }); return true; }, sel);
    if (!found) { console.log('missing', name, w); continue; }
    await p.waitForTimeout(1800);
    if (act) await act(p);
    else await p.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), sel);
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${out}/${name}-${w}.png` });
    console.log('ok', name, w);
  }
  await ctx.close();
}
await b.close();
