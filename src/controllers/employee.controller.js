const { pool } = require("../config/db");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

// ─────────────────────────────────────────────────────────────
// CREATE EMPLOYEE
// ─────────────────────────────────────────────────────────────

const createEmployee = async (req, res) => {
    let employeeDbId = null;
    let employeeImagePath = null;
    let qrFilePath = null;

    try {
        const {
            employee_id,
            name,
            email,
            contact_number,
            department,
            designation,
            location,
            blood_group,
            gender,
            joining_date
        } = req.body;

        // ─────────────────────────────────────────────────────
        // VALIDATION
        // ─────────────────────────────────────────────────────

        if (!employee_id || !name) {
            return res.status(400).json({
                success: false,
                message: "Employee ID and name are required"
            });
        }

        // ─────────────────────────────────────────────────────
        // CHECK DUPLICATE EMPLOYEE ID
        // ─────────────────────────────────────────────────────

        const [existing] = await pool.query(
            "SELECT id FROM employees WHERE employee_id = ?",
            [employee_id]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Employee ID already exists"
            });
        }

        // ─────────────────────────────────────────────────────
        // EMPLOYEE IMAGE
        // ─────────────────────────────────────────────────────

        let employeeImage = null;

        if (req.file) {
            employeeImage = `/employees/${req.file.filename}`;

            employeeImagePath = path.join(
                __dirname,
                "../../public/employees",
                req.file.filename
            );
        }

        // ─────────────────────────────────────────────────────
        // INSERT EMPLOYEE
        // ─────────────────────────────────────────────────────

        const [result] = await pool.query(
            `INSERT INTO employees
            (
                employee_id,
                name,
                email,
                contact_number,
                department,
                designation,
                location,
                blood_group,
                gender,
                joining_date,
                employee_image
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                employee_id,
                name,
                email || null,
                contact_number || null,
                department || null,
                designation || null,
                location || null,
                blood_group || null,
                gender || null,
                joining_date || null,
                employeeImage
            ]
        );

        employeeDbId = result.insertId;

        console.log("Employee created:", employeeDbId);

        // ─────────────────────────────────────────────────────
        // QR URL
        // ─────────────────────────────────────────────────────

        const frontendUrl = process.env.FRONTEND_URL;

        if (!frontendUrl) {
            throw new Error(
                "FRONTEND_URL is not configured in .env"
            );
        }

        const qrUrl =
            `${frontendUrl}/employee/${employee_id}`;

        console.log("QR URL:", qrUrl);

        // ─────────────────────────────────────────────────────
        // QR DIRECTORY
        // ─────────────────────────────────────────────────────

        const qrDirectory = path.join(
            __dirname,
            "../../public/qr-codes"
        );

        console.log("QR directory:", qrDirectory);

        if (!fs.existsSync(qrDirectory)) {
            fs.mkdirSync(qrDirectory, {
                recursive: true
            });

            console.log(
                "Created QR directory:",
                qrDirectory
            );
        }

        // ─────────────────────────────────────────────────────
        // QR FILE
        // ─────────────────────────────────────────────────────

        const qrFileName = `${employee_id}.png`;

        qrFilePath = path.join(
            qrDirectory,
            qrFileName
        );

        console.log("QR file path:", qrFilePath);

        // ─────────────────────────────────────────────────────
        // GENERATE QR
        // ─────────────────────────────────────────────────────

        await QRCode.toFile(
            qrFilePath,
            qrUrl,
            {
                type: "png",
                width: 500,
                margin: 2,
                errorCorrectionLevel: "H"
            }
        );

        console.log(
            "QR generated successfully:",
            qrFilePath
        );

        // ─────────────────────────────────────────────────────
        // CHECK QR FILE
        // ─────────────────────────────────────────────────────

        if (!fs.existsSync(qrFilePath)) {
            throw new Error(
                "QR file was not created"
            );
        }

        // ─────────────────────────────────────────────────────
        // QR IMAGE DATABASE PATH
        // ─────────────────────────────────────────────────────

        const qrImage =
            `/qr-codes/${qrFileName}`;

        // ─────────────────────────────────────────────────────
        // UPDATE EMPLOYEE
        // ─────────────────────────────────────────────────────

        await pool.query(
            `UPDATE employees
             SET qr_image = ?
             WHERE id = ?`,
            [
                qrImage,
                employeeDbId
            ]
        );

        console.log(
            "Employee QR path saved:",
            qrImage
        );

        // ─────────────────────────────────────────────────────
        // RESPONSE
        // ─────────────────────────────────────────────────────

        return res.status(201).json({
            success: true,
            message: "Employee created successfully",

            data: {
                id: employeeDbId,

                employee_id,

                name,

                email:
                    email || null,

                contact_number:
                    contact_number || null,

                department:
                    department || null,

                designation:
                    designation || null,

                location:
                    location || null,

                blood_group:
                    blood_group || null,

                gender:
                    gender || null,

                joining_date:
                    joining_date || null,

                employee_image:
                    employeeImage,

                qr_image:
                    qrImage,

                qr_url:
                    qrUrl
            }
        });

    } catch (error) {

        console.error(
            "Create Employee Error:",
            error
        );

        // ─────────────────────────────────────────────────────
        // CLEANUP
        // ─────────────────────────────────────────────────────

        try {

            // Delete database employee if QR failed
            if (employeeDbId) {

                await pool.query(
                    "DELETE FROM employees WHERE id = ?",
                    [employeeDbId]
                );

                console.log(
                    "Employee database record rolled back"
                );
            }

            // Delete uploaded employee image
            if (
                employeeImagePath &&
                fs.existsSync(employeeImagePath)
            ) {

                fs.unlinkSync(
                    employeeImagePath
                );

                console.log(
                    "Employee image deleted"
                );
            }

            // Delete QR if partially created
            if (
                qrFilePath &&
                fs.existsSync(qrFilePath)
            ) {

                fs.unlinkSync(
                    qrFilePath
                );

                console.log(
                    "QR image deleted"
                );
            }

        } catch (cleanupError) {

            console.error(
                "Cleanup Error:",
                cleanupError
            );
        }

        return res.status(500).json({
            success: false,
            message: "Failed to create employee",
            error: error.message
        });
    }
};

// ─────────────────────────────────────────────────────────────
// GET ALL EMPLOYEES
// ─────────────────────────────────────────────────────────────

const getEmployees = async (req, res) => {
    try {
        const [employees] = await pool.query(
            `SELECT
                id,
                employee_id,
                name,
                email,
                contact_number,
                department,
                designation,
                location,
                blood_group,
                employee_image,
                qr_image,
                status,
                created_at,
                updated_at
             FROM employees
             ORDER BY id DESC`
        );

        return res.status(200).json({
            success: true,
            data: employees
        });

    } catch (error) {
        console.error("Get Employees Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch employees",
            error: error.message
        });
    }
};


// ─────────────────────────────────────────────────────────────
// GET SINGLE EMPLOYEE
// ─────────────────────────────────────────────────────────────

const getEmployeeById = async (req, res) => {
    try {
        const { id } = req.params;

        const [employees] = await pool.query(
            `SELECT
                id,
                employee_id,
                name,
                email,
                contact_number,
                department,
                designation,
                location,
                blood_group,
                employee_image,
                qr_image,
                gender,
                joining_date,
                status,
                created_at,
                updated_at
             FROM employees
             WHERE id = ?`,
            [id]
        );

        if (employees.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: employees[0]
        });

    } catch (error) {
        console.error("Get Employee Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch employee",
            error: error.message
        });
    }
};


// ─────────────────────────────────────────────────────────────
// GET EMPLOYEE BY EMPLOYEE ID
// Used by QR scan
// ─────────────────────────────────────────────────────────────

const getEmployeeByEmployeeId = async (req, res) => {
    try {
        const { employeeId } = req.params;

        const [employees] = await pool.query(
            `SELECT
                id,
                employee_id,
                name,
                email,
                contact_number,
                department,
                designation,
                location,
                blood_group,
                employee_image,
                qr_image,
                status,
                created_at
             FROM employees
             WHERE employee_id = ?`,
            [employeeId]
        );

        if (employees.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: employees[0]
        });

    } catch (error) {
        console.error("Get Employee By Employee ID Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch employee",
            error: error.message
        });
    }
};

// ─────────────────────────────────────────────────────────────
// UPDATE EMPLOYEE
// ─────────────────────────────────────────────────────────────

const updateEmployee = async (req, res) => {
    let newEmployeeImagePath = null;
    let newQrFilePath = null;

    try {
        const { id } = req.params;

        const {
            employee_id,
            name,
            email,
            contact_number,
            department,
            designation,
            location,
            blood_group,
            status
        } = req.body;

        // ─────────────────────────────────────────────────────
        // VALIDATION
        // ─────────────────────────────────────────────────────

        if (!employee_id || !name) {
            return res.status(400).json({
                success: false,
                message: "Employee ID and name are required"
            });
        }

        // ─────────────────────────────────────────────────────
        // GET EXISTING EMPLOYEE
        // ─────────────────────────────────────────────────────

        const [employees] = await pool.query(
            `SELECT *
             FROM employees
             WHERE id = ?`,
            [id]
        );

        if (employees.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        const existingEmployee = employees[0];

        // ─────────────────────────────────────────────────────
        // CHECK DUPLICATE EMPLOYEE ID
        // ─────────────────────────────────────────────────────

        const [duplicate] = await pool.query(
            `SELECT id
             FROM employees
             WHERE employee_id = ?
             AND id != ?`,
            [employee_id, id]
        );

        if (duplicate.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Employee ID already exists"
            });
        }

        // ─────────────────────────────────────────────────────
        // EMPLOYEE IMAGE
        // ─────────────────────────────────────────────────────

        let employeeImage = existingEmployee.employee_image;

        if (req.file) {

            employeeImage = `/employees/${req.file.filename}`;

            newEmployeeImagePath = path.join(
                __dirname,
                "../../public/employees",
                req.file.filename
            );
        }

        // ─────────────────────────────────────────────────────
        // QR CODE
        // ─────────────────────────────────────────────────────

        const frontendUrl = process.env.FRONTEND_URL;

        if (!frontendUrl) {
            throw new Error(
                "FRONTEND_URL is not configured in .env"
            );
        }

        const qrUrl =
            `${frontendUrl}/employee/${employee_id}`;

        const qrDirectory = path.join(
            __dirname,
            "../../public/qr-codes"
        );

        if (!fs.existsSync(qrDirectory)) {
            fs.mkdirSync(qrDirectory, {
                recursive: true
            });
        }

        const qrFileName = `${employee_id}.png`;

        newQrFilePath = path.join(
            qrDirectory,
            qrFileName
        );

        await QRCode.toFile(
            newQrFilePath,
            qrUrl,
            {
                type: "png",
                width: 500,
                margin: 2,
                errorCorrectionLevel: "H"
            }
        );

        const qrImage =
            `/qr-codes/${qrFileName}`;

        // ─────────────────────────────────────────────────────
        // UPDATE DATABASE
        // ─────────────────────────────────────────────────────

        await pool.query(
            `UPDATE employees
             SET
                employee_id = ?,
                name = ?,
                email = ?,
                contact_number = ?,
                department = ?,
                designation = ?,
                location = ?,
                blood_group = ?,
                employee_image = ?,
                qr_image = ?,
                status = ?
             WHERE id = ?`,
            [
                employee_id,
                name,
                email || null,
                contact_number || null,
                department || null,
                designation || null,
                location || null,
                blood_group || null,
                employeeImage,
                qrImage,
                status || existingEmployee.status || "active",
                id
            ]
        );

        // ─────────────────────────────────────────────────────
        // DELETE OLD EMPLOYEE IMAGE
        // Only when a new image was uploaded
        // ─────────────────────────────────────────────────────

        if (
            req.file &&
            existingEmployee.employee_image
        ) {

            const oldImagePath = path.join(
                __dirname,
                "../../public",
                existingEmployee.employee_image
            );

            if (fs.existsSync(oldImagePath)) {
                fs.unlinkSync(oldImagePath);

                console.log(
                    "Old employee image deleted:",
                    oldImagePath
                );
            }
        }

        // ─────────────────────────────────────────────────────
        // DELETE OLD QR
        // ─────────────────────────────────────────────────────

        if (existingEmployee.qr_image) {

            const oldQrPath = path.join(
                __dirname,
                "../../public",
                existingEmployee.qr_image
            );

            // Don't delete the new QR if employee_id
            // has not changed
            if (
                oldQrPath !== newQrFilePath &&
                fs.existsSync(oldQrPath)
            ) {
                fs.unlinkSync(oldQrPath);

                console.log(
                    "Old QR image deleted:",
                    oldQrPath
                );
            }
        }

        // ─────────────────────────────────────────────────────
        // RESPONSE
        // ─────────────────────────────────────────────────────

        return res.status(200).json({
            success: true,
            message: "Employee updated successfully",

            data: {
                id,
                employee_id,
                name,
                email: email || null,
                contact_number: contact_number || null,
                department: department || null,
                designation: designation || null,
                location: location || null,
                blood_group: blood_group || null,
                employee_image: employeeImage,
                qr_image: qrImage,
                qr_url: qrUrl,
                status:
                    status ||
                    existingEmployee.status ||
                    "active"
            }
        });

    } catch (error) {

        console.error(
            "Update Employee Error:",
            error
        );

        // ─────────────────────────────────────────────────────
        // CLEANUP NEW FILES IF UPDATE FAILED
        // ─────────────────────────────────────────────────────

        try {

            if (
                newEmployeeImagePath &&
                fs.existsSync(newEmployeeImagePath)
            ) {
                fs.unlinkSync(newEmployeeImagePath);
            }

            if (
                newQrFilePath &&
                fs.existsSync(newQrFilePath)
            ) {
                fs.unlinkSync(newQrFilePath);
            }

        } catch (cleanupError) {

            console.error(
                "Update Cleanup Error:",
                cleanupError
            );
        }

        return res.status(500).json({
            success: false,
            message: "Failed to update employee",
            error: error.message
        });
    }
};

// ─────────────────────────────────────────────────────────────
// DELETE EMPLOYEE
// ─────────────────────────────────────────────────────────────

const deleteEmployee = async (req, res) => {

    try {

        const { id } = req.params;

        // ─────────────────────────────────────────────────────
        // GET EMPLOYEE
        // ─────────────────────────────────────────────────────

        const [employees] = await pool.query(
            `SELECT
                id,
                employee_id,
                employee_image,
                qr_image
             FROM employees
             WHERE id = ?`,
            [id]
        );

        if (employees.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        const employee = employees[0];

        // ─────────────────────────────────────────────────────
        // DELETE DATABASE RECORD
        // ─────────────────────────────────────────────────────

        await pool.query(
            `DELETE FROM employees
             WHERE id = ?`,
            [id]
        );

        // ─────────────────────────────────────────────────────
        // DELETE EMPLOYEE IMAGE
        // ─────────────────────────────────────────────────────

        if (employee.employee_image) {

            const employeeImagePath = path.join(
                __dirname,
                "../../public",
                employee.employee_image
            );

            if (fs.existsSync(employeeImagePath)) {

                fs.unlinkSync(employeeImagePath);

                console.log(
                    "Employee image deleted:",
                    employeeImagePath
                );
            }
        }

        // ─────────────────────────────────────────────────────
        // DELETE QR IMAGE
        // ─────────────────────────────────────────────────────

        if (employee.qr_image) {

            const qrImagePath = path.join(
                __dirname,
                "../../public",
                employee.qr_image
            );

            if (fs.existsSync(qrImagePath)) {

                fs.unlinkSync(qrImagePath);

                console.log(
                    "Employee QR deleted:",
                    qrImagePath
                );
            }
        }

        // ─────────────────────────────────────────────────────
        // RESPONSE
        // ─────────────────────────────────────────────────────

        return res.status(200).json({
            success: true,
            message: "Employee deleted successfully",
            data: {
                id: employee.id,
                employee_id: employee.employee_id
            }
        });

    } catch (error) {

        console.error(
            "Delete Employee Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to delete employee",
            error: error.message
        });
    }
};


// ─────────────────────────────────────────────────────────────
// EMPLOYEE SELF IMAGE UPLOAD
// Employee can update ONLY their profile image
// ─────────────────────────────────────────────────────────────

const uploadEmployeeOwnImage = async (req, res) => {
    let newImagePath = null;

    try {
        const { employeeId } = req.params;

        // ─────────────────────────────────────────────────────
        // VALIDATION
        // ─────────────────────────────────────────────────────

        if (!employeeId) {
            return res.status(400).json({
                success: false,
                message: "Employee ID is required"
            });
        }

        // ─────────────────────────────────────────────────────
        // IMAGE REQUIRED
        // ─────────────────────────────────────────────────────

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Employee image is required"
            });
        }

        // ─────────────────────────────────────────────────────
        // GET EMPLOYEE
        // ─────────────────────────────────────────────────────

        const [employees] = await pool.query(
            `SELECT
                id,
                employee_id,
                employee_image
             FROM employees
             WHERE employee_id = ?`,
            [employeeId]
        );

        if (employees.length === 0) {
            // Delete uploaded image because employee doesn't exist
            const uploadedPath = path.join(
                __dirname,
                "../../public/employees",
                req.file.filename
            );

            if (fs.existsSync(uploadedPath)) {
                fs.unlinkSync(uploadedPath);
            }

            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        const employee = employees[0];

        // ─────────────────────────────────────────────────────
        // NEW IMAGE
        // ─────────────────────────────────────────────────────

        const newImage = `/employees/${req.file.filename}`;

        newImagePath = path.join(
            __dirname,
            "../../public/employees",
            req.file.filename
        );

        // ─────────────────────────────────────────────────────
        // UPDATE ONLY IMAGE
        // ─────────────────────────────────────────────────────

        await pool.query(
            `UPDATE employees
             SET employee_image = ?
             WHERE employee_id = ?`,
            [
                newImage,
                employeeId
            ]
        );

        // ─────────────────────────────────────────────────────
        // DELETE OLD IMAGE
        // ─────────────────────────────────────────────────────

        if (employee.employee_image) {
            const oldImagePath = path.join(
                __dirname,
                "../../public",
                employee.employee_image
            );

            if (
                fs.existsSync(oldImagePath) &&
                oldImagePath !== newImagePath
            ) {
                fs.unlinkSync(oldImagePath);

                console.log(
                    "Old employee image deleted:",
                    oldImagePath
                );
            }
        }

        // ─────────────────────────────────────────────────────
        // RESPONSE
        // ─────────────────────────────────────────────────────

        return res.status(200).json({
            success: true,
            message: "Employee image updated successfully",
            data: {
                employee_id: employee.employee_id,
                employee_image: newImage
            }
        });

    } catch (error) {
        console.error(
            "Upload Employee Own Image Error:",
            error
        );

        // Cleanup newly uploaded image if database update failed
        try {
            if (
                newImagePath &&
                fs.existsSync(newImagePath)
            ) {
                fs.unlinkSync(newImagePath);
            }
        } catch (cleanupError) {
            console.error(
                "Image cleanup error:",
                cleanupError
            );
        }

        return res.status(500).json({
            success: false,
            message: "Failed to update employee image",
            error: error.message
        });
    }
};

module.exports = {
    createEmployee,
    getEmployees,
    getEmployeeById,
    getEmployeeByEmployeeId,
    updateEmployee,
    deleteEmployee,
    uploadEmployeeOwnImage,
};