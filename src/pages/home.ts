import Main from '../canvas/pages/Main.html?raw';
import { MOMENTS, MOODS, NEXT_DROP_ISO, LOYALTY_ENABLED, type Moment, type MomentKey } from '../config';
import { constellation } from '../celestial';
import { loadCatalogue, findLive, money, type Item } from '../wix';
import { cardHTML, fixImages, skeletonCards, errorBox, wireCommon, toast, esc } from '../ui';
import { add } from '../cart';
import { sceneHTML, setLook, placeOrb } from './scene';
import { look } from './daycycle';
import { mountSky, getSky } from './sky';
import { mountJourney } from './journey';
import { mountOpening, unmountOpening } from './opening';
import { swapRenders } from '../photos';
import { bindCanvasProductLinks, previewOff, wireQuickAdd } from './shared';
import { journalTeaserHTML } from './journal';
import { studioHTML, claireCutHTML, wireStudio, heroStackHTML, showHero, resetHero, heroLook, heroLight, repeatPhotoHTML, giftPhotoHTML } from '../moons';

// The hero opens at the moment nearest the visitor's local time, showing their real clock. Once they
// move the sun or pick a moment, it shows that moment's own time instead.
let useRealClock = true;
const hourNow = (d = new Date()) => d.getHours() + d.getMinutes() / 60;
function momentForHour(h: number): Moment {
  const dist = (a: number, b: number) => { const x = Math.abs(a - b); return Math.min(x, 24 - x); };
  return MOMENTS.reduce((a, b) => (dist(b.hour, h) < dist(a.hour, h) ? b : a));
}
const clockParts = (d: Date) => {
  const [hm, ap] = d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }).replace('a.m.', 'am').replace('p.m.', 'pm').split(' ');
  return [hm, ap] as const;
};

const svgPoint = (t: number) => ({
  x: 40 + 920 * t,
  y: 140 * (1 - t) ** 2 + 2 * -60 * (1 - t) * t + 140 * t * t,
});
const tFor = (hour: number) => Math.min(1, Math.max(0, (hour - 6) / 16));

/** The line above the clock: the visitor's real time; once they choose another time of day, it says which one they see. */
function greeting(d = new Date(), shown?: string) {
  const h = d.getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const time = d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }).replace('a.m.', 'am').replace('p.m.', 'pm');
  return shown ? `It is ${time} where you are. Here is ${shown.toLowerCase()}.` : `${part}. It is ${time} where you are.`;
}

export async function renderHome(app: HTMLElement) {
  useRealClock = true;
  app.innerHTML = fixImages(Main);
  // the studio photographs: the hero arch shows Claire's past candle work for the hour (set here, before swapRenders, so the
  // canvas renders it replaces are never swapped for Wix photos); Claire's cut-out in "Meet Claire", then From the studio; one
  // photograph each sits with Ritual on Repeat and Send a Sunrise
  const stack = app.querySelector<HTMLElement>('#dStack'); if (stack) { stack.innerHTML = heroStackHTML(momentForHour(hourNow()).key); stack.classList.add('moons'); }
  resetHero();
  app.querySelector('.claire-in .ph')?.replaceWith(Object.assign(document.createElement('div'), { innerHTML: claireCutHTML() }).firstElementChild!);
  app.querySelector('.claire')?.insertAdjacentHTML('afterend', studioHTML());
  app.querySelector('section.newsflow')?.insertAdjacentHTML('beforebegin', journalTeaserHTML());
  app.querySelector('.rep-grid .stick')?.insertAdjacentHTML('beforeend', repeatPhotoHTML());
  app.querySelector('.gift-grid > div:has(.gcard)')?.insertAdjacentHTML('beforeend', giftPhotoHTML());
  swapRenders(app);
  wireStudio(app);
  wireCommon(app);
  wireHeroStatic(app);
  // the Ritualists head: the five moods as a constellation (gold hairlines on the night), in place of the old moon arc
  if (!LOYALTY_ENABLED) app.querySelector('.club .head')?.insertAdjacentHTML('beforeend', `<div class="cs-const" aria-hidden="true">${constellation({ labels: true })}</div>`);
  wireRepeatCalc(app, null);
  wireVote(app);
  wireCountdown(app);
  wireSunrise(app);
  wireClub(app);
  // the time of day is the visitor's to change (drag the sun, tap a moment, arrow keys); scrolling only scrolls
  stopDayScrub();
  mountJourney(app);

  const grid = app.querySelector<HTMLElement>('#msGrid');
  if (grid) grid.innerHTML = skeletonCards(4);

  let items: Item[];
  try {
    items = await loadCatalogue();
  } catch (e) {
    if (grid) grid.innerHTML = errorBox(String((e as Error).message ?? e));
    return;
  }
  wireHero(app, items);
  wireMomentShop(app, items);
  wireRepeatCalc(app, items);
  bindCanvasProductLinks(app, items);
}

// ---------- hero: drag the sun ----------
let heroItems: Item[] = [];

function pairFor(m: Moment) {
  return {
    diffuser: findLive(heroItems, m.pair.diffuser, 'diffuser'),
    roller: findLive(heroItems, m.pair.roller, 'roller'),
  };
}

// Coaching offers shown with each moment. Only the two free ways in from the coaching page ("Free · Self-paced 7-Day Ritual Reset,
// about 10 minutes" and "Free · 20 min Discovery call"); the wording per moment is a draft for Claire.
const PRACTICE: Record<MomentKey, { title: string; sub: string; href: string }> = {
  dawn: { title: 'Free 7-day reset', sub: 'Self-paced, about 10 minutes a day', href: '#/reset' },
  morning: { title: 'Free 20-min call with Claire', sub: 'Talk about what you want to change', href: '#/book' },
  midday: { title: 'Free 7-day reset', sub: 'Turn a scent into a calm cue', href: '#/reset' },
  golden: { title: 'Free 20-min call with Claire', sub: 'See if coaching is a fit for you', href: '#/book' },
  night: { title: 'Free 7-day reset', sub: 'Short daily practices, about 10 minutes', href: '#/reset' },
};

function setMoment(app: HTMLElement, m: Moment, _animate = true, lookHour?: number) {
  const hero = app.querySelector<HTMLElement>('#day');
  if (!hero) return;
  hero.dataset.m = m.key;
  applyLook(app, lookHour ?? (useRealClock ? hourNow() : m.hour));
  hero.dataset.m = m.key;

  const clock = app.querySelector('#dClock');
  if (clock) {
    const [hm, ap] = useRealClock ? clockParts(new Date()) : (m.time.split(' ') as [string, string]);
    clock.innerHTML = `<span class="mono">${hm}</span><span class="ap">${ap}</span><span class="mname">${m.name}</span>`;
  }
  const greet = app.querySelector('.greet');
  const greetLine = greeting(new Date(), useRealClock ? undefined : m.name);
  if (greet && greet.textContent !== greetLine) greet.innerHTML = `<span class="dot-live"></span>${greetLine}`;
  const title = app.querySelector('#dTitle')!;
  title.textContent = m.title;
  const line = app.querySelector('#dLine')!;
  line.innerHTML = m.draft ? `<span class="d">${esc(m.line)}</span>` : esc(m.line);

  showHero(app, m.key);

  const { diffuser, roller } = pairFor(m);
  const prods = app.querySelector<HTMLElement>('#dProducts');
  if (prods) {
    // two ways into the moment: the scent ritual (both products as one) and the practice that goes with it (coaching)
    const pair = [diffuser, roller].filter(Boolean) as Item[];
    const total = pair.reduce((n, p) => n + p.priceMin, 0);
    const names = pair.length === 2 && pair[0].scent === pair[1].scent ? `${pair[0].scent}, two ways` : pair.map(p => p.scent).join(' + ');
    const kinds = pair.map(p => (p.format === 'diffuser' ? 'diffuser' : p.format === 'roller' ? 'roller' : p.formatLabel.toLowerCase())).join(' + ');
    // link to the mood of the lead scent shown, so the compass opens on a family that contains it
    // (the moment's own mood can differ: Night is floral, but its ritual leads with Campfire Stories, which is woody)
    const ritual = pair.length ? `<a class="sp sp-ritual" href="#/explore?mood=${pair[0].mood ?? m.mood}" aria-label="The ${esc(m.name.toLowerCase())} ritual: ${esc(names)}, ${money(total)} together">
        <span class="sp-thumbs" aria-hidden="true">${pair.map(p => `<img src="${p.thumb}" alt="">`).join('')}</span>
        <span><small>The ritual</small><b>${esc(names)}</b><em>${esc(kinds.charAt(0).toUpperCase() + kinds.slice(1))} · ${money(total)} together</em></span></a>` : '';
    const c = PRACTICE[m.key];
    const practice = `<a class="sp sp-coach" href="${c.href}" aria-label="${esc(c.title)}: ${esc(c.sub)}">
        <span class="sp-ico" aria-hidden="true"><svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M16 25c-3.2-3.4-3.2-9.6 0-15 3.2 5.4 3.2 11.6 0 15z"/><path d="M16 25c-5-1-8.6-5-8.6-11 4.6 1.2 7.4 4.6 8.6 11z"/><path d="M16 25c5-1 8.6-5 8.6-11-4.6 1.2-7.4 4.6-8.6 11z"/></svg></span>
        <span><small>The practice</small><b>${esc(c.title)}</b><em>${esc(c.sub)}</em></span><span class="sp-go" aria-hidden="true">&rarr;</span></a>`;
    prods.innerHTML = ritual + practice;
  }
  const cta = app.querySelector<HTMLElement>('#dCta');
  if (cta) {
    const total = (diffuser?.priceMin ?? 0) + (roller?.priceMin ?? 0);
    // the shop link follows the ritual's lead scent, the same mood the ritual label opens (night leads with Campfire Stories: woody)
    const leadMood = (diffuser ?? roller)?.mood ?? m.mood;
    const mood = MOODS[leadMood];
    const label = m.draft ? 'scents' : `${m.name.toLowerCase()} scents`;
    cta.innerHTML = `<button class="btn" data-addmoment="${m.key}" ${total ? '' : 'disabled'}>Add this ritual${total ? ` · ${money(total)}` : ''}</button>` +
      `<a class="btn line" href="#/shop?m=${leadMood}">Shop ${m.draft ? esc(mood.label.toLowerCase()) : label}</a>`;
    cta.querySelector<HTMLButtonElement>('[data-addmoment]')?.addEventListener('click', async () => {
      for (const p of [diffuser, roller]) if (p) await add({ productId: p.id, slug: p.slug, name: p.name, price: p.priceMin, image: p.thumb, choice: p.choices[0]?.name, optionName: p.optionName });
      toast(`${m.name} ritual added to your cart`);
    });
  }

  moveSun(app, lookHour ?? (useRealClock ? hourNow() : m.hour));
  app.querySelector('#arc')?.setAttribute('aria-valuenow', m.hour.toFixed(1));
  app.querySelector('#arc')?.setAttribute('aria-valuetext', `${useRealClock ? clockParts(new Date()).join(' ') : m.time}, ${m.name}`);
  app.querySelectorAll<HTMLButtonElement>('.moments [data-jump]').forEach(b => b.setAttribute('aria-current', String(b.dataset.jump === m.key)));
}

// ---------- the continuous day: look, sun, clock and tweens ----------
let liveHour = 18, heroCurrent: Moment | null = null, raf = 0;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function applyLook(app: HTMLElement, hour: number) {
  const hero = app.querySelector<HTMLElement>('#day');
  const sky = app.querySelector<HTMLElement>('#sky');
  if (!hero || !sky) return;
  const L = look(hour); liveHour = hour;
  sky.style.background = `linear-gradient(160deg, ${L.sky[0]} 0%, ${L.sky[1]} 60%, ${L.sky[2]} 100%)`;
  setLook(app, L);
  heroLook(L.sky, L.orbRgb, L.night);
  const stars = app.querySelector<HTMLElement>('#stars'); if (stars) stars.style.opacity = String(L.night);
  const glsky = getSky();
  glsky?.set({ hour, night: L.night, pal: L.sky, orb: L.orbRgb as [number, number, number] });
  // with the realistic sky, the words follow how dark the sky behind them really is (twilight is dark before sunrise)
  const lightText = glsky ? glsky.light() : L.night >= 0.5;
  hero.style.color = lightText ? '#EEE8F6' : 'rgb(35, 26, 43)';
  hero.classList.toggle('sky-dark', lightText);
  app.querySelector('#sunC')?.setAttribute('fill', L.night >= 0.5 ? L.orb : '#FFC37A');
  hero.dataset.m = L.nearest.key;
}
function moveSun(app: HTMLElement, hour: number) {
  const pt = svgPoint(tFor(hour >= 22 || hour < 6 ? (hour < 6 ? 0 : 1) : hour));
  app.querySelector('#sunG')?.setAttribute('transform', `translate(${pt.x},${pt.y})`);
  placeOrb(app, pt.x, pt.y);
  heroLight(); // the moons are lit from where the sun or moon now is
}
function setClockLive(app: HTMLElement, hour: number) {
  const h = Math.floor(hour) % 24, mins = Math.floor((hour % 1) * 60), ap = h >= 12 ? 'pm' : 'am', h12 = ((h + 11) % 12) + 1;
  const mono = app.querySelector('#dClock .mono'), apEl = app.querySelector('#dClock .ap');
  if (mono) mono.textContent = `${h12}:${String(mins).padStart(2, '0')}`; if (apEl) apEl.textContent = ap;
}
function frame(app: HTMLElement, h: number) {
  applyLook(app, h); moveSun(app, h); setClockLive(app, h);
  const m = nearest(h);
  if (!heroCurrent || m.key !== heroCurrent.key) { heroCurrent = m; setMoment(app, m, true, h); setClockLive(app, h); }
}
function stopTween(_app: HTMLElement) { cancelAnimationFrame(raf); raf = 0; }
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
/** Glide the whole look to an hour. Everything blends continuously on the way, then the content settles on the nearest moment. */
function tweenTo(app: HTMLElement, to: number, ms: number, ease: (k: number) => number = easeInOut, done?: () => void) {
  cancelAnimationFrame(raf);
  const from = liveHour, t0 = performance.now();
  const finish = () => { raf = 0; const m = nearest(to); heroCurrent = m; setMoment(app, m, true, to); scrubRebase?.(to); done?.(); };
  if (reduceMotion() || ms <= 0) { finish(); return; }
  const step = (now: number) => { const k = Math.min(1, (now - t0) / ms); frame(app, from + (to - from) * ease(k)); if (k < 1) raf = requestAnimationFrame(step); else finish(); };
  raf = requestAnimationFrame(step);
}

// ---------- the day is the visitor's to change ----------
// The opening used to play a full day as you scrolled; the owner prefers the time of day as a manual control only (drag
// the sun, tap a moment, arrow keys), so scrolling just scrolls. These hooks stay so leaving the page cleans up the same way.
let scrubCleanup: (() => void) | null = null;
/** Re-anchor the scrolling day so the current scroll position shows this hour (after a moment button, a drag or a key). */
let scrubRebase: ((hour: number) => void) | null = null;
const stopDayScrub = () => { scrubCleanup?.(); scrubCleanup = null; scrubRebase = null; };
/** Leaving the home page: the scrolling day and the opening (its timers and pointer listeners) are taken down together. */
export function unmountDayScrub() { stopDayScrub(); unmountOpening(); }
function nearest(hour: number) {
  return MOMENTS.reduce((a, b) => (Math.abs(b.hour - hour) < Math.abs(a.hour - hour) ? b : a));
}

function wireHeroStatic(app: HTMLElement) {
  const skyEl = app.querySelector<HTMLElement>('#sky');
  if (skyEl && !skyEl.querySelector('#scene')) skyEl.insertAdjacentHTML('beforeend', sceneHTML());
  const sceneEl = app.querySelector<HTMLElement>('#scene');
  if (sceneEl) mountSky(sceneEl, window.innerWidth < 820 ? 0.09 : 0.12);
  const greet = app.querySelector('.greet');
  if (greet) greet.innerHTML = `<span class="dot-live"></span>${greeting()}`;
  const golden = momentForHour(hourNow());
  heroCurrent = golden; liveHour = hourNow();
  setMoment(app, golden, false, liveHour);
  mountOpening(app); // the sky wakes into the real hour; the words rise after it (decoration only: everything above is already live)
  app.querySelectorAll<HTMLButtonElement>('.moments [data-jump]').forEach(b =>
    b.addEventListener('click', () => { useRealClock = false; stopTween(app); const to = MOMENTS.find(m => m.key === (b.dataset.jump as MomentKey))!.hour; scrubRebase?.(to); tweenTo(app, to, 1200); }));

  const arc = app.querySelector<SVGSVGElement>('#arc');
  if (!arc) return;
  const fromPointer = (clientX: number) => {
    useRealClock = false; stopTween(app);
    const r = arc.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * 1000;
    frame(app, 6 + 16 * Math.min(1, Math.max(0, (x - 40) / 920)));
  };
  let dragging = false;
  arc.addEventListener('pointerdown', e => { dragging = true; arc.setPointerCapture(e.pointerId); fromPointer(e.clientX); });
  arc.addEventListener('pointermove', e => { if (dragging) fromPointer(e.clientX); });
  const end = () => { if (!dragging) return; dragging = false; tweenTo(app, nearest(liveHour).hour, 520); };
  arc.addEventListener('pointerup', end);
  arc.addEventListener('pointercancel', end);
  arc.addEventListener('keydown', e => {
    useRealClock = false; stopTween(app);
    const i = MOMENTS.findIndex(m => m.key === nearest(liveHour).key);
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { tweenTo(app, MOMENTS[Math.min(MOMENTS.length - 1, i + 1)].hour, 1000); e.preventDefault(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { tweenTo(app, MOMENTS[Math.max(0, i - 1)].hour, 1000); e.preventDefault(); }
  });
  const hint = app.querySelector<HTMLElement>('#hint');
  if (hint) {
    hint.style.opacity = '1';
  }
}

function wireHero(app: HTMLElement, items: Item[]) {
  heroItems = items;
  const key = (app.querySelector<HTMLElement>('#day')?.dataset.m as MomentKey) ?? 'golden';
  setMoment(app, MOMENTS.find(m => m.key === key) ?? MOMENTS[3], false, liveHour);
}

// ---------- Chapter 1: moment shop ----------
function wireMomentShop(app: HTMLElement, items: Item[]) {
  const grid = app.querySelector<HTMLElement>('#msGrid');
  if (!grid) return;
  const show = (key: MomentKey) => {
    const m = MOMENTS.find(x => x.key === key)!;
    const pool = items.filter(i => i.mood === m.mood && i.inStock);
    // one of each format first, then fill
    const picked: Item[] = [];
    for (const f of ['roller', 'diffuser', 'candle', 'deodorant'] as const) { const x = pool.find(i => i.format === f); if (x) picked.push(x); }
    for (const x of pool) if (picked.length < 4 && !picked.includes(x)) picked.push(x);
    grid.innerHTML = picked.slice(0, 4).map(i => cardHTML(i)).join('') || `<p class="muted">No ${MOODS[m.mood].label.toLowerCase()} scents in stock right now.</p>`;
    wireQuickAdd(grid, items);
  };
  app.querySelectorAll<HTMLButtonElement>('.ms-tabs [data-ms]').forEach(b => b.addEventListener('click', () => {
    app.querySelectorAll('.ms-tabs [data-ms]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    show(b.dataset.ms as MomentKey);
  }));
  show('dawn');
}

// ---------- Chapter 4: refill calculator ----------
export function wireRepeatCalc(app: HTMLElement, items: Item[] | null) {
  const calc = app.querySelector<HTMLElement>('#calc');
  if (!calc) return;
  const price: Record<string, number> = { diffuser: 15, deodorant: 12, roller: 25, candle: 36 };
  if (items) {
    const min = (f: string) => Math.min(...items.filter(i => i.format === f).map(i => i.priceMin));
    if (items.some(i => i.format === 'diffuser')) price.diffuser = min('diffuser');
    if (items.some(i => i.format === 'roller')) price.roller = min('roller');
    if (items.some(i => i.format === 'deodorant')) price.deodorant = min('deodorant');
    calc.querySelectorAll<HTMLButtonElement>('[data-ci]').forEach(b => {
      const k = b.dataset.ci!;
      if (k !== 'candle') b.querySelector('small')!.textContent = money(price[k]);
    });
  }
  let item = calc.querySelector<HTMLButtonElement>('[data-ci][aria-pressed="true"]')?.dataset.ci ?? 'diffuser';
  let freq = Number(calc.querySelector<HTMLButtonElement>('[data-cf][aria-pressed="true"]')?.dataset.cf ?? 2);
  const update = () => {
    const p = price[item];
    const saved = Math.round(p * 0.1 * 100) / 100;
    const per = p - saved;
    const deliveries = 12 / freq;
    const year = saved * deliveries;
    calc.querySelector('#cPer')!.textContent = money(per);
    calc.querySelector('#cPerLbl')!.textContent = `per delivery, ${freq === 1 ? 'every month' : `every ${freq} months`}`;
    calc.querySelector('#cSave')!.textContent = `You save ${money(year)} a year`;
    calc.querySelector('#cMath')!.textContent = `${money(p)} × 10% = ${money(saved)} saved per delivery · 12 ÷ ${freq} = ${deliveries} deliveries a year · ${deliveries} × ${money(saved)} = ${money(year)}`;
  };
  if (calc.dataset.wired) { update(); return; }
  calc.dataset.wired = '1';
  calc.querySelectorAll<HTMLButtonElement>('[data-ci]').forEach(b => b.addEventListener('click', () => {
    item = b.dataset.ci!; calc.querySelectorAll('[data-ci]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); update();
  }));
  calc.querySelectorAll<HTMLButtonElement>('[data-cf]').forEach(b => b.addEventListener('click', () => {
    freq = Number(b.dataset.cf); calc.querySelectorAll('[data-cf]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); update();
  }));
  calc.querySelector('#cAdd')?.addEventListener('click', previewOff('Refill subscriptions'));
  update();
}

// ---------- Moon Drops ----------
export function wireVote(app: HTMLElement) {
  const box = app.querySelector<HTMLElement>('#voteBox');
  if (!box) return;
  box.querySelectorAll<HTMLButtonElement>('[data-vote]').forEach(b => b.addEventListener('click', () => {
    box.classList.add('voted');
    box.querySelectorAll<HTMLButtonElement>('[data-vote]').forEach(x => {
      x.setAttribute('aria-pressed', String(x === b));
      const pct = x.querySelector('.vpct')?.textContent ?? '0%';
      const fill = x.querySelector<HTMLElement>('.fill'); if (fill) fill.style.width = pct;
    });
    toast('Voting opens with The Ritualists at launch. Shares shown are sample figures.');
  }));
  app.querySelectorAll<HTMLButtonElement>('[data-notify]').forEach(b => b.addEventListener('click', previewOff('Drop notifications')));
}

export function wireCountdown(app: HTMLElement) {
  const cd = app.querySelector<HTMLElement>('#cd');
  if (!cd) return;
  const target = new Date(NEXT_DROP_ISO).getTime();
  const tick = () => {
    const ms = Math.max(0, target - Date.now());
    const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
    const b = cd.querySelectorAll('b');
    if (b.length >= 3) { b[0].textContent = String(d); b[1].textContent = String(h).padStart(2, '0'); b[2].textContent = String(m).padStart(2, '0'); }
  };
  tick();
  const id = window.setInterval(() => { if (!document.body.contains(cd)) clearInterval(id); else tick(); }, 30000);
}

// ---------- Send a Sunrise ----------
export function wireSunrise(app: HTMLElement) {
  const note = app.querySelector<HTMLTextAreaElement>('#gNote');
  const out = app.querySelector<HTMLElement>('#gCardNote');
  if (note && out) note.addEventListener('input', () => { out.textContent = note.value || ' '; });
  const card = app.querySelector<HTMLElement>('#gCard');
  app.querySelectorAll<HTMLButtonElement>('[data-sky]').forEach(b => b.addEventListener('click', () => {
    b.parentElement!.querySelectorAll('[data-sky]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    if (card) card.dataset.t = b.dataset.sky!;
  }));
  app.querySelector('#gAdd')?.addEventListener('click', previewOff('Send a Sunrise gifting'));
}

// ---------- Ritualists, Pass the Light, newsletter ----------
export function wireClub(app: HTMLElement) {
  app.querySelector('#bdSave')?.addEventListener('click', previewOff('Birthday rewards'));
  app.querySelectorAll('[data-join]').forEach(b => b.addEventListener('click', previewOff('The Ritualists sign-up')));
  app.querySelector('#copyRef')?.addEventListener('click', previewOff('Referral links'));
  app.querySelector('#simRef')?.addEventListener('click', () => {
    const next = app.querySelector('#flames .flame:not(.lit)');
    if (next) next.classList.add('lit'); else toast('All three lit. In the live club, the next candle would be free.');
  });
  app.querySelector<HTMLFormElement>('#nform')?.addEventListener('submit', e => { e.preventDefault(); previewOff('Newsletter sign-up')(); });
}
