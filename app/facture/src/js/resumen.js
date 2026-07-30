let apiResumen = '/app/facture/ctrl/ctrl-facture-resumen.php';
let app, resumen, resumenView;

$(async () => {
    resumenView = new ResumenView(apiResumen, 'root');
    resumen     = new Resumen(apiResumen, 'root');
    app         = new App(apiResumen, 'root');
    await app.init();
});

// -- Clase principal --

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'resumen';
        this.seleccion    = [];
    }

    async init() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiResumen, data:{ opc:'init' } })
        this.dataInit = {
            periodos: SAMPLE_RESUMEN_PERIODOS,
            metas:    SAMPLE_RESUMEN_METAS,
            dia:      this.getDiaFromUrl() || '2026-06-10'
        };
        this.seleccion = SAMPLE_RESUMEN_PRESELECCION.slice();

        this.render();
    }

    getDiaFromUrl() {
        return new URLSearchParams(window.location.search).get('dia') || '';
    }

    render() {
        this.layout();
        this.filterBar();
        resumenView.renderFooter(SAMPLE_VIEW_FOOTER_RESUMEN);
        resumenView.renderPanelHeads();
        this.updateHeaderTitle();
        resumen.lsKpis();
        resumen.lsTodos();
        resumen.lsPendientes();
        resumen.lsFacturados();
        resumen.refreshTotales();
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
                    class: 'flex items-center justify-between px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'filterBar',
                    class: 'px-3 pt-3 bg-[#0E1521] flex-shrink-0'
                },
                {
                    id:    'kpisRow',
                    class: 'px-3 pt-1 pb-4 bg-[#0E1521] flex-shrink-0'
                },
                {
                    id:    'progressRow',
                    class: 'px-4 py-3 bg-[#141d2b] flex-shrink-0'
                },
                {
                    id:    'tableWrap',
                    class: 'p-3 flex-1 min-h-0 overflow-auto'
                },
                {
                    id:    'viewFooterRow',
                    class: 'flex items-center justify-between px-4 py-2 bg-[#0E1521] flex-shrink-0'
                }
            ]
        };

        // createLayout solo itera children en type 'div': para un aside caen en el
        // default y jQuery los toma como metodo. Las zonas del panel se arman aparte.
        const detailPanel = {
            type:  'aside',
            id:    'detailPanel',
            class: 'w-full md:w-[420px] flex-shrink-0 bg-[#141d2b] border-t md:border-t-0 md:border-l border-[#374151] flex flex-col overflow-hidden'
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
                        class: 'px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex items-center justify-between flex-shrink-0'
                    },
                    {
                        type:  'div',
                        id:    'detailContent',
                        class: 'flex-1 min-h-0 overflow-auto scroll-thin px-3 py-2'
                    },
                    {
                        type:  'div',
                        id:    'detailFoot',
                        class: 'px-4 py-3 bg-[#0E1521] flex-shrink-0'
                    }
                ]
            }
        });

        this.panelsLayout();
    }

    // Dos tarjetas dentro del area scrolleable: acumulado del dia y facturados.
    // El panel de pendientes vive en el aside porque es la zona de trabajo.
    panelsLayout() {
        const panel = (key, maxH) => ({
            type:  'div',
            id:    `card${key}`,
            class: 'bg-[#1F2A37] rounded-lg overflow-hidden flex flex-col',
            children: [
                {
                    id:    `head${key}`,
                    class: 'px-4 py-3 flex items-center justify-between'
                },
                {
                    id:    `table${key}`,
                    class: `overflow-auto scroll-thin ${maxH}`
                },
                {
                    id:    `foot${key}`,
                    class: 'px-4 py-3 mt-auto'
                }
            ]
        });

        this.createLayout({
            parent: 'tableWrap',
            design: false,
            data: {
                id:        'panelsGrid',
                class:     'w-full grid grid-cols-1 xl:grid-cols-2 gap-4',
                container: [
                    panel('Todos',      'max-h-80'),
                    panel('Facturados', 'max-h-80')
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
                class:    'col-12 col-md-4 col-lg-3',
                value:    this.dataInit.dia,
                required: false,
                onchange: 'app.onChangeFilters()'
            },
            {
                opc:      'select',
                id:       'fPeriodo',
                lbl:      'Periodo:',
                class:    'col-12 col-md-4 col-lg-3',
                value:    '2026-06',
                required: false,
                onchange: 'app.onChangeFilters()',
                data:     this.dataInit.periodos
            },
            {
                opc:      'select',
                id:       'fMeta',
                lbl:      'Meta de facturacion:',
                class:    'col-12 col-md-4 col-lg-3',
                value:    '0.70',
                required: false,
                onchange: 'app.onChangeFilters()',
                data:     this.dataInit.metas
            },
            {
                opc:       'button',
                id:        'btnRecalcular',
                text:      'Recalcular',
                color_btn: 'secondary',
                class:     'col-12 col-md-4 col-lg-3',
                onClick:   () => this.recalcular()
            }
        ];

        this.createfilterBar({
            parent:     'filterBar',
            coffeesoft: true,
            theme:      FACTURE_THEME,
            data:       filters
        });
    }

    getFilters() {
        return {
            dia:     $('#fDia').val()     || this.dataInit.dia,
            periodo: $('#fPeriodo').val() || '',
            meta:    parseFloat($('#fMeta').val() || '0.70')
        };
    }

    // -- Event handlers --

    onChangeFilters() {
        this.updateHeaderTitle();
        resumen.lsKpis();
        resumen.lsTodos();
        resumen.lsPendientes();
        resumen.lsFacturados();
        resumen.refreshTotales();
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
        this.alertBox({ type: 'success', title: 'Indicadores recalculados', timer: 1600 });
    }

    updateHeaderTitle() {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const f         = this.getFilters();
        const titleHtml = `${SAMPLE_VIEW_HEADER_RESUMEN.title} <span class="font-bold" style="color:#1C64F2;">&middot; ${esc(_fmtFechaLarga(f.dia))}</span>`;

        resumenView.renderHeader(Object.assign({}, SAMPLE_VIEW_HEADER_RESUMEN, { titleHtml }));
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
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
        this.PROJECT_NAME = 'resumen';
    }

    // -- Data --

    getRegistros() {
        const f = app.getFilters();
        return Object.values(SAMPLE_RESUMEN_DB).filter(e => !f.dia || e.fecha === f.dia);
    }

    lsTodos() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiResumen, data:Object.assign({ opc:'lsTodos' }, app.getFilters()) })
        const rows = this.getRegistros().map(_resumenRowTodos);

        this.createCoffeeTable3({
            parent:       'tableTodos',
            id:           'tbTodos',
            theme:        FACTURE_THEME,
            center:       [2],
            right:        [4],
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       11,
            border_table: 'border-0',
            emptyMessage: 'Sin pagos registrados en el dia seleccionado',
            emptyIcon:    'ic-file-text',
            data:         { row: rows }
        });

        app.updateFooterInfo(`Mostrando ${rows.length} pago${rows.length !== 1 ? 's' : ''} del dia`);
    }

    lsPendientes() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiResumen, data:Object.assign({ opc:'lsPendientes' }, app.getFilters()) })
        const seleccion = app.getSeleccion();
        const rows = this.getRegistros()
            .filter(e => e.fiscal === 'pending' && e.metodo !== 'Efectivo')
            .map(e => _resumenRowPendiente(e, seleccion.indexOf(e.id) !== -1));

        this.createCoffeeTable3({
            parent:       'detailContent',
            id:           'tbPendientes',
            theme:        FACTURE_THEME,
            center:       [1, 3],
            right:        [4],
            extends:      true,
            scrollable:   false,
            f_size:       11,
            border_table: 'border-0',
            emptyMessage: 'No hay tickets pendientes con tarjeta',
            emptyIcon:    'ic-clock',
            data:         { row: rows }
        });
    }

    lsFacturados() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiResumen, data:Object.assign({ opc:'lsFacturados' }, app.getFilters()) })
        const rows = this.getRegistros()
            .filter(e => e.fiscal === 'invoiced')
            .map(_resumenRowFacturado);

        this.createCoffeeTable3({
            parent:       'tableFacturados',
            id:           'tbFacturados',
            theme:        FACTURE_THEME,
            center:       [2, 3],
            right:        [4],
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       11,
            border_table: 'border-0',
            emptyMessage: 'Aun no hay tickets facturados',
            emptyIcon:    'ic-lock',
            data:         { row: rows }
        });
    }

    lsKpis() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiResumen, data:Object.assign({ opc:'showKpis' }, app.getFilters()) })
        const t = this.getTotales();

        resumenView.renderInfoCards([
            {
                id:          'kpiTotal',
                title:       'Venta total',
                lucideIcon:  'banknote',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value:    _fmtMX(t.total),
                    subtitle: `${t.tickets} tickets · efectivo + tarjeta`,
                    color:    'text-white'
                }
            },
            {
                id:          'kpiMeta',
                title:       `Meta al ${Math.round(t.meta * 100)}%`,
                lucideIcon:  'target',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value:    _fmtMX(t.objetivo),
                    subtitle: 'monto objetivo al 16%',
                    color:    'text-white'
                }
            },
            {
                id:          'kpiFacturado',
                title:       'Ya facturado',
                lucideIcon:  'lock',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value:    _fmtMX(t.facturado),
                    subtitle: `${t.bloqueados} ordenes bloqueadas`,
                    color:    'text-green-600'
                }
            },
            {
                id:          'kpiPorFacturar',
                title:       'Por facturar',
                lucideIcon:  'alert-circle',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value:    _fmtMX(t.porFacturar),
                    subtitle: 'meta menos facturado',
                    color:    'text-[#1C64F2]'
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
            label:     'Avance de la meta de facturacion',
            percent:   t.avance,
            leftText:  `${_fmtMX(t.facturado)} facturado`,
            rightText: `objetivo ${_fmtMX(t.objetivo)}`
        });

        resumenView.renderPanelFoots(t);
    }

    // -- Actions --

    sendToInvoice() {
        const seleccion = app.getSeleccion();
        if (!seleccion.length) {
            this.alertBox({ type: 'message', title: 'Selecciona al menos un ticket por facturar' });
            return;
        }

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
            // MODO FAKE: si hubiera backend -> useFetch({ url:apiResumen, data:{ opc:'sendToInvoice', ids:JSON.stringify(seleccion) } })
            seleccion.forEach((id, idx) => {
                const e = SAMPLE_RESUMEN_DB[id];
                if (e) {
                    e.fiscal  = 'invoiced';
                    e.factura = 'A' + (200 + idx);
                }
            });
            app.seleccion = [];

            this.lsTodos();
            this.lsPendientes();
            this.lsFacturados();
            this.lsKpis();
            this.refreshTotales();

            this.alertBox({ type: 'success', title: `${seleccion.length} tickets enviados al portal`, timer: 1600 });
        });
    }
}

// -- Vista --

class ResumenView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'resumen';
    }

    // -- Render helpers --

    renderHeader(data) {
        this.viewHeader({
            parent: 'viewHeader',
            id:     'hdrResumen',
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

    renderInfoCards(rows) {
        this.infoCard({
            parent: 'kpisRow',
            id:     'kpisResumen',
            theme:  FACTURE_THEME,
            style:  'file',
            cols:   4,
            json:   rows
        });
    }

    renderPanelHeads() {
        this.panelHead({
            parent: 'headTodos',
            json: {
                icon:  'sigma',
                title: 'Acumulado total real',
                badge: { text: 'todos los pagos', tone: 'b-gray' }
            }
        });

        this.panelHead({
            parent: 'headFacturados',
            json: {
                icon:      'lock',
                iconClass: 'w-4 h-4 text-green-600',
                title:     'Facturados',
                badge:     { text: 'bloqueados', tone: 'b-green' }
            }
        });

        this.panelHead({
            parent: 'detailHead',
            json: {
                icon:      'file-clock',
                iconClass: 'w-4 h-4 text-amber-500',
                title:     'Por facturar',
                badge:     { text: 'solo tarjeta', tone: 'b-yellow' }
            }
        });
    }

    renderPanelFoots(t) {
        this.panelFoot({
            parent: 'footTodos',
            json:   [{ label: 'Total del dia', value: _fmtMX(t.total) }]
        });

        this.panelFoot({
            parent: 'footFacturados',
            json:   [{ label: 'Monto facturado', value: _fmtMX(t.facturado), valueClass: 'text-[11px] font-bold text-green-600' }]
        });

        this.panelFoot({
            parent: 'detailFoot',
            json: [
                { label: 'Suma seleccionada', value: _fmtMX(t.sumaSel),  valueClass: 'text-[11px] font-bold text-[#1C64F2]' },
                { label: 'Objetivo restante', value: _fmtMX(t.restante), labelClass: 'text-[10px] text-gray-400', valueClass: 'text-[10px] text-gray-400' }
            ],
            action: {
                id:      'btnEnviarFacturar',
                text:    'Enviar a facturar',
                icon:    'send',
                onClick: () => resumen.sendToInvoice()
            }
        });
    }

    renderProgress(data) {
        this.progressBar({
            parent: 'progressRow',
            id:     'progResumen',
            json:   data
        });
    }

    // -- Components --

    panelHead(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'flex items-center justify-between w-full',
            json:   { icon: '', iconClass: 'w-4 h-4 text-gray-400', title: '', badge: null },
            classes: {
                title: 'text-[12px] font-bold text-gray-300 flex items-center gap-2'
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
            class:  'flex flex-col gap-1 w-full',
            json:   [],
            action: null,
            classes: {
                row:   'flex items-center justify-between w-full',
                label: 'text-[11px] font-semibold text-gray-400',
                value: 'text-[11px] font-semibold text-white',
                btn:   `${CF_CSS.btnPrimary} mt-2 flex items-center justify-center gap-2`
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const rowsHtml = (opts.json || []).map(r => `
            <div class="${opts.classes.row}">
                <span class="${r.labelClass || opts.classes.label}">${esc(r.label)}</span>
                <span class="${r.valueClass || opts.classes.value}">${esc(r.value)}</span>
            </div>
        `).join('');

        const a = opts.action;
        const actionHtml = a ? `
            <button type="button" id="${esc(a.id)}" class="${opts.classes.btn}">
                ${a.icon ? `<i data-lucide="${esc(a.icon)}" class="w-4 h-4"></i>` : ''}${esc(a.text)}
            </button>
        ` : '';

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html(rowsHtml + actionHtml);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

        if (a && typeof a.onClick === 'function') {
            $(`#${a.id}`).on('click', () => a.onClick());
        }
    }

    progressBar(options) {
        const defaults = {
            parent: 'root',
            id:     'progressBar',
            class:  'w-full',
            json:   { label: '', percent: 0, leftText: '', rightText: '' },
            classes: {
                label:   'text-[11px] font-semibold text-gray-300',
                percent: 'text-[11px] font-bold text-[#1C64F2]',
                caption: 'flex justify-between mt-2 text-[10px] text-gray-400'
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

        const wrap = $('<div>', { id: opts.id, class: opts.class });
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
            json:   { title: '', titleHtml: '', subtitle: '', toggles: [], back: null },
            classes: {
                title:    'text-lg font-bold text-white',
                subtitle: 'text-xs text-gray-400',
                groupLbl: 'text-[9px] text-gray-400 uppercase tracking-wider font-bold',
                btn:      'demo-toggle px-2.5 py-1 rounded text-[11px] border border-[#374151] text-gray-400 hover:bg-[#1F2A37] transition-colors',
                btnActive:'demo-toggle active px-2.5 py-1 rounded text-[11px] border border-blue-400 bg-[rgba(28,100,242,0.12)] text-blue-300',
                sep:      'text-gray-300',
                backBtn:  'w-8 h-8 rounded-full bg-[#1F2A37] hover:bg-[rgba(28,100,242,0.12)] border border-[#374151] hover:border-blue-400 flex items-center justify-center text-gray-400 hover:text-blue-300 transition-colors flex-shrink-0'
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
                info:    'var(--cs-info,#1C64F2)',
                purple:  'var(--cs-accent-purple,#7C3AED)'
            },
            classes: {
                info:   'text-[10px] text-gray-400',
                legend: 'flex items-center gap-3 text-[10px] text-gray-400',
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
