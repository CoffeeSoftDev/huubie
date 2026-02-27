# Implementation Plan - Módulo de Compras

## Task Overview

Este plan de implementación desglosa el desarrollo del módulo de Compras en tareas incrementales y manejables. Cada tarea construye sobre las anteriores y termina con la integración completa del sistema.

---

## 1. Configuración inicial del proyecto

- [ ] 1.1 Crear estructura de directorios
  - Crear carpeta `finanzas/captura/js/`
  - Crear carpeta `finanzas/captura/ctrl/`
  - Crear carpeta `finanzas/captura/mdl/`
  - Verificar que existan `src/js/coffeSoft.js` y `src/js/plugins.js`
  - _Requirements: 1.1, 1.2_

- [ ] 1.2 Crear archivo index.php
  - Crear `finanzas/captura/index.php` con estructura HTML base
  - Incluir `<div id="root"></div>`
  - Incluir scripts de CoffeeSoft: `coffeSoft.js` y `plugins.js`
  - Incluir TailwindCSS y librerías necesarias (jQuery, DataTables, SweetAlert2)
  - _Requirements: 1.1_

---

## 2. Implementar modelo de datos (mdl-compras.php)

- [ ] 2.1 Crear estructura base del modelo
  - Crear archivo `finanzas/captura/mdl/mdl-compras.php`
  - Extender clase `CRUD`
  - Configurar propiedades `$bd` y `$util`
  - Requerir archivos `_CRUD.php` y `_Utileria.php`
  - _Requirements: 1.1, 1.2_

- [ ] 2.2 Implementar métodos de consulta para filtros
  - Implementar `lsProductClass()` usando `_Read` para categorías de productos
  - Implementar `lsProduct($array)` usando `_Read` para productos por categoría
  - Implementar `lsPurchaseType()` usando `_Read` para tipos de compra
  - Implementar `lsSupplier($array)` usando `_Read` para proveedores
  - Implementar `lsMethodPay()` usando `_Read` para métodos de pago
  - _Requirements: 2.1, 2.2, 4.1_

- [ ] 2.3 Implementar operaciones CRUD principales
  - Implementar `listPurchases($array)` con JOINs a tablas relacionadas
  - Implementar `createPurchase($array)` usando `_Insert`
  - Implementar `updatePurchase($array)` usando `_Update`
  - Implementar `deletePurchaseById($array)` usando `_Delete`
  - Implementar `getPurchaseById($array)` usando `_Read`
  - _Requirements: 1.2, 2.1, 3.1, 3.2_

- [ ] 2.4 Implementar métodos de cálculo y reportes
  - Implementar `getTotalsByType($array)` para totales por tipo de compra
  - Implementar `getBalanceFondoFijo($array)` para saldo del fondo fijo
  - Implementar `listConcentrado($array)` para reporte concentrado
  - _Requirements: 1.2, 5.1, 5.2, 5.3_

---

## 3. Implementar controlador (ctrl-compras.php)

- [ ] 3.1 Crear estructura base del controlador
  - Crear archivo `finanzas/captura/ctrl/ctrl-compras.php`
  - Extender clase `mdl`
  - Validar `$_POST['opc']`
  - Configurar `session_start()` y headers CORS
  - _Requirements: 1.1, 1.2_

- [ ] 3.2 Implementar método init()
  - Obtener listas de filtros: `lsProductClass()`, `lsPurchaseType()`, `lsSupplier()`, `lsMethodPay()`
  - Retornar array con todos los filtros
  - _Requirements: 2.1, 4.1_

- [ ] 3.3 Implementar método ls()
  - Recibir parámetros de filtros: `fi`, `ff`, `purchase_type_id`, `method_pay_id`, `udn`
  - Llamar a `listPurchases()` del modelo
  - Construir array `$__row` con formato para tabla
  - Implementar función auxiliar `dropdown()` para acciones
  - Implementar función auxiliar `renderStatus()` para estados
  - Calcular totales usando `getTotalsByType()`
  - Retornar `['row' => [], 'totals' => [], 'balance' => []]`
  - _Requirements: 1.2, 1.3, 4.1, 8.1_

- [ ] 3.4 Implementar método getPurchase()
  - Recibir `$_POST['id']`
  - Llamar a `getPurchaseById()` del modelo
  - Retornar datos con status 200 o 404
  - _Requirements: 3.1_

- [ ] 3.5 Implementar método addPurchase()
  - Validar campos requeridos
  - Validar campos condicionales según tipo de compra
  - Calcular total (subtotal + tax)
  - Asignar fecha de operación y UDN
  - Llamar a `createPurchase()` del modelo
  - Retornar status 200, 400 o 500
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [ ] 3.6 Implementar método editPurchase()
  - Recibir `$_POST['id']` y campos editables
  - Validar restricciones (módulo bloqueado, reembolso)
  - Llamar a `updatePurchase()` del modelo
  - Retornar status 200, 403 o 500
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3.7 Implementar método deletePurchase()
  - Recibir `$_POST['id']`
  - Validar restricciones (reembolso)
  - Llamar a `deletePurchaseById()` del modelo
  - Retornar status 200, 403 o 500
  - _Requirements: 3.1, 3.3, 3.4, 3.5_

- [ ] 3.8 Implementar método getConcentrado()
  - Recibir parámetros: `fi`, `ff`, `purchase_type_id`, `udn`
  - Llamar a `listConcentrado()` del modelo
  - Calcular balance del fondo fijo
  - Retornar datos formateados para reporte
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 3.9 Implementar funciones auxiliares
  - Crear función `dropdown($id, $status)` para menú de acciones
  - Crear función `renderStatus($status)` para badges de estado
  - Crear función `formatPurchaseType($type)` para etiquetas de tipo
  - _Requirements: 1.2, 3.1_

---

## 4. Implementar frontend principal (compras.js)

- [ ] 4.1 Crear estructura base de la clase App
  - Crear archivo `finanzas/captura/js/compras.js`
  - Extender clase `Templates` de CoffeeSoft
  - Definir constructor con `PROJECT_NAME = "compras"`
  - Implementar método `render()` que llama a `layout()`, `filterBar()` y `ls()`
  - _Requirements: 1.1, 1.2_

- [ ] 4.2 Implementar método layout()
  - Usar `primaryLayout()` para estructura principal
  - Usar `tabLayout()` para pestañas (Compras, Concentrado)
  - Configurar contenedores: `container-compras`, `container-concentrado`
  - Agregar header con título y botones de acción
  - _Requirements: 1.1, 1.2, 1.4_

- [ ] 4.3 Implementar método filterBar()
  - Usar `createfilterBar()` de CoffeeSoft
  - Agregar filtro de tipo de compra (select)
  - Agregar filtro de método de pago (select, oculto inicialmente)
  - Agregar selector de rango de fechas con `dataPicker()`
  - Configurar eventos `onchange` para actualización dinámica
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 4.4 Implementar método ls()
  - Obtener valores de filtros
  - Usar `createTable()` de CoffeeSoft con configuración DataTables
  - Configurar tema `corporativo`
  - Configurar columnas centradas y alineadas a la derecha
  - Pasar datos: `{ opc: 'ls', fi, ff, purchase_type_id, method_pay_id, udn }`
  - _Requirements: 1.2, 1.3, 4.4, 8.1_

- [ ] 4.5 Implementar método updateTotals()
  - Actualizar total general de compras
  - Actualizar totales por tipo (Fondo fijo, Corporativo, Crédito)
  - Actualizar saldo del fondo fijo
  - Usar animaciones para cambios visuales
  - _Requirements: 1.2, 1.3, 8.2, 8.5_

- [ ] 4.6 Implementar método jsonPurchase()
  - Definir estructura del formulario con campos:
    - `product_class_id` (select)
    - `product_id` (select, dinámico)
    - `purchase_type_id` (select)
    - `supplier_id` (select, condicional)
    - `method_pay_id` (select, condicional)
    - `subtotal` (input tipo cifra)
    - `tax` (input tipo cifra)
    - `description` (textarea)
  - Configurar eventos `onchange` para campos dinámicos
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 4.7 Implementar método addPurchase()
  - Usar `createModalForm()` de CoffeeSoft
  - Pasar `json: this.jsonPurchase()`
  - Configurar `data: { opc: 'addPurchase', udn }`
  - Implementar lógica para mostrar/ocultar campos condicionales
  - Implementar callback `success` para actualizar tabla y totales
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 8.1_

- [ ] 4.8 Implementar método editPurchase(id)
  - Obtener datos de la compra con `useFetch({ opc: 'getPurchase', id })`
  - Usar `createModalForm()` con `autofill`
  - Configurar `data: { opc: 'editPurchase', id, udn }`
  - Deshabilitar campos según restricciones (módulo bloqueado, reembolso)
  - Implementar callback `success` para actualizar tabla y totales
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 8.2_

- [ ] 4.9 Implementar método deletePurchase(id)
  - Usar `swalQuestion()` de CoffeeSoft para confirmación
  - Configurar `data: { opc: 'deletePurchase', id, udn }`
  - Implementar callback `send` para actualizar tabla y totales
  - _Requirements: 3.1, 3.3, 3.4, 8.3_

- [ ] 4.10 Implementar método showDetails(id)
  - Obtener datos de la compra con `useFetch({ opc: 'getPurchase', id })`
  - Usar `detailCard()` de CoffeeSoft para mostrar información
  - Mostrar: Categoría, Producto, Tipo, Proveedor, Método de pago, Subtotal, Impuesto, Total, Descripción
  - _Requirements: 3.1_

- [ ] 4.11 Implementar lógica de campos dinámicos
  - Al cambiar `product_class_id`, filtrar productos con `lsProduct()`
  - Al cambiar `purchase_type_id` a "Corporativo", mostrar `method_pay_id`
  - Al cambiar `purchase_type_id` a "Crédito", mostrar `supplier_id`
  - Ocultar campos no aplicables
  - _Requirements: 2.2, 2.3, 2.4, 4.2, 4.3_

---

## 5. Implementar módulo de Concentrado (ConcentradoCompras)

- [ ] 5.1 Crear clase ConcentradoCompras
  - Extender clase `App`
  - Implementar método `render()`
  - Implementar método `layout()` específico para concentrado
  - _Requirements: 5.1_

- [ ] 5.2 Implementar método filterBarConcentrado()
  - Usar `createfilterBar()` con filtros específicos
  - Agregar selector de rango de fechas
  - Agregar filtro de tipo de compra
  - Agregar botón "Exportar a Excel"
  - _Requirements: 5.3, 5.5_

- [ ] 5.3 Implementar método lsConcentrado()
  - Obtener valores de filtros
  - Usar `createTable()` con datos de concentrado
  - Mostrar tabla agrupada por clase de producto y día
  - Mostrar subtotales, impuestos y totales diarios
  - Mostrar balance del fondo fijo (saldo inicial, salidas, saldo final)
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 5.4 Implementar método exportExcel()
  - Obtener datos del reporte actual
  - Generar archivo Excel con librería (ej: SheetJS)
  - Incluir formato y estilos
  - Descargar archivo automáticamente
  - _Requirements: 5.5_

---

## 6. Implementar control de accesos y permisos

- [ ] 6.1 Crear función de validación de permisos en controlador
  - Implementar `validatePermissions($action)` en `ctrl-compras.php`
  - Definir matriz de permisos por nivel de usuario
  - Validar antes de cada operación de escritura
  - _Requirements: 6.1, 6.2_

- [ ] 6.2 Implementar restricciones en frontend
  - Ocultar botones según permisos del usuario
  - Deshabilitar campos según estado del módulo
  - Mostrar mensajes informativos sobre restricciones
  - _Requirements: 6.1, 6.2, 6.4_

- [ ] 6.3 Implementar funcionalidad de bloqueo/desbloqueo
  - Crear método `lockModule()` en controlador (solo Contabilidad)
  - Crear método `unlockModule()` en controlador (solo Contabilidad)
  - Agregar indicador visual de estado del módulo
  - _Requirements: 6.3_

- [ ] 6.4 Implementar validación de reembolsos
  - Verificar si existe reembolso asociado antes de editar
  - Restringir modificación de monto y tipo de compra
  - Mostrar mensaje explicativo al usuario
  - _Requirements: 3.2, 3.5, 6.4_

---

## 7. Integración y pruebas

- [ ] 7.1 Integrar todos los componentes
  - Verificar comunicación entre frontend y backend
  - Verificar actualización en tiempo real de totales
  - Verificar funcionamiento de filtros dinámicos
  - Verificar navegación entre pestañas
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 7.2 Realizar pruebas de flujo completo
  - Probar registro de compra de fondo fijo
  - Probar registro de compra corporativa
  - Probar registro de compra a crédito
  - Probar edición de compras
  - Probar eliminación de compras
  - Probar generación de reporte concentrado
  - _Requirements: 2.1-2.7, 3.1-3.5, 5.1-5.5_

- [ ] 7.3 Validar restricciones y permisos
  - Probar acceso con diferentes niveles de usuario
  - Probar restricciones de módulo bloqueado
  - Probar restricciones con reembolsos
  - Verificar mensajes de error apropiados
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 7.4 Optimizar rendimiento
  - Verificar tiempos de carga de tabla
  - Optimizar consultas SQL si es necesario
  - Implementar caché de filtros
  - Verificar actualización selectiva de elementos
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

---

## 8. Documentación y deployment

- [ ] 8.1 Crear scripts de base de datos
  - Crear script `create_tables.sql` con estructura de tablas
  - Crear script `seed_data.sql` con datos iniciales
  - Documentar relaciones y restricciones
  - _Requirements: Todos_

- [ ] 8.2 Documentar configuración
  - Documentar variables de entorno necesarias
  - Documentar requisitos del servidor
  - Crear guía de instalación
  - _Requirements: Todos_

- [ ] 8.3 Crear manual de usuario
  - Documentar flujo de registro de compras
  - Documentar uso de filtros
  - Documentar generación de reportes
  - Documentar niveles de acceso
  - _Requirements: Todos_

---

## Notas Importantes

### Orden de Implementación
Las tareas deben ejecutarse en el orden presentado, ya que cada una depende de las anteriores:
1. Configuración inicial
2. Modelo (acceso a datos)
3. Controlador (lógica de negocio)
4. Frontend principal (interfaz de usuario)
5. Módulo de concentrado (reportes)
6. Control de accesos
7. Integración y pruebas
8. Documentación

### Tareas Opcionales
Las siguientes tareas están marcadas como opcionales (*) y pueden omitirse para un MVP:
- Ninguna tarea es opcional en este módulo, todas son requeridas para cumplir con los requisitos

### Dependencias Externas
- CoffeeSoft Framework (coffeSoft.js, plugins.js)
- jQuery 3.x
- TailwindCSS 2.x
- DataTables
- SweetAlert2
- Chart.js (para futuras mejoras)

### Consideraciones de Testing
- Cada tarea debe ser probada individualmente antes de continuar
- Las pruebas de integración se realizan en la Tarea 7
- Se recomienda usar datos de prueba durante el desarrollo

### Integración con Clase Costo Directo
La Tarea 2.2 incluye la integración con la clase "Costo Directo" como parte de los métodos de consulta de filtros. Esta funcionalidad está distribuida en:
- Modelo: `lsProductClass()` incluye "Costo Directo"
- Controlador: `init()` retorna la lista con "Costo Directo"
- Frontend: `jsonPurchase()` muestra "Costo Directo" en el select de categorías
