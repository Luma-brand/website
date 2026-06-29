const pool = require("../config/db");
const { buildCartPricingSnapshot } = require("../services/inventoryService");
const {
  buildOrderDeliveryFields,
  getDeliveryQuote,
} = require("../services/deliveryService");

const isValidProductId = (productId) => {
  return productId && /^[0-9a-fA-F-]{36}$/.test(productId);
};

async function getExistingOrderColumns(columnNames = []) {
  const result = await pool.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'orders'
        AND column_name = ANY($1::text[])
    `,
    [columnNames]
  );

  return new Set(result.rows.map((row) => row.column_name));
}

const createOrder = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      deliveryAddress,
      city,
      state,
      country,
      deliveryNotes,
      items,
    } = req.body;

    if (!customerName || !customerEmail || !items?.length) {
      return res.status(400).json({
        success: false,
        message: "Customer name, email, and order items are required",
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
    const deliveryQuote = await getDeliveryQuote({
      country,
      state: deliveryState,
      region: city,
    });

    await client.query("BEGIN");

    const cartSnapshot = await buildCartPricingSnapshot(normalizedItems, {
      client,
      deliveryFee: deliveryQuote.deliveryFee,
    });

    if (!cartSnapshot.isValid) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        success: false,
        message: "Some products in your cart are no longer available.",
        issues: cartSnapshot.issues,
      });
    }

    const deliveryFields = await buildOrderDeliveryFields({
      client,
      deliveryQuote,
      deliveryNotes,
      state: deliveryState,
    });

    const orderColumns = [
      "customer_name",
      "customer_email",
      "customer_phone",
      "delivery_address",
      "city",
      "country",
      "total_amount",
    ];
    const orderValues = [
      customerName,
      customerEmail,
      customerPhone || null,
      deliveryAddress || null,
      city || null,
      country || null,
      cartSnapshot.totalAmount,
    ];

    deliveryFields.forEach((field) => {
      orderColumns.push(field.column);
      orderValues.push(field.value);
    });

    const orderPlaceholders = orderValues
      .map((_, index) => `$${index + 1}`)
      .join(", ");

    const orderResult = await client.query(
      `
      INSERT INTO orders (${orderColumns.join(", ")})
      VALUES (${orderPlaceholders})
      RETURNING *
      `,
      orderValues
    );

    const order = orderResult.rows[0];

    for (const item of cartSnapshot.items) {
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

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Create order error:", error.message);

    if (error.code === "NO_DELIVERY_ZONE") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error while creating order",
    });
  } finally {
    client.release();
  }
};

const getOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM orders
      ORDER BY created_at DESC
      `
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get orders error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching orders",
    });
  }
};

const getSingleOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const orderResult = await pool.query(
      `
      SELECT *
      FROM orders
      WHERE id = $1
      `,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const itemsResult = await pool.query(
      `
      SELECT *
      FROM order_items
      WHERE order_id = $1
      ORDER BY created_at ASC
      `,
      [id]
    );

    return res.status(200).json({
      success: true,
      data: {
        ...orderResult.rows[0],
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    console.error("Get single order error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching order",
    });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentStatus } = req.body;

    const result = await pool.query(
      `
      UPDATE orders
      SET
        status = COALESCE($1, status),
        payment_status = COALESCE($2, payment_status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING *
      `,
      [status || null, paymentStatus || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update order error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while updating order",
    });
  }
};

const deleteOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM orders
      WHERE id = $1
      RETURNING id, customer_email
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Order deleted successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Delete order error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while deleting order",
    });
  }
};


const getPublicOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const optionalColumns = [
      "delivery_fee",
      "discount_code",
      "discount_amount",
      "final_amount",
      "subtotal_amount",
    ];
    const existingColumns = await getExistingOrderColumns(optionalColumns);
    const selectedOptionalColumns = optionalColumns.filter((column) =>
      existingColumns.has(column)
    );
    const selectColumns = [
      "id",
      "customer_name",
      "customer_email",
      "total_amount",
      "status",
      "payment_status",
      "created_at",
      ...selectedOptionalColumns,
    ];

    const orderResult = await pool.query(
      `
      SELECT ${selectColumns.join(", ")}
      FROM orders
      WHERE id = $1
      `,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const itemsResult = await pool.query(
      `
      SELECT product_name, product_image, price, quantity, size
      FROM order_items
      WHERE order_id = $1
      ORDER BY created_at ASC
      `,
      [id]
    );

    return res.status(200).json({
      success: true,
      data: {
        ...orderResult.rows[0],
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    console.error("Get public order error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching order",
    });
  }
};


module.exports = {
  createOrder,
  getOrders,
  getSingleOrder,
  getPublicOrder,
  updateOrderStatus,
  deleteOrder,
};
