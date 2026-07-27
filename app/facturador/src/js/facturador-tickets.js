let api = 'ctrl/ctrl-facturador-tickets.php';
let app, tickets, ticketsView;

let turno, subsidiaries_id;

window.updateSession = () => { };


$(async () => {
    ticketsView = new TicketsView(api, 'root');
    tickets     = new Tickets(api, 'root');
    app         = new App(api, 'root');
    await app.init();
});

// -- Clase principal --

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'FacturadorTickets';
        this.subId        = null;
        this.selectedId   = null;
    }

    async init() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:{ opc:'init' } })
        this.dataInit = {
            subsidiaries_id: '',
            formas:          SAMPLE_TICKETS_FORMAS,
            estados:         SAMPLE_TICKETS_ESTADOS,
            dia:             ''
        };
        this.subId      = this.dataInit.subsidiaries_id;
        subsidiaries_id = this.subId;

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        ticketsView.renderHeader(SAMPLE_VIEW_HEADER_TICKETS);
        ticketsView.renderFooter(SAMPLE_VIEW_FOOTER_TICKETS);
        ticketsView.renderPanelHeads();
        ticketsView.renderDetail(null);
        tickets.lsKpis();
        tickets.lsTickets();
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

        this.createLayout({
            parent: `container${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:        `wrap${this.PROJECT_NAME}`,
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
                        id:    `split${this.PROJECT_NAME}`,
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

        this.tableLayout();
    }

    tableLayout() {
        this.createLayout({
            parent: `split${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:        `splitGrid${this.PROJECT_NAME}`,
                class:     'w-full grid grid-cols-1 xl:grid-cols-4 gap-4',
                container: [
                    {
                        type:  'div',
                        id:    `cardTable${this.PROJECT_NAME}`,
                        class: 'xl:col-span-3 card-base overflow-hidden flex flex-col',
                        children: [
                            {
                                id:    `headTable${this.PROJECT_NAME}`,
                                class: 'px-4 py-3 border-b border-ink-100 flex items-center justify-between'
                            },
                            {
                                id:    `tableTickets${this.PROJECT_NAME}`,
                                class: 'p-3 overflow-auto scroll-thin max-h-[540px]'
                            }
                        ]
                    },
                    {
                        type:  'div',
                        id:    `cardDetail${this.PROJECT_NAME}`,
                        class: 'card-base p-4 flex flex-col gap-3',
                        children: [
                            {
                                id:    `headDetail${this.PROJECT_NAME}`,
                                class: 'w-full'
                            },
                            {
                                id:    `bodyDetail${this.PROJECT_NAME}`,
                                class: 'w-full'
                            }
                        ]
                    }
                ]
            }
        });
    }

    // -- Filter bar --

    filterBar() {
        const filters = [
            {
                opc:         'input',
                id:          'qBuscar',
                lbl:         'Buscar:',
                class:       'col-12 col-md-4 col-lg-3',
                placeholder: 'Folio, orden, forma de pago...',
                required:    false,
                onkeyup:     'app.onChangeFilters()'
            },
            {
                opc:      'select',
                id:       'fForma',
                lbl:      'Forma de pago:',
                class:    'col-12 col-md-4 col-lg-2',
                value:    '',
                required: false,
                onchange: 'app.onChangeFilters()',
                data:     this.dataInit.formas
            },
            {
                opc:      'select',
                id:       'fEstado',
                lbl:      'Estado fiscal:',
                class:    'col-12 col-md-4 col-lg-2',
                value:    '',
                required: false,
                onchange: 'app.onChangeFilters()',
                data:     this.dataInit.estados
            },
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
                opc:       'button',
                id:        'btnLimpiar',
                text:      'Limpiar filtros',
                icon:      'icon-cancel',
                color_btn: 'secondary',
                class:     'col-12 col-md-6 col-lg-2',
                onClick:   () => this.clearFilters()
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
            q:               $('#qBuscar').val() || '',
            forma:           $('#fForma').val()  || '',
            estado:          $('#fEstado').val() || '',
            dia:             $('#fDia').val()    || ''
        };
    }

    clearFilters() {
        $('#qBuscar').val('');
        $('#fForma').val('');
        $('#fEstado').val('');
        $('#fDia').val('');
        this.onChangeFilters();
    }

    // -- Event handlers --

    onChangeFilters() {
        tickets.lsTickets();
        tickets.lsKpis();

        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectTicket(null);
        }
    }

    isVisibleAfterFilters(id) {
        return tickets.getRegistros().some(e => e.id === id);
    }

    updateFooterInfo(text) {
        $(`#ftr${this.PROJECT_NAME}_info`).text(text);
    }

    // -- Facade --

    selectTicket(id) {
        this.selectedId = id;
        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');

        // La celda de folio lleva id `Folio_<id>`, generado por createCoffeeTable3.
        if (id) $(`#Folio_${id}`).closest('tr').addClass('row-active');

        ticketsView.renderDetail(id ? SAMPLE_TICKETS_DB[id] : null);
    }
}

// -- Tickets --

class Tickets extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'FacturadorTickets';
    }

    // -- Data --

    getRegistros() {
        const f = app.getFilters();
        return Object.values(SAMPLE_TICKETS_DB).filter(e => {
            if (f.dia && e.fecha !== f.dia) return false;
            if (f.forma && e.metodo !== f.forma) return false;
            if (f.estado === 'pending'  && e.fiscal !== 'pending')  return false;
            if (f.estado === 'invoiced' && e.fiscal !== 'invoiced') return false;
            if (f.estado === 'zero'     && e.tasa !== 0)            return false;
            if (f.q) {
                const hay = (e.id + ' ' + e.orden + ' ' + e.metodo + ' ' + e.mesero).toLowerCase();
                if (!hay.includes(f.q.toLowerCase())) return false;
            }
            return true;
        });
    }

    lsTickets() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:Object.assign({ opc:'lsTickets' }, app.getFilters()) })
        const rows = this.getRegistros().map(_ticketRow);

        this.createCoffeeTable3({
            parent:       `tableTickets${this.PROJECT_NAME}`,
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'light',
            center:       [2, 3, 4, 5, 6, 7, 12],
            right:        [8, 9, 10, 11],
            actionsAlign: 'center',
            extends:      true,
            scrollable:   true,
            f_size:       11,
            color_th:     'bg-ink-50 text-ink-500',
            border_table: 'border border-ink-200 rounded-xl',
            border_row:   'border-b border-ink-100',
            class:        'w-full text-sm text-ink-600',
            emptyMessage: 'No se encontraron tickets con los filtros aplicados',
            emptyIcon:    'icon-doc-text',
            data:         { row: rows }
        });

        if (window.lucide) lucide.createIcons();

        if (rows.length > 0 && typeof simple_data_table === 'function') {
            simple_data_table(`#tb${this.PROJECT_NAME}`, 12);
        }

        app.updateFooterInfo(`Mostrando ${rows.length} de ${Object.keys(SAMPLE_TICKETS_DB).length} tickets`);
    }

    lsKpis() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:Object.assign({ opc:'showKpis' }, app.getFilters()) })
        const registros = this.getRegistros();
        const monto     = registros.reduce((s, e) => s + Number(e.total || 0), 0);

        ticketsView.renderInfoCards([
            {
                id:          'kpiTickets',
                title:       'Tickets',
                lucideIcon:  'receipt',
                bgColor:     'bg-white',
                borderColor: 'border-ink-200',
                data: {
                    value: registros.length,
                    color: 'text-ink-900'
                }
            },
            {
                id:          'kpiMonto',
                title:       'Monto filtrado',
                lucideIcon:  'banknote',
                bgColor:     'bg-white',
                borderColor: 'border-ink-200',
                data: {
                    value: _fmtMX(monto),
                    color: 'text-brand-600'
                }
            },
            {
                id:          'kpiFacturados',
                title:       'Facturados',
                lucideIcon:  'lock',
                bgColor:     'bg-white',
                borderColor: 'border-ink-200',
                data: {
                    value: registros.filter(e => e.fiscal === 'invoiced').length,
                    color: 'text-green-700'
                }
            },
            {
                id:          'kpiCero',
                title:       'Con IVA 0%',
                lucideIcon:  'alert-circle',
                bgColor:     'bg-white',
                borderColor: 'border-ink-200',
                data: {
                    value: registros.filter(e => e.tasa === 0).length,
                    color: 'text-amber-600'
                }
            }
        ]);
    }

    // -- Actions --

    openGenerador(id) {
        window.location.href = `/app/facturador/facturador-generador.php?id=${encodeURIComponent(id)}`;
    }
}

// -- Vista --

class TicketsView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'FacturadorTickets';
    }

    // -- Render helpers --

    renderHeader(data) {
        this.viewHeader({
            parent:   `viewHeader${this.PROJECT_NAME}`,
            id:       `hdr${this.PROJECT_NAME}`,
            classes:  SAMPLE_TICKETS_HEADER_CLASSES,
            json:     data,
            onToggle: (key, value) => console.log('[viewHeader] toggle', key, '->', value)
        });
    }

    renderFooter(data) {
        this.viewFooter({
            parent:  `viewFooter${this.PROJECT_NAME}`,
            id:      `ftr${this.PROJECT_NAME}`,
            classes: SAMPLE_TICKETS_FOOTER_CLASSES,
            tones:   SAMPLE_TICKETS_FOOTER_TONES,
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
            parent: `headTable${this.PROJECT_NAME}`,
            json: {
                icon:  'receipt',
                title: 'Tickets y pagos',
                badge: { text: 'estado fiscal', tone: 'b-gray' }
            }
        });

        this.panelHead({
            parent: `headDetail${this.PROJECT_NAME}`,
            json: {
                icon:  'file-text',
                title: 'Detalle del ticket'
            }
        });
    }

    renderDetail(ticket) {
        this.ticketDetail({
            parent: `bodyDetail${this.PROJECT_NAME}`,
            json:   ticket,
            onPrint: (e) => tickets.openGenerador(e.id)
        });
    }

    // -- Components --

    ticketDetail(options) {
        const defaults = {
            parent:  'root',
            id:      'ticketDetail',
            class:   'w-full flex flex-col gap-3',
            json:    null,
            labels:  { empty: 'Selecciona un ticket de la tabla para ver su detalle fiscal' },
            onPrint: () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });

        if (!opts.json) {
            wrap.html(`
                <div class="flex flex-col items-center justify-center text-center py-10 gap-2">
                    <i data-lucide="mouse-pointer-click" class="w-6 h-6 text-ink-300"></i>
                    <p class="text-[11px] text-ink-400">${esc(opts.labels.empty)}</p>
                </div>
            `);
            $(`#${opts.parent}`).html(wrap);
            if (window.lucide) lucide.createIcons();
            return;
        }

        const e = opts.json;
        const t = _totalsOf(e);
        const item = (k, v) => `
            <div class="flex items-center justify-between border-b border-ink-100 py-1.5">
                <span class="text-[10px] uppercase tracking-wide text-ink-400">${esc(k)}</span>
                <span class="text-[11px] font-semibold text-ink-800 text-right">${v}</span>
            </div>
        `;

        wrap.html(`
            <div class="flex items-center justify-between">
                <span class="font-mono text-[12px] font-bold text-ink-900">${esc(e.id)}</span>
                ${_badgeEstadoFiscal(e)}
            </div>
            ${item('Orden',          esc(e.orden))}
            ${item('Fecha',          esc(_fmtFechaCorta(e.fecha)))}
            ${item('Forma de pago',  _badgeMetodo(e.metodo))}
            ${item('Mesero',         esc(e.mesero))}
            ${item('Tasa',           _badgeTasa(e.tasa))}
            ${item('Subtotal',       esc(_fmtMX(t.subtotal)))}
            ${item('IVA',            esc(_fmtMX(t.iva)))}
            ${item('IEPS',           esc(_fmtMX(t.ieps)))}
            ${item('Total',          esc(_fmtMX(e.total)))}
            ${item('Factura',        _badgeFactura(e.factura))}
            <button type="button" id="${opts.id}_print" class="btn-primary w-full justify-center mt-2">
                <i data-lucide="printer"></i>Ver ticket virtual
            </button>
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

        $(`#${opts.id}_print`).on('click', () => opts.onPrint(e));
    }

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
