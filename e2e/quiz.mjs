// The scent quiz (Find your scent > Take the quiz): the questions, and every one of the 5 x 5 x 5 x 5 = 625 ways to answer them.
// For each path: a result always appears; it names the mood most answers point to (a tie goes to the latest answer among the
// tied moods); every product it offers is real (in the captured catalogue), in stock, in that mood, and neither the natural
// deodorant nor a -need-pics seasonal; the "See the ..." button opens exactly the best match; and every product the results
// link to opens a product page that renders. Prints how many paths land on each scent and each product.
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

// the scent families (independent of the site's own table, so a wrong entry there shows up here)
const MOOD_OF = { 'windy beach': 'fresh', 'sea foam': 'fresh', 'citrus & sun': 'fresh', cabana: 'sunny', 'tropical passion': 'sunny', 'peony bloom': 'floral', 'golden apricot': 'floral', 'cedar santal': 'woody', 'campfire stories': 'woody', 'desert vesper': 'woody', 'inner sanctum': 'grounding', 'golden meridian': 'grounding', verdant: 'grounding' };
const scentOf = name => name.replace(/\s*(fragrance roller|mini diffuser|natural deodorant)$/i, '').trim();
const formatOf = name => /fragrance roller$/i.test(name) ? 'roller' : /mini diffuser$/i.test(name) ? 'diffuser' : /deodorant/i.test(name) ? 'deodorant' : 'candle';
// what can be bought today: visible, in stock, priced, never the deodorant or a -need-pics seasonal
const buyable = new Map(catalogue.filter(p => p.visible && p.inventory.availabilityStatus !== 'OUT_OF_STOCK' && Number(p.actualPriceRange?.minValue?.amount) > 0 && !/-need-pics$/.test(p.slug) && formatOf(p.name) !== 'deodorant')
  .map(p => [p.slug, { slug: p.slug, name: p.name, scent: scentOf(p.name), format: formatOf(p.name), mood: MOOD_OF[scentOf(p.name).toLowerCase()] }]));
const MOODS = ['fresh', 'sunny', 'floral', 'woody', 'grounding'];
// the answers, by question and option (the order the quiz shows them)
const OPTS = [
  ['fresh', 'sunny', 'grounding', 'woody', 'floral'],
  ['fresh', 'sunny', 'floral', 'woody', 'grounding'],
  ['fresh', 'sunny', 'floral', 'woody', 'grounding'],
  ['fresh', 'sunny', 'floral', 'woody', 'grounding'],
];
const expectedMood = a => {
  const moods = a.map((o, q) => OPTS[q][o]); const tally = {}; moods.forEach(m => { tally[m] = (tally[m] ?? 0) + 1; });
  const most = Math.max(...Object.values(tally)), tied = Object.keys(tally).filter(m => tally[m] === most);
  return { mood: [...moods].reverse().find(m => tied.includes(m)), tied, moods };
};

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
ok('Q2 swaps "A quiet room with nothing on" for "In the middle of a forest"', q2.q === 'Which place feels most like you?' && q2.opts.includes('In the middle of a forest') && !q2.opts.some(o => /quiet room/i.test(o)) && q2.opts.length === 5, q2.opts.join(' | '));
await p.locator('[data-ans]').first().click();
const q3 = await question();
ok('Q3 is unchanged', q3.q === 'Pick a weekend plan' && q3.opts.join('|') === 'A swim and a long walk|A patio and something cold to drink|Flowers, a book and a bath|A campfire with friends|Stretching, tea and no phone', q3.opts.join(' | '));
await p.locator('[data-ans]').first().click();
const q4 = await question();
ok('Q4 is unchanged', q4.q === 'How should it make you feel?' && q4.opts.join('|') === 'Bright and clean|Warm and playful|Soft and romantic|Cosy and rooted|Calm and centred', q4.opts.join(' | '));
await p.locator('[data-ans]').first().click();
ok('the answers lead to a result', (await p.locator('.qres').count()) === 1);

// ---------- all 625 paths ----------
const t0 = Date.now();
await p.goto(base + '/explore?tab=quiz'); await p.waitForSelector('[data-ans]');
const recs = await p.evaluate(() => {
  const out = [];
  for (let n = 0; n < 625; n++) {
    const a = [Math.floor(n / 125) % 5, Math.floor(n / 25) % 5, Math.floor(n / 5) % 5, n % 5];
    for (const i of a) { const btn = document.querySelectorAll('[data-ans]')[i]; if (!btn) { out.push({ a, none: true }); break; } btn.click(); }
    const q = document.querySelector('.qres');
    if (!q) { out.push({ a, none: true }); document.querySelector('#qBack')?.click(); continue; }
    const href = e => e?.getAttribute('href');
    out.push({
      a, mood: q.dataset.mood, scent: q.dataset.scent, lead: q.dataset.lead, title: q.querySelector('.qres-head h2')?.textContent,
      leadHref: href(q.querySelector('#qLead')), leadText: q.querySelector('#qLead')?.textContent?.trim(), photoHref: href(q.querySelector('.qbest-ph')),
      fmts: [...q.querySelectorAll('.qbest-fmts a')].map(href), shopHref: href([...q.querySelectorAll('#qCta a')].find(x => /Shop this mood/.test(x.textContent))),
      cards: [...q.querySelectorAll('#qGrid .card')].map(c => ({ mood: c.dataset.mood, format: c.dataset.format, href: href(c.querySelector('a')) })),
    });
    document.querySelector('#qAgain').click();
  }
  return out;
});
console.log(`(walked ${recs.length} paths in ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
ok('625 distinct answer combinations were walked', recs.length === 625 && new Set(recs.map(r => r.a.join(''))).size === 625);
ok('a result always appears', recs.every(r => !r.none), `${recs.filter(r => r.none).length} without one`);
const slugOf = h => (h ?? '').replace(/^#\/product\//, '');
const bad = [];
const flag = (r, why) => bad.push(`${r.a.join('')}: ${why}`);
for (const r of recs.filter(x => !x.none)) {
  const e = expectedMood(r.a);
  if (r.mood !== e.mood) flag(r, `mood ${r.mood}, expected ${e.mood}`);
  if (!e.tied.includes(r.mood)) flag(r, 'mood is not one of the leading moods');
  if (!r.title?.includes({ fresh: 'Fresh and coastal', sunny: 'Sunny and tropical', floral: 'Soft and floral', woody: 'Warm and woody', grounding: 'Grounding' }[e.mood])) flag(r, `heading says "${r.title}"`);
  const lead = buyable.get(slugOf(r.lead));
  if (!lead) flag(r, `best match ${r.lead} is not a buyable product`);
  else {
    if (lead.mood !== e.mood) flag(r, `best match ${lead.name} is ${lead.mood}`);
    if (lead.scent !== r.scent) flag(r, `best match scent ${r.scent} vs product ${lead.scent}`);
    if (r.leadHref !== `#/product/${r.lead}` || r.photoHref !== r.leadHref) flag(r, `button opens ${r.leadHref}, photo ${r.photoHref}`);
    if (!r.leadText?.toLowerCase().includes(lead.scent.toLowerCase()) || !new RegExp(lead.format === 'diffuser' ? 'mini diffuser' : lead.format, 'i').test(r.leadText)) flag(r, `button says "${r.leadText}" but opens ${lead.name}`);
    // a candle comes first when the scent has one
    const sameScent = [...buyable.values()].filter(x => x.scent === lead.scent);
    if (sameScent.some(x => x.format === 'candle') && lead.format !== 'candle') flag(r, 'candle available but not first');
  }
  for (const h of r.fmts) { const x = buyable.get(slugOf(h)); if (!x || x.scent !== r.scent) flag(r, `format link ${h} is not ${r.scent}`); }
  if (r.fmts.length !== [...buyable.values()].filter(x => x.scent === r.scent).length) flag(r, 'not every format of the best match is offered');
  if (!/m=(\w+)/.test(r.shopHref ?? '') || RegExp.$1 !== e.mood) flag(r, `"Shop this mood" goes to ${r.shopHref}`);
  for (const c of r.cards) { const x = buyable.get(slugOf(c.href)); if (!x) flag(r, `card ${c.href} is not buyable`); else if (x.mood !== e.mood) flag(r, `card ${x.name} is ${x.mood}`); if (c.format === 'deodorant') flag(r, 'deodorant card'); }
  if (new Set([r.lead, ...r.cards.map(c => slugOf(c.href))]).size !== 1 + r.cards.length && r.cards.length) flag(r, 'a product is offered twice');
}
ok('every path: the winning mood is the one most answers point to (ties to the latest tied answer)', !bad.some(x => /mood /.test(x) || /leading/.test(x) || /heading/.test(x)), bad.filter(x => /mood |leading|heading/.test(x)).slice(0, 3).join('; '));
ok('every path: the best match and every card is a real, in-stock product in the winning mood (no deodorant, no -need-pics)', !bad.some(x => /not a buyable|is not buyable|is (fresh|sunny|floral|woody|grounding|undefined)|deodorant|offered twice|scent/.test(x)), bad.slice(0, 4).join('; '));
ok('every path: the button opens exactly the best match, and says its name', !bad.some(x => /button|photo|candle available|format link|not every format|Shop this mood/.test(x)), bad.filter(x => /button|photo|candle|format|Shop this/.test(x)).slice(0, 4).join('; '));
ok('no path broke any other rule', bad.length === 0, bad.slice(0, 5).join('; '));

// ties: how many paths, and that they land where the rule says
const tiePaths = recs.filter(r => !r.none && expectedMood(r.a).tied.length > 1);
ok('ties are resolved to the latest answer among the tied moods', tiePaths.length > 0 && tiePaths.every(r => { const e = expectedMood(r.a); return r.mood === [...e.moods].reverse().find(m => e.tied.includes(m)); }), `${tiePaths.length} tied paths`);
// the same answers always give the same result (run a few again)
const again = await p.evaluate(() => {
  const out = []; for (const n of [0, 77, 300, 624]) { const a = [Math.floor(n / 125) % 5, Math.floor(n / 25) % 5, Math.floor(n / 5) % 5, n % 5]; for (const i of a) document.querySelectorAll('[data-ans]')[i].click(); out.push(document.querySelector('.qres').dataset.lead); document.querySelector('#qAgain').click(); } return out;
});
ok('the same answers always lead to the same product', again.every((s, i) => s === recs[[0, 77, 300, 624][i]].lead), again.join(', '));

// ---------- the distribution ----------
const tally = (key) => { const m = new Map(); recs.filter(r => !r.none).forEach(r => m.set(key(r), (m.get(key(r)) ?? 0) + 1)); return [...m].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])); };
const byMood = tally(r => r.mood), byScent = tally(r => `${r.scent} (${r.mood})`), byLead = tally(r => r.lead);
console.log('\nPATHS PER MOOD   ' + byMood.map(([k, n]) => `${k} ${n}`).join(' · '));
console.log('PATHS PER BEST-MATCH SCENT\n' + byScent.map(([k, n]) => `  ${String(n).padStart(3)}  ${k}`).join('\n'));
console.log('PATHS PER BEST-MATCH PRODUCT (the page the main button opens)\n' + byLead.map(([k, n]) => `  ${String(n).padStart(3)}  ${k}`).join('\n'));
const allScents = [...new Set([...buyable.values()].map(x => x.scent))];
const never = allScents.filter(s => !byScent.some(([k]) => k.startsWith(s + ' (')));
ok('every scent on sale is the best match for at least one path', never.length === 0 && allScents.length === 13, never.length ? `never: ${never.join(', ')}` : `${allScents.length} scents`);
ok('every mood wins at least one path', byMood.length === 5);
const shownAnywhere = new Set(recs.flatMap(r => [r.lead, ...r.fmts.map(slugOf), ...r.cards.map(c => slugOf(c.href))].map(slugOf)));
const missing = [...buyable.keys()].filter(s => !shownAnywhere.has(s));
ok('every buyable product appears somewhere in the results', missing.length === 0, missing.join(', ') || `${buyable.size} products`);
console.log('PRODUCTS NOT THE MAIN BUTTON FOR ANY PATH (shown only as another format or in "More in ..."): ' + ([...buyable.keys()].filter(s => !byLead.some(([k]) => k === s)).join(', ') || 'none'));

// ---------- every link resolves to a product page that renders ----------
const linked = [...new Set(recs.flatMap(r => [r.lead, ...r.fmts.map(slugOf), ...r.cards.map(c => slugOf(c.href))].map(slugOf)))].filter(Boolean);
let rendered = 0; const broken = [];
for (const slug of linked) {
  await p.goto(base + `/product/${slug}`);
  const good = await p.waitForFunction(s => { const h = document.querySelector('#app h1'); return !!h && h.textContent.trim().length > 0 && !!document.querySelector('#addBtn') && (location.pathname + location.hash).includes(s); }, slug, { timeout: 8000 }).then(() => true, () => false);
  const h1 = good ? await p.locator('#app h1').first().innerText() : '';
  const info = buyable.get(slug);
  if (good && h1.toLowerCase().includes(info.scent.toLowerCase()) && !(await p.locator('text=/not in the store/i').count())) rendered++; else broken.push(`${slug} (${h1 || 'did not render'})`);
}
ok(`all ${linked.length} products the results link to open a product page that renders (name, price, Add to cart)`, broken.length === 0 && rendered === linked.length, broken.join('; ') || `${rendered} rendered`);

// ---------- through the screen: the button, the screenshots ----------
for (const [label, vp, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['phone', { width: 390, height: 844 }, true]]) {
  const c2 = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, timezoneId: 'America/Vancouver' }); const q = await c2.newPage(); q.setDefaultTimeout(8000); await setupMocks(q);
  const e2 = []; q.on('pageerror', e => e2.push(e.message));
  await q.goto(base + '/explore?tab=quiz'); await q.waitForSelector('[data-ans]');
  await q.screenshot({ path: `${shots}/${vp.width}-quiz-q1.png` });
  for (const i of [2, 4, 3, 3]) await q.locator('[data-ans]').nth(i).click(); // slump, forest, campfire, cosy: woody 2, grounding 2: a tie to "cosy" (woody)
  await q.waitForSelector('.qres');
  const mood = await q.locator('.qres').getAttribute('data-mood');
  ok(`${label}: a tie lands on the latest answer's mood (woody)`, mood === 'woody', mood);
  await q.screenshot({ path: `${shots}/${vp.width}-quiz-result.png`, fullPage: true });
  const lead = await q.locator('.qres').getAttribute('data-lead');
  await q.locator('#qLead').click();
  await q.waitForSelector('#addBtn'); await q.waitForTimeout(300);
  ok(`${label}: the result's main button opens exactly that product page`, (await q.evaluate(() => location.pathname + location.hash)).endsWith(`/product/${lead}`) && /campfire|cedar|desert/i.test(await q.locator('#app h1').first().innerText()), lead + ' ' + await q.evaluate(() => location.href) + ' ' + await q.locator('#app h1').first().innerText());
  const overflow = await q.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(`${label}: no sideways scroll on the product page`, overflow <= 1, String(overflow));
  ok(`${label}: no page errors`, e2.length === 0, e2.join('; '));
  await c2.close();
}
ok('no page errors during the 625 paths', errs.length === 0, errs.join('; '));
await b.close();
const fails = res.filter(x => !x).length; console.log(fails ? `\n${fails} FAIL` : '\nall pass'); process.exit(fails ? 1 : 0);
