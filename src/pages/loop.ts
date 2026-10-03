import { esc } from '../ui';

// "Why patterns repeat": an interactive loop. The old loop has three steps; the new loop adds a pause.
// All explanatory text is placeholder copy for Claire (class "d"), written to match the page's own wording.
type Step = { label: string; text: string };
const LOOPS: Record<'old' | 'new', { title: string; note: string; color: string; steps: Step[] }> = {
  old: {
    title: 'The old loop', note: 'Runs on autopilot', color: '#9C6B45',
    steps: [
      { label: 'Cue', text: 'A familiar trigger: a smell, a deadline, a crowded room.' },
      { label: 'Automatic response', text: 'The usual reaction fires before you have chosen it.' },
      { label: 'Short-term relief', text: 'It eases the moment, which teaches the loop to repeat.' },
    ],
  },
  new: {
    title: 'A new loop', note: 'A small pause changes the path', color: '#2F5249',
    steps: [
      { label: 'Cue', text: 'The same trigger shows up. Noticing it is the first step.' },
      { label: 'Pause', text: 'A small, practised pause. This is where coaching focuses.' },
      { label: 'Chosen response', text: 'You try a different response, one small step at a time.' },
      { label: 'Steadier result', text: 'Repeated daily, the new response gets easier.' },
    ],
  },
};

const CX = 260, CY = 235, R = 165, NR = 56;
const rad = (d: number) => (d * Math.PI) / 180;
const pt = (deg: number) => ({ x: CX + R * Math.cos(rad(deg)), y: CY + R * Math.sin(rad(deg)) });

function svgFor(mode: 'old' | 'new', active: number, reduceMotion: boolean): string {
  const L = LOOPS[mode], n = L.steps.length, step = 360 / n;
  const gap = 2 * Math.asin(NR / (2 * R)) * (180 / Math.PI) + 5; // keep arcs clear of the node circles
  const arcs = L.steps.map((_, i) => {
    const a = pt(-90 + i * step + gap), b = pt(-90 + (i + 1) * step - gap);
    return `<path class="larc" d="M${a.x.toFixed(1)},${a.y.toFixed(1)} A${R},${R} 0 0 1 ${b.x.toFixed(1)},${b.y.toFixed(1)}" stroke="${L.color}" marker-end="url(#arrow-${mode})"${i === active ? ' opacity="1"' : ' opacity=".5"'}></path>`;
  }).join('');
  const nodes = L.steps.map((s, i) => {
    const p = pt(-90 + i * step), on = i === active;
    const words = s.label.split(' ');
    const text = words.length > 1
      ? `<text x="${p.x}" y="${p.y + 4}" text-anchor="middle"><tspan x="${p.x}" dy="-6">${esc(words[0])}</tspan><tspan x="${p.x}" dy="17">${esc(words.slice(1).join(' '))}</tspan></text>`
      : `<text x="${p.x}" y="${p.y + 5}" text-anchor="middle">${esc(s.label)}</text>`;
    return `<g class="lnode${on ? ' on' : ''}" data-node="${i}" tabindex="0" role="button" aria-label="${esc(s.label)}, step ${i + 1} of ${n}" aria-pressed="${on}">
      <circle cx="${p.x}" cy="${p.y}" r="${on ? NR + 4 : NR}" fill="${on ? L.color : 'var(--paper, #fff)'}" stroke="${L.color}" stroke-width="2.5"></circle>
      <circle cx="${p.x}" cy="${p.y - NR + 2}" r="0" fill="none"></circle>${text}
      <text class="lnum" x="${p.x}" y="${p.y - NR - 8}" text-anchor="middle">${i + 1}</text></g>`;
  }).join('');
  const dot = reduceMotion ? '' :
    `<circle r="6" fill="var(--gold, #E8A957)"><animateMotion dur="${n * 2.4}s" repeatCount="indefinite" path="M${CX},${CY - R} a${R},${R} 0 1,1 0,${2 * R} a${R},${R} 0 1,1 0,${-2 * R}"></animateMotion></circle>`;
  return `<svg viewBox="0 0 520 470" role="group" aria-label="${esc(L.title)}: ${n} steps in a loop">
    <defs><marker id="arrow-${mode}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1,1 L9,5 L1,9 z" fill="${L.color}"></path></marker></defs>
    <circle cx="${CX}" cy="${CY}" r="${R - 58}" fill="${mode === 'new' ? 'var(--euc-2, #E1EAE5)' : 'var(--sand, #EFE6D8)'}"></circle>
    <text class="lcenter" x="${CX}" y="${CY - 4}" text-anchor="middle">${esc(L.title)}</text>
    <text class="lnote" x="${CX}" y="${CY + 20}" text-anchor="middle">${esc(L.note)}</text>
    ${arcs}${dot}${nodes}</svg>`;
}

export function wireLoop(app: HTMLElement) {
  const wrap = app.querySelector<HTMLElement>('#loopWrap');
  if (!wrap) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let mode: 'old' | 'new' = 'old', active = 0;

  const draw = () => {
    const L = LOOPS[mode], s = L.steps[active], n = L.steps.length;
    wrap.innerHTML = `<div class="loop">${svgFor(mode, active, reduce)}</div>
      <div class="loopcard">
        <div class="toggle" role="group" aria-label="Which loop">
          <button data-mode="old" aria-pressed="${mode === 'old'}">The old loop</button>
          <button data-mode="new" aria-pressed="${mode === 'new'}">A new loop</button></div>
        <span class="eyebrow">Step ${active + 1} of ${n}</span>
        <h3 style="font-size:clamp(34px,4vw,50px)" aria-live="polite">${esc(s.label)}</h3>
        <p style="font-size:19px"><span class="d">${esc(s.text)}</span></p>
        <div class="loopnav"><button class="btn line" data-step="-1" ${active === 0 ? 'disabled' : ''}>Back</button>
          <button class="btn" data-step="1">${active === n - 1 ? 'Start again' : 'Next step'}</button></div>
        <p class="muted small">${mode === 'old' ? 'Tap each circle, then switch to “A new loop” to see where coaching focuses.' : 'The pause is where a new response can start. Tap each circle to follow the new loop.'}</p>
      </div>`;
    wrap.querySelectorAll<SVGGElement>('.lnode').forEach(g => {
      const go = () => { active = Number(g.dataset.node); draw(); wrap.querySelector<SVGGElement>(`.lnode[data-node="${active}"]`)?.focus(); };
      g.addEventListener('click', go);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    wrap.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode as 'old' | 'new'; active = 0; draw(); }));
    wrap.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(b => b.addEventListener('click', () => {
      const n2 = LOOPS[mode].steps.length; active = (active + Number(b.dataset.step) + n2) % n2; draw();
    }));
  };
  draw();
}
