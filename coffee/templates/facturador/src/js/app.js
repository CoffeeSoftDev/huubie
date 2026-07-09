class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'facturador';
        this.subId        = null;
        this.dia          = SAMPLE_FACTURADOR_DEFAULT_DAY;
        this.activeTab    = 'folios';
    }

    async init() {
        // MODO FAKE: si hubiera backend -> useFetch({ url: apiFacturador, data: { opc: 'init' } })
        this.dataInit = {
            branch_id:      '',
            vistas:         SAMPLE_FACTURADOR_VISTAS,
            meses:          SAMPLE_FACTURADOR_MESES,
            paymentForms:   SAMPLE_FACTURADOR_PAYMENT_FORMS,
            paymentMethods: SAMPLE_FACTURADOR_PAYMENT_METHODS,
            customers:      SAMPLE_FACTURADOR_CUSTOMERS,
            bridgeProducts: SAMPLE_FACTURADOR_BRIDGE_PRODUCTS
        };
        this.subId = this.dataInit.branch_id;
        branch_id  = this.subId;

        this.layout();
        this.filterBar();
        this.bindRail();
        this.showTab(this.activeTab);
    }

    layout() {
        const mainPanel = {
            type:  'div',
            id:    'mainPanel',
            class: 'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 w-full',
            children: [
                {
                    id:    'viewHeader',
                    class: 'flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'periodoBar',
                    class: 'px-3 py-3 bg-white border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'tabHost',
                    class: 'flex-1 min-h-0 overflow-hidden flex bg-white'
                }
            ]
        };

        const detailPanel = {
            type:  'aside',
            id:    'detailPanel',
            class: 'w-full md:w-72 xl:w-80 flex-shrink-0 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col overflow-auto p-3'
        };

        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'flex-1 min-h-0 w-full flex flex-col md:flex-row overflow-hidden bg-white rounded-lg border border-gray-200',
                container: [mainPanel, detailPanel]
            }
        });
    }

    filterBar() {
        const filters = [
            {
                opc:      'select',
                id:       'fVista',
                lbl:      'Vista:',
                class:    'col-12 col-md-3 col-lg-2',
                onchange: 'app.onChangeVista()',
                value:    'dia',
                data:     this.dataInit.vistas
            },
            {
                opc:         'input-calendar',
                id:          'fDia',
                lbl:         'Día:',
                class:       'col-12 col-md-4 col-lg-3',
                readonly:    true,
                placeholder: 'Selecciona un día',
                value:       '',
                required:    false
            },
            {
                opc:      'select',
                id:       'fMes',
                lbl:      'Mes:',
                class:    'col-12 col-md-4 col-lg-3',
                onchange: 'app.onChangeFilters()',
                value:    SAMPLE_FACTURADOR_DEFAULT_MONTH,
                data:     this.dataInit.meses
            }
        ];

        this.createfilterBar({
            parent:     'periodoBar',
            coffeesoft: true,
            theme:      'light',
            data:       filters
        });

        this.initDayPicker();
        this.togglePeriodo();
    }

    initDayPicker() {
        dataPicker({
            parent: 'fDia',
            type:   'all',
            rangepicker: {
                singleDatePicker:    true,
                startDate:           moment(SAMPLE_FACTURADOR_DEFAULT_DAY),
                autoApply:           true,
                showDropdowns:       true,
                alwaysShowCalendars: true,
                locale: {
                    format:     'YYYY-MM-DD',
                    applyLabel:  'Aplicar',
                    cancelLabel: 'Cancelar',
                    daysOfWeek:  ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'],
                    monthNames:  ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
                    firstDay:    1
                }
            },
            onSelect: (start) => {
                this.dia = start.format('YYYY-MM-DD');
                this.onChangeFilters();
            }
        });
    }

    bindRail() {
        $('#menu-sidebar .menu-rail-item').toArray().forEach(el => {
            const tab = $(el).data('tab');
            if (!tab) return;
            $(el).on('click', () => this.showTab(tab));
        });
    }

    togglePeriodo() {
        const modo = $('#fVista').val();
        $('#fDia').closest('[class*="col-"]').toggle(modo === 'dia');
        $('#fMes').closest('[class*="col-"]').toggle(modo === 'mes');
    }

    getPeriodo() {
        const modo = $('#fVista').val() || 'dia';
        if (modo === 'todos') {
            return { modo: 'todos', valor: '', label: 'Todos los días', chip: 'Todos', match: (f) => !!f };
        }
        if (modo === 'mes') {
            const mes = $('#fMes').val() || '';
            return { modo: 'mes', valor: mes, label: mes ? _fmtMes(mes) : '-', chip: 'Mes', match: (f) => !!f && f.startsWith(mes) };
        }
        const dia = this.dia || '';
        return { modo: 'dia', valor: dia, label: dia ? _fmtDate(dia) : '-', chip: 'Día', match: (f) => f === dia };
    }

    getSalesPeriodo() {
        const per = this.getPeriodo();
        return SAMPLE_FACTURADOR_SALES.filter(s => per.match(s.operationDate));
    }

    onChangeVista() {
        this.togglePeriodo();
        this.onChangeFilters();
    }

    onChangeFilters() {
        this.renderActiveTab();
    }

    showTab(name) {
        this.activeTab = name;
        const meta = FACTURADOR_TABS.find(t => t.id === name);

        $('#menu-sidebar .menu-rail-item').removeClass('is-active');
        $(`#menu-sidebar .menu-rail-item[data-tab="${name}"]`).addClass('is-active');

        $('#periodoBar').toggle(!!(meta && meta.periodo));
        $('#detailPanel').toggle(!!(meta && meta.detail));

        this.renderActiveTab();
    }

    renderActiveTab() {
        const name = this.activeTab;
        if (name === 'folios')    { facturador.lsFolios();    return; }
        if (name === 'resumen')   { facturador.lsResumen();   return; }
        if (name === 'ventas')    { facturador.lsVentas();    return; }
        if (name === 'detallado') { facturador.lsDetallado(); return; }
        if (name === 'facturas')  { facturador.lsFacturas();  return; }
        if (name === 'catalogos') { facturador.lsCatalogos(); return; }
    }

    openPctConfig() {
        facturadorView.openPctConfig();
    }
}
