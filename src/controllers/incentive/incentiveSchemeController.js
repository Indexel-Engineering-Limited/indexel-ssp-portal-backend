const { pool } = require('../../config/db');
const { logAudit } = require('../../utils/auditLogger');


// CREATE SCHEME
exports.createScheme = async (req, res) => {
    try {
        const {
            scheme_name,
            scheme_code,
            scheme_type,
            financial_year,
            effective_from,
            effective_to,
            description
        } = req.body;

        if (
            !scheme_name ||
            !scheme_code ||
            !scheme_type ||
            !financial_year ||
            !effective_from ||
            !effective_to
        ) {
            return res.status(400).json({
                success: false,
                message: 'Required fields are missing'
            });
        }

        const [existing] = await pool.query(
            `SELECT id
             FROM incentive_schemes
             WHERE scheme_code = ?
             LIMIT 1`,
            [scheme_code]
        );

        if (existing.length) {
            return res.status(409).json({
                success: false,
                message: 'Scheme code already exists'
            });
        }

        const [result] = await pool.query(
            `INSERT INTO incentive_schemes
            (
                scheme_name,
                scheme_code,
                scheme_type,
                financial_year,
                effective_from,
                effective_to,
                description,
                status,
                created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
            [
                scheme_name,
                scheme_code,
                scheme_type,
                financial_year,
                effective_from,
                effective_to,
                description || null,
                req.user?.id || null
            ]
        );

        await logAudit({
            userId: req.user?.id,
            action: 'CREATE',
            module: 'INCENTIVE_SCHEME',
            recordId: result.insertId,
            details: {
                scheme_name,
                scheme_code
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Incentive scheme created successfully',
            data: {
                id: result.insertId
            }
        });

    } catch (error) {
        console.error('createScheme error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create incentive scheme',
            error: error.message
        });
    }
};


// GET ALL SCHEMES
exports.getSchemes = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT *
             FROM incentive_schemes
             ORDER BY id DESC`
        );

        return res.status(200).json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error('getSchemes error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch incentive schemes',
            error: error.message
        });
    }
};


// GET SINGLE SCHEME
exports.getSchemeById = async (req, res) => {
    try {
        const { id } = req.params;

        const [schemeRows] = await pool.query(
            `SELECT *
             FROM incentive_schemes
             WHERE id = ?`,
            [id]
        );

        if (!schemeRows.length) {
            return res.status(404).json({
                success: false,
                message: 'Scheme not found'
            });
        }

        const [achievementRules] = await pool.query(
            `SELECT *
             FROM incentive_achievement_rules
             WHERE scheme_id = ?
               AND status = 1
             ORDER BY sequence ASC, id ASC`,
            [id]
        );

        const [marginRules] = await pool.query(
            `SELECT *
             FROM incentive_margin_rules
             WHERE scheme_id = ?
               AND status = 1
             ORDER BY sequence ASC, id ASC`,
            [id]
        );

        return res.status(200).json({
            success: true,
            data: {
                ...schemeRows[0],
                achievement_rules: achievementRules,
                margin_rules: marginRules
            }
        });

    } catch (error) {
        console.error('getSchemeById error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch scheme',
            error: error.message
        });
    }
};


// UPDATE SCHEME
exports.updateScheme = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            scheme_name,
            scheme_code,
            scheme_type,
            financial_year,
            effective_from,
            effective_to,
            description,
            status
        } = req.body;

        const [existing] = await pool.query(
            `SELECT id
             FROM incentive_schemes
             WHERE id = ?`,
            [id]
        );

        if (!existing.length) {
            return res.status(404).json({
                success: false,
                message: 'Scheme not found'
            });
        }

        await pool.query(
            `UPDATE incentive_schemes
             SET
                scheme_name = ?,
                scheme_code = ?,
                scheme_type = ?,
                financial_year = ?,
                effective_from = ?,
                effective_to = ?,
                description = ?,
                status = ?,
                updated_by = ?
             WHERE id = ?`,
            [
                scheme_name,
                scheme_code,
                scheme_type,
                financial_year,
                effective_from,
                effective_to,
                description || null,
                status || 'DRAFT',
                req.user?.id || null,
                id
            ]
        );

        await logAudit({
            userId: req.user?.id,
            action: 'UPDATE',
            module: 'INCENTIVE_SCHEME',
            recordId: id,
            details: {
                scheme_name,
                scheme_code
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Scheme updated successfully'
        });

    } catch (error) {
        console.error('updateScheme error:', error);

        return res.status(500).json({
            success: false,
            message: 'Failed to update scheme',
            error: error.message
        });
    }
};