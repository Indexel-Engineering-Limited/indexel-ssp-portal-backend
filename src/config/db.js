const mysql = require('mysql2/promise');
const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = require('./env');

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

const connectDB = async () => {
  const connection = await pool.getConnection();
  console.log(`MySQL connected: ${DB_HOST}/${DB_NAME}`);

  // Create companies table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      name       VARCHAR(255) NOT NULL,
      email      VARCHAR(255) NOT NULL UNIQUE,
      phone      VARCHAR(20)  DEFAULT NULL,
      address    TEXT         DEFAULT NULL,
      website    VARCHAR(255) DEFAULT NULL,
      industry   VARCHAR(100) DEFAULT NULL,
      created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Create audit_logs table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      table_name    VARCHAR(100)  NOT NULL,
      record_id     INT           NOT NULL,
      action        ENUM('INSERT', 'UPDATE', 'DELETE') NOT NULL,
      user_id       INT           DEFAULT NULL,
      user_email    VARCHAR(255)  DEFAULT NULL,
      old_data      JSON          DEFAULT NULL,
      new_data      JSON          DEFAULT NULL,
      changes       JSON          DEFAULT NULL,
      ip_address    VARCHAR(45)   DEFAULT NULL,
      user_agent    TEXT          DEFAULT NULL,
      created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_table_record (table_name, record_id),
      INDEX idx_action (action),
      INDEX idx_created (created_at)
    )
  `);

  // Create permissions table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS permissions (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      module_key  VARCHAR(50)   NOT NULL UNIQUE,
      module_name VARCHAR(100)  NOT NULL,
      icon        VARCHAR(50)   DEFAULT NULL,
      description TEXT          DEFAULT NULL,
      created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Create user_permissions table (junction table)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      user_id       INT           NOT NULL,
      permission_id INT           NOT NULL,
      can_read      BOOLEAN       DEFAULT TRUE,
      can_write     BOOLEAN       DEFAULT FALSE,
      created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_permission (user_id, permission_id),
      INDEX idx_user_id (user_id),
      INDEX idx_permission_id (permission_id)
    )
  `);

  // Seed default permissions for sidebar tabs
  await connection.query(`
    INSERT IGNORE INTO permissions (module_key, module_name, icon, description) VALUES
    ('dashboard', 'Dashboard', 'dashboard', 'View dashboard and analytics'),
    ('company_list', 'Company List', 'corporate_fare', 'Manage company details'),
    ('contacts', 'Contacts', 'contacts', 'Manage company contacts'),
    ('email_list', 'Email List', 'mail', 'Manage email lists'),
    ('bulk_upload', 'Bulk Upload', 'upload_file', 'Upload data in bulk'),
    ('user_access', 'User Access', 'manage_accounts', 'Manage user permissions'),
    ('user_logs', 'User Logs', 'history', 'View audit logs and user activity')
  `);

  connection.release();
  console.log('Database tables initialized');
};

module.exports = { pool, connectDB };
