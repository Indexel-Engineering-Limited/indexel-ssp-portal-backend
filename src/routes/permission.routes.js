const express = require('express');
const router = express.Router();
const {
  getAllPermissions,
  getUserPermissionsList,
  getMyPermissions,
  getAccessibleMenu,
  assignPermissions,
  revokePermissions,
  updatePermission
} = require('../controllers/permission.controller');
const { authenticate, authorizeRoles } = require('../middlewares/auth.middleware');

// Get all available permissions/modules (Admin only)
router.get('/', authenticate, authorizeRoles('ADMIN'), getAllPermissions);

// Get current user's accessible sidebar menu items (Any authenticated user)
router.get('/menu', authenticate, getAccessibleMenu);

// Get current user's permissions (Any authenticated user)
router.get('/my-permissions', authenticate, getMyPermissions);

// Get specific user's permissions (Admin only)
router.get('/user/:userId', authenticate, authorizeRoles('ADMIN'), getUserPermissionsList);

// Assign permissions to a user (Admin only)
router.post('/assign', authenticate, authorizeRoles('ADMIN'), assignPermissions);

// Update a single permission (Admin only)
router.put('/update', authenticate, authorizeRoles('ADMIN'), updatePermission);

// Revoke permissions from a user (Admin only)
router.delete('/revoke', authenticate, authorizeRoles('ADMIN'), revokePermissions);

module.exports = router;
