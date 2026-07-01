const streamifier = require("streamifier");
const pool = require("../config/db");
const cloudinary = require("../config/cloudinary");
const { createStockMovement } = require("../services/inventoryService");
const { emitStockTransition } = require("../services/automationEventBridge");
const {
  sendBackInStockNotificationsForProduct,
} = require("../services/growthService");

const DEFAULT_LOW_STOCK_THRESHOLD = 20;

function slugify(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

function isUuid(value = "") {
  return /^[0-9a-fA-F-]{36}$/.test(String(value));
}

function normalizeMetaText(value, maxLength) {
  const text = String(value || "").trim();
  return text ? text.slice(0, maxLength) : null;
}

async function assertUniqueSlug(client, slug, currentProductId = null) {
  if (!slug) {
    return;
  }

  const params = [slug];
  let currentProductCondition = "";

  if (currentProductId) {
    params.push(currentProductId);
    currentProductCondition = "AND id <> $2";
  }

  const result = await client.query(
    `
      SELECT id
      FROM products
      WHERE slug = $1
      ${currentProductCondition}
      LIMIT 1
    `,
    params
  );

  if (result.rows.length > 0) {
    const error = new Error("Product slug must be unique.");
    error.statusCode = 409;
    throw error;
  }
}

const uploadBufferToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: process.env.CLOUDINARY_FOLDER || "luma/products",
        resource_type: "image",
        transformation: [
          {
            quality: "auto",
            fetch_format: "auto",
          },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(uploadStream);
  });
};

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return value === "true" || value === "1" || value === 1;
}

function getStockStatus(product) {
  const stockQuantity = Number(product.stock_quantity || 0);
  const lowStockThreshold = Number(
    product.low_stock_threshold || DEFAULT_LOW_STOCK_THRESHOLD
  );

  if (stockQuantity <= 0) {
    return "out_of_stock";
  }

  if (stockQuantity <= lowStockThreshold) {
    return "low_stock";
  }

  return "in_stock";
}

function formatProduct(product) {
  if (!product) return null;

  const stockStatus = getStockStatus(product);
  const isActive = product.is_active !== false;
  const isPublished = product.status === "active";
  const isAvailable =
    isActive && isPublished && Number(product.stock_quantity || 0) > 0;

  return {
    ...product,
    stock_quantity: Number(product.stock_quantity || 0),
    low_stock_threshold: Number(
      product.low_stock_threshold || DEFAULT_LOW_STOCK_THRESHOLD
    ),
    price: Number(product.price || 0),
    stock_status: stockStatus,
    is_available: isAvailable,
    can_purchase: isAvailable,
  };
}

const createProduct = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      name,
      description,
      price,
      size,
      stockQuantity,
      lowStockThreshold,
      status,
      isActive,
      isFeatured,
      slug,
      metaTitle,
      metaDescription,
    } = req.body;

    if (!name || price === undefined || price === null || price === "") {
      return res.status(400).json({
        success: false,
        message: "Product name and price are required.",
      });
    }

    const parsedPrice = Number(price);
    const parsedStockQuantity = Number(stockQuantity || 0);
    const parsedLowStockThreshold = Number(
      lowStockThreshold || DEFAULT_LOW_STOCK_THRESHOLD
    );

    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Product price must be a valid number.",
      });
    }

    if (!Number.isInteger(parsedStockQuantity) || parsedStockQuantity < 0) {
      return res.status(400).json({
        success: false,
        message: "Stock quantity must be a whole number and cannot be negative.",
      });
    }

    if (
      !Number.isInteger(parsedLowStockThreshold) ||
      parsedLowStockThreshold < 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Low stock threshold must be a whole number.",
      });
    }

    let imageUrl = null;
    let imagePublicId = null;

    if (req.file) {
      const uploadResult = await uploadBufferToCloudinary(req.file.buffer);
      imageUrl = uploadResult.secure_url;
      imagePublicId = uploadResult.public_id;
    }

    const nextSlug = slugify(slug || name);
    const nextMetaTitle = normalizeMetaText(metaTitle || name, 180);
    const nextMetaDescription = normalizeMetaText(
      metaDescription || description || name,
      300
    );

    if (!nextSlug) {
      return res.status(400).json({
        success: false,
        message: "Product slug is required.",
      });
    }

    await client.query("BEGIN");
    await assertUniqueSlug(client, nextSlug);

    const result = await client.query(
      `
        INSERT INTO products (
          name,
          description,
          price,
          size,
          stock_quantity,
          low_stock_threshold,
          image_url,
          image_public_id,
          status,
          is_active,
          is_featured,
          slug,
          meta_title,
          meta_description,
          seo_updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, CURRENT_TIMESTAMP)
        RETURNING *
      `,
      [
        name,
        description || null,
        parsedPrice,
        size || null,
        parsedStockQuantity,
        parsedLowStockThreshold,
        imageUrl,
        imagePublicId,
        status || "draft",
        parseBoolean(isActive, true),
        parseBoolean(isFeatured, false),
        nextSlug,
        nextMetaTitle,
        nextMetaDescription,
      ]
    );

    const product = result.rows[0];

    if (parsedStockQuantity > 0) {
      await createStockMovement({
        client,
        productId: product.id,
        movementType: "stock_added",
        quantityChanged: parsedStockQuantity,
        previousStock: 0,
        newStock: parsedStockQuantity,
        reason: "Initial product stock",
        createdBy: req.admin?.email || "admin",
      });
    }

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Product created successfully.",
      data: formatProduct(product),
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Create product error:", error);

    const isSchemaMismatch = error.code === "42703";
    return res.status(error.statusCode || (error.code === "23505" ? 409 : 500)).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : error.code === "23505"
          ? "Product slug must be unique."
          : isSchemaMismatch
          ? "The product database schema is out of date. Run migration 032_products_seo_timestamp_sync.sql and try again."
          : "Server error while creating product.",
    });
  } finally {
    client.release();
  }
};

const getProducts = async (req, res) => {
  try {
    if (req.admin && req.query.admin === "true") {
      return getAdminProducts(req, res);
    }

    const reviewTable = await pool.query(
      `SELECT to_regclass('public.product_reviews') IS NOT NULL AS available`
    );
    const reviewFields = reviewTable.rows[0]?.available
      ? `, COALESCE(reviews.average_rating, 0)::numeric AS average_rating
         , COALESCE(reviews.review_count, 0)::int AS review_count`
      : `, 0::numeric AS average_rating, 0::int AS review_count`;
    const reviewJoin = reviewTable.rows[0]?.available
      ? `LEFT JOIN LATERAL (
           SELECT AVG(pr.rating) AS average_rating, COUNT(*) AS review_count
           FROM product_reviews pr
           WHERE pr.product_id = p.id AND pr.status = 'approved'
         ) reviews ON TRUE`
      : "";

    const result = await pool.query(
      `SELECT p.* ${reviewFields}
       FROM products p
       ${reviewJoin}
       WHERE COALESCE(p.is_active, TRUE) = TRUE
         AND p.status = 'active'
       ORDER BY COALESCE(p.is_featured, FALSE) DESC, p.created_at DESC`
    );

    const products = result.rows.map(formatProduct);

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error("Get public products error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching products.",
    });
  }
};

const getAdminProducts = async (req, res) => {
  try {
    const { search = "", status = "all" } = req.query;

    const values = [];
    const conditions = [];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(`name ILIKE $${values.length}`);
    }

    if (status === "active") {
      conditions.push("COALESCE(is_active, TRUE) = TRUE");
    }

    if (status === "inactive") {
      conditions.push("COALESCE(is_active, TRUE) = FALSE");
    }

    if (status === "in-stock") {
      conditions.push("COALESCE(stock_quantity, 0) > 0");
    }

    if (status === "low-stock") {
      conditions.push(
        "COALESCE(stock_quantity, 0) > 0 AND COALESCE(stock_quantity, 0) <= COALESCE(low_stock_threshold, 20)"
      );
    }

    if (status === "out-of-stock") {
      conditions.push("COALESCE(stock_quantity, 0) <= 0");
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const result = await pool.query(
      `
        SELECT *
        FROM products
        ${whereClause}
        ORDER BY created_at DESC
      `,
      values
    );

    const products = result.rows.map(formatProduct);

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error("Get admin products error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching admin products.",
    });
  }
};

const getSingleProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const lookupValue = String(id || "").trim();
    const lookupById = isUuid(lookupValue);

    const result = await pool.query(
      `
        SELECT *
        FROM products
        WHERE ${lookupById ? "id = $1" : "slug = $1"}
      `,
      [lookupValue]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    const product = formatProduct(result.rows[0]);

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("Get single product error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching product.",
    });
  }
};

const updateProduct = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    const {
      name,
      description,
      price,
      size,
      stockQuantity,
      lowStockThreshold,
      status,
      isActive,
      isFeatured,
      slug,
      metaTitle,
      metaDescription,
    } = req.body;

    await client.query("BEGIN");

    const existingProduct = await client.query(
      `
        SELECT *
        FROM products
        WHERE id = $1
        FOR UPDATE
      `,
      [id]
    );

    if (existingProduct.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    const currentProduct = existingProduct.rows[0];

    let imageUrl = currentProduct.image_url;
    let imagePublicId = currentProduct.image_public_id;

    if (req.file) {
      const uploadResult = await uploadBufferToCloudinary(req.file.buffer);

      imageUrl = uploadResult.secure_url;
      imagePublicId = uploadResult.public_id;

      if (currentProduct.image_public_id) {
        await cloudinary.uploader.destroy(currentProduct.image_public_id);
      }
    }

    const previousStock = Number(currentProduct.stock_quantity || 0);
    const nextStock =
      stockQuantity !== undefined && stockQuantity !== null && stockQuantity !== ""
        ? Number(stockQuantity)
        : previousStock;

    const nextLowStockThreshold =
      lowStockThreshold !== undefined &&
      lowStockThreshold !== null &&
      lowStockThreshold !== ""
        ? Number(lowStockThreshold)
        : Number(
            currentProduct.low_stock_threshold || DEFAULT_LOW_STOCK_THRESHOLD
          );

    const nextPrice =
      price !== undefined && price !== null && price !== ""
        ? Number(price)
        : Number(currentProduct.price);

    if (Number.isNaN(nextPrice) || nextPrice < 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Product price must be a valid number.",
      });
    }

    if (!Number.isInteger(nextStock) || nextStock < 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Stock quantity must be a whole number and cannot be negative.",
      });
    }

    if (!Number.isInteger(nextLowStockThreshold) || nextLowStockThreshold < 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Low stock threshold must be a whole number.",
      });
    }

    const nextName = name || currentProduct.name;
    const nextSlug = slugify(slug || currentProduct.slug || nextName);
    const nextMetaTitle = normalizeMetaText(
      metaTitle ?? currentProduct.meta_title ?? nextName,
      180
    );
    const nextMetaDescription = normalizeMetaText(
      metaDescription ?? currentProduct.meta_description ?? description ?? currentProduct.description ?? nextName,
      300
    );

    if (!nextSlug) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Product slug is required.",
      });
    }

    await assertUniqueSlug(client, nextSlug, id);

    const result = await client.query(
      `
        UPDATE products
        SET
          name = $1,
          description = $2,
          price = $3,
          size = $4,
          stock_quantity = $5,
          low_stock_threshold = $6,
          image_url = $7,
          image_public_id = $8,
          status = $9,
          is_active = $10,
          is_featured = $11,
          slug = $12,
          meta_title = $13,
          meta_description = $14,
          seo_updated_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $15
        RETURNING *
      `,
      [
        nextName,
        description ?? currentProduct.description,
        nextPrice,
        size ?? currentProduct.size,
        nextStock,
        nextLowStockThreshold,
        imageUrl,
        imagePublicId,
        status || currentProduct.status,
        parseBoolean(isActive, currentProduct.is_active !== false),
        parseBoolean(isFeatured, currentProduct.is_featured === true),
        nextSlug,
        nextMetaTitle,
        nextMetaDescription,
        id,
      ]
    );

    if (nextStock !== previousStock) {
      await createStockMovement({
        client,
        productId: id,
        movementType:
          nextStock > previousStock ? "stock_added" : "stock_reduced",
        quantityChanged: nextStock - previousStock,
        previousStock,
        newStock: nextStock,
        reason: "Manual product stock update",
        createdBy: req.admin?.email || "admin",
      });
    }

    await client.query("COMMIT");

    if (previousStock <= 0 && nextStock > 0) {
      try {
        await sendBackInStockNotificationsForProduct({
          product: result.rows[0],
          previousStock,
          newStock: nextStock,
        });
      } catch (error) {
        console.error("Back-in-stock notification error:", error.message);
      }
    }
    await emitStockTransition(result.rows[0], previousStock, nextStock, {
      source: "product_update",
    });

    return res.status(200).json({
      success: true,
      message: "Product updated successfully.",
      data: formatProduct(result.rows[0]),
    });
  } catch (error) {
    await client.query("ROLLBACK");

    console.error("Update product error:", error);

    return res.status(error.statusCode || (error.code === "23505" ? 409 : 500)).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : error.code === "23505"
          ? "Product slug must be unique."
          : "Server error while updating product.",
    });
  } finally {
    client.release();
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const existingProduct = await pool.query(
      `
        SELECT *
        FROM products
        WHERE id = $1
      `,
      [id]
    );

    if (existingProduct.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    const product = existingProduct.rows[0];

    if (product.image_public_id) {
      await cloudinary.uploader.destroy(product.image_public_id);
    }

    const result = await pool.query(
      `
        DELETE FROM products
        WHERE id = $1
        RETURNING id, name
      `,
      [id]
    );

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully.",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Delete product error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while deleting product.",
    });
  }
};

module.exports = {
  createProduct,
  getProducts,
  getAdminProducts,
  getSingleProduct,
  updateProduct,
  deleteProduct,
};

