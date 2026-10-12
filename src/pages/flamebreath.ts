import { add } from '../cart';
import { money, loadProduct } from '../wix';
import { MOODS } from '../config';
import { PICKER_CANDLES, pickerSrc, matchLive, rememberCandle, lastCandle, type PickerCandle, type LiveCandle, type Wick } from './picker';
import { createCrackle, type Crackle } from './pickersound';
import '../flamebreath.css';

// The breathing pause, opened by the breathing orb on every page and by [data-breathe] buttons: "choose your candle, light
// it, breathe".
//
// Stage 1, choose: a night sky (deep plum and indigo, a warm glow low in the middle, stars that each dim and brighten on
// their own slow cycle, the whole sky drifting very slowly) above a softly lit surface where the shop's candles stand,
// unlit, in a carousel: the chosen one large in the middle, its neighbours smaller, dimmer and further back. Swipe or drag,
// arrow keys, or the ‹ › buttons. Under it: its name and a short line, the live price, "Light it & breathe" and "Add to cart".
// The breath already keeps its pace at the top ("Take a moment", then in, hold, out).
//
// Stage 2, breathe: the wooden wicks catch (small canvas flames on the wicks, the photographed glow of the lit glass and
// wax fading in, and, only if the sound toggle was tapped, a soft crackle made with the Web Audio API). The breath begins
// again with the candle: on the in-breath everything comes to life (the stars brighten, the warm light spreads, the flames
// swell); on the out-breath the night cools and dims, still beautiful. After three full breaths a quiet offer appears below:
// bring the candle home, or pair it with its roller. It never takes focus or stops the breath.
//
// How it is drawn: the stars are painted once onto one canvas (and a few dozen twinkle as tiny elements with their own CSS
// cycles); the sky, the glow and the surface are CSS gradients whose opacity follows the breath; the candles are photographs
// (cut-outs of Claire's photos, made unlit by hand, see picker.ts). A frame sets a few opacities and, while a candle is
// lit, draws its two flames on two small canvases (a pre-painted teardrop sprite drawn in strips so it bends and ripples).

const IN = 4000, HOLD = 2000, OUT = 6000, CYCLE = IN + HOLD + OUT, LEAD = 1200, BREATHS_BEFORE_OFFER = 3;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const sineInOut = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

// a small seeded value noise, so the flicker is organic rather than a keyframe wobble
const hash = (x: number) => { let h = (x * 374761393) | 0; h = (h ^ (h >>> 13)) * 1274126177; return (((h ^ (h >>> 16)) >>> 0) % 10000) / 10000; };
const noise1 = (t: number, seed = 0) => { const x = t + seed * 31.7, i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return (hash(i) + (hash(i + 1) - hash(i)) * u) * 2 - 1; };
const seeded = (seed: number) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };

const offscreen = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return [c, c.getContext('2d')!] as const; };
const linear = (g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) => { const l = g.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) l.addColorStop(o, c); return l; };

/** A flame's outline, its base at (x, y) and its tip h above: round at the bottom, widest a quarter of the way up, a long taper. */
const tear = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  g.beginPath(); g.moveTo(x, y + w * 0.1);
  g.bezierCurveTo(x + w * 0.66, y + w * 0.08, x + w * 0.6, y - h * 0.34, x + w * 0.26, y - h * 0.64);
  g.bezierCurveTo(x + w * 0.1, y - h * 0.82, x + w * 0.02, y - h * 0.93, x, y - h);
  g.bezierCurveTo(x - w * 0.02, y - h * 0.93, x - w * 0.1, y - h * 0.82, x - w * 0.26, y - h * 0.64);
  g.bezierCurveTo(x - w * 0.6, y - h * 0.34, x - w * 0.66, y + w * 0.08, x, y + w * 0.1); g.closePath();
};

/**
 * The flame, painted once at its tallest in device px: an orange envelope, the yellow body, a near-white core low down and
 * the faint blue cup where it meets the wick, each softened with a blur. Returns the sprite and the row of the flame's base.
 */
function flameSprite(hpx: number) {
  const [c, g] = offscreen(hpx * 0.7, hpx * 1.24), x = c.width / 2, by = hpx * 1.12;
  g.filter = `blur(${(hpx * 0.05).toFixed(1)}px)`; // the faint outer mantle
  g.fillStyle = linear(g, 0, by, 0, by - hpx * 1.08, [[0, 'rgba(255,120,40,0)'], [0.1, 'rgba(255,128,48,0.42)'], [0.45, 'rgba(255,140,56,0.5)'], [0.8, 'rgba(250,110,40,0.3)'], [1, 'rgba(240,90,30,0)']]);
  tear(g, x, by, hpx * 0.38, hpx * 1.06); g.fill();
  g.filter = `blur(${(hpx * 0.009).toFixed(1)}px)`; // the luminous body: soot glowing yellow, deepening to orange at the tip
  g.fillStyle = linear(g, 0, by, 0, by - hpx, [[0, 'rgba(255,170,80,0)'], [0.1, 'rgba(255,186,96,0.62)'], [0.22, 'rgba(255,222,146,0.98)'], [0.55, 'rgba(255,204,108,1)'], [0.8, 'rgba(255,156,62,0.86)'], [0.96, 'rgba(255,120,44,0.2)'], [1, 'rgba(255,110,40,0)']]);
  tear(g, x, by, hpx * 0.29, hpx); g.fill();
  g.filter = `blur(${(hpx * 0.028).toFixed(1)}px)`; // the hottest part, almost white, low in the flame
  g.fillStyle = linear(g, 0, by - hpx * 0.07, 0, by - hpx * 0.7, [[0, 'rgba(255,255,250,0)'], [0.12, 'rgba(255,255,250,0.95)'], [0.5, 'rgba(255,254,244,1)'], [0.78, 'rgba(255,240,200,0.55)'], [1, 'rgba(255,228,170,0)']]);
  tear(g, x, by - hpx * 0.07, hpx * 0.18, hpx * 0.6); g.fill();
  // the dark heart just above the wick, where the wax vapour has not caught yet, and the blue cup around it
  g.filter = `blur(${(hpx * 0.02).toFixed(1)}px)`; g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,0.5)';
  g.beginPath(); g.ellipse(x, by - hpx * 0.06, hpx * 0.07, hpx * 0.07, 0, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'lighter'; g.filter = `blur(${(hpx * 0.012).toFixed(1)}px)`;
  g.strokeStyle = 'rgba(96,128,236,0.45)'; g.lineWidth = hpx * 0.03;
  g.beginPath(); g.ellipse(x, by - hpx * 0.06, hpx * 0.125, hpx * 0.085, 0, Math.PI * 0.05, Math.PI * 0.95); g.stroke();
  g.filter = 'none'; g.globalCompositeOperation = 'source-over';
  return { c, by, hpx };
}

/** The glow of the flame in the air: a soft warm radial falloff, drawn scaled. */
function bloomSprite() {
  const [c, g] = offscreen(128, 128), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (let i = 0; i <= 16; i++) { const u = i / 16, a = Math.exp(-u * 5.2) * (1 - u) ** 2; r.addColorStop(u, `rgba(255,${(176 - 50 * u) | 0},${(104 - 40 * u) | 0},${a.toFixed(3)})`); }
  g.fillStyle = r; g.fillRect(0, 0, 128, 128); return c;
}

/** The faint stars of the night, painted once: many, small and still, thinning towards the horizon. */
function paintStars(cv: HTMLCanvasElement, d: number) {
  const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
  cv.width = Math.round(W * d); cv.height = Math.round(H * d);
  const g = cv.getContext('2d')!; g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, W, H);
  const rnd = seeded(11), n = Math.round(Math.min(760, (W * H) / (W < 700 ? 1500 : 2300)));
  for (let i = 0; i < n; i++) {
    const y = H * Math.pow(rnd(), 1.35) * 0.8, x = rnd() * W, r = 0.35 + rnd() ** 3 * 1.1, fade = 1 - y / (H * 0.85);
    const warm = rnd(), a = (0.22 + rnd() ** 1.6 * 0.7) * fade;
    g.fillStyle = warm < 0.2 ? `rgba(255,226,196,${a.toFixed(3)})` : warm > 0.85 ? `rgba(200,214,255,${a.toFixed(3)})` : `rgba(246,240,255,${a.toFixed(3)})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
}

/** The stars that twinkle: each on its own slow cycle (CSS), deterministic so screenshots compare. */
function twinkles(count: number) {
  const rnd = seeded(29); let s = '';
  for (let i = 0; i < count; i++) {
    const y = Math.pow(rnd(), 1.25) * 68, x = rnd() * 100, big = rnd() < 0.14, size = big ? 2.2 + rnd() * 1.2 : 1.1 + rnd() * 1.1;
    s += `<i${big ? ' class="b"' : ''} style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%;--s:${size.toFixed(1)}px;--d:${(4.5 + rnd() * 9).toFixed(1)}s;--l:-${(rnd() * 12).toFixed(1)}s;--a:${(0.55 + rnd() * 0.45).toFixed(2)}"></i>`;
  }
  return s;
}

const FLAME_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M12 2.5c.6 3.2 4.8 5.6 4.8 10.2A4.8 4.8 0 0 1 12 17.5a4.8 4.8 0 0 1-4.8-4.8c0-2.2 1.3-3.7 2.3-4.9.3 1.6 1 2.5 1.9 2.9-.4-3 .1-5.6.6-8.2z" fill="currentColor"/><path d="M11 18.5h2v3h-2z" fill="currentColor" opacity=".55"/></svg>';
const SOUND_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="on" d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/><path class="off" d="M16 9.5l5 5M21 9.5l-5 5"/></svg>';

type Flame = { wick: Wick; cv: HTMLCanvasElement; g: CanvasRenderingContext2D; halo: HTMLElement; href: number; bx: number; by: number; seed: number };

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
  const slide = (c: PickerCandle, i: number) => `<button class="fb-c" type="button" data-i="${i}" data-slug="${c.slug}" aria-pressed="${i === sel}" aria-label="${esc(c.name)}, candle ${i + 1} of ${N}" style="--ar:${c.w} / ${c.h}">
      <span class="fb-ph"><span class="fb-pic"><img class="fb-unlit" src="${pickerSrc(c, 'unlit')}" srcset="${pickerSrc(c, 'unlit', 480)} 480w, ${pickerSrc(c, 'unlit')} 900w" sizes="(max-width: 700px) 80vw, 560px" alt="${esc(c.alt)}" width="${c.w}" height="${c.h}" decoding="async" draggable="false"><img class="fb-glow" src="${pickerSrc(c, 'glow')}" srcset="${pickerSrc(c, 'glow', 480)} 480w, ${pickerSrc(c, 'glow')} 900w" sizes="(max-width: 700px) 80vw, 560px" alt="" width="${c.w}" height="${c.h}" decoding="async" draggable="false"></span></span></button>`;
  el.innerHTML = `<div class="fb-sky" aria-hidden="true"><div class="fb-drift"><canvas class="fb-stars"></canvas><div class="fb-tw">${twinkles(window.innerWidth < 700 ? 44 : 84)}</div></div></div>
    <div class="fb-horizon" aria-hidden="true"></div><div class="fb-cool" aria-hidden="true"></div><div class="fb-ground" aria-hidden="true"></div>
    <div class="fb-bar">${reduce ? '' : `<button class="fb-sound" type="button" aria-pressed="false">${SOUND_ICON}<span>Sound off</span></button>`}<button class="btn jb-close" type="button">Done</button></div>
    <header class="fb-head"><p class="fb-eyebrow">Choose your candle</p><p class="jb-word" id="jbWord">Take a moment</p></header>
    <div class="fb-stage">
      <div class="fb-table" aria-hidden="true"></div><div class="fb-pool" aria-hidden="true"></div>
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
  const drift = $('.fb-drift'), horizon = $('.fb-horizon'), cool = $('.fb-cool'), pool = $('.fb-pool');
  const slides = [...el.querySelectorAll<HTMLButtonElement>('.fb-c')];
  const starCv = $<HTMLCanvasElement>('.fb-stars'), soundBtn = el.querySelector<HTMLButtonElement>('.fb-sound');
  const offer = $('.fb-offer'), addBtn = $<HTMLButtonElement>('.fb-add'), sizesEl = $('.fb-sizes'), priceEl = $('.fb-price');
  const d = Math.min(2, window.devicePixelRatio || 1);
  if (speed !== 1) word.style.animationDuration = `${(0.9 / speed).toFixed(2)}s`; // ?breath=fast: the words keep up

  // ---------- the candle on show and what the shop says about it ----------
  const cur = () => candles[sel];
  const itemOf = (c: PickerCandle) => live.get(c.slug)?.item;
  const choiceOf = (c: PickerCandle) => { const it = itemOf(c); if (!it || !it.choices.length) return undefined; return size.get(c.slug) ?? (it.choices.find(x => x.inStock) ?? it.choices[0]).name; };
  /** the price of a size, from the product's variants once they are loaded; until then (or for one size) the catalogue's lowest price */
  const priceOf = (c: PickerCandle, choice?: string): { n: number; exact: boolean } | null => {
    const it = itemOf(c); if (!it) return null;
    const v = choice ? variantPrice.get(c.slug)?.get(choice) : undefined;
    if (v != null) return { n: v, exact: true };
    return { n: it.priceMin, exact: it.priceMax === it.priceMin };
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
    priceEl.textContent = p ? (p.exact ? money(p.n) : `From ${money(p.n)}`) : '';
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
  let pos = sel, pw = 300, spacing = 300, dragging = false, moved = false, lastLayout = '';
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
  /** place every candle for the carousel's position: the chosen one large in the middle, the others smaller, dimmer and further back */
  const layout = () => {
    const key = `${pos.toFixed(3)}|${pw}|${stageName}`; if (key === lastLayout) return; lastLayout = key;
    slides.forEach((s, i) => {
      const o = i - pos, a = Math.min(Math.abs(o), 2), sg = Math.sign(o);
      const x = sg * a * spacing * (1 - 0.08 * Math.min(a, 1)), y = -Math.min(a, 1.5) * pw * 0.075, sc = 1 - 0.38 * Math.min(a, 1.2);
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

  // ---------- sizes ----------
  const resize = () => {
    const r = stage.getBoundingClientRect(); if (!r.width) return;
    const ar = Math.max(...candles.map(c => c.h / c.w)), phone = r.width < 700;
    // the candles stand on the floor line, a little above the bottom of the stage; the tallest fits under the heading
    const floor = Math.round(clamp(r.height * 0.13, 34, 96));
    pw = Math.round(Math.min(phone ? r.width * 0.9 : Math.min(560, r.width * 0.4), (r.height - floor - 10) / ar));
    spacing = phone ? Math.min(r.width * 0.66, pw * 0.86) : pw * 0.98;
    el.style.setProperty('--pw', `${pw}px`); el.style.setProperty('--floor', `${floor}px`); el.style.setProperty('--floorY', `${Math.round(r.bottom - floor)}px`); lastLayout = ''; layout();
    paintStars(starCv, d);
    if (flames.length) buildFlames();
    // paint the flame for this size while nothing else is happening, so lighting the candle does not stall a frame
    const idle = (window as any).requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 200));
    idle(() => { if (!closing) { spriteFor(flameHpx()); bloom ??= bloomSprite(); } });
  };

  // ---------- the flames ----------
  let flames: Flame[] = [], sprite: ReturnType<typeof flameSprite> | null = null, bloom: HTMLCanvasElement | null = null, drawnStatic = false;
  const spriteFor = (hpx: number) => (sprite?.hpx === hpx ? sprite : (sprite = flameSprite(hpx)));
  const flameHpx = () => Math.ceil(Math.max(...cur().wicks.map(w => w.h)) * pw * 1.22 * 1.3 * d);
  const buildFlames = () => {
    flames.forEach(f => { f.cv.remove(); f.halo.remove(); }); flames = [];
    const c = cur(), ph = slides[sel].querySelector<HTMLElement>('.fb-ph')!, phH = pw * c.h / c.w;
    const maxH = Math.max(...c.wicks.map(w => w.h)) * pw * 1.22;
    spriteFor(Math.ceil(maxH * 1.3 * d)); bloom ??= bloomSprite(); drawnStatic = false;
    c.wicks.forEach((w, i) => {
      const href = w.h * pw * 1.22, cw = href * 2.6, ch = href * 2.5, bx = cw / 2, by = ch * 0.84;
      const cv = document.createElement('canvas'); cv.className = 'fb-flame'; cv.width = Math.round(cw * d); cv.height = Math.round(ch * d);
      Object.assign(cv.style, { left: `${(w.x * pw - bx).toFixed(1)}px`, top: `${(w.y * phH - by).toFixed(1)}px`, width: `${cw.toFixed(1)}px`, height: `${ch.toFixed(1)}px` });
      cv.dataset.base = `${bx.toFixed(1)},${by.toFixed(1)}`; cv.setAttribute('aria-hidden', 'true');
      const halo = document.createElement('span'); halo.className = 'fb-halo'; halo.setAttribute('aria-hidden', 'true');
      Object.assign(halo.style, { left: `${(w.x * pw).toFixed(1)}px`, top: `${(w.y * phH - href * 0.45).toFixed(1)}px`, width: `${(href * 9).toFixed(1)}px`, height: `${(href * 9).toFixed(1)}px` });
      ph.append(halo, cv); flames.push({ wick: w, cv, g: cv.getContext('2d')!, halo, href, bx, by, seed: i * 7 + 3 });
    });
  };
  /** one flame: grow is how far it has caught (0 to 1), k the breath, f and gut the flicker */
  const drawFlame = (fl: Flame, t: number, k: number, f: number, gut: number, grow: number, sway: number) => {
    const { g, cv, href, bx, by, seed } = fl; if (!sprite || !bloom) return;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); if (grow <= 0.001) return;
    g.setTransform(d, 0, 0, d, 0, 0);
    const n2 = reduce ? 0 : noise1(t * 6.1, seed), n3 = reduce ? 0 : noise1(t * 0.9, seed + 1), n4 = reduce ? 0 : noise1(t * 2.7, seed + 2);
    const catching = grow < 1, h = href * (0.8 + 0.26 * k) * f * (catching ? 0.25 + 0.75 * grow : 1);
    const sy = h / sprite.hpx, sx = sy * Math.pow(href / h, 0.3) * 1.7 * (1 + 0.05 * n2 + 0.25 * gut) * (catching ? 0.7 + 0.3 * grow : 1);
    const lean = h * (0.06 * n3 + 0.03 * n4) + sway * h * 0.1, L = clamp((0.55 + 0.45 * k) * f, 0, 1.1) * grow;
    // the warm air close around the flame
    g.globalCompositeOperation = 'lighter';
    const B = href * 1.05; g.globalAlpha = 0.34 * L; g.drawImage(bloom, bx + lean * 0.3 - B, by - h * 0.42 - B * 1.1, B * 2, B * 2.2);
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    // the flame in strips, each shifted by the lean (more towards the tip) and by a ripple running up it; behind a glass rim
    // nothing below the flame's base is drawn
    const fw = sprite.c.width * sx, Nst = 18, sd = sy * d, top = Math.round((by - sprite.by * sy) * d), Hd = sprite.c.height * sd;
    const ripple = reduce ? 0 : h * (0.012 + 0.02 * sway + 0.05 * gut), cut = fl.wick.rim ? Math.round(by * d) : Infinity;
    g.setTransform(1, 0, 0, 1, 0, 0);
    for (let j = 0; j < Nst; j++) {
      const y0 = top + Math.round((j * Hd) / Nst); let y1 = top + Math.round(((j + 1) * Hd) / Nst); if (y0 >= cut) break; y1 = Math.min(y1, cut); if (y1 <= y0) continue;
      const s0 = (y0 - top) / sd, s1 = Math.min(sprite.c.height, (y1 - top) / sd), u = Math.max(0, (sprite.by - (s0 + s1) / 2) / sprite.hpx);
      const off = lean * Math.pow(u, 1.7) + ripple * Math.pow(u, 1.3) * Math.sin(u * 7.5 - t * 8.5);
      g.drawImage(sprite.c, 0, s0, sprite.c.width, s1 - s0, (bx - fw / 2 + off) * d, y0, fw * d, y1 - y0);
    }
    if (catching) { // the wood catching: a bright ember at the wick
      g.setTransform(d, 0, 0, d, 0, 0); g.globalCompositeOperation = 'lighter'; const e = (1 - grow) * 0.9;
      g.globalAlpha = e; g.drawImage(bloom, bx - href * 0.3, by - href * 0.3, href * 0.6, href * 0.5); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
    fl.halo.style.opacity = clamp(L, 0, 1).toFixed(2);
  };

  // ---------- the flicker, shared by the flames and their light; a pop of the wood makes it duck for a moment ----------
  let gutAt = -10, nextGut = 5 + Math.random() * 6, gutS = 1;
  const flicker = (t: number): [number, number] => {
    if (reduce) return [1, 0];
    if (!crackle && t > nextGut) { gutAt = t; gutS = 0.7; nextGut = t + 6 + Math.random() * 10; }
    const a = t - gutAt, gut = a >= 0 && a < 0.5 ? gutS * Math.sin((Math.PI * a) / 0.5) * (0.75 + 0.25 * Math.sin(a * 47)) : 0;
    return [1 + 0.05 * noise1(t * 1.7, 5) + 0.03 * noise1(t * 4.9, 6) + 0.015 * noise1(t * 12.5, 7) - 0.14 * gut, gut];
  };

  // ---------- sound: off until the toggle is tapped ----------
  let crackle: Crackle | null = null, soundOn = false;
  soundBtn?.addEventListener('click', () => {
    soundOn = !soundOn;
    if (soundOn && !crackle) { crackle = createCrackle(); if (crackle) crackle.onPop = s => { gutAt = (performance.now() - t0) / 1000; gutS = s; }; }
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
    slides.forEach(s => s.classList.remove('lit')); flames.forEach(f => { f.cv.remove(); f.halo.remove(); }); flames = []; lastLayout = '';
    word.removeAttribute('aria-live'); crackle?.set(false, 0); offer.hidden = true; $('.fb-eyebrow').textContent = 'Choose your candle';
    $<HTMLButtonElement>('.fb-light').focus();
  };
  $('.fb-light').addEventListener('click', light);
  $('.fb-back').addEventListener('click', unlight);

  // ---------- the frame ----------
  let raf = 0, last = '', prev = t0; const styleCache = new Map<HTMLElement, string>();
  const setOp = (n: HTMLElement, v: number, tf?: string) => { const s = v.toFixed(2) + (tf ?? ''); if (styleCache.get(n) === s) return; styleCache.set(n, s); n.style.opacity = v.toFixed(2); if (tf) n.style.transform = tf; };
  let costN = 0, costSum = 0, costMax = 0;
  const loop = (now: number) => {
    const c0 = performance.now();
    const el2 = (now - breathAt - hidden) * speed, dt = Math.min(0.05, (now - prev) / 1000 * speed); prev = now;
    let k = 0.15, sway = 0, w = 'Take a moment';
    if (el2 >= LEAD) {
      const c = (el2 - LEAD) % CYCLE;
      if (c < IN) { w = 'Breathe in'; k = 0.15 + 0.85 * sineInOut(c / IN); }
      else if (c < IN + HOLD) { w = 'Hold'; k = 1; }
      else { w = 'Breathe out'; const outp = (c - IN - HOLD) / OUT; k = 1 - 0.85 * sineInOut(outp); sway = Math.sin(Math.PI * Math.min(1, outp * 1.4)) * 0.9; }
    } else k = 0.15 * (el2 / LEAD);
    if (reduce) { k = 0.75; sway = 0; }
    if (w !== last) { word.textContent = w; word.classList.remove('fb-in'); void word.offsetWidth; word.classList.add('fb-in'); last = w; el.dataset.phase = w; }
    const t = (now - t0) / 1000, [f, gut] = flicker(t), lit = stageName === 'lit';
    // the carousel eases to the chosen candle
    if (!dragging) pos = reduce ? sel : Math.abs(sel - pos) < 0.001 ? sel : pos + (sel - pos) * (1 - Math.exp(-dt / speed * 10));
    layout();
    // how alive the scene is: on the in-breath it wakes, on the out-breath it cools (gently, while choosing)
    const sinceLit = lit ? (now - litAt - hidden) / 1000 * speed : 0, catchK = lit ? (reduce ? 1 : clamp(sinceLit / 1.6, 0, 1)) : 0;
    const life = lit ? (0.12 + 0.88 * k) * (0.92 + 0.08 * f) : 0.35 + 0.25 * k;
    setOp(drift, 0.3 + 0.7 * life);
    setOp(horizon, 0.3 + 0.7 * life, ` scale(${(0.86 + 0.26 * life).toFixed(3)})`);
    setOp(cool, lit ? 0.8 * (1 - life) : 0.3 - 0.14 * k);
    setOp(pool, catchK * (0.25 + 0.75 * life) * f);
    if (lit) {
      const g = slides[sel].querySelector<HTMLElement>('.fb-glow')!; setOp(g, catchK * (0.5 + 0.5 * life));
      // the wooden wicks catch one after the other, then burn with the breath
      if (!(reduce && drawnStatic)) {
        flames.forEach((fl, i) => drawFlame(fl, t + i * 3.1, k, f, gut, reduce ? 1 : clamp((sinceLit - 0.15 - i * 0.45) / 0.9, 0, 1), sway));
        drawnStatic = true;
      }
      if (crackle && soundOn) crackle.set(sinceLit > 0.2, k);
      // after three full breaths, a quiet offer (it never takes focus)
      if (!offered && el2 >= LEAD + BREATHS_BEFORE_OFFER * CYCLE) { offered = true; offer.hidden = false; requestAnimationFrame(() => offer.classList.add('in')); el.dataset.offer = 'shown'; }
    }
    const cost = performance.now() - c0; costN++; costSum += cost; costMax = Math.max(costMax, cost);
    if (costN % 30 === 0) { el.dataset.frameMs = (costSum / costN).toFixed(2); el.dataset.frameMaxMs = costMax.toFixed(2); }
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
    cancelAnimationFrame(raf); ro.disconnect(); crackle?.close(); crackle = null;
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
