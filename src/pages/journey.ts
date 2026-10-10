import { MOMENTS, type MomentKey } from '../config';
import { esc } from '../ui';
import '../moonbreath.css';
import { ornament } from './symbols';

// The home page as a journey. Scrolling is a day passing: a rail with a sun that travels from dawn to night, a map of all
// the chapters drawn as a mandala (drill out, then tap a petal to zoom back in), a breathing pause, soft reveals, mandala
// and ornaments behind chapter headings. Everything is decorative or navigational: no claims.

interface Stop { id: string; label: string; short: string; el: HTMLElement }
let cleanups: (() => void)[] = [];
export function unmountJourney() { cleanups.forEach(f => f()); cleanups = []; document.querySelectorAll('.jrail, .jmap, .jbreathe, .jbar, .jwash, .jaur, .jhere').forEach(n => n.remove()); document.body.classList.remove('has-journey'); }

const lerp = (a: string, b: string, t: number) => { const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16); const c = (sh: number) => Math.round(((x >> sh) & 255) + ((((y >> sh) & 255) - ((x >> sh) & 255)) * t)); return `rgb(${c(16)},${c(8)},${c(0)})`; };
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rad = (d: number) => (d * Math.PI) / 180;
const P = (r: number, deg: number, c = 260) => `${(c + r * Math.cos(rad(deg))).toFixed(1)},${(c + r * Math.sin(rad(deg))).toFixed(1)}`;
const sector = (r0: number, r1: number, a0: number, a1: number) => `M${P(r1, a0)} A${r1},${r1} 0 0 1 ${P(r1, a1)} L${P(r0, a1)} A${r0},${r0} 0 0 0 ${P(r0, a0)} Z`;


// ======================================================================
// The Moon Breath: one minute, one lunar cycle. A night sky, one of Claire's real candles seen from above as a moon
// (public/img/studio/moons: white wax in a black tin, toppings in a crescent along the rim), a shadow disc that slides
// away as you breathe in (the moon waxes; at full the wooden wick lights) and back as you breathe out (it wanes; the flame
// rests to an ember). Six breaths of 4 in / 6 out make one cycle; eight moon-phase marks fill in as you go. Afterwards a
// calm card names the candle with Claire's own words and points at the candle range (these pours are past or seasonal,
// so nothing here is offered for sale). Styles: src/moonbreath.css. Test hooks kept: .jbreathe(.open), #jbWord, .jb-close.
// ======================================================================

/**
 * The candles that have a moon photo, with Claire's exact words for each (her Instagram captions; "…" marks a cut-off).
 * side: where the crescent of toppings sits in the photo; the light reaches that rim first (waxing from the right by default).
 */
const MOON_CANDLES: { slug: string; name: string; words: string; side?: 'left' }[] = [
  { slug: 'lavender-haze', name: 'Lavender Haze', words: 'The Queen of scents, Lavender, is married with French Vanilla to bring you into a dreamy Lavender Haze' },
  { slug: 'sea-salt-sage', name: 'Sea Salt & Sage', words: 'with notes of lime, crisp green melon, warm sandalwood, sage, ocean lily, and sea salt', side: 'left' },
  { slug: 'spring-blooms', name: 'Spring Blooms', words: 'Step into that fresh April morning, sun is shining, and what do you smell? Spring Blooms of course!' },
  { slug: 'jarrah', name: 'Jarrah', words: 'named after the gorgeous Jarrah trees in Australia. Sweet, fragrant, & woodsy' },
  { slug: 'tuscan-sandalwood', name: 'Tuscan Sandalwood', words: 'will transport you to the rolling hills and forests of Tuscany' },
  { slug: 'midnight-forest', name: 'Midnight Forest', words: 'my personal fave and might become yours too if you love all things woodsy' },
  { slug: 'mothers-garden', name: "Mother's Garden", words: "Introducing Mother's Garden" },
  { slug: 'sweet-romance', name: 'Sweet Romance', words: "just in time for Valentine's Day. With notes of cedar, ylang ylang, jasmine, & bergamot." },
  { slug: 'irish-coffee', name: 'Irish Coffee', words: "for when that hit of coffee just isn't quite doing the trick" },
  { slug: 'hello-cupcake', name: 'Hello Cupcake', words: "smells exactly like you'd think: a sweet vanilla cupcake with butter cream frosting" },
  { slug: 'easter-bread', name: 'Easter Bread', words: 'Some call it Easter Bread, some call it Paska' },
  { slug: 'apple-cider', name: 'Cozy Apple Cider', words: '', side: 'left' },
  { slug: 'mulled-wine', name: 'Mulled Wine', words: 'will have you dreaming of Christmas & cozy nights by the fire. With notes of balsam fir, citrus, cinn…', side: 'left' },
  { slug: 'christmas-eve', name: 'Christmas Eve', words: 'I call this one Christmas Eve', side: 'left' },
  { slug: 'candy-cane-lane', name: 'Candy Cane Lane', words: 'with notes of peppermint, …' },
];
/**
 * Which moon for which hour. DRAFT FOR CLAIRE: a first pairing of her pours with the site's five moments of the day
 * (dawn, morning, midday, golden hour, night); she may prefer others. "Another moon" cycles through the rest of the list.
 */
const MOON_BY_MOMENT: Record<MomentKey, string> = { dawn: 'sea-salt-sage', morning: 'spring-blooms', midday: 'jarrah', golden: 'tuscan-sandalwood', night: 'lavender-haze' };
/** Six breaths of 4 in, 6 out make one cycle. "?breath=fast" (tests only) shortens every timing tenfold; nothing else reads it. */
const BREATHS = 6;
const moonUrl = (slug: string) => `/img/studio/moons/${slug}.webp`;
const smooth = (t: number) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
/** The lit part of a moon at phase k (0 new, .5 full), drawn as the site's engraved moons are (see src/celestial.ts). */
function litPath(x: number, y: number, r: number, k: number) {
  if (k < 0.02 || k > 0.98) return '';
  if (Math.abs(k - 0.5) < 0.02) return `M${x},${y - r}A${r},${r} 0 1 1 ${x},${y + r}A${r},${r} 0 1 1 ${x},${y - r}Z`;
  const c = Math.cos(2 * Math.PI * k), rx = Math.max(0.2, r * Math.abs(c)).toFixed(2), wax = k < 0.5;
  return `M${x},${y - r}A${r},${r} 0 0 ${wax ? 1 : 0} ${x},${y + r}A${rx},${r} 0 0 ${wax ? (c > 0 ? 0 : 1) : (c > 0 ? 1 : 0)} ${x},${y - r}Z`;
}
const phaseMark = (i: number) => `<svg class="mp" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6.5"/><path d="${litPath(8, 8, 6.5, i / 8)}"/></svg>`;
const phaseRow = () => Array.from({ length: 8 }, (_, i) => phaseMark(i)).join('');
const MOON_GLYPH = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true" focusable="false"><path d="M10.5 2.2a6 6 0 1 0 3.3 8.6 4.6 4.6 0 0 1-3.3-8.6z"/></svg>';
/** A starfield that leaves the middle (where the moon is) clear: three layers that twinkle at their own pace (three animations, not eighty). Deterministic, so screenshots compare. */
function starfield() {
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const layers: string[][] = [[], [], []];
  for (let i = 0; i < 84; i++) {
    const x = rnd() * 1000, y = rnd() * 1000, dx = x - 500, dy = y - 520, r = (0.5 + rnd() * 1.3).toFixed(2);
    if (dx * dx + dy * dy < 250 * 250) continue;
    layers[i % 3].push(`<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r}"/>`);
  }
  return layers.map((l, i) => `<svg class="tw tw${i + 1}" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${l.join('')}</svg>`).join('');
}

/** The one-minute breathing pause (the Moon Breath). Opened by the breathing orb on every page and by [data-breathe] buttons. */
export function openBreathe(opener: HTMLElement) {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  const dist = (a: number, b: number) => { const x = Math.abs(a - b); return Math.min(x, 24 - x); };
  const m = MOMENTS.reduce((a, b) => (dist(b.hour, h) < dist(a.hour, h) ? b : a));
  const q = new URLSearchParams(location.search.replace(/^\?/, '') + '&' + (location.hash.split('?')[1] ?? ''));
  const speed = q.get('breath') === 'fast' ? 0.1 : 1;
  const IN = 4000 * speed, OUT = 6000 * speed, LEAD = 1100 * speed, BREATH = IN + OUT, CYCLE = BREATHS * BREATH;
  const reduce = reduceMotion();
  let idx = Math.max(0, MOON_CANDLES.findIndex(c => c.slug === (q.get('moon') ?? MOON_BY_MOMENT[m.key])));
  const candle = () => MOON_CANDLES[idx];

  const el = document.createElement('div'); el.className = 'jbreathe mb'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'The Moon Breath: a one-minute pause');
  el.innerHTML = `<div class="mb-sky" aria-hidden="true">${starfield()}</div><div class="mb-glow" aria-hidden="true"></div>
    <div class="mb-top" aria-hidden="true"><span>The Moon Breath</span></div>
    <div class="mb-text"><p class="mb-eyebrow" id="mbEyebrow"></p><p class="jb-word" id="jbWord" aria-live="polite">Take a moment</p><p class="mb-sub">4 in, 6 out. Six breaths make one moon.</p></div>
    <div class="mb-stage" aria-hidden="true">
      <svg class="mb-orbits" viewBox="0 0 200 200" focusable="false"><circle class="o1" cx="100" cy="100" r="66"/><circle class="o2" cx="100" cy="100" r="78"/><circle class="o3" cx="100" cy="100" r="94"/><circle class="o-pt" cx="100" cy="34" r="1.2"/><circle class="o-pt" cx="166" cy="100" r=".9"/></svg>
      <div class="mb-halo"></div>
      <div class="mb-moon"><img class="mb-img" alt="" decoding="async" draggable="false"><div class="mb-shadow"></div>
        <div class="mb-flame"><i class="mb-wax"></i><i class="mb-ember"></i><i class="mb-fl"></i></div></div>
    </div>
    <div class="mb-phases" aria-hidden="true">${phaseRow()}</div>
    <p class="mb-sr" id="mbProgress" aria-live="polite"></p>
    <div class="mb-bar"><button type="button" class="mb-another">${MOON_GLYPH}<span>Another moon</span></button><button type="button" class="jb-close">Close</button></div>
    <div class="mb-end" hidden></div>`;
  document.body.append(el); requestAnimationFrame(() => el.classList.add('open'));
  document.documentElement.classList.add('mb-lock');

  const $ = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const word = $('#jbWord'), eyebrow = $('#mbEyebrow'), img = $<HTMLImageElement>('.mb-img'), progress = $('#mbProgress'), end = $('.mb-end'), stage = $('.mb-stage'), glow = $('.mb-glow');
  const phases = [...el.querySelectorAll<SVGElement>('.mb-phases .mp')];
  // only the chosen moon is loaded (one request); it fades in once decoded
  const setMoon = () => {
    const c = candle(); el.dataset.moon = c.slug; eyebrow.textContent = `${c.name} · one moon, one minute`;
    stage.style.setProperty('--dir', c.side === 'left' ? '-1' : '1');
    img.classList.remove('ok'); img.src = moonUrl(c.slug);
    const show = () => { if (el.isConnected && el.dataset.moon === c.slug) img.classList.add('ok'); };
    img.decode().then(show, show);
  };
  setMoon();

  // ---- the loop: one rAF; transforms and opacity only, and the per-frame values live on the stage so the sky is never restyled.
  // With reduced motion only the words and the marks change.
  const set = (k: number, fl: number, em: number, rot = 0) => { const s = stage.style; s.setProperty('--k', k.toFixed(4)); s.setProperty('--fl', fl.toFixed(3)); s.setProperty('--em', em.toFixed(3)); s.setProperty('--rot', `${rot.toFixed(3)}deg`); glow.style.opacity = (fl * 0.9).toFixed(3); };
  let raf = 0, t0 = performance.now(), lastWord = '', lastLit = -1, lit = false, done = false;
  const say = (w: string) => { if (w === lastWord) return; lastWord = w; word.textContent = w; if (!reduce) { word.style.animation = 'none'; void word.offsetWidth; word.style.animation = ''; } };
  const frame = (now: number) => {
    const t = now - t0 - LEAD;
    if (t < 0) { raf = requestAnimationFrame(frame); return; }
    if (t >= CYCLE) { finish(); return; }
    const n = Math.floor(t / BREATH), u = t - n * BREATH, inhale = u < IN;
    const k = inhale ? smooth(u / IN) : 1 - smooth((u - IN) / OUT);
    say(inhale ? 'Breathe in' : 'Breathe out');
    if (inhale && k > 0.985) lit = true;
    if (!reduce) {
      // the flame blooms as the moon reaches full and rests to an ember on the way out; once lit, the ember stays
      const fl = inhale ? smooth((k - 0.8) / 0.2) : smooth((k - 0.35) / 0.65) * 0.9 + 0.1 * k;
      set(k, fl, lit ? 1 - fl : 0, t / BREATH);
    }
    const litN = Math.min(8, Math.floor((t / CYCLE) * 8) + 1);
    if (litN !== lastLit) { lastLit = litN; phases.forEach((p, i) => { p.classList.toggle('on', i < litN); p.classList.toggle('now', i === litN - 1); }); progress.textContent = `Breath ${n + 1} of ${BREATHS}`; }
    raf = requestAnimationFrame(frame);
  };
  const start = () => {
    cancelAnimationFrame(raf); t0 = performance.now(); lastWord = ''; lastLit = -1; lit = false; done = false;
    el.classList.remove('done'); end.hidden = true; end.innerHTML = ''; say('Take a moment');
    if (!reduce) set(0, 0, 0);
    raf = requestAnimationFrame(frame);
  };

  // ---- the ending: a calm card with the candle's name and Claire's words. The range, not this pour, is what the shop sells.
  const finish = () => {
    done = true; cancelAnimationFrame(raf);
    if (!reduce) set(0.12, 0, 1);
    phases.forEach(p => { p.classList.add('on'); p.classList.remove('now'); });
    const c = candle();
    end.innerHTML = `<p class="mb-eyebrow"><span class="d">One moon, one minute.</span></p><h2>${esc(c.name)}</h2>
      ${c.words ? `<p class="mb-q">“${esc(c.words)}”</p><p class="mb-who">Claire’s words</p>` : '<p class="mb-who">One of Claire’s pours</p>'}
      <div class="mb-phases" aria-hidden="true">${phaseRow()}</div>
      <p class="mb-note"><span class="d">A past pour from the studio in White Rock. Every candle is topped by hand, with a wooden wick, in a matte black tin.</span></p>
      <div class="mb-links"><a class="mb-primary" href="#/shop?f=candle">See the candles</a><a class="mb-link" href="#/drops">Read about past moons</a><a class="mb-link quiet" href="#/reset">Or try Claire’s free 7-day reset</a><button type="button" class="mb-again">Breathe again</button></div>`;
    end.hidden = false; el.classList.add('done');
    word.textContent = ''; progress.textContent = 'One moon, one minute. The pause is over.';
    end.querySelector<HTMLElement>('.mb-again')!.addEventListener('click', start);
    end.querySelectorAll('a').forEach(a => a.addEventListener('click', () => close()));
    end.querySelector<HTMLElement>('.mb-primary')!.focus();
  };

  // ---- another moon: the next candle in the list (only that image is loaded)
  $('.mb-another').addEventListener('click', () => { idx = (idx + 1) % MOON_CANDLES.length; setMoon(); if (done) finish(); });

  // ---- close: the button, Escape or a link out. Focus returns to the opener and everything stops.
  const close = () => {
    cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); document.documentElement.classList.remove('mb-lock');
    el.classList.remove('open'); window.setTimeout(() => { el.remove(); opener.focus(); }, reduce ? 0 : 400);
  };
  const focusables = () => [...el.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')].filter(x => x.getClientRects().length > 0);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables(); if (!f.length) return;
    const first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (e.shiftKey && (a === first || !el.contains(a))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (a === last || !el.contains(a))) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', onKey); $('.jb-close').addEventListener('click', close);
  $('.jb-close').focus();
  start();
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
  app.querySelectorAll<HTMLElement>('.chapter').forEach((c, i) => { const h = c.closest<HTMLElement>('.head') ?? c.parentElement; if (h && !h.querySelector(':scope > .jorn')) { h.classList.add('jhead'); h.insertAdjacentHTML('afterbegin', ornament(i)); } });

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
  const here = document.createElement('button'); here.type = 'button'; here.className = 'jhere'; here.setAttribute('aria-label', 'You are here. Go to the next chapter');
  here.innerHTML = '<svg class="jh-ring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19" class="bg"/><circle cx="22" cy="22" r="19" class="fg"/></svg><b class="jh-n"></b><span class="jh-w"><small class="jh-k"></small><strong class="jh-t"></strong><em class="jh-x"></em></span>';
  const aur = document.createElement('div'); aur.className = 'jaur'; aur.setAttribute('aria-hidden', 'true'); aur.innerHTML = '<i></i><i></i><i></i>';
  // the side rail (map button and stops) is no longer shown: the "you are here" card does that job
  document.body.append(bar, wash, aur, here);
  here.addEventListener('click', () => { const k = here.dataset.next; if (k !== undefined && k !== '') goTo(Number(k)); else window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' }); });

  const goTo = (i: number, instant = false) => stops[i].el.scrollIntoView({ behavior: instant || reduceMotion() ? 'auto' : 'smooth', block: 'start' });
  rail.querySelectorAll<HTMLButtonElement>('[data-stop]').forEach(b => b.addEventListener('click', () => goTo(Number(b.dataset.stop))));

  const pars = [...app.querySelectorAll<HTMLElement>('.disc .ph img, .claire-in .ph img')];
  // soft light that follows the pointer across cards
  const glowEls = [...app.querySelectorAll<HTMLElement>('.tile, .plan, .disc, .claire-in .ph, .ways > *')];
  const onMove = (e: PointerEvent) => { const el = (e.target as Element | null)?.closest?.<HTMLElement>('.tile, .plan, .disc, .claire-in .ph, .ways > *'); if (!el) return; const r = el.getBoundingClientRect(); el.style.setProperty('--mx', `${e.clientX - r.left}px`); el.style.setProperty('--my', `${e.clientY - r.top}px`); };
  if (matchMedia('(hover: hover)').matches && !reduceMotion()) { glowEls.forEach(g => g.classList.add('glow')); app.addEventListener('pointermove', onMove, { passive: true }); cleanups.push(() => { app.removeEventListener('pointermove', onMove); glowEls.forEach(g => g.classList.remove('glow')); }); }
  const mark = rail.querySelector<HTMLElement>('.jmark')!, pill = rail.querySelector<HTMLElement>('.jpill')!;
  let cur = 0, ticking = false, pillTimer = 0;
  const update = () => {
    ticking = false;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const prog = Math.min(1, Math.max(0, window.scrollY / max));
    // the marker sits ON the stop you are in and glides to the next one as you read, so it always agrees with the label
    const line = window.innerHeight * 0.42; let at = 0; stops.forEach((st, i) => { if (st.el.getBoundingClientRect().top < line) at = i; });
    const aTop = stops[at].el.getBoundingClientRect().top, nTop = at < n - 1 ? stops[at + 1].el.getBoundingClientRect().top : aTop + stops[at].el.offsetHeight;
    const seg = Math.min(1, Math.max(0, (line - aTop) / Math.max(1, nTop - aTop)));
    mark.style.top = `${((at + (at < n - 1 ? seg * 0.8 : 0)) / (n - 1)) * 100}%`;
    here.style.setProperty('--seg', String(seg)); here.classList.toggle('on', at >= 1);
    const nxt = stops[at + 1]; here.querySelector<HTMLElement>('.jh-n')!.textContent = String(at); here.querySelector<HTMLElement>('.jh-t')!.textContent = stops[at].short || stops[at].label;
    here.querySelector<HTMLElement>('.jh-x')!.textContent = nxt ? `Next: ${nxt.short || nxt.label} \u2192` : 'Back to the top \u2191';
    here.querySelector<HTMLElement>('.jh-k')!.textContent = `You are here \u00b7 ${at} of ${n - 1}`; here.dataset.next = nxt ? String(at + 1) : '';
    const moment = MOMENTS[Math.min(MOMENTS.length - 1, Math.floor(prog * MOMENTS.length))];
    mark.style.setProperty('--jc', moment.orb); mark.dataset.night = String(moment.dark);
    (bar.firstElementChild as HTMLElement).style.transform = `scaleX(${prog})`;
    // the whole page takes on the colour of the hour as you scroll, and the opening's landscape drifts as you leave it
    const f = prog * (MOMENTS.length - 1), i0 = Math.floor(f), i1 = Math.min(MOMENTS.length - 1, i0 + 1), t = f - i0;
    wash.style.setProperty('--w0', lerp(MOMENTS[i0].sky[0], MOMENTS[i1].sky[0], t)); wash.style.setProperty('--w1', lerp(MOMENTS[i0].sky[1], MOMENTS[i1].sky[1], t));
    aur.style.setProperty('--a0', lerp(MOMENTS[i0].land[1], MOMENTS[i1].land[1], t)); aur.style.setProperty('--a1', lerp(MOMENTS[i0].sky[1], MOMENTS[i1].sky[1], t)); aur.style.setProperty('--a2', lerp(MOMENTS[i0].orb, MOMENTS[i1].orb, t));
    if (!reduceMotion()) pars.forEach(im => { const r = im.parentElement!.getBoundingClientRect(); if (r.bottom < 0 || r.top > window.innerHeight) return; im.style.setProperty('--py', String(((r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight * -26).toFixed(1))); });
    if (hero) { const extra = Number(hero.parentElement?.dataset.len || 0); hero.style.setProperty('--p', String(Math.min(1, Math.max(0, window.scrollY - extra) / Math.max(1, hero.offsetHeight)))); }
    let idx = 0; stops.forEach((s, i) => { if (s.el.getBoundingClientRect().top < window.innerHeight * 0.42) idx = i; });
    if (idx !== cur) {
      cur = idx; pill.textContent = stops[idx].label;
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
