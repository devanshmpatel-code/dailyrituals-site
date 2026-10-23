import { defineConfig, loadEnv } from 'vite';

// Before launch (VITE_LAUNCH not "true") every page carries <meta name="robots" content="noindex, nofollow">.
// The production build for the real domain drops it so search engines can index the site.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const launched = (process.env.VITE_LAUNCH ?? env.VITE_LAUNCH) === 'true';
  // Where the site lives, for the share-card address and picture in index.html (src/seo.ts sets the per-route ones at run time).
  const site = (process.env.SITE_URL ?? env.SITE_URL ?? process.env.VITE_SITE_URL ?? env.VITE_SITE_URL ?? 'https://www.dailyritualsco.com').replace(/\/$/, '');
  return {
    // one stylesheet for the whole site, in the same order as before the pages were split into chunks (a page's styles never
    // arrive late or in a different cascade order)
    build: { cssCodeSplit: false },
    plugins: [{
      name: 'launch-robots',
      transformIndexHtml: (html: string) => (launched ? html.replace(/\s*<meta name="robots"[^>]*>/, '') : html).replace(/__SITE_URL__/g, site),
    }],
  };
});
