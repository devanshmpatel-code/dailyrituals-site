// The studio photographs: Claire's real candles, seen from above, as moons.
//
// Seen from above, every candle Claire pours is a small moon: a full face of wax in a black tin with a crescent of real
// things (lavender, salt, stones, citrus, wood, petals) laid along the rim. The circular "moons" in /img/studio/moons/ are
// cut from her own top-down photographs. The celestial system was already in her craft (Midnight Forest carries moon- and
// star-shaped stones), so the moons become the visual heart of the site.
//
// Facts and quotations come only from the owner's Instagram captions (scratchpad/studio-facts.md). Every other sentence
// here is copy and is a DRAFT FOR CLAIRE: in the markup it is wrapped in <span class="d"> so "Show drafts for Claire"
// highlights it. Past scents are never shown as buyable: nothing here carries an add-to-cart.
import { esc } from './ui';
import { glyph, moonRow, tonightName } from './celestial';
import { currentRoute } from './router';

export type Season = 'winter' | 'love' | 'spring' | 'autumn' | 'any';
export interface Moon {
  slug: string; name: string;
  /** Claire's exact words from her caption ("…" marks where the caption was cut off). */
  quote?: string; quote2?: string;
  season: Season;
  /** the post date where known */
  when?: string;
}

const M = (slug: string, name: string, season: Season, quote?: string, extra: Partial<Moon> = {}): Moon => ({ slug, name, season, quote, ...extra });

/** Every named moon, in the order the archive shows them. (The unnamed black-crescent moon is left out on purpose.) */
export const MOONS: Moon[] = [
  M('christmas-eve', 'Christmas Eve', 'winter', 'I call this one Christmas Eve'),
  M('mulled-wine', 'Mulled Wine', 'winter', 'will have you dreaming of Christmas & cozy nights by the fire. With notes of balsam fir, citrus, cinn…', { when: 'December 2025' }),
  M('candy-cane-lane', 'Candy Cane Lane', 'winter', 'with notes of peppermint, …'),
  M('sweet-romance', 'Sweet Romance', 'love', "just in time for Valentine's Day. With notes of cedar, ylang ylang, jasmine, & bergamot."),
  M('easter-bread', 'Easter Bread', 'spring', 'Some call it Easter Bread, some call it Paska'),
  M('spring-blooms', 'Spring Blooms', 'spring', 'Step into that fresh April morning, sun is shining, and what do you smell? Spring Blooms of course!'),
  M('mothers-garden', "Mother's Garden", 'spring', "Introducing Mother's Garden"),
  M('apple-cider', 'Cozy Apple Cider', 'autumn', undefined, { when: 'October 2024' }),
  M('lavender-haze', 'Lavender Haze', 'any', 'The Queen of scents, Lavender, is married with French Vanilla to bring you into a dreamy Lavender Haze'),
  M('sea-salt-sage', 'Sea Salt & Sage', 'any', 'with notes of lime, crisp green melon, warm sandalwood, sage, ocean lily, and sea salt'),
  M('jarrah', 'Jarrah', 'any', 'named after the gorgeous Jarrah trees in Australia. Sweet, fragrant, & woodsy', { quote2: 'if you like to feel grounded and centred' }),
  M('tuscan-sandalwood', 'Tuscan Sandalwood', 'any', 'will transport you to the rolling hills and forests of Tuscany'),
  M('irish-coffee', 'Irish Coffee', 'any', "for when that hit of coffee just isn't quite doing the trick"),
  M('hello-cupcake', 'Hello Cupcake', 'any', "smells exactly like you'd think: a sweet vanilla cupcake with butter cream frosting"),
  M('midnight-forest', 'Midnight Forest', 'any', 'my personal fave and might become yours too if you love all things woodsy'),
];
export const SEASONS: { key: Season; label: string }[] = [
  { key: 'winter', label: 'Winter' }, { key: 'love', label: 'Love' }, { key: 'spring', label: 'Spring' }, { key: 'autumn', label: 'Autumn' }, { key: 'any', label: 'Any time' },
];
export const moonSrc = (slug: string) => `/img/studio/moons/${slug}.webp`;
const byId = Object.fromEntries(MOONS.map(m => [m.slug, m])) as Record<string, Moon>;
/** Alt text: what is really on the wax (from the photographs), no stone names. */
const ALT: Record<string, string> = {
  'midnight-forest': 'Midnight Forest: a white candle in a black tin with two small moon-shaped stones',
  'lavender-haze': 'Lavender Haze: a crescent of lavender buds along the rim',
  'irish-coffee': 'Irish Coffee: a crescent of coffee beans along the rim',
  'mulled-wine': 'Mulled Wine: a dried orange slice, star anise and pink peppercorns',
  'easter-bread': 'Easter Bread: the whole face covered in pastel sprinkles',
  'spring-blooms': 'Spring Blooms: dried flowers and blue petals along the rim',
  jarrah: 'Jarrah: a crescent of wood chips along the rim',
  'sea-salt-sage': 'Sea Salt & Sage: salt crystals and green stones along the rim',
  'christmas-eve': 'Christmas Eve: dried orange, star anise and pink peppercorns',
  'candy-cane-lane': 'Candy Cane Lane: a crescent of crushed red and white candy',
  'sweet-romance': 'Sweet Romance: dried petals and a sprig of purple flowers',
  'mothers-garden': "Mother's Garden: a single dried flower at the rim",
  'apple-cider': 'Cozy Apple Cider: a dried orange slice and cinnamon pieces',
  'tuscan-sandalwood': 'Tuscan Sandalwood: a faint crescent of pale grains along the rim',
  'hello-cupcake': 'Hello Cupcake: a crescent of rainbow sprinkles',
};
const alt = (slug: string) => ALT[slug] ?? `${byId[slug].name}: a candle seen from above`;

/** The home arc: eight moons as one lunar month. The crescent of toppings is turned (CSS rotate) so waxing moons face right,
 *  waning moons face left, and the one candle covered edge to edge (Easter Bread) is the full moon. Sizes grow to the full. */
export const HOME_ARC: { slug: string; phase: string; rot: number; size: number }[] = [
  { slug: 'midnight-forest', phase: 'new moon', rot: 0, size: 60 },
  { slug: 'lavender-haze', phase: 'waxing crescent', rot: -20, size: 70 },
  { slug: 'irish-coffee', phase: 'first quarter', rot: 0, size: 84 },
  { slug: 'mulled-wine', phase: 'waxing gibbous', rot: 45, size: 100 },
  { slug: 'easter-bread', phase: 'full moon', rot: 0, size: 122 },
  { slug: 'spring-blooms', phase: 'waning gibbous', rot: 170, size: 100 },
  { slug: 'jarrah', phase: 'last quarter', rot: 180, size: 84 },
  { slug: 'sea-salt-sage', phase: 'waning crescent', rot: 0, size: 70 },
];

/** The moonrise: a quadratic curve (viewBox 1000 x 600) that starts low on the left, beneath the words, and climbs through the
 *  empty sky on the right. The dashed path and the moon positions share it. */
const ARC = { p0: [40, 540], p1: [560, 600], p2: [960, 50] };
export const ARC_PATH = `M${ARC.p0.join(',')} Q${ARC.p1.join(',')} ${ARC.p2.join(',')}`;
const arcPt = (t: number) => {
  const { p0, p1, p2 } = ARC;
  const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
  const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
  return [x / 10, y / 6];
};

// ---------- home: "Every candle is a moon" ----------
export function moonsSectionHTML(): string {
  const moons = HOME_ARC.map((h, i) => {
    const m = byId[h.slug], [x, y] = arcPt(i / (HOME_ARC.length - 1));
    // the low moons on the left open their caption beside them (the words sit above, the panel's edge below); the rest open below
    const edge = (i === HOME_ARC.length - 1 ? ' at-end' : '') + (i < 4 ? ' side' : '');
    return `<li class="moon-pt${edge}" style="--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}%;--s:${h.size}px;--r:${h.rot}deg;--i:${i}">
      <a class="moon-link" href="#/drops?moon=${m.slug}" aria-describedby="moon-cap-${m.slug}">
        <span class="moon-disc"><img src="${moonSrc(m.slug)}" alt="${esc(alt(m.slug))}" width="520" height="520" loading="lazy" decoding="async"></span>
        <span class="moon-name"><b>${esc(m.name)}</b><small>${esc(h.phase)}</small></span>
      </a>
      <span class="moon-cap" id="moon-cap-${m.slug}" role="tooltip"><q>${esc(m.quote ?? '')}</q><em>Claire</em></span>
    </li>`;
  }).join('');
  // draft for Claire: the eyebrow, heading and paragraph below (facts used: White Rock, BC; wooden wicks; topped by hand with real botanicals and stones)
  return `<section class="moons night" id="moons" aria-labelledby="moonsH">
    <div class="wrap moons-in">
      <div class="moons-tx">
        <span class="eyebrow has-glyph">${glyph('moon')}From the studio</span>
        <h2 id="moonsH"><span class="d">Every candle is a <span class="it">moon.</span></span></h2>
        <p class="d">Seen from above, each candle Claire pours is a small moon: a face of wax in a black tin, finished by hand with a crescent of real botanicals and stones along the rim. Handmade in White Rock, BC, with wooden wicks.</p>
        <div class="cta"><a class="btn white" href="#/shop?f=candle">Candles in the shop</a><a class="btn ghost-w" href="#/drops?past=1">Past moons</a></div>
      </div>
      <ul class="moons-arc" aria-label="Eight of Claire's candles, seen from above, as the phases of the moon">
        <svg class="moons-path" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="${ARC_PATH}" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="3 7" vector-effect="non-scaling-stroke"/></svg>
        ${moons}
      </ul>
      <p class="moons-hint small" aria-hidden="true">Hover a moon for Claire's words · past and seasonal pours, kept in the archive</p>
    </div>
  </section>`;
}

// ---------- home: the studio collage ----------
interface Shot { file: string; w: number; h: number; alt: string; cap: string; cls: string }
const SHOTS: Shot[] = [
  { file: 'midnight-forest-lit', w: 1184, h: 1200, alt: 'A lit Midnight Forest candle in a black tin, its wooden wick burning, surrounded by leaves', cap: 'Midnight Forest', cls: 'a' },
  { file: 'candle-season', w: 1200, h: 639, alt: 'A table covered with candles in black tins, each topped with dried fruit, flowers, sprinkles and stones', cap: 'Candle season', cls: 'b' },
  { file: 'crystal-mushrooms', w: 1200, h: 1159, alt: 'Black tins of white wax topped with small stone mushrooms, stars and moons', cap: 'Stone mushrooms, stars and moons', cls: 'c' },
  { file: 'large-candles', w: 1200, h: 1163, alt: 'Four large 16 oz candles in black tins topped with dried orange, cinnamon, lavender and stones', cap: 'Large candles · 16 oz', cls: 'd' },
  { file: 'black-crescent', w: 1058, h: 1200, alt: 'Candles in black tins, each with a crescent of small black stones along the rim', cap: 'A crescent of stones', cls: 'e' },
  { file: 'howlite-tins', w: 1040, h: 1200, alt: 'Dark tins of wax, each topped with a few white stones beside the wooden wick', cap: 'From the studio', cls: 'f' },
];
export function collageHTML(): string {
  const figs = SHOTS.map((s, i) => `<figure class="cg cg-${s.cls}" style="--i:${i}">
      <img src="/img/studio/web/${s.file}-1000.webp" srcset="/img/studio/web/${s.file}-560.webp 560w, /img/studio/web/${s.file}-1000.webp 1000w" sizes="${s.cls === 'a' ? '(max-width: 820px) 100vw, 34vw' : s.cls === 'b' ? '(max-width: 820px) 100vw, 60vw' : '(max-width: 820px) 50vw, 16vw'}" alt="${esc(s.alt)}" width="${s.w}" height="${s.h}" loading="lazy" decoding="async">
      <figcaption>${esc(s.cap)}</figcaption>
    </figure>`).join('');
  // draft for Claire: eyebrow, heading and the line under it (facts used: White Rock, BC; wooden wicks; finished by hand with real botanicals and stones)
  return `<div class="wrap studio" aria-labelledby="studioH">
    <div class="head"><div class="col"><span class="eyebrow">The studio</span><h2 id="studioH"><span class="d">Made by hand in <span class="it">White Rock, BC.</span></span></h2><p class="muted d">Wooden wicks, and every tin finished by hand with real botanicals and stones. A few pictures from Claire's bench.</p></div><a class="tlink" href="#/shop?f=candle">Shop candles</a></div>
    <div class="collage">${figs}</div>
  </div>`;
}

/** Ease the collage in as it scrolls into view. Pictures are visible by default; they are only hidden once an observer is in place. */
export function wireStudio(app: HTMLElement) {
  const figs = [...app.querySelectorAll<HTMLElement>('.collage .cg')];
  if (!figs.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  figs.forEach(f => { if (f.getBoundingClientRect().top > window.innerHeight * 0.9) { f.classList.add('will-reveal'); io.observe(f); } });
}

// ---------- Moon Drops: the past moons archive ----------
export function pastMoonsHTML(): string {
  // Midnight Forest closes the archive as a feature card: it is the candle with moon- and star-shaped stones, the one the
  // whole moon idea grew from, and its photograph (midnight-forest-moons.jpg) shows them.
  const card = (m: Moon) => `<li class="pm-card${m.slug === 'midnight-forest' ? ' feature' : ''}" data-moon="${m.slug}" id="pm-${m.slug}">
      <img src="${moonSrc(m.slug)}" alt="${esc(alt(m.slug))}" width="520" height="520" loading="lazy" decoding="async">
      <div class="pm-tx"><h4>${esc(m.name)}</h4>
        ${m.quote ? `<q>${esc(m.quote)}</q>` : '<span class="pm-noq">No caption yet</span>'}${m.quote2 ? `<q>${esc(m.quote2)}</q>` : ''}
        <small>${esc(SEASONS.find(s => s.key === m.season)!.label)}${m.when ? ` · ${esc(m.when)}` : ''}</small></div>
      ${m.slug === 'midnight-forest' ? `<img class="pm-photo" src="/img/studio/web/midnight-forest-moons-1000.webp" srcset="/img/studio/web/midnight-forest-moons-560.webp 560w, /img/studio/web/midnight-forest-moons-1000.webp 1000w" sizes="(max-width: 820px) 100vw, 360px" alt="Midnight Forest candles in black tins, each topped with small moon- and star-shaped stones" width="1200" height="1087" loading="lazy" decoding="async">` : ''}
    </li>`;
  // the groups pack into three columns (two on tablets): a season with one candle takes one column, so Love and Autumn share a row
  const groups = SEASONS.map(s => {
    const list = MOONS.filter(m => m.season === s.key);
    return `<div class="pm-group" style="--n:${Math.min(3, list.length)};--n2:${Math.min(2, list.length)}"><h3 class="pm-season"><span>${esc(s.label)}</span><i></i></h3><ul class="pm-grid">${list.map(card).join('')}</ul></div>`;
  }).join('') +
    // the spare cell beside Love and Autumn: tonight's real moon (the site's phase row) and where new pours are announced. Draft for Claire.
    `<aside class="pm-aside" aria-label="Tonight's moon"><span class="eyebrow">Tonight</span>${moonRow()}<p class="d">A ${esc(tonightName())} tonight. New pours are announced in the Sunday note first.</p><a class="tlink" href="#/club">Join the Sunday note</a></aside>`;
  // draft for Claire: the heading, the lead and the "bring one back" idea (the idea stays a review note until she decides)
  return `<section class="pm" id="pastMoons" aria-labelledby="pmH">
    <div class="pm-head">
      <span class="eyebrow has-glyph">${glyph('moon')}The archive</span>
      <h2 id="pmH"><span class="d">Past <span class="it">moons</span></span></h2>
      <p class="d">Seen from above, each candle Claire pours is a small moon: a face of wax with a crescent of real botanicals and stones along the rim. These are past and seasonal pours, kept here for the record. They are not for sale right now.</p>
      <p class="small pm-note"><span class="pm-tag">Not for sale</span> <span class="d confirm">Draft idea for Claire: <a href="#/help">Ask Claire to bring one back</a></span></p>
    </div>
    <div class="pm-groups">${groups}</div>
  </section>`;
}

/** Deep links from the home arc: #/drops?moon=slug lights that card; #/drops?past=1 scrolls to the archive. */
export function wirePastMoons(app: HTMLElement) {
  const q = new URLSearchParams(currentRoute().split('?')[1] ?? '');
  const slug = q.get('moon'), past = q.get('past');
  const target = (slug && app.querySelector<HTMLElement>(`#pm-${CSS.escape(slug)}`)) || (past ? app.querySelector<HTMLElement>('#pastMoons') : null);
  if (!target) return;
  if (slug) target.classList.add('on');
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.setTimeout(() => target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: slug ? 'center' : 'start' }), 80);
}
