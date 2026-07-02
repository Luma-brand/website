# LUMA Production Email Setup

Frontend production domain: `https://shopwithluma.com`.
Current Vercel frontend URL for deployment checks: `https://website-umber-xi-40.vercel.app`.
Backend API deployment URL: `https://website-ikv5.onrender.com/api`.

Do not point frontend API variables at `https://shopwithluma.com` unless the backend is actually hosted there.

## Backend environment variables

Set these in Render or the backend hosting provider:

```env
RESEND_API_KEY=actual_key_from_resend
EMAIL_FROM=LUMA <hello@shopwithluma.com>
RESEND_FROM_EMAIL=LUMA <hello@shopwithluma.com>
EMAIL_REPLY_TO=support@shopwithluma.com
SUPPORT_EMAIL=support@shopwithluma.com
SUPPORT_FROM=LUMA Support <support@shopwithluma.com>
HELLO_EMAIL=hello@shopwithluma.com
HELLO_FROM=LUMA <hello@shopwithluma.com>
MAIL_INBOXES=support@shopwithluma.com,hello@shopwithluma.com
DEFAULT_MAIL_INBOX=support@shopwithluma.com
ADMIN_EMAIL=your_admin_email
ADMIN_TEST_EMAIL=your_test_email
FRONTEND_URL=https://shopwithluma.com
BACKEND_URL=https://website-ikv5.onrender.com
ABANDONED_CART_EMAIL_ENABLED=true
ABANDONED_CART_DELAY_MINUTES=2
ABANDONED_CART_MAX_EMAILS=3
CRON_SECRET=long_random_secret
RESEND_WEBHOOK_SECRET=optional_webhook_secret
```

Also keep existing production values for `DATABASE_URL`, `JWT_SECRET`, Flutterwave, Cloudinary, and any other active backend integrations.

## Frontend environment variables

Set these in Vercel:

```env
VITE_API_BASE_URL=https://website-ikv5.onrender.com/api
VITE_API_URL=https://website-ikv5.onrender.com/api
VITE_SITE_URL=https://shopwithluma.com
```

Never add `RESEND_API_KEY`, `CRON_SECRET`, or `RESEND_WEBHOOK_SECRET` to Vercel or frontend env files.

## Neon migrations

Run these safe migrations in Neon if they have not already been applied:

```text
backend/src/sql/migrations/022_production_email_foundation.sql
backend/src/sql/migrations/024_email_logs_legacy_schema_compat.sql
backend/src/sql/migrations/025_email_automation_abandoned_cart_support.sql
backend/src/sql/migrations/026_support_inbox_mail_system.sql
backend/src/sql/migrations/031_multi_inbox_mail_support.sql
```

The new migration uses only safe `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and `CREATE INDEX IF NOT EXISTS` statements.

## Abandoned cart cron

Preferred cron request:

```http
POST https://website-ikv5.onrender.com/api/cron/abandoned-carts
Authorization: Bearer YOUR_CRON_SECRET
Content-Type: application/json

{ "limit": 25 }
```

Health check:

```http
GET https://website-ikv5.onrender.com/api/cron/abandoned-carts/health
```

Suggested cadence after testing: every 15 minutes.
For testing with `ABANDONED_CART_DELAY_MINUTES=2`, run it manually from admin first, then run cron every 5 minutes.

If Render Cron cannot set headers, use the helper script:

```bash
cd backend
BACKEND_URL=https://website-ikv5.onrender.com CRON_SECRET=your_secret node scripts/runAbandonedCartCron.js
```

## Admin manual trigger

Admins can run the same abandoned-cart check without seeing the cron secret:

```http
POST /api/admin/email-automation/run-abandoned-cart-check
Authorization: Bearer ADMIN_JWT
```

Admin UI route:

```text
/luma-control-room/abandoned-carts
```

## Resend webhook

Set the Resend webhook URL to:

```text
https://website-ikv5.onrender.com/api/webhooks/resend
```

The backend records webhook events in `email_events`. If Resend inbound email is enabled and an `email.received` event arrives for `support@shopwithluma.com` or `hello@shopwithluma.com`, the backend prepares inbox records in `support_tickets` and `support_messages`.

## Mail inbox DNS caution

Both `support@shopwithluma.com` and `hello@shopwithluma.com` use Resend inbound receiving for `shopwithluma.com`. Before changing MX/DNS records, confirm the current mailbox provider so existing email delivery is not interrupted. Do not delete existing Resend/domain DNS sending records. Receiving and any required DNS/MX setup must still be configured manually.

## Admin Mail inbox

Admin UI route:

```text
/luma-control-room/mail
```

Protected backend endpoints:

```http
GET /api/admin/mail/inboxes
GET /api/admin/mail/tickets?status=open&inbox=all&search=&page=1&limit=50
GET /api/admin/mail/tickets?inbox=support@shopwithluma.com
GET /api/admin/mail/tickets?inbox=hello@shopwithluma.com
GET /api/admin/mail/tickets/:id
POST /api/admin/mail/tickets/:id/reply
PATCH /api/admin/mail/tickets/:id/status
PATCH /api/admin/mail/tickets/:id/priority
```

Support and Hello conversations are handled together on this same page. Replies are sent through Resend using the ticket's saved sender: `SUPPORT_FROM` for Support and `HELLO_FROM` for Hello. Set all mail inbox variables in Render and keep `RESEND_API_KEY` backend-only. Older tickets without inbox metadata are treated as Support tickets.

## Resend receiving setup

Create or confirm a Resend Receiving domain for `shopwithluma.com`, covering both Support and Hello, then point the webhook to:

```text
https://website-ikv5.onrender.com/api/webhooks/resend
```

The webhook stores raw Resend events in `email_events`. For `email.received`, the backend attempts to retrieve full message content from Resend, matches or creates a support ticket, then saves the inbound message in `support_messages`.

Inbound receiving cannot call localhost directly. For local testing, expose the backend with ngrok or VS Code port forwarding and set the temporary webhook URL to:

```text
https://YOUR-TUNNEL-DOMAIN/api/webhooks/resend
```

Do not log or paste `RESEND_API_KEY` into frontend env files, Vercel variables, screenshots, or browser code.



