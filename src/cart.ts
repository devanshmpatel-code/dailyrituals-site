import { WRITES_ENABLED, STORES_APP_ID } from './config';
import { wix, saveTokens } from './wix';
import { routeUrl } from './router';

export interface Line {
  key: string;          // productId + choice
  productId: string;
  slug: string;
  name: string;
  choice?: string;      // e.g. "8 oz" or "Westcoast"
  optionName?: string;
  price: number;
  image: string;
  qty: number;
  gift?: GiftDetails;   // Send a Sunrise: the card and delivery details travel with the line
}

/**
 * What the buyer wrote on Send a Sunrise. Kept on the local cart line (this browser only while checkout is off).
 * Before checkout is switched on, these need a home in the live Wix cart (e.g. custom text fields on the candles, or a
 * buyer note at checkout): addToLiveCart below does not send them yet.
 */
export interface GiftDetails {
  to: string;           // recipient name, printed on the card
  note: string;         // the card note (140 characters at most)
  date?: string;        // arrive on or after, YYYY-MM-DD (empty: as soon as it is ready)
  hidePrices: boolean;  // hide prices on the packing slip
  sky?: string;         // the card's sky: dawn, golden or night
}

type Listener = () => void;
const listeners: Listener[] = [];
export const onCart = (fn: Listener) => listeners.push(fn);
const emit = () => listeners.forEach(fn => fn());

function read(): Line[] {
  try { return JSON.parse(localStorage.getItem('dr_cart') ?? '[]'); } catch { return []; }
}
function write(lines: Line[]) {
  try { localStorage.setItem('dr_cart', JSON.stringify(lines)); } catch { /* storage blocked: cart lives in memory */ }
}

let lines: Line[] = read();
export const getLines = () => lines;
export const count = () => lines.reduce((n, l) => n + l.qty, 0);
export const subtotal = () => lines.reduce((n, l) => n + l.qty * l.price, 0);

export async function add(line: Omit<Line, 'key' | 'qty'>, qty = 1) {
  // a gift is its own line (its own card and note), never merged into the same candle bought for oneself
  const key = `${line.productId}::${line.choice ?? ''}${line.gift ? `::gift-${Date.now().toString(36)}` : ''}`;
  const found = line.gift ? undefined : lines.find(l => l.key === key);
  if (found) found.qty += qty; else lines.push({ ...line, key, qty });
  write(lines); emit();
  if (WRITES_ENABLED) await addToLiveCart(line.productId, line.optionName, line.choice, qty);
}

export function setQty(key: string, qty: number) {
  const line = lines.find(l => l.key === key);
  lines = lines.map(l => (l.key === key ? { ...l, qty } : l)).filter(l => l.qty > 0);
  write(lines); emit();
  if (WRITES_ENABLED && line) syncLiveQty(line, qty).catch(err => console.error('Live cart sync failed', err));
}

/** Mirror a quantity change into the live Wix cart. Line items are matched on product + variant. */
async function syncLiveQty(line: Line, qty: number) {
  const variantId = await resolveVariantId(line.productId, line.optionName, line.choice);
  const { cart } = await (wix.currentCartV2 as any).getCurrentCart();
  const live = (cart?.lineItems ?? []).find((li: any) =>
    li.catalogReference?.catalogItemId === line.productId && (!variantId || li.catalogReference?.options?.variantId === variantId));
  if (!live) return;
  if (qty > 0) await (wix.currentCartV2 as any).updateLineItemsInCurrentCart({ lineItems: [{ lineItemId: live._id, quantity: { newQuantity: qty } }] });
  else await (wix.currentCartV2 as any).removeLineItemsFromCurrentCart([live._id]);
  saveTokens();
}

async function resolveVariantId(productId: string, optionName?: string, choice?: string) {
  const { items } = await wix.readOnlyVariantsV3.queryVariants().eq('productData.productId', productId).find();
  const match = items.find((v: any) =>
    (v.optionChoices ?? []).some((c: any) => c.optionChoiceNames?.optionName === optionName && c.optionChoiceNames?.choiceName === choice));
  const v: any = match ?? items[0];
  return v?.variantId ?? v?._id;
}

async function addToLiveCart(productId: string, optionName?: string, choice?: string, quantity = 1) {
  const variantId = await resolveVariantId(productId, optionName, choice);
  await wix.currentCartV2.addLineItemsToCurrentCart({
    catalogItems: [{ quantity, catalogReference: { catalogItemId: productId, appId: STORES_APP_ID, options: { variantId } } }],
  } as any);
  saveTokens();
}

/** Hosted Wix checkout. Only reachable when WRITES_ENABLED is true. */
export async function checkout() {
  if (!WRITES_ENABLED) return;
  const { cart } = await (wix.currentCartV2 as any).getCurrentCart();
  const session = await wix.redirects.createRedirectSession({
    ecomCheckout: { checkoutId: cart._id },
    callbacks: { postFlowUrl: routeUrl('/'), thankYouPageUrl: routeUrl('/order-confirmed') },
  });
  window.location.href = session.redirectSession!.fullUrl!;
}
