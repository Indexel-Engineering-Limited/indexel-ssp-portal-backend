const { pool } = require('../../config/db');
const { logAudit } = require('../../utils/auditLogger');


// CREATE ACHIEVEMENT RULE
exports.createAchievementRule = async (req, res) => {
    try {
        const { schemeId } = req.params;

        const {
            min_achievement,
            max_achievement,
            incentive_type,
            incentive_rate,
            sequence
        } = req.body;

        if (
            min_achievement === undefined ||
            !incentive_type
        ) {
            return res.status(400).json({
                success: false,
                message: 'Required fields are missing'
            });
        }

        const [scheme] = await pool.query(
            `SELECT id
             FROM incentive_schemes
             WHERE id = ?`,
            [schemeId]
        );

        if (!scheme.length) {
            return res.status(404).json({
                success: false,
                message: 'Scheme not found'
            });
        }

        const [result] = await pool.query(
            `INSERT INTO incentive_achievement_rules
            (
                scheme_id,
                min_achievement,
                max_achievement,
                incentive_type,
                incentive_rate,
                sequence
            )
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                schemeId,
                min_achievement,
                max_achievement ?? null,
                incentive_type,
                incentive_rate || 0,
                sequence || 1
            ]
        );

        await logAudit({
            userId: req.user?.id,
            action: 'CREATE',
            module: 'INCENTIVE_ACHIEVEMENT_RULE',
            recordId: result.insertId,
            details: {
                scheme_id: schemeId
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Achievement rule created successfully',
            data: {
                id: result.insertId
            }
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: 'Failed to create achievement rule',
            error: error.message
        });
    }
};


// GET RULES BY SCHEME
exports.getAchievementRules = async (req, res) => {
    try {
        const { schemeId } = req.params;

        const [rows] = await pool.query(
            `SELECT *
             FROM incentive_achievement_rules
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
            message: 'Failed to fetch achievement rules',
            error: error.message
        });
    }
};


// UPDATE RULE
exports.updateAchievementRule = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            min_achievement,
            max_achievement,
            incentive_type,
            incentive_rate,
            sequence,
            status
        } = req.body;

        const [result] = await pool.query(
            `UPDATE incentive_achievement_rules
             SET
                min_achievement = ?,
                max_achievement = ?,
                incentive_type = ?,
                incentive_rate = ?,
                sequence = ?,
                status = ?
             WHERE id = ?`,
            [
                min_achievement,
                max_achievement ?? null,
                incentive_type,
                incentive_rate || 0,
                sequence || 1,
                status ?? 1,
                id
            ]
        );

        if (!result.affectedRows) {
            return res.status(404).json({
                success: false,
                message: 'Achievement rule not found'
            });
        }

        await logAudit({
            userId: req.user?.id,
            action: 'UPDATE',
            module: 'INCENTIVE_ACHIEVEMENT_RULE',
            recordId: id
        });

        return res.status(200).json({
            success: true,
            message: 'Achievement rule updated successfully'
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Failed to update achievement rule',
            error: error.message
        });
    }
};