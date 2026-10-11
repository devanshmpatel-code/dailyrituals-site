import { defineConfig, loadEnv } from 'vite';

// Before launch (VITE_LAUNCH not "true") every page carries <meta name="robots" content="noindex, nofollow">.
// The production build for the real domain drops it so search engines can index the site.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const launched = (process.env.VITE_LAUNCH ?? env.VITE_LAUNCH) === 'true';
  return {
    plugins: [{
      name: 'launch-robots',
      transformIndexHtml: (html: string) => launched ? html.replace(/\s*<meta name="robots"[^>]*>/, '') : html,
    }],
  };
});
