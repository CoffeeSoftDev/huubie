/*  Pedidos › Ventas (pos-ventas): venta de mostrador, fase V1 del plan de Ventas.

    Hereda la captura de Pedidos (OrderForm) y su cobro (OrderPay). Aqui no hay
    fecha ni entrega: «Cobrar» guarda la venta ya pagada en un solo paso.
    La propina va aparte del total. Hasta 5 tickets en espera viven en este
    navegador, por usuario y sucursal; al cobrar, el ticket queda vacio.

    Manda el ctrl (ctrl-ventas.php): aqui solo se arma la venta y se avisa
    antes de mandar. `orders` apunta a esta pantalla porque el turno y el
    cierre llaman orders.can(), orders.paintTurn() y orders.lsOrders(). */

let api = 'ctrl/ctrl-ventas.php';
let sale, orders, orderTurn, orderClosure;
let dataInit = {};

$(async () => {
    dataInit     = (await useFetch({ url: api, data: { opc: 'init' } })) || {};
    orderTurn    = new OrderTurn('ctrl/ctrl-turno.php', 'root');
    orderClosure = new OrderClosure('ctrl/ctrl-cierre.php', 'root');
    sale         = new Sale(api, 'root');
    orders       = sale;

    sale.init();
});

// -- Sale --

class Sale extends OrderForm {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Sale';
        this.tickets      = [];
        this.active       = 1;
        this.pay          = null;
        this.maxTickets   = 5;
    }

    async init() {
        if (dataInit.status != 200) return this.blocked(dataInit.message || 'No se pudo cargar Ventas. Recarga la página.');
        if (!this.canSell('create')) return this.blocked('Tu rol no tiene permiso para cobrar ventas en esta sucursal.');
        if (!(await this.loadOptions())) return this.blocked('No se pudo abrir la venta. Recarga la página.');

        this.pay = new SalePay(this._link, 'root');

        this.restoreTickets();
        this.open();
        this.bindKeys();
    }

    async loadOptions() {
        if (this.loading) return false;

        this.loading = true;

        const data = await useFetch({ url: this._link, data: { opc: 'saleOptions' } });

        this.loading = false;

        if (!data || data.status != 200) {
            this.warnFail(data, 'No se pudo abrir la venta');
            return false;
        }

        this.opts = data;
        this.indexOptions();

        orderTurn.sync(data.turn, false, data.day);

        return true;
    }

    // -- Interface --

    layout() {
        super.layout();

        $('#posOrderBack').attr('class', 'min-w-0 max-w-full');

        $('#posOrderHead').append($('<div>', {
            id:    'saleTurn',
            class: 'ml-auto flex items-center gap-[12px] flex-wrap justify-end'
        }));
    }

    backButton() {
        this.createLayout({
            parent: 'posOrderBack',
            design: false,
            data: {
                id:    'saleTabs',
                class: 'flex items-center gap-[8px] min-w-0',
                container: [
                    {
                        type:  'div',
                        id:    'saleTabsList',
                        class: 'min-w-0'
                    },
                    {
                        type:  'div',
                        id:    'saleTabsAdd',
                        class: 'shrink-0'
                    }
                ]
            }
        });

        this.coffeeForm({
            parent:       'saleTabsAdd',
            id:           'formSaleTabs',
            class:        'flex',
            showRequired: false,
            json: [
                {
                    opc:       'button',
                    id:        'btnSaleTabAdd',
                    class:     'col-12',
                    text:      'Ticket',
                    icon:      'icon-plus',
                    color_btn: 'outline',
                    onClick:   () => this.addTab()
                }
            ]
        });

        this.paintTabs();
        this.paintTurn();
    }

    catalog() {
        const tones = ['#C05A40', '#D97706', '#7C3AED', '#0284C7', '#059669', '#DB2777', '#4F46E5', '#0D9488', '#EA580C', '#65A30D'];

        this.looks = {};

        const categories = (this.opts.categories || []).map((c, i) => {
            const name = this.categoryName(c.name);
            const look = { icon: this.categoryIcon(name), tone: tones[i % tones.length] };

            this.looks[c.id] = look;

            return {
                id:    c.id,
                name:  name,
                total: c.total,
                icon:  look.icon,
                tone:  look.tone
            };
        });

        const json = (this.opts.products || []).map((p) => {
            const look  = this.looks[p.category_id] || { icon: 'package', tone: '#6B7280' };
            const image = String(p.image || '').trim();

            return {
                id:            p.id,
                name:          String(p.name || '').trim(),
                price:         money(p.price),
                category_id:   p.category_id,
                image:         image ? fileUrl(image) : '',
                imageFallback: image && !/^https?:/i.test(image) ? ORDER_FILES_REMOTE + encodeURI(image.replace(/^\/+/, '')) : '',
                sku:           p.sku || '',
                barcode:       p.barcode || '',
                icon:          look.icon,
                tone:          look.tone
            };
        });

        this.posCatalog({
            parent:     'posOrderCatalogMain',
            id:         'posOrderCatalogList',
            json:       json,
            categories: categories,
            actions: [
                {
                    id:      'btnOrderFree',
                    text:    'Línea libre',
                    icon:    'pencil-line',
                    onClick: () => this.free()
                }
            ],
            onAdd: (item) => this.addProduct(item.id)
        });
    }

    ticket() {
        const user = dataInit.user || {};

        this.ticketBox = this.posTicket({
            parent:   'posOrderTicket',
            id:       'posOrderTk',
            title:    `Venta · Ticket ${this.active}`,
            subtitle: user.name ? `Sucursal ${this.opts.branch} · Atiende ${user.name}` : `Sucursal ${this.opts.branch}`,
            tag:      '',
            icon:     'receipt-text',
            section:  { title: 'Cliente y nota', icon: 'user', open: false },
            launcher: { parent: 'posOrderLauncher', text: 'Ver venta' }
        });
    }

    ticketForm() {
        const tk = this.currentTicket();

        $('#posOrderTkForm').empty();

        this.coffeeForm({
            parent:       'posOrderTkForm',
            id:           'formOrderTicket',
            class:        'grid grid-cols-12 gap-x-[10px] gap-y-[2px]',
            showRequired: false,
            json: [
                {
                    opc:      'select',
                    id:       'of_customer_id',
                    lbl:      'Cliente',
                    class:    'col-8',
                    select2:  true,
                    selected: 'Público en general',
                    data:     this.opts.customers || [],
                    value:    tk.customer_id
                },
                {
                    opc:       'button',
                    id:        'btnOfCustomer',
                    class:     'col-4',
                    text:      'Nuevo',
                    icon:      'icon-user-add',
                    color_btn: 'outline',
                    onClick:   () => this.customer()
                },
                {
                    opc:         'textarea',
                    id:          'of_note',
                    lbl:         'Nota',
                    class:       'col-12',
                    rows:        2,
                    required:    false,
                    placeholder: 'Ej. Para llevar, sin cubiertos',
                    value:       tk.note
                }
            ]
        });

        $('#of_note').attr('maxlength', 255);

        $('#formOrderTicket').on('change input', () => {
            this.refreshSummary();
            this.persistTickets();
        });

        this.refreshSummary();
    }

    refreshSummary() {
        const name = this.customerName();
        const note = String($('#of_note').val() || '').trim();

        $('#posOrderTkSummary').text(note ? `${name} · Con nota` : name);
    }

    onEscape(e) {
        if (e.key !== 'Escape' || this.s2Open) return;
        if (window.Swal && Swal.isVisible()) return;

        const sub = $('#modalOrderProduct, #modalOrderFree, #modalOrderCustomer').last();

        if (sub.length) {
            sub.find('.cs-modal-cancel').trigger('click');
            return;
        }

        if ($('.cs-modal-bg, .cf-overlay').length) return;

        $('body').removeClass('pos-tk-open');
    }

    renderLines() {
        this.posTicketLines({
            parent:   'posOrderTkLines',
            id:       'posOrderLines',
            json:     this.lines.map((line, i) => this.lineView(line, i)),
            empty:    { title: 'Venta vacía', text: 'Toca un producto o búscalo con Ctrl K.' },
            onUpdate: (index, quantity) => this.setQuantity(index, quantity),
            onEdit:   (index) => this.editLine(index),
            onDelete: (index) => this.removeLine(index)
        });

        this.flash = -1;
        this.renderTotals();
    }

    renderTotals() {
        const count   = this.lines.length;
        const pieces  = this.lines.reduce((sum, line) => sum + line.quantity, 0);
        const total   = this.saleTotal();
        const caption = count === 0 ? 'Sin productos' : `${count} ${count === 1 ? 'partida' : 'partidas'} · ${pieces} ${pieces === 1 ? 'pieza' : 'piezas'}`;
        const json    = count ? [{ text: 'IVA incluido', value: money(this.round2(total - total / 1.16)), tone: 'muted' }] : [];
        const actions = [
            {
                id:       'btnSaleClear',
                text:     '',
                icon:     'trash-2',
                class:    'ghost sale-tk-icon',
                disabled: !count,
                onClick:  () => this.clearSale()
            }
        ];

        if (this.canSell('print')) {
            actions.push({
                id:       'btnSalePreview',
                text:     '',
                icon:     'printer',
                class:    'ghost sale-tk-icon',
                disabled: !count,
                onClick:  () => this.previewSale()
            });
        }

        actions.push({
            id:       'btnSaleCharge',
            text:     'Cobrar',
            icon:     'banknote',
            class:    'ok',
            disabled: !count,
            onClick:  () => this.charge()
        });

        this.posTicketTotals({
            parent:  'posOrderTkFoot',
            id:      'posOrderTotals',
            json:    json,
            total:   { label: 'Total', caption: caption, value: money(total) },
            after:   [],
            actions: actions
        });

        $('#btnSaleClear').attr({ title: 'Vaciar venta', 'aria-label': 'Vaciar venta' });
        $('#btnSalePreview').attr({ title: 'Imprimir pre-cuenta', 'aria-label': 'Imprimir pre-cuenta' });

        $('#posOrderTkLauncherCount').text(pieces);
        $('#posOrderTkLauncherTotal').text(money(total));
        $(`#tab-saleTk${this.active} .sale-tab-count`).text(pieces);

        this.persistTickets();
    }

    paintTurn() {
        if (!$('#saleTurn').length) return;

        const turn    = dataInit.turn;
        const day     = dataInit.day || {};
        const pending = day.pending && day.pending.length ? day.pending[0] : '';

        let tone = 'is-none';
        let text = 'Sin turno abierto';

        if (turn && turn.old) {
            tone = 'is-old';
            text = `Turno ${turn.folio} de otro día`;
        } else if (turn) {
            tone = 'is-open';
            text = `Turno ${turn.folio} · desde ${ordHour(String(turn.opened_at).slice(11, 16))}`;
        } else if (day.closed) {
            tone = 'is-closed';
            text = 'Día cerrado';
        } else if (pending) {
            tone = 'is-old';
            text = `Falta cerrar el ${ordDate(pending).slice(0, 5)}`;
        }

        this.createLayout({
            parent: 'saleTurn',
            design: false,
            data: {
                id:    'saleTurnBody',
                class: 'flex items-center gap-[12px] flex-wrap justify-end',
                container: [
                    {
                        type:  'span',
                        id:    'saleKeys',
                        class: 'hidden xl:inline text-[12px] text-gray-500',
                        text:  'F2 Cobrar · F8 Cliente · F9 Descuento'
                    },
                    {
                        type:  'span',
                        id:    'turnChipSale',
                        class: `ord-turn-chip ${tone}`,
                        html:  `<span class="ord-turn-dot"></span>${esc(text)}`
                    },
                    {
                        type:  'div',
                        id:    'saleTurnButtons',
                        class: 'flex'
                    }
                ]
            }
        });

        this.coffeeForm({
            parent:       'saleTurnButtons',
            id:           'formHeaderSale',
            class:        'flex flex-wrap gap-[8px]',
            showRequired: false,
            json: [
                {
                    opc:       'button',
                    id:        'btnTurnSale',
                    class:     'col-auto',
                    text:      'Turno actual',
                    icon:      'icon-clock',
                    color_btn: 'outline',
                    onClick:   () => orderTurn.open()
                },
                {
                    opc:       'button',
                    id:        'btnDaySale',
                    class:     'col-auto',
                    text:      'Cierre del día',
                    icon:      'icon-calendar-check-o',
                    color_btn: 'outline',
                    onClick:   () => orderClosure.open(pending)
                }
            ]
        });
    }

    paintTabs() {
        if (!$('#saleTabsList').length) return;

        this.tabLayout({
            parent:          'saleTabsList',
            id:              'saleTabList',
            type:            'button',
            theme:           'light',
            class:           'max-w-full',
            renderContainer: false,
            json: this.tickets.map((t) => ({
                id:      `saleTk${t.n}`,
                tab:     this.tabLabel(t),
                active:  t.n === this.active,
                onClick: () => this.switchTo(t.n)
            }))
        });

        $('#saleTabList .sale-tab-x').on('click', (e) => {
            e.stopPropagation();
            this.closeTab(Number($(e.currentTarget).data('n')));
        });
    }

    tabLabel(t) {
        const pieces = t.lines.reduce((sum, line) => sum + line.quantity, 0);

        return `Ticket ${t.n}<span class="sale-tab-count">${pieces}</span><span class="sale-tab-x" data-n="${t.n}" title="Cerrar ticket ${t.n}">×</span>`;
    }

    blocked(message) {
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:    'blockedSale',
                class: 'ord-aviso',
                container: [
                    {
                        type:  'i',
                        class: 'icon-lock text-[22px]'
                    },
                    {
                        type:  'div',
                        class: 'flex flex-col',
                        children: [
                            { type: 'p', class: 'ord-aviso-titulo', text: message },
                            { type: 'p', class: 'ord-aviso-texto', text: 'Si crees que es un error, pide acceso a quien administra Huubie.' }
                        ]
                    }
                ]
            }
        });
    }

    bindKeys() {
        $(document).off('keydown.sale').on('keydown.sale', (e) => {
            if (!['F2', 'F8', 'F9'].includes(e.key)) return;

            e.preventDefault();

            if ($('.cs-modal-bg, .cf-overlay').length || (window.Swal && Swal.isVisible())) return;

            if (e.key === 'F2') return this.charge();
            if (e.key === 'F9') return this.charge({ discount: true });

            this.focusCustomer();
        });
    }

    focusCustomer() {
        const select = $('#of_customer_id');

        if (this.ticketBox) this.ticketBox.section(true);

        if (select.data('select2')) select.select2('open');
        else select.trigger('focus');
    }

    previewSale() {
        if (!this.lines.length) return this.warn('Agrega al menos un producto.');

        const user  = dataInit.user || {};
        const total = this.saleTotal();
        const row   = (a, b, strong) => `<tr${strong ? ' class="b"' : ''}><td>${a}</td><td class="r">${b}</td></tr>`;

        const lines = this.lines.map((line) => {
            const extra = line.details ? `<div class="s">Obs.: ${esc(line.details)}</div>` : '';

            return `<tr><td>${line.quantity} × ${esc(line.name)}${extra}</td><td class="r">${money(this.unitPrice(line) * line.quantity)}</td></tr>`;
        }).join('');

        const body = `
            <h1>Pre-cuenta</h1>
            <div class="c">${esc(this.opts.branch)}</div>
            <div class="c s">Ticket ${this.active} · ${ordNow()}</div>
            <hr>
            <table>
                ${row('Atiende', esc(user.name || ''))}
                ${row('Cliente', esc(this.customerName()))}
            </table>
            <hr>
            <table>${lines}</table>
            <hr>
            <table>
                ${row('Total', money(total), true)}
                ${row('IVA incluido', money(this.round2(total - total / 1.16)))}
            </table>
            <hr>
            <div class="c"><b>PRE-CUENTA · NO ES COMPROBANTE</b></div>`;

        ordPrint('Pre-cuenta', body);
    }

    printSale(t) {
        const row = (a, b, strong) => `<tr${strong ? ' class="b"' : ''}><td>${a}</td><td class="r">${b}</td></tr>`;

        const lines = (t.lines || []).map((l) => {
            const extra = l.details ? `<div class="s">Obs.: ${esc(l.details)}</div>` : '';

            return `<tr><td>${Number(l.quantity)} × ${esc(l.name)}${extra}</td><td class="r">${money(l.amount)}</td></tr>`;
        }).join('');

        const payments = (t.payments || []).map((p) => {
            const change = p.cash && Number(p.change) > 0
                ? `<tr><td colspan="2" class="s">Recibió ${money(p.tendered)} · cambio ${money(p.change)}</td></tr>`
                : '';

            return row(esc(p.method), money(p.amount)) + change;
        }).join('');

        const tip  = Number(t.tip) > 0;
        const body = `
            <h1>Venta V${esc(t.folio)}</h1>
            <div class="c">${esc(t.branch)}</div>
            <div class="c s">${ordDate(t.date, true)}</div>
            <hr>
            <table>
                ${row('Atiende', esc(t.user))}
                ${row('Cliente', esc(t.customer))}
            </table>
            <hr>
            <table>${lines}</table>
            <hr>
            <table>
                ${t.discount ? row('Subtotal', money(t.subtotal)) : ''}
                ${t.discount ? row(`Descuento${t.discount.reason ? ' · ' + esc(t.discount.reason) : ''}`, '−' + money(t.discount.amount)) : ''}
                ${row('Total', money(t.total), true)}
                ${tip ? row('Propina', money(t.tip)) : ''}
                ${tip ? row('Cobrado', money(t.charged), true) : ''}
                ${payments}
            </table>
            <hr>
            <div class="c s">IVA incluido · Impreso ${ordNow()}</div>`;

        ordPrint(`Venta V${t.folio}`, body);
    }

    // -- CRUD --

    charge(options = {}) {
        if (!this.lines.length) return this.warn('Agrega al menos un producto.');

        const turn = dataInit.turn;

        if (!turn || turn.old) {
            orderTurn.locked({
                title:   turn ? 'Turno de otro día' : 'Sin turno abierto',
                message: turn
                    ? `El turno ${turn.folio} es de otro día. Ciérralo y abre el de hoy para cobrar.`
                    : 'Abre un turno de caja en esta sucursal para cobrar.'
            });
            return;
        }

        if (!(this.opts.methods || []).length) {
            alert({
                icon:     'warning',
                title:    'Sin métodos de pago',
                text:     'La empresa no tiene métodos de pago activos.',
                btn1:     true,
                btn1Text: 'Entendido'
            });
            return;
        }

        this.pay.openSale(options);
    }

    async afterSale(data) {
        const t = data.ticket || {};

        this.resetTicket();

        const change = Number(data.change) > 0.005
            ? `<p class="text-[12px] font-semibold uppercase tracking-wide mb-0">Cambio</p><p class="text-[32px] font-bold text-emerald-600 leading-tight mb-2">${money(data.change)}</p>`
            : '';

        const answer = await alert({
            icon:     'success',
            title:    data.message,
            html:     `${change}<p class="text-[14px] mb-0">Cobrado <b>${money(t.charged)}</b></p>`,
            btn1:     this.canSell('print'),
            btn1Text: 'Imprimir ticket',
            btn2:     true,
            btn2Text: 'Nueva venta'
        });

        if (answer && answer.isConfirmed) this.printSale(t);
    }

    addTab() {
        if (this.tickets.length >= this.maxTickets) {
            alert({
                icon:     'info',
                title:    'Tickets en espera',
                text:     `Puedes tener hasta ${this.maxTickets} tickets abiertos a la vez.`,
                btn1:     true,
                btn1Text: 'Entendido'
            });
            return;
        }

        let n = 1;

        while (this.tickets.some((t) => t.n === n)) n++;

        this.persistTickets();

        this.tickets.push(this.blankTicket(n));
        this.tickets.sort((a, b) => a.n - b.n);

        this.active = n;
        this.lines  = [];
        this.flash  = -1;

        this.paintTabs();
        this.ticket();
        this.ticketForm();
        this.renderLines();
    }

    switchTo(n) {
        if (n === this.active) return;

        this.persistTickets();

        this.active = n;
        this.lines  = this.currentTicket().lines.map((line) => ({ ...line }));
        this.flash  = -1;

        this.ticket();
        this.ticketForm();
        this.renderLines();
    }

    async closeTab(n) {
        const tk = this.tickets.find((t) => t.n === n);

        if (!tk) return;
        if (n === this.active) this.persistTickets();

        if (tk.lines.length) {
            const answer = await this.swalQuestion({
                opts: {
                    title:             `¿Cerrar el ticket ${n}?`,
                    text:              'Los productos de este ticket se pierden.',
                    confirmButtonText: 'Cerrar ticket',
                    cancelButtonText:  'Conservar'
                },
                extends: true
            });

            if (!answer || !answer.isConfirmed) return;
        }

        const wasActive = n === this.active;

        this.tickets = this.tickets.filter((t) => t.n !== n);

        if (!this.tickets.length) this.tickets = [this.blankTicket(1)];

        if (wasActive) {
            this.active = this.tickets[0].n;
            this.lines  = this.currentTicket().lines.map((line) => ({ ...line }));
            this.flash  = -1;

            this.ticket();
            this.ticketForm();
            this.renderLines();
        }

        this.paintTabs();
        this.persistTickets();
    }

    async clearSale() {
        if (!this.lines.length) return;

        const answer = await this.swalQuestion({
            opts: {
                title:             '¿Vaciar la venta?',
                text:              `Se quitan los productos, el cliente y la nota del ticket ${this.active}.`,
                confirmButtonText: 'Vaciar',
                cancelButtonText:  'Conservar'
            },
            extends: true
        });

        if (answer && answer.isConfirmed) this.resetTicket();
    }

    resetTicket() {
        const tk = this.currentTicket();

        tk.lines       = [];
        tk.customer_id = '';
        tk.note        = '';

        this.lines = [];
        this.flash = -1;

        this.ticketForm();
        this.renderLines();
    }

    // -- Complements --

    customerName() {
        const customer = String($('#of_customer_id').val() || '');

        if (customer === '' || customer === '0') return 'Público en general';

        return $('#of_customer_id option:selected').text().split(' · ')[0].trim();
    }

    saleTotal() {
        return this.round2(this.lines.reduce((sum, line) => sum + this.unitPrice(line) * line.quantity, 0));
    }

    currentTicket() {
        return this.tickets.find((t) => t.n === this.active) || this.tickets[0];
    }

    blankTicket(n) {
        return {
            n:           n,
            lines:       [],
            customer_id: '',
            note:        ''
        };
    }

    ticketKey() {
        const user = dataInit.user || {};

        return `pro:ventas:espera:v1:${user.id || 0}:${dataInit.branch_id || 0}`;
    }

    readTickets() {
        try {
            return JSON.parse(localStorage.getItem(this.ticketKey()) || 'null');
        } catch (e) {
            return null;
        }
    }

    persistTickets() {
        const tk = this.currentTicket();

        if (!tk || !$('#formOrderTicket').length) return;

        const customer = String($('#of_customer_id').val() || '');

        tk.lines       = this.lines.map((line) => ({ ...line }));
        tk.customer_id = customer === '0' ? '' : customer;
        tk.note        = String($('#of_note').val() || '');

        try {
            localStorage.setItem(this.ticketKey(), JSON.stringify({ active: this.active, tickets: this.tickets }));
        } catch (e) {
            return;
        }
    }

    restoreTickets() {
        const saved     = this.readTickets();
        const products  = new Map((this.opts.products || []).map((p) => [Number(p.id), p]));
        const customers = new Set((this.opts.customers || []).map((c) => String(c.id)));
        const seen      = new Set();

        let dropped = 0;

        this.tickets = (saved && Array.isArray(saved.tickets) ? saved.tickets : [])
            .filter((t) => {
                const n  = Number(t && t.n);
                const ok = Number.isInteger(n) && n >= 1 && n <= this.maxTickets && !seen.has(n);

                if (ok) seen.add(n);

                return ok;
            })
            .map((t) => {
                const lines = [];

                (Array.isArray(t.lines) ? t.lines : []).forEach((line) => {
                    const quantity = line ? this.qty(line.quantity, 9999) : null;

                    if (quantity === null) {
                        dropped++;
                        return;
                    }

                    if (line.type === 'free') {
                        const name  = String(line.name || '').trim();
                        const price = this.amount(line.price);

                        if (!name || price === null) {
                            dropped++;
                            return;
                        }

                        lines.push({
                            id:         0,
                            type:       'free',
                            name:       name,
                            price:      price,
                            quantity:   quantity,
                            details:    String(line.details || ''),
                            dedication: ''
                        });
                        return;
                    }

                    const product = line.type === 'product' ? products.get(Number(line.product_id)) : null;

                    if (!product) {
                        dropped++;
                        return;
                    }

                    lines.push({
                        id:         0,
                        type:       'product',
                        product_id: Number(product.id),
                        name:       product.name,
                        price:      Number(product.price),
                        quantity:   quantity,
                        details:    String(line.details || ''),
                        dedication: ''
                    });
                });

                const customer = String(t.customer_id || '');

                return {
                    n:           Number(t.n),
                    lines:       lines.slice(0, 100),
                    customer_id: customers.has(customer) ? customer : '',
                    note:        String(t.note || '').slice(0, 255)
                };
            })
            .sort((a, b) => a.n - b.n);

        if (!this.tickets.length) this.tickets = [this.blankTicket(1)];

        const active = Number(saved && saved.active);

        this.active = this.tickets.some((t) => t.n === active) ? active : this.tickets[0].n;
        this.lines  = this.currentTicket().lines.map((line) => ({ ...line }));

        if (dropped) {
            alert({
                icon:     'info',
                title:    'Tickets en espera actualizados',
                text:     `${dropped} ${dropped === 1 ? 'producto ya no está en el catálogo y se quitó' : 'productos ya no están en el catálogo y se quitaron'}. Los precios se tomaron del catálogo actual.`,
                btn1:     true,
                btn1Text: 'Entendido'
            });
        }
    }

    snapshot() {
        return '';
    }

    canAdd() {
        if (this.lines.length < 100) return true;

        this.warn('Una venta admite hasta 100 productos.');

        return false;
    }

    can(action) {
        return (dataInit.actions || []).includes(action);
    }

    canSell(action) {
        return (dataInit.sales || []).includes(action);
    }

    lsOrders() {
        this.paintTurn();
    }
}

// -- SalePay --

class SalePay extends OrderPay {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'SalePay';
        this.tipMode      = 'none';
    }

    openSale(options = {}) {
        if (this.loading || this.saving) return;

        const subtotal = sale.saleTotal();
        const name     = sale.customerName();

        this.o = {
            id:              0,
            folio:           '',
            customer:        name,
            subtotal:        subtotal,
            discount_amount: 0,
            discount_reason: null,
            total:           subtotal,
            paid:            0
        };

        this.thenDeliver  = false;
        this.fromDetail   = false;
        this.methods      = (sale.opts.methods || []).map((m) => ({ id: Number(m.id), name: m.name, code: m.code, cash: Number(m.is_cash) === 1 }));
        this.reasons      = sale.opts.reasons || [];
        this.canAuthorize = !!sale.opts.can_authorize;
        this.discBlock    = '';
        this.token        = ordToken();
        this.mode         = 'all';
        this.lines        = [];
        this.discOpen     = !!options.discount && this.reasons.length > 0;
        this.discMode     = 'percent';
        this.tipMode      = 'none';
        this.method       = (this.methods.find((m) => m.cash) || this.methods[0]).id;

        this.csModal({
            id:         'modalOrderPay',
            title:      'Cobrar venta',
            subtitle:   `Ticket ${sale.active} · ${name}`,
            lucideIcon: 'banknote',
            width:      'max-w-2xl',
            saveText:   'Cobrar',
            cancelText: 'Volver',
            json:       this.fields(),
            onSave:     (values, close) => this.save(close)
        });

        this.bind();
        this.paint();

        $(this.discOpen ? '#op_reason' : '#op_received').trigger('focus');
    }

    // -- Interface --

    fields() {
        const label = (text) => `<p class="block text-xs font-semibold text-gray-500 mb-1.5">${text}</p>`;
        const tips  = [['none', 'Sin propina'], ['10', '10 %'], ['15', '15 %'], ['other', 'Otra']]
            .map(([mode, text]) => `<button type="button" class="ord-tip" data-tip="${mode}">${text}</button>`)
            .join('');

        return [
            { id: 'op_head', tipo: 'html', class: 'w-full', html: this.head() },
            ...this.discountFields(),
            { id: 'op_tip', tipo: 'html', class: 'w-full sm:w-1/2', html: label('Propina') + `<div id="op_tip_chips" class="flex flex-wrap gap-[8px]">${tips}</div>` },
            { id: 'op_tip_amount', lbl: 'Propina ($)', tipo: 'number', min: 0, step: '0.01', ph: '0.00', class: 'w-full sm:w-1/2 op-tip-other hidden' },
            { id: 'op_methods', tipo: 'html', class: 'w-full', html: label('Método de pago') + '<div id="op_method_chips" class="flex flex-wrap gap-[8px]"></div>' },
            { id: 'op_received', lbl: 'Recibe en efectivo', tipo: 'number', min: 0, step: '0.01', class: 'w-full sm:w-1/2' },
            { id: 'op_bills', tipo: 'html', class: 'w-full sm:w-1/2', html: label('Billetes') + '<div id="op_bill_chips" class="flex flex-wrap gap-[8px]"></div>' },
            {
                id:    'op_lines_box',
                tipo:  'html',
                class: 'w-full',
                html:  '<div id="op_lines"></div><button type="button" class="ord-split"><i data-lucide="plus" class="w-4 h-4"></i>Agregar otro método</button>'
            },
            { id: 'op_totals', tipo: 'html', class: 'w-full', html: '<div id="op_sum"></div>' }
        ];
    }

    head() {
        const tile = (label, value, strong) => `
            <div class="ord-tile rounded-xl border-[1px] border-gray-200 bg-gray-50 px-[14px] py-[10px]">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">${label}</p>
                <p class="text-[18px] font-bold mb-0 ${strong ? 'text-blue-700' : 'text-gray-800'}">${value}</p>
            </div>`;

        return `
            <div class="grid grid-cols-3 gap-[8px]">
                ${tile('Venta', '<span id="op_total"></span>')}
                ${tile('Propina', '<span id="op_tip_value"></span>')}
                ${tile('A cobrar', '<span id="op_balance"></span>', true)}
            </div>`;
    }

    bind() {
        super.bind();

        const modal = $('#modalOrderPay');

        modal.on('click', 'button.ord-tip', (e) => {
            this.tipMode = String($(e.currentTarget).data('tip'));

            if (this.tipMode !== 'other') $('#op_tip_amount').val('');

            this.paint();

            if (this.tipMode === 'other') $('#op_tip_amount').trigger('focus');
        });

        modal.on('input', '#op_tip_amount', () => this.paint());
    }

    paint() {
        super.paint();

        const c = this.calc();

        $('#op_tip_value').text(money(c.tip));
        $('#modalOrderPay .op-tip-other').toggleClass('hidden', this.tipMode !== 'other');

        $('#modalOrderPay button.ord-tip').each((i, el) => {
            $(el).toggleClass('is-active', String($(el).data('tip')) === this.tipMode);
        });
    }

    summary(c) {
        const row  = (label, value) => `<div class="flex items-center justify-between text-[13px] text-gray-600"><span>${label}</span><span class="font-semibold text-gray-800">${value}</span></div>`;
        const name = c.method ? c.method.name : '';
        const over = c.applied > c.target + 0.005;

        let state = '';

        if (c.tipError) {
            state = '<p class="ord-sum-big text-rose-600">Propina no válida</p>';
        } else if (c.badTyped) {
            state = '<p class="ord-sum-big text-rose-600">Monto recibido no válido</p>';
        } else if (over) {
            state = `<p class="ord-sum-big text-rose-600">Sobran ${money(c.applied - c.target)}</p><p class="text-[12px] text-rose-600 mb-0">Con ${esc(name)} no se cobra de más: baja el monto.</p>`;
        } else if (c.missing > 0.005) {
            state = `<p class="ord-sum-big text-rose-600">Faltan ${money(c.missing)}</p><p class="text-[12px] text-gray-500 mb-0">Agrega otro método de pago.</p>`;
        } else if (c.change > 0.005) {
            state = `<p class="text-[12px] font-semibold uppercase tracking-wide text-emerald-700 mb-0">Cambio</p><p class="ord-sum-big text-emerald-600">${money(c.change)}</p>`;
        } else if (c.applied > 0) {
            state = '<p class="ord-sum-big text-emerald-600">Exacto, sin cambio</p>';
        }

        const end = c.missing <= 0.005 && !c.badTyped && !c.tipError && !over
            ? '<div class="text-[12.5px] text-emerald-700 font-semibold mt-1">Queda pagada</div>'
            : '';

        return `
            <div class="ord-sum rounded-xl border-[1px] border-gray-200 bg-gray-50 px-[14px] py-[12px] flex flex-col sm:flex-row gap-[12px] sm:items-center">
                <div class="flex-1 flex flex-col gap-[4px]">
                    ${row('A cobrar', money(c.target))}
                    ${row('Recibido', money(c.tendered))}
                    ${end}
                </div>
                <div class="sm:text-right sm:min-w-[200px]">${state}</div>
            </div>`;
    }

    // -- CRUD --

    async save(close) {
        if (this.saving) return;

        const c = this.calc();

        if (c.tipError) return this.warn(c.tipError);
        if (c.d.error) return this.warn(c.d.error);
        if (c.badTyped) return this.warn('El monto recibido no es válido.');
        if (c.payments.length > 6) return this.warn('Un cobro admite hasta 6 métodos de pago.');
        if (c.missing > 0.005) return this.warn(`Faltan ${money(c.missing)} por recibir. Agrega otro método de pago.`);
        if (c.applied > c.target + 0.005) return this.warn(`Los pagos suman ${money(c.applied)} y la venta es de ${money(c.target)}. Baja el monto con tarjeta o transferencia.`);

        const customer = String($('#of_customer_id').val() || '');

        const discount = c.d.amount > 0
            ? JSON.stringify({
                reason_id: c.d.reason.id,
                percent:   this.discMode === 'percent' ? c.d.value : '',
                amount:    this.discMode === 'amount' ? c.d.value : '',
                note:      String($('#op_disc_note').val() || '').trim()
            })
            : '';

        const payload = {
            opc:         'addSale',
            token:       this.token,
            customer_id: customer === '0' ? '' : customer,
            note:        String($('#of_note').val() || '').trim(),
            tip:         c.tip > 0 ? c.tip.toFixed(2) : '',
            lines:       JSON.stringify(sale.payload()),
            payments:    c.payments.length ? JSON.stringify(c.payments) : '',
            discount:    discount
        };

        this.saving = true;

        const button = $('#modalOrderPay .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: payload });

        this.saving = false;
        button.prop('disabled', false);

        if (data && data.status == 423) {
            this.closeQuiet('modalOrderPay', close);
            orderTurn.locked(data);
            return;
        }

        if (!data || data.status != 200) {
            alert({
                icon:     data && data.status && data.status < 500 ? 'warning' : 'error',
                title:    'No se registró la venta',
                text:     (data && data.message) || 'Revisa la conexión y vuelve a intentar. No se cobra dos veces.',
                btn1:     true,
                btn1Text: 'Entendido'
            });
            return;
        }

        this.closeQuiet('modalOrderPay', close);

        sale.afterSale(data);
    }

    // -- Complements --

    calc() {
        const o         = this.o;
        const d         = this.discountCalc();
        const total     = ordRound(o.total - d.amount);
        const tip       = this.tipCalc(total);
        const balance   = ordRound(total + tip.amount);
        const target    = balance;
        const committed = ordRound(this.lines.reduce((s, l) => s + l.amount, 0));
        const remaining = Math.max(0, ordRound(target - committed));
        const method    = this.methodOf(this.method);
        const raw       = String($('#op_received').val() || '').trim();
        const typed     = raw === '' ? null : ordAmount(raw);
        const badTyped  = raw !== '' && typed === null;

        let current = null;

        if (!badTyped && method) {
            if (typed === null) {
                if (remaining > 0) current = { method_id: method.id, amount: remaining, tendered: remaining };
            } else if (method.cash) {
                const amount = Math.min(typed, remaining);

                if (amount > 0) current = { method_id: method.id, amount: ordRound(amount), tendered: typed };
            } else if (typed > 0) {
                current = { method_id: method.id, amount: typed, tendered: typed };
            }
        }

        const merged = new Map();

        this.lines.concat(current ? [current] : []).forEach((l) => {
            const prev = merged.get(l.method_id);

            merged.set(l.method_id, prev
                ? { method_id: l.method_id, amount: ordRound(prev.amount + l.amount), tendered: ordRound(prev.tendered + l.tendered) }
                : { method_id: l.method_id, amount: l.amount, tendered: l.tendered });
        });

        const payments = Array.from(merged.values()).filter((l) => l.amount > 0);
        const applied  = ordRound(payments.reduce((s, l) => s + l.amount, 0));
        const tendered = ordRound(payments.reduce((s, l) => s + l.tendered, 0));
        const change   = ordRound(tendered - applied);
        const missing  = Math.max(0, ordRound(target - applied));

        return {
            d:         d,
            total:     total,
            tip:       tip.amount,
            tipError:  tip.error,
            balance:   balance,
            target:    target,
            remaining: remaining,
            method:    method,
            typed:     typed,
            badTyped:  badTyped,
            payments:  payments,
            applied:   applied,
            tendered:  tendered,
            change:    change,
            missing:   missing
        };
    }

    tipCalc(total) {
        if (this.tipMode === 'none') return { amount: 0, error: '' };

        if (this.tipMode === 'other') {
            const raw = String($('#op_tip_amount').val() || '').trim();

            if (raw === '') return { amount: 0, error: '' };

            const value = ordAmount(raw);

            return value === null ? { amount: 0, error: 'Escribe una propina válida.' } : { amount: value, error: '' };
        }

        return { amount: ordRound(total * Number(this.tipMode) / 100), error: '' };
    }
}
