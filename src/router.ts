// Routing that works in two modes, chosen at build time with VITE_ROUTING:
//   hash (default): #/shop           needs no server rewrites
//   path:           /shop            needs the host to serve index.html for unknown paths
// Canvas markup and page code keep writing "#/…" links; in path mode they are rewritten on click.

export const PATH_ROUTING = import.meta.env.VITE_ROUTING === 'path';

/** Current route as "seg/arg?query", without a leading slash. */
export function currentRoute(): string {
  if (PATH_ROUTING) return (location.pathname + location.search).replace(/^\/+/, '');
  return location.hash.replace(/^#\/?/, '');
}

/** Full URL for an app route such as "/shop?m=fresh" (used for redirects back from Wix pages). */
export function routeUrl(to: string): string {
  return PATH_ROUTING ? `${location.origin}${to}` : `${location.origin}/#${to}`;
}

export function navigate(to: string) {
  if (!PATH_ROUTING) { location.hash = `#${to}`; return; }
  history.pushState(null, '', to);
  window.dispatchEvent(new Event('routechange'));
}

export function onRoute(fn: () => void) {
  window.addEventListener(PATH_ROUTING ? 'popstate' : 'hashchange', fn);
  if (PATH_ROUTING) window.addEventListener('routechange', fn);
}

/** Path mode only: turn "#/…" links into real navigation, and upgrade old hash URLs. */
export function installLinkHandling() {
  if (!PATH_ROUTING) return;
  if (location.hash.startsWith('#/')) history.replaceState(null, '', location.hash.slice(1));
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a[href^="#/"]') as HTMLAnchorElement | null;
    if (!a || a.target === '_blank') return;
    e.preventDefault();
    navigate(a.getAttribute('href')!.slice(1));
  });
}
