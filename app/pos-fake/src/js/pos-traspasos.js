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
        traspasosView.renderTabs(this.PROJECT_NAME);
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
                {
                    id:    'tabsRow',
                    class: 'px-4 bg-[#141d2b] border-b border-[#374151] flex-shrink-0'
                },
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
            {
                opc:      'select',
                id:       'subsidiaries_id',
                lbl:      'Sucursal actual:',
                class:    'col-12 col-md-3 col-lg-3',
                onchange: 'app.onChangeSucursal()',
                data:     []
            },
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
            center:       [3, 6, 7, 11],
            right:        [8],
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

    confirmTraspaso(folio) {
        console.log('[confirmTraspaso]', folio);
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
            json:   { title: '', subtitle: '' },
            classes: {
                title:    'text-base font-bold text-white',
                subtitle: 'text-[10px] text-[var(--cs-text-secondary,#D1D5DB)]'
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        wrap.html(`
            <div>
                <h1 class="${opts.classes.title}">${esc(opts.json.title)}</h1>
                ${opts.json.subtitle ? `<p class="${opts.classes.subtitle}">${esc(opts.json.subtitle)}</p>` : ''}
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
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
                    <button class="cs-btn cs-btn-outline flex-1 cs-btn-sm" disabled>${esc(opts.labels.rechazar)}</button>
                    <button class="cs-btn cs-btn-success flex-1 cs-btn-sm" disabled>${esc(opts.labels.confirmar)}</button>
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
                <button id="${opts.id}_reject" class="cs-btn cs-btn-outline flex-1 cs-btn-sm" ${showReject ? '' : 'disabled'}>${esc(opts.labels.rechazar)}</button>
                <button id="${opts.id}_confirm" class="cs-btn cs-btn-success flex-1 cs-btn-sm" ${showConfirm ? '' : 'disabled'}>${esc(opts.labels.confirmar)}</button>
            </div>
        `);

        $(`#${opts.parent}`).html(aside);
        if (window.lucide) lucide.createIcons();

        $(`#${opts.id}_close`).on('click',   () => opts.onClose(t));
        $(`#${opts.id}_reject`).on('click',  () => opts.onReject(t));
        $(`#${opts.id}_confirm`).on('click', () => opts.onConfirm(t));
    }
}
