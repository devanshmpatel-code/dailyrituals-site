import MoonDrops from '../canvas/pages/MoonDrops.html?raw';
import RitualOnRepeat from '../canvas/pages/RitualOnRepeat.html?raw';
import RitualWall from '../canvas/pages/RitualWall.html?raw';
import Ritualists from '../canvas/pages/Ritualists.html?raw';
import SendASunrise from '../canvas/pages/SendASunrise.html?raw';
import OrderConfirmed from '../canvas/pages/OrderConfirmed.html?raw';
import { fixImages, wireCommon, esc } from '../ui';
import { loadCatalogue } from '../wix';
import { bindCanvasProductLinks, previewOff } from './shared';
import { wireVote, wireCountdown, wireSunrise, wireClub, wireRepeatCalc } from './home';

const PAGES: Record<string, string> = {
  drops: MoonDrops, subscribe: RitualOnRepeat, wall: RitualWall, club: Ritualists, gift: SendASunrise, 'order-confirmed': OrderConfirmed,
};

export function hasStatic(route: string) { return route in PAGES; }

export async function renderStatic(app: HTMLElement, route: string) {
  app.innerHTML = fixImages(PAGES[route]);
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
  app.innerHTML = `<div class="wrap" style="padding:clamp(64px,8vw,112px) 0;display:flex;flex-direction:column;gap:16px;max-width:640px">
    <span class="eyebrow">Not designed yet</span><h1 style="font-size:clamp(36px,5vw,56px)">${esc(name.charAt(0).toUpperCase() + name.slice(1))}</h1>
    <p class="muted">This page is linked from the navigation, but it was not one of the 14 screens in the final canvas, so it has not been built yet.</p>
    <a class="btn" href="#/" style="align-self:flex-start">Back to the homepage</a></div>`;
}
