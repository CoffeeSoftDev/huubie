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
            class:'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 w-full',
            children: [
                {
                    id:    'viewHeader',
                    text:  '#viewHeader',
                    class: 'flex items-center justify-between px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
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
                    class: 'p-3 flex-1 min-h-0 overflow-auto'
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
                class:     'flex-1 min-h-0 w-full flex flex-col md:flex-row overflow-hidden',
                container: [mainPanel, detailPanel]
            }
        });
    }

    // -- Filter bar --

    filterBar() {

        // Antepone una opcion "Todas/Todos" (id '') si el catalogo no la trae ya. Sin ella
        // el select se queda en la PRIMERA opcion real y lsTraspasos filtra por ese valor,
        // ocultando traspasos de otros estados/sucursales (incluido uno recien creado).
        const withAll = (list, label) => {
            const arr = list || [];
            return (arr[0] && (arr[0].id === '' || arr[0].id == null)) ? arr : [{ id: '', valor: label }].concat(arr);
        };
        const estados    = withAll(this.dataInit.estados,    'Todos los estados');
        const sucursales = withAll(this.dataInit.sucursales, 'Todas las sucursales');

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
        // El formulario (TraspasoForm) emite { origen, destino, categoria, productos[{productId,cant,costo}], nota }.
        // El backend saveTraspaso espera columnas DB: origin/destination_(subsidiaries|warehouse)_id,
        // note y productos[{product_id, quantity, cost}]. Sin esta traduccion los FK llegan en 0 y el
        // traspaso se inserta vacio (o falla por constraint) y no se visualiza en la lista.
        const origen  = payload.origen  || {};
        const destino = payload.destino || {};

        const backendPayload = {
            note:                        payload.nota || null,
            origin_subsidiaries_id:      origen.id,
            destination_subsidiaries_id: destino.id,
            origin_warehouse_id:         (origen.almacen  || {}).id,
            destination_warehouse_id:    (destino.almacen || {}).id,
            productos: (payload.productos || []).map(p => ({
                product_id: p.productId,
                quantity:   p.cant,
                cost:       p.costo
            }))
        };

        const r = await fn_ajax({
            opc:     'saveTraspaso',
            payload: JSON.stringify(backendPayload)
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

    // Crea (una sola vez) la instancia del modal de traspaso con el mismo diseño que
    // EntradaForm (buscador + navegacion por teclado + popover de cantidad + tabla
    // del lote agrupada por categoria). Carga los catalogos una vez y la reusa.
    async ensureTraspasoForm() {
        if (this.traspasoFormApi) return this.traspasoFormApi;

        const sucursales = (app.dataInit.sucursales || []).filter(s => s.id !== '');
        const r  = await fn_ajax({ opc: 'getCatalogosTraspaso' }, api).catch(() => null);
        const ok = r && r.status === 200;

        this.traspasoFormApi = this.traspasoForm({
            parent: 'body',
            id:     'traspasoFormModal',
            json:   ok ? (r.productos || []) : [],
            data: {
                sucursales:      sucursales,
                almacenes:       ok ? (r.almacenes    || []) : [],
                categorias:      ok ? (r.categorias   || []) : [],
                transformMap:    ok ? (r.transformMap || {}) : {},
                origenIdInicial: app.subId || (sucursales[0] && sucursales[0].id) || ''
            },
            onSave:  (payload) => traspasos.nuevoTraspaso(payload),
            onClose: () => console.log('[traspasoForm] cerrado')
        });
        return this.traspasoFormApi;
    }

    async openTraspasoForm() {
        await this.ensureTraspasoForm();
        // Sincroniza la sucursal origen con la seleccionada en el navbar en cada apertura.
        this.traspasoFormApi.setData({ origenIdInicial: app.subId || '' });
        this.traspasoFormApi.open();
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
            class:     'w-full h-full flex-shrink-0 bg-[var(--cs-bg-header,#141d2b)] flex flex-col overflow-hidden',
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
                <div class="px-3 py-3 flex-shrink-0">
                    <h3 class="text-sm font-bold text-white">Detalle Traspaso</h3>
                    <p class="text-[10px] text-[#9CA3AF]">${esc(opts.labels.subtitle)}</p>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center text-center px-6">
                    <div class="w-14 h-14 rounded-full bg-[#1F2937] flex items-center justify-center mb-3">
                        <i data-lucide="arrow-left-right" class="w-6 h-6 text-[#9CA3AF]"></i>
                    </div>
                    <p class="text-[11px] text-[#9CA3AF]">${esc(opts.labels.emptyTitle)}</p>
                    <p class="text-[10px] text-[#9CA3AF] mt-1 max-w-[220px]">${esc(opts.labels.emptyHint)}</p>
                </div>
                <div class="px-3 py-3 flex gap-2 flex-shrink-0">
                    <button type="button" class="flex-1 px-3 py-1.5 text-[11px] font-semibold text-white rounded-lg flex items-center justify-center gap-1.5 bg-red-600 opacity-40 cursor-not-allowed" disabled>
                        <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>${esc(opts.labels.rechazar)}
                    </button>
                    <button type="button" class="flex-1 px-3 py-1.5 text-[11px] font-semibold text-white rounded-lg flex items-center justify-center gap-1.5 bg-green-600 opacity-40 cursor-not-allowed" disabled>
                        <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>${esc(opts.labels.confirmar)}
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

        // Chip compacto de sucursal (origen/destino) en una sola linea.
        const sucChip = (suc, label, alignRight) => {
            const p    = opts.sucPalettes[suc.id] || { color: 'text-gray-400', borderHex: 'rgba(156,163,175,0.35)', bgHex: 'rgba(156,163,175,0.15)' };
            const icon = `<div class="w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0" style="background:${p.bgHex};border-color:${p.borderHex};"><i data-lucide="store" class="w-4 h-4 ${p.color}"></i></div>`;
            const text = `<div class="min-w-0 ${alignRight ? 'text-right' : ''}"><p class="text-[8px] text-[#9CA3AF] uppercase leading-none">${esc(label)}</p><p class="text-[11px] font-bold truncate leading-tight">${esc(suc.nombre)}</p></div>`;
            return `<div class="flex-1 min-w-0 flex items-center gap-2 ${alignRight ? 'justify-end' : ''}">${alignRight ? text + icon : icon + text}</div>`;
        };

        // Detalle de productos en tabla compacta (estilo visor de entradas) con fila Total.
        // Bajo cada nombre se muestra el movimiento de stock origen/destino en miniatura.
        const productosTable = () => {
            const rows = (t.productos || []).map(p => {
                const subtotal      = Number(p.cant) * Number(p.costo);
                const stockOrigPost = Number(p.stockOrigenPrev || 0) - Number(p.cant || 0);
                const stockDestPost = Number(p.stockDestinoPrev || 0) + Number(p.cant || 0);
                return `
                    <tr class="hover:bg-[#1F2937]/40 transition-colors border-b border-[#1F2937]">
                        <td class="py-1 px-1.5">
                            <p class="text-[10px] font-semibold text-white leading-tight truncate">${esc(p.nombre)}</p>
                            <p class="text-[8px] text-[#9CA3AF] leading-tight">O ${p.stockOrigenPrev || 0}&rarr;<strong class="text-orange-400">${stockOrigPost}</strong> &middot; D ${p.stockDestinoPrev || 0}&rarr;<strong class="text-green-400">${stockDestPost}</strong></p>
                        </td>
                        <td class="py-1 px-1.5 text-center font-bold text-blue-400 whitespace-nowrap">${p.cant}</td>
                        <td class="py-1 px-1.5 text-right text-white whitespace-nowrap">${fmtMoney(p.costo)}</td>
                        <td class="py-1 px-1.5 text-right text-white font-bold whitespace-nowrap">${fmtMoneyShort(subtotal)}</td>
                    </tr>`;
            }).join('');

            const foot = items ? `
                <tfoot>
                    <tr>
                        <td class="py-1.5 px-1.5 text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF]">Total</td>
                        <td class="py-1.5 px-1.5 text-center font-bold text-blue-400 whitespace-nowrap">${uds}</td>
                        <td class="py-1.5 px-1.5 text-right text-[#6B7280]">&mdash;</td>
                        <td class="py-1.5 px-1.5 text-right font-bold text-white whitespace-nowrap">${fmtMoney(costoTot)}</td>
                    </tr>
                </tfoot>` : '';

            return `
                <table class="w-full text-[10px] border-collapse bg-[#1F2937] rounded-lg overflow-hidden">
                    <thead>
                        <tr class="text-[9px] text-[#9CA3AF] uppercase tracking-wider">
                            <th class="py-1.5 px-1.5 text-left font-bold">${esc(opts.labels.productos)}</th>
                            <th class="py-1.5 px-1.5 text-center font-bold">${esc(opts.labels.cant)}</th>
                            <th class="py-1.5 px-1.5 text-right font-bold">${esc(opts.labels.costo)}</th>
                            <th class="py-1.5 px-1.5 text-right font-bold">${esc(opts.labels.subtot)}</th>
                        </tr>
                    </thead>
                    <tbody>${rows || `<tr><td colspan="4" class="py-2 text-center text-[11px] text-gray-500 italic">Sin productos</td></tr>`}</tbody>
                    ${foot}
                </table>`;
        };

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
            <div class="px-3 py-3 flex-shrink-0 flex items-center justify-between">
                <div>
                    <h3 class="text-sm font-bold text-[#c4b5fd]">Traspaso ${esc(t.folio)}</h3>
                    <p class="text-[10px] text-[#9CA3AF]">${esc(fmtFecha(t.fechaIso))}</p>
                </div>
                <div class="flex items-center gap-2">
                    ${estadoBadge}
                    <button id="${opts.id}_close" class="text-[#D1D5DB] hover:text-white transition-colors p-1" title="Cerrar">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto cs-scroll px-3 py-3 space-y-3">

                <!-- Ruta (compacta, una linea) -->
                <div class="bg-[#1F2937] rounded-lg p-2.5">
                    <div class="flex items-center gap-2">
                        ${sucChip(t.origen, opts.labels.origen, false)}
                        <i data-lucide="arrow-right" class="w-4 h-4 text-[#c4b5fd] flex-shrink-0"></i>
                        ${sucChip(t.destino, opts.labels.destino, true)}
                    </div>
                </div>

                <!-- Metadata -->
                <div class="bg-[#1F2937] rounded-lg p-3 space-y-1.5">
                    <div class="flex justify-between text-[11px]"><span class="text-[#9CA3AF]">${esc(opts.labels.solicito)}</span><span class="font-medium">${esc(t.solicito || '-')}</span></div>
                    <div class="flex justify-between text-[11px]"><span class="text-[#9CA3AF]">${esc(opts.labels.autoriza)}</span><span class="font-medium">${esc(t.autoriza || '-')}</span></div>
                    <div class="flex justify-between text-[11px]"><span class="text-[#9CA3AF]">${esc(opts.labels.fSolicitud)}</span><span>${esc(fmtFecha(t.fechaIso))}</span></div>
                    <div class="flex justify-between text-[11px]"><span class="text-[#9CA3AF]">${esc(opts.labels.fEnvio)}</span><span>${esc(fmtFecha(t.fechaEnvio))}</span></div>
                    <div class="flex justify-between text-[11px]"><span class="text-[#9CA3AF]">${esc(opts.labels.totProd)}</span><span class="font-bold">${items} tipos / ${uds} uds</span></div>
                    <div class="flex justify-between text-[11px]"><span class="text-[#9CA3AF]">${esc(opts.labels.costoTot)}</span><span class="font-bold text-[#76A9FA]">${fmtMoney(costoTot)}</span></div>
                </div>

                <!-- Productos (tabla compacta) -->
                <div class="overflow-x-auto">${productosTable()}</div>

                <!-- Timeline -->
                <div>
                    <p class="text-[9px] text-[#9CA3AF] uppercase tracking-wider mb-2">${esc(opts.labels.historial)}</p>
                    <div class="space-y-0 border-l-2 border-[#374151] ml-2 pl-3">
                        ${timelineHtml}
                    </div>
                </div>

                <!-- Nota -->
                ${t.nota ? `
                <div class="bg-[#1F2937] rounded-lg p-3">
                    <p class="text-[9px] text-[#9CA3AF] uppercase tracking-wider mb-1">${esc(opts.labels.nota)}</p>
                    <p class="text-[11px] text-gray-300">${esc(t.nota)}</p>
                </div>` : ''}
            </div>

            <div class="px-3 py-3 flex gap-2 flex-shrink-0">
                <button type="button" id="${opts.id}_reject"
                        class="flex-1 px-3 py-1.5 text-[11px] font-semibold text-white rounded-lg flex items-center justify-center gap-1.5 bg-red-600 ${showReject ? 'hover:bg-red-500 hover:shadow-lg hover:shadow-red-500/20 transition-all' : 'opacity-40 cursor-not-allowed'}"
                        ${showReject ? '' : 'disabled'}>
                    <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>${esc(opts.labels.rechazar)}
                </button>
                <button type="button" id="${opts.id}_confirm"
                        class="flex-1 px-3 py-1.5 text-[11px] font-semibold text-white rounded-lg flex items-center justify-center gap-1.5 bg-green-600 ${showConfirm ? 'hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20 transition-all' : 'opacity-40 cursor-not-allowed'}"
                        ${showConfirm ? '' : 'disabled'}>
                    <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>${esc(opts.labels.confirmar)}
                </button>
            </div>
        `);

        $(`#${opts.parent}`).html(aside);
        if (window.lucide) lucide.createIcons();

        $(`#${opts.id}_close`).on('click',   () => opts.onClose(t));
        $(`#${opts.id}_reject`).on('click',  () => opts.onReject(t));
        $(`#${opts.id}_confirm`).on('click', () => opts.onConfirm(t));
    }
}
