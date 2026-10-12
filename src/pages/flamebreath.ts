import { add } from '../cart';
import { money, loadProduct } from '../wix';
import { MOODS } from '../config';
import { PICKER_CANDLES, pickerSrc, matchLive, rememberCandle, lastCandle, type PickerCandle, type LiveCandle } from './picker';
import { PhotoFlames, createFlicker } from './candleflame';
import { createCrackle, type Crackle } from './pickersound';
import { createBodhi, BODHI_FORK, BODHI_TOP, type BodhiLight } from './bodhi';
import '../flamebreath.css';

// The breathing pause, opened by the breathing orb on every page and by [data-breathe] buttons: "choose your candle, light
// it, breathe".
//
// Stage 1, choose: night under a great Bodhi tree (bodhi.ts), the whole tree in the picture: its full, layered crown rises
// to just behind the words at the top, its broad trunk and roots stand in the middle on dark earth, a dark silhouette with
// the moon (out of sight, high on the left) on its rim. Behind it the night sky: deep navy deepening to violet at the
// horizon, many stars and a faint band of the Milky Way, stars that twinkle each at its own moment, a few brighter, now
// and then a shooting star, the whole sky drifting very slowly. The shop's candles stand unlit on the ground at the
// trunk's foot, small beside it, in a carousel: the chosen one in the middle, the others smaller and dimmer to the sides, further back under the tree.
// Swipe or drag, arrow keys, or the ‹ › buttons. Under it: its name and a short line, the live price, "Light it & breathe"
// and "Add to cart". The breath already keeps its pace at the top ("Take a moment", then in, hold, out).
//
// Stage 2, breathe: the wooden wicks catch (canvas flames on the wicks, each with a warm bloom in the air around it, the
// photographed glow of the lit glass and wax fading in, and, only if the sound toggle was tapped, a soft crackle made with
// the Web Audio API). The candle's light pools on the ground and warms the roots, the trunk and the underside of the crown. The breath begins again with the candle: on
// the in-breath everything comes to life (the light rises up the tree, the stars brighten, the flames swell); on the
// out-breath it settles and the night cools, still beautiful, and now and then a leaf lets go. After three full breaths a
// quiet offer appears below: bring the candle home, or pair it with its roller. It never takes focus or stops the breath.
//
// How it is drawn: the stars and the Milky Way are painted once onto one canvas (and a hundred or so twinkle as tiny
// elements with their own CSS cycles; the shooting star is one element, sent with the Web Animations API from the frame,
// so it stops when the page is hidden); the sky and its glow are CSS gradients whose opacity follows the breath; the tree is painted once per layout,
// with the candle's light on it as a second layer whose opacity follows the flame; the candles are photographs (cut-outs of
// Claire's photos, made unlit by hand, see picker.ts). A frame sets a few opacities, redraws the few hundred leaves nearest
// the light so they tremble and, while a candle is lit, draws its two flames on two small canvases (a pre-painted teardrop
// sprite drawn in strips so it bends and ripples).

const IN = 4000, HOLD = 2000, OUT = 6000, CYCLE = IN + HOLD + OUT, LEAD = 1200, BREATHS_BEFORE_OFFER = 3;
/** the flames stand this much taller (and wider) than the photographed ones: at the candles' size under the tree, the
 * photographed flame read as a timid spark */
const FLAME_SCALE = 1.4;
/** how wide the candles stand, against the stage: on a phone, its width; on a wider screen, its height (a fifth smaller
 * than before the tree was shown whole: 0.4 and 0.5) */
const CANDLE_PHONE = 0.33, CANDLE_WIDE = 0.41;
/** the strength of the candle's light that the tree's light layer is painted at; the flicker can briefly reach it */
const LIGHT_MAX = 1.12;
/** the night sky behind the tree (see .fb-sky): high up, behind the crown, at the horizon; for the haze on its far canopy */
const SKY = ['#0A1030', '#1A1D4A', '#2E2558'] as const;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sineInOut = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const seeded = (seed: number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };

/**
 * The night sky, painted once per layout: a faint band of the Milky Way rising across it (soft clouds of light with dark
 * lanes of dust along its middle, and many tiny stars crowded into it), and the stars themselves: many, small and still,
 * a few much brighter with a little glow, white, blue-white and warm, thinning a little towards the horizon (hz: where the
 * ground meets the sky, in CSS px).
 */
function paintStars(cv: HTMLCanvasElement, d: number, hz: number) {
  const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
  cv.width = Math.round(W * d); cv.height = Math.round(H * d);
  const g = cv.getContext('2d')!; g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, W, H);
  hz -= cv.getBoundingClientRect().top;
  const rnd = seeded(11), sky = Math.max(80, Math.min(H, hz)), area = W * sky, k = Math.sqrt(area / (1440 * 620));
  // the Milky Way: a gentle arc from low on the left up across the sky to the right (u: 0..1 along it)
  const band = (u: number): [number, number] => [W * (-0.08 + 1.16 * u), sky * (0.96 - 0.82 * u - 0.14 * Math.sin(Math.PI * u))];
  const bw = Math.max(70, Math.min(W, sky) * 0.17);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 150; i++) {
    const u = rnd(), [x, y] = band(u), off = (rnd() + rnd() + rnd() - 1.5) * bw * 0.7, r = bw * (0.35 + rnd() * 0.75);
    const warm = rnd() < 0.3, a = 0.034 + rnd() * 0.05;
    const gr = g.createRadialGradient(x, y + off, 0, x, y + off, r);
    gr.addColorStop(0, warm ? `rgba(214,196,226,${a.toFixed(3)})` : `rgba(168,186,244,${a.toFixed(3)})`); gr.addColorStop(1, 'rgba(160,180,240,0)');
    g.fillStyle = gr; g.fillRect(x - r, y + off - r, 2 * r, 2 * r);
  }
  g.restore();
  // the dark lanes of dust that split its middle
  g.save(); g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 46; i++) {
    const u = rnd(), [x, y] = band(u), off = (rnd() - 0.5) * bw * 0.35 + bw * 0.08 * Math.sin(u * 9), r = bw * (0.12 + rnd() * 0.22);
    const gr = g.createRadialGradient(x, y + off, 0, x, y + off, r); gr.addColorStop(0, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(x - r, y + off - r, 2 * r, 2 * r);
  }
  g.restore();
  const dot = (x: number, y: number, r: number, a: number, tone: number) => {
    g.fillStyle = tone < 0.16 ? `rgba(255,224,190,${a.toFixed(3)})` : tone > 0.8 ? `rgba(196,212,255,${a.toFixed(3)})` : `rgba(244,242,255,${a.toFixed(3)})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  };
  // the dust of faint stars in the band
  for (let i = 0, n = Math.round(900 * k); i < n; i++) {
    const [x, y] = band(rnd()), off = (rnd() + rnd() - 1) * bw * 0.9;
    dot(x + (rnd() - 0.5) * 8, y + off, 0.3 + rnd() * 0.35, 0.18 + rnd() ** 2 * 0.45, rnd());
  }
  // the stars across the whole sky: most faint, some clear, a few bright with a soft glow around them
  for (let i = 0, n = Math.round(Math.min(1300, area / (W < 700 ? 520 : 800))); i < n; i++) {
    const y = sky * Math.pow(rnd(), 1.15), x = rnd() * W, m = rnd(), fade = 1 - 0.45 * (y / sky) ** 2, tone = rnd();
    const r = 0.3 + m ** 4 * 1.25, a = (0.2 + m ** 1.5 * 0.75) * fade;
    if (m > 0.965) { const gl = g.createRadialGradient(x, y, 0, x, y, r * 5); gl.addColorStop(0, `rgba(220,226,255,${(0.22 * fade).toFixed(3)})`); gl.addColorStop(1, 'rgba(220,226,255,0)'); g.fillStyle = gl; g.fillRect(x - r * 5, y - r * 5, r * 10, r * 10); }
    dot(x, y, r, a, tone);
  }
}

/** The stars that twinkle, scattered at random across the sky above the ground (top and left in %, of the sky: see .fb-tw),
 * each on its own irregular cycle (CSS); a few are bright, with a soft cross of light. Deterministic, so screenshots compare. */
function twinkles(count: number) {
  const rnd = seeded(29); let s = '';
  for (let i = 0; i < count; i++) {
    const y = 2 + Math.pow(rnd(), 1.2) * 92, x = 1 + rnd() * 98, big = rnd() < 0.12, size = big ? 2.3 + rnd() * 1.3 : 1.1 + rnd() * 1.1, tone = rnd();
    s += `<i class="${big ? 'b' : ''}${tone < 0.18 ? ' w' : tone > 0.82 ? ' c' : ''}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;--s:${size.toFixed(1)}px;--d:${(2.2 + rnd() * 5.5).toFixed(2)}s;--l:-${(rnd() * 8).toFixed(2)}s;--a:${(0.6 + rnd() * 0.4).toFixed(2)}"></i>`;
  }
  return s;
}

const FLAME_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M12 2.5c.6 3.2 4.8 5.6 4.8 10.2A4.8 4.8 0 0 1 12 17.5a4.8 4.8 0 0 1-4.8-4.8c0-2.2 1.3-3.7 2.3-4.9.3 1.6 1 2.5 1.9 2.9-.4-3 .1-5.6.6-8.2z" fill="currentColor"/><path d="M11 18.5h2v3h-2z" fill="currentColor" opacity=".55"/></svg>';
const SOUND_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="on" d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/><path class="off" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';


export function openBreathe(opener: HTMLElement) {
  document.querySelectorAll('.jbreathe').forEach(n => n.remove());
  const q = new URLSearchParams(location.search + (location.hash.includes('?') ? '&' + location.hash.split('?')[1] : ''));
  const speed = q.get('breath') === 'fast' ? 10 : 1, reduce = reduceMotion();
  const candles = PICKER_CANDLES, N = candles.length;
  let sel = Math.max(0, candles.findIndex(c => c.slug === lastCandle()));
  const live = new Map<string, LiveCandle>(), size = new Map<string, string>(), variantPrice = new Map<string, Map<string, number>>();

  const el = document.createElement('div');
  el.className = 'jbreathe fb'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'A moment to breathe: choose your candle');
  el.dataset.stage = 'pick';
  const slide = (c: PickerCandle, i: number) => `<button class="fb-c" type="button" data-i="${i}" data-slug="${c.slug}" aria-pressed="${i === sel}" aria-label="${esc(c.name)}, candle ${i + 1} of ${N}" style="--ar:${c.w} / ${c.h};--sc:${c.scale};--drop:${((1 - c.foot) * c.scale * c.h / c.w).toFixed(4)}">
      <span class="fb-ph"><span class="fb-pic"><img class="fb-unlit" src="${pickerSrc(c, 'unlit')}" srcset="${pickerSrc(c, 'unlit', 480)} 480w, ${pickerSrc(c, 'unlit')} 900w" sizes="(max-width: 700px) 80vw, 560px" alt="${esc(c.alt)}" width="${c.w}" height="${c.h}" decoding="async" draggable="false"><img class="fb-glow" src="${pickerSrc(c, 'glow')}" srcset="${pickerSrc(c, 'glow', 480)} 480w, ${pickerSrc(c, 'glow')} 900w" sizes="(max-width: 700px) 80vw, 560px" alt="" width="${c.w}" height="${c.h}" decoding="async" draggable="false"></span></span></button>`;
  el.innerHTML = `<div class="fb-sky" aria-hidden="true"><div class="fb-moon"></div><div class="fb-drift"><canvas class="fb-stars"></canvas><div class="fb-tw">${twinkles(window.innerWidth < 700 ? 54 : 110)}</div></div><i class="fb-meteor"></i></div>
    <div class="fb-horizon" aria-hidden="true"></div><div class="fb-cool" aria-hidden="true"></div><div class="fb-ground" aria-hidden="true"></div>
    <div class="fb-tree" aria-hidden="true"><canvas class="fb-bodhi"></canvas></div>
    <div class="fb-bar">${reduce ? '' : `<button class="fb-sound" type="button" aria-pressed="false">${SOUND_ICON}<span>Sound off</span></button>`}<button class="btn jb-close" type="button">Done</button></div>
    <header class="fb-head"><p class="fb-eyebrow">Choose your candle</p><p class="jb-word" id="jbWord">Take a moment</p></header>
    <div class="fb-stage">
      <div class="fb-pool" aria-hidden="true"></div><div class="fb-bloom" aria-hidden="true"></div>
      <div class="fb-track" role="group" aria-roledescription="carousel" aria-label="Candles: swipe, or use the arrow keys">${candles.map(slide).join('')}</div>
    </div>
    <div class="fb-low">
      <div class="fb-info">
        <p class="fb-mood"></p>
        <div class="fb-namerow"><button class="fb-nav prev" type="button" aria-label="Previous candle"><span aria-hidden="true">‹</span></button><h2 class="fb-name"></h2><button class="fb-nav next" type="button" aria-label="Next candle"><span aria-hidden="true">›</span></button></div>
        <div class="fb-dots" aria-hidden="true">${candles.map(() => '<i></i>').join('')}</div>
        <p class="fb-line"></p>
        <div class="fb-buy"><div class="fb-sizes" role="group" aria-label="Size"></div><p class="fb-price"></p></div>
        <div class="fb-actions"><button class="btn fb-light" type="button">${FLAME_ICON}<span>Light it &amp; breathe</span></button><button class="btn fb-add" type="button">Add to cart</button></div>
        <p class="fb-status" role="status"></p>
      </div>
      <div class="fb-breath">
        <p class="jb-sub">Breathe in, hold, breathe out. Stay as long as you like.</p>
        <div class="fb-offer" hidden><p class="fb-offer-t"></p><div class="fb-offer-a"><button class="btn fb-home" type="button"></button><a class="btn fb-pair" href="#/shop?f=roller">Pair it with its roller</a></div></div>
        <button class="fb-back" type="button">‹ Choose another candle</button>
      </div>
    </div>
    <p class="fb-sr" aria-live="polite"></p>`;
  document.body.append(el); requestAnimationFrame(() => el.classList.add('open'));

  const $ = <T extends HTMLElement = HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const word = $('#jbWord'), stage = $('.fb-stage'), sr = $('.fb-sr'), status = $('.fb-status');
  const drift = $('.fb-drift'), horizon = $('.fb-horizon'), cool = $('.fb-cool'), pool = $('.fb-pool'), bloom = $('.fb-bloom');
  const slides = [...el.querySelectorAll<HTMLButtonElement>('.fb-c')];
  const starCv = $<HTMLCanvasElement>('.fb-stars'), soundBtn = el.querySelector<HTMLButtonElement>('.fb-sound');
  const offer = $('.fb-offer'), addBtn = $<HTMLButtonElement>('.fb-add'), sizesEl = $('.fb-sizes'), priceEl = $('.fb-price');
  const d = Math.min(2, window.devicePixelRatio || 1);
  if (speed !== 1) word.style.animationDuration = `${(0.9 / speed).toFixed(2)}s`; // ?breath=fast: the words keep up

  // ---------- the candle on show and what the shop says about it ----------
  const cur = () => candles[sel];
  const itemOf = (c: PickerCandle) => live.get(c.slug)?.item;
  const choiceOf = (c: PickerCandle) => { const it = itemOf(c); if (!it || !it.choices.length) return undefined; return size.get(c.slug) ?? (it.choices.find(x => x.inStock) ?? it.choices[0]).name; };
  /** the price of a size, from the product's variants once they are loaded; until then (or for one size) the catalogue's lowest
   * price, with its highest for the range (n2) */
  const priceOf = (c: PickerCandle, choice?: string): { n: number; n2: number; exact: boolean } | null => {
    const it = itemOf(c); if (!it) return null;
    const v = choice ? variantPrice.get(c.slug)?.get(choice) : undefined;
    if (v != null) return { n: v, n2: v, exact: true };
    return { n: it.priceMin, n2: it.priceMax, exact: it.priceMax === it.priceMin };
  };
  const renderInfo = () => {
    const c = cur(), it = itemOf(c), lv = live.get(c.slug);
    $('.fb-name').textContent = c.name;
    $('.fb-mood').textContent = it?.mood ? `${MOODS[it.mood].label} · candle` : 'Candle';
    $('.fb-line').innerHTML = c.draft ? `<span class="d">${esc(c.line)}</span>` : esc(c.line);
    el.querySelectorAll('.fb-dots i').forEach((n, i) => n.classList.toggle('on', i === sel));
    const choice = choiceOf(c), p = priceOf(c, choice);
    // sizes and price only for a product the shop has: otherwise nothing is shown rather than something invented
    if (it && it.choices.length > 1) {
      sizesEl.innerHTML = it.choices.map(ch => `<button class="fb-size" type="button" data-size="${esc(ch.name)}" aria-pressed="${ch.name === choice}" ${ch.inStock ? '' : 'disabled'}>${esc(ch.name)}${ch.inStock ? '' : ' · sold out'}</button>`).join('');
      sizesEl.hidden = false;
    } else { sizesEl.innerHTML = ''; sizesEl.hidden = true; }
    // a chosen size shows its own price; until the shop has said what that is, the honest range rather than "From" the
    // cheapest, which would read as the chosen size's price ("From" only when no size is chosen)
    priceEl.textContent = !p ? '' : p.exact ? money(p.n) : choice ? `${money(p.n)} – ${money(p.n2)}` : `From ${money(p.n)}`;
    priceEl.hidden = !p;
    const inStock = !!it && (choice ? it.choices.find(x => x.name === choice)?.inStock !== false : it.inStock);
    addBtn.hidden = !it; addBtn.disabled = !inStock;
    addBtn.textContent = !it ? '' : !inStock ? 'Sold out' : p?.exact ? `Add to cart · ${money(p.n)}` : 'Add to cart';
    // the offer after the breaths
    const home = $<HTMLButtonElement>('.fb-home'); home.hidden = !it || !inStock;
    home.textContent = p?.exact ? `Bring this candle home · ${money(p.n)}` : 'Bring this candle home';
    $('.fb-offer-t').textContent = `Three slow breaths with ${c.name}.`;
    const pair = $<HTMLAnchorElement>('.fb-pair'); pair.href = lv?.roller ? `#/product/${lv.roller.slug}` : '#/shop?f=roller';
    pair.textContent = lv?.roller ? `Pair it with its roller · ${money(lv.roller.priceMin)}` : 'Pair it with a roller';
    status.textContent = '';
  };
  const loadVariants = (c: PickerCandle) => {
    if (variantPrice.has(c.slug) || !itemOf(c)) return;
    variantPrice.set(c.slug, new Map());
    loadProduct(c.slug).then((p: any) => {
      const m = variantPrice.get(c.slug)!;
      for (const v of p?.variantsInfo?.variants ?? []) { const name = (v.choices ?? [])[0]?.optionChoiceNames?.choiceName, amt = Number(v?.price?.actualPrice?.amount); if (name && amt > 0) m.set(name, amt); }
      if (cur() === c && el.isConnected) renderInfo();
    }).catch(() => { /* the catalogue's lowest price stays */ });
  };
  renderInfo();
  matchLive(candles).then(m => { m.forEach((v, k) => live.set(k, v)); if (!el.isConnected) return; renderInfo(); loadVariants(cur()); });
  sizesEl.addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-size]'); if (!b || b.disabled) return;
    size.set(cur().slug, b.dataset.size!); renderInfo(); el.querySelector<HTMLElement>(`[data-size="${CSS.escape(b.dataset.size!)}"]`)?.focus();
  });
  const addToCart = async (from: HTMLElement) => {
    const c = cur(), it = itemOf(c); if (!it) return;
    const choice = choiceOf(c), p = priceOf(c, choice)!;
    await add({ productId: it.id, slug: it.slug, name: it.name, price: p.n, image: it.thumb, choice, optionName: it.optionName });
    const label = `${it.name}${choice && it.choices.length > 1 ? ` (${choice})` : ''}`;
    const msg = `${label} is in your cart.`;
    if (from.closest('.fb-offer')) { from.textContent = 'In your cart'; (from as HTMLButtonElement).disabled = true; sr.textContent = msg; }
    else { status.innerHTML = `${esc(msg)} <button class="fb-viewcart" type="button">View cart</button>`; }
  };
  addBtn.addEventListener('click', () => addToCart(addBtn));
  $('.fb-home').addEventListener('click', e => addToCart(e.currentTarget as HTMLElement));
  status.addEventListener('click', e => { if ((e.target as Element).closest('.fb-viewcart')) { close(false); window.setTimeout(() => document.getElementById('cartBtn')?.click(), reduce ? 0 : 420); } });
  $('.fb-pair').addEventListener('click', () => close(false));

  // ---------- the carousel ----------
  let pos = sel, pw = 300, spacing = 300, back = 20, floor = 40, dragging = false, moved = false, lastLayout = '';
  const go = (i: number, announce = true) => {
    i = clamp(i, 0, N - 1); if (i === sel && Math.round(pos) === i) return;
    sel = i; rememberCandle(cur().slug); if (reduce) pos = sel;
    slides.forEach((s, j) => s.setAttribute('aria-pressed', String(j === sel)));
    renderInfo(); loadVariants(cur());
    if (announce) { const p = priceOf(cur(), choiceOf(cur())); sr.textContent = `${cur().name}${p ? `, ${p.exact ? '' : 'from '}${money(p.n)}` : ''}. Candle ${sel + 1} of ${N}.`; }
    el.querySelectorAll<HTMLButtonElement>('.fb-nav').forEach(b => { b.disabled = b.classList.contains('prev') ? sel === 0 : sel === N - 1; });
  };
  el.querySelectorAll<HTMLButtonElement>('.fb-nav').forEach(b => { b.addEventListener('click', () => go(sel + (b.classList.contains('prev') ? -1 : 1))); b.disabled = b.classList.contains('prev') ? sel === 0 : sel === N - 1; });
  if (N < 2) el.querySelectorAll<HTMLElement>('.fb-nav, .fb-dots').forEach(n => (n.hidden = true));
  slides.forEach((s, i) => s.addEventListener('click', () => { if (moved) return; if (stageName === 'pick' && i !== sel) go(i); }));
  /** place every candle for the carousel's position: the chosen one in the middle at the trunk's foot, the others smaller,
   * dimmer and further back under the tree to its sides (further back: higher on the ground, so a little up the screen) */
  const layout = () => {
    const key = `${pos.toFixed(3)}|${pw}|${stageName}`; if (key === lastLayout) return; lastLayout = key;
    slides.forEach((s, i) => {
      const o = i - pos, a = Math.min(Math.abs(o), 2), sg = Math.sign(o);
      const x = sg * a * spacing * (1 - 0.08 * Math.min(a, 1)), y = -Math.min(a, 1.5) * back, sc = 1 - 0.36 * Math.min(a, 1.2);
      const away = stageName === 'pick' ? 0 : i === sel ? 0 : 1;
      s.style.transform = `translate3d(calc(-50% + ${x.toFixed(1)}px), ${y.toFixed(1)}px, 0) scale(${sc.toFixed(3)})`;
      s.style.opacity = (away ? 0 : Math.max(0, 1 - 0.32 * a)).toFixed(3);
      s.style.zIndex = String(10 - Math.round(a * 3));
      s.style.setProperty('--dim', (1 - 0.5 * Math.min(a, 1)).toFixed(3));
      s.style.pointerEvents = away || a > 1.6 ? 'none' : '';
      s.tabIndex = i === sel ? 0 : -1;
    });
  };
  // drag or swipe: the candles follow the finger, then settle on the nearest (or the next, after a flick)
  let px0 = 0, pos0 = 0, vx = 0, lastX = 0, lastT = 0, pid = -1;
  stage.addEventListener('pointerdown', e => {
    if (stageName !== 'pick' || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pid = e.pointerId; px0 = lastX = e.clientX; lastT = performance.now(); pos0 = pos; vx = 0; dragging = true; moved = false;
  });
  stage.addEventListener('pointermove', e => {
    if (!dragging || e.pointerId !== pid) return;
    const dx = e.clientX - px0; if (!moved && Math.abs(dx) > 6) { moved = true; try { stage.setPointerCapture(pid); } catch { /* gone */ } el.classList.add('fb-dragging'); }
    if (!moved) return;
    const now = performance.now(); vx = 0.8 * ((e.clientX - lastX) / Math.max(1, now - lastT)) + 0.2 * vx; lastX = e.clientX; lastT = now;
    let p = pos0 - dx / spacing; if (p < 0) p *= 0.35; if (p > N - 1) p = N - 1 + (p - N + 1) * 0.35; pos = p;
  });
  const endDrag = (e: PointerEvent) => {
    if (!dragging || e.pointerId !== pid) return; dragging = false; el.classList.remove('fb-dragging');
    if (moved) { const flick = Math.abs(vx) > 0.35 ? -Math.sign(vx) : 0; go(Math.abs(pos - sel) > 0.25 || flick ? Math.round(pos + flick * 0.5) : sel); window.setTimeout(() => (moved = false), 0); }
  };
  stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);
  // a sideways trackpad swipe moves one candle
  let wheelAcc = 0, wheelT = 0;
  stage.addEventListener('wheel', e => {
    if (stageName !== 'pick' || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return; e.preventDefault();
    const now = performance.now(); if (now - wheelT > 400) wheelAcc = 0; wheelT = now; wheelAcc += e.deltaX;
    if (Math.abs(wheelAcc) > 60) { go(sel + Math.sign(wheelAcc)); wheelAcc = -Math.sign(wheelAcc) * 400; }
  }, { passive: false });

  // ---------- sizes: the tree, and the candles at its foot ----------
  // The whole tree is in the picture: its crown's dome rises to just behind the words at the top, with the night sky and
  // its stars around it, and on a wide screen the crown spreads nearly to both edges of the window (on a narrow one it runs
  // a little past them, so its trunk keeps its girth). The candles stand on the ground a little in front of the trunk, small
  // beside it, as a tumbler would at the foot of an old tree, and the trunk rises well above them before it forks. tree: the
  // trunk's foot and the tree's scale (see bodhi.ts), in CSS px.
  let tree = { x: 0, y: 0, sx: 0, sy: 0 };
  const resize = () => {
    const r = stage.getBoundingClientRect(); if (!r.width) return;
    const ar = Math.max(...candles.map(c => c.scale * c.foot * c.h / c.w)), phone = r.width < 700, head = $('.fb-head').getBoundingClientRect();
    // the candles stand on the floor line, a little above the bottom of the stage: the focus of the scene, but a fifth
    // smaller than they were, so the tree has the room to be seen whole
    floor = Math.round(clamp(r.height * 0.035, 12, 30));
    pw = Math.round(Math.min(phone ? clamp(r.width * CANDLE_PHONE, 98, 138) : clamp(r.height * CANDLE_WIDE, 130, 238), (r.height - floor - 10) / ar));
    const floorY = r.bottom - floor, footY = floorY - pw * 0.36, topY = head.top + head.height * (phone ? 0.82 : 0.6);
    // the crown's top just behind the words, with the night above it; but the trunk always rises well above the candles
    // before it forks, at least once and a sixth their height
    const sy = Math.max((footY - topY) / BODHI_TOP, (footY - floorY + 1.15 * pw * ar) / BODHI_FORK);
    // across: the whole crown in the window where it fits, never squeezed to less than about half its height, nor wider than a tenth more
    const sx = clamp(r.width / 3, sy * (phone ? 0.56 : 0.62), sy * 1.05);
    // the tree is painted again only when the window really changes: a line of text appearing below (a size, "in your
    // cart") moves the candles a few px, which no one sees, but painting the whole tree again would make it flicker
    const moved = Math.abs(r.left + r.width / 2 - tree.x) > 24 || Math.abs(footY - tree.y) > 24 || Math.abs(sx / tree.sx - 1) > 0.06 || Math.abs(sy / tree.sy - 1) > 0.06;
    if (moved) tree = { x: r.left + r.width / 2, y: footY, sx, sy };
    // the others: beside the trunk's flare on a wide screen; at the edge of a phone's, half in view, to say there is more
    spacing = phone ? r.width * 0.5 : Math.max(pw * 1.2, sx * 0.2 + pw * 0.42); back = pw * 0.09;
    el.style.setProperty('--pw', `${pw}px`); el.style.setProperty('--floor', `${floor}px`); el.style.setProperty('--floorY', `${Math.round(floorY)}px`);
    el.style.setProperty('--groundY', `${Math.round(footY - 0.05 * sy)}px`); lastLayout = ''; layout();
    paintStars(starCv, d, footY - 0.05 * sy);
    if (moved) bodhi.layout();
    if (flames) buildFlames();
  };
  /** A candle's light, standing in the middle: its main flame (the tumbler's, burning down inside the glass, whose light
   * passes through it, so its rim hardly shades the ground) and the foot of the tumbler, hidden behind the lid. */
  const lightOf = (c: PickerCandle): BodhiLight => {
    const r = stage.getBoundingClientRect(), w = pw * c.scale, h = w * c.h / c.w;
    const top = r.bottom - floor + pw * (1 - c.foot) * c.scale * c.h / c.w - h, left = r.left + r.width / 2 - w / 2;
    const wk = c.wicks.find(x => x.rim) ?? c.wicks[0], fx = left + wk.x * w, fy = top + wk.y * h, fh = wk.h * w * FLAME_SCALE * 1.3;
    return { x: fx, y: fy - fh * 0.4, gx: left + 0.64 * w, gy: top + 0.72 * h, r: 0.28 * w, rimH: 0.1 * h, e: 0.3, reach: w * 2.6 };
  };
  /** The light on the tree: the candles are photographed alike, so their main flames stand within a few px of each other
   * and the light is worked out once, from where they stand on average, rather than painted again for every candle chosen. */
  const treeLight = (): BodhiLight => {
    const ls = candles.map(lightOf), avg = (k: keyof BodhiLight) => ls.reduce((a, l) => a + l[k], 0) / ls.length;
    return { x: avg('x'), y: avg('y'), gx: avg('gx'), gy: avg('gy'), r: avg('r'), rimH: avg('rimH'), e: avg('e'), reach: avg('reach') };
  };
  const bodhi = createBodhi({ canvas: $<HTMLCanvasElement>('.fb-bodhi'), sky: SKY, reduce, lightMax: LIGHT_MAX, anchor: () => ({ ...tree, light: treeLight() }) });

  // ---------- the flames (see candleflame.ts: wooden-wick flames matched to the photographed ones) ----------
  let flames: PhotoFlames | null = null, drawnStatic = false;
  const buildFlames = () => {
    flames?.destroy();
    const c = cur(), ph = slides[sel].querySelector<HTMLElement>('.fb-ph')!, w = pw * c.scale;
    flames = new PhotoFlames(ph, c.wicks, { reduce, dpr: d, cls: 'fb-flame', haloCls: 'fb-halo', haloSize: 11, scale: FLAME_SCALE });
    flames.layout(w, w * c.h / c.w); drawnStatic = false;
    // the warm bloom of its light in the night air, centred on its main flame
    const L = lightOf(c), r = stage.getBoundingClientRect(); bloom.style.left = `${(L.x - r.left).toFixed(1)}px`; bloom.style.top = `${(L.y - r.top).toFixed(1)}px`;
  };

  // ---------- the flicker, shared by the flames and their light; a pop of the wood makes it duck for a moment ----------
  const flick = createFlicker(reduce);
  const flicker = (t: number) => flick.at(t, !crackle);

  // ---------- sound: off until the toggle is tapped ----------
  let crackle: Crackle | null = null, soundOn = false;
  soundBtn?.addEventListener('click', () => {
    soundOn = !soundOn;
    if (soundOn && !crackle) { crackle = createCrackle(); if (crackle) crackle.onPop = s => flick.pop((performance.now() - t0) / 1000, s); }
    if (crackle) { if (soundOn) crackle.resume(); else crackle.set(false, 0); }
    soundBtn.setAttribute('aria-pressed', String(soundOn)); soundBtn.querySelector('span')!.textContent = soundOn ? 'Sound on' : 'Sound off';
    el.dataset.sound = soundOn ? 'on' : 'off';
  });
  el.dataset.sound = 'off';

  // ---------- the two stages ----------
  let stageName: 'pick' | 'lit' = 'pick', litAt = 0, offered = false;
  const t0 = performance.now(); let breathAt = t0, hidden = 0, hiddenAt = 0;
  const light = () => {
    if (stageName === 'lit') return;
    stageName = 'lit'; el.dataset.stage = 'lit'; el.setAttribute('aria-label', `A moment to breathe with ${cur().name}`);
    pos = sel; lastLayout = ''; buildFlames(); slides[sel].classList.add('lit');
    litAt = performance.now(); breathAt = litAt; hidden = 0; offered = false; offer.hidden = true;
    last = 'Take a moment'; word.textContent = last; el.dataset.phase = last;
    word.setAttribute('aria-live', 'polite'); sr.textContent = `${cur().name} is lit. Breathe with it.`; $('.fb-eyebrow').textContent = cur().name;
    $('.jb-close').focus();
  };
  const unlight = () => {
    if (stageName !== 'lit') return;
    stageName = 'pick'; el.dataset.stage = 'pick'; el.setAttribute('aria-label', 'A moment to breathe: choose your candle');
    slides.forEach(s => s.classList.remove('lit')); flames?.destroy(); flames = null; lastLayout = '';
    word.removeAttribute('aria-live'); crackle?.set(false, 0); offer.hidden = true; $('.fb-eyebrow').textContent = 'Choose your candle';
    $<HTMLButtonElement>('.fb-light').focus();
  };
  $('.fb-light').addEventListener('click', light);
  $('.fb-back').addEventListener('click', unlight);

  // ---------- now and then a shooting star: a thin streak of light across the sky, behind the tree ----------
  const meteor = $('.fb-meteor'); let nextMeteor = 3 + Math.random() * 4, meteors = 0;
  const shoot = () => {
    const W = window.innerWidth, hz = parseFloat(el.style.getPropertyValue('--groundY')) || window.innerHeight * 0.6;
    const len = clamp(W * 0.12, 70, 170), x = W * (0.12 + Math.random() * 0.76), y = hz * (0.04 + Math.random() * 0.4);
    const dip = 22 + Math.random() * 20, ang = Math.random() < 0.5 ? dip : 180 - dip, far = len * (1.6 + Math.random());
    const at = (d: number) => `translate3d(${(x - len).toFixed(0)}px, ${y.toFixed(0)}px, 0) rotate(${ang.toFixed(1)}deg) translateX(${d.toFixed(0)}px)`;
    meteor.style.width = `${len.toFixed(0)}px`;
    meteor.animate([{ transform: at(0), opacity: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 0.85, offset: 0.6 }, { transform: at(far), opacity: 0 }], { duration: 750 + Math.random() * 450, easing: 'cubic-bezier(.3,.1,.6,1)' });
    meteors++; el.dataset.meteors = String(meteors);
  };

  // ---------- the frame ----------
  let raf = 0, last = '', prev = t0; const styleCache = new Map<HTMLElement, string>();
  const setOp = (n: HTMLElement, v: number, tf?: string) => { const s = v.toFixed(2) + (tf ?? ''); if (styleCache.get(n) === s) return; styleCache.set(n, s); n.style.opacity = v.toFixed(2); if (tf) n.style.transform = tf; };
  let costN = 0, costSum = 0, costMax = 0, treeN = 0, treeSum = 0;
  const loop = (now: number) => {
    const c0 = performance.now();
    const el2 = (now - breathAt - hidden) * speed, dt = Math.min(0.05, (now - prev) / 1000 * speed); prev = now;
    let k = 0.15, sway = 0, outp = -1, w = 'Take a moment';
    if (el2 >= LEAD) {
      const c = (el2 - LEAD) % CYCLE;
      if (c < IN) { w = 'Breathe in'; k = 0.15 + 0.85 * sineInOut(c / IN); }
      else if (c < IN + HOLD) { w = 'Hold'; k = 1; }
      else { w = 'Breathe out'; outp = (c - IN - HOLD) / OUT; k = 1 - 0.85 * sineInOut(outp); sway = Math.sin(Math.PI * Math.min(1, outp * 1.4)) * 0.9; }
    } else k = 0.15 * (el2 / LEAD);
    // while choosing, the guide waits quietly: the breathing starts when a candle is lit
    if (stageName === 'pick') { w = 'Choose one to light'; k = 0.3 + 0.08 * Math.sin(now / 1600); sway = 0; outp = -1; }
    if (reduce) { k = 0.75; sway = 0; outp = -1; }
    // each new word rises in again: two identical animations taken in turn restart it without forcing a layout mid-frame
    if (w !== last) { word.textContent = w; const odd = word.classList.contains('fb-in'); word.classList.toggle('fb-in', !odd); word.classList.toggle('fb-in2', odd); last = w; el.dataset.phase = w; }
    const t = (now - t0) / 1000, [f, gut] = flicker(t), lit = stageName === 'lit';
    if (!reduce && t > nextMeteor) { shoot(); nextMeteor = t + 9 + Math.random() * 16; }
    // the carousel eases to the chosen candle
    if (!dragging) pos = reduce ? sel : Math.abs(sel - pos) < 0.001 ? sel : pos + (sel - pos) * (1 - Math.exp(-dt / speed * 10));
    layout();
    // how alive the scene is: on the in-breath it wakes, on the out-breath it cools (gently, while choosing)
    const sinceLit = lit ? (now - litAt - hidden) / 1000 * speed : 0, catchK = lit ? (reduce ? 1 : clamp(sinceLit / 1.6, 0, 1)) : 0;
    const life = lit ? (0.12 + 0.88 * k) * (0.92 + 0.08 * f) : 0.35 + 0.25 * k;
    setOp(drift, 0.3 + 0.7 * life);
    setOp(horizon, 0.3 + 0.7 * life, ` scale(${(0.86 + 0.26 * life).toFixed(3)})`);
    setOp(cool, lit ? 0.6 * (1 - life) : 0.3 - 0.14 * k);
    setOp(pool, catchK * (0.25 + 0.75 * life) * f);
    setOp(bloom, catchK * (0.3 + 0.7 * life) * f);
    // the tree: its light layer shows as strongly as the flame burns (the breath and the same flicker), the leaves nearest
    // the light tremble, and on an out-breath one may fall
    const tb = performance.now(); bodhi.update(t, k, sway, outp, dt, lit ? catchK * (0.52 + 0.48 * k) * f : 0); treeN++; treeSum += performance.now() - tb;
    if (lit) {
      const g = slides[sel].querySelector<HTMLElement>('.fb-glow')!; setOp(g, catchK * (0.48 + 0.4 * life));
      // the wooden wicks catch one after the other, then burn with the breath
      if (!(reduce && drawnStatic)) {
        flames?.draw(t, { k, f, gut, sway, grow: cur().wicks.map((_, i) => reduce ? 1 : clamp((sinceLit - 0.15 - i * 0.45) / 0.9, 0, 1)) });
        drawnStatic = true;
      }
      if (crackle && soundOn) crackle.set(sinceLit > 0.2, k);
      // after three full breaths, a quiet offer (it never takes focus)
      if (!offered && el2 >= LEAD + BREATHS_BEFORE_OFFER * CYCLE) { offered = true; offer.hidden = false; requestAnimationFrame(() => offer.classList.add('in')); el.dataset.offer = 'shown'; }
    }
    const cost = performance.now() - c0; costN++; costSum += cost; costMax = Math.max(costMax, cost);
    if (costN % 30 === 0) { el.dataset.frameMs = (costSum / costN).toFixed(2); el.dataset.frameMaxMs = costMax.toFixed(2); el.dataset.treeMs = (treeSum / treeN).toFixed(2); treeN = treeSum = 0; }
    raf = requestAnimationFrame(loop);
  };
  const onVis = () => {
    if (document.hidden) { cancelAnimationFrame(raf); hiddenAt = performance.now(); crackle?.suspend(); }
    else { hidden += performance.now() - hiddenAt; prev = performance.now(); if (soundOn) crackle?.resume(); raf = requestAnimationFrame(loop); }
  };
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(() => resize()); ro.observe(stage);
  resize(); go(sel, false); pos = sel; layout(); raf = requestAnimationFrame(loop);

  // ---------- leaving ----------
  let closing = false;
  function close(returnFocus = true) {
    if (closing) return; closing = true;
    cancelAnimationFrame(raf); ro.disconnect(); crackle?.close(); crackle = null; bodhi.destroy();
    document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis);
    el.classList.remove('open'); window.setTimeout(() => { el.remove(); if (returnFocus) opener.focus(); }, reduce ? 0 : 400);
  }
  const focusables = () => [...el.querySelectorAll<HTMLElement>('button, a[href]')].filter(n => !(n as HTMLButtonElement).disabled && n.tabIndex >= 0 && n.offsetParent !== null && getComputedStyle(n).visibility !== 'hidden');
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') { // focus stays inside the pause
      const f = focusables(); if (!f.length) return; const i = f.indexOf(document.activeElement as HTMLElement);
      e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); return;
    }
    if (stageName === 'pick' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End')) {
      if ((e.target as Element)?.closest?.('.fb-sizes')) return;
      e.preventDefault(); go(e.key === 'Home' ? 0 : e.key === 'End' ? N - 1 : sel + (e.key === 'ArrowLeft' ? -1 : 1));
    }
  };
  document.addEventListener('keydown', onKey); $('.jb-close').addEventListener('click', () => close());
  $<HTMLButtonElement>('.fb-light').focus();
}
