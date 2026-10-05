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
- [ ] Mood assignments are set for Amber + Rose, Licorice Sweets and Fleur de Lilac.

## 1. Vercel (owner: Devansh)
- [ ] Move the project to a paid plan. The free (Hobby) plan is for non-commercial use, so check Vercel's current terms.
- [ ] Set the **Production** environment variables:
  - `VITE_WIX_CLIENT_ID` = the live site's headless client ID (see `env.example`)
  - `VITE_LAUNCH` = `true` (removes the preview bar, lets search engines index the site and opens `robots.txt`)
  - `VITE_ENABLE_WRITES` = `true` (turns on real checkout and booking)
  - `SITE_URL` = `https://www.dailyritualsco.com` (optional; this is already the default)
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
