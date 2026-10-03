import fs from 'node:fs';
const S = new URL('.', import.meta.url).pathname;
const products = JSON.parse(fs.readFileSync(S + 'products.json', 'utf8')).products;
// 1x1-ish gradient PNG so layouts render without hitting blocked image hosts
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAYAAAC56t6BAAAAEUlEQVR42mP8z8Dwn4EIwDiqEAC1hAH9P7mMKwAAAABJRU5ErkJggg==', 'base64');
export const unmatched = [];
export async function setupMocks(page, { services = [], slots = [] } = {}) {
  await page.route(/static\.wixstatic\.com|fonts\.(googleapis|gstatic)\.com/, r => r.request().url().includes('googleapis') ? r.fulfill({ status: 200, contentType: 'text/css', body: '' }) : r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await page.route(/wixapis\.com/, async r => {
    const req = r.request(); const u = new URL(req.url()); const j = (o) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(o) });
    if (req.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (u.pathname.endsWith('/oauth2/token')) return j({ access_token: 'mock', refresh_token: 'mock', expires_in: 14400, token_type: 'Bearer' });
    if (u.pathname.endsWith('/stores/v3/products/query')) return j({ products, pagingMetadata: { count: products.length, hasNext: false } });
    const m = u.pathname.match(/\/stores\/v3\/products\/slug\/(.+)$/);
    if (m) { const p = products.find(x => x.slug === decodeURIComponent(m[1])); return p ? j({ product: p }) : r.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '{}' }); }
    if (/bookings\/v2\/services\/query/.test(u.pathname)) return j({ services, pagingMetadata: { count: services.length, hasNext: false } });
    if (/time-slots/.test(u.pathname)) return j({ timeSlots: slots });
    unmatched.push(req.method() + ' ' + u.pathname); return r.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '{}' });
  });
}
