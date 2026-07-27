let api = 'ctrl/ctrl-facturador-resumen.php';
let app, resumen, resumenView;

let turno, subsidiaries_id;

window.updateSession = () => { };


$(async () => {
    resumenView = new ResumenView(api, 'root');
    resumen     = new Resumen(api, 'root');
    app         = new App(api, 'root');
    await app.init();
});

// -- Clase principal --

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'FacturadorResumen';
        this.subId        = null;
        this.seleccion    = [];
    }

    async init() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:{ opc:'init' } })
        this.dataInit = {
            subsidiaries_id: '',
            periodos:        SAMPLE_RESUMEN_PERIODOS,
            metas:           SAMPLE_RESUMEN_METAS,
            dia:             '2026-06-10'
        };
        this.subId      = this.dataInit.subsidiaries_id;
        subsidiaries_id = this.subId;
        this.seleccion  = SAMPLE_RESUMEN_PRESELECCION.slice();

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        resumenView.renderHeader(SAMPLE_VIEW_HEADER_RESUMEN);
        resumenView.renderFooter(SAMPLE_VIEW_FOOTER_RESUMEN);
        resumenView.renderPanelHeads();
        resumen.lsKpis();
        resumen.lsTodos();
        resumen.lsPendientes();
        resumen.lsFacturados();
        resumen.refreshTotales();
    }

    // -- Layout --

    layout() {
        this.primaryLayout({
            parent: 'root',
            id:     this.PROJECT_NAME,
            class:  'flex mx-2 ',
            heightPreset: 'full',
            card: {
                filterBar: { class: 'w-full ', id: 'filterBar' },
                container: { class: 'w-full my-2 h-screen rounded p-3 overflow-auto', id: 'container' + this.PROJECT_NAME }
            }
        });

        $('#filterBar').html(`
            <div id="filterBar${this.PROJECT_NAME}" class="w-full my-3 " ></div>
            <div id="containerHours"></div>
        `);

        this.dashboardLayout();
        this.panelsLayout();
    }

    dashboardLayout() {
        this.createLayout({
            parent: `container${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:        `dash${this.PROJECT_NAME}`,
                class:     'w-full flex flex-col gap-4',
                container: [
                    {
                        type:  'div',
                        id:    `viewHeader${this.PROJECT_NAME}`,
                        class: 'w-full flex items-center justify-between'
                    },
                    {
                        type:  'div',
                        id:    `kpisRow${this.PROJECT_NAME}`,
                        class: 'w-full'
                    },
                    {
                        type:  'div',
                        id:    `progress${this.PROJECT_NAME}`,
                        class: 'card-base p-4 w-full'
                    },
                    {
                        type:  'div',
                        id:    `panels${this.PROJECT_NAME}`,
                        class: 'w-full'
                    },
                    {
                        type:  'div',
                        id:    `viewFooter${this.PROJECT_NAME}`,
                        class: 'w-full flex items-center justify-between pt-1'
                    }
                ]
            }
        });
    }

    panelsLayout() {
        const panel = (key, maxH) => ({
            type:  'div',
            id:    `card${key}${this.PROJECT_NAME}`,
            class: 'card-base overflow-hidden flex flex-col',
            children: [
                {
                    id:    `head${key}${this.PROJECT_NAME}`,
                    class: 'px-4 py-3 border-b border-ink-100 flex items-center justify-between'
                },
                {
                    id:    `table${key}${this.PROJECT_NAME}`,
                    class: `overflow-auto scroll-thin ${maxH}`
                },
                {
                    id:    `foot${key}${this.PROJECT_NAME}`,
                    class: 'px-4 py-3 border-t border-ink-100 mt-auto'
                }
            ]
        });

        this.createLayout({
            parent: `panels${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:        `panelsGrid${this.PROJECT_NAME}`,
                class:     'w-full grid grid-cols-1 xl:grid-cols-3 gap-4',
                container: [
                    panel('Todos',      'max-h-72'),
                    panel('Pendientes', 'max-h-56'),
                    panel('Facturados', 'max-h-72')
                ]
            }
        });
    }

    // -- Filter bar --

    filterBar() {
        const filters = [
            {
                opc:      'input',
                id:       'fDia',
                lbl:      'Dia:',
                type:     'date',
                class:    'col-12 col-md-4 col-lg-2',
                value:    this.dataInit.dia,
                required: false,
                onchange: 'app.onChangeFilters()'
            },
            {
                opc:      'select',
                id:       'fPeriodo',
                lbl:      'Periodo:',
                class:    'col-12 col-md-4 col-lg-2',
                value:    '2026-06',
                required: false,
                onchange: 'app.onChangeFilters()',
                data:     this.dataInit.periodos
            },
            {
                opc:      'select',
                id:       'fMeta',
                lbl:      'Meta de facturacion:',
                class:    'col-12 col-md-4 col-lg-2',
                value:    '0.70',
                required: false,
                onchange: 'app.onChangeFilters()',
                data:     this.dataInit.metas
            },
            {
                opc:       'button',
                id:        'btnRecalcular',
                text:      'Recalcular',
                icon:      'icon-arrows-cw',
                color_btn: 'primary',
                className: 'btn-primary',
                class:     'col-12 col-md-6 col-lg-2',
                onClick:   () => this.recalcular()
            },
            {
                opc:       'button',
                id:        'btnEnviarFacturar',
                text:      'Enviar a facturar',
                icon:      'icon-paper-plane',
                color_btn: 'success',
                class:     'col-12 col-md-6 col-lg-2',
                onClick:   () => resumen.sendToInvoice()
            }
        ];

        this.createfilterBar({
            parent:     `filterBar${this.PROJECT_NAME}`,
            id:         `frmFilter${this.PROJECT_NAME}`,
            coffeesoft: true,
            theme:      'light',
            data:       filters
        });
    }

    getFilters() {
        return {
            subsidiaries_id: this.subId || '',
            dia:             $('#fDia').val()     || this.dataInit.dia,
            periodo:         $('#fPeriodo').val() || '',
            meta:            parseFloat($('#fMeta').val() || '0.70')
        };
    }

    // -- Event handlers --

    onChangeFilters() {
        resumen.lsKpis();
        resumen.lsTodos();
        resumen.lsPendientes();
        resumen.lsFacturados();
        resumen.refreshTotales();
        resumenView.renderHeader(SAMPLE_VIEW_HEADER_RESUMEN);
    }

    onTogglePendiente(input) {
        const id = $(input).attr('data-id');
        if (input.checked) {
            if (this.seleccion.indexOf(id) === -1) this.seleccion.push(id);
        } else {
            this.seleccion = this.seleccion.filter(x => x !== id);
        }
        resumen.refreshTotales();
    }

    recalcular() {
        resumen.lsKpis();
        resumen.refreshTotales();
        if (typeof alert === 'function') alert({ icon: 'success', text: 'Indicadores recalculados' });
    }

    updateFooterInfo(text) {
        $(`#ftr${this.PROJECT_NAME}_info`).text(text);
    }

    // -- Facade --

    getSeleccion() {
        return this.seleccion.slice();
    }
}

// -- Resumen --

class Resumen extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'FacturadorResumen';
    }

    // -- Data --

    getRegistros() {
        const f = app.getFilters();
        return Object.values(SAMPLE_RESUMEN_DB).filter(e => !f.dia || e.fecha === f.dia);
    }

    lsTodos() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:Object.assign({ opc:'lsTodos' }, app.getFilters()) })
        const rows = this.getRegistros().map(_resumenRowTodos);

        this.createCoffeeTable3({
            parent:       `tableTodos${this.PROJECT_NAME}`,
            id:           `tbTodos${this.PROJECT_NAME}`,
            theme:        'light',
            center:       [2],
            right:        [4],
            extends:      true,
            scrollable:   false,
            f_size:       11,
            color_th:     'bg-ink-50 text-ink-500',
            border_table: 'border-0',
            border_row:   'border-b border-ink-100',
            class:        'w-full text-sm text-ink-600',
            emptyMessage: 'Sin pagos registrados en el dia seleccionado',
            emptyIcon:    'icon-doc-text',
            data:         { row: rows }
        });

        app.updateFooterInfo(`Mostrando ${rows.length} pago${rows.length !== 1 ? 's' : ''} del dia`);
    }

    lsPendientes() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:Object.assign({ opc:'lsPendientes' }, app.getFilters()) })
        const seleccion = app.getSeleccion();
        const rows = this.getRegistros()
            .filter(e => e.fiscal === 'pending' && e.metodo !== 'Efectivo')
            .map(e => _resumenRowPendiente(e, seleccion.indexOf(e.id) !== -1));

        this.createCoffeeTable3({
            parent:       `tablePendientes${this.PROJECT_NAME}`,
            id:           `tbPendientes${this.PROJECT_NAME}`,
            theme:        'light',
            center:       [1, 3],
            right:        [4],
            extends:      true,
            scrollable:   false,
            f_size:       11,
            color_th:     'bg-ink-50 text-ink-500',
            border_table: 'border-0',
            border_row:   'border-b border-ink-100',
            class:        'w-full text-sm text-ink-600',
            emptyMessage: 'No hay tickets pendientes con tarjeta',
            emptyIcon:    'icon-clock',
            data:         { row: rows }
        });
    }

    lsFacturados() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:Object.assign({ opc:'lsFacturados' }, app.getFilters()) })
        const rows = this.getRegistros()
            .filter(e => e.fiscal === 'invoiced')
            .map(_resumenRowFacturado);

        this.createCoffeeTable3({
            parent:       `tableFacturados${this.PROJECT_NAME}`,
            id:           `tbFacturados${this.PROJECT_NAME}`,
            theme:        'light',
            center:       [2, 3],
            right:        [4],
            extends:      true,
            scrollable:   false,
            f_size:       11,
            color_th:     'bg-ink-50 text-ink-500',
            border_table: 'border-0',
            border_row:   'border-b border-ink-100',
            class:        'w-full text-sm text-ink-600',
            emptyMessage: 'Aun no hay tickets facturados',
            emptyIcon:    'icon-lock',
            data:         { row: rows }
        });
    }

    lsKpis() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:Object.assign({ opc:'showKpis' }, app.getFilters()) })
        const t = this.getTotales();

        resumenView.renderInfoCards([
            {
                id:          'kpiTotal',
                title:       'Venta total',
                lucideIcon:  'banknote',
                bgColor:     'bg-white',
                borderColor: 'border-ink-200',
                data: {
                    value:    _fmtMX(t.total),
                    subtitle: `${t.tickets} tickets · efectivo + tarjeta`,
                    color:    'text-ink-900'
                }
            },
            {
                id:          'kpiMeta',
                title:       `Meta al ${Math.round(t.meta * 100)}%`,
                lucideIcon:  'target',
                bgColor:     'bg-white',
                borderColor: 'border-ink-200',
                data: {
                    value:    _fmtMX(t.objetivo),
                    subtitle: 'monto objetivo al 16%',
                    color:    'text-ink-900'
                }
            },
            {
                id:          'kpiFacturado',
                title:       'Ya facturado',
                lucideIcon:  'lock',
                bgColor:     'bg-white',
                borderColor: 'border-ink-200',
                data: {
                    value:    _fmtMX(t.facturado),
                    subtitle: `${t.bloqueados} ordenes bloqueadas`,
                    color:    'text-green-700'
                }
            },
            {
                id:          'kpiPorFacturar',
                title:       'Por facturar',
                lucideIcon:  'alert-circle',
                bgColor:     'bg-white',
                borderColor: 'border-ink-200',
                data: {
                    value:    _fmtMX(t.porFacturar),
                    subtitle: 'meta menos facturado',
                    color:    'text-brand-600'
                }
            }
        ]);
    }

    getTotales() {
        const f          = app.getFilters();
        const registros  = this.getRegistros();
        const total      = registros.reduce((s, e) => s + Number(e.total || 0), 0);
        const facturados = registros.filter(e => e.fiscal === 'invoiced');
        const facturado  = facturados.reduce((s, e) => s + Number(e.total || 0), 0);
        const objetivo   = total * f.meta;
        const seleccion  = app.getSeleccion();
        const sumaSel    = registros
            .filter(e => seleccion.indexOf(e.id) !== -1)
            .reduce((s, e) => s + Number(e.total || 0), 0);

        return {
            tickets:     registros.length,
            meta:        f.meta,
            total:       total,
            objetivo:    objetivo,
            facturado:   facturado,
            bloqueados:  facturados.length,
            porFacturar: Math.max(0, objetivo - facturado),
            avance:      objetivo > 0 ? (facturado / objetivo) * 100 : 0,
            sumaSel:     sumaSel,
            restante:    Math.max(0, objetivo - facturado - sumaSel)
        };
    }

    refreshTotales() {
        const t = this.getTotales();

        resumenView.renderProgress({
            label:      'Avance de la meta de facturacion',
            percent:    t.avance,
            leftText:   `${_fmtMX(t.facturado)} facturado`,
            rightText:  `objetivo ${_fmtMX(t.objetivo)}`
        });

        resumenView.renderPanelFoots(t);
    }

    // -- Actions --

    sendToInvoice() {
        const seleccion = app.getSeleccion();
        if (!seleccion.length) {
            if (typeof alert === 'function') alert({ icon: 'info', text: 'Selecciona al menos un ticket por facturar' });
            return;
        }

        // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:{ opc:'sendToInvoice', ids:JSON.stringify(seleccion) } })
        this.swalQuestion({
            extends: true,
            opts: {
                title:             'Enviar a facturar',
                text:              `Se enviaran ${seleccion.length} tickets al portal de facturacion.`,
                icon:              'question',
                confirmButtonText: 'Si, enviar',
                cancelButtonText:  'No'
            }
        }).then((result) => {
            if (!result.isConfirmed) return;
            if (typeof alert === 'function') alert({ icon: 'success', text: `${seleccion.length} tickets enviados al portal` });
        });
    }
}

// -- Vista --

class ResumenView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'FacturadorResumen';
    }

    // -- Render helpers --

    renderHeader(data) {
        const f = app.getFilters();
        this.viewHeader({
            parent:   `viewHeader${this.PROJECT_NAME}`,
            id:       `hdr${this.PROJECT_NAME}`,
            classes:  SAMPLE_RESUMEN_HEADER_CLASSES,
            json:     Object.assign({}, data, { title: `${data.title} · ${_fmtFechaLarga(f.dia)}` }),
            onToggle: (key, value) => console.log('[viewHeader] toggle', key, '->', value)
        });
    }

    renderFooter(data) {
        this.viewFooter({
            parent:  `viewFooter${this.PROJECT_NAME}`,
            id:      `ftr${this.PROJECT_NAME}`,
            classes: SAMPLE_RESUMEN_FOOTER_CLASSES,
            tones:   SAMPLE_RESUMEN_FOOTER_TONES,
            json:    data
        });
    }

    renderInfoCards(rows) {
        this.infoCard({
            parent: `kpisRow${this.PROJECT_NAME}`,
            id:     `kpis${this.PROJECT_NAME}`,
            theme:  'light',
            style:  'file',
            cols:   4,
            json:   rows
        });
    }

    renderPanelHeads() {
        this.panelHead({
            parent: `headTodos${this.PROJECT_NAME}`,
            json: {
                icon:  'sigma',
                title: 'Acumulado total real',
                badge: { text: 'todos los pagos', tone: 'b-gray' }
            }
        });

        this.panelHead({
            parent: `headPendientes${this.PROJECT_NAME}`,
            json: {
                icon:      'file-clock',
                iconClass: 'w-4 h-4 text-amber-500',
                title:     'Por facturar',
                badge:     { text: 'solo tarjeta', tone: 'b-yellow' }
            }
        });

        this.panelHead({
            parent: `headFacturados${this.PROJECT_NAME}`,
            json: {
                icon:      'lock',
                iconClass: 'w-4 h-4 text-green-600',
                title:     'Facturados',
                badge:     { text: 'bloqueados', tone: 'b-green' }
            }
        });
    }

    renderPanelFoots(t) {
        this.panelFoot({
            parent: `footTodos${this.PROJECT_NAME}`,
            class:  'flex items-center justify-between',
            json:   [{ label: 'Total del dia', value: _fmtMX(t.total) }]
        });

        this.panelFoot({
            parent: `footPendientes${this.PROJECT_NAME}`,
            class:  'flex flex-col gap-1',
            json: [
                { label: 'Suma seleccionada', value: _fmtMX(t.sumaSel),  valueClass: 'font-bold text-brand-600' },
                { label: 'Objetivo restante', value: _fmtMX(t.restante), labelClass: 'text-[10px] text-ink-500', valueClass: 'text-[10px] text-ink-500' }
            ]
        });

        this.panelFoot({
            parent: `footFacturados${this.PROJECT_NAME}`,
            class:  'flex items-center justify-between',
            json:   [{ label: 'Monto facturado', value: _fmtMX(t.facturado), valueClass: 'font-semibold text-green-700' }]
        });
    }

    renderProgress(data) {
        this.progressBar({
            parent: `progress${this.PROJECT_NAME}`,
            id:     `prog${this.PROJECT_NAME}`,
            json:   data
        });
    }

    // -- Components --

    panelHead(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'flex items-center justify-between w-full',
            json:   { icon: '', iconClass: 'w-4 h-4 text-ink-400', title: '', badge: null },
            classes: {
                title: 'text-[12px] font-bold text-ink-800 flex items-center gap-2'
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

    panelFoot(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'flex items-center justify-between w-full',
            json:   [],
            classes: {
                row:   'flex items-center justify-between w-full',
                label: 'text-[11px] font-semibold text-ink-600',
                value: 'text-[11px] font-semibold text-ink-900'
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html((opts.json || []).map(r => `
            <div class="${opts.classes.row}">
                <span class="${r.labelClass || opts.classes.label}">${esc(r.label)}</span>
                <span class="${r.valueClass || opts.classes.value}">${esc(r.value)}</span>
            </div>
        `).join(''));

        $(`#${opts.parent}`).html(wrap);
    }

    progressBar(options) {
        const defaults = {
            parent: 'root',
            id:     'progressBar',
            class:  'w-full',
            json:   { label: '', percent: 0, leftText: '', rightText: '' },
            classes: {
                label:   'text-[11px] font-semibold text-ink-700',
                percent: 'text-[11px] font-bold text-brand-600',
                caption: 'flex justify-between mt-2 text-[10px] text-ink-400'
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const pct = Math.max(0, Math.min(100, Number(opts.json.percent || 0)));

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html(`
            <div class="flex items-center justify-between mb-2">
                <span class="${opts.classes.label}">${esc(opts.json.label)}</span>
                <span class="${opts.classes.percent}">${pct.toFixed(1)}%</span>
            </div>
            <div class="prog-track"><div class="prog-fill" style="width:${pct}%"></div></div>
            <div class="${opts.classes.caption}">
                <span>${esc(opts.json.leftText)}</span>
                <span>${esc(opts.json.rightText)}</span>
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
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

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
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

        const toneColor  = (tone) => opts.tones[tone] || opts.tones.default;
        const legendItem = (lg) => `
            <span class="${opts.classes.item}">
                <span class="w-2 h-2 rounded-full" style="background:${toneColor(lg.tone)};"></span>
                ${esc(lg.label)}
            </span>
        `;

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        const legendsHtml = (opts.json.legends || []).map(legendItem).join('');

        wrap.html(`
            <p id="${opts.id}_info" class="${opts.classes.info}">${esc(opts.json.info)}</p>
            <div class="${opts.classes.legend}">${legendsHtml}</div>
        `);

        $(`#${opts.parent}`).html(wrap);
    }
}
