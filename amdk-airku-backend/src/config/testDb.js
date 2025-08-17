const pool = require('./db');

async function testConnection() {
  try {
    const [rows] = await pool.query("SELECT NOW() AS now");
    console.log("✅ Database connected! Current time:", rows[0].now);
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
  }
}

testConnection();
