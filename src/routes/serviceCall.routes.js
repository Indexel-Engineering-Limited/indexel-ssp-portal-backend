const express = require('express');
const router = express.Router();
const {
    getServiceCalls,
    getServiceCallById,
    createServiceCall,
    updateServiceCall,
    deleteServiceCall,
} = require('../controllers/serviceCall.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');

// Service call report routes - require 'service_calls' permission
router.get('/', authenticate, checkPermission('service_calls', 'read'), getServiceCalls);
router.get('/:id', authenticate, checkPermission('service_calls', 'read'), getServiceCallById);
router.post('/', authenticate, checkPermission('service_calls', 'write'), createServiceCall);
router.put('/:id', authenticate, checkPermission('service_calls', 'write'), updateServiceCall);
router.delete('/:id', authenticate, checkPermission('service_calls', 'write'), deleteServiceCall);

module.exports = router;
