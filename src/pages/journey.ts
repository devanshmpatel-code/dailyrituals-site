import { MOMENTS } from '../config';
import { esc } from '../ui';

// The home page as a journey. Scrolling is a day passing: a rail with a sun that travels from dawn to night, a map of all
// the chapters drawn as a mandala (drill out, then tap a petal to zoom back in), a breathing pause, soft reveals, mandala
// and ornaments behind chapter headings. Everything is decorative or navigational: no claims.

interface Stop { id: string; label: string; short: string; el: HTMLElement }
let cleanups: (() => void)[] = [];
export function unmountJourney() { cleanups.forEach(f => f()); cleanups = []; document.querySelectorAll('.jrail, .jmap, .jbreathe, .jbar, .jwash').forEach(n => n.remove()); document.body.classList.remove('has-journey'); }

const lerp = (a: string, b: string, t: number) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16); const c = (sh: number) => Math.round(((x >> sh) & 255) + ((((y >> sh) & 255) - ((x >> sh) & 255)) * t)); return `rgb(${c(16)},${c(8)},${c(0)})`; };
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rad = (d: number) => (d * Math.PI) / 180;
const P = (r: number, deg: number, c = 260) => `${(c + r * Math.cos(rad(deg))).toFixed(1)},${(c + r * Math.sin(rad(deg))).toFixed(1)}`;
const sector = (r0: number, r1: number, a0: number, a1: number) => `M${P(r1, a0)} A${r1},${r1} 0 0 1 ${P(r1, a1)} L${P(r0, a1)} A${r0},${r0} 0 0 0 ${P(r0, a0)} Z`;

export const MANDALA = `<svg class="jorn" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1">${
  Array.from({ length: 12 }, (_, i) => `<ellipse cx="60" cy="28" rx="7" ry="22" transform="rotate(${i * 30} 60 60)"/>`).join('')}<circle cx="60" cy="60" r="12"/><circle cx="60" cy="60" r="56" stroke-dasharray="1.5 5"/></g></svg>`;

/** A full-screen breathing pause that follows the time of day. Used by the journey rail and the calm button on every page. */
export function openBreathe(opener: HTMLElement) {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  const dist = (a: number, b: number) => { const x = Math.abs(a - b); return Math.min(x, 24 - x); };
  const m = MOMENTS.reduce((a, b) => (dist(b.hour, h) < dist(a.hour, h) ? b : a));
  const el = document.createElement('div'); el.className = `jbreathe${m.dark ? ' dark' : ''}`; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'A moment to breathe');
  el.style.background = `linear-gradient(160deg, ${m.sky[0]} 0%, ${m.sky[1]} 58%, ${m.sky[2]} 100%)`;
  el.innerHTML = `<div class="jb-stage" aria-hidden="true"><i class="jb-ring r1"></i><i class="jb-ring r2"></i><i class="jb-ring r3"></i><div class="jb-orb" style="--o:${m.orb}"></div></div>
    <p class="jb-word" id="jbWord" aria-live="polite">Take a moment</p><p class="jb-sub">Breathe in, hold, breathe out. Stay as long as you like.</p>
    <button class="btn jb-close">Done</button>`;
  document.body.append(el); requestAnimationFrame(() => el.classList.add('open'));
  const word = el.querySelector<HTMLElement>('#jbWord')!; const t0 = performance.now(); let raf = 0, last = '';
  const loop = () => { const t = (performance.now() - t0) % 12000; const w = performance.now() - t0 < 1200 ? 'Take a moment' : t < 4000 ? 'Breathe in' : t < 6000 ? 'Hold' : 'Breathe out'; if (w !== last) { word.textContent = w; last = w; } raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
  const close = () => { cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); el.classList.remove('open'); window.setTimeout(() => { el.remove(); opener.focus(); }, reduceMotion() ? 0 : 400); };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey); el.querySelector('.jb-close')!.addEventListener('click', close);
  (el.querySelector('.jb-close') as HTMLElement).focus();
}

export function mountJourney(app: HTMLElement) {
  unmountJourney();
  const stops: Stop[] = [];
  const hero = app.querySelector<HTMLElement>('#day');
  if (hero) stops.push({ id: 'day', label: 'Now: your opening', short: 'Now', el: hero });
  app.querySelectorAll<HTMLElement>('.chapter').forEach(c => {
    const sec = c.closest<HTMLElement>('section'); if (!sec || stops.some(s => s.el === sec)) return;
    const m = (c.textContent ?? '').match(/Chapter\s+(\d+)\s*[·:-]\s*(.+)/);
    stops.push({ id: `ch${m?.[1] ?? stops.length}`, label: m ? `${m[1]} · ${m[2].trim()}` : (c.textContent ?? '').trim(), short: m?.[2].trim() ?? '', el: sec });
  });
  if (stops.length < 3) return;
  document.body.classList.add('has-journey');

  // ---- ornaments: a mandala behind chapter headings
  app.querySelectorAll<HTMLElement>('.chapter').forEach(c => { const h = c.closest<HTMLElement>('.head') ?? c.parentElement; if (h && !h.querySelector(':scope > .jorn')) { h.classList.add('jhead'); h.insertAdjacentHTML('afterbegin', MANDALA); } });

  // ---- soft reveals (content is visible by default; only things below the fold are eased in)
  if (!reduceMotion() && 'IntersectionObserver' in window) {
    const targets = [...app.querySelectorAll<HTMLElement>('section > .wrap > *, section > .head, .moment-shop > .wrap > *, .proof-strip')]
      .filter(el => !hero?.contains(el) && el.getBoundingClientRect().top > window.innerHeight * 0.9);
    targets.forEach(t => t.setAttribute('data-reveal', ''));
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { (e.target as HTMLElement).classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });
    targets.forEach(t => io.observe(t));
    cleanups.push(() => { io.disconnect(); app.querySelectorAll('[data-reveal]').forEach(t => { t.removeAttribute('data-reveal'); t.classList.remove('in'); }); });
  }

  // ---- the rail
  const n = stops.length;
  const rail = document.createElement('nav'); rail.className = 'jrail'; rail.setAttribute('aria-label', 'Journey through the page');
  rail.innerHTML = `<button class="jbtn" data-jmap aria-label="Open the journey map" title="Journey map"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg></button>
    <div class="jtrack" role="list">${stops.map((s, i) => `<button class="jstop" role="listitem" style="top:${(i / (n - 1)) * 100}%" data-stop="${i}" aria-label="${esc(s.label)}" title="${esc(s.label)}"></button>`).join('')}
      <span class="jmark" aria-hidden="true"></span><span class="jpill" aria-live="polite"></span></div>
    <button class="jbtn" data-jbreathe aria-label="Take a breath" title="Take a breath"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M12 20c-4 0-8-3-9-9 4 0 7 2 9 5 2-3 5-5 9-5-1 6-5 9-9 9z"/><path d="M12 16c-2-3-2-7 0-11 2 4 2 8 0 11z"/></svg></button>`;
  const bar = document.createElement('div'); bar.className = 'jbar'; bar.setAttribute('aria-hidden', 'true'); bar.innerHTML = '<i></i>';
  const wash = document.createElement('div'); wash.className = 'jwash'; wash.setAttribute('aria-hidden', 'true');
  document.body.append(rail, bar, wash);

  const goTo = (i: number, instant = false) => stops[i].el.scrollIntoView({ behavior: instant || reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  rail.querySelectorAll<HTMLButtonElement>('[data-stop]').forEach(b => b.addEventListener('click', () => goTo(Number(b.dataset.stop))));

  const mark = rail.querySelector<HTMLElement>('.jmark')!, pill = rail.querySelector<HTMLElement>('.jpill')!;
  let cur = 0, ticking = false, pillTimer = 0;
  const update = () => {
    ticking = false;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const prog = Math.min(1, Math.max(0, window.scrollY / max));
    mark.style.top = `${prog * 100}%`;
    const moment = MOMENTS[Math.min(MOMENTS.length - 1, Math.floor(prog * MOMENTS.length))];
    mark.style.setProperty('--jc', moment.orb); mark.dataset.night = String(moment.dark);
    (bar.firstElementChild as HTMLElement).style.transform = `scaleX(${prog})`;
    // the whole page takes on the colour of the hour as you scroll, and the opening's landscape drifts as you leave it
    const f = prog * (MOMENTS.length - 1), i0 = Math.floor(f), i1 = Math.min(MOMENTS.length - 1, i0 + 1), t = f - i0;
    wash.style.setProperty('--w0', lerp(MOMENTS[i0].sky[0], MOMENTS[i1].sky[0], t)); wash.style.setProperty('--w1', lerp(MOMENTS[i0].sky[1], MOMENTS[i1].sky[1], t));
    if (hero) hero.style.setProperty('--p', String(Math.min(1, window.scrollY / Math.max(1, hero.offsetHeight))));
    let idx = 0; stops.forEach((s, i) => { if (s.el.getBoundingClientRect().top < window.innerHeight * 0.42) idx = i; });
    if (idx !== cur) {
      cur = idx; pill.textContent = stops[idx].label; pill.classList.add('on');
      window.clearTimeout(pillTimer); pillTimer = window.setTimeout(() => pill.classList.remove('on'), 2400);
      rail.querySelectorAll('.jstop').forEach((s, i) => { s.classList.toggle('past', i < idx); s.classList.toggle('now', i === idx); });
      document.querySelector('.jmap')?.dispatchEvent(new CustomEvent('jstop', { detail: idx }));
    }
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll);
  cleanups.push(() => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); window.clearTimeout(pillTimer); });
  rail.querySelector('.jstop')?.classList.add('now'); update();

  // ---- the map: drill out to all chapters, tap a petal to zoom back in
  const openMap = (opener: HTMLElement) => {
    const el = document.createElement('div'); el.className = 'jmap'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Journey map');
    const step = 360 / n;
    const wedges = stops.map((s, i) => { const a0 = -90 + i * step + 1.4, a1 = -90 + (i + 1) * step - 1.4, mid = (a0 + a1) / 2; const [tx, ty] = P(146, mid).split(',');
      return `<g class="jw" data-stop="${i}" tabindex="0" role="button" aria-label="${esc(s.label)}"><path d="${sector(76, 214, a0, a1)}"/><text x="${tx}" y="${ty}" text-anchor="middle" dy="8">${i === 0 ? 'Now' : i}</text></g>`; }).join('');
    const petals = Array.from({ length: 12 }, (_, i) => `<ellipse cx="260" cy="${260 - 232}" rx="14" ry="26" transform="rotate(${i * 30} 260 260)"/>`).join('');
    el.innerHTML = `<div class="jpanel"><button class="jclose" aria-label="Close the map">Close</button>
      <div class="jgrid"><svg viewBox="0 0 520 520" role="group" aria-label="Chapters of the journey"><g class="jpet" fill="none" stroke="currentColor" stroke-opacity=".16">${petals}<circle cx="260" cy="260" r="246" stroke-dasharray="2 8"/></g>${wedges}
        <circle cx="260" cy="260" r="64" class="jhub"/><text x="260" y="256" text-anchor="middle" class="jhub-t">You are</text><text x="260" y="278" text-anchor="middle" class="jhub-t jhub-i">here</text></svg>
        <div class="jlist"><span class="eyebrow">The journey</span><h2>Zoom out, then pick a <span class="it">chapter</span></h2>
          <ol>${stops.map((s, i) => `<li><button data-stop="${i}"><span class="mono">${i === 0 ? 'Now' : String(i).padStart(2, '0')}</span>${esc(s.short || s.label)}</button></li>`).join('')}</ol></div></div></div>`;
    document.body.append(el);
    const mark2 = (i: number) => { el.querySelectorAll('.jw').forEach((w, k) => { w.classList.toggle('here', k === i); w.classList.toggle('seen', k < i); }); el.querySelectorAll('.jlist li button').forEach((b, k) => b.classList.toggle('here', k === i)); };
    mark2(cur); el.addEventListener('jstop', e => mark2((e as CustomEvent).detail));
    requestAnimationFrame(() => el.classList.add('open'));
    const close = (after?: () => void) => { el.classList.add(after ? 'zoom' : 'leave'); el.classList.remove('open'); document.removeEventListener('keydown', onKey); window.setTimeout(() => { el.remove(); if (!after) opener.focus(); after?.(); }, reduceMotion() ? 0 : 380); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    el.querySelector('.jclose')!.addEventListener('click', () => close());
    el.addEventListener('click', e => { if (e.target === el) close(); });
    el.querySelectorAll<HTMLElement>('[data-stop]').forEach(b => {
      const pick = () => { const i = Number(b.dataset.stop); close(() => goTo(i)); };
      b.addEventListener('click', pick); b.addEventListener('keydown', e => { if ((e as KeyboardEvent).key === 'Enter' || (e as KeyboardEvent).key === ' ') { e.preventDefault(); pick(); } });
      b.addEventListener('mouseenter', () => mark2(Number(b.dataset.stop))); b.addEventListener('focus', () => mark2(Number(b.dataset.stop)));
    });
    (el.querySelector('.jlist li button.here') as HTMLElement | null)?.focus();
  };

  rail.querySelector<HTMLElement>('[data-jmap]')!.addEventListener('click', e => openMap(e.currentTarget as HTMLElement));
  rail.querySelector<HTMLElement>('[data-jbreathe]')!.addEventListener('click', e => openBreathe(e.currentTarget as HTMLElement));
}
