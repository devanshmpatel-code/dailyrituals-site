import { MOODS, MOMENTS, FORMAT_LABEL, type Mood } from '../config';
import { loadCatalogue, findLive, money, type Item } from '../wix';
import { esc, errorBox, wireCommon, cardHTML, toast } from '../ui';
import { add } from '../cart';
import { wireQuickAdd } from './shared';

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

export async function renderExplore(app: HTMLElement) {
  app.innerHTML = `<div class="wrap" style="padding-bottom:clamp(48px,6vw,96px)">
    ${head('Scent explorer', 'Scent <span class="it">explorer</span>', 'Every scent belongs to a mood. Pick a mood, then see which formats it comes in.')}
    <div id="exp"><div class="sk-line"></div><div class="sk-line short"></div></div></div>`;
  const box = app.querySelector<HTMLElement>('#exp')!;
  let items: Item[];
  try { items = await loadCatalogue(); } catch (e) { box.innerHTML = errorBox(String((e as Error).message ?? e)); return; }

  box.innerHTML = (Object.keys(MOODS) as Mood[]).map(m => {
    const byScent = new Map<string, Item[]>();
    items.filter(i => i.mood === m).forEach(i => byScent.set(i.scent, [...(byScent.get(i.scent) ?? []), i]));
    if (!byScent.size) return '';
    const rows = [...byScent].sort(([a], [b]) => a.localeCompare(b)).map(([scent, list]) =>
      `<div class="panel" style="display:flex;flex-direction:column;gap:8px"><h3 style="font-size:24px">${esc(scent)}</h3>
        <div class="chips">${list.sort((a, b) => a.format.localeCompare(b.format)).map(i =>
          `<a class="chip" href="#/product/${i.slug}">${esc(FORMAT_LABEL[i.format])} · ${i.priceMin === i.priceMax ? money(i.priceMin) : `from ${money(i.priceMin)}`}</a>`).join('')}</div></div>`).join('');
    return `<section style="margin-bottom:40px"><div style="display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;margin-bottom:14px">
      <span class="swatch" style="background:${MOODS[m].swatch};width:14px;height:14px;border-radius:50%;display:inline-block"></span>
      <h2 style="font-size:clamp(26px,3vw,36px)">${MOODS[m].label}</h2><a class="small" href="#/shop?f=all&m=${m}&s=featured">Shop this mood</a></div>
      <div class="ways">${rows}</div></section>`;
  }).join('') || '<p class="muted">No scents to show yet.</p>';
}

// ---------- Scent quiz ----------
const QUIZ: { q: string; a: [string, Mood][] }[] = [
  { q: 'When do you want your scent to do the most?', a: [['First thing, before the day starts', 'fresh'], ['On the way out the door', 'sunny'], ['Midday, to reset', 'grounding'], ['Golden hour, when work ends', 'woody'], ['Late evening, to wind down', 'floral']] },
  { q: 'Which place feels most like you?', a: [['A cold, clear shoreline', 'fresh'], ['A beach cabana in the sun', 'sunny'], ['A garden in full bloom', 'floral'], ['A cabin with a fire going', 'woody'], ['A quiet room with nothing on', 'grounding']] },
  { q: 'Pick a weekend plan', a: [['A swim and a long walk', 'fresh'], ['A patio and something cold to drink', 'sunny'], ['Flowers, a book and a bath', 'floral'], ['A campfire with friends', 'woody'], ['Stretching, tea and no phone', 'grounding']] },
  { q: 'How should it make you feel?', a: [['Bright and clean', 'fresh'], ['Warm and playful', 'sunny'], ['Soft and romantic', 'floral'], ['Cosy and rooted', 'woody'], ['Calm and centred', 'grounding']] },
];

export async function renderQuiz(app: HTMLElement) {
  const answers: Mood[] = [];
  const draw = () => {
    const step = answers.length;
    if (step < QUIZ.length) {
      const { q, a } = QUIZ[step];
      app.innerHTML = `<div class="wrap" style="padding-bottom:clamp(48px,6vw,96px);max-width:760px">
        ${head('Scent quiz', 'Scent <span class="it">quiz</span>', 'Four questions, about 30 seconds. We will point you to a mood and the scents that match it.')}
        <div class="panel" style="display:flex;flex-direction:column;gap:16px">
          <span class="eyebrow">Question ${step + 1} of ${QUIZ.length}</span><h2 style="font-size:clamp(26px,3.4vw,38px)">${esc(q)}</h2>
          <div class="segs" style="display:flex;flex-direction:column;gap:10px">${a.map(([t], i) => `<button class="chip" style="justify-content:flex-start;text-align:left;min-height:48px" data-ans="${i}">${esc(t)}</button>`).join('')}</div>
          ${step ? '<button class="btn line" id="qBack" style="align-self:flex-start">Back</button>' : ''}
        </div></div>`;
      app.querySelectorAll<HTMLButtonElement>('[data-ans]').forEach(b => b.addEventListener('click', () => { answers.push(a[Number(b.dataset.ans)][1]); draw(); }));
      app.querySelector('#qBack')?.addEventListener('click', () => { answers.pop(); draw(); });
      return;
    }
    const tally = new Map<Mood, number>();
    answers.forEach(m => tally.set(m, (tally.get(m) ?? 0) + 1));
    const top = [...tally].sort((x, y) => y[1] - x[1])[0][0];
    app.innerHTML = `<div class="wrap" style="padding-bottom:clamp(48px,6vw,96px)">
      ${head('Scent quiz', `Your mood: <span class="it">${MOODS[top].label}</span>`, 'These scents suit it best. Every scent comes in more than one format.')}
      <div class="grid" id="qGrid">${skeleton()}</div>
      <div class="cta" style="margin-top:24px"><a class="btn line" href="#/shop?f=all&m=${top}&s=featured">Shop this mood</a><button class="btn line" id="qAgain">Retake the quiz</button></div></div>`;
    app.querySelector('#qAgain')!.addEventListener('click', () => { answers.length = 0; draw(); });
    loadCatalogue().then(items => {
      const list = items.filter(i => i.mood === top && i.format !== 'candle').concat(items.filter(i => i.mood === top && i.format === 'candle'));
      const grid = app.querySelector<HTMLElement>('#qGrid')!;
      grid.innerHTML = list.length ? list.map(i => cardHTML(i)).join('') : '<p class="muted">No scents in this mood yet. Browse the whole shop instead.</p>';
      wireQuickAdd(grid, items);
    }).catch(e => { app.querySelector('#qGrid')!.innerHTML = errorBox(String((e as Error).message ?? e)); });
  };
  draw();
}
const skeleton = () => '<div class="sk-line"></div><div class="sk-line short"></div>';

// ---------- Build a ritual ----------
export async function renderBuild(app: HTMLElement) {
  app.innerHTML = `<div class="wrap" style="padding-bottom:clamp(48px,6vw,96px);max-width:900px">
    ${head('Build a ritual', 'Build a <span class="it">ritual</span>', 'Pick a scent, then choose the formats you want to bring home.')}
    <div id="bld">${skeleton()}</div></div>`;
  const box = app.querySelector<HTMLElement>('#bld')!;
  let items: Item[];
  try { items = await loadCatalogue(); } catch (e) { box.innerHTML = errorBox(String((e as Error).message ?? e)); return; }
  const scents = [...new Set(items.filter(i => i.mood).map(i => i.scent))]
    .filter(s => items.filter(i => i.scent === s).length >= 2).sort();
  if (!scents.length) { box.innerHTML = '<p class="muted">No scents are available in more than one format yet.</p>'; return; }
  box.innerHTML = `<div class="panel" style="display:flex;flex-direction:column;gap:16px">
    <label for="bScent" class="eyebrow">1. Your scent</label><select id="bScent" style="max-width:320px">${scents.map(s => `<option>${esc(s)}</option>`).join('')}</select>
    <span class="eyebrow">2. Formats</span><div id="bFormats" style="display:flex;flex-direction:column;gap:10px"></div>
    <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:16px"><b id="bTotal" style="font-size:22px">${money(0)}</b><button class="btn" id="bAdd" disabled>Add to cart</button></div></div>`;
  const sel = box.querySelector<HTMLSelectElement>('#bScent')!;
  const fmt = box.querySelector<HTMLElement>('#bFormats')!;
  const total = box.querySelector<HTMLElement>('#bTotal')!;
  const addBtn = box.querySelector<HTMLButtonElement>('#bAdd')!;
  let chosen: Item[] = [];
  const update = () => {
    chosen = [...fmt.querySelectorAll<HTMLInputElement>('input:checked')].map(c => items.find(i => i.id === c.value)!);
    total.textContent = money(chosen.reduce((s, i) => s + i.priceMin, 0));
    addBtn.disabled = chosen.length === 0;
  };
  const draw = () => {
    const list = items.filter(i => i.scent === sel.value).sort((a, b) => a.format.localeCompare(b.format));
    fmt.innerHTML = list.map(i => {
      const single = i.choices.length <= 1 && i.inStock;
      return single
        ? `<label style="display:flex;gap:12px;align-items:center;min-height:44px"><input type="checkbox" value="${i.id}" style="width:20px;height:20px"> <span style="flex:1">${esc(FORMAT_LABEL[i.format])}${i.sizeLabel ? ` · ${esc(i.sizeLabel)}` : ''}</span><b style="font-weight:500">${money(i.priceMin)}</b></label>`
        : `<div style="display:flex;gap:12px;align-items:center;min-height:44px"><span style="flex:1">${esc(FORMAT_LABEL[i.format])} · ${i.inStock ? 'choose a size' : 'sold out'}</span><a class="btn line" href="#/product/${i.slug}">${i.inStock ? 'Choose' : 'View'}</a></div>`;
    }).join('');
    fmt.querySelectorAll('input').forEach(c => c.addEventListener('change', update));
    update();
  };
  sel.addEventListener('change', draw);
  addBtn.addEventListener('click', async () => {
    for (const p of chosen) await add({ productId: p.id, slug: p.slug, name: p.name, price: p.priceMin, image: p.thumb, choice: p.choices[0]?.name, optionName: p.optionName });
    toast(`${chosen.length} item${chosen.length === 1 ? '' : 's'} added to your cart`);
  });
  draw();
}

// ---------- Ritual sets (one pair per moment of the day) ----------
export async function renderSets(app: HTMLElement) {
  app.innerHTML = `<div class="wrap" style="padding-bottom:clamp(48px,6vw,96px)">
    ${head('Ritual sets', 'Ritual <span class="it">sets</span>', 'A diffuser and a roller, paired for each part of the day.')}
    <div class="ways" id="sets">${skeleton()}</div></div>`;
  const box = app.querySelector<HTMLElement>('#sets')!;
  let items: Item[];
  try { items = await loadCatalogue(); } catch (e) { box.innerHTML = errorBox(String((e as Error).message ?? e)); return; }
  box.innerHTML = MOMENTS.map(m => {
    const d = findLive(items, m.pair.diffuser, 'diffuser'), r = findLive(items, m.pair.roller, 'roller');
    const parts = [d, r].filter(Boolean) as Item[];
    if (parts.length < 2) return '';
    const sum = parts.reduce((s, i) => s + i.priceMin, 0);
    const line = m.draft ? `<span class="d">${esc(m.line)}</span>` : esc(m.line);
    return `<div class="panel" style="display:flex;flex-direction:column;gap:10px">
      <span class="eyebrow">${esc(m.name)} · ${esc(m.time)}</span><h3 style="font-size:26px">${esc(m.title)}</h3><p class="muted small">${line}</p>
      <div class="small">${parts.map(p => `<a href="#/product/${p.slug}">${esc(p.name)}</a>`).join(' + ')}</div>
      <button class="btn" data-set="${m.key}" style="margin-top:auto">Add this ritual · ${money(sum)}</button></div>`;
  }).join('');
  box.querySelectorAll<HTMLButtonElement>('[data-set]').forEach(b => b.addEventListener('click', async () => {
    const m = MOMENTS.find(x => x.key === b.dataset.set)!;
    for (const p of [findLive(items, m.pair.diffuser, 'diffuser'), findLive(items, m.pair.roller, 'roller')]) if (p) await add({ productId: p.id, slug: p.slug, name: p.name, price: p.priceMin, image: p.thumb, choice: p.choices[0]?.name, optionName: p.optionName });
    toast(`${m.name} ritual added to your cart`);
  }));
}
