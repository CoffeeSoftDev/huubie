# Design Document - Módulo de Materiales

## Overview

El módulo de Materiales es un sistema CRUD completo para gestión de inventario que sigue la arquitectura MVC del framework CoffeeSoft. Utiliza jQuery para el frontend, PHP para el backend y MySQL para persistencia de datos. El diseño se basa en el pivote ADMIN con componentes reutilizables de CoffeeSoft incluyendo tablas dinámicas, formularios modales y filtros interactivos.

## Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer (JS)                      │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │   App      │  │  Templates   │  │   Components     │   │
│  │  (Main)    │──│  (CoffeeSoft)│──│   (CoffeeSoft)   │   │
│  └────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                    AJAX (useFetch)
                            │
┌─────────────────────────────────────────────────────────────┐
│                   Backend Layer (PHP)                        │
│  ┌────────────┐         ┌──────────────┐                   │
│  │    ctrl    │────────▶│     mdl      │                   │
│  │ (Controller)│         │   (Model)    │                   │
│  └────────────┘         └──────────────┘                   │
└─────────────────────────────────────────────────────────────┘
                            │
                         SQL Queries
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Database Layer (MySQL)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  mtto_almacen (main table)                           │  │
│  │  mtto_almacen_area (areas)                           │  │
│  │  mtto_categoria (categories)                         │  │
│  │  mtto_almacen_equipos (equipment)                    │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend**: jQuery 3.x, TailwindCSS 2.x, CoffeeSoft Framework
- **Backend**: PHP 7.4+, CRUD Class, Utileria Class
- **Database**: MySQL 5.7+
- **Components**: DataTables, SweetAlert2, Bootbox Modals

## Components and Interfaces

### Frontend Components (almacen.js)

#### Class: App (extends Templates)

**Properties:**
- `PROJECT_NAME`: "almacen"
- `_link`: "ctrl/ctrl-almacen.php"
- `_div_modulo`: "root"

**Methods:**

```javascript
render()
// Initializes the module layout, filter bar and material list

layout()
// Creates primary layout with filterBar and container using primaryLayout()

filterBar()
// Renders filter controls for Zone, Category, Area and Search using createfilterBar()

lsMateriales()
// Displays materials table with data from backend using createTable()

addMaterial()
// Opens modal form to register new material using createModalForm()

async editMaterial(id)
// Opens modal form with preloaded data to edit material using createModalForm()

deleteMaterial(id)
// Shows confirmation dialog and deletes material using swalQuestion()

jsonMaterial()
// Returns JSON structure for material form fields
```

### Backend Components

#### Controller (ctrl-almacen.php)

**Class: ctrl (extends mdl)**

**Methods:**

```php
init()
// Returns initial data for filters: zones, categories, areas
// Return: ['zones' => [], 'categories' => [], 'areas' => []]

lsMateriales()
// Lists materials with filters applied
// Input: $_POST['zone'], $_POST['category'], $_POST['area'], $_POST['search']
// Return: ['row' => [], 'total_value' => 0]

getMaterial()
// Gets single material by ID
// Input: $_POST['id']
// Return: ['status' => 200, 'message' => '', 'data' => []]

addMaterial()
// Creates new material with validation
// Input: $_POST (all material fields)
// Return: ['status' => 200|409|500, 'message' => '']

editMaterial()
// Updates existing material
// Input: $_POST['id'] + material fields
// Return: ['status' => 200|500, 'message' => '']

deleteMaterial()
// Permanently deletes material
// Input: $_POST['id']
// Return: ['status' => 200|500, 'message' => '']
```

#### Model (mdl-almacen.php)

**Class: mdl (extends CRUD)**

**Properties:**
- `$bd`: "rfwsmqex_mtto."
- `$util`: Utileria instance

**Methods:**

```php
lsZones()
// Returns list of zones for filter
// Return: [['id' => 1, 'valor' => 'HOTEL'], ...]

lsCategories()
// Returns list of categories for filter
// Return: [['id' => 1, 'valor' => 'PIEZAS'], ...]

lsAreas()
// Returns list of areas for filter
// Return: [['id' => 1, 'valor' => 'PAPELERIA'], ...]

listMateriales($filters)
// Lists materials with applied filters
// Input: ['zone' => '', 'category' => '', 'area' => '', 'search' => '']
// Return: Array of materials with all fields

getMaterialById($id)
// Gets single material by ID
// Input: [id]
// Return: Material array

existsMaterialByCode($code)
// Checks if material code already exists
// Input: [code]
// Return: boolean

createMaterial($data)
// Inserts new material
// Input: ['values' => '', 'data' => []]
// Return: boolean

updateMaterial($data)
// Updates material
// Input: ['values' => '', 'where' => 'id = ?', 'data' => []]
// Return: boolean

deleteMaterialById($id)
// Deletes material permanently
// Input: [id]
// Return: boolean
```

## Data Models

### Database Schema

#### Table: mtto_almacen (Main Materials Table)

```sql
CREATE TABLE mtto_almacen (
    idAlmacen INT PRIMARY KEY AUTO_INCREMENT,
    UDN_Almacen INT,
    CodigoEquipo VARCHAR(50) UNIQUE NOT NULL,
    Equipo VARCHAR(255) NOT NULL,
    Area INT,
    Estado INT DEFAULT 1,
    id_categoria INT,
    cantidad INT DEFAULT 0,
    Costo DOUBLE DEFAULT 0.00,
    PrecioVenta DOUBLE,
    TiempoDeVida TIMESTAMP,
    FechaIngreso TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    inventario_min INT,
    Resazon TEXT,
    Ruta VARCHAR(255),
    Archivo TEXT,
    Size DOUBLE,
    Type_File VARCHAR(10),
    Descripcion TEXT,
    Hora TIME,
    Fecha DATE,
    EstadoProducto INT,
    Observaciones TEXT,
    id_zona INT,
    rutaImagen TEXT,
    id_Proveedor INT,
    id_marca INT,
    
    FOREIGN KEY (id_zona) REFERENCES mtto_almacen_area(idArea),
    FOREIGN KEY (id_categoria) REFERENCES mtto_categoria(idcategoria),
    FOREIGN KEY (id_Proveedor) REFERENCES mtto_proveedores(idProveedor),
    FOREIGN KEY (id_marca) REFERENCES mtto_marca(idmarca)
);
```

#### Table: mtto_almacen_area (Areas)

```sql
CREATE TABLE mtto_almacen_area (
    idArea INT PRIMARY KEY AUTO_INCREMENT,
    Nombre_Area VARCHAR(100) NOT NULL
);
```

#### Table: mtto_categoria (Categories)

```sql
CREATE TABLE mtto_categoria (
    idcategoria INT PRIMARY KEY AUTO_INCREMENT,
    nombreCategoria VARCHAR(100) NOT NULL
);
```

#### Table: mtto_almacen_equipos (Equipment)

```sql
CREATE TABLE mtto_almacen_equipos (
    idEquipo INT PRIMARY KEY AUTO_INCREMENT,
    Nombre_Equipo VARCHAR(255) NOT NULL,
    min_stock INT DEFAULT 0
);
```

#### Table: mtto_proveedores (Suppliers)

```sql
CREATE TABLE mtto_proveedores (
    idProveedor INT PRIMARY KEY AUTO_INCREMENT,
    nombreProveedor TEXT NOT NULL
);
```

#### Table: mtto_marca (Brands)

```sql
CREATE TABLE mtto_marca (
    idmarca INT PRIMARY KEY AUTO_INCREMENT,
    Marca_producto VARCHAR(100)
);
```

### Data Flow

```
User Action → Frontend (jQuery) → AJAX Request → Controller (PHP) 
→ Model (PHP) → Database (MySQL) → Model → Controller 
→ JSON Response → Frontend → UI Update
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Material code uniqueness
*For any* material code, when attempting to create a new material, the system should reject the creation if another active material with the same code already exists
**Validates: Requirements 8.3**

### Property 2: Filter consistency
*For any* combination of filters (zone, category, area), the displayed materials should only include items that match all selected filter criteria
**Validates: Requirements 5.1, 5.2, 5.3**

### Property 3: Search partial matching
*For any* search query string, the system should return all materials where the code or name contains the search string as a substring (case-insensitive)
**Validates: Requirements 5.4**

### Property 4: Total value calculation
*For any* set of displayed materials, the total inventory value should equal the sum of (quantity × unit cost) for each material
**Validates: Requirements 6.1, 6.2**

### Property 5: Photo format validation
*For any* uploaded file, the system should accept the file only if its extension is JPG, PNG, or GIF and its size is less than or equal to 5MB
**Validates: Requirements 7.2, 7.3**

### Property 6: Required field validation
*For any* material form submission, the system should reject the submission if any required field (code, zone, name, category, area, quantity, cost) is empty or invalid
**Validates: Requirements 2.3**

### Property 7: Material deletion confirmation
*For any* material deletion request, the system should display a confirmation dialog containing the material code and name before executing the deletion
**Validates: Requirements 4.2**

### Property 8: Filter state persistence
*For any* sequence of filter selections, when the user changes one filter, all other previously selected filters should remain active
**Validates: Requirements 5.6**

### Property 9: Dynamic table update
*For any* CRUD operation (create, update, delete) on materials, the materials table should refresh automatically without requiring a full page reload
**Validates: Requirements 2.6, 3.5, 4.5**

### Property 10: Code format validation
*For any* material code input, the system should validate that the code matches the pattern AR-XX-XX-XXX where X represents alphanumeric characters
**Validates: Requirements 8.2**

### Property 11: Photo preview display
*For any* valid photo upload, the system should display a preview of the uploaded image in the form before submission
**Validates: Requirements 7.5**

### Property 12: Edit form data preload
*For any* material edit action, the edit modal should display all current field values of the selected material
**Validates: Requirements 3.1**

## Error Handling

### Frontend Error Handling

**Validation Errors:**
- Display inline error messages for invalid form fields
- Highlight required fields in red when empty
- Show SweetAlert notifications for validation failures

**Network Errors:**
- Display user-friendly error messages for failed AJAX requests
- Implement retry mechanism for transient failures
- Show loading indicators during async operations

**File Upload Errors:**
- Validate file type and size before upload
- Display specific error messages for invalid files
- Clear file input on validation failure

### Backend Error Handling

**Database Errors:**
- Log SQL errors to error log file
- Return generic error messages to frontend
- Implement transaction rollback for critical operations

**Validation Errors:**
- Return HTTP 400 status with descriptive error messages
- Validate all input data before database operations
- Sanitize user input to prevent SQL injection

**Business Logic Errors:**
- Return HTTP 409 for duplicate code violations
- Return HTTP 404 for non-existent materials
- Return HTTP 500 for unexpected server errors

### Error Response Format

```json
{
    "status": 400|404|409|500,
    "message": "Descriptive error message in Spanish",
    "data": null
}
```

## Testing Strategy

### Unit Testing

**Frontend Tests:**
- Test form validation logic
- Test filter combination logic
- Test data transformation functions
- Test event handlers

**Backend Tests:**
- Test controller methods with various inputs
- Test model CRUD operations
- Test validation functions
- Test error handling paths

**Test Cases:**
1. Create material with valid data
2. Create material with duplicate code
3. Create material with invalid photo format
4. Edit material with valid changes
5. Delete material with confirmation
6. Filter materials by single criterion
7. Filter materials by multiple criteria
8. Search materials by partial code
9. Search materials by partial name
10. Calculate total value with empty inventory
11. Calculate total value with multiple materials
12. Upload photo exceeding size limit
13. Upload photo with invalid format

### Integration Testing

**End-to-End Scenarios:**
1. Complete material registration flow
2. Material edit and update flow
3. Material deletion flow
4. Filter and search combination flow
5. Photo upload and display flow

**Database Integration:**
- Test foreign key constraints
- Test cascade operations
- Test transaction handling
- Test concurrent access scenarios

### Property-Based Testing

**Testing Framework:** PHPUnit with QuickCheck-style generators

**Test Configuration:**
- Minimum 100 iterations per property test
- Random data generation for materials
- Edge case coverage (empty strings, max values, special characters)

**Property Test Implementation:**
Each property listed in the Correctness Properties section should be implemented as a separate property-based test with appropriate data generators.

## Security Considerations

### Input Validation
- Sanitize all user inputs using `$util->sql()`
- Validate file uploads for type and size
- Prevent SQL injection through prepared statements

### Authentication & Authorization
- Verify user session before any operation
- Check user permissions for CRUD operations
- Log all material modifications with user ID

### File Upload Security
- Validate file MIME types on server side
- Store uploaded files outside web root
- Generate unique filenames to prevent overwrites
- Scan uploaded files for malware

### Data Protection
- Encrypt sensitive data in database
- Use HTTPS for all communications
- Implement CSRF protection for forms
- Sanitize output to prevent XSS attacks

## Performance Considerations

### Frontend Optimization
- Lazy load material images
- Implement pagination for large datasets
- Debounce search input to reduce API calls
- Cache filter options in memory

### Backend Optimization
- Index frequently queried columns (CodigoEquipo, id_zona, id_categoria)
- Use prepared statements for repeated queries
- Implement query result caching
- Optimize JOIN operations

### Database Optimization
- Create composite indexes for filter combinations
- Implement database connection pooling
- Use EXPLAIN to analyze slow queries
- Archive old materials to separate table

## Deployment Considerations

### File Structure
```
operacion/almacen/
├── index.php
├── ctrl/
│   └── ctrl-almacen.php
├── mdl/
│   └── mdl-almacen.php
├── js/
│   └── almacen.js
└── uploads/
    └── materials/
```

### Configuration
- Database connection settings in `conf/_Conect.php`
- Upload directory permissions (755)
- PHP memory limit for file uploads
- Session timeout configuration

### Migration Steps
1. Create database tables with provided schema
2. Deploy PHP files to server
3. Deploy JavaScript files
4. Configure upload directory
5. Test all CRUD operations
6. Verify filter and search functionality
7. Test file upload functionality
8. Monitor error logs for issues
