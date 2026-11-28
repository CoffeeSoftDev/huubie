// -- Dashboard --
// El «Dashboard del almacén» de inventory/operacion/almacen aplicado al
// Catálogo de pro: tarjetas del stock (clic = su desglose), «Por resurtir» y la
// bitácora de movimientos de todos los usuarios de la sucursal, con su detalle
// en el ojo. Solo lectura. Comunes (invEsc, viewHeader...) en inventarios.js.

let apiDashboard = 'ctrl/ctrl-dashboard.php';
let app;

const VIEW_HEADER_DASHBOARD = {
    title:    'Dashboard del almacén',
    subtitle: 'Indicadores del stock y bitácora de movimientos de todos los usuarios de la sucursal'
};

$(async () => {
    app = new App(apiDashboard, 'root');
    await app.init();
});

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Dashboard';
        this.dataInit     = {};
        this.rangeFi      = '';
        this.rangeFf      = '';
    }

    async init() {
        const r = await useFetch({ url: apiDashboard, data: { opc: 'init' } });

        if (!r || r.status !== 200) return invBlocked(r && r.message);

        INV_ACTIONS = r.actions || [];

        this.dataInit = {
            branch:   (r.scope || {}).branch || '',
            tipos:    r.tipos    || [],
            usuarios: r.usuarios || [],
            costs:    !!r.costs
        };

        this.render();
    }

    render() {
        this.layout();
        this.viewHeader({
            parent: 'viewHeader',
            json:   Object.assign({}, VIEW_HEADER_DASHBOARD, { titleHtml: invTitleHtml(VIEW_HEADER_DASHBOARD.title, this.dataInit.branch) })
        });
        this.filterBar();
        this.showDashboard();
        this.lsMovimientos();
    }

    // -- Layout --

    layout() {
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'cs-visor flex-1 min-h-0 w-full flex flex-col overflow-hidden bg-white rounded-lg border border-gray-200 dark:!border-0',
                container: [
                    { type: 'div', id: 'viewHeader', class: 'flex items-center justify-between gap-3 px-4 py-3 bg-white border-b border-gray-200 dark:!border-0 flex-shrink-0' },
                    { type: 'div', id: 'filterBar',  class: 'px-3 py-3 bg-white border-b border-gray-200 dark:!border-0 flex-shrink-0' },
                    {
                        type:     'div',
                        id:       'dashboardBody',
                        class:    'flex-1 min-h-0 overflow-auto bg-gray-50 p-3 flex flex-col gap-3',
                        children: [
                            { id: 'kpisRow' },
                            {
                                id:    'dashboardGrid',
                                class: 'grid grid-cols-1 xl:grid-cols-3 gap-3 items-start'
                            }
                        ]
                    }
                ]
            }
        });

        // createLayout arma dos niveles: las tarjetas de la rejilla van aparte.
        $('#dashboardGrid').html(`
            <div id="logCard" class="xl:col-span-2 bg-white rounded-lg border border-gray-200 dark:!border-0 p-3 min-w-0">
                <div id="logHeader"></div>
                <div id="logTable" class="mt-2 overflow-x-auto"></div>
            </div>
            <div id="lowStockCard" class="bg-white rounded-lg border border-gray-200 dark:!border-0 p-3"></div>
        `);
    }

    // -- Filtros --

    filterBar() {
        this.createfilterBar({
            parent:     'filterBar',
            coffeesoft: true,
            theme:      'light',
            data: [
                { opc: 'input-calendar', id: `calendar${this.PROJECT_NAME}`, lbl: 'Rango:', class: 'col-12 col-md-4 col-lg-4', readonly: true, required: false },
                { opc: 'select', id: 'fTipo',    lbl: 'Movimiento:', class: 'col-12 col-md-4 col-lg-3', data: this.dataInit.tipos,    onchange: 'app.lsMovimientos()' },
                { opc: 'select', id: 'fUsuario', lbl: 'Usuario:',    class: 'col-12 col-md-4 col-lg-3', data: this.dataInit.usuarios, onchange: 'app.lsMovimientos()' }
            ]
        });

        const range = this.invRangePicker({
            parent:   `calendar${this.PROJECT_NAME}`,
            days:     6,
            onSelect: (fi, ff) => {
                this.rangeFi = fi;
                this.rangeFf = ff;
                this.lsMovimientos();
            }
        });

        this.rangeFi = range.fi;
        this.rangeFf = range.ff;
    }

    getFilters() {
        return {
            fi:      this.rangeFi,
            ff:      this.rangeFf,
            tipo:    $('#fTipo').val() || '',
            user_id: $('#fUsuario').val() || ''
        };
    }

    // -- Tarjetas --

    async showDashboard() {
        const r  = await useFetch({ url: apiDashboard, data: { opc: 'showDashboard' } });
        const ok = r && r.status === 200;
        const c  = ok ? r.counts : {};

        // Sin ver-costos, la tarjeta de dinero se cambia por un conteo.
        const first = this.dataInit.costs
            ? { id: 'kpiValor', label: 'Valor del inventario', value: c.valor || '$0.00', tone: 'default' }
            : { id: 'kpiValor', label: 'Con existencia', value: c.existencia || 0, tone: 'default' };

        this.invKpisRow({
            parent:  'kpisRow',
            json: [
                first,
                { id: 'kpiProductos', label: 'Productos con inventario', value: c.productos || 0, tone: 'info' },
                { id: 'kpiBajo',      label: 'Stock bajo',               value: c.bajo || 0,      tone: 'warning' },
                { id: 'kpiAgotado',   label: 'Agotados',                 value: c.agotado || 0,   tone: 'danger' }
            ],
            onClick: (kpi) => this.lsKpiDetail(kpi)
        });

        this.renderLowStock(ok ? r.lowStock || [] : []);
    }

    async lsKpiDetail(kpi) {
        const costs = this.dataInit.costs;
        const views = {
            kpiValor:     { title: costs ? 'Valor del inventario por producto' : 'Productos con existencia', right: costs ? [3, 4, 5] : [3] },
            kpiProductos: { title: 'Productos con inventario', center: [5], right: [3, 4] },
            kpiBajo:      { title: 'Productos con stock bajo', right: [3, 4, 5] },
            kpiAgotado:   { title: 'Productos agotados',       right: [3, 4] }
        };
        const view = views[kpi.id];
        if (!view) return;

        const r = await useFetch({ url: apiDashboard, data: { opc: 'lsKpiDetail', kpi: kpi.id } });

        if (!(r && r.status === 200)) {
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo cargar el detalle' });
            return;
        }

        const row = r.row || [];

        this.kpiDetailModal(Object.assign({}, view, {
            id:       kpi.id,
            value:    String(kpi.value),
            subtitle: `${row.length} producto${row.length !== 1 ? 's' : ''} · existencias al día de hoy${r.sucursal ? ' en ' + r.sucursal : ''}`,
            data:     { row }
        }));

        if (row.length > 8 && typeof simple_data_table === 'function') simple_data_table(`#tb${kpi.id}${this.PROJECT_NAME}`, 8);
    }

    // -- Bitácora --

    // Columnas: Fecha, Movimiento, Folio, Usuario, Almacén, Productos, Unidades, [Costo]
    async lsMovimientos() {
        const r    = await useFetch({ url: apiDashboard, data: Object.assign({ opc: 'lsMovimientos' }, this.getFilters()) });
        const data = { row: r && r.status === 200 ? r.row || [] : [] };

        this.renderLogHeader(data.row.length);

        this.createCoffeeTable3({
            parent:       'logTable',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'light',
            center:       [2, 3, 6],
            right:        this.dataInit.costs ? [7, 8] : [7],
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       12,
            emptyMessage: 'No hay movimientos con los filtros aplicados',
            emptyIcon:    'icon-history',
            data
        });

        if (window.lucide) lucide.createIcons();

        if (data.row.length && typeof simple_data_table === 'function') simple_data_table(`#tb${this.PROJECT_NAME}`, 15);
    }

    // El ojo de la bitácora: los productos que movió la operación.
    async getMovimiento(tipo, folio) {
        const r = await useFetch({ url: apiDashboard, data: { opc: 'getMovimiento', tipo, folio } });

        if (!(r && r.status === 200)) {
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo cargar el detalle' });
            return;
        }

        const h    = r.header || {};
        const esc  = invEsc;
        const nota = h.nota ? ` · Nota: ${esc(h.nota)}` : '';

        this.kpiDetailModal({
            id:       'movimiento',
            title:    `Detalle de la operación · ${esc(h.folio)}`,
            // El tipo como insignia y, con ver-costos, el importe (como inventory).
            value:    h.costo ? `${h.badge} <span class="ml-1">${esc(h.costo)}</span>` : h.badge,
            subtitle: `${esc(h.fecha)} · Registró ${esc(h.usuario)} · ${esc(h.almacen)} · ${h.productos} producto${h.productos !== 1 ? 's' : ''}${nota}`,
            center:   [1, 2],
            right:    [3, 4],
            data:     { row: r.row || [] }
        });
    }

    // -- Componentes --

    renderLogHeader(total) {
        $('#logHeader').html(`
            <div class="flex items-center justify-between gap-2">
                <div>
                    <h3 class="text-sm font-semibold text-gray-800">Bitácora de movimientos</h3>
                    <p class="text-[11px] text-gray-400">Entradas, salidas, ajustes, traspasos y cancelaciones, con quién los registró</p>
                </div>
                <span class="shrink-0 px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-600">${total} ${total === 1 ? 'movimiento' : 'movimientos'}</span>
            </div>
        `);
    }

    renderLowStock(list) {
        const items = list.map((p) => `
            <div class="flex items-center justify-between gap-2 py-2">
                <p class="text-[13px] font-medium text-gray-700 truncate min-w-0">${invEsc(p.nombre)}</p>
                <span class="shrink-0 px-2 py-0.5 rounded text-[11px] font-semibold ${p.out ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'}">${invEsc(p.stock)} / ${invEsc(p.minimo)}${p.unidad ? ' ' + invEsc(p.unidad) : ''}</span>
            </div>`).join('');

        $('#lowStockCard').html(`
            <div class="mb-2">
                <h3 class="text-sm font-semibold text-gray-800">Por resurtir</h3>
                <p class="text-[11px] text-gray-400">Productos en su mínimo o sin existencia, los más urgentes primero</p>
            </div>
            ${list.length
                ? `<div class="flex flex-col divide-y divide-gray-100">${items}</div>`
                : `<div class="flex flex-col items-center justify-center text-center py-8 gap-2 text-gray-400">
                       <i data-lucide="circle-check" class="w-7 h-7 text-emerald-500"></i>
                       <p class="text-xs">Ningún producto está en su mínimo</p>
                   </div>`}
        `);

        if (window.lucide) lucide.createIcons();
    }
}
