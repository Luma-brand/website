const fs = require("fs");
const path = require("path");
const pool = require("./db");

const initDb = async () => {
  try {
    const schemaPath = path.join(__dirname, "../sql/schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    await pool.query(schema);

    console.log("Database tables created successfully");
  } catch (error) {
    console.error("Database initialization failed:", error.message);
    process.exit(1);
  }
};

initDb();