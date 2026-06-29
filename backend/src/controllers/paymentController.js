const crypto = require("crypto");
const pool = require("../config/db");
const { sendOrderConfirmationEmails } = require("../services/emailService");
const { reduceStockAfterPaidOrder } = require("../services/inventoryService");
const {
  buildOrderDeliveryFields,
  getDeliveryQuote,
  getExistingOrderDeliveryColumns,
} = require("../services/deliveryService");
const {
  markAbandonedCartRecovered,
  recordAnalyticsEvent,
} = require("../services/growthService");
const { recordAutomationAttempt } = require("../services/automationService");
const {
  emitOrderCompleted,
  emitStockTransition,
} = require("../services/automationEventBridge");
const {
  buildOrderDiscountFields,
  calculateOrderPricing,
  getExistingOrderDiscountColumns,
  incrementDiscountUsage,
} = require("../services/discountService");
const {
  isMissingWaitlistTable,
  markWaitlistsPurchasedForPaidOrder,
} = require("../services/productWaitlistService");
const {
  markBrowseAbandonmentsConvertedForOrder,
} = require("../services/browseAbandonmentService");

const PAYSTACK_BASE_URL = "https://api.paystack.co";

const generateReference = () => {
  return `LUMA-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
};

const isValidProductId = (productId) => {
  return productId && /^[0-9a-fA-F-]{36}$/.test(productId);
};

const getAmountInKobo = (amount) => {
  return Math.round(Number(amount || 0) * 100);
};

const getPaystackCallbackUrl = (orderId) => {
  const fallbackFrontendUrl = process.env.FRONTEND_URL || "https://shopwithluma.com";
  const configuredCallback = process.env.PAYSTACK_CALLBACK_URL || `${fallbackFrontendUrl.replace(/\/$/, "")}/order-success`;
  const baseCallback = configuredCallback.replace(/\/$/, "");

  if (baseCallback.includes("{orderId}")) {
    return baseCallback.replace("{orderId}", orderId);
  }

  return `${baseCallback}/${orderId}`;
};

const isPaystackAmountValid = (transaction, order) => {
  return Number(transaction.amount) === getAmountInKobo(order.total_amount);
};

const reconcileSuccessfulPaymentStock = async ({
  client,
  order,
  reference,
  createdBy,
}) => {
  const stockReduction = await reduceStockAfterPaidOrder({
    client,
    orderId: order.id,
    paymentReference: reference,
    createdBy,
  });

  if (!stockReduction.success) {
    const stockIssueOrderResult = await client.query(
      `
        UPDATE orders
        SET
          payment_status = 'paid',
          status = 'stock_issue',
          updated_at = CURRENT_TIMESTAMP
        WHERE paystack_reference = $1
        RETURNING *
      `,
      [reference]
    );

    return {
      success: false,
      stockReduction,
      order: stockIssueOrderResult.rows[0],
    };
  }

  const updatedOrderResult = await client.query(
    `
      UPDATE orders
      SET
        payment_status = 'paid',
        status = CASE
          WHEN status IN ('pending', 'stock_issue') THEN 'processing'
          ELSE status
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE paystack_reference = $1
      RETURNING *
    `,
    [reference]
  );

  try {
    await markWaitlistsPurchasedForPaidOrder({
      client,
      order: updatedOrderResult.rows[0],
    });
  } catch (error) {
    if (!isMissingWaitlistTable(error)) {
      console.error("Product waitlist conversion error:", error.message);
    }
  }

  return {
    success: true,
    stockReduction,
    order: updatedOrderResult.rows[0],
  };
};

async function emitPaidOrderEvents({ order, stockReduction, sessionId, source }) {
  await markBrowseAbandonmentsConvertedForOrder(order).catch((error) => {
    console.error("Browse abandonment paid-order conversion error:", error.message);
  });
  await emitOrderCompleted(order, { sessionId, source });

  for (const movement of stockReduction?.movements || []) {
    if (!movement?.product_id) continue;
    await emitStockTransition(
      { id: movement.product_id },
      Number(movement.previous_stock || 0),
      Number(movement.new_stock || 0),
      { orderId: order.id, source }
    );
  }
}

const initializePaystackPayment = async (req, res) => {
  let client;
  let transactionStarted = false;
  let stage = "validate_request";

  try {
    if (!process.env.PAYSTACK_SECRET_KEY) {
      return res.status(500).json({
        success: false,
        message: "Payment provider is not configured. Set PAYSTACK_SECRET_KEY on the backend.",
      });
    }

    const {
      customerName,
      customerEmail,
      customerPhone,
      deliveryAddress,
      city,
      state,
      country,
      deliveryNotes,
      discountCode,
      growthSessionId,
      items,
    } = req.body;
    const normalizedDeliveryNotes = deliveryNotes
      ? String(deliveryNotes).trim()
      : null;

    if (!customerName || !customerEmail || !items?.length) {
      return res.status(400).json({
        success: false,
        message: "Customer name, email, and order items are required.",
      });
    }

    const normalizedItems = items.map((item) => ({
      ...item,
      productId: isValidProductId(item.productId) ? item.productId : null,
      quantity: Number(item.quantity || 0),
    }));

    const invalidItem = normalizedItems.find(
      (item) => !item.productId || item.quantity <= 0
    );

    if (invalidItem) {
      return res.status(400).json({
        success: false,
        message: "Each order item must have a valid product ID and quantity.",
      });
    }

    const deliveryState = state || city;

    stage = "load_delivery_quote";
    const deliveryQuote = await getDeliveryQuote({
      country,
      state: deliveryState,
      region: city,
    });

    stage = "load_order_schema_columns";
    const [deliveryColumns, discountColumns] = await Promise.all([
      getExistingOrderDeliveryColumns(),
      getExistingOrderDiscountColumns(),
    ]);

    stage = "calculate_order_pricing";
    const pricedCartSnapshot = await calculateOrderPricing({
      items: normalizedItems,
      deliveryFee: deliveryQuote.deliveryFee,
      discountCode,
    });

    if (!pricedCartSnapshot.isValid) {
      return res.status(409).json({
        success: false,
        message: "Some products in your cart are no longer available.",
        issues: pricedCartSnapshot.issues,
      });
    }

    stage = "build_order_fields";
    const deliveryFields = await buildOrderDeliveryFields({
      existingColumns: deliveryColumns,
      deliveryQuote: {
        ...deliveryQuote,
        deliveryFee: pricedCartSnapshot.deliveryFee,
      },
      deliveryNotes: normalizedDeliveryNotes,
      state: deliveryState,
    });
    const discountFields = await buildOrderDiscountFields({
      existingColumns: discountColumns,
      pricing: pricedCartSnapshot,
    });

    const reference = generateReference();
    const orderColumns = [
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
      "paystack_reference",
    ];
    const orderValues = [
      customerName,
      customerEmail,
      customerPhone || null,
      deliveryAddress || null,
      city || null,
      country || null,
      pricedCartSnapshot.totalAmount,
      "pending",
      "unpaid",
      "paystack",
      reference,
    ];

    deliveryFields.forEach((field) => {
      orderColumns.push(field.column);
      orderValues.push(field.value);
    });
    discountFields.forEach((field) => {
      orderColumns.push(field.column);
      orderValues.push(field.value);
    });

    const orderPlaceholders = orderValues
      .map((_, index) => `$${index + 1}`)
      .join(", ");

    client = await pool.connect();
    stage = "begin_order_transaction";
    await client.query("BEGIN");
    transactionStarted = true;

    stage = "insert_order";
    const orderResult = await client.query(
      `
        INSERT INTO orders (${orderColumns.join(", ")})
        VALUES (${orderPlaceholders})
        RETURNING *
      `,
      orderValues
    );

    const order = orderResult.rows[0];

    stage = "insert_order_items";
    for (const item of pricedCartSnapshot.items) {
      await client.query(
        `
          INSERT INTO order_items (
            order_id,
            product_id,
            product_name,
            product_image,
            price,
            quantity,
            size
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
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

    stage = "commit_order_transaction";
    await client.query("COMMIT");
    transactionStarted = false;
    client.release();
    client = null;

    const amountInKobo = getAmountInKobo(pricedCartSnapshot.totalAmount);

    stage = "initialize_paystack";
    const paystackTimeoutMs = Number(process.env.PAYSTACK_TIMEOUT_MS || 15000);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), paystackTimeoutMs);

    let paystackResponse;
    let paystackData;

    try {
      paystackResponse = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          email: customerEmail,
          amount: amountInKobo,
          currency: process.env.PAYSTACK_CURRENCY || "NGN",
          reference,
          callback_url: getPaystackCallbackUrl(order.id),
          metadata: {
            orderId: order.id,
            customerName,
            customerPhone,
            deliveryFee: pricedCartSnapshot.deliveryFee,
            discountCode: pricedCartSnapshot.discountCode,
            discountAmount: pricedCartSnapshot.discountAmount,
            freeShipping: pricedCartSnapshot.freeShipping,
            deliveryZoneId: deliveryQuote.matchedZone?.id || null,
            deliveryNotes: normalizedDeliveryNotes
              ? normalizedDeliveryNotes.slice(0, 500)
              : null,
            growthSessionId: growthSessionId || null,
          },
        }),
      });
      paystackData = await paystackResponse.json().catch(() => ({}));
    } finally {
      clearTimeout(timeout);
    }

    if (!paystackResponse.ok || !paystackData.status) {
      await pool.query(
        `
          UPDATE orders
          SET payment_status = 'failed', updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [order.id]
      ).catch((updateError) => {
        console.error("Failed to mark Paystack initialization failure:", pool.describeError ? pool.describeError(updateError) : updateError.message);
      });

      return res.status(400).json({
        success: false,
        message: paystackData.message || "Unable to initialize Paystack payment.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Paystack payment initialized successfully.",
      data: {
        orderId: order.id,
        reference,
        authorizationUrl: paystackData.data.authorization_url,
        accessCode: paystackData.data.access_code,
        subtotalAmount: pricedCartSnapshot.subtotalAmount,
        deliveryFee: pricedCartSnapshot.deliveryFee,
        discountCode: pricedCartSnapshot.discountCode,
        discountAmount: pricedCartSnapshot.discountAmount,
        freeShipping: pricedCartSnapshot.freeShipping,
        freeShippingThreshold: pricedCartSnapshot.freeShippingThreshold,
        totalAmount: pricedCartSnapshot.totalAmount,
      },
    });
  } catch (error) {
    if (transactionStarted && client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Initialize Paystack rollback failed:", pool.describeError ? pool.describeError(rollbackError) : rollbackError.message);
      }
    }

    console.error("Initialize Paystack error:", {
      stage,
      ...(pool.describeError ? pool.describeError(error) : { message: error.message, code: error.code }),
    });

    if (error.name === "AbortError") {
      return res.status(504).json({
        success: false,
        message: "Payment provider timed out while initializing payment. Please try again.",
      });
    }

    if (error.code === "NO_DELIVERY_ZONE") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Server error while initializing payment.",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
};
const verifyPaystackPayment = async (req, res) => {
  const client = await pool.connect();

  try {
    const { reference } = req.params;

    const paystackResponse = await fetch(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok || !paystackData.status) {
      return res.status(400).json({
        success: false,
        message: paystackData.message || "Unable to verify payment.",
      });
    }

    const transaction = paystackData.data;

    await client.query("BEGIN");

    const orderResult = await client.query(
      `
        SELECT *
        FROM orders
        WHERE paystack_reference = $1
        FOR UPDATE
      `,
      [reference]
    );

    if (orderResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Order not found for this payment reference.",
      });
    }

    const order = orderResult.rows[0];

    if (transaction.status !== "success") {
      await client.query("ROLLBACK");

      return res.status(200).json({
        success: false,
        message: `Payment status is ${transaction.status}.`,
        data: order,
      });
    }

    if (!isPaystackAmountValid(transaction, order)) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Payment amount does not match this order.",
      });
    }

    const wasAlreadyPaid = order.payment_status === "paid";
    const reconciliation = await reconcileSuccessfulPaymentStock({
      client,
      order,
      reference,
      createdBy: "paystack_verify",
    });

    if (!reconciliation.success) {
      if (!wasAlreadyPaid) {
        await recordAnalyticsEvent({
          eventType: "purchase_completed",
          sessionId: transaction.metadata?.growthSessionId,
          customerEmail: order.customer_email,
          orderId: order.id,
          value: Number(order.total_amount || 0),
          metadata: {
            source: "paystack_verify",
            stockIssue: true,
            reference,
          },
        });
      }

      await markAbandonedCartRecovered({
        client,
        sessionId: transaction.metadata?.growthSessionId,
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        orderId: order.id,
      });

      await client.query("COMMIT");

      return res.status(409).json({
        success: false,
        message:
          "Payment was successful, but one or more products are no longer in stock. Please contact support.",
        issues: reconciliation.stockReduction.issues,
        data: reconciliation.order,
      });
    }

    await markAbandonedCartRecovered({
      client,
      sessionId: transaction.metadata?.growthSessionId,
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone,
      orderId: order.id,
    });

    if (!wasAlreadyPaid) {
      await incrementDiscountUsage({
        client,
        discountCodeId: order.discount_code_id,
      });
      await recordAnalyticsEvent({
        eventType: "purchase_completed",
        sessionId: transaction.metadata?.growthSessionId,
        customerEmail: order.customer_email,
        orderId: order.id,
        value: Number(order.total_amount || 0),
        metadata: {
          source: "paystack_verify",
          reference,
        },
      });
    }

    await client.query("COMMIT");

    if (!wasAlreadyPaid) {
      await emitPaidOrderEvents({
        order: reconciliation.order,
        stockReduction: reconciliation.stockReduction,
        sessionId: transaction.metadata?.growthSessionId,
        source: "paystack_verify",
      });
      const emailResult = await sendOrderConfirmationEmails(order.id);
      await recordAutomationAttempt({
        eventType: "order_confirmation",
        status: emailResult?.sent ? "sent" : "failed",
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        orderId: order.id,
        payload: {
          source: "paystack_verify",
          emailStatus: emailResult?.status || "unknown",
        },
        errorMessage: emailResult?.sent ? null : emailResult?.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: wasAlreadyPaid
        ? "Payment already verified. Stock status reconciled."
        : "Payment verified successfully.",
      data: reconciliation.order,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Verify Paystack error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while verifying payment.",
    });
  } finally {
    client.release();
  }
};

const handlePaystackWebhook = async (req, res) => {
  const client = await pool.connect();

  try {
    const signature = req.headers["x-paystack-signature"];

    const hash = crypto
      .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (hash !== signature) {
      return res.status(401).json({
        success: false,
        message: "Invalid Paystack webhook signature.",
      });
    }

    const event = req.body;

    if (event.event !== "charge.success") {
      return res.status(200).json({
        success: true,
        message: "Webhook received but ignored.",
      });
    }

    const transaction = event.data;
    const reference = transaction.reference;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "No payment reference found.",
      });
    }

    await client.query("BEGIN");

    const orderResult = await client.query(
      `
        SELECT *
        FROM orders
        WHERE paystack_reference = $1
        FOR UPDATE
      `,
      [reference]
    );

    if (orderResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Order not found for webhook reference.",
      });
    }

    const order = orderResult.rows[0];

    if (!isPaystackAmountValid(transaction, order)) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Payment amount does not match this order.",
      });
    }

    const wasAlreadyPaid = order.payment_status === "paid";
    const reconciliation = await reconcileSuccessfulPaymentStock({
      client,
      order,
      reference,
      createdBy: "paystack_webhook",
    });

    if (!reconciliation.success) {
      if (!wasAlreadyPaid) {
        await recordAnalyticsEvent({
          eventType: "purchase_completed",
          sessionId: transaction.metadata?.growthSessionId,
          customerEmail: order.customer_email,
          orderId: order.id,
          value: Number(order.total_amount || 0),
          metadata: {
            source: "paystack_webhook",
            stockIssue: true,
            reference,
          },
        });
      }

      await markAbandonedCartRecovered({
        client,
        sessionId: transaction.metadata?.growthSessionId,
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        orderId: order.id,
      });

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message:
          "Webhook processed, payment marked paid, but order has stock issue.",
        issues: reconciliation.stockReduction.issues,
      });
    }

    await markAbandonedCartRecovered({
      client,
      sessionId: transaction.metadata?.growthSessionId,
      customerEmail: order.customer_email,
      customerPhone: order.customer_phone,
      orderId: order.id,
    });

    if (!wasAlreadyPaid) {
      await incrementDiscountUsage({
        client,
        discountCodeId: order.discount_code_id,
      });
      await recordAnalyticsEvent({
        eventType: "purchase_completed",
        sessionId: transaction.metadata?.growthSessionId,
        customerEmail: order.customer_email,
        orderId: order.id,
        value: Number(order.total_amount || 0),
        metadata: {
          source: "paystack_webhook",
          reference,
        },
      });
    }

    await client.query("COMMIT");

    if (!wasAlreadyPaid) {
      await emitPaidOrderEvents({
        order: reconciliation.order,
        stockReduction: reconciliation.stockReduction,
        sessionId: transaction.metadata?.growthSessionId,
        source: "paystack_webhook",
      });
      const emailResult = await sendOrderConfirmationEmails(order.id);
      await recordAutomationAttempt({
        eventType: "order_confirmation",
        status: emailResult?.sent ? "sent" : "failed",
        customerEmail: order.customer_email,
        customerPhone: order.customer_phone,
        orderId: order.id,
        payload: {
          source: "paystack_webhook",
          emailStatus: emailResult?.status || "unknown",
        },
        errorMessage: emailResult?.sent ? null : emailResult?.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: wasAlreadyPaid
        ? "Webhook processed. Stock status reconciled."
        : "Webhook processed successfully.",
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Paystack webhook error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while processing webhook.",
    });
  } finally {
    client.release();
  }
};

module.exports = {
  initializePaystackPayment,
  verifyPaystackPayment,
  handlePaystackWebhook,
};


