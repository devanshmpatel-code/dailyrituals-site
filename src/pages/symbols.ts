// Contemplative symbols used as quiet decoration: a Bodhi tree whose roots mirror its branches (a tree of life), Bodhi leaves, a
// lotus and the phases of the moon. They are line drawings in one ink colour at low opacity, never text. Sacred figures and sacred
// syllables are left out on purpose, since decoration is not the place for them.

function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** The Bodhi (heart-shaped, long-tipped) leaf, base at 0,0 pointing up. */
export const BODHI_LEAF = 'M0,0 C-9,-2 -13,-12 -9,-20 C-6,-26 -2,-28 -1,-34 L0,-40 L1,-34 C2,-28 6,-26 9,-20 C13,-12 9,-2 0,0 Z';

let treeCache = '';
/** One tall tree of life: leafy canopy at the top, trunk across the middle, roots mirroring the branches below. */
export function treeSVG(): string {
  if (treeCache) return treeCache;
  const r = rng(21), branches: string[] = [], leaves: string[] = [];
  const grow = (x: number, y: number, ang: number, len: number, w: number, depth: number, dir: 1 | -1, leafy: boolean, spread: number) => {
    const ex = x + Math.sin(ang) * len, ey = y + dir * Math.cos(ang) * len;
    const bend = (r() - 0.5) * len * 0.4;
    const cx = (x + ex) / 2 + bend * Math.cos(ang), cy = (y + ey) / 2 + dir * bend * Math.sin(ang);
    branches.push(`<path d="M${x.toFixed(1)},${y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}" stroke-width="${Math.max(0.8, w).toFixed(1)}"/>`);
    if (depth <= 1 && leafy) {
      const n = 3 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) {
        const a = (ang * 57.3) + (i - (n - 1) / 2) * 52 + (r() - 0.5) * 24, s = 0.62 + r() * 0.4;
        leaves.push(`<use href="#bl" transform="translate(${ex.toFixed(1)},${ey.toFixed(1)}) rotate(${a.toFixed(0)}) scale(${s.toFixed(2)})"/>`);
      }
    }
    if (depth <= 0) return;
    const n = depth > 3 ? 2 : r() < 0.55 ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const da = (i - (n - 1) / 2) * spread + (r() - 0.5) * 0.3;
      grow(ex, ey, ang + da, len * (0.7 + r() * 0.12), w * 0.68, depth - 1, dir, leafy, spread);
    }
  };
  grow(400, 1260, 0, 270, 17, 6, -1, true, 0.62);   // trunk and canopy
  grow(400, 1260, 0, 210, 15, 5, 1, false, 0.7);    // roots, mirroring the branches
  const halo = '<circle cx="400" cy="640" r="372" stroke-width="1.4" stroke-dasharray="2 9"/><circle cx="400" cy="640" r="318" stroke-width="1" stroke-opacity=".6"/>';
  const ground = '<path d="M70,1260 Q235,1242 400,1260 T730,1260" stroke-width="2" stroke-dasharray="1 8"/>';
  treeCache = `<svg class="tb" viewBox="-160 200 1120 1820" preserveAspectRatio="xMidYMin meet" aria-hidden="true" focusable="false"><defs><path id="bl" d="${BODHI_LEAF}"/></defs>
    <g fill="none" stroke="currentColor" stroke-linecap="round">${halo}${ground}${branches.join('')}</g><g class="tb-leaves" fill="currentColor" fill-opacity=".5">${leaves.join('')}</g></svg>`;
  return treeCache;
}

const mandala = `<g fill="none" stroke="currentColor" stroke-width="1">${Array.from({ length: 12 }, (_, i) => `<ellipse cx="60" cy="28" rx="7" ry="22" transform="rotate(${i * 30} 60 60)"/>`).join('')}<circle cx="60" cy="60" r="12"/><circle cx="60" cy="60" r="56" stroke-dasharray="1.5 5"/></g>`;
const lotus = '<g fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M60 98C40 92 26 74 24 52C40 56 52 70 60 84C68 70 80 56 96 52C94 74 80 92 60 98Z"/><path d="M60 96C48 80 46 56 60 30C74 56 72 80 60 96Z"/><path d="M60 96C40 84 30 66 34 44C46 54 56 72 60 96Z"/><path d="M60 96C80 84 90 66 86 44C74 54 64 72 60 96Z"/><path d="M20 106Q40 100 60 106T100 106"/><path d="M32 114Q46 110 60 114T88 114"/></g>';
const leaf = `<g fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"><path d="M16 104Q48 82 100 24"/>${[[34, 92, -28], [50, 80, 10], [64, 66, -40], [78, 50, 8], [90, 36, -30]].map(([x, y, a]) => `<path transform="translate(${x},${y}) rotate(${a}) scale(.62)" d="${BODHI_LEAF}"/>`).join('')}</g>`;
const moonPath = (x: number, y: number, k: number) => `M${x},${y - 9} A9,9 0 0 1 ${x},${y + 9} A${Math.abs(9 * (1 - 2 * k)).toFixed(2)},9 0 0 ${k < 0.5 ? 1 : 0} ${x},${y - 9}Z`;
const moons = `<g fill="currentColor" stroke="currentColor" stroke-width="1">${[0, 0.25, 0.5, 0.75, 1].map((k, i) => { const x = 16 + i * 22, y = 70 - 36 * Math.sin((Math.PI * i) / 4); return `<circle cx="${x}" cy="${y.toFixed(1)}" r="9" fill="none"/><path d="${moonPath(x, +y.toFixed(1), k)}" fill-opacity=".85"/>`; }).join('')}<path d="M10 92Q60 70 110 92" fill="none" stroke-dasharray="1.5 5"/></g>`;
const emblem = '<g fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"><circle cx="60" cy="60" r="54" stroke-dasharray="1.5 4"/><circle cx="60" cy="32" r="22"/><path d="M60 62V50M60 60Q50 44 38 34M60 60Q60 42 60 22M60 60Q70 44 82 34M60 62Q50 76 38 90M60 62Q60 80 60 98M60 62Q70 76 82 90M44 78Q36 84 30 82M76 78Q84 84 90 82"/><path d="M34 62H86" stroke-dasharray="1 5"/></g>';
const KINDS = [mandala, lotus, leaf, moons, emblem];
/** A decorative ornament (viewBox 120): a mandala, a lotus, a Bodhi branch, the phases of the moon or a tree-and-roots emblem. */
export const ornament = (i: number) => `<svg class="jorn" viewBox="0 0 120 120" aria-hidden="true" focusable="false">${KINDS[Math.abs(i) % KINDS.length]}</svg>`;
export const lotusIcon = (size = 22) => `<svg viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true" focusable="false">${lotus}</svg>`;

/** A divider: a line, a lotus, a line. */
export const lotusDivider = () => `<div class="lotusdiv" aria-hidden="true"><i></i>${lotusIcon(34)}<i></i></div>`;
