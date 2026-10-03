import { createClient, OAuthStrategy, media } from '@wix/sdk';
import { productsV3, readOnlyVariantsV3 } from '@wix/stores';
import { currentCartV2 } from '@wix/ecom';
import { redirects } from '@wix/redirects';
import { services, availabilityTimeSlots, bookings } from '@wix/bookings';
import { createCart, calculateCart, placeOrder } from '@wix/auto_sdk_ecom_cart-v-2';
import {
  WIX_CLIENT_ID, SCENT_MOOD, FORMAT_LABEL, BOOKINGS_APP_ID,
  type Format, type Mood,
} from './config';

// One visitor client for the whole site (non-Astro path: manual OAuthStrategy, clientId only).
// Visitor tokens are kept in sessionStorage so a refresh keeps the same visitor (and cart).
function loadTokens() {
  try { const t = sessionStorage.getItem('dr_tokens'); return t ? JSON.parse(t) : undefined; } catch { return undefined; }
}

export const wix = createClient({
  modules: {
    productsV3, readOnlyVariantsV3, currentCartV2, redirects,
    services, availabilityTimeSlots, bookings, createCart, calculateCart, placeOrder,
  },
  auth: OAuthStrategy({ clientId: WIX_CLIENT_ID, tokens: loadTokens() }),
});

export function saveTokens() {
  try { sessionStorage.setItem('dr_tokens', JSON.stringify(wix.auth.getTokens())); } catch { /* private mode */ }
}

export const hasClient = () => WIX_CLIENT_ID.length > 0;

// ---------- images ----------
export function imgSrc(v: unknown, w = 800, h = 1000): string {
  const raw: any = (v as any)?.image ?? (v as any)?.url ?? v;
  const val = typeof raw === 'string' ? raw : raw?.url ?? raw?.id ?? '';
  if (!val) return '';
  if (val.startsWith('wix:image://')) return media.getScaledToFillImageUrl(val, w, h, {});
  if (val.startsWith('http')) return val;
  // bare media id such as "e700e8_…~mv2.jpg" (Bookings returns these)
  return media.getScaledToFillImageUrl(`wix:image://v1/${val}/${val}#originWidth=${w}&originHeight=${h}`, w, h, {});
}

// ---------- money ----------
export const money = (n: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', currencyDisplay: 'narrowSymbol' }).format(n);

// ---------- catalogue model ----------
export interface Choice { name: string; inStock: boolean }
export interface Item {
  id: string;
  slug: string;
  name: string;
  scent: string;
  format: Format;
  formatLabel: string;
  sizeLabel: string;
  mood?: Mood;
  priceMin: number;
  priceMax: number;
  image: string;
  thumb: string;
  inStock: boolean;
  optionName?: string;
  choices: Choice[];
  description: string;
  categoryId?: string;
}

const FORMAT_SUFFIX: [RegExp, Format][] = [
  [/\s*fragrance roller$/i, 'roller'],
  [/\s*mini diffuser$/i, 'diffuser'],
  [/\s*natural deodorant$/i, 'deodorant'],
];

export function classify(name: string, optionChoices: string[]): { scent: string; format: Format } {
  for (const [re, f] of FORMAT_SUFFIX) if (re.test(name)) return { scent: name.replace(re, '').trim() || name, format: f };
  if (/deodorant/i.test(name)) return { scent: name, format: 'deodorant' };
  // Everything else in the live store is a candle (the "Product Info" section on these
  // items describes coconut-soy candles in 2 oz / 8 oz / 16 oz tins).
  void optionChoices;
  return { scent: name, format: 'candle' };
}

function sizeLabelFor(format: Format, choices: string[]): string {
  if (format === 'roller') return choices[0] ? choices[0].replace(/ml$/i, ' ml') : '10 ml';
  if (format === 'diffuser') return choices[0] ? choices[0].replace(/ml$/i, ' ml') : '8 ml';
  if (format === 'deodorant') return choices.length > 1 ? `${choices.length} scents` : '';
  return choices.join(' · ');
}

export function toItem(p: any): Item {
  const opt = (p.options ?? [])[0];
  const choices: Choice[] = (opt?.choicesSettings?.choices ?? [])
    .filter((c: any) => c.visible !== false)
    .map((c: any) => ({ name: c.name, inStock: c.inStock !== false }));
  const { scent, format } = classify(p.name, choices.map(c => c.name));
  const mood = SCENT_MOOD[scent.toLowerCase()];
  const main = p.media?.main;
  return {
    id: p._id,
    slug: p.slug,
    name: p.name,
    scent,
    format,
    formatLabel: FORMAT_LABEL[format],
    sizeLabel: sizeLabelFor(format, choices.map(c => c.name)),
    mood,
    priceMin: Number(p.actualPriceRange?.minValue?.amount ?? 0),
    priceMax: Number(p.actualPriceRange?.maxValue?.amount ?? 0),
    image: imgSrc(main, 900, 1125),
    thumb: imgSrc(main, 240, 300),
    inStock: p.inventory?.availabilityStatus !== 'OUT_OF_STOCK',
    optionName: opt?.name,
    choices,
    description: p.plainDescription ?? '',
    categoryId: p.mainCategoryId,
  };
}

export const PRODUCT_FIELDS = ['CURRENCY', 'PLAIN_DESCRIPTION'] as const;

let catalogue: Promise<Item[]> | null = null;
/** Every visible product in the live store (a visitor token only sees visible products). */
export function loadCatalogue(): Promise<Item[]> {
  if (!catalogue) {
    catalogue = (async () => {
      const out: Item[] = [];
      let res = await wix.productsV3.queryProducts({ fields: [...PRODUCT_FIELDS] as any }).limit(100).find();
      out.push(...res.items.map(toItem));
      while (res.hasNext()) { res = await res.next(); out.push(...res.items.map(toItem)); }
      saveTokens();
      return out;
    })().catch(err => { catalogue = null; throw err; });
  }
  return catalogue;
}

export async function loadProduct(slug: string) {
  const { product } = await wix.productsV3.getProductBySlug(slug, {
    fields: ['CURRENCY', 'PLAIN_DESCRIPTION', 'MEDIA_ITEMS_INFO', 'INFO_SECTION', 'INFO_SECTION_PLAIN_DESCRIPTION', 'VARIANT_OPTION_CHOICE_NAMES'] as any,
  });
  return product as any;
}

/** Find the live product for a scent + format (used to bind canvas cards to the live catalogue). */
export function findLive(items: Item[], scent: string, format: Format): Item | undefined {
  const s = scent.toLowerCase().replace(/\band\b/g, '&').replace(/\s+/g, ' ').trim();
  return items.find(i => i.format === format && i.scent.toLowerCase() === s);
}

// ---------- bookings ----------
export async function loadServices() {
  const { items } = await wix.services.queryServices({ conditionalFields: ['STAFF_MEMBER_DETAILS'] as any })
    .eq('appId', BOOKINGS_APP_ID).limit(100).find();
  return items.filter((s: any) => !s.hidden);
}
