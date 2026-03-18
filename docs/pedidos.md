# Pedidos - Sistema de Gestion de Pedidos

## Descripcion General

**Pedidos** es un gestor de pedidos multi-sucursal disenado para pasteleria/reposteria. Permite crear, administrar y dar seguimiento a pedidos de productos de catalogo y pasteles personalizados, registrar pagos, gestionar clientes y visualizar pedidos en calendario.

- **Base de datos:** `fayxzvov_reginas` (14+ tablas)
- **Arquitectura:** MVC — `ctrl/` (controladores) -> `mdl/` (modelos) -> `src/js/` (frontend)
- **Acceso:** Basado en sesion con roles (Admin = 1, Usuario regular)

---

## Tabla Principal de Pedidos

La vista principal (`index.php` + `app.js`) muestra una tabla con todos los pedidos.

### Filtros disponibles

| Filtro | Descripcion |
|--------|-------------|
| Rango de fechas | Filtra por fecha de creacion |
| Estatus | Cotizacion, Pendiente, Pagado, Cancelado |
| Sucursal | Solo visible para Admin (rol 1) |

### Columnas de la tabla

| Columna | Descripcion |
|---------|-------------|
| # | Numero de pedido |
| Cliente | Nombre del cliente |
| Telefono | Telefono de contacto |
| Total | Monto total del pedido |
| Abonado | Monto pagado hasta el momento |
| Resta | Saldo pendiente |
| Estatus | Estado actual del pedido |
| Fecha entrega | Fecha y hora de entrega programada |
| Acciones | Botones de operacion |

### Acciones por pedido

| Accion | Descripcion |
|--------|-------------|
| Ver detalle | Abre el detalle completo del pedido |
| Editar | Modifica productos, cantidades, dedicatoria |
| Registrar pago | Agrega un abono o pago completo |
| Aplicar descuento | Aplica descuento al total |
| Imprimir | Genera vista de impresion del pedido |
| Cancelar | Cambia estatus a Cancelado (4) |

### Estatus del pedido

| ID | Nombre | Descripcion |
|----|--------|-------------|
| 1 | Cotizacion | Pedido sin compromiso de pago |
| 2 | Pendiente | Pedido confirmado, pago parcial o sin pago |
| 3 | Pagado | Pedido liquidado completamente |
| 4 | Cancelado | Pedido cancelado |

---

## Modulos

### 1. Catalogo POS (`pedidos-catalogo.js`)

Interfaz de punto de venta para productos estandar del catalogo.

- **Panel izquierdo:** Grid de productos con imagen, nombre y precio
  - Busqueda en tiempo real
  - Filtro por pestanas de categorias
  - Scroll infinito de productos
- **Panel derecho:** Carrito de compra
  - Lista de productos agregados con cantidad y subtotal
  - Ajuste de cantidad (+/-)
  - Eliminacion individual o total
  - Total acumulado
- **Boton "Arma tu pastel!":** Abre el armador de pastel personalizado

### 2. Armador de Pastel Personalizado (`pedidos-personalizado.js`)

Flujo multi-paso para construir pasteles a medida.

- **Paso 1-N:** Seleccion de modificadores por categoria
  - Categorias: sabor base, relleno, cobertura, decoracion, etc.
  - Radio buttons (seleccion unica) o checkboxes (seleccion multiple)
  - Productos marcados como "Extra" tienen costo adicional
- **Imagen de referencia:** Subida de fotos del pastel deseado
- **Dedicatoria:** Texto personalizado para el pastel
- **Notas especiales:** Instrucciones adicionales
- **Porciones:** Cantidad de porciones del pastel

### 3. Calendario (`calendario/`)

Vista de calendario para programacion de entregas.

- **Libreria:** FullCalendar 6.1.14
- **Eventos:** Cada pedido aparece como evento en su fecha de entrega
- **Colores:** Codificados por estatus (cotizacion, pendiente, pagado, cancelado)
- **Filtros:** Por estatus, tipo de entrega, sucursal
- **Click en evento:** Abre detalle del pedido

### 4. Administracion (`admin.js` + `admin.php`)

Panel de administracion con pestanas para gestionar catalogos.

| Pestana | Operaciones |
|---------|-------------|
| Productos | Crear, editar, activar/desactivar, subir imagen |
| Categorias | Crear, editar, activar/desactivar |
| Modificadores | Crear grupos (sabor, relleno, etc.), activar/desactivar |
| Productos de modificador | Agregar opciones a cada grupo, precio, marcar como "Extra" |
| Clientes | Crear, editar, desactivar, validacion de telefono (10 digitos) |

### 5. Dashboard y Reportes (`dashboard-pedidos.js`, `order-reports.js`)

- Graficas de ventas con Chart.js 4.4.0
- Metricas de pedidos por estatus
- Distribucion de ventas

### 6. Turnos de Caja

- Tablas: `cash_shift`, `cash_shift_movements` (definidas en `cash_shift_tables.sql`)
- Boton "Cierre del dia" en la vista principal
- Genera reporte de pedidos del dia agrupados por estatus y forma de pago

---

## Flujo de Trabajo Principal

```
Apertura de turno
       |
       v
Crear pedido --> Seleccionar/crear cliente
       |
       v
Elegir tipo de pedido:
  |                        |
  v                        v
Catalogo              Personalizado
(seleccionar           (armador de pastel:
 productos del          modificadores +
 grid)                  imagen + dedicatoria)
       |                        |
       v________________________v
       |
       v
Revisar carrito --> Agregar dedicatoria/notas
       |
       v
Guardar pedido (estatus: Pendiente)
       |
       v
Registrar pago(s) --> Parcial o completo
       |
       v
Cierre del dia (reporte de ventas)
```

---

## Stack Tecnico

| Capa | Tecnologia |
|------|-----------|
| Backend | PHP (vanilla, patron MVC) |
| Base de datos | MySQL (charset utf8mb4) |
| ORM/DB | Clase `CRUD.php` personalizada + `Utileria.php` |
| Frontend core | jQuery 3.7.0 |
| Tablas | DataTables 1.13.6 |
| Dropdowns | Select2 |
| Modales | Bootbox |
| Alertas | SweetAlert2 |
| CSS | Tailwind CSS (CDN) + Bootstrap 5 |
| Calendario | FullCalendar 6.1.14 |
| Graficas | Chart.js 4.4.0 |
| Fechas | Moment.js + DateRangePicker |

---

## Estructura de Archivos

```
alpha/pedidos/
  index.php                          # Vista principal de pedidos
  admin.php                          # Panel de administracion
  ctrl/
    ctrl-pedidos.php                 # Controlador principal de pedidos
    ctrl-admin.php                   # Controlador de administracion
    ctrl-pedidos-catalogo.php        # Controlador del catalogo POS
    ctrl-pedidos-personalizado.php   # Controlador de pedidos personalizados
    ctrl-projects.php                # Controlador de proyectos
  mdl/
    mdl-pedidos.php                  # Modelo de pedidos
    mdl-admin.php                    # Modelo de administracion
    mdl-pedidos-personalizado.php    # Modelo de personalizados
    mdl-projects.php                 # Modelo de proyectos
  src/js/
    app.js                           # Clase principal de la app
    pedidos-catalogo.js              # Interfaz catalogo POS
    pedidos-personalizado.js         # Armador de pastel
    admin.js                         # Interfaz de admin
    dashboard-pedidos.js             # Dashboard
    order-reports.js                 # Reportes
  calendario/
    index.php                        # Vista del calendario
    ctrl/ctrl-calendario.php         # Controlador
    mdl/mdl-calendario.php           # Modelo
    src/js/app-calendario.js         # JS del calendario
  sql/
    create_database_complete.sql     # Schema completo
    cash_shift_tables.sql            # Tablas de turnos de caja
    add_delivery_type.sql            # Migracion: tipo de entrega
```

---

## API - Endpoints Principales

Todos los endpoints usan `POST` con un parametro `opc` para seleccionar la operacion.

### ctrl-pedidos.php

| Operacion | Descripcion |
|-----------|-------------|
| `init` | Datos iniciales (modificadores, productos, clientes, estatus, turno) |
| `lsProducto` | Listar productos por categoria |
| `getProduct` | Obtener detalle de producto |
| `addProduct` | Agregar producto al pedido |
| `editProduct` | Editar item del pedido (cantidad, dedicatoria, notas) |
| `quantityProduct` | Actualizar cantidad |
| `removeProduct` | Eliminar item del pedido |
| `deleteAllProducts` | Vaciar todos los items |
| `addPayment` | Registrar pago |
| `getPayment` | Obtener detalle de pago |
| `getOrder` | Obtener pedido completo |

### ctrl-admin.php

| Operacion | Descripcion |
|-----------|-------------|
| `listProductos` | Listar productos con paginacion |
| `addProduct` / `editProduct` | CRUD de productos (con imagen) |
| `statusProducto` | Activar/desactivar producto |
| `addCategory` / `editCategory` / `statusCategory` | CRUD de categorias |
| `addClient` / `editClient` / `deleteClient` | CRUD de clientes |
| `addModifier` / `editModifier` / `statusModifier` | CRUD de grupos de modificadores |
| `addProductModifier` / `editProductModifier` / `deleteProductModifier` | CRUD de opciones de modificador |

### ctrl-pedidos-personalizado.php

| Operacion | Descripcion |
|-----------|-------------|
| `addCustomOrder` | Crear pastel personalizado |
| `editCustomOrder` | Editar pastel personalizado |
| `cancelCustomOrder` | Cancelar pastel personalizado |
| `addModifierProduct` | Agregar modificador al pastel |
| `addOrderImages` / `getOrderImages` / `deleteOrderImage` | Gestion de imagenes |

### ctrl-calendario.php

| Operacion | Descripcion |
|-----------|-------------|
| `init` | Datos iniciales (sucursales, rol) |
| `getCalendar` | Obtener pedidos para el calendario |

---

## Base de Datos - Tablas Principales

| Tabla | Descripcion |
|-------|-------------|
| `order` | Pedidos (id, client_id, total_pay, status, fechas, sucursal) |
| `order_clients` | Clientes (nombre, telefono, email, direccion) |
| `order_products` | Productos del catalogo (nombre, precio, imagen, categoria) |
| `order_category` | Categorias de productos |
| `order_package` | Items de un pedido (vincula productos/custom al pedido) |
| `order_custom` | Pasteles personalizados (nombre, precio, porciones) |
| `order_custom_products` | Modificadores seleccionados para un pastel |
| `order_modifier` | Grupos de modificadores (sabor, relleno, etc.) |
| `order_modifier_products` | Opciones dentro de cada grupo |
| `order_payments` | Pagos registrados (monto, metodo, fecha) |
| `order_images` | Imagenes de referencia |
| `order_histories` | Historial de cambios (auditoria) |
| `status_process` | Catalogo de estatus |

---

---

# Roadmap: Escalar a Punto de Venta (POS)

> Referencia: Funcionalidades tipo **Pulpos POS** con reportes estilo **SoftRestaurant** (Corte X y Corte Z).

---

## Fase 1 - Core POS (Venta Directa)

Lo esencial para operar como punto de venta.

| Feature | Descripcion | Estado actual |
|---------|-------------|---------------|
| **Modo mostrador / venta rapida** | Vender sin crear pedido anticipado. Cobro inmediato al momento. Flujo: seleccionar productos -> cobrar -> ticket. | No existe. Solo hay flujo de pedidos anticipados. |
| **Corte X** | Reporte parcial de caja **sin cerrar el turno**. Muestra totales acumulados desde la apertura: ventas, formas de pago, cancelaciones. Se puede imprimir multiples veces. | No existe. Hay un "cierre del dia" pero no es un Corte X formal. |
| **Corte Z** | Cierre **definitivo** del turno. Cuadra la caja, genera resumen final, imprime reporte y bloquea el turno. Solo se puede hacer una vez por turno. | No existe. Las tablas `cash_shift` estan creadas pero sin logica de corte. |
| **Fondo de caja** | Registrar el monto inicial en efectivo al abrir turno. | No existe. |
| **Movimientos de caja** | Registrar retiros parciales, depositos a banco, gastos operativos (con motivo y responsable). | No existe. |
| **Pago mixto** | Dividir un solo cobro entre multiples formas de pago (ej: $200 efectivo + $150 tarjeta). | Parcial. Se pueden registrar pagos individuales pero no hay split en una sola transaccion. |

### Que implica el Corte X

```
CORTE X - PARCIAL
================================
Sucursal: Centro
Cajero: Maria Lopez
Fecha: 2026-03-17  14:30
Turno abierto: 09:00
--------------------------------
VENTAS
  Efectivo:          $3,450.00
  Tarjeta:           $2,100.00
  Transferencia:       $800.00
  TOTAL:             $6,350.00
--------------------------------
MOVIMIENTOS
  Fondo inicial:     $1,000.00
  Retiros:            -$500.00
  Depositos:              $0.00
--------------------------------
EFECTIVO EN CAJA:    $3,950.00
  (fondo + ventas efectivo - retiros)
--------------------------------
Pedidos creados:           12
Pedidos pagados:            8
Pedidos cancelados:         1
Descuentos aplicados:  $150.00
================================
* Este corte NO cierra el turno
```
**Nota:** Normalmente se cierra el turno antes de sacar el reporte CORTE X, pero aun asi si sigue abierto se puede sacar.

### Que implica el Corte Z

```
CORTE Z - CIERRE DEFINITIVO
================================
Sucursal: Centro
Cajero: Maria Lopez
Fecha: 2026-03-17
Turno: 09:00 - 21:00
--------------------------------
RESUMEN DE VENTAS
  Total bruto:       $8,750.00
  Descuentos:         -$350.00
  Cancelaciones:      -$200.00
  Total neto:        $8,200.00
--------------------------------
DESGLOSE POR FORMA DE PAGO
  Efectivo:          $4,100.00
  Tarjeta credito:   $2,500.00
  Tarjeta debito:      $800.00
  Transferencia:       $800.00
--------------------------------
MOVIMIENTOS DE CAJA
  Fondo inicial:     $1,000.00
  Retiros:          -$1,500.00
  Depositos:              $0.00
--------------------------------
CUADRE DE CAJA
  Efectivo esperado: $3,600.00
  Efectivo contado:  $3,580.00
  Diferencia:          -$20.00
--------------------------------
DETALLE DE PRODUCTOS
  Pastel chocolate x4   $2,800
  Pastel fresa x3       $1,950
  Cupcakes x12            $600
  ... (top 10 productos)
--------------------------------
Pedidos totales:           18
Pedidos pagados:           14
Pedidos pendientes:         2
Pedidos cancelados:         2
================================
Turno cerrado: 21:05
Folio: Z-2026-0317-001
* CIERRE DEFINITIVO - No se pueden
  registrar mas ventas en este turno
```

---

## Fase 2 - Tickets e Impresion

| Feature | Descripcion |
|---------|-------------|
| **Impresion termica (ESC/POS)** | Generar comandos ESC/POS para impresoras de 58mm u 80mm. Libreria sugerida: `escpos-php` o impresion via navegador con CSS `@media print`. |
| **Ticket de venta** | Logo de la empresa, items con cantidad y precio, subtotal, descuento, total, forma de pago, cambio, folio, fecha/hora, pie de pagina. |
| **Ticket de Corte X / Z** | Formato impreso de los reportes de corte (ver ejemplos arriba). |
| **Reimprimir ticket** | Desde el historial de ventas, reenviar a impresora. |
| **Comanda de cocina** | Ticket simplificado para el area de produccion con solo los items y notas. |

---

## Fase 3 - Inventario y Control de Stock

| Feature | Descripcion |
|---------|-------------|
| **Control de stock** | Cantidades disponibles por producto, alertas cuando el stock baje del minimo. |
| **Recetas / Insumos** | Definir que insumos lleva cada producto. Al vender, descontar automaticamente. |
| **Mermas y ajustes** | Registrar perdidas, caducidad, producto danado. Ajustar inventario con motivo. |
| **Ordenes de compra** | Crear solicitudes a proveedores. Registro de entrada de mercancia. |
| **Kardex** | Historial de movimientos por insumo (entradas, salidas, ajustes). |

---

## Fase 4 - Reportes Avanzados (estilo SoftRestaurant)

| Reporte | Descripcion |
|---------|-------------|
| **Ventas por hora** | Grafica de barras mostrando ventas acumuladas hora a hora. Identifica horas pico. |
| **Ventas por producto** | Ranking de productos mas vendidos (cantidad y monto). Top 10 y detalle completo. |
| **Ventas por categoria** | Agrupacion por rubro: pasteles, cupcakes, bebidas, etc. |
| **Ventas por cajero/empleado** | Monto vendido por cada usuario. Productividad y comisiones. |
| **Comparativo de periodos** | Dia vs dia, semana vs semana, mes vs mes. Crecimiento porcentual. |
| **Resumen de formas de pago** | Totales desglosados: efectivo, tarjeta credito, tarjeta debito, transferencia, otro. |
| **Cancelaciones y descuentos** | Detalle de pedidos cancelados (motivo, monto, responsable). Total de descuentos aplicados. |
| **Propinas** | Monto de propinas por empleado y por turno. |
| **Cuentas por cobrar** | Pedidos con saldo pendiente. Antiguedad de la deuda. |
| **Historico de cortes** | Listado de todos los Cortes Z con folio, fecha, cajero y totales. |

---

## Fase 5 - Funcionalidades Complementarias

| Feature | Descripcion |
|---------|-------------|
| **Codigo de barras** | Lector para busqueda rapida de productos. Generar codigos para cada producto. |
| **Facturacion CFDI 4.0** | Integracion con PAC (Finkok, SW Sapien, Facturapi). Timbrado automatico o bajo demanda. |
| **Panel de cocina (KDS)** | Pantalla para el area de produccion. Muestra pedidos en cola, en preparacion y listos. |
| **Programa de lealtad** | Sistema de puntos por compra. Canje de puntos por descuentos o productos gratis. |
| **Mesas / Cuentas** | Asignar pedidos a mesa. Dividir cuenta entre comensales. Unir mesas. |
| **Propinas** | Campo de propina en el cobro. Asignacion a empleado. |
| **App movil / PWA** | Toma de pedidos desde tablet o celular. Notificaciones push. |
| **Sincronizacion offline** | Operar sin internet y sincronizar cuando se restablezca la conexion. |
| **Multi-almacen** | Inventario separado por sucursal con transferencias entre almacenes. |
| **Roles granulares** | Permisos por modulo: quien puede cancelar, dar descuento, hacer corte, ver reportes. |
