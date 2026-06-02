const pool = require("../config/db");

const createOrder = async (req, res) => {
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
        message: "Customer name, email, total amount, and order items are required",
      });
    }

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
        total_amount
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
      `,
      [
        customerName,
        customerEmail,
        customerPhone || null,
        deliveryAddress || null,
        city || null,
        country || null,
        totalAmount,
      ]
    );

    const order = orderResult.rows[0];

    for (const item of items) {
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
  item.productId && /^[0-9a-fA-F-]{36}$/.test(item.productId)
    ? item.productId
    : null,
  item.name,
  item.image || null,
  Number(item.price),
  Number(item.quantity),
  item.size || null,
]
      );

     const validProductId =
  item.productId && /^[0-9a-fA-F-]{36}$/.test(item.productId)
    ? item.productId
    : null;

if (validProductId) {
  await client.query(
    `
    UPDATE products
    SET stock_quantity = GREATEST(stock_quantity - $1, 0),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    `,
    [Number(item.quantity), validProductId]
  );
}
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

    const orderResult = await pool.query(
      `
      SELECT id, customer_name, customer_email, total_amount, status, payment_status, created_at
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