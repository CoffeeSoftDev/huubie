let api = 'ctrl/ctrl-pos-traspasos.php';
let app, traspasos, traspasosView;

let turno, subsidiaries_id;

window.updateSession = () => { };

// Config estatica de la vista (titulo, subtitulo, back). No son datos de negocio.
const VIEW_HEADER_TRASPASOS = {
    title:    'Visor de Traspasos',
    subtitle: 'Gestion de movimientos entre sucursales',
    back:     { href: '/app/inventarios/index.php', title: 'Regresar al inicio' }
};


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
        const r = await fn_ajax({ opc: 'init' }, api).catch(() => null);
        const ok = r && r.status === 200;

        this.dataInit = {
            subsidiaries_id: ok ? (r.subsidiaries_id  || '') : '',
            sucursales:      ok ? (r.sucursales       || []) : [],
            estados:         ok ? (r.estados_traspaso || []) : [],
            almacenes:       ok ? (r.almacenes        || []) : []
        };

        this.subId      = this.dataInit.subsidiaries_id;
        subsidiaries_id = this.subId;

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        traspasosView.renderHeader(VIEW_HEADER_TRASPASOS);
        traspasosView.renderFooter({});
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
                class:     'h-[calc(100vh-4rem)] flex flex-col md:flex-row overflow-hidden overflow-y-auto md:overflow-hidden',
                container: [mainPanel, detailPanel]
            }
        });
    }

    // -- Filter bar --

    filterBar() {

        const estados    = this.dataInit.estados    || [];
        const sucursales = this.dataInit.sucursales || [];

        let filters = [
            {
                opc:      'select',
                id:       'fEstado',
                lbl:      'Estado:',
                class:    'col-12 col-md-2 col-lg-3',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     estados
            },
            {
                opc:      'select',
                id:       'fOrigen',
                lbl:      'Origen:',
                class:    'col-12 col-md-2 col-lg-3',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     sucursales
            },
            {
                opc:      'select',
                id:       'fDestino',
                lbl:      'Destino:',
                class:    'col-12 col-md-2 col-lg-3',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     sucursales
            },
           
            {
                opc:       'button',
                id:        'btnNuevoTraspaso',
                text:      'Nuevo Traspaso',
                
                class:     'col-12 col-md-3 col-lg-3',
                onClick:   () => traspasosView.openTraspasoForm()
            }
        ];

        this.createfilterBar({
            parent: 'filterBar',
            coffeesoft:true,
            theme:'dark',
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
        return $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
            return $(this).text().includes(folio);
        }).length > 0;
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }

    // -- Facade --

    // folio: resalta la fila (la tabla la identifica por su texto).
    // id:    pk numerica para el fetch del detalle (getTraspaso espera el id, no el folio).
    selectTraspaso(folio, id) {
        this.selectedId = folio;
        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');
        if (folio) {
            const $row = $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
                return $(this).text().includes(folio);
            });
            $row.addClass('row-active');
        }
        if (id) {
            traspasos.getTraspaso(id);
        } else {
            traspasosView.renderDetail(null);
        }
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

    async lsTraspasos() {
        const f = app.getFilters();
        const r = await fn_ajax(Object.assign({ opc: 'lsTraspasos' }, {
            status_id:                   f.estado,
            origin_subsidiaries_id:      f.origen,
            destination_subsidiaries_id: f.destino,
            q:                           f.q
        }), api).catch(() => null);

        const data = (r && r.status === 200) ? { row: r.row } : { row: [] };

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

        const total = (data.row || []).length;
        app.updateFooterInfo(`Mostrando ${total} traspaso${total !== 1 ? 's' : ''}`);
    }

    async lsKpis() {
        const r = await fn_ajax({ opc: 'showTraspasos' }, api).catch(() => null);
        const c = (r && r.status === 200) ? r.counts : {};

        const kpis = [
            { id: 'kpiTotal',      label: 'Total Mes',    value: parseInt(c.total       || 0, 10), tone: 'default' },
            { id: 'kpiPendientes', label: 'Pendientes',   value: parseInt(c.pendientes  || 0, 10), tone: 'warning' },
            { id: 'kpiTransito',   label: 'En Transito',  value: parseInt(c.en_transito || 0, 10), tone: 'warning' },
            { id: 'kpiRecibidos',  label: 'Recibidos',    value: parseInt(c.recibidos   || 0, 10), tone: 'success' },
            { id: 'kpiRechazados', label: 'Rechazados',   value: parseInt(c.rechazados  || 0, 10), tone: 'danger'  }
        ];
        traspasosView.renderInfoCards(kpis);
    }

    async getTraspaso(id) {
        const r = await fn_ajax({ opc: 'getTraspaso', id: id }, api).catch(() => null);
        if (r && r.status === 200) {
            traspasosView.renderDetail(this.mapTraspasoDetail(r.header || {}, r.detail || [], r.history || []));
        } else {
            traspasosView.renderDetail(null);
        }
    }

    // Normaliza la respuesta del backend (columnas DB) al shape que espera traspasoDetailPanel.
    // Analogo a mapMermaDetail: el panel se diseno contra sample_traspasos.js (estado, origen,
    // destino, productos, timeline); sin esta traduccion t.estado llega undefined y deja los
    // botones Confirmar/Rechazar siempre deshabilitados.
    mapTraspasoDetail(h, detail, history) {
        const toIso = (s) => s ? String(s).replace(' ', 'T') : '';

        return {
            id:         h.id,
            folio:      h.folio,
            estado:     h.status_name || '',
            fechaIso:   toIso(h.date_request),
            fechaEnvio: toIso(h.date_sent),
            solicito:   h.requested_user_name  || '',
            autoriza:   h.authorized_user_name || '',
            nota:       h.note || '',
            origen: {
                id:     h.origin_subsidiaries_id != null ? String(h.origin_subsidiaries_id) : '',
                nombre: h.origin_subsidiary_name || '-'
            },
            destino: {
                id:     h.destination_subsidiaries_id != null ? String(h.destination_subsidiaries_id) : '',
                nombre: h.destination_subsidiary_name || '-'
            },
            productos: (detail || []).map(d => ({
                nombre:           d.product_name || '',
                sku:              d.sku || '',
                cant:             Number(d.quantity || 0),
                costo:            Number(d.cost || 0),
                icon:             'package',
                bg:               'bg-gray-700/40',
                color:            'text-gray-300',
                stockOrigenPrev:  Number(d.origin_stock_prev      || 0),
                stockDestinoPrev: Number(d.destination_stock_prev || 0)
            })),
            timeline: (history || []).map(x => ({
                estado:   x.status_name || '',
                usuario:  x.user_name   || '',
                fechaIso: toIso(x.transitioned_at)
            }))
        };
    }

    // -- Actions --

    viewTraspaso(folio) {
        console.log('[viewTraspaso]', folio);
        app.selectTraspaso(folio);
    }

    async nuevoTraspaso(payload) {
        const r = await fn_ajax({
            opc:     'saveTraspaso',
            payload: JSON.stringify(payload)
        }, api).catch(() => null);

        if (r && r.status === 200) {
            if (typeof alert === 'function') alert({ icon: 'success', text: 'Traspaso ' + r.folio + ' solicitado' });
            this.lsTraspasos();
            this.lsKpis();
        } else {
            if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo crear el traspaso' });
        }
    }

    async confirmTraspaso(id) {
        const r = await fn_ajax({ opc: 'confirmTraspaso', id: id }, api).catch(() => null);
        if (r && r.status === 200) {
            if (typeof alert === 'function') alert({ icon: 'success', text: 'Traspaso recibido' });
            this.lsTraspasos();
            this.lsKpis();
            traspasosView.renderDetail(null);
        } else {
            if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo confirmar' });
        }
    }

    async rejectTraspaso(id) {
        const r = await fn_ajax({ opc: 'rejectTraspaso', id: id }, api).catch(() => null);
        if (r && r.status === 200) {
            if (typeof alert === 'function') alert({ icon: 'success', text: 'Traspaso rechazado' });
            this.lsTraspasos();
            this.lsKpis();
            traspasosView.renderDetail(null);
        }
    }
}


class TraspasosView extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSTraspasos';
    }

    // -- Modal launchers --

    async openTraspasoForm() {
        const sucursales = (app.dataInit.sucursales || []).filter(s => s.id !== '');
        const r = await fn_ajax({ opc: 'getCatalogosTraspaso' }, api).catch(() => null);
        const ok = r && r.status === 200;

        this.traspasoModal({
            parent: 'body',
            json: {
                sucursales:      sucursales,
                almacenes:       ok ? (r.almacenes    || []) : [],
                categorias:      ok ? (r.categorias   || []) : [],
                productos:       ok ? (r.productos    || []) : [],
                transformMap:    ok ? (r.transformMap || {}) : {},
                origenIdInicial: app.subId || (sucursales[0] && sucursales[0].id) || ''
            },
            onClose: () => console.log('[traspasoModal] close'),
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
            onConfirm: (t) => traspasos.confirmTraspaso(t && t.id),
            onReject:  (t) => traspasos.rejectTraspaso(t && t.id)
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
                'Solicitado':   { bg: 'rgba(251,191,36,0.15)',  fg: '#FBBF24' },
                'Pendiente':    { bg: 'rgba(251,191,36,0.15)',  fg: '#FBBF24' },
                'Autorizado':   { bg: 'rgba(167,139,250,0.15)', fg: '#A78BFA' },
                'En Transito':  { bg: 'rgba(251,146,60,0.15)',  fg: '#FB923C' },
                'Recibido':     { bg: 'rgba(63,193,137,0.15)',  fg: '#3FC189' },
                'Rechazado':    { bg: 'rgba(244,63,94,0.15)',   fg: '#F43F5E' }
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

        // Recepcion solo de lo que ya viaja: confirmar antes de "enviar" descuadraria el stock.
        const showConfirm = t.estado === 'En Transito';
        // Rechazo permitido en cualquier estado no terminal (Solicitado/Autorizado/En Transito).
        const showReject  = t.estado === 'Solicitado' || t.estado === 'Autorizado' || t.estado === 'En Transito';

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

    traspasoModal(options) {
        const defaults = {
            parent:   'body',
            id:       'traspasoModal',
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

        // -- Clases Tailwind reutilizables (diseno premium dark Huubie)
        const cls = {
            label:  'block text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1',
            input:  'w-full px-2.5 py-1.5 text-[11px] text-white bg-[#0f1825] border border-gray-700/60 rounded-md outline-none focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/15 hover:border-gray-600/80 transition-all placeholder:text-gray-600',
            select: 'w-full px-2.5 py-1.5 text-[11px] text-white bg-[#0f1825] border border-gray-700/60 rounded-md outline-none focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/15 hover:border-gray-600/80 transition-all cursor-pointer appearance-none bg-no-repeat bg-[length:14px_14px] bg-[right_8px_center] pr-7',
            search: 'w-full pl-8 pr-2.5 py-1.5 text-[11px] text-white bg-[#0f1825] border border-gray-700/60 rounded-md outline-none focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/15 hover:border-gray-600/80 transition-all placeholder:text-gray-600',
            btnOut: 'px-3 py-1.5 text-[11px] font-medium text-gray-300 bg-transparent border border-gray-700/60 rounded-md hover:bg-gray-700/30 hover:text-white hover:border-gray-600 transition-all',
            btnOk:  'px-3 py-1.5 text-[11px] font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 border border-purple-500/40 rounded-md hover:from-purple-500 hover:to-pink-500 hover:shadow-lg hover:shadow-purple-500/20 transition-all flex items-center gap-1.5',
            badge:  'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold leading-none',
            scroll: '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-700 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent'
        };

        // Caret SVG inline para selects
        const caretBg = "background-image: url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\");";

        // Wrapper de select con flechita Lucide visible (overlay encima del bg-svg)
        const selectWrap = (innerSelect, wrapCls = '') => `
            <div class="relative ${wrapCls}">
                ${innerSelect}
                <span class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none flex items-center">
                    <i data-lucide="chevron-down" class="w-3.5 h-3.5"></i>
                </span>
            </div>
        `;

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

        // -- Lista de productos (columna izquierda)

        const productCardHtml = (p) => {
            const origenId = $(`#${opts.id}_origenSuc`).val() || opts.json.origenIdInicial;
            const stock    = stockOrigen(p, origenId);
            const stockColor = stock <= 0 ? 'text-red-400' : stock < 5 ? 'text-orange-400' : 'text-green-400';
            const stockBg    = stock <= 0 ? 'bg-red-500/10' : stock < 5 ? 'bg-orange-500/10' : 'bg-green-500/10';
            const disabled   = stock <= 0;
            return `
                <div class="flex items-center gap-2.5 px-3 py-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-transparent'} border-b border-gray-800/40 last:border-b-0 transition-all group" data-prod-id="${esc(p.id)}">
                    <div class="w-8 h-8 rounded-lg ${esc(p.bg || 'bg-gray-700/40')} flex items-center justify-center flex-shrink-0 ring-1 ring-white/5">
                        <i data-lucide="${esc(p.icon || 'package')}" class="w-4 h-4 ${esc(p.color || 'text-gray-400')}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-[11px] font-semibold text-white truncate">${esc(p.nombre)}</p>
                        <div class="flex items-center gap-1.5 mt-0.5">
                            <span class="text-[9px] text-gray-500 font-mono">${esc(p.sku)}</span>
                            <span class="text-[9px] px-1.5 py-0.5 rounded ${stockBg} ${stockColor} font-bold">Stock ${stock}</span>
                            <span class="text-[9px] text-gray-500">. ${fmtMoney(p.costo)}</span>
                        </div>
                    </div>
                    <div class="w-7 h-7 rounded-lg bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0 group-hover:bg-purple-600 group-hover:text-white group-hover:border-purple-500 transition-all">
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                    </div>
                </div>
            `;
        };

        const renderProductList = () => {
            const q = ($(`#${opts.id}_search`).val() || '').toLowerCase().trim();

            const list = (opts.json.productos || []).filter(p => {
                return !q || (p.nombre + ' ' + p.sku).toLowerCase().includes(q);
            });

            const html = list.length
                ? list.map(productCardHtml).join('')
                : `
                    <div class="flex flex-col items-center justify-center py-8 text-center px-2">
                        <div class="w-10 h-10 rounded-lg bg-gray-800/40 border border-gray-700/50 flex items-center justify-center mb-2">
                            <i data-lucide="search-x" class="w-5 h-5 text-gray-600"></i>
                        </div>
                        <p class="text-[10px] text-gray-500">${q ? 'Sin resultados' : 'Sin productos disponibles'}</p>
                    </div>
                `;
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
            const subtotal    = item.cant * item.price;
            const subtotalFmt = Number(subtotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const isTr        = !!item.transform;
            const isOpen      = item.transformOpen;
            const trList      = transformMap[item.id] || [];
            const stockColor  = item.stock === 0 ? 'text-red-400' : item.stock < 5 ? 'text-orange-400' : 'text-green-400';

            const trBtnCls = isTr
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300 cursor-not-allowed'
                : isOpen
                    ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                    : (!trList.length
                        ? 'bg-[#0f1825] border-gray-800/60 text-gray-600 cursor-not-allowed'
                        : 'bg-[#0f1825] border-gray-700/60 text-gray-400 hover:bg-blue-500/15 hover:text-blue-300 hover:border-blue-500/50');
            const minusCls = isTr
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:bg-purple-500/15 hover:text-white hover:border-purple-500/40';
            const plusCls  = (isTr || item.cant >= item.stock)
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:bg-purple-500/15 hover:text-white hover:border-purple-500/40';

            let rowHtml = `
                <tr class="border-b border-gray-800/40 last:border-b-0 hover:bg-purple-500/[0.04] transition-colors ${isTr ? 'bg-cyan-500/[0.04]' : ''}" data-cart-id="${esc(item.id)}">
                    <td class="px-3 py-2 align-middle">
                        <div class="flex items-center gap-2 min-w-0">
                            <div class="w-7 h-7 rounded-lg ${esc(item.bg)} flex items-center justify-center flex-shrink-0 ring-1 ring-white/5">
                                <i data-lucide="${esc(item.icon)}" class="w-3.5 h-3.5 ${esc(item.color)}"></i>
                            </div>
                            <div class="min-w-0">
                                <p class="text-[11px] font-semibold text-white truncate leading-tight">
                                    ${esc(item.name)}${isTr ? ` <span class="${cls.badge} bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">${esc(opts.labels.badgeTr)}</span>` : ''}
                                </p>
                                <div class="flex items-center gap-1.5 mt-0.5">
                                    <span class="text-[9px] text-gray-500 font-mono">${esc(item.cat)}</span>
                                    <span class="text-gray-700">.</span>
                                    <span class="text-[9px] text-gray-400">${esc(opts.labels.stockLbl)} <strong class="${stockColor}">${item.stock}</strong></span>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td class="px-2 py-2 align-middle">
                        <div class="flex items-center justify-center gap-1">
                            <button type="button" data-cart-id="${esc(item.id)}" data-role="minus" class="w-6 h-6 rounded-md bg-[#0f1825] border border-gray-700/60 text-gray-400 ${minusCls} transition flex items-center justify-center text-xs">&minus;</button>
                            <span class="w-8 text-center text-[11px] font-bold text-white">${item.cant}</span>
                            <button type="button" data-cart-id="${esc(item.id)}" data-role="plus" class="w-6 h-6 rounded-md bg-[#0f1825] border border-gray-700/60 text-gray-400 ${plusCls} transition flex items-center justify-center text-xs">+</button>
                        </div>
                    </td>
                    <td class="px-2 py-2 align-middle text-right">
                        <span class="text-[11px] text-gray-300">${fmtMoney(item.price)}</span>
                    </td>
                    <td class="px-2 py-2 align-middle text-right">
                        <span class="text-green-400 font-bold text-[12px]">$${subtotalFmt}</span>
                        <p class="text-[8px] text-gray-600 leading-none mt-0.5">${item.cant} x ${fmtMoney(item.price)}</p>
                    </td>
                    <td class="px-2 py-2 align-middle">
                        <div class="flex items-center justify-center gap-1">
                            <button type="button" data-cart-id="${esc(item.id)}" data-role="transform"
                                    class="w-6 h-6 rounded-md border ${trBtnCls} transition flex items-center justify-center" title="${esc(opts.labels.transformar)}">
                                <i data-lucide="recycle" class="w-3 h-3"></i>
                            </button>
                            <button type="button" data-cart-id="${esc(item.id)}" data-role="remove"
                                    class="w-6 h-6 rounded-md bg-[#0f1825] border border-gray-700/60 text-gray-500 hover:text-red-400 hover:bg-red-500/15 hover:border-red-500/40 transition flex items-center justify-center" title="Quitar">
                                <i data-lucide="x" class="w-3 h-3"></i>
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
                    <tr class="bg-blue-500/[0.05] border-b border-blue-500/30">
                        <td colspan="5" class="px-4 py-2.5">
                            <div class="flex items-center gap-3 flex-wrap">
                                <div class="flex items-center gap-1.5 text-blue-300">
                                    <i data-lucide="recycle" class="w-3.5 h-3.5"></i>
                                    <span class="text-[10px] font-bold uppercase tracking-wider">${esc(opts.labels.transformar)}</span>
                                </div>
                                ${selectWrap(`<select data-transform-select="${esc(item.id)}" class="${cls.select}" style="${caretBg}">${selectOpts}</select>`, 'w-52')}
                                <div class="flex items-center gap-1.5">
                                    <span class="text-[9px] text-gray-400 uppercase tracking-wider">${esc(opts.labels.piezas)}</span>
                                    <input type="number" value="${defaultPiezas}" min="1" data-transform-qty="${esc(item.id)}" class="${cls.input} !w-14 !text-center !px-1 !font-bold">
                                </div>
                                <div class="flex items-center gap-1.5 ml-auto">
                                    <button type="button" data-cart-id="${esc(item.id)}" data-role="cancel-transform" class="${cls.btnOut} !py-1 !text-[10px]">${esc(opts.labels.cancelarTr)}</button>
                                    <button type="button" data-cart-id="${esc(item.id)}" data-role="apply-transform" class="${cls.btnOk} !py-1 !text-[10px]">
                                        <i data-lucide="check" class="w-3 h-3"></i>${esc(opts.labels.aplicar)}
                                    </button>
                                </div>
                            </div>
                        </td>
                    </tr>
                `;
            }

            if (isTr) {
                rowHtml += `
                    <tr class="bg-cyan-500/[0.05] border-b border-cyan-500/30">
                        <td colspan="5" class="px-4 py-2">
                            <div class="flex items-center gap-2 flex-wrap">
                                <div class="w-6 h-6 rounded-full bg-cyan-500/15 border border-cyan-500/35 flex items-center justify-center flex-shrink-0">
                                    <i data-lucide="recycle" class="w-3 h-3 text-cyan-300"></i>
                                </div>
                                <span class="text-[10px] text-cyan-200">
                                    ${esc(opts.labels.transformOk)} <span class="font-bold text-white">${item.transform.piezas} ${esc(opts.labels.piezas).replace(':','').toLowerCase()}</span> ${esc(opts.labels.transformOf)} <span class="font-bold text-white">${esc(item.transform.producto)}</span>
                                </span>
                                <button type="button" data-cart-id="${esc(item.id)}" data-role="revert-transform" class="ml-auto text-[10px] px-2 py-1 bg-cyan-500/15 text-cyan-200 border border-cyan-500/35 rounded-md hover:bg-cyan-500/25 transition flex items-center gap-1">
                                    <i data-lucide="undo" class="w-3 h-3"></i>${esc(opts.labels.revertir)}
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
                if (inCart) $(this).addClass('!bg-purple-500/10');
                else        $(this).removeClass('!bg-purple-500/10');
            });
        };

        const renderCart = () => {
            const $tbody = $(`#${opts.id}_cartBody`);
            if (!cart.length) {
                $tbody.html(`
                    <tr><td colspan="5" class="px-3 py-10">
                        <div class="flex flex-col items-center justify-center text-center">
                            <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/5 border border-purple-500/25 flex items-center justify-center mb-2">
                                <i data-lucide="shopping-cart" class="w-6 h-6 text-purple-400/70"></i>
                            </div>
                            <p class="text-[11px] font-semibold text-gray-300">${esc(opts.labels.cartEmpty)}</p>
                        </div>
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
            <div id="${opts.id}_root" class="fixed inset-0 z-[100] flex items-center justify-center">
                <div id="${opts.id}_backdrop" class="absolute inset-0 bg-black/60"></div>
                <div id="${opts.id}" class="relative z-10 w-full max-w-[1080px] max-h-[92vh] mx-3 bg-[#111928] border border-gray-700/60 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col">

                    <!-- Header -->
                    <div class="flex items-center justify-between px-[18px] py-[14px] border-b border-gray-700/60 bg-[#141d2b] flex-shrink-0">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                                <i data-lucide="arrow-left-right" class="w-5 h-5 text-white"></i>
                            </div>
                            <div>
                                <h3 class="text-sm font-bold text-white flex items-center gap-2">
                                    ${esc(opts.labels.title)}
                                </h3>
                                <p class="text-[11px] text-gray-500">${esc(opts.labels.subtitle)}</p>
                            </div>
                        </div>
                        <button type="button" id="${opts.id}_close" class="w-8 h-8 rounded-lg bg-[#1a2332] border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-500 transition">
                            <i data-lucide="x" class="w-4 h-4"></i>
                        </button>
                    </div>

                    <!-- Filtros: Origen / Destino / Categoria -->
                    <div class="px-5 pt-4 pb-3 border-b border-gray-800/70 bg-[#0f1825]/40">
                        <div class="grid grid-cols-3 gap-3">

                            <div class="bg-[#0f172a]/60 border border-gray-700/60 rounded-lg p-3 relative">
                                <div class="absolute -top-2 left-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[8px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shadow-md shadow-purple-500/20">${esc(opts.labels.origen)}</div>
                                <label class="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-2 mt-0.5">
                                    <i data-lucide="arrow-up-from-line" class="w-3 h-3"></i>${esc(opts.labels.origenLbl)}
                                </label>
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <p class="text-[8px] uppercase tracking-wider text-gray-500 mb-0.5">${esc(opts.labels.sucursal)}</p>
                                        ${selectWrap(`<select id="${opts.id}_origenSuc" class="${cls.select}" style="${caretBg}">${optionsHtml(sucsFiltradas, opts.json.origenIdInicial)}</select>`)}
                                    </div>
                                    <div>
                                        <p class="text-[8px] uppercase tracking-wider text-gray-500 mb-0.5">${esc(opts.labels.almacen)}</p>
                                        ${selectWrap(`<select id="${opts.id}_origenAlm" class="${cls.select}" style="${caretBg}">${optionsHtml(alms, firstAlm)}</select>`)}
                                    </div>
                                </div>
                            </div>

                            <div class="bg-[#0f172a]/60 border border-gray-700/60 rounded-lg p-3 relative">
                                <div class="absolute -top-2 left-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[8px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shadow-md shadow-purple-500/20">${esc(opts.labels.destino)}</div>
                                <label class="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-2 mt-0.5">
                                    <i data-lucide="arrow-down-to-line" class="w-3 h-3"></i>${esc(opts.labels.destinoLbl)}
                                </label>
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <p class="text-[8px] uppercase tracking-wider text-gray-500 mb-0.5">${esc(opts.labels.sucursal)}</p>
                                        ${selectWrap(`<select id="${opts.id}_destinoSuc" class="${cls.select}" style="${caretBg}">${optionsHtml(sucsFiltradas, '')}</select>`)}
                                    </div>
                                    <div>
                                        <p class="text-[8px] uppercase tracking-wider text-gray-500 mb-0.5">${esc(opts.labels.almacen)}</p>
                                        ${selectWrap(`<select id="${opts.id}_destinoAlm" class="${cls.select}" style="${caretBg}">${optionsHtml(alms, firstAlm)}</select>`)}
                                    </div>
                                </div>
                            </div>

                            <div class="bg-[#0f172a]/60 border border-gray-700/60 rounded-lg p-3 relative">
                                <div class="absolute -top-2 left-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[8px] px-2 py-0.5 rounded font-bold uppercase tracking-wider shadow-md shadow-purple-500/20">${esc(opts.labels.categoria)}</div>
                                <label class="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-2 mt-0.5">
                                    <i data-lucide="tag" class="w-3 h-3"></i>${esc(opts.labels.categoriaLbl)}
                                </label>
                                <div>
                                    <p class="text-[8px] uppercase tracking-wider text-gray-500 mb-0.5">${esc(opts.labels.tipo)}</p>
                                    ${selectWrap(`<select id="${opts.id}_categoria" class="${cls.select}" style="${caretBg}">${optionsHtml(cats, firstCat)}</select>`)}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Cuerpo (2 columnas) -->
                    <div class="flex flex-1 min-h-0">

                        <!-- Columna izquierda: buscador + lista -->
                        <div class="w-[320px] border-r border-gray-800/70 flex flex-col flex-shrink-0 p-2.5 gap-2 overflow-hidden">
                            <div class="flex-shrink-0">
                                <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">${esc(opts.labels.buscar)}</p>
                                <div class="relative">
                                    <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none flex items-center">
                                        <i data-lucide="search" class="w-3.5 h-3.5"></i>
                                    </span>
                                    <input id="${opts.id}_search" type="text" placeholder="${esc(opts.labels.buscarPh)}" class="${cls.search}" autocomplete="off">
                                </div>
                            </div>
                            <div id="${opts.id}_productList" class="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 bg-[#0f172a]/40 border border-gray-800/60 rounded-lg ${cls.scroll}"></div>
                        </div>

                        <!-- Columna derecha: carrito -->
                        <div class="flex-1 flex flex-col min-w-0 min-h-0">

                            <div class="px-4 py-2.5 border-b border-gray-800/70 flex items-center justify-between flex-shrink-0 bg-gradient-to-b from-[#0f1825]/60 to-transparent">
                                <div class="flex items-center gap-2">
                                    <div class="w-6 h-6 rounded-md bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
                                        <i data-lucide="shopping-cart" class="w-3.5 h-3.5 text-purple-400"></i>
                                    </div>
                                    <p class="text-[10px] font-bold uppercase tracking-wider text-gray-300">${esc(opts.labels.cart)}</p>
                                    <span id="${opts.id}_cartCount" class="${cls.badge} bg-gradient-to-br from-purple-500/25 to-fuchsia-500/15 text-purple-300 border border-purple-500/40">0</span>
                                </div>
                                <button type="button" id="${opts.id}_clearCart" class="text-[10px] text-gray-500 hover:text-red-400 transition flex items-center gap-1 px-2 py-1 rounded-md hover:bg-red-500/10">
                                    <i data-lucide="trash-2" class="w-3 h-3"></i>${esc(opts.labels.limpiar)}
                                </button>
                            </div>

                            <div class="flex-1 min-h-0 overflow-y-auto ${cls.scroll}">
                                <table class="w-full border-collapse">
                                    <thead class="sticky top-0 z-10 bg-[#0f1825] border-b border-gray-700/60">
                                        <tr>
                                            <th class="text-left px-3 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-bold">Producto</th>
                                            <th class="text-center px-2 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-bold w-28">Cantidad</th>
                                            <th class="text-right px-2 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-bold w-24">Costo</th>
                                            <th class="text-right px-2 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-bold w-28">Subtotal</th>
                                            <th class="text-center px-2 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-bold w-20">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody id="${opts.id}_cartBody"></tbody>
                                </table>
                            </div>

                            <div class="px-4 py-2 border-t border-gray-800/70 flex-shrink-0 bg-[#0f1825]/40">
                                <div class="grid grid-cols-3 gap-2">
                                    <div class="text-center">
                                        <p class="text-[8px] text-gray-500 uppercase tracking-wider leading-none mb-0.5">${esc(opts.labels.items)}</p>
                                        <p id="${opts.id}_footerItems" class="text-xs font-bold text-white">0</p>
                                    </div>
                                    <div class="text-center border-x border-gray-800/60">
                                        <p class="text-[8px] text-gray-500 uppercase tracking-wider leading-none mb-0.5">${esc(opts.labels.unidades)}</p>
                                        <p id="${opts.id}_footerUds" class="text-xs font-bold text-white">0</p>
                                    </div>
                                    <div class="text-center">
                                        <p class="text-[8px] text-gray-500 uppercase tracking-wider leading-none mb-0.5">${esc(opts.labels.costoTot)}</p>
                                        <p id="${opts.id}_footerCosto" class="text-xs font-bold text-green-400">${fmtMoney(0)}</p>
                                    </div>
                                </div>
                            </div>

                            <div class="px-4 py-2.5 border-t border-gray-800/70 flex-shrink-0 bg-[#0f1825]/40">
                                <label class="${cls.label}">${esc(opts.labels.nota)}</label>
                                <textarea id="${opts.id}_nota" class="${cls.input} resize-y" rows="1" placeholder="${esc(opts.labels.notaPh)}"></textarea>
                            </div>
                        </div>
                    </div>

                    <!-- Pie -->
                    <div class="flex items-center justify-between px-[18px] py-3 border-t border-gray-700/60 bg-[#141d2b] flex-shrink-0">
                        <p id="${opts.id}_error" class="hidden text-[11px] font-semibold text-red-400"></p>
                        <div class="flex gap-2 ml-auto">
                            <button type="button" id="${opts.id}_cancel" class="${cls.btnOut}">${esc(opts.labels.cancelar)}</button>
                            <button type="button" id="${opts.id}_save" class="${cls.btnOk}">
                                <i data-lucide="send" class="w-3.5 h-3.5"></i><span>${esc(opts.labels.crear)}</span>
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
