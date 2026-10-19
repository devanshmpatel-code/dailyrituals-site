import MoonDrops from '../canvas/pages/MoonDrops.html?raw';
import RitualOnRepeat from '../canvas/pages/RitualOnRepeat.html?raw';
import RitualWall from '../canvas/pages/RitualWall.html?raw';
import Ritualists from '../canvas/pages/Ritualists.html?raw';
import SendASunrise from '../canvas/pages/SendASunrise.html?raw';
import OrderConfirmed from '../canvas/pages/OrderConfirmed.html?raw';
import { fixImages, wireCommon, esc } from '../ui';
import { LOYALTY_ENABLED } from '../config';
import { ritualistsCardHTML, wireRitualistsCard } from '../brand';
import { loadCatalogue } from '../wix';
import { bindCanvasProductLinks, previewOff } from './shared';
import { wireVote, wireCountdown, wireSunrise, wireClub, wireRepeatCalc } from './home';
import { pastMoonsHTML, wirePastMoons, STUDIO_ON } from '../moons';
import { ritualistsHTML, wireRitualists } from '../ritualists';
import { wireGift } from './gift';

const PAGES: Record<string, string> = {
  drops: MoonDrops, subscribe: RitualOnRepeat, wall: RitualWall, club: Ritualists, gift: SendASunrise, 'order-confirmed': OrderConfirmed,
};

export function hasStatic(route: string) { return route in PAGES; }

export async function renderStatic(app: HTMLElement, route: string) {
  app.innerHTML = fixImages(LOYALTY_ENABLED ? PAGES[route] : noPoints(PAGES[route]));
  if (route === 'club' && !LOYALTY_ENABLED) clubSoon(app);
  // the Ritual Wall's studio photographs are switched off with From the studio (STUDIO_ON in src/moons.ts); the code stays
  if (route === 'wall' && !STUDIO_ON) app.querySelector('.wall-studio')?.remove();
  if (route === 'drops') {
    // the past moons: every named candle from the studio photographs, as an archive at the foot of the night page (never buyable)
    app.querySelector('.night > .wrap')?.insertAdjacentHTML('beforeend', pastMoonsHTML());
    wirePastMoons(app);
  }
  wireCommon(app);
  wireVote(app); wireCountdown(app); wireSunrise(app); wireClub(app); wireRepeatCalc(app, null);
  app.querySelectorAll('#upForm').forEach(f => f.addEventListener('submit', e => { e.preventDefault(); previewOff('Photo uploads')(); }));
  app.querySelectorAll('[data-pair], [data-wf], [data-gr]').forEach(b => b.addEventListener('click', () => {
    b.parentElement?.querySelectorAll(':scope > [aria-pressed]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));
  if (route === 'order-confirmed') {
    // The canvas line "Prototype only. No payment was taken." stays: no order exists in the preview.
  }
  try {
    const items = await loadCatalogue();
    bindCanvasProductLinks(app, items);
    // the wall's "product in the photo" lists what the shop really sells (the canvas list named products that do not exist)
    const upP = app.querySelector<HTMLSelectElement>('#upP');
    if (upP && items.length) upP.innerHTML = [...items].sort((a, b) => a.name.localeCompare(b.name)).map(i => `<option value="${esc(i.slug)}">${esc(i.name)}</option>`).join('') + '<option value="other">Something else</option>';
    if (route === 'subscribe') wireRepeatCalc(app, items);
    // Send a Sunrise: choose a live candle on the page and add it to the cart with the card details
    if (route === 'gift') wireGift(app, items);
  } catch { /* static page still renders without live data */ }
}

export function renderMissing(app: HTMLElement, route: string) {
  const name = route.replace(/-/g, ' ');
  app.innerHTML = `<div class="wrap missing" style="padding:clamp(64px,8vw,112px) 0;display:flex;flex-direction:column;gap:16px;max-width:640px">
    <span class="mark" aria-hidden="true"><svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 22a13 13 0 0126 0"></path><circle cx="16" cy="13" r="4.2" fill="currentColor" stroke="none"></circle><path d="M1 26h30"></path></svg></span>
    <span class="eyebrow">Coming soon</span><h1 style="font-size:clamp(36px,5vw,56px)">${esc(name.charAt(0).toUpperCase() + name.slice(1))}</h1>
    <p class="muted">We are still putting this page together. In the meantime, you can explore the shop or find your scent with the quiz.</p>
    <div class="cta"><a class="btn" href="#/shop">Shop the rituals</a><a class="btn line" href="#/explore?tab=quiz">Find your scent</a></div>
    <p class="small muted d confirm">Draft page: not designed yet. Claire to provide content.</p></div>`;
}

/**
 * The rewards club is not set up in Wix yet. Customers see the club as the owner approved it (October 2026), marked
 * "coming soon": the three tiers, the points value and a waitlist (email and birthday), from src/ritualists.ts, the same as
 * the home chapter. The rest of the canvas page (calculator, ways to earn, redeeming) stays a draft for Claire below it.
 */
function clubSoon(app: HTMLElement) {
  const plan = document.createElement('div'); plan.className = 'confirm club-plan';
  plan.innerHTML = '<p class="d" style="margin:24px auto;max-width:1180px;padding:0 24px">Draft: more of the planned club below (calculator, ways to earn, redeeming). Shown to Claire only until the Wix Loyalty app is set up.</p>';
  while (app.firstChild) plan.appendChild(app.firstChild);
  // (the tiers and the referral idea are shown above to everyone; the draft keeps the rest)
  plan.querySelectorAll('.tiers, .refer').forEach(n => n.remove());
  app.innerHTML = `<section class="clubsoon"><div class="wrap">
    <div class="cs-tx"><div class="crumbs cs-crumbs"><a href="#/">Home</a> / The Ritualists</div><span class="eyebrow">Free rewards club</span>
      <h1>The <span class="it goldtext">Ritualists</span> are gathering.</h1>
      <p>Our rewards club is opening soon. <span class="d">Join the waitlist below and you will be first to hear when the doors open.</span></p>
      <button type="button" class="btn cs-go"><span class="d">Join the waitlist</span></button></div>
    ${ritualistsCardHTML()}
  </div></section>
  <section class="clubplan" id="csWait"><div class="wrap">${ritualistsHTML({ id: 'cs', heading: 'h2' })}</div></section>`;
  app.appendChild(plan);
  wireRitualistsCard(app);
  wireRitualists(app);
  app.querySelector<HTMLButtonElement>('.cs-go')?.addEventListener('click', () => {
    const f = app.querySelector<HTMLInputElement>('#csEmail');
    f?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    f?.focus({ preventScroll: true });
  });
}

/** Until the Loyalty and referral apps exist, take points and referral promises out of the customer-facing pages. */
function noPoints(html: string): string {
  return html
    .replace('Post a photo to the Ritual Wall for 50 points.', 'Post a photo to the Ritual Wall and we may feature it.')
    .replace(/ You earned <b><span class="d">125 Ritualist points<\/span><\/b> on this order\./, '')
    .replace('<div class="refer" style="grid-template-columns:1fr;padding:28px">', '<div class="refer confirm" style="grid-template-columns:1fr;padding:28px">')
    .replace(/<li>Earn Ritualist points on each order<\/li>|<li>Double points on your first delivery<\/li>/g, '')
    .replace(/<details><summary>Do subscriptions earn points[\s\S]*?<\/details>/, '');
}

