import './canvas/canvas.css';
import './site.css';
import Header from './canvas/header.html?raw';
import Footer from './canvas/footer.html?raw';
import Drawer from './canvas/drawer.html?raw';
import { WRITES_ENABLED, LOYALTY_ENABLED, FREE_SHIPPING_THRESHOLD, LAUNCHED } from './config';
import { hasClient, money, loadCatalogue } from './wix';
import { fixImages, esc, toast } from './ui';
import { getLines, count, subtotal, setQty, onCart, checkout, add } from './cart';
import { currentRoute, onRoute, installLinkHandling } from './router';
import { renderHome } from './pages/home';
import { unmountJourney, openBreathe } from './pages/journey';
import { decoratePage } from './pages/calm';
import { treeSVG, lotusDivider } from './pages/symbols';
import { renderShop } from './pages/shop';
import { renderProduct } from './pages/product';
import { renderCoaching, renderBook } from './pages/coaching';
import { renderHelp, renderStory, renderAccount, renderExplore, renderReset } from './pages/info';
import { renderStatic, renderMissing, hasStatic } from './pages/static';
import { renderLegal } from './pages/legal';

const root = document.getElementById('root')!;
root.innerHTML = `
  <button class="skip" id="skipBtn">Skip to content</button>
  ${LAUNCHED ? '' : `<div class="preview-bar" role="note"><span><b>Private preview</b> · Live catalogue, photos and booking times from dailyritualsco.com. ${WRITES_ENABLED ? 'Checkout and booking are ON.' : 'Checkout, booking and sign-ups are switched off.'}</span>
    <span class="pb-toggles"><label class="drafts-toggle"><input type="checkbox" id="gradeToggle" checked> Photo grade</label><label class="drafts-toggle"><input type="checkbox" id="draftsToggle"> Show drafts for Claire</label></span></div>`}
  ${fixImages(Header)}
  <main id="app" tabindex="-1"></main>
  ${Footer}
  <div id="overlay" hidden><div class="scrim" data-x></div>${Drawer}</div>`;

const app = document.getElementById('app')!;
document.getElementById('skipBtn')!.addEventListener('click', () => { app.focus(); app.scrollIntoView({ block: 'start' }); });

// the tree of life behind every page: canopy at the top of the page, trunk through the middle, roots at the bottom
const treeBg = document.createElement('div'); treeBg.className = 'treebg'; treeBg.setAttribute('aria-hidden', 'true'); treeBg.innerHTML = treeSVG();
document.body.prepend(treeBg);
let treeTick = false;
const growTree = () => { treeTick = false; const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight); treeBg.style.setProperty('--tp', String(Math.min(1, Math.max(0, window.scrollY / max)))); };
window.addEventListener('scroll', () => { if (!treeTick) { treeTick = true; requestAnimationFrame(growTree); } }, { passive: true });
window.addEventListener('resize', growTree);
document.querySelector('footer')?.insertAdjacentHTML('beforebegin', lotusDivider());
growTree();

// anything marked data-breathe opens the breathing pause
document.addEventListener('click', e => { const sc = (e.target as Element | null)?.closest?.('[data-scrollto]') as HTMLElement | null; if (sc) { e.preventDefault(); const el = document.getElementById(sc.dataset.scrollto ?? ''); el?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' }); el?.focus?.(); } });
document.addEventListener('click', e => { const t = (e.target as Element | null)?.closest?.('[data-breathe]') as HTMLElement | null; if (t) { e.preventDefault(); openBreathe(t); } });

// singing-bowl ripple on buttons
document.addEventListener('pointerdown', e => {
  const b = (e.target as Element | null)?.closest?.('.btn, .chip') as HTMLElement | null;
  if (!b || (b as HTMLButtonElement).disabled || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 1.6, ring = document.createElement('span');
  ring.className = 'rip'; ring.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  b.appendChild(ring); window.setTimeout(() => ring.remove(), 700);
});

// ---------- header ----------
const menuBtn = document.getElementById('menuBtn')!;
const mnav = document.getElementById('mnav')!;
menuBtn.addEventListener('click', () => {
  const open = menuBtn.getAttribute('aria-expanded') !== 'true';
  menuBtn.setAttribute('aria-expanded', String(open));
  mnav.classList.toggle('open', open);
});
document.getElementById('clubPts')!.textContent = LOYALTY_ENABLED ? 'Join' : 'Soon';
if (!LOYALTY_ENABLED) document.body.classList.add('loyalty-off');

// ---------- drafts toggle ----------
// (after launch there is no preview bar: drafts stay hidden and the photo grade stays on)
const draftsToggle = document.getElementById('draftsToggle') as HTMLInputElement | null;
if (draftsToggle) {
  try { draftsToggle.checked = localStorage.getItem('dr_drafts') === '1'; } catch { /* ignore */ }
  const applyDrafts = () => document.body.classList.toggle('show-drafts', draftsToggle.checked);
  draftsToggle.addEventListener('change', () => { applyDrafts(); try { localStorage.setItem('dr_drafts', draftsToggle.checked ? '1' : '0'); } catch { /* ignore */ } });
  applyDrafts();
}

// photo grade: one warm, soft tone over every photograph so pictures shot on different days sit together (can be compared with and without)
const gradeToggle = document.getElementById('gradeToggle') as HTMLInputElement | null;
if (gradeToggle) {
  try { gradeToggle.checked = localStorage.getItem('dr_grade') !== '0'; } catch { /* ignore */ }
  const applyGrade = () => document.body.classList.toggle('no-grade', !gradeToggle.checked);
  gradeToggle.addEventListener('change', () => { applyGrade(); try { localStorage.setItem('dr_grade', gradeToggle.checked ? '1' : '0'); } catch { /* ignore */ } });
  applyGrade();
}

// ---------- cart drawer ----------
const overlay = document.getElementById('overlay')!;
const drawer = overlay.querySelector<HTMLElement>('.drawer')!;
drawer.style.position = '';
let lastFocus: Element | null = null;

function renderDrawer() {
  const lines = getLines();
  const sub = subtotal();
  const away = Math.max(0, FREE_SHIPPING_THRESHOLD - sub);
  const db = drawer.querySelector<HTMLElement>('.db')!;
  db.innerHTML = `
    <div class="ship"><span>${away > 0 ? `You are <b>${money(away)}</b> away from <span class="d">free shipping</span>.` : 'Your order ships <span class="d">free</span> in Canada.'}</span><div class="meter"><div style="width:${Math.min(100, (sub / FREE_SHIPPING_THRESHOLD) * 100)}%"></div></div></div>
    ${lines.length && LOYALTY_ENABLED ? `<div class="points"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7A5410" stroke-width="2"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg><span>This order earns <b>${Math.floor(sub)} Ritual Points</b> <span class="d">(1 point per $1)</span></span></div>` : ''}
    ${lines.map(l => `<div class="li"><img src="${l.image}" alt=""><div style="display:flex;flex-direction:column;gap:6px"><a href="#/product/${l.slug}" style="font-weight:600;line-height:1.25;text-decoration:none">${esc(l.name)}</a>${l.choice ? `<span class="small muted">${esc(l.choice)}</span>` : ''}<div class="qty" style="transform:scale(.85);transform-origin:left;align-self:flex-start"><button data-dec="${esc(l.key)}" aria-label="Decrease ${esc(l.name)}">−</button><span>${l.qty}</span><button data-inc="${esc(l.key)}" aria-label="Increase ${esc(l.name)}">+</button></div></div><b style="font-weight:500">${money(l.price * l.qty)}</b></div>`).join('')
      || '<p class="muted" style="padding:24px 0">Your cart is empty. <a href="#/shop" data-x>Browse the shop</a></p>'}`;
  const df = drawer.querySelector<HTMLElement>('.df')!;
  df.innerHTML = `<div class="row"><span>Subtotal</span><b style="font-weight:600">${money(sub)}</b></div><span class="small muted">GST, PST and shipping calculated at checkout.</span>
    <button class="btn" id="checkoutBtn" ${lines.length ? '' : 'disabled'}>Checkout · ${money(sub)}</button>
    ${WRITES_ENABLED ? '' : '<span class="small muted">Private preview: checkout is switched off, and this cart is saved only in this browser.</span>'}`;
  df.querySelector('#checkoutBtn')!.addEventListener('click', async () => {
    if (!WRITES_ENABLED) { toast('Checkout is switched off in the private preview. No order was created.'); return; }
    try { await checkout(); } catch (e) { toast(`Checkout could not start: ${(e as Error).message}`); }
  });
  db.querySelectorAll<HTMLButtonElement>('[data-inc]').forEach(b => b.addEventListener('click', () => { const l = getLines().find(x => x.key === b.dataset.inc)!; setQty(l.key, l.qty + 1); }));
  db.querySelectorAll<HTMLButtonElement>('[data-dec]').forEach(b => b.addEventListener('click', () => { const l = getLines().find(x => x.key === b.dataset.dec)!; setQty(l.key, l.qty - 1); }));
  drawer.querySelectorAll('[data-x]').forEach(x => x.addEventListener('click', closeCart));
  void fillSuggestions(db);
}
// "Complete your ritual": other formats of the scents already in the cart.
let suggestToken = 0;
async function fillSuggestions(db: HTMLElement) {
  const token = ++suggestToken;
  const lines = getLines();
  if (!lines.length) return;
  let items: Awaited<ReturnType<typeof loadCatalogue>>;
  try { items = await loadCatalogue(); } catch { return; }
  if (token !== suggestToken || overlay.hidden) return;
  const inCart = new Set(lines.map(l => l.productId));
  const scents = new Set(lines.map(l => items.find(i => i.id === l.productId)?.scent).filter(Boolean));
  const picks = items.filter(i => scents.has(i.scent) && !inCart.has(i.id) && i.inStock && i.choices.length <= 1).slice(0, 2);
  db.querySelector('.complete')?.remove();
  if (!picks.length) return;
  db.insertAdjacentHTML('beforeend', `<div class="complete"><span class="eyebrow">Complete your ritual</span>${picks.map(p =>
    `<div class="sug"><img src="${p.thumb}" alt=""><span><b>${esc(p.name)}</b><em>${money(p.priceMin)}</em></span><button class="btn line" data-sug="${esc(p.id)}">Add</button></div>`).join('')}</div>`);
  db.querySelectorAll<HTMLButtonElement>('[data-sug]').forEach(b => b.addEventListener('click', async () => {
    const p = items.find(i => i.id === b.dataset.sug)!;
    await add({ productId: p.id, slug: p.slug, name: p.name, price: p.priceMin, image: p.thumb, choice: p.choices[0]?.name, optionName: p.optionName });
    toast(`${p.name} added to your cart`);
  }));
}
function updateCount() { document.getElementById('cartCount')!.textContent = String(count()); }
function openCart() {
  lastFocus = document.activeElement;
  renderDrawer(); overlay.hidden = false; document.body.classList.add('cart-open');
  drawer.querySelector<HTMLElement>('[data-x]')?.focus();
}
function closeCart() {
  overlay.hidden = true; document.body.classList.remove('cart-open');
  (lastFocus as HTMLElement | null)?.focus?.();
}
document.getElementById('cartBtn')!.addEventListener('click', openCart);
overlay.querySelector('.scrim')!.addEventListener('click', closeCart);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !overlay.hidden) closeCart(); });
onCart(() => { updateCount(); if (!overlay.hidden) renderDrawer(); });
onCart(() => { if (overlay.hidden) { const c = document.getElementById('cartBtn')!; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); } });
updateCount();

// ---------- router ----------
// Product pages set their own title; routes not listed here keep the site name.
const PAGE_TITLES: Record<string, string> = {
  shop: 'Shop', coaching: 'Coaching', book: 'Book a session', subscribe: 'Ritual on Repeat',
  drops: 'Moon Drops', gift: 'Send a Sunrise', wall: 'Ritual Wall', club: 'The Ritualists',
  'order-confirmed': 'Order confirmed', privacy: 'Privacy policy', terms: 'Terms of service', accessibility: 'Accessibility', 'refund-policy': 'Refund policy', help: 'Help', story: 'Our story', account: 'My account', explore: 'Find your scent', quiz: 'Find your scent', build: 'Find your scent', sets: 'Find your scent', reset: 'Free 7-day reset',
};

async function route() {
  const [path, query = ''] = currentRoute().split('?');
  const [seg, arg] = path.split('/');
  const params = new URLSearchParams(query);
  document.querySelectorAll<HTMLAnchorElement>('.mainnav [data-nav]').forEach(a => {
    if (a.dataset.nav === (seg || 'home')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  mnav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false');
  if (!overlay.hidden) closeCart();
  document.body.dataset.page = seg || 'home';
  requestAnimationFrame(growTree);
  unmountJourney();
  document.title = PAGE_TITLES[seg] ? `${PAGE_TITLES[seg]} · Daily Rituals Co.` : 'Daily Rituals Co.';
  window.scrollTo(0, 0);

  if (!hasClient()) {
    app.innerHTML = `<div class="wrap" style="padding:80px 0"><div class="live-error"><b>Not connected yet.</b> Set VITE_WIX_CLIENT_ID to the live site's headless client id and rebuild.</div></div>`;
    return;
  }
  app.classList.remove('pagein'); void app.offsetWidth; app.classList.add('pagein');
  const view = (async () => {
    switch (seg) {
      case '': return renderHome(app);
      case 'shop': return renderShop(app, params);
      case 'product': return renderProduct(app, decodeURIComponent(arg ?? ''));
      case 'coaching': return renderCoaching(app);
      case 'help': return renderHelp(app);
      case 'story': return renderStory(app);
      case 'account': return renderAccount(app);
      case 'explore': return renderExplore(app, params);
      // older links: the quiz is a tab of Find your scent; build a ritual and ritual sets live in the wheel
      case 'quiz': return renderExplore(app, new URLSearchParams('tab=quiz'));
      case 'build': case 'sets': return renderExplore(app);
      case 'reset': return renderReset(app);
      case 'book': return renderBook(app, arg);
      case 'checkout': await renderHome(app); openCart(); return;
      case 'privacy': case 'terms': case 'accessibility': case 'refund-policy': return renderLegal(app, seg);
      default:
        if (hasStatic(seg)) return renderStatic(app, seg);
        return renderMissing(app, seg);
    }
  })();
  await view;
  decoratePage(app, seg);
}
installLinkHandling();
onRoute(route);
route();
