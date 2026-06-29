# Phase 1 Inventory Management Prep

Scope for Phase 1:

- Inventory accuracy comes before promo codes or discount logic.
- Keep current backend API routes stable until implementation is approved.
- Track stock changes separately from product records.
- Support delivery metadata without replacing the existing order flow.

Suggested implementation order:

1. Add database migration for inventory ledger, reservations, delivery zones, and delivery tracking.
2. Add backend service/controller logic for stock availability checks and stock movement recording.
3. Update order creation and Paystack verification so stock deduction is idempotent.
4. Add admin inventory views after backend behavior is verified.

Current observations:

- Products already expose `stock_quantity`.
- Orders and Paystack verification already reduce stock, but they do not yet record stock movement history.
- Delivery status currently shares the general `orders.status` field and should be separated before richer fulfillment work.
