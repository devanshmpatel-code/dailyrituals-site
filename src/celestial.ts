// The celestial system: a small library of line-art motifs (constellation of the five moods, moon phases with tonight's real
// phase, orbit rings, an astrolabe and star-chart grid, an engraved sun, a flower-of-life fragment) and the code that places
// them on the pages. Every motif is drawn on one grid (a 120 box, centre 60, outer radius 48, twelve divisions) with one line
// weight: 1px for motifs, 0.75px for grids, held at any size with vector-effect. Colour comes from CSS (currentColor and the
// --star-* tokens), so the same drawing works on sand by day and on nocturne by night. Decoration is aria-hidden; the moon
// phase, which carries real information (tonight's sky), is labelled.
import { moonPhase } from './pages/sky';
import type { Mood } from './config';

const A = 'aria-hidden="true" focusable="false"';
const NS = 'vector-effect="non-scaling-stroke"';
const C = 60, R = 48;
const f = (n: number) => Number(n.toFixed(2));
/** A point on the grid: angle in degrees from 12 o'clock, radius from the centre. */
const pt = (deg: number, r: number): [number, number] => { const a = ((deg - 90) * Math.PI) / 180; return [f(C + r * Math.cos(a)), f(C + r * Math.sin(a))]; };
const svg = (body: string, vb = '0 0 120 120', cls = '', extra = A) => `<svg class="cel ${cls}" viewBox="${vb}" ${extra}>${body}</svg>`;
const line = (w = 1, more = '') => `fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" ${NS} ${more}`;

// ---------- the moon ----------
export const PHASE_NAMES = ['new moon', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full moon', 'waning gibbous', 'last quarter', 'waning crescent'];
/** Which of the eight drawn phases is tonight's. */
export const tonightIndex = () => Math.round(moonPhase() * 8) % 8;
export const tonightName = () => PHASE_NAMES[tonightIndex()];

/** The lit part of a moon at phase k (0 new, .25 first quarter, .5 full, .75 last quarter), as a path. Empty at new moon. */
function litPath(x: number, y: number, r: number, k: number): string {
  k = ((k % 1) + 1) % 1;
  if (k < 0.02 || k > 0.98) return '';
  if (Math.abs(k - 0.5) < 0.02) return `M${x},${f(y - r)}A${r},${r} 0 1 1 ${x},${f(y + r)}A${r},${r} 0 1 1 ${x},${f(y - r)}Z`;
  const c = Math.cos(2 * Math.PI * k), rx = f(Math.max(0.2, r * Math.abs(c)));
  const waxing = k < 0.5;
  // outer limb on the lit side, then the terminator back to the top
  return `M${x},${f(y - r)}A${r},${r} 0 0 ${waxing ? 1 : 0} ${x},${f(y + r)}A${rx},${r} 0 0 ${waxing ? (c > 0 ? 0 : 1) : (c > 0 ? 1 : 0)} ${x},${f(y - r)}Z`;
}
function moonAt(x: number, y: number, r: number, k: number, lit = 'currentColor') {
  const p = litPath(x, y, r, k);
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" opacity=".16"/><circle cx="${x}" cy="${y}" r="${r}" ${line(1)}/>${p ? `<path d="${p}" fill="${lit}" stroke="none"/>` : ''}`;
}

/** Eight phases in a row, tonight's lit at full strength and ringed, the others faint. A section divider on light pages. */
export function moonRow(): string {
  const t = tonightIndex(), r = 6, gap = 28;
  const moons = Array.from({ length: 8 }, (_, i) => {
    const x = 14 + i * gap, now = i === t;
    return `<g class="cel-mp${now ? ' now' : ''}" opacity="${now ? 1 : 0.42}">${now ? `<circle cx="${x}" cy="12" r="${r + 4}" ${line(1)} opacity=".55"/>` : ''}${moonAt(x, 12, r, i / 8)}</g>`;
  }).join('');
  return `<svg class="cel cel-moonrow" viewBox="0 0 224 24" role="img" aria-label="Tonight's moon: ${PHASE_NAMES[t]}">${moons}</svg>`;
}

/** A small moon glyph in tonight's phase (for eyebrows, the footer and the cart). */
export function moonGlyph(size = 18, labelled = true): string {
  const t = tonightIndex();
  return `<svg class="cel cel-glyph" viewBox="0 0 120 120" width="${size}" height="${size}" ${labelled ? `role="img" aria-label="Tonight's moon: ${PHASE_NAMES[t]}"` : A}>${moonAt(C, C, 44, t / 8)}</svg>`;
}

/** The engraved moon: outline, hatched shadow side, moonstone light. Replaces the static canvas moon. */
export function moonLarge(): string {
  const k = moonPhase(), r = 40;
  const hatch = Array.from({ length: 27 }, (_, i) => { const d = -40 + i * 3; return `<path d="M${f(C + d - 44)},${f(C + 44)}L${f(C + d + 44)},${f(C - 44)}"/>`; }).join('');
  return `<defs><clipPath id="celMoonClip"><circle cx="${C}" cy="${C}" r="${r}"/></clipPath></defs>
    <circle cx="${C}" cy="${C}" r="${r}" fill="currentColor" opacity=".1"/><g clip-path="url(#celMoonClip)" ${line(0.75)} opacity=".5">${hatch}</g>
    <path d="${litPath(C, C, r, k)}" fill="var(--moonstone, #EDE6DA)" stroke="none"/>
    <circle cx="${C}" cy="${C}" r="${r}" ${line(1)}/>
    <circle cx="${C}" cy="${C}" r="${r + 7}" ${line(0.75, 'stroke-dasharray="1 5"')} opacity=".5"/>`;
}

// ---------- the constellation of five moods ----------
const STARS: Record<Mood, [number, number]> = { fresh: [-38, 42], sunny: [22, 24], floral: [96, 44], woody: [172, 32], grounding: [244, 44] };
const LINKS: [Mood, Mood][] = [['grounding', 'woody'], ['woody', 'sunny'], ['sunny', 'fresh'], ['sunny', 'floral']];
const FAINT: [number, number][] = [[-100, 30], [132, 18], [296, 16], [60, 47]];
/** Five stars, one per mood, joined by hairlines; a few fainter stars for depth. With labels, the mood names sit beside them. */
export function constellation(opts: { labels?: boolean; cls?: string } = {}): string {
  const P = Object.fromEntries((Object.keys(STARS) as Mood[]).map(m => [m, pt(...STARS[m])])) as Record<Mood, [number, number]>;
  const links = LINKS.map(([a, b], i) => `<path class="cel-link" style="--i:${i}" d="M${P[a][0]},${P[a][1]}L${P[b][0]},${P[b][1]}" pathLength="100"/>`).join('');
  const faint = FAINT.map(([d, r]) => { const [x, y] = pt(d, r); return `<circle cx="${x}" cy="${y}" r="1" fill="currentColor" opacity=".55"/>`; }).join('');
  const stars = (Object.keys(STARS) as Mood[]).map((m, i) => {
    const [x, y] = P[m];
    const lab = opts.labels ? `<text x="${x + (x > C ? 9 : -9)}" y="${y + 3.5}" text-anchor="${x > C ? 'start' : 'end'}" class="cel-lab">${m[0].toUpperCase() + m.slice(1)}</text>` : '';
    return `<g class="cel-star" data-mood="${m}" style="--c:var(--star-${m});--i:${i}"><circle class="cel-halo" cx="${x}" cy="${y}" r="6" fill="var(--c)"/><circle class="cel-pt" cx="${x}" cy="${y}" r="2.2" fill="currentColor"/>${lab}</g>`;
  }).join('');
  return svg(`<g class="cel-links" ${line(1)}>${links}</g>${faint}${stars}`, opts.labels ? '-28 0 176 120' : '0 0 120 120', `cel-const ${opts.cls ?? ''}`);
}

// ---------- orbits ----------
/** Two or three concentric orbits, tilted, each carrying one small body. */
export function orbitRings(n = 3): string {
  const tilts = [-24, 22, 90], rys = [16, 30, 20];
  const rings = Array.from({ length: n }, (_, i) => `<g class="cel-ring" style="--i:${i}" transform="rotate(${tilts[i]} ${C} ${C})"><ellipse cx="${C}" cy="${C}" rx="${R}" ry="${rys[i]}" ${line(1)}/><circle cx="${C + R}" cy="${C}" r="2" fill="currentColor"/></g>`).join('');
  return svg(`${rings}<circle cx="${C}" cy="${C}" r="3" fill="currentColor"/>`, '0 0 120 120', 'cel-orbits');
}
/** Orbits that frame a portrait: sized to spill a little beyond the picture, turning very slowly. */
export function portraitOrbits(): string {
  return svg(`<g class="cel-spin"><g transform="rotate(-20 ${C} ${C})"><ellipse cx="${C}" cy="${C}" rx="59" ry="24" ${line(1)}/><circle cx="${C + 59}" cy="${C}" r="2" fill="currentColor"/></g><g transform="rotate(34 ${C} ${C})"><ellipse cx="${C}" cy="${C}" rx="56" ry="42" ${line(1)}/><circle cx="${C - 56}" cy="${C}" r="2" fill="currentColor"/></g><circle cx="${C}" cy="${C}" r="54" ${line(0.75, 'stroke-dasharray="1 5"')}/></g>`, '0 0 120 120', 'cel-orbits cel-portrait-orbits');
}

// ---------- the astrolabe and the star chart ----------
/** Rete of an astrolabe: concentric rings, twelve radials, degree ticks, a tilted ecliptic. Grid weight (0.75px). */
export function astrolabe(): string {
  const rings = [R, 40, 28, 16].map(r => `<circle cx="${C}" cy="${C}" r="${r}"/>`).join('');
  const radials = Array.from({ length: 12 }, (_, i) => { const [x1, y1] = pt(i * 30, 16), [x2, y2] = pt(i * 30, R); return `<path d="M${x1},${y1}L${x2},${y2}"/>`; }).join('');
  const ticks = Array.from({ length: 36 }, (_, i) => { const long = i % 3 === 0; const [x1, y1] = pt(i * 10, long ? 43 : 45.5), [x2, y2] = pt(i * 10, R); return `<path d="M${x1},${y1}L${x2},${y2}"/>`; }).join('');
  return svg(`<g class="cel-spin-slow" ${line(0.75)}>${rings}${radials}${ticks}<ellipse cx="${C}" cy="${C}" rx="${R}" ry="20" transform="rotate(-23 ${C} ${C})"/></g><circle cx="${C}" cy="${C}" r="1.6" fill="currentColor"/>`, '0 0 120 120', 'cel-astrolabe');
}

// ---------- the sun and the flower ----------
/** An engraved sun: a disc with short radiating ticks and a little hatching low on the disc. No face. */
export function sunGlyph(size?: number): string {
  const ticks = Array.from({ length: 24 }, (_, i) => { const long = i % 2 === 0; const [x1, y1] = pt(i * 15, 20), [x2, y2] = pt(i * 15, long ? 30 : 26); return `<path d="M${x1},${y1}L${x2},${y2}"/>`; }).join('');
  const hatch = [6, 9, 12].map(d => { const w = Math.sqrt(14 * 14 - d * d); return `<path d="M${f(C - w)},${C + d}L${f(C + w)},${C + d}"/>`; }).join('');
  return svg(`<g ${line(1)}><circle cx="${C}" cy="${C}" r="14"/>${ticks}${hatch}</g>`, '0 0 120 120', 'cel-sun', size ? `width="${size}" height="${size}" ${A}` : A);
}
/** Seven circles of the flower of life: never the whole pattern. */
export function flowerOfLife(): string {
  const r = 24;
  const petals = Array.from({ length: 6 }, (_, i) => { const [x, y] = pt(i * 60, r); return `<circle cx="${x}" cy="${y}" r="${r}"/>`; }).join('');
  return svg(`<g ${line(1)}><circle cx="${C}" cy="${C}" r="${r}"/>${petals}</g>`, '0 0 120 120', 'cel-flower');
}

// ---------- small eyebrow glyphs ----------
export type Glyph = 'sun' | 'moon' | 'orbit' | 'star' | 'flower' | 'constellation';
export function glyph(kind: Glyph, size = 18): string {
  const g = (body: string) => `<svg class="cel cel-glyph" viewBox="0 0 120 120" width="${size}" height="${size}" ${A}>${body}</svg>`;
  switch (kind) {
    case 'sun': return g(`<g ${line(5)}><circle cx="${C}" cy="${C}" r="20"/>${Array.from({ length: 8 }, (_, i) => { const [x1, y1] = pt(i * 45, 32), [x2, y2] = pt(i * 45, 44); return `<path d="M${x1},${y1}L${x2},${y2}"/>`; }).join('')}</g>`);
    case 'moon': return moonGlyph(size, false);
    case 'orbit': return g(`<circle cx="${C}" cy="${C}" r="9" fill="currentColor"/><ellipse cx="${C}" cy="${C}" rx="46" ry="18" transform="rotate(-24 ${C} ${C})" ${line(5)}/><circle cx="${f(C + 46 * Math.cos(-24 * Math.PI / 180))}" cy="${f(C + 46 * Math.sin(-24 * Math.PI / 180))}" r="6" fill="currentColor"/>`);
    case 'flower': return g(`<g ${line(5)}><circle cx="46" cy="52" r="26"/><circle cx="74" cy="52" r="26"/><circle cx="60" cy="76" r="26"/></g>`);
    case 'constellation': return g(`<g ${line(5)}><path d="M18,88L50,40L84,62L106,30"/></g><circle cx="18" cy="88" r="7" fill="currentColor"/><circle cx="50" cy="40" r="7" fill="currentColor"/><circle cx="84" cy="62" r="7" fill="currentColor"/><circle cx="106" cy="30" r="7" fill="currentColor"/>`);
    default: return g(`<g ${line(5)}><path d="M${C},14V48M${C},72V106M14,${C}H48M72,${C}H106"/></g><circle cx="${C}" cy="${C}" r="7" fill="currentColor"/>`);
  }
}

// ---------- placing the motifs ----------
const KINDS: Record<string, () => string> = {
  moonrow: moonRow, 'moon-glyph': () => moonGlyph(18), constellation: () => constellation(), 'constellation-labels': () => constellation({ labels: true }),
  orbits: () => orbitRings(), 'portrait-orbits': portraitOrbits, astrolabe, sun: () => sunGlyph(), flower: flowerOfLife,
};
/** Fill every `[data-cel="kind"]` placeholder inside root with its motif. */
export function hydrate(root: ParentNode) {
  root.querySelectorAll<HTMLElement>('[data-cel]:not([data-cel-done])').forEach(el => {
    const make = KINDS[el.dataset.cel ?? ''];
    if (!make) return;
    el.innerHTML = make(); el.dataset.celDone = '1';
  });
}

const HOME_GLYPHS: Record<string, Glyph> = { 1: 'sun', 2: 'flower', 3: 'star', 4: 'orbit', 5: 'sun', 6: 'orbit', 7: 'constellation', 8: 'moon' };
function pickGlyph(text: string): Glyph {
  const t = text.toLowerCase();
  const n = t.match(/chapter (\d)/)?.[1];
  if (n && HOME_GLYPHS[n]) return HOME_GLYPHS[n];
  if (/moon|drop|night|wind down|light it|archive|coming soon/.test(t)) return 'moon';
  if (/coach|practi|repeat|habit|expect|begin|check-in|refill|run out|subscription|days|while you wait/.test(t)) return 'orbit';
  if (/sun|morning|first light|wear|gift|share|feeling|sunrise|arrives/.test(t)) return 'sun';
  if (/discover|try|story|began|craft|batch|meet|intention|questions|contact|shipping/.test(t)) return 'flower';
  return 'star';
}
// Section-level eyebrows only: the small labels inside product notes and cards stay plain.
const EYEBROWS = ['.head .col > .eyebrow:first-child', '.head .col > .chapter', '.disc .tx > .chapter', '.cf-tx > .chapter', '.drop-grid .chapter', '.drop-grid .chapter + h1 ~ *', '.claire .tx > .eyebrow',
  '.c-hero .eyebrow', '.split > div > .eyebrow:first-child', '.bk-intro > .eyebrow', '.clubsoon .eyebrow', '.st-path > .eyebrow', '.ghead > .eyebrow', '.missing > .eyebrow',
  '.panel > .eyebrow:first-child', '.news > div > .eyebrow:first-child', '.check-in > div > .eyebrow:first-child', '.rep-grid .chapter', '.gift-grid .chapter', '.vote > .eyebrow', '.calc > .eyebrow',
  '.moonrow .eyebrow', '.cs-tx .eyebrow', '.acct-panel > .eyebrow', '.bk-aside > .eyebrow', '.help-contact > .eyebrow', '.night section > .eyebrow'].join(',');
function glyphEyebrows(root: ParentNode) {
  root.querySelectorAll<HTMLElement>(EYEBROWS).forEach(el => {
    if (el.classList.contains('has-glyph') || !el.textContent?.trim()) return;
    if (!(el.classList.contains('eyebrow') || el.classList.contains('chapter'))) return;
    el.classList.add('has-glyph');
    el.insertAdjacentHTML('afterbegin', glyph(pickGlyph(el.textContent ?? '')));
  });
}

const LIGHT = new Set(['sand', 'sage', 'gold', 'rose', 'euc']); // the seam above each of these is light (the euc chapter opens on rose)
/** The home chapters below the opening: on the seam into each chapter, a moon-phase row where the seam is light, a gold hairline with a moonstone point where it is dark. */
function homeDividers(app: HTMLElement) {
  app.querySelectorAll<HTMLElement>('section.df').forEach(sec => {
    if (sec.querySelector(':scope > .cel-div')) return;
    const g = sec.dataset.ground ?? '';
    const light = LIGHT.has(g);
    const div = document.createElement('div');
    div.className = `cel-div ${light ? 'light' : 'dark'} g-${g}`;
    div.setAttribute('aria-hidden', 'true');
    div.innerHTML = light ? `<i></i>${moonRow().replace(/role="img" aria-label="[^"]*"/, 'aria-hidden="true"')}<i></i>` : '<i></i><b class="cel-rulept"></b><i></i>';
    sec.prepend(div);
  });
}

/** Tonight's real phase replaces the moon the canvas exported (which was fixed at one date). */
function liveMoons(root: ParentNode) {
  root.querySelectorAll<SVGSVGElement>('.moon svg[aria-label^="Current moon phase"]').forEach(s => {
    s.setAttribute('viewBox', '0 0 120 120'); s.innerHTML = moonLarge(); s.setAttribute('role', 'img');
    s.setAttribute('aria-label', `Current moon phase: ${tonightName()}`); s.classList.add('cel', 'cel-moon-large');
  });
}

/** Apply the celestial layer to a freshly rendered page. */
export function celestialPage(app: HTMLElement, seg: string) {
  hydrate(app);
  liveMoons(app);
  glyphEyebrows(app);
  if (seg === '') homeDividers(app);
  const missing = app.querySelector<HTMLElement>('.missing');
  if (missing && !missing.querySelector('.cel-wm')) {
    missing.insertAdjacentHTML('afterbegin', `<span class="cel-wm cel-wm-404" aria-hidden="true">${flowerOfLife()}</span>`);
    const mark = missing.querySelector('.mark'); if (mark) mark.innerHTML = astrolabe();
  }
}

/** The chrome that is rendered once: footer and cart drawer. */
export function celestialChrome(root: ParentNode) { hydrate(root); }

/** The free-shipping progress as an orbit arc that fills clockwise; the words beside it carry the meaning. */
export function shipArc(pct: number): string {
  const p = Math.max(0, Math.min(100, pct)), full = p >= 100;
  return `<svg class="cel ship-arc${full ? ' full' : ''}" viewBox="0 0 40 40" ${A}><circle class="t" cx="20" cy="20" r="15" ${line(1)}/><circle class="p" cx="20" cy="20" r="15" pathLength="100" style="--p:${f(p)}" ${line(1.5)}/><circle class="s" cx="20" cy="5" r="2"/></svg>`;
}

/** The orbit ring that draws itself around a product picture on hover, with the mood's star at its top. */
export function cardOrbit(): string {
  return `<svg class="cel cel-orbit" viewBox="0 0 100 125" ${A}><rect class="cel-dim" width="100" height="125"/><g transform="rotate(-18 50 62.5)"><ellipse cx="50" cy="62.5" rx="41" ry="52" pathLength="100" ${NS}/><circle class="cel-halo" cx="50" cy="10.5" r="7"/><circle class="cel-pt" cx="50" cy="10.5" r="2.4"/></g></svg>`;
}
/** The loading placeholder: a sand block with an orbit that pulses gently. */
export function skeletonOrbit(): string {
  return `<svg class="cel cel-skorb" viewBox="0 0 100 125" ${A}><g transform="rotate(-18 50 62.5)"><ellipse cx="50" cy="62.5" rx="41" ry="52" ${line(1)}/><circle cx="50" cy="10.5" r="2" fill="currentColor"/></g></svg>`;
}
