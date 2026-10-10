// The navigation: desktop flyouts (hover intent, click, keyboard, Esc, focusout, crossfade, scrim), the five-mood
// constellation, the phone night-sky menu (dialog, focus trap, inert, scroll lock, accordions, pills), every menu
// link landing on a real page, and the product page's sticky local nav (scroll-spy, add pill, phone tray).
import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const origin = (process.env.BASE ?? 'http://localhost:4173/#').replace(/\/?#?$/, '');
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const res = []; const ok = (n, c, x = '') => { res.push(c); console.log(c ? 'PASS' : 'FAIL', n, x); };
const overflow = p => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const MOODS = ['fresh', 'sunny', 'floral', 'woody', 'grounding'];
let menuHrefs = [];

{ // ---------- desktop 1440 x 900 ----------
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(origin + '/'); await p.waitForSelector('#dProducts .sp'); await p.waitForTimeout(800);
  const isOpen = id => p.evaluate(id => document.querySelector(`.gn-item[data-id="${id}"] .gn-disclose`)?.getAttribute('aria-expanded') === 'true' && document.getElementById(`gn-panel-${id}`).classList.contains('open'), id);
  const anyOpen = () => p.locator('.gn-panel.open').count();

  // structure (APG disclosure navigation)
  ok('desktop: five top-level items, three with disclosure buttons', (await p.locator('.mainnav .gn-link').count()) === 5 && (await p.locator('.mainnav .gn-disclose').count()) === 3);
  ok('desktop: every disclosure button has aria-expanded=false and controls a panel that exists', await p.evaluate(() => [...document.querySelectorAll('.gn-disclose')].every(b => b.getAttribute('aria-expanded') === 'false' && document.getElementById(b.getAttribute('aria-controls'))?.classList.contains('gn-panel'))));
  ok('desktop: the old collapsed list and the one-product buy bar are gone', (await p.locator('#mnav, .buybar').count()) === 0);
  ok('desktop: the panels are hidden from everyone while closed', await p.evaluate(() => [...document.querySelectorAll('.gn-panel')].every(el => getComputedStyle(el).visibility === 'hidden')));

  // hover intent
  await p.hover('.gn-item[data-id="shop"] .gn-link'); await p.waitForTimeout(90);
  ok('desktop: hovering Shop does not open the flyout at once (hover intent)', !(await isOpen('shop')));
  await p.waitForTimeout(500);
  ok('desktop: the Shop flyout opens after the intent delay', await isOpen('shop'));
  ok('desktop: a page scrim sits over the page while a flyout is open', await p.evaluate(() => document.body.classList.contains('gn-open') && document.elementFromPoint(720, 820)?.classList.contains('gn-scrim')));
  ok('desktop: the other top-level items dim while one is open', parseFloat(await p.locator('.gn-item[data-id="coaching"]').evaluate(e => getComputedStyle(e).opacity)) < 1);
  ok('desktop: the Shop flyout lists the formats, the five moods and the extra pages', await p.evaluate(() => { const t = document.getElementById('gn-panel-shop').innerText; return ['Shop all', 'Fragrance rollers', 'Mini diffusers', 'Candles', 'Natural deodorant', 'Fresh and coastal', 'Sunny and tropical', 'Soft and floral', 'Warm and woody', 'Grounding', 'Ritual on Repeat', 'Moon Drops', 'Send a Sunrise'].every(s => t.includes(s)); }));
  ok('desktop: each mood link carries a star in its mood colour', (await p.locator('#gn-panel-shop .gn-col-moods .moodstar').count()) === 5);
  ok('desktop: panel links reveal with a stagger (later links wait longer)', await p.evaluate(() => { const [a, , c] = document.querySelectorAll('#gn-panel-shop .gn-col-elevated .gn-pi'); return parseFloat(getComputedStyle(c).transitionDelay) > parseFloat(getComputedStyle(a).transitionDelay); }));

  // the constellation
  const stars = p.locator('#gn-panel-shop .cst-star');
  ok('desktop: the Shop flyout holds a constellation of the five moods', (await stars.count()) === 5);
  ok('desktop: each star links to its mood on the compass and is named after the mood', await stars.evaluateAll(as => as.every(a => /^\/explore\?mood=(fresh|sunny|floral|woody|grounding)$/.test(a.getAttribute('href')) && /coastal|tropical|floral|woody|Grounding/.test(a.textContent))));
  await p.waitForTimeout(1600);
  ok('desktop: the hairlines between the stars have drawn themselves', await p.evaluate(() => [...document.querySelectorAll('#gn-panel-shop .cst-lines line')].every(l => parseFloat(getComputedStyle(l).strokeDashoffset) < 0.01)));
  await p.hover('#gn-panel-shop .cst-star[href*="woody"]'); await p.waitForTimeout(400);
  ok('desktop: hovering a star shows its mood name and lights it', await p.evaluate(() => { const a = document.querySelector('#gn-panel-shop .cst-star[href*="woody"]'); return getComputedStyle(a.querySelector('.cst-name')).opacity === '1' && a.querySelector('.cst-name').textContent === 'Warm and woody' && getComputedStyle(a.querySelector('.star')).transform !== 'none'; }));
  ok('desktop: stars are 44px targets', await stars.first().evaluate(e => { const r = e.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; }));
  ok('desktop: no sideways scroll with the flyout open', (await overflow(p)) <= 1);

  // switching crossfades without closing; leaving closes after a grace period
  await p.hover('.gn-item[data-id="explore"] .gn-link'); await p.waitForTimeout(30);
  const stillOpen = (await anyOpen()) >= 1;
  await p.waitForTimeout(250);
  ok('desktop: moving to Find your scent switches panels without closing first', stillOpen && (await isOpen('explore')) && !(await isOpen('shop')));
  ok('desktop: the Find your scent flyout offers the compass, the quiz and a mood to start from', await p.evaluate(() => { const t = document.getElementById('gn-panel-explore').innerText; return ['browse the compass', 'take the quiz', 'start from a mood', 'free 20-min call'].every(s => t.toLowerCase().includes(s)); }));
  await p.hover('.gn-item[data-id="coaching"] .gn-link'); await p.waitForTimeout(300);
  ok('desktop: the Coaching flyout leads with the free reset and the free call', await p.evaluate(() => { const t = document.getElementById('gn-panel-coaching').innerText; return t.includes('Free 7-day reset') && t.includes('Free 20-min call with Claire') && t.includes('Neuro coaching'); }));
  await p.mouse.move(720, 820); await p.waitForTimeout(40);
  const graceOpen = await isOpen('coaching');
  await p.waitForTimeout(400);
  ok('desktop: leaving the menu keeps it open for a moment, then closes it', graceOpen && (await anyOpen()) === 0 && !(await p.evaluate(() => document.body.classList.contains('gn-open'))));

  // click toggles at once
  await p.click('.gn-item[data-id="shop"] .gn-disclose'); await p.waitForTimeout(50);
  ok('desktop: clicking the disclosure button opens at once', await isOpen('shop'));
  await p.click('.gn-item[data-id="shop"] .gn-disclose'); await p.waitForTimeout(50);
  ok('desktop: clicking it again closes', !(await isOpen('shop')));
  await p.click('.gn-item[data-id="coaching"] .gn-disclose'); await p.waitForTimeout(100);
  await p.click('.gn-scrim', { position: { x: 700, y: 820 } }); await p.waitForTimeout(100);
  ok('desktop: clicking the scrim closes the flyout', (await anyOpen()) === 0);
  await p.mouse.move(5, 880); await p.waitForTimeout(400);

  // keyboard
  await p.focus('.gn-item[data-id="shop"] .gn-link'); await p.keyboard.press('Tab');
  ok('keyboard: Tab after the Shop link reaches its disclosure button', await p.evaluate(() => document.activeElement.matches('.gn-item[data-id="shop"] .gn-disclose')));
  await p.keyboard.press('Enter'); await p.waitForTimeout(100);
  ok('keyboard: Enter opens the flyout', await isOpen('shop'));
  await p.keyboard.press('Tab');
  ok('keyboard: the next Tab moves into the flyout (first link: Shop all)', await p.evaluate(() => document.activeElement.closest('#gn-panel-shop') && document.activeElement.textContent.trim() === 'Shop all'));
  ok('keyboard: the focused link shows a visible focus ring', await p.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2; }));
  await p.keyboard.press('Escape'); await p.waitForTimeout(100);
  ok('keyboard: Esc closes the flyout and returns focus to its button', !(await isOpen('shop')) && await p.evaluate(() => document.activeElement.matches('.gn-item[data-id="shop"] .gn-disclose')));
  await p.keyboard.press('Space'); await p.waitForTimeout(100);
  ok('keyboard: Space reopens it', await isOpen('shop'));
  await p.focus('.gn-item[data-id="explore"] .gn-link'); await p.waitForTimeout(100);
  ok('keyboard: focus leaving the item closes its flyout', !(await isOpen('shop')));
  await p.focus('.gn-item[data-id="coaching"] .gn-disclose'); await p.keyboard.press('Enter'); await p.waitForTimeout(80);
  await p.keyboard.press('Tab'); await p.keyboard.press('Enter'); await p.waitForURL('**/reset'); await p.waitForSelector('h1');
  ok('keyboard: Enter on a flyout link opens that page and the menu closes', /reset/i.test(await p.locator('h1').innerText()) && (await anyOpen()) === 0);

  // current page marker
  await p.goto(origin + '/shop'); await p.waitForSelector('.grid .card');
  ok('desktop: the Shop link is marked as the current page on /shop', (await p.locator('.mainnav .gn-link[data-nav="shop"]').getAttribute('aria-current')) === 'page');

  // every link in the menus is a real page
  await p.goto(origin + '/'); await p.waitForSelector('#dProducts .sp');
  menuHrefs = [...new Set(await p.locator('.gn-panel a, .mainnav .gn-link, #mobileMenu a').evaluateAll(as => as.map(a => a.getAttribute('href').replace(/^#/, ''))))];
  const bad = [];
  for (const h of menuHrefs) {
    await p.goto(origin + h); await p.waitForTimeout(h.includes('explore') ? 900 : 500);
    const t = await p.locator('main').innerText();
    if (t.trim().length < 40 || (await p.locator('main .missing').count()) || /still putting this page together|canvas|Not designed|14 screens/i.test(t)) bad.push(h);
    if (/explore\?mood=/.test(h) && !(await p.locator('.wpanel').count())) bad.push(h + ' (no compass panel)');
  }
  ok(`desktop: all ${menuHrefs.length} menu links open real pages (no coming-soon or draft pages)`, bad.length === 0, bad.join(', '));
  ok('desktop: the menus reach the finder, the quiz, the reset, the call and every mood', ['/explore', '/explore?tab=quiz', '/reset', '/book', '/coaching', '/shop', ...MOODS.map(m => `/explore?mood=${m}`), ...MOODS.map(m => `/shop?f=all&m=${m}&s=featured`)].every(h => menuHrefs.includes(h)));

  // the star takes you to its mood on the compass
  await p.goto(origin + '/'); await p.waitForSelector('#dProducts .sp'); await p.waitForTimeout(400);
  await p.click('.gn-item[data-id="shop"] .gn-disclose'); await p.waitForTimeout(700);
  await p.click('#gn-panel-shop .cst-star[href*="woody"]'); await p.waitForURL('**/explore?mood=woody'); await p.waitForSelector('.wpanel'); await p.waitForTimeout(500);
  ok('desktop: a star opens the compass on its mood', /Warm and woody/.test(await p.locator('.wpanel').innerText()));

  // ---------- product local nav ----------
  await p.goto(origin + '/product/roller-citrus-and-sun'); await p.waitForSelector('.lnav'); await p.waitForTimeout(800);
  ok('product: the local nav names the product with its mood mark', /Citrus & Sun/.test(await p.locator('.lnav-name b').innerText()) && (await p.locator('.lnav-name .moodstar').count()) === 1);
  const secLinks = await p.locator('.lnav-links a').evaluateAll(as => as.map(a => [a.textContent, a.getAttribute('href'), !!document.getElementById(a.dataset.sec)]));
  ok('product: section links only point at sections that exist', secLinks.length >= 3 && secLinks.every(s => s[2]), JSON.stringify(secLinks));
  ok('product: at rest the bar is transparent and not stuck', await p.evaluate(() => { const n = document.querySelector('.lnav'); return !n.classList.contains('is-stuck') && getComputedStyle(n).backgroundColor === 'rgba(0, 0, 0, 0)'; }));
  ok('product: the pill mirrors the real add button', (await p.locator('.lnav-add').getAttribute('aria-label')) === (await p.locator('#addBtn').innerText()).trim());
  ok('product: the first section is current at the top', (await p.locator('.lnav-links a').first().getAttribute('aria-current')) === 'true');
  await p.evaluate(() => window.scrollTo(0, 700)); await p.waitForTimeout(500);
  ok('product: once stuck the bar frosts', await p.evaluate(() => { const n = document.querySelector('.lnav'); const r = n.getBoundingClientRect(); return n.classList.contains('is-stuck') && r.top <= 1 && getComputedStyle(n).backgroundColor !== 'rgba(0, 0, 0, 0)'; }));
  const urlBefore = p.url();
  await p.click('.lnav-links a[data-sec="p-practice"]'); await p.waitForTimeout(1200);
  ok('product: a section link scrolls there and scroll-spy marks it current', await p.evaluate(() => { const a = document.querySelector('.lnav-links a[data-sec="p-practice"]'); const t = document.getElementById('p-practice').getBoundingClientRect().top; return a.getAttribute('aria-current') === 'true' && t >= 0 && t < 200 && document.querySelectorAll('.lnav-links a[aria-current="true"]').length === 1; }));
  ok('product: following a section link does not change the address', p.url() === urlBefore && !p.url().includes('#'), p.url());
  await p.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await p.waitForTimeout(600);
  ok('product: at the end of the page the last section is current', (await p.locator('.lnav-links a').last().getAttribute('aria-current')) === 'true');
  await p.evaluate(() => window.scrollTo(0, 700)); await p.waitForTimeout(400);
  const c0 = Number(await p.locator('#cartCount').innerText());
  await p.click('.lnav-add'); await p.waitForTimeout(600);
  ok('product: the pill adds to the cart', Number(await p.locator('#cartCount').innerText()) === c0 + 1);
  // the pill follows the chosen variant
  await p.goto(origin + '/product/cabana'); await p.waitForSelector('[data-choice]'); await p.waitForTimeout(600);
  const before = await p.locator('.lnav-add').getAttribute('aria-label');
  await p.locator('[data-choice]:not([aria-pressed="true"])').first().click(); await p.waitForTimeout(300);
  const after = await p.locator('.lnav-add').getAttribute('aria-label');
  ok('product: the pill reflects the selected variant', after === (await p.locator('#addBtn').innerText()).trim() && /Add to cart/.test(after), `${before} -> ${after}`);
  await p.goto(origin + '/shop'); await p.waitForSelector('.grid .card'); await p.waitForTimeout(300);
  ok('product: leaving the page removes the local nav', (await p.locator('.lnav, .lnav-sentinel').count()) === 0);
  ok('desktop: no JS errors', errs.length === 0, errs.join(' | ').slice(0, 300));
  await ctx.close();
}

{ // ---------- a narrower desktop: the bar still fits on one line ----------
  const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  await p.goto(origin + '/'); await p.waitForSelector('#dProducts .sp'); await p.waitForTimeout(500);
  ok('1024: the top-level items stay on one line and the page does not scroll sideways', (await overflow(p)) <= 1 && await p.evaluate(() => document.querySelector('.mainnav').getBoundingClientRect().height <= 80 && document.querySelector('.menu-btn').offsetParent === null));
  await p.click('.gn-item[data-id="shop"] .gn-disclose'); await p.waitForTimeout(600);
  ok('1024: the Shop flyout fits without sideways scroll', (await overflow(p)) <= 1 && (await p.locator('#gn-panel-shop .cst-star').count()) === 5);
  await ctx.close();
}

{ // ---------- reduced motion ----------
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  await p.goto(origin + '/'); await p.waitForSelector('#dProducts .sp'); await p.waitForTimeout(400);
  await p.click('.gn-item[data-id="shop"] .gn-disclose'); await p.waitForTimeout(250);
  ok('reduced motion: the flyout opens with no movement (opacity only)', await p.evaluate(() => { const li = document.querySelector('#gn-panel-shop .gn-pi'); const st = document.querySelector('#gn-panel-shop .cst-star'); return document.getElementById('gn-panel-shop').classList.contains('open') && getComputedStyle(li).transform === 'none' && getComputedStyle(st).transform === 'none' && getComputedStyle(li).opacity === '1'; }));
  ok('reduced motion: the constellation lines are simply shown', await p.evaluate(() => [...document.querySelectorAll('#gn-panel-shop .cst-lines line')].every(l => parseFloat(getComputedStyle(l).strokeDashoffset) < 0.01)));
  await ctx.close();
}

{ // ---------- phone 390 x 844 ----------
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(origin + '/'); await p.waitForSelector('#dProducts .sp'); await p.waitForTimeout(800);
  const box = async sel => p.locator(sel).evaluate(e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; });
  ok('phone: the hamburger is at least 44px and announces the menu dialog', (await box('#menuBtn')).every(v => v >= 44) && (await p.getAttribute('#menuBtn', 'aria-controls')) === 'mobileMenu' && (await p.getAttribute('#menuBtn', 'aria-expanded')) === 'false');
  ok('phone: the desktop flyouts are not in the way', (await p.locator('.mainnav').isHidden()) && (await p.locator('#mobileMenu').isHidden()));
  await p.click('#menuBtn'); await p.waitForTimeout(700);
  const mm = p.locator('#mobileMenu');
  ok('phone: the menu opens as a modal dialog', (await mm.isVisible()) && (await mm.getAttribute('role')) === 'dialog' && (await mm.getAttribute('aria-modal')) === 'true' && (await p.getAttribute('#menuBtn', 'aria-expanded')) === 'true');
  ok('phone: the page behind is inert and cannot scroll', await p.evaluate(() => document.getElementById('root').inert === true && getComputedStyle(document.documentElement).overflow === 'hidden'));
  ok('phone: focus moves into the dialog (the close button, 44px)', await p.evaluate(() => document.activeElement?.classList.contains('mm-close')) && (await box('.mm-close')).every(v => v >= 44));
  ok('phone: it is a night sky', await p.evaluate(() => /linear-gradient/.test(getComputedStyle(document.getElementById('mobileMenu')).backgroundImage) && document.querySelectorAll('.mm-stars circle').length > 50));
  const rows = await p.locator('.mm-rows > .mm-row').evaluateAll(l => l.map(r => r.innerText.trim().split('\n')[0]));
  ok('phone: large serif rows: Shop, Find your scent, Coaching, Moon Drops, Gifts, Ritual on Repeat', rows.join('|') === 'Shop|Find your scent|Coaching|Moon Drops|Gifts|Ritual on Repeat', rows.join('|'));
  ok('phone: rows use the display serif at 28px or more', await p.evaluate(() => { const s = getComputedStyle(document.querySelector('.mm-acc')); return parseFloat(s.fontSize) >= 28 && /Bodoni|Didot|serif/i.test(s.fontFamily); }));
  ok('phone: rows arrive with a stagger', await p.evaluate(() => { const r = document.querySelectorAll('.mm-rows > .mm-row'); return parseFloat(getComputedStyle(r[3]).transitionDelay) > parseFloat(getComputedStyle(r[0]).transitionDelay); }));
  ok('phone: the coaching offers stay prominent', await p.evaluate(() => { const c = document.querySelector('.mm-coach'); return c && c.querySelector('a[href$="/reset"]') && c.querySelector('a[href$="/book"]') && /Free 7-day reset/.test(c.innerText) && /Free 20-min call/.test(c.innerText); }));
  ok('phone: the footer pills are Find your scent and Shop all', await p.locator('.mm-foot .mm-pill').evaluateAll(as => as.map(a => a.textContent.trim() + '>' + a.getAttribute('href')).join('|')) === 'Find your scent>/explore|Shop all>/shop');
  ok('phone: the constellation is in the menu with all five stars', (await p.locator('#mobileMenu .cst-star').count()) === 5);
  ok('phone: menu text meets AA contrast on the night sky (moonstone on nocturne)', await p.evaluate(() => { const c = getComputedStyle(document.querySelector('.mm-acc')).color; return c === 'rgb(237, 230, 218)'; }));
  ok('phone: no sideways scroll with the menu open', (await overflow(p)) <= 1 && await p.evaluate(() => document.getElementById('mobileMenu').scrollWidth <= innerWidth));
  // accordions
  const acc = p.locator('.mm-acc[aria-controls="mm-sub-shop"]');
  ok('phone: accordion rows are disclosure buttons', (await acc.getAttribute('aria-expanded')) === 'false' && await p.evaluate(() => getComputedStyle(document.querySelector('#mm-sub-shop .mm-sub-in')).visibility === 'hidden'));
  await acc.click(); await p.waitForTimeout(600);
  ok('phone: opening Shop reveals its links with mood stars', (await acc.getAttribute('aria-expanded')) === 'true' && (await p.locator('#mm-sub-shop a:visible').count()) >= 10 && (await p.locator('#mm-sub-shop .moodstar').count()) === 5);
  await p.locator('.mm-acc[aria-controls="mm-sub-coaching"]').click(); await p.waitForTimeout(600);
  ok('phone: opening another row closes the first', (await acc.getAttribute('aria-expanded')) === 'false' && (await p.locator('#mm-sub-coaching a:visible').count()) >= 3);
  // focus trap
  let inside = true;
  for (let i = 0; i < 40; i++) { await p.keyboard.press('Tab'); if (!(await p.evaluate(() => document.getElementById('mobileMenu').contains(document.activeElement)))) { inside = false; break; } }
  ok('phone: Tab stays inside the dialog', inside);
  await p.focus('.mm-logo'); await p.keyboard.press('Shift+Tab');
  ok('phone: Shift+Tab from the first control wraps to the last pill', await p.evaluate(() => document.activeElement?.matches('.mm-foot .mm-pill:last-child')));
  await p.keyboard.press('Tab');
  ok('phone: Tab from the last pill wraps to the first control', await p.evaluate(() => document.activeElement?.matches('.mm-logo')));
  // Esc
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  ok('phone: Esc closes the menu and returns focus to the hamburger', (await mm.isHidden()) && await p.evaluate(() => document.activeElement?.id === 'menuBtn' && document.getElementById('root').inert === false && getComputedStyle(document.documentElement).overflow !== 'hidden') && (await p.getAttribute('#menuBtn', 'aria-expanded')) === 'false');
  // close button, and a link closes the menu by navigating
  await p.click('#menuBtn'); await p.waitForTimeout(500); await p.click('.mm-close'); await p.waitForTimeout(500);
  ok('phone: the close button closes the menu', await mm.isHidden());
  await p.click('#menuBtn'); await p.waitForTimeout(500);
  await p.locator('.mm-rows a[href$="/drops"]').click(); await p.waitForURL('**/drops'); await p.waitForTimeout(600);
  ok('phone: a row link opens its page and the menu closes', (await mm.isHidden()) && await p.evaluate(() => document.getElementById('root').inert === false));
  await p.click('#menuBtn'); await p.waitForTimeout(500);
  await p.locator('.mm-foot .mm-pill[href$="/explore"]').click(); await p.waitForURL('**/explore'); await p.waitForSelector('.wheel svg');
  ok('phone: the Find your scent pill opens the finder', /Find your scent/.test(await p.locator('h1').innerText()));
  // the product local nav on a phone
  await p.goto(origin + '/product/roller-citrus-and-sun'); await p.waitForSelector('.lnav'); await p.waitForTimeout(800);
  ok('phone: the local nav keeps the name and the add pill, and folds the links into a tray', await p.evaluate(() => { const name = document.querySelector('.lnav-name b'), pill = document.querySelector('.lnav-add'), more = document.querySelector('.lnav-more'); return name.getBoundingClientRect().width > 60 && pill.getBoundingClientRect().right <= innerWidth && more.offsetParent !== null && getComputedStyle(document.querySelector('.lnav-links')).visibility === 'hidden'; }));
  ok('phone: the pill reads "Add · $X" but is named "Add to cart · $X"', /^Add · \$\d+\.\d{2}$/.test((await p.locator('.lnav-add').innerText()).replace(/\s+/g, ' ').trim()) && /^Add to cart · \$/.test(await p.locator('.lnav-add').getAttribute('aria-label')), await p.locator('.lnav-add').innerText());
  ok('phone: the tray button says which section you are in', (await p.locator('.lnav-cur').innerText()) === 'Scent' && (await p.getAttribute('.lnav-more', 'aria-expanded')) === 'false');
  await p.click('.lnav-more'); await p.waitForTimeout(500);
  ok('phone: the tray opens with the section links', (await p.getAttribute('.lnav-more', 'aria-expanded')) === 'true' && (await p.locator('.lnav-links a:visible').count()) >= 3 && (await overflow(p)) <= 1);
  await p.click('.lnav-links a[data-sec="p-practice"]'); await p.waitForTimeout(1200);
  ok('phone: picking a section closes the tray, scrolls there and updates the label', (await p.getAttribute('.lnav-more', 'aria-expanded')) === 'false' && (await p.locator('.lnav-cur').innerText()) === 'Practice' && await p.evaluate(() => document.querySelector('.lnav').classList.contains('is-stuck')));
  const c0 = Number(await p.locator('#cartCount').innerText());
  await p.click('.lnav-add'); await p.waitForTimeout(600);
  ok('phone: the pill adds to the cart', Number(await p.locator('#cartCount').innerText()) === c0 + 1);
  ok('phone: no sideways scroll', (await overflow(p)) <= 1);
  ok('phone: no JS errors', errs.length === 0, errs.join(' | ').slice(0, 300));
  await ctx.close();
}

{ // phone, reduced motion: the menu simply appears
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' }); const p = await ctx.newPage(); p.setDefaultTimeout(8000); await setupMocks(p);
  await p.goto(origin + '/'); await p.waitForSelector('#dProducts .sp'); await p.waitForTimeout(400);
  await p.click('#menuBtn'); await p.waitForTimeout(250);
  ok('phone reduced motion: rows are shown without movement and the stars do not twinkle', await p.evaluate(() => { const r = document.querySelector('.mm-rows > .mm-row'); return getComputedStyle(r).opacity === '1' && getComputedStyle(r).transform === 'none' && getComputedStyle(document.querySelector('.mm-stars circle')).animationName === 'none'; }));
  await ctx.close();
}
await b.close(); process.exit(res.every(Boolean) ? 0 : 1);
