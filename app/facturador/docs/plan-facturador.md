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
| `fayxzvov_alpha.subsidiaries` | existe · `id INT PK`, `name`, `companies_id`, `active` |
| `fayxzvov_alpha.usr_users` | existe · `id INT PK`, `fullname`, `subsidiaries_id`, `active` |
| `companies` en `fayxzvov_alpha` | **no existe ahí** → vive en **`fayxzvov_admin.companies`** |
| Collation de los maestros | `latin1_swedish_ci` (legacy) |

Dos consecuencias directas:

1. **`utf8mb4_general_ci` es la elección correcta y además la segura.** Existe en 5.7 y en 8.0; el
   `utf8mb4_0900_ai_ci` que pide db-rules §1.2 **no existe en 5.7**. Se documenta como desviación
   consciente de la regla, no como descuido.
2. **Los maestros son `latin1_swedish_ci` y no se tocan.** Las FK cross-schema van `INT → INT`, y la
   collation no interviene en comparaciones numéricas. La regla operativa que sí importa:
   **nunca hacer `JOIN` por texto contra `alpha` o `admin`** — solo por `id`.

> El precedente ya existe en el servidor: `fayxzvov_alpha.evt_clausules.companies_id` referencia
> `fayxzvov_admin.companies(id)` cross-schema. No estoy inventando un patrón.

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
  `product` (`claveproducto` + `descripcion`), `waiter` (`mesero`), `branch` (membrete del Excel).
- **Detalles:** `detail_sale` (comandas), `detail_sale_payment` (Pagos).
- **Pivotes N:M:** **ninguno.** No hay relación muchos-a-muchos en este dominio.
- **Maestros corporativos:** `subsidiaries` y `usr_users` en `fayxzvov_alpha`, `companies` en
  `fayxzvov_admin`. **Cross-schema, no se duplican.**
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
| 1 | `branch` | catálogo | **[NUEVO]** | ER del usuario (antes `issuer`) |
| 2 | `sale_status` | catálogo | **[NUEVO]** | ER del usuario |
| 3 | `payment_method` | catálogo | **[NUEVO]** | ER del usuario |
| 4 | `product` | catálogo | **[NUEVO]** | ER del usuario |
| 5 | `waiter` | catálogo | **[NUEVO]** ★ | **añadido** — ver §5.3 |
| 6 | `import_batch` | catálogo técnico | **[NUEVO]** ★ | **añadido** — ver §5.4 |
| 7 | `sale` | transacción raíz | **[NUEVO]** | ER del usuario |
| 8 | `virtual_ticket` | transacción raíz | **[NUEVO]** ★ | **añadido** — ver §5.5 |
| 9 | `detail_sale` | detalle | **[NUEVO]** | ER del usuario |
| 10 | `detail_sale_payment` | detalle | **[NUEVO]** | ER del usuario |
| 11 | `detail_virtual_ticket` | detalle | **[NUEVO]** ★ | **añadido** — ver §5.5 |
| — | `subsidiaries`, `usr_users`, `companies` | maestros | **[REUSO]** | cross-schema, no se tocan |

**11 tablas nuevas, 0 pivotes.** La tabla `invoice` del modelo anterior **desapareció** — colapsada en
`sale.invoice_series`, tal como lo decidiste.

### 3.2 Renombres respecto a tu dibujo (véta el que no te guste)

Ningún cambio es de criterio: todos salen de db-rules §2.2 (columnas snake_case **en inglés**, `_id`
reservado a FK). Los listo para que los puedas rechazar de un vistazo.

| Tu dibujo | Propuesta | Por qué |
|---|---|---|
| `sale.create_at` | `created_at` **+ `updated_at`** | typo, y §2.3 exige ambos |
| `sale.subsidiarie_id` | `subsidiaries_id` | la tabla destino se llama `subsidiaries` |
| `sale.employed_id` | `usr_users_id` | en `fayxzvov_alpha` **no existe** tabla `employed`; el maestro de personas es `usr_users` · ⚠️ además hay duda de significado, §6.2 |
| `detail_sale.orden` | `table_number` | inglés; `orden` se lee como "pedido" y el dato es **el número de mesa** (12, 19, 33…) |
| `detail_sale.descripcion` | `description` | inglés |
| `detail_sale.code_product` | `product_code` | inglés (sustantivo + calificador) |
| `detail_sale.folio` | `sale_folio` | `folio` a secas colisiona con `sale.folio` en cualquier `JOIN` |
| `detail_sale_payment.folio` | `sale_folio` | ídem |
| `detail_sale.waiter_id` (naranja) | `waiter_code` **+** `waiter_id` | `_id` está reservado a FK. El Excel trae texto `'03'`, no un id |

### 3.3 🗺️ Diagrama de relaciones

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  MAESTROS CORPORATIVOS  ·  cross-schema  ·  NO se duplican  ·  latin1_swedish_ci (legacy)        │
│                                                                                                  │
│   fayxzvov_admin          fayxzvov_alpha            fayxzvov_alpha                               │
│   ┌──────────────────┐    ┌──────────────────┐      ┌──────────────────┐                         │
│   │ companies        │    │ subsidiaries     │      │ usr_users        │                         │
│   │ • id         PK  │◀───│ • id         PK  │      │ • id         PK  │                         │
│   │ • social_name    │    │ • name           │      │ • fullname       │                         │
│   │ • rfc            │    │ • companies_id   │      │ • subsidiaries_id│                         │
│   └──────────────────┘    └────────┬─────────┘      └────────┬─────────┘                         │
│    la empresa se llega             │                         │                                   │
│    por aquí, no baja               │                         │                                   │
└────────────────────────────────────┼─────────────────────────┼───────────────────────────────────┘
                                     │ subsidiaries_id         │ usr_users_id
                                     ▼                         ▼
╔══════════════════════════════════════════════════════════════════════════════════════════════════╗
║  fayxzvov_facturacion   ·   [ESQUEMA NUEVO]   ·   InnoDB · utf8mb4 · utf8mb4_general_ci          ║
║                                                                                                  ║
║  ── CATÁLOGOS ─────────────────────────────────────────────────────────────────────────────────  ║
║                                                                                                  ║
║   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         ║
║   │ sale_status      │  │ payment_method   │  │ product          │  │ waiter   [NUEVO] │         ║
║   │ • id         PK  │  │ • id         PK  │  │ • id         PK  │  │ • id         PK  │         ║
║   │ • name           │  │ • name           │  │ • code           │  │ • code           │         ║
║   │   VENCIDO /      │  │ • is_cash        │  │ • name           │  │ • name  (manual) │         ║
║   │   FACTURADO      │  │                  │  │ • is_bridge   ★  │  │                  │         ║
║   │                  │  │                  │  │ • is_modifier ★  │  │                  │         ║
║   │                  │  │                  │  │ • price      ⚠   │  │                  │         ║
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
║   └──────────────────┘                                                                           ║
║                                                                                                  ║
║   ┌──────────────────┐                                                                           ║
║   │ branch   [NUEVO] │──── 1:1 ────▶ alpha.subsidiaries   (de ahí sale companies_id)             ║
║   │ • id         PK  │                                                                           ║
║   │ • business_name  │           cabecera impresa del ticket virtual                             ║
║   │ • rfc            │           (RFC y teléfono = captura manual, no vienen en el export)       ║
║   │ • fiscal_address │                                                                           ║
║   │ • phone          │◀─── la referencia el ticket por virtual_ticket.branch_id                  ║
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
║   │ • subsidiaries_id  ─→alpha │            │ • opened_at · closed_at      │                     ║
║   │ • usr_users_id     ─→alpha │            │ • captured_at                │                     ║
║   │ • import_batch_id     FK   │            │ • sale_id · product_id  FK   │                     ║
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
║   │ • branch_id           FK   │            │ • virtual_ticket_id     FK   │                     ║
║   │ • subsidiaries_id  ─→alpha │            │ • product_id            FK   │                     ║
║   │ • usr_users_id     ─→alpha │            └──────────────────────────────┘                     ║
║   └────────────────────────────┘                                                                 ║
║                                                                                                  ║
║   ★ campo que el dibujo omitía y se añade      ┄ llave de cruce por texto (no es FK)             ║
║   ⚠ punto a confirmar — ver §6                 ─→ FK cross-schema                                ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════╝
```

### 3.4 Cardinalidades

| Origen | → | Destino | Cardinalidad | ON DELETE |
|---|---|---|---|---|
| `sale` | → | `detail_sale` | 1 : N | CASCADE |
| `sale` | → | `detail_sale_payment` | 1 : N | CASCADE |
| `sale` | → | `virtual_ticket` | 1 : N (1 activa) | CASCADE |
| `virtual_ticket` | → | `detail_virtual_ticket` | 1 : N | CASCADE |
| `branch` | → | `virtual_ticket` | 1 : N | SET NULL |
| `sale` | → | `sale_status` | N : 1 | SET NULL |
| `sale` | → | `import_batch` | N : 1 | SET NULL |
| `detail_sale` | → | `product` | N : 1 | SET NULL |
| `detail_sale` | → | `waiter` | N : 1 | SET NULL |
| `detail_sale` | → | `import_batch` | N : 1 | SET NULL |
| `detail_sale_payment` | → | `payment_method` | N : 1 | SET NULL |
| `detail_sale_payment` | → | `import_batch` | N : 1 | SET NULL |
| `detail_virtual_ticket` | → | `product` | N : 1 | SET NULL |
| `branch` | → | `alpha.subsidiaries` | **1 : 1** | SET NULL |
| `sale` | → | `alpha.subsidiaries` | N : 1 | SET NULL |
| `sale` | → | `alpha.usr_users` | N : 1 | SET NULL |
| `virtual_ticket` | → | `alpha.subsidiaries` | N : 1 | SET NULL |
| `virtual_ticket` | → | `alpha.usr_users` | N : 1 | SET NULL |
| `import_batch` | → | `alpha.subsidiaries` · `alpha.usr_users` | N : 1 | SET NULL |
| `product` · `waiter` · `payment_method` | → | `alpha.subsidiaries` | N : 1 | SET NULL |

> **Ninguna tabla del módulo referencia `admin.companies`.** El aislamiento es **por sucursal**: toda tabla
> que se puebla con datos del POS lleva `subsidiaries_id`. La empresa, cuando se necesite para un reporte
> corporativo, se obtiene con un salto — `subsidiaries.companies_id`.

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
│ branch  (catálogo — emisor fiscal · 1:1 con la sucursal)                                         │
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
│  ── FK cross-schema ──                                                                           │
│  subsidiaries_id    → alpha.subsidiaries  [SISTEMA]  la sucursal que emite       SET NULL        │
│                                                                                                  │
│  ── Soft-delete ──                                                                               │
│  active             TINYINT               [SISTEMA]                                              │
│                                                                                                  │
│  ── Índices ──                                                                                   │
│  UNIQUE  uk_branch_subsidiary (subsidiaries_id)   ← fuerza el 1:1                                │
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
│  ── FK cross-schema ──                                                                           │
│  subsidiaries_id    → alpha.subsidiaries  [SISTEMA]  AÑADIDO · sucursal   SET NULL               │
│                                                                                                  │
│  ── Soft-delete ──                                                                               │
│  active             TINYINT               [SISTEMA]                                              │
│                                                                                                  │
│  ── Índices ──                                                                                   │
│  UNIQUE  uk_payment_method_name (name, subsidiaries_id)                                          │
│  KEY     idx_payment_method_cash (is_cash, active)                                               │
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
│  ── FK cross-schema ──                                                                           │
│  subsidiaries_id    → alpha.subsidiaries  [SISTEMA]  AÑADIDO · sucursal   SET NULL               │
│                                                                                                  │
│  ── Soft-delete ──                                                                               │
│  active             TINYINT               [SISTEMA]                                              │
│                                                                                                  │
│  ── Índices ──                                                                                   │
│  UNIQUE  uk_product_code (code, subsidiaries_id) ← get-or-create                                 │
│  KEY     idx_product_generator (is_bridge, is_modifier, active)                                  │
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
│  ── FK cross-schema ──                                                                           │
│  subsidiaries_id    → alpha.subsidiaries  [SISTEMA] sucursal              SET NULL               │
│                                                                                                  │
│  ── Soft-delete ──                                                                               │
│  active             TINYINT               [SISTEMA]                                              │
│                                                                                                  │
│  ── Índices ──                                                                                   │
│  UNIQUE  uk_waiter_code (code, subsidiaries_id)  ← get-or-create                                 │
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
│  ── FK cross-schema ──                                                                           │
│  subsidiaries_id    → alpha.subsidiaries  [SISTEMA] sucursal de la carga  SET NULL               │
│  usr_users_id       → alpha.usr_users     [SISTEMA] quién subió el archivo  SET NULL             │
│                                                                                                  │
│  ── Soft-delete ──                                                                               │
│  active             TINYINT               [SISTEMA]                                              │
│                                                                                                  │
│  ── Índices ──                                                                                   │
│  KEY     idx_import_period (period_year, period_month, sheet_name)                               │
│  KEY     subsidiaries_id · usr_users_id                                                          │
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
│  operation_day      DATE                  [DERIVADO] AÑADIDO · DATE(V·C) · índice del tablero    │
│  expires_at         DATETIME              V·H «Fecha de expiración» · fin de mes 23:59:59        │
│  created_at         DATETIME              [SISTEMA]  (el dibujo decía «create_at»)               │
│  updated_at         DATETIME              [SISTEMA]  AÑADIDO · §2.3 lo exige                     │
│                                                                                                  │
│  ── Status ──                                                                                    │
│  sale_status_id     → sale_status         V·I «Estado» resuelto por name    SET NULL             │
│                                                                                                  │
│  ── FK cross-schema ──                                                                           │
│  subsidiaries_id    → alpha.subsidiaries  [SISTEMA] (dibujo: subsidiarie_id)  SET NULL           │
│  usr_users_id       → alpha.usr_users     [SISTEMA] (dibujo: employed_id) ⚠ §6  SET NULL         │
│                                                                                                  │
│  ── FK locales ──                                                                                │
│  import_batch_id    → import_batch        [SISTEMA]  AÑADIDO · trazabilidad  SET NULL            │
│                                                                                                  │
│  ── Soft-delete ──                                                                               │
│  active             TINYINT               [SISTEMA]                                              │
│                                                                                                  │
│  ── Índices ──                                                                                   │
│  UNIQUE  uk_sale_folio (folio, subsidiaries_id)                                                  │
│  UNIQUE  uk_sale_billing_code (billing_code, subsidiaries_id)                                    │
│  KEY     idx_sale_day (operation_day, sale_status_id)  ← tablero del día                         │
│  KEY     sale_status_id · subsidiaries_id                                                        │
│  KEY     usr_users_id · import_batch_id                                                          │
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
│  issue_date         DATE                  [DERIVADO] = sale.operation_day del ticket origen      │
│  created_at         DATETIME              [SISTEMA]                                              │
│  updated_at         DATETIME              [SISTEMA]                                              │
│                                                                                                  │
│  ── FK cross-schema ──                                                                           │
│  subsidiaries_id    → alpha.subsidiaries  [DERIVADO] = sale.subsidiaries_id · SUCURSAL emisora   │
│                                           de la nota. El consecutivo vive aquí.   SET NULL       │
│  usr_users_id       → alpha.usr_users     [SISTEMA] quién generó la nota  SET NULL               │
│                                                                                                  │
│  ── FK locales ──                                                                                │
│  sale_id            → sale                [DERIVADO] ticket real que respalda  CASCADE           │
│  branch_id          → branch              [DERIVADO] EMISOR del membrete impreso: razon social,  │
│                                           domicilio, RFC, telefono            SET NULL           │
│                                                                                                  │
│  ── Soft-delete ──                                                                               │
│  active             TINYINT               [SISTEMA] regenerar = active=0 + nota nueva            │
│                                                                                                  │
│  ── Índices ──                                                                                   │
│  UNIQUE  uk_virtual_ticket_note (issue_date, note_number, subsidiaries_id)                       │
│          ↑ el consecutivo diario es POR SUCURSAL: dos sucursales pueden emitir su                │
│            «Nota #12» el mismo día sin chocar                                                    │
│  KEY     sale_id · branch_id · subsidiaries_id · usr_users_id                                    │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```


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
| C | `Fecha` | `sale.operation_date` **+** `sale.operation_day` | DATETIME literal + DATE derivado para el índice |
| D | `Descuento` | `sale.discount_percent` | **es porcentaje**, no monto |
| E | `Subtotal` | `sale.subtotal` | literal, sin recalcular |
| F | `Impuestos` | `sale.tax` | literal, sin recalcular |
| G | `Total` | `sale.total` | autoritativo · Σ = **2 644 933.30** |
| H | `Fecha de expiración` | `sale.expires_at` | fin de mes 23:59:59 |
| I | `Estado` | `sale.sale_status_id` → `sale_status.name` | texto verbatim conservado en el catálogo |
| J | `Folio factura` | `sale.invoice_series` | `'C2482'` literal · vacío en 3 565 |
| f1 | *(membrete)* `COMIENDO EN CHIAPAS` | `admin.companies.social_name` | **maestro cross-schema, no se duplica** |
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

### 5.5 ★ `virtual_ticket` + `detail_virtual_ticket` — así se separa lo importado de lo generado

**Este es el punto de diseño más importante del módulo**, y sale directo de la tensión entre tus dos
requisitos:

> "`detail_sale` es réplica literal del Excel" **vs.** "el generador crea tickets con productos puente"

Si los renglones generados se metieran en `detail_sale`, esa tabla dejaría de ser una réplica: tendría
filas que **no existen en ningún Excel**, y cualquier auditoría "Excel vs BD" fallaría para siempre.

**Solución: los renglones generados viven en su propia tabla.** `detail_sale` queda intocada — 13 141
filas, 13 141 filas del Excel, punto. Y el ticket virtual queda modelado como lo que realmente es:
**un documento aparte que se imprime, respaldado por una venta real**.

Lo que necesita, tomado del template `facturador.html` (tab 5):

| Elemento del ticket impreso | Campo |
|---|---|
| `NOTA: #12` — consecutivo que **se reinicia cada día** (ERS §Observaciones) | `virtual_ticket.note_number` + `UNIQUE (issue_date, note_number, subsidiaries_id)` |
| `SUBTOTAL: $3,050.00` | `virtual_ticket.subtotal` |
| `DESCUENTO: -$15.10` — el ajuste de cuadre | `virtual_ticket.discount` |
| `TOTAL: $3,034.90` — debe igualar el ticket real | `virtual_ticket.total` = `sale.total` |
| `2  Parrillada Argentina   $1,290.00` | `detail_virtual_ticket.quantity` / `description` / `amount` |
| `RESTAURANT` / dirección / teléfono / RFC | **`virtual_ticket.branch_id` → `branch`** (FK directa, sin rodeo) |
| `MESA: 9` / `MESERO: 03` | `detail_sale.table_number` / `waiter.name` (por defecto = el código) |
| Botón *"Regenerar productos"* | `active = 0` en la nota anterior + nota nueva |

**Por qué `virtual_ticket` lleva `subsidiaries_id` propio y no lo hereda de `sale`:**

1. **La nota la emite una sucursal, no una empresa.** El membrete impreso (`CAFE DE CHIAPAS SUC.
   POLIFORUM`, domicilio, teléfono) sale de `branch`, y `branch` cuelga de `subsidiaries` con
   `UNIQUE (subsidiaries_id)`. Sin la sucursal en la nota no hay forma de resolver qué membrete imprimir
   salvo dando un rodeo por `sale`.
2. **El consecutivo diario es por sucursal.** El «Nota #12» de hoy pertenece a un talonario, y el talonario
   es de la sucursal que lo emite. Anclado a cualquier cosa más amplia, dos sucursales que generen su
   «Nota #12» el mismo día **chocan**: la segunda falla al insertar.
3. **`sale` ya lleva `subsidiaries_id`**, así que el generador solo lo copia. Es redundancia deliberada,
   igual que en `import_batch`: una raíz que se consulta y se imprime por sucursal debe poder filtrarse
   sin `JOIN`.

**Y `branch_id` como FK directa al emisor.** Los dos campos parecen redundantes — `branch` es 1:1 con
`subsidiaries` — pero cada uno tiene un consumidor distinto y ninguno sustituye a otro:

| Campo | Para qué | Si falta |
|---|---|---|
| `branch_id` | **imprimir el membrete**: razón social, domicilio, RFC, teléfono | hay que rodear `virtual_ticket → sale → subsidiaries → branch` en cada impresión |
| `subsidiaries_id` | el `UNIQUE` del consecutivo diario y el filtro por sucursal | el folio choca entre sucursales |

El `UNIQUE` **no** se mueve a `branch_id`: una sucursal puede existir sin tener su `branch` capturado
todavía, y en ese caso `branch_id` quedaría `NULL` — un `UNIQUE` con `NULL` deja de bloquear duplicados en
MySQL. El consecutivo se ancla a `subsidiaries_id`, que siempre está.

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
1. Toma los tickets del día:  sale.operation_day = :fecha
2. Excluye los de efectivo:   no existe pago con payment_method.is_cash = 1
3. Excluye los ya facturados: sale_status.name <> 'FACTURADO'   (fila bloqueada en el template)
4. Detecta los de tasa 0:     ROUND(tax / NULLIF(subtotal,0), 2) = 0
5. Arma la combinación:       product WHERE is_bridge = 1 AND is_modifier = 0 AND price > 0
6. Cuadra:                    discount = Σ(líneas) − sale.total
```

### 5.6 `subsidiaries_id` — el aislamiento es por SUCURSAL

**Regla:** lleva `subsidiaries_id` toda tabla que se puebla con datos del POS. **Ninguna tabla del módulo
referencia `admin.companies`.**

| Lleva `subsidiaries_id` | No lleva |
|---|---|
| `sale`, `detail_sale`\*, `detail_sale_payment`\*, `branch`, `product`, `waiter`, `payment_method`, `import_batch`, `virtual_ticket` | `sale_status` |

\* Los detalles lo heredan por `sale_id`; **no** se les pone columna propia, para no repetir la sucursal en
13 141 filas. El filtro entra por el `JOIN` con `sale`.

**Por qué la sucursal y no la empresa.** Cada export viene de **un POS**, y ese POS es de una sucursal
concreta (`CAFE DE CHIAPAS SUC. POLIFORUM`). Todo lo que sale de ese archivo le pertenece a ella:

- La **clave de producto es local al POS**. El código `01184` de una sucursal no tiene por qué ser el mismo
  platillo en otra. Con el `UNIQUE` a nivel empresa, la segunda sucursal que cargara su catálogo chocaría
  contra el de la primera o —peor— *reutilizaría* su producto y mezclaría los importes.
- Lo mismo con el **código de mesero** (`'03'` es un mesero distinto en cada sucursal) y con el **folio**
  del ticket: el consecutivo del POS es por sucursal, así que `UNIQUE (folio, subsidiaries_id)`.
- Los **nombres de método de pago** los escribe cada POS a su manera.

La empresa no se pierde: se obtiene con un salto, `subsidiaries.companies_id`. Ese salto solo hace falta
para un reporte corporativo que sume varias sucursales — el 100 % de la operación diaria filtra por
sucursal, que es justo el campo que está en la tabla.

`sale_status` queda global: son 2 valores del formato del POS (`VENCIDO`/`FACTURADO`), no de nadie
en particular.

### 5.7 `sale.operation_day` — 1 columna que salva el tablero

`V·C «Fecha»` es un `DATETIME` con hora (`2026-06-01 07:39`). Guardarlo como `DATE` **pierde la hora**,
que el ticket imprime (`FECHA: 10/06/2026 19:47`). Guardarlo solo como `DATETIME` obliga a filtrar con
`DATE(operation_date) = :fecha`, lo que **anula el índice**.

Como el generador de folios consulta *"los tickets de este día"* en cada carga de pantalla, se añade
`operation_day DATE` indexada. En MySQL 5.7+ puede declararse `GENERATED ALWAYS AS (DATE(operation_date)) STORED`
y entonces no hay riesgo de que se desincronice. → **§9.4.**

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
   AND s.operation_day <= :fecha     -- el precio que regía ESE día
 ORDER BY s.operation_day DESC, d.id DESC
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
| 7.1 | Clasificación por clase de tabla | ✅ 6 catálogos · 2 raíz · 3 detalles · 0 pivotes |
| 7.1 | Prefijo `detail_` solo en renglones de transacción raíz | ✅ `detail_sale`, `detail_sale_payment`, `detail_virtual_ticket` — todos cuelgan de una raíz |
| 7.2 | Tablas en singular, snake_case, inglés | ✅ 11/11 |
| 7.2 | Columnas snake_case inglés · PK `id` · FK `<tabla>_id` | ✅ tras los renombres del §3.2 |
| 7.2 | `KEY` con el mismo nombre que la columna | ✅ |
| 7.3 | `id`, `active`, `created_at`, `updated_at` en toda tabla | ⚠️ 10/11 — `sale_status` va **sin timestamps** por decisión del usuario (ver desviaciones) |
| 7.3 | Raíz con `subsidiaries_id` / `usr_users_id` | ✅ `sale`, `virtual_ticket` |
| 7.3 | Flujo con `status` → catálogo + FK | ✅ `sale_status_id` |
| 7.4 | **Montos en `DOUBLE`**, nunca `DECIMAL` | ✅ 16/16 campos monetarios |
| 7.4 | Nombres en `VARCHAR`, nunca `TEXT` | ✅ |
| 7.4 | Estados extensibles → catálogo, **nunca `ENUM`** | ✅ 0 `ENUM` |
| 7.4 | Fecha de negocio `DATE` · auditoría `DATETIME` | ✅ (`operation_date` es DATETIME **a propósito** — §5.7) |
| 7.5 | FK con `CONSTRAINT` explícito + `KEY` | ✅ |
| 7.5 | Política ON DELETE: detalle→raíz CASCADE · →catálogo SET NULL · →maestro SET NULL | ✅ tabla §3.4 |
| 7.5 | Maestros cross-schema, **no duplicados** | ✅ `subsidiaries` · `usr_users` · `companies` |
| 7.6 | Sin `DELETE` físico → `active = 0` | ✅ (por eso `detail_sale_payment` necesitaba `active`) |
| 7.7 | InnoDB · utf8mb4 · collation única en el esquema | ✅ `utf8mb4_general_ci` en 11/11 |
| 7.7 | Orden: id → negocio → montos → fechas → timestamps → status → FKs → active | ✅ en las 11 cajas |

### ⚠️ Desviaciones conscientes de db-rules (4)

| Regla | Desviación | Motivo |
|---|---|---|
| §1.2 collation `utf8mb4_0900_ai_ci` | se usa **`utf8mb4_general_ci`** | **no existe en MySQL 5.7**, que indicaste como destino. `general_ci` funciona en 5.7 y 8.0 |
| §5.3 maestros en `rfwsmqex_erp` | se usan **`fayxzvov_alpha`** y **`fayxzvov_admin`** | es el tenant real de este proyecto, verificado en el servidor |
| §3.2 `operation_date` como `DATE` | es **`DATETIME`** + `operation_day DATE` | el origen trae hora y el ticket la imprime; truncar perdería dato |
| §2.3 `created_at` / `updated_at` obligatorios | `sale_status` va **sin timestamps** | seed fijo de 2 filas que se dan de alta una vez y no se editan: no hay nada que auditar. `id`, `name` y `active` bastan |

---

## 8. Plan de implementación por fases

Cada fase tiene **criterios numéricos**. Si un número no da, la fase no pasa.

### F0 · Crear el esquema y los catálogos

| Entregable | Criterio de aceptación |
|---|---|
| `CREATE DATABASE fayxzvov_facturacion` | `SHOW DATABASES` lo lista |
| 11 tablas | `COUNT(*) FROM information_schema.TABLES = 11` |
| Collation uniforme | `COUNT(DISTINCT TABLE_COLLATION) = 1` y vale `utf8mb4_general_ci` |
| Seed `sale_status` | **2 filas**: `VENCIDO`, `FACTURADO` |
| Seed `payment_method` | **6 filas** · `is_cash = 1` **solo** en `EFECTIVO` |
| FK cross-schema | las 3 constraints a `alpha`/`admin` se crean sin error (INT→INT) |

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
| `branch` | 1 fila: `business_name` y `fiscal_address` salen del membrete del Excel; **RFC y teléfono a mano** |

### F5 · Tablero y generador de folios

| Criterio | Valor |
|---|---|
| Tickets del día sin efectivo | los **1 881** pagos `EFECTIVO` no aparecen en el generador |
| Tasa derivada | 16 % en **3 573** · 0 % en **63** · el resto reparte entre 11/15/14/13/12/8 % |
| Filas bloqueadas | los **256** `FACTURADO` salen sin botón (template tab 5) |
| `note_number` | reinicia en **1** cada día **por sucursal** · `UNIQUE (issue_date, note_number, subsidiaries_id)` |
| Membrete impreso | sale de `virtual_ticket.branch_id → branch`, sin rodear por `sale` |
| Cuadre del ticket virtual | `Σ detail_virtual_ticket.amount − virtual_ticket.discount` = `sale.total` **exacto** |
| Pureza de la réplica | `COUNT(*) FROM detail_sale WHERE import_batch_id IS NULL` = **0** |

### F6 · Reimportación idempotente

| Criterio | Valor |
|---|---|
| Recargar el mismo archivo | deja **3 821 / 3 909 / 13 141**, **no** 7 642 / 7 818 / 26 282 |
| Mecanismo | borrar por `import_batch_id` y reinsertar — **no hay `UPSERT` por línea posible** (1 578 pares repetidos) |
| Cifra de control tras recarga | sigue en **2 644 933.30** |

---

## 9. Preguntas abiertas — necesito tu respuesta

| # | Pregunta | Por qué importa | Mi propuesta |
|---|---|---|---|
| 1 | **`product.price`** — ¿opción A, B o C del §6.3? | Es el punto donde tu ER contradice tus palabras | **A**: precio de lista manual, solo para el generador |
| 2 | `sale.employed_id` del dibujo — ¿es **quién cargó el archivo** o **el mesero de la cuenta**? | El Excel de ventas **no trae ninguna columna de persona**. Si es el mesero, el dato está en `comandas.F` y ya vive en `detail_sale` | `usr_users_id` = quien ejecutó la carga |
| 3 | ¿`payment_method` lleva `subsidiaries_id` o es global? | Cada POS escribe los nombres a su manera | que lo lleve |
| 4 | `operation_day` — ¿columna normal o `GENERATED … STORED`? | La generada no se puede desincronizar; la normal es más portable | generada `STORED` |
| 5 | ¿Un `sale` puede tener **varias** notas virtuales históricas, o solo la última? | El botón "Regenerar productos" del template | 1:N con **una sola activa** |
| 6 | ¿Una `branch` por sucursal (1:1) o varias? | Hoy el `UNIQUE` fuerza 1:1 | 1:1 |
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
8. **`utf8mb4_general_ci` en las 11 tablas.** Desviación consciente de §1.2 por compatibilidad 5.7.
9. **Los maestros no se tocan ni se copian.** Son `latin1_swedish_ci`; las FK son `INT→INT` y no les
   afecta. Regla operativa: **nunca `JOIN` por texto contra `alpha` / `admin`.**

---

## 11. Siguiente paso

Cuando apruebes las cajas (y sobre todo la **§6 — `product.price`** y la **§9.2 — `employed_id`**),
genero:

1. El `CREATE TABLE` completo de las 11 tablas + seeds + constraints cross-schema.
2. El archivo hermano `diagramas-er-facturacion.md` con la ficha exhaustiva por sección.
3. Las consultas de validación de cada fase del §8, listas para correr tras la carga.
