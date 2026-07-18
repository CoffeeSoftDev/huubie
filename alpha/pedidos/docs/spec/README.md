# Pedidos — Especificación funcional (Spec-Driven)

> POS de pastelería multi-sucursal: catálogo, pasteles personalizados, pagos/abonos,
> descuentos, turnos de caja y cierre del día (corte Z).
> Este documento describe **qué hace hoy cada apartado** (no cómo debería idealmente),
> derivado del código en `alpha/pedidos/` el **2026-07-17**.

Cada apartado sigue el mismo esquema:

1. **Propósito** — qué resuelve.
2. **Actores y disparador** — quién lo usa y desde dónde se lanza.
3. **Precondiciones / candados** — qué debe cumplirse para operar.
4. **Flujo** — front (`opc`) → controlador → modelo → tablas.
5. **Reglas de negocio** — invariantes y validaciones.
6. **Postcondiciones / salidas** — qué queda escrito.
7. **⚠ Nota crítica** — qué está mal planteado, qué mejorar y qué revisar.

> Las notas críticas son la parte accionable. El resumen priorizado de todos los
> hallazgos está en [08-deuda-tecnica-consolidada.md](08-deuda-tecnica-consolidada.md).

---

## Índice de apartados

| # | Apartado | Archivo |
|---|---|---|
| 01 | Arranque, sesión/roles, navbar de sucursal, listado y filtros | [01-arranque-sesion-listado.md](01-arranque-sesion-listado.md) |
| 02 | Captura de pedido: tipo, alta/edición, POS catálogo, pastel personalizado, imágenes | [02-captura-de-pedido.md](02-captura-de-pedido.md) |
| 03 | Pagos/abonos, descuentos y entrega | [03-pagos-descuentos-entrega.md](03-pagos-descuentos-entrega.md) |
| 04 | Turno de caja (apertura y corte de turno) | [04-turno-de-caja.md](04-turno-de-caja.md) |
| 05 | Cierre del día (corte Z), reapertura, recálculo, días pendientes | [05-cierre-del-dia.md](05-cierre-del-dia.md) |
| 06 | Dashboard y reportes (visor de cierre) | [06-dashboard-reportes.md](06-dashboard-reportes.md) |
| 07 | Administración: catálogo, admin-folios, calendario, bitácora | [07-administracion.md](07-administracion.md) |
| 08 | Deuda técnica consolidada y priorizada | [08-deuda-tecnica-consolidada.md](08-deuda-tecnica-consolidada.md) |

> Referencia arquitectónica previa (stack, capas, ER): [../pedidos/arquitectura.md](../pedidos/arquitectura.md),
> [../pedidos/base-de-datos.md](../pedidos/base-de-datos.md), [../pedidos/diagramas-er.md](../pedidos/diagramas-er.md).

---

## Arquitectura en una pantalla

```
FRONTEND  src/js/*.js  (clases JS extends Templates)
   render declarativo: primaryLayout / createTable / createModalForm / tabLayout
        │  POST { opc: "<accion>", ... }   (fetch JSON, useFetch)
CONTROLADOR  ctrl/ctrl-*.php
   lee $_POST['opc'] → despacho DINÁMICO: $obj->{$_POST['opc']}()
        │
MODELO  mdl/mdl-*.php  (extends CRUD)
   SQL crudo (_Read) + helpers (_Select/_Insert/_Update) · JOINs cross-schema
        │
CONEXIÓN  conf/_Conect.php (PDO) · conf/_CRUD.php
```

- **Despacho dinámico:** el `opc` que llega por POST se invoca como método del controlador
  (`$obj->{$_POST['opc']}()`). No hay `switch` ni allow-list: **cualquier método público
  del controlador es invocable por nombre**. Ver nota de seguridad en el apartado 01.
- **Tema:** dark (`#111928` / contenedor `#1F2A37`), Tailwind CDN + Bootstrap 5 + Fontello.
- **Iconos:** Fontello (`icon-shop`, `icon-bank`, …), no Lucide — regla propia de este módulo.

---

## Mapa de archivos

```
alpha/pedidos/
├── index.php                          POS principal (lista de pedidos)  → carga app.js + catálogo + personalizado + cierre + reportes + dashboard
├── admin.php                          administración de catálogo         → carga admin.js
├── ctrl/
│   ├── ctrl-pedidos.php               pedidos, pagos, descuentos, turnos, dashboard, reportes  (2370 líneas)
│   ├── ctrl-pedidos-catalogo.php      POS: productos del pedido + addPayment ("Terminar")
│   ├── ctrl-pedidos-personalizado.php pasteles personalizados + imágenes de referencia
│   ├── ctrl-cierre.php                cierre diario / corte Z + recálculo de turno
│   ├── ctrl-admin.php                 CRUD de catálogo (categorías, productos, modificadores, clientes)
│   └── ctrl-projects.php              ⚠ tabla `projects` no existe — código muerto
├── mdl/  (espejo de los ctrl; mdl-pedidos.php es el núcleo)  ·  mdl-pedidos-catalogo.php está VACÍO (0 líneas)
├── src/js/
│   ├── app.js                    App           — orquestador: listado, alta/edición, pagos, descuentos, turno/cierre
│   ├── pedidos-catalogo.js       Pos/CatalogProduct — POS de productos + ticket de pastelería
│   ├── pedidos-personalizado.js  CustomOrder   — armado de pastel personalizado
│   ├── pedidos-cierre.js         Cierre        — abrir/cerrar turno + corte del día
│   ├── admin.js                  Category/Client/Modifier/ProductModifier — catálogo
│   ├── dashboard-pedidos.js      AppDashboard/DashboardPedidos — KPIs (Chart.js)
│   ├── order-reports.js          OrderReports  — visor de cierres/turnos (solo consulta)
│   ├── navbar.js                 selector de sucursal + indicador de turno
│   └── session-reset-timer.js    ⚠ TEMPORAL: fuerza un reinicio de sesión una vez
├── admin-folios/                 numeración/folios por sucursal
├── calendario/                   vista FullCalendar de pedidos por fecha de entrega
├── templates/pos/                wireframes POS estáticos (propuestas, no productivos)
└── docs/                         documentación (esta carpeta spec/ + pedidos/ + plan/ + fixes)
```

---

## Glosario (fuente única de verdad para todo el spec)

### Estados del pedido (`status` / `status_process`)
| id | Nombre | Significado |
|---|---|---|
| 1 | Cotización | pedido creado, sin abono |
| 2 | Pendiente / Abono parcial | tiene abono pero saldo > 0 |
| 3 | Pagado | saldo cubierto |
| 4 | Cancelado | anulado (soft-delete lógico) |

> `type_id` del pedido **duplica** el avance de pago (1/2/3) y se escribe junto con
> `status` en el mismo UPDATE. Redundancia histórica (ver 03 y 08).

### Roles (`$_SESSION['ROLID']`)
| id | Rol | Alcance en pedidos |
|---|---|---|
| 1 | Admin | ve/filtra **todas** las sucursales; selector en navbar y en el formulario |
| 2 | Cajero | opera con selector de navbar (incluye "Todas" solo para consulta) |
| 3 | Vendedor | igual que cajero para el filtro |
| 6 | Supervisor | consulta ampliada (Calendario + Reportes) |
| 7 | Restringido | como supervisor pero **sin descuento** |
| — | otros | quedan fijados a su sucursal de sesión (`SUB`) |

> El check `in_array($ROLID, [1,2,3,6,7])` está **repetido literal** en ~6 lugares
> (addOrder, openShift, getShiftsByDate, refreshSubsidiariesShift, getListFilterSubsidiary…).
> Cualquier cambio de roles obliga a tocarlos todos. Ver 08.

### Métodos de pago (`method_pay`)
| id | Método | Clave |
|---|---|---|
| 1 | Efectivo | EFE |
| 2 | Tarjeta | TDC |
| 3 | Transferencia | TRANSF |

### Bases de datos
| Esquema | Rol | Tablas |
|---|---|---|
| `fayxzvov_reginas` | datos operativos del POS | `order`, `order_*`, `cash_shift`, `daily_closure`, `*closure*`, `status_process`, `method_pay` |
| `fayxzvov_alpha` | tenant/framework | `subsidiaries`, `usr_users`, `usr_rols` |
| `fayxzvov_admin` | administración global | `companies` |

> ⚠ **Código sin tabla:** `projects` (ctrl/mdl-projects), y las referencias a `order_details`
> y `cash_shift_movements` no existen en `fayxzvov_reginas`. Features no migradas / código muerto.

### Convención de montos
Todos los importes se guardan en `DOUBLE` (convención de la casa). Implicación: comparaciones
de igualdad exacta sobre dinero (`$pay == $saldo`) son frágiles ante redondeo. Ver 03.
