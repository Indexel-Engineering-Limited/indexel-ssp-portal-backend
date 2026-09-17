const { pool } = require('../config/db');

/**
 * Check if user has permission to access a module
 * @param {string} moduleKey - The module key (e.g., 'company_list', 'contacts')
 * @param {string} accessType - 'read' or 'write'
 */
const checkPermission = (moduleKey, accessType = 'read') => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      if (!user || !user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // ADMIN role has all permissions
      if (user.role === 'ADMIN') {
        return next();
      }

      // Check if permission exists
      const [permissions] = await pool.query(
        'SELECT id FROM permissions WHERE module_key = ?',
        [moduleKey]
      );

      if (permissions.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Invalid permission module'
        });
      }

      const permissionId = permissions[0].id;

      // Check user's permission
      const [userPerms] = await pool.query(
        'SELECT can_read, can_write FROM user_permissions WHERE user_id = ? AND permission_id = ?',
        [user.id, permissionId]
      );

      if (userPerms.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You do not have permission to access this module.'
        });
      }

      const permission = userPerms[0];

      // Check access type
      if (accessType === 'write' && !permission.can_write) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You only have read-only access to this module.'
        });
      }

      if (accessType === 'read' && !permission.can_read) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You do not have read access to this module.'
        });
      }

      // Permission granted
      next();

    } catch (error) {
      console.error('Permission Check Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Error checking permissions'
      });
    }
  };
};


/**
 * Get all permissions for a user (used internally)
 */
const getUserPermissions = async (userId) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        p.id,
        p.section_name,
        p.module_key,
        p.module_name,
        p.icon,
        p.description,
        up.can_read,
        up.can_write
      FROM permissions p
      INNER JOIN user_permissions up
        ON p.id = up.permission_id
      WHERE up.user_id = ?
      ORDER BY p.section_name ASC, p.id ASC`,
      [userId]
    );

    return rows;

  } catch (error) {
    console.error("Get User Permissions Error:", error);
    return [];
  }
};


module.exports = { checkPermission, getUserPermissions };
