// The coaching page's cue kit: one scent (Cabana, the one scent the shop has as a candle, a fragrance roller and a mini
// diffuser) in its three forms, each floating over a soft plinth. Only real products: the names, sizes, links and prices come
// from the live catalogue, and a form the catalogue does not have is simply left out (with none, the section keeps its words
// and its link to the scents). The candle is Claire's photograph, lit as it comes into view (litcandle.ts); the roller and
// the diffuser are their shop photographs. The kit tips a little towards the pointer, and each piece drifts gently over its
// plinth, its shadow tightening as it sinks; with reduced motion they stand still.
import { loadCatalogue, type Item } from '../wix';
import { esc, priceText } from '../ui';
import { PICKER_CANDLES } from './picker';
import { candlePhotoHTML, LitCandle } from './litcandle';

const SCENT = 'cabana';
const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type Piece = { item: Item; kind: 'roller' | 'candle' | 'diffuser'; label: string; use: string };

export async function mountKit(app: HTMLElement) {
  const stage = app.querySelector<HTMLElement>('#coKitStage');
  if (!stage) return;
  let items: Item[] = [];
  try { items = await loadCatalogue(); } catch { stage.hidden = true; return; }
  const of = (f: Item['format']) => items.find(i => i.format === f && (f === 'candle' ? i.slug === SCENT : i.scent.toLowerCase() === SCENT));
  // the order they stand in: the candle (the home pause) in the middle, a little higher
  const pieces = ([
    { item: of('roller'), kind: 'roller', label: 'Roller', use: 'For the pause on the go' },
    { item: of('candle'), kind: 'candle', label: 'Candle', use: 'For the pause at home' },
    { item: of('diffuser'), kind: 'diffuser', label: 'Mini diffuser', use: 'For your desk' },
  ] as Partial<Piece>[]).filter((p): p is Piece => !!p.item);
  if (!stage.isConnected) return;
  if (!pieces.length) { stage.hidden = true; return; }
  const photo = PICKER_CANDLES.find(c => c.slug === SCENT);
  stage.innerHTML = `<div class="kit-scent"><span class="eyebrow"><span class="d">An optional cue kit</span></span><b>${esc(pieces[0].item.scent)}</b><span class="d">One scent, in ${pieces.length === 3 ? 'three' : pieces.length === 2 ? 'two' : 'one'} form${pieces.length > 1 ? 's' : ''}</span></div>
    <div class="kit-row" style="--n:${pieces.length}">${pieces.map((p, i) => `
    <a class="kit-item k-${p.kind}" href="#/product/${encodeURIComponent(p.item.slug)}" style="--i:${i}">
      <span class="kit-float"><span class="kit-obj">
        <span class="kit-arch">${p.kind === 'candle' && photo
          ? candlePhotoHTML(photo, 'kit-candle', '(max-width: 820px) 160px, 240px')
          : `<img src="${p.item.image}" alt="" loading="lazy" decoding="async">`}</span></span></span>
      <span class="kit-plinth" aria-hidden="true"><span class="kit-shadow"></span><i class="kit-side"></i><i class="kit-top"></i></span>
      <span class="kit-tag"><b>${esc(p.label)}</b><span class="kit-name">${esc(p.item.name)}</span><span class="kit-price">${esc(priceText(p.item))}</span><span class="kit-use"><span class="d">${esc(p.use)}</span></span></span>
    </a>`).join('')}</div>`;

  const lit = stage.querySelector<HTMLElement>('.kit-candle');
  const candle = lit && photo ? new LitCandle(lit, photo, reduce()) : null;
  if (candle) {
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { io?.disconnect(); window.setTimeout(() => candle.set(1), 300); } }, { threshold: 0.3 }) : null;
    if (io) io.observe(stage); else candle.set(1);
  }

  // the kit tips a little towards the pointer (a fine pointer only), so the pieces part at their different depths
  const row = stage.querySelector<HTMLElement>('.kit-row')!;
  if (reduce() || !window.matchMedia('(pointer: fine)').matches) return;
  let raf = 0, tx = 0, ty = 0, cx = 0, cy = 0;
  const step = () => {
    raf = 0; cx += (tx - cx) * 0.08; cy += (ty - cy) * 0.08;
    row.style.setProperty('--ry', `${cx.toFixed(2)}deg`); row.style.setProperty('--rx', `${cy.toFixed(2)}deg`);
    if (Math.abs(tx - cx) > 0.01 || Math.abs(ty - cy) > 0.01) raf = requestAnimationFrame(step);
  };
  stage.addEventListener('pointermove', e => {
    const r = stage.getBoundingClientRect();
    tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / r.width)) * 8;
    ty = -Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / r.height)) * 5;
    if (!raf) raf = requestAnimationFrame(step);
  });
  stage.addEventListener('pointerleave', () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(step); });
}
