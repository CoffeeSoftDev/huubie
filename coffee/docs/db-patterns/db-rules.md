# Reglas de diseño de base de datos

> Extracto operativo de [finanzas3-pattern.md](finanzas3-pattern.md).
> Pensado como referencia rápida para crear **una nueva base de datos** o **una nueva tabla** sin tener que releer la spec completa.

---

## 1. Reglas para crear una BASE DE DATOS

### 1.1 Nombre del esquema
- Formato: `<tenant>_<dominio>`.
  - Ej. `rfwsmqex_finanzas`.


### 1.2 Configuración global
| Parámetro | Valor obligatorio |
|---|---|
| Engine | `InnoDB` |
| Charset | `utf8mb4 -- UTF-8 Unicode` |
| Collation | `utf8mb4_0900_ai_ci` |
| Versión MySQL | 8 |

> **Nunca mezclar collations entre tablas** del mismo esquema → rompe joins.

### 1.3 Filosofía
La base modela un **dominio operativo orbital**:
1. Un **evento raíz** (lo que se registra/cierra cada día).
2. **Catálogos** que el evento referencia.
3. **Detalles** (líneas hijas) que orbitan al evento.
4. **Maestros corporativos** (UDN, usuarios, empleados) viven en otros esquemas y se referencian cross-schema → **no se duplican**.

### 1.4 Clases de tabla
| Clase | Forma | Rol |
|---|---|---|
| **Catálogo** | singular, sin prefijo (`bank`, `tax`, `customer`) | Listas mantenidas por usuario |
| **Sub-catálogo** | singular compuesto, sin prefijo (`bank_account`, `subaccount`) | Catálogo que cuelga de otro catálogo |
| **Transacción raíz** | singular, sin prefijo (`sale`, `purchase`, `turn`, `daily_closure`) | Evento operativo (documento) con timestamp y montos |
| **Movimiento / detalle** | prefijo `detail_` (`detail_sale`, `detail_purchase`) | Renglones de un movimiento monetario de la raíz |
| **Pivote puro N:M** | `<a>_<b>` sin prefijo (`user_role`, `product_category`) | Une dos entidades, sin campos propios |

> **El prefijo `detail_` es semántico, no estructural.** Indica "renglón de un movimiento monetario", **no** "tabla hija". Por eso pivotes N:M y sub-catálogos NO lo llevan.

---

## 2. Reglas para crear una TABLA

### 2.1 Nombre de la tabla
- **Singular**, snake_case, en **inglés**.
  - `supplier`, no `suppliers` ni `proveedores`.

**Prefijo `detail_` → exclusivo de movimientos / renglones de una transacción raíz.** No se usa para pivotes ni sub-catálogos.
- `detail_sale` → productos vendidos dentro de una venta.
- `detail_purchase` → líneas de una compra.
- `detail_daily_closure` → desgloses del cierre.

**Movimientos anidados**: si el sub-renglón sigue siendo movimiento monetario de la raíz, mantiene el prefijo.
- `detail_sale_tax`, `detail_turn_sale_category`, `detail_turn_tax`.

**Sub-catálogo** (catálogo que cuelga de otro catálogo): **sin prefijo**, nombre compuesto en singular.
- `bank_account` (cuelga de `bank`), `subaccount` (cuelga de `gl_account`), `area` (cuelga de `udn`).

**Pivote puro N:M** (solo dos FKs, sin campos propios): **sin prefijo**, `<a>_<b>`.
- `user_role`, `user_module`, `user_udn`, `role_permission`, `product_category`, `product_tax`, `package_module`, `employee_subsidiary`.

### 2.2 Nombre de columnas
- **snake_case**, inglés.
- PK siempre `id`.
- FK: `<tabla_referenciada>_id` (`bank_id`, `customer_id`).
- Excepción: dos FKs al mismo destino con roles distintos → anteponer rol (`start_date_id`, `end_date_id`).
- Booleanos / soft-delete: `active`.
- Timestamps: `created_at`, `updated_at`.
- Montos: nombre semántico (`amount`, `subtotal`, `tax`, `total`, `net_sale`, `discount`, `courtesy`).
- Fechas operativas: `operation_date`, `start_date`, `end_date`.

### 2.3 Columnas obligatorias en TODA tabla persistente
```sql
id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
active      TINYINT NOT NULL DEFAULT 1,
created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

**Excepciones:**
- Pivotes puros N:M (sólo dos FKs) pueden omitir `active` y timestamps.
- Tablas raíz que registran un evento deben **además** llevar `udn_id` y, cuando aplique, `employee_id` o `user_id`.

### 2.4 Borrado
- **Nunca `DELETE` físico.** Se marca `active = 0`.
- Las queries de listado siempre filtran `WHERE active = 1`.
- **Excepción**: pivotes puros N:M sí permiten `DELETE` físico, porque la existencia de la fila *es* la relación.

### 2.5 Resumen de prefijos / forma del nombre

| Caso | Convención | Ejemplo |
|---|---|---|
| Catálogo simple | singular, sin prefijo | `bank`, `tax`, `customer` |
| Sub-catálogo (cuelga de catálogo) | singular compuesto, sin prefijo | `bank_account`, `subaccount`, `area` |
| Transacción raíz (evento) | singular, sin prefijo | `sale`, `purchase`, `daily_closure`, `turn` |
| Movimiento / renglón de raíz | `detail_<raíz>` | `detail_sale`, `detail_purchase` |
| Movimiento anidado | `detail_<raíz>_<clasificador>` | `detail_sale_tax`, `detail_turn_tax` |
| Pivote puro N:M | `<a>_<b>` sin prefijo | `user_role`, `product_category` |

---

## 3. Orden y nombres frecuentes

### 3.1 Orden recomendado de columnas (de arriba hacia abajo)

```
1.  id                       ← siempre primero (PK)
2.  <campos de negocio>      ← name, description, account, symbol
3.  <montos>                 ← subtotal, tax, total, amount, discount
4.  <fechas operativas>      ← operation_date, start_date, end_date
5.  created_at               ← timestamps justo después de las fechas
6.  updated_at
7.  status                   ← estado del flujo (pendiente / aprobado / cancelado…)
8.  <fk a maestros>          ← udn_id, employee_id, user_id
9.  <fk a otras tablas>      ← bank_id, customer_id, payment_type_id
10. active                   ← bandera de soft-delete, al final del bloque
11. KEYs                     ← uno por cada FK
12. CONSTRAINTs              ← FKs explícitas al cierre del DDL
```

> **Regla:** `created_at` / `updated_at` van **después de las fechas operativas**. `active` se coloca **al final** del bloque de columnas (después de las FKs), justo antes de los `KEY` / `CONSTRAINT`.

### 3.2 Nombres que aparecen casi siempre

Listados en el mismo orden en que se escriben dentro del `CREATE TABLE`:

| # | Nombre | Tipo | Para qué |
|---|---|---|---|
| 1 | `id` | INT PK | Identificador interno |
| 2 | `name` | VARCHAR(100/255) | Nombre del recurso (catálogo) |
| 2 | `description` | VARCHAR(255) o TEXT | Descripción |
| 3 | `amount` | DOUBLE | Monto unitario |
| 3 | `subtotal`, `tax`, `total` | DOUBLE | Totales de transacción |
| 4 | `operation_date` | DATE | Fecha de negocio (no del registro) |
| 5 | `created_at` | DATETIME | Alta del registro |
| 5 | `updated_at` | DATETIME | Última modificación |
| 6 | `status` | TINYINT o VARCHAR(20) | Estado del flujo (pendiente, aprobado, cancelado) |
| 7 | `udn_id` | INT FK | Sucursal/unidad de negocio |
| 7 | `user_id` | INT FK | Usuario que ejecutó la acción |
| 7 | `employee_id` | INT FK | Empleado dueño del registro |
| 8 | `active` | TINYINT | Soft-delete (1 = vivo, 0 = borrado) — al final |

> La columna `#` corresponde al bloque del orden definido en §3.1 (1 = PK, 2 = negocio, 3 = montos, 4 = fechas, 5 = timestamps, 6 = status, 7 = FKs, 8 = active).

### 3.3 Catálogos esperados cuando hay dinero o pagos
| Catálogo | Función |
|---|---|
| `payment_type` | Cómo se paga (efectivo, transferencia, tarjeta) |
| `method_pay` | Método específico (subtipo) |
| `bank` / `bank_account` | Cuentas bancarias propias |
| `foreign_currency` | Divisas y `exchange_rate` |
| `tax` | Impuestos y porcentaje |
| `gl_account` / `subaccount` | Cuentas contables |
| `module` / `section` | Módulos y secciones (para bloqueos / permisos) |

---

## 4. Tipos de datos canónicos

| Tipo lógico | Tipo SQL | Uso |
|---|---|---|
| ID interno | `INT` | PK / FK |
| Bandera activo | `TINYINT NOT NULL DEFAULT 1` | `active` |
| Monto / dinero | `DOUBLE NOT NULL DEFAULT 0` | convención de la casa |
| Porcentaje | `DOUBLE` | `tax.percentage` |
| Tipo de cambio | `DOUBLE` | `exchange_rate` |
| Cantidad / contador | `INT` | `customers`, `total_suite` |
| Texto corto (nombre) | `VARCHAR(100)` o `VARCHAR(255)` | `name` |
| Texto medio | `VARCHAR(255)` | `description` corto, paths |
| Texto libre | `TEXT` | `reason`, `note`, `description` largo |
| Fecha | `DATE` | `operation_date`, fecha de negocio |
| Fecha + hora | `DATETIME` | `created_at`, `updated_at` |
| Símbolo / código corto | `CHAR(N)` | `account CHAR(5)`, `symbol CHAR(5)` |
| Tamaño en bytes | `BIGINT UNSIGNED` | `size_bytes` |
| Estado discreto fijo | tabla catálogo + FK | preferido sobre `ENUM` |
| PK de log alto volumen | `BIGINT` | `audit_log.id` |

---

## 5. Reglas de Foreign Keys

### 5.1 Sintaxis obligatoria
- Toda FK declarada explícitamente con `CONSTRAINT` + nombre `<tabla>_ibfk_<n>`.
- Toda FK acompañada de un `KEY` con el **mismo nombre que la columna** (no inventar alias).

```sql
KEY `udn_id` (`udn_id`),
CONSTRAINT `daily_closure_ibfk_1` FOREIGN KEY (`udn_id`)
  REFERENCES `rfwsmqex_erp`.`udn`(`idUDN`)
  ON DELETE SET NULL ON UPDATE CASCADE
```

### 5.2 Política ON DELETE / ON UPDATE
| Caso | ON DELETE | ON UPDATE |
|---|---|---|
| Detalle → Transacción raíz | `CASCADE` | `CASCADE` |
| Detalle / Transacción → Catálogo | `SET NULL` | `CASCADE` |
| Pivote N:M → ambos lados | `CASCADE` / `SET NULL` | `CASCADE` |
| Cualquiera → maestro corporativo (UDN, usuario, empleado) | `SET NULL` | `CASCADE` |

### 5.3 Cross-schema (maestros corporativos)
| Columna local | Esquema referenciado | Tabla / PK |
|---|---|---|
| `udn_id` | `rfwsmqex_erp` | `udn(idUDN)` |
| `user_id` | `rfwsmqex_erp` | `usuarios(idUser)` |
| `employee_id` | `rfwsmqex_gvsl_rrhh` | `empleados(idEmpleado)` |

> Toda transacción raíz lleva al menos `udn_id`. Toda acción registrada lleva `user_id`.

---

## 6. Cosas que NO se hacen

| Anti-patrón | Por qué | Qué hacer |
|---|---|---|
| `DELETE` físico | Pierde historial, rompe FKs | `UPDATE ... SET active = 0` |
| `ENUM` para estados extensibles | El negocio crece, ENUM no | Tabla catálogo + FK |
| `TEXT` para nombres cortos | Indexación pobre, peso innecesario | `VARCHAR(100)` o `VARCHAR(255)` |
| Tablas en plural (`suppliers`) | Convención del esquema | Singular (`supplier`) |
| Nombres en español (`proveedor`) | Convención del esquema | Inglés (`supplier`) |
| Usar `detail_` en pivotes N:M o sub-catálogos | El prefijo es solo para renglones de transacción raíz | Pivote: `<a>_<b>` · Sub-catálogo: nombre compuesto sin prefijo |
| Mezclar collations | Rompe joins | `utf8mb4_0900_ai_ci` en todas |
| FK implícita por convención de nombre | Sin integridad real | `CONSTRAINT` explícito |
| FK sin `KEY` | Rendimiento, errores de planeador | Siempre `KEY` con mismo nombre |
| Duplicar maestros corporativos (UDN, usuarios) | Drift de datos | Referencia cross-schema |
| Renombrar `KEY` distinto a la columna | Confusión, errores de migración | `KEY` igual al nombre de columna |
| `id` que no sea `INT AUTO_INCREMENT` | Romper convención | `INT NOT NULL AUTO_INCREMENT PRIMARY KEY` |
| Totales sin recálculo | Inconsistencia | Mantener desde la app o trigger |

---

## 7. Checklist final para crear una tabla nueva

### 7.1 Clasificación (decisión inicial)
```
[ ] ¿Qué clase de tabla es? (§1.4)
    [ ] Catálogo simple        → singular sin prefijo (`bank`, `tax`)
    [ ] Sub-catálogo           → compuesto sin prefijo (`bank_account`)
    [ ] Transacción raíz       → singular sin prefijo (`sale`, `daily_closure`)
    [ ] Movimiento / detalle   → prefijo `detail_<raíz>` (`detail_sale`)
    [ ] Pivote puro N:M        → `<a>_<b>` sin prefijo (`user_role`)
[ ] El prefijo `detail_` se usa SOLO en renglones de transacción raíz
    (nunca en pivotes ni en sub-catálogos)
```

### 7.2 Nombres
```
[ ] Tabla en singular, snake_case, inglés (`supplier`, no `suppliers`)
[ ] Columnas snake_case, inglés
[ ] PK = `id`
[ ] FKs = `<tabla_referenciada>_id`
[ ] KEY se llama exactamente igual que la columna (no inventar alias)
```

### 7.3 Columnas obligatorias
```
[ ] `id INT NOT NULL AUTO_INCREMENT PRIMARY KEY`
[ ] `active TINYINT NOT NULL DEFAULT 1`           (salvo pivote puro N:M)
[ ] `created_at DATETIME ... CURRENT_TIMESTAMP`   (salvo pivote puro N:M)
[ ] `updated_at DATETIME ... ON UPDATE ...`       (salvo pivote puro N:M)
[ ] Si registra evento de negocio: `udn_id`     → FK a `rfwsmqex_erp.udn(idUDN)`
[ ] Si registra acción de usuario: `user_id`    → FK a `rfwsmqex_erp.usuarios(idUser)`
[ ] Si tiene flujo de aprobación / ciclo: `status`
```

### 7.4 Tipos de datos
```
[ ] Montos en DOUBLE (convención de la casa)
[ ] Nombres en VARCHAR(100|255), nunca TEXT
[ ] Estados discretos extensibles → tabla catálogo + FK, no ENUM
[ ] Fecha de negocio en DATE; auditoría en DATETIME
```

### 7.5 Foreign Keys
```
[ ] Toda FK declarada con CONSTRAINT explícito (`<tabla>_ibfk_<n>`)
[ ] Toda FK acompañada de su KEY (mismo nombre que la columna)
[ ] Política ON DELETE / ON UPDATE (§5.2):
    [ ] Detalle → Transacción raíz       : CASCADE / CASCADE
    [ ] Detalle / Transacción → Catálogo : SET NULL / CASCADE
    [ ] → Maestro corporativo (UDN/user) : SET NULL / CASCADE
[ ] Maestros corporativos referenciados cross-schema, NO duplicados
```

### 7.6 Borrado
```
[ ] Nunca `DELETE` físico → siempre `UPDATE ... SET active = 0`
[ ] Listados filtran `WHERE active = 1`
[ ] Excepción: pivote puro N:M sí permite DELETE físico
```

### 7.7 DDL final
```
[ ] Engine InnoDB
[ ] Charset utf8mb4 con collation utf8mb4_0900_ai_ci (no mezclar)
[ ] Orden de columnas:
    id → negocio → montos → fechas → created_at → updated_at →
    status → FKs → active → KEYs → CONSTRAINTs
```

---

## 8. Plantilla mínima reutilizable

```sql
CREATE TABLE <nombre_singular> (
  id              INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
  amount          DOUBLE NOT NULL DEFAULT 0,
  operation_date  DATE NOT NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending',
  udn_id          INT DEFAULT NULL,
  <fk_negocio>_id INT DEFAULT NULL,
  active          TINYINT NOT NULL DEFAULT 1,
  KEY `udn_id` (`udn_id`),
  KEY `<fk_negocio>_id` (`<fk_negocio>_id`),
  CONSTRAINT `<nombre_singular>_ibfk_1` FOREIGN KEY (`udn_id`)
    REFERENCES `rfwsmqex_erp`.`udn`(`idUDN`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `<nombre_singular>_ibfk_2` FOREIGN KEY (`<fk_negocio>_id`)
    REFERENCES `<fk_negocio>`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```
