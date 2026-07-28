let apiCargas = 'ctrl/ctrl-facturador-cargas.php';
let app, cargas, cargasView;

$(async () => {
    cargasView = new CargasView(apiCargas, 'root');
    cargas     = new Cargas(apiCargas, 'root');
    app        = new App(apiCargas, 'root');
    await app.init();
});

// -- Clase principal --

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'cargas';
        this.activeTab    = 'sales-report';
    }

    async init() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiCargas, data:{ opc:'init' } })
        this.dataInit = {
            meses:    SAMPLE_CARGAS_MESES,
            anios:    SAMPLE_CARGAS_ANIOS,
            archivos: SAMPLE_CARGAS_ARCHIVOS
        };

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        this.renderTabs();
        cargasView.renderHeader(SAMPLE_VIEW_HEADER_CARGAS);
        cargasView.renderFooter(SAMPLE_VIEW_FOOTER_CARGAS);
        cargasView.renderLogHead();
        this.renderActiveTab();
        cargas.lsBitacora();
    }

    // -- Layout --

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
                    id:    'filterBar',
                    class: 'px-3 py-3 bg-white border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'contentWrap',
                    class: 'p-3 flex-1 min-h-0 overflow-auto bg-white'
                },
                {
                    id:    'viewFooterRow',
                    class: 'flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200 flex-shrink-0'
                }
            ]
        };

        // createLayout solo itera children en type 'div': para un aside caen en el
        // default y jQuery los toma como metodo. Las zonas del panel se arman aparte.
        const detailPanel = {
            type:  'aside',
            id:    'detailPanel',
            class: 'w-full md:w-[420px] flex-shrink-0 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col overflow-hidden'
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

        this.createLayout({
            parent: 'detailPanel',
            design: false,
            data: {
                id:        'detailInner',
                class:     'flex-1 min-h-0 flex flex-col overflow-hidden',
                container: [
                    {
                        type:  'div',
                        id:    'detailHead',
                        class: 'px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-shrink-0'
                    },
                    {
                        type:  'div',
                        id:    'detailContent',
                        class: 'flex-1 min-h-0 overflow-auto scroll-thin px-3 py-3'
                    }
                ]
            }
        });

        this.contentLayout();
    }

    // Zona scrolleable: tabs con la carga del archivo activo y, debajo, la bitacora.
    contentLayout() {
        this.createLayout({
            parent: 'contentWrap',
            design: false,
            data: {
                id:    'contentGrid',
                class: 'w-full flex flex-col gap-4',
                container: [
                    {
                        type:  'div',
                        id:    'tabsHost',
                        class: 'w-full'
                    },
                    {
                        type:  'div',
                        id:    'cardLog',
                        class: 'w-full bg-white border border-gray-200 rounded-lg overflow-hidden',
                        children: [
                            {
                                id:    'headLog',
                                class: 'px-4 py-3 border-b border-gray-200 flex items-center justify-between'
                            },
                            {
                                id:    'tableLog',
                                class: 'overflow-auto scroll-thin max-h-72'
                            }
                        ]
                    }
                ]
            }
        });
    }

    // Los paneles de todos los tabs coexisten en el DOM (tabLayout solo los oculta),
    // por eso cada id lleva el sufijo del tab: sin el, `$('#uploadHead')` resolvia
    // siempre al panel del primer tab y el segundo quedaba vacio.
    tabPanelLayout(tabId) {
        this.createLayout({
            parent: `container-${tabId}`,
            design: false,
            data: {
                id:    `panel-${tabId}`,
                class: 'w-full bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-3',
                container: [
                    { type: 'div', id: `uploadHead-${tabId}`,  class: 'w-full' },
                    { type: 'div', id: `uploadZone-${tabId}`,  class: 'w-full' },
                    { type: 'div', id: `uploadStats-${tabId}`, class: 'w-full' }
                ]
            }
        });
    }

    // -- Filter bar --

    filterBar() {
        const filters = [
            {
                opc:      'select',
                id:       'fMes',
                lbl:      'Mes:',
                class:    'col-12 col-md-4 col-lg-2',
                value:    '06',
                required: false,
                onchange: 'app.onChangeFilters()',
                data:     this.dataInit.meses
            },
            {
                opc:      'select',
                id:       'fAnio',
                lbl:      'Anio:',
                class:    'col-12 col-md-4 col-lg-2',
                value:    '2026',
                required: false,
                onchange: 'app.onChangeFilters()',
                data:     this.dataInit.anios
            },
            {
                opc:         'input',
                id:          'qBuscar',
                lbl:         'Buscar:',
                class:       'col-12 col-md-4 col-lg-4',
                placeholder: 'Archivo, hoja...',
                required:    false,
                onkeyup:     'app.onChangeFilters()'
            },
            {
                opc:       'button',
                id:        'btnLimpiarLog',
                text:      'Limpiar bitacora',
                color_btn: 'danger',
                class:     'col-12 col-md-6 col-lg-3',
                onClick:   () => cargas.clearLog()
            }
        ];

        this.createfilterBar({
            parent:     'filterBar',
            coffeesoft: true,
            theme:      'light',
            data:       filters
        });
    }

    getFilters() {
        return {
            mes:  $('#fMes').val()     || '',
            anio: $('#fAnio').val()    || '',
            q:    $('#qBuscar').val()  || ''
        };
    }

    // -- Tabs --

    renderTabs() {
        this.tabLayout({
            parent:          'tabsHost',
            id:              'tabsCargas',
            theme:           'light',
            type:            'short',
            showBorder:      false,
            renderContainer: true,
            json: SAMPLE_CARGAS_TABS.map(t => Object.assign({}, t, {
                active:  t.id === this.activeTab,
                onClick: (id) => this.onChangeTab(id)
            }))
        });
    }

    renderActiveTab(tabId) {
        const id = tabId || this.activeTab;
        this.activeTab = id;
        this.tabPanelLayout(id);

        const archivo = this.dataInit.archivos[id];
        cargasView.renderUploadHead(id, archivo);
        cargasView.renderUploadZone(id, archivo);
        cargas.lsStats(id, archivo);

        if (id === 'sales-report') {
            cargasView.renderAsideHead({ icon: 'scan', title: 'Hojas detectadas' });
            cargasView.renderHojas(SAMPLE_CARGAS_HOJAS);
        } else {
            cargasView.renderAsideHead({ icon: 'list', title: 'Columnas que se leen' });
            cargas.lsColumnas();
        }
    }

    // -- Event handlers --

    onChangeTab(tabId) {
        this.renderActiveTab(tabId);
    }

    onChangeFilters() {
        cargas.lsBitacora();
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }
}

// -- Cargas --

class Cargas extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'cargas';
    }

    // -- Data --

    lsBitacora() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiCargas, data:Object.assign({ opc:'lsBitacora' }, app.getFilters()) })
        const f = app.getFilters();
        const rows = Object.values(SAMPLE_CARGAS_DB)
            .filter(e => {
                if (!f.q) return true;
                return (e.archivo + ' ' + e.hoja).toLowerCase().includes(f.q.toLowerCase());
            })
            .map(_cargaRow);

        this.createCoffeeTable3({
            parent:       'tableLog',
            id:           'tbLog',
            theme:        'light',
            center:       [4, 6],
            right:        [5],
            actionsAlign: 'center',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       11,
            border_table: 'border-0',
            emptyMessage: 'Sin registros en la bitacora de carga',
            emptyIcon:    'icon-doc-text',
            data:         { row: rows }
        });

        if (window.lucide) lucide.createIcons();

        app.updateFooterInfo(`Mostrando ${rows.length} carga${rows.length !== 1 ? 's' : ''}`);
    }

    lsColumnas() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiCargas, data:{ opc:'lsColumnas', archivo:'commands' } })
        this.createCoffeeTable3({
            parent:       'detailContent',
            id:           'tbColumnas',
            theme:        'light',
            center:       [1],
            extends:      true,
            scrollable:   false,
            f_size:       10,
            border_table: 'border-0',
            emptyMessage: 'Sin mapeo de columnas',
            emptyIcon:    'icon-list',
            data:         SAMPLE_CARGAS_COLUMNAS_TABLE
        });
    }

    lsStats(tabId, archivo) {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiCargas, data:{ opc:'showStats', archivo:archivo.id } })
        cargasView.renderInfoCards(tabId, (archivo.stats || []).map(s => ({
            id:          s.id,
            title:       s.title,
            bgColor:     'bg-gray-50',
            borderColor: 'border-gray-200',
            data: {
                value: s.valor,
                color: s.color
            }
        })));
    }

    // -- Actions --

    uploadFile(tipo) {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiCargas, data:{ opc:'uploadFile', tipo:tipo } })
        const archivo = app.dataInit.archivos[tipo];
        if (!archivo) return;
        archivo.estado = 'ok';

        if (tipo === 'commands') {
            archivo.stats = [
                { id: 'cmRenglones', title: 'Renglones', valor: '13,141',       color: 'text-gray-800'  },
                { id: 'cmCuentas',   title: 'Cuentas',   valor: '3,821',        color: 'text-gray-800'  },
                { id: 'cmProductos', title: 'Productos', valor: '186',         color: 'text-gray-800'  },
                { id: 'cmMonto',     title: 'Monto',     valor: '$186,420.50', color: 'text-[#C05A40]' }
            ];
        }

        cargasView.renderUploadZone(tipo, archivo);
        this.lsStats(tipo, archivo);
        this.alertBox({ type: 'success', title: `Archivo "${archivo.titulo}" procesado`, timer: 1600 });
    }

    downloadCarga(folio) {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiCargas, data:{ opc:'downloadCarga', folio:folio } })
        const e = SAMPLE_CARGAS_DB[folio];
        if (!e) return;
        this.alertBox({ type: 'message', title: `Descargando ${e.archivo}` });
    }

    clearLog() {
        this.swalQuestion({
            extends: true,
            opts: {
                title:             'Limpiar bitacora',
                text:              'Se ocultaran los registros de carga del periodo seleccionado.',
                icon:              'warning',
                confirmButtonText: 'Si, limpiar',
                cancelButtonText:  'No'
            }
        }).then((result) => {
            if (!result.isConfirmed) return;
            // MODO FAKE: si hubiera backend -> useFetch({ url:apiCargas, data:{ opc:'clearLog' } })
            this.createCoffeeTable3({
                parent:       'tableLog',
                id:           'tbLog',
                theme:        'light',
                emptyMessage: 'Sin registros en la bitacora de carga',
                emptyIcon:    'icon-doc-text',
                data:         { row: [] }
            });
            app.updateFooterInfo('Mostrando 0 cargas');
        });
    }
}

// -- Vista --

class CargasView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'cargas';
    }

    // -- Render helpers --

    renderHeader(data) {
        this.viewHeader({
            parent: 'viewHeader',
            id:     'hdrCargas',
            json:   data
        });
    }

    renderFooter(data) {
        this.viewFooter({
            parent: 'viewFooterRow',
            id:     'viewFooter',
            json:   data
        });
    }

    renderInfoCards(tabId, rows) {
        this.infoCard({
            parent: `uploadStats-${tabId}`,
            id:     `statsCargas-${tabId}`,
            theme:  'light',
            style:  'file',
            cols:   4,
            json:   rows
        });
    }

    renderLogHead() {
        this.panelHead({
            parent: 'headLog',
            json: {
                icon:  'activity',
                title: 'Bitacora de carga'
            }
        });
    }

    renderAsideHead(data) {
        this.panelHead({
            parent: 'detailHead',
            json:   data
        });
    }

    renderUploadHead(tabId, archivo) {
        this.uploadHead({
            parent: `uploadHead-${tabId}`,
            json:   archivo
        });
    }

    renderUploadZone(tabId, archivo) {
        this.uploadZone({
            parent:  `uploadZone-${tabId}`,
            json:    archivo,
            onClick: (tipo) => cargas.uploadFile(tipo)
        });
    }

    renderHojas(rows) {
        this.detectList({
            parent: 'detailContent',
            json:   rows
        });
    }

    // -- Components --

    uploadHead(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'flex items-start gap-3 w-full',
            json:   { titulo: '', subtitulo: '', formato: 'XLSX' }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json  = Object.assign({}, defaults.json, o.json || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html(`
            <div class="w-12 h-12 rounded-xl bg-green-50 text-green-700 flex items-center justify-center shrink-0 border border-green-200">
                <i data-lucide="sheet" class="w-6 h-6"></i>
            </div>
            <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                    <h3 class="text-[13px] font-bold text-gray-800">${esc(opts.json.titulo)}</h3>
                    <span class="badge-base b-green">${esc(opts.json.formato)}</span>
                </div>
                <p class="text-[10px] text-gray-500">${esc(opts.json.subtitulo)}</p>
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
    }

    uploadZone(options) {
        const defaults = {
            parent:  'root',
            id:      '',
            class:   'upload-zone',
            json:    { id: '', esperado: '', estado: 'pendiente', formato: 'XLSX' },
            onClick: () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json  = Object.assign({}, defaults.json, o.json || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const listo     = opts.json.estado === 'ok';
        const zoneClass = opts.class + (listo ? '' : ' pending');
        const badgeHtml = listo
            ? '<span class="badge-base b-green"><i data-lucide="check" class="w-3 h-3"></i>Cargado</span>'
            : '<span class="badge-base b-yellow"><i data-lucide="clock" class="w-3 h-3"></i>Pendiente</span>';

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: zoneClass });
        wrap.html(`
            <span class="excel-badge ${opts.json.formato === 'XLS' ? 'xls' : ''}">${esc(opts.json.formato)}</span>
            <div class="flex-1">
                <p class="text-[12px] font-semibold text-gray-700">Arrastra el Excel aqui o haz clic para buscar</p>
                <p class="text-[10px] text-gray-500">Archivo esperado: <b>${esc(opts.json.esperado)}</b></p>
            </div>
            ${badgeHtml}
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

        wrap.on('click', () => opts.onClick(opts.json.id));
    }

    detectList(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'flex flex-col gap-3 w-full',
            json:   []
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const item = (h) => `
            <div class="flex items-center gap-3 p-3 rounded-lg ${h.bgClass}">
                <div class="w-8 h-8 rounded-lg bg-white ${h.iconClass} flex items-center justify-center shadow-sm">
                    <i data-lucide="${esc(h.icon)}" class="w-4 h-4"></i>
                </div>
                <div class="flex-1">
                    <p class="text-[11px] font-bold text-gray-700">${esc(h.titulo)}</p>
                    <p class="text-[9px] text-gray-500">${esc(h.detalle)}</p>
                </div>
                <i data-lucide="check-circle-2" class="w-4 h-4 ${h.iconClass}"></i>
            </div>
        `;

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html((opts.json || []).map(item).join(''));

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
    }

    panelHead(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'flex items-center justify-between w-full',
            json:   { icon: '', iconClass: 'w-4 h-4 text-gray-400', title: '', badge: null },
            classes: {
                title: 'text-[12px] font-bold text-gray-700 flex items-center gap-2'
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const iconHtml  = opts.json.icon ? `<i data-lucide="${esc(opts.json.icon)}" class="${opts.json.iconClass}"></i>` : '';
        const badge     = opts.json.badge;
        const badgeHtml = badge ? `<span class="badge-base ${esc(badge.tone || 'b-gray')}">${esc(badge.text)}</span>` : '';

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html(`
            <h3 class="${opts.classes.title}">${iconHtml}${esc(opts.json.title)}</h3>
            ${badgeHtml}
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
    }

    viewHeader(options) {
        const defaults = {
            parent: 'root',
            id:     'viewHeader',
            class:  'flex items-center justify-between w-full',
            json:   { title: '', titleHtml: '', subtitle: '', toggles: [], back: null },
            classes: {
                title:    'text-lg font-bold text-gray-800',
                subtitle: 'text-xs text-gray-500',
                groupLbl: 'text-[9px] text-gray-500 uppercase tracking-wider font-bold',
                btn:      'demo-toggle px-2.5 py-1 rounded text-[11px] border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors',
                btnActive:'demo-toggle active px-2.5 py-1 rounded text-[11px] border border-blue-400 bg-blue-50 text-blue-700',
                sep:      'text-gray-300',
                backBtn:  'w-8 h-8 rounded-full bg-gray-100 hover:bg-blue-50 border border-gray-200 hover:border-blue-400 flex items-center justify-center text-gray-500 hover:text-blue-700 transition-colors flex-shrink-0'
            },
            onToggle: () => { },
            onBack:   null
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const state = {};
        (opts.json.toggles || []).forEach(g => { state[g.key] = g.value; });

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const toggleGroup = (g) => {
            const buttons = (g.options || []).map(op => {
                const active = state[g.key] === op.value;
                return `<button type="button"
                                data-toggle-key="${esc(g.key)}"
                                data-toggle-value="${esc(op.value)}"
                                class="${active ? opts.classes.btnActive : opts.classes.btn}">${esc(op.label)}</button>`;
            }).join('');
            return `
                <div class="flex items-center gap-2">
                    <span class="${opts.classes.groupLbl}">${esc(g.label)}</span>
                    ${buttons}
                </div>
            `;
        };

        const backCfg   = opts.json.back;
        const backHref  = typeof backCfg === 'string' ? backCfg : (backCfg && backCfg.href) || '';
        const backTitle = (backCfg && backCfg.title) || 'Regresar';
        const backHtml  = backCfg ? `
            <button type="button" id="${opts.id}_back" class="${opts.classes.backBtn}" title="${esc(backTitle)}">
                <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>
        ` : '';

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        const togglesHtml = (opts.json.toggles || [])
            .map((g, i, arr) => toggleGroup(g) + (i < arr.length - 1 ? `<span class="${opts.classes.sep}">|</span>` : ''))
            .join('');

        wrap.html(`
            <div class="flex items-center gap-3">
                ${backHtml}
                <div>
                    <h1 class="${opts.classes.title}">${opts.json.titleHtml || esc(opts.json.title)}</h1>
                    ${opts.json.subtitle ? `<p class="${opts.classes.subtitle}">${esc(opts.json.subtitle)}</p>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-4">
                ${togglesHtml}
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

        wrap.on('click', '[data-toggle-key]', (e) => {
            const $btn = $(e.currentTarget);
            const key  = $btn.attr('data-toggle-key');
            const val  = $btn.attr('data-toggle-value');
            state[key] = val;

            $btn.siblings('[data-toggle-key="' + key + '"]').addBack().each(function () {
                const isActive = $(this).attr('data-toggle-value') === val;
                this.className = isActive ? opts.classes.btnActive : opts.classes.btn;
            });

            opts.onToggle(key, val, Object.assign({}, state));
        });

        if (backCfg) {
            $(`#${opts.id}_back`).on('click', () => {
                if (typeof opts.onBack === 'function') return opts.onBack();
                if (backHref) window.location.href = backHref;
            });
        }
    }

    viewFooter(options) {
        const defaults = {
            parent: 'root',
            id:     'viewFooter',
            class:  'flex items-center justify-between w-full',
            json:   { info: '', legends: [] },
            tones: {
                default: '#9CA3AF',
                success: 'var(--cs-success,#3FC189)',
                warning: 'var(--cs-warning,#FBBF24)',
                danger:  'var(--cs-danger,#E02424)',
                info:    'var(--cs-info,#C05A40)',
                purple:  'var(--cs-accent-purple,#7C3AED)'
            },
            classes: {
                info:   'text-[10px] text-gray-500',
                legend: 'flex items-center gap-3 text-[10px] text-gray-500',
                item:   'flex items-center gap-1'
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.tones   = Object.assign({}, defaults.tones,   o.tones   || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const toneColor  = (tone) => opts.tones[tone] || opts.tones.default;
        const legendItem = (lg) => `
            <span class="${opts.classes.item}">
                <span class="w-2 h-2 rounded-full" style="background:${toneColor(lg.tone)};"></span>
                ${esc(lg.label)}
            </span>
        `;

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        const legendsHtml = (opts.json.legends || []).map(legendItem).join('');

        wrap.html(`
            <p id="${opts.id}_info" class="${opts.classes.info}">${esc(opts.json.info)}</p>
            <div class="${opts.classes.legend}">${legendsHtml}</div>
        `);

        $(`#${opts.parent}`).html(wrap);
    }
}
