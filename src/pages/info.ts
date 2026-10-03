import { MOODS, FORMAT_LABEL, type Mood } from '../config';
import { loadCatalogue, money, type Item } from '../wix';
import { esc, errorBox, wireCommon, cardHTML } from '../ui';
import { wireQuickAdd, previewOff } from './shared';
import { mountWheel } from './wheel';

// Placeholder copy for pages that were not in the final canvas. Anything Claire has not
// confirmed is wrapped in <span class="d"> so "Show drafts for Claire" highlights it.
// Only facts already in the canvas are stated plainly: hand poured in small batches in
// British Columbia, free shipping over $75 in Canada, tax and shipping at checkout, hand packed.

const head = (crumb: string, title: string, lead: string) => `
  <div class="phead"><div class="crumbs"><a href="#/">Home</a> / ${esc(crumb)}</div>
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
      <div class="panel" style="display:flex;flex-direction:column;gap:12px">
        <span class="eyebrow">Contact</span><h3 style="font-size:28px">Say hello</h3>
        <p class="muted d confirm">Contact email and response time to be confirmed by Claire.</p>
        <a class="btn line" href="#/coaching" style="align-self:flex-start">Coaching questions</a>
        <p class="small muted">Coaching is not therapy or medical care. <span class="d confirm">Claire to confirm wording.</span></p>
      </div>
    </div></div>`;
  wireCommon(app);
}

export function renderStory(app: HTMLElement) {
  app.innerHTML = `<div class="wrap" style="padding-bottom:clamp(48px,6vw,96px)">
    ${head('Our story', 'Our <span class="it">story</span>', 'Clean products made with intention. Coaching rooted in science. Hand poured in small batches in British Columbia.')}
    <div class="split" style="align-items:center">
      <img class="dimg" src="/img/story.jpg" alt="Claire at work" style="border-radius:14px;width:100%;aspect-ratio:4/5;object-fit:cover">
      <div style="display:flex;flex-direction:column;gap:16px;max-width:52ch">
        <span class="eyebrow">Daily Rituals Co.</span>
        <p class="d confirm" style="font-size:19px"><span>Daily Rituals Co. began with a simple idea: small, repeatable moments can change how a day feels. Each scent is made to mark one of those moments, from first light to the last hour of the evening.</span></p>
        <p class="d confirm"><span>Claire's story, how the products are made and what the coaching practice is built on go here. Placeholder text until Claire writes it.</span></p>
        <div class="cta"><a class="btn" href="#/shop">Shop the rituals</a><a class="btn line" href="#/coaching">Meet the coaching</a></div>
      </div>
    </div></div>`;
}

export function renderAccount(app: HTMLElement) {
  app.innerHTML = `<div class="wrap" style="padding-bottom:clamp(48px,6vw,96px);max-width:720px">
    ${head('My account', 'My <span class="it">rituals</span>', 'Orders, saved details, Ritualist points and subscriptions will live here.')}
    <div class="panel" style="display:flex;flex-direction:column;gap:12px">
      <span class="eyebrow">Coming with launch</span>
      <p>Sign-in is handled by a secure Wix page and is switched off in this private preview. <span class="d confirm">Wording to confirm.</span></p>
      <a class="btn line" href="#/shop" style="align-self:flex-start">Back to the shop</a></div></div>`;
}

export async function renderExplore(app: HTMLElement, params: URLSearchParams = new URLSearchParams()) {
  const tab = params.get('tab') === 'quiz' ? 'quiz' : 'wheel';
  app.innerHTML = `<div class="wrap" style="padding-bottom:clamp(48px,6vw,96px)">
    ${head('Find your scent', 'Find your <span class="it">scent</span>', 'Two ways in: browse by the time of day, or answer four quick questions.')}
    <div class="toggle findtabs" role="tablist" aria-label="How to find your scent">
      <a role="tab" href="#/explore" aria-selected="${tab === 'wheel'}">Browse the wheel</a>
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
      `<div class="panel" style="display:flex;flex-direction:column;gap:8px"><h3 style="font-size:24px">${esc(scent)}</h3>
        <div class="chips">${l.sort((a, b) => a.format.localeCompare(b.format)).map(i =>
          `<a class="chip" href="#/product/${i.slug}">${esc(FORMAT_LABEL[i.format])} · ${i.priceMin === i.priceMax ? money(i.priceMin) : `from ${money(i.priceMin)}`}</a>`).join('')}</div></div>`).join('');
    return `<section style="margin-bottom:40px"><div style="display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;margin-bottom:14px">
      ${swatch ? `<span class="swatch" style="background:${swatch};width:14px;height:14px;border-radius:50%;display:inline-block"></span>` : ''}
      <h2 style="font-size:clamp(26px,3vw,36px)">${title}</h2>${link}</div><div class="ways">${rows}</div></section>`;
  };
  box.innerHTML = `<h2 style="font-size:clamp(28px,3.4vw,40px);margin:48px 0 20px">The full list</h2>` +
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
      <div class="cta" style="margin-top:24px"><a class="btn" href="#/explore?mood=${top}">See it on the wheel</a><a class="btn line" href="#/shop?f=all&m=${top}&s=featured">Shop this mood</a><button class="btn line" id="qAgain">Retake the quiz</button></div>`;
    wireQuickAdd(el.querySelector<HTMLElement>('#qGrid')!, items);
    el.querySelector('#qAgain')!.addEventListener('click', () => { answers.length = 0; draw(); });
  };
  draw();
}

// ---------- Free 7-day reset ----------
export function renderReset(app: HTMLElement) {
  app.innerHTML = `<div class="wrap" style="padding-bottom:clamp(48px,6vw,96px);max-width:820px">
    ${head('Free 7-day reset', 'The free 7-day <span class="it">reset</span>', 'Ten minutes a day with Claire. A light, self-paced way to try the practices before anything else.')}
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
