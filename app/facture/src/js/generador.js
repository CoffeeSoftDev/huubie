let apiGenerador = '/app/facture/ctrl/ctrl-facture-generador.php';
let app, generador, generadorView;

$(async () => {
    generadorView = new GeneradorView(apiGenerador, 'root');
    generador     = new Generador(apiGenerador, 'root');
    app           = new App(apiGenerador, 'root');
    await app.init();
});

// -- Clase principal --

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'generador';
        this.selectedId   = null;
        this.preparado    = null;
    }

    async init() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiGenerador, data:{ opc:'init' } })
        this.dataInit = {
            emisor: SAMPLE_GENERADOR_EMISOR,
            dia:    this.getParam('dia') || '2026-06-10'
        };
        this.selectedId = this.getIdFromUrl() || '4618312';

        this.render();
    }

    getParam(name) {
        return new URLSearchParams(window.location.search).get(name) || '';
    }

    getIdFromUrl() {
        const id = this.getParam('id');
        return id && SAMPLE_GENERADOR_DB[id] ? id : null;
    }

    render() {
        this.layout();
        this.filterBar();
        this.previewActions();
        generadorView.renderFooter(SAMPLE_VIEW_FOOTER_GENERADOR);
        generadorView.renderListNote();
        this.updateHeaderTitle();
        generador.lsTickets();
        this.selectTicket(this.selectedId);
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
                    id:    'listHead',
                    class: 'px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex items-center justify-between flex-wrap gap-2 flex-shrink-0'
                },
                {
                    id:    'tableWrap',
                    class: 'p-3 flex-1 min-h-0 overflow-auto'
                },
                {
                    id:    'listNote',
                    class: 'px-4 py-2 border-t border-[#374151] bg-[#141d2b] flex-shrink-0'
                },
                {
                    id:    'viewFooterRow',
                    class: 'flex items-center justify-between px-4 py-2 bg-[#0E1521] border-t border-[#374151] flex-shrink-0'
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
                        class: 'px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex items-center justify-between flex-wrap gap-2 flex-shrink-0'
                    },
                    {
                        type:  'div',
                        id:    'ticketPrintArea',
                        class: 'flex-1 min-h-0 overflow-auto scroll-thin px-4 py-4 bg-[#0E1521]'
                    },
                    {
                        type:  'div',
                        id:    'detailNote',
                        class: 'px-4 py-2 border-t border-[#374151] flex-shrink-0'
                    },
                    {
                        type:  'div',
                        id:    'detailActions',
                        class: 'px-3 py-2 border-t border-[#374151] bg-[#0E1521] flex-shrink-0'
                    }
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
                opc:         'input',
                id:          'qBuscar',
                lbl:         'Buscar:',
                class:       'col-12 col-md-4 col-lg-3',
                placeholder: 'Nota, ID o mesero...',
                required:    false,
                onkeyup:     'app.onChangeFilters()'
            },
            {
                opc:       'button',
                id:        'btnGenerarTodos',
                text:      'Generar todos los 0%',
                color_btn: 'invernal',
                class:     'col-12 col-md-4 col-lg-3',
                onClick:   () => generador.generateAllZero()
            }
        ];

        this.createfilterBar({
            parent:     'filterBar',
            coffeesoft: true,
            theme:      FACTURE_THEME,
            data:       filters
        });
    }

    // Acciones del ticket virtual: viven en el pie del aside, no en la filterBar,
    // porque operan sobre el ticket seleccionado y no sobre el listado.
    previewActions() {
        this.createfilterBar({
            parent:     'detailActions',
            id:         'frmActionsGenerador',
            coffeesoft: true,
            theme:      FACTURE_THEME,
            data: [
                {
                    opc:       'button',
                    id:        'btnRegenerar',
                    text:      'Regenerar',
                    color_btn: 'secondary',
                    class:     'col-6',
                    onClick:   () => generador.regenerate()
                },
                {
                    opc:       'button',
                    id:        'btnImprimir',
                    text:      'Imprimir',
                    color_btn: 'invernal',
                    class:     'col-6',
                    onClick:   () => generador.printTicket()
                }
            ]
        });
    }

    getFilters() {
        return {
            dia: $('#fDia').val()    || this.dataInit.dia,
            q:   $('#qBuscar').val() || ''
        };
    }

    // -- Event handlers --

    onChangeFilters() {
        this.updateHeaderTitle();
        generador.lsTickets();

        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectTicket(null);
        }
    }

    isVisibleAfterFilters(id) {
        return generador.getRegistros().some(e => e.id === id);
    }

    updateHeaderTitle() {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const f         = this.getFilters();
        const titleHtml = `${SAMPLE_VIEW_HEADER_GENERADOR.title} <span class="font-bold" style="color:#1C64F2;">&middot; ${esc(_fmtFechaCorta(f.dia))}</span>`;

        generadorView.renderHeader(Object.assign({}, SAMPLE_VIEW_HEADER_GENERADOR, { titleHtml }));
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }

    // -- Facade --

    selectTicket(id) {
        this.selectedId = id;
        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');

        if (!id) {
            this.preparado = null;
            generadorView.renderPreview(null, null);
            return;
        }

        // La celda de nota lleva id `Nota_<id>`, generado por createCoffeeTable3.
        $(`#Nota_${id}`).closest('tr').addClass('row-active');

        const e = SAMPLE_GENERADOR_DB[id];
        if (!e) return;

        e.generado     = true;
        this.preparado = _prepararTicketVirtual(e);
        generadorView.renderPreview(e, this.preparado);
    }

    getPreparado() {
        return this.preparado;
    }
}

// -- Generador --

class Generador extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'generador';
    }

    // -- Data --

    getRegistros() {
        const f = app.getFilters();
        return Object.values(SAMPLE_GENERADOR_DB).filter(e => {
            if (e.metodo === 'Efectivo') return false;
            if (f.dia && e.fecha !== f.dia) return false;
            if (f.q) {
                const hay = (e.id + ' #' + e.orden + ' ' + e.mesero).toLowerCase();
                if (!hay.includes(f.q.toLowerCase())) return false;
            }
            return true;
        });
    }

    lsTickets() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiGenerador, data:Object.assign({ opc:'lsTickets' }, app.getFilters()) })
        const registros = this.getRegistros();
        const rows      = registros.map(_generadorRow);

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        FACTURE_THEME,
            center:       [1, 3, 4],
            right:        [5],
            actionsAlign: 'right',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       11,
            border_table: 'border-0',
            emptyMessage: 'No hay tickets con tarjeta para el dia seleccionado',
            emptyIcon:    'ic-file-text',
            data:         { row: rows }
        });

        if (window.lucide) lucide.createIcons();

        generadorView.renderListHead({
            bloqueados: registros.filter(e => e.fiscal === 'invoiced').length,
            cero:       registros.filter(e => e.tasa === 0 && e.fiscal !== 'invoiced').length
        });

        app.updateFooterInfo(`Mostrando ${rows.length} ticket${rows.length !== 1 ? 's' : ''} sin efectivo`);
    }

    // -- Actions --

    generateAllZero() {
        const pendientes = this.getRegistros().filter(e => e.tasa === 0 && e.fiscal !== 'invoiced');

        if (!pendientes.length) {
            this.alertBox({ type: 'message', title: 'No hay tickets con IVA 0% por generar' });
            return;
        }

        this.swalQuestion({
            extends: true,
            opts: {
                title:             'Generar tickets virtuales',
                text:              `Se generaran ${pendientes.length} tickets virtuales del dia seleccionado.`,
                icon:              'question',
                confirmButtonText: 'Si, generar',
                cancelButtonText:  'No'
            }
        }).then((result) => {
            if (!result.isConfirmed) return;
            // MODO FAKE: si hubiera backend -> useFetch({ url:apiGenerador, data:{ opc:'generateAllZero', dia:app.getFilters().dia } })
            pendientes.forEach(e => { e.generado = true; });
            this.lsTickets();
            this.alertBox({ type: 'success', title: `${pendientes.length} tickets virtuales generados`, timer: 1600 });
        });
    }

    regenerate() {
        if (!app.selectedId) {
            this.alertBox({ type: 'message', title: 'Selecciona un ticket de la lista' });
            return;
        }
        // MODO FAKE: si hubiera backend -> useFetch({ url:apiGenerador, data:{ opc:'regenerate', id:app.selectedId } })
        app.selectTicket(app.selectedId);
    }

    printTicket() {
        if (!app.selectedId) {
            this.alertBox({ type: 'message', title: 'Selecciona un ticket de la lista' });
            return;
        }
        window.print();
    }

    lockedNotice(id) {
        const e = SAMPLE_GENERADOR_DB[id];
        if (!e) return;
        this.alertBox({ type: 'message', title: `El ticket ya esta facturado con el folio ${e.factura}` });
    }
}

// -- Vista --

class GeneradorView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'generador';
    }

    // -- Render helpers --

    renderHeader(data) {
        this.viewHeader({
            parent: 'viewHeader',
            id:     'hdrGenerador',
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

    renderListNote() {
        this.noteBox({
            parent: 'listNote',
            json: {
                text: 'Al generar, el sistema arma una lista de productos puente que suman el total del ticket. Si la combinacion excede el monto, se aplica un descuento para cuadrar.'
            }
        });
    }

    renderListHead(counts) {
        this.panelHead({
            parent: 'listHead',
            json: {
                icon:  'receipt',
                title: 'Tickets del dia (sin efectivo)',
                badges: [
                    { text: `${counts.bloqueados} bloqueados`, tone: 'b-green'  },
                    { text: `${counts.cero} con IVA 0%`,       tone: 'b-yellow' }
                ]
            }
        });
    }

    renderPreview(ticket, preparado) {
        this.ticketPaper({
            parent: 'ticketPrintArea',
            json:   ticket,
            data:   preparado,
            emisor: SAMPLE_GENERADOR_EMISOR
        });

        this.panelHead({
            parent: 'detailHead',
            json: {
                icon:   'printer',
                title:  ticket ? `Ticket virtual · Nota #${ticket.orden}` : 'Ticket virtual',
                badges: ticket ? [{ text: ticket.tasa === 0 ? 'IVA 0%' : 'IVA 16%', tone: ticket.tasa === 0 ? 'b-yellow' : 'b-terra' }] : []
            }
        });

        this.noteBox({
            parent: 'detailNote',
            class:  'text-[10px] text-gray-400 text-center',
            json: {
                icon: '',
                text: ticket && preparado
                    ? `Productos puente: ${preparado.lineas.length} articulos suman ${_fmtMX(preparado.subtotal)}, descuento de ${_fmtMX(preparado.descuento)} para cuadrar los ${_fmtMX(ticket.total)} del ticket.`
                    : 'Selecciona un ticket de la lista para armar su ticket virtual.'
            }
        });
    }

    // -- Components --

    ticketPaper(options) {
        const defaults = {
            parent: 'root',
            id:     'ticketPaper',
            class:  'ticket-paper',
            json:   null,
            data:   null,
            emisor: { razon: '', domicilio: '', telefono: '', terminal: '', leyenda: '' },
            labels: { empty: 'Sin ticket seleccionado' }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.emisor = Object.assign({}, defaults.emisor, o.emisor || {});
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const wrap = $('<div>', { id: opts.id, class: opts.class });

        if (!opts.json || !opts.data) {
            wrap.html(`<p class="text-center text-[11px] text-gray-400 py-8">${esc(opts.labels.empty)}</p>`);
            $(`#${opts.parent}`).html(wrap);
            return;
        }

        const e = opts.json;
        const d = opts.data;
        const m = opts.emisor;

        const lineas = d.lineas.map(l => `
            <tr>
                <td>${esc(l.cant)}&nbsp;&nbsp;${esc(l.nombre)}</td>
                <td style="text-align:right">${esc(_fmtMX(l.importe))}</td>
            </tr>
        `).join('');

        wrap.html(`
            <div class="text-center">
                <p class="font-bold text-[13px] tracking-wide">${esc(m.razon)}</p>
                <p>${esc(m.domicilio)}</p>
                <p>${esc(m.telefono)}</p>
            </div>
            <div class="tk-sep"></div>
            <table>
                <tr><td>NOTA:</td><td class="text-right font-bold">#${esc(e.orden)}</td></tr>
                <tr><td>FECHA:</td><td class="text-right">${esc(_fmtFechaCorta(e.fecha))} 19:47</td></tr>
                <tr><td>MESA:</td><td class="text-right">${esc(e.mesa)}</td></tr>
                <tr><td>MESERO:</td><td class="text-right">${esc(e.mesero)}</td></tr>
                <tr><td>TERMINAL:</td><td class="text-right">${esc(m.terminal)}</td></tr>
            </table>
            <div class="tk-sep"></div>
            <table>
                <thead>
                    <tr><td class="font-bold">CANT DESCRIPCION</td><td class="text-right font-bold">IMPORTE</td></tr>
                </thead>
                <tbody>${lineas}</tbody>
            </table>
            <div class="tk-sep"></div>
            <table>
                <tr><td>SUBTOTAL:</td><td class="text-right">${esc(_fmtMX(d.subtotal))}</td></tr>
                <tr><td>DESCUENTO:</td><td class="text-right text-red-300">-${esc(_fmtMX(d.descuento))}</td></tr>
                <tr><td class="font-bold text-[13px]">TOTAL:</td><td class="text-right font-bold text-[13px]">${esc(_fmtMX(e.total))}</td></tr>
            </table>
            <div class="tk-sep"></div>
            <div class="text-center">
                <p>PAGO: ${esc(String(e.metodo).toUpperCase())}</p>
                <p class="mt-1.5">GRACIAS POR SU VISITA</p>
                <p class="mt-1.5 text-gray-400">${esc(m.leyenda)}</p>
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
    }

    noteBox(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'text-[10px] text-gray-400 flex items-start gap-2',
            json:   { icon: 'info', text: '' }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json  = Object.assign({}, defaults.json, o.json || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const iconHtml = opts.json.icon
            ? `<i data-lucide="${esc(opts.json.icon)}" class="w-3.5 h-3.5 text-gray-400 shrink-0 mt-[1px]"></i>`
            : '';

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html(`${iconHtml}<span>${esc(opts.json.text)}</span>`);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
    }

    panelHead(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'flex items-center justify-between w-full gap-2 flex-wrap',
            json:   { icon: '', iconClass: 'w-4 h-4 text-gray-400', title: '', badges: [] },
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

        const iconHtml   = opts.json.icon ? `<i data-lucide="${esc(opts.json.icon)}" class="${opts.json.iconClass}"></i>` : '';
        const badgesHtml = (opts.json.badges || [])
            .map(b => `<span class="badge-base ${esc(b.tone || 'b-gray')}">${esc(b.text)}</span>`)
            .join('');

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html(`
            <h3 class="${opts.classes.title}">${iconHtml}${esc(opts.json.title)}</h3>
            <div class="flex items-center gap-2">${badgesHtml}</div>
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
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
