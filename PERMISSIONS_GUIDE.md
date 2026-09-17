# Permission-Based Access Control System

## Overview
Complete granular permission system for managing user access to sidebar tabs with read/write controls.

---

## Database Tables

### `permissions`
Stores all available modules/features in the system.

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| module_key | VARCHAR(50) | Unique identifier (e.g., 'company_list') |
| module_name | VARCHAR(100) | Display name (e.g., 'Company List') |
| icon | VARCHAR(50) | Material icon name |
| description | TEXT | Module description |

**Default Modules:**
- `dashboard` - Dashboard
- `company_list` - Company List
- `contacts` - Contacts
- `email_list` - Email List
- `bulk_upload` - Bulk Upload
- `user_access` - User Access
- `user_logs` - User Logs

### `user_permissions`
Junction table linking users to their permissions.

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary key |
| user_id | INT | Foreign key to users |
| permission_id | INT | Foreign key to permissions |
| can_read | BOOLEAN | Can view data (default: TRUE) |
| can_write | BOOLEAN | Can create/update data (default: FALSE) |

**Unique constraint:** (user_id, permission_id)

---

## How It Works

### 1. **ADMIN Role**
- Admins have **full access** to all modules automatically
- Their permissions **cannot be modified** via the API
- They bypass all permission checks

### 2. **Non-Admin Users**
- Must be explicitly granted permissions via `user_permissions` table
- Each permission has two levels:
  - **Read**: Can view data
  - **Write**: Can create/update data
- No permission record = no access to that module

---

## API Endpoints

### Permission Management (Admin Only)

#### Get All Available Permissions
```http
GET /api/permissions
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "module_key": "dashboard",
      "module_name": "Dashboard",
      "icon": "dashboard",
      "description": "View dashboard and analytics"
    }
  ]
}
```

---

#### Get User's Permissions
```http
GET /api/permissions/user/:userId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 5,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "USER"
    },
    "permissions": [
      {
        "id": 2,
        "module_key": "company_list",
        "module_name": "Company List",
        "icon": "corporate_fare",
        "can_read": true,
        "can_write": false
      }
    ]
  }
}
```

---

#### Assign Permissions to User
```http
POST /api/permissions/assign
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": 5,
  "permissions": [
    {
      "permissionId": 2,
      "canRead": true,
      "canWrite": false
    },
    {
      "permissionId": 3,
      "canRead": true,
      "canWrite": true
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Permissions assigned successfully"
}
```

**Notes:**
- Uses `INSERT ... ON DUPLICATE KEY UPDATE` - safe to call multiple times
- Overwrites existing permissions
- Cannot modify ADMIN users

---

#### Update Single Permission
```http
PUT /api/permissions/update
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": 5,
  "permissionId": 2,
  "canRead": true,
  "canWrite": true
}
```

---

#### Revoke Permissions
```http
DELETE /api/permissions/revoke
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": 5,
  "permissionIds": [2, 3]
}
```

**Removes access completely to specified modules.**

---

### User-Facing Endpoints

#### Get My Permissions
```http
GET /api/permissions/my-permissions
Authorization: Bearer <token>
```

Returns the authenticated user's permissions.

---

#### Get Accessible Menu Items
```http
GET /api/permissions/menu
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "key": "dashboard",
      "name": "Dashboard",
      "icon": "dashboard",
      "canRead": true,
      "canWrite": false
    },
    {
      "key": "company_list",
      "name": "Company List",
      "icon": "corporate_fare",
      "canRead": true,
      "canWrite": true
    }
  ]
}
```

**Use this endpoint to:**
- Render the sidebar menu (only show accessible items)
- Disable write buttons if `canWrite: false`
- Hide entire modules if not in the list

---

## Protected Routes

All routes are now protected with `checkPermission(moduleKey, accessType)` middleware.

### Example: Company Routes

```javascript
// Read access required
router.get('/', authenticate, checkPermission('company_list', 'read'), getCompanies);

// Write access required
router.post('/', authenticate, checkPermission('company_list', 'write'), createCompany);
router.put('/:id', authenticate, checkPermission('company_list', 'write'), updateCompany);

// Admin only (bypasses permission system)
router.delete('/:id', authenticate, authorizeRoles('ADMIN'), deleteCompany);
```

### Module → Route Mapping

| Module Key | Routes Protected |
|------------|------------------|
| `company_list` | `/api/companies` (GET, POST, PUT) |
| `contacts` | `/api/companies/all_contacts`, `/api/companies/create_company_contact` |
| `email_list` | `/api/companies/emails` |
| `bulk_upload` | `/api/companies/emails/bulk` |
| `user_logs` | `/api/audit-logs/*` |
| `user_access` | `/api/permissions/*` (admin endpoints) |

---

## Login Response

When users log in, they receive their permissions immediately:

```json
{
  "success": true,
  "message": "Login successful",
  "token": "eyJhbGc...",
  "data": {
    "id": 5,
    "user_name": "john_doe",
    "name": "John Doe",
    "email_id": "john@example.com",
    "role": "USER",
    "permissions": [
      {
        "id": 2,
        "module_key": "company_list",
        "module_name": "Company List",
        "icon": "corporate_fare",
        "can_read": true,
        "can_write": false
      }
    ]
  }
}
```

**Frontend can cache this to avoid extra API calls.**

---

## Frontend Integration Guide

### 1. Store Permissions on Login
```javascript
const login = async (username, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_name: username, password })
  });
  
  const data = await response.json();
  
  // Store token
  localStorage.setItem('token', data.token);
  
  // Store permissions
  localStorage.setItem('permissions', JSON.stringify(data.data.permissions));
  
  return data;
};
```

---

### 2. Render Sidebar Menu
```javascript
const getAccessibleMenu = async () => {
  const response = await fetch('/api/permissions/menu', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const data = await response.json();
  return data.data; // Array of accessible menu items
};

// Render example
menuItems.forEach(item => {
  const menuItem = document.createElement('li');
  menuItem.innerHTML = `
    <span class="material-icons">${item.icon}</span>
    ${item.name}
  `;
  
  // Disable if read-only
  if (!item.canWrite) {
    menuItem.classList.add('read-only');
  }
  
  sidebar.appendChild(menuItem);
});
```

---

### 3. Check Permissions Before Actions
```javascript
const hasPermission = (moduleKey, accessType = 'read') => {
  const permissions = JSON.parse(localStorage.getItem('permissions') || '[]');
  const permission = permissions.find(p => p.module_key === moduleKey);
  
  if (!permission) return false;
  
  return accessType === 'read' ? permission.can_read : permission.can_write;
};

// Usage
if (hasPermission('company_list', 'write')) {
  showCreateButton();
} else {
  hideCreateButton();
}
```

---

## Common Scenarios

### Scenario 1: Give User Read-Only Access to Companies
```http
POST /api/permissions/assign

{
  "userId": 5,
  "permissions": [
    {
      "permissionId": 2,  // company_list
      "canRead": true,
      "canWrite": false
    }
  ]
}
```

**Result:** User can view companies but cannot create/update them.

---

### Scenario 2: Give User Full Access to Contacts
```http
POST /api/permissions/assign

{
  "userId": 5,
  "permissions": [
    {
      "permissionId": 3,  // contacts
      "canRead": true,
      "canWrite": true
    }
  ]
}
```

---

### Scenario 3: Upgrade User from Read to Write
```http
PUT /api/permissions/update

{
  "userId": 5,
  "permissionId": 2,
  "canRead": true,
  "canWrite": true  // Changed from false
}
```

---

### Scenario 4: Remove All Access
```http
DELETE /api/permissions/revoke

{
  "userId": 5,
  "permissionIds": [2, 3, 4]
}
```

---

## Error Responses

### 403 - No Permission
```json
{
  "success": false,
  "message": "Access denied. You do not have permission to access this module."
}
```

### 403 - Read-Only Access
```json
{
  "success": false,
  "message": "Access denied. You only have read-only access to this module."
}
```

---

## Best Practices

1. **Always use the `/menu` endpoint** to render the sidebar - don't hardcode menu items
2. **Cache permissions** from login response to avoid extra API calls
3. **Hide UI elements** users can't access - don't just disable them
4. **Check permissions on backend** - frontend checks are just for UX, not security
5. **Assign dashboard permission** to all users - it's the landing page
6. **Use write permission** for create, update, and delete actions
7. **Keep ADMIN users minimal** - use granular permissions for most users

---

## SQL Examples

### Get all users with company_list access:
```sql
SELECT u.id, u.name, u.email_id, up.can_read, up.can_write
FROM users u
INNER JOIN user_permissions up ON u.id = up.user_id
INNER JOIN permissions p ON up.permission_id = p.id
WHERE p.module_key = 'company_list';
```

### Give a user read access to all modules:
```sql
INSERT INTO user_permissions (user_id, permission_id, can_read, can_write)
SELECT 5, id, TRUE, FALSE FROM permissions;
```

### Remove all permissions for a user:
```sql
DELETE FROM user_permissions WHERE user_id = 5;
```

---

## Summary

✅ **7 default modules** seeded automatically
✅ **Granular read/write** permissions per module
✅ **ADMIN bypass** - admins have full access always
✅ **Protected routes** - middleware checks permissions
✅ **Menu endpoint** - frontend renders accessible items only
✅ **Permissions in login** - cached for offline checks
✅ **Audit trail** - all CRUD operations logged with user info

Your system is production-ready! 🚀
