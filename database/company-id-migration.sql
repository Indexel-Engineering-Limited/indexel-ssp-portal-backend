-- Run this once after backing up your database.
-- It adds IDs such as ULT001 to company_details and links contacts through it.

ALTER TABLE company_details
  ADD COLUMN company_id VARCHAR(6) NULL AFTER id,
  ADD UNIQUE KEY uq_company_details_company_id (company_id);

-- Populate company_id for all existing companies before running the next ALTER.
-- Example: UPDATE company_details SET company_id = 'ULT001' WHERE id = 1;

ALTER TABLE company_contact_details
  ADD COLUMN company_id VARCHAR(6) NULL AFTER id,
  ADD INDEX idx_company_contact_details_company_id (company_id),
  ADD CONSTRAINT fk_company_contact_company_id
    FOREIGN KEY (company_id) REFERENCES company_details(company_id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;

-- Backfill existing contacts before the API starts using company_id.
-- UPDATE company_contact_details c
-- JOIN company_details cd ON cd.id = c.company_details_id
-- SET c.company_id = cd.company_id;

-- After every existing company/contact has a company_id, make the new columns required.
-- ALTER TABLE company_details MODIFY company_id VARCHAR(6) NOT NULL;
-- ALTER TABLE company_contact_details MODIFY company_id VARCHAR(6) NOT NULL;

-- Do not drop company_details_id until you have confirmed all existing code and data
-- use company_id successfully.
