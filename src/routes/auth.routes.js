const express = require('express');
const { register, login, verify, getUsers, updateUserRole, getUserLogs,changePassword,forgotPassword,resetPassword } = require('../controllers/auth.controller');
const { authenticate, authorizeRoles } = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/verify', authenticate, verify);
router.get('/users', authenticate, authorizeRoles('ADMIN'), getUsers);
router.patch('/users/:id/role', authenticate, authorizeRoles('ADMIN'), updateUserRole);
router.get('/logs', authenticate, authorizeRoles('ADMIN'), getUserLogs);
router.patch('/change-password', authenticate, changePassword);
router.post("/forgot-password", forgotPassword);

// Reset password
router.post("/reset-password", resetPassword);


module.exports = router;
