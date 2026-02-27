# Design Document - Admin Profiles Module

## Overview

El módulo de Administración de Perfiles es un sistema integral para gestionar usuarios, perfiles de acceso y unidades de negocio dentro del sistema de inventario CoffeeSoft. El diseño sigue la arquitectura MVC del framework CoffeeSoft, utilizando componentes reutilizables, TailwindCSS para estilos y jQuery para interactividad.

El módulo se compone de tres secciones principales navegables mediante tabs:
1. **Usuarios** - Gestión completa de usuarios del sistema
2. **Perfiles** - Administración de perfiles de acceso y permisos
3. **UDN** - Gestión de Unidades de Negocio

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           admin.js (Frontend Controller)              │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │  │
│  │  │    App     │  │   Users    │  │  Profiles  │     │  │
│  │  │  (Main)    │  │  (Class)   │  │  (Class)   │     │  │
│  │  └────────────┘  └────────────┘  └────────────┘     │  │
│  │         │               │               │            │  │
│  │         └───────────────┴───────────────┘            │  │
│  │                     │                                 │  │
│  │              CoffeeSoft.js                           │  │
│  │         (Templates, Components)                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                    AJAX (useFetch)
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Server (PHP Backend)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         ctrl-admin.php (Controller)                   │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  init() | lsUsers() | addUser() | editUser()   │  │  │
│  │  │  lsProfiles() | addProfile() | editProfile()   │  │  │
│  │  │  lsUDN() | addUDN() | editUDN() | deleteUDN()  │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │          mdl-admin.php (Model)                        │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  listUsers() | createUser() | updateUser()     │  │  │
│  │  │  getUserById() | existsUserByUsername()        │  │  │
│  │  │  listProfiles() | createProfile()              │  │  │
│  │  │  listUDN() | createUDN() | deleteUDNById()     │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│                      CRUD Class                              │
│                            │                                 │
└─────────────────────────────────────────────────────────────┘
                            │
                    MySQL Database
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Database Tables                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    users     │  │   profiles   │  │     udn      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────────────────────────────────────────┐     │
│  │           user_profiles (junction)               │     │
│  └──────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend**: jQuery, TailwindCSS, CoffeeSoft Framework
- **Backend**: PHP 7.4+, Session Management
- **Database**: MySQL 5.7+
- **Architecture Pattern**: MVC (Model-View-Controller)
- **Communication**: AJAX (useFetch wrapper)

## Components and Interfaces

### Frontend Components (admin.js)

#### 1. App Class (Main Controller)
```javascript
class App extends Templates {
    constructor(link, div_modulo)
    PROJECT_NAME: "Admin"
    
    Methods:
    - render()           // Inicializa el módulo completo
    - layout()           // Crea estructura principal con tabs
    - layoutTabs()       // Configura navegación por pestañas
}
```

#### 2. Users Class
```javascript
class Users extends Templates {
    constructor(link, div_modulo)
    PROJECT_NAME: "Users"
    
    Methods:
    - render()              // Inicializa sección de usuarios
    - layout()              // Estructura de la vista
    - filterBarUsers()      // Barra de filtros
    - lsUsers()             // Lista usuarios en tabla
    - addUser()             // Modal para crear usuario
    - editUser(id)          // Modal para editar usuario
    - deleteUser(id)        // Confirmación y eliminación
    - jsonUser()            // Definición de formulario
}
```

#### 3. Profiles Class
```javascript
class Profiles extends Templates {
    constructor(link, div_modulo)
    PROJECT_NAME: "Profiles"
    
    Methods:
    - render()              // Inicializa sección de perfiles
    - layout()              // Estructura de la vista
    - filterBarProfiles()   // Barra de filtros
    - lsProfiles()          // Lista perfiles en tabla
    - addProfile()          // Modal para crear perfil
    - editProfile(id)       // Modal para editar perfil
    - statusProfile(id)     // Cambiar estado activo/inactivo
    - jsonProfile()         // Definición de formulario
}
```

#### 4. UDN Class
```javascript
class UDN extends Templates {
    constructor(link, div_modulo)
    PROJECT_NAME: "UDN"
    
    Methods:
    - render()              // Inicializa sección de UDN
    - layout()              // Estructura de la vista
    - filterBarUDN()        // Barra de filtros
    - lsUDN()               // Lista UDN en tabla
    - addUDN()              // Modal para crear UDN
    - editUDN(id)           // Modal para editar UDN
    - deleteUDN(id)         // Confirmación y eliminación
    - jsonUDN()             // Definición de formulario
}
```

### Backend Components

#### Controller (ctrl-admin.php)
```php
class ctrl extends mdl {
    
    // Inicialización
    init()                  // Retorna datos para filtros
    
    // Usuarios
    lsUsers()              // Lista usuarios con filtros
    getUser()              // Obtiene usuario por ID
    addUser()              // Crea nuevo usuario
    editUser()             // Actualiza usuario
    deleteUser()           // Elimina usuario
    
    // Perfiles
    lsProfiles()           // Lista perfiles con filtros
    getProfile()           // Obtiene perfil por ID
    addProfile()           // Crea nuevo perfil
    editProfile()          // Actualiza perfil
    statusProfile()        // Cambia estado del perfil
    
    // UDN
    lsUDN()                // Lista UDN con filtros
    getUDN()               // Obtiene UDN por ID
    addUDN()               // Crea nueva UDN
    editUDN()              // Actualiza UDN
    deleteUDN()            // Elimina UDN
}
```

#### Model (mdl-admin.php)
```php
class mdl extends CRUD {
    
    // Usuarios
    listUsers($array)              // SELECT usuarios con filtros
    getUserById($array)            // SELECT usuario específico
    existsUserByUsername($array)   // Valida unicidad de username
    createUser($array)             // INSERT nuevo usuario
    updateUser($array)             // UPDATE usuario
    deleteUserById($array)         // DELETE usuario
    
    // Perfiles
    listProfiles($array)           // SELECT perfiles con filtros
    getProfileById($array)         // SELECT perfil específico
    createProfile($array)          // INSERT nuevo perfil
    updateProfile($array)          // UPDATE perfil
    
    // UDN
    listUDN($array)                // SELECT UDN con filtros
    getUDNById($array)             // SELECT UDN específica
    createUDN($array)              // INSERT nueva UDN
    updateUDN($array)              // UPDATE UDN
    deleteUDNById($array)          // DELETE UDN
    
    // Asignaciones
    assignProfileToUser($array)    // INSERT en user_profiles
    removeProfileFromUser($array)  // DELETE de user_profiles
    getUserProfiles($array)        // SELECT perfiles de usuario
}
```

### CoffeeSoft Components Used

1. **primaryLayout()** - Estructura principal del módulo
2. **tabLayout()** - Navegación por pestañas
3. **createfilterBar()** - Barras de filtros dinámicas
4. **createTable()** - Tablas con DataTables
5. **createModalForm()** - Formularios modales
6. **swalQuestion()** - Diálogos de confirmación
7. **alert()** - Notificaciones de éxito/error

## Data Models

### Database Schema

#### Table: users
```sql
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password VARCHAR(255) NOT NULL,
    active TINYINT(1) DEFAULT 1,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME NULL,
    INDEX idx_username (username),
    INDEX idx_active (active)
);
```

#### Table: profiles
```sql
CREATE TABLE profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    active TINYINT(1) DEFAULT 1,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_active (active)
);
```

#### Table: udn (Business Units)
```sql
CREATE TABLE udn (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL,
    description TEXT,
    active TINYINT(1) DEFAULT 1,
    date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_code (code),
    INDEX idx_active (active)
);
```

#### Table: user_profiles (Junction Table)
```sql
CREATE TABLE user_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    profile_id INT NOT NULL,
    assigned_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_profile (user_id, profile_id)
);
```

### Data Flow

#### User Creation Flow
```
1. Admin clicks "Nuevo Usuario"
2. Frontend: createModalForm() displays form
3. Admin fills: username, full_name, email, password
4. Frontend: Validates required fields
5. Frontend: useFetch({ opc: "addUser", ...data })
6. Backend: ctrl->addUser()
7. Backend: Validates username uniqueness
8. Backend: mdl->createUser()
9. Backend: Returns { status: 200, message: "..." }
10. Frontend: alert() success notification
11. Frontend: lsUsers() refreshes table
```

#### Profile Assignment Flow
```
1. Admin clicks assign profile icon on user row
2. Frontend: Displays available profiles modal
3. Admin selects profile and confirms
4. Frontend: useFetch({ opc: "assignProfile", user_id, profile_id })
5. Backend: ctrl->assignProfile()
6. Backend: mdl->assignProfileToUser()
7. Backend: Returns success status
8. Frontend: Updates user row with profile badge
9. Frontend: alert() confirmation
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After reviewing all testable criteria, the following consolidations were identified:

**Redundancies to eliminate:**
- Properties 2.2, 3.2, 4.2 (field display) can be consolidated into a single "Entity list display completeness" property
- Properties 8.1, 8.2, 8.3 (feedback notifications) can be consolidated into a single "Action feedback" property
- Properties 10.1, 10.2, 10.3 (responsive layouts) can be consolidated into a single "Responsive design" property

**Properties to combine:**
- User CRUD operations (2.4, 2.7, 2.9) → "User CRUD operations maintain data integrity"
- Profile CRUD operations (3.4, 3.6) → "Profile CRUD operations maintain data integrity"
- UDN CRUD operations (4.4, 4.6, 4.8) → "UDN CRUD operations maintain data integrity"

### Correctness Properties

Property 1: Dashboard metrics accuracy
*For any* system state, when the dashboard loads, all displayed metrics (total users, active users, profiles count, UDN count) should match the actual counts in the database
**Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**

Property 2: Entity list display completeness
*For any* entity type (users, profiles, UDN), when displaying a list, all required fields for that entity type should be present in each row
**Validates: Requirements 2.2, 3.2, 4.2**

Property 3: User creation with unique username
*For any* valid user data with a unique username, creating the user should succeed and the user should appear in the users list
**Validates: Requirements 2.4**

Property 4: Duplicate username prevention
*For any* username that already exists in the system, attempting to create a new user with that username should fail with an appropriate error message
**Validates: Requirements 2.5**

Property 5: User data persistence
*For any* user, after editing and saving changes, retrieving that user's data should return the updated values
**Validates: Requirements 2.7**

Property 6: User deletion completeness
*For any* user, after confirming deletion, that user should no longer appear in the users list and should not exist in the database
**Validates: Requirements 2.9**

Property 7: Profile creation and retrieval
*For any* valid profile data, creating the profile should succeed and retrieving it should return the same data
**Validates: Requirements 3.4**

Property 8: Profile status toggle
*For any* profile, toggling its status from active to inactive and back should result in the original active state
**Validates: Requirements 3.8**

Property 9: UDN creation and retrieval
*For any* valid UDN data, creating the UDN should succeed and retrieving it should return the same data
**Validates: Requirements 4.4**

Property 10: UDN deletion completeness
*For any* UDN, after confirming deletion, that UDN should no longer appear in the UDN list and should not exist in the database
**Validates: Requirements 4.8**

Property 11: Profile assignment persistence
*For any* user and profile combination, after assigning the profile to the user, retrieving the user's profiles should include that profile
**Validates: Requirements 5.3, 5.4**

Property 12: Profile removal completeness
*For any* user with an assigned profile, after removing that profile, retrieving the user's profiles should not include that profile
**Validates: Requirements 5.5**

Property 13: Filter application and clearing
*For any* list view (users, profiles, UDN), applying a filter should reduce or maintain the number of displayed records, and clearing the filter should restore the original full list
**Validates: Requirements 6.3, 6.4**

Property 14: Search filtering accuracy
*For any* search criteria, all displayed results should match the search criteria, and all matching records in the database should be displayed
**Validates: Requirements 6.2**

Property 15: Required field validation
*For any* form with required fields, submitting with any required field empty should prevent submission and highlight the empty field
**Validates: Requirements 7.1**

Property 16: Email format validation
*For any* email input, if the format is invalid (does not match email regex pattern), the system should display a validation error
**Validates: Requirements 7.2**

Property 17: Username format validation
*For any* username containing special characters (not alphanumeric or underscore), the system should prevent submission and show allowed format
**Validates: Requirements 7.3**

Property 18: Password length validation
*For any* password shorter than the minimum required length (8 characters), the system should display password requirements
**Validates: Requirements 7.4**

Property 19: Valid form submission
*For any* form where all validation rules pass, the system should allow submission and process the request
**Validates: Requirements 7.5**

Property 20: Action feedback consistency
*For any* user action (create, update, delete), the system should display appropriate feedback (loading indicator during processing, success notification on completion, or error notification on failure)
**Validates: Requirements 8.1, 8.2, 8.3**

Property 21: Session validation on access
*For any* attempt to access the admin module, the system should validate the session cookie and only allow access if the session is valid
**Validates: Requirements 9.1, 9.3**

Property 22: Invalid session handling
*For any* invalid or expired session, attempting to access the admin module should redirect to the logout page
**Validates: Requirements 9.2**

Property 23: Responsive layout adaptation
*For any* viewport size (mobile, tablet, desktop), the interface should adapt appropriately with all content remaining accessible and usable
**Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

## Error Handling

### Frontend Error Handling

1. **Network Errors**
   - Catch failed AJAX requests
   - Display user-friendly error messages
   - Provide retry options for transient failures

2. **Validation Errors**
   - Highlight invalid fields in forms
   - Display specific validation messages
   - Prevent form submission until valid

3. **Session Errors**
   - Detect expired sessions
   - Redirect to login page
   - Preserve user's intended action for post-login redirect

### Backend Error Handling

1. **Database Errors**
   - Catch SQL exceptions
   - Log errors for debugging
   - Return generic error messages to frontend (don't expose SQL details)

2. **Validation Errors**
   - Validate all inputs server-side
   - Return specific validation error messages
   - Use HTTP status codes appropriately (400 for validation, 409 for conflicts)

3. **Authentication Errors**
   - Validate session on every request
   - Return 401 for unauthorized access
   - Log security-related errors

### Error Response Format

All backend responses follow this structure:
```json
{
    "status": 200|400|401|403|404|409|500,
    "message": "Human-readable message",
    "data": {} // Optional, only on success
}
```

## Testing Strategy

### Unit Testing

Unit tests will cover:
- Individual model methods (CRUD operations)
- Controller validation logic
- Data transformation functions
- Helper functions (renderStatus, dropdown, etc.)

**Example unit tests:**
- `testCreateUserWithValidData()` - Verify user creation with valid input
- `testCreateUserWithDuplicateUsername()` - Verify duplicate prevention
- `testGetUserById()` - Verify user retrieval
- `testUpdateUserEmail()` - Verify email update
- `testDeleteUser()` - Verify user deletion
- `testAssignProfileToUser()` - Verify profile assignment
- `testRemoveProfileFromUser()` - Verify profile removal

### Property-Based Testing

Property-based tests will use **fast-check** (JavaScript) for frontend and **PHPUnit with Faker** for backend testing. Each test will run a minimum of 100 iterations with randomly generated data.

**Configuration:**
```javascript
// Frontend (fast-check)
fc.assert(
    fc.property(fc.record({...}), (data) => {
        // Test property
    }),
    { numRuns: 100 }
);
```

```php
// Backend (PHPUnit)
for ($i = 0; $i < 100; $i++) {
    $faker = Faker\Factory::create();
    // Generate random data and test
}
```

**Property-based tests to implement:**

1. **Property 3: User creation with unique username**
   - Generate random valid user data with unique usernames
   - Verify each creation succeeds
   - **Feature: admin-profiles, Property 3: User creation with unique username**

2. **Property 4: Duplicate username prevention**
   - Create a user, then attempt to create another with same username
   - Verify second creation fails
   - **Feature: admin-profiles, Property 4: Duplicate username prevention**

3. **Property 5: User data persistence**
   - Generate random user updates
   - Verify updates are persisted correctly
   - **Feature: admin-profiles, Property 5: User data persistence**

4. **Property 6: User deletion completeness**
   - Create random users and delete them
   - Verify they no longer exist
   - **Feature: admin-profiles, Property 6: User deletion completeness**

5. **Property 8: Profile status toggle**
   - Generate random profiles
   - Toggle status twice and verify return to original state
   - **Feature: admin-profiles, Property 8: Profile status toggle**

6. **Property 11: Profile assignment persistence**
   - Generate random user-profile pairs
   - Assign and verify assignment persists
   - **Feature: admin-profiles, Property 11: Profile assignment persistence**

7. **Property 12: Profile removal completeness**
   - Assign random profiles to users, then remove them
   - Verify removal is complete
   - **Feature: admin-profiles, Property 12: Profile removal completeness**

8. **Property 13: Filter application and clearing**
   - Apply random filters to lists
   - Verify filtering works and clearing restores full list
   - **Feature: admin-profiles, Property 13: Filter application and clearing**

9. **Property 16: Email format validation**
   - Generate random invalid email formats
   - Verify all are rejected
   - **Feature: admin-profiles, Property 16: Email format validation**

10. **Property 17: Username format validation**
    - Generate random usernames with special characters
    - Verify all are rejected
    - **Feature: admin-profiles, Property 17: Username format validation**

### Integration Testing

Integration tests will verify:
- Complete user workflows (create → edit → delete)
- Profile assignment workflows
- Filter and search functionality
- Session management across requests

### Testing Requirements

- All property-based tests MUST run minimum 100 iterations
- Each property test MUST be tagged with: `**Feature: admin-profiles, Property {number}: {property_text}**`
- Each correctness property MUST be implemented by a SINGLE property-based test
- Unit tests and property tests are complementary and both MUST be included

## Security Considerations

1. **Authentication**
   - Session validation on every request
   - Secure session cookie with HttpOnly flag
   - Session timeout after inactivity

2. **Authorization**
   - Role-based access control
   - Verify admin permissions before sensitive operations
   - Log all administrative actions

3. **Input Validation**
   - Server-side validation for all inputs
   - SQL injection prevention via prepared statements
   - XSS prevention via output escaping

4. **Password Security**
   - Hash passwords using bcrypt or Argon2
   - Minimum password length: 8 characters
   - Never store or transmit passwords in plain text

5. **CSRF Protection**
   - Implement CSRF tokens for state-changing operations
   - Validate tokens on backend

## Performance Considerations

1. **Database Optimization**
   - Index frequently queried columns (username, email, active status)
   - Use pagination for large result sets
   - Optimize JOIN queries for profile assignments

2. **Frontend Optimization**
   - Lazy load tabs (only load data when tab is activated)
   - Debounce search inputs to reduce server requests
   - Cache filter options (status lists, etc.)

3. **Caching Strategy**
   - Cache user session data
   - Cache profile lists (invalidate on changes)
   - Use browser caching for static assets

## Deployment Considerations

1. **File Structure**
   ```
   inventory/admin/
   ├── index.php
   ├── ctrl/
   │   └── ctrl-admin.php
   ├── mdl/
   │   └── mdl-admin.php
   └── js/
       └── admin.js
   ```

2. **Dependencies**
   - CoffeeSoft framework (src/js/coffeeSoft.js)
   - jQuery 3.x
   - TailwindCSS
   - DataTables plugin
   - SweetAlert2

3. **Configuration**
   - Database connection via existing conf/_CRUD.php
   - Session configuration in PHP
   - API endpoint: ctrl/ctrl-admin.php

4. **Migration Steps**
   - Create database tables (users, profiles, udn, user_profiles)
   - Deploy backend files (ctrl, mdl)
   - Deploy frontend files (index.php, js)
   - Configure permissions
   - Test in staging environment
   - Deploy to production

## Future Enhancements

1. **Audit Log**
   - Track all administrative actions
   - Store who, what, when for compliance

2. **Advanced Permissions**
   - Granular permission system
   - Permission inheritance
   - Custom permission sets

3. **Bulk Operations**
   - Bulk user import/export
   - Bulk profile assignments
   - Bulk status changes

4. **User Activity Monitoring**
   - Last login tracking
   - Active session management
   - Login history

5. **Profile Templates**
   - Pre-configured profile templates
   - Clone existing profiles
   - Profile comparison tool
