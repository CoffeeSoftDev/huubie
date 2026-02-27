# Design Document - Módulo de Costos

## Overview

El módulo de Costos es un sistema de consulta financiera de solo lectura que consolida información de costos directos (desde el módulo de Compras) y salidas de almacén (desde el módulo de Almacén) en un concentrado diario. El sistema permite a usuarios de nivel 2 y 3 visualizar, filtrar y exportar datos financieros sin capacidad de modificación, garantizando la integridad de la información.

### Características Principales

- **Consulta de solo lectura**: Sin capacidad de edición o modificación de datos
- **Consolidación multi-fuente**: Integra datos de Compras y Almacén
- **Filtrado por rango de fechas**: Selector intuitivo con validación
- **Filtrado por UDN**: Disponible solo para usuarios de nivel 3
- **Organización por categorías**: Alimentos, Bebidas, Diversos
- **Exportación a Excel**: Con preservación de formato y filtros
- **Auditoría completa**: Registro de todas las consultas y exportaciones
- **Interfaz consistente**: Integrada con el sistema CoffeeSoft existente

## Architecture

### Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (JavaScript)                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  costos.js (extends Templates)                         │ │
│  │  - render()                                            │ │
│  │  - layout()                                            │ │
│  │  - filterBar()                                         │ │
│  │  - lsCostos()                                          │ │
│  │  - exportExcel()                                       │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓ AJAX (useFetch)
┌─────────────────────────────────────────────────────────────┐
│                   Controller (PHP)                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ctrl-costos.php (extends mdl)                         │ │
│  │  - init()                                              │ │
│  │  - lsCostos()                                          │ │
│  │  - exportExcel()                                       │ │
│  │  - validateReadOnly()                                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓ Database Queries
┌─────────────────────────────────────────────────────────────┐
│                      Model (PHP)                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  mdl-costos.php (extends CRUD)                         │ │
│  │  - lsUDN()                                             │ │
│  │  - listCostosDirectos()                                │ │
│  │  - listSalidasAlmacen()                                │ │
│  │  - consolidateCostos()                                 │ │
│  │  - createAuditLog()                                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓ SQL Queries
┌─────────────────────────────────────────────────────────────┐
│                       Database                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  rfwsmqex_contabilidad                                 │ │
│  │  - compras (costos directos)                           │ │
│  │  - warehouse_output (salidas almacén)                  │ │
│  │  - product_class (categorías)                          │ │
│  │  - audit_log (auditoría)                               │ │
│  │  - usuarios (permisos)                                 │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de Datos

1. **Carga Inicial**:
   - Usuario accede al módulo → Frontend carga interfaz
   - Frontend llama `init()` → Backend retorna UDNs y configuración
   - Frontend renderiza filterBar con rango de fechas actual

2. **Consulta de Concentrado**:
   - Usuario selecciona rango de fechas y/o UDN
   - Frontend llama `lsCostos()` con parámetros
   - Backend consulta costos directos (Compras)
   - Backend consulta salidas de almacén (Almacén)
   - Backend consolida datos por fecha y categoría
   - Backend calcula totales
   - Backend registra consulta en audit_log
   - Frontend renderiza tabla con datos consolidados

3. **Exportación a Excel**:
   - Usuario presiona botón "Exportar a Excel"
   - Frontend llama `exportExcel()` con filtros actuales
   - Backend genera archivo Excel con datos filtrados
   - Backend registra exportación en audit_log
   - Frontend descarga archivo automáticamente

### Principios de Diseño

- **Solo Lectura**: Todas las operaciones son de consulta, sin modificación
- **Consolidación**: Datos de múltiples fuentes en una vista unificada
- **Seguridad por Capas**: Validación en frontend y backend
- **Auditoría Completa**: Registro de todas las operaciones
- **Consistencia Visual**: Uso de componentes estándar de CoffeeSoft

## Components and Interfaces

### Frontend Components (costos.js)

#### Clase Principal: App

```javascript
class App extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "costos";
    }
    
    // Métodos principales
    render()        // Inicializa el módulo
    layout()        // Crea estructura primaryLayout
    filterBar()     // Renderiza filtros (fechas, UDN)
    lsCostos()      // Consulta y muestra concentrado
    exportExcel()   // Exporta datos a Excel
}
```

#### Componentes CoffeeSoft Utilizados

- **primaryLayout**: Estructura base con filterBar y container
- **createfilterBar**: Barra de filtros con selector de fechas y UDN
- **dataPicker**: Selector de rango de fechas
- **createTable**: Tabla de concentrado con formato corporativo
- **alert**: Notificaciones de éxito/error

### Backend Interfaces

#### Controlador (ctrl-costos.php)

```php
class ctrl extends mdl {
    
    // Inicialización
    function init()
    // Retorna: ['udn' => array, 'userLevel' => int]
    
    // Consulta principal
    function lsCostos()
    // Entrada: $_POST['fi'], $_POST['ff'], $_POST['udn'] (opcional)
    // Retorna: ['row' => array, 'thead' => string]
    
    // Exportación
    function exportExcel()
    // Entrada: $_POST['fi'], $_POST['ff'], $_POST['udn'] (opcional)
    // Retorna: ['status' => int, 'file' => string, 'message' => string]
    
    // Validación de seguridad
    function validateReadOnly()
    // Retorna: ['status' => 403, 'message' => string]
}
```

#### Modelo (mdl-costos.php)

```php
class mdl extends CRUD {
    
    // Consultas de filtros
    function lsUDN()
    // Retorna: array de UDNs disponibles
    
    // Consultas de datos
    function listCostosDirectos($params)
    // Entrada: ['fi' => date, 'ff' => date, 'udn' => int]
    // Retorna: array de costos directos por fecha
    
    function listSalidasAlmacen($params)
    // Entrada: ['fi' => date, 'ff' => date, 'udn' => int]
    // Retorna: array de salidas por fecha y categoría
    
    // Consolidación
    function consolidateCostos($costosDirectos, $salidas)
    // Retorna: array consolidado por fecha con categorías
    
    // Auditoría
    function createAuditLog($data)
    // Entrada: ['action' => string, 'user_id' => int, 'details' => json]
    // Retorna: bool
}
```

### Estructura de Datos

#### Formato de Respuesta lsCostos()

```javascript
{
    "row": [
        {
            "id": "2025-11-25",
            "COSTOS": "Alimentos",
            "TOTAL": "$14,040.00",
            "MARTES_25": "$2,220.00",
            "MIERCOLES_26": "$450.00",
            // ... más días
            "opc": 0  // Sin opciones de edición
        },
        {
            "id": "total-compras",
            "COSTOS": "Total en compras (costo directo)",
            "TOTAL": "$15,370.00",
            "MARTES_25": "$900.00",
            // ... totales por día
            "class": "font-bold bg-yellow-100"
        },
        {
            "id": "total-salidas",
            "COSTOS": "Total en salidas de almacén",
            "TOTAL": "$4,920.00",
            // ... totales por día
            "class": "font-bold bg-blue-100"
        },
        {
            "id": "total-general",
            "COSTOS": "Costo total",
            "TOTAL": "$20,290.00",
            // ... totales por día
            "class": "font-bold bg-green-100"
        }
    ],
    "thead": ""  // Encabezados generados dinámicamente
}
```

## Data Models

### Tablas de Base de Datos

#### Tabla: compras (Costos Directos)

```sql
CREATE TABLE compras (
    id INT PRIMARY KEY AUTO_INCREMENT,
    udn_id INT NOT NULL,
    operation_date DATE NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    category_id INT,
    active TINYINT DEFAULT 1,
    FOREIGN KEY (udn_id) REFERENCES usuarios(idUDN),
    FOREIGN KEY (category_id) REFERENCES product_class(id)
);
```

#### Tabla: warehouse_output (Salidas de Almacén)

```sql
CREATE TABLE warehouse_output (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    description TEXT,
    operation_date DATE NOT NULL,
    active TINYINT DEFAULT 1,
    FOREIGN KEY (product_id) REFERENCES product(id)
);
```

#### Tabla: product (Productos)

```sql
CREATE TABLE product (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_class_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    active TINYINT DEFAULT 1,
    FOREIGN KEY (product_class_id) REFERENCES product_class(id)
);
```

#### Tabla: product_class (Categorías)

```sql
CREATE TABLE product_class (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,  -- 'Alimentos', 'Bebidas', 'Diversos'
    active TINYINT DEFAULT 1
);
```

#### Tabla: audit_log (Auditoría)

```sql
CREATE TABLE audit_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    udn_id INT NOT NULL,
    user_id INT NOT NULL,
    record_id INT,
    name_table VARCHAR(255),
    name_user VARCHAR(50),
    name_udn VARCHAR(50),
    name_collaborator VARCHAR(255),
    action ENUM('consulta', 'exportacion', 'error'),
    change_items LONGTEXT,  -- JSON con detalles
    creation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (udn_id) REFERENCES usuarios(idUDN),
    FOREIGN KEY (user_id) REFERENCES usuarios(idUser)
);
```

### Relaciones entre Tablas

```
usuarios (idUDN, nivel)
    ↓
compras (udn_id, category_id, operation_date, amount)
    ↓
product_class (id, name)

product (id, product_class_id)
    ↓
warehouse_output (product_id, operation_date, amount)
    ↓
product_class (id, name)

audit_log (user_id, udn_id, action, change_items)
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Date Range Validation

*For any* pair of dates (fecha_inicial, fecha_final) submitted by the user, if fecha_inicial > fecha_final, then the system should reject the query and display a validation error message.

**Validates: Requirements 9.2**

### Property 2: Data Grouping by Date

*For any* valid date range query, all returned cost records should be grouped by operation_date, with no duplicate dates in the result set.

**Validates: Requirements 1.2, 5.3**

### Property 3: Required Columns Presence

*For any* concentrado table rendered with data, the table structure should include columns for: COSTOS (category name), TOTAL, and one column per day in the selected date range.

**Validates: Requirements 1.3**

### Property 4: Total Calculation Accuracy

*For any* set of cost records displayed, the sum of all individual row amounts for a given day should equal the daily total shown in the totals row.

**Validates: Requirements 1.4, 5.4, 7.3**

### Property 5: Read-Only Enforcement

*For any* HTTP request attempting to modify data (POST/PUT/DELETE with opc != 'lsCostos' or 'exportExcel' or 'init'), the backend should return status 403 with error message "Operación no permitida en módulo de solo lectura".

**Validates: Requirements 4.2, 4.3**

### Property 6: Excel Export Data Consistency

*For any* export operation, the data in the generated Excel file should match exactly the data currently displayed in the filtered table view.

**Validates: Requirements 2.2, 2.3**

### Property 7: Excel Filename Metadata

*For any* Excel export, the filename should follow the pattern "Costos_[YYYY-MM-DD]_[YYYY-MM-DD]_[UDN].xlsx" where the dates correspond to the selected range and UDN to the filtered unit (or "Todas" if no filter).

**Validates: Requirements 2.4**

### Property 8: UDN Filter Visibility by User Level

*For any* user with nivel = 3, the UDN filter should be visible in the filterBar; for any user with nivel = 2, the UDN filter should not be rendered.

**Validates: Requirements 3.1, 3.2**

### Property 9: UDN Filter Application

*For any* selected UDN value, all displayed cost records should have udn_id matching the selected UDN, and no records from other UDNs should appear.

**Validates: Requirements 3.3, 3.4**

### Property 10: Total Recalculation on Filter Change

*For any* change in UDN filter selection, the displayed totals (Total en compras, Total en salidas, Costo total) should be recalculated to reflect only the data from the newly selected UDN.

**Validates: Requirements 3.5**

### Property 11: Category Structure Preservation

*For any* concentrado display, the data should be organized into exactly three categories: "Alimentos", "Bebidas", and "Diversos", with each category appearing as a separate row or group.

**Validates: Requirements 5.5, 6.1**

### Property 12: Category Subtotal Accuracy

*For any* day column in the concentrado, the sum of amounts for all items within a category should equal the category subtotal shown for that day.

**Validates: Requirements 6.2**

### Property 13: Total Rows Presence

*For any* concentrado with data, the table should include three total rows: "Total en compras (costo directo)", "Total en salidas de almacén", and "Costo total".

**Validates: Requirements 7.1, 7.2**

### Property 14: Grand Total Calculation

*For any* concentrado display, the "Costo total" value should equal the sum of "Total en compras (costo directo)" plus "Total en salidas de almacén" for each day and for the overall total.

**Validates: Requirements 7.3**

### Property 15: Daily Column Generation

*For any* date range [fi, ff], the table should generate exactly (ff - fi + 1) day columns, one for each date in the range inclusive.

**Validates: Requirements 7.5**

### Property 16: Date Range Auto-Update

*For any* change in the date range selector, the table should automatically refresh and display data for the new range without requiring a manual refresh button click.

**Validates: Requirements 9.3**

### Property 17: Date Format Display

*For any* selected date range, the displayed period should be formatted as "DD/MM/YYYY - DD/MM/YYYY" in the UI.

**Validates: Requirements 9.5**

### Property 18: Audit Log Creation on Query

*For any* successful lsCostos() query, an audit_log record should be created with action='consulta', including user_id, udn_id, and query parameters in change_items.

**Validates: Requirements 10.1**

### Property 19: Audit Log Creation on Export

*For any* successful exportExcel() operation, an audit_log record should be created with action='exportacion', including user_id, udn_id, and export parameters in change_items.

**Validates: Requirements 10.2**

### Property 20: Audit Log Required Fields

*For any* audit_log record created, it should include non-null values for: name_table, action, name_user, and name_udn.

**Validates: Requirements 10.3, 10.4**

### Property 21: Error Logging

*For any* query or export operation that fails with an exception, an audit_log record should be created with action='error' and error details in change_items.

**Validates: Requirements 10.5**

## Error Handling

### Frontend Error Handling

#### Validación de Fechas

```javascript
// En filterBar() - validación antes de consulta
if (fechaInicial > fechaFinal) {
    alert({
        icon: "error",
        title: "Rango de fechas inválido",
        text: "La fecha inicial debe ser menor o igual a la fecha final",
        btn1: true,
        btn1Text: "Ok"
    });
    return;
}
```

#### Manejo de Respuestas de Error

```javascript
// En lsCostos() - manejo de errores del backend
this.useFetch({
    url: this._link,
    data: { opc: 'lsCostos', fi, ff, udn },
    success: (response) => {
        if (response.status === 200) {
            // Renderizar tabla
        } else {
            alert({
                icon: "error",
                text: response.message || "Error al consultar costos",
                btn1: true
            });
        }
    },
    error: (error) => {
        alert({
            icon: "error",
            text: "Error de conexión con el servidor",
            btn1: true
        });
        console.error(error);
    }
});
```

### Backend Error Handling

#### Validación de Permisos

```php
function validateReadOnly() {
    $allowedOperations = ['init', 'lsCostos', 'exportExcel'];
    
    if (!in_array($_POST['opc'], $allowedOperations)) {
        $this->createAuditLog([
            'action' => 'error',
            'details' => json_encode([
                'attempted_operation' => $_POST['opc'],
                'error' => 'Intento de modificación en módulo de solo lectura'
            ])
        ]);
        
        return [
            'status' => 403,
            'message' => 'Operación no permitida en módulo de solo lectura'
        ];
    }
}
```

#### Manejo de Errores de Consulta

```php
function lsCostos() {
    try {
        $fi = $_POST['fi'];
        $ff = $_POST['ff'];
        $udn = $_POST['udn'] ?? null;
        
        // Validar fechas
        if (strtotime($fi) > strtotime($ff)) {
            return [
                'status' => 400,
                'message' => 'Rango de fechas inválido'
            ];
        }
        
        // Consultar datos
        $costosDirectos = $this->listCostosDirectos(['fi' => $fi, 'ff' => $ff, 'udn' => $udn]);
        $salidas = $this->listSalidasAlmacen(['fi' => $fi, 'ff' => $ff, 'udn' => $udn]);
        
        // Consolidar
        $concentrado = $this->consolidateCostos($costosDirectos, $salidas);
        
        // Registrar auditoría
        $this->createAuditLog([
            'action' => 'consulta',
            'details' => json_encode(['fi' => $fi, 'ff' => $ff, 'udn' => $udn])
        ]);
        
        return [
            'status' => 200,
            'row' => $concentrado,
            'thead' => ''
        ];
        
    } catch (Exception $e) {
        // Registrar error
        $this->createAuditLog([
            'action' => 'error',
            'details' => json_encode([
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ])
        ]);
        
        return [
            'status' => 500,
            'message' => 'Error al consultar costos: ' . $e->getMessage()
        ];
    }
}
```

#### Manejo de Errores de Exportación

```php
function exportExcel() {
    try {
        // Obtener datos
        $data = $this->lsCostos();
        
        if ($data['status'] !== 200) {
            return $data;
        }
        
        // Generar Excel
        $filename = $this->generateExcelFile($data['row'], $_POST);
        
        // Registrar auditoría
        $this->createAuditLog([
            'action' => 'exportacion',
            'details' => json_encode([
                'filename' => $filename,
                'fi' => $_POST['fi'],
                'ff' => $_POST['ff'],
                'udn' => $_POST['udn'] ?? 'Todas'
            ])
        ]);
        
        return [
            'status' => 200,
            'file' => $filename,
            'message' => 'Archivo generado exitosamente'
        ];
        
    } catch (Exception $e) {
        $this->createAuditLog([
            'action' => 'error',
            'details' => json_encode([
                'operation' => 'exportExcel',
                'error' => $e->getMessage()
            ])
        ]);
        
        return [
            'status' => 500,
            'message' => 'Error al generar archivo Excel: ' . $e->getMessage()
        ];
    }
}
```

### Códigos de Estado HTTP

- **200**: Operación exitosa
- **400**: Datos de entrada inválidos (fechas incorrectas, parámetros faltantes)
- **403**: Operación no permitida (intento de modificación)
- **500**: Error interno del servidor (error de base de datos, error de generación de Excel)

## Testing Strategy

### Enfoque de Testing

El módulo de Costos implementará una estrategia de testing dual que combina:

1. **Unit Tests**: Para verificar ejemplos específicos y casos edge
2. **Property-Based Tests**: Para verificar propiedades universales que deben cumplirse en todos los casos

Esta combinación asegura tanto la corrección de casos específicos como el comportamiento general del sistema.

### Property-Based Testing

#### Framework

Se utilizará **PHPUnit con Eris** para property-based testing en PHP:

```bash
composer require --dev giorgiosironi/eris
```

#### Configuración de Tests

Cada property-based test debe:
- Ejecutar un mínimo de **100 iteraciones** con datos aleatorios
- Incluir un comentario que referencie la propiedad del diseño
- Usar generadores apropiados para el tipo de datos

#### Ejemplo de Property Test

```php
use Eris\Generator;

class CostosPropertyTest extends \PHPUnit\Framework\TestCase {
    use \Eris\TestTrait;
    
    /**
     * Feature: modulo-costos, Property 4: Total Calculation Accuracy
     * For any set of cost records, daily totals should equal sum of individual amounts
     */
    public function testDailyTotalEqualsSum() {
        $this->forAll(
            Generator\seq(Generator\associative([
                'date' => Generator\date(),
                'amount' => Generator\pos(),
                'category' => Generator\elements(['Alimentos', 'Bebidas', 'Diversos'])
            ]))
        )->then(function($records) {
            $model = new mdl();
            $consolidated = $model->consolidateCostos($records, []);
            
            foreach ($consolidated as $row) {
                if (isset($row['daily_total'])) {
                    $calculatedTotal = array_sum(array_column($records, 'amount'));
                    $this->assertEquals($calculatedTotal, $row['daily_total']);
                }
            }
        });
    }
}
```

### Unit Testing

#### Tests de Validación

```php
class CostosValidationTest extends \PHPUnit\Framework\TestCase {
    
    public function testInvalidDateRangeReturnsError() {
        $_POST = [
            'opc' => 'lsCostos',
            'fi' => '2025-12-31',
            'ff' => '2025-01-01'
        ];
        
        $ctrl = new ctrl();
        $result = $ctrl->lsCostos();
        
        $this->assertEquals(400, $result['status']);
        $this->assertStringContainsString('inválido', $result['message']);
    }
    
    public function testReadOnlyEnforcementBlocksModification() {
        $_POST = ['opc' => 'addCosto'];
        
        $ctrl = new ctrl();
        $result = $ctrl->validateReadOnly();
        
        $this->assertEquals(403, $result['status']);
    }
}
```

#### Tests de Integración

```php
class CostosIntegrationTest extends \PHPUnit\Framework\TestCase {
    
    public function testConsolidationIncludesBothSources() {
        $model = new mdl();
        
        $costosDirectos = [
            ['date' => '2025-11-25', 'amount' => 1000, 'category' => 'Alimentos']
        ];
        
        $salidas = [
            ['date' => '2025-11-25', 'amount' => 500, 'category' => 'Bebidas']
        ];
        
        $result = $model->consolidateCostos($costosDirectos, $salidas);
        
        $this->assertCount(2, $result); // Ambas categorías presentes
        $this->assertEquals(1500, $result['total']); // Suma correcta
    }
}
```

### Tests de Frontend

#### Tests con Jest

```javascript
describe('Costos Module', () => {
    let app;
    
    beforeEach(() => {
        app = new App('test-api', 'test-root');
    });
    
    test('should validate date range before query', () => {
        const invalidRange = {
            fi: '2025-12-31',
            ff: '2025-01-01'
        };
        
        expect(() => app.validateDateRange(invalidRange))
            .toThrow('fecha inicial debe ser menor');
    });
    
    test('should show UDN filter only for level 3 users', () => {
        const level3User = { nivel: 3 };
        const level2User = { nivel: 2 };
        
        expect(app.shouldShowUDNFilter(level3User)).toBe(true);
        expect(app.shouldShowUDNFilter(level2User)).toBe(false);
    });
});
```

### Cobertura de Testing

#### Objetivos de Cobertura

- **Líneas de código**: Mínimo 80%
- **Funciones**: Mínimo 90%
- **Propiedades de corrección**: 100% (todas las 21 propiedades deben tener tests)

#### Prioridades de Testing

1. **Alta prioridad** (deben tener property tests):
   - Cálculos de totales (Properties 4, 12, 14)
   - Validaciones de seguridad (Properties 5, 8, 9)
   - Consistencia de exportación (Properties 6, 7)

2. **Media prioridad** (unit tests suficientes):
   - Validaciones de entrada (Properties 1, 16, 17)
   - Estructura de datos (Properties 3, 11, 13, 15)

3. **Baja prioridad** (tests de integración):
   - Auditoría (Properties 18-21)
   - Filtros de UI (Properties 8, 10)

### Ejecución de Tests

```bash
# Tests unitarios PHP
./vendor/bin/phpunit tests/Unit/CostosTest.php

# Property-based tests PHP
./vendor/bin/phpunit tests/Property/CostosPropertyTest.php

# Tests de frontend
npm test -- costos.test.js

# Cobertura completa
./vendor/bin/phpunit --coverage-html coverage/
```

### Integración Continua

Los tests deben ejecutarse automáticamente en cada commit:

```yaml
# .github/workflows/tests.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run PHP Tests
        run: ./vendor/bin/phpunit
      - name: Run Property Tests
        run: ./vendor/bin/phpunit --testsuite=property
```
