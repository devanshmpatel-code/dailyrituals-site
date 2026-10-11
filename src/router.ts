import { markMorphSource } from './pages/motion';
// Routing that works in two modes, chosen at build time with VITE_ROUTING:
//   path (default): /shop    real addresses search engines can follow; the host serves index.html for unknown paths (vercel.json)
//   hash:           #/shop   needs no server rewrites (used by the local test builds)
// Canvas markup and page code keep writing "#/…" links; in path mode they are rewritten to "/…" as they appear.

export const PATH_ROUTING = import.meta.env.VITE_ROUTING !== 'hash';

/** Current route as "seg/arg?query", without a leading slash. */
export function currentRoute(): string {
  if (PATH_ROUTING) return (location.pathname + location.search).replace(/^\/+/, '');
  return location.hash.replace(/^#\/?/, '');
}

/** Full URL for an app route such as "/shop?m=fresh" (used for redirects back from Wix pages). */
export function routeUrl(to: string): string {
  return PATH_ROUTING ? `${location.origin}${to}` : `${location.origin}/#${to}`;
}

let routeFn: (() => void | Promise<void>) | null = null;
type VT = { finished: Promise<void> };
const startVT = (document as unknown as { startViewTransition?: (cb: () => Promise<void>) => VT }).startViewTransition?.bind(document);

export function navigate(to: string) {
  if (!PATH_ROUTING) { location.hash = `#${to}`; return; }
  // a soft cross-fade between pages, and the clicked product picture glides into place (where the browser supports it)
  if (startVT && routeFn && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const fn = routeFn;
    const t = startVT(async () => { history.pushState(null, '', to); await fn(); });
    t.finished.finally(() => document.querySelectorAll<HTMLElement>('[style*="view-transition-name"]').forEach(el => { el.style.viewTransitionName = ''; }));
    return;
  }
  history.pushState(null, '', to);
  window.dispatchEvent(new Event('routechange'));
}

/** Like navigate, but replaces the current history entry (for correcting an address, such as an old product slug). */
export function replaceRoute(to: string) {
  if (!PATH_ROUTING) { location.replace(`#${to}`); return; }
  history.replaceState(null, '', to);
  window.dispatchEvent(new Event('routechange'));
}

export function onRoute(fn: () => void | Promise<void>) {
  routeFn = fn;
  window.addEventListener(PATH_ROUTING ? 'popstate' : 'hashchange', fn);
  if (!PATH_ROUTING) return;
  window.addEventListener('routechange', fn);
  // an old "#/…" link followed while already on the site: upgrade it to a real address and show that page
  window.addEventListener('hashchange', () => { if (location.hash.startsWith('#/')) { history.replaceState(null, '', location.hash.slice(1)); fn(); } });
}

/** "#/shop" -> "/shop" on every link inside root (path mode only). */
function rewriteLinks(root: ParentNode) {
  root.querySelectorAll?.<HTMLAnchorElement>('a[href^="#/"]').forEach(a => a.setAttribute('href', a.getAttribute('href')!.slice(1)));
}

/** A same-site link the app should handle itself (not a file, not a new tab, not a download). */
function isAppLink(a: HTMLAnchorElement) {
  const href = a.getAttribute('href') ?? '';
  if (!href.startsWith('/') || href.startsWith('//') || a.target === '_blank' || a.hasAttribute('download')) return false;
  return !/\.[a-z0-9]{2,5}($|\?)/i.test(href.split('#')[0]);
}

/** Path mode only: real links everywhere, in-app navigation on click, and old "#/…" addresses upgraded. */
export function installLinkHandling() {
  if (!PATH_ROUTING) return;
  if (location.hash.startsWith('#/')) history.replaceState(null, '', location.hash.slice(1));
  rewriteLinks(document);
  new MutationObserver(ms => ms.forEach(m => {
    if (m.type === 'attributes') { const a = m.target as HTMLAnchorElement; if (a.getAttribute('href')?.startsWith('#/')) rewriteLinks(a.parentElement ?? document); }
    else m.addedNodes.forEach(n => { if (n.nodeType !== 1) return; const el = n as Element; if (el.matches('a[href^="#/"]')) rewriteLinks(el.parentElement ?? document); else rewriteLinks(el); });
  })).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['href'] });
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a) return;
    const href = a.getAttribute('href')!;
    if (href.startsWith('#/')) { e.preventDefault(); markMorphSource(a); navigate(href.slice(1)); return; }
    if (isAppLink(a)) { e.preventDefault(); markMorphSource(a); navigate(href); }
  });
}
