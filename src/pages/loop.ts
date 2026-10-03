import { esc } from '../ui';

// "Why patterns repeat": a filmstrip of arch-shaped photo windows, one per step, joined by arrows with a
// dashed return path. The old loop is muted and has three steps; the new loop is in colour and adds a pause.
// Explanatory text is placeholder copy for Claire (class "d").
type Step = { label: string; text: string; img: string };
const LOOPS: Record<'old' | 'new', { title: string; tag: string; repeat: string; steps: Step[] }> = {
  old: {
    title: 'The old loop', tag: 'Runs on autopilot', repeat: '…and it repeats',
    steps: [
      { label: 'Cue', text: 'A familiar trigger: a smell, a deadline, a crowded room.', img: '/img/morning.jpg' },
      { label: 'Automatic response', text: 'The usual reaction fires before you have chosen it.', img: '/img/midday.jpg' },
      { label: 'Short-term relief', text: 'It eases the moment, which teaches the loop to repeat.', img: '/img/book.jpg' },
    ],
  },
  new: {
    title: 'A new loop', tag: 'A small pause changes the path', repeat: '…and it gets easier',
    steps: [
      { label: 'Cue', text: 'The same trigger shows up. Noticing it is the first step.', img: '/img/morning.jpg' },
      { label: 'Pause', text: 'A small, practised pause. This is where coaching focuses.', img: '/img/coaching.jpg' },
      { label: 'Chosen response', text: 'You try a different response, one small step at a time.', img: '/img/midday.jpg' },
      { label: 'Steadier result', text: 'Repeated daily, the new response gets easier.', img: '/img/evening.jpg' },
    ],
  },
};

export function wireLoop(app: HTMLElement) {
  const wrap = app.querySelector<HTMLElement>('#loopWrap');
  if (!wrap) return;
  wrap.classList.add('loopfilm');
  let mode: 'old' | 'new' = 'old', active = 0, timer = 0;
  const stop = () => { if (timer) { clearInterval(timer); timer = 0; } };

  const draw = () => {
    const L = LOOPS[mode], s = L.steps[active], n = L.steps.length;
    wrap.dataset.loop = mode;
    wrap.style.setProperty('--n', String(n));
    wrap.innerHTML = `
      <div class="lhead"><div class="toggle" role="group" aria-label="Which loop">
          <button data-mode="old" aria-pressed="${mode === 'old'}">The old loop</button>
          <button data-mode="new" aria-pressed="${mode === 'new'}">A new loop</button></div>
        <span class="ltag">${esc(L.tag)}</span></div>
      <ol class="lstrip" aria-label="${esc(L.title)}, ${n} steps">${L.steps.map((st, i) => `
        <li class="lcell"><button class="lcard${i === active ? ' on' : ''}${st.label === 'Pause' ? ' pause' : ''}" data-node="${i}" aria-label="${esc(st.label)}, step ${i + 1} of ${n}" aria-pressed="${i === active}">
          <span class="lwin"><img src="${st.img}" alt="" loading="lazy"><span class="lnum">${i + 1}</span></span>
          <span class="lname">${esc(st.label)}</span></button></li>`).join('')}</ol>
      <div class="lreturn" aria-hidden="true"><span>${esc(L.repeat)}</span></div>
      <div class="lbody">
        <div><span class="eyebrow">Step ${active + 1} of ${n}</span>
          <h3 aria-live="polite">${esc(s.label)}</h3>
          <p class="lcopy"><span class="d">${esc(s.text)}</span></p></div>
        <div class="loopnav"><button class="btn line" data-step="-1" ${active === 0 ? 'disabled' : ''}>Back</button>
          <button class="btn" data-step="1">${active === n - 1 ? 'Start again' : 'Next step'}</button>
          <button class="btn line" data-play="1">${timer ? 'Pause playing' : 'Play the loop'}</button></div>
      </div>
      <p class="muted small lhint">${mode === 'old' ? 'Tap each window, then switch to “A new loop” to see where coaching focuses.' : 'The pause is where a new response can start. Tap each window to follow the new loop.'}</p>`;
    wrap.querySelectorAll<HTMLButtonElement>('.lcard').forEach(c => c.addEventListener('click', () => { stop(); active = Number(c.dataset.node); draw(); wrap.querySelector<HTMLElement>(`.lcard[data-node="${active}"]`)?.focus({ preventScroll: true }); }));
    wrap.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(b => b.addEventListener('click', () => { stop(); mode = b.dataset.mode as 'old' | 'new'; active = 0; draw(); }));
    wrap.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(b => b.addEventListener('click', () => { stop(); active = (active + Number(b.dataset.step) + n) % n; draw(); }));
    wrap.querySelector<HTMLButtonElement>('[data-play]')!.addEventListener('click', () => {
      if (timer) { stop(); draw(); return; }
      timer = window.setInterval(() => { active = (active + 1) % LOOPS[mode].steps.length; draw(); }, 2600);
      draw();
    });
    wrap.querySelector<HTMLElement>('.lcard.on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  };
  draw();
}
