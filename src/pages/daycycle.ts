import { MOMENTS, type Moment } from '../config';

// One continuous day. Instead of five hard states, any hour of the day gets its own blend of the neighbouring moments:
// sky, sun or moon colour, how dark it is. Between 1:30 am and 6:30 am the night slowly turns into dawn.
const key = (k: string) => MOMENTS.find(m => m.key === k)!;
const NIGHT = key('night');
const ANCHORS: { h: number; m: Moment }[] = [
  { h: 1.5, m: NIGHT }, { h: 6.5, m: key('dawn') }, { h: 9, m: key('morning') }, { h: 13, m: key('midday') },
  { h: 18, m: key('golden') }, { h: 21.5, m: NIGHT }, { h: 25.5, m: NIGHT },
];

const rgb = (h: string): [number, number, number] => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mixRgb = (a: string, b: string, t: number): [number, number, number] => { const x = rgb(a), y = rgb(b); return [0, 1, 2].map(i => Math.round(x[i] + (y[i] - x[i]) * t)) as [number, number, number]; };
const css = (c: [number, number, number]) => `rgb(${c[0]},${c[1]},${c[2]})`;

export interface Look { a: Moment; b: Moment; t: number; sky: [string, string, string]; orb: string; orbRgb: [number, number, number]; night: number; nearest: Moment }

export function look(hour: number): Look {
  let h = hour; if (h < 1.5) h += 24; if (h >= 25.5) h -= 24;
  let i = 0; while (i < ANCHORS.length - 2 && h >= ANCHORS[i + 1].h) i++;
  const A = ANCHORS[i], B = ANCHORS[i + 1], t = Math.min(1, Math.max(0, (h - A.h) / (B.h - A.h)));
  const e = t * t * (3 - 2 * t); // ease the blend so each moment holds a little before it moves on
  const sky = [0, 1, 2].map(k => css(mixRgb(A.m.sky[k], B.m.sky[k], e))) as [string, string, string];
  const orbRgb = mixRgb(A.m.orb, B.m.orb, e);
  const night = (A.m.dark ? 1 : 0) * (1 - e) + (B.m.dark ? 1 : 0) * e;
  return { a: A.m, b: B.m, t: e, sky, orb: css(orbRgb), orbRgb, night, nearest: e < 0.5 ? A.m : B.m };
}
