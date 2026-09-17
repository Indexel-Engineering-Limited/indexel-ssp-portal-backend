const express = require('express');
const router = express.Router();

const companyRoutes = require('./company.routes');
const authRoutes = require('./auth.routes');
const auditRoutes = require('./audit.routes');
const permissionRoutes = require('./permission.routes');
const employeeRoutes = require("./empoyee.routes");



router.use('/auth', authRoutes);
router.use('/companies', companyRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/permissions', permissionRoutes);
router.use("/employees", employeeRoutes);

module.exports = router;
