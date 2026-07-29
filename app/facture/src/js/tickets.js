let apiTickets = '/app/facture/ctrl/ctrl-facture-tickets.php';
let app, tickets, ticketsView;

// useFetch del framework resuelve por callback; aqui el modulo encadena con
// await, asi que las llamadas pasan por este helper.
const fnAjax = (data, url) => fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams(data)
}).then(r => r.json());

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
        const data = await fnAjax({ opc: 'init' }, apiTickets);

        this.dataInit = {
            formas:  data.formas,
            estados: data.estados,
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
                    class: 'flex items-center justify-between px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'filterBar',
                    class: 'px-3 py-3 bg-[#141d2b] flex-shrink-0'
                },
                {
                    id:    'kpisRow',
                    class: 'px-3 py-2 bg-[#0E1521] flex-shrink-0'
                },
                {
                    id:    'tableWrap',
                    class: 'p-3 flex-1 min-h-0 overflow-auto'
                },
                {
                    id:    'viewFooterRow',
                    class: 'flex items-center justify-between px-4 py-2 bg-[#0E1521] border-t border-[#374151] flex-shrink-0'
                }
            ]
        };

        // Sin children: el panel lo pinta ticketDetailPanel sobre 'detailPanel'.
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
    }

    // -- Filter bar --

    filterBar() {
        const filters = [
            {
                opc:      'input-calendar',
                id:       'fRango',
                lbl:      'Consultar periodo:',
                class:    'col-12 col-md-4 col-lg-3',
                required: false,
                readonly: true
            },
            {
                opc:      'select',
                id:       'fForma',
                lbl:      'Forma de pago:',
                class:    'col-12 col-md-4 col-lg-3',
                value:    '',
                required: false,
                onchange: 'app.onChangeFilters()',
                data:     this.dataInit.formas
            },
            {
                opc:      'select',
                id:       'fEstado',
                lbl:      'Estado fiscal:',
                class:    'col-12 col-md-4 col-lg-3',
                value:    '',
                required: false,
                onchange: 'app.onChangeFilters()',
                data:     this.dataInit.estados
            }
        ];

        this.createfilterBar({
            parent:     'filterBar',
            coffeesoft: true,
            theme:      FACTURE_THEME,
            data:       filters
        });

        this.rangePicker();
    }

    // El rango arranca en el dia que llega por URL (?dia=) y, si no viene, en el mes actual.
    rangePicker() {
        const dia   = this.dataInit.dia;
        const start = dia ? moment(dia) : moment().startOf('month');
        const end   = dia ? moment(dia) : moment().endOf('month');

        dataPicker({
            parent: 'fRango',
            rangepicker: {
                startDate:     start,
                endDate:       end,
                showDropdowns: true,
                locale: {
                    format:           'YYYY-MM-DD',
                    applyLabel:       'Aplicar',
                    cancelLabel:      'Cancelar',
                    customRangeLabel: 'Personalizar',
                    monthNames:       ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
                    daysOfWeek:       ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa']
                },
                ranges: {
                    'Mes actual':       [moment().startOf('month'), moment().endOf('month')],
                    'Mes anterior':     [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')],
                    'Primera quincena': [moment().startOf('month'), moment().date(15)],
                    'Segunda quincena': [moment().date(16), moment().endOf('month')]
                }
            },
            onSelect: () => this.onChangeFilters()
        });
    }

    getFilters() {
        const rango = this.getRango();
        return {
            forma:  $('#fForma').val()  || '',
            estado: $('#fEstado').val() || '',
            fi:     rango.fi,
            ff:     rango.ff
        };
    }

    // Mientras dataPicker no engancha el plugin, el input aun no tiene rango.
    getRango() {
        if (!$('#fRango').data('daterangepicker')) return { fi: '', ff: '' };
        return getDataRangePicker('fRango');
    }

    // -- Event handlers --

    async onChangeFilters() {
        await tickets.lsTickets();
        tickets.lsKpis();

        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectTicket(null);
        }
    }

    // La tabla ya viene filtrada del servidor: basta con ver si el folio
    // seleccionado sobrevivio al repintado.
    isVisibleAfterFilters(folio) {
        return $(`#tb${this.PROJECT_NAME} [data-folio="${folio}"]`).length > 0;
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }

    // -- Facade --

    async selectTicket(folio) {
        this.selectedId = folio;
        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');

        if (!folio) return ticketsView.renderDetail(null);

        $(`#tb${this.PROJECT_NAME} [data-folio="${folio}"]`).closest('tr').addClass('row-active');

        const data = await fnAjax({ opc: 'getTicket', folio: folio }, apiTickets);
        ticketsView.renderDetail(data.status === 200 ? data.ticket : null);
    }
}

// -- Tickets --

class Tickets extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'tickets';
    }

    // -- Data --

    async lsTickets() {
        const data = await fnAjax(Object.assign({ opc: 'lsTickets' }, app.getFilters()), apiTickets);
        const rows = data.row || [];

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        FACTURE_THEME,
            center:       [2, 3, 4, 5, 6, 11],
            right:        [7, 8, 9, 10],
            actionsAlign: 'center',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       11,
            border_table: 'border-0',
            emptyMessage: 'No se encontraron tickets con los filtros aplicados',
            emptyIcon:    'ic-file-text',
            data:         data
        });

        if (window.lucide) lucide.createIcons();

        if (rows.length > 0 && typeof simple_data_table === 'function') {
            simple_data_table(`#tb${this.PROJECT_NAME}`, 12);
        }

        app.updateFooterInfo(`Mostrando ${rows.length} de ${data.total} tickets del periodo`);
    }

    async lsKpis() {
        const kpis = await fnAjax(Object.assign({ opc: 'showKpis' }, app.getFilters()), apiTickets);

        ticketsView.renderInfoCards([
            {
                id:          'kpiTickets',
                title:       'Tickets',
                lucideIcon:  'receipt',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value: kpis.tickets,
                    color: 'text-white'
                }
            },
            {
                id:          'kpiMonto',
                title:       'Monto filtrado',
                lucideIcon:  'banknote',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value: kpis.montoTexto,
                    color: 'text-[#1C64F2]'
                }
            },
            {
                id:          'kpiFacturados',
                title:       'Facturados',
                lucideIcon:  'lock',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value: kpis.facturados,
                    color: 'text-green-600'
                }
            },
            {
                id:          'kpiCero',
                title:       'Con IVA 0%',
                lucideIcon:  'alert-circle',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value: kpis.cero,
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
            theme:  FACTURE_THEME,
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
                leyenda:    'Este detalle no es un comprobante fiscal',
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
                    <p class="text-sm font-semibold text-gray-400">${esc(opts.labels.emptyTitle)}</p>
                    <p class="text-xs text-gray-400 mt-1 max-w-[220px]">${esc(opts.labels.emptyHint)}</p>
                </div>
            `);
            if (window.lucide) lucide.createIcons();
            return;
        }

        const e = opts.json;

        // Dentro del papel no van badges: sobre fondo blanco se pierden. Se usa
        // el mismo renglon monoespaciado del ticket impreso.
        const row = (k, v, strong) => `
            <tr>
                <td${strong ? ' class="font-bold text-[13px]"' : ''}>${esc(k)}</td>
                <td class="text-right${strong ? ' font-bold text-[13px]' : ''}">${esc(v)}</td>
            </tr>
        `;

        // Las comandas viven en otra hoja del export: si aun no se cargan, el
        // ticket no tiene mesa ni mesero que imprimir.
        const mesaRow   = e.mesa   ? row('MESA:',   e.mesa)   : '';
        const meseroRow = e.mesero ? row('MESERO:', e.mesero) : '';

        $parent.html(`
            <div class="flex-1 flex flex-col overflow-hidden">
                <div class="px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex items-center justify-between flex-shrink-0">
                    <div>
                        <p class="text-xs text-gray-400 uppercase tracking-wider">${esc(opts.labels.subtitle)}</p>
                        <p class="text-base font-bold text-white font-mono">${esc(e.folio)}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        ${e.badge || ''}
                        <button id="${opts.id}_close" class="w-7 h-7 rounded-lg bg-[#1F2A37] hover:bg-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-300 transition-colors">
                            <i data-lucide="x" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto scroll-thin px-4 py-4 bg-[#0E1521]">
                    <div id="${opts.id}_paper" class="ticket-paper">
                        <div class="text-center">
                            <p class="font-bold text-[13px] tracking-wide">${esc(opts.labels.subtitle).toUpperCase()}</p>
                            <p>TICKET ${esc(e.folio)}</p>
                        </div>
                        <div class="tk-sep"></div>
                        <table>
                            ${row('FOLIO:',  e.folio)}
                            ${row('FECHA:',  e.fecha)}
                            ${mesaRow}
                            ${meseroRow}
                            ${row('PAGO:',   String(e.pago).toUpperCase())}
                            ${row('METODO:', e.metodo)}
                        </table>
                        <div class="tk-sep"></div>
                        <table>
                            ${row('SUBTOTAL:',          e.subtotal)}
                            ${row(`IVA (${e.tasa}):`,   e.iva)}
                            ${row('IEPS:',              e.ieps)}
                            ${row('TOTAL:',             e.total, true)}
                        </table>
                        <div class="tk-sep"></div>
                        <table>
                            ${row('ESTADO:',  e.estado)}
                            ${row('FACTURA:', e.factura)}
                        </table>
                        <div class="tk-sep"></div>
                        <div class="text-center">
                            <p class="text-gray-400">${esc(opts.labels.leyenda)}</p>
                        </div>
                    </div>
                </div>

                <div class="px-4 py-3 border-t border-[#374151] bg-[#0E1521] flex-shrink-0">
                    <button type="button" id="${opts.id}_print" class="${CF_CSS.btnPrimary} flex items-center justify-center gap-2">
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
