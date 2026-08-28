const pool = require("../config/db");
const { sendOrderConfirmationEmails } = require("../services/emailService");
const {
  buildOrderDeliveryFields,
  getDeliveryQuote,
  getExistingOrderDeliveryColumns,
} = require("../services/deliveryService");
const {
  buildOrderDiscountFields,
  calculateOrderPricing,
  getExistingOrderDiscountColumns,
  incrementDiscountUsage,
} = require("../services/discountService");
const {
  markAbandonedCartRecovered,
  recordAnalyticsEvent,
} = require("../services/growthService");
const { recordAutomationAttempt } = require("../services/automationService");
const {
  initializeTransaction,
  verifyTransaction,
  isValidWebhook,
} = require("../services/paystackService");
const {
  reconcileSuccessfulPaymentStock,
  emitPaidOrderEvents,
} = require("../services/paymentLifecycleService");
const { getCurrencyRateSnapshot } = require("../services/currencyService");

function isUuid(value) {
  return /^[0-9a-fA-F-]{36}$/.test(String(value || ""));
}

function callbackUrl() {
  return (
    process.env.PAYSTACK_CALLBACK_URL ||
    `${String(process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "")}/payment/paystack/callback`
  );
}

function safeError(res, error, fallback) {
  return res.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : fallback,
    code: error.code || "PAYSTACK_PAYMENT_ERROR",
  });
}

function parseMetadata(metadata) {
  if (!metadata) return {};
  if (typeof metadata === "object") return metadata;

  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
}

async function initializePaystackPayment(req, res) {
  let client;
  let transactionOpen = false;

  try {
    const body = req.body || {};
    const items = (body.items || []).map((item) => ({
      ...item,
      productId: isUuid(item.productId) ? item.productId : null,
      quantity: Number(item.quantity || 0),
    }));

    if (
      !body.customerName ||
      !body.customerEmail ||
      !items.length ||
      items.some((item) => !item.productId || item.quantity <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid customer details and cart items are required.",
        code: "INVALID_CHECKOUT",
      });
    }

    if (
      req.customer &&
      String(req.customer?.email || "").toLowerCase() !==
      String(body.customerEmail).toLowerCase()
    ) {
      return res.status(403).json({
        success: false,
        message: "Checkout email must match the signed-in account.",
        code: "CUSTOMER_MISMATCH",
      });
    }

    const deliveryMethod = String(body.deliveryMethod || body.delivery_method || "").toUpperCase();
    if (!["DOORSTEP", "GIG_PICKUP", "STUDIO_PICKUP", "DELIVERY", "PICKUP"].includes(deliveryMethod)) {
      return res.status(400).json({
        success: false,
        message: "Choose Pickup or Delivery.",
        code: "DELIVERY_METHOD_REQUIRED",
      });
    }
    if (["DELIVERY", "DOORSTEP"].includes(deliveryMethod) && !String(body.deliveryAddress || "").trim()) {
      return res.status(400).json({
        success: false,
        message: "Delivery address is required for home delivery.",
        code: "DELIVERY_ADDRESS_REQUIRED",
      });
    }

    const deliveryState = body.state || body.city;
    const deliveryRegion = body.region || body.city;
    const deliveryQuote = await getDeliveryQuote({
      deliveryMethod,
      pickupLocationId: body.pickupLocationId || body.pickup_location_id,
      country: body.country,
      state: deliveryState,
      region: deliveryRegion,
      area: body.area,
      items,
    });
    const currencySnapshot = await getCurrencyRateSnapshot(body.displayCurrency || "NGN");

    const [deliveryColumns, discountColumns] = await Promise.all([
      getExistingOrderDeliveryColumns(),
      getExistingOrderDiscountColumns(),
    ]);

    const pricing = await calculateOrderPricing({
      items,
      deliveryFee: deliveryQuote.deliveryFee,
      discountCode: body.discountCode,
      customerId: req.customer?.id,
      customerEmail: body.customerEmail,
    });

    if (!pricing.isValid) {
      return res.status(409).json({
        success: false,
        message: "Some products in your cart are no longer available.",
        code: "CART_CHANGED",
        issues: pricing.issues,
      });
    }

    const reference = `LUMA-PAY-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    const amountKobo = Math.round(Number(pricing.totalAmount) * 100);
    const deliveryFields = await buildOrderDeliveryFields({
      existingColumns: deliveryColumns,
      deliveryQuote: { ...deliveryQuote, deliveryFee: pricing.deliveryFee },
      deliveryNotes: body.deliveryNotes
        ? String(body.deliveryNotes).trim()
        : null,
      state: deliveryState,
      area: body.area,
      displayCurrency: currencySnapshot.code,
      exchangeRate: currencySnapshot.rateToBase,
      exchangeRateTimestamp: currencySnapshot.updatedAt,
    });
    const discountFields = await buildOrderDiscountFields({
      existingColumns: discountColumns,
      pricing,
    });

    const columns = [
      "customer_id",
      "customer_name",
      "customer_email",
      "customer_phone",
      "delivery_address",
      "city",
      "country",
      "total_amount",
      "status",
      "payment_status",
      "payment_provider",
      "payment_reference",
      "paystack_reference",
      "provider_reference",
      "metadata",
    ];
    const values = [
      req.customer?.id || null,
      body.customerName,
      body.customerEmail,
      body.customerPhone || null,
      body.deliveryAddress || null,
      deliveryRegion || null,
      body.country || null,
      pricing.totalAmount,
      "pending",
      "pending",
      "paystack",
      reference,
      reference,
      reference,
      JSON.stringify({
        paymentCurrency: "NGN",
        paymentAmountKobo: amountKobo,
        displayCurrency: currencySnapshot.code,
        displayExchangeRate: currencySnapshot.rateToBase,
        deliveryMethod,
        pickupLocation: deliveryQuote.pickupLocation,
        growthSessionId: body.growthSessionId || null,
      }),
    ];

    for (const field of [...deliveryFields, ...discountFields]) {
      if (columns.includes(field.column)) continue;
      columns.push(field.column);
      values.push(field.value);
    }

    client = await pool.connect();
    await client.query("BEGIN");
    transactionOpen = true;

    const orderResult = await client.query(
      `INSERT INTO orders (${columns.join(", ")}) VALUES (${values
        .map((_, index) => `$${index + 1}`)
        .join(", ")}) RETURNING *`,
      values
    );
    const order = orderResult.rows[0];

    for (const item of pricing.items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, product_image, price, quantity, size)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          order.id,
          item.productId,
          item.name,
          item.image || null,
          item.price,
          item.quantity,
          item.size || null,
        ]
      );
    }

    await client.query("COMMIT");
    transactionOpen = false;
    client.release();
    client = null;

    let initialized;
    try {
      initialized = await initializeTransaction({
        email: body.customerEmail,
        amount: String(amountKobo),
        currency: "NGN",
        reference,
        callback_url: callbackUrl(),
        metadata: JSON.stringify({
          orderId: order.id,
          customerId: req.customer?.id || null,
          growthSessionId: body.growthSessionId || null,
          customerName: body.customerName,
        }),
      });
    } catch (error) {
      await pool
        .query(
          "UPDATE orders SET payment_status='failed', updated_at=NOW() WHERE id=$1",
          [order.id]
        )
        .catch(() => {});
      throw error;
    }

    return res.status(201).json({
      success: true,
      gateway: "paystack",
      checkoutUrl: initialized.data.authorization_url,
      orderId: order.id,
      reference,
      data: {
        orderId: order.id,
        reference,
        checkoutUrl: initialized.data.authorization_url,
        authorizationUrl: initialized.data.authorization_url,
        accessCode: initialized.data.access_code,
        currency: "NGN",
        totalAmount: pricing.totalAmount,
      },
    });
  } catch (error) {
    if (transactionOpen && client) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error(
      "Initialize Paystack error:",
      pool.describeError ? pool.describeError(error) : error.message
    );
    return safeError(
      res,
      error,
      "We couldn't start your payment. Please try again."
    );
  } finally {
    if (client) client.release();
  }
}

async function finalizePaystackTransaction(
  transaction,
  source,
  expectedCustomerEmail = null
) {
  const reference = transaction.reference;
  const metadata = parseMetadata(transaction.metadata);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      "SELECT * FROM orders WHERE payment_reference=$1 FOR UPDATE",
      [reference]
    );
    const order = result.rows[0];

    if (!order) {
      const error = new Error("Order not found for this payment.");
      error.statusCode = 404;
      error.code = "ORDER_NOT_FOUND";
      throw error;
    }

    if (
      expectedCustomerEmail &&
      String(order.customer_email).toLowerCase() !==
        String(expectedCustomerEmail).toLowerCase()
    ) {
      const error = new Error("This payment does not belong to your account.");
      error.statusCode = 403;
      error.code = "ORDER_OWNERSHIP_MISMATCH";
      throw error;
    }

    const expectedAmountKobo = Math.round(Number(order.total_amount || 0) * 100);
    const paidAmountKobo = Number(transaction.amount || 0);
    const status = String(transaction.status || "").toLowerCase();
    const currency = String(transaction.currency || "").toUpperCase();

    if (
      status !== "success" ||
      transaction.reference !== reference ||
      currency !== "NGN" ||
      paidAmountKobo !== expectedAmountKobo
    ) {
      const error = new Error("Your payment could not be verified yet.");
      error.statusCode = 400;
      error.code = "PAYMENT_MISMATCH";
      throw error;
    }

    const wasAlreadyPaid = order.payment_status === "paid";
    const existingMetadata = parseMetadata(order.metadata);

    await client.query(
      `UPDATE orders
       SET paystack_reference=$2,
           provider_reference=$2,
           payment_provider='paystack',
           payment_verified_at=COALESCE(payment_verified_at,NOW()),
           paid_at=COALESCE(paid_at,NOW()),
           metadata=$3::jsonb,
           updated_at=NOW()
       WHERE id=$1`,
      [
        order.id,
        reference,
        JSON.stringify({
          ...existingMetadata,
          paymentCurrency: currency,
          paymentAmountKobo: paidAmountKobo,
          paystackTransactionId: String(transaction.id || ""),
          paystackChannel: transaction.channel || null,
          paystackGatewayResponse: transaction.gateway_response || null,
          paystackVerifiedAt: new Date().toISOString(),
          growthSessionId:
            metadata.growthSessionId || existingMetadata.growthSessionId || null,
        }),
      ]
    );

    const reconciliation = await reconcileSuccessfulPaymentStock({
      client,
      order,
      reference,
      createdBy: source,
    });
    const growthSessionId =
      metadata.growthSessionId || existingMetadata.growthSessionId || null;

    await markAbandonedCartRecovered({
      client,
      sessionId: growthSessionId,
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone,
      orderId: order.id,
    });

    if (!wasAlreadyPaid && reconciliation.success) {
      await incrementDiscountUsage({
        client,
        discountCodeId: order.discount_code_id,
      });
      await recordAnalyticsEvent({
        eventType: "purchase_completed",
        sessionId: growthSessionId,
        customerEmail: order.customer_email,
        orderId: order.id,
        value: Number(order.total_amount || 0),
        metadata: { source, reference, gateway: "paystack" },
      });
    }

    await client.query("COMMIT");

    if (!wasAlreadyPaid && reconciliation.success) {
      await emitPaidOrderEvents({
        order: reconciliation.order,
        stockReduction: reconciliation.stockReduction,
        sessionId: growthSessionId,
        source,
      });

      const email = await sendOrderConfirmationEmails(order.id);
      await recordAutomationAttempt({
        eventType: "order_confirmation",
        status: email?.sent ? "sent" : "failed",
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        orderId: order.id,
        payload: {
          source,
          gateway: "paystack",
          emailStatus: email?.status || "unknown",
        },
        errorMessage: email?.sent ? null : email?.message,
      });
    }

    return {
      order: reconciliation.order,
      alreadyPaid: wasAlreadyPaid,
      stockIssue: !reconciliation.success,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function verifyPaystackPayment(req, res) {
  try {
    const reference = req.body?.reference || req.query?.reference;
    const verified = await verifyTransaction(reference);
    const result = await finalizePaystackTransaction(
      verified.data,
      "paystack_callback",
      req.customer?.email
    );

    return res.json({
      success: true,
      message: result.stockIssue
        ? "Payment received. Your order needs a quick stock review."
        : "Payment successful.",
      data: result.order,
    });
  } catch (error) {
    console.error("Verify Paystack error:", error.message);
    return safeError(
      res,
      error,
      "Your payment could not be verified yet."
    );
  }
}

async function handlePaystackWebhook(req, res) {
  if (!isValidWebhook(req.rawBody, req.headers)) {
    return res.status(401).json({
      success: false,
      message: "Invalid webhook signature.",
      code: "INVALID_WEBHOOK_SIGNATURE",
    });
  }

  const payload = req.body || {};

  if (payload.event !== "charge.success" || !payload.data?.reference) {
    return res.status(200).json({
      success: true,
      message: "Webhook ignored.",
    });
  }

  try {
    await finalizePaystackTransaction(payload.data, "paystack_webhook");
    return res.status(200).json({
      success: true,
      message: "Webhook processed.",
    });
  } catch (error) {
    console.error("Paystack webhook processing error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Webhook processing will be retried.",
    });
  }
}

module.exports = {
  initializePaystackPayment,
  verifyPaystackPayment,
  handlePaystackWebhook,
};
