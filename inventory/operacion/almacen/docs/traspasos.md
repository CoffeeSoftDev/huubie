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
| `transfer_status` | inventory | Catálogo de estados |
| `inventory_transfer_history` | inventory | Bitácora de cambios de estado |
| `item` | inventory | Catálogo de productos |
| `item_attribute` | inventory | Atributos (sku, cost_unit, image) |
| `item_category` | inventory | Categoría del producto |
| `stock` | inventory | Stock por almacen |
| `warehouse` | inventory | Almacenes |
| `warehouse_area` | inventory | Áreas de almacen |
| `branches` | erp | Sucursales (origin / destination) |
| `users` | erp | Usuarios (historial) |

---

## Campos clave del cabecero

```
inventory_transfer
  id, folio, note, total_products, total_units, total_cost
  received_by_name      (texto libre de quien recibe)
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

Los estados AUTHORIZED e IN_TRANSIT existen en la BD pero no tienen accion en la UI de este modulo (reservados para flujos futuros). Si un traspaso llegara en estado IN_TRANSIT (flujo legado donde el origen ya se desconto al enviar), `confirmTraspaso` lo detecta y solo suma el destino, sin volver a descontar el origen.

---

## Movimiento de stock al confirmar

Dentro de una unica transaccion (`$this->transaction(function(){...})`):

1. Por cada renglon del traspaso:
   - Descontar `quantity` del stock de `origin_warehouse_id`.
   - Sumar `quantity` al stock de `destination_warehouse_id` (crea fila si no existe).
   - Guardar los snapshots `origin_stock_prev/post` y `destination_stock_prev/post` recalculados al confirmar.
2. Cambiar estado del cabecero a RECEIVED.
3. Insertar entrada en `inventory_transfer_history`.

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

---

## Endpoints del controlador

| Metodo ctrl | Descripcion |
|---|---|
| `init` | KPIs iniciales + catálogos de sesion |
| `getCatalogosTraspaso` | Items (item+item_attribute), almacenes, sucursales |
| `lsTraspasos` | Lista paginada (scope = origen o destino de la sucursal activa) |
| `showTraspasos` | KPIs: total, pendientes, recibidos, rechazados |
| `getTraspaso` | Detalle completo: cabecero + renglones + historial |
| `saveTraspaso` | Crear traspaso con detalle e historial en transaccion |
| `confirmTraspaso` | Confirmar recepcion con movimiento de stock en transaccion |
| `rejectTraspaso` | Rechazar traspaso en transaccion |

---

## Patrones de codigo

- Toda operacion multi-escritura usa `$this->transaction(function(){...})` con `catch (Throwable $e)` que retorna `['status'=>500]`.
- No se usa `??` ni `isset()` con `$_POST`; asignacion directa: `$x = $_POST['x']`.
- No se prefijan metodos propios con `_` (excepcion: metodos heredados del framework `_Read`, `_CUD`, etc.).
- Imagenes de producto se sirven con prefijo `https://huubie.com.mx/` en el componente JS.
- El scope de listado incluye traspasos donde la sucursal activa es origen O destino.

---

## Componente JS — TraspasoForm

Clase standalone adjuntada como `Templates.prototype.traspasoForm`.

**Opciones principales:**

```js
this.traspasoForm({
    parent: 'body',
    id:     'traspasoFormModal',
    json:   [ /* items del catálogo */ ],
    data: {
        sucursales:      [],   // [{ id, valor }]
        almacenes:       [],   // [{ id, valor, branch_id }]
        categorias:      [],
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

En `Traspasos.nuevoTraspaso()` el frontend convierte `productId` → `item_id` antes de enviarlo al backend.
