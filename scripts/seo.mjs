// After `vite build`: write robots.txt and sitemap.xml into dist/.
// Before launch robots.txt blocks everything. At launch it allows crawling and points to the sitemap.
// Product pages are read from the live Wix catalogue when the build can reach it; otherwise only the main pages are listed.
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const env = Object.fromEntries((existsSync('.env') ? readFileSync('.env', 'utf8') : '').split('\n').filter(l => /^\w+=/.test(l)).map(l => [l.split('=')[0], l.slice(l.indexOf('=') + 1).trim()]));
const get = k => process.env[k] ?? env[k];
const launched = get('VITE_LAUNCH') === 'true';
const origin = (get('SITE_URL') || 'https://www.dailyritualsco.com').replace(/\/$/, '');
const clientId = get('VITE_WIX_CLIENT_ID');

const pages = ['', 'shop', 'explore', 'coaching', 'reset', 'subscribe', 'drops', 'gift', 'wall', 'club', 'story', 'help', 'privacy', 'terms', 'accessibility', 'refund-policy'];

async function productSlugs() {
  if (!clientId) return [];
  try {
    const tok = await fetch('https://www.wixapis.com/oauth2/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clientId, grantType: 'anonymous' }) }).then(r => r.json());
    const res = await fetch('https://www.wixapis.com/stores/v3/products/query', { method: 'POST', headers: { 'content-type': 'application/json', authorization: tok.access_token }, body: JSON.stringify({ query: { cursorPaging: { limit: 100 } } }) }).then(r => r.json());
    return (res.products ?? []).filter(p => p.visible !== false && p.slug).map(p => p.slug);
  } catch (e) { console.warn(`seo: could not read the Wix catalogue (${e.message}); sitemap lists main pages only`); return []; }
}

const slugs = await productSlugs();
const urls = [...pages.map(p => `${origin}/${p}`), ...slugs.map(s => `${origin}/product/${encodeURIComponent(s)}`)];
writeFileSync('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
writeFileSync('dist/robots.txt', launched ? `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n');
console.log(`seo: robots.txt (${launched ? 'open' : 'blocked, not launched'}), sitemap.xml with ${urls.length} pages (${slugs.length} products)`);
