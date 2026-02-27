# Requirements Document - Módulo de Compras

## Introduction

El módulo de Compras es un sistema integral para la gestión y administración de compras realizadas por la unidad de negocio. Permite capturar, consultar y administrar diferentes tipos de compras (Fondo fijo, Corporativo, Crédito) con filtros dinámicos, control de accesos por perfil de usuario, y seguimiento en tiempo real de totales y saldos.

## Glossary

- **Sistema**: Aplicación web de gestión financiera basada en CoffeeSoft Framework
- **Usuario**: Persona con acceso al sistema según su perfil asignado
- **Compra**: Registro de adquisición de productos o servicios
- **Fondo Fijo**: Tipo de compra realizada con efectivo de caja chica
- **Compra Corporativa**: Tipo de compra realizada con métodos de pago empresariales
- **Compra a Crédito**: Tipo de compra realizada con proveedores que otorgan crédito
- **Clase de Insumo**: Categoría de producto (Costo directo, Costo indirecto, Gastos operativos, etc.)
- **Proveedor**: Entidad que suministra productos o servicios
- **Método de Pago**: Forma de pago utilizada (Tarjeta de crédito, Transferencia, Efectivo, etc.)
- **Reembolso**: Devolución de dinero del fondo fijo
- **Módulo Bloqueado**: Estado del módulo donde se restringen ciertas operaciones de edición
- **UDN**: Unidad de Negocio

## Requirements

### Requirement 1: Interfaz Principal del Módulo

**User Story:** Como usuario del sistema, quiero acceder al módulo de compras con sus pestañas y componentes principales, para registrar, consultar y administrar las compras realizadas en la unidad de negocio.

#### Acceptance Criteria

1. WHEN el usuario accede al módulo de compras, THE Sistema SHALL renderizar la interfaz con pestañas de navegación (Compras, Concentrado)
2. WHILE el usuario visualiza la interfaz principal, THE Sistema SHALL mostrar los totales de compras generales, por tipo de compra y saldo del fondo fijo
3. WHEN el usuario modifica la fecha de consulta, THE Sistema SHALL actualizar en tiempo real la tabla de compras y los totales
4. THE Sistema SHALL incluir botones de acción "Subir archivos de compras" y "Registrar nueva compra"
5. THE Sistema SHALL mantener visible en todo momento la suma total de compras y el saldo actual del fondo fijo

### Requirement 2: Registro de Nueva Compra

**User Story:** Como usuario con acceso de captura, quiero registrar una nueva compra en el sistema, para mantener actualizada la información financiera y de insumos.

#### Acceptance Criteria

1. WHEN el usuario hace clic en "Registrar nueva compra", THE Sistema SHALL desplegar un formulario modal con los campos requeridos
2. THE Sistema SHALL incluir los siguientes campos en el formulario: Categoría de producto, Producto, Tipo de compra, Proveedor, Método de pago, Subtotal, Impuesto, Descripción
3. WHEN el usuario selecciona una clase de insumo, THE Sistema SHALL mostrar únicamente los productos relacionados a esa categoría
4. IF el usuario selecciona tipo de compra "Corporativo", THEN THE Sistema SHALL desplegar las formas de pago disponibles
5. IF el usuario selecciona tipo de compra "Crédito", THEN THE Sistema SHALL mostrar los proveedores asociados con crédito
6. THE Sistema SHALL ocultar los campos no aplicables hasta que se cumplan las condiciones de selección
7. WHEN el usuario guarda la compra, THE Sistema SHALL validar todos los campos requeridos y actualizar la tabla en tiempo real

### Requirement 3: Edición y Eliminación de Compras

**User Story:** Como usuario del sistema, quiero editar o eliminar compras registradas, para corregir errores o actualizar la información registrada.

#### Acceptance Criteria

1. WHEN el usuario hace clic en el botón de editar, THE Sistema SHALL desplegar un modal con los datos de la compra precargados
2. WHILE el módulo está bloqueado, THE Sistema SHALL restringir la modificación de monto y tipo de compra
3. THE Sistema SHALL permitir modificar todos los campos excepto monto y tipo de compra cuando existe un reembolso asociado
4. WHEN el usuario hace clic en eliminar, THE Sistema SHALL mostrar un mensaje de confirmación antes de proceder
5. WHEN el usuario confirma la eliminación, THE Sistema SHALL eliminar el registro y actualizar la tabla en tiempo real
6. THE Sistema SHALL respetar las restricciones de reembolsos de fondo fijo al editar o eliminar

### Requirement 4: Filtros y Visualización Dinámica

**User Story:** Como usuario del sistema, quiero filtrar las compras registradas según tipo y método de pago, para consultar fácilmente la información específica de cada tipo de compra.

#### Acceptance Criteria

1. THE Sistema SHALL incluir un filtro principal de tipo de compra con opciones: Fondo fijo, Corporativo, Crédito
2. WHEN el usuario selecciona "Corporativo" en el filtro de tipo, THE Sistema SHALL mostrar el filtro de método de pago
3. WHILE el tipo de compra no es "Corporativo", THE Sistema SHALL mantener oculto el filtro de método de pago
4. WHEN el usuario aplica un filtro, THE Sistema SHALL actualizar dinámicamente la tabla según los criterios seleccionados
5. THE Sistema SHALL mantener los totales actualizados según los filtros aplicados

### Requirement 5: Reporte Concentrado de Compras

**User Story:** Como usuario con nivel de gerencia, quiero visualizar un concentrado de compras dentro de un rango de fechas, para analizar los gastos generales y balance del fondo fijo.

#### Acceptance Criteria

1. WHEN el usuario accede a la pestaña "Concentrado", THE Sistema SHALL mostrar una tabla comparativa por clase de producto y día
2. THE Sistema SHALL incluir subtotales, impuestos y totales diarios en el reporte
3. THE Sistema SHALL permitir filtrar por rango de fechas y tipo de compra
4. THE Sistema SHALL mostrar saldo inicial, salidas del fondo fijo y saldo final
5. WHEN el usuario hace clic en "Exportar", THE Sistema SHALL generar un archivo Excel con los resultados del reporte

### Requirement 6: Gestión de Accesos y Restricciones

**User Story:** Como administrador del sistema, quiero gestionar los niveles de acceso del módulo de compras, para asegurar que cada usuario opere según su rol y permisos definidos.

#### Acceptance Criteria

1. THE Sistema SHALL configurar cuatro niveles de acceso: Captura, Gerencia, Dirección, Contabilidad
2. WHILE el usuario tiene perfil de Captura, THE Sistema SHALL limitar las funciones de edición y eliminación
3. WHERE el usuario tiene perfil de Contabilidad, THE Sistema SHALL permitir bloquear o desbloquear el módulo
4. WHEN existe un reembolso asociado, THE Sistema SHALL restringir la modificación de monto y tipo de compra
5. THE Sistema SHALL validar permisos antes de ejecutar cualquier operación de escritura

### Requirement 7: Integración con Clase Costo Directo

**User Story:** Como usuario del sistema, quiero que la clase "Costo Directo" esté integrada con sus productos relacionados, para registrar compras de esta categoría correctamente.

#### Acceptance Criteria

1. WHEN el usuario selecciona "Costo directo" como categoría, THE Sistema SHALL cargar los productos asociados a esta clase
2. THE Sistema SHALL mantener la relación entre clase de insumo y productos en la base de datos
3. THE Sistema SHALL incluir "Costo directo" en los reportes y filtros disponibles
4. THE Sistema SHALL calcular correctamente los totales de compras de costo directo

### Requirement 8: Actualización en Tiempo Real

**User Story:** Como usuario del sistema, quiero que los totales y la tabla se actualicen en tiempo real, para tener información precisa y actualizada en todo momento.

#### Acceptance Criteria

1. WHEN el usuario registra una nueva compra, THE Sistema SHALL actualizar inmediatamente los totales y la tabla sin recargar la página
2. WHEN el usuario edita una compra, THE Sistema SHALL recalcular los totales afectados en tiempo real
3. WHEN el usuario elimina una compra, THE Sistema SHALL actualizar los totales y remover la fila de la tabla instantáneamente
4. WHEN el usuario cambia el rango de fechas, THE Sistema SHALL actualizar la tabla y totales según el nuevo período seleccionado
5. THE Sistema SHALL mantener sincronizados los totales generales con los totales por tipo de compra
