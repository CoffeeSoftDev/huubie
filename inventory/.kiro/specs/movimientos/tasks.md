# Implementation Plan - Módulo de Movimientos de Inventario

## 1. Configuración inicial del proyecto

- [ ] 1.1 Crear estructura de directorios en operacion/almacen/
  - Crear carpeta `js/` si no existe
  - Crear carpeta `ctrl/` si no existe
  - Crear carpeta `mdl/` si no existe
  - _Requirements: 1.1_

- [ ] 1.2 Verificar tablas de base de datos
  - Verificar existencia de `mtto_inventario_movimientos`
  - Verificar existencia de `mtto_inventario_detalle`
  - Verificar relaciones con `mtto_almacen`, `usuarios`, `mtto_almacen_area`
  - _Requirements: 6.3, 6.4_

## 2. Desarrollo del Modelo (mdl-movimientos.php)

- [ ] 2.1 Crear archivo mdl-movimientos.php con estructura base
  - Extender clase CRUD
  - Configurar `$this->bd` con nombre de base de datos
  - Cargar archivos de configuración (_CRUD.php, _Utileria.php)
  - _Requirements: All_

- [ ] 2.2 Implementar métodos de consulta de filtros
  - Método `lsAlmacenes()` - Lista de almacenes activos
  - Método `lsMeses()` - Lista de meses (1-12)
  - Método `lsAnios()` - Lista de años disponibles
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 2.3 Implementar método listMovimientos()
  - Consulta con JOINs a mtto_almacen, mtto_almacen_area, usuarios
  - Filtros por mes, año, almacén
  - Ordenamiento por fecha DESC
  - Incluir información de responsable
  - _Requirements: 1.1, 2.1, 2.2, 2.3, 4.1, 4.4, 5.2_

- [ ] 2.4 Implementar método getResumenMovimientos()
  - Consulta agregada con SUM y COUNT
  - Agrupar por tipo_movimiento (Entrada/Salida)
  - Calcular totales de entradas y salidas
  - _Requirements: 3.1, 3.2, 3.3_

- [ ]* 2.5 Implementar validaciones en modelo
  - Validar existencia de almacén activo
  - Validar existencia de producto activo
  - Validar formato de fechas
  - _Requirements: 6.3, 6.4_

## 3. Desarrollo del Controlador (ctrl-movimientos.php)

- [ ] 3.1 Crear archivo ctrl-movimientos.php con estructura base
  - Extender clase mdl
  - Configurar validación de sesión
  - Configurar headers CORS
  - _Requirements: All_

- [ ] 3.2 Implementar método init()
  - Llamar a `lsAlmacenes()`, `lsMeses()`, `lsAnios()`
  - Retornar array con listas para filtros
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 3.3 Implementar método lsMovimientos()
  - Recibir parámetros: mes, año, almacén desde $_POST
  - Llamar a `listMovimientos()` del modelo
  - Formatear filas para tabla con columnas: Folio, Fecha, Tipo, Producto, Cantidad, Almacén, Responsable
  - Aplicar colores: verde para entradas, rojo para salidas
  - Aplicar signos: positivo para entradas, negativo para salidas
  - Retornar array con 'row' y 'thead'
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.2_

- [ ] 3.4 Implementar método getResumen()
  - Recibir parámetros de filtros desde $_POST
  - Llamar a `getResumenMovimientos()` del modelo
  - Calcular balance (entradas - salidas)
  - Retornar objeto con: total, entradas, salidas, balance
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3.5 Implementar funciones auxiliares (Complements)
  - Función `renderTipoMovimiento($tipo)` - Badge con color según tipo
  - Función `renderCantidad($cantidad, $tipo)` - Cantidad con signo
  - Función `renderResponsable($nombre, $activo)` - Nombre con etiqueta si inactivo
  - _Requirements: 4.2, 4.3, 5.3_

- [ ]* 3.6 Implementar manejo de errores
  - Validar parámetros POST requeridos
  - Capturar excepciones de base de datos
  - Retornar mensajes de error apropiados
  - _Requirements: 1.5, 2.5_

## 4. Desarrollo del Frontend (movimientos.js)

- [ ] 4.1 Crear archivo movimientos.js con estructura base
  - Definir variable `api` con ruta al controlador
  - Crear clase `App extends Templates`
  - Configurar `PROJECT_NAME = "movimientos"`
  - Implementar inicialización con `$(async () => {})`
  - _Requirements: All_

- [ ] 4.2 Implementar método render()
  - Llamar a `layout()`
  - Llamar a `filterBar()`
  - Llamar a `summaryCards()`
  - Llamar a `lsMovimientos()`
  - _Requirements: 1.1_

- [ ] 4.3 Implementar método layout()
  - Usar `primaryLayout()` de CoffeeSoft
  - Crear contenedores: filterBarMovimientos, containerMovimientos
  - Configurar clases de TailwindCSS
  - _Requirements: 1.1_

- [ ] 4.4 Implementar método filterBar()
  - Usar `createfilterBar()` de CoffeeSoft
  - Filtro select "Mes" con opciones 1-12 y "Todos los meses"
  - Filtro select "Año" con lista de años
  - Filtro select "Almacén" con lista de almacenes activos
  - Evento `onchange` en cada filtro → `app.lsMovimientos()`
  - _Requirements: 1.2, 2.1, 2.2, 2.3, 2.4_

- [ ] 4.5 Implementar método summaryCards()
  - Usar `infoCard()` de CoffeeSoft (o crear componente personalizado)
  - Tarjeta 1: Total Movimientos (icono, valor)
  - Tarjeta 2: Entradas (color verde, valor)
  - Tarjeta 3: Salidas (color rojo, valor)
  - Tarjeta 4: Balance (color según positivo/negativo, cálculo)
  - _Requirements: 1.3, 3.1, 3.2, 3.3, 3.4_

- [ ] 4.6 Implementar método lsMovimientos()
  - Usar `createTable()` de CoffeeSoft
  - Configurar `data: { opc: 'lsMovimientos', mes, anio, almacen }`
  - Configurar `conf: { datatable: true, pag: 5 }` para límite inicial
  - Configurar `attr: { theme: 'corporativo', center: [...], right: [...] }`
  - Actualizar `summaryCards()` con datos de resumen
  - _Requirements: 1.4, 4.1, 4.4, 4.5_

- [ ]* 4.7 Implementar manejo de resultados vacíos
  - Detectar cuando `row` está vacío
  - Mostrar mensaje "No se encontraron movimientos"
  - Mantener filtros visibles
  - _Requirements: 1.5, 2.5_

- [ ]* 4.8 Implementar actualización dinámica
  - Configurar eventos `onchange` en filtros
  - Usar `useFetch()` para peticiones AJAX
  - Actualizar tabla y tarjetas sin recargar página
  - _Requirements: 2.4, 3.5_

## 5. Desarrollo de la Vista (index.php)

- [ ] 5.1 Crear archivo index.php siguiendo PIVOTE INDEX
  - Configurar validación de sesión
  - Incluir layout/head.php y layout/core-libraries.php
  - Incluir scripts de CoffeeSoft (coffeSoft.js, plugins.js)
  - Configurar breadcrumb: Operación → Movimientos
  - Incluir script movimientos.js con cache busting
  - _Requirements: All_

## 6. Checkpoint - Pruebas de integración básica

- [ ] 6.1 Verificar carga de módulo
  - Acceder a operacion/almacen/index.php
  - Verificar que carga sin errores de consola
  - Verificar que se muestran filtros
  - Verificar que se muestran tarjetas resumen
  - Verificar que se muestra tabla (vacía o con datos)

## 7. Implementación de propiedades de correctness

- [ ]* 7.1 Property 1: Filter consistency
  - **Property 1: Filter consistency**
  - **Validates: Requirements 2.1, 2.2, 2.3**
  - Crear test que valide que movimientos filtrados coinciden con criterios

- [ ]* 7.2 Property 2: Balance calculation accuracy
  - **Property 2: Balance calculation accuracy**
  - **Validates: Requirements 3.4**
  - Crear test que valide balance = entradas - salidas

- [ ]* 7.3 Property 5: Chronological ordering
  - **Property 5: Chronological ordering**
  - **Validates: Requirements 4.4**
  - Crear test que valide orden descendente por fecha

- [ ]* 7.4 Property 6: Responsible user association
  - **Property 6: Responsible user association**
  - **Validates: Requirements 5.1, 5.2, 5.3**
  - Crear test que valide asociación de responsable y etiqueta de inactivo

- [ ]* 7.5 Property 7: Dynamic update without reload
  - **Property 7: Dynamic update without reload**
  - **Validates: Requirements 2.4**
  - Crear test que valide actualización AJAX sin recarga

## 8. Optimizaciones y mejoras

- [ ]* 8.1 Implementar paginación avanzada
  - Configurar scroll infinito o botón "Cargar más"
  - Mantener límite inicial de 5 registros
  - _Requirements: 1.4, 4.5_

- [ ]* 8.2 Implementar debouncing en filtros
  - Aplicar debounce de 300ms en eventos onchange
  - Evitar múltiples peticiones simultáneas
  - _Requirements: 2.4_

- [ ]* 8.3 Optimizar consultas SQL
  - Revisar índices en tablas
  - Optimizar JOINs
  - Implementar LIMIT en consultas
  - _Requirements: Performance_

## 9. Documentación y entrega

- [ ]* 9.1 Documentar código
  - Agregar comentarios en funciones complejas
  - Documentar parámetros de métodos principales
  - _Requirements: All_

- [ ]* 9.2 Crear guía de usuario
  - Documentar uso de filtros
  - Documentar interpretación de tarjetas resumen
  - Documentar columnas de tabla
  - _Requirements: All_

## 10. Checkpoint final - Validación completa

- [ ] 10.1 Pruebas de aceptación
  - Verificar todos los criterios de aceptación de requirements.md
  - Verificar que todas las propiedades de correctness se cumplen
  - Verificar manejo de errores
  - Verificar rendimiento con datos reales
  - Ensure all tests pass, ask the user if questions arise.
