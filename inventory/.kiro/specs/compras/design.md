# Design Document - Módulo de Compras

## Overview

El módulo de Compras es una aplicación web desarrollada con el framework CoffeeSoft que permite la gestión integral de compras de una unidad de negocio. El sistema implementa una arquitectura MVC (Modelo-Vista-Controlador) con componentes reutilizables, filtros dinámicos, actualización en tiempo real y control de accesos por roles.

**Tecnologías:**
- Frontend: JavaScript (jQuery), CoffeeSoft Framework, TailwindCSS
- Backend: PHP 7.4+
- Base de datos: MySQL
- Componentes: Chart.js (para reportes visuales), DataTables, SweetAlert2

## Architecture

### Estructura de Archivos

```
finanzas/captura/
├── js/
│   └── compras.js              # Frontend principal (extiende Templates)
├── ctrl/
│   └── ctrl-compras.php        # Controlador PHP (lógica de negocio)
├── mdl/
│   └── mdl-compras.php         # Modelo PHP (acceso a datos)
└── index.php                   # Punto de entrada (incluye root div)
```

### Patrón Arquitectónico

**MVC con CoffeeSoft Framework:**

```
┌─────────────────────────────────────────────────────────┐
│                    Vista (index.php)                     │
│                    <div id="root"></div>                 │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              Controlador Frontend (compras.js)           │
│  - App (clase principal)                                 │
│  - Extends Templates (CoffeeSoft)                        │
│  - Gestión de UI y eventos                               │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│           Controlador Backend (ctrl-compras.php)         │
│  - init() - Inicialización de filtros                    │
│  - ls() - Listar compras                                 │
│  - addPurchase() - Agregar compra                        │
│  - editPurchase() - Editar compra                        │
│  - deletePurchase() - Eliminar compra                    │
│  - getConcentrado() - Reporte concentrado                │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│              Modelo (mdl-compras.php)                    │
│  - listPurchases() - Consulta de compras                 │
│  - createPurchase() - Inserción                          │
│  - updatePurchase() - Actualización                      │
│  - deletePurchaseById() - Eliminación                    │
│  - lsProductClass() - Filtros de categorías              │
│  - lsPurchaseType() - Filtros de tipos                   │
│  - lsSupplier() - Filtros de proveedores                 │
│  - lsMethodPay() - Filtros de métodos de pago            │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                  Base de Datos (MySQL)                   │
│  - purchase (tabla principal)                            │
│  - product_class (categorías)                            │
│  - product (productos)                                   │
│  - supplier (proveedores)                                │
│  - purchase_type (tipos de compra)                       │
│  - method_pay (métodos de pago)                          │
└─────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Frontend Components (compras.js)

#### Clase Principal: App

```javascript
class App extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "compras";
    }
    
    // Métodos principales
    render()              // Inicialización del módulo
    layout()              // Estructura de pestañas y contenedores
    filterBar()           // Barra de filtros principal
    ls()                  // Listar compras en tabla
    addPurchase()         // Modal para nueva compra
    editPurchase(id)      // Modal para editar compra
    deletePurchase(id)    // Confirmación de eliminación
    showDetails(id)       // Modal de detalles de compra
    jsonPurchase()        // Estructura del formulario
    updateTotals()        // Actualización de totales en tiempo real
}
```

#### Clase Secundaria: ConcentradoCompras

```javascript
class ConcentradoCompras extends App {
    constructor(link, div_modulo) {
        super(link, div_modulo);
    }
    
    render()              // Renderizar vista de concentrado
    filterBarConcentrado() // Filtros específicos del reporte
    lsConcentrado()       // Generar tabla de concentrado
    exportExcel()         // Exportar reporte a Excel
}
```

### Componentes CoffeeSoft Utilizados

1. **primaryLayout()** - Layout principal con filterBar y container
2. **tabLayout()** - Pestañas de navegación (Compras, Concentrado)
3. **createfilterBar()** - Barra de filtros dinámica
4. **createTable()** - Tabla de compras con DataTables
5. **createModalForm()** - Formularios modales para CRUD
6. **swalQuestion()** - Confirmaciones de eliminación
7. **detailCard()** - Tarjeta de detalles de compra

### Backend Interfaces

#### Controlador (ctrl-compras.php)

```php
class ctrl extends mdl {
    
    // Inicialización
    function init()
    // Retorna: ['productClass' => [], 'purchaseType' => [], 'supplier' => [], 'methodPay' => []]
    
    // Listar compras
    function ls()
    // Entrada: $_POST['fi'], $_POST['ff'], $_POST['purchase_type_id'], $_POST['method_pay_id']
    // Retorna: ['row' => [], 'totals' => [], 'balance' => []]
    
    // Obtener compra
    function getPurchase()
    // Entrada: $_POST['id']
    // Retorna: ['status' => 200, 'data' => [], 'message' => '']
    
    // Agregar compra
    function addPurchase()
    // Entrada: $_POST['product_class_id'], $_POST['product_id'], $_POST['purchase_type_id'], 
    //          $_POST['supplier_id'], $_POST['method_pay_id'], $_POST['subtotal'], 
    //          $_POST['tax'], $_POST['description']
    // Retorna: ['status' => 200, 'message' => '']
    
    // Editar compra
    function editPurchase()
    // Entrada: $_POST['id'] + campos editables
    // Retorna: ['status' => 200, 'message' => '']
    
    // Eliminar compra
    function deletePurchase()
    // Entrada: $_POST['id']
    // Retorna: ['status' => 200, 'message' => '']
    
    // Concentrado de compras
    function getConcentrado()
    // Entrada: $_POST['fi'], $_POST['ff'], $_POST['purchase_type_id']
    // Retorna: ['row' => [], 'totals' => [], 'balance' => []]
}
```

#### Modelo (mdl-compras.php)

```php
class mdl extends CRUD {
    
    // Consultas de listado
    function listPurchases($array)
    // Parámetros: [fi, ff, purchase_type_id, method_pay_id, udn_id]
    // Retorna: Array de compras con joins a tablas relacionadas
    
    function listConcentrado($array)
    // Parámetros: [fi, ff, purchase_type_id, udn_id]
    // Retorna: Array agrupado por clase de producto y fecha
    
    // Operaciones CRUD
    function createPurchase($array)
    // Parámetros: ['values' => '', 'data' => []]
    // Retorna: bool
    
    function updatePurchase($array)
    // Parámetros: ['values' => '', 'where' => 'id = ?', 'data' => []]
    // Retorna: bool
    
    function deletePurchaseById($array)
    // Parámetros: [id]
    // Retorna: bool
    
    function getPurchaseById($array)
    // Parámetros: [id]
    // Retorna: Array asociativo con datos de la compra
    
    // Consultas para filtros (usando _Read)
    function lsProductClass($array)
    function lsProduct($array)
    function lsPurchaseType($array)
    function lsSupplier($array)
    function lsMethodPay($array)
    
    // Cálculos
    function getTotalsByType($array)
    // Retorna: ['total_fondo_fijo' => 0, 'total_corporativo' => 0, 'total_credito' => 0]
    
    function getBalanceFondoFijo($array)
    // Retorna: ['saldo_inicial' => 0, 'salidas' => 0, 'saldo_final' => 0]
}
```

## Data Models

### Tabla: purchase

```sql
CREATE TABLE purchase (
    id INT PRIMARY KEY AUTO_INCREMENT,
    udn_id INT NOT NULL,
    product_class_id INT NOT NULL,
    product_id INT NOT NULL,
    purchase_type_id INT NOT NULL,
    supplier_id INT NULL,
    method_pay_id INT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    tax DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    description TEXT NULL,
    operation_date DATE NOT NULL,
    active TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (udn_id) REFERENCES udn(idUDN),
    FOREIGN KEY (product_class_id) REFERENCES product_class(id),
    FOREIGN KEY (product_id) REFERENCES product(id),
    FOREIGN KEY (purchase_type_id) REFERENCES purchase_type(id),
    FOREIGN KEY (supplier_id) REFERENCES supplier(id),
    FOREIGN KEY (method_pay_id) REFERENCES method_pay(id),
    
    INDEX idx_operation_date (operation_date),
    INDEX idx_purchase_type (purchase_type_id),
    INDEX idx_udn (udn_id),
    INDEX idx_active (active)
);
```

### Tabla: product_class

```sql
CREATE TABLE product_class (
    id INT PRIMARY KEY AUTO_INCREMENT,
    udn_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    description TEXT NULL,
    active TINYINT DEFAULT 1,
    
    FOREIGN KEY (udn_id) REFERENCES udn(idUDN),
    INDEX idx_active (active)
);
```

### Tabla: product

```sql
CREATE TABLE product (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_class_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    active TINYINT DEFAULT 1,
    
    FOREIGN KEY (product_class_id) REFERENCES product_class(id),
    INDEX idx_class (product_class_id),
    INDEX idx_active (active)
);
```

### Tabla: purchase_type

```sql
CREATE TABLE purchase_type (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    active TINYINT DEFAULT 1,
    
    INDEX idx_active (active)
);

-- Datos iniciales
INSERT INTO purchase_type (id, name) VALUES
(1, 'Fondo fijo'),
(2, 'Corporativo'),
(3, 'Crédito');
```

### Tabla: supplier

```sql
CREATE TABLE supplier (
    id INT PRIMARY KEY AUTO_INCREMENT,
    udn_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    active TINYINT DEFAULT 1,
    
    FOREIGN KEY (udn_id) REFERENCES udn(idUDN),
    INDEX idx_active (active)
);
```

### Tabla: method_pay

```sql
CREATE TABLE method_pay (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    active TINYINT DEFAULT 1,
    
    INDEX idx_active (active)
);

-- Datos iniciales
INSERT INTO method_pay (name) VALUES
('Tarjeta de crédito'),
('Transferencia'),
('Efectivo'),
('Cheque');
```

### Relaciones entre Tablas

```
udn (1) ──────────── (N) purchase
udn (1) ──────────── (N) product_class
udn (1) ──────────── (N) supplier

product_class (1) ── (N) product
product_class (1) ── (N) purchase

product (1) ───────── (N) purchase
purchase_type (1) ─── (N) purchase
supplier (1) ──────── (N) purchase
method_pay (1) ────── (N) purchase
```

## Error Handling

### Frontend Error Handling

```javascript
// Validación de formularios
try {
    const validation = $('#formPurchase').validation_form(
        { opc: 'addPurchase' },
        (formData) => {
            // Envío exitoso
        }
    );
} catch (error) {
    alert({
        icon: "error",
        text: "Error al validar el formulario"
    });
}

// Manejo de respuestas del servidor
success: (response) => {
    if (response.status === 200) {
        alert({ icon: "success", text: response.message });
        this.ls(); // Actualizar tabla
    } else if (response.status === 409) {
        alert({ icon: "warning", text: response.message });
    } else {
        alert({ icon: "error", text: response.message });
    }
}
```

### Backend Error Handling

```php
// Validación de permisos
function addPurchase() {
    $status = 500;
    $message = 'Error al registrar la compra';
    
    try {
        // Validar campos requeridos
        if (empty($_POST['product_class_id']) || empty($_POST['product_id'])) {
            return [
                'status' => 400,
                'message' => 'Campos requeridos faltantes'
            ];
        }
        
        // Validar tipo de compra y campos condicionales
        if ($_POST['purchase_type_id'] == 2 && empty($_POST['method_pay_id'])) {
            return [
                'status' => 400,
                'message' => 'Debe seleccionar un método de pago para compras corporativas'
            ];
        }
        
        if ($_POST['purchase_type_id'] == 3 && empty($_POST['supplier_id'])) {
            return [
                'status' => 400,
                'message' => 'Debe seleccionar un proveedor para compras a crédito'
            ];
        }
        
        // Calcular total
        $_POST['total'] = $_POST['subtotal'] + $_POST['tax'];
        $_POST['operation_date'] = date('Y-m-d');
        $_POST['udn_id'] = $_POST['udn'];
        
        $create = $this->createPurchase($this->util->sql($_POST));
        
        if ($create) {
            $status = 200;
            $message = 'Compra registrada correctamente';
        }
        
    } catch (Exception $e) {
        $status = 500;
        $message = 'Error del servidor: ' . $e->getMessage();
    }
    
    return [
        'status' => $status,
        'message' => $message
    ];
}
```

### Códigos de Estado HTTP

- **200**: Operación exitosa
- **400**: Datos inválidos o faltantes
- **403**: Permisos insuficientes
- **404**: Registro no encontrado
- **409**: Conflicto (ej: registro duplicado)
- **500**: Error del servidor

## Testing Strategy

### Unit Tests (Modelo)

```php
// Pruebas para mdl-compras.php
class MdlComprasTest extends PHPUnit\Framework\TestCase {
    
    public function testListPurchases() {
        // Verificar que retorna array
        // Verificar estructura de datos
        // Verificar filtros aplicados correctamente
    }
    
    public function testCreatePurchase() {
        // Verificar inserción exitosa
        // Verificar datos insertados
        // Verificar validaciones
    }
    
    public function testGetTotalsByType() {
        // Verificar cálculos correctos
        // Verificar agrupación por tipo
    }
    
    public function testGetBalanceFondoFijo() {
        // Verificar cálculo de saldo inicial
        // Verificar cálculo de salidas
        // Verificar cálculo de saldo final
    }
}
```

### Integration Tests (Controlador)

```php
// Pruebas para ctrl-compras.php
class CtrlComprasTest extends PHPUnit\Framework\TestCase {
    
    public function testInit() {
        // Verificar que retorna todos los filtros
        // Verificar estructura de respuesta
    }
    
    public function testAddPurchaseValidation() {
        // Verificar validación de campos requeridos
        // Verificar validación de tipo corporativo
        // Verificar validación de tipo crédito
    }
    
    public function testEditPurchaseRestrictions() {
        // Verificar restricciones cuando módulo está bloqueado
        // Verificar restricciones con reembolso
    }
}
```

### Frontend Tests (JavaScript)

```javascript
// Pruebas para compras.js
describe('App - Módulo de Compras', () => {
    
    it('debe renderizar la interfaz correctamente', () => {
        // Verificar que se crean las pestañas
        // Verificar que se crea el filterBar
        // Verificar que se crea el container
    });
    
    it('debe actualizar totales en tiempo real', () => {
        // Simular registro de compra
        // Verificar actualización de totales
    });
    
    it('debe mostrar campos condicionales según tipo de compra', () => {
        // Seleccionar tipo "Corporativo"
        // Verificar que aparece método de pago
        // Seleccionar tipo "Crédito"
        // Verificar que aparece proveedor
    });
    
    it('debe filtrar productos por categoría', () => {
        // Seleccionar categoría
        // Verificar que solo aparecen productos de esa categoría
    });
});
```

### End-to-End Tests

```javascript
// Pruebas E2E con Cypress
describe('Flujo completo de compras', () => {
    
    it('debe registrar una compra de fondo fijo', () => {
        cy.visit('/finanzas/captura/');
        cy.get('#btnNuevaCompra').click();
        cy.get('#product_class_id').select('Costo directo');
        cy.get('#product_id').select('Alimentos');
        cy.get('#purchase_type_id').select('Fondo fijo');
        cy.get('#subtotal').type('100.00');
        cy.get('#tax').type('16.00');
        cy.get('#description').type('Compra de prueba');
        cy.get('#btnGuardar').click();
        cy.contains('Compra registrada correctamente');
    });
    
    it('debe editar una compra existente', () => {
        cy.get('table tbody tr:first .btn-edit').click();
        cy.get('#description').clear().type('Descripción actualizada');
        cy.get('#btnGuardar').click();
        cy.contains('Compra actualizada correctamente');
    });
    
    it('debe generar reporte concentrado', () => {
        cy.get('#tab-concentrado').click();
        cy.get('#fi').type('2025-01-01');
        cy.get('#ff').type('2025-01-31');
        cy.get('#btnBuscar').click();
        cy.get('table tbody tr').should('have.length.greaterThan', 0);
    });
});
```

## Performance Considerations

### Optimizaciones de Base de Datos

1. **Índices estratégicos:**
   - `idx_operation_date` en `purchase` para filtros por fecha
   - `idx_purchase_type` en `purchase` para filtros por tipo
   - `idx_udn` en `purchase` para filtros por unidad de negocio
   - `idx_active` en todas las tablas para filtros de registros activos

2. **Consultas optimizadas:**
   - Usar JOINs en lugar de múltiples consultas
   - Limitar resultados con paginación (DataTables)
   - Usar agregaciones en SQL para totales

### Optimizaciones de Frontend

1. **Carga diferida:**
   - Cargar pestañas solo cuando se acceden
   - Usar DataTables con paginación del lado del servidor

2. **Actualización selectiva:**
   - Actualizar solo los elementos afectados (totales, fila específica)
   - Evitar recargas completas de la tabla

3. **Caché de filtros:**
   - Almacenar opciones de filtros en variables globales
   - Evitar consultas repetidas al backend

## Security Considerations

### Validación de Permisos

```php
// En ctrl-compras.php
function validatePermissions($action) {
    $userLevel = $_SESSION['user_level'];
    
    $permissions = [
        'Captura' => ['add', 'ls'],
        'Gerencia' => ['add', 'edit', 'ls', 'concentrado'],
        'Dirección' => ['add', 'edit', 'delete', 'ls', 'concentrado'],
        'Contabilidad' => ['add', 'edit', 'delete', 'ls', 'concentrado', 'lock']
    ];
    
    if (!in_array($action, $permissions[$userLevel])) {
        return [
            'status' => 403,
            'message' => 'No tiene permisos para realizar esta acción'
        ];
    }
    
    return true;
}
```

### Sanitización de Datos

```php
// Usar $this->util->sql() para prevenir SQL Injection
$data = $this->util->sql($_POST);

// Validar tipos de datos
$subtotal = filter_var($_POST['subtotal'], FILTER_VALIDATE_FLOAT);
$tax = filter_var($_POST['tax'], FILTER_VALIDATE_FLOAT);

// Escapar salida HTML
echo htmlspecialchars($purchase['description']);
```

### Protección CSRF

```php
// Validar token CSRF en todas las operaciones de escritura
if (!isset($_POST['csrf_token']) || $_POST['csrf_token'] !== $_SESSION['csrf_token']) {
    return ['status' => 403, 'message' => 'Token CSRF inválido'];
}
```

## Deployment Considerations

### Requisitos del Servidor

- PHP 7.4 o superior
- MySQL 5.7 o superior
- Apache/Nginx con mod_rewrite
- Extensiones PHP: mysqli, json, session

### Configuración de Base de Datos

```sql
-- Crear base de datos
CREATE DATABASE IF NOT EXISTS rfwsmqex_finanzas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Ejecutar scripts de creación de tablas
SOURCE create_tables.sql;

-- Insertar datos iniciales
SOURCE seed_data.sql;
```

### Variables de Entorno

```php
// En conf/coffeSoft.php
define('DB_HOST', 'localhost');
define('DB_NAME', 'rfwsmqex_finanzas');
define('DB_USER', 'usuario');
define('DB_PASS', 'contraseña');
define('TIMEZONE', 'America/Mexico_City');
```

### Checklist de Deployment

- [ ] Crear estructura de base de datos
- [ ] Insertar datos iniciales (purchase_type, method_pay)
- [ ] Configurar permisos de archivos (755 para directorios, 644 para archivos)
- [ ] Configurar variables de entorno
- [ ] Verificar extensiones PHP requeridas
- [ ] Probar conexión a base de datos
- [ ] Ejecutar pruebas de integración
- [ ] Configurar backups automáticos
- [ ] Configurar logs de errores
- [ ] Documentar credenciales de acceso
