const { pool } = require('../../config/db');
const { logAudit } = require('../../utils/auditLogger');


// CREATE / SET EMPLOYEE TARGET
exports.createTarget = async (req, res) => {
    try {
        const {
            scheme_id,
            employee_id,
            financial_year,
            target_amount
        } = req.body;

        if (
            !scheme_id ||
            !employee_id ||
            !financial_year ||
            target_amount === undefined
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'scheme_id, employee_id, financial_year and target_amount are required'
            });
        }

        const targetAmount = Number(target_amount);

        if (Number.isNaN(targetAmount) || targetAmount < 0) {
            return res.status(400).json({
                success: false,
                message: 'target_amount must be a valid positive number'
            });
        }

        // Check scheme
        const [schemeRows] = await pool.query(
            `SELECT id, scheme_name, scheme_code, financial_year, status
             FROM incentive_schemes
             WHERE id = ?
             LIMIT 1`,
            [scheme_id]
        );

        if (!schemeRows.length) {
            return res.status(404).json({
                success: false,
                message: 'Incentive scheme not found'
            });
        }

        // Check duplicate target
        const [existingRows] = await pool.query(
            `SELECT id
             FROM incentive_targets
             WHERE scheme_id = ?
               AND employee_id = ?
               AND financial_year = ?
             LIMIT 1`,
            [
                scheme_id,
                employee_id,
                financial_year
            ]
        );

        if (existingRows.length) {
            return res.status(409).json({
                success: false,
                message:
                    'Target already exists for this employee, scheme and financial year'
            });
        }

        const [result] = await pool.query(
            `INSERT INTO incentive_targets
            (
                scheme_id,
                employee_id,
                financial_year,
                target_amount,
                status
               
            )
            VALUES (?, ?, ?, ?, 1)`,
            [
                scheme_id,
                employee_id,
                financial_year,
                targetAmount
            ]
        );

        await logAudit({
            userId: req.user?.id,
            action: 'CREATE',
            module: 'INCENTIVE_TARGET',
            recordId: result.insertId,
            details: {
                scheme_id,
                employee_id,
                financial_year,
                target_amount: targetAmount
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Employee target created successfully',
            data: {
                id: result.insertId,
                scheme_id,
                employee_id,
                financial_year,
                target_amount: targetAmount
            }
        });

    } catch (error) {
        console.error('createTarget error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create employee target',
            error: error.message
        });
    }
};


// GET ALL TARGETS
exports.getTargets = async (req, res) => {
    try {
        const {
            scheme_id,
            employee_id,
            financial_year,
            status
        } = req.query;

        const conditions = [];
        const params = [];

        if (scheme_id) {
            conditions.push('it.scheme_id = ?');
            params.push(scheme_id);
        }

        if (employee_id) {
            conditions.push('it.employee_id = ?');
            params.push(employee_id);
        }

        if (financial_year) {
            conditions.push('it.financial_year = ?');
            params.push(financial_year);
        }

        if (status !== undefined) {
            conditions.push('it.status = ?');
            params.push(status);
        }

        const whereClause = conditions.length
            ? `WHERE ${conditions.join(' AND ')}`
            : '';

        const [rows] = await pool.query(
            `SELECT
                it.*,
                s.scheme_name,
                s.scheme_code,
                s.scheme_type,
                s.financial_year AS scheme_financial_year
             FROM incentive_targets it
             LEFT JOIN incentive_schemes s
                ON s.id = it.scheme_id
             ${whereClause}
             ORDER BY it.id DESC`,
            params
        );

        return res.status(200).json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error('getTargets error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch employee targets',
            error: error.message
        });
    }
};


// GET TARGET BY ID
exports.getTargetById = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            `SELECT
                it.*,
                s.scheme_name,
                s.scheme_code,
                s.scheme_type
             FROM incentive_targets it
             LEFT JOIN incentive_schemes s
                ON s.id = it.scheme_id
             WHERE it.id = ?
             LIMIT 1`,
            [id]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: 'Employee target not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: rows[0]
        });

    } catch (error) {
        console.error('getTargetById error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch employee target',
            error: error.message
        });
    }
};


// UPDATE TARGET
exports.updateTarget = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            scheme_id,
            employee_id,
            financial_year,
            target_amount,
            status
        } = req.body;

        if (
            !scheme_id ||
            !employee_id ||
            !financial_year ||
            target_amount === undefined
        ) {
            return res.status(400).json({
                success: false,
                message:
                    'scheme_id, employee_id, financial_year and target_amount are required'
            });
        }

        const targetAmount = Number(target_amount);

        if (Number.isNaN(targetAmount) || targetAmount < 0) {
            return res.status(400).json({
                success: false,
                message: 'target_amount must be a valid positive number'
            });
        }

        const [existingRows] = await pool.query(
            `SELECT id
             FROM incentive_targets
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        if (!existingRows.length) {
            return res.status(404).json({
                success: false,
                message: 'Employee target not found'
            });
        }

        // Check if another target already uses
        // same scheme + employee + financial year
        const [duplicateRows] = await pool.query(
            `SELECT id
             FROM incentive_targets
             WHERE scheme_id = ?
               AND employee_id = ?
               AND financial_year = ?
               AND id <> ?
             LIMIT 1`,
            [
                scheme_id,
                employee_id,
                financial_year,
                id
            ]
        );

        if (duplicateRows.length) {
            return res.status(409).json({
                success: false,
                message:
                    'Another target already exists for this employee, scheme and financial year'
            });
        }

        await pool.query(
            `UPDATE incentive_targets
             SET
                scheme_id = ?,
                employee_id = ?,
                financial_year = ?,
                target_amount = ?,
                status = ?
               
             WHERE id = ?`,
            [
                scheme_id,
                employee_id,
                financial_year,
                targetAmount,
                status !== undefined ? status : 1,
                
                id
            ]
        );

        await logAudit({
            userId: req.user?.id,
            action: 'UPDATE',
            module: 'INCENTIVE_TARGET',
            recordId: id,
            details: {
                scheme_id,
                employee_id,
                financial_year,
                target_amount: targetAmount
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Employee target updated successfully'
        });

    } catch (error) {
        console.error('updateTarget error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update employee target',
            error: error.message
        });
    }
};


// ENABLE / DISABLE TARGET
exports.updateTargetStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (status !== 0 && status !== 1) {
            return res.status(400).json({
                success: false,
                message: 'status must be 0 or 1'
            });
        }

        const [result] = await pool.query(
            `UPDATE incentive_targets
             SET
                status = ?,
                updated_by = ?
             WHERE id = ?`,
            [
                status,
                req.user?.id || null,
                id
            ]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: 'Employee target not found'
            });
        }

        await logAudit({
            userId: req.user?.id,
            action: 'UPDATE_STATUS',
            module: 'INCENTIVE_TARGET',
            recordId: id,
            details: {
                status
            }
        });

        return res.status(200).json({
            success: true,
            message: status
                ? 'Target activated successfully'
                : 'Target deactivated successfully'
        });

    } catch (error) {
        console.error('updateTargetStatus error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update target status',
            error: error.message
        });
    }
};

// GET TARGET BY EMPLOYEE ID
exports.getTargetByEmployeeId = async (req, res) => {
    try {
        const { employee_id } = req.params;

        if (!employee_id) {
            return res.status(400).json({
                success: false,
                message: 'employee_id is required'
            });
        }

        const [rows] = await pool.query(
            `SELECT
                employee_id,
                target_amount,
                scheme_id
             FROM incentive_targets
             WHERE employee_id = ?
             AND status = 1
             ORDER BY id DESC`,
            [employee_id]
        );

        return res.status(200).json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error('getTargetByEmployeeId error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch employee target',
            error: error.message
        });
    }
};