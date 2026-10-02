const { pool } = require('../../config/db');
const { logAudit } = require('../../utils/auditLogger');


// CREATE MARGIN RULE
exports.createMarginRule = async (req, res) => {
    try {
        const { schemeId } = req.params;

        const {
            order_type,
            min_margin,
            max_margin,
            multiplier,
            sequence
        } = req.body;
        console.log(req.body)

        if (
            multiplier === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: 'Multiplier is required'
            });
        }

        const [result] = await pool.query(
            `INSERT INTO incentive_margin_rules
            (
                scheme_id,
                order_type,
                min_margin,
                max_margin,
                multiplier,
                sequence
            )
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                schemeId,
                order_type || 'ALL',
                min_margin ?? null,
                max_margin ?? null,
                multiplier,
                sequence || 1
            ]
        );

        await logAudit({
            userId: req.user?.id,
            action: 'CREATE',
            module: 'INCENTIVE_MARGIN_RULE',
            recordId: result.insertId,
            details: {
                scheme_id: schemeId
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Margin rule created successfully',
            data: {
                id: result.insertId
            }
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create margin rule',
            error: error.message
        });
    }
};


// GET MARGIN RULES
exports.getMarginRules = async (req, res) => {
    try {
        const { schemeId } = req.params;

        const [rows] = await pool.query(
            `SELECT *
             FROM incentive_margin_rules
             WHERE scheme_id = ?
               AND status = 1
             ORDER BY sequence ASC, id ASC`,
            [schemeId]
        );

        return res.status(200).json({
            success: true,
            data: rows
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch margin rules',
            error: error.message
        });
    }
};


// UPDATE MARGIN RULE
exports.updateMarginRule = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            order_type,
            min_margin,
            max_margin,
            multiplier,
            sequence,
            status
        } = req.body;

        const [result] = await pool.query(
            `UPDATE incentive_margin_rules
             SET
                order_type = ?,
                min_margin = ?,
                max_margin = ?,
                multiplier = ?,
                sequence = ?,
                status = ?
             WHERE id = ?`,
            [
                order_type || 'ALL',
                min_margin ?? null,
                max_margin ?? null,
                multiplier,
                sequence || 1,
                status ?? 1,
                id
            ]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: 'Margin rule not found'
            });
        }

        await logAudit({
            userId: req.user?.id,
            action: 'UPDATE',
            module: 'INCENTIVE_MARGIN_RULE',
            recordId: id
        });

        return res.status(200).json({
            success: true,
            message: 'Margin rule updated successfully'
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to update margin rule',
            error: error.message
        });
    }
};