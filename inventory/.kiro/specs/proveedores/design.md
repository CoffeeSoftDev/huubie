# Design Document - Módulo de Proveedores

## Overview

El módulo de Proveedores es un sistema de gestión financiera que permite controlar pagos a proveedores con diferentes niveles de acceso. Se integra con el módulo de Compras existente para proporcionar un balance completo de las operaciones con proveedores.

### Objetivos del Diseño

- Proporcionar una interfaz intuitiva para captura de pagos
- Implementar control de acceso basado en niveles (1-4)
- Generar reportes consolidados de compras y pagos
- Integrar con el módulo de Compras existente
- Permitir exportación de datos a Excel

### Restricciones Técnicas

- Framework: CoffeeSoft (jQuery + TailwindCSS)
- Backend: PHP con arquitectura MVC
- Base de datos: MySQL
- Integración con módulo de Compras existente
- Soporte para múltiples unidades de negocio (UDN)

## Architecture

### Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (JavaScript)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   App Class  │  │ Capture Tab  │  │ Balance Tab  │      │
│  │  (Templates) │  │              │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Controller (ctrl-proveedor.php)             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   init() │  │   ls()   │  │  add()   │  │  edit()  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Model (mdl-proveedor.php)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ listPayments │  │createPayment │  │updatePayment │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Database (MySQL)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   payments   │  │   suppliers  │  │   purchases  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Flujo de Datos

1. **Captura de Pagos (Nivel 1)**
   - Usuario selecciona fecha → Frontend solicita datos → Backend consulta pagos del día
   - Usuario completa formulario → Validación frontend → Backend valida y guarda
   - Sistema actualiza tabla y totales en tiempo real

2. **Consulta de Concentrado (Nivel 2+)**
   - Usuario selecciona rango de fechas → Backend consulta compras y pagos
   - Sistema agrupa por proveedor → Calcula balances → Renderiza tabla colapsable
   - Usuario solicita exportación → Backend genera Excel → Descarga archivo

3. **Administración de Proveedores (Nivel 4)**
   - Usuario accede a administración → Backend lista proveedores
   - Usuario crea/edita proveedor → Validación de duplicados → Guarda cambios


## Components and Interfaces

### Frontend Components

#### 1. App Class (Main Controller)

```javascript
class App extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "proveedor";
    }
    
    // Métodos principales
    render()           // Inicializa el módulo
    layout()           // Crea estructura de pestañas
    filterBar()        // Barra de filtros principal
}
```

#### 2. Capture Tab Component

**Responsabilidades:**
- Mostrar formulario de captura de pagos
- Listar pagos del día seleccionado
- Mostrar tarjetas de resumen (totales)
- Permitir edición/eliminación de pagos del día

**Métodos clave:**
```javascript
lsPayments()           // Lista pagos del día
addPayment()           // Modal para nuevo pago
editPayment(id)        // Modal para editar pago
deletePayment(id)      // Confirmación y eliminación
filterBarCapture()     // Filtros de captura
```

#### 3. Balance Tab Component

**Responsabilidades:**
- Mostrar concentrado de proveedores
- Tabla colapsable con compras y pagos
- Cálculo de balances por proveedor
- Exportación a Excel

**Métodos clave:**
```javascript
lsBalance()            // Lista concentrado
toggleSupplier(id)     // Expande/colapsa proveedor
exportExcel()          // Genera archivo Excel
filterBarBalance()     // Filtros de concentrado
```

### Backend Components

#### 1. Controller (ctrl-proveedor.php)

**Métodos principales:**

```php
init()                 // Inicializa filtros (proveedores, tipos de pago, UDN)
ls()                   // Lista pagos del día
lsBalance()            // Genera concentrado de proveedores
addPayment()           // Crea nuevo pago
editPayment()          // Actualiza pago existente
deletePayment()        // Elimina pago
getPayment()           // Obtiene datos de un pago
```

**Funciones auxiliares:**
```php
dropdown($id, $date)   // Genera menú de acciones según fecha y nivel
renderStatus($status)  // Renderiza badge de estado
formatBalance($data)   // Formatea datos de balance
```

#### 2. Model (mdl-proveedor.php)

**Métodos de consulta:**

```php
listPayments($array)           // Lista pagos con filtros
listBalance($array)            // Genera concentrado
lsSuppliers($array)            // Lista proveedores activos
lsPaymentTypes($array)         // Lista tipos de pago
```

**Métodos CRUD:**

```php
createPayment($array)          // Inserta nuevo pago
updatePayment($array)          // Actualiza pago
deletePaymentById($array)      // Elimina pago
getPaymentById($array)         // Obtiene pago por ID
existsPaymentByDate($array)    // Valida duplicados
```

### Database Schema

#### Tabla: payments_supplier

```sql
CREATE TABLE payments_supplier (
    id INT PRIMARY KEY AUTO_INCREMENT,
    supplier_id INT NOT NULL,
    payment_type_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    description TEXT,
    payment_date DATE NOT NULL,
    udn_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    active TINYINT(1) DEFAULT 1,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
    FOREIGN KEY (payment_type_id) REFERENCES payment_types(id),
    FOREIGN KEY (udn_id) REFERENCES business_units(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### Tabla: suppliers (existente - administración)

```sql
CREATE TABLE suppliers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### Tabla: payment_types

```sql
CREATE TABLE payment_types (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    active TINYINT(1) DEFAULT 1
);

-- Datos iniciales
INSERT INTO payment_types (name) VALUES 
('Corporativo'),
('Fondo fijo');
```

### API Endpoints

#### Frontend → Backend Communication

**Captura de Pagos:**
```javascript
// Listar pagos del día
{ opc: 'ls', date: '2025-11-25', udn: 1 }

// Agregar pago
{ opc: 'addPayment', supplier_id: 5, payment_type_id: 1, amount: 500, description: '...', date: '2025-11-25' }

// Editar pago
{ opc: 'editPayment', id: 123, supplier_id: 5, amount: 600, description: '...' }

// Eliminar pago
{ opc: 'deletePayment', id: 123 }
```

**Concentrado:**
```javascript
// Listar balance
{ opc: 'lsBalance', fi: '2025-11-01', ff: '2025-11-30', udn: 1 }

// Exportar Excel
{ opc: 'exportExcel', fi: '2025-11-01', ff: '2025-11-30', udn: 1 }
```

## Data Models

### Payment Model

```javascript
{
    id: 123,
    supplier_id: 5,
    supplier_name: "Brenda Lopez Guillen",
    payment_type_id: 1,
    payment_type: "Corporativo",
    amount: 500.00,
    description: "Pago de flete por las jarras lecheras",
    payment_date: "2025-11-25",
    udn_id: 1,
    user_id: 10,
    created_at: "2025-11-25 10:30:00",
    active: 1
}
```

### Balance Model

```javascript
{
    supplier_id: 5,
    supplier_name: "Brenda Lopez Guillen",
    initial_balance: 9500.00,
    credit_purchases: 2720.00,
    credit_payments: 8720.00,
    final_balance: 3500.00,
    details: [
        {
            date: "2025-11-25",
            type: "purchase", // or "payment"
            amount: 2720.00,
            description: "Compra a crédito"
        },
        {
            date: "2025-11-25",
            type: "payment",
            amount: 7720.00,
            description: "Pago de crédito"
        }
    ]
}
```

### Supplier Model

```javascript
{
    id: 5,
    name: "Brenda Lopez Guillen",
    type: "Frecuente", // or "No frecuente"
    active: 1,
    created_at: "2025-01-01 00:00:00"
}
```

## Error Handling

### Frontend Validation

**Validaciones de formulario:**
- Proveedor requerido
- Tipo de pago requerido
- Cantidad mayor a 0
- Descripción opcional pero recomendada

**Mensajes de error:**
```javascript
{
    supplier_id: "Debe seleccionar un proveedor",
    payment_type_id: "Debe seleccionar un tipo de pago",
    amount: "La cantidad debe ser mayor a 0"
}
```

### Backend Validation

**Validaciones de negocio:**
- Usuario tiene permisos para la operación
- Fecha de pago no es futura
- Proveedor existe y está activo
- Solo nivel 1 puede editar/eliminar pagos del día actual

**Respuestas de error:**
```php
[
    'status' => 403,
    'message' => 'No tiene permisos para realizar esta acción'
]

[
    'status' => 400,
    'message' => 'Solo puede editar pagos del día actual'
]

[
    'status' => 404,
    'message' => 'Proveedor no encontrado'
]
```

### Error Codes

- **200**: Operación exitosa
- **400**: Validación fallida
- **403**: Sin permisos
- **404**: Recurso no encontrado
- **409**: Conflicto (duplicado)
- **500**: Error del servidor

## Testing Strategy

### Unit Tests

**Frontend:**
- Validación de formularios
- Cálculo de totales
- Formateo de moneda
- Filtrado de datos

**Backend:**
- Validación de permisos por nivel
- Cálculo de balances
- Consultas SQL
- Validación de duplicados

### Integration Tests

**Flujos completos:**
1. Captura de pago → Actualización de tabla → Recálculo de totales
2. Consulta de balance → Integración con compras → Generación de Excel
3. Cambio de fecha → Actualización de datos → Validación de permisos
4. Administración de proveedores → Actualización en selectores

### Test Cases

**Caso 1: Captura de pago exitosa (Nivel 1)**
```
Given: Usuario nivel 1 autenticado
When: Completa formulario con datos válidos
Then: Pago se guarda y tabla se actualiza
```

**Caso 2: Intento de edición por usuario nivel 2**
```
Given: Usuario nivel 2 autenticado
When: Intenta editar un pago
Then: Sistema muestra error de permisos
```

**Caso 3: Generación de concentrado**
```
Given: Rango de fechas seleccionado
When: Usuario solicita concentrado
Then: Sistema muestra balance con compras y pagos integrados
```

**Caso 4: Exportación a Excel**
```
Given: Concentrado generado
When: Usuario hace clic en exportar
Then: Sistema descarga archivo Excel con datos correctos
```

### Performance Tests

**Métricas objetivo:**
- Carga de tabla de pagos: < 1 segundo
- Generación de concentrado: < 3 segundos
- Exportación a Excel: < 5 segundos
- Respuesta de formularios: < 500ms

### Security Tests

**Validaciones de seguridad:**
- Inyección SQL en campos de texto
- XSS en descripciones
- CSRF en formularios
- Acceso directo a URLs sin permisos
- Manipulación de parámetros en peticiones AJAX

## Design Decisions

### 1. Integración con Módulo de Compras

**Decisión:** Consultar datos de compras desde el módulo existente en lugar de duplicar información.

**Razón:** 
- Evita inconsistencias de datos
- Mantiene una única fuente de verdad
- Facilita mantenimiento

**Implementación:**
```php
// En mdl-proveedor.php
function listBalance($array) {
    // Consulta pagos
    $payments = $this->listPayments($array);
    
    // Consulta compras desde módulo de compras
    require_once '../compras/mdl/mdl-compras.php';
    $comprasModel = new mdl_compras();
    $purchases = $comprasModel->listPurchasesBySupplier($array);
    
    // Combina y calcula balance
    return $this->calculateBalance($payments, $purchases);
}
```

### 2. Control de Acceso por Niveles

**Decisión:** Implementar validación de permisos tanto en frontend como backend.

**Razón:**
- Frontend: Mejora UX ocultando opciones no disponibles
- Backend: Garantiza seguridad real

**Implementación:**
```javascript
// Frontend
if (userLevel === 1) {
    // Mostrar botones de edición
}

// Backend
if ($_SESSION['nivel'] !== 1) {
    return ['status' => 403, 'message' => 'Sin permisos'];
}
```

### 3. Tabla Colapsable para Concentrado

**Decisión:** Usar tabla con filas colapsables agrupadas por proveedor.

**Razón:**
- Mejor visualización de grandes volúmenes de datos
- Permite ver resumen y detalle según necesidad
- Sigue patrón del módulo de Clientes

**Implementación:**
- Usar template `lsGenericTable()` del grupo-table.md
- Filas de grupo con totales
- Filas de detalle colapsables

### 4. Restricción de Edición por Fecha

**Decisión:** Solo permitir editar/eliminar pagos del día actual para nivel 1.

**Razón:**
- Previene modificación de registros históricos
- Mantiene integridad de reportes pasados
- Facilita auditoría

**Implementación:**
```php
function editPayment() {
    $paymentDate = $this->getPaymentById([$_POST['id']])['payment_date'];
    $today = date('Y-m-d');
    
    if ($paymentDate !== $today) {
        return ['status' => 400, 'message' => 'Solo puede editar pagos del día actual'];
    }
    
    // Continuar con edición
}
```

### 5. Exportación a Excel

**Decisión:** Generar archivo Excel en servidor y descargar.

**Razón:**
- Mejor formato y presentación
- Incluye estilos y fórmulas
- Compatible con sistemas contables

**Implementación:**
- Usar librería PHPSpreadsheet
- Generar archivo temporal
- Enviar headers de descarga
- Eliminar archivo temporal

## Integration Points

### 1. Módulo de Compras

**Punto de integración:** Consulta de compras a crédito por proveedor

**Datos compartidos:**
- supplier_id
- purchase_date
- amount
- description
- purchase_type (crédito)

**Método de integración:**
```php
// En mdl-proveedor.php
require_once '../compras/mdl/mdl-compras.php';
$comprasModel = new mdl_compras();
$purchases = $comprasModel->listPurchasesBySupplier([
    'supplier_id' => $supplierId,
    'fi' => $fi,
    'ff' => $ff,
    'type' => 'credito'
]);
```

### 2. Módulo de Administración

**Punto de integración:** Gestión de proveedores

**Datos compartidos:**
- Tabla suppliers
- CRUD de proveedores

**Método de integración:**
- Usar misma tabla suppliers
- Sincronizar cambios automáticamente
- Validar proveedores activos en selectores

### 3. Sistema de Autenticación

**Punto de integración:** Validación de niveles de acceso

**Datos compartidos:**
- user_id
- nivel (access level)
- udn_id

**Método de integración:**
```php
session_start();
$userLevel = $_SESSION['nivel'];
$udnId = $_POST['udn'] ?? $_SESSION['udn'];
```

## UI/UX Considerations

### Paleta de Colores

**Tema Corporativo:**
- Fondo principal: `#FFFFFF`
- Fondo secundario: `#F3F4F6`
- Texto principal: `#111827`
- Compras (verde): `#10B981` / `#D1FAE5`
- Pagos (rojo): `#EF4444` / `#FEE2E2`
- Botones primarios: `#003360`

### Responsive Design

**Breakpoints:**
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

**Adaptaciones:**
- Tabla colapsable en mobile
- Formularios en columna única en mobile
- Filtros apilados en mobile

### Accessibility

**Consideraciones:**
- Labels descriptivos en formularios
- Contraste de colores WCAG AA
- Navegación por teclado
- Mensajes de error claros
- Estados de carga visibles

### User Feedback

**Indicadores visuales:**
- Loading spinners durante peticiones
- Mensajes de éxito/error con SweetAlert2
- Confirmaciones antes de eliminar
- Totales actualizados en tiempo real
- Estados de botones (disabled durante guardado)

## Deployment Considerations

### File Structure

```
finanzas/
├── captura/
│   ├── js/
│   │   └── proveedor.js
│   ├── ctrl/
│   │   └── ctrl-proveedor.php
│   └── mdl/
│       └── mdl-proveedor.php
└── administrador/
    └── (módulo de administración de proveedores)
```

### Dependencies

**Frontend:**
- jQuery 3.x
- TailwindCSS 2.x
- CoffeeSoft framework
- SweetAlert2
- Moment.js (para fechas)
- DataTables (opcional)

**Backend:**
- PHP 7.4+
- MySQL 5.7+
- PHPSpreadsheet (para Excel)
- Clases CRUD y Utileria de CoffeeSoft

### Configuration

**Variables de entorno:**
```php
// En _conf.php
$bd_prefix = "rfwsmqex_";
$bd_name = "finanzas";
```

**Permisos de archivos:**
- Carpeta temporal para Excel: 777
- Archivos PHP: 644
- Carpetas: 755

### Migration Strategy

**Fase 1:** Desarrollo y pruebas en ambiente local
**Fase 2:** Migración de datos históricos (si aplica)
**Fase 3:** Despliegue en producción
**Fase 4:** Capacitación de usuarios
**Fase 5:** Monitoreo y ajustes

### Rollback Plan

En caso de problemas:
1. Restaurar archivos anteriores
2. Revertir cambios en base de datos
3. Notificar a usuarios
4. Analizar logs de error
5. Corregir y redesplegar
