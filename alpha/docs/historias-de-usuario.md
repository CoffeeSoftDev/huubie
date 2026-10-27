# Historias de usuario — reconstrucción de Huubie (alpha → multiempresa)

> **Fuente:** inspección de `alpha/` (código + BD local `fayxzvov_reginas` / `fayxzvov_alpha`) al 26/10/2026.
> **Destino:** sistema nuevo multiempresa con el modelo de `fayxzvov_erp`
> (`companies → branches → users_braches` con rol por sucursal; permiso = **sección × tipo de permiso**).

## Cómo leer este documento

- Cada historia trae: **ID**, enunciado (*como / quiero / para*), **permiso sugerido**, **criterios de aceptación** y **En alpha hoy** (cómo funciona y en qué archivo).
- Cada criterio lleva una etiqueta:
  - **[igual]** se conserva como en alpha.
  - **[cambia]** alpha lo hace distinto (o mal) y en el nuevo se corrige.
  - **[nuevo]** no existe en alpha.
- Los códigos entre paréntesis como **(N1)**, **(P6)**, **(C1)** son los hallazgos que el equipo ya documentó en `alpha/pedidos/docs/plano-pedidos-revision.html`. Si un criterio los cita, es para que no vuelvan a pasar.
- Las cifras de uso (p. ej. "1,522 pedidos") son de la copia local de la BD y sirven para saber qué se usa de verdad y qué no.
- Permisos: se usan los tipos que ya existen en `fayxzvov_erp.type_permissions` (`ver`, `agregar`, `editar`, `cancelar`, `eliminar`, `imprimir`, `tabular`). Donde hace falta uno que no existe se marca **(tipo nuevo)**: `cobrar`, `descontar`, `autorizar`, `producir`, `entregar`, `cerrar`, `reabrir`, `recalcular`.
- **Alcance** de un permiso: `sucursal` (solo la suya) o `empresa` (todas las sucursales de su empresa).

---

## Índice

0. [Tu clasificación → dónde quedó](#0-tu-clasificación--dónde-quedó)
1. [Mapa de alpha módulo por módulo](#1-mapa-de-alpha-módulo-por-módulo)
2. [Glosario y catálogos fijos](#2-glosario-y-catálogos-fijos)
3. [Reglas transversales del sistema nuevo](#3-reglas-transversales-del-sistema-nuevo)
4. [Quién puede hacer qué hoy (matriz real de alpha)](#4-quién-puede-hacer-qué-hoy-matriz-real-de-alpha)
5. [Pedidos](#5-pedidos-ped)
6. [Armado del pedido (catálogo de venta)](#6-armado-del-pedido--catálogo-de-venta-pos)
7. [Pedido personalizado (paquetes)](#7-pedido-personalizado--paquetes-per)
8. [Pagos](#8-pagos-pag)
9. [Descuentos](#9-descuentos-des)
10. [Estados de pago](#10-estados-de-pago-epa)
11. [Estados de producción y entrega](#11-estados-de-producción-y-entrega-een)
12. [Turnos](#12-turnos-tur)
13. [Cierre del día (Corte Z)](#13-cierre-del-día--corte-z-cie)
14. [Catálogo (productos, categorías, modificadores, clientes)](#14-catálogo-cat)
15. [Reportes, visor y dashboard](#15-reportes-visor-y-dashboard-rep)
16. [Avisos por WhatsApp](#16-avisos-por-whatsapp-wa)
17. [Administración](#17-administración-adm)
18. [Acceso y sesión](#18-acceso-y-sesión-acc)
19. [Eventos (banquetes)](#19-eventos--banquetes-evt)
20. [Reservaciones](#20-reservaciones-res)
21. [Fuera de alcance / código muerto](#21-fuera-de-alcance--código-muerto)
22. [Decisiones pendientes](#22-decisiones-pendientes)
23. [Apéndice: fórmulas y validaciones](#23-apéndice-fórmulas-y-validaciones)

---

## 0. Tu clasificación → dónde quedó

| Tu bloque | Lo que pusiste | Historias | Lo que agregué |
|---|---|---|---|
| **Pedidos** | ver calendario / ver tabla, ver (modal), editar, imprimir, crear (normal / paquetes-personalizado), cancelar, eliminar | PED-01 … PED-14, POS-01 … POS-08, PER-01 … PER-07 | Buscar por folio o cliente, editar solo datos de entrega, bitácora y comentarios, cambiar sucursal del pedido, armado del pedido (catálogo de venta) como bloque propio |
| **Pagos** | ver, crear, editar, cancelar, eliminar, imprimir, historial, aplicar descuento | PAG-01 … PAG-09, DES-01 … DES-05 | Cobro cruzado (cobrar en otra sucursal), candado de turno, anti-doble-cobro, "terminar pedido sin cobro" (Cotización / Pendiente) |
| **Estados de pago** | ver, crear, editar, cancelar, eliminar | EPA-01 … EPA-05 | Recomiendo **no** crear ni eliminar estados (la lógica depende de ellos); sí personalizar nombre y color. Ver EPA-03 |
| **Estados de pedido / envío / proceso** | ver, crear, editar, cancelar, eliminar | EEN-01 … EEN-07 | Producción como rol propio (palomita "ya lo elaboré"), tipo de entrega local / domicilio, flujo único en vez de dos campos que se pisan |
| **Turnos** | ver, crear, editar, cancelar, eliminar, imprimir | TUR-01 … TUR-09 | Cerrar turno, recalcular corte, detalle (pedidos del turno, abonos de días anteriores, cobros cruzados) |
| **Catálogo** (dijiste que te faltaba) | — | CAT-01 … CAT-14 | Productos, categorías, modificadores con opciones y precio, clientes, motivos de descuento |
| — | — | CIE-01 … CIE-08 | **Cierre del día (Corte Z)**: no estaba en tu lista y es de lo más delicado |
| — | — | REP, WA, ADM, ACC, EVT, RES | Reportes, avisos por WhatsApp, administración, acceso, eventos y reservaciones |

---

## 1. Mapa de alpha módulo por módulo

| Módulo | Carpeta | Uso real | Qué hace (verbos) |
|---|---|---|---|
| **Acceso** | `access/` | 59 usuarios | Iniciar sesión con usuario + contraseña o con clave alterna · cambiar la sucursal activa · armar el menú lateral según el rol · mantener viva y expirar la sesión · cerrar sesión |
| **Menús / layout** | `menus/`, `layout/` | — | Mostrar el lanzador de módulos (Menú, Ventas, Configuración) · barra superior con selector de sucursal y estado del turno · barra lateral |
| **Pedidos** (lista) | `pedidos/index.php`, `ctrl-pedidos.php` | 1,522 pedidos · 1,952 pagos | Listar por rango de fechas, estado, sucursal y tipo · buscar por folio o cliente · crear · editar · editar liquidado con contraseña · cancelar · eliminar · cobrar · eliminar pago · cambiar método de pago · aplicar / editar / eliminar descuento · marcar entrega · ver detalle · ver e imprimir ticket · ver bitácora y agregar comentario |
| **Armado del pedido** (POS) | `pedidos-catalogo.js`, `ctrl-pedidos-catalogo.php` | 1,577 partidas | Filtrar productos por categoría · agregar producto · cambiar cantidad · quitar partida (con reglas de bloqueo) · vaciar pedido · editar dedicatoria, detalles y fotos de una partida · terminar pedido (cobrar o guardar como Cotización / Pendiente) · enviar aviso de WhatsApp |
| **Pedido personalizado** | `pedidos-personalizado.js`, `ctrl-pedidos-personalizado.php` | 1,094 pasteles · 5,430 opciones elegidas · 644 fotos | Armar un pastel por pasos con modificadores · calcular precio sugerido por porciones · fijar precio real · subir fotos de referencia · editar el pastel · quitar fotos |
| **Turnos** | `ctrl-pedidos.php` (openShift / closeShift …), `shift-ticket.js` | 895 turnos | Abrir turno con fondo inicial · consultar turno abierto · listar turnos del día · ver métricas en vivo · cerrar turno · imprimir ticket de cierre de turno · ver pedidos del turno |
| **Cierre del día** | `pedidos-cierre.js`, `ctrl-cierre.php` | 409 cierres | Revisar si el día se puede cerrar (checklist) · cerrar el día · ver días pendientes de cerrar (15 días) · ver el cierre ya hecho · ver Corte de caja · reabrir un cierre con motivo · recalcular un turno |
| **Calendario de pedidos** | `pedidos/calendario/` | — | Ver pedidos por fecha de entrega en mes / semana / día con foto · filtrar por estado, entrega y sucursal · buscar · palomear producción · cambiar estado de entrega · ver detalle · cobrar · descuentos · editar datos de entrega · imprimir |
| **Catálogo** (admin de pedidos) | `pedidos/admin.php`, `ctrl-admin.php` | 185 productos · 11 categorías · 12 modificadores con 228 opciones · 1,160 clientes | Crear / editar / activar-desactivar productos (con foto), categorías, modificadores y sus opciones con precio; crear / editar / desactivar clientes |
| **Visor de pedidos** | `order-visor/` | — | Consultar turnos, cierres y tickets por periodo · ver historial de pagos de un pedido · cambiar el método de un pago · ver bitácora del pedido · imprimir |
| **Reportes de pedidos** | `pedidos-reportes/` | — | (Solo administrador) reportes de tickets, turnos, tickets del día, corte, turnos con tickets, detalle de un turno, detalle de pedidos · exportar a PDF |
| **Dashboard** | `dashboard-pedidos.js` → `apiDashboard` | — | Métricas del mes: tarjetas de totales, comparativo de ingresos diarios, ventas por día de la semana |
| **Admin** | `admin/` | 8 sucursales · 8 roles · 17 permisos · 10 cláusulas | Editar empresa y logo · CRUD sucursales · CRUD usuarios (varias sucursales, clave alterna) · matriz de permisos por rol (**creada pero el código no la consulta**) · perfil propio · cláusulas del ticket · catálogo de paquetes para eventos |
| **WhatsApp** | `admin/whatsapp.php`, `ctrl-wa-config.php`, `conf/_Message.php` | 2 configuraciones · 13 destinatarios · 333 envíos | Configurar proveedor (Green API / UltraMsg) · probar conexión · CRUD destinatarios por tipo de aviso · editar plantillas con variables · ver historial de envíos · enviar prueba · avisos automáticos de pedido, pedido editado, cierre de turno y cierre del día |
| **Eventos** | `eventos/` | 48 eventos · 109 pagos | Crear evento (nace como cotización) · armar menú con paquetes, productos y extras · subeventos con su propio menú y platillos · registrar anticipos · descuento · imprimir contrato con cláusulas · calendario · bitácora |
| **Reservaciones** | `reservaciones/` | **0 registros** | Crear / editar / cancelar reservación · bitácora |
| **Calendario general** | `calendario/` | stub (17 líneas) | Nada útil todavía |

---

## 2. Glosario y catálogos fijos

| Concepto | Valores en alpha | Dónde vive |
|---|---|---|
| **Estado del pedido** (pago) | 1 Cotización · 2 Pendiente · 3 Pagado · 4 Cancelado | `status_process` (`order.status` y `order.type_id` se escriben iguales) |
| **Estado de entrega** | 0 No entregado · 1 Entregado · 2 Para producir | `order.is_delivered` |
| **Palomita de producción** | Producido = `produced_at` con fecha; sin palomita = NULL | `order.produced_by`, `order.produced_at` |
| **Tipo de entrega** | 0 Local (recoge en tienda) · 1 A domicilio | `order.delivery_type` |
| **Tipo de pedido** | Normal (productos del catálogo) · Personalizado (tiene alguna partida con `custom_id`) | se deriva de `order_package.custom_id` |
| **Método de pago** | 1 Efectivo · 2 Tarjeta · 3 Transferencia | `method_pay` |
| **Turno** | `open` / `closed`; uno abierto por sucursal | `cash_shift` |
| **Cierre del día** | `status` 0 = cerrado · 1 = reabierto | `daily_closure` |
| **Folio** | `P{id del pedido}-{sucursal a 2 dígitos}` → `P45-01` | `formatSucursal()` |
| **Bitácora** (tipos) | `event` (creado) · `edition` · `price` · `payment` · `discount` · `delivery` · `cancellation` · `deletion` · comentario manual | `order_histories` |
| **Cobro cruzado** | Pago registrado en una sucursal distinta a la del pedido | `order_payments.subsidiaries_id ≠ order.subsidiaries_id` |
| **Abono de días anteriores** | Pago de hoy a un pedido creado otro día; en el corte va aparte | consultas de `mdl-cierre.php` |
| **Roles alpha** | 1 Administrador · 2 Cajero · 3 Vendedor · 4 Lectura · 6 Supervisor · 7 Supervisor (restringido) · 8 Producción · y la bandera `owner` (dueño) | `usr_rols`, `usr_users.owner` |

---

## 3. Reglas transversales del sistema nuevo

Aplican a **todas** las historias. Cada una sale de algo concreto que pasó en alpha.

| ID | Regla | Por qué (lo que pasó en alpha) |
|---|---|---|
| **RT-01** | Todo registro lleva `company_id` y, si opera en sucursal, `branch_id`. El servidor filtra siempre por la empresa de la sesión; nunca confía en un id que mande el navegador. | En alpha varios controladores reciben el id del pedido y no revisan que sea de la empresa (`editOrder`, `updateDeliveryStatus` del calendario). |
| **RT-02** | Los permisos se resuelven con la matriz **sección × tipo de permiso** (`fayxzvov_erp.permissions` + `permissions_roles`). Ningún `if (rol == 1)` en el código. | Alpha tiene `usr_permissions` (17 permisos) y la pantalla para editarlos, pero el código sigue usando listas fijas de `ROLID` en 61 lugares. Cambiar un permiso en la pantalla no cambia nada. |
| **RT-03** | Cada permiso con alcance declara `sucursal` o `empresa`. Ver "todas las sucursales" es el alcance de `ver`, no un permiso aparte. | Alpha mezcla `in_array(ROLID, [1,2,3,6,7])` para "ver todas" con reglas de escritura por sucursal. |
| **RT-04** | Totales, saldos y estados **se calculan en el servidor** a partir de las partidas y los pagos guardados. El front solo muestra. | `addPayment` de la lista toma `total` y `saldo` del front; con el panel desincronizado marcó Pagado pedidos cobrados a la mitad (pedidos 493 y 958). |
| **RT-05** | La partida guarda **su propio precio** al momento de venderse. Cambiar el precio en el catálogo no toca pedidos existentes. | En alpha el precio de la partida sale del catálogo en cada consulta (`COALESCE(order_products.price, …)`); `updateTotalOrder` recalcula con el precio de hoy. |
| **RT-06** | Toda operación que mueve dinero o estado es **idempotente**: un doble clic no duplica nada (llave de idempotencia por envío, botón deshabilitado mientras responde). | Pagos duplicados por doble clic (pedidos 115, 520, 1417); pastel guardado dos veces (493, 958). Alpha lo parcha con una ventana de 10 segundos. |
| **RT-07** | Fechas y horas se calculan en la **zona horaria de la sucursal**. Los inputs reciben `YYYY-MM-DD` / `HH:mm`; el formato de pantalla nunca viaja a un formulario. | (N1) al editar salían fecha y hora de hoy; (N2) de noche salía mañana por `toISOString()` en UTC. |
| **RT-08** | **Bitácora obligatoria** en cada cambio: quién, cuándo, qué campo, valor antes y después, y motivo cuando la operación lo pide. Las acciones desde el calendario también dejan rastro. | (K7) lo que se marca en el calendario no queda en el historial; cancelar no guarda quién ni cuándo (las columnas `cancelled_by/at` existen y quedan vacías). |
| **RT-09** | Operaciones peligrosas piden **re-autenticación** (contraseña del usuario o su segunda clave). Contraseñas con bcrypt/argon2. | Alpha guarda `key` en MD5 y la compara en texto en 6 lugares. |
| **RT-10** | El dinero **no se borra físicamente**: un pago se anula con registro de quién, cuándo y motivo, y queda visible tachado. Los catálogos se desactivan y se pueden reactivar. | Alpha borra el pago (`deletePayment`) y desactiva clientes sin forma de recuperarlos (A3). |
| **RT-11** | Un solo término por concepto en toda la interfaz: **Total**, **Descuento**, **Neto**, **Pagado**, **Saldo**. | (P9) al mismo dato le dice Abono, Pagado y Total pagado; al saldo, Saldo, Restante y Monto restante. |
| **RT-12** | Los mensajes de éxito dicen lo que realmente pasó. | (N8) "Pedido creado con éxito" sin productos; (N10) "Pago registrado correctamente" sin cobrar nada. |
| **RT-13** | Los endpoints son una lista blanca explícita y todos validan sesión. | Alpha ejecuta `$obj->{$_POST['opc']}()`: cualquier método público se puede llamar; `ctrl-pedidos-catalogo.php` y `ctrl-pedidos-personalizado.php` no revisan sesión. |
| **RT-14** | Esquema con migraciones versionadas y pruebas que ejecuten cada consulta contra una BD de prueba. | Hoy: `Unknown column 'order.created_by'` (código adelante de la BD) y `HY093` (consulta con 4 `?` llamada con 2) que vivió de agosto a octubre. |
| **RT-15** | Los botones que ve el usuario salen de los mismos permisos que valida el servidor. Si no puede, no ve el botón (o lo ve deshabilitado con el porqué). | (P7) deja abrir "Editar descuento" y al guardar dice que no tiene permiso; "Eliminar" aparece al dueño y el servidor lo rechaza. |
| **RT-16** | Folio consecutivo **por sucursal** (`P-04-000123` o el formato que decidas), independiente del id interno. | Hoy el número es el id global de la tabla; (P8) el folio de Pagos no coincide con el de la lista en pedidos de otra sucursal. |

---

## 4. Quién puede hacer qué hoy (matriz real de alpha)

Lo que **valida el servidor** hoy (no lo que muestra la pantalla). Sirve para sembrar la matriz de permisos del nuevo sistema y para ver los huecos.

| Acción | Admin (1) | Cajero (2) | Vendedor (3) | Lectura (4) | Supervisor (6) | Superv. restr. (7) | Producción (8) |
|---|---|---|---|---|---|---|---|
| Ver lista de otras sucursales | ✔ | ✔ | ✔ | sin selector, pero el servidor lo permite ⚠ | ✔ | ✔ | sin selector, pero el servidor lo permite ⚠ |
| Ver cotizaciones | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ |
| Crear pedido | ✔ (debe elegir sucursal) | ✔ | ✔ | ✔ ⚠ | ✔ | ✔ | ✔ ⚠ |
| Editar pedido no liquidado | ✔ | ✔ | ✔ | ✔ ⚠ | ✔ | ✔ | ✔ ⚠ |
| Editar pedido liquidado | ✔ + contraseña | ✔ + contraseña | ✘ | ✘ | ✘ | ✘ | ✘ |
| Editar entrega de liquidado | ✔ + contraseña | ✘ | ✘ | ✘ | ✔ + contraseña | ✔ + contraseña | ✘ |
| Cancelar | ✔ | su sucursal; otra si tiene turno abierto | igual que cajero | su sucursal ⚠ | su sucursal | su sucursal | su sucursal ⚠ |
| Eliminar pedido | ✔ + motivo + contraseña, sin pagos | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| Registrar pago | ✔ | ✔ | ✔ | ✔ ⚠ | ✔ | ✔ | ✔ ⚠ |
| Cambiar método de un pago | ✔ | ✘ | ✘ | ✘ | ✔ | ✔ | ✘ |
| Eliminar pago | ✔ + motivo | ✘ | ✘ | ✘ | ✔ + motivo (sin botón) | ✘ | ✘ |
| Aplicar / eliminar descuento | su sucursal (sin tope) | igual | igual | igual ⚠ | igual | igual | igual ⚠ |
| Editar descuento | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| Quitar partida bloqueada | ✔ + motivo | ✘ | ✘ | ✘ | ✔ + motivo | ✘ | ✘ |
| Cambiar estado de entrega | su sucursal | su sucursal | su sucursal | su sucursal ⚠ | su sucursal | su sucursal | ✘ en calendario |
| Palomear producción | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✔ |
| Abrir / cerrar turno | ✔ | ✔ | ✔ | ✔ ⚠ | ✔ | ✔ | ✔ ⚠ |
| Cerrar el día | ✔ | ✔ ⚠ | ✔ ⚠ | ✔ ⚠ | ✔ | ✔ | ✔ ⚠ |
| Reabrir día · Recalcular turno · Reportes · Permisos | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |

⚠ = el servidor **no lo impide** aunque el rol no debería poder (por ejemplo, Lectura puede crear y cobrar dentro de su sucursal; cualquiera puede cerrar el día). En el nuevo sistema todo esto sale de la matriz de permisos (RT-02).

---

## 5. Pedidos (PED)

### PED-01 · Ver pedidos en tabla
**Como** cajero, vendedor o supervisor **quiero** ver los pedidos de mi sucursal (o de todas, si tengo alcance) en una tabla **para** saber qué hay que cobrar, producir y entregar.
**Permiso:** `pedidos · ver` (alcance `sucursal` | `empresa`)

**Criterios de aceptación**
1. [igual] Columnas: Folio, Fecha de creación, Cliente (nombre + teléfono), Pagado, Total, Saldo, Fecha de entrega, Hora de entrega, Estado, Estado de entrega, Tipo de entrega (local / domicilio), Acciones.
2. [igual] Si el pedido tiene descuento, Total muestra el neto y, debajo, el total tachado y el monto del descuento.
3. [igual] El folio lleva un punto verde si el pedido es del turno abierto actual; gris si no.
4. [igual] Un ícono distingue los pedidos personalizados.
5. [igual] Filtros: rango de fechas, estado, sucursal (si tengo alcance `empresa`) y tipo (normal / personalizado).
6. [cambia] El filtro de fechas dice claramente sobre qué fecha filtra (**creación** o **entrega**) y se puede elegir cuál (L2).
7. [cambia] "Hoy" se recalcula cada día; no queda guardada la fecha de ayer (L1). Fechas en formato `dd/mm/aaaa` y calendario en español (L3).
8. [cambia] Montos con signo de pesos; un pagado en cero se muestra como `$0.00`, no como guion (L9).
9. [igual] Clic en folio, fecha, cliente o entrega abre el detalle (PED-03); clic en Pagado / Total / Saldo abre Pagos (PAG-01), solo si tengo permiso de cobrar ese pedido.
10. [cambia] Las acciones del menú salen de la matriz de permisos y del estado del pedido (ver tabla de acciones por estado en EPA-05), no de reglas por rol escritas en el código.
11. [cambia] Con "Todas las sucursales" cada pedido muestra su sucursal y los avisos de turno dicen de qué sucursal hablan (L6).

**En alpha hoy:** `ctrl-pedidos.php::listOrders()` + `dropdownOrder()`; JS `app.js::ls()`, `createFilterBar()`.

---

### PED-02 · Buscar un pedido por folio o cliente
**Como** cajero **quiero** escribir un folio o un nombre y encontrar el pedido **para** atender rápido a quien llega a recoger o a pagar.
**Permiso:** `pedidos · ver`

**Criterios de aceptación**
1. [igual] Acepta `P45-01`, `P45` o `45`; el número se traduce al pedido.
2. [igual] Con búsqueda activa se ignoran rango de fechas y estado; busca en todo el historial.
3. [igual] Con alcance `empresa` busca en todas las sucursales; sin él, solo en la suya.
4. [igual] Muestra como máximo 15 resultados para no traer de más con nombres comunes.
5. [cambia] Si el folio existe, aparece primero y exacto (L8).
6. [cambia] Si hay un filtro de tipo activo (p. ej. "Personalizados") que esconde resultados, se avisa o se ignora durante la búsqueda (L7).
7. [nuevo] Busca también por teléfono del cliente.

**En alpha hoy:** `listOrders()` (regex `^P?(\d+)(?:-\d+)?$`, límite 15).

---

### PED-03 · Ver detalle del pedido (modal)
**Como** usuario de la sucursal **quiero** ver todo el pedido en una sola ventana **para** confirmar qué se vende, cuánto se debe y cómo se entrega.
**Permiso:** `pedidos · ver`

**Criterios de aceptación**
1. [igual] Datos: folio, sucursal, cliente (nombre, teléfono, correo), fecha de creación, fecha y hora de entrega, tipo de entrega, nota, cumpleaños, estado, estado de entrega, quién lo capturó, quién lo produjo y cuándo.
2. [igual] Productos: tarjeta por partida. Normal: foto, nombre, cantidad, precio, dedicatoria y detalles. Personalizado: galería de fotos, porciones, opciones elegidas por categoría, precio.
3. [igual] Resumen: Total, Descuento, Neto, Pagado, Saldo; lista de pagos con fecha, método, monto, sucursal donde se cobró y observación.
4. [igual] Producción no puede abrir el detalle de una cotización.
5. [cambia] El detalle desde la lista y desde el calendario es el mismo componente, con las mismas acciones (P10).
6. [cambia] Un pedido pagado no muestra el saldo en rojo (P11).

**En alpha hoy:** `getOrderDetails()`; JS `app.js::showOrder()` y `calendario-pedidos.js::showOrder()` (dos copias distintas).

---

### PED-04 · Crear pedido normal
**Como** cajero o vendedor **quiero** capturar cliente y datos de entrega y luego armar el pedido con productos del catálogo **para** registrar la venta.
**Permiso:** `pedidos · agregar` (alcance `sucursal` | `empresa`)

**Criterios de aceptación**
1. [igual] Datos del cliente: nombre (obligatorio), teléfono (obligatorio), correo (opcional), cumpleaños (opcional).
2. [igual] Datos del pedido: fecha de entrega, hora de entrega, tipo de entrega (local / domicilio), notas.
3. [igual] La sucursal del pedido es la mía; con alcance `empresa` puedo elegir otra, pero **una específica**, nunca "Todas".
4. [igual] Solo se puede crear si la sucursal del pedido tiene **turno abierto**; si no, el mensaje dice qué sucursal y cómo abrirlo (L4, N7).
5. [cambia] El cliente se identifica por **teléfono**, no por nombre exacto. Si escribo un teléfono existente, se ofrecen sus datos; si corrijo datos de un cliente existente, se actualizan en su ficha (N4).
6. [cambia] Teléfono de exactamente 10 dígitos (N5).
7. [cambia] La fecha de entrega no puede ser anterior a hoy (N3).
8. [cambia] La fecha y hora por defecto son las locales de la sucursal (N2).
9. [cambia] El pedido es **borrador** mientras se arma: no aparece en cortes ni avisos y no dice "Pedido creado con éxito" hasta que se termina con al menos una partida (N8). Ver POS-07.
10. [cambia] Si cambio la sucursal y el botón Guardar se deshabilita, se dice por qué (N6).
11. [igual] Queda registrado quién lo capturó (`created_by`) y en qué turno (`cash_shift_id`).
12. [igual] Bitácora: "Pedido creado".

**En alpha hoy:** `addOrder()` crea el pedido de inmediato como Cotización (estado 1) y busca el cliente por nombre exacto; JS `app.js::addOrder()` → `normal.initPos()`.

---

### PED-05 · Crear pedido con pastel personalizado
**Como** cajero **quiero** agregar a un pedido un pastel armado a la medida **para** vender pedidos especiales con su precio calculado.
**Permiso:** `pedidos · agregar`

**Criterios de aceptación**
1. [igual] Es una partida más del pedido: un pedido puede mezclar productos normales y uno o varios personalizados.
2. [igual] El armado sigue PER-01 … PER-04.
3. [igual] El pedido se marca como personalizado si tiene al menos una partida personalizada.

**En alpha hoy:** `ctrl-pedidos-personalizado.php::addCustomOrder()` crea `order_custom` + su partida en `order_package` + las opciones en `order_custom_products`.

---

### PED-06 · Editar pedido
**Como** cajero **quiero** corregir cliente, entrega, notas y productos de un pedido no liquidado **para** reflejar lo que el cliente pidió.
**Permiso:** `pedidos · editar` (alcance `sucursal` | `empresa`)

**Criterios de aceptación**
1. [cambia] El formulario carga los valores reales del pedido: fecha y hora de entrega y cumpleaños **no** se reemplazan por los de hoy (N1). *(Corregido en alpha el 26/10/2026.)*
2. [igual] Se puede editar: cliente, teléfono, correo, fecha y hora de entrega, tipo de entrega, notas y partidas (POS).
3. [cambia] El servidor valida que el pedido sea de mi empresa y de una sucursal dentro de mi alcance (hoy `editOrder` no lo valida).
4. [igual] Las partidas capturadas en días anteriores quedan en solo lectura (ver POS-04).
5. [igual] Un pedido cancelado no se puede editar.
6. [igual] Bitácora: cada campo cambiado con valor antes » después.
7. [igual] Al terminar de nuevo, si algo cambió, sale el aviso "Pedido editado" por WhatsApp (WA-07).

**En alpha hoy:** `editOrder()`; JS `app.js::editOrder()`.

---

### PED-07 · Editar pedido liquidado
**Como** cajero o administrador **quiero** corregir un pedido ya pagado con autorización **para** arreglar errores sin descuadrar el dinero.
**Permiso:** `pedidos · editar` + `pedidos · autorizar` (tipo nuevo)

**Criterios de aceptación**
1. [igual] Pide contraseña **antes** de abrir el formulario, y el servidor la vuelve a validar al guardar.
2. [igual] Datos del cliente en solo lectura; quedan abiertos fecha, hora, tipo de entrega y notas.
3. [igual] Catálogo y cobro bloqueados.
4. [igual] Bitácora con la nota "pedido liquidado, autorizado con contraseña".
5. [cambia] Una sola regla para todo el pedido liquidado. Hoy el cajero edita todo menos la fecha (desde la lista) y el supervisor cambia la fecha pero no lo demás (desde el calendario) (N12, P12). → **Decisión pendiente D-01.**

**En alpha hoy:** `paidOrderEditDenial()` (roles 1, 2), `deliveryEditDenial()` (roles 1, 6, 7).

---

### PED-08 · Editar solo datos de entrega
**Como** supervisor o cajero **quiero** mover fecha, hora, tipo de entrega o nota sin abrir el pedido completo **para** reprogramar rápido desde la lista o el calendario.
**Permiso:** `pedidos · editar` (o `entregas · editar`, si se separa)

**Criterios de aceptación**
1. [igual] Campos: fecha de entrega, hora, tipo de entrega, nota.
2. [igual] La fecha no puede quedar antes de hoy; si el pedido ya traía una fecha pasada y no se mueve, sí se deja guardar (para corregir hora o nota).
3. [igual] Un pedido cancelado no se edita; uno liquidado pide contraseña.
4. [igual] Al guardar se muestra cada campo cambiado con su valor anterior y el nuevo.
5. [igual] Bitácora con "(editado desde el calendario)" cuando aplica.

**En alpha hoy:** `getOrderDelivery()` + `editOrderDelivery()`.

---

### PED-09 · Imprimir ticket del pedido
**Como** cajero **quiero** imprimir el ticket del pedido **para** entregárselo al cliente como comprobante de lo que pidió y pagó.
**Permiso:** `pedidos · imprimir`

**Criterios de aceptación**
1. [igual] Encabezado: logo, "Pedidos de pastelería · Ticket de pedido", sucursal.
2. [igual] Folio, nombre del cliente, fecha y hora de entrega.
3. [igual] Productos: cantidad, descripción, importe; dedicatoria y detalles por partida.
4. [igual] Nota del pedido.
5. [igual] Subtotal, descuento, anticipo (pagado), restante (saldo).
6. [igual] Recomendaciones: las **cláusulas** activas de la empresa (ADM-07).
7. [igual] Leyenda "Este no es un comprobante fiscal" y "Gracias por su preferencia".
8. [igual] Si es cotización, lo dice en grande.
9. [nuevo] Reimprimir deja rastro en la bitácora.

**En alpha hoy:** `pedidos-catalogo.js::printOrder()` / `ticketPasteleria()`.

---

### PED-10 · Cancelar pedido
**Como** cajero o supervisor **quiero** cancelar un pedido que ya no va **para** que no cuente como venta ni aparezca para producir.
**Permiso:** `pedidos · cancelar` (alcance `sucursal` | `empresa`)

**Criterios de aceptación**
1. [cambia] Pide motivo obligatorio (mínimo 5 caracteres).
2. [cambia] Guarda quién y cuándo (`cancelled_by`, `cancelled_at`); hoy esas columnas quedan vacías.
3. [cambia] Se puede cancelar una Cotización o un Pendiente. Hoy un Pendiente no tiene "Cancelar" y tampoco se puede eliminar si tiene abonos: queda sin salida (L15).
4. [nuevo] Si el pedido tiene pagos, el sistema obliga a decidir qué pasa con el dinero (devolución registrada en el turno abierto o saldo a favor del cliente); no deja cancelar con dinero sin destino. → **Decisión pendiente D-02.**
5. [cambia] El aviso explica que la cancelación no se puede deshacer (o se implementa "reactivar" con permiso) (P1). → **D-03.**
6. [cambia] Botones con texto claro: "Sí, cancelar pedido" / "No, volver" (P3).
7. [igual] Un cancelado sale de producción, del calendario por defecto y de las ventas; en el corte cuenta como cancelado.
8. [igual] Bitácora: "Pedido cancelado" + motivo.

**En alpha hoy:** `cancelOrder()` escribe `status = 4` con lo que mande el front; sin motivo.

---

### PED-11 · Eliminar pedido
**Como** administrador **quiero** eliminar un pedido capturado por error **para** limpiar registros que nunca fueron venta.
**Permiso:** `pedidos · eliminar` (peligroso)

**Criterios de aceptación**
1. [igual] Pide motivo (mínimo 5 caracteres) y contraseña.
2. [igual] Un pedido con pagos **no** se elimina; el mensaje dice cuántos abonos tiene y por cuánto, y ofrece cancelarlo.
3. [igual] La bitácora se escribe antes de borrar: "Pedido P…-… eliminado — Motivo: …".
4. [cambia] El botón aparece solo a quien tiene el permiso; hoy aparece al dueño y el servidor lo rechaza.
5. [nuevo] Eliminación lógica: el pedido queda oculto con su bitácora, no se borra físicamente (RT-10).

**En alpha hoy:** `deleteOrder()` (solo rol 1).

---

### PED-12 · Ver bitácora del pedido y comentar
**Como** supervisor **quiero** ver todo lo que le pasó a un pedido y dejar comentarios **para** auditar y dar contexto al equipo.
**Permiso:** `pedidos · ver` (bitácora) · `pedidos · editar` (comentar)

**Criterios de aceptación**
1. [igual] Línea de tiempo con título, mensaje, usuario, fecha y hora, y un ícono por tipo (creado, editado, precio, pago, descuento, entrega, cancelación, eliminación, comentario).
2. [igual] Se puede agregar un comentario libre.
3. [cambia] El comentario guarda autor y fecha desde el servidor; hoy se inserta lo que mande el formulario (`util->sql($_POST)`).
4. [cambia] Todas las acciones (incluidas las del calendario y producción) llegan a la bitácora (K7).
5. [igual] Hoy solo Admin y dueño ven "Historial" en pedidos Pagados; definir en la matriz quién ve la bitácora.

**En alpha hoy:** `getHistory()`, `addHistory()`, `logOrderHistory()`.

---

### PED-13 · Ver pedidos en calendario
**Como** cajero, supervisor o producción **quiero** ver los pedidos por fecha de entrega **para** planear la producción y las entregas del día.
**Permiso:** `calendario · ver` (alcance `sucursal` | `empresa`)

**Criterios de aceptación**
1. [igual] Vistas mes, semana y día; la vista día muestra tarjetas con foto del pedido.
2. [igual] Color por estado: Cotización `#6E95C0`, Pendiente `#FE6F00`, Pagado `#0E9E6E`, Cancelado `#E60001`.
3. [igual] Filtros con contador: estados, tipo de entrega, sucursal (cualquiera o todas, es vista de consulta) y buscador que resalta coincidencias.
4. [igual] Producción no ve cotizaciones ni cancelados.
5. [igual] Cada evento muestra cliente, hora, folio, estado de entrega y marca de producido.
6. [cambia] En semana y día los pedidos se ubican a su hora y no hay textos en inglés (K5).
7. [igual] Clic abre el mismo detalle de PED-03 con sus acciones (cobrar, descuentos, editar entrega, imprimir, marcar entrega).
8. [cambia] Sin turno abierto se puede consultar igual que desde el menú (L5).

**En alpha hoy:** `pedidos/calendario/ctrl-calendario.php::getCalendar()`; JS `calendario-pedidos.js`.

---

### PED-14 · Elegir la sucursal en la barra superior
**Como** usuario con varias sucursales **quiero** cambiar la sucursal activa desde la barra **para** operar en otra tienda sin cerrar sesión.
**Permiso:** `sucursales · ver` con alcance `empresa` (en alpha: `switch_subsidiary`)

**Criterios de aceptación**
1. [igual] Solo aparecen sucursales de mi empresa (y, en el nuevo, solo aquellas donde tengo rol en `users_braches`).
2. [igual] Cada sucursal muestra si tiene turno abierto (punto de color) y se refresca.
3. [igual] Opción "Todas" solo para consulta; para crear, cobrar o abrir turno hay que estar en una sucursal específica.
4. [cambia] Mi **rol** puede ser distinto en cada sucursal (`users_braches.role_id`); al cambiar de sucursal cambian mis permisos.

**En alpha hoy:** `access/ctrl-access.php::switchSubsidiary()`, `pedidos/src/js/navbar.js`.

---

## 6. Armado del pedido / catálogo de venta (POS)

### POS-01 · Elegir productos del catálogo
**Como** cajero **quiero** ver los productos por categoría con foto y precio **para** agregarlos rápido al pedido.
**Permiso:** `pedidos · agregar` / `editar`

**Criterios de aceptación**
1. [igual] Pestañas por categoría con contador, más "Todos los productos".
2. [igual] Tarjeta con foto, nombre, precio y descripción; buscador por nombre.
3. [igual] Solo productos activos de la sucursal del pedido.
4. [igual] Se puede abrir el detalle del producto antes de agregarlo.

**En alpha hoy:** `ctrl-pedidos-catalogo.php::init()`, `getCategory()`, `lsProducto()`.

---

### POS-02 · Agregar producto al pedido
**Como** cajero **quiero** tocar un producto y que entre al pedido **para** armar la venta.

**Criterios de aceptación**
1. [cambia] Tocar dos veces el mismo producto suma cantidad, no crea dos partidas (N13).
2. [cambia] La partida guarda nombre y precio del momento (RT-05).
3. [igual] El total del pedido se recalcula en el servidor a partir de las partidas.
4. [igual] El panel del pedido se repinta con lo que realmente quedó guardado.

**En alpha hoy:** `addProduct()` inserta `order_package` y llama a `updateTotalOrder()`.

---

### POS-03 · Cambiar cantidad de una partida
**Criterios de aceptación**
1. [igual] La cantidad debe ser mayor a 0.
2. [igual] El total se recalcula.
3. [igual] En edición de un pedido existente, la bitácora registra "Aumento de precio" o "Reducción de precio": producto, cantidad antes » después e importe antes » después. Al armar un pedido nuevo no se registra cada cambio.

**En alpha hoy:** `quantityProduct()`.

---

### POS-04 · Quitar una partida
**Como** cajero **quiero** quitar un producto del pedido **para** corregir la captura.

**Criterios de aceptación**
1. [igual] Una partida capturada **hoy** en un pedido no liquidado se quita sin autorización.
2. [igual] Una partida **bloqueada** (capturada otro día, o de un pedido liquidado) solo la quita quien tenga `pedidos · autorizar`, con motivo de mínimo 5 caracteres.
3. [igual] Si el pedido ya tiene dinero cobrado, solo se puede quitar una partida **repetida** (misma partida, mismo precio, capturada otra vez en menos de 10 minutos: rastro de doble captura). Cualquier otra corrección pasa por cancelar el folio y hacer uno nuevo.
4. [igual] Nunca se permite que el neto del pedido quede por debajo de lo ya cobrado; el mensaje dice en cuánto quedaría y cuánto hay cobrado.
5. [igual] Bitácora: "Se eliminó el producto X ($…) — Motivo: …" (siempre que hubo motivo o es edición).

**En alpha hoy:** `removeProduct()` + `removeLineDenial()`; `getOrderById()` calcula `is_today` e `is_repeated`.

---

### POS-05 · Vaciar el pedido
**Criterios de aceptación**
1. [igual] Pide confirmación.
2. [cambia] Aplica las mismas reglas de bloqueo que POS-04 a cada partida (hoy borra todo sin revisar).
3. [igual] En edición, bitácora "Se eliminaron todos los productos del pedido".

**En alpha hoy:** `deleteAllProducts()`.

---

### POS-06 · Editar dedicatoria, detalles y fotos de una partida
**Criterios de aceptación**
1. [igual] Campos: dedicatoria, detalles del pedido, fotos de referencia.
2. [cambia] Las fotos se **acumulan** y se quitan una por una, igual que en personalizados (hoy en partidas normales subir fotos nuevas borra las anteriores).
3. [igual] Formatos permitidos: jpg, jpeg, png, webp, gif; se informa cuáles se rechazaron y por qué.

**En alpha hoy:** `ctrl-pedidos-catalogo.php::editProduct()` (reemplaza) vs `addOrderImages()` del personalizado (acumula).

---

### POS-07 · Terminar el pedido
**Como** cajero **quiero** terminar el pedido cobrando todo, dejando un abono o sin cobrar **para** cerrar la captura con el estado correcto.
**Permiso:** `pedidos · agregar` / `editar`; si hay cobro, además `pagos · cobrar` (tipo nuevo)

**Criterios de aceptación**
1. [igual] El modal muestra Total, Descuento, Neto, Pagado y Saldo.
2. [cambia] Tres caminos explícitos, sin interruptores escondidos (N9): **Cobrar todo**, **Dejar abono** (importe + método) o **Guardar sin cobro** (eligiendo Cotización o Pendiente, con una línea que explique la diferencia).
3. [igual] Con abono es obligatorio elegir método de pago.
4. [igual] Si el abono excede el saldo se ajusta al saldo y se avisa.
5. [igual] Se puede aplicar descuento en el mismo modal por monto o porcentaje (DES-01).
6. [igual] El estado lo decide el servidor con lo ya guardado: sin pagos → el que eligió el usuario (Cotización / Pendiente); pagos ≥ neto → Pagado; si no → Pendiente.
7. [igual] Cobrar requiere turno abierto **de hoy** en la sucursal donde cae el dinero.
8. [cambia] El mensaje final dice lo que pasó: "Pedido guardado como Cotización", "Abono de $X registrado, saldo $Y" o "Pedido pagado" (N10).
9. [igual] Al terminar sale el aviso de WhatsApp (WA-06 / WA-07). Un pedido liquidado que se edita no pasa por terminar y hoy no avisa: decidir (D-04).
10. [igual] Bitácora: pago registrado con método, o "Pedido guardado como X sin cobro — total $…, N productos", con descuento y neto si aplica, y el cambio de total respecto a lo anterior.

**En alpha hoy:** `pedidos-catalogo.js::addPayment()` → `ctrl-pedidos-catalogo.php::addPayment()` + `addOrderNotice()`.

---

### POS-08 · Bloquear el catálogo de un pedido liquidado
**Criterios de aceptación**
1. [igual] En un pedido Pagado no se agregan ni quitan partidas ni se cobra desde el armado.
2. [igual] La única baja posible es la autorizada de POS-04.

**En alpha hoy:** `pedidos-catalogo.js::lockPaidCatalog()`.

---

## 7. Pedido personalizado / paquetes (PER)

### PER-01 · Armar el pastel por pasos
**Como** cajero **quiero** elegir forma, relleno, cobertura, decoración, etc. paso por paso **para** armar el pastel que pide el cliente.
**Permiso:** `pedidos · agregar` / `editar`

**Criterios de aceptación**
1. [igual] Cada **modificador** activo del catálogo es un paso (hoy: forma, rellenos, cobertura, tipo de decoración, pisos, precio por porción según sabor, flores, chocolates y dulces, extras, cake toppers, vitrina, envío a domicilio).
2. [igual] Barra de progreso con los pasos; se puede ir y volver.
3. [igual] Modificador **normal**: se elige una sola opción.
4. [igual] Modificador **extra** (`isExtra = 1`): se eligen varias opciones, cada una con cantidad.
5. [cambia] Si un modificador es de selección múltiple lo dice su configuración, no su nombre (hoy también cuenta como múltiple cualquier nombre que contenga "decoraci").
6. [igual] Se pueden agregar opciones nuevas al vuelo con nombre y precio (quedan en el catálogo del modificador).
7. [igual] Vista previa con lo elegido.
8. [igual] Debe haber al menos una opción elegida para guardar.

**En alpha hoy:** `pedidos-personalizado.js::renderProgress()`, `renderOptions()`, `handleAddOption()`.

---

### PER-02 · Calcular precio sugerido por porciones
**Criterios de aceptación**
1. [igual] Precio sugerido = (suma de opciones de modificadores normales × número de porciones) + suma de (extras × cantidad).
2. [igual] Las porciones se capturan y el sugerido se recalcula al instante.
3. [igual] El sugerido se guarda junto al pastel (`price`).

**En alpha hoy:** `calculateSuggestedPrice()`.

---

### PER-03 · Fijar precio real del pastel
**Criterios de aceptación**
1. [igual] El cajero puede capturar un precio real distinto al sugerido; ese es el que cobra la partida (`price_real`).
2. [igual] Si lo deja vacío, se pregunta si acepta el sugerido como real.
3. [nuevo] Si el precio real queda por debajo del sugerido más allá de un porcentaje configurable, pide autorización (hoy cualquiera vende al precio que escriba).

---

### PER-04 · Nombre, dedicatoria, observaciones y fotos
**Criterios de aceptación**
1. [cambia] Un solo nombre para el pastel, prellenado (p. ej. "Pastel personalizado"), editable en el mismo formulario; sin un segundo cuadro que pida "nombre del pedido" (N11).
2. [cambia] Si el nombre queda vacío no se guarda en silencio: se avisa (N14).
3. [igual] Dedicatoria y observaciones.
4. [igual] Fotos de referencia: se acumulan, se ven en miniatura, se quitan una por una; formatos jpg, jpeg, png, webp, gif.
5. [igual] Guardar deshabilita el botón hasta que el servidor responde (RT-06); si la respuesta falla, avisa que revisen el pedido antes de volver a guardar.

**En alpha hoy:** `handleFinished()`, `saveCustomOrder()`, `addOrderImages()`.

---

### PER-05 · Editar un pastel personalizado
**Criterios de aceptación**
1. [igual] Abre el mismo armador con las opciones, porciones, precio real, dedicatoria, observaciones y fotos actuales.
2. [igual] Al guardar se reemplazan las opciones elegidas y se recalcula el total del pedido correcto (el de la partida).
3. [igual] Aplican las reglas de bloqueo de POS-04 (otro día / liquidado).

**En alpha hoy:** `renderEdit()`, `editCustomOrder()`.

---

### PER-06 · Quitar una foto del pastel
**Criterios de aceptación**
1. [igual] Borra el registro y el archivo; si el archivo ya no existe, igual se quita el registro.
2. [nuevo] Queda en bitácora.

**En alpha hoy:** `deleteOrderImage()`.

---

### PER-07 · Ver el pastel en el detalle y en el calendario
**Criterios de aceptación**
1. [igual] Galería con miniaturas y flechas; clic amplía.
2. [igual] Grilla de opciones elegidas agrupadas por modificador, con precio.
3. [igual] Precio sugerido y precio real visibles para quien tenga permiso de ver precios.

**En alpha hoy:** `coffee.js::createPersonalizedCard()`, `app.js::cardCustom()`, `customGallery()`.

---

## 8. Pagos (PAG)

### PAG-01 · Ver los pagos de un pedido
**Como** cajero **quiero** ver todos los pagos de un pedido **para** saber cuánto se ha cobrado, cómo y dónde.
**Permiso:** `pagos · ver`

**Criterios de aceptación**
1. [igual] Tabla: fecha y hora, método (chip de color: efectivo verde, tarjeta azul, transferencia violeta), monto, sucursal donde se cobró y observación.
2. [igual] Si se cobró en una sucursal distinta a la del pedido, la sucursal sale resaltada como **cobro cruzado**.
3. [igual] Resumen: Total, Descuento, Neto, Pagado, Saldo.
4. [cambia] El folio es el mismo que en la lista, aunque el pedido sea de otra sucursal (P8).
5. [cambia] Horas en formato 12 h correcto (`7:22 p. m.`, no `19:22 pm`) (P11).
6. [nuevo] Los pagos anulados se ven tachados con quién, cuándo y motivo.

**En alpha hoy:** `listPayment()`, `initHistoryPay()`; JS `app.js::historyPay()`, `lsPay()`.

---

### PAG-02 · Registrar un pago (abono o liquidación)
**Como** cajero **quiero** registrar un pago con su método **para** abonar o liquidar el pedido.
**Permiso:** `pagos · cobrar` (tipo nuevo) (alcance `sucursal` | `empresa`)

**Criterios de aceptación**
1. [igual] Campos: importe, método (efectivo / tarjeta / transferencia), observación, sucursal que cobra.
2. [igual] La sucursal que cobra por defecto es la mía; puedo elegir otra (cobro cruzado) y queda anotado en el pago y en la bitácora: "cobro cruzado: cobrado en X, pedido de Y".
3. [igual] La sucursal que cobra debe tener turno abierto **de hoy**. Si tiene un turno de otro día sin cerrar, el mensaje lo dice con la fecha.
4. [cambia] El importe no puede exceder el saldo; si lo excede, el botón no se apaga en silencio: dice por qué (P5).
5. [cambia] El estado del pedido lo calcula el servidor con los pagos guardados (RT-04): pagado ≥ neto → Pagado; si no → Pendiente.
6. [igual] Un mismo pago repetido en segundos no se duplica (RT-06).
7. [cambia] No existen pedidos Pendientes con saldo en $0.00 o negativo (P6): se valida en cada pago, descuento y cambio de partidas.
8. [igual] Bitácora: "Se registró un pago de $X (método)".

**En alpha hoy:** `ctrl-pedidos.php::addPayment()` (toma `saldo` del front) y `ctrl-pedidos-catalogo.php::addPayment()` (lo recalcula). Dos rutas para lo mismo.

---

### PAG-03 · Cambiar el método de un pago
**Como** supervisor **quiero** corregir el método de un pago mal registrado **para** que el corte cuadre.
**Permiso:** `pagos · editar`

**Criterios de aceptación**
1. [igual] Solo efectivo, tarjeta o transferencia.
2. [igual] No se puede si el turno de ese pago ya fue cerrado; en el detalle, quien tiene el permiso ve un candado con la fecha del cierre.
3. [igual] Si el método no cambia, no hace nada.
4. [igual] Bitácora: "Se cambió el método de un pago de $X de A a B".
5. [nuevo] Pide motivo.

**En alpha hoy:** `editPaymentMethod()` (roles 1, 6, 7); también desde `order-visor`.

---

### PAG-04 · Anular un pago (reemplaza "eliminar")
**Como** supervisor **quiero** anular un pago registrado por error **para** corregir el saldo sin perder el rastro.
**Permiso:** `pagos · cancelar` (peligroso)

**Criterios de aceptación**
1. [igual] Motivo obligatorio.
2. [igual] Si el pedido está liquidado, pide contraseña.
3. [igual] Si el pedido estaba Pagado y tras anular queda saldo, regresa a **Pendiente** y se avisa.
4. [cambia] El pago no se borra: queda anulado (RT-10).
5. [cambia] Misma regla que cambiar método: no se anula un pago de un turno ya cerrado sin reabrir o recalcular ese corte (hoy se puede borrar pero no cambiar el método) (P13). → **D-05.**
6. [igual] Bitácora: "Se eliminó un pago de $X … Motivo: …", con la nota de liquidado y de regreso a Pendiente si aplica.

**En alpha hoy:** `deletePay()` (roles 1, 6; botón solo para 1).

---

### PAG-05 · Eliminar un pago (físico)
**Recomendación:** no exponerlo. Si se necesita para depurar datos de prueba, que sea solo `superadmin`, con motivo y contraseña, y nunca sobre turnos cerrados.

---

### PAG-06 · Imprimir comprobante de pago
**Como** cajero **quiero** imprimir el comprobante después de cobrar **para** dárselo al cliente.
**Permiso:** `pagos · imprimir`

**Criterios de aceptación**
1. [nuevo] Comprobante del pago: folio, fecha, método, importe, pagado acumulado, saldo, sucursal y quién cobró.
2. [igual] Se puede reimprimir el ticket del pedido completo (PED-09), que ya incluye anticipo y restante.

**En alpha hoy:** solo existe el ticket del pedido.

---

### PAG-07 · Historial de pagos (consulta general)
**Como** supervisor **quiero** consultar los pagos por periodo y sucursal **para** revisar cobros sin abrir pedido por pedido.
**Permiso:** `pagos · ver` (alcance `empresa`)

**Criterios de aceptación**
1. [igual] Por periodo y sucursal; agrupado por fecha.
2. [igual] Desde cada pago se abre el pedido y su bitácora.
3. [nuevo] Filtros por método, por cobro cruzado y por usuario que cobró.

**En alpha hoy:** `order-visor.js::renderPaymentHistory()`, `renderOrderHistory()`.

---

### PAG-08 · Ver el saldo del pedido siempre correcto
**Criterios de aceptación**
1. [igual] Saldo = Total de partidas − Descuento − Pagos vigentes.
2. [igual] Se recalcula en el servidor tras cada partida, descuento, pago o anulación.
3. [nuevo] Prueba automática: ningún pedido Pagado tiene saldo > 0, ningún Pendiente tiene saldo ≤ 0.

---

### PAG-09 · Cobrar desde el calendario
**Criterios de aceptación**
1. [igual] Mismo flujo que PAG-02, incluido el candado de turno y el selector de sucursal que cobra.
2. [cambia] Es el mismo componente que en la lista, no una copia.

**En alpha hoy:** `calendario-pedidos.js::historyPay()`, `addPayment()` (copia de `app.js`).

---

## 9. Descuentos (DES)

### DES-01 · Aplicar descuento
**Como** cajero **quiero** aplicar un descuento por monto o porcentaje con su motivo **para** respetar promociones y cortesías.
**Permiso:** `pedidos · descontar` (tipo nuevo)

**Criterios de aceptación**
1. [igual] Por monto fijo o por porcentaje (el porcentaje se convierte a monto sobre el total).
2. [igual] Se ve el total original, el descuento y el neto antes de confirmar.
3. [cambia] El motivo se elige de un **catálogo de motivos** (CAT-13); alpha ya tiene la tabla `pos_discount_reason` con 5 motivos y la ignora.
4. [cambia] Cada motivo tiene un **tope de porcentaje** y si **requiere autorización** (hoy: Cortesía 100 % con autorización, Cliente frecuente 20 %, Promoción 50 %, Empleado 20 % con autorización, Otro 100 % con autorización).
5. [cambia] El servidor valida: descuento ≥ 0, ≤ total, ≤ tope del motivo, y que el neto no quede por debajo de lo ya cobrado (hoy `addDiscount` no valida nada).
6. [igual] Disponible en Cotización y Pendiente; no en Pagado ni Cancelado.
7. [igual] Bitácora: "Descuento aplicado: $X - Motivo: …".

**En alpha hoy:** `addDiscount()`, y en el modal de terminar (`toggleDiscount()`, `applyDiscount()`).

---

### DES-02 · Editar descuento
**Permiso:** `pedidos · descontar` + `autorizar` (peligroso)

**Criterios de aceptación**
1. [igual] No negativo y no mayor al total.
2. [igual] Bitácora: "Descuento modificado: $A » $B - Motivo: …".
3. [cambia] Solo lo ve quien puede hacerlo (P7).

**En alpha hoy:** `editDiscount()` (solo rol 1; el botón se muestra a todos).

---

### DES-03 · Quitar descuento
**Criterios de aceptación**
1. [igual] Si no tiene descuento, avisa.
2. [cambia] Si quitarlo deja el pedido cobrado de más (no aplica) o cambia su estado, el servidor lo recalcula.
3. [igual] Bitácora: "Descuento eliminado: $X".

**En alpha hoy:** `deleteDiscount()`.

---

### DES-04 · Ver descuentos en el corte
**Criterios de aceptación**
1. [igual] El corte muestra el total de descuentos del día y cuántas cuentas llevaron descuento.
2. [nuevo] Desglose por motivo.

---

### DES-05 · Descuento por partida
**[nuevo] / opcional.** `pos_order_discount` ya contempla descuento por partida (`order_package_id`), cupón y autorizador, pero está vacía. Decidir si entra en la primera versión (D-06).

---

## 10. Estados de pago (EPA)

> **Recomendación:** los estados **Cotización, Pendiente, Pagado, Cancelado** son parte de la lógica (el sistema decide cuál aplica con los pagos). Dejar que un usuario cree o elimine estados rompe esa lógica. Lo que sí tiene sentido es que cada empresa cambie **nombre visible, color y orden**.

### EPA-01 · Ver el catálogo de estados de pago
**Permiso:** `configuracion · ver`

**Criterios de aceptación**
1. [igual] Lista: Cotización, Pendiente, Pagado, Cancelado, con color de fondo y de texto.
2. [nuevo] Cada estado muestra qué significa y cuándo lo pone el sistema.

---

### EPA-02 · Personalizar nombre y color de un estado
**Permiso:** `configuracion · editar`

**Criterios de aceptación**
1. [nuevo] Se edita nombre visible, color de fondo, color de texto y orden. El código interno (`quote`, `pending`, `paid`, `cancelled`) no cambia.
2. [nuevo] El cambio se refleja en lista, calendario, tickets y avisos.

---

### EPA-03 · Crear, cancelar o eliminar estados
**Recomendación:** **no** en la primera versión. Si una empresa necesita un sub-estado (p. ej. "Apartado"), modelarlo como **etiqueta** del pedido, no como estado de pago. → **D-07.**

---

### EPA-04 · Transiciones automáticas
**Criterios de aceptación**
1. [igual] Pedido nuevo sin cobro → Cotización o Pendiente, según elija el cajero al terminar.
2. [igual] Pagos > 0 y < neto → Pendiente.
3. [igual] Pagos ≥ neto → Pagado.
4. [igual] Anular un pago de un Pagado que deja saldo → Pendiente.
5. [cambia] Cancelado solo por la acción Cancelar (PED-10), con motivo.
6. [nuevo] Cada cambio de estado queda en la bitácora con el estado anterior y el nuevo.

---

### EPA-05 · Qué se puede hacer en cada estado

| Acción | Cotización | Pendiente | Pagado | Cancelado |
|---|---|---|---|---|
| Ver / Imprimir | ✔ | ✔ | ✔ | ✔ (Ver) |
| Editar | ✔ | ✔ | Con autorización (PED-07) | ✘ |
| Cobrar | ✔ | ✔ | ✘ (no hay saldo) | ✘ |
| Descuento | ✔ | ✔ | ✘ | ✘ |
| Cancelar | ✔ | ✔ **[cambia]** (hoy no) | Decisión D-02 | ✘ |
| Eliminar | Sin pagos | Sin pagos | ✘ | Sin pagos |
| Marcar entrega | No aplica | ✔ | ✔ | ✘ |

**En alpha hoy:** `dropdownOrder()` y `renderDeliveryStatus()`.

---

## 11. Estados de producción y entrega (EEN)

> En alpha conviven dos campos que se pisan: `is_delivered` (No entregado / Entregado / **Para producir**) y la palomita de producción (`produced_at`). "Para producir" y "Por producir" parecen lo mismo y no lo son (K4); elegir "Para producir" dice que quedó "no entregado" (K1) y deja el pedido sin botones en el calendario (K2).
> **Propuesta:** un solo flujo de producción y entrega:
> **Por producir → En producción → Listo (producido) → Entregado**, más el tipo de entrega (Local / A domicilio) como dato aparte.

### EEN-01 · Ver el estado de producción y entrega
**Permiso:** `pedidos · ver`

**Criterios de aceptación**
1. [cambia] Un solo badge con el paso actual y su color.
2. [igual] Para una cotización dice "No aplica".
3. [igual] En el calendario, un pedido listo lleva marca y la fecha/hora en que se marcó.

---

### EEN-02 · Marcar "ya lo elaboré" (producción)
**Como** personal de producción **quiero** palomear los pedidos que ya elaboré **para** que la tienda sepa qué está listo.
**Permiso:** `produccion · producir` (tipo nuevo)

**Criterios de aceptación**
1. [igual] Solo el rol con ese permiso; solo pedidos de su empresa; nunca cotizaciones.
2. [igual] Guarda quién y cuándo; quitar la palomita borra ambos.
3. [cambia] Queda en la bitácora del pedido (K7).

**En alpha hoy:** `ctrl-calendario.php::statusProduction()` (solo rol 8).

---

### EEN-03 · Pasar un pedido a "En producción"
**Criterios de aceptación**
1. [nuevo] Producción o tienda lo marcan al empezar a elaborarlo.
2. [nuevo] Bitácora con usuario y hora.

---

### EEN-04 · Marcar como entregado
**Como** cajero **quiero** marcar el pedido como entregado **para** cerrar su ciclo.
**Permiso:** `pedidos · entregar` (tipo nuevo)

**Criterios de aceptación**
1. [igual] No se puede en cancelados.
2. [cambia] El aviso de entrega tiene botón para salir sin cambiar nada; el botón rojo no marca "No entregado" (L10).
3. [nuevo] Si el pedido tiene saldo, al entregar se avisa y se ofrece cobrar.
4. [igual] Bitácora: "Pedido marcado como entregado".
5. [cambia] Desde el calendario aplica la misma validación de sucursal que desde la lista (hoy el calendario no la revisa).

**En alpha hoy:** `ctrl-pedidos.php::updateDeliveryStatus()` y `ctrl-calendario.php::updateDeliveryStatus()` (dos versiones).

---

### EEN-05 · Regresar un paso (deshacer entrega o producción)
**Criterios de aceptación**
1. [nuevo] Con permiso y motivo.
2. [nuevo] Bitácora.

---

### EEN-06 · Tipo de entrega: local o a domicilio
**Criterios de aceptación**
1. [igual] Se elige al crear y se puede cambiar al editar entrega.
2. [cambia] Mismo nombre en todos lados: "Recoge en tienda" / "A domicilio" (K3).
3. [igual] Ícono en la lista (casa / moto) y en el calendario.

---

### EEN-07 · Configurar los pasos (nombre y color)
**Permiso:** `configuracion · editar`
Mismo criterio que EPA-02: se personalizan nombre y color; no se crean ni eliminan pasos (D-07).

---

## 12. Turnos (TUR)

### TUR-01 · Abrir turno
**Como** cajero **quiero** abrir mi turno con el fondo de caja **para** empezar a cobrar.
**Permiso:** `turnos · agregar` (alcance `sucursal` | `empresa`)

**Criterios de aceptación**
1. [igual] Campos: nombre del turno (p. ej. Matutino), fondo inicial en efectivo.
2. [igual] Solo un turno abierto por sucursal.
2b. [cambia] Si ya hay uno, el aviso dice de quién es y desde qué hora (hoy solo dice "Ya existe un turno abierto").
3. [igual] No se abre si el día de hoy ya fue cerrado en esa sucursal; dice quién lo cerró y que un administrador debe reabrirlo.
4. [cambia] Si lo que falta es cerrar el día de ayer, el mensaje dice eso, no "abre turno" (C4).
5. [cambia] Se abre desde un botón "Abrir turno" visible en Pedidos, no escondido en "Cierre del día" (L4, N7).
6. [igual] El turno queda a nombre del usuario que lo abre, con fecha y hora.

**En alpha hoy:** `openShift()`.

---

### TUR-02 · Ver el turno abierto y sus cifras en vivo
**Permiso:** `turnos · ver`

**Criterios de aceptación**
1. [igual] Muestra quién lo abrió, a qué hora, nombre y fondo inicial.
2. [igual] Cifras en vivo: ventas, cobrado por método, número de pedidos, cotizaciones, pendientes, cancelados, abonos de días anteriores.
3. [igual] La barra superior indica por sucursal si hay turno abierto.

**En alpha hoy:** `checkOpenShift()`, `getShiftMetrics()`, `getShiftsByDate()`.

---

### TUR-03 · Ver los turnos de una fecha
**Criterios de aceptación**
1. [igual] Lista de turnos del día por sucursal con estado (abierto / cerrado), horario, cajero y totales.
2. [cambia] Fecha y estado en formato legible (`04/10/2026`, "Abierto"), sin corchetes (C12).

---

### TUR-04 · Ver el detalle de un turno
**Criterios de aceptación**
1. [igual] Pedidos del turno con su cobro real.
2. [igual] **Abonos a pedidos de turnos anteriores** cobrados en este turno, con el folio de su sucursal de origen.
3. [igual] **Cobros cruzados**: pagos cobrados en otra sucursal a pedidos de esta.

**En alpha hoy:** `getShiftOrders()` → `getShiftDetailedOrders()`.

---

### TUR-05 · Cerrar turno
**Como** cajero **quiero** cerrar mi turno **para** entregar caja y que quede su corte.
**Permiso:** `turnos · cerrar` (tipo nuevo)

**Criterios de aceptación**
1. [igual] Solo un turno abierto se puede cerrar.
2. [igual] Al cerrar se congelan: ventas, efectivo, tarjeta, transferencia, número de pedidos; desglose por método y conteo por estado (cotización, pendiente, cancelado); los pedidos quedan ligados al turno.
3. [cambia] La pregunta dice "¿Cerrar el turno?" (no "¿Cerrar ticket de turno?") (C6).
4. [nuevo] Arqueo: el cajero captura el efectivo contado y el sistema muestra la diferencia contra el esperado (fondo + efectivo cobrado).
5. [cambia] Valida permiso y sucursal (hoy cualquiera cierra cualquier turno).
6. [igual] Sale el aviso de WhatsApp "Cierre de turno" (WA-08) sin bloquear el cierre si falla.

**En alpha hoy:** `closeShift()`, `notifyShiftClosed()`.

---

### TUR-06 · Imprimir ticket de cierre de turno
**Permiso:** `turnos · imprimir`

**Criterios de aceptación**
1. [igual] Sucursal, fecha, cajero, apertura y cierre, fondo inicial.
2. [igual] Venta del turno, cobrado de pedidos, abonos de días anteriores (cuántos y cuánto), total en caja.
3. [igual] Efectivo, tarjeta, transferencia.
4. [igual] Pedidos, pagados, pendientes, cotizaciones, cancelados.
5. [cambia] Muestra cuánto **efectivo debe haber en el cajón** (fondo + efectivo) (C7).
6. [cambia] "Pagados" cuenta bien con cancelados (C8).

**En alpha hoy:** `shift-ticket.js`, `app.js::ticketShiftClose()`.

---

### TUR-07 · Recalcular el corte de un turno
**Como** administrador **quiero** recalcular un turno después de corregir pagos **para** que su corte coincida con los pagos actuales.
**Permiso:** `turnos · recalcular` (tipo nuevo, peligroso)

**Criterios de aceptación**
1. [igual] Es idempotente: regenera ventas, efectivo, tarjeta, transferencia, pedidos y el desglose por método; no cambia estado ni fechas.
2. [igual] Cerrado: usa su ventana original. Abierto: hasta ahora.
3. [igual] Si el turno pertenece a un cierre del día, avisa que revisen también el cierre.
4. [nuevo] Bitácora del turno con cifras antes » después.

**En alpha hoy:** `ctrl-cierre.php::recalcShift()` (solo rol 1). (C13) desde Pedidos no hay botón.

---

### TUR-08 · Editar un turno abierto
**[nuevo] / propuesta.** Corregir nombre y fondo inicial mientras el turno esté abierto, con motivo y bitácora. No existe en alpha.

---

### TUR-09 · Cancelar o eliminar un turno
**Recomendación:** un turno con movimientos **nunca** se elimina. Solo se permite **anular** un turno abierto **sin** pedidos ni pagos (abierto por error), con motivo. No existe en alpha. → **D-08.**

---

## 13. Cierre del día / Corte Z (CIE)

### CIE-01 · Revisar si el día se puede cerrar
**Como** encargado **quiero** ver un checklist antes de cerrar el día **para** no cerrar con pendientes.
**Permiso:** `cierre · ver`

**Criterios de aceptación**
1. [igual] Exige seleccionar una sucursal específica.
2. [igual] Bloqueantes: que ya exista un cierre de esa fecha (dice quién lo cerró) y que haya turnos sin cerrar (lista con nombre, apertura y cajero).
3. [igual] Advertencias (no bloquean): pedidos sin turno asignado y pedidos con saldo pendiente (folio, total, pagado, pendiente).
4. [igual] Resumen: ventas, pedidos, turnos, efectivo, tarjeta, transferencia, descuentos.
5. [cambia] El efectivo, la tarjeta y la transferencia del resumen salen con montos reales (C1). *(Corregido en alpha el 26/10/2026.)*
6. [cambia] Las advertencias se ven completas antes de aceptar, no escondidas (C2), y cuentan bien (C3).

**En alpha hoy:** `showCierre()`.

---

### CIE-02 · Cerrar el día
**Permiso:** `cierre · cerrar` (tipo nuevo, peligroso, alcance `sucursal`)

**Criterios de aceptación**
1. [igual] Revalida en el servidor: no existe cierre previo y no hay turnos abiertos.
2. [igual] Guarda: ventas, número de pedidos, número de turnos, efectivo, tarjeta, transferencia, descuentos, quién cerró y cuándo.
3. [igual] Guarda el desglose por método y el conteo por estado; liga los pedidos del día al cierre.
4. [igual] El dinero del día es el **cobrado ese día en esa sucursal**; los abonos a pedidos de días anteriores y los cobros cruzados van aparte.
5. [cambia] El aviso explica qué pasa al cerrar (no "se cerrará el sistema") (C10).
6. [cambia] Después de cerrar, la lista deja de pedir que abra turno y dice que el día está cerrado (C9).
7. [cambia] Valida permiso (hoy cualquier rol puede cerrar el día).
8. [igual] Sale el aviso de WhatsApp "Cierre diario" (WA-09) sin bloquear el cierre si falla.

**En alpha hoy:** `addCierre()`, `notifyDailyClosed()`.

---

### CIE-03 · Ver días pendientes de cerrar
**Criterios de aceptación**
1. [igual] Lista los últimos 15 días con turnos pero sin cierre, con cuántos turnos y cuántos siguen abiertos.
2. [igual] Desde la alerta se va directo a ese día.

**En alpha hoy:** `getPendingDays()`, `app.js::renderPendingDaysAlert()`.

---

### CIE-04 · Ver un cierre ya hecho (resumen ejecutivo)
**Permiso:** `cierre · ver`

**Criterios de aceptación**
1. [igual] Resumen del día con los mismos bloques que el aviso: venta bruta, pendiente, pedidos del día, abonos de días anteriores, en caja, métodos con número de transacciones, cuentas pagadas / pendientes / cotizaciones / canceladas, ticket promedio, turnos.
2. [igual] Desglose de pedidos expandible.
3. [igual] Zoom del reporte e impresión a PDF.

**En alpha hoy:** `getCierre()`, `pedidos-cierre.js::renderExecutiveSummary()`.

---

### CIE-05 · Ver el Corte de caja
**Criterios de aceptación**
1. [igual] Cuentas: normales, canceladas, con descuento, cuenta promedio, folio inicial y final, total de ventas.
2. [igual] Caja: efectivo inicial (suma de fondos de los turnos), efectivo, tarjeta, transferencia, saldo final (= fondos + efectivo), total de descuentos.
3. [igual] Ventas por categoría y resumen por turno.
4. [igual] Tabla por pedido: folio, fecha, estado, descuento, importe (tachado si está cancelado), efectivo, tarjeta, transferencia.

**En alpha hoy:** `showCorteCaja()`, `lsCorteCaja()`.

---

### CIE-06 · Imprimir el cierre
**Permiso:** `cierre · imprimir`

**Criterios de aceptación**
1. [igual] Ticket de cierre del día y versión PDF del resumen ejecutivo.

**En alpha hoy:** `printDaily()`, `app.js::printDailyCloseTicket()`.

---

### CIE-07 · Reabrir un cierre
**Permiso:** `cierre · reabrir` (tipo nuevo, peligroso)

**Criterios de aceptación**
1. [igual] Motivo obligatorio.
2. [igual] No se reabre uno ya reabierto.
3. [igual] Guarda quién, cuándo y por qué; desliga los pedidos del cierre.
4. [nuevo] Al volver a cerrar se conserva el historial de cierres de esa fecha (versión 1, 2…), no se sobrescribe.

**En alpha hoy:** `statusCierre()` (solo rol 1).

---

### CIE-08 · Ver reportes como supervisor
**Criterios de aceptación**
1. [cambia] Un supervisor con permiso ve los cortes de sus sucursales; no le abre vacío (C11).

---

## 14. Catálogo (CAT)

### CAT-01 · Ver productos
**Permiso:** `catalogo · ver`

**Criterios de aceptación**
1. [igual] Tabla: foto + nombre, precio, estado, categoría, descripción.
2. [igual] Filtros: activos / inactivos y categoría.

**En alpha hoy:** `pedidos/ctrl-admin.php::listProductos()`.

---

### CAT-02 · Crear producto
**Permiso:** `catalogo · agregar`

**Criterios de aceptación**
1. [cambia] Nombre y precio obligatorios; precio ≥ 0 (A1).
2. [igual] Nombre único dentro de la sucursal (o de la empresa: D-09).
3. [igual] Una foto opcional.
4. [igual] Categoría y descripción.
5. [cambia] "Categoría" se llama igual en el formulario y en la pestaña (A2).

**En alpha hoy:** `addProduct()`.

---

### CAT-03 · Editar producto
**Criterios de aceptación**
1. [cambia] Valida nombre único también al editar (hoy está comentado).
2. [igual] Si se sube foto nueva reemplaza la anterior.
3. [cambia] Cambiar el precio no altera pedidos ya hechos (RT-05).

---

### CAT-04 · Activar / desactivar producto
**Criterios de aceptación**
1. [igual] Un inactivo no aparece en el armado del pedido.
2. [igual] Se puede reactivar.

---

### CAT-05 · Ver, crear y editar categorías
**Criterios de aceptación**
1. [igual] Campos: nombre y descripción; por sucursal.
2. [igual] Activar / desactivar.
3. [nuevo] Orden de las pestañas en el armado.

**En alpha hoy:** `listCategory()`, `addCategory()`, `editCategory()`, `statusCategory()`.

---

### CAT-06 · Ver modificadores
**Criterios de aceptación**
1. [igual] Tabla: nombre, si es extra (selección múltiple), primeras 5 opciones como etiquetas y "+N más", estado.

**En alpha hoy:** `listModifier()`.

---

### CAT-07 · Crear y editar modificador
**Criterios de aceptación**
1. [igual] Nombre único.
2. [igual] Marca "extra": selección múltiple con cantidad y **no** se multiplica por porciones.
3. [nuevo] Orden del paso dentro del armado del pastel.

---

### CAT-08 · Agregar, editar y quitar opciones de un modificador
**Criterios de aceptación**
1. [igual] Opción con nombre y precio; nombre único dentro del modificador.
2. [igual] Precio editable en línea, número ≥ 0.
3. [igual] Quitar = desactivar.

**En alpha hoy:** `addProductModifier()`, `updateProductModifierPrice()`, `deleteProductModifier()`.

---

### CAT-09 · Activar / desactivar modificador
**Criterios de aceptación**
1. [igual] Un modificador inactivo no aparece como paso del armado.

---

### CAT-10 · Ver clientes
**Criterios de aceptación**
1. [igual] Tabla: nombre, correo, teléfono, fecha de registro.
2. [nuevo] Desde el cliente se ven sus pedidos, total comprado y saldo pendiente.

---

### CAT-11 · Crear y editar cliente
**Criterios de aceptación**
1. [igual] Teléfono de exactamente 10 dígitos (se limpian caracteres que no son números).
2. [cambia] El teléfono es único por empresa; es la llave para encontrar al cliente al crear un pedido (N4).
3. [nuevo] Cumpleaños en la ficha del cliente (hoy está en el pedido).

---

### CAT-12 · Desactivar y reactivar cliente
**Criterios de aceptación**
1. [cambia] El botón dice "Desactivar", no "Eliminar", y existe "Reactivar" (A3).

---

### CAT-13 · Motivos de descuento
**Permiso:** `catalogo · editar`

**Criterios de aceptación**
1. [nuevo] CRUD de motivos con nombre, código, tope de porcentaje y si requiere autorización.
2. [nuevo] Arranca sembrado con los 5 de `pos_discount_reason`.

---

### CAT-14 · Catálogo por empresa o por sucursal
**Decisión D-09.** Hoy productos, categorías y clientes son **por sucursal** (`subsidiaries_id`), pero los modificadores son **globales**. En multiempresa conviene: catálogo por empresa con disponibilidad y precio por sucursal.

---

## 15. Reportes, visor y dashboard (REP)

### REP-01 · Reportes de pedidos
**Permiso:** `reportes · ver` (alcance `sucursal` | `empresa`)

**Criterios de aceptación**
1. [igual] Tipos: tickets por periodo, turnos, tickets del día, corte, turnos con sus tickets, detalle de un turno, detalle de pedidos.
2. [igual] Exportar a PDF con estilos de impresión.
3. [cambia] Lo ve cualquier rol con el permiso, no solo el administrador (C11).

**En alpha hoy:** `pedidos-reportes/ctrl-reportes.php` (todos los métodos exigen rol 1).

---

### REP-02 · Visor de turnos, cierres y tickets
**Criterios de aceptación**
1. [igual] Filtro por periodo y sucursal; tipo de reporte (turnos, cierres, tickets).
2. [igual] Lista agrupada por fecha a la izquierda y vista previa a la derecha con divisor ajustable.
3. [igual] Desde un cierre se abre el ticket de un pedido y se regresa.
4. [igual] Desde un ticket: historial de pagos, cambio de método (PAG-03) y bitácora.
5. [igual] Imprimir lo que se está viendo.

**En alpha hoy:** `order-visor/`.

---

### REP-03 · Dashboard de ventas
**Criterios de aceptación**
1. [igual] Mes y año; tarjetas de totales; comparativo de ingresos diarios; ventas por día de la semana.
2. [nuevo] Comparativo contra el mismo periodo anterior y por sucursal.

**En alpha hoy:** `dashboard-pedidos.js` → `apiDashboard()`. (`getDashboardMetrics`, `reportVentas`, `reportProductos`, `reportClientes` existen pero nadie los llama.)

---

### REP-04 · Reportes que faltan
**[nuevo]** Ventas por producto y categoría, clientes frecuentes, pedidos por estado de producción, cobros cruzados entre sucursales, descuentos por motivo y por usuario.

---

## 16. Avisos por WhatsApp (WA)

### WA-01 · Configurar el proveedor
**Permiso:** `avisos · editar`

**Criterios de aceptación**
1. [igual] Proveedores: Green API y UltraMsg; uno activo por empresa.
2. [igual] Validaciones: instancia y token obligatorios; Green API: instancia solo números y URL completa (`https://xxxx.api.greenapi.com`); UltraMsg: instancia con letras, números, guion o guion bajo; token sin espacios.
3. [igual] El token nunca se escribe en logs.

**En alpha hoy:** `ctrl-wa-config.php::saveWaProvider()`, `credentialError()`.

---

### WA-02 · Probar la conexión
**Criterios de aceptación**
1. [igual] Consulta el estado de la instancia en el proveedor y lo muestra.

**En alpha hoy:** `testWaConnection()`.

---

### WA-03 · Administrar destinatarios
**Criterios de aceptación**
1. [igual] Nombre o etiqueta, teléfono a 10 dígitos (se quita lada 52/521) o id de grupo `…@g.us`, y qué avisos recibe: todos, cierres (día + turno), pedidos (nuevo + editado) o uno en particular.
2. [igual] Activar / desactivar y eliminar.
3. [nuevo] Destinatarios por sucursal (hoy son por empresa).

**En alpha hoy:** `addWaDestinatario()`, `editWaDestinatario()`, `statusWaDestinatario()`, `delWaDestinatario()`.

---

### WA-04 · Editar plantillas
**Criterios de aceptación**
1. [igual] Una plantilla por aviso (cierre, turno, pedido, pedido editado) con variables entre llaves; hay plantilla por defecto.
2. [igual] Variables disponibles listadas junto al editor (ver apéndice A-6).
3. [igual] Se puede activar o desactivar cada aviso.

**En alpha hoy:** `saveWaPlantilla()`, `defaultTemplates()`.

---

### WA-05 · Ver historial de envíos y enviar prueba
**Criterios de aceptación**
1. [igual] Historial por fecha: aviso, origen (sucursal y referencia), proveedor, estado y error.
2. [igual] Mensaje de prueba a un número.

**En alpha hoy:** `lsWaHistorial()`, `sendWaTest()`.

---

### WA-06 · Aviso de pedido nuevo
**Criterios de aceptación**
1. [igual] Sale al terminar el pedido (POS-07), con folio, sucursal, fecha larga, hora, tipo de entrega, cliente, teléfono, productos, descripción, total, anticipo con forma de pago, resta y estatus.
2. [igual] Incluye fotos de los personalizados y del catálogo.
3. [igual] El envío no frena al cajero (se hace en segundo plano).
4. [igual] Si el pedido no lleva productos, no se envía.

**En alpha hoy:** `ctrl-pedidos-catalogo.php::addOrderNotice()` (tipo interno `personalizado`, aunque aplica a todos los pedidos).

---

### WA-07 · Aviso de pedido editado
**Criterios de aceptación**
1. [igual] Si el pedido ya avisó y algo cambió desde el último aviso, sale "Cambio en pedido" con la lista de cambios (antes tachado, ahora en negritas) y cómo queda.
2. [igual] Si nada cambió, no se envía.
3. [cambia] Usar un nombre interno que diga lo que es (`pedido` / `pedido_editado`).

---

### WA-08 · Aviso de cierre de turno
**Criterios de aceptación**
1. [igual] Con las cifras del ticket de turno (TUR-06). Montos y cantidades en cero salen como "-".

---

### WA-09 · Aviso de cierre del día
**Criterios de aceptación**
1. [igual] Con el resumen del Corte Z (CIE-04).

---

## 17. Administración (ADM)

### ADM-01 · Editar datos de la empresa y logo
**Criterios de aceptación**
1. [igual] Nombre, datos generales; subir y quitar logo.
2. [igual] El logo sale en tickets y reportes.

**En alpha hoy:** `admin/ctrl-admin.php::editCompany()`, `editPhotoCompany()`, `deletePhotoCompany()`.

---

### ADM-02 · Administrar sucursales
**Criterios de aceptación**
1. [igual] Crear y editar con nombre único dentro de la empresa; activar / desactivar.
2. [nuevo] Zona horaria, dirección, teléfono y logo por sucursal (`fayxzvov_erp.branches` / `subsidiaries`).
3. [nuevo] Prefijo de folio por sucursal (RT-16).

**En alpha hoy:** `lsSucursales()`, `addSucursal()`, `editSucursal()`, `toggleStatusSucursal()`.

---

### ADM-03 · Administrar usuarios
**Criterios de aceptación**
1. [igual] Usuario = correo válido, en minúsculas, único en todo el sistema.
2. [igual] Al menos una sucursal; la primera es con la que arranca la sesión.
3. [igual] Segunda clave opcional: mínimo 4 caracteres, distinta de la contraseña, guardada con bcrypt. Sirve para entrar y para autorizar.
4. [cambia] Rol **por sucursal** (`users_braches`), no uno global.
5. [igual] Activar / desactivar.
6. [cambia] Contraseña principal con bcrypt (RT-09).
7. [nuevo] Invitación por correo y recuperación de contraseña (`fayxzvov_erp.users` ya trae `setup_token` y `reset_code`).

**En alpha hoy:** `lsUsers()`, `addUser()`, `editUser()`, `toggleStatusUser()`.

---

### ADM-04 · Roles y permisos
**Criterios de aceptación**
1. [igual] Pantalla por rol con los permisos agrupados por familia, marcando los peligrosos.
2. [igual] El rol Administrador siempre conserva todos los permisos.
3. [igual] Permisos con alcance (`sucursal` / `empresa`).
4. [cambia] **El sistema los aplica de verdad** en servidor y en pantalla (RT-02, RT-15).
5. [nuevo] Roles por empresa (`roles.company_id`), con plantillas base: Dueño, Administrador, Cajero, Vendedor, Supervisor, Producción, Consulta.

**En alpha hoy:** `ctrl-permisos.php` (pantalla y BD hechas; el código no las consulta). Ver `admin/docs/modulo-permisos.md`.

---

### ADM-05 · Mi perfil
**Criterios de aceptación**
1. [igual] Editar mi nombre y foto; quitar foto.
2. [igual] Nombre de usuario único.
3. [nuevo] Cambiar mi contraseña y mi segunda clave.

**En alpha hoy:** `ctrl-perfil.php`.

---

### ADM-06 · Empresas (superadmin)
**Criterios de aceptación**
1. [igual] Listar, crear, editar y eliminar empresas.
2. [nuevo] Plan y suscripción de la empresa (`plans`, `subscriptions`), estado pendiente / activa / suspendida / cancelada.
3. [igual] Si la empresa no está activa, el administrador entra a la pantalla de empresas en vez del menú.

**En alpha hoy:** `ctrl-empresa.php`; redirección en `ctrl-access.php::getUser()`.

---

### ADM-07 · Cláusulas (recomendaciones del ticket)
**Criterios de aceptación**
1. [igual] Crear y editar con nombre único; activar / desactivar.
2. [igual] Las activas salen en el ticket del pedido (PED-09) y en el contrato de eventos (EVT-07).

**En alpha hoy:** `lsClausulas()`, `addClausula()`, `editClausula()`, `toggleStatusClausula()`.

---

## 18. Acceso y sesión (ACC)

### ACC-01 · Iniciar sesión
**Criterios de aceptación**
1. [igual] Usuario (correo) y contraseña, o la segunda clave.
2. [igual] Mensaje genérico si falla ("Usuario y/o contraseña incorrecta").
3. [igual] La pantalla recuerda al último usuario (nombre, foto, color del rol).
4. [nuevo] Bloqueo temporal tras intentos fallidos (`users.reset_tries` ya existe en el esquema nuevo).

**En alpha hoy:** `ctrl-access.php::getUser()`, `validKey()`.

---

### ACC-02 · Menú según permisos
**Criterios de aceptación**
1. [igual] El menú lateral y el lanzador muestran solo los módulos permitidos.
2. [igual] Producción entra directo al calendario de pedidos.
3. [cambia] Sale de la matriz de permisos (`sections` / `modules`), no de reglas por rol.

**En alpha hoy:** `sidebar()`, `company()`, `routesByRol()`.

---

### ACC-03 · Expiración de sesión
**Criterios de aceptación**
1. [igual] La sesión expira por inactividad y se renueva con actividad.
2. [cambia] El aviso del tiempo restante no asusta al entrar por primera vez y dice cuánto falta (L12).
3. [igual] Las respuestas sin sesión regresan 401 con mensaje claro, nunca HTML roto.

**En alpha hoy:** `checkSession()`, `updateSession()`.

---

### ACC-04 · Cerrar sesión
**Criterios de aceptación**
1. [igual] Destruye la sesión y regresa al login.

---

## 19. Eventos / banquetes (EVT)

> En uso (48 eventos, 109 pagos). Comparte conceptos con Pedidos (estados de pago, pagos, descuentos, bitácora) pero vive aparte. En el nuevo conviene reutilizar los mismos componentes de pago, descuento y bitácora.

### EVT-01 · Ver eventos
**Criterios de aceptación**
1. [igual] Tabla: folio, creación, evento y cliente, abonado, total (con descuento tachado), saldo, fecha del evento, ubicación, horario, estado.
2. [igual] Filtros por rango de fechas y estado.
3. [igual] Acciones por estado: en Cancelado solo Ver e Historial; en Pagado Ver, Historial e Imprimir; en los demás Ver, Editar, Cancelar, Pagar, Historial, Imprimir y Descuento.

**En alpha hoy:** `ctrl-eventos.php::lsVentas()`, `dropdownEvent()`.

---

### EVT-02 · Crear evento
**Criterios de aceptación**
1. [igual] Nombre del evento, fechas y horas de inicio y fin (válidas), ubicación, cliente, teléfono, correo, tipo de evento, número de personas, notas.
2. [igual] Nace como Cotización.
3. [igual] Bitácora "Evento creado".
4. [igual] Después de crear sigue el armado del menú.

**En alpha hoy:** `addEvent()`.

---

### EVT-03 · Armar el menú del evento
**Criterios de aceptación**
1. [igual] Elegir paquetes precargados (menús), productos y clasificaciones; cantidades por paquete; extras.
2. [igual] El total del evento se recalcula.

**En alpha hoy:** `getPackages()`, `getProducts()`, `getEventMenus()`, `addEventMenus()`, `editEventMenus()`; `ctrl-sub-eventos.php::addPackage()`, `updatePackageQuantity()`, `addExtra()`.

---

### EVT-04 · Subeventos
**Criterios de aceptación**
1. [igual] Un evento puede tener subeventos, cada uno con su menú y platillos.
2. [igual] El total del evento suma sus subeventos.

**En alpha hoy:** `ctrl-sub-eventos.php::listSubEvents()`, `addSubEvent()`, `editSubEvent()`, `deleteSubEvent()`, `lsDishes()`, `addDish()`.

---

### EVT-05 · Pagos y anticipos del evento
**Criterios de aceptación**
1. [igual] Registrar anticipo con método; bitácora "Se dio un anticipo de $X en método".
2. [cambia] Mismas reglas que PAG-02 (estado calculado en servidor, idempotencia, turno si aplica). → **D-10:** ¿los cobros de eventos entran al turno y al corte de la sucursal?

**En alpha hoy:** `ctrl-payment.php::addPayment()`, `listPagos()`.

---

### EVT-06 · Descuento del evento
**Criterios de aceptación**
1. [igual] Aplicar, ver y quitar descuento.
2. [cambia] Mismas reglas que DES-01.

**En alpha hoy:** `applyDiscount()`, `getDiscount()`, `removeDiscount()`.

---

### EVT-07 · Imprimir contrato / documento del evento
**Criterios de aceptación**
1. [igual] Documento con datos del evento, menú, totales, pagos y cláusulas.

**En alpha hoy:** `payment.js::onShowDocument()`, `getFormatedEvent()`.

---

### EVT-08 · Cancelar evento
**Criterios de aceptación**
1. [cambia] Motivo obligatorio y bitácora (hoy `cancelEvent()` escribe lo que llegue).

---

### EVT-09 · Calendario de eventos
**Criterios de aceptación**
1. [igual] Eventos por fecha.

**En alpha hoy:** `getCalendario()`, `eventos/src/js/calendario.js`.

---

### EVT-10 · Catálogo de eventos (paquetes, productos, clasificaciones)
**Criterios de aceptación**
1. [igual] CRUD y activar / desactivar paquetes, productos y clasificaciones.

**En alpha hoy:** `admin/ctrl-paquetes.php`.

---

## 20. Reservaciones (RES)

> **0 registros en la BD.** Existe el CRUD (crear, editar, cancelar, bitácora) con 4 estados de reservación. → **D-11:** decidir si se reconstruye o se deja fuera.

### RES-01 · Ver, crear, editar y cancelar reservaciones
**Criterios de aceptación**
1. [igual] Evento, fechas de inicio y fin, cliente, teléfono, correo, tipo, personas, ubicación, notas, anticipo y método, descuento.
2. [igual] Bitácora y comentarios.

**En alpha hoy:** `reservaciones/ctrl-reservaciones.php`.

---

## 21. Fuera de alcance / código muerto

| Qué | Por qué no se migra |
|---|---|
| `pedidos/ctrl/ctrl-projects.php` + `mdl-projects.php` | Nadie lo llama y la tabla `projects` no existe |
| `alpha/calendario/` | Stub de 17 líneas |
| `getDashboardMetrics`, `reportVentas`, `reportProductos`, `reportClientes` en `ctrl-pedidos.php` | Ningún JS los usa |
| Tablas `pos_order_payment`, `pos_payment_type`, `pos_order_discount`, `customers` | Vacías (inicio de un POS que no se terminó) |
| Columnas `order.is_delivery`, `delivery_tipe`, `location`, `order_type`, `is_pos`, `tip_amount` | Restos de versiones anteriores; revisar antes de migrar datos |
| `app/pedidos-old/` | Versión anterior del módulo |
| `eventos/ctrl/ctrl-app.php`, `mdl-pedidos-catalogo.php`, `reservaciones.js` | Archivos vacíos |

---

## 22. Decisiones pendientes

| ID | Pregunta | Contexto |
|---|---|---|
| **D-01** | ¿Quién edita un pedido pagado y qué puede cambiar? | Hoy: cajero edita todo menos la fecha; supervisor cambia la fecha y nada más (N12, P12) |
| **D-02** | ¿Se puede cancelar un pedido con pagos? ¿Qué pasa con el dinero: devolución registrada en turno o saldo a favor del cliente? | Hoy un Pendiente con abonos no se puede cancelar ni eliminar (L15) |
| **D-03** | ¿Existe "reactivar" un pedido cancelado? | (P1) |
| **D-04** | ¿Un pedido liquidado que se edita debe avisar por WhatsApp? | Hoy no pasa por "Terminar" y no avisa |
| **D-05** | ¿Se puede anular un pago de un turno ya cerrado? Si sí, ¿recalcula el turno y el cierre automáticamente? | (P13) |
| **D-06** | ¿Descuento por partida y cupones en la primera versión? | `pos_order_discount` está diseñada y vacía |
| **D-07** | ¿Los estados (pago y producción) son fijos con nombre y color configurables, o se permite crear nuevos? | Recomendación: fijos + etiquetas libres |
| **D-08** | ¿Se permite anular un turno abierto por error sin movimientos? | No existe en alpha |
| **D-09** | ¿Catálogo y clientes por empresa o por sucursal? | Hoy productos, categorías y clientes por sucursal; modificadores globales |
| **D-10** | ¿Los cobros de eventos entran al turno y al cierre del día? | Hoy van por fuera |
| **D-11** | ¿Se reconstruye Reservaciones? | 0 registros |
| **D-12** | ¿Folio consecutivo por sucursal desde 1 o se conserva el número de alpha al migrar? | RT-16 |

---

## 23. Apéndice: fórmulas y validaciones

### A-1 · Dinero del pedido
```
Total     = Σ (precio de la partida × cantidad)        ← precio congelado en la partida (RT-05)
Neto      = Total − Descuento
Pagado    = Σ pagos vigentes (no anulados)
Saldo     = Neto − Pagado
Estado    = sin pagos      → Cotización | Pendiente (lo elige el cajero)
            0 < Pagado < Neto − 0.005 → Pendiente
            Pagado ≥ Neto − 0.005     → Pagado
```

### A-2 · Precio sugerido del pastel personalizado
```
Sugerido = (Σ precio de opciones de modificadores normales) × porciones
         + Σ (precio de opción extra × cantidad)
Precio de la partida = precio real capturado, o el sugerido si se acepta
```

### A-3 · Turno
```
Cobrado del turno   = pagos cobrados dentro de la ventana del turno en su sucursal
Abonos anteriores   = parte de lo cobrado que corresponde a pedidos de turnos/días anteriores
Total en caja       = efectivo + tarjeta + transferencia
Efectivo esperado   = fondo inicial + efectivo cobrado                       (nuevo, C7)
Diferencia arqueo   = efectivo contado − efectivo esperado                   (nuevo)
Pagados             = pedidos − cotizaciones − pendientes (sin contar cancelados) (C8)
```

### A-4 · Cierre del día
```
Dinero del día      = pagos con fecha de pago = día  y  sucursal de cobro = sucursal
                      (sucursal de cobro = la del pago, o la del pedido si el pago no trae)
Pedidos del día     = pedidos creados ese día en la sucursal (sin cancelados para ventas)
Efectivo inicial    = Σ fondos iniciales de los turnos del día
Saldo final (caja)  = Efectivo inicial + Efectivo
Cuenta promedio     = Total de ventas ÷ cuentas
Días pendientes     = últimos 15 días con turnos y sin cierre
```

### A-5 · Validaciones de captura
| Campo | Regla |
|---|---|
| Teléfono de cliente | 10 dígitos exactos; se quitan caracteres que no son número |
| Teléfono de WhatsApp | 10 dígitos (se quita 52 / 521) o grupo `…@g.us` |
| Correo de usuario | Formato de correo, minúsculas, único global |
| Segunda clave | ≥ 4 caracteres, distinta de la contraseña |
| Motivo (eliminar pedido, quitar partida bloqueada) | ≥ 5 caracteres |
| Motivo (anular pago, reabrir cierre) | Obligatorio |
| Cantidad de partida | > 0 |
| Precio de producto / opción | Número ≥ 0 |
| Descuento | ≥ 0, ≤ total, ≤ tope del motivo, neto ≥ pagado |
| Pago | > 0, ≤ saldo, método obligatorio |
| Fecha de entrega | ≥ hoy (salvo que no se mueva una fecha ya pasada) |
| Fotos | jpg, jpeg, png, webp, gif |
| Doble envío | Mismo pago (pedido + importe + método) en < 10 s se rechaza en alpha; en el nuevo, llave de idempotencia |
| Partida repetida | Mismo nombre y precio capturado otra vez en ≤ 10 min |

### A-6 · Variables de las plantillas de WhatsApp
| Aviso | Variables |
|---|---|
| Pedido / Pedido editado | `{folio}` `{sucursal}` `{fecha_larga}` `{hora}` `{entrega}` `{cliente}` `{telefono}` `{productos}` `{descripcion}` `{total}` `{anticipo}` `{forma_pago}` `{restante}` `{estatus}` · solo editado: `{cambios}` |
| Cierre de turno | `{sucursal}` `{fecha}` `{cajero}` `{apertura}` `{cierre}` `{fondo_inicial}` `{ventas}` `{cobrado_turno}` `{abonos_ant}` `{abonos_n}` `{total_caja}` `{efectivo}` `{tarjeta}` `{transferencia}` `{pedidos}` `{pagados}` `{pendientes}` `{cotizaciones}` `{cancelados}` |
| Cierre del día | `{sucursal}` `{fecha}` `{cajero}` `{venta_bruta}` `{pendiente}` `{pedidos_dia}` `{abonos_ant}` `{en_caja}` `{efectivo}` `{efectivo_n}` `{tarjeta}` `{tarjeta_n}` `{transferencia}` `{transferencia_n}` `{pagadas}` `{pendientes}` `{cotizaciones}` `{canceladas}` `{ticket_promedio}` `{turnos}` · también `{fondo_inicial}` `{cuentas}` `{con_descuento}` `{ventas}` `{descuentos}` `{pedidos}` |

### A-7 · Permisos de alpha → permisos del sistema nuevo
| Alpha (`usr_permissions.code`) | Nuevo (sección · tipo) |
|---|---|
| `view_order` (con alcance) | `pedidos · ver` |
| `create_order` (con alcance) | `pedidos · agregar` |
| `edit_order` (con alcance) | `pedidos · editar` |
| `edit_paid_order` | `pedidos · autorizar` |
| `delete_blocked_line` | `pedidos · autorizar` |
| `delete_order` | `pedidos · eliminar` |
| `register_payment` (con alcance) | `pagos · cobrar` |
| `edit_payment_method` | `pagos · editar` |
| `delete_payment` | `pagos · cancelar` |
| `edit_discount` / `delete_discount` | `pedidos · descontar` (+ `autorizar` según motivo) |
| `edit_delivery` | `pedidos · editar` (o `entregas · editar`) |
| `manage_shift` (con alcance) | `turnos · agregar` / `ver` / `cerrar` |
| `view_pending_cierre` | `cierre · ver` |
| `close_day` (con alcance) | `cierre · cerrar` / `reabrir` |
| `recalc_shift` | `turnos · recalcular` |
| `switch_subsidiary` | alcance `empresa` de `sucursales · ver` |
| *(sin código)* palomear producción | `produccion · producir` |
| *(sin código)* marcar entregado | `pedidos · entregar` |
