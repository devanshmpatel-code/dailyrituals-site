import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
for (const [label, vp] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(base + '/coaching'); await p.waitForSelector('#loopWrap .lp-node'); await p.waitForTimeout(500);
  const h = () => p.locator('#loopWrap .loopcard h3').innerText();
  ok(`${label}: old loop has 3 circles`, (await p.locator('.lp-node').count()) === 3);
  ok(`${label}: starts on Cue`, (await h()) === 'Cue');
  await p.locator('.lp-node[data-node="1"]').click(); ok(`${label}: tapping a circle selects it`, (await h()) === 'Automatic response', await h());
  await p.locator('[data-step="1"]').click(); ok(`${label}: Next step moves on`, (await h()) === 'Short-term relief');
  await p.locator('[data-step="1"]').click(); ok(`${label}: loop wraps back to Cue`, (await h()) === 'Cue');
  await p.locator('.lp-node[data-node="0"]').focus(); await p.keyboard.press('Enter'); ok(`${label}: keyboard works on circles`, (await p.locator('.lp-node.on').count()) === 1);
  await p.locator('[data-play]').click(); await p.waitForTimeout(3000); ok(`${label}: Play advances on its own`, (await h()) !== 'Cue', await h()); await p.locator('[data-play]').click();
  await p.locator('[data-mode="old"]').click();
  await p.locator('#loopWrap').scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
  await p.locator('#loopWrap').screenshot({ path: `${process.env.SHOTS ?? '/tmp'}/${label}-loop-old.png` });
  await p.locator('[data-mode="new"]').click(); await p.waitForTimeout(200);
  ok(`${label}: new loop has 4 circles incl. Pause`, (await p.locator('.lp-node').count()) === 4 && /Pause/.test(await p.locator('#loopWrap svg').textContent()));
  await p.locator('.lp-node[data-node="1"]').click(); ok(`${label}: new loop step 2 is Pause`, (await h()) === 'Pause');
  await p.locator('#loopWrap').screenshot({ path: `${process.env.SHOTS ?? '/tmp'}/${label}-loop-new.png` });
  const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(`${label}: no sideways scroll`, o <= 1, `${o}`);
  ok(`${label}: no JS errors`, errs.length === 0, errs.join('|'));
  await ctx.close();
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
