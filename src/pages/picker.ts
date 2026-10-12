// The candles of the breathing pause: only candles that are in the shop and that Claire has photographed.
// Add one here when Claire sends a photograph of another candle (cut out like /img/studio/cut/, with an unlit and a
// glow version made by tools/photo or by hand, see public/img/studio/picker/). Never a 3D render, a past scent or an
// invented product: the price and the Add to cart button come only from the live catalogue, matched on the slug.
import { loadCatalogue, type Item } from '../wix';

/** A wick: where its flame stands (the flame's base, as fractions of the photo's width and height), how tall the photographed flame was
 * (a fraction of the photo's width), and whether its foot is hidden behind a glass rim (then the flame is cut at its base). */
export interface Wick { x: number; y: number; h: number; rim?: boolean }

export interface PickerCandle {
  slug: string;          // the live product's slug
  name: string;
  /** the photo, as /img/studio/picker/<image>-unlit-<w>.webp and -glow-<w>.webp, 900 and 480 wide */
  image: string;
  /** the photo's size at 900 wide */
  w: number; h: number;
  wicks: Wick[];
  /** a short line under the name: drafts for Claire until she confirms them */
  line: string; draft: boolean;
  alt: string;
}

export const PICKER_CANDLES: PickerCandle[] = [
  {
    slug: 'cabana', name: 'Cabana', image: 'cabana', w: 900, h: 802,
    wicks: [{ x: 0.6889, y: 0.1209, h: 0.098, rim: true }, { x: 0.2267, y: 0.8317, h: 0.07 }],
    line: 'Sunny and warm, for a slow golden evening.', draft: true,
    alt: 'Cabana: a candle in a white glass tumbler with the black Daily Rituals label, a small black tin and its Cabana lid in front',
  },
  {
    slug: 'verdant', name: 'Verdant', image: 'verdant', w: 900, h: 677,
    wicks: [{ x: 0.7356, y: 0.1418, h: 0.098, rim: true }, { x: 0.2056, y: 0.8464, h: 0.064 }],
    line: 'Green and grounding, for a quieter mind.', draft: true,
    alt: 'Verdant: a candle in a white glass tumbler with the black Daily Rituals label, a small black tin and its Verdant lid in front',
  },
];

export const pickerSrc = (c: PickerCandle, kind: 'unlit' | 'glow', w: 480 | 900 = 900) => `/img/studio/picker/${c.image}-${kind}-${w}.webp`;

export interface LiveCandle { item?: Item; roller?: Item }

/** The live product for each candle (and its matching fragrance roller, if the shop has one). Nothing is invented: a candle
 * whose slug is not in the catalogue simply has no item, and its price and Add to cart stay hidden. */
export async function matchLive(cs: PickerCandle[]): Promise<Map<string, LiveCandle>> {
  const out = new Map<string, LiveCandle>();
  let items: Item[] = [];
  try { items = await loadCatalogue(); } catch { return out; }
  for (const c of cs) {
    const item = items.find(i => i.slug === c.slug && i.format === 'candle');
    const scent = (item?.scent ?? c.name).toLowerCase();
    const roller = items.find(i => i.format === 'roller' && i.scent.toLowerCase() === scent);
    out.set(c.slug, { item, roller });
  }
  return out;
}

const KEY = 'dr_breathe_candle';
export const rememberCandle = (slug: string) => { try { localStorage.setItem(KEY, slug); } catch { /* storage blocked */ } };
export const lastCandle = (): string | null => { try { return localStorage.getItem(KEY); } catch { return null; } };
