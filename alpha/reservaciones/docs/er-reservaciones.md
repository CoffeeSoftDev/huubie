# ER de Reservaciones — formato Coffee Intelligence

> Entregable de modelado sobre `fayxzvov_reginas`, esquema del módulo `alpha/reservaciones`.
> Fuente de verdad de las convenciones: `~/.claude/agents/grimorios/db-rules.md`.
> **Esto documenta el esquema que YA existe**, no propone uno nuevo: las cajas son fieles
> a la BD viva (inspección directa vía `information_schema` + `SHOW CREATE TABLE`) y las
> flechas `←` marcan cada punto donde el esquema se separa de la regla.
>
> **Documentos hermanos:**
> [er-pedidos.md](../../pedidos/docs/er-pedidos.md) cubre el resto de `fayxzvov_reginas`
> — de ahí salen prestados `status_process` y `method_pay`.
> [er-usuarios-sucursales.md](../../pedidos/docs/er-usuarios-sucursales.md) cubre la capa de
> identidad y multi-tenencia (`fayxzvov_alpha.subsidiaries`, `fayxzvov_alpha.usr_users`) que
> este esquema referencia cross-schema pero no define. **No se redocumenta aquí.**

---

## 0. Contexto del dominio

| | |
|---|---|
| Dominio | Reservación de mesa / evento en restaurante |
| Evento raíz | La **reservación** (`reservation`) |
| Esquema documentado | `fayxzvov_reginas` · InnoDB · esquema en `utf8mb4_0900_ai_ci`, **tablas en `latin1_swedish_ci`** |
| Esquema que el código consume | `fayxzvov_coffee` — el modelo trae `$bd` hardcodeado a otro esquema (§6.1) |
| Maestros corporativos | `fayxzvov_alpha.subsidiaries` · `fayxzvov_alpha.usr_users` (cross-schema, no se duplican) |
| Alcance | 3 tablas propias + 4 catálogos prestados de Pedidos y Eventos |
| Volumen real | `reservation` **0 filas** · `reservation_histories` **0 filas** · `reservation_status` **4 filas** |
| Inspección | MySQL 8.0.31 local (WAMP), sólo lectura, 2026-08-22 |

**El punto no obvio, y hay que decirlo con todas sus letras:** el dominio operativo de
Reservaciones en `fayxzvov_reginas` **no tiene un solo registro**. `reservation` y
`reservation_histories` están en cero. La única tabla con contenido es el catálogo
`reservation_status`, con sus 4 estados sembrados. Aquí no hay volumen que analizar,
cardinalidades reales que medir ni distribución de estados que reportar: **hay estructura
sin historia**.

Y no es una tabla recién nacida esperando su primer alta. `reservation_histories` tiene
`AUTO_INCREMENT = 18` con 0 filas — el contador llegó a 17 y las filas ya no están. La
tabla **se vació**, no nació vacía. Las tres se crearon el mismo instante
(`CREATE_TIME = 2026-08-04 22:14:12`), lo que apunta a una restauración de estructura
sobre el esquema, no a un desarrollo incremental.

Dónde sí hay datos: en `fayxzvov_coffee`, que es a dónde apunta el modelo PHP — 8
reservaciones y 4 comentarios de bitácora, todos de agosto–septiembre 2025. Ver §6.1.

---

## 1. Clasificación de tablas (db-rules §1.4)

| Clase | Tablas |
|---|---|
| **Catálogo propio** | `reservation_status` |
| **Catálogo prestado** | `status_process` · `method_pay` (de Pedidos) · `evt_category` (de Eventos) |
| **Transacción raíz** | `reservation` |
| **Bitácora** | `reservation_histories` |
| **Ni catálogo ni detalle** | `evt_menu` — es un **renglón de `evt_events`**, y `reservation` lo referencia como si fuera un catálogo (§4.1) |

Ningún pivote puro N:M. Ningún `detail_*`: la reservación no tiene renglones — el monto
vive en una sola columna (`total_pay`) de la cabecera. Es el dominio más plano del
esquema: **una tabla raíz, un catálogo propio y una bitácora.**

---

## 2. Diagrama de relaciones

Caja **doble** = la transacción raíz de este documento.
Caja **simple** = catálogo o bitácora. Bloque de arriba = cross-schema.

```
  fayxzvov_alpha  ·  MAESTROS CORPORATIVOS  (cross-schema, no se duplican)
      ┌────────────────────┐                      ┌────────────────────┐
      │ subsidiaries       │                      │ usr_users          │
      │ la sucursal        │                      │ quién opera        │
      └────────────────────┘                      └────────────────────┘
                 │ 1                                         │ 1
  ┌──────────────┘                                           └───────────────┐
══╪══════════════════════════════════════════════════════════════════════════╪══
  │ N   fayxzvov_reginas  ·  DOMINIO                                       N │
  │   CATÁLOGOS   sólo reservation_status es propio del módulo               │
  │   ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐  │
  │   │ reservation_      │   │ status_process    │   │ evt_category      │  │
  │   │ status            │   │ de Pedidos        │   │ de Eventos        │  │
  │   │ 4 filas · PROPIO  │   │ 4 filas           │   │ 3 filas           │  │
  │   └───────────────────┘   └───────────────────┘   └───────────────────┘  │
  │             │ 1                     │ 1                     │ 1          │
  │             │ N                     │ N                     │ N          │
  │             ▼                       ▼                       ▼            │
  │   ╔══════════════════════════════════════════════════════════════════╗   │
  │   ║ r e s e r v a t i o n                     RAÍZ  ·  0 filas       ║   │
  └──►║ quién reserva, qué día, cuánto va a pagar                        ║   │
      ║                                                                  ║   │
      ║ FKs muertas:  evt_menu_id  ·  method_pay_id  (nunca se escriben) ║   │
      ╚══════════════════════════════════════════════════════════════════╝   │
                                        │ 1                                  │
                                        │ N                                  │
                                        ▼                                    │
                        ┌──────────────────────────────┐                     │
                        │ reservation_histories        │                     │
                        │ BITÁCORA  ·  0 filas         │◄────────────────────┘
                        │ comentarios del usuario      │
                        └──────────────────────────────┘
```

**Cardinalidades en una línea**

```
reservation_status              1 ──── N  reservation   (status_reservation_id)
status_process                  1 ──── N  reservation   (status_process_id)
evt_category                    1 ──── N  reservation   (category_id)
method_pay                      1 ──── N  reservation   (method_pay_id)
evt_menu                        1 ──── N  reservation   (evt_menu_id)
fayxzvov_alpha.subsidiaries     1 ──── N  reservation   (subsidiaries_id)
reservation                     1 ──── N  reservation_histories
fayxzvov_alpha.usr_users        1 ──── N  reservation_histories (usr_users_id)
```

**Dos estados para el mismo documento.** `reservation` cuelga de dos catálogos de estado
a la vez: `status_process` (el flujo comercial de Pedidos: Cotización → Pendiente →
Pagado → Cancelado) y `reservation_status` (el resultado de la reserva: Reservación →
Show / No Show / Cancelado). En los datos vivos de `fayxzvov_coffee`, `status_process_id`
vale **1 en las 8 filas** — se escribe al dar de alta y nadie lo mueve nunca. El estado
que sí se usa es `status_reservation_id`. Ver §6.4.

---

## 3. Estructura de tablas

### 3.1 Catálogos

```
┌────────────────────────────────────────────────────────────────────────────┐
│ reservation_status                               CATÁLOGO PROPIO | 4 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name                    VARCHAR(255)    NULL                               │
│ active                  INT             NULL   ← flag en INT, sin DEFAULT  │
├────────────────────────────────────────────────────────────────────────────┤
│ 1 Reservacion · 2 Show · 3 No Show · 4 Cancelado                           │
│ Sin created_at ni updated_at. La única tabla del módulo con datos.         │
│ Los nombres del catálogo NO son los que se pintan en pantalla (§6.4).      │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ status_process                                 CATÁLOGO PRESTADO | 4 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ status                  VARCHAR(50)     NULL                               │
├────────────────────────────────────────────────────────────────────────────┤
│ 1 Cotización · 2 Pendiente · 3 Pagado · 4 Cancelado                        │
│ Catálogo de Pedidos. Reservaciones lo escribe siempre en 1                 │
│ al dar de alta y nunca lo mueve: el flujo comercial está muerto aquí.      │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ evt_category                                   CATÁLOGO PRESTADO | 3 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ category                TEXT            NULL   ← nombre corto en TEXT      │
│ status                  INT             DEFAULT 1   ← hace de active       │
├────────────────────────────────────────────────────────────────────────────┤
│ 1 Evento · 2 Reservación · 3 Pedido                                        │
│ Discrimina de qué módulo es el documento. El ctrl fuerza                   │
│ category_id = 2 en cada alta y el listado filtra por ese 2.                │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ method_pay                                     CATÁLOGO PRESTADO | 3 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ method_pay              VARCHAR(20)     NULL                               │
├────────────────────────────────────────────────────────────────────────────┤
│ 1 Efectivo · 2 Tarjeta · 3 Transferencia                                   │
│ reservation.method_pay_id existe pero el módulo nunca lo escribe:          │
│ NULL en las 8 filas vivas. Columna heredada, no funcionalidad.             │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ evt_menu                                   RENGLÓN DE evt_events | 0 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ quantity                DOUBLE          NULL                               │
│ price                   DOUBLE          NULL                               │
│ package_type            TEXT            NULL                               │
│ total                   DOUBLE          NULL                               │
│ id_sub_event            INT             NULL   FK  ← prefijo id_ invertido │
│ id_event                INT             NULL   FK  ← ídem                  │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  id_sub_event           →  evt_subevents(id)                            │
│ FK  id_event               →  evt_events(id)                               │
├────────────────────────────────────────────────────────────────────────────┤
│ NO es un catálogo: es el renglón de menú de un evento concreto,            │
│ con su cantidad, su precio y su FK de vuelta al evento dueño.              │
│ reservation.evt_menu_id lo referencia como si fuera un catálogo. ←         │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Transacción raíz

```
┌────────────────────────────────────────────────────────────────────────────┐
│ reservation                                     TRANSACCIÓN RAÍZ | 0 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name_event              TEXT            NULL   ← nombre corto en TEXT      │
│ date_creation           DATETIME        NULL   ← alta (no created_at)      │
│ date_start              DATETIME        NULL   fecha + hora del evento     │
│ date_end                DATETIME        NULL   ← nunca se escribe          │
│ total_pay               DOUBLE          NULL   total pactado               │
│ notes                   TEXT            NULL   observaciones               │
│ status_process_id       INT             NULL   FK  ← congelado en 1        │
│ location                TEXT            NULL   ← texto corto en TEXT       │
│ name_client             TEXT            NULL   ← ídem                      │
│ phone                   TEXT            NULL   ← ídem                      │
│ email                   TEXT            NULL   ← ídem                      │
│ type_event              TEXT            NULL   ← columna muerta            │
│ category_id             INT             DEFAULT 1   FK  el ctrl fuerza 2   │
│ subsidiaries_id         INT             NULL   FK  cross-schema            │
│ evt_menu_id             INT             NULL   FK  ← columna muerta        │
│ quantity_people         INT             NULL   ← columna muerta            │
│ advanced_pay            DOUBLE          NULL   ← anticipo, nunca se usa    │
│ method_pay_id           INT             NULL   FK  ← columna muerta        │
│ discount                DOUBLE          NULL   ← columna muerta            │
│ info_discount           TEXT            NULL   ← columna muerta            │
│ status_reservation_id   INT             DEFAULT 1   FK  el estado real     │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  status_process_id      →  status_process(id)          SET NULL         │
│ FK  category_id            →  evt_category(id)            SET NULL         │
│ FK  subsidiaries_id        →  fayxzvov_alpha.subsidiaries(id)              │
│ FK  evt_menu_id            →  evt_menu(id)                SET NULL         │
│ FK  method_pay_id          →  method_pay(id)              SET NULL         │
│ FK  status_reservation_id  →  reservation_status(id)      ← SET NULL       │
├────────────────────────────────────────────────────────────────────────────┤
│ No tiene active: la baja se marca con status_reservation_id = 4.           │
│ El folio NO se guarda, se calcula: 'R-{inicial empresa}{inicial            │
│ sucursal}-{id a 2 dígitos}' (ctrl · formatSucursal).                       │
│ Clon columna por columna de evt_events + status_reservation_id (§5.1).     │
│ reservation_ibfk_6 es el único FK del esquema con ON UPDATE SET NULL.      │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Bitácora

```
┌────────────────────────────────────────────────────────────────────────────┐
│ reservation_histories                    BITÁCORA de reservation | 0 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ title                   VARCHAR(50)     NULL   siempre 'comentario'        │
│ action                  TEXT            NULL   qué pasó                    │
│ reservation_id          INT             NULL   FK                          │
│ usr_users_id            INT             NULL   FK  ← no es user_id         │
│ date_action             DATETIME        NULL   ← no es created_at          │
│ comment                 TEXT            NULL   ← duplica action            │
│ type                    VARCHAR(255)    NULL   'comment' hoy               │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  reservation_id         →  reservation(id)             CASCADE          │
│ FK  usr_users_id           →  fayxzvov_alpha.usr_users(id)SET NULL         │
├────────────────────────────────────────────────────────────────────────────┤
│ El KEY de reservation_id se llama `evt_events_id`: el nombre               │
│ quedó del clon de evt_histories. ←                                         │
│ La numeración de CONSTRAINT salta el _ibfk_1: hubo una FK borrada.         │
│ AUTO_INCREMENT = 18 con 0 filas: la tabla se vació, no nació vacía.        │
│ El front escribe action y comment con el MISMO texto del input.            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Auto-revisión contra el checklist de `db-rules.md §7`

Leyenda: **✓** cumple · **✗** no cumple · **~** cumple parcialmente.

### 4.1 Clasificación (§7.1)

```
✓  reservation es una transacción raíz clara: un documento, una fecha,
   un monto, una sucursal.
✓  reservation_status es un catálogo limpio de 4 valores.
✓  No hay `detail_` mal aplicado: no hay pivotes ni sub-catálogos.
✗  reservation.evt_menu_id apunta a evt_menu, que NO es un catálogo:
   es un renglón de evt_events (trae quantity, price, total y su propio
   id_event de vuelta al evento dueño). Una transacción raíz referenciando
   el renglón de OTRA transacción raíz de otro módulo.
~  reservation hace dos trabajos sin decirlo: 14 de sus 22 columnas son
   del dominio de Eventos (menú, número de personas, anticipo, descuento,
   método de pago, tipo de evento) y ninguna se usa en Reservaciones.
```

### 4.2 Nombres (§7.2)

```
~  Tablas en singular
      Singular:  reservation · reservation_status
      Plural:    reservation_histories  ← (patrón *_histories de la casa,
                 igual que order_histories en Pedidos)
✓  PK siempre `id INT AUTO_INCREMENT` en las 3 tablas
✗  FK = `<tabla_referenciada>_id`
      status_reservation_id  → reservation_status(id)
         el orden está invertido: debería ser reservation_status_id
      usr_users_id           → fayxzvov_alpha.usr_users(id)
         debería ser user_id (misma desviación que order_histories)
      evt_menu_id / category_id / method_pay_id: correctos
✗  El KEY se llama igual que la columna
      reservation_histories: la columna es `reservation_id` pero su KEY
      se llama `evt_events_id`. Es la huella del clon (§5.1) y es
      exactamente el anti-patrón que §6 de db-rules prohíbe.
✓  Columnas en snake_case inglés, sin camelCase ni español
```

### 4.3 Columnas obligatorias (§7.3)

```
✓  `id INT NOT NULL AUTO_INCREMENT PRIMARY KEY`      3 / 3 tablas
✗  `active TINYINT NOT NULL DEFAULT 1`                1 / 3 tablas
      Sólo reservation_status.active, y es INT NULL sin DEFAULT.
      reservation no tiene active: la baja es status_reservation_id = 4.
      reservation_histories no tiene active: nada se da de baja.
✗  `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`    0 / 3 tablas
      reservation usa date_creation, reservation_histories usa date_action,
      reservation_status no tiene fecha de alta.
      Ninguna con DEFAULT CURRENT_TIMESTAMP: la fecha la escribe PHP
      con date('Y-m-d H:i:s') en el controlador.
✗  `updated_at`                                       0 / 3 tablas
      No existe. Cuando una reservación pasa de Reservación a No Show,
      la BD no guarda cuándo pasó: eso sólo viviría en la bitácora,
      y el cambio de estado no escribe bitácora (§6.3).
✓  La transacción raíz lleva sucursal:  reservation.subsidiaries_id
✗  La transacción raíz NO lleva usuario
      reservation no tiene user_id: no hay forma de saber quién capturó
      la reservación. El único rastro de usuario es reservation_histories
      .usr_users_id, y el alta no genera bitácora.
✓  Hay estado donde hay flujo — de hecho hay dos (§2).
```

### 4.4 Tipos de datos (§7.4)

```
✓  Montos en DOUBLE
      total_pay · advanced_pay · discount — los tres correctos.
✗  Nombres cortos en VARCHAR, nunca TEXT
      Ocho columnas de texto corto declaradas TEXT en reservation:
         name_event · location · name_client · phone · email ·
         type_event · notes · info_discount
      phone y email en TEXT son el caso más caro: no se indexan, y
      buscar una reservación por teléfono es la consulta natural del
      dominio. El front además limita phone a 10 dígitos — cabe en
      VARCHAR(20) de sobra.
✓  Sin ENUM en ningún lado — los dos estados van a catálogo + FK,
   que es justo lo que pide la regla.
~  Fecha de negocio en DATE
      date_start es DATETIME, no DATE. Es defendible: la reservación
      necesita la hora (el front captura date_start + time_start y el
      ctrl los concatena). No es desviación, es el tipo correcto aquí.
✗  Flag en el tipo equivocado
      reservation_status.active  INT NULL   debería ser TINYINT NOT NULL
                                            DEFAULT 1
```

### 4.5 Foreign Keys (§7.5)

```
✓  8 FKs declaradas con CONSTRAINT explícito y nombre <tabla>_ibfk_<n>
✓  Cada FK tiene su KEY
✓  Maestros corporativos referenciados cross-schema, no duplicados
      fayxzvov_alpha.subsidiaries · fayxzvov_alpha.usr_users
      Documentados en er-usuarios-sucursales.md, no aquí.
~  Política ON DELETE / ON UPDATE
      Transacción → catálogo:      SET NULL / CASCADE   ✓ (5 de 6)
      Bitácora → transacción raíz:  CASCADE  / CASCADE   ✓
      → maestro corporativo:        SET NULL / CASCADE   ✓
      reservation_ibfk_6 (status_reservation_id → reservation_status)
      es SET NULL / **SET NULL**. El ON UPDATE debería ser CASCADE:
      si alguien renumera el catálogo, las reservaciones pierden su
      estado en vez de seguirlo. Es la única FK del esquema así.
✗  El KEY de reservation_histories.reservation_id se llama evt_events_id
✗  Hueco en la numeración: reservation_histories_ibfk_1 no existe
      (empieza en _2). Hubo una FK que se borró — casi seguro la que
      apuntaba a evt_events antes del clon.
```

### 4.6 Borrado (§7.6)

```
✓  Ningún DELETE físico
      Ni el modelo ni el controlador ejecutan DELETE. La cancelación
      es un UPDATE a status_reservation_id = 4, que es el espíritu
      correcto de la regla aunque la columna no se llame active.
~  Los listados filtran active = 1
      lsEstatus() sí filtra `active = 1` sobre reservation_status. ✓
      listReservations() no puede filtrar: reservation no tiene active.
      El filtro efectivo es category_id = 2 + rango de fechas.
✗  No hay soft-delete real en reservation
      "Cancelado" es un estado del negocio, no una baja lógica. Hoy se
      confunden: una reservación cancelada por el cliente y una
      capturada por error se marcan igual, y el dropdown deja editar
      las canceladas (§6.3).
```

### 4.7 DDL / esquema (§7.7)

```
✓  Engine InnoDB en las 3 tablas
✗  Charset y collation — y aquí está el problema serio
      El ESQUEMA fayxzvov_reginas es utf8mb4 / utf8mb4_0900_ai_ci.
      Las TRES TABLAS son latin1 / latin1_swedish_ci.
      No es que falte migrar el esquema: es que las tablas están en
      una collation distinta a la de su propio esquema. Cualquier JOIN
      de texto entre reservation y una tabla utf8mb4 del mismo esquema
      revienta con "Illegal mix of collations". Es exactamente el
      "nunca mezclar collations" de §1.2, y aquí está mezclado dentro
      del mismo esquema.
      Afecta a 13 columnas: las 8 TEXT de reservation, title/action/
      comment/type de la bitácora y name del catálogo.
~  Orden de columnas: id → negocio → montos → fechas → timestamps →
   status → FKs → active
      reservation lo respeta a medias y por accidente: intercala
      status_process_id (FK) en la posición 8, entre notes y location,
      y cierra con status_reservation_id después de las FKs. No hay
      active que colocar al final.
```

---

## 5. Lo que la estructura cuenta de su propio origen

### 5.1 `reservation` es un clon de `evt_events`

No es una sospecha, es una comparación de columnas:

```
evt_events   : id name_event date_creation date_start date_end total_pay notes
               status_process_id location name_client phone email type_event
               category_id subsidiaries_id evt_menu_id quantity_people
               advanced_pay method_pay_id discount info_discount

reservation  : ...las mismas 21, en el mismo orden...
               + status_reservation_id
```

Veintiuna columnas idénticas, en el mismo orden físico, más una. Y lo mismo abajo:
`reservation_histories` es `evt_histories` menos `evt_subevents_id`, con `evt_events_id`
renombrada a `reservation_id` — pero **el KEY conservó el nombre viejo**, que es la
huella que no se borró.

Reservaciones nació de un `CREATE TABLE ... LIKE` (o de un dump editado) del módulo de
Eventos, se le agregó el estado propio y se dejó todo lo demás. De ahí salen las 8
columnas muertas del §3.2 y la FK a `evt_menu`.

**Qué significa en la práctica:** el módulo arrastra el modelo de datos de Eventos sin
usarlo. Si mañana Reservaciones necesita menú, personas o anticipo, las columnas ya
están — pero apuntando al esquema de Eventos, no al suyo.

### 5.2 Las tres tablas están vacías, y no todas por la misma razón

| Tabla | Filas | AUTO_INCREMENT | Lectura |
|---|---|---|---|
| `reservation` | **0** | 1 | Contador en cero: nunca recibió un alta en este esquema |
| `reservation_histories` | **0** | **18** | Llegó a la fila 17 y se vació |
| `reservation_status` | 4 | 5 | Catálogo sembrado, íntegro |

Las tres con `CREATE_TIME = 2026-08-04 22:14:12` y `UPDATE_TIME = NULL`. Estructura
restaurada de golpe, sin escrituras posteriores.

El `AUTO_INCREMENT = 18` de la bitácora coincide **exactamente** con el de
`fayxzvov_coffee.reservation_histories`, que sí tiene 4 filas cuyo id máximo es 17. La
estructura de `fayxzvov_reginas` salió del mismo dump que `fayxzvov_coffee`, con los
datos de la raíz y la bitácora despojados y el catálogo conservado.

**No hay volumen que reportar en este esquema.** Cualquier afirmación sobre cuántas
reservaciones se hacen, qué porcentaje termina en No Show o cuál es el ticket promedio
tendría que salir de `fayxzvov_coffee`, que es un esquema distinto al documentado.

---

## 6. El código que lo consume

`alpha/reservaciones/` — 4 archivos vivos + 3 logs de error.

```
alpha/reservaciones/
├─ index.php                    carga app.js y reservaciones.js
├─ ctrl/ctrl-reservaciones.php  10 acciones + 4 helpers de presentación
├─ mdl/mdl-reservaciones.php    class MPedidos  ← nombre heredado de Pedidos
└─ src/js/
   ├─ app.js                    798 líneas: layout, tabla, formulario, timeline
   └─ reservaciones.js          0 bytes  ← archivo vacío, cargado igual
```

### 6.1 El modelo apunta a otro esquema

```php
// mdl-reservaciones.php:11
$this->bd = 'fayxzvov_coffee.';
```

Todas las consultas del módulo se construyen con ese prefijo: el listado, el alta, la
edición, la bitácora y el catálogo de estados. **El código no lee ni escribe en
`fayxzvov_reginas`.** Lo confirma el log de producción:

```
[ INFO ] :: SELECT ... FROM fayxzvov_coffee.reservation
          INNER JOIN fayxzvov_coffee.status_process ...
```

Y lo confirman los datos: 8 reservaciones en `fayxzvov_coffee`, 0 en `fayxzvov_reginas`.
Hay una tercera copia idéntica y también vacía en `fayxzvov_templates`.

Tres esquemas con la misma estructura, uno solo con datos, y el que tiene datos no es el
que el resto del ERP considera operativo (Pedidos, turnos y cierres viven en
`fayxzvov_reginas`). Una reservación y el pedido que genera **no pueden unirse con un
JOIN**: están en bases distintas.

### 6.2 Mapa de acciones

| `opc` | Controlador | Modelo | Qué hace |
|---|---|---|---|
| `init` | `init()` | `lsEstatus()` | Puebla el select del filtro desde `reservation_status` |
| `lsReservation` | `lsReservation()` | `listReservations()` | Tabla principal |
| `getReservation` | `getReservation()` | `getReservationById()` | Detalle para el modal |
| `addReservation` | `addReservation()` | `createReservation()` | Alta |
| `editReservation` | `editReservation()` | `updateReservation()` | Show / No Show |
| `cancelReservation` | `cancelReservation()` | `updateReservation()` | Estado 4 |
| `getHistory` | `getHistory()` | `getReservationHistories()` | Timeline |
| `addHistory` | `addHistory()` | `addHistories()` | Comentario |

### 6.3 Lo que está roto hoy

**a) Editar una reservación no funciona.** `app.js:271` y `app.js:277` mandan `opc` que
el controlador no implementa:

```js
const req = await useFetch({ opc: "get", id });          // no existe get()
this.createForm({ data: { opc: "edit", id }, ... });     // no existe edit()
```

El controlador expone `getReservation` y `editReservation`. El dispatcher del final
(`$obj->$fn()`) lanza `Call to undefined method`. El log de producción lo tiene
registrado con esos nombres exactos:

```
PHP Fatal error: Call to undefined method Pedidos::get()      · ctrl-reservaciones.php:228
PHP Fatal error: Call to undefined method Pedidos::update()   · ctrl-reservaciones.php:123
```

Además ese `useFetch` va mal formado: le falta `url` y el payload debería ir envuelto en
`data`. Son dos fallos encadenados sobre la misma llamada.

**b) La columna Total siempre muestra `-`.** `ctrl-reservaciones.php:53`:

```php
'Total' => [ "html" => evaluar($total), ... ]   // $total nunca se define
```

La consulta sí trae `total_pay`; el controlador lo ignora y evalúa una variable que no
existe. `evaluar(null)` devuelve `'-'`. Son **675 warnings `Undefined variable $total`**
en el log — el error más repetido del módulo. La corrección es `$key['total_pay']`.

**c) El filtro de estado no filtra.** El controlador lee `$_POST['status']` en
`$idEstatus` y después lo tira, pasando `'status' => 1` fijo. El select se llena con
`reservation_status` (Reservacion / Show / No Show / Cancelado) pero el `WHERE` compara
contra `status_process_id` — **otro catálogo**. Aunque se conectara el valor,
seleccionar "No Show" filtraría por "Pagado". 154 warnings `Undefined array key "status"`
en el log.

**d) El dropdown protege el estado equivocado.** `ctrl-reservaciones.php:202`:

```php
if ($status == 2) {         // el comentario dice "Cancelado"
```

En el catálogo, 2 es **Show** y 4 es **Cancelado**. El resultado: a una reservación con
el cliente ya sentado se le esconden Editar y Cancelar, y a una cancelada se le dejan
las dos disponibles.

**e) El INNER JOIN esconde filas.** `listReservations()` une contra `status_process` con
`INNER JOIN`. Una reservación con `status_process_id` en NULL — que la columna admite y
la FK pone en NULL si se borra el estado — desaparece del listado sin dejar rastro.

**f) El rango de fechas filtra por alta, no por evento.** El `WHERE` usa
`date_creation BETWEEN ? AND ?` mientras el datepicker dice "Consultar fecha" y por
defecto abre en el mes actual. Una reservación capturada hoy para diciembre aparece en
el mes de hoy y no en el de diciembre. Para un módulo cuya pregunta natural es "¿qué
tengo reservado el sábado?", el filtro contesta otra cosa.

**g) El cambio de estado no deja bitácora.** `showReservation`, `noShowReservation` y
`cancelReservation` hacen UPDATE directo. La bitácora sólo se escribe cuando el usuario
teclea un comentario a mano. Sin `updated_at` y sin bitácora automática, un No Show no
deja **ningún** rastro de cuándo ni quién lo marcó.

**h) `reservaciones.js` está vacío** (0 bytes) y `index.php` lo carga igual, con
cache-buster. Una petición de más en cada carga, a cambio de nada.

### 6.4 Cuatro fuentes de verdad para cuatro estados

El mismo catálogo de 4 valores está escrito en cuatro lugares, y ninguno coincide del
todo con el siguiente:

| Origen | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| BD · `reservation_status.name` | Reservacion | Show | No Show | Cancelado |
| PHP · `status()` del ctrl | Reservación | Si llego | No llego | Cancelado |
| JS · `getStatusReservation()` | Reservación | Si llego | No llego | **— falta** |
| Select del filtro | lo que diga la BD | | | |

La tabla pinta "Si llego" (PHP), el modal de detalle pinta "Si llego" (JS) y el filtro
ofrece "Show" (BD). Y una reservación cancelada abierta en el modal muestra `-` como
estado, porque el mapa de JS no tiene el 4.

---

## 7. Resumen de la revisión

| Bloque del checklist | Resultado |
|---|---|
| Clasificación | ✓ raíz y catálogo claros · ✗ FK a un renglón de otro módulo · ~ 14 columnas ajenas al dominio |
| Nombres | ✓ PK y snake_case · ✗ `status_reservation_id` invertido · ✗ KEY llamado `evt_events_id` |
| Columnas obligatorias | ✗ `active` 1/3 · ✗ `created_at` 0/3 · ✗ `updated_at` 0/3 · ✗ sin usuario en la raíz |
| Tipos | ✓ montos en DOUBLE · ✓ sin ENUM · ✗ 8 columnas de texto corto en TEXT |
| Foreign keys | ✓ 8 declaradas con KEY · ✓ cross-schema correcto · ~ 1 FK con ON UPDATE SET NULL |
| Borrado | ✓ ningún DELETE físico · ✗ sin soft-delete real en `reservation` |
| Esquema | ✓ InnoDB · ✗ **tablas latin1 dentro de un esquema utf8mb4** |

**Las cinco cosas que cuestan, en orden de lo que cuestan:**

1. **El código escribe en `fayxzvov_coffee`, no en el esquema documentado.** Hay tres
   copias de la estructura (`coffee`, `reginas`, `templates`) y la que tiene los 8
   registros no es la operativa del ERP. Mientras esto siga así, Reservaciones no puede
   unirse por JOIN con Pedidos, turnos ni cierres, y cualquier reporte que cruce ambos
   dominios es imposible sin export/import manual. Es una línea de código
   (`mdl-reservaciones.php:11`) y una migración de 8 filas — pero mientras no se decida
   cuál es el esquema bueno, todo lo demás se construye sobre arena.

2. **Editar está roto en producción** (`opc: "get"` / `opc: "edit"`), y **el Total
   siempre muestra `-`** (`$total` sin definir, 675 warnings). Son dos correcciones de
   una línea cada una que hoy dejan la pantalla principal sin su columna de dinero y el
   botón Editar sin efecto.

3. **Tablas `latin1_swedish_ci` dentro de un esquema `utf8mb4_0900_ai_ci`.** No es la
   deuda clásica de "falta migrar": es una mezcla **dentro del mismo esquema**. Nombres
   de cliente y de evento con acentos y ñ, y cualquier JOIN de texto contra una tabla
   utf8mb4 vecina falla con *Illegal mix of collations*.

4. **Sin `updated_at`, sin usuario en la raíz y sin bitácora automática.** Cuando una
   reservación aparece como No Show, la BD no sabe quién la marchó ni cuándo. En un
   módulo donde el estado es el producto — llegó o no llegó — esto es lo que hace
   imposible auditar una queja.

5. **Ocho columnas muertas heredadas de Eventos** (`type_event`, `quantity_people`,
   `advanced_pay`, `method_pay_id`, `discount`, `info_discount`, `evt_menu_id`,
   `date_end`), NULL en las 8 filas vivas. Baratas de tolerar, caras de interpretar: el
   próximo que lea la tabla creerá que el módulo maneja anticipos y menús.

Lo de nomenclatura (`status_reservation_id` invertido, KEY `evt_events_id`,
`reservation_histories` en plural, `class MPedidos` en el modelo de Reservaciones) es
ruido real pero barato: se vive con él o se corrige en un renombre coordinado. No urge.

---

## 8. Qué sigue

Este entregable son las **cajas**, no el DDL. Si apruebas la lectura, el siguiente paso
puede ser cualquiera de estos, bajo pedido explícito:

- **Decidir el esquema operativo** y, con esa decisión, el DDL de migración de las 8
  reservaciones de `fayxzvov_coffee` a `fayxzvov_reginas` (o la ratificación de
  `coffee` como el bueno, y entonces mover el resto del módulo).
- **DDL de saneamiento** de las desviaciones que decidas atacar: collation a
  `utf8mb4_0900_ai_ci`, `created_at` / `updated_at`, TEXT → VARCHAR en las ocho
  columnas de texto corto, `active TINYINT` en las tres tablas.
- **Esquema normalizado** de este mismo dominio como se vería recién nacido bajo
  `db-rules.md`, sin la herencia de `evt_events`.
- **Diagramas ER por sección** (`diagramas-er-reservaciones.md`, formato §2.ter) si
  quieres la ficha exhaustiva columna por columna además de estas cajas.
