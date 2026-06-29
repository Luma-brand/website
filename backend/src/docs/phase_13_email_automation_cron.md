# Phase 13 Email Automation Cron Plan

LUMA currently supports manual admin-triggered automation runs through:

```http
POST /api/automation/trigger/:flow
```

The endpoint is admin-protected and uses Resend. Required environment variables:

```env
RESEND_API_KEY=
EMAIL_FROM=
FRONTEND_URL=https://website-umber-xi-40.vercel.app
```

Recommended future cron setup:

| Flow | Cadence | Payload |
| --- | --- | --- |
| abandoned_cart_recovery | Every 15 minutes | `{ "limit": 25 }` |
| checkout_recovery | Every 15 minutes | `{ "limit": 25 }` |
| post_purchase_followup | Daily | `{ "limit": 50 }` |
| review_request | Daily | `{ "limit": 50 }` |
| reorder_reminder | Daily | `{ "limit": 50 }` |
| winback_email | Weekly | `{ "limit": 50 }` |
| back_in_stock_alert | After stock update or every 30 minutes | `{ "limit": 25 }` |

Supported flows:

- `welcome_email`
- `order_confirmation`
- `post_purchase_followup`
- `review_request`
- `reorder_reminder`
- `winback_email`
- `abandoned_cart_recovery`
- `checkout_recovery`
- `back_in_stock_alert`

Do not add Twilio or automatic WhatsApp sending here. WhatsApp follow-up remains manual via existing `wa.me` admin links.
