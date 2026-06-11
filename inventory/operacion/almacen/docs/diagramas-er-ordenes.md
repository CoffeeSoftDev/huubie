# Diagramas ER por sección — Módulo Órdenes / Solicitudes de Compra

> Base de datos: `fayxzvov_inventory` (MySQL 5.7, WAMP local)
> Vista de revisión generada desde [plan-ordenes-solicitudes.md](plan-ordenes-solicitudes.md).
> Script fuente: [../sql/2026-06-09_purchase_order.sql](../sql/2026-06-09_purchase_order.sql).
> Una **ficha por tabla**, agrupada por sección, para revisar de un vistazo.

> **Leyenda:**  `●` PK   `·` campo   `──▶` FK de negocio   `┄▷` FK tenant/puente.

> Mismo estilo que [diagramas-er-inventory.md](diagramas-er-inventory.md). La OC vive
> sobre el catálogo de **insumos** (`item`), `unit`, `warehouse` y `supplier` ya
> documentados en ese diagrama; aquí se referencian como FK externas.

---

## Sección 1 · Orden de compra (cabecera + renglones)
*esquema: fayxzvov_inventory*

**Conexiones de la sección**
```text
purchase_order ──1:N──▶ detail_purchase_order   (CASCADE lógico, mismo active)
purchase_order ──N:1──▶ supplier · warehouse · users(solicita) · users(aprueba)
detail_purchase_order ──N:1──▶ item · unit
purchase_order ┄tenant┄▶ companies · branches
```

**Tablas**
```text
▦ purchase_order  —  cabecera de la solicitud / orden de compra
  ●   id                      INT PK
  ·   folio                   VARCHAR(20)    nextFolio('OC-'), único por empresa
  ·   date_order              DATE           fecha de solicitud
  ·   expected_date           DATE           fecha esperada
  ·   note                    VARCHAR(255)
  ·   total_products          INT            denormalizado
  ·   total_units             DOUBLE         denormalizado
  ·   total_cost              DOUBLE         denormalizado
  ·   total_price_without_tax DOUBLE         denormalizado
  ·   status                  VARCHAR(20)    Borrador|Solicitada|Aprobada|Parcial|Recibida|Rechazada|Cancelada
  ·   approved_at             DATETIME       sello al aprobar/rechazar
  ·   reject_reason           VARCHAR(255)
  ·   active                  TINYINT(1)     borrado lógico
  ·   created_at              DATETIME
  ·   updated_at              DATETIME
  ──▶ supplier_id             supplier       OPCIONAL (requisición interna)
  ──▶ warehouse_id            warehouse      destino sugerido; se fija al recibir
  ──▶ user_id                 users          quien solicita
  ──▶ approved_user_id        users          quien aprueba/rechaza
  ┄▷  branch_id               branches       (tenant · sucursal solicitante)
  ┄▷  companies_id            companies      (tenant)

▦ detail_purchase_order  —  renglones (materiales pedidos)
  ●   id                      INT PK
  ·   quantity_ordered        DOUBLE         lo solicitado
  ·   quantity_received       DOUBLE         acumulado recibido (recepciones parciales)
  ·   price_without_tax       DOUBLE         null en solicitud; lo captura el gestor
  ·   tax                     INT            % impuesto
  ·   cost                    DOUBLE         null en solicitud
  ·   subtotal                DOUBLE
  ·   active                  TINYINT(1)
  ──▶ purchase_order_id       purchase_order (renglón de la OC)
  ──▶ item_id                 item           insumo pedido
  ──▶ unit_id                 unit           unidad de medida
```

---

## Sección 2 · Vínculo con entradas de almacén
*esquema: fayxzvov_inventory*

**Conexiones de la sección**
```text
purchase_order ──1:N──▶ inventory_inflow   (cada recepción ENT- apunta a su OC)
inventory_inflow.purchase_order_id = NULL  →  entrada directa (sin OC)
```

Cada `receiveOrden` clampea al pendiente (`quantity_ordered - quantity_received`)
y genera una entrada `ENT-` (origen `COMPRA`, estado `Aplicada`) con su detalle y
actualización de `stock`. La columna nueva enlaza esa entrada con la OC origen.

**Tablas** *(solo la columna añadida; el resto vive en [diagramas-er-inventory.md](diagramas-er-inventory.md) · Sección 5)*
```text
▦ inventory_inflow  —  encabezado de entrada  (+ columna de vínculo)
  ●   id                      INT PK
  ·   …campos existentes…     (folio, status, totales, fechas, etc.)
  ──▶ purchase_order_id       purchase_order  OC/solicitud que generó la entrada
                                              (NULL = entrada directa)
```

---

## Sección 3 · Referencias externas (catálogos ya existentes)
*esquema: fayxzvov_inventory / fayxzvov_erp*

> No se crean ni modifican; la OC solo los referencia. Detalle completo en
> [diagramas-er-inventory.md](diagramas-er-inventory.md).

**Conexiones**
```text
item      ◀──N:1── detail_purchase_order.item_id        (insumo)
unit      ◀──N:1── detail_purchase_order.unit_id        (unidad)
warehouse ◀──N:1── purchase_order.warehouse_id          (destino)
supplier  ◀──N:1── purchase_order.supplier_id           (proveedor · opcional)
branches  ┄tenant┄ purchase_order.branch_id             (sucursal solicitante · fayxzvov_erp)
users     ◀──N:1── purchase_order.user_id / approved_user_id
companies ┄tenant┄ purchase_order.companies_id
```

---

## Mapa de relaciones (resumen)

```text
                         ┌───────────────────────┐
        companies ┄┄┄┄┄┄▷│    purchase_order     │◀┄┄┄┄ branches (tenant · sucursal)
                         │  (cabecera · OC-####)  │◀──── supplier  (opcional)
   users (solicita) ────▶│                        │◀──── warehouse (destino)
   users (aprueba) ─────▶│                        │
                         └───────────┬────────────┘
                                     │ 1:N
                                     ▼
                         ┌───────────────────────┐
                         │ detail_purchase_order  │──▶ item
                         │ (qty_ordered/received) │──▶ unit
                         └───────────────────────┘

   recepción (receiveOrden) genera:
                         ┌───────────────────────┐
        purchase_order ─▶│   inventory_inflow     │  (ENT-, origen COMPRA)
            1:N          │ + purchase_order_id    │  NULL = entrada directa
                         └───────────────────────┘
```
```text
Flujo de estados:
Borrador ──submit──▶ Solicitada ──approve──▶ Aprobada ──receive──▶ Parcial ──receive──▶ Recibida
                         │                                         (mientras quede pendiente)
                         └──reject──▶ Rechazada
Cancelada: desde cualquier estado no terminal.
```

---
