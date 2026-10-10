import MoonDrops from '../canvas/pages/MoonDrops.html?raw';
import RitualOnRepeat from '../canvas/pages/RitualOnRepeat.html?raw';
import RitualWall from '../canvas/pages/RitualWall.html?raw';
import Ritualists from '../canvas/pages/Ritualists.html?raw';
import SendASunrise from '../canvas/pages/SendASunrise.html?raw';
import OrderConfirmed from '../canvas/pages/OrderConfirmed.html?raw';
import { fixImages, wireCommon, esc } from '../ui';
import { LOYALTY_ENABLED } from '../config';
import { moonArc } from './symbols';
import { loadCatalogue } from '../wix';
import { bindCanvasProductLinks, previewOff } from './shared';
import { wireVote, wireCountdown, wireSunrise, wireClub, wireRepeatCalc } from './home';
import { pastMoonsHTML, wirePastMoons } from '../moons';

const PAGES: Record<string, string> = {
  drops: MoonDrops, subscribe: RitualOnRepeat, wall: RitualWall, club: Ritualists, gift: SendASunrise, 'order-confirmed': OrderConfirmed,
};

export function hasStatic(route: string) { return route in PAGES; }

export async function renderStatic(app: HTMLElement, route: string) {
  app.innerHTML = fixImages(LOYALTY_ENABLED ? PAGES[route] : noPoints(PAGES[route]));
  if (route === 'club' && !LOYALTY_ENABLED) clubSoon(app);
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
    if (route === 'subscribe') wireRepeatCalc(app, items);
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

/** The rewards club is not set up in Wix yet. Customers see an honest "opening soon" page; the planned details stay as a draft for Claire. */
function clubSoon(app: HTMLElement) {
  const plan = document.createElement('div'); plan.className = 'confirm club-plan';
  plan.innerHTML = '<p class="d" style="margin:24px auto;max-width:1180px;padding:0 24px">Draft: the planned club below. Shown to Claire only until the Wix Loyalty app is set up.</p>';
  while (app.firstChild) plan.appendChild(app.firstChild);
  app.innerHTML = `<section class="clubsoon"><div class="wrap">
    <div class="cs-tx"><a class="small" href="#/" style="opacity:.8">Home</a><span class="eyebrow">Free rewards club</span>
      <h1>The <span class="it goldtext">Ritualists</span> are gathering.</h1>
      <p>Our rewards club is opening soon. Join the Sunday note and you will be first to hear when the doors open, along with a small practice from Claire each week and first notice of every Moon Drop.</p>
      <form class="nform" id="csForm"><label for="csEmail" hidden>Email address</label><input id="csEmail" type="email" placeholder="Email address" required><button class="btn" type="submit">Tell me first</button></form>
      <span class="small" style="opacity:.75">You can unsubscribe any time.</span></div>
    <div class="cs-moon" aria-hidden="true">${moonArc()}</div>
  </div></section>`;
  app.appendChild(plan);
  app.querySelector('#csForm')?.addEventListener('submit', e => { e.preventDefault(); previewOff('Sign-ups')(); });
}

/** Until the Loyalty and referral apps exist, take points and referral promises out of the customer-facing pages. */
function noPoints(html: string): string {
  return html
    .replace(' Share yours for 50 points, and every month one featured photo wins the next Moon Drop.', ' Share yours and we may feature it here.')
    .replace('Submit for the wall · +50 points', 'Submit for the wall')
    .replace('Post a photo to the Ritual Wall for 50 points.', 'Post a photo to the Ritual Wall and we may feature it.')
    .replace(/ You earned <b><span class="d">125 Ritualist points<\/span><\/b> on this order\./, '')
    .replace('<div class="refer" style="grid-template-columns:1fr;padding:28px">', '<div class="refer confirm" style="grid-template-columns:1fr;padding:28px">')
    .replace(/<li>Earn Ritualist points on each order<\/li>|<li>Double points on your first delivery<\/li>/g, '')
    .replace(/<details><summary>Do subscriptions earn points[\s\S]*?<\/details>/, '');
}

