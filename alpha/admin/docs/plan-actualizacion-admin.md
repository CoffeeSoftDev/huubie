# Admin de `alpha` y admin de `app`: qué hace cada uno y cómo actualizar alpha

> **Coffee Intelligence 🧠☕ · Análisis de módulo**
> 18 · ago · 2026 — esquemas `fayxzvov_alpha` + `fayxzvov_admin` inspeccionados en vivo.

Los dos módulos son el mismo código bifurcado. `app` avanzó en multi-sucursal por usuario y
en la capa visual; `alpha` avanzó en ruteo, navbar y borrado de fotos. Este documento
reconcilia ambos **sobre la base de `alpha`**.

---

## Índice

| # | Sección |
|---|---|
| 00 | [Veredicto en una página](#00--veredicto-en-una-página) |
| 01 | [Qué es cada uno](#01--qué-es-cada-uno) |
| 02 | [Las tablas](#02--las-tablas) |
| 03 | [Diagrama de relaciones](#03--diagrama-de-relaciones) |
| 04 | [La brecha real entre alpha y app](#04--la-brecha-real-entre-alpha-y-app) |
| 05 | [Riesgos y bugs a resolver antes de portar](#05--riesgos-y-bugs-a-resolver-antes-de-portar) |
| 06 | [Plan de actualización paso a paso](#06--plan-de-actualización-paso-a-paso) |
| 07 | [Verificación](#07--verificación) |

---

## 00 · Veredicto en una página

El módulo **Admin** es la consola de configuración del tenant: datos de la empresa, usuarios,
sucursales, cláusulas, y un catálogo aparte de paquetes/productos/clasificaciones. Existe dos
veces en el repo, con la *misma* base de datos detrás.

**✅ La buena noticia**
La tabla pivote `usr_user_subsidiaries` **ya existe en la BD de alpha** y ya tiene 9 filas
reales. La migración de esquema no hay que hacerla: está hecha. Lo que falta es el código de
alpha y el *backfill* de los usuarios viejos.

**🔴 La mala noticia**
**47 de los 51 usuarios activos no tienen fila en el pivote.** El listado de usuarios de `app`
usa `INNER JOIN usr_user_subsidiaries`. Si copias ese código a alpha tal cual, esos 47
usuarios desaparecen de la pantalla. El backfill va *antes* del código, no después.

**⚠️ Y un bug que no se debe copiar**
El `createUser` de `app` está roto: nunca logra insertar en el pivote. El `error.log` del
propio módulo lo documenta tres veces con `FK constraint fails`. Hay que arreglarlo al
portarlo, no después.

El resto es trabajo ordenado: cinco fases, catorce pasos, sin cambios de esquema salvo un
índice único que hoy falta.

---

## 01 · Qué es cada uno

Ambos son módulos coffeeSoft clásicos: una página PHP que solo carga plugins, un
`ctrl-*.php` que responde a un `opc` por POST, un `mdl-*.php` que habla con MySQL, y un JS que
arma la vista. **Cuatro pantallas independientes, no una sola.**

| Pantalla | Trío ctrl / mdl / js | Qué administra | Filtra por |
|---|---|---|---|
| `index.php` | `-admin` | 4 tabs: Empresa · Usuarios · Sucursal · Cláusulas | `COMPANY_ID` |
| `paquetes.php` | `-paquetes` | 3 tabs: Paquetes · Productos · Clasificaciones | `SUB` + BD por empresa |
| `perfil.php` | `-perfil` | Datos del usuario en sesión y su foto | `USR` |
| `empresas.php` | `-empresa` | Alta de empresas (vista de superadmin) | — |

### El detalle que importa: cada pantalla apunta a un ámbito distinto

Admin trabaja a nivel **empresa** (`$_SESSION['COMPANY_ID']`): ves todos los usuarios y todas
las sucursales de tu empresa. Paquetes trabaja a nivel **sucursal** (`$_SESSION['SUB']`) y
además contra una **base de datos distinta por empresa**, resuelta en caliente:

```php
// alpha/admin/mdl/mdl-paquetes.php:12
$this->bd = "{$_SESSION['DB']}.";   // companies.name_bd → prefijo de esquema
```

Por eso `index.php` de alpha declara `window.HIDE_SUBSIDIARY_SWITCH = true`: Admin es vista
global, el selector de sucursal de la navbar no aplica. Paquetes sí depende de la sucursal
activa.

---

## 02 · Las tablas

Tres esquemas en juego. `fayxzvov_admin` es el maestro corporativo (compartido entre
productos), `fayxzvov_alpha` es el tenant operativo, y el esquema de paquetes es variable por
empresa.

### Maestro corporativo · `fayxzvov_admin`

```
┌─ companies ─────────────────────── catálogo raíz del tenant ─┐
│ id            int         PK                                 │
│ social_name   varchar(255)  razón social                     │
│ address       text                                           │
│ rfc           varchar(20)                                    │
│ logo          text          ruta relativa del archivo        │
│ rute          varchar(255)                                   │
│ ubication     text                                           │
│ phone         double                                         │
│ name_bd       varchar(255)  → esquema de datos de la empresa │
│ enabled       tinyint       borrado lógico                   │
│ customers_id  int           FK → customers.id                │
└──────────────────────────────────────────────────────────────┘

┌─ customers ─┐  ┌─ modules ─┐  ┌─ module_company ─┐  ┌─ users ─┐
   dueño de la     catálogo de     pivote N:M que        (no usado
   empresa         módulos del     habilita módulos      por Admin)
                   producto        por empresa
```

### Tenant operativo · `fayxzvov_alpha`

```
┌─ subsidiaries ───────────────────────────── sucursales ─┐
│ id            int        PK                             │
│ name          varchar(200)                              │
│ logo          text                                      │
│ ubication     text                                      │
│ enabled       int        default 1                      │
│ active        smallint   default 0  ← ojo, default 0    │
│ date_creation datetime                                  │
│ companies_id  int        FK → fayxzvov_admin.companies  │
└─────────────────────────────────────────────────────────┘

┌─ usr_users ─────────────────────────────────── usuarios ─┐
│ id              int      PK                              │
│ user            text     correo, login                   │
│ key / key2      text     MD5 (ver nota de seguridad)     │
│ fullname        text                                     │
│ photo           text     ruta relativa                   │
│ phone           varchar(255)                             │
│ birthday        date                                     │
│ date_creation   datetime                                 │
│ owner           smallint  1 = dueño                      │
│ enabled         tinyint   default 1  → usado en el LOGIN │
│ active          tinyint   default 1  → usado en LISTADO  │
│ usr_rols_id     int      FK → usr_rols.id                │
│ subsidiaries_id int      FK → subsidiaries.id    ⚠ legado│
└──────────────────────────────────────────────────────────┘

┌─ usr_user_subsidiaries ──────── pivote N:M · ya existe ─┐
│ id              int       PK                            │
│ active          int       ⚠ acepta NULL, 3 filas lo son │
│ date_creation   datetime  ⚠ acepta NULL                 │
│ usr_users_id    int       FK → usr_users     ON DELETE CASCADE
│ subsidiaries_id int       FK → subsidiaries  ON DELETE CASCADE
│ falta: UNIQUE (usr_users_id, subsidiaries_id)           │
└─────────────────────────────────────────────────────────┘

┌─ usr_rols ───────┐   ┌─ evt_clausules ──────────────────┐
│ id  rols         │   │ id, name, active, date_creation  │
│ 1   Administrador│   │ companies_id  FK → companies     │
│ 2   Cajero       │   └──────────────────────────────────┘
│ 3   Vendedor     │
│ 4   Lectura      │   El código excluye el rol 5 de todos
│ 5   SuperAdmin   │   los listados: WHERE id NOT IN (5)
│ 6   Supervisor   │
└──────────────────┘
```

### Catálogo de paquetes · esquema variable (`companies.name_bd`)

```
┌─ evt_package ────────────┐   ┌─ evt_products ──────────────┐
│ id                       │   │ id                          │
│ name          text       │   │ name              text      │
│ description   text       │   │ price             double    │
│ price_person  double     │   │ active            smallint  │
│ active        smallint   │   │ date_creation     datetime  │
│ date_creation datetime   │   │ id_classification int  ⚠    │
│ subsidiaries_id int      │   │ subsidiaries_id   int       │
└──────────────────────────┘   └─────────────────────────────┘
        │                                  │
        └────────┬─────────────────────────┘
                 ▼
┌─ evt_package_products ───── pivote paquete ↔ producto ─┐
│ id, quantity int, date_creation datetime               │
│ package_id  int   ⚠ sin sufijo _id de tabla plural     │
│ products_id int                                        │
└────────────────────────────────────────────────────────┘

┌─ evt_classification ──────────────────────────────────┐
│ id, classification text, active, date_creation        │
│ subsidiaries_id int                                   │
└───────────────────────────────────────────────────────┘
```

> **⚠️ Deuda de convención detectada**
>
> - `evt_products.id_classification` lleva el prefijo al revés — debería ser
>   `classification_id` y estar al final, después de `active`.
> - `usr_users` convive con dos banderas de estado: `enabled` (que gobierna el login) y
>   `active` (que gobierna el listado del admin). Se pueden desincronizar.
> - Las contraseñas son `MD5` sin sal. Fuera del alcance de esta actualización, pero conviene
>   anotarlo.
>
> Nada de esto bloquea el plan. Lo dejo señalado para que no se replique en tablas nuevas.

---

## 03 · Diagrama de relaciones

```
       fayxzvov_admin  (maestro corporativo, cross-schema)
       ╔════════════╗          ╔═════════╗       ╔═══════════════╗
       ║  customers ║◀┄┄┄┄┄┄┄┄┄║companies║──1:N─▶║ module_company║
       ╚════════════╝   1:N    ╚════╤════╝       ╚═══════╤═══════╝
                                    │                    │ N:1
                                    │                    ▼
                                    │              ╔═════════╗
                                    │              ║ modules ║
                                    │              ╚═════════╝
      ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┼┈┈┈┈ frontera de esquema ┈┈┈
                                    │
       fayxzvov_alpha  (tenant)     │
                    ┌───────────────┴──────────────┐
              1:N   ▼                        1:N   ▼
        ┌────────────────┐              ┌────────────────┐
        │  subsidiaries  │              │ evt_clausules  │
        └───┬────────┬───┘              └────────────────┘
            │        │
       1:N  │        │  N:M  (vía pivote)
            │        ▼
            │   ┌──────────────────────────┐
            │   │  usr_user_subsidiaries   │  ◀── el corazón del cambio
            │   └───────────┬──────────────┘
            │               │ N:M
            ▼               ▼
        ┌─────────────────────────┐        ┌───────────┐
        │       usr_users         │───N:1─▶│ usr_rols  │
        └─────────────────────────┘        └───────────┘
             │
             └── subsidiaries_id ──▶ subsidiaries   (FK legado, 1:1)
                 se conserva como "sucursal principal"

      ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

       {companies.name_bd}  (esquema de datos por empresa)

        ┌──────────────┐   N:M   ┌────────────────────┐
        │ evt_package  │◀───────▶│evt_package_products│
        └──────────────┘         └─────────┬──────────┘
                                           │ N:1
                                           ▼
        ┌─────────────────────┐   N:1  ┌──────────────┐
        │   evt_products      │───────▶│evt_classific.│
        └─────────────────────┘        └──────────────┘
              │                              │
              └── subsidiaries_id ┄┄┄┄┄┄┄┄┄┄┄┘  (cross-schema)
```

`╔═╗` esquema externo · `┌─┐` esquema actual · `──▶` FK de negocio · `┄▷` referencia cross-schema

### Cardinalidades

| Origen | Card. | Destino | Regla de negocio |
|---|---|---|---|
| `customers` | 1:N | `companies` | Un cliente puede tener varias empresas |
| `companies` | 1:N | `subsidiaries` | Una empresa, varias sucursales |
| `companies` | 1:N | `evt_clausules` | Cláusulas de contrato por empresa |
| `companies` | N:M | `modules` | Vía `module_company`; define el sidebar |
| `usr_users` | N:1 | `usr_rols` | Un rol por usuario, sin excepción |
| **`usr_users`** | **N:M** | **`subsidiaries`** | **Vía el pivote. Es el cambio.** |
| `usr_users` | N:1 | `subsidiaries` | FK directa legado = sucursal de arranque de sesión |
| `evt_package` | N:M | `evt_products` | Vía `evt_package_products` con cantidad |
| `evt_products` | N:1 | `evt_classification` | Un producto, una clasificación |

> **Por qué la FK directa no se borra**
>
> El login ([mdl-access.php](../../access/mdl/mdl-access.php)) hace
> `INNER JOIN subsidiaries ON usr_users.subsidiaries_id = subsidiaries.id` para resolver
> `$_SESSION['SUB']`. Si se anula esa columna, **nadie puede entrar al sistema.**
> El modelo correcto es convivencia: la FK directa pasa a significar «sucursal por defecto al
> iniciar sesión», el pivote significa «a qué sucursales tiene acceso».

---

## 04 · La brecha real entre alpha y app

Los diffs crudos dan ~6.000 líneas distintas, pero es ruido: **los archivos de `app` están en
CRLF y los de `alpha` en LF.** Ignorando fin de línea y espacios, la brecha real es esta:

| Archivo | Δ real | Quién va adelante |
|---|---:|---|
| `src/js/app.js` | 413 | 🟢 **app** — tabs, multi-sucursal, modales |
| `src/js/perfil.js` | 154 | 🟢 **app** — lucide, placeholder, quitar foto |
| `paquetes.php` | 116 | 🟡 mixto — app trae lucide, alpha trae rutas |
| `src/js/paquetes.js` | 94 | 🟢 **app** — tabs + filtros defensivos |
| `index.php` | 92 | 🟡 mixto |
| `perfil.php` | 93 | 🟡 mixto |
| `mdl/mdl-admin.php` | 78 | 🟢 **app** — pivote de sucursales |
| `ctrl/ctrl-admin.php` | 59 | 🟢 **app** — `deletePhotoCompany`, badges |
| `ctrl/ctrl-perfil.php` | 34 | 🔴 **alpha** — app *borró* `deletePhotoUser` |
| `ctrl/ctrl-paquetes.php` | 6 | 🟢 **app** — `?? '1'` defensivo |
| `mdl/mdl-paquetes.php` | 2 | 🟢 **app** — quita `session_start()` duplicado |
| `ctrl-empresa` · `mdl-empresa` · `mdl-perfil` | 0 | ⚪ idénticos |
| `usuarios.php` · `empresas.php` | 2 | ⚪ solo el título |

### Lo que app hizo bien y alpha necesita

1. **Multi-sucursal por usuario.** Chips seleccionables en el modal, badges por sucursal en la
   tabla, y un filtro «Todas las sucursales» en la barra.
2. **Tabs modernos.** Pasa de `simple_json_tab` a `tabLayout` con íconos lucide y contenedores
   `#container-tab-*`.
3. **Modales declarativos.** Reemplaza ~300 líneas de `bootbox.dialog` con HTML crudo por
   `createModalForm` + `json()`. Es la ganancia más grande en mantenibilidad.
4. **Quitar el logo de la empresa** (`deletePhotoCompany`), que en alpha no existe.
5. **Filtros defensivos** en paquetes: `$_POST['estado-paquetes'] ?? '1'` y el JS mandando el
   valor explícito.

### Lo que alpha hizo bien y no se debe perder

1. **Ruteo centralizado.** `_Rutes.php` con `PATH_BASE`/`PATH_ADMIN` y guardia de sesión.
   `app` tiene `/app/...` escrito a mano en cada etiqueta.
2. **Selector de sucursal en la navbar** con `switchSubsidiary`, evento `subsidiaryChanged` e
   indicador de turno de caja. `app` no lo tiene.
3. **`deletePhotoUser`** en `ctrl-perfil.php`. En `app` lo borraron y dejaron el JS
   llamándolo: **hoy está roto en app.**
4. **Rutas de imagen relativas** (`/alpha`). `app` hardcodea `https://huubie.com.mx/alpha`,
   que rompe en local.
5. **Sin basura de depuración.** El `ctrl-perfil` de app devuelve un `$usuario` suelto sin
   clave dentro del array de respuesta.

> **✅ Dirección del merge**
> La base es **alpha**. Se traen de `app` las cinco mejoras de la primera lista, corrigiendo
> sus bugs de paso. No se copia ningún archivo completo salvo donde el diff es cero.

---

## 05 · Riesgos y bugs a resolver antes de portar

### R1 · Los 47 usuarios huérfanos 🔴 bloqueante

Estado real de `fayxzvov_alpha` ahora mismo:

| Medida | Valor |
|---|---:|
| Usuarios totales | 55 |
| Usuarios activos | 51 |
| Filas en el pivote | 9 |
| Usuarios representados en el pivote | 4 |
| **Usuarios activos SIN fila en el pivote** | **47** |
| Sucursales | 8 |
| Empresas | 4 |

Solo tres usuarios son realmente multi-sucursal hoy (ids 81, 85 y 87). El `INNER JOIN` del
listado de `app` hace desaparecer a todo el que no tenga fila.

### R2 · `createUser` nunca asigna sucursales 🔴 bug en app

La causa está en la capa CRUD, no en el modelo:

```php
// alpha/conf/_CRUD.php · _CUD() cierra la conexión al terminar
$result = $stm->execute();
$this->disconnect();   // → $this->mysql = null; $connected = false
return $result;
```

```php
// app/admin/mdl/mdl-admin.php:181 · lo que pasa después
$result = $this->_CUD($query, $array);       // inserta y CIERRA
$this->connect();                            // abre una conexión NUEVA
$userId = $this->mysql->lastInsertId();      // ← devuelve 0 en la nueva
$this->syncUserSubsidiaries($userId, $ids);  // INSERT con id 0 → FK falla
```

Lo confirma el propio `app/admin/ctrl/error.log`, tres veces:

```
[ INFO ] :: INSERT INTO usr_user_subsidiaries (usr_users_id, subsidiaries_id) VALUES (?, ?)
[ ERROR C.U.D. ] :: SQLSTATE[23000] ... 1452 Cannot add or update a child row:
a foreign key constraint fails (usr_user_subsidiaries_ibfk_1)
```

La capa CRUD de alpha no expone `lastInsertId` ni transacciones (verificado: no hay
`beginTransaction` en `_CRUD.php` ni en `_Conect.php`). La salida limpia sin tocar la capa
compartida es releer el id por correo, que ya se validó como único justo antes de insertar.

### R3 · El pivote acepta duplicados ⚠️ preventivo

No hay `UNIQUE (usr_users_id, subsidiaries_id)`. Como `syncUserSubsidiaries` hace `DELETE` +
`INSERT` sin transacción, un fallo a media edición deja al usuario sin ninguna sucursal.

### R4 · `deletePhotoUser` partido en dos ⚠️ funcional

alpha tiene el controlador y no lo llama. app llama y no tiene el controlador. Al unir hay que
quedarse con *las dos* mitades.

### R5 · lucide no está cargado en alpha ⚠️ visual

Los tabs y la interfaz de `app` usan `data-lucide` y `lucide.createIcons()`. En alpha solo
`pedidos` y `order-visor` cargan la librería. Sin ese `<script>`, los tabs salen sin íconos y
`window.lucide` queda indefinido.

> **✅ Lo que NO es riesgo**
> `tabLayout`, `createModalForm`, `createLayout` y `swalQuestion` **ya existen** en
> [alpha/src/js/coffeeSoft.js](../../src/js/coffeeSoft.js) (líneas 2633, 1636, 4187 y 252).
> No hay que actualizar el framework.

---

## 06 · Plan de actualización paso a paso

Catorce pasos en cinco fases. Cada fase deja el sistema funcionando: se puede parar en
cualquier corte sin dejar alpha a medias.

### ── FASE A · Datos — nada de código todavía ──

#### Paso 01 · Respaldar antes de tocar nada

Volcado de las dos tablas que van a cambiar, más el esquema completo por seguridad.

```bash
mysqldump -uroot fayxzvov_alpha usr_users usr_user_subsidiaries \
  > backup_usuarios_$(date +%Y%m%d).sql
```

#### Paso 02 · Backfill: cada usuario hereda su sucursal actual

Esto resuelve **R1**. Copia la FK directa al pivote para todo el que no esté representado. Es
idempotente: se puede correr dos veces sin duplicar.

```sql
INSERT INTO usr_user_subsidiaries (usr_users_id, subsidiaries_id, active, date_creation)
SELECT u.id, u.subsidiaries_id, 1, NOW()
FROM usr_users u
WHERE u.subsidiaries_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM usr_user_subsidiaries p
      WHERE p.usr_users_id = u.id
        AND p.subsidiaries_id = u.subsidiaries_id
  );
```

Verificación obligatoria — debe devolver `0`:

```sql
SELECT COUNT(*) FROM usr_users u
WHERE u.active = 1
  AND NOT EXISTS (SELECT 1 FROM usr_user_subsidiaries p
                  WHERE p.usr_users_id = u.id);
```

> **⚠️ Atención**
> Si algún usuario activo tiene `subsidiaries_id NULL`, el backfill no lo cubre y seguirá
> invisible. Revíselos a mano antes de continuar:
> `SELECT id, user FROM usr_users WHERE active=1 AND subsidiaries_id IS NULL;`

#### Paso 03 · Normalizar el pivote y blindarlo

Resuelve **R3** y limpia las tres filas con `active NULL` que dejó la carga manual.

```sql
UPDATE usr_user_subsidiaries SET active = 1 WHERE active IS NULL;
UPDATE usr_user_subsidiaries SET date_creation = NOW() WHERE date_creation IS NULL;

-- correr solo si el SELECT de duplicados devuelve vacío
SELECT usr_users_id, subsidiaries_id, COUNT(*) n
FROM usr_user_subsidiaries GROUP BY 1,2 HAVING n > 1;

ALTER TABLE usr_user_subsidiaries
  ADD UNIQUE KEY uq_user_subsidiary (usr_users_id, subsidiaries_id);
```

**BD:** `fayxzvov_alpha.usr_user_subsidiaries`

---

### ── FASE B · Backend de alpha ──

#### Paso 04 · Listado de usuarios con sucursales agregadas

Portar `listUsers` de app, con dos correcciones: `LEFT JOIN` en vez de `INNER` (cinturón de
seguridad si algún usuario nuevo se queda sin pivote) y filtro opcional por sucursal.

```php
function listUsers($array, $filterSuc = null) {
    $query = "
    SELECT usr_users.id,
        (SELECT GROUP_CONCAT(s.name SEPARATOR ', ')
           FROM usr_user_subsidiaries us2
           INNER JOIN subsidiaries s ON s.id = us2.subsidiaries_id
          WHERE us2.usr_users_id = usr_users.id) AS sucursal,
        usr_users.fullname, usr_users.user, usr_users.active, usr_rols.rols
    FROM usr_users
    INNER JOIN usr_rols ON usr_users.usr_rols_id = usr_rols.id
    LEFT JOIN usr_user_subsidiaries uus ON uus.usr_users_id = usr_users.id
    LEFT JOIN subsidiaries sub_check ON sub_check.id = uus.subsidiaries_id
    INNER JOIN fayxzvov_admin.companies
            ON sub_check.companies_id = fayxzvov_admin.companies.id
    WHERE usr_users.active = ?
      AND usr_users.usr_rols_id NOT IN (5)
      AND fayxzvov_admin.companies.id = ?";
    // ...
    $query .= " GROUP BY usr_users.id";
}
```

**Editar:** [mdl-admin.php](../mdl/mdl-admin.php) · `listUsers` (línea 90)

#### Paso 05 · `getUserByID` devuelve la lista de sucursales

El modal de edición necesita saber *todas* las sucursales del usuario, no una. Portar la
versión de app tal cual: consulta el pivote y devuelve los ids en un string separado por comas.

**Editar:** [mdl-admin.php](../mdl/mdl-admin.php) · `getUserByID` (línea 112)

#### Paso 06 · `createUser` — con el fix de R2

Portar la firma de app pero **sin** el `lastInsertId()`. Se relee el id por correo, que acaba
de validarse como único:

```php
function createUser($array, $subsidiariesIds = []) {
    $query = "INSERT INTO usr_users
              (fullname, date_creation, usr_rols_id, user, subsidiaries_id, `key`)
              VALUE (?,?,?,?,?,MD5(?))";
    $result = $this->_CUD($query, $array);

    // NO: $this->connect(); $this->mysql->lastInsertId();  ← siempre 0
    if ($result && !empty($subsidiariesIds)) {
        $row = $this->_Select([
            'table'  => 'usr_users',
            'values' => 'id',
            'where'  => 'LOWER(user) = LOWER(?)',
            'data'   => [$array[3]]        // $array[3] = user
        ]);
        if (!empty($row)) $this->syncUserSubsidiaries($row[0]['id'], $subsidiariesIds);
    }
    return $result;
}
```

**Editar:** [mdl-admin.php](../mdl/mdl-admin.php) · `createUser` (línea 156)

#### Paso 07 · `updateUser` + `syncUserSubsidiaries`

Portar de app. `updateUser` deja de escribir `subsidiaries_id` en la fila del usuario y delega
al pivote.

> **⚠️ Decisión de diseño a tomar**
> Si `usr_users.subsidiaries_id` deja de actualizarse, un usuario puede terminar con su
> sucursal de login fuera de sus sucursales asignadas — y el `INNER JOIN` del login lo dejaría
> fuera. **Recomendación:** que `updateUser` siga escribiendo la primera sucursal de la lista
> en `subsidiaries_id`, para que login y permisos nunca se contradigan.

**Editar:** [mdl-admin.php](../mdl/mdl-admin.php) · `updateUser` (línea 166) · **Añadir:** `syncUserSubsidiaries`

#### Paso 08 · Controlador: badges, filtro y primera sucursal

Portar de app tres cambios en `ctrl-admin.php`: `lsUsers` lee `filterSucursal` y pinta un badge
por sucursal; `addUser` parte `subsidiaries_id` por comas y pasa la lista completa. Añadir aquí
también la validación de correo que `addUser` de alpha no tiene (`editUser` sí la tiene, es una
asimetría heredada).

**Editar:** [ctrl-admin.php](../ctrl/ctrl-admin.php) · `lsUsers` (100) · `addUser` (167)

#### Paso 09 · `deletePhotoCompany`

Copiar el método de app (líneas 80–110 de su `ctrl-admin.php`) **ajustando la ruta**: app usa
`DOCUMENT_ROOT . '/coffee'`, alpha debe usar `DOCUMENT_ROOT . '/alpha'` — de lo contrario borra
en la carpeta equivocada, o en ninguna.

**Añadir a:** [ctrl-admin.php](../ctrl/ctrl-admin.php)

---

### ── FASE C · Frontend ──

#### Paso 10 · Cargar lucide en las tres páginas

Resuelve **R5**. Una línea antes de `session.js`, en cada una:

```html
<script src="https://unpkg.com/lucide@latest"></script>
```

**Editar:** [index.php](../index.php) · [paquetes.php](../paquetes.php) · [perfil.php](../perfil.php)
*(no `empresas.php`: no usa tabs)*

#### Paso 11 · `app.js`: layout con `tabLayout` y render perezoso

El cambio grande. De `primaryLayout` + `simple_json_tab` a `createLayout` + `tabLayout`. Los
contenedores pasan de `#tab-usuarios` a `#container-tab-usuarios` — hay que renombrar en las
cuatro clases (`Company`, `Usuarios`, `Sucursales`, `Clausulas`).

Aprovechar para aplicar el **render perezoso** de la convención: que `renderActiveTab()` pinte
solo el tab activo y los demás se creen en su `onClick`, en lugar de renderizar los cuatro de
golpe como hace app.

**Editar:** [app.js](../src/js/app.js) · `layout` · `renderTabs` · `renderActiveTab`

#### Paso 12 · Modal de usuario: de bootbox crudo a `createModalForm` + chips

Elimina ~300 líneas de HTML dentro del JS (que además viola la regla de «nada de HTML crudo en
métodos JS»). Portar de app: `json(mode)`, `add()`, `editar()`, `_renderSucursalChips`,
`_injectChips`. Añadir el select `filterSucursal` a la barra de filtros.

> **Ajuste de convención al portar**
> Renombrar `_renderSucursalChips` → `renderSucursalChips` y `_injectChips` → `injectChips`.
> El guion bajo se reserva para métodos heredados del framework.

**Editar:** [app.js](../src/js/app.js) · clase `Usuarios`

#### Paso 13 · Logo de empresa y foto de perfil

Dos pantallas, mismo patrón: placeholder cuando no hay imagen, botón de quitar en hover,
confirmación con `swalQuestion`.

- **`app.js` · `layoutCompanies`:** portar de app, pero conservando la ruta relativa de alpha
  en vez del `https://huubie.com.mx` hardcodeado.
- **`perfil.js`:** portar el bloque de foto de app, que *ya* llama a `deletePhotoUser` — y en
  alpha ese controlador sí existe. Esto cierra **R4** del lado correcto.

**Editar:** [app.js](../src/js/app.js) · [perfil.js](../src/js/perfil.js)

#### Paso 14 · Paquetes: tabs, filtros defensivos y `session_start` duplicado

- `paquetes.js`: `tabLayout` + renombrar a `#container-tab-*` + mandar el estado explícito en
  cada `ls*()`.
- `ctrl-paquetes.php`: añadir `?? '1'` en las tres lecturas de estado (líneas 14, 204 y 339).
- `mdl-paquetes.php`: quitar el `session_start()` de la línea 4 — el controlador ya lo hace y
  PHP emite *notice* por la sesión repetida.

**Editar:** [paquetes.js](../src/js/paquetes.js) · [ctrl-paquetes.php](../ctrl/ctrl-paquetes.php) · [mdl-paquetes.php](../mdl/mdl-paquetes.php)

---

### ── FASE D · Opcional, cuando lo anterior esté estable ──

#### Aprovechar el multi-sucursal en el resto de alpha

Una vez que Admin asigna varias sucursales, el `switchSubsidiary` de la navbar debería validar
contra el pivote en vez de contra la empresa entera. Hoy `getSubsidiaryForCompany` permite
cambiar a *cualquier* sucursal de la empresa; con el pivote, se puede limitar a las asignadas.

**Tocaría:** [mdl-access.php](../../access/mdl/mdl-access.php) · `getSubsidiariesByCompany` · `getSubsidiaryForCompany`

#### Unificar el ruteo de `empresas.php`

`alpha/admin/empresas.php` es la única página del módulo que no usa `_Rutes.php`: lleva rutas
`../src/...` escritas a mano y por lo tanto tampoco tiene la guardia de sesión. Alinearla con
las otras tres.

**Editar:** [empresas.php](../empresas.php)

---

## 07 · Verificación

Qué probar al cerrar cada fase, en orden. Si algo de esto falla, no se pasa a la siguiente.

| Tras | Prueba | Resultado esperado |
|---|---|---|
| **A** | Consulta de huérfanos del paso 02 | `0` filas |
| **A** | Login con un usuario cualquiera | Entra igual que antes — la Fase A no toca el login |
| **B** | Listado de usuarios en Admin | **51 activos**, no 4 |
| **B** | Crear usuario con 2 sucursales | 2 filas nuevas en el pivote · `error.log` sin `1452` |
| **B** | Editar usuario quitando una sucursal | El pivote queda con las que se dejaron, ni una más |
| **B** | Login del usuario recién editado | Entra y su `SUB` está entre sus sucursales |
| **C** | Los 4 tabs de Admin y los 3 de Paquetes | Con ícono, y el contenido carga al hacer clic |
| **C** | Filtro «Todas las sucursales» | Filtra sin recargar; vacío = todos |
| **C** | Subir y quitar logo de empresa | El archivo desaparece de `/alpha`, no de `/coffee` |
| **C** | Quitar foto de perfil | Vuelve el placeholder · sin 500 en la consola |
| **C** | Paquetes con y sin filtro de estado | Sin *notice* de índice indefinido en el log |

> **Sobre el fin de línea**
> No copies archivos completos de `app` a `alpha`: arrastrarías CRLF a un repo en LF y el
> próximo diff volvería a dar seis mil líneas de ruido. Porta los bloques a mano o normaliza
> con `dos2unix` después de copiar.

> **✅ Qué queda igual**
> `ctrl-empresa.php`, `mdl-empresa.php` y `mdl-perfil.php` son byte a byte idénticos entre las
> dos ramas. No se tocan en todo el plan.
