const { pool } = require('../config/db');
const { logAudit } = require('../utils/auditLogger');

const EDITABLE_FIELDS = [
    'call_date',
    'company_id',
    'contact_id',
    'product_model_serial',
    'service_type',
    'po_number',
    'service_done_date',
    'is_pending',
    'issue_from_our_side',
    'product_issue',
    'oem_issue',
    'engineer_name',
    'remarks',
];

const FLAG_FIELDS = ['is_pending', 'issue_from_our_side', 'product_issue', 'oem_issue'];

const toFlag = (value) => (value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0);

const normalizeValue = (field, value) => {
    if (FLAG_FIELDS.includes(field)) return toFlag(value);
    if (typeof value === 'string') value = value.trim();
    return value === '' || value === undefined ? null : value;
};

// Case number format: SC-YYYY-0001 (sequence restarts each year)
const getNextCaseNo = async () => {
    const prefix = `SC-${new Date().getFullYear()}-`;
    const [rows] = await pool.query(
        `SELECT case_no
         FROM service_calls
         WHERE case_no LIKE ?
         ORDER BY CAST(SUBSTRING(case_no, ?) AS UNSIGNED) DESC
         LIMIT 1`,
        [`${prefix}%`, prefix.length + 1]
    );

    const lastNumber = rows.length ? Number(rows[0].case_no.slice(prefix.length)) : 0;
    return `${prefix}${String(lastNumber + 1).padStart(4, '0')}`;
};

// Ensures the contact exists and belongs to the given company
const validateCompanyContact = async (companyId, contactId) => {
    const [companies] = await pool.query(
        'SELECT id, company_id FROM company_details WHERE id = ?',
        [companyId]
    );
    if (companies.length === 0) return 'Company not found';

    const [contacts] = await pool.query(
        'SELECT id FROM company_contact_details WHERE id = ? AND company_id = ? AND status = 1',
        [contactId, companies[0].company_id]
    );
    if (contacts.length === 0) return 'Contact not found for the selected company';

    return null;
};

const SELECT_SERVICE_CALL = `
    SELECT
        sc.*,
        cd.company_name,
        cd.company_id AS company_code,
        cd.location,
        ccd.person_name AS contact_name,
        ccd.contact_number,
        ccd.email AS contact_email
    FROM service_calls sc
    LEFT JOIN company_details cd ON sc.company_id = cd.id
    LEFT JOIN company_contact_details ccd ON sc.contact_id = ccd.id
`;

const fetchServiceCallById = async (id) => {
    const [rows] = await pool.query(
        `${SELECT_SERVICE_CALL} WHERE sc.id = ? AND sc.status = 'active'`,
        [id]
    );
    return rows[0] || null;
};

// ============================================================
// SERVICE CALL CONTROLLERS
// ============================================================

/**
 * GET /api/service-calls
 * Fetch service calls
 * Query filters: company_id, contact_id, service_type, is_pending,
 *                from_date, to_date (call_date), search, page, limit
 */
const getServiceCalls = async (req, res) => {
    try {
        const {
            company_id,
            contact_id,
            service_type,
            is_pending,
            from_date,
            to_date,
            search,
            page,
            limit,
        } = req.query;

        const conditions = [`sc.status = 'active'`];
        const values = [];

        if (company_id) {
            conditions.push('sc.company_id = ?');
            values.push(company_id);
        }
        if (contact_id) {
            conditions.push('sc.contact_id = ?');
            values.push(contact_id);
        }
        if (service_type) {
            conditions.push('sc.service_type = ?');
            values.push(service_type);
        }
        if (is_pending !== undefined && is_pending !== '') {
            conditions.push('sc.is_pending = ?');
            values.push(toFlag(is_pending));
        }
        if (from_date) {
            conditions.push('sc.call_date >= ?');
            values.push(from_date);
        }
        if (to_date) {
            conditions.push('sc.call_date <= ?');
            values.push(to_date);
        }
        if (search) {
            conditions.push(`(
                sc.case_no LIKE ?
                OR sc.product_model_serial LIKE ?
                OR sc.po_number LIKE ?
                OR sc.engineer_name LIKE ?
                OR cd.company_name LIKE ?
                OR ccd.person_name LIKE ?
            )`);
            values.push(...Array(6).fill(`%${search}%`));
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        let paginationClause = '';
        let pagination = null;

        if (page || limit) {
            const pageNum = Math.max(parseInt(page, 10) || 1, 1);
            const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 500);

            const [countRows] = await pool.query(
                `SELECT COUNT(*) AS total
                 FROM service_calls sc
                 LEFT JOIN company_details cd ON sc.company_id = cd.id
                 LEFT JOIN company_contact_details ccd ON sc.contact_id = ccd.id
                 ${whereClause}`,
                values
            );

            paginationClause = 'LIMIT ? OFFSET ?';
            pagination = {
                page: pageNum,
                limit: pageSize,
                total: countRows[0].total,
                total_pages: Math.ceil(countRows[0].total / pageSize),
            };
            values.push(pageSize, (pageNum - 1) * pageSize);
        }

        const [rows] = await pool.query(
            `${SELECT_SERVICE_CALL}
             ${whereClause}
             ORDER BY sc.call_date DESC, sc.id DESC
             ${paginationClause}`,
            values
        );

        return res.status(200).json({
            success: true,
            data: rows,
            ...(pagination && { pagination }),
            message: 'Service calls fetched successfully'
        });

    } catch (error) {
        console.error('Get Service Calls Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


/**
 * GET /api/service-calls/:id
 * Fetch a single service call by ID
 */
const getServiceCallById = async (req, res) => {
    try {
        const serviceCall = await fetchServiceCallById(req.params.id);

        if (!serviceCall) {
            return res.status(404).json({
                success: false,
                data: null,
                message: 'Service call not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: serviceCall,
            message: 'Service call fetched successfully'
        });

    } catch (error) {
        console.error('Get Service Call By ID Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


/**
 * POST /api/service-calls
 * Create a new service call
 * case_no is auto-generated when not provided
 */
const createServiceCall = async (req, res) => {
    try {
        const { case_no, call_date, company_id, contact_id } = req.body;

        if (!call_date || !company_id || !contact_id) {
            return res.status(400).json({
                success: false,
                message: 'call_date, company_id and contact_id are required'
            });
        }

        const validationError = await validateCompanyContact(company_id, contact_id);
        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        const data = {};
        EDITABLE_FIELDS.forEach((field) => {
            if (req.body[field] !== undefined) data[field] = normalizeValue(field, req.body[field]);
        });
        if (data.is_pending === undefined) data.is_pending = 1;

        data.created_by = req.user?.id || null;
        data.updated_by = req.user?.id || null;

        const manualCaseNo = case_no && String(case_no).trim();
        let result;

        // The unique key on case_no prevents duplicates if two requests
        // generate the same case number at the same time.
        for (let attempt = 0; attempt < 5; attempt += 1) {
            data.case_no = manualCaseNo || await getNextCaseNo();
            try {
                [result] = await pool.query('INSERT INTO service_calls SET ?', [data]);
                break;
            } catch (error) {
                if (error.code !== 'ER_DUP_ENTRY') throw error;
                if (manualCaseNo) {
                    return res.status(409).json({
                        success: false,
                        message: `Case number ${manualCaseNo} already exists`
                    });
                }
                if (attempt === 4) throw error;
            }
        }

        const newServiceCall = await fetchServiceCallById(result.insertId);

        // Log audit: INSERT
        await logAudit('service_calls', result.insertId, 'INSERT', null, { id: result.insertId, ...data }, req);

        return res.status(201).json({
            success: true,
            message: 'Service call created successfully',
            data: newServiceCall
        });

    } catch (error) {
        console.error('Create Service Call Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


/**
 * PUT /api/service-calls/:id
 * Update an existing service call (only the fields sent are updated)
 */
const updateServiceCall = async (req, res) => {
    try {
        const { id } = req.params;

        const [oldRows] = await pool.query(
            `SELECT * FROM service_calls WHERE id = ? AND status = 'active'`,
            [id]
        );

        if (oldRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Service call not found'
            });
        }

        const oldData = oldRows[0];

        const data = {};
        EDITABLE_FIELDS.forEach((field) => {
            if (req.body[field] !== undefined) data[field] = normalizeValue(field, req.body[field]);
        });

        if (req.body.case_no !== undefined) {
            const caseNo = String(req.body.case_no).trim();
            if (!caseNo) {
                return res.status(400).json({
                    success: false,
                    message: 'case_no cannot be empty'
                });
            }
            data.case_no = caseNo;
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        if (data.call_date === null || data.company_id === null || data.contact_id === null) {
            return res.status(400).json({
                success: false,
                message: 'call_date, company_id and contact_id cannot be empty'
            });
        }

        if (data.company_id !== undefined || data.contact_id !== undefined) {
            const validationError = await validateCompanyContact(
                data.company_id ?? oldData.company_id,
                data.contact_id ?? oldData.contact_id
            );
            if (validationError) {
                return res.status(400).json({
                    success: false,
                    message: validationError
                });
            }
        }

        data.updated_by = req.user?.id || null;

        try {
            await pool.query('UPDATE service_calls SET ? WHERE id = ?', [data, id]);
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                    success: false,
                    message: `Case number ${data.case_no} already exists`
                });
            }
            throw error;
        }

        const [newRows] = await pool.query('SELECT * FROM service_calls WHERE id = ?', [id]);

        // Log audit: UPDATE
        await logAudit('service_calls', Number(id), 'UPDATE', oldData, newRows[0], req);

        const updatedServiceCall = await fetchServiceCallById(id);

        return res.status(200).json({
            success: true,
            message: 'Service call updated successfully',
            data: updatedServiceCall
        });

    } catch (error) {
        console.error('Update Service Call Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


/**
 * DELETE /api/service-calls/:id
 * Soft delete a service call (status -> inactive)
 */
const deleteServiceCall = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            `SELECT * FROM service_calls WHERE id = ? AND status = 'active'`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Service call not found'
            });
        }

        await pool.query(
            `UPDATE service_calls SET status = 'inactive', updated_by = ? WHERE id = ?`,
            [req.user?.id || null, id]
        );

        // Log audit: DELETE
        await logAudit('service_calls', Number(id), 'DELETE', rows[0], null, req);

        return res.status(200).json({
            success: true,
            message: 'Service call deleted successfully'
        });

    } catch (error) {
        console.error('Delete Service Call Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

module.exports = {
    getServiceCalls,
    getServiceCallById,
    createServiceCall,
    updateServiceCall,
    deleteServiceCall,
};
