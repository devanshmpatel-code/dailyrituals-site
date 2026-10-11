import { esc } from '../ui';

// "Why patterns repeat": a circular loop. The old loop has three steps; the new loop adds a pause.
// A quiet mandala sits behind it, a light travels round the ring, and each step has a line icon.
// All explanatory text is placeholder copy for Claire (class "d"), written to match the page's own wording.
type Icon = 'notice' | 'bolt' | 'sigh' | 'pause' | 'lotus' | 'sprout';
type Step = { label: string; text: string; icon: Icon };
const LOOPS: Record<'old' | 'new', { title: string; note: string; color: string; glow: string; steps: Step[] }> = {
  old: {
    title: 'The old loop', note: 'Runs on autopilot', color: '#8A5A3B', glow: '#D9953A',
    steps: [
      { label: 'Cue', icon: 'notice', text: 'A familiar trigger: a smell, a deadline, a crowded room.' },
      { label: 'Automatic response', icon: 'bolt', text: 'The usual reaction fires before you have chosen it.' },
      { label: 'Short-term relief', icon: 'sigh', text: 'It eases the moment, which teaches the loop to repeat.' },
    ],
  },
  new: {
    title: 'A new loop', note: 'A small pause changes the path', color: '#2F5249', glow: '#7FB5A3',
    steps: [
      { label: 'Cue', icon: 'notice', text: 'The same trigger shows up. Noticing it is the first step.' },
      { label: 'Pause', icon: 'pause', text: 'A small, practised pause. This is where coaching focuses.' },
      { label: 'Chosen response', icon: 'lotus', text: 'You try a different response, one small step at a time.' },
      { label: 'Steadier result', icon: 'sprout', text: 'Repeated daily, the new response gets easier.' },
    ],
  },
};

// 24 x 24 line icons
const ICONS: Record<Icon, string> = {
  notice: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  bolt: '<path d="M13 2L5 13.5h6L10 22l8-11.5h-6z"/>',
  sigh: '<path d="M3 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  lotus: '<path d="M12 20c-4 0-8-3-9-9 4 0 7 2 9 5 2-3 5-5 9-5-1 6-5 9-9 9z"/><path d="M12 16c-2-3-2-7 0-11 2 4 2 8 0 11z"/>',
  sprout: '<path d="M12 21v-9"/><path d="M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 15c0-3 2-5 6-5 0 3-2 5-6 5z"/>',
};

const CX = 280, CY = 250, R = 170, NR = 58;
const rad = (d: number) => (d * Math.PI) / 180;
const pt = (deg: number, r = R) => ({ x: CX + r * Math.cos(rad(deg)), y: CY + r * Math.sin(rad(deg)) });

function mandala(color: string): string {
  const petals = Array.from({ length: 12 }, (_, i) => `<ellipse cx="${CX}" cy="${CY - 112}" rx="15" ry="46" transform="rotate(${i * 30} ${CX} ${CY})"></ellipse>`).join('');
  return `<g class="lp-mandala" fill="none" stroke="${color}" stroke-opacity=".16" stroke-width="1.4">${petals}
    <circle cx="${CX}" cy="${CY}" r="${R + 62}" stroke-dasharray="2 8"></circle><circle cx="${CX}" cy="${CY}" r="${R - 70}"></circle><circle cx="${CX}" cy="${CY}" r="${R + 28}" stroke-opacity=".1"></circle></g>`;
}

function svgFor(mode: 'old' | 'new', active: number, reduceMotion: boolean): string {
  const L = LOOPS[mode], n = L.steps.length, step = 360 / n;
  const gap = 2 * Math.asin(NR / (2 * R)) * (180 / Math.PI) + 6;
  const arcs = L.steps.map((_, i) => {
    const a = pt(-90 + i * step + gap), b = pt(-90 + (i + 1) * step - gap);
    const on = i === active;
    return `<path class="lp-arc${on ? ' on' : ''}" d="M${a.x.toFixed(1)},${a.y.toFixed(1)} A${R},${R} 0 0 1 ${b.x.toFixed(1)},${b.y.toFixed(1)}" stroke="url(#lp-g-${mode})" marker-end="url(#lp-arrow-${mode})"></path>`;
  }).join('');
  const nodes = L.steps.map((s, i) => {
    const p = pt(-90 + i * step), on = i === active, r = on ? NR + 7 : NR;
    const words = s.label.split(' ');
    const text = words.length > 1
      ? `<text x="${p.x}" y="${p.y + 22}" text-anchor="middle"><tspan x="${p.x}">${esc(words[0])}</tspan><tspan x="${p.x}" dy="15">${esc(words.slice(1).join(' '))}</tspan></text>`
      : `<text x="${p.x}" y="${p.y + 30}" text-anchor="middle">${esc(s.label)}</text>`;
    return `<g class="lp-node${on ? ' on' : ''}" data-node="${i}" tabindex="0" role="button" aria-label="${esc(s.label)}, step ${i + 1} of ${n}" aria-pressed="${on}">
      ${on ? `<circle class="lp-halo" cx="${p.x}" cy="${p.y}" r="${r + 8}" fill="none" stroke="${L.glow}" stroke-width="2"></circle>` : ''}
      <circle class="lp-disc" cx="${p.x}" cy="${p.y}" r="${r}" fill="${on ? L.color : 'var(--paper, #fff)'}" stroke="${L.color}" stroke-width="2.5"></circle>
      <g class="lp-icon" transform="translate(${p.x - 18},${p.y - 44}) scale(1.5)" fill="none" stroke="${on ? '#fff' : L.color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICONS[s.icon]}</g>
      ${text}<text class="lp-num" x="${p.x}" y="${p.y - r - 9}" text-anchor="middle">${i + 1}</text></g>`;
  }).join('');
  const dot = reduceMotion ? '' :
    `<g><circle r="14" fill="${L.glow}" fill-opacity=".25"></circle><circle r="6" fill="${L.glow}"></circle>
      <animateMotion dur="${n * 2.6}s" repeatCount="indefinite" path="M${CX},${CY - R} a${R},${R} 0 1,1 0,${2 * R} a${R},${R} 0 1,1 0,${-2 * R}"></animateMotion></g>`;
  return `<svg viewBox="0 0 560 500" role="group" aria-label="${esc(L.title)}: ${n} steps in a loop">
    <defs>
      <linearGradient id="lp-g-${mode}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${L.color}"></stop><stop offset="1" stop-color="${L.glow}"></stop></linearGradient>
      <marker id="lp-arrow-${mode}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9 z" fill="${L.color}"></path></marker>
      <radialGradient id="lp-hub-${mode}"><stop offset="0" stop-color="${L.glow}" stop-opacity=".22"></stop><stop offset="1" stop-color="${L.glow}" stop-opacity="0"></stop></radialGradient>
    </defs>
    ${mandala(L.color)}
    <circle cx="${CX}" cy="${CY}" r="${R - 52}" fill="url(#lp-hub-${mode})"></circle>
    <text class="lp-title" x="${CX}" y="${CY - 2}" text-anchor="middle">${esc(L.title)}</text>
    <text class="lp-note" x="${CX}" y="${CY + 22}" text-anchor="middle">${esc(L.note)}</text>
    ${arcs}${dot}${nodes}</svg>`;
}

export function wireLoop(app: HTMLElement) {
  const wrap = app.querySelector<HTMLElement>('#loopWrap');
  if (!wrap) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mode: 'old' | 'new' = 'old', active = 0, timer = 0, fresh = true;
  const stop = () => { if (timer) { clearInterval(timer); timer = 0; } };

  const draw = () => {
    const L = LOOPS[mode], s = L.steps[active], n = L.steps.length;
    wrap.innerHTML = `<div class="loop lp${fresh ? ' lp-in' : ''}" data-loop="${mode}">${svgFor(mode, active, reduce)}</div>
      <div class="loopcard">
        <div class="toggle" role="group" aria-label="Which loop">
          <button data-mode="old" aria-pressed="${mode === 'old'}">The old loop</button>
          <button data-mode="new" aria-pressed="${mode === 'new'}">A new loop</button></div>
        <span class="eyebrow">Step ${active + 1} of ${n}</span>
        <h3 style="font-size:clamp(34px,4vw,50px)" aria-live="polite">${esc(s.label)}</h3>
        <p style="font-size:19px"><span class="d">${esc(s.text)}</span></p>
        <div class="loopnav"><button class="btn line" data-step="-1" ${active === 0 ? 'disabled' : ''}>Back</button>
          <button class="btn" data-step="1">${active === n - 1 ? 'Start again' : 'Next step'}</button>
          <button class="btn line" data-play="1">${timer ? 'Pause playing' : 'Play the loop'}</button></div>
        <p class="muted small">${mode === 'old' ? 'Tap each circle, then switch to “A new loop” to see where coaching focuses.' : 'The pause is where a new response can start. Tap each circle to follow the new loop.'}</p>
      </div>`;
    fresh = false;
    wrap.querySelectorAll<SVGGElement>('.lp-node').forEach(g => {
      const go = () => { stop(); active = Number(g.dataset.node); draw(); wrap.querySelector<SVGGElement>(`.lp-node[data-node="${active}"]`)?.focus({ preventScroll: true }); };
      g.addEventListener('click', go);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    wrap.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b => b.addEventListener('click', () => { stop(); mode = b.dataset.mode as 'old' | 'new'; active = 0; fresh = true; draw(); }));
    wrap.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(b => b.addEventListener('click', () => { stop(); active = (active + Number(b.dataset.step) + n) % n; draw(); }));
    wrap.querySelector<HTMLButtonElement>('[data-play]')!.addEventListener('click', () => {
      if (timer) { stop(); draw(); return; }
      timer = window.setInterval(() => { active = (active + 1) % LOOPS[mode].steps.length; draw(); }, 2600);
      draw();
    });
  };
  draw();
}
