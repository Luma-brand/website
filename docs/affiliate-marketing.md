# LUMA affiliate marketing

Customers use `/affiliates` to apply, check approval, share shop or product links,
view commissions, save bank details and request withdrawals. The account menu
and footer link to this page. Sign-in and signup return applicants to it.

Admins use `/luma-control-room/affiliates` (Growth → Affiliates) to approve,
reject, suspend or reactivate partners, set a per-partner commission override,
change program settings and review withdrawals. All admin changes are audited.

## Initial settings

| Setting | Default | Admin control |
| --- | --- | --- |
| Program | Enabled | Pause new applications and attribution |
| Commission | 5% | 0–100%, in increments of 0.01% |
| Referral window | 30 days | 1–90 days |
| Hold from verified payment | 7 days | 0–90 days |
| Minimum withdrawal | ₦5,000 | Any positive NGN amount, to two decimals |

Individual affiliate rates override the default; clearing the override restores
the current default. Rate and hold changes apply to new checkouts. Previously
attributed orders keep their recorded values.

## Attribution and earnings

- Approved partners get random unique `LUMA…` codes and links containing `?ref=…`.
- The visitor gets an opaque expiring referral token. The backend stores a SHA-256
  hash of a random browser visitor ID and the landing path, without IP or user-agent
  tracking. Repeated visits deduplicate within the current referral window.
- The latest valid referral link wins in browser storage. Attribution works for
  both guest checkout and signed-in checkout. Storage blocked by a browser or an
  invalid referral does not prevent a normal order.
- Checkout looks up the affiliate and rate on the server, excludes self-referrals
  by account ID, email or matching Nigerian phone, and snapshots the product subtotal
  after discounts. Delivery and payment-processing fees do not earn commission.
- Only the verified Paystack payment lifecycle creates a commission, inside the
  same transaction as payment and stock reconciliation. Callbacks and webhooks
  use a unique order constraint to avoid double credit. An admin marking an order
  paid does not create a commission.
- A commission stays pending until the recorded hold expires and the order is
  marked delivered/completed. Refunds, cancellations and failed payments void it.
  Paid withdrawals remain recorded; a later reversal can produce a negative balance
  to be covered by future earnings.
- Customers see only their own earnings and withdrawal records, without referred
  shoppers' personal information. Affiliate-linked orders are retained to preserve
  the ledger; cancel or refund them instead of deleting them.

## Withdrawals

Withdrawals are **manual bank transfers reviewed by an admin**. No Paystack transfer
API is called, and changing a record to paid does not send money automatically.

1. The partner saves a 10-digit Nigerian bank account and submits an amount.
2. The backend locks the affiliate account, reconciles commissions, checks the
   minimum and available balance, reserves the amount, and snapshots bank details.
3. Admin approves the request. After making the bank transfer separately, admin
   marks it paid and records its unique transfer reference. Rejection requires a
   reason and releases the reservation.

Every request has an idempotency key; retrying it cannot reserve the amount twice.
Open/paid requests are deducted from available earnings. Approval/payment rechecks
the balance and account status to catch refunds or suspension after the request.

## Schema and rollout

`038_affiliate_marketing.sql` adds only affiliate tables and indexes, without
altering existing customer, payment, product or order columns. The backend applies
it idempotently at startup and retries initialization if a first request follows a
database outage. It can also be run explicitly with `npm run migrate:affiliates`
from `backend` using the deployment's existing `DATABASE_URL`.

Deploy both the backend and frontend from this commit. No new service credentials
are required. Live bank transfers and live Paystack purchases are not part of the
automated verification; use the existing payment-provider test environment for
payment-provider validation before making a real purchase.

## Verification

- `cd backend && npm test`: isolated PostgreSQL/PGlite integration tests for schema
  idempotency, referrals, snapshots, fulfilment/hold, reversed payments, payouts,
  access controls and the existing email templates. PGlite has one connection;
  tests queue transactions. Production uses PostgreSQL account row locks to
  serialize competing withdrawal, refund and payment operations.
- `cd frontend && npm run build`: production bundle and existing sitemap generator.
- Visual browser QA was unavailable in this workspace: Playwright's browser
  executable was absent and the cloud browser could not reach localhost. The
  production bundle and React checks pass, and the HTTP access-control and
  financial workflows were verified against the isolated PostgreSQL fixture.
