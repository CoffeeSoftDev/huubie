# Base de Datos - Sistema de Pedidos

## Conexion

- **Host:** `localhost`
- **Usuario:** `root`
- **Base por defecto:** `fayxzvov_alpha`
- **Charset:** `utf8mb4`
- **Timezone:** `America/Mexico_City`
- **Driver:** PDO MySQL
- **Config:** `alpha/conf/_Conect.php`

---

## Bases de Datos

El sistema utiliza 3 bases de datos con JOINs cruzados:

| Base de datos | Uso |
|---|---|
| `fayxzvov_reginas` | Pedidos, catalogo, turnos, eventos, inventario |
| `fayxzvov_alpha` | Framework: usuarios, sucursales, roles |
| `fayxzvov_admin` | Administracion global: empresas y modulos |

---

## fayxzvov_reginas (57 tablas)

### Pedidos

| Tabla | Descripcion |
|---|---|
| `order` | Pedidos principales |
| `order_payments` | Pagos asociados a pedidos |
| `order_clients` | Clientes de pedidos |
| `order_histories` | Historial/auditoria de pedidos |
| `order_images` | Imagenes adjuntas a pedidos |
| `order_custom` | Pedidos personalizados |
| `order_custom_products` | Productos de pedidos personalizados |
| `order_package` | Paquetes de pedido |

### Catalogo de Productos

| Tabla | Descripcion |
|---|---|
| `order_products` | Productos del catalogo |
| `order_category` | Categorias de productos |
| `order_modifier` | Modificadores (extras, opciones) |
| `order_modifier_products` | Items individuales de modificadores |

### Turnos y Cierres

| Tabla | Descripcion |
|---|---|
| `cash_shift` | Turnos de caja |
| `cash_shift_movements` | Movimientos de caja (entradas/salidas) |
| `shift_payment` | Desglose de pagos por turno |
| `shift_status_process` | Conteo de estados de pedidos por turno |
| `daily_closure` | Cierres diarios |
| `closure_payment` | Pagos registrados en cierre |
| `closure_status_proccess` | Estados de pedidos en cierre |
| `corte_x_log` | Log de cortes X |

### Eventos

| Tabla | Descripcion |
|---|---|
| `evt_events` | Eventos (cumpleanos, ocasiones especiales) |
| `evt_subevents` | Sub-eventos de sucursal |
| `evt_payments` | Pagos de eventos |
| `evt_histories` | Historial de eventos |
| `evt_package` | Paquetes de evento |
| `evt_package_products` | Productos dentro de paquetes |
| `evt_events_package` | Relacion evento-paquete |
| `evt_menu` | Menus de evento |
| `evt_dishes` | Platillos de evento |
| `evt_products` | Productos de evento |
| `evt_category` | Categorias de evento |
| `evt_classification` | Clasificaciones de evento |
| `event_item` | Items de evento |

### Reservaciones

| Tabla | Descripcion |
|---|---|
| `reservation` | Reservaciones |
| `reservation_histories` | Historial de reservaciones |
| `reservation_status` | Estados de reservacion |

### Inventario

| Tabla | Descripcion |
|---|---|
| `inv_supplies` | Insumos/materias primas |
| `inv_kardex` | Kardex de movimientos |
| `inv_adjustments` | Ajustes de inventario |
| `inv_recipes` | Recetas (relacion producto-insumo) |
| `inv_suppliers` | Proveedores |
| `inv_units` | Unidades de medida |
| `inv_purchase_orders` | Ordenes de compra |
| `inv_purchase_order_items` | Detalle de ordenes de compra |

### Tickets y Facturacion

| Tabla | Descripcion |
|---|---|
| `ticket_config` | Configuracion de tickets |
| `ticket_log` | Log de tickets impresos |
| `cfdi_invoices` | Facturas CFDI |

### Fidelizacion (Loyalty)

| Tabla | Descripcion |
|---|---|
| `loyalty_config` | Configuracion del programa |
| `loyalty_points` | Puntos acumulados por cliente |
| `loyalty_transactions` | Transacciones de puntos |

### KDS (Kitchen Display System)

| Tabla | Descripcion |
|---|---|
| `kds_order_items` | Items enviados a pantalla de cocina |

### Tablas de Referencia

| Tabla | Descripcion |
|---|---|
| `status_process` | Estados de pedido (Pendiente, En proceso, Listo, Entregado, etc.) |
| `method_pay` | Metodos de pago (Efectivo, Tarjeta, Transferencia) |
| `customers` | Clientes generales |
| `cancellation_reasons` | Razones de cancelacion |
| `role_permissions` | Permisos por rol |
| `tables_config` | Configuracion de mesas |
| `tips` | Propinas |

---

## fayxzvov_alpha (22 tablas)

Tablas usadas por el modulo de pedidos:

| Tabla | Descripcion |
|---|---|
| `subsidiaries` | Sucursales/branches |
| `usr_users` | Usuarios del sistema |
| `usr_rols` | Roles de usuario |
| `status_process` | Estados (compartida) |
| `method_pay` | Metodos de pago (compartida) |
| `customers` | Clientes (compartida) |

### Relacion con pedidos

Las queries en los modelos hacen JOINs cruzados:
```sql
-- Ejemplo tipico
SELECT o.*, s.name AS subsidiary_name, u.name AS user_name
FROM fayxzvov_reginas.order o
INNER JOIN fayxzvov_alpha.subsidiaries s ON o.subsidiary_id = s.id
INNER JOIN fayxzvov_alpha.usr_users u ON o.user_id = u.id
```

---

## fayxzvov_admin (5 tablas)

| Tabla | Descripcion |
|---|---|
| `companies` | Empresas registradas |
| `customers` | Clientes globales |
| `modules` | Modulos del sistema |
| `module_company` | Relacion modulo-empresa |
| `users` | Usuarios administrativos |

### Relacion con pedidos

```sql
-- Se usa para obtener datos de la empresa
SELECT c.* FROM fayxzvov_admin.companies c WHERE c.id = :company_id
```

---

## Diagrama de Relaciones

```
fayxzvov_admin.companies
        |
        v
fayxzvov_alpha.subsidiaries --> usr_users, usr_rols
        |
        v
fayxzvov_reginas.order
    |-- order_payments
    |-- order_clients
    |-- order_histories
    |-- order_images
    |-- order_custom --> order_custom_products
    |-- order_package
    |-- order_products --> order_category
    |                  --> order_modifier --> order_modifier_products
    |-- cash_shift --> shift_payment, shift_status_process
    |              --> daily_closure --> closure_payment, closure_status_proccess
    |-- evt_events --> evt_subevents, evt_payments, evt_package
    |-- inv_supplies --> inv_kardex, inv_recipes, inv_adjustments
    |-- kds_order_items
    |-- ticket_log
    |-- loyalty_points --> loyalty_transactions
```

---

## Variables de Sesion

El sistema usa variables de sesion para determinar el contexto:

| Variable | Uso |
|---|---|
| `$_SESSION['SUB']` | ID de sucursal activa |
| `$_SESSION['ROLID']` | ID del rol del usuario |
| `$_SESSION['COMPANY']` | ID de la empresa |
| `$_SESSION['DB']` | Base de datos activa |

---

## Archivos Clave

| Archivo | Funcion |
|---|---|
| `alpha/conf/_Conect.php` | Conexion PDO |
| `alpha/conf/_CRUD.php` | Operaciones CRUD base |
| `pedidos/mdl/mdl-pedidos.php` | Modelo principal de pedidos |
| `pedidos/mdl/mdl-admin.php` | Modelo de productos/categorias |
| `pedidos/mdl/mdl-pedidos-personalizado.php` | Modelo de pedidos custom |
| `pedidos/mdl/mdl-projects.php` | Modelo de proyectos |
