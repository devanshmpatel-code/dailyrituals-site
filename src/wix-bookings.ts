import { services, availabilityTimeSlots, bookings } from '@wix/bookings';
import { createCart, calculateCart, placeOrder } from '@wix/auto_sdk_ecom_cart-v-2';
import { wix as base } from './wix';
import { BOOKINGS_APP_ID } from './config';

// Bookings and the coaching checkout, bound on the site's one visitor client (same tokens). Only the coaching page loads
// this, so the Bookings SDK stays out of the bundle every other page downloads.
export const wix = Object.assign(
  base.use({ services, availabilityTimeSlots, bookings, createCart, calculateCart, placeOrder }),
  { redirects: base.redirects },
);

export async function loadServices() {
  const { items } = await wix.services.queryServices({ conditionalFields: ['STAFF_MEMBER_DETAILS'] as any })
    .eq('appId', BOOKINGS_APP_ID).limit(100).find();
  return items.filter((s: any) => !s.hidden);
}
