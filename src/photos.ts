import { media } from '@wix/sdk';

// Real photographs from the Daily Rituals Co. Wix media library, used in place of the 3D renders.
// They were chosen from Wix's automatic content tags (bottles and oils, reed diffuser, candlelight) and their size, not by eye,
// so Claire should review them: they show with the draft outline when "Show drafts" is on. If a photo fails to load, the
// original render stays in place. Keys are the render file each photo replaces.
export const PHOTO_FOR: Record<string, { id: string; name: string; w: number; h: number }> = {
  'morning.jpg': { id: 'e700e8_3f0c68325efe4d409880e51bfe6fe3bb~mv2.jpg', name: '0G8A2584.jpg', w: 6720, h: 4480 },
  'mood-fresh.jpg': { id: 'e700e8_7a43982ee2ab4ee281f81eb346dcf1f0~mv2.jpg', name: '0G8A2582.jpg', w: 6473, h: 4315 },
  'midday.jpg': { id: 'e700e8_b39ceae977a04f11923d4e622aed7ea8~mv2.jpg', name: '0G8A2627.jpg', w: 6537, h: 4249 },
  'mood-woody.jpg': { id: 'e700e8_d3c81d3f6a9142baac6c62d16ef1cbeb~mv2.jpg', name: '0G8A2636.jpg', w: 6298, h: 4464 },
  'evening.jpg': { id: 'e700e8_ea0ba924f9604f91842854d6ed3c8deb~mv2.jpg', name: '0G8A2643.jpg', w: 6628, h: 4330 },
  'coaching.jpg': { id: 'e700e8_575ff29b74934a35ab7c6fc26232931f~mv2.jpg', name: '0G8A2632.jpg', w: 6298, h: 4199 },
};

export function photoUrl(renderFile: string, w = 1000, h = 1000): string | null {
  const p = PHOTO_FOR[renderFile];
  return p ? media.getScaledToFillImageUrl(`wix:image://v1/${p.id}/${p.name}#originWidth=${p.w}&originHeight=${p.h}`, w, h, {}) : null;
}

/** Swap every render in a page for its real photograph, keeping the render as the fallback. */
export function swapRenders(root: HTMLElement) {
  root.querySelectorAll<HTMLImageElement>('img').forEach(img => {
    if (img.dataset.photo) return;
    const m = img.getAttribute('src')?.match(/\/img\/([a-z-]+\.jpg)$/);
    const u = m && photoUrl(m[1]);
    if (!m || !u) return;
    const original = img.getAttribute('src')!;
    img.dataset.photo = '1';
    img.addEventListener('error', () => { img.src = original; }, { once: true });
    img.src = u;
  });
}
