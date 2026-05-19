# Flujo de operación — módulo `app/inventarios`

> **Producto:** Huubie · Inventarios (POS-2)
> **Ámbito de este documento:** explicar, en lenguaje de negocio, qué hace cada pantalla del módulo, cómo se conectan entre ellas, qué actores participan y qué datos viajan.
> **Estado actual:** todo el módulo opera en **modo FAKE** — los datos vienen de archivos `sample_*.js`, no hay backend conectado.
> **Empresa de referencia:** Reginas (pastelería con varias sucursales: Kafeto, Central Gpe, Cuarta, Altozano, etc.).
> **Fecha:** 2026-05-19

---

## 1. Vista de pájaro

El módulo de Inventarios es el **segundo nivel** de la navegación principal de Huubie (POS-2). Su propósito es controlar **qué hay, dónde está, cuánto se mueve, qué se pierde y qué se traslada** dentro del ecosistema de la empresa.

```
Huubie (POS-1)
   │
   ├── … otros módulos (Ventas, RRHH, Finanzas, etc.)
   │
   └── Inventarios (POS-2)        ←  este módulo
         │
         ├── Stock actual           (visor)
         ├── Entradas               (recepciones)
         ├── Movimientos            (bitácora unificada)
         ├── Mermas                 (pérdidas)
         ├── Traspasos              (envíos entre sucursales)
         └── Configuración          (admin: productos + almacenes [+ insumos])
```

**Sub-hub:** `app/inventarios/templates/inventario-menu.html` muestra una grilla de 6 tarjetas (5 operativas + 1 administrativa) que llevan a cada submódulo.

### Doble dimensión: POS vs Insumos

El plan canónico ([plan/propuesta-salida-insumos.md](../plan/propuesta-salida-insumos.md)) define que el módulo opera en **dos dimensiones intercambiables**:

| Dimensión | Catálogo base | Ejemplos |
|---|---|---|
| **POS** | productos terminados vendibles | pastel 3 leches, cupcake, galleta, café |
| **Insumos** | materia prima / consumibles | harina, azúcar, papel, detergente |

Un selector global (entry-point gate + toggle persistente) decide sobre cuál dimensión opera el usuario. El **shell de submódulos es el mismo** (Stock, Entradas, Movimientos, Mermas, Traspasos, Admin); cambian los catálogos, motivos, áreas, unidades y prefijos de folio.

> Hoy el código vive principalmente en modo **POS** (productos terminados). El submódulo **Salidas** solo existe en la dimensión Insumos; en POS las salidas son consecuencia de Ventas, Mermas o Traspasos.

---

## 2. Actores

| Actor | Rol en el flujo |
|---|---|
| **Empresa** | Reginas (id 4 en `fayxzvov_admin.companies`). Cobija todas las sucursales y catálogos. |
| **Sucursal** | Tienda física (Kafeto, Central Gpe, Cuarta, Altozano…). Cada movimiento ocurre **en una sucursal**. |
| **Almacén** | Espacio físico dentro de una sucursal. Una sucursal puede tener varios almacenes (general, refrigerados, congelados); uno se marca como **general por defecto**. |
| **Empleado / Usuario** | Quien registra cada evento. Aparece como "registrado por", "autorizó", "envió", "recibió". |
| **Proveedor** | Externo. Suministra mercancía en entradas tipo *Proveedor*. |
| **Cliente final** | Externo. Consume vía POS (no aparece en inventarios, pero las ventas POS disparan salidas). |

---

## 3. Conceptos clave

### 3.1 Producto / Insumo

Cada ítem del inventario tiene:
- **SKU** único (RG-001, CUP-DEC-001, etc.).
- **Nombre** + **categoría** (Pasteleria, Postres, Salados, Galletas, Sobre Pedido…).
- **Área de almacén** (Refrigerados, Secos, Congelados — define dónde se guarda).
- **Stock mínimo / máximo** (umbrales para alertas).
- **Costo de producción** (por unidad).
- **Vida útil** en días (5 para tres leches, 30 para galletas, 365 para arroz…).
- **Estado** (activo / inactivo).

Reginas tiene hoy **97 productos reales** sembrados desde `fayxzvov_reginas.order_products`, repartidos en 8 categorías. Ver [sample_admin-inventarios.js](../src/js/sample_admin-inventarios.js).

### 3.2 Stock

El stock es la cantidad disponible de un producto **por sucursal y por almacén**. Estados derivados:
- **OK** — stock ≥ mínimo.
- **Bajo** — stock < mínimo y > 0.
- **Agotado** — stock = 0.
- **Vida útil crítica / próxima** — días restantes antes de caducidad.

### 3.3 Movimiento (evento raíz)

Todo cambio de stock se materializa como un **evento** con folio único, fecha-hora, sucursal, usuario, tipo y renglones (productos afectados). Los tipos canónicos:

| Tipo | Signo | Folio | Origen del cambio |
|---|---|---|---|
| **ENTRADA** | + | `ENT-####` | Recepción de mercancía (producción / proveedor / transferencia / devolución). |
| **SALIDA POS** | − | implícito en venta | Venta registrada en el POS. |
| **SALIDA PED** | − | implícito en pedido | Pedido despachado. |
| **MERMA** | − | `M-####` | Producto dado de baja (caducidad / dañado / robo / error producción / devolución externa). |
| **TRANSFERENCIA** | ± | `TRA-####` | Traspaso entre sucursales (sale de una, entra a otra). |
| **AJUSTE** | ± | `AJU-####` | Conteo físico que corrige el sistema (faltante, sobrante, cierre mensual). |
| **DEVOLUCIÓN** | + | implícito en devolución | Cliente regresa producto vendido. |

Cada evento mantiene `stockPrev` → `stockPost` por renglón, lo que permite reconstruir la trazabilidad completa del producto.

---

## 4. Pantallas y flujos

### 4.1 Menú principal — `inventario-menu.html`

Grilla 5x1 de tarjetas. Cada tarjeta lleva al submódulo correspondiente.

```
┌─────────┬─────────┬──────────────┬─────────┬───────────┐
│  STOCK  │ENTRADAS │ MOVIMIENTOS  │ MERMAS  │ TRASPASOS │
│  📦     │  ⬇      │  🔁          │  🗑      │  ↔        │
└─────────┴─────────┴──────────────┴─────────┴───────────┘
       └──────────────── CONFIGURACIÓN (admin) ─────────┘
```

### 4.2 Stock actual — `pos-stock.php`

**Propósito:** ver qué hay disponible y dónde, con alertas.

**Datos visibles por fila:**
- Producto + SKU + categoría.
- Stock total + stock por sucursal (filtro).
- Min / Max.
- Precio / Costo.
- Estado (OK / Bajo / Agotado).
- Vida útil (badge OK / próximo / crítico).

**Acciones:**
- Filtros: sucursal, categoría, nivel.
- Click en fila → panel lateral con historial reciente del producto (`SAMPLE_MOV_TIMELINE`) y desglose por almacén.

**KPIs:** Total productos, OK, Bajo, Agotado, En vida crítica.

### 4.3 Entradas — `pos-entradas.php`

**Propósito:** registrar y consultar recepciones de mercancía.

**Orígenes:**
- **Producción** — la propia panadería produjo cupcakes, pasteles, galletas.
- **Proveedor** — recepción de orden de compra externa.
- **Transferencia** — entró desde otra sucursal (cierra el ciclo de un traspaso).
- **Devolución** — entró producto que había salido.

**Datos por entrada:**
- Folio `ENT-####`.
- Origen + sucursal destino.
- Productos con cantidad, costo unitario, stock previo.
- Nota libre (referencia a OC, cliente, etc.).
- Estado: Aplicada / Pendiente / Reversada.
- Totales: nº productos, total unidades, costo total.

**Flujo típico:** capturar productos → confirmar → estado Aplicada → impacta stock inmediatamente.

### 4.4 Movimientos — `pos-movimientos.php`

**Propósito:** bitácora unificada de TODO lo que pasó (entradas, salidas, mermas, traspasos, ajustes, devoluciones).

**Una fila = un renglón de movimiento** (un producto en un evento). Si una entrada tuvo 3 productos, aparecen 3 filas con el mismo folio.

**Columnas:**
- Producto + SKU.
- Tipo (badge codificado por color).
- Cantidad con signo (+/−).
- Stock antes / después.
- Costo unitario y total con signo.
- Referencia (Venta #1043, Pedido #1042, Caducidad, etc.).
- Usuario + fecha.

**Es la pantalla forense:** se filtra por producto, fecha, tipo, sucursal para auditar.

### 4.5 Mermas — `pos-mermas.php`

**Propósito:** registrar pérdidas (producto que ya no se puede vender).

**Motivos:**
- **Caducidad** — vencimiento.
- **Dañado** — golpeado, roto, derramado.
- **Error producción** — salió mal del horno.
- **Robo / Faltante** — desaparece sin explicación.
- **Devolución** — el cliente devolvió, no se reaprovecha.

**Datos por merma:**
- Folio `M-####`.
- Motivo.
- Productos con cantidad y costo unitario.
- Costo de pérdida (negativo).
- Foto opcional (evidencia).
- Nota libre.
- Estado: Aplicada / Reversada.

**Flujo:** identificar pérdida → capturar productos → registrar motivo → confirmar → stock baja, costo se contabiliza como pérdida.

### 4.6 Traspasos — `pos-traspasos.php`

**Propósito:** mover mercancía entre sucursales con flujo de aprobación.

**Estados del flujo:**
1. **Solicitado** — sucursal destino pide.
2. **Autorizado** — admin/origen aprueba.
3. **En Tránsito** — salió de origen, aún no llega.
4. **Recibido** — destino confirma recepción.
5. **Rechazado** — origen niega (falta de stock, error).

**Datos por traspaso:**
- Folio `TRA-####`.
- Sucursal origen → destino.
- Productos con cantidad y costo.
- Quién solicitó, quién autorizó.
- Fecha de solicitud y envío.
- Timeline (cada cambio de estado con fecha + usuario).
- Stock previo en origen y destino (para validar).

**Impacto en stock:**
- Al pasar a **En Tránsito**: stock origen baja.
- Al pasar a **Recibido**: stock destino sube.
- Si pasa a **Rechazado**: no toca stock.

### 4.7 Administrador de Inventarios — `admin-inventarios.php`

**Propósito:** mantener los catálogos base del módulo.

**Tabs actuales:**
- **Productos** — alta/edición/baja de productos terminados (SKU, nombre, área, max, min, costo, vida útil).
- **Almacenes** — alta/edición/baja de almacenes (nombre, sucursal, dirección, "general por defecto").

**Tab planeada (cuando se active dimensión Insumos):**
- **Insumos** — alta/edición/baja de insumos (materia prima) con unidades (kg, lt, pza, caja) y áreas de consumo (Cocina, Barra, Panadería).

**Regla de negocio:** solo puede haber **un almacén general por sucursal**. Marcar uno desmarca los demás de la misma sucursal automáticamente.

---

## 5. Reglas de negocio destacadas

1. **Singularidad por sucursal del almacén general.** Cada sucursal tiene exactamente un almacén "general por defecto" (donde caen movimientos no especificados).

2. **Stock es por (producto, sucursal, almacén).** Un mismo SKU en dos almacenes son dos saldos distintos. La vista de Stock consolida con filtros.

3. **Folios prefijados por tipo de evento.** `ENT-` entradas, `M-` mermas, `TRA-` traspasos, `AJU-` ajustes, `INV-FIS-` inventarios físicos. Únicos por empresa.

4. **Reversabilidad.** Cada evento tiene estado (Aplicada / Pendiente / Reversada). Reversar genera un evento espejo de signo opuesto, no borra el original (auditabilidad).

5. **Snapshots por renglón.** Cada `detail_*` guarda `previous_stock` + `resulting_stock` + `cost_unit_snap` para reconstruir el estado del producto en ese momento (no depende del estado actual del catálogo).

6. **Aprobación obligatoria en traspasos.** Stock no se mueve sin que ambas partes confirmen.

7. **Mermas afectan inventario y contabilidad.** El costo se materializa como pérdida operativa (alimenta reportes de mermas).

8. **Ajustes requieren motivo categorizado.** No se ajusta sin una razón clasificada (Faltante sin explicar, Entrada no registrada, Conteo físico, Cierre mensual…).

9. **Caducidad gatilla merma sugerida.** Productos con `vida_util` próximos a vencer aparecen en alertas; al vencer pueden generar merma sugerida (Caducidad).

10. **Productos inactivos no aparecen en operación.** Si se desactiva un producto, sigue visible en historial pero no en selectores de entrada/merma/traspaso/venta.

---

## 6. Datos sembrados (referencia rápida)

### 6.1 Productos
- **97 productos** reales en `SAMPLE_PRODUCTOS_DB` (extraídos de `fayxzvov_reginas.order_products`, subsidiaries_id=4 = Reginas).
- Distribución por área: Pasteles Tradicionales (27), Pasteles Especialidades (15), Postres (16), Bocadillos (18), Sobre Pedido (5), Pan (2), Galletas (2), Charolas (5).

### 6.2 Almacenes
- **7 almacenes** mapeados desde sucursales activas de `fayxzvov_alpha.subsidiaries` (companies_id=4): Marinni Centro, Club Campestre, Reginas Central Gpe, Altozano, Club Campestre Tap, Reginas Cuarta, Reginas Kafeto.

### 6.3 Movimientos / Mermas / Traspasos
Muestras pequeñas (6–9 registros cada una) para validar render. Cubren los casos: producción matutina, recepción de proveedor, transferencia entre sucursales, caducidad, error de producción, robo/faltante, devolución.

---

## 7. Convenciones técnicas

### 7.1 Frontend
- Cada submódulo es una clase `App extends Templates` (patrón coffeeSoft).
- Archivo `sample_*.js` al top con datasets `SAMPLE_*` (UI-first sin backend).
- Comentario `// MODO FAKE — cuando exista el backend usar: fn_ajax({ opc: 'X' }, api).then(...)` marca cada punto de integración futura.
- Renderiza con `createCoffeeTable3` + `createfilterBar` + `createModalForm`.
- Layout canónico definido en raíz `CLAUDE.md` (`primaryLayout` con `heightPreset: 'full'`).

### 7.2 Convención de archivos
```
app/inventarios/
├── index.php                  ← landing del módulo
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
├── templates/                  ← prototipos HTML estáticos (CoffeeMagic)
│   ├── admin-inventarios.html
│   ├── admin-productos.html
│   ├── admin-almacenes.html
│   ├── admin-nivel-stock.html
│   └── inventario-menu.html
├── plan/                       ← arquitectura dual-tracking POS/Insumos
│   ├── propuesta-salida-insumos.md
│   └── templates/
│       ├── selector-ambito.html
│       ├── inventario-menu-extendido.html
│       ├── salidas-insumos.html
│       ├── salidas-insumos-form.html
│       └── admin-insumos.html
├── example/                    ← variantes de ajustes (referencia)
└── docs/                       ← documentación viva (este archivo)
    ├── README.md
    ├── flujo-operacion.md      ← este documento
    └── propuesta-bd.md         ← propuesta de base de datos
```

### 7.3 Backend planeado
- `ctrl-pos.php` recibe `opc` por POST y dispatcha (patrón coffeeSoft).
- `mdl-pos.php` con consultas tipadas (no se ha extendido todavía a inventario completo).
- Para dual-scope: dispatcher por `$_POST['scope']` o `$_SESSION['inventory_scope']`.

---

## 8. Integraciones cross-módulo

| Módulo externo | Cómo interactúa con Inventarios |
|---|---|
| **Ventas POS** | Cada venta genera una **SALIDA POS** automática por cada producto vendido (consume stock). |
| **Pedidos** | Cada pedido despachado genera una **SALIDA PED**. |
| **Devoluciones** | Cada devolución de cliente reingresa stock como **DEVOLUCIÓN** (entrada con signo +). |
| **Producción** | Cada batch de cocción/horneado genera una **ENTRADA** tipo Producción. |
| **Compras / Proveedores** | Cada recepción de OC genera una **ENTRADA** tipo Proveedor. |
| **RRHH** | Aporta el catálogo de empleados (autoriza traspasos, registra mermas). |
| **Sucursales / Empresa** | Maestros corporativos (cross-schema `fayxzvov_alpha.subsidiaries`, `fayxzvov_admin.companies`). |

---

## 9. Pendientes / decisiones abiertas

| Pregunta | Estado |
|---|---|
| ¿Se renombran `pos-*.php` a `inv-*.php` para volverlos neutrales al scope? | Pendiente (plan/propuesta-salida-insumos.md §9.1) |
| ¿Almacenes pueden contener simultáneamente productos POS e insumos? | Asumido **sí** (no se necesita campo `scope` en warehouse) |
| ¿Default de scope: forzar gate cada sesión o respetar último uso? | Pendiente |
| Submódulo formal "Salidas" en POS — ¿se justifica o lo cubren Ventas/Mermas/Traspasos? | Decisión actual: **no se justifica en POS**; solo existe en Insumos |
| Tabla `warehouse` separada o `almacenes` heredando de `fayxzvov_almacen.areas`? | Pendiente — ver propuesta-bd.md |

---

## 10. Resumen ejecutivo

El módulo `app/inventarios` es un **gestor de inventario multi-sucursal con bitácora de eventos** organizado en 6 submódulos: Stock (visor), Entradas (recepciones), Movimientos (bitácora), Mermas (pérdidas), Traspasos (envíos entre sucursales) y Configuración (catálogos). Soporta una **arquitectura dual** que separa inventario POS (productos terminados) de Insumos (materia prima), reutilizando el mismo shell de submódulos. Está poblado con 97 productos reales de Reginas y 7 almacenes mapeados a sucursales activas. Opera 100% en modo FAKE (sin backend); el plan canónico de implementación vive en [plan/propuesta-salida-insumos.md](../plan/propuesta-salida-insumos.md). La propuesta de base de datos para materializar este flujo está en [propuesta-bd.md](propuesta-bd.md).
