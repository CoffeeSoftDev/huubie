# Requirements Document - Módulo de Costos

## Introduction

El módulo de Costos es un sistema de consulta y análisis financiero que permite visualizar el concentrado diario de costos directos y salidas de almacén. Este módulo está diseñado exclusivamente para consulta (solo lectura), sin capacidad de edición, garantizando la integridad de la información financiera.

El sistema integra datos de los módulos de Compras y Almacén, presentándolos en un formato consolidado por día dentro de un rango de fechas seleccionado, con capacidad de filtrado por unidad de negocio y exportación a Excel.

## Glossary

- **Sistema**: Módulo de Costos del sistema ERP CoffeeSoft
- **Usuario**: Persona con acceso al sistema de nivel 2 o 3
- **Concentrado**: Tabla consolidada que muestra costos directos y salidas de almacén por día
- **Costo Directo**: Gasto registrado en el módulo de Compras
- **Salida de Almacén**: Movimiento de salida registrado en el módulo de Almacén
- **UDN**: Unidad de Negocio (identificador de área operativa)
- **Rango de Fechas**: Período definido por fecha inicial y fecha final
- **Exportación**: Proceso de generar archivo Excel con los datos consultados
- **Nivel de Usuario**: Clasificación de permisos (nivel 2: consulta básica, nivel 3: consulta con filtros)

## Requirements

### Requirement 1

**User Story:** Como usuario de segundo o tercer nivel, quiero visualizar el concentrado diario de costos directos y salidas de almacén dentro de un rango de fechas, para analizar la operación diaria sin modificar información.

#### Acceptance Criteria

1. WHEN el usuario accede al módulo THEN el Sistema SHALL mostrar una interfaz con selector de rango de fechas y tabla de concentrado vacía
2. WHEN el usuario selecciona un rango de fechas válido THEN el Sistema SHALL consultar y mostrar los costos directos y salidas de almacén agrupados por día
3. WHEN el Sistema muestra el concentrado THEN el Sistema SHALL incluir columnas para fecha, costos directos, salidas de almacén y totales diarios
4. WHEN el Sistema calcula los datos THEN el Sistema SHALL mostrar totales generales al final de la tabla
5. WHEN el usuario intenta realizar cualquier acción de edición THEN el Sistema SHALL impedir la modificación de datos

### Requirement 2

**User Story:** Como usuario del sistema, quiero exportar la información consultada a un archivo Excel, para generar reportes, conciliaciones y análisis externos.

#### Acceptance Criteria

1. WHEN el usuario visualiza datos en el concentrado THEN el Sistema SHALL mostrar un botón visible "Exportar a Excel"
2. WHEN el usuario presiona el botón de exportación THEN el Sistema SHALL generar un archivo Excel con los datos actualmente filtrados
3. WHEN el Sistema genera el archivo Excel THEN el Sistema SHALL mantener el formato de tabla y encabezados del concentrado
4. WHEN el archivo Excel es generado THEN el Sistema SHALL incluir el rango de fechas y filtros aplicados en el nombre del archivo
5. WHEN la exportación finaliza THEN el Sistema SHALL descargar automáticamente el archivo al dispositivo del usuario

### Requirement 3

**User Story:** Como usuario de tercer nivel (Contabilidad o Dirección), quiero filtrar los costos por unidad de negocio, para analizar operaciones específicas de cada área.

#### Acceptance Criteria

1. WHEN un usuario de nivel 3 accede al módulo THEN el Sistema SHALL mostrar un filtro de "Unidad de negocio" en la barra de filtros
2. WHEN un usuario de nivel 2 accede al módulo THEN el Sistema SHALL ocultar el filtro de "Unidad de negocio"
3. WHEN el usuario de nivel 3 selecciona una unidad de negocio THEN el Sistema SHALL actualizar la tabla mostrando solo datos de esa unidad
4. WHEN el usuario exporta a Excel con filtro de UDN activo THEN el Sistema SHALL incluir solo los datos de la unidad seleccionada
5. WHEN el usuario cambia el filtro de UDN THEN el Sistema SHALL recalcular los totales basándose en la nueva selección

### Requirement 4

**User Story:** Como usuario del sistema, quiero tener acceso únicamente de consulta sin posibilidad de modificar datos, para asegurar la integridad financiera y operativa del sistema.

#### Acceptance Criteria

1. WHEN el usuario accede al módulo THEN el Sistema SHALL deshabilitar cualquier acción de edición (inputs, botones de guardar, modales de edición)
2. WHEN el usuario intenta modificar datos mediante URL o parámetros THEN el Sistema SHALL validar en backend y denegar la acción
3. WHEN el Sistema recibe una petición de modificación THEN el Sistema SHALL retornar un error de permisos insuficientes
4. WHEN el usuario visualiza la tabla THEN el Sistema SHALL mostrar los datos en formato de solo lectura sin controles de edición
5. WHEN el Sistema carga el módulo THEN el Sistema SHALL garantizar que todas las operaciones sean estrictamente de lectura

### Requirement 5

**User Story:** Como desarrollador del sistema, quiero integrar datos de los módulos de Compras y Almacén, para consolidar la información financiera en un solo concentrado.

#### Acceptance Criteria

1. WHEN el Sistema consulta costos directos THEN el Sistema SHALL obtener los datos desde la tabla de compras del módulo de Compras
2. WHEN el Sistema consulta salidas de almacén THEN el Sistema SHALL obtener los datos desde la tabla de movimientos del módulo de Almacén
3. WHEN el Sistema agrupa los datos THEN el Sistema SHALL consolidar por fecha de operación
4. WHEN el Sistema calcula totales THEN el Sistema SHALL sumar costos directos y salidas de almacén por día
5. WHEN el Sistema presenta los datos THEN el Sistema SHALL mantener la estructura de categorías (Alimentos, Bebidas, Diversos)

### Requirement 6

**User Story:** Como usuario del sistema, quiero visualizar los costos organizados por categorías, para analizar el comportamiento de cada tipo de gasto.

#### Acceptance Criteria

1. WHEN el Sistema muestra el concentrado THEN el Sistema SHALL agrupar los costos en categorías: Alimentos, Bebidas y Diversos
2. WHEN el Sistema calcula subtotales THEN el Sistema SHALL mostrar el total de cada categoría por día
3. WHEN el Sistema presenta salidas de almacén THEN el Sistema SHALL mostrar el desglose por categoría
4. WHEN el Sistema calcula el costo total THEN el Sistema SHALL sumar todas las categorías más los costos directos
5. WHEN el usuario visualiza la tabla THEN el Sistema SHALL permitir expandir/colapsar las categorías para ver el detalle

### Requirement 7

**User Story:** Como usuario del sistema, quiero visualizar totales consolidados, para tener una visión general de los costos en el período consultado.

#### Acceptance Criteria

1. WHEN el Sistema muestra el concentrado THEN el Sistema SHALL incluir una fila de "Total en compras (costo directo)" con la suma de todos los costos directos
2. WHEN el Sistema calcula salidas THEN el Sistema SHALL incluir una fila de "Total en salidas de almacén" con la suma de todas las salidas
3. WHEN el Sistema presenta los datos THEN el Sistema SHALL mostrar el "Costo total" sumando compras y salidas
4. WHEN el usuario visualiza los totales THEN el Sistema SHALL resaltar visualmente las filas de totales con formato diferenciado
5. WHEN el Sistema calcula totales por día THEN el Sistema SHALL mostrar columnas con totales para cada día del rango seleccionado

### Requirement 8

**User Story:** Como usuario del sistema, quiero que la interfaz sea consistente con los demás módulos del sistema, para facilitar la navegación y el uso.

#### Acceptance Criteria

1. WHEN el usuario accede al módulo THEN el Sistema SHALL mostrar la barra de navegación superior con las pestañas: Ventas, Clientes, Compras, Salidas de almacén, Costos, Pagos a proveedor, Archivos
2. WHEN el Sistema renderiza la interfaz THEN el Sistema SHALL usar el tema corporativo de CoffeeSoft con los colores estándar
3. WHEN el Sistema muestra la tabla THEN el Sistema SHALL aplicar el estilo de tablas usado en los módulos de Compras y Almacén
4. WHEN el usuario interactúa con filtros THEN el Sistema SHALL usar los componentes estándar de createfilterBar
5. WHEN el Sistema presenta información THEN el Sistema SHALL mantener la estructura de primaryLayout con filterBar y container

### Requirement 9

**User Story:** Como usuario del sistema, quiero que el selector de fechas sea intuitivo y funcional, para consultar fácilmente diferentes períodos.

#### Acceptance Criteria

1. WHEN el usuario accede al módulo THEN el Sistema SHALL mostrar un selector de rango de fechas con el período actual por defecto
2. WHEN el usuario selecciona un rango de fechas THEN el Sistema SHALL validar que la fecha inicial sea menor o igual a la fecha final
3. WHEN el usuario cambia el rango de fechas THEN el Sistema SHALL actualizar automáticamente la tabla de concentrado
4. WHEN el Sistema muestra el selector THEN el Sistema SHALL usar el componente dataPicker estándar del framework
5. WHEN el usuario selecciona fechas THEN el Sistema SHALL mostrar el período seleccionado en formato legible (DD/MM/YYYY - DD/MM/YYYY)

### Requirement 10

**User Story:** Como administrador del sistema, quiero que el módulo registre las consultas realizadas, para auditoría y seguimiento de uso.

#### Acceptance Criteria

1. WHEN un usuario consulta el concentrado THEN el Sistema SHALL registrar en audit_log la acción de consulta con fecha, usuario y filtros aplicados
2. WHEN un usuario exporta a Excel THEN el Sistema SHALL registrar en audit_log la acción de exportación con fecha, usuario y rango exportado
3. WHEN el Sistema registra en audit_log THEN el Sistema SHALL incluir el nombre de la tabla consultada y la acción realizada
4. WHEN el Sistema guarda el log THEN el Sistema SHALL almacenar el nombre del usuario y la UDN asociada
5. WHEN ocurre un error en la consulta THEN el Sistema SHALL registrar el error en audit_log con detalles del problema
