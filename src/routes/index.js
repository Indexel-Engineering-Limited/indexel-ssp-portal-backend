const express = require('express');
const router = express.Router();

const companyRoutes = require('./company.routes');
const authRoutes = require('./auth.routes');
const auditRoutes = require('./audit.routes');
const permissionRoutes = require('./permission.routes');
const employeeRoutes = require("./empoyee.routes");
const  incentiveRoutes = require("./incentive.routes")



router.use('/auth', authRoutes);
router.use('/companies', companyRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/permissions', permissionRoutes);
router.use("/employees", employeeRoutes);
router.use("/incentives", incentiveRoutes);

module.exports = router;
