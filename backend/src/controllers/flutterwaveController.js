const pool = require("../config/db");
const { sendOrderConfirmationEmails } = require("../services/emailService");
const { buildOrderDeliveryFields, getDeliveryQuote, getExistingOrderDeliveryColumns } = require("../services/deliveryService");
const { buildOrderDiscountFields, calculateOrderPricing, getExistingOrderDiscountColumns, incrementDiscountUsage } = require("../services/discountService");
const { markAbandonedCartRecovered, recordAnalyticsEvent } = require("../services/growthService");
const { recordAutomationAttempt } = require("../services/automationService");
const { markBrowseAbandonmentsConvertedForOrder } = require("../services/browseAbandonmentService");
const { getCurrencyRates, convertFromNgn } = require("../services/currencyService");
const { initializePayment, verifyTransaction, isValidWebhook } = require("../services/flutterwaveService");
const { reconcileSuccessfulPaymentStock, emitPaidOrderEvents } = require("../services/paymentLifecycleService");

function isUuid(value) {
  return /^[0-9a-fA-F-]{36}$/.test(String(value || ""));
}

function allowedCurrencies() {
  return String(process.env.FLUTTERWAVE_ALLOWED_CURRENCIES || "NGN,USD,GBP,EUR")
    .split(",").map((value) => value.trim().toUpperCase()).filter(Boolean);
}

function redirectUrl() {
  return process.env.FLUTTERWAVE_REDIRECT_URL || `${String(process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "")}/payment/flutterwave/callback`;
}

function safeError(res, error, fallback) {
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : fallback,
    code: error.code || "FLUTTERWAVE_PAYMENT_ERROR",
  });
}

async function getPaymentAmount(totalNgn, currency) {
  if (currency === "NGN") return Number(totalNgn);
  const rates = await getCurrencyRates({ includeInactive: false });
  const rate = rates.find((item) => item.code === currency && item.isActive);
  if (!rate) {
    const error = new Error(`${currency} payments are not currently available.`);
    error.statusCode = 400;
    error.code = "CURRENCY_NOT_AVAILABLE";
    throw error;
  }
  return Number(convertFromNgn(totalNgn, rate.rateToNgn).toFixed(2));
}

async function initializeFlutterwavePayment(req, res) {
  let client;
  let transactionOpen = false;
  try {
    const body = req.body || {};
    const currency = String(body.currency || process.env.FLUTTERWAVE_DEFAULT_CURRENCY || "NGN").toUpperCase();
    if (!allowedCurrencies().includes(currency)) {
      return res.status(400).json({ success: false, message: `${currency} is not supported for payment.`, code: "UNSUPPORTED_CURRENCY" });
    }
    const items = (body.items || []).map((item) => ({
      ...item,
      productId: isUuid(item.productId) ? item.productId : null,
      quantity: Number(item.quantity || 0),
    }));
    if (!body.customerName || !body.customerEmail || !items.length || items.some((item) => !item.productId || item.quantity <= 0)) {
      return res.status(400).json({ success: false, message: "Valid customer details and cart items are required.", code: "INVALID_CHECKOUT" });
    }
    if (String(req.customer?.email || "").toLowerCase() !== String(body.customerEmail).toLowerCase()) {
      return res.status(403).json({ success: false, message: "Checkout email must match the signed-in account.", code: "CUSTOMER_MISMATCH" });
    }

    const deliveryState = body.state || body.city;
    const deliveryQuote = await getDeliveryQuote({ country: body.country, state: deliveryState, region: body.city });
    const [deliveryColumns, discountColumns] = await Promise.all([
      getExistingOrderDeliveryColumns(), getExistingOrderDiscountColumns(),
    ]);
    const pricing = await calculateOrderPricing({ items, deliveryFee: deliveryQuote.deliveryFee, discountCode: body.discountCode });
    if (!pricing.isValid) {
      return res.status(409).json({ success: false, message: "Some products in your cart are no longer available.", code: "CART_CHANGED", issues: pricing.issues });
    }
    const paymentAmount = await getPaymentAmount(pricing.totalAmount, currency);
    const reference = `LUMA-FLW-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const deliveryFields = await buildOrderDeliveryFields({
      existingColumns: deliveryColumns,
      deliveryQuote: { ...deliveryQuote, deliveryFee: pricing.deliveryFee },
      deliveryNotes: body.deliveryNotes ? String(body.deliveryNotes).trim() : null,
      state: deliveryState,
    });
    const discountFields = await buildOrderDiscountFields({ existingColumns: discountColumns, pricing });
    const columns = ["customer_name", "customer_email", "customer_phone", "delivery_address", "city", "country", "total_amount", "status", "payment_status", "payment_provider", "payment_gateway", "payment_reference", "payment_currency", "payment_amount"];
    const values = [body.customerName, body.customerEmail, body.customerPhone || null, body.deliveryAddress || null, body.city || null, body.country || null, pricing.totalAmount, "pending", "pending", "flutterwave", "flutterwave", reference, currency, paymentAmount];
    for (const field of [...deliveryFields, ...discountFields]) { columns.push(field.column); values.push(field.value); }

    client = await pool.connect();
    await client.query("BEGIN");
    transactionOpen = true;
    const orderResult = await client.query(
      `INSERT INTO orders (${columns.join(", ")}) VALUES (${values.map((_, index) => `$${index + 1}`).join(", ")}) RETURNING *`, values
    );
    const order = orderResult.rows[0];
    for (const item of pricing.items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, product_image, price, quantity, size) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [order.id, item.productId, item.name, item.image || null, item.price, item.quantity, item.size || null]
      );
    }
    await client.query("COMMIT");
    transactionOpen = false;
    client.release();
    client = null;

    let initialized;
    try {
      initialized = await initializePayment({
        tx_ref: reference,
        amount: paymentAmount,
        currency,
        redirect_url: redirectUrl(),
        customer: { email: body.customerEmail, name: body.customerName, phonenumber: body.customerPhone || undefined },
        customizations: { title: "LUMA", description: `LUMA order ${String(order.id).slice(0, 8)}` },
        meta: { orderId: order.id, customerId: req.customer.id, growthSessionId: body.growthSessionId || null },
      });
    } catch (error) {
      await pool.query("UPDATE orders SET payment_status='failed', updated_at=NOW() WHERE id=$1", [order.id]).catch(() => {});
      throw error;
    }
    return res.status(201).json({
      success: true,
      gateway: "flutterwave",
      checkoutUrl: initialized.data.link,
      orderId: order.id,
      txRef: reference,
      data: { orderId: order.id, txRef: reference, checkoutUrl: initialized.data.link, authorizationUrl: initialized.data.link, currency, paymentAmount, totalAmount: pricing.totalAmount },
    });
  } catch (error) {
    if (transactionOpen && client) await client.query("ROLLBACK").catch(() => {});
    console.error("Initialize Flutterwave error:", pool.describeError ? pool.describeError(error) : error.message);
    return safeError(res, error, "We couldn’t start your payment. Please try again.");
  } finally {
    if (client) client.release();
  }
}

async function finalizeVerifiedTransaction(transaction, source, expectedCustomerEmail = null) {
  const reference = transaction.tx_ref;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT * FROM orders WHERE payment_reference=$1 FOR UPDATE", [reference]);
    const order = result.rows[0];
    if (!order) { const error = new Error("Order not found for this payment."); error.statusCode = 404; error.code = "ORDER_NOT_FOUND"; throw error; }
    if (expectedCustomerEmail && String(order.customer_email).toLowerCase() !== String(expectedCustomerEmail).toLowerCase()) {
      const error = new Error("This payment does not belong to your account."); error.statusCode = 403; error.code = "ORDER_OWNERSHIP_MISMATCH"; throw error;
    }
    const expectedAmount = Number(order.payment_amount || order.total_amount);
    if (!["successful", "succeeded"].includes(String(transaction.status).toLowerCase()) || transaction.tx_ref !== reference || String(transaction.currency).toUpperCase() !== String(order.payment_currency).toUpperCase() || Number(transaction.amount) + 0.0001 < expectedAmount) {
      const error = new Error("Your payment could not be verified yet."); error.statusCode = 400; error.code = "PAYMENT_MISMATCH"; throw error;
    }
    const wasAlreadyPaid = order.payment_status === "paid";
    await client.query(
      `UPDATE orders SET payment_transaction_id=$2, payment_metadata=$3::jsonb, paid_at=COALESCE(paid_at,NOW()), updated_at=NOW() WHERE id=$1`,
      [order.id, String(transaction.id), JSON.stringify(transaction)]
    );
    const reconciliation = await reconcileSuccessfulPaymentStock({ client, order, reference, createdBy: source });
    const growthSessionId = transaction.meta?.growthSessionId || transaction.metadata?.growthSessionId;
    await markAbandonedCartRecovered({ client, sessionId: growthSessionId, customerEmail: order.customer_email, customerPhone: order.customer_phone, orderId: order.id });
    if (!wasAlreadyPaid && reconciliation.success) {
      await incrementDiscountUsage({ client, discountCodeId: order.discount_code_id });
      await recordAnalyticsEvent({ eventType: "purchase_completed", sessionId: growthSessionId, customerEmail: order.customer_email, orderId: order.id, value: Number(order.total_amount || 0), metadata: { source, reference } });
    }
    await client.query("COMMIT");
    if (!wasAlreadyPaid && reconciliation.success) {
      await markBrowseAbandonmentsConvertedForOrder(reconciliation.order).catch(() => {});
      await emitPaidOrderEvents({ order: reconciliation.order, stockReduction: reconciliation.stockReduction, sessionId: growthSessionId, source });
      const email = await sendOrderConfirmationEmails(order.id);
      await recordAutomationAttempt({ eventType: "order_confirmation", status: email?.sent ? "sent" : "failed", customerEmail: order.customer_email, customerPhone: order.customer_phone, orderId: order.id, payload: { source, emailStatus: email?.status || "unknown" }, errorMessage: email?.sent ? null : email?.message });
    }
    return { order: reconciliation.order, alreadyPaid: wasAlreadyPaid, stockIssue: !reconciliation.success };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally { client.release(); }
}

async function verifyFlutterwavePayment(req, res) {
  try {
    const { transaction_id: transactionId, tx_ref: txRef, status } = req.body || {};
    if (status && !["successful", "completed"].includes(String(status).toLowerCase())) {
      return res.status(400).json({ success: false, message: "Payment cancelled or unsuccessful.", code: "PAYMENT_NOT_SUCCESSFUL" });
    }
    const verified = await verifyTransaction(transactionId);
    if (txRef && verified.data?.tx_ref !== txRef) {
      return res.status(400).json({ success: false, message: "Your payment reference could not be verified.", code: "REFERENCE_MISMATCH" });
    }
    const result = await finalizeVerifiedTransaction(verified.data, "flutterwave_callback", req.customer?.email);
    return res.json({ success: true, message: "Payment successful.", data: result.order });
  } catch (error) {
    console.error("Verify Flutterwave error:", error.message);
    return safeError(res, error, "Your payment could not be verified yet.");
  }
}

async function handleFlutterwaveWebhook(req, res) {
  if (!isValidWebhook(req.rawBody, req.headers)) {
    return res.status(401).json({ success: false, message: "Invalid webhook signature.", code: "INVALID_WEBHOOK_SIGNATURE" });
  }
  const payload = req.body || {};
  const transactionId = payload.data?.id;
  if (!transactionId || (payload.type || payload.event) !== "charge.completed") {
    return res.status(200).json({ success: true, message: "Webhook ignored." });
  }
  try {
    const verified = await verifyTransaction(transactionId);
    await finalizeVerifiedTransaction(verified.data, "flutterwave_webhook");
    return res.status(200).json({ success: true, message: "Webhook processed." });
  } catch (error) {
    console.error("Flutterwave webhook processing error:", error.message);
    return res.status(200).json({ success: true, message: "Webhook acknowledged for retry review." });
  }
}

module.exports = { initializeFlutterwavePayment, verifyFlutterwavePayment, handleFlutterwaveWebhook };
