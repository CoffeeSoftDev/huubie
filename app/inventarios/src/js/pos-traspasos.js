let api = 'ctrl/ctrl-pos-traspasos.php';
let app, traspasos, traspasosView;

let turno, subsidiaries_id;

window.updateSession = () => { };


$(async () => {
    traspasosView = new TraspasosView(api, 'root');
    traspasos     = new Traspasos(api, 'root');
    app           = new App(api, 'root');
    await app.init();
});


class App extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSTraspasos';
        this.subId        = null;
        this.selectedId   = null;
    }

    async init() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:{ opc:'init' } })
        this.dataInit = {
            subsidiaries_id: '',
            sucursales:  SAMPLE_TRASPASOS_SUCURSALES,
            estados:     SAMPLE_TRASPASOS_ESTADOS
        };
        this.subId      = this.dataInit.subsidiaries_id;
        subsidiaries_id = this.subId;

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        traspasosView.renderHeader(SAMPLE_VIEW_HEADER_TRASPASOS);
        traspasosView.renderFooter(SAMPLE_VIEW_FOOTER_TRASPASOS);
        // traspasosView.renderTabs(this.PROJECT_NAME);
        traspasosView.renderDetail(null);
        this.populateFilters();
        traspasos.lsTraspasos();
        traspasos.lsKpis();
    }

    // -- Layout --

    layout() {

        const mainPanel = {
            type: 'div',
            id:   'mainPanel',
            class:'flex-1 flex flex-col overflow-hidden min-w-0 w-full',
            children: [
                {
                    id:    'viewHeader',
                    text:  '#viewHeader',
                    class: 'flex items-center justify-between px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                // {
                //     id:    'tabsRow',
                //     class: 'px-4 bg-[#141d2b] border-b border-[#374151] flex-shrink-0'
                // },
                {
                    id:    'kpisRow',
                    class: 'px-3 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'filterBar',
                    class: 'px-4 py-3 bg-[#141d2b] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'tableWrap',
                    text:  '#tableWrap',
                    class: 'p-3 flex-1 '
                },
                {
                    id:    'viewFooter',
                    text:  '#viewFooter',
                    class: 'px-4 py-2 bg-[#141d2b] border-t border-[#374151] flex items-center justify-between flex-shrink-0'
                }
            ]
        };

        const detailPanel = {
            type: 'aside',
            id:   'detailPanel',
            class:'w-full md:w-[400px] flex-shrink-0 bg-[#141d2b] border-t md:border-t-0 md:border-l border-[#374151] flex flex-col overflow-hidden',
            children: [
                {
                    id:    'detailContent',
                    text:  '#detailContent',
                    class: 'flex-1 flex flex-col overflow-hidden'
                }
            ]
        };

        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'mt-16 h-[calc(100vh-4rem)] flex flex-col md:flex-row overflow-hidden overflow-y-auto md:overflow-hidden',
                container: [mainPanel, detailPanel]
            }
        });
    }

    // -- Filter bar --

    filterBar() {

        let filters = [
            // {
            //     opc:      'select',
            //     id:       'subsidiaries_id',
            //     lbl:      'Sucursal actual:',
            //     class:    'col-12 col-md-3 col-lg-3',
            //     onchange: 'app.onChangeSucursal()',
            //     data:     []
            // },
            {
                opc:      'select',
                id:       'fEstado',
                lbl:      'Estado:',
                class:    'col-12 col-md-2 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     SAMPLE_TRASPASOS_ESTADOS
            },
            {
                opc:      'select',
                id:       'fOrigen',
                lbl:      'Origen:',
                class:    'col-12 col-md-2 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     SAMPLE_TRASPASOS_SUCURSALES
            },
            {
                opc:      'select',
                id:       'fDestino',
                lbl:      'Destino:',
                class:    'col-12 col-md-2 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     SAMPLE_TRASPASOS_SUCURSALES
            },
            {
                opc:        'input',
                id:         'qBuscar',
                lbl:        'Buscar:',
                class:      'col-12 col-md-3 col-lg-3',
                placeholder:'Folio, producto...',
                onkeyup:    'app.onChangeFilters()'
            },
            {
                opc:       'button',
                id:        'btnNuevoTraspaso',
                text:      'Nuevo Traspaso',
                color_btn: ' bg-purple-600 text-white hover:bg-purple-800',
                class:     'col-12 col-md-3 col-lg-2',
                onClick:   () => traspasosView.openTraspasoForm()
            }
        ];

        this.createfilterBar({
            parent: 'filterBar',
            data:   filters
        });
    }

    populateFilters() {
        const sucursales = this.dataInit.sucursales || [];
        if (sucursales.length) {
            this.populateSelect('subsidiaries_id', sucursales);
            $('#subsidiaries_id').val(this.subId);
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
        return {
            subsidiaries_id: $('#subsidiaries_id').val() || this.subId || '',
            estado:          $('#fEstado').val()         || '',
            origen:          $('#fOrigen').val()         || '',
            destino:         $('#fDestino').val()        || '',
            q:               $('#qBuscar').val()         || ''
        };
    }

    // -- Event handlers --

    async onChangeFilters() {
        traspasos.lsTraspasos();
        await traspasos.lsKpis();

        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectTraspaso(null);
        }
    }

    onChangeSucursal() {
        traspasos.lsTraspasos();
        traspasos.lsKpis();
        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectTraspaso(null);
        }
    }

    isVisibleAfterFilters(folio) {
        const t = SAMPLE_TRASPASOS_DB[folio];
        if (!t) return false;
        const f = this.getFilters();
        const suc = !f.subsidiaries_id || t.origen.id === f.subsidiaries_id || t.destino.id === f.subsidiaries_id;
        const est = !f.estado          || t.estado    === f.estado;
        const ori = !f.origen          || t.origen.id === f.origen;
        const des = !f.destino         || t.destino.id === f.destino;
        const q   = !f.q || (t.folio + ' ' + (t.productos || []).map(p => p.nombre).join(' '))
                                .toLowerCase()
                                .includes(f.q.toLowerCase());
        return suc && est && ori && des && q;
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }

    // -- Facade --

    selectTraspaso(folio) {
        this.selectedId = folio;
        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');
        if (folio) {
            const $row = $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
                return $(this).text().includes(folio);
            });
            $row.addClass('row-active');
        }
        traspasosView.renderDetail(folio ? SAMPLE_TRASPASOS_DB[folio] : null);
    }

    renderDetail(traspaso) {
        traspasosView.renderDetail(traspaso);
    }
}


class Traspasos extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSTraspasos';
    }

    // -- Data --

    lsTraspasos() {
        // MODO FAKE: si hubiera backend -> useFetch({ data:Object.assign({ opc:'lsTraspasos' }, app.getFilters()) })
        const f = app.getFilters();
        const filteredRows = (SAMPLE_TRASPASOS_TABLE.row || []).filter(r => {
            const t = SAMPLE_TRASPASOS_DB[r.id];
            if (!t) return true;
            const suc = !f.subsidiaries_id || t.origen.id === f.subsidiaries_id || t.destino.id === f.subsidiaries_id;
            const est = !f.estado          || t.estado    === f.estado;
            const ori = !f.origen          || t.origen.id === f.origen;
            const des = !f.destino         || t.destino.id === f.destino;
            const q   = !f.q || (t.folio + ' ' + (t.productos || []).map(p => p.nombre).join(' '))
                                    .toLowerCase()
                                    .includes(f.q.toLowerCase());
            return suc && est && ori && des && q;
        });

        const data = { row: filteredRows };

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'dark',
            title:        '',
            subtitle:     '',
            center:       [3, 5, 6, 10],
            right:        [7],
            extends:      true,
            scrollable:   false,
            f_size:       12,
            emptyMessage: 'No se encontraron traspasos con los filtros aplicados',
            emptyIcon:    'icon-arrow-left-right',
            data:         data
        });

        if (window.lucide) lucide.createIcons();

        const total = filteredRows.length;
        app.updateFooterInfo(`Mostrando ${total} traspaso${total !== 1 ? 's' : ''}`);
    }

    async lsKpis() {
        // MODO FAKE: si hubiera backend -> useFetch({ data:Object.assign({ opc:'showTraspasos' }, app.getFilters()) })
        const f = app.getFilters();
        const visible = Object.values(SAMPLE_TRASPASOS_DB).filter(t => {
            const suc = !f.subsidiaries_id || t.origen.id === f.subsidiaries_id || t.destino.id === f.subsidiaries_id;
            const est = !f.estado          || t.estado    === f.estado;
            const ori = !f.origen          || t.origen.id === f.origen;
            const des = !f.destino         || t.destino.id === f.destino;
            const q   = !f.q || (t.folio + ' ' + (t.productos || []).map(p => p.nombre).join(' '))
                                    .toLowerCase()
                                    .includes(f.q.toLowerCase());
            return suc && est && ori && des && q;
        });

        const counts = {
            total:      visible.length,
            pendientes: visible.filter(t => t.estado === 'Pendiente').length,
            enTransito: visible.filter(t => t.estado === 'En Transito').length,
            recibidos:  visible.filter(t => t.estado === 'Recibido').length,
            rechazados: visible.filter(t => t.estado === 'Rechazado').length
        };

        const kpis = [
            { id: 'kpiTotal',      label: 'Total Mes',    value: counts.total,      tone: 'default' },
            { id: 'kpiPendientes', label: 'Pendientes',   value: counts.pendientes, tone: 'warning' },
            { id: 'kpiTransito',   label: 'En Transito',  value: counts.enTransito, tone: 'warning' },
            { id: 'kpiRecibidos',  label: 'Recibidos',    value: counts.recibidos,  tone: 'success' },
            { id: 'kpiRechazados', label: 'Rechazados',   value: counts.rechazados, tone: 'danger'  }
        ];
        traspasosView.renderInfoCards(kpis);
    }

    async getTraspaso(folio) {
        // MODO FAKE: si hubiera backend -> useFetch({ data:{ opc:'getTraspaso', folio } })
        traspasosView.renderDetail(SAMPLE_TRASPASOS_DB[folio] || null);
    }

    // -- Actions --

    viewTraspaso(folio) {
        console.log('[viewTraspaso]', folio);
        app.selectTraspaso(folio);
    }

    nuevoTraspaso(payload) {
        // MODO FAKE: si hubiera backend -> useFetch({ data:Object.assign({ opc:'nuevoTraspaso' }, payload) })
        console.log('[nuevoTraspaso] payload:', payload);
        this.lsTraspasos();
        this.lsKpis();
    }

    confirmTraspaso(folio) {
        // MODO FAKE: si hubiera backend -> useFetch({ data:{ opc:'confirmTraspaso', folio } })
        const t = SAMPLE_TRASPASOS_DB[folio];
        if (!t || t.estado !== 'En Transito') return;

        const nowIso = new Date().toISOString().slice(0, 19);
        t.estado    = 'Recibido';
        t.timeline  = [
            { estado: 'Recibido', usuario: (t.destino && t.destino.nombre) || 'Destino', fechaIso: nowIso },
            ...(t.timeline || [])
        ];

        SAMPLE_TRASPASOS_TABLE.row = Object.values(SAMPLE_TRASPASOS_DB).map(_trasRow);

        this.lsTraspasos();
        this.lsKpis();
        traspasosView.renderDetail(t);
        app.selectedId = folio;

        console.log('[confirmTraspaso] OK', folio);
    }

    rejectTraspaso(folio) {
        console.log('[rejectTraspaso]', folio);
    }
}


class TraspasosView extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSTraspasos';
    }

    // -- Modal launchers --

    openTraspasoForm() {
        const sucursales = (SAMPLE_TRASPASOS_SUCURSALES || []).filter(s => s.id !== '');
        this.traspasoFormModalV3({
            parent: 'body',
            json: {
                sucursales:      sucursales,
                almacenes:       SAMPLE_TRASPASOS_ALMACENES,
                categorias:      SAMPLE_TRASPASOS_CATEGORIAS,
                productos:       SAMPLE_PRODUCTOS_DISPONIBLES,
                transformMap:    SAMPLE_TRASPASOS_TRANSFORM,
                origenIdInicial: app.subId || (sucursales[0] && sucursales[0].id) || ''
            },
            onClose: () => console.log('[traspasoFormModalV3] close'),
            onSave:  (payload) => traspasos.nuevoTraspaso(payload)
        });
    }

    // -- Render helpers --

    renderDetail(traspaso) {
        this.traspasoDetailPanel({
            parent:  'detailPanel',
            json:    traspaso,
            onClose: () => {
                app.selectedId = null;
                this.renderDetail(null);
                $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');
            },
            onConfirm: (t) => traspasos.confirmTraspaso(t && t.folio),
            onReject:  (t) => traspasos.rejectTraspaso(t && t.folio)
        });
    }

    renderInfoCards(rows) {
        this.kpisRow({
            parent:  'kpisRow',
            json:    rows,
            onClick: (kpi) => console.log('[kpisRow] click', kpi.id)
        });
    }

    renderHeader(data) {
        this.viewHeader({
            parent: 'viewHeader',
            json:   data
        });
    }

    renderFooter(data) {
        this.viewFooter({
            parent: 'viewFooter',
            json:   data
        });
    }

    renderTabs(project) {
        this.tabsBar({
            parent: 'tabsRow',
            json: [
                { id: 'stock',        label: 'Stock Actual',  active: false, href: 'pos-stock.php'        },
                { id: 'movimientos',  label: 'Movimientos',   active: false, href: 'pos-movimientos.php'  },
                { id: 'entradas',     label: 'Entradas',      active: false, href: 'pos-entradas.php'     },
                { id: 'traspasos',    label: 'Traspasos',     active: true,  href: 'pos-traspasos.php'    },
                { id: 'mermas',       label: 'Mermas',        active: false, href: 'pos-mermas.php'       }
            ],
            onChange: (tab) => { if (tab && tab.href) window.location.href = tab.href; }
        });
    }

    // -- Components --

    kpisRow(options) {
        const defaults = {
            parent: 'root',
            id:     'kpisRow',
            class:  'grid grid-cols-2 md:grid-cols-5 gap-3',
            json:   [],
            labels: { empty: 'Sin indicadores' },
            tones: {
                default: 'text-white',
                success: 'text-[var(--cs-success,#3FC189)]',
                warning: 'text-[var(--cs-warning,#FBBF24)]',
                danger:  'text-[var(--cs-danger,#E02424)]',
                info:    'text-[var(--cs-info,#1C64F2)]',
                purple:  'text-[var(--cs-accent-purple,#7C3AED)]'
            },
            cardClass:  'cs-kpi-card bg-[var(--cs-bg-input,#1F2937)] rounded-lg px-3 py-3 cursor-pointer hover:bg-[var(--cs-bg-header,#141d2b)] transition-colors',
            labelClass: 'cs-kpi-label text-[10px] uppercase tracking-wider font-bold text-[var(--cs-text-muted,#9CA3AF)]',
            valueClass: 'cs-kpi-value text-sm font-bold',
            onClick:    () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});
        opts.tones  = Object.assign({}, defaults.tones,  o.tones  || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const toneClass = (tone) => opts.tones[tone] || opts.tones.default;

        const kpiCard = (kpi, idx) => {
            const cardId = kpi.id || `${opts.id}_${idx}`;
            return `
                <div id="${cardId}" data-kpi-idx="${idx}" class="${opts.cardClass}">
                    <p class="${opts.labelClass}">${esc(kpi.label)}</p>
                    <p class="${opts.valueClass} ${toneClass(kpi.tone)}" id="${cardId}_value">${esc(kpi.value)}</p>
                </div>
            `;
        };

        const grid = $('<div>', { id: opts.id, class: opts.class });

        if (!opts.json || opts.json.length === 0) {
            grid.html(`<p class="col-span-full text-[10px] text-[var(--cs-text-muted,#9CA3AF)] italic text-center py-2">${esc(opts.labels.empty)}</p>`);
            $(`#${opts.parent}`).html(grid);
            return;
        }

        grid.html(opts.json.map((kpi, idx) => kpiCard(kpi, idx)).join(''));
        $(`#${opts.parent}`).html(grid);

        grid.find('[data-kpi-idx]').on('click', (e) => {
            const idx = parseInt($(e.currentTarget).attr('data-kpi-idx'), 10);
            const kpi = opts.json[idx];
            opts.onClick(kpi, idx);
        });
    }

    viewHeader(options) {
        const defaults = {
            parent: 'root',
            id:     'viewHeader',
            class:  'flex items-center justify-between w-full',
            json:   { title: '', subtitle: '', back: null },
            classes: {
                title:    'text-base font-bold text-white',
                subtitle: 'text-[10px] text-[var(--cs-text-secondary,#D1D5DB)]',
                backBtn:  'w-8 h-8 rounded-full bg-[var(--cs-bg-input,#1F2937)] hover:bg-[var(--cs-accent-purple,#7C3AED)]/15 border border-[var(--cs-border,#374151)] hover:border-[var(--cs-accent-purple,#7C3AED)] flex items-center justify-center text-[var(--cs-text-secondary,#D1D5DB)] hover:text-white transition-colors flex-shrink-0'
            },
            onBack: null
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const backCfg   = opts.json.back;
        const backHref  = typeof backCfg === 'string' ? backCfg : (backCfg && backCfg.href) || '';
        const backTitle = (backCfg && backCfg.title) || 'Regresar';
        const backHtml  = backCfg ? `
            <button type="button" id="${opts.id}_back" class="${opts.classes.backBtn}" title="${esc(backTitle)}">
                <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>
        ` : '';

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        wrap.html(`
            <div class="flex items-center gap-3">
                ${backHtml}
                <div>
                    <h1 class="${opts.classes.title}">${esc(opts.json.title)}</h1>
                    ${opts.json.subtitle ? `<p class="${opts.classes.subtitle}">${esc(opts.json.subtitle)}</p>` : ''}
                </div>
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

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
                info:    'var(--cs-info,#1C64F2)',
                purple:  'var(--cs-accent-purple,#7C3AED)'
            },
            classes: {
                info:   'text-[10px] text-[var(--cs-text-muted,#9CA3AF)]',
                legend: 'flex items-center gap-3 text-[10px] text-[var(--cs-text-muted,#9CA3AF)] flex-wrap',
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

        const toneColor = (tone) => opts.tones[tone] || opts.tones.default;
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

    tabsBar(options) {
        const defaults = {
            parent: 'root',
            id:     'tabsBar',
            class:  'flex items-center gap-1 border-b border-transparent overflow-x-auto',
            json:   [],
            classes: {
                tab:       'px-3 py-2 text-[11px] font-medium text-[var(--cs-text-muted,#9CA3AF)] border-b-2 border-transparent hover:text-white transition-colors cursor-pointer whitespace-nowrap',
                tabActive: 'px-3 py-2 text-[11px] font-bold text-[var(--cs-accent-purple,#A78BFA)] border-b-2 border-[var(--cs-accent-purple,#7C3AED)] cursor-pointer whitespace-nowrap'
            },
            onChange: () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        wrap.html((opts.json || []).map(tab => `
            <button type="button"
                    data-tab-id="${esc(tab.id)}"
                    class="${tab.active ? opts.classes.tabActive : opts.classes.tab}">
                ${esc(tab.label)}
            </button>
        `).join(''));

        $(`#${opts.parent}`).html(wrap);

        wrap.on('click', '[data-tab-id]', (e) => {
            const id  = $(e.currentTarget).attr('data-tab-id');
            const tab = (opts.json || []).find(t => t.id === id);
            opts.onChange(tab || { id });
        });
    }

    traspasoDetailPanel(options) {
        const defaults = {
            parent:    'root',
            id:        'traspasoDetailPanel',
            class:     'w-full h-full flex-shrink-0 bg-[var(--cs-bg-header,#141d2b)] border-l border-[var(--cs-border,#374151)] flex flex-col overflow-hidden',
            json:      null,
            labels: {
                emptyTitle: 'Selecciona un traspaso',
                emptyHint:  'Haz click en una fila para ver el detalle completo aqui.',
                subtitle:   'Detalle del traspaso',
                ruta:       'Ruta del traspaso',
                origen:     'Origen',
                destino:    'Destino',
                enRuta:     'en ruta',
                solicito:   'Solicito',
                autoriza:   'Autoriza',
                fSolicitud: 'Fecha solicitud',
                fEnvio:     'Fecha envio',
                totProd:    'Total productos',
                costoTot:   'Costo total',
                productos:  'Productos en traspaso',
                historial:  'Historial',
                nota:       'Nota',
                cant:       'Cant',
                costo:      'Costo',
                subtot:     'Subtotal',
                stockO:     'Stock origen',
                stockD:     'Stock destino',
                rechazar:   'Rechazar',
                confirmar:  'Confirmar Recepcion'
            },
            estadoPalettes: {
                'Pendiente':    { bg: 'rgba(251,191,36,0.15)', fg: '#FBBF24' },
                'En Transito':  { bg: 'rgba(251,146,60,0.15)', fg: '#FB923C' },
                'Recibido':     { bg: 'rgba(63,193,137,0.15)', fg: '#3FC189' },
                'Rechazado':    { bg: 'rgba(244,63,94,0.15)',  fg: '#F43F5E' }
            },
            sucPalettes: {
                'kafeto':  { bg: 'bg-green-500/15',            color: 'text-green-400',     borderHex: 'rgba(63,193,137,0.35)',  bgHex: 'rgba(63,193,137,0.15)'  },
                'central': { bg: 'bg-[rgba(28,100,242,0.15)]', color: 'text-[#76A9FA]',     borderHex: 'rgba(28,100,242,0.35)',  bgHex: 'rgba(28,100,242,0.15)'  },
                'norte':   { bg: 'bg-purple-500/15',           color: 'text-purple-400',    borderHex: 'rgba(168,85,247,0.35)',  bgHex: 'rgba(168,85,247,0.15)'  },
                'sur':     { bg: 'bg-pink-500/15',             color: 'text-pink-400',      borderHex: 'rgba(244,114,182,0.35)', bgHex: 'rgba(244,114,182,0.15)' }
            },
            timelineDots: {
                'Solicitado':  'bg-[#76A9FA]',
                'Autorizado':  'bg-yellow-400',
                'En Transito': 'bg-orange-400',
                'Recibido':    'bg-green-400',
                'Rechazado':   'bg-red-400'
            },
            onClose:   () => { },
            onConfirm: () => { },
            onReject:  () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels         = Object.assign({}, defaults.labels,         o.labels         || {});
        opts.estadoPalettes = Object.assign({}, defaults.estadoPalettes, o.estadoPalettes || {});
        opts.sucPalettes    = Object.assign({}, defaults.sucPalettes,    o.sucPalettes    || {});
        opts.timelineDots   = Object.assign({}, defaults.timelineDots,   o.timelineDots   || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const fmtMoney      = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const fmtMoneyShort = (n) => '$' + Number(n).toLocaleString('en-US');

        const DOW = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
        const MON = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const fmtFecha = (iso) => {
            if (!iso) return '-';
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso;
            const dow = DOW[d.getDay()];
            const day = String(d.getDate()).padStart(2, '0');
            const mon = MON[d.getMonth()];
            let h     = d.getHours();
            const m   = String(d.getMinutes()).padStart(2, '0');
            const ampm = h >= 12 ? 'pm' : 'am';
            h = h % 12 || 12;
            return `${dow} ${day} ${mon} ${String(h).padStart(2, '0')}:${m} ${ampm}`;
        };

        const aside = $('<aside>', { id: opts.id, class: opts.class });

        // -- Estado vacio
        if (!opts.json) {
            aside.html(`
                <div class="px-4 py-3 border-b border-[var(--cs-border,#374151)] flex-shrink-0">
                    <h3 class="text-sm font-bold text-white">Detalle Traspaso</h3>
                    <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.subtitle)}</p>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center text-center px-6">
                    <div class="w-14 h-14 rounded-full bg-[var(--cs-bg-input,#1F2937)] border border-[var(--cs-border,#374151)] flex items-center justify-center mb-3">
                        <i data-lucide="arrow-left-right" class="w-6 h-6 text-[var(--cs-text-muted,#9CA3AF)]"></i>
                    </div>
                    <p class="text-[11px] text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.emptyTitle)}</p>
                    <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)] mt-1 max-w-[220px]">${esc(opts.labels.emptyHint)}</p>
                </div>
                <div class="px-4 py-3 border-t border-[var(--cs-border,#374151)] flex gap-2 flex-shrink-0">
                    <button type="button"
                            class="flex-1 text-xs font-semibold px-3 py-1.5 rounded-md border border-[rgba(244,63,94,0.35)] text-[#F43F5E] bg-[rgba(244,63,94,0.08)] inline-flex items-center justify-center gap-1.5 transition-colors opacity-40 cursor-not-allowed"
                            disabled>
                        <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
                        ${esc(opts.labels.rechazar)}
                    </button>
                    <button type="button"
                            class="flex-1 text-xs font-semibold px-3 py-1.5 rounded-md bg-[#3FC189] text-white inline-flex items-center justify-center gap-1.5 transition-colors opacity-40 cursor-not-allowed"
                            disabled>
                        <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
                        ${esc(opts.labels.confirmar)}
                    </button>
                </div>
            `);
            $(`#${opts.parent}`).html(aside);
            if (window.lucide) lucide.createIcons();
            return;
        }

        // -- Render con traspaso
        const t        = opts.json;
        const items    = (t.productos || []).length;
        const uds      = (t.productos || []).reduce((s, p) => s + Number(p.cant || 0), 0);
        const costoTot = (t.productos || []).reduce((s, p) => s + Number(p.cant || 0) * Number(p.costo || 0), 0);
        const estadoC  = opts.estadoPalettes[t.estado] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF' };
        const estadoBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style="background:${estadoC.bg};color:${estadoC.fg};">${esc(t.estado)}</span>`;

        const sucBlock = (suc, label) => {
            const p = opts.sucPalettes[suc.id] || { color: 'text-gray-400', borderHex: 'rgba(156,163,175,0.35)', bgHex: 'rgba(156,163,175,0.15)' };
            return `
                <div class="flex-1 text-center">
                    <div class="w-10 h-10 rounded-lg border flex items-center justify-center mx-auto mb-1" style="background:${p.bgHex};border-color:${p.borderHex};">
                        <i data-lucide="store" class="w-5 h-5 ${p.color}"></i>
                    </div>
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase">${esc(label)}</p>
                    <p class="text-[11px] font-bold">${esc(suc.nombre)}</p>
                </div>
            `;
        };

        const productosHtml = (t.productos || []).map(p => {
            const subtotal      = Number(p.cant) * Number(p.costo);
            const stockOrigPost = Number(p.stockOrigenPrev || 0) - Number(p.cant || 0);
            const stockDestPost = Number(p.stockDestinoPrev || 0) + Number(p.cant || 0);
            return `
                <div class="bg-[var(--cs-bg-input,#1F2937)] rounded-md p-2 border border-[var(--cs-border,#374151)]">
                    <div class="flex items-center gap-1.5">
                        <div class="w-7 h-7 rounded ${p.bg} flex items-center justify-center flex-shrink-0">
                            <i data-lucide="${p.icon}" class="w-3.5 h-3.5 ${p.color}"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-[10px] font-bold leading-tight truncate text-white">${esc(p.nombre)}</p>
                            <p class="text-[8px] text-[var(--cs-text-muted,#9CA3AF)] leading-tight">${esc(p.sku)}</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-1 mt-1.5 pt-1.5 border-t border-[var(--cs-border,#374151)]">
                        <div>
                            <p class="text-[7px] text-[var(--cs-text-muted,#9CA3AF)] uppercase leading-none">${esc(opts.labels.cant)}</p>
                            <p class="text-[10px] font-bold text-blue-400 leading-tight">${p.cant} uds</p>
                        </div>
                        <div>
                            <p class="text-[7px] text-[var(--cs-text-muted,#9CA3AF)] uppercase leading-none">${esc(opts.labels.costo)}</p>
                            <p class="text-[10px] font-bold text-white leading-tight">${fmtMoney(p.costo)}</p>
                        </div>
                        <div>
                            <p class="text-[7px] text-[var(--cs-text-muted,#9CA3AF)] uppercase leading-none">${esc(opts.labels.subtot)}</p>
                            <p class="text-[10px] font-bold text-white leading-tight">${fmtMoneyShort(subtotal)}</p>
                        </div>
                    </div>
                    <div class="flex justify-between mt-1 text-[8px] leading-tight">
                        <span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.stockO)}: ${p.stockOrigenPrev} &rarr; <strong class="text-orange-400">${stockOrigPost}</strong></span>
                        <span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.stockD)}: ${p.stockDestinoPrev} &rarr; <strong class="text-green-400">${stockDestPost}</strong></span>
                    </div>
                </div>
            `;
        }).join('');

        const timelineHtml = (t.timeline || []).map((tl, idx, arr) => {
            const isLast = idx === arr.length - 1;
            const dot = opts.timelineDots[tl.estado] || 'bg-gray-400';
            return `
                <div class="relative ${isLast ? '' : 'pb-3'}">
                    <div class="absolute -left-[17px] top-0 w-2.5 h-2.5 rounded-full ${dot} border-2 border-[var(--cs-bg-header,#141d2b)]"></div>
                    <p class="text-[10px] font-medium">${esc(tl.estado)} <span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(tl.usuario || '')}</span></p>
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)]">${esc(fmtFecha(tl.fechaIso))}</p>
                </div>
            `;
        }).join('') || '<p class="text-[10px] text-gray-500 italic">Sin historial</p>';

        const showConfirm = t.estado === 'En Transito';
        const showReject  = t.estado === 'Pendiente' || t.estado === 'En Transito';

        aside.html(`
            <div class="px-4 py-3 border-b border-[var(--cs-border,#374151)] flex-shrink-0 flex items-center justify-between">
                <div>
                    <h3 class="text-sm font-bold text-[#c4b5fd]">Traspaso ${esc(t.folio)}</h3>
                    <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)]">${esc(fmtFecha(t.fechaIso))}</p>
                </div>
                <div class="flex items-center gap-2">
                    ${estadoBadge}
                    <button id="${opts.id}_close" class="text-[var(--cs-text-secondary,#D1D5DB)] hover:text-white transition-colors p-1" title="Cerrar">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto cs-scroll px-4 py-3 space-y-3">

                <!-- Ruta -->
                <div class="bg-[var(--cs-bg-input,#1F2937)] rounded-lg p-3 border border-[var(--cs-border,#374151)]">
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider mb-2">${esc(opts.labels.ruta)}</p>
                    <div class="flex items-center gap-2">
                        ${sucBlock(t.origen, opts.labels.origen)}
                        <div class="flex flex-col items-center px-1">
                            <i data-lucide="arrow-right" class="w-5 h-5 text-[#c4b5fd]"></i>
                            <span class="text-[8px] text-[var(--cs-text-muted,#9CA3AF)] mt-0.5">${esc(opts.labels.enRuta)}</span>
                        </div>
                        ${sucBlock(t.destino, opts.labels.destino)}
                    </div>
                </div>

                <!-- Metadata -->
                <div class="bg-[var(--cs-bg-input,#1F2937)] rounded-lg p-3 border border-[var(--cs-border,#374151)] space-y-1.5">
                    <div class="flex justify-between text-[11px]"><span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.solicito)}</span><span class="font-medium">${esc(t.solicito || '-')}</span></div>
                    <div class="flex justify-between text-[11px]"><span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.autoriza)}</span><span class="font-medium">${esc(t.autoriza || '-')}</span></div>
                    <div class="flex justify-between text-[11px]"><span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.fSolicitud)}</span><span>${esc(fmtFecha(t.fechaIso))}</span></div>
                    <div class="flex justify-between text-[11px]"><span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.fEnvio)}</span><span>${esc(fmtFecha(t.fechaEnvio))}</span></div>
                    <div class="flex justify-between text-[11px]"><span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.totProd)}</span><span class="font-bold">${items} tipos / ${uds} uds</span></div>
                    <div class="flex justify-between text-[11px]"><span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.costoTot)}</span><span class="font-bold text-[#76A9FA]">${fmtMoney(costoTot)}</span></div>
                </div>

                <!-- Productos -->
                <div>
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider mb-2">${esc(opts.labels.productos)}</p>
                    <div class="space-y-1.5">${productosHtml || '<p class="text-[10px] text-gray-500 italic">Sin productos</p>'}</div>
                </div>

                <!-- Timeline -->
                <div>
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider mb-2">${esc(opts.labels.historial)}</p>
                    <div class="space-y-0 border-l-2 border-[var(--cs-border,#374151)] ml-2 pl-3">
                        ${timelineHtml}
                    </div>
                </div>

                <!-- Nota -->
                ${t.nota ? `
                <div class="bg-[var(--cs-bg-input,#1F2937)] rounded-lg p-3 border border-[var(--cs-border,#374151)]">
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider mb-1">${esc(opts.labels.nota)}</p>
                    <p class="text-[11px] text-gray-300">${esc(t.nota)}</p>
                </div>` : ''}
            </div>

            <div class="px-4 py-3 border-t border-[var(--cs-border,#374151)] flex gap-2 flex-shrink-0">
                <button type="button" id="${opts.id}_reject"
                        class="flex-1 text-xs font-semibold px-3 py-1.5 rounded-md border border-[rgba(244,63,94,0.35)] text-[#F43F5E] bg-[rgba(244,63,94,0.08)] hover:bg-[rgba(244,63,94,0.18)] hover:text-white hover:border-[#F43F5E] inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[rgba(244,63,94,0.08)] disabled:hover:text-[#F43F5E] disabled:hover:border-[rgba(244,63,94,0.35)]"
                        ${showReject ? '' : 'disabled'}>
                    <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
                    ${esc(opts.labels.rechazar)}
                </button>
                <button type="button" id="${opts.id}_confirm"
                        class="flex-1 text-xs font-semibold px-3 py-1.5 rounded-md bg-[#3FC189] hover:bg-[#34A372] text-white inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#3FC189]"
                        ${showConfirm ? '' : 'disabled'}>
                    <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
                    ${esc(opts.labels.confirmar)}
                </button>
            </div>
        `);

        $(`#${opts.parent}`).html(aside);
        if (window.lucide) lucide.createIcons();

        $(`#${opts.id}_close`).on('click',   () => opts.onClose(t));
        $(`#${opts.id}_reject`).on('click',  () => opts.onReject(t));
        $(`#${opts.id}_confirm`).on('click', () => opts.onConfirm(t));
    }

    traspasoFormModalV3(options) {
        const defaults = {
            parent:   'body',
            id:       'traspasoFormModalV3',
            json:     {
                sucursales:      [],
                almacenes:       [],
                categorias:      [],
                productos:       [],
                transformMap:    {},
                origenIdInicial: ''
            },
            labels: {
                title:        'Nuevo Traspaso',
                badge:        'V3',
                subtitle:     'Movimiento de inventario entre sucursales, almacenes y categorias',
                origen:       'Origen',
                origenLbl:    'Sucursal Origen',
                destino:      'Destino',
                destinoLbl:   'Sucursal Destino',
                categoria:    'Categoria',
                categoriaLbl: 'Categoria de Traspaso',
                sucursal:     'Sucursal',
                almacen:      'Almacen',
                tipo:         'Tipo',
                buscar:       'Buscar Productos',
                buscarPh:     'Nombre o SKU...',
                cart:         'Productos Seleccionados',
                cartEmpty:    'Selecciona productos de la lista para agregarlos',
                limpiar:      'Limpiar',
                cant:         'Cantidad',
                costo:        'Costo',
                subtotal:     'Subtotal',
                acciones:     'Acciones',
                producto:     'Producto',
                items:        'Items',
                unidades:     'Unidades',
                costoTot:     'Costo Total',
                nota:         'Nota',
                notaPh:       'Motivo o referencia del traspaso (opcional)...',
                cancelar:     'Cancelar',
                crear:        'Crear y enviar traspaso',
                transformar:  'Transformar en:',
                piezas:       'Piezas:',
                aplicar:      'Aplicar',
                cancelarTr:   'Cancelar',
                revertir:     'Revertir',
                transformOk:  'Se transforma en',
                transformOf:  'piezas de',
                badgeTr:      'TRANSFORMADO',
                stockLbl:     'Stock:',
                errSucIgual:  'Origen y destino no pueden ser la misma sucursal',
                errSinDest:   'Selecciona una sucursal destino',
                errSinProd:   'Agrega al menos un producto'
            },
            onClose: () => {},
            onSave:  () => {}
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json   = Object.assign({}, defaults.json,   o.json   || {});
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const fmtMoney = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // -- Estado local del carrito
        const cart = [];   // { id, name, sku, cat, price, stock, icon, bg, color, cant, transform, transformOpen }
        const transformMap = opts.json.transformMap || {};

        const findProd = (id) => (opts.json.productos || []).find(p => p.id === id);

        const stockOrigen = (prod, origenId) => {
            if (!prod || !origenId) return 0;
            return (prod.stockPorSuc && prod.stockPorSuc[origenId]) || 0;
        };
        const stockDestino = (prod, destinoId) => {
            if (!prod || !destinoId) return 0;
            return (prod.stockPorSuc && prod.stockPorSuc[destinoId]) || 0;
        };

        const optionsHtml = (list, selectedId) => (list || []).map(it =>
            `<option value="${esc(it.id)}" ${it.id === selectedId ? 'selected' : ''}>${esc(it.valor)}</option>`
        ).join('');

        const selectBox = (id, list, selectedId) => `
            <select id="${id}" class="cs-select !text-xs !py-2 w-full">
                ${optionsHtml(list, selectedId)}
            </select>
        `;

        // -- Lista de productos (columna izquierda)

        const productCardHtml = (p) => {
            const origenId = $(`#${opts.id}_origenSuc`).val() || opts.json.origenIdInicial;
            const stock    = stockOrigen(p, origenId);
            const badgeTone = stock <= 0 ? 'cs-badge-danger' : (stock < 5 ? 'cs-badge-warning' : 'cs-badge-success');
            return `
                <div class="bg-[#1F2A37] border border-[#374151] rounded-lg p-2 flex items-center gap-2 cursor-pointer hover:bg-[#1a2332] transition"
                     data-prod-id="${esc(p.id)}">
                    <div class="w-9 h-9 rounded-md bg-[#1a2332] border border-[#374151] flex items-center justify-center flex-shrink-0">
                        <i data-lucide="${esc(p.icon || 'package')}" class="w-4 h-4 ${esc(p.color || 'text-[#9CA3AF]')}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-[10px] font-semibold text-white truncate">${esc(p.nombre)}</p>
                        <p class="text-[9px] text-[#6B7280]">${esc(p.categoria || p.sku)} &middot; ${fmtMoney(p.costo)}</p>
                    </div>
                    <div class="flex flex-col items-end gap-0.5 flex-shrink-0">
                        <span class="cs-badge ${badgeTone} !text-[8px] !px-1.5">${stock}</span>
                    </div>
                </div>
            `;
        };

        const renderProductList = () => {
            const q          = ($(`#${opts.id}_search`).val() || '').toLowerCase().trim();
            const catSelId   = $(`#${opts.id}_categoria`).val() || '';
            const catSel     = (opts.json.categorias || []).find(c => c.id === catSelId);
            const catValor   = (catSel && catSel.valor) || '';

            const list = (opts.json.productos || []).filter(p => {
                const matchQ   = !q || (p.nombre + ' ' + p.sku).toLowerCase().includes(q);
                const matchCat = !catValor || (p.categoria || '').toLowerCase() === catValor.toLowerCase();
                return matchQ && matchCat;
            });

            const html = list.length
                ? list.map(productCardHtml).join('')
                : `<div class="text-[10px] text-gray-500 italic text-center py-4">Sin productos para los filtros aplicados.</div>`;
            $(`#${opts.id}_productList`).html(html);
            highlightCartRows();
            if (window.lucide) lucide.createIcons();
        };

        // -- Carrito (columna derecha)

        const addToCart = (id) => {
            const prod = findProd(id);
            if (!prod) return;
            const origenId = $(`#${opts.id}_origenSuc`).val() || opts.json.origenIdInicial;
            const stock    = stockOrigen(prod, origenId);
            if (stock <= 0) return;

            const existing = cart.find(i => i.id === id);
            if (existing) {
                if (existing.transform) return;
                if (existing.cant < existing.stock) existing.cant++;
            } else {
                cart.push({
                    id:    prod.id,
                    name:  prod.nombre,
                    sku:   prod.sku,
                    cat:   prod.categoria || '-',
                    icon:  prod.icon || 'package',
                    bg:    prod.bg    || 'bg-gray-700',
                    color: prod.color || 'text-gray-400',
                    price: Number(prod.costo || 0),
                    stock: stock,
                    cant:  1,
                    transform:     null,
                    transformOpen: false
                });
            }
            renderCart();
        };

        const removeFromCart = (id) => {
            const idx = cart.findIndex(i => i.id === id);
            if (idx > -1) cart.splice(idx, 1);
            renderCart();
        };

        const updateQty = (id, delta) => {
            const item = cart.find(i => i.id === id);
            if (!item || item.transform) return;
            const next = item.cant + delta;
            if (next < 1) return removeFromCart(id);
            if (next > item.stock) return;
            item.cant = next;
            renderCart();
        };

        const toggleTransformPanel = (id) => {
            const item = cart.find(i => i.id === id);
            if (!item || item.transform) return;
            const opts2 = transformMap[id] || [];
            if (!opts2.length) return;
            item.transformOpen = !item.transformOpen;
            renderCart();
        };

        const applyTransform = (id) => {
            const item = cart.find(i => i.id === id);
            if (!item) return;
            const $sel  = $(`[data-transform-select="${id}"]`);
            const $qty  = $(`[data-transform-qty="${id}"]`);
            if (!$sel.length || !$qty.length) return;
            const optId  = $sel.val();
            const list   = transformMap[id] || [];
            const opt    = list.find(o2 => o2.id === optId);
            const piezas = parseInt($qty.val(), 10) || 1;
            item.transform     = { id: optId, producto: opt ? opt.nombre : $sel.find('option:selected').text(), piezas };
            item.transformOpen = false;
            renderCart();
        };

        const cancelTransform = (id) => {
            const item = cart.find(i => i.id === id);
            if (!item) return;
            item.transformOpen = false;
            renderCart();
        };

        const revertTransform = (id) => {
            const item = cart.find(i => i.id === id);
            if (!item) return;
            item.transform = null;
            renderCart();
        };

        const updatePiezasDefault = (id) => {
            const $sel = $(`[data-transform-select="${id}"]`);
            const $qty = $(`[data-transform-qty="${id}"]`);
            if (!$sel.length || !$qty.length) return;
            const list = transformMap[id] || [];
            const opt  = list.find(o2 => o2.id === $sel.val());
            if (opt) $qty.val(opt.piezasDefault);
        };

        const clearCart = () => {
            cart.length = 0;
            renderCart();
        };

        const cartRowHtml = (item) => {
            const subtotal = item.cant * item.price;
            const isTr     = !!item.transform;
            const isOpen   = item.transformOpen;
            const trList   = transformMap[item.id] || [];
            const trBtnCls = isTr
                ? 'bg-[#06b6d4]/15 border border-[#06b6d4]/40 text-[#22d3ee] cursor-not-allowed'
                : isOpen
                    ? 'bg-[#1C64F2]/20 border border-[#1C64F2] text-[#76A9FA]'
                    : (!trList.length
                        ? 'bg-[#1a2332] border border-[#374151] text-[#9CA3AF]/30 cursor-not-allowed'
                        : 'bg-[#1a2332] border border-[#374151] text-[#9CA3AF] hover:bg-[#1C64F2]/15 hover:text-[#76A9FA] hover:border-[#1C64F2]');
            const minusCls = isTr
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:bg-[#1F2A37] hover:text-white';
            const plusCls  = isTr || item.cant >= item.stock
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:bg-[#1F2A37] hover:text-white';

            let rowHtml = `
                <tr class="border-b ${isTr ? 'border-[#06b6d4]/25 bg-[rgba(6,182,212,0.03)]' : 'border-[#374151]/60 hover:bg-[#1a2332]/40'} transition" data-cart-id="${esc(item.id)}">
                    <td>
                        <div class="flex items-center gap-2">
                            <div class="w-7 h-7 rounded-md bg-[#1a2332] border border-[#374151] flex items-center justify-center flex-shrink-0">
                                <i data-lucide="${esc(item.icon)}" class="w-3.5 h-3.5 ${esc(item.color)}"></i>
                            </div>
                            <div>
                                <p class="text-[10px] font-semibold text-white leading-tight">
                                    ${esc(item.name)}${isTr ? ` <span class="cs-badge cs-badge-info !text-[7px] !px-1.5">${esc(opts.labels.badgeTr)}</span>` : ''}
                                </p>
                                <p class="text-[8px] text-[#6B7280]">${esc(item.cat)} &middot; ${esc(opts.labels.stockLbl)} ${item.stock}</p>
                            </div>
                        </div>
                    </td>
                    <td>
                        <div class="flex items-center justify-center gap-0.5">
                            <button type="button" data-cart-id="${esc(item.id)}" data-role="minus" class="w-5 h-5 rounded bg-[#1a2332] border border-[#374151] text-[#9CA3AF] ${minusCls} transition flex items-center justify-center text-xs">&minus;</button>
                            <span class="w-8 text-center text-[10px] font-bold text-white">${item.cant}</span>
                            <button type="button" data-cart-id="${esc(item.id)}" data-role="plus" class="w-5 h-5 rounded bg-[#1a2332] border border-[#374151] text-[#9CA3AF] ${plusCls} transition flex items-center justify-center text-xs">+</button>
                        </div>
                    </td>
                    <td class="text-right">
                        <p class="text-[10px] text-[#9CA3AF]">${fmtMoney(item.price)}</p>
                    </td>
                    <td class="text-right">
                        <p class="text-[11px] font-bold text-[#3FC189]">${fmtMoney(subtotal)}</p>
                        <p class="text-[8px] text-[#6B7280]">${item.cant} x ${fmtMoney(item.price)}</p>
                    </td>
                    <td>
                        <div class="flex items-center justify-center gap-1">
                            <button type="button" data-cart-id="${esc(item.id)}" data-role="transform"
                                    class="w-6 h-6 rounded ${trBtnCls} transition flex items-center justify-center" title="${esc(opts.labels.transformar)}">
                                <i data-lucide="recycle" class="w-3 h-3"></i>
                            </button>
                            <button type="button" data-cart-id="${esc(item.id)}" data-role="remove"
                                    class="w-6 h-6 rounded bg-[#1a2332] border border-[#374151] text-[#9CA3AF] hover:bg-[rgba(234,2,52,0.15)] hover:text-[#EA0234] hover:border-[#EA0234] transition flex items-center justify-center" title="Quitar">
                                <i data-lucide="trash-2" class="w-3 h-3"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;

            if (isOpen && !isTr) {
                const selectOpts = trList.map(o2 =>
                    `<option value="${esc(o2.id)}">${esc(o2.nombre)}</option>`
                ).join('');
                const defaultPiezas = trList.length ? trList[0].piezasDefault : 8;
                rowHtml += `
                    <tr class="border-b border-[#1C64F2]/30 bg-[rgba(28,100,242,0.06)]">
                        <td colspan="5" class="!py-2.5 !px-4">
                            <div class="flex items-center gap-3 flex-wrap">
                                <div class="flex items-center gap-1.5 text-[#76A9FA]">
                                    <i data-lucide="recycle" class="w-3.5 h-3.5"></i>
                                    <span class="text-[10px] font-semibold uppercase tracking-wider">${esc(opts.labels.transformar)}</span>
                                </div>
                                <select data-transform-select="${esc(item.id)}" class="cs-select text-xs !w-52">
                                    ${selectOpts}
                                </select>
                                <div class="flex items-center gap-1">
                                    <span class="text-[9px] text-[#9CA3AF]">${esc(opts.labels.piezas)}</span>
                                    <input type="number" value="${defaultPiezas}" min="1" data-transform-qty="${esc(item.id)}" class="cs-input !w-14 !text-center !px-1 !text-[10px]">
                                </div>
                                <div class="flex items-center gap-1 ml-auto">
                                    <button type="button" data-cart-id="${esc(item.id)}" data-role="cancel-transform" class="cs-btn cs-btn-sm cs-btn-outline !py-1 !text-[9px]">${esc(opts.labels.cancelarTr)}</button>
                                    <button type="button" data-cart-id="${esc(item.id)}" data-role="apply-transform" class="cs-btn cs-btn-sm cs-btn-primary !py-1 !text-[9px]">
                                        <i data-lucide="check" class="w-2.5 h-2.5"></i>
                                        ${esc(opts.labels.aplicar)}
                                    </button>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            }

            if (isTr) {
                rowHtml += `
                    <tr class="border-b border-[#06b6d4]/25 bg-[rgba(6,182,212,0.05)]">
                        <td colspan="5" class="!py-2 !px-4">
                            <div class="flex items-center gap-2 flex-wrap">
                                <div class="w-6 h-6 rounded-full bg-[#06b6d4]/15 border border-[#06b6d4]/35 flex items-center justify-center flex-shrink-0">
                                    <i data-lucide="recycle" class="w-3 h-3 text-[#22d3ee]"></i>
                                </div>
                                <span class="text-[10px] text-[#67e8f9]">
                                    ${esc(opts.labels.transformOk)} <span class="font-bold">${item.transform.piezas} ${esc(opts.labels.piezas).replace(':','').toLowerCase()}</span> ${esc(opts.labels.transformOf)} <span class="font-bold">${esc(item.transform.producto)}</span>
                                </span>
                                <button type="button" data-cart-id="${esc(item.id)}" data-role="revert-transform" class="ml-auto text-[9px] px-2 py-1 bg-[#06b6d4]/12 text-[#67e8f9] border border-[#06b6d4]/35 rounded hover:bg-[#06b6d4]/20 transition flex items-center gap-1">
                                    <i data-lucide="undo" class="w-2.5 h-2.5"></i>
                                    ${esc(opts.labels.revertir)}
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }

            return rowHtml;
        };

        const highlightCartRows = () => {
            $(`#${opts.id}_productList [data-prod-id]`).each(function () {
                const id     = $(this).attr('data-prod-id');
                const inCart = cart.find(i => i.id === id);
                if (inCart) {
                    $(this).addClass('!border-[#3FC189]/40').removeClass('border-[#374151]');
                } else {
                    $(this).removeClass('!border-[#3FC189]/40').addClass('border-[#374151]');
                }
            });
        };

        const renderCart = () => {
            const $tbody = $(`#${opts.id}_cartBody`);
            if (!cart.length) {
                $tbody.html(`
                    <tr><td colspan="5" class="text-center !py-8">
                        <p class="text-[10px] text-[#6B7280] italic">${esc(opts.labels.cartEmpty)}</p>
                    </td></tr>
                `);
            } else {
                $tbody.html(cart.map(cartRowHtml).join(''));
            }

            const items = cart.length;
            const uds   = cart.reduce((s, i) => s + Number(i.cant || 0), 0);
            const costo = cart.reduce((s, i) => s + Number(i.cant || 0) * Number(i.price || 0), 0);

            $(`#${opts.id}_cartCount`).text(items);
            $(`#${opts.id}_footerItems`).text(items);
            $(`#${opts.id}_footerUds`).text(uds);
            $(`#${opts.id}_footerCosto`).text(fmtMoney(costo));

            highlightCartRows();
            if (window.lucide) lucide.createIcons();
        };

        // -- Cierre y guardado

        const close = () => {
            $(`#${opts.id}_root`).remove();
            opts.onClose();
        };

        const save = () => {
            const origenId    = $(`#${opts.id}_origenSuc`).val();
            const origenAlm   = $(`#${opts.id}_origenAlm`).val();
            const destinoId   = $(`#${opts.id}_destinoSuc`).val();
            const destinoAlm  = $(`#${opts.id}_destinoAlm`).val();
            const categoriaId = $(`#${opts.id}_categoria`).val();
            const nota        = ($(`#${opts.id}_nota`).val() || '').trim();

            const $err = $(`#${opts.id}_error`);
            $err.addClass('hidden').text('');

            if (!destinoId)              { $err.removeClass('hidden').text(opts.labels.errSinDest);  return; }
            if (origenId === destinoId)  { $err.removeClass('hidden').text(opts.labels.errSucIgual); return; }

            const productosPayload = cart.map(i => {
                const p = findProd(i.id);
                return {
                    productId:        i.id,
                    sku:              p ? p.sku : i.sku,
                    nombre:           i.name,
                    icon:             i.icon,
                    bg:               i.bg,
                    color:            i.color,
                    cant:             Number(i.cant),
                    costo:            Number(i.price),
                    stockOrigenPrev:  stockOrigen(p, origenId),
                    stockDestinoPrev: stockDestino(p, destinoId),
                    transform:        i.transform
                };
            });

            if (!productosPayload.length) { $err.removeClass('hidden').text(opts.labels.errSinProd); return; }

            const sucOrigen   = (opts.json.sucursales || []).find(s => s.id === origenId)    || { id: origenId,   valor: origenId   };
            const sucDestino  = (opts.json.sucursales || []).find(s => s.id === destinoId)   || { id: destinoId,  valor: destinoId  };
            const almOrigen   = (opts.json.almacenes  || []).find(a => a.id === origenAlm)   || { id: origenAlm,  valor: origenAlm  };
            const almDestino  = (opts.json.almacenes  || []).find(a => a.id === destinoAlm)  || { id: destinoAlm, valor: destinoAlm };
            const categoria   = (opts.json.categorias || []).find(c => c.id === categoriaId) || { id: categoriaId, valor: categoriaId };

            const payload = {
                origen:    { id: sucOrigen.id,  nombre: sucOrigen.valor,  almacen: { id: almOrigen.id,  nombre: almOrigen.valor  } },
                destino:   { id: sucDestino.id, nombre: sucDestino.valor, almacen: { id: almDestino.id, nombre: almDestino.valor } },
                categoria: { id: categoria.id,  nombre: categoria.valor },
                productos: productosPayload,
                nota:      nota
            };

            opts.onSave(payload);
            close();
        };

        // -- Render base

        const $existing = $(`#${opts.id}_root`);
        if ($existing.length) $existing.remove();

        const cats     = opts.json.categorias || [];
        const alms     = opts.json.almacenes  || [];
        const firstCat = cats[0] && cats[0].id;
        const firstAlm = alms[0] && alms[0].id;
        const sucsFiltradas = opts.json.sucursales || [];

        const html = `
            <div id="${opts.id}_root" class="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <div id="${opts.id}_backdrop" class="absolute inset-0 bg-black/70"></div>
                <div id="${opts.id}" class="bg-[#141d2b] rounded-2xl border border-[#374151] w-[1200px] max-w-full max-h-[92vh] flex flex-col relative overflow-hidden shadow-2xl">

                    <!-- Header -->
                    <div class="px-5 py-3 border-b border-[#374151] flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-[#141d2b] to-[#1a2438]">
                        <div class="flex items-center gap-2.5">
                            <div class="w-8 h-8 rounded-md bg-[rgba(124,58,237,0.18)] border border-[#7C3AED]/40 flex items-center justify-center">
                                <i data-lucide="arrow-left-right" class="w-4 h-4 text-[#c4b5fd]"></i>
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-white flex items-center gap-2">
                                    ${esc(opts.labels.title)}
                                    <span class="cs-badge cs-badge-primary !text-[8px] !px-1.5">${esc(opts.labels.badge)}</span>
                                </h3>
                                <p class="text-[10px] text-[#6B7280]">${esc(opts.labels.subtitle)}</p>
                            </div>
                        </div>
                        <button type="button" id="${opts.id}_close" class="text-[#6B7280] hover:text-white p-1 rounded hover:bg-[#1F2A37] transition">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>

                    <!-- Filtros: Origen / Destino / Categoria -->
                    <div class="px-5 py-3 grid grid-cols-3 gap-3 flex-shrink-0 bg-[#0f172a]/40 border-b border-[#374151]">

                        <div class="bg-[#1F2A37] border border-[#374151] rounded-lg p-3 relative">
                            <div class="absolute -top-2 left-3 bg-[#374151] text-[#9CA3AF] text-[8px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">${esc(opts.labels.origen)}</div>
                            <label class="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-2 mt-0.5">
                                <i data-lucide="arrow-up-from-line" class="w-3 h-3"></i>
                                ${esc(opts.labels.origenLbl)}
                            </label>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <p class="text-[8px] uppercase tracking-wider text-[#6B7280] mb-0.5">${esc(opts.labels.sucursal)}</p>
                                    ${selectBox(opts.id + '_origenSuc', sucsFiltradas, opts.json.origenIdInicial)}
                                </div>
                                <div>
                                    <p class="text-[8px] uppercase tracking-wider text-[#6B7280] mb-0.5">${esc(opts.labels.almacen)}</p>
                                    ${selectBox(opts.id + '_origenAlm', alms, firstAlm)}
                                </div>
                            </div>
                        </div>

                        <div class="bg-[#1F2A37] border border-[#374151] rounded-lg p-3 relative">
                            <div class="absolute -top-2 left-3 bg-[#374151] text-[#9CA3AF] text-[8px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">${esc(opts.labels.destino)}</div>
                            <label class="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-2 mt-0.5">
                                <i data-lucide="arrow-down-to-line" class="w-3 h-3"></i>
                                ${esc(opts.labels.destinoLbl)}
                            </label>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <p class="text-[8px] uppercase tracking-wider text-[#6B7280] mb-0.5">${esc(opts.labels.sucursal)}</p>
                                    ${selectBox(opts.id + '_destinoSuc', sucsFiltradas, '')}
                                </div>
                                <div>
                                    <p class="text-[8px] uppercase tracking-wider text-[#6B7280] mb-0.5">${esc(opts.labels.almacen)}</p>
                                    ${selectBox(opts.id + '_destinoAlm', alms, firstAlm)}
                                </div>
                            </div>
                        </div>

                        <div class="bg-[#1F2A37] border border-[#374151] rounded-lg p-3 relative">
                            <div class="absolute -top-2 left-3 bg-[#374151] text-[#9CA3AF] text-[8px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">${esc(opts.labels.categoria)}</div>
                            <label class="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-2 mt-0.5">
                                <i data-lucide="tag" class="w-3 h-3"></i>
                                ${esc(opts.labels.categoriaLbl)}
                            </label>
                            <div>
                                <p class="text-[8px] uppercase tracking-wider text-[#6B7280] mb-0.5">${esc(opts.labels.tipo)}</p>
                                ${selectBox(opts.id + '_categoria', cats, firstCat)}
                            </div>
                        </div>
                    </div>

                    <!-- Cuerpo (2 columnas) -->
                    <div class="flex-1 px-5 pb-3 pt-3 grid grid-cols-[320px_1fr] gap-3 overflow-hidden min-h-0">

                        <!-- Columna izquierda: buscador + lista -->
                        <div class="bg-[#1F2A37] border border-[#374151] rounded-lg flex flex-col overflow-hidden min-h-0">
                            <div class="px-3 py-2.5 border-b border-[#374151] flex-shrink-0 bg-[#141d2b]/60">
                                <p class="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#c4b5fd] mb-2">
                                    <i data-lucide="search" class="w-3 h-3"></i>
                                    ${esc(opts.labels.buscar)}
                                </p>
                                <div class="relative mb-2">
                                    <span class="cs-input-group-icon"><i data-lucide="search" class="w-4 h-4"></i></span>
                                    <input id="${opts.id}_search" type="text" placeholder="${esc(opts.labels.buscarPh)}" class="cs-input pl-10 text-xs w-full">
                                </div>
                            </div>
                            <div id="${opts.id}_productList" class="flex-1 overflow-y-auto cs-scroll p-2 space-y-1.5 min-h-0"></div>
                        </div>

                        <!-- Columna derecha: carrito -->
                        <div class="bg-[#1F2A37] border border-[#374151] rounded-lg flex flex-col overflow-hidden min-h-0">

                            <div class="px-3 py-2.5 border-b border-[#374151] flex-shrink-0 bg-[#141d2b]/60 flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                    <p class="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#c4b5fd]">
                                        <i data-lucide="shopping-cart" class="w-3 h-3"></i>
                                        ${esc(opts.labels.cart)}
                                    </p>
                                    <span id="${opts.id}_cartCount" class="cs-badge cs-badge-primary !text-[8px] !px-1.5 !py-0.5">0</span>
                                </div>
                                <button type="button" id="${opts.id}_clearCart" class="cs-btn cs-btn-sm cs-btn-outline !py-1 !text-[9px] hover:!bg-[rgba(234,2,52,0.15)] hover:!border-[#EA0234] hover:!text-[#EA0234] transition">
                                    <i data-lucide="trash-2" class="w-2.5 h-2.5"></i>
                                    ${esc(opts.labels.limpiar)}
                                </button>
                            </div>

                            <div class="flex-1 overflow-y-auto cs-scroll min-h-0">
                                <table class="cs-table w-full">
                                    <thead class="sticky top-0 bg-[#141d2b] z-10">
                                        <tr class="border-b border-[#374151]">
                                            <th class="text-left text-[#9CA3AF]">${esc(opts.labels.producto)}</th>
                                            <th class="text-center text-[#9CA3AF]">${esc(opts.labels.cant)}</th>
                                            <th class="text-right text-[#9CA3AF]">${esc(opts.labels.costo)}</th>
                                            <th class="text-right text-[#9CA3AF]">${esc(opts.labels.subtotal)}</th>
                                            <th class="text-center text-[#9CA3AF]">${esc(opts.labels.acciones)}</th>
                                        </tr>
                                    </thead>
                                    <tbody id="${opts.id}_cartBody"></tbody>
                                </table>
                            </div>

                            <div class="px-3 py-2 border-t border-[#374151] flex-shrink-0 bg-[#0f172a]/40">
                                <div class="grid grid-cols-3 gap-2">
                                    <div class="text-center">
                                        <p class="text-[8px] text-[#6B7280] uppercase tracking-wider leading-none mb-0.5">${esc(opts.labels.items)}</p>
                                        <p id="${opts.id}_footerItems" class="text-xs font-bold text-white">0</p>
                                    </div>
                                    <div class="text-center border-x border-[#374151]">
                                        <p class="text-[8px] text-[#6B7280] uppercase tracking-wider leading-none mb-0.5">${esc(opts.labels.unidades)}</p>
                                        <p id="${opts.id}_footerUds" class="text-xs font-bold text-white">0</p>
                                    </div>
                                    <div class="text-center">
                                        <p class="text-[8px] text-[#6B7280] uppercase tracking-wider leading-none mb-0.5">${esc(opts.labels.costoTot)}</p>
                                        <p id="${opts.id}_footerCosto" class="text-xs font-bold text-[#3FC189]">${fmtMoney(0)}</p>
                                    </div>
                                </div>
                            </div>

                            <div class="px-3 py-2.5 border-t border-[#374151] flex-shrink-0 bg-[#0f172a]/40">
                                <label class="text-[9px] font-semibold uppercase tracking-wider text-[#6B7280] mb-1 block">${esc(opts.labels.nota)}</label>
                                <textarea id="${opts.id}_nota" class="cs-textarea text-xs w-full" rows="1" placeholder="${esc(opts.labels.notaPh)}"></textarea>
                            </div>
                        </div>
                    </div>

                    <!-- Pie -->
                    <div class="px-5 py-3 border-t border-[#374151] bg-[#0f172a] flex items-center justify-between flex-shrink-0">
                        <p id="${opts.id}_error" class="hidden text-[11px] text-red-400"></p>
                        <div class="flex items-center gap-2 ml-auto">
                            <button type="button" id="${opts.id}_cancel" class="cs-btn cs-btn-outline cs-btn-sm">${esc(opts.labels.cancelar)}</button>
                            <button type="button" id="${opts.id}_save" class="cs-btn cs-btn-primary cs-btn-sm" style="background:linear-gradient(135deg,#7C3AED,#a855f7);border-color:#7C3AED;">
                                <i data-lucide="send" class="w-3 h-3"></i>
                                ${esc(opts.labels.crear)}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        $(opts.parent === 'body' ? 'body' : `#${opts.parent}`).append(html);
        if (window.lucide) lucide.createIcons();

        // -- Eventos
        $(`#${opts.id}_close`).on('click',    close);
        $(`#${opts.id}_cancel`).on('click',   close);
        $(`#${opts.id}_backdrop`).on('click', close);
        $(`#${opts.id}_save`).on('click',     save);
        $(`#${opts.id}_clearCart`).on('click', clearCart);

        $(`#${opts.id}_origenSuc, #${opts.id}_destinoSuc`).on('change', () => {
            renderProductList();
            renderCart();
        });

        $(`#${opts.id}_categoria`).on('change', renderProductList);
        $(`#${opts.id}_search`).on('input', renderProductList);

        $(`#${opts.id}_productList`).on('click', '[data-prod-id]', function () {
            addToCart($(this).attr('data-prod-id'));
        });

        const $cartBody = $(`#${opts.id}_cartBody`);
        $cartBody.on('click', '[data-role="minus"]',             function () { updateQty($(this).attr('data-cart-id'), -1); });
        $cartBody.on('click', '[data-role="plus"]',              function () { updateQty($(this).attr('data-cart-id'),  1); });
        $cartBody.on('click', '[data-role="remove"]',            function () { removeFromCart($(this).attr('data-cart-id')); });
        $cartBody.on('click', '[data-role="transform"]',         function () { toggleTransformPanel($(this).attr('data-cart-id')); });
        $cartBody.on('click', '[data-role="apply-transform"]',   function () { applyTransform($(this).attr('data-cart-id')); });
        $cartBody.on('click', '[data-role="cancel-transform"]',  function () { cancelTransform($(this).attr('data-cart-id')); });
        $cartBody.on('click', '[data-role="revert-transform"]',  function () { revertTransform($(this).attr('data-cart-id')); });
        $cartBody.on('change', '[data-transform-select]',        function () { updatePiezasDefault($(this).attr('data-transform-select')); });

        renderProductList();
        renderCart();
    }
}
