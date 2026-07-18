# 02 — Captura de pedido

Todo el flujo de "armar un pedido": elegir el tipo, crear la cabecera, agregar productos de
catálogo o un pastel personalizado, adjuntar imágenes de referencia e imprimir el ticket.

Controladores: `ctrl-pedidos.php` (cabecera), `ctrl-pedidos-catalogo.php` (productos),
`ctrl-pedidos-personalizado.php` (pastel + imágenes).
Front: `app.js` (cabecera), `pedidos-catalogo.js` (POS), `pedidos-personalizado.js`.

---

## 2.1 Selección de tipo de pedido (`showTypePedido`)

**Propósito.** Puerta de entrada al alta: valida los candados y ofrece "catálogo" o "personalizado".

**Precondiciones / candados (front).**
- El día **no** debe estar cerrado para la sucursal.
- Debe existir un **turno abierto del día actual** (un turno de un día anterior no sirve; debe
  cerrarse primero).

**⚠ Nota crítica.**
- Los candados del front (`showTypePedido`) y del backend (`addOrder`) **están duplicados con
  redacción distinta**. El front decide con el estado en memoria (`openShift`, `dailyClosure`);
  el backend revalida contra la BD. Es correcto tener el candado en backend, pero la lógica de
  "turno de otro día" vive descrita en dos lados y puede divergir. Documentar el candado como
  **una** regla y que el front solo la refleje.

---

## 2.2 Alta de pedido (`opc: addOrder`)

**Propósito.** Crear la cabecera del pedido (cliente + datos de entrega) en estado Cotización.

**Flujo.**
1. Resuelve el **cliente**: `getClientName([name])`; si no existe, `createClient` (queda ligado a
   la sucursal del pedido).
2. Resuelve la **sucursal** del pedido:
   - Roles 1/2/3/6/7 → del `$_POST['subsidiaries_id']`; si llega vacío/`'0'`/`'null'`, admin cae a
     `null` (y se corta), los demás a `$_SESSION['SUB']`.
   - Otros roles → `$_SESSION['SUB']`.
   - Si queda vacía → **400** "Selecciona una sucursal específica".
3. Candado de turno: `getOpenShiftBySubsidiary`; sin turno → **423**.
4. `INSERT order` con `status=1`, `type_id=1`, `date_creation=NOW`, `cash_shift_id`, `subsidiaries_id`.
5. Devuelve el folio (`getMaxOrder`).

**Reglas de negocio.**
- **Un pedido nace atado a un turno** (`cash_shift_id`). Sin turno abierto no puede nacer (evita
  pedidos huérfanos que no caen en ningún corte).
- La bitácora de creación **no** se escribe aquí (el pedido nace sin productos); el resumen lo
  registra `addPayment` del catálogo al "Terminar".

**⚠ Nota crítica.**
- **`getMaxOrder()` para recuperar el folio recién creado** es una condición de carrera: dos
  altas concurrentes en la misma sucursal pueden leer el mismo `MAX(id)`. Debería usarse el
  `lastInsertId` del INSERT, no un `MAX` posterior.
- **Cliente identificado por nombre** (`getClientName([name])`): dos clientes con el mismo nombre
  colisionan (se reusa el primero) y un nombre nuevo con un typo crea un cliente duplicado. No hay
  llave natural (teléfono) para deduplicar. Origen del historial de clientes duplicados.
- **Pedido sin productos es válido**: `addOrder` crea la cabecera aunque nunca se agregue un
  producto. Si el usuario abandona, queda una Cotización en $0 colgando (contamina la lista y los
  conteos por estado del corte). Revisar limpieza de cotizaciones vacías.
- El folio visible se arma con `formatSucursal`, pero el `id` es global (autoincrement de `order`),
  no una secuencia por sucursal → el "folio" salta números entre sucursales. Ver `admin-folios` (07).

---

## 2.3 Edición de pedido (`opc: editOrder`)

**Propósito.** Actualizar cabecera (cliente, fecha/hora de entrega, tipo, nota).

**Flujo.**
1. Lee `prevOrder` (para el diff de bitácora).
2. Resuelve/crea/actualiza el cliente (si el nombre existe, **actualiza** su teléfono/email).
3. `updateOrder` de los campos de cabecera. **La sucursal NO se reescribe** (un pedido no cambia
   de sucursal).
4. `logOrderEditionDiff(prev)` registra en bitácora solo los campos que cambiaron (normaliza
   fecha/hora para no marcar cambios cosméticos).

**⚠ Nota crítica.**
- **`editOrder` NO llama a `canWriteOrder`.** `cancelOrder` sí valida propiedad de sucursal, pero
  editar la cabecera no: cualquier usuario con acceso al módulo puede editar un pedido de otra
  sucursal (pasando el `id`). **Inconsistencia de autorización** — aplicar `canWriteOrder` también
  aquí (y en los métodos de `ctrl-pedidos-catalogo.php`, ver 2.5).
- **Al editar el cliente por nombre se sobrescriben teléfono/email del cliente existente**
  globalmente. Si dos pedidos comparten cliente, editar uno pisa los datos del otro. Efecto
  colateral silencioso.
- Rama de rol: usa `ROLID == 1` (no el set completo `[1,2,3,6,7]`) para leer `subsidiaries_id`,
  pero como no lo reescribe, no rompe; aun así es una **tercera variante** del check de rol.

---

## 2.4 Cancelación y eliminación

**`cancelOrder`** — cambia `status` a 4 (Cancelado). Valida `canWriteOrder`. Bitácora `cancellation`.
**`deleteOrder`** — existe en `ctrl-pedidos.php`; borrado lógico/físico del pedido.

**⚠ Nota crítica.**
- **`cancelOrder` hace `updateOrder($this->util->sql($_POST, 1))`**: escribe **todo** el `$_POST`
  como columnas del pedido, no solo `status`. Es **mass-assignment**: el front controla qué campos
  se actualizan. Debe restringirse a `{ id, status }`.
- Existen dos caminos de anulación (`cancelOrder` vía status 4 y `deleteOrder`). Documentar cuándo
  se usa cada uno; si `deleteOrder` borra físico, rompe la trazabilidad del corte (un pedido que
  estaba en un turno cerrado desaparece del recálculo). Revisar.

---

## 2.5 POS de catálogo: productos del pedido

**Propósito.** Agregar/editar/quitar renglones de productos de catálogo al pedido.
Controlador `ctrl-pedidos-catalogo.php`; front `pedidos-catalogo.js` (`CatalogProduct`).

**Operaciones (`opc`).**
| opc | Qué hace |
|---|---|
| `init` / `getCategory` / `lsProducto` / `getProduct` | catálogo para el POS |
| `addProduct` | inserta renglón (`order_products`/paquete) + recalcula total |
| `editProduct` | edita dedicatoria/detalle + sube imágenes |
| `quantityProduct` | cambia cantidad + recalcula total (+ bitácora si es edición) |
| `removeProduct` / `deleteAllProducts` | quita renglón(es) + recalcula total |
| `lsProductOrderPackage` | lista los renglones del pedido |
| `addPayment` | **"Terminar"**: fija total/estado y opcionalmente cobra (ver 03) |

**Reglas de negocio.**
- Cada cambio de renglón dispara `updateTotalOrder(pedidos_id)` que recalcula `total_pay` sumando
  precios de los productos.
- La bitácora por renglón solo se registra en **edición** (`isEdit=1`); al armar el pedido nuevo
  no, para no llenar el historial.

**⚠ Nota crítica.**
- **Ningún método del catálogo valida `canWriteOrder`.** `addProduct`, `editProduct`,
  `quantityProduct`, `removeProduct`, `deleteAllProducts` operan por `pedidos_id` sin verificar
  que el pedido sea de la sucursal del usuario ni que haya turno abierto. La autorización real del
  módulo tiene un **hueco** en toda la capa de productos.
- **`addProduct` hace `createProduct($this->util->sql($_POST))`** → mass-assignment de todo el POST
  como columnas del renglón (precio incluido: el cliente puede mandar cualquier `price`). El precio
  debería tomarse del catálogo en backend, no confiar en el POST.
- **Subida de archivos sin validación (`editProduct`).** `mkdir(..., 0777)`, acepta cualquier
  extensión (`pathinfo` → `strtolower(ext)` sin whitelist), sin límite de tamaño ni verificación
  MIME. Riesgo de **subida de archivo arbitrario** en carpeta accesible por web
  (`alpha_files/{company}/{sub}/order/images/`). Validar tipo (jpg/png/webp), tamaño y desactivar
  ejecución en esa carpeta.
- **`updateTotalOrder` recalcula sumando `price`** de cada producto; conviene confirmar que
  respeta `quantity` (precio de línea = precio × cantidad). Si suma solo `price`, los cambios de
  cantidad no impactarían el total. **Revisar** (`updateTotalOrder`, catalogo:567).
- **`mdl-pedidos-catalogo.php` está VACÍO (0 líneas):** el controlador de catálogo hereda del
  modelo de pedidos. Un archivo modelo vacío en el árbol es señal de refactor a medias — borrar o
  poblarlo.

---

## 2.6 Pastel personalizado (`ctrl-pedidos-personalizado.php`)

**Propósito.** Armar un pastel a medida como renglón especial del pedido (porciones, componentes,
dedicatoria) con su propio registro.

**Operaciones (`opc`).**
| opc | Qué hace |
|---|---|
| `addCustomOrder` | crea el pastel personalizado (paquete + productos custom) |
| `getCustomOrder` / `getCustomOrderByPackageId` | recupera el armado |
| `editCustomOrder` / `editOrderPackage` | edita el armado |
| `cancelCustomOrder` | anula el pastel |
| `addModifierProduct` | agrega modificadores/extras al renglón |
| `addOrderImages` / `getOrderImages` / `deleteOrderImage` | imágenes de referencia |

**Reglas de negocio.**
- El pastel se almacena en `order_custom` + `order_custom_products` y se enlaza al pedido vía el
  paquete (`order_package`).
- `updateTotalOrder` (privado, duplicado también aquí) recalcula el total del pedido.

**⚠ Nota crítica.**
- **`updateTotalOrder` está triplicado**: existe en `ctrl-pedidos-catalogo.php`,
  `ctrl-pedidos-personalizado.php` y hay lógica equivalente en `ctrl-pedidos.php`. Tres
  implementaciones del "recalcular total del pedido" que pueden divergir. **Unificar en el modelo.**
- Misma ausencia de `canWriteOrder` que el catálogo (hueco de autorización).
- El modelo de datos del pastel (porciones/componentes) no está documentado en el ER; conviene
  mapear `order_custom` / `order_custom_products` y sus columnas para no perder la semántica.

---

## 2.7 Imágenes de referencia (`order_images`)

**Propósito.** Adjuntar fotos de referencia del pastel, ligadas al renglón (`package_id`).

**Flujo.** `addOrderImages` mueve el archivo a `alpha_files/{company}/{sub}/order/images/` y guarda
`path`, `name`, `original_name`, `package_id`. `deleteOrderImage` borra el registro (revisar si
borra también el archivo físico). Al re-subir en `editProduct` se hace `removeOrderImages` + re-insert.

**⚠ Nota crítica.**
- **Mismo riesgo de subida sin validación** que 2.5. Además la ruta se compone con
  `$_SESSION['COMPANY']`/`SUB` sin sanear → revisar path traversal si esos valores fueran
  manipulables.
- **`deleteOrderImage` probablemente solo borra el registro**, dejando el archivo huérfano en
  disco (fuga de almacenamiento). Confirmar y, si aplica, borrar el archivo.

---

## 2.8 Ticket de pastelería

**Propósito.** Comprobante imprimible del pedido (`#ticketPasteleria`), armado en el front
(`pedidos-catalogo.js`) con estilos `@media print` definidos en `index.php`.

**⚠ Nota crítica.**
- Los estilos de impresión viven **incrustados en `index.php`** (`.no-print`, ocultar scrollbar,
  `#ticketPasteleria`). Deberían estar en un CSS del módulo. Además el reset global
  `::-webkit-scrollbar { width:0 }` oculta **todos** los scrollbars de la app, no solo el ticket
  — decisión de UX cuestionable (el usuario pierde el indicador de scroll).
