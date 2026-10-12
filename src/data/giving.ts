// =====================================================================================================================
//  THE GIVING LEDGER: the only source for the giving tracker at /giving (and nothing else on the site counts money)
// =====================================================================================================================
//
//  Every total on /giving is added up from the entries in this file. Nothing is estimated and nothing is invented: while the
//  list below is empty, the page says plainly that the first report has not been posted yet.
//
//  HOW TO ADD A DONATION (after it has been made, never before)
//  1. Copy the example below, paste it inside the square brackets of GIVING, and fill it in.
//  2. date:      the day the donation was made, written YYYY-MM-DD (for example '2026-12-01').
//  3. amount:    dollars actually given, in Canadian dollars, as a plain number (48 or 48.50, no "$" and no commas).
//  4. recipient: who received it, written the way you want it shown (for example "BC Children's Hospital Foundation").
//  5. note:      optional. One or two short sentences: which orders it covers, what it is for.
//  6. orders:    optional. How many orders this donation covers ($1 for each). Only fill it in if you counted them.
//  7. proofUrl:  optional, but please add one: a link to the receipt or the charity's thank-you (a PDF or image placed in
//                public/giving/ is served at /giving/<file name>, or a link to a public post).
//  8. photo:     optional. A photo of the moment (put the file in public/giving/ and write '/giving/<file name>').
//     photoAlt:  a short description of that photo, for people who cannot see it. Please always add one with a photo.
//  9. Save, rebuild and deploy. Newest entries can go anywhere in the list: the page sorts them by date.
//
//  EXAMPLE (copy everything between the braces, including the braces, and end it with a comma):
//  {
//    date: '2026-12-01',
//    amount: 48,
//    recipient: "BC Children's Hospital Foundation",
//    note: 'Our November orders: $1 from each, toward children\'s cancer care.',
//    orders: 48,
//    proofUrl: '/giving/2026-11-receipt.pdf',
//    photo: '/giving/2026-11.webp',
//    photoAlt: 'Claire holding the donation receipt beside a lit Verdant candle',
//  },
//
//  Please do not add an entry for a donation that has not been made yet, and keep receipts somewhere safe.
// =====================================================================================================================

export interface GivingEntry {
  /** The day the donation was made, YYYY-MM-DD. */
  date: string;
  /** Dollars actually given (CAD). */
  amount: number;
  /** Who received it, as it should be shown. */
  recipient: string;
  /** A short note: what it covers or what it is for. */
  note?: string;
  /** How many orders this donation covers ($1 for each), if counted. */
  orders?: number;
  /** A link to the receipt or other proof of the donation. */
  proofUrl?: string;
  /** A photo of the moment, e.g. '/giving/2026-11.webp'. */
  photo?: string;
  /** A short description of the photo for screen readers. */
  photoAlt?: string;
}

// The ledger starts empty. Add real donations here, one entry each, after they are made.
export const GIVING: GivingEntry[] = [
];
