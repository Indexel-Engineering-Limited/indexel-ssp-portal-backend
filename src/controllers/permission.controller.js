const { pool } = require('../config/db');
const { getUserPermissions } = require('../middlewares/permission.middleware');

/**
 * GET /api/permissions
 * Get all available permissions/modules
 */
const getAllPermissions = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, module_key, module_name,section_name, icon, description FROM permissions ORDER BY id ASC'
    );

    return res.status(200).json({
      success: true,
      data: rows,
      message: 'Permissions fetched successfully'
    });

  } catch (error) {
    console.error('Get All Permissions Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


/**
 * GET /api/permissions/user/:userId
 * Get permissions for a specific user
 */
const getUserPermissionsList = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const [users] = await pool.query(
      'SELECT id, name, email_id, role FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // If ADMIN, return all permissions with full access
    if (user.role === 'ADMIN') {
      const [allPermissions] = await pool.query(
        'SELECT id, module_key, module_name, icon, description FROM permissions ORDER BY id ASC'
      );

      const adminPermissions = allPermissions.map(p => ({
        ...p,
        can_read: true,
        can_write: true,
        is_admin: true
      }));

      return res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
          },
          permissions: adminPermissions
        },
        message: 'User has admin access to all modules'
      });
    }

    // For non-admin users, fetch their specific permissions
    const permissions = await getUserPermissions(userId);

    return res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        permissions
      },
      message: 'User permissions fetched successfully'
    });

  } catch (error) {
    console.error('Get User Permissions Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


/**
 * GET /api/permissions/my-permissions
 * Get permissions for the currently authenticated user
 */
const getMyPermissions = async (req, res) => {
  try {
    const user = req.user;

    // If ADMIN, return all permissions
    if (user.role === 'ADMIN') {
      const [allPermissions] = await pool.query(
        'SELECT id, module_key, module_name, icon, description FROM permissions ORDER BY id ASC'
      );

      const adminPermissions = allPermissions.map(p => ({
        ...p,
        can_read: true,
        can_write: true
      }));

      return res.status(200).json({
        success: true,
        data: adminPermissions,
        message: 'Admin has access to all modules'
      });
    }

    // Get user's specific permissions
    const permissions = await getUserPermissions(user.id);

    return res.status(200).json({
      success: true,
      data: permissions,
      message: 'Your permissions fetched successfully'
    });

  } catch (error) {
    console.error('Get My Permissions Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


/**
 * POST /api/permissions/assign
 * Assign permissions to a user
 * Body: { userId, permissions: [{ permissionId, canRead, canWrite }] }
 */
const assignPermissions = async (req, res) => {
  try {
    const { userId, permissions } = req.body;

    if (!userId || !permissions || !Array.isArray(permissions)) {
      return res.status(400).json({
        success: false,
        message: 'userId and permissions array are required'
      });
    }

    // Check if user exists
    const [users] = await pool.query('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Don't allow modifying admin permissions
    if (users[0].role === 'ADMIN') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify permissions for ADMIN users. They have full access by default.'
      });
    }

    // Validate all permission IDs exist
    const permissionIds = permissions.map(p => p.permissionId);
    const [validPermissions] = await pool.query(
      'SELECT id FROM permissions WHERE id IN (?)',
      [permissionIds]
    );

    if (validPermissions.length !== permissionIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more invalid permission IDs'
      });
    }

    // Insert or update permissions
    const values = permissions.map(p => [
      userId,
      p.permissionId,
      p.canRead !== false, // default true
      p.canWrite === true  // default false
    ]);

    await pool.query(
      `INSERT INTO user_permissions (user_id, permission_id, can_read, can_write)
       VALUES ?
       ON DUPLICATE KEY UPDATE can_read = VALUES(can_read), can_write = VALUES(can_write)`,
      [values]
    );

    return res.status(200).json({
      success: true,
      message: 'Permissions assigned successfully'
    });

  } catch (error) {
    console.error('Assign Permissions Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


/**
 * DELETE /api/permissions/revoke
 * Revoke specific permissions from a user
 * Body: { userId, permissionIds: [1, 2, 3] }
 */
const revokePermissions = async (req, res) => {
  try {
    const { userId, permissionIds } = req.body;

    if (!userId || !permissionIds || !Array.isArray(permissionIds)) {
      return res.status(400).json({
        success: false,
        message: 'userId and permissionIds array are required'
      });
    }

    // Check if user exists
    const [users] = await pool.query('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (users[0].role === 'ADMIN') {
      return res.status(400).json({
        success: false,
        message: 'Cannot revoke permissions from ADMIN users'
      });
    }

    await pool.query(
      'DELETE FROM user_permissions WHERE user_id = ? AND permission_id IN (?)',
      [userId, permissionIds]
    );

    return res.status(200).json({
      success: true,
      message: 'Permissions revoked successfully'
    });

  } catch (error) {
    console.error('Revoke Permissions Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


/**
 * PUT /api/permissions/update
 * Update a single permission for a user
 * Body: { userId, permissionId, canRead, canWrite }
 */
const updatePermission = async (req, res) => {
  try {
    const { userId, permissionId, canRead, canWrite } = req.body;

    if (!userId || !permissionId) {
      return res.status(400).json({
        success: false,
        message: 'userId and permissionId are required'
      });
    }

    // Check if user exists and is not admin
    const [users] = await pool.query('SELECT id, role FROM users WHERE id = ?', [userId]);
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (users[0].role === 'ADMIN') {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify permissions for ADMIN users'
      });
    }

    // Update the permission
    await pool.query(
      `INSERT INTO user_permissions (user_id, permission_id, can_read, can_write)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE can_read = VALUES(can_read), can_write = VALUES(can_write)`,
      [userId, permissionId, canRead !== false, canWrite === true]
    );

    return res.status(200).json({
      success: true,
      message: 'Permission updated successfully'
    });

  } catch (error) {
    console.error('Update Permission Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


/**
 * GET /api/permissions/menu
 * Get accessible sidebar menu items for the current user
 * Returns only modules the user has access to (for frontend rendering)
 */
const getAccessibleMenu = async (req, res) => {
  try {
    const user = req.user;

    let menuItems = [];

    // If ADMIN, return all menu items
    if (user.role === 'ADMIN') {
      const [allPermissions] = await pool.query(
        'SELECT module_key, module_name, icon FROM permissions ORDER BY id ASC'
      );

      menuItems = allPermissions.map(p => ({
        key: p.module_key,
        name: p.module_name,
        icon: p.icon,
        canRead: true,
        canWrite: true
      }));

      return res.status(200).json({
        success: true,
        data: menuItems,
        message: 'Admin has access to all menu items'
      });
    }

    // For non-admin users, get their accessible modules
    const [userPermissions] = await pool.query(
      `SELECT 
        p.module_key,
        p.module_name,
        p.icon,
        up.can_read,
        up.can_write
      FROM permissions p
      INNER JOIN user_permissions up ON p.id = up.permission_id
      WHERE up.user_id = ? AND up.can_read = TRUE
      ORDER BY p.id ASC`,
      [user.id]
    );

    menuItems = userPermissions.map(p => ({
      key: p.module_key,
      name: p.module_name,
      icon: p.icon,
      canRead: p.can_read === 1,
      canWrite: p.can_write === 1
    }));

    return res.status(200).json({
      success: true,
      data: menuItems,
      message: 'Accessible menu items fetched successfully'
    });

  } catch (error) {
    console.error('Get Accessible Menu Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


module.exports = {
  getAllPermissions,
  getUserPermissionsList,
  getMyPermissions,
  getAccessibleMenu,
  assignPermissions,
  revokePermissions,
  updatePermission
};
