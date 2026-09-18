const { pool } = require('../config/db');
const { logAudit } = require('../utils/auditLogger');

const getCompanyPrefix = (companyName) => {
    const letters = companyName.replace(/[^a-zA-Z]/g, '').toUpperCase();
    return `${letters}XXX`.slice(0, 3);
};   

const getNextCompanyId = async (companyName) => {
    const prefix = getCompanyPrefix(companyName);
    const [rows] = await pool.query(
        `SELECT company_id
         FROM company_details
         WHERE company_id LIKE ?
         ORDER BY CAST(RIGHT(company_id, 3) AS UNSIGNED) DESC
         LIMIT 1`,
        [`${prefix}%`]
    );

    const lastNumber = rows.length ? Number(rows[0].company_id.slice(-3)) : 0;
    if (lastNumber >= 999) {
        const error = new Error(`Company ID limit reached for prefix ${prefix}`);
        error.statusCode = 409;
        throw error;
    }

    return `${prefix}${String(lastNumber + 1).padStart(3, '0')}`;
};

// ============================================================
// COMPANY CONTROLLERS
// ============================================================

/**
 * GET /api/companies
 * Fetch all companies
 */
const getCompanies = async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM company_details ORDER BY created_at ASC'
        );

        return res.status(200).json({
            success: true,
            data: rows,
            message: 'Companies fetched successfully'
        });

    } catch (error) {
        console.error('Get Companies Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


/**
 * GET /api/companies/:id
 * Fetch a single company by ID
 */
const getCompanyById = async (req, res) => {
    try {
        const { id } = req.params;
        const companyId = id.trim().toUpperCase();

        const [rows] = await pool.query(
            'SELECT * FROM company_details WHERE company_id = ? OR id = ?',
            [companyId, id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: 'Company not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: rows[0],
            message: 'Company fetched successfully'
        });

    } catch (error) {
        console.error('Get Company By ID Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


/**
 * POST /api/companies
 * Create a new company
 */
const createCompany = async (req, res) => {
    try {
        const {
            company_name,
            industry,
            city,
            state,
            country,
        } = req.body;
        const location =city+", "+state+", "+country;

        // Validate company name
        if (!company_name || company_name.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Company name is required'
            });
        }

        let result;
        let company_id;

        // The unique index on company_id prevents duplicate IDs if two requests
        // for the same company prefix arrive at the same time.
        for (let attempt = 0; attempt < 5; attempt += 1) {
            company_id = await getNextCompanyId(company_name.trim());
            try {
                [result] = await pool.query(
                    `INSERT INTO company_details
                        (company_id, company_name, industry, city, state, country, location)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        company_id,
                        company_name.trim(),
                        industry || null,
                        city || null,
                        state || null,
                        country || null,
                        location || null,
                    ]
                );
                break;
            } catch (error) {
                if (error.code !== 'ER_DUP_ENTRY' || attempt === 4) throw error;
            }
        }

        const newCompany = {
            id: result.insertId,
            company_id,
            company_name: company_name.trim(),
            industry: industry || null,
            city: city || null,
            state: state || null,
            country: country || null,
            location: location || null,
        };

        // Log audit: INSERT
        await logAudit('company_details', result.insertId, 'INSERT', null, newCompany, req);

        return res.status(201).json({
            success: true,
            message: 'Company created successfully',
            data: newCompany
        });

    } catch (error) {
        console.error('Create Company Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


/**
 * PUT /api/companies/:id
 * Update an existing company
 */
const updateCompany = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            company_name,
            industry,
            city,
            state,
            country,
        } = req.body;

        // Fetch old data first
        const [oldRows] = await pool.query(
            'SELECT * FROM company_details WHERE company_id = ?',
            [id]
        );

        if (oldRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        const oldData = oldRows[0];

        // Build update query dynamically
        const updates = [];
        const values = [];

        if (company_name !== undefined) {
            updates.push('company_name = ?');
            values.push(company_name.trim());
        }
        if (industry !== undefined) {
            updates.push('industry = ?');
            values.push(industry || null);
        }
        if (city !== undefined) {
            updates.push('city = ?');
            values.push(city || null);
        }
        if (state !== undefined) {
            updates.push('state = ?');
            values.push(state || null);
        }
        if (country !== undefined) {
            updates.push('country = ?');
            values.push(country || null);
        }

        if (city !== undefined || state !== undefined || country !== undefined) {
            const newCity = city !== undefined ? city : oldData.city;
            const newState = state !== undefined ? state : oldData.state;
            const newCountry = country !== undefined ? country : oldData.country;
            const location = `${newCity || ''}, ${newState || ''}, ${newCountry || ''}`.replace(/, ,/g, ',').replace(/^, |, $/g, '');
            updates.push('location = ?');
            values.push(location || null);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        values.push(id);

        await pool.query(
            `UPDATE company_details SET ${updates.join(', ')} WHERE company_id = ?`,
            values
        );

        // Fetch updated data
        const [newRows] = await pool.query(
            'SELECT * FROM company_details WHERE id = ?',
            [id]
        );
        const newData = newRows[0];

        // Log audit: UPDATE
        await logAudit('company_details', Number(id), 'UPDATE', oldData, newData, req);

        return res.status(200).json({
            success: true,
            message: 'Company updated successfully',
            data: newData
        });

    } catch (error) {
        console.error('Update Company Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


/**
 * DELETE /api/companies/:id
 * Delete a company
 */
const deleteCompany = async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch old data first
        const [oldRows] = await pool.query(
            'SELECT * FROM company_details WHERE id = ?',
            [id]
        );

        if (oldRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        const oldData = oldRows[0];

        // Delete the company
        await pool.query('DELETE FROM company_details WHERE id = ?', [id]);

        // Log audit: DELETE
        await logAudit('company_details', Number(id), 'DELETE', oldData, null, req);

        return res.status(200).json({
            success: true,
            message: 'Company deleted successfully',
            data: oldData
        });

    } catch (error) {
        console.error('Delete Company Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// ============================================================
// CONTACT CONTROLLERS
// ============================================================

/**
 * GET /api/companies/all_contacts
 * Fetch all contacts
 */
const getAllContacts = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                ccd.*,
                cd.company_name,
                cd.location
            FROM company_contact_details ccd
            LEFT JOIN company_details cd
                ON ccd.company_id = cd.company_id
            WHERE ccd.status = 1
            ORDER BY ccd.created_at DESC
        `);

        return res.status(200).json({
            success: true,
            data: rows,
            message: 'Contacts fetched successfully'
        });

    } catch (error) {
        console.error('Get All Contacts Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


/**
 * GET /api/companies/:id/contacts
 * Fetch all contacts for a specific company
 */
const getContactsByCompanyId = async (req, res) => {
    try {
        const { id: company_id } = req.params;

        const [rows] = await pool.query(
            `SELECT *
             FROM company_contact_details
             WHERE company_id = ?
               AND status = 1
             ORDER BY created_at DESC`,
            [company_id.trim().toUpperCase()]
        );

        if (rows.length === 0) {
            return res.status(200).json({
                success: false,
                data: [],
                message: 'No active contacts found for this company'
            });
        }

        return res.status(200).json({
            success: true,
            data: rows,
            message: 'Contacts fetched successfully'
        });

    } catch (error) {
        console.error('Get Contacts By Company ID Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


/**
 * GET /api/companies/contacts/:id
 * Fetch a single contact by ID
 */
const getContactbyId = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            'SELECT * FROM company_contact_details WHERE id = ?',
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                data: null,
                message: 'Contact not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: rows[0],
            message: 'Contact fetched successfully'
        });

    } catch (error) {
        console.error('Get Contact By ID Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


const createContact = async (req, res) => {
    try {
        const {
            company_id,
            person_name,
            designation,
            contact_number,
            email,
            department
        } = req.body;

        // Validate required fields
        if (!company_id || typeof company_id !== 'string') {
            return res.status(400).json({
                success: false,
                message: "Company ID is required"
            });
        }

        if (!person_name || person_name.trim() === "") {
            return res.status(400).json({
                success: false,
                message: "Person name is required"
            });
        }

        // Clean values
        const companyId = company_id.trim().toUpperCase();
        const personName = person_name.trim();
        const contactEmail = email ? email.trim().toLowerCase() : null;

        // Check company exists
        const [companyRows] = await pool.query(
            "SELECT company_id FROM company_details WHERE company_id = ?",
            [companyId]
        );

        if (companyRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Company not found"
            });
        }

        // Create contact
        const [result] = await pool.query(
            `
            INSERT INTO company_contact_details
            (
                company_id,
                person_name,
                designation,
                contact_number,
                email,
                department
            )
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                companyId,
                personName,
                designation || null,
                contact_number || null,
                contactEmail,
                department || null
            ]
        );

        // Add email to email_list
        if (contactEmail) {
            await pool.query(
                `
                INSERT IGNORE INTO email_list (email)
                VALUES (?)
                `,
                [contactEmail]
            );
        }

        return res.status(201).json({
            success: true,
            message: "Contact created successfully",
            data: {
                id: result.insertId,
                company_id: companyId,
                person_name: personName,
                designation: designation || null,
                contact_number: contact_number || null,
                department: department || null,
                email: contactEmail
            }
        });

    } catch (error) {
        console.error("Create Contact Error:", error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * PUT /api/companies/contacts/:id
 * Update an existing contact
 */
const updateContact = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            company_id,
            person_name,
            designation,
            contact_number,
            email,
            department
        } = req.body;

        // Fetch old data first
        const [oldRows] = await pool.query(
            'SELECT * FROM company_contact_details WHERE id = ?',
            [id]
        );

        if (oldRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        const oldData = oldRows[0];

        // Build update query dynamically
        const updates = [];
        const values = [];

        // Company ID
        if (company_id !== undefined) {
            if (!company_id || typeof company_id !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Company ID is required'
                });
            }

            const companyId = company_id.trim().toUpperCase();

            // Check company exists
            const [companyRows] = await pool.query(
                'SELECT company_id FROM company_details WHERE company_id = ?',
                [companyId]
            );

            if (companyRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Company not found'
                });
            }

            updates.push('company_id = ?');
            values.push(companyId);
        }

        // Person name
        if (person_name !== undefined) {
            if (!person_name || person_name.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Person name is required'
                });
            }

            updates.push('person_name = ?');
            values.push(person_name.trim());
        }

        // Designation
        if (designation !== undefined) {
            updates.push('designation = ?');
            values.push(designation || null);
        }

        // Contact number
        if (contact_number !== undefined) {
            updates.push('contact_number = ?');
            values.push(contact_number || null);
        }

        // Email
        let contactEmail;

        if (email !== undefined) {
            contactEmail = email
                ? email.trim().toLowerCase()
                : null;

            updates.push('email = ?');
            values.push(contactEmail);
        }

        // Department
        if (department !== undefined) {
            updates.push('department = ?');
            values.push(department || null);
        }

        // Nothing to update
        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No fields to update'
            });
        }

        values.push(id);

        // Update contact
        await pool.query(
            `UPDATE company_contact_details
             SET ${updates.join(', ')}
             WHERE id = ?`,
            values
        );

        // Add updated email to email_list
        if (email !== undefined && contactEmail) {
            await pool.query(
                `INSERT IGNORE INTO email_list (email)
                 VALUES (?)`,
                [contactEmail]
            );
        }

        // Fetch updated data
        const [newRows] = await pool.query(
            'SELECT * FROM company_contact_details WHERE id = ?',
            [id]
        );

        const newData = newRows[0];

        // Audit log
        await logAudit(
            'company_contact_details',
            Number(id),
            'UPDATE',
            oldData,
            newData,
            req
        );

        return res.status(200).json({
            success: true,
            message: 'Contact updated successfully',
            data: newData
        });

    } catch (error) {
        console.error('Update Contact Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * DELETE /api/companies/contacts/:id
 * Delete a contact by ID
 */
const deleteContact = async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch old data first
        const [oldRows] = await pool.query(
            'SELECT * FROM company_contact_details WHERE id = ? AND status = 1',
            [id]
        );

        if (oldRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found or already deleted'
            });
        }

        const oldData = oldRows[0];

        // Soft delete: change status from 1 to 0
        await pool.query(
            'UPDATE company_contact_details SET status = 0 WHERE id = ?',
            [id]
        );

        // Create audit log
        await logAudit(
            'company_contact_details',
            Number(id),
            'DELETE',
            oldData,
            {
                ...oldData,
                status: 0
            },
            req
        );

        return res.status(200).json({
            success: true,
            message: 'Contact deleted successfully',
            data: {
                ...oldData,
                status: 0
            }
        });

    } catch (error) {
        console.error('Delete Contact Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const restoreContact = async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch deleted contact first
        const [oldRows] = await pool.query(
            `SELECT *
             FROM company_contact_details
             WHERE id = ? AND status = 0`,
            [id]
        );

        if (oldRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Contact restored alredy'
            });
        }

        const oldData = oldRows[0];

        // Restore contact: change status from 0 to 1
        await pool.query(
            `UPDATE company_contact_details
             SET status = 1
             WHERE id = ? AND status = 0`,
            [id]
        );

        // New data after restore
        const newData = {
            ...oldData,
            status: 1
        };

        // Audit log
        await logAudit(
            'company_contact_details',
            Number(id),
            'RESTORE',
            oldData,
            newData,
            req
        );

        return res.status(200).json({
            success: true,
            message: 'Contact restored successfully',
            data: newData
        });

    } catch (error) {
        console.error('Restore Contact Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const getEmailList = async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT
                id,
                email,
                type,
                created_at
            FROM email_list
            ORDER BY created_at DESC
        `);

        return res.status(200).json({
            success: true,
            data: rows,
            message: 'Email list fetched successfully'
        });

    } catch (error) {
        console.error('Get Email List Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const deleteEmails = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'Email ID is required'
            });
        }

        // Fetch old data before deleting
        const [existingRows] = await pool.query(
            `SELECT * FROM email_list WHERE id = ?`,
            [id]
        );

        if (existingRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Email not found'
            });
        }

        const oldData = existingRows[0];

        // Delete email
        await pool.query(
            `DELETE FROM email_list WHERE id = ?`,
            [id]
        );

        // Audit log
        await logAudit(
            'email_list',
            Number(id),
            'DELETE',
            oldData,
            null,
            req
        );

        return res.status(200).json({
            success: true,
            message: 'Email deleted successfully',
            data: oldData
        });

    } catch (error) {
        console.error('Delete Email Error:', error);

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const createEmailListBulk = async (req, res) => {
    try {
        const { emails } = req.body;

        // --------------------------------------------------
        // Validate request
        // --------------------------------------------------
        if (!Array.isArray(emails) || emails.length === 0) {
            return res.status(400).json({
                success: false,
                message: "emails must be a non-empty array",
            });
        }

        const errors = [];
        const uniqueEmails = [];
        const seen = new Set();

        const allowedTypes = [
            "principal",
            "customer",
            "vendor",
        ];

        // --------------------------------------------------
        // Validate uploaded emails
        // --------------------------------------------------
        emails.forEach((value, index) => {

            const email =
                typeof value === "object" && value !== null
                    ? String(value.email ?? "")
                        .trim()
                        .toLowerCase()
                    : typeof value === "string"
                        ? value.trim().toLowerCase()
                        : "";

            const type =
                typeof value === "object" && value !== null
                    ? String(value.type ?? "principal")
                        .trim()
                        .toLowerCase()
                    : "principal";

            // Validate email
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                errors.push({
                    row: index + 1,
                    email,
                    message: "Invalid email address",
                });

                return;
            }

            // Validate type
            if (!allowedTypes.includes(type)) {
                errors.push({
                    row: index + 1,
                    email,
                    message:
                        "Type must be principal, customer, or vendor",
                });

                return;
            }

            // Duplicate inside upload
            if (seen.has(email)) {
                errors.push({
                    row: index + 1,
                    email,
                    message: "Duplicate email address in upload",
                });

                return;
            }

            seen.add(email);

            uniqueEmails.push({
                email,
                type,
                row: index + 1,
            });
        });

        // --------------------------------------------------
        // No valid emails
        // --------------------------------------------------
        if (!uniqueEmails.length) {
            return res.status(200).json({
                success: true,
                message: "No new email addresses to add",
                data: {
                    created: [],
                    errors,
                },
            });
        }

        // --------------------------------------------------
        // Check existing emails
        // --------------------------------------------------
        const [existingRows] = await pool.query(
            `SELECT email
             FROM email_list
             WHERE email IN (?)`,
            [uniqueEmails.map((entry) => entry.email)]
        );

        const existingEmails = new Set(
            existingRows.map((entry) =>
                String(entry.email).toLowerCase()
            )
        );

        // --------------------------------------------------
        // Remove existing emails
        // --------------------------------------------------
        const newEmails = uniqueEmails.filter((entry) => {

            if (existingEmails.has(entry.email)) {
                errors.push({
                    row: entry.row,
                    email: entry.email,
                    message: "Email address already exists",
                });

                return false;
            }

            return true;
        });

        // --------------------------------------------------
        // Nothing new
        // --------------------------------------------------
        if (!newEmails.length) {
            return res.status(200).json({
                success: true,
                message: "No new email addresses to add",
                data: {
                    created: [],
                    errors,
                },
            });
        }

        // --------------------------------------------------
        // Insert
        // --------------------------------------------------
        await pool.query(
            `INSERT INTO email_list (email, type)
             VALUES ?`,
            [
                newEmails.map((entry) => [
                    entry.email,
                    entry.type,
                ]),
            ]
        );

        // --------------------------------------------------
        // Fetch inserted records
        // --------------------------------------------------
        const [insertedRows] = await pool.query(
            `SELECT *
             FROM email_list
             WHERE email IN (?)`,
            [newEmails.map((entry) => entry.email)]
        );

        console.log(
            "Inserted email records:",
            insertedRows
        );

        // --------------------------------------------------
        // AUDIT LOGS
        // --------------------------------------------------
        for (const emailData of insertedRows) {

            try {

                console.log(
                    `Creating audit log for email ID ${emailData.id}`
                );

                await logAudit(
                    "email_list",
                    Number(emailData.id),
                    "INSERT",
                    null,
                    emailData,
                    req
                );

                console.log(
                    `Audit log created for email ID ${emailData.id}`
                );

            } catch (auditError) {

                console.error(
                    `Audit log failed for email ID ${emailData.id}:`,
                    auditError
                );
            }
        }

        // --------------------------------------------------
        // Response
        // --------------------------------------------------
        return res.status(201).json({
            success: true,
            message: `${insertedRows.length} email address(es) added`,
            data: {
                created: insertedRows.map((entry) => ({
                    id: entry.id,
                    email: entry.email,
                    type: entry.type,
                    created_at: entry.created_at,
                })),
                errors,
            },
        });

    } catch (error) {

        console.error(
            "Create Email List Bulk Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    getCompanies,
    getCompanyById,
    createCompany,
    updateCompany,
    deleteCompany,
    getAllContacts,
    getContactsByCompanyId,
    getContactbyId,
    createContact,
    updateContact,
    deleteContact,
    getEmailList,
    createEmailListBulk,
    deleteEmails,
    restoreContact
};
