const mysql = require('mysql2');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Return date/datetime columns as strings, not Date objects.
  // This prevents timezone conversions by the driver.
  dateStrings: true
};

const pool = mysql.createPool(dbConfig);

// Export the promise-based pool for async/await
module.exports = pool.promise();