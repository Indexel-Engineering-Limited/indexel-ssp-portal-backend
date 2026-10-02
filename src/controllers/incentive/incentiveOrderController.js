const { pool } = require('../../config/db');
const { logAudit } = require('../../utils/auditLogger');


// FIND MARGIN MULTIPLIER
const getMarginMultiplier = async (
    schemeId,
    marginPercent
) => {

    const [rules] = await pool.query(
        `SELECT *
         FROM incentive_margin_rules
         WHERE scheme_id = ?
           AND status = 1
           AND order_type = 'ALL'
           AND min_margin <= ?
           AND (
                max_margin IS NULL
                OR max_margin > ?
           )
         ORDER BY sequence ASC
         LIMIT 1`,
        [
            schemeId,
            marginPercent,
            marginPercent
        ]
    );

    if (!rules.length) {
        return 0;
    }

    return Number(rules[0].multiplier);
};


// CREATE ORDER
exports.createOrder = async (req, res) => {
    try {

        const {
            scheme_id,
            salesperson_id,

            invoice_no,
            invoice_date,

            plant_customer,
            item_description,

            po_number,
            po_date,

            po_value,
            po_value_after_sharing,

            new_product_customer,

            margin_percent,

            remarks
        } = req.body;

        if (
            !scheme_id ||
            !salesperson_id ||
            !plant_customer ||
            po_value === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: 'Required fields are missing'
            });
        }


        // CHECK SCHEME
        const [schemeRows] = await pool.query(
            `SELECT *
             FROM incentive_schemes
             WHERE id = ?
               AND status = 'ACTIVE'
             LIMIT 1`,
            [scheme_id]
        );

        if (!schemeRows.length) {
            return res.status(400).json({
                success: false,
                message: 'Active incentive scheme not found'
            });
        }


        // CALCULATE MARGIN %
        let calculatedMargin = null;

        if (
            margin_percent !== undefined &&
            margin_percent !== null &&
            margin_percent !== ''
        ) {
            calculatedMargin = Number(margin_percent);
        }


        // CALCULATE MULTIPLIER
        let marginMultiplier = null;

        if (calculatedMargin !== null) {
            marginMultiplier =
                await getMarginMultiplier(
                    scheme_id,
                    calculatedMargin
                );
        }


        // CALCULATE INCENTIVE
        let netIncentive = 0;

        if (
            po_value_after_sharing !== undefined &&
            po_value_after_sharing !== null &&
            marginMultiplier !== null
        ) {
            netIncentive =
                Number(po_value_after_sharing) *
                marginMultiplier;
        }


        const [result] = await pool.query(
            `INSERT INTO incentive_orders
            (
                scheme_id,
                salesperson_id,

                invoice_no,
                invoice_date,

                plant_customer,
                item_description,

                po_number,
                po_date,

                po_value,
                po_value_after_sharing,

                new_product_customer,

                margin_percent,
                margin_multiplier,

                net_incentive,

                remarks,

                status,
                created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
            [
                scheme_id,
                salesperson_id,

                invoice_no || null,
                invoice_date || null,

                plant_customer,
                item_description || null,

                po_number || null,
                po_date || null,

                po_value,
                po_value_after_sharing || 0,

                new_product_customer || null,

                calculatedMargin,
                marginMultiplier,

                netIncentive,

                remarks || null,

                req.user?.id || null
            ]
        );


        await logAudit({
            userId: req.user?.id,
            action: 'CREATE',
            module: 'INCENTIVE_ORDER',
            recordId: result.insertId,
            details: {
                plant_customer,
                po_value,
                margin_percent: calculatedMargin,
                margin_multiplier: marginMultiplier,
                net_incentive: netIncentive
            }
        });


        return res.status(201).json({
            success: true,
            message: 'Incentive order created successfully',

            data: {
                id: result.insertId,
                margin_percent: calculatedMargin,
                margin_multiplier: marginMultiplier,
                net_incentive: netIncentive
            }
        });

    } catch (error) {

        console.error(
            'createOrder error:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Failed to create incentive order',
            error: error.message
        });
    }
};

exports.getOrders = async (req, res) => {
    try {

        const {
            scheme_id,
            salesperson_id,
            status
        } = req.query;

        let where = [];
        let params = [];

        if (scheme_id) {
            where.push(`io.scheme_id = ?`);
            params.push(scheme_id);
        }

        if (salesperson_id) {
            where.push(`io.salesperson_id = ?`);
            params.push(salesperson_id);
        }

        if (status) {
            where.push(`io.status = ?`);
            params.push(status);
        }

        const whereClause =
            where.length
                ? `WHERE ${where.join(' AND ')}`
                : '';

        const [rows] = await pool.query(
            `SELECT
                io.*,
                s.scheme_name,
                s.scheme_code
             FROM incentive_orders io
             LEFT JOIN incentive_schemes s
                 ON s.id = io.scheme_id

             ${whereClause}

             ORDER BY io.id DESC`,
            params
        );

        return res.status(200).json({
            success: true,
            data: rows
        });

    } catch (error) {

        console.error(
            'getOrders error:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch incentive orders',
            error: error.message
        });
    }
};

exports.getOrderById = async (req, res) => {
    try {

        const { id } = req.params;

        const [rows] = await pool.query(
            `SELECT
                io.*,
                s.scheme_name,
                s.scheme_code,
                s.scheme_type,
                s.financial_year
             FROM incentive_orders io
             LEFT JOIN incentive_schemes s
                 ON s.id = io.scheme_id
             WHERE io.id = ?`,
            [id]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                message: 'Incentive order not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: rows[0]
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch incentive order',
            error: error.message
        });
    }
};

exports.updateOrder = async (req, res) => {
    try {

        const { id } = req.params;

        const {
            scheme_id,
            salesperson_id,

            invoice_no,
            invoice_date,

            plant_customer,
            item_description,

            po_number,
            po_date,

            po_value,
            po_value_after_sharing,

            new_product_customer,

            margin_percent,

            remarks,
            status
        } = req.body;


        const [existing] = await pool.query(
            `SELECT id
             FROM incentive_orders
             WHERE id = ?`,
            [id]
        );

        if (!existing.length) {
            return res.status(404).json({
                success: false,
                message: 'Incentive order not found'
            });
        }


        const marginMultiplier =
            await getMarginMultiplier(
                scheme_id,
                Number(margin_percent || 0)
            );


        const netIncentive =
            Number(po_value_after_sharing || 0) *
            marginMultiplier;


        await pool.query(
            `UPDATE incentive_orders
             SET
                scheme_id = ?,
                salesperson_id = ?,

                invoice_no = ?,
                invoice_date = ?,

                plant_customer = ?,
                item_description = ?,

                po_number = ?,
                po_date = ?,

                po_value = ?,
                po_value_after_sharing = ?,

                new_product_customer = ?,

                margin_percent = ?,
                margin_multiplier = ?,

                net_incentive = ?,

                remarks = ?,
                status = ?,
                updated_by = ?

             WHERE id = ?`,
            [
                scheme_id,
                salesperson_id,

                invoice_no || null,
                invoice_date || null,

                plant_customer,
                item_description || null,

                po_number || null,
                po_date || null,

                po_value || 0,
                po_value_after_sharing || 0,

                new_product_customer || null,

                margin_percent || 0,
                marginMultiplier,

                netIncentive,

                remarks || null,
                status || 'DRAFT',

                req.user?.id || null,

                id
            ]
        );


        await logAudit({
            userId: req.user?.id,
            action: 'UPDATE',
            module: 'INCENTIVE_ORDER',
            recordId: id
        });


        return res.status(200).json({
            success: true,
            message: 'Incentive order updated successfully',

            data: {
                margin_multiplier:
                    marginMultiplier,

                net_incentive:
                    Number(netIncentive.toFixed(2))
            }
        });

    } catch (error) {

        console.error(
            'updateOrder error:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Failed to update incentive order',
            error: error.message
        });
    }
};

exports.calculateOrder = async (req, res) => {
    try {

        const {
            scheme_id,
            po_value_after_sharing,
            margin_percent
        } = req.body;

        if (!scheme_id) {
            return res.status(400).json({
                success: false,
                message: 'scheme_id is required'
            });
        }

        if (
            margin_percent === undefined ||
            margin_percent === null
        ) {
            return res.status(400).json({
                success: false,
                message: 'margin_percent is required'
            });
        }

        const marginMultiplier =
            await getMarginMultiplier(
                scheme_id,
                Number(margin_percent)
            );

        const netIncentive =
            Number(po_value_after_sharing || 0) *
            marginMultiplier;

        return res.status(200).json({
            success: true,
            data: {
                margin_percent:
                    Number(margin_percent),

                margin_multiplier:
                    marginMultiplier,

                net_incentive:
                    Number(netIncentive.toFixed(2))
            }
        });

    } catch (error) {

        console.error(
            'calculateOrder error:',
            error
        );

        return res.status(500).json({
            success: false,
            message: 'Failed to calculate incentive',
            error: error.message
        });
    }
};