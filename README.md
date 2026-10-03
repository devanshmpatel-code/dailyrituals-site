# Daily Rituals Co. — coded site (private preview)

Vite + TypeScript frontend built from the final design canvas (v2, 2026-10-03) and the Daily Rituals design system. It reads the **live** Wix site (`6f09acfe-1cae-49c0-a974-0415699c3d8b`) through a visitor-only headless client. No catalogue was migrated.

## Run

```
npm install
echo "VITE_WIX_CLIENT_ID=c7b1b1ef-a707-4acf-82c3-771363e5a27f" > .env.local
npm run dev        # or: npm run build && npx vite preview
```

The client id is the public OAuth id of the "Daily Rituals coded preview" headless client on the live site. It is not a secret.

## Safety switch

`VITE_ENABLE_WRITES` defaults to off. While it is off, the cart stays in the visitor's browser, checkout is switched off, booking stops before a booking is created, and newsletter, birthday, referral, vote and upload actions show a "switched off in preview" message. Set it to `true` only at launch, after testing checkout and booking end to end.

## What is live and what is canvas

| Area | Source |
| --- | --- |
| Shop grid, product pages, prices, sizes, stock, photos, product information text | Live Wix Stores (Catalog V3) |
| Homepage hero products and Chapter 1 product rows | Live Wix Stores |
| Coaching service cards, booking page, open times | Live Wix Bookings |
| Hero, moods, lifestyle, Moon Drops, Ritual Wall, Solstice Box, Discovery Kit imagery | Canvas renders (outlined when "Show drafts" is on) |
| Ritualists, Moon Drops, Ritual on Repeat, Send a Sunrise, Ritual Wall, Pass the Light | Canvas markup, not connected (no backend set up yet) |

`src/canvas/` holds the canvas CSS and markup extracted verbatim. Overrides live in `src/site.css`.

## Routing

Hash routes (`#/shop`, `#/product/<slug>`, `#/coaching`, `#/book/<slug>`). Change to path routes with server rewrites and per-page SEO before launch.
