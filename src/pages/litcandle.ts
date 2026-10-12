// One of Claire's candles, photographed, that can be lit a little at a time (the coaching page's calm-cue loop and its last
// call to action). The unlit photograph, the lit one (the glass and wax glowing, its own flames painted out) fading in over it,
// and on each wooden wick a flame drawn to match the photographed ones (candleflame.ts): it catches, then grows as the light
// level rises, and flickers while it is on screen. With reduced motion it is drawn once, steady, at its level.
import { PICKER_CANDLES, pickerSrc, type PickerCandle } from './picker';
import { PhotoFlames, createFlicker } from './candleflame';

export const cueCandle = (): PickerCandle => PICKER_CANDLES.find(c => c.slug === 'verdant') ?? PICKER_CANDLES[0];

/** The markup: a box the photographs fill (size it with CSS: a width, the height follows the photo). */
export function candlePhotoHTML(c: PickerCandle, cls: string, sizes: string): string {
  // both photographs sit below the opening of the page, so they wait until they are nearly in view
  const set = (k: 'unlit' | 'glow') => `src="${pickerSrc(c, k)}" srcset="${pickerSrc(c, k, 480)} 480w, ${pickerSrc(c, k)} 900w" sizes="${sizes}" loading="lazy"`;
  return `<div class="lc ${cls}" data-slug="${c.slug}" style="aspect-ratio:${c.w} / ${c.h}" aria-hidden="true">
    <span class="lc-pic"><img class="lc-unlit" ${set('unlit')} alt="" width="${c.w}" height="${c.h}" decoding="async" draggable="false"><img class="lc-glow" ${set('glow')} alt="" width="${c.w}" height="${c.h}" decoding="async" draggable="false"></span></div>`;
}

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x);

export class LitCandle {
  /** the light level being shown (eases towards the target) */
  level = 0;
  private target = 0; private litAt = -1; private raf = 0; private t0 = performance.now(); private prev = 0; private inView = false; private drawnLevel = -1;
  private flames: PhotoFlames; private glow: HTMLElement; private box: HTMLElement; private reduce: boolean;
  private flick: ReturnType<typeof createFlicker>; private io: IntersectionObserver | null; private ro: ResizeObserver | null;
  constructor(box: HTMLElement, c: PickerCandle, reduce: boolean) {
    this.box = box; this.reduce = reduce; this.flick = createFlicker(reduce);
    this.glow = box.querySelector<HTMLElement>('.lc-glow')!;
    this.flames = new PhotoFlames(box, c.wicks, { reduce, dpr: Math.min(2, window.devicePixelRatio || 1), cls: 'lc-flame' });
    this.ro = 'ResizeObserver' in window ? new ResizeObserver(() => this.layout()) : null; this.ro?.observe(box);
    this.io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { this.inView = e.isIntersecting; this.kick(); }), { rootMargin: '80px' }) : null;
    this.io?.observe(box); if (!this.io) this.inView = true;
    document.addEventListener('visibilitychange', this.onVis);
    this.layout();
  }
  private onVis = () => { if (!this.box.isConnected) this.destroy(); else if (!document.hidden) this.kick(); };
  private layout() {
    const w = this.box.clientWidth, h = this.box.clientHeight; if (!w || !h) return;
    this.flames.layout(w, h); this.drawnLevel = -1; this.kick();
  }
  /** light it to this level (0: unlit, 1: fully lit, as photographed) */
  set(level: number) {
    this.target = clamp(level, 0, 1);
    if (this.target > 0 && this.litAt < 0) this.litAt = performance.now();
    if (this.reduce) this.level = this.target;
    this.kick();
  }
  private kick() { if (!this.raf && this.box.isConnected) this.raf = requestAnimationFrame(this.frame); }
  private frame = (now: number) => {
    this.raf = 0;
    if (!this.box.isConnected) { this.destroy(); return; }
    const dt = Math.min(0.05, (now - (this.prev || now)) / 1000); this.prev = now;
    if (!this.reduce) this.level += (this.target - this.level) * (1 - Math.exp(-dt * 2.4));
    if (Math.abs(this.target - this.level) < 0.002) this.level = this.target;
    const L = this.level, t = (now - this.t0) / 1000;
    // the glass and wax glow in as the light rises; the flame catches once, then grows with it
    this.glow.style.opacity = (L <= 0 ? 0 : clamp(0.15 + 0.85 * L, 0, 1)).toFixed(3);
    const grow = this.litAt < 0 ? 0 : this.reduce ? 1 : clamp((now - this.litAt) / 1100, 0, 1);
    if (!(this.reduce && this.drawnLevel === L)) {
      const [f, gut] = this.flick.at(t);
      this.flames.draw(t, { k: 0.55 + 0.45 * L, f, gut, sway: 0, grow: L > 0 ? grow : 0, size: 0.5 + 0.5 * L });
      this.drawnLevel = L;
    }
    // keep going while it flickers on screen (or is still easing / catching)
    const busy = this.level !== this.target || (grow > 0 && grow < 1);
    if (busy || (!this.reduce && L > 0 && this.inView && !document.hidden)) this.raf = requestAnimationFrame(this.frame);
    else this.prev = 0;
  };
  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0;
    this.io?.disconnect(); this.ro?.disconnect(); document.removeEventListener('visibilitychange', this.onVis);
  }
}
