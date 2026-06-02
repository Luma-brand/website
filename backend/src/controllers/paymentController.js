const crypto = require("crypto");
const pool = require("../config/db");
const { sendOrderConfirmationEmails } = require("../services/emailService");

const PAYSTACK_BASE_URL = "https://api.paystack.co";

const generateReference = () => {
  return `LUMA-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
};

const isValidProductId = (productId) => {
  return productId && /^[0-9a-fA-F-]{36}$/.test(productId);
};

const initializePaystackPayment = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      deliveryAddress,
      city,
      country,
      totalAmount,
      items,
    } = req.body;

    if (!customerName || !customerEmail || !totalAmount || !items?.length) {
      return res.status(400).json({
        success: false,
        message:
          "Customer name, email, total amount, and order items are required",
      });
    }

    const reference = generateReference();

    await client.query("BEGIN");

    const orderResult = await client.query(
      `
      INSERT INTO orders (
        customer_name,
        customer_email,
        customer_phone,
        delivery_address,
        city,
        country,
        total_amount,
        status,
        payment_status,
        payment_provider,
        paystack_reference
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'unpaid', 'paystack', $8)
      RETURNING *
      `,
      [
        customerName,
        customerEmail,
        customerPhone || null,
        deliveryAddress || null,
        city || null,
        country || null,
        Number(totalAmount),
        reference,
      ]
    );

    const order = orderResult.rows[0];

    for (const item of items) {
      const validProductId = isValidProductId(item.productId)
        ? item.productId
        : null;

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
          validProductId,
          item.name,
          item.image || null,
          Number(item.price),
          Number(item.quantity),
          item.size || null,
        ]
      );
    }

    const amountInKobo = Math.round(Number(totalAmount) * 100);

    const paystackResponse = await fetch(
      `${PAYSTACK_BASE_URL}/transaction/initialize`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: customerEmail,
          amount: amountInKobo,
          currency: process.env.PAYSTACK_CURRENCY || "NGN",
          reference,
          channels: ["card", "bank_transfer"],
          callback_url: `${process.env.PAYSTACK_CALLBACK_URL}/${order.id}`,
          metadata: {
            orderId: order.id,
            customerName,
            customerPhone,
          },
        }),
      }
    );

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok || !paystackData.status) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          paystackData.message || "Unable to initialize Paystack payment",
      });
    }

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Paystack payment initialized successfully",
      data: {
        orderId: order.id,
        reference,
        authorizationUrl: paystackData.data.authorization_url,
        accessCode: paystackData.data.access_code,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Initialize Paystack error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while initializing payment",
    });
  } finally {
    client.release();
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
        message: paystackData.message || "Unable to verify payment",
      });
    }

    const transaction = paystackData.data;

    const orderResult = await client.query(
      `
      SELECT *
      FROM orders
      WHERE paystack_reference = $1
      `,
      [reference]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found for this payment reference",
      });
    }

    const order = orderResult.rows[0];

    if (transaction.status !== "success") {
      return res.status(200).json({
        success: false,
        message: `Payment status is ${transaction.status}`,
        data: order,
      });
    }

    if (order.payment_status === "paid") {
      return res.status(200).json({
        success: true,
        message: "Payment already verified",
        data: order,
      });
    }

    await client.query("BEGIN");

    const updatedOrderResult = await client.query(
      `
      UPDATE orders
      SET
        payment_status = 'paid',
        status = 'processing',
        updated_at = CURRENT_TIMESTAMP
      WHERE paystack_reference = $1
      RETURNING *
      `,
      [reference]
    );

    const itemsResult = await client.query(
      `
      SELECT product_id, quantity
      FROM order_items
      WHERE order_id = $1
      `,
      [order.id]
    );

    for (const item of itemsResult.rows) {
      if (item.product_id) {
        await client.query(
          `
          UPDATE products
          SET stock_quantity = GREATEST(stock_quantity - $1, 0),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          `,
          [Number(item.quantity), item.product_id]
        );
      }
    }

  await client.query("COMMIT");

await sendOrderConfirmationEmails(order.id);

return res.status(200).json({
  success: true,
  message: "Payment verified successfully",
  data: updatedOrderResult.rows[0],
});
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Verify Paystack error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while verifying payment",
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
        message: "Invalid Paystack webhook signature",
      });
    }

    const event = req.body;

    if (event.event !== "charge.success") {
      return res.status(200).json({
        success: true,
        message: "Webhook received but ignored",
      });
    }

    const transaction = event.data;
    const reference = transaction.reference;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: "No payment reference found",
      });
    }

    await client.query("BEGIN");

    const orderResult = await client.query(
      `
      SELECT *
      FROM orders
      WHERE paystack_reference = $1
      `,
      [reference]
    );

    if (orderResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Order not found for webhook reference",
      });
    }

    const order = orderResult.rows[0];

    if (order.payment_status === "paid") {
      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: "Order already marked as paid",
      });
    }

    await client.query(
      `
      UPDATE orders
      SET
        payment_status = 'paid',
        status = 'processing',
        updated_at = CURRENT_TIMESTAMP
      WHERE paystack_reference = $1
      `,
      [reference]
    );

    const itemsResult = await client.query(
      `
      SELECT product_id, quantity
      FROM order_items
      WHERE order_id = $1
      `,
      [order.id]
    );

    for (const item of itemsResult.rows) {
      if (item.product_id) {
        await client.query(
          `
          UPDATE products
          SET stock_quantity = GREATEST(stock_quantity - $1, 0),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          `,
          [Number(item.quantity), item.product_id]
        );
      }
    }

    await client.query("COMMIT");

await sendOrderConfirmationEmails(order.id);

return res.status(200).json({
  success: true,
  message: "Webhook processed successfully",
});
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Paystack webhook error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while processing webhook",
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
