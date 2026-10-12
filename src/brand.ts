// The Daily Rituals Co. logo (Claire's own, public/img/brand/, lifted off its black square by tools/photo/logo_cut.py) and
// the two places it is used as a picture rather than as the header's small mark:
//
// - the footer's signature: the logo, softly lit by candlelight on the night of the footer (src/canvas/footer.html);
// - The Ritualists (home chapter 6 and /club): an embossed membership card with the logo and a wax seal, turning slightly in
//   the light. The club is not open, so the card only says "coming soon": no member number, no points, no rewards.
import './brand.css';

export const LOGO_SRC = '/img/brand/logo-600.webp';
export const LOGO_SRCSET = '/img/brand/logo-600.webp 600w, /img/brand/logo-1200.webp 1200w';

// the seal's emblem: a single flame, pressed into the wax
const FLAME = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 5c3.4 5.6 9.2 9.6 9.2 17.2a9.2 9.2 0 0 1-18.4 0c0-4.6 2.6-7.4 4.4-10.1.7 2.9 2.1 4.7 4 5.3-.6-4.6.2-8.6.8-12.4z"/><path class="in" d="M20 19c1.6 2.5 3.7 4.2 3.7 7.1a3.7 3.7 0 0 1-7.4 0c0-2.6 2.1-4.3 3.7-7.1z"/></svg>';
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C12.6 8.6 15.4 11.4 22 12C15.4 12.6 12.6 15.4 12 22C11.4 15.4 8.6 12.6 2 12C8.6 11.4 11.4 8.6 12 2Z"/></svg>';

/** The Ritualists' membership card: one described picture. "Coming soon" is copy, so it is a draft for Claire. */
export function ritualistsCardHTML(): string {
  return `<div class="rit-card-wrap" role="img" aria-label="The Ritualists membership card, with the Daily Rituals Co. logo and a wax seal: coming soon">
    <span class="rc-glow" aria-hidden="true"></span>
    <div class="rc-float" aria-hidden="true"><div class="rc-tilt">
      <span class="rc-edge"></span>
      <div class="rit-card">
        <span class="rc-frame"></span>
        <img class="rc-logo" src="${LOGO_SRC}" srcset="${LOGO_SRCSET}" sizes="(max-width: 820px) 240px, 330px" alt="" width="600" height="179" loading="lazy" decoding="async">
        <span class="rc-rule"><i></i>${STAR}<i></i></span>
        <span class="rc-name">The Ritualists</span>
        <span class="rc-soon"><span class="d">Coming soon</span></span>
        <span class="rc-sheen"></span>
      </div>
      <span class="rc-seal">${FLAME}</span>
    </div></div>
    <span class="rc-shadow" aria-hidden="true"></span>
  </div>`;
}

/** The card leans towards the pointer on a desktop (its sheen moving with it). Still for reduced motion and on touch. */
export function wireRitualistsCard(root: ParentNode) {
  const wrap = root.querySelector<HTMLElement>('.rit-card-wrap');
  if (!wrap || !window.matchMedia('(hover: hover)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const zone = wrap.closest<HTMLElement>('section') ?? wrap;
  zone.addEventListener('pointermove', e => {
    const r = wrap.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width * 0.9)));
    const y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height * 1.1)));
    wrap.style.setProperty('--px', x.toFixed(3)); wrap.style.setProperty('--py', y.toFixed(3));
  });
  zone.addEventListener('pointerleave', () => { wrap.style.removeProperty('--px'); wrap.style.removeProperty('--py'); });
}
