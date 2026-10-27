# `pos_order_discount` — DDL de creación

> **Esquema:** `fayxzvov_reginas` · **Engine:** `InnoDB` · **Charset:** `utf8mb4_0900_ai_ci`
> **Origen del modelo:** [db-modelo.md §7.4](db-modelo.md#L328-L351)

---

## 📌 Resumen

Detalle de descuentos aplicados a un ticket POS. Soporta dos modos:
- `scope='order'` → descuento sobre el ticket completo (`order_package_id IS NULL`).
- `scope='line'` → descuento sobre una línea específica (`order_package_id NOT NULL`).

---

## 🧩 Dependencias (prerequisitos)

Antes de ejecutar este DDL deben existir:

| # | Tabla | Esquema | Estado |
|:-:|---|---|---|
| 1 | `order` | `fayxzvov_reginas` | ✅ ya existe (legacy reusado) |
| 2 | `order_package` | `fayxzvov_reginas` | ✅ ya existe (legacy reusado) |
| 3 | `pos_discount_reason` | `fayxzvov_reginas` | ⚠️ debe crearse antes ([db-modelo.md §7.2](db-modelo.md#L290-L306)) |
| 4 | `usr_users` | `fayxzvov_alpha` | ✅ cross-schema (no se toca) |

---

## ✅ CREATE TABLE

```sql
USE `fayxzvov_reginas`;

CREATE TABLE `pos_order_discount` (
    -- PK
    `id`                        INT UNSIGNED   NOT NULL AUTO_INCREMENT,

    -- Columnas de negocio
    `scope`                     VARCHAR(10)    NOT NULL DEFAULT 'order'
                                COMMENT '''order'' = descuento al ticket | ''line'' = descuento a línea',
    `coupon_code`               VARCHAR(50)        NULL DEFAULT NULL
                                COMMENT 'Código de cupón aplicado, si existe',
    `notes`                     TEXT               NULL DEFAULT NULL
                                COMMENT 'Justificación libre',

    -- Montos
    `amount`                    DOUBLE         NOT NULL DEFAULT 0
                                COMMENT 'Monto descontado en pesos',
    `percentage`                DOUBLE         NOT NULL DEFAULT 0
                                COMMENT 'Porcentaje aplicado (0–100)',

    -- Fechas operativas
    `applied_at`                DATETIME       NOT NULL
                                COMMENT 'Momento real en que se aplicó el descuento',

    -- Auditoría
    `created_at`                DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`                DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP
                                                            ON UPDATE CURRENT_TIMESTAMP,

    -- Foreign Keys
    `order_id`                  INT UNSIGNED   NOT NULL,
    `order_package_id`          INT UNSIGNED       NULL DEFAULT NULL
                                COMMENT 'Solo cuando scope=''line''',
    `pos_discount_reason_id`    INT UNSIGNED       NULL DEFAULT NULL,
    `authorized_by_user_id`     INT UNSIGNED       NULL DEFAULT NULL
                                COMMENT 'Supervisor que autorizó (cross-schema fayxzvov_alpha.usr_users)',

    -- Soft-delete
    `active`                    TINYINT(1)     NOT NULL DEFAULT 1,

    -- Claves
    PRIMARY KEY (`id`),
    KEY `order_id`                (`order_id`),
    KEY `order_package_id`        (`order_package_id`),
    KEY `pos_discount_reason_id`  (`pos_discount_reason_id`),
    KEY `authorized_by_user_id`   (`authorized_by_user_id`),
    KEY `applied_at`              (`applied_at`),

    -- Restricciones FK
    CONSTRAINT `pos_order_discount_ibfk_1`
        FOREIGN KEY (`order_id`)
        REFERENCES `fayxzvov_reginas`.`order` (`id`)
        ON DELETE CASCADE
        ON UPDATE CASCADE,

    CONSTRAINT `pos_order_discount_ibfk_2`
        FOREIGN KEY (`order_package_id`)
        REFERENCES `fayxzvov_reginas`.`order_package` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT `pos_order_discount_ibfk_3`
        FOREIGN KEY (`pos_discount_reason_id`)
        REFERENCES `fayxzvov_reginas`.`pos_discount_reason` (`id`)
        ON DELETE SET NULL
        ON UPDATE CASCADE,

    CONSTRAINT `pos_order_discount_ibfk_4`
        FOREIGN KEY (`authorized_by_user_id`)
        REFERENCES `fayxzvov_alpha`.`usr_users` (`idUser`)
        ON DELETE SET NULL
        ON UPDATE CASCADE
)
ENGINE = InnoDB
DEFAULT CHARSET = utf8mb4
COLLATE = utf8mb4_0900_ai_ci
COMMENT = 'Descuentos POS a nivel ticket (scope=order) o línea (scope=line)';
```

---

## 🛡️ Regla de integridad (opcional — MySQL 8.0.16+)

Garantiza a nivel motor la regla declarada en [db-modelo.md:350](db-modelo.md#L350):

> `scope='order' ⇒ order_package_id IS NULL` · `scope='line' ⇒ order_package_id NOT NULL`

```sql
ALTER TABLE `pos_order_discount`
    ADD CONSTRAINT `chk_pos_order_discount_scope`
    CHECK (
        (scope = 'order' AND order_package_id IS NULL)
        OR
        (scope = 'line'  AND order_package_id IS NOT NULL)
    );
```

⚠️ Si la versión de MySQL es < 8.0.16, el `CHECK` se parsea pero no se aplica. En ese caso la regla debe vivir en la capa de aplicación (modelo PHP / trigger).

---

## 🔄 Rollback

```sql
DROP TABLE IF EXISTS `fayxzvov_reginas`.`pos_order_discount`;
```

> ⚠️ El `DROP` se ejecuta limpio porque `pos_order_discount` es **hoja** (nadie depende de ella). El `CASCADE` de su FK `order_id` solo afecta cuando se borra el `order` padre, no al revés.

---

## 🧪 Verificación post-creación

```sql
-- 1. Existencia y motor
SELECT TABLE_NAME, ENGINE, TABLE_COLLATION, TABLE_COMMENT
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_SCHEMA = 'fayxzvov_reginas'
  AND TABLE_NAME   = 'pos_order_discount';

-- 2. Estructura de columnas
SHOW FULL COLUMNS FROM `fayxzvov_reginas`.`pos_order_discount`;

-- 3. FKs cargadas correctamente
SELECT
    CONSTRAINT_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_SCHEMA,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'fayxzvov_reginas'
  AND TABLE_NAME   = 'pos_order_discount'
  AND REFERENCED_TABLE_NAME IS NOT NULL;

-- 4. Índices secundarios
SHOW INDEX FROM `fayxzvov_reginas`.`pos_order_discount`;
```

Resultado esperado: 4 FKs activas, 5 KEYs secundarias (`order_id`, `order_package_id`, `pos_discount_reason_id`, `authorized_by_user_id`, `applied_at`), 1 PK.

---

## 🧪 Checklist db-rules.md

- [x] §7.1 **Clasificación** — Detalle de transacción raíz (sin prefijo `detail_` porque `pos_` ya identifica el dominio, ver [db-modelo.md:310](db-modelo.md#L310)).
- [x] §7.2 **Nombres** — Singular, snake_case, inglés.
- [x] §7.3 **Columnas obligatorias** — `id`, `active`, `created_at`, `updated_at` ✅.
- [x] §7.4 **Tipos** — Montos en `DOUBLE`, FKs en `INT UNSIGNED`, fechas en `DATETIME`, `active` en `TINYINT(1)`.
- [x] §7.5 **FKs** — `CONSTRAINT` + `KEY` con mismo nombre, política `ON DELETE/UPDATE` documentada.
- [x] §7.6 **Borrado** — Soft-delete con `active = 0` (no DELETE físico).
- [x] §7.7 **DDL final** — Orden canónico: `id → negocio → montos → fechas → created_at → updated_at → FKs → active → KEYs → CONSTRAINTs`.

---

## 💡 Notas

- **Cross-schema:** `authorized_by_user_id` apunta a `fayxzvov_alpha.usr_users(idUser)` — maestro corporativo, **no se duplica**.
- **`scope` como VARCHAR:** declarado *"promovible a catálogo si crece"*. Si aparece un tercer valor (`'subtotal'`, `'group'`), migrar a tabla `pos_discount_scope` con FK.
- **Sin prefijo `detail_`:** convención justificada en [db-modelo.md:310](db-modelo.md#L310) — el prefijo `pos_` ya identifica el dominio.
- **`ON DELETE` granular:** `CASCADE` solo para `order_id` (un ticket borrado se lleva sus descuentos). El resto es `SET NULL` para preservar historia aunque el catálogo o el supervisor desaparezcan.
