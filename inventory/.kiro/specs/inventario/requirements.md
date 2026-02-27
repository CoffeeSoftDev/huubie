# Requirements Document - Módulo de Inventario

## Introduction

El módulo de Inventario permite gestionar movimientos de entrada y salida de productos en el almacén. Los usuarios pueden crear listas de movimientos, agregar productos con cantidades específicas, visualizar resúmenes en tiempo real y controlar el estado de cada movimiento. El sistema actualiza automáticamente las existencias del inventario según el tipo de movimiento registrado.

## Glossary

- **Sistema**: Módulo de Inventario del ERP CoffeeSoft
- **Usuario**: Persona autorizada para gestionar movimientos de inventario
- **Lista de Movimiento**: Registro que agrupa productos con un tipo específico (Entrada/Salida)
- **Movimiento**: Operación de entrada o salida de productos del inventario
- **Folio**: Identificador único autogenerado para cada lista de movimiento
- **Stock**: Cantidad actual de unidades disponibles de un producto
- **Estado Activa**: Lista de movimiento confirmada que afecta el inventario
- **Estado Cancelada**: Lista de movimiento anulada que no afecta el inventario
- **Entrada**: Movimiento que incrementa el stock de productos
- **Salida**: Movimiento que decrementa el stock de productos

## Requirements

### Requirement 1

**User Story:** Como usuario del sistema, quiero visualizar y administrar las listas de movimientos de inventario, para controlar entradas, salidas, cantidades y estados de los movimientos.

#### Acceptance Criteria

1. WHEN el usuario accede al módulo de inventario, THE Sistema SHALL mostrar una interfaz con pestañas de navegación y componentes de filtrado
2. WHEN el usuario selecciona filtros, THE Sistema SHALL permitir filtrar por tipo de movimiento (Entrada/Salida) y rango de fechas
3. WHEN el usuario visualiza la tabla principal, THE Sistema SHALL mostrar columnas con Folio, Fecha, Tipo de movimiento, Total de productos, Estado y Acciones
4. WHEN el usuario hace clic en "Nueva lista", THE Sistema SHALL abrir un modal de configuración para crear un nuevo movimiento
5. WHEN el Sistema muestra estados, THE Sistema SHALL representar visualmente "Activa" y "Cancelada" con indicadores diferenciados

### Requirement 2

**User Story:** Como usuario del sistema, quiero crear una nueva lista de inventario con folio, fecha y tipo, para registrar un movimiento de entrada o salida.

#### Acceptance Criteria

1. WHEN el usuario abre el modal de nueva lista, THE Sistema SHALL mostrar campos para Folio (autogenerado), Fecha y Tipo de movimiento
2. WHEN el usuario completa los campos, THE Sistema SHALL proporcionar botones "Cancelar" y "Crear Lista"
3. WHEN el usuario intenta crear una lista, THE Sistema SHALL validar que todos los campos obligatorios estén completos
4. WHEN la lista se crea exitosamente, THE Sistema SHALL redirigir al usuario a la vista de captura de productos
5. WHEN la lista se crea exitosamente, THE Sistema SHALL mostrar una notificación "Lista creada"

### Requirement 3

**User Story:** Como usuario del sistema, quiero agregar productos a la lista indicando la cantidad, para construir el detalle del movimiento.

#### Acceptance Criteria

1. WHEN el usuario está en la vista de captura, THE Sistema SHALL mostrar una sección "Agregar Producto" con selector de producto, campo de cantidad y botón de agregar
2. WHEN el usuario agrega un producto, THE Sistema SHALL actualizar el resumen de la lista en tiempo real
3. WHEN el usuario ingresa una cantidad, THE Sistema SHALL validar que la cantidad sea mayor a cero
4. WHEN el usuario agrega productos, THE Sistema SHALL mostrar una tabla con los productos agregados y sus cantidades
5. WHEN un producto se agrega exitosamente, THE Sistema SHALL mostrar una notificación "Producto agregado"

### Requirement 4

**User Story:** Como usuario del sistema, quiero guardar la lista o cancelarla, para validar y actualizar inventarios.

#### Acceptance Criteria

1. WHEN el usuario intenta guardar una lista, THE Sistema SHALL validar que contenga al menos un producto
2. WHEN una lista se guarda exitosamente, THE Sistema SHALL actualizar las existencias de los productos según el tipo de movimiento
3. WHEN una lista se guarda exitosamente, THE Sistema SHALL cambiar el estado de la lista a "Activa"
4. WHEN el usuario hace clic en "Cancelar", THE Sistema SHALL regresar a la vista principal sin guardar cambios
5. WHEN una lista se guarda exitosamente, THE Sistema SHALL mostrar una notificación "Lista guardada"

### Requirement 5

**User Story:** Como usuario del sistema, quiero modificar listas activas o cancelarlas, para corregir errores de captura.

#### Acceptance Criteria

1. WHEN una lista tiene estado "Activa", THE Sistema SHALL permitir editar sus productos y cantidades
2. WHEN el usuario selecciona cancelar una lista, THE Sistema SHALL cambiar el estado a "Cancelada"
3. WHEN el usuario intenta cancelar una lista, THE Sistema SHALL solicitar confirmación antes de ejecutar la acción
4. WHEN una lista tiene estado "Cancelada", THE Sistema SHALL impedir cualquier edición de la misma
5. WHEN una lista se cancela, THE Sistema SHALL revertir los cambios de stock realizados por esa lista

### Requirement 6

**User Story:** Como usuario del sistema, quiero que el sistema calcule automáticamente el stock resultante, para conocer el impacto de cada movimiento.

#### Acceptance Criteria

1. WHEN el usuario agrega un producto con tipo "Entrada", THE Sistema SHALL sumar la cantidad al stock actual del producto
2. WHEN el usuario agrega un producto con tipo "Salida", THE Sistema SHALL restar la cantidad al stock actual del producto
3. WHEN el Sistema calcula el stock resultante, THE Sistema SHALL mostrar el stock actual, la cantidad del movimiento y el stock resultante
4. WHEN el stock resultante es negativo en una salida, THE Sistema SHALL mostrar una advertencia al usuario
5. WHEN el usuario visualiza la tabla de productos agregados, THE Sistema SHALL mostrar en tiempo real el stock actual y el stock resultante

### Requirement 7

**User Story:** Como usuario del sistema, quiero que el sistema genere folios únicos automáticamente, para identificar cada movimiento sin duplicados.

#### Acceptance Criteria

1. WHEN el usuario crea una nueva lista, THE Sistema SHALL generar automáticamente un folio único con formato "MOV-XXX"
2. WHEN el Sistema genera un folio, THE Sistema SHALL incrementar secuencialmente el número del último folio registrado
3. WHEN el Sistema muestra el folio, THE Sistema SHALL presentarlo en el modal de creación como campo de solo lectura
4. WHEN el Sistema genera folios, THE Sistema SHALL garantizar que no existan duplicados en la base de datos
5. WHEN el usuario visualiza listas existentes, THE Sistema SHALL mostrar el folio como identificador principal en la tabla

### Requirement 8

**User Story:** Como usuario del sistema, quiero eliminar productos de una lista antes de guardarla, para corregir errores de captura.

#### Acceptance Criteria

1. WHEN el usuario visualiza la tabla de productos agregados, THE Sistema SHALL mostrar un botón de eliminar para cada producto
2. WHEN el usuario hace clic en eliminar, THE Sistema SHALL remover el producto de la lista sin confirmación
3. WHEN un producto se elimina, THE Sistema SHALL actualizar automáticamente el resumen de la lista
4. WHEN un producto se elimina, THE Sistema SHALL recalcular el total de productos y unidades
5. WHEN el último producto se elimina, THE Sistema SHALL mantener la lista abierta permitiendo agregar nuevos productos

### Requirement 9

**User Story:** Como usuario del sistema, quiero visualizar un resumen de la lista en tiempo real, para conocer el total de productos y unidades antes de guardar.

#### Acceptance Criteria

1. WHEN el usuario está capturando una lista, THE Sistema SHALL mostrar un panel de resumen con Folio, Tipo y Total de productos
2. WHEN el usuario agrega un producto, THE Sistema SHALL actualizar inmediatamente el contador de productos en el resumen
3. WHEN el usuario agrega un producto, THE Sistema SHALL actualizar inmediatamente el total de unidades en el resumen
4. WHEN el usuario elimina un producto, THE Sistema SHALL actualizar inmediatamente los totales en el resumen
5. WHEN el resumen muestra el tipo de movimiento, THE Sistema SHALL usar indicadores visuales diferenciados para Entrada y Salida
