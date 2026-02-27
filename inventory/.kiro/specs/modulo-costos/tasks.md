# Implementation Plan - Módulo de Costos

## Overview

Este plan de implementación detalla las tareas necesarias para desarrollar el módulo de Costos, un sistema de consulta financiera de solo lectura que consolida información de costos directos y salidas de almacén. El desarrollo sigue la arquitectura MVC de CoffeeSoft y se enfoca en la corrección mediante property-based testing.

---

## Tasks

- [x] 1. Configurar estructura base del módulo



  - Crear estructura de carpetas en `finanzas/consulta/`
  - Crear archivos base: `costos.php` (index), `ctrl-costos.php`, `mdl-costos.php`, `costos.js`
  - Configurar rutas y permisos de acceso


  - _Requirements: 8.1, 8.5_

- [ ] 2. Implementar modelo de datos (mdl-costos.php)
  - Extender clase CRUD y configurar conexión a base de datos

  - Implementar `lsUDN()` para obtener lista de unidades de negocio
  - _Requirements: 3.1_

- [ ] 2.1 Implementar consultas de costos directos
  - Crear método `listCostosDirectos($params)` que consulte tabla `compras`

  - Filtrar por rango de fechas (fi, ff) y UDN opcional
  - Agrupar por fecha de operación y categoría
  - _Requirements: 5.1, 5.3_

- [x] 2.2 Implementar consultas de salidas de almacén

  - Crear método `listSalidasAlmacen($params)` que consulte tabla `warehouse_output`
  - Hacer JOIN con `product` y `product_class` para obtener categorías
  - Filtrar por rango de fechas y UDN opcional
  - _Requirements: 5.2, 5.3_

- [ ] 2.3 Implementar consolidación de datos
  - Crear método `consolidateCostos($costosDirectos, $salidas)` 

  - Consolidar ambas fuentes por fecha
  - Organizar por categorías: Alimentos, Bebidas, Diversos
  - Calcular subtotales por categoría y día
  - Calcular totales generales
  - _Requirements: 5.4, 5.5, 6.1, 6.2, 6.4_

- [ ] 2.4 Implementar sistema de auditoría
  - Crear método `createAuditLog($data)` para registrar operaciones
  - Registrar consultas, exportaciones y errores
  - Incluir user_id, udn_id, action y detalles en JSON
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ]* 2.5 Escribir property test para consolidación de datos
  - **Property 4: Total Calculation Accuracy**
  - **Validates: Requirements 5.4, 7.3**
  - Generar conjuntos aleatorios de costos y verificar que totales = suma de individuales
  - Configurar 100 iteraciones mínimas

- [ ]* 2.6 Escribir property test para agrupación por fecha
  - **Property 2: Data Grouping by Date**


  - **Validates: Requirements 1.2, 5.3**
  - Generar rangos de fechas aleatorios y verificar agrupación sin duplicados

- [x]* 2.7 Escribir property test para estructura de categorías

  - **Property 11: Category Structure Preservation**
  - **Validates: Requirements 5.5, 6.1**
  - Verificar que siempre existan las tres categorías: Alimentos, Bebidas, Diversos

- [ ] 3. Implementar controlador (ctrl-costos.php)
  - Extender clase mdl y configurar manejo de $_POST['opc']
  - Implementar método `init()` que retorne UDNs y nivel de usuario
  - _Requirements: 3.1, 3.2_


- [ ] 3.1 Implementar consulta principal lsCostos()
  - Recibir parámetros: fi, ff, udn (opcional)
  - Validar rango de fechas (fi <= ff)
  - Llamar a `listCostosDirectos()` y `listSalidasAlmacen()`
  - Consolidar datos con `consolidateCostos()`
  - Formatear respuesta para tabla CoffeeSoft
  - Registrar consulta en audit_log

  - Manejar errores y retornar códigos de estado apropiados
  - _Requirements: 1.2, 1.3, 1.4, 9.2, 10.1_

- [ ] 3.2 Implementar exportación a Excel
  - Crear método `exportExcel()` que genere archivo Excel
  - Usar datos filtrados actuales (mismo query que lsCostos)

  - Mantener formato de tabla y encabezados
  - Generar nombre de archivo con patrón: `Costos_[fi]_[ff]_[UDN].xlsx`
  - Registrar exportación en audit_log
  - _Requirements: 2.2, 2.3, 2.4, 10.2_

- [ ] 3.3 Implementar validación de solo lectura
  - Crear método `validateReadOnly()` que valide operaciones permitidas
  - Permitir solo: init, lsCostos, exportExcel
  - Rechazar cualquier intento de modificación con status 403
  - Registrar intentos de modificación en audit_log
  - _Requirements: 4.2, 4.3_

- [ ] 3.4 Implementar funciones auxiliares de formato
  - Crear función `formatCurrency($amount)` para formatear montos
  - Crear función `generateDayColumns($fi, $ff)` para generar columnas dinámicas
  - Crear función `formatDateHeader($date)` para encabezados de días
  - _Requirements: 1.3, 7.5, 9.5_

- [ ]* 3.5 Escribir property test para validación de solo lectura
  - **Property 5: Read-Only Enforcement**
  - **Validates: Requirements 4.2, 4.3**
  - Generar operaciones aleatorias de modificación y verificar rechazo con 403

- [x]* 3.6 Escribir property test para validación de fechas


  - **Property 1: Date Range Validation**
  - **Validates: Requirements 9.2**
  - Generar pares de fechas aleatorios donde fi > ff y verificar rechazo

- [x]* 3.7 Escribir property test para filtrado por UDN

  - **Property 9: UDN Filter Application**
  - **Validates: Requirements 3.3, 3.4**
  - Generar UDNs aleatorias y verificar que solo aparezcan datos de esa UDN

- [x]* 3.8 Escribir property test para recálculo de totales

  - **Property 10: Total Recalculation on Filter Change**
  - **Validates: Requirements 3.5**
  - Cambiar filtro UDN y verificar que totales se recalculen correctamente

- [ ] 4. Implementar frontend (costos.js)
  - Crear clase `App extends Templates` con PROJECT_NAME = "costos"
  - Implementar constructor con link y div_modulo

  - Implementar método `render()` que inicialice el módulo
  - _Requirements: 8.5_

- [ ] 4.1 Implementar layout principal
  - Crear método `layout()` usando `primaryLayout`
  - Configurar filterBar y container
  - Aplicar tema corporativo de CoffeeSoft

  - _Requirements: 8.2, 8.3, 8.5_

- [ ] 4.2 Implementar barra de filtros
  - Crear método `filterBar()` usando `createfilterBar`
  - Agregar selector de rango de fechas con `dataPicker`
  - Agregar filtro de UDN (condicional según nivel de usuario)
  - Configurar período actual como valor por defecto

  - Validar rango de fechas antes de consultar
  - _Requirements: 1.1, 3.1, 3.2, 9.1, 9.4_

- [ ] 4.3 Implementar consulta y visualización de concentrado
  - Crear método `lsCostos()` que consulte backend
  - Usar `createTable` con tema corporativo
  - Configurar columnas dinámicas por día
  - Aplicar formato a filas de totales
  - Manejar estados vacíos y errores
  - _Requirements: 1.2, 1.3, 1.4, 7.1, 7.2, 7.3, 7.5_

- [ ] 4.4 Implementar exportación a Excel
  - Crear método `exportExcel()` que llame al backend
  - Agregar botón "Exportar a Excel" visible cuando hay datos
  - Mostrar indicador de carga durante generación
  - Descargar archivo automáticamente al completar
  - Mostrar notificación de éxito/error
  - _Requirements: 2.1, 2.2, 2.5_



- [ ] 4.5 Implementar actualización automática de tabla
  - Configurar eventos onChange en filtros
  - Actualizar tabla automáticamente al cambiar fechas o UDN
  - Mantener estado de filtros durante la sesión
  - _Requirements: 9.3_

- [ ]* 4.6 Escribir unit tests para validación de UI
  - Test: Verificar que UDN filter se muestre solo para nivel 3
  - Test: Verificar validación de fechas en frontend
  - Test: Verificar presencia de botón exportar cuando hay datos

- [ ]* 4.7 Escribir property test para columnas dinámicas
  - **Property 15: Daily Column Generation**
  - **Validates: Requirements 7.5**
  - Generar rangos de fechas aleatorios y verificar número correcto de columnas

- [ ]* 4.8 Escribir property test para formato de fechas
  - **Property 17: Date Format Display**
  - **Validates: Requirements 9.5**
  - Generar fechas aleatorias y verificar formato DD/MM/YYYY

- [ ] 5. Crear página index (costos.php)
  - Seguir estructura del PIVOTE INDEX
  - Incluir validación de sesión con cookie IDU
  - Cargar layouts: head.php y core-libraries.php
  - Incluir CoffeeSoft Framework (coffeSoft.js, plugins.js)
  - Agregar breadcrumb: Finanzas > Costos
  - Incluir script costos.js con cache busting
  - _Requirements: 8.1_

- [ ] 6. Implementar funcionalidad de categorías expandibles
  - Agregar lógica para expandir/colapsar categorías en tabla
  - Mostrar detalle de items dentro de cada categoría
  - Mantener estado de expansión durante filtrado
  - _Requirements: 6.5_

- [ ]* 6.1 Escribir unit test para expansión de categorías
  - Test: Verificar que categorías se expandan/colapsen correctamente
  - Test: Verificar que estado se mantenga al filtrar

- [ ] 7. Implementar cálculos de subtotales por categoría
  - Calcular subtotal de Alimentos por día
  - Calcular subtotal de Bebidas por día
  - Calcular subtotal de Diversos por día
  - Mostrar subtotales en filas correspondientes
  - _Requirements: 6.2, 6.3_

- [ ]* 7.1 Escribir property test para subtotales de categorías
  - **Property 12: Category Subtotal Accuracy**
  - **Validates: Requirements 6.2**
  - Generar datos aleatorios por categoría y verificar suma correcta

- [ ] 8. Implementar filas de totales consolidados
  - Agregar fila "Total en compras (costo directo)" con formato destacado
  - Agregar fila "Total en salidas de almacén" con formato destacado
  - Agregar fila "Costo total" con formato destacado
  - Aplicar estilos diferenciados (bg-yellow-100, bg-blue-100, bg-green-100)
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ]* 8.1 Escribir property test para presencia de filas de totales
  - **Property 13: Total Rows Presence**
  - **Validates: Requirements 7.1, 7.2**
  - Verificar que siempre existan las tres filas de totales cuando hay datos

- [ ]* 8.2 Escribir property test para cálculo de total general
  - **Property 14: Grand Total Calculation**
  - **Validates: Requirements 7.3**
  - Verificar que Costo total = Total compras + Total salidas

- [ ] 9. Implementar sistema de auditoría completo
  - Registrar todas las consultas con parámetros
  - Registrar todas las exportaciones con detalles
  - Registrar errores con stack trace
  - Incluir timestamp, usuario, UDN en todos los logs
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ]* 9.1 Escribir property test para creación de logs
  - **Property 18: Audit Log Creation on Query**
  - **Property 19: Audit Log Creation on Export**
  - **Validates: Requirements 10.1, 10.2**
  - Verificar que cada operación genere su log correspondiente

- [ ]* 9.2 Escribir property test para campos requeridos en logs
  - **Property 20: Audit Log Required Fields**
  - **Validates: Requirements 10.3, 10.4**
  - Verificar que todos los logs tengan campos obligatorios no nulos

- [ ]* 9.3 Escribir property test para logging de errores
  - **Property 21: Error Logging**
  - **Validates: Requirements 10.5**
  - Generar errores aleatorios y verificar que se registren en audit_log

- [ ] 10. Implementar exportación a Excel con formato
  - Usar librería PHPExcel o PhpSpreadsheet
  - Mantener estructura de tabla (encabezados, categorías, totales)
  - Aplicar formato de moneda a columnas numéricas
  - Aplicar estilos a filas de totales (negrita, colores)
  - Ajustar ancho de columnas automáticamente
  - _Requirements: 2.3_

- [ ]* 10.1 Escribir property test para consistencia de exportación
  - **Property 6: Excel Export Data Consistency**
  - **Validates: Requirements 2.2, 2.3**
  - Verificar que datos en Excel coincidan exactamente con tabla mostrada

- [ ]* 10.2 Escribir property test para nombre de archivo Excel
  - **Property 7: Excel Filename Metadata**
  - **Validates: Requirements 2.4**
  - Verificar patrón de nombre: Costos_[fi]_[ff]_[UDN].xlsx

- [ ] 11. Implementar manejo de permisos por nivel de usuario
  - Obtener nivel de usuario desde sesión
  - Mostrar/ocultar filtro UDN según nivel
  - Validar permisos en backend para operaciones sensibles
  - _Requirements: 3.1, 3.2_

- [ ]* 11.1 Escribir property test para visibilidad de filtro UDN
  - **Property 8: UDN Filter Visibility by User Level**
  - **Validates: Requirements 3.1, 3.2**
  - Verificar que filtro se muestre solo para nivel 3

- [ ] 12. Implementar validaciones de entrada
  - Validar formato de fechas (YYYY-MM-DD)
  - Validar que fi <= ff
  - Validar que UDN exista en base de datos
  - Sanitizar inputs para prevenir SQL injection
  - _Requirements: 9.2_

- [ ]* 12.1 Escribir unit tests para validaciones
  - Test: Validar rechazo de fechas inválidas
  - Test: Validar rechazo de UDN inexistente
  - Test: Validar sanitización de inputs

- [ ] 13. Implementar manejo de estados de UI
  - Mostrar loader durante consultas
  - Mostrar mensaje cuando no hay datos
  - Mostrar mensaje de error en caso de fallo
  - Deshabilitar botones durante operaciones
  - _Requirements: 1.1_

- [ ]* 13.1 Escribir unit tests para estados de UI
  - Test: Verificar loader durante consulta
  - Test: Verificar mensaje de tabla vacía
  - Test: Verificar mensaje de error

- [ ] 14. Implementar optimizaciones de rendimiento
  - Agregar índices en columnas de fecha en tablas
  - Implementar caché de consultas frecuentes
  - Limitar rango máximo de fechas (ej: 1 año)
  - Paginar resultados si exceden límite (ej: 1000 registros)
  - _Requirements: Performance_

- [ ] 15. Checkpoint - Verificar integración completa
  - Ejecutar todos los property tests (mínimo 100 iteraciones cada uno)
  - Ejecutar todos los unit tests
  - Verificar cobertura de código (objetivo: 80% líneas, 90% funciones)
  - Probar flujo completo: consulta → filtrado → exportación
  - Verificar auditoría de todas las operaciones
  - Validar que no existan opciones de edición en UI
  - Probar con diferentes niveles de usuario
  - Verificar consistencia visual con otros módulos
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Documentación y deployment
  - Crear documentación de usuario del módulo
  - Documentar API endpoints (init, lsCostos, exportExcel)
  - Crear guía de troubleshooting
  - Preparar scripts de migración de base de datos
  - Configurar permisos de acceso en producción
  - _Requirements: Documentation_

---

## Notes

### Dependencias Externas

- **PHPExcel o PhpSpreadsheet**: Para generación de archivos Excel
- **PHPUnit + Eris**: Para property-based testing
- **CoffeeSoft Framework**: coffeSoft.js, plugins.js (ya disponibles)

### Orden de Implementación

1. **Fase 1 (Tasks 1-3)**: Backend - Modelo y Controlador
2. **Fase 2 (Tasks 4-5)**: Frontend - Interfaz y Consultas
3. **Fase 3 (Tasks 6-8)**: Funcionalidades Avanzadas - Categorías y Totales
4. **Fase 4 (Tasks 9-11)**: Auditoría y Permisos
5. **Fase 5 (Tasks 12-14)**: Validaciones y Optimizaciones
6. **Fase 6 (Task 15)**: Testing y Verificación
7. **Fase 7 (Task 16)**: Documentación y Deployment

### Property Tests Prioritarios

Los siguientes property tests son críticos y deben implementarse primero:

1. **Property 4**: Total Calculation Accuracy (Task 2.5)
2. **Property 5**: Read-Only Enforcement (Task 3.5)
3. **Property 9**: UDN Filter Application (Task 3.7)
4. **Property 14**: Grand Total Calculation (Task 8.2)

### Consideraciones de Seguridad

- Todas las operaciones de modificación deben ser rechazadas con 403
- Validar nivel de usuario en backend, no solo en frontend
- Sanitizar todos los inputs para prevenir SQL injection
- Registrar intentos de modificación en audit_log

### Integración con Módulos Existentes

- **Compras**: Tabla `compras` para costos directos
- **Almacén**: Tabla `warehouse_output` para salidas
- **Usuarios**: Tabla `usuarios` para permisos y UDN
- **Auditoría**: Tabla `audit_log` para registro de operaciones
