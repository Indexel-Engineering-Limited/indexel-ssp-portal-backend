const express = require('express');
const router = express.Router();
const { getAuditLogs, getAuditLogById, getRecordHistory } = require('../controllers/audit.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');

// All audit log routes require 'user_logs' permission (read access)
router.get('/', authenticate, checkPermission('user_logs', 'read'), getAuditLogs);
router.get('/:id', authenticate, checkPermission('user_logs', 'read'), getAuditLogById);
router.get('/history/:table/:id', authenticate, checkPermission('user_logs', 'read'), getRecordHistory);

module.exports = router;
