const express = require('express');

const router = express.Router();

const schemeController =
    require('../controllers/incentive/incentiveSchemeController');

const achievementController =
    require('../controllers/incentive/incentiveAchievementController');

const marginController =
    require('../controllers/incentive/incentiveMarginController');

const orderController =
    require('../controllers/incentive/incentiveOrderController');


// =========================
// SCHEME
// =========================

router.post(
    '/schemes',
    schemeController.createScheme
);

router.get(
    '/schemes',
    schemeController.getSchemes
);

router.get(
    '/schemes/:id',
    schemeController.getSchemeById
);

router.put(
    '/schemes/:id',
    schemeController.updateScheme
);


// =========================
// ACHIEVEMENT RULES
// =========================

router.post(
    '/schemes/:schemeId/achievement-rules',
    achievementController.createAchievementRule
);

router.get(
    '/schemes/:schemeId/achievement-rules',
    achievementController.getAchievementRules
);

router.put(
    '/achievement-rules/:id',
    achievementController.updateAchievementRule
);


// =========================
// MARGIN RULES
// =========================

router.post(
    '/schemes/:schemeId/margin-rules',
    marginController.createMarginRule
);

router.get(
    '/schemes/:schemeId/margin-rules',
    marginController.getMarginRules
);

router.put(
    '/margin-rules/:id',
    marginController.updateMarginRule
);


// =========================
// ORDERS
// =========================

router.post(
    '/orders',
    orderController.createOrder
);

router.get(
    '/orders',
    orderController.getOrders
);

router.get(
    '/orders/:id',
    orderController.getOrderById
);

router.get(
  '/employee-order/:salesperson_id',
  orderController.getOrdersBySalesperson
);

router.put(
    '/orders/:id',
    orderController.updateOrder
);


// Preview calculation
router.post(
    '/orders/calculate',
    orderController.calculateOrder
);

router.patch(
  "/orders/freeze",
  orderController.freezeOrders
);

const targetController =
    require('../controllers/incentive/incentiveTargetController');


// =========================
// EMPLOYEE TARGETS
// =========================

router.post(
    '/targets',
    targetController.createTarget
);

router.get(
    '/targets',
    targetController.getTargets
);
router.get(
    '/targets/employee/:employee_id',
    targetController.getTargetByEmployeeId
);

router.get(
    '/targets/:id',
    targetController.getTargetById
);

router.put(
    '/targets/:id',
    targetController.updateTarget
);

router.patch(
    '/targets/:id/status',
    targetController.updateTargetStatus
);


module.exports = router;