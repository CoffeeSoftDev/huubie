# Design Document - Módulo de Inventario

## Overview

El módulo de Inventario es un sistema de gestión de movimientos de entrada y salida de productos que permite controlar el stock del almacén. Implementa una arquitectura MVC usando el framework CoffeeSoft, con componentes reutilizables jQuery + TailwindCSS en el frontend y PHP con MySQL en el backend.

El sistema permite crear listas de movimientos, agregar productos con cantidades, calcular automáticamente el impacto en el stock y mantener un historial completo de operaciones. Cada movimiento tiene un folio único autogenerado y puede estar en estado Activa o Cancelada.

## Architecture

### Frontend Architecture
- **Framework**: CoffeeSoft (jQuery + TailwindCSS)
- **Patrón**: Clase principal `Inventario` que extiende `Templates`
- **Componentes**: Tablas dinámicas, formularios modales, filtros, resúmenes en tiempo real
- **Comunicación**: AJAX mediante `useFetch()` para operaciones asíncronas

### Backend Architecture
- **Patrón**: MVC con separación clara de responsabilidades
- **Controlador**: `ctrl-inventario.php` - Lógica de negocio y validaciones
- **Modelo**: `mdl-inventario.php` - Acceso a datos mediante clase CRUD
- **Base de Datos**: MySQL con tablas relacionadas

### Database Schema

```
mtto_inventario_movimientos
├── id_movimiento (PK)
├── folio (UNIQUE)
├── fecha
├── tipo_movimiento (ENUM: 'Entrada', 'Salida')
├── total_productos
├── total_unidades
├── estado (ENUM: 'Activa', 'Cancelada')
└── fecha_creacion

mtto_inventario_detalle
├── id_detalle (PK)
├── id_movimiento (FK)
├── id_producto (FK → mtto_almacen)
├── cantidad
├── stock_anterior
└── stock_resultante

mtto_almacen (existente)
├── idAlmacen (PK)
├── Equipo (nombre del producto)
├── cantidad (stock actual)
└── ... (otros campos)
```

## Components and Interfaces

### Frontend Components

#### 1. Inventario (Clase Principal)
```javascript
class Inventario extends Templates {
    constructor(link, div_modulo)
    render()
    layout()
    filterBar()
    lsMovimientos()
    addMovimiento()
    editMovimiento(id)
    cancelMovimiento(id)
    jsonMovimiento()
}
```

#### 2. CapturaMovimiento (Clase para Captura de Productos)
```javascript
class CapturaMovimiento extends Templates {
    constructor(link, div_modulo)
    render(idMovimiento)
    layout()
    addProducto()
    deleteProducto(idDetalle)
    updateResumen()
    guardarMovimiento()
    cancelarCaptura()
}
```

### Backend Interfaces

#### Controlador (ctrl-inventario.php)
```php
class ctrl extends mdl {
    init()                    // Inicializa filtros y datos
    lsMovimientos()          // Lista movimientos con filtros
    getMovimiento()          // Obtiene un movimiento por ID
    addMovimiento()          // Crea nueva lista de movimiento
    editMovimiento()         // Actualiza movimiento existente
    cancelMovimiento()       // Cancela un movimiento
    
    // Detalle de productos
    lsDetalleMovimiento()    // Lista productos de un movimiento
    addProductoMovimiento()  // Agrega producto a movimiento
    deleteProductoMovimiento() // Elimina producto de movimiento
    guardarMovimiento()      // Confirma y actualiza stock
}
```

#### Modelo (mdl-inventario.php)
```php
class mdl extends CRUD {
    // Movimientos
    listMovimientos($array)
    getMovimientoById($id)
    createMovimiento($array)
    updateMovimiento($array)
    getMaxFolio()
    
    // Detalle
    listDetalleMovimiento($array)
    createDetalleMovimiento($array)
    deleteDetalleMovimientoById($id)
    
    // Stock
    getStockProducto($idProducto)
    updateStockProducto($array)
    
    // Selects
    lsTipoMovimiento()
    lsProductos()
}
```

## Data Models

### MovimientoInventario
```javascript
{
    id_movimiento: number,
    folio: string,           // "MOV-001", "MOV-002"
    fecha: date,
    tipo_movimiento: string, // "Entrada" | "Salida"
    total_productos: number,
    total_unidades: number,
    estado: string,          // "Activa" | "Cancelada"
    fecha_creacion: timestamp
}
```

### DetalleMovimiento
```javascript
{
    id_detalle: number,
    id_movimiento: number,
    id_producto: number,
    nombre_producto: string,
    cantidad: number,
    stock_anterior: number,
    stock_resultante: number
}
```

### Producto (mtto_almacen)
```javascript
{
    idAlmacen: number,
    Equipo: string,
    cantidad: number,  // Stock actual
    // ... otros campos
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Folio uniqueness
*For any* two movement lists in the system, their folios must be different
**Validates: Requirements 7.1, 7.4**

### Property 2: Stock calculation for entries
*For any* product and entry movement, the resulting stock equals the previous stock plus the movement quantity
**Validates: Requirements 6.1**

### Property 3: Stock calculation for exits
*For any* product and exit movement, the resulting stock equals the previous stock minus the movement quantity
**Validates: Requirements 6.2**

### Property 4: Movement state transition
*For any* movement that is saved, its state must change from initial to "Activa"
**Validates: Requirements 4.3**

### Property 5: Product count consistency
*For any* movement, the total_productos field must equal the count of distinct products in its detail records
**Validates: Requirements 9.2, 9.3**

### Property 6: Units count consistency
*For any* movement, the total_unidades field must equal the sum of all quantities in its detail records
**Validates: Requirements 9.3, 9.4**

### Property 7: Cancelled movement immutability
*For any* movement with state "Cancelada", no modifications to its products or quantities shall be allowed
**Validates: Requirements 5.4**

### Property 8: Minimum product validation
*For any* movement being saved, it must contain at least one product in its detail
**Validates: Requirements 4.1**

### Property 9: Positive quantity validation
*For any* product being added to a movement, its quantity must be greater than zero
**Validates: Requirements 3.3**

### Property 10: Stock reversion on cancellation
*For any* movement that is cancelled, the stock of all its products must be reverted to their state before the movement was saved
**Validates: Requirements 5.5**

### Property 11: Folio sequential increment
*For any* new movement created, its folio number must be exactly one greater than the maximum existing folio number
**Validates: Requirements 7.2**

### Property 12: Real-time summary update on addition
*For any* product added to a movement, the summary totals must immediately reflect the new product count and unit count
**Validates: Requirements 3.2, 9.2, 9.3**

### Property 13: Real-time summary update on deletion
*For any* product removed from a movement, the summary totals must immediately reflect the reduced product count and unit count
**Validates: Requirements 8.3, 8.4, 9.4**

## Error Handling

### Frontend Error Handling
- **Validación de formularios**: Campos obligatorios, formatos de fecha, cantidades positivas
- **Alertas visuales**: SweetAlert2 para confirmaciones y notificaciones
- **Manejo de respuestas**: Verificar `response.status` antes de actualizar UI
- **Stock negativo**: Advertencia visual cuando una salida resulta en stock negativo

### Backend Error Handling
- **Validación de datos**: Verificar campos requeridos y tipos de datos
- **Transacciones**: Usar transacciones MySQL para operaciones que afectan múltiples tablas
- **Códigos de estado**: Retornar códigos HTTP apropiados (200, 400, 404, 500)
- **Mensajes descriptivos**: Proporcionar mensajes claros de error al frontend

### Database Error Handling
- **Constraints**: UNIQUE en folio, FOREIGN KEY en relaciones
- **Validaciones**: CHECK constraints para cantidades positivas
- **Rollback**: Revertir cambios en caso de error durante transacciones

## Testing Strategy

### Unit Testing
El módulo implementará pruebas unitarias para verificar:
- Generación correcta de folios secuenciales
- Cálculos de stock para entradas y salidas
- Validaciones de campos obligatorios
- Actualización de totales en resumen
- Cambios de estado de movimientos

### Property-Based Testing
Se utilizará **fast-check** (JavaScript) para validar las propiedades de corrección mediante pruebas generativas:

**Configuración**:
- Mínimo 100 iteraciones por propiedad
- Generadores personalizados para movimientos, productos y cantidades
- Cada test debe referenciar explícitamente la propiedad del diseño

**Propiedades a probar**:
1. Unicidad de folios (Property 1)
2. Cálculo correcto de stock en entradas (Property 2)
3. Cálculo correcto de stock en salidas (Property 3)
4. Consistencia de contadores de productos (Property 5)
5. Consistencia de contadores de unidades (Property 6)
6. Inmutabilidad de movimientos cancelados (Property 7)
7. Validación de cantidad mínima de productos (Property 8)
8. Validación de cantidades positivas (Property 9)
9. Reversión de stock en cancelaciones (Property 10)

**Formato de anotación**:
```javascript
// **Feature: inventario, Property 1: Folio uniqueness**
// **Validates: Requirements 7.1, 7.4**
fc.assert(fc.property(
    fc.array(movimientoGenerator(), { minLength: 2 }),
    (movimientos) => {
        const folios = movimientos.map(m => m.folio);
        return new Set(folios).size === folios.length;
    }
), { numRuns: 100 });
```

### Integration Testing
- Flujo completo: Crear movimiento → Agregar productos → Guardar → Verificar stock
- Flujo de cancelación: Crear movimiento → Guardar → Cancelar → Verificar reversión de stock
- Flujo de edición: Crear movimiento → Editar → Agregar/Eliminar productos → Guardar

### Manual Testing
- Verificar interfaz responsive en diferentes dispositivos
- Probar filtros y búsquedas con diferentes combinaciones
- Validar notificaciones y mensajes de error
- Verificar estados visuales (Activa/Cancelada)

## Implementation Notes

### CoffeeSoft Components to Use
- `primaryLayout()` - Layout principal con filterBar y container
- `createfilterBar()` - Barra de filtros con selects y datepicker
- `createTable()` - Tabla dinámica con paginación
- `createModalForm()` - Modal para crear nuevo movimiento
- `createForm()` - Formulario de captura de productos
- `swalQuestion()` - Confirmaciones para cancelar
- `dataPicker()` - Selector de rango de fechas
- `useFetch()` - Peticiones AJAX asíncronas

### Database Considerations
- Índices en `folio`, `fecha`, `tipo_movimiento`, `estado` para optimizar búsquedas
- Índice compuesto en `(id_movimiento, id_producto)` para detalle
- Trigger o lógica de aplicación para mantener `total_productos` y `total_unidades` sincronizados

### Performance Considerations
- Paginación en tabla principal (15 registros por página)
- Carga lazy de productos en selector
- Actualización optimista de UI antes de confirmar con backend
- Cache de lista de productos para evitar consultas repetidas

### Security Considerations
- Validación de permisos de usuario en backend
- Sanitización de inputs con `$this->util->sql()`
- Prevención de SQL injection mediante prepared statements
- Validación de que el movimiento pertenece al usuario antes de editar/cancelar
