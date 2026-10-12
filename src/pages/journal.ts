import { esc } from '../ui';
import { replaceRoute } from '../router';
import '../journal.css';

// The Journal: short, useful pieces on caring for a candle and making a ritual of it, each ending with the products it
// relates to. Facts about candle care are general guidance and every article lists its sources. Anything about Claire's
// own candles uses only confirmed facts (soy wax, wooden wicks, black tins and glass tumblers, topped by hand, White Rock, BC).
// All copy is a DRAFT FOR CLAIRE: the whole article body is wrapped in .d so "Show drafts for Claire" outlines it.
// Claire has confirmed her candles are soy wax (owner, October 2026).

type Source = { label: string; url: string };
type Article = {
  slug: string; title: string; dek: string; minutes: number; tag: string;
  pic: { file: string; w: number; h: number; alt: string };
  body: string; // trusted HTML written here (no user input)
  shop: { label: string; href: string }[];
  sources: Source[];
};

const NCA_GUIDE: Source = { label: 'National Candle Association: Your foolproof guide to burning a candle correctly', url: 'https://candles.org/your-foolproof-guide-to-burning-a-candle-correctly' };
const NCA_SAFETY: Source = { label: 'National Candle Association: fire safety at home', url: 'https://candles.org/?p=685' };

export const ARTICLES: Article[] = [
  {
    slug: 'wooden-wick', tag: 'Candle care', minutes: 3,
    title: 'How to burn a wooden-wick candle',
    dek: 'Every Daily Rituals candle burns on a wooden wick. A few small habits give you an even burn and a steady flame.',
    pic: { file: 'jarrah-top', w: 900, h: 745, alt: 'Candles in black tins seen from above, each with a flat wooden wick' },
    body: `
      <p>A wooden wick is a flat strip of wood rather than a braided cotton string. It lights a little differently and asks for slightly different care, but the habits are simple.</p>
      <h2>Light it along its length</h2>
      <p>Hold the flame to the wick for a few seconds so it catches along the edge, not just at one corner. If it struggles, let a little wax melt around it and try again: it is the melted wax that feeds the flame, not the wood itself.</p>
      <h2>Trim it short, every time</h2>
      <p>Before each burn, once the candle has cooled, trim the wick to about 1/8 inch (3 mm) and wipe away any charred bits from the wax. A short wick keeps the flame calm and clean. A long one flickers, smokes and can blacken the glass or tin.</p>
      <h2>Give the first burn time</h2>
      <p>Let the wax melt all the way to the edge on the first burn (see <a href="#/journal/first-burn">your first burn</a>). Wooden wicks can take a little longer to build a full melt pool.</p>
      <h2>The crackle</h2>
      <p>Wooden wicks can crackle softly as they burn. It is part of their charm.</p>`,
    shop: [{ label: 'Shop candles', href: '#/shop?f=candle' }],
    sources: [{ label: 'Scrub Me Good: wooden wick care tips', url: 'https://scrubmegood.com/pages/wooden-wick-care-tips' }, NCA_GUIDE],
  },
  {
    slug: 'first-burn', tag: 'Candle care', minutes: 3,
    title: 'Your first burn, and the memory ring',
    dek: 'The first time you light a candle decides how it burns for the rest of its life. Here is how to get it right.',
    pic: { file: 'mothers-garden', w: 900, h: 865, alt: 'Candles in black tins seen from above, each topped with a dried flower' },
    body: `
      <p>Wax has a memory. If the first burn stops before the melted wax reaches the edge of the tin, the next burn tends to stop at the same place, and the candle starts to "tunnel" down the middle, leaving wax unused around the sides.</p>
      <h2>A simple rule of thumb</h2>
      <p>Burn about one hour for every inch (2.5 cm) of the candle's width on the first lighting, until the whole top is liquid from edge to edge. A candle 3 inches across needs roughly three hours.</p>
      <h2>Not too long, either</h2>
      <p>Most guidance suggests no more than about four hours at a time. Then blow it out, let it cool for a couple of hours and trim the wick before you light it again.</p>
      <h2>Make the first burn a ritual</h2>
      <p>Choose an evening when you will be home for a while. Light it, take three slow breaths, and let it set the pace of the evening.</p>`,
    shop: [{ label: 'Shop candles', href: '#/shop?f=candle' }, { label: 'Try the free 7-day reset', href: '#/reset' }],
    sources: [NCA_GUIDE, { label: 'Good Light Candles: candle 101', url: 'https://goodlightcandles.com/blogs/news/burning-a-candle' }],
  },
  {
    slug: 'candle-safety', tag: 'Candle care', minutes: 2,
    title: 'Candle safety, the short version',
    dek: 'Six habits that keep a calm candle calm.',
    pic: { file: 'black-crescent', w: 900, h: 960, alt: 'Candles in black tins seen from above, each with a curve of small black stones' },
    body: `
      <ol class="jr-list">
        <li><b>Never leave it alone.</b> Blow out every candle before you leave the room or go to sleep.</li>
        <li><b>Give it space.</b> Keep it at least 12 inches (30 cm) from anything that can burn, such as curtains, books and bedding.</li>
        <li><b>Leave a gap between candles.</b> Keep burning candles at least 3 inches (7.5 cm) apart so they do not melt one another.</li>
        <li><b>Out of the draft.</b> Keep it away from open windows, fans and vents, which make the flame flicker and smoke.</li>
        <li><b>On a steady, heat-safe surface,</b> out of reach of children and pets.</li>
        <li><b>Know when to stop.</b> In a tin or glass, stop when about half an inch (1 cm) of wax is left.</li>
      </ol>`,
    shop: [{ label: 'Shop candles', href: '#/shop?f=candle' }],
    sources: [NCA_SAFETY, NCA_GUIDE],
  },
  {
    slug: 'wax-guide', tag: 'Candle making', minutes: 4,
    title: 'Soy, coconut and paraffin: an honest guide',
    dek: 'What the common candle waxes are, and what actually changes how a candle smells and burns.',
    pic: { file: 'tuscan-sandalwood', w: 900, h: 635, alt: 'Candles in black tins seen from above, freshly poured' },
    body: `
      <p><b>Our candles are poured with soy wax</b>, on wooden wicks, and topped by hand in White Rock, BC. Here is how soy compares with the other common waxes.</p>
      <h2>Soy</h2>
      <p>Made from hydrogenated soybean oil. It tends to burn cooler and slower, which can mean a longer burn, and it is often described as having a softer, more ambient scent. It can show a little frosting on the surface, which is natural.</p>
      <h2>Coconut</h2>
      <p>Made from coconut oil, usually blended with other waxes because on its own it is soft. Often valued for carrying scent well. It is generally the most expensive of the three.</p>
      <h2>Paraffin</h2>
      <p>A by-product of petroleum refining and long the industry standard. It holds a lot of fragrance and fills a room quickly. It has a reputation for more soot, though a well-made, well-wicked candle of any wax burns cleanly.</p>
      <h2>What matters as much as the wax</h2>
      <p>How a candle smells and burns depends on the wick, the width of the vessel and how much fragrance is used, not only the wax. Many makers blend waxes to get the best of each.</p>`,
    shop: [{ label: 'Shop candles', href: '#/shop?f=candle' }],
    sources: [{ label: 'Coloured Bottles: candle wax types explained', url: 'https://colouredbottles.co.uk/blogs/news/candle-wax-types-guide' }, { label: 'Northwood Candle & Craft: soy vs paraffin vs coconut wax', url: 'https://northwoodcandleandcraft.com/blogs/news/soy-wax-vs-paraffin-vs-coconut-wax-which-is-right-for-you' }],
  },
  {
    slug: 'candle-and-roller', tag: 'Rituals', minutes: 2,
    title: 'Pair a candle with a roller',
    dek: 'Light it at home, wear it when you leave. One scent, two ways, a cue you can carry.',
    pic: { file: 'spring-blooms', w: 900, h: 860, alt: 'Candles in black tins seen from above, topped with dried flowers' },
    body: `
      <p>A scent becomes a cue when you meet it again and again at the same moment. A candle sets that moment at home. A roller in the same scent family lets you bring it with you: to your desk, the school run, a hard conversation.</p>
      <h2>How to start</h2>
      <p>Pick one moment you want to feel different, such as the first ten minutes after work. Light the candle then, and take three slow breaths. Through the day, roll the matching scent on your wrists when you want to come back to that feeling.</p>
      <p>Not sure where to start? <a href="#/explore">Find your scent</a>, or try the <a href="#/reset">free 7-day reset</a>.</p>`,
    shop: [{ label: 'Shop rollers', href: '#/shop?f=roller' }, { label: 'Shop candles', href: '#/shop?f=candle' }, { label: 'Ritual pairs', href: '#/shop' }],
    sources: [],
  },
];

const pic = (a: Article, sizes: string, eager = false) => `<img src="/img/studio/tins/${a.pic.file}-900.webp" srcset="/img/studio/tins/${a.pic.file}-480.webp 480w, /img/studio/tins/${a.pic.file}-900.webp 900w" sizes="${sizes}" alt="${esc(a.pic.alt)}" width="${a.pic.w}" height="${a.pic.h}" ${eager ? '' : 'loading="lazy" '}decoding="async">`;

/** Three journal cards for other pages (home). */
export function journalTeaserHTML(): string {
  const cards = ARTICLES.slice(0, 3).map(a => `<a class="jr-card" href="#/journal/${a.slug}"><span class="jr-pic">${pic(a, '(max-width: 820px) 60vw, 18vw')}</span><span class="jr-tag">${esc(a.tag)} · ${a.minutes} min</span><b>${esc(a.title)}</b><span class="d jr-dek">${esc(a.dek)}</span></a>`).join('');
  return `<section class="wrap jr-teaser" aria-labelledby="jrH"><div class="jr-head"><div><span class="eyebrow">The Journal</span><h2 id="jrH"><span class="d">Candle care, <span class="it">and the rituals around it.</span></span></h2></div><a class="tlink" href="#/journal">Read the Journal</a></div><div class="jr-cards">${cards}</div></section>`;
}

export function renderJournal(app: HTMLElement, slug?: string) {
  const a = slug ? ARTICLES.find(x => x.slug === slug) : undefined;
  if (slug && !a) { replaceRoute('/journal'); return; }
  if (!a) {
    app.innerHTML = `<div class="wrap jr-index"><div class="crumbs"><a href="#/">Home</a> / Journal</div>
      <header class="jr-hero"><span class="eyebrow">The Journal</span><h1><span class="d">Candle care, <span class="it">and the rituals around it.</span></span></h1><p class="muted d">Short, useful reads from the studio in White Rock, BC: how to burn a candle well, how candles are made, and how to make a scent part of your day.</p></header>
      <div class="jr-grid">${ARTICLES.map((x, i) => `<a class="jr-card${i === 0 ? ' lead' : ''}" href="#/journal/${x.slug}"><span class="jr-pic">${pic(x, i === 0 ? '(max-width: 820px) 80vw, 40vw' : '(max-width: 820px) 60vw, 22vw', i === 0)}</span><span class="jr-tag">${esc(x.tag)} · ${x.minutes} min read</span><b>${esc(x.title)}</b><span class="d jr-dek">${esc(x.dek)}</span></a>`).join('')}</div>
    </div>`;
    document.title = 'Journal · Daily Rituals Co.';
    return;
  }
  const i = ARTICLES.indexOf(a), next = ARTICLES[(i + 1) % ARTICLES.length];
  app.innerHTML = `<article class="wrap jr-article"><div class="crumbs"><a href="#/">Home</a> / <a href="#/journal">Journal</a> / ${esc(a.title)}</div>
    <header class="jr-ahead"><div><span class="jr-tag">${esc(a.tag)} · ${a.minutes} min read</span><h1><span class="d">${esc(a.title)}</span></h1><p class="jr-lede d">${esc(a.dek)}</p></div><figure class="jr-apic">${pic(a, '(max-width: 820px) 80vw, 36vw', true)}</figure></header>
    <div class="jr-body d">${a.body}</div>
    <aside class="jr-shop" aria-label="Shop"><span class="eyebrow">From the studio</span><p class="d">Hand-poured in White Rock, BC, on wooden wicks.</p><div class="cta">${a.shop.map((s, k) => `<a class="btn${k ? ' line' : ''}" href="${s.href}">${esc(s.label)}</a>`).join('')}</div></aside>
    ${a.sources.length ? `<footer class="jr-sources"><span class="eyebrow">Sources</span><ul>${a.sources.map(s => `<li><a href="${s.url}" target="_blank" rel="noopener">${esc(s.label)}</a></li>`).join('')}</ul><p class="small muted">General guidance. Always follow the care card that comes with your candle.</p></footer>` : ''}
    <a class="jr-next" href="#/journal/${next.slug}"><span class="eyebrow">Next</span><b>${esc(next.title)}</b></a>
  </article>`;
  document.title = `${a.title} · Daily Rituals Co.`;
}
