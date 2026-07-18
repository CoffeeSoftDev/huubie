# Pedidos — Arquitectura y funcionamiento

> POS de pastelería multi-sucursal: catálogo de productos, pasteles personalizados,
> pagos/abonos, descuentos, turnos de caja y cierre del día.
> Documento validado contra el código y el esquema vivo el **2026-06-18**.

---

## 1. Stack y capas

El módulo sigue el patrón **MVC de CoffeeSoft** (framework `coffeSoft.js` v1, clase base `Templates`).

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND  src/js/*.js        clases JS  extends Templates         │
│   render declarativo: primaryLayout / createTable / createForm    │
│   createModalForm / tabLayout · datos por useFetch({opc})         │
└───────────────┬─────────────────────────────────────────────────┘
                │  POST  { opc: "<accion>", ... }   (fetch JSON)
┌───────────────▼─────────────────────────────────────────────────┐
│ CONTROLADOR  ctrl/ctrl-*.php                                      │
│   lee $_POST['opc'] → instancia el modelo → despacha al método    │
│   devuelve  echo json_encode($resultado)                          │
└───────────────┬─────────────────────────────────────────────────┘
                │  herencia
┌───────────────▼─────────────────────────────────────────────────┐
│ MODELO  mdl/mdl-*.php   class MPedidos extends CRUD               │
│   SQL crudo (_Read) + helpers (_Select/_Insert/_Update)           │
│   $this->bd = 'fayxzvov_reginas.'  · JOINs cross-schema           │
└───────────────┬─────────────────────────────────────────────────┘
                │
┌───────────────▼─────────────────────────────────────────────────┐
│ CONEXIÓN  conf/_Conect.php (PDO)  ·  conf/_CRUD.php (CRUD base)    │
│   host localhost · user root · default db fayxzvov_alpha          │
└─────────────────────────────────────────────────────────────────┘
```

- **Tema:** dark (`#111928` / contenedor `#1F2A37`), Tailwind CDN + Bootstrap 5 + fontello.
- **Plugins:** jQuery, DataTables, daterangepicker, SweetAlert2, bootbox, Chart.js, FullCalendar, Select2.
- La página inyecta todo sobre `#root` y arranca en el `$(async () => {...})` de [app.js](../../src/js/app.js).

---

## 2. Estructura de archivos

```
alpha/pedidos/
├── index.php                          POS principal (lista de pedidos)
├── admin.php                          administración de catálogo
├── ctrl/
│   ├── ctrl-pedidos.php               pedidos, pagos, descuentos, cierre, turnos, dashboard
│   ├── ctrl-pedidos-catalogo.php      POS catálogo de productos
│   ├── ctrl-pedidos-personalizado.php pasteles personalizados
│   ├── ctrl-cierre.php                cierre / turnos (dedicado)
│   ├── ctrl-admin.php                 CRUD de catálogo (categorías, productos, modificadores, clientes)
│   └── ctrl-projects.php              proyectos  ⚠ tabla `projects` no existe en la BD
├── mdl/
│   ├── mdl-pedidos.php                MPedidos — núcleo (extiende CRUD)
│   ├── mdl-cierre.php                 turnos y cierres
│   ├── mdl-pedidos-personalizado.php  armado de pastel personalizado
│   ├── mdl-admin.php                  catálogo
│   ├── mdl-pedidos-catalogo.php       POS
│   └── mdl-projects.php               ⚠ proyectos (sin tabla)
├── src/js/
│   ├── app.js                 App          — lista, CRUD pedido, pagos, descuentos, turno/cierre
│   ├── pedidos-catalogo.js    Pos / CatalogProduct — POS de productos + ticket de pastelería
│   ├── pedidos-personalizado.js CustomOrder — armado de pastel personalizado
│   ├── pedidos-cierre.js      Cierre       — abrir/cerrar turno y cierre del día
│   ├── admin.js               App/Category/Client/Modifier/ProductModifier — catálogo
│   ├── dashboard-pedidos.js   AppDashboard/DashboardPedidos — métricas (Chart.js)
│   └── order-reports.js       OrderReports — reportes de ventas/productos/clientes
├── calendario/                vista de calendario (FullCalendar)
├── templates/pos/             wireframes POS (HTML estáticos)
├── sql/                       scripts SQL de instalación / migración
└── docs/pedidos/              esta documentación
```

---

## 3. Clases del frontend (`src/js`)

| Clase | Archivo | Responsabilidad |
|---|---|---|
| `App` | app.js | Orquestador. Lista pedidos (`ls`), alta/edición (`addOrder`/`editOrder`), descuentos, pagos (`historyPay`/`addPayment`), entrega (`handleDeliveryClick`), turno/cierre (`printDailyClose`), dashboard. |
| `Pos` → `CatalogProduct` | pedidos-catalogo.js | POS: agrega productos del catálogo al pedido, modificadores/extras, imprime el `ticketPasteleria`. |
| `CustomOrder` | pedidos-personalizado.js | Arma el pastel personalizado (porciones, componentes, imagen de referencia). |
| `Cierre` | pedidos-cierre.js | Abrir/cerrar turno de caja y realizar el cierre del día. |
| `Category`, `Client`, `Modifier`, `ProductModifier` | admin.js | CRUD del catálogo de soporte. |
| `AppDashboard`, `DashboardPedidos`, `OrderReports` | dashboard-pedidos.js / order-reports.js | KPIs y reportes (Chart.js). |

Variables globales del bootstrap en [app.js:1-38](../../src/js/app.js): `app` (App), `normal` (CatalogProduct),
`custom` (CustomOrder), `cierre` (Cierre); más estado de sesión (`rol`, `subsidiaries`, `dailyClosure`, `openShift`).

---

## 4. Contexto multi-tenant (sesión)

| Variable | Uso |
|---|---|
| `$_SESSION['SUB']` | Sucursal activa del usuario |
| `$_SESSION['ROLID']` | Rol (`1` = admin: ve y filtra **todas** las sucursales) |
| `$_SESSION['COMPANY_ID']` / `['COM']` | Empresa |
| `$_SESSION['ID']` / `['USR']` | Usuario/empleado que ejecuta la acción |
| `$_SESSION['LOGO']`, `['SUBSIDIARIE_NAME']` | Datos para ticket/encabezado |

- **Rol 1 (admin):** el `filterBar` muestra un selector de sucursal; puede consultar "Todas las sucursales".
- **Otros roles:** quedan fijados a `SUB`.

---

## 5. Flujos principales

### 5.1 Inicio y listado (`opc: init` → `listOrders`)
1. `getModifiers` precarga los modificadores.
2. `init` trae estados, clientes, sucursales, rol, **cierre del día** y **turno abierto**.
3. `App.render()` pinta layout + filterBar (rango de fechas, estado, sucursal) y la tabla de pedidos.
4. La tabla muestra folio (con punto de turno), cliente, abono, total (con descuento tachado), saldo, entrega, estado y acciones.

### 5.2 Alta de pedido
```
showTypePedido()  ── valida: día NO cerrado + turno abierto del día actual
      │
      ▼
addOrder()  → crea/recupera order_clients → INSERT order (status=1 Cotización,
              cash_shift_id = turno abierto, subsidiaries_id)
      │
      ▼
CatalogProduct.layoutPos()  → agrega renglones (order_package):
        · producto de catálogo (order_products) ó
        · pastel personalizado (order_custom + order_custom_products)
        · + modificadores/extras (order_modifier_products)
      │
      ▼
imágenes de referencia (order_images, ligadas a order_package)
```

### 5.3 Pagos / abonos (`historyPay` → `addPayment`)
- Cada abono es un `order_payments` (`pay`, `method_pay_id`, `type`).
- Saldo = `total_pay − discount − Σ abonos`. Al cubrirse, el pedido pasa a estado **3 Pagado**.
- `type_id` del pedido refleja el avance de pago (1 cotización · 2 abono parcial · 3 pago completo) — **redundante con `status`**.

### 5.4 Descuentos
- `addDiscount` / `editDiscount` / `deleteDiscount` escriben `order.discount` + `order.info_discount` (motivo).

### 5.5 Turno de caja (`openShift` / `closeShift`)
- Un solo turno **abierto** por sucursal a la vez (`cash_shift.status = 'open'`).
- Los pedidos creados se enlazan al turno por `order.cash_shift_id`.
- Al cerrar se calculan métricas y se guarda el desglose en `shift_payment` y `shift_status_process`.

### 5.6 Cierre del día (`saveDailyClose`)
- Agrega las ventas del día/sucursal en `daily_closure` (`total`, `total_orders`, totales por método).
- Desglose en `closure_payment` (por método) y `closure_status_proccess` (por estado).
- Marca los pedidos del día con `order.daily_closure_id` y **bloquea** la creación de nuevos pedidos para esa fecha/sucursal.
- `daily_closure` soporta **reapertura** (`reopened_by`, `reopen_reason`, `reopened_at`).

### 5.7 Dashboard y reportes
- `apiDashboard` / `getDashboardMetrics`: KPIs por mes y comparativa interanual (Chart.js).
- `reportVentas` / `reportProductos` / `reportClientes`: tablas y top-N por rango de fechas.

---

## 6. Reglas de negocio clave

- **Bloqueo de alta:** no se crean pedidos si el día está cerrado, si no hay turno abierto, o si el turno abierto es de otro día (debe cerrarse primero).
- **Estados** (`status_process`): `1` Cotización · `2` Pendiente · `3` Pagado · `4` Cancelado.
- **Métodos de pago** (`method_pay`): `1` Efectivo (EFE) · `2` Tarjeta (TDC) · `3` Transferencia (TRANSF).
- **Soft-delete:** los listados filtran `active = 1`; cancelar un pedido es `status = 4`, no `DELETE`.
- **Montos en `DOUBLE`** (convención de la casa).

---

## 7. Bases de datos involucradas

| Esquema | Rol | Tablas que toca pedidos |
|---|---|---|
| `fayxzvov_reginas` | **Módulo** (datos operativos del POS) | `order`, `order_*`, `cash_shift`, `*closure*`, `status_process`, `method_pay` |
| `fayxzvov_alpha` | **Tenant / framework** | `subsidiaries`, `usr_users`, `usr_rols` |
| `fayxzvov_admin` | **Administración global** | `companies` |

Detalle completo de columnas y relaciones en [base-de-datos.md](base-de-datos.md) y [diagramas-er.md](diagramas-er.md).

> ⚠ **Código sin tabla:** `ctrl/mdl-projects.php` (tabla `projects`), `order_details` y
> `cash_shift_movements` se referencian en el código pero **no existen** en `fayxzvov_reginas`.
> Son features no migradas / código muerto.
