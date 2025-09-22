const mysql = require('mysql2');
require('dotenv').config();

const dbUrl = new URL(process.env.DATABASE_URL);

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
};

const pool = mysql.createPool(dbConfig);
// Export the promise-based pool for async/await
module.exports = pool.promise();
