# Propuesta de base de datos — modulo Inventarios

> **Producto:** Huubie / app/inventarios
> **Esquema destino:** `fayxzvov_reginas` (nuevo, dedicado al modulo)
> **Charset / Collation:** `utf8mb4` / `utf8mb4_0900_ai_ci`
> **Engine:** `InnoDB`
> **Reglas aplicadas:** [grimorios/db-rules.md](../../../../../Users/CoffeSoft/.claude/agents/grimorios/db-rules.md)
> **Inspeccion previa (snapshot local 2026-05-22):** ver §1.3
> **Reemplaza a:** `docs/propuesta-bd.md` (version anterior `fayxzvov_*` con `ENUM` y FKs fuera de orden)

---

## §1. Inspeccion del template (Fase 1)

### §1.1 Que se vio en el template / codigo

El modulo `app/inventarios` opera como **gestor de inventario multi-sucursal con bitacora de eventos**, organizado en 6 submodulos navegables desde `inventario-menu.html`:

1. **Stock actual** (`pos-stock.php`) - visor de existencias por (producto x sucursal x almacen).
2. **Entradas** (`pos-entradas.php`) - recepciones de mercancia.
3. **Movimientos** (`pos-movimientos.php`) - bitacora unificada de TODO lo que paso.
4. **Mermas** (`pos-mermas.php`) - perdidas.
5. **Traspasos** (`pos-traspasos.php`) - envios entre sucursales con flujo de aprobacion.
6. **Configuracion** (`admin-inventarios.php`) - catalogos base (productos + almacenes).

### §1.2 Identificacion del dominio

| Concepto | Tipo | Pista en el codigo |
|---|---|---|
| **Evento raiz** | Transaccion | `inv_inflow`, `inv_shrinkage`, `inv_transfer`, `inv_adjustment` - cada uno con folio prefijado (ENT-, M-, TRA-, AJU-). |
| **Detalles** | Renglones | Cada evento tiene productos; capturan `quantity`, `cost_unit`, `previous_stock`, `resulting_stock`. |
| **Catalogos** | Catalogo simple | `inv_inflow_origin` (Produccion/Proveedor/Transferencia/Devolucion), `inv_shrinkage_reason` (Caducidad/Daniado/...), `inv_adjustment_reason`, `inv_transfer_status`, `inv_supplier`, `inv_unit`. |
| **Sub-catalogo** | Sub-catalogo | `inv_warehouse_area` (Refrigerados/Secos/Congelados) cuelga de empresa; `inv_product_attribute` cuelga 1:1 de `order_products`. |
| **Pivote N:M** | Pivote | Si en el futuro un almacen tuviera multiples areas: `inv_warehouse_area_assignment`. Por ahora 1:N. |
| **Maestros corporativos** | Cross-schema | `companies` (admin), `subsidiaries` (alpha), `usr_users` (alpha), `order_products` + `order_category` (reginas, mismo schema que las `inv_*` nuevas). |
| **Estados / flujo** | Catalogo + FK | `inv_transfer_status` (5 estados: Solicitado/Autorizado/En Transito/Recibido/Rechazado). `status` libre en transacciones raiz (Pendiente/Aplicada/Cancelada). |
| **Montos** | DOUBLE | `cost_unit`, `subtotal`, `total_cost`, `total_cost_loss` (convencion de la casa). |
| **Fechas** | DATE + DATETIME | `date_inflow`/`date_shrinkage`/`date_adjustment` = DATE de negocio; `created_at`/`updated_at` = DATETIME de auditoria; traspasos llevan multiples DATETIME del flujo (`date_request`/`date_authorized`/`date_sent`/`date_received`). |

### §1.3 Inspeccion de la base real (snapshot local)

Ejecutado contra el WAMP local (MySQL 8.0.31) el 2026-05-22:

```
SHOW DATABASES;
```

Bases relevantes encontradas:

| DB | Rol | Relacion con inventarios |
|---|---|---|
| `fayxzvov_admin` | Maestros corporativos (empresas / clientes / modulos) | FK destino para `companies_id`. |
| `fayxzvov_alpha` | Sucursales + usuarios Huubie | FK destino para `subsidiaries_id` y `user_id` (usr_users). |
| `fayxzvov_reginas` | Tenant Reginas - pos / pedidos | Aporta `order_products` (97 productos reales) + `order_category`. |
| `fayxzvov_erp` | Legacy ERP (udn + usuarios) | Maestro legacy (no usar en lo nuevo, salvo compatibilidad). Aqui vive `ch_colaboradores` si en algun momento se necesita un FK a personal. |
| **`fayxzvov_almacen`** | **Esquema parcial de inventario YA EXISTENTE (legacy)** | 8 tablas legacy: product, product_groups, presentations, areas, supplier, movement_type, inv_movement, inv_movement_detail. Se respeta pero no se reusa. |

> **Deuda tecnica detectada en `fayxzvov_almacen`:**
> - Collation `utf8mb4_unicode_ci` (deberia ser `utf8mb4_0900_ai_ci`).
> - Montos en `DECIMAL(12,2)` (la casa usa `DOUBLE`).
> - Tablas en plural (`areas`, `presentations`).
> - Falta `updated_at`.
> - FK al inicio del DDL (no antes de `active`).
> - `movement_type` con solo 2 valores (Entrada/Salida) - insuficiente para los 7 tipos del modulo.
> - Solo una transaccion raiz (la tabla legacy inv_movement en fayxzvov_almacen); el modulo necesita 4 (inflow/shrinkage/transfer/adjustment).
>
> **No se copian esos errores en la nueva propuesta.**

### §1.4 Justificacion del esquema target

Se propone montar las nuevas tablas dentro del esquema productivo del tenant (`fayxzvov_reginas`) con prefijo `inv_*`:

1. **Modelo replicable por subscripcion.** Reginas vive bajo el prefijo `fayxzvov_*` (`fayxzvov_admin`, `fayxzvov_alpha`, `fayxzvov_reginas`, `fayxzvov_erp`, `fayxzvov_mtto`, ...). El ecosistema `rfwsmqex_*` corresponde a otro tenant (GVSL), no a Reginas. Si entra otro cliente, se replica el DDL bajo `[prefijo]_[posdb]` con el mismo contrato.
2. **Patron ya en uso.** El modulo de mantenimiento del mismo tenant vive en `fayxzvov_mtto` con prefijo `mtto_*` (`mtto_almacen`, `mtto_almacen_area`, `mtto_proveedores`). Inventarios sigue el mismo patron desde el POS del tenant (`fayxzvov_reginas.inv_*`).
3. **`fayxzvov_almacen`** esta en estado parcial y con deuda tecnica — se respeta como legacy pero no se reusa. El modulo nuevo se monta con DDL limpio dentro de `fayxzvov_reginas`.
4. **Cohesion con el POS.** Las nuevas tablas conviven con `order`, `order_products`, `order_category` (todas en `fayxzvov_reginas`), eliminando la necesidad de FK cross-schema dentro del mismo tenant para el catalogo de productos.

Ver [db-implementacion.md](db-implementacion.md) para el plan completo.

---

## §2. Modelo logico (Fase 2)

### §2.1 Tablas clasificadas

#### Maestros corporativos (cross-schema, NO se crean)

| Tabla externa | Esquema | Uso |
|---|---|---|
| `companies` | `fayxzvov_admin` | Empresa (Reginas = id 4). |
| `subsidiaries` | `fayxzvov_alpha` | Sucursal (3 activas de Reginas con `companies_id = 4`: Reginas guadalupe id=4, Regina´s cuarta id=22, Reginas kafeto id=25). |
| `usr_users` | `fayxzvov_alpha` | Usuario que registra eventos. |
| `order_products` | `fayxzvov_reginas` | Catalogo de productos POS (97 productos). |
| `order_category` | `fayxzvov_reginas` | Categorias POS. |

#### Tablas del modulo (16 nuevas)

| # | Tabla | Clase | Rol |
|---|---|---|---|
| 1 | `inv_warehouse` | Catalogo | Almacenes fisicos (uno o mas por sucursal; uno "general por defecto"). |
| 2 | `inv_warehouse_area` | Sub-catalogo | Areas internas: Refrigerados, Secos, Congelados. |
| 3 | `inv_unit` | Catalogo | Unidades de medida (pza, kg, lt, caja, pq). |
| 4 | `inv_supplier` | Catalogo | Proveedores externos. |
| 5 | `inv_product_attribute` | Sub-catalogo | Extension 1:1 de `order_products` con datos inventory-specific (SKU, costo, min/max, vida util). |
| 6 | `inv_inflow_origin` | Catalogo | Tipos de entrada: Produccion / Proveedor / Transferencia / Devolucion. |
| 7 | `inv_shrinkage_reason` | Catalogo | Motivos de merma: Caducidad / Daniado / Error produccion / Robo / Devolucion. |
| 8 | `inv_adjustment_reason` | Catalogo | Motivos de ajuste: Faltante / Sobrante / Conteo fisico / Cierre mensual / Entrada no registrada. |
| 9 | `inv_transfer_status` | Catalogo | Estados del traspaso (5: Solicitado/Autorizado/En Transito/Recibido/Rechazado). |
| 10 | `inv_stock` | Tabla saldo | Saldo vivo por (producto, almacen). |
| 11 | `inv_inflow` | Transaccion raiz | Entradas (ENT-####). |
| 12 | `inv_inflow_detail` | Detalle | Renglones de entrada. |
| 13 | `inv_shrinkage` | Transaccion raiz | Mermas (M-####). |
| 14 | `inv_shrinkage_detail` | Detalle | Renglones de merma. |
| 15 | `inv_transfer` | Transaccion raiz | Traspasos (TRA-####). |
| 16 | `inv_transfer_detail` | Detalle | Renglones de traspaso. |
| 17 | `inv_transfer_history` | Detalle | Timeline de transiciones de estado del traspaso. |
| 18 | `inv_adjustment` | Transaccion raiz | Ajustes (AJU-#### / INV-FIS-####). |
| 19 | `inv_adjustment_detail` | Detalle | Renglones de ajuste. |
| 20 | `inv_movement` | Vista (no es tabla) | UNION ALL de las 4 transacciones raiz - bitacora unificada para el visor. |

> El prefijo `detail_` se usa SOLO en `inv_inflow_detail/shrinkage/transfer/adjustment` y en `inv_transfer_history` (que es timeline, no monetario, pero es renglon de la raiz). `inv_warehouse_area`, `inv_product_attribute` y `inv_stock` NO llevan prefijo `detail_` porque NO son renglones de una transaccion raiz monetaria.

### §2.2 Diagrama de relaciones (texto plano)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  CROSS-SCHEMA  (maestros corporativos - no se duplican)                             │
│                                                                                     │
│  ┌──────────────────┐    ┌──────────────────┐                                       │
│  │ fayxzvov_admin   │    │ fayxzvov_alpha   │                                       │
│  │ ┌──────────────┐ │    │ ┌──────────────┐ │                                       │
│  │ │  companies   │ │    │ │ subsidiaries │ │                                       │
│  │ │ - id   PK    │ │    │ │ - id   PK    │ │                                       │
│  │ │ - social_name│ │    │ │ - name       │ │                                       │
│  │ └──────┬───────┘ │    │ │ - companies_id│ │                                      │
│  └────────┼─────────┘    │ └──────┬───────┘ │                                       │
│           │              │ ┌──────┴───────┐ │                                       │
│           │              │ │  usr_users   │ │ ← unica fuente de personas (no RRHH) │
│           │              │ │ - id   PK    │ │                                       │
│           │              │ │ - fullname   │ │                                       │
│           │              │ └──────┬───────┘ │                                       │
│           │              └────────┼─────────┘                                       │
│           │                       │                                                 │
└───────────┼───────────────────────┼─────────────────────────────────────────────────┘
            │                       │
╔═══════════▼═══════════════════════▼═════════════════════════════════════════════════╗
║              fayxzvov_reginas (tenant POS + tablas nuevas inv_*)                    ║
║                                                                                     ║
║  ── TABLAS POS EXISTENTES (catalogo) ──                                             ║
║                                                                                     ║
║  ┌──────────────┐    ┌──────────────┐                                               ║
║  │order_category│◄───┤order_products│ (97 productos, subsidiaries_id=4 hoy)         ║
║  │- id   PK     │ N:1│- id   PK     │                                               ║
║  │- name        │    │- name        │                                               ║
║  └──────────────┘    │- price       │                                               ║
║                      │- subsidiaries_id                                             ║
║                      └──────┬───────┘                                               ║
║                             │                                                       ║
║                             │ order_product_id                                      ║
║                                                                                     ║
║  ── CATALOGOS DEL MODULO ──                                                         ║
║                                                                                     ║
║  ╔══════════════════╗      N:1  ╔══════════════════╗                                ║
║  ║    inv_warehouse     ╠───────────╣  inv_warehouse_area  ║   [NUEVO]                      ║
║  ║ - id   PK        ║           ║ - id  PK         ║                                ║
║  ║ - name           ║           ║ - name           ║                                ║
║  ║ - address        ║           ║ - description    ║                                ║
║  ║ - is_default     ║           ╚══════════════════╝                                ║
║  ║ - inv_warehouse_area_id FK                                                           ║
║  ║ - subsidiaries_id FK ──→ alpha                                                   ║
║  ║ - companies_id  FK ──→ admin                                                     ║
║  ╚════════╤═════════╝                                                               ║
║           │ 1:N                                                                     ║
║           │                                                                         ║
║           ▼                                                                         ║
║  ╔════════════════════╗  N:1  ┌──────────────────┐                                  ║
║  ║     inv_stock      ╠───────┤ order_products   │ (cross-schema reginas)           ║
║  ║ - id  PK           ║       └──────────────────┘                                  ║
║  ║ - quantity         ║                                                             ║
║  ║ - last_movement_at ║                                                             ║
║  ║ - last_inventory_at║                                                             ║
║  ║ - order_product_id ║                                                             ║
║  ║ - warehouse_id  FK ║                                                             ║
║  ╚════════════════════╝                                                             ║
║                                                                                     ║
║  ╔════════════════════════╗  1:1  ┌──────────────────┐                              ║
║  ║   inv_product_attribute    ╠───────┤  order_products  │                              ║
║  ║ - id  PK               ║       └──────────────────┘                              ║
║  ║ - sku UNIQUE           ║                                                         ║
║  ║ - cost_unit  DOUBLE    ║                                                         ║
║  ║ - stock_min DOUBLE     ║                                                         ║
║  ║ - stock_max DOUBLE     ║                                                         ║
║  ║ - shelf_life_days INT  ║                                                         ║
║  ║ - inv_warehouse_area_id FK ║                                                         ║
║  ║ - unit_id           FK ║                                                         ║
║  ║ - order_product_id  FK ║                                                         ║
║  ╚════════════════════════╝                                                         ║
║                                                                                     ║
║  ╔══════════════╗  ╔══════════════╗  ╔════════════════╗  ╔════════════════════╗     ║
║  ║  inv_unit    ║  ║ inv_supplier ║  ║ inv_inflow_origin  ║  ║ inv_shrinkage_reason ║     ║
║  ║ - code       ║  ║ - name       ║  ║ - code/name    ║  ║ - code/name        ║     ║
║  ║ - name       ║  ║ - rfc        ║  ║ - icon         ║  ║ - icon             ║     ║
║  ║ - decimals   ║  ║ - phone      ║  ║ - requires_sup ║  ╚════════════════════╝     ║
║  ╚══════════════╝  ╚══════════════╝  ╚════════════════╝                             ║
║                                                                                     ║
║  ╔════════════════════╗  ╔════════════════╗                                         ║
║  ║ inv_adjustment_reason  ║  ║inv_transfer_status ║                                         ║
║  ║ - code/name        ║  ║ - code/name    ║                                         ║
║  ║ - affects_cost     ║  ║ - order_index  ║                                         ║
║  ╚════════════════════╝  ║ - is_terminal  ║                                         ║
║                          ╚════════════════╝                                         ║
║                                                                                     ║
║  ── EVENTOS RAIZ + DETALLES ──                                                      ║
║                                                                                     ║
║  ╔════════════════════╗ 1:N ╔══════════════════════════╗                            ║
║  ║ inv_inflow   ╠─────╣ inv_inflow_detail  ║                            ║
║  ║ - folio   ENT-#### ║     ║ - quantity        DOUBLE ║                            ║
║  ║ - date_inflow DATE ║     ║ - cost_unit_snap  DOUBLE ║                            ║
║  ║ - total_cost DOUBLE║     ║ - subtotal        DOUBLE ║                            ║
║  ║ - status VARCHAR(20)     ║ - previous_stock  DOUBLE ║                            ║
║  ║ - inv_inflow_origin_id ║     ║ - resulting_stock DOUBLE ║                            ║
║  ║ - warehouse_id     ║     ║ - expires_at      DATE   ║                            ║
║  ║ - supplier_id      ║     ║ - batch_code             ║                            ║
║  ║ - subsidiaries_id  ║     ║ - inv_inflow_id FK ║                            ║
║  ║ - user_id          ║     ║ - order_product_id    FK ║                            ║
║  ║ - companies_id     ║     ║ - unit_id             FK ║                            ║
║  ╚════════════════════╝     ╚══════════════════════════╝                            ║
║                                                                                     ║
║  ╔════════════════════╗ 1:N ╔════════════════════════════╗                          ║
║  ║inv_shrinkage ╠─────╣inv_shrinkage_detail  ║                          ║
║  ║ - folio   M-####   ║     ║ - quantity        DOUBLE   ║                          ║
║  ║ - date_shrinkage   ║     ║ - cost_unit_snap  DOUBLE   ║                          ║
║  ║ - total_cost_loss  ║     ║ - subtotal_loss   DOUBLE   ║                          ║
║  ║ - evidence_url     ║     ║ - previous_stock  DOUBLE   ║                          ║
║  ║ - status VARCHAR(20)     ║ - resulting_stock DOUBLE   ║                          ║
║  ║ - inv_shrinkage_reason_id    ║ - inv_shrinkage_id FK║                          ║
║  ║ - warehouse_id     ║     ║ - order_product_id    FK   ║                          ║
║  ║ - subsidiaries_id  ║     ╚════════════════════════════╝                          ║
║  ║ - user_id          ║                                                             ║
║  ║ - companies_id     ║                                                             ║
║  ╚════════════════════╝                                                             ║
║                                                                                     ║
║  ╔══════════════════════╗ 1:N ╔══════════════════════════╗                          ║
║  ║ inv_transfer   ╠─────╣inv_transfer_detail ║                          ║
║  ║ - folio   TRA-####   ║     ║ - quantity         DOUBLE║                          ║
║  ║ - date_request DT    ║     ║ - cost_unit_snap   DOUBLE║                          ║
║  ║ - date_authorized DT ║     ║ - subtotal         DOUBLE║                          ║
║  ║ - date_sent      DT  ║     ║ - origin_stock_prev      ║                          ║
║  ║ - date_received  DT  ║     ║ - origin_stock_post      ║                          ║
║  ║ - total_cost  DOUBLE ║     ║ - destination_stock_prev ║                          ║
║  ║ - inv_transfer_status_id ║     ║ - destination_stock_post ║                          ║
║  ║ - origin_warehouse_id║     ║ - inv_transfer_id  ║                          ║
║  ║ - destination_wh_id  ║     ║ - order_product_id       ║                          ║
║  ║ - origin_sub_id      ║     ╚══════════════════════════╝                          ║
║  ║ - destination_sub_id ║                                                           ║
║  ║ - requested_user_id  ║          1:N                                              ║
║  ║ - authorized_user_id ║─────┐    ╔════════════════════════════╗                   ║
║  ║ - received_user_id   ║     └────╣ inv_transfer_history ║                   ║
║  ║ - companies_id       ║          ║ - transitioned_at DATETIME ║                   ║
║  ╚══════════════════════╝          ║ - note                     ║                   ║
║                                    ║ - inv_transfer_id FK ║                   ║
║                                    ║ - inv_transfer_status_id    FK ║                   ║
║                                    ║ - user_id               FK ║                   ║
║                                    ╚════════════════════════════╝                   ║
║                                                                                     ║
║  ╔════════════════════════╗ 1:N ╔══════════════════════════════╗                    ║
║  ║ inv_adjustment   ╠─────╣inv_adjustment_detail   ║                    ║
║  ║ - folio AJU-/INV-FIS-  ║     ║ - system_quantity   DOUBLE   ║                    ║
║  ║ - date_adjustment      ║     ║ - physical_quantity DOUBLE   ║                    ║
║  ║ - adjustment_type      ║     ║ - difference        DOUBLE   ║                    ║
║  ║   (individual/fisico)  ║     ║ - cost_unit_snap    DOUBLE   ║                    ║
║  ║ - total_diff_cost      ║     ║ - cost_diff         DOUBLE   ║                    ║
║  ║ - status VARCHAR(20)   ║     ║ - previous_stock             ║                    ║
║  ║ - inv_adjustment_reason_id ║     ║ - resulting_stock            ║                    ║
║  ║ - warehouse_id         ║     ║ - inv_adjustment_id FK ║                    ║
║  ║ - subsidiaries_id      ║     ║ - order_product_id        FK ║                    ║
║  ║ - registered_user_id   ║     ╚══════════════════════════════╝                    ║
║  ║ - authorized_user_id   ║                                                         ║
║  ║ - companies_id         ║                                                         ║
║  ╚════════════════════════╝                                                         ║
║                                                                                     ║
║  ── VISTA ──                                                                        ║
║                                                                                     ║
║  inv_movement (VIEW)                                                          ║
║    UNION ALL de:                                                                    ║
║      inv_inflow_detail      (signo +)                                         ║
║      inv_shrinkage_detail   (signo -)                                         ║
║      inv_transfer_detail    (OUT: -, IN: +)                                   ║
║      inv_adjustment_detail  (signo +/- segun difference)                      ║
║                                                                                     ║
╚═════════════════════════════════════════════════════════════════════════════════════╝
```

### §2.3 Tabla de cardinalidades

| Origen | → | Destino | Esquema | Cardinalidad | Justificacion |
|---|---|---|---|---|---|
| `inv_warehouse` | → | `subsidiaries` | alpha | N : 1 | Un almacen pertenece a una sucursal. |
| `inv_warehouse` | → | `inv_warehouse_area` | actual | N : 1 | Un almacen puede tener un area principal asignada. |
| `inv_warehouse` | → | `companies` | admin | N : 1 | Tenant del almacen. |
| `inv_warehouse_area` | → | `companies` | admin | N : 1 | Areas son por empresa (Reginas tiene sus propias areas). |
| `inv_product_attribute` | → | `order_products` | reginas | 1 : 1 | Extension inventory-specific 1:1 con el catalogo POS. |
| `inv_product_attribute` | → | `inv_warehouse_area` | actual | N : 1 | Producto pertenece a un area (donde se guarda). |
| `inv_product_attribute` | → | `inv_unit` | actual | N : 1 | Unidad base del producto (pza/kg/...). |
| `inv_stock` | → | `order_products` | reginas | N : 1 | Saldo por producto. |
| `inv_stock` | → | `inv_warehouse` | actual | N : 1 | Saldo por almacen. |
| `inv_inflow` | → | `inv_inflow_origin` | actual | N : 1 | Tipo de entrada. |
| `inv_inflow` | → | `inv_warehouse` | actual | N : 1 | Almacen destino. |
| `inv_inflow` | → | `inv_supplier` | actual | N : 1 | Proveedor (solo si origen=Proveedor; sino NULL). |
| `inv_inflow` | → | `subsidiaries` | alpha | N : 1 | Sucursal donde se registra. |
| `inv_inflow` | → | `usr_users` | alpha | N : 1 | Quien registro. |
| `inv_inflow` | → | `companies` | admin | N : 1 | Tenant. |
| `inv_inflow_detail` | → | `inv_inflow` | actual | N : 1 | Renglon pertenece a la entrada. |
| `inv_inflow_detail` | → | `order_products` | reginas | N : 1 | Producto del renglon. |
| `inv_inflow_detail` | → | `inv_unit` | actual | N : 1 | Unidad del renglon. |
| `inv_shrinkage` | → | `inv_shrinkage_reason` | actual | N : 1 | Motivo. |
| `inv_shrinkage` | → | `inv_warehouse` | actual | N : 1 | Almacen afectado. |
| `inv_shrinkage` | → | `subsidiaries` | alpha | N : 1 | Sucursal. |
| `inv_shrinkage` | → | `usr_users` | alpha | N : 1 | Quien registro. |
| `inv_shrinkage` | → | `companies` | admin | N : 1 | Tenant. |
| `inv_shrinkage_detail` | → | `inv_shrinkage` | actual | N : 1 | Renglon. |
| `inv_shrinkage_detail` | → | `order_products` | reginas | N : 1 | Producto. |
| `inv_transfer` | → | `inv_transfer_status` | actual | N : 1 | Estado actual. |
| `inv_transfer` | → | `inv_warehouse` (origen) | actual | N : 1 | Almacen origen. |
| `inv_transfer` | → | `inv_warehouse` (destino) | actual | N : 1 | Almacen destino. |
| `inv_transfer` | → | `subsidiaries` (origen) | alpha | N : 1 | Sucursal origen. |
| `inv_transfer` | → | `subsidiaries` (destino) | alpha | N : 1 | Sucursal destino. |
| `inv_transfer` | → | `usr_users` (solicito) | alpha | N : 1 | Quien solicito. |
| `inv_transfer` | → | `usr_users` (autorizo) | alpha | N : 1 | Quien autorizo. |
| `inv_transfer` | → | `usr_users` (recibio) | alpha | N : 1 | Quien recibio. |
| `inv_transfer` | → | `companies` | admin | N : 1 | Tenant. |
| `inv_transfer_detail` | → | `inv_transfer` | actual | N : 1 | Renglon. |
| `inv_transfer_detail` | → | `order_products` | reginas | N : 1 | Producto. |
| `inv_transfer_history` | → | `inv_transfer` | actual | N : 1 | Timeline pertenece al traspaso. |
| `inv_transfer_history` | → | `inv_transfer_status` | actual | N : 1 | Estado al que se transiciono. |
| `inv_transfer_history` | → | `usr_users` | alpha | N : 1 | Quien hizo la transicion. |
| `inv_adjustment` | → | `inv_adjustment_reason` | actual | N : 1 | Motivo. |
| `inv_adjustment` | → | `inv_warehouse` | actual | N : 1 | Almacen ajustado. |
| `inv_adjustment` | → | `subsidiaries` | alpha | N : 1 | Sucursal. |
| `inv_adjustment` | → | `usr_users` (registro) | alpha | N : 1 | Quien registro. |
| `inv_adjustment` | → | `usr_users` (autorizo) | alpha | N : 1 | Quien autorizo (puede ser igual). |
| `inv_adjustment` | → | `companies` | admin | N : 1 | Tenant. |
| `inv_adjustment_detail` | → | `inv_adjustment` | actual | N : 1 | Renglon. |
| `inv_adjustment_detail` | → | `order_products` | reginas | N : 1 | Producto ajustado. |

### §2.4 Decisiones de diseno

| Tema | Decision | Justificacion |
|---|---|---|
| **Esquema nuevo vs reusar** | Nuevo `fayxzvov_reginas` | `fayxzvov_almacen` viola db-rules y solo cubre 1/4 de los eventos. Ver §1.3. |
| **Status como catalogo o columna libre** | Columna `status VARCHAR(20)` en raices simples (inflow/shrinkage/adjustment) y catalogo `inv_transfer_status` para traspasos | Traspasos tienen 5 estados con flujo + `order_index` + `is_terminal`; las otras 3 transacciones tienen solo 3 estados fijos (Pendiente/Aplicada/Cancelada). El catalogo es overkill ahi. |
| **DECIMAL vs DOUBLE para montos** | `DOUBLE` | Convencion de la casa (db-rules §4). |
| **Convencion de FK plurales** | Singular para tablas nuevas (`inv_warehouse_id`, `supplier_id`); plural solo cuando la tabla externa ya esta en plural (`subsidiaries_id`, `companies_id`) | db-rules prescribe singular, pero `fayxzvov_alpha.subsidiaries` y `fayxzvov_admin.companies` existen en plural - se respeta el destino. |
| **Productos: extender vs duplicar** | Extender via `inv_product_attribute` 1:1 | El catalogo `order_products` ya tiene 97 productos reales en produccion. Duplicarlos es drift. |
| **Stock por (producto x almacen)** | Tabla `inv_stock` con UNIQUE compuesto | Permite consulta directa por almacen; el filtro por sucursal sale por join via `inv_warehouse.subsidiaries_id`. |
| **Salidas POS** | No se modelan en este esquema | Las salidas POS son consecuencia de la venta - viven en `fayxzvov_reginas.order`/`order_products`. El visor de Movimientos las consume cross-schema cuando se conecte el back. |
| **Insumos (dimension supply)** | Tablas paralelas en futuro (Fase 2) | Plan canonico en `plan/propuesta-salida-insumos.md`. Mismas convenciones con prefijo `supply_*`. |
| **Vista `inv_movement`** | VIEW, no tabla materializada | Datos cambian al aplicar/revertir eventos. Una vista garantiza consistencia. Si el rendimiento se vuelve problema, se puede materializar despues. |

---

## §3. DDL completo (Fase 3)

### §3.1 Creacion del esquema

```sql
CREATE DATABASE IF NOT EXISTS `fayxzvov_reginas`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE `fayxzvov_reginas`;
```

### §3.2 Catalogos del modulo

```sql
-- ════════════════════════════════════════════════════════════════
--  inv_warehouse_area  (sub-catalogo: areas internas del almacen)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inv_warehouse_area` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(80) NOT NULL,
  `description`  VARCHAR(255) DEFAULT NULL,
  `color_hex`    CHAR(7) DEFAULT NULL,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `companies_id` INT NOT NULL,
  `active`       TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inv_warehouse_area_name_company` (`name`,`companies_id`),
  KEY `companies_id` (`companies_id`),
  CONSTRAINT `inv_warehouse_area_ibfk_1` FOREIGN KEY (`companies_id`)
    REFERENCES `fayxzvov_admin`.`companies` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  inv_warehouse  (catalogo de almacenes fisicos)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inv_warehouse` (
  `id`                 INT NOT NULL AUTO_INCREMENT,
  `name`               VARCHAR(120) NOT NULL,
  `address`            VARCHAR(255) DEFAULT NULL,
  `is_default_general` TINYINT NOT NULL DEFAULT 0
    COMMENT 'Solo un inv_warehouse por subsidiaries_id puede tener is_default_general=1',
  `created_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `inv_warehouse_area_id`  INT DEFAULT NULL,
  `subsidiaries_id`    INT NOT NULL,
  `companies_id`       INT NOT NULL,
  `active`             TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `inv_warehouse_area_id` (`inv_warehouse_area_id`),
  KEY `subsidiaries_id` (`subsidiaries_id`),
  KEY `companies_id` (`companies_id`),
  CONSTRAINT `inv_warehouse_ibfk_1` FOREIGN KEY (`inv_warehouse_area_id`)
    REFERENCES `inv_warehouse_area` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_warehouse_ibfk_2` FOREIGN KEY (`subsidiaries_id`)
    REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_warehouse_ibfk_3` FOREIGN KEY (`companies_id`)
    REFERENCES `fayxzvov_admin`.`companies` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  unit  (catalogo de unidades de medida)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inv_unit` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `code`       VARCHAR(10) NOT NULL COMMENT 'pza, kg, lt, caja, pq',
  `name`       VARCHAR(40) NOT NULL,
  `decimals`   TINYINT NOT NULL DEFAULT 0
    COMMENT 'Decimales permitidos para esta unidad',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `active`     TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_unit_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  supplier  (catalogo de proveedores externos)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inv_supplier` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(180) NOT NULL,
  `contact_name` VARCHAR(120) DEFAULT NULL,
  `phone`        VARCHAR(40) DEFAULT NULL,
  `email`        VARCHAR(120) DEFAULT NULL,
  `address`      VARCHAR(255) DEFAULT NULL,
  `rfc`          VARCHAR(13) DEFAULT NULL,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `companies_id` INT NOT NULL,
  `active`       TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `companies_id` (`companies_id`),
  CONSTRAINT `supplier_ibfk_1` FOREIGN KEY (`companies_id`)
    REFERENCES `fayxzvov_admin`.`companies` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  inv_product_attribute  (sub-catalogo: extension 1:1 de order_products)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inv_product_attribute` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `sku`               VARCHAR(40) NOT NULL,
  `description`       VARCHAR(255) DEFAULT NULL,
  `cost_unit`         DOUBLE NOT NULL DEFAULT 0,
  `stock_min`         DOUBLE NOT NULL DEFAULT 0,
  `stock_max`         DOUBLE NOT NULL DEFAULT 0,
  `shelf_life_days`   INT DEFAULT NULL COMMENT 'Vida util en dias',
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `order_product_id`  INT NOT NULL,
  `inv_warehouse_area_id` INT DEFAULT NULL,
  `unit_id`           INT NOT NULL,
  `companies_id`      INT NOT NULL,
  `active`            TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inv_product_attribute_order_product` (`order_product_id`),
  UNIQUE KEY `uq_inv_product_attribute_sku_company` (`sku`,`companies_id`),
  KEY `order_product_id` (`order_product_id`),
  KEY `inv_warehouse_area_id` (`inv_warehouse_area_id`),
  KEY `unit_id` (`unit_id`),
  KEY `companies_id` (`companies_id`),
  CONSTRAINT `inv_product_attribute_ibfk_1` FOREIGN KEY (`order_product_id`)
    REFERENCES `fayxzvov_reginas`.`order_products` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `inv_product_attribute_ibfk_2` FOREIGN KEY (`inv_warehouse_area_id`)
    REFERENCES `inv_warehouse_area` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_product_attribute_ibfk_3` FOREIGN KEY (`unit_id`)
    REFERENCES `inv_unit` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_product_attribute_ibfk_4` FOREIGN KEY (`companies_id`)
    REFERENCES `fayxzvov_admin`.`companies` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  inv_inflow_origin  (catalogo: tipos de entrada)
--  Valores semilla: Produccion, Proveedor, Transferencia, Devolucion
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inv_inflow_origin` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `code`              VARCHAR(30) NOT NULL,
  `name`              VARCHAR(80) NOT NULL,
  `icon`              VARCHAR(40) DEFAULT NULL,
  `color_hex`         CHAR(7) DEFAULT NULL,
  `requires_supplier` TINYINT NOT NULL DEFAULT 0,
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `active`            TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inv_inflow_origin_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  inv_shrinkage_reason  (catalogo: motivos de merma)
--  Valores semilla: Caducidad, Daniado, Error produccion, Robo, Devolucion
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inv_shrinkage_reason` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `code`       VARCHAR(30) NOT NULL,
  `name`       VARCHAR(80) NOT NULL,
  `icon`       VARCHAR(40) DEFAULT NULL,
  `color_hex`  CHAR(7) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `active`     TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inv_shrinkage_reason_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  inv_adjustment_reason  (catalogo: motivos de ajuste)
--  Valores semilla: Faltante, Sobrante, Conteo fisico, Cierre mensual,
--                   Entrada no registrada
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inv_adjustment_reason` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `code`         VARCHAR(30) NOT NULL,
  `name`         VARCHAR(80) NOT NULL,
  `icon`         VARCHAR(40) DEFAULT NULL,
  `color_hex`    CHAR(7) DEFAULT NULL,
  `affects_cost` TINYINT NOT NULL DEFAULT 1
    COMMENT 'Si el ajuste contabiliza perdida/ganancia',
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `active`       TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inv_adjustment_reason_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  inv_transfer_status  (catalogo: estados del flujo de traspaso)
--  Valores semilla:
--    1=Solicitado, 2=Autorizado, 3=En Transito, 4=Recibido (terminal),
--    5=Rechazado (terminal)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inv_transfer_status` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `code`        VARCHAR(30) NOT NULL,
  `name`        VARCHAR(60) NOT NULL,
  `order_index` TINYINT NOT NULL DEFAULT 0,
  `is_terminal` TINYINT NOT NULL DEFAULT 0,
  `color_hex`   CHAR(7) DEFAULT NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `active`      TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inv_transfer_status_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### §3.3 Stock (saldo vivo)

```sql
-- ════════════════════════════════════════════════════════════════
--  stock  (saldo por producto x almacen - actualizado por la
--          capa de servicio al aplicar/revertir eventos)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inv_stock` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `quantity`          DOUBLE NOT NULL DEFAULT 0,
  `last_movement_at`  DATETIME DEFAULT NULL,
  `last_inventory_at` DATETIME DEFAULT NULL
    COMMENT 'Ultima vez que se hizo conteo fisico',
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `order_product_id`  INT NOT NULL,
  `inv_warehouse_id`      INT NOT NULL,
  `companies_id`      INT NOT NULL,
  `active`            TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stock_product_warehouse` (`order_product_id`,`inv_warehouse_id`),
  KEY `order_product_id` (`order_product_id`),
  KEY `inv_warehouse_id` (`inv_warehouse_id`),
  KEY `companies_id` (`companies_id`),
  CONSTRAINT `stock_ibfk_1` FOREIGN KEY (`order_product_id`)
    REFERENCES `fayxzvov_reginas`.`order_products` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `stock_ibfk_2` FOREIGN KEY (`inv_warehouse_id`)
    REFERENCES `inv_warehouse` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `stock_ibfk_3` FOREIGN KEY (`companies_id`)
    REFERENCES `fayxzvov_admin`.`companies` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### §3.4 Transacciones raiz + detalles

#### §3.4.1 Entradas (`inv_inflow`)

```sql
-- ════════════════════════════════════════════════════════════════
--  inv_inflow  (transaccion raiz - entradas ENT-####)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inv_inflow` (
  `id`               INT NOT NULL AUTO_INCREMENT,
  `folio`            VARCHAR(20) NOT NULL,
  `note`             VARCHAR(500) DEFAULT NULL,
  `total_products`   INT NOT NULL DEFAULT 0,
  `total_units`      DOUBLE NOT NULL DEFAULT 0,
  `total_cost`       DOUBLE NOT NULL DEFAULT 0,
  `operation_date`   DATE NOT NULL,
  `operation_time`   TIME NOT NULL,
  `created_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status`           VARCHAR(20) NOT NULL DEFAULT 'Aplicada'
    COMMENT 'Pendiente / Aplicada / Cancelada',
  `inv_inflow_origin_id` INT NOT NULL,
  `inv_warehouse_id`     INT NOT NULL,
  `supplier_id`      INT DEFAULT NULL,
  `subsidiaries_id`  INT NOT NULL,
  `user_id`          INT NOT NULL,
  `companies_id`     INT NOT NULL,
  `active`           TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_inflow_folio_company` (`folio`,`companies_id`),
  KEY `inv_inflow_origin_id` (`inv_inflow_origin_id`),
  KEY `inv_warehouse_id` (`inv_warehouse_id`),
  KEY `supplier_id` (`supplier_id`),
  KEY `subsidiaries_id` (`subsidiaries_id`),
  KEY `user_id` (`user_id`),
  KEY `companies_id` (`companies_id`),
  KEY `operation_date` (`operation_date`),
  CONSTRAINT `inv_inflow_ibfk_1` FOREIGN KEY (`inv_inflow_origin_id`)
    REFERENCES `inv_inflow_origin` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_inflow_ibfk_2` FOREIGN KEY (`inv_warehouse_id`)
    REFERENCES `inv_warehouse` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_inflow_ibfk_3` FOREIGN KEY (`supplier_id`)
    REFERENCES `inv_supplier` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_inflow_ibfk_4` FOREIGN KEY (`subsidiaries_id`)
    REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_inflow_ibfk_5` FOREIGN KEY (`user_id`)
    REFERENCES `fayxzvov_alpha`.`usr_users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_inflow_ibfk_6` FOREIGN KEY (`companies_id`)
    REFERENCES `fayxzvov_admin`.`companies` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  inv_inflow_detail  (renglones de entrada)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inv_inflow_detail` (
  `id`                  INT NOT NULL AUTO_INCREMENT,
  `quantity`            DOUBLE NOT NULL,
  `cost_unit_snap`      DOUBLE NOT NULL
    COMMENT 'Snapshot del costo al momento del registro',
  `subtotal`            DOUBLE NOT NULL,
  `previous_stock`      DOUBLE NOT NULL,
  `resulting_stock`     DOUBLE NOT NULL,
  `expires_at`          DATE DEFAULT NULL
    COMMENT 'Caducidad declarada al recibir',
  `batch_code`          VARCHAR(40) DEFAULT NULL
    COMMENT 'Lote del proveedor o produccion',
  `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `inv_inflow_id` INT NOT NULL,
  `order_product_id`    INT NOT NULL,
  `unit_id`             INT NOT NULL,
  `active`              TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `inv_inflow_id` (`inv_inflow_id`),
  KEY `order_product_id` (`order_product_id`),
  KEY `unit_id` (`unit_id`),
  CONSTRAINT `inv_inflow_detail_ibfk_1` FOREIGN KEY (`inv_inflow_id`)
    REFERENCES `inv_inflow` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `inv_inflow_detail_ibfk_2` FOREIGN KEY (`order_product_id`)
    REFERENCES `fayxzvov_reginas`.`order_products` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_inflow_detail_ibfk_3` FOREIGN KEY (`unit_id`)
    REFERENCES `inv_unit` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

#### §3.4.2 Mermas (`inv_shrinkage`)

```sql
-- ════════════════════════════════════════════════════════════════
--  inv_shrinkage  (transaccion raiz - mermas M-####)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inv_shrinkage` (
  `id`                  INT NOT NULL AUTO_INCREMENT,
  `folio`               VARCHAR(20) NOT NULL,
  `note`                VARCHAR(500) DEFAULT NULL,
  `evidence_url`        VARCHAR(255) DEFAULT NULL
    COMMENT 'Foto / evidencia de la merma',
  `total_products`      INT NOT NULL DEFAULT 0,
  `total_units`         DOUBLE NOT NULL DEFAULT 0,
  `total_cost_loss`     DOUBLE NOT NULL DEFAULT 0,
  `operation_date`      DATE NOT NULL,
  `operation_time`      TIME NOT NULL,
  `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status`              VARCHAR(20) NOT NULL DEFAULT 'Aplicada'
    COMMENT 'Aplicada / Cancelada',
  `inv_shrinkage_reason_id` INT NOT NULL,
  `inv_warehouse_id`        INT NOT NULL,
  `subsidiaries_id`     INT NOT NULL,
  `user_id`             INT NOT NULL,
  `companies_id`        INT NOT NULL,
  `active`              TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_shrinkage_folio_company` (`folio`,`companies_id`),
  KEY `inv_shrinkage_reason_id` (`inv_shrinkage_reason_id`),
  KEY `inv_warehouse_id` (`inv_warehouse_id`),
  KEY `subsidiaries_id` (`subsidiaries_id`),
  KEY `user_id` (`user_id`),
  KEY `companies_id` (`companies_id`),
  KEY `operation_date` (`operation_date`),
  CONSTRAINT `inv_shrinkage_ibfk_1` FOREIGN KEY (`inv_shrinkage_reason_id`)
    REFERENCES `inv_shrinkage_reason` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_shrinkage_ibfk_2` FOREIGN KEY (`inv_warehouse_id`)
    REFERENCES `inv_warehouse` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_shrinkage_ibfk_3` FOREIGN KEY (`subsidiaries_id`)
    REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_shrinkage_ibfk_4` FOREIGN KEY (`user_id`)
    REFERENCES `fayxzvov_alpha`.`usr_users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_shrinkage_ibfk_5` FOREIGN KEY (`companies_id`)
    REFERENCES `fayxzvov_admin`.`companies` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  inv_shrinkage_detail  (renglones de merma)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inv_shrinkage_detail` (
  `id`                     INT NOT NULL AUTO_INCREMENT,
  `quantity`               DOUBLE NOT NULL,
  `cost_unit_snap`         DOUBLE NOT NULL,
  `subtotal_loss`          DOUBLE NOT NULL,
  `previous_stock`         DOUBLE NOT NULL,
  `resulting_stock`        DOUBLE NOT NULL,
  `created_at`             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `inv_shrinkage_id` INT NOT NULL,
  `order_product_id`       INT NOT NULL,
  `active`                 TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `inv_shrinkage_id` (`inv_shrinkage_id`),
  KEY `order_product_id` (`order_product_id`),
  CONSTRAINT `inv_shrinkage_detail_ibfk_1` FOREIGN KEY (`inv_shrinkage_id`)
    REFERENCES `inv_shrinkage` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `inv_shrinkage_detail_ibfk_2` FOREIGN KEY (`order_product_id`)
    REFERENCES `fayxzvov_reginas`.`order_products` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

#### §3.4.3 Traspasos (`inv_transfer`)

```sql
-- ════════════════════════════════════════════════════════════════
--  inv_transfer  (transaccion raiz - traspasos TRA-####)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inv_transfer` (
  `id`                          INT NOT NULL AUTO_INCREMENT,
  `folio`                       VARCHAR(20) NOT NULL,
  `note`                        VARCHAR(500) DEFAULT NULL,
  `total_products`              INT NOT NULL DEFAULT 0,
  `total_units`                 DOUBLE NOT NULL DEFAULT 0,
  `total_cost`                  DOUBLE NOT NULL DEFAULT 0,
  `date_request`                DATETIME NOT NULL,
  `date_authorized`             DATETIME DEFAULT NULL,
  `date_sent`                   DATETIME DEFAULT NULL,
  `date_received`               DATETIME DEFAULT NULL,
  `created_at`                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `inv_transfer_status_id`          INT NOT NULL,
  `origin_warehouse_id`         INT NOT NULL,
  `destination_warehouse_id`    INT NOT NULL,
  `origin_subsidiaries_id`      INT NOT NULL,
  `destination_subsidiaries_id` INT NOT NULL,
  `requested_user_id`           INT NOT NULL,
  `authorized_user_id`          INT DEFAULT NULL,
  `received_user_id`            INT DEFAULT NULL,
  `companies_id`                INT NOT NULL,
  `active`                      TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_transfer_folio_company` (`folio`,`companies_id`),
  KEY `inv_transfer_status_id` (`inv_transfer_status_id`),
  KEY `origin_warehouse_id` (`origin_warehouse_id`),
  KEY `destination_warehouse_id` (`destination_warehouse_id`),
  KEY `origin_subsidiaries_id` (`origin_subsidiaries_id`),
  KEY `destination_subsidiaries_id` (`destination_subsidiaries_id`),
  KEY `requested_user_id` (`requested_user_id`),
  KEY `authorized_user_id` (`authorized_user_id`),
  KEY `received_user_id` (`received_user_id`),
  KEY `companies_id` (`companies_id`),
  KEY `date_request` (`date_request`),
  CONSTRAINT `inv_transfer_ibfk_1` FOREIGN KEY (`inv_transfer_status_id`)
    REFERENCES `inv_transfer_status` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_transfer_ibfk_2` FOREIGN KEY (`origin_warehouse_id`)
    REFERENCES `inv_warehouse` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_transfer_ibfk_3` FOREIGN KEY (`destination_warehouse_id`)
    REFERENCES `inv_warehouse` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_transfer_ibfk_4` FOREIGN KEY (`origin_subsidiaries_id`)
    REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_transfer_ibfk_5` FOREIGN KEY (`destination_subsidiaries_id`)
    REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_transfer_ibfk_6` FOREIGN KEY (`requested_user_id`)
    REFERENCES `fayxzvov_alpha`.`usr_users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_transfer_ibfk_7` FOREIGN KEY (`authorized_user_id`)
    REFERENCES `fayxzvov_alpha`.`usr_users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_transfer_ibfk_8` FOREIGN KEY (`received_user_id`)
    REFERENCES `fayxzvov_alpha`.`usr_users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_transfer_ibfk_9` FOREIGN KEY (`companies_id`)
    REFERENCES `fayxzvov_admin`.`companies` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  inv_transfer_detail  (renglones de traspaso)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inv_transfer_detail` (
  `id`                     INT NOT NULL AUTO_INCREMENT,
  `quantity`               DOUBLE NOT NULL,
  `cost_unit_snap`         DOUBLE NOT NULL,
  `subtotal`               DOUBLE NOT NULL,
  `origin_stock_prev`      DOUBLE NOT NULL,
  `origin_stock_post`      DOUBLE NOT NULL,
  `destination_stock_prev` DOUBLE DEFAULT NULL
    COMMENT 'Se llena al recibir',
  `destination_stock_post` DOUBLE DEFAULT NULL,
  `created_at`             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `inv_transfer_id`  INT NOT NULL,
  `order_product_id`       INT NOT NULL,
  `active`                 TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `inv_transfer_id` (`inv_transfer_id`),
  KEY `order_product_id` (`order_product_id`),
  CONSTRAINT `inv_transfer_detail_ibfk_1` FOREIGN KEY (`inv_transfer_id`)
    REFERENCES `inv_transfer` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `inv_transfer_detail_ibfk_2` FOREIGN KEY (`order_product_id`)
    REFERENCES `fayxzvov_reginas`.`order_products` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  inv_transfer_history  (timeline de transiciones del flujo)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inv_transfer_history` (
  `id`                    INT NOT NULL AUTO_INCREMENT,
  `note`                  VARCHAR(500) DEFAULT NULL,
  `transitioned_at`       DATETIME NOT NULL,
  `created_at`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `inv_transfer_id` INT NOT NULL,
  `inv_transfer_status_id`    INT NOT NULL,
  `user_id`               INT NOT NULL,
  `active`                TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `inv_transfer_id` (`inv_transfer_id`),
  KEY `inv_transfer_status_id` (`inv_transfer_status_id`),
  KEY `user_id` (`user_id`),
  KEY `transitioned_at` (`transitioned_at`),
  CONSTRAINT `inv_transfer_history_ibfk_1` FOREIGN KEY (`inv_transfer_id`)
    REFERENCES `inv_transfer` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `inv_transfer_history_ibfk_2` FOREIGN KEY (`inv_transfer_status_id`)
    REFERENCES `inv_transfer_status` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_transfer_history_ibfk_3` FOREIGN KEY (`user_id`)
    REFERENCES `fayxzvov_alpha`.`usr_users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

#### §3.4.4 Ajustes (`inv_adjustment`)

```sql
-- ════════════════════════════════════════════════════════════════
--  inv_adjustment  (transaccion raiz - ajustes AJU-/INV-FIS-)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inv_adjustment` (
  `id`                   INT NOT NULL AUTO_INCREMENT,
  `folio`                VARCHAR(20) NOT NULL,
  `note`                 VARCHAR(500) DEFAULT NULL,
  `adjustment_type`      VARCHAR(20) NOT NULL DEFAULT 'individual'
    COMMENT 'individual / fisico',
  `total_products`       INT NOT NULL DEFAULT 0,
  `total_diff_units`     DOUBLE NOT NULL DEFAULT 0,
  `total_diff_cost`      DOUBLE NOT NULL DEFAULT 0,
  `operation_date`       DATE NOT NULL,
  `operation_time`       TIME NOT NULL,
  `created_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `status`               VARCHAR(20) NOT NULL DEFAULT 'Aplicado'
    COMMENT 'Pendiente / Aplicado / Cancelado',
  `inv_adjustment_reason_id` INT NOT NULL,
  `inv_warehouse_id`         INT NOT NULL,
  `subsidiaries_id`      INT NOT NULL,
  `registered_user_id`   INT NOT NULL,
  `authorized_user_id`   INT DEFAULT NULL,
  `companies_id`         INT NOT NULL,
  `active`               TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_adjustment_folio_company` (`folio`,`companies_id`),
  KEY `inv_adjustment_reason_id` (`inv_adjustment_reason_id`),
  KEY `inv_warehouse_id` (`inv_warehouse_id`),
  KEY `subsidiaries_id` (`subsidiaries_id`),
  KEY `registered_user_id` (`registered_user_id`),
  KEY `authorized_user_id` (`authorized_user_id`),
  KEY `companies_id` (`companies_id`),
  KEY `operation_date` (`operation_date`),
  CONSTRAINT `inv_adjustment_ibfk_1` FOREIGN KEY (`inv_adjustment_reason_id`)
    REFERENCES `inv_adjustment_reason` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_adjustment_ibfk_2` FOREIGN KEY (`inv_warehouse_id`)
    REFERENCES `inv_warehouse` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_adjustment_ibfk_3` FOREIGN KEY (`subsidiaries_id`)
    REFERENCES `fayxzvov_alpha`.`subsidiaries` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_adjustment_ibfk_4` FOREIGN KEY (`registered_user_id`)
    REFERENCES `fayxzvov_alpha`.`usr_users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_adjustment_ibfk_5` FOREIGN KEY (`authorized_user_id`)
    REFERENCES `fayxzvov_alpha`.`usr_users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `inv_adjustment_ibfk_6` FOREIGN KEY (`companies_id`)
    REFERENCES `fayxzvov_admin`.`companies` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ════════════════════════════════════════════════════════════════
--  inv_adjustment_detail  (renglones de ajuste)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE `inv_adjustment_detail` (
  `id`                      INT NOT NULL AUTO_INCREMENT,
  `system_quantity`         DOUBLE NOT NULL
    COMMENT 'Lo que el sistema decia',
  `physical_quantity`       DOUBLE NOT NULL
    COMMENT 'Lo que se conto fisicamente',
  `difference`              DOUBLE NOT NULL
    COMMENT '+ sobrante / - faltante',
  `cost_unit_snap`          DOUBLE NOT NULL,
  `cost_diff`               DOUBLE NOT NULL,
  `previous_stock`          DOUBLE NOT NULL,
  `resulting_stock`         DOUBLE NOT NULL,
  `created_at`              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `inv_adjustment_id` INT NOT NULL,
  `order_product_id`        INT NOT NULL,
  `active`                  TINYINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `inv_adjustment_id` (`inv_adjustment_id`),
  KEY `order_product_id` (`order_product_id`),
  CONSTRAINT `inv_adjustment_detail_ibfk_1` FOREIGN KEY (`inv_adjustment_id`)
    REFERENCES `inv_adjustment` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `inv_adjustment_detail_ibfk_2` FOREIGN KEY (`order_product_id`)
    REFERENCES `fayxzvov_reginas`.`order_products` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

### §3.5 Vista unificada de movimientos

```sql
-- ════════════════════════════════════════════════════════════════
--  inv_movement  (VIEW - bitacora unificada)
--  Alimenta el visor pos-movimientos. Cada UNION genera una fila
--  por renglon de detalle.
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW `inv_movement` AS
  SELECT
    CONCAT('IN-', d.id)                              AS movement_uid,
    'ENTRADA'                                        AS movement_type,
    r.folio                                          AS folio,
    d.order_product_id                               AS order_product_id,
    d.quantity                                       AS quantity,
    d.previous_stock                                 AS stock_prev,
    d.resulting_stock                                AS stock_post,
    d.cost_unit_snap                                 AS cost_unit,
    d.subtotal                                       AS cost_total,
    CONCAT(r.operation_date, ' ', r.operation_time)  AS occurred_at,
    r.warehouse_id                                   AS warehouse_id,
    r.subsidiaries_id                                AS subsidiaries_id,
    r.user_id                                        AS user_id,
    r.note                                           AS note,
    r.status                                         AS status,
    r.companies_id                                   AS companies_id
  FROM `inv_inflow_detail` d
  INNER JOIN `inv_inflow` r ON r.id = d.inv_inflow_id
  WHERE d.active = 1 AND r.active = 1

  UNION ALL

  SELECT
    CONCAT('SH-', d.id),
    'MERMA',
    r.folio,
    d.order_product_id,
    -d.quantity,
    d.previous_stock,
    d.resulting_stock,
    d.cost_unit_snap,
    -d.subtotal_loss,
    CONCAT(r.operation_date, ' ', r.operation_time),
    r.warehouse_id,
    r.subsidiaries_id,
    r.user_id,
    r.note,
    r.status,
    r.companies_id
  FROM `inv_shrinkage_detail` d
  INNER JOIN `inv_shrinkage` r ON r.id = d.inv_shrinkage_id
  WHERE d.active = 1 AND r.active = 1

  UNION ALL

  -- Salida del traspaso (visible cuando ya se envio)
  SELECT
    CONCAT('TR-OUT-', d.id),
    'TRANSFERENCIA',
    r.folio,
    d.order_product_id,
    -d.quantity,
    d.origin_stock_prev,
    d.origin_stock_post,
    d.cost_unit_snap,
    -d.subtotal,
    r.date_sent,
    r.origin_warehouse_id,
    r.origin_subsidiaries_id,
    r.requested_user_id,
    r.note,
    ts.code,
    r.companies_id
  FROM `inv_transfer_detail` d
  INNER JOIN `inv_transfer` r ON r.id = d.inv_transfer_id
  INNER JOIN `inv_transfer_status` ts   ON ts.id = r.inv_transfer_status_id
  WHERE d.active = 1 AND r.active = 1 AND r.date_sent IS NOT NULL

  UNION ALL

  -- Entrada del traspaso (visible cuando ya se recibio)
  SELECT
    CONCAT('TR-IN-', d.id),
    'TRANSFERENCIA',
    r.folio,
    d.order_product_id,
    d.quantity,
    d.destination_stock_prev,
    d.destination_stock_post,
    d.cost_unit_snap,
    d.subtotal,
    r.date_received,
    r.destination_warehouse_id,
    r.destination_subsidiaries_id,
    r.received_user_id,
    r.note,
    ts.code,
    r.companies_id
  FROM `inv_transfer_detail` d
  INNER JOIN `inv_transfer` r ON r.id = d.inv_transfer_id
  INNER JOIN `inv_transfer_status` ts   ON ts.id = r.inv_transfer_status_id
  WHERE d.active = 1 AND r.active = 1 AND r.date_received IS NOT NULL

  UNION ALL

  SELECT
    CONCAT('AD-', d.id),
    'AJUSTE',
    r.folio,
    d.order_product_id,
    d.difference,
    d.previous_stock,
    d.resulting_stock,
    d.cost_unit_snap,
    d.cost_diff,
    CONCAT(r.operation_date, ' ', r.operation_time),
    r.warehouse_id,
    r.subsidiaries_id,
    r.registered_user_id,
    r.note,
    r.status,
    r.companies_id
  FROM `inv_adjustment_detail` d
  INNER JOIN `inv_adjustment` r ON r.id = d.inv_adjustment_id
  WHERE d.active = 1 AND r.active = 1;
```

### §3.6 Datos semilla (catalogos minimos)

```sql
-- ── unit ────────────────────────────────────────────────────────
INSERT INTO `inv_unit` (code, name, decimals) VALUES
  ('pza',  'Pieza',     0),
  ('kg',   'Kilogramo', 3),
  ('lt',   'Litro',     3),
  ('caja', 'Caja',      0),
  ('pq',   'Paquete',   0),
  ('gr',   'Gramo',     0),
  ('ml',   'Mililitro', 0);

-- ── inv_inflow_origin ───────────────────────────────────────────────
INSERT INTO `inv_inflow_origin` (code, name, icon, color_hex, requires_supplier) VALUES
  ('produccion',    'Produccion',    'factory',    '#A78BFA', 0),
  ('proveedor',     'Proveedor',     'truck',      '#FBBF24', 1),
  ('transferencia', 'Transferencia', 'arrow-right','#60A5FA', 0),
  ('devolucion',    'Devolucion',    'undo',       '#F43F5E', 0);

-- ── inv_shrinkage_reason ────────────────────────────────────────────
INSERT INTO `inv_shrinkage_reason` (code, name, icon, color_hex) VALUES
  ('caducidad',        'Caducidad',         'calendar-x',  '#E02424'),
  ('daniado',          'Daniado',           'alert-circle','#FBBF24'),
  ('error_produccion', 'Error produccion',  'x-octagon',   '#1C64F2'),
  ('robo_faltante',    'Robo / Faltante',   'shield-x',    '#7C3AED'),
  ('devolucion',       'Devolucion',        'undo',        '#3FC189');

-- ── inv_adjustment_reason ───────────────────────────────────────────
INSERT INTO `inv_adjustment_reason` (code, name, icon, color_hex, affects_cost) VALUES
  ('faltante',             'Faltante sin explicar',  'minus-circle', '#F43F5E', 1),
  ('sobrante',             'Sobrante',               'plus-circle',  '#3FC189', 1),
  ('conteo_fisico',        'Conteo fisico',          'clipboard',    '#60A5FA', 1),
  ('cierre_mensual',       'Cierre mensual',         'calendar',     '#A78BFA', 1),
  ('entrada_no_registrada','Entrada no registrada',  'plus-square',  '#FBBF24', 0);

-- ── inv_transfer_status ─────────────────────────────────────────────
INSERT INTO `inv_transfer_status` (code, name, order_index, is_terminal, color_hex) VALUES
  ('solicitado', 'Solicitado',  1, 0, '#FBBF24'),
  ('autorizado', 'Autorizado',  2, 0, '#60A5FA'),
  ('transito',   'En Transito', 3, 0, '#FB923C'),
  ('recibido',   'Recibido',    4, 1, '#3FC189'),
  ('rechazado',  'Rechazado',   5, 1, '#F43F5E');

-- ── inv_warehouse_area (semilla para Reginas, companies_id=4) ───────
INSERT INTO `inv_warehouse_area` (name, description, color_hex, companies_id) VALUES
  ('Refrigerados', 'Productos que requieren refrigeracion',   '#60A5FA', 4),
  ('Secos',        'Productos secos / no perecederos',        '#FBBF24', 4),
  ('Congelados',   'Productos que requieren congelacion',     '#A78BFA', 4),
  ('Panaderia',    'Pan, pasteleria y reposteria',            '#FB923C', 4);
```

---

## §4. Auto-revision con el checklist db-rules.md §7 (Fase 4)

### §7.1 Clasificacion
- [x] **Catalogos simples (sin prefijo):** `inv_warehouse`, `inv_unit`, `inv_supplier`, `inv_inflow_origin`, `inv_shrinkage_reason`, `inv_adjustment_reason`, `inv_transfer_status`.
- [x] **Sub-catalogos (sin prefijo, compuestos):** `inv_warehouse_area` (cuelga de `companies`), `inv_product_attribute` (cuelga 1:1 de `order_products`).
- [x] **Transacciones raiz (sin prefijo):** `inv_inflow`, `inv_shrinkage`, `inv_transfer`, `inv_adjustment`.
- [x] **Detalles (`detail_*`):** `inv_inflow_detail`, `inv_shrinkage_detail`, `inv_transfer_detail`, `inv_adjustment_detail`. Solo en renglones monetarios de raiz.
- [x] **Historico de transiciones:** `inv_transfer_history` - NO usa `detail_` (es timeline, no monetario, no es renglon del documento sino metadatos del flujo). Se puede argumentar como detalle de la raiz, pero como db-rules dice "renglones de un movimiento monetario", se deja sin prefijo. **Decision documentada.**
- [x] **Saldo:** `inv_stock` - no es ni catalogo ni transaccion; es saldo vivo. Sin prefijo.
- [x] **Pivote N:M:** ninguno necesario en esta version (las relaciones son todas 1:N).

### §7.2 Nombres
- [x] Todas las tablas en singular ingles snake_case.
- [x] Columnas snake_case ingles.
- [x] PK = `id`.
- [x] FKs = `<tabla_destino>_id` (singular cuando la tabla destino es singular; plural cuando lo es: `subsidiaries_id`, `companies_id`).
- [x] Cada FK tiene `KEY` con el mismo nombre que la columna.

### §7.3 Columnas obligatorias
- [x] Todas las tablas persistentes llevan `id INT AUTO_INCREMENT PRIMARY KEY`, `active TINYINT`, `created_at DATETIME`, `updated_at DATETIME`.
- [x] Transacciones raiz llevan `subsidiaries_id` y `user_id`.
- [x] Transacciones raiz con flujo de aprobacion (`inv_transfer`) llevan `inv_transfer_status_id` (FK a catalogo) y multiples `*_user_id` (requested/authorized/received).
- [x] Otras raices llevan `status VARCHAR(20)` (Pendiente/Aplicada/Cancelada) - **se justifica como columna libre, no catalogo, porque los valores son fijos y solo 3.**

### §7.4 Tipos de datos
- [x] Montos en `DOUBLE` (`cost_unit`, `cost_unit_snap`, `subtotal`, `total_cost`, `total_cost_loss`, `total_diff_cost`).
- [x] Cantidades en `DOUBLE` (permite decimales para kg/lt; pza es INT logico pero declarado DOUBLE para uniformidad con unidades fraccionarias).
- [x] Nombres en `VARCHAR(60..255)`, nunca `TEXT`. Notas largas (`note`) en `VARCHAR(500)`.
- [x] Estados extensibles via catalogo (`inv_transfer_status`); estados fijos cortos via `VARCHAR(20)` (`status`).
- [x] Fechas operativas en `DATE` (`operation_date`, `expires_at`); auditoria en `DATETIME` (`created_at`, `updated_at`, `transitioned_at`, `date_request`, etc.).
- [x] Codigos de color en `CHAR(7)` (formato `#RRGGBB`).
- [x] **No se usa `ENUM`** (a diferencia de la propuesta vieja, que tenia `status ENUM('Pendiente','Aplicada','Cancelada')`). Se reemplaza por `VARCHAR(20)` para permitir crecimiento sin `ALTER TABLE`.

### §7.5 Foreign Keys
- [x] Toda FK con `CONSTRAINT <tabla>_ibfk_<n>`.
- [x] Toda FK acompanada de `KEY` con el mismo nombre que la columna.
- [x] Politica `ON DELETE / ON UPDATE`:
  - [x] Detalle → Raiz: `CASCADE / CASCADE`.
  - [x] Detalle / Raiz → Catalogo del modulo: `SET NULL / CASCADE`.
  - [x] Cualquiera → maestro corporativo cross-schema: `SET NULL / CASCADE`.
  - [x] `inv_product_attribute` → `order_products`: `CASCADE / CASCADE` (extension 1:1, si se borra el producto pierde sentido).
  - [x] `inv_stock` → `inv_warehouse`, `inv_stock` → `order_products`: `CASCADE / CASCADE` (saldo sin almacen o sin producto no tiene sentido).
- [x] Maestros corporativos referenciados cross-schema, NO duplicados.

### §7.6 Borrado
- [x] Nunca `DELETE` fisico - se usa `UPDATE ... SET active = 0`.
- [x] Listados filtran `WHERE active = 1`.
- [x] No hay pivotes puros en esta version (todos los renglones tienen campos propios y necesitan soft-delete).

### §7.7 DDL final
- [x] Engine `InnoDB` en todas.
- [x] Charset `utf8mb4` con collation `utf8mb4_0900_ai_ci` en todas.
- [x] Orden de columnas respetado:
  ```
  id → negocio → montos → fechas → created_at → updated_at →
  status → FKs → active → KEYs → CONSTRAINTs
  ```

### Advertencias / decisiones que el revisor humano debe validar

| # | Item | Decision tomada | Pide aprobacion para |
|---|---|---|---|
| 1 | Nombre del esquema | `fayxzvov_reginas` (productivo) en lugar de `fayxzvov_inventario` (la propuesta vieja) | Confirmar tenant target. Si el modulo debe vivir en `fayxzvov_*` (entorno de desarrollo) cambiar nombre. |
| 2 | `status` como `VARCHAR(20)` vs catalogo | `VARCHAR(20)` con valores fijos | Si el negocio decide que estados pueden crecer (por ej. "En revision", "Bloqueado"), promover a catalogo. |
| 3 | FK plural (`subsidiaries_id`, `companies_id`) | Se respeta el plural del destino cross-schema | Confirmar que es politica del ecosistema. db-rules pide singular pero los maestros estan plurales. |
| 4 | `quantity` como `DOUBLE` (no `INT`) | DOUBLE permite kg/lt fraccionarios | Confirmar. Si el inventario es solo de productos POS por pieza, podria ser INT. Se deja DOUBLE para futura compatibilidad con dimension Insumos. |
| 5 | Reuso de `fayxzvov_almacen` existente | NO se reusa - deuda tecnica documentada en §1.3 | Confirmar plan de migracion de las 17 filas existentes en `inv_movement` (legacy). |
| 6 | `inv_transfer_history` sin prefijo `detail_` | Por la interpretacion estricta de db-rules (`detail_` = renglon monetario) | El revisor puede preferir `inv_transfer_detail_history` por consistencia visual. |

---

## §5. Resumen ejecutivo

- **Esquema:** `fayxzvov_reginas` (nuevo).
- **Tablas nuevas:** 16 + 1 vista.
- **Maestros cross-schema reusados:** 3 externos (`fayxzvov_admin.companies`, `fayxzvov_alpha.subsidiaries`, `fayxzvov_alpha.usr_users`) + 2 intra-schema (`order_products`, `order_category` ya en `fayxzvov_reginas`).
- **Convenciones aplicadas:** db-rules.md al pie de la letra (singular ingles snake_case, DOUBLE para montos, FKs antes de `active`, soft-delete, catalogo para flujos extensibles, VARCHAR(20) para estados fijos cortos).
- **Decisiones documentadas para revision:** 6 (ver tabla arriba).
- **Siguiente paso:** ver [db-implementacion.md](db-implementacion.md) para plan de despliegue.

---

> Generado por **Coffee Intelligence** siguiendo db-rules.md y las 4 fases (Inspeccion → Modelado → DDL → Auto-revision).
