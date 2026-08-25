const express = require("express");
const {
  createProduct,
  getProducts,
  getAdminProducts,
  getSingleProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");

const { protectAdmin } = require("../middleware/authMiddleware");
const { uploadProductImage } = require("../middleware/uploadMiddleware");

const router = express.Router();

const PUBLIC_PRODUCT_CACHE_TTL_MS = Number(
  process.env.PUBLIC_PRODUCT_CACHE_TTL_MS || 30000
);
const publicProductCache = new Map();

function getCachedPayload(key) {
  const cached = publicProductCache.get(key);
  if (!cached) return null;

  if (Date.now() - cached.createdAt > PUBLIC_PRODUCT_CACHE_TTL_MS) {
    publicProductCache.delete(key);
    return null;
  }

  return cached.payload;
}

function clearPublicProductCache() {
  publicProductCache.clear();
}

function cachePublicProducts(req, res, next) {
  if (req.query.admin === "true") return next();

  const key = `list:${req.originalUrl}`;
  const cached = getCachedPayload(key);

  res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");

  if (cached) {
    res.set("X-Luma-Product-Cache", "HIT");
    return res.status(200).json(cached);
  }

  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    if (res.statusCode >= 200 && res.statusCode < 300 && payload?.success) {
      publicProductCache.set(key, { createdAt: Date.now(), payload });
      res.set("X-Luma-Product-Cache", "MISS");
    }
    return originalJson(payload);
  };

  return next();
}

function cacheSingleProduct(req, res, next) {
  const key = `single:${req.params.id}`;
  const cached = getCachedPayload(key);

  res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");

  if (cached) {
    res.set("X-Luma-Product-Cache", "HIT");
    return res.status(200).json(cached);
  }

  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    if (res.statusCode >= 200 && res.statusCode < 300 && payload?.success) {
      publicProductCache.set(key, { createdAt: Date.now(), payload });
      res.set("X-Luma-Product-Cache", "MISS");
    }
    return originalJson(payload);
  };

  return next();
}

function invalidateProductCacheAfterWrite(req, res, next) {
  res.on("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      clearPublicProductCache();
    }
  });
  next();
}

function protectAdminProductList(req, res, next) {
  if (req.query.admin === "true") {
    return protectAdmin(req, res, next);
  }

  return next();
}

router.get("/", protectAdminProductList, cachePublicProducts, getProducts);
router.get("/admin/all", protectAdmin, getAdminProducts);
router.get("/:id", cacheSingleProduct, getSingleProduct);

router.post(
  "/",
  protectAdmin,
  invalidateProductCacheAfterWrite,
  uploadProductImage.single("image"),
  createProduct
);

router.patch(
  "/:id",
  protectAdmin,
  invalidateProductCacheAfterWrite,
  uploadProductImage.single("image"),
  updateProduct
);

router.delete(
  "/:id",
  protectAdmin,
  invalidateProductCacheAfterWrite,
  deleteProduct
);

module.exports = router;
