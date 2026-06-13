# Modulo Traspasos — Inventario Huubie

**Ruta:** `inventory/operacion/almacen/`
**Esquemas:** `fayxzvov_inventory` · `fayxzvov_erp`
**DDL:** `docs/ddl-traspasos.sql` (ejecutado; no volver a correr)

---

## Tablas involucradas

| Tabla | Esquema | Rol |
|---|---|---|
| `inventory_transfer` | inventory | Cabecera del traspaso |
| `detail_inventory_transfer` | inventory | Renglones (items) |
| `transfer_status` | inventory | Catalogo de estados |
| `inventory_transfer_history` | inventory | Bitacora de cambios de estado |
| `item` | inventory | Catalogo de productos |
| `item_attribute` | inventory | Atributos (sku, cost_unit, image) |
| `item_category` | inventory | Categoria del producto |
| `stock` | inventory | Stock por almacen |
| `warehouse` | inventory | Almacenes |
| `warehouse_area` | inventory | Areas de almacen |
| `branches` | erp | Sucursales (origin / destination) |
| `users` | erp | Usuarios (historial) |

---

## Campos clave del cabecero

```
inventory_transfer
  id, folio, note, total_products, total_units, total_cost
  received_by_name      (texto libre de quien recibe, capturado al confirmar)
  date_request, date_authorized, date_sent, date_received
  created_at, updated_at, active
  status_id             -> transfer_status
  origin_warehouse_id, destination_warehouse_id -> warehouse
  origin_branch_id      -> fayxzvov_erp.branches
  destination_branch_id -> fayxzvov_erp.branches
  requested_user_id, authorized_user_id, received_user_id -> fayxzvov_erp.users
  companies_id          -> fayxzvov_erp.companies
```

## Campos clave del detalle

```
detail_inventory_transfer
  id, quantity, cost, subtotal
  origin_stock_prev, origin_stock_post
  destination_stock_prev, destination_stock_post
  created_at, active
  item_id               -> fayxzvov_inventory.item   (NOT product_id)
  inventory_transfer_id -> inventory_transfer (ON DELETE CASCADE)
```

---

## Maquina de estados

```
REQUESTED ──► RECEIVED   (terminal — stock se mueve)
          └─► REJECTED   (terminal — sin movimiento)
```

- **REQUESTED**: estado inicial al crear el traspaso (`saveTraspaso`).
- **RECEIVED**: el destino acepta; es el unico punto donde se mueve el stock real.
- **REJECTED**: terminal sin movimiento. Cubre dos acciones de UI distintas:
  - *Rechazar* (lo hace el destino).
  - *Cancelar solicitud* (lo hace el origen). No existe estado CANCELLED ni endpoint propio: `cancelTraspaso` del frontend invoca `rejectTraspaso` con la nota `'Traspaso cancelado por el solicitante'`.

Los estados **AUTHORIZED** e **IN_TRANSIT** existen en la BD pero no se generan desde la UI de este modulo (reservados para flujos futuros). Si un traspaso llegara en estado IN_TRANSIT (flujo legado donde el origen ya se desconto al enviar), `confirmTraspaso` lo detecta via `status_code === 'IN_TRANSIT'` y solo suma el destino, sin volver a descontar el origen.

---

## Movimiento de stock

El stock fisico (`stock.quantity`) **solo se mueve al confirmar la recepcion**. La creacion no toca `stock`.

### Al crear (`saveTraspaso`)

- No modifica la tabla `stock`.
- Por cada renglon calcula y guarda los snapshots de origen en el detalle: `origin_stock_prev` (stock actual del origen) y `origin_stock_post` (`max(0, prev - quantity)`). Los snapshots de destino quedan en `NULL`.
- Crea cabecero (estado REQUESTED), renglones e historial dentro de una transaccion.

### Al confirmar (`confirmTraspaso`)

Dentro de una unica transaccion (`$this->transaction(function(){...})`):

1. Por cada renglon del traspaso:
   - Descontar `quantity` del stock de `origin_warehouse_id` (salvo flujo legado IN_TRANSIT, donde el origen ya se desconto).
   - Sumar `quantity` al stock de `destination_warehouse_id` (crea fila si no existe).
   - Recalcular y guardar los snapshots `origin_stock_prev/post` y `destination_stock_prev/post` al momento de confirmar.
2. Cambiar estado del cabecero a RECEIVED y registrar `date_received`, `received_user_id` y `received_by_name`.
3. Insertar entrada en `inventory_transfer_history` con nota `Traspaso recibido` (o `Traspaso recibido · Recibe: {nombre}` si se capturo quien recibe).

---

## Variables de sesion

| Variable PHP | Descripcion |
|---|---|
| `$_SESSION['IDU']` | Validacion de acceso en `traspasos.php` |
| `$_SESSION['company_id']` | Tenant ID (companies_id) |
| `$_SESSION['branch_id']` | Sucursal activa del usuario |
| `$_SESSION['user_id']` | Usuario que opera |

---

## Archivos del modulo

```
inventory/operacion/almacen/
├── traspasos.php                     # Entry point (page)
├── js/traspasos.js                   # Frontend: App + Traspasos + TraspasosView
├── ctrl/ctrl-traspasos.php           # Controlador PHP
└── mdl/mdl-traspasos.php             # Modelo PHP

inventory/src/js/components/
└── traspaso-form.js                  # Modal "Nuevo Traspaso" (TraspasoForm)
```

### Roles de las clases en `traspasos.js`

| Clase | Rol |
|---|---|
| `App` | Bootstrap: layout (mainPanel + detailPanel), filtros, sesion/catalogos, seleccion de fila |
| `Traspasos` | Capa de datos: listado, KPIs, alta, confirmar/rechazar/cancelar e impresion |
| `TraspasosView` | Render: header, KPIs (`kpisRow`), panel de detalle (`traspasoDetailPanel`) y modal de alta |

---

## Endpoints del controlador

| Metodo ctrl | Descripcion |
|---|---|
| `init` | sucursales + almacenes + `estados_traspaso`; tambien expone company/branch/user de sesion |
| `getCatalogosTraspaso` | Items (item+item_attribute) con stock por sucursal, almacenes y sucursales. `categorias` se devuelve vacio (el ERP no usa filtro de categoria en el modal, a diferencia del POS) |
| `lsTraspasos` | Lista para DataTable (scope = origen u destino de la sucursal activa); filtros estado/destino/rango/busqueda |
| `showTraspasos` | KPIs: total, pendientes (REQUESTED), en_transito (IN_TRANSIT), recibidos (RECEIVED), rechazados (REJECTED) |
| `getTraspaso` | Detalle completo: cabecero + renglones + historial |
| `saveTraspaso` | Crear traspaso (estado REQUESTED) con detalle e historial en transaccion; folio `TRA-####` |
| `confirmTraspaso` | Confirmar recepcion con movimiento de stock en transaccion. Recibe `received_by` (texto, quien recibe) |
| `rejectTraspaso` | Rechazar/cancelar (estado REJECTED) en transaccion. La cancelacion del origen reusa este endpoint con `note` distinto |

> No existe endpoint `cancelTraspaso`. La cancelacion es `rejectTraspaso` con otra nota.

### Folios

`getNextFolio('TRA-', companies_id)` toma el ultimo folio del tenant con ese prefijo, extrae el numero y lo incrementa: formato `TRA-0001`, `TRA-0002`, ...

---

## Acciones del panel de detalle (reglas de UI)

`TraspasosView.traspasoDetailPanel` decide los botones segun el estado del traspaso y si la **sucursal activa** (`app.branchId`) es el origen o el destino:

| Condicion | Botones | Accion |
|---|---|---|
| Estado REQUESTED **y** sucursal activa = ORIGEN | `Cancelar Solicitud` | `cancelTraspaso` (→ `rejectTraspaso` con nota) |
| Sucursal activa = DESTINO **y** estado REQUESTED / AUTHORIZED / IN_TRANSIT | `Rechazar` + `Aceptar Envio` | `rejectTraspaso` / `confirmTraspaso` |
| Cualquier otro caso | (sin botones de accion) | solo lectura |

`Aceptar Envio` (`confirmTraspaso`) abre un SweetAlert que **exige** capturar quien recibe el traspaso (campo obligatorio) antes de mover el stock. El boton de imprimir y el de cerrar estan siempre disponibles.

---

## Impresion / comprobante

`Traspasos.printTraspaso(t)` genera un comprobante HTML (`renderTraspasoDoc`) y lo abre en una ventana nueva (`window.open`) con botones Imprimir / Cerrar:

- Acepta el objeto de detalle ya mapeado, o un id (en cuyo caso vuelve a pedir `getTraspaso` y lo mapea con `mapTraspasoDetail`).
- El documento incluye: folio + estado, ruta origen→destino, datos (solicito/autoriza/fechas), tabla de productos con costo unitario y subtotal, totales (tipos / unidades / costo) y nota.
- Requiere ventanas emergentes permitidas; si el navegador las bloquea avisa al usuario.

---

## Patrones de codigo

- Toda operacion multi-escritura usa `$this->transaction(function(){...})` con `catch (\Throwable $e)` que retorna `['status'=>500]`.
- El controlador resuelve company/branch/user desde `$_SESSION` con fallback a `$_POST` (`(int)($_SESSION['company_id'] ?? $_POST['companies_id'] ?? 0)`).
- No se prefijan metodos propios con `_` (excepcion: metodos heredados del framework `_Read`, `_CUD`, etc.).
- El scope de listado y de KPIs incluye traspasos donde la sucursal activa es origen O destino.
- El modal de alta agrupa el catalogo por la categoria de cada producto (campo `categoria` del JOIN a `item_category`), no por un catalogo de categorias aparte.

---

## Componente JS — TraspasoForm

Clase standalone adjuntada como `Templates.prototype.traspasoForm`.

**Opciones principales:**

```js
this.traspasoForm({
    parent: 'body',
    id:     'traspasoFormModal',
    json:   [ /* items del catalogo */ ],
    data: {
        sucursales:      [],   // [{ id, valor }]
        almacenes:       [],   // [{ id, valor, branch_id }]
        categorias:      [],   // vacio en el ERP (sin filtro de categoria)
        origenIdInicial: app.branchId
    },
    onSave: (payload) => traspasos.nuevoTraspaso(payload),
    onClose: () => {}
});
```

**Payload que emite `onSave`:**

```js
{
    origen:    { id, nombre, almacen: { id, nombre } },
    destino:   { id, nombre, almacen: { id, nombre } },
    productos: [ { productId, sku, nombre, cant, costo, stockOrigenPrev } ],
    nota:      ''
}
```

En `Traspasos.nuevoTraspaso()` el frontend lo traduce al payload del backend:
`productId` → `item_id`, `cant` → `quantity`, `costo` → `cost`, `nota` → `note`,
y aplana origen/destino a `origin_branch_id`, `destination_branch_id`,
`origin_warehouse_id`, `destination_warehouse_id`.
