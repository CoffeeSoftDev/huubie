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
        this.traspasoFormModal({
            parent: 'body',
            json: {
                sucursales:      sucursales,
                productos:       SAMPLE_PRODUCTOS_DISPONIBLES,
                origenIdInicial: app.subId || (sucursales[0] && sucursales[0].id) || ''
            },
            onClose: () => console.log('[traspasoFormModal] close'),
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

    traspasoFormModal(options) {
        const defaults = {
            parent:   'body',
            id:       'traspasoFormModal',
            json:     { sucursales: [], productos: [], origenIdInicial: '' },
            data:     null,
            labels: {
                title:       'Nuevo Traspaso',
                subtitle:    'Mover producto entre sucursales',
                origen:      'Sucursal Origen',
                destino:     'Sucursal Destino',
                selDestino:  'Seleccionar destino...',
                productos:   'Productos a traspasar',
                addItem:     'Agregar producto',
                items:       'Items',
                totUds:      'Total unidades',
                costoTot:    'Costo total',
                nota:        'Nota / Motivo',
                notaPh:      'Ej: Reabastecimiento urgente por demanda...',
                cant:        'Cant',
                subtotal:    'Subtotal',
                stockArrow:  'Stock→',
                callout:     'Flujo de 2 pasos',
                calloutMsg:  'Al crear el traspaso, el stock se descuenta del origen y queda "En Transito" hasta que la sucursal destino confirme la recepcion.',
                cancelar:    'Cancelar',
                crear:       'Crear y Enviar Traspaso',
                errSucIgual: 'Origen y destino no pueden ser la misma sucursal',
                errSinDest:  'Selecciona una sucursal destino',
                errSinProd:  'Agrega al menos un producto'
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

        // -- Estado local
        let lineas = [];   // { uid, productId, cant }
        let nextUid = 1;

        // -- Helpers
        const findProd = (id) => (opts.json.productos || []).find(p => p.id === id);

        const stockOrigen = (prod, origenId) => {
            if (!prod || !origenId) return 0;
            return (prod.stockPorSuc && prod.stockPorSuc[origenId]) || 0;
        };
        const stockDestino = (prod, destinoId) => {
            if (!prod || !destinoId) return 0;
            return (prod.stockPorSuc && prod.stockPorSuc[destinoId]) || 0;
        };

        const sucursalSelectHtml = (id, selected, includePlaceholder, placeholder) => {
            const opciones = (opts.json.sucursales || []).map(s =>
                `<option value="${esc(s.id)}" ${s.id === selected ? 'selected' : ''}>${esc(s.valor)}</option>`
            ).join('');
            return `<select id="${id}" class="cs-select text-xs w-full bg-[#1F2937] border border-[#374151] rounded-md px-2 py-1.5 text-white">
                ${includePlaceholder ? `<option value="">${esc(placeholder)}</option>` : ''}
                ${opciones}
            </select>`;
        };

        const productoSelectHtml = (uid, productId) => {
            const opciones = (opts.json.productos || []).map(p =>
                `<option value="${esc(p.id)}" ${p.id === productId ? 'selected' : ''}>${esc(p.nombre)} (${esc(p.sku)})</option>`
            ).join('');
            return `<select data-line-uid="${uid}" data-role="product" class="cs-select text-xs w-full bg-[#1F2937] border border-[#374151] rounded-md px-2 py-1.5 text-white">
                <option value="">Selecciona producto...</option>
                ${opciones}
            </select>`;
        };

        const lineaHtml = (linea) => {
            const prod        = findProd(linea.productId);
            const origenId    = $(`#${opts.id}_origen`).val() || opts.json.origenIdInicial;
            const destinoId   = $(`#${opts.id}_destino`).val() || '';
            const stockO      = stockOrigen(prod, origenId);
            const stockD      = stockDestino(prod, destinoId);
            const stockOPost  = Math.max(stockO - Number(linea.cant || 0), 0);
            const stockDPost  = stockD + Number(linea.cant || 0);
            const subtotal    = prod ? Number(prod.costo || 0) * Number(linea.cant || 0) : 0;

            return `
                <div class="bg-[#1a2332] rounded-lg p-2 border border-[#374151]" data-line-uid="${linea.uid}">
                    <div class="grid grid-cols-12 gap-2 items-center">
                        <div class="col-span-5">${productoSelectHtml(linea.uid, linea.productId)}</div>
                        <div class="col-span-2">
                            <input type="number" min="1" data-line-uid="${linea.uid}" data-role="cant" value="${esc(linea.cant)}" placeholder="Cant" class="cs-input text-xs text-center w-full bg-[#1F2937] border border-[#374151] rounded-md px-2 py-1.5 text-white">
                        </div>
                        <div class="col-span-2 text-right">
                            <p class="text-[9px] text-[#6B7280]">${esc(opts.labels.subtotal)}</p>
                            <p class="text-xs font-bold text-white">${fmtMoney(subtotal)}</p>
                        </div>
                        <div class="col-span-2 text-right">
                            <p class="text-[9px] text-[#6B7280]">${esc(opts.labels.stockArrow)}</p>
                            <p class="text-[10px] font-bold"><span class="text-orange-400">${stockOPost}</span> / <span class="text-green-400">${stockDPost}</span></p>
                        </div>
                        <div class="col-span-1 text-center">
                            <button type="button" data-line-uid="${linea.uid}" data-role="remove" class="text-[#6B7280] hover:text-red-400">
                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        };

        const renderLineas = () => {
            const html = lineas.length
                ? lineas.map(lineaHtml).join('')
                : `<div class="text-[10px] text-gray-500 italic text-center py-3 border border-dashed border-[#374151] rounded-lg">Sin productos. Click en "${esc(opts.labels.addItem)}".</div>`;
            $(`#${opts.id}_lineas`).html(html);
            renderResumen();
            if (window.lucide) lucide.createIcons();
        };

        const renderResumen = () => {
            const items = lineas.length;
            const uds   = lineas.reduce((s, l) => s + Number(l.cant || 0), 0);
            const costo = lineas.reduce((s, l) => {
                const p = findProd(l.productId);
                return s + (p ? Number(p.costo || 0) * Number(l.cant || 0) : 0);
            }, 0);
            $(`#${opts.id}_resumen_items`).text(items);
            $(`#${opts.id}_resumen_uds`).text(uds);
            $(`#${opts.id}_resumen_costo`).text(fmtMoney(costo));
        };

        const addLinea = () => {
            lineas.push({ uid: 'l' + (nextUid++), productId: '', cant: 1 });
            renderLineas();
        };

        const removeLinea = (uid) => {
            lineas = lineas.filter(l => l.uid !== uid);
            renderLineas();
        };

        const close = () => {
            $(`#${opts.id}_root`).remove();
            opts.onClose();
        };

        const save = () => {
            const origenId  = $(`#${opts.id}_origen`).val();
            const destinoId = $(`#${opts.id}_destino`).val();
            const nota      = $(`#${opts.id}_nota`).val().trim();

            const $err = $(`#${opts.id}_error`);
            $err.addClass('hidden').text('');

            if (!destinoId)                 { $err.removeClass('hidden').text(opts.labels.errSinDest);  return; }
            if (origenId === destinoId)     { $err.removeClass('hidden').text(opts.labels.errSucIgual); return; }
            const productosPayload = lineas
                .filter(l => l.productId && Number(l.cant) > 0)
                .map(l => {
                    const p = findProd(l.productId);
                    return {
                        productId:        l.productId,
                        sku:              p.sku,
                        nombre:           p.nombre,
                        cant:             Number(l.cant),
                        costo:            Number(p.costo),
                        stockOrigenPrev:  stockOrigen(p, origenId),
                        stockDestinoPrev: stockDestino(p, destinoId)
                    };
                });

            if (!productosPayload.length) { $err.removeClass('hidden').text(opts.labels.errSinProd); return; }

            const sucOrigen  = (opts.json.sucursales || []).find(s => s.id === origenId)  || { id: origenId,  valor: origenId  };
            const sucDestino = (opts.json.sucursales || []).find(s => s.id === destinoId) || { id: destinoId, valor: destinoId };

            const payload = {
                origen:    { id: sucOrigen.id,  nombre: sucOrigen.valor  },
                destino:   { id: sucDestino.id, nombre: sucDestino.valor },
                productos: productosPayload,
                nota:      nota
            };

            opts.onSave(payload);
            close();
        };

        // -- Render base
        const $existing = $(`#${opts.id}_root`);
        if ($existing.length) $existing.remove();

        const html = `
            <div id="${opts.id}_root" class="fixed inset-0 z-[100]">
                <div id="${opts.id}_backdrop" class="absolute inset-0 bg-black/70"></div>
                <div class="relative w-full h-full flex items-center justify-center p-4">
                    <div id="${opts.id}" class="bg-[#1F2A37] rounded-xl p-3 border border-[#374151] w-[640px] max-w-full max-h-[90vh] overflow-y-auto cs-scroll relative">

                        <button type="button" id="${opts.id}_close" class="absolute top-2 right-2 text-[#6B7280] hover:text-white">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>

                        <div class="mb-2 pb-2 border-b border-[#374151]">
                            <h3 class="text-sm font-bold text-[#c4b5fd]">${esc(opts.labels.title)}</h3>
                            <p class="text-[10px] text-[#6B7280]">${esc(opts.labels.subtitle)}</p>
                        </div>

                        <div class="grid grid-cols-2 gap-2 mb-2">
                            <div>
                                <label class="block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] mb-1">${esc(opts.labels.origen)}</label>
                                ${sucursalSelectHtml(opts.id + '_origen', opts.json.origenIdInicial, false, '')}
                            </div>
                            <div>
                                <label class="block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] mb-1">${esc(opts.labels.destino)}</label>
                                ${sucursalSelectHtml(opts.id + '_destino', '', true, opts.labels.selDestino)}
                            </div>
                        </div>

                        <div class="mb-2">
                            <label class="block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] mb-1">${esc(opts.labels.productos)}</label>
                            <div id="${opts.id}_lineas" class="space-y-1"></div>
                            <div class="mt-1.5">
                                <button type="button" id="${opts.id}_addItem" class="w-full text-[10px] text-[#c4b5fd] hover:text-white hover:bg-[rgba(124,58,237,0.08)] border border-dashed border-[#374151] hover:border-[rgba(124,58,237,0.4)] rounded-md py-1.5 flex items-center justify-center gap-1 transition-colors">
                                    <i data-lucide="plus-circle" class="w-3 h-3"></i>
                                    ${esc(opts.labels.addItem)}
                                </button>
                            </div>
                        </div>

                        <div class="bg-[rgba(124,58,237,0.08)] border border-[rgba(124,58,237,0.25)] rounded-md p-2 mb-2">
                            <div class="grid grid-cols-3 gap-2">
                                <div>
                                    <p class="text-[9px] text-[#6B7280] uppercase leading-none">${esc(opts.labels.items)}</p>
                                    <p class="text-xs font-bold text-white leading-tight" id="${opts.id}_resumen_items">0</p>
                                </div>
                                <div>
                                    <p class="text-[9px] text-[#6B7280] uppercase leading-none">${esc(opts.labels.totUds)}</p>
                                    <p class="text-xs font-bold text-white leading-tight" id="${opts.id}_resumen_uds">0</p>
                                </div>
                                <div>
                                    <p class="text-[9px] text-[#6B7280] uppercase leading-none">${esc(opts.labels.costoTot)}</p>
                                    <p class="text-xs font-bold text-[#c4b5fd] leading-tight" id="${opts.id}_resumen_costo">${fmtMoney(0)}</p>
                                </div>
                            </div>
                        </div>

                        <div class="mb-2">
                            <label class="block text-[10px] font-semibold uppercase tracking-wider text-[#6B7280] mb-1">${esc(opts.labels.nota)}</label>
                            <textarea id="${opts.id}_nota" rows="2" placeholder="${esc(opts.labels.notaPh)}" class="cs-textarea text-xs w-full bg-[#1F2937] border border-[#374151] rounded-md px-2 py-1 text-white"></textarea>
                        </div>

                        <div class="cs-callout cs-callout-info mb-2 bg-[rgba(28,100,242,0.08)] border border-[rgba(28,100,242,0.25)] rounded-md p-2">
                            <strong class="block text-xs mb-0.5 text-white">${esc(opts.labels.callout)}</strong>
                            <p class="text-[11px] text-gray-400 leading-tight">${esc(opts.labels.calloutMsg)}</p>
                        </div>

                        <p id="${opts.id}_error" class="hidden text-[11px] text-red-400 mb-2"></p>

                        <div class="flex justify-end gap-2 pt-2 border-t border-[#374151]">
                            <button type="button" id="${opts.id}_cancel" class="text-xs font-medium px-3 py-1.5 rounded-md border border-[#374151] text-[#D1D5DB] hover:bg-[#1F2937] hover:text-white transition-colors">
                                ${esc(opts.labels.cancelar)}
                            </button>
                            <button type="button" id="${opts.id}_save" class="text-xs font-semibold px-3 py-1.5 rounded-md bg-[#7C3AED] hover:bg-[#6D28D9] text-white inline-flex items-center gap-1.5 transition-colors">
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
        $(`#${opts.id}_addItem`).on('click',  addLinea);
        $(`#${opts.id}_save`).on('click',     save);

        $(`#${opts.id}_origen, #${opts.id}_destino`).on('change', renderLineas);

        $(`#${opts.id}_lineas`).on('change', '[data-role="product"]', function () {
            const uid = $(this).attr('data-line-uid');
            const ln  = lineas.find(l => l.uid === uid);
            if (ln) ln.productId = $(this).val();
            renderLineas();
        });

        $(`#${opts.id}_lineas`).on('input', '[data-role="cant"]', function () {
            const uid = $(this).attr('data-line-uid');
            const ln  = lineas.find(l => l.uid === uid);
            if (ln) ln.cant = Number($(this).val()) || 0;
            renderResumen();
            const $row = $(`#${opts.id}_lineas`).find(`[data-line-uid="${uid}"]`).first();
            const prod = findProd(ln && ln.productId);
            if (prod) {
                const origenId    = $(`#${opts.id}_origen`).val();
                const destinoId   = $(`#${opts.id}_destino`).val();
                const stockOPost  = Math.max(stockOrigen(prod, origenId) - Number(ln.cant || 0), 0);
                const stockDPost  = stockDestino(prod, destinoId) + Number(ln.cant || 0);
                const subtotal    = Number(prod.costo || 0) * Number(ln.cant || 0);
                $row.find('.col-span-2.text-right').eq(0).find('p.font-bold').text(fmtMoney(subtotal));
                $row.find('.col-span-2.text-right').eq(1).find('span.text-orange-400').text(stockOPost);
                $row.find('.col-span-2.text-right').eq(1).find('span.text-green-400').text(stockDPost);
            }
        });

        $(`#${opts.id}_lineas`).on('click', '[data-role="remove"]', function () {
            removeLinea($(this).attr('data-line-uid'));
        });

        // -- Linea inicial
        addLinea();
    }
}
