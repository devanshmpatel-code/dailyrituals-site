import { MOODS, MOMENTS, FORMAT_LABEL, type Mood, type Moment } from '../config';
import { money, type Item } from '../wix';
import { esc } from '../ui';

// Scent wheel: the outer ring is the day (five moments, each tied to a mood), the inner ring holds the scents
// of that mood, and the hub says what is selected. A gold sun marks the moment nearest the visitor's local time.
const CX = 300, CY = 300;
const OUT = [214, 268], IN = [128, 204], HUB = 112;
const rad = (d: number) => (d * Math.PI) / 180;
const P = (r: number, deg: number) => `${(CX + r * Math.cos(rad(deg))).toFixed(1)},${(CY + r * Math.sin(rad(deg))).toFixed(1)}`;
const sector = (r0: number, r1: number, a0: number, a1: number) =>
  `M${P(r1, a0)} A${r1},${r1} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${P(r1, a1)} L${P(r0, a1)} A${r0},${r0} 0 ${a1 - a0 > 180 ? 1 : 0} 0 ${P(r0, a0)} Z`;

function nowMoment(): Moment {
  const d = new Date(), h = d.getHours() + d.getMinutes() / 60;
  const dist = (a: number, b: number) => { const x = Math.abs(a - b); return Math.min(x, 24 - x); };
  return MOMENTS.reduce((a, b) => (dist(b.hour, h) < dist(a.hour, h) ? b : a));
}

export function mountWheel(el: HTMLElement, items: Item[]) {
  const byMood = new Map<Mood, Map<string, Item[]>>();
  items.forEach(i => { if (!i.mood) return; const m = byMood.get(i.mood) ?? new Map(); m.set(i.scent, [...(m.get(i.scent) ?? []), i]); byMood.set(i.mood, m); });
  const now = nowMoment();
  let selMood: Mood | null = null, selScent: string | null = null;
  const step = 360 / MOMENTS.length;

  const svg = () => {
    let outer = '', inner = '', labels = '';
    MOMENTS.forEach((mo, i) => {
      const a0 = -90 + i * step + 1.2, a1 = -90 + (i + 1) * step - 1.2, mid = (a0 + a1) / 2;
      const col = MOODS[mo.mood].swatch, on = selMood === mo.mood, dim = selMood && !on;
      outer += `<path class="wseg" data-mood="${mo.mood}" d="${sector(OUT[0], OUT[1], a0, a1)}" fill="${col}" opacity="${dim ? .3 : 1}" tabindex="0" role="button" aria-pressed="${on}" aria-label="${esc(mo.name)}, ${esc(MOODS[mo.mood].label)}"></path>`;
      const flip = mid > 0 && mid < 180, tr = flip ? mid - 90 : mid + 90, rm = (OUT[0] + OUT[1]) / 2;
      const [lx, ly] = P(rm, mid).split(',');
      const ink = dim || mo.mood === 'fresh' || mo.mood === 'sunny'; // dark text on pale or light segments, white on deep ones
      labels += `<text class="wlab" fill="${ink ? '#2A1F33' : '#FFFFFF'}" transform="translate(${lx},${ly}) rotate(${tr.toFixed(1)})" text-anchor="middle" dy="5">${esc(mo.name.toUpperCase())} · ${esc(mo.time)}</text>`;
      const scents = [...(byMood.get(mo.mood)?.keys() ?? [])].sort();
      const span = (a1 - a0 - 3) / Math.max(scents.length, 1);
      scents.forEach((sc, k) => {
        const s0 = a0 + 1.5 + k * span + .8, s1 = a0 + 1.5 + (k + 1) * span - .8, sOn = selScent === sc;
        inner += `<path class="wseg wsc" data-scent="${esc(sc)}" data-mood="${mo.mood}" d="${sector(IN[0], IN[1], s0, s1)}" fill="${col}" fill-opacity="${sOn ? 1 : on ? .62 : dim ? .12 : .34}" stroke="${sOn ? 'var(--ink, #2A1F33)' : 'none'}" stroke-width="3" tabindex="0" role="button" aria-pressed="${sOn}" aria-label="${esc(sc)}, ${esc(MOODS[mo.mood].label)}"></path>`;
      });
    });
    const nowIdx = MOMENTS.findIndex(m => m.key === now.key), nm = -90 + nowIdx * step + step / 2;
    const [sx, sy] = P(OUT[1] + 18, nm).split(',');
    const mo = selMood ? MOMENTS.find(m => m.mood === selMood)! : null;
    const hub = selScent
      ? `<text class="whub-s" x="${CX}" y="${CY - 8}" text-anchor="middle">${esc(selScent)}</text><text class="whub-n" x="${CX}" y="${CY + 22}" text-anchor="middle">${esc(MOODS[selMood!].label)}</text>`
      : mo
        ? `<text class="whub-t" x="${CX}" y="${CY - 8}" text-anchor="middle">${esc(mo.name)}</text><text class="whub-n" x="${CX}" y="${CY + 22}" text-anchor="middle">${esc(MOODS[mo.mood].label)}</text>`
        : `<text class="whub-t" x="${CX}" y="${CY - 6}" text-anchor="middle">Pick a</text><text class="whub-t" x="${CX}" y="${CY + 26}" text-anchor="middle"><tspan font-style="italic">moment</tspan></text>`;
    return `<svg viewBox="0 0 600 600" role="group" aria-label="Scent wheel: five moments of the day, each with its scents">
      <circle cx="${CX}" cy="${CY}" r="${OUT[1] + 14}" fill="none" stroke="var(--line)" stroke-dasharray="2 7" stroke-width="2"></circle>
      <circle cx="${CX}" cy="${CY}" r="${HUB}" fill="${selMood ? 'var(--paper, #fff)' : 'var(--tint-butter, #F6E7C9)'}" stroke="var(--line)"></circle>
      ${outer}${inner}${labels}
      <g aria-hidden="true"><circle cx="${sx}" cy="${sy}" r="13" fill="var(--gold, #E8A957)" stroke="var(--ground, #F7F2EA)" stroke-width="3"></circle>
        <text x="${sx}" y="${Number(sy) - 22}" text-anchor="middle" class="wnow">NOW</text></g>
      ${hub}</svg>`;
  };

  const panel = () => {
    if (selMood && selScent) {
      const list = (byMood.get(selMood)?.get(selScent) ?? []).slice().sort((a, b) => a.format.localeCompare(b.format));
      return `<span class="eyebrow">${esc(MOODS[selMood].label)}</span><h3>${esc(selScent)}</h3>
        <p class="muted">Comes in ${list.length} format${list.length === 1 ? '' : 's'}.</p>
        <div class="chips">${list.map(i => `<a class="chip" href="#/product/${i.slug}">${esc(FORMAT_LABEL[i.format])} · ${i.priceMin === i.priceMax ? money(i.priceMin) : `from ${money(i.priceMin)}`}</a>`).join('')}</div>
        <div class="cta"><button class="btn line" data-back="1">All ${esc(MOODS[selMood].label.toLowerCase())} scents</button><a class="btn" href="#/shop?f=all&m=${selMood}&s=featured">Shop this mood</a></div>`;
    }
    if (selMood) {
      const mo = MOMENTS.find(m => m.mood === selMood)!;
      const scents = [...(byMood.get(selMood)?.keys() ?? [])].sort();
      return `<span class="eyebrow">${esc(mo.name)} · ${esc(mo.time)}${mo.key === now.key ? ' · your moment now' : ''}</span><h3>${esc(MOODS[selMood].label)}</h3>
        <p class="muted"><span class="${mo.draft ? 'd' : ''}">${esc(mo.line)}</span></p>
        <div class="chips">${scents.map(s => `<button class="chip" data-pick="${esc(s)}">${esc(s)}</button>`).join('') || '<span class="muted">No scents here yet.</span>'}</div>
        <div class="cta"><a class="btn" href="#/shop?f=all&m=${selMood}&s=featured">Shop this mood</a></div>`;
    }
    return `<span class="eyebrow">Scent wheel</span><h3>Find your scent by the time of day</h3>
      <p class="muted">The outer ring is your day, from dawn to night. Each moment has a mood, and each mood has its scents. Tap a moment to begin${now ? `, or start with <button class="linkbtn" data-start="${now.mood}">${esc(now.name.toLowerCase())}</button>, which is where the sun is now` : ''}.</p>`;
  };

  const draw = () => {
    el.innerHTML = `<div class="wheelwrap"><div class="wheel">${svg()}</div>
      <div class="wpanel" aria-live="polite">${panel()}
        <div class="chips wmoods" role="group" aria-label="Moments of the day">${MOMENTS.map(m => `<button class="chip" data-mood-chip="${m.mood}" aria-pressed="${selMood === m.mood}"><span class="swatch" style="background:${MOODS[m.mood].swatch}"></span>${esc(m.name)}</button>`).join('')}</div>
      </div></div>`;
    const pickMood = (m: Mood) => { selMood = selMood === m && !selScent ? null : m; selScent = null; draw(); };
    el.querySelectorAll<SVGPathElement>('.wseg').forEach(s => {
      const act = () => {
        if (s.dataset.scent) { selMood = s.dataset.mood as Mood; selScent = s.dataset.scent; draw(); }
        else pickMood(s.dataset.mood as Mood);
        el.querySelector<SVGPathElement>(s.dataset.scent ? `[data-scent="${CSS.escape(s.dataset.scent)}"]` : `[data-mood="${s.dataset.mood}"]:not([data-scent])`)?.focus({ preventScroll: true });
      };
      s.addEventListener('click', act);
      s.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } });
    });
    el.querySelectorAll<HTMLButtonElement>('[data-mood-chip]').forEach(b => b.addEventListener('click', () => pickMood(b.dataset.moodChip as Mood)));
    el.querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(b => b.addEventListener('click', () => { selScent = b.dataset.pick!; draw(); }));
    el.querySelectorAll<HTMLButtonElement>('[data-start]').forEach(b => b.addEventListener('click', () => { selMood = b.dataset.start as Mood; selScent = null; draw(); }));
    el.querySelector<HTMLButtonElement>('[data-back]')?.addEventListener('click', () => { selScent = null; draw(); });
  };
  draw();
}
