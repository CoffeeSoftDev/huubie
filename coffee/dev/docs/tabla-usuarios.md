# Esquema de acceso — ERP Grupo Varoch

Base de datos local (WAMP): `rfwsmqex_gv_erp`
Prefijo usado en el modelo: `$this->bd = "rfwsmqex_gv_erp.";`

Alcance de esta entrega: solo el login (`acceso/mdl/mdl-access.php` → `getUserByCredentials()`).
Sin roles/permisos/secciones todavía (eso llega con el módulo de menú/sidebar).

## 1. Tablas (esquema actual — mismo schema)

```
┌───────────────────────────────────────────┐
│ companies                                  │
├───────────────────────────────────────────┤
│ id             PK   INT AUTO_INCREMENT     │
│ name                VARCHAR(150)           │
│ active              TINYINT(1)  DEFAULT 1  │
│ created_at          DATETIME              │
│ updated_at          DATETIME              │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│ branches                                   │
├───────────────────────────────────────────┤
│ id             PK   INT AUTO_INCREMENT     │
│ name                VARCHAR(150)           │
│ ubication           VARCHAR(200)  NULL     │
│ logo                VARCHAR(255)  NULL     │
│ active              TINYINT(1)  DEFAULT 1  │
│ created_at          DATETIME              │
│ updated_at          DATETIME              │
│ company_id     FK ──▶ companies.id         │
└───────────────────────────────────────────┘

┌───────────────────────────────────────────┐
│ users                                      │
├───────────────────────────────────────────┤
│ id             PK   INT AUTO_INCREMENT     │
│ name                VARCHAR(100)           │
│ last_name           VARCHAR(100)           │
│ email               VARCHAR(150)  UNIQUE   │
│ password            VARCHAR(255)           │
│ photo               VARCHAR(255)  NULL     │
│ is_owner            TINYINT(1)  DEFAULT 0  │
│ active              TINYINT(1)  DEFAULT 1  │
│ created_at          DATETIME              │
│ updated_at          DATETIME              │
│ company_id     FK ──▶ companies.id         │
│ branch_id      FK ──▶ branches.id          │
└───────────────────────────────────────────┘
```

Notas de convención aplicadas:
- FKs (`company_id`, `branch_id`) al final, después de `active`/timestamps.
- `active` (no `status` string) para activar/desactivar registros.
- `password` se guarda con `password_verify()` (bcrypt). No se replica el respaldo legacy MD5 de `inventory` (`key`) porque no hay usuarios heredados que migrar en este ERP nuevo.
- Sin prefijo `detail_`: ninguna de estas 3 tablas es renglón de una transacción raíz.

## 2. Diagrama de relaciones (todo en `rfwsmqex_gv_erp`, esquema actual)

```
┌─────────────┐        1        N   ┌─────────────┐        1        N   ┌─────────────┐
│  companies  │ ────────────────────▶│  branches   │ ────────────────────▶│    users    │
└─────────────┘   company_id (FK)   └─────────────┘    branch_id (FK)    └─────────────┘
                                                                                 │
                                                                    company_id (FK, directo)
                                                                                 │
                                                                                 ▼
                                                                          ┌─────────────┐
                                                                          │  companies  │
                                                                          └─────────────┘
```

`users` referencia a `companies` de forma directa (no solo a través de `branches`) para poder resolver la compañía del usuario aunque `branch_id` sea opcional a futuro.

## 3. Cardinalidades

| Relación | Cardinalidad | FK |
|---|---|---|
| companies → branches | 1 : N | `branches.company_id` |
| companies → users | 1 : N | `users.company_id` |
| branches → users | 1 : N | `users.branch_id` |

## 4. Qué resuelve `getUserByCredentials()` hoy

```
SELECT u.id, u.name, u.last_name, u.email, u.password, u.photo,
       u.is_owner, u.active,
       c.id AS company_id, c.name AS company,
       b.id AS branch_id, b.name AS branch
FROM   rfwsmqex_gv_erp.users u
LEFT JOIN rfwsmqex_gv_erp.companies c ON c.id = u.company_id
LEFT JOIN rfwsmqex_gv_erp.branches  b ON b.id = u.branch_id
WHERE  LOWER(u.email) = LOWER(?) AND u.active = 1
LIMIT  1
```

Login exitoso → `$_SESSION`/cookie con `IDU`, `company_id`, `company`, `branch_id`, `branch`, `user`, `is_owner`.

## 5. Pendiente para futuras transmutaciones (fuera de alcance hoy)

- `roles`, `permissions`, `sections`, `modules` — necesarios cuando se transmute el menú/sidebar real (hoy el hub es el placeholder `templates/gv-modulos.html`).
- Tabla pivote `users_branches` (N:M) si un usuario necesita acceso a más de una sucursal y un selector de cambio de sucursal (patrón `switchBranch()` de `inventory`). Hoy `users.branch_id` es 1:1 (sucursal por defecto).
- Seed de datos: crear 1 `company`, 1 `branch` y 1 `user` con password hasheado para poder probar el login real.
