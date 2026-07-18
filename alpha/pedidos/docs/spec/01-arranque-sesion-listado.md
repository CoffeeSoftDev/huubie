# 01 — Arranque, sesión/roles, navbar de sucursal, listado y filtros

Cubre lo que ve el usuario al entrar a `index.php`: el bootstrap, el contexto de sesión,
el selector de sucursal del navbar y la tabla principal de pedidos con sus filtros.

---

## 1.1 Arranque de la página (bootstrap)

**Propósito.** Cargar el contexto de sesión y pintar la vista de listado.

**Actores y disparador.** Cualquier usuario autenticado que abre `alpha/pedidos/index.php`.

**Flujo.**
1. `index.php` carga plugins (jQuery, DataTables, SweetAlert2, daterangepicker, Chart.js,
   FullCalendar, Select2) y los JS del módulo con cache-busting `?t=<?=time()?>`.
2. `app.js` corre `$(async () => {...})`:
   - `opc: getModifiers` → precarga catálogo/categorías (`categories`).
   - `opc: init` → `estado`, `clients`, `rol`, `sub_name`, `user_name`, `subsidiaries`,
     `subsidiariesCobro`, `dailyClosure`, `openShift`.
   - Instancia `app` (App), `custom` (CustomOrder), `normal` (CatalogProduct), `cierre` (Cierre).
   - `app.render()`.
3. Escucha el evento `branchChanged` de la navbar → `app.onSubsidiaryChange()`.
4. `setInterval` de 60 s → refresca fecha/hora del encabezado.

**Postcondiciones.** Variables globales de estado en memoria: `rol`, `subsidiaries`,
`dailyClosure`, `openShift`. El resto del módulo lee de ellas.

**⚠ Nota crítica.**
- **Estado global mutable disperso.** `dailyClosure` y `openShift` son variables globales que
  se sobreescriben desde varios puntos (`init`, `checkAndUpdateDailyClosure`, `syncShiftState`).
  El caso `subsidiaries_id === '0'` (Todas) **falsea** `openShift = { has_open_shift: true }`
  para habilitar la UI; si algún flujo de escritura llegara a leer ese estado creería que hay
  turno abierto cuando no lo hay. Hoy se salva porque las escrituras revalidan en backend, pero
  es una trampa latente.
- **Dos llamadas seriales al inicio** (`getModifiers` y luego `init`) que podrían ser una sola;
  `init` ya podría devolver los modificadores. Doble round-trip en cada carga.
- **`session-reset-timer.js` sigue cargado** y el propio `index.php` lo marca como *TEMPORAL
  (retirar cuando ya no se necesite)*. Revisar si aún hace falta; si no, es basura que fuerza
  un logout inesperado.

---

## 1.2 Sesión, roles y multi-tenant

**Propósito.** Determinar qué sucursales ve y sobre cuál escribe cada usuario.

**Reglas de negocio.**
- Variables de sesión: `SUB` (sucursal), `ROLID` (rol), `COMPANY_ID`/`COM` (empresa),
  `ID`/`USR` (usuario), `LOGO`, `SUBSIDIARIE_NAME` (encabezado/ticket).
- **Filtro (consulta) vs escritura son cosas distintas:**
  - El *filtro* de la lista admite `'0'` = **Todas las sucursales** (solo para roles 1/2/3/6/7).
  - La *escritura* (cobro, apertura de turno, cierre) **nunca** usa `'0'`: cae a `SUB` o a la
    sucursal específica elegida en el formulario/modal.
- Roles 1/2/3/6/7 tienen selector de navbar; los demás quedan atados a `SUB`.

**⚠ Nota crítica.**
- **El check `in_array($ROLID, [1,2,3,6,7])` está copiado literal en ~6 métodos** del backend
  (`addOrder`, `openShift`, `getShiftsByDate`, `lsSubsidiaries`, `getSubsidiariesShift`,
  `refreshSubsidiariesShift`/`getListFilterSubsidiary` en el front). No hay una función
  `canUseBranchSelector()` ni un helper de rol. Agregar/quitar un rol obliga a un *find-and-replace*
  frágil. **Extraer a un helper único** (backend y front).
- **Autorización difusa.** No hay un middleware que bloquee por URL: el rol se consulta dentro de
  cada método. Un rol 7 (restringido) que no debería aplicar descuento se controla en el front;
  conviene revisar que `addDiscount`/`editDiscount` también lo validen en backend (ver 03).
- **`'0'`/`''`/`'null'`/`'undefined'` como texto** se normalizan a mano en cada método porque
  el front manda `URLSearchParams`. Es defensivo pero repetitivo: centralizar el saneo de
  `subsidiaries_id` en un solo helper.

---

## 1.3 Navbar: selector de sucursal e indicador de turno

**Propósito.** Un solo control (en la navbar) manda el filtro de sucursal y muestra si la
sucursal seleccionada tiene turno abierto.

**Flujo.**
- La navbar (`navbar.js`) es la **dueña** del `#subsidiaries_id`. Al cambiar dispara
  `branchChanged` → `app.onSubsidiaryChange()` → `ls()` + `checkAndUpdateDailyClosure()`.
- Modelo híbrido: para admin es un **filtro de vista**; para cajero/vendedor incluye además
  "Todas" como opción de **solo consulta** (nunca escribe con `'0'`).
- Tras abrir/cerrar turno, `syncShiftState()` vuelve a preguntar al backend
  (`checkDailyClosure`, `getSubsidiariesShift`, `navbar.refreshShiftStates`) en vez de suponer
  el estado en cliente.

**⚠ Nota crítica.**
- **Sincronización por “volver a preguntar todo”.** Cada cambio de turno dispara 3 fetch de
  resincronización. Funciona, pero el estado de turno vive duplicado en: variable global
  `openShift`, snapshot `subsidiaries[].shift_opened_at`, e indicador propio del navbar. **Tres
  fuentes para un mismo hecho** → propensas a desincronizarse (de hecho `refreshSubsidiariesShift`
  existe justamente para parchear esa desincronización). Idealmente **una** fuente derivada del backend.
- El acoplamiento `app` ↔ `navbar` es por variable global `window.navbar` y `document` events;
  no hay contrato explícito. Revisar el orden de carga (si `navbar` no existe aún, el `typeof`
  lo salva, pero es acoplamiento implícito).

---

## 1.4 Listado de pedidos (`opc: listOrders`)

**Propósito.** Tabla principal: pedidos del rango/estado/sucursal seleccionados.

**Precondiciones.** Ninguna (es consulta). No exige turno abierto.

**Flujo.**
1. Front `app.ls()` manda `fi`, `ff` (rango del daterangepicker, persistido en
   `localStorage['pedidos3_calendar_range']`), `status` y `subsidiaries_id`.
2. `listOrders` sanea `subsidiaries_id`, resuelve el turno actual de esa sucursal
   (`getOpenShiftBySubsidiary`) para el **punto de turno** y llama `getOrders(...)`.
3. Por cada pedido calcula en PHP: `totalPagado = getTotalPaidByOrder`,
   `totalGral = total − discount`, `saldo = total − discount − pagado`.
4. Arma el HTML de cada celda (folio con punto de turno, cliente+teléfono, abono, total con
   descuento tachado, saldo, entrega, estado, tipo) y el `dropdown` de acciones.

**Reglas de negocio.**
- **Punto verde** = el pedido pertenece al turno abierto vigente de la sucursal filtrada;
  **punto gris** = de otro turno.
- Con descuento: el total tachado + neto en verde + etiqueta de descuento.
- Folio = `formatSucursal(subsidiaries_id, id)` (prefijo por sucursal).

**Salidas.** `{ row: [...], orders: [...] }` para `createTable`.

**⚠ Nota crítica.**
- **Lógica de presentación en el controlador.** `listOrders` arma **HTML crudo** (colores
  Tailwind, `<div>`, `<i>` de iconos) dentro del PHP. Mezcla capa de datos con capa de vista:
  cambiar un color obliga a tocar el backend, y es imposible reutilizar `listOrders` para otro
  cliente (móvil, export). El front ya tiene `createTable`; **el HTML debería armarse ahí**.
- **N+1 de pagos.** Por cada pedido se hace `getTotalPaidByOrder([id])` en un loop → una query
  por fila. Con rangos amplios (mes) es un problema de rendimiento. Debería resolverse con un
  `JOIN`/agregado en `getOrders`.
- **`return` con elemento sin clave** (`… , $subsidiaries_id ]`): entra a la respuesta con
  índice numérico `0`. Ruido inofensivo pero delata falta de revisión.
- **Cálculo de saldo duplicado** aquí y en `initHistoryPay` (03) con la misma fórmula. Si la
  regla cambia (p. ej. impuestos), hay dos lugares que actualizar.
- **`status` del filtro llega sin default** (`$_POST['status']` sin `??`): si el front no lo
  manda, PHP emite *warning* (Notice) y puede romper el `getOrders`. Revisar.

---

## 1.5 Filtros de la barra (filterBar)

**Propósito.** Acotar la lista por fecha y estado; accesos a Nuevo Pedido, Cierre del día y Calendario.

**Flujo.**
- `input-calendar` (daterangepicker) con rangos rápidos (Hoy, Ayer, Semana, Mes, Mes anterior);
  el rango se guarda en `localStorage` y sobrevive recargas.
- `select` de estados (`onchange: app.ls()`).
- Botones: **Nuevo Pedido** (`showTypePedido`), **Cierre del día** (`printDailyClose`),
  **Calendario** (exige turno abierto: `requireOpenShift()` antes de navegar).

**⚠ Nota crítica.**
- **Inconsistencia de candado.** El botón *Calendario* exige turno abierto (`requireOpenShift`),
  pero el Calendario es una vista de **consulta**; no está claro por qué consultar requiere turno.
  En cambio *Cierre del día* no lo exige (correcto). Revisar la regla: consultar no debería
  requerir turno.
- El rango por defecto es **el mes actual**, lo que arrastra el N+1 del 1.4 sobre muchas filas
  en cada carga. Considerar default "Hoy" o "Semana".
- La `filterBar` se arma con objetos de configuración (`createfilterBar`); el CSS del hueco de
  labels vacíos se parchea con `<style>` en el `index.php` (`#filterBarPedidos label:empty`).
  Deuda de estilos incrustada en el HTML de página.
