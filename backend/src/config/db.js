const { Pool } = require("pg");
require("dotenv").config();

const databaseUrl = process.env.DATABASE_URL;
const isLocalDatabase = /localhost|127\.0\.0\.1/i.test(databaseUrl || "");
const sslDisabled = process.env.PGSSL === "false" || process.env.DATABASE_SSL === "false";

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: sslDisabled || isLocalDatabase ? false : { rejectUnauthorized: false },
  max: toPositiveInt(process.env.PG_POOL_MAX, 8),
  idleTimeoutMillis: toPositiveInt(process.env.PG_IDLE_TIMEOUT_MS, 30000),
  connectionTimeoutMillis: toPositiveInt(process.env.PG_CONNECTION_TIMEOUT_MS, 10000),
  statement_timeout: toPositiveInt(process.env.PG_STATEMENT_TIMEOUT_MS, 20000),
  query_timeout: toPositiveInt(process.env.PG_QUERY_TIMEOUT_MS, 25000),
  keepAlive: true,
});

function describeDatabaseError(error) {
  const message = error?.message || "Unknown database error";
  const isNetworkError = /ECONNRESET|ENOTFOUND|ETIMEDOUT|Connection terminated/i.test(message);

  return {
    message,
    code: error?.code,
    severity: error?.severity,
    detail: error?.detail,
    hint: isNetworkError
      ? "Database host/network is unreachable or the Neon pooler reset the connection. The request should fail clearly and retry later."
      : error?.hint,
  };
}

pool.on("error", (error) => {
  console.error("PostgreSQL pool error:", describeDatabaseError(error));
});

pool.describeError = describeDatabaseError;

module.exports = pool;