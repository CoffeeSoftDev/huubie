# 07 — Administración: catálogo, folios, calendario y bitácora

Apartados de soporte: mantenimiento del catálogo, reasignación de folios huérfanos, vista de
calendario y la bitácora del pedido.

---

## 7.1 Catálogo (`admin.php` → `ctrl-admin.php` / `admin.js`)

**Propósito.** CRUD del catálogo que alimenta el POS: **categorías**, **productos**,
**modificadores**, **clientes** y **modificadores por producto**.

**Operaciones (`opc`).**
- Productos: `listProductos`, `getProducto`, `addProduct`, `editProduct`, `statusProducto`.
- Categorías: `listCategory`, `addCategory`, `getCategories`, `editCategory`, `statusCategory`.
- Clientes: `listClient`, `addClient`, `getClient`, `editClient`, `deleteClient`.
- Modificadores: `listModifier`, `addModifier`, `editModifier`, `getModifier`, `statusModifier`,
  y el puente producto↔modificador (`addProductModifier`, `lsModifierProduct`,
  `updateProductModifierPrice`, `statusModifierProduct`, `deleteProductModifier`).

**Reglas de negocio.** Soft-delete por `status`/`active`; los listados del POS filtran activos.

**⚠ Nota crítica.**
- **Sin control de rol visible.** `ctrl-admin.php` despacha `$obj->{$_POST['opc']}()` tras
  `session_start()` pero no se ve una verificación de que el usuario sea admin. Cualquiera con
  sesión podría llamar `deleteClient`/`statusProducto`. **Revisar autorización** de todo el CRUD.
- **Helpers de presentación en el controlador** (`renderProductImage`, `renderUserCard`,
  `renderStatus`): otra vez HTML/estilos en la capa PHP (mismo antipatrón que 01/05).
- `admin.js` (1770 líneas) concentra 4-5 clases (Category/Client/Modifier/ProductModifier). Revisar
  si conviene separar por entidad para mantenimiento.
- Los clientes se crean/editan **también** desde el alta de pedido (02) por nombre; conviven dos
  puntos de alta de cliente con reglas de deduplicación distintas. Unificar el manejo de clientes.

---

## 7.2 Administración de folios (`admin-folios/`)

**Propósito.** Herramienta para **reasignar de sucursal** los pedidos huérfanos (creados sin
sucursal), que de otro modo no caen en ningún corte.

**Flujo.** `lsFolios` lista pedidos (con badge "Sin sucursal" en rojo si `subsidiaries_id` es nulo);
`countWithoutSubsidiary` cuenta los huérfanos; `moveFolio` asigna/limpia la sucursal de un folio.

**⚠ Nota crítica.**
- **`moveFolio` no valida rol ni turno ni cierre.** Mover un folio de sucursal **cambia a qué corte
  pertenece su dinero**; hacerlo sin control (cualquier sesión, incluso sobre un pedido de un día ya
  cerrado) puede descuadrar cortes ya emitidos. Debe ser **solo admin**, quedar en **bitácora**, y
  bloquearse si el pedido pertenece a un día/turno cerrado. Hoy es una palanca contable sin candado.
- **CORS `Access-Control-Allow-Origin: *`** en el controlador: cualquier origen puede invocar estas
  operaciones (solo depende de la cookie de sesión). Cerrar a same-origin.
- Que exista esta herramienta es el **síntoma**, no la solución: los folios huérfanos no deberían
  poder crearse (ver candado de `addOrder` en 02). Es un parche manual de un problema estructural.
- HTML armado en el controlador (badges, botón "Mover").

---

## 7.3 Calendario (`calendario/`)

**Propósito.** Vista FullCalendar de los pedidos por **fecha de entrega** (`date_order`), con color
por estado y filtro por sucursal/estado/entrega. Solo consulta.

**Flujo.** `getCalendar` arma eventos (`title`=cliente, `start`=fecha de entrega, color por
estado). `init` da sucursales y perfil.

**⚠ Nota crítica.**
- **`updateDeliveryStatus` está DUPLICADO aquí y es una copia inferior** del de `ctrl-pedidos.php`
  (3.3): **no** valida `canWriteOrder`, su mensaje solo distingue entregado/no-entregado (pierde
  "para producir", pese a que el estado 2 sí se guarda) y **no** escribe bitácora. Dos
  implementaciones del mismo cambio de estado con reglas distintas: unificar en una sola (la de
  `ctrl-pedidos.php`, que sí valida y registra).
- **CORS `*`** igual que admin-folios.
- El acceso al Calendario exige turno abierto desde el botón de pedidos (01), lo que contradice que
  aquí sea "vista de consulta para cualquier usuario". Regla incoherente (ver 01.5).
- Los colores de estado están **hardcodeados en el backend** (`#6E95C0`, `#FE6F00`…) y repetidos
  respecto al front y a `statusCorte`/`status` de otros controladores. Centralizar la paleta de estados.

---

## 7.4 Bitácora / historial del pedido

**Propósito.** Registrar la actividad del pedido: automática (pagos, ediciones, descuentos,
entrega, cancelación) y manual (comentarios del usuario).

**Piezas.**
- Automática: `logHistory` / `logOrderHistory` (mdl) → `order_histories` con `type`
  (`payment`/`edition`/`discount`/`delivery`/`cancellation`/`price`…).
- Manual: `addHistory` (comentario libre) + `getHistory` (`listHistories`).
- Estrategia por fases documentada en `docs/estrategia-bitacora.md` (diseño).

**Reglas de negocio.** Hoy la bitácora automática está **realmente activa sobre todo para pagos**
y las ediciones/estados recién instrumentados (2.x/3.x); el resto del patrón `*_histories` es
parcial.

**⚠ Nota crítica.**
- **`addHistory` hace `util->sql($_POST)`** → **mass-assignment** del comentario manual (cualquier
  columna que mande el front). Restringir a `{ order_id, comment, date_action }`.
- **El comentario NO se atribuye a un usuario:** `$_POST['usr_users_id'] = $_SESSION['ID']` está
  **comentado** (línea 949). La bitácora manual queda sin autor → inútil para auditoría de "quién
  dijo qué". Reactivar la atribución.
- **Cobertura desigual.** La creación de pedido no deja rastro propio (lo delega a `addPayment`);
  varios flujos del catálogo/personalizado no loguean en alta (`isEdit=0`). Para que la bitácora
  sirva como fuente de auditoría del descuadre, definir **qué eventos son obligatorios** y
  registrarlos siempre, no según el flag del front.
- La bitácora es la herramienta natural para rastrear los movimientos de dinero problemáticos
  (cobros cruzados, ediciones post-cierre, moves de folio). Priorizar cerrarla como se plantea en
  `estrategia-bitacora.md`.

---

## 7.5 Piezas temporales / código muerto en el árbol

- **`session-reset-timer.js`** — marcado *TEMPORAL* en `index.php`; fuerza un reinicio de sesión.
- **`ctrl-projects.php` / `mdl-projects.php`** — tabla `projects` inexistente.
- **`mdl-pedidos-catalogo.php`** — archivo vacío (0 líneas).
- **`calendario.zip`, `ctrl/error.log`, `calendario/error_log`** — artefactos versionados que no
  deberían estar en el repo.
- **`templates/pos/*.html`** — wireframes/propuestas estáticas (propuesta-1/2/3, pos-inventario,
  pos-merma…): útiles como referencia de diseño, pero no son parte del sistema productivo; conviene
  separarlos de `templates/` productivo o marcarlos claramente como `mockups/`.

**⚠ Nota crítica.** El árbol mezcla código vivo, código muerto, mockups y logs. Hace difícil saber
qué se ejecuta. Limpiar el árbol (o documentar en este spec qué es qué, como aquí) reduce el riesgo
de que alguien "arregle" un archivo que no corre.
