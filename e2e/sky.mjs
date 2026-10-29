// The Scent Sky (Find your scent > Scent Sky): the ten families of the owner's list as constellations; a family shows its
// scents; a scent lights up in every family it belongs to and opens a panel with its formats, each a live product (with
// Wix's price) or "Coming soon". Keyboard and screen reader: real buttons with names, visible focus, Escape closes.
// Reduced motion, 44px targets and no sideways scroll from 360 to 1440. Also takes the screenshots in /tmp/pro-shots/sky.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const shots = process.env.SHOTS ?? '/tmp/pro-shots/sky';
fs.mkdirSync(shots, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const S = new URL('.', import.meta.url).pathname;
const catalogue = JSON.parse(fs.readFileSync(S + 'products.json', 'utf8')).products;

// the owner's list, read from the source (one copy of it)
const hrefSlug = h => (h ?? '').replace(/^#?\/?product\//, '');
const key = s => s.toLowerCase().replace(/\s*\+\s*/g, ' & ').replace(/\band\b/g, '&').replace(/\s*&\s*/g, ' & ').replace(/\s+/g, ' ').trim();
const LABEL = { fruity: 'Fruity', green: 'Green', marine: 'Marine Ozonic', floral: 'Floral', aromatic: 'Aromatic', woody: 'Woody', amber: 'Amber', gourmand: 'Gourmand', spicy: 'Spicy', citrus: 'Citrus' };
const BY_LABEL = Object.fromEntries(Object.entries(LABEL).map(([k, v]) => [v, k]));
const LIST = fs.readFileSync(S + '../src/data/scents.ts', 'utf8').match(/const LIST = `([\s\S]*?)`;/)[1].trim().split('\n').map(r => {
  const [name, fams, fmts] = r.split('|').map(x => x.trim());
  return { name, id: key(name).replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), families: fams.split(',').map(x => BY_LABEL[x.trim()]), formats: fmts.split(/\s+/).map(c => ({ C: 'candle', D: 'diffuser', R: 'roller' })[c]) };
});
const formatOf = n => /fragrance roller$/i.test(n) ? 'roller' : /mini diffuser$/i.test(n) ? 'diffuser' : /deodorant/i.test(n) ? 'deodorant' : 'candle';
const scentOf = n => n.replace(/\s*(fragrance roller|mini diffuser)$/i, '').trim();
const live = (scent, format) => catalogue.find(p => formatOf(p.name) === format && key(scentOf(p.name)) === key(scent));
ok('the list has 28 scents in 10 families', LIST.length === 28 && new Set(LIST.flatMap(s => s.families)).size === 10 && LIST.every(s => s.families.every(Boolean)));

const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Vancouver' });
const p = await ctx.newPage(); p.setDefaultTimeout(10000); await setupMocks(p);
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(base + '/explore'); await p.waitForSelector('.ssky .sf-btn'); await p.waitForTimeout(400);

// ---------- level 1: the families ----------
const fams = await p.evaluate(() => [...document.querySelectorAll('.sf-btn')].map(b => ({ f: b.dataset.family, name: b.getAttribute('aria-label'), tag: b.tagName, n: b.querySelectorAll('.sd').length })));
ok('ten families, in the owner\'s order, each a real button', fams.length === 10 && fams.map(x => x.f).join() === 'fruity,green,marine,floral,aromatic,woody,amber,gourmand,spicy,citrus' && fams.every(x => x.tag === 'BUTTON'), fams.map(x => x.f).join());
ok('each family button is named with its family and its number of scents', fams.every(x => x.name.startsWith(LABEL[x.f]) && x.name.includes(`${LIST.filter(s => s.families.includes(x.f)).length} scent`)), fams.map(x => x.name).join(' | '));
ok('each family chart has one star per scent in it', fams.every(x => x.n === LIST.filter(s => s.families.includes(x.f)).length));
ok('the tabs and labels say "Scent Sky" (no "atlas" or "wheel")', await p.evaluate(() => /Scent Sky/.test(document.querySelector('.findtabs').textContent) && !/atlas|scent wheel/i.test(document.querySelector('#app').innerText)));
await p.screenshot({ path: `${shots}/1440-sky-default.png` });

// ---------- level 2: a family's scents ----------
await p.click('.sf-btn[data-family="marine"]'); await p.waitForSelector('.ssf-list'); await p.waitForTimeout(500);
const marine = await p.evaluate(() => ({ list: [...document.querySelectorAll('.ss-btn')].map(b => b.dataset.scent), focus: document.activeElement?.id, pressed: document.querySelector('.sf-btn[data-family="marine"]').getAttribute('aria-pressed'), allHidden: document.querySelector('.ssky-all').hidden }));
ok('choosing Marine Ozonic shows its 3 scents as buttons, and moves focus to its heading', marine.list.join() === 'cabana,sea-foam,windy-beach' && marine.focus === 'sskyFamH' && marine.allHidden, JSON.stringify(marine));
for (const f of Object.keys(LABEL)) {
  await p.evaluate(fk => { const sb = document.querySelector('.ssf-back'); if (sb) sb.click(); document.querySelector(`.sf-btn[data-family="${fk}"]`).click(); }, f);
  await p.waitForTimeout(80);
  const got = await p.evaluate(() => [...document.querySelectorAll('.ss-btn')].map(b => [b.dataset.scent, b.getAttribute('aria-label')]));
  const want = LIST.filter(s => s.families.includes(f));
  if (got.length !== want.length || got.some(([id], i) => id !== want[i].id) || got.some(([, l]) => !l || l.length < 4)) ok(`family ${f} lists exactly its scents`, false, JSON.stringify(got));
}
ok('every family lists exactly its scents from the list, each a named button', true);
await p.evaluate(() => document.querySelector('.ssf-back')?.click());
await p.click('.sf-btn[data-family="woody"]'); await p.waitForTimeout(700);
await p.screenshot({ path: `${shots}/1440-sky-family-woody.png` });

// ---------- a scent: cross-highlighting and the panel ----------
await p.click('.ss-btn[data-scent="windy-beach"]'); await p.waitForSelector('.ssp-scent'); await p.waitForTimeout(900);
const wb = await p.evaluate(() => ({
  lit: [...document.querySelectorAll('.sf.lit')].map(x => x.dataset.family), stars: [...document.querySelectorAll('.sd.on')].map(c => c.closest('.sf').dataset.family),
  dim: document.querySelectorAll('.sf.dim').length, thread: !!document.querySelector('.ssky-threads .st-path'), focus: document.activeElement?.id,
  fams: [...document.querySelectorAll('.ssp-fam')].map(b => b.dataset.family), rows: [...document.querySelectorAll('.ssp-fmt')].map(li => ({ f: li.dataset.format, href: li.querySelector('a')?.getAttribute('href') ?? null, text: li.textContent.replace(/\s+/g, ' ').trim() })),
}));
ok('Windy Beach glows in Marine Ozonic, Woody, Citrus, Floral and Amber, and only there', wb.lit.sort().join() === 'amber,citrus,floral,marine,woody' && wb.stars.sort().join() === 'amber,citrus,floral,marine,woody' && wb.dim === 5, JSON.stringify(wb));
ok('a thread is drawn between its stars, and focus moves to the panel heading', wb.thread && wb.focus === 'sskyScentH');
ok('the panel names its five families as buttons', wb.fams.sort().join() === 'amber,citrus,floral,marine,woody');
const rollerRow = wb.rows.find(r => r.f === 'roller'), diffRow = wb.rows.find(r => r.f === 'diffuser');
ok('Windy Beach roller is live: links to its product page with the Wix price', hrefSlug(rollerRow?.href) === 'windy-beach-fragrance-roller' && /\$25\.00/.test(rollerRow.text), JSON.stringify(rollerRow));
ok('Windy Beach mini diffuser is not in Wix: "Coming soon", no link, no price', diffRow && !diffRow.href && /coming soon/i.test(diffRow.text) && !/\$/.test(diffRow.text), JSON.stringify(diffRow));
ok('the panel lists exactly the formats on the list (no candle for Windy Beach)', wb.rows.map(r => r.f).join() === 'diffuser,roller');
await p.screenshot({ path: `${shots}/1440-sky-windy-beach.png` });

// every scent: the panel matches the list and the live catalogue
const bad = [];
for (const s of LIST) {
  await p.goto(base + `/explore?scent=${s.id}`); await p.waitForSelector('.ssp-scent');
  const r = await p.evaluate(() => ({ lit: [...document.querySelectorAll('.sf.lit')].map(x => x.dataset.family), rows: [...document.querySelectorAll('.ssp-fmt')].map(li => ({ f: li.dataset.format, href: li.querySelector('a')?.getAttribute('href') ?? null, text: li.textContent })) }));
  if (r.lit.sort().join() !== [...s.families].sort().join()) bad.push(`${s.name}: lit ${r.lit}`);
  if (r.rows.map(x => x.f).join() !== ['candle', 'diffuser', 'roller'].filter(f => s.formats.includes(f)).join()) bad.push(`${s.name}: formats ${r.rows.map(x => x.f)}`);
  for (const row of r.rows) {
    const pr = live(s.name, row.f);
    if (pr && hrefSlug(row.href) !== pr.slug) bad.push(`${s.name} ${row.f}: ${row.href} vs ${pr.slug}`);
    if (pr && !row.text.includes(`$${Number(pr.actualPriceRange.minValue.amount).toFixed(2)}`)) bad.push(`${s.name} ${row.f}: price ${row.text}`);
    if (!pr && (row.href || /\$/.test(row.text) || !/coming soon/i.test(row.text))) bad.push(`${s.name} ${row.f}: should be coming soon (${row.text})`);
  }
}
ok('every scent: lit in exactly its families, its list formats, live ones linked with the Wix price, the rest "Coming soon"', bad.length === 0, bad.slice(0, 5).join('; '));
const liveN = LIST.reduce((n, s) => n + s.formats.filter(f => live(s.name, f)).length, 0), allN = LIST.reduce((n, s) => n + s.formats.length, 0);
console.log(`(${liveN} of ${allN} scent formats are in the captured Wix catalogue; ${allN - liveN} show as Coming soon)`);
ok('"Amber + Rose" in Wix is the Amber & Rose candle', await (async () => { await p.goto(base + '/explore?scent=amber-rose'); await p.waitForSelector('.ssp-scent'); return ((await p.locator('.ssp-fmt[data-format="candle"] a').getAttribute('href')) ).replace(/^#?\/?product\//, '') === 'amber-rose-need-pics'; })());

// a coming-soon scent
await p.goto(base + '/explore?scent=forest-bathing'); await p.waitForSelector('.ssp-scent'); await p.waitForTimeout(900);
const fb = await p.evaluate(() => ({ text: document.querySelector('.ssky-panel').innerText, links: document.querySelectorAll('.ssky-panel a[href*="product"]').length, add: document.querySelectorAll('.ssky-panel [data-qa], .ssky-panel [data-add]').length }));
ok('a coming-soon scent (Forest Bathing): every format "Coming soon", no price, no product link, no add to cart', fb.links === 0 && fb.add === 0 && !/\$\d/.test(fb.text) && (fb.text.match(/coming soon/gi) ?? []).length >= 3, fb.text.slice(0, 160));
await p.locator('.ssky-panel').scrollIntoViewIfNeeded();
await p.screenshot({ path: `${shots}/1440-sky-coming-soon-panel.png` });

// a live product link opens a page that renders
await p.goto(base + '/explore?scent=citrus-sun'); await p.waitForSelector('.ssp-scent');
await p.click('.ssp-fmt[data-format="candle"] a'); await p.waitForSelector('#addBtn');
ok('a live format opens its product page, which renders with its families', /citrus/i.test(await p.locator('#app h1').first().innerText()) && /Citrus/i.test(await p.locator('.p-fams').innerText()) && /Spicy/i.test(await p.locator('.p-fams').innerText()));

// old mood links land somewhere sensible
await p.goto(base + '/explore?mood=woody'); await p.waitForSelector('.ssf-list');
ok('an old ?mood= address opens a family', (await p.locator('#sskyFamH').innerText()) === 'Woody');

// ---------- keyboard ----------
await p.goto(base + '/explore'); await p.waitForSelector('.sf-btn');
await p.focus('.sf-btn[data-family="citrus"]'); await p.keyboard.press('Enter'); await p.waitForTimeout(200);
ok('keyboard: Enter on a family opens it and focuses its heading', await p.evaluate(() => document.activeElement?.id === 'sskyFamH'));
await p.keyboard.press('Tab');
const first = await p.evaluate(() => ({ cls: document.activeElement?.className, outline: getComputedStyle(document.activeElement).outlineStyle, w: getComputedStyle(document.activeElement).outlineWidth }));
let guard = 0; while (!(await p.evaluate(() => document.activeElement?.classList.contains('ss-btn'))) && guard++ < 5) await p.keyboard.press('Tab');
const sid = await p.evaluate(() => document.activeElement?.dataset.scent);
const ring = await p.evaluate(() => getComputedStyle(document.activeElement).outlineStyle !== 'none' && parseFloat(getComputedStyle(document.activeElement).outlineWidth) >= 2);
ok('keyboard: focus is visible on the scent buttons', !!sid && ring, JSON.stringify(first));
await p.keyboard.press('Enter'); await p.waitForTimeout(200);
ok('keyboard: Enter on a scent opens its panel and focuses the scent name', await p.evaluate(() => document.activeElement?.id === 'sskyScentH' && !!document.querySelector('.ssp-scent')));
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
ok('Escape closes the panel and returns focus to the scent it came from', await p.evaluate(s => !document.querySelector('.ssp-scent') && document.activeElement?.dataset.scent === s && document.activeElement.classList.contains('ss-btn'), sid));
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
ok('a second Escape goes back to the whole sky, focus on the family', await p.evaluate(() => document.querySelector('.ssky').dataset.view === 'all' && document.activeElement?.dataset.family === 'citrus'));
const fv = await p.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; });
ok('focus on a family button is visible', fv);

// ---------- 44px targets ----------
await p.goto(base + '/explore?scent=windy-beach'); await p.waitForSelector('.ssp-scent');
const small1 = await p.evaluate(() => [...document.querySelectorAll('.sf-btn, .ssp-fam, .ssp-close, .ssp-fmts a, .ssp .btn')].filter(e => { const r = e.getBoundingClientRect(); return r.width && (r.height < 43.5 || r.width < 43.5); }).map(e => e.className));
await p.goto(base + '/explore?family=amber'); await p.waitForSelector('.ss-btn');
const small2 = await p.evaluate(() => [...document.querySelectorAll('.ss-btn, .ssf-back')].filter(e => { const r = e.getBoundingClientRect(); return r.height < 43.5 || r.width < 43.5; }).map(e => e.className));
ok('every family, scent, chip, link and close button is at least 44px', !small1.length && !small2.length, [...small1, ...small2].join(', '));

// ---------- reduced motion ----------
const rm = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); const q = await rm.newPage(); await setupMocks(q);
await q.goto(base + '/explore?scent=windy-beach'); await q.waitForSelector('.ssp-scent'); await q.waitForTimeout(300);
const anims = await q.evaluate(() => document.querySelector('.ssky').getAnimations({ subtree: true }).filter(a => a.playState === 'running').length);
const drawn = await q.evaluate(() => getComputedStyle(document.querySelector('.st-path')).strokeDashoffset);
ok('reduced motion: nothing twinkles, turns or draws itself; the threads are complete', anims === 0 && /^0(px)?$/.test(drawn), `${anims} running, offset ${drawn}`);
await rm.close();

// ---------- no sideways scroll ----------
for (const w of [360, 390, 768, 1024, 1440]) {
  const c = await b.newContext({ viewport: { width: w, height: 860 }, isMobile: w < 500, hasTouch: w < 500 }); const r = await c.newPage(); await setupMocks(r);
  const over = [];
  for (const route of ['/explore', '/explore?family=amber', '/explore?scent=windy-beach', '/explore?scent=forest-bathing']) {
    await r.goto(base + route); await r.waitForSelector('.ssky'); await r.waitForTimeout(400);
    const o = await r.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (o > 1) over.push(`${route} ${o}px`);
  }
  ok(`${w}px: no sideways scroll in any view`, over.length === 0, over.join(', '));
  if (w === 390) {
    await r.goto(base + '/explore'); await r.waitForSelector('.sf-btn'); await r.waitForTimeout(600); await r.screenshot({ path: `${shots}/390-sky-default.png` });
    await r.click('.sf-btn[data-family="woody"]'); await r.waitForTimeout(700); await r.locator('.ssky-stage').scrollIntoViewIfNeeded(); await r.screenshot({ path: `${shots}/390-sky-family-woody.png` });
    await r.click('.ss-btn[data-scent="windy-beach"]'); await r.waitForTimeout(1000); await r.screenshot({ path: `${shots}/390-sky-windy-beach-panel.png` });
    await r.evaluate(() => document.querySelector('.ssky-stage').scrollIntoView({ block: 'start' })); await r.waitForTimeout(300); await r.screenshot({ path: `${shots}/390-sky-windy-beach-glow.png` });
  }
  await c.close();
}

// ---------- the other screenshots the brief asks for: the shop's family chips, a quiz result ----------
for (const [w, mobile] of [[1440, false], [390, true]]) {
  const c = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: mobile, hasTouch: mobile }); const r = await c.newPage(); await setupMocks(r);
  await r.goto(base + '/shop?f=all&fam=woody&s=featured'); await r.waitForSelector('.scard'); await r.waitForTimeout(600);
  await r.locator('.toolbar').scrollIntoViewIfNeeded(); await r.screenshot({ path: `${shots}/${w}-shop-family-chips.png` });
  await c.close();
}
{
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } }); const r = await c.newPage(); await setupMocks(r);
  await r.goto(base + '/explore?tab=quiz'); await r.waitForSelector('[data-ans]');
  for (const i of [4, 4, 0, 4]) await r.locator('[data-ans]').nth(i).click();
  await r.waitForSelector('.qres'); await r.waitForTimeout(500); await r.screenshot({ path: `${shots}/1440-quiz-result.png`, fullPage: true });
  await c.close();
}
ok('no page errors', errs.length === 0, errs.join('; '));
await b.close();
const fails = res.filter(x => !x).length; console.log(fails ? `\n${fails} FAIL` : '\nall pass'); process.exit(fails ? 1 : 0);
