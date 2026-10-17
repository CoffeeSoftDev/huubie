let api = 'ctrl/ctrl-dashboard.php';
let app;

$(async () => {
    app = new App(api, 'root');
    await app.init();
});

class App extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Dashboard';
        this.dataInit = { tipos: [], usuarios: [], sucursal: '' };
        this.rangeFi = moment().subtract(6, 'days').format('YYYY-MM-DD');
        this.rangeFf = moment().format('YYYY-MM-DD');
    }

    async init() {
        const request = await useFetch({ url: this._link, data: { opc: 'init' } });
        if (request && request.status === 200) this.dataInit = request;
        this.render();
    }

    render() {
        this.layout();
        this.renderHeader();
        this.filterBar();
        this.showDashboard();
        this.lsMovimientos();
    }

    // -- Layout --

    layout() {
        this.primaryLayout({
            parent: 'root',
            id: this.PROJECT_NAME,
            class: 'flex mx-2 ',
            heightPreset: 'full',
            card: {
                filterBar: { class: 'w-full ', id: 'filterBar' },
                // Tema light: el contenedor no lleva fondo, cada bloque es su propia tarjeta.
                // Sin alto fijo ni scroll propio: crece con la bitácora y el único scroll
                // es el de la página (#main__content). Con h-screen había dos barras.
                container: { class: 'w-full my-2 rounded p-3', id: 'container' + this.PROJECT_NAME }
            }
        });

        this.createLayout({
            parent: 'filterBar',
            design: false,
            data: {
                id: 'filterBarWrap',
                class: 'w-full',
                container: [
                    {
                        type: 'div',
                        id: `filterBar${this.PROJECT_NAME}`,
                        class: 'w-full my-3'
                    },
                    {
                        type: 'div',
                        id: 'containerHours'
                    }
                ]
            }
        });

        this.createLayout({
            parent: `container${this.PROJECT_NAME}`,
            design: false,
            data: {
                id: 'dashboardBody',
                class: 'flex flex-col gap-3',
                container: [
                    {
                        type: 'div',
                        id: `header${this.PROJECT_NAME}`
                    },
                    {
                        type: 'div',
                        id: `kpis${this.PROJECT_NAME}`
                    },
                    {
                        type: 'div',
                        id: 'dashboardGrid',
                        class: 'grid grid-cols-1 xl:grid-cols-3 gap-3 items-start',
                        children: [
                            {
                                id: 'logCard',
                                class: 'xl:col-span-2 bg-white rounded-lg border border-gray-200 p-3 min-w-0'
                            },
                            {
                                id: 'lowStockCard',
                                class: 'bg-white rounded-lg border border-gray-200 p-3'
                            }
                        ]
                    }
                ]
            }
        });

        // createLayout arma dos niveles: el encabezado y la tabla de la bitácora van aparte.
        this.createLayout({
            parent: 'logCard',
            design: false,
            data: {
                id: 'logBody',
                class: 'flex flex-col gap-2 min-w-0',
                container: [
                    { type: 'div', id: 'logHeader' },
                    // -mx-3 px-3: el .row de DataTables trae margen negativo de 0.75rem por
                    // lado; sin compensarlo, el overflow-x-auto pintaba una barra horizontal.
                    { type: 'div', id: 'logTable', class: 'overflow-x-auto -mx-3 px-3' }
                ]
            }
        });
    }

    // -- Filter bar --

    filterBar() {
        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            coffeesoft: true,
            theme: 'light',
            data: [
                {
                    opc: 'input-calendar',
                    id: 'fRango',
                    lbl: 'Rango:',
                    class: 'col-12 col-md-4 col-lg-3',
                    readonly: true,
                    placeholder: 'Selecciona un rango',
                    required: false
                },
                {
                    opc: 'select',
                    id: 'fTipo',
                    lbl: 'Movimiento:',
                    class: 'col-12 col-md-4 col-lg-2',
                    data: this.dataInit.tipos,
                    onchange: 'app.onChangeFilters()'
                },
                {
                    opc: 'select',
                    id: 'fUsuario',
                    lbl: 'Usuario:',
                    class: 'col-12 col-md-4 col-lg-3',
                    data: this.dataInit.usuarios,
                    onchange: 'app.onChangeFilters()'
                }
            ]
        });

        this.initRangePicker();
    }

    initRangePicker() {
        dataPicker({
            parent: 'fRango',
            type: 'all',
            rangepicker: {
                startDate: moment(this.rangeFi),
                endDate: moment(this.rangeFf),
                showDropdowns: true,
                alwaysShowCalendars: true,
                ranges: {
                    'Hoy': [moment(), moment()],
                    'Ayer': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
                    'Ultimos 7 dias': [moment().subtract(6, 'days'), moment()],
                    'Semana actual': [moment().startOf('isoWeek'), moment().endOf('isoWeek')],
                    'Mes actual': [moment().startOf('month'), moment().endOf('month')],
                    'Mes anterior': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
                },
                locale: {
                    format: 'DD-MM-YYYY',
                    separator: '  a  ',
                    applyLabel: 'Aplicar',
                    cancelLabel: 'Cancelar',
                    customRangeLabel: 'Personalizado',
                    daysOfWeek: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'],
                    monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
                    firstDay: 1
                }
            },
            onSelect: (start, end) => {
                this.rangeFi = start.format('YYYY-MM-DD');
                this.rangeFf = end.format('YYYY-MM-DD');
                this.onChangeFilters();
            }
        });
    }

    getFilters() {
        return {
            fi: this.rangeFi,
            ff: this.rangeFf,
            tipo: $('#fTipo').val() || '',
            user_id: $('#fUsuario').val() || ''
        };
    }

    onChangeFilters() {
        this.lsMovimientos();
    }

    // -- Data --

    async showDashboard() {
        const request = await useFetch({ url: this._link, data: { opc: 'showDashboard' } });
        const ok = request && request.status === 200;
        const c = ok ? request.counts : {};

        this.kpisRow({
            parent: `kpis${this.PROJECT_NAME}`,
            cardClass: 'bg-white rounded-lg border border-gray-200 px-3 py-3 cursor-pointer hover:shadow-md transition-shadow',
            json: [
                {
                    id: 'kpiValor',
                    label: 'Valor del inventario',
                    value: c.valor || '$0.00',
                    tone: 'default',
                    icon: 'wallet'
                },
                {
                    id: 'kpiProductos',
                    label: 'Productos activos',
                    value: c.productos || 0,
                    tone: 'info',
                    icon: 'package'
                },
                {
                    id: 'kpiBajo',
                    label: 'Stock bajo',
                    value: c.bajo || 0,
                    tone: 'warning',
                    icon: 'triangle-alert'
                },
                {
                    id: 'kpiAgotado',
                    label: 'Agotados',
                    value: c.agotado || 0,
                    tone: 'danger',
                    icon: 'package-x'
                }
            ],
            onClick: (kpi) => this.lsKpiDetail(kpi)
        });

        this.renderLowStock(ok ? request.lowStock || [] : []);
    }

    async lsKpiDetail(kpi) {
        const views = {
            kpiValor: {
                title: 'Valor del inventario por producto',
                right: [3, 4, 5]
            },
            kpiProductos: {
                title: 'Productos activos',
                center: [5],
                right: [3, 4]
            },
            kpiBajo: {
                title: 'Productos con stock bajo',
                right: [3, 4, 5]
            },
            kpiAgotado: {
                title: 'Productos agotados',
                right: [3, 4]
            }
        };
        const view = views[kpi.id];
        if (!view) return;

        const request = await useFetch({ url: this._link, data: { opc: 'lsKpiDetail', kpi: kpi.id } });

        if (!(request && request.status === 200)) {
            this.alertBox({ type: 'error', title: (request && request.message) || 'No se pudo cargar el detalle' });
            return;
        }

        const row    = request.row || [];
        const branch = request.sucursal ? ` en ${$('<span>').text(request.sucursal).html()}` : '';

        this.detailModal(Object.assign({}, view, {
            id: kpi.id,
            value: String(kpi.value),
            subtitle: `${row.length} producto${row.length !== 1 ? 's' : ''} · existencias al día de hoy${branch}`,
            emptyMessage: 'No hay productos en este indicador',
            data: { row }
        }));
    }

    // El ojo de la bitácora: los productos que movió la operación.
    async getMovimiento(tipo, folio) {
        const request = await useFetch({ url: this._link, data: { opc: 'getMovimiento', tipo, folio } });

        if (!(request && request.status === 200)) {
            this.alertBox({ type: 'error', title: (request && request.message) || 'No se pudo cargar el detalle' });
            return;
        }

        const h    = request.header || {};
        const esc  = (str) => $('<span>').text(str == null ? '' : String(str)).html();
        const nota = h.nota ? ` · Nota: ${esc(h.nota)}` : '';

        this.detailModal({
            id: 'movimiento',
            title: `Detalle de la operación · ${esc(h.folio)}`,
            value: h.costo ? `${h.badge} <span class="ml-1">${esc(h.costo)}</span>` : h.badge,
            subtitle: `${esc(h.fecha)} · Registró ${esc(h.usuario)} · ${esc(h.almacen)} · ${h.productos} producto${h.productos !== 1 ? 's' : ''}${nota}`,
            center: [3],
            right: [2, 4, 5],
            emptyMessage: 'La operación no tiene productos',
            data: { row: request.row || [] }
        });
    }

    async lsMovimientos() {
        const request = await useFetch({
            url: this._link,
            data: Object.assign({ opc: 'lsMovimientos' }, this.getFilters())
        });

        const data = { row: request && request.status === 200 ? request.row : [] };

        this.renderLogHeader(data.row.length);

        this.createCoffeeTable3({
            parent: 'logTable',
            id: `tb${this.PROJECT_NAME}`,
            theme: 'light',
            center: [1, 2, 3, 6],
            right: [7, 8],
            extends: true,
            scrollable: false,
            striped: true,
            f_size: 12,
            emptyMessage: 'No hay movimientos con los filtros aplicados',
            emptyIcon: 'icon-history',
            data: data
        });

        if (window.lucide) lucide.createIcons();

        if (data.row.length && typeof simple_data_table === 'function') {
            simple_data_table(`#tb${this.PROJECT_NAME}`, 15);
        }
    }

    // -- Components --

    renderHeader() {
        const title = $('<h2>', { class: 'text-lg font-bold text-gray-800', text: 'Dashboard del almacén' });

        if (this.dataInit.sucursal) {
            title.append($('<span>', {
                class: 'font-bold',
                style: 'color:rgb(var(--brand-600, 192 90 64));',
                text: ` · ${this.dataInit.sucursal}`
            }));
        }

        $(`#header${this.PROJECT_NAME}`).html($('<div>').append(
            title,
            $('<p>', { class: 'text-xs text-gray-500', text: 'Indicadores del stock y bitácora de movimientos de todos los usuarios de la sucursal' })
        ));
    }

    renderLogHeader(total) {
        $('#logHeader').html($('<div>', { class: 'flex items-center justify-between gap-2' }).append(
            $('<div>').append(
                $('<h3>', { class: 'text-sm font-semibold text-gray-800', text: 'Bitácora de movimientos' }),
                $('<p>', { class: 'text-[11px] text-gray-400', text: 'Entradas, salidas, ajustes y traspasos aplicados, con quién los registró' })
            ),
            $('<span>', {
                class: 'shrink-0 px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-600',
                text: `${total} ${total === 1 ? 'movimiento' : 'movimientos'}`
            })
        ));
    }

    renderLowStock(list) {
        const header = $('<div>', { class: 'mb-2' }).append(
            $('<h3>', { class: 'text-sm font-semibold text-gray-800', text: 'Por resurtir' }),
            $('<p>', { class: 'text-[11px] text-gray-400', text: 'Productos en su mínimo o sin existencia, los más urgentes primero' })
        );

        const body = list.length
            ? $('<div>', { class: 'flex flex-col divide-y divide-gray-100' }).append(list.map(p => this.lowStockItem(p)))
            : $('<div>', { class: 'flex flex-col items-center justify-center text-center py-8 gap-2 text-gray-400' }).append(
                $('<i>', { 'data-lucide': 'circle-check', class: 'w-7 h-7 text-emerald-500' }),
                $('<p>', { class: 'text-xs', text: 'Ningún producto está en su mínimo' })
            );

        $('#lowStockCard').html([header, body]);
        if (window.lucide) lucide.createIcons();
    }

    // Mismo modal de solo lectura que el desglose de las cards de Salidas y Entradas:
    // lo usan las cards del dashboard y el ojo de la bitácora.
    detailModal(options) {
        const defaults = {
            id: 'detail',
            title: '',
            value: '',
            subtitle: '',
            size: 'xl',
            center: [],
            right: [],
            emptyMessage: 'Sin información',
            data: { row: [] }
        };

        const opts    = Object.assign({}, defaults, options || {});
        const modal   = this.cfModal({ title: opts.title, size: opts.size, backdropClose: true });
        const tableId = `tb${opts.id}${this.PROJECT_NAME}`;

        // Solo lectura: se cierra con la X, Escape o clic afuera. -mx-3 px-3 compensa
        // el margen negativo del .row de DataTables (si no, sale barra horizontal).
        modal.footer.remove();
        modal.body.attr('id', `${opts.id}${this.PROJECT_NAME}`).addClass('-mx-3 px-3');

        this.createCoffeeTable3({
            parent: `${opts.id}${this.PROJECT_NAME}`,
            id: tableId,
            theme: 'light',
            title: opts.value,
            subtitle: opts.subtitle,
            center: opts.center,
            right: opts.right,
            extends: true,
            scrollable: false,
            striped: true,
            f_size: 12,
            emptyMessage: opts.emptyMessage,
            emptyIcon: 'icon-box',
            data: opts.data
        });

        // Listas largas (todos los productos activos): buscador y páginas de 8, que caben
        // sin scroll en el modal de una laptop.
        if (opts.data.row.length > 8 && typeof simple_data_table === 'function') {
            simple_data_table(`#${tableId}`, 8);
        }

        if (window.lucide) lucide.createIcons();
    }

    lowStockItem(p) {
        const out = Number(p.stock) <= 0;

        return $('<div>', { class: 'flex items-center justify-between gap-2 py-2' }).append(
            $('<p>', { class: 'text-[13px] font-medium text-gray-700 truncate min-w-0', text: p.nombre }),
            $('<span>', {
                class: 'shrink-0 px-2 py-0.5 rounded text-[11px] font-semibold ' + (out ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-700'),
                text: `${p.stock} / ${p.minimo}${p.unidad ? ' ' + p.unidad : ''}`
            })
        );
    }
}
