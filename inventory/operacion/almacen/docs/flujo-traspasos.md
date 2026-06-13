# Flujo completo de un Traspaso de almacen entre sucursales

> Modulo: `inventory/operacion/almacen/` (ERP standalone Huubie)
> Esquemas: `fayxzvov_inventory` (operacion) · `fayxzvov_erp` (maestros corporativos)
> MySQL 5.7 sobre WAMP. Sesion por `companies_id` (tenant), `branch_id` (sucursal activa) y `user_id`.
> Documento verificado contra el esquema vivo (MCP MySQL) y contra el codigo real del modulo.

Este documento explica, de punta a punta, que pasa cuando se crea un traspaso de inventario de una sucursal a otra y como el destino confirma la recepcion. Usa como hilo conductor un ejemplo concreto y real:

> **Ejemplo: traspaso de Kafeto -> Matriz**
> En la BD viva las sucursales existentes son `Kafeto` (`branches.id = 2`) y `Matriz` (`branches.id = 1`). De hecho ya existe el traspaso `TRA-0001` con `origin_branch_id = 2` (Kafeto) y `destination_branch_id = 1` (Matriz) en estado `RECEIVED`. Todo el documento se narra sobre ese caso.

---

## 0. Mapa rapido del modulo

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Page / entry | `inventory/operacion/almacen/traspasos.php` | Pagina contenedora, valida acceso por sesion |
| Frontend (controlador de pantalla) | `inventory/operacion/almacen/js/traspasos.js` | Clases `App`, `Traspasos`, `TraspasosView` |
| Frontend (modal de alta) | `inventory/src/js/components/traspaso-form.js` | Clase `TraspasoForm` (modal "Nuevo Traspaso") |
| Backend (controlador) | `inventory/operacion/almacen/ctrl/ctrl-traspasos.php` | Clase `ctrl extends mdl`, ruteo por `opc` |
| Backend (modelo) | `inventory/operacion/almacen/mdl/mdl-traspasos.php` | Clase `mdl extends CRUD`, todo el SQL |

**Tablas que toca el flujo** (todas en `fayxzvov_inventory` salvo donde se indique):

| Tabla | Rol |
|---|---|
| `inventory_transfer` | Cabecera del traspaso (transaccion raiz) |
| `detail_inventory_transfer` | Renglones / items del traspaso (detalle) |
| `transfer_status` | Catalogo de estados del flujo |
| `inventory_transfer_history` | Bitacora: una fila por cada cambio de estado |
| `stock` | Existencias por almacen (`uk_stock` unique en `item_id + warehouse_id`) — **saldo actual** |
| `inventory_movement` | Kardex / libro de movimientos (bitacora de cada entrada y salida). El flujo de traspasos **ya la escribe al confirmar** (1 SALIDA en origen + 1 ENTRADA en destino, ver 3.1) |
| `warehouse` | Almacenes (cada uno pertenece a una `branch_id`) |
| `item` / `item_attribute` / `item_category` | Catalogo de productos, SKU/costo, categoria |
| `fayxzvov_erp.branches` | Sucursales (Kafeto, Matriz) — maestro corporativo |
| `fayxzvov_erp.users` | Usuarios (solicito / recibio) — maestro corporativo |

---

## 1. Flujo paso a paso (frontend -> backend -> BD)

El flujo tiene dos grandes momentos: **(A) Kafeto solicita el traspaso** y **(B) Matriz confirma la recepcion**. El stock fisico SOLO se mueve en el momento B.

```
  KAFETO (origen)                          MATRIZ (destino)
  ───────────────                          ────────────────
  1. Abre "Nuevo Traspaso"
  2. Elige destino = Matriz
  3. Agrega productos
  4. Guarda  ──► estado REQUESTED ──►      5. Ve el traspaso en su visor
     (stock NO se mueve todavia)           6. "Aceptar Envio" (captura quien recibe)
                                           7. Confirma ──► estado RECEIVED
                                              (stock: Kafeto baja, Matriz sube)
```

### 1.0 Carga inicial del visor (`init`)

Cuando se abre `traspasos.php`, el frontend arranca en `traspasos.js`:

1. `App.init()` llama `fn_ajax({ opc: 'init' }, api)`.
2. En el backend, `ctrl::init()` regresa:
   - `sucursales` -> `mdl::lsSucursales([companiesId])` -> lee `fayxzvov_erp.branches WHERE company_id = ? AND is_active = 1` (aqui salen Kafeto y Matriz).
   - `almacenes` -> `mdl::lsWarehouses(...)` -> lee `warehouse` (JOIN `warehouse_area` y `branches`).
   - `estados_traspaso` -> `mdl::lsTransferStatuses()` -> lee `transfer_status WHERE active = 1 ORDER BY order_index`.
   - Tambien expone `companies_id`, `branch_id`, `user_id` de sesion.
3. `App.render()` arma el layout (panel principal + panel de detalle), dibuja filtros, KPIs y la tabla.
4. La tabla se llena con `Traspasos.lsTraspasos()` -> `opc: 'lsTraspasos'` (DataTable server-driven).
5. Los KPIs con `Traspasos.lsKpis()` -> `opc: 'showTraspasos'`.

> **Sucursal activa (`app.branchId`)**: viene de `$_SESSION['branch_id']`. Es la pieza clave que decide, en el panel de detalle, si el usuario actuante es **origen** o **destino** y por lo tanto que botones de accion ve.

---

### 1.A — Kafeto crea el traspaso

#### Paso 1-3: abrir el modal y armar el lote (frontend puro)

- El boton **"Nuevo Traspaso"** (`filterBar` en `App.filterBar()`) dispara `traspasosView.openTraspasoForm()`.
- `TraspasosView.ensureTraspasoForm()` pide los catalogos una sola vez: `fn_ajax({ opc: 'getCatalogosTraspaso' })`.
  - `ctrl::getCatalogosTraspaso()` regresa:
    - `productos` -> `mdl::listItemsForTransfer()` (item + item_attribute para sku/costo + categoria).
    - `stockPorSuc` por item -> `mdl::listStockByBranch()` agrega `SUM(stock.quantity)` por `item_id` y `branch_id` (es decir, stock por sucursal, sumando sus almacenes).
    - `sucursales`, `almacenes`, `categorias`.
- Se instancia `TraspasoForm` (en `traspaso-form.js`). El modal:
  - Pre-selecciona como **origen** la sucursal activa (`origenIdInicial = app.branchId`, p.ej. Kafeto).
  - **Destino** arranca vacio (placeholder "Selecciona sucursal...").
  - Filtra los almacenes del select segun la sucursal elegida (`warehousesFor(branchId)` usa `almacen.branch_id`).
  - El buscador de productos muestra el **stock de origen** de cada item (`stockOrigen(prod, origenId)` lee `prod.stockPorSuc[origenId]`).
  - Cantidad maxima por renglon = stock disponible en el origen (`max` en el input y en `addOrIncrement`). El costo es de solo lectura (viene del catalogo, `cost_unit`).

> **Importante**: en esta fase no hay backend. Todo el armado del lote, el control de stock-maximo y los totales viven en memoria del navegador.

#### Paso 4: guardar -> `saveTraspaso`

1. `TraspasoForm.doRegistrar()` valida en cliente:
   - hay destino,
   - origen != destino,
   - hay almacen destino,
   - hay al menos un producto.
   Luego muestra un confirm ("Crear y enviar traspaso?") y al aceptar llama `onSave(payload)`.
2. `Traspasos.nuevoTraspaso(payload)` traduce el payload de UI al de backend:
   - `productId -> item_id`, `cant -> quantity`, `costo -> cost`, `nota -> note`.
   - aplana origen/destino a `origin_branch_id`, `destination_branch_id`, `origin_warehouse_id`, `destination_warehouse_id`.
   - envia `fn_ajax({ opc: 'saveTraspaso', payload: JSON.stringify(...) })`.
3. `ctrl::saveTraspaso()`:
   - decodifica el payload, valida que haya renglones.
   - resuelve el estado inicial: `mdl::getTransferStatusByCode(['REQUESTED'])` -> `status_id = 1`.
   - calcula `total_products`, `total_units`, `total_cost` (sumatorias en PHP).
   - abre **una transaccion** (`$this->transaction(function(){ ... })`):
     1. `getNextFolio('TRA-', companiesId)` -> lee el ultimo folio del tenant y arma el siguiente (`TRA-0001`, `TRA-0002`, ...).
     2. `mdl::createTraspaso([...])` -> `INSERT INTO inventory_transfer` con `date_request = NOW()`, `status_id = 1 (REQUESTED)`, branches/warehouses, `requested_user_id`, `companies_id`.
     3. `getTraspasoIdByFolio(...)` recupera el id recien creado.
     4. Por cada producto, `mdl::createTraspasoDetail([...])` -> `INSERT INTO detail_inventory_transfer`. **Aqui se calculan y guardan los snapshots de origen**:
        - `origin_stock_prev` = stock actual del item en el almacen origen (`getStockRow`).
        - `origin_stock_post` = `max(0, prev - quantity)`.
        - `destination_stock_prev/post` quedan en `NULL`.
     5. `mdl::createTraspasoHistory(['Traspaso solicitado', status REQUESTED, userId, traspasoId])` -> primera fila de la bitacora.
   - regresa `{ status: 200, folio, id }`.

> **Clave de negocio**: al crear, la tabla `stock` NO se toca. Solo se "fotografia" cual seria el efecto sobre el origen (`origin_stock_post`), pero el descuento real ocurre hasta la confirmacion. Esto deja el inventario intacto mientras Matriz no acepte.

**Tablas afectadas en el Paso 4:**

| Tabla | Operacion |
|---|---|
| `inventory_transfer` | 1 INSERT (estado REQUESTED) |
| `detail_inventory_transfer` | N INSERT (uno por producto, con snapshots de origen) |
| `inventory_transfer_history` | 1 INSERT ("Traspaso solicitado") |
| `stock` | sin cambios |

---

### 1.B — Matriz confirma la recepcion

#### Paso 5-6: ver el detalle y decidir botones

- Matriz (con su sesion, `app.branchId = 1`) abre el visor y hace click en la fila del traspaso.
- `App.selectTraspaso(folio, id)` -> `Traspasos.getTraspaso(id)` -> `ctrl::getTraspaso()`:
  - `getTraspasoById` (cabecera + nombres de sucursal/almacen/usuarios + `status_code`),
  - `listTraspasoDetail` (renglones),
  - `listTraspasoHistory` (timeline).
- `TraspasosView.traspasoDetailPanel()` decide los botones cruzando **estado** x **rol de la sucursal activa**:

| Condicion | Botones |
|---|---|
| `REQUESTED` y sucursal activa = ORIGEN (Kafeto) | `Cancelar Solicitud` |
| sucursal activa = DESTINO (Matriz) y estado `REQUESTED` / `AUTHORIZED` / `IN_TRANSIT` | `Rechazar` + `Aceptar Envio` |
| cualquier otro caso | solo lectura |

Como Matriz es el destino y el traspaso esta REQUESTED, ve **Rechazar** y **Aceptar Envio**.

#### Paso 7: "Aceptar Envio" -> `confirmTraspaso`

1. `Traspasos.confirmTraspaso(id)` abre un SweetAlert que **exige** capturar "Quien recibe el traspaso?" (`received_by`, validacion obligatoria).
2. Envia `fn_ajax({ opc: 'confirmTraspaso', id, received_by })`.
3. `ctrl::confirmTraspaso()`:
   - resuelve el estado destino: `getTransferStatusByCode(['RECEIVED'])` -> `status_id = 4`.
   - lee cabecera (`getTraspasoById`) y renglones (`listTraspasoDetail`).
   - detecta `alreadySent = (status_code === 'IN_TRANSIT')` (caso legado, ver seccion 2).
   - abre **una transaccion**:
     - Por cada renglon:
       - lee stock origen (`getStockRow(item_id, origin_warehouse_id)`):
         - `origin_prev` = cantidad actual,
         - `origin_post` = `max(0, prev - quantity)` (salvo IN_TRANSIT, donde el origen ya se habia descontado y no se vuelve a tocar).
       - lee stock destino (`getStockRow(item_id, destination_warehouse_id)`):
         - `dest_prev` = cantidad actual (0 si no existia la fila),
         - `dest_post` = `prev + quantity`.
       - actualiza los snapshots del detalle (`updateTraspasoDetailStockSnapshots` o, en IN_TRANSIT, solo `updateTraspasoDetailDestinationStock`).
       - **mueve el stock real**:
         - origen: `updateStockQuantity(origin_post, stock.id)` (si existia la fila).
         - destino: `updateStockQuantity(dest_post, stock.id)` si existia, o `createStockRow(dest_post, dest_wh, item_id, companies_id)` si no.
       - **registra el kardex** (`createInventoryMovement`, ver 3.1): inserta 1 `SALIDA` en origen (solo si no era IN_TRANSIT) + 1 `ENTRADA` en destino, con los `stock_prev/post` ya calculados. Es solo auditoria, no re-aplica stock.
     - `updateTraspasoStatus(RECEIVED, id)` -> cabecera pasa a `status_id = 4`.
     - `updateTraspasoReceived(userId, received_by, id)` -> graba `date_received = NOW()`, `received_user_id`, `received_by_name`.
     - `createTraspasoHistory('Traspaso recibido [· Recibe: X]', RECEIVED, userId, id)`.
   - regresa `{ status: 200 }`.
4. El frontend refresca lista, KPIs y limpia el panel.

**Tablas afectadas en el Paso 7:**

| Tabla | Operacion |
|---|---|
| `stock` | UPDATE origen (resta) + UPDATE/INSERT destino (suma), por cada item |
| `detail_inventory_transfer` | UPDATE snapshots (origin + destination stock prev/post) |
| `inventory_transfer` | UPDATE estado RECEIVED + datos de recepcion |
| `inventory_transfer_history` | 1 INSERT ("Traspaso recibido") |
| `inventory_movement` | 2 INSERT por renglon: 1 `SALIDA` en origen (cantidad negativa) + 1 `ENTRADA` en destino (cantidad positiva). Solo auditoria; ver 3.1 |

#### Resultado en el ejemplo (Kafeto -> Matriz, TRA-0001)

Si Kafeto traspaso 5 uds de un item con costo 14.616 (total_cost 73.08):

- En Kafeto (almacen origen): `stock.quantity` baja 5 (a `max(0, prev-5)`).
- En Matriz (almacen destino): `stock.quantity` sube 5 (o se crea la fila con 5 si no existia).
- `inventory_transfer` queda en `RECEIVED`, con `received_by_name` = el nombre capturado.
- `inventory_transfer_history` tiene 2 filas: "Traspaso solicitado" (Kafeto) y "Traspaso recibido" (Matriz).

---

### 1.C — Acciones alternas

| Accion UI | Quien | Frontend | Endpoint | Efecto |
|---|---|---|---|---|
| **Cancelar Solicitud** | Origen (Kafeto), estado REQUESTED | `Traspasos.cancelTraspaso(id)` con nota fija | `rejectTraspaso` (REJECTED) | Estado -> REJECTED, sin tocar stock |
| **Rechazar** | Destino (Matriz) | `Traspasos.rejectTraspaso(id)` | `rejectTraspaso` (REJECTED) | Estado -> REJECTED, sin tocar stock |
| **Imprimir** | cualquiera | `Traspasos.printTraspaso(t)` | (opcional `getTraspaso` si recibe id) | Abre comprobante HTML en ventana nueva, no escribe BD |

> No existe endpoint `cancelTraspaso` en el backend: "cancelar" es `rejectTraspaso` con la nota `'Traspaso cancelado por el solicitante'`. La diferencia es solo semantica (origen vs destino) y queda registrada en el `note` de la bitacora.

---

## 2. Alcance actual del modulo

### 2.1 Catalogo de estados (verificado en `transfer_status`)

| id | code | name | order | is_terminal | color | Se genera desde la UI? |
|----|------|------|-------|-------------|-------|------------------------|
| 1 | `REQUESTED` | Solicitado | 1 | no | #F59E0B | **Si** — al crear (`saveTraspaso`) |
| 2 | `AUTHORIZED` | Autorizado | 2 | no | #3B82F6 | No — reservado |
| 3 | `IN_TRANSIT` | En Transito | 3 | no | #8B5CF6 | No — reservado |
| 4 | `RECEIVED` | Recibido | 4 | **si** | #10B981 | **Si** — al confirmar (`confirmTraspaso`) |
| 5 | `REJECTED` | Rechazado | 5 | **si** | #EF4444 | **Si** — al rechazar/cancelar (`rejectTraspaso`) |

### 2.2 Maquina de estados vigente (simplificada)

```
                 saveTraspaso
   (Kafeto crea) ───────────► REQUESTED
                                 │
            confirmTraspaso      │      rejectTraspaso
   (Matriz acepta) ◄────────────┼────────────► (Matriz rechaza
        mueve stock             │               u origen cancela)
                                ▼               ▼
                            RECEIVED         REJECTED
                           (terminal,        (terminal,
                            stock movido)     sin movimiento)
```

El stock se mueve en **un solo paso** (REQUESTED -> RECEIVED). No hay paso intermedio "En Transito" en la operacion normal: el destino "Confirma" y eso descuenta origen + suma destino atomicamente.

### 2.3 Acciones implementadas

| Accion | Estado |
|---|---|
| **Solicitar** (crear traspaso) | Implementada. `saveTraspaso`, estado REQUESTED. |
| **Confirmar / Recibir** | Implementada. `confirmTraspaso`, estado RECEIVED, mueve stock, exige "quien recibe". |
| **Rechazar** | Implementada. `rejectTraspaso`, estado REJECTED (lo hace el destino). |
| **Cancelar** | Implementada como alias de Rechazar (lo hace el origen, nota distinta). |
| **Imprimir** | Implementada. Comprobante HTML cliente (`renderTraspasoDoc`). |
| **Listar / filtrar / KPIs** | Implementadas (estado, destino, rango de fecha, busqueda). |

### 2.4 Reservado sin UI (deuda intencional)

- **AUTHORIZED**: existe en el catalogo y la cabecera tiene `date_authorized` y `authorized_user_id`, pero **no hay accion "Autorizar"** ni endpoint que la genere. Es el gancho para un futuro flujo con aprobacion previa.
- **IN_TRANSIT / "send"**: existe el estado, las columnas `date_sent` y la logica de `confirmTraspaso` ya contempla el caso (`alreadySent`), pero **no hay accion "Enviar"** que ponga un traspaso IN_TRANSIT. La rama IN_TRANSIT de `confirmTraspaso` es un camino legado defensivo: si un traspaso llegara IN_TRANSIT (origen ya descontado al enviar), al confirmar solo suma el destino. En el flujo actual nunca se entra a esa rama porque nada pone IN_TRANSIT.
- El KPI **"En Transito"** se muestra en la UI pero siempre vale 0 mientras no exista la accion de envio.

---

## 3. Oportunidades de mejora

### 3.1 Registro del traspaso en el kardex (`inventory_movement`) — IMPLEMENTADO

> **Estado:** resuelto. `confirmTraspaso` ahora escribe el kardex. Esta seccion documenta el problema original y la solucion aplicada.

Era el hallazgo mas importante del modulo, por encima de los temas de concurrencia: **al confirmar un traspaso el stock cambiaba, pero no se dejaba rastro en el libro de movimientos.**

**Que descubrimos (verificado contra la BD viva):**

- Existe una tabla `inventory_movement` que funciona como **kardex / libro mayor de inventario**: una fila por cada movimiento, con `movement_type`, `folio`, `quantity`, `stock_prev`, `stock_post`, `cost_unit/total`, `item_id`, `warehouse_id`, `branch_id`, `occurred_at`.
- Esa tabla es la **fuente de verdad de movimientos** que consumen el dashboard (`mdl-dashboard.php`) y el detalle de un producto: el historial de movimientos y la grafica entrada/salida de los ultimos 13 dias (`mdl-stock.php`).
- El modulo de **Entradas SI escribe ahi** (los asientos existentes son `movement_type = 'ENTRADA'`, folios `ENT-xxxx`).
- El modulo de **Traspasos NO escribia ahi** (antes del fix): `confirmTraspaso` solo actualizaba `stock` (el saldo) y los snapshots de `detail_inventory_transfer`, pero nunca insertaba en `inventory_movement`.

**Consecuencia (antes del fix):** el traspaso `TRA-0001` Kafeto -> Matriz movio el saldo correctamente, pero era **invisible** en el dashboard, en el historial de movimientos del producto y en la grafica entrada/salida. Para esos reportes, esas unidades "aparecieron" en Matriz sin explicacion.

> **Nota sobre el historico:** `TRA-0001` ya quedo en estado `RECEIVED` antes de aplicar el fix y no se reprocesa, asi que ese traspaso viejo seguira sin asiento en el kardex salvo que se haga un backfill manual. Los traspasos confirmados de aqui en adelante si generan asientos.

**Distincion conceptual clave (`stock` vs `inventory_movement`):**

| | `stock` | `inventory_movement` |
|---|---|---|
| Que es | Saldo actual (como el saldo de una cuenta) | Bitacora de cada movimiento (como el estado de cuenta) |
| Filas por item+almacen | Una (se sobrescribe) | Muchas (solo se agregan) |
| Responde | Cuanto tengo HOY | Que paso, cuando y por que |
| Invariante | `stock.quantity` debe igualar el `stock_post` del ultimo asiento del kardex |

**Solucion implementada (sin duplicar stock):** `confirmTraspaso`, dentro de su transaccion ya existente, inserta **dos asientos** en `inventory_movement` por cada renglon, via el nuevo metodo `mdl::createInventoryMovement`:

1. Una **SALIDA** en el almacen origen (Kafeto): `quantity` negativa, con `stock_prev`/`stock_post` del origen. `movement_uid = 'TRO-{detailId}'`. Solo se genera cuando el origen se descuenta en la confirmacion (es decir, `!alreadySent`).
2. Una **ENTRADA** en el almacen destino (Matriz): `quantity` positiva, con `stock_prev`/`stock_post` del destino. `movement_uid = 'TRD-{detailId}'`. Siempre se genera.

> **Detalle de esquema:** `inventory_movement.movement_type` es `varchar(7)`, por lo que `'TRASPASO'` (8 chars) **no cabe**. Se usa `'SALIDA'` y `'ENTRADA'` por almacen — que ademas es semanticamente mas correcto: desde la perspectiva de cada almacen el traspaso es literalmente una salida o una entrada. La pertenencia al traspaso se identifica por el `folio` (`TRA-0001`) y por la `note` ("Traspaso TRA-0001 · salida hacia Matriz" / "· entrada desde Kafeto"). El `status` se graba como `'Aplicada'` (consistente con los asientos existentes). La direccion entrada/salida la determina el **signo de `quantity`**, que es justo lo que lee la grafica de `mdl-stock.php`.

Ambos asientos son **solo auditoria**: NO vuelven a aplicar el stock (de eso sigue encargandose el UPDATE/INSERT de `stock`), por lo que no hay riesgo de doble conteo. `rejectTraspaso` no genera asientos porque no toca stock, lo cual es correcto.

> **Que NO conviene:** insertar el traspaso en `inventory_inflow` (la tabla de *documentos de entrada*) para que salga en el visor de "Entradas". Eso mezcla dos conceptos distintos —un traspaso no es una compra a proveedor— y arriesga doble conteo de stock. El traspaso debe verse en el **kardex** (movimientos), no en el listado de documentos de entrada. El catalogo `inflow_origin` ni siquiera contempla un origen "Traspaso" (sus 5 origenes son Compra, Produccion, Proveedor, Devolucion, Ajuste).

### 3.2 Concurrencia y consistencia de stock (riesgo alto)

- **Race condition entre solicitud y confirmacion.** Entre que Kafeto solicita (snapshot `origin_stock_prev`) y Matriz confirma puede pasar tiempo. En la confirmacion se relee el stock con `getStockRow` y se aplica `max(0, prev - qty)`, asi que el descuento no se vuelve negativo, pero **no hay reserva**: si dos traspasos solicitan las mismas 5 uds, ambos pueden confirmarse y el segundo descuenta sobre un stock ya mermado (queda en 0 con `max`, perdiendo trazabilidad de la unidad faltante). No hay validacion de "stock suficiente al confirmar".
- **Sin bloqueo de fila.** Las lecturas de `stock` dentro de la transaccion no usan `SELECT ... FOR UPDATE`. Dos confirmaciones simultaneas sobre el mismo `item_id+warehouse_id` pueden leer el mismo `prev` y pisarse (lost update). Con `uk_stock(item_id, warehouse_id)` el INSERT de destino esta protegido contra duplicados, pero el UPDATE de cantidad no contra carreras.
  - **Mejora**: leer el stock con `FOR UPDATE` dentro de la transaccion, o convertir el movimiento a `UPDATE stock SET quantity = quantity - ? WHERE id = ?` (delta atomico) en lugar de leer-calcular-escribir.
- **No se valida stock al confirmar.** Si el origen ya no tiene las unidades, el traspaso igual se confirma y el origen queda en 0. Convendria, al menos, advertir o bloquear si `origin_prev < quantity`.

### 3.3 Validaciones faltantes (backend)

- `saveTraspaso` **confia en el cliente**: no revalida que `origin_branch_id != destination_branch_id`, que los almacenes pertenezcan a esas sucursales, ni que `quantity > 0`. La validacion vive solo en `TraspasoForm.doRegistrar()` (cliente, evitable).
- No se valida que `origin_warehouse_id` / `destination_warehouse_id` existan y pertenezcan al `companies_id` de sesion (riesgo de cross-tenant si el payload se manipula).
- `confirmTraspaso` y `rejectTraspaso` **no validan el estado actual** antes de transicionar: se puede confirmar un traspaso ya RECEIVED o rechazar uno ya terminal (doble submit). Esto puede **duplicar el movimiento de stock** si se confirma dos veces (no hay guard `WHERE status_id = REQUESTED`).
  - **Mejora critica**: condicionar la transicion al estado origen (`UPDATE ... WHERE id = ? AND status_id = ?`) y abortar si afecto 0 filas.
- `confirmTraspaso`/`rejectTraspaso` no verifican que quien actua sea realmente el destino/origen correspondiente (la regla vive solo en la UI del panel).

### 3.4 Integridad del folio

- `getNextFolio` hace `SELECT ... ORDER BY id DESC LIMIT 1` + `+1` **fuera de cualquier lock**. Dos altas concurrentes del mismo tenant pueden generar el **mismo folio** (`TRA-0002` duplicado). No hay unique constraint visible sobre `(companies_id, folio)` que lo impida (folio tiene KEY `MUL`, no unique compuesto).
  - **Mejora**: unique `(companies_id, folio)` + reintento, o secuencia/tabla de contadores con lock, o derivar el folio del `id` autoincremental tras el INSERT.

### 3.5 Manejo de errores poco informativo

- Los `catch (\Throwable $e)` devuelven `['status' => 500, 'message' => 'No se pudo ...']` **sin loggear** `$e`. Cuando algo falla en produccion no queda rastro de la causa.
  - **Mejora**: loggear `$e->getMessage()` (y stack) a `error.log` del modulo antes de responder.

### 3.6 Datos / modelo

- **Totales desnormalizados sin recalculo.** `total_products/units/cost` se calculan al crear y nunca se reconcilian. Si un detalle se editara (hoy no hay edicion), quedarian inconsistentes. Aceptable mientras el traspaso sea inmutable tras crearse, pero conviene documentarlo como invariante.
- **`received_by_name` como texto libre.** Quien recibe se captura como string. Para reportes formales convendria opcionalmente ligarlo a un empleado/usuario, manteniendo el texto libre como fallback.
- **Sin soft-delete de uso real.** `active` existe en cabecera y detalle pero no hay accion de "eliminar traspaso"; el ciclo termina en RECEIVED/REJECTED. Coherente con la convencion (no DELETE fisico), solo conviene dejar claro que no se borra.

### 3.7 UX / producto

- **Flujo de un paso vs. trazabilidad.** Al no existir "Enviar", no se distingue "mercancia en camino" de "mercancia recibida". Para sucursales distantes, activar AUTHORIZED/IN_TRANSIT (ya cableados a medias) daria visibilidad de mercancia en transito y separaria la responsabilidad (origen envia / destino recibe).
- **KPI "En Transito" siempre en 0** confunde al usuario. Mientras no exista la accion de envio, podria ocultarse.
- **Cancelar = Rechazar** comparten estado REJECTED; en reportes no se distingue una cancelacion del solicitante de un rechazo del destino salvo por el texto de la nota. Un estado `CANCELLED` propio (o un flag) daria metricas limpias.
- **Confirmacion sin "diff" de stock.** El SweetAlert de aceptar no muestra el impacto en inventario (de cuanto a cuanto queda cada item). Mostrarlo reduce errores.
- **Edicion / reapertura.** No se puede corregir un traspaso enviado por error; solo rechazarlo y rehacerlo. Una accion de "duplicar" agilizaria rehacer.

### 3.8 Resumen priorizado

| Prioridad | Tema | Accion sugerida |
|---|---|---|
| ~~Alta~~ **HECHO** | ~~Traspaso no registra en el kardex (`inventory_movement`)~~ | Implementado: 2 asientos (SALIDA origen + ENTRADA destino) en `confirmTraspaso` via `createInventoryMovement`. Solo auditoria, no re-aplica stock |
| Alta | Doble confirmacion duplica stock **(y ahora tambien duplicaria asientos del kardex)** | Guard `WHERE status_id = REQUESTED` y abortar si 0 filas afectadas |
| Alta | Movimiento de stock sin lock | `FOR UPDATE` o `UPDATE ... quantity = quantity ± ?` (delta atomico) |
| Alta | Folio duplicable en concurrencia | Unique `(companies_id, folio)` + reintento |
| Media | Validaciones de negocio en backend | Revalidar origen!=destino, pertenencia de almacen, tenant, qty>0 |
| Media | Errores sin log | Loggear `$e` antes de responder 500 |
| Baja | Cancelado == Rechazado | Estado/flag dedicado para distinguir en reportes |
| Baja | KPI "En Transito" en 0 | Ocultar hasta activar el flujo de envio |

---

## 4. Referencias rapidas

**Endpoints (`opc`) del controlador:**

`init` · `getCatalogosTraspaso` · `lsTraspasos` · `showTraspasos` · `getTraspaso` · `saveTraspaso` · `confirmTraspaso` · `rejectTraspaso`

**Estructura real verificada (MCP MySQL):**

```
inventory_transfer  (raiz)
  id, folio(varchar20), note(varchar255),
  total_products(int), received_by_name(varchar120),
  total_units(double), total_cost(double),
  date_request, date_authorized, date_sent, date_received (datetime),
  created_at, updated_at, active(tinyint),
  status_id -> transfer_status,
  origin_warehouse_id, destination_warehouse_id -> warehouse,
  origin_branch_id, destination_branch_id -> erp.branches,
  requested_user_id, authorized_user_id, received_user_id -> erp.users,
  companies_id

detail_inventory_transfer  (detalle)
  id, quantity(double), cost(double), subtotal(double),
  origin_stock_prev/post, destination_stock_prev/post (double, NULL al crear el destino),
  created_at, active(tinyint),
  item_id -> item,
  inventory_transfer_id -> inventory_transfer

inventory_transfer_history  (bitacora)
  id, note(varchar255), transitioned_at(datetime), active(tinyint),
  status_id -> transfer_status, user_id -> erp.users,
  inventory_transfer_id -> inventory_transfer

stock   (saldo actual)
  id, quantity(double), last_movement_at, last_inventory_at,
  created_at, updated_at, active(tinyint),
  warehouse_id, item_id, companies_id
  UNIQUE uk_stock(item_id, warehouse_id)

inventory_movement   (kardex / bitacora — el traspaso escribe aqui al confirmar: SALIDA origen + ENTRADA destino, ver 3.1)
  movement_uid(varchar14), movement_type(varchar7), folio(varchar20),
  note(varchar255), quantity(double),
  stock_prev(double, NOT NULL), stock_post(double, NOT NULL),
  cost_unit(double, NOT NULL), cost_total(double, NOT NULL),
  occurred_at(date), created_at(datetime), status(varchar20),
  item_id, warehouse_id, branch_id, user_id, companies_id
```

> Nota de convencion: `detail_inventory_transfer` usa `item_id` (no `product_id`), consistente con el esquema `item` del ERP standalone. Montos en `DOUBLE` (convencion de la casa). El catalogo de estados respeta el patron catalogo + FK (no ENUM).
