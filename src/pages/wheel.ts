import { MOODS, MOMENTS, FORMAT_LABEL, type Mood, type Moment, type Format } from '../config';
import { money, findLive, type Item } from '../wix';
import { esc, toast } from '../ui';
import { add } from '../cart';
import { moonPhase } from './sky';
import '../wheel.css';

// The scent atlas. A nocturne star-chart plate: each mood is a constellation, each scent of that mood is a star,
// joined by gold hairlines that draw themselves. Choosing a constellation turns the whole sky so it comes to rest
// under the index at the top of the chart ("into alignment") and leans in a little; its stars grow into named,
// tappable points. Choosing a star shows that scent's formats and prices in the panel beside the plate. Tonight's
// real moon phase is drawn in the corner (computed, no meaning attached). The plate is drawn once and transformed
// in place, so every change animates; the twinkle and the slow outer ring only run while the plate is on screen.
//
// Design mapping (draft for Claire): the five constellations sit evenly around the pole, cool to warm to earth:
// fresh at the top, then sunny, floral, woody and grounding clockwise. Their shapes are a layout choice, not a claim
// about any scent. Mood colour is used only on the star points and their halos, never as a fill.
const CX = 300, CY = 300, R = 262, RC = 128, RF = 128;
const ANGLE: Record<Mood, number> = { fresh: -90, sunny: -18, floral: 54, woody: 126, grounding: 198 };
/** star variants of the mood swatches: the same hues, lifted so a point still reads on nocturne */
const STAR: Record<Mood, string> = { fresh: '#A3C8C0', sunny: '#ECB76A', floral: '#CF8A7D', woody: '#C09571', grounding: '#8EAA86' };
/** One word per mood for the atlas labels; each word is already in the mood's label. */
const SHORT: Record<Mood, string> = { fresh: 'Fresh', sunny: 'Sunny', floral: 'Floral', woody: 'Woody', grounding: 'Grounding' };
/** draft for Claire: how the "Guide me" path names each format */
const VERB: Record<Format, string> = { diffuser: 'Diffuse it', roller: 'Wear it', candle: 'Light it', deodorant: 'Wear it' };
const PHASES = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];

type Pt = [number, number, 'a' | 'b']; // offset from the constellation's centre, and which side the star's name sits
/** asterisms for 1 to 5 stars, drawn upright (as they appear when the constellation is at the top of the chart) */
const SHAPES: Pt[][] = [
  [[0, 0, 'b']],
  [[-46, 14, 'b'], [46, -14, 'a']],
  [[-70, 12, 'b'], [-2, -26, 'a'], [70, 16, 'b']],
  [[-78, 8, 'b'], [-20, -30, 'a'], [34, 22, 'b'], [84, -16, 'a']],
  [[-88, 10, 'b'], [-44, -28, 'a'], [0, 14, 'b'], [44, -30, 'a'], [88, 8, 'b']],
];
const rad = (d: number) => (d * Math.PI) / 180;
const f1 = (n: number) => n.toFixed(1);
const shape = (n: number): Pt[] => SHAPES[n - 1] ?? Array.from({ length: n }, (_, i) => { const d = rad(-90 + (360 * i) / n); return [60 * Math.cos(d), 60 * Math.sin(d), Math.sin(d) < 0 ? 'a' : 'b'] as Pt; });
const centre = (m: Mood) => [CX + RC * Math.cos(rad(ANGLE[m])), CY + RC * Math.sin(rad(ANGLE[m]))] as const;
/** the asterism is turned to face the pole, so it stands upright once the sky brings it to the top */
const starAt = (m: Mood, k: number, n: number) => { const [cx, cy] = centre(m), [ox, oy] = shape(n)[k], t = rad(ANGLE[m] + 90); return [cx + ox * Math.cos(t) - oy * Math.sin(t), cy + ox * Math.sin(t) + oy * Math.cos(t)] as const; };
/** a small deterministic random stream, so the background sky is the same on every visit */
const prng = (seed: number) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isNarrow = () => window.matchMedia('(max-width: 820px)').matches;

/** tonight's moon, outline only, lit portion filled: 0 = new, .5 = full; waxing lights the right side */
function moonSVG(p: number, r: number) {
  const k = Math.cos(2 * Math.PI * p), waxing = p < .5, rx = Math.max(.01, Math.abs(k) * r);
  const d = waxing ? `M0 ${-r}A${r} ${r} 0 0 1 0 ${r}A${rx} ${r} 0 0 ${k > 0 ? 0 : 1} 0 ${-r}Z` : `M0 ${-r}A${r} ${r} 0 0 0 0 ${r}A${rx} ${r} 0 0 ${k > 0 ? 1 : 0} 0 ${-r}Z`;
  return `<circle class="wmoon-o" r="${r}"/><path class="wmoon-l" d="${d}"/>`;
}
export const phaseName = (p: number) => PHASES[Math.round(p * 8) % 8];

let teardown: (() => void) | null = null;

export function mountWheel(el: HTMLElement, items: Item[], initialMood: Mood | null = null) {
  teardown?.();
  const byMood = new Map<Mood, Map<string, Item[]>>();
  items.forEach(i => { if (!i.mood) return; const m = byMood.get(i.mood) ?? new Map(); m.set(i.scent, [...(m.get(i.scent) ?? []), i]); byMood.set(i.mood, m); });
  const moods = (Object.keys(MOODS) as Mood[]).filter(m => byMood.has(m)).sort((a, b) => ANGLE[a] - ANGLE[b]);
  const scentsOf = (m: Mood) => [...(byMood.get(m)?.keys() ?? [])].sort();
  const formatsOf = (m: Mood) => [...new Set(items.filter(i => i.mood === m).map(i => i.format))].sort();
  let selMood: Mood | null = initialMood && byMood.has(initialMood) ? initialMood : null, selScent: string | null = null;
  let guide = 0, gMoment: Moment | null = null, fmtFilter: Format | null = null;
  const phase = moonPhase();

  // ---- the plate, drawn once (and again if the viewport crosses the phone breakpoint) ----
  let portrait = isNarrow();
  const build = () => {
    const top = portrait ? -44 : 0, h = portrait ? 688 : 600, bandT = portrait ? -14 : 36, bandB = portrait ? 626 : 582;
    const rnd = prng(7);
    // the fixed plate: frame, star-chart grid, degree marks, the ecliptic as an ornament, the pole
    const ticks = Array.from({ length: 36 }, (_, i) => { const a = rad(i * 10), l = i % 3 ? 6 : 12; return `<line x1="${f1(CX + R * Math.cos(a))}" y1="${f1(CY + R * Math.sin(a))}" x2="${f1(CX + (R - l) * Math.cos(a))}" y2="${f1(CY + (R - l) * Math.sin(a))}"/>`; }).join('');
    // degree numerals sit on the limb between the chart and the outer ring; 0 is left out, the index points there
    const nums = Array.from({ length: 11 }, (_, i) => { const a = rad((i + 1) * 30 - 90); return `<text class="wnum" x="${f1(CX + 268 * Math.cos(a))}" y="${f1(CY + 268 * Math.sin(a))}" text-anchor="middle" dominant-baseline="middle">${(i + 1) * 30}</text>`; }).join('');
    const spokes = Array.from({ length: 12 }, (_, i) => { const a = rad(i * 30); return `<line x1="${f1(CX + 24 * Math.cos(a))}" y1="${f1(CY + 24 * Math.sin(a))}" x2="${f1(CX + (R - 14) * Math.cos(a))}" y2="${f1(CY + (R - 14) * Math.sin(a))}"/>`; }).join('');
    const ring = Array.from({ length: 72 }, (_, i) => { const a = rad(i * 5), l = i % 3 ? 3 : 6; return `<line x1="${f1(CX + 274 * Math.cos(a))}" y1="${f1(CY + 274 * Math.sin(a))}" x2="${f1(CX + (274 + l) * Math.cos(a))}" y2="${f1(CY + (274 + l) * Math.sin(a))}"/>`; }).join('');
    const pole = Array.from({ length: 8 }, (_, i) => { const a = rad(i * 45), l = i % 2 ? 4 : 7; return `<line x1="${f1(CX + 2 * Math.cos(a))}" y1="${f1(CY + 2 * Math.sin(a))}" x2="${f1(CX + l * Math.cos(a))}" y2="${f1(CY + l * Math.sin(a))}"/>`; }).join('');
    // the heavens: a field of faint stars (a few with a sparkle). Those inside the chart turn with the sky; those
    // outside it, on the plate, stay still. Then the five constellations.
    const field: string[] = [], still: string[] = [];
    for (let i = 0; i < 260; i++) {
      const x = 14 + rnd() * 572, y = top + 14 + rnd() * (h - 28), inside = Math.hypot(x - CX, y - CY) < R;
      const r = .5 + rnd() * 1.1, o = (inside ? .3 : .18) + rnd() * (inside ? .6 : .4), spk = inside && r > 1.45 && rnd() < .5;
      (inside ? field : still).push(`<circle class="wtw" cx="${f1(x)}" cy="${f1(y)}" r="${f1(r)}" style="--o:${o.toFixed(2)};--d:-${(rnd() * 6).toFixed(1)}s;--t:${(3 + rnd() * 3).toFixed(1)}s"/>${spk ? `<path class="wspk" d="M${f1(x - 5)} ${f1(y)}H${f1(x + 5)}M${f1(x)} ${f1(y - 5)}V${f1(y + 5)}"/>` : ''}`);
    }
    const cons = moods.map(m => {
      const scents = scentsOf(m), n = scents.length, [cx, cy] = centre(m), pts = scents.map((_, k) => starAt(m, k, n));
      const path = n > 1 ? `<path class="wlines" pathLength="1" d="M${pts.map(([x, y]) => `${f1(x)} ${f1(y)}`).join('L')}${n > 5 ? 'Z' : ''}"/>` : '';
      // the region label sits outward of its constellation; at the sides it tucks in a little to clear the rim
      const lo = 84 - 14 * Math.abs(Math.cos(rad(ANGLE[m]))), lx = cx + lo * Math.cos(rad(ANGLE[m])), ly = cy + lo * Math.sin(rad(ANGLE[m]));
      // a star's name sits above or below it; names of the outer stars lean outwards so neighbours never touch
      const stars = scents.map((s, k) => { const [x, y] = pts[k], [ox, , side] = shape(n)[k], dx = Math.max(-16, Math.min(16, ox * .18)); return `<g class="wstar" data-scent="${esc(s)}" data-mood="${m}" role="button" tabindex="-1" aria-hidden="true" aria-pressed="false" aria-label="${esc(s)}, ${esc(MOODS[m].label)}" transform="translate(${f1(x)} ${f1(y)})">
          <circle class="wshit" r="28"/><circle class="whalo" r="8"/><circle class="wcore" r="3"/><circle class="wsel" r="13"/><circle class="wsfoc" r="18"/>
          <g class="wup" data-x="0" data-y="0"><text class="wname" x="${f1(dx)}" y="${side === 'a' ? -20 : 32}" text-anchor="middle">${esc(s)}</text></g></g>`; }).join('');
      return `<g class="wcon" data-mood="${m}" role="group" aria-label="${esc(MOODS[m].label)} constellation" style="--sw:${STAR[m]}">
        <g class="wcon-btn" data-mood="${m}" role="button" tabindex="0" aria-pressed="false" aria-label="${esc(MOODS[m].label)}, ${n} scent${n === 1 ? '' : 's'}">
          <circle class="whit" cx="${f1(cx)}" cy="${f1(cy)}" r="74"/><circle class="wfoc" cx="${f1(cx)}" cy="${f1(cy)}" r="80"/>${path}
          <g class="wup" data-x="${f1(lx)}" data-y="${f1(ly)}"><text class="wreg" text-anchor="middle" dominant-baseline="middle">${SHORT[m].toUpperCase()}</text></g></g>${stars}</g>`;
    }).join('');
    const all = items.filter(i => i.mood), nScents = new Set(all.map(i => i.scent)).size;
    // draft for Claire: the plate's corner captions. The moon phase is tonight's, computed; no meaning is attached to it.
    el.innerHTML = `<div class="wheelwrap watlas"><div class="wheel wplate${portrait ? ' portrait' : ''}">
      <svg class="wsvg" viewBox="0 ${top} 600 ${h}" role="group" aria-label="Scent atlas: five constellations, one for each mood; each star is a scent">
        <defs><clipPath id="wclip"><circle cx="${CX}" cy="${CY}" r="${R - 1}"/></clipPath>
          <radialGradient id="wdome" cx=".5" cy=".3" r=".75"><stop offset="0" stop-color="#2A3358" stop-opacity=".9"/><stop offset="1" stop-color="#2A3358" stop-opacity="0"/></radialGradient>
          <filter id="wglow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3"/></filter>
          <filter id="wsoft" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>
        <g class="wfixed" aria-hidden="true">
          <rect class="wframe" x="10" y="${top + 10}" width="580" height="${h - 20}" rx="4"/>${still.join('')}
          <circle cx="${CX}" cy="${CY}" r="${R}" fill="url(#wdome)"/>
          <g class="wg3">${spokes}</g><circle class="wg2" cx="${CX}" cy="${CY}" r="88"/><circle class="wg2" cx="${CX}" cy="${CY}" r="175"/>
          <ellipse class="wecl" cx="${CX}" cy="${CY}" rx="236" ry="118" transform="rotate(-24 ${CX} ${CY})"/>
          <circle class="wg1" cx="${CX}" cy="${CY}" r="${R}"/><g class="wtick">${ticks}</g>${nums}
          <g class="wpole">${pole}<circle cx="${CX}" cy="${CY}" r="1.6"/></g>
          <g class="wouter"><circle class="wg2" cx="${CX}" cy="${CY}" r="281"/><g class="wtick">${ring}</g></g>
          <text class="wcap" x="22" y="${bandT}">The scent atlas</text><text class="wcap dim" x="22" y="${bandT + 16}">Plate I · ${moods.length} moods</text>
          <g class="wmoon" transform="translate(560 ${bandT + 6})">${moonSVG(phase, 14)}</g>
          <text class="wcap" x="534" y="${bandT - 4}" text-anchor="end">Tonight</text><text class="wcap dim" x="534" y="${bandT + 12}" text-anchor="end">${esc(phaseName(phase))}</text>
          <text class="wcap dim" x="22" y="${bandB}">${nScents} scents · ${moods.length} constellations</text><text class="wcap dim" x="578" y="${bandB}" text-anchor="end">✦ one star, one scent</text>
        </g>
        <g clip-path="url(#wclip)"><g class="wsky">${field.join('')}${cons}</g></g>
        <path class="windex" d="M300 40 L294.5 30 H305.5 Z" aria-hidden="true"/>
      </svg></div><div class="wpanel" aria-live="polite"></div></div>`;
  };
  build();
  let svg!: SVGSVGElement, plate!: HTMLElement, panelEl!: HTMLElement, sky!: SVGGElement, conEls: SVGGElement[] = [], btnEls: SVGGElement[] = [], starEls: SVGGElement[] = [], ups: SVGGElement[] = [];
  const grab = () => {
    svg = el.querySelector<SVGSVGElement>('svg')!; plate = el.querySelector<HTMLElement>('.wplate')!; panelEl = el.querySelector<HTMLElement>('.wpanel')!; sky = svg.querySelector<SVGGElement>('.wsky')!;
    conEls = [...svg.querySelectorAll<SVGGElement>('.wcon')]; btnEls = [...svg.querySelectorAll<SVGGElement>('.wcon-btn')]; starEls = [...svg.querySelectorAll<SVGGElement>('.wstar')]; ups = [...svg.querySelectorAll<SVGGElement>('.wup')];
  };
  grab();

  // ---- turning the sky ----
  type Pose = { rot: number; s: number; dy: number };
  let cur: Pose = { rot: 0, s: 1, dy: 0 }, raf = 0;
  const setPose = (p: Pose) => {
    cur = p;
    sky.setAttribute('transform', `translate(${CX} ${f1(CY + p.dy)}) scale(${p.s.toFixed(3)}) rotate(${p.rot.toFixed(2)}) translate(${-CX} ${-CY})`);
    const back = `rotate(${(-p.rot).toFixed(2)})`;
    ups.forEach(u => u.setAttribute('transform', `translate(${u.dataset.x} ${u.dataset.y}) ${back}`));
  };
  // the shortest way round to the wanted angle
  const near = (to: number, from: number) => { let d = ((to - from) % 360 + 540) % 360 - 180; return from + d; };
  const target = (): Pose => {
    if (!selMood) return { rot: near(0, cur.rot), s: 1, dy: 0 };
    // on a phone the sky also leans in a little, so the names of the chosen stars read at thumb distance
    const s = portrait ? 1.18 : 1; return { rot: near(-90 - ANGLE[selMood], cur.rot), s, dy: s * RC - RF };
  };
  const align = (animate: boolean) => {
    cancelAnimationFrame(raf); const from = { ...cur }, to = target();
    if (!animate || reduceMotion() || (from.rot === to.rot && from.s === to.s && from.dy === to.dy)) { setPose(to); plate.classList.remove('moving'); return; }
    plate.classList.add('moving'); const t0 = performance.now(), dur = 950;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      setPose({ rot: from.rot + (to.rot - from.rot) * e, s: from.s + (to.s - from.s) * e, dy: from.dy + (to.dy - from.dy) * e });
      if (k < 1) raf = requestAnimationFrame(step); else plate.classList.remove('moving');
    };
    raf = requestAnimationFrame(step);
  };

  const apply = (animate = true) => {
    plate.classList.toggle('picked', !!selMood);
    conEls.forEach(g => {
      const m = g.dataset.mood as Mood, on = m === selMood; g.classList.toggle('on', on);
      g.querySelector<SVGGElement>('.wcon-btn')!.setAttribute('aria-pressed', String(on));
    });
    starEls.forEach(st => {
      const open = st.dataset.mood === selMood, sel = open && st.dataset.scent === selScent;
      st.classList.toggle('open', open); st.classList.toggle('sel', sel);
      st.setAttribute('tabindex', open ? '0' : '-1'); st.setAttribute('aria-hidden', String(!open)); st.setAttribute('aria-pressed', String(sel));
    });
    align(animate); panelEl.innerHTML = panel(); wirePanel();
  };

  // ---- the panel: how to buy ----
  const momentOf = (m: Mood) => MOMENTS.find(mo => mo.mood === m)!;
  const pairOf = (mo: Moment) => [findLive(items, mo.pair.diffuser, 'diffuser'), findLive(items, mo.pair.roller, 'roller')].filter(Boolean) as Item[];
  const price = (i: Item) => (i.priceMin === i.priceMax ? money(i.priceMin) : `from ${money(i.priceMin)}`);
  const fmtWord = (f: Format) => FORMAT_LABEL[f].replace(/^(Mini|Fragrance) /, '').toLowerCase();
  // the ready-made pair for a mood: the home page's ritual for that moment when its diffuser is of this mood,
  // otherwise a diffuser and a roller of this mood's own scents (some moment pairings cross moods, e.g. Night is
  // floral but its ritual is Campfire Stories + Inner Sanctum, which would read wrong under "Soft and floral")
  const ritualFor = (m: Mood): { name: string; items: Item[] } | null => {
    const mo = momentOf(m), ps = mo ? pairOf(mo) : [];
    if (ps.length === 2 && ps[0].mood === m) return { name: `The ${mo.name.toLowerCase()} ritual`, items: ps };
    const own = items.filter(i => i.mood === m).sort((a, b) => a.scent.localeCompare(b.scent));
    const d = own.find(i => i.format === 'diffuser');
    const r = own.find(i => i.format === 'roller' && i.scent !== d?.scent) ?? own.find(i => i.format === 'roller');
    // draft for Claire: the name of a pair that is not one of the home page rituals
    return d && r ? { name: `A ${SHORT[m].toLowerCase()} pair`, items: [d, r] } : null;
  };
  const ritual = (m: Mood) => {
    const rt = ritualFor(m); if (!rt) return '';
    return `<div class="writ"><div class="writ-th" aria-hidden="true">${rt.items.map(p => `<img src="${p.thumb}" alt="" loading="lazy">`).join('')}</div>
      <div class="writ-tx"><span class="eyebrow">${esc(rt.name)}</span><b>${rt.items.map(p => `${esc(p.scent)} ${esc(fmtWord(p.format))}`).join(' + ')}</b></div>
      <button class="btn" data-addpair="${m}">Add both · ${money(rt.items.reduce((n, i) => n + i.priceMin, 0))}</button></div>`;
  };
  const dot = (m: Mood) => `<span class="swatch" style="background:${MOODS[m].swatch}"></span>`;
  const panel = () => {
    // draft for Claire: all customer-facing copy in this panel. Counts, formats and prices are read from the live catalogue.
    if (guide === 1) {
      const opts = MOMENTS.filter(mo => byMood.has(mo.mood));
      return `<span class="eyebrow">Guide me · 1 of 2</span><h3>When will you <span class="it">reach for it?</span></h3>
        <div class="wguide">${opts.map(mo => `<button class="chip" data-gmoment="${mo.key}"><b>${esc(mo.name)}</b><span class="muted">${esc(mo.title)}</span></button>`).join('')}</div>
        <div class="cta"><button class="btn line" data-gback="0">Back to the sky</button></div>`;
    }
    if (guide === 2 && gMoment) {
      const m = gMoment.mood, fmts = formatsOf(m);
      return `<span class="eyebrow">Guide me · 2 of 2</span><h3>Diffuse it, wear it <span class="it">or light it?</span></h3>
        <p class="muted">${esc(gMoment.name)} points to ${esc(MOODS[m].label.toLowerCase())}. Pick how you would like it.</p>
        <div class="wguide">${fmts.map(f => `<button class="chip" data-gfmt="${f}"><b>${esc(VERB[f])}</b><span class="muted">${esc(FORMAT_LABEL[f])}</span></button>`).join('')}<button class="chip" data-gfmt="any"><b>Any format</b><span class="muted">Show every ${esc(SHORT[m].toLowerCase())} star</span></button></div>
        <div class="cta"><button class="btn line" data-gback="1">Back</button></div>`;
    }
    if (selMood && selScent) {
      const list = (byMood.get(selMood)?.get(selScent) ?? []).slice().sort((a, b) => a.format.localeCompare(b.format));
      return `<span class="eyebrow">${dot(selMood)}${esc(MOODS[selMood].label)}</span><h3>${esc(selScent)}</h3>
        <p class="muted">${list.length === 1 ? 'Comes in one format.' : `Comes in ${list.length} formats. Pick one to see it.`}</p>
        <div class="chips wfmts">${list.map(i => `<a class="chip wfmt${fmtFilter === i.format ? ' lead' : ''}" href="#/product/${i.slug}"><img src="${i.thumb}" alt="" loading="lazy">${esc(FORMAT_LABEL[i.format])} · ${price(i)}</a>`).join('')}</div>
        <div class="cta"><button class="btn line" data-back="1">All ${esc(MOODS[selMood].label.toLowerCase())} scents</button><a class="btn" href="#/shop?f=all&m=${selMood}&s=featured">Shop this mood</a></div>`;
    }
    if (selMood) {
      const m = selMood, scents = scentsOf(m), fmts = formatsOf(m);
      const shown = fmtFilter ? scents.filter(s => byMood.get(m)!.get(s)!.some(i => i.format === fmtFilter)) : scents;
      const eyebrow = fmtFilter && gMoment ? `For ${esc(gMoment.name.toLowerCase())} · ${shown.length} ${shown.length === 1 ? 'star comes' : 'stars come'} as a ${esc(fmtWord(fmtFilter))}`
        : `${scents.length} star${scents.length === 1 ? '' : 's'} · ${fmts.map(f => esc(fmtWord(f))).join(', ')}`;
      return `<span class="eyebrow">${dot(m)}${eyebrow}</span><h3>${esc(MOODS[m].label)}</h3>
        <p class="muted">Tap a star to see how it comes and what it costs.</p>
        <div class="chips">${shown.map(s => `<button class="chip" data-pick="${esc(s)}" aria-pressed="false">${dot(m)}${esc(s)}</button>`).join('') || '<span class="muted">No scents here yet.</span>'}
          ${fmtFilter && shown.length < scents.length ? `<button class="chip ghost" data-allfmt="1">All ${scents.length} ${SHORT[m].toLowerCase()} stars</button>` : ''}</div>
        ${ritual(m)}<div class="cta"><a class="btn line" href="#/shop?f=all&m=${m}&s=featured">Shop this mood</a></div>`;
    }
    const all = items.filter(i => i.mood), n = new Set(all.map(i => i.scent)).size, from = Math.min(...all.map(i => i.priceMin));
    return `<span class="eyebrow">The scent atlas</span><h3>Read the sky <span class="it">for your scent.</span></h3>
      <p class="muted">Each mood is a constellation and each star in it is a scent. Tap a constellation to turn the sky towards it, then a star to see how it comes and what it costs.</p>
      ${all.length ? `<p class="small muted">${n} scents across ${moods.length} moods, from ${money(from)}.</p>` : ''}
      <div class="cta"><button class="btn" data-guide="1">Guide me</button><a class="btn line" href="#/explore?tab=quiz">Take the quiz</a></div>`;
  };

  // ---- behaviour ----
  const settle = () => { if (!portrait) return; const r = panelEl.getBoundingClientRect(); if (r.top > window.innerHeight - 140) panelEl.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' }); };
  const pickMood = (m: Mood, viaSky = false) => { selMood = selMood === m && !selScent ? null : m; selScent = null; guide = 0; if (selMood !== m) { fmtFilter = null; gMoment = null; } apply(); if (viaSky) settle(); };
  const pickScent = (m: Mood, s: string, viaSky = false) => { selMood = m; selScent = s; guide = 0; apply(); if (viaSky) settle(); };
  const wirePanel = () => {
    panelEl.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(b => {
      b.addEventListener('click', () => pickScent(selMood!, b.dataset.pick!));
      const st = starEls.find(x => x.dataset.scent === b.dataset.pick && x.dataset.mood === selMood);
      b.addEventListener('pointerenter', () => st?.classList.add('hint')); b.addEventListener('pointerleave', () => st?.classList.remove('hint'));
    });
    panelEl.querySelector<HTMLButtonElement>('[data-back]')?.addEventListener('click', () => { selScent = null; apply(); });
    panelEl.querySelector<HTMLButtonElement>('[data-guide]')?.addEventListener('click', () => { guide = 1; apply(); });
    panelEl.querySelectorAll<HTMLButtonElement>('[data-gback]').forEach(b => b.addEventListener('click', () => { guide = Number(b.dataset.gback); if (!guide) gMoment = null; apply(); }));
    panelEl.querySelectorAll<HTMLButtonElement>('[data-gmoment]').forEach(b => b.addEventListener('click', () => { gMoment = MOMENTS.find(mo => mo.key === b.dataset.gmoment) ?? null; guide = 2; apply(); }));
    panelEl.querySelectorAll<HTMLButtonElement>('[data-gfmt]').forEach(b => b.addEventListener('click', () => { fmtFilter = b.dataset.gfmt === 'any' ? null : (b.dataset.gfmt as Format); selMood = gMoment!.mood; selScent = null; guide = 0; apply(); }));
    panelEl.querySelector<HTMLButtonElement>('[data-allfmt]')?.addEventListener('click', () => { fmtFilter = null; apply(); });
    panelEl.querySelectorAll<HTMLButtonElement>('[data-addpair]').forEach(b => b.addEventListener('click', async () => {
      const rt = ritualFor(b.dataset.addpair as Mood); if (!rt) return;
      for (const p of rt.items) await add({ productId: p.id, slug: p.slug, name: p.name, price: p.priceMin, image: p.thumb, choice: p.choices[0]?.name, optionName: p.optionName });
      toast(`${rt.name} added to your cart`);
    }));
    // the mood switches live in the panel too, so the whole flow works without the sky
    panelEl.insertAdjacentHTML('beforeend', `<div class="chips wmoods" role="group" aria-label="Moods">${moods.map(m => `<button class="chip" data-mood-chip="${m}" aria-pressed="${selMood === m}">${dot(m)}${esc(SHORT[m])}</button>`).join('')}</div>`);
    panelEl.querySelectorAll<HTMLButtonElement>('.wmoods [data-mood-chip]').forEach(b => b.addEventListener('click', () => pickMood(b.dataset.moodChip as Mood)));
  };
  const keys = (list: () => SVGGElement[], g: SVGGElement, act: () => void) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); return; }
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0; if (!d) return;
    const vis = list(), i = vis.indexOf(g); if (i < 0) return;
    e.preventDefault(); vis[(i + d + vis.length) % vis.length].focus({ preventScroll: true });
  };
  const wireSky = () => {
    btnEls.forEach(g => { const act = (sky: boolean) => pickMood(g.dataset.mood as Mood, sky); g.addEventListener('click', () => act(true)); g.addEventListener('keydown', keys(() => btnEls, g, () => act(false))); });
    starEls.forEach(g => { const act = (sky: boolean) => pickScent(g.dataset.mood as Mood, g.dataset.scent!, sky); g.addEventListener('click', e => { e.stopPropagation(); act(true); }); g.addEventListener('keydown', keys(() => starEls.filter(s => s.classList.contains('open')), g, () => act(false))); });
    // tap the open sky: the nearest constellation answers
    svg.addEventListener('click', e => {
      if ((e.target as Element).closest('.wcon-btn, .wstar')) return;
      const best = conEls.map(g => { const r = g.querySelector<SVGCircleElement>('.whit')!.getBoundingClientRect(); return { m: g.dataset.mood as Mood, d: Math.hypot(r.left + r.width / 2 - e.clientX, r.top + r.height / 2 - e.clientY) / (r.width / 2) }; }).sort((a, b) => a.d - b.d)[0];
      if (!best || best.d > 1.9) return;
      if (best.m !== selMood) pickMood(best.m, true); else if (selScent) { selScent = null; apply(); }
    });
  };
  wireSky();
  // the twinkle and the slow outer ring only run while the plate is on screen and the tab is visible
  let onScreen = true, io: IntersectionObserver | null = null;
  const live = () => plate.classList.toggle('live', onScreen && !document.hidden);
  const watch = () => {
    io?.disconnect();
    if ('IntersectionObserver' in window) { io = new IntersectionObserver(es => { onScreen = es.some(x => x.isIntersecting); live(); }, { threshold: .02 }); io.observe(plate); } else live();
  };
  document.addEventListener('visibilitychange', live);
  // crossing the phone breakpoint redraws the plate in the other proportion, keeping the choice
  const mq = window.matchMedia('(max-width: 820px)');
  const onMq = () => { if (mq.matches === portrait) return; portrait = mq.matches; cancelAnimationFrame(raf); build(); grab(); wireSky(); watch(); cur = { rot: 0, s: 1, dy: 0 }; apply(false); live(); };
  mq.addEventListener('change', onMq);
  const td = () => { cancelAnimationFrame(raf); io?.disconnect(); document.removeEventListener('visibilitychange', live); mq.removeEventListener('change', onMq); window.removeEventListener('hashchange', td); if (teardown === td) teardown = null; };
  teardown = td; window.addEventListener('hashchange', td);
  watch(); apply(false); live();
}
