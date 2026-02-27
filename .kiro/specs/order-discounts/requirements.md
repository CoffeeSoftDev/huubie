# Requirements Document

## Introduction

Sistema de gestión de descuentos para el módulo de pedidos. Permite aplicar, editar y eliminar descuentos en pedidos, con validaciones de permisos y registro de historial de cambios.

## Glossary

- **Order_System**: Sistema principal de gestión de pedidos
- **Discount_Manager**: Componente encargado de gestionar descuentos en pedidos
- **Order**: Registro de pedido con información de cliente, productos y totales
- **Discount**: Monto de descuento aplicado a un pedido
- **User_Role**: Nivel de permisos del usuario (1=Admin, otros=Usuario regular)

## Requirements

### Requirement 1: Aplicar Descuento a Pedido

**User Story:** As a usuario administrador, I want to aplicar un descuento a un pedido existente, so that puedo ofrecer promociones o ajustes de precio a los clientes.

#### Acceptance Criteria

1. WHEN un usuario con rol administrador solicita aplicar un descuento, THE Discount_Manager SHALL validar que el monto del descuento no exceda el total del pedido
2. WHEN el descuento es válido, THE Discount_Manager SHALL actualizar el campo `discount` del pedido con el monto especificado
3. WHEN se aplica un descuento exitosamente, THE Order_System SHALL registrar la acción en el historial del pedido
4. IF un usuario sin permisos de administrador intenta aplicar un descuento, THEN THE Discount_Manager SHALL rechazar la operación con código 403

### Requirement 2: Editar Descuento Existente

**User Story:** As a usuario administrador, I want to modificar un descuento previamente aplicado, so that puedo corregir errores o ajustar el monto según sea necesario.

#### Acceptance Criteria

1. WHEN un administrador solicita editar un descuento, THE Discount_Manager SHALL obtener el descuento actual del pedido
2. WHEN el nuevo monto de descuento es válido, THE Discount_Manager SHALL actualizar el registro con el nuevo valor
3. WHEN se modifica un descuento, THE Order_System SHALL registrar el cambio en el historial incluyendo el valor anterior y el nuevo
4. IF el nuevo descuento excede el total del pedido, THEN THE Discount_Manager SHALL rechazar la operación con mensaje de error

### Requirement 3: Eliminar Descuento

**User Story:** As a usuario administrador, I want to eliminar un descuento aplicado a un pedido, so that puedo revertir descuentos aplicados por error.

#### Acceptance Criteria

1. WHEN un administrador solicita eliminar un descuento, THE Discount_Manager SHALL establecer el campo `discount` a 0
2. WHEN se elimina un descuento, THE Order_System SHALL registrar la eliminación en el historial del pedido
3. IF un usuario sin permisos intenta eliminar un descuento, THEN THE Discount_Manager SHALL rechazar la operación con código 403

### Requirement 4: Obtener Información de Descuento

**User Story:** As a usuario del sistema, I want to consultar el descuento aplicado a un pedido, so that puedo ver el detalle del ajuste de precio.

#### Acceptance Criteria

1. WHEN un usuario solicita información de descuento de un pedido, THE Discount_Manager SHALL retornar el monto del descuento actual
2. THE Discount_Manager SHALL calcular y retornar el total final (total_pay - discount)
3. THE Discount_Manager SHALL indicar si el pedido tiene descuento aplicado (hasDiscount: true/false)

### Requirement 5: Validación de Montos

**User Story:** As a sistema, I want to validar los montos de descuento, so that se mantenga la integridad de los datos financieros.

#### Acceptance Criteria

1. THE Discount_Manager SHALL rechazar descuentos con valores negativos
2. THE Discount_Manager SHALL rechazar descuentos que excedan el total del pedido
3. THE Discount_Manager SHALL aceptar descuentos con valor 0 (equivalente a sin descuento)
4. WHEN se aplica un descuento, THE Order_System SHALL recalcular el saldo pendiente (total - discount - pagado)
