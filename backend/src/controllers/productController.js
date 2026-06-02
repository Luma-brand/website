const streamifier = require("streamifier");
const pool = require("../config/db");
const cloudinary = require("../config/cloudinary");

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

const createProduct = async (req, res) => {
  try {
    const { name, description, price, size, stockQuantity, status } = req.body;

    if (!name || !price) {
      return res.status(400).json({
        success: false,
        message: "Product name and price are required",
      });
    }

    let imageUrl = null;
    let imagePublicId = null;

    if (req.file) {
      const uploadResult = await uploadBufferToCloudinary(req.file.buffer);
      imageUrl = uploadResult.secure_url;
      imagePublicId = uploadResult.public_id;
    }

    const result = await pool.query(
      `
      INSERT INTO products (
        name,
        description,
        price,
        size,
        stock_quantity,
        image_url,
        image_public_id,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [
        name,
        description || null,
        Number(price),
        size || null,
        Number(stockQuantity || 0),
        imageUrl,
        imagePublicId,
        status || "draft",
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create product error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while creating product",
    });
  }
};

const getProducts = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT *
      FROM products
      ORDER BY created_at DESC
      `
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Get products error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching products",
    });
  }
};

const getSingleProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM products
      WHERE id = $1
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Get single product error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while fetching product",
    });
  }
};

const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, price, size, stockQuantity, status } = req.body;

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
        message: "Product not found",
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

    const result = await pool.query(
      `
      UPDATE products
      SET
        name = $1,
        description = $2,
        price = $3,
        size = $4,
        stock_quantity = $5,
        image_url = $6,
        image_public_id = $7,
        status = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
      `,
      [
        name || currentProduct.name,
        description ?? currentProduct.description,
        price ? Number(price) : Number(currentProduct.price),
        size ?? currentProduct.size,
        stockQuantity !== undefined
          ? Number(stockQuantity)
          : Number(currentProduct.stock_quantity),
        imageUrl,
        imagePublicId,
        status || currentProduct.status,
        id,
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update product error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while updating product",
    });
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
        message: "Product not found",
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
      message: "Product deleted successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Delete product error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Server error while deleting product",
    });
  }
};

module.exports = {
  createProduct,
  getProducts,
  getSingleProduct,
  updateProduct,
  deleteProduct,
};