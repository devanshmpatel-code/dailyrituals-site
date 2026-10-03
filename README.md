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

## Moving to Wix hosting (plan, not yet done)

Decision: Wix hosts the finished frontend. Per Wix's docs, a Vite single-page app is supported as a client-only build under "Wix-managed headless, other frameworks": run `npm create @wix/new@latest init`, build with `npm run build`, then `npx wix release`. This creates a **new** Wix project with its own client id and **no data**, so the sequence is:

1. Finish and review the app here (Vercel preview), reading the current live site.
2. Create the new Wix project. Recreate the catalogue, coaching services and any new apps there (Pricing Plans, Loyalty, CMS collections).
3. Set `VITE_WIX_CLIENT_ID` (and `VITE_STAFF_RESOURCE_TYPE_ID` if it differs) to the new project's values and test on the free Wix address with writes on.
4. Release, then move the domain last.

Open items: whether Wix static hosting supports path-route rewrites (hash routes need none), SEO (the limited integration has no built-in SEO), and the custom-domain steps for a managed project. None of these were tested.

## Real photographs instead of renders

- `src/photos.ts` maps each 3D render to a real photo from the Wix media library (`PHOTO_FOR`). They were chosen from Wix's automatic content tags and size, **not reviewed by eye**: they show with the draft outline when "Show drafts" is on, and the render stays in place if a photo fails to load. To change one, edit its `id`, `name`, `w` and `h` (from the Wix media manager).
- The opening's landscape is generated (`src/pages/landscape.ts`). To use real landscape photographs instead, add `dawn.jpg`, `morning.jpg`, `midday.jpg`, `golden.jpg` and `night.jpg` to `public/img/scenes/`; they replace the generated landscape automatically.
- Browser tests: `npm run test:e2e` (they replay a saved copy of the catalogue, so they do not need the Wix network).
