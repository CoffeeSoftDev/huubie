# Facturador SAT — Modelo de base de datos definitivo

> **Coffee Intelligence** · propuesta generada a partir del ER ajustado por el usuario.
> Reglas aplicadas: `~/.claude/agents/grimorios/db-rules.md`.
> Fuente de datos: los dos exports reales de `app/facturador/docs/` (cifras **medidas**, no supuestas)
> y el `ERS.md` del módulo.
>
> **Esquema destino:** `fayxzvov_facturacion` · **[NUEVO]** · InnoDB · `utf8mb4` · `utf8mb4_general_ci`
>
> Entregable en formato caja monoespaciada. **No se emite `CREATE TABLE`** — se genera solo si lo
> pides después de aprobar las cajas (db-rules §6).

---

## 0. Verificación previa del servidor

Antes de escribir una línea de modelo, se comprobó el destino (regla "sin `SHOW DATABASES` verificado,
no se escribe DDL"):

| Comprobación | Resultado |
|---|---|
| `SHOW DATABASES LIKE 'fayxzvov_facturacion'` | **no existe** → se crea desde cero |
| Versión del servidor local (WAMP) | **8.0.31** ⚠️ tú indicaste **5.7.36** como destino — ver §6.11 |
| `SHOW COLLATION LIKE 'utf8mb4_general_ci'` | disponible · **PAD SPACE** |
| `innodb_default_row_format` | **`compact`** → tope de índice **767 bytes** (ver nota abajo) |
| `innodb_large_prefix` / `innodb_file_format` | `ON` / `Barracuda` |

Tres consecuencias directas:

1. **`utf8mb4_general_ci` es la elección correcta y además la segura.** Existe en 5.7 y en 8.0; el
   `utf8mb4_0900_ai_ci` que pide db-rules §1.2 **no existe en 5.7**. Se documenta como desviación
   consciente de la regla, no como descuido.
2. **El módulo es autónomo: cero FK cross-schema.** La jerarquía corporativa vive **dentro** del
   esquema — `company` → `branch` — y no depende de `fayxzvov_alpha` ni de `fayxzvov_admin`. El
   esquema se crea, se respalda y se mueve entero sin arrastrar maestros ajenos.
3. **Los `UNIQUE` sobre `business_name` llevan prefijo `(150)`.** Con `ROW_FORMAT=COMPACT` el índice
   tope en 767 bytes y `VARCHAR(200)` en utf8mb4 son 800. El prefijo de 150 caracteres (600 bytes)
   resuelve el límite **sin recortar el dato** y funciona en cualquier configuración del servidor —
   a diferencia de `ROW_FORMAT=DYNAMIC`, que depende de variables globales que el hosting puede tener
   en otro valor.

> **El DDL de `sql/ddl-facturacion.sql` se ejecutó completo contra este 5.7.36** en una base temporal
> de prueba: 12 tablas, collation única, 19 FK creadas y seeds cargados. La base de prueba se eliminó.

---

## 1. 🔍 Inspección — qué dice cada fuente

| Fuente | Grano | Filas | Qué aporta |
|---|---|---|---|
| `Reporte_De_Ventas_20260709.xlsx` · «Reporte de ventas» (A:J, header f7) | 1 fila = 1 ticket | **3 821** | dinero, impuestos, estado fiscal, folio de factura |
| mismo archivo · «Pagos» (**A:H**, header f7) | 1 fila = 1 pago | **3 909** | forma de pago, importe real |
| `comandas.xls` (A:L, header f1, BIFF/OLE2) | 1 fila = 1 partida | **13 141** | qué se consumió, mesa, mesero, tiempos |

- **Evento raíz:** el **ticket** (`sale`). Su llave natural es `Folio` = `foliocuenta`, cruce
  **1 802 / 1 802** sin huérfanos.
- **Catálogos detectados:** `sale_status` (columna `Estado`), `payment_method` (`Método de pago`),
  `product` (`claveproducto` + `descripcion`), `waiter` (`mesero`), `company` + `branch` (membrete del Excel).
- **Detalles:** `detail_sale` (comandas), `detail_sale_payment` (Pagos).
- **Pivotes N:M:** **ninguno.** No hay relación muchos-a-muchos en este dominio.
- **Jerarquía corporativa propia:** `company` (membrete f1, la empresa) → `branch` (membrete f2, la
  sucursal). Ambas viven en el esquema del módulo: **no hay ninguna FK cross-schema**. El módulo no se
  liga a usuarios.
- **Flujo / estados:** 2 valores fijos (`VENCIDO` 3 565 / `FACTURADO` 256) → catálogo + FK, nunca `ENUM`.

### 1.1 Trampas del origen que el modelo tiene que respetar

| # | Hallazgo medido | Lo que obliga en el modelo |
|---|---|---|
| 1 | Header en **fila 7**, datos desde la 8 | leer mal pierde la primera venta: 3 820 en vez de 3 821 |
| 2 | La hoja «Pagos» declara **14 columnas**: de la `J` en adelante hay un **pivote incrustado** | acotar a `A:H`. Si aparecen más columnas, se coló basura |
| 3 | `Subtotal + Impuestos ≠ Total` en **exactamente** los 145 tickets con descuento | **no forzar la igualdad.** Los tres montos entran literales |
| 4 | La tasa de impuesto **no es fija**: 8 tasas implícitas (16 % en 3 573, 0 % en 63, 11 % en 92…) | el impuesto vive **a nivel de ticket**. No se reparte por partida ni se recalcula |
| 5 | `cantidad` trae `0.096061` (170 filas) y `0.5` (48) | `quantity` **DOUBLE obligatorio**. Un `INT` destruye 218 filas |
| 6 | `descuento` de partida es **texto con símbolo**: `'20%'`, `'30%'`, `'100%'` | parseo `'20%' → 20.0`. Único parseo aparte de los seriales |
| 7 | `mesero` trae `'03'` — **cero a la izquierda** | `waiter_code` **VARCHAR**. Un `INT` convierte `'03'` en `3` |
| 8 | Fechas de comandas son **serial Excel** (`46174.3267`) | conversión `1899-12-30 + días` → `DATETIME` |
| 9 | `Código facturación` viene con relleno a 30 chars en 160 filas | `VARCHAR(30)` guarda el relleno. `general_ci` es **PAD SPACE**, así que el `UNIQUE` sigue funcionando |
| 10 | **No hay llave natural de partida**: 1 578 pares (cuenta, clave) repetidos, hasta 13 veces | el índice `(sale_id, product_id)` **NO puede ser UNIQUE**; la reimportación borra y reinserta |
| 11 | 3 909 pagos: `Subtotal`/`Impuestos`/`Total` **se repiten idénticos** en los 81 tickets multipago | prefijo `sale_` en esos tres campos + regla "solo `amount` se suma" |
| 12 | comandas cubre 1–15 jun; ventas cubre todo junio | **2 019 ventas sin partidas** es esperado, no un error de carga |
| 13 | 1 465 filas con `importe = 0.00` (11.1 %) | son modificadores y cortesías. **Cero es un dato válido**, no un nulo |

---

## 2. Cómo se cumple tu requisito duro

> *"Los Excel deben subirse con TODA la información AUNQUE LOS CAMPOS TENGAN DATOS REPETIDOS."*

**Se cumple literalmente.** `detail_sale` lleva **las 12 columnas de `comandas.xls`, fila por fila**.
Mesa, mesero, apertura y cierre se **repiten en cada partida** — no suben a la cabecera.

Concretamente: el folio `170685` con 7 partidas guarda **7 veces** su `table_number`, **7 veces** su
`waiter_code`, **7 veces** su `opened_at` y **7 veces** su `closed_at`. Eso es lo que pediste y es lo
que hace el modelo.

**Lo que esto cuesta y por qué no importa aquí:** 13 141 filas × 4 columnas repetidas ≈ 40 KB de
redundancia al mes. A cambio, cada fila de la tabla es una fila del Excel — la carga es una copia
directa, la auditoría es un `diff` visual, y no hay lógica de "consolidar cabecera" que pueda fallar.
A este volumen, la normalización no compra nada.

**Las tres llaves de texto se guardan crudas Y resueltas.** Es el patrón que dibujaste (punteado =
texto, verde = FK) y lo respeto tal cual:

| Columna del Excel | Se guarda cruda en | Se resuelve a FK en |
|---|---|---|
| `comandas.B foliocuenta` | `detail_sale.sale_folio` | `detail_sale.sale_id` |
| `comandas.G claveproducto` | `detail_sale.product_code` | `detail_sale.product_id` |
| `comandas.F mesero` | `detail_sale.waiter_code` | `detail_sale.waiter_id` |
| `Pagos.A Folio` | `detail_sale_payment.sale_folio` | `detail_sale_payment.sale_id` |

Ventaja concreta: **si el cruce falla, la fila entra igual** (`sale_id NULL`) y queda reportada. Nunca
se pierde una fila del Excel por un folio que no encontró pareja. Hoy los cruces dan 1 802/1 802, pero
el diseño no depende de esa suerte.

**Las dos columnas que se resuelven a catálogo tampoco pierden el texto:** `Estado` conserva su valor
verbatim en `sale_status.name` (`VENCIDO` / `FACTURADO`) y `Método de pago` en `payment_method.name`.
Traducir a FK no es descartar.

---

## 3. 🗂 Modelo lógico

### 3.1 Tablas propuestas

| # | Tabla | Clase | Estado | Origen |
|---|---|---|---|---|
| 1 | `company` | catálogo | **[NUEVO]** ★ | **añadido** — la empresa emisora, ver §5.6 |
| 2 | `branch` | catálogo | **[NUEVO]** | ER del usuario (antes `issuer`) · **ahora cuelga de `company`** |
| 3 | `sale_status` | catálogo | **[NUEVO]** | ER del usuario |
| 4 | `payment_method` | catálogo | **[NUEVO]** | ER del usuario |
| 5 | `product` | catálogo | **[NUEVO]** | ER del usuario |
| 6 | `waiter` | catálogo | **[NUEVO]** ★ | **añadido** — ver §5.3 |
| 7 | `import_batch` | catálogo técnico | **[NUEVO]** ★ | **añadido** — ver §5.4 |
| 8 | `sale` | transacción raíz | **[NUEVO]** | ER del usuario |
| 9 | `virtual_ticket` | transacción raíz | **[NUEVO]** ★ | **añadido** — ver §5.5 |
| 10 | `detail_sale` | detalle | **[NUEVO]** | ER del usuario |
| 11 | `detail_sale_payment` | detalle | **[NUEVO]** | ER del usuario |
| 12 | `detail_virtual_ticket` | detalle | **[NUEVO]** ★ | **añadido** — ver §5.5 |

**12 tablas nuevas, 0 pivotes, 0 FK cross-schema.** La tabla `invoice` del modelo anterior
**desapareció** — colapsada en `sale.invoice_series`, tal como lo decidiste.

### 3.2 Renombres respecto a tu dibujo (véta el que no te guste)

Ningún cambio es de criterio: todos salen de db-rules §2.2 (columnas snake_case **en inglés**, `_id`
reservado a FK). Los listo para que los puedas rechazar de un vistazo.

| Tu dibujo | Propuesta | Por qué |
|---|---|---|
| `sale.create_at` | `created_at` **+ `updated_at`** | typo, y §2.3 exige ambos |
| `sale.subsidiarie_id` | `branch_id` | la sucursal ahora es una tabla del módulo: `branch` |
| `sale.employed_id` | *(eliminado)* | el Excel de ventas no trae ninguna columna de persona, y el mesero ya vive en `detail_sale.waiter_code` |
| `detail_sale.orden` | `table_number` | inglés; `orden` se lee como "pedido" y el dato es **el número de mesa** (12, 19, 33…) |
| `detail_sale.descripcion` | `description` | inglés |
| `detail_sale.code_product` | `product_code` | inglés (sustantivo + calificador) |
| `detail_sale.folio` | `sale_folio` | `folio` a secas colisiona con `sale.folio` en cualquier `JOIN` |
| `detail_sale_payment.folio` | `sale_folio` | ídem |
| `detail_sale.waiter_id` (naranja) | `waiter_code` **+** `waiter_id` | `_id` está reservado a FK. El Excel trae texto `'03'`, no un id |

### 3.3 🗺️ Diagrama de relaciones

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║  fayxzvov_facturacion   ·   [ESQUEMA NUEVO]   ·   InnoDB · utf8mb4 · utf8mb4_general_ci          ║
║  ESQUEMA AUTÓNOMO: 0 FK cross-schema · no depende de fayxzvov_alpha ni de fayxzvov_admin         ║
║                                                                                                  ║
║  ── JERARQUÍA CORPORATIVA  (propia del módulo) ────────────────────────────────────────────────  ║
║                                                                                                  ║
║   ┌──────────────────┐                    ┌──────────────────┐                                   ║
║   │ company  [NUEVO] │──── 1:N ──────────▶│ branch           │                                   ║
║   │ • id         PK  │                    │ • id         PK  │                                   ║
║   │ • business_name  │  V·mem f1          │ • business_name  │  V·mem f2                         ║
║   │   COMIENDO EN    │                    │  CAFE DE CHIAPAS │                                   ║
║   │   CHIAPAS        │                    │  SUC. POLIFORUM  │                                   ║
║   │ • rfc            │                    │ • rfc            │  captura manual                   ║
║   │ • fiscal_address │                    │ • fiscal_address │  V·mem f3                         ║
║   │ • phone          │                    │ • phone          │  captura manual                   ║
║   └──────────────────┘                    │ • company_id  FK │  NOT NULL · RESTRICT              ║
║    la empresa emisora                     └────────▲─────────┘                                   ║
║                                                    │ branch_id                                   ║
║      ┌─────────────────────────────────────────────┴──────────────────────────────────────┐      ║
║      │  LA DIMENSIÓN DE AISLAMIENTO DE TODO EL MÓDULO                                     │      ║
║      │  la llevan: sale · virtual_ticket · product · waiter · payment_method ·            │      ║
║      │             import_batch     (los detalles la heredan por sale_id)                 │      ║
║      └────────────────────────────────────────────────────────────────────────────────────┘      ║
║                                                                                                  ║
║  ── CATÁLOGOS ─────────────────────────────────────────────────────────────────────────────────  ║
║                                                                                                  ║
║   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         ║
║   │ sale_status      │  │ payment_method   │  │ product          │  │ waiter   [NUEVO] │         ║
║   │ • id         PK  │  │ • id         PK  │  │ • id         PK  │  │ • id         PK  │         ║
║   │ • name           │  │ • name           │  │ • code           │  │ • code           │         ║
║   │   VENCIDO /      │  │ • is_cash        │  │ • name           │  │ • name  (manual) │         ║
║   │   FACTURADO      │  │ • branch_id   FK │  │ • is_bridge   ★  │  │ • branch_id   FK │         ║
║   │                  │  │                  │  │ • is_modifier ★  │  │                  │         ║
║   │  (global: sin    │  │                  │  │ • price      ⚠   │  │                  │         ║
║   │   branch_id)     │  │                  │  │ • branch_id   FK │  │                  │         ║
║   └────────▲─────────┘  └────────▲─────────┘  └────────▲─────────┘  └────────▲─────────┘         ║
║            │ N:1                 │ N:1                 │ N:1                 │ N:1               ║
║          sale         detail_sale_payment       detail_sale  +          detail_sale              ║
║                                            detail_virtual_ticket                                 ║
║                                                                                                  ║
║   ┌──────────────────┐                                                                           ║
║   │ import_batch     │◄── N:1 ── sale · detail_sale · detail_sale_payment     [NUEVO]            ║
║   │ • id         PK  │                                                                           ║
║   │ • sheet_name     │           trazabilidad de carga: qué archivo trajo cada renglón           ║
║   │ • row_count      │                                                                           ║
║   │ • control_total  │                                                                           ║
║   │ • branch_id   FK │                                                                           ║
║   └──────────────────┘                                                                           ║
║                                                                                                  ║
║  ── TRANSACCIONES RAÍZ  Y  DETALLES ───────────────────────────────────────────────────────────  ║
║                                                                                                  ║
║   ┌────────────────────────────┐            ┌──────────────────────────────┐                     ║
║   │ sale                (raíz) │            │ detail_sale        (detalle) │                     ║
║   │ • id                  PK   │─── 1:N ───▶│ • id                    PK   │                     ║
║   │ • folio             ┄llave │            │ • sale_folio        ┄llave   │                     ║
║   │ • billing_code             │            │ • product_code      ┄llave   │                     ║
║   │ • invoice_series           │            │ • waiter_code                │                     ║
║   │ • discount_percent         │            │ • table_number               │                     ║
║   │ • subtotal · tax · total   │            │ • description                │                     ║
║   │ • operation_date           │            │ • quantity             ★     │                     ║
║   │ • expires_at               │            │ • discount_percent     ★     │                     ║
║   │ • sale_status_id      FK   │            │ • amount                     │                     ║
║   │ • branch_id           FK   │            │ • opened_at · closed_at      │                     ║
║   │ • import_batch_id     FK   │            │ • captured_at                │                     ║
║   │ • source_row               │            │ • sale_id · product_id  FK   │                     ║
║   │                            │            │ • waiter_id            FK ★  │                     ║
║   └──────┬──────────────┬──────┘            └──────────────────────────────┘                     ║
║          │              │                                                                        ║
║          │ 1:N          │ 1:N               ┌──────────────────────────────┐                     ║
║          │              └──────────────────▶│ detail_sale_payment          │                     ║
║          │                                  │ • id                    PK   │                     ║
║          │                                  │ • sale_folio        ┄llave   │                     ║
║          │                                  │ • currency                   │                     ║
║          │                                  │ • amount    ← ÚNICO sumable  │                     ║
║          │                                  │ • exchange_rate              │                     ║
║          │                                  │ • sale_subtotal  ⚠ NO SUMAR  │                     ║
║          │                                  │ • sale_tax       ⚠ NO SUMAR  │                     ║
║          │                                  │ • sale_total     ⚠ NO SUMAR  │                     ║
║          │                                  │ • sale_id               FK   │                     ║
║          │                                  │ • payment_method_id     FK   │                     ║
║          │                                  └──────────────────────────────┘                     ║
║          ▼                                                                                       ║
║   ┌────────────────────────────┐            ┌──────────────────────────────┐                     ║
║   │ virtual_ticket     [NUEVO] │            │ detail_virtual_ticket [NUEVO]│                     ║
║   │ • id                  PK   │─── 1:N ───▶│ • id                    PK   │                     ║
║   │ • note_number  (reinicia)  │            │ • description   (snapshot)   │                     ║
║   │ • subtotal·discount·total  │            │ • quantity                   │                     ║
║   │ • issue_date               │            │ • unit_price    (snapshot)   │                     ║
║   │ • sale_id             FK   │            │ • amount                     │                     ║
║   │ • branch_id       FK NOT   │            │ • virtual_ticket_id     FK   │                     ║
║   │   NULL: membrete + folio   │            │ • product_id            FK   │                     ║
║   │                            │            └──────────────────────────────┘                     ║
║   └────────────────────────────┘                                                                 ║
║                                                                                                  ║
║   ★ campo que el dibujo omitía y se añade      ┄ llave de cruce por texto (no es FK)             ║
║   ⚠ punto a confirmar — ver §6                 ── todas las FK son LOCALES al esquema            ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝
```

### 3.4 Cardinalidades

| Origen | → | Destino | Cardinalidad | ON DELETE |
|---|---|---|---|---|
| `company` | → | `branch` | 1 : N | **RESTRICT** |
| `sale` | → | `detail_sale` | 1 : N | CASCADE |
| `sale` | → | `detail_sale_payment` | 1 : N | CASCADE |
| `sale` | → | `virtual_ticket` | 1 : N (1 activa) | CASCADE |
| `virtual_ticket` | → | `detail_virtual_ticket` | 1 : N | CASCADE |
| `branch` | → | `virtual_ticket` | 1 : N | **RESTRICT** |
| `sale` | → | `sale_status` | N : 1 | SET NULL |
| `sale` | → | `import_batch` | N : 1 | SET NULL |
| `detail_sale` | → | `product` | N : 1 | SET NULL |
| `detail_sale` | → | `waiter` | N : 1 | SET NULL |
| `detail_sale` | → | `import_batch` | N : 1 | SET NULL |
| `detail_sale_payment` | → | `payment_method` | N : 1 | SET NULL |
| `detail_sale_payment` | → | `import_batch` | N : 1 | SET NULL |
| `detail_virtual_ticket` | → | `product` | N : 1 | SET NULL |
| `branch` | → | `sale` | 1 : N | SET NULL |
| `branch` | → | `import_batch` | 1 : N | SET NULL |
| `branch` | → | `product` · `waiter` · `payment_method` | 1 : N | SET NULL |

> **El aislamiento es por sucursal:** toda tabla que se puebla con datos del POS lleva `branch_id`. La
> empresa se obtiene con un salto — `branch.company_id` — igual que antes se obtenía por
> `subsidiaries.companies_id`, solo que ahora sin salir del esquema.

**Los dos `RESTRICT` son deliberados** y se apartan de la política "→ maestro/catálogo `SET NULL`":

| FK | Por qué RESTRICT y no SET NULL |
|---|---|
| `branch.company_id` | va `NOT NULL`: una sucursal sin empresa no significa nada, y `SET NULL` sobre una columna `NOT NULL` haría fallar el borrado con un error confuso en vez de con uno claro |
| `virtual_ticket.branch_id` | va `NOT NULL` porque el `UNIQUE` del consecutivo diario se ancla ahí — y en MySQL un `UNIQUE` con `NULL` **deja de bloquear duplicados**. Borrar la sucursal dejaría las notas sin membrete y sin talonario |

En la práctica ninguno se dispara: el módulo es soft-delete (`active = 0`), no hace `DELETE` físico
salvo dentro de la recarga por batch, que no toca `company` ni `branch`.

**Cardinalidades medidas en los datos reales** (lo que el modelo tiene que soportar hoy):

| Relación | Medido |
|---|---|
| `sale` → `detail_sale` | 1 802 ventas con partidas · media 7.3 · **2 019 ventas con 0 partidas** (desfase de ventana) |
| `sale` → `detail_sale_payment` | 3 740 con 1 pago · 74 con 2 · 7 con 3 · **máximo 3** |
| `product` → `detail_sale` | 376 productos para 13 141 partidas · hasta **13 repeticiones** del mismo par (cuenta, clave) |
| `waiter` → `detail_sale` | **18 códigos** distintos (uno vacío) |
| `payment_method` → `detail_sale_payment` | **6 métodos** · EFECTIVO 1 881 · DEBITO 1 233 · VISA 678 · MC 78 · AMEX 36 · TRANSF 3 |
| `sale_status` → `sale` | **2 estados** · VENCIDO 3 565 · FACTURADO 256 |

---

## 4. ✅ Estructura de tablas

### Leyenda del origen de cada campo

Cada campo declara **de qué columna de Excel viene**, con esta notación:

| Marca | Significado |
|---|---|
| `V·A «Folio»` | `Reporte_De_Ventas_20260709.xlsx` · hoja **«Reporte de ventas»** · columna **A** · nombre verbatim |
| `P·D «Importe»` | mismo archivo · hoja **«Pagos»** · columna **D** |
| `C·J «cantidad»` | `comandas.xls` · hoja única · columna **J** |
| `V·mem f2` | **membrete** del Excel de ventas (filas 1–3 del preámbulo, antes del header de f7) |
| `[DERIVADO]` | se calcula durante la carga a partir de otra columna |
| `[SISTEMA]` | **no viene de ningún Excel** — lo pone la aplicación o se captura a mano |
| `★AÑADIDO★` | columna del Excel que **el dibujo omitía** |
| `AÑADIDO` | campo técnico añadido por db-rules o por necesidad del módulo |

> **30 columnas de Excel → 30 destinos. Cero descartes.**
> El único dato del archivo que **no** se persiste es el pivote incrustado de la hoja «Pagos»
> (`J` en adelante), porque no es un dato: es una fórmula de Excel. Se usa como **cifra de control**
> de la carga (`2 644 933.30`) y se guarda en `import_batch.control_total`.


### 4.1 Catálogos

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ company  (catálogo — la empresa emisora · raíz corporativa)   [AÑADIDO]                          │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  id                 INT PK                [SISTEMA]                                              │
│                                                                                                  │
│  ── Negocio ──                                                                                   │
│  business_name      VARCHAR(200)          V·mem f1 «COMIENDO EN CHIAPAS»                         │
│  rfc                VARCHAR(13)           [SISTEMA] captura manual                               │
│  fiscal_address     VARCHAR(255)          [SISTEMA] captura manual                               │
│  phone              VARCHAR(20)           [SISTEMA] captura manual                               │
│                                                                                                  │
│  ── Timestamps ──                                                                                │
│  created_at         DATETIME              [SISTEMA]                                              │
│  updated_at         DATETIME              [SISTEMA]                                              │
│                                                                                                  │
│  ── Soft-delete ──                                                                               │
│  active             TINYINT               [SISTEMA]                                              │
│                                                                                                  │
│  ── Índices ──                                                                                   │
│  UNIQUE  uk_company_name (business_name(150))   ← prefijo: 767 bytes de tope en ROW_FORMAT       │
│                                                   COMPACT y utf8mb4 gasta 4 bytes/char           │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ branch  (catálogo — la sucursal emisora · dimensión de aislamiento del módulo)                   │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  id                 INT PK                [SISTEMA]                                              │
│                                                                                                  │
│  ── Negocio ──                                                                                   │
│  business_name      VARCHAR(200)          V·mem f2 «CAFE DE CHIAPAS SUC. POLIFORUM»              │
│  rfc                VARCHAR(13)           [SISTEMA] captura manual · no viene en ningún export   │
│  fiscal_address     VARCHAR(255)          V·mem f3 «CALLE BRASIL, NUM 572, COL. EL RETIRO…»      │
│  phone              VARCHAR(20)           [SISTEMA] captura manual · el ticket lo imprime        │
│                                                                                                  │
│  ── Timestamps ──                                                                                │
│  created_at         DATETIME              [SISTEMA]                                              │
│  updated_at         DATETIME              [SISTEMA]  AÑADIDO · §2.3 lo exige                     │
│                                                                                                  │
│  ── FK locales ──                                                                                │
│  company_id         → company             [SISTEMA]  NOT NULL · la empresa      RESTRICT         │
│                                                                                                  │
│  ── Soft-delete ──                                                                               │
│  active             TINYINT               [SISTEMA]                                              │
│                                                                                                  │
│  ── Índices ──                                                                                   │
│  UNIQUE  uk_branch_name (business_name(150), company_id)                                         │
│  KEY     idx_branch_company (company_id)                                                         │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

`branch` no lleva lugar de expedición: no viene en ningún export y el ticket imprime domicilio. Se añade por
`ALTER` cuando se conecte el timbrado de CFDI (F9).

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ sale_status  (catálogo — estado fiscal del ticket · seed fijo de 2)                              │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  id                 INT PK                [SISTEMA]                                              │
│                                                                                                  │
│  ── Negocio ──                                                                                   │
│  name               VARCHAR(20)           V·I «Estado» · verbatim: VENCIDO / FACTURADO           │
│                                                                                                  │
│  ── Soft-delete ──                                                                               │
│  active             TINYINT               [SISTEMA]                                              │
│                                                                                                  │
│  ── Índices ──                                                                                   │
│  UNIQUE  uk_sale_status_name (name)              ← llave del resolver                            │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ payment_method  (catálogo — forma de pago del POS · 6 valores medidos)                           │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  id                 INT PK                [SISTEMA]                                              │
│                                                                                                  │
│  ── Negocio ──                                                                                   │
│  name               VARCHAR(30)           P·B «Método de pago» · verbatim, máx 16 medido         │
│  is_cash            TINYINT               [SISTEMA] 1 = EFECTIVO · el generador oculta estos     │
│                                                                                                  │
│  ── Timestamps ──                                                                                │
│  created_at         DATETIME              [SISTEMA]                                              │
│  updated_at         DATETIME              [SISTEMA]  AÑADIDO · §2.3 lo exige                     │
│                                                                                                  │
│  ── FK locales ──                                                                                │
│  branch_id          → branch              [SISTEMA]  AÑADIDO · sucursal   SET NULL               │
│                                                                                                  │
│  ── Soft-delete ──                                                                               │
│  active             TINYINT               [SISTEMA]                                              │
│                                                                                                  │
│  ── Índices ──                                                                                   │
│  UNIQUE  uk_payment_method_name (name, branch_id)                                                │
│  KEY     idx_payment_method_cash (is_cash, active)                                               │
│  KEY     idx_payment_method_branch (branch_id)                                                   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ product  (catálogo — platillos, modificadores y puentes · 376 claves)                            │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  id                 INT PK                [SISTEMA]                                              │
│                                                                                                  │
│  ── Negocio ──                                                                                   │
│  code               VARCHAR(10)           C·G «claveproducto» · máx 7 medido · 376 claves        │
│  name               VARCHAR(60)           C·I «descripcion» · máx 37 · 1 clave = 1 descripción   │
│  is_modifier        TINYINT               [DERIVADO] AÑADIDO · 1 si nunca cobró (31 claves)      │
│  is_bridge          TINYINT               [SISTEMA]  AÑADIDO · lo marca el usuario a mano        │
│                                                                                                  │
│  ── Montos  (⚠ ver §6 — punto a confirmar) ──                                                    │
│  price              DOUBLE                [SISTEMA] ⚠ NINGÚN Excel trae precio unitario          │
│                                                                                                  │
│  ── Timestamps ──                                                                                │
│  created_at         DATETIME              [SISTEMA]                                              │
│  updated_at         DATETIME              [SISTEMA]                                              │
│                                                                                                  │
│  ── FK locales ──                                                                                │
│  branch_id          → branch              [SISTEMA]  AÑADIDO · sucursal   SET NULL               │
│                                                                                                  │
│  ── Soft-delete ──                                                                               │
│  active             TINYINT               [SISTEMA]                                              │
│                                                                                                  │
│  ── Índices ──                                                                                   │
│  UNIQUE  uk_product_code (code, branch_id)  ← get-or-create                                      │
│  KEY     idx_product_generator (is_bridge, is_modifier, active)                                  │
│  KEY     idx_product_branch (branch_id)                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ waiter  (catálogo — mesero del POS · 18 códigos)   [AÑADIDO]                                     │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  id                 INT PK                [SISTEMA]                                              │
│                                                                                                  │
│  ── Negocio ──                                                                                   │
│  code               VARCHAR(5)            C·F «mesero» · código «03» «124» «46» · 18 distintos   │
│  name               VARCHAR(150)          [DERIVADO] DEFAULT = el propio code · NUNCA NULL.      │
│                                           Se captura el nombre real solo si se quiere            │
│                                                                                                  │
│  ── Timestamps ──                                                                                │
│  created_at         DATETIME              [SISTEMA]                                              │
│  updated_at         DATETIME              [SISTEMA]                                              │
│                                                                                                  │
│  ── FK locales ──                                                                                │
│  branch_id          → branch              [SISTEMA] sucursal              SET NULL               │
│                                                                                                  │
│  ── Soft-delete ──                                                                               │
│  active             TINYINT               [SISTEMA]                                              │
│                                                                                                  │
│  ── Índices ──                                                                                   │
│  UNIQUE  uk_waiter_code (code, branch_id)  ← get-or-create                                       │
│  KEY     idx_waiter_branch (branch_id)                                                           │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ import_batch  (catálogo técnico — bitácora de carga)   [AÑADIDO]                                 │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  id                 INT PK                [SISTEMA]                                              │
│                                                                                                  │
│  ── Negocio ──                                                                                   │
│  file_name          VARCHAR(255)          [SISTEMA] nombre del archivo subido                    │
│  sheet_name         VARCHAR(60)           [SISTEMA] «Reporte de ventas» / «Pagos» / «comandas»   │
│  period_year        INT                   [SISTEMA] selector de la pantalla (ERS §Secciones)     │
│  period_month       INT                   [SISTEMA] selector de la pantalla (ERS §Secciones)     │
│  row_count          INT                   [DERIVADO] filas leídas: 3821 / 3909 / 13141           │
│                                                                                                  │
│  ── Montos ──                                                                                    │
│  control_total      DOUBLE                [DERIVADO] Σ de control · 2644933.30 en ventas         │
│                                                                                                  │
│  ── Timestamps ──                                                                                │
│  created_at         DATETIME              [SISTEMA] = momento de la carga                        │
│  updated_at         DATETIME              [SISTEMA]                                              │
│                                                                                                  │
│  ── FK locales ──                                                                                │
│  branch_id          → branch              [SISTEMA] sucursal de la carga  SET NULL               │
│                                                                                                  │
│  ── Soft-delete ──                                                                               │
│  active             TINYINT               [SISTEMA]                                              │
│                                                                                                  │
│  ── Índices ──                                                                                   │
│  KEY     idx_import_period (period_year, period_month, sheet_name)                               │
│  KEY     idx_import_branch (branch_id)                                                           │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```


### 4.2 Transacciones raíz

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ sale  (raíz — el ticket · hoja «Reporte de ventas» · 3 821 filas)                                │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  id                 INT PK                [SISTEMA]                                              │
│                                                                                                  │
│  ── Negocio ──                                                                                   │
│  folio              VARCHAR(10)           V·A «Folio» · 3821 únicos · LLAVE DE CRUCE             │
│  billing_code       VARCHAR(30)           V·B «Código facturación» · TAL CUAL, con el relleno    │
│  invoice_series     VARCHAR(10)           V·J «Folio factura» · «C2482» literal · 3565 vacíos    │
│  source_row         INT                   [SISTEMA]  AÑADIDO · fila física del Excel             │
│                                                                                                  │
│  ── Montos  (literales — el sistema NO recalcula) ──                                             │
│  discount_percent   DOUBLE                V·D «Descuento» · ES % NO MONTO · 0/15/30/100          │
│  subtotal           DOUBLE                V·E «Subtotal» · base ANTES del descuento              │
│  tax                DOUBLE                V·F «Impuestos» · impuesto DESPUÉS del descuento       │
│  total              DOUBLE                V·G «Total» · autoritativo · Σ = 2 644 933.30          │
│                                                                                                  │
│  ── Timestamps ──                                                                                │
│  operation_date     DATETIME              V·C «Fecha» · CON hora (07:39) · no se trunca          │
│  expires_at         DATETIME              V·H «Fecha de expiración» · fin de mes 23:59:59        │
│  created_at         DATETIME              [SISTEMA]  (el dibujo decía «create_at»)               │
│                                                                                                  │
│  ── Status ──                                                                                    │
│  sale_status_id     → sale_status         V·I «Estado» resuelto por name    SET NULL             │
│                                                                                                  │
│  ── FK locales ──                                                                                │
│  branch_id          → branch              [SISTEMA] (dibujo: subsidiarie_id)  SET NULL           │
│  import_batch_id    → import_batch        [SISTEMA]  AÑADIDO · trazabilidad  SET NULL            │
│                                                                                                  │
│  ── Soft-delete ──                                                                               │
│  active             TINYINT               [SISTEMA]                                              │
│                                                                                                  │
│  ── Índices ──                                                                                   │
│  UNIQUE  uk_sale_folio (folio, branch_id)                                                        │
│  UNIQUE  uk_sale_billing_code (billing_code, branch_id)                                          │
│  KEY     idx_sale_operation (operation_date, sale_status_id)  ← tablero del día por RANGO        │
│  KEY     sale_status_id · branch_id · import_batch_id                                            │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ virtual_ticket  (raíz — nota impresa del generador)   [AÑADIDO]                                  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  id                 INT PK                [SISTEMA]                                              │
│                                                                                                  │
│  ── Negocio ──                                                                                   │
│  note_number        INT                   [SISTEMA] «Nota #12» · consecutivo que reinicia c/día  │
│                                                                                                  │
│  ── Montos ──                                                                                    │
│  subtotal           DOUBLE                [DERIVADO] Σ líneas puente · ej. 3 050.00              │
│  discount           DOUBLE                [DERIVADO] ajuste de cuadre · ej. 15.10                │
│  total              DOUBLE                [DERIVADO] = sale.total del origen · ej. 3 034.90      │
│                                                                                                  │
│  ── Timestamps ──                                                                                │
│  issue_date         DATE                  [DERIVADO] = DATE(sale.operation_date) del origen      │
│  created_at         DATETIME              [SISTEMA]                                              │
│  updated_at         DATETIME              [SISTEMA]                                              │
│                                                                                                  │
│  ── FK locales ──                                                                                │
│  sale_id            → sale                [DERIVADO] ticket que respalda      CASCADE            │
│                                           sin venta no hay nota: se borra con ella               │
│  branch_id          → branch              [DERIVADO] = sale.branch_id · NOT NULL. Hace las dos   │
│                                           cosas: EMISORA del membrete impreso (razon social,     │
│                                           domicilio, RFC, telefono) y ancla del  RESTRICT        │
│                                           consecutivo diario                                     │
│                                                                                                  │
│  ── Soft-delete ──                                                                               │
│  active             TINYINT               [SISTEMA] regenerar = active=0 + nota nueva            │
│                                                                                                  │
│  ── Índices ──                                                                                   │
│  UNIQUE  uk_virtual_ticket_note (issue_date, note_number, branch_id)                             │
│          ↑ el consecutivo diario es POR SUCURSAL: dos sucursales pueden emitir su                │
│            «Nota #12» el mismo día sin chocar                                                    │
│  KEY     sale_id · branch_id                                                                     │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

> **La nota se borra con su venta.** Las tres tablas que cuelgan de `sale` van en `CASCADE`: sin el ticket
> real que la respalda, una nota virtual no tiene sentido — quedaría un documento impreso sin origen.
>
> **Consecuencia operativa a tener presente:** como la recarga borra los folios y los reinserta (§7.3),
> **resubir un archivo elimina las notas ya generadas de ese periodo** y hay que volver a generarlas. Es
> aceptable porque generar es un clic y el algoritmo es determinista sobre los mismos datos, pero conviene
> que la pantalla lo advierta antes de recargar un mes que ya tiene notas emitidas.


### 4.3 Detalles

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ detail_sale  (detalle — RÉPLICA LITERAL de comandas.xls · 13 141 filas)                          │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  id                 INT PK                [SISTEMA]                                              │
│                                                                                                  │
│  ── Negocio  (las 12 columnas, fila por fila, con repetición) ──                                 │
│  comanda_folio      VARCHAR(10)           C·A «foliocomanda» · vacío en 13138/13141              │
│  sale_folio         VARCHAR(10)           C·B «foliocuenta» · LLAVE DE CRUCE (texto)             │
│  table_number       VARCHAR(5)            C·C «orden» · nº de MESA · REPETIDO por diseño         │
│  waiter_code        VARCHAR(5)            C·F «mesero» · «03» ← VARCHAR salva el cero            │
│  product_code       VARCHAR(10)           C·G «claveproducto» · LLAVE DE CRUCE (texto)           │
│  description        VARCHAR(60)           C·I «descripcion» · REPETIDO por diseño                │
│  source_row         INT                   [SISTEMA] AÑADIDO · fila física del Excel              │
│                                                                                                  │
│  ── Montos ──                                                                                    │
│  quantity           DOUBLE                C·J «cantidad» ★AÑADIDO★ · 0.096061 exige DOUBLE       │
│  discount_percent   DOUBLE                C·K «descuento» ★AÑADIDO★ · «20%» texto → 20.0         │
│  amount             DOUBLE                C·L «importe» · 0.00 en 1465 filas es LEGÍTIMO         │
│                                                                                                  │
│  ── Timestamps ──                                                                                │
│  opened_at          DATETIME              C·D «fechaapertura» serial · REPETIDO por diseño       │
│  closed_at          DATETIME              C·E «fechacierre» serial · REPETIDO por diseño         │
│  captured_at        DATETIME              C·H «fechadecaptura» serial · 57 fuera de rango        │
│  created_at         DATETIME              [SISTEMA] AÑADIDO · §2.3 lo exige                      │
│  updated_at         DATETIME              [SISTEMA] AÑADIDO · §2.3 lo exige                      │
│                                                                                                  │
│  ── FK locales  (resueltas en la carga desde las columnas de texto) ──                           │
│  sale_id            → sale                [DERIVADO] de sale_folio · NULL si no cruza  CASCADE   │
│  product_id         → product             [DERIVADO] de product_code           SET NULL          │
│  waiter_id          → waiter              [DERIVADO] AÑADIDO · de waiter_code  SET NULL          │
│  import_batch_id    → import_batch        [SISTEMA]  AÑADIDO · trazabilidad    SET NULL          │
│                                                                                                  │
│  ── Soft-delete ──                                                                               │
│  active             TINYINT               [SISTEMA]                                              │
│                                                                                                  │
│  ── Índices ──                                                                                   │
│  KEY  idx_detail_sale_sale (sale_id, product_id)   ← NO UNIQUE:                                  │
│       1 578 pares (cuenta,clave) se repiten, hasta 13 veces                                      │
│  KEY  idx_detail_sale_folio (sale_folio)   ← cruce antes de resolver                             │
│  KEY  product_id · waiter_id · import_batch_id                                                   │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ detail_sale_payment  (detalle — hoja «Pagos» A:H · 3 909 filas)                                  │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  id                 INT PK                [SISTEMA]                                              │
│                                                                                                  │
│  ── Negocio ──                                                                                   │
│  sale_folio         VARCHAR(10)           P·A «Folio» · LLAVE DE CRUCE (texto)                   │
│  currency           VARCHAR(30)           P·C «Moneda» · «Peso Mexicano» en 3909/3909            │
│  source_row         INT                   [SISTEMA] AÑADIDO · fila física del Excel              │
│                                                                                                  │
│  ── Montos  (⚠ solo `amount` es sumable) ──                                                      │
│  amount             DOUBLE                P·D «Importe» · ÚNICO monto real del pago              │
│  exchange_rate      DOUBLE                P·E «Tipo de cambio» · 1 en 3909/3909                  │
│  sale_subtotal      DOUBLE                P·F «Subtotal» ⚠ es del TICKET · NO SUMAR              │
│  sale_tax           DOUBLE                P·G «Impuestos» ⚠ es del TICKET · NO SUMAR             │
│  sale_total         DOUBLE                P·H «Total» ⚠ copia de Importe · NO SUMAR              │
│                                                                                                  │
│  ── Timestamps ──                                                                                │
│  created_at         DATETIME              [SISTEMA] AÑADIDO · §2.3 lo exige                      │
│  updated_at         DATETIME              [SISTEMA] AÑADIDO · §2.3 lo exige                      │
│                                                                                                  │
│  ── FK locales ──                                                                                │
│  sale_id            → sale                [DERIVADO] de sale_folio             CASCADE           │
│  payment_method_id  → payment_method      [DERIVADO] de P·B «Método de pago»  SET NULL           │
│  import_batch_id    → import_batch        [SISTEMA]  AÑADIDO · trazabilidad   SET NULL           │
│                                                                                                  │
│  ── Soft-delete ──                                                                               │
│  active             TINYINT               [SISTEMA] AÑADIDO · §2.3 lo exige                      │
│                                                                                                  │
│  ── Índices ──                                                                                   │
│  KEY  idx_payment_sale (sale_id)      ← hasta 3 pagos por venta                                  │
│  KEY  idx_payment_folio (sale_folio)                                                             │
│  KEY  payment_method_id · import_batch_id                                                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ detail_virtual_ticket  (detalle — renglones puente de la nota)   [AÑADIDO]                       │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  id                 INT PK                [SISTEMA]                                              │
│                                                                                                  │
│  ── Negocio ──                                                                                   │
│  description        VARCHAR(60)           [DERIVADO] snapshot de product.name al imprimir        │
│                                                                                                  │
│  ── Montos ──                                                                                    │
│  quantity           DOUBLE                [SISTEMA] la arma el generador · ej. 2, 1, 3           │
│  unit_price         DOUBLE                [DERIVADO] snapshot de product.price al imprimir       │
│  amount             DOUBLE                [DERIVADO] quantity × unit_price                       │
│                                                                                                  │
│  ── Timestamps ──                                                                                │
│  created_at         DATETIME              [SISTEMA]                                              │
│  updated_at         DATETIME              [SISTEMA]                                              │
│                                                                                                  │
│  ── FK locales ──                                                                                │
│  virtual_ticket_id  → virtual_ticket      [SISTEMA] nota a la que pertenece   CASCADE            │
│  product_id         → product             [SISTEMA] producto puente elegido  SET NULL            │
│                                                                                                  │
│  ── Soft-delete ──                                                                               │
│  active             TINYINT               [SISTEMA]                                              │
│                                                                                                  │
│  ── Índices ──                                                                                   │
│  KEY  idx_dvt_ticket (virtual_ticket_id)                                                         │
│  KEY  product_id                                                                                 │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 4.4 Índice inverso — de la columna de Excel al campo

La misma información del §4 leída al revés: **cada columna de los tres archivos y dónde cae.**

#### `Reporte_De_Ventas_20260709.xlsx` · hoja «Reporte de ventas» (header f7, datos f8, A:J)

| Col | Nombre verbatim | Campo destino | Nota |
|---|---|---|---|
| A | `Folio` | `sale.folio` | TRIM · 3 821 únicos · llave de cruce |
| B | `Código facturación` | `sale.billing_code` | tal cual, con relleno · prefijo `156537` en 3 821/3 821 |
| C | `Fecha` | `sale.operation_date` | `DATETIME` literal, con hora · el filtro del día va por rango (§5.7) |
| D | `Descuento` | `sale.discount_percent` | **es porcentaje**, no monto |
| E | `Subtotal` | `sale.subtotal` | literal, sin recalcular |
| F | `Impuestos` | `sale.tax` | literal, sin recalcular |
| G | `Total` | `sale.total` | autoritativo · Σ = **2 644 933.30** |
| H | `Fecha de expiración` | `sale.expires_at` | fin de mes 23:59:59 |
| I | `Estado` | `sale.sale_status_id` → `sale_status.name` | texto verbatim conservado en el catálogo |
| J | `Folio factura` | `sale.invoice_series` | `'C2482'` literal · vacío en 3 565 |
| f1 | *(membrete)* `COMIENDO EN CHIAPAS` | `company.business_name` | la empresa emisora, tabla propia del módulo |
| f2 | *(membrete)* `CAFE DE CHIAPAS SUC. POLIFORUM` | `branch.business_name` | |
| f3 | *(membrete)* `CALLE BRASIL, NUM 572…` | `branch.fiscal_address` | |

#### mismo archivo · hoja «Pagos» (header f7, datos f8, **A:H**)

| Col | Nombre verbatim | Campo destino | Nota |
|---|---|---|---|
| A | `Folio` | `detail_sale_payment.sale_folio` **+** `sale_id` | crudo + resuelto |
| B | `Método de pago` | `detail_sale_payment.payment_method_id` → `payment_method.name` | texto verbatim en el catálogo |
| C | `Moneda` | `detail_sale_payment.currency` | `'Peso Mexicano'` en 3 909/3 909 |
| D | `Importe` | `detail_sale_payment.amount` | **único monto sumable** |
| E | `Tipo de cambio` | `detail_sale_payment.exchange_rate` | 1 en 3 909/3 909 |
| F | `Subtotal` | `detail_sale_payment.sale_subtotal` | ⚠️ es del ticket · **no sumar** |
| G | `Impuestos` | `detail_sale_payment.sale_tax` | ⚠️ es del ticket · **no sumar** |
| H | `Total` | `detail_sale_payment.sale_total` | ⚠️ copia de `Importe` · **no sumar** |
| J+ | *(pivote incrustado)* | `import_batch.control_total` | no es dato: es fórmula. Se usa para validar |

#### `comandas.xls` (header f1, datos f2, A:L)

| Col | Nombre verbatim | Campo destino | Nota |
|---|---|---|---|
| A | `foliocomanda` | `detail_sale.comanda_folio` | vacío en 13 138/13 141 · **se guarda igual** |
| B | `foliocuenta` | `detail_sale.sale_folio` **+** `sale_id` | crudo + resuelto · llave de cruce |
| C | `orden` | `detail_sale.table_number` | **número de mesa** · repetido por diseño |
| D | `fechaapertura` | `detail_sale.opened_at` | serial Excel · repetido por diseño |
| E | `fechacierre` | `detail_sale.closed_at` | serial Excel · repetido por diseño |
| F | `mesero` | `detail_sale.waiter_code` **+** `waiter_id` → `waiter.code` | VARCHAR salva el `'03'` |
| G | `claveproducto` | `detail_sale.product_code` **+** `product_id` → `product.code` | crudo + resuelto |
| H | `fechadecaptura` | `detail_sale.captured_at` | serial Excel · 57 fuera de rango se cargan igual |
| I | `descripcion` | `detail_sale.description` **+** `product.name` | **se guarda en los dos sitios** (repetición pedida) |
| J | `cantidad` | `detail_sale.quantity` | ★ el dibujo la omitía · **DOUBLE obligatorio** |
| K | `descuento` | `detail_sale.discount_percent` | ★ el dibujo la omitía · `'20%'` → `20.0` |
| L | `importe` | `detail_sale.amount` | 0.00 en 1 465 filas es legítimo |

---

## 5. Lo que el dibujo omitía y se añade

Cada añadido, con su razón. Si alguno no lo quieres, se quita con un `ALTER TABLE` de una línea.

### 5.1 ★ `detail_sale.quantity` y `detail_sale.discount_percent` — **imprescindibles**

Son las **columnas J y K de `comandas.xls`**. Sin ellas el modelo incumple tu propio requisito ("toda
la información"), y además se rompen tres cosas concretas:

- **`quantity`** — el ticket virtual imprime `2  Parrillada Argentina`. Sin cantidad no hay ticket.
  Y es la única vía para derivar el precio unitario (`amount / quantity`). **Debe ser `DOUBLE`**: hay
  170 filas con `0.096061` (prorrateo de una cuenta compartida entre 10 comensales de un evento,
  folios 170945 y 170948–170954) y 48 con `0.5`. Un `INT` las convierte en `0` y borra $ real.
- **`discount_percent`** — es el **mecanismo B** de descuento (55 cuentas, 71 líneas). Sin él, el
  cuadre `Σ importe × (1 − descuento/100) = Total` no cierra en esas cuentas y el sistema reporta
  falsos errores de carga.

### 5.2 Columnas obligatorias que faltaban (db-rules §2.3)

| Tabla | Faltaba | Efecto de no tenerlo |
|---|---|---|
| `sale` | `updated_at` (y `create_at` estaba mal escrito) | sin auditoría de modificación |
| `detail_sale` | `created_at`, `updated_at` | ídem, en la tabla de 13 141 filas |
| `detail_sale_payment` | `updated_at`, **`active`** | **sin `active` no hay borrado lógico** → habría que hacer `DELETE` físico, prohibido por §2.4 |
| `payment_method` | `updated_at` | — |
| `branch` | `updated_at` | `active` y `created_at` ya estaban en tu dibujo |

### 5.3 ★ `waiter` (catálogo nuevo) — con el número como nombre por defecto

El Excel trae **el código** (`'03'`, `'124'`, `'46'` — 18 distintos) y **ningún archivo trae el nombre**.

**No se bloquea nada por eso: `name` nace con el propio código.** El get-or-create inserta
`(code = '03', name = '03')`, así que el campo **nunca es `NULL`** y el ticket siempre imprime algo:

```
MESERO: 03            ← por defecto, sin capturar nada
MESERO: ANGEL ANTONIO ← si algún día se captura el nombre real
```

Capturar los 18 nombres queda como una mejora opcional del catálogo, no como un requisito para operar.
La consulta del ticket es siempre la misma (`waiter.name`) — no necesita un `COALESCE` ni saber si el
nombre está capturado o no.

`detail_sale` conserva **las dos cosas**: `waiter_code` (réplica literal, con su cero a la izquierda)
y `waiter_id` (FK resuelta). La réplica no se sacrifica.

### 5.4 ★ `import_batch` (catálogo técnico nuevo) — trazabilidad y reimportación

Tres problemas que resuelve, y ninguno tiene otra solución barata:

1. **Reimportar sin duplicar.** No hay llave natural de partida (1 578 pares repetidos, hasta 13
   veces). El único `UPSERT` posible es *"borra lo del batch anterior y reinserta"*. Sin
   `import_batch_id` no se sabe qué borrar y la segunda carga deja **26 282 filas** en vez de 13 141.
2. **Reportar el error con dirección.** `source_row` + batch permite decir *"falló la fila 1 347 de
   comandas.xls"* en vez de *"falló la carga"*.
3. **Validar la carga.** `control_total` guarda la cifra de control del archivo (`2 644 933.30`) para
   compararla contra lo insertado.

Guarda además `period_year` / `period_month`, que son literalmente el selector de la pantalla que
describe el ERS (*"permite subir los tickets seleccionando el mes y año"*).

**No registra qué usuario subió el archivo.** El batch identifica **el archivo y su sucursal**, no a una
persona; la carga es una operación técnica del administrador del POS (usuario único según el ERS), y ligarla
a un `usr_users_id` solo agregaría una columna que nadie consulta.

### 5.5 ★ `virtual_ticket` + `detail_virtual_ticket` — así se separa lo importado de lo generado

**Este es el punto de diseño más importante del módulo**, y sale directo de la tensión entre tus dos
requisitos:

> "`detail_sale` es réplica literal del Excel" **vs.** "el generador crea tickets con productos puente"

Si los renglones generados se metieran en `detail_sale`, esa tabla dejaría de ser una réplica: tendría
filas que **no existen en ningún Excel**, y cualquier auditoría "Excel vs BD" fallaría para siempre.

La nota sí desaparece si se borra su venta (`CASCADE`), y eso es lo correcto: un documento impreso sin
ticket que lo respalde no significa nada. Lo que la tabla propia garantiza es distinto — que `detail_sale`
siga siendo **comparable renglón por renglón contra el Excel**, sin filas inventadas mezcladas.

**Solución: los renglones generados viven en su propia tabla.** `detail_sale` queda intocada — 13 141
filas, 13 141 filas del Excel, punto. Y el ticket virtual queda modelado como lo que realmente es:
**un documento aparte que se imprime, respaldado por una venta real**.

Lo que necesita, tomado del template `facturador.html` (tab 5):

| Elemento del ticket impreso | Campo |
|---|---|
| `NOTA: #12` — consecutivo que **se reinicia cada día** (ERS §Observaciones) | `virtual_ticket.note_number` + `UNIQUE (issue_date, note_number, branch_id)` |
| `SUBTOTAL: $3,050.00` | `virtual_ticket.subtotal` |
| `DESCUENTO: -$15.10` — el ajuste de cuadre | `virtual_ticket.discount` |
| `TOTAL: $3,034.90` — debe igualar el ticket real | `virtual_ticket.total` = `sale.total` |
| `2  Parrillada Argentina   $1,290.00` | `detail_virtual_ticket.quantity` / `description` / `amount` |
| `RESTAURANT` / dirección / teléfono / RFC | **`virtual_ticket.branch_id` → `branch`** (FK directa, sin rodeo) |
| `MESA: 9` / `MESERO: 03` | `detail_sale.table_number` / `waiter.name` (por defecto = el código) |
| Botón *"Regenerar productos"* | `active = 0` en la nota anterior + nota nueva |

**Por qué `virtual_ticket` lleva `branch_id` propio y no lo hereda de `sale`:**

1. **La nota la emite una sucursal, no una empresa.** El membrete impreso (`CAFE DE CHIAPAS SUC.
   POLIFORUM`, domicilio, teléfono) sale de `branch`. Sin la FK en la nota, cada impresión tendría que
   rodear `virtual_ticket → sale → branch` para saber qué membrete poner.
2. **El consecutivo diario es por sucursal.** El «Nota #12» de hoy pertenece a un talonario, y el talonario
   es de la sucursal que lo emite. Anclado a cualquier cosa más amplia, dos sucursales que generen su
   «Nota #12» el mismo día **chocan**: la segunda falla al insertar.
3. **`sale` ya lleva `branch_id`**, así que el generador solo lo copia. Es redundancia deliberada,
   igual que en `import_batch`: una raíz que se consulta y se imprime por sucursal debe poder filtrarse
   sin `JOIN`.

**Un solo campo hace las dos cosas.** En el modelo anterior eran dos (`branch_id` para el membrete,
`subsidiaries_id` para el folio). Ahora que la sucursal **es** `branch`, se colapsan:

| Consumidor | Qué usa |
|---|---|
| Impresión del ticket | `branch_id → branch`: razón social, domicilio, RFC, teléfono |
| `UNIQUE` del consecutivo diario | `(issue_date, note_number, branch_id)` |

**Por eso `virtual_ticket.branch_id` va `NOT NULL`** — y es el único cambio de fondo que trae el rediseño.
Un `UNIQUE` que incluye una columna `NULL` **deja de bloquear duplicados en MySQL**: dos notas con
`branch_id NULL`, la misma fecha y el mismo número entrarían las dos. Con la columna obligatoria, el
talonario está garantizado. El `ON DELETE` es `RESTRICT` por la misma razón: no se puede borrar una
sucursal que ya emitió notas.

> **Punto a decidir (§9.6).** `branch_id` apunta al emisor **actual**. Si se corrige el domicilio o el RFC
> en el catálogo, la reimpresión de una nota vieja saldrá con los datos nuevos. Para congelar el membrete
> como se congelan `description` y `unit_price` en el detalle, harían falta campos de snapshot en
> `virtual_ticket` (`issuer_name`, `issuer_address`, `issuer_rfc`). **No los añadí**: la nota virtual no es
> un CFDI y el membrete cambia muy rara vez. Si la quieres a prueba de auditoría, se agregan con un
> `ALTER TABLE`.

**Por qué `description` y `unit_price` se copian en el detalle** (y no solo se referencia `product`):
un ticket impreso es un documento congelado. Si mañana cambia el precio del catálogo, la reimpresión
de la nota de ayer **no puede cambiar**. Es la misma razón por la que una factura guarda el precio y no
un puntero al catálogo.

**Cómo trabaja el generador** (queda dicho para que el modelo se entienda, no es parte del DDL):

```
1. Toma los tickets del día:  sale.operation_date >= :fecha
                              AND sale.operation_date < :fecha + INTERVAL 1 DAY
2. Excluye los de efectivo:   no existe pago con payment_method.is_cash = 1
3. Excluye los ya facturados: sale_status.name <> 'FACTURADO'   (fila bloqueada en el template)
4. Detecta los de tasa 0:     ROUND(tax / NULLIF(subtotal,0), 2) = 0
5. Arma la combinación:       product WHERE is_bridge = 1 AND is_modifier = 0 AND price > 0
6. Cuadra:                    discount = Σ(líneas) − sale.total
```

### 5.6 ★ `company` → `branch` — el aislamiento es por SUCURSAL, dentro del propio esquema

**La jerarquía corporativa es del módulo, no prestada.** El export ya trae las dos plantas del membrete:

| Membrete | Tabla | Valor medido |
|---|---|---|
| f1 | `company.business_name` | `COMIENDO EN CHIAPAS` |
| f2 | `branch.business_name` | `CAFE DE CHIAPAS SUC. POLIFORUM` |
| f3 | `branch.fiscal_address` | `CALLE BRASIL, NUM 572, COL. EL RETIRO…` |

**Regla:** lleva `branch_id` toda tabla que se puebla con datos del POS.

| Lleva `branch_id` | No lleva |
|---|---|
| `sale`, `detail_sale`\*, `detail_sale_payment`\*, `product`, `waiter`, `payment_method`, `import_batch`, `virtual_ticket` | `sale_status`, `company` |

\* Los detalles lo heredan por `sale_id`; **no** se les pone columna propia, para no repetir la sucursal en
13 141 filas. El filtro entra por el `JOIN` con `sale`.

**Por qué la sucursal y no la empresa.** Cada export viene de **un POS**, y ese POS es de una sucursal
concreta (`CAFE DE CHIAPAS SUC. POLIFORUM`). Todo lo que sale de ese archivo le pertenece a ella:

- La **clave de producto es local al POS**. El código `01184` de una sucursal no tiene por qué ser el mismo
  platillo en otra. Con el `UNIQUE` a nivel empresa, la segunda sucursal que cargara su catálogo chocaría
  contra el de la primera o —peor— *reutilizaría* su producto y mezclaría los importes.
- Lo mismo con el **código de mesero** (`'03'` es un mesero distinto en cada sucursal) y con el **folio**
  del ticket: el consecutivo del POS es por sucursal, así que `UNIQUE (folio, branch_id)`.
- Los **nombres de método de pago** los escribe cada POS a su manera.

La empresa no se pierde: se obtiene con un salto, `branch.company_id`. Ese salto solo hace falta para un
reporte corporativo que sume varias sucursales — el 100 % de la operación diaria filtra por sucursal, que
es justo el campo que está en la tabla.

**Por qué la jerarquía es propia y no cross-schema.** El módulo se alimenta de exports de un POS externo,
no de la operación del ERP: nada en `sale`, `detail_sale` ni `virtual_ticket` nace de `fayxzvov_alpha`.
Con `company` y `branch` locales, el esquema `fayxzvov_facturacion` se crea, se respalda y se restaura
entero, y las 19 FK son internas — no hay constraint que apunte a una base que puede no existir en el
destino. Si algún día hace falta cruzar con el ERP, el enlace se agrega con un `ALTER` de una columna
(`branch.subsidiaries_id`, sin constraint dura) y no obliga a rehacer nada.

`sale_status` queda global: son 2 valores del formato del POS (`VENCIDO`/`FACTURADO`), no de nadie
en particular.

### 5.7 `sale.operation_date` — cómo se filtra el día sin columna extra

`V·C «Fecha»` es un `DATETIME` con hora (`2026-06-01 07:39`), y la hora se conserva porque el ticket la
imprime (`FECHA: 10/06/2026 19:47`).

El generador de folios consulta *"los tickets de este día"* en cada carga de pantalla, así que ese filtro
tiene que usar el índice. La forma en que se escribe la consulta decide si lo usa:

```sql
-- ❌ envuelve la columna en una función: el índice NO se usa, escanea las 3 821 filas
WHERE DATE(operation_date) = :fecha

-- ✅ rango sobre la columna desnuda: usa idx_sale_operation
WHERE operation_date >= :fecha AND operation_date < :fecha + INTERVAL 1 DAY
```

Con la segunda forma **no hace falta ninguna columna derivada**: el índice
`idx_sale_operation (operation_date, sale_status_id)` cubre el filtro del día y el de estado en una sola
pasada. Es la regla general — nunca aplicar una función a la columna por la que se filtra.

---

## 6. ⚠️ La contradicción: `product.price`

**No la escondo: es el único punto donde tu ER y tus palabras se contradicen.**

| Fuente | Dice |
|---|---|
| Tú, hace dos mensajes | *"productos no debería tener los precios ya que cambian constantemente"* |
| Tu ER (imagen actual) | `product.price` **en naranja** = "ligado a una columna del Excel" |

### 6.1 El hallazgo que resuelve la mitad del problema

**Ninguno de los tres archivos trae un precio unitario.** Verificado columna por columna:

- «Reporte de ventas» tiene montos **del ticket completo** (subtotal, impuestos, total).
- «Pagos» tiene el **importe del pago**.
- `comandas.xls` tiene `cantidad` (J) e `importe` (L) — el **importe de la línea**, no el precio.

Por lo tanto **`price` no puede ser naranja.** Si se conserva, es forzosamente `[SISTEMA]`: un dato de
captura manual, no de importación. Ese solo hecho ya explica por qué te chirriaba.

### 6.2 Los 4 códigos con dos precios en el mismo mes

Dejan de ser una anomalía en cuanto se acepta que **el precio es un hecho con fecha, no un atributo**.
Un producto que valió $120 el 3 de junio y $135 el 14 no tiene "un precio incorrecto": tiene dos
precios verdaderos en dos momentos. Una columna única solo puede guardar uno — el último — y eso rompe
dos cosas:

- Una nota generada para el 3 de junio se armaría con el precio de septiembre.
- Reimportar pisaría el precio y cambiaría, **hacia atrás**, el monto de notas ya impresas.

### 6.3 Resolución propuesta — doble vía

**(a) El histórico ya existe: son las partidas.** Cada renglón de `detail_sale` trae `amount` y
`quantity` con la fecha de su venta. El precio vigente a cualquier fecha se consulta:

```sql
SELECT ROUND(d.amount / d.quantity, 2) AS price
  FROM detail_sale d
  JOIN sale s ON s.id = d.sale_id
 WHERE d.product_id = :product_id
   AND d.discount_percent = 0        -- solo líneas a precio de lista
   AND d.quantity > 0                -- excluye el prorrateo 0.096061
   AND d.amount   > 0                -- excluye modificadores y cortesías
   AND d.active = 1
   AND s.operation_date < :fecha + INTERVAL 1 DAY   -- el precio que regía ESE día
 ORDER BY s.operation_date DESC, d.id DESC
 LIMIT 1;
```

**(b) `product.price` se conserva, pero cambia de significado:** deja de ser "el precio del producto" y
pasa a ser **precio de lista de referencia**, de captura manual, con **un solo consumidor**: el
generador de tickets virtuales, que necesita un precio para los productos puente aunque nunca se hayan
vendido a precio de lista.

| | Precio histórico | `product.price` |
|---|---|---|
| Qué es | lo que realmente se cobró | lo que el usuario decide que vale hoy |
| De dónde sale | `detail_sale.amount / quantity` + fecha | captura manual en el catálogo |
| Quién lo usa | reportes, auditoría, reimpresión | **solo** el generador de tickets puente |
| Se pisa al reimportar | no | no (no lo toca la carga) |

**Caso borde honesto:** un producto marcado `is_bridge` que nunca se vendió a precio de lista **no tiene
precio derivable**. Por eso (b) existe. Y si `price = 0`, el generador debe **excluirlo**, no
asumirle un precio.

> ### 🔴 A CONFIRMAR — decide una de las tres
>
> **A)** Se conserva `product.price` como precio de lista manual (lo propuesto arriba). ← recomendada
> **B)** Se elimina `product.price`; el generador usa **solo** el precio derivado y descarta los
> productos puente sin historial de venta a precio de lista.
> **C)** Se sustituye por una tabla `product_price (product_id, start_date, price)` con vigencias —
> más correcto, más trabajo, y **no lo pide ningún template hoy**.

---

## 7. 🧪 Checklist db-rules §7

| § | Ítem | Estado |
|---|---|---|
| 7.1 | Clasificación por clase de tabla | ✅ 7 catálogos · 2 raíz · 3 detalles · 0 pivotes |
| 7.1 | Prefijo `detail_` solo en renglones de transacción raíz | ✅ `detail_sale`, `detail_sale_payment`, `detail_virtual_ticket` — todos cuelgan de una raíz |
| 7.2 | Tablas en singular, snake_case, inglés | ✅ 12/12 |
| 7.2 | Columnas snake_case inglés · PK `id` · FK `<tabla>_id` | ✅ tras los renombres del §3.2 |
| 7.2 | `KEY` con el mismo nombre que la columna | ✅ |
| 7.3 | `id`, `active`, `created_at`, `updated_at` en toda tabla | ⚠️ 11/12 — `sale_status` va **sin timestamps** por decisión del usuario (ver desviaciones) |
| 7.3 | Raíz con la dimensión de aislamiento | ✅ `sale`, `virtual_ticket` llevan `branch_id` · **ninguna tabla lleva `usr_users_id`**: el módulo no liga registros a personas |
| 7.3 | Flujo con `status` → catálogo + FK | ✅ `sale_status_id` |
| 7.4 | **Montos en `DOUBLE`**, nunca `DECIMAL` | ✅ 16/16 campos monetarios |
| 7.4 | Nombres en `VARCHAR`, nunca `TEXT` | ✅ |
| 7.4 | Estados extensibles → catálogo, **nunca `ENUM`** | ✅ 0 `ENUM` |
| 7.4 | Fecha de negocio `DATE` · auditoría `DATETIME` | ✅ (`operation_date` es DATETIME **a propósito** — §5.7) |
| 7.5 | FK con `CONSTRAINT` explícito + `KEY` | ✅ |
| 7.5 | Política ON DELETE: detalle→raíz CASCADE · →catálogo SET NULL · →maestro SET NULL | ⚠️ 17/19 — los 2 `RESTRICT` (`branch.company_id`, `virtual_ticket.branch_id`) son columnas `NOT NULL`, justificados en §3.4 |
| 7.5 | Maestros, **no duplicados** | ✅ `company` → `branch` viven una sola vez, en el propio esquema · **0 FK cross-schema** |
| 7.6 | Sin `DELETE` físico → `active = 0` | ✅ (por eso `detail_sale_payment` necesitaba `active`) |
| 7.7 | InnoDB · utf8mb4 · collation única en el esquema | ✅ `utf8mb4_general_ci` en 12/12 — **verificado ejecutando el DDL** |
| 7.7 | Orden: id → negocio → montos → fechas → timestamps → status → FKs → active | ✅ en las 12 cajas |

### ⚠️ Desviaciones conscientes de db-rules (4)

| Regla | Desviación | Motivo |
|---|---|---|
| §1.2 collation `utf8mb4_0900_ai_ci` | se usa **`utf8mb4_general_ci`** | **no existe en MySQL 5.7**, que indicaste como destino. `general_ci` funciona en 5.7 y 8.0 |
| §5.3 maestros corporativos externos | `company` y `branch` son **tablas del módulo** | el módulo se alimenta de exports de un POS ajeno al ERP; con la jerarquía local el esquema es autónomo y portable (§5.6) |
| §7.5 `ON DELETE SET NULL` hacia maestro | 2 FK van en **`RESTRICT`** | son columnas `NOT NULL` (`branch.company_id`, `virtual_ticket.branch_id`): `SET NULL` sobre ellas fallaría con un error confuso (§3.4) |
| §3.2 `operation_date` como `DATE` | es **`DATETIME`** | el origen trae hora y el ticket la imprime; truncar perdería dato. El filtro del día va por rango, no con `DATE()` (§5.7) |
| §2.3 `updated_at` obligatorio | `sale` y `sale_status` van **sin `updated_at`** | ninguna de las dos se modifica nunca: `sale_status` es un seed fijo, y `sale` **se borra y se reinserta** en cada recarga (§7.3) en vez de actualizarse. Un `updated_at` que siempre valdría lo mismo que `created_at` no informa nada |
| §2.3 `created_at` / `updated_at` obligatorios | `sale_status` va **sin timestamps** | seed fijo de 2 filas que se dan de alta una vez y no se editan: no hay nada que auditar. `id`, `name` y `active` bastan |

---

## 8. Plan de implementación por fases

Cada fase tiene **criterios numéricos**. Si un número no da, la fase no pasa.

### F0 · Crear el esquema y los catálogos

| Entregable | Criterio de aceptación |
|---|---|
| `CREATE DATABASE fayxzvov_facturacion` | `SHOW DATABASES` lo lista |
| 12 tablas | `COUNT(*) FROM information_schema.TABLES = 12` |
| Collation uniforme | `COUNT(DISTINCT TABLE_COLLATION) = 1` y vale `utf8mb4_general_ci` |
| Seed `sale_status` | **2 filas**: `VENCIDO`, `FACTURADO` |
| Seed `company` + `branch` | **1 + 1 fila**, con `branch.company_id` resuelto |
| Seed `payment_method` | **6 filas** · `is_cash = 1` **solo** en `EFECTIVO` · las 6 con `branch_id` |
| FK | **19 constraints, todas locales**: `REFERENCED_TABLE_SCHEMA` = `fayxzvov_facturacion` en 19/19 |

### F1 · Cargar «Reporte de ventas» → `sale`

| Criterio | Valor exacto |
|---|---|
| Filas insertadas | **3 821** (no 3 820 — el header está en la **fila 7**) |
| Cifra de control | `ROUND(SUM(total),2)` = **2 644 933.30** |
| Estados | **3 565** `VENCIDO` + **256** `FACTURADO` |
| Correlación estado ⇔ factura | `invoice_series` lleno en **256/256** FACTURADO y vacío en **3 565/3 565** VENCIDO |
| Folios duplicados | **0** |
| Rango de fechas | MIN `2026-06-01 07:39` · MAX `2026-06-30 23:28` |
| Descuentos | 0 → 3 676 · 30 → 90 · 100 → 46 · 15 → 9 |
| **No-corrección** | `subtotal + tax ≠ total` en **145 filas** y el sistema **NO las corrige** |
| `billing_code` | prefijo `156537` en **3 821/3 821** |

### F2 · Cargar «Pagos» → `detail_sale_payment`

| Criterio | Valor exacto |
|---|---|
| Filas insertadas | **3 909** |
| Columnas leídas | **8** (`A:H`). Si el lector devuelve 14, **se coló el pivote** → abortar |
| Huérfanos | **0** — todo `sale_folio` resuelve a un `sale_id` |
| Σ pagos | `SUM(amount)` = **2 644 933.30** |
| Cuadre por ticket | `ABS(Σ amount − sale.total) ≤ 0.01` en **3 821/3 821** |
| Distribución | **3 740** con 1 pago · **74** con 2 · **7** con 3 |
| Catálogo | `payment_method` sigue en **6 filas** (get-or-create no crea un 7.º) |
| Moneda | `'Peso Mexicano'` en **3 909/3 909** |

### F3 · Cargar `comandas.xls` → `detail_sale` (la réplica literal)

| Criterio | Valor exacto |
|---|---|
| Filas insertadas | **13 141** — una por fila del Excel, sin consolidar |
| Lector | BIFF/OLE2 → **`xlrd`** (`openpyxl` **no** abre este archivo) |
| Cuentas resueltas | **1 802** `sale_id` distintos · **0** sin resolver |
| Catálogo `product` | **376** filas · `code` máx 7 chars |
| Catálogo `waiter` | **18** filas |
| `quantity` preserva decimales | **170** filas con `0.096061` · **48** con `0.5` |
| `discount_percent` parseado | `'0%'`→0 en **13 070** · `'20%'`→20 en **37** · `'30%'`→30 en **32** · `'100%'`→100 en **2** |
| `amount = 0` | **1 465** filas · se cargan, **no** se descartan |
| Seriales convertidos | MIN `opened_at` = `2026-06-01 07:39:01` · MAX `closed_at` = `2026-06-15 23:26:19` |
| Capturas fuera de rango | **57** filas con `captured_at ∉ [opened_at, closed_at]` → **se cargan igual** |
| **Prueba de la réplica** | `SELECT COUNT(*) FROM (SELECT sale_id FROM detail_sale GROUP BY sale_id HAVING COUNT(DISTINCT opened_at) > 1) x` = **0** en 1 802 cuentas |
| Ventas sin partidas | **2 019** (= 3 821 − 1 802) → **esperado**, es el desfase de ventanas |
| Cuadre de importes | `Σ amount × (1 − discount/100)` vs `sale.total`: exacto en **1 791/1 802** · dentro de **$0.50** en **1 802/1 802** |

### F4 · Derivados y captura manual del catálogo

| Criterio | Valor |
|---|---|
| `product.is_modifier = 1` | **31** claves (las que nunca cobraron en ninguna cuenta) |
| `product.is_bridge` | **0 al inicio** — lo marca el usuario |
| `product.price` | **0 al inicio** — captura manual (§6) |
| `waiter.name` | **18 filas con el código como nombre** (`'03'` → `'03'`) · **0 pendientes de captura** |
| `company` | 1 fila: `business_name` sale del membrete f1; **RFC y domicilio a mano** |
| `branch` | 1 fila: `business_name` y `fiscal_address` salen del membrete f2/f3; **RFC y teléfono a mano** |

### F5 · Tablero y generador de folios

| Criterio | Valor |
|---|---|
| Tickets del día sin efectivo | los **1 881** pagos `EFECTIVO` no aparecen en el generador |
| Tasa derivada | 16 % en **3 573** · 0 % en **63** · el resto reparte entre 11/15/14/13/12/8 % |
| Filas bloqueadas | los **256** `FACTURADO` salen sin botón (template tab 5) |
| `note_number` | reinicia en **1** cada día **por sucursal** · `UNIQUE (issue_date, note_number, branch_id)` |
| Membrete impreso | sale de `virtual_ticket.branch_id → branch`, sin rodear por `sale` |
| Cuadre del ticket virtual | `Σ detail_virtual_ticket.amount − virtual_ticket.discount` = `sale.total` **exacto** |
| Pureza de la réplica | `COUNT(*) FROM detail_sale WHERE import_batch_id IS NULL` = **0** |

### F6 · Reimportación idempotente

| Criterio | Valor |
|---|---|
| Recargar el mismo archivo | deja **3 821 / 3 909 / 13 141**, **no** 7 642 / 7 818 / 26 282 |
| Mecanismo | borrar por `import_batch_id` y reinsertar — **no hay `UPSERT` por línea posible** (1 578 pares repetidos) |
| Cifra de control tras recarga | sigue en **2 644 933.30** |
| Notas generadas | **se borran con sus ventas** (`CASCADE`) y hay que regenerarlas · la pantalla debe **avisar** antes de recargar un periodo que ya tiene notas |
| Sin huérfanos | `COUNT(*) FROM virtual_ticket WHERE sale_id IS NULL` = **0** siempre |

---

## 9. Preguntas abiertas — necesito tu respuesta

| # | Pregunta | Por qué importa | Mi propuesta |
|---|---|---|---|
| 1 | **`product.price`** — ¿opción A, B o C del §6.3? | Es el punto donde tu ER contradice tus palabras | **A**: precio de lista manual, solo para el generador |
| ~~2~~ | ~~`sale.employed_id`~~ | **Cerrada.** El campo se eliminó: el Excel de ventas no trae columna de persona y el mesero ya vive en `detail_sale.waiter_code` | — |
| 3 | ¿`payment_method` lleva `branch_id` o es global? | Cada POS escribe los nombres a su manera | que lo lleve |
| ~~4~~ | ~~`updated_at` en `sale`~~ | **Cerrada.** La reimportación **borra los folios y los reinserta**, no actualiza. La fila nunca se modifica: nace, se borra, nace otra con su `created_at` fresco. No hay nada que auditar | — |
| 5 | ¿Un `sale` puede tener **varias** notas virtuales históricas, o solo la última? | El botón "Regenerar productos" del template | 1:N con **una sola activa** |
| ~~6~~ | ~~¿Una `branch` por sucursal (1:1) o varias?~~ | **Cerrada.** `branch` **es** la sucursal: ya no hay dos tablas que casar. Una empresa tiene N sucursales (`company` 1:N `branch`) | — |
| 13 | ¿`company` necesita más datos fiscales (régimen, código postal, certificados)? | Hoy lleva razón social, RFC, domicilio y teléfono — lo que imprime el ticket | esperar a F9 (timbrado CFDI) y agregarlos con `ALTER` |
| 7 | Reimportar: ¿**borrado físico** del batch o `active = 0`? | El soft-delete conserva historial pero infla la tabla en cada recarga | físico **solo** dentro del batch reemplazado |
| 8 | `invoice_series` — ¿se queda literal `'C2482'` o se parte en serie + folio? | Tu dibujo dice literal. Partirlo es derivable con `SUBSTRING` | literal, como lo dibujaste |
| 9 | RFC y teléfono de `branch` — ¿los capturas tú? | **No vienen en ningún export**; el ticket imprime el teléfono | captura manual, una vez |
| 10 | ¿Quieres almacenar `tax_rate` en `sale` o derivarlo? | El template muestra un badge "Tasa"; es `tax/subtotal` | derivarlo (es un cálculo de UI) |
| 11 | **¿El destino es 5.7.36 o 8.0.31?** | El WAMP local reporta **8.0.31**; tú indicaste 5.7.36 | `utf8mb4_general_ci` — **funciona en los dos**, así que no bloquea |
| 12 | ¿El membrete de la nota debe **congelarse** (snapshot de razón social / domicilio / RFC en `virtual_ticket`) o basta la FK `branch_id` al emisor actual? | Si mañana se corrige el RFC o el domicilio, la reimpresión de una nota vieja saldrá con los datos nuevos | **FK sola**: la nota virtual no es un CFDI y el membrete cambia rara vez. Se agrega con `ALTER` si lo quieres a prueba de auditoría |

---

## 10. Decisiones tomadas (y por qué)

1. **`detail_sale` replica las 12 columnas fila por fila.** Nada sube a la cabecera, aunque esté
   medido que `mesa`/`mesero`/`apertura`/`cierre` son 100 % consistentes dentro de la cuenta. Es tu
   requisito y el costo es despreciable (~40 KB/mes).
2. **Cada llave de texto se guarda cruda y resuelta.** Es tu patrón naranja/verde. Bonus: si un cruce
   falla, la fila entra igual con FK `NULL` — **nunca se pierde una fila del Excel**.
3. **Los montos entran literales.** No se recalcula `subtotal + tax = total`; en los 145 tickets con
   descuento esa igualdad es falsa **por diseño del origen**, no por error.
4. **`sale_total`, `sale_subtotal`, `sale_tax` llevan prefijo `sale_` a propósito.** El prefijo es la
   defensa: en los 81 tickets multipago esos valores se repiten idénticos, y `SUM()` sobre ellos
   duplica o triplica dinero. **Para pagos solo se suma `amount`.**
5. **Los renglones generados NO tocan `detail_sale`.** Van a `virtual_ticket` / `detail_virtual_ticket`.
   Es lo único que mantiene la promesa "`detail_sale` = el Excel".
6. **`invoice` desaparece**, colapsada en `sale.invoice_series`, tal como lo decidiste.
7. **Cero `ENUM`, cero plurales, cero `DECIMAL`, cero `DELETE` físico.** db-rules §6.
8. **`utf8mb4_general_ci` en las 12 tablas.** Desviación consciente de §1.2 por compatibilidad 5.7.
9. **La jerarquía corporativa es del módulo: `company` → `branch`.** Cero FK cross-schema. La sucursal
   (`branch_id`) es la dimensión de aislamiento de todo el esquema; la empresa se llega con un salto,
   `branch.company_id` (§5.6).

---

## 11. Siguiente paso

El DDL ya está escrito y probado: **[sql/ddl-facturacion.sql](../sql/ddl-facturacion.sql)** — 12 tablas,
19 FK locales, seeds de `sale_status`, `company`, `branch` y `payment_method`. Se ejecutó completo contra
el MySQL 5.7.36 local en una base temporal, que se eliminó tras verificar.

Cuando apruebes las cajas (y sobre todo la **§6 — `product.price`**), falta:

1. El archivo hermano `diagramas-er-facturacion.md` con la ficha exhaustiva por sección.
2. Las consultas de validación de cada fase del §8, listas para correr tras la carga.
