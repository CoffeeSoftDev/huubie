# Traspasos — módulo `app/inventarios`

> **Producto:** Huubie · Inventarios (POS-2)
> **Ámbito:** explicar, en lenguaje de negocio y de código, cómo funciona el submódulo de **Traspasos** (envíos de inventario entre sucursales): qué es, por qué estados pasa, qué le ocurre al stock y **cómo se recepciona**.
> **Fecha:** 2026-06-11
> **Flujo vigente:** **simplificado** — se omite el paso "En Tránsito". La sucursal **origen** crea el traspaso y la sucursal **destino** lo **confirma**; en ese único paso se **descuenta el origen y se suma el destino**.

---

## 1. ¿Qué es un traspaso?

Un traspaso es el **movimiento de uno o varios productos de una sucursal (origen) a otra (destino)**, dentro de la misma empresa.

La idea central: el inventario **no se duplica ni se pierde**. Un producto que sale de la sucursal A debe aparecer en la sucursal B sin descuadrar el conteo. Por eso un traspaso es un **proceso con estados** (una máquina de estados); en el flujo vigente el ajuste de stock (salida de A + entrada a B) ocurre **junto, en la confirmación de recepción**.

```
   Sucursal ORIGEN                          Sucursal DESTINO
  ┌───────────────┐    al confirmar la      ┌───────────────┐
  │   Almacén A   │  ───── recepción ─────▶ │   Almacén B   │
  │  (se descuenta│      (un solo paso)     │  (se suma en  │
  │   al confirmar│                         │   el mismo    │
  │   en destino) │                         │   momento)    │
  └───────────────┘                         └───────────────┘
```

---

## 2. Máquina de estados

Cada traspaso tiene un **estado**. Los códigos viven en la tabla `transfer_status` y se referencian en el backend por su `code`.

| # | Estado (UI) | Código | Quién/qué lo provoca | ¿Toca stock? |
|---|-------------|--------|----------------------|--------------|
| 1 | **Solicitado** | `REQUESTED` | Crear "Nuevo Traspaso" (lo ve el destino como pendiente de confirmar) | ❌ No |
| 2 | **Recibido** | `RECEIVED` | Confirmar recepción en destino | ✅ **Resta** origen **y** **suma** destino (juntos) |
| — | **Rechazado** | `REJECTED` | Cancelar la solicitud | — (cambia estado) |
| (reservado) | **Autorizado** | `AUTHORIZED` | — | sin UI en el flujo vigente |
| (reservado) | **En Tránsito** | `IN_TRANSIT` | — | sin UI en el flujo vigente |

`Recibido` y `Rechazado` son estados **terminales**.

```
 Solicitado ──[Confirmar Recepción]──▶ Recibido
  (REQUESTED)   resta origen + suma destino   (RECEIVED)
      │
      └─────────── Cancelar / Rechazar ──────────▶ Rechazado
                       (REJECTED)
```

> Los estados **Autorizado** (`AUTHORIZED`) y **En Tránsito** (`IN_TRANSIT`) siguen existiendo en el catálogo `transfer_status` y en el backend, pero **no se usan** en el flujo vigente. Se reservan por si en el futuro se separa el **despacho** (que aprueba/envía el origen) de la **recepción** (que confirma el destino).

---

## 3. Qué le pasa al stock

En el flujo vigente el stock se mueve **en un solo momento**: la **confirmación de recepción**.

### Al **confirmar** (`Solicitado → Recibido`)
La función `confirmTraspaso` recorre el detalle y, por cada producto, hace **dos movimientos a la vez**:
- **Resta** la cantidad del almacén **origen** (salida).
- **Suma** la cantidad al almacén **destino** (entrada).

Guarda el stock previo/posterior de **ambos** lados (`origin_stock_prev/post`, `destination_stock_prev/post`) para la trazabilidad, recalculado al momento de confirmar.

> Backend: `confirmTraspaso()` en [../ctrl/ctrl-inventarios.php](../ctrl/ctrl-inventarios.php).

### Mientras está **Solicitado**
**No se toca nada de stock.** El traspaso existe y el destino lo ve "en espera de confirmar". La mercancía sigue íntegra en el origen, por lo que se puede **cancelar** sin consecuencias sobre el inventario.

> **Compatibilidad con el flujo anterior:** si un traspaso quedó en **En Tránsito** (su origen ya se descontó al "enviar"), `confirmTraspaso` lo detecta (`status_code === 'IN_TRANSIT'`) y **no vuelve a descontar** el origen; solo suma el destino. Así no se descuadra el inventario de traspasos creados antes del cambio.

---

## 4. Cómo se visualiza el módulo

Archivo de la vista: [../src/js/pos-traspasos.js](../src/js/pos-traspasos.js). Pantalla **Visor de Traspasos** con tres zonas:

### a) KPIs (arriba)
Tarjetas del mes: **Total · Pendientes · En Tránsito · Recibidos · Rechazados**. Se alimentan de `showTraspasos` → `getTraspasoKpis`. (Con el flujo vigente el KPI **En Tránsito** queda en 0.)

### b) Tabla (centro)
Una fila por traspaso: Folio, Origen, Destino, Productos, Unidades, Costo, Solicitud, Solicitó, Recibió y **Estado** (badge de color).

La columna de operaciones ofrece solo **👁️ Previsualizar**, que abre el panel de detalle a la derecha. **Las acciones del traspaso (Confirmar / Rechazar) viven en el panel**, no en la fila.

### c) Panel de detalle (derecha)
Al hacer clic en una fila se abre el detalle:
- **Ruta del traspaso**: origen → destino, cada lado con ícono coloreado por sucursal, nombre y **almacén**.
- **Metadatos**: quién solicitó/recibió, fechas, total de productos y costo.
- **Tabla de productos** con el movimiento de stock (origen y destino, previo → posterior).
- **Historial** (timeline) de los cambios de estado.
- Abajo: el botón **Rechazar** (rojo) y la acción primaria **Confirmar Recepción** (verde), habilitada mientras el traspaso no sea terminal.

---

## 5. Cómo se recepciona un traspaso (paso a paso)

Con el flujo vigente la recepción es de **un solo clic**: **Confirmar Recepción**.

1. **Crea** el traspaso con "Nuevo Traspaso" (botón **"Crear y enviar traspaso"**). Queda en **Solicitado** y el destino lo ve pendiente de confirmar.
2. La sucursal **destino** abre el traspaso (**Previsualizar**) y revisa productos y cantidades.
3. Pulsa **"Confirmar Recepción"** (botón verde del panel).
4. El stock se **resta del almacén origen y se suma al almacén destino a la vez**, y el traspaso queda en **Recibido**.

> Confirmar en un solo paso es intencional para este flujo: salida y entrada son la misma operación administrativa hecha por el destino al recibir. Si más adelante se requiere separar el despacho del origen de la recepción del destino, se reactiva el paso **"En Tránsito"** (ver §6).
>
> Código: la acción primaria del panel se decide con `canConfirm` en [../src/js/pos-traspasos.js](../src/js/pos-traspasos.js).

---

## 6. Flujo implementado (simplificado)

El ciclo se completa end-to-end desde la interfaz **sin** los pasos de autorización ni tránsito:

```
 Solicitado ──[Confirmar Recepción]──▶ Recibido
  (Nuevo          ✅ botón verde del panel
   Traspaso)      resta origen + suma destino
      └─────────────── [Cancelar] ───────────────▶ Rechazado
```

- **Confirmar Recepción** (botón verde del panel): llama a `confirmTraspaso` → estado **Recibido**, **resta el origen y suma el destino** en el mismo paso.
- **Cancelar / Rechazar** (botón rojo): disponible mientras el traspaso no sea terminal.

> Los pasos **Autorizar** (`authorizeTraspaso`) y **Enviar** (`sendTraspaso`) **siguen existiendo en el backend** pero se **omiten** en este flujo (sin UI). Si más adelante se requiere control interno (separar quién despacha de quién recibe, con mercancía "en tránsito"), se reactivan insertando los botones correspondientes entre Solicitado y Recibido **sin tocar el resto del ciclo**. En ese caso, `sendTraspaso` descuenta el origen al salir y `confirmTraspaso` detecta el estado `IN_TRANSIT` para **no** volver a descontarlo (ver §3).

---

## 7. Referencias de código

| Pieza | Archivo | Función / símbolo |
|-------|---------|-------------------|
| Crear traspaso (form) | [../src/js/components/traspaso-form.js](../src/js/components/traspaso-form.js) | `TraspasoForm` |
| Vista / tabla / panel | [../src/js/pos-traspasos.js](../src/js/pos-traspasos.js) | `App`, `Traspasos`, `TraspasosView` |
| Listado (fila: solo Previsualizar) | [../ctrl/ctrl-inventarios.php](../ctrl/ctrl-inventarios.php) | `lsTraspasos` |
| Crear (Solicitado) | [../ctrl/ctrl-inventarios.php](../ctrl/ctrl-inventarios.php) | `saveTraspaso` |
| **Confirmar (resta origen + suma destino)** | [../ctrl/ctrl-inventarios.php](../ctrl/ctrl-inventarios.php) | `confirmTraspaso` |
| Cancelar / rechazar | [../ctrl/ctrl-inventarios.php](../ctrl/ctrl-inventarios.php) | `rejectTraspaso` |
| Autorizar | [../ctrl/ctrl-inventarios.php](../ctrl/ctrl-inventarios.php) | `authorizeTraspaso` *(reservado, sin UI)* |
| Enviar (resta origen) | [../ctrl/ctrl-inventarios.php](../ctrl/ctrl-inventarios.php) | `sendTraspaso` *(reservado, sin UI — flujo futuro "En Tránsito")* |
| Detalle + mapeo al panel | [../src/js/pos-traspasos.js](../src/js/pos-traspasos.js) | `getTraspaso`, `mapTraspasoDetail`, `traspasoDetailPanel` |
| Consulta de datos | [../mdl/mdl-inventarios.php](../mdl/mdl-inventarios.php) | `qTraspasos`, `qGetTraspaso`, `getTraspasoKpis` |
