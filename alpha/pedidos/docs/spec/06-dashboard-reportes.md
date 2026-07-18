# 06 — Dashboard y reportes (visor de cierre)

Dos vistas de solo consulta: el **Dashboard** (KPIs con Chart.js) y los **Reportes**
(visor de cierres/turnos y reportes de ventas/productos/clientes).

Controlador: `ctrl-pedidos.php` (métricas) + `ctrl-cierre.php` (`getCierre`).
Front: `dashboard-pedidos.js` (`AppDashboard`/`DashboardPedidos`), `order-reports.js` (`OrderReports`).

---

## 6.1 Dashboard (`opc: apiDashboard`, `getDashboardMetrics`)

**Propósito.** KPIs del mes y comparativa interanual: ventas, pedidos, ticket promedio,
ventas por día/semana, top productos/clientes.

**Flujo.** `DashboardPedidos.renderDashboard()` filtra por sucursal/estado/fecha
(`onchange → renderDashboard`) y pide `apiDashboard`, que en el modelo agrega:
`getOrdersByMonth`, `getCompletedSales`, `getPendingSales`, `getOrdersChartData`,
`getOrdersDashboard`, `getOrdersByDay`, `getOrdersByWeekday`, `getTopProducts`, `getTopClients`.
Se pinta con **Chart.js** (CDN).

**Estructura UI.** `AppDashboard` monta un `tabLayout` con 3 pestañas: **Dashboard**,
**Pedidos** (reusa `app.render()` reasignando `app._div_modulo`), **Reportes** (`reports.render()`).

**⚠ Nota crítica.**
- **Entrada al Dashboard ambigua.** `dashboard.render()` está **comentado** en el bootstrap
  (`dashboard-pedidos.js:14`); no queda claro desde dónde se lanza (¿navbar? ¿menú externo?).
  Documentar el punto de entrada o, si está muerto, retirarlo.
- **`app._div_modulo` se reasigna en caliente** desde el tab "Pedidos" (`app._div_modulo =
  'root-pedidos'`). Mutar una propiedad interna de otra instancia para reubicar su render es
  frágil: si `app` se re-renderiza luego en la vista normal, quedó apuntando a un div que ya no
  existe. Acoplamiento sucio entre Dashboard y App.
- **Chart.js y varias libs vienen de CDN** (`cdn.jsdelivr.net`, `cdn.tailwindcss.com`). Sin
  internet o con el CDN caído, el dashboard (y el tema Tailwind) se rompen. Para un POS que debe
  operar siempre, las libs deberían servirse locales (como ya se hace con jQuery/DataTables).
- **KPIs recalculados en cada `onchange`** sin caché: cada cambio de filtro dispara toda la batería
  de queries de agregación. Aceptable en consulta, pero pesado en rangos amplios.

---

## 6.2 Reportes de ventas/productos/clientes (`reportVentas`, `reportProductos`, `reportClientes`)

**Propósito.** Tablas y top-N por rango de fechas.

**Flujo.** Modelo: `getOrdersByDateRange`, `getProductSalesByDateRange`,
`getClientPurchasesByDateRange`, `getOrdersByStatus`.

**⚠ Nota crítica.**
- **La lógica de dinero se re-implementa aquí** (sumas por método, ventas por rango) por 3.ª o 4.ª
  vez, con criterios que pueden no coincidir con el corte de turno (04) ni el corte Z (05). Un
  "reporte de ventas" y un "corte Z" del mismo rango pueden dar totales distintos. **Consolidar el
  cálculo de ventas/cobros en un único servicio** que consuman dashboard, reportes y cortes.
- Sin paginación aparente en los rangos grandes; `getOrdersByDateRange` puede devolver miles de
  filas al front. Revisar.

---

## 6.3 Visor de cierre (`order-reports.js` → `getCierre`, `showCorteCaja`, `lsCorteCaja`)

**Propósito.** Vista de **solo consulta** para revisar cortes Z y turnos ya cerrados (o preview de
un día no cerrado, solo admin). Se monta sobre la vista de pedidos (`app.openReports()`), disponible
para todos los roles porque es consulta; el regreso lo da la flecha del propio visor.

**Reglas de negocio.**
- **Total de caja = efectivo + tarjeta + transferencia** (no `total_sales`), coherente con la nota
  del apartado 04: el visor ya evita presentar `total_sales` como "dinero en caja".
- Distingue cobros del día, abonos previos y cobros cruzados (las tres cubetas de 5.4).

**⚠ Nota crítica.**
- **`openReports()` fuerza `#navbarBranchControl` visible y reescribe `#root`** a mano; no usa el
  layout canónico. Es una vista "pegada" sobre la de pedidos, no un módulo propio. Aceptable como
  visor, pero la navegación (montar sobre pedidos + flecha de regreso) es artesanal y puede dejar
  estado colgando si el usuario navega distinto.
- **Existe un módulo hermano `alpha/order-visor/`** (separado) que hace un visor de cierre parecido.
  Riesgo de **dos visores divergentes**: confirmar cuál es el vigente y si `order-reports.js` debe
  converger con `order-visor` o retirarse. (La memoria del proyecto marca un fix pendiente de
  "total caja" también en `order-reports.js:328`).
- El visor **recalcula en vivo** (getCierre) el mismo día que `daily_closure` guardó congelado:
  hereda toda la ambigüedad de snapshot vs live del apartado 05.

---

## Resumen

El dashboard y los reportes son **consultas correctas en intención pero con la lógica de negocio
duplicada**: cada vista suma el dinero a su manera. La deuda central no es de UI sino de que **no
hay una única definición compartida de "venta", "cobro" y "saldo"** (ver 05 y 08). Mientras eso no
se centralice, cada reporte nuevo agrega otra variante del mismo cálculo.
