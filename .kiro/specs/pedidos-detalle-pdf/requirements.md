# Documento de Requerimientos

## Introducción

Este documento define los requerimientos para la funcionalidad de impresión PDF del reporte "Detalles de Pedidos" dentro del módulo `pedidos-reportes`. El reporte PDF debe seguir el mismo formato visual del reporte existente "Resumen Corte" (estructura `.pdf-document`, estilos `PdfStyles`, modo oscuro en pantalla / modo claro en impresión) y mostrar la información de pedidos con sus items, totales y filtros aplicados.

## Glosario

- **OrderDetailsReport**: Clase JavaScript que gestiona la vista del reporte de detalles de pedidos, extiende `AppReportes`.
- **PdfStyles**: Clase JavaScript estática que inyecta los estilos CSS para documentos PDF (modo oscuro en pantalla, modo claro en impresión).
- **PDF_Document**: Estructura HTML con clase `.pdf-document` que contiene header, barra de totales, contenido principal, y footer.
- **Totals_Bar**: Barra visual dentro del PDF_Document que muestra métricas resumidas (`.pdf-totals-bar`).
- **PDF_Table**: Tabla HTML con clase `.pdf-table` que muestra datos tabulares con estilos consistentes para pantalla e impresión.
- **Filter_Params**: Objeto con los parámetros de filtro activos: fecha inicio (`fi`), fecha fin (`ff`), sucursal (`sub_id`), estado (`estado`), descuento (`descuento`).
- **Pedido**: Registro de orden con campos: Folio, Cliente, Fecha, Abono, Total, Saldo, Entrega, Estado, Entregado, Tipo.
- **Pedido_Item**: Producto asociado a un Pedido con campos: nombre, cantidad, subtotal.
- **AppReportes**: Clase principal del módulo de reportes que provee `getFilterParams()` y `getSubName()`.

## Requerimientos

### Requerimiento 1: Generar vista PDF de Detalles de Pedidos

**User Story:** Como usuario del módulo de reportes, quiero generar una vista PDF del reporte de detalles de pedidos, para poder visualizar e imprimir un resumen formateado de los pedidos filtrados.

#### Criterios de Aceptación

1. WHEN el usuario invoca la función de impresión, THE OrderDetailsReport SHALL obtener los datos de pedidos desde el endpoint `lsPedidosDetalle` usando los Filter_Params activos.
2. WHEN los datos son recibidos, THE OrderDetailsReport SHALL renderizar un PDF_Document con la estructura: `.pdf-header`, `.pdf-totals-bar`, tabla de pedidos (`.pdf-table`), y `.pdf-footer`.
3. THE OrderDetailsReport SHALL invocar `PdfStyles.inject()` para aplicar los estilos de modo oscuro en pantalla y modo claro en impresión.

### Requerimiento 2: Encabezado del PDF

**User Story:** Como usuario, quiero que el encabezado del PDF muestre el título del reporte, la sucursal y el periodo consultado, para identificar rápidamente el contexto del reporte.

#### Criterios de Aceptación

1. THE PDF_Document SHALL mostrar el título "DETALLES DE PEDIDOS" en el encabezado (`.pdf-header`).
2. THE PDF_Document SHALL mostrar el nombre de la sucursal obtenido mediante `appReportes.getSubName()`.
3. WHEN el modo de fecha es "single", THE PDF_Document SHALL mostrar la etiqueta "Dia" con la fecha seleccionada.
4. WHEN el modo de fecha es "range", THE PDF_Document SHALL mostrar la etiqueta "Periodo" con el rango de fechas en formato `fi al ff`.
5. THE PDF_Document SHALL mostrar la fecha y hora de generación del documento en formato `DD/MM/YYYY hh:mm A`.
6. THE PDF_Document SHALL incluir un botón "Imprimir" que ejecute `window.print()`.

### Requerimiento 3: Barra de Totales

**User Story:** Como usuario, quiero ver una barra de totales con las métricas principales de los pedidos, para tener un resumen rápido antes de revisar el detalle.

#### Criterios de Aceptación

1. THE Totals_Bar SHALL mostrar los siguientes indicadores: Pedidos, Importe Total, Abonado, Saldo, Efectivo, Tarjeta, Transferencia, Descuentos.
2. THE Totals_Bar SHALL obtener los valores del objeto `totals` retornado por el endpoint `lsPedidosDetalle`.
3. THE Totals_Bar SHALL resaltar el indicador "Importe Total" con el estilo `highlight`.

### Requerimiento 4: Tabla de Pedidos con Items

**User Story:** Como usuario, quiero ver una tabla con todos los pedidos y sus productos asociados, para revisar el detalle completo de cada orden.

#### Criterios de Aceptación

1. THE PDF_Table SHALL mostrar las columnas: Folio, Cliente, Fecha, Abono, Total, Saldo, Entrega, Estado.
2. WHEN un Pedido tiene Pedido_Items asociados, THE PDF_Table SHALL renderizar sub-filas debajo del Pedido mostrando nombre del producto, cantidad y subtotal.
3. THE PDF_Table SHALL alinear a la derecha las columnas numéricas (Abono, Total, Saldo).
4. THE PDF_Table SHALL diferenciar visualmente las filas de Pedido de las sub-filas de Pedido_Item mediante tamaño de fuente reducido y color atenuado en las sub-filas.
5. WHEN no existen pedidos en el periodo consultado, THE PDF_Document SHALL mostrar un mensaje indicando que no hay datos disponibles.

### Requerimiento 5: Pie de Página del PDF

**User Story:** Como usuario, quiero que el PDF tenga un pie de página estándar, para mantener consistencia con los demás reportes del sistema.

#### Criterios de Aceptación

1. THE PDF_Document SHALL mostrar el texto "Documento generado automaticamente" en el lado izquierdo del footer.
2. THE PDF_Document SHALL mostrar "Pagina 1 de 1" en el lado derecho del footer.

### Requerimiento 6: Compatibilidad de Estilos Pantalla/Impresión

**User Story:** Como usuario, quiero que el reporte se vea en modo oscuro en pantalla y en modo claro al imprimir, para tener una experiencia visual consistente con el reporte de Resumen Corte.

#### Criterios de Aceptación

1. THE PdfStyles SHALL aplicar fondo oscuro (`#1a1f2e`), texto claro (`#d1d5db`) y bordes sutiles en modo pantalla.
2. WHEN el usuario imprime el documento, THE PdfStyles SHALL aplicar fondo blanco (`#fff`), texto oscuro (`#2c3e50`) y ocultar elementos de navegación (navbar, sidebar, filtros, tabs, botón imprimir).
3. IF los estilos existentes de PdfStyles no cubren los elementos específicos de la tabla de pedidos (sub-filas de items), THEN THE PdfStyles SHALL incluir reglas adicionales para esos elementos tanto en pantalla como en impresión.

### Requerimiento 7: Integración con el Flujo de Reportes

**User Story:** Como usuario, quiero poder acceder a la impresión del reporte de pedidos desde la pestaña "Detalles de Pedidos", para no tener que navegar a otra sección.

#### Criterios de Aceptación

1. THE OrderDetailsReport SHALL exponer un método `printPedidosDetalle()` que genere la vista PDF.
2. WHEN el usuario está en la pestaña "pedidos-detalle" y ejecuta la acción de impresión, THE AppReportes SHALL invocar `orderDetailsReport.printPedidosDetalle()`.
