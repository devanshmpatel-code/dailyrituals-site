import { MOODS, FORMAT_LABEL, type Mood } from '../config';
import { loadCatalogue, money, type Item } from '../wix';
import { esc, errorBox, wireCommon } from '../ui';

// Placeholder copy for pages that were not in the final canvas. Anything Claire has not
// confirmed is wrapped in <span class="d"> so "Show drafts for Claire" highlights it.
// Only facts already in the canvas are stated plainly: hand poured in small batches in
// British Columbia, free shipping over $75 in Canada, tax and shipping at checkout, hand packed.

const head = (crumb: string, title: string, lead: string) => `
  <div class="phead"><div class="crumbs"><a href="#/">Home</a> / ${esc(crumb)}</div>
  <div class="cat-hero"><h1>${title}</h1><p class="muted" style="font-size:18px;max-width:56ch">${lead}</p></div></div>`;

const faq = (q: string, a: string) => `<details><summary>${q}</summary><div class="dbody"><p>${a}</p></div></details>`;

export function renderHelp(app: HTMLElement) {
  app.innerHTML = `<div class="wrap" style="padding-bottom:clamp(48px,6vw,96px)">
    ${head('Help', 'Help and <span class="it">contact</span>', 'Shipping, returns and how to reach us. Orders are packed by hand, so small questions are welcome.')}
    <div class="split" style="align-items:start">
      <div><span class="eyebrow">Shipping</span>
        <h2 style="font-size:clamp(30px,3.6vw,44px);margin:10px 0 16px">Shipping and <span class="it">returns</span></h2>
        ${faq('What does shipping cost?', 'Shipping is free on Canadian orders over $75. GST, PST and shipping are calculated at checkout. <span class="d">Rates for orders under $75 to be confirmed by Claire.</span>')}
        ${faq('How long will my order take?', '<span class="d">Processing and delivery times to be confirmed by Claire. Every order is packed by hand.</span>')}
        ${faq('Do you ship outside Canada?', '<span class="d">To be confirmed by Claire.</span>')}
        ${faq('What is your return policy?', '<span class="d">Return and refund terms to be confirmed by Claire before launch.</span>')}
        ${faq('What if something arrives damaged?', '<span class="d">Please contact us with your order number and a photo. Claire to confirm the process.</span>')}
        ${faq('Can I cancel or change a Ritual on Repeat order?', 'Yes. Skip, change the date or swap scents any time before the next order ships.')}
      </div>
      <div class="panel" style="display:flex;flex-direction:column;gap:12px">
        <span class="eyebrow">Contact</span><h3 style="font-size:28px">Say hello</h3>
        <p class="muted"><span class="d">Contact email and response time to be confirmed by Claire.</span></p>
        <a class="btn line" href="#/coaching" style="align-self:flex-start">Coaching questions</a>
        <p class="small muted">Coaching is not therapy or medical care. <span class="d">Claire to confirm wording.</span></p>
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
        <p style="font-size:19px"><span class="d">Daily Rituals Co. began with a simple idea: small, repeatable moments can change how a day feels. Each scent is made to mark one of those moments, from first light to the last hour of the evening.</span></p>
        <p><span class="d">Claire's story, how the products are made and what the coaching practice is built on go here. Placeholder text until Claire writes it.</span></p>
        <div class="cta"><a class="btn" href="#/shop">Shop the rituals</a><a class="btn line" href="#/coaching">Meet the coaching</a></div>
      </div>
    </div></div>`;
}

export function renderAccount(app: HTMLElement) {
  app.innerHTML = `<div class="wrap" style="padding-bottom:clamp(48px,6vw,96px);max-width:720px">
    ${head('My account', 'My <span class="it">rituals</span>', 'Orders, saved details, Ritualist points and subscriptions will live here.')}
    <div class="panel" style="display:flex;flex-direction:column;gap:12px">
      <span class="eyebrow">Coming with launch</span>
      <p>Sign-in is handled by a secure Wix page and is switched off in this private preview. <span class="d">Wording to confirm.</span></p>
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
