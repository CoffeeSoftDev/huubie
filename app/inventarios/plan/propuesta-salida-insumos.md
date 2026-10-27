# Propuesta — Inventarios Dual-Tracking (POS vs Insumos)

> **Modulo:** `app/inventarios`
> **Ambito de la propuesta:** convertir todo el modulo en **dual-tracking** — el usuario elige entre dos dimensiones de inventario antes de operar:
>   1. **Inventario POS** — productos terminados vendibles (lo que existe hoy).
>   2. **Inventario Insumos** — materia prima / consumibles (nuevo).
> Ambas dimensiones comparten el mismo *shell de submodulos* (Stock, Entradas, Salidas, Movimientos, Mermas, Traspasos, Admin) pero **catalogos, motivos, areas y reglas son distintos**.
> **Estado del sistema:** todo el modulo opera en **modo FAKE**; este documento mantiene esa convencion.
> **Fecha:** 2026-05-19

---

## 1. Replanteo

El borrador anterior proponia anadir **un solo submodulo nuevo** (Salidas Insumos) junto a los seis existentes. Tras revisar la profundidad real del modulo se ve que esa propuesta era insuficiente:

- `pos-stock` ya muestra existencias, alertas y vida util, pero **solo de productos terminados**. Los insumos necesitan exactamente el mismo visor — pero sobre la base de insumos.
- `pos-movimientos` es una bitacora unificada con tipos `ENTRADA / SALIDA POS / SALIDA PED / MERMA / TRANSFERENCIA / AJUSTE / DEVOLUCION`. Los insumos necesitan esos mismos tipos de evento — pero filtrando su propia base.
- `pos-mermas` clasifica perdidas por `Caducidad / Daniado / Error produccion / Robo / Devolucion`. Los insumos pueden tener mermas tambien (caducidad de harina, derrame de leche).
- `pos-traspasos` mueve mercancia entre sucursales con flujo de aprobacion. Los insumos se traspasan igual (un saco de harina puede ir de una sucursal a otra).
- `admin-inventarios` tiene tabs Productos + Almacenes. Necesita una tab equivalente para Insumos.

**Conclusion:** el modulo no necesita un submodulo nuevo aislado. Necesita una **segunda dimension de inventario** que reutilice todo el shell de submodulos existentes, cambiando solo el catalogo base y los catalogos derivados (motivos, areas, categorias).

---

## 2. Decision arquitectonica: dimension global "scope"

### 2.1 Modelo conceptual

```
                            ┌───────────────────────────┐
                            │   MODULO INVENTARIOS      │
                            │                           │
                            │   scope ∈ { pos, supply } │
                            └───────────┬───────────────┘
                                        │
                ┌───────────────────────┴───────────────────────┐
                │                                               │
                ▼                                               ▼
        ┌───────────────┐                              ┌───────────────┐
        │   POS         │                              │   INSUMOS     │
        │               │                              │               │
        │ Base:         │                              │ Base:         │
        │   pos_product │                              │   supply      │
        │ (cupcake,     │                              │ (harina,      │
        │  pastel,      │                              │  azucar,      │
        │  cafe...)     │                              │  papel...)    │
        └───────┬───────┘                              └───────┬───────┘
                │                                              │
                │  ─── MISMO SHELL DE SUBMODULOS ───           │
                │                                              │
                ▼                                              ▼
        ┌─────────────────────────────────────────────────────────────┐
        │  Stock · Entradas · Salidas · Movimientos · Mermas ·         │
        │  Traspasos · Admin                                           │
        └─────────────────────────────────────────────────────────────┘
                │                                              │
                ▼                                              ▼
        ┌───────────────┐                              ┌───────────────┐
        │ Catalogos     │                              │ Catalogos     │
        │ derivados POS │                              │ derivados INS │
        │               │                              │               │
        │ - categorias  │                              │ - categorias  │
        │   (Pasteles,  │                              │   (Materia P, │
        │    Cafes,...) │                              │    Limpieza,  │
        │ - origenes    │                              │    Papeleria) │
        │   (Produccion │                              │ - destinos    │
        │    Proveedor, │                              │   (Cocina,    │
        │    Transfer.) │                              │    Barra,     │
        │ - mermas      │                              │    Panaderia) │
        │   (Cadu/Dano) │                              │ - mermas      │
        │               │                              │   (Cadu/Dano/ │
        │               │                              │    Derrame)   │
        └───────────────┘                              └───────────────┘
```

**Lo que se comparte entre ambos scopes:**

- Almacenes fisicos (`warehouse`) — un mismo almacen puede guardar productos POS e insumos en zonas distintas.
- Sucursales (`subsidiary`).
- Usuarios y empresa.
- Areas fisicas (`warehouse_area`: Refrigerados, Secos, Congelados).

**Lo que es distinto entre ambos scopes:**

- El catalogo de items (`pos_product` vs `supply`).
- Las categorias del item (cada uno tiene su propia tabla).
- Los **motivos** de cada tipo de evento (las salidas POS son ventas/devoluciones; las salidas de insumo son consumo/baja/donativo).
- Los **destinos**: en POS no aplica "area de consumo"; en insumos es obligatorio (Cocina/Barra/Panaderia).
- Las **unidades de medida**: POS suele ser por pieza; insumos manejan kg/lt/pza/caja/m/pq.
- Los **folios**: prefijos distintos para no chocar (`ENT-` vs `ENT-INS-`, `SAL-` vs `SAL-INS-`, `MER-` vs `MER-INS-`, `TRA-` vs `TRA-INS-`).

### 2.2 Como elige el usuario el scope

Combinacion de dos mecanismos:

**Entry-point gate (primera vez en la sesion):**
Al entrar a `/app/inventarios/index.php`, antes del MenuHub se muestra una pantalla con **2 cards grandes**: *Inventario POS* y *Inventario Insumos*. La eleccion se guarda en `sessionStorage.inventory_scope` y en la sesion PHP (`$_SESSION['inventory_scope']`).

**Toggle persistente (en el navbar/header del MenuHub y de cada submodulo):**
Un switch tipo pill `[ POS | Insumos ]` visible en todo momento, junto al titulo del modulo. Permite alternar sin volver al gate. Al cambiar, el JS recarga la vista actual con el nuevo scope.

**Default:** la primera vez se obliga a elegir (sin default). Veces sucesivas se respeta la ultima eleccion del usuario.

### 2.3 Como cambia el comportamiento de cada submodulo

| Submodulo | Que cambia con `scope = pos` | Que cambia con `scope = supply` |
|---|---|---|
| **Stock** | Filas son `pos_product`. Vida util en dias, alertas por min/max. | Filas son `supply`. Misma logica pero unidad puede ser kg/lt. |
| **Entradas** | Origenes: *Produccion / Proveedor / Transferencia / Devolucion*. Catalogo en modal = productos POS. | Origenes: *Compra a proveedor / Transferencia / Devolucion / Ajuste positivo*. Catalogo en modal = insumos. |
| **Salidas** | Hoy NO existe submodulo dedicado (las salidas son via Venta/Merma/Traspaso). | **Nuevo submodulo** `inv-salidas` que solo aplica para scope=supply. Motivos: *Consumo interno / Transferencia area / Baja caducidad / Donativo / Ajuste fisico*. Areas destino: Cocina/Barra/Panaderia/Mantenimiento/Oficina. |
| **Movimientos** | UNION ALL solo de eventos POS. Tipos: *ENTRADA, SALIDA POS, SALIDA PED, MERMA, TRANSFERENCIA, AJUSTE, DEVOLUCION*. | UNION ALL solo de eventos sobre insumos. Tipos: *ENTRADA, SALIDA INSUMO, MERMA INSUMO, TRANSFERENCIA, AJUSTE*. |
| **Mermas** | Motivos: *Caducidad / Daniado / Error produccion / Robo / Devolucion*. | Motivos: *Caducidad / Derrame / Daniado / Contaminacion / Error medicion / Faltante fisico*. |
| **Traspasos** | Productos terminados entre sucursales con flujo de aprobacion. | Insumos entre sucursales (mismo flujo). |
| **Admin** | Tabs: Productos + Almacenes. | Tabs: Insumos + Almacenes + (categorias, unidades, motivos, areas como subtabs futuros). |

> **Nota:** el submodulo "Salidas" como concepto formal solo existe en scope=supply. En scope=pos las salidas son consecuencia de Ventas (POS), Mermas o Traspasos y no requieren submodulo dedicado.

---

## 3. UI del switch

### 3.1 Pantalla de seleccion (entry-point gate)

Aparece una vez por sesion (o al hacer click en "cambiar ambito" desde el navbar):

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│              Sistema de Inventarios &mdash; Buen dia                 │
│              Elige sobre que dimension de inventario quieres operar  │
│                                                                      │
│   ┌─────────────────────────┐    ┌─────────────────────────┐         │
│   │                         │    │                         │         │
│   │      🍰  Inventario     │    │      🌾  Inventario     │         │
│   │           POS           │    │         Insumos         │         │
│   │                         │    │                         │         │
│   │  Productos terminados   │    │   Materia prima e       │         │
│   │  vendibles del POS      │    │   insumos de operacion  │         │
│   │  (cupcake, pastel,      │    │   (harina, azucar,      │         │
│   │   cafe, sandwich, ...)  │    │    papel, detergente)   │         │
│   │                         │    │                         │         │
│   │  Stock · Entradas ·     │    │  Stock · Entradas ·     │         │
│   │  Movimientos · Mermas · │    │  Salidas · Movimientos ·│         │
│   │  Traspasos · Admin      │    │  Mermas · Traspasos ·   │         │
│   │                         │    │  Admin                  │         │
│   │                         │    │                         │         │
│   │    [ Entrar a POS    ]  │    │    [ Entrar a Insumos ] │         │
│   └─────────────────────────┘    └─────────────────────────┘         │
│                                                                      │
│   ☑ Recordar mi eleccion                                             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 3.2 Toggle persistente en MenuHub y submodulos

Aparece en el header de cada pantalla, junto al titulo:

```
┌──────────────────────────────────────────────────────────────────────┐
│ ◀ Sistema de Inventarios                          [ POS ][ Insumos ]│
│   Buen dia                                              ▲ activo    │
│                                                                      │
│   [Stock] [Entradas] [Movimientos] [Mermas] [Traspasos] [+ Salidas*]│ ← cards
│                                                                      │
│   *Card "Salidas" solo aparece cuando scope=Insumos                  │
└──────────────────────────────────────────────────────────────────────┘
```

Cuando el usuario hace click en el switch:
1. JS actualiza `sessionStorage.inventory_scope`.
2. Envia POST `set_scope` al backend (`ctrl-pos.php` o un controlador comun nuevo).
3. Recarga la vista actual con el nuevo scope (cards se reordenan, links se actualizan).

### 3.3 Color y simbolo distintivo

| Scope | Color base | Lucide icon principal | Tono badge |
|---|---|---|---|
| **POS** | Azul / Purpura (existente) | `box`, `cake`, `cup-soda` | `#60A5FA` |
| **Insumos** | Verde esmeralda / Amber | `sprout`, `wheat`, `package-minus` | `#10B981` |

El badge "POS" o "INSUMOS" aparece arriba del titulo de cada submodulo para que el usuario nunca tenga dudas de en que dimension esta operando.

---

## 4. Modelo de datos

### 4.1 Tablas compartidas (sin cambio)

```sql
-- Estas ya existen (ecosistema huubie):
--   warehouse, warehouse_area, subsidiary, company, huubie_users, unit
```

### 4.2 Catalogos paralelos (uno por scope)

```sql
-- ╔════════════════════════════════════════════════════════════════╗
-- ║  Lado POS — ya existe, se documenta para contraste            ║
-- ╚════════════════════════════════════════════════════════════════╝

-- pos_product (existente — productos terminados)
-- pos_product_category (existente — Tradicional/Premium/Cupcakes/Galletas)

-- ╔════════════════════════════════════════════════════════════════╗
-- ║  Lado INSUMOS — nuevo                                          ║
-- ╚════════════════════════════════════════════════════════════════╝

CREATE TABLE supply (
    id              INT(11) NOT NULL AUTO_INCREMENT,
    sku             VARCHAR(40)  NOT NULL,
    name            VARCHAR(150) NOT NULL,
    description     VARCHAR(255) NULL,
    cost_unit       DOUBLE       NOT NULL DEFAULT 0,
    stock_min       DOUBLE       NULL,
    stock_max       DOUBLE       NULL,
    active          TINYINT(1)   NOT NULL DEFAULT 1,
    created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME     NULL ON UPDATE CURRENT_TIMESTAMP,
    supply_category_id    INT(11) NOT NULL,
    unit_id               INT(11) NOT NULL,
    warehouse_area_id     INT(11) NULL,
    preferred_supplier_id INT(11) NULL,
    company_id            INT(11) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_supply_sku_company (sku, company_id)
);

CREATE TABLE supply_category (
    id          INT(11) NOT NULL AUTO_INCREMENT,
    name        VARCHAR(80) NOT NULL,
    color_hex   VARCHAR(7)  NULL,
    active      TINYINT(1)  NOT NULL DEFAULT 1,
    company_id  INT(11)     NOT NULL,
    PRIMARY KEY (id)
);
-- Materia prima, Limpieza, Papeleria, Empaque, Insumo de cocina

CREATE TABLE consumption_area (
    id          INT(11) NOT NULL AUTO_INCREMENT,
    name        VARCHAR(80) NOT NULL,
    icon        VARCHAR(40) NULL,
    color_hex   VARCHAR(7)  NULL,
    active      TINYINT(1)  NOT NULL DEFAULT 1,
    company_id  INT(11)     NOT NULL,
    PRIMARY KEY (id)
);
-- Cocina, Barra, Panaderia, Mantenimiento, Oficina
```

### 4.3 Tablas de eventos: una pareja por scope

Recomendacion: **NO usar polimorfismo** (campo `scope` + FK polimorfica). En su lugar **duplicar la pareja root+detail** para cada scope. Mantiene FKs limpias, integridad referencial fuerte, e indices especificos.

```sql
-- ╔════════════════════════════════════════════════════════════════╗
-- ║  POS — eventos sobre productos terminados                      ║
-- ╚════════════════════════════════════════════════════════════════╝

-- pos_inflow + detail_pos_inflow   (Entradas POS — ya existe o se planea)
-- pos_outflow + detail_pos_outflow (Salidas via venta/merma — implicito en POS)
-- pos_transfer + detail_pos_transfer (Traspasos POS)
-- pos_shrinkage + detail_pos_shrinkage (Mermas POS)

-- ╔════════════════════════════════════════════════════════════════╗
-- ║  INSUMOS — eventos sobre supply                                ║
-- ╚════════════════════════════════════════════════════════════════╝

CREATE TABLE supply_inflow (
    id              INT(11) NOT NULL AUTO_INCREMENT,
    folio           VARCHAR(20) NOT NULL,    -- ENT-INS-####
    date_inflow     DATE        NOT NULL,
    time_inflow     TIME        NOT NULL,
    note            VARCHAR(500) NULL,
    status          ENUM('Pendiente','Aplicada','Reversada') NOT NULL DEFAULT 'Aplicada',
    subtotal        DOUBLE      NOT NULL DEFAULT 0,
    total_units     DOUBLE      NOT NULL DEFAULT 0,
    total_cost      DOUBLE      NOT NULL DEFAULT 0,
    active          TINYINT(1)  NOT NULL DEFAULT 1,
    created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    warehouse_id        INT(11) NOT NULL,
    inflow_origin_id    INT(11) NOT NULL,    -- Compra/Transferencia/Devolucion/Ajuste+
    subsidiary_id       INT(11) NOT NULL,
    supplier_id         INT(11) NULL,
    created_user_id     INT(11) NOT NULL,
    company_id          INT(11) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_supply_inflow_folio_company (folio, company_id)
);

CREATE TABLE detail_supply_inflow (
    id                  INT(11) NOT NULL AUTO_INCREMENT,
    quantity            DOUBLE  NOT NULL,
    cost_unit_snap      DOUBLE  NOT NULL,
    subtotal            DOUBLE  NOT NULL,
    expires_at          DATE    NULL,
    batch_code          VARCHAR(40) NULL,
    active              TINYINT(1) NOT NULL DEFAULT 1,
    created_at          DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    supply_inflow_id    INT(11) NOT NULL,
    supply_id           INT(11) NOT NULL,
    unit_id             INT(11) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_dsi_root   FOREIGN KEY (supply_inflow_id) REFERENCES supply_inflow(id) ON DELETE CASCADE,
    CONSTRAINT fk_dsi_supply FOREIGN KEY (supply_id)        REFERENCES supply(id)
);

-- Salidas insumos (SAL-INS-####)
CREATE TABLE supply_outflow ( /* mismo patron, con consumption_area_id y outflow_reason_id */ );
CREATE TABLE detail_supply_outflow ( /* ... */ );

-- Mermas insumos (MER-INS-####)
CREATE TABLE supply_shrinkage ( /* mismo patron, con shrinkage_reason_id */ );
CREATE TABLE detail_supply_shrinkage ( /* ... */ );

-- Traspasos insumos (TRA-INS-####)
CREATE TABLE supply_transfer ( /* origen_warehouse_id, destination_warehouse_id, status flow */ );
CREATE TABLE detail_supply_transfer ( /* ... */ );
```

### 4.4 Bitacora unificada (visor de movimientos)

`pos-movimientos.js` lee segun `scope`:

```sql
-- scope = pos: solo eventos POS
SELECT 'ENTRADA' as tipo, ... FROM pos_inflow ...
UNION ALL
SELECT 'SALIDA POS' as tipo, ... FROM pos_outflow ...
UNION ALL
SELECT 'MERMA' as tipo, ... FROM pos_shrinkage ...
UNION ALL ...

-- scope = supply: solo eventos sobre insumos
SELECT 'ENTRADA' as tipo, ... FROM supply_inflow ...
UNION ALL
SELECT 'SALIDA INSUMO' as tipo, ... FROM supply_outflow ...
UNION ALL
SELECT 'MERMA INSUMO' as tipo, ... FROM supply_shrinkage ...
UNION ALL ...
```

No hay union cruzada entre POS e Insumos en la bitacora — el usuario nunca quiere ver "leche entera 1L" y "harina T55" en la misma tabla.

---

## 5. Implementacion

### 5.1 Frontend — variable global de scope

```js
// app/inventarios/src/js/inventory-scope.js (NUEVO)
class InventoryScope {
    static get() {
        return sessionStorage.getItem('inventory_scope');  // 'pos' | 'supply' | null
    }
    static set(scope) {
        sessionStorage.setItem('inventory_scope', scope);
        // notifica al backend
        $.post('/app/inventarios/ctrl/ctrl-scope.php', { opc:'setScope', scope });
        // emite evento global para que los modulos reaccionen
        $(document).trigger('scopeChanged', [scope]);
    }
    static clear() {
        sessionStorage.removeItem('inventory_scope');
    }
    static label() {
        const s = this.get();
        return s === 'supply' ? 'Insumos' : (s === 'pos' ? 'POS' : null);
    }
    static color() {
        return this.get() === 'supply' ? 'emerald' : 'blue';
    }
}
```

### 5.2 MenuHub con gate + toggle

`app/inventarios/src/js/index.js`:

```js
$(async () => {
    const scope = InventoryScope.get();
    if (!scope) {
        // Mostrar selector inicial
        new ScopeSelector('mainContainer').render();
    } else {
        menuHub = new MenuHub(api, 'mainContainer');
        menuHub.init();  // ya conoce el scope y construye cards segun corresponda
    }
});

class MenuHub extends Templates {
    buildCards() {
        const scope = InventoryScope.get();
        const base = [
            { titulo:'Stock',        icon:'boxes',         enlace:'/app/inventarios/inv-stock.php'        },
            { titulo:'Entradas',     icon:'package-plus',  enlace:'/app/inventarios/inv-entradas.php'     },
            { titulo:'Movimientos',  icon:'arrow-left-right', enlace:'/app/inventarios/inv-movimientos.php' },
            { titulo:'Mermas',       icon:'trash-2',       enlace:'/app/inventarios/inv-mermas.php'       },
            { titulo:'Traspasos',    icon:'truck',         enlace:'/app/inventarios/inv-traspasos.php'    }
        ];
        if (scope === 'supply') {
            base.splice(2, 0, {  // insertar Salidas en 3era posicion
                titulo:'Salidas',
                icon:'package-minus',
                enlace:'/app/inventarios/inv-salidas.php'
            });
        }
        return base;
    }
}
```

> **Decision colateral:** los archivos `pos-stock.php`, `pos-entradas.php`, etc. **se renombran** a `inv-stock.php`, `inv-entradas.php`, etc. (sin prefijo POS, porque ahora son neutrales al scope). El JS detecta el scope vigente y carga datos del lado correcto.
>
> Alternativa: dejar los `pos-*.php` y agregar `sup-*.php` paralelos. Menos elegante pero mas seguro si hay rutas externas que ya apuntan a `pos-*.php`. **Recomendado en primera iteracion** para no romper integraciones.

### 5.3 Submodulos — patron de lectura del scope

Cada `App` lee el scope al iniciar y elige el `SAMPLE_*` correcto:

```js
class App extends Templates {
    async init() {
        this.scope = InventoryScope.get();  // 'pos' | 'supply'

        // MODO FAKE: cargar dataset segun scope
        this.dataInit = this.scope === 'supply' ? {
            sucursales: SAMPLE_SUCURSALES,
            origenes:   SAMPLE_SUPPLY_INFLOW_ORIGINS,
            estados:    SAMPLE_INFLOW_STATUS,
            catalogo:   SAMPLE_SUPPLY_CATALOG
        } : {
            sucursales: SAMPLE_SUCURSALES,
            origenes:   SAMPLE_POS_INFLOW_ORIGINS,
            estados:    SAMPLE_INFLOW_STATUS,
            catalogo:   SAMPLE_POS_CATALOG
        };

        this.render();
    }

    layout() { /* mismo layout para ambos scopes */ }
}
```

### 5.4 Backend — controlador con scope

Convencion: cada controlador recibe `scope` desde `$_POST` (o sesion) y dispatcha al modelo correcto:

```php
class ctrl extends mdl {
    private $scope;
    function __construct() {
        parent::__construct();
        $this->scope = $_POST['scope'] ?? $_SESSION['inventory_scope'] ?? 'pos';
    }

    function lsEntradas() {
        if ($this->scope === 'supply') {
            return $this->listSupplyInflows($_POST);
        }
        return $this->listPosInflows($_POST);
    }
}
```

Los modelos `mdl-pos.php` y `mdl-supply.php` viven en paralelo, sin herencia entre ellos.

---

## 6. Plan de implementacion (fases)

### Fase 1 — Capa de scope

1. Crear `inventory-scope.js` (singleton frontend).
2. Crear template `selector-ambito.html` y migrarlo a `scope-selector.js` (componente reutilizable).
3. Crear `ctrl-scope.php` (set/get del scope en `$_SESSION`).
4. Anadir toggle persistente al `viewHeader` y al MenuHub.

### Fase 2 — Catalogo de insumos

1. `sample_supplies.js` (analogo a `sample_admin-inventarios.js` pero solo para insumos).
2. Extender `admin-inventarios.js`: tercera tab "Insumos" que aparece **siempre** (no depende del scope, porque el admin se considera neutral).
3. Catalogos satelites en samples: `SAMPLE_SUPPLY_CATEGORIES`, `SAMPLE_UNITS`, `SAMPLE_CONSUMPTION_AREAS`, `SAMPLE_OUTFLOW_REASONS`.

### Fase 3 — Submodulos duales

Para cada submodulo existente (`pos-stock`, `pos-entradas`, `pos-movimientos`, `pos-mermas`, `pos-traspasos`):

1. Renombrar a `inv-*` o mantener `pos-*` + crear paralelo `sup-*` (eleccion segun el riesgo a rutas externas).
2. Inyectar lectura de scope en `App.init()`.
3. Crear segundo dataset SAMPLE para scope=supply.
4. Anadir badge de scope en `viewHeader` (junto al titulo).
5. Ajustar copys (placeholders, leyendas, motivos) por scope.

### Fase 4 — Submodulo nuevo: Salidas Insumos

1. `inv-salidas.php` + `inv-salidas.js` + `sample_salidas_supplies.js`.
2. Solo visible cuando scope=supply (en POS no aplica).
3. Tomar como base el patron `pos-entradas` pero invertir la direccion (consumo en lugar de ingreso) y usar `consumption_area` + `outflow_reason`.

### Fase 5 — Movimientos unificado por scope

1. `inv-movimientos.js` lee scope y filtra `SAMPLE_MOVIMIENTOS_DB` por origen del evento.
2. Cuando exista backend: UNION ALL **separado por scope** (sin mezclar POS con Insumos).

### Fase 6 — Backend real (cuando se libere FAKE)

1. Migracion DDL.
2. Controladores `ctrl-inv-*.php` con dispatcher por scope.
3. Modelos `mdl-pos-*.php` y `mdl-supply-*.php`.

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigacion |
|---|---|
| Usuario opera en scope equivocado sin darse cuenta | Badge de scope grande y permanente en `viewHeader`. Color distintivo (azul=POS, verde=Insumos). Confirmacion al guardar registros: "Estas registrando en INSUMOS, confirmar?". |
| Mezcla de catalogos en la misma tabla por error | DB separada (sin polimorfismo). Cada controlador solo conoce su scope. FKs apuntan a una sola tabla, no a "depende de scope". |
| Bitacora con folios duplicados | Prefijos distintos por scope+evento: `ENT-` vs `ENT-INS-`, `SAL-` vs `SAL-INS-`, etc. |
| Switch de scope desincronizado entre frontend y backend | El JS envia `scope` en CADA POST. El backend lo prefiere sobre `$_SESSION` para evitar drift. La sesion solo es default. |
| Submodulos "muertos" cuando scope=pos no aplica (caso Salidas) | El MenuHub no muestra esa card cuando no aplica. Si el usuario navega via URL directa, el submodulo redirige al MenuHub con mensaje "Submodulo solo disponible en Insumos". |
| Sobre-ingenieria si solo 1 usuario operara insumos | Empezar Fase 1+2 (scope + catalogo). Las fases 3+ se priorizan segun demanda real. |

---

## 8. Entregables actualizados de este plan

| Archivo | Tipo | Cubre |
|---|---|---|
| `plan/propuesta-salida-insumos.md` | Documento (este) | Arquitectura dual-tracking completa |
| `plan/templates/selector-ambito.html` | Wireframe | Entry-point gate (eleccion POS / Insumos) |
| `plan/templates/inventario-menu-extendido.html` | Wireframe | MenuHub con toggle persistente y cards dinamicas |
| `plan/templates/salidas-insumos.html` | Wireframe | Submodulo Salidas (solo scope=supply) |
| `plan/templates/salidas-insumos-form.html` | Wireframe | Modal de captura de salida de insumos |
| `plan/templates/admin-insumos.html` | Wireframe | Tab Insumos en admin (catalogo paralelo) |

> Los demas submodulos (`stock`, `entradas`, `movimientos`, `mermas`, `traspasos`) **no requieren wireframes nuevos**: reutilizan exactamente sus templates existentes, agregando solo el badge de scope y un dataset distinto. Si en revision quieres versiones especificas para scope=supply, se pueden generar como `stock-insumos.html`, `entradas-insumos.html`, etc.

---

## 9. Pendientes a decidir contigo

Tres decisiones tuyas son criticas antes de pasar a implementacion:

1. **Ruta de archivos.** ¿Renombramos `pos-stock.php` → `inv-stock.php` (mas limpio, pero rompe URLs externas si existen) o mantenemos `pos-*.php` y creamos paralelos `sup-*.php` (mas seguro, mas duplicacion en arranque)?

2. **Almacenes compartidos vs. especializados.** Un almacen fisico ¿puede contener **ambos** productos POS e insumos? Si la respuesta es si (lo asumi), no se necesita campo `scope` en `warehouse`. Si la respuesta es no (un almacen es exclusivo de uno u otro), se anade `warehouse.scope ENUM('pos','supply','both')`.

3. **Default de scope para usuarios nuevos.** ¿Forzar siempre el gate al primer login del dia, o tomar el ultimo scope usado como default automatico?

---

## 10. Apendice — Referencias

- Patron base reutilizado: `app/inventarios/example/inventarios-ajustes.js` (mismo shell mainPanel + detailPanel).
- Layout canonico: ver `CLAUDE.md` (raiz huubie) — bloque "Layout canonico de modulos".
- Reglas de DB: `C:/Users/CoffeSoft/.claude/agents/grimorios/db-rules.md` (singular en ingles, DOUBLE para montos, `detail_` solo en renglones, FKs al final).
- Patron de modulos coffeeSoft: `App + Entidad + EntidadView`, sample_*.js al top, comentario `// MODO FAKE — cuando exista el backend...`.
