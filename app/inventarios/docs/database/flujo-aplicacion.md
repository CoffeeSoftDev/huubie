# Flujo de la aplicacion — modulo Inventarios

> **Producto:** Huubie / app/inventarios
> **Documentos gemelos:** [propuesta-db.md](propuesta-db.md), [db-implementacion.md](db-implementacion.md)
> **Ambito:** manual de entendimiento del dominio. Explica que hace la aplicacion, como se navega, que eventos detona el usuario, que cambia con cada accion y que validaciones aplica el negocio.
> **Audiencia:** product owner, QA, devs nuevos, integradores.

---

## 1. Sintesis del producto

El modulo de Inventarios es el **gestor de inventario multi-sucursal con bitacora de eventos** del ERP Huubie. Su rol en el ecosistema:

```
Huubie (POS-1)
   │
   ├── Ventas POS
   ├── Pedidos / Eventos
   ├── RRHH
   ├── Finanzas
   │
   └── Inventarios (POS-2)            ← este modulo
         │
         ├── Stock actual               (visor)
         ├── Entradas                   (recepciones)
         ├── Movimientos                (bitacora unificada)
         ├── Mermas                     (perdidas)
         ├── Traspasos                  (envios entre sucursales)
         └── Configuracion              (admin: productos + almacenes)
```

**Mision del modulo:** contestar en tiempo real **que hay, donde esta, cuanto se mueve, que se pierde, que se traslada** y permitir auditar cada cambio.

---

## 2. Actores

| Actor | Rol en el flujo |
|---|---|
| **Empresa (tenant)** | Reginas (`companies_id = 4` en `fayxzvov_admin.companies`). Cobija todas las sucursales y catalogos. |
| **Sucursal** | Tienda fisica (Marinni Centro, Kafeto, Central Gpe, Cuarta, Altozano, Club Campestre, Club Campestre Tap). Cada evento ocurre **en una sucursal**. Vive en `fayxzvov_alpha.subsidiaries`. |
| **Almacen** | Espacio fisico dentro de una sucursal. Una sucursal puede tener varios; uno marcado como **general por defecto**. Tabla nueva `rfwsmqex_inventarios.warehouse`. |
| **Usuario** | Quien registra eventos. Aparece como "registrado por", "autorizo", "envio", "recibio". Vive en `fayxzvov_alpha.usr_users`. |
| **Empleado** | Persona fisica con datos de RRHH (codigo, nss, puesto). Cuando se requiere atribucion de RRHH (por ejemplo, "el almacenista responsable"). Vive en `fayxzvov_rrhh.rrhh_empleados`. |
| **Proveedor** | Externo. Suministra mercancia en entradas tipo Proveedor. Catalogo `rfwsmqex_inventarios.supplier`. |
| **Cliente final** | Consume via POS (no aparece en inventarios, pero las ventas POS disparan salidas que el visor de movimientos refleja). |

---

## 3. Conceptos clave

### 3.1 Producto

Cada producto tiene dos partes:

| Fuente | Atributos | Esquema |
|---|---|---|
| **Catalogo POS** | id, name, price, category_id, image, subsidiaries_id, companies_id | `fayxzvov_reginas.order_products` (97 productos reales) |
| **Extension inventory** | sku, cost_unit, stock_min, stock_max, shelf_life_days, warehouse_area_id, unit_id | `rfwsmqex_inventarios.product_attribute` (1:1 con order_products) |

> El producto POS no se duplica. Se le anade una "ficha de inventario" con FK 1:1. Si el producto se desactiva en el POS, su extension queda inactiva tambien (CASCADE).

### 3.2 Stock

El stock es la **cantidad disponible de un producto en un almacen especifico**. La tabla `stock` mantiene saldo vivo `(order_product_id, warehouse_id) → quantity`.

Estados derivados (calculados en la UI, no almacenados):
- **OK** - `quantity >= stock_min`.
- **Bajo** - `0 < quantity < stock_min`.
- **Agotado** - `quantity = 0`.
- **Vida util critica/proxima** - dias restantes contra `shelf_life_days` y la fecha de la entrada mas reciente.

### 3.3 Evento de inventario (transaccion raiz)

Todo cambio de stock se materializa como un **evento** con folio unico, fecha-hora, sucursal, usuario, tipo y renglones. Tipos canonicos:

| Tipo | Tabla raiz | Detalle | Signo | Folio | Origen del cambio |
|---|---|---|---|---|---|
| **ENTRADA** | `inventory_inflow` | `detail_inventory_inflow` | + | `ENT-####` | Recepcion (produccion, proveedor, transferencia entrante, devolucion cliente). |
| **MERMA** | `inventory_shrinkage` | `detail_inventory_shrinkage` | − | `M-####` | Producto dado de baja (caducidad, daniado, robo, error produccion). |
| **TRASPASO** | `inventory_transfer` | `detail_inventory_transfer` + `inventory_transfer_history` | ± | `TRA-####` | Movimiento entre sucursales (sale de origen, entra a destino). |
| **AJUSTE** | `inventory_adjustment` | `detail_inventory_adjustment` | ± | `AJU-####` / `INV-FIS-####` | Conteo fisico que corrige el sistema (faltante, sobrante, cierre mensual). |
| **SALIDA POS** | (vive en `fayxzvov_reginas.order` + `order_products`) | — | − | implicito en venta | Venta registrada en el POS. **No vive en este esquema.** |
| **DEVOLUCION** | `inventory_inflow` con `inflow_origin = devolucion` | `detail_inventory_inflow` | + | `ENT-####` | Cliente devuelve producto - reentra al inventario. |

Cada detalle mantiene `previous_stock` / `resulting_stock` por renglon - reconstruye la trazabilidad completa del producto en cualquier momento.

### 3.4 Vista unificada

`inventory_movement` (VIEW) hace UNION ALL de los renglones de los 4 tipos de evento - alimenta el visor de Movimientos. Una merma con 3 productos produce 3 filas en la vista.

---

## 4. Navegacion de la aplicacion

```
/app/inventarios/index.php              ← landing (hub)
  ├── /app/inventarios/pos-stock.php             ← Stock actual
  ├── /app/inventarios/pos-entradas.php          ← Entradas
  ├── /app/inventarios/pos-movimientos.php       ← Movimientos
  ├── /app/inventarios/pos-mermas.php            ← Mermas
  ├── /app/inventarios/pos-traspasos.php         ← Traspasos
  └── /app/inventarios/admin-inventarios.php     ← Configuracion (admin)
       ├── tab Productos
       ├── tab Almacenes
       └── tab Insumos (futuro - Fase 2)
```

### 4.1 Sub-hub (`inventario-menu.html`)

Grilla 5x1 de tarjetas operativas + 1 administrativa:

```
┌─────────┬─────────┬──────────────┬─────────┬───────────┐
│  STOCK  │ENTRADAS │ MOVIMIENTOS  │ MERMAS  │ TRASPASOS │
└─────────┴─────────┴──────────────┴─────────┴───────────┘
                CONFIGURACION (admin)
```

Cada tarjeta lleva a un submodulo independiente. El layout es el canonico Huubie (`primaryLayout` con `heightPreset: 'full'`, definido en `CLAUDE.md` raiz).

---

## 5. Submodulo a submodulo

### 5.1 Stock actual (`pos-stock.php`)

**Proposito:** ver que hay disponible y donde, con alertas.

**Datos por fila:**
- Producto + SKU + categoria.
- Stock total + stock por sucursal (filtro).
- Min / Max.
- Precio / Costo.
- Estado (OK / Bajo / Agotado).
- Vida util (badge OK / proximo / critico).

**Acciones del usuario:**
- Filtros: sucursal, categoria, nivel.
- Click en fila → panel lateral con historial reciente del producto y desglose por almacen.

**KPIs en el header:**
- Total productos.
- Cantidad OK / Bajo / Agotado.
- Productos en vida critica.

**Eventos que dispara:** ninguno (solo lectura).

**Tablas consultadas:**
- `stock` (saldo).
- `warehouse` (para filtros por almacen).
- `product_attribute` (min/max/vida util/sku/costo).
- `fayxzvov_reginas.order_products` (nombre, precio, categoria).
- `fayxzvov_alpha.subsidiaries` (nombre de sucursal).

### 5.2 Entradas (`pos-entradas.php`)

**Proposito:** registrar y consultar recepciones de mercancia.

**Origenes (catalogo `inflow_origin`):**
- **Produccion** - la propia panaderia produjo cupcakes, pasteles, galletas.
- **Proveedor** - recepcion de orden de compra externa. Requiere `supplier_id` (flag `requires_supplier = 1`).
- **Transferencia** - entro desde otra sucursal (cierra el ciclo de un traspaso).
- **Devolucion** - entro producto que habia salido (cliente devolvio, o se reverso un traspaso).

**Datos por entrada (raiz):**
- Folio `ENT-####`.
- `operation_date` + `operation_time`.
- `inflow_origin_id`.
- `warehouse_id` (almacen destino).
- `supplier_id` (NULL si origen != Proveedor).
- `subsidiaries_id`.
- `user_id` (quien registro).
- Nota libre (referencia a OC, cliente, etc.).
- `status`: Pendiente / Aplicada / Reversada.
- Totales calculados: `total_products`, `total_units`, `total_cost`.

**Datos por renglon (detalle):**
- `order_product_id` (producto).
- `quantity`, `cost_unit_snap`, `subtotal`.
- `previous_stock`, `resulting_stock`.
- `expires_at` (caducidad del lote).
- `batch_code` (lote del proveedor o produccion).
- `unit_id`.

**Flujo tipico:**
1. Usuario abre modal "Nueva entrada".
2. Elige origen → la UI carga catalogo de proveedores si aplica.
3. Elige sucursal + almacen.
4. Agrega productos (uno o varios) con cantidad, costo unitario, caducidad opcional.
5. Confirma → estado `Aplicada` → impacta stock inmediatamente.
6. Genera folio `ENT-####`.

**Validaciones de negocio:**
- Si `inflow_origin.requires_supplier = 1` → `supplier_id` es obligatorio.
- `warehouse_id` debe pertenecer a `subsidiaries_id` (consistencia geografica).
- Las cantidades deben ser > 0.
- El costo unitario no puede ser negativo.

**Eventos que dispara:**
- INSERT en `inventory_inflow` + N INSERTs en `detail_inventory_inflow`.
- UPDATE en `stock` (`quantity += renglon.quantity`).

**Reversibilidad:**
- Cambiar `status` a `Reversada` genera entradas espejo (cantidades negativas) o se aplica como detail con `quantity` inverso. **Nunca se borra fisicamente.**

### 5.3 Movimientos (`pos-movimientos.php`)

**Proposito:** bitacora unificada de TODO lo que paso (entradas, salidas POS, salidas pedido, mermas, traspasos, ajustes, devoluciones).

**Una fila = un renglon de movimiento** (un producto en un evento). Si una entrada tuvo 3 productos, aparecen 3 filas con el mismo folio.

**Columnas:**
- Producto + SKU.
- Tipo (badge codificado por color).
- Cantidad con signo (+/−).
- Stock antes / despues.
- Costo unitario y total con signo.
- Referencia (Venta #1043, Pedido #1042, Caducidad, etc.).
- Usuario + fecha.

**Filtros:** producto, fecha, tipo, sucursal, almacen.

**Eventos que dispara:** ninguno (solo lectura).

**Fuente de datos:** la vista `inventory_movement` (UNION ALL de los 4 tipos). Salidas POS (cuando se conecten) saldran del esquema `fayxzvov_reginas` via JOIN cross-schema.

**Tipos visibles:**

| Tipo | Tabla origen | Signo |
|---|---|---|
| ENTRADA | `detail_inventory_inflow` | + |
| MERMA | `detail_inventory_shrinkage` | − |
| TRANSFERENCIA (OUT) | `detail_inventory_transfer` (al `date_sent`) | − |
| TRANSFERENCIA (IN) | `detail_inventory_transfer` (al `date_received`) | + |
| AJUSTE | `detail_inventory_adjustment` (`difference`) | +/− |
| SALIDA POS | `fayxzvov_reginas.order_products` + `order` (futuro) | − |
| SALIDA PED | `fayxzvov_reginas.order` (pedidos despachados, futuro) | − |
| DEVOLUCION | `detail_inventory_inflow` con `inflow_origin.code = 'devolucion'` | + |

### 5.4 Mermas (`pos-mermas.php`)

**Proposito:** registrar perdidas (producto que ya no se puede vender).

**Motivos (catalogo `shrinkage_reason`):**
- **Caducidad** - vencimiento.
- **Daniado** - golpeado, roto, derramado.
- **Error produccion** - salio mal del horno.
- **Robo / Faltante** - desaparece sin explicacion.
- **Devolucion** - el cliente devolvio, no se reaprovecha (la devolucion entra al inventario pero inmediatamente se merma).

**Datos por merma (raiz):**
- Folio `M-####`.
- `operation_date` + `operation_time`.
- `shrinkage_reason_id`.
- `warehouse_id`, `subsidiaries_id`, `user_id`, `companies_id`.
- `evidence_url` (foto opcional).
- Nota libre.
- `status`: Aplicada / Reversada.
- Totales calculados: `total_products`, `total_units`, `total_cost_loss`.

**Datos por renglon:**
- `order_product_id`, `quantity`, `cost_unit_snap`, `subtotal_loss`.
- `previous_stock`, `resulting_stock`.

**Flujo tipico:**
1. Usuario identifica perdida.
2. Abre "Nueva merma" → elige motivo + sucursal/almacen.
3. Captura productos con cantidad.
4. Adjunta foto (opcional).
5. Confirma → estado `Aplicada` → stock baja, costo se contabiliza como perdida.
6. Genera folio `M-####`.

**Validaciones de negocio:**
- `quantity` debe ser <= `stock.quantity` del producto en el almacen (no se puede mermar mas de lo que hay).
- El costo unitario default es el `product_attribute.cost_unit` actual, pero se permite override.

**Eventos que dispara:**
- INSERT en `inventory_shrinkage` + N INSERTs en `detail_inventory_shrinkage`.
- UPDATE en `stock` (`quantity -= renglon.quantity`).

**Conexion con contabilidad:**
- `total_cost_loss` se alimenta como perdida operativa en reportes de mermas.

### 5.5 Traspasos (`pos-traspasos.php`)

**Proposito:** mover mercancia entre sucursales con flujo de aprobacion.

**Estados (catalogo `transfer_status`):**

| Orden | Estado | `is_terminal` | Significado |
|---|---|---|---|
| 1 | **Solicitado** | 0 | La sucursal destino lo pidio. |
| 2 | **Autorizado** | 0 | El admin / sucursal origen lo aprobo. |
| 3 | **En Transito** | 0 | Salio de origen, aun no llega. |
| 4 | **Recibido** | 1 | Destino confirmo recepcion. **Terminal.** |
| 5 | **Rechazado** | 1 | Origen niega (falta de stock, error). **Terminal.** |

**Datos por traspaso (raiz):**
- Folio `TRA-####`.
- `date_request`, `date_authorized`, `date_sent`, `date_received` (DATETIME).
- `transfer_status_id` (estado actual).
- `origin_warehouse_id`, `destination_warehouse_id`.
- `origin_subsidiaries_id`, `destination_subsidiaries_id`.
- `requested_user_id`, `authorized_user_id`, `received_user_id`.
- Totales: `total_products`, `total_units`, `total_cost`.

**Datos por renglon:**
- `order_product_id`, `quantity`, `cost_unit_snap`, `subtotal`.
- `origin_stock_prev` / `origin_stock_post`.
- `destination_stock_prev` / `destination_stock_post` (NULL hasta que se recibe).

**Timeline (`inventory_transfer_history`):**
- Un row por cada transicion de estado.
- Campos: `transitioned_at`, `note`, `transfer_status_id`, `user_id`.

**Flujo tipico:**
1. **Solicitud:** sucursal destino crea TRA-#### con productos deseados. Estado: `Solicitado`. Stock no se mueve.
2. **Autorizacion:** admin u origen aprueba. Estado: `Autorizado`. Stock no se mueve aun.
3. **Envio:** origen confirma que salio. Estado: `En Transito`. `date_sent` se llena. **Stock origen baja.**
4. **Recepcion:** destino confirma que llego. Estado: `Recibido`. `date_received` se llena. **Stock destino sube.**
5. (Alternativa) **Rechazo:** origen rechaza desde estado `Solicitado` o `Autorizado`. Estado: `Rechazado`. Stock no se mueve.

**Validaciones de negocio:**
- `origin_warehouse_id` y `destination_warehouse_id` deben ser distintos.
- `origin_subsidiaries_id` y `destination_subsidiaries_id` pueden ser iguales (traspaso intra-sucursal entre almacenes) o distintas.
- Para pasar a `En Transito`: validar que `stock` origen >= `quantity` solicitada.
- Una vez en estado terminal (`Recibido` o `Rechazado`), no se permiten mas transiciones.
- El timeline se llena automaticamente con cada cambio de estado.

**Eventos que dispara (segun transicion):**

| Transicion | Tabla(s) afectada(s) |
|---|---|
| → Solicitado | INSERT en `inventory_transfer` + N en `detail_inventory_transfer` + INSERT en `inventory_transfer_history`. |
| → Autorizado | UPDATE `transfer_status_id` + UPDATE `date_authorized` + UPDATE `authorized_user_id` + INSERT en history. |
| → En Transito | UPDATE `transfer_status_id` + UPDATE `date_sent` + UPDATE `stock` (origen baja) + UPDATE `detail.origin_stock_prev/post` + INSERT en history. |
| → Recibido | UPDATE `transfer_status_id` + UPDATE `date_received` + UPDATE `received_user_id` + UPDATE `stock` (destino sube) + UPDATE `detail.destination_stock_prev/post` + INSERT en history. |
| → Rechazado | UPDATE `transfer_status_id` + INSERT en history. (Stock no se toca.) |

### 5.6 Configuracion / Admin (`admin-inventarios.php`)

**Proposito:** mantener los catalogos base del modulo.

**Tabs actuales:**

#### Tab Productos
Alta/edicion/baja de la **extension de inventario** sobre el catalogo POS (`product_attribute`).

**Campos editables:**
- SKU.
- Costo unitario (`cost_unit`).
- Stock min/max.
- Vida util en dias.
- Area de almacen (`warehouse_area_id`).
- Unidad base (`unit_id`).
- Estado activo/inactivo.

**No editable desde aqui:** nombre, precio, categoria, imagen - viven en `fayxzvov_reginas.order_products` y se editan desde el modulo POS.

#### Tab Almacenes
Alta/edicion/baja de `warehouse` (almacenes fisicos por sucursal).

**Campos:**
- Nombre.
- Direccion.
- Sucursal (`subsidiaries_id`).
- Area por defecto (`warehouse_area_id`).
- `is_default_general` (uno por sucursal).
- Estado activo/inactivo.

**Regla de negocio:** solo puede haber **un almacen general por sucursal**. Marcar uno desmarca los demas de la misma sucursal automaticamente (logica en la capa de servicio + UNIQUE compuesto en DDL).

**Tab planeada (Fase 2):**
- **Insumos** - alta/edicion/baja de la dimension supply (materia prima) con unidades kg/lt/pza/caja y areas de consumo (Cocina, Barra, Panaderia).

---

## 6. Casos de uso end-to-end

### Caso 1: Recepcion de produccion matutina

**Actor:** almacenista de Reginas Kafeto.

1. Llega un lote recien horneado: 24 cupcakes, 10 pasteles 3 leches, 14 galletas.
2. Entra a `/app/inventarios/pos-entradas.php`.
3. Click "Nueva entrada".
4. Origen = `Produccion`, sucursal = `Reginas Kafeto`, almacen = `Almacen General - Kafeto`.
5. Agrega 3 renglones con cantidad + costo.
6. Confirma.
7. **Sistema:**
   - Genera folio `ENT-090`.
   - Crea `inventory_inflow` con `status = 'Aplicada'`.
   - Crea 3 `detail_inventory_inflow`.
   - Actualiza `stock` (suma cantidades a los 3 productos en el almacen).
   - Muestra toast "Entrada ENT-090 registrada".
8. La fila aparece en el visor de Entradas.
9. Las 3 lineas aparecen en el visor de Movimientos con tipo `ENTRADA` y signo +.

### Caso 2: Merma por caducidad

**Actor:** Andrea Martinez (encargada).

1. Encuentra 18 productos vencidos en la vitrina.
2. Entra a `/app/inventarios/pos-mermas.php`.
3. Click "Nueva merma".
4. Motivo = `Caducidad`, sucursal/almacen donde estaban.
5. Captura los 3 productos (SKUs) con sus cantidades.
6. Adjunta foto.
7. Confirma.
8. **Sistema:**
   - Genera folio `M-4521`.
   - Crea `inventory_shrinkage` con `total_cost_loss = -$1,240.00`.
   - Crea 3 `detail_inventory_shrinkage`.
   - Actualiza `stock` (resta cantidades).
   - Muestra alerta si algun producto queda en estado `Agotado`.
9. La fila aparece en el visor de Mermas con badge rojo `CADUCIDAD`.

### Caso 3: Traspaso entre sucursales

**Actor:** Andrea (Sucursal Norte) solicita reabasto a Kafeto.

1. Andrea entra a `pos-traspasos.php` y click "Solicitar traspaso".
2. Origen = `Reginas Kafeto`, destino = `Suc. Norte` (su sucursal).
3. Captura productos solicitados.
4. Confirma → folio `TRA-042`, estado `Solicitado`. **Stock NO se mueve.**

Carlos (Kafeto) ve la solicitud:

5. Click "Autorizar" → estado `Autorizado`. Timeline registra la transicion con `Carlos G.` y timestamp.
6. Carlos despacha → click "Marcar como En Transito" → estado `En Transito`. `date_sent` se llena. **Stock Kafeto baja.**

Llega a Suc. Norte:

7. Andrea click "Confirmar recepcion" → estado `Recibido`. `date_received` se llena. **Stock Suc. Norte sube.**
8. **Sistema:**
   - Crea evento espejo en `inventory_movement` (vista): una linea `TR-OUT-` con signo − en Kafeto + una linea `TR-IN-` con signo + en Suc. Norte.
   - Timeline tiene 4 entries: Solicitado, Autorizado, En Transito, Recibido.

### Caso 4: Ajuste por conteo fisico (cierre mensual)

**Actor:** Carlos hace inventario fisico al cierre del mes.

1. Cuenta producto por producto, compara con lo que dice el sistema.
2. Entra a `pos-mermas.php` (o futuro `pos-ajustes.php`) → "Nuevo ajuste fisico".
3. Motivo = `Cierre mensual`, tipo = `fisico`.
4. Para cada producto con diferencia, captura `system_quantity` (lo que decia el sistema) y `physical_quantity` (lo que conto).
5. `difference` = physical - system (positivo = sobrante, negativo = faltante).
6. Confirma.
7. **Sistema:**
   - Genera folio `INV-FIS-2026-05`.
   - Crea `inventory_adjustment` con `adjustment_type = 'fisico'`.
   - Crea N `detail_inventory_adjustment`.
   - Para cada renglon, ajusta `stock.quantity` con `difference`.
   - `total_diff_cost` agrega el impacto monetario.

---

## 7. Reglas de negocio destacadas

### 7.1 Singularidad por sucursal del almacen general
Cada sucursal tiene **exactamente uno** almacen marcado `is_default_general = 1`. Es donde caen movimientos cuando no se especifica almacen explicito. UNIQUE constraint compuesto en DDL + logica de servicio.

### 7.2 Stock es por (producto, almacen)
Un mismo SKU en dos almacenes son dos saldos distintos. La vista de Stock consolida con filtros. UNIQUE constraint `(order_product_id, warehouse_id)` en `stock`.

### 7.3 Folios prefijados por tipo
- `ENT-####` entradas.
- `M-####` mermas.
- `TRA-####` traspasos.
- `AJU-####` ajustes individuales.
- `INV-FIS-####` inventarios fisicos.
- Para dimension Insumos (Fase 2): `ENT-INS-####`, `SAL-INS-####`, `MER-INS-####`, `TRA-INS-####`.

Unicos por empresa (UNIQUE `(folio, companies_id)`).

### 7.4 Reversibilidad
Cada evento tiene `status` con valor `Aplicada` / `Reversada`. **Reversar NO borra fisicamente** - genera un evento espejo de signo opuesto. Auditabilidad total.

### 7.5 Snapshots por renglon
Cada `detail_*` guarda `previous_stock` + `resulting_stock` + `cost_unit_snap` para reconstruir el estado del producto en ese momento. No depende del estado actual del catalogo.

### 7.6 Aprobacion obligatoria en traspasos
Stock no se mueve hasta `En Transito` (origen) o `Recibido` (destino). Si se rechaza antes, no hay impacto.

### 7.7 Mermas afectan inventario y contabilidad
El `total_cost_loss` se materializa como perdida operativa, alimenta reportes de mermas.

### 7.8 Ajustes requieren motivo categorizado
Catalogo `adjustment_reason` con 5 valores iniciales. No se ajusta sin razon clasificada.

### 7.9 Caducidad gatilla merma sugerida
Productos con `shelf_life_days` proximos a vencer aparecen en alertas de Stock. Al vencer, el sistema puede generar una merma sugerida con motivo `Caducidad`.

### 7.10 Productos inactivos no aparecen en operacion
Si se desactiva un producto (`product_attribute.active = 0` o `order_products.active = 0`), sigue visible en historial pero no en selectores de entrada/merma/traspaso.

### 7.11 Soft-delete en todas las tablas persistentes
Excepto pivotes puros (no hay en esta version). Toda lectura filtra `WHERE active = 1`.

---

## 8. Datos sembrados (snapshot al desplegar)

### 8.1 Catalogos minimos (seed automatico)

- `unit`: 7 valores (pza, kg, lt, caja, pq, gr, ml).
- `inflow_origin`: 4 valores (Produccion, Proveedor, Transferencia, Devolucion).
- `shrinkage_reason`: 5 valores (Caducidad, Daniado, Error produccion, Robo, Devolucion).
- `adjustment_reason`: 5 valores (Faltante, Sobrante, Conteo fisico, Cierre mensual, Entrada no registrada).
- `transfer_status`: 5 valores (Solicitado, Autorizado, En Transito, Recibido, Rechazado).
- `warehouse_area`: 4 valores para Reginas (Refrigerados, Secos, Congelados, Panaderia).

### 8.2 Productos
97 productos reales heredados de `fayxzvov_reginas.order_products` (subsidiaries_id = 4). Se les genera `product_attribute` 1:1 con SKU autogenerado (`RG-001` a `RG-097`).

Distribucion por categoria (datos observados):
- Pasteles Tradicionales: 27
- Pasteles Especialidades: 15
- Postres: 16
- Bocadillos: 18
- Sobre Pedido: 5
- Pan: 2
- Galletas: 2
- Charolas: 5
- Otros: 7

### 8.3 Almacenes
7 almacenes generales (uno por sucursal activa de Reginas):
- Marinni Centro.
- Club Campestre.
- Reginas Central Gpe.
- Altozano.
- Club campestre tap.
- Reginas cuarta.
- Reginas kafeto.

### 8.4 Stock
Registros en cero para cada (producto x almacen general) - 97 x 7 = 679 filas iniciales.

### 8.5 Datos transaccionales
Vacios. Se van llenando conforme se usa la aplicacion. Los `sample_*.js` actuales son para desarrollo offline; al conectar backend se reemplazan por queries reales.

---

## 9. Integraciones cross-modulo

| Modulo externo | Como interactua con Inventarios |
|---|---|
| **Ventas POS** | Cada venta genera una **SALIDA POS** automatica por cada producto vendido (consume stock). Hoy vive en `fayxzvov_reginas.order` + `order_products` - el visor de Movimientos la consume via JOIN cuando se conecte. |
| **Pedidos / Eventos** | Cada pedido despachado genera una **SALIDA PED**. Misma logica que ventas. |
| **Devoluciones POS** | Cada devolucion de cliente reingresa stock como `inventory_inflow` con `inflow_origin = devolucion`. |
| **Produccion** | Cada batch de horneado genera una `inventory_inflow` con `inflow_origin = produccion`. |
| **Compras / Proveedores** | Cada recepcion de OC genera una `inventory_inflow` con `inflow_origin = proveedor` y `supplier_id` requerido. |
| **RRHH** | Aporta el catalogo de empleados (`fayxzvov_rrhh.rrhh_empleados`). Cuando el modulo evolucione para registrar "almacenista responsable", se usara `employee_id`. |
| **Contabilidad** | Las mermas (`total_cost_loss`) y ajustes (`total_diff_cost`) alimentan reportes de perdidas operativas. |
| **Sucursales / Empresa** | Maestros cross-schema (`fayxzvov_alpha.subsidiaries`, `fayxzvov_admin.companies`). |

---

## 10. Estados y transiciones

### 10.1 Estados de `inventory_inflow.status`

```
                    ┌──────────────┐
                    │   Pendiente  │   (raro - solo si la entrada requiere autorizacion)
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Aplicada   │   (default - impacta stock al insertar)
                    └──────┬───────┘
                           │ (admin reversa)
                           ▼
                    ┌──────────────┐
                    │   Reversada  │
                    └──────────────┘
```

### 10.2 Estados de `inventory_shrinkage.status`

```
                    ┌──────────────┐
                    │   Aplicada   │   (default)
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Reversada  │
                    └──────────────┘
```

### 10.3 Estados de `inventory_transfer.transfer_status_id` (catalogo)

```
                    ┌──────────────┐
                    │  Solicitado  │
                    └──────┬───────┘
                           │
                ┌──────────┴──────────┐
                ▼                     ▼
         ┌──────────────┐      ┌──────────────┐
         │  Autorizado  │      │  Rechazado   │ (terminal)
         └──────┬───────┘      └──────────────┘
                │
                ▼
         ┌──────────────┐
         │ En Transito  │     ← stock origen baja aqui
         └──────┬───────┘
                │
                ▼
         ┌──────────────┐
         │   Recibido   │ (terminal)   ← stock destino sube aqui
         └──────────────┘
```

### 10.4 Estados de `inventory_adjustment.status`

```
                    ┌──────────────┐
                    │  Pendiente   │   (requiere autorizacion del jefe)
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │   Aplicado   │
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Reversado   │
                    └──────────────┘
```

---

## 11. Convenciones tecnicas del modulo

### 11.1 Frontend
- Cada submodulo es una clase `App extends Templates` (patron coffeeSoft).
- Layout canonico Huubie (`primaryLayout` con `heightPreset: 'full'`, definido en `CLAUDE.md` raiz).
- Archivo `sample_*.js` al top con datasets `SAMPLE_*` (UI-first sin backend).
- Comentario `// MODO FAKE — cuando exista el backend usar: fn_ajax({ opc: 'X' }, api).then(...)` marca cada punto de integracion futura.
- Renderiza con `createCoffeeTable3` + `createfilterBar` + `createModalForm`.

### 11.2 Backend (en construccion)
- `ctrl-inventarios.php` recibe `opc` por POST y dispatcha (patron coffeeSoft).
- `mdl-inventarios.php` con consultas tipadas a `rfwsmqex_inventarios.*`.
- Para dimension dual: dispatcher por `$_POST['scope']` o `$_SESSION['inventory_scope']`.

### 11.3 Convencion de archivos

```
app/inventarios/
├── index.php                  ← landing
├── admin-inventarios.php      ← shell PHP (carga JS)
├── pos-stock.php
├── pos-entradas.php
├── pos-movimientos.php
├── pos-mermas.php
├── pos-traspasos.php
├── ctrl/
│   ├── ctrl-pos.php
│   └── ctrl-pos-historial-ventas.php
├── mdl/
│   ├── mdl-pos.php
│   └── mdl-pos-historial-ventas.php
├── src/
│   ├── js/
│   │   ├── admin-inventarios.js     ← clase App + Productos + Almacenes
│   │   ├── pos-stock.js
│   │   ├── pos-entradas.js
│   │   ├── pos-movimientos.js
│   │   ├── pos-mermas.js
│   │   ├── pos-traspasos.js
│   │   ├── sample_admin-inventarios.js
│   │   ├── sample_stock.js
│   │   ├── sample_entradas.js
│   │   ├── sample_movimientos.js
│   │   ├── sample_mermas.js
│   │   └── sample_traspasos.js
│   └── css/
├── templates/                 ← prototipos HTML
├── plan/                      ← arquitectura dual POS/Insumos
└── docs/
    ├── README.md
    ├── flujo-operacion.md     ← (legacy, version v1)
    ├── propuesta-bd.md        ← (legacy, version v1)
    └── database/              ← (este folder - v2 limpia)
        ├── propuesta-db.md
        ├── db-implementacion.md
        └── flujo-aplicacion.md (este archivo)
```

---

## 12. Pendientes y decisiones abiertas

| # | Pregunta | Estado actual |
|---|---|---|
| 1 | ¿Se renombran `pos-*.php` a `inv-*.php` para neutralidad al scope? | Pendiente (plan/propuesta-salida-insumos.md §9.1). |
| 2 | ¿Almacenes pueden contener simultaneamente productos POS e insumos? | Asumido **si**. No se necesita campo `scope` en `warehouse`. |
| 3 | ¿Default de scope: forzar gate cada sesion o respetar ultimo uso? | Pendiente. |
| 4 | Submodulo formal "Salidas" en POS, ¿se justifica? | **No** - lo cubren Ventas, Mermas y Traspasos. Solo Insumos lo necesita. |
| 5 | Esquema target: `rfwsmqex_inventarios` o `fayxzvov_inventario`? | `rfwsmqex_inventarios` propuesto. Pendiente confirmacion del data steward. |
| 6 | ¿Triggers SQL o capa de servicio para mantener `stock`? | Decision tomada: **capa de servicio** (`mdl-inventarios.php`). Los snapshots en detalles son la auditoria. |
| 7 | Politica de FK cross-schema en produccion (¿quedan o se manejan a nivel de aplicacion?) | Pendiente. Si los esquemas se mueven a servidores distintos, hay que remover FK. |
| 8 | ¿Quien hace el conteo fisico mensual y como se integra con cierres contables? | Pendiente - depende del calendario contable de Reginas. |
| 9 | Reversibilidad de traspasos terminales (`Recibido`/`Rechazado`) | Pendiente - hoy son terminales pero podria haber casos excepcionales (devolucion del traspaso). |

---

## 13. Resumen ejecutivo

El modulo `app/inventarios` es un **gestor multi-sucursal con bitacora de eventos** organizado en 6 submodulos navegables. Cada cambio de stock se materializa como un evento con folio unico (`ENT-/M-/TRA-/AJU-`) que pertenece a 1 de 4 transacciones raiz (`inventory_inflow`, `inventory_shrinkage`, `inventory_transfer`, `inventory_adjustment`). Los renglones de cada evento guardan snapshots (`previous_stock`, `resulting_stock`, `cost_unit_snap`) para auditabilidad total. El saldo vivo se mantiene en `stock` (saldo por producto x almacen). Una vista unificada `inventory_movement` alimenta el visor de Movimientos con UNION ALL de los 4 tipos. El modulo se construye en `rfwsmqex_inventarios` (nuevo) y reusa via FK cross-schema 6 maestros corporativos (`companies`, `subsidiaries`, `usr_users`, `rrhh_empleados`, `order_products`, `order_category`). Hoy opera 100% en modo FAKE con `sample_*.js`; al conectar el backend (`mdl-inventarios.php`) se vuelve operativo sin cambios en la UI.

---

> Generado por **Coffee Intelligence**. Para el DDL completo ver [propuesta-db.md](propuesta-db.md). Para el plan de despliegue ver [db-implementacion.md](db-implementacion.md).
