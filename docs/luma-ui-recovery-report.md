# LUMA full UI recovery report

Date: 26 August 2026

## 1. UI regressions removed

- Removed the oversized account-page marketing block and restored a compact email/password flow.
- Replaced the oversized mobile collection card action stack with one primary action and two compact secondary actions.
- Replaced the raw checkout discount control with a labelled, rounded coupon panel with clear states.
- Rebuilt the footer as a rounded, responsive LUMA footer with a working newsletter form and real internal links.
- Removed customer-facing implementation language and internal admin terminology.
- Removed hardcoded promotion copy and duplicate popup triggers.

## 2. Screens and pages repaired

- Home product loading
- Product collection
- Product details
- Sign in, sign up, password recovery, and account summary
- Cart-to-checkout entry
- Paystack checkout and callback
- Contact and enquiry form
- Footer on all public pages
- Admin discounts, delivery, growth, currency, navigation, and route loading

## 3. Mobile repairs

- Compact product media and action hierarchy at 320–640 px.
- Currency selector added to the mobile navigation menu.
- Login content reduced to one functional card.
- Coupon input and Apply button grouped as one responsive control.
- Promotion popup limited to a compact mobile-safe panel.
- Admin verifier expanded to 320, 360, 375, 390, 412, and 430 px viewports.

## 4. Product card height

- Before: approximately 1,244 px in the supplied 691 × 1,536 mobile screenshot.
- After CSS target: approximately 500–550 px at the same content density, using a 210 px image, a 42 px primary action, and a 38 px secondary row.
- Expected reduction: about 56–60%. The protected Vercel preview built successfully; exact mobile pixel measurement remains a post-production visual check because browser access to the protected preview requires Vercel SSO.

## 5. Login page

- Before: a full marketing panel plus a separate large sign-in panel, extending beyond the first viewport.
- After: one compact card with email and password only, plus password recovery and small mode-switch links.
- Google sign-in UI, route, client call, and backend handler were removed. Legacy passwordless accounts can use Forgot password to set a password.
- No profile-completion gate is added before checkout.

## 6. Checkout discount UI

- Before: browser-default text input and a detached Apply control.
- After: rounded coupon panel, aligned input/button row, disabled/loading states, success/error message, and discount reset when delivery pricing changes.

## 7. Footer

- Rounded brand shell inspired by the supplied reference without copying unrelated VYRE content.
- Centered LUMA brand and newsletter form.
- Shop, Help, Company, and Contact groups use real LUMA routes only.
- No invented address, phone number, email address, or social profile.

## 8. Currency switcher

- Desktop behavior retained.
- Mobile selector is now reachable inside the navigation menu.
- Display prices stay consistent across collection, product, cart, checkout, and summaries.
- Paystack settlement remains NGN; display conversion never changes the server-authoritative settlement amount.

## 9. Promotion control

- Active popup promotion is loaded from the database.
- Admin can select one promotion, set headline/message/CTA/path/frequency, enforce first-paid-order eligibility, or disable popup display.
- Timed and exit-intent triggers use the same selected promotion and frequency record.
- When no admin promotion is selected, no popup is shown.
- Welcome email no longer advertises a hardcoded discount code.

## 10. Delivery architecture

- Exact area → city/LGA → state → country → nationwide fallback.
- Base fee and remote surcharge are stored separately.
- ETA, pickup option/label, international region, active status, and order-time snapshots are supported.
- Existing live delivery prices remain unchanged.
- International production prices remain blocked pending the carrier research process in `docs/delivery-research-and-rollout.md`.

## 11. Performance measurements

| Measurement | Before | After |
| --- | ---: | ---: |
| Initial JavaScript bundle | 1,144.16 KB | 421.65 KB |
| Initial JavaScript gzip | 322.76 KB | 133.08 KB |
| Initial JS reduction | — | 63.2% raw / 58.8% gzip |
| Vite build | 1.52 s on prior Vercel production | 0.88 s locally / 1.34 s on Vercel preview |
| Sitemap product wait | up to 10 s per candidate | 2.5 s per candidate with verified fallback |

The 345.52 KB chart library and admin pages are now separate lazy chunks and are not downloaded on the public storefront entry route.

## 12. Backend latency finding

The browser-visible delay is not explained by the product SQL. Live requests show variable first-byte times and occasional gateway failures from the current hosting path, while the database query itself is fast. The production Render workspace and `website` service were confirmed; the 24-hour `/api/products` latency series contained no retained path-specific data, so no unsupported infrastructure conclusion is claimed.

## 13. Database query finding

The current two-product query completed in approximately 1.5 ms on Neon. No speculative index was added. Public product listing also no longer performs a review-schema check and review aggregate join on every request.

## 14. Admin routes removed

- Mail inbox UI and ticket APIs
- Duplicate email-automation page
- Flutterwave callback/admin remnants
- Public `/admin` access remains forbidden

## 15. Admin routes retained

- Dashboard
- Analytics
- Products
- Product sales
- Orders
- Discounts
- Currency rates
- Customers
- Waitlist
- Enquiries
- Inventory
- Delivery
- Growth tools
- Email broadcasts
- Automations
- Abandoned carts
- Abandoned checkouts
- Product waitlists
- Settings

Legacy route aliases redirect to their canonical retained page instead of rendering duplicate admin tools.

## 16. External configuration still required

- Neon promotion migration `f6f64832-6a74-4235-a5b1-b82e0ec723f7` and delivery migration `5ea2a2c7-1240-4d10-abbd-5a8929875623` were applied to the production branch. Verification found all 7 promotion columns, all 7 delivery-zone columns, all 4 order snapshot columns, 3 preserved delivery zones, and an unchanged ₦4,050 aggregate fee.
- Render workspace `Igiehon's workspace` and the production `website` service were confirmed.
- `PAYSTACK_SECRET_KEY`, `PAYSTACK_CALLBACK_URL`, and Paystack webhook configuration on Render.
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and required `RESEND_WEBHOOK_SECRET` on Render.
- Valid Google Maps/Places browser key only if address suggestions are desired; manual location entry works without it.

## 17. Known limitations

- Render did not retain a path-specific `/api/products` latency series for the queried 24-hour window; post-deploy request observations are used instead.
- Production payment verification is limited to signature/configuration checks unless an authorized live or test Paystack transaction is supplied.
- International weight/value tiers are intentionally not activated until LUMA approves researched carrier rate cards.
- Exact rendered mobile after-height and screenshot evidence require the public production browser pass because the Vercel preview is SSO-protected.
