// The Ritualists, the planned free rewards club, as the owner approved it (October 2026): three tiers named for the day,
// the points value, a waitlist that asks for an email and a birthday (month and day only) for the Solar Return gift, and
// "Give $10, get $10" shown as coming soon. Shared by the home chapter and the club page (#/club), so the two never disagree.
//
// The club is not open and the Wix Loyalty app is not set up: every line here is a draft for Claire (.d), the section says
// "Coming soon", and the waitlist goes nowhere while writes are off (the same "switched off in this private preview" notice
// as every other sign-up). Nothing here is a review or a testimonial.
import './ritualists.css';
import { esc } from './ui';
import { previewOff } from './pages/shared';

const ICON = {
  dawn: '<svg class="ic" viewBox="0 0 48 48" aria-hidden="true"><path d="M6 34a18 18 0 0136 0" fill="none" stroke="#F3D29A" stroke-width="2"></path><circle cx="24" cy="30" r="6" fill="#F3D29A"></circle><path d="M4 38h40" stroke="#F3D29A" stroke-width="2"></path></svg>',
  golden: `<svg class="ic" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="10" fill="#E2A04A"></circle><g stroke="#E2A04A" stroke-width="2">${Array.from({ length: 8 }, (_, i) => { const a = (i * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a); return `<line x1="${(24 + 14 * c).toFixed(2)}" y1="${(24 + 14 * s).toFixed(2)}" x2="${(24 + 20 * c).toFixed(2)}" y2="${(24 + 20 * s).toFixed(2)}"></line>`; }).join('')}</g></svg>`,
  midnight: '<svg class="ic" viewBox="0 0 48 48" aria-hidden="true"><path d="M30 8a16 16 0 1010 26A13 13 0 0130 8z" fill="#F3D29A"></path><circle cx="12" cy="10" r="1.5" fill="#F3D29A"></circle><circle cx="40" cy="14" r="1" fill="#F3D29A"></circle></svg>',
};

/** The three tiers. Drafts for Claire (defaults she approved). */
export const TIERS: { key: keyof typeof ICON; name: string; when: string; perks: string[] }[] = [
  { key: 'dawn', name: 'Dawn', when: 'When you join', perks: ['1 point per $1', 'Solar Return birthday gift', 'Vote on Moon Drops'] },
  { key: 'golden', name: 'Golden Hour', when: '300 points a year', perks: ['1.5 points per $1', 'A free roller on your birthday'] },
  { key: 'midnight', name: 'Midnight', when: '600 points a year', perks: ['2 points per $1', 'A members-only candle each year', 'Early access to every Moon Drop'] },
];

export function tiersHTML(): string {
  return `<ul class="tiers rt-tiers" aria-label="The three tiers">${TIERS.map(t => `<li class="tier rt-${t.key}">${ICON[t.key]}<span class="tname">${esc(t.name)}</span><span class="small rt-when"><span class="d">${esc(t.when)}</span></span><ul>${t.perks.map(p => `<li><span class="d">${esc(p)}</span></li>`).join('')}</ul></li>`).join('')}</ul>`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The waitlist: email, then the birthday as a month and a day (never a year). `id` keeps two copies apart on one page. */
export function waitlistHTML(id = 'rit'): string {
  return `<form class="rt-form" id="${id}Form" novalidate>
    <div class="rt-field rt-email"><label for="${id}Email">Email address</label><input id="${id}Email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required></div>
    <fieldset class="rt-bday"><legend>Your birthday <span class="rt-opt">(month and day)</span></legend>
      <div class="rt-row"><label class="sr-only" for="${id}Month">Birthday month</label><select id="${id}Month" name="month"><option value="">Month</option>${MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join('')}</select>
      <label class="sr-only" for="${id}Day">Birthday day</label><select id="${id}Day" name="day"><option value="">Day</option>${Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}</select></div>
      <p class="rt-why"><span class="d">We'll only use your birthday to send your Solar Return gift.</span></p></fieldset>
    <button class="btn rt-join" type="submit"><span class="d">Join the waitlist</span></button>
  </form>`;
}

/** The home chapter / club page body: intro, tiers, points value, waitlist, the referral idea and the giving line. */
export function ritualistsHTML(opts: { id?: string; heading?: 'h1' | 'h2'; chapter?: string } = {}): string {
  const id = opts.id ?? 'rit', H = opts.heading ?? 'h2';
  return `<div class="rt-in">
    <div class="rt-head">
      ${opts.chapter ? `<span class="chapter">${esc(opts.chapter)}</span>` : '<span class="eyebrow">Free rewards club</span>'}
      <${H} id="${id}H">The <span class="it goldtext">Ritualists</span></${H}>
      <span class="soon-tag rt-soon"><span class="d">Coming soon</span></span>
      <p class="rt-lead"><span class="d">Every ritual counts. Earn points, rise through the day from Dawn to Midnight, and unlock perks that make your rituals easier.</span></p>
      <p class="rt-value"><b><span class="d">100 points = $5 off</span></b></p>
    </div>
    ${tiersHTML()}
    <div class="rt-foot">
      <div class="rt-wait"><h3 class="rt-wait-h"><span class="d">Join the waitlist</span></h3>${waitlistHTML(id)}</div>
      <div class="rt-side">
        <div class="rt-refer"><span class="soon-tag"><span class="d">Coming soon</span></span><b class="rt-refer-h"><span class="d">Give $10, get $10</span></b><span class="small"><span class="d">Share the light with a friend once the club opens.</span></span></div>
        <p class="rt-give"><span class="d">Every order also gives back.</span> <a class="tlink" href="#/giving"><span class="d">How giving back works</span></a></p>
      </div>
    </div>
  </div>`;
}

/** The waitlist does not reach Wix while writes are off: it says so, like every other sign-up in the preview. */
export function wireRitualists(root: ParentNode) {
  root.querySelectorAll<HTMLFormElement>('form.rt-form:not([data-wired])').forEach(f => {
    f.dataset.wired = '1';
    f.addEventListener('submit', e => { e.preventDefault(); previewOff('The Ritualists waitlist')(); });
  });
}
