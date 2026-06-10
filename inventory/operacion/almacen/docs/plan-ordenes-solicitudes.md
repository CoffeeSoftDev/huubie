# Plan y documentacion — Modulo Ordenes / Solicitudes de Compra

> Base de datos: `fayxzvov_inventory` (MySQL 5.7, WAMP local)
> Ubicacion: `inventory/operacion/almacen/`
> Ultima actualizacion: 2026-06-10

---

## 1. Objetivo

Permitir que cualquier sucursal levante una **solicitud de materiales** (requisicion
interna, con proveedor opcional), que un gestor la **apruebe o rechace**, y que las
**recepciones** (totales o parciales) generen automaticamente **entradas de
inventario** (`inventory_inflow`) que actualizan el stock del almacen destino.

El modulo tiene dos caras:

| Vista | Archivo | Rol | Para quien |
|---|---|---|---|
| Gestion | `ordenes.php` + `js/ordenes.js` | Aprobar, rechazar, recibir, cancelar, imprimir | Encargado de compras / almacen |
| Solicitante | `solicitudes.php` + `js/solicitudes.js` | Crear solicitudes y dar seguimiento (responsive movil) | Personal de sucursal |

Ambas vistas comparten el mismo backend: `ctrl/ctrl-ordenes.php` + `mdl/mdl-ordenes.php`.

---

## 2. Base de datos (Fase 1)

Script: `sql/2026-06-09_purchase_order.sql`

### 2.1 `purchase_order` (cabecera)

| Columna | Notas |
|---|---|
| `folio` | Generado con `nextFolio('OC-')`, unico por empresa |
| `supplier_id` | **Opcional** en cualquier etapa (requisicion interna) |
| `branch_id` | Sucursal solicitante |
| `warehouse_id` | Destino *sugerido*; se confirma/fija al recibir |
| `date_order` / `expected_date` | Fecha de solicitud y fecha esperada |
| `total_products`, `total_units`, `total_cost`, `total_price_without_tax` | Totales denormalizados |
| `status` | `Borrador`, `Solicitada`, `Aprobada`, `Parcial`, `Recibida`, `Rechazada`, `Cancelada` |
| `user_id` / `approved_user_id`, `approved_at`, `reject_reason` | Trazabilidad de quien solicita y quien aprueba/rechaza |
| `companies_id`, `active` | Multiempresa + borrado logico |

### 2.2 `detail_purchase_order` (renglones)

`purchase_order_id`, `item_id`, `unit_id`, `quantity_ordered`,
`quantity_received` (acumulado de recepciones), `price_without_tax`, `tax`,
`cost`, `subtotal`, `active`.

### 2.3 Vinculo con entradas

`inventory_inflow.purchase_order_id` (nueva columna): cada entrada generada por
una recepcion apunta a la OC que la origino (`NULL` = entrada directa).

---

## 3. Flujo de estados

```
Borrador ──submit──> Solicitada ──approve──> Aprobada ──receive──> Parcial ──receive──> Recibida
                          │                                          (mientras quede pendiente)
                          └──reject──> Rechazada

Cancelada: desde cualquier estado no terminal (cancelOrden)
```

- **Recepcion parcial**: cada `receiveOrden` clampea las cantidades al pendiente
  real (`quantity_ordered - quantity_received`) por renglon. Si tras recibir
  queda pendiente, el estado pasa a `Parcial`; si todo quedo completo, a `Recibida`.
- **Cada recepcion genera una entrada** (`inventory_inflow` con folio `ENT-`,
  origen `COMPRA`, estado `Aplicada`) con sus renglones (`detail_inventory_inflow`,
  stock previo/posterior) y actualiza `inventory_stock` del almacen destino.
- Si la OC no tenia `warehouse_id`, el almacen elegido al recibir se fija en la
  cabecera para trazabilidad.

---

## 4. Backend — `ctrl/ctrl-ordenes.php`

Patron CoffeeSoft: `ctrl extends mdl`, despachado por `$_POST['opc']`.
Sesion: `company_id`, `branch_id`, `user_id` (con fallback a POST).

| opc | Descripcion |
|---|---|
| `init` | Catalogos: sucursales, almacenes, proveedores, productos (con `price_without_tax` + `tax`), estados |
| `lsOrdenes` | Listado con filtros (`status`, `q` folio, `branch_id`, `mine`); regresa filas con badge de estado y acciones |
| `showOrdenes` | KPIs del listado |
| `getOrden` | Cabecera + detalle de una orden |
| `createSupplier` | Alta rapida de proveedor desde el formulario |
| `saveOrden` | Crea la orden (payload JSON); `submit: true` la deja en `Solicitada`, si no en `Borrador`. Acepta `date_order`, `expected_date`, `note`, `branch_id`, `supplier_id`, `warehouse_id`, `productos[]` |
| `editOrden` | Edita cabecera/renglones (solo estados editables) |
| `submitOrden` | `Borrador -> Solicitada` |
| `approveOrden` | `Solicitada -> Aprobada` (registra `approved_user_id`, `approved_at`) |
| `rejectOrden` | `Solicitada -> Rechazada` (con `reject_reason`) |
| `receiveOrden` | Valida pendientes, genera entrada `ENT-` + detalle + stock, actualiza `quantity_received` y estado (`Parcial`/`Recibida`) |
| `cancelOrden` | Cancela orden no terminal |
| `printOrden` | Datos para la hoja imprimible (la vista de impresion se arma en `ordenes.js`) |

---

## 5. Frontend

### 5.1 Vista de gestion — `ordenes.php` / `js/ordenes.js`

- Tabla de ordenes con filtros (estado, busqueda por folio, sucursal) y KPIs.
- Modal de orden con tabla editable (cantidad, costo, base sin impuesto, tax)
  usando inputs `no-spin`.
- Modal de recepcion: captura "recibir ahora" por renglon, clampeado al pendiente.
- Hoja de impresion (ventana nueva con CSS propio, boton Imprimir/Cerrar).

### 5.2 Vista solicitante — `solicitudes.php` / `js/solicitudes.js`

Responsive: escritorio (tabla + aside de seguimiento) y movil (cards + FAB +
bottom nav + overlay de detalle full-screen).

Clases (todas extienden `Templates`):

- **`App`** — `init` (catalogos + datos de sesion), layout de paneles, chips de
  estado, filtros, seleccion de fila.
- **`Solicitudes`** — datos: `lsSolicitudes` (con `mine: 1`), tabla escritorio,
  cards movil, KPIs, `getOrden` + `mapOrdenDetail`.
- **`SolicitudesView`** — detalle (stepper horizontal escritorio / vertical
  movil), overlay movil, **formulario de nueva solicitud** (`openSolicitudForm`)
  y envio (`_sendSolicitud` -> `saveOrden` con `submit: true`).

El detalle muestra seguimiento por stepper (Borrador -> Solicitada -> Aprobada ->
En recepcion -> Recibida), motivo de rechazo si aplica, datos de cabecera,
materiales con "Recibido X de Y" y boton **Duplicar** (precarga el formulario).

---

## 6. Formulario "Nueva solicitud" — diseño alineado a EntradaForm

El modal de nueva solicitud replica el sistema visual del componente
`inventory/src/js/components/entrada-form.js` (referencia de diseño del modulo
de entradas): mismo header (icono cuadrado azul + titulo + subtitulo), franja de
configuracion `bg-gray-50/60`, buscador en franja blanca, tabla con thead
sticky, resumen y footer gris.

### Cambios implementados (2026-06-10)

1. **Select de sucursal en lugar de badge fijo.**
   El cajon terracota con candado ("Sucursal solicitante" bloqueada) se
   reemplazo por un `<select>` real dentro de un grid `grid-cols-4 gap-3
   items-end`, identico a `renderConfigRow()` de EntradaForm: label
   `text-[10px] uppercase`, select con clases `cls.select` y chevron Lucide
   superpuesto. Se llena con `app.dataInit.sucursales` y preselecciona el
   `branch_id` de sesion. El valor elegido viaja en el payload (`branch_id`).

2. **Selector de fecha.**
   Segunda celda del grid: input `type="date"` con clases `cls.input`,
   default = hoy (calculado en zona local con `toLocaleDateString('en-CA')`).
   Viaja como `date_order` en el payload; el backend ya lo aceptaba (con
   fallback a `date('Y-m-d')`).

3. **Cantidad como input + flujo de foco tipo entradas.**
   - El stepper +/- se reemplazo por un `<input type="number" min="1">` con las
     clases `cls.qtyInp` de EntradaForm (`no-spin`, centrado, negrita) y la
     columna se angosto a `w-24`.
   - Al seleccionar un material del buscador, `focusCantidad(idx)` enfoca y
     preselecciona el input de cantidad de la fila (con `scrollIntoView`), para
     teclear el valor directo.
   - **Enter** en cantidad regresa el foco al buscador para encadenar la
     siguiente alta (mismo patron que `onQtyKeydown` de EntradaForm).
   - Editar la cantidad recalcula los totales (materiales / unidades) en vivo.
   - El CSS de `no-spin` se inyecta una sola vez al abrir el modal (guard
     `#solicitudFormStyles`), porque `solicitudes.php` no carga
     `entrada-form.js`.

4. **Buscador en franja propia.**
   El buscador de materiales se movio a su propia franja `px-5 py-3 bg-white`
   bajo la fila de configuracion, igual que `renderSearchBar()` de EntradaForm.

### Payload de envio (`_sendSolicitud`)

```js
{
  branch_id:  <select sucursal | branch_id de sesion>,
  date_order: <input fecha>,
  note:       <textarea nota>,
  submit:     true,                      // nace como "Solicitada"
  productos: [{ product_id, quantity, cost: null,
                price_without_tax: null, tax: 0, unit_id: null }]
}
```

Los costos van en `null` a proposito: el solicitante pide materiales, no
negocia precios; el gestor los captura/ajusta en `ordenes.php` antes de aprobar.

---

## 7. Templates de referencia (UI-first)

Los wireframes HTML estaticos que guiaron la implementacion viven en
`templates/ordenes-compra/`:

- `ordenes-compra.html` — vista de gestion.
- `modals/modal-nueva-orden.html`, `modals/modal-recepcion.html`.
- `solicitante/mis-solicitudes.html`, `solicitante/nueva-solicitud.html`,
  `solicitante/detalle-solicitud.html`.
- `mobile/` — versiones moviles de las tres pantallas del solicitante.

---

## 8. Estado del proyecto

| Fase | Alcance | Estado |
|---|---|---|
| 1 | SQL: `purchase_order`, `detail_purchase_order`, vinculo en `inventory_inflow` | ✔ Aplicada en MySQL local |
| 2 | Backend `ctrl-ordenes.php` / `mdl-ordenes.php` (CRUD + flujo + recepciones) | ✔ Completa |
| 3 | Frontend gestion (`ordenes.php`) + solicitante responsive (`solicitudes.php`) | ✔ Completa |
| 3.1 | Refinado del form de solicitud (select sucursal, fecha, cantidad con foco) | ✔ Completa (2026-06-10) |

### Pendientes

- [ ] Enlazar `ordenes.php` y `solicitudes.php` en el menu/sidebar del ERP.
- [ ] Prueba end-to-end en navegador con sesion real (crear -> aprobar ->
      recibir parcial -> verificar entrada `ENT-` y stock).
- [ ] (Opcional) Enter en el buscador del solicitante para agregar la primera
      coincidencia / SKU exacto, como el modo escaner de EntradaForm.
