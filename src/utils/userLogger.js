const { pool } = require('../config/db');

const recordUserLog = async ({ user, action, method, endpoint, statusCode, details }) => {
  try {
    await pool.query(
      `INSERT INTO user_logs (user_id, user_name, action, method, endpoint, status_code, details)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        user?.id || null,
        user?.user_name || null,
        action,
        method || null,
        endpoint || null,
        statusCode || null,
        details || null,
      ]
    );
  } catch (error) {
    // Logging must not prevent the requested business action from completing.
    console.error('User activity log error:', error.message);
  }
};

module.exports = { recordUserLog };
