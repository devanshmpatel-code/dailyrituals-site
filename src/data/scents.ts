// The owner's product list: the one source of truth for which scents exist, which scent families each belongs to and
// which formats each is made in. Everything that names a family or decides what may be shown reads it from here: the
// catalogue allow-list (wix.ts), the shop's family chips, the product pages, the Scent Sky, the quiz, the menus and SEO.
//
// The list says what EXISTS. Whether a scent in a format can be BOUGHT is decided by the live Wix catalogue alone: only a
// product that is in Wix and in stock is buyable, with Wix's own price, sizes and photographs. Anything on the list that is
// not in Wix yet shows as "Coming soon" (no price, no Add to cart) and becomes buyable by itself once it is added in Wix.
// Products in Wix that are NOT on the list are hidden everywhere (see onList and loadCatalogue).
//
// Family descriptions are new wording: drafts for Claire (rendered inside <span class="d">).
import type { Item } from '../wix';

export type Family = 'fruity' | 'green' | 'marine' | 'floral' | 'aromatic' | 'woody' | 'amber' | 'gourmand' | 'spicy' | 'citrus';
/** The formats on the list (the natural deodorant is not on it). */
export type ListFormat = 'candle' | 'diffuser' | 'roller';

export interface FamilyInfo {
  key: Family;
  label: string;
  /** one word, for tight places (the Sky, chips) */
  short: string;
  /** the family's colour on a light ground (chips, swatches) */
  swatch: string;
  /** the same hue lifted so a star still reads on the night sky */
  star: string;
  /** one plain line: a DRAFT for Claire, always rendered inside <span class="d"> */
  desc: string;
}

/** The ten families, in the owner's order (Citrus is used by four scents, so it is the tenth). */
export const FAMILY_ORDER: Family[] = ['fruity', 'green', 'marine', 'floral', 'aromatic', 'woody', 'amber', 'gourmand', 'spicy', 'citrus'];

export const FAMILIES: Record<Family, FamilyInfo> = {
  fruity: { key: 'fruity', label: 'Fruity', short: 'Fruity', swatch: '#B4566A', star: '#E795A4', desc: 'Ripe and juicy, like orchard fruit and berries.' },
  green: { key: 'green', label: 'Green', short: 'Green', swatch: '#5E7A58', star: '#9CBC92', desc: 'Fresh-cut leaves, stems and garden air.' },
  marine: { key: 'marine', label: 'Marine Ozonic', short: 'Marine', swatch: '#4A8496', star: '#8FC6D4', desc: 'Sea spray, salt air and a clean breeze.' },
  floral: { key: 'floral', label: 'Floral', short: 'Floral', swatch: '#A8574A', star: '#E0A092', desc: 'Petals and blooms, from soft to lush.' },
  aromatic: { key: 'aromatic', label: 'Aromatic', short: 'Aromatic', swatch: '#6E6496', star: '#B3A8DB', desc: 'Herbal and clear, like crushed leaves and needles.' },
  woody: { key: 'woody', label: 'Woody', short: 'Woody', swatch: '#7E5B3E', star: '#C49B76', desc: 'Dry woods, bark and the forest floor.' },
  amber: { key: 'amber', label: 'Amber', short: 'Amber', swatch: '#A86A22', star: '#EDAE5A', desc: 'Warm and resinous, with a soft glow.' },
  gourmand: { key: 'gourmand', label: 'Gourmand', short: 'Gourmand', swatch: '#9A6A4E', star: '#E8BE96', desc: 'Sweet and edible, like baking and caramel.' },
  spicy: { key: 'spicy', label: 'Spicy', short: 'Spicy', swatch: '#A4442E', star: '#EC8A6C', desc: 'Warm spice, like cinnamon, clove and pepper.' },
  citrus: { key: 'citrus', label: 'Citrus', short: 'Citrus', swatch: '#B08A12', star: '#F2D36B', desc: 'Bright peel and zest.' },
};
export const familyList = (): FamilyInfo[] => FAMILY_ORDER.map(f => FAMILIES[f]);
export const isFamily = (s: string | null | undefined): s is Family => !!s && (FAMILY_ORDER as string[]).includes(s);

export interface ScentDef {
  name: string;
  /** a stable key for addresses (#/explore?scent=windy-beach) */
  id: string;
  families: Family[];
  formats: ListFormat[];
}

// name | families | formats (C candle, D mini diffuser, R fragrance roller), exactly as the owner sent it
const LIST = `
Citrus & Sun | Citrus, Spicy, Fruity | C D R
Cabana | Fruity, Gourmand, Marine Ozonic, Floral | C D R
Desert Vesper | Woody, Aromatic | C D R
Golden Meridian | Gourmand, Amber | C D R
Campfire Stories | Woody, Amber, Floral | C D
Verdant | Green, Woody, Floral | C
Buttercake | Gourmand | C
Pumpkin Season | Gourmand, Spicy | C
Cashmere Season | Gourmand, Spicy, Amber, Green | C
Forest Bathing | Woody, Aromatic | C D R
Baked Apple | Fruity, Gourmand | C
Last Call | Amber, Gourmand | C
Alpine Lodge | Woody, Aromatic, Spicy | C D
Inner Sanctum | Woody, Amber, Spicy | D R
Peony Bloom | Floral, Fruity | D R
Amber & Rose | Floral, Amber | C D R
Midnight Forest | Woody, Amber | C D R
Sugar Crumb | Gourmand | C D R
Cedar & Moss | Woody, Gourmand, Amber | C D R
Temple Smoke | Woody, Spicy, Amber | C D R
Lavender Haze | Floral, Gourmand | C D R
Winter Solstice | Gourmand, Floral, Amber, Fruity | R
Golden Apricot | Gourmand, Floral, Amber, Fruity | R
Sea Foam | Marine Ozonic, Amber, Citrus | D R
Windy Beach | Marine Ozonic, Woody, Citrus, Floral, Amber | D R
Cedar Santal | Woody, Amber | D R
Tropical Passion | Fruity, Gourmand, Floral, Amber | D R
Mulled Wine | Spicy, Fruity, Citrus, Woody | C`;

const FAMILY_BY_LABEL = new Map(FAMILY_ORDER.map(f => [FAMILIES[f].label.toLowerCase(), f] as const));
const FORMAT_BY_CODE: Record<string, ListFormat> = { C: 'candle', D: 'diffuser', R: 'roller' };

/** A scent name as a matching key: case, spacing, "+", "&" and "and" do not matter ("Amber + Rose" is "Amber & Rose"). */
export const scentKey = (s: string) => s.toLowerCase().replace(/\s*\+\s*/g, ' & ').replace(/\band\b/g, '&').replace(/\s*&\s*/g, ' & ').replace(/\s+/g, ' ').trim();
const idOf = (s: string) => scentKey(s).replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const SCENTS: ScentDef[] = LIST.trim().split('\n').map(row => {
  const [name, fams, fmts] = row.split('|').map(x => x.trim());
  const families = fams.split(',').map(x => {
    const f = FAMILY_BY_LABEL.get(x.trim().toLowerCase());
    if (!f) throw new Error(`scents.ts: unknown family "${x}" for ${name}`);
    return f;
  });
  return { name, id: idOf(name), families, formats: fmts.split(/\s+/).map(c => FORMAT_BY_CODE[c]) };
});

const BY_KEY = new Map(SCENTS.map(s => [scentKey(s.name), s]));
const BY_ID = new Map(SCENTS.map(s => [s.id, s]));
/** The list entry for a scent name (any spelling of "&" / "+" / "and"), or undefined when the scent is not on the list. */
export const scentDef = (name: string): ScentDef | undefined => BY_KEY.get(scentKey(name));
export const scentById = (id: string | null | undefined): ScentDef | undefined => (id ? BY_ID.get(id) : undefined);
/** A scent's families in the owner's order for it (the first is its leading family). Empty when it is not on the list. */
export const familiesOf = (name: string): Family[] => scentDef(name)?.families ?? [];
export const scentsIn = (f: Family): ScentDef[] => SCENTS.filter(s => s.families.includes(f));

/** The allow-list: true only for a scent AND format that are on the owner's list. */
export function onList(scent: string, format: string): boolean {
  const d = scentDef(scent);
  return !!d && (d.formats as string[]).includes(format);
}

/** Can this live product be bought today: in stock and priced (Wix decides both). */
export const isBuyable = (i: Item) => i.inStock && i.priceMin > 0 && (!i.choices.length || i.choices.some(c => c.inStock));

/** One format of a scent on the list, with its live product when Wix has it. */
export interface Offer { format: ListFormat; item?: Item; buyable: boolean }
export const FORMAT_ORDER: ListFormat[] = ['candle', 'diffuser', 'roller'];
/** Every format the list gives a scent, each matched to the live catalogue (by name, "+" and "&" alike). */
export function offersOf(def: ScentDef, items: Item[]): Offer[] {
  return FORMAT_ORDER.filter(f => def.formats.includes(f)).map(format => {
    const item = items.find(i => i.format === format && scentKey(i.scent) === scentKey(def.name));
    return { format, item, buyable: !!item && isBuyable(item) };
  });
}
export const isComingSoon = (def: ScentDef, items: Item[]) => !offersOf(def, items).some(o => o.buyable);
