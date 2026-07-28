let apiTickets = '/app/facture/ctrl/ctrl-facture-tickets.php';
let app, tickets, ticketsView;

$(async () => {
    ticketsView = new TicketsView(apiTickets, 'root');
    tickets     = new Tickets(apiTickets, 'root');
    app         = new App(apiTickets, 'root');
    await app.init();
});

// -- Clase principal --

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'tickets';
        this.selectedId   = null;
    }

    async init() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiTickets, data:{ opc:'init' } })
        this.dataInit = {
            formas:  SAMPLE_TICKETS_FORMAS,
            estados: SAMPLE_TICKETS_ESTADOS,
            dia:     this.getDiaFromUrl()
        };

        this.render();
    }

    getDiaFromUrl() {
        return new URLSearchParams(window.location.search).get('dia') || '';
    }

    render() {
        this.layout();
        this.filterBar();
        ticketsView.renderHeader(SAMPLE_VIEW_HEADER_TICKETS);
        ticketsView.renderFooter(SAMPLE_VIEW_FOOTER_TICKETS);
        ticketsView.renderDetail(null);
        tickets.lsKpis();
        tickets.lsTickets();
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
                    class: 'flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'filterBar',
                    class: 'px-3 py-3 bg-white border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'kpisRow',
                    class: 'px-3 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0'
                },
                {
                    id:    'tableWrap',
                    class: 'p-3 flex-1 min-h-0 overflow-auto bg-white'
                },
                {
                    id:    'viewFooterRow',
                    class: 'flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200 flex-shrink-0'
                }
            ]
        };

        // Sin children: el panel lo pinta ticketDetailPanel sobre 'detailPanel'.
        const detailPanel = {
            type:  'aside',
            id:    'detailPanel',
            class: 'w-full md:w-[420px] flex-shrink-0 bg-white border-t md:border-t-0 md:border-l border-gray-200 flex flex-col overflow-hidden'
        };

        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'flex-1 min-h-0 w-full flex flex-col md:flex-row overflow-hidden bg-white rounded-lg border border-gray-200',
                container: [mainPanel, detailPanel]
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
                class:    'col-12 col-md-6 col-lg-2',
                value:    this.dataInit.dia,
                required: false,
                onchange: 'app.onChangeFilters()'
            },
            {
                opc:       'button',
                id:        'btnLimpiar',
                text:      'Limpiar filtros',
                color_btn: 'secondary',
                class:     'col-12 col-md-6 col-lg-3',
                onClick:   () => this.clearFilters()
            }
        ];

        this.createfilterBar({
            parent:     'filterBar',
            coffeesoft: true,
            theme:      'light',
            data:       filters
        });
    }

    getFilters() {
        return {
            q:      $('#qBuscar').val() || '',
            forma:  $('#fForma').val()  || '',
            estado: $('#fEstado').val() || '',
            dia:    $('#fDia').val()    || ''
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
        $('#viewFooter_info').text(text);
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
        this.PROJECT_NAME = 'tickets';
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
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiTickets, data:Object.assign({ opc:'lsTickets' }, app.getFilters()) })
        const rows = this.getRegistros().map(_ticketRow);

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'light',
            center:       [2, 3, 4, 5, 6, 7, 12],
            right:        [8, 9, 10, 11],
            actionsAlign: 'center',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       11,
            emptyMessage: 'No se encontraron tickets con los filtros aplicados',
            emptyIcon:    'ic-file-text',
            data:         { row: rows }
        });

        if (window.lucide) lucide.createIcons();

        if (rows.length > 0 && typeof simple_data_table === 'function') {
            simple_data_table(`#tb${this.PROJECT_NAME}`, 12);
        }

        app.updateFooterInfo(`Mostrando ${rows.length} de ${Object.keys(SAMPLE_TICKETS_DB).length} tickets`);
    }

    lsKpis() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiTickets, data:Object.assign({ opc:'showKpis' }, app.getFilters()) })
        const registros = this.getRegistros();
        const monto     = registros.reduce((s, e) => s + Number(e.total || 0), 0);

        ticketsView.renderInfoCards([
            {
                id:          'kpiTickets',
                title:       'Tickets',
                lucideIcon:  'receipt',
                bgColor:     'bg-white',
                borderColor: 'border-gray-200',
                data: {
                    value: registros.length,
                    color: 'text-gray-800'
                }
            },
            {
                id:          'kpiMonto',
                title:       'Monto filtrado',
                lucideIcon:  'banknote',
                bgColor:     'bg-white',
                borderColor: 'border-gray-200',
                data: {
                    value: _fmtMX(monto),
                    color: 'text-[#C05A40]'
                }
            },
            {
                id:          'kpiFacturados',
                title:       'Facturados',
                lucideIcon:  'lock',
                bgColor:     'bg-white',
                borderColor: 'border-gray-200',
                data: {
                    value: registros.filter(e => e.fiscal === 'invoiced').length,
                    color: 'text-green-600'
                }
            },
            {
                id:          'kpiCero',
                title:       'Con IVA 0%',
                lucideIcon:  'alert-circle',
                bgColor:     'bg-white',
                borderColor: 'border-gray-200',
                data: {
                    value: registros.filter(e => e.tasa === 0).length,
                    color: 'text-amber-500'
                }
            }
        ]);
    }

    // -- Actions --

    openGenerador(id) {
        window.location.href = `/app/facture/generador.php?id=${encodeURIComponent(id)}`;
    }
}

// -- Vista --

class TicketsView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'tickets';
    }

    // -- Render helpers --

    renderHeader(data) {
        this.viewHeader({
            parent: 'viewHeader',
            id:     'hdrTickets',
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
            id:     'kpisTickets',
            theme:  'light',
            style:  'file',
            cols:   4,
            json:   rows
        });
    }

    renderDetail(ticket) {
        this.ticketDetailPanel({
            parent:  'detailPanel',
            json:    ticket,
            onClose: () => app.selectTicket(null),
            onPrint: (e) => tickets.openGenerador(e.id)
        });
    }

    // -- Components --

    ticketDetailPanel(options) {
        const defaults = {
            parent: 'root',
            id:     'ticketDetailPanel',
            json:   null,
            labels: {
                emptyTitle: 'Selecciona un ticket',
                emptyHint:  'Haz click en cualquier fila o en el icono ojo para ver el detalle fiscal aqui.',
                subtitle:   'Detalle fiscal',
                imprimir:   'Ver ticket virtual'
            },
            onClose: () => { },
            onPrint: () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        const $parent = $(`#${opts.parent}`);
        if (!$parent.length) return;

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        if (!opts.json) {
            $parent.html(`
                <div class="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
                    <i data-lucide="inbox" class="w-10 h-10 text-gray-300 mb-3"></i>
                    <p class="text-sm font-semibold text-gray-500">${esc(opts.labels.emptyTitle)}</p>
                    <p class="text-xs text-gray-400 mt-1 max-w-[220px]">${esc(opts.labels.emptyHint)}</p>
                </div>
            `);
            if (window.lucide) lucide.createIcons();
            return;
        }

        const e = opts.json;
        const t = _totalsOf(e);

        const item = (k, v) => `
            <div class="flex items-center justify-between border-b border-gray-100 py-1.5">
                <span class="text-[10px] uppercase tracking-wide text-gray-400">${esc(k)}</span>
                <span class="text-[11px] font-semibold text-gray-700 text-right">${v}</span>
            </div>
        `;

        $parent.html(`
            <div class="flex-1 flex flex-col overflow-hidden">
                <div class="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                    <div>
                        <p class="text-xs text-gray-500 uppercase tracking-wider">${esc(opts.labels.subtitle)}</p>
                        <p class="text-base font-bold text-gray-800 font-mono">${esc(e.id)}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        ${_badgeEstadoFiscal(e)}
                        <button id="${opts.id}_close" class="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors">
                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto scroll-thin px-4 py-3">
                    ${item('Orden',         esc(e.orden))}
                    ${item('Fecha',         esc(_fmtFechaCorta(e.fecha)))}
                    ${item('Forma de pago', _badgeMetodo(e.metodo))}
                    ${item('Mesero',        esc(e.mesero))}
                    ${item('Tasa',          _badgeTasa(e.tasa))}
                    ${item('Subtotal',      esc(_fmtMX(t.subtotal)))}
                    ${item('IVA',           esc(_fmtMX(t.iva)))}
                    ${item('IEPS',          esc(_fmtMX(t.ieps)))}
                    ${item('Total',         esc(_fmtMX(e.total)))}
                    ${item('Factura',       _badgeFactura(e.factura))}
                </div>

                <div class="px-4 py-3 border-t border-gray-200 bg-gray-50 flex-shrink-0">
                    <button type="button" id="${opts.id}_print" class="${CF_CSS.btnInvernal} flex items-center justify-center gap-2">
                        <i data-lucide="printer" class="w-4 h-4"></i>${esc(opts.labels.imprimir)}
                    </button>
                </div>
            </div>
        `);

        if (window.lucide) lucide.createIcons();

        $(`#${opts.id}_close`).on('click', () => opts.onClose());
        $(`#${opts.id}_print`).on('click', () => opts.onPrint(e));
    }

    viewHeader(options) {
        const defaults = {
            parent: 'root',
            id:     'viewHeader',
            class:  'flex items-center justify-between w-full',
            json:   { title: '', titleHtml: '', subtitle: '', toggles: [], back: null },
            classes: {
                title:    'text-lg font-bold text-gray-800',
                subtitle: 'text-xs text-gray-500',
                groupLbl: 'text-[9px] text-gray-500 uppercase tracking-wider font-bold',
                btn:      'demo-toggle px-2.5 py-1 rounded text-[11px] border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors',
                btnActive:'demo-toggle active px-2.5 py-1 rounded text-[11px] border border-blue-400 bg-blue-50 text-blue-700',
                sep:      'text-gray-300',
                backBtn:  'w-8 h-8 rounded-full bg-gray-100 hover:bg-blue-50 border border-gray-200 hover:border-blue-400 flex items-center justify-center text-gray-500 hover:text-blue-700 transition-colors flex-shrink-0'
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
                info:    'var(--cs-info,#C05A40)',
                purple:  'var(--cs-accent-purple,#7C3AED)'
            },
            classes: {
                info:   'text-[10px] text-gray-500',
                legend: 'flex items-center gap-3 text-[10px] text-gray-500',
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
