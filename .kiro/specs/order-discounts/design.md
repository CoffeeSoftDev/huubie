# Design Document: Order Discounts

## Overview

Sistema de gestión de descuentos para pedidos integrado al módulo existente de pedidos (`ctrl-pedidos.php`, `mdl-pedidos.php`, `app.js`). Permite a usuarios administradores aplicar, editar y eliminar descuentos con validaciones de negocio y registro de historial.

## Architecture

El sistema sigue la arquitectura MVC existente de CoffeeSoft:

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (app.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ addDiscount │  │editDiscount │  │  deleteDiscount     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                  Controller (ctrl-pedidos.php)               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ addDiscount │  │editDiscount │  │  deleteDiscount     │  │
│  │ getDiscount │  │             │  │                     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    Model (mdl-pedidos.php)                   │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │  updateOrder()   │  │  addHistories() (existente)      │ │
│  │  getOrderID()    │  │                                  │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database (MySQL)                          │
│  ┌──────────────┐  ┌──────────────────────────────────────┐ │
│  │    order     │  │         order_histories              │ │
│  │  - discount  │  │  - action, comment, type             │ │
│  │  - total_pay │  │                                      │ │
│  └──────────────┘  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Controller Methods (ctrl-pedidos.php)

```php
// Aplicar descuento a un pedido
function addDiscount() {
    // Validar permisos (rol == 1)
    // Validar monto (0 <= discount <= total_pay)
    // Actualizar order.discount
    // Registrar en historial
    // Retornar status, message, data
}

// Obtener información de descuento
function getDiscount() {
    // Obtener order por ID
    // Calcular totales (total, discount, saldo)
    // Retornar hasDiscount, discount, totalFinal, balance
}

// Editar descuento existente
function editDiscount() {
    // Validar permisos
    // Obtener descuento anterior
    // Validar nuevo monto
    // Actualizar order.discount
    // Registrar cambio en historial (valor anterior y nuevo)
}

// Eliminar descuento
function deleteDiscount() {
    // Validar permisos
    // Establecer discount = 0
    // Registrar eliminación en historial
}
```

### Frontend Methods (app.js)

```javascript
// Modal para aplicar descuento
addDiscount(orderId) {
    // Obtener info actual del pedido
    // Mostrar modal con formulario
    // Validar monto en cliente
    // Enviar a backend
    // Actualizar tabla
}

// Modal para editar descuento
editDiscount(orderId) {
    // Obtener descuento actual
    // Mostrar modal con valor precargado
    // Validar y enviar
}

// Confirmar eliminación de descuento
deleteDiscount(orderId) {
    // Mostrar swalQuestion de confirmación
    // Enviar a backend
    // Actualizar tabla
}
```

## Data Models

### Tabla: order (existente)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | INT | PK |
| discount | DECIMAL(10,2) | Monto de descuento aplicado |
| info_discount | VARCHAR(255) | Descripción/razón del descuento |
| total_pay | DECIMAL(10,2) | Total del pedido |

### Tabla: order_histories (existente)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | INT | PK |
| order_id | INT | FK a order |
| title | VARCHAR(100) | Título de la acción |
| action | VARCHAR(255) | Descripción de la acción |
| comment | TEXT | Comentario adicional |
| type | VARCHAR(50) | Tipo: 'discount' |
| date_action | DATETIME | Fecha de la acción |
| usr_users_id | INT | Usuario que realizó la acción |

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Discount Amount Validation

*For any* discount amount and order total, the system SHALL accept the discount only if 0 <= discount <= total_pay. Any discount outside this range SHALL be rejected with an appropriate error message.

**Validates: Requirements 1.1, 2.4, 5.1, 5.2, 5.3**

### Property 2: Discount Persistence

*For any* valid discount applied to an order, querying the order immediately after SHALL return the exact discount value that was set.

**Validates: Requirements 1.2, 2.2**

### Property 3: History Recording

*For any* discount operation (add, edit, delete), the system SHALL create a history record containing the action type, timestamp, and user who performed the action.

**Validates: Requirements 1.3, 2.3, 3.2**

### Property 4: Permission Enforcement

*For any* user with role != 1 (non-admin), attempting to add, edit, or delete a discount SHALL result in a 403 status code rejection.

**Validates: Requirements 1.4, 3.3**

### Property 5: Balance Calculation

*For any* order with total_pay, discount, and total_paid values, the calculated balance SHALL equal (total_pay - discount - total_paid).

**Validates: Requirements 4.2, 5.4**

### Property 6: HasDiscount Flag

*For any* order, hasDiscount SHALL be true if and only if discount > 0.

**Validates: Requirements 4.3**

## Error Handling

| Código | Escenario | Mensaje |
|--------|-----------|---------|
| 200 | Operación exitosa | "Descuento aplicado/actualizado/eliminado correctamente" |
| 400 | Monto inválido | "El monto del descuento no puede ser negativo" |
| 400 | Descuento excede total | "El descuento no puede ser mayor al total del pedido" |
| 403 | Sin permisos | "No tienes permisos para gestionar descuentos" |
| 404 | Pedido no encontrado | "El pedido especificado no existe" |
| 500 | Error interno | "Error al procesar la operación de descuento" |

## Testing Strategy

### Unit Tests

- Validación de montos de descuento (negativos, cero, positivos, excede total)
- Verificación de permisos por rol
- Cálculo correcto de saldos
- Registro en historial

### Property-Based Tests

Usar PHPUnit con generadores para:
- Generar montos aleatorios y verificar validaciones
- Generar combinaciones de total/discount/paid y verificar cálculos
- Simular usuarios con diferentes roles

### Integration Tests

- Flujo completo: aplicar → editar → eliminar descuento
- Verificar actualización de UI después de cada operación
- Verificar historial después de múltiples operaciones
