import { chromium } from 'playwright-core';
import { setupMocks } from './mock.mjs';
const base = process.env.BASE ?? 'http://localhost:4173/#';
const routes = ['/', '/shop', '/product/cabana', '/subscribe', '/drops', '/gift', '/club', '/wall', '/coaching', '/help', '/explore', '/quiz', '/build', '/sets', '/book'];
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); p.setDefaultTimeout(8000); await setupMocks(p);
const tally = {};
for (const r of routes) {
  await p.goto(base + r); await p.waitForTimeout(1600);
  const found = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('main *, #overlay *').forEach(el => {
      const cs = getComputedStyle(el); const bg = cs.backgroundColor; const rc = el.getBoundingClientRect();
      if ((bg === 'rgb(255, 255, 255)') && rc.width > 120 && rc.height > 50) {
        const cls = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
        out.push(el.tagName.toLowerCase() + (cls ? '.' + cls : '') );
      }
    });
    return out;
  });
  const uniq = [...new Set(found)]; uniq.forEach(u => { tally[u] = (tally[u] || []).concat(r); });
  console.log(r.padEnd(14), uniq.length ? uniq.join('  ') : '(none)');
}
console.log('\nBY SELECTOR:'); Object.entries(tally).sort((a, b) => b[1].length - a[1].length).forEach(([k, v]) => console.log(k.padEnd(28), v.length, 'pages'));
await b.close();
