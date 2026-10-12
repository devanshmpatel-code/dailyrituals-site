// The studio photographs: Claire's real past candle work, placed across the site.
//
// - home: the opening shows five of Claire's candles, seen from above, as moons across the sky (HERO below, pages/moonarc.ts);
// - home: the studio collage after "Meet Claire", one photograph with Ritual on Repeat and one with Send a Sunrise;
// - product pages: a "From the studio" photograph with the candle information;
// - Moon Drops (/drops): the past moons archive. The circular "moons" in /img/studio/moons/ are cut from her own top-down
//   photographs (the toppings are laid in a crescent along the rim). The opening's candle moons use the same faces.
//
// Facts and quotations come only from the owner's Instagram captions (scratchpad/studio-facts.md). Every other sentence
// here is copy and is a DRAFT FOR CLAIRE: in the markup it is wrapped in <span class="d"> so "Show drafts for Claire"
// highlights it. Past scents are never shown as buyable: nothing here carries an add-to-cart, and no photograph of a past
// scent is captioned with its name outside the archive.
import { esc } from './ui';
import { glyph, moonRow, tonightName } from './celestial';
import { currentRoute } from './router';
import { MOMENTS } from './config';
import { dropState } from './drop';
import { mountMoonArc, type MoonArc } from './pages/moonarc';

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

// ---------- home: the opening ----------
// Candle moons across the sky of the opening (pages/moonarc.ts draws them): seen from above, each of Claire's candles is a
// small moon, so the opening shows five of her past pours as moons on one ring, one for each time of day. The moment being
// shown is the full moon at the front of the ring, the largest, glowing; the others wax and wane round it, and choosing
// another time of day turns the ring until its candle is full. Florals at dawn, salt and green stones in the morning, a
// single dried flower at midday, dried orange and cinnamon at golden hour, lavender at night. The faces are clean round
// crops of her top-down photographs (public/img/studio/moons, made by tools/photo/moon_faces.py). They are past pours:
// the picture is described in general words, never names a scent and never links to a purchase.
const HERO: Record<string, { top: string; alt: string }> = {
  dawn: { top: 'spring-blooms', alt: "Five of Claire's candles seen from above, topped by hand, arranged like the phases of the moon across the dawn sky. The full moon is a candle topped with dried flowers and petals" },
  morning: { top: 'sea-salt-sage', alt: "Five of Claire's candles seen from above, topped by hand, arranged like the phases of the moon across the morning sky. The full moon is a candle topped with salt crystals and green stones" },
  midday: { top: 'mothers-garden', alt: "Five of Claire's candles seen from above, topped by hand, arranged like the phases of the moon across the midday sky. The full moon is a candle topped with a single dried flower" },
  golden: { top: 'apple-cider', alt: "Five of Claire's candles seen from above, topped by hand, arranged like the phases of the moon across the golden-hour sky. The full moon is a candle topped with dried orange and cinnamon" },
  night: { top: 'lavender-haze', alt: "Five of Claire's candles seen from above, topped by hand, arranged like the phases of the moon across the night sky. The full moon is a candle topped with dried lavender buds" },
};
/** The opening's picture: #dStack becomes one described picture (role img). It holds, hidden, the five photographs the moons
 *  are shaded from, one figure per moment; only the starting moment's loads at once, the rest carry data-src and load as soon
 *  as the ring is built (they are all in view). The moons themselves are drawn by pages/moonarc.ts. */
export function heroStackHTML(first: string = MOMENTS[0].key): string {
  return MOMENTS.map(m => {
    const set = HERO[m.key]; if (!set) return '';
    const eager = m.key === first;
    return `<figure class="tset" data-mset="${m.key}"><img data-mimg="${m.key}" data-top="${set.top}" ${eager ? `src="${moonSrc(set.top)}"` : `data-src="${moonSrc(set.top)}"`} alt="" width="520" height="520" decoding="async" hidden></figure>`;
  }).join('');
}
let arc: MoonArc | null = null, lastLook: Parameters<MoonArc['look']> | null = null;
/** Show a moment: its candle turns to the front of the ring as the full moon. */
export function showHero(app: HTMLElement, key: string) {
  const stack = app.querySelector<HTMLElement>('#dStack'), hero = app.querySelector<HTMLElement>('#day');
  if (!stack || !hero) return;
  stack.querySelectorAll<HTMLElement>('.tset').forEach(f => f.classList.toggle('on', f.dataset.mset === key));
  stack.setAttribute('role', 'img');
  stack.setAttribute('aria-label', HERO[key]?.alt ?? "Five of Claire's candles seen from above, topped by hand, arranged like the phases of the moon");
  if (!arc) arc = mountMoonArc(hero, stack, k => {
    const el = stack.querySelector<HTMLImageElement>(`img[data-mimg="${k}"]`);
    if (el?.dataset.src) { el.src = el.dataset.src; delete el.dataset.src; }
    return el;
  });
  if (lastLook) arc.look(...lastLook);
  arc.show(key);
}
/** The hour's colours, and the sun's (or moon's) new place, for the moons' light. */
export const heroLook = (sky: [string, string, string], orb: [number, number, number], night: number) => { lastLook = [sky, orb, night]; arc?.look(sky, orb, night); };
export const heroLight = () => arc?.light();
/** Leaving or re-rendering the home page: take the ring down so a fresh hero mounts its own. */
export const resetHero = () => { arc?.destroy(); arc = null; };

// ---------- the extra photographs: Ritual on Repeat, Send a Sunrise, the product page ----------
// Each is a past pour shown as Claire's craft. The captions use only verified facts (topped by hand with real botanicals,
// wooden wicks, White Rock, BC) and never name the scent, so nothing reads as buyable. The lines are drafts for Claire.
// Every one is a cut-out (public/img/studio/tins): whole tins, no table or paper behind them.
const tinFigure = (file: string, w: number, h: number, altText: string, sizes: string, cls: string, cap: string) =>
  `<figure class="studio-cut ${cls}"><img src="/img/studio/tins/${file}-900.webp" srcset="/img/studio/tins/${file}-480.webp 480w, /img/studio/tins/${file}-900.webp ${w}w" sizes="${sizes}" alt="${esc(altText)}" width="${w}" height="${h}" loading="lazy" decoding="async"><figcaption><span class="d">${cap}</span></figcaption></figure>`;
/** Chapter 3, Ritual on Repeat: a batch of tins, under the chapter's words. */
export const repeatPhotoHTML = () => tinFigure('jarrah-top', 900, 745, 'A batch of candles in black tins seen from above, each topped by hand with wood chips beside its wooden wick', '(max-width: 900px) 90vw, 36vw', 'ph-repeat', 'Poured, topped and lidded by hand in White Rock, BC');
/** Chapter 4, Send a Sunrise: a petal-topped pour tucked behind the gift card. */
export const giftPhotoHTML = () => tinFigure('sweet-romance', 532, 535, 'A candle seen from above, topped by hand with dried rose petals and small purple flowers', '(max-width: 820px) 50vw, 20vw', 'ph-gift', 'Finished by hand with dried petals');
/** Product page (candles): tins from the bench beside the candle information. */
export const productStudioHTML = () => tinFigure('mothers-day-florals', 900, 754, 'Candles in black tins seen from above, each topped by hand with a dried flower beside its wooden wick', '(max-width: 820px) 90vw, 40vw', 'ph-product', 'From the studio · wooden wicks, and every tin finished by hand');

// ---------- home: From the studio ----------
// Real cut-outs (backgrounds removed from Claire's own photographs, /img/studio/cut/): Verdant and Cabana, both in the
// current catalogue, stand on a lit shelf and link to their pages; Westcoast deodorant sits in front. Beside them, a pour seen
// from above with its toppings labelled. Below, a row of whole-tin cut-outs from the bench.
// Every sentence of copy here is a DRAFT FOR CLAIRE (wrapped in .d); the facts are from studio-facts.md.
const cut = (k: string, w: number, h: number, alt: string, two = true) => two
  ? `<img src="/img/studio/cut/${k}-900.webp" srcset="/img/studio/cut/${k}-480.webp 480w, /img/studio/cut/${k}-900.webp 900w" sizes="(max-width: 820px) 60vw, 26vw" alt="${esc(alt)}" width="${w}" height="${h}" loading="lazy" decoding="async">`
  : `<img src="/img/studio/cut/${k}.webp" alt="${esc(alt)}" width="${w}" height="${h}" loading="lazy" decoding="async">`;
interface Shot { file: string; w: number; h: number; alt: string; cap: string }
// the row under the showcase: whole-tin cut-outs, each captioned with what it is topped with (draft for Claire)
const SHOTS: Shot[] = [
  { file: 'mothers-garden', w: 900, h: 865, alt: 'Candles in black tins seen from above, each topped with a single dried flower', cap: 'Dried flowers' },
  { file: 'hello-cupcake', w: 900, h: 697, alt: 'Candles in black tins seen from above, scattered with rainbow sprinkles', cap: 'Sprinkles' },
  { file: 'irish-coffee', w: 900, h: 802, alt: 'Candles in black tins seen from above, each topped with coffee beans', cap: 'Coffee beans' },
  { file: 'lavender-haze', w: 900, h: 864, alt: 'Candles in black tins seen from above, topped with dried lavender buds', cap: 'Lavender buds' },
  { file: 'black-crescent', w: 900, h: 960, alt: 'Candles in black tins seen from above, each with a curve of small black stones along the rim', cap: 'Small stones' },
];
export function studioHTML(): string {
  const strip = SHOTS.map((s, i) => `<figure class="sx" style="--r:${(s.w / s.h).toFixed(3)};--i:${i}">
      <span class="sx-ph"><img src="/img/studio/tins/${s.file}-900.webp" srcset="/img/studio/tins/${s.file}-480.webp 480w, /img/studio/tins/${s.file}-900.webp 900w" sizes="(max-width: 820px) 50vw, 18vw" alt="${esc(s.alt)}" width="${s.w}" height="${s.h}" loading="lazy" decoding="async"></span>
      <figcaption><span class="d">${esc(s.cap)}</span></figcaption>
    </figure>`).join('');
  return `<section class="wrap studio" aria-labelledby="studioH">
    <div class="st-head">
      <div><span class="eyebrow">From the studio</span>
        <h2 id="studioH"><span class="d">Poured, topped and finished <span class="it">by hand.</span></span></h2></div>
      <ul class="st-facts">
        <li><b>Soy wax, wooden wicks</b></li>
        <li><b>Topped by hand</b><span class="d">dried flowers, citrus, spices and stones</span></li>
        <li><b>Black tins and glass tumblers</b><span class="d">up to a full 16 oz</span></li>
        <li><b>Made in White Rock, BC</b></li>
      </ul>
    </div>
    <div class="st-show">
      <div class="shelf" role="group" aria-label="Verdant and Cabana candles and Westcoast natural deodorant">
        <span class="sh-glow" aria-hidden="true"></span><span class="sh-top" aria-hidden="true"></span>
        <a class="sh-item sh-verdant" href="#/product/verdant">${cut('verdant', 900, 841, 'Verdant: a lit candle in a white glass tumbler with a black Daily Rituals label, a small lit black tin in front')}<span class="sh-flame f1" aria-hidden="true"></span><span class="sh-flame f2" aria-hidden="true"></span><span class="sh-tag">Verdant <small>candle</small></span></a>
        <a class="sh-item sh-cabana" href="#/product/cabana">${cut('cabana', 900, 900, 'Cabana: a lit candle in a white glass tumbler with a black Daily Rituals label, a small lit black tin and its labelled lid in front')}<span class="sh-flame f1" aria-hidden="true"></span><span class="sh-flame f2" aria-hidden="true"></span><span class="sh-tag">Cabana <small>candle</small></span></a>
        <a class="sh-item sh-west" href="#/product/natural-deodorant">${cut('westcoast', 242, 462, 'Westcoast natural deodorant: an open jar on top of its black-labelled tin', false)}<span class="sh-tag">Westcoast <small>deodorant</small></span></a>
      </div>
      <figure class="above">
        <div class="ab-tins"><img src="/img/studio/tins/christmas-eve-900.webp" srcset="/img/studio/tins/christmas-eve-480.webp 480w, /img/studio/tins/christmas-eve-900.webp 766w" sizes="(max-width: 960px) 80vw, 28vw" alt="Two candles in black tins seen from above, topped by hand with a dried orange slice, star anise and pink peppercorns" width="766" height="890" loading="lazy" decoding="async">
          <span class="ab-l l1 lf"><i></i><span class="d">Dried orange</span></span>
          <span class="ab-l l2 r"><i></i><span class="d">Star anise</span></span>
          <span class="ab-l l3 r"><i></i><span class="d">Wooden wick</span></span>
          <span class="ab-l l4 lf"><i></i><span class="d">Pink peppercorns</span></span>
        </div>
        <figcaption><span class="eyebrow">Seen from above</span><span class="d">Every tin is finished by hand with what its scent calls for.</span></figcaption>
      </figure>
    </div>
    <div class="st-strip" role="list" aria-label="More from Claire's bench">${strip.replace(/<figure class="sx"/g, '<figure role="listitem" class="sx"')}</div>
    <div class="st-cta"><a class="btn" href="#/shop?f=candle">Shop candles</a></div>
  </section>`;
}

/** Claire, cut out of her own photograph and set in a warm arch with a gold orbit (she has approved the photo). */
export const claireCutHTML = () => `<div class="claire-cut"><span class="cc-ring" aria-hidden="true"></span><span class="cc-arch">
  <img src="/img/studio/cut/claire-900.webp" srcset="/img/studio/cut/claire-480.webp 480w, /img/studio/cut/claire-900.webp 900w" sizes="(max-width: 820px) 80vw, 34vw" alt="Claire, founder of Daily Rituals Co." width="1002" height="1200" loading="lazy" decoding="async"></span></div>`;

/** Ease the studio pieces in as they scroll into view. Visible by default; only hidden once an observer is in place. */
export function wireStudio(app: HTMLElement) {
  const figs = [...app.querySelectorAll<HTMLElement>('.studio .sh-item, .studio .above, .studio .sx')];
  if (!figs.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
  // only pieces below the fold rise in; photographs further along the phone strip (off to the side) are left as they are
  figs.forEach(f => { const r = f.getBoundingClientRect(); if (r.top > window.innerHeight * 0.9 && r.left < window.innerWidth) { f.classList.add('will-reveal'); io.observe(f); } });
}

// ---------- Moon Drops: the past moons archive ----------
export function pastMoonsHTML(): string {
  // Midnight Forest closes the archive as a feature card: it is the candle with moon- and star-shaped stones, the one the
  // whole moon idea grew from, and its photograph (midnight-forest-moons.jpg) shows them.
  const card = (m: Moon) => `<li class="pm-card${m.slug === 'midnight-forest' ? ' feature' : ''}" data-moon="${m.slug}" id="pm-${m.slug}">
      <img src="${moonSrc(m.slug)}" alt="${esc(alt(m.slug))}" width="520" height="520" loading="lazy" decoding="async">
      <div class="pm-tx"><h4>${esc(m.name)}</h4>
        ${m.quote ? `<q>${esc(m.quote)}</q>` : ''}${m.quote2 ? `<q>${esc(m.quote2)}</q>` : ''}
        <small>${esc(SEASONS.find(s => s.key === m.season)!.label)}${m.when ? ` · ${esc(m.when)}` : ''}</small></div>
      ${m.slug === 'midnight-forest' ? `<img class="pm-photo" src="/img/studio/tins/midnight-forest-moons-900.webp" srcset="/img/studio/tins/midnight-forest-moons-480.webp 480w, /img/studio/tins/midnight-forest-moons-900.webp 900w" sizes="(max-width: 820px) 90vw, 360px" alt="Midnight Forest candles in black tins seen from above, each topped with small moon- and star-shaped stones" width="900" height="821" loading="lazy" decoding="async">` : ''}
    </li>`;
  // the groups pack into three columns (two on tablets): a season with one candle takes one column, so Love and Autumn share a row
  const groups = SEASONS.map(s => {
    const list = MOONS.filter(m => m.season === s.key);
    return `<div class="pm-group" style="--n:${Math.min(3, list.length)};--n2:${Math.min(2, list.length)}"><h3 class="pm-season"><span>${esc(s.label)}</span><i></i></h3><ul class="pm-grid">${list.map(card).join('')}</ul></div>`;
  }).join('') +
    // the spare cell beside Love and Autumn: tonight's real moon (the site's phase row) and where new pours are announced. Draft for Claire.
    `<aside class="pm-aside" aria-label="Tonight's moon"><span class="eyebrow">Tonight</span>${moonRow()}<p class="d">${tonightName() === 'new moon' ? 'A new moon tonight.' : `Tonight's moon is a ${esc(tonightName())}; the next new moon is ${esc(dropState().dateText)}.`} New pours are announced in the Monthly Ritual first.</p><a class="tlink" href="#/club">Join the Monthly Ritual</a></aside>`;
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

/** Deep links into the archive: #/drops?moon=slug lights that card; #/drops?past=1 scrolls to the archive. */
export function wirePastMoons(app: HTMLElement) {
  const q = new URLSearchParams(currentRoute().split('?')[1] ?? '');
  const slug = q.get('moon'), past = q.get('past');
  const target = (slug && app.querySelector<HTMLElement>(`#pm-${CSS.escape(slug)}`)) || (past ? app.querySelector<HTMLElement>('#pastMoons') : null);
  if (!target) return;
  if (slug) target.classList.add('on');
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.setTimeout(() => target.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: slug ? 'center' : 'start' }), 80);
}
