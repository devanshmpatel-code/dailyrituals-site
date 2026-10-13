import { MOODS, FORMAT_LABEL, type Mood, type Format } from '../config';
import { loadCatalogue, money, type Item } from '../wix';
import { esc, errorBox, wireCommon, cardHTML } from '../ui';
import { wireQuickAdd, previewOff } from './shared';
import { mountWheel } from './wheel';
import { givingStoryHTML, mountGivingStory } from './giving';
import '../giftbook.css';

// Placeholder copy for pages that were not in the final canvas. Anything Claire has not
// confirmed is wrapped in <span class="d"> so "Show drafts for Claire" highlights it.
// Only facts already in the canvas are stated plainly: hand poured in small batches in
// British Columbia, free shipping over $75 in Canada, tax and shipping at checkout, hand packed.

// solo = true on narrow pages (account, reset): the title and lead stack in one column instead of squeezing side by side.
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
        ${faq('What does shipping cost?', 'Shipping is free on Canadian orders over $75. GST, PST and shipping are calculated at checkout. <span class="d confirm">Rates for orders under $75 to be confirmed by Claire.</span>')}
        ${faq('How long will my order take?', '<span class="d">Processing and delivery times to be confirmed by Claire. Every order is packed by hand.</span>', true)}
        ${faq('Do you ship outside Canada?', '<span class="d">To be confirmed by Claire.</span>', true)}
        ${faq('What is your return policy?', '<span class="d">Return and refund terms to be confirmed by Claire before launch.</span>', true)}
        ${faq('What if something arrives damaged?', '<span class="d">Please contact us with your order number and a photo. Claire to confirm the process.</span>', true)}
        <span class="eyebrow help-sub">Choosing and caring</span>
        <h2 class="help-h">Scents and <span class="it">candles</span></h2>
        ${faq('Which scent should I choose?', 'Start with a mood. The <a href="#/explore?tab=quiz">scent quiz</a> takes four quick questions, or read the <a href="#/explore">scent atlas</a> to see every scent by mood. Each scent comes in more than one format, so you can wear it, diffuse it and light it.')}
        ${faq('How do I care for a wooden-wick candle?', 'Trim the wick short before each light, and let the first burn melt the wax right to the edge. The Journal has the details: <a href="#/journal/wooden-wick">how to burn a wooden-wick candle</a>, <a href="#/journal/first-burn">your first burn</a> and <a href="#/journal/candle-safety">candle safety</a>.')}
        ${faq('Can I send something as a gift?', 'Gift wrap is available. <a href="#/gift">Send a Sunrise</a> shows the gifts we are getting ready, with a note in Claire\'s card.')}
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
      <div class="st-v v1"><span class="eyebrow">Made with intention</span><h3>Clean, simple products</h3><p class="muted">Rollers, mini diffusers, candles and deodorant, each one made to mark a moment in your day.</p></div>
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
      <a class="way" href="#/reset"><span class="eyebrow">Free · Self-paced</span><h3>The free 7-day reset</h3><p class="muted small">Ten minutes a day with Claire.</p></a>
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
const QUIZ: { q: string; a: [string, Mood][] }[] = [
  { q: 'When do you want your scent to do the most?', a: [['First thing, before the day starts', 'fresh'], ['On the way out the door', 'sunny'], ['Midday, to reset', 'grounding'], ['Golden hour, when work ends', 'woody'], ['Late evening, to wind down', 'floral']] },
  { q: 'Which place feels most like you?', a: [['A cold, clear shoreline', 'fresh'], ['A beach cabana in the sun', 'sunny'], ['A garden in full bloom', 'floral'], ['A cabin with a fire going', 'woody'], ['A quiet room with nothing on', 'grounding']] },
  { q: 'Pick a weekend plan', a: [['A swim and a long walk', 'fresh'], ['A patio and something cold to drink', 'sunny'], ['Flowers, a book and a bath', 'floral'], ['A campfire with friends', 'woody'], ['Stretching, tea and no phone', 'grounding']] },
  { q: 'How should it make you feel?', a: [['Bright and clean', 'fresh'], ['Warm and playful', 'sunny'], ['Soft and romantic', 'floral'], ['Cosy and rooted', 'woody'], ['Calm and centred', 'grounding']] },
];

function mountQuiz(el: HTMLElement, items: Item[]) {
  const answers: Mood[] = [];
  const draw = () => {
    const step = answers.length;
    if (step < QUIZ.length) {
      const { q, a } = QUIZ[step];
      el.innerHTML = `<div class="panel" style="display:flex;flex-direction:column;gap:16px;max-width:760px">
          <span class="eyebrow">Question ${step + 1} of ${QUIZ.length}</span><h2 style="font-size:clamp(26px,3.4vw,38px)">${esc(q)}</h2>
          <div style="display:flex;flex-direction:column;gap:10px">${a.map(([t], i) => `<button class="chip" style="justify-content:flex-start;text-align:left;min-height:48px" data-ans="${i}">${esc(t)}</button>`).join('')}</div>
          ${step ? '<button class="btn line" id="qBack" style="align-self:flex-start">Back</button>' : ''}</div>`;
      el.querySelectorAll<HTMLButtonElement>('[data-ans]').forEach(b => b.addEventListener('click', () => { answers.push(a[Number(b.dataset.ans)][1]); draw(); }));
      el.querySelector('#qBack')?.addEventListener('click', () => { answers.pop(); draw(); });
      return;
    }
    const tally = new Map<Mood, number>();
    answers.forEach(m => tally.set(m, (tally.get(m) ?? 0) + 1));
    // the mood most answers point to; a tie goes to the latest answer among the tied moods
    const most = Math.max(...tally.values());
    const tied = [...tally].filter(([, n]) => n === most).map(([k]) => k);
    const top = [...answers].reverse().find(a => tied.includes(a))!;
    // the visitor's own words that led here
    const why = answers.map((mood, i) => mood === top ? QUIZ[i].a.find(([, m]) => m === mood)![0] : '').filter(Boolean);
    const quoted = why.map(t => `&ldquo;${esc(t.charAt(0).toLowerCase() + t.slice(1))}&rdquo;`);
    const whyText = quoted.length === 1 ? quoted[0] : `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`;
    // the best match: the scent in this mood that comes in the most formats (one with a candle first), then by name
    const FMT_ORDER: Format[] = ['candle', 'roller', 'diffuser', 'deodorant'];
    const inMood = items.filter(i => i.mood === top && i.inStock);
    const byScent = new Map<string, Item[]>();
    inMood.forEach(i => byScent.set(i.scent, [...(byScent.get(i.scent) ?? []), i]));
    const hasCandle = (l: Item[]) => Number(l.some(i => i.format === 'candle'));
    const best = [...byScent].sort(([a, x], [b, y]) => y.length - x.length || hasCandle(y) - hasCandle(x) || a.localeCompare(b))[0];
    const bestFormats = best ? [...best[1]].sort((a, b) => FMT_ORDER.indexOf(a.format) - FMT_ORDER.indexOf(b.format)) : [];
    const lead = bestFormats[0];
    const rest = inMood.filter(i => !bestFormats.includes(i)).sort((a, b) => FMT_ORDER.indexOf(a.format) - FMT_ORDER.indexOf(b.format) || a.scent.localeCompare(b.scent));
    let forWho: 'me' | 'gift' = 'me';
    el.innerHTML = `<div class="qres">
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
        : `${lead ? `<a class="btn" href="#/product/${lead.slug}">See the ${esc(lead.name)}${lead.format === 'candle' ? ' candle' : ''}</a>` : ''}<a class="btn line" href="#/shop?f=all&m=${top}&s=featured">Shop this mood</a><a class="btn line" href="#/explore?mood=${top}">See it in the atlas</a>`;
    };
    cta();
    el.querySelectorAll<HTMLButtonElement>('[data-for]').forEach(b => b.addEventListener('click', () => {
      forWho = b.dataset.for as 'me' | 'gift'; el.querySelectorAll('[data-for]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); cta();
    }));
    wireQuickAdd(el.querySelector<HTMLElement>('#qGrid')!, items);
    el.querySelector('#qAgain')!.addEventListener('click', () => { answers.length = 0; draw(); });
    el.scrollIntoView({ block: 'start' });
  };
  draw();
}

// ---------- Free 7-day reset ----------
// A short look at Day 1, beside the sign-up. Every line restates what the site already says about the reset (it arrives by
// email, short daily videos and practices of about ten minutes, self-paced) and the coaching page's "why patterns repeat";
// what Day 1 really holds is Claire's to confirm, so all of it is a draft.
function day1HTML() {
  return `<div class="reset-day1" aria-labelledby="day1H"><span class="eyebrow">A look at Day 1</span><h2 id="day1H" class="reset-day1-h"><span class="d">What the first ten minutes <span class="it">look like</span></span></h2>
    <ul>
      <li><b><span class="d">In your inbox</span></b><span><span class="d">Day 1 arrives as soon as you join: a short video from Claire and one practice to try.</span></span></li>
      <li><b><span class="d">About ten minutes</span></b><span><span class="d">Watch, then try the practice, at your own pace.</span></span></li>
      <li><b><span class="d">Where it starts</span></b><span><span class="d">Why patterns repeat: most habits are not a lack of willpower, but a loop your brain has practised many times.</span></span></li>
    </ul>
    <p class="small muted d confirm">[Confirm: is this what Day 1 covers, and is it a video?]</p></div>`;
}

export function renderReset(app: HTMLElement) {
  // the steps restate what the page already says (ten minutes a day, self-paced, by email); the day-by-day content is Claire's to add
  app.innerHTML = `<div class="wrap reset-page" style="padding-bottom:clamp(48px,6vw,96px);max-width:1080px">
    ${head('Free 7-day reset', 'The free 7-day <span class="it">reset</span>', 'Ten minutes a day with Claire. A light, self-paced way to try the practices before anything else.', true)}
    <div class="reset-grid">
      <div class="panel reset-join" style="display:flex;flex-direction:column;gap:14px">
        <div class="reset-who"><img class="reset-claire" src="/img/studio/web/claire-round.webp" alt="Claire, founder of Daily Rituals Co." width="360" height="360" decoding="async"><span><span class="eyebrow">Free · Self-paced</span><span class="reset-by">With Claire, neuro coach · White Rock, BC</span></span></div>
        <h2>Start with <span class="it">Day 1</span></h2>
        <p>Join with your email and the first day arrives in your inbox. <span class="d confirm">Claire to confirm what is in each day and how it is delivered.</span></p>
        <form id="resetForm" class="reset-form" novalidate>
          <label for="resetEmail" hidden>Email</label><input id="resetEmail" type="email" placeholder="you@example.com" autocomplete="email" required>
          <button class="btn euc" type="submit">Start Day 1</button></form>
        <p class="small muted">Free. You can unsubscribe any time. Coaching is not therapy or medical care. <span class="d confirm">Claire to confirm wording.</span></p></div>
      <div class="reset-side"><ol class="reset-steps">
        <li><b>Join with your email</b><span>Day 1 arrives in your inbox.</span></li>
        <li><b>Ten minutes a day</b><span>One short practice from Claire, at your own pace.</span></li>
        <li><b>Seven days</b><span class="d">On Day 3, a familiar scent becomes the cue for a calm, intentional pause.</span></li>
      </ol>
      ${day1HTML()}</div>
    </div>
    <div class="reset-pair"><div><span class="eyebrow">Pair it with a scent</span><h2>A scent you love makes the <span class="it">pause easier to find</span></h2>
      <p class="muted"><span class="d">Any scent you enjoy will do. If you would like one to keep for the reset, a roller goes everywhere with you.</span></p></div>
      <div class="cta"><a class="btn" href="#/explore?tab=quiz">Find your scent</a><a class="btn line" href="#/shop?f=roller&m=all&s=featured">Shop rollers</a></div></div>
    <div class="cta" style="margin-top:24px"><a class="btn line btn-wrap" href="#/book">Book a free 20-minute discovery call instead</a></div></div>`;
  app.querySelector('#resetForm')!.addEventListener('submit', e => { e.preventDefault(); previewOff('Sign-ups')(); });
}
