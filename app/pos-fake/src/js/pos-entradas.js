let api = 'ctrl/ctrl-pos-entradas.php';
let app, entradas, entradasView;

let turno, subsidiaries_id;

window.updateSession = () => { };


$(async () => {
    entradasView = new EntradasView(api, 'root');
    entradas     = new Entradas(api, 'root');
    app          = new App(api, 'root');
    await app.init();
});


class App extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSEntradas';
        this.subId        = null;
        this.selectedId   = null;
    }

    async init() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:{ opc:'init' } })
        this.dataInit = {
            subsidiaries_id: '',
            sucursales:  SAMPLE_ENTRADAS_SUCURSALES,
            origenes:    SAMPLE_ENTRADAS_ORIGENES,
            estados:     SAMPLE_ENTRADAS_ESTADOS
        };
        this.subId      = this.dataInit.subsidiaries_id;
        subsidiaries_id = this.subId;

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        entradasView.renderHeader(SAMPLE_VIEW_HEADER_ENTRADAS);
        entradasView.renderFooter(SAMPLE_VIEW_FOOTER_ENTRADAS);
        entradasView.renderTabs(this.PROJECT_NAME);
        entradasView.renderDetail(null);
        this.populateFilters();
        entradas.lsEntradas();
        entradas.lsKpis();
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
            class:'w-full md:w-[420px] flex-shrink-0 bg-[#141d2b] border-t md:border-t-0 md:border-l border-[#374151] flex flex-col overflow-hidden',
            children: [
                {
                    id:    'emptyDetail',
                    text:  '#emptyDetail',
                    class: 'flex-1 flex flex-col items-center justify-center text-center px-6'
                },
                {
                    id:    'detailContent',
                    text:  '#detailContent',
                    class: 'hidden flex-1 flex flex-col overflow-hidden'
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
                lbl:      'Sucursal:',
                class:    'col-12 col-md-3 col-lg-3',
                onchange: 'app.onChangeSucursal()',
                data:     []
            },
            {
                opc:      'select',
                id:       'fOrigen',
                lbl:      'Origen:',
                class:    'col-12 col-md-3 col-lg-3',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     SAMPLE_ENTRADAS_ORIGENES
            },
            {
                opc:      'select',
                id:       'fEstado',
                lbl:      'Estado:',
                class:    'col-12 col-md-3 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     SAMPLE_ENTRADAS_ESTADOS
            },
            {
                opc:        'input',
                id:         'qBuscar',
                lbl:        'Buscar:',
                class:      'col-12 col-md-3 col-lg-3',
                placeholder:'Folio, registrado, nota...',
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
            // Evita duplicar la opcion "Todas..." si ya viene en data
            if (item.id === '' && $sel.find('option').first().val() === '') return;
            $sel.append(`<option value="${item.id}">${item.valor}</option>`);
        });
    }

    getFilters() {
        return {
            subsidiaries_id: $('#subsidiaries_id').val() || this.subId || '',
            origen:          $('#fOrigen').val()        || '',
            estado:          $('#fEstado').val()        || '',
            q:               $('#qBuscar').val()        || ''
        };
    }

    // -- Event handlers --

    async onChangeFilters() {
        entradas.lsEntradas();
        await entradas.lsKpis();

        // Si la entrada seleccionada se filtra fuera, cerrar panel
        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectEntrada(null);
        }
    }

    onChangeSucursal() {
        entradas.lsEntradas();
        entradas.lsKpis();
        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectEntrada(null);
        }
    }

    isVisibleAfterFilters(folio) {
        const e   = SAMPLE_ENTRADAS_DB[folio];
        if (!e) return false;
        const f   = this.getFilters();
        const suc = !f.subsidiaries_id || e.sucursalId === f.subsidiaries_id;
        const ori = !f.origen          || e.origen     === f.origen;
        const est = !f.estado          || e.estado     === f.estado;
        const q   = !f.q || (e.folio + ' ' + e.registrado + ' ' + (e.nota || ''))
                                .toLowerCase()
                                .includes(f.q.toLowerCase());
        return suc && ori && est && q;
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }

    // -- Facade --

    selectEntrada(folio) {
        this.selectedId = folio;
        // Resaltar fila activa
        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');
        if (folio) {
            const $row = $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
                return $(this).text().includes(folio);
            });
            $row.addClass('row-active');
        }
        entradasView.renderDetail(folio ? SAMPLE_ENTRADAS_DB[folio] : null);
    }

    editEntrada(folio) {
        console.log('[editEntrada]', folio);
        // En modo fake solo seleccionamos
        this.selectEntrada(folio);
    }

    renderDetail(entrada) {
        entradasView.renderDetail(entrada);
    }
}


class Entradas extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSEntradas';
    }

    // -- Data --

    lsEntradas() {
        // MODO FAKE: si hubiera backend -> useFetch({ data:Object.assign({ opc:'lsEntradas' }, app.getFilters()) })
        const f = app.getFilters();
        const filteredRows = (SAMPLE_ENTRADAS_TABLE.row || []).filter(r => {
            const e = SAMPLE_ENTRADAS_DB[r.id];
            if (!e) return true;
            const suc = !f.subsidiaries_id || e.sucursalId === f.subsidiaries_id;
            const ori = !f.origen          || e.origen     === f.origen;
            const est = !f.estado          || e.estado     === f.estado;
            const q   = !f.q || (e.folio + ' ' + e.registrado + ' ' + (e.nota || ''))
                                    .toLowerCase()
                                    .includes(f.q.toLowerCase());
            return suc && ori && est && q;
        });

        const data = { row: filteredRows };

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'dark',
            title:        '',
            subtitle:     '',
            center:       [2, 3, 7],
            right:        [4],
            extends:      true,
            scrollable:   false,
            f_size:       12,
            emptyMessage: 'No se encontraron entradas con los filtros aplicados',
            emptyIcon:    'icon-arrow-down-to-line',
            data:         data
        });

        if (window.lucide) lucide.createIcons();

        const total = filteredRows.length;
        app.updateFooterInfo(`Mostrando ${total} entrada${total !== 1 ? 's' : ''}`);
    }

    async lsKpis() {
        // MODO FAKE: si hubiera backend -> useFetch({ data:Object.assign({ opc:'showEntradas' }, app.getFilters()) })
        const f = app.getFilters();
        const visible = Object.values(SAMPLE_ENTRADAS_DB).filter(e => {
            const suc = !f.subsidiaries_id || e.sucursalId === f.subsidiaries_id;
            const ori = !f.origen          || e.origen     === f.origen;
            const est = !f.estado          || e.estado     === f.estado;
            const q   = !f.q || (e.folio + ' ' + e.registrado + ' ' + (e.nota || ''))
                                    .toLowerCase()
                                    .includes(f.q.toLowerCase());
            return suc && ori && est && q;
        });

        const origenCount = {};
        let costoTot = 0;
        visible.forEach(e => {
            origenCount[e.origen] = (origenCount[e.origen] || 0) + 1;
            costoTot += (e.productos || []).reduce((s, p) => s + Number(p.cant || 0) * Number(p.costo || 0), 0);
        });
        const principal = visible.length
            ? Object.keys(origenCount).reduce((a, b) => (origenCount[a] > origenCount[b] ? a : b), Object.keys(origenCount)[0])
            : '-';

        const kpis = [
            { id: 'kpiEntradas',  label: 'Entradas',      value: visible.length                                          || 0, tone: 'success' },
            { id: 'kpiCosto',     label: 'Costo Total',   value: '$' + Math.round(costoTot).toLocaleString('en-US')           , tone: 'default' },
            { id: 'kpiSemana',    label: 'Semana',        value: visible.length                                          || 0, tone: 'purple'  },
            { id: 'kpiPrincipal', label: 'Origen Princ.', value: principal                                                    , tone: 'info'    }
        ];
        entradasView.renderInfoCards(kpis);
    }

    async getEntrada(folio) {
        // MODO FAKE: si hubiera backend -> useFetch({ data:{ opc:'getEntrada', folio } })
        entradasView.renderDetail(SAMPLE_ENTRADAS_DB[folio] || null);
    }

    // -- Actions --

    viewEntrada(folio) {
        console.log('[viewEntrada]', folio);
        app.selectEntrada(folio);
    }
}


class EntradasView extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSEntradas';
    }

    // -- Render helpers --

    renderDetail(entrada) {
        this.entradaDetailPanel({
            parent:  'detailPanel',
            json:    entrada,
            onClose: () => {
                app.selectedId = null;
                this.renderDetail(null);
                $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');
            },
            onPrint:   (e) => console.log('[entrada] imprimir', e && e.folio),
            onReverse: (e) => console.log('[entrada] reversar', e && e.folio)
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
            parent:   'viewHeader',
            json:     data,
            onToggle: (key, value) => console.log('[viewHeader] toggle', key, '->', value)
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
                { id: 'stock',        label: 'Stock Actual',  active: false },
                { id: 'movimientos',  label: 'Movimientos',   active: false },
                { id: 'entradas',     label: 'Entradas',      active: true  },
                { id: 'traspasos',    label: 'Traspasos',     active: false },
                { id: 'ajustes',      label: 'Ajustes',       active: false }
            ],
            onChange: (tab) => console.log('[tabsBar]', tab.id)
        });
    }

    // -- Components --

    kpisRow(options) {
        const defaults = {
            parent: 'root',
            id:     'kpisRow',
            class:  'grid grid-cols-2 md:grid-cols-4 gap-3',
            json:   [],
            labels: {
                empty: 'Sin indicadores'
            },
            tones: {
                default: 'text-white',
                success: 'cs-text-success text-[var(--cs-success,#3FC189)]',
                warning: 'cs-text-warning text-[var(--cs-warning,#FBBF24)]',
                danger:  'cs-text-danger  text-[var(--cs-danger,#E02424)]',
                info:    'cs-text-info    text-[var(--cs-info,#1C64F2)]',
                purple:  'cs-text-purple  text-[var(--cs-accent-purple,#7C3AED)]'
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
            grid.html(`
                <p class="col-span-full text-[10px] text-[var(--cs-text-muted,#9CA3AF)] italic text-center py-2">
                    ${esc(opts.labels.empty)}
                </p>
            `);
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
            json:   { title: '', subtitle: '', toggles: [] },
            classes: {
                title:    'text-base font-bold text-white',
                subtitle: 'text-[10px] text-[var(--cs-text-secondary,#D1D5DB)]',
                groupLbl: 'text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-bold',
                btn:      'demo-toggle px-2.5 py-1 rounded text-[11px] border border-[var(--cs-border,#374151)] text-[var(--cs-text-secondary,#D1D5DB)] hover:bg-[var(--cs-bg-input,#1F2937)] transition-colors',
                btnActive:'demo-toggle active px-2.5 py-1 rounded text-[11px] border border-[var(--cs-accent-purple,#7C3AED)] bg-[var(--cs-accent-purple,#7C3AED)]/15 text-white',
                sep:      'text-[var(--cs-border,#374151)]'
            },
            onToggle: () => { }
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

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        const togglesHtml = (opts.json.toggles || [])
            .map((g, i, arr) => toggleGroup(g) + (i < arr.length - 1 ? `<span class="${opts.classes.sep}">|</span>` : ''))
            .join('');

        wrap.html(`
            <div>
                <h1 class="${opts.classes.title}">${esc(opts.json.title)}</h1>
                ${opts.json.subtitle ? `<p class="${opts.classes.subtitle}">${esc(opts.json.subtitle)}</p>` : ''}
            </div>
            <div class="flex items-center gap-4">
                ${togglesHtml}
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);

        wrap.on('click', '[data-toggle-key]', (e) => {
            const $btn = $(e.currentTarget);
            const key  = $btn.attr('data-toggle-key');
            const val  = $btn.attr('data-toggle-value');
            state[key] = val;

            $btn.siblings('[data-toggle-key="' + key + '"]').addBack().each(function () {
                const isActive  = $(this).attr('data-toggle-value') === val;
                this.className  = isActive ? opts.classes.btnActive : opts.classes.btn;
            });

            opts.onToggle(key, val, Object.assign({}, state));
        });
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
                legend: 'flex items-center gap-3 text-[10px] text-[var(--cs-text-muted,#9CA3AF)]',
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
            class:  'flex items-center gap-1 border-b border-transparent',
            json:   [],
            classes: {
                tab:       'px-3 py-2 text-[11px] font-medium text-[var(--cs-text-muted,#9CA3AF)] border-b-2 border-transparent hover:text-white transition-colors cursor-pointer',
                tabActive: 'px-3 py-2 text-[11px] font-bold text-[var(--cs-accent-purple,#A78BFA)] border-b-2 border-[var(--cs-accent-purple,#7C3AED)] cursor-pointer'
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
            const id = $(e.currentTarget).attr('data-tab-id');
            wrap.find('[data-tab-id]').each(function () {
                const isActive = $(this).attr('data-tab-id') === id;
                this.className = isActive ? opts.classes.tabActive : opts.classes.tab;
            });
            const tab = (opts.json || []).find(t => t.id === id);
            opts.onChange(tab || { id });
        });
    }

    entradaDetailPanel(options) {
        const defaults = {
            parent:    'root',
            id:        'entradaDetailPanel',
            class:     'w-full h-full flex-shrink-0 bg-[var(--cs-bg-header,#141d2b)] border-l border-[var(--cs-border,#374151)] flex flex-col overflow-hidden',
            json:      null,
            labels: {
                emptyTitle:  'Selecciona una entrada',
                emptyHint:   'Haz click en cualquier fila o en el icono ojo para ver el detalle aqui.',
                subtitleLbl: 'Detalle de recepcion',
                origen:      'Origen',
                sucursal:    'Sucursal',
                registrado:  'Registrado por',
                productos:   'Productos',
                costoTot:    'Costo total',
                detalleLbl:  'Detalle de Productos',
                notaLbl:     'Nota',
                cant:        'Cant',
                costo:       'Costo',
                subtotal:    'Subtot.',
                stockLbl:    'Stock',
                imprimir:    'Imprimir',
                reversar:    'Reversar'
            },
            origenPalettes: {
                'Produccion':    { bg: 'rgba(124,58,237,0.15)', fg: '#A78BFA' },
                'Proveedor':     { bg: 'rgba(251,191,36,0.15)', fg: '#FBBF24' },
                'Transferencia': { bg: 'rgba(28,100,242,0.15)', fg: '#60A5FA' },
                'Devolucion':    { bg: 'rgba(244,63,94,0.15)',  fg: '#F43F5E' }
            },
            estadoPalettes: {
                'Aplicada':  { bg: 'rgba(63,193,137,0.15)', fg: '#3FC189' },
                'Pendiente': { bg: 'rgba(251,191,36,0.15)', fg: '#FBBF24' },
                'Reversada': { bg: 'rgba(244,63,94,0.15)',  fg: '#F43F5E' }
            },
            onClose:   () => { },
            onPrint:   () => { },
            onReverse: () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels         = Object.assign({}, defaults.labels,         o.labels         || {});
        opts.origenPalettes = Object.assign({}, defaults.origenPalettes, o.origenPalettes || {});
        opts.estadoPalettes = Object.assign({}, defaults.estadoPalettes, o.estadoPalettes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const fmtMoney      = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const fmtMoneyShort = (n) => '$' + Number(n).toLocaleString('en-US');

        const DOW = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
        const MON = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const fmtFecha = (iso) => {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso || '';
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
                <div class="px-4 py-3 border-b border-[var(--cs-border,#374151)] flex-shrink-0 flex items-center justify-between">
                    <div>
                        <h3 class="text-sm font-bold text-white">Vista de la Entrada</h3>
                        <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.subtitleLbl)}</p>
                    </div>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center text-center px-6">
                    <div class="w-14 h-14 rounded-full bg-[var(--cs-bg-input,#1F2937)] border border-[var(--cs-border,#374151)] flex items-center justify-center mb-3">
                        <i data-lucide="arrow-down-to-line" class="w-6 h-6 text-[var(--cs-text-muted,#9CA3AF)]"></i>
                    </div>
                    <p class="text-[11px] text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.emptyTitle)}</p>
                    <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)] mt-1 max-w-[220px]">${esc(opts.labels.emptyHint)}</p>
                </div>
                <div class="px-4 py-3 border-t border-[var(--cs-border,#374151)] flex gap-2 flex-shrink-0">
                    <button id="${opts.id}_print" class="cs-btn cs-btn-outline flex-1 cs-btn-sm" disabled>${esc(opts.labels.imprimir)}</button>
                    <button id="${opts.id}_reverse" class="cs-btn cs-btn-danger flex-1 cs-btn-sm" disabled>${esc(opts.labels.reversar)}</button>
                </div>
            `);
            $(`#${opts.parent}`).html(aside);
            if (window.lucide) lucide.createIcons();
            return;
        }

        // -- Render con entrada
        const e         = opts.json;
        const totals    = (() => {
            const uds   = (e.productos || []).reduce((s, p) => s + Number(p.cant  || 0), 0);
            const costo = (e.productos || []).reduce((s, p) => s + Number(p.cant  || 0) * Number(p.costo || 0), 0);
            return { uds, costo };
        })();
        const origenC   = opts.origenPalettes[e.origen] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF' };
        const estadoC   = opts.estadoPalettes[e.estado] || { bg: 'rgba(63,193,137,0.15)',  fg: '#3FC189' };
        const folioCol  = e.origen === 'Transferencia' ? 'text-blue-400' : 'text-green-400';

        const origenBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style="background:${origenC.bg};color:${origenC.fg};">${esc(e.origen)}</span>`;
        const estadoBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style="background:${estadoC.bg};color:${estadoC.fg};">${esc(e.estado)}</span>`;

        // -- Productos
        const productosHtml = (e.productos || []).map(p => {
            const subtotal   = Number(p.cant) * Number(p.costo);
            const nuevoStock = Number(p.stockPrev || 0) + Number(p.cant || 0);
            return `
                <div class="bg-[var(--cs-bg-input,#1F2937)] rounded-md p-1.5 border border-[var(--cs-border,#374151)]">
                    <div class="flex items-center gap-1.5">
                        <div class="w-6 h-6 rounded ${p.bg} flex items-center justify-center flex-shrink-0">
                            <i data-lucide="${p.icon}" class="w-3 h-3 ${p.color}"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-[10px] font-bold leading-tight truncate text-white">${esc(p.nombre)}</p>
                            <p class="text-[8px] text-[var(--cs-text-muted,#9CA3AF)] leading-tight">${esc(p.sku)}</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-1 mt-1.5 pt-1.5 border-t border-[var(--cs-border,#374151)]">
                        <div>
                            <p class="text-[7px] text-[var(--cs-text-muted,#9CA3AF)] uppercase leading-none">${esc(opts.labels.cant)}</p>
                            <p class="text-[10px] font-bold text-green-400 leading-tight">+${p.cant}</p>
                        </div>
                        <div>
                            <p class="text-[7px] text-[var(--cs-text-muted,#9CA3AF)] uppercase leading-none">${esc(opts.labels.costo)}</p>
                            <p class="text-[10px] font-bold text-white leading-tight">${fmtMoney(p.costo)}</p>
                        </div>
                        <div>
                            <p class="text-[7px] text-[var(--cs-text-muted,#9CA3AF)] uppercase leading-none">${esc(opts.labels.subtotal)}</p>
                            <p class="text-[10px] font-bold text-white leading-tight">${fmtMoneyShort(subtotal)}</p>
                        </div>
                    </div>
                    <div class="mt-1 text-[8px] leading-tight">
                        <span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.stockLbl)}: ${p.stockPrev || 0} &rarr; <strong class="text-green-400">${nuevoStock}</strong></span>
                    </div>
                </div>`;
        }).join('');

        aside.html(`
            <div class="px-4 py-3 border-b border-[var(--cs-border,#374151)] flex-shrink-0 flex items-center justify-between">
                <div>
                    <h3 class="text-sm font-bold ${folioCol}">Entrada ${esc(e.folio)}</h3>
                    <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)]">${esc(fmtFecha(e.fechaIso))}</p>
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

                <!-- Resumen -->
                <div class="bg-[var(--cs-bg-input,#1F2937)] rounded-lg p-3 border border-[var(--cs-border,#374151)] space-y-1.5">
                    <div class="flex justify-between items-center text-[11px]">
                        <span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.origen)}</span>
                        ${origenBadge}
                    </div>
                    <div class="flex justify-between text-[11px]">
                        <span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.sucursal)}</span>
                        <span class="text-white">${esc(e.sucursal || '-')}</span>
                    </div>
                    <div class="flex justify-between text-[11px]">
                        <span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.registrado)}</span>
                        <span class="text-white">${esc(e.registrado || '-')}</span>
                    </div>
                    <div class="flex justify-between text-[11px]">
                        <span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.productos)}</span>
                        <span class="text-white font-bold">${e.productos.length} tipos / ${totals.uds} uds</span>
                    </div>
                    <div class="flex justify-between text-[11px]">
                        <span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.costoTot)}</span>
                        <span class="font-bold text-green-400">${fmtMoney(totals.costo)}</span>
                    </div>
                </div>

                <!-- Detalle de productos -->
                <div>
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider mb-2">${esc(opts.labels.detalleLbl)}</p>
                    <div class="space-y-1">${productosHtml || '<p class="text-[10px] text-gray-500 italic">Sin productos</p>'}</div>
                </div>

                <!-- Nota -->
                ${e.nota ? `
                <div class="bg-[var(--cs-bg-input,#1F2937)] rounded-lg p-3 border border-[var(--cs-border,#374151)]">
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider mb-1">${esc(opts.labels.notaLbl)}</p>
                    <p class="text-[11px] text-gray-300">${esc(e.nota)}</p>
                </div>` : ''}
            </div>

            <div class="px-4 py-3 border-t border-[var(--cs-border,#374151)] flex gap-2 flex-shrink-0">
                <button id="${opts.id}_print" class="cs-btn cs-btn-outline flex-1 cs-btn-sm">${esc(opts.labels.imprimir)}</button>
                <button id="${opts.id}_reverse" class="cs-btn cs-btn-danger flex-1 cs-btn-sm">${esc(opts.labels.reversar)}</button>
            </div>
        `);

        $(`#${opts.parent}`).html(aside);
        if (window.lucide) lucide.createIcons();

        $(`#${opts.id}_close`).on('click',   () => opts.onClose(e));
        $(`#${opts.id}_print`).on('click',   () => opts.onPrint(e));
        $(`#${opts.id}_reverse`).on('click', () => opts.onReverse(e));
    }
}
