require("dotenv").config();

const app = require("./src/app");
const pool = require("./src/config/db");
const {
  startAbandonedCartRecoveryWorker,
} = require("./src/services/growthService");
const { startAutomationWorker } = require("./src/services/automationService");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await pool.query("SELECT NOW()");
    console.log("Database startup check successful");
  } catch (error) {
    console.error(
      "Database startup check failed:",
      pool.describeError ? pool.describeError(error) : error.message
    );
  }

  app.listen(PORT, () => {
    console.log(`LUMA backend running on port ${PORT}`);
    startAbandonedCartRecoveryWorker();
    startAutomationWorker();
  });
};

startServer();

