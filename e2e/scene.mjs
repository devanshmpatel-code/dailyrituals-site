import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const op = (p, sel) => p.evaluate(s => Number(getComputedStyle(document.querySelector(s)).opacity), sel);
// wait until the moment's fades have finished (birds, fireflies, mist stop changing), so a busy machine reads the settled scene, not a frame mid-fade
const settled = async (p, max = 10000) => { let last = '', t0 = Date.now(); while (Date.now() - t0 < max) { const v = await p.evaluate(() => ['.b1', '.f1', '.k1'].map(s => getComputedStyle(document.querySelector(s)).opacity).join()); if (v === last) return; last = v; await p.waitForTimeout(300); await p.evaluate(() => new Promise(r => { let n = 0; const f = () => (++n < 4 ? requestAnimationFrame(f) : r()); requestAnimationFrame(f); })); } };
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  await p.goto(base + '/'); await p.waitForSelector('#scene'); await p.waitForTimeout(500);
  ok('the landscape is drawn on canvases (not flat vector shapes)', (await p.locator('#scene canvas.land').count()) === 5);
  const fills = []; for (const k of ['dawn', 'morning', 'midday', 'golden', 'night']) {
    // the scene switches to the new moment when the sun's glide ends (slower on a busy machine), then its fades run
    await p.locator(`.moments [data-jump="${k}"]`).click(); await p.waitForFunction(m => document.querySelector('.dayhero')?.dataset.m === m, k, { timeout: 20000 }); await p.waitForTimeout(2600); await settled(p);
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
  await p.locator('.moments [data-jump="golden"]').click(); await p.waitForFunction(() => document.querySelector('.dayhero')?.dataset.m === 'golden', null, { timeout: 20000 }); await p.waitForTimeout(1600);
  await p.locator('.moments [data-jump="night"]').click();
  // sample the glide until a blended frame shows (a busy machine draws few frames, so one fixed-time sample can miss it)
  let mid = []; for (let i = 0; i < 30; i++) { await p.waitForTimeout(100); mid = await opsOf(); if (mid.filter(v => v > 0.05 && v < 0.95).length >= 1) break; }
  ok('moving between moments blends two landscapes on the way', mid.filter(v => v > 0.05 && v < 0.95).length >= 1, mid.map(v => v.toFixed(2)).join(','));
  await p.waitForTimeout(1400); const dw = await opsOf(); ok('then settles on one', Math.max(...dw) > 0.95, dw.map(v => v.toFixed(2)).join(','));
  ok('no "Watch the day" button', await p.locator('#dayPlay').count() === 0);
  // the realistic sky (only where the browser has WebGL)
  const gl = await p.evaluate(() => !!document.createElement('canvas').getContext('webgl'));
  if (gl) {
    await p.goto(base.replace(/\/?#?$/, '') + '/?sky=gl'); await p.waitForSelector('#scene'); await p.waitForTimeout(1000);
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
// ---- the sun's light: never a clipped white patch, at any moment, in either sky; and the opening's wider effects are there ----
// A screenshot of the scene alone (words, offers, dial and moons hidden) is read back in the page: "clipped" is a pixel whose
// three channels are all 250 or more. The candle moons are read from their own canvases.
const HIDE = '.zz-hide .day-grid, .zz-hide .dial-row, .zz-hide .moonarc, .zz-hide .breathorb { visibility: hidden !important; }';
const clipped = async p => {
  await p.evaluate(() => document.body.classList.add('zz-hide')); await p.waitForTimeout(120);
  const r = await p.evaluate(() => { const r = document.querySelector('#day').getBoundingClientRect(); return { x: Math.max(0, r.left), y: Math.max(0, r.top), width: r.width, height: Math.min(r.height, innerHeight - Math.max(0, r.top)) }; });
  const png = (await p.screenshot({ clip: r })).toString('base64');
  await p.evaluate(() => document.body.classList.remove('zz-hide'));
  return p.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0, max = 0;
    for (let i = 0; i < d.length; i += 4) { const m = Math.min(d[i], d[i + 1], d[i + 2]); if (m >= 250) n++; const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; if (l > max) max = l; }
    return { pct: (n / (d.length / 4)) * 100, max: Math.round(max) };
  }, png);
};
const moonClip = p => p.evaluate(() => [...document.querySelectorAll('.moonarc .cm canvas')].reduce((n, c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 250 && Math.min(d[i], d[i + 1], d[i + 2]) >= 250) n++; return n; }, 0));
const go = async (p, k) => { await p.evaluate(k => document.querySelector(`.moments [data-jump="${k}"]`).click(), k); await p.waitForFunction(k => document.querySelector('.dayhero')?.dataset.m === k && document.querySelector('#dStack')?.dataset.shown === k, k, { timeout: 25000 }).catch(() => {}); await p.waitForTimeout(1800); };
for (const [label, url, vp] of [['CSS sky', '/', { width: 1440, height: 900 }], ['realistic sky', '/?sky=gl', { width: 1440, height: 900 }], ['realistic sky phone', '/?sky=gl', { width: 390, height: 844 }]]) {
  const gl = url.includes('gl');
  if (gl && !(await (async () => { const c = await b.newContext(); const q = await c.newPage(); const ok2 = await q.evaluate(() => !!document.createElement('canvas').getContext('webgl')); await c.close(); return ok2; })())) { console.log('NOTE no WebGL: skipped', label); continue; }
  const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.setDefaultTimeout(30000); await setupMocks(p);
  await p.addInitScript(() => { try { sessionStorage.setItem('dr_opened', '1'); } catch {} });
  await p.goto(base.replace(/\/?#?$/, '') + url); await p.waitForSelector('#dProducts .sp-ritual', { timeout: 20000 }); await p.addStyleTag({ content: HIDE }); await p.waitForTimeout(1200);
  for (const k of ['dawn', 'morning', 'midday', 'golden', 'night']) {
    await go(p, k);
    const c = await clipped(p), mc = await moonClip(p);
    ok(`${label}: at ${k} the sun leaves no clipped white in the sky`, c.pct < 0.01, JSON.stringify(c));
    ok(`${label}: at ${k} the candle moons keep their texture (no clipped white wax)`, mc === 0, `${mc} px`);
  }
  if (gl) {
    ok(`${label}: the lake mirrors the painted hills (the flat CSS mirror steps aside)`, await p.evaluate(() => document.getElementById('scene').classList.contains('refl') && !/below/.test(getComputedStyle(document.querySelector('#scene canvas.land')).webkitBoxReflect || '')));
    ok(`${label}: the haze over the hills follows the sky's own sun`, await p.evaluate(() => /%$/.test(document.getElementById('scene').style.getPropertyValue('--sx'))));
    ok(`${label}: the moons' names keep their small type (not the glossary's display type)`, await p.evaluate(() => [...document.querySelectorAll('.moonarc .cm-cap b')].every(b => parseFloat(getComputedStyle(b).fontSize) <= 12.5)));
  }
  if (vp.width > 1000) {
    // no caption crowds another moon or another caption, at any moment
    for (const k of ['dawn', 'midday', 'golden']) {
      await go(p, k);
      const bad = await p.evaluate(() => {
        const ms = [...document.querySelectorAll('.moonarc .cm')];
        const caps = ms.map(m => m.querySelector('.cm-cap')).filter(c => getComputedStyle(c).visibility !== 'hidden' && Number(getComputedStyle(c).opacity) > 0.2).map(c => ({ el: c.parentElement, r: c.getBoundingClientRect() }));
        const discs = ms.map(m => ({ el: m, r: m.querySelector('canvas').getBoundingClientRect() }));
        const hit = (a, b, pad) => a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad;
        const out = [];
        caps.forEach(c => { discs.forEach(d => { if (d.el !== c.el) { const cx = (d.r.left + d.r.right) / 2, cy = (d.r.top + d.r.bottom) / 2, rr = d.r.width / 2; const nx = Math.max(c.r.left, Math.min(cx, c.r.right)), ny = Math.max(c.r.top, Math.min(cy, c.r.bottom)); if ((nx - cx) ** 2 + (ny - cy) ** 2 < (rr + 2) ** 2) out.push(c.el.dataset.k + '>' + d.el.dataset.k); } });
          caps.forEach(o => { if (o !== c && hit(c.r, o.r, 2)) out.push(c.el.dataset.k + '~' + o.el.dataset.k); }); });
        return out;
      });
      ok(`${label}: at ${k} no moon's caption crowds a neighbouring moon or caption`, bad.length === 0, bad.join(' '));
    }
  }
  await go(p, 'night');
  ok(`${label}: night: fireflies blink over the trees (each at its own pace)`, await p.evaluate(() => { const f = [...document.querySelectorAll('.ff')]; return f.length >= 12 && getComputedStyle(f[0], '::before').animationName === 'ffblink' && new Set(f.map(x => getComputedStyle(x, '::before').animationDuration)).size >= 5; }));
  ok(`${label}: mist lies in the valleys as wisps (a noise mask, only translate animated)`, await p.evaluate(() => { const m = getComputedStyle(document.querySelector('.k2')); return m.maskImage.includes('svg') || (m.webkitMaskImage || '').includes('svg'); }));
  ok(`${label}: a low sun's haze washes the hills`, await p.evaluate(() => !!document.querySelector('#scene .sunhaze')));
  await p.evaluate(() => window.scrollTo(0, document.querySelector('#day').offsetHeight + 900));
  ok(`${label}: off screen, the scene's drifting layers pause`, await p.waitForFunction(() => document.getElementById('scene').classList.contains('paused'), null, { timeout: 15000 }).then(() => true, () => false));
  await p.evaluate(() => window.scrollTo(0, 0));
  ok(`${label}: back on screen, they move again`, await p.waitForFunction(() => !document.getElementById('scene').classList.contains('paused'), null, { timeout: 15000 }).then(() => true, () => false));
  await ctx.close();
}
{ // reduced motion: still and complete, in both skies
  for (const url of ['/', '/?sky=gl']) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' }); const p = await ctx.newPage(); p.setDefaultTimeout(30000); await setupMocks(p);
    await p.goto(base.replace(/\/?#?$/, '') + url); await p.waitForSelector('#dProducts .sp-ritual', { timeout: 20000 }); await p.addStyleTag({ content: HIDE }); await p.waitForTimeout(1500);
    await p.evaluate(() => document.body.classList.add('zz-hide'));
    const r = await p.evaluate(() => { const r = document.querySelector('#scene').getBoundingClientRect(); return { x: 0, y: Math.max(0, r.top), width: r.width, height: Math.min(r.height, innerHeight - Math.max(0, r.top)) }; });
    const a = await p.screenshot({ clip: r }); await p.waitForTimeout(1600); const c = await p.screenshot({ clip: r });
    const label = url.includes('gl') ? 'realistic sky' : 'CSS sky';
    ok(`reduced motion (${label}): the opening's scene is perfectly still`, a.equals(c));
    ok(`reduced motion (${label}): mist and the sun's haze do not drift, no fireflies`, await p.evaluate(() => ['.k1', '.k2', '.sunhaze'].every(s => getComputedStyle(document.querySelector(s)).animationName === 'none') && getComputedStyle(document.querySelector('.f10')).display === 'none'));
    ok(`reduced motion (${label}): still beautiful: the hills, the moons and the sky are all drawn`, await p.evaluate(() => document.querySelectorAll('.moonarc .cm canvas').length === 5 && Math.abs([...document.querySelectorAll('canvas.land')].reduce((n, c) => n + Number(c.style.opacity), 0) - 1) < 0.02));
    await ctx.close();
  }
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
