# Traspasos — Mejoras y roadmap

> **Producto:** Huubie · Inventarios (POS-2)
> **Ámbito:** análisis de lo que le falta al módulo de **Traspasos** para ser robusto en producción: integridad de datos, permisos, reportes y escalamiento. Sirve como hoja de ruta priorizada por riesgo.
> **Fecha:** 2026-06-12
> **Relacionado:** [traspasos.md](traspasos.md) (cómo funciona el flujo vigente).

Cada punto trae su **severidad** y su **estado**:

- 🔴 Crítico · 🟡 Importante · 🟢 Evolución
- Estado: ✅ Hecho · 🚧 En curso · ⬜ Pendiente

---

## 1. Integridad del inventario (lo que muerde en silencio)

Es un sistema de inventario: un descuadre silencioso destruye la confianza en el stock.

### 1.1 🔴 ✅ Transacciones (atomicidad "todo o nada")
**Hecho.** Confirmar/crear/rechazar un traspaso son varias escrituras encadenadas (mover stock origen−/destino+ ×N, estado, historial). Antes corrían sueltas: si fallaba a media operación, quedaba **inventario a medio mover** y un traspaso **re-confirmable** (doble descuento).

Implementado:
- Capa de conexión con soporte de transacciones: `beginTransaction()/commit()/rollback()` + envoltorio `transaction(callable)` en [../../conf/_Conect.php](../../conf/_Conect.php). `disconnect()` es no-op mientras hay transacción activa; `_CUD`/`_Read` propagan el error solo dentro de transacción (para disparar rollback). 100% retrocompatible. Tablas verificadas InnoDB.
- `saveTraspaso`, `confirmTraspaso`, `rejectTraspaso`, `authorizeTraspaso`, `sendTraspaso` envueltas con `transaction()` en [../ctrl/ctrl-pos-traspasos.php](../ctrl/ctrl-pos-traspasos.php).

### 1.2 🔴 ✅ Validar stock disponible al confirmar
**Hecho (UI + backend).** Política elegida: **bloquear** (las existencias deben existir; no se crea stock de la nada).
- **Frontend** [traspaso-form.js](../src/js/components/traspaso-form.js): se quitó el toggle "Sin stock"; un producto con stock 0 en origen no se puede agregar y la cantidad se topa al stock disponible (`allowZero` fijo en `false`).
- **Backend** [confirmTraspaso](../ctrl/ctrl-pos-traspasos.php): pre-valida el stock de cada producto en el almacén origen antes de mover nada; si falta, devuelve `409` con el detalle del faltante. Dentro de la transacción se re-chequea y, si ya no alcanza, lanza y revierte (se eliminó el `max(0,…)` que fabricaba inventario).

### 1.3 🔴 ✅ Guardas de transición de estado en el backend
**Hecho.** El backend valida la máquina de estados, sin confiar en que la UI esconda el botón:
- `confirmTraspaso`: solo desde `REQUESTED`/`AUTHORIZED`/`IN_TRANSIT`; si ya es terminal devuelve `409` (evita doble movimiento de stock).
- `rejectTraspaso`: bloquea si ya es `RECEIVED`/`REJECTED` (evita "rechazar" un recibido sin revertir stock).
- `authorizeTraspaso` (solo `REQUESTED`) y `sendTraspaso` (solo `REQUESTED`/`AUTHORIZED`) también guardados.

### 1.4 🔴 🚧 Folio sin condición de carrera
**Código listo, falta el índice.** [getNextFolio](../mdl/mdl-pos-traspasos.php) hace `SELECT + 1` sin lock → dos traspasos simultáneos pueden tomar el mismo folio.
- **Hecho:** `saveTraspaso` genera el folio **dentro** de la transacción y **reintenta** (hasta 3 veces) ante violación de unicidad (`SQLSTATE 23000`).
- **Pendiente (requiere MySQL arriba + sin folios duplicados previos):** crear el índice único. El reintento solo surte efecto con este índice.

```sql
-- 1) Verificar que no haya duplicados antes de crear el indice:
SELECT companies_id, folio, COUNT(*) c
FROM fayxzvov_reginas.inventory_transfer
GROUP BY companies_id, folio HAVING c > 1;

-- 2) Si la consulta anterior NO devuelve filas, crear el indice unico:
ALTER TABLE fayxzvov_reginas.inventory_transfer
  ADD UNIQUE KEY uq_transfer_folio (companies_id, folio);
```

### 1.5 🟡 ⬜ Reversa / devolución
Una vez `Recibido`, si fue error no hay forma de deshacer. Lo natural: generar un traspaso inverso o un endpoint de cancelación que **revierta el stock** con su propia traza.

---

## 2. Permisos / autorización (hoy es 100% del lado del cliente)

### 2.1 🔴 ⬜ Autorización en servidor
El backend (`confirmTraspaso`, `rejectTraspaso`, `saveTraspaso`) **no verifica** que el usuario logueado pertenezca a la sucursal destino/origen. La única barrera es `isOrigin/isDestino` en el JS del panel → cualquiera con acceso al endpoint puede confirmar/rechazar **cualquier** traspaso de la empresa. El scope por sucursal es hoy solo cosmético.
**Acción:** confirmar solo si `$_SESSION['SUB'] == destination_subsidiaries_id` (o nivel admin); rechazar/cancelar análogo.

### 2.2 🟡 ⬜ Permisos granulares por acción
Quién puede *crear*, *confirmar*, *rechazar*, *autorizar*. Hoy "admin" está hardcodeado como `ROLID ∈ [1,5]` duplicado en [navbar.js](../../src/js/navbar.js) y el ctrl (`ADMIN_LEVELS`). Debería vivir en una tabla de permisos, sin duplicar la constante.

### 2.3 🟡 ⬜ Umbral de aprobación
Traspasos por encima de cierto costo/cantidad deberían exigir visto bueno de un supervisor. **Aquí cobra sentido el estado `AUTHORIZED` reservado.**

### 2.4 🟢 ⬜ Permiso por almacén
No solo por sucursal: un usuario puede manejar solo ciertos almacenes dentro de su sucursal.

---

## 3. Reportes (hoy solo KPIs del mes + impresión de 1 traspaso)

- 🟡 ⬜ **Pendientes de confirmar con antigüedad (aging):** cuántos llevan N días sin recepción. Mercancía "en el aire" — lo más importante operativamente y hoy no existe.
- 🟡 ⬜ **Exportar la lista filtrada** a Excel/CSV/PDF (hoy solo se imprime un traspaso individual).
- 🟡 ⬜ **Traspasos por sucursal y periodo:** salientes vs entrantes, valor total movido, top productos traspasados.
- 🟢 ⬜ **Kardex por producto:** que los traspasos aparezcan en el historial de movimientos de stock (entrada/salida por almacén) para auditar.
- 🟢 ⬜ **Tasa y motivos de rechazo** por sucursal y **tiempo de ciclo** (solicitud → recepción).
- 🟢 ⬜ Reemplazar el KPI **"En Tránsito"** (siempre 0 con el flujo vigente) por **"Pendientes por confirmar"** o **"Recibidos hoy"**.

---

## 4. Escalamiento

### Técnico
- 🔴 ⬜ **Esquema hardcodeado:** `$this->bd = 'fayxzvov_reginas.'` y `bdAlpha = 'fayxzvov_alpha.'` en [../mdl/mdl-pos-traspasos.php](../mdl/mdl-pos-traspasos.php) → mono-tenant. Para crecer a más empresas el prefijo debe salir de sesión/config. Es el cambio más estructural para "escalar".
- 🟡 ⬜ **Sin paginación en servidor:** [listTraspasos](../mdl/mdl-pos-traspasos.php) trae **todas** las filas y el datatable pagina en cliente. Falta LIMIT/OFFSET en servidor.
- 🟢 ⬜ **Loops de queries 1×1** en confirm (getStockRow + updateStock por producto): muchos round-trips en traspasos grandes; se puede batchear.
- 🟡 ⬜ **Índices** en `(companies_id, status_id, origin_subsidiaries_id, destination_subsidiaries_id, date_request)`.

### De negocio
- 🟡 ⬜ **Recepción parcial:** el destino recibe menos de lo enviado (faltante/daño). Hoy es todo-o-nada. Reactivar `IN_TRANSIT` + una columna `received_qty` por renglón es la evolución natural.
- 🟡 ⬜ **Costeo correcto:** el costo se congela con `COALESCE(cost_unit, price)` pero el **costo promedio del destino no se recalcula** al recibir → hueco de valuación.
- 🟡 ⬜ **Notificaciones:** el destino no se entera de un traspaso pendiente — debe ir a mirar. Badge/push/correo de "tienes traspasos por confirmar".
- 🟢 ⬜ **Evidencia:** foto/firma de recepción (la tabla ya tiene `note`, faltan adjuntos).

---

## Orden recomendado

1. ✅ **1.1 Transacciones** (hecho)
2. ✅ **1.2 + 1.3** validar stock disponible + guardas de transición (hecho)
3. 🚧 **1.4 Folio** — código de reintento hecho; falta crear el índice único cuando MySQL esté arriba (SQL en §1.4)
4. **2.1** autorización en servidor ← siguiente sugerido
5. **3** reporte de pendientes con aging + export
6. Luego: paginación (escala), recepción parcial, costeo, **1.5 reversa**.

> Los puntos 🔴 son los que de verdad "no se están contemplando" y son baratos de cerrar comparados con el daño que evitan.
