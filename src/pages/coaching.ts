import Coaching from '../canvas/pages/Coaching.html?raw';
import { wireLoop } from './loop';
import { loadServices, imgSrc, money, wix, saveTokens } from '../wix';
import { fixImages, wireCommon, esc, errorBox, toast } from '../ui';
import { navigate, routeUrl } from '../router';
import { WRITES_ENABLED, TIME_ZONE, BOOKINGS_APP_ID, STAFF_RESOURCE_TYPE_ID } from '../config';

const duration = (s: any) => s.schedule?.availabilityConstraints?.sessionDurations?.[0] as number | undefined;
const priceLabel = (s: any) => {
  const v = s.payment?.fixed?.price?.value;
  if (v != null) return money(Number(v));
  return s.payment?.custom?.description ?? '';
};
const slugOf = (s: any) => s.mainSlug?.name ?? s.supportedSlugs?.[0]?.name ?? s._id;

export async function renderCoaching(app: HTMLElement) {
  app.innerHTML = fixImages(Coaching);
  wireCommon(app);
  wireCheckin(app);
  wireLoop(app);

  const ways = [...app.querySelectorAll<HTMLAnchorElement>('.ways .way')];
  let list: any[] = [];
  try { list = await loadServices(); } catch (e) {
    ways[1]?.insertAdjacentHTML('beforebegin', errorBox(String((e as Error).message ?? e)));
    return;
  }
  const discovery = list.find(s => /discovery/i.test(s.name));
  const program = list.find(s => s !== discovery);
  const fill = (a: HTMLAnchorElement | undefined, s: any) => {
    if (!a || !s) return;
    const mins = duration(s);
    a.href = `#/book/${slugOf(s)}`;
    a.innerHTML = `<span class="eyebrow">${esc(priceLabel(s))}${mins ? ` · ${mins} min` : ''}</span><h3>${esc(s.name)}</h3><p class="muted">${esc(s.tagLine ?? '')}</p><span class="live-tag">Live from Bookings</span>`;
  };
  fill(ways[1], discovery);
  fill(ways[2], program);

  // The canvas FAQ says pricing is shared on the call, but the live service lists a price.
  const faq = [...app.querySelectorAll('details')].find(d => /priced/i.test(d.querySelector('summary')?.textContent ?? ''));
  if (faq && program?.payment?.fixed) {
    faq.querySelector('.dbody')!.insertAdjacentHTML('beforeend',
      `<p><span class="d confirm">[Confirm: the live booking page lists ${esc(program.name)} at ${priceLabel(program)}. Keep this answer or show the price?]</span></p>`);
  }
  app.querySelectorAll<HTMLAnchorElement>('a[href="#/book"], a[href="/book"]').forEach(a => { if (discovery) a.href = `#/book/${slugOf(discovery)}`; });
}

function wireCheckin(app: HTMLElement) {
  const out = app.querySelector<HTMLElement>('#pathOut');
  if (!out) return;
  const reset = out.innerHTML;
  const update = () => {
    const v = (id: string) => Number(app.querySelector<HTMLInputElement>(`#${id}`)?.value ?? 3);
    if (v('s4') >= 4) {
      out.innerHTML = `<div class="path"><img src="/img/coaching.jpg" alt="" class="dimg" style="border-radius:4px;aspect-ratio:16/10;object-fit:cover"><span class="eyebrow" style="color:var(--euc)">Suggested start</span><h3 style="font-size:34px">A free discovery call</h3><p>Talk with Claire about your goals and whether coaching is a fit.</p><a class="btn euc" href="#/bk" style="align-self:flex-start">Book a discovery call</a><span class="small muted">You can always choose a different path.</span></div>`;
    } else out.innerHTML = reset;
  };
  ['s1', 's2', 's3', 's4'].forEach(id => app.querySelector(`#${id}`)?.addEventListener('input', update));
}

// ---------------- booking ----------------
const pad = (n: number) => String(n).padStart(2, '0');
const localStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
const dayKey = (s: string) => s.slice(0, 10);
const fmtDay = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
const fmtTime = (s: string) => new Date(s).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }).replace('a.m.', 'am').replace('p.m.', 'pm');

export async function renderBook(app: HTMLElement, slug?: string) {
  app.innerHTML = `<div class="wrap bk">
    <div class="phead"><div class="crumbs"><a href="#/">Home</a> / <a href="#/coaching">Coaching</a> / Book</div></div>
    <div class="bk-grid">
      <div class="bk-intro"><span class="eyebrow" style="color:var(--euc)">Neuro coaching with Claire</span><h1 class="bk-title">Book a session</h1><div id="svcPick" class="segs"></div><div id="svcInfo"></div>
        <p class="disclaimer">Coaching is not therapy or medical care. It does not diagnose or treat any condition and is not a substitute for care from a qualified professional. <span class="d confirm">Claire to confirm wording.</span></p></div>
      <div class="bk-panel"><h2 class="bk-h">Choose a time</h2><p class="small muted">Times shown in ${TIME_ZONE.replace('_', ' ')} time.</p><div id="slots"><div class="sk-line"></div><div class="sk-line short"></div></div><div id="bookForm"></div></div>
    </div></div>`;
  let list: any[];
  try { list = await loadServices(); } catch (e) { app.querySelector('#slots')!.innerHTML = errorBox(String((e as Error).message ?? e)); return; }
  const svc = list.find(s => slugOf(s) === slug) ?? list.find(s => /discovery/i.test(s.name)) ?? list[0];
  if (!svc) {
    // nothing bookable yet: a warm empty state with the two free ways in. The wording below is a draft for Claire.
    app.querySelector('#slots')!.innerHTML = `<div class="bk-empty"><h3>No open times right now</h3><p>New times are added as Claire's calendar opens up. Please check back soon.</p>
      <div class="cta"><a class="btn euc" href="#/reset">Start the free 7-day reset</a><a class="btn line" href="#/coaching">Back to coaching</a></div></div>`;
    app.querySelector('#svcInfo')!.innerHTML = `<div class="bk-aside"><span class="eyebrow">While you wait</span><h2>Try one practice <span class="it">today</span></h2><p>The free 7-day reset is ten minutes a day with Claire, self-paced, and a gentle way to see whether coaching is for you.</p></div>`;
    return;
  }

  app.querySelector('#svcPick')!.innerHTML = list.map(s =>
    `<a class="chip" href="#/book/${slugOf(s)}" aria-pressed="${s._id === svc._id}">${esc(s.name)}</a>`).join('');
  const img = imgSrc(svc.media?.mainMedia?.image, 960, 600);
  const mins = duration(svc);
  const desc = String(svc.description ?? '').split('\n').filter(Boolean).map(l => `<p>${esc(l)}</p>`).join('');
  app.querySelector('#svcInfo')!.innerHTML = `${img ? `<img src="${img}" alt="" class="bk-img">` : ''}
    <div class="bk-facts"><span><b>${esc(priceLabel(svc))}</b></span>${mins ? `<span>${mins} min${/6 week/i.test(svc.name) ? ' per session' : ''}</span>` : ''}<span>${esc(svc.locations?.[0]?.calculatedAddress?.formattedAddress ?? 'Online')}</span></div>
    <div class="bk-desc">${desc}</div>`;

  const now = new Date();
  const from = new Date(now.getTime() + 24 * 3600e3);
  const to = new Date(now.getTime() + 14 * 24 * 3600e3);
  let slots: any[] = [];
  try {
    const res: any = await wix.availabilityTimeSlots.listAvailabilityTimeSlots({
      serviceId: svc._id, fromLocalDate: localStr(from), toLocalDate: localStr(to), timeZone: TIME_ZONE, bookable: true, cursorPaging: { limit: 200 },
    } as any);
    slots = res.timeSlots ?? [];
    saveTokens();
  } catch (e) { app.querySelector('#slots')!.innerHTML = errorBox(String((e as Error).message ?? e)); return; }

  const byDay = new Map<string, any[]>();
  slots.forEach(s => { const k = dayKey(s.localStartDate); byDay.set(k, [...(byDay.get(k) ?? []), s]); });
  const box = app.querySelector<HTMLElement>('#slots')!;
  if (!byDay.size) { box.innerHTML = '<p>No open times in the next two weeks. Please check back soon.</p>'; return; }
  box.innerHTML = [...byDay].map(([k, arr], d) => `<div class="slot-day"${d > 2 ? ' hidden' : ''}><b>${fmtDay(k)}</b><div class="slot-row">${arr.map((s, n) =>
    `<button class="chip" data-slot="${k}|${n}" aria-pressed="false">${fmtTime(s.localStartDate)}</button>`).join('')}</div></div>`).join('') +
    (byDay.size > 3 ? `<button class="btn line bk-more" id="moreDays">Show ${byDay.size - 3} more days</button>` : '');
  box.querySelector('#moreDays')?.addEventListener('click', e => { box.querySelectorAll<HTMLElement>('.slot-day[hidden]').forEach(x => { x.hidden = false; }); (e.currentTarget as HTMLElement).remove(); });
  box.querySelectorAll<HTMLButtonElement>('[data-slot]').forEach(b => b.addEventListener('click', () => {
    box.querySelectorAll('[data-slot]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    const [k, n] = b.dataset.slot!.split('|');
    showForm(app, svc, byDay.get(k)![Number(n)]);
  }));
}

function showForm(app: HTMLElement, svc: any, slot: any) {
  const el = app.querySelector<HTMLElement>('#bookForm')!;
  // The live services use the default booking form; render the contact basics it requires.
  const fields = [
    { target: 'first_name', label: 'First name', type: 'text', ac: 'given-name' },
    { target: 'last_name', label: 'Last name', type: 'text', ac: 'family-name' },
    { target: 'email', label: 'Email', type: 'email', ac: 'email' },
    { target: 'phone', label: 'Phone (optional)', type: 'tel', ac: 'tel' },
  ];
  el.innerHTML = `<form class="bk-form" novalidate>
    <h3 style="font-size:24px">${fmtDay(dayKey(slot.localStartDate))} · ${fmtTime(slot.localStartDate)}</h3>
    ${fields.map(f => `<label><span>${f.label}</span><input name="${f.target}" type="${f.type}" autocomplete="${f.ac}" ${f.target === 'phone' ? '' : 'required'}></label>`).join('')}
    <button class="btn euc" type="submit">${WRITES_ENABLED ? 'Confirm booking' : 'Confirm booking (switched off in preview)'}</button>
    <p class="small muted">${WRITES_ENABLED ? 'You will get a confirmation email from Daily Rituals Co.' : 'Private preview: availability is live, but no booking is created.'}</p></form>`;
  el.querySelector('form')!.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;
    const values: Record<string, string> = {};
    new FormData(form).forEach((v, k) => { if (String(v).trim()) values[k] = String(v).trim(); });
    if (!WRITES_ENABLED) { toast('Booking is switched off in the preview. No booking was created.'); return; }
    try { await createLiveBooking(svc, slot, values); } catch (err) { toast(`That time could not be booked: ${(err as Error).message ?? err}`); }
  });
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/** Launch-only path (WRITES_ENABLED): createBooking → Cart V2 → checkout or place order. */
async function createLiveBooking(svc: any, slot: any, formSubmission: Record<string, string>) {
  const o = svc.payment?.options ?? {};
  const selectedPaymentOption = o.online && !o.inPerson ? 'ONLINE' : !o.online && o.inPerson ? 'OFFLINE' : 'ONLINE';
  const loc = slot.location?.locationType;
  const created: any = await wix.bookings.createBooking({
    selectedPaymentOption,
    totalParticipants: 1,
    bookedEntity: { slot: {
      serviceId: svc._id, scheduleId: slot.scheduleId ?? undefined,
      startDate: slot.localStartDate, endDate: slot.localEndDate, timezone: TIME_ZONE,
      resourceSelections: [{ resourceTypeId: STAFF_RESOURCE_TYPE_ID, selectionMethod: 'ANY_RESOURCE' }],
      location: { locationType: loc === 'BUSINESS' ? 'OWNER_BUSINESS' : 'CUSTOM', _id: slot.location?._id },
    } },
  } as any, { formSubmission } as any);
  const bookingId = created.booking._id;
  const cart: any = await wix.createCart({ catalogItems: [{ quantity: 1, catalogReference: { catalogItemId: bookingId, appId: BOOKINGS_APP_ID } }], cart: { source: { channelType: 'WEB' } } } as any);
  const { summary }: any = await wix.calculateCart(cart._id);
  const total = Number(summary?.priceSummary?.total?.amount ?? 0);
  const needsCheckout = svc.bookingPolicy?.cancellationFeePolicy?.enabled || (total > 0 && selectedPaymentOption === 'ONLINE');
  if (needsCheckout) {
    const { redirectSession }: any = await wix.redirects.createRedirectSession({ ecomCheckout: { checkoutId: cart._id }, callbacks: { postFlowUrl: routeUrl('/coaching') } });
    location.href = redirectSession.fullUrl;
  } else {
    await wix.placeOrder(cart._id);
    toast('Booked. Check your email for the details.');
    navigate('/coaching');
  }
}
