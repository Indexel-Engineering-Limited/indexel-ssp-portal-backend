const { pool } = require('../config/db');

/**
 * Calculate what changed between old and new data
 */
const getChanges = (oldData, newData) => {
  const changes = {};
  
  for (const key in newData) {
    if (oldData[key] !== newData[key]) {
      changes[key] = {
        old: oldData[key],
        new: newData[key]
      };
    }
  }
  
  return Object.keys(changes).length > 0 ? changes : null;
};

/**
 * Log audit entry to database
 * @param {string} tableName - Table being modified
 * @param {number} recordId - ID of the record
 * @param {string} action - INSERT, UPDATE, or DELETE
 * @param {object} oldData - Previous data (for UPDATE/DELETE)
 * @param {object} newData - New data (for INSERT/UPDATE)
 * @param {object} req - Express request object (for user info)
 */
const logAudit = async (tableName, recordId, action, oldData = null, newData = null, req = null) => {
  try {
    const changes = action === 'UPDATE' ? getChanges(oldData, newData) : null;
    
    // Extract user info from request (assumes you have auth middleware)
    const userId = req?.user?.id || null;
    const userEmail = req?.user?.email || null;
    const ipAddress = req?.ip || req?.connection?.remoteAddress || null;
    const userAgent = req?.get('user-agent') || null;

    await pool.query(
      `INSERT INTO audit_logs 
       (table_name, record_id, action, user_id, user_email, old_data, new_data, changes, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tableName,
        recordId,
        action,
        userId,
        userEmail,
        oldData ? JSON.stringify(oldData) : null,
        newData ? JSON.stringify(newData) : null,
        changes ? JSON.stringify(changes) : null,
        ipAddress,
        userAgent
      ]
    );

    console.log(`✓ Audit logged: ${action} on ${tableName} #${recordId}`);
  } catch (error) {
    // Don't throw - audit logging should not break the main flow
    console.error('Audit log error:', error.message);
  }
};

module.exports = { logAudit };
