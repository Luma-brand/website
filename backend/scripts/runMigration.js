const fs = require("fs");
const path = require("path");
const pool = require("../src/config/db");

async function main() {
  const migrationName = process.argv[2];
  if (!migrationName || !/^[a-zA-Z0-9_.-]+\.sql$/.test(migrationName)) {
    throw new Error("Pass a migration filename, for example 036_automated_delivery_currency_engine.sql");
  }

  const migrationPath = path.join(__dirname, "../src/sql/migrations", migrationName);
  const sql = fs.readFileSync(migrationPath, "utf8");
  await pool.query(sql);
  console.log(`Migration applied: ${migrationName}`);
}

main()
  .catch((error) => {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
