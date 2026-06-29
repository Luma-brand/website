const {
  buildGoogleMerchantFeedXml,
  buildRobotsTxt,
  buildSitemapXml,
} = require("../services/seoService");

async function getSitemapXmlHandler(req, res) {
  try {
    const xml = await buildSitemapXml();

    res.type("application/xml");
    return res.status(200).send(xml);
  } catch (error) {
    console.error("Build sitemap error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to build sitemap.",
    });
  }
}

async function getProductFeedXmlHandler(req, res) {
  try {
    const xml = await buildGoogleMerchantFeedXml();

    res.type("application/xml");
    return res.status(200).send(xml);
  } catch (error) {
    console.error("Build product feed error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to build product feed.",
    });
  }
}

async function getRobotsTxtHandler(req, res) {
  try {
    const robots = buildRobotsTxt();

    res.type("text/plain");
    return res.status(200).send(robots);
  } catch (error) {
    console.error("Build robots.txt error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to build robots.txt.",
    });
  }
}

module.exports = {
  getProductFeedXmlHandler,
  getRobotsTxtHandler,
  getSitemapXmlHandler,
};
