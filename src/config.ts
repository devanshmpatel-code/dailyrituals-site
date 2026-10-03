// Site configuration for the Daily Rituals Co. headless preview.
// Business facts that Claire has not confirmed stay marked as drafts in the UI.

/** Public OAuth client id of the headless client on the LIVE site (6f09acfe-…). Not a secret. */
export const WIX_CLIENT_ID: string = import.meta.env.VITE_WIX_CLIENT_ID ?? '';

/**
 * Preview safety switch. While false, nothing is written to the live site:
 * the cart is kept in this browser only, checkout is switched off, and
 * booking stops before a booking is created. Flip to "true" only at launch.
 */
export const WRITES_ENABLED: boolean = import.meta.env.VITE_ENABLE_WRITES === 'true';

export const STORES_APP_ID = '215238eb-22a5-4c36-9e7b-e7c08025e04e';
export const BOOKINGS_APP_ID = '13d21c63-b5ec-5912-8397-c3a5ddb27a97';
/** Staff resource type of the Bookings app on the site being read. Probably site-specific: override per Wix project. */
export const STAFF_RESOURCE_TYPE_ID: string = import.meta.env.VITE_STAFF_RESOURCE_TYPE_ID || '1cd44cf8-756f-41c3-bd90-3e2ffcaf1155';
export const TIME_ZONE = 'America/Vancouver';

/** From the canvas announcement bar. */
export const FREE_SHIPPING_THRESHOLD = 75;

export type Mood = 'fresh' | 'sunny' | 'floral' | 'woody' | 'grounding';
export type Format = 'roller' | 'diffuser' | 'candle' | 'deodorant';

export const MOODS: Record<Mood, { label: string; swatch: string; backdrop: string }> = {
  fresh: { label: 'Fresh and coastal', swatch: '#6E9E99', backdrop: '/img/mood-fresh.jpg' },
  sunny: { label: 'Sunny and tropical', swatch: '#C9962E', backdrop: '/img/mood-sunny.jpg' },
  floral: { label: 'Soft and floral', swatch: '#C27C73', backdrop: '/img/mood-floral.jpg' },
  woody: { label: 'Warm and woody', swatch: '#9C6B45', backdrop: '/img/mood-woody.jpg' },
  grounding: { label: 'Grounding', swatch: '#5E7A58', backdrop: '/img/mood-grounding.jpg' },
};

/** Scent families as listed in the Daily Rituals design system (tokens.json, mood-* usage notes). */
export const SCENT_MOOD: Record<string, Mood> = {
  'windy beach': 'fresh',
  'sea foam': 'fresh',
  'citrus & sun': 'fresh',
  cabana: 'sunny',
  'tropical passion': 'sunny',
  'peony bloom': 'floral',
  'golden apricot': 'floral',
  'cedar santal': 'woody',
  'campfire stories': 'woody',
  'desert vesper': 'woody',
  'inner sanctum': 'grounding',
  'golden meridian': 'grounding',
  verdant: 'grounding',
};

export const FORMAT_LABEL: Record<Format, string> = {
  roller: 'Fragrance Roller',
  diffuser: 'Mini Diffuser',
  candle: 'Candle',
  deodorant: 'Natural Deodorant',
};

export type MomentKey = 'dawn' | 'morning' | 'midday' | 'golden' | 'night';

export interface Moment {
  key: MomentKey;
  name: string;
  time: string;
  hour: number;
  title: string;
  line: string;
  /** true when the line or product pairing is not from the approved canvas */
  draft: boolean;
  image: string;
  imageAlt: string;
  mood: Mood;
  /** the "ritual" pairing: scent of the diffuser and scent of the roller */
  pair: { diffuser: string; roller: string };
  sky: [string, string, string];
  dark: boolean;
}

// Golden hour is the approved canvas state. The other four moments only exist in
// the canvas as image titles, so their lines and pairings are drafts for Claire.
export const MOMENTS: Moment[] = [
  { key: 'dawn', name: 'Dawn', time: '6:30 am', hour: 6.5, title: 'Wake up bright', line: 'Bright and clean. Citrus & Sun opens the day before the inbox does.', draft: true, image: '/img/morning.jpg', imageAlt: 'Wake up bright', mood: 'fresh', pair: { diffuser: 'citrus & sun', roller: 'windy beach' }, sky: ['#2E2A4A', '#F2A97E', '#F8DCC0'], dark: false },
  { key: 'morning', name: 'Morning', time: '9:00 am', hour: 9, title: 'Head out lighter', line: 'Salt air on your wrists for the walk, the commute or the school run.', draft: true, image: '/img/mood-fresh.jpg', imageAlt: 'Head out lighter', mood: 'sunny', pair: { diffuser: 'cabana', roller: 'sea foam' }, sky: ['#8FBCD4', '#CFE4EC', '#F3F1EA'], dark: false },
  { key: 'midday', name: 'Midday', time: '1:00 pm', hour: 13, title: 'Reset at your desk', line: 'A grounding scent between meetings. One breath, then back to it.', draft: true, image: '/img/midday.jpg', imageAlt: 'Reset at your desk', mood: 'grounding', pair: { diffuser: 'inner sanctum', roller: 'golden meridian' }, sky: ['#6FA7C6', '#B9D8E3', '#EEF1EA'], dark: false },
  { key: 'golden', name: 'Golden hour', time: '6:00 pm', hour: 18, title: 'Come home to yourself', line: 'Warm, dry and glowing. Desert Vesper or Cabana marks the line between work and the rest of your evening.', draft: false, image: '/img/mood-woody.jpg', imageAlt: 'Come home to yourself', mood: 'woody', pair: { diffuser: 'desert vesper', roller: 'cabana' }, sky: ['#6B4A6E', '#E08E5A', '#F4C98E'], dark: false },
  { key: 'night', name: 'Night', time: '9:30 pm', hour: 21.5, title: 'Wind down', line: 'Lights low and the candle lit. Campfire Stories for the last hour of the day.', draft: true, image: '/img/evening.jpg', imageAlt: 'Wind down', mood: 'floral', pair: { diffuser: 'campfire stories', roller: 'inner sanctum' }, sky: ['#0F0D1C', '#2A1F3D', '#4A2D4F'], dark: true },
];

/** Moon Drop release date shown on the canvas ("Sunday, October 11"). Unconfirmed. */
export const NEXT_DROP_ISO = '2026-10-11T00:00:00-07:00';
