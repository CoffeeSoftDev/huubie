let apiOrdenes = 'ctrl/ctrl-ordenes.php';
let app, ordenes, ordenesView, asistentePedidos, calendarioPedidos;

$(async () => {
    ordenesView       = new OrdenesView(apiOrdenes, 'root');
    ordenes           = new Ordenes(apiOrdenes, 'root');
    calendarioPedidos = new CalendarioPedidos(apiOrdenes, 'root');
    app               = new App(apiOrdenes, 'root');
    await app.init();
});

// ============================================================
// App — bootstrap, layout, filterBar, navegación
// ============================================================

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'ordenes';
        // Requisiciones (quien pide) o Despacho (quien surte): lo fija la página que carga
        // este JS (ORDENES_MODULO en layout/ordenes-page.php). `lado` es la vista de su lista.
        this.modulo       = window.ORDENES_MODULO === 'despacho' ? 'despacho' : 'requisiciones';
        this.lado         = this.modulo === 'despacho' ? 'entregas' : 'pedidos';
        this.subId        = null;
        this.selectedId   = null;
        this.vista        = this.lado;
    }

    async init() {
        // `modulo`: el ctrl revisa la casilla IA del rol en este módulo (ícono de CoffeeIA).
        const r = await useFetch({ url: apiOrdenes, data: { opc: 'init', modulo: this.modulo } });
        if (r && r.status === 200) {
            this.dataInit = {
                companies_id:  r.companies_id  || '',
                branch_id:     r.branch_id     || '',
                user_id:       r.user_id       || '',
                is_admin:      Number(r.is_admin || 0),
                coffeeia:      !!r.coffeeia,
                sucursales:    r.sucursales    || [],
                // A quién se le puede pedir (todas las de la empresa) y la sucursal del
                // almacén principal, que es a la que se le pide por defecto.
                destinos:      r.destinos      || [],
                principal:     r.principal     || null,
                almacenes:     r.almacenes     || [],
                categorias:    r.categorias    || [],
                unidades:      r.unidades      || [],
                productos:     r.productos     || [],
                solo_su_sucursal: !!r.solo_su_sucursal,
                estados_orden: r.estados_orden || []
            };
        } else {
            this.dataInit = {
                companies_id:  '',
                branch_id:     '',
                user_id:       '',
                is_admin:      0,
                sucursales:    [],
                destinos:      [],
                principal:     null,
                almacenes:     [],
                categorias:    [],
                unidades:      [],
                productos:     [],
                estados_orden: []
            };
        }
        this.subId = this.dataInit.branch_id;
        // Cada módulo arranca en su lista. Desde la campana de la barra (?pedido=id&folio=...)
        // Despacho abre esa requisición con su detalle.
        const aviso = new URLSearchParams(window.location.search);
        this.vista = this.lado;
        this.render();
        if (aviso.get('pedido')) this.selectOrden(aviso.get('folio') || aviso.get('pedido'), Number(aviso.get('pedido')));

        if (this.dataInit.coffeeia) {
            asistentePedidos = new AsistentePedidos(apiOrdenes, 'root');
            asistentePedidos.renderLauncher();
        }
    }

    render() {
        this.layout();
        this.visorResize({ key: 'ordenes', label: 'Ancho del detalle del pedido' });
        this.filterBar();
        ordenesView.renderHeader(this.modulo === 'despacho' ? {
            title:    'Surtir',
            subtitle: 'Surte las requisiciones que le hacen a tu sucursal'
        } : {
            title:    'Requisiciones',
            subtitle: 'Pide materiales al almacén y sigue el estado de tus requisiciones'
        });
        this.renderTabs();
        ordenesView.renderDetail(null);
        this.populateFilters();
        ordenesView.renderMovil();
        this.syncVista();
        ordenes.lsOrdenes();
    }

    layout() {
        const mainPanel = {
            type:  'div',
            id:    'mainPanel',
            class: 'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 w-full',
            children: [
                {
                    id:    'headerRow',
                    class: 'px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'filterBar',
                    class: 'px-3 py-3 bg-white border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'legendRow',
                    class: 'hidden px-3 py-1.5 bg-white border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'tableWrap',
                    class: 'p-3 flex-1 min-h-0 overflow-auto bg-white'
                },
                // Pestaña Calendario (CalendarioPedidos): en su lugar va la tabla.
                {
                    id:    'calendarWrap',
                    class: 'hidden p-3 flex-1 min-h-0 overflow-auto bg-white'
                }
            ]
        };

        // Tirador entre la tabla y el visor (visorResize). El visor está abierto desde el
        // inicio (sin pedido muestra "Selecciona un pedido"): así la tabla no cambia de
        // ancho al abrir uno.
        const detailResizer = {
            type:  'div',
            id:    'detailResizer',
            class: "hidden md:block relative z-[5] flex-shrink-0 w-[6px] -mx-[3px] cursor-col-resize touch-none after:content-[''] after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] after:-translate-x-1/2 after:rounded-full after:transition-colors hover:after:bg-gray-400"
        };

        const detailPanel = {
            type:  'aside',
            id:    'detailPanel',
            class: 'w-full md:w-[var(--ordenes-detail-w,420px)] md:max-w-[60vw] flex-shrink-0 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col overflow-hidden',
            children: [
                {
                    id:    'emptyDetail',
                    class: 'flex-1 flex flex-col items-center justify-center text-center px-6'
                },
                {
                    id:    'detailContent',
                    class: 'hidden flex-1 flex flex-col overflow-hidden'
                }
            ]
        };

        // Escritorio (tabla + visor) desde md; debajo, la vista de teléfono (renderMovil).
        // Las dos se pintan con la misma consulta.
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        'ordenesShell',
                class:     'flex-1 min-h-0 w-full flex flex-col',
                container: [
                    {
                        type:  'div',
                        id:    'ordenesDesk',
                        class: 'hidden md:flex flex-1 min-h-0 w-full'
                    },
                    {
                        type:  'div',
                        id:    'ordenesMovil',
                        class: 'md:hidden'
                    }
                ]
            }
        });

        this.createLayout({
            parent: 'ordenesDesk',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'cs-visor flex-1 min-h-0 w-full flex flex-col md:flex-row overflow-hidden bg-white rounded-lg border border-gray-200',
                container: [mainPanel, detailResizer, detailPanel]
            }
        });

        this.createLayout({
            parent: 'headerRow',
            design: false,
            data: {
                id:        'headerRowWrap',
                class:     'flex items-center justify-between gap-3',
                container: [
                    {
                        type:  'div',
                        id:    'viewHeader',
                        class: 'flex-1 min-w-0'
                    },
                    {
                        type:  'div',
                        id:    'tabsRow',
                        class: 'flex-shrink-0'
                    }
                ]
            }
        });
    }

    // -- Tabs --

    // Lista = en Requisiciones lo que pide mi sucursal y en Despacho lo que le piden;
    // Calendario = esas mismas, en el día en que se necesitan.
    renderTabs() {
        const despacho = this.modulo === 'despacho';
        this.tabLayout({
            parent:          'tabsRow',
            id:              'tabsOrdenes',
            type:            'button',
            theme:           'light',
            renderContainer: false,
            json: [
                { id: this.lado,    tab: 'Lista',      lucideIcon: despacho ? 'truck' : 'list', active: this.vista === this.lado    },
                { id: 'calendario', tab: 'Calendario', lucideIcon: 'calendar-days',             active: this.vista === 'calendario' }
            ],
            onChange: (tabId) => this.onChangeTab(tabId)
        });
    }

    onChangeTab(tabId) {
        this.vista = tabId;
        this.selectOrden(null);
        this.syncVista();
        ordenes.lsOrdenes();
    }

    // "Nueva requisición" solo en Requisiciones (lista y calendario): Surtir aprueba y surte.
    // Los dos módulos filtran por los estados de la requisición y arrancan con todos.
    syncVista() {
        const entregas   = this.vista === 'entregas';
        const calendario = this.vista === 'calendario';

        $('#btnNuevaOrden').parent().toggleClass('hidden', this.modulo === 'despacho');
        $('#fEstado').empty().append((this.dataInit.estados_orden || []).map(e => $('<option>', { value: e.id, text: e.valor })));
        $('#fEstado').val('');

        $('#tableWrap').toggleClass('hidden', calendario);
        $('#calendarWrap').toggleClass('hidden', !calendario);

        this.renderLegends(entregas);
        ordenesView.syncMovil();
    }

    // El detalle se porta como el módulo: en Requisiciones como quien pide y en Despacho
    // como quien surte, también en el Calendario (cada uno solo ve su lado).
    vistaOrden() {
        return this.lado;
    }

    // Solo en Mis entregas: qué significa el punto verde (bajo el título) y la línea de
    // colores de estado (bajo los filtros).
    renderLegends(entregas) {
        $('#leyendaPunto').remove();
        $('#legendRow').empty().toggleClass('hidden', !entregas);
        if (!entregas) return;

        $('#viewHeader').find('h1').first().parent().append(
            $('<p>', { id: 'leyendaPunto', class: 'mt-0.5 flex items-center gap-1.5 text-[10px] text-gray-400' })
                .append($('<span>', { class: 'inline-block w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse' }))
                .append($('<span>', { text: 'Punto verde: requisición en espera, nueva por surtir' }))
        );

        const leyenda = [
            {
                color: '#D97706',
                text:  'En espera: te toca surtirla'
            },
            {
                color: 'rgb(var(--brand-700, 168 74 51))',
                text:  'Entregado: falta que quien pidió lo confirme'
            },
            {
                color: '#EA580C',
                text:  'Surtido parcialmente: puedes seguir surtiendo'
            },
            {
                color: '#16A34A',
                text:  'Confirmado: quien pidió ya lo recibió'
            }
        ];

        this.createLayout({
            parent: 'legendRow',
            design: false,
            data: {
                id:        'legendBar',
                class:     'flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-500',
                container: [
                    {
                        type:  'span',
                        class: 'font-semibold text-gray-600',
                        text:  'Cómo va cada pedido:'
                    }
                ].concat(leyenda.map(e => ({
                    type:     'div',
                    class:    'flex items-center gap-1.5',
                    children: [
                        {
                            type:  'span',
                            class: 'inline-block w-1.5 h-1.5 rounded-full flex-shrink-0',
                            style: `background:${e.color}`
                        },
                        {
                            type: 'span',
                            text: e.text
                        }
                    ]
                })))
            }
        });
    }

    filterBar() {
        const estados = this.dataInit.estados_orden || [];

        const filters = [
            {
                opc:         'input',
                id:          'fRango',
                lbl:         'Rango:',
                class:       'col-12 col-md-4 col-lg-1',
                readonly:    true,
                placeholder: 'Selecciona un rango',
                value:       '',
                required:    false
            },
            {
                opc:      'select',
                id:       'branch_id',
                lbl:      'Sucursal:',
                class:    'col-12 col-md-4 col-lg-1',
                onchange: 'app.onChangeFilters()',
                data:     [{ id: '', valor: '-- Todas --' }]
            },
            {
                opc:      'select',
                id:       'fEstado',
                lbl:      'Estado:',
                class:    'col-12 col-md-4 col-lg-1',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     estados
            },
            {
                opc:       'button',
                id:        'btnNuevaOrden',
                text:      'Nueva requisición',
                color_btn: 'invernal',
                className: 'w-100 h-[34px]',
                class:     'col-12 col-md-4 col-lg-1',
                onClick:   () => ordenesView.openNuevaOrden()
            }
        ];

        this.createfilterBar({
            parent:     'filterBar',
            id:         'filterFormOrdenes',
            coffeesoft: true,
            theme:      'light',
            data:       filters
        });

        $('#filterFormOrdenes').addClass('lg:grid-cols-4');

        this.initRangePicker();
    }

    initRangePicker() {
        $('#fRango').addClass('!pl-10').wrap('<div class="relative"></div>').before(
            $('<span>', { class: 'pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center' })
                .append($('<i>', { 'data-lucide': 'calendar', class: 'w-4 h-4' }))
        );

        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Pedidos y entregas consultan los últimos 30 días.
        this.rangeFi = moment().subtract(29, 'days').format('YYYY-MM-DD');
        this.rangeFf = moment().format('YYYY-MM-DD');

        dataPicker({
            parent: 'fRango',
            type:   'all',
            rangepicker: {
                startDate:           moment().subtract(29, 'days'),
                endDate:             moment(),
                showDropdowns:       true,
                alwaysShowCalendars: true,
                ranges: {
                    'Hoy':            [moment(), moment()],
                    'Ayer':           [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
                    'Últimos 7 días': [moment().subtract(6, 'days'), moment()],
                    'Semana actual':  [moment().startOf('isoWeek'), moment().endOf('isoWeek')],
                    'Mes actual':     [moment().startOf('month'), moment().endOf('month')],
                    'Mes anterior':   [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
                },
                // Mismo formato que Entradas y Salidas; la consulta usa rangeFi / rangeFf.
                locale: {
                    format:           'DD-MM-YYYY',
                    separator:        '  a  ',
                    applyLabel:       'Aplicar',
                    cancelLabel:      'Cancelar',
                    customRangeLabel: 'Personalizado',
                    daysOfWeek:       ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'],
                    monthNames:       ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
                    firstDay:         1
                }
            },
            onSelect: (start, end) => {
                this.rangeFi = start.format('YYYY-MM-DD');
                this.rangeFf = end.format('YYYY-MM-DD');
                // En el Calendario el rango lleva al calendario a su primer día.
                if (this.vista === 'calendario') calendarioPedidos.irA(this.rangeFi);
                this.onChangeFilters();
            }
        });
    }

    // El almacenista, en Surtir, se queda con la sucursal con la que entró (solo_su_sucursal).
    populateFilters() {
        const sucursales = this.dataInit.sucursales || [];
        const fija       = this.modulo === 'despacho' && this.dataInit.solo_su_sucursal;

        if (sucursales.length) {
            this.populateSelect('branch_id', sucursales);
        }
        if (sucursales.length <= 1 || fija) {
            $('#branch_id').find('option[value=""]').remove();
            $('#branch_id').val(this.subId).prop('disabled', true);
        } else {
            $('#branch_id').val(this.subId);
        }
    }

    populateSelect(id, data) {
        const $sel = $(`#${id}`);
        if (!$sel.length) return;
        $sel.find('option:not(:first)').remove();
        data.forEach(item => {
            if (item.id === '' && $sel.find('option').first().val() === '') return;
            $sel.append(`<option value="${item.id}">${item.valor}</option>`);
        });
    }

    getFilters() {
        const $branch = $('#branch_id');
        return {
            vista:       this.vista,
            branch_id:   $branch.length ? ($branch.val() || '') : (this.subId || ''),
            status:      $('#fEstado').val()    || '',
            fi:          this.rangeFi           || '',
            ff:          this.rangeFf           || '',
            q:           $('#qBuscar').val()    || ''
        };
    }

    async onChangeFilters() {
        await ordenes.lsOrdenes();
        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectOrden(null);
        }
    }

    isVisibleAfterFilters(folio) {
        return $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
            return $(this).text().includes(folio);
        }).length > 0;
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }

    selectOrden(folio, id) {
        this.selectedId = folio;
        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');
        if (folio) {
            const $row = $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
                return $(this).text().includes(folio);
            });
            $row.addClass('row-active');
            ordenes.getOrden(id);
        } else {
            ordenesView.renderDetail(null);
        }
    }
}

// ============================================================
// Ordenes — datos, tabla, impresión
// ============================================================

class Ordenes extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'ordenes';
    }

    async lsOrdenes() {
        // En el Calendario la consulta es la del rango visible (CalendarioPedidos).
        if (app.vista === 'calendario') {
            calendarioPedidos.render();
            return;
        }

        const f = app.getFilters();
        const r = await useFetch({
            url:  apiOrdenes,
            data: Object.assign({ opc: 'lsOrdenes' }, {
                vista:       f.vista,
                branch_id:   f.branch_id,
                status:      f.status,
                fi:          f.fi,
                ff:          f.ff,
                q:           f.q
            })
        });

        const data = (r && r.status === 200) ? { row: r.row } : { row: [] };

        if (ordenesView.movil) ordenesView.movil.setCards((r && r.status === 200 && r.cards) || []);

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'light',
            center:       [1, 2, 3, 5, 6],
            right:        [],
            actionsAlign: 'left',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       12,
            emptyMessage: 'No se encontraron pedidos con los filtros aplicados',
            emptyIcon:    'clipboard-list',
            data:         data
        });

        if (window.lucide) lucide.createIcons();

        const total = (data.row || []).length;
        if (total > 0 && typeof simple_data_table === 'function') {
            simple_data_table(`#tb${this.PROJECT_NAME}`, 10);
        }

        // createCoffeeTable3 capitaliza cada palabra del encabezado ("Fecha De Pedido").
        $(`#tb${this.PROJECT_NAME} thead th`).removeClass('capitalize');
        app.updateFooterInfo(`Mostrando ${total} ${total !== 1 ? 'pedidos' : 'pedido'}`);
    }

    async getOrden(id) {
        const r = await useFetch({ url: apiOrdenes, data: { opc: 'getOrden', id: id } });
        if (r && r.status === 200) {
            ordenesView.renderDetail(this.mapOrdenDetail(r.header || {}, r.detail || [], r.surtidos || []));
        } else {
            ordenesView.renderDetail(null);
        }
    }

    // `surtidos` = historial de surtimiento (Terminar de surtir).
    mapOrdenDetail(h, detail, surtidos = []) {
        return {
            id:               h.id,
            folio:            h.folio,
            status:           h.status,
            // El que se le muestra: En espera, Entregado, Surtido parcialmente o Confirmado.
            estado:           h.estado || h.status || '',
            status_badge:     h.status_badge || '',
            supplier_id:      h.supplier_id,
            supplier_name:    h.supplier_name || '',
            branch_id:        h.branch_id,
            branch_name:      h.branch_name  || '',
            destination_branch_id:   h.destination_branch_id,
            destination_branch_name: h.destination_branch_name || '',
            warehouse_id:     h.warehouse_id,
            warehouse_name:   h.warehouse_name || '',
            date_order:       h.date_order    || '',
            created_at:       h.created_at    || '',
            expected_date:    h.expected_date || '',
            note:             h.note          || '',
            user_id:          h.user_id       || '',
            user_name:        h.user_name     || '',
            approved_user_name: h.approved_user_name || '',
            approved_at:      h.approved_at   || '',
            approval_note:    h.approval_note || '',
            reject_reason:    h.reject_reason || '',
            expected_date_user_name: h.expected_date_user_name || '',
            expected_date_at: h.expected_date_at || '',
            // Surtido de otra sucursal: entradas ENT- que generó y el «Recibí» de quien pidió.
            entradas_surtido:     h.entradas_surtido || '',
            surtidos_por_recibir: parseInt(h.surtidos_por_recibir || 0, 10),
            received_confirmed_at:        h.received_confirmed_at || '',
            received_confirmed_user_id:   h.received_confirmed_user_id || '',
            received_confirmed_user_name: h.received_confirmed_user_name || '',
            surtidos: (surtidos || []).map(s => ({
                fecha:   s.created_at || '',
                usuario: s.user_name  || '',
                unidades: Number(s.total_units || 0),
                importe:  Number(s.total_cost  || 0),
                tipo:     s.exit_type === 'manual' ? 'Salida manual' : 'Salida automática',
                salida:   s.salida_folio || ''
            })),
            total_products:   parseInt(h.total_products || 0, 10),
            total_units:      Number(h.total_units  || 0),
            total_cost:       Number(h.total_cost   || 0),
            productos: (detail || []).map(d => ({
                detailId:          d.id,
                product_id:        d.product_id,
                nombre:            d.product_name,
                sku:               d.sku         || '',
                image:             d.image       || '',
                unit_id:           d.unit_id,
                unidad:            d.unidad      || '',
                quantity_ordered:  Number(d.quantity_ordered  || 0),
                quantity_received: Number(d.quantity_received || 0),
                price_without_tax: d.price_without_tax != null ? Number(d.price_without_tax) : null,
                tax:               d.tax  != null ? Number(d.tax)  : 0,
                cost:              d.cost != null ? Number(d.cost) : null,
                subtotal:          Number(d.subtotal || 0),
                nota:              d.note || '',
                // Lo que el almacén entregó en lugar de lo pedido (Revisar y aprobar).
                delivered_id:      d.delivered_item_id ? String(d.delivered_item_id) : '',
                delivered_nombre:  d.delivered_name   || '',
                delivered_sku:     d.delivered_sku    || '',
                delivered_unidad:  d.delivered_unidad || ''
            }))
        };
    }

    async printOrden(arg) {
        let o = arg;
        if (!o || typeof o !== 'object') {
            const r = await useFetch({ url: apiOrdenes, data: { opc: 'printOrden', id: arg } });
            if (!(r && r.status === 200)) {
                this.alertBox({ type: 'error', title: 'No se pudo cargar el pedido para imprimir' });
                return;
            }
            o = this.mapOrdenDetail(r.header || {}, r.detail || []);
        }
        // Solicitada = todavía hay que conseguir los productos: se imprime la lista de compras.
        if (o.status === 'Solicitada') this._renderListaCompras(o);
        else this._renderOrdenDoc(o);
    }

    // Formato de compras: lo pedido para abastecer, con casilla para palomear y
    // espacio para anotar lo que de verdad se compró y a qué precio.
    _renderListaCompras(o) {
        const esc      = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fmtNum   = (n) => (Number(n) % 1 === 0) ? String(Number(n)) : Number(n).toFixed(2);
        const DOW = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
        const MON = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const fmtFecha = (raw) => {
            if (!raw) return '-';
            const d = new Date(String(raw).length <= 10 ? raw + 'T00:00:00' : String(raw).replace(' ', 'T'));
            if (isNaN(d.getTime())) return raw;
            return `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2,'0')} ${MON[d.getMonth()]} ${d.getFullYear()}`;
        };

        const productos = o.productos || [];
        const totals    = productos.reduce((acc, p) => {
            acc.uds += Math.max(0, p.quantity_ordered - p.quantity_received);
            return acc;
        }, { uds: 0 });

        const rowsHtml = productos.map(p => {
            const cant = Math.max(0, p.quantity_ordered - p.quantity_received);
            return `<tr>
                <td class="c"><span class="check"></span></td>
                <td><span class="prod-name">${esc(p.nombre)}</span>${p.sku ? ` <span class="sku">${esc(p.sku)}</span>` : ''}</td>
                <td class="c">${esc(p.unidad || '-')}</td>
                <td class="c qty">${fmtNum(cant)}</td>
                <td class="fill"></td>
                <td class="fill"></td>
            </tr>`;
        }).join('');

        const surtir = [o.destination_branch_name, o.warehouse_name].filter(Boolean).map(esc).join(' &middot; ');

        const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Lista de compras ${esc(o.folio||'')}</title>
        <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#c8c8c8;color:#000;padding:24px}.toolbar{width:816px;max-width:100%;margin:0 auto 16px;display:flex;justify-content:flex-end;gap:8px}.btn{cursor:pointer;border:1px solid #000;border-radius:4px;padding:8px 16px;font-size:13px;font-weight:600;color:#fff;background:#333}.btn.gray{background:#777}.sheet{width:816px;max-width:100%;min-height:1056px;margin:0 auto;background:#fff;padding:40px 48px;box-shadow:0 2px 10px rgba(0,0,0,.25)}.doc-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:18px}.doc-title{font-size:22px;font-weight:800}.folio{font-size:20px;font-weight:800;text-align:right}.status{display:inline-block;margin-top:6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:2px 10px;border:1px solid #000;border-radius:3px}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 40px;margin-bottom:18px}.info-item{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #ccc;padding-bottom:4px;font-size:12px}.info-item .k{color:#555}.info-item .v{font-weight:700;text-align:right}table{width:100%;border-collapse:collapse;margin-bottom:18px}thead th{border-bottom:1.5px solid #000;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:4px 6px;text-align:left}thead th.r{text-align:right}thead th.c{text-align:center}tbody td{padding:7px 6px;font-size:11px;border-bottom:1px solid #d4d4d4;vertical-align:middle}tbody td.r{text-align:right;white-space:nowrap}tbody td.c{text-align:center;white-space:nowrap}td.qty{font-size:13px;font-weight:800}td.fill{width:90px;border-bottom:1px solid #000}.check{display:inline-block;width:14px;height:14px;border:1.5px solid #000;border-radius:2px}.prod-name{font-weight:600}.sku{color:#777;font-size:10px}.totals{display:flex;justify-content:flex-end}.totals-box{width:280px;border:1px solid #000;border-radius:4px;padding:10px 14px}.totals-row{display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px}.totals-row.grand{border-top:1.5px solid #000;margin-top:4px;padding-top:8px;font-size:15px;font-weight:800}@media print{body{background:#fff;padding:0}.toolbar{display:none}.sheet{width:auto;min-height:auto;box-shadow:none;padding:0}}</style>
        </head><body>
        <div class="toolbar"><button class="btn" onclick="window.print()">Imprimir</button><button class="btn gray" onclick="window.close()">Cerrar</button></div>
        <div class="sheet">
            <div class="doc-header">
                <div>
                    <div class="doc-title">Lista de compras</div>
                    <div style="font-size:12px;color:#555;margin-top:3px">Productos solicitados para abastecer</div>
                </div>
                <div>
                    <div class="folio">${esc(o.folio||'-')}</div>
                    <span class="status">${esc(o.estado || o.status)}</span>
                </div>
            </div>
            <div class="info-grid">
                <div class="info-item"><span class="k">Fecha solicitud</span><span class="v">${esc(fmtFecha(o.date_order))}</span></div>
                <div class="info-item"><span class="k">Solicita</span><span class="v">${esc(o.branch_name||'-')}</span></div>
                <div class="info-item"><span class="k">Abastecer en</span><span class="v">${surtir||'-'}</span></div>
                <div class="info-item"><span class="k">Solicitado por</span><span class="v">${esc(o.user_name||'-')}</span></div>
                ${o.expected_date?`<div class="info-item"><span class="k">Fecha esperada</span><span class="v">${esc(fmtFecha(o.expected_date))}</span></div>`:''}
            </div>
            <table>
                <thead>
                    <tr>
                        <th class="c" style="width:28px"></th>
                        <th>Producto</th>
                        <th class="c">Unidad</th>
                        <th class="c">Comprar</th>
                        <th class="c">Comprado</th>
                        <th class="c">Precio real</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml||'<tr><td colspan="6" class="c">Sin productos</td></tr>'}</tbody>
            </table>
            <div class="totals">
                <div class="totals-box">
                    <div class="totals-row"><span>Productos</span><span>${productos.length}</span></div>
                    <div class="totals-row"><span>Unidades a comprar</span><span>${fmtNum(totals.uds)}</span></div>
                </div>
            </div>
            ${o.note?`<div style="margin-top:18px;border-left:3px solid #000;background:#f7f7f7;padding:10px 14px;font-size:12px"><b style="display:block;margin-bottom:3px;text-transform:uppercase;font-size:10px;letter-spacing:.5px;color:#555">Nota</b>${esc(o.note)}</div>`:''}
        </div></body></html>`;

        const w = window.open('', '_blank', 'width=900,height=1000');
        if (!w) {
            this.alertBox({ type: 'warning', title: 'Permite las ventanas emergentes para poder ver el documento.' });
            return;
        }
        w.document.write(html);
        w.document.close();
        w.focus();
    }

    _renderOrdenDoc(o) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const DOW = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
        const MON = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const fmtFecha = (raw) => {
            if (!raw) return '-';
            const iso = String(raw).length <= 10 ? raw + 'T00:00:00' : String(raw).replace(' ', 'T');
            const d = new Date(iso);
            if (isNaN(d.getTime())) return raw;
            return `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2,'0')} ${MON[d.getMonth()]} ${d.getFullYear()}`;
        };

        const productos = o.productos || [];
        const totals = productos.reduce((acc, p) => {
            acc.uds   += p.quantity_ordered;
            acc.recib += p.quantity_received;
            return acc;
        }, { uds: 0, recib: 0 });

        // Recibida: el documento muestra solo lo que llegó, con su unidad.
        const soloRecibido = o.status === 'Recibida';

        const rowsHtml = productos.map(p => {
            const recibido  = p.quantity_received;
            const pendiente = Math.max(0, p.quantity_ordered - recibido);
            if (soloRecibido) {
                const unidad = p.delivered_id ? (p.delivered_unidad || p.unidad) : p.unidad;
                return `<tr>
                <td class="prod">
                    <span class="prod-name">${esc(p.nombre)}</span>
                    ${p.sku ? `<span class="sku">${esc(p.sku)}</span>` : ''}
                    ${p.delivered_id ? `<div class="sku" style="margin-left:0">Se entregó: ${esc(p.delivered_nombre)}</div>` : ''}
                </td>
                <td class="c">${esc(unidad || '-')}</td>
                <td class="c">${esc(recibido)}</td>
            </tr>`;
            }
            return `<tr>
                <td class="prod">
                    <span class="prod-name">${esc(p.nombre)}</span>
                    ${p.sku ? `<span class="sku">${esc(p.sku)}</span>` : ''}
                    ${p.delivered_id ? `<div class="sku" style="margin-left:0">Se entregó: ${esc(p.delivered_nombre)}${p.delivered_unidad ? ` (${esc(p.delivered_unidad)})` : ''}</div>` : ''}
                </td>
                <td class="c">${esc(p.quantity_ordered)}</td>
                <td class="c">${recibido > 0 ? `<span style="color:#3FC189;font-weight:700">${recibido}</span>` : '<span style="color:#9CA3AF">—</span>'}</td>
                <td class="c" style="color:${pendiente > 0 ? '#F97316' : '#9CA3AF'}">${pendiente > 0 ? pendiente : '—'}</td>
            </tr>`;
        }).join('');

        const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Pedido ${esc(o.folio||'')}</title>
        <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#c8c8c8;color:#000;padding:24px}.toolbar{width:816px;max-width:100%;margin:0 auto 16px;display:flex;justify-content:flex-end;gap:8px}.btn{cursor:pointer;border:1px solid #000;border-radius:4px;padding:8px 16px;font-size:13px;font-weight:600;color:#fff;background:#333}.btn.gray{background:#777}.sheet{width:816px;max-width:100%;min-height:1056px;margin:0 auto;background:#fff;padding:40px 48px;box-shadow:0 2px 10px rgba(0,0,0,.25)}.doc-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:18px}.doc-title{font-size:22px;font-weight:800}.folio{font-size:20px;font-weight:800;text-align:right}.status{display:inline-block;margin-top:6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:2px 10px;border:1px solid #000;border-radius:3px}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 40px;margin-bottom:18px}.info-item{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #ccc;padding-bottom:4px;font-size:12px}.info-item .k{color:#555}.info-item .v{font-weight:700;text-align:right}table{width:100%;border-collapse:collapse;margin-bottom:18px}thead th{border-bottom:1.5px solid #000;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:4px 8px;text-align:left}thead th.r{text-align:right}thead th.c{text-align:center}tbody td{padding:3px 8px;font-size:11px;border-bottom:1px solid #e2e2e2}tbody td.r{text-align:right;white-space:nowrap}tbody td.c{text-align:center;white-space:nowrap}.prod-name{font-weight:600}.sku{color:#777;font-size:10px;margin-left:4px}.totals{display:flex;justify-content:flex-end}.totals-box{width:280px;border:1px solid #000;border-radius:4px;padding:10px 14px}.totals-row{display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px}.totals-row.grand{border-top:1.5px solid #000;margin-top:4px;padding-top:8px;font-size:16px;font-weight:800}.doc-footer{margin-top:28px;display:flex;justify-content:space-between;font-size:10px;color:#777;border-top:1px solid #ccc;padding-top:10px}.reject-box{margin-bottom:18px;border-left:3px solid #E02424;background:#FEF2F2;padding:10px 14px;font-size:12px}@media print{body{background:#fff;padding:0}.toolbar{display:none}.sheet{width:auto;min-height:auto;box-shadow:none;padding:0}}</style>
        </head><body>
        <div class="toolbar"><button class="btn" onclick="window.print()">Imprimir</button><button class="btn gray" onclick="window.close()">Cerrar</button></div>
        <div class="sheet">
            <div class="doc-header">
                <div>
                    <div class="doc-title">Pedido</div>
                    <div style="font-size:12px;color:#555;margin-top:3px">${esc(o.branch_name||'')}${o.warehouse_name?' &middot; '+esc(o.warehouse_name):''}</div>
                </div>
                <div>
                    <div class="folio">${esc(o.folio||'-')}</div>
                    ${o.status?`<span class="status">${esc(o.estado || o.status)}</span>`:''}
                </div>
            </div>
            ${o.reject_reason?`<div class="reject-box"><strong style="font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:#E02424;display:block;margin-bottom:3px">Motivo de rechazo</strong>${esc(o.reject_reason)}</div>`:''}
            <div class="info-grid">
                ${soloRecibido ? '' : `<div class="info-item"><span class="k">Proveedor</span><span class="v">${esc(o.supplier_name||'Sin asignar')}</span></div>`}
                <div class="info-item"><span class="k">Sucursal</span><span class="v">${esc(o.branch_name||'-')}</span></div>
                <div class="info-item"><span class="k">Fecha solicitud</span><span class="v">${esc(fmtFecha(o.date_order))}</span></div>
                ${o.expected_date?`<div class="info-item"><span class="k">Fecha esperada</span><span class="v">${esc(fmtFecha(o.expected_date))}</span></div>`:''}
                <div class="info-item"><span class="k">Solicitado por</span><span class="v">${esc(o.user_name||'-')}</span></div>
                ${o.approved_user_name?`<div class="info-item"><span class="k">Aprobado por</span><span class="v">${esc(o.approved_user_name)}</span></div>`:''}
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Producto</th>
                        ${soloRecibido ? `<th class="c">Unidad</th>
                        <th class="c">Recibido</th>` : `<th class="c">Pedido</th>
                        <th class="c">Recibido</th>
                        <th class="c">Pendiente</th>`}
                    </tr>
                </thead>
                <tbody>${rowsHtml||`<tr><td colspan="${soloRecibido ? 3 : 4}" class="c">Sin productos</td></tr>`}</tbody>
            </table>
            <div class="totals">
                <div class="totals-box">
                    <div class="totals-row"><span>Tipos de material</span><span>${productos.length}</span></div>
                    ${soloRecibido ? '' : `<div class="totals-row"><span>Unidades pedidas</span><span>${totals.uds}</span></div>`}
                    <div class="totals-row"><span>Unidades recibidas</span><span>${totals.recib}</span></div>
                </div>
            </div>
            ${o.note?`<div style="margin-top:18px;border-left:3px solid #000;background:#f7f7f7;padding:10px 14px;font-size:12px"><b style="display:block;margin-bottom:3px;text-transform:uppercase;font-size:10px;letter-spacing:.5px;color:#555">Nota</b>${esc(o.note)}</div>`:''}
            <div class="doc-footer">
                <span>Huubie &middot; Inventarios &middot; Pedido</span>
                <span>Generado: ${esc(fmtFecha(new Date().toISOString().slice(0,10)))}</span>
            </div>
        </div></body></html>`;

        const w = window.open('', '_blank', 'width=900,height=1000');
        if (!w) {
            this.alertBox({ type: 'warning', title: 'Permite las ventanas emergentes para poder ver el documento.' });
            return;
        }
        w.document.write(html);
        w.document.close();
        w.focus();
    }
}

// ============================================================
// OrdenesView — paneles, modales, acciones por estado
// ============================================================

class OrdenesView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'ordenes';
    }

    // ----------------------------------------------------------
    // Panel de detalle (aside derecho)
    // ----------------------------------------------------------

    // El visor siempre está abierto: Ver pinta el pedido; la X, un cambio de estado que
    // cierra el pedido o un error al cargarlo regresan a "Selecciona un pedido".
    // En el teléfono el pedido se abre a pantalla completa y la X lo cierra.
    renderDetail(orden) {
        const enMovil = !!orden && !!this.movil && this.movil.isActive();

        this.ordenDetailPanel({
            parent:  enMovil ? this.movil.detailParent() : 'detailPanel',
            id:      enMovil ? 'ordenDetailMovil' : 'ordenDetailPanel',
            json:    orden,
            onClose: () => app.selectOrden(null),
            onPrint: (o) => { if (o) ordenes.printOrden(o); },
            onEdit:          (o) => this.openOrdenForm(o),
            onSubmit:        (o) => this.doSubmitOrden(o),
            onApprove:       (o) => this.doApproveOrden(o),
            onReject:        (o) => this.doRejectOrden(o),
            onRecibir:       (o) => (String(o && o.folio || '').startsWith('REAB-') ? this.openRecepcionModal(o) : this.openSurtidoModal(o)),
            onCancel:        (o) => this.doCancelOrden(o),
            onCompromiso:    (o) => this.editCompromiso(o),
            onRecibi:        (o) => this.doConfirmRecepcion(o),
            onRevert:        (o) => this.doRevertOrden(o)
        });

        if (this.movil) this.movil.toggleDetail(enMovil);
    }

    // -- Teléfono --

    // Debajo de md se ve como app (ordenes-movil.js): tarjetas, estados en píldoras, botón
    // flotante y barra inferior. Los filtros son los de escritorio (#fEstado, #branch_id):
    // el teléfono solo los cambia y vuelve a consultar. La barra lleva Inicio y la lista del
    // módulo (Requisiciones o Despacho).
    renderMovil() {
        const despacho = app.modulo === 'despacho';
        this.movil = this.ordenesMovil({
            parent: 'ordenesMovil',
            id:     'ordenesMovilList',
            tabs: [
                {
                    id:   'inicio',
                    icon: 'house',
                    text: 'Inicio',
                    href: '../../modulos/'
                },
                {
                    id:   app.lado,
                    icon: despacho ? 'truck' : 'clipboard-list',
                    text: despacho ? 'Surtir' : 'Requisiciones'
                }
            ],
            labels: { nuevo: 'Nueva requisición' },
            onChip: (id) => {
                $('#fEstado').val(id);
                app.onChangeFilters();
            },
            onBranch: (id) => {
                $('#branch_id').val(id);
                app.onChangeFilters();
            },
            onTab: (id) => {
                app.onChangeTab(id);
                app.renderTabs();
            },
            onOpen: (card) => app.selectOrden(card.folio, card.id),
            onNew:  () => this.openOrdenMovil()
        });
    }

    syncMovil() {
        if (!this.movil) return;

        const entregas = app.lado === 'entregas';
        const opciones = (sel) => $(sel).find('option').map((i, el) => ({ id: el.value, valor: el.textContent })).get();

        this.movil.setView({
            title:     entregas ? 'Surtir' : 'Mis requisiciones',
            tab:       app.vista,
            chips:     opciones('#fEstado').map(e => (e.id === '' ? { id: '', valor: 'Todas' } : e)),
            chip:      $('#fEstado').val() || '',
            branches:  opciones('#branch_id'),
            branch:    $('#branch_id').val() || '',
            locked:    $('#branch_id').prop('disabled'),
            showNew:   !entregas,
            rangeText: `Requisiciones del ${this.fechaCorta(app.rangeFi)} al ${this.fechaCorta(app.rangeFf)}`
        });
    }

    // Captura del teléfono en una pantalla: pedido nuevo (quien pide es la sucursal del
    // filtro) o, con `orden`, editarlo con sus datos y renglones. Se guarda con saveOrdenForm.
    openOrdenMovil(orden = null) {
        const sucursales  = (app.dataInit.sucursales || []).filter(s => s.id !== '');
        const solicitante = orden ? orden.branch_id : this.sucursalSolicitante();
        const actual      = sucursales.find(s => String(s.id) === String(solicitante));

        this.ordenEditando = orden;
        this.ordenMovilForm({
            id:       'ordenMovilForm',
            title:    'Nueva requisición',
            sucursal: orden ? (orden.branch_name || '') : (actual ? actual.valor : ''),
            json:     app.dataInit.productos || [],
            // A quién pedir: cualquier sucursal; por defecto la del almacén principal.
            data: {
                sucursales:  this.destinos(),
                unidades:    app.dataInit.unidades || [],
                destino:     orden ? (orden.destination_branch_id || '') : this.sucursalAPedir(),
                solicitante: solicitante
            },
            edit: orden ? {
                id:        orden.id,
                folio:     orden.folio,
                fecha:     String(orden.date_order || '').slice(0, 10),
                nota:      orden.note || '',
                productos: this.lotePedido(orden, this.ordenFormInstance())
            } : null,
            onSave: (payload) => this.saveOrdenForm(payload)
        });
    }

    // ----------------------------------------------------------
    // Acciones de estado — confirmación con alertBox
    // ----------------------------------------------------------

    doSubmitOrden(o) {
        if (!o || !o.id) return;
        this.alertBox({
            type:        'confirm',
            title:       `Enviar pedido ${o.folio}`,
            detailHtml:  'El pedido pasará a En espera hasta que lo surtan.',
            okLabel:     'Sí, enviar',
            cancelLabel: 'No',
            onOk: async () => {
                const r = await useFetch({ url: this._link, data: { opc: 'submitOrden', id: o.id } }).catch(() => null);
                if (r && r.status === 200) {
                    this.alertBox({ type: 'success', title: r.message || 'Solicitud enviada', timer: 1600 });
                    this._refreshAfterAction(o.folio, o.id);
                } else {
                    this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo enviar el pedido' });
                }
            }
        });
    }

    doApproveOrden(o) {
        if (!o || !o.id) return;
        this.openAprobacionModal(o);
    }

    // AAAA-MM-DD -> 13/OCT/2026.
    fechaCorta(raw) {
        const meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        const m     = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? `${m[3]}/${meses[Number(m[2]) - 1]}/${m[1]}` : '';
    }

    // date_order = "Lo necesita para": "Hoy · 14/OCT/2026" (today = true, en rojo) si es hoy;
    // si no, 17/OCT/2026.
    needDateLabel(raw) {
        const dia = String(raw || '').slice(0, 10);
        if (!dia) return { text: '-', today: false };

        const today = dia === moment().format('YYYY-MM-DD');
        return { text: today ? `Hoy · ${this.fechaCorta(dia)}` : this.fechaCorta(dia), today };
    }

    // AAAA-MM-DD -> Lunes 19/OCT/2026 (mismo estilo de mes que Fecha de pedido).
    fechaConDia(raw) {
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const m    = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return '';
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        return `${dias[d.getDay()]} ${this.fechaCorta(raw)}`;
    }

    // AAAA-MM-DD -> Viernes 17 de oct 2026.
    fechaLarga(raw) {
        const dias  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        const m     = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (!m) return '';
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        return `${dias[d.getDay()]} ${Number(m[3])} de ${meses[Number(m[2]) - 1]} ${m[1]}`;
    }

    // AAAA-MM-DD HH:MM:SS -> 13/OCT/2026 01:07 PM.
    fechaHoraCorta(raw) {
        const m = String(raw || '').match(/^\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})/);
        if (!m) return this.fechaCorta(raw);
        const h = Number(m[1]);
        return `${this.fechaCorta(raw)} ${String(h % 12 || 12).padStart(2, '0')}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
    }

    // Cuándo se hizo el pedido (created_at: 12/SEP/2025 10:00 AM), igual que la columna
    // Fecha de pedido de la tabla (fechaHoraPedido del ctrl). `fecha` (date_order, para
    // cuándo se necesitan los insumos) solo si falta created_at.
    fechaHoraPedido(fecha, creado) {
        return this.fechaHoraCorta(creado) || this.fechaCorta(fecha) || '-';
    }

    // Editar compromiso del reabasto: arranca en la fecha que ya tiene o, si no, en hoy.
    editCompromiso(o) {
        if (!o || !o.id) return;
        const hoy = moment().format('YYYY-MM-DD');

        this.alertBox({
            type:           'confirm',
            title:          'Editar compromiso',
            detailHtml:     `Reabasto <strong>${o.folio}</strong>: ¿cuándo se espera registrar la compra?`,
            input:          'date',
            inputLabel:     'Fecha de compromiso',
            inputValue:     String(o.expected_date || '').slice(0, 10) || hoy,
            inputValidator: (v) => !v ? 'Elige una fecha' : (v < hoy ? 'La fecha no puede ser anterior a hoy' : null),
            okLabel:        'Guardar',
            cancelLabel:    'Cancelar',
            onOk: async (fecha) => {
                const r = await useFetch({ url: apiOrdenes, data: { opc: 'updateCompromiso', id: o.id, expected_date: fecha } }).catch(() => null);
                if (r && r.status === 200) {
                    this.alertBox({ type: 'success', title: r.message || 'Fecha compromiso guardada', timer: 1600 });
                    ordenes.getOrden(o.id);
                } else {
                    this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo guardar la fecha compromiso' });
                }
            }
        });
    }

    // Surtir la requisición («Surtiendo la requisición»): a la izquierda lo que pidió
    // (Cantidad, Unidad, Producto) y a la derecha lo que sale del almacén elegido (Stock,
    // Cantidad, Unidad, Producto). La cantidad arranca en lo pendiente y se puede bajar: lo
    // que quede en 0 sigue pendiente y la requisición queda Surtido parcialmente. En Producto
    // se cambia por otro de la misma categoría con stock (los de nombre parecido primero); la
    // unidad es la del producto que sale, sin equivalencias. Con estado Parcial es «Terminar
    // de surtir»: arriba el historial de surtimiento y abajo solo lo pendiente. Al aceptar
    // pregunta si se descuenta del almacén ahora (salida automática; el stock puede quedar en
    // negativo) o se hace a mano (salida manual).
    openAprobacionModal(orden) {
        if (!orden || !orden.id) return;

        const self       = this;
        const esc        = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fmtNum     = (n) => (Number(n) % 1 === 0) ? String(Number(n)) : Number(n).toFixed(2);
        const fmtMoney   = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const pendiente  = (p) => Math.max(0, p.quantity_ordered - p.quantity_received);
        // Solo lo que falta por surtir (en una requisición en espera, todo).
        const productos  = (orden.productos || []).filter(p => pendiente(p) > 0);
        const terminar   = orden.status === 'Parcial';
        const cantidades = {};
        // Renglón -> producto que sale del almacén: el del surtido anterior o lo pedido.
        const entrega    = {};

        // Sin equivalencias entre unidades, la cantidad se dice en la unidad del producto que sale: lo que
        // se cuenta (pieza, paquete, caja, "500 GR"...) va entero y solo litro, gramo y sus parientes (ml, kg)
        // admiten decimales. Se compara el nombre o código exacto: "500 GR" o "4 LT" son empaques.
        const medidaRe        = /^(l|lt|lts|litros?|ml|mililitros?|g|gr|grs|gramos?|kg|kgs|kilos?|kilogramos?)$/;
        const aceptaDecimales = (unidad) => medidaRe.test(String(unidad || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase());

        productos.forEach(p => {
            cantidades[String(p.detailId)] = aceptaDecimales(p.unidad) ? pendiente(p) : Math.floor(pendiente(p));
            entrega[String(p.detailId)]    = p.delivered_id || String(p.product_id);
        });

        // "Selecciona almacén": los de la sucursal que surte; arranca en el de la requisición o
        // en el principal (almacenQueSurte).
        const sucursalSurte = String(orden.destination_branch_id || orden.branch_id);
        const almacenes     = (app.dataInit.almacenes || []).filter(a => String(a.branch_id) === sucursalSurte);
        let   almacen       = this.almacenQueSurte(orden);
        if (almacen && !almacenes.some(a => String(a.id) === String(almacen.id))) almacenes.unshift(almacen);

        const catalogo = (app.dataInit && app.dataInit.productos) || [];
        const porId    = {};
        const unidades = {};
        catalogo.forEach(x => { porId[String(x.id)] = x; });
        ((app.dataInit && app.dataInit.unidades) || []).forEach(u => { unidades[String(u.id)] = u.valor; });

        const modalId = 'modalAprobacion';
        $(`#${modalId}`).remove();

        // Teléfono: el modal ocupa la pantalla y cada producto va en tarjeta (tarjetaHtml).
        const movil = !!(this.movil && this.movil.isActive());

        let stockMap    = {};
        let stockLoaded = false;
        // Renglón -> productos de su categoría con stock; se arma al cargar el stock.
        let similares   = {};

        const necesita = this.needDateLabel(orden.date_order);
        const titulo   = terminar ? 'Terminar de surtir' : 'Surtiendo la requisición';
        const seccion  = (texto) => `<p class="text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1.5">${texto}</p>`;

        // En el teléfono los campos van a 16 px (compact.css los deja en 14 con !important):
        // con menos, el iPhone hace zoom al tocarlos. Encabezado como la hoja de surtir: título,
        // quién pide, el almacén del que sale y para cuándo lo necesita.
        const $modal = $(`
            <div id="${modalId}" class="fixed inset-0 z-[9999] flex items-center justify-center md:p-4">
                <style>@media (max-width: 767.98px) { #${modalId} :is(input, textarea, select) { font-size: 16px !important; } }</style>
                <div class="absolute inset-0 bg-black/40"></div>
                <div class="relative z-10 w-full max-w-[1080px] h-full md:h-auto md:max-h-[90vh] bg-white md:rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col">

                    <div class="flex items-start justify-between gap-3 px-[18px] py-[14px] border-b border-gray-200 bg-gray-50 flex-shrink-0">
                        <div class="flex-1 min-w-0 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-x-6 gap-y-3">
                            <div class="min-w-0">
                                <h3 class="text-base font-bold uppercase tracking-wide text-gray-800">${titulo}</h3>
                                <p class="text-[11px] text-gray-500">Requisición <span class="font-semibold text-gray-700">${esc(orden.folio)}</span> &middot; ${orden.status_badge || ''}</p>
                            </div>
                            <div class="flex flex-wrap items-end gap-x-5 gap-y-2">
                                <p class="flex items-center gap-1.5 text-xs font-semibold text-gray-700 pb-2" title="Sucursal que pide">
                                    <i data-lucide="store" class="w-3.5 h-3.5 text-gray-400"></i>${esc(orden.branch_name || '-')}
                                </p>
                                <div>
                                    <label for="${modalId}_warehouse" class="block text-[10px] font-semibold text-gray-500 mb-0.5">Selecciona almacén:</label>
                                    <div class="relative">
                                        <select id="${modalId}_warehouse" class="w-48 pl-2.5 pr-8 py-1.5 text-xs font-semibold text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 cursor-pointer appearance-none">
                                            ${almacenes.map(a => `<option value="${esc(a.id)}"${almacen && String(a.id) === String(almacen.id) ? ' selected' : ''}>${esc(a.valor || a.name || '')}</option>`).join('') || '<option value="">Sin almacén</option>'}
                                        </select>
                                        <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                                    </div>
                                </div>
                                <p class="text-xs text-gray-500 pb-2">Para el: <b class="${necesita.today ? 'text-red-600' : 'text-gray-800'}">${esc(necesita.text)}</b></p>
                            </div>
                        </div>
                        <button id="${modalId}_close" class="w-8 h-8 flex-shrink-0 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-400">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>

                    <div id="${modalId}_cuerpo" class="flex-1 min-h-0 overflow-y-auto overscroll-contain cs-scroll bg-white ${movil ? 'px-[16px]' : 'px-[18px]'} py-[16px] space-y-4">
                        ${terminar ? `
                        <section>
                            ${seccion('Historial de surtimiento')}
                            <div id="${modalId}_historial"></div>
                        </section>` : ''}

                        <section>
                            ${terminar ? seccion('Pendiente de surtir') : ''}
                            <div id="${modalId}_table"></div>
                        </section>

                        ${orden.note ? `
                        <div class="flex items-start gap-2.5 rounded-[10px] border border-gray-200 bg-white px-3 py-2.5" style="border-left:3px solid rgb(var(--brand-600, 192 90 64))">
                            <i data-lucide="file-text" class="w-4 h-4 mt-0.5 flex-shrink-0" style="color:rgb(var(--brand-600, 192 90 64))"></i>
                            <p class="text-xs leading-relaxed text-gray-500"><b class="font-semibold text-gray-800">Nota de quien pidió:</b> «${esc(orden.note)}»</p>
                        </div>` : ''}
                    </div>

                    <!-- En el teléfono los botones van a lo ancho, de 44px -->
                    <div class="flex items-center justify-end gap-2 px-[18px] py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0"${movil ? ' style="padding-bottom:max(12px, env(safe-area-inset-bottom))"' : ''}>
                        <button id="${modalId}_cerrar" class="${movil ? 'flex-1 h-[44px] text-[13px]' : 'px-[16px] py-2 text-xs'} font-semibold text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-100">Cancelar</button>
                        <button id="${modalId}_aprobar" class="${movil ? 'flex-[2] h-[44px] text-[14px] justify-center' : 'px-[16px] py-2 text-xs'} font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-md hover:shadow-lg transition-all flex items-center gap-1.5">
                            <i data-lucide="check" class="w-3.5 h-3.5"></i><span>Aceptar</span>
                        </button>
                    </div>
                </div>
            </div>
        `);

        $('body').append($modal);
        if (window.lucide) lucide.createIcons();

        // Lo que sale del almacén en el renglón: lo pedido o lo elegido en "Producto a entregar".
        const entregaDe = (p) => {
            const id = entrega[String(p.detailId)];
            if (id === String(p.product_id)) {
                return { id, nombre: p.nombre, sku: p.sku, unidad: p.unidad, unitId: String(p.unit_id || (porId[id] || {}).unit_id || '') };
            }
            // El de un surtido anterior trae su nombre y unidad aunque ya no esté en el catálogo.
            const x     = porId[id] || {};
            const antes = id === p.delivered_id;
            return { id, nombre: x.nombre || (antes ? p.delivered_nombre : ''), sku: x.sku || (antes ? p.delivered_sku : ''), unidad: unidades[String(x.unit_id)] || x.presentacion || (antes ? p.delivered_unidad : ''), unitId: String(x.unit_id || '') };
        };

        // Lo que queda para el renglón: el stock del producto que entrega menos lo que se llevan
        // los renglones de antes con ese mismo producto (así lo descuenta surtir()).
        const dispDe = (p) => {
            if (!stockLoaded) return null;
            const id = entrega[String(p.detailId)];
            let disp = stockMap[id] || 0;
            for (const q of productos) {
                if (q === p) break;
                const qid = String(q.detailId);
                if (entrega[qid] === id) disp -= cantidades[qid];
            }
            return disp;
        };

        // Lo que hay y lo que falta en la unidad del producto que sale: en lo que se cuenta va
        // entero (lo que hay hacia abajo, lo que falta hacia arriba); litro y gramo con decimales.
        const decDe   = (p) => aceptaDecimales(entregaDe(p).unidad);
        const dispTx  = (p, n) => decDe(p) ? fmtNum(n) : String(Math.floor(n));
        const faltaTx = (p, n) => decDe(p) ? fmtNum(n) : String(Math.ceil(n));
        // Tope de "Cant. a entregar": lo pedido (entero en lo que se cuenta).
        const topeDe  = (p) => decDe(p) ? pendiente(p) : Math.floor(pendiente(p));

        const unitTx  = (p) => (entregaDe(p).unidad ? ` ${esc(entregaDe(p).unidad)}` : '');
        const faltaDe = (p) => cantidades[String(p.detailId)] - dispDe(p);
        const negativoDe = (p) => `<strong>${esc(entregaDe(p).nombre)}</strong> (entrega ${fmtNum(cantidades[String(p.detailId)])}${unitTx(p)}) quedará en <strong style="color:#B91C1C">−${faltaTx(p, faltaDe(p))}${unitTx(p)}</strong>`;

        // Palabras del nombre sin acentos, mayúsculas ni plural, para encontrar los parecidos.
        const palabras = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
            .split(/[^a-z0-9]+/).map(w => w.length > 3 ? w.replace(/s$/, '') : w).filter(w => w.length > 2);

        // Misma categoría del Catálogo y con stock en el almacén que surte, en dos grupos:
        // parecidos (comparten palabras con lo pedido: Mantequilla…) y el resto, por nombre.
        const armarSimilares = () => {
            similares = {};
            productos.forEach(p => {
                const base = porId[String(p.product_id)];
                const did  = String(p.detailId);
                similares[did] = { parecidos: [], otros: [], categoria: base ? base.categoria : '' };
                if (!base || !base.categoria || base.categoria === 'Sin categoría') return;
                const suyas = palabras(base.nombre);
                catalogo
                    .filter(x => x.categoria === base.categoria && String(x.id) !== String(base.id) && (stockMap[String(x.id)] || 0) > 0)
                    .map(x => ({ x, n: palabras(x.nombre).filter(w => suyas.includes(w)).length }))
                    .sort((a, b) => b.n - a.n || a.x.nombre.localeCompare(b.x.nombre, 'es'))
                    .forEach(o => similares[did][o.n > 0 ? 'parecidos' : 'otros'].push(o.x));
            });
        };

        const tonoDisp = (disp, qty) => disp === null ? '#9CA3AF' : (disp <= 0 ? '#B91C1C' : (disp >= qty ? '#15803D' : '#C2410C'));

        // Miniatura igual a la de Entradas (imagen o ícono del catálogo).
        const thumb = (x, box, ico) => EntradaForm.prototype.prodThumb.call({ esc }, Object.assign({ icon: 'package', bg: 'bg-gray-100', color: 'text-gray-500' }, x), box, ico);

        // Stock del producto que sale (lo que le queda al renglón): verde si alcanza, naranja o
        // rojo si no.
        const stockCell = (p) => {
            const did  = String(p.detailId);
            const disp = dispDe(p);
            return `<span data-stock="${did}" class="text-sm font-bold" style="color:${tonoDisp(disp, cantidades[did])}">${disp === null ? '—' : esc(dispTx(p, disp))}</span>`;
        };

        // "Producto" que se entrega: se ve como select (flecha) pero se escribe para buscar,
        // con la lista de Entradas (abrirSelector).
        const entregaCell = (p) => {
            const did = String(p.detailId);
            const e   = entregaDe(p);
            return `
                <div data-entrega-box="${did}" class="relative scroll-mt-[60px]">
                    <input type="text" data-entrega-input="${did}" value="${esc(e.nombre)}" autocomplete="off" placeholder="Buscar producto a entregar..."
                        class="w-full !pl-3 !pr-8 py-2 text-[13px] font-semibold uppercase text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all placeholder:text-gray-400 placeholder:normal-case placeholder:font-normal truncate">
                    <i data-lucide="chevron-down" class="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"></i>
                </div>`;
        };

        // -- Selector de producto a entregar --

        // Igual al buscador de Entradas sin el costo: miniatura, nombre y "SKU · categoría ·
        // unidad · Stock". Lo pedido, los parecidos y el resto de su categoría con stock; con
        // texto, solo los que lo traen en el nombre o el SKU.
        let picker = null;
        const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

        const gruposSelector = (p, term) => {
            const s      = similares[String(p.detailId)] || { parecidos: [], otros: [], categoria: '' };
            const pedido = porId[String(p.product_id)] || { id: String(p.product_id), nombre: p.nombre, sku: p.sku, image: p.image, presentacion: p.unidad };
            const t      = norm(term).trim();
            const pasa   = (x) => !t || norm(`${x.nombre} ${x.sku || ''}`).includes(t);
            return [
                { titulo: 'Lo pedido',                items: [pedido].filter(pasa) },
                { titulo: 'Parecidos',                items: s.parecidos.filter(pasa), parecidos: true },
                { titulo: `Otros de ${s.categoria}`,  items: s.otros.filter(pasa) }
            ].filter(g => g.items.length);
        };

        const resultadoSelector = (x, i) => {
            const stock = Number(stockMap[String(x.id)] || 0);
            const tono  = stock <= 0 ? 'text-red-500' : stock < 5 ? 'text-orange-500' : 'text-green-600';
            const sep   = '<span class="text-gray-300"> &middot; </span>';
            const datos = [
                x.sku ? `<span class="font-mono">${esc(x.sku)}</span>` : '',
                x.categoria && x.categoria !== 'Sin categoría' ? esc(x.categoria) : '',
                x.presentacion ? esc(x.presentacion) : ''
            ].filter(Boolean).concat(`Stock: <strong class="${tono}">${fmtNum(stock)}</strong>`).join(sep);
            return `
                <div class="ef-cat-item flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-blue-50/60 border-b border-gray-100 last:border-b-0 transition-all group" data-entrega-id="${esc(x.id)}" data-cat-idx="${i}">
                    ${thumb(x, 'w-9 h-9', 'w-4 h-4')}
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-semibold text-gray-800 truncate">${esc(x.nombre)}</p>
                        <p class="text-[10px] text-gray-500 truncate mt-0.5">${datos}</p>
                    </div>
                    <div class="ef-add-btn w-7 h-7 rounded-lg bg-gray-100 border border-gray-200 text-gray-400 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">
                        <i data-lucide="plus" class="w-4 h-4"></i>
                    </div>
                </div>`;
        };

        // Encabezado de cada grupo; los parecidos con la franja de "Tal vez quisiste decir".
        const tituloSelector = (g) => g.parecidos
            ? `<div class="px-3 py-2 bg-amber-50/70 border-b border-gray-200 text-[11px] font-semibold text-amber-700 flex items-center gap-1.5"><i data-lucide="lightbulb" class="w-3 h-3"></i>${esc(g.titulo)}</div>`
            : `<div class="px-3 py-1.5 bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500">${esc(g.titulo)}</div>`;

        // La unidad es la del producto que se entrega (caja de solo lectura); en naranja si no
        // es la que se pidió.
        const unidadCell = (p) => {
            const e      = entregaDe(p);
            const pedida = String(p.unit_id || (porId[String(p.product_id)] || {}).unit_id || '');
            const otra   = e.id !== String(p.product_id) && e.unitId !== '' && pedida !== '' && e.unitId !== pedida;
            return `<span class="flex w-full items-center justify-center min-h-[36px] px-1.5 text-[11px] font-bold uppercase tracking-wide bg-white border rounded-md truncate ${otra ? 'border-orange-300 text-[#C2410C]' : 'border-gray-300 text-gray-700'}"${otra ? ` title="Pidió ${esc(p.unidad || 'otra unidad')}"` : ''}>${esc(e.unidad || '-')}</span>`;
        };

        // Repinta el Stock de todos los renglones sin rehacer la tabla (el foco sigue en la
        // cantidad que se captura): otra cantidad cambia lo que les queda a los renglones de
        // abajo con el mismo producto.
        const refreshDisp = () => {
            productos.forEach(p => $modal.find(`[data-stock="${String(p.detailId)}"]`).replaceWith(stockCell(p)));
        };

        const cantidadInput = (p, cls) => {
            const did = String(p.detailId);
            const dec = decDe(p);
            return `<input type="number" data-cantidad="${did}" value="${cantidades[did]}" min="0" max="${topeDe(p)}" step="${dec ? '0.01' : '1'}" inputmode="${dec ? 'decimal' : 'numeric'}"
                class="no-spin w-full px-2 py-2 font-bold text-center text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all ${cls}">`;
        };

        // Lo que pidió: nombre y, si trae, su nota de solicitud (en una línea; completa al pasar el mouse).
        const pedidoHtml = (p) => `
            <p class="text-xs font-semibold uppercase text-gray-800 truncate" title="${esc(p.nombre)}">${esc(p.nombre)}</p>
            ${p.nota ? `<p class="text-[10px] text-gray-500 italic truncate flex items-center gap-1" title="${esc(p.nota)}"><i data-lucide="message-square" class="w-3 h-3 flex-shrink-0"></i><span class="truncate">${esc(p.nota)}</span></p>` : ''}`;

        // Las dos tablas comparten el alto de renglón para que cada producto quede frente a
        // lo que se le entrega.
        const th   = 'py-2 text-[10px] uppercase tracking-wider text-white font-bold whitespace-nowrap';
        const fila = 'h-[52px] border-b border-gray-100 last:border-b-0';

        const filaPedido = (p) => `
            <tr class="${fila}">
                <td class="px-2 align-middle text-center text-sm font-bold text-gray-800">${fmtNum(pendiente(p))}</td>
                <td class="px-2 align-middle text-center text-[11px] font-bold uppercase tracking-wide text-gray-600 truncate">${esc(p.unidad || '-')}</td>
                <td class="px-3 align-middle min-w-0">${pedidoHtml(p)}</td>
            </tr>`;

        const filaEntrega = (p) => `
            <tr class="${fila}">
                <td class="px-2 align-middle text-center">${stockCell(p)}</td>
                <td class="px-2 align-middle">${cantidadInput(p, 'text-sm')}</td>
                <td class="px-2 align-middle">${unidadCell(p)}</td>
                <td class="px-2 align-middle">${entregaCell(p)}</td>
            </tr>`;

        // Teléfono: cada producto en tarjeta; arriba lo que pidió y abajo lo que se entrega.
        const tarjetaHtml = (p) => {
            const lbl = 'text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1';
            return `
                <div class="bg-white rounded-[12px] border-[1.5px] border-gray-200 overflow-hidden">
                    <div class="px-[14px] py-[12px] bg-gray-50 border-b border-gray-100">
                        <p class="${lbl}">Pidió</p>
                        <p class="text-[14px] leading-snug text-gray-800"><b>${fmtNum(pendiente(p))}${p.unidad ? ` ${esc(p.unidad)}` : ''}</b> &middot; ${esc(p.nombre)}</p>
                        ${p.nota ? `<p class="text-[11px] text-gray-500 italic leading-tight flex items-start gap-1 mt-1"><i data-lucide="message-square" class="w-3 h-3 flex-shrink-0 mt-px"></i><span>${esc(p.nota)}</span></p>` : ''}
                    </div>
                    <div class="px-[14px] py-[12px] space-y-3">
                        <div>
                            <p class="${lbl}">Producto</p>
                            ${entregaCell(p)}
                        </div>
                        <div class="grid grid-cols-3 gap-3 items-end">
                            <div>
                                <p class="${lbl}">Stock</p>
                                <div class="min-h-[40px] flex items-center">${stockCell(p)}</div>
                            </div>
                            <div>
                                <p class="${lbl}">Cantidad</p>
                                ${cantidadInput(p, '')}
                            </div>
                            <div>
                                <p class="${lbl}">Unidad</p>
                                ${unidadCell(p)}
                            </div>
                        </div>
                    </div>
                </div>`;
        };

        // Escritorio: las dos tablas lado a lado (abajo de la otra en tablet). Anchos fijos
        // para que las columnas no se muevan al cambiar de producto ni al capturar.
        const renderRows = () => {
            if (movil) {
                $(`#${modalId}_table`).html(`
                    <div class="space-y-3">
                        ${productos.map(tarjetaHtml).join('') || '<p class="py-6 text-center text-xs text-gray-400">No hay productos por surtir</p>'}
                    </div>`);
                if (window.lucide) lucide.createIcons();
                return;
            }

            $(`#${modalId}_table`).html(`
                <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 items-start">
                    <div class="rounded-lg border border-gray-200 overflow-hidden">
                        <table class="w-full border-collapse table-fixed">
                            <thead class="bg-blue-600">
                                <tr>
                                    <th class="text-center px-2 ${th} w-20">Cantidad</th>
                                    <th class="text-center px-2 ${th} w-20">Unidad</th>
                                    <th class="text-left px-3 ${th}">Producto</th>
                                </tr>
                            </thead>
                            <tbody>${productos.map(filaPedido).join('')}</tbody>
                        </table>
                    </div>
                    <div class="rounded-lg border border-gray-200 overflow-hidden">
                        <table class="w-full border-collapse table-fixed">
                            <thead class="bg-blue-600">
                                <tr>
                                    <th class="text-center px-2 ${th} w-16">Stock</th>
                                    <th class="text-center px-2 ${th} w-24">Cantidad</th>
                                    <th class="text-center px-2 ${th} w-24">Unidad</th>
                                    <th class="text-left px-3 ${th}">Producto</th>
                                </tr>
                            </thead>
                            <tbody>${productos.map(filaEntrega).join('')}</tbody>
                        </table>
                    </div>
                </div>
                ${productos.length ? '' : '<p class="py-6 text-center text-xs text-gray-400">No hay productos por surtir</p>'}`);
            if (window.lucide) lucide.createIcons();
        };

        // Terminar de surtir: lo que ya se le entregó, con el tipo de salida de cada vez.
        const renderHistorial = () => {
            const surtidos = orden.surtidos || [];
            const thH      = 'py-2 text-[10px] uppercase tracking-wider text-white font-bold whitespace-nowrap';
            $(`#${modalId}_historial`).html(`
                <div class="rounded-lg border border-gray-200 overflow-x-auto">
                    <table class="w-full border-collapse">
                        <thead class="bg-blue-600">
                            <tr>
                                <th class="text-left px-3 ${thH}">Fecha</th>
                                <th class="text-left px-3 ${thH}">Usuario</th>
                                <th class="text-center px-2 ${thH}">Cantidad</th>
                                <th class="text-right px-3 ${thH}">Cantidad ($)</th>
                                <th class="text-left px-3 ${thH}">Tipo de salida</th>
                            </tr>
                        </thead>
                        <tbody>${surtidos.map(s => `
                            <tr class="border-b border-gray-100 last:border-b-0 text-xs text-gray-700">
                                <td class="px-3 py-2 whitespace-nowrap">${esc(this.fechaHoraCorta(s.fecha))}</td>
                                <td class="px-3 py-2">${esc(s.usuario || '-')}</td>
                                <td class="px-2 py-2 text-center font-semibold">${fmtNum(s.unidades)}</td>
                                <td class="px-3 py-2 text-right">${fmtMoney(s.importe)}</td>
                                <td class="px-3 py-2 whitespace-nowrap uppercase text-[11px] font-semibold"${s.salida ? ` title="Salida ${esc(s.salida)}"` : ''}>${esc(s.tipo)}</td>
                            </tr>`).join('') || '<tr><td colspan="5" class="px-3 py-4 text-center text-xs text-gray-400">Sin surtimientos registrados</td></tr>'}
                        </tbody>
                    </table>
                </div>`);
        };

        // Abre el selector debajo de "Producto a entregar" (arriba si no cabe). Vive en el panel
        // del modal, fuera del scroll de la tabla, para que no lo recorte.
        const $panel  = $modal.children('.relative');
        const $picker = $(`<div id="${modalId}_picker" class="hidden absolute z-30 bg-white border border-gray-200 rounded-lg shadow-2xl shadow-black/20 overflow-hidden"></div>`).appendTo($panel);

        // Mismo armado que la lista de Entradas: franja de resultados, lista y pie con atajos.
        const pintarSelector = () => {
            const p      = productos.find(x => String(x.detailId) === picker.did);
            const grupos = gruposSelector(p, picker.term);
            const total  = gruposSelector(p, '').reduce((n, g) => n + g.items.length, 0);
            let k = 0;
            picker.items  = [].concat(...grupos.map(g => g.items));
            picker.active = picker.term ? 0 : Math.max(0, picker.items.findIndex(x => String(x.id) === entrega[picker.did]));

            const n    = picker.items.length;
            const head = `
                <div class="flex items-center justify-between px-3 py-2 bg-blue-50/50 border-b border-gray-200">
                    <span class="text-[11px] font-semibold text-gray-600 flex items-center gap-1.5 truncate">
                        <i data-lucide="search" class="w-3 h-3 text-blue-600"></i>${picker.term ? `Resultados para "${esc(picker.term)}"` : `Para entregar en lugar de "${esc(p.nombre)}"`}
                    </span>
                    <span class="text-[10px] text-gray-400 flex-shrink-0 ml-2">${n} ${n === 1 ? 'encontrado' : 'encontrados'}</span>
                </div>`;
            const body = n
                ? `<div class="max-h-[340px] overflow-y-auto cs-scroll ef-scroll">${grupos.map(g => tituloSelector(g) + g.items.map(x => resultadoSelector(x, k++)).join('')).join('')}</div>`
                : `<div class="flex flex-col items-center justify-center py-8 text-center px-2">
                       <div class="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center mb-2"><i data-lucide="search-x" class="w-5 h-5 text-gray-400"></i></div>
                       <p class="text-[11px] text-gray-500">Sin productos de su categoría con stock que coincidan</p>
                   </div>`;
            const foot = `
                <div class="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-t border-gray-200 text-[10px] text-gray-400">
                    <span class="flex items-center gap-1"><span class="ef-kbd">&crarr;</span>elegir<span class="ef-kbd ml-1.5">esc</span>cerrar</span>
                    <span>Mostrando ${n} de ${total}</span>
                </div>`;

            // En el teléfono no hay teclas: sin el pie de atajos.
            $picker.html(head + body + (movil ? '' : foot));
            marcarSelector();
            if (window.lucide) lucide.createIcons();
        };

        const marcarSelector = () => {
            const $items = $picker.find('.ef-cat-item').removeClass('ef-active');
            const $a     = $items.eq(picker.active).addClass('ef-active');
            if ($a.length) $a[0].scrollIntoView({ block: 'nearest' });
        };

        // Debajo del campo y al menos de 560 px (arriba si no cabe abajo).
        const colocarSelector = () => {
            const $inp = $modal.find(`[data-entrega-input="${picker.did}"]`);
            if (!$inp.length) return;
            const panel = $panel[0].getBoundingClientRect();
            const r     = $inp[0].getBoundingClientRect();

            // Teléfono: a lo ancho y siempre debajo del campo (el campo sube arriba al
            // tocarlo); la lista se acorta a lo que deja libre el teclado.
            if (movil) {
                const libre = (window.visualViewport ? window.visualViewport.height : window.innerHeight) - r.bottom - 56;
                $picker.css({ left: 8, width: panel.width - 16, top: r.bottom - panel.top + 6, bottom: 'auto' }).removeClass('hidden');
                $picker.find('.cs-scroll').css('max-height', `${Math.max(150, Math.min(340, libre))}px`);
                return;
            }

            const width = Math.min(Math.max(r.width, 560), panel.width - 16);
            const left  = Math.max(8, Math.min(r.left - panel.left, panel.width - width - 8));
            $picker.css({ left: left, width: width, top: r.bottom - panel.top + 6, bottom: 'auto' }).removeClass('hidden');
            if (r.bottom + 6 + $picker.outerHeight() > panel.bottom - 8 && r.top - panel.top > panel.bottom - r.bottom) {
                $picker.css({ top: 'auto', bottom: panel.bottom - r.top + 6 });
            }
        };

        const abrirSelector = (did) => {
            EntradaForm.prototype.ensureStyles();
            picker = { did: did, term: '', items: [], active: 0 };
            pintarSelector();
            colocarSelector();
        };

        // Al cerrar sin elegir, el campo vuelve a decir el producto que sale.
        const cerrarSelector = () => {
            if (picker) {
                const p = productos.find(x => String(x.detailId) === picker.did);
                $modal.find(`[data-entrega-input="${picker.did}"]`).val(entregaDe(p).nombre);
            }
            picker = null;
            $picker.addClass('hidden').empty();
        };

        // Otro producto a entregar: cambia su disponible, su unidad y su "¿Alcanza?"; si el nuevo
        // se cuenta en piezas, la cantidad queda entera. Como en Entradas, el foco pasa a la cantidad.
        const elegirEntrega = (did, id) => {
            const p = productos.find(x => String(x.detailId) === did);
            entrega[did] = String(id);
            if (!decDe(p)) cantidades[did] = Math.floor(cantidades[did]);
            picker = null;
            $picker.addClass('hidden').empty();
            renderRows();
            $modal.find(`[data-cantidad="${did}"]`).trigger('focus').trigger('select');
        };

        const loadStock = (warehouseId) => {
            if (!warehouseId) { stockLoaded = false; stockMap = {}; similares = {}; renderRows(); return; }
            useFetch({ url: apiOrdenes, data: { opc: 'stockByWarehouse', warehouse_id: warehouseId } }).then(r => {
                stockMap    = (r && r.status === 200 && r.stock) ? r.stock : {};
                stockLoaded = true;
                armarSimilares();
                renderRows();
            });
        };

        const closeModal = () => $(`#${modalId}`).remove();
        $(`#${modalId}_close`).on('click', closeModal);
        $(`#${modalId}_cerrar`).on('click', closeModal);
        $modal.on('click', (ev) => { if ($(ev.target).is(`#${modalId}`)) closeModal(); });

        // Otro almacén: su stock y los parecidos que tiene.
        $(`#${modalId}_warehouse`).on('change', function () {
            const id = $(this).val();
            almacen  = almacenes.find(a => String(a.id) === String(id)) || null;
            stockLoaded = false;
            renderRows();
            loadStock(id);
        });

        // "Producto a entregar" se busca como en Entradas: al entrar al campo se abre la lista,
        // al escribir se filtra, flechas y Enter eligen, Escape o salir del campo la cierran.
        // La lista no le quita el foco al campo (mousedown), así el clic en un producto sí cuenta.
        // En el teléfono el campo sube arriba del cuerpo para que la lista quepa debajo, y se
        // vuelve a colocar cuando termina de abrir el teclado.
        $modal.on('focus', '[data-entrega-input]', function () {
            const did = String($(this).attr('data-entrega-input'));
            this.select();
            if (movil) {
                this.closest('[data-entrega-box]').scrollIntoView({ block: 'start' });
                setTimeout(() => { if (picker && picker.did === did) colocarSelector(); }, 350);
            }
            abrirSelector(did);
        });
        $modal.on('input', '[data-entrega-input]', function () {
            if (!picker) return;
            picker.term = this.value;
            pintarSelector();
            colocarSelector();
        });
        $modal.on('keydown', '[data-entrega-input]', function (ev) {
            if (!picker) return;
            if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
                ev.preventDefault();
                picker.active = ev.key === 'ArrowDown' ? Math.min(picker.active + 1, picker.items.length - 1) : Math.max(picker.active - 1, 0);
                marcarSelector();
            } else if (ev.key === 'Enter') {
                ev.preventDefault();
                const x = picker.items[picker.active];
                if (x) elegirEntrega(picker.did, x.id);
            } else if (ev.key === 'Escape') {
                ev.preventDefault();
                ev.stopPropagation();
                cerrarSelector();
                this.blur();
            }
        });
        $modal.on('blur', '[data-entrega-input]', () => cerrarSelector());
        $picker.on('mousedown', (ev) => ev.preventDefault());
        $picker.on('click', '[data-entrega-id]', function () {
            if (picker) elegirEntrega(picker.did, $(this).attr('data-entrega-id'));
        });
        $(`#${modalId}_table, #${modalId}_cuerpo`).on('scroll', () => { if (picker) colocarSelector(); });

        // Cantidad va de 0 a lo pendiente, entera salvo litro o gramo; recalcula el Stock que
        // les queda a los renglones con el mismo producto.
        $modal.on('input', '[data-cantidad]', function () {
            const did = String($(this).attr('data-cantidad'));
            const p   = productos.find(x => String(x.detailId) === did);
            let qty   = parseFloat($(this).val());
            if (isNaN(qty) || qty < 0) qty = 0;
            if (!decDe(p) && qty % 1 !== 0) { qty = Math.floor(qty); $(this).val(qty); }
            if (qty > topeDe(p)) { qty = topeDe(p); $(this).val(qty); }
            cantidades[did] = qty;
            refreshDisp();
        });

        // `salida` = 'auto' («Sí, descontarlos»: la salida SI- descuenta el almacén elegido) o
        // 'manual' («No, lo haré manual»: solo queda lo entregado). Se mandan los renglones con
        // cantidad; el producto que sale va en `subs` (el ctrl ignora el que ya tenía).
        const surtirAhora = async (salida) => {
            const items = {}, subs = {};
            productos.forEach(p => {
                const did = String(p.detailId);
                if (!(cantidades[did] > 0)) return;
                items[did] = cantidades[did];
                subs[did]  = entrega[did];
            });
            const $btn = $(`#${modalId}_aprobar`).prop('disabled', true).addClass('opacity-60 pointer-events-none');
            const r = await useFetch({
                url:  apiOrdenes,
                data: {
                    opc:          'approveOrden',
                    id:           orden.id,
                    vista:        app.vistaOrden(orden),
                    items:        JSON.stringify(items),
                    subs:         JSON.stringify(subs),
                    warehouse_id: almacen ? almacen.id : '',
                    salida:       salida
                }
            }).catch(() => null);
            if (r && r.status === 200) {
                closeModal();
                this.alertBox({ type: 'success', title: salida === 'manual' ? 'Salida manual registrada' : 'Surtido registrado', detailHtml: esc(r.message || ''), timer: 6500 });
                self._refreshAfterAction(orden.folio, orden.id);
                return;
            }
            $btn.prop('disabled', false).removeClass('opacity-60 pointer-events-none');
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo surtir la requisición' });
        };

        // La pregunta de la hoja de surtir. Abajo, en qué estado queda la requisición y, si al
        // descontar algo queda en negativo, cuánto. «Sí, descontarlos» va primero, como en la
        // captura; un clic fuera solo cierra la pregunta y regresa a la captura.
        const preguntarDescuento = (completa, negativos) => {
            const id     = `${modalId}_descontar`;
            const estado = completa ? 'Entregado' : 'Surtido parcialmente';
            this.alertBox({
                id:          id,
                type:        'confirm',
                title:       '¿Quieres descontarlo AHORA de tu Almacén?',
                detailHtml:  'Este cambio no se puede deshacer.'
                           + `<span class="block mt-2 text-[11px]">La requisición queda <b class="text-gray-800">${estado}</b>.</span>`
                           + (negativos.length ? `<span class="block mt-1 text-[11px]">Si lo descuentas: ${negativos.map(negativoDe).join(' · ')}.</span>` : ''),
                okLabel:     'Sí, descontarlos',
                okBg:        'bg-blue-600 hover:bg-blue-700',
                cancelLabel: 'No, lo haré manual',
                onOk:        () => surtirAhora('auto'),
                onCancel:    () => surtirAhora('manual')
            });
            const $box = $(`#${id}`);
            $box.find('[data-ab-ok]').insertBefore($box.find('[data-ab-cancel]'));
            $box.find('[data-ab-backdrop]').off('click').on('click', () => $box.remove());
        };

        // Todo lo pendiente con su cantidad completa = Entregado; si algo va de menos o en 0,
        // Surtido parcialmente.
        $(`#${modalId}_aprobar`).on('click', () => {
            if (!almacen) {
                this.alertBox({ type: 'warning', title: 'La sucursal que surte no tiene almacén', timer: 2200 });
                return;
            }
            if (!productos.some(p => cantidades[String(p.detailId)] > 0)) {
                this.alertBox({ type: 'warning', title: 'Indica cuánto vas a entregar de al menos un producto', timer: 2000 });
                return;
            }

            const completa  = productos.every(p => cantidades[String(p.detailId)] >= pendiente(p));
            const negativos = stockLoaded ? productos.filter(p => cantidades[String(p.detailId)] > 0 && faltaDe(p) > 0) : [];
            preguntarDescuento(completa, negativos);
        });

        if (terminar) renderHistorial();
        if (almacen) loadStock(almacen.id);
        else         renderRows();
    }

    // Almacén del que se surte (ya no se elige): el que traiga el pedido o, si no, el de la
    // sucursal que surte: el principal si es suyo, luego su predeterminado, luego el primero.
    almacenQueSurte(orden) {
        if (orden.warehouse_id) return { id: orden.warehouse_id, valor: orden.warehouse_name || '' };

        const sucursal  = orden.destination_branch_id || orden.branch_id;
        const almacenes = (app.dataInit.almacenes || []).filter(a => String(a.branch_id) === String(sucursal));
        return almacenes.find(a => String(a.is_main) === '1') || almacenes.find(a => String(a.is_default) === '1') || almacenes[0] || null;
    }

    // ¿Surtir desde este almacén descuenta y da entrada? Solo se apaga en pedidos de otra
    // sucursal, con «Surtir pedidos mueve inventario» en No (Catálogo › Almacenes).
    mueveInventario(orden, warehouseId) {
        const destino = String(orden.destination_branch_id || '');
        const otra    = destino !== '' && destino !== String(orden.branch_id);
        const alm     = (app.dataInit.almacenes || []).find(a => String(a.id) === String(warehouseId));
        return !otra || !alm || String(alm.supply_moves_stock) !== '0';
    }

    // `onDone` = qué hacer tras rechazar (el modal de aprobación se cierra aquí y no antes: Cancelar
    // en el motivo deja la captura como estaba).
    doRejectOrden(o, onDone) {
        if (!o || !o.id) return;
        this.alertBox({
            type:             'cancel',
            title:            `Rechazar pedido ${o.folio}`,
            okLabel:          'Rechazar',
            cancelLabel:      'Cancelar',
            input:            'textarea',
            inputLabel:       'Motivo del rechazo',
            inputPlaceholder: 'Escribe el motivo...',
            inputRequired:    true,
            onOk: (value) => {
                const reason = (value || '').trim();
                useFetch({
                    url:  apiOrdenes,
                    data: { opc: 'rejectOrden', id: o.id, reason: reason }
                }).then(r => {
                    if (r && r.status === 200) {
                        if (typeof onDone === 'function') onDone();
                        this.alertBox({ type: 'success', title: r.message || 'Pedido rechazado', timer: 1600 });
                        app.selectOrden(null);
                        ordenes.lsOrdenes();
                    } else {
                        this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo rechazar el pedido' });
                    }
                });
            }
        });
    }

    doCancelOrden(o) {
        if (!o || !o.id) return;
        this.alertBox({
            type:        'cancel',
            title:       `Cancelar pedido ${o.folio}`,
            detailHtml:  'El pedido quedará cancelado. Las recepciones parciales previas no se revierten.',
            okLabel:     'Sí, cancelar',
            cancelLabel: 'No',
            onOk: async () => {
                const r = await useFetch({ url: this._link, data: { opc: 'cancelOrden', id: o.id } }).catch(() => null);
                if (r && r.status === 200) {
                    this.alertBox({ type: 'success', title: r.message || 'Pedido cancelado', timer: 1600 });
                    app.selectOrden(null);
                    ordenes.lsOrdenes();
                } else {
                    this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo cancelar el pedido' });
                }
            }
        });
    }

    // Revertir el despacho: regresa a revisión (Solicitada) o queda cancelado. En los dos se
    // cancelan la salida, la entrada a quien pidió y el reabasto pendiente (ctrl revertOrden).
    doRevertOrden(o) {
        if (!o || !o.id) return;
        const esc       = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const confirmo  = o.entradas_surtido && !(o.surtidos_por_recibir > 0);

        const revertir = async (cancelar) => {
            const r = await useFetch({
                url:  this._link,
                data: { opc: 'revertOrden', id: o.id, cancelar: cancelar ? 1 : 0, vista: app.vistaOrden(o) }
            }).catch(() => null);
            if (r && r.status === 200) {
                this.alertBox({ type: 'success', title: cancelar ? 'Pedido revertido y cancelado' : 'Pedido revertido', detailHtml: esc(r.message), timer: 6500 });
                this._refreshAfterAction(o.folio, o.id);
            } else {
                this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo revertir el pedido' });
            }
        };

        this.csChoiceCards({
            icon:    'rotate-ccw',
            title:   `¿Revertir el pedido ${esc(o.folio)}?`,
            lead:    `Se deshace lo que movió el despacho: la salida regresa el stock al almacén, la entrada sale de <b>${esc(o.branch_name || 'la sucursal que pidió')}</b> y el reabasto pendiente se cancela. Los productos vuelven como se pidieron.`,
            alerts:  confirmo ? [{ html: `<b>${esc(o.branch_name || 'La sucursal que pidió')}</b> ya confirmó «Recibí»: lo que se le quita puede dejar su stock en negativo.` }] : [],
            ask:     '¿Cómo queda el pedido?',
            choices: [
                { id: 'revisar',  icon: 'rotate-ccw', tone: 'go',  title: 'Regresar a revisión', badge: 'Recomendada',
                  text: 'Vuelve a En espera para surtirlo otra vez con Surtir.' },
                { id: 'cancelar', icon: 'ban',        tone: 'mut', title: 'Revertir y cancelar',
                  text: 'Se deshace igual y el pedido queda Cancelada.' }
            ],
            onChoose: (id) => revertir(id === 'cancelar')
        });
    }

    // «Recibí»: quien pidió confirma que le llegó lo surtido. El stock ya entró a su almacén
    // al surtirse (entrada ENT-); esto deja quién lo recibió y cuándo.
    doConfirmRecepcion(o) {
        if (!o || !o.id) return;
        this.alertBox({
            type:        'confirm',
            title:       `¿Te llegó el pedido ${o.folio}?`,
            detailHtml:  o.entradas_surtido
                ? `Ya entró a tu almacén con la entrada <b>${o.entradas_surtido}</b>. Confirma que lo recibiste.`
                : 'Confirma que te llegó lo surtido: la requisición queda Confirmado.',
            okLabel:     'Sí, lo recibí',
            cancelLabel: 'Todavía no',
            onOk: async () => {
                const r = await useFetch({ url: this._link, data: { opc: 'confirmRecepcion', id: o.id } }).catch(() => null);
                if (r && r.status === 200) {
                    this.alertBox({ type: 'success', title: r.message || 'Recepción confirmada', timer: 1800 });
                    this._refreshAfterAction(o.folio, o.id);
                } else {
                    this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo confirmar la recepción' });
                }
            }
        });
    }

    _refreshAfterAction(folio, id) {
        ordenes.lsOrdenes();
        if (folio && id) {
            setTimeout(() => app.selectOrden(folio, id), 300);
        } else {
            app.selectOrden(null);
        }
    }

    // ----------------------------------------------------------
    // Modal de nueva orden / edición (formato de Entradas: orden-form.js)
    // ----------------------------------------------------------

    // Igual que Entradas: antes de la captura se eligen Solicitar a (arranca en la
    // de la sesión) y la fecha en que se necesitan los insumos. El almacén no: lo elige
    // quien surte al aprobar. El ctrl los revisa (verifyNuevaOrden) y la captura abre con
    // ellos; ahí se pueden seguir cambiando.
    // `fecha`: el día que se tocó en el Calendario (lo necesita para).
    async openNuevaOrden(fecha = '') {
        const conteo = await useFetch({ url: apiOrdenes, data: { opc: 'showProductosSucursal' } }).catch(() => null);
        this.productosPorSucursal = (conteo && conteo.sucursales) || {};

        this.modalNuevaOrden = this.createModalForm({
            id: 'formNuevaOrden',
            data: { opc: 'verifyNuevaOrden' },
            theme: 'light',
            coffeesoft: true,
            prefijo: 'no_',
            closeOnError: false,
            bootbox: {
                title: 'Nueva requisición',
                size: 'small',
                closeButton: true
            },
            json: this.jsonNuevaOrden(this.sucursalAPedir(), fecha),
            success: (response) => {
                if (response && response.status === 200) {
                    this.openOrdenForm(null, response.data);
                } else {
                    this.alertBox({ type: 'warning', title: (response && response.message) || 'No se pudo abrir el pedido' });
                }
            }
        });

        // Enter en un campo equivale a Aceptar (cfModal): sin productos tampoco envía.
        this.modalNuevaOrden.el.on('keydown', 'input, select', (e) => {
            if (e.key === 'Enter' && this.nuevaOrdenSinProductos) {
                e.preventDefault();
                e.stopPropagation();
            }
        });

        $('#no_date_order').attr('min', moment().subtract(1, 'month').format('YYYY-MM-DD'));
        this.mountNuevaOrdenIconos();
        this.syncNuevaOrdenAviso();
    }

    // La fecha arranca vacía: hay que elegirla (required) para poder iniciar. Desde el
    // Calendario llega la del día que se tocó.
    jsonNuevaOrden(curSub, fecha = '') {
        return [
            {
                opc: 'select',
                id: 'branch_id',
                lbl: 'Solicitar a',
                class: 'col-12',
                value: curSub,
                data: this.destinos(),
                onchange: 'ordenesView.syncNuevaOrdenAviso()',
                required: true
            },
            {
                opc: 'input',
                type: 'date',
                id: 'date_order',
                lbl: OrdenForm.LABELS.fecha,
                class: 'col-12',
                value: fecha,
                required: true
            }
        ];
    }

    // Ícono dentro del select, como en el formulario previo de Entradas.
    // Debajo de Solicitar a va el aviso de sucursal propia (syncNuevaOrdenAviso).
    mountNuevaOrdenIconos() {
        $('#no_branch_id').addClass('!pl-10').before(
            $('<span>', { class: 'pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center' })
                .append($('<i>', { 'data-lucide': 'building-2', class: 'w-4 h-4' }))
        );

        // Tarjeta informativa como la de Tipo de entrada en Entradas, en tono de aviso.
        $('#no_branch_id').closest('.relative').parent().append(
            $('<div>', {
                id:    'no_branch_id_hint',
                class: 'hidden mt-1.5 flex items-start gap-2 rounded-md border border-red-100 bg-red-50 px-2.5 py-2 text-[11px] leading-snug font-semibold text-red-700'
            }).append(
                $('<i>', { 'data-lucide': 'alert-circle', class: 'w-3.5 h-3.5 mt-px flex-shrink-0 text-red-600' }),
                $('<span>', { text: OrdenForm.LABELS.mismaSucursal })
            )
        );

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    syncNuevaOrdenAviso() {
        const misma = String($('#no_branch_id').val()) === String(this.sucursalSolicitante());
        $('#no_branch_id_hint').toggleClass('hidden', !misma);

        // Sin productos con existencia en los almacenes de la sucursal elegida no hay qué pedir.
        // Aceptar vive en el pie del cfModal (fuera del form y sin id): es su último botón.
        const conProductos = (this.productosPorSucursal || {})[String($('#no_branch_id').val())] > 0;
        this.nuevaOrdenSinProductos = !conProductos;
        this.modalNuevaOrden.footer.find('button').last()
            .prop('disabled', !conProductos)
            .toggleClass('opacity-50 cursor-not-allowed', !conProductos)
            .attr('title', conProductos ? '' : 'Esta sucursal no tiene productos');
    }

    // A quién se le puede pedir: cualquier sucursal de la empresa (init › destinos).
    destinos() {
        const lista = (app.dataInit.destinos || []).filter(s => s.id !== '');
        return lista.length ? lista : (app.dataInit.sucursales || []).filter(s => s.id !== '');
    }

    // A quién se le pide por defecto: la sucursal del almacén principal. Si quien pide es
    // esa misma sucursal, la siguiente de la lista (da la vuelta al final).
    sucursalAPedir() {
        const lista     = this.destinos();
        const pide      = String(this.sucursalSolicitante());
        const principal = String(app.dataInit.principal || '');

        if (principal && principal !== pide && lista.some(s => String(s.id) === principal)) return principal;

        const i    = lista.findIndex(s => String(s.id) === pide);
        const next = lista.length ? lista[(i + 1) % lista.length] : null;
        return next ? next.id : app.subId;
    }

    // Quien pide: la sucursal del filtro o, con "Todas", la de la sesión.
    sucursalSolicitante() {
        return $('#branch_id').val() || app.subId;
    }

    // `prefill` = lo que eligió el formulario previo (branch_id, fecha).
    // Editar un pedido Solicitada pide la contraseña; en Borrador se edita directo.
    async openOrdenForm(orden, prefill = null) {
        const form = this.ordenFormInstance();

        if (orden && orden.id) {
            if (orden.status === 'Solicitada' && !(await this.askEditPassword(orden.id))) return;
            if (this.movil && this.movil.isActive()) this.openOrdenMovil(orden);
            else this.openEditOrden(form, orden);
            return;
        }

        this.ordenEditando = null;
        form.setMode(null);
        form.setData(Object.assign({ branch_id: app.subId, fecha: moment().format('YYYY-MM-DD'), nota: '' }, prefill || {}));
        form.open();
    }

    // Resuelve true si la contraseña es correcta; con una equivocada vuelve a preguntar
    // y con Cancelar resuelve false.
    askEditPassword(id, retry) {
        return new Promise((resolve) => {
            this.alertBox({
                type:             'confirm',
                icon:             'lock',
                title:            'Confirma tu contraseña',
                detailHtml:       retry ? 'Contraseña incorrecta. Intenta de nuevo.' : 'Para editar un pedido ya solicitado escribe tu contraseña.',
                input:            'password',
                inputPlaceholder: 'Tu contraseña',
                inputRequired:    true,
                inputError:       'Escribe tu contraseña',
                okLabel:          'Continuar',
                cancelLabel:      'Cancelar',
                onOk: async (password) => {
                    const r = await useFetch({
                        url:  apiOrdenes,
                        data: { opc: 'verifyEditPassword', id: id, password: password }
                    }).catch(() => null);

                    if (r && r.status === 200) { resolve(true); return; }
                    if (r && r.status === 401) { resolve(await this.askEditPassword(id, true)); return; }

                    this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo verificar la contraseña' });
                    resolve(false);
                },
                onCancel: () => resolve(false)
            });
        });
    }

    // Editar = el mismo modal del alta con los datos de la orden.
    openEditOrden(form, orden) {
        this.ordenEditando = orden;

        form.openEdit({
            id:           orden.id,
            folio:        orden.folio,
            status:       orden.status,
            branch_id:    orden.destination_branch_id || '',
            fecha:        String(orden.date_order || '').slice(0, 10),
            nota:         orden.note || '',
            productos:    this.lotePedido(orden, form)
        });
    }

    // Renglones del pedido como los arma la captura (escritorio y teléfono). Un renglón sin
    // costo (lo capturó el solicitante) se siembra con el último costo del catálogo.
    lotePedido(orden, form) {
        const catalogo = app.dataInit.productos || [];

        return (orden.productos || []).map(p => {
            const prod  = catalogo.find(c => String(c.id) === String(p.product_id)) || {};
            const costo = p.cost != null
                ? { costo: p.cost, tax: p.tax, costoSinTax: p.price_without_tax != null ? p.price_without_tax : form.baseFromCost(p.cost, p.tax) }
                : form.seedTax(prod);
            return Object.assign({
                id:        String(p.product_id),
                nombre:    p.nombre,
                sku:       p.sku || '',
                categoria: prod.categoria || 'Sin categoría',
                unit_id:   p.unit_id,
                presentacion: prod.presentacion || '',
                cantidad:  p.quantity_ordered,
                nota:      p.nota,
                stock:     0,
                image:     p.image || '',
                icon:      'package',
                bg:        'bg-gray-100',
                color:     'text-gray-500'
            }, costo);
        });
    }

    ordenFormInstance() {
        if (!this.ordenFormApi) {
            this.ordenFormApi = this.ordenForm({
                parent: 'body',
                id:     'ordenFormModal',
                json:   app.dataInit.productos || [],
                // Sin almacén, formatos ni alta de productos: solo se piden los del catálogo.
                data: {
                    sucursales: this.destinos(),
                    unidades:   app.dataInit.unidades || [],
                    fecha:      moment().format('YYYY-MM-DD')
                },
                // El solicitante no ve costos ni importes (Compras, que usa el mismo formato, sí).
                montos:   false,
                labels:   { title: 'Nueva requisición' },
                onAdd:    (payload) => this.saveOrdenForm(payload),
                onUpdate: (payload) => this.saveOrdenForm(payload)
            });
        }
        return this.ordenFormApi;
    }

    // La sucursal que pide (branch_id) es la del filtro; al editar se conserva la de la orden.
    async saveOrdenForm(payload) {
        const orden  = this.ordenEditando;
        const isEdit = !!payload.id;
        const data   = Object.assign({}, payload, {
            branch_id: (isEdit && orden ? orden.branch_id : this.sucursalSolicitante()) || ''
        });

        const r = await useFetch({
            url:  apiOrdenes,
            data: isEdit
                ? { opc: 'editOrden', id: payload.id, payload: JSON.stringify(data) }
                : { opc: 'saveOrden', payload: JSON.stringify(data) }
        }).catch(() => null);

        if (r && r.status === 200) {
            if (!isEdit && payload.submit) this.avisoPedidoEnviado(r, payload);
            else this.alertBox({ type: 'success', title: r.message || (isEdit ? 'Pedido actualizado' : 'Pedido creado'), timer: 1600 });
            ordenes.lsOrdenes();
            if (isEdit && orden && orden.folio) {
                setTimeout(() => app.selectOrden(orden.folio, orden.id), 300);
            } else if (!isEdit && r.folio && r.id) {
                // Pedido recién creado: se abre su detalle.
                setTimeout(() => app.selectOrden(r.folio, r.id), 300);
            }
            return true;
        }

        this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo guardar el pedido' });
        return false;
    }

    // Pedido enviado: folio, a quién se le pidió, para cuándo y qué lleva. Se queda
    // abierto hasta que se cierra para que dé tiempo de leerlo.
    avisoPedidoEnviado(r, payload) {
        const esc       = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fmtNum    = (n) => (Number(n) % 1 === 0) ? String(Number(n)) : Number(n).toFixed(2);
        const productos = payload.productos || [];
        const sucursal  = this.destinos().find(s => String(s.id) === String(payload.destination_branch_id));
        const unidades  = productos.reduce((s, p) => s + Number(p.quantity || 0), 0);
        // span y no div: alertBox mete el detalle dentro de un <p>.
        const renglon   = (k, v) => `<span class="flex justify-between gap-3 py-1 border-b border-gray-100 last:border-b-0"><span class="text-gray-500">${k}</span><span class="font-semibold text-gray-800 text-right">${v}</span></span>`;

        this.alertBox({
            type:       'success',
            title:      `Pedido ${esc(r.folio || '')} enviado`,
            detailHtml: `
                <span class="block mt-2 mb-1 text-left text-[12px]">
                    ${renglon('Solicitado a', esc(sucursal ? sucursal.valor : '-'))}
                    ${renglon('Lo necesitas para', esc(this.fechaCorta(payload.date_order) || '-'))}
                    ${renglon('Materiales', `${productos.length} &middot; ${fmtNum(unidades)} uds`)}
                </span>
                <span class="block text-[11px] text-gray-400">Queda en espera de que lo revisen y aprueben.</span>`
        });
    }

    // ----------------------------------------------------------
    // Modal de recepción
    // ----------------------------------------------------------

    openRecepcionModal(orden) {
        if (!orden || !orden.id) return;

        const esc      = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fmtNum   = (n) => (Number(n) % 1 === 0) ? String(Number(n)) : Number(n).toFixed(2);
        const almacenes = app.dataInit.almacenes || [];

        // Si la OC ya tiene warehouse_id, lo mostramos fijo; si no, select
        const warehouseFixed = !!(orden.warehouse_id);
        const optsAlm = almacenes.map(a =>
            `<option value="${a.id}"${String(orden.warehouse_id) === String(a.id) ? ' selected' : ''}>${esc(a.valor)}</option>`
        ).join('');

        const modalId  = 'modalRecepcion';
        const $existing = $(`#${modalId}`);
        if ($existing.length) $existing.remove();

        const productos = orden.productos || [];

        const rowsHtml = productos.map(p => {
            const pendiente = Math.max(0, p.quantity_ordered - p.quantity_received);
            const completo  = pendiente <= 0;
            const iconHtml  = completo
                ? `<i data-lucide="check-circle-2" class="w-4 h-4 flex-shrink-0" style="color:#3FC189"></i>`
                : (p.quantity_received > 0
                    ? `<i data-lucide="circle-dashed" class="w-4 h-4 flex-shrink-0 text-orange-400"></i>`
                    : `<i data-lucide="circle" class="w-4 h-4 flex-shrink-0 text-gray-300"></i>`);
            const rowClass  = completo ? 'style="background:rgba(63,193,137,.05)"' : '';

            return `
                <tr ${rowClass}>
                    <td class="px-3 py-2">
                        <div class="flex items-center gap-2">
                            ${iconHtml}
                            <div>
                                <p class="font-medium text-gray-700 text-xs">${esc(p.nombre)}</p>
                                ${p.sku ? `<p class="text-[10px] text-gray-400">${esc(p.sku)}</p>` : ''}
                            </div>
                        </div>
                    </td>
                    <td class="px-3 py-2 text-center text-xs text-gray-600">${fmtNum(p.quantity_ordered)}</td>
                    <td class="px-3 py-2 text-center text-xs font-semibold" style="color:${p.quantity_received > 0 ? '#3FC189' : '#9CA3AF'}">${fmtNum(p.quantity_received)}</td>
                    <td class="px-3 py-2 text-center">
                        <input type="number" data-detail-id="${p.detailId}" data-max="${pendiente}"
                            value="${completo ? 0 : pendiente}" min="0" max="${pendiente}" step="0.01"
                            ${completo ? 'disabled' : ''}
                            class="rcv-qty no-spin w-full px-2 py-1 text-xs font-bold text-center text-gray-800 bg-white rounded outline-none ${completo ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed' : 'border focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'} border-gray-300">
                    </td>
                    <td class="px-3 py-2 text-center text-xs font-bold por-recibir" style="color:${pendiente > 0 ? '#F97316' : '#3FC189'}">${fmtNum(pendiente)}</td>
                    <td class="px-3 py-2 text-center">
                        <input type="number" data-cost-id="${p.detailId}" value="${p.cost != null ? Number(p.cost).toFixed(2) : ''}"
                            min="0" step="0.01" placeholder="0.00" ${completo ? 'disabled' : ''}
                            class="rcv-cost no-spin w-full px-2 py-1 text-xs text-right text-gray-800 rounded outline-none ${completo ? 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed' : 'bg-white border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15'}">
                    </td>
                </tr>`;
        }).join('');

        const $modal = $(`
            <div id="${modalId}" class="fixed inset-0 z-[9999] flex items-center justify-center">
                <div class="absolute inset-0 bg-black/40"></div>
                <div class="relative z-10 w-full max-w-[960px] h-[90vh] mx-3 bg-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col">

                    <!-- Header -->
                    <div class="flex items-center justify-between px-[18px] py-[14px] border-b border-gray-200 bg-gray-50 flex-shrink-0">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                                <i data-lucide="package-check" class="w-5 h-5 text-white"></i>
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-gray-800">Recepción de materiales</h3>
                                <p class="text-[11px] text-gray-500">Orden <span class="font-semibold text-gray-700">${esc(orden.folio)}</span> &middot; ${orden.status_badge}</p>
                            </div>
                        </div>
                        <button id="${modalId}_close" class="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-400">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>

                    <!-- Aviso + almacen/nota (zona fija) -->
                    <div class="px-5 pt-3 pb-3 border-b border-gray-200 bg-gray-50/60 flex-shrink-0">
                        <div class="flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 mb-3" style="border-left:4px solid rgb(var(--brand-600, 192 90 64));background:rgb(var(--brand-600, 192 90 64) /.05)">
                            <i data-lucide="info" class="w-4 h-4 mt-0.5 flex-shrink-0" style="color:rgb(var(--brand-600, 192 90 64))"></i>
                            <p class="text-[11px] text-gray-600 leading-relaxed">
                                Al confirmar, se generará una <span class="font-semibold text-gray-800">entrada al inventario</span> con las cantidades indicadas en
                                <span class="font-semibold text-gray-800">"Recibe ahora"</span> y se afectará el stock del almacén destino.
                                Si no recibes todo, la orden quedará en estado <span class="font-semibold" style="color:#F97316">Parcial</span>.
                            </p>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Almacén destino${warehouseFixed ? '' : ' *'}</label>
                                ${warehouseFixed
                                    ? `<p class="px-2.5 py-1.5 text-xs text-gray-700 bg-white border border-gray-200 rounded-md">${esc(orden.warehouse_name)}</p>
                                       <input type="hidden" id="${modalId}_warehouse_id" value="${orden.warehouse_id}">`
                                    : `<div class="relative">
                                           <select id="${modalId}_warehouse_id" class="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all cursor-pointer appearance-none pr-8">
                                               <option value="">-- Selecciona almacén --</option>
                                               ${optsAlm}
                                           </select>
                                           <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                                       </div>`
                                }
                            </div>
                            <div>
                                <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Nota de recepción <span class="text-gray-400 normal-case">(opcional)</span></label>
                                <input type="text" id="${modalId}_note" class="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 hover:border-gray-400 transition-all placeholder:text-gray-400" placeholder="Observaciones: faltantes, daños, etc.">
                            </div>
                        </div>
                    </div>

                    <!-- Encabezado lista (zona fija) -->
                    <div class="px-5 py-2.5 border-b border-gray-200 flex items-center gap-2 flex-shrink-0 bg-gray-50">
                        <div class="w-6 h-6 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center">
                            <i data-lucide="boxes" class="w-3.5 h-3.5 text-blue-600"></i>
                        </div>
                        <p class="text-[10px] font-bold uppercase tracking-wider text-gray-600">Materiales a recibir</p>
                    </div>

                    <!-- Tabla recepcion (zona flexible con scroll) -->
                    <div class="flex-1 min-h-0 overflow-y-auto cs-scroll">
                        <table class="w-full border-collapse">
                            <thead class="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th class="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold">Producto</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-20">Pedido</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-24">Ya recibido</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-28">Recibe ahora</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-24">Por recibir</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-32" title="Corrígelo con el precio de la factura">Costo c/imp. factura</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100">
                                ${rowsHtml}
                            </tbody>
                        </table>
                    </div>

                    <!-- Resumen (zona fija) -->
                    <div class="flex-shrink-0 border-t border-gray-200 px-5 py-2.5 bg-gray-50 flex items-center justify-between gap-4">
                        <div class="flex items-center gap-5 text-[11px] text-gray-500">
                            <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>Recibe ahora <strong class="text-gray-800 text-sm" id="${modalId}_totRcv">0</strong></span>
                            <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full" style="background:#F97316"></span>Pendientes <strong class="text-sm" style="color:#F97316" id="${modalId}_totPend">0</strong></span>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="flex items-center justify-between gap-3 px-[18px] py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                        <button id="${modalId}_btnCancelar" class="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-100 hover:text-gray-800 hover:border-gray-400 transition-all">Cancelar</button>
                        <button id="${modalId}_btnConfirmar" class="px-3 py-1.5 text-xs font-bold text-white bg-green-600 rounded-md hover:bg-green-500 hover:shadow-lg transition-all flex items-center gap-1.5">
                            <i data-lucide="package-check" class="w-3.5 h-3.5"></i><span>Confirmar recepción</span>
                        </button>
                    </div>
                </div>
            </div>
        `);

        $('body').append($modal);
        if (window.lucide) lucide.createIcons();

        const updateSummary = () => {
            let totalRcv = 0, totalPend = 0;
            $modal.find('.rcv-qty').each(function () {
                const max = parseFloat($(this).attr('data-max')) || 0;
                const val = parseFloat($(this).val()) || 0;
                const clamped = Math.min(Math.max(0, val), max);
                totalRcv  += clamped;
                totalPend += Math.max(0, max - clamped);
            });
            const fmtN = (n) => (n % 1 === 0) ? String(n) : n.toFixed(2);
            $(`#${modalId}_totRcv`).text(fmtN(totalRcv));
            $(`#${modalId}_totPend`).text(fmtN(totalPend));
        };

        // Recalcular "por recibir" en vivo al teclear
        $modal.on('input', '.rcv-qty', function () {
            const max  = parseFloat($(this).attr('data-max')) || 0;
            let val    = parseFloat($(this).val());
            if (isNaN(val) || val < 0) val = 0;
            if (val > max) { val = max; $(this).val(max); }
            const pend = Math.max(0, max - val);
            const fmtN = (n) => (n % 1 === 0) ? String(n) : n.toFixed(2);
            $(this).closest('tr').find('.por-recibir').text(fmtN(pend));
            $(this).closest('tr').find('.por-recibir').css('color', pend > 0 ? '#F97316' : '#3FC189');
            updateSummary();
        });

        updateSummary();

        const closeModal = () => $(`#${modalId}`).remove();
        $(`#${modalId}_close`).on('click', closeModal);
        $(`#${modalId}_btnCancelar`).on('click', closeModal);
        $modal.on('click', (e) => { if ($(e.target).is(`#${modalId}`)) closeModal(); });

        $(`#${modalId}_btnConfirmar`).on('click', async () => {
            const warehouseId = $(`#${modalId}_warehouse_id`).val() || '';
            if (!warehouseFixed && !warehouseId) {
                this.alertBox({ type: 'warning', title: 'Selecciona el almacén de destino', timer: 1800 });
                return;
            }

            const items = {};
            $modal.find('.rcv-qty').each(function () {
                const did = $(this).attr('data-detail-id');
                const val = parseFloat($(this).val());
                if (!isNaN(val) && val > 0) items[did] = val;
            });

            if (!Object.keys(items).length) {
                this.alertBox({ type: 'warning', title: 'Indica al menos una cantidad a recibir', timer: 1800 });
                return;
            }

            const note = $(`#${modalId}_note`).val() || '';

            const costs = {};
            $modal.find('.rcv-cost:enabled').each(function () {
                const val = parseFloat($(this).val());
                if (!isNaN(val) && val >= 0) costs[$(this).attr('data-cost-id')] = val;
            });

            const r = await useFetch({
                url:  apiOrdenes,
                data: {
                    opc:          'receiveOrden',
                    id:           orden.id,
                    warehouse_id: warehouseId,
                    note:         note,
                    items:        JSON.stringify(items),
                    costs:        JSON.stringify(costs)
                }
            });

            if (r && r.status === 200) {
                this.alertBox({ type: 'success', title: r.message || 'Recepción registrada', timer: 2200 });
                closeModal();
                ordenes.lsOrdenes();
                app.selectOrden(null);
            } else {
                this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo registrar la recepción' });
            }
        });
    }

    // ----------------------------------------------------------
    // Modal de surtido (la matriz descuenta de su almacen)
    // ----------------------------------------------------------

    openSurtidoModal(orden) {
        if (!orden || !orden.id) return;

        const esc       = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fmtNum    = (n) => (Number(n) % 1 === 0) ? String(Number(n)) : Number(n).toFixed(2);
        const almacenes = app.dataInit.almacenes || [];
        const productos = orden.productos || [];

        const warehouseFixed = !!(orden.warehouse_id);
        const optsAlm = `<option value="">-- Selecciona almacén --</option>` + almacenes.map(a =>
            `<option value="${a.id}"${String(orden.warehouse_id) === String(a.id) ? ' selected' : ''}>${esc(a.valor)}</option>`
        ).join('');

        const modalId = 'modalSurtido';
        $(`#${modalId}`).remove();

        let stockMap    = {};
        let stockLoaded = false;

        const $modal = $(`
            <div id="${modalId}" class="fixed inset-0 z-[9999] flex items-center justify-center">
                <div class="absolute inset-0 bg-black/40"></div>
                <div class="relative z-10 w-full max-w-[1040px] h-[90vh] mx-3 bg-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col">

                    <div class="flex items-center justify-between px-[18px] py-[14px] border-b border-gray-200 bg-gray-50 flex-shrink-0">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style="background:rgb(var(--brand-600, 192 90 64))">
                                <i data-lucide="truck" class="w-5 h-5 text-white"></i>
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-gray-800">Surtir solicitud</h3>
                                <p class="text-[11px] text-gray-500">Solicitud <span class="font-semibold text-gray-700">${esc(orden.folio)}</span> &middot; ${orden.status_badge || ''}</p>
                            </div>
                        </div>
                        <button id="${modalId}_close" class="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-400">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>

                    <div class="px-5 pt-3 pb-3 border-b border-gray-200 bg-gray-50/60 flex-shrink-0">
                        <div class="flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 mb-3" style="border-left:4px solid rgb(var(--brand-600, 192 90 64));background:rgb(var(--brand-600, 192 90 64) /.05)">
                            <i data-lucide="info" class="w-4 h-4 mt-0.5 flex-shrink-0" style="color:rgb(var(--brand-600, 192 90 64))"></i>
                            <p id="${modalId}_info" class="text-[11px] text-gray-600 leading-relaxed"></p>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Almacén origen${warehouseFixed ? '' : ' *'}</label>
                                ${warehouseFixed
                                    ? `<p class="px-2.5 py-1.5 text-xs text-gray-700 bg-white border border-gray-200 rounded-md">${esc(orden.warehouse_name)}</p>
                                       <input type="hidden" id="${modalId}_warehouse_id" value="${orden.warehouse_id}">`
                                    : `<div class="relative">
                                           <select id="${modalId}_warehouse_id" class="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 cursor-pointer appearance-none pr-8">${optsAlm}</select>
                                           <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                                       </div>`
                                }
                            </div>
                            <div>
                                <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Nota <span class="text-gray-400 normal-case">(opcional)</span></label>
                                <input type="text" id="${modalId}_note" class="w-full px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500 placeholder:text-gray-400" placeholder="Observaciones del surtido...">
                            </div>
                        </div>
                    </div>

                    <div class="px-5 py-2.5 border-b border-gray-200 flex items-center gap-2 flex-shrink-0 bg-gray-50">
                        <div class="w-6 h-6 rounded-md bg-blue-50 border border-blue-200 flex items-center justify-center">
                            <i data-lucide="boxes" class="w-3.5 h-3.5 text-blue-600"></i>
                        </div>
                        <p class="text-[10px] font-bold uppercase tracking-wider text-gray-600">Materiales a surtir</p>
                    </div>

                    <div class="flex-1 min-h-0 overflow-y-auto cs-scroll">
                        <table class="w-full border-collapse">
                            <thead class="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th class="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold">Producto</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-16">Pedido</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-20">Surtido</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-20">Disp.</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-24">A surtir</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-24">Reabastecer</th>
                                </tr>
                            </thead>
                            <tbody id="${modalId}_tbody" class="divide-y divide-gray-100"></tbody>
                        </table>
                    </div>

                    <div class="flex-shrink-0 border-t border-gray-200 px-5 py-2.5 bg-gray-50 flex items-center justify-between gap-4">
                        <div class="flex items-center gap-5 text-[11px] text-gray-500">
                            <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full" style="background:rgb(var(--brand-600, 192 90 64))"></span>A surtir <strong class="text-gray-800 text-sm" id="${modalId}_totSup">0</strong></span>
                            <span class="flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>Reabasto <strong class="text-gray-800 text-sm" id="${modalId}_totRep">0</strong></span>
                        </div>
                    </div>

                    <div class="flex items-center justify-between gap-3 px-[18px] py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                        <button id="${modalId}_btnCancelar" class="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-100">Cancelar</button>
                        <button id="${modalId}_btnConfirmar" class="px-3 py-1.5 text-xs font-bold text-white rounded-md hover:shadow-lg transition-all flex items-center gap-1.5" style="background:rgb(var(--brand-600, 192 90 64))">
                            <i data-lucide="truck" class="w-3.5 h-3.5"></i><span>Confirmar surtido</span>
                        </button>
                    </div>
                </div>
            </div>
        `);

        $('body').append($modal);
        if (window.lucide) lucide.createIcons();

        // Qué pasa al confirmar, según el almacén origen (puede no mover inventario).
        const pintarInfo = (warehouseId) => $(`#${modalId}_info`).html(this.mueveInventario(orden, warehouseId)
            ? 'Al confirmar se genera una <span class="font-semibold text-gray-800">salida</span> que descuenta el stock del almacén origen. Si surtes más de lo disponible, el faltante queda como una <span class="font-semibold text-gray-800">orden de compra de reabasto</span> pendiente, que deberás recibir cuando registres la compra.'
            : 'Este almacén <span class="font-semibold text-gray-800">no mueve inventario</span> al surtir a otra sucursal (Catálogo › Almacenes): al confirmar no se descuenta ni entra nada, el pedido solo queda surtido.');
        pintarInfo($(`#${modalId}_warehouse_id`).val());

        const recalc = () => {
            let totSup = 0, totRep = 0;
            $modal.find('.sur-qty').each(function () { totSup += parseFloat($(this).val()) || 0; });
            $modal.find('.sur-rep').each(function () { totRep += parseFloat($(this).val()) || 0; });
            const fmtN = (n) => (n % 1 === 0) ? String(n) : n.toFixed(2);
            $(`#${modalId}_totSup`).text(fmtN(totSup));
            $(`#${modalId}_totRep`).text(fmtN(totRep));
        };

        const renderRows = () => {
            $(`#${modalId}_tbody`).html(productos.map(p => {
                // Lo que sale del almacén: lo que se eligió entregar al aprobar o lo pedido.
                const pid       = p.delivered_id || String(p.product_id);
                const pendiente = Math.max(0, p.quantity_ordered - p.quantity_received);
                const disp      = stockLoaded ? (stockMap[pid] || 0) : null;
                const dispTxt   = disp === null ? '—' : fmtNum(disp);
                const aSurtir   = pendiente; // se propone surtir todo lo pendiente (agiliza la salida)
                const repInit   = disp === null ? 0 : Math.max(0, aSurtir - disp); // faltante -> reabasto
                const completo  = pendiente <= 0;
                const dispColor = (disp !== null && disp < pendiente) ? '#F97316' : '#3FC189';
                return `
                    <tr data-detail-id="${p.detailId}" data-product-id="${pid}" data-pending="${pendiente}">
                        <td class="px-3 py-2">
                            <p class="font-medium text-gray-700 text-xs">${esc(p.delivered_nombre || p.nombre)}</p>
                            ${(p.delivered_id ? p.delivered_sku : p.sku) ? `<p class="text-[10px] text-gray-400">${esc(p.delivered_id ? p.delivered_sku : p.sku)}</p>` : ''}
                            ${p.delivered_id ? `<p class="text-[10px] text-gray-400">En lugar de ${esc(p.nombre)}</p>` : ''}
                        </td>
                        <td class="px-3 py-2 text-center text-xs text-gray-600">${fmtNum(p.quantity_ordered)}</td>
                        <td class="px-3 py-2 text-center text-xs font-semibold" style="color:${p.quantity_received > 0 ? '#3FC189' : '#9CA3AF'}">${fmtNum(p.quantity_received)}</td>
                        <td class="px-3 py-2 text-center text-xs font-bold sur-disp" style="color:${dispColor}">${dispTxt}</td>
                        <td class="px-3 py-2">
                            <input type="number" class="sur-qty no-spin w-full px-2 py-1 text-xs font-bold text-center text-gray-800 bg-white border border-gray-300 rounded focus:border-blue-600 outline-none ${completo ? 'bg-gray-100 text-gray-400' : ''}"
                                value="${completo ? 0 : aSurtir}" min="0" max="${pendiente}" step="0.01" ${completo ? 'disabled' : ''}>
                        </td>
                        <td class="px-3 py-2">
                            <input type="number" class="sur-rep no-spin w-full px-2 py-1 text-xs text-center text-gray-600 bg-gray-50 border border-gray-200 rounded outline-none cursor-default"
                                value="${completo ? 0 : repInit}" min="0" step="0.01" readonly tabindex="-1">
                        </td>
                    </tr>`;
            }).join(''));
            recalc();
        };

        const loadStock = (warehouseId) => {
            if (!warehouseId) { stockLoaded = false; stockMap = {}; renderRows(); return; }
            useFetch({ url: apiOrdenes, data: { opc: 'stockByWarehouse', warehouse_id: warehouseId } }).then(r => {
                stockMap    = (r && r.status === 200 && r.stock) ? r.stock : {};
                stockLoaded = true;
                renderRows();
            });
        };

        $(`#${modalId}_tbody`).on('input', '.sur-qty', function () {
            const $tr  = $(this).closest('tr');
            const pend = parseFloat($tr.attr('data-pending')) || 0;
            const pid  = String($tr.attr('data-product-id'));
            let val    = parseFloat($(this).val());
            if (isNaN(val) || val < 0) val = 0;
            if (val > pend) { val = pend; $(this).val(pend); }
            const disp  = stockLoaded ? (stockMap[pid] || 0) : 0;
            const falta = Math.max(0, val - disp);
            $tr.find('.sur-rep').val(falta % 1 === 0 ? falta : falta.toFixed(2));
            recalc();
        });
        $(`#${modalId}_tbody`).on('input', '.sur-rep', recalc);

        $(`#${modalId}_warehouse_id`).on('change', function () { loadStock($(this).val()); pintarInfo($(this).val()); });

        const closeModal = () => $(`#${modalId}`).remove();
        $(`#${modalId}_close`).on('click', closeModal);
        $(`#${modalId}_btnCancelar`).on('click', closeModal);
        $modal.on('click', (ev) => { if ($(ev.target).is(`#${modalId}`)) closeModal(); });

        if (warehouseFixed) loadStock(orden.warehouse_id);
        else                renderRows();

        // `compromiso` = fecha en que se espera registrar la compra del reabasto.
        const enviarSurtido = async (warehouseId, items, replenish, compromiso) => {
            const r = await useFetch({
                url:  apiOrdenes,
                data: {
                    opc:           'fulfillOrden',
                    id:            orden.id,
                    vista:         app.vistaOrden(orden),
                    warehouse_id:  warehouseId,
                    note:          $(`#${modalId}_note`).val() || '',
                    items:         JSON.stringify(items),
                    replenish:     JSON.stringify(replenish),
                    expected_date: compromiso || ''
                }
            }).catch(() => null);
            if (r && r.status === 200) {
                this.alertBox({ type: 'success', title: r.message || 'Surtido registrado', timer: 2200 });
                closeModal();
                ordenes.lsOrdenes();
                app.selectOrden(null);
                return true;
            }
            this.alertBox({ type: 'error', title: (r && r.message) || 'No se pudo surtir' });
            return false;
        };

        // Sin faltante se surte directo; con faltante primero se confirma el resumen.
        $(`#${modalId}_btnConfirmar`).on('click', () => {
            const warehouseId = $(`#${modalId}_warehouse_id`).val() || '';
            if (!warehouseId) {
                this.alertBox({ type: 'warning', title: 'Selecciona el almacén de origen', timer: 1800 });
                return;
            }
            const items = {}, replenish = {}, filas = [];
            $modal.find(`#${modalId}_tbody tr`).each(function () {
                const $tr = $(this);
                const did = $tr.attr('data-detail-id');
                const pid = String($tr.attr('data-product-id'));
                const sup = parseFloat($tr.find('.sur-qty').val());
                const rep = parseFloat($tr.find('.sur-rep').val());
                if (!isNaN(sup) && sup > 0) items[did]     = sup;
                if (!isNaN(rep) && rep > 0) replenish[did] = rep;
                if (!isNaN(sup) && sup > 0) {
                    const p = productos.find(x => String(x.detailId) === String(did)) || {};
                    filas.push({ nombre: p.delivered_nombre || p.nombre, sku: p.delivered_id ? p.delivered_sku : p.sku, sup: sup, rep: isNaN(rep) ? 0 : rep, disp: stockLoaded ? (stockMap[pid] || 0) : 0 });
                }
            });
            if (!Object.keys(items).length) {
                this.alertBox({ type: 'warning', title: 'Indica al menos una cantidad a surtir', timer: 1800 });
                return;
            }
            if (!Object.keys(replenish).length || !this.mueveInventario(orden, warehouseId)) {
                enviarSurtido(warehouseId, items, replenish, '');
                return;
            }
            this.openFaltanteModal(orden, filas, (compromiso) => enviarSurtido(warehouseId, items, replenish, compromiso));
        });
    }

    // Confirmar surtido con faltante: resumen con los totales, aviso de la compra de
    // reabasto, estado por producto y la fecha compromiso de la compra (obligatoria, no
    // anterior a hoy). `onConfirm(compromiso)` regresa true si el surtido se guardó.
    // `opts.title` / `opts.okLabel` = título y botón (al aprobar: "Confirmar aprobación
    // con faltante" y "Aprobar y surtir").
    openFaltanteModal(orden, filas, onConfirm, opts = {}) {
        const esc     = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fmtNum  = (n) => (Number(n) % 1 === 0) ? String(Number(n)) : Number(n).toFixed(2);
        const hoy     = moment().format('YYYY-MM-DD');
        const modalId = 'modalFaltante';
        $(`#${modalId}`).remove();

        const prods  = (n) => `${n} ${n === 1 ? 'producto' : 'productos'}`;
        const nSup   = filas.filter(f => f.sup > 0).length;
        const nRep   = filas.filter(f => f.rep > 0).length;

        const alcanza = (f) => {
            if (f.rep <= 0)  return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold" style="background:rgba(63,193,137,.15);color:#15803D"><i data-lucide="check" class="w-3 h-3"></i>Sí</span>`;
            if (f.disp > 0)  return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold" style="background:rgba(249,115,22,.15);color:#C2410C"><i data-lucide="alert-triangle" class="w-3 h-3"></i>Solo ${fmtNum(f.disp)} de ${fmtNum(f.sup)}</span>`;
            return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold" style="background:rgba(224,36,36,.15);color:#B91C1C"><i data-lucide="x" class="w-3 h-3"></i>No hay</span>`;
        };

        const totalCard = (label, value, color) => `
            <div class="rounded-lg border border-gray-200 bg-white px-3 py-2">
                <p class="text-[10px] font-semibold uppercase tracking-wider text-gray-500">${label}</p>
                <p class="text-base font-bold" style="color:${color}">${value}</p>
            </div>`;

        const $modal = $(`
            <div id="${modalId}" class="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                <div class="absolute inset-0 bg-black/40"></div>
                <div class="relative z-10 w-full max-w-[640px] max-h-[90vh] bg-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.25)] overflow-hidden flex flex-col">

                    <div class="flex items-center justify-between px-[18px] py-[14px] border-b border-gray-200 bg-gray-50 flex-shrink-0">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style="background:#F97316">
                                <i data-lucide="package-search" class="w-5 h-5 text-white"></i>
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-gray-800">${esc(opts.title || 'Confirmar surtido con faltante')}</h3>
                                <p class="text-[11px] text-gray-500">Solicitud <span class="font-semibold text-gray-700">${esc(orden.folio)}</span></p>
                            </div>
                        </div>
                        <button id="${modalId}_close" class="w-8 h-8 rounded-lg bg-white border border-gray-300 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:border-gray-400">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>

                    <div class="px-5 pt-3 pb-3 border-b border-gray-200 bg-gray-50/60 flex-shrink-0">
                        <div class="grid grid-cols-3 gap-3 mb-3">
                            ${totalCard('Productos', filas.length, '#1F2937')}
                            ${totalCard('A surtir', prods(nSup), 'rgb(var(--brand-600, 192 90 64))')}
                            ${totalCard('Reabasto', prods(nRep), '#C2410C')}
                        </div>
                        <div class="flex items-start gap-2.5 rounded-lg px-3.5 py-2.5 mb-3" style="border-left:4px solid #F97316;background:rgba(249,115,22,.07)">
                            <i data-lucide="alert-triangle" class="w-4 h-4 mt-0.5 flex-shrink-0" style="color:#C2410C"></i>
                            <p class="text-[11px] text-gray-700 leading-relaxed font-semibold">Se genera una compra REAB- a recibir cuando registres la compra.</p>
                        </div>
                        <div>
                            <label class="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Fecha compromiso <span class="text-red-500">*</span> <span class="text-gray-400 normal-case">(cuándo se espera registrar la compra)</span></label>
                            <input type="date" id="${modalId}_fecha" min="${hoy}" class="w-full md:w-56 px-2.5 py-1.5 text-xs text-gray-800 bg-white border border-gray-300 rounded-md outline-none focus:border-blue-500">
                        </div>
                    </div>

                    <div class="flex-1 min-h-0 overflow-y-auto cs-scroll">
                        <table class="w-full border-collapse">
                            <thead class="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th class="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold">Producto</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-20">A surtir</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-20">Disp.</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-20">Reabasto</th>
                                    <th class="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-gray-500 font-bold w-36">¿Alcanza?</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-100">
                                ${filas.map(f => `
                                    <tr>
                                        <td class="px-3 py-2">
                                            <p class="font-medium text-gray-700 text-xs">${esc(f.nombre)}</p>
                                            ${f.sku ? `<p class="text-[10px] text-gray-400">${esc(f.sku)}</p>` : ''}
                                        </td>
                                        <td class="px-3 py-2 text-center text-xs text-gray-700 font-semibold">${fmtNum(f.sup)}</td>
                                        <td class="px-3 py-2 text-center text-xs text-gray-600">${fmtNum(f.disp)}</td>
                                        <td class="px-3 py-2 text-center text-xs font-bold" style="color:${f.rep > 0 ? '#C2410C' : '#9CA3AF'}">${f.rep > 0 ? fmtNum(f.rep) : '—'}</td>
                                        <td class="px-3 py-2 text-center">${alcanza(f)}</td>
                                    </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>

                    <div class="flex items-center justify-between gap-3 px-[18px] py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                        <button id="${modalId}_regresar" class="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-md hover:bg-gray-100">Regresar</button>
                        <button id="${modalId}_confirmar" class="px-3 py-1.5 text-xs font-bold text-white rounded-md hover:shadow-lg transition-all flex items-center gap-1.5" style="background:rgb(var(--brand-600, 192 90 64))">
                            <i data-lucide="truck" class="w-3.5 h-3.5"></i><span>${esc(opts.okLabel || 'Confirmar surtido')}</span>
                        </button>
                    </div>
                </div>
            </div>
        `);

        $('body').append($modal);
        if (window.lucide) lucide.createIcons();

        const close = () => $(`#${modalId}`).remove();
        $(`#${modalId}_close, #${modalId}_regresar`).on('click', close);
        $(`#${modalId}_fecha`).on('change', function () { $(this).removeClass('!border-red-400'); });
        $modal.on('click', (ev) => { if ($(ev.target).is(`#${modalId}`)) close(); });

        $(`#${modalId}_confirmar`).on('click', async () => {
            const compromiso = $(`#${modalId}_fecha`).val() || '';
            if (!compromiso) {
                this.alertBox({ type: 'warning', title: 'Elige la fecha compromiso', timer: 1800 });
                $(`#${modalId}_fecha`).addClass('!border-red-400').trigger('focus');
                return;
            }
            if (compromiso < hoy) {
                this.alertBox({ type: 'warning', title: 'La fecha compromiso no puede ser anterior a hoy', timer: 1800 });
                return;
            }
            const $btn = $(`#${modalId}_confirmar`).prop('disabled', true).addClass('opacity-60 pointer-events-none');
            if (await onConfirm(compromiso)) close();
            else $btn.prop('disabled', false).removeClass('opacity-60 pointer-events-none');
        });
    }

    // ----------------------------------------------------------
    // Panel de detalle (metodo principal)
    // ----------------------------------------------------------

    ordenDetailPanel(options) {
        const defaults = {
            parent:  'root',
            id:      'ordenDetailPanel',
            json:    null,
            labels: {
                emptyTitle:  'Selecciona un pedido',
                emptyHint:   'Haz clic en cualquier fila para ver el detalle aquí.',
                subtitleLbl: 'Detalle del pedido'
            },
            onClose:   () => {},
            onPrint:   () => {},
            onEdit:    () => {},
            onSubmit:  () => {},
            onApprove: () => {},
            onReject:  () => {},
            onRecibir: () => {},
            onCancel:  () => {},
            onCompromiso: () => {},
            onRecibi:  () => {},
            onRevert:  () => {}
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        const $parent = $(`#${opts.parent}`);
        if (!$parent.length) return;

        const esc      = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const fmtNum   = (n) => (Number(n) % 1 === 0) ? String(Number(n)) : Number(n).toFixed(2);

        if (!opts.json) {
            $parent.html(`
                <div class="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
                    <i data-lucide="clipboard-list" class="w-10 h-10 text-gray-300 mb-3"></i>
                    <p class="text-sm font-semibold text-gray-500">${esc(opts.labels.emptyTitle)}</p>
                    <p class="text-xs text-gray-400 mt-1 max-w-[200px]">${esc(opts.labels.emptyHint)}</p>
                </div>
            `);
            if (window.lucide) lucide.createIcons();
            return;
        }

        const e      = opts.json;
        const status = e.status || '';

        // Paso a paso con los estados de la requisición: En espera · Entregado · Confirmado.
        // «Surtido parcialmente» entra entre los dos primeros solo si pasó por ahí (está Parcial
        // o tiene más de un surtimiento en su historial). Un borrador aún no tiene paso;
        // Rechazada y Cancelada llevan su etiqueta roja. Los reabastos (REAB-) son compras y
        // conservan Armado · Enviado · Surtido.
        const reabasto  = String(e.folio || '').startsWith('REAB-');
        const estado    = e.estado || status;
        const parcial   = estado === 'Surtido parcialmente' || (e.surtidos || []).length > 1;
        const steps     = reabasto
            ? ['Armado', 'Enviado', 'Surtido']
            : ['En espera'].concat(parcial ? ['Surtido parcialmente'] : [], ['Entregado', 'Confirmado']);
        const stepOf    = { Borrador: 0, Solicitada: 1, Aprobada: 2, Parcial: 2, Recibida: 2 };
        const specialStatuses = ['Rechazada', 'Cancelada'];
        const isSpecial = specialStatuses.includes(status);
        const activeIdx = isSpecial ? -1 : (reabasto ? (status in stepOf ? stepOf[status] : -1) : steps.indexOf(estado));

        const stepperHtml = isSpecial
            ? `<div class="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-200 flex-shrink-0">
                   <span class="text-xs font-semibold px-2 py-0.5 rounded" style="background:rgba(224,36,36,.12);color:#E02424;">${esc(status.toUpperCase())}</span>
               </div>`
            : `<div class="flex items-center gap-0 px-4 py-2.5 border-b border-gray-200 flex-shrink-0 overflow-x-auto">
                   ${steps.map((s, i) => {
                       const done    = i < activeIdx;
                       const current = i === activeIdx;
                       const dotColor   = done || current ? 'rgb(var(--brand-600, 192 90 64))' : '#D1D5DB';
                       const labelColor = current ? 'rgb(var(--brand-600, 192 90 64))' : (done ? '#6B7280' : '#9CA3AF');
                       const lineColor  = done ? 'rgb(var(--brand-600, 192 90 64))' : '#E5E7EB';
                       return `
                           <div class="flex items-center flex-shrink-0">
                               <div class="flex flex-col items-center">
                                   <div class="w-2.5 h-2.5 rounded-full border-2 flex-shrink-0" style="background:${current ? 'rgb(var(--brand-600, 192 90 64))' : (done ? 'rgb(var(--brand-600, 192 90 64))' : '#fff')};border-color:${dotColor}"></div>
                                   <p class="text-[9px] font-semibold mt-0.5 whitespace-nowrap" style="color:${labelColor}">${esc(s)}</p>
                               </div>
                               ${i < steps.length - 1 ? `<div class="h-0.5 w-6 flex-shrink-0 mb-3" style="background:${lineColor}"></div>` : ''}
                           </div>`;
                   }).join('')}
               </div>`;

        // Materiales: tabla compacta sin precios ni importes. Lo recibido y la nota de
        // solicitud van bajo el nombre.
        const productosHtml = (e.productos || []).map(p => {
            const recibido = p.quantity_received;
            return `
                <tr class="border-b border-gray-100 last:border-b-0 align-top">
                    <td class="!py-1 !pl-2 !pr-2">
                        <p class="text-[11px] font-medium text-gray-700 leading-tight">${esc(p.nombre)}${p.sku ? ` <span class="text-[10px] font-normal text-gray-400">${esc(p.sku)}</span>` : ''}</p>
                        ${p.delivered_id ? `<p class="text-[10px] text-gray-500 leading-tight flex items-start gap-1 mt-0.5"><i data-lucide="repeat" class="w-3 h-3 flex-shrink-0 mt-px"></i><span>Se entregó: <b class="font-semibold text-gray-700">${esc(p.delivered_nombre)}</b>${p.delivered_unidad ? ` (${esc(p.delivered_unidad)})` : ''}</span></p>` : ''}
                        ${recibido > 0 ? `<p class="text-[10px] font-bold" style="color:#3FC189">${fmtNum(recibido)} recibido</p>` : ''}
                        ${p.nota ? `<p class="text-[10px] text-gray-500 italic flex items-start gap-1 mt-0.5"><i data-lucide="message-square" class="w-3 h-3 flex-shrink-0 mt-px"></i><span>${esc(p.nota)}</span></p>` : ''}
                    </td>
                    <td class="!py-1 !px-1 text-center text-[11px] font-semibold text-gray-800">${fmtNum(p.quantity_ordered)}</td>
                    <td class="!py-1 !pl-1 !pr-2 text-center text-[11px] text-gray-500">${esc(p.unidad || '-')}</td>
                </tr>`;
        }).join('');

        const productosTablaHtml = `
            <div class="rounded-lg overflow-hidden border border-gray-200">
                <table class="w-full border-collapse">
                    <thead>
                        <tr class="text-[10px] uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                            <th class="text-left font-semibold text-[10px] !py-1.5 !pl-2 !pr-2">Producto</th>
                            <th class="text-center font-semibold text-[10px] !py-1.5 !px-1">Cant</th>
                            <th class="text-center font-semibold text-[10px] !py-1.5 !pl-1 !pr-2">Unidad</th>
                        </tr>
                    </thead>
                    <tbody>${productosHtml}</tbody>
                </table>
            </div>`;

        // Totales
        const totProds = (e.productos || []).length;
        const totUds   = (e.productos || []).reduce((s, p) => s + p.quantity_ordered, 0);

        // Barra de acciones por estado
        const btnCls = (color, text, icon, id) =>
            `<button id="${opts.id}_${id}" class="flex-1 px-2 py-1.5 text-[11px] font-semibold text-white rounded-lg flex items-center justify-center gap-1" style="background:${color}">
                <i data-lucide="${icon}" class="w-3 h-3"></i>${text}
             </button>`;
        const btnSec = (text, icon, id) =>
            `<button id="${opts.id}_${id}" class="flex-1 px-2 py-1.5 text-[11px] font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg flex items-center justify-center gap-1">
                <i data-lucide="${icon}" class="w-3 h-3"></i>${text}
             </button>`;

        // Rol por sucursal: "origen" = sucursal solicitante (e.branch_id); "destino" =
        // sucursal a la que se le pide (e.destination_branch_id). El origen solo puede
        // cancelar su solicitud; el destino aprueba, rechaza y recibe. La distincion solo
        // aplica en solicitudes inter-sucursal (hay un destino distinto del origen). Si la
        // orden no tiene destino, o el usuario no es ninguna de las dos sucursales, el
        // gestor conserva todas las acciones (comportamiento previo).
        const miSucursal   = String((app && app.subId != null ? app.subId : (app && app.dataInit ? app.dataInit.branch_id : '')) || '');
        const ordenBranch  = String(e.branch_id != null ? e.branch_id : '');
        const ordenDestino = String(e.destination_branch_id != null ? e.destination_branch_id : '');
        const interSucursal  = ordenDestino !== '' && ordenDestino !== ordenBranch && miSucursal !== '';
        const sinRestriccion = !interSucursal; // sin destino / mono-sucursal / legacy -> acciones completas
        const esOrigen     = interSucursal && miSucursal === ordenBranch;
        const esDestino    = interSucursal && miSucursal === ordenDestino;
        const roleScoped   = esOrigen || esDestino;
        // Las OC de reabasto (REAB-) son compras a recibir, no surtidos: se reciben para
        // reponer el almacen y cuadrar el deficit dejado por un surtido sin stock.
        const esReabasto   = String(e.folio || '').startsWith('REAB-');
        // Quien surte (Mis entregas) no edita el pedido: Editar solo se pinta en Mis pedidos.
        // En el Calendario lo decide el pedido (vistaOrden).
        const vistaDe      = app.vistaOrden(e);
        const enEntregas   = vistaDe === 'entregas';
        // Quien hizo el pedido no lo aprueba ni lo surte desde Mis pedidos (el ctrl también
        // lo valida); en Mis entregas sí: ahí atiende los pedidos que le llegan.
        const esCreador    = !enEntregas && !esReabasto && String(e.user_id || '') !== '' && String(e.user_id) === String((app.dataInit && app.dataInit.user_id) || '');

        let actionsHtml = '';
        if (status === 'Borrador') {
            // El borrador solo lo gestiona su sucursal de origen.
            if (esOrigen || sinRestriccion) {
                actionsHtml = `
                    ${enEntregas ? '' : btnCls('rgb(var(--brand-600, 192 90 64))', 'Editar',   'pencil', 'edit')}
                    ${btnCls('rgb(var(--brand-600, 192 90 64))', 'Enviar',   'send',   'submit')}
                    ${btnCls('#F97316', 'Cancelar', 'ban',    'cancel')}`;
            }
        } else if (status === 'Solicitada') {
            // Quien pidió (Mis pedidos) puede editar su solicitud mientras no se apruebe.
            const editar = (!enEntregas && (esOrigen || (sinRestriccion && vistaDe === 'pedidos')))
                ? btnCls('rgb(var(--brand-600, 192 90 64))', 'Editar', 'pencil', 'edit')
                : '';
            if (esDestino || sinRestriccion) {
                // Solo la sucursal de destino (o gestor sin restriccion) aprueba o rechaza.
                actionsHtml = `
                    ${editar}
                    ${esCreador ? '' : btnCls('#3FC189', 'Surtir', 'truck', 'approve')}
                    ${btnCls('#E02424', 'Rechazar', 'x',     'reject')}`;
            } else if (esOrigen) {
                // La sucursal de origen edita o cancela su solicitud.
                actionsHtml = `
                    ${editar}
                    ${btnCls('#F97316', 'Cancelar', 'ban', 'cancel')}`;
            }
        } else if (status === 'Aprobada') {
            if (esReabasto) {
                // OC de reabasto: se recibe la compra para reponer el almacen (no se surte).
                actionsHtml = `
                    ${btnCls('#3FC189', 'Recibir',  'package-check', 'recibir')}
                    ${btnSec('Editar compromiso', 'calendar-clock', 'compromiso')}
                    ${btnCls('#F97316', 'Cancelar', 'ban',           'cancel')}`;
            } else if (sinRestriccion) {
                actionsHtml = `
                    ${esCreador ? '' : btnCls('rgb(var(--brand-600, 192 90 64))', 'Surtir',   'truck', 'recibir')}
                    ${btnCls('#F97316', 'Cancelar', 'ban',   'cancel')}`;
            } else if (esDestino) {
                actionsHtml = esCreador ? '' : btnCls('rgb(var(--brand-600, 192 90 64))', 'Surtir', 'truck', 'recibir');
            } else if (esOrigen) {
                actionsHtml = btnCls('#F97316', 'Cancelar', 'ban', 'cancel');
            }
        } else if (status === 'Parcial') {
            // La REAB- sí continúa recibiéndose (la compra puede llegar por partes). Una
            // requisición Surtido parcialmente se sigue surtiendo: Terminar de surtir abre la
            // misma hoja con su historial y solo lo pendiente.
            if (esReabasto) {
                actionsHtml = `
                    ${btnCls('#3FC189', 'Continuar recepción', 'package-check', 'recibir')}
                    ${btnSec('Editar compromiso', 'calendar-clock', 'compromiso')}`;
            } else if ((esDestino || sinRestriccion) && !esCreador) {
                actionsHtml = btnCls('#3FC189', 'Terminar de surtir', 'truck', 'approve');
            }
        } else {
            actionsHtml = '';
        }

        // Revertir: quien surte deshace el despacho (salida, entrada a quien pidió y reabasto).
        const revertible = !esReabasto && ['Aprobada', 'Parcial', 'Recibida'].includes(status) && (esDestino || sinRestriccion) && !esCreador;
        if (revertible) actionsHtml += btnSec('Revertir', 'rotate-ccw', 'revert');

        // «Recibí»: lo surtido por otra sucursal ya entró, o la requisición quedó Entregado (sin
        // entrada: salida manual o su misma sucursal); quien pidió confirma que le llegó y pasa
        // a Confirmado (porConfirmar en el ctrl).
        const sinConfirmar = !esReabasto && status === 'Recibida' && !e.received_confirmed_user_id;
        const porRecibir   = !enEntregas && (esOrigen || sinRestriccion) && (e.surtidos_por_recibir > 0 || sinConfirmar);
        if (porRecibir) actionsHtml += btnCls('#3FC189', 'Recibí', 'package-check', 'recibi');

        const recibidoHtml = `<div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Recibido por</span>${e.surtidos_por_recibir > 0 || sinConfirmar
            ? `<span class="text-amber-600 font-semibold text-right">Falta confirmar «Recibí»</span>`
            : `<span class="text-gray-700 text-right">${esc(e.received_confirmed_user_name || '-')} &middot; ${esc(this.fechaHoraCorta(e.received_confirmed_at))}</span>`}</div>`;
        const recepcionHtml = e.entradas_surtido
            ? `<div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Entró con</span><span class="text-gray-700 text-right">${esc(e.entradas_surtido)}</span></div>${recibidoHtml}`
            : (!esReabasto && status === 'Recibida' ? recibidoHtml : '');

        // Reabasto (REAB-): fecha compromiso de la compra (quién la capturó y cuándo) y la
        // tabla de lo pedido, recibido y pendiente.
        const compromisoHtml = esReabasto
            ? `<div class="mx-4 my-2 rounded-lg px-3 py-2.5 flex-shrink-0 border border-gray-200 bg-gray-50">
                   <p class="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0.5">Fecha de compromiso</p>
                   ${e.expected_date
                       ? `<p class="text-sm font-bold text-gray-800">${esc(this.fechaCorta(e.expected_date))}</p>`
                       : `<p class="text-sm font-bold text-red-600">Sin fecha de compromiso</p>`}
                   ${e.expected_date_user_name
                       ? `<p class="text-[11px] text-gray-500 mt-0.5">Capturó ${esc(e.expected_date_user_name)} &middot; ${esc(this.fechaHoraCorta(e.expected_date_at))}</p>`
                       : ''}
               </div>`
            : '';

        const reabastoHtml = `
            <div class="rounded-lg overflow-x-auto border border-gray-200">
                <table class="w-full border-collapse">
                    <thead>
                        <tr class="text-[10px] uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-200">
                            <th class="text-left font-semibold text-[10px] !py-1.5 !pl-2 !pr-2">Producto</th>
                            <th class="text-right font-semibold text-[10px] !py-1.5 !px-1">Pedido</th>
                            <th class="text-right font-semibold text-[10px] !py-1.5 !px-1">Recibido</th>
                            <th class="text-right font-semibold text-[10px] !py-1.5 !pl-1 !pr-2">Pendiente</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(e.productos || []).map(p => {
                            const pend = Math.max(0, p.quantity_ordered - p.quantity_received);
                            return `
                                <tr class="border-b border-gray-100 last:border-b-0 align-top">
                                    <td class="!py-1 !pl-2 !pr-2">
                                        <p class="text-[11px] font-medium text-gray-700 leading-tight">${esc(p.nombre)}${p.sku ? ` <span class="text-[10px] font-normal text-gray-400">${esc(p.sku)}</span>` : ''}</p>
                                    </td>
                                    <td class="!py-1 !px-1 text-right text-[11px] text-gray-700">${fmtNum(p.quantity_ordered)}</td>
                                    <td class="!py-1 !px-1 text-right text-[11px]" style="color:${p.quantity_received > 0 ? '#3FC189' : '#9CA3AF'}">${p.quantity_received > 0 ? fmtNum(p.quantity_received) : '—'}</td>
                                    <td class="!py-1 !pl-1 !pr-2 text-right text-[11px] font-semibold" style="color:${pend > 0 ? '#F97316' : '#9CA3AF'}">${pend > 0 ? fmtNum(pend) : '—'}</td>
                                </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;

        // Bloque de motivo de rechazo
        const rejectHtml = (status === 'Rechazada' && e.reject_reason)
            ? `<div class="mx-4 my-2 rounded-lg px-3 py-2.5 flex-shrink-0" style="border-left:3px solid #E02424;background:rgba(224,36,36,.07)">
                   <p class="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style="color:#E02424">Motivo del rechazo</p>
                   <p class="text-xs text-gray-700">${esc(e.reject_reason)}</p>
               </div>`
            : '';

        const necesita = this.needDateLabel(e.date_order);

        $parent.html(`
            <div class="flex-1 flex flex-col overflow-hidden">

                <!-- Header folio + badge + cerrar -->
                <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                    <div>
                        <p class="text-xs text-gray-500 uppercase tracking-wider">${esc(opts.labels.subtitleLbl)}</p>
                        <p class="text-base font-bold text-gray-800">${esc(e.folio || '-')}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        ${e.status_badge || `<span class="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-500">${esc(status)}</span>`}
                        <button id="${opts.id}_print" class="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors" title="Imprimir">
                            <i data-lucide="printer" class="w-3.5 h-3.5"></i>
                        </button>
                        <button id="${opts.id}_close" class="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors">
                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>

                <!-- Stepper -->
                ${stepperHtml}

                ${rejectHtml}

                ${compromisoHtml}

                <!-- Datos de cabecera -->
                <div class="px-4 py-3 border-b border-gray-200 flex-shrink-0 space-y-1.5">
                    <div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Pide</span><span class="text-gray-700 text-right">${esc(e.branch_name || '-')}</span></div>
                    ${e.destination_branch_name ? `<div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Surte</span><span class="text-gray-700 text-right">${esc(e.destination_branch_name)}</span></div>` : ''}
                    ${e.warehouse_name ? `<div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">${esReabasto ? 'Almacén destino' : 'Sale del almacén'}</span><span class="text-gray-700 text-right">${esc(e.warehouse_name)}</span></div>` : ''}
                    <div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Fecha solicitud</span><span class="text-gray-700 text-right">${esc(this.fechaLarga(e.created_at || e.date_order) || '-')}</span></div>
                    <div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Lo necesita para</span><span class="${necesita.today ? 'text-red-600' : 'text-gray-700'} font-bold text-right">${esc((necesita.today ? 'Hoy · ' : '') + (this.fechaLarga(e.date_order) || '-'))}</span></div>
                    ${e.expected_date && !esReabasto ? `<div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Fecha esperada</span><span class="text-gray-700 text-right">${esc(e.expected_date)}</span></div>` : ''}
                </div>

                <!-- Lista de materiales -->
                <div class="flex-1 overflow-y-auto px-4 py-2">
                    <p class="text-xs uppercase tracking-wider text-gray-500 mb-1">${esReabasto ? 'Materiales a reabastecer' : 'Materiales'} (${(e.productos || []).length})</p>
                    ${esReabasto ? reabastoHtml : productosTablaHtml}
                </div>

                <!-- Totales -->
                <div class="cs-visor-totals px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                    <div class="flex items-center justify-between">
                        <span class="text-sm font-semibold text-gray-700">Productos</span>
                        <span class="text-xl font-bold text-gray-800">${totProds}</span>
                    </div>
                    <div class="flex items-center justify-between mt-1">
                        <span class="text-sm font-semibold text-gray-700">Unidades</span>
                        <span class="text-xl font-bold text-gray-800">${fmtNum(totUds)}</span>
                    </div>
                </div>

                <!-- Quién y nota, al final de los productos (como en Entradas) -->
                <div class="px-4 py-2.5 border-t border-gray-200 flex-shrink-0 space-y-1.5">
                    <div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Solicitado por</span><span class="text-gray-700 text-right">${esc(e.user_name || '-')}</span></div>
                    ${e.approved_user_name ? `<div class="flex items-center justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Aprobado por</span><span class="text-gray-700 text-right">${esc(e.approved_user_name)}</span></div>` : ''}
                    ${e.approval_note ? `<div class="flex items-start justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Nota de aprobación</span><span class="text-gray-700 text-right">${esc(e.approval_note)}</span></div>` : ''}
                    ${recepcionHtml}
                    <div class="flex items-start justify-between gap-2 text-xs"><span class="text-gray-500 w-28 flex-shrink-0">Nota</span><span class="${e.note ? 'text-gray-700' : 'text-gray-400'} text-right">${esc(e.note || 'Sin nota')}</span></div>
                </div>

                ${actionsHtml ? `
                <!-- Barra de acciones -->
                <div class="cs-orden-actions px-4 py-3 border-t border-gray-200 flex-shrink-0">
                    ${roleScoped ? `
                    <p class="text-[10px] uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1">
                        <i data-lucide="${esOrigen ? 'building' : 'building-2'}" class="w-3 h-3"></i>
                        ${esOrigen ? 'Tu sucursal es el origen de esta solicitud' : 'Tu sucursal es el destino de esta solicitud'}
                    </p>` : ''}
                    <div class="flex gap-2">
                        ${actionsHtml}
                    </div>
                </div>
                ` : ''}
            </div>
        `);

        if (window.lucide) lucide.createIcons();

        $parent.find(`#${opts.id}_close`).on('click',    () => opts.onClose(e));
        $parent.find(`#${opts.id}_print`).on('click',    () => opts.onPrint(e));
        $parent.find(`#${opts.id}_edit`).on('click',     () => opts.onEdit(e));
        $parent.find(`#${opts.id}_submit`).on('click',   () => opts.onSubmit(e));
        $parent.find(`#${opts.id}_approve`).on('click',  () => opts.onApprove(e));
        $parent.find(`#${opts.id}_reject`).on('click',   () => opts.onReject(e));
        $parent.find(`#${opts.id}_recibir`).on('click',  () => opts.onRecibir(e));
        $parent.find(`#${opts.id}_cancel`).on('click',   () => opts.onCancel(e));
        $parent.find(`#${opts.id}_compromiso`).on('click', () => opts.onCompromiso(e));
        $parent.find(`#${opts.id}_recibi`).on('click',   () => opts.onRecibi(e));
        $parent.find(`#${opts.id}_revert`).on('click',   () => opts.onRevert(e));
    }

    // ----------------------------------------------------------
    // Header
    // ----------------------------------------------------------

    renderHeader(data) {
        this.viewHeader({
            parent:   'viewHeader',
            json:     data,
            onToggle: () => {}
        });
    }

   

    viewHeader(options) {
        const defaults = {
            parent:  'root',
            id:      'viewHeader',
            class:   'flex items-center justify-between w-full',
            json:    { title: '', subtitle: '' },
            classes: {
                title:    'text-lg font-bold text-gray-800',
                subtitle: 'text-xs text-gray-500'
            },
            onToggle: () => {}
        };

        const opts = Object.assign({}, defaults, options || {});
        opts.json    = Object.assign({}, defaults.json,    (options || {}).json    || {});
        opts.classes = Object.assign({}, defaults.classes, (options || {}).classes || {});

        const esc  = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        const wrap = $('<div>', { id: opts.id, class: opts.class });
        wrap.html(`
            <div>
                <h1 class="${opts.classes.title}">${esc(opts.json.title)}</h1>
                ${opts.json.subtitle ? `<p class="${opts.classes.subtitle}">${esc(opts.json.subtitle)}</p>` : ''}
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
    }
}

// -- Calendario --

// Pestaña Calendario: las requisiciones de la sucursal del filtro en el día en que se
// necesitan, con Mes, Semana y Agenda. Requisiciones ve las que hace y Despacho las que le
// hacen. Clic en una abre su detalle en el visor; en Requisiciones, clic en un día abre una
// requisición nueva para ese día. Mismo FullCalendar y mismos ajustes de estilo que el
// calendario de Compras.
class CalendarioPedidos extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Pedidos';
        this.calendar     = null;
    }

    // -- Bootstrap --

    render() {
        if (this.calendar) {
            this.calendar.updateSize();
            this.calendar.refetchEvents();
            return;
        }
        if (typeof FullCalendar === 'undefined') {
            $('#calendarWrap').text('No se pudo cargar el calendario.');
            return;
        }

        this.applyStyles();
        this.layout();
        this.calendar = new FullCalendar.Calendar(document.getElementById(`calendar${this.PROJECT_NAME}`), {
            initialView:   'dayGridMonth',
            locale:        'es',
            firstDay:      1,
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek,listMonth' },
            // El bundle global no trae el locale 'es': los botones se traducen aquí.
            buttonText:    { today: 'Hoy', month: 'Mes', week: 'Semana', list: 'Agenda' },
            noEventsText:  'Sin pedidos en este periodo',
            height:        'auto',
            dayMaxEvents:  3,
            moreLinkClick: 'popover',
            moreLinkText:  (n) => `+${n} más`,
            eventOrder:    'start,title',
            events:        (info, success) => this.lsEvents(info, success),
            eventContent:  (arg) => this.renderEvent(arg),
            eventDidMount: () => this.paintIcons(),
            eventClick:    (info) => this.openEvent(info),
            dateClick:     (info) => { if (app.modulo === 'requisiciones') ordenesView.openNuevaOrden(info.dateStr); },
            datesSet:      () => this.paintIcons()
        });
        this.calendar.render();
    }

    // -- Layout --

    layout() {
        this.createLayout({
            parent: 'calendarWrap',
            design: false,
            data: {
                id:    `calendarShell${this.PROJECT_NAME}`,
                class: 'w-full',
                container: [
                    { type: 'div', id: `calendar${this.PROJECT_NAME}`, class: 'w-full' },
                    { type: 'div', id: `calendarLegend${this.PROJECT_NAME}`, class: 'flex flex-wrap items-center gap-4 mt-2 text-[11px] text-gray-500' }
                ]
            }
        });

        // Los estados de la requisición (los de reabasto no salen en la leyenda); el borrador
        // solo en Requisiciones, que es donde se arma.
        const leyenda = ['En espera', 'Entregado', 'Surtido parcialmente', 'Confirmado']
            .concat(app.modulo === 'requisiciones' ? ['Borrador'] : [], ['Rechazada']);

        $(`#calendarLegend${this.PROJECT_NAME}`).append(
            leyenda.map(estado => $('<span>', { class: 'flex items-center gap-1.5' }).append(
                $('<span>', { class: 'w-2.5 h-2.5 rounded-full', css: { background: CalendarioPedidos.ESTADOS[estado] } }),
                $('<span>', { text: estado === 'Rechazada' ? 'Rechazada / Cancelada' : estado })
            )),
            app.modulo === 'requisiciones' ? $('<span>', { class: 'ml-auto text-gray-400', text: 'Clic en un día para programar una requisición' }) : null
        );
    }

    // -- Data --

    async lsEvents(info, success) {
        const filters = app.getFilters();
        const request = await useFetch({
            url:  this._link,
            data: {
                opc:       'lsCalendario',
                lado:      app.lado,
                branch_id: filters.branch_id,
                status:    filters.status,
                fi:        info.startStr.slice(0, 10),
                ff:        moment(info.end).subtract(1, 'day').format('YYYY-MM-DD')
            }
        }).catch(() => null);

        const eventos = (request && request.status === 200 ? request.events : []).map(e => Object.assign(e, {
            color:      CalendarioPedidos.ESTADOS[e.extendedProps.estado] || '#475569',
            classNames: [e.extendedProps.status === 'Recibida' ? 'po-done' : '', e.extendedProps.folio === app.selectedId ? 'po-sel' : ''].filter(Boolean)
        }));

        success(eventos);
        app.updateFooterInfo(`Mostrando ${eventos.length} ${eventos.length !== 1 ? 'pedidos' : 'pedido'}`);
    }

    // El rango del filtro mueve el calendario a su primer día.
    irA(fecha) {
        if (this.calendar && fecha) this.calendar.gotoDate(fecha);
    }

    openEvent(info) {
        $(`#calendar${this.PROJECT_NAME} .fc-event`).removeClass('po-sel');
        $(info.el).addClass('po-sel');
        app.selectOrden(info.event.extendedProps.folio, Number(info.event.id));
    }

    // -- Render helpers --

    // Mismos colores que el badge de estado (statusBadge en ctrl-ordenes), por el estado que
    // se muestra (estadoRequisicion).
    static get ESTADOS() {
        return {
            'En espera':            '#D97706',
            'Entregado':            'rgb(var(--brand-700, 168 74 51))',
            'Surtido parcialmente': '#EA580C',
            'Confirmado':           '#16A34A',
            Borrador:               '#475569',
            Aprobada:               'rgb(var(--brand-700, 168 74 51))',
            Parcial:                '#EA580C',
            Recibida:               '#16A34A',
            Rechazada:              '#DC2626',
            Cancelada:              '#DC2626'
        };
    }

    // En Mes y Semana la tarjeta va sobre el color del estado; en Agenda va sobre blanco y
    // el estado lleva su color en la píldora. Tres renglones fijos para que todas midan lo
    // mismo: sucursal, folio y estado con los materiales. Lo que no cabe se corta con «…».
    renderEvent(arg) {
        const p      = arg.event.extendedProps;
        const agenda = arg.view.type.startsWith('list');
        const pill   = agenda
            ? $('<span>', { class: 'text-white px-1.5 rounded-full text-[10px] leading-4 font-medium truncate min-w-0', css: { background: CalendarioPedidos.ESTADOS[p.estado] || '#475569' }, text: p.estado })
            : $('<span>', { class: 'bg-black/20 text-white px-1.5 rounded-full text-[10px] leading-4 font-medium truncate min-w-0', text: p.estado });

        const card = $('<div>', { class: 'px-1.5 py-1 w-full min-w-0 overflow-hidden' }).append(
            $('<div>', { class: 'font-semibold text-[11px] leading-4 truncate', text: arg.event.title }),
            $('<div>', { class: 'flex items-center gap-1 text-[10px] leading-4 font-medium opacity-90 min-w-0' }).append(
                $('<i>', { 'data-lucide': p.pide ? 'package' : 'truck', class: 'w-3 h-3 flex-shrink-0' }),
                $('<span>', { class: 'truncate', text: p.folio })
            ),
            $('<div>', { class: `mt-0.5 flex items-center gap-1 min-w-0 ${agenda ? '' : 'justify-between'}` }).append(
                pill,
                $('<span>', { class: 'text-[10px] leading-4 opacity-90 whitespace-nowrap flex-shrink-0', text: `${p.total_products} mat.` })
            )
        );
        return { domNodes: [card[0]] };
    }

    paintIcons() {
        clearTimeout(this.iconsTimer);
        this.iconsTimer = setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 0);
    }

    applyStyles() {
        if ($('#pedidos-calendar-styles').length) return;
        const c = `#calendar${this.PROJECT_NAME}`;
        $('<style>', {
            id:   'pedidos-calendar-styles',
            text: `
                ${c} { --fc-border-color:#e5e7eb; --fc-today-bg-color:rgb(var(--brand-50, 251 243 239)); --fc-page-bg-color:#fff; --fc-neutral-bg-color:#f9fafb; --fc-list-event-hover-bg-color:rgb(var(--brand-50, 251 243 239)); font-size:12px; }
                ${c} thead { background:#f9fafb; }
                /* compact.css le pone padding con !important a toda celda de tabla: en la
                   cuadrícula despegaba la rejilla del borde y metía las tarjetas. */
                ${c} .fc-scrollgrid-section > td, ${c} .fc-scrollgrid-section > th, ${c} .fc-daygrid-day { padding:0 !important; }
                ${c} .fc-col-header-cell { color:#6b7280; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; padding:5px 0 !important; }
                ${c} .fc-col-header-cell-cushion, ${c} .fc-daygrid-day-number { color:#4b5563; text-decoration:none; }
                /* El número de hoy mide lo mismo que los demás: las tarjetas arrancan a la misma altura. */
                ${c} .fc-daygrid-day-number { font-size:11px; line-height:18px; min-width:20px; padding:0 6px; margin:3px 4px; text-align:center; border-radius:999px; }
                ${c} .fc-day-today .fc-daygrid-day-number { background:rgb(var(--brand-600, 192 90 64)); color:#fff; font-weight:700; }
                ${c} .fc-daygrid-day { cursor:pointer; }
                ${c} .fc-daygrid-day-frame { min-height:76px; }
                ${c} .fc-daygrid-day-events { margin-bottom:3px; }
                ${c} .fc-daygrid-event-harness, ${c} .fc-daygrid-event .fc-event-main { min-width:0; }
                ${c} .fc-header-toolbar.fc-toolbar { margin-bottom:.75em; }
                ${c} .fc-toolbar-title { color:#1f2937; font-size:14px; font-weight:700; }
                ${c} .fc-toolbar-title::first-letter { text-transform:uppercase; }
                ${c} .fc-button { background:#fff; border:1px solid #d1d5db; color:#374151; font-size:12px; font-weight:600; padding:4px 10px; box-shadow:none; text-transform:capitalize; }
                ${c} .fc-button:hover { background:#f9fafb; color:#111827; }
                ${c} .fc-button-primary:not(:disabled).fc-button-active, ${c} .fc-button-primary:not(:disabled):active { background:rgb(var(--brand-50, 251 243 239)); border-color:rgb(var(--brand-200, 239 201 188)); color:rgb(var(--brand-700, 168 74 51)); }
                ${c} .fc-button:focus { box-shadow:0 0 0 2px rgb(var(--brand-600, 192 90 64) / .2) !important; }
                ${c} .fc-event { cursor:pointer; border:none; border-radius:6px; transition:transform .2s, box-shadow .2s; }
                ${c} .fc-event:hover { transform:translateY(-1px); box-shadow:0 4px 8px rgba(0,0,0,.15); }
                ${c} .fc-daygrid-event { margin:0 4px 3px !important; white-space:normal; }
                ${c} .fc-event.po-sel { outline:2px solid #1f2937; outline-offset:1px; }
                ${c} .fc-event.po-done { opacity:.55; }
                ${c} .fc-more-link { font-size:.7rem; padding:2px 6px; background:#f3f4f6; color:#4b5563; border-radius:4px; margin-top:2px; }
                ${c} .fc-popover { border:1px solid #e5e7eb; border-radius:8px; box-shadow:0 10px 30px rgba(0,0,0,.12); overflow:hidden; }
                ${c} .fc-popover-header { background:#f9fafb; color:#1f2937; padding:6px 10px; font-weight:600; }
                ${c} .fc-popover-body { padding:6px; min-width:220px; }
                ${c} .fc-list-event { cursor:pointer; }
                ${c} .fc-list-event-time { display:none; }
            `
        }).appendTo('head');
    }
}

// -- CoffeeIA --

class AsistentePedidos extends Templates {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'AsistentePedidos';
        this.chat         = null;
    }

    // -- Interface --

    // CoffeeIA en la navbar (iaNavButton, ia-chat.js): abre y cierra el chat.
    renderLauncher() {
        this.iaNavButton({
            id:      `launcher${this.PROJECT_NAME}`,
            onClick: () => this.render()
        });
    }

    render() {
        if (!this.chat) {
            this.chat = this.iaChat({
                id:          `chat${this.PROJECT_NAME}`,
                title:       'CoffeeIA',
                subtitle:    'Revisa y elimina pedidos y solicitudes',
                placeholder: 'Pregúntame por tus pedidos o dime cuáles eliminar…',
                attach:      false,
                welcome:     'Reviso tus pedidos de verdad: te digo qué hay, qué trae cada uno y cuáles se ven duplicados o de prueba. Si me pides eliminar o reiniciar los folios, te armo la vista previa; nada se elimina sin tu contraseña.',
                suggestions: [
                    '¿Cuántos pedidos tengo por estado?',
                    '¿Hay pedidos duplicados o de prueba?',
                    'Elimina los pedidos cancelados y rechazados',
                    'Reinicia los folios de pedidos'
                ],
                actions: {
                    delete: {
                        label: 'Eliminar',
                        tone:  'bg-red-100 text-red-700'
                    },
                    reset: {
                        label:        'Reiniciar',
                        tone:         'bg-red-100 text-red-700',
                        confirm:      'Se borran todos los marcados con lo que movieron para que el folio vuelva a empezar. Haz clic otra vez para seguir.',
                        confirmLabel: 'Sí, borrar'
                    }
                },
                onSend:    (text, adjuntos, historial, progress) => this.askPedidoIA(text, historial, progress),
                onConfirm: (token, ids) => this.applyPedidoIA(token, ids)
            });
        }

        this.chat.toggle();
    }

    // -- CRUD --

    // Una petición por vuelta: mientras el servidor devuelva `turno`, CoffeeIA sigue
    // trabajando (usó herramientas) y cada paso se enseña en la burbuja de espera.
    async askPedidoIA(text, historial, progress) {
        let data = {
            opc:       'askPedidoIA',
            mensaje:   text,
            historial: JSON.stringify(historial)
        };

        for (let vuelta = 0; vuelta < 12; vuelta++) {
            const response = await useFetch({ url: this._link, data: data });

            if (!response || !response.turno) {
                return response || {
                    status:  500,
                    message: 'CoffeeIA no respondió. Inténtalo otra vez.'
                };
            }

            (response.pasos || []).forEach((paso) => progress(paso));
            data = { opc: 'askPedidoIA', turno: response.turno };
        }

        return {
            status:  500,
            message: 'CoffeeIA dio demasiadas vueltas sin contestar. Pregúntale de otra forma.'
        };
    }

    // Pide la contraseña de quien está en sesión, como al cancelar una salida. Con una
    // equivocada vuelve a preguntar; Cancelar deja la vista previa como estaba.
    applyPedidoIA(token, ids, retry) {
        const pedidos = ids.length === 1 ? 'el pedido marcado' : `los ${ids.length} pedidos marcados`;

        return new Promise((resolve) => {
            this.alertBox({
                type:             'confirm',
                icon:             'lock',
                title:            'Confirma tu contraseña',
                detailHtml:       retry ? 'Contraseña incorrecta. Intenta de nuevo.' : `Para eliminar ${pedidos} escribe tu contraseña.`,
                input:            'password',
                inputPlaceholder: 'Tu contraseña',
                inputRequired:    true,
                inputError:       'Escribe tu contraseña',
                okLabel:          'Eliminar',
                okIcon:           'trash-2',
                okBg:             'bg-red-600 hover:bg-red-700',
                cancelLabel:      'Cancelar',
                onOk: async (password) => {
                    const response = await useFetch({
                        url: this._link,
                        data: {
                            opc:      'applyPedidoIA',
                            token:    token,
                            ids:      JSON.stringify(ids),
                            password: password
                        }
                    }).catch(() => null);

                    if (response && response.status === 401) {
                        resolve(await this.applyPedidoIA(token, ids, true));
                        return;
                    }

                    if (response && response.status === 200) this.refreshPedidos((response.data && response.data.folios) || []);

                    resolve(response || {
                        status:  500,
                        message: 'No se pudo eliminar. Inténtalo otra vez.'
                    });
                },
                onCancel: () => resolve({
                    status:  0,
                    message: 'No se eliminó nada: cancelaste la confirmación.'
                })
            });
        });
    }

    // -- Complements --

    // La tabla se recarga sin los eliminados; si el detalle abierto era uno de ellos, se cierra.
    refreshPedidos(folios) {
        if (folios.includes(app.selectedId)) app.selectOrden(null);
        ordenes.lsOrdenes();
    }
}
