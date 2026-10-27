# Plan de implementacion de base de datos — modulo Inventarios

> **Producto:** Huubie / app/inventarios
> **Documento gemelo:** [propuesta-db.md](propuesta-db.md) (DDL completo)
> **Esquema recomendado:** `fayxzvov_reginas` (nuevo, dedicado al modulo)
> **Estado:** propuesto - pendiente de aprobacion del data steward para ejecutar el DDL.

---

## 1. TL;DR

Crear **16 tablas nuevas + 1 vista** con prefijo `inv_*` **dentro del schema POS del tenant** (`fayxzvov_reginas` para Reginas, replicable a `[prefijo]_[posdb]` por subscripcion). Las nuevas tablas conviven con `order`, `order_products`, `order_category`. Reusar via FK cross-schema los maestros corporativos `fayxzvov_admin.companies`, `fayxzvov_alpha.subsidiaries`, `fayxzvov_alpha.usr_users`. NO se reusa el esquema `fayxzvov_almacen` existente porque viola db-rules y solo cubre 1 de los 4 tipos de evento que necesita el modulo. No existe catalogo RRHH para Reginas; todas las atribuciones de persona usan `usr_users`.

---

## 2. Que se inspecciono y que se encontro

### 2.1 Bases que ya existen en MySQL local (snapshot 2026-05-22)

```
SHOW DATABASES;
```

| Base | Rol en el ecosistema | Tablas relevantes |
|---|---|---|
| **`fayxzvov_admin`** | Maestros corporativos | `companies`, `customers`, `modules`, `users` |
| **`fayxzvov_alpha`** | Sucursales + usuarios Huubie | `subsidiaries`, `usr_users`, `usr_rols`, `usr_user_subsidiaries`, `method_pay`, `status_process` |
| **`fayxzvov_reginas`** | Tenant Reginas - POS y pedidos | `order_products` (97 productos), `order_category`, `order`, `daily_closure`, `cash_shift`, `closure_payment`, etc. |
| **`fayxzvov_erp`** | Legacy ERP | `udn`, `usuarios`, `perfiles`, `permisos`, `directorios`, `modulos` |
| **`fayxzvov_rrhh`** | Placeholder de RRHH (Reginas) | **Schema VACIO**. Reservado, sin tablas creadas. |
| **`fayxzvov_mtto`** | Mantenimiento (Reginas) | `mtto_almacen`, `mtto_almacen_area`, `mtto_proveedores`, etc. — patron de referencia para inventarios. |
| **`fayxzvov_almacen`** | **Esquema parcial de inventario legacy** | 8 tablas: `product`, `product_groups`, `presentations`, `areas`, `supplier`, `movement_type`, `inventory_movement`, `inventory_movement_detail`. Se respeta como historico, no se reusa. |
| `rfwsmqex_*` (45 bases) | Familia de OTRO tenant (GVSL) | No tiene relacion con Reginas. |

### 2.2 Estado de `fayxzvov_almacen` (esquema legacy)

Inspeccion via `SHOW CREATE TABLE`:

```
fayxzvov_almacen
├── product                     (catalogo propio - 17 filas, duplicado parcial de order_products)
├── product_groups              (sub-catalogo - 4 filas: Tienda Flores, Tienda Cafe, etc.)
├── presentations               (catalogo - 8 filas: Pieza, Kilogramo, Litro, 250 gr, ...)
├── areas                       (catalogo - 9 filas: Restaurant, Cocina, Amenidades, Cafe, ...)
├── supplier                    (catalogo)
├── movement_type               (catalogo - SOLO 2 valores: Entrada / Salida)
├── inventory_movement          (transaccion raiz - 17 filas)
└── inventory_movement_detail   (renglones - 41 filas)
```

**Violaciones de db-rules detectadas:**

| Violacion | Tabla | Severidad |
|---|---|---|
| Collation `utf8mb4_unicode_ci` en lugar de `utf8mb4_0900_ai_ci` | Todas | Alta - rompe joins con `rfwsmqex_*` |
| `DECIMAL(12,2)` para `cost` y `price` | `product` | Alta - convencion de la casa es `DOUBLE` |
| Plural (`areas`, `presentations`) | `areas`, `presentations` | Media |
| Falta `updated_at` | Todas | Media |
| FK colocadas al inicio (despues de `id`) | `product`, `inventory_movement` | Baja |
| Solo 2 `movement_type` (necesita 7: Entrada/Salida POS/Salida Pedido/Merma/Transferencia/Ajuste/Devolucion) | `movement_type` | Alta funcional |
| Una sola transaccion raiz (`inventory_movement`) en lugar de 4 (entradas/mermas/traspasos/ajustes con folios distintos) | Diseno | Alta funcional |
| `cantidad / stock` como `INT` | `inventory_movement_detail`, `product` | Media - bloquea dimension Insumos (kg/lt fraccionarios) |
| Sin tabla `stock` saldo vivo (se reconstruye de movimientos) | Falta | Alta funcional |
| Sin timeline para traspasos | Falta | Alta funcional |
| Sin `warehouse` (tabla de almacenes); `areas` mezcla concepto fisico (Refrigerados) y sucursal (Restaurant) | Diseno | Alta |

**Conclusion:** el esquema actual es un prototipo de 2 niveles que no escala al disenio del modulo. Migrar es mas costoso que reescribir.

---

## 3. Decision: crear `fayxzvov_reginas` (nuevo)

### 3.1 Por que NO reusar `fayxzvov_almacen`

1. **Solo cubre 1 de los 4 eventos.** El modulo necesita `inv_inflow`, `inv_shrinkage`, `inv_transfer`, `inv_adjustment` con folios prefijados distintos (ENT-/M-/TRA-/AJU-). `fayxzvov_almacen` los aplana en una sola tabla generica.
2. **Tipo de cantidad incorrecto.** `INT` no permite dimension Insumos (kg/lt). Cambiar a DOUBLE implica ALTER en produccion con conversion de datos.
3. **Sin saldo vivo.** No hay tabla `stock`; se reconstruye sumando movimientos. Para 17 filas funciona, para 100K no.
4. **Sin timeline de traspaso.** El flujo Solicitado/Autorizado/En Transito/Recibido necesita historico - no existe.
5. **Sin `warehouse`.** `areas` mezcla concepto fisico y de sucursal.

### 3.2 Por que NO crear un schema separado (`fayxzvov_inventario`)

La propuesta vieja `docs/propuesta-bd.md` proponia un schema dedicado `fayxzvov_inventario`, pero:
- Usa `ENUM` para `status` (anti-patron db-rules §6).
- FKs antes de `active` (orden incorrecto §3.1).
- Algunas columnas en orden incorrecto.
- Separar el schema no aporta valor: las nuevas tablas ya pueden convivir con `order_products` y `order_category` dentro de `fayxzvov_reginas`, evitando FK cross-schema dentro del mismo tenant.

**`propuesta-db.md` (nueva) corrige todos esos puntos y consolida las tablas dentro de `fayxzvov_reginas` con prefijo `inv_*`.**

### 3.3 Por que `fayxzvov_reginas` con prefijo `inv_*`

| Razon | Detalle |
|---|---|
| **Modelo replicable por subscripcion** | Cada tenant tiene su propio prefijo (`fayxzvov_*` = Reginas, `rfwsmqex_*` = GVSL, `hgpqgijw_*` = otro). Las tablas del modulo viven dentro del schema POS del tenant. Si entra otro cliente, se replica el DDL bajo `[prefijo]_[posdb].inv_*`. |
| **Patron ya en uso** | El modulo de mantenimiento del mismo tenant vive en `fayxzvov_mtto` con prefijo `mtto_*`. Inventarios sigue el mismo patron pero desde el POS del tenant. |
| **Cohesion con el POS** | `order`, `order_products`, `order_category` ya viven en `fayxzvov_reginas`. Las nuevas `inv_*` conviven sin FK cross-schema dentro del tenant. |
| **Permite coexistir con `fayxzvov_almacen`** | El legacy queda como historico congelado; los nuevos eventos van al schema POS. |

### 3.4 Que se reusa cross-schema (no se duplica)

| Tabla externa | Esquema | Tipo | Decision |
|---|---|---|---|
| `companies` | `fayxzvov_admin` | Maestro corporativo | FK `companies_id`. |
| `subsidiaries` | `fayxzvov_alpha` | Maestro corporativo | FK `subsidiaries_id`. |
| `usr_users` | `fayxzvov_alpha` | Usuarios Huubie | FK `user_id`. **Hoy es la unica fuente de personas para Reginas** (no existe catalogo RRHH separado). |
| `order_products` | `fayxzvov_reginas` | Catalogo POS | FK `order_product_id` + extension via `inv_product_attribute` (1:1). **97 productos reales. Vive en el mismo schema que las nuevas tablas `inv_*`.** |
| `order_category` | `fayxzvov_reginas` | Categorias POS | Se consume via JOIN cuando se necesita; no se duplica. |

> **Decision tomada:** las nuevas tablas viven dentro de `fayxzvov_reginas` con prefijo `inv_*`. Si entra otro tenant (`[prefijo]_*`), se replica el DDL bajo `[prefijo]_[posdb].inv_*` con el mismo contrato.

---

## 4. Plan de despliegue (paso a paso)

### Fase 0 - Pre-despliegue (decision humana)

- [ ] Validar el nombre del esquema con el data steward (`fayxzvov_reginas` vs alternativa).
- [ ] Confirmar tenant target (¿solo Reginas `companies_id=4`, o multi-tenant?).
- [ ] Confirmar que se conservan las 17 filas legacy de `fayxzvov_almacen.inventory_movement` como historico congelado (no migran).
- [ ] Revisar las 6 decisiones documentadas en `propuesta-db.md` §4.

### Fase 1 - Creacion del esquema y catalogos (DDL safe)

```sql
-- 1.1 Crear esquema
CREATE DATABASE IF NOT EXISTS `fayxzvov_reginas`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE `fayxzvov_reginas`;

-- 1.2 Ejecutar §3.2 de propuesta-db.md
--     (inv_warehouse_area -> inv_warehouse -> inv_unit -> inv_supplier -> inv_product_attribute ->
--      inv_inflow_origin → inv_shrinkage_reason → inv_adjustment_reason → inv_transfer_status)

-- 1.3 Ejecutar §3.6 de propuesta-db.md (datos semilla)
```

**Validacion post-paso:**
```sql
SHOW TABLES;
-- Debe listar 9 tablas: inv_warehouse_area, inv_warehouse, inv_unit, inv_supplier,
--                       inv_product_attribute, inv_inflow_origin, inv_shrinkage_reason,
--                       inv_adjustment_reason, inv_transfer_status

SELECT COUNT(*) FROM inv_unit;              -- 7 (pza/kg/lt/caja/pq/gr/ml)
SELECT COUNT(*) FROM inv_inflow_origin;     -- 4
SELECT COUNT(*) FROM inv_shrinkage_reason;  -- 5
SELECT COUNT(*) FROM inv_adjustment_reason; -- 5
SELECT COUNT(*) FROM inv_transfer_status;   -- 5
```

### Fase 2 - Tabla inv_stock + eventos raiz + detalles

```sql
-- 2.1 Crear tabla inv_stock (§3.3)
-- 2.2 Crear inv_inflow + inv_inflow_detail (§3.4.1)
-- 2.3 Crear inv_shrinkage + inv_shrinkage_detail (§3.4.2)
-- 2.4 Crear inv_transfer + inv_transfer_detail + inv_transfer_history (§3.4.3)
-- 2.5 Crear inv_adjustment + inv_adjustment_detail (§3.4.4)
```

**Validacion post-paso:**
```sql
SHOW TABLES;
-- Debe listar las 9 anteriores + inv_stock + 4 raices + 4 detalles + 1 history = 19

-- Verificar FKs cross-schema
SELECT
  TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_SCHEMA, REFERENCED_TABLE_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'fayxzvov_reginas'
  AND REFERENCED_TABLE_SCHEMA IS NOT NULL
  AND REFERENCED_TABLE_SCHEMA <> 'fayxzvov_reginas';
-- Deben aparecer FKs a fayxzvov_admin.companies, fayxzvov_alpha.subsidiaries,
-- fayxzvov_alpha.usr_users, fayxzvov_reginas.order_products
```

### Fase 3 - Vista unificada

```sql
-- 3.1 Crear inventory_movement VIEW (§3.5)
```

**Validacion:**
```sql
SHOW FULL TABLES IN fayxzvov_reginas WHERE TABLE_TYPE LIKE 'VIEW';
-- inventory_movement debe aparecer

SELECT COUNT(*) FROM inventory_movement;
-- 0 al principio; ira creciendo al registrar eventos
```

### Fase 4 - Seed inicial de almacenes por sucursal

Para cada sucursal activa de Reginas (`SELECT id, name FROM fayxzvov_alpha.subsidiaries WHERE companies_id = 4 AND active = 1`), crear al menos un `inv_warehouse` general:

```sql
-- Inserta un almacen general por cada sucursal activa de Reginas (companies_id = 4).
-- Hoy son 3: Reginas guadalupe (id=4), Regina´s cuarta (id=22), Reginas kafeto (id=25).
INSERT INTO `fayxzvov_reginas`.`inv_warehouse`
  (name, address, is_default_general, inv_warehouse_area_id, subsidiaries_id, companies_id)
SELECT
  CONCAT('Almacen General - ', s.name),
  s.ubication,
  1,                                  -- is_default_general
  (SELECT id FROM fayxzvov_reginas.inv_warehouse_area WHERE code = 'secos' LIMIT 1),
  s.id,
  s.companies_id
FROM fayxzvov_alpha.subsidiaries s
WHERE s.companies_id = 4 AND s.active = 1;
```

**Validacion:**
```sql
SELECT COUNT(*) FROM inv_warehouse WHERE is_default_general = 1 AND companies_id = 4;
-- 3 (uno por sucursal activa de Reginas: guadalupe, cuarta, kafeto)
```

### Fase 5 - Seed inicial de `inv_product_attribute` desde `order_products`

```sql
-- Crear extension 1:1 para los 97 productos de Reginas
INSERT INTO `fayxzvov_reginas`.`inv_product_attribute`
  (sku, cost_unit, stock_min, stock_max, shelf_life_days,
   order_product_id, unit_id, companies_id)
SELECT
  CONCAT('RG-', LPAD(p.id, 3, '0')),  -- SKU autogenerado
  COALESCE(p.price * 0.55, 0),        -- costo estimado = 55% del precio
  8,                                   -- stock_min default
  40,                                  -- stock_max default
  CASE c.name
    WHEN 'Pasteleria' THEN 5
    WHEN 'Postres'    THEN 7
    WHEN 'Galletas'   THEN 30
    WHEN 'Panaderia'  THEN 3
    ELSE 14
  END,
  p.id,
  (SELECT id FROM fayxzvov_reginas.inv_unit WHERE code = 'pza' LIMIT 1),
  p.companies_id
FROM fayxzvov_reginas.order_products p
LEFT JOIN fayxzvov_reginas.order_category c ON c.id = p.category_id
WHERE p.companies_id = 4 AND p.active = 1;
```

**Validacion:**
```sql
SELECT COUNT(*) FROM inv_product_attribute;
-- ~97 (uno por producto activo de Reginas)
```

### Fase 6 - Seed inicial de `inv_stock` (saldos en cero)

```sql
-- Crear un saldo en 0 para cada (producto x almacen general de su sucursal)
INSERT INTO `fayxzvov_reginas`.`inv_stock`
  (quantity, order_product_id, warehouse_id, companies_id)
SELECT
  0,
  p.id,
  w.id,
  p.companies_id
FROM fayxzvov_reginas.order_products p
JOIN fayxzvov_reginas.inv_warehouse w
  ON w.subsidiaries_id = p.subsidiaries_id
 AND w.is_default_general = 1
WHERE p.companies_id = 4 AND p.active = 1;
```

> Como los 97 productos de Reginas hoy estan asignados a `subsidiaries_id = 4` (Reginas guadalupe), este JOIN crea **97 filas** de saldo (solo en el almacen general de Guadalupe). Si el catalogo se replica a las 3 sucursales (Guadalupe, Cuarta, Kafeto), el conteo sera **97 x 3 = 291**. Ver Riesgo #3 antes de seed masivo.

**Validacion:**
```sql
SELECT COUNT(*) FROM inv_stock WHERE companies_id = 4;
-- 97 si solo Guadalupe tiene el catalogo, o 291 si se replico a las 3 sucursales.
```

### Fase 7 - Conectar el backend

- Crear `app/inventarios/mdl/mdl-inventarios.php` con queries tipadas a `fayxzvov_reginas.*`.
- Crear `app/inventarios/ctrl/ctrl-inventarios.php` con el dispatch por `opc` (patron coffeeSoft).
- En cada `src/js/*.js` del modulo, reemplazar el comentario `// MODO FAKE — cuando exista el backend usar: fn_ajax({ opc: 'X' }, api).then(...)` por la llamada real.
- Conservar los `SAMPLE_*` como fallback para desarrollo offline.

---

## 5. Riesgos y mitigaciones

| # | Riesgo | Severidad | Mitigacion |
|---|---|---|---|
| 1 | El esquema target real no es `fayxzvov_reginas` | Alta | Confirmar con data steward antes de Fase 1. Cambiar nombre es trivial. |
| 2 | Sucursales productivas tienen `companies_id != 4` (multi-tenant) | Media | Todas las inserciones de seed estan parametrizadas por `companies_id`. Replicar Fase 4/5/6 por tenant. |
| 3 | `order_products.subsidiaries_id` apunta a una sucursal especifica - un producto puede vivir en multiples sucursales? | Media | Hoy 97 productos estan a `subsidiaries_id=4` (la sucursal id=4 = Reginas guadalupe, tenant Reginas `companies_id=4`). El esquema permite `inv_stock` por almacen, y un producto puede tener saldo en N almacenes. La pregunta es si el catalogo es por sucursal o por empresa. Consultar antes de seed. |
| 4 | Triggers para mantener `inv_stock` consistente | Alta | NO se proponen triggers en SQL. Se mantiene `inv_stock` desde la capa de servicio PHP en transacciones explicitas (`mdl-inventarios.php`). Razon: los snapshots `previous_stock`/`resulting_stock` ya quedan en los detalles y son la fuente de auditoria. Si en el futuro se quieren triggers, agregarlos no rompe el contrato. |
| 5 | Renombrar `pos-*.php` a `inv-*.php` (dimension dual) | Baja | El esquema es scope-agnostico. Las tablas paralelas para Insumos (Fase 2 futura) seran `supply_*` siguiendo el plan canonico. |
| 6 | Performance del VIEW `inventory_movement` con volumen alto | Media | A 100K renglones, UNION ALL de 4 tablas con JOIN funciona. A 1M+, materializar como tabla con triggers o job nocturno. No es problema en el corto plazo. |
| 7 | Latencia cross-schema (FK que cruzan a `fayxzvov_*`) | Media | Validar que MySQL puede mantener FK cross-schema dentro del mismo servidor. Si el deploy mueve los esquemas a servidores distintos, las FK explicitas hay que removerlas y validar a nivel de aplicacion. |
| 8 | Migracion futura de `fayxzvov_almacen.inventory_movement` (17 filas legacy) | Baja | Quedan como historico congelado. Si se quieren copiar, mapear: `movement_type=1` → `inv_inflow`, `movement_type=2` → `inv_shrinkage` o `inv_adjustment` segun contexto. |

---

## 6. Permisos / GRANTs

```sql
-- Conceder al usuario del modulo lectura/escritura sobre el esquema nuevo
GRANT SELECT, INSERT, UPDATE ON `fayxzvov_reginas`.* TO 'huubie_app'@'%';
GRANT SELECT, SHOW VIEW ON `fayxzvov_reginas`.* TO 'huubie_app'@'%';

-- Permitir lectura cross-schema sobre los maestros corporativos
GRANT SELECT ON `fayxzvov_admin`.`companies` TO 'huubie_app'@'%';
GRANT SELECT ON `fayxzvov_alpha`.`subsidiaries` TO 'huubie_app'@'%';
GRANT SELECT ON `fayxzvov_alpha`.`usr_users` TO 'huubie_app'@'%';
GRANT SELECT ON `fayxzvov_reginas`.`order_products` TO 'huubie_app'@'%';
GRANT SELECT ON `fayxzvov_reginas`.`order_category` TO 'huubie_app'@'%';

FLUSH PRIVILEGES;
```

---

## 7. Rollback

```sql
-- Si algo sale mal en Fase 1-3, rollback es trivial:
DROP DATABASE IF EXISTS `fayxzvov_reginas`;
```

(Las FK cross-schema apuntan al esquema nuevo; al borrarlo todos los CONSTRAINT desaparecen sin afectar `fayxzvov_*`.)

Si el rollback se necesita despues de Fase 4-6 (con datos seed), se pierden los IDs de `inv_warehouse`, `inv_product_attribute` y `inv_stock`. Volver a ejecutar Fase 4-6 regenera los registros pero con IDs distintos.

---

## 8. Checklist final del data steward

- [ ] Confirmar nombre del esquema (`fayxzvov_reginas` u otro).
- [ ] Confirmar `companies_id` target (Reginas = 4? otros tenants?).
- [ ] Confirmar que se mantiene `fayxzvov_almacen` como historico congelado (no migra).
- [ ] Confirmar politica de FK cross-schema (¿quedan o se gestionan a nivel de aplicacion?).
- [ ] Confirmar las 6 decisiones documentadas en `propuesta-db.md` §4.
- [ ] Aprobar ejecucion de Fase 1.
- [ ] Aprobar ejecucion de Fase 2-3.
- [ ] Aprobar seed (Fase 4-6).
- [ ] Aprobar conexion del backend (Fase 7).

---

## 9. Resumen ejecutivo

**Recomendacion:** crear `fayxzvov_reginas` con las 16 tablas + 1 vista definidas en `propuesta-db.md`. Reusar via FK cross-schema los maestros corporativos. No se reusa `fayxzvov_almacen` (esquema parcial con deuda tecnica) - queda como historico congelado.

**Por que es la opcion correcta:**
1. Respeta la convencion productiva `rfwsmqex_*` del tenant Reginas.
2. Cumple db-rules.md al pie de la letra (DOUBLE para montos, FKs antes de active, soft-delete, catalogo para flujos extensibles, sin ENUM).
3. Aisla el dominio inventarios para versionado/respaldo independiente.
4. Permite la dimension Insumos futura (Fase 2) sin romper nada.
5. Mantiene los 97 productos reales del POS via FK 1:1 (`inv_product_attribute`) en lugar de duplicarlos.
6. Cubre los 4 tipos de evento (inflow/shrinkage/transfer/adjustment) con folios propios prefijados (ENT-/M-/TRA-/AJU-).
7. Tiene `inv_stock` saldo vivo + `inv_transfer_history` timeline - lo que `fayxzvov_almacen` no tiene.

**Riesgo principal:** confirmar nombre del esquema con el data steward. Una vez confirmado, el despliegue es lineal (7 fases, cada una validable independientemente).

---

> Generado por **Coffee Intelligence**.
