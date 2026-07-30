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

    // El dia lo resuelve el servidor: el Excel del POS se sube en diferido, asi que
    // el modulo abre en el ultimo dia con cobros por banco. Con ?dia= entra a ese.
    async init() {
        this.dataInit = await useFetch({ url: apiTickets, data: { opc: 'init', dia: this.getParam('dia') } });

        this.render();
    }

    getParam(name) {
        return new URLSearchParams(window.location.search).get(name) || '';
    }

    render() {
        this.layout();
        this.filterBar();
        this.previewActions();
        ticketsView.renderFooter();
        ticketsView.renderListNote();
        this.updateHeaderTitle();
        ticketsView.renderPreview(null);
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
                    class: 'px-3 pt-3 pb-1 bg-[#0E1521] flex-shrink-0'
                },
                {
                    id:    'listHead',
                    class: 'px-4 py-3 bg-[#0E1521] flex items-center justify-between flex-wrap gap-2 flex-shrink-0'
                },
                {
                    id:    'tableRow',
                    class: 'p-3 flex-1 min-h-0 flex flex-col'
                },
                {
                    id:    'listNote',
                    class: 'px-4 py-2 bg-[#141d2b] flex-shrink-0'
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
                        class: 'px-4 py-2 flex-shrink-0'
                    },
                    {
                        type:  'div',
                        id:    'detailActions',
                        class: 'px-3 py-2 bg-[#0E1521] flex-shrink-0'
                    }
                ]
            }
        });

        this.tableLayout();
    }

    // La tabla vive en una tarjeta, como la bitacora de cargas: el p-3 de la fila
    // queda como margen exterior y el fondo de la tarjeta la separa del panel.
    tableLayout() {
        this.createLayout({
            parent: 'tableRow',
            design: false,
            data: {
                id:    'cardTable',
                class: 'w-full flex-1 min-h-0 bg-[#1F2A37] rounded-lg p-4 flex flex-col',
                container: [
                    {
                        type:  'div',
                        id:    'tableWrap',
                        class: 'flex-1 min-h-0 overflow-auto scroll-thin'
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
                text:      'Generar los del 0%',
                color_btn: 'invernal',
                class:     'col-12 col-md-4 col-lg-3',
                onClick:   () => tickets.generateAllZero()
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
            id:         'frmActionsTickets',
            coffeesoft: true,
            theme:      FACTURE_THEME,
            data: [
                {
                    opc:       'button',
                    id:        'btnRegenerar',
                    text:      'Generar',
                    color_btn: 'secondary',
                    class:     'col-6',
                    onClick:   () => tickets.generate()
                },
                {
                    opc:       'button',
                    id:        'btnImprimir',
                    text:      'Imprimir',
                    color_btn: 'invernal',
                    class:     'col-6',
                    onClick:   () => tickets.printTicket()
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
        tickets.lsTickets();

        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectTicket(null);
        }
    }

    // El listado ya viene filtrado del servidor: basta con ver si el folio
    // seleccionado sobrevivio al repintado.
    isVisibleAfterFilters(folio) {
        return $(`#tb${this.PROJECT_NAME} [data-folio="${folio}"]`).length > 0;
    }

    // Copy de la cabecera del modulo. No son datos: tickets, emisor y renglones del
    // ticket virtual se consultan al servidor.
    updateHeaderTitle() {
        const header = {
            title:    'Tickets',
            subtitle: 'Tickets virtuales del dia, de lo cobrado por banco. Lo pagado en efectivo no se muestra. Las notas se reinician cada dia',
            back:     { href: '/app/facture/index.php', title: 'Regresar al Facturador' }
        };

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const f         = this.getFilters();
        const fecha     = String(f.dia || '').split('-').reverse().join('/');
        const titleHtml = `${header.title} <span class="font-bold" style="color:#1C64F2;">&middot; ${esc(fecha)}</span>`;

        ticketsView.renderHeader(Object.assign({}, header, { titleHtml }));
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }

    // -- Facade --

    // El papel se pide al servidor: si el ticket ya se genero llegan los renglones
    // guardados y si no, la propuesta con la que se armaria.
    async selectTicket(folio) {
        this.selectedId = folio;
        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');

        if (!folio) return ticketsView.renderPreview(null);

        $(`#tb${this.PROJECT_NAME} [data-folio="${folio}"]`).closest('tr').addClass('row-active');

        const data = await useFetch({ url: apiTickets, data: { opc: 'getTicket', folio: folio } });

        if (data.status !== 200) {
            ticketsView.renderPreview(null, data.message);
            return;
        }

        ticketsView.renderPreview(data.ticket);
    }
}

// -- Tickets --

class Tickets extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'tickets';
    }

    // -- Data --

    // Columnas: 1 Nota, 2 Folio, 3 Mesero, 4 Tasa, 5 Estado, 6 Monto.
    async lsTickets() {
        const data = await useFetch({ url: apiTickets, data: Object.assign({ opc: 'lsTickets' }, app.getFilters()) });

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        FACTURE_THEME,
            center:       [1, 4, 5],
            right:        [6],
            actionsAlign: 'right',
            extends:      true,
            scrollable:   false,
            hover:        true,
            f_size:       11,
            border_table: 'border-0',
            emptyMessage: 'No hay cobros por banco en el dia seleccionado',
            emptyIcon:    'ic-file-text',
            data:         data
        });

        if (window.lucide) lucide.createIcons();

        const counts = data.counts || { facturados: 0, cero: 0, generados: 0, mostrados: 0 };

        ticketsView.renderListHead(counts);

        app.updateFooterInfo(`Mostrando ${counts.mostrados} ticket${counts.mostrados !== 1 ? 's' : ''} cobrados por banco`);
    }

    // -- Actions --

    // Los del 0% son el trabajo del cierre: sin IVA trasladado el ticket del POS no
    // sirve para facturar, asi que se les arma su ticket virtual de una pasada.
    generateAllZero() {
        this.swalQuestion({
            extends: true,
            opts: {
                title:             'Generar tickets virtuales',
                text:              'Se generaran los tickets virtuales del dia que van al 0% y aun no tienen uno.',
                icon:              'question',
                confirmButtonText: 'Si, generar',
                cancelButtonText:  'No'
            }
        }).then(async (result) => {
            if (!result.isConfirmed) return;

            const response = await useFetch({ url: apiTickets, data: Object.assign({ opc: 'generateAllZero' }, app.getFilters()) });

            this.afterGenerate(response, response.folio);
        });
    }

    // Genera (o vuelve a generar) el ticket seleccionado. Regenerar conserva su
    // numero de nota: ya se entrego y no puede cambiar.
    async generate() {
        if (!app.selectedId) {
            this.alertBox({ type: 'message', title: 'Selecciona un ticket de la lista' });
            return;
        }

        const response = await useFetch({ url: apiTickets, data: { opc: 'generate', folio: app.selectedId } });

        this.afterGenerate(response, app.selectedId);
    }

    afterGenerate(response, folio) {
        if (response.status === 200) {
            this.lsTickets();
            if (folio) app.selectTicket(folio);
        }

        this.alertBox({
            type:  response.status === 200 ? 'success' : 'error',
            title: response.message,
            timer: response.status === 200 ? 1800 : 0
        });
    }

    printTicket() {
        if (!app.selectedId) {
            this.alertBox({ type: 'message', title: 'Selecciona un ticket de la lista' });
            return;
        }
        window.print();
    }

    async lockedNotice(folio) {
        const data = await useFetch({ url: apiTickets, data: { opc: 'getTicket', folio: folio } });

        if (data.status !== 200) return;

        this.alertBox({ type: 'message', title: `El ticket ya esta facturado con el folio ${data.ticket.factura}` });
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

    renderFooter() {
        this.viewFooter({
            parent: 'viewFooterRow',
            id:     'viewFooter',
            json: {
                info: '',
                legends: [
                    { tone: 'success', label: 'Facturado (bloqueado)'   },
                    { tone: 'info',    label: 'Ticket generado'         },
                    { tone: 'warning', label: 'Requiere ticket virtual' },
                    { tone: 'default', label: 'Pendiente de facturar'   }
                ]
            }
        });
    }

    renderListNote() {
        this.noteBox({
            parent: 'listNote',
            json:   { text: 'Al generar, el sistema arma una lista de productos puente que suman el total del ticket. Los puente se marcan en Catalogos; si la combinacion excede el monto, se aplica un descuento para cuadrar.' }
        });
    }

    renderListHead(counts) {
        this.panelHead({
            parent: 'listHead',
            json: {
                icon:  'receipt',
                title: 'Tickets del dia cobrados por banco',
                badges: [
                    { text: `${counts.generados} generados`,   tone: 'b-blue'   },
                    { text: `${counts.facturados} bloqueados`, tone: 'b-green'  },
                    { text: `${counts.cero} con IVA 0%`,       tone: 'b-yellow' }
                ]
            }
        });
    }

    // El aviso del pie explica el ticket que se esta viendo: cuando no se pudo
    // armar (sin productos puente marcados) dice por que en vez de quedarse mudo.
    renderPreview(ticket, motivo) {
        this.ticketPaper({
            parent: 'ticketPrintArea',
            json:   ticket,
            emisor: app.dataInit.emisor,
            labels: { empty: motivo || 'Sin ticket seleccionado' }
        });

        this.panelHead({
            parent: 'detailHead',
            json: {
                icon:   'printer',
                title:  ticket ? `Ticket virtual · Nota ${ticket.nota}` : 'Ticket virtual',
                badges: ticket
                    ? [
                        { text: ticket.tasaText === '0%' ? 'IVA 0%' : `IVA ${ticket.tasaText}`, tone: ticket.tasaText === '0%' ? 'b-yellow' : 'b-terra' },
                        { text: ticket.generado ? 'guardado' : 'propuesta', tone: ticket.generado ? 'b-blue' : 'b-gray' }
                      ]
                    : []
            }
        });

        this.noteBox({
            parent: 'detailNote',
            class:  'text-[10px] text-gray-400 text-center',
            json: {
                icon: '',
                text: ticket
                    ? `${ticket.lineas.length} renglon(es) de productos puente suman ${ticket.subtotal}, con un descuento de ${ticket.descuento} para cuadrar los ${ticket.total} del ticket.`
                    : (motivo || 'Selecciona un ticket de la lista para armar su ticket virtual.')
            }
        });
    }

    // -- Components --

    // El ticket llega con sus importes ya formateados por el servidor: el papel
    // imprime, no calcula. Los renglones del encabezado que no traen dato (mesa o
    // mesero sin comanda cargada) no se pintan vacios.
    ticketPaper(options) {
        const defaults = {
            parent: 'root',
            id:     'ticketPaper',
            class:  'ticket-paper',
            json:   null,
            emisor: { razon: '', domicilio: '', telefono: '' },
            // El papel no es un comprobante fiscal y lo dice al pie: es la leyenda
            // impresa, no un dato de la sucursal.
            labels: {
                empty:   'Sin ticket seleccionado',
                leyenda: 'Este ticket no es un comprobante fiscal'
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.emisor = Object.assign({}, defaults.emisor, o.emisor || {});
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const wrap = $('<div>', { id: opts.id, class: opts.class });

        if (!opts.json) {
            wrap.html(`<p class="text-center text-[11px] text-gray-400 py-8">${esc(opts.labels.empty)}</p>`);
            $(`#${opts.parent}`).html(wrap);
            return;
        }

        const e = opts.json;
        const m = opts.emisor;

        const row = (k, v) => v ? `<tr><td>${esc(k)}</td><td class="text-right">${esc(v)}</td></tr>` : '';

        const lineas = (e.lineas || []).map(l => `
            <tr>
                <td>${esc(l.cant)}&nbsp;&nbsp;${esc(l.nombre)}</td>
                <td style="text-align:right">${esc(l.importe)}</td>
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
                <tr><td>NOTA:</td><td class="text-right font-bold">${esc(e.nota)}</td></tr>
                ${row('FECHA:',  `${e.fecha} ${e.hora}`)}
                ${row('MESA:',   e.mesa)}
                ${row('MESERO:', e.mesero)}
                ${row('TICKET:', e.folio)}
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
                <tr><td>SUBTOTAL:</td><td class="text-right">${esc(e.subtotal)}</td></tr>
                <tr><td>DESCUENTO:</td><td class="text-right text-red-300">-${esc(e.descuento)}</td></tr>
                <tr><td class="font-bold text-[13px]">TOTAL:</td><td class="text-right font-bold text-[13px]">${esc(e.total)}</td></tr>
            </table>
            <div class="tk-sep"></div>
            <div class="text-center">
                <p>PAGO: ${esc(String(e.metodo).toUpperCase())}</p>
                <p class="mt-1.5">GRACIAS POR SU VISITA</p>
                <p class="mt-1.5 text-gray-400">${esc(opts.labels.leyenda)}</p>
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
