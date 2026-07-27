let api = 'ctrl/ctrl-facturador-generador.php';
let app, generador, generadorView;

let turno, subsidiaries_id;

window.updateSession = () => { };


$(async () => {
    generadorView = new GeneradorView(api, 'root');
    generador     = new Generador(api, 'root');
    app           = new App(api, 'root');
    await app.init();
});

// -- Clase principal --

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'FacturadorGenerador';
        this.subId        = null;
        this.selectedId   = null;
        this.preparado    = null;
    }

    async init() {
        // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:{ opc:'init' } })
        this.dataInit = {
            subsidiaries_id: '',
            dias:            SAMPLE_GENERADOR_DIAS,
            emisor:          SAMPLE_GENERADOR_EMISOR,
            dia:             '2026-06-10'
        };
        this.subId      = this.dataInit.subsidiaries_id;
        subsidiaries_id = this.subId;
        this.selectedId = this.getIdFromUrl() || '4618312';

        this.render();
    }

    getIdFromUrl() {
        const id = new URLSearchParams(window.location.search).get('id');
        return id && SAMPLE_GENERADOR_DB[id] ? id : null;
    }

    render() {
        this.layout();
        this.filterBar();
        this.previewActions();
        generadorView.renderHeader(SAMPLE_VIEW_HEADER_GENERADOR);
        generadorView.renderFooter(SAMPLE_VIEW_FOOTER_GENERADOR);
        generadorView.renderPanelHeads();
        generador.lsTickets();
        this.selectTicket(this.selectedId);
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

        this.previewLayout();
    }

    previewLayout() {
        this.createLayout({
            parent: `split${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:        `splitGrid${this.PROJECT_NAME}`,
                class:     'w-full grid grid-cols-1 xl:grid-cols-5 gap-4',
                container: [
                    {
                        type:  'div',
                        id:    `cardList${this.PROJECT_NAME}`,
                        class: 'xl:col-span-3 card-base overflow-hidden flex flex-col',
                        children: [
                            {
                                id:    `headList${this.PROJECT_NAME}`,
                                class: 'px-4 py-3 border-b border-ink-100 flex items-center justify-between flex-wrap gap-2'
                            },
                            {
                                id:    `tableTickets${this.PROJECT_NAME}`,
                                class: 'p-3 overflow-auto scroll-thin max-h-[520px]'
                            },
                            {
                                id:    `noteList${this.PROJECT_NAME}`,
                                class: 'px-4 py-3 border-t border-ink-100 mt-auto'
                            }
                        ]
                    },
                    {
                        type:  'div',
                        id:    `cardPreview${this.PROJECT_NAME}`,
                        class: 'xl:col-span-2 card-base p-4 flex flex-col gap-3',
                        children: [
                            {
                                id:    `headPreview${this.PROJECT_NAME}`,
                                class: 'w-full'
                            },
                            {
                                id:    'ticketPrintArea',
                                class: 'w-full'
                            },
                            {
                                id:    `previewActions${this.PROJECT_NAME}`,
                                class: 'w-full'
                            },
                            {
                                id:    `previewNote${this.PROJECT_NAME}`,
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
                icon:      'icon-magic',
                color_btn: 'primary',
                className: 'btn-primary',
                class:     'col-12 col-md-4 col-lg-3',
                onClick:   () => generador.generateAllZero()
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

    previewActions() {
        this.createfilterBar({
            parent:     `previewActions${this.PROJECT_NAME}`,
            id:         `frmActions${this.PROJECT_NAME}`,
            coffeesoft: true,
            theme:      'light',
            data: [
                {
                    opc:       'button',
                    id:        'btnRegenerar',
                    text:      'Regenerar',
                    icon:      'icon-arrows-cw',
                    color_btn: 'secondary',
                    class:     'col-6',
                    onClick:   () => generador.regenerate()
                },
                {
                    opc:       'button',
                    id:        'btnImprimir',
                    text:      'Imprimir',
                    icon:      'icon-print',
                    color_btn: 'primary',
                    className: 'btn-primary',
                    class:     'col-6',
                    onClick:   () => generador.printTicket()
                }
            ]
        });
    }

    getFilters() {
        return {
            subsidiaries_id: this.subId || '',
            dia:             $('#fDia').val()    || this.dataInit.dia,
            q:               $('#qBuscar').val() || ''
        };
    }

    // -- Event handlers --

    onChangeFilters() {
        generador.lsTickets();

        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectTicket(null);
        }
    }

    isVisibleAfterFilters(id) {
        return generador.getRegistros().some(e => e.id === id);
    }

    updateFooterInfo(text) {
        $(`#ftr${this.PROJECT_NAME}_info`).text(text);
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
        this.PROJECT_NAME = 'FacturadorGenerador';
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
        // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:Object.assign({ opc:'lsTickets' }, app.getFilters()) })
        const registros = this.getRegistros();
        const rows      = registros.map(_generadorRow);

        this.createCoffeeTable3({
            parent:       `tableTickets${this.PROJECT_NAME}`,
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'light',
            center:       [1, 3, 4],
            right:        [5],
            actionsAlign: 'right',
            extends:      true,
            scrollable:   false,
            f_size:       11,
            color_th:     'bg-ink-50 text-ink-500',
            border_table: 'border-0',
            border_row:   'border-b border-ink-100',
            class:        'w-full text-sm text-ink-600',
            emptyMessage: 'No hay tickets con tarjeta para el dia seleccionado',
            emptyIcon:    'icon-doc-text',
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
            if (typeof alert === 'function') alert({ icon: 'info', text: 'No hay tickets con IVA 0% por generar' });
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
            // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:{ opc:'generateAllZero', dia:app.getFilters().dia } })
            pendientes.forEach(e => { e.generado = true; });
            this.lsTickets();
            if (typeof alert === 'function') alert({ icon: 'success', text: `${pendientes.length} tickets virtuales generados` });
        });
    }

    regenerate() {
        if (!app.selectedId) {
            if (typeof alert === 'function') alert({ icon: 'info', text: 'Selecciona un ticket de la lista' });
            return;
        }
        // MODO FAKE: si hubiera backend -> useFetch({ url:this._link, data:{ opc:'regenerate', id:app.selectedId } })
        app.selectTicket(app.selectedId);
    }

    printTicket() {
        if (!app.selectedId) {
            if (typeof alert === 'function') alert({ icon: 'info', text: 'Selecciona un ticket de la lista' });
            return;
        }
        window.print();
    }

    lockedNotice(id) {
        const e = SAMPLE_GENERADOR_DB[id];
        if (!e) return;
        if (typeof alert === 'function') alert({ icon: 'info', text: `El ticket ya esta facturado con el folio ${e.factura}` });
    }
}

// -- Vista --

class GeneradorView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'FacturadorGenerador';
    }

    // -- Render helpers --

    renderHeader(data) {
        const f = app.getFilters();
        this.viewHeader({
            parent:   `viewHeader${this.PROJECT_NAME}`,
            id:       `hdr${this.PROJECT_NAME}`,
            classes:  SAMPLE_GENERADOR_HEADER_CLASSES,
            json:     Object.assign({}, data, { title: `${data.title} · ${_fmtFechaCorta(f.dia)}` }),
            onToggle: (key, value) => console.log('[viewHeader] toggle', key, '->', value)
        });
    }

    renderFooter(data) {
        this.viewFooter({
            parent:  `viewFooter${this.PROJECT_NAME}`,
            id:      `ftr${this.PROJECT_NAME}`,
            classes: SAMPLE_GENERADOR_FOOTER_CLASSES,
            tones:   SAMPLE_GENERADOR_FOOTER_TONES,
            json:    data
        });
    }

    renderPanelHeads() {
        this.panelHead({
            parent: `headPreview${this.PROJECT_NAME}`,
            json: {
                icon:  'printer',
                title: 'Ticket virtual'
            }
        });

        this.noteBox({
            parent: `noteList${this.PROJECT_NAME}`,
            json: {
                text: 'Al generar, el sistema arma una lista de productos puente que suman el total del ticket. Si la combinacion excede el monto, se aplica un descuento para cuadrar.'
            }
        });
    }

    renderListHead(counts) {
        this.panelHead({
            parent: `headList${this.PROJECT_NAME}`,
            json: {
                icon:  'receipt',
                title: 'Tickets del dia (sin efectivo)',
                badges: [
                    { text: `${counts.bloqueados} bloqueados`,  tone: 'b-green'  },
                    { text: `${counts.cero} con IVA 0%`,        tone: 'b-yellow' }
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
            parent: `headPreview${this.PROJECT_NAME}`,
            json: {
                icon:   'printer',
                title:  ticket ? `Ticket virtual · Nota #${ticket.orden}` : 'Ticket virtual',
                badges: ticket ? [{ text: ticket.tasa === 0 ? 'IVA 0%' : 'IVA 16%', tone: ticket.tasa === 0 ? 'b-yellow' : 'b-terra' }] : []
            }
        });

        this.noteBox({
            parent: `previewNote${this.PROJECT_NAME}`,
            class:  'text-[10px] text-ink-400 text-center',
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

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });

        if (!opts.json || !opts.data) {
            wrap.html(`<p class="text-center text-[11px] text-ink-400 py-8">${esc(opts.labels.empty)}</p>`);
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
                <tr><td>DESCUENTO:</td><td class="text-right text-red-700">-${esc(_fmtMX(d.descuento))}</td></tr>
                <tr><td class="font-bold text-[13px]">TOTAL:</td><td class="text-right font-bold text-[13px]">${esc(_fmtMX(e.total))}</td></tr>
            </table>
            <div class="tk-sep"></div>
            <div class="text-center">
                <p>PAGO: ${esc(String(e.metodo).toUpperCase())}</p>
                <p class="mt-1.5">GRACIAS POR SU VISITA</p>
                <p class="mt-1.5 text-ink-500">${esc(m.leyenda)}</p>
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
    }

    noteBox(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'text-[10px] text-ink-500 flex items-start gap-2',
            json:   { icon: 'info', text: '' }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json  = Object.assign({}, defaults.json, o.json || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const iconHtml = opts.json.icon
            ? `<i data-lucide="${esc(opts.json.icon)}" class="w-3.5 h-3.5 text-ink-400 shrink-0 mt-[1px]"></i>`
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
            json:   { icon: '', iconClass: 'w-4 h-4 text-ink-400', title: '', badges: [] },
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
