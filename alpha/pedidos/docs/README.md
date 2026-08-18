# Módulo Pedidos (alpha/pedidos)

Documentación funcional en lenguaje natural. Explica **qué hace cada apartado**, **cómo se
conectan los archivos** y **cómo se guardan los datos**.

- Ruta física: `c:\wamp64\www\huubie\alpha\pedidos\`
- Ruta web: `/alpha/pedidos/` (constante `PATH_PEDIDOS`)
- Base de datos principal: `fayxzvov_reginas`
- Bases de datos de apoyo: `fayxzvov_alpha` (usuarios y sucursales), `fayxzvov_admin` (empresas)

---

## 1. Qué es este módulo, en una frase

Es el **punto de venta de una pastelería**: captura pedidos (de catálogo o pasteles
personalizados), cobra en abonos o de contado, controla el **turno de caja** de cada
cajero y el **cierre del día** de cada sucursal, y de ahí salen los reportes,
el dashboard y el calendario de entregas.

---

## 2. Mapa de carpetas

```
alpha/pedidos/
│
├── index.php                 ← Pantalla principal: listado + captura + cobros + cierre
├── admin.php                 ← Pantalla de catálogos (productos, categorías, clientes, modificadores)
│
├── ctrl/                     ← Controladores (reciben el POST del navegador y deciden)
│   ├── ctrl-pedidos.php          Pedidos, pagos, turnos, descuentos, entregas, reportes  (2,785 líneas)
│   ├── ctrl-pedidos-catalogo.php Carrito del POS: agregar/quitar producto y "Terminar pedido"
│   ├── ctrl-pedidos-personalizado.php  Pastel a la medida: opciones, imágenes, precio
│   ├── ctrl-cierre.php           Cierre del día (corte Z), corte de caja, reabrir, recalcular
│   ├── ctrl-admin.php            ABC de catálogos que usa admin.php
│   └── ctrl-projects.php         (sin uso: ningún JS lo llama)
│
├── mdl/                      ← Modelos (solo SQL, no deciden nada)
│   ├── mdl-pedidos.php           (1,872 líneas) el modelo grande: pedidos, pagos, productos
│   ├── mdl-cierre.php            consultas de turnos y cierres
│   ├── mdl-pedidos-personalizado.php
│   ├── mdl-admin.php
│   ├── mdl-projects.php          (sin uso)
│   └── mdl-pedidos-catalogo.php  (archivo VACÍO: el catálogo reusa mdl-pedidos)
│
├── src/js/                   ← Frontend (una clase por apartado)
│   ├── app.js                    (4,193 líneas) listado de pedidos, alta, cobros, entregas
│   ├── pedidos-catalogo.js       (2,671) el POS: rejilla de productos + carrito + ticket
│   ├── pedidos-personalizado.js  (1,231) asistente por pasos del pastel personalizado
│   ├── pedidos-cierre.js         (1,345) turnos, corte de caja y cierre del día
│   ├── dashboard-pedidos.js      (786) tarjetas y gráficas
│   ├── order-reports.js          (551) reportes imprimibles
│   ├── admin.js                  (1,770) catálogos de admin.php
│   ├── navbar.js                 (690) barra superior + selector de sucursal
│   ├── shift-ticket.js           ticket del corte de turno
│   ├── lucide-icons.js / version-badge.js / session-reset-timer.js   utilidades
│   └── coffee.js, coffee-mod.js  (sin uso: ningún PHP los carga)
│
└── calendario/               ← Sub-módulo independiente, con su propio MVC
    ├── index.php
    ├── ctrl/ctrl-calendario.php
    ├── mdl/mdl-calendario.php
    └── src/{css,js}/         calendario-pedidos.js (2,535) usa FullCalendar
```

### Cómo viaja una petición

Todo el módulo funciona igual, sin rutas ni framework de URLs:

```
  Navegador (JS)                    Servidor (PHP)                 MySQL
  ─────────────                     ──────────────                 ─────
  clase App / Pos / Cierre
        │
        │  POST { opc: "listOrders", ...datos }
        ▼
  ctrl/ctrl-pedidos.php  ──►  $obj->{$_POST['opc']}()  ──►  mdl/mdl-pedidos.php
        │                        (decide, valida,              (arma el SQL)
        │                         arma el HTML de las               │
        │                         celdas de la tabla)               ▼
        ◄──────────  JSON { status: 200, data: [...] }  ──── fayxzvov_reginas
```

El campo **`opc`** del POST es el nombre del método PHP a ejecutar. Si `opc` viene vacío el
archivo se corta de inmediato (`if (empty($_POST['opc'])) exit(0);`).

La herencia siempre es la misma: **el controlador extiende al modelo**
(`class Pedidos extends MPedidos`), así que dentro del controlador se llama al SQL como si
fuera un método propio.

---

## 3. Los apartados, uno por uno

### 3.1 Listado de pedidos — `index.php` + `app.js`

La pantalla que se ve al entrar. Arriba una barra de filtros (rango de fechas, sucursal,
estado, buscador) y abajo una tabla con un renglón por pedido.

Cada renglón muestra: folio, cliente, fecha/hora de entrega, tipo de entrega, estado de
entrega, total, estado del pedido y un menú de acciones (ver, editar, cobrar, cancelar,
imprimir ticket).

Antes de dejar capturar, la pantalla revisa tres cosas y pinta un aviso si algo falla:

1. **¿El día ya está cerrado en esta sucursal?** → no se puede vender.
2. **¿Hay turno de caja abierto?** → sin turno no hay botón de "Nuevo pedido".
3. **¿El turno abierto es de un día anterior?** → aviso de turno viejo.

**Alta de un pedido** (`addOrder` en `ctrl-pedidos.php:315`): se busca al cliente por
nombre; si no existe se crea. Luego el pedido nace con `status = 1` (Cotización), amarrado a
la sucursal y al `cash_shift_id` del turno abierto. El backend vuelve a validar el turno
aunque el front ya lo haya hecho, para que no se pueda evadir.

### 3.2 Catálogo / POS — `pedidos-catalogo.js`

Es la pantalla de venta: pestañas por categoría, rejilla de productos con foto y buscador
del lado izquierdo; el carrito del lado derecho.

Cada producto que se agrega crea un renglón en `order_package`. Al presionar **Terminar
pedido** se llama a `addPayment` (`ctrl-pedidos-catalogo.php:430`), que:

- recalcula el total del pedido,
- decide el estado nuevo según el dinero recibido:
  - sin abono y destino cotización → **1 Cotización**
  - sin abono, o abono parcial → **2 Pendiente**
  - abono igual al saldo → **3 Pagado**
- si hubo dinero, inserta el renglón en `order_payments`,
- escribe la bitácora en `order_histories` (incluso cuando se guardó **sin cobro**).

También arma el **ticket de pastelería** imprimible.

### 3.3 Pastel personalizado — `pedidos-personalizado.js`

Un asistente por pasos para armar un pastel a la medida. Cada paso es una categoría de
modificador que existe en la base: forma, rellenos, cobertura, tipo de decoración, pisos,
precio por porción según sabor, flores, chocolates y dulces, extras, cake toppers, vitrina
y envío a domicilio.

El resultado se guarda en `order_custom` (la cabecera del pastel: nombre, porciones,
precio, precio real, descripción, imagen) y cada opción elegida en `order_custom_products`.
El cliente puede subir fotos de referencia, que van a `order_images`.

### 3.4 Gestión de pagos — dentro de `app.js`

Modal con pestañas donde se registran abonos. Muestra total, descuento, pagado y saldo.

Reglas que aplica:

- Un pedido **ya pagado** solo se edita con **clave de autorización** (`verifyOrderEditKey`).
- Se puede **borrar un pago** (con clave si el pedido está liquidado); el estado del pedido
  se recalcula solo.
- Se puede **cambiar el método de pago** de un abono ya registrado (`editPaymentMethod`).
- Un pago se puede cobrar en **otra sucursal** distinta a la del pedido (cobro cruzado): eso
  queda en `order_payments.subsidiaries_id` y deja nota en la bitácora.
- **Descuentos**: se guardan en el propio pedido (`order.discount` + `order.info_discount`,
  el motivo). El rol 7 (Supervisor Restringido) no puede aplicarlos.

### 3.5 Turnos de caja y cierre del día — `pedidos-cierre.js` + `ctrl-cierre.php`

Este es el corazón contable. Hay **dos niveles**:

**Turno de caja** (`cash_shift`) — es el corte de *una persona*:

- `openShift`: registra sucursal, cajero, nombre del turno, hora y **fondo de caja**
  (`opening_amount`). No deja abrir dos turnos en la misma sucursal, ni abrir turno si el
  día ya fue cerrado.
- `closeShift`: calcula ventas del periodo, las parte en efectivo / tarjeta / transferencia,
  guarda ese desglose en `shift_payment`, guarda el conteo por estado en
  `shift_status_process`, **amarra los pedidos del periodo al turno** y manda aviso
  por WhatsApp.

**Cierre del día** (`daily_closure`) — es el corte Z de *la sucursal*:

- `showCierre`: pantalla previa de verificación. Revisa y muestra semáforos:
  - ¿ya existe cierre de esa fecha? (bloqueante)
  - ¿quedan turnos abiertos? (bloqueante)
  - ¿hay pedidos huérfanos sin turno asignado? (aviso)
  - ¿hay pedidos con saldo pendiente? (aviso)
  - desglose por forma de pago
- `addCierre`: consolida todos los turnos del día, guarda el desglose en `closure_payment` y
  el conteo por estado en `closure_status_proccess`, y **amarra los pedidos al cierre**.
- `statusCierre`: **reabrir** un cierre. Solo rol 1 (Administrador), exige motivo escrito, y
  desamarra los pedidos del cierre.
- `recalcShift`: **recalcular** el corte de un turno ya cerrado a partir de los pagos
  actuales. Solo Administrador. Es idempotente y no cambia fechas ni estado del turno.

### 3.6 Reportes — `order-reports.js`

Vistas imprimibles por periodo y sucursal: ventas, productos y clientes. Del lado
izquierdo la lista de resultados, del derecho la vista previa con zoom e impresión.

### 3.7 Dashboard — `dashboard-pedidos.js`

Tarjetas de indicadores y gráficas (Chart.js): ventas completadas vs pendientes,
comparativo de ingresos diarios, ventas por día de la semana y productos más vendidos.

### 3.8 Calendario — `calendario/`

Sub-módulo aparte con su propio `index.php` y su propio MVC. Usa FullCalendar para pintar
los pedidos por **fecha de entrega**, con filtros de sucursal y estado. Desde el evento se
abre el detalle del pedido con casi las mismas acciones que el listado (cobrar, marcar
entregado, editar entrega).

### 3.9 Administración de catálogos — `admin.php` + `admin.js`

Cuatro secciones en pestañas:

| Sección | Qué administra | Tabla |
|---|---|---|
| Productos | catálogo de venta, con foto y precio | `order_products` |
| Categorías | agrupación de productos | `order_category` |
| Clientes | directorio | `order_clients` |
| Modificadores | opciones del pastel personalizado y sus valores | `order_modifier` y `order_modifier_products` |

---

## 4. Reglas de negocio que hay que conocer

**El folio no se guarda: se calcula.** Es `P{id del pedido}-{sucursal a 2 dígitos}`.
Un pedido sin sucursal sale como `P123-X`.

**El día cerrado bloquea todo.** No se abre turno ni se factura en una fecha ya cerrada;
un administrador tiene que reabrir el cierre primero.

**Los pedidos se amarran al turno y al cierre *después*, no al momento.** `cash_shift_id`
se asigna al crear el pedido, pero `closeShift` y `addCierre` vuelven a correr un UPDATE
sobre los pedidos del periodo. Por eso mover fechas de un pedido lo puede "mudar" de corte.

**El descuento vive en el pedido, no en una tabla aparte.** `order.discount` guarda el
monto y `order.info_discount` el motivo en texto.

### Roles

| id | Rol | Qué puede hacer en Pedidos |
|---|---|---|
| 1 | Administrador | todo, incluido reabrir cierres y recalcular turnos |
| 2 | Cajero | opera su sucursal (o la que elija en el switch de sesión) |
| 3 | Vendedor | igual que cajero |
| 4 | Lectura | solo consulta |
| 6 | Supervisor | Calendario y Reportes |
| 7 | Supervisor Restringido | igual que 6, **sin aplicar descuentos** |

El selector de sucursal del navbar es híbrido: para admin es filtro de consulta; para
cajero cambia la sucursal de la sesión. El valor `"0"` significa "Todas" y **solo sirve para
listar**, nunca para escribir.

---

## 5. Modelo de datos (ER)

### 5.1 El núcleo: un pedido y lo que lleva

```
                            ┌──────────────────┐
                            │  order_clients   │
                            │  el cliente      │
                            └────────┬─────────┘
                                     │ 1
                                     │
                                     │ N
  ┌──────────────┐  1        N  ┌────▼─────────────────────────┐
  │status_process├──────────────┤            order             │
  │1 Cotización  │   status     │  EL PEDIDO (la cabecera)     │
  │2 Pendiente   │              │                              │
  │3 Pagado      │              │  total_pay, discount         │
  │4 Cancelado   │              │  date_order + time_order     │
  └──────────────┘              │  is_delivered, delivery_type │
                                │  subsidiaries_id             │
                                │  cash_shift_id ──────────────┼──► turno
                                │  daily_closure_id ───────────┼──► cierre
                                └───┬────────────┬─────────┬───┘
                                    │ 1          │ 1       │ 1
                     ┌──────────────┘            │         └──────────────┐
                     │ N                         │ N                      │ N
          ┌──────────▼────────┐      ┌───────────▼────────┐   ┌───────────▼────────┐
          │  order_package    │      │  order_payments    │   │  order_histories   │
          │  RENGLÓN del      │      │  cada abono        │   │  bitácora          │
          │  pedido           │      │                    │   │                    │
          │  quantity, price  │      │  pay, date_pay     │   │  action, type,     │
          │  dedication       │      │  method_pay_id ────┼─► │  usr_users_id      │
          └──┬─────────────┬──┘      │  subsidiaries_id   │   └────────────────────┘
             │             │         │  (cobro cruzado)   │
             │             │         └────────────────────┘
             │             │
   producto  │             │  pastel personalizado
   de catálogo             │
             │             │
  ┌──────────▼──────┐  ┌───▼──────────────┐
  │ order_products  │  │  order_custom    │
  │ nombre, precio  │  │  nombre, precio  │
  │ foto            │  │  porciones, foto │
  └────────┬────────┘  └────┬─────────────┘
           │ N              │ 1
           │                │ N
  ┌────────▼────────┐  ┌────▼────────────────────┐
  │ order_category  │  │ order_custom_products   │
  │ PASTELES,       │  │ cada opción elegida     │
  │ GALLETAS, PAN…  │  │ (relleno, cobertura…)   │
  └─────────────────┘  └────────────┬────────────┘
                                    │ N
                                    │ 1
                       ┌────────────▼────────────┐
                       │ order_modifier_products │
                       │ "Chocolate", "Fresa"…   │
                       └────────────┬────────────┘
                                    │ N
                                    │ 1
                          ┌─────────▼─────────┐
                          │  order_modifier   │
                          │ forma, rellenos,  │
                          │ cobertura, pisos… │
                          └───────────────────┘

  order_package  1 ──── N  order_images   (fotos de referencia del pedido)
```

> **Nota sobre `order_package`**: es el renglón del pedido y siempre apunta a *uno* de los
> tres: `product_id` (producto de catálogo), `custom_id` (pastel personalizado) o
> `modifier_id` (un modificador vendido suelto). Su columna de enlace al pedido se llama
> `pedidos_id`, no `order_id`.

### 5.2 Caja: turnos y cierres

```
                 ┌─────────────────────────────────┐
                 │        daily_closure            │
                 │        CIERRE DEL DÍA (corte Z) │
                 │                                 │
                 │  closure_date, subsidiary_id    │
                 │  total_cash / card / transfer   │
                 │  total_discount, total_shifts   │
                 │  status  0=cerrado 1=reabierto  │
                 │  reopened_by, reopen_reason     │
                 └───┬───────────┬─────────────┬───┘
                     │ 1         │ 1           │ 1
          ┌──────────┘           │             └──────────────┐
          │ N                    │ N                          │ N
┌─────────▼──────────┐ ┌─────────▼──────────┐   ┌─────────────▼───────────┐
│    cash_shift      │ │  closure_payment   │   │ closure_status_proccess │
│  TURNO DE CAJA     │ │  cuánto entró por  │   │ cuántos pedidos quedaron│
│                    │ │  cada método       │   │ en cada estado          │
│ employee_id        │ └────────────────────┘   └─────────────────────────┘
│ opened_at/closed_at│
│ opening_amount     │
│ cash/card/transfer │
│ status open|closed │
└──┬──────────────┬──┘
   │ 1            │ 1
   │ N            │ N
┌──▼────────────┐ ┌▼──────────────────────┐
│ shift_payment │ │ shift_status_process  │
│ mismo desglose│ │ mismo conteo,         │
│ por turno     │ │ por turno             │
└───────┬───────┘ └───────────┬───────────┘
        │ N                   │ N
        │ 1                   │ 1
 ┌──────▼──────┐      ┌───────▼────────┐
 │ method_pay  │      │ status_process │
 │ 1 Efectivo  │      │ 1 Cotización   │
 │ 2 Tarjeta   │      │ 2 Pendiente    │
 │ 3 Transfer. │      │ 3 Pagado       │
 └─────────────┘      │ 4 Cancelado    │
                      └────────────────┘
```

El patrón se repite en los dos niveles: **una cabecera con los totales** + **una tabla de
desglose por método de pago** + **una tabla de conteo por estado**. Turno y cierre son la
misma idea a distinta escala.

### 5.3 Enlaces a las otras bases

Estas tablas no viven en `fayxzvov_reginas`, pero el módulo las usa todo el tiempo:

| Se usa como | Tabla real |
|---|---|
| Sucursal (`subsidiaries_id`, `subsidiary_id`) | `fayxzvov_alpha.subsidiaries` |
| Usuario / empleado (`employee_id`, `usr_users_id`) | `fayxzvov_alpha.usr_users` |
| Rol | `fayxzvov_alpha.usr_rols` |
| Empresa (`companies_id`) | `fayxzvov_admin.companies` |

---

## 6. Diccionario de valores

**`order.status` / `order.type_id`** — los dos guardan lo mismo: 1 Cotización · 2 Pendiente ·
3 Pagado · 4 Cancelado.

**`order.is_delivered`** — 0 No entregado · 1 Entregado · 2 Para producir.

**`order.delivery_type`** — 0 Entrega local (recoge en tienda) · 1 Entrega a domicilio.

**`order.order_type`** — `pedido` o `mostrador`.

**`cash_shift.status`** — `open` / `closed`.

**`daily_closure.status`** — 0 cerrado · 1 reabierto.

**`method_pay`** — 1 Efectivo · 2 Tarjeta · 3 Transferencia.

**Categorías reales de producto**: Pasteles Especialidades, Pasteles Tradicionales,
Galletas, Pasteles de 3 Leches, Pan, Porción de Pastel, Sobre Pedido, Charolas, Postres,
Bocadillos, Decoraciones.

---

## 7. Cosas que conviene saber antes de tocar el código

- **`mdl/mdl-pedidos-catalogo.php` está vacío.** El controlador del catálogo hereda de
  `MPedidos`; el archivo existe pero no tiene nada.
- **`ctrl-projects.php` / `mdl-projects.php` no los llama nadie.** Ningún JS del módulo los
  invoca.
- **`src/js/coffee.js` y `src/js/coffee-mod.js` tampoco se cargan** desde ningún PHP: son
  versiones anteriores del detalle del pedido.
- **`order_payments.type` siempre vale 2** en los 1,282 renglones existentes. Es una columna
  que quedó sin uso real.
- **La bitácora (`order_histories`) no cubre todo.** Registra pagos, descuentos y ediciones;
  el alta del pedido no deja rastro propio (lo escribe el "Terminar pedido").
- **Hay tablas del esquema que no pertenecen a este módulo**: todo lo que empieza con `evt_`
  es del módulo de Eventos, y `pos_*` / `reservation*` son de otros desarrollos que comparten
  la misma base.
