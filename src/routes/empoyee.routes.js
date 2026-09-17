const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
    createEmployee,
    getEmployees,
    getEmployeeById,
    getEmployeeByEmployeeId,
    updateEmployee,
    deleteEmployee,
    uploadEmployeeOwnImage
} = require("../controllers/employee.controller");

const {
    authenticate,
    authorizeRoles
} = require("../middlewares/auth.middleware");

const {
    checkPermission
} = require("../middlewares/permission.middleware");

const router = express.Router();


// ─────────────────────────────────────────────────────────────
// EMPLOYEE IMAGE UPLOAD CONFIGURATION
// ─────────────────────────────────────────────────────────────

const employeeUploadDirectory = path.join(
    __dirname,
    "../../public/employees"
);

// Create directory if it doesn't exist
if (!fs.existsSync(employeeUploadDirectory)) {
    fs.mkdirSync(employeeUploadDirectory, {
        recursive: true
    });
}

const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, employeeUploadDirectory);
    },

    filename: (req, file, cb) => {

        const extension = path.extname(file.originalname);

        const uniqueName =
            `employee-${Date.now()}-${Math.round(Math.random() * 1E9)}${extension}`;

        cb(null, uniqueName);
    }

});

const fileFilter = (req, file, cb) => {

    const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp"
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new Error(
                "Only JPG, JPEG, PNG and WEBP images are allowed"
            ),
            false
        );
    }
};

const uploadEmployeeImage = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024
    }
});


// ─────────────────────────────────────────────────────────────
// EMPLOYEE ROUTES
// Module: employee_list
// ─────────────────────────────────────────────────────────────


// Create employee
// Requires employee_list WRITE permission
router.post(
    "/",
    authenticate,
    checkPermission("employee_list", "write"),
    uploadEmployeeImage.single("employee_image"),
    createEmployee
);


// Get all employees
// Requires employee_list READ permission
router.get(
    "/",
    // authenticate,
    // checkPermission("employee_list", "read"),
    getEmployees
);


// Get employee by employee ID
// IMPORTANT: keep this before /:id
router.get(
    "/employee-id/:employeeId",
    authenticate,
    checkPermission("employee_list", "read"),
    getEmployeeByEmployeeId
);


// Get employee by database ID
router.get(
    "/:id",
    authenticate,
    checkPermission("employee_list", "read"),
    getEmployeeById
);


// Update employee
// Requires employee_list WRITE permission
router.put(
    "/:id",
    authenticate,
    checkPermission("employee_list", "write"),
    uploadEmployeeImage.single("employee_image"),
    updateEmployee
);


// Delete employee
// Requires employee_list WRITE permission
router.delete(
    "/:id",
    authenticate,
    checkPermission("employee_list", "write"),
    deleteEmployee
);

router.put(
    "/employee-image/:employeeId",
    uploadEmployeeImage.single("employee_image"),
    uploadEmployeeOwnImage
);


module.exports = router;