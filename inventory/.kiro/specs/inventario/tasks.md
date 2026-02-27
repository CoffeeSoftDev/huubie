# Implementation Plan - Módulo de Inventario

- [x] 1. Crear estructura de base de datos


  - Crear tabla `mtto_inventario_movimientos` con campos: id_movimiento, folio, fecha, tipo_movimiento, total_productos, total_unidades, estado, fecha_creacion
  - Crear tabla `mtto_inventario_detalle` con campos: id_detalle, id_movimiento, id_producto, cantidad, stock_anterior, stock_resultante
  - Agregar índices y constraints (UNIQUE en folio, FOREIGN KEY en relaciones)
  - _Requirements: 7.1, 7.4_




- [ ] 2. Implementar modelo de datos (mdl-inventario.php)
  - [ ] 2.1 Crear archivo mdl-inventario.php con clase base
    - Extender clase CRUD
    - Configurar conexión a base de datos


    - Declarar propiedades $bd y $util
    - _Requirements: All_
  
  - [x] 2.2 Implementar métodos de consulta de movimientos


    - `listMovimientos($array)` - Listar movimientos con filtros
    - `getMovimientoById($id)` - Obtener movimiento específico
    - `getMaxFolio()` - Obtener último folio generado


    - _Requirements: 1.2, 1.3, 7.2_
  
  - [ ] 2.3 Implementar métodos CRUD de movimientos
    - `createMovimiento($array)` - Crear nuevo movimiento


    - `updateMovimiento($array)` - Actualizar movimiento existente
    - _Requirements: 2.1, 2.3, 5.1_
  


  - [ ] 2.4 Implementar métodos de detalle de productos
    - `listDetalleMovimiento($array)` - Listar productos de un movimiento


    - `createDetalleMovimiento($array)` - Agregar producto a movimiento


    - `deleteDetalleMovimientoById($id)` - Eliminar producto de movimiento
    - _Requirements: 3.1, 3.4, 8.2_
  


  - [ ] 2.5 Implementar métodos de gestión de stock
    - `getStockProducto($idProducto)` - Obtener stock actual de producto
    - `updateStockProducto($array)` - Actualizar stock de producto
    - _Requirements: 6.1, 6.2, 6.3_


  
  - [ ] 2.6 Implementar métodos para selects
    - `lsTipoMovimiento()` - Listar tipos de movimiento
    - `lsProductos()` - Listar productos disponibles
    - _Requirements: 1.2, 3.1_



- [ ] 3. Implementar controlador (ctrl-inventario.php)
  - [ ] 3.1 Crear archivo ctrl-inventario.php con clase base
    - Extender clase mdl


    - Implementar método `init()` para inicializar filtros
    - _Requirements: 1.2_
  
  - [ ] 3.2 Implementar método de listado principal
    - `lsMovimientos()` - Procesar y formatear lista de movimientos


    - Construir array de filas con dropdown de acciones
    - Aplicar formato a fechas y estados
    - _Requirements: 1.2, 1.3, 1.5_
  
  - [ ] 3.3 Implementar métodos de gestión de movimientos
    - `addMovimiento()` - Crear nuevo movimiento con folio autogenerado
    - `getMovimiento()` - Obtener datos de movimiento para edición
    - `editMovimiento()` - Actualizar movimiento existente
    - `cancelMovimiento()` - Cancelar movimiento y revertir stock
    - _Requirements: 2.1, 2.3, 5.1, 5.2, 5.5_
  
  - [ ] 3.4 Implementar métodos de detalle de productos
    - `lsDetalleMovimiento()` - Listar productos de un movimiento
    - `addProductoMovimiento()` - Agregar producto con validaciones

    - `deleteProductoMovimiento()` - Eliminar producto y actualizar totales


    - _Requirements: 3.1, 3.3, 8.2, 8.3, 8.4_
  
  - [x] 3.5 Implementar método de guardado final


    - `guardarMovimiento()` - Validar, actualizar stock y cambiar estado
    - Validar al menos un producto
    - Actualizar stock según tipo de movimiento


    - Cambiar estado a "Activa"
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [ ] 3.6 Crear funciones auxiliares
    - `dropdown($id, $estado)` - Generar menú de acciones


    - `renderEstado($estado)` - Renderizar badge de estado
    - `formatFolio($numero)` - Formatear número a folio "MOV-XXX"
    - _Requirements: 1.5, 7.1_

- [x]* 3.7 Escribir prueba de propiedad para unicidad de folios


  - **Property 1: Folio uniqueness**
  - **Validates: Requirements 7.1, 7.4**

- [ ]* 3.8 Escribir prueba de propiedad para cálculo de stock en entradas
  - **Property 2: Stock calculation for entries**


  - **Validates: Requirements 6.1**

- [ ]* 3.9 Escribir prueba de propiedad para cálculo de stock en salidas
  - **Property 3: Stock calculation for exits**


  - **Validates: Requirements 6.2**

- [ ] 4. Implementar frontend principal (inventario.js)
  - [ ] 4.1 Crear clase Inventario extendiendo Templates
    - Configurar constructor con link y div_modulo
    - Definir PROJECT_NAME = "inventario"
    - _Requirements: All_
  
  - [ ] 4.2 Implementar método render() y layout()
    - Usar `primaryLayout()` con filterBar y container

    - Configurar estructura de pestañas si es necesario


    - _Requirements: 1.1_
  
  - [x] 4.3 Implementar filterBar()


    - Crear filtros con `createfilterBar()`
    - Agregar select de tipo de movimiento
    - Agregar datepicker para rango de fechas
    - Configurar botón de búsqueda


    - _Requirements: 1.2_
  
  - [ ] 4.4 Implementar lsMovimientos()
    - Usar `createTable()` con datos del backend
    - Configurar columnas: Folio, Fecha, Tipo, Total productos, Estado, Acciones
    - Aplicar tema corporativo


    - Configurar paginación (15 registros)
    - _Requirements: 1.3, 1.5_
  


  - [ ] 4.5 Implementar addMovimiento()
    - Usar `createModalForm()` para modal de creación
    - Campos: Folio (readonly), Fecha, Tipo de movimiento
    - Validar campos obligatorios
    - Redirigir a captura al crear


    - _Requirements: 2.1, 2.2, 2.3, 2.5_
  
  - [ ] 4.6 Implementar cancelMovimiento(id)
    - Usar `swalQuestion()` para confirmación
    - Enviar petición de cancelación al backend


    - Actualizar tabla después de cancelar
    - _Requirements: 5.2, 5.3_
  
  - [ ] 4.7 Crear método jsonMovimiento()
    - Definir estructura JSON del formulario
    - Campos: folio, fecha, tipo_movimiento
    - _Requirements: 2.1_

- [ ]* 4.8 Escribir prueba de propiedad para transición de estado
  - **Property 4: Movement state transition**
  - **Validates: Requirements 4.3**

- [ ]* 4.9 Escribir prueba de propiedad para validación de cantidad mínima
  - **Property 9: Positive quantity validation**
  - **Validates: Requirements 3.3**

- [ ] 5. Implementar frontend de captura (captura-inventario.js)
  - [x] 5.1 Crear clase CapturaMovimiento extendiendo Templates


    - Configurar constructor
    - Definir PROJECT_NAME = "capturaInventario"
    - _Requirements: 3.1_
  


  - [ ] 5.2 Implementar render(idMovimiento) y layout()
    - Usar `splitLayout()` o layout personalizado
    - Sección izquierda: Agregar producto y tabla
    - Sección derecha: Resumen
    - _Requirements: 3.1, 9.1_
  
  - [ ] 5.3 Implementar addProducto()
    - Selector de producto con `select2`
    - Input de cantidad con validación
    - Botón de agregar
    - Validar cantidad > 0
    - Actualizar tabla y resumen
    - _Requirements: 3.1, 3.2, 3.3, 3.5_
  
  - [ ] 5.4 Implementar deleteProducto(idDetalle)
    - Eliminar producto de la lista
    - Actualizar tabla y resumen
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [ ] 5.5 Implementar updateResumen()
    - Calcular total de productos
    - Calcular total de unidades
    - Actualizar panel de resumen en tiempo real
    - Mostrar indicadores visuales según tipo
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ] 5.6 Implementar guardarMovimiento()
    - Validar al menos un producto
    - Enviar petición de guardado
    - Mostrar notificación de éxito
    - Redirigir a lista principal
    - _Requirements: 4.1, 4.2, 4.3, 4.5_
  
  - [ ] 5.7 Implementar cancelarCaptura()
    - Confirmar con usuario
    - Regresar a lista principal sin guardar
    - _Requirements: 4.4_

- [ ]* 5.8 Escribir prueba de propiedad para consistencia de conteo de productos
  - **Property 5: Product count consistency**
  - **Validates: Requirements 9.2, 9.3**

- [ ]* 5.9 Escribir prueba de propiedad para consistencia de conteo de unidades
  - **Property 6: Units count consistency**
  - **Validates: Requirements 9.3, 9.4**

- [ ]* 5.10 Escribir prueba de propiedad para actualización de resumen al agregar
  - **Property 12: Real-time summary update on addition**
  - **Validates: Requirements 3.2, 9.2, 9.3**

- [ ]* 5.11 Escribir prueba de propiedad para actualización de resumen al eliminar
  - **Property 13: Real-time summary update on deletion**
  - **Validates: Requirements 8.3, 8.4, 9.4**

- [ ] 6. Integrar con index.php existente
  - Agregar script de inventario.js al index.php
  - Agregar script de captura-inventario.js al index.php
  - Configurar rutas y navegación
  - _Requirements: All_

- [ ] 7. Checkpoint - Verificar funcionalidad básica
  - Ensure all tests pass, ask the user if questions arise.

- [ ]* 8. Escribir pruebas de propiedad adicionales
  - [ ]* 8.1 Prueba para inmutabilidad de movimientos cancelados
    - **Property 7: Cancelled movement immutability**
    - **Validates: Requirements 5.4**
  
  - [ ]* 8.2 Prueba para validación de producto mínimo
    - **Property 8: Minimum product validation**
    - **Validates: Requirements 4.1**
  
  - [ ]* 8.3 Prueba para reversión de stock en cancelación
    - **Property 10: Stock reversion on cancellation**
    - **Validates: Requirements 5.5**
  
  - [ ]* 8.4 Prueba para incremento secuencial de folios
    - **Property 11: Folio sequential increment**
    - **Validates: Requirements 7.2**

- [ ] 9. Implementar estilos y mejoras visuales
  - Aplicar tema corporativo consistente
  - Agregar indicadores visuales para estados
  - Implementar animaciones de transición
  - Optimizar responsive design
  - _Requirements: 1.5, 9.5_

- [ ] 10. Checkpoint final - Pruebas de integración
  - Ensure all tests pass, ask the user if questions arise.
