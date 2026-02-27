# Implementation Plan: Order Discounts

## Overview

Implementación del sistema de descuentos para pedidos siguiendo la arquitectura MVC de CoffeeSoft. Se integra con los archivos existentes `ctrl-pedidos.php`, `mdl-pedidos.php` y `app.js`.

## Tasks

- [x] 1. Implementar métodos del controlador (Backend)
  - [x] 1.1 Implementar método `addDiscount()` en ctrl-pedidos.php
    - Validar permisos (rol == 1)
    - Validar monto de descuento (0 <= discount <= total_pay)
    - Actualizar campo discount en order
    - Registrar acción en historial usando logHistory()
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Implementar método `getDiscount()` en ctrl-pedidos.php
    - Obtener información del pedido
    - Calcular totales (total, discount, balance)
    - Retornar hasDiscount flag
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 1.3 Implementar método `editDiscount()` en ctrl-pedidos.php
    - Validar permisos
    - Obtener descuento anterior
    - Validar nuevo monto
    - Actualizar discount y registrar cambio en historial
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 1.4 Implementar método `deleteDiscount()` en ctrl-pedidos.php
    - Validar permisos
    - Establecer discount = 0
    - Registrar eliminación en historial
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 2. Implementar métodos del frontend (JavaScript)
  - [x] 2.1 Implementar método `addDiscount(orderId)` en app.js
    - Crear modal con formulario de descuento
    - Validar monto en cliente antes de enviar
    - Llamar a backend y actualizar tabla
    - _Requirements: 1.1, 1.2_

  - [x] 2.2 Implementar método `editDiscount(orderId)` en app.js
    - Obtener descuento actual via getDiscount
    - Mostrar modal con valor precargado
    - Validar y enviar actualización
    - _Requirements: 2.1, 2.2_

  - [x] 2.3 Implementar método `deleteDiscount(orderId)` en app.js
    - Mostrar confirmación con swalQuestion
    - Enviar eliminación a backend
    - Actualizar tabla de pedidos
    - _Requirements: 3.1_

- [x] 3. Integrar opciones de descuento en dropdown de pedidos
  - [x] 3.1 Agregar opciones al dropdown en función `dropdownOrder()`
    - Agregar opción "Aplicar descuento" (solo si no tiene descuento)
    - Agregar opción "Editar descuento" (solo si tiene descuento)
    - Agregar opción "Eliminar descuento" (solo si tiene descuento)
    - Mostrar opciones solo para rol admin
    - _Requirements: 1.4, 3.3_

- [ ] 4. Checkpoint - Verificar funcionalidad básica
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 5. Escribir tests unitarios
  - [ ]* 5.1 Test de validación de montos
    - **Property 1: Discount Amount Validation**
    - **Validates: Requirements 1.1, 5.1, 5.2**

  - [ ]* 5.2 Test de permisos por rol
    - **Property 4: Permission Enforcement**
    - **Validates: Requirements 1.4, 3.3**

  - [ ]* 5.3 Test de cálculo de balance
    - **Property 5: Balance Calculation**
    - **Validates: Requirements 4.2, 5.4**

- [ ] 6. Final checkpoint - Verificar integración completa
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- El sistema reutiliza métodos existentes: `updateOrder()`, `addHistories()`, `logHistory()`
- La validación de permisos usa `$_SESSION['ROLID'] == 1` (patrón existente)
- El historial usa el tipo 'discount' para filtrar acciones de descuento
