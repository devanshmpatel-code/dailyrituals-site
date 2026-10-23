import { MOODS, FORMAT_LABEL, type Mood, type Format } from '../config';
import { loadCatalogue, money, type Item } from '../wix';
import { esc, errorBox, wireCommon, cardHTML } from '../ui';
import { wireQuickAdd } from './shared';
import { mountOffers } from './offers';
import { mountWheel } from './wheel';
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
        ${faq('Which scent should I choose?', 'Start with a mood. The <a href="#/explore?tab=quiz">scent quiz</a> takes four quick questions, or read the <a href="#/explore">scent atlas</a> to see every scent by mood. Each scent comes in more than one format, so you can wear it, diffuse it and light it.')}
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
      <a class="way" href="#/explore?tab=quiz"><span class="eyebrow">Four questions</span><h3>Find your scent</h3><p class="muted small">A quick quiz that leads you to a mood and the scents in it.</p></a>
      <a class="way" href="#/book"><span class="eyebrow">Free · <span class="d">20 min</span></span><h3>Free discovery call</h3><p class="muted small">Talk with Claire about your goals.</p></a>
      <a class="way" href="#/journal"><span class="eyebrow">The Journal</span><h3>Candle care</h3><p class="muted small">How to burn a wooden-wick candle, and the rituals around it.</p></a>
    </div></div>`;
}

export async function renderExplore(app: HTMLElement, params: URLSearchParams = new URLSearchParams()) {
  const tab = params.get('tab') === 'quiz' ? 'quiz' : 'wheel';
  // draft for Claire: the lead describes the scent atlas (wheel.ts). The tabs are the one place to switch between the atlas and
  // the quiz (the owner chose "Scent atlas", a plain noun, over "Read the atlas"); the atlas panel no longer repeats them.
  app.innerHTML = `<div class="wrap" style="padding-bottom:clamp(48px,6vw,96px)">
    ${head('Find your scent', 'Find your <span class="it">scent</span>', 'Two ways in: read the scent atlas, where every mood is a constellation and every star a scent, or answer four quick questions.')}
    <div class="toggle findtabs" role="tablist" aria-label="How to find your scent">
      <a role="tab" href="#/explore" aria-selected="${tab === 'wheel'}">Scent atlas</a>
      <a role="tab" href="#/explore?tab=quiz" aria-selected="${tab === 'quiz'}">Take the quiz</a></div>
    <div id="wheelMount"><div class="sk-line"></div><div class="sk-line short"></div></div>
    <div id="exp"></div></div>`;
  if (tab === 'quiz' || !window.matchMedia('(min-width: 1024px)').matches) mountOffers(app); // (the atlas wants the whole width on a desktop)
  const box = app.querySelector<HTMLElement>('#exp')!;
  let items: Item[];
  try { items = await loadCatalogue(); } catch (e) { app.querySelector('#wheelMount')!.innerHTML = errorBox(String((e as Error).message ?? e)); return; }
  const mount = app.querySelector<HTMLElement>('#wheelMount')!;
  if (tab === 'quiz') { mountQuiz(mount, items); return; }
  mountWheel(mount, items, params.get('mood') as Mood | null);

  const group = (title: string, swatch: string | null, link: string, list: Item[]) => {
    const byScent = new Map<string, Item[]>();
    list.forEach(i => byScent.set(i.scent, [...(byScent.get(i.scent) ?? []), i]));
    if (!byScent.size) return '';
    const rows = [...byScent].sort(([a], [b]) => a.localeCompare(b)).map(([scent, l]) =>
      `<div class="fl-card"><h3>${esc(scent)}</h3>
        <div class="fl-fmts">${l.sort((a, b) => a.format.localeCompare(b.format)).map(i =>
          `<a href="#/product/${i.slug}"><span>${esc(FORMAT_LABEL[i.format])}</span><b>${i.priceMin === i.priceMax ? money(i.priceMin) : `from ${money(i.priceMin)}`}</b></a>`).join('')}</div></div>`).join('');
    return `<section class="fl-group" style="--sw:${swatch ?? '#8C7A99'}"><div class="fl-head">
      <span class="fl-dot" aria-hidden="true"></span><h2>${title}</h2>${link}</div><div class="fl-cards">${rows}</div></section>`;
  };
  box.innerHTML = `<h2 class="fl-title">The full list</h2>` +
    (Object.keys(MOODS) as Mood[]).map(m => group(MOODS[m].label, MOODS[m].swatch, `<a class="small" href="#/shop?f=all&m=${m}&s=featured">Shop this mood</a>`, items.filter(i => i.mood === m))).join('') +
    group('More from the studio', null, '<a class="small" href="#/shop">Shop all</a>', items.filter(i => !i.mood));
}

// ---------- Quiz (a tab of Find your scent) ----------
// An option is [words, mood, draft]: draft marks wording Claire has not confirmed yet (shown highlighted with "Show drafts").
type QOpt = [string, Mood, boolean?];
const QUIZ: { q: string; qd?: boolean; a: QOpt[] }[] = [
  { q: 'When do you want a pick-me-up?', qd: true, a: [['First thing, before the inbox opens', 'fresh', true], ['Heading out the door into the day', 'sunny', true], ['That 3 pm slump', 'grounding', true], ['When work ends and the evening starts', 'woody', true], ['Winding down before bed', 'floral', true]] },
  { q: 'Which place feels most like you?', a: [['A cold, clear shoreline', 'fresh'], ['A beach cabana in the sun', 'sunny'], ['A garden in full bloom', 'floral'], ['A cabin with a fire going', 'woody'], ['In the middle of a forest', 'grounding', true]] },
  { q: 'Pick a weekend plan', a: [['A swim and a long walk', 'fresh'], ['A patio and something cold to drink', 'sunny'], ['Flowers, a book and a bath', 'floral'], ['A campfire with friends', 'woody'], ['Stretching, tea and no phone', 'grounding']] },
  { q: 'How should it make you feel?', a: [['Bright and clean', 'fresh'], ['Warm and playful', 'sunny'], ['Soft and romantic', 'floral'], ['Cosy and rooted', 'woody'], ['Calm and centred', 'grounding']] },
];
const dspan = (html: string, draft?: boolean) => draft ? `<span class="d">${html}</span>` : html;

/** What the quiz may recommend: real, in stock, priced, in a mood, and never the deodorant or a -need-pics seasonal. */
export const quizBuyable = (i: Item) => i.inStock && i.priceMin > 0 && !!i.mood && i.format !== 'deodorant' && !/-need-pics$/.test(i.slug);

/** The mood most answers point to; a tie goes to the latest answer among the tied moods (the last question is how it should feel). */
export function quizMood(answers: Mood[]): Mood {
  const tally = new Map<Mood, number>();
  answers.forEach(m => tally.set(m, (tally.get(m) ?? 0) + 1));
  const most = Math.max(...tally.values());
  const tied = [...tally].filter(([, n]) => n === most).map(([k]) => k);
  return [...answers].reverse().find(a => tied.includes(a))!;
}

function mountQuiz(el: HTMLElement, items: Item[]) {
  const answers: Mood[] = [], picks: number[] = [];
  const draw = () => {
    const step = answers.length;
    if (step < QUIZ.length) {
      const { q, qd, a } = QUIZ[step];
      el.innerHTML = `<div class="panel" style="display:flex;flex-direction:column;gap:16px;max-width:760px">
          <span class="eyebrow">Question ${step + 1} of ${QUIZ.length}</span><h2 style="font-size:clamp(26px,3.4vw,38px)">${dspan(esc(q), qd)}</h2>
          <div style="display:flex;flex-direction:column;gap:10px">${a.map(([t, , d], i) => `<button class="chip" style="justify-content:flex-start;text-align:left;min-height:48px" data-ans="${i}">${dspan(esc(t), d)}</button>`).join('')}</div>
          ${step ? '<button class="btn line" id="qBack" style="align-self:flex-start">Back</button>' : ''}</div>`;
      el.querySelectorAll<HTMLButtonElement>('[data-ans]').forEach(b => b.addEventListener('click', () => { picks.push(Number(b.dataset.ans)); answers.push(a[Number(b.dataset.ans)][1]); draw(); }));
      el.querySelector('#qBack')?.addEventListener('click', () => { answers.pop(); picks.pop(); draw(); });
      return;
    }
    const top = quizMood(answers);
    // the visitor's own words that led here
    const why = answers.map((mood, i) => mood === top ? QUIZ[i].a.find(([, m]) => m === mood)! : null).filter((o): o is QOpt => !!o);
    const quoted = why.map(([t, , d]) => dspan(`&ldquo;${esc(t.charAt(0).toLowerCase() + t.slice(1))}&rdquo;`, d));
    const whyText = quoted.length === 1 ? quoted[0] : `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`;
    // the scents in the winning mood that can be bought today, the ones that come in the most formats first (one with a candle
    // first), then by name. The same four answers always lead to the same scent; different answers move through the mood's scents
    // (the sum of the option positions picks which), so every scent in a mood gets to be the best match for someone.
    const FMT_ORDER: Format[] = ['candle', 'roller', 'diffuser', 'deodorant'];
    const inMood = items.filter(i => i.mood === top && quizBuyable(i));
    const byScent = new Map<string, Item[]>();
    inMood.forEach(i => byScent.set(i.scent, [...(byScent.get(i.scent) ?? []), i]));
    const hasCandle = (l: Item[]) => Number(l.some(i => i.format === 'candle'));
    const scents = [...byScent].sort(([a, x], [b, y]) => y.length - x.length || hasCandle(y) - hasCandle(x) || a.localeCompare(b));
    const best = scents.length ? scents[picks.reduce((n, p) => n + p, 0) % scents.length] : undefined;
    const bestFormats = best ? [...best[1]].sort((a, b) => FMT_ORDER.indexOf(a.format) - FMT_ORDER.indexOf(b.format)) : [];
    const lead = bestFormats[0];
    const rest = inMood.filter(i => !bestFormats.includes(i)).sort((a, b) => FMT_ORDER.indexOf(a.format) - FMT_ORDER.indexOf(b.format) || a.scent.localeCompare(b.scent));
    const leadWord = (i: Item) => i.format === 'candle' ? `${i.scent} candle` : i.format === 'roller' ? `${i.scent} roller` : `${i.scent} mini diffuser`;
    let forWho: 'me' | 'gift' = 'me';
    el.innerHTML = `<div class="qres" data-mood="${top}" data-scent="${best ? esc(best[0]) : ''}" data-lead="${lead?.slug ?? ''}">
      <div class="qres-head"><span class="eyebrow">Your result</span><h2>Your mood: <span class="it">${MOODS[top].label}</span></h2>
        <p class="qres-why">Because you chose ${whyText}.</p></div>
      ${lead ? `<div class="qbest"><a class="qbest-ph" href="#/product/${lead.slug}" tabindex="-1" aria-hidden="true"><img src="${lead.image}" alt="" loading="lazy"></a>
        <div class="qbest-tx"><span class="eyebrow"><span class="swatch" style="background:${MOODS[top].swatch}"></span>Your best match</span><h3>${esc(best![0])}</h3>
          <p class="muted"><span class="d">${esc(best![0])} comes in ${bestFormats.length === 1 ? 'one format' : `${bestFormats.length} formats`}${bestFormats.length > 1 ? ', so the same scent can follow you through the day' : ''}.</span></p>
          <div class="qbest-fmts">${bestFormats.map(i => `<a href="#/product/${i.slug}"><span>${esc(i.formatLabel)}</span><b>${i.priceMin === i.priceMax ? money(i.priceMin) : `from ${money(i.priceMin)}`}</b></a>`).join('')}</div></div></div>` : ''}
      <div class="qfor" role="group" aria-label="Who is it for?"><span>Who is it for?</span><button type="button" class="chip" data-for="me" aria-pressed="true">Me</button><button type="button" class="chip" data-for="gift" aria-pressed="false">A gift</button></div>
      <div class="cta qcta" id="qCta"></div>
      ${rest.length ? `<h3 class="qmore">More in ${esc(MOODS[top].label.toLowerCase())}</h3>` : ''}
      <div class="grid" id="qGrid">${rest.length ? rest.map(i => cardHTML(i)).join('') : lead ? cardHTML(lead) : '<p class="muted">No scents in this mood yet. Browse the whole shop instead.</p>'}</div>
      <div class="cta" style="margin-top:24px"><button class="btn line" id="qAgain">Retake the quiz</button></div></div>`;
    const cta = () => {
      el.querySelector('#qCta')!.innerHTML = forWho === 'gift'
        ? `<a class="btn" href="#/gift">Send it as a gift</a><a class="btn line" href="#/shop?f=all&m=${top}&s=featured">Shop this mood</a>`
        : `${lead ? `<a class="btn" id="qLead" href="#/product/${lead.slug}">See the ${esc(leadWord(lead))}</a>` : ''}<a class="btn line" href="#/shop?f=all&m=${top}&s=featured">Shop this mood</a><a class="btn line" href="#/explore?mood=${top}">See it in the atlas</a>`;
    };
    cta();
    el.querySelectorAll<HTMLButtonElement>('[data-for]').forEach(b => b.addEventListener('click', () => {
      forWho = b.dataset.for as 'me' | 'gift'; el.querySelectorAll('[data-for]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); cta();
    }));
    wireQuickAdd(el.querySelector<HTMLElement>('#qGrid')!, items);
    el.querySelector('#qAgain')!.addEventListener('click', () => { answers.length = 0; picks.length = 0; draw(); });
    el.scrollIntoView({ block: 'start' });
  };
  draw();
}
