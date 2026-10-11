// Legal pages. The wording of privacy, terms and refund policies must come from the business (and its adviser):
// until it is supplied each page says it is being finalised and points to Help. The outline stays a draft for Claire.
import { esc } from '../ui';

const PAGES: Record<string, { title: string; intro: string; outline: string[] }> = {
  privacy: { title: 'Privacy policy', intro: 'How Daily Rituals Co. collects, uses and protects your personal information.',
    outline: ['What we collect (orders, bookings, account, newsletter)', 'How we use it', 'Who we share it with (for example Wix, payment and shipping providers)', 'Cookies and analytics', 'How long we keep it', 'Your rights and how to contact us', 'Privacy contact person'] },
  terms: { title: 'Terms of service', intro: 'The terms that apply when you use this website, buy products or book coaching.',
    outline: ['Using the website', 'Orders, pricing and payment', 'Shipping', 'Coaching sessions: booking, rescheduling and cancellation', 'Coaching is not therapy or medical care', 'Limitation of liability', 'Governing law', 'Contact'] },
  'refund-policy': { title: 'Refund policy', intro: 'Returns, exchanges and refunds for products and coaching.',
    outline: ['How many days you have to start a return (confirm: the banner says 10 days)', 'Which items can be returned (opened candles, rollers, deodorant?)', 'Damaged or wrong items', 'Refund method and timing', 'Coaching session refunds and missed sessions', 'How to start a return'] },
};

export function renderLegal(app: HTMLElement, seg: string) {
  if (seg === 'accessibility') { renderAccessibility(app); return; }
  const p = PAGES[seg];
  app.innerHTML = `<div class="wrap legal-page">
    <div class="phead"><div class="crumbs"><a href="#/">Home</a> / ${esc(p.title)}</div><h1>${esc(p.title)}</h1><p class="lead muted">${esc(p.intro)}</p></div>
    <div class="legal-note"><b>This policy is being finalised.</b> If you have a question before it is published, please <a href="#/help">contact us through Help</a> and we will answer it directly.</div>
    <div class="d confirm legal-draft"><b>Draft outline for Claire (not shown to customers).</b> Please supply the final wording, ideally reviewed by an adviser. Suggested sections:
      <ol>${p.outline.map(o => `<li>${esc(o)}</li>`).join('')}</ol></div>
  </div>`;
}

// What this site does for accessibility, worded to match what has been built and spot-checked. The contact line is a draft until a contact email is confirmed.
function renderAccessibility(app: HTMLElement) {
  app.innerHTML = `<div class="wrap legal-page">
    <div class="phead"><div class="crumbs"><a href="#/">Home</a> / Accessibility</div><h1>Accessibility</h1><p class="lead muted">We want everyone to be able to shop, book and find a calm moment here.</p></div>
    <h2>What we have done</h2>
    <ul class="legal-list">
      <li>A "Skip to content" link at the top of every page for keyboard and screen reader users.</li>
      <li>Our main text and button colours were chosen to meet the WCAG AA contrast guideline.</li>
      <li>Buttons and links are built to work with a keyboard and show a visible focus outline.</li>
      <li>Tap targets of at least 44 pixels on phones.</li>
      <li>If your device asks for reduced motion, the animated sky, birds, drifting colour and breathing animations are switched off or kept still.</li>
      <li>Images have text descriptions, and decorative drawings are hidden from screen readers.</li>
    </ul>
    <h2>Known limits</h2>
    <ul class="legal-list"><li>Checkout, sign-in and booking confirmation open on pages hosted by our platform, Wix, which manages their accessibility.</li></ul>
    <h2>Tell us</h2>
    <p>If something on this site is hard to use, please <a href="#/help">let us know through Help</a> and we will fix it or help you another way.</p>
    <p class="small muted d confirm">Draft: add a direct accessibility contact email once confirmed, and the date of the last review. Consider a full audit before claiming formal WCAG conformance.</p>
  </div>`;
}
