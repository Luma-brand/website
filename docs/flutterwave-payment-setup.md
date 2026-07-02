# Flutterwave Payment Setup

Flutterwave Standard Checkout is the only active customer payment flow. Historical Paystack values remain in existing order records for reporting and must not be deleted or rewritten.

## Required Render variables

```env
FLUTTERWAVE_SECRET_KEY=
FLUTTERWAVE_PUBLIC_KEY=
FLUTTERWAVE_WEBHOOK_SECRET_HASH=
FLUTTERWAVE_ENV=live
FLUTTERWAVE_ENABLED=true
FLUTTERWAVE_ALLOWED_CURRENCIES=NGN,USD,GBP,EUR
FLUTTERWAVE_DEFAULT_CURRENCY=NGN
FLUTTERWAVE_REDIRECT_URL=https://shopwithluma.com/payment/flutterwave/callback
```

Do not place the secret key or webhook hash in Vercel or frontend files.

## Flutterwave dashboard

- Webhook URL: `https://website-ikv5.onrender.com/api/webhooks/flutterwave`
- Redirect URL: `https://shopwithluma.com/payment/flutterwave/callback`
- Set a strong webhook secret hash and use the same value for `FLUTTERWAVE_WEBHOOK_SECRET_HASH`.
- Enable webhook retries.

## Database

Run `backend/src/sql/migrations/033_flutterwave_payment_gateway.sql` manually in Neon. The migration only adds provider-neutral fields and indexes; it does not drop or update historical Paystack columns or orders.

## Local testing

Use sandbox keys and set the redirect URL to `http://localhost:5173/payment/flutterwave/callback`. Expose the backend through ngrok when testing webhooks.

## Endpoints

```http
POST /api/payments/flutterwave/initialize
Authorization: Bearer CUSTOMER_JWT
Content-Type: application/json

POST /api/payments/flutterwave/verify
Authorization: Bearer CUSTOMER_JWT
Content-Type: application/json

POST /api/webhooks/flutterwave
flutterwave-signature: HMAC_SHA256_BASE64_SIGNATURE
```
