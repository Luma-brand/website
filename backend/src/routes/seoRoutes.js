const express = require("express");
const {
  getProductFeedXmlHandler,
  getRobotsTxtHandler,
  getSitemapXmlHandler,
} = require("../controllers/seoController");

const router = express.Router();

router.get("/sitemap.xml", getSitemapXmlHandler);
router.get("/product-feed.xml", getProductFeedXmlHandler);
router.get("/robots.txt", getRobotsTxtHandler);

module.exports = router;
