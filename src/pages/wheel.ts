import { MOODS, MOMENTS, FORMAT_LABEL, type Mood, type Moment } from '../config';
import { money, findLive, type Item } from '../wix';
import { esc, toast } from '../ui';
import { add } from '../cart';
import '../wheel.css';

// Scent compass. A square field with two feeling axes; each mood is a soft, lit bloom placed on it. Tap a bloom
// (or anywhere near it) and it glides to the centre while its scents open around it as orbs; the other moods
// shrink to the rim as quick switches. The panel beside the field does the selling: scents, formats, prices,
// the ready-made ritual. The SVG is drawn once and updated in place so every state change can animate.
//
// Design mapping (draft for Claire): the axis words are taken from the mood labels in config ("Fresh and coastal",
// "Warm and woody", "Sunny and tropical" reads as bright, "Soft and floral" as soft). x runs fresh (-1) to warm (+1),
// y runs bright (-1, top) to soft (+1, bottom). Positions are a layout choice, not a claim about any scent.
const POS: Record<Mood, [number, number]> = { fresh: [-.74, -.3], sunny: [.26, -.8], floral: [-.44, .6], woody: [.8, .06], grounding: [.36, .76] };
const AXES = { top: 'Bright', bottom: 'Soft', left: 'Fresh', right: 'Warm' }; // draft for Claire
/** One word per mood for the resting blooms; each word is already in the mood's label. */
const SHORT: Record<Mood, string> = { fresh: 'Fresh', sunny: 'Sunny', floral: 'Floral', woody: 'Woody', grounding: 'Grounding' };
/** ink on the two pale swatches, white on the three deep ones (all meet AA on their swatch) */
const INK_ON: Record<Mood, boolean> = { fresh: true, sunny: true, floral: false, woody: false, grounding: false };

const CX = 300, CY = 300, REST = 188, RIM = 246, RING = 150, ORB = 50, SORB = 34;
const rad = (d: number) => (d * Math.PI) / 180, deg = (x: number, y: number) => (Math.atan2(y, x) * 180) / Math.PI;
const hex = (s: string) => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
const mix = (a: string, b: string, t: number) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
const tr = (x: number, y: number, s = 1) => `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${s})`;
const gap = (a: number, b: number) => { const d = Math.abs(((a - b) % 360) + 360) % 360; return Math.min(d, 360 - d); };
/** scent orbs sit evenly around the centre, turned so they keep clear of the rim blooms (nearest the top when tied) */
const angles = (n: number, rims: number[]) => {
  let best = -90, score = -1;
  for (let o = -90; o < 270; o += 3) {
    const s = Math.min(...Array.from({ length: n }, (_, i) => Math.min(...rims.map(r => gap(o + (i * 360) / n, r)))));
    if (s > score + .5 || (s > score - .5 && gap(o, -90) < gap(best, -90))) { score = s; best = o; }
  }
  return Array.from({ length: n }, (_, i) => best + (i * 360) / n);
};

export function mountWheel(el: HTMLElement, items: Item[], initialMood: Mood | null = null) {
  const byMood = new Map<Mood, Map<string, Item[]>>();
  items.forEach(i => { if (!i.mood) return; const m = byMood.get(i.mood) ?? new Map(); m.set(i.scent, [...(m.get(i.scent) ?? []), i]); byMood.set(i.mood, m); });
  const moods = (Object.keys(MOODS) as Mood[]).filter(m => byMood.has(m));
  const scentsOf = (m: Mood) => [...(byMood.get(m)?.keys() ?? [])].sort();
  let selMood: Mood | null = initialMood && byMood.has(initialMood) ? initialMood : null, selScent: string | null = null;

  // ---- the field, drawn once ----
  const defs = moods.map(m => {
    const sw = MOODS[m].swatch;
    // the highlight stays in the top-left third so the words at the centre sit on the plain swatch (AA with INK_ON)
    return `<radialGradient id="wo-${m}" cx=".34" cy=".28" r=".8"><stop offset="0" stop-color="${mix(sw, '#FFFFFF', .34)}"/><stop offset=".3" stop-color="${sw}"/><stop offset="1" stop-color="${mix(sw, '#2A1F33', .34)}"/></radialGradient>
      <radialGradient id="ws-${m}" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="${mix(sw, '#FFFFFF', .72)}"/><stop offset="1" stop-color="${mix(sw, '#FFFFFF', .3)}"/></radialGradient>
      <radialGradient id="wg-${m}"><stop offset="0" stop-color="${sw}" stop-opacity=".5"/><stop offset=".5" stop-color="${sw}" stop-opacity=".16"/><stop offset="1" stop-color="${sw}" stop-opacity="0"/></radialGradient>`;
  }).join('');
  // one small seed per scent, as a crown above the resting bloom (a hint of what opens)
  const seeds = (m: Mood) => scentsOf(m).map((_, k, a) => { const d = rad(a.length > 1 ? -150 + (120 * k) / (a.length - 1) : -90), r = ORB + 15; return `<circle cx="${(r * Math.cos(d)).toFixed(1)}" cy="${(r * Math.sin(d)).toFixed(1)}" r="3.5"/>`; }).join('');
  // stems live in their own layer so a scent's hit box is just its orb and name
  const stems = moods.flatMap(m => scentsOf(m).map(s => `<line class="wstem out" data-scent="${esc(s)}" x1="${CX}" y1="${CY}" x2="${CX}" y2="${CY}" style="--sw:${MOODS[m].swatch}"/>`)).join('');
  const petals = moods.flatMap(m => scentsOf(m).map(s => `<g class="wpetal out" data-scent="${esc(s)}" data-mood="${m}" role="button" tabindex="-1" aria-hidden="true" aria-pressed="false" aria-label="${esc(s)}, ${esc(MOODS[m].label)}" style="--sw:${MOODS[m].swatch};transform:${tr(CX, CY, .2)}">
      <circle class="wsorb" r="${SORB}" fill="url(#ws-${m})"/><circle class="wsring" r="${SORB + 7}"/><text class="wpl" text-anchor="middle">${esc(s)}</text></g>`)).join('');
  const blooms = moods.map((m, i) => `<g class="wbloom" data-mood="${m}" role="button" tabindex="0" aria-pressed="false" aria-label="${esc(MOODS[m].label)}, ${scentsOf(m).length} scents" style="--sw:${MOODS[m].swatch}">
      <g class="wdrift" style="animation-delay:-${i * 2.3}s;animation-duration:${10 + i * 1.7}s"><g class="wlift"><g class="worb"><circle r="${ORB}" fill="url(#wo-${m})"/><circle class="wbring" r="${ORB + 9}"/></g>
      <g class="wseeds" fill="${MOODS[m].swatch}" aria-hidden="true">${seeds(m)}</g><text class="wbt ${INK_ON[m] ? 'ink' : 'wht'}" text-anchor="middle"></text>
      <text class="wbl" text-anchor="middle" y="${ORB + 26}">${esc(SHORT[m])}</text></g></g></g>`).join('');
  const glows = moods.map((m, i) => `<g class="wglow" data-mood="${m}"><circle class="wdrift" r="150" fill="url(#wg-${m})" style="animation-delay:-${i * 2.3}s;animation-duration:${10 + i * 1.7}s"/></g>`).join('');
  const ax = (x: number, y: number, t: string, rot = 0) => `<text class="wax" x="${x}" y="${y}" text-anchor="middle" transform="rotate(${rot} ${x} ${y})">${t.toUpperCase()}</text>`;
  el.innerHTML = `<div class="wheelwrap wcompass"><div class="wheel wfield">
      <svg class="wsvg" viewBox="0 0 600 600" role="group" aria-label="Scent compass: five moods placed between fresh and warm, bright and soft">
        <defs>${defs}<radialGradient id="wdisc"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".7"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
          <radialGradient id="wlg"><stop offset="0" stop-color="#FFFBF2" stop-opacity=".75"/><stop offset=".6" stop-color="#FFFBF2" stop-opacity=".18"/><stop offset="1" stop-color="#FFFBF2" stop-opacity="0"/></radialGradient>
          <clipPath id="wclip"><circle cx="${CX}" cy="${CY}" r="296"/></clipPath></defs>
        <g class="wbg" aria-hidden="true"><circle cx="${CX}" cy="${CY}" r="288" fill="url(#wdisc)"/><circle class="wring" cx="${CX}" cy="${CY}" r="272"/>
          <line class="wax-l" x1="${CX}" y1="60" x2="${CX}" y2="540"/><line class="wax-l" x1="60" y1="${CY}" x2="540" y2="${CY}"/>
          ${ax(CX, 22, AXES.top)}${ax(CX, 588, AXES.bottom)}${ax(12, CY, AXES.left, -90)}${ax(588, CY, AXES.right, 90)}</g>
        <g clip-path="url(#wclip)" aria-hidden="true"><g class="wglows">${glows}</g><circle class="wlight" r="130" fill="url(#wlg)"/></g>
        <g class="wstems" aria-hidden="true">${stems}</g><g class="wpetals">${petals}</g><g class="wblooms">${blooms}</g></svg></div>
    <div class="wpanel" aria-live="polite"></div></div>`;
  const svg = el.querySelector<SVGSVGElement>('svg')!, field = el.querySelector<HTMLElement>('.wfield')!, panelEl = el.querySelector<HTMLElement>('.wpanel')!;
  const light = svg.querySelector<SVGCircleElement>('.wlight')!;
  const bloomEls = [...svg.querySelectorAll<SVGGElement>('.wbloom')], petalEls = [...svg.querySelectorAll<SVGGElement>('.wpetal')];
  const stemOf = new Map([...svg.querySelectorAll<SVGLineElement>('.wstem')].map(l => [l.dataset.scent!, l]));
  const glowEls = new Map([...svg.querySelectorAll<SVGGElement>('.wglow')].map(g => [g.dataset.mood as Mood, g]));
  const pos = new Map<Mood, [number, number]>();

  // where each bloom sits for the current state: resting on the compass, at the centre, or pushed to the rim
  const place = (m: Mood): [number, number, number] => {
    const [px, py] = POS[m];
    if (!selMood) return [CX + px * REST, CY + py * REST, 1];
    if (m === selMood) return [CX, CY, 1.9];
    const l = Math.hypot(px, py); return [CX + (px / l) * RIM, CY + (py / l) * RIM, .66];
  };
  // one or two lines of text in the centre bloom: "Fresh and / coastal", "Campfire / Stories", "Citrus & / Sun"
  const lines = (t: string, cls: string, size: number, y0: number) => {
    const w = t.split(' '), k = t.indexOf(' and ');
    const ws = w.length < 2 ? w : k > 0 ? [t.slice(0, k + 4), t.slice(k + 5)] : [w.slice(0, -1).join(' '), w[w.length - 1]];
    return ws.map((x, i) => `<tspan class="${cls}" x="0" dy="${i ? size * 1.1 : y0}">${esc(x)}</tspan>`).join('');
  };
  const apply = () => {
    field.classList.toggle('picked', !!selMood);
    bloomEls.forEach(g => {
      const m = g.dataset.mood as Mood, [x, y, s] = place(m), on = m === selMood;
      pos.set(m, [x, y]); g.style.transform = tr(x, y); g.querySelector<SVGGElement>('.worb')!.style.transform = `scale(${s})`;
      g.classList.toggle('on', on); g.classList.toggle('rim', !!selMood && !on); g.setAttribute('aria-pressed', String(on));
      const gl = glowEls.get(m)!; gl.style.transform = tr(x, y, on ? 1.5 : selMood ? .3 : 1); gl.classList.toggle('on', on);
      const t = g.querySelector<SVGTextElement>('.wbt')!;
      t.innerHTML = on && selScent ? lines(selScent, 'wbt-s', 24, -4) + `<tspan class="wbt-n" x="0" dy="30">${esc(SHORT[m])}</tspan>`
        : on ? lines(MOODS[m].label, 'wbt-l', 21, MOODS[m].label.includes(' and ') ? -4 : 7)
          : `<tspan class="wbt-w" x="0" dy="6">${esc(SHORT[m])}</tspan>`;
    });
    const open = selMood ? scentsOf(selMood) : [], ang = angles(open.length, moods.filter(m => m !== selMood).map(m => deg(POS[m][0], POS[m][1])));
    petalEls.forEach(p => {
      const k = open.indexOf(p.dataset.scent!), show = k >= 0, sel = show && p.dataset.scent === selScent, st = stemOf.get(p.dataset.scent!)!;
      if (show) {
        const a = ang[k], x = RING * Math.cos(rad(a)), y = RING * Math.sin(rad(a)), up = Math.sin(rad(a)) < -.2;
        p.style.transform = tr(CX + x, CY + y); p.style.transitionDelay = `${80 + k * 90}ms`;
        st.setAttribute('x2', (CX + x).toFixed(1)); st.setAttribute('y2', (CY + y).toFixed(1));
        p.querySelector<SVGTextElement>('.wpl')!.setAttribute('y', up ? `${-SORB - 14}` : `${SORB + 26}`);
      } else { p.style.transform = tr(CX, CY, .2); p.style.transitionDelay = '0ms'; }
      st.classList.toggle('out', !show); st.classList.toggle('sel', sel);
      p.classList.toggle('out', !show); p.classList.toggle('sel', sel); p.setAttribute('aria-pressed', String(sel));
      p.setAttribute('aria-hidden', String(!show)); p.setAttribute('tabindex', show ? '0' : '-1');
    });
    panelEl.innerHTML = panel(); wirePanel();
  };

  // ---- the panel: how to buy ----
  const momentOf = (m: Mood) => MOMENTS.find(mo => mo.mood === m)!;
  const pairOf = (mo: Moment) => [findLive(items, mo.pair.diffuser, 'diffuser'), findLive(items, mo.pair.roller, 'roller')].filter(Boolean) as Item[];
  const price = (i: Item) => (i.priceMin === i.priceMax ? money(i.priceMin) : `from ${money(i.priceMin)}`);
  const ritual = (m: Mood) => {
    const mo = momentOf(m), ps = pairOf(mo); if (ps.length !== 2) return '';
    // the pairing and its name come from config (the same ritual the home page sells)
    return `<div class="writ"><div class="writ-th" aria-hidden="true">${ps.map(p => `<img src="${p.thumb}" alt="" loading="lazy">`).join('')}</div>
      <div class="writ-tx"><span class="eyebrow">The ${esc(mo.name.toLowerCase())} ritual</span><b>${ps.map(p => `${esc(p.scent)} ${esc(FORMAT_LABEL[p.format].replace(/^(Mini|Fragrance) /, '').toLowerCase())}`).join(' + ')}</b></div>
      <button class="btn" data-addpair="${mo.key}">Add both · ${money(ps.reduce((n, i) => n + i.priceMin, 0))}</button></div>`;
  };
  const panel = () => {
    if (selMood && selScent) {
      const list = (byMood.get(selMood)?.get(selScent) ?? []).slice().sort((a, b) => a.format.localeCompare(b.format));
      return `<span class="eyebrow"><span class="swatch" style="background:${MOODS[selMood].swatch}"></span>${esc(MOODS[selMood].label)}</span><h3>${esc(selScent)}</h3>
        <p class="muted">${list.length === 1 ? 'Comes in one format.' : `Comes in ${list.length} formats. Pick one to see it.`}</p>
        <div class="chips wfmts">${list.map(i => `<a class="chip wfmt" href="#/product/${i.slug}"><img src="${i.thumb}" alt="" loading="lazy">${esc(FORMAT_LABEL[i.format])} · ${price(i)}</a>`).join('')}</div>
        <div class="cta"><button class="btn line" data-back="1">All ${esc(MOODS[selMood].label.toLowerCase())} scents</button><a class="btn" href="#/shop?f=all&m=${selMood}&s=featured">Shop this mood</a></div>`;
    }
    if (selMood) {
      const scents = scentsOf(selMood), fmts = [...new Set(items.filter(i => i.mood === selMood).map(i => i.format))].sort();
      return `<span class="eyebrow"><span class="swatch" style="background:${MOODS[selMood].swatch}"></span>${scents.length} scent${scents.length === 1 ? '' : 's'} · ${fmts.map(f => esc(FORMAT_LABEL[f].replace(/^(Mini|Fragrance) /, '').toLowerCase())).join(', ')}</span><h3>${esc(MOODS[selMood].label)}</h3>
        <p class="muted">Tap a scent to see how it comes and what it costs.</p>
        <div class="chips">${scents.map(s => `<button class="chip" data-pick="${esc(s)}" aria-pressed="false"><span class="swatch" style="background:${MOODS[selMood!].swatch}"></span>${esc(s)}</button>`).join('') || '<span class="muted">No scents here yet.</span>'}</div>
        ${ritual(selMood)}<div class="cta"><a class="btn line" href="#/shop?f=all&m=${selMood}&s=featured">Shop this mood</a></div>`;
    }
    // draft for Claire: the invitation copy. The counts and the price are read from the live catalogue.
    const all = items.filter(i => i.mood), n = new Set(all.map(i => i.scent)).size, from = Math.min(...all.map(i => i.priceMin));
    return `<span class="eyebrow">Scent compass</span><h3>How do you want <span class="it">to feel?</span></h3>
      <p class="muted">Fresh or warm, bright or soft. Tap the bloom that feels closest, or anywhere near it, and its scents open around it.</p>
      ${all.length ? `<p class="small muted">${n} scents across ${moods.length} moods, from ${money(from)}.</p>` : ''}`;
  };

  // ---- behaviour ----
  const pickMood = (m: Mood) => { selMood = selMood === m && !selScent ? null : m; selScent = null; apply(); };
  const pickScent = (m: Mood, s: string) => { selMood = m; selScent = s; apply(); };
  const wirePanel = () => {
    panelEl.querySelectorAll<HTMLButtonElement>('[data-mood-chip]').forEach(b => b.addEventListener('click', () => pickMood(b.dataset.moodChip as Mood)));
    panelEl.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(b => b.addEventListener('click', () => pickScent(selMood!, b.dataset.pick!)));
    panelEl.querySelector<HTMLButtonElement>('[data-back]')?.addEventListener('click', () => { selScent = null; apply(); });
    panelEl.querySelectorAll<HTMLButtonElement>('[data-addpair]').forEach(b => b.addEventListener('click', async () => {
      const mo = MOMENTS.find(m => m.key === b.dataset.addpair)!;
      for (const p of pairOf(mo)) await add({ productId: p.id, slug: p.slug, name: p.name, price: p.priceMin, image: p.thumb, choice: p.choices[0]?.name, optionName: p.optionName });
      toast(`${mo.name} ritual added to your cart`);
    }));
    // the mood switches live in the panel too, so the whole flow works without the field
    panelEl.insertAdjacentHTML('beforeend', `<div class="chips wmoods" role="group" aria-label="Moods">${moods.map(m => `<button class="chip" data-mood-chip="${m}" aria-pressed="${selMood === m}"><span class="swatch" style="background:${MOODS[m].swatch}"></span>${esc(SHORT[m])}</button>`).join('')}</div>`);
    panelEl.querySelectorAll<HTMLButtonElement>('.wmoods [data-mood-chip]').forEach(b => b.addEventListener('click', () => pickMood(b.dataset.moodChip as Mood)));
  };
  const keys = (list: SVGGElement[], g: SVGGElement, act: () => void) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); return; }
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0; if (!d) return;
    const vis = list.filter(x => x.getAttribute('tabindex') === '0'), i = vis.indexOf(g); if (i < 0) return;
    e.preventDefault(); vis[(i + d + vis.length) % vis.length].focus({ preventScroll: true });
  };
  bloomEls.forEach(g => { const act = () => pickMood(g.dataset.mood as Mood); g.addEventListener('click', act); g.addEventListener('keydown', keys(bloomEls, g, act)); });
  petalEls.forEach(g => { const act = () => pickScent(g.dataset.mood as Mood, g.dataset.scent!); g.addEventListener('click', act); g.addEventListener('keydown', keys(petalEls, g, act)); });
  // tap the open field: the nearest bloom answers. A soft light follows the pointer over the field.
  const toField = (e: PointerEvent | MouseEvent) => { const r = svg.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 600, ((e.clientY - r.top) / r.height) * 600] as const; };
  svg.addEventListener('click', e => {
    if ((e.target as Element).closest('.wbloom, .wpetal')) return;
    const [x, y] = toField(e);
    const near = moods.map(m => ({ m, d: Math.hypot(pos.get(m)![0] - x, pos.get(m)![1] - y) })).sort((a, b) => a.d - b.d)[0];
    if (!near || near.d > 230) return;
    if (near.m !== selMood) pickMood(near.m); else if (selScent) { selScent = null; apply(); }
  });
  svg.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; const [x, y] = toField(e); light.style.transform = tr(x, y); light.classList.add('on'); });
  svg.addEventListener('pointerleave', () => light.classList.remove('on'));
  svg.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; const [x, y] = toField(e); light.style.transform = tr(x, y); light.classList.add('on'); setTimeout(() => light.classList.remove('on'), 900); });
  // ambient drift only while the field is on screen (and never under reduced motion, see wheel.css)
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { if (!field.isConnected) { io.disconnect(); return; } field.classList.toggle('live', es.some(x => x.isIntersecting)); }, { threshold: .05 });
    io.observe(field);
  } else field.classList.add('live');
  apply();
}
