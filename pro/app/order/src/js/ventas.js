/*  Pedidos › Ventas (pos-ventas): venta de mostrador, fase V1 del plan de Ventas.

    Hereda la captura de Pedidos (OrderForm) y su cobro (OrderPay). Aqui no hay
    fecha ni entrega: «Cobrar» guarda la venta ya pagada en un solo paso.
    La propina va aparte del total. Hasta 5 tickets en espera viven en este
    navegador, por usuario y sucursal; al cobrar, el ticket queda vacio.

    Credito y monedero (V3) salen del cliente elegido: opts.customers trae su
    saldo de monedero (wallet) y su credito disponible (credit). El monedero es
    un metodo de pago mas, solo si hay saldo; «Resto a crédito» manda lo que
    falte a la cuenta del cliente y la venta queda pendiente.

    Tarjeta de lealtad (V4): se lee en «Cliente, tarjeta y nota» y vive en el
    ticket (tk.card). Si su tipo descuenta, ese es el descuento de la venta
    (no se suma otro); sus puntos van como dinero al monedero del cliente.
    Con dueño, la venta queda a nombre de ese cliente. Al cobrar se vuelve a
    leer por si la desactivaron o le cambiaron el tipo.

    El cobro (SalePay) sigue con tarjetas de método y «Agregar otro método».
    OrderPay pasó a la ventana horizontal de pagos; SalePayBase conserva su
    forma vieja (recibido, billetes y descuento op_*) para la venta.

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
        orderTurn.paintStrip(true);
        this.paintTurn();

        $(document).off('fullscreenchange.sale').on('fullscreenchange.sale', () => this.paintFull());
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

    // sale-pos: colores del tema oscuro como la captura de alpha, solo aquí (order.css).
    layout() {
        super.layout();

        $('#posOrderHost').addClass('sale-pos');
    }

    // Ventas no tiene «Volver a pedidos»: aquí solo se pinta la franja de caja.
    // El cambio a Pedidos va en la franja: «Ir a Pedidos» (components/caja-strip.js).
    backButton() {
        orderTurn.paintStrip(true);
    }

    // El catálogo es el de OrderForm (mismo diseño en Pedidos); aquí solo cambian las acciones.
    catalog() {
        super.catalog();
        this.paintFull();
    }

    // Ventas no tiene «Pastel personalizado».
    catalogActions() {
        const actions = [
            {
                id:      'btnOrderFree',
                text:    'Línea libre',
                icon:    'pencil-line',
                onClick: () => this.free()
            }
        ];

        // Solo si el navegador la permite (iPhone no la tiene).
        if (document.fullscreenEnabled) {
            actions.push({
                id:      'btnSaleFull',
                text:    'Pantalla completa',
                icon:    'maximize',
                onClick: () => this.toggleFull()
            });
        }

        return actions;
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
            section:  { title: 'Cliente, tarjeta y nota', icon: 'user', open: false },
            launcher: { parent: 'posOrderLauncher', text: 'Ver venta' }
        });

        this.ticketTabs();
    }

    // Pestañas de tickets en espera, arriba del ticket. posTicket() vacía el panel
    // cada vez que se llama: por eso se vuelven a montar justo después de él.
    ticketTabs() {
        $('#posOrderTicket').prepend($('<div>', { id: 'saleTabsHost', class: 'shrink-0 mb-[8px]' }));

        this.createLayout({
            parent: 'saleTabsHost',
            design: false,
            data: {
                id:    'saleTabs',
                class: 'flex items-center gap-[8px] min-w-0',
                container: [
                    {
                        type:  'div',
                        id:    'saleTabsList',
                        class: 'flex-1 min-w-0'
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
    }

    ticketForm() {
        const tk    = this.currentTicket();
        const card  = tk.card;
        const owned = !!(card && card.customer_id);
        const json  = [
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
                opc:         'input',
                id:          'of_card',
                lbl:         'Tarjeta de lealtad',
                class:       'col-8',
                required:    false,
                placeholder: 'Lee o escribe el número',
                value:       card ? card.number : '',
                disabled:    !!card
            },
            {
                opc:       'button',
                id:        'btnOfCard',
                class:     'col-4',
                text:      card ? 'Quitar' : 'Leer',
                icon:      'icon-credit-card',
                color_btn: 'outline',
                onClick:   () => this.readCard()
            }
        ];

        if (card) json.push({ opc: 'p', id: 'of_card_hint', class: 'col-12', text: '' });

        json.push({
            opc:         'textarea',
            id:          'of_note',
            lbl:         'Nota',
            class:       'col-12',
            rows:        2,
            required:    false,
            placeholder: 'Ej. Para llevar, sin cubiertos',
            value:       tk.note
        });

        $('#posOrderTkForm').empty();

        this.coffeeForm({
            parent:       'posOrderTkForm',
            id:           'formOrderTicket',
            class:        'grid grid-cols-12 gap-x-[10px] gap-y-[2px]',
            showRequired: false,
            json:         json
        });

        $('#of_note').attr('maxlength', 255);

        // El lector de código de barras escribe el número y manda Enter.
        $('#of_card')
            .attr({ maxlength: 40, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' })
            .on('keydown', (e) => {
                if (e.key !== 'Enter') return;

                e.preventDefault();
                e.stopPropagation();
                this.readCard();
            });

        // Con tarjeta de un cliente, la venta es suya: no se cambia el cliente mientras esté puesta.
        $('#of_customer_id, #btnOfCustomer').prop('disabled', owned);

        $('#formOrderTicket').on('change input', () => {
            this.refreshSummary();
            this.persistTickets();
        });

        this.refreshSummary();
    }

    refreshSummary() {
        const note    = String($('#of_note').val() || '').trim();
        const account = this.customerAccount();
        const card    = this.currentTicket().card;
        const parts   = [this.customerName()];

        if (card) parts.push(`Tarjeta ${card.type}`);
        if (account && account.wallet > 0.005) parts.push(`Monedero ${money(account.wallet)}`);
        if (account && account.credit > 0.005) parts.push(`Crédito ${money(account.credit)}`);
        if (note) parts.push('Con nota');

        $('#posOrderTkSummary').text(parts.join(' · '));

        if (card) $('#of_card_hint').text(this.cardHint(card));
    }

    onEscape(e) {
        if (e.key !== 'Escape' || this.s2Open) return;
        if (window.Swal && Swal.isVisible()) return;

        const sub = $('#modalOrderProduct, #modalOrderFree, #modalOrderCustomer, #modalSaleLineDiscount').last();

        if (sub.length) {
            sub.find('.cs-modal-cancel').trigger('click');
            return;
        }

        if ($('.cs-modal-bg, .cf-overlay').length) return;

        $('body').removeClass('pos-tk-open');
    }

    // sale-lines: estilo de la partida en Ventas (order.css). typing: la cantidad se escribe.
    // stepDelete false: el «−» no se vuelve bote; con cantidad 1 queda apagado.
    renderLines() {
        this.posTicketLines({
            parent:     'posOrderTkLines',
            id:         'posOrderLines',
            class:      'sale-lines',
            json:       this.lines.map((line, i) => this.lineView(line, i)),
            empty:      { title: 'Venta vacía', text: 'Toca un producto o búscalo con Ctrl K.' },
            typing:     true,
            stepDelete: false,
            onUpdate:   (index, quantity) => this.setQuantity(index, quantity),
            onEdit:     (index) => this.editLine(index),
            onDelete:   (index) => this.removeLine(index),
            onDiscount: (index) => this.discountLine(index)
        });

        this.flash = -1;
        this.renderTotals();
    }

    // La partida con descuento lo dice debajo del nombre y su importe ya va neto.
    // Si el producto tiene foto, va en el cuadro de la partida en vez del ícono.
    lineView(line, i) {
        const view  = super.lineView(line, i);
        const off   = this.lineOff(line);
        const photo = line.type === 'product' ? this.photos[line.product_id] : null;

        if (photo && photo.image) {
            view.image         = photo.image;
            view.imageFallback = photo.fallback;
        }

        if (off <= 0) return view;

        const d    = line.discount;
        const rate = d.mode === 'percent' ? ` (${d.value} %)` : '';

        view.sub.push({ tone: 'discount', icon: 'tag', text: `Descuento −${money(off)}${rate} · ${d.reason}` });
        view.amount     = money(this.round2(this.unitPrice(line) * line.quantity - off));
        view.discounted = true;

        return view;
    }

    renderTotals() {
        const count    = this.lines.length;
        const pieces   = this.lines.reduce((sum, line) => sum + line.quantity, 0);
        const subtotal = this.saleTotal();
        const card     = this.currentTicket().card;
        const off      = card && count ? this.cardOff(subtotal, card) : 0;
        const total    = this.round2(subtotal - off);
        const caption  = count === 0 ? 'Sin productos' : `${count} ${count === 1 ? 'partida' : 'partidas'} · ${pieces} ${pieces === 1 ? 'pieza' : 'piezas'}`;
        const json     = [];

        // posTicketTotals escribe text y value como texto: no van con esc().
        if (off > 0) {
            json.push({ text: 'Subtotal', value: money(subtotal), tone: 'muted' });
            json.push({ text: `Tarjeta ${card.type} · ${card.discount_percent} %`, value: '−' + money(off), tone: 'discount' });
        }

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

    // La venta siempre se pinta, sin nada encima. Sin turno no deja agregar productos
    // ni cobrar: turnReady() pide abrirlo. El turno y el cierre llaman orders.paintTurn()
    // en cada cambio. this.pay: init() ya terminó.
    paintTurn() {
        if (!this.pay) return;

        if (!$('#posOrderHost').length) this.open();
    }

    // El botón de pantalla completa dice en qué estado está (ícono y título).
    paintFull() {
        const button = $('#btnSaleFull');

        if (!button.length) return;

        const on    = !!document.fullscreenElement;
        const label = on ? 'Salir de pantalla completa' : 'Pantalla completa';

        button.attr({ title: label, 'aria-label': label });
        button.children('svg, i').replaceWith($('<i>', { 'data-lucide': on ? 'minimize' : 'maximize', 'aria-hidden': 'true' }));

        if (window.lucide) lucide.createIcons({ root: button[0] });
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

    blocked(message, text = 'Si crees que es un error, pide acceso a quien administra Huubie.') {
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
                            { type: 'p', class: 'ord-aviso-texto', text: text }
                        ]
                    }
                ]
            }
        });
    }

    /*  Pantalla completa del navegador (como F11). Se pide para la página entera:
        los modales del cobro cuelgan de <body> y así siguen a la vista.
        Con el teclado tomado (Chrome / Edge) un Esc cierra el modal sin sacar de
        la pantalla completa; para salir, el mismo botón o Esc sostenido. */
    toggleFull() {
        if (document.fullscreenElement) {
            document.exitFullscreen();
            return;
        }

        document.documentElement.requestFullscreen()
            .then(() => {
                if (navigator.keyboard && navigator.keyboard.lock) navigator.keyboard.lock(['Escape']).catch(() => { });
            })
            .catch(() => this.warn('El navegador no permitió la pantalla completa.'));
    }

    // La pre-cuenta sale con el formato del ticket (el de alpha), marcada «PRE-CUENTA».
    // Arma lo mismo que manda el ctrl al cobrar, con lo que hay en pantalla.
    previewSale() {
        if (!this.lines.length) return this.warn('Agrega al menos un producto.');

        const card     = this.currentTicket().card;
        const subtotal = this.saleTotal();
        const off      = card ? this.cardOff(subtotal, card) : 0;

        const lines = this.lines.map((line) => {
            const cut = this.lineOff(line);

            return {
                name:     line.name,
                quantity: line.quantity,
                details:  line.details,
                discount: cut,
                reason:   cut > 0 ? line.discount.reason : '',
                amount:   this.round2(this.unitPrice(line) * line.quantity - cut)
            };
        });

        ordPrintTicket({
            branch:   this.opts.branch,
            user:     (dataInit.user || {}).name || '',
            customer: this.customerName(),
            card:     card || null,
            lines:    lines,
            subtotal: subtotal,
            discount: off > 0 ? { amount: off, reason: `Tarjeta ${card.type}` } : null,
            total:    this.round2(subtotal - off)
        }, { draft: this.active });
    }

    // El formato es el del ticket de alpha: ordPrintTicket (pedido-detalle.js).
    printSale(t) {
        ordPrintTicket(t);
    }

    // -- CRUD --

    async charge(options = {}) {
        if (!this.lines.length) return this.warn('Agrega al menos un producto.');
        if (!this.turnReady('cobrar')) return;

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

        if (this.charging) return;

        this.charging = true;

        const fresh = await this.freshCard();

        this.charging = false;

        if (!fresh) return;

        this.pay.openSale(options);
    }

    async afterSale(data) {
        const t = data.ticket || {};

        this.syncAccount(data.customer);
        this.resetTicket();

        const change = Number(data.change) > 0.005
            ? `<p class="text-[12px] font-semibold uppercase tracking-wide mb-0">Cambio</p><p class="text-[32px] font-bold text-emerald-600 leading-tight mb-2">${money(data.change)}</p>`
            : '';

        const credit = Number(data.credit) > 0.005
            ? `<p class="text-[14px] text-amber-700 mb-0">A crédito <b>${money(data.credit)}</b></p>`
            : '';

        const points = Number(data.points) > 0.005
            ? `<p class="text-[14px] text-emerald-700 mb-0">Puntos <b>${money(data.points)}</b> al monedero</p>`
            : '';

        // Sellos de la tarjeta: el premio canjeado, los que sumó y cómo quedó.
        const s      = data.stamps;
        const earned = s && s.earned > 0 ? `+${s.earned} ${s.earned === 1 ? 'sello' : 'sellos'} · ` : '';
        const told   = s && s.whatsapp && ['sent', 'simulated'].includes(s.whatsapp.status)
            ? `<p class="text-[12.5px] text-gray-500 mb-0">Completó un premio: le avisamos por WhatsApp${s.whatsapp.status === 'simulated' ? ' (simulado)' : ''}.</p>`
            : '';
        const have   = s && s.balance >= s.goal ? `<b>${s.balance}</b> sellos: premio listo` : (s ? `<b>${s.balance} de ${s.goal}</b> sellos` : '');
        const stamps = s
            ? `<p class="text-[14px] text-emerald-700 mb-0">${s.reward ? `Premio canjeado: <b>${esc(s.reward.name)}</b> · ` : ''}${earned}lleva ${have}</p>${told}`
            : '';

        // V7: «Enviar por WhatsApp» es el botón del medio (deny de SweetAlert).
        const share = !!(data.share && data.share.link);

        const asking = alert({
            icon:     'success',
            title:    data.message,
            html:     `${change}<p class="text-[14px] mb-0">Cobrado <b>${money(t.charged)}</b></p>${credit}${points}${stamps}`,
            btn1:     this.canSell('print'),
            btn1Text: 'Imprimir ticket',
            btn2:     true,
            btn2Text: 'Nueva venta',
            btn3:     share,
            btn3Text: 'Enviar por WhatsApp'
        });

        // El deny de SweetAlert sale rojo, como si borrara algo: se pinta verde.
        // alert() y compact.css solo le dan medida a confirm y cancel: se le copia aqui.
        const deny = share && window.Swal && Swal.getDenyButton ? Swal.getDenyButton() : null;

        if (deny) {
            deny.classList.add('text-white', 'py-2', 'px-4', 'rounded');
            deny.style.backgroundColor = '#059669';
            deny.style.setProperty('font-size', '0.8rem', 'important');
        }

        const answer = await asking;

        if (answer && answer.isConfirmed) this.printSale(t);
        if (answer && answer.isDenied)    this.ticketShare(data.share, t);
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

        const what = this.currentTicket().card ? 'el cliente, la tarjeta y la nota' : 'el cliente y la nota';

        const answer = await this.swalQuestion({
            opts: {
                title:             '¿Vaciar la venta?',
                text:              `Se quitan los productos, ${what} del ticket ${this.active}.`,
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
        tk.card        = null;

        this.lines = [];
        this.flash = -1;

        this.ticketForm();
        this.renderLines();
    }

    // -- Descuento por producto --

    // Mismas reglas que el descuento de la venta: motivo, tope del motivo y su permiso,
    // pero sobre el importe de la partida. Se vuelve a revisar en el servidor (lineDiscount).
    discountLine(index) {
        const line    = this.lines[index];
        const reasons = this.opts.reasons || [];

        if (!line) return;

        if (!reasons.length) {
            alert({ icon: 'info', title: 'Sin motivos de descuento', text: 'No hay motivos de descuento dados de alta para esta empresa.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        const d     = line.discount || null;
        const lock  = this.opts.can_authorize ? '' : ' · requiere Dueño o Supervisor';
        const gross = this.round2(this.unitPrice(line) * line.quantity);

        this.subModal({
            id:         'modalSaleLineDiscount',
            title:      'Descuento del producto',
            subtitle:   `${line.quantity} × ${line.name} · ${money(gross)}`,
            lucideIcon: 'tag',
            width:      'max-w-md',
            saveText:   d ? 'Guardar' : 'Aplicar',
            action:     d ? { text: 'Quitar descuento', lucideIcon: 'x', onClick: () => this.removeLineDiscount(index) } : null,
            json: [
                {
                    id:       'ld_reason_id',
                    lbl:      'Motivo',
                    tipo:     'select',
                    required: true,
                    empty:    '— Elige el motivo —',
                    value:    d ? d.reason_id : '',
                    class:    'w-full',
                    data:     reasons.map((r) => ({
                        id:    r.id,
                        valor: `${r.name} (hasta ${Number(r.max_percent)} %)${Number(r.requires_authorization) === 1 ? lock : ''}`
                    }))
                },
                {
                    id:    'ld_mode',
                    lbl:   'En',
                    tipo:  'select',
                    empty: false,
                    value: d ? d.mode : 'percent',
                    class: 'w-1/2',
                    data:  [{ id: 'percent', valor: '% del importe' }, { id: 'amount', valor: '$ pesos' }]
                },
                { id: 'ld_value', lbl: 'Descuento', tipo: 'number', required: true, min: 0, step: '0.01', ph: '0', value: d ? d.value : '', class: 'w-1/2' }
            ],
            onSave: (values, close) => this.saveLineDiscount(index, values, close)
        });
    }

    saveLineDiscount(index, values, close) {
        const line   = this.lines[index];
        const reason = (this.opts.reasons || []).find((r) => String(r.id) === String(values.ld_reason_id));
        const raw    = String(values.ld_value || '').trim();
        const value  = this.amount(raw);

        if (!line) return close();
        if (!reason) return this.warn('Elige el motivo del descuento.');
        if (raw === '') return this.warn('Escribe el descuento.');
        if (value === null || value <= 0) return this.warn('El descuento tiene que ser mayor a 0, con hasta 2 decimales.');

        const discount = { reason_id: Number(reason.id), reason: reason.name, mode: values.ld_mode === 'amount' ? 'amount' : 'percent', value: value };
        const error    = this.lineDiscountFail(line, discount);

        if (error) return this.warn(error);

        close();

        line.discount = discount;
        this.flash    = index;
        this.renderLines();
    }

    removeLineDiscount(index) {
        const line = this.lines[index];

        $('#modalSaleLineDiscount .cs-modal-cancel').trigger('click');

        if (!line) return;

        delete line.discount;

        this.flash = index;
        this.renderLines();
    }

    // Con descuento en pesos, bajar la cantidad puede pasar el tope del motivo: se avisa y no se cambia.
    setQuantity(index, quantity) {
        const line = this.lines[index];

        if (line && line.discount && quantity >= 1 && quantity <= 9999) {
            const error = this.lineDiscountFail({ ...line, quantity: quantity }, line.discount);

            if (error) {
                this.renderLines();
                return this.warn(`${error} Cambia o quita el descuento antes de cambiar la cantidad.`);
            }
        }

        super.setQuantity(index, quantity);
    }

    // Editar la partida (producto o línea libre) la rehace: el descuento se conserva si todavía cabe.
    putLine(index, line) {
        const old = index === undefined ? null : this.lines[index];

        if (old && old.discount && !line.discount) {
            const next = { ...line, discount: old.discount };

            if (this.lineDiscountFail(next, old.discount)) {
                alert({ icon: 'info', title: 'Descuento quitado', text: `Con el cambio, el descuento de «${line.name}» ya no cabe. Vuelve a aplicarlo si hace falta.`, btn1: true, btn1Text: 'Entendido' });
            } else {
                line = next;
            }
        }

        super.putLine(index, line);
    }

    // El servidor recalcula el monto: aquí solo viaja lo que se eligió.
    payload() {
        return super.payload().map((item, i) => {
            const d = this.lines[i].discount;

            return d ? { ...item, discount: { reason_id: String(d.reason_id), mode: d.mode, value: String(d.value) } } : item;
        });
    }

    // -- Tarjeta de lealtad --

    // Lee el número escrito (o el del lector). Con tarjeta puesta, el mismo botón la quita.
    async readCard() {
        if (this.reading) return;
        if (this.currentTicket().card) return this.removeCard();

        const number = String($('#of_card').val() || '').toUpperCase().replace(/\s+/g, '');

        if (!number) {
            $('#of_card').trigger('focus');
            return this.warn('Escribe o lee el número de la tarjeta.');
        }

        const n = this.active;

        this.reading = true;
        $('#btnOfCard').prop('disabled', true);

        const data = await useFetch({ url: this._link, data: { opc: 'getCard', number: number } });

        this.reading = false;
        $('#btnOfCard').prop('disabled', false);

        if (!data || data.status != 200 || !data.card) return this.cardFail(data, 'No se leyó la tarjeta');
        if (n !== this.active) return;

        this.applyCard(data.card, data.customer);
    }

    // Pone la tarjeta en el ticket. Con dueño, la venta pasa a ese cliente.
    applyCard(card, owner) {
        const clean = this.cardOf(card);
        const tk    = this.currentTicket();

        if (!clean) return;

        this.persistTickets();

        tk.card = clean;

        if (clean.customer_id && owner) {
            this.keepCustomer(owner);
            tk.customer_id = String(owner.id);
        }

        this.ticketForm();
        this.renderTotals();
    }

    // El dueño de la tarjeta, con su saldo al día, en la lista de clientes del ticket.
    keepCustomer(c) {
        if (!this.opts.customers) this.opts.customers = [];

        const prev    = this.opts.customers.find((x) => String(x.id) === String(c.id));
        const balance = { wallet: Number(c.wallet) || 0, credit: Number(c.credit) || 0 };

        if (prev) Object.assign(prev, balance);
        else this.opts.customers.push({ id: Number(c.id), valor: String(c.valor || ''), ...balance });
    }

    removeCard() {
        const tk = this.currentTicket();

        this.persistTickets();

        tk.card = null;

        this.ticketForm();
        this.renderTotals();

        $('#of_card').trigger('focus');
    }

    // Antes de cobrar: la tarjeta sigue activa y sin cambios. false = no se abre el cobro.
    async freshCard() {
        const card = this.currentTicket().card;
        const n    = this.active;

        if (!card) return true;

        const data = await useFetch({ url: this._link, data: { opc: 'getCard', number: card.number } });

        if (n !== this.active || this.currentTicket().card !== card) return false;

        if (data && data.status == 404) {
            this.removeCard();

            alert({
                icon:     'warning',
                title:    'Tarjeta inactiva',
                text:     `La tarjeta ${card.number} ya no está activa. Se quitó del ticket: revisa el total antes de cobrar.`,
                btn1:     true,
                btn1Text: 'Entendido'
            });
            return false;
        }

        if (!data || data.status != 200 || !data.card) {
            this.cardFail(data, 'No se pudo revisar la tarjeta');
            return false;
        }

        const next = this.cardOf(data.card);
        const same = next
            && next.id === card.id
            && next.type === card.type
            && next.discount_percent === card.discount_percent
            && next.points_percent === card.points_percent
            && next.stamp_goal === card.stamp_goal
            && next.reward_value === card.reward_value
            && next.customer_id === card.customer_id;

        if (same) {
            if (data.customer) this.keepCustomer(data.customer);

            // Los sellos pudieron moverse en otra caja: se toman los de hoy sin avisar (el premio se ofrece con esos).
            card.stamps  = next.stamps;
            card.rewards = next.rewards;
            this.persistTickets();

            return true;
        }

        this.applyCard(data.card, data.customer);

        alert({
            icon:     'info',
            title:    'La tarjeta cambió',
            text:     'Su tipo, su descuento o su dueño ya no son los mismos. Revisa el total y vuelve a cobrar.',
            btn1:     true,
            btn1Text: 'Entendido'
        });
        return false;
    }

    // 404 y 422 son del número (no existe o no es válido): aviso, no error.
    cardFail(data, title) {
        if (!data || ![404, 422].includes(Number(data.status))) return this.warnFail(data, title);

        alert({
            icon:     'warning',
            title:    title,
            text:     data.message,
            btn1:     true,
            btn1Text: 'Entendido'
        });
    }

    // La tarjeta como se guarda en el ticket. null = no sirve.
    cardOf(raw) {
        if (!raw || typeof raw !== 'object') return null;

        const id      = Number(raw.id);
        const number  = String(raw.number || '').trim().slice(0, 40);
        const owner   = Number(raw.customer_id);
        const percent = (v) => Math.min(100, Math.max(0, Number(v) || 0));
        const count   = (v) => Math.max(0, Math.floor(Number(v) || 0));

        if (!Number.isInteger(id) || id <= 0 || !number) return null;

        return {
            id:               id,
            number:           number,
            holder:           String(raw.holder || ''),
            type:             String(raw.type || ''),
            discount_percent: percent(raw.discount_percent),
            points_percent:   percent(raw.points_percent),
            // Sellos (Lealtad): la meta, $ por sello, el premio y lo que lleva hoy (stamps) y cuántos premios completos (rewards).
            stamp_goal:       count(raw.stamp_goal),
            stamp_amount:     Math.max(0, Number(raw.stamp_amount) || 0),
            reward_name:      String(raw.reward_name || ''),
            reward_value:     Math.max(0, Number(raw.reward_value) || 0),
            stamps:           count(raw.stamps),
            rewards:          count(raw.rewards),
            customer_id:      Number.isInteger(owner) && owner > 0 ? owner : null,
            customer:         String(raw.customer || '')
        };
    }

    // «7 de 10 sellos»; si ya pasó la meta (premio sin canjear), «12 sellos juntados».
    stampsText(card) {
        return card.stamps >= card.stamp_goal ? `${card.stamps} sellos juntados` : `${card.stamps} de ${card.stamp_goal} sellos`;
    }

    // Mismo redondeo que el servidor: round(subtotal × % / 100, 2).
    cardOff(subtotal, card) {
        return card && card.discount_percent > 0 ? ordRound(subtotal * card.discount_percent / 100) : 0;
    }

    cardHint(card) {
        const parts = [`Tarjeta ${card.type}`];

        if (card.discount_percent > 0) parts.push(`${card.discount_percent} % de descuento`);

        if (card.points_percent > 0) {
            parts.push(this.customerAccount() ? `${card.points_percent} % en puntos` : 'elige un cliente para sumar puntos');
        }

        if (card.stamp_goal > 0) {
            parts.push(this.stampsText(card));

            if (card.rewards > 0) parts.push(`premio listo: ${card.reward_name} (se canjea al cobrar)`);
        }

        return parts.join(' · ');
    }

    // -- Complements --

    customerName() {
        const customer = String($('#of_customer_id').val() || '');

        if (customer === '' || customer === '0') return 'Público en general';

        return $('#of_customer_id option:selected').text().split(' · ')[0].trim();
    }

    // Monedero y crédito disponible del cliente elegido. null = Público en general.
    customerAccount() {
        const id = String($('#of_customer_id').val() || '');
        const c  = id === '' || id === '0' ? null : (this.opts.customers || []).find((x) => String(x.id) === id);

        return c ? { id: Number(c.id), wallet: Number(c.wallet) || 0, credit: Number(c.credit) || 0 } : null;
    }

    // Tras cobrar con monedero o a crédito, el saldo en pantalla es el que quedó guardado.
    syncAccount(account) {
        const c = account ? (this.opts.customers || []).find((x) => Number(x.id) === Number(account.id)) : null;

        if (!c) return;

        c.wallet = Number(account.wallet) || 0;
        c.credit = Number(account.credit) || 0;
    }

    // Ya neto de los descuentos por producto.
    saleTotal() {
        return this.round2(this.lines.reduce((sum, line) => sum + this.unitPrice(line) * line.quantity - this.lineOff(line), 0));
    }

    // Descuento de la partida en pesos. Mismo redondeo que lineDiscount en ctrl-ventas.php.
    lineOff(line) {
        const d = line.discount;

        if (!d) return 0;

        const gross = this.round2(this.unitPrice(line) * line.quantity);

        return d.mode === 'percent' ? this.round2(gross * d.value / 100) : Number(d.value) || 0;
    }

    // '' si el descuento cabe en la partida; si no, por qué.
    lineDiscountFail(line, discount) {
        const reason = (this.opts.reasons || []).find((r) => Number(r.id) === Number(discount.reason_id));

        if (!reason) return 'Ese motivo de descuento ya no existe.';

        if (Number(reason.requires_authorization) === 1 && !this.opts.can_authorize) {
            return `«${reason.name}» lo autoriza un Dueño o Supervisor.`;
        }

        if (discount.mode === 'percent' && discount.value > 100) return 'El descuento no puede pasar de 100 %.';

        const gross = this.round2(this.unitPrice(line) * line.quantity);
        const off   = this.lineOff({ ...line, discount: discount });
        const max   = Number(reason.max_percent);
        const cap   = this.round2(gross * max / 100);

        if (off <= 0)            return 'El descuento tiene que ser mayor a $0.';
        if (off > cap + 0.005)   return `«${reason.name}» permite hasta ${max} % (${money(cap)}) en este producto.`;
        if (off > gross + 0.005) return 'El descuento no puede ser mayor que el importe del producto.';

        return '';
    }

    // Descuento guardado en el navegador: vuelve solo si su motivo sigue y todavía cabe.
    withDiscount(line, raw) {
        if (!raw || typeof raw !== 'object' || !['percent', 'amount'].includes(raw.mode)) return line;

        const reason = (this.opts.reasons || []).find((r) => Number(r.id) === Number(raw.reason_id));
        const value  = this.amount(raw.value);

        if (!reason || value === null || value <= 0) return line;

        const discount = { reason_id: Number(reason.id), reason: reason.name, mode: raw.mode, value: value };

        return this.lineDiscountFail(line, discount) ? line : { ...line, discount: discount };
    }

    currentTicket() {
        return this.tickets.find((t) => t.n === this.active) || this.tickets[0];
    }

    blankTicket(n) {
        return {
            n:           n,
            lines:       [],
            customer_id: '',
            note:        '',
            card:        null
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

                        lines.push(this.withDiscount({
                            id:         0,
                            type:       'free',
                            name:       name,
                            price:      price,
                            quantity:   quantity,
                            details:    String(line.details || ''),
                            dedication: ''
                        }, line.discount));
                        return;
                    }

                    const product = line.type === 'product' ? products.get(Number(line.product_id)) : null;

                    if (!product) {
                        dropped++;
                        return;
                    }

                    lines.push(this.withDiscount({
                        id:         0,
                        type:       'product',
                        product_id: Number(product.id),
                        name:       product.name,
                        price:      Number(product.price),
                        quantity:   quantity,
                        details:    String(line.details || ''),
                        dedication: ''
                    }, line.discount));
                });

                // La tarjeta de un cliente que ya no está en la lista se quita: al cobrar se vuelve a leer.
                const customer = String(t.customer_id || '');
                const card     = this.cardOf(t.card);
                const owner    = card && card.customer_id ? String(card.customer_id) : '';
                const keep     = card && (!owner || customers.has(owner)) ? card : null;

                return {
                    n:           Number(t.n),
                    lines:       lines.slice(0, 100),
                    customer_id: keep && owner ? owner : (customers.has(customer) ? customer : ''),
                    note:        String(t.note || '').slice(0, 255),
                    card:        keep
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

    // Tocar un producto que ya está en la venta le suma 1 sin pasar por canAdd():
    // por eso aquí también se pide el turno.
    addProduct(id) {
        if (!this.turnReady('agregar productos')) return;

        super.addProduct(id);
    }

    // Sin turno no entra nada nuevo: ni producto del catálogo ni línea libre.
    canAdd() {
        if (!this.turnReady('agregar productos')) return false;
        if (this.lines.length < 100) return true;

        this.warn('Una venta admite hasta 100 productos.');

        return false;
    }

    // Sin turno de hoy no se agregan productos ni se cobra: avisa con «Abrir turno»
    // (OrderTurn.locked) y devuelve false. what: lo que se quiso hacer.
    turnReady(what) {
        const turn = dataInit.turn;

        if (turn && !turn.old) return true;

        orderTurn.locked({
            title:   turn ? 'Turno de otro día' : 'Sin turno abierto',
            message: turn
                ? `El turno ${turn.folio} es de otro día. Ciérralo y abre el de hoy para ${what}.`
                : `Abre un turno de caja en esta sucursal para ${what}.`
        });

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

// -- SalePayBase --

/*  La forma vieja del cobro: recibido, billetes y el descuento con campos
    op_*. OrderPay pasó a la ventana horizontal; la venta la sigue usando. */
class SalePayBase extends OrderPay {

    bind() {
        const modal = $('#modalOrderPay');

        modal.on('input', '#op_received', () => this.paint());

        modal.on('click', 'button.ord-bill', (e) => {
            $('#op_received').val(Number($(e.currentTarget).data('amount')).toFixed(2));
            this.paint();
        });

        modal.on('click', 'button.ord-disc-toggle', () => {
            this.discOpen = !this.discOpen;

            if (!this.discOpen) $('#op_reason, #op_disc_value, #op_disc_note').val('');

            this.paint();

            if (this.discOpen) $('#op_reason').trigger('focus');
        });

        modal.on('click', 'button.ord-seg', (e) => {
            this.discMode = String($(e.currentTarget).data('mode'));
            this.paint();
        });

        modal.on('input change', '#op_reason, #op_disc_value', () => this.paint());

        modal.on('keydown', 'input', (e) => {
            if (e.key !== 'Enter') return;

            e.preventDefault();
            modal.find('.cs-modal-save').trigger('click');
        });
    }

    discountFields() {
        const o = this.o;

        if (o.discount_amount > 0) {
            const why  = o.discount_reason ? ` (${esc(o.discount_reason)})` : '';
            const note = `<p class="text-[12.5px] text-gray-500 mb-0">Este pedido ya tiene un descuento de <b>${money(o.discount_amount)}</b>${why}. Solo se aplica uno.</p>`;

            return [{ id: 'op_disc_bar', tipo: 'html', class: 'w-full', html: note }];
        }

        if (!this.reasons.length) return [];

        // Corte cerrado: el descuento movería su vendido; lo autoriza Dueño o Supervisor.
        if (this.discBlock) {
            const note = `<p class="text-[12.5px] text-amber-700 mb-0"><i data-lucide="lock" class="w-3.5 h-3.5 inline -mt-0.5"></i> ${esc(this.discBlock)}</p>`;

            return [{ id: 'op_disc_bar', tipo: 'html', class: 'w-full', html: note }];
        }

        const lock = this.canAuthorize ? '' : ' · requiere Dueño o Supervisor';
        const data = this.reasons.map((r) => ({
            id:    r.id,
            valor: `${r.name} (hasta ${Number(r.max_percent)} %)${Number(r.requires_authorization) === 1 ? lock : ''}`
        }));

        const segs = '<div class="flex">'
            + '<button type="button" class="ord-seg" data-mode="percent">%</button>'
            + '<button type="button" class="ord-seg" data-mode="amount">$</button>'
            + '</div>';

        return [
            {
                id:    'op_disc_bar',
                tipo:  'html',
                class: 'w-full',
                html:  '<button type="button" class="ord-disc-toggle"><i data-lucide="percent" class="w-4 h-4"></i><span>Aplicar descuento</span></button>'
            },
            { id: 'op_reason', lbl: 'Motivo', tipo: 'select', data: data, empty: '— Elige el motivo —', class: 'w-full sm:w-1/2 op-disc hidden' },
            { id: 'op_disc_value', lbl: 'Descuento', tipo: 'number', min: 0, step: '0.01', ph: '0', class: 'w-[60%] sm:w-1/4 op-disc hidden' },
            { id: 'op_disc_mode', tipo: 'html', class: 'w-[40%] sm:w-1/4 op-disc hidden', html: '<p class="block text-xs font-semibold text-gray-500 mb-1.5">En</p>' + segs },
            { id: 'op_disc_note', lbl: 'Nota del descuento (opcional)', tipo: 'text', maxlength: 255, ph: 'Ej. Cliente frecuente', class: 'w-full op-disc hidden' },
            { id: 'op_disc_hint', tipo: 'html', class: 'w-full op-disc hidden', html: '<div id="op_disc_msg" class="text-[12.5px]"></div>' }
        ];
    }

    discountCalc() {
        const off = { amount: 0, error: '' };

        if (!this.discOpen) return off;

        const o      = this.o;
        const raw    = String($('#op_disc_value').val() || '').trim();
        const reason = this.reasons.find((r) => String(r.id) === String($('#op_reason').val()));
        const value  = ordAmount(raw);
        const fail   = (error) => ({ amount: 0, error: error });

        if (raw === '' && !reason) return off;
        if (!reason)               return fail('Elige el motivo del descuento.');
        if (raw === '')            return fail('Escribe el descuento.');
        if (value === null || value <= 0)              return fail('El descuento tiene que ser mayor a 0.');
        if (this.discMode === 'percent' && value > 100) return fail('El descuento no puede pasar de 100 %.');

        const amount = this.discMode === 'percent' ? ordRound(o.subtotal * value / 100) : value;
        const max    = Number(reason.max_percent);
        const cap    = ordRound(o.subtotal * max / 100);

        if (amount <= 0)                                  return fail('El descuento tiene que ser mayor a $0.');
        if (amount > cap + 0.005)                         return fail(`«${reason.name}» permite hasta ${max} % (${money(cap)}).`);
        if (amount > o.total + 0.005)                     return fail('El descuento no puede ser mayor que el total.');
        if (ordRound(o.total - amount) + 0.005 < o.paid)  return fail(`Con ese descuento el total queda debajo de lo ya abonado (${money(o.paid)}).`);

        if (Number(reason.requires_authorization) === 1 && !this.canAuthorize) {
            return fail(`«${reason.name}» lo autoriza un Dueño o Supervisor.`);
        }

        return {
            amount:  amount,
            error:   '',
            reason:  reason,
            value:   value,
            percent: o.subtotal > 0 ? ordRound(amount / o.subtotal * 100) : 0
        };
    }

    paintDiscount(c) {
        const d = c.d;

        $('#modalOrderPay .op-disc').toggleClass('hidden', !this.discOpen);
        $('#modalOrderPay button.ord-disc-toggle').toggleClass('is-active', this.discOpen);
        $('#modalOrderPay button.ord-disc-toggle span').text(this.discOpen ? 'Quitar descuento' : 'Aplicar descuento');

        $('#modalOrderPay button.ord-seg').each((i, el) => {
            $(el).toggleClass('is-active', $(el).data('mode') === this.discMode);
        });

        let msg = '<span class="text-gray-400">Elige el motivo y escribe el descuento.</span>';

        if (d.error)        msg = `<span class="text-rose-600">${esc(d.error)}</span>`;
        else if (d.amount)  msg = `<span class="text-emerald-700">Descuento de <b>${money(d.amount)}</b> (${d.percent} % del subtotal). El total queda en ${money(c.total)}.</span>`;

        $('#op_disc_msg').html(msg);
    }

    // Exacto y los 3 billetes redondos siguientes a lo que falta.
    bills(remaining) {
        if (remaining <= 0) return '';

        const next = [];

        [50, 100, 200, 500, 1000].forEach((step) => {
            const value = Math.ceil(remaining / step) * step;

            if (value > remaining && !next.includes(value)) next.push(value);
        });

        const list = next.sort((a, b) => a - b).slice(0, 3);

        return `<button type="button" class="ord-bill" data-amount="${remaining}">Exacto</button>`
             + list.map((v) => `<button type="button" class="ord-bill" data-amount="${v}">$${v.toLocaleString('es-MX')}</button>`).join('');
    }

    methodOf(id) {
        return this.methods.find((m) => m.id === Number(id)) || null;
    }
}

// -- SalePay --

class SalePay extends SalePayBase {

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
        const purse    = sale.opts.wallet_method;

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

        // Lo que OrderPay espera de un pedido: aquí siempre se cobra y no hay pagos previos.
        this.canPay       = true;
        this.payments     = [];
        this.thenDeliver  = false;
        this.fromDetail   = false;
        this.methods      = (sale.opts.methods || []).map((m) => ({ id: Number(m.id), name: m.name, code: m.code, cash: Number(m.is_cash) === 1 }));
        this.account      = sale.customerAccount();
        this.card         = sale.currentTicket().card || null;
        this.redeem       = false;
        this.onCredit     = false;

        // El monedero se ofrece solo si el cliente trae saldo.
        if (purse && this.account && this.account.wallet > 0.005) {
            this.methods.push({ id: Number(purse.id), name: purse.name, code: purse.code, cash: false, wallet: true });
        }

        this.reasons      = sale.opts.reasons || [];
        this.canAuthorize = !!sale.opts.can_authorize;
        this.discBlock    = '';
        this.token        = ordToken();
        this.mode         = 'all';
        this.lines        = [];
        this.discOpen     = !this.cardDiscounts() && !!options.discount && this.reasons.length > 0;
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
            { id: 'op_methods', tipo: 'html', class: 'w-full', html: label('Método de pago') + '<div id="op_method_chips" class="ord-method-grid"></div>' },
            { id: 'op_received', lbl: 'Recibe en efectivo', tipo: 'number', min: 0, step: '0.01', class: 'w-full sm:w-1/2' },
            { id: 'op_bills', tipo: 'html', class: 'w-full sm:w-1/2 op-bills', html: label('Billetes') + '<div id="op_bill_chips" class="flex flex-wrap gap-[8px]"></div>' },
            {
                id:    'op_lines_box',
                tipo:  'html',
                class: 'w-full',
                html:  '<div id="op_lines"></div><button type="button" class="ord-split"><i data-lucide="plus" class="w-4 h-4"></i>Agregar otro método</button>'
            },
            {
                id:    'op_credit_box',
                tipo:  'html',
                class: 'w-full op-credit hidden',
                html:  `
                    <div class="flex flex-wrap items-center gap-[8px]">
                        <button type="button" class="ord-credit" aria-pressed="false"><i data-lucide="calendar-clock" class="w-4 h-4"></i><span>Resto a crédito</span></button>
                        <span id="op_credit_hint" class="text-[12px] text-gray-500"></span>
                    </div>`
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

    // SalePayBase trae la forma vieja (recibido, billetes, descuento); aquí se suman
    // las tarjetas de método y «Agregar otro método».
    bind() {
        super.bind();

        const modal = $('#modalOrderPay');

        modal.on('click', 'button.ord-method', (e) => {
            this.method = Number($(e.currentTarget).data('id'));
            $('#op_received').val('');
            this.paint();
            $('#op_received').trigger('focus');
        });

        modal.on('click', 'button.ord-split', () => this.split());

        modal.on('click', 'button.ord-line-del', (e) => {
            this.lines.splice(Number($(e.currentTarget).data('index')), 1);
            this.paint();
        });

        modal.on('click', 'button.ord-tip', (e) => {
            this.tipMode = String($(e.currentTarget).data('tip'));

            if (this.tipMode !== 'other') $('#op_tip_amount').val('');

            this.paint();

            if (this.tipMode === 'other') $('#op_tip_amount').trigger('focus');
        });

        modal.on('input', '#op_tip_amount', () => this.paint());

        modal.on('click', 'button.ord-credit:not(.ord-reward)', () => {
            this.onCredit = !this.onCredit;
            this.paint();
            $('#op_received').trigger('focus');
        });

        // Canjear el premio de sellos: es el descuento de la venta, así que cierra el descuento manual.
        modal.on('click', 'button.ord-reward', () => {
            this.redeem = !this.redeem;

            if (this.redeem && this.discOpen) {
                this.discOpen = false;
                $('#op_reason, #op_disc_value, #op_disc_note').val('');
            }

            this.paint();
        });
    }

    // Propio, sin super.paint(): el de OrderPay pinta sus filas por forma de pago, que aquí no existen.
    paint() {
        const c    = this.calc();
        const m    = c.method;
        const free = this.account ? this.account.credit : 0;

        this.paintHead(c.total);

        $('#op_balance').text(money(c.balance));
        $('#op_tip_value').text(money(c.tip));
        $('#modalOrderPay .op-tip-other').toggleClass('hidden', this.tipMode !== 'other');

        $('#modalOrderPay button.ord-tip').each((i, el) => {
            $(el).toggleClass('is-active', String($(el).data('tip')) === this.tipMode);
        });

        $('#op_method_chips').html(this.methodChips());
        $('label[for="op_received"]').text(m && m.cash ? 'Recibe en efectivo' : `Monto con ${m ? m.name : ''}`);

        if (m && m.wallet) {
            $('#op_received').attr('placeholder', c.cap > 0 ? `Hasta ${money(Math.min(c.cap, c.remaining))}` : 'Sin saldo');
        } else if (this.onCredit && c.remaining > 0) {
            $('#op_received').attr('placeholder', 'Lo que paga hoy');
        } else {
            $('#op_received').attr('placeholder', c.remaining > 0 ? `Exacto: ${money(c.remaining)}` : '0.00');
        }

        $('#modalOrderPay .op-bills').toggleClass('hidden', !(m && m.cash) || c.remaining <= 0);
        $('#op_bill_chips').html(this.bills(c.remaining));
        $('#op_lines').html(this.linesHtml());
        $('#modalOrderPay button.ord-split').toggleClass('hidden', this.methods.length < 2 || this.lines.length >= 5);

        // «Resto a crédito» sale solo si el cliente tiene crédito disponible.
        $('#modalOrderPay .op-credit').toggleClass('hidden', free <= 0.005);
        $('#modalOrderPay button.ord-credit').toggleClass('is-active', this.onCredit).attr('aria-pressed', String(this.onCredit));
        $('#op_credit_hint').text(`Disponible ${money(free)}`);

        $('#op_sum').html(this.summary(c));
        $('#modalOrderPay .cs-modal-save').text(this.saveLabel(c));

        this.paintDiscount(c);

        if (window.lucide) lucide.createIcons();
    }

    /*  Con tarjeta se avisa lo que hace. Si su tipo descuenta, ese es el descuento y no se ofrece otro.
        Con sellos: cuántos lleva y, si ya completó la meta, «Canjear premio» (con el estilo de «Resto a crédito»). */
    discountFields() {
        if (!this.card) return super.discountFields();

        const card  = this.card;
        const parts = [];

        if (card.discount_percent > 0) parts.push(`${card.discount_percent} % de descuento`);
        if (card.points_percent > 0) parts.push(this.account ? `${card.points_percent} % de lo pagado va al monedero` : 'sin cliente no suma puntos');
        if (card.stamp_goal > 0) parts.push(`lleva ${sale.stampsText(card)} y suma 1 por cada ${money(card.stamp_amount)} pagados`);

        const fields = [{
            id:    'op_card_bar',
            tipo:  'html',
            class: 'w-full',
            html:  `<p class="sale-card-note"><i data-lucide="credit-card" class="w-4 h-4"></i><span>Tarjeta <b>${esc(card.type)}</b> · ${esc(card.number)}${parts.length ? ': ' + parts.join(' y ') : ''}.</span></p>`
        }];

        if (card.stamp_goal > 0 && card.rewards > 0) {
            fields.push({
                id:    'op_reward',
                tipo:  'html',
                class: 'w-full',
                html:  `<button type="button" class="ord-credit ord-reward" aria-pressed="false"><i data-lucide="gift" class="w-4 h-4"></i><span>Canjear premio: <b>${esc(card.reward_name)}</b> (hasta ${money(card.reward_value)})</span></button>`
            });
        }

        return this.cardDiscounts() ? fields : [...fields, ...super.discountFields()];
    }

    // Mismo redondeo que el servidor (cardDiscount y rewardDiscount en ctrl-ventas.php).
    discountCalc() {
        if (!this.cardDiscounts()) return super.discountCalc();

        if (this.redeem) {
            const amount = ordRound(Math.min(this.card.reward_value, this.o.subtotal));

            return {
                amount:  amount,
                error:   '',
                reason:  null,
                value:   amount,
                percent: this.o.subtotal > 0 ? ordRound(amount / this.o.subtotal * 100) : 0,
                card:    true
            };
        }

        return {
            amount:  sale.cardOff(this.o.subtotal, this.card),
            error:   '',
            reason:  null,
            value:   this.card.discount_percent,
            percent: this.card.discount_percent,
            card:    true
        };
    }

    // El descuento lo pone la tarjeta: su porcentaje o el premio de sellos que se va a canjear.
    cardDiscounts() {
        return !!(this.card && (this.card.discount_percent > 0 || this.redeem));
    }

    // Con el premio puesto, el descuento manual se esconde.
    paintDiscount(c) {
        $('#modalOrderPay button.ord-reward').toggleClass('is-active', this.redeem).attr('aria-pressed', String(this.redeem));
        $('#op_disc_bar').toggleClass('hidden', this.redeem);

        super.paintDiscount(c);
    }

    // OrderPay llena aquí sus mosaicos de Total, Pagado y Restante: los de la venta son otros.
    paintHead(total) {
        $('#op_total').text(money(total));
    }

    saveLabel(c) {
        if (c.credit > 0.005) {
            return c.applied > 0 ? `Cobrar ${money(c.applied)} · resto a crédito` : `Vender a crédito · ${money(c.credit)}`;
        }

        return c.applied > 0 ? `Cobrar · ${money(c.applied)}` : 'Cobrar';
    }

    methodHint(m) {
        return m && m.wallet ? `Saldo ${money(this.account.wallet)}` : super.methodHint(m);
    }

    summary(c) {
        const row   = (label, value) => `<div class="flex items-center justify-between text-[13px] text-gray-600"><span>${label}</span><span class="font-semibold text-gray-800">${value}</span></div>`;
        const name  = c.method ? c.method.name : '';
        const over  = c.applied > c.target + 0.005;
        const free  = this.account ? this.account.credit : 0;
        const lacks = c.credit > 0.005 ? 0 : c.missing;
        const used  = c.payments.map((p) => this.methodOf(p.method_id)).filter(Boolean);
        const names = esc(used.map((m) => m.name).join(' + '));
        const cash  = used.some((m) => m.cash);

        let state = '';

        if (c.tipError) {
            state = '<p class="ord-sum-big text-rose-600">Propina no válida</p>';
        } else if (c.badTyped) {
            state = '<p class="ord-sum-big text-rose-600">Monto recibido no válido</p>';
        } else if (over) {
            state = `<p class="ord-sum-big text-rose-600">Sobran ${money(c.applied - c.target)}</p><p class="text-[12px] text-rose-600 mb-0">Con ${esc(name)} no se cobra de más: baja el monto.</p>`;
        } else if (c.walletOver) {
            state = `<p class="ord-sum-big text-rose-600">Monedero insuficiente</p><p class="text-[12px] text-rose-600 mb-0">El monedero tiene ${money(this.account.wallet)}.</p>`;
        } else if (c.creditOver) {
            state = `<p class="ord-sum-big text-rose-600">Crédito insuficiente</p><p class="text-[12px] text-rose-600 mb-0">Disponible ${money(free)}: cobra hoy al menos ${money(c.credit - free)}.</p>`;
        } else if (c.credit > 0.005) {
            state = `<p class="text-[12px] font-semibold uppercase tracking-wide text-amber-700 mb-0">A crédito</p><p class="ord-sum-big text-amber-600">${money(c.credit)}</p>`;
        } else if (lacks > 0.005) {
            state = `<p class="ord-sum-big text-rose-600">Faltan ${money(lacks)}</p><p class="text-[12px] text-gray-500 mb-0">${free > 0.005 ? 'Agrega otro método o usa «Resto a crédito».' : 'Agrega otro método de pago.'}</p>`;
        } else if (c.change > 0.005) {
            state = `<p class="text-[12px] font-semibold uppercase tracking-wide text-emerald-700 mb-0">Cambio</p><p class="ord-sum-big text-emerald-600">${money(c.change)}</p>`;
        } else if (used.length === 1 && cash) {
            // «Sin cambio» solo tiene sentido con efectivo; con monedero, tarjeta o transferencia se dice con qué se cobra.
            state = '<p class="ord-sum-big text-emerald-600">Exacto, sin cambio</p>';
        } else if (c.applied > 0) {
            state = `<p class="text-[12px] font-semibold uppercase tracking-wide text-emerald-700 mb-0">Cobra con ${names}</p><p class="ord-sum-big text-emerald-600">${money(c.applied)}</p>`;
        }

        const clean = !c.badTyped && !c.tipError && !over && !c.walletOver && !c.creditOver;

        let end = '';

        if (clean && c.credit > 0.005) end = '<div class="text-[12.5px] text-amber-700 font-semibold mt-1">Queda pendiente: se paga con abonos</div>';
        else if (clean && lacks <= 0.005) end = '<div class="text-[12.5px] text-emerald-700 font-semibold mt-1">Queda pagada</div>';

        return `
            <div class="ord-sum rounded-xl border-[1px] border-gray-200 bg-gray-50 px-[14px] py-[12px] flex flex-col sm:flex-row gap-[12px] sm:items-center">
                <div class="flex-1 flex flex-col gap-[4px]">
                    ${row('A cobrar', money(c.target))}
                    ${row('Recibido', money(c.tendered))}
                    ${c.credit > 0.005 ? row('A crédito', money(c.credit)) : ''}
                    ${end}
                </div>
                <div class="sm:text-right sm:min-w-[200px]">${state}</div>
            </div>`;
    }

    methodChips() {
        const used = this.lines.map((l) => l.method_id);

        return this.methods.map((m) => `
            <button type="button" class="ord-method is-card${m.id === this.method ? ' is-active' : ''}" data-id="${m.id}" aria-pressed="${m.id === this.method}">
                <span class="ord-method-ico"><i data-lucide="${this.methodIcon(m)}" class="w-5 h-5"></i></span>
                <span class="min-w-0"><span class="ord-method-name">${esc(m.name)}</span><span class="ord-method-hint">${this.methodHint(m)}</span></span>
                ${used.includes(m.id) ? '<i data-lucide="check" class="w-4 h-4 ord-method-check"></i>' : ''}
            </button>`).join('');
    }

    // Los pagos ya sumados con «Agregar otro método»; cada uno se puede quitar.
    linesHtml() {
        if (!this.lines.length) return '';

        const rows = this.lines.map((l, i) => {
            const m     = this.methodOf(l.method_id);
            const extra = m && m.cash && l.tendered > l.amount ? ` · recibe ${money(l.tendered)}` : '';

            return `
                <div class="ord-line flex items-center justify-between gap-[8px] rounded-lg border-[1px] border-gray-200 px-[12px] py-[8px] text-[13px]">
                    <span class="flex items-center gap-[8px] min-w-0">
                        <i data-lucide="${this.methodIcon(m)}" class="w-4 h-4 text-gray-400 shrink-0"></i>
                        <span class="truncate">${esc(m ? m.name : '')}${extra}</span>
                    </span>
                    <span class="flex items-center gap-[8px] shrink-0">
                        <b>${money(l.amount)}</b>
                        <button type="button" class="ord-line-del" data-index="${i}" aria-label="Quitar este pago"><i data-lucide="x" class="w-4 h-4"></i></button>
                    </span>
                </div>`;
        }).join('');

        return `<p class="block text-xs font-semibold text-gray-500 mb-1.5">Pagos agregados</p><div class="flex flex-col gap-[6px] mb-[8px]">${rows}</div>`;
    }

    // Suma el monto escrito como un pago y pasa al siguiente método sin usar.
    // El monedero no da más de lo que tiene: se revisa antes de sumarlo.
    split() {
        const c = this.calc();
        const m = c.method;

        if (!m)                return;
        if (c.badTyped)        return this.warn('El monto recibido no es válido.');
        if (c.typed === null)  return this.warn(`Escribe cuánto se paga con ${m.name} antes de agregar otro método.`);
        if (c.remaining <= 0)  return this.warn('La venta ya está cubierta.');
        if (m.wallet && c.typed > c.cap + 0.005) return this.warn(`El monedero solo tiene ${money(c.cap)} disponibles.`);
        if (!m.cash && c.typed > c.remaining + 0.005) return this.warn(`Con ${m.name} solo faltan ${money(c.remaining)}: no se cobra de más.`);

        const amount = ordRound(m.cash ? Math.min(c.typed, c.remaining) : c.typed);
        const prev   = this.lines.find((l) => l.method_id === m.id);

        if (prev) {
            prev.amount   = ordRound(prev.amount + amount);
            prev.tendered = ordRound(prev.tendered + (m.cash ? c.typed : amount));
        } else {
            this.lines.push({ method_id: m.id, amount: amount, tendered: m.cash ? c.typed : amount });
        }

        const used = this.lines.map((l) => l.method_id);
        const next = this.methods.find((x) => !used.includes(x.id));

        if (next) this.method = next.id;

        $('#op_received').val('');
        this.paint();
        $('#op_received').trigger('focus');
    }

    // -- CRUD --

    async save(close) {
        if (this.saving) return;

        const c = this.calc();

        if (c.tipError) return this.warn(c.tipError);
        if (c.d.error) return this.warn(c.d.error);
        if (c.badTyped) return this.warn('El monto recibido no es válido.');
        if (c.payments.length > 6) return this.warn('Un cobro admite hasta 6 métodos de pago.');
        if (c.applied > c.target + 0.005) return this.warn(`Los pagos suman ${money(c.applied)} y la venta es de ${money(c.target)}. Baja el monto con tarjeta o transferencia.`);
        if (c.walletOver) return this.warn(`El monedero de ${this.o.customer} solo tiene ${money(this.account.wallet)}.`);

        const free = this.account ? this.account.credit : 0;

        if (c.creditOver) return this.warn(`El crédito disponible de ${this.o.customer} es ${money(free)} y faltan ${money(c.credit)}. Cobra hoy la diferencia.`);

        if (c.credit <= 0.005 && c.missing > 0.005) {
            return this.warn(`Faltan ${money(c.missing)} por recibir. ${free > 0.005 ? 'Agrega otro método de pago o usa «Resto a crédito».' : 'Agrega otro método de pago.'}`);
        }

        const customer = String($('#of_customer_id').val() || '');

        // El descuento de la tarjeta lo calcula el servidor con card_id: solo se manda el manual.
        const discount = c.d.amount > 0 && !c.d.card
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
            discount:    discount,
            credit:      c.credit > 0.005 ? '1' : '',
            card_id:     this.card ? this.card.id : '',
            redeem:      this.card && this.redeem ? '1' : ''
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

        orderTurn.touch();

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
        const account   = this.account;
        const isWallet  = (id) => !!(this.methodOf(id) || {}).wallet;
        const walletSum = (list) => ordRound(list.filter((l) => isWallet(l.method_id)).reduce((s, l) => s + l.amount, 0));

        // Lo que le queda al monedero después de los pagos ya agregados. null = el método no es el monedero.
        const cap = method && method.wallet ? Math.max(0, ordRound(account.wallet - walletSum(this.lines))) : null;

        let current = null;

        if (!badTyped && method) {
            if (typed === null) {
                // Sin escribir nada se cobra lo que falta. Con «Resto a crédito» no: lo que falte va a la cuenta.
                const amount = cap === null ? remaining : Math.min(remaining, cap);

                if (amount > 0 && !this.onCredit) current = { method_id: method.id, amount: amount, tendered: amount };
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

        const payments   = Array.from(merged.values()).filter((l) => l.amount > 0);
        const applied    = ordRound(payments.reduce((s, l) => s + l.amount, 0));
        const tendered   = ordRound(payments.reduce((s, l) => s + l.tendered, 0));
        const change     = ordRound(tendered - applied);
        const missing    = Math.max(0, ordRound(target - applied));
        const walletPaid = walletSum(payments);
        const credit     = this.onCredit ? missing : 0;

        return {
            d:          d,
            total:      total,
            tip:        tip.amount,
            tipError:   tip.error,
            balance:    balance,
            target:     target,
            remaining:  remaining,
            method:     method,
            typed:      typed,
            badTyped:   badTyped,
            payments:   payments,
            applied:    applied,
            tendered:   tendered,
            change:     change,
            missing:    missing,
            cap:        cap,
            walletOver: !!account && walletPaid > account.wallet + 0.005,
            credit:     credit,
            creditOver: credit > 0.005 && (!account || credit > account.credit + 0.005)
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
