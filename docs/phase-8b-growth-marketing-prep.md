# Phase 8B Growth, Marketing, Automation, SEO, and Admin Prep

This pass prepares LUMA for Shopify-like growth tooling without running database
migrations, inventing credentials, sending real messages, or changing checkout
discount/payment logic.

## Added safely

- Draft SQL migration:
  - `backend/src/sql/migrations/002_phase_8b_growth_marketing_draft.sql`
- Backend readiness routes:
  - `GET /api/growth/overview`
  - `POST /api/growth/events`
  - `POST /api/growth/product-views`
  - `POST /api/growth/abandoned-carts`
  - `POST /api/growth/checkout-starts`
  - `POST /api/growth/back-in-stock`
  - `GET /api/automation/status`
  - `GET /api/integrations/status`
  - `GET /sitemap.xml`
  - `GET /product-feed.xml`
- Admin UI:
  - `/luma-control-room/growth`
  - Integration readiness
  - Automation readiness
  - Abandoned cart and back-in-stock summaries
- Frontend hooks:
  - Page view tracking
  - Product view tracking
  - Add-to-cart tracking
  - Checkout-start tracking
  - Abandoned cart storage calls
  - Back-in-stock request form for unavailable products

## Environment placeholders

Backend:
- `RESEND_API_KEY`
- `EMAIL_FROM` or `RESEND_FROM_EMAIL`
- `ABANDONED_CART_DELAY_MINUTES`
- `WHATSAPP_NUMBER`
- `GA_MEASUREMENT_ID`

Frontend:

- `VITE_GA_MEASUREMENT_ID`

## Deferred intentionally

- Discount codes
- Automatic discounts
- Buy X Get Y promotions
- Gift cards
- Bundle checkout pricing
- Pre-order checkout behavior
- External marketing automation provider sync
- Automatic WhatsApp sends
- Customer data exports
- Bulk product imports/edits
- Purchase order receive-to-stock workflow

These should be implemented after the inventory migration is applied and tested.

Current stabilization decision: LUMA automation uses backend database state plus Resend. Optional pixels are browser-only tracking aids and are not the automation source of truth.

Note: LUMA now uses internal event tracking and backend email automation instead of external social-pixel or marketing-automation integrations. GA4 remains optional when VITE_GA_MEASUREMENT_ID is configured.
