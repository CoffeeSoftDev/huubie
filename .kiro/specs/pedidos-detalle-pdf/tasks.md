# Plan de Implementación: Pedidos Detalle PDF

## Resumen

Implementar la funcionalidad de impresión PDF para el reporte "Detalles de Pedidos", reutilizando la infraestructura existente de `PdfStyles` y la estructura `.pdf-document`. Se modifican 3 archivos JavaScript existentes: estilos PDF, reporte de pedidos detalle y el switch de impresión en reportes.

## Tareas

- [x] 1. Agregar estilos CSS para sub-filas de items en PdfStyles
  - [x] 1.1 Añadir reglas CSS para `.pdf-item-row td` en modo oscuro (pantalla)
    - Abrir `alpha/pedidos-reportes/src/js/reportes-pdf-styles.js`
    - Dentro del bloque de estilos dark mode (antes del `@media print`), agregar reglas para `.pdf-item-row td` con `font-size: 11px`, `color: #9ca3af`, y `.pdf-item-row` con borde sutil o sin borde inferior
    - _Requerimientos: 6.3_
  - [x] 1.2 Añadir reglas CSS para `.pdf-item-row td` en modo impresión (print)
    - Dentro del bloque `@media print`, agregar reglas para `.pdf-item-row td` con `color: #7f8c8d !important` y `font-size: 11px !important`
    - _Requerimientos: 6.2, 6.3_

- [x] 2. Implementar métodos de generación PDF en OrderDetailsReport
  - [x] 2.1 Implementar `_renderPdfTotalsBar(totals)` en `reportes-pedidos-detalle.js`
    - Crear método privado que reciba el objeto `totals` y retorne HTML string
    - Renderizar 8 indicadores usando `.pdf-totals-bar` y `.total-item`: Pedidos, Importe Total (con clase `highlight`), Abonado, Saldo, Efectivo, Tarjeta, Transferencia, Descuentos
    - Usar los campos: `totals.total_pedidos`, `totals.importe`, `totals.abono`, `totals.saldo`, `totals.efectivo`, `totals.tarjeta`, `totals.transferencia`, `totals.descuento`
    - _Requerimientos: 3.1, 3.2, 3.3_
  - [x] 2.2 Implementar `_renderPdfTable(rows)` en `reportes-pedidos-detalle.js`
    - Crear método privado que reciba el array `rows` y retorne HTML string con `table.pdf-table`
    - Columnas: Folio, Cliente, Fecha, Abono, Total, Saldo, Entrega, Estado
    - Para filas con `opc: 1` (pedidos): extraer texto plano de celdas con formato `{html, class}` usando un helper temporal DOM element para strip HTML tags de badges/iconos
    - Para filas con `opc: 0` (items): renderizar como `<tr class="pdf-item-row">` mostrando nombre+cantidad en columna Cliente y subtotal en columna Total, demás columnas vacías
    - Alinear a la derecha columnas numéricas (Abono, Total, Saldo)
    - _Requerimientos: 4.1, 4.2, 4.3, 4.4_
  - [x] 2.3 Implementar `printPedidosDetalle()` en `reportes-pedidos-detalle.js`
    - Crear método `async printPedidosDetalle()` que:
      1. Obtenga params via `appReportes.getFilterParams()` y subName via `appReportes.getSubName()`
      2. Haga fetch a `lsPedidosDetalle` con los params
      3. Si `data.row` está vacío o no existe, muestre mensaje "No hay datos disponibles" dentro del `.pdf-document`
      4. Construya HTML del `.pdf-document` con: `.pdf-header` (título "DETALLES DE PEDIDOS", sucursal, fecha/periodo, botón Imprimir), barra de totales via `_renderPdfTotalsBar()`, tabla via `_renderPdfTable()`, y `.pdf-footer`
      5. Inyecte el HTML en `#container-pedidos-detalle`
      6. Llame a `PdfStyles.inject()`
    - Seguir el patrón de `SummaryReport.render()` para la estructura del `.pdf-document`
    - _Requerimientos: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.5, 5.1, 5.2, 7.1_

- [x] 3. Checkpoint - Verificar renderizado PDF
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Integrar impresión en el flujo de reportes
  - [x] 4.1 Actualizar `printReport()` en `reportes.js`
    - En el método `printReport()` de la clase `AppReportes`, agregar un case `'pedidos-detalle'` en el switch que invoque `orderDetailsReport.printPedidosDetalle()`
    - _Requerimientos: 7.2_

- [x] 5. Checkpoint final - Validación completa
  - Ensure all tests pass, ask the user if questions arise.

## Notas

- No se requieren cambios en backend — el endpoint `lsPedidosDetalle` ya retorna todos los datos necesarios
- No se aplica Property-Based Testing — la funcionalidad es renderizado UI sin transformaciones algorítmicas complejas
- Los estilos de `PdfStyles` ya cubren `.pdf-document`, `.pdf-header`, `.pdf-totals-bar`, `.pdf-table` y `.pdf-footer`; solo se agregan reglas para `.pdf-item-row`
- Cada tarea referencia requerimientos específicos para trazabilidad
