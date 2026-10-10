import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const op = (p, sel) => p.evaluate(s => Number(getComputedStyle(document.querySelector(s)).opacity), sel);
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  await p.goto(base + '/'); await p.waitForSelector('#scene'); await p.waitForTimeout(500);
  ok('the landscape is drawn on canvases (not flat vector shapes)', (await p.locator('#scene canvas.land').count()) === 5);
  const fills = []; for (const k of ['dawn', 'morning', 'midday', 'golden', 'night']) {
    await p.locator(`.moments [data-jump="${k}"]`).click(); await p.waitForTimeout(2600);
    fills.push(await p.evaluate(() => { const cs=[...document.querySelectorAll('canvas.land')]; const c = cs.sort((a,b)=>Number(getComputedStyle(b).opacity)-Number(getComputedStyle(a).opacity))[0]; const d = c.getContext('2d').getImageData(Math.floor(c.width * .5), Math.floor(c.height * .5), 1, 1).data; return d.slice(0, 3).join(','); }));
    const birds = await op(p, '.b1'), ff = await op(p, '.f1'), mist = await op(p, '.k1');
    if (k === 'morning') ok('morning: birds are flying', birds > 0.5, `${birds}`);
    if (k === 'golden') ok('golden hour: birds are flying', birds > 0.5, `${birds}`);
    if (k === 'night') { ok('night: no birds', birds === 0, `${birds}`); ok('night: fireflies glow', ff > 0.5, `${ff}`); }
    if (k === 'morning') ok('morning: no fireflies', ff === 0, `${ff}`);
    if (k === 'dawn') ok('dawn: mist is thick', mist > 0.7, `${mist}`);
    if (k === 'midday') ok('midday: mist is nearly gone', mist < 0.2, `${mist}`);
    const mx = await p.evaluate(() => { const r = document.getElementById('sunorb').getBoundingClientRect(); return Math.round(r.left + r.width / 2); });
    if (k === 'dawn') var dawnX = mx; if (k === 'night') ok('the sun/moon glides across the sky from dawn to night', mx > dawnX + 400, `${dawnX} -> ${mx}`);
  }
  ok('each moment repaints the mountains in its own colours', new Set(fills).size === 5, fills.join(' | '));
  ok('the landscape is not blank', fills.every(f => f !== '0,0,0'));
  ok('the dial sun becomes a moon at night', (await p.evaluate(() => document.getElementById('sunC').getAttribute('fill'))) !== '#FFC37A');
  await p.locator('.moments [data-jump="night"]').click();
  ok('night buttons are readable (light text)', await p.evaluate(() => { const c = getComputedStyle(document.querySelector('.dayhero .btn.line')).color; return c !== getComputedStyle(document.querySelector('.dayhero')).backgroundColor && /24[0-9]|23[0-9]/.test(c); }), await p.evaluate(() => getComputedStyle(document.querySelector('.dayhero .btn.line')).color));
  // continuous blend + time-lapse
  const opsOf = () => p.evaluate(() => [...document.querySelectorAll('canvas.land')].map(c => Number(getComputedStyle(c).opacity)));
  ok('settled moment shows one dominant landscape', Math.max(...await opsOf()) > 0.95);
  await p.locator('.moments [data-jump="golden"]').click(); await p.waitForTimeout(1600);
  await p.locator('.moments [data-jump="night"]').click(); await p.waitForTimeout(600);
  const mid = await opsOf(); ok('moving between moments blends two landscapes on the way', mid.filter(v => v > 0.05 && v < 0.95).length >= 1, mid.map(v => v.toFixed(2)).join(','));
  await p.waitForTimeout(1400); const dw = await opsOf(); ok('then settles on one', Math.max(...dw) > 0.95, dw.map(v => v.toFixed(2)).join(','));
  ok('no "Watch the day" button', await p.locator('#dayPlay').count() === 0);
  // the realistic sky (only where the browser has WebGL)
  const gl = await p.evaluate(() => !!document.createElement('canvas').getContext('webgl'));
  if (gl) {
    await p.goto(base.replace(/\/#$/, '') + '/?sky=gl'); await p.waitForSelector('#scene'); await p.waitForTimeout(1000);
    ok('realistic sky is drawn behind the mountains', (await p.locator('#scene canvas.glsky').count()) === 1 && await p.evaluate(() => document.getElementById('scene').classList.contains('gl')));
    ok('the mountains stand on a lake', await p.evaluate(() => getComputedStyle(document.querySelector('#scene canvas.land')).bottom !== '0px'));
    await p.evaluate(() => { document.querySelector('.moments [data-jump="night"]').click(); }); await p.waitForTimeout(1700);
    ok('night: the words turn light on the dark sky', await p.evaluate(() => document.getElementById('day').classList.contains('sky-dark')));
    await p.evaluate(() => { document.querySelector('.moments [data-jump="midday"]').click(); }); await p.waitForTimeout(1700);
    ok('midday: the words are dark on the bright sky', await p.evaluate(() => !document.getElementById('day').classList.contains('sky-dark')));
  } else console.log('NOTE no WebGL in this browser: realistic sky checks skipped');
  const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok('no sideways scroll', o <= 1, `${o}`);
  await ctx.close();
}
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  await p.goto(base + '/'); await p.waitForSelector('#scene'); await p.waitForTimeout(400);
  ok('reduced motion: mountains and clouds do not animate', await p.evaluate(() => ['.c1', '.k1'].every(s => getComputedStyle(document.querySelector(s)).animationName === 'none')));
  ok('reduced motion: birds and fireflies are not shown', await p.evaluate(() => getComputedStyle(document.querySelector('.b1')).display === 'none' && getComputedStyle(document.querySelector('.f1')).display === 'none'));
  await ctx.close();
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
