// The holiday layer (src/season.ts): off by default outside Nov 15 to Dec 31, on inside it by the visitor's own date (a Date
// override injected before the page loads); the preview toggle and ?season= work; the seal shows the computed Moon Drop date;
// the stubs, flags and seal exist only while it is on, as drafts; the gold dust sits behind the hero's words, pauses off screen
// and in hidden tabs and is never drawn with reduced motion; nothing covers text or the breathing orb; no sideways scroll.
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const origin = base.replace(/\/#\/?$/, '');
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const noScroll = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const allErrs = [];

/** A page whose clock reads `at` (local time in Vancouver); the clock keeps running from there. */
async function open(at, { vp = { width: 1280, height: 900 }, reducedMotion, query = '', route = '/', scale } = {}) {
  const ctx = await b.newContext({ viewport: vp, timezoneId: 'America/Vancouver', reducedMotion, deviceScaleFactor: scale });
  const p = await ctx.newPage(); p.setDefaultTimeout(10000); await setupMocks(p);
  if (at) await p.addInitScript(t => {
    const D = Date, off = new D(t).getTime() - D.now();
    class F extends D { constructor(...a) { if (a.length) super(...a); else super(D.now() + off); } static now() { return D.now() + off; } }
    window.Date = F;
  }, at);
  p.on('pageerror', e => allErrs.push(`${at} ${route}: ${e.message}`));
  await p.goto(`${origin}/${query}#${route}`); await p.waitForTimeout(1300);
  return { ctx, p };
}
const state = p => p.evaluate(() => ({
  on: document.body.classList.contains('season-holiday'),
  hol: document.querySelectorAll('[data-hol], [data-hol-wrap], [data-hol-host], .hol-stub, .hol-flag, .hol-seal, .hol-dust').length,
  toggle: document.getElementById('seasonToggle')?.checked ?? null,
}));

// ---- the calendar decides (no override)
for (const [at, want, label] of [
  ['2026-10-20T12:00:00', false, 'Oct 20'], ['2026-11-14T23:30:00', false, 'Nov 14 (late evening)'], ['2026-11-15T00:30:00', true, 'Nov 15 (just after midnight)'],
  ['2026-12-10T19:00:00', true, 'Dec 10'], ['2026-12-31T23:30:00', true, 'Dec 31 (late evening)'], ['2027-01-01T00:30:00', false, 'Jan 1'],
]) {
  const { ctx, p } = await open(at);
  const s = await state(p);
  ok(`${label}: the holiday layer is ${want ? 'on' : 'off'} by the visitor's date`, s.on === want && (want ? s.hol > 0 : s.hol === 0) && s.toggle === want, JSON.stringify(s));
  await ctx.close();
}

// ---- off (October): the site exactly as before
{
  const { ctx, p } = await open('2026-10-20T18:00:00');
  const o = await p.evaluate(() => ({
    bar: document.querySelector('.announce .an-live').innerHTML, btn: getComputedStyle(document.querySelector('.moment-shop .btn:not(.line)')).backgroundColor,
    dust: !!document.querySelector('.hol-dust, #day canvas.hol'), stubs: document.querySelectorAll('.hol-stub').length,
    labels: [...document.querySelectorAll('.preview-bar .drafts-toggle')].map(l => l.textContent.trim()),
  }));
  ok('off: the announcement bar is the plain line, buttons keep their ink, no stubs, flags, seal or dust', o.bar === 'Free shipping on Canadian orders over $75' && o.btn !== 'rgb(122, 31, 31)' && !o.dust && o.stubs === 0, JSON.stringify(o));
  ok('preview: the bar has a third toggle, "Holiday look", after the two that were there', o.labels.join('|') === 'Photo grade|Show drafts for Claire|Holiday look', o.labels.join('|'));
  ok('off: no sideways scroll', (await noScroll(p)) <= 1);

  // the toggle turns it on and back off, and remembers it
  await p.check('#seasonToggle'); await p.waitForTimeout(500);
  const on = await p.evaluate(() => ({ on: document.body.classList.contains('season-holiday'), stub: document.querySelector('.announce .an-live .hol-stub')?.textContent.trim(), dust: document.querySelector('.hol-dust')?.dataset.state, seal: !!document.querySelector('.claire-cut .hol-seal') }));
  ok('toggle on: the layer appears at once (bar stub, seal, gold dust running)', on.on && /^Free shipping on Canadian orders over \$75/.test(on.stub ?? '') && on.seal && on.dust === 'running', JSON.stringify(on));
  await p.reload(); await p.waitForTimeout(1300);
  ok('toggle on: it is remembered in this browser after a reload', (await state(p)).on);
  await p.uncheck('#seasonToggle'); await p.waitForTimeout(400);
  const off = await state(p);
  const bar = await p.evaluate(() => document.querySelector('.announce .an-live').innerHTML);
  ok('toggle off: every holiday piece is taken out and the bar is restored', !off.on && off.hol === 0 && bar === 'Free shipping on Canadian orders over $75', `${JSON.stringify(off)} ${bar}`);
  await p.reload(); await p.waitForTimeout(1200);
  ok('toggle off in October: back to following the calendar (off)', !(await state(p)).on);
  await ctx.close();
}

// ---- the address overrides the calendar in the preview
for (const [at, q, want, label] of [['2026-10-20T12:00:00', '?season=holiday', true, '?season=holiday in October'], ['2026-12-10T12:00:00', '?season=off', false, '?season=off in December']]) {
  const { ctx, p } = await open(at, { query: q });
  const s = await state(p);
  ok(`${label}: the layer is ${want ? 'on' : 'off'}`, s.on === want && s.toggle === want, JSON.stringify(s));
  await p.goto(`${origin}/#/shop`); await p.waitForTimeout(900);
  ok(`${label}: it carries on to the next page`, (await state(p)).on === want);
  await p.goto(`${origin}/?season=auto#/`); await p.waitForTimeout(900);
  ok(`${label}: ?season=auto goes back to the calendar`, (await state(p)).on === !want);
  await ctx.close();
}

// ---- on (December): the pieces, the seal's date, the dust
for (const at of ['2026-11-20T18:00:00', '2026-12-20T18:00:00']) {
  const { ctx, p } = await open(at);
  const s = await p.evaluate(() => {
    const seal = document.querySelector('.claire-cut .hol-seal');
    return { label: seal?.getAttribute('aria-label'), day: seal?.querySelector('b')?.textContent, draft: !!seal?.querySelector('.d b'), row: document.querySelector('.soon-list [data-drop-date]')?.textContent, iso: seal?.dataset.date };
  });
  const short = s.row ? new Date(`${s.iso}T12:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' }).replace('.', '') : '';
  ok(`${at.slice(0, 10)}: the seal on Claire's arch shows the computed next Moon Drop (the same date as the Moon Drops row), as a draft`, s.label === `Next Moon Drop: ${s.row}` && s.day === short && s.draft, JSON.stringify(s));
  await ctx.close();
}
{
  const { ctx, p } = await open('2026-12-10T19:00:00');
  const d = await p.evaluate(() => {
    const leafD = el => [...el.querySelectorAll('*')].filter(x => x.children.length === 0 && x.textContent.trim()).every(x => x.closest('.d'));
    const flag = sel => { const f = document.querySelector(sel); return f ? { t: f.textContent.trim(), d: leafD(f), pe: getComputedStyle(f).pointerEvents } : null; };
    return {
      bar: document.querySelector('.announce .an-live .hol-stub .hol-stub-t')?.textContent, moon: flag('.soon-list a[href$="drops"] > .hol-flag'), gift: flag('.gift-grid .hol-flag'),
      seal: leafD(document.querySelector('.hol-seal')), sealPe: getComputedStyle(document.querySelector('.hol-seal')).pointerEvents,
    };
  });
  ok('on: free shipping sits in a ticket stub in the announcement bar, in its own words', d.bar === 'Free shipping on Canadian orders over $75', d.bar);
  ok('on: the Moon Drops row has a "Next new moon" ribbon flag, a draft', d.moon?.t === 'Next new moon' && d.moon.d && d.moon.pe === 'none', JSON.stringify(d.moon));
  ok('on: the Send a Sunrise card has a "Gift it" ribbon flag, a draft', d.gift?.t === 'Gift it' && d.gift.d && d.gift.pe === 'none', JSON.stringify(d.gift));
  ok('on: the seal\'s words are drafts and it takes no taps', d.seal && d.sealPe === 'none');

  // nothing covers words: flags and seal against the text around them; the dust is behind everything and never hit by a tap
  const cover = await p.evaluate(() => {
    const textRects = root => { const out = []; const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); for (let t = tw.nextNode(); t; t = tw.nextNode()) { if (!t.textContent.trim() || t.parentElement.closest('.hol-flag, .hol-seal, .hol-stub')) continue; const r = document.createRange(); r.selectNodeContents(t); out.push(...r.getClientRects()); } return out; };
    const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const hits = [];
    for (const [sel, host] of [['.soon-list a[href$="drops"] > .hol-flag', '.soon-list'], ['.gift-grid .hol-flag', '.giftsec'], ['.hol-seal', '.claire']]) {
      const el = document.querySelector(sel); el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect(); textRects(document.querySelector(host)).forEach(t => { if (hit(r, t)) hits.push(`${sel} over "${t.width}x${t.height}"`); });
    }
    return hits;
  });
  ok('on: the ribbon flags and the seal cover no words', cover.length === 0, cover.join('; '));
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(700);
  const dust = await p.evaluate(() => {
    const el = document.querySelector('.hol-dust'), cv = el?.querySelector('canvas'), sky = document.getElementById('sky');
    const r = el.getBoundingClientRect(); let hits = 0;
    for (let x = r.left + 8; x < r.right; x += 40) for (let y = Math.max(0, r.top) + 8; y < Math.min(innerHeight, r.bottom); y += 40) { const e = document.elementFromPoint(x, y); if (e && (e === cv || e === el)) hits++; }
    const cs = getComputedStyle(el);
    return { state: el?.dataset.state, canvas: !!cv, pe: cs.pointerEvents, z: cs.zIndex, afterSky: el.previousElementSibling === sky, hits, w: cv?.width, cw: cv?.clientWidth };
  });
  ok('on: the gold dust runs in the home sky', dust.state === 'running' && dust.canvas, JSON.stringify(dust));
  ok('on: it sits behind the hero\'s words and buttons and never takes a tap', dust.pe === 'none' && dust.z === '-1' && dust.afterSky && dust.hits === 0, JSON.stringify(dust));
  // it has drawn something
  const lit = await p.evaluate(() => { const c = document.querySelector('.hol-dust canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 30) n++; return n; });
  ok('on: the trail is drawn (gold particles on the canvas)', lit > 50, String(lit));
  await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(600);
  ok('on: the dust pauses while the hero is off screen', await p.evaluate(() => document.querySelector('.hol-dust').dataset.state) === 'paused');
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(600);
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  ok('on: the dust pauses while the tab is hidden', await p.evaluate(() => document.querySelector('.hol-dust').dataset.state) === 'paused');
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  ok('on: and runs again when the tab comes back', await p.evaluate(() => document.querySelector('.hol-dust').dataset.state) === 'running');
  // contrast: the cranberry button
  const con = await p.evaluate(() => {
    const rgb = s => s.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number), L = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
    const ratio = (a, b) => { const x = L(rgb(a)), y = L(rgb(b)); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const btn = getComputedStyle(document.querySelector('.moment-shop .btn:not(.line)'));
    const ch = document.querySelector('.giftsec .chapter'), chc = getComputedStyle(ch).color;
    return { btn: ratio(btn.backgroundColor, btn.color), bg: btn.backgroundColor, chapter: ratio(chc, 'rgb(241, 220, 210)') };
  });
  ok('on: buttons turn cranberry and keep AA contrast; chapter labels stay AA on their ground', con.bg === 'rgb(122, 31, 31)' && con.btn >= 4.5 && con.chapter >= 4.5, JSON.stringify(con));

  // the giving line: product page and cart
  await p.goto(`${origin}/#/product/cabana`); await p.waitForSelector('#addBtn:not([disabled])'); await p.waitForTimeout(400);
  const pg = await p.evaluate(() => { const s = document.querySelector('.buy .hol-stub.give'); return s ? { t: s.textContent.trim(), d: !!s.querySelector('.d'), next: s.nextElementSibling?.classList.contains('gv-note') } : null; });
  ok('on: a "$1 to BC Children\'s" stub sits beside the giving line on the product page, as a draft', pg?.t === "$1 to BC Children's" && pg.d && pg.next, JSON.stringify(pg));
  await p.click('#addBtn'); await p.waitForTimeout(300); await p.click('#cartBtn'); await p.waitForSelector('.drawer .gv-note');
  const cs = await p.evaluate(() => { const s = document.querySelector('.drawer .hol-stub.give'); return s ? { t: s.textContent.trim(), d: !!s.querySelector('.d'), next: s.nextElementSibling?.classList.contains('gv-note') } : null; });
  ok('on: and in the cart, beside its giving line', cs?.t === "$1 to BC Children's" && cs.d && cs.next, JSON.stringify(cs));
  await ctx.close();
}

// ---- reduced motion: no trail
{
  const { ctx, p } = await open('2026-12-10T19:00:00', { reducedMotion: 'reduce' });
  const r = await p.evaluate(() => ({ state: document.querySelector('.hol-dust')?.dataset.state, canvas: document.querySelectorAll('.hol-dust canvas').length, on: document.body.classList.contains('season-holiday') }));
  ok('reduced motion: the layer is on but no gold dust is drawn or animated', r.on && r.state === 'still' && r.canvas === 0, JSON.stringify(r));
  await ctx.close();
}
// ---- pixel ratio capped
{
  const { ctx, p } = await open('2026-12-10T19:00:00', { scale: 3, vp: { width: 1024, height: 800 } });
  const c = await p.evaluate(() => { const c = document.querySelector('.hol-dust canvas'); return { w: c.width, cw: c.clientWidth }; });
  ok('a 3x screen: the dust canvas is capped at 1.5x', c.w <= Math.ceil(c.cw * 1.5) + 1, JSON.stringify(c));
  await ctx.close();
}

// ---- every width, on and off: no sideways scroll; the orb is where it always is and nothing of the layer covers it
for (const w of [1440, 1024, 768, 390, 360]) {
  const vp = { width: w, height: w < 500 ? 800 : 900 };
  const orb = {};
  for (const at of ['2026-10-20T18:00:00', '2026-12-10T18:00:00']) {
    const on = at.startsWith('2026-12');
    for (const route of ['/', '/gift', '/product/cabana']) {
      const { ctx, p } = await open(at, { vp, route });
      if (route === '/') {
        await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } scrollTo(0, 0); });
        await p.waitForTimeout(500);
        // (where it is placed, not where it is mid-tuck: it tucks away while the page scrolls)
        orb[on ? 'on' : 'off'] = await p.evaluate(() => { const o = document.querySelector('.breathorb'); if (!o) return null; const c = getComputedStyle(o); return [c.position, c.right, c.bottom, c.width, c.height, c.zIndex].join(','); });
        if (on) {
          const over = await p.evaluate(() => {
            const o = document.querySelector('.breathorb')?.getBoundingClientRect(); if (!o) return [];
            return [...document.querySelectorAll('.hol-flag, .hol-seal, .hol-stub')].filter(el => { const r = el.getBoundingClientRect(); return r.left < o.right && o.left < r.right && r.top < o.bottom && o.top < r.bottom; }).map(el => el.className);
          });
          ok(`${w}px on: no holiday piece sits over the breathing orb`, over.length === 0, over.join(' '));
          const taps = await p.evaluate(() => [...document.querySelectorAll('.hol-flag, .hol-seal, .hol-stub, .hol-dust')].filter(el => getComputedStyle(el).pointerEvents !== 'none' && el.closest('a, button')).length);
          ok(`${w}px on: the layer adds no new tap targets (its pieces take no taps inside links)`, taps === 0, String(taps));
        }
      }
      ok(`${w}px ${on ? 'on' : 'off'} ${route}: no sideways scroll`, (await noScroll(p)) <= 1);
      await ctx.close();
    }
  }
  ok(`${w}px: the breathing orb is in the same place with the layer on and off`, orb.on === orb.off, `${orb.on} | ${orb.off}`);
}

ok('no JS errors', allErrs.length === 0, allErrs.join(' | ').slice(0, 300));
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
