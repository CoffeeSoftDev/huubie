# Usuarios y Sucursales — formato Coffee Intelligence

> Capa de **identidad y multi-tenencia** sobre la que corre `alpha/pedidos`.
> Hermano de [er-pedidos.md](er-pedidos.md): aquel documenta el dominio operativo
> (`fayxzvov_reginas`), éste documenta **quién** opera y **dónde**.
> Fuente de verdad de las convenciones: `~/.claude/steering/grimorios/db-rules.md`.
> **Esto documenta el esquema que YA existe**, no propone uno nuevo. Las cajas son
> fieles a la BD viva (inspección directa vía `information_schema` + `SHOW CREATE TABLE`)
> y las flechas `←` marcan cada punto donde el esquema se separa de la regla.

---

## 0. Contexto del dominio

| | |
|---|---|
| Dominio | Identidad, roles y multi-tenencia del ERP Huubie |
| Entidad raíz de tenencia | La **empresa** (`companies`) |
| Entidad operativa | La **sucursal** (`subsidiaries`) |
| Actor | El **usuario** (`usr_users`) |
| Esquema de identidad | `fayxzvov_alpha` · MySQL 8.0.31 · InnoDB · `latin1_swedish_ci` |
| Esquema de tenencia | `fayxzvov_admin` (clientes, empresas, catálogo de módulos) |
| Esquema operativo | `fayxzvov_reginas` (pedidos, turnos, cierres) — consume, no define |
| Alcance | 9 tablas: 4 de identidad + 5 de tenencia |
| Volumen real | 55 usuarios · 8 sucursales · 4 empresas · 6 roles · 7 módulos |

**El punto no obvio:** `fayxzvov_alpha` es a la vez el esquema de identidad **y** el
esquema operativo del módulo de Eventos (`evt_*`). Los usuarios y las sucursales viven
mezclados con las tablas de un módulo de negocio. Pedidos los referencia desde fuera,
por nombre calificado (`fayxzvov_alpha.usr_users`).

---

## 1. Clasificación de tablas (db-rules §1.4)

| Clase | Tablas |
|---|---|
| **Catálogo** | `usr_rols` · `modules` |
| **Maestro de tenencia** | `customers` · `companies` · `subsidiaries` |
| **Maestro de identidad** | `usr_users` · `fayxzvov_admin.users` |
| **Pivote N:M** | `usr_user_subsidiaries` (usuario ↔ sucursal) · `module_company` (módulo ↔ empresa) |

Los dos únicos pivotes puros de todo el ecosistema Huubie viven aquí, y ambos van **sin
prefijo `detail_`** — que es exactamente lo que manda la regla: `detail_` es sólo para
renglones de transacción raíz.

---

## 2. Diagrama de relaciones

Caja **doble** = esquema de este documento (`fayxzvov_alpha`).
Caja **simple** = cross-schema (`fayxzvov_admin` / `fayxzvov_reginas`).

```
  fayxzvov_admin  ·  TENENCIA (quién contrata)
  ┌──────────────┐        ┌──────────────┐        ┌──────────────────┐
  │  customers   │ 1    N │  companies   │ N    N │     modules      │
  │  el cliente  ├───────▶│  la empresa  │◀──────▶│  catálogo de     │
  │  (persona)   │        │  name_bd ────┼──┐     │  módulos del ERP │
  └──────────────┘        └──────┬───────┘  │     └──────────────────┘
         ▲ 1                     │ 1        │              ▲
         │ N                     │          │   module_company (pivote)
  ┌──────┴───────┐               │          │
  │ admin.users  │               │          └──▶ apunta al ESQUEMA de datos
  │ login del    │               │               del tenant:
  │ panel maestro│               │               'fayxzvov_reginas'
  └──────────────┘               │
                                 │ N
  ═════════════════════════ fayxzvov_alpha ═════════════════════════
                                 ▼
                      ╔════════════════════╗
       ┌──────────────╢    subsidiaries    ╟──────────────┐
       │   1      N   ║    LA SUCURSAL     ║   N      N   │
       │              ╚═════════╤══════════╝              │
       │                        │ 1                       │
       │                        │ N                       │
       │              ╔═════════▼══════════╗   ┌──────────▼────────────┐
       │              ║     usr_users      ║ 1 │ usr_user_subsidiaries │
       │              ║    EL USUARIO      ╟───┤   PIVOTE  N:M         │
       │              ║  subsidiaries_id ──╫─┐ │ (sucursales donde     │
       │              ╚═════════╤══════════╝ │ │  puede operar)        │
       │                        │ N          │ └───────────────────────┘
       │                        │ 1          │
       │              ╔═════════▼══════════╗ │  la FK directa es la
       │              ║     usr_rols       ║ │  sucursal de ARRANQUE
       │              ║  1 Administrador   ║ │  de sesión; el pivote
       │              ║  2 Cajero          ║ │  es el ALCANCE
       │              ║  3 Vendedor        ║ │
       │              ║  4 Lectura         ║◀┘
       │              ║  5 SuperAdmin      ║
       │              ║  6 Supervisor      ║
       │              ╚════════════════════╝
       │
  ═══════════════════ fayxzvov_reginas (consume) ════════════════════
       │
       │   ┌───────────────┐  ┌───────────────┐  ┌──────────────────┐
       ├──▶│ order         │  │ cash_shift    │  │ daily_closure    │
       │   │ subsidiaries_ │  │ subsidiary_id │  │ subsidiary_id    │
       │   │ id            │  │ employee_id ──┼─┐│ employee_id    ──┼─┐
       │   │ cancelled_by  │  └───────────────┘ │└ reopened_by    ──┼─┤
       │   │   ┈┈ sin FK   │                    │                   │ │
       │   └───────────────┘                    └───────────────────┘ │
       │                                                              │
       │   ┌───────────────┐  ┌───────────────┐  ┌──────────────────┐ │
       ├──▶│ order_products│  │ order_clients │  │ order_category   │ │
       │   └───────────────┘  └───────────────┘  └──────────────────┘ │
       │                                                              │
       │   ┌───────────────┐  ┌──────────────────┐                    │
       └┈┈▶│ order_payments│  │ order_histories  │◀───────────────────┘
    sin FK │subsidiaries_id│  │ usr_users_id     │      ┈┈ sin FK
           │  (cobro       │  │  ┈┈ sin FK       │
           │   cruzado)    │  └──────────────────┘
           └───────────────┘
```

**Cardinalidades en una línea**

```
customers            1 ──── N  companies
customers            1 ──── N  fayxzvov_admin.users
companies            1 ──── N  subsidiaries
companies            N ──── N  modules            (vía module_company)
subsidiaries         1 ──── N  usr_users          (sucursal de arranque)
usr_rols             1 ──── N  usr_users
usr_users            N ──── N  subsidiaries       (vía usr_user_subsidiaries)
subsidiaries         1 ──── N  order · order_products · order_clients · order_category
subsidiaries         1 ──── N  cash_shift · daily_closure
usr_users            1 ──── N  cash_shift(employee_id) · daily_closure(employee_id, reopened_by)
usr_users            1 ┈┈┈┈ N  order_histories(usr_users_id) · order(cancelled_by)   ← sin FK declarada
```

---

## 3. Estructura de tablas

### 3.1 Tenencia — `fayxzvov_admin`

```
┌────────────────────────────────────────────────────────────────────────────┐
│ customers                                            MAESTRO | 3 filas     │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name                    VARCHAR(150)    NULL                               │
│ paternal_surname        VARCHAR(100)    NULL                               │
│ maternal_surname        VARCHAR(100)    NULL                               │
│ full_name               VARCHAR(255)    NULL   ← denormalización de los 3  │
│ enabled                 TINYINT         DEFAULT 1                          │
├────────────────────────────────────────────────────────────────────────────┤
│ La persona física que contrata el ERP. No tiene active ni timestamps.      │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ companies                                            MAESTRO | 4 filas     │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ social_name             VARCHAR(255)    NULL   razón social                │
│ address                 TEXT            NULL                               │
│ rfc                     VARCHAR(20)     NULL   ← hoy guarda el nombre      │
│ logo                    TEXT            NULL   ruta del archivo            │
│ rute                    VARCHAR(255)    NULL   ← typo de 'route', sin uso  │
│ ubication               TEXT            NULL                               │
│ phone                   DOUBLE          NULL   ← teléfono numérico         │
│ name_bd                 VARCHAR(255)    NULL   ★ ESQUEMA DE DATOS DEL      │
│                                                  TENANT                    │
│ enabled                 TINYINT         DEFAULT 1                          │
│ customers_id            INT             NULL   FK                          │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  customers_id           →  customers(id)      ON DELETE SET NULL        │
├────────────────────────────────────────────────────────────────────────────┤
│ ★ name_bd es la pieza central de la multi-tenencia: cada empresa apunta    │
│   al esquema MySQL donde viven SUS datos operativos.                       │
│      1 Marini             → fayxzvov_alpha                                 │
│      2 Club Campestre     → fayxzvov_alpha_2                               │
│      3 Terraza            → fayxzvov_alpha_3                               │
│      4 Huubie Pastelería  → fayxzvov_reginas   ← el tenant de PEDIDOS      │
│   El login lo copia a $_SESSION['DB'].                                     │
│   Sin active, sin timestamps, sin UNIQUE en rfc.                           │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ modules                                             CATÁLOGO | 7 filas     │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name                    TEXT            NULL   ← nombre corto en TEXT      │
│ route                   TEXT            NULL   'pedidos/'                  │
│ file_path               TEXT            NULL                               │
│ nickname                TEXT            NULL   'Pedidos' (vista superadmin)│
│ description             TEXT            NULL                               │
│ image                   TEXT            NULL                               │
├────────────────────────────────────────────────────────────────────────────┤
│ 1 Eventos · 2 Pedidos · 3 Reservaciones · 4 CalendarioEventos ·            │
│ 5 CalendarioPedidos · 6 CatalogosEventos · 7 CatalogosPedidos              │
│ Sin id, sin active, sin timestamps: es un catálogo de código, no de datos. │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ module_company                                       PIVOTE N:M | 13 filas │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ module_id               INT             NULL   FK                          │
│ company_id              INT             NULL   FK  ← singular vs plural    │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  module_id              →  modules(id)        ON UPDATE CASCADE         │
│ FK  company_id             →  companies(id)      ON UPDATE CASCADE         │
├────────────────────────────────────────────────────────────────────────────┤
│ Gobierna el menú lateral: qué módulos ve cada empresa.                     │
│ Huubie Pastelería (4) → módulos 2, 5, 7 (Pedidos + su calendario y         │
│ catálogos). Sin active: desactivar un módulo obliga a borrar la fila.      │
│ Sin UNIQUE(module_id, company_id): admite duplicados.                      │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ fayxzvov_admin.users                                 MAESTRO | 5 filas     │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ user                    VARCHAR(255)    NULL                               │
│ key                     TEXT            NULL   ← MD5                       │
│ name_database           VARCHAR(255)    DEFAULT ''                         │
│ enabled                 TINYINT         DEFAULT 1                          │
│ active                  TINYINT         DEFAULT 0                          │
│ customers_id            INT             NULL   FK                          │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  customers_id           →  customers(id)      ON DELETE SET NULL        │
├────────────────────────────────────────────────────────────────────────────┤
│ Login del panel MAESTRO (alta de empresas), NO del ERP.                    │
│ alpha/pedidos nunca la toca: sus usuarios son usr_users.                   │
└────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Identidad — `fayxzvov_alpha`

```
┌────────────────────────────────────────────────────────────────────────────┐
│ subsidiaries                                    LA SUCURSAL | 8 filas      │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ name                    VARCHAR(200)    NULL                               │
│ logo                    TEXT            NULL                               │
│ ubication               TEXT            NULL   ciudad, se pinta en navbar  │
│ date_creation           DATETIME        NULL   ← no es created_at          │
│ enabled                 INT             DEFAULT 1   ¿existe en el sistema? │
│ active                  SMALLINT        DEFAULT 0   ¿opera hoy?  ← DEF. 0  │
│ companies_id            INT             NULL   FK                          │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  companies_id           →  fayxzvov_admin.companies(id)                 │
│                               ON DELETE SET NULL  ON UPDATE CASCADE        │
├────────────────────────────────────────────────────────────────────────────┤
│ DOS flags con semánticas distintas — es deliberado, no redundante:         │
│   enabled = existe en el sistema (filtro duro del selector de navbar)      │
│   active  = está operando  → la navbar la pinta "Cerrada" si active = 0    │
│ Estado real: 8 sucursales, todas enabled = 1, una con active = 0 (Terraza).│
│ ⚠ DEFAULT 0 en active: toda sucursal nueva nace "cerrada" salvo que el     │
│   alta lo escriba explícitamente.                                          │
│                                                                            │
│ Las 8 sucursales vivas:                                                    │
│    1 Marinni Centro (emp.1) ·  2 Club Campestre (emp.2) ·                  │
│    3 Terraza (emp.3, cerrada) · 4 Reginas guadalupe (emp.4) ·              │
│   18 Altozano (emp.2) · 21 Club campestre tap (emp.2) ·                    │
│   22 Regina's cuarta (emp.4) · 25 Reginas kafeto (emp.4)                   │
│ Pedidos opera sobre la empresa 4 → sucursales 4, 22 y 25.                  │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ usr_users                                        EL USUARIO | 55 filas     │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ user                    TEXT            NULL   ← el correo, en TEXT        │
│ key                     TEXT            NULL   ← MD5 sin salt (32 chars)   │
│ key2                    TEXT            NULL   ← columna muerta (54/55     │
│                                                  vacías)                   │
│ fullname                TEXT            NULL   ← nombre corto en TEXT      │
│ photo                   TEXT            NULL   45/55 sin foto              │
│ birthday                DATE            NULL                               │
│ phone                   VARCHAR(255)    NULL   ✓ el único teléfono bien    │
│                                                  tipado del ecosistema     │
│ date_creation           DATETIME        NULL   ← no es created_at          │
│ owner                   SMALLINT        DEFAULT 0   dueño del negocio      │
│ enabled                 TINYINT         DEFAULT 1   ¿puede entrar?         │
│ active                  TINYINT         DEFAULT 1   ¿aparece en listados?  │
│ usr_rols_id             INT             NULL   FK                          │
│ subsidiaries_id         INT             NULL   FK  sucursal de ARRANQUE    │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  usr_rols_id            →  usr_rols(id)       ON DELETE SET NULL        │
│ FK  subsidiaries_id        →  subsidiaries(id)   ON DELETE SET NULL        │
├────────────────────────────────────────────────────────────────────────────┤
│ De nuevo DOS flags:                                                        │
│   enabled → lo exige el LOGIN (getUserByData: WHERE enabled = 1)           │
│   active  → lo exige el LISTADO del admin (listUsers: WHERE active = ?)    │
│ Estado real: 51 con enabled=1 y active=1 · 4 con active=0 (dados de baja   │
│ del listado pero que TODAVÍA PUEDEN INICIAR SESIÓN).                       │
│                                                                            │
│ owner = 1 en 2 usuarios. Es un permiso paralelo al rol: habilita           │
│ "Eliminar pedido" igual que el administrador (dropdownOrder).              │
│ Sin UNIQUE en `user`: la unicidad del correo se valida en PHP              │
│ (existsUserByName), no en la BD.                                           │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ usr_rols                                            CATÁLOGO | 6 filas     │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ rols                    VARCHAR(50)     NULL   ← plural para un nombre     │
│ active                  SMALLINT        DEFAULT 1                          │
│ superadmin              SMALLINT        DEFAULT 0   ← columna muerta       │
├────────────────────────────────────────────────────────────────────────────┤
│  id  rol             active  usuarios   qué puede hacer en Pedidos         │
│  ──  ─────────────   ──────  ────────   ────────────────────────────────   │
│   1  Administrador      1       19      todo, incluida edición de pedido   │
│                                         liquidado (con su contraseña)      │
│   2  Cajero             1        8      opera su sucursal + cualquiera     │
│                                         con turno abierto                  │
│   3  Vendedor           1       26      igual que cajero                   │
│   4  Lectura            1        0      sin uso: nadie lo tiene            │
│   5  SuperAdmin         0        1      ve TODOS los módulos del ERP       │
│   6  Supervisor         1        1      edita entregas de cualquier suc.   │
├────────────────────────────────────────────────────────────────────────────┤
│ ⚠ `superadmin` está en NULL para los roles 1-5 y en 0 para el 6: el código │
│   nunca la lee, decide con `ROLID == 5` a pelo.                            │
│ ⚠ El código de Pedidos autoriza al ROL 7 en 8 lugares distintos            │
│   (in_array($_SESSION['ROLID'], [1,2,3,6,7])), pero el rol 7 NO EXISTE     │
│   en esta tabla. Es un permiso reservado para un rol que nunca se creó.    │
└────────────────────────────────────────────────────────────────────────────┘
```

```
┌────────────────────────────────────────────────────────────────────────────┐
│ usr_user_subsidiaries                                PIVOTE N:M | 9 filas  │
├────────────────────────────────────────────────────────────────────────────┤
│ id                      INT             PK  AUTO_INCREMENT                 │
│ date_creation           DATETIME        NULL   3/9 filas en NULL           │
│ usr_users_id            INT             NULL   FK                          │
│ subsidiaries_id         INT             NULL   FK                          │
│ active                  INT             NULL   ← 3/9 filas en NULL         │
├────────────────────────────────────────────────────────────────────────────┤
│ FK  usr_users_id           →  usr_users(id)      ON DELETE CASCADE         │
│ FK  subsidiaries_id        →  subsidiaries(id)   ON DELETE CASCADE         │
├────────────────────────────────────────────────────────────────────────────┤
│ ★ La tabla del PERSONAL ROTATIVO: qué sucursales tiene asignadas cada      │
│   usuario, más allá de la de arranque de sesión.                           │
│                                                                            │
│ Se ESCRIBE desde alpha/admin (syncUserSubsidiaries: DELETE + N INSERT,     │
│ sin transacción) y se LEE en el listado de usuarios.                       │
│                                                                            │
│ ⚠ alpha/pedidos y alpha/access NO LA CONSULTAN. El selector de sucursal    │
│   de la navbar de alpha lista TODAS las sucursales de la empresa           │
│   (getSubsidiariesByCompany), no las asignadas. El pivote existe, se       │
│   administra… y no restringe nada en alpha. Ver §7.                        │
│                                                                            │
│ ⚠ Cobertura real: sólo 4 de 55 usuarios tienen filas aquí (9 en total).    │
│   Los otros 51 dependen exclusivamente de usr_users.subsidiaries_id.       │
│ ⚠ Sin UNIQUE(usr_users_id, subsidiaries_id): hoy no hay duplicados, pero   │
│   nada los impide.                                                         │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Cómo Pedidos consume esta capa

### 4.1 Del login a la sesión

`alpha/access/mdl/mdl-access.php :: getUserByData()` hace el JOIN de las tres capas
en una sola consulta y `ctrl-access.php :: getUser()` la vuelca a `$_SESSION`:

```
usr_users ──INNER JOIN── subsidiaries ──INNER JOIN── admin.companies
    └──INNER JOIN── usr_rols
                    WHERE usr_users.enabled = 1 AND BINARY usr_users.user = ?
                                                   ▲
                                          BINARY = correo case-sensitive
```

```
  VARIABLE DE SESIÓN        ORIGEN                            QUIÉN LA USA EN PEDIDOS
  ──────────────────────    ──────────────────────────────    ────────────────────────
  $_SESSION['ID']  / ['USR'] usr_users.id                     cash_shift.employee_id,
                                                              order_histories.usr_users_id,
                                                              revalidación de contraseña
  $_SESSION['ROLID']         usr_rols.id                      TODA la matriz de permisos
  $_SESSION['ROL']           usr_rols.rols                    etiqueta de la navbar
  $_SESSION['OWNER']         usr_users.owner                  permiso "Eliminar pedido"
  $_SESSION['SUB']           subsidiaries.id                  ★ sucursal de TODA escritura
  $_SESSION['SUBSIDIARIE_NAME'] subsidiaries.name             encabezado y tickets
  $_SESSION['COMPANY_ID'] / ['COM'] companies.id              lista de sucursales del filtro
  $_SESSION['COMPANY']       companies.social_name            carpeta de uploads
  $_SESSION['LOGO']          companies.logo                   ticket impreso
  $_SESSION['DB']            companies.name_bd                ⚠ SE GUARDA Y NO SE USA
```

⚠ **`$_SESSION['DB']` es multi-tenencia a medias.** El login resuelve correctamente el
esquema del tenant (`companies.name_bd`), pero `MPedidos::__construct()` lo ignora y
hardcodea `$this->bd = 'fayxzvov_reginas.'`. Hoy funciona porque sólo la empresa 4 tiene
Pedidos contratado; el día que una segunda empresa lo contrate, escribirá sus pedidos en
la base de la primera.

### 4.2 Matriz de permisos por rol

Reconstruida de `ctrl-pedidos.php`, `ctrl-cierre.php` y `dropdownOrder()`:

```
  OPERACIÓN                          1 Admin  2 Cajero  3 Vend.  6 Superv.  Regla
  ────────────────────────────────   ───────  ────────  ───────  ─────────  ──────────────
  Ver pedidos de otra sucursal          ✓        ✓         ✓         ✓      filtro de vista
  Crear pedido                          ✓        ✓         ✓         ✓      exige turno abierto
  Editar / cancelar / cobrar            ✓        ·         ·         ·      canWriteOrder()
    └─ en su sucursal de sesión         ✓        ✓         ✓         ✓
    └─ en otra sucursal CON turno       ✓        ✓         ✓         ·      sólo roles 2 y 3
    └─ en otra sucursal SIN turno       ✓        ·         ·         ·
  Editar pedido LIQUIDADO               ✓+🔑      ·         ·         ·      paidOrderEditDenial()
  Editar datos de ENTREGA liquidada     ✓+🔑      ·         ·        ✓+🔑    deliveryEditDenial()
  Eliminar un abono                     ✓        ·         ·         ·      + 🔑 si liquidado
  Cambiar método de un pago             ✓        ·         ·         ·      sólo si el turno
                                                                            sigue abierto
  Eliminar pedido                       ✓        ·         ·         ·      o cualquiera con
                                                                            owner = 1
  Papelera de pedidos                   ✓        ·         ·         ·
  Abrir / cerrar turno                  ✓        ✓         ✓         ✓      sucursal del modal
  Cerrar el día (corte Z)               ✓        ✓         ✓         ✓
  Reabrir un cierre                     ✓        ·         ·         ·      daily_closure.reopened_by

  🔑 = revalida la contraseña del usuario en sesión contra usr_users.key (MD5)
```

**El candado que no es de rol:** `canWriteOrder()` deja que un cajero o vendedor mute
pedidos de **otra** sucursal si esa sucursal tiene turno abierto. Es la regla que hace
funcionar al personal rotativo — sin pasar por `usr_user_subsidiaries`. El permiso real
no lo da la asignación, lo da el turno.

### 4.3 Los dos caminos de la sucursal

Existen dos mecanismos distintos y conviene no confundirlos:

```
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  A) FILTRO DE VISTA          alpha/pedidos/src/js/navbar.js              │
  │     selectBranch() → $('#subsidiaries_id').val(id) → evento              │
  │                      'branchChanged' → app.onSubsidiaryChange()          │
  │     NO toca $_SESSION. Sólo cambia lo que se LISTA.                      │
  │     Incluye la opción "0 = Todas las sucursales".                        │
  │     Roles con acceso: 1, 2, 3 (canUseBranchFilter).                      │
  │     El backend lo respeta sólo en listOrders / checkDailyClosure;        │
  │     las escrituras siguen atadas a $_SESSION['SUB'].                     │
  └──────────────────────────────────────────────────────────────────────────┘
  ┌──────────────────────────────────────────────────────────────────────────┐
  │  B) SWITCH DE SESIÓN         alpha/menus/src/js/navbar.js                │
  │     switchSubsidiary() → ctrl-access.php :: switchSubsidiary()           │
  │     REESCRIBE $_SESSION['SUB'] y ['SUBSIDIARIE_NAME'].                   │
  │     Equivale a re-loguearse en otra sucursal sin teclear credenciales.   │
  │     Única validación: getSubsidiaryForCompany() → que la sucursal        │
  │     pertenezca a la MISMA EMPRESA. No consulta el pivote.                │
  └──────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Dónde deja rastro el usuario

```
  cash_shift.employee_id      →  quién abrió el turno            FK ✓
  daily_closure.employee_id   →  quién cerró el día              FK ✓
  daily_closure.reopened_by   →  quién reabrió el cierre         FK ✓
  order_histories.usr_users_id →  quién tocó el pedido           FK ✗  ← sin declarar
  order.cancelled_by          →  quién canceló el pedido         FK ✗  ← sin declarar
  order_payments.subsidiaries_id → dónde se cobró (cruzado)      FK ✗  ← sin declarar
```

Las tres últimas son relaciones reales que el código explota con JOIN pero que la BD no
protege. `evt_histories.usr_users_id` (módulo de Eventos, mismo patrón) **sí** tiene su FK
declarada: la omisión en Pedidos es un descuido, no una decisión.

---

## 5. Divergencia entre `alpha/` y `app/`

La reescritura que vive en [app/](../../../app/) ya corrigió el punto más importante de
esta capa. Vale documentarlo porque marca hacia dónde va la migración:

```
  ASPECTO                        alpha/  (producción hoy)      app/  (reescritura)
  ────────────────────────────   ──────────────────────────    ────────────────────────
  Sucursales del selector        TODAS las de la empresa       las del PIVOTE
                                 getSubsidiariesByCompany()    getBranchesByUser()
  Excepción                      —                             ROLID 5 ve todas
  Validación del switch          pertenece a la empresa        userHasAccessToBranch()
  Esquema operativo              hardcodeado                   $_SESSION['DB'] saneado
                                 'fayxzvov_reginas.'           con preg_replace
```

En `alpha` el pivote es documental; en `app` es la autorización.

---

## 6. Auto-revisión contra el checklist de `db-rules.md §7`

Leyenda: **✓** cumple · **✗** no cumple · **~** cumple parcialmente.

### 6.1 Clasificación (§7.1)

```
✓  Cada tabla tiene una clase clara (catálogo / maestro / pivote)
✓  Los pivotes N:M van SIN prefijo detail_ — usr_user_subsidiaries y
      module_company son exactamente lo que la regla pide
✓  No hay detail_ mal aplicado
```

### 6.2 Nombres (§7.2)

```
~  Tablas en singular
      En singular: usr_users(*) · subsidiaries(*) · module_company
      En plural:   customers · companies · modules · usr_rols ·
                   usr_user_subsidiaries
      (*) usr_users y subsidiaries son plurales de facto, pero están tan
      cableados en 90+ referencias cross-schema que renombrarlos no es una
      opción realista. Se documentan, no se corrigen.
✗  Prefijo usr_ inconsistente
      Lo llevan usr_users, usr_rols, usr_user_subsidiaries.
      No lo lleva subsidiaries, que es del mismo dominio.
✓  Columnas snake_case en inglés — sin excepciones en estas 9 tablas
✓  PK siempre `id INT AUTO_INCREMENT` en las 9 tablas
✗  FK = <tabla_referenciada>_id
      subsidiaries_id  ✓ (usr_users, usr_user_subsidiaries)
      companies_id     ✓ (subsidiaries)
      company_id       ✗ (module_company)  ← singular, misma tabla destino
      module_id        ✗ (module_company)  ← debería ser modules_id
      usr_users_id     ✓
      customers_id     ✓
      Además, quien consume esta capa desde fayxzvov_reginas usa un TERCER
      nombre para la sucursal: subsidiary_id (cash_shift, daily_closure).
✗  Nombres con typo: companies.rute (por 'route'), sin uso
```

### 6.3 Columnas obligatorias (§7.3)

```
~  `active TINYINT NOT NULL DEFAULT 1`               5 / 9 tablas
      Lo tienen: usr_users(TINYINT ✓) · usr_rols(SMALLINT) ·
                 subsidiaries(SMALLINT, DEFAULT 0 ✗) ·
                 usr_user_subsidiaries(INT, NULLABLE ✗) · admin.users(TINYINT,
                 DEFAULT 0 ✗)
      Falta en:  customers · companies · modules · module_company
      Ninguna lleva NOT NULL. subsidiaries y admin.users nacen INACTIVAS
      por DEFAULT 0, que es lo contrario de lo que pide la regla.
✗  Coexisten `active` y `enabled` sin que la regla contemple el segundo
      En usr_users y subsidiaries son DOS booleanos con semánticas distintas
      (poder entrar vs aparecer en listados). Funciona, pero no está escrito
      en ningún lado salvo en el código que los consulta — y ya produjo un
      estado incoherente real: 4 usuarios con active = 0 (dados de baja del
      listado del admin) que SIGUEN PUDIENDO INICIAR SESIÓN porque el login
      sólo mira enabled.
✗  `created_at DATETIME DEFAULT CURRENT_TIMESTAMP`   0 / 9 tablas
      Tres tablas usan `date_creation` (usr_users, subsidiaries,
      usr_user_subsidiaries) y las otras seis no registran el alta.
      Ninguna tiene DEFAULT CURRENT_TIMESTAMP: la escribe PHP, y en
      usr_user_subsidiaries el INSERT del pivote ni siquiera la manda
      (3 de 9 filas en NULL).
✗  `updated_at`                                      0 / 9 tablas
      No hay forma de saber cuándo cambió el rol o la sucursal de un usuario.
      Y a diferencia de los pedidos, aquí NO existe una tabla de bitácora
      equivalente a order_histories: los cambios de permisos no dejan rastro
      en ningún lado.
```

### 6.4 Tipos de datos (§7.4)

```
✗  Nombres cortos en VARCHAR, nunca TEXT
      usr_users.user       TEXT   ← es un correo, VARCHAR(255) + UNIQUE
      usr_users.fullname   TEXT
      usr_users.key        TEXT   ← es un MD5 de 32 chars fijos
      usr_users.key2       TEXT   ← columna muerta
      modules.name         TEXT · modules.route TEXT · modules.nickname TEXT
✗  Flags con el tipo equivocado
      usr_rols.active          SMALLINT   debería ser TINYINT
      usr_rols.superadmin      SMALLINT   columna muerta, NULL en 5/6 filas
      subsidiaries.active      SMALLINT   + DEFAULT 0
      subsidiaries.enabled     INT
      usr_user_subsidiaries.active INT NULLABLE
      usr_users.owner          SMALLINT
✗  companies.phone en DOUBLE — mismo defecto que order_clients.phone:
      pierde ceros a la izquierda y no admite +52 ni extensiones.
      usr_users.phone SÍ está en VARCHAR(255): la corrección ya existe
      en una tabla y no se propagó a la otra.
✓  Sin ENUM en esta capa
```

### 6.5 Foreign Keys (§7.5)

```
✓  9 FKs declaradas con CONSTRAINT explícito dentro de esta capa
✓  Cada FK tiene su KEY
✓  Política ON DELETE / ON UPDATE explícita y coherente:
      maestro → maestro   ON DELETE SET NULL   (no huerfaniza, desvincula)
      pivote  → maestro   ON DELETE CASCADE    (la asignación muere con
                                                el usuario o la sucursal)
✓  FK cross-schema real y funcional: subsidiaries.companies_id apunta a
      fayxzvov_admin.companies(id). InnoDB las soporta entre esquemas y aquí
      está bien usada.
✗  Tres relaciones del lado de Pedidos SIN FK declarada (§4.4):
      order_histories.usr_users_id · order.cancelled_by ·
      order_payments.subsidiaries_id
✗  Sin UNIQUE donde el negocio lo exige:
      usr_users(user)                          → correo duplicable en BD
      usr_user_subsidiaries(usr_users_id, subsidiaries_id) → asignación
                                                  duplicable
      module_company(module_id, company_id)    → módulo duplicable
      Hoy los tres están limpios, pero por disciplina del PHP, no por diseño.
```

### 6.6 Borrado (§7.6)

```
✗  Nunca DELETE físico
      syncUserSubsidiaries() hace DELETE + N INSERT sin transacción
      (mdl-admin.php:246). Si el proceso muere entre el DELETE y el primer
      INSERT, el usuario queda sin sucursales asignadas.
      El propio código ya lo sabe: hay un guard que se niega a sincronizar
      con lista vacía justamente para no dejarlo huérfano, y un fallback que
      reescribe usr_users.subsidiaries_id si la sucursal de arranque quedó
      fuera de la lista nueva.
      → _CRUD YA soporta transacciones (beginTransaction/commit/rollback);
        el comentario del código que dice lo contrario quedó desactualizado.
✓  La baja de usuarios y sucursales es lógica (active = 0), no física
~  Los listados filtran active = 1 — sólo donde la columna existe y
      con la ambigüedad enabled/active descrita en §6.3
```

### 6.7 DDL / esquema (§7.7)

```
✓  Engine InnoDB en las 9 tablas
✗  Charset y collation: latin1_swedish_ci en las 9
      Ya hay corrupción visible en datos reales: el COMMENT de usr_users.owner
      dice "Si es duse�o" y la sucursal 22 se llama "Regina�s cuarta".
      No es riesgo futuro: es daño presente en producción.
      Nota: el mismo esquema tiene DOS tablas en utf8mb4_unicode_ci
      (evt_check_products, evt_package_check), así que el esquema ya es mixto.
~  Versión del servidor: DISCREPANCIA A RESOLVER
      El servidor inspeccionado para este documento (WAMP local) es
      MySQL 8.0.31, que sí admite utf8mb4_0900_ai_ci.
      er-pedidos.md reporta MySQL 5.7.36, donde esa collation NO existe.
      Antes de planear la migración de charset hay que confirmar la versión
      de PRODUCCIÓN: en 8 se migra a utf8mb4_0900_ai_ci, en 5.7 el destino
      tiene que ser utf8mb4_unicode_ci.
✗  Contraseñas en MD5 sin salt (usr_users.key, admin.users.key)
      55 de 55 con longitud 32. MD5 está roto para hashing de contraseñas
      desde hace más de una década. La corrección es password_hash() +
      password_verify() con migración perezosa en el login.
      Fuera del checklist de db-rules, pero es el hallazgo más serio del
      documento.
~  Orden de columnas: id → negocio → fechas → status → FKs → active
      usr_users lo respeta casi por completo, salvo que usr_rols_id y
      subsidiaries_id aparecen intercalados (posición 2 y 7) en vez de al
      final. subsidiaries y usr_user_subsidiaries sí lo cumplen.
```

---

## 7. Resumen de la revisión

| Bloque del checklist | Resultado |
|---|---|
| Clasificación | ✓ clases claras · ✓ pivotes sin `detail_`, bien aplicado |
| Nombres | ~ plurales heredados · ✗ `usr_` inconsistente · ✗ 2 FK mal nombradas |
| Columnas obligatorias | ~ `active` en 5/9 (2 con DEFAULT 0) · ✗ `created_at` 0/9 · ✗ `updated_at` 0/9 · ✗ `enabled` sin doctrina |
| Tipos | ✗ 7 columnas TEXT para nombres cortos · ✗ 6 flags mal tipados · ✗ `phone` en DOUBLE |
| Foreign keys | ✓ 9 declaradas con política explícita · ✗ 3 sin FK del lado de Pedidos · ✗ 0 UNIQUE de negocio |
| Borrado | ✓ baja lógica · ✗ DELETE+INSERT sin transacción en el pivote |
| Esquema | ✓ InnoDB · ✓ MySQL 8 · ✗ latin1 con corrupción ya presente · ✗ MD5 |

**Las cinco cosas que sí cuestan hoy**, en orden:

1. **Contraseñas en MD5 sin salt.** 55 cuentas, incluidos 19 administradores que además
   usan su contraseña como segundo factor para editar pedidos liquidados. El candado más
   sensible del módulo se apoya en el hash más débil disponible.
2. **`$_SESSION['DB']` se resuelve y se ignora.** `MPedidos` hardcodea `fayxzvov_reginas.`.
   La multi-tenencia está diseñada en la BD (`companies.name_bd`) y rota en el modelo. Hoy
   no explota porque sólo un tenant tiene Pedidos; el segundo tenant es el bug.
3. **El pivote `usr_user_subsidiaries` no autoriza nada en `alpha`.** Se administra, se
   lista, y cualquier usuario puede cambiarse a cualquier sucursal de su empresa igual.
   `app/` ya lo resolvió (§5); `alpha` sigue abierto.
4. **`latin1_swedish_ci` con daño presente.** No es deuda teórica: hay nombres de
   sucursales y comentarios de columna ya corruptos. Primer paso antes de planear nada:
   confirmar la versión real de producción (§6.7), porque decide la collation destino.
5. **`active` vs `enabled` sin doctrina escrita.** Ya produjo 4 usuarios "dados de baja"
   que siguen pudiendo entrar al sistema.

Las de nomenclatura (`usr_` inconsistente, `company_id` vs `companies_id`, plurales) son
ruido real pero barato: se viven, no urgen. Los plurales de `usr_users` y `subsidiaries`
están cableados en más de 90 referencias cross-schema y no son candidatos realistas a
renombre.

---

## 8. Qué sigue

Este entregable son las **cajas**, no el DDL. Bajo pedido explícito, el siguiente paso
puede ser:

- **Migración de MD5 a `password_hash()`** con verificación perezosa en el login
  (si el hash mide 32, valida MD5 y re-hashea al vuelo). Es la única de las cinco que
  se puede aplicar sin ventana de mantenimiento.
- **DDL de los UNIQUE faltantes** (`usr_users.user`, las dos parejas de pivote) más el
  saneo previo que verifique que no hay duplicados.
- **Migración de charset a `utf8mb4_0900_ai_ci`** de los tres esquemas, con reparación de
  los datos ya corruptos y plan de aplicación local → producción.
- **Cerrar el hueco del pivote en `alpha`**: portar `getBranchesByUser()` y
  `userHasAccessToBranch()` desde `app/access`, que ya están escritos y probados.
- **Cajas del módulo de Eventos (`evt_*`)**, que comparte esquema con esta capa de
  identidad y todavía no está documentado.
