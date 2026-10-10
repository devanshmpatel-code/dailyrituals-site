import { MOODS, FORMAT_LABEL, type Mood } from '../config';
import { loadCatalogue, money, type Item } from '../wix';
import { esc, errorBox, wireCommon, cardHTML } from '../ui';
import { wireQuickAdd, previewOff } from './shared';
import { mountWheel } from './wheel';

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
    ${head('Help', 'Help and <span class="it">contact</span>', 'Shipping, returns and how to reach us. Orders are packed by hand, so small questions are welcome.')}
    <div class="split" style="align-items:start">
      <div><span class="eyebrow">Shipping</span>
        <h2 style="font-size:clamp(30px,3.6vw,44px);margin:10px 0 16px">Shipping and <span class="it">returns</span></h2>
        ${faq('What does shipping cost?', 'Shipping is free on Canadian orders over $75. GST, PST and shipping are calculated at checkout. <span class="d confirm">Rates for orders under $75 to be confirmed by Claire.</span>')}
        ${faq('How long will my order take?', '<span class="d">Processing and delivery times to be confirmed by Claire. Every order is packed by hand.</span>', true)}
        ${faq('Do you ship outside Canada?', '<span class="d">To be confirmed by Claire.</span>', true)}
        ${faq('What is your return policy?', '<span class="d">Return and refund terms to be confirmed by Claire before launch.</span>', true)}
        ${faq('What if something arrives damaged?', '<span class="d">Please contact us with your order number and a photo. Claire to confirm the process.</span>', true)}
        ${faq('Can I cancel or change a Ritual on Repeat order?', 'Yes. Skip, change the date or swap scents any time before the next order ships.')}
      </div>
      <div class="panel help-contact" style="display:flex;flex-direction:column;gap:12px">
        <span class="eyebrow">Contact</span><h3 style="font-size:28px">Say hello</h3>
        <p class="muted d confirm">Contact email and response time to be confirmed by Claire.</p>
        <a class="btn line" href="#/coaching" style="align-self:flex-start">Coaching questions</a>
        <p class="small muted">Coaching is not therapy or medical care. <span class="d confirm">Claire to confirm wording.</span></p>
      </div>
    </div></div>`;
  wireCommon(app);
}

export function renderStory(app: HTMLElement) {
  // Everything here is taken from what the site already says (coaching page, footer). Claire to expand it.
  const beats: [string, string][] = [
    ['Years of searching', 'Claire lived with chemical sensitivities for years.'],
    ['A new way in', "With a doctor's guidance she discovered neuroplasticity and learned to rewire her brain's response."],
    ['Learning to teach it', 'She trained as a neuro coach to share that knowledge.'],
    ['Daily Rituals Co.', 'Clean products made with intention, hand poured in small batches in British Columbia, with coaching alongside.'],
  ];
  app.innerHTML = `<div class="story">
    <section class="st-hero"><div class="wrap">
      <div class="st-tx"><span class="small"><a href="#/">Home</a> <span class="muted">/ Our story</span></span><h1>Our <span class="it">story</span></h1>
        <p class="lead">Clean products made with intention. Neuro coaching with Claire. Hand poured in small batches in British Columbia.</p></div>
      <div class="st-ph"><img class="dimg" src="/img/story.jpg" alt="Candles and a fragrance roller from Daily Rituals Co."></div>
    </div></section>
    <section class="wrap st-path"><span class="eyebrow">How it began</span><h2>From one life changed <span class="it">to a daily practice.</span></h2>
      <ol class="st-steps">${beats.map(([t, d], i) => `<li style="--i:${i}"><span class="st-dot" aria-hidden="true">${['\u263E', '\u2735', '\u2740', '\u2600'][i]}</span><b>${t}</b><p>${d}</p></li>`).join('')}</ol>
      <p class="small muted d confirm">Draft from the coaching page text. Claire to add dates, detail and photos.</p></section>
    <section class="st-quote"><div class="wrap"><blockquote>&ldquo;Others deserved access to the brain-change knowledge that transformed my life.&rdquo;<cite>Claire, neuro coach</cite></blockquote></div></section>
    <section class="wrap st-vals"><div class="ways three">
      <div class="st-v v1"><span class="eyebrow">Made with intention</span><h3>Clean, simple products</h3><p class="muted">Rollers, mini diffusers, candles and deodorant, each one made to mark a moment in your day.</p></div>
      <div class="st-v v2"><span class="eyebrow">Small batch</span><h3>Hand poured in BC</h3><p class="muted">Made in small batches in British Columbia.</p></div>
      <div class="st-v v3"><span class="eyebrow">Habits, made easier</span><h3>Coaching alongside</h3><p class="muted">The scents create a moment. Coaching with Claire helps you change what happens next.</p></div>
    </div>
    <div class="cta" style="justify-content:center;margin-top:36px"><a class="btn" href="#/shop">Shop the rituals</a><a class="btn line" href="#/coaching">Meet the coaching</a></div></section>
  </div>`;
}

export function renderAccount(app: HTMLElement) {
  app.innerHTML = `<div class="wrap" style="padding-bottom:clamp(48px,6vw,96px);max-width:720px">
    ${head('My account', 'My <span class="it">rituals</span>', 'Orders, saved details and subscriptions will live here.', true)}
    <div class="panel acct-panel" style="display:flex;flex-direction:column;gap:12px">
      <span class="eyebrow">Coming with launch</span>
      <p>Sign-in is handled by a secure Wix page and is switched off in this private preview. <span class="d confirm">Wording to confirm.</span></p>
      <a class="btn line" href="#/shop" style="align-self:flex-start">Back to the shop</a></div></div>`;
}

export async function renderExplore(app: HTMLElement, params: URLSearchParams = new URLSearchParams()) {
  const tab = params.get('tab') === 'quiz' ? 'quiz' : 'wheel';
  // draft for Claire: the lead and the tab name describe the scent compass (wheel.ts)
  app.innerHTML = `<div class="wrap" style="padding-bottom:clamp(48px,6vw,96px)">
    ${head('Find your scent', 'Find your <span class="it">scent</span>', 'Two ways in: follow the scent compass by how you want to feel, or answer four quick questions.')}
    <div class="toggle findtabs" role="tablist" aria-label="How to find your scent">
      <a role="tab" href="#/explore" aria-selected="${tab === 'wheel'}">Browse the compass</a>
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
    const top = [...tally].sort((x, y) => y[1] - x[1])[0][0];
    const list = items.filter(i => i.mood === top && i.format !== 'candle').concat(items.filter(i => i.mood === top && i.format === 'candle'));
    el.innerHTML = `<h2 style="font-size:clamp(30px,4vw,48px);margin-bottom:6px">Your mood: <span class="it">${MOODS[top].label}</span></h2>
      <p class="muted" style="margin-bottom:20px">These scents suit it best. Every scent comes in more than one format.</p>
      <div class="grid" id="qGrid">${list.length ? list.map(i => cardHTML(i)).join('') : '<p class="muted">No scents in this mood yet. Browse the whole shop instead.</p>'}</div>
      <div class="cta" style="margin-top:24px"><a class="btn" href="#/explore?mood=${top}">See it on the compass</a><a class="btn line" href="#/shop?f=all&m=${top}&s=featured">Shop this mood</a><button class="btn line" id="qAgain">Retake the quiz</button></div>`;
    wireQuickAdd(el.querySelector<HTMLElement>('#qGrid')!, items);
    el.querySelector('#qAgain')!.addEventListener('click', () => { answers.length = 0; draw(); });
  };
  draw();
}

// ---------- Free 7-day reset ----------
export function renderReset(app: HTMLElement) {
  app.innerHTML = `<div class="wrap" style="padding-bottom:clamp(48px,6vw,96px);max-width:820px">
    ${head('Free 7-day reset', 'The free 7-day <span class="it">reset</span>', 'Ten minutes a day with Claire. A light, self-paced way to try the practices before anything else.', true)}
    <div class="panel" style="display:flex;flex-direction:column;gap:14px">
      <span class="eyebrow">Free · Self-paced</span>
      <p>Join with your email and the first day arrives in your inbox. <span class="d confirm">Claire to confirm what is in each day and how it is delivered.</span></p>
      <form id="resetForm" style="display:flex;gap:10px;flex-wrap:wrap" novalidate>
        <label for="resetEmail" hidden>Email</label><input id="resetEmail" type="email" placeholder="you@example.com" autocomplete="email" required style="flex:1 1 240px;min-height:48px;padding:0 16px;border-radius:999px;border:1px solid var(--line)">
        <button class="btn euc" type="submit">Start Day 1</button></form>
      <p class="small muted">Coaching is not therapy or medical care. <span class="d confirm">Claire to confirm wording.</span></p></div>
    <div class="cta" style="margin-top:24px"><a class="btn line" href="#/book">Book a free discovery call instead</a></div></div>`;
  app.querySelector('#resetForm')!.addEventListener('submit', e => { e.preventDefault(); previewOff('Sign-ups')(); });
}
