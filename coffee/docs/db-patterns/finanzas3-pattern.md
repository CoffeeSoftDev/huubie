# Patrón de base de datos — referencia `finanzas3`

> Spec generativa extraída de `rfwsmqex_gvsl_finanzas3` (43 tablas, MySQL 8 / InnoDB).
> Sirve como guía para que un agente diseñe **nuevas bases de datos** siguiendo las mismas convenciones.

---

## 1. Filosofía general

La base modela un **dominio operativo orbital**: un evento raíz (en finanzas, `daily_closure`) al que se le adhieren múltiples detalles. Los catálogos viven aparte y se referencian por FK. Los maestros corporativos (UDN, usuarios, empleados) **no se duplican**: viven en otros esquemas y se referencian cross-schema.

Tres clases de tabla:

| Clase | Prefijo / forma | Rol |
|---|---|---|
| **Catálogo** | nombre singular (`bank`, `tax`, `customer`) | Listas mantenidas por usuario, pocas filas, vida larga |
| **Transacción raíz** | nombre singular (`daily_closure`, `purchase`, `withdrawal`, `turn`) | Evento operativo con timestamp y montos |
| **Detalle / pivote** | prefijo `detail_` (`detail_bank_account`, `detail_turn_tax`) | Líneas hijas de una transacción raíz, o relación N:M |

---

## 2. Convenciones de nomenclatura

### 2.1 Tablas
- **Singular**, snake_case, en **inglés** (`supplier`, no `suppliers` ni `proveedores`).
- Tablas hijas/pivote: prefijo `detail_` + nombre del padre + (opcional) clasificador.
  - `detail_bank_account` → detalle de cuentas bancarias por cierre.
  - `detail_turn_sale_category` → detalle de categorías de venta por turno.
  - `detail_sale_category_tax` → detalle de impuestos por línea de detalle.
- Anidamiento permitido: detalle de detalle (`detail_turn_tax` cuelga de `detail_turn_sale_category`).

### 2.2 Columnas
- **snake_case**, inglés.
- PK siempre `id`.
- FKs: `<tabla_referenciada>_id`. Excepción legítima: cuando hay dos FKs al mismo destino con roles distintos, anteponer rol (`start_date_id` vs `end_date_id`).
- Booleanos / soft-delete: `active` (ver §3).
- Timestamps: `created_at`, `updated_at` (ver §3).
- Montos: nombre semántico (`amount`, `subtotal`, `tax`, `total`, `net_sale`, `discount`, `courtesy`).
- Fechas operativas: `operation_date`, `start_date`, `end_date`.

---

## 3. Columnas obligatorias

Toda tabla persistente debe incluir:

```sql
id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
active      TINYINT NOT NULL DEFAULT 1,
created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

Excepciones:
- **Pivotes puros N:M** (sólo dos FKs, ej. `sale_category_tax`) pueden omitir `active` y timestamps.
- Tablas raíz que registren un evento (ej. `daily_closure`) deben además llevar `udn_id` y, cuando aplique, `employee_id` o `user_id`.

### 3.1 Borrado lógico
**Nunca `DELETE` físico.** Se marca `active = 0`. Las queries de listado filtran por `active = 1`.

---

## 4. Tipos de datos canónicos

| Tipo lógico | Tipo SQL | Uso |
|---|---|---|
| ID interno | `INT` | PK / FK |
| Bandera activo | `TINYINT NOT NULL DEFAULT 1` | `active` |
| Monto / dinero | `DECIMAL(12,2) NOT NULL DEFAULT 0.00` | nunca `DOUBLE` |
| Porcentaje | `DECIMAL(5,2)` | `tax.percentage` |
| Tipo de cambio | `DECIMAL(10,4)` | `exchange_rate` (4 decimales) |
| Cantidad / contador | `INT` | `customers`, `total_suite` |
| Texto corto (nombre) | `VARCHAR(100)` o `VARCHAR(255)` | `name` |
| Texto medio | `VARCHAR(255)` | `description` corto, paths |
| Texto libre | `TEXT` | `reason`, `note`, `description` largo |
| Fecha | `DATE` | `operation_date`, fecha de negocio |
| Fecha+hora | `DATETIME` | `created_at`, `updated_at` |
| Símbolo / código corto | `CHAR(N)` | `account CHAR(5)`, `symbol CHAR(5)` |
| Tamaño en bytes | `BIGINT UNSIGNED` | `size_bytes` |
| Estado discreto fijo | tabla catálogo + FK | preferido sobre `ENUM` |

### 4.1 Charset
- Toda la base en `utf8mb4` con collation `utf8mb4_unicode_ci`.
- No mezclar collations entre tablas (rompe joins).

---

## 5. Patrón de relaciones (FKs)

### 5.1 Reglas
- Toda FK debe declararse explícitamente con `CONSTRAINT` y nombre `<tabla>_ibfk_<n>`.
- Toda FK debe tener su `KEY` correspondiente con el **mismo nombre de la columna** (no inventar alias: el `KEY` se llama igual que la columna).
- Política `ON DELETE` / `ON UPDATE`:

| Caso | ON DELETE | ON UPDATE |
|---|---|---|
| Detalle → Transacción raíz (líneas hijas) | `CASCADE` | `CASCADE` |
| Detalle / Transacción → Catálogo | `SET NULL` | `CASCADE` |
| Pivote N:M → ambos lados | `CASCADE` | `CASCADE` |
| Cualquiera → maestro corporativo (UDN, usuario, empleado) | `SET NULL` | `CASCADE` |

### 5.2 Cross-schema (maestros corporativos)
Los maestros viven fuera del esquema de negocio. **No se duplican**, se referencian:

```sql
CONSTRAINT `tabla_ibfk_n` FOREIGN KEY (`udn_id`)
  REFERENCES `rfwsmqex_erp`.`udn` (`idUDN`)
  ON DELETE SET NULL ON UPDATE CASCADE
```

Maestros conocidos en el ecosistema:
| Columna local | Esquema referenciado | Tabla / PK |
|---|---|---|
| `udn_id` | `rfwsmqex_erp` | `udn(idUDN)` |
| `user_id` | `rfwsmqex_erp` | `usuarios(idUser)` |
| `employee_id` | `rfwsmqex_gvsl_rrhh` | `empleados(idEmpleado)` |

Toda transacción raíz lleva al menos `udn_id`. Toda acción registrada lleva `user_id`.

---

## 6. Arquetipos de tabla

### 6.1 Catálogo simple
```sql
CREATE TABLE bank (
  id     INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name   VARCHAR(255) NOT NULL,
  active TINYINT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6.2 Catálogo con scope por UDN
```sql
CREATE TABLE customer (
  id     INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  udn_id INT DEFAULT NULL,
  name   VARCHAR(100) NOT NULL,
  active TINYINT NOT NULL DEFAULT 1,
  KEY `udn_id` (`udn_id`),
  CONSTRAINT `customer_ibfk_1` FOREIGN KEY (`udn_id`)
    REFERENCES `rfwsmqex_erp`.`udn`(`idUDN`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6.3 Transacción raíz (evento operativo)
```sql
CREATE TABLE daily_closure (
  id           INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  udn_id       INT DEFAULT NULL,
  employee_id  INT DEFAULT NULL,
  subtotal     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  tax          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  total        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  operation_date DATE NOT NULL,
  active       TINYINT NOT NULL DEFAULT 1,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `udn_id` (`udn_id`),
  KEY `employee_id` (`employee_id`),
  CONSTRAINT `daily_closure_ibfk_1` FOREIGN KEY (`udn_id`)
    REFERENCES `rfwsmqex_erp`.`udn`(`idUDN`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `daily_closure_ibfk_2` FOREIGN KEY (`employee_id`)
    REFERENCES `rfwsmqex_gvsl_rrhh`.`empleados`(`idEmpleado`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6.4 Detalle (línea hija de una transacción)
```sql
CREATE TABLE detail_bank_account (
  id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  daily_closure_id INT DEFAULT NULL,
  bank_account_id  INT DEFAULT NULL,
  amount           DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  KEY `daily_closure_id` (`daily_closure_id`),
  KEY `bank_account_id`  (`bank_account_id`),
  CONSTRAINT `detail_bank_account_ibfk_1` FOREIGN KEY (`daily_closure_id`)
    REFERENCES `daily_closure`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `detail_bank_account_ibfk_2` FOREIGN KEY (`bank_account_id`)
    REFERENCES `bank_account`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6.5 Pivote N:M
```sql
CREATE TABLE sale_category_tax (
  id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sale_category_id INT DEFAULT NULL,
  tax_id           INT DEFAULT NULL,
  KEY `sale_category_id` (`sale_category_id`),
  KEY `tax_id` (`tax_id`),
  CONSTRAINT `sale_category_tax_ibfk_1` FOREIGN KEY (`sale_category_id`)
    REFERENCES `sale_category`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `sale_category_tax_ibfk_2` FOREIGN KEY (`tax_id`)
    REFERENCES `tax`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6.6 Log de auditoría
```sql
CREATE TABLE audit_log (
  id            BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  udn_id        INT DEFAULT NULL,
  user_id       INT DEFAULT NULL,
  record_id     INT DEFAULT NULL,
  name_table    VARCHAR(255),
  name_user     VARCHAR(50),
  name_udn      VARCHAR(50),
  action        TEXT,
  change_items  LONGTEXT,
  message       TEXT,
  creation_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `udn_id` (`udn_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `audit_log_ibfk_1` FOREIGN KEY (`udn_id`)
    REFERENCES `rfwsmqex_erp`.`udn`(`idUDN`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `audit_log_ibfk_2` FOREIGN KEY (`user_id`)
    REFERENCES `rfwsmqex_erp`.`usuarios`(`idUser`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Características:
- PK `BIGINT` (volumen alto).
- Snapshot denormalizado de nombres (`name_user`, `name_udn`, `name_table`) para que el log sobreviva al borrado del recurso.
- Polimórfico (`record_id` + `name_table`) — sin FK al recurso.

### 6.7 Bloqueo / desbloqueo (control operativo)
Cuando un módulo se cierra por mes, se bitacoriza la apertura excepcional:
```sql
CREATE TABLE module_unlock (
  id             INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  udn_id         INT,
  module_id      INT,
  operation_date DATE,
  unlock_date    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lock_date      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  lock_reason    TEXT,
  active         TINYINT NOT NULL DEFAULT 1
);
```

---

## 7. Catálogos esperados en cualquier dominio operativo

Cuando el dominio maneje dinero o pagos, prever:

| Catálogo | Función |
|---|---|
| `payment_type` | Cómo se paga (efectivo, transferencia, tarjeta…) |
| `method_pay` | Método específico (subtipo del anterior, según producto) |
| `bank` / `bank_account` | Cuentas bancarias propias |
| `foreign_currency` | Divisas y `exchange_rate` |
| `tax` | Impuestos aplicables y porcentaje |
| `gl_account` / `subaccount` | Cuentas contables (mayor + subcuentas) |
| `module` / `section` | Catálogo de módulos y secciones del sistema (para bloqueos / permisos) |

---

## 8. Reglas de integridad

1. **Toda FK explícita.** No relaciones implícitas por convención de nombre.
2. **Toda FK con KEY.** El `KEY` se nombra igual que la columna.
3. **Misma collation en todas las tablas.** No mezclar `utf8mb4_unicode_ci` con `utf8mb4_0900_ai_ci`.
4. **No `ENUM` para estados extensibles.** Si hay una lista que el negocio puede crecer, va a tabla catálogo.
5. **No `DOUBLE` para dinero.** Siempre `DECIMAL(12,2)`.
6. **No `TEXT` para nombres cortos.** Usar `VARCHAR(100|255)`.
7. **Totales precalculados** (cuando existan en una tabla raíz) deben mantenerse vía la capa de aplicación al insertar/actualizar detalles. Si se quiere garantía a nivel DB, usar trigger.

---

## 9. Naming conventions del esquema

- Nombre del esquema: `<tenant>_<grupo>_<dominio>` → `rfwsmqex_gvsl_finanzas3`.
- Versionado por sufijo numérico (`finanzas`, `finanzas3`) cuando se reestructura mayor.

---

## 10. Checklist para crear una tabla nueva

```
[ ] Nombre en singular, snake_case, inglés
[ ] PK `id INT AUTO_INCREMENT`
[ ] `active TINYINT NOT NULL DEFAULT 1` (salvo pivote puro)
[ ] `created_at` y `updated_at` con CURRENT_TIMESTAMP (salvo pivote puro)
[ ] Si es de negocio: incluye `udn_id` con FK a `rfwsmqex_erp.udn(idUDN)`
[ ] Si registra acción: incluye `user_id` con FK a `rfwsmqex_erp.usuarios(idUser)`
[ ] Toda FK declarada con CONSTRAINT + KEY
[ ] Política ON DELETE/UPDATE según §5.1
[ ] Charset utf8mb4_unicode_ci
[ ] Engine InnoDB
[ ] Montos en DECIMAL(12,2), nunca DOUBLE
[ ] Estados discretos → catálogo, no ENUM
```

---

## 11. Resumen para el agente generador

> Cuando el usuario pida "crea la base de datos para X":
> 1. Identifica el **evento raíz** del dominio (¿qué se cierra/registra cada día?).
> 2. Identifica **catálogos** que el evento referencia.
> 3. Identifica **detalles** (líneas hijas) que orbitan al evento.
> 4. Identifica relaciones N:M → tabla pivote.
> 5. Aplica los arquetipos de §6 con los tipos canónicos de §4.
> 6. Conecta a maestros corporativos (UDN/usuarios/empleados) cross-schema según §5.2.
> 7. Verifica con el checklist de §10 antes de entregar el DDL.
