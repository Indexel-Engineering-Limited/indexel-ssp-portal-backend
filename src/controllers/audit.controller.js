const { pool } = require('../config/db');

/**
 * GET /api/audit-logs
 * Fetch all audit logs with filters
 * Query params:
 *  - table_name: filter by table (e.g., 'company_details')
 *  - record_id: filter by specific record ID
 *  - action: filter by action (INSERT, UPDATE, DELETE)
 *  - limit: number of records (default: 100)
 *  - offset: pagination offset (default: 0)
 */

const parseJSONSafe = (value) => {
    if (value === null || value === undefined || value === '') {
        return null;
    }

    // Already an object/array
    if (typeof value === 'object') {
        return value;
    }

    // String
    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch (error) {
            console.error('Invalid JSON value:', value);

            // If database contains "[object Object]"
            return value;
        }
    }

    return value;
};

const getAuditLogs = async (req, res) => {
    try {
        const {
            table_name,
            record_id,
            action,
            limit = 100,
            offset = 0
        } = req.query;

        const conditions = [];
        const params = [];

        if (table_name) {
            conditions.push('a.table_name = ?');
            params.push(table_name);
        }

        if (record_id) {
            conditions.push('a.record_id = ?');
            params.push(record_id);
        }

        if (action) {
            conditions.push('a.action = ?');
            params.push(action.toUpperCase());
        }

        const whereClause =
            conditions.length > 0
                ? `WHERE ${conditions.join(' AND ')}`
                : '';

        const [rows] = await pool.query(
            `SELECT 
                a.id,
                a.table_name,
                a.record_id,
                a.action,
                a.user_id,
                u.name,
                a.user_email,
                a.old_data,
                a.new_data,
                a.changes,
                a.ip_address,
                a.user_agent,
                a.created_at
            FROM audit_logs a
            LEFT JOIN users u ON u.id = a.user_id
            ${whereClause}
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?`,
            [
                ...params,
                Number(limit),
                Number(offset)
            ]
        );

        const logs = rows.map(row => ({
            ...row,
            old_data: parseJSONSafe(row.old_data),
            new_data: parseJSONSafe(row.new_data),
            changes: parseJSONSafe(row.changes)
        }));

        return res.status(200).json({
            success: true,
            data: logs,
            message: 'Audit logs fetched successfully',
            pagination: {
                limit: Number(limit),
                offset: Number(offset),
                count: logs.length
            }
        });

    } catch (error) {
        console.error('Get Audit Logs Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};




/**
 * GET /api/audit-logs/:id
 * Fetch a single audit log by ID
 */
const getAuditLogById = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            `SELECT
                a.id,
                a.table_name,
                a.record_id,
                a.action,
                a.user_id,
                u.name AS name,
                a.user_email,
                a.old_data,
                a.new_data,
                a.changes,
                a.ip_address,
                a.user_agent,
                a.created_at
            FROM audit_logs a
            LEFT JOIN users u ON u.id = a.user_id
            WHERE a.id = ?`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Audit log not found'
            });
        }

        const row = rows[0];

        const log = {
            ...row,
            old_data: parseJSONSafe(row.old_data),
            new_data: parseJSONSafe(row.new_data),
            changes: parseJSONSafe(row.changes)
        };

        return res.status(200).json({
            success: true,
            data: log,
            message: 'Audit log fetched successfully'
        });

    } catch (error) {
        console.error('Get Audit Log By ID Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


/**
 * GET /api/audit-logs/history/:table/:id
 * Get complete history for a specific record
 */
const getRecordHistory = async (req, res) => {
    try {
        const { table, id } = req.params;

        const [rows] = await pool.query(
            `SELECT 
                id,
                table_name,
                record_id,
                action,
                user_id,
                user_email,
                old_data,
                new_data,
                changes,
                ip_address,
                user_agent,
                created_at
            FROM audit_logs
            WHERE table_name = ? AND record_id = ?
            ORDER BY created_at ASC`,
            [table, id]
        );

        const history = rows.map(row => ({
            ...row,
            old_data: row.old_data ? JSON.parse(row.old_data) : null,
            new_data: row.new_data ? JSON.parse(row.new_data) : null,
            changes: row.changes ? JSON.parse(row.changes) : null,
        }));

        return res.status(200).json({
            success: true,
            data: history,
            message: `Complete history for ${table} #${id}`,
            count: history.length
        });

    } catch (error) {
        console.error('Get Record History Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


module.exports = {
    getAuditLogs,
    getAuditLogById,
    getRecordHistory
};
