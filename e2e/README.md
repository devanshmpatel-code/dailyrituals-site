# Browser tests (no network to Wix needed)

These replay a saved copy of the live catalogue (`products.json`, 28 products read from the live Wix site on 2026-10-03,
the read was cut off by a size limit so it is not the whole store) to the app and click through the customer journey.

    npm run build   # with VITE_WIX_CLIENT_ID set
    npx vite preview --port 4173 &
    CHROME=/path/to/chrome node e2e/journey.mjs     # shop, filters, product, cart, checkout switch, other pages, mobile + desktop
    CHROME=/path/to/chrome node e2e/leak.mjs        # no "[Confirm: …]" review notes or sample numbers visible to customers

Bookings services and time slots are not mocked with data yet, so the booking flow is not covered here.
