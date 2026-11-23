/*  Pedidos › Ventas (pos-ventas): venta de mostrador, fase V1 del plan de Ventas.

    Hereda la captura de Pedidos (OrderForm) y su cobro (OrderPay). Aqui no hay
    fecha ni entrega: «Cobrar» guarda la venta ya pagada en un solo paso.
    La propina va aparte del total. Hasta 5 tickets en espera viven en este
    navegador, por usuario y sucursal; al cobrar, el ticket queda vacio.
    Lo que se vende hoy se cierra hoy: cada ticket lleva su día (tk.day) y uno
    de otro día no vuelve al abrir Ventas (restoreTickets lo descarta).

    Credito y monedero (V3) salen del cliente elegido: opts.customers trae su
    saldo de monedero (wallet) y su credito disponible (credit). El monedero es
    un metodo de pago mas, solo si hay saldo; «Resto a crédito» manda lo que
    falte a la cuenta del cliente y la venta queda pendiente.

    Tarjeta de lealtad (V4): se lee en «Cliente, tarjeta y nota» y vive en el
    ticket (tk.card). Si su tipo descuenta, ese es el descuento de la venta
    (no se suma otro); sus puntos van como dinero al monedero del cliente.
    Con dueño, la venta queda a nombre de ese cliente. Al cobrar se vuelve a
    leer por si la desactivaron o le cambiaron el tipo.

    El cobro (SalePay) es la misma ventana de pagos de Pedidos (OrderPay):
    una fila por forma de pago como Soft, con la propina, el monedero, el
    resto a crédito y la tarjeta de la venta.

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

    // El selector de sucursal de la barra dice cuál tiene turno (navbar.showTurns).
    if (dataInit.turns && window.navbar && typeof navbar.showTurns === 'function') navbar.showTurns(dataInit.turns);

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
    // posCatalog rehace #posOrderCatalogMain: el aviso de turno se vuelve a montar (paintLocks).
    catalog() {
        super.catalog();
        this.paintFull();
        this.paintLocks();
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
        this.paintLocks();
    }

    ticketForm() {
        const tk    = this.currentTicket();
        const card  = tk.card;
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

        // Buscar cliente y «Nuevo»: apagados sin turno o con tarjeta con dueño (paintLocks).
        this.paintLocks();

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
            empty:      this.emptyLines(),
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
        const gross    = this.round2(this.lines.reduce((sum, line) => sum + this.unitPrice(line) * line.quantity, 0));
        const lineOffs = this.round2(this.lines.reduce((sum, line) => sum + this.lineOff(line), 0));
        const subtotal = this.saleTotal();
        const card     = this.currentTicket().card;
        const off      = card && count ? this.cardOff(subtotal, card) : 0;
        const total    = this.round2(subtotal - off);
        const caption  = count === 0 ? 'Sin productos' : `${count} ${count === 1 ? 'partida' : 'partidas'} · ${pieces} ${pieces === 1 ? 'pieza' : 'piezas'}`;
        const json     = [];

        /*  Siempre la cuenta completa: subtotal (precio × cantidad, antes de
            descuentos), cada descuento que haya (por producto y de la tarjeta)
            o «Descuento $0.00», y abajo el total.
            posTicketTotals escribe text y value como texto: no van con esc(). */
        json.push({ text: 'Subtotal', value: money(gross), tone: 'muted' });

        if (lineOffs > 0) json.push({ text: 'Descuento por producto', value: '−' + money(lineOffs), tone: 'discount' });
        if (off > 0)      json.push({ text: `Tarjeta ${card.type} · ${card.discount_percent} %`, value: '−' + money(off), tone: 'discount' });
        if (lineOffs <= 0 && off <= 0) json.push({ text: 'Descuento', value: money(0), tone: 'muted' });

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

        this.paintLocks();
    }

    /*  Sin turno de hoy, como en Pedidos: en lugar del catálogo el aviso (turnGate) y
        en el ticket no entra cliente ni ticket nuevo. Apagados con su porqué (ordLock):
        «+ Ticket», buscar cliente, «Nuevo» y leer tarjeta (una tarjeta con dueño
        también pone cliente). Una tarjeta ya puesta se puede quitar. Los tickets que
        ya están se siguen viendo; su lista vacía dice que falta el turno.
        Con tarjeta con dueño el cliente tampoco cambia. */
    paintLocks() {
        const ready = this.hasTurn();
        const tk    = this.currentTicket();
        const card  = !!(tk && tk.card);
        const owned = card && !!tk.card.customer_id;
        const why   = 'Abre un turno de caja para usarlo.';

        ordLock('btnSaleTabAdd', !ready, why);
        ordLock('btnOfCustomer', !ready || owned, ready ? '' : why);
        ordLock('btnOfCard', !ready && !card, why);

        $('#of_customer_id').prop('disabled', !ready || owned);
        $('#of_card').prop('disabled', !ready || card);
        $('#posOrderTkForm').toggleClass('sale-noturn', !ready);

        $('#posOrderLines .pos-tkl-empty-text').text(this.emptyLines().text);

        this.turnGate(ready);
    }

    // La lista vacía: sin turno no se invita a tocar productos.
    emptyLines() {
        return this.hasTurn()
            ? { title: 'Venta vacía', text: 'Toca un producto o búscalo con Ctrl K.' }
            : { title: 'Venta vacía', text: 'Abre un turno de caja para agregar productos.' };
    }

    /*  El aviso en el lugar del catálogo (.ord-gate, el mismo de la espera de
        Pedidos): solo el estado del turno, sin botón; el turno se abre o se
        cierra en la franja de caja. Con turno de hoy se quita y vuelve el catálogo. */
    turnGate(ready) {
        let box = $('#saleTurnGate');

        $('#posOrderCatalogList').toggle(ready);

        if (ready) return box.remove();
        if (!$('#posOrderCatalogMain').length) return;

        const gate = this.gateInfo();

        if (!box.length) box = $('<div>', { id: 'saleTurnGate', class: 'ord-gate' }).appendTo('#posOrderCatalogMain');

        box.html(`
            <span class="ord-gate-icon"><i data-lucide="${gate.icon}"></i></span>
            <p class="ord-gate-title">${esc(gate.title)}</p>
            <p class="ord-gate-text">${esc(gate.text)}</p>`);

        if (window.lucide) lucide.createIcons({ root: box[0] });
    }

    // Qué dice el aviso, en el orden de la franja: turno de otro día, día cerrado, día pendiente o sin turno.
    gateInfo() {
        const turn    = dataInit.turn;
        const day     = dataInit.day || {};
        const pending = orderTurn.blockedDay();
        const can     = this.can('create');

        if (turn) {
            return { icon: 'history', title: `Turno ${turn.folio} de otro día`, text: can ? 'Ciérralo y abre el de hoy para vender.' : 'Lo cierra quien cobra, en caja.' };
        }

        if (day.closed) {
            return { icon: 'calendar-x', title: 'Día cerrado', text: 'El día de hoy ya se cerró. Hoy no se abre otro turno.' };
        }

        if (pending) {
            return { icon: 'calendar-clock', title: `Falta cerrar el ${ordDate(pending).slice(0, 5)}`, text: can ? 'Cierra ese día y luego abre el turno de hoy.' : 'El cierre lo hace quien cobra.' };
        }

        return { icon: 'lock', title: 'Sin turno abierto', text: can ? 'Abre un turno de caja para vender en mostrador.' : 'El turno se abre en caja. Pídeselo a quien cobra.' };
    }

    // El botón de pantalla completa dice en qué estado está (ícono y título).
    // En pantalla completa también se esconden la barra de arriba y el rail (order.css › body.sale-full).
    paintFull() {
        const button = $('#btnSaleFull');
        const on     = !!document.fullscreenElement;

        $('body').toggleClass('sale-full', on);

        if (!button.length) return;

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

        // Nivel: con esta venta la tarjeta subió (Lealtad › Programa › Niveles).
        const lv    = data.level;
        const level = lv
            ? `<p class="text-[14px] text-emerald-700 mb-0">Su tarjeta subió a <b>${esc(lv.to)}</b>${lv.whatsapp && ['sent', 'simulated'].includes(lv.whatsapp.status) ? ` · le avisamos por WhatsApp${lv.whatsapp.status === 'simulated' ? ' (simulado)' : ''}` : ''}.</p>`
            : '';

        // Solo «Imprimir ticket» y «Nueva venta»: el ticket por WhatsApp se manda desde Historial.
        const moment = this.loyaltyMoment(s, lv);

        const asking = alert({
            icon:     'success',
            title:    data.message,
            html:     `${moment.html}${change}<p class="text-[14px] mb-0">Cobrado <b>${money(t.charged)}</b></p>${credit}${points}${stamps}${level}`,
            btn1:     this.canSell('print'),
            btn1Text: 'Imprimir ticket',
            btn2:     true,
            btn2Text: 'Nueva venta'
        });

        // La tarjeta ya está en la ventana: sus iconos y, si completó el premio o subió de nivel, el confeti.
        if (moment.html && window.lucide) lucide.createIcons();
        if (moment.party) this.loyaltyConfetti(moment.party);

        const answer = await asking;

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
        tk.day         = this.today();

        this.lines = [];
        this.flash = -1;

        this.ticketForm();
        this.renderLines();
    }

    /*  Al cerrar el turno (OrderTurn.saveClose) el cliente de los tickets regresa
        a «Público en general». Una tarjeta con dueño pone su cliente: también se quita. */
    clearCustomer() {
        if (!this.pay) return;

        this.persistTickets();

        this.tickets.forEach((t) => {
            t.customer_id = '';

            if (t.card && t.card.customer_id) t.card = null;
        });

        this.ticketForm();
        this.persistTickets();
    }

    // -- Descuento por producto --

    /*  Mismas reglas que el descuento de la venta: motivo, tope del motivo y su permiso,
        pero sobre el importe de la partida. Se vuelve a revisar en el servidor (lineDiscount).
        Para aplicarlo sin adivinar: el tope del motivo a la vista, % o $ en dos botones,
        porcentajes rápidos hasta el tope y cuánto queda mientras se escribe
        (paintLineDiscount). Con un solo motivo ya va elegido; Enter aplica. */
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
        const only  = reasons.length === 1 ? reasons[0].id : '';
        const label = (text) => `<span class="block text-xs font-semibold text-gray-500 mb-1.5">${text}</span>`;
        const seg   = (mode, text, name) => `<button type="button" class="ord-seg" data-mode="${mode}" title="${name}" aria-label="${name}">${text}</button>`;

        this.ldMode = d ? d.mode : 'percent';

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
                    value:    d ? d.reason_id : only,
                    class:    'w-full',
                    data:     reasons.map((r) => ({
                        id:    r.id,
                        valor: `${r.name} (hasta ${Number(r.max_percent)} %)${Number(r.requires_authorization) === 1 ? lock : ''}`
                    }))
                },
                { id: 'ld_cap', tipo: 'html', class: 'w-full', html: '' },
                { id: 'ld_kind', tipo: 'html', class: 'w-1/2', html: `${label('Descontar en')}<div class="ld-seg">${seg('percent', '%', 'Porcentaje')}${seg('amount', '$', 'Pesos')}</div>` },
                { id: 'ld_value', lbl: 'Porcentaje', tipo: 'number', required: true, min: 0, step: '0.01', ph: '0', value: d ? d.value : '', class: 'w-1/2' },
                { id: 'ld_quick', tipo: 'html', class: 'w-full', html: '' },
                { id: 'ld_preview', tipo: 'html', class: 'w-full', html: '' }
            ],
            onSave: (values, close) => this.saveLineDiscount(index, values, close)
        });

        const modal = $('#modalSaleLineDiscount');

        modal.on('click', 'button.ord-seg', (e) => {
            this.ldMode = String($(e.currentTarget).data('mode')) === 'amount' ? 'amount' : 'percent';
            this.paintLineDiscount(index);
            $('#ld_value').trigger('focus').trigger('select');
        });

        modal.on('click', 'button.ord-goal', (e) => {
            this.ldMode = 'percent';
            $('#ld_value').val(String($(e.currentTarget).data('pct')));
            this.paintLineDiscount(index);
        });

        modal.on('input change', '#ld_reason_id, #ld_value', () => this.paintLineDiscount(index));

        modal.on('keydown', '#ld_value', (e) => {
            if (e.key !== 'Enter') return;

            e.preventDefault();
            modal.find('.cs-modal-save').trigger('click');
        });

        this.paintLineDiscount(index);

        $(d || only ? '#ld_value' : '#ld_reason_id').trigger('focus');
    }

    // Repinta el tope del motivo, % o $, los porcentajes rápidos y la cuenta: importe, descuento y lo que queda.
    paintLineDiscount(index) {
        const line  = this.lines[index];
        const modal = $('#modalSaleLineDiscount');

        if (!line || !modal.length) return;

        const reason  = (this.opts.reasons || []).find((r) => String(r.id) === String($('#ld_reason_id').val()));
        const percent = this.ldMode !== 'amount';
        const gross   = this.round2(this.unitPrice(line) * line.quantity);
        const raw     = String($('#ld_value').val() || '').trim();
        const value   = raw === '' ? null : this.amount(raw);
        const max     = reason ? Number(reason.max_percent) : 0;
        const locked  = !!reason && Number(reason.requires_authorization) === 1 && !this.opts.can_authorize;

        // Tope del motivo en % y en pesos de esta partida.
        const cap = reason
            ? `Este motivo permite hasta <b>${max} %</b> · ${money(this.round2(gross * max / 100))} en este producto${locked ? '. Lo autoriza un Dueño o Supervisor.' : '.'}`
            : '';

        $('#ld_cap').toggle(!!reason).html(reason ? `<p class="ld-cap${locked ? ' is-lock' : ''}"><i data-lucide="${locked ? 'lock' : 'shield-check'}"></i><span>${cap}</span></p>` : '');

        modal.find('button.ord-seg').each((i, el) => {
            const on = $(el).data('mode') === this.ldMode;

            $(el).toggleClass('is-active', on).attr('aria-pressed', String(on));
        });

        $('label[for="ld_value"]').html(`${percent ? 'Porcentaje' : 'Pesos'} <span class="text-red-500">*</span>`);
        $('#ld_value').attr({ max: percent ? 100 : gross, inputmode: 'decimal', placeholder: percent ? 'Ej. 10' : 'Ej. 50.00' });

        // Porcentajes rápidos hasta el tope del motivo; sin motivo, los comunes.
        const steps = [5, 10, 15, 20, 25, 50, 100].filter((p) => !reason || p <= max);

        if (reason && max > 0 && !steps.includes(max)) steps.push(max);

        const chips = steps.map((p) => `<button type="button" class="ord-goal${percent && value === p ? ' is-active' : ''}" data-pct="${p}">${p} %${reason && p === max ? ' · máx.' : ''}</button>`).join('');

        $('#ld_quick').toggle(steps.length > 0).html(steps.length ? `<span class="block text-xs font-semibold text-gray-500 mb-1.5">Rápido</span><div class="ld-quick">${chips}</div>` : '');

        const discount = reason && value !== null && value > 0 ? { reason_id: Number(reason.id), reason: reason.name, mode: this.ldMode, value: value } : null;
        const error    = discount ? this.lineDiscountFail(line, discount) : '';
        const off      = discount && !error ? this.lineOff({ ...line, discount: discount }) : 0;

        let note = { tone: '', text: '' };

        if (!reason)                         note.text = 'Elige el motivo del descuento.';
        else if (raw === '')                 note.text = percent ? 'Escribe el porcentaje o toca uno de los rápidos.' : 'Escribe cuántos pesos se descuentan.';
        else if (value === null || value <= 0) note = { tone: 'is-bad', text: 'El descuento tiene que ser mayor a 0, con hasta 2 decimales.' };
        else if (error)                      note = { tone: 'is-bad', text: error };
        else                                 note = { tone: 'is-ok', text: percent ? `El ${value} % son ${money(off)} menos.` : `${money(off)} es el ${gross > 0 ? this.round2(off / gross * 100) : 0} % del importe.` };

        $('#ld_preview').html(`
            <div class="ld-sum">
                <div class="ld-row"><span>Importe</span><b>${money(gross)}</b></div>
                <div class="ld-row is-off"><span>Descuento</span><b>${off > 0 ? '−' + money(off) : '—'}</b></div>
                <div class="ld-row is-net"><span>Queda en</span><b>${money(this.round2(gross - off))}</b></div>
                ${note.text ? `<p class="ld-note ${note.tone}">${esc(note.text)}</p>` : ''}
            </div>`);

        if (window.lucide) lucide.createIcons({ root: modal[0] });
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

        const discount = { reason_id: Number(reason.id), reason: reason.name, mode: this.ldMode === 'amount' ? 'amount' : 'percent', value: value };
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

    /*  «Venta cobrada» con tarjeta de lealtad: la tarjeta arriba de la ventana,
        del mismo tamaño que en Lealtad (las clases .loy-card de order.css). Sellos: los nuevos caen uno
        tras otro; si con esta venta completó el premio, los sellos brincan, cruza
        un brillo y cae confeti. Nivel: la tarjeta del nivel nuevo, con su
        insignia que gira a dorado y confeti. Devuelve { html, party } (party:
        los colores del confeti, o null). Con «reducir movimiento», quieta. */
    loyaltyMoment(s, lv) {
        const icon = (name) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(String(name || '')) ? name : '';
        const face = (color, logo, type, value, body, say, cls = '') => {
            const hex = /^#[0-9A-F]{6}$/i.test(color || '') ? color.toUpperCase() : '#BAE6FD';

            return `<div class="loy-sale"><div class="loy-card is-sale${cls}" data-ink="${this.loyaltyInk(hex)}" style="--loy-color:${hex}">`
                + `<div class="loy-card-head"><span class="loy-card-logo" aria-hidden="true"><i data-lucide="${logo}"></i></span>`
                + `<div class="loy-card-name"><span class="loy-card-type">${esc(type)}</span></div>`
                + (value ? `<div class="loy-card-value"><span class="loy-card-label">${esc(value[0])}</span><b>${esc(value[1])}</b></div>` : '')
                + `</div><div class="loy-card-body">${body}<p class="loy-card-say">${esc(say)}</p></div>`
                + '<i class="loy-card-sheen" aria-hidden="true"></i></div></div>';
        };

        if (lv && lv.direction !== 'baja') {
            const badge = `<div class="loy-card-tier"><span class="loy-card-badge is-top is-flip"><i data-lucide="trophy"></i><em>${esc(lv.to)}</em></span><span>¡Subió de nivel!</span></div>`;

            return { html: face(lv.color, 'crown', lv.to, null, badge, lv.perk ? `Beneficio nuevo: ${lv.perk}.` : `Su tarjeta ahora es ${lv.to}.`, ' is-shine'), party: ['#FFDA4A', '#F2B01E', '#FFF1A8', '#FFFFFF'] };
        }

        if (!s || !(s.earned > 0) || !s.goal) return { html: '', party: null };

        const goal   = Math.min(20, s.goal);
        const shown  = Math.min(goal, s.balance);
        const before = Math.max(0, s.balance - s.earned);
        const done   = s.balance >= s.goal && before < s.goal;
        const mark   = icon(s.icon);
        const stamps = Array.from({ length: goal }, (v, i) => {
            const gift = i === goal - 1;
            const fresh = i >= before && i < shown;

            return `<span class="loy-stamp${i < shown ? ' is-on' : ''}${gift ? ' is-gift' : ''}${fresh ? ' is-new' : ''}" style="--k:${i};--n:${Math.max(0, i - before)}">`
                + (gift ? '<i data-lucide="gift"></i>' : (mark ? `<i data-lucide="${mark}"></i>` : '')) + '</span>';
        }).join('');

        const left = Math.max(0, s.goal - s.balance);
        const prize = s.prize || 'su premio';
        const say  = s.balance >= s.goal ? `¡Premio listo: ${prize}!` : `+${s.earned} ${s.earned === 1 ? 'sello' : 'sellos'} · le faltan ${left} para ${prize}`;

        return {
            html:  face(s.color, mark || 'stamp', s.type || 'Tarjeta de sellos', ['Sellos', `${shown}/${s.goal}`], `<div class="loy-card-stamps${goal > 10 ? ' is-many' : ''}" aria-hidden="true">${stamps}</div>`, say, done ? ' is-done' : ''),
            party: done ? ['#FFDA4A', '#FFFFFF', s.color || '#7C3AED', '#FF4F7B', '#4ADE80'] : null
        };
    }

    // Letra oscura sobre colores claros y blanca sobre los fuertes (luminancia de WCAG, el corte 0.24 de tarjetas.js).
    loyaltyInk(hex) {
        const ch = (at) => {
            const v = parseInt(hex.slice(at, at + 2), 16) / 255;

            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };

        return 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5) > 0.24 ? 'dark' : 'light';
    }

    // Confeti sobre toda la pantalla, encima de la ventana, 2.6 s. Con «reducir movimiento», nada.
    loyaltyConfetti(colors) {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

        const canvas = document.createElement('canvas');
        const ctx    = canvas.getContext && canvas.getContext('2d');

        if (!ctx) return;

        const dpr  = Math.min(2, window.devicePixelRatio || 1), W = window.innerWidth, H = window.innerHeight;
        const box  = document.querySelector('.loy-sale');
        const rect = box ? box.getBoundingClientRect() : { left: W / 2, width: 0, top: H / 3 };
        const cx   = rect.left + rect.width / 2, cy = rect.top + 60;
        const bits = Array.from({ length: 150 }, (v, n) => ({
            x: cx + (Math.random() - .5) * 90, y: cy, vx: (Math.random() - .5) * 12, vy: -Math.random() * 9 - 3, g: .22 + Math.random() * .08,
            r: Math.random() * 6, vr: (Math.random() - .5) * .35, w: 5 + Math.random() * 5, h: 8 + Math.random() * 7, c: colors[n % colors.length], round: Math.random() < .3
        }));

        canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:10050';
        canvas.width  = W * dpr;
        canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        document.body.appendChild(canvas);

        let start = 0;

        // Arranca cuando ya cayeron los sellos nuevos.
        setTimeout(() => requestAnimationFrame(function frame(t) {
            if (!start) start = t;

            const k = (t - start) / 2600;

            ctx.clearRect(0, 0, W, H);
            bits.forEach((p) => {
                p.vy += p.g; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
                ctx.save();
                ctx.globalAlpha = Math.max(0, 1 - k * k);
                ctx.translate(p.x, p.y);
                ctx.rotate(p.r);
                ctx.fillStyle = p.c;
                if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, 7); ctx.fill(); } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)) + 1);
                ctx.restore();
            });

            if (k < 1) requestAnimationFrame(frame); else canvas.remove();
        }), 900);
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
            card:        null,
            day:         this.today()
        };
    }

    // El día del servidor (AAAA-MM-DD): el de los tickets en espera.
    today() {
        return String(dataInit.today || '');
    }

    /*  Los tickets en espera cambiaron fuera de la pantalla (orderTurn.dropAccounts
        al cerrar el turno o el día): se vuelven a leer y se repinta el ticket. */
    reloadTickets() {
        if (!this.pay) return;

        this.restoreTickets();
        this.paintTabs();
        this.ticket();
        this.ticketForm();
        this.renderLines();
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
        const today     = this.today();

        let dropped = 0;
        let stale   = 0;

        this.tickets = (saved && Array.isArray(saved.tickets) ? saved.tickets : [])
            .filter((t) => {
                const n   = Number(t && t.n);
                const day = String((t && t.day) || '');
                const ok  = Number.isInteger(n) && n >= 1 && n <= this.maxTickets && !seen.has(n);

                if (!ok) return false;

                // Lo que no se cobró en su día no pasa al siguiente. Sin día (guardado antes) se queda.
                if (day && today && day < today) {
                    if (Array.isArray(t.lines) && t.lines.length) stale++;
                    return false;
                }

                seen.add(n);

                return true;
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
                    card:        keep,
                    day:         String(t.day || '') || today
                };
            })
            .sort((a, b) => a.n - b.n);

        if (!this.tickets.length) this.tickets = [this.blankTicket(1)];

        const active = Number(saved && saved.active);

        this.active = this.tickets.some((t) => t.n === active) ? active : this.tickets[0].n;
        this.lines  = this.currentTicket().lines.map((line) => ({ ...line }));

        const notes = [];

        if (stale) notes.push(`${stale === 1 ? 'Un ticket de otro día se descartó' : `${stale} tickets de otro día se descartaron`}: lo que no se cobró en su día no pasa al siguiente.`);
        if (dropped) notes.push(`${dropped} ${dropped === 1 ? 'producto ya no está en el catálogo y se quitó' : 'productos ya no están en el catálogo y se quitaron'}. Los precios se tomaron del catálogo actual.`);

        if (notes.length) {
            alert({
                icon:     'info',
                title:    'Tickets en espera actualizados',
                text:     notes.join(' '),
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

        if (this.hasTurn()) return true;

        orderTurn.locked({
            title:   turn ? 'Turno de otro día' : 'Sin turno abierto',
            message: turn
                ? `El turno ${turn.folio} es de otro día. Ciérralo y abre el de hoy para ${what}.`
                : `Abre un turno de caja en esta sucursal para ${what}.`
        });

        return false;
    }

    // Turno abierto de hoy en esta sucursal (uno de otro día no cuenta).
    hasTurn() {
        const turn = dataInit.turn;

        return !!(turn && !turn.old);
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

/*  Cobrar la venta con la ventana de pagos de Pedidos (OrderPay, pedido-cobro.js):
    la misma tabla de formas de pago como Soft, el teclado táctil, el descuento
    con motivo y la confirmación antes de mandar. La venta suma lo suyo:
      - Propina: aparte del total (Sin propina, 10 %, 15 % u Otra); se cobra
        junto con él (dueOf).
      - Monedero: una forma de pago más, solo si el cliente tiene saldo. La
        fila que cubre lo que falta no pasa de ese saldo (autoCap).
      - «Resto a crédito»: lo que falte va a la cuenta del cliente (si tiene
        crédito disponible) y la venta queda pendiente.
      - Tarjeta de lealtad: si su tipo descuenta, ese es el descuento; con los
        sellos completos, «Canjear premio».
    Al confirmar se manda addSale (no payOrder): la venta se crea ya cobrada. */
class SalePay extends OrderPay {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'SalePay';
        this.tipMode      = 'none';
        this.tipNow       = { amount: 0, error: '' };
        this.onCredit     = false;
        this.redeem       = false;
        this.card         = null;
        this.account      = null;
    }

    // Arma lo que OrderPay.start espera de payOptions con lo que ya tiene la pantalla: no se pide nada al ctrl.
    openSale(options = {}) {
        if (this.loading || this.saving || this.isOpen) return;

        const subtotal = sale.saleTotal();
        const purse    = sale.opts.wallet_method;
        const turn     = dataInit.turn;
        const branchId = Number(dataInit.branch_id) || 0;

        this.account  = sale.customerAccount();
        this.card     = sale.currentTicket().card || null;
        this.tipMode  = 'none';
        this.tipNow   = { amount: 0, error: '' };
        this.onCredit = false;
        this.redeem   = false;

        // El monedero se ofrece solo si el cliente trae saldo.
        const methods = (sale.opts.methods || []).slice();

        if (purse && this.account && this.account.wallet > 0.005) methods.push(purse);

        this.start({
            order:         { id: 0, folio: '', customer: sale.customerName(), subtotal: subtotal, discount_amount: 0, discount_reason: '', total: subtotal, paid: 0 },
            payments:      [],
            can_pay:       true,
            reasons:       sale.opts.reasons || [],
            can_authorize: !!sale.opts.can_authorize,
            branch_id:     branchId,
            branches:      [{
                id:      branchId,
                name:    sale.opts.branch || 'Esta sucursal',
                session: true,
                turn:    turn ? { folio: turn.folio, opened_at: turn.opened_at, opened_by: turn.opened_by, old: !!turn.old } : null,
                block:   null,
                methods: methods
            }]
        }, false, {});

        if (options.discount && this.canDiscount() && this.reasons.length) this.toggleDisc();
    }

    // -- Textos --

    noun()         { return 'Venta'; }
    theNoun()      { return 'la venta'; }
    prefix()       { return 'V'; }
    noClient()     { return 'Público en general'; }
    paidLabel()    { return 'Venta pagada completamente'; }
    paidShort()    { return 'Venta pagada.'; }
    keyOnSettled() { return false; }
    fillsBalance() { return true; }
    originLabel()  { return 'Origen de la venta'; }

    // Con una tarjeta que descuenta, ese es el descuento de la venta: no se ofrece otro.
    canDiscount()  { return !(this.card && this.card.discount_percent > 0); }

    // -- Cuentas --

    // Lo que se cobra: la venta (con su descuento) más la propina.
    dueOf(total) {
        this.tipNow = this.tipCalc(total);

        return ordRound(total + this.tipNow.amount);
    }

    // Si el monedero cubre lo que falta, no pasa de su saldo.
    autoCap(m) {
        return m.wallet && this.account ? this.account.wallet : Infinity;
    }

    /*  Las cuentas de OrderPay más las de la venta. short = lo que falta por
        cubrir; con «Resto a crédito» eso es lo que va a la cuenta del cliente. */
    calc() {
        const c       = super.calc();
        const free    = this.account ? this.account.credit : 0;
        const inPurse = ordRound(c.payments.reduce((sum, p) => sum + ((this.methodOf(p.method_id) || {}).wallet ? p.amount : 0), 0));

        c.tip        = this.tipNow.amount;
        c.tipError   = this.tipNow.error;
        c.short      = Math.max(0, ordRound(c.balance - c.applied));
        c.credit     = this.onCredit ? c.short : 0;
        c.walletOver = !!this.account && inPurse > this.account.wallet + 0.005;
        c.creditOver = c.credit > 0.005 && c.credit > free + 0.005;

        return c;
    }

    // Lo que frena el cobro, en orden. '' = se puede cobrar.
    problem(c) {
        const free = this.account ? this.account.credit : 0;

        if (c.tipError)            return c.tipError;
        if (c.d.error)             return c.d.error;
        if (c.bad)                 return `El monto de ${c.bad.name} no es válido.`;
        if (c.badRec)              return 'El monto recibido en efectivo no es válido.';
        if (c.over > 0.005)        return `Los pagos pasan de lo que se cobra por ${money(c.over)}. Se cobran ${money(c.balance)}: no se cobra de más.`;
        if (c.walletOver)          return `El monedero de ${this.o.customer} solo tiene ${money(this.account.wallet)}.`;
        if (c.payments.length > 6) return 'Un cobro admite hasta 6 métodos de pago.';
        if (c.missing > 0.005)     return `Faltan ${money(c.missing)} por recibir en efectivo.`;
        if (c.creditOver)          return `El crédito disponible de ${this.o.customer} es ${money(free)} y faltan ${money(c.credit)}. Cobra hoy la diferencia.`;

        if (!this.onCredit && c.short > 0.005) {
            return `Faltan ${money(c.short)} por cobrar. ${free > 0.005 ? 'Escríbelos en otra forma de pago o usa «Resto a crédito».' : 'Escríbelos en otra forma de pago.'}`;
        }

        return '';
    }

    // «Cobrar $X en {forma}»; con crédito, lo que se cobra hoy y el resto a la cuenta. Devuelve [texto, ícono].
    saveLabel(c) {
        if (c.credit > 0.005) {
            return c.applied > 0
                ? [`Cobrar ${money(c.applied)} · resto a crédito`, 'calendar-clock']
                : [`Vender a crédito · ${money(c.credit)}`, 'calendar-clock'];
        }

        if (c.bad || c.over > 0.005 || c.applied <= 0) return ['Cobrar', 'check'];
        if (c.payments.length > 1) return [`Cobrar ${money(c.applied)} en ${c.payments.length} formas`, 'layers'];

        const m = this.methodOf(c.payments[0].method_id);

        return m ? [`Cobrar ${money(c.applied)} en ${m.name}`, m.icon] : [`Cobrar ${money(c.applied)}`, 'check'];
    }

    // Lo que va a pasar, en una sola línea del pie.
    paintResult(c) {
        const res = document.getElementById('paRes');

        if (!res) return;

        const free = this.account ? this.account.credit : 0;
        const tail = 'Queda pagada';

        let st;   // [clase, etiqueta, monto, nota]

        if (c.tipError)                                     st = ['is-bad', 'Corrige', '', 'La propina no es válida'];
        else if (c.d.error)                                 st = ['is-bad', 'Corrige', '', 'El descuento no es válido'];
        else if (c.bad)                                     st = ['is-bad', 'Corrige', '', `El monto de ${c.bad.name} no es válido`];
        else if (c.badRec)                                  st = ['is-bad', 'Corrige', '', 'Lo recibido en efectivo no es válido'];
        else if (c.over > 0.005)                            st = ['is-bad', 'Sobran', money(c.over), 'No se cobra de más: baja algún monto'];
        else if (c.walletOver)                              st = ['is-bad', 'Monedero insuficiente', '', `Tiene ${money(this.account.wallet)}`];
        else if (c.creditOver)                              st = ['is-bad', 'Crédito insuficiente', '', `Disponible ${money(free)}`];
        else if (c.missing > 0.005)                         st = ['is-bad', 'Faltan', money(c.missing), 'El efectivo recibido no alcanza'];
        else if (c.credit > 0.005)                          st = ['is-info', 'A crédito', money(c.credit), 'Queda pendiente: se paga con abonos'];
        else if (c.short > 0.005)                           st = ['is-bad', 'Faltan', money(c.short), free > 0.005 ? 'Agrega otra forma o usa «Resto a crédito»' : 'Agrega otra forma de pago'];
        else if (c.change > 0.005)                          st = ['is-ok', 'Cambio', money(c.change), tail];
        else if (c.payments.length === 1 && c.cashPaid > 0) st = ['is-ok', 'Efectivo exacto', '', tail];
        else if (c.applied > 0)                             st = ['is-ok', 'Cobra', money(c.applied), tail];
        else                                                st = ['is-ok', 'Sin cobro', '', 'La venta queda en $0'];

        res.className = `pa-res${st[0] ? ` ${st[0]}` : ''}`;
        res.innerHTML = `<span>${esc(st[1])}</span>${st[2] ? `<b>${st[2]}</b>` : ''}<small>· ${esc(st[3])}</small>`;
    }

    // El Monedero es una forma más; su pista es el saldo del cliente.
    payMethods() {
        const list  = super.payMethods();
        const purse = sale.opts.wallet_method;

        list.forEach((m) => {
            if (!purse || m.wallet || m.id !== Number(purse.id)) return;

            m.wallet = true;
            m.hint   = this.methodHint(m);
        });

        return list;
    }

    methodHint(m) {
        return m && m.wallet && this.account ? `Saldo ${money(this.account.wallet)}` : super.methodHint(m);
    }

    // -- Piezas de la ventana --

    // Sin pestañas: una venta nueva no tiene historial de pagos.
    headHtml() {
        return '<div class="pa-head">'
            +   '<div class="pa-head-top">'
            +     `<div class="pa-head-ico">${this.ico('banknote')}</div>`
            +     '<div class="pa-head-text"><h2 id="paTitle">Cobrar venta</h2>'
            +       '<p class="pa-head-meta">'
            +         `<span>${this.ico('receipt-text')}<b>Ticket ${Number(sale.active)}</b></span>`
            +         `<span class="is-client">${this.ico('user')}<em>${esc(this.o.customer || this.noClient())}</em></span>`
            +       '</p>'
            +     '</div>'
            +     `<button type="button" class="pa-x" data-act="close" aria-label="Cerrar">${this.ico('x')}</button>`
            +   '</div>'
            + '</div>';
    }

    // Los tres recuadros de Pedidos; el del medio es la propina (una venta nueva no trae pagos).
    summaryHtml() {
        return '<div class="pa-sum">'
            +   `<div class="pa-stat is-total"><span>${this.ico('wallet')}Total</span><b id="paSumTotal"></b><small id="paSumTotalNote"></small></div>`
            +   `<div class="pa-stat is-paid"><span>${this.ico('coins')}Propina</span><b id="paSumPaid"></b></div>`
            +   `<div class="pa-stat is-due" id="paSumDueBox"><span>${this.ico('clock')}Restante</span><b id="paSumDue"></b><small id="paSumDueNote"></small></div>`
            + '</div>';
    }

    paintSummary(v) {
        super.paintSummary(v);

        $('#paSumPaid').text(money(this.tipNow.amount));
    }

    // Una sola sucursal: la de la sesión, con su turno.
    branchesHtml(lock) {
        const b    = this.cobroBranch();
        const t    = b.turn;
        const line = t && !t.old ? `<span class="pa-dot pa-turn-open"></span>Turno ${esc(t.folio)} abierto` : this.turnLine(b);

        return '<div class="pa-field">'
            +   this.label('Sucursal que cobra')
            +   `<div class="pa-branch is-cobro" title="${esc(this.turnTitle(b))}">`
            +     `<span class="pa-branch-ico">${this.ico('landmark')}</span>`
            +     `<span class="pa-branch-text"><b>${esc(b.name)}</b><small>${line}</small></span>`
            +   '</div>'
            +   this.alertHtml(lock)
            + '</div>';
    }

    // A la derecha: quién cobra, la tarjeta, la propina, el crédito y el descuento.
    infoHtml(lock) {
        const off = lock ? ' disabled' : '';
        const cls = lock ? ' is-locked' : '';

        return this.branchesHtml(lock)
            + `<fieldset class="pa-set${cls}"${off}>`
            +   this.cardHtml()
            +   this.tipHtml()
            +   this.creditHtml()
            +   `<div class="pa-disc-wrap" id="paDiscWrap">${this.discArea()}</div>`
            + '</fieldset>';
    }

    // Lo que hace la tarjeta de lealtad y, con los sellos completos, «Canjear premio».
    cardHtml() {
        const card = this.card;

        if (!card) return '';

        const parts = [];

        if (card.discount_percent > 0) parts.push(`${card.discount_percent} % de descuento`);
        if (card.points_percent > 0)   parts.push(this.account ? `${card.points_percent} % de lo pagado va al monedero` : 'sin cliente no suma puntos');
        if (card.stamp_goal > 0)       parts.push(`lleva ${sale.stampsText(card)} y suma 1 por cada ${money(card.stamp_amount)} pagados`);

        const note = `<p class="pa-note-line">${this.ico('credit-card')}<span>Tarjeta <b>${esc(card.type)}</b> · ${esc(card.number)}${parts.length ? ': ' + parts.join(' y ') : ''}.</span></p>`;

        if (!(card.stamp_goal > 0 && card.rewards > 0)) return note;

        return note
            + `<button type="button" class="pa-extra-btn${this.redeem ? ' is-on' : ''}" id="paReward" data-act="reward" aria-pressed="${this.redeem}">${this.ico('gift')}<span>Canjear premio: <b>${esc(card.reward_name)}</b> (hasta ${money(card.reward_value)})</span></button>`;
    }

    tipHtml() {
        // pa-tip y no pa-seg-btn: OrderPay.paintDiscount repinta todos los pa-seg-btn con el modo del descuento.
        const chip = (mode, text) => `<button type="button" class="pa-tip${this.tipMode === mode ? ' is-active' : ''}" data-act="tip" data-value="${mode}" aria-pressed="${this.tipMode === mode}">${text}</button>`;

        return '<div class="pa-field">'
            +   this.label('Propina', 'Va aparte del total')
            +   `<div class="pa-seg pa-tips">${chip('none', 'Sin propina')}${chip('10', '10 %')}${chip('15', '15 %')}${chip('other', 'Otra')}</div>`
            +   `<div class="pa-amt pa-tip-amt" id="paTipRow"${this.tipMode === 'other' ? '' : ' hidden'}><span>$</span><input id="paTip" type="text" inputmode="${this.inputMode()}" autocomplete="off" placeholder="0.00" data-field="tip" aria-label="Propina"></div>`
            + '</div>';
    }

    // Solo si el cliente tiene crédito disponible.
    creditHtml() {
        const free = this.account ? this.account.credit : 0;

        if (free <= 0.005) return '';

        return `<button type="button" class="pa-extra-btn${this.onCredit ? ' is-on' : ''}" id="paCredit" data-act="credit" aria-pressed="${this.onCredit}" title="Crédito disponible: ${money(free)}">${this.ico('calendar-clock')}<span>Resto a crédito (${money(free)})</span></button>`;
    }

    // -- Descuento de la tarjeta --

    // Mismo redondeo que el servidor (cardDiscount y rewardDiscount en ctrl-ventas.php). Sin tarjeta, el de OrderPay.
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

    // -- Confirmar y guardar --

    // La confirmación de Pedidos con lo de la venta: cuánto se cobra, en qué, el cambio, la propina y el crédito.
    confirmHtml(c) {
        const b    = this.cobroBranch();
        const turn = b.turn && b.turn.folio != null ? `Turno ${esc(b.turn.folio)}` : '';
        const all  = c.credit > 0.005 && c.applied <= 0;
        const name = (id) => { const m = this.methodOf(id); return m ? esc(m.name) : 'Pago'; };
        const row  = (dt, dd, rowCls = '', ddCls = '') => `<div${rowCls ? ` class="${rowCls}"` : ''}><dt>${dt}</dt><dd${ddCls ? ` class="${ddCls}"` : ''}>${dd}</dd></div>`;
        const why  = c.d.reason ? esc(c.d.reason.name) : (this.redeem ? 'premio de la tarjeta' : 'tarjeta');

        let how = '';

        if (c.payments.length === 1)    how = row('Forma de pago', name(c.payments[0].method_id));
        else if (c.payments.length > 1) how = c.payments.map((p) => row(name(p.method_id), money(p.amount))).join('');

        return '<div class="pa-confirm" id="paConfirm" role="alertdialog" aria-modal="true" aria-labelledby="paConfirmTitle">'
            +   '<div class="pa-confirm-card">'
            +     `<div class="pa-confirm-head"><div class="pa-head-ico">${this.ico(all ? 'calendar-clock' : 'banknote')}</div><h3 id="paConfirmTitle">${all ? '¿Vender a crédito?' : '¿Cobrar venta?'}</h3><p>Ticket ${Number(sale.active)} · ${esc(this.o.customer || this.noClient())}</p></div>`
            +     '<dl class="pa-confirm-rows">'
            +       row('Se cobra', money(c.applied), 'is-big')
            +       how
            +       (c.change > 0.005 ? row('Recibe', `${money(c.cashGiven)} · cambio ${money(c.change)}`) : '')
            +       (c.d.amount > 0 ? row('Descuento', `−${money(c.d.amount)} · ${why}`) : '')
            +       (c.tip > 0.005 ? row('Propina', money(c.tip)) : '')
            +       (c.credit > 0.005 ? row('A crédito', money(c.credit)) : '')
            +       row('Sucursal que cobra', `${esc(b.name)}${turn ? ` · ${turn}` : ''}`, '', 'is-brand')
            +     '</dl>'
            +     '<div class="pa-confirm-foot">'
            +       '<button type="button" class="pa-btn" data-act="confirm-no">Cancelar</button>'
            +       `<button type="button" class="pa-btn is-primary" id="paConfirmYes" data-act="confirm-yes"><span data-label>${all ? 'Sí, vender' : 'Sí, cobrar'}</span></button>`
            +     '</div>'
            +   '</div>'
            + '</div>';
    }

    // «Sí, cobrar»: addSale crea la venta ya cobrada. El candado (busy) y el token impiden un segundo cobro.
    async commit() {
        if (this.busy || !this.confirmCalc) return;

        const c        = this.confirmCalc;
        const customer = String($('#of_customer_id').val() || '');

        this.setBusy(true);
        $('#paConfirmYes').prop('disabled', true).find('[data-label]').text('Cobrando…');

        // El descuento de la tarjeta lo calcula el servidor con card_id: solo se manda el manual.
        const discount = c.d.amount > 0 && !c.d.card
            ? JSON.stringify({
                reason_id: c.d.reason.id,
                percent:   this.discMode === 'percent' ? c.d.value : '',
                amount:    this.discMode === 'amount' ? c.d.value : '',
                note:      ''
            })
            : '';

        const data = await useFetch({
            url:  this._link,
            data: {
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
            }
        });

        // Sin turno: la ventana se cierra y se ofrece abrirlo; la venta sigue en el ticket.
        if (data && data.status == 423) {
            this.closeQuiet('modalOrderPay', this.modal.close);
            this.busy = false;
            orderTurn.locked(data);
            return;
        }

        if (!data || data.status != 200) {
            this.setBusy(false);
            this.confirmCalc = null;
            $('#paConfirm').remove();

            alert({
                icon:     data && data.status && data.status < 500 ? 'warning' : 'error',
                title:    'No se registró la venta',
                text:     (data && data.message) || 'Revisa la conexión y vuelve a intentar. No se cobra dos veces.',
                btn1:     true,
                btn1Text: 'Entendido'
            });
            return;
        }

        this.closeQuiet('modalOrderPay', this.modal.close);
        this.busy = false;

        orderTurn.touch();

        sale.afterSale(data);
    }

    // -- Eventos --

    act(name, el) {
        if (name === 'tip')    return this.pickTip(el.dataset.value);
        if (name === 'credit') return this.toggleCredit();
        if (name === 'reward') return this.toggleReward();

        super.act(name, el);
    }

    // Otra: sale el campo del monto (el teclado también escribe ahí).
    pickTip(mode) {
        const input = document.getElementById('paTip');

        this.tipMode = ['10', '15', 'other'].includes(mode) ? mode : 'none';

        if (this.tipMode !== 'other' && input) input.value = '';

        $('#paTipRow').prop('hidden', this.tipMode !== 'other');
        $('#modalOrderPay button.pa-tip').each((i, b) => {
            b.classList.toggle('is-active', b.dataset.value === this.tipMode);
            b.setAttribute('aria-pressed', String(b.dataset.value === this.tipMode));
        });

        this.paintCalc();

        if (this.tipMode === 'other') return this.focusField('tip');
        if (this.active === 'tip') this.active = this.homeId();

        this.focusField(this.active);
    }

    // Con «Resto a crédito» ninguna fila cubre lo que falta: se escribe lo que paga hoy y el resto va a la cuenta.
    toggleCredit() {
        const old = this.fieldInput(this.auto);

        this.onCredit = !this.onCredit;

        if (this.onCredit) {
            if (old) old.value = '';
            this.auto = 0;
        } else {
            this.auto = Number(this.homeId()) || 0;
        }

        $('#paCredit').toggleClass('is-on', this.onCredit).attr('aria-pressed', String(this.onCredit));

        this.paintCalc();
        this.focusField(this.homeId());
    }

    // Canjear el premio de sellos: es el descuento de la venta, así que cierra y esconde el manual.
    toggleReward() {
        this.redeem = !this.redeem;

        if (this.redeem && this.discOpen) this.toggleDisc();

        $('#paReward').toggleClass('is-on', this.redeem).attr('aria-pressed', String(this.redeem));
        $('#paDiscWrap').prop('hidden', this.redeem);

        this.paintCalc();
    }

    // -- Complements --

    // El campo de la propina entra al teclado y al orden de «Siguiente».
    fieldInput(f) {
        return f === 'tip' ? document.getElementById('paTip') : super.fieldInput(f);
    }

    visibleFields() {
        const list = super.visibleFields();

        if (this.tipMode === 'other') list.push('tip');

        return list;
    }

    tipCalc(total) {
        if (this.tipMode === 'none') return { amount: 0, error: '' };

        if (this.tipMode === 'other') {
            const raw = String($('#paTip').val() || '').trim();

            if (raw === '') return { amount: 0, error: '' };

            const value = this.num(raw);

            return value === null ? { amount: 0, error: 'Escribe una propina válida.' } : { amount: value, error: '' };
        }

        return { amount: ordRound(total * Number(this.tipMode) / 100), error: '' };
    }
}
