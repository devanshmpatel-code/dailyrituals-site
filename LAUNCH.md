# Launch checklist: replacing the dailyritualsco.com Wix pages with this site

**How it works after launch**
- `www.dailyritualsco.com` serves this site from Vercel.
- The existing Wix site (6f09acfe-…) stays the backend: products, bookings, contacts, payments and the dashboard.
- Checkout, login and member pages are Wix-hosted pages on a subdomain such as `checkout.dailyritualsco.com`.

This follows Wix's guide, "Migrate a Wix Site to a Self-Managed Headless Project":
https://dev.wix.com/docs/go-headless/self-managed-headless/get-started/migrate-from-an-existing-wix-site/migrate-a-wix-site-to-a-headless-project

Only step 5 changes the live site. Everything before it is safe to do while the current Wix site keeps running.

---

## 0. Content, before anything else (owner: Claire and Devansh)
- [ ] Claire approves the draft wording. To review it, turn on "Show drafts for Claire" in the preview bar: every outlined item is a draft.
- [ ] Contact email, phone and address are added to the Help page (Wix Business Info is empty today).
- [ ] Privacy policy, Terms of service and Refund policy text is supplied, ideally reviewed by an adviser. The pages exist at `/privacy`, `/terms` and `/refund-policy`, and say "being finalised" until the text is in.
- [ ] The return window is settled: the scrolling strip says "10 days to start a return", but the store policy text says something else.
- [ ] Auto-picked photos are reviewed.
- [x] Scent families come from the owner's product list in `src/data/scents.ts` (ten families, 28 scents, their formats). It is the one source of truth: the shop chips, product pages, the Scent Sky, the quiz and the menus all read it.
- [ ] **Amber + Rose, Licorice Sweets and Fleur de Lilac** (`-need-pics` in Wix): Amber + Rose is on the owner's list, so it shows as the Amber & Rose candle (it still needs photos). Licorice Sweets and Fleur de Lilac are not on the list, so the site hides them everywhere (allow-list in `src/data/scents.ts`), the same way the deodorant is hidden. Anything on the list that is not in Wix yet shows as "Coming soon" and becomes buyable by itself once it is added and in stock in Wix.
- [ ] Moon Drops: the site counts down to the next new moon (computed) and offers only "get notified". To announce a real release date, set `VITE_DROP_DATE` (or `DROP_DATE_OVERRIDE` in `src/config.ts`).
- [ ] Concepts shown as "Coming soon" with no price: Discovery Kit, Moon Drops, Solstice Box, Ritual on Repeat (refills), digital gift cards. Claire to confirm which, if any, should launch, and their prices.
- [ ] **Giving back ($1 from every order): get permission before launch.** The story section ("Light that travels", on Meet the maker), the tracker at `/giving` and the line in the cart and under Add to cart name BC Children's Hospital. All of that wording is a draft for Claire, and nothing uses the hospital's logo.
  - [ ] Contact BC Children's Hospital Foundation (bcchf.ca) and set up an approved partnership (cause-marketing or third-party fundraising agreement) **before launch**. Its policy reportedly restricts percentage-of-sales programs to approved corporate cause-marketing partners (unverified, so ask). Ask how the Foundation wants to be named, whether gifts can be directed to children's cancer care (oncology), and whether a receipt or acknowledgement can be posted publicly. If permission is not given, change the wording to not name the hospital (search `src/pages/giving.ts`) before launch.
  - [ ] Confirm which local causes in White Rock and the Semiahmoo Peninsula receive donations, and how the money is split between them and the Foundation. Then update "Where it goes" on `/giving`.
  - [ ] Honour the $1 per order once checkout is live: every month, count the orders in the Wix dashboard (leave out cancelled and fully refunded orders), set aside $1 for each, and donate on the schedule Claire chooses (monthly or quarterly). Confirm the "How the amount is calculated" wording matches what you actually do.
  - [ ] Add each donation to the tracker after it is made, never before. Edit `src/data/giving.ts`, add one entry, and redeploy. Put receipts and photos in `public/giving/` (they are served at `/giving/<file>`). The page adds up its totals from these entries only, and shows "Our first giving report will be posted after our first month of orders" while the list is empty. Example:
    ```ts
    export const GIVING: GivingEntry[] = [
      {
        date: '2026-12-01',                         // the day the donation was made, YYYY-MM-DD
        amount: 48,                                 // dollars actually given (CAD), no "$"
        recipient: "BC Children's Hospital Foundation",
        note: "Our November orders: $1 from each, toward children's cancer care.",
        orders: 48,                                 // optional: orders this covers
        proofUrl: '/giving/2026-11-receipt.pdf',    // optional: the receipt
        photo: '/giving/2026-11.webp',              // optional: a photo of the moment
        photoAlt: 'Claire holding the donation receipt beside a lit Verdant candle',
      },
    ];
    ```
  - [ ] Never state impact ("helped X children") unless it comes from a posted entry or from the recipient in writing.
- [ ] The Send a Sunrise sets (The Morning Ritual, The Midday Reset, The Evening Wind Down) are not products in Wix and had invented draft prices ($34 / $36 / $46). They now show as "Coming soon" with no price. Claire to define what each set contains; then create them in Wix so the site can show real prices.

## 1. Vercel (owner: Devansh)
- [ ] Move the project to a paid plan. The free (Hobby) plan is for non-commercial use, so check Vercel's current terms.
- [ ] Set the **Production** environment variables:
  - `VITE_WIX_CLIENT_ID` = the live site's headless client ID (see `env.example`)
  - `VITE_LAUNCH` = `true` (removes the preview bar, lets search engines index the site and opens `robots.txt`)
  - `VITE_ENABLE_WRITES` = `true` (turns on real checkout and booking)
  - `SITE_URL` = `https://www.dailyritualsco.com` (optional; this is already the default)
  - `VITE_SITE_URL` = the same address (optional, same default): the canonical links, share-card pictures and JSON-LD use it once launched; previews use their own address
- [ ] Leave **Preview** environments without `VITE_LAUNCH`. Previews keep the preview bar and stay hidden from search engines. The `X-Robots-Tag` rule in `vercel.json` also applies to any address that isn't dailyritualsco.com.
- [ ] Merge this branch into the production branch and confirm the site loads at its `*.vercel.app` address.

## 2. Wix: Settings → Headless Settings (owner: Devansh, or Claude in Chrome)
- [ ] Open the headless client this site uses (its client ID matches `VITE_WIX_CLIENT_ID`).
- [ ] **Allowed redirect domains**: add the `*.vercel.app` production address, `www.dailyritualsco.com` and `dailyritualsco.com`.
- [ ] **Frontend link**: set it to the `*.vercel.app` address for now. It changes in step 5.

## 3. Real test on the Vercel address (owner: Devansh, with Claude)
Writes are on at this point, so these are real transactions.
- [ ] Add to cart, check out and pay for one low-cost item. Confirm the order appears in the Wix dashboard and the confirmation email arrives. Then refund it.
- [ ] Book a discovery call, confirm it shows in Wix Bookings, then cancel it.
- [ ] Old links redirect correctly. Before the switch, test the redirect rules on the Vercel address: `/product-page/<a real product slug>`, `/about`, `/contact`, `/book-online`.
- [ ] Check every page on a phone and a desktop.

## 4. The day before the switch (owner: whoever manages DNS)
- [ ] Find where the domain's DNS is managed (in Wix if the domain was bought through Wix, otherwise at the registrar).
- [ ] Note the current TTL on the `www` record, then lower it to 300 seconds.

## 5. Switch day: do the whole step in one sitting, in this order (owner: Devansh, with the DNS owner)
1. [ ] In Vercel, add the domains `www.dailyritualsco.com` and `dailyritualsco.com` to the project. Vercel shows the exact DNS records to create.
2. [ ] At the DNS host, point `www` (and the apex, if used) at Vercel using those records. **Do not touch the MX, SPF, DKIM or DMARC records**, so email keeps working.
3. [ ] In Wix, go to **Settings → Domains**. Connect `checkout.dailyritualsco.com` (or the chosen subdomain) and make it the **primary domain**. Complete the DNS steps Wix gives you.
4. [ ] Unassign `www.dailyritualsco.com` and `dailyritualsco.com` from the Wix site.
5. [ ] In Wix **Headless Settings → Manage URLs → Wix pages domain**, set the subdomain.
6. [ ] In Wix **Headless Settings**, set the **Frontend link** to `https://www.dailyritualsco.com`.

Certificates can take a little while, and some visitors may see the old site for up to the TTL. Both are expected.

## 6. Check after the switch
- [ ] `https://www.dailyritualsco.com` loads this site.
- [ ] `http://` and the apex address both redirect to `https://www.`.
- [ ] Checkout goes to the subdomain and returns to the site. So do login and the account pages.
- [ ] Booking works end to end.
- [ ] Email still sends and receives.
- [ ] `https://www.dailyritualsco.com/robots.txt` allows crawling, and `/sitemap.xml` lists the products. If products are missing, the build could not reach Wix: check the build log for "seo:".

## 7. In the week after
- [ ] Watch orders, bookings and the contact inbox for 48 hours.
- [ ] In Google Search Console, submit `/sitemap.xml` and watch for errors on old URLs.
- [ ] Restore the DNS TTL.
- [ ] Remove preview addresses you no longer need from Wix Headless Settings.

---

## Rollback
If something serious breaks during step 5:
- In Wix, reassign `www.dailyritualsco.com` as the primary domain.
- Point `www` back to the records Wix gave you.

The Wix site has not been changed, so it comes straight back. With a 300-second TTL, most visitors see it again within minutes.

## Known limits
- The redirect rules for old links (`vercel.json`) follow Wix's usual address patterns. Wix's API returned product IDs but not the old page paths, so test them in step 3 and add any missing ones.
- Loyalty (the Ritualists), referrals, subscriptions, gift cards and newsletter sign-up are not connected yet. The site shows them as "coming soon" or switched off, so nothing is promised that doesn't work.
