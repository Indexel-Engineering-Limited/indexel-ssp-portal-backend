const express = require('express');
const router = express.Router();
const { getCompanies, getCompanyById, createCompany, updateCompany, deleteCompany, getAllContacts, getContactsByCompanyId, getContactbyId, createContact, getEmailList, createEmailListBulk,updateContact,deleteContact,deleteEmails,restoreContact,updateEmailType} = require('../controllers/company.controller');
const { authenticate, authorizeRoles } = require('../middlewares/auth.middleware');
const { checkPermission } = require('../middlewares/permission.middleware');

// Company routes - require 'company_list' permission
router.get('/', authenticate, checkPermission('company_list', 'read'), getCompanies);
router.get("/all_contacts", authenticate, checkPermission('contacts', 'read'), getAllContacts);
router.get('/emails', authenticate, checkPermission('email_list', 'read'), getEmailList);
router.get('/:id', authenticate, checkPermission('company_list', 'read'), getCompanyById);
router.post('/', authenticate, checkPermission('company_list', 'write'), createCompany);
router.put('/:id', authenticate, checkPermission('company_list', 'write'), updateCompany);
router.delete('/:id', authenticate, authorizeRoles('ADMIN'), deleteCompany);

// Contact routes - require 'contacts' permission

router.get('/company/contacts/:id', authenticate, checkPermission('contacts', 'read'), getContactsByCompanyId);
router.get('/contact/:id', authenticate, checkPermission('contacts', 'read'), getContactbyId);
router.post('/create_company_contact', authenticate, checkPermission('contacts', 'write'), createContact);

// Email list routes - require 'email_list' permission
router.put(
    '/contact/:id',
    authenticate,
    checkPermission('contacts', 'write'),
    updateContact
);

// NEW: Delete contact by ID
router.delete(
    '/contact/:id',
    authenticate,
    checkPermission('contacts', 'write'),
    deleteContact
);
router.put(
    '/contact/restore/:id',
    authenticate,
    checkPermission('audit_logs', 'write'),
    restoreContact
    
);



router.post('/emails/bulk', authenticate, checkPermission('email_list', 'write'), createEmailListBulk);
router.delete('/email/:id',authenticate,checkPermission('email_list', 'write'),deleteEmails);
router.put('/emails/:id/type',authenticate,checkPermission('email_list', 'write'), updateEmailType);

module.exports = router;
