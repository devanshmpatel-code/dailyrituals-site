import { type Format } from '../config';
import { loadCatalogue, money, type Item } from '../wix';
import { esc, errorBox, wireCommon, cardHTML, familiesHTML } from '../ui';
import { wireQuickAdd } from './shared';
import { mountOffers } from './offers';
import { mountScentSky, fullListHTML } from './scentsky';
import { FAMILIES, FAMILY_ORDER, SCENTS, isBuyable, scentKey, type Family, type ScentDef } from '../data/scents';
import { givingStoryHTML, mountGivingStory } from './giving';
import '../giftbook.css';

// Placeholder copy for pages that were not in the final canvas. Anything Claire has not
// confirmed is wrapped in <span class="d"> so "Show drafts for Claire" highlights it.
// Only facts already in the canvas are stated plainly: hand poured in small batches in
// British Columbia, free shipping over $150 in Canada, tax and shipping at checkout, hand packed.

// solo = true on narrow pages (account): the title and lead stack in one column instead of squeezing side by side.
const head = (crumb: string, title: string, lead: string, solo = false) => `
  <div class="phead${solo ? ' solo' : ''}"><div class="crumbs"><a href="#/">Home</a> / ${esc(crumb)}</div>
  <div class="cat-hero"><h1>${title}</h1><p class="muted" style="font-size:18px;max-width:56ch">${lead}</p></div></div>`;

// draft = true: Claire has not confirmed the answer, so it is only visible with "Show drafts".
const faq = (q: string, a: string, draft = false) => `<details${draft ? ' class="d confirm"' : ''}><summary>${q}</summary><div class="dbody"><p>${a}</p></div></details>`;

export function renderHelp(app: HTMLElement) {
  app.innerHTML = `<div class="wrap" style="padding-bottom:clamp(48px,6vw,96px)">
    ${head('Help', 'Help and <span class="it">contact</span>', 'Shipping, returns, candle care and how to reach us. Orders are packed by hand, so small questions are welcome.')}
    <div class="split help-split" style="align-items:start">
      <div class="help-faq"><span class="eyebrow">Shipping</span>
        <h2 class="help-h">Shipping and <span class="it">returns</span></h2>
        ${faq('What does shipping cost?', 'Shipping is free on Canadian orders over $150. GST, PST and shipping are calculated at checkout. <span class="d confirm">Rates for orders under $150 to be confirmed by Claire.</span>')}
        ${faq('How long will my order take?', '<span class="d">Processing and delivery times to be confirmed by Claire. Every order is packed by hand.</span>', true)}
        ${faq('Do you ship outside Canada?', '<span class="d">To be confirmed by Claire.</span>', true)}
        ${faq('What is your return policy?', '<span class="d">Return and refund terms to be confirmed by Claire before launch.</span>', true)}
        ${faq('What if something arrives damaged?', '<span class="d">Please contact us with your order number and a photo. Claire to confirm the process.</span>', true)}
        <span class="eyebrow help-sub">Choosing and caring</span>
        <h2 class="help-h">Scents and <span class="it">candles</span></h2>
        ${faq('Which scent should I choose?', '<span class="d">Start with a scent family.</span> The <a href="#/explore?tab=quiz">scent quiz</a> takes four quick questions, or explore the <a href="#/explore">Scent Sky</a> to see every scent by family. Each scent comes in more than one format, so you can wear it, diffuse it and light it.')}
        ${faq('How do I care for a wooden-wick candle?', 'Trim the wick short before each light, and let the first burn melt the wax right to the edge. The Journal has the details: <a href="#/journal/wooden-wick">how to burn a wooden-wick candle</a>, <a href="#/journal/first-burn">your first burn</a> and <a href="#/journal/candle-safety">candle safety</a>.')}
        ${faq('Can I send something as a gift?', 'Gift wrap is available. <a href="#/gift">Send a Sky</a> shows the gifts we are getting ready, with a note in Claire\'s card.')}
        ${faq('Is there a refill subscription?', '<span class="d">Not yet. Ritual on Repeat is coming soon: when it opens, the plan is that you can skip, change the date or swap scents before the next order ships.</span> <a href="#/subscribe">How it will work</a>.')}
      </div>
      <div class="panel help-contact" style="display:flex;flex-direction:column;gap:12px">
        <span class="eyebrow">Contact</span><h3 style="font-size:28px">Say hello</h3>
        <p class="muted d confirm">Contact email and response time to be confirmed by Claire.</p>
        <p class="muted">Not sure what to choose? The quiz is the quickest way in. For coaching, the first call is free.</p>
        <div class="help-acts"><a class="btn" href="#/explore?tab=quiz">Take the scent quiz</a><a class="btn line" href="#/book">Book a free 20-minute discovery call</a><a class="btn line" href="#/coaching">Coaching questions</a></div>
        <p class="small muted">Coaching is not therapy or medical care. <span class="d confirm">Claire to confirm wording.</span></p>
      </div>
    </div>
    <div class="next-band"><div><span class="eyebrow">Ready when you are</span><h2>Find the scent for your <span class="it">day</span></h2></div><div class="cta"><a class="btn" href="#/shop">Shop the rituals</a><a class="btn line" href="#/journal">Read the Journal</a></div></div>
    </div>`;
  wireCommon(app);
}

export function renderStory(app: HTMLElement) {
  // "Meet the maker": the owner asked for Claire's own voice ("My story", not "Our story"). Every fact is one the site already
  // states (coaching page, footer); the first-person wording is new, so it is a draft for Claire (.d). Claire to expand it.
  const beats: [string, string][] = [
    ['Years of searching', 'I lived with chemical sensitivities for years.'],
    ['A new way in', "With a doctor's guidance I discovered neuroplasticity and learned to rewire my brain's response."],
    ['Learning to teach it', 'I trained as a neuro coach to share that knowledge.'],
    ['Daily Rituals Co.', 'So I began making clean products with intention, hand poured in small batches in British Columbia, with coaching alongside.'],
  ];
  app.innerHTML = `<div class="story">
    <section class="st-hero"><div class="wrap">
      <div class="st-tx"><span class="small"><a href="#/">Home</a> <span class="muted">/ Meet the maker</span></span><span class="eyebrow">Meet the maker</span><h1>My <span class="it">story</span></h1>
        <p class="lead"><span class="d">Hi, I'm Claire. I make clean products with intention, hand poured in small batches in British Columbia, and I coach people through the habits behind their days.</span></p></div>
      <div class="st-ph"><img src="/img/studio/web/hero-verdant-1000.webp" srcset="/img/studio/web/hero-verdant-720.webp 720w, /img/studio/web/hero-verdant-1000.webp 1000w" sizes="(max-width: 820px) 90vw, 44vw" alt="Verdant: a lit candle in a glass tumbler with the black Daily Rituals label, a small lit black tin in front" width="1000" height="1000" decoding="async"></div>
    </div></section>
    <section class="wrap st-path"><span class="eyebrow">How it began</span><h2><span class="d">From one life changed <span class="it">to a daily practice.</span></span></h2>
      <ol class="st-steps">${beats.map(([t, d], i) => `<li style="--i:${i}"><span class="st-dot" aria-hidden="true">${['\u2726', '\u2735', '\u2740', '\u2600'][i]}</span><b>${t}</b><p><span class="d">${d}</span></p></li>`).join('')}</ol>
      <p class="small muted d confirm">Draft from the coaching page text. Claire to add dates, detail and photos.</p></section>
    <section class="st-quote"><div class="wrap"><img class="st-claire" src="/img/studio/web/claire-round.webp" alt="Claire, founder of Daily Rituals Co." width="360" height="360" loading="lazy" decoding="async"><blockquote>&ldquo;Others deserved access to the brain-change knowledge that transformed my life.&rdquo;<cite>Claire, neuro coach</cite></blockquote></div></section>
    <section class="wrap st-vals"><div class="ways three">
      <div class="st-v v1"><span class="eyebrow">Made with intention</span><h3>Clean, simple products</h3><p class="muted">Rollers, mini diffusers and candles, each one made to mark a moment in your day.</p></div>
      <div class="st-v v2"><span class="eyebrow">Small batch</span><h3>Hand poured in BC</h3><p class="muted">Made in small batches in British Columbia.</p></div>
      <div class="st-v v3"><span class="eyebrow">Habits, made easier</span><h3>Coaching alongside</h3><p class="muted">The scents create a moment. Coaching with Claire helps you change what happens next.</p></div>
    </div>
    <div class="cta" style="justify-content:center;margin-top:36px"><a class="btn" href="#/shop">Shop the rituals</a><a class="btn line" href="#/coaching">Meet the coaching</a></div></section>
    ${givingStoryHTML()}
  </div>`;
  // "Light that travels": $1 from every order, after Claire's story (src/pages/giving.ts)
  mountGivingStory(app);
}

export function renderAccount(app: HTMLElement) {
  app.innerHTML = `<div class="wrap acct-page" style="padding-bottom:clamp(48px,6vw,96px);max-width:1080px">
    ${head('My account', 'My <span class="it">rituals</span>', 'Your orders, saved details and favourite scents will live here.', true)}
    <div class="panel acct-panel">
      <span class="acct-mark" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1.2-3.6 3.8-5.5 7-5.5s5.8 1.9 7 5.5"/></svg></span>
      <div><span class="eyebrow">Sign-in opens soon</span>
        <h2>Shop now, <span class="it">no account needed</span></h2>
        <p class="muted"><span class="d">You will not need an account to place an order. When sign-in opens, your orders and details will be here.</span></p></div>
      <div class="cta"><a class="btn" href="#/shop">Shop the rituals</a><a class="btn line" href="#/help">Help with an order</a></div>
    </div>
    <span class="eyebrow acct-while">While you are here</span>
    <div class="ways three acct-ways">
      <a class="way" href="#/explore?tab=quiz"><span class="eyebrow">Four questions</span><h3>Find your scent</h3><p class="muted small"><span class="d">A quick quiz that leads you to a scent family and the scents in it.</span></p></a>
      <a class="way" href="#/book"><span class="eyebrow">Free · <span class="d">20 min</span></span><h3>Free discovery call</h3><p class="muted small">Talk with Claire about your goals.</p></a>
      <a class="way" href="#/journal"><span class="eyebrow">The Journal</span><h3>Candle care</h3><p class="muted small">How to burn a wooden-wick candle, and the rituals around it.</p></a>
    </div></div>`;
}

export async function renderExplore(app: HTMLElement, params: URLSearchParams = new URLSearchParams()) {
  const tab = params.get('tab') === 'quiz' ? 'quiz' : 'wheel';
  // draft for Claire: the lead describes the Scent Sky (scentsky.ts). The tabs are the one place to switch between the Sky and
  // the quiz; the Sky's panel no longer repeats them.
  app.innerHTML = `<div class="wrap" style="padding-bottom:clamp(48px,6vw,96px)">
    ${head('Find your scent', 'Find your <span class="it">scent</span>', '<span class="d">Two ways in: explore the Scent Sky, where every scent family is a constellation and every star a scent, or answer four quick questions.</span>')}
    <div class="toggle findtabs" role="tablist" aria-label="How to find your scent">
      <a role="tab" href="#/explore" aria-selected="${tab === 'wheel'}">Scent Sky</a>
      <a role="tab" href="#/explore?tab=quiz" aria-selected="${tab === 'quiz'}">Take the quiz</a></div>
    <div id="wheelMount"><div class="sk-line"></div><div class="sk-line short"></div></div>
    <div id="exp"></div></div>`;
  if (tab === 'quiz' || !window.matchMedia('(min-width: 1024px)').matches) mountOffers(app); // (the Sky wants the whole width on a desktop)
  const box = app.querySelector<HTMLElement>('#exp')!;
  let items: Item[];
  try { items = await loadCatalogue(); } catch (e) { app.querySelector('#wheelMount')!.innerHTML = errorBox(String((e as Error).message ?? e)); return; }
  const mount = app.querySelector<HTMLElement>('#wheelMount')!;
  if (tab === 'quiz') { mountQuiz(mount, items); return; }
  mountScentSky(mount, items, { family: params.get('family'), scent: params.get('scent'), mood: params.get('mood') });
  box.innerHTML = fullListHTML(items);
}

// ---------- Quiz (a tab of Find your scent) ----------
// Every option points to scent families (src/data/scents.ts), with weights: the strongest family of an option counts 2 or 3,
// its neighbours 1. Draft marks wording Claire has not confirmed yet (shown highlighted with "Show drafts"). The first
// question also says how the scent will be used: a diffuser for the start of the day at home, a roller for out and about,
// a candle for the evening.
type Weights = Partial<Record<Family, number>>;
interface QOpt { t: string; w: Weights; d?: boolean; fmt?: Format }
export const QUIZ: { q: string; qd?: boolean; a: QOpt[] }[] = [
  { q: 'When do you want a pick-me-up?', qd: true, a: [
    { t: 'First thing, before the inbox opens', w: { citrus: 2, green: 1, marine: 1 }, d: true, fmt: 'diffuser' },
    { t: 'Heading out the door into the day', w: { marine: 2, fruity: 1, citrus: 1 }, d: true, fmt: 'roller' },
    { t: 'That 3 pm slump', w: { spicy: 2, gourmand: 2, citrus: 1 }, d: true, fmt: 'roller' },
    { t: 'When work ends and the evening starts', w: { woody: 2, amber: 2, spicy: 1 }, d: true, fmt: 'candle' },
    { t: 'Winding down before bed', w: { floral: 2, amber: 1, aromatic: 1 }, d: true, fmt: 'candle' },
  ] },
  { q: 'Which place feels most like you?', a: [
    { t: 'A cold, clear shoreline', w: { marine: 3, citrus: 1 } },
    { t: 'A beach cabana in the sun', w: { fruity: 2, marine: 1, gourmand: 1 } },
    { t: 'A garden in full bloom', w: { floral: 2, green: 2, fruity: 1 } },
    { t: 'A cabin with a fire going', w: { woody: 2, spicy: 1, amber: 1 } },
    { t: 'In the middle of a forest', w: { green: 2, aromatic: 2, woody: 1 }, d: true },
  ] },
  { q: 'Pick a weekend plan', a: [
    { t: 'A swim and a long walk', w: { marine: 2, green: 1, aromatic: 1 } },
    { t: 'A patio and something cold to drink', w: { citrus: 2, fruity: 2 } },
    { t: 'Flowers, a book and a bath', w: { floral: 2, gourmand: 1, amber: 1 } },
    { t: 'A campfire with friends', w: { woody: 2, amber: 1, spicy: 1 } },
    { t: 'Stretching, tea and no phone', w: { aromatic: 2, green: 1, spicy: 1 } },
  ] },
  { q: 'How should it make you feel?', a: [
    { t: 'Bright and clean', w: { citrus: 2, marine: 1, green: 1 } },
    { t: 'Warm and playful', w: { fruity: 2, gourmand: 2 } },
    { t: 'Soft and romantic', w: { floral: 2, amber: 1, gourmand: 1 } },
    { t: 'Cosy and rooted', w: { amber: 2, woody: 1, gourmand: 1 } },
    { t: 'Calm and centred', w: { aromatic: 2, green: 1, woody: 1 } },
  ] },
];
const dspan = (html: string, draft?: boolean) => draft ? `<span class="d">${html}</span>` : html;

/** What the quiz may recommend: a product on the owner's list that Wix sells today (in stock and priced). */
export const quizBuyable = (i: Item) => isBuyable(i) && i.families.length > 0 && i.format !== 'deodorant';

// Every family gets the same say: a family's points are divided by how many points the whole quiz could ever give it, so a
// small family (Green, Aromatic, Marine Ozonic, Citrus) wins as fairly as a big one (Amber, Gourmand, Woody).
const PRIOR: Record<Family, number> = Object.fromEntries(FAMILY_ORDER.map(f => [f, QUIZ.reduce((n, q) => n + q.a.reduce((m, o) => m + (o.w[f] ?? 0), 0), 0)])) as Record<Family, number>;
const MEAN = FAMILY_ORDER.reduce((n, f) => n + PRIOR[f], 0) / FAMILY_ORDER.length;
const EPS = 1e-9;

export interface QuizResult {
  family: Family;
  scores: Record<Family, number>;
  scent?: ScentDef;
  /** the best match's buyable products, the lead (the preferred format) first */
  formats: Item[];
  lead?: Item;
  /** 'family': no buyable scent in the winning family, so the closest scent overall was taken; 'format': the scent is not sold in the preferred format */
  fallback: '' | 'family' | 'format';
}

/** The whole quiz as one pure function: the same four answers always give the same result. */
export function quizResult(picks: number[], items: Item[]): QuizResult {
  const scores = Object.fromEntries(FAMILY_ORDER.map(f => [f, 0])) as Record<Family, number>;
  picks.forEach((o, q) => Object.entries(QUIZ[q].a[o].w).forEach(([f, w]) => { scores[f as Family] += (w! * MEAN) / PRIOR[f as Family]; }));
  const max = Math.max(...FAMILY_ORDER.map(f => scores[f]));
  const tied = FAMILY_ORDER.filter(f => Math.abs(scores[f] - max) < EPS);
  // a tie goes to the latest answer's strongest tied family (the last question is how it should feel), then the list order
  let family: Family | undefined;
  for (let q = picks.length - 1; q >= 0 && !family; q--) {
    family = (Object.entries(QUIZ[q].a[picks[q]].w) as [Family, number][]).sort((a, b) => b[1] - a[1]).map(([f]) => f).find(f => tied.includes(f));
  }
  family ??= tied[0];
  // the scents that can be bought today, as the list names them
  const buy = new Map<string, Item[]>();
  items.filter(quizBuyable).forEach(i => { const k = scentKey(i.scent); buy.set(k, [...(buy.get(k) ?? []), i]); });
  const sellable = SCENTS.filter(d => buy.has(scentKey(d.name)));
  // a scent's match: the family scores of all its families, evened out so a scent in five families has no head start
  const match = (d: ScentDef) => d.families.reduce((n, f) => n + scores[f], 0) / Math.sqrt(d.families.length);
  let pool = sellable.filter(d => d.families.includes(family!)), fallback: QuizResult['fallback'] = '';
  if (!pool.length) { pool = sellable; fallback = 'family'; }
  if (!pool.length) return { family, scores, formats: [], fallback: 'family' };
  const best = Math.max(...pool.map(match));
  const top = pool.filter(d => Math.abs(match(d) - best) < EPS);
  // scents with the very same families tie exactly (Golden Apricot and Tropical Passion): the answers choose between them
  const scent = top[picks.reduce((n, p) => n + p, 0) % top.length];
  const want = QUIZ[0].a[picks[0]]?.fmt ?? 'candle';
  const order: Format[] = [want, ...(['candle', 'diffuser', 'roller'] as Format[]).filter(f => f !== want)];
  const formats = [...buy.get(scentKey(scent.name))!].sort((a, b) => order.indexOf(a.format) - order.indexOf(b.format));
  if (!fallback && formats[0].format !== want) fallback = 'format';
  return { family, scores, scent, formats, lead: formats[0], fallback };
}

function mountQuiz(el: HTMLElement, items: Item[]) {
  const picks: number[] = [];
  const draw = () => {
    const step = picks.length;
    if (step < QUIZ.length) {
      const { q, qd, a } = QUIZ[step];
      el.innerHTML = `<div class="panel" style="display:flex;flex-direction:column;gap:16px;max-width:760px">
          <span class="eyebrow">Question ${step + 1} of ${QUIZ.length}</span><h2 style="font-size:clamp(26px,3.4vw,38px)">${dspan(esc(q), qd)}</h2>
          <div style="display:flex;flex-direction:column;gap:10px">${a.map((o, i) => `<button class="chip" style="justify-content:flex-start;text-align:left;min-height:48px" data-ans="${i}">${dspan(esc(o.t), o.d)}</button>`).join('')}</div>
          ${step ? '<button class="btn line" id="qBack" style="align-self:flex-start">Back</button>' : ''}</div>`;
      el.querySelectorAll<HTMLButtonElement>('[data-ans]').forEach(b => b.addEventListener('click', () => { picks.push(Number(b.dataset.ans)); draw(); }));
      el.querySelector('#qBack')?.addEventListener('click', () => { picks.pop(); draw(); });
      return;
    }
    const r = quizResult(picks, items), top = r.family, F = FAMILIES[top];
    // the visitor's own words that led here: the answers that pointed most strongly to the winning family
    const why = picks.map((o, q) => QUIZ[q].a[o]).filter(o => (o.w[top] ?? 0) > 0 && (o.w[top] ?? 0) >= Math.max(...Object.values(o.w) as number[]));
    const words = (why.length ? why : picks.map((o, q) => QUIZ[q].a[o]).filter(o => (o.w[top] ?? 0) > 0)).map(o => dspan(`&ldquo;${esc(o.t.charAt(0).toLowerCase() + o.t.slice(1))}&rdquo;`, o.d));
    const whyText = !words.length ? '' : words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
    const lead = r.lead, best = r.scent;
    // more in the family: the other products that can be bought today, one card each, the best match's own left out
    const FMT_ORDER: Format[] = ['candle', 'roller', 'diffuser'];
    const rest = items.filter(i => quizBuyable(i) && i.families.includes(top) && !r.formats.includes(i))
      .sort((a, b) => SCENTS.findIndex(d => d.name === a.scent) - SCENTS.findIndex(d => d.name === b.scent) || FMT_ORDER.indexOf(a.format) - FMT_ORDER.indexOf(b.format));
    const leadWord = (i: Item) => i.format === 'candle' ? `${i.scent} candle` : i.format === 'roller' ? `${i.scent} roller` : `${i.scent} mini diffuser`;
    const price = (i: Item) => (i.priceMin === i.priceMax ? money(i.priceMin) : `from ${money(i.priceMin)}`);
    let forWho: 'me' | 'gift' = 'me';
    el.innerHTML = `<div class="qres" data-family="${top}" data-scent="${best ? esc(best.name) : ''}" data-lead="${lead?.slug ?? ''}" data-format="${lead?.format ?? ''}" data-fallback="${r.fallback}">
      <div class="qres-head"><span class="eyebrow">Your result</span><h2>Your scent family: <span class="it">${esc(F.label)}</span></h2>
        <p class="qres-desc"><span class="d">${esc(F.desc)}</span></p>
        ${whyText ? `<p class="qres-why">Because you chose ${whyText}.</p>` : ''}</div>
      ${lead && best ? `<div class="qbest"><a class="qbest-ph" href="#/product/${lead.slug}" tabindex="-1" aria-hidden="true"><img src="${lead.image}" alt="" loading="lazy"></a>
        <div class="qbest-tx"><span class="eyebrow"><span class="swatch" style="background:${F.swatch}"></span>Your best match</span><h3>${esc(best.name)}</h3>
          ${familiesHTML(best.families, 'fams qbest-fams')}
          <p class="muted"><span class="d">${esc(best.name)} comes in ${r.formats.length === 1 ? 'one format in the shop today' : `${r.formats.length} formats`}${r.formats.length > 1 ? ', so the same scent can follow you through the day' : ''}.</span></p>
          <div class="qbest-fmts">${r.formats.map(i => `<a href="#/product/${i.slug}"><span>${esc(i.formatLabel)}</span><b>${price(i)}</b></a>`).join('')}</div></div></div>` : ''}
      <div class="qfor" role="group" aria-label="Who is it for?"><span>Who is it for?</span><button type="button" class="chip" data-for="me" aria-pressed="true">Me</button><button type="button" class="chip" data-for="gift" aria-pressed="false">A gift</button></div>
      <div class="cta qcta" id="qCta"></div>
      ${rest.length ? `<h3 class="qmore">More in ${esc(F.label)}</h3>` : ''}
      <div class="grid" id="qGrid">${rest.length ? rest.map(i => cardHTML(i)).join('') : lead ? '' : '<p class="muted">Nothing in this family is in the shop today. Browse the whole shop instead.</p>'}</div>
      <div class="cta" style="margin-top:24px"><button class="btn line" id="qAgain">Retake the quiz</button></div></div>`;
    const shop = `<a class="btn line" href="#/shop?f=all&fam=${top}&s=featured">Shop ${esc(F.label)}</a>`;
    const cta = () => {
      el.querySelector('#qCta')!.innerHTML = forWho === 'gift'
        ? `<a class="btn" href="#/gift">Send it as a gift</a>${shop}`
        : `${lead ? `<a class="btn" id="qLead" href="#/product/${lead.slug}">See the ${esc(leadWord(lead))}</a>` : ''}${shop}<a class="btn line" href="#/explore?${best ? `scent=${best.id}` : `family=${top}`}">See it in the Scent Sky</a>`;
    };
    cta();
    el.querySelectorAll<HTMLButtonElement>('[data-for]').forEach(b => b.addEventListener('click', () => {
      forWho = b.dataset.for as 'me' | 'gift'; el.querySelectorAll('[data-for]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); cta();
    }));
    wireQuickAdd(el.querySelector<HTMLElement>('#qGrid')!, items);
    el.querySelector('#qAgain')!.addEventListener('click', () => { picks.length = 0; draw(); });
    el.scrollIntoView({ block: 'start' });
  };
  draw();
}
