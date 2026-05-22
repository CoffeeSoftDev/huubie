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
        // entradasView.renderTabs(this.PROJECT_NAME);
        entradasView.renderDetail(null);
        entradasView.renderEntradaForm();
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
            // {
            //     opc:      'select',
            //     id:       'subsidiaries_id',
            //     lbl:      'Sucursal:',
            //     class:    'col-12 col-md-3 col-lg-3',
            //     onchange: 'app.onChangeSucursal()',
            //     data:     []
            // },
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
                opc:       'button',
                id:        'btnNuevaEntrada',
                text:      'Agregar Entrada',
                color_btn: 'primary',
                class:     'col-12 col-md-3 col-lg-3',
                onClick:   () => entradasView.openEntradaForm()
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

    renderEntradaForm() {
        this.entradaFormApi = this.entradaForm({
            parent: 'body',
            id:     'entradaFormModal',
            json:   SAMPLE_ENTRADAS_CATALOGO,
            data: {
                origenes:        SAMPLE_ENTRADAS_ORIGENES.filter(o => o.id !== ''),
                sucursales:      SAMPLE_ENTRADAS_SUCURSALES.filter(s => s.id !== ''),
                fecha:           new Date().toISOString().slice(0, 10),
                subsidiaries_id: app.subId
            },
            onAdd: (payload) => {
                // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:{ opc:'saveEntrada', ...payload } })
                console.log('[entradaForm] onAdd', payload);

                const nextNum    = Object.keys(SAMPLE_ENTRADAS_DB).length + 1;
                const nuevoFolio = 'ENT-' + String(89 + nextNum).padStart(3, '0');

                SAMPLE_ENTRADAS_DB[nuevoFolio] = {
                    folio:      nuevoFolio,
                    origen:     payload.origen,
                    sucursal:   payload.sucursal,
                    sucursalId: payload.sucursalId || app.subId || 'kafeto',
                    registrado: 'Admin',
                    fechaIso:   `${payload.fecha}T${new Date().toTimeString().slice(0, 8)}`,
                    estado:     'Aplicada',
                    nota:       payload.nota,
                    productos:  payload.productos
                };
                SAMPLE_ENTRADAS_TABLE.row.unshift(_entradaRow(SAMPLE_ENTRADAS_DB[nuevoFolio]));

                entradas.lsEntradas();
                entradas.lsKpis();
            },
            onClose: () => console.log('[entradaForm] cerrado')
        });
    }

    openEntradaForm() {
        if (!this.entradaFormApi) this.renderEntradaForm();
        this.entradaFormApi.open();
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
            json:   { title: '', subtitle: '', toggles: [], back: null },
            classes: {
                title:    'text-base font-bold text-white',
                subtitle: 'text-[10px] text-[var(--cs-text-secondary,#D1D5DB)]',
                groupLbl: 'text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-bold',
                btn:      'demo-toggle px-2.5 py-1 rounded text-[11px] border border-[var(--cs-border,#374151)] text-[var(--cs-text-secondary,#D1D5DB)] hover:bg-[var(--cs-bg-input,#1F2937)] transition-colors',
                btnActive:'demo-toggle active px-2.5 py-1 rounded text-[11px] border border-[var(--cs-accent-purple,#7C3AED)] bg-[var(--cs-accent-purple,#7C3AED)]/15 text-white',
                sep:      'text-[var(--cs-border,#374151)]',
                backBtn:  'w-8 h-8 rounded-full bg-[var(--cs-bg-input,#1F2937)] hover:bg-[var(--cs-accent-purple,#7C3AED)]/15 border border-[var(--cs-border,#374151)] hover:border-[var(--cs-accent-purple,#7C3AED)] flex items-center justify-center text-[var(--cs-text-secondary,#D1D5DB)] hover:text-white transition-colors flex-shrink-0'
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
                    <h1 class="${opts.classes.title}">${esc(opts.json.title)}</h1>
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
                const isActive  = $(this).attr('data-toggle-value') === val;
                this.className  = isActive ? opts.classes.btnActive : opts.classes.btn;
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
                <div class="px-3 py-3 border-b border-[var(--cs-border,#374151)] flex-shrink-0 flex items-center justify-between">
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

    entradaForm(options) {
        const defaults = {
            parent: 'body',
            id:     'entradaFormModal',
            class:  'hidden fixed inset-0 z-[100] flex items-center justify-center',
            json:   [],
            data: {
                origenes:        [],
                sucursales:      [],
                fecha:           '',
                subsidiaries_id: '',
                nota:            ''
            },
            labels: {
                title:        'Nueva Entrada de Stock',
                subtitle:     'Layout Compacto',
                origen:       'Origen',
                sucursal:     'Sucursal destino',
                fecha:        'Fecha',
                nota:         'Nota (opcional)',
                buscar:       'Buscar productos',
                placeholder:  'Nombre o SKU...',
                searchHint:   'Sin resultados',
                resumenLbl:   'Resumen del lote',
                productosLbl: 'Productos',
                unidadesLbl:  'Unidades',
                costoTotLbl:  'Costo total',
                emptyTitle:   'Aun no has agregado productos',
                emptyHint:    'Usa el buscador para empezar',
                limpiar:      'Limpiar',
                cancelar:     'Cancelar',
                registrar:    'Registrar Entrada',
                stockAuto:    'El stock se actualizara automaticamente',
                guardar:      'Guardar formato',
                cargar:       'Cargar formato',
                formatosTit:  'Formatos guardados',
                sinFormatos:  'No hay formatos guardados',
                promptName:   'Nombre del formato:',
                confirmDel:   'Eliminar este formato?',
                savedOk:      'Formato guardado',
                emptyLote:    'Agrega productos al lote antes de guardar'
            },
            onAdd:    () => {},
            onClose:  () => {},
            onSearch: null,
            onUpdate: () => {}
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.data   = Object.assign({}, defaults.data,   o.data   || {});
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        // -- Estado interno
        let lote = [];

        // -- Helpers
        const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
        const fmtMoney      = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const fmtMoneyShort = (n) => '$' + Number(n).toLocaleString('en-US');

        // -- Clases Tailwind reutilizables (diseno premium dark Huubie)
        const cls = {
            label:   'block text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1',
            input:   'w-full px-2.5 py-1.5 text-[11px] text-white bg-[#0f1825] border border-gray-700/60 rounded-md outline-none focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/15 hover:border-gray-600/80 transition-all placeholder:text-gray-600',
            select:  'w-full px-2.5 py-1.5 text-[11px] text-white bg-[#0f1825] border border-gray-700/60 rounded-md outline-none focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/15 hover:border-gray-600/80 transition-all cursor-pointer appearance-none bg-no-repeat bg-[length:14px_14px] bg-[right_8px_center] pr-7',
            search:  'w-full pl-8 pr-2.5 py-1.5 text-[11px] text-white bg-[#0f1825] border border-gray-700/60 rounded-md outline-none focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/15 hover:border-gray-600/80 transition-all placeholder:text-gray-600',
            qtyInp:  'w-full px-1.5 py-1 text-[11px] font-bold text-center text-white bg-[#0f1825] border border-gray-700/60 rounded outline-none focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/15 transition-all',
            cashInp: 'w-full pl-6 pr-1.5 py-1 text-[11px] text-white bg-[#0f1825] border border-gray-700/60 rounded outline-none focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/15 transition-all',
            btnOut:  'px-3 py-1.5 text-[11px] font-medium text-gray-300 bg-transparent border border-gray-700/60 rounded-md hover:bg-gray-700/30 hover:text-white hover:border-gray-600 transition-all',
            btnOk:   'px-3 py-1.5 text-[11px] font-bold text-white bg-gradient-to-r from-emerald-600 to-green-600 border border-emerald-500/40 rounded-md hover:from-emerald-500 hover:to-green-500 hover:shadow-lg hover:shadow-emerald-500/20 transition-all flex items-center gap-1.5',
            btnIco:  'px-2.5 py-1.5 text-[10px] font-medium text-gray-300 bg-[#0f1825] border border-gray-700/60 rounded-md hover:bg-purple-500/10 hover:text-white hover:border-purple-500/40 transition-all flex items-center gap-1.5',
            badge:   'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold leading-none'
        };

        // Caret SVG inline para selects (purple)
        const caretBg = "background-image: url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\");";

        // -- Sub-renderers
        const optionTag = (item, sel) => `<option value="${esc(item.id || item.valor)}"${sel === (item.id || item.valor) ? ' selected' : ''}>${esc(item.valor)}</option>`;

        const renderHeader = () => `
            <div class="flex items-center justify-between px-[18px] py-[14px] border-b border-gray-700/60 bg-[#141d2b] flex-shrink-0">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <i data-lucide="package-plus" class="w-5 h-5 text-white"></i>
                    </div>
                    <div>
                        <h3 class="text-sm font-bold text-white">${esc(opts.labels.title)}</h3>
                        <p class="text-[11px] text-gray-500">${esc(opts.labels.subtitle)}</p>
                    </div>
                </div>
                <button class="w-8 h-8 rounded-lg bg-[#1a2332] border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-500" data-modal-close>
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>`;

        const renderConfigRow = () => `
            <div class="px-5 pt-3 pb-3 border-b border-gray-800/70 bg-[#0f1825]/40">
                <div class="grid grid-cols-4 gap-3 items-end">
                    <div>
                        <label class="${cls.label}">${esc(opts.labels.origen)}</label>
                        <select id="${opts.id}_selOrigen" class="${cls.select}" style="${caretBg}">
                            ${(opts.data.origenes || []).map(it => optionTag(it)).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="${cls.label}">${esc(opts.labels.sucursal)}</label>
                        <select id="${opts.id}_selSucursal" class="${cls.select}" style="${caretBg}">
                            ${(opts.data.sucursales || []).map(it => optionTag(it, opts.data.subsidiaries_id)).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="${cls.label}">${esc(opts.labels.fecha)}</label>
                        <input id="${opts.id}_inpFecha" type="date" value="${esc(opts.data.fecha)}" class="${cls.input}">
                    </div>
                    <div>
                        <label class="${cls.label}">${esc(opts.labels.nota)}</label>
                        <input id="${opts.id}_inpNota" type="text" value="${esc(opts.data.nota)}" placeholder="Descripcion..." class="${cls.input}">
                    </div>
                </div>
            </div>`;

        const renderSearchPanel = () => `
            <div class="flex-shrink-0">
                <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">${esc(opts.labels.buscar)}</p>
                <div class="relative">
                    <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none flex items-center">
                        <i data-lucide="search" class="w-3.5 h-3.5"></i>
                    </span>
                    <input id="${opts.id}_buscarProducto" type="text" placeholder="${esc(opts.labels.placeholder)}" class="${cls.search}" autocomplete="off">
                </div>
            </div>
            <div id="${opts.id}_catalogoLista" class="flex-1 min-h-0 overflow-y-auto space-y-1 pr-1 -mr-1 cs-scroll bg-[#0f172a]/40 border border-gray-800/60 rounded-lg p-1.5"></div>`;

        const renderResumen = () => `
            <div class="flex-shrink-0 border-t border-gray-800/70 pt-2">
                <div class="flex items-center justify-between text-[10px] mb-1">
                    <span class="text-gray-500"><strong class="text-white" id="${opts.id}_qtyItems">0</strong> prod.</span>
                    <span class="text-gray-500"><strong class="text-white" id="${opts.id}_qtyUnits">0</strong> uds</span>
                </div>
                <div class="flex items-baseline justify-between pt-1 border-t border-gray-800/40">
                    <span class="text-[9px] uppercase tracking-wider text-gray-500">${esc(opts.labels.costoTotLbl)}</span>
                    <span class="text-green-400 font-bold text-[13px] leading-none" id="${opts.id}_qtyCost">$0.00</span>
                </div>
            </div>`;

        const renderLoteHeader = () => `
            <div class="px-4 py-2.5 border-b border-gray-800/70 flex items-center justify-between flex-shrink-0 bg-gradient-to-b from-[#0f1825]/60 to-transparent">
                <div class="flex items-center gap-2">
                    <div class="w-6 h-6 rounded-md bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
                        <i data-lucide="boxes" class="w-3.5 h-3.5 text-purple-400"></i>
                    </div>
                    <p class="text-[10px] font-bold uppercase tracking-wider text-gray-300">${esc(opts.labels.productosLbl)}</p>
                    <span id="${opts.id}_cntProductos" class="${cls.badge} bg-gradient-to-br from-purple-500/25 to-fuchsia-500/15 text-purple-300 border border-purple-500/40">0</span>
                </div>
                <button id="${opts.id}_btnLimpiarLote" class="text-[10px] text-gray-500 hover:text-red-400 transition flex items-center gap-1 hidden px-2 py-1 rounded-md hover:bg-red-500/10">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>${esc(opts.labels.limpiar)}
                </button>
            </div>`;

        const renderFooter = () => `
            <div class="flex items-center justify-between px-[18px] py-3 border-t border-gray-700/60 bg-[#141d2b] flex-shrink-0">
                <div class="flex items-center gap-2 relative">
                    <button id="${opts.id}_btnSaveFormato" class="${cls.btnIco}" title="${esc(opts.labels.guardar)}">
                        <i data-lucide="bookmark-plus" class="w-3.5 h-3.5"></i><span>${esc(opts.labels.guardar)}</span>
                    </button>
                    <button id="${opts.id}_btnLoadFormato" class="${cls.btnIco}" title="${esc(opts.labels.cargar)}">
                        <i data-lucide="folder-open" class="w-3.5 h-3.5"></i><span>${esc(opts.labels.cargar)}</span>
                        <span id="${opts.id}_cntFormatos" class="${cls.badge} bg-purple-500/20 text-purple-300 border border-purple-500/30 ml-0.5 hidden">0</span>
                    </button>
                    <div id="${opts.id}_formatosDropdown" class="hidden absolute bottom-full left-0 mb-2 w-[280px] bg-[#0f172a] border border-gray-700/60 rounded-lg shadow-2xl shadow-black/60 overflow-hidden z-20">
                        <div class="px-3 py-2 border-b border-gray-800/70 bg-[#141d2b]/60 flex items-center justify-between">
                            <p class="text-[10px] font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                                <i data-lucide="layers" class="w-3 h-3 text-purple-400"></i>${esc(opts.labels.formatosTit)}
                            </p>
                            <button id="${opts.id}_btnCloseFormatos" class="text-gray-500 hover:text-white transition-colors">
                                <i data-lucide="x" class="w-3 h-3"></i>
                            </button>
                        </div>
                        <div id="${opts.id}_formatosLista" class="max-h-[260px] overflow-y-auto cs-scroll"></div>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button class="${cls.btnOut}" data-modal-close>${esc(opts.labels.cancelar)}</button>
                    <button id="${opts.id}_btnRegistrar" class="${cls.btnOk}">
                        <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i><span>${esc(opts.labels.registrar)}</span>
                    </button>
                </div>
            </div>`;

        const renderEmptyState = () => `
            <div class="flex flex-col items-center justify-center py-12 text-center">
                <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/5 border border-purple-500/25 flex items-center justify-center mb-3">
                    <i data-lucide="package-plus" class="w-8 h-8 text-purple-400/70"></i>
                </div>
                <p class="text-xs font-semibold text-gray-200">${esc(opts.labels.emptyTitle)}</p>
                <p class="text-[10px] text-gray-500 mt-1">${esc(opts.labels.emptyHint)}</p>
            </div>`;

        const renderProductRow = (p, i) => {
            const cant        = Number(p.cantidad || 0);
            const costoNum    = Number(p.costo || 0);
            const subtotal    = (cant * costoNum).toFixed(2);
            const subtotalFmt = Number(subtotal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const nuevoStock  = Number(p.stock || 0) + cant;
            const stockColor  = p.stock === 0 ? 'text-red-400' : p.stock < 5 ? 'text-orange-400' : 'text-green-400';
            return `
                <tr class="border-b border-gray-800/40 last:border-b-0 hover:bg-purple-500/5 transition-colors" data-idx="${i}">
                    <td class="px-3 py-2 align-middle">
                        <div class="flex items-center gap-2 min-w-0">
                            <div class="w-7 h-7 rounded-lg ${esc(p.bg)} flex items-center justify-center flex-shrink-0 ring-1 ring-white/5">
                                <i data-lucide="${esc(p.icon)}" class="w-3.5 h-3.5 ${esc(p.color)}"></i>
                            </div>
                            <div class="min-w-0">
                                <p class="text-[11px] font-semibold text-white truncate leading-tight">${esc(p.nombre)}</p>
                                <div class="flex items-center gap-1.5 mt-0.5">
                                    <span class="text-[9px] text-gray-500 font-mono">${esc(p.sku)}</span>
                                    <span class="text-gray-700">.</span>
                                    <span class="text-[9px] text-gray-400">Stock <strong class="${stockColor}">${p.stock || 0}</strong> <span class="text-gray-600">&rarr;</span> <strong class="text-green-400">${nuevoStock}</strong></span>
                                </div>
                            </div>
                        </div>
                    </td>
                    <td class="px-2 py-2 align-middle w-20">
                        <input type="number" min="1" value="${cant}" class="${cls.qtyInp}" data-field="cantidad" data-idx="${i}">
                    </td>
                    <td class="px-2 py-2 align-middle w-28">
                        <div class="relative">
                            <span class="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none flex items-center">
                                <i data-lucide="dollar-sign" class="w-3 h-3"></i>
                            </span>
                            <input type="number" min="0" step="0.01" value="${costoNum}" class="${cls.cashInp}" data-field="costo" data-idx="${i}">
                        </div>
                    </td>
                    <td class="px-2 py-2 align-middle text-right w-24">
                        <span class="text-green-400 font-bold text-[12px]">$${subtotalFmt}</span>
                    </td>
                    <td class="px-2 py-2 align-middle text-center w-10">
                        <button class="w-6 h-6 rounded-md inline-flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/15 transition-colors" data-remove="${i}" title="Eliminar">
                            <i data-lucide="x" class="w-3 h-3"></i>
                        </button>
                    </td>
                </tr>`;
        };

        const renderProductsTable = () => `
            <table class="w-full border-collapse">
                <thead class="sticky top-0 z-10 bg-[#0f1825] border-b border-gray-700/60">
                    <tr>
                        <th class="text-left px-3 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-bold">Producto</th>
                        <th class="text-center px-2 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-bold w-20">Cant.</th>
                        <th class="text-left px-2 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-bold w-28">Costo</th>
                        <th class="text-right px-2 py-2 text-[9px] uppercase tracking-wider text-gray-500 font-bold w-24">Subtotal</th>
                        <th class="w-10 px-2 py-2"></th>
                    </tr>
                </thead>
                <tbody>${lote.map((p, i) => renderProductRow(p, i)).join('')}</tbody>
            </table>`;

        const renderSearchResult = (p) => {
            const stockColor = p.stock === 0 ? 'text-red-400' : p.stock < 5 ? 'text-orange-400' : 'text-green-400';
            const stockBg    = p.stock === 0 ? 'bg-red-500/10' : p.stock < 5 ? 'bg-orange-500/10' : 'bg-green-500/10';
            return `
                <div class="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-transparent border-b border-gray-800/40 last:border-b-0 transition-all group" data-add-sku="${esc(p.sku)}">
                    <div class="w-8 h-8 rounded-lg ${esc(p.bg)} flex items-center justify-center flex-shrink-0 ring-1 ring-white/5">
                        <i data-lucide="${esc(p.icon)}" class="w-4 h-4 ${esc(p.color)}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-[11px] font-semibold text-white truncate">${esc(p.nombre)}</p>
                        <div class="flex items-center gap-1.5 mt-0.5">
                            <span class="text-[9px] text-gray-500 font-mono">${esc(p.sku)}</span>
                            <span class="text-[9px] px-1.5 py-0.5 rounded ${stockBg} ${stockColor} font-bold">Stock ${p.stock || 0}</span>
                        </div>
                    </div>
                    <div class="w-7 h-7 rounded-lg bg-purple-600/15 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0 group-hover:bg-purple-600 group-hover:text-white group-hover:border-purple-500 transition-all">
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                    </div>
                </div>`;
        };

        const updateTotals = () => {
            const totalItems = lote.length;
            const totalUds   = lote.reduce((s, p) => s + Number(p.cantidad || 0), 0);
            const totalCosto = lote.reduce((s, p) => s + Number(p.cantidad || 0) * Number(p.costo || 0), 0);
            $(`#${opts.id}_qtyItems`).text(totalItems);
            $(`#${opts.id}_qtyUnits`).text(totalUds);
            $(`#${opts.id}_qtyCost`).text(fmtMoney(totalCosto));
            $(`#${opts.id}_cntProductos`).text(totalItems);
        };

        let currentSearchTerm = '';

        const renderCatalogo = () => {
            const $cat = $(`#${opts.id}_catalogoLista`);
            const term = (currentSearchTerm || '').toLowerCase();
            const items = (opts.json || [])
                .filter(p => !lote.some(x => x.sku === p.sku))
                .filter(p => !term || (p.nombre || '').toLowerCase().includes(term) || (p.sku || '').toLowerCase().includes(term));

            if (!items.length) {
                $cat.html(`
                    <div class="flex flex-col items-center justify-center py-8 text-center px-2">
                        <div class="w-10 h-10 rounded-lg bg-gray-800/40 border border-gray-700/50 flex items-center justify-center mb-2">
                            <i data-lucide="search-x" class="w-5 h-5 text-gray-600"></i>
                        </div>
                        <p class="text-[10px] text-gray-500">${term ? esc(opts.labels.searchHint) : 'Sin productos disponibles'}</p>
                    </div>`);
            } else {
                $cat.html(items.map(renderSearchResult).join(''));
            }
            if (window.lucide) lucide.createIcons();
        };

        const renderLote = () => {
            const $lista   = $(`#${opts.id}_listaProductos`);
            const $limpiar = $(`#${opts.id}_btnLimpiarLote`);
            if (!lote.length) {
                $lista.html(renderEmptyState()).removeClass('p-0').addClass('px-3 py-3');
                $limpiar.addClass('hidden');
            } else {
                $lista.html(renderProductsTable()).removeClass('px-3 py-3').addClass('p-0');
                $limpiar.removeClass('hidden');
            }
            updateTotals();
            renderCatalogo();
            if (window.lucide) lucide.createIcons();
        };

        // -- Construccion ROOT
        const wrap = $('<div>', { id: opts.id, class: opts.class });
        wrap.html(`
            <div class="absolute inset-0 bg-black/60" data-modal-close></div>
            <div class="relative z-10 w-full max-w-[960px] max-h-[90vh] mx-3 bg-[#111928] border border-gray-700/60 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col">
                ${renderHeader()}
                <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
                    ${renderConfigRow()}
                    <div class="flex flex-1 min-h-0">
                        <div class="w-[300px] border-r border-gray-800/70 flex flex-col flex-shrink-0 p-2.5 gap-2 overflow-hidden">
                            ${renderSearchPanel()}
                            ${renderResumen()}
                        </div>
                        <div class="flex-1 flex flex-col min-w-0 min-h-0">
                            ${renderLoteHeader()}
                            <div id="${opts.id}_listaProductos" class="flex-1 overflow-y-auto cs-scroll px-3 py-3"></div>
                        </div>
                    </div>
                </div>
                ${renderFooter()}
            </div>
        `);

        // -- Mount: append en parent o body
        const $target = opts.parent === 'body' || !$(`#${opts.parent}`).length ? $('body') : $(`#${opts.parent}`);
        // Remueve cualquier instancia previa con el mismo id
        $(`#${opts.id}`).remove();
        $target.append(wrap);

        // -- Funciones internas (closures)
        function doSearch(q) {
            currentSearchTerm = (q || '').trim();
            if (typeof opts.onSearch === 'function') {
                // MODO BACKEND: opts.onSearch(term, callback) — reemplaza opts.json y re-renderiza
                opts.onSearch(currentSearchTerm, (matches) => {
                    opts.json = matches || [];
                    renderCatalogo();
                });
            } else {
                renderCatalogo();
            }
        }

        function addProducto(sku) {
            const prod = (opts.json || []).find(p => p.sku === sku);
            if (!prod) return;
            lote.push(Object.assign({}, prod, { cantidad: 1 }));
            renderLote();
        }

        function removeProducto(i) {
            lote.splice(i, 1);
            renderLote();
        }

        function updateField($el) {
            const idx   = Number($el.data('idx'));
            const field = $el.data('field');
            if (isNaN(idx) || !lote[idx] || !field) return;
            lote[idx][field] = $el.val();
            if (field === 'cantidad' || field === 'costo') renderLote();
        }

        function clearLote() {
            if (!lote.length) return;
            if (confirm('Eliminar todos los productos del lote?')) {
                lote = [];
                renderLote();
            }
        }

        function closeModal() {
            wrap.addClass('hidden');
            lote = [];
            renderLote();
            opts.onClose();
        }

        // -- Formatos preguardados (localStorage en modo FAKE)
        const FORMATOS_KEY = 'huubie_entradaFormatos';

        function loadFormatos() {
            // MODO FAKE: si hubiera backend -> useFetch({ data:{ opc:'lsFormatos' } })
            try {
                return JSON.parse(localStorage.getItem(FORMATOS_KEY) || '[]');
            } catch (e) {
                return [];
            }
        }

        function persistFormatos(arr) {
            // MODO FAKE: si hubiera backend -> useFetch({ data:{ opc:'saveFormatos', formatos:arr } })
            localStorage.setItem(FORMATOS_KEY, JSON.stringify(arr));
        }

        function saveFormato() {
            if (!lote.length) { alert(opts.labels.emptyLote); return; }
            const name = (prompt(opts.labels.promptName, '') || '').trim();
            if (!name) return;
            const formatos = loadFormatos();
            formatos.unshift({
                id:        Date.now(),
                name:      name,
                productos: lote.map(p => Object.assign({}, p)),
                createdAt: new Date().toISOString()
            });
            persistFormatos(formatos);
            renderFormatosBadge();
            renderFormatosLista();
        }

        function applyFormato(id) {
            const formatos = loadFormatos();
            const f = formatos.find(x => x.id === id);
            if (!f) return;
            lote = f.productos.map(p => Object.assign({}, p));
            $(`#${opts.id}_formatosDropdown`).addClass('hidden');
            renderLote();
        }

        function deleteFormato(id) {
            if (!confirm(opts.labels.confirmDel)) return;
            const formatos = loadFormatos().filter(x => x.id !== id);
            persistFormatos(formatos);
            renderFormatosBadge();
            renderFormatosLista();
        }

        function renderFormatosBadge() {
            const count = loadFormatos().length;
            const $b = $(`#${opts.id}_cntFormatos`);
            if (count > 0) $b.text(count).removeClass('hidden');
            else           $b.addClass('hidden');
        }

        function renderFormatosLista() {
            const $lista = $(`#${opts.id}_formatosLista`);
            const formatos = loadFormatos();
            if (!formatos.length) {
                $lista.html(`
                    <div class="flex flex-col items-center justify-center py-6 px-3 text-center">
                        <div class="w-10 h-10 rounded-lg bg-gray-800/40 border border-gray-700/50 flex items-center justify-center mb-2">
                            <i data-lucide="inbox" class="w-5 h-5 text-gray-600"></i>
                        </div>
                        <p class="text-[10px] text-gray-500">${esc(opts.labels.sinFormatos)}</p>
                    </div>`);
            } else {
                $lista.html(formatos.map(f => {
                    const uds = (f.productos || []).reduce((s, p) => s + Number(p.cantidad || 0), 0);
                    const tot = (f.productos || []).reduce((s, p) => s + Number(p.cantidad || 0) * Number(p.costo || 0), 0);
                    return `
                        <div class="group flex items-center gap-2 px-3 py-2 border-b border-gray-800/40 last:border-b-0 hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-transparent transition-all cursor-pointer" data-apply-id="${f.id}">
                            <div class="w-7 h-7 rounded-md bg-purple-500/15 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                                <i data-lucide="bookmark" class="w-3.5 h-3.5 text-purple-300"></i>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-[11px] font-semibold text-white truncate">${esc(f.name)}</p>
                                <p class="text-[9px] text-gray-500">${f.productos.length} prod. . ${uds} uds . ${fmtMoneyShort(tot)}</p>
                            </div>
                            <button class="w-6 h-6 rounded-md flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/15 flex-shrink-0 transition-colors" data-delete-id="${f.id}" title="${esc(opts.labels.confirmDel)}">
                                <i data-lucide="trash-2" class="w-3 h-3"></i>
                            </button>
                        </div>`;
                }).join(''));
            }
            if (window.lucide) lucide.createIcons();
        }

        function toggleFormatosDropdown() {
            const $dd = $(`#${opts.id}_formatosDropdown`);
            if ($dd.hasClass('hidden')) {
                renderFormatosLista();
                $dd.removeClass('hidden');
            } else {
                $dd.addClass('hidden');
            }
        }

        function doRegistrar() {
            if (!lote.length) { alert('Agrega al menos un producto al lote'); return; }
            const payload = {
                origen:     $(`#${opts.id}_selOrigen`).val(),
                sucursal:   $(`#${opts.id}_selSucursal option:selected`).text(),
                sucursalId: $(`#${opts.id}_selSucursal`).val(),
                fecha:      $(`#${opts.id}_inpFecha`).val(),
                nota:       $(`#${opts.id}_inpNota`).val(),
                productos:  lote.map(p => ({
                    nombre: p.nombre, sku: p.sku, icon: p.icon, bg: p.bg, color: p.color,
                    cant:   Number(p.cantidad || 0),
                    costo:  Number(p.costo || 0),
                    stockPrev: Number(p.stock || 0)
                })),
                totalUds:   lote.reduce((s, p) => s + Number(p.cantidad || 0), 0),
                totalCosto: lote.reduce((s, p) => s + Number(p.cantidad || 0) * Number(p.costo || 0), 0)
            };
            opts.onAdd(payload);
            closeModal();
        }

        // -- Bindings
        wrap.on('click', '[data-modal-close]',                    () => closeModal());
        wrap.on('input', `#${opts.id}_buscarProducto`,            (e) => doSearch(e.target.value));
        wrap.on('click', '[data-add-sku]',                        (e) => addProducto($(e.currentTarget).attr('data-add-sku')));
        wrap.on('click', '[data-remove]',                         (e) => removeProducto(Number($(e.currentTarget).attr('data-remove'))));
        wrap.on('input', 'input[data-field]',                     (e) => updateField($(e.currentTarget)));
        wrap.on('click', `#${opts.id}_btnLimpiarLote`,            () => clearLote());
        wrap.on('click', `#${opts.id}_btnRegistrar`,              () => doRegistrar());
        wrap.on('click', `#${opts.id}_btnSaveFormato`,            () => saveFormato());
        wrap.on('click', `#${opts.id}_btnLoadFormato`,            (e) => { e.stopPropagation(); toggleFormatosDropdown(); });
        wrap.on('click', `#${opts.id}_btnCloseFormatos`,          () => $(`#${opts.id}_formatosDropdown`).addClass('hidden'));
        wrap.on('click', '[data-apply-id]',                       (e) => {
            if ($(e.target).closest('[data-delete-id]').length) return;
            applyFormato(Number($(e.currentTarget).attr('data-apply-id')));
        });
        wrap.on('click', '[data-delete-id]',                      (e) => {
            e.stopPropagation();
            deleteFormato(Number($(e.currentTarget).attr('data-delete-id')));
        });

        // Cerrar dropdown al click fuera
        wrap.on('click', (e) => {
            const $dd = $(`#${opts.id}_formatosDropdown`);
            if (!$dd.hasClass('hidden') && !$(e.target).closest(`#${opts.id}_formatosDropdown, #${opts.id}_btnLoadFormato`).length) {
                $dd.addClass('hidden');
            }
        });

        $(document).off('keydown.entradaForm').on('keydown.entradaForm', (e) => {
            if (e.key === 'Escape' && !wrap.hasClass('hidden')) closeModal();
        });

        // -- Render inicial
        renderLote();
        renderFormatosBadge();

        // -- API publica
        return {
            open: () => {
                wrap.removeClass('hidden');
                if (window.lucide) lucide.createIcons();
            },
            close: () => closeModal(),
            setData: (newData) => {
                Object.assign(opts.data, newData || {});
                if (newData && 'fecha' in newData)           $(`#${opts.id}_inpFecha`).val(newData.fecha);
                if (newData && 'subsidiaries_id' in newData) $(`#${opts.id}_selSucursal`).val(newData.subsidiaries_id);
                if (newData && 'nota' in newData)            $(`#${opts.id}_inpNota`).val(newData.nota);
            }
        };
    }
}
