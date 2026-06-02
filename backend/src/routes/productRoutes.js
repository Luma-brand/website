const express = require("express");
const {
  createProduct,
  getProducts,
  getSingleProduct,
  updateProduct,
  deleteProduct,
} = require("../controllers/productController");

const { protectAdmin } = require("../middleware/authMiddleware");
const { uploadProductImage } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.get("/", getProducts);
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