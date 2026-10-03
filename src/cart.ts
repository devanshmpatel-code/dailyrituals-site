import { WRITES_ENABLED, STORES_APP_ID } from './config';
import { wix, saveTokens } from './wix';

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
  const key = `${line.productId}::${line.choice ?? ''}`;
  const found = lines.find(l => l.key === key);
  if (found) found.qty += qty; else lines.push({ ...line, key, qty });
  write(lines); emit();
  if (WRITES_ENABLED) await addToLiveCart(line.productId, line.optionName, line.choice, qty);
}

export function setQty(key: string, qty: number) {
  lines = lines.map(l => (l.key === key ? { ...l, qty } : l)).filter(l => l.qty > 0);
  write(lines); emit();
  // Live-cart quantity sync is a launch task (needs line-item ids from Cart V2).
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
  const origin = window.location.origin;
  const session = await wix.redirects.createRedirectSession({
    ecomCheckout: { checkoutId: cart._id },
    callbacks: { postFlowUrl: `${origin}/#/`, thankYouPageUrl: `${origin}/#/order-confirmed` },
  });
  window.location.href = session.redirectSession!.fullUrl!;
}
