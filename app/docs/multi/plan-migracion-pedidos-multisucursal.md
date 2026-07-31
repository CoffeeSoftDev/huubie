# Plan: mover Pedidos de `alpha/` a `app/` con multi-sucursal

> Documento de análisis y plan de migración.
> Fecha: 2026-07-31 · Módulo origen: `alpha/pedidos` · Destino: `app/pedidos`

---

## 1. La foto en una frase

`alpha/pedidos` ya sabe filtrar por sucursal, pero **no sabe quién tiene permiso de ver cuál**.
`app/` ya resolvió exactamente eso (tabla `usr_user_subsidiaries` + validación en el switch de sucursal),
pero su carpeta `pedidos/` está vacía de código: solo tiene bocetos HTML.

**La migración no es "portar multi-sucursal a pedidos". Es mover pedidos a la casa que ya lo tiene.**

Analogía: alpha/pedidos es un inquilino que se instaló su propia cerradura en la puerta del cuarto.
`app/` ya es un edificio con control de acceso en recepción. Al mudarlo, hay que quitarle la cerradura
casera y darle la credencial del edificio — no instalar el control de acceso desde cero.

---

## 2. Qué encontré (diagnóstico)

### 2.1 Lo que juega a favor

| Hecho | Implicación |
|---|---|
| **Misma base de datos** — `alpha/conf/_Conect.php` y `app/conf/_Conect.php` apuntan ambos a `fayxzvov_alpha` | **Cero migración de datos.** No se mueve un solo registro. |
| `app/conf/_Rutes.php` ya define `PATH_PEDIDOS = '/app/pedidos/'` | El slot ya está reservado. |
| `app/conf/_Utileria.php` es **superset** de la de alpha (le agrega `badge()`) | Migrar no pierde helpers, gana uno. |
| `app/conf/_Conect.php` soporta **transacciones** (`beginTransaction/commit/rollback`), alpha no | El cierre de turno y los pagos pueden volverse atómicos. |
| `app/src/js/coffeeSoft.js` (248 KB, 29-jul) es más nuevo que el de alpha (185 KB, 19-jul) | Ver §5 — es a la vez ventaja y riesgo. |
| Los datos **ya están segmentados**: `order` tiene 542 / 162 / 135 pedidos en las 3 sucursales de Reginas | El modelo de datos por sucursal ya funciona en producción. |
| Solo **8 rutas `/alpha/` hardcodeadas**, todas en `navbar.js` y `session-reset-timer.js` | Archivos que se reemplazan de todos modos. Casi no hay deuda de rutas. |

### 2.2 Lo que ya tiene `app` y `alpha` no

Esta es la razón de fondo para mudarse. `app/access` implementa un modelo de acceso que alpha no tiene:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ALPHA — sucursal por COMPAÑÍA                                          │
│                                                                          │
│  getSubsidiariesByCompany(company_id)                                    │
│      └─▶ devuelve TODAS las sucursales de la empresa                     │
│                                                                          │
│  switchBranch(): valida solo que la sucursal sea de tu compañía.         │
│  Permiso de usar el filtro: canUseBranchFilter() en JS                   │
│      └─▶ isAdmin (ROLID 1) || ROLID 2 || ROLID 3   ← lógica en cliente   │
└─────────────────────────────────────────────────────────────────────────┘

┌═════════════════════════════════════════════════════════════════════════┐
║  APP — sucursal por USUARIO (lo que queremos)                           ║
║                                                                          ║
║  ROLID 5 (super) ─▶ getBranchesByCompany(company_id)   [todas]           ║
║  demás roles     ─▶ getBranchesByUser(usr_users_id)    [las suyas]       ║
║                       └── vía pivote usr_user_subsidiaries               ║
║                                                                          ║
║  switchBranch(): valida DOS cosas en el servidor                         ║
║      1. branch.companies_id === $_SESSION['COMPANY_ID']                  ║
║      2. userHasAccessToBranch(usr_users_id, subsidiaries_id)             ║
╚═════════════════════════════════════════════════════════════════════════╝
```

`usr_user_subsidiaries` existe y tiene 9 filas cargadas. Es el pivote N:M usuario↔sucursal
con FKs `ON DELETE CASCADE` a `usr_users` y `subsidiaries`.

> **Diferencia clave de seguridad:** en alpha el permiso vive en JavaScript
> (`canUseBranchFilter()` en [navbar.js:226](../../../alpha/pedidos/src/js/navbar.js#L226)).
> Cualquiera con la consola del navegador abierta puede cambiar de sucursal.
> En `app` la validación es server-side en `switchBranch()`. **Mover pedidos a `app` cierra ese agujero.**

### 2.3 Los 4 bloqueadores reales

#### 🔴 B1 — La base de datos del módulo está clavada a un cliente

```php
// alpha/pedidos/mdl/mdl-pedidos.php:11   (y cierre, personalizado, admin)
$this->bd = 'fayxzvov_reginas.';
```

Aparece en **4 de 6 modelos** y se usa en **243 consultas** (`{$this->bd}`):

| Modelo | Usos de `{$this->bd}` | BD |
|---|---|---|
| `mdl-pedidos.php` | 128 | `fayxzvov_reginas.` hardcodeada |
| `mdl-cierre.php` | 62 | `fayxzvov_reginas.` hardcodeada |
| `mdl-pedidos-personalizado.php` | 29 | `fayxzvov_reginas.` hardcodeada |
| `mdl-admin.php` | 24 | `fayxzvov_reginas.` hardcodeada (con la línea correcta **comentada arriba**) |
| `mdl-projects.php` | 8 | `"{$_SESSION['DB']}."` ✅ **ya correcto** |

Y una consulta con la BD escrita a mano, fuera del patrón:
```php
// mdl-pedidos.php:131
FROM fayxzvov_reginas.order
```

**Esto no bloquea multi-sucursal (las 3 sucursales de Reginas viven en la misma BD), pero sí bloquea multi-empresa.**
Y es trivial de arreglar: `fayxzvov_admin.companies.name_bd` ya guarda la BD de cada empresa,
y el login ya la mete en `$_SESSION['DB']`.

`app` ya tiene el patrón seguro resuelto en [mdl-access.php:125](../../access/mdl/mdl-access.php#L125):

```php
$db = preg_replace('/[^a-zA-Z0-9_]/', '', $array[0] ?? '');
if ($db === '') return [];
$query = "... FROM `{$db}`.cash_shift ...";
```

Sanitiza y usa backticks. **Ese es el patrón a replicar.**

#### 🔴 B2 — La navbar de `app` no cumple dos contratos que pedidos espera

| Contrato | Usos en pedidos | ¿Existe en `app/src/js/navbar.js`? |
|---|---|---|
| `<select id="subsidiaries_id" class="hidden">` — la sucursal activa | **27** | ❌ **no** |
| `<div id="navbarBranchControl">` — wrapper para ocultar el pill en vistas de edición | **4** | ❌ **no** |
| evento `branchChanged` | 1 | ✅ sí, idéntico |

La navbar de alpha inyecta ambos ([navbar.js:234](../../../alpha/pedidos/src/js/navbar.js#L234) y
[:122](../../../alpha/pedidos/src/js/navbar.js#L122)). Si mueves pedidos tal cual,
`$('#subsidiaries_id').val()` devuelve `undefined` — el módulo se queda sin sucursal, en silencio.

El segundo contrato es más sutil: pedidos **oculta** el selector de sucursal al entrar a crear/editar
(`pedidos-catalogo.js:1087`) y lo **muestra** al volver al listado (`app.js:54, 66`). Sin el wrapper,
el usuario podría cambiar de sucursal a media captura de un pedido.

#### ⚠️ B2-bis — Ya hubo un intento previo, con la decisión de diseño contraria

`app/order/` **no es una copia muerta**: es esta misma migración, intentada en mayo-junio 2026 y abandonada.
Incluye [`NAVBAR-BRANCH-SELECTOR.md`](../../order/NAVBAR-BRANCH-SELECTOR.md), una guía de 149 líneas que
propone el camino **opuesto** al que tomó alpha:

```
   app/order (mayo 2026)                    alpha/pedidos (julio 2026)
   ─────────────────────                    ──────────────────────────
   Borrar el <select> del filterBar    ✅ hecho en ambos
   Borrar #subsidiaries_id             ❌ alpha lo CONSERVÓ como hidden en la navbar
   getSubsidiaryLabel() → sub_name     ❌ alpha lo mantuvo con lógica
   Perder "Todas las sucursales" (0)   ❌ alpha lo conservó
```

El propio doc marca el punto como *"caso borde a decidir antes"* (línea 134):

> *"El branch pill del navbar **no** tiene esa opción — siempre selecciona una sucursal concreta.
> Si necesitas conservar la vista agregada para `rol == 1`, hay que armar un botón/toggle aparte."*

**Alpha ya decidió: conservó el agregado.** Y es la versión que evolucionó dos meses más.
Por eso el plan sigue el camino de alpha (portar el hidden select) y no el de `app/order`.

> 💡 **Dato útil:** `branchPillHtml()` de `app` **no filtra por rol** — solo `if (branches.length == 0) return ''`.
> Quien tenga sucursales en el pivote ve el selector. Es más limpio que el `canUseBranchFilter()` de alpha
> (que decide por ROLID en el cliente). El doc de `app/order` menciona `level ∈ [1,5]`, pero **el código
> actual ya no lo hace** — la guía quedó desactualizada respecto a su propia navbar.

#### 🟡 B3 — La resolución de sucursal está copiada 4 veces en el controlador

En [ctrl-pedidos.php](../../../alpha/pedidos/ctrl/ctrl-pedidos.php) el mismo bloque aparece en las líneas
50-52, 165-170, 273-274 y 327-334, con **variantes sutiles**:

```php
// variante A (linea 50)                    // variante B (linea 165)
$subsidiaries_id =                          $postSub = $_POST['subsidiaries_id'] ?? null;
  isset($_POST['subsidiaries_id'])          $subsidiaries_id = ($postSub === null
  && $_POST['subsidiaries_id'] != '0'         || $postSub === ''
    ? $_POST['subsidiaries_id']               || $postSub === 'null'
    : $_SESSION['SUB'];                       || $postSub === 'undefined')
                                                ? $sessionSub : $postSub;
// variante C (linea 327): ademas mete ROLID == 1 ? null : $_SESSION['SUB']
```

Tres reglas distintas para la misma pregunta ("¿de qué sucursal estamos hablando?").
Y ninguna valida que el usuario tenga permiso sobre la sucursal que llega por POST —
**hoy un POST manipulado puede escribir en la sucursal de otro.**

#### 🟡 B4 — Datos sucios y naming inconsistente

```
13 pedidos con order.subsidiaries_id = NULL   ← huérfanos, no aparecen en ningún filtro
```

Y dos convenciones conviviendo:

| Tabla | Columna | Convención |
|---|---|---|
| `order`, `order_payments`, `order_products`, `order_category`, `order_clients` | `subsidiaries_id` | ✅ plural (la de la casa) |
| `cash_shift`, `daily_closure` | `subsidiary_id` | ❌ singular |

Ya hay código pagando el precio: `mdl-pedidos.php:409` hace
`ON cs.subsidiary_id = COALESCE(op.subsidiaries_id, o.subsidiaries_id)`.

---

## 3. Arquitectura destino

```
app/
├── conf/
│   ├── _Conect.php        ← ya tiene transacciones
│   ├── _CRUD.php          ← ya actualizado
│   ├── _Utileria.php      ← superset (+ badge())
│   ├── _Message.php       ← ⚠️ FALTA — copiar de alpha/conf/ (lo usan ctrl-pedidos y ctrl-cierre)
│   └── _Sucursal.php      ← ⭐ NUEVO: helper único de resolución de sucursal
│
├── access/                ← ya tiene el modelo por usuario (usr_user_subsidiaries)
│
├── src/js/
│   ├── coffeeSoft.js      ← v nueva, con auto-listener branchChanged → onBranchChange()
│   └── navbar.js          ← ⭐ agregar hiddenSelectHtml() (puente #subsidiaries_id)
│
└── pedidos/               ← destino (hoy solo tiene template/*.html)
    ├── index.php          ← reescribir head con layout/head.php de app
    ├── admin.php
    ├── calendario/
    ├── ctrl/  (6 archivos)
    ├── mdl/   (6 archivos, con BD dinámica)
    ├── src/js/ (sin navbar.js propio — usa el global de app)
    └── template/          ← los HTML que ya están ahí
```

### 3.1 El helper `_Sucursal.php` (pieza nueva)

Una sola función que responde "¿de qué sucursal estamos hablando y tienes permiso?".
Reemplaza las 4 variantes copiadas de B3 y cierra el agujero de escritura cruzada.

```php
<?php
// Resuelve la sucursal de la peticion y valida el permiso del usuario.
// Reemplaza las variantes ad-hoc que vivian en ctrl-pedidos (lineas 50, 165, 273, 327).
//
//   $modo = 'filtro'   -> permite 0 = "todas" (listados, reportes)
//   $modo = 'escritura'-> exige una sucursal concreta (guardar pedido, cobrar, cerrar turno)

function resolveSubsidiary($modo = 'filtro') {
    $post    = $_POST['subsidiaries_id'] ?? null;
    $vacio   = in_array($post, [null, '', 'null', 'undefined'], true);
    $sesion  = (int) ($_SESSION['SUB'] ?? 0);

    if ($vacio) return $modo === 'filtro' ? $sesion : $sesion;

    $pedida = (int) $post;

    if ($pedida === 0) {
        if ($modo === 'escritura') return $sesion;   // no se escribe en "todas"
        return userCanSeeAllBranches() ? 0 : $sesion;
    }

    // La sucursal llego por POST: hay que validarla contra el pivote.
    if (!userHasBranch($pedida)) {
        throw new Exception('Sin permiso sobre la sucursal solicitada.');
    }
    return $pedida;
}

function userCanSeeAllBranches() {
    return (int) ($_SESSION['ROLID'] ?? 0) === 5;
}

function userHasBranch($subId) {
    if (userCanSeeAllBranches()) return true;
    $crud = new CRUD();
    $r = $crud->_Read(
        "SELECT 1 FROM usr_user_subsidiaries
         WHERE usr_users_id = ? AND subsidiaries_id = ? LIMIT 1",
        [$_SESSION['USR'], $subId]
    );
    return !empty($r);
}

// BD del tenant, sanitizada. Mismo patron que app/access/mdl/mdl-access.php:126.
function tenantDb() {
    $db = preg_replace('/[^a-zA-Z0-9_]/', '', $_SESSION['DB'] ?? '');
    if ($db === '') throw new Exception('Sesion sin base de datos asignada.');
    return $db;
}
```

### 3.2 Los modelos, después

```php
// antes
$this->bd = 'fayxzvov_reginas.';

// despues
require_once '../../conf/_Sucursal.php';
$this->bd = '`' . tenantDb() . '`.';
```

Los 243 `{$this->bd}` **no se tocan**. Solo cambia la línea que lo define.

---

## 4. Plan por fases

### Fase 0 — Preparar el terreno en `app` (sin tocar pedidos)

Todo aquí es aditivo y no rompe nada de lo que ya corre en `app`.

- [ ] **0.1** Copiar `alpha/conf/_Message.php` → `app/conf/_Message.php`
      *(lo requieren `ctrl-pedidos.php:10` y `ctrl-cierre.php:10`)*
- [ ] **0.2** Crear `app/conf/_Sucursal.php` con el helper de §3.1
- [ ] **0.3** Agregar `hiddenSelectHtml()` a `app/src/js/navbar.js` — portar el método de
      [alpha navbar.js:234-249](../../../alpha/pedidos/src/js/navbar.js#L234), pero alimentándolo
      de `settings.branches` (que en `app` ya viene filtrado por usuario)
- [ ] **0.4** Envolver el pill en `<div id="navbarBranchControl">` — es el contrato que pedidos usa
      para ocultarlo en crear/editar (B2)
- [ ] **0.5** Sincronizar `#subsidiaries_id` al emitir `branchChanged`
      ([navbar.js:413](../../src/js/navbar.js#L413)) — hoy el evento sale pero el select no se actualiza
- [ ] **0.6** Decidir si el hidden select lleva `<option value="0">Todas las sucursales</option>`
      (ver decisión #6 en §8)

**Criterio de salida:** en cualquier módulo de `app`, la consola responde:
```js
$('#subsidiaries_id').val()          // → id de la sucursal activa
$('#navbarBranchControl').length     // → 1
```

---

### Fase 1 — Copia mecánica

- [ ] **1.1** `alpha/pedidos/{ctrl,mdl,src,calendario,templates}` → `app/pedidos/`
      *(preservar `app/pedidos/template/` que ya existe)*
- [ ] **1.2** Copiar `index.php` y `admin.php`
- [ ] **1.3** **NO copiar** `src/js/navbar.js` — `app` usa la navbar global
- [ ] **1.4** **NO copiar** `src/js/session-reset-timer.js` — es temporal y apunta a `/alpha/salir/`
- [ ] **1.5** Rescatar documentación de las copias viejas **antes** de borrarlas:
      - `app/pedidos-old/docs/pedidos/{arquitectura,base-de-datos,cierre-turno-db,diagramas-er,cierre}.md`
      - `app/pedidos-old/docs/cobro-cruzado-sucursales.md`
      - `app/order/NAVBAR-BRANCH-SELECTOR.md` → ya analizado en B2-bis; conservar como registro de decisión
      - `app/pedidos-old/docs/bd/*.excalidraw`
- [ ] **1.6** Mover `app/pedidos-old/` y `app/order/` fuera del docroot (no borrar aún — son el fallback
      del intento anterior)

> ⚠️ `app/order` tiene los mdl **a medio migrar**: `mdl-admin.php` y `mdl-projects.php` ya usan
> `"{$_SESSION['DB']}."`, pero `mdl-pedidos`, `mdl-cierre` y `mdl-pedidos-personalizado` siguen con
> `'fayxzvov_reginas.'`. Es exactamente donde se detuvo el intento anterior — **el mismo muro de B1**.

---

### Fase 2 — Reconexión (aquí está el trabajo real)

- [ ] **2.1** `index.php`: reemplazar el `<head>` inline (140 líneas de CDNs) por
      `require_once(__DIR__ . '/../layout/head.php')`, como hace
      [app/facture/index.php:11](../../facture/index.php#L11)
- [ ] **2.2** Quitar `<script src="...navbar.js">` propio → la navbar global la carga el layout de `app`
- [ ] **2.3** Cambiar `PATH_EVENTOS` (usado en `index.php:18` para el CSS) — no existe en `app/conf/_Rutes.php`.
      Mover ese `style.css` a `app/pedidos/src/css/`
- [ ] **2.4** En los 4 modelos: `$this->bd = 'fayxzvov_reginas.'` → `'`' . tenantDb() . '`.'`
- [ ] **2.5** `mdl-pedidos.php:131`: `FROM fayxzvov_reginas.order` → `FROM {$this->bd}\`order\``
- [ ] **2.6** En `ctrl-pedidos.php`: reemplazar las 4 variantes por `resolveSubsidiary('filtro'|'escritura')`
- [ ] **2.7** Idem en `ctrl-cierre.php`, `ctrl-pedidos-personalizado.php`, `ctrl-admin.php`
- [ ] **2.8** `app.js`: definir `onBranchChange(detail)` en la clase orquestadora para aprovechar
      el auto-listener del `coffeeSoft.js` de `app` — hoy pedidos escucha `branchChanged` a mano

**Referencias cruzadas de BD que se quedan como están** (apuntan a esquemas fijos, es correcto):
`fayxzvov_alpha.subsidiaries`, `fayxzvov_alpha.usr_users`, `fayxzvov_admin.companies`.

---

### Fase 3 — Multi-sucursal de verdad

- [ ] **3.1** Poblar `usr_user_subsidiaries` para todos los usuarios de Reginas
      *(hoy solo 9 filas; los vendedores rotativos necesitan sus 3 sucursales)*
- [ ] **3.2** Alta del módulo en el menú: `fayxzvov_admin.modules` ya tiene `Pedidos → pedidos/`
      (id 2) y `module_company` ya lo liga a Reginas (company 4). **Verificar que la ruta resuelva a `/app/pedidos/`**
- [ ] **3.3** Limpiar los 13 `order.subsidiaries_id = NULL` (ver §5.1)
- [ ] **3.4** Definir qué catálogos son globales y cuáles por sucursal (ver §5.2)
- [ ] **3.5** Revisar el cobro cruzado entre sucursales — ya existe la lógica
      (`payment_subsidiaries_id`, `esCruzado` en [app.js:1948](../../../alpha/pedidos/src/js/app.js#L1948)),
      validar que sobrevive al cambio de resolución de sucursal

---

### Fase 4 — Validación

- [ ] **4.1** Login como ROLID 5 → ve las 3 sucursales, puede cambiar entre ellas
- [ ] **4.2** Login como cajero con 1 sola sucursal en el pivote → no ve el selector, todo filtrado
- [ ] **4.3** POST manipulado con `subsidiaries_id` de otra sucursal → **debe rechazar**
- [ ] **4.4** Conteos por sucursal cuadran contra `alpha/` antes del corte: 542 / 162 / 135
- [ ] **4.5** Cierre de turno y cierre diario por sucursal
- [ ] **4.6** Cobro cruzado sigue funcionando
- [ ] **4.7** Regresión de componentes: el `coffeeSoft.js` de `app` difiere en **4,320 líneas**
      del de alpha (ver §5.3)

---

## 5. Cambios en base de datos

### 5.1 Los 13 huérfanos

```sql
-- 1. Inspeccionar antes de decidir
SELECT id, date_creation, total, usr_users_id
FROM fayxzvov_reginas.`order`
WHERE subsidiaries_id IS NULL;

-- 2. Si son de la matriz (Reginas Guadalupe = 4):
UPDATE fayxzvov_reginas.`order` SET subsidiaries_id = 4 WHERE subsidiaries_id IS NULL;

-- 3. Cerrar la puerta
ALTER TABLE fayxzvov_reginas.`order` MODIFY subsidiaries_id INT NOT NULL;
```

> ⚠️ **No ejecutar el UPDATE sin revisar el SELECT primero.** Si los 13 son de sucursales
> distintas, asignarlos por `usr_users_id` vía `usr_user_subsidiaries`.

### 5.2 Mapa de segmentación por sucursal

```
┌──────────────────────────────────────────────────────────────────────────┐
│  TRANSACCIONALES — llevan sucursal propia                    (ya OK ✅)  │
├──────────────────────────────────────────────────────────────────────────┤
│  order                subsidiaries_id    851 filas   (13 NULL ⚠️)        │
│  order_payments       subsidiaries_id   1056 filas                       │
│  order_products       subsidiaries_id    179 filas                       │
│  cash_shift           subsidiary_id      390 filas   (naming ⚠️)         │
│  daily_closure        subsidiary_id      112 filas   (naming ⚠️)         │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  DETALLE — heredan la sucursal del padre               (correcto así ✅) │
├──────────────────────────────────────────────────────────────────────────┤
│  order_package        pedidos_id ──▶ order              904 filas        │
│  order_custom_products                                 3376 filas        │
│  order_custom                                           648 filas        │
│  order_histories                                        384 filas        │
│  order_images                                           208 filas        │
│  order_modifier_products                                223 filas        │
│  closure_payment      daily_closure_id ──▶ daily_closure 336 filas       │
│  shift_payment        cash_shift_id ──▶ cash_shift     1146 filas        │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│  CATÁLOGOS — decisión pendiente                              (⚠️ §3.4)   │
├──────────────────────────────────────────────────────────────────────────┤
│  order_category       subsidiaries_id     11    ya es por sucursal       │
│  order_clients        subsidiaries_id    699    ya es por sucursal       │
│  order_modifier       —                   12    ¿global o por sucursal?  │
│  method_pay           —                    3    global (dejar así)       │
│  status_process       —                    4    global (dejar así)       │
│  pos_discount_reason  —                    5    ¿global o por sucursal?  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Pregunta de negocio pendiente:** si Kafeto tiene modificadores o razones de descuento que
Guadalupe no usa, `order_modifier` y `pos_discount_reason` necesitan `subsidiaries_id`.
Si el menú es idéntico en las 3, se quedan globales. **Esto lo decide el usuario, no el código.**

### 5.3 Naming: `subsidiary_id` → `subsidiaries_id`

Opcional pero recomendado — hoy obliga a `COALESCE` cruzados en las consultas:

```sql
ALTER TABLE fayxzvov_reginas.cash_shift
  CHANGE subsidiary_id subsidiaries_id INT NOT NULL;

ALTER TABLE fayxzvov_reginas.daily_closure
  CHANGE subsidiary_id subsidiaries_id INT NOT NULL;
```

> ⚠️ Rompe todas las consultas que usan el nombre viejo.
> Buscar `subsidiary_id` en `mdl-cierre.php` (62 usos de `{$this->bd}`) y `mdl-pedidos.php` antes.
> **Recomendación: dejarlo para una fase posterior**, no mezclarlo con la migración.

### 5.4 Diagrama de relaciones

```
        fayxzvov_admin                    fayxzvov_alpha (tenant)
    ┌───────────────────┐            ┌──────────────────────────┐
    │  companies        │            │  subsidiaries            │
    │  ─────────────    │◀───────────│  ──────────────          │
    │  id (PK)          │ companies_id  id (PK)                 │
    │  social_name      │            │  name                    │
    │  name_bd  ◀── BD  │            │  companies_id (FK)       │
    └───────────────────┘  del tenant└──────────────────────────┘
             ▲                                    ▲
             │                                    │
    ┌────────┴──────────┐            ┌────────────┴─────────────┐
    │  modules          │            │  usr_user_subsidiaries   │  ⭐ el pivote
    │  module_company   │            │  ──────────────────      │     que habilita
    └───────────────────┘            │  usr_users_id (FK)       │     todo esto
                                     │  subsidiaries_id (FK)    │
                                     └──────────────────────────┘
                                                  ▲
                                     ┌────────────┴─────────────┐
                                     │  usr_users               │
                                     └──────────────────────────┘
                                                  ┆
    ══════════════════════════════════════════════┆═══════ cross-schema ═══
                                                  ┆
        fayxzvov_reginas (BD del cliente)         ┆
    ╔═════════════════════╗                       ┆
    ║  order              ║┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┘ subsidiaries_id
    ║  ─────────────      ║
    ║  id (PK)            ║◀────── order_package.pedidos_id
    ║  subsidiaries_id ┄┄┄║◀────── order_payments.order_id
    ║  ...                ║◀────── order_histories.order_id
    ╚═════════════════════╝◀────── order_images.order_id
              │
              ▼
    ╔═════════════════════╗        ╔═════════════════════╗
    ║  cash_shift         ║───────▶║  daily_closure      ║
    ║  subsidiary_id ⚠️   ║        ║  subsidiary_id ⚠️   ║
    ╚═════════════════════╝        ╚═════════════════════╝
              ▲                              ▲
              │ cash_shift_id                │ daily_closure_id
     ┌────────┴────────┐            ┌────────┴────────┐
     │  shift_payment  │            │ closure_payment │
     └─────────────────┘            └─────────────────┘

    ══▶  FK de negocio      ┄┄▷  FK cross-schema (sin constraint real)
    ╔══╗ tabla del esquema del cliente    ┌──┐ tabla del esquema tenant/admin
```

**Cardinalidades**

| Origen | Destino | Cardinalidad | Nota |
|---|---|---|---|
| `usr_users` | `subsidiaries` | N : M | vía `usr_user_subsidiaries` — **el corazón del multi-sucursal** |
| `companies` | `subsidiaries` | 1 : N | una empresa, muchas sucursales |
| `companies` | BD del cliente | 1 : 1 | vía `companies.name_bd` |
| `subsidiaries` | `order` | 1 : N | cross-schema, sin constraint |
| `order` | `order_package` | 1 : N | detalle |
| `order` | `order_payments` | 1 : N | ⚠️ el pago puede ser de **otra** sucursal (cobro cruzado) |
| `subsidiaries` | `cash_shift` | 1 : N | un turno por sucursal por día |
| `cash_shift` | `daily_closure` | N : 1 | varios turnos, un cierre diario |

---

## 6. Riesgos

| # | Riesgo | Severidad | Mitigación |
|---|---|---|---|
| R1 | **`coffeeSoft.js` difiere en 4,320 líneas** entre alpha y app. Pedidos (22,686 líneas de JS) fue escrito contra la versión vieja | 🔴 Alta | Verificado: `createTable`, `createModalForm`, `primaryLayout`, `tabLayout`, `createfilterBar` existen en ambas. Aun así, **probar tab por tab** |
| R2 | Sin el `#subsidiaries_id` en la navbar de app, 27 llamadas devuelven `undefined` silenciosamente | 🔴 Alta | Fase 0.3 es **bloqueante**. No avanzar sin ella |
| R3 | Los 13 pedidos NULL desaparecen de todos los listados | 🟡 Media | Fase 3.3 antes del corte |
| R4 | Escritura cruzada de sucursal por POST manipulado (existe **hoy** en alpha) | 🔴 Alta | `resolveSubsidiary('escritura')` — es una **mejora de seguridad**, no solo migración |
| R5 | **Este intento ya falló una vez.** `app/order` se detuvo justo en B1 (BD hardcodeada), con 3 de 5 modelos sin migrar | 🔴 Alta | Atacar B1 **primero** en Fase 2. Es el muro real, no la navbar |
| R6 | El cobro cruzado depende de `$_SESSION['SUB']` vs POST | 🟡 Media | Fase 3.5 con caso de prueba explícito |
| R7 | Corte en caliente con turnos abiertos | 🟡 Media | Migrar con todos los turnos cerrados |

---

## 7. Orden recomendado

```
Fase 0  ──▶  Fase 1  ──▶  Fase 2  ──▶  Fase 4 (parcial)  ──▶  Fase 3  ──▶  Fase 4 (full)
 app         copiar      reconectar      "funciona igual"      multi-suc.      "funciona mejor"
 (2-3 h)     (30 min)     (1-2 días)        que alpha            (1 día)
```

**La clave: Fase 2 termina con pedidos corriendo en `app` exactamente igual que en `alpha`.**
Ese es el checkpoint seguro. Multi-sucursal real (Fase 3) viene después, sobre terreno estable.

Mientras tanto `alpha/pedidos` sigue vivo como fallback. El corte se hace cuando Fase 4 pasa completa.

---

## 8. Decisiones que necesito del usuario

| # | Decisión | Mi recomendación |
|---|---|---|
| 1 | **`order_modifier` y `pos_discount_reason`** — ¿globales o por sucursal? (§5.2) | Globales, salvo que Kafeto tenga menú propio |
| 2 | **Los 13 pedidos NULL** — ¿a qué sucursal pertenecen? (§5.1) | Revisar el `SELECT` antes de decidir |
| 3 | **Rename `subsidiary_id` → `subsidiaries_id`** (§5.3) | Después. No mezclar con la migración |
| 4 | **`app/order` y `app/pedidos-old`** — ¿borrar? | Mover fuera del docroot, no borrar hasta que Fase 4 pase |
| 5 | **Rol admin: alpha usa ROLID 1, app usa ROLID 5** | Unificar en ROLID 5 (el modelo de `app`) — pero verificar qué rol tienen hoy los usuarios de Reginas |
| 6 | **"Todas las sucursales" (id=0)** — ¿el admin necesita el agregado de las 3? | **Sí, conservarlo.** Alpha ya lo eligió y los reportes dependen de él: `subsidiariesId !== 'all'` aparece en **9 consultas** de `mdl-pedidos.php` |

> La #6 es la que más código mueve. Si se conserva, el hidden select de Fase 0.3 necesita el
> `<option value="0">`; si no, hay que reescribir las 9 consultas que hoy aceptan `'all'`.
