# Módulo de Permisos — Huubie / alpha

> Documento Coffee Intelligence del módulo que saca los permisos de Pedidos del código
> y los pone en una pantalla del administrador.
> Esquema: `fayxzvov_alpha` · Estado: **BD creada y sembrada** · Pantalla: pendiente

---

## 🔍 Inspección

**De dónde salió el modelo.** No de un template: de leer los permisos que ya existen
escritos a mano en el código.

| Fuente | Qué aportó |
|---|---|
| `alpha/pedidos/ctrl/ctrl-pedidos.php` | 12 puntos con `ROLID` |
| `alpha/pedidos/ctrl/ctrl-cierre.php` | Cierre, corte pendiente y recálculo |
| `alpha/pedidos/ctrl/ctrl-pedidos-catalogo.php` | Baja de partida bloqueada |
| `alpha/pedidos/calendario/ctrl/ctrl-calendario.php` | Perfil de consulta del supervisor |
| `app.js`, `pedidos-catalogo.js`, `calendario-pedidos.js` | Botones condicionados por rol |
| `fayxzvov_alpha.usr_rols` / `usr_users` | Roles reales y usuarios por rol |

- **Catálogo detectado:** el permiso en sí (17 acciones nombrables).
- **Pivote detectado:** rol ↔ permiso, con un atributo propio (el alcance).
- **Maestros:** `usr_rols` ya existe; no se duplica ni se toca.
- **Estados / flujo:** ninguno. Un permiso se tiene o no; no hay ciclo de aprobación.

**Lo que la inspección corrigió del inventario inicial.** Dos "permisos" no lo eran:

```
Ver todas las sucursales        ──▶  es el ALCANCE de "Ver pedidos"
Operar pedidos de otra sucursal ──▶  es el ALCANCE de "Editar pedido"
```

Al modelarlos como alcance hubo que hacer explícitos `view_order` y `edit_order`, que
en el código viven implícitos. El total se mantiene en 17, pero ahora ninguno describe
"hasta dónde" — eso lo dice el `scope`.

---

## 🗂 Modelo lógico

```
╔══════════════════════════════════════════════════════════════════╗
║  usr_permissions                        CATÁLOGO | 17 filas      ║
╠══════════════════════════════════════════════════════════════════╣
║  id             INT           PK AUTO_INCREMENT                  ║
║  code           VARCHAR(60)   UNIQUE   ← lo que lee can()        ║
║  name           VARCHAR(120)           ← "Eliminar pago"         ║
║  description    VARCHAR(255)  NULL     ← la condición, la letra  ║
║                                           chica del permiso      ║
║  family         VARCHAR(60)            ← agrupa el acordeón      ║
║  is_dangerous   SMALLINT      DEF 0    ← bloque "no se deshace"  ║
║  has_scope      SMALLINT      DEF 0    ← admite own / all        ║
║  sort           SMALLINT      DEF 0                              ║
║  active         SMALLINT      DEF 1                              ║
║  date_creation  DATETIME      CURRENT_TIMESTAMP                  ║
╚══════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────┐
│  usr_rol_permissions                    PIVOTE N:M | 41 filas    │
├──────────────────────────────────────────────────────────────────┤
│  id              INT              PK AUTO_INCREMENT              │
│  scope           ENUM('own','all') DEF 'all'  ← el atributo que  │
│                                     hace que este pivote no sea  │
│                                     un pivote puro               │
│  active          SMALLINT         DEF 1                          │
│  date_creation   DATETIME         CURRENT_TIMESTAMP              │
│  usr_rols_id     INT   ──▶ usr_rols(id)                          │
│  permissions_id  INT   ──▶ usr_permissions(id)                   │
│  UNIQUE (usr_rols_id, permissions_id)                            │
└──────────────────────────────────────────────────────────────────┘
```

### Diagrama de relaciones

```
  ═══════════════ fayxzvov_alpha (esquema actual) ═══════════════

   ╔═══════════════════╗                  ╔══════════════════════╗
   ║   usr_rols        ║                  ║  usr_permissions     ║
   ║   1 Administrador ║                  ║  17 acciones         ║
   ║   2 Cajero        ║                  ║  code / family       ║
   ║   3 Vendedor      ║                  ║  is_dangerous        ║
   ║   4 Lectura       ║                  ║  has_scope           ║
   ║   5 SuperAdmin ⚠  ║                  ╚══════════╤═══════════╝
   ║   6 Supervisor    ║                             │ 1
   ╚═════════╤═════════╝                             │
             │ 1                                     │
             │                ┌────────────────────┐ │
             └───────────────▶│ usr_rol_permissions│◀┘
                            N │  scope: own | all  │ N
                              └────────────────────┘
             ▲
             │ N
   ╔═════════╧═════════╗
   ║   usr_users       ║   El permiso se resuelve por el ROL del
   ║   usr_rols_id     ║   usuario, no por el usuario.
   ╚═══════════════════╝

  ──▶ FK de negocio
  ⚠  rol inactivo, excluido de los listados con NOT IN (5)
```

### Cardinalidades

| Origen | Cardinalidad | Destino | Regla |
|---|---|---|---|
| `usr_rols` | 1 : N | `usr_rol_permissions` | Un rol tiene N permisos concedidos |
| `usr_permissions` | 1 : N | `usr_rol_permissions` | Un permiso lo pueden tener N roles |
| `usr_rols` | N : M | `usr_permissions` | Resuelta por el pivote, con `scope` propio |
| `usr_users` | N : 1 | `usr_rols` | Ya existente. El usuario hereda del rol |

### La regla de las tres posiciones

```
   sin fila            →  No lo puede hacer
   fila + scope 'own'  →  Solo en su sucursal
   fila + scope 'all'  →  En cualquier sucursal
```

Para los 11 permisos con `has_scope = 0`, el `scope` queda en `'all'` y la pantalla
ni lo muestra. Solo 6 permisos admiten las tres posiciones: `view_order`,
`create_order`, `edit_order`, `register_payment`, `manage_shift`, `close_day`.

---

## 📊 Estado sembrado

Se migraron los permisos **exactos** que cada rol tiene hoy en el código, para que el
primer día nadie note el cambio.

| Rol | Permisos | Solo su sucursal | Todas |
|---|---:|---:|---:|
| 1 · Administrador | 17 | 0 | 17 |
| 2 · Cajero | 8 | 5 | 3 |
| 3 · Vendedor | 7 | 5 | 2 |
| 4 · Lectura | 1 | 1 | 0 |
| 5 · SuperAdmin | 0 | — | — |
| 6 · Supervisor | 8 | 0 | 8 |

El supervisor sale con alcance total en sus 8: su trabajo es mirar y corregir en
cualquier sucursal, no operar la propia.

**El rol 7 quedó fuera.** Está autorizado en 15 lugares del código y no existe en
`usr_rols`. Crearlo habría sido inventar un rol; descartarlo es reversible. Si hace
falta, se crea desde la pantalla y se le asignan permisos ahí.

---

## ✅ DDL

> Ya ejecutado en `fayxzvov_alpha`. Se deja para reproducirlo en el servidor.

```sql
CREATE TABLE usr_permissions (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    code          VARCHAR(60)  NOT NULL,
    name          VARCHAR(120) NOT NULL,
    description   VARCHAR(255) NULL,
    family        VARCHAR(60)  NOT NULL,
    is_dangerous  SMALLINT     NOT NULL DEFAULT 0,
    has_scope     SMALLINT     NOT NULL DEFAULT 0,
    sort          SMALLINT     NOT NULL DEFAULT 0,
    active        SMALLINT     NOT NULL DEFAULT 1,
    date_creation DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_permission_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE usr_rol_permissions (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    scope          ENUM('own','all') NOT NULL DEFAULT 'all',
    active         SMALLINT NOT NULL DEFAULT 1,
    date_creation  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    usr_rols_id    INT NOT NULL,
    permissions_id INT NOT NULL,
    UNIQUE KEY uq_rol_permission (usr_rols_id, permissions_id),
    KEY idx_rol (usr_rols_id),
    CONSTRAINT fk_rolperm_rol  FOREIGN KEY (usr_rols_id)    REFERENCES usr_rols(id),
    CONSTRAINT fk_rolperm_perm FOREIGN KEY (permissions_id) REFERENCES usr_permissions(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

Los scripts completos (catálogo + siembra por rol) quedaron en
`alpha/admin/docs/sql/` para correrlos en el servidor.

---

## 🧪 Checklist db-rules §7

| Ítem | Estado | Nota |
|---|---|---|
| §7.1 Clasificación | ✅ | Catálogo + pivote con atributo |
| §7.2 Nombres — snake_case, inglés | ✅ | |
| §7.2 Nombres — tabla en **singular** | ⚠️ **desviado** | Se usó plural (`usr_permissions`) por coherencia con las hermanas del esquema: `usr_rols`, `usr_users`, `usr_user_subsidiaries`. Una tabla singular junto a ellas se leería como error, no como regla |
| §7.2 PK `id`, FKs `<tabla>_id` | ✅ | |
| §7.3 `id` AUTO_INCREMENT | ✅ | Corregido: quedó en posición 1, como en las hermanas |
| §7.3 `active` | ✅ | `SMALLINT`, como el resto del esquema (la regla pide TINYINT) |
| §7.3 `created_at` / `updated_at` | ⚠️ **desviado** | Se usó `date_creation`, que es el nombre en todo `fayxzvov_alpha`. Sin `updated_at`: ver pendientes |
| §7.3 `user_id` si registra acción de usuario | ❌ **falta** | Ver "Bitácora" en pendientes |
| §7.4 Nombres en VARCHAR | ✅ | |
| §7.4 Estados extensibles → catálogo, no ENUM | ⚠️ **desviado** | `scope` es ENUM. No es un estado de negocio con ciclo sino un modificador cerrado de dos posiciones. Si algún día aparece un tercer alcance (por zona, por región) hay que convertirlo a catálogo |
| §7.5 FK con CONSTRAINT explícito | ✅ | Nombres `fk_rolperm_*` en vez de `_ibfk_n` |
| §7.5 FK con su KEY | ✅ | |
| §7.5 ON DELETE / ON UPDATE | ⚠️ **pendiente** | Sin política declarada. Al ser pivote sobre catálogos, corresponde `CASCADE / CASCADE` |
| §7.6 Nunca DELETE físico | ✅ | Excepción de pivote: se puede borrar la fila al apagar un permiso |
| §7.7 InnoDB + utf8mb4_general_ci | ✅ | Collation explícita, sin `0900_ai_ci` |
| §7.7 Orden de columnas | ✅ | `id` → negocio → `active` → fecha → FKs |

**Tres cosas que corregir antes de subir al servidor:** la política `ON DELETE`, el
`updated_at` y el `user_id` de la bitácora. Las tres son `ALTER TABLE`, no rehacer.

---

## 🧩 El módulo (reglas CoffeeSoft / CoffeeIA)

### Arquitectura tripartita

```
alpha/admin/src/js/permisos.js      →  class Permisos extends Templates
alpha/admin/ctrl/ctrl-permisos.php  →  class Permisos extends MPermisos
alpha/admin/mdl/mdl-permisos.php    →  class MPermisos extends CRUD
```

Par `ctrl` + `mdl` **propio y autocontenido**, no dentro de `ctrl-admin.php`. Es el
mismo criterio con el que se partió el monolito de inventarios en pares
`ctrl-pos-*` / `mdl-pos-*`.

**Sin `index.php` propio.** El módulo entra como quinto tab de
`alpha/admin/index.php`, junto a Empresa, Usuarios, Sucursal y Cláusulas.

### Nomenclatura encadenada (obligatoria)

| Front (JS) | Controlador | Modelo |
|---|---|---|
| `lsPermissions()` | `lsPermissions()` | `listPermissions()` |
| `lsRoles()` | `lsRoles()` | `listRoles()` |
| `savePermissions()` | `savePermissions()` | `createRolPermission()` / `deleteRolPermission()` |
| `init()` | `init()` | — |

### La clase JS

`Permisos extends Templates` directo, sin pasar por `App`: el `App` de admin solo
orquesta tabs y no comparte nada reutilizable. Render perezoso — el tab se pinta en
su `onClick`, no en el arranque.

```
init()      →  render()
render()    →  layout() + lsRoles() + bindEvents()
layout()    →  panel de roles (izquierda) + acordeón de familias (derecha)
selectRole(id)  →  pinta la ficha del rol elegido
toggleFamily(f) →  abre o cierra una familia
togglePerm(code)→  marca el cambio en memoria, no guarda
saveChanges()   →  manda todo el set de una vez
```

**Theme `dark`**, por ser Huubie: `tabLayout` dark, contenedor `bg-[#1F2A37]`,
tarjetas `bg-[#1E293B]`, bordes `slate-700`.

### El controlador

```php
init()             // roles + permisos + lo que ya tiene cada rol, en una llamada
lsRoles()          // roles activos con su conteo de permisos y de usuarios
lsPermissions()    // catálogo agrupado por family, con is_dangerous y has_scope
savePermissions()  // recibe el set completo del rol y lo reemplaza en transacción
```

`savePermissions()` reemplaza el set entero en lugar de aplicar altas y bajas sueltas:
la pantalla ya tiene el estado final y así no hay forma de que queden a medias. Va en
transacción — `_Conect` / `_CRUD` ya soportan `beginTransaction` / `commit` / `rollback`.

**Dos candados en el controlador, no en la pantalla:**

1. Solo quien tenga permiso de administrar permisos entra. Mientras el módulo no se
   administre a sí mismo, es `ROLID == 1`.
2. **El rol Administrador no se puede editar.** Si se pudiera vaciar, el sistema queda
   sin nadie que lo administre y no hay pantalla desde donde arreglarlo.

### La función `can()`

Helper global, fuera de la clase, como los demás helpers de render del proyecto:

```php
can('edit_order')            // ¿el rol de sesión tiene el permiso?
can('edit_order', $subId)    // ¿lo tiene sobre esa sucursal?
```

Lee los permisos del rol una vez y los cachea en `$_SESSION`. Con el segundo parámetro
resuelve el alcance: `'all'` pasa siempre; `'own'` solo si la sucursal coincide con la
del usuario. Sustituye los `in_array($_SESSION['ROLID'], [...])` repartidos hoy en seis
archivos.

> Sin guion bajo al inicio: `can()`, no `_can()`. El `_` se reserva a los métodos
> heredados del framework (`_Read`, `_Update`).

---

## 💡 Notas y pendientes

**La pantalla elegida es B2 — plegada por familia.** Cinco renglones cerrados con su
contador, se abre solo la familia que se va a tocar, y los cinco permisos irreversibles
quedan **fuera del acordeón**, siempre visibles. Se eligió sobre la versión desplegada
porque estos 17 permisos son solo los de Pedidos: cuando entren inventario o
facturación, la lista abierta se vuelve interminable y el acordeón solo suma renglones.

**Por qué esto hacía falta.** Hoy 13 de 18 usuarios activos son Administrador. Sin
permisos finos la única palanca es el rol completo, así que la salida fácil es darlo.

**Pendientes en orden:**

1. Los tres `ALTER TABLE` del checklist: `ON DELETE`, `updated_at`, `user_id`.
2. La pantalla B2 en el admin.
3. `can()` y la migración de los seis archivos. Se puede hacer permiso por permiso:
   mientras uno no esté migrado, sigue funcionando su `in_array`.
4. **Bitácora.** Quién cambió qué permiso y cuándo. `logHistory()` ya existe en el
   módulo de pedidos y el patrón se puede reusar.
5. Decidir el rol 7: crearlo de verdad o limpiar sus 15 autorizaciones del código.

**Extensiones que el modelo ya aguanta sin migrar:**

- Permisos de otros módulos: se agregan al catálogo con otra `family`.
- Permisos por persona (la propuesta D): una tabla `usr_user_permissions` con la misma
  forma, que se suma a lo que da el rol.
- Niveles predefinidos (la propuesta C): un catálogo de plantillas que enciende un
  conjunto de `code`s.

**Lo que NO aguanta sin migrar:** un tercer alcance que no sea "su sucursal" o "todas".
Eso obliga a convertir el ENUM en catálogo.
