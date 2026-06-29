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

function protectAdminProductList(req, res, next) {
  if (req.query.admin === "true") {
    return protectAdmin(req, res, next);
  }

  return next();
}

router.get("/", protectAdminProductList, getProducts);
router.get("/admin/all", protectAdmin, getAdminProducts);
router.get("/:id", getSingleProduct);

router.post(
  "/",
  protectAdmin,
  uploadProductImage.single("image"),
  createProduct
);

router.patch(
  "/:id",
  protectAdmin,
  uploadProductImage.single("image"),
  updateProduct
);

router.delete("/:id", protectAdmin, deleteProduct);

module.exports = router;
