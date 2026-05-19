let api = 'ctrl/ctrl-inventarios-ajustes.php';
let app, ajustes, ajustesView;

let turno, subsidiaries_id;

window.updateSession = () => { };


$(async () => {
    ajustesView = new AjustesView(api, 'root');
    ajustes     = new Ajustes(api, 'root');
    app         = new App(api, 'root');
    await app.init();
});


class App extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'InventariosAjustes';
        this.subId        = null;
        this.selectedId   = null;
    }

    async init() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:{ opc:'init' } })
        this.dataInit = {
            subsidiaries_id: '',
            sucursales:  SAMPLE_AJUSTES_SUCURSALES,
            motivos:     SAMPLE_AJUSTES_MOTIVOS,
            estados:     SAMPLE_AJUSTES_ESTADOS,
            tipos:       SAMPLE_AJUSTES_TIPOS
        };
        this.subId      = this.dataInit.subsidiaries_id;
        subsidiaries_id = this.subId;

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        ajustesView.renderHeader(SAMPLE_VIEW_HEADER_AJUSTES);
        ajustesView.renderFooter(SAMPLE_VIEW_FOOTER_AJUSTES);
        ajustesView.renderDetail(null);
        ajustesView.renderAjusteForm();
        this.populateFilters();
        ajustes.lsAjustes();
        ajustes.lsKpis();
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
                id:       'fMotivo',
                lbl:      'Motivo:',
                class:    'col-12 col-md-3 col-lg-3',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     SAMPLE_AJUSTES_MOTIVOS
            },
            {
                opc:      'select',
                id:       'fEstado',
                lbl:      'Estado:',
                class:    'col-12 col-md-3 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     SAMPLE_AJUSTES_ESTADOS
            },
            {
                opc:        'input',
                id:         'qBuscar',
                lbl:        'Buscar:',
                class:      'col-12 col-md-3 col-lg-3',
                placeholder:'Folio, producto, autorizo...',
                onkeyup:    'app.onChangeFilters()'
            },
            {
                opc:       'button',
                id:        'btnNuevoAjuste',
                text:      'Nuevo Ajuste',
                color_btn: ' bg-purple-600 text-white hover:bg-purple-800',
                class:     'col-12 col-md-3 col-lg-2',
                onClick:   () => ajustesView.openAjusteForm()
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
            motivo:          $('#fMotivo').val()        || '',
            estado:          $('#fEstado').val()        || '',
            q:               $('#qBuscar').val()        || ''
        };
    }

    // -- Event handlers --

    async onChangeFilters() {
        ajustes.lsAjustes();
        await ajustes.lsKpis();

        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectAjuste(null);
        }
    }

    onChangeSucursal() {
        ajustes.lsAjustes();
        ajustes.lsKpis();
        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectAjuste(null);
        }
    }

    isVisibleAfterFilters(folio) {
        const e   = SAMPLE_AJUSTES_DB[folio];
        if (!e) return false;
        const f   = this.getFilters();
        const suc = !f.subsidiaries_id || e.sucursalId === f.subsidiaries_id;
        const mot = !f.motivo          || e.motivo     === f.motivo;
        const est = !f.estado          || e.estado     === f.estado;
        const q   = !f.q || (e.folio + ' ' + e.producto + ' ' + (e.autorizo || ''))
                                .toLowerCase()
                                .includes(f.q.toLowerCase());
        return suc && mot && est && q;
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }

    // -- Facade --

    selectAjuste(folio) {
        this.selectedId = folio;
        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');
        if (folio) {
            const $row = $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
                return $(this).text().includes(folio);
            });
            $row.addClass('row-active');
        }
        ajustesView.renderDetail(folio ? SAMPLE_AJUSTES_DB[folio] : null);
    }

    editAjuste(folio) {
        console.log('[editAjuste]', folio);
        this.selectAjuste(folio);
    }

    renderDetail(ajuste) {
        ajustesView.renderDetail(ajuste);
    }
}


class Ajustes extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'InventariosAjustes';
    }

    // -- Data --

    lsAjustes() {
        // MODO FAKE: si hubiera backend -> useFetch({ data:Object.assign({ opc:'lsAjustes' }, app.getFilters()) })
        const f = app.getFilters();
        const filteredRows = (SAMPLE_AJUSTES_TABLE.row || []).filter(r => {
            const e = SAMPLE_AJUSTES_DB[r.id];
            if (!e) return true;
            const suc = !f.subsidiaries_id || e.sucursalId === f.subsidiaries_id;
            const mot = !f.motivo          || e.motivo     === f.motivo;
            const est = !f.estado          || e.estado     === f.estado;
            const q   = !f.q || (e.folio + ' ' + e.producto + ' ' + (e.autorizo || ''))
                                    .toLowerCase()
                                    .includes(f.q.toLowerCase());
            return suc && mot && est && q;
        });

        const data = { row: filteredRows };

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'dark',
            title:        '',
            subtitle:     '',
            center:       [2, 3, 4],
            right:        [5],
            extends:      true,
            scrollable:   false,
            f_size:       12,
            emptyMessage: 'No se encontraron ajustes con los filtros aplicados',
            emptyIcon:    'icon-sliders-horizontal',
            data:         data
        });

        if (window.lucide) lucide.createIcons();

        const total = filteredRows.length;
        app.updateFooterInfo(`Mostrando ${total} ajuste${total !== 1 ? 's' : ''}`);
    }

    async lsKpis() {
        // MODO FAKE: si hubiera backend -> useFetch({ data:Object.assign({ opc:'showKpis' }, app.getFilters()) })
        const f = app.getFilters();
        const visible = Object.values(SAMPLE_AJUSTES_DB).filter(e => {
            const suc = !f.subsidiaries_id || e.sucursalId === f.subsidiaries_id;
            const mot = !f.motivo          || e.motivo     === f.motivo;
            const est = !f.estado          || e.estado     === f.estado;
            const q   = !f.q || (e.folio + ' ' + e.producto + ' ' + (e.autorizo || ''))
                                    .toLowerCase()
                                    .includes(f.q.toLowerCase());
            return suc && mot && est && q;
        });

        const diferenciaTot = visible.reduce((s, e) => s + Number(e.costoDif || 0), 0);
        const fisicos       = visible.filter(e => e.tipo === 'fisico');
        const ultimoFisico  = fisicos.length
            ? new Date(fisicos[0].fechaIso)
            : (visible.length ? new Date(visible[0].fechaIso) : new Date());
        const ultimoInv     = `${String(ultimoFisico.getDate()).padStart(2,'0')} ${_MON_ES[ultimoFisico.getMonth()]}`;

        const diferenciaTxt = diferenciaTot === 0
            ? '$0'
            : (diferenciaTot > 0 ? '+' : '-') + '$' + Math.abs(diferenciaTot).toLocaleString('en-US');
        const diferenciaTone = diferenciaTot === 0 ? 'default' : (diferenciaTot > 0 ? 'success' : 'danger');

        const kpis = [
            { id: 'kpiAjustesMes', label: 'Ajustes Mes', value: SAMPLE_AJUSTES_COUNTS.ajustesMes,  tone: 'purple'        },
            { id: 'kpiDiferencia', label: 'Diferencia',  value: diferenciaTxt,                     tone: diferenciaTone  },
            { id: 'kpiUltimoInv',  label: 'Ultimo Inv.', value: ultimoInv,                         tone: 'info'          },
            { id: 'kpiPrecision',  label: 'Precision',   value: SAMPLE_AJUSTES_COUNTS.precision,   tone: 'success'       }
        ];
        ajustesView.renderInfoCards(kpis);
    }

    async getAjuste(folio) {
        // MODO FAKE: si hubiera backend -> useFetch({ data:{ opc:'getAjuste', folio } })
        ajustesView.renderDetail(SAMPLE_AJUSTES_DB[folio] || null);
    }

    // -- Actions --

    viewAjuste(folio) {
        console.log('[viewAjuste]', folio);
        app.selectAjuste(folio);
    }

    saveAjuste(payload) {
        // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:{ opc:'saveAjuste', ...payload } })
        console.log('[saveAjuste]', payload);
        const nextNum    = Object.keys(SAMPLE_AJUSTES_DB).length + 1;
        const nuevoFolio = 'AJU-' + String(42 + nextNum).padStart(3, '0');

        SAMPLE_AJUSTES_DB[nuevoFolio] = Object.assign({
            folio:      nuevoFolio,
            tipo:       payload.tipo || 'individual',
            sucursal:   payload.sucursal,
            sucursalId: payload.sucursalId || app.subId || 'kafeto',
            registrado: 'Admin',
            autorizo:   'Admin',
            fechaIso:   `${payload.fecha}T${new Date().toTimeString().slice(0, 8)}`,
            estado:     'Aplicado'
        }, payload);

        SAMPLE_AJUSTES_TABLE.row.unshift(_ajusteRow(SAMPLE_AJUSTES_DB[nuevoFolio]));

        this.lsAjustes();
        this.lsKpis();
    }
}


class AjustesView extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'InventariosAjustes';
    }

    // -- Render helpers --

    renderDetail(ajuste) {
        this.ajusteDetailPanel({
            parent:  'detailPanel',
            json:    ajuste,
            onClose: () => {
                app.selectedId = null;
                this.renderDetail(null);
                $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');
            },
            onPrint:   (e) => console.log('[ajuste] imprimir', e && e.folio),
            onReverse: (e) => console.log('[ajuste] reversar', e && e.folio)
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

    renderAjusteForm() {
        this.ajusteFormApi = this.ajusteForm({
            parent: 'body',
            id:     'ajusteFormModal',
            json:   SAMPLE_AJUSTES_CATALOGO,
            data: {
                motivos:         SAMPLE_AJUSTES_MOTIVOS.filter(o => o.id !== ''),
                sucursales:      SAMPLE_AJUSTES_SUCURSALES.filter(s => s.id !== ''),
                fecha:           new Date().toISOString().slice(0, 10),
                subsidiaries_id: app.subId
            },
            onAdd: (payload) => {
                ajustes.saveAjuste(payload);
            },
            onClose: () => console.log('[ajusteForm] cerrado')
        });
    }

    openAjusteForm() {
        if (!this.ajusteFormApi) this.renderAjusteForm();
        this.ajusteFormApi.open();
    }

    // -- Components (PORTADOS 1:1 desde pos-entradas.js — viven aqui porque NO estan en Templates) --

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

    ajusteDetailPanel(options) {
        const defaults = {
            parent:    'root',
            id:        'ajusteDetailPanel',
            class:     'w-full h-full flex-shrink-0 bg-[var(--cs-bg-header,#141d2b)] border-l border-[var(--cs-border,#374151)] flex flex-col overflow-hidden',
            json:      null,
            labels: {
                emptyTitle:  'Selecciona un ajuste',
                emptyHint:   'Haz click en cualquier fila o en el icono ojo para ver el detalle aqui.',
                subtitleLbl: 'Detalle de ajuste',
                producto:    'Producto',
                sucursal:    'Sucursal',
                autorizo:    'Autorizo',
                sistema:     'Sistema',
                fisico:      'Fisico',
                diferencia:  'Diferencia',
                costoDif:    'Costo diferencia',
                motivo:      'Motivo',
                notaLbl:     'Observaciones',
                imprimir:    'Imprimir',
                reversar:    'Reversar'
            },
            estadoPalettes: {
                'Aplicado':  { bg: 'rgba(63,193,137,0.15)', fg: '#3FC189' },
                'Pendiente': { bg: 'rgba(251,191,36,0.15)', fg: '#FBBF24' },
                'Reversado': { bg: 'rgba(244,63,94,0.15)',  fg: '#F43F5E' }
            },
            motivoPalettes: {
                'Faltante sin explicar':    { bg: 'rgba(244,63,94,0.15)',  fg: '#F43F5E' },
                'Entrada no registrada':    { bg: 'rgba(63,193,137,0.15)', fg: '#3FC189' },
                'Entregados sin registrar': { bg: 'rgba(251,191,36,0.15)', fg: '#FBBF24' },
                'Cierre mensual':           { bg: 'rgba(124,58,237,0.15)', fg: '#A78BFA' },
                'Producto encontrado':      { bg: 'rgba(28,100,242,0.15)', fg: '#60A5FA' }
            },
            onClose:   () => { },
            onPrint:   () => { },
            onReverse: () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels         = Object.assign({}, defaults.labels,         o.labels         || {});
        opts.estadoPalettes = Object.assign({}, defaults.estadoPalettes, o.estadoPalettes || {});
        opts.motivoPalettes = Object.assign({}, defaults.motivoPalettes, o.motivoPalettes || {});

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
                        <h3 class="text-sm font-bold text-white">Vista del Ajuste</h3>
                        <p class="text-[10px] text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.subtitleLbl)}</p>
                    </div>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center text-center px-6">
                    <div class="w-14 h-14 rounded-full bg-[var(--cs-bg-input,#1F2937)] border border-[var(--cs-border,#374151)] flex items-center justify-center mb-3">
                        <i data-lucide="sliders-horizontal" class="w-6 h-6 text-[var(--cs-text-muted,#9CA3AF)]"></i>
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

        // -- Render con ajuste
        const e         = opts.json;
        const estadoC   = opts.estadoPalettes[e.estado] || { bg: 'rgba(63,193,137,0.15)',  fg: '#3FC189' };
        const motivoC   = opts.motivoPalettes[e.motivo] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF' };
        const folioCol  = e.tipo === 'fisico' ? 'text-yellow-400' : 'text-purple-400';
        const difColor  = Number(e.diferencia || 0) > 0 ? 'text-green-400' : (Number(e.diferencia || 0) < 0 ? 'text-red-400' : 'text-gray-400');
        const difSign   = Number(e.diferencia || 0) > 0 ? '+' : '';
        const costoColor= Number(e.costoDif || 0) > 0 ? 'text-green-400' : (Number(e.costoDif || 0) < 0 ? 'text-red-400' : 'text-gray-400');
        const costoSign = Number(e.costoDif || 0) > 0 ? '+' : (Number(e.costoDif || 0) < 0 ? '-' : '');
        const costoAbs  = Math.abs(Number(e.costoDif || 0)).toLocaleString('en-US');

        const estadoBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style="background:${estadoC.bg};color:${estadoC.fg};">${esc(e.estado)}</span>`;
        const motivoBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style="background:${motivoC.bg};color:${motivoC.fg};">${esc(e.motivo)}</span>`;

        // -- Card del producto
        const productoCard = e.tipo === 'fisico'
            ? `
                <div class="bg-[var(--cs-bg-input,#1F2937)] rounded-md p-3 border border-[var(--cs-border,#374151)]">
                    <div class="flex items-center gap-2">
                        <div class="w-9 h-9 rounded ${e.bg} flex items-center justify-center flex-shrink-0">
                            <i data-lucide="${e.icon}" class="w-4 h-4 ${e.color}"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-[12px] font-bold text-yellow-400 leading-tight">${esc(e.producto)}</p>
                            <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] leading-tight">${esc(e.productoNota || '')}</p>
                        </div>
                    </div>
                </div>
            `
            : `
                <div class="bg-[var(--cs-bg-input,#1F2937)] rounded-md p-3 border border-[var(--cs-border,#374151)]">
                    <div class="flex items-center gap-2">
                        <div class="w-9 h-9 rounded ${e.bg} flex items-center justify-center flex-shrink-0">
                            <i data-lucide="${e.icon}" class="w-4 h-4 ${e.color}"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-[12px] font-bold text-white leading-tight">${esc(e.producto)}</p>
                            <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] leading-tight">SKU: ${esc(e.sku || '-')}</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-[var(--cs-border,#374151)]">
                        <div>
                            <p class="text-[8px] text-[var(--cs-text-muted,#9CA3AF)] uppercase leading-none">${esc(opts.labels.sistema)}</p>
                            <p class="text-[12px] font-bold text-gray-400 leading-tight">${e.sistema}</p>
                        </div>
                        <div>
                            <p class="text-[8px] text-[var(--cs-text-muted,#9CA3AF)] uppercase leading-none">${esc(opts.labels.fisico)}</p>
                            <p class="text-[12px] font-bold text-white leading-tight">${e.fisico}</p>
                        </div>
                        <div>
                            <p class="text-[8px] text-[var(--cs-text-muted,#9CA3AF)] uppercase leading-none">${esc(opts.labels.diferencia)}</p>
                            <p class="text-[12px] font-bold ${difColor} leading-tight">${difSign}${e.diferencia}</p>
                        </div>
                    </div>
                </div>
            `;

        aside.html(`
            <div class="px-4 py-3 border-b border-[var(--cs-border,#374151)] flex-shrink-0 flex items-center justify-between">
                <div>
                    <h3 class="text-sm font-bold ${folioCol}">Ajuste ${esc(e.folio)}</h3>
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
                        <span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.motivo)}</span>
                        ${motivoBadge}
                    </div>
                    <div class="flex justify-between text-[11px]">
                        <span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.sucursal)}</span>
                        <span class="text-white">${esc(e.sucursal || '-')}</span>
                    </div>
                    <div class="flex justify-between text-[11px]">
                        <span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.autorizo)}</span>
                        <span class="text-white">${esc(e.autorizo || '-')}</span>
                    </div>
                    <div class="flex justify-between text-[11px]">
                        <span class="text-[var(--cs-text-muted,#9CA3AF)]">${esc(opts.labels.costoDif)}</span>
                        <span class="font-bold ${costoColor}">${costoSign}$${costoAbs}</span>
                    </div>
                </div>

                <!-- Detalle del producto -->
                <div>
                    <p class="text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider mb-2">${esc(opts.labels.producto)}</p>
                    ${productoCard}
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

    ajusteForm(options) {
        const defaults = {
            parent: 'body',
            id:     'ajusteFormModal',
            class:  'hidden fixed inset-0 z-[100] flex items-center justify-center',
            json:   [],
            data: {
                motivos:         [],
                sucursales:      [],
                fecha:           '',
                subsidiaries_id: '',
                nota:            ''
            },
            labels: {
                title:        'Nuevo Ajuste de Inventario',
                subtitle:     'Corregir stock del sistema vs conteo fisico',
                tipo:         'Tipo de ajuste',
                tipoInd:      'Individual',
                tipoFis:      'Inventario completo',
                producto:     'Producto',
                sucursal:     'Sucursal',
                fecha:        'Fecha',
                sistema:      'Sistema',
                fisico:       'Fisico',
                diferencia:   'Diferencia',
                motivo:       'Motivo',
                nota:         'Observaciones',
                placeholder:  'Seleccionar producto...',
                cancelar:     'Cancelar',
                aplicar:      'Aplicar Ajuste',
                requiereAuto: 'Requiere autorizacion',
                requiereHint: 'Ajustes negativos mayores a 2 unidades requieren aprobacion admin.',
                auditoria:    'Registrado en auditoria'
            },
            onAdd:    () => {},
            onClose:  () => {}
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.data   = Object.assign({}, defaults.data,   o.data   || {});
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        // -- Estado interno
        let tipoSel    = 'individual';
        let prodSel    = null;
        let fisicoVal  = 0;

        // -- Helpers
        const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
        const fmtMoney = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // -- Clases Tailwind reutilizables (diseno Huubie dark)
        const cls = {
            label:   'block text-[9px] font-semibold uppercase tracking-wider text-gray-400 mb-1',
            input:   'w-full px-2.5 py-1.5 text-[11px] text-white bg-[#0f1825] border border-gray-700/60 rounded-md outline-none focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/15 hover:border-gray-600/80 transition-all placeholder:text-gray-600',
            select:  'w-full px-2.5 py-1.5 text-[11px] text-white bg-[#0f1825] border border-gray-700/60 rounded-md outline-none focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/15 hover:border-gray-600/80 transition-all cursor-pointer appearance-none bg-no-repeat bg-[length:14px_14px] bg-[right_8px_center] pr-7',
            inputPurple: 'w-full px-2.5 py-1.5 text-[11px] font-bold text-white bg-[#0f1825] border-2 border-purple-500/50 rounded-md outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/15 transition-all',
            textarea:'w-full px-2.5 py-1.5 text-[11px] text-white bg-[#0f1825] border border-gray-700/60 rounded-md outline-none focus:border-purple-500/70 focus:ring-2 focus:ring-purple-500/15 transition-all',
            btnOut:  'px-3 py-1.5 text-[11px] font-medium text-gray-300 bg-transparent border border-gray-700/60 rounded-md hover:bg-gray-700/30 hover:text-white hover:border-gray-600 transition-all',
            btnOk:   'px-4 py-1.5 text-[11px] font-bold text-white bg-purple-600 border border-purple-500 rounded-md hover:bg-purple-500 hover:shadow-lg hover:shadow-purple-500/20 transition-all flex items-center gap-1.5',
            tipoBtn: 'px-3 py-1.5 text-[11px] font-medium text-gray-300 bg-[#0f1825] border border-gray-700/60 rounded-md hover:bg-purple-500/10 hover:text-white hover:border-purple-500/40 transition-all',
            tipoAct: 'px-3 py-1.5 text-[11px] font-bold text-white bg-purple-600 border border-purple-500 rounded-md shadow-lg shadow-purple-500/20 transition-all'
        };

        const caretBg = "background-image: url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239CA3AF' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\");";

        const optionTag = (item, sel) => `<option value="${esc(item.id || item.valor)}"${sel === (item.id || item.valor) ? ' selected' : ''}>${esc(item.valor)}</option>`;

        // -- Sub-renderers
        const renderHeader = () => `
            <div class="flex items-center justify-between px-[18px] py-[14px] border-b border-gray-700/60 bg-[#141d2b] flex-shrink-0">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <i data-lucide="sliders-horizontal" class="w-5 h-5 text-white"></i>
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

        const renderProductoCard = () => {
            if (!prodSel) return '';
            return `
                <div class="bg-[#1a2332] rounded-lg p-3 border border-[#374151]">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded ${esc(prodSel.bg)} flex items-center justify-center">
                            <i data-lucide="${esc(prodSel.icon)}" class="w-5 h-5 ${esc(prodSel.color)}"></i>
                        </div>
                        <div>
                            <p class="text-xs font-bold text-white">${esc(prodSel.nombre)}</p>
                            <p class="text-[9px] text-gray-500">SKU: ${esc(prodSel.sku)}</p>
                        </div>
                    </div>
                </div>
            `;
        };

        const renderDiferenciaCallout = () => {
            const sistema   = prodSel ? Number(prodSel.stock) : 0;
            const diff      = Number(fisicoVal) - sistema;
            const costoUnit = prodSel ? Number(prodSel.costo) : 0;
            const costoDif  = diff * costoUnit;
            const tone      = diff > 0 ? 'green' : diff < 0 ? 'red' : 'gray';
            const sign      = diff > 0 ? '+' : '';
            const costoSign = costoDif > 0 ? '+' : costoDif < 0 ? '-' : '';
            const costoAbs  = Math.abs(costoDif).toFixed(2);
            const label     = diff > 0 ? `Sobrante ${Math.abs(diff)} uds` : diff < 0 ? `Faltante ${Math.abs(diff)} uds` : 'Sin diferencia';
            return `
                <div class="bg-${tone}-900/15 border border-${tone}-500/30 rounded-lg p-3">
                    <div class="flex items-center justify-between">
                        <div>
                            <strong class="block text-sm text-white mb-1">${esc(opts.labels.diferencia)}</strong>
                            <p class="text-xs text-gray-400">${label}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-lg font-extrabold text-${tone}-400">${sign}${diff}</p>
                            <p class="text-xs text-${tone}-400">${costoSign}$${costoAbs}</p>
                        </div>
                    </div>
                </div>
            `;
        };

        const renderBody = () => `
            <div class="px-5 py-4 space-y-3 overflow-y-auto cs-scroll flex-1 min-h-0">

                <div>
                    <label class="${cls.label}">${esc(opts.labels.tipo)}</label>
                    <div class="flex gap-2">
                        <button class="${tipoSel === 'individual' ? cls.tipoAct : cls.tipoBtn}" data-tipo="individual">${esc(opts.labels.tipoInd)}</button>
                        <button class="${tipoSel === 'fisico' ? cls.tipoAct : cls.tipoBtn}" data-tipo="fisico">${esc(opts.labels.tipoFis)}</button>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
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
                </div>

                <div>
                    <label class="${cls.label}">${esc(opts.labels.producto)}</label>
                    <select id="${opts.id}_selProducto" class="${cls.select}" style="${caretBg}">
                        <option value="">${esc(opts.labels.placeholder)}</option>
                        ${(opts.json || []).map(p => `<option value="${esc(p.sku)}">${esc(p.nombre)} (Stock: ${p.stock})</option>`).join('')}
                    </select>
                </div>

                <div id="${opts.id}_prodCard">${renderProductoCard()}</div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="${cls.label}">${esc(opts.labels.sistema)}</label>
                        <div class="w-full bg-gray-800/50 border border-[#374151] rounded-md px-2.5 py-1.5 text-[11px] text-gray-400 font-bold" id="${opts.id}_sistemaVal">${prodSel ? prodSel.stock : '-'}</div>
                        <p class="text-[8px] text-gray-600 mt-0.5">Solo lectura</p>
                    </div>
                    <div>
                        <label class="block text-[9px] font-semibold uppercase tracking-wider text-purple-400 mb-1">${esc(opts.labels.fisico)}</label>
                        <input id="${opts.id}_inpFisico" type="number" value="${fisicoVal}" class="${cls.inputPurple}">
                    </div>
                </div>

                <div id="${opts.id}_diffWrap">${renderDiferenciaCallout()}</div>

                <div>
                    <label class="${cls.label}">${esc(opts.labels.motivo)}</label>
                    <select id="${opts.id}_selMotivo" class="${cls.select}" style="${caretBg}">
                        ${(opts.data.motivos || []).map(it => optionTag(it)).join('')}
                    </select>
                </div>

                <div>
                    <label class="${cls.label}">${esc(opts.labels.nota)}</label>
                    <textarea id="${opts.id}_inpNota" rows="3" class="${cls.textarea}"></textarea>
                </div>

                <div class="bg-yellow-900/10 border border-yellow-500/30 rounded-lg p-3">
                    <strong class="block text-sm text-yellow-400 mb-1">${esc(opts.labels.requiereAuto)}</strong>
                    <p class="text-xs text-gray-400">${esc(opts.labels.requiereHint)}</p>
                </div>
            </div>`;

        const renderFooter = () => `
            <div class="px-[18px] py-3 border-t border-gray-700/60 bg-[#141d2b] flex-shrink-0">
                <div class="flex items-center justify-end gap-2">
                    <button class="${cls.btnOut}" data-modal-close>${esc(opts.labels.cancelar)}</button>
                    <button id="${opts.id}_btnAplicar" class="${cls.btnOk}">
                        <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
                        <span>${esc(opts.labels.aplicar)}</span>
                    </button>
                </div>
                <p class="text-[8px] text-gray-600 text-center mt-2">${esc(opts.labels.auditoria)}</p>
            </div>`;

        // -- Construccion ROOT
        const wrap = $('<div>', { id: opts.id, class: opts.class });
        wrap.html(`
            <div class="absolute inset-0 bg-black/60" data-modal-close></div>
            <div class="relative z-10 w-full max-w-[560px] max-h-[92vh] mx-3 bg-[#111928] border border-gray-700/60 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col">
                ${renderHeader()}
                ${renderBody()}
                ${renderFooter()}
            </div>
        `);

        // -- Mount
        const $target = opts.parent === 'body' || !$(`#${opts.parent}`).length ? $('body') : $(`#${opts.parent}`);
        $(`#${opts.id}`).remove();
        $target.append(wrap);

        // -- Funciones internas
        function refreshDiff() {
            $(`#${opts.id}_diffWrap`).html(renderDiferenciaCallout());
        }

        function refreshProductoCard() {
            $(`#${opts.id}_prodCard`).html(renderProductoCard());
            $(`#${opts.id}_sistemaVal`).text(prodSel ? prodSel.stock : '-');
            if (window.lucide) lucide.createIcons();
        }

        function selectTipo(tipo) {
            tipoSel = tipo;
            wrap.find('[data-tipo]').each(function () {
                const isActive = $(this).attr('data-tipo') === tipo;
                this.className = isActive ? cls.tipoAct : cls.tipoBtn;
            });
        }

        function selectProducto(sku) {
            prodSel   = (opts.json || []).find(p => p.sku === sku) || null;
            fisicoVal = prodSel ? prodSel.stock : 0;
            $(`#${opts.id}_inpFisico`).val(fisicoVal);
            refreshProductoCard();
            refreshDiff();
        }

        function closeModal() {
            wrap.addClass('hidden');
            tipoSel   = 'individual';
            prodSel   = null;
            fisicoVal = 0;
            opts.onClose();
        }

        function doAplicar() {
            if (!prodSel && tipoSel === 'individual') { alert('Selecciona un producto'); return; }
            const sistema   = prodSel ? Number(prodSel.stock) : 0;
            const diff      = Number(fisicoVal) - sistema;
            const costoUnit = prodSel ? Number(prodSel.costo) : 0;
            const costoDif  = diff * costoUnit;
            const payload = {
                tipo:       tipoSel,
                producto:   prodSel ? prodSel.nombre : 'INVENTARIO FISICO',
                sku:        prodSel ? prodSel.sku : '',
                icon:       prodSel ? prodSel.icon : 'clipboard-check',
                bg:         prodSel ? prodSel.bg : 'bg-purple-900/30',
                color:      prodSel ? prodSel.color : 'text-purple-400',
                sucursal:   $(`#${opts.id}_selSucursal option:selected`).text(),
                sucursalId: $(`#${opts.id}_selSucursal`).val(),
                fecha:      $(`#${opts.id}_inpFecha`).val(),
                sistema:    sistema,
                fisico:     Number(fisicoVal),
                diferencia: diff,
                costoUnit:  costoUnit,
                costoDif:   costoDif,
                motivo:     $(`#${opts.id}_selMotivo`).val(),
                nota:       $(`#${opts.id}_inpNota`).val()
            };
            opts.onAdd(payload);
            closeModal();
        }

        // -- Bindings
        wrap.on('click', '[data-modal-close]',          () => closeModal());
        wrap.on('click', '[data-tipo]',                 (e) => selectTipo($(e.currentTarget).attr('data-tipo')));
        wrap.on('change', `#${opts.id}_selProducto`,    (e) => selectProducto(e.target.value));
        wrap.on('input',  `#${opts.id}_inpFisico`,      (e) => { fisicoVal = e.target.value; refreshDiff(); });
        wrap.on('click',  `#${opts.id}_btnAplicar`,     () => doAplicar());

        $(document).off('keydown.ajusteForm').on('keydown.ajusteForm', (e) => {
            if (e.key === 'Escape' && !wrap.hasClass('hidden')) closeModal();
        });

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
            }
        };
    }
}
