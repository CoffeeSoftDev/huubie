# PLAN — Sistema Factura SAT (módulo `app/facturador/`)

> Documento de planeación generado por **Coffee Intelligence** 🧠☕ a partir del análisis del archivo
> `Sistema Factura SAT.xlsx`. La carpeta `app/facturador/` hoy solo tiene un `index.html` vacío: es un
> **módulo nuevo por arrancar**.

---

## 1. Resumen del dominio detectado en el Excel

El archivo es la **hoja de trabajo real** con la que hoy se opera la facturación de un **punto de venta
tipo restaurante**. No es un template de UI, es el "sistema" hecho a mano en Excel que este módulo debe
sustituir. Contiene 4 hojas:

| Hoja | Qué es | Rol en el dominio |
|---|---|---|
| **Resumen** | Tablero/pivote de control con parámetros (`PORCENTAJE DE VENTA AL 16% = 0.7`, `TOTAL`, `MONTO FACTURADO`, `MONTO A FACTURAR AL 16%`, `Orden Bloqueado`, `Nuevo orden`, `TASA A FACTURAR`) | **Analítica derivada** — no se persiste (es reporte/cálculo) |
| **Venta por pago** | Export del POS: cada renglón es **un pago aplicado a una orden** (una orden puede tener varios: efectivo + tarjeta) | Fuente de las **ventas** a facturar |
| **Detallado** | Vacía | Sin datos → se ignora |
| **Facturados** | Lista de **CFDI emitidos** (RFC, folio, UUID, subtotal, IVA, IEPS, total, forma/método de pago SAT) | Fuente de las **facturas** |

### Flujo de negocio reconstruido

```
POS (restaurante)
   └─ genera ÓRDENES  ──► cada orden se cobra con 1..N PAGOS (efectivo / tarjeta)   [hoja "Venta por pago"]
                                   │
                                   ▼
                        el cliente pide FACTURA (auto-emisión)
                                   │
                                   ▼
                        se emite un CFDI  ──► RFC, UUID, subtotal/IVA/IEPS/total     [hoja "Facturados"]
                                   │
                                   ▼
              TABLERO: ¿cuánto se ha facturado vs. la meta (0.7 de venta, al 16%)?   [hoja "Resumen"]
```

### Observaciones clave de los datos

- **Orden ↔ pago es 1:N.** El "ID" (p. ej. `461741`) se repite por cada forma de pago de la misma orden.
  Ese "ID" es la **llave de cruce** entre "Venta por pago" y "Facturados".
- **Orden ↔ factura es 1:0..1** en los datos (auto-emisión, un CFDI por ticket). Se marca con la columna
  `Facturados = Sí/No`.
- **Cliente fiscal se repite** entre facturas (mismo RFC facturado varias veces → es un catálogo, no un
  dato incrustado).
- La hoja **Resumen** es puro cálculo (participación del día, meta al 16%, tasas). **No genera tablas.**

---

## 2. Alcance del módulo

### Dentro del alcance (lo que el Excel evidencia)

1. **Catálogos SAT** mínimos: forma de pago (`c_FormaPago`), método de pago (`c_MetodoPago`), tipo de
   orden y tipo de comprobante.
2. **Clientes fiscales** (RFC + razón social).
3. **Ingesta de ventas** del POS: orden + sus pagos.
4. **Registro/control de CFDI** emitidos (los campos que ya trae el timbrado).
5. **Tablero de facturado vs. no-facturado** (se calcula sobre las tablas, no se persiste).

### Fuera del alcance (por ahora)

- La hoja **Resumen** como tabla (es reporte derivado).
- Emisión real ante el PAC / timbrado (es integración, no modelo de datos — ver §4).
- Campos CFDI 4.0 que **no aparecen en el Excel** (uso CFDI, régimen fiscal receptor, código postal,
  moneda). Se añaden con un `ALTER TABLE` cuando se conecte el timbrado real.

---

## 3. Fases de implementación

| Fase | Entregable | Depende de |
|---|---|---|
| **F1 — Catálogos** | `payment_form`, `payment_method`, `order_type`, `invoice_type`, `customer` + seed de catálogos SAT | — |
| **F2 — Ingesta de ventas** | `sale` + `detail_sale_payment` + importador del export POS ("Venta por pago") | F1 |
| **F3 — Registro de CFDI** | `invoice` + pantalla de facturados + marca `invoiced` en `sale` | F1, F2 |
| **F4 — Tablero de control** | Vistas/consultas de "facturado vs. no facturado" y meta al 16% (sin tablas nuevas) | F2, F3 |
| **F5 — Timbrado (futuro)** | Integración PAC + `ALTER TABLE invoice` con campos CFDI 4.0 faltantes | F3 |

---

## 4. Consideraciones de CFDI / SAT detectadas en los datos

- **`Forma de Pago` = catálogo SAT `c_FormaPago`.** En los datos: `01-Efectivo`, `04-Tarjetas de crédito`.
  El código (`01`, `04`) es parte del estándar SAT → se guarda `code CHAR(2)`.
- **`Método de Pago` = catálogo SAT `c_MetodoPago`.** En los datos: `PUE-Pago en una sola exhibición`.
  El otro valor válido del SAT es `PPD` → `code CHAR(3)`.
- **`UUID`** = folio fiscal del timbre (36 caracteres). Debe ser **único**.
- **`Folio`** interno del emisor (`A133`, `A132`, …) — consecutivo propio, distinto del UUID.
- **`IVA` al 16%** y **`IEPS`** (en los datos `IEPS = $-`, es decir 0, pero la columna existe → se modela).
- **`Estatus` del CFDI**: `Vigente` / `Cancelado` → ciclo de vida fiscal (columna `status`).
- **`Tipo` = "Factura de punto de venta (auto emisión)"** → auto-facturación desde portal del cliente.
- **Meta de facturación**: el negocio factura una **proporción** de la venta (`0.7`) y a **tasa 16%**
  (columnas `TASA A FACTURAR`, `Orden Bloqueado`, `Nuevo orden` en Resumen). Es **regla de negocio de
  reporte**, no estructura de datos.

### Campos CFDI 4.0 que el Excel NO trae (deuda futura, no se inventan ahora)

`uso_cfdi`, `regimen_fiscal` del receptor, `codigo_postal` receptor, `moneda`/`tipo_cambio`,
`serie`, `lugar_expedicion`. Se agregan por `ALTER TABLE` al integrar el PAC (Fase 5).

---

## 5. Notas de arquitectura

- **Modo offline (sin MCP MySQL).** No hay conexión al servidor viva, así que modelo asumiendo esquema
  vacío + los maestros corporativos cross-schema. **Falta confirmar el esquema/tenant destino** antes de
  correr DDL (regla `SHOW DATABASES LIKE ...`). En la propuesta uso `rfwsmqex_facturacion` como
  **placeholder** alineado con los maestros `rfwsmqex_erp.udn/usuarios`.
- **Maestros corporativos no se duplican**: `Mesero → empleado`, `Cajero → usuario`, sucursal → `udn`
  se referencian cross-schema.
- **La hoja Resumen es derivada**: se resuelve con consultas/vistas sobre `sale` + `invoice`, nunca con
  columnas cacheadas.

> Detalle completo de tablas, diagrama y DDL en **`PROPUESTA-BD.md`**.
