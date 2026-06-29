const {
  getCurrencyRates,
  getFlutterwaveConfigStatus,
  updateCurrencyRate,
} = require("../services/currencyService");

async function getPublicCurrencyRatesHandler(req, res) {
  try {
    const rates = await getCurrencyRates({ includeInactive: false });
    return res.status(200).json({
      success: true,
      message: "Currency rates loaded.",
      data: {
        baseCurrency: "NGN",
        rateDirection: "rateToBase/rateToNgn means 1 selected currency equals this many NGN.",
        rates,
        flutterwave: getFlutterwaveConfigStatus(),
      },
    });
  } catch (error) {
    console.error("Get currency rates error:", error);
    return res.status(500).json({ success: false, message: "Failed to load currency rates. Run migration 021_fix_currency_rates_schema.sql if this continues.", details: error.message });
  }
}

async function getAdminCurrencyRatesHandler(req, res) {
  try {
    const rates = await getCurrencyRates({ includeInactive: true });
    return res.status(200).json({
      success: true,
      message: "Admin currency rates loaded.",
      data: {
        baseCurrency: "NGN",
        rateDirection: "Example: USD rate 1500 means 1 USD = NGN 1500.",
        rates,
        flutterwave: getFlutterwaveConfigStatus(),
      },
    });
  } catch (error) {
    console.error("Get admin currency rates error:", error);
    return res.status(500).json({ success: false, message: "Failed to load admin currency rates. Run migration 021_fix_currency_rates_schema.sql if this continues.", details: error.message });
  }
}

async function updateCurrencyRateHandler(req, res) {
  try {
    const rate = await updateCurrencyRate(req.params.code, req.body || {}, req.admin?.id || null);
    return res.status(200).json({ success: true, message: "Currency rate updated.", data: rate });
  } catch (error) {
    console.error("Update currency rate error:", error);
    return res.status(400).json({ success: false, message: error.message || "Failed to update currency rate." });
  }
}

module.exports = {
  getAdminCurrencyRatesHandler,
  getPublicCurrencyRatesHandler,
  updateCurrencyRateHandler,
};
