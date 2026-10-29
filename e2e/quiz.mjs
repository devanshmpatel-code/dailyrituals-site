// The scent quiz (Find your scent > Take the quiz): the questions, and every one of the 5 x 5 x 5 x 5 = 625 ways to answer them.
// Every option points to scent families of the owner's list (src/data/scents.ts). For each path: a result always appears; it
// names the family the answers score highest (each family's points evened out by how many the quiz can give it, so small
// families win fairly; a tie goes to the latest answer's strongest tied family); the best match is a scent in that family that
// can be bought today, in the format the first answer asks for when the shop has it; every product it offers is real (in the
// captured catalogue), in stock and on the list; and every product the results link to opens a product page that renders.
// Prints the distribution by family and by scent, any scent never recommended, and any path that falls back.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const shots = process.env.SHOTS ?? '/tmp/pro-shots/quiz3';
fs.mkdirSync(shots, { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const S = new URL('.', import.meta.url).pathname;
const catalogue = JSON.parse(fs.readFileSync(S + 'products.json', 'utf8')).products;

// the owner's list, read from the source
const key = s => s.toLowerCase().replace(/\s*\+\s*/g, ' & ').replace(/\band\b/g, '&').replace(/\s*&\s*/g, ' & ').replace(/\s+/g, ' ').trim();
const BY_LABEL = { Fruity: 'fruity', Green: 'green', 'Marine Ozonic': 'marine', Floral: 'floral', Aromatic: 'aromatic', Woody: 'woody', Amber: 'amber', Gourmand: 'gourmand', Spicy: 'spicy', Citrus: 'citrus' };
const LABEL = Object.fromEntries(Object.entries(BY_LABEL).map(([l, k]) => [k, l]));
const FAM = Object.values(BY_LABEL);
const LIST = fs.readFileSync(S + '../src/data/scents.ts', 'utf8').match(/const LIST = `([\s\S]*?)`;/)[1].trim().split('\n').map(r => {
  const [name, fams, fmts] = r.split('|').map(x => x.trim());
  return { name, families: fams.split(',').map(x => BY_LABEL[x.trim()]), formats: fmts.split(/\s+/).map(c => ({ C: 'candle', D: 'diffuser', R: 'roller' })[c]) };
});
const defOf = scent => LIST.find(d => key(d.name) === key(scent));
const scentOf = name => name.replace(/\s*(fragrance roller|mini diffuser|natural deodorant)$/i, '').trim();
const formatOf = name => /fragrance roller$/i.test(name) ? 'roller' : /mini diffuser$/i.test(name) ? 'diffuser' : /deodorant/i.test(name) ? 'deodorant' : 'candle';
// what can be bought today (as the mocked catalogue serves it; live, Wix only shows a visitor visible products): on the list in that format, in stock (a size in stock) and priced
const buyable = new Map(catalogue.filter(p => {
  const d = defOf(scentOf(p.name)), ch = p.options?.[0]?.choicesSettings?.choices ?? [];
  return d && d.formats.includes(formatOf(p.name)) && p.inventory.availabilityStatus !== 'OUT_OF_STOCK' && Number(p.actualPriceRange?.minValue?.amount) > 0 && (!ch.length || ch.some(c => c.inStock !== false));
}).map(p => [p.slug, { slug: p.slug, name: p.name, scent: defOf(scentOf(p.name)).name, format: formatOf(p.name), families: defOf(scentOf(p.name)).families }]));

// the answers, by question and option (the order the quiz shows them): family weights, and the first question's format
const W = [
  [{ citrus: 2, green: 1, marine: 1 }, { marine: 2, fruity: 1, citrus: 1 }, { spicy: 2, gourmand: 2, citrus: 1 }, { woody: 2, amber: 2, spicy: 1 }, { floral: 2, amber: 1, aromatic: 1 }],
  [{ marine: 3, citrus: 1 }, { fruity: 2, marine: 1, gourmand: 1 }, { floral: 2, green: 2, fruity: 1 }, { woody: 2, spicy: 1, amber: 1 }, { green: 2, aromatic: 2, woody: 1 }],
  [{ marine: 2, green: 1, aromatic: 1 }, { citrus: 2, fruity: 2 }, { floral: 2, gourmand: 1, amber: 1 }, { woody: 2, amber: 1, spicy: 1 }, { aromatic: 2, green: 1, spicy: 1 }],
  [{ citrus: 2, marine: 1, green: 1 }, { fruity: 2, gourmand: 2 }, { floral: 2, amber: 1, gourmand: 1 }, { amber: 2, woody: 1, gourmand: 1 }, { aromatic: 2, green: 1, woody: 1 }],
];
const FMT = ['diffuser', 'roller', 'roller', 'candle', 'candle'];
const prior = Object.fromEntries(FAM.map(f => [f, W.flat().reduce((n, o) => n + (o[f] ?? 0), 0)]));
const mean = FAM.reduce((n, f) => n + prior[f], 0) / FAM.length;
const expected = a => {
  const v = Object.fromEntries(FAM.map(f => [f, 0]));
  a.forEach((o, q) => Object.entries(W[q][o]).forEach(([f, w]) => { v[f] += w * mean / prior[f]; }));
  const max = Math.max(...FAM.map(f => v[f])), tied = FAM.filter(f => Math.abs(v[f] - max) < 1e-9);
  let fam; for (let q = 3; q >= 0 && !fam; q--) fam = Object.entries(W[q][a[q]]).sort((x, y) => y[1] - x[1]).map(([f]) => f).find(f => tied.includes(f));
  return { fam: fam ?? tied[0], tied, v };
};
const sellable = LIST.filter(d => [...buyable.values()].some(x => x.scent === d.name));
console.log(`(${sellable.length} scents can be bought in the captured catalogue: ${sellable.map(d => d.name).join(', ')})`);

const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Vancouver' });
const p = await ctx.newPage(); p.setDefaultTimeout(10000); await setupMocks(p);
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(base + '/explore?tab=quiz'); await p.waitForSelector('[data-ans]');

// ---------- the questions ----------
const question = () => p.evaluate(() => ({ q: document.querySelector('.panel h2')?.textContent?.trim(), opts: [...document.querySelectorAll('[data-ans]')].map(x => x.textContent.trim()) }));
const q1 = await question();
ok('Q1 asks "When do you want a pick-me-up?"', q1.q === 'When do you want a pick-me-up?', q1.q);
ok('Q1 options, in order', JSON.stringify(q1.opts) === JSON.stringify(['First thing, before the inbox opens', 'Heading out the door into the day', 'That 3 pm slump', 'When work ends and the evening starts', 'Winding down before bed']), q1.opts.join(' | '));
ok('Q1 is new wording, marked as a draft', await p.evaluate(() => document.querySelectorAll('.panel h2 .d, [data-ans] .d').length === 6));
await p.locator('[data-ans]').first().click();
const q2 = await question();
ok('Q2 has "In the middle of a forest" (and no "quiet room")', q2.q === 'Which place feels most like you?' && q2.opts.includes('In the middle of a forest') && !q2.opts.some(o => /quiet room/i.test(o)) && q2.opts.length === 5, q2.opts.join(' | '));
await p.locator('[data-ans]').first().click();
const q3 = await question();
ok('Q3 keeps its wording', q3.q === 'Pick a weekend plan' && q3.opts.join('|') === 'A swim and a long walk|A patio and something cold to drink|Flowers, a book and a bath|A campfire with friends|Stretching, tea and no phone', q3.opts.join(' | '));
await p.locator('[data-ans]').first().click();
const q4 = await question();
ok('Q4 keeps its wording', q4.q === 'How should it make you feel?' && q4.opts.join('|') === 'Bright and clean|Warm and playful|Soft and romantic|Cosy and rooted|Calm and centred', q4.opts.join(' | '));
await p.locator('[data-ans]').first().click();
ok('the answers lead to a result', (await p.locator('.qres').count()) === 1);
ok('"In the middle of a forest" points to Woody, Green and Aromatic', ['woody', 'green', 'aromatic'].every(f => W[1][4][f] > 0) && Object.keys(W[1][4]).length === 3);

// ---------- all 625 paths ----------
const t0 = Date.now();
await p.goto(base + '/explore?tab=quiz'); await p.waitForSelector('[data-ans]');
const recs = await p.evaluate(() => {
  const out = [];
  for (let n = 0; n < 625; n++) {
    const a = [Math.floor(n / 125) % 5, Math.floor(n / 25) % 5, Math.floor(n / 5) % 5, n % 5];
    for (const i of a) { const btn = document.querySelectorAll('[data-ans]')[i]; if (!btn) { out.push({ a, none: true }); break; } btn.click(); }
    const q = document.querySelector('.qres');
    if (!q) { out.push({ a, none: true }); continue; }
    const href = e => e?.getAttribute('href');
    out.push({
      a, fam: q.dataset.family, scent: q.dataset.scent, lead: q.dataset.lead, format: q.dataset.format, fallback: q.dataset.fallback, title: q.querySelector('.qres-head h2')?.textContent,
      leadHref: href(q.querySelector('#qLead')), leadText: q.querySelector('#qLead')?.textContent?.trim(), photoHref: href(q.querySelector('.qbest-ph')),
      fmts: [...q.querySelectorAll('.qbest-fmts a')].map(href), shopHref: href([...q.querySelectorAll('#qCta a')].find(x => /^Shop /.test(x.textContent))),
      skyHref: href([...q.querySelectorAll('#qCta a')].find(x => /Scent Sky/.test(x.textContent))),
      cards: [...q.querySelectorAll('#qGrid .card')].map(c => ({ fams: c.dataset.families, format: c.dataset.format, href: href(c.querySelector('a')) })),
    });
    document.querySelector('#qAgain').click();
  }
  return out;
});
console.log(`(walked ${recs.length} paths in ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
ok('625 distinct answer combinations were walked', recs.length === 625 && new Set(recs.map(r => r.a.join(''))).size === 625);
ok('a result always appears', recs.every(r => !r.none), `${recs.filter(r => r.none).length} without one`);
const slugOf = h => (h ?? '').replace(/^#?\/?product\//, '');
const bad = [], fallbacks = [];
const flag = (r, why) => bad.push(`${r.a.join('')}: ${why}`);
for (const r of recs.filter(x => !x.none)) {
  const e = expected(r.a);
  if (r.fam !== e.fam) flag(r, `family ${r.fam}, expected ${e.fam}`);
  if (!r.title?.includes(LABEL[e.fam])) flag(r, `heading says "${r.title}"`);
  const lead = buyable.get(slugOf(r.lead));
  if (r.fallback) fallbacks.push(`${r.a.join('')} ${r.fallback} (${r.fam} → ${r.scent} ${r.format})`);
  if (!lead) { flag(r, `best match ${r.lead} is not a buyable product`); continue; }
  if (!lead.families.includes(e.fam) && r.fallback !== 'family') flag(r, `best match ${lead.name} is not ${e.fam}`);
  if (lead.scent !== r.scent) flag(r, `best match scent ${r.scent} vs product ${lead.scent}`);
  // the best match is the closest sellable scent in the family (match = sum of its families' scores / sqrt(count))
  const m = d => d.families.reduce((n, f) => n + e.v[f], 0) / Math.sqrt(d.families.length);
  const pool = sellable.filter(d => d.families.includes(e.fam)), top = Math.max(...pool.map(m));
  if (pool.length && Math.abs(m(defOf(lead.scent)) - top) > 1e-9) flag(r, `${lead.scent} is not the closest ${e.fam} scent`);
  // the format: the one the first answer asks for, when the scent comes in it
  const want = FMT[r.a[0]], has = [...buyable.values()].filter(x => x.scent === lead.scent).map(x => x.format);
  if (has.includes(want) ? lead.format !== want : r.fallback !== 'format' && r.fallback !== 'family') flag(r, `format ${lead.format}, wanted ${want} (has ${has})`);
  if (slugOf(r.leadHref) !== r.lead || r.photoHref !== r.leadHref) flag(r, `button opens ${r.leadHref}, photo ${r.photoHref}`);
  if (!r.leadText?.toLowerCase().includes(lead.scent.toLowerCase()) || !new RegExp(lead.format === 'diffuser' ? 'mini diffuser' : lead.format, 'i').test(r.leadText)) flag(r, `button says "${r.leadText}" but opens ${lead.name}`);
  for (const h of r.fmts) { const x = buyable.get(slugOf(h)); if (!x || x.scent !== r.scent) flag(r, `format link ${h} is not ${r.scent}`); }
  if (r.fmts.length !== has.length) flag(r, 'not every format of the best match is offered');
  if (!new RegExp(`fam=${e.fam}(&|$)`).test(r.shopHref ?? '')) flag(r, `"Shop ..." goes to ${r.shopHref}`);
  if (!/scent=/.test(r.skyHref ?? '')) flag(r, `"See it in the Scent Sky" goes to ${r.skyHref}`);
  for (const c of r.cards) { const x = buyable.get(slugOf(c.href)); if (!x) flag(r, `card ${c.href} is not buyable`); else if (!x.families.includes(e.fam)) flag(r, `card ${x.name} is not ${e.fam}`); }
  if (new Set([r.lead, ...r.fmts.map(slugOf), ...r.cards.map(c => slugOf(c.href))]).size !== new Set(r.fmts.map(slugOf)).size + r.cards.length) flag(r, 'a product is offered twice');
}
ok('every path: the winning family is the highest evened-out score (ties to the latest answer\'s strongest tied family)', !bad.some(x => /family |heading/.test(x)), bad.filter(x => /family |heading/.test(x)).slice(0, 3).join('; '));
ok('every path: the best match is a buyable scent in that family, the closest one to the answers', !bad.some(x => /not a buyable|is not [a-z]+$|closest|scent /.test(x)), bad.filter(x => /not a buyable|is not [a-z]+$|closest|scent /.test(x)).slice(0, 3).join('; '));
ok('every path: the format is the one the first answer asks for whenever the scent comes in it', !bad.some(x => /format /.test(x)), bad.filter(x => /format /.test(x)).slice(0, 3).join('; '));
ok('every path: the button opens exactly the best match and says its name; links go to the family and the Sky', !bad.some(x => /button|photo|format link|not every format|Shop|Scent Sky/.test(x)), bad.filter(x => /button|photo|format link|Shop|Sky/.test(x)).slice(0, 4).join('; '));
ok('every path: every card is a buyable product in the winning family, none twice', !bad.some(x => /card|twice/.test(x)), bad.filter(x => /card|twice/.test(x)).slice(0, 3).join('; '));
ok('no path broke any other rule', bad.length === 0, bad.slice(0, 5).join('; '));

const tiePaths = recs.filter(r => !r.none && expected(r.a).tied.length > 1);
console.log(`(${tiePaths.length} paths had tied families; each went to the latest answer's strongest tied family)`);
const again = await p.evaluate(() => {
  const out = []; for (const n of [0, 77, 300, 624]) { const a = [Math.floor(n / 125) % 5, Math.floor(n / 25) % 5, Math.floor(n / 5) % 5, n % 5]; for (const i of a) document.querySelectorAll('[data-ans]')[i].click(); out.push(document.querySelector('.qres').dataset.lead); document.querySelector('#qAgain').click(); } return out;
});
ok('the same answers always lead to the same product (ties are deterministic)', again.every((s, i) => s === recs[[0, 77, 300, 624][i]].lead), again.join(', '));

// ---------- the distribution ----------
const tally = k => { const m = new Map(); recs.filter(r => !r.none).forEach(r => m.set(k(r), (m.get(k(r)) ?? 0) + 1)); return [...m].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])); };
const byFam = tally(r => r.fam), byScent = tally(r => r.scent), byLead = tally(r => r.lead), byFmt = tally(r => r.format);
console.log('\nPATHS PER FAMILY   ' + byFam.map(([k, n]) => `${LABEL[k]} ${n}`).join(' · '));
console.log('PATHS PER FORMAT   ' + byFmt.map(([k, n]) => `${k} ${n}`).join(' · '));
console.log('PATHS PER BEST-MATCH SCENT\n' + byScent.map(([k, n]) => `  ${String(n).padStart(3)}  ${k} (${defOf(k).families.map(f => LABEL[f]).join(', ')})`).join('\n'));
console.log('PATHS PER BEST-MATCH PRODUCT (the page the main button opens)\n' + byLead.map(([k, n]) => `  ${String(n).padStart(3)}  ${k}`).join('\n'));
const never = sellable.filter(d => !byScent.some(([k]) => k === d.name)).map(d => d.name);
console.log(`SCENTS NEVER RECOMMENDED: ${never.join(', ') || 'none'}`);
console.log(`FAMILIES THAT NEVER WIN: ${FAM.filter(f => !byFam.some(([k]) => k === f)).map(f => LABEL[f]).join(', ') || 'none'}`);
console.log(`PATHS THAT FALL BACK: ${fallbacks.length}${fallbacks.length ? `\n  ${tally(r => r.fallback || 'none').map(([k, n]) => `${k} ${n}`).join(' · ')}\n  e.g. ${fallbacks.slice(0, 6).join('\n       ')}` : ''}`);
ok('every scent that can be bought is the best match for at least one path', never.length === 0, never.length ? `never: ${never.join(', ')}` : `${sellable.length} scents`);
ok('every family wins at least one path, small ones included (Green, Aromatic, Marine Ozonic, Citrus)', byFam.length === 10, byFam.map(([k]) => k).join());
ok('no path falls back to a scent outside its family', !fallbacks.some(x => / family /.test(x)));

// ---------- every link resolves to a product page that renders ----------
const linked = [...new Set(recs.flatMap(r => [r.lead, ...r.fmts.map(slugOf), ...r.cards.map(c => slugOf(c.href))]))].filter(Boolean);
let rendered = 0; const broken = [];
for (const slug of linked) {
  await p.goto(base + `/product/${slug}`);
  const good = await p.waitForFunction(s => { const h = document.querySelector('#app h1'); return !!h && h.textContent.trim().length > 0 && !!document.querySelector('#addBtn') && (location.pathname + location.hash).includes(s); }, slug, { timeout: 8000 }).then(() => true, () => false);
  const h1 = good ? await p.locator('#app h1').first().innerText() : '';
  const info = buyable.get(slug);
  if (good && info && h1.toLowerCase().includes(info.scent.toLowerCase()) && !(await p.locator('text=/not in the store|not available right now/i').count())) rendered++; else broken.push(`${slug} (${h1 || 'did not render'})`);
}
ok(`all ${linked.length} products the results link to open a live product page that renders (name, price, Add to cart)`, broken.length === 0 && rendered === linked.length, broken.join('; ') || `${rendered} rendered`);

// ---------- through the screen ----------
for (const [label, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const c2 = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, timezoneId: 'America/Vancouver' }); const q = await c2.newPage(); q.setDefaultTimeout(8000); await setupMocks(q);
  const e2 = []; q.on('pageerror', e => e2.push(e.message));
  await q.goto(base + '/explore?tab=quiz'); await q.waitForSelector('[data-ans]');
  await q.screenshot({ path: `${shots}/${vp.width}-quiz-q1.png` });
  for (const i of [3, 4, 3, 3]) await q.locator('[data-ans]').nth(i).click(); // evening, forest, campfire, cosy
  await q.waitForSelector('.qres');
  const e = expected([3, 4, 3, 3]);
  const fam = await q.locator('.qres').getAttribute('data-family');
  ok(`${label}: the result names the expected family (${LABEL[e.fam]}) and its description`, fam === e.fam && /Your scent family/.test(await q.locator('.qres h2').innerText()), fam);
  await q.screenshot({ path: `${shots}/${vp.width}-quiz-result.png`, fullPage: true });
  const lead = await q.locator('.qres').getAttribute('data-lead');
  await q.locator('#qLead').click();
  await q.waitForSelector('#addBtn'); await q.waitForTimeout(300);
  ok(`${label}: the main button opens exactly that product page`, (await q.evaluate(() => location.pathname + location.hash)).endsWith(`/product/${lead}`), lead);
  ok(`${label}: no sideways scroll on the product page`, (await q.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
  ok(`${label}: no page errors`, e2.length === 0, e2.join('; '));
  await c2.close();
}
ok('no page errors during the 625 paths', errs.length === 0, errs.join('; '));
await b.close();
const fails = res.filter(x => !x).length; console.log(fails ? `\n${fails} FAIL` : '\nall pass'); process.exit(fails ? 1 : 0);
