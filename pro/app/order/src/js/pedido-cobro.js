/*  Pedidos › gestión de pagos: cobrar, ver los pagos y quitar uno.

    Entra desde la tabla (los importes Total, Abono y Saldo, y el menú
    «Cobrar» o «Pagos»), desde el detalle, el calendario y Clientes. Si vino
    del detalle, al terminar o al cerrar vuelve a abrirlo.

    Ventana horizontal de dos columnas, como la de alpha (maqueta aprobada:
    templates/pagos-alpha-propuesta.html). Se lee en el orden en que se cobra:
    arriba el total; a la izquierda, cómo se paga: las formas de pago de la
    sucursal que cobra, como en Soft, una fila por forma con su importe. Una
    fila «cubre lo que falta» y se ajusta sola con lo que se escribe en las
    demás. En efectivo se anota lo recibido para el cambio. En pantalla táctil
    sale el teclado de caja. A la derecha, de dónde es el pedido, la sucursal
    que cobra (se puede elegir otra), la observación y el descuento.

    La ventana mide siempre lo mismo (pedido-cobro.css › --pa-h): no crece ni
    se encoge al cambiar de pestaña, al abrir el descuento o al salir un aviso.
    Lo que no cabe se recorre por dentro. Los importes solo aceptan dígitos y
    punto (clean): no se puede escribir un número negativo.

    Registrar siempre pregunta «¿Registrar pago?»; si cobra otra sucursal,
    avisa del cobro cruzado. Quitar un pago se hace en la misma ventana y pide
    el motivo; con el pedido liquidado, también la contraseña. Sin saldo, sin
    turno o sin formas de pago la forma queda apagada y dice por qué.

    Pedido nuevo (openDraft): la ventana abre ANTES de guardar. Con anticipo,
    el pedido se crea al confirmar el cobro (saveDraft) y enseguida se registra
    el pago. Sin importe, el botón pregunta cómo se guarda (askDraft): como
    cotización se guarda sin dinero. Si se cierra la ventana, no queda nada
    guardado y la captura sigue abierta.

    Lo que manda es el ctrl: aquí se arma el cobro y se avisa antes de mandar.
    SalePayments (historial.js) y SalePay (ventas.js, cobrar una venta) heredan
    de aquí: la misma ventana, con sus ganchos (dueOf, autoCap, infoHtml…). */

// -- Cobro --

class OrderPay extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'OrderPay';
        this.loading      = false;
        this.saving       = false;
        this.busy         = false;
        this.token        = '';
        this.touch        = !!(window.matchMedia && window.matchMedia('(any-pointer: coarse)').matches);
        this.keyHandler   = null;
        this.isOpen       = false;
        this.modal        = null;
        this.draft        = null;
        this.asking       = false;
    }

    // -- Entrada --

    // opts.deliver: «Cobrar y entregar». opts.tab: 'pay' o 'history' (la pestaña con que abre).
    async open(id, fromDetail, opts = {}) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        if (this.loading) return;

        this.loading = true;

        const data = await useFetch({ url: this._link, data: { opc: 'payOptions', id: id } });

        this.loading = false;

        if (!data || data.status != 200) return this.fail(data, 'No se abrieron los pagos');

        orderTurn.sync(data.turn, false);

        if (fromDetail) $('#modalOrderDetails .cs-modal-x').trigger('click');

        this.thenDeliver = !!(opts && opts.deliver);

        this.start(data, !!fromDetail, opts || {});
    }

    /*  Pedido nuevo con anticipo: abre la ventana SIN guardar el pedido.
        draft = { customer, total, delivery, save }. save() es de la captura: manda
        addOrder y devuelve su respuesta. Se llama hasta confirmar el cobro (saveDraft). */
    async openDraft(draft) {
        if (this.loading) return;

        this.loading = true;

        const data = await useFetch({ url: this._link, data: { opc: 'payDraft' } });

        this.loading = false;

        if (!data || data.status != 200) return this.fail(data, 'No se abrieron los pagos');

        orderTurn.sync(data.turn, false);

        this.thenDeliver = false;

        data.order = {
            id:              0,
            folio:           '',
            customer:        draft.customer,
            subtotal:        draft.total,
            discount_amount: 0,
            discount_reason: '',
            total:           draft.total,
            paid:            0,
            cancelled:       false,
            delivered:       false,
            delivery_date:   draft.delivery
        };

        this.start(data, false, { draft: draft });
    }

    fail(data, title) {
        if (data && data.status == 423) return orderTurn.locked(data);

        const soft = data && [403, 404, 409].includes(Number(data.status));

        alert({
            icon:     soft ? 'info' : 'error',
            title:    title,
            text:     (data && data.message) || 'Revisa la conexión y vuelve a intentar.',
            btn1:     true,
            btn1Text: 'Entendido'
        });
    }

    start(data, fromDetail, opts) {
        const o = data.order || {};

        this.o = {
            id:              Number(o.id),
            folio:           o.folio,
            customer:        o.customer || '',
            subtotal:        Number(o.subtotal) || 0,
            discount_amount: Number(o.discount_amount) || 0,
            discount_reason: o.discount_reason || '',
            total:           Number(o.total) || 0,
            paid:            Number(o.paid) || 0,
            cancelled:       !!o.cancelled,
            delivered:       !!o.delivered,
            delivery:        o.delivery_date || ''
        };

        this.payments     = data.payments || [];
        this.canDelete    = !!data.can_delete;
        this.canPay       = !!data.can_pay;
        this.payBlock     = data.pay_block || null;
        this.reasons      = data.reasons || [];
        this.canAuthorize = !!data.can_authorize;
        this.discBlock    = data.disc_block || '';
        this.fromDetail   = fromDetail;
        this.token        = ordToken();
        this.branches     = this.readBranches(data);
        this.mcache       = null;
        this.draft        = (opts && opts.draft) || null;

        // origin = la sucursal del pedido (branch_id; de otra sucursal en la vista «todas»). cobro = la que recibe el dinero.
        const session = this.branches.find((b) => b.session);

        this.origin = Number(data.branch_id) || (session ? session.id : (this.branches.length ? this.branches[0].id : 0));
        this.cobro  = this.origin;

        // Sin pestaña pedida: cobrar si se puede (o si se resuelve aquí); si no, los pagos que ya hay.
        const lock = this.lockState();

        this.view = ['pay', 'history'].includes(opts.tab)
            ? opts.tab
            : (['', 'turn', 'methods'].includes(lock) || !this.payments.length ? 'pay' : 'history');

        this.resetForm();

        // La ventana trae su propio marco (.pa-win): el encabezado y el pie de csModal se esconden.
        this.modal = this.csModal({
            id:         'modalOrderPay',
            title:      'Gestión de pagos',
            width:      'max-w-2xl',
            saveText:   false,
            cancelText: 'Cerrar',
            body:       '<div class="pa-win" id="paWin" role="dialog" aria-modal="true" aria-labelledby="paTitle"></div>'
        });

        // is-touch: con el teclado de caja la ventana es más alta (pedido-cobro.css).
        $('#modalOrderPay').addClass('pa-modal').toggleClass('is-touch', this.touch);

        this.isOpen = true;

        this.bind();
        this.bindKeys();
        this.render();

        this.onDismiss('modalOrderPay', () => {
            this.isOpen = false;
            this.unbindKeys();
            this.back();
        });
    }

    // payOptions de Pedidos trae branches; el de Ventas solo la sucursal de la sesión.
    readBranches(data) {
        if (Array.isArray(data.branches) && data.branches.length) {
            return data.branches.map((b) => ({
                id:      Number(b.id),
                name:    b.name || '',
                session: !!b.session,
                turn:    b.turn || null,
                block:   b.block || null,
                methods: b.methods || []
            }));
        }

        const pb = data.pay_block || null;
        const t  = data.turn || null;

        return [{
            id:      Number(data.branch_id) || 0,
            name:    data.branch_name || 'Esta sucursal',
            session: true,
            turn:    t ? { folio: t.folio, opened_at: t.opened_at, opened_by: t.opened_by, old: !!t.old } : null,
            block:   pb && pb.kind === 'turn' ? { title: pb.title, message: pb.message, day: !!pb.day } : null,
            methods: data.methods || []
        }];
    }

    back() {
        if (this.fromDetail) orderDetail.show(this.o.id);
    }

    // -- Estado --

    branchOf(id) {
        return (this.branches || []).find((b) => b.id === Number(id)) || null;
    }

    cobroBranch() {
        return this.branchOf(this.cobro)
            || (this.branches && this.branches[0])
            || { id: this.cobro, name: 'Esta sucursal', session: true, turn: null, block: null, methods: [] };
    }

    originBranch() {
        return this.branchOf(this.origin) || this.cobroBranch();
    }

    sessionBranch() {
        return (this.branches || []).find((b) => b.session) || this.originBranch();
    }

    isCross() {
        return this.cobro !== this.origin;
    }

    // Una sucursal donde sí se puede cobrar: turno sin candado y al menos una forma de pago.
    usable(b) {
        return !!b && !b.block && (b.methods || []).length > 0;
    }

    turnState(b) {
        if (!b || !b.turn) return 'none';

        return b.turn.old ? 'old' : 'open';
    }

    // Las formas de pago de la sucursal que cobra (payment_method.branch_id), con ícono y color.
    payMethods() {
        const c = this.mcache;

        if (c && c.cobro === this.cobro && c.branches === this.branches) return c.list;

        const list = (this.cobroBranch().methods || []).map((r) => {
            const m = { id: Number(r.id), name: r.name, code: r.code, cash: Number(r.is_cash) === 1 };

            m.icon  = this.methodIcon(m);
            m.color = this.methodColor(m.icon);
            m.hint  = this.methodHint(m);

            return m;
        });

        this.mcache = { cobro: this.cobro, branches: this.branches, list: list };

        return list;
    }

    cashOf() {
        return this.payMethods().find((m) => m.cash) || null;
    }

    // A donde vuelve el teclado: Efectivo, o la primera forma si la sucursal no tiene.
    homeId() {
        const m = this.cashOf() || this.payMethods()[0];

        return m ? String(m.id) : '';
    }

    fieldInput(f) {
        if (f === '' || f === null || f === undefined) return null;
        if (f === 'received') return document.getElementById('paRecv');
        if (f === 'disc')     return document.getElementById('paDiscValue');

        return document.getElementById(`paAmt${f}`);
    }

    isSettled() {
        return this.o.total > 0 && ordRound(this.o.total - this.o.paid) <= 0.005;
    }

    /*  Por qué no se cobra: 'block' (cancelado, sin permiso o cotización vacía),
        'paid', 'turn' (la sucursal que cobra no tiene turno), 'methods' (no tiene
        formas de pago) o '' (se cobra). El candado del turno es el de la sucursal
        que cobra: con otra sucursal elegida, el de la sesión no estorba. */
    lockState() {
        const o = this.o;
        const b = this.payBlock;

        if (o.cancelled)                                     return 'block';
        if (o.total > 0 && o.paid + 0.005 >= o.total)        return 'paid';
        if ((b && b.kind !== 'turn') || (!this.canPay && !b)) return 'block';
        if (this.cobroBranch().block)                        return 'turn';
        if (!this.payMethods().length)                       return 'methods';

        return '';
    }

    /*  auto = la fila que cubre lo que falta. En pedidos arranca vacía (0): el
        importe lo escribe quien cobra. fillsBalance() = true la arranca en
        Efectivo con todo el saldo (historial de ventas).
        active = donde escribe el teclado: id de la forma, 'received' o 'disc'.
        fresh = la siguiente tecla reemplaza lo escrito. busy = candado contra el doble cobro. */
    resetForm() {
        const home = this.homeId();

        this.auto        = this.fillsBalance() ? (Number(home) || 0) : 0;
        this.active      = home;
        this.fresh       = true;
        this.discOpen    = false;
        this.discMode    = 'percent';
        this.confirmCalc = null;
        this.delPay      = null;
        this.busy        = false;
    }

    afterChange() {
        orders.lsOrders();
        orderTurn.touch();
    }

    // -- Textos (Ventas los cambia) --

    noun()         { return 'Pedido'; }
    theNoun()      { return 'el pedido'; }
    prefix()       { return 'P'; }
    noClient()     { return 'Sin cliente'; }
    totalExtra(after) { return ''; }
    paidLabel()    { return 'Pedido pagado completamente'; }
    paidShort()    { return 'Pedido pagado.'; }
    canDiscount()  { return true; }
    keyOnSettled() { return true; }
    fillsBalance() { return false; }
    originLabel()  { return 'Origen del pedido'; }

    // -- Cuentas --

    // Lo que se cobra en esta ventana: el saldo del pedido. Ventas le suma la propina.
    dueOf(total) {
        return Math.max(0, ordRound(total - this.o.paid));
    }

    // Tope de la fila que cubre lo que falta (Ventas: el saldo del monedero).
    autoCap(m) {
        return Infinity;
    }

    calc() {
        const o       = this.o;
        const d       = this.discountCalc();
        const total   = ordRound(o.total - d.amount);
        const balance = this.dueOf(total);

        let bad = null;

        // Como Soft: todas las formas de la sucursal; las que quedan en 0 no se cobran.
        // La que cubre lo que falta no se lee: toma lo que dejan las demás.
        const rows = this.payMethods().map((m) => {
            if (m.id === this.auto) return { m: m, amount: 0 };

            const input = this.fieldInput(m.id);
            const raw   = String(input ? input.value : '').trim();
            const value = raw === '' ? 0 : this.num(raw);

            if (value === null && !bad) bad = m;

            return { m: m, amount: value || 0 };
        });

        const fixed = ordRound(rows.reduce((s, r) => s + r.amount, 0));
        const auto  = rows.find((r) => r.m.id === this.auto);

        if (auto) auto.amount = Math.min(this.autoCap(auto.m), Math.max(0, ordRound(balance - fixed)));

        /*  Efectivo: lo escrito en su fila es «hasta cuánto». Se aplica lo que
            cabe en el saldo después de los demás métodos y lo que sobra es
            cambio. «Recibe en efectivo», si se llena, es el billete entregado. */
        const cashRow   = rows.find((r) => r.m.cash) || null;
        const cashTyped = cashRow ? cashRow.amount : 0;
        const others    = ordRound(rows.reduce((s, r) => s + (r === cashRow ? 0 : r.amount), 0));
        const room      = Math.max(0, ordRound(balance - others));
        const cashPaid  = ordRound(Math.min(cashTyped, room));
        const recvEl    = document.getElementById('paRecv');
        const rawRec    = String(recvEl ? recvEl.value : '').trim();
        const rec       = rawRec === '' || cashPaid <= 0 ? null : this.num(rawRec);
        const badRec    = rawRec !== '' && cashPaid > 0 && rec === null;
        const cashGiven = rec === null ? cashTyped : rec;

        const payments = [];

        rows.forEach((r) => {
            const value = r === cashRow ? cashPaid : r.amount;

            if (value <= 0) return;

            payments.push({ method_id: r.m.id, amount: value, tendered: r === cashRow ? cashGiven : value });
        });

        // Solo lo que no es efectivo puede sobrar; el efectivo que ya no cabe también sobra.
        const over    = ordRound(Math.max(0, others - balance) + (cashTyped > 0 && cashPaid <= 0 ? cashTyped : 0));
        const applied = ordRound(payments.reduce((s, p) => s + p.amount, 0));
        const missing = cashPaid > 0 ? Math.max(0, ordRound(cashPaid - cashGiven)) : 0;
        const change  = cashPaid > 0 ? Math.max(0, ordRound(cashGiven - cashPaid)) : 0;

        return { d, total, balance, rows, bad, badRec, cashTyped, cashPaid, cashGiven, payments, applied, over, missing, change };
    }

    discountCalc() {
        const off = { amount: 0, error: '' };

        if (!this.discOpen) return off;

        const o      = this.o;
        const raw    = String($('#paDiscValue').val() || '').trim();
        const reason = this.reasons.find((r) => String(r.id) === String($('#paReason').val()));
        const value  = this.num(raw);
        const fail   = (error) => ({ amount: 0, error: error });

        if (raw === '' && !reason) return off;
        if (!reason)               return fail('Elige el motivo del descuento.');
        if (raw === '')            return fail('Escribe el descuento.');
        if (value === null || value <= 0)               return fail('El descuento tiene que ser mayor a 0.');
        if (this.discMode === 'percent' && value > 100) return fail('El descuento no puede pasar de 100 %.');

        const cut = this.discMode === 'percent' ? ordRound(o.subtotal * value / 100) : value;
        const max = Number(reason.max_percent);
        const cap = ordRound(o.subtotal * max / 100);

        if (cut <= 0)                                 return fail('El descuento tiene que ser mayor a $0.');
        if (cut > cap + 0.005)                        return fail(`«${reason.name}» permite hasta ${max} % (${money(cap)}).`);
        if (cut > o.total + 0.005)                    return fail('El descuento no puede ser mayor que el total.');
        if (ordRound(o.total - cut) + 0.005 < o.paid) return fail(`Con ese descuento el total queda debajo de lo ya abonado (${money(o.paid)}).`);

        if (Number(reason.requires_authorization) === 1 && !this.canAuthorize) {
            return fail(`«${reason.name}» lo autoriza un Dueño o Supervisor.`);
        }

        return {
            amount:  cut,
            error:   '',
            reason:  reason,
            value:   value,
            percent: o.subtotal > 0 ? ordRound(cut / o.subtotal * 100) : 0
        };
    }

    // Lo que frena el guardado, en orden. '' = se puede registrar.
    problem(c) {
        if (c.d.error)                     return c.d.error;
        if (c.bad)                         return `El monto de ${c.bad.name} no es válido.`;
        if (c.badRec)                      return 'El monto recibido en efectivo no es válido.';
        if (c.over > 0.005)                return `Los pagos pasan del saldo por ${money(c.over)}. El saldo es ${money(c.balance)}: no se cobra de más.`;
        if (c.applied <= 0 && !c.d.amount) return 'Escribe cuánto paga el cliente.';
        if (c.payments.length > 6)         return 'Un cobro admite hasta 6 métodos de pago.';
        if (c.missing > 0.005)             return `Faltan ${money(c.missing)} por recibir en efectivo.`;

        return '';
    }

    // Pedido nuevo sin nada escrito: el botón no cobra, pregunta cómo se guarda (askDraft).
    noAmount(c) {
        return !c.d.error && !c.bad && !c.badRec && c.over <= 0.005 && c.applied <= 0 && !c.d.amount;
    }

    rowHint(r, c) {
        if (r.m.cash && c.cashPaid > 0 && c.cashTyped > c.cashPaid + 0.005) return `Se aplican ${money(c.cashPaid)}; lo demás es cambio`;
        if (r.m.id === this.auto) return 'Cubre lo que falta del saldo';

        return r.m.hint;
    }

    // Como alpha: «Registrar $X en {forma}», con el ícono de la forma. Devuelve [texto, ícono].
    saveLabel(c) {
        if (c.bad || c.over > 0.005 || c.applied <= 0) {
            return c.applied <= 0 && c.d.amount > 0 && !c.bad ? ['Aplicar descuento', 'percent'] : ['Registrar pago', 'check'];
        }

        if (this.thenDeliver && c.applied + 0.005 >= c.balance) return ['Cobrar y entregar', 'package-check'];

        if (c.payments.length > 1) return [`Registrar ${money(c.applied)} en ${c.payments.length} formas`, 'layers'];

        const m = this.methodOf(c.payments[0].method_id);

        return m ? [`Registrar ${money(c.applied)} en ${m.name}`, m.icon] : [`Registrar ${money(c.applied)}`, 'check'];
    }

    // -- Piezas de la ventana --

    headHtml() {
        const o    = this.o;
        const day  = this.dateOf(o.delivery);
        const tab  = (view, icon, text, extra = '') => {
            const on = this.view === view;

            return `<button type="button" class="pa-tab${on ? ' is-active' : ''}" role="tab" aria-selected="${on}" data-act="view" data-value="${view}">${this.ico(icon)}${text}${extra}</button>`;
        };

        return '<div class="pa-head">'
            +   '<div class="pa-head-top">'
            +     `<div class="pa-head-ico">${this.ico('wallet')}</div>`
            +     '<div class="pa-head-text"><h2 id="paTitle">Gestión de pagos</h2>'
            +       '<p class="pa-head-meta">'
            +         (this.draft
                ? `<span>${this.ico('file-text')}<b>Pedido nuevo</b> · se guarda al cobrar</span>`
                : `<span>${this.ico('file-text')}Folio <b>#${this.prefix()}${esc(o.folio)}</b></span>`)
            +         `<span class="is-client">${this.ico('user')}<em>${esc(o.customer || this.noClient())}</em></span>`
            +         (day ? `<span>${this.ico('calendar')}Entrega ${day}</span>` : '')
            +       '</p>'
            +     '</div>'
            +     `<button type="button" class="pa-x" data-act="close" aria-label="Cerrar">${this.ico('x')}</button>`
            +   '</div>'
            +   '<div class="pa-tabs" role="tablist">'
            +     tab('pay', 'hand-coins', 'Registrar pago')
            +     tab('history', 'history', 'Historial', `<span class="pa-count">${this.payments.length}</span>`)
            +   '</div>'
            + '</div>';
    }

    // Los recuadros de alpha: Total, Pagado y Restante (verde al saldar). Los llena paintSummary.
    summaryHtml() {
        const done = this.isSettled();

        return '<div class="pa-sum">'
            +   `<div class="pa-stat is-total"><span>${this.ico('wallet')}Total</span><b id="paSumTotal"></b><small id="paSumTotalNote"></small></div>`
            +   `<div class="pa-stat is-paid"><span>${this.ico('circle-check')}Pagado</span><b id="paSumPaid"></b></div>`
            +   `<div class="pa-stat is-due" id="paSumDueBox"><span>${this.ico(done ? 'circle-check' : 'clock')}${done ? 'Pagado completo' : 'Restante'}</span><b id="paSumDue"></b><small id="paSumDueNote"></small></div>`
            + '</div>';
    }

    // El subtítulo de alpha (misma sucursal u otra) y el punto del turno; el detalle queda en title.
    turnLine(b) {
        const st    = this.turnState(b);
        const folio = b.turn && b.turn.folio != null ? esc(b.turn.folio) : '';
        const where = this.isCross() ? 'Cobro en otra sucursal' : 'Misma sucursal de origen';

        if (st === 'open') return `<span class="pa-dot pa-turn-open"></span>${where} · Turno ${folio}`;
        if (st === 'old')  return `<span class="pa-dot pa-turn-old"></span>Turno ${folio} sin cerrar`;

        return '<span class="pa-dot pa-turn-none"></span>Sin turno abierto';
    }

    turnTitle(b) {
        const st = this.turnState(b);
        const t  = b.turn || {};

        if (st === 'open') return `Turno ${t.folio} abierto${t.opened_by ? ` · ${t.opened_by}` : ''}`;
        if (st === 'old')  return `Turno ${t.folio}${t.opened_by ? ` de ${t.opened_by}` : ''} sin cerrar desde el ${ordDate(t.opened_at)}`;

        return 'Sin turno abierto';
    }

    // Cada bloque lleva su rótulo encima, como los lbl del formulario de alpha.
    label(text, aside = '') {
        return `<div class="pa-label"><span>${text}</span>${aside ? `<small>${aside}</small>` : ''}</div>`;
    }

    // Las dos tarjetas de alpha: de dónde es el pedido y qué sucursal cobra.
    branchesHtml(lock) {
        const origin = this.originBranch();
        const cobro  = this.cobroBranch();
        const off    = lock === 'paid' || lock === 'block';
        const fixed  = off || this.branches.length < 2;
        const opts   = this.branches.map((b) => `<option value="${b.id}"${b.id === this.cobro ? ' selected' : ''}>${esc(b.name)}${b.session ? ' · tu sesión' : ''}</option>`).join('');

        return '<div class="pa-field">'
            +   this.label(this.originLabel())
            +   '<div class="pa-branch">'
            +     `<span class="pa-branch-ico">${this.ico('house')}</span>`
            +     `<span class="pa-branch-text"><b>${esc(origin.name)}</b><small>Sucursal donde se generó la venta</small></span>`
            +   '</div>'
            + '</div>'
            + '<div class="pa-field">'
            +   this.label('Sucursal que cobrará')
            +   `<div class="pa-branch is-cobro${this.isCross() ? ' is-cross' : ''}${off ? ' is-off' : ''}" title="${esc(this.turnTitle(cobro))}">`
            +     `<span class="pa-branch-ico">${this.ico('landmark')}</span>`
            +     `<span class="pa-branch-text"><b>${esc(cobro.name)}</b><small>${this.turnLine(cobro)}</small></span>`
            +     (fixed ? '' : `<span class="pa-branch-chev">${this.ico('chevron-down')}</span>`)
            +     `<select id="paCobro" aria-label="Sucursal que cobrará"${fixed ? ' disabled' : ''}>${opts}</select>`
            +   '</div>'
            +   this.alertHtml(lock)
            + '</div>';
    }

    /*  El aviso de alpha (#cobroShiftAlert) bajo la sucursal que cobra: la forma
        sigue a la vista, apagada, y se puede elegir otra sucursal sin cerrar. */
    alertHtml(lock) {
        if (!['turn', 'methods', 'block'].includes(lock)) return '';

        const cobro = this.cobroBranch();
        const home  = this.sessionBranch();
        const go    = (act, icon, text) => `<button type="button" class="pa-alert-go" data-act="${act}">${this.ico(icon)}${esc(text)}</button>`;
        const here  = home && home.id !== this.cobro && this.usable(home) ? go('cobro-here', 'landmark', `Cobrar en ${home.name}`) : '';

        let title = '';
        let text  = '';
        let btns  = '';

        if (lock === 'turn') {
            const b = cobro.block || {};

            title = b.title || `${cobro.name} no tiene turno abierto`;
            text  = b.message || 'Abre el turno para registrar este pago.';

            // Abrir el turno o ver el cierre solo se puede en la sucursal de la sesión.
            if (cobro.session) {
                const label = this.turnGo(b);

                btns = go('go', this.goIcon(label), label);
            }

            btns += here;
        } else if (lock === 'methods') {
            title = `${cobro.name} no tiene formas de pago activas`;
            text  = 'Elige otra sucursal o da de alta una forma de pago en Catálogo.';
            btns  = here;
        } else {
            const v = this.blockView();

            title = v.title;
            text  = v.text;
            btns  = v.go ? go('go', this.goIcon(v.go), v.go) : '';
        }

        return `<div class="pa-alert" role="alert">${this.ico('lock')}`
            +   `<div class="pa-alert-text"><b>${esc(title)}</b>${text ? `<p>${esc(text)}</p>` : ''}${btns ? `<div class="pa-alert-row">${btns}</div>` : ''}</div>`
            + '</div>';
    }

    turnGo(b) {
        if (b.day) return 'Ver cierre del día';

        return /otro d[ií]a/i.test(b.title || '') ? 'Ver turno' : 'Abrir turno';
    }

    goIcon(label) {
        const icons = { 'Abrir turno': 'lock-open', 'Ver turno': 'clock', 'Ver cierre del día': 'calendar-days', 'Editar pedido': 'pencil' };

        return icons[label] || 'lock-open';
    }

    // En táctil el teclado es el de la ventana: el del sistema no sale.
    inputMode() {
        return this.touch ? 'none' : 'decimal';
    }

    rowHtml(m) {
        return `<div class="pa-row" data-field="${m.id}" style="--m:${m.color}">`
            +   `<button type="button" class="pa-row-name" data-act="rest" data-id="${m.id}" title="Que ${esc(m.name)} cubra lo que falta">`
            +     `<span class="pa-row-ico">${this.ico(m.icon)}</span>`
            +     `<span class="pa-row-text"><b>${esc(m.name)}</b><small data-hint>${esc(m.hint)}</small></span>`
            +   '</button>'
            +   `<div class="pa-amt"><span>$</span><input id="paAmt${m.id}" type="text" inputmode="${this.inputMode()}" autocomplete="off" placeholder="0.00" data-field="${m.id}" aria-label="Importe en ${esc(m.name)}"></div>`
            + '</div>';
    }

    recvHtml() {
        return '<div class="pa-row is-recv" id="paRecvRow" data-field="received" hidden>'
            +   '<span class="pa-recv-label">Recibe en efectivo</span>'
            +   `<div class="pa-amt"><span>$</span><input id="paRecv" type="text" inputmode="${this.inputMode()}" autocomplete="off" placeholder="0.00" data-field="received" aria-label="Recibe en efectivo"></div>`
            + '</div>';
    }

    // La tabla de Soft: encabezado, una fila por forma de pago y «Recibe» al final.
    rowsHtml() {
        const list = this.payMethods();

        if (!list.length) return '';

        return `<div class="pa-grid-head"><span>Forma de pago · ${esc(this.cobroBranch().name)}</span><span>Importe</span></div>`
            + list.map((m) => this.rowHtml(m)).join('')
            + (this.cashOf() ? this.recvHtml() : '');
    }

    // Teclado de caja: 7-8-9 arriba. La tecla alta pasa de campo, no cobra.
    padHtml() {
        if (!this.touch) return '';

        const key = (k, text, cls = '', aria = '') => `<button type="button" class="pa-key${cls ? ` ${cls}` : ''}" data-act="key" data-key="${k}"${aria ? ` aria-label="${aria}"` : ''}>${text}</button>`;

        return '<div class="pa-pad" aria-label="Teclado">'
            +   key('7', '7') + key('8', '8') + key('9', '9') + key('back', this.ico('delete'), 'is-fn', 'Borrar')
            +   key('4', '4') + key('5', '5') + key('6', '6') + key('clear', 'C', 'is-clear', 'Limpiar')
            +   key('1', '1') + key('2', '2') + key('3', '3') + key('next', `${this.ico('corner-down-left')}Siguiente`, 'is-next')
            +   key('0', '0') + key('00', '00') + key('.', '.')
            + '</div>';
    }

    discHtml() {
        const seg = (mode, text) => `<button type="button" class="pa-seg-btn${this.discMode === mode ? ' is-active' : ''}" data-act="mode" data-value="${mode}">${text}</button>`;
        const opt = (r) => `<option value="${esc(r.id)}">${esc(r.name)} · ${Number(r.requires_authorization) === 1 ? 'pide autorización' : `hasta ${Number(r.max_percent)} %`}</option>`;

        return `<div class="pa-disc" id="paDisc"${this.discOpen ? '' : ' hidden'}>`
            +   `<select id="paReason" class="pa-input" aria-label="Motivo del descuento"><option value="">Motivo del descuento</option>${this.reasons.map(opt).join('')}</select>`
            +   '<div class="pa-disc-value" id="paDiscField">'
            +     `<input id="paDiscValue" class="pa-input" type="text" inputmode="${this.inputMode()}" autocomplete="off" placeholder="0" data-field="disc" aria-label="Descuento">`
            +     `<div class="pa-seg">${seg('percent', '%')}${seg('amount', '$')}</div>`
            +   '</div>'
            +   '<p class="pa-disc-msg" id="paDiscMsg"></p>'
            + '</div>';
    }

    // Un descuento por pedido y con motivo. Si ya tiene uno, o el corte cerró, solo se avisa.
    discArea() {
        const o = this.o;

        if (!this.canDiscount()) return '';

        if (o.discount_amount > 0) {
            const why = o.discount_reason ? ` (${esc(o.discount_reason)})` : '';

            return `<p class="pa-note-line">${this.ico('percent')}<span>Este pedido ya tiene un descuento de <b>${money(o.discount_amount)}</b>${why}. Solo se aplica uno.</span></p>`;
        }

        if (!this.reasons.length) return '';

        // Corte cerrado: el descuento movería su vendido; lo autoriza Dueño o Supervisor.
        if (this.discBlock) return `<p class="pa-note-line">${this.ico('lock')}<span>${esc(this.discBlock)}</span></p>`;

        return `<button type="button" class="pa-extra-btn" id="paDiscBtn" data-act="disc" aria-pressed="false">${this.ico('percent')}<span>Descuento</span></button>`
            + this.discHtml();
    }

    /*  Horizontal y en el orden en que se cobra: el total arriba a lo ancho; a
        la izquierda cómo se paga (las formas de pago con su importe y, en
        táctil, el teclado); a la derecha de dónde es el pedido, quién cobra,
        la observación y el descuento. Pagado o sin turno: la misma forma,
        apagada, y la ventana no cambia de tamaño. El fieldset apaga todo lo de
        adentro; la sucursal que cobra queda fuera para poder elegir otra. */
    payHtml(lock) {
        const off = lock ? ' disabled' : '';
        const cls = lock ? ' is-locked' : '';

        return '<div class="pa-form" id="paPayForm">'
            +   this.summaryHtml()
            +   '<div class="pa-cols">'
            +     `<fieldset class="pa-col pa-col-pay${cls}"${off}>`
            +       this.label('Importe', 'Toca una forma para que cubra lo que falta')
            +       `<div class="pa-rows" id="paRows" role="group" aria-label="Formas de pago">${this.rowsHtml()}</div>`
            +       this.padHtml()
            +     '</fieldset>'
            +     `<div class="pa-col pa-col-info">${this.infoHtml(lock)}</div>`
            +   '</div>'
            + '</div>';
    }

    // La columna derecha: de dónde es, quién cobra, la observación y el descuento. Ventas la cambia.
    infoHtml(lock) {
        const off = lock ? ' disabled' : '';
        const cls = lock ? ' is-locked' : '';

        return this.branchesHtml(lock)
            + `<fieldset class="pa-set${cls}"${off}>`
            +   '<div class="pa-field">'
            +     this.label('Observación', 'Opcional')
            +     '<textarea id="paNote" class="pa-input pa-textarea" rows="2" maxlength="200" placeholder="Ej. paga la mamá de la festejada" aria-label="Observación"></textarea>'
            +   '</div>'
            +   this.discArea()
            + '</fieldset>';
    }

    // Lo que dice el aviso si se pulsa el botón apagado.
    lockText(lock) {
        const b = this.cobroBranch();

        if (lock === 'paid')    return `${this.paidLabel()}.`;
        if (lock === 'turn')    return `${b.name}: ${(b.block && b.block.message) || 'sin turno abierto'}`;
        if (lock === 'methods') return `${b.name} no tiene formas de pago activas.`;

        const v = this.blockView();

        return v.text || v.title;
    }

    // -- Sin cobro: por qué --

    // El aviso cuando no se puede cobrar. go = el botón que lo resuelve.
    blockView() {
        const o = this.o;
        const b = this.payBlock || {};

        if (b.kind === 'turn') {
            const title = b.title || 'Sin turno abierto';
            const go    = b.day ? 'Ver cierre del día' : /otro d[ií]a/i.test(title) ? 'Ver turno' : 'Abrir turno';

            return { tone: 'is-warn', icon: 'lock', title: title, text: b.message || '', go: go };
        }

        if (b.kind === 'role' || b.kind === 'methods') {
            return { tone: 'is-info', icon: 'lock', title: b.title, text: b.message, go: '' };
        }

        if (o.cancelled) {
            const kept = o.paid > 0 ? ' Sus pagos se conservan en el historial.' : '';

            return { tone: 'is-muted', icon: 'circle-x', title: 'Pedido cancelado', text: 'Un pedido cancelado no se cobra.' + kept, go: '' };
        }

        if (o.total > 0 && o.paid + 0.005 >= o.total) {
            return { tone: 'is-ok', icon: 'circle-check', title: 'Pedido pagado completamente', text: 'No queda saldo por cobrar.', go: '' };
        }

        if (o.subtotal <= 0.005 && o.paid <= 0.005 && !this.payments.length) {
            const edit = typeof orderForm !== 'undefined' && orders.can('update') ? 'Editar pedido' : '';

            return { tone: 'is-warn', icon: 'package-open', title: 'Cotización sin productos', text: 'No tiene productos ni importe, así que no hay qué cobrar. Agrega los productos y después registra el anticipo.', go: edit };
        }

        return { tone: 'is-info', icon: 'lock', title: b.title || 'No se puede cobrar', text: b.message || '', go: '' };
    }

    // Abre el turno (o el cierre del día) y, con el turno abierto, regresa a este cobro.
    goTurn() {
        const id         = this.o.id;
        const fromDetail = this.fromDetail;
        const deliver    = this.thenDeliver;
        const day        = !!((this.cobroBranch().block || this.payBlock || {}).day);

        const draft      = this.draft;

        const next = () => (draft ? this.openDraft(draft) : this.open(id, fromDetail, { deliver: deliver }));

        this.closeQuiet('modalOrderPay', this.modal.close);

        if (day) return orderClosure.open(orderTurn.blockedDay(), { afterClose: next });

        orderTurn.open(0, { afterOpen: next });
    }

    // Cotización vacía: a la captura para agregar productos.
    goEdit() {
        const id = this.o.id;

        this.fromDetail = false;
        this.closeQuiet('modalOrderPay', this.modal.close);

        orderForm.edit(id);
    }

    // -- Historial --

    historyHtml() {
        const list = this.payments;

        // Sin pagos: el aviso vacío de alpha, en lugar de la tabla.
        if (!list.length) {
            return this.summaryHtml()
                + '<div class="pa-empty">'
                +   `<span class="pa-empty-ico">${this.ico('history')}</span>`
                +   '<b>Aún no se ha realizado ningún abono</b>'
                +   '<p>Los pagos registrados aparecerán aquí.</p>'
                + '</div>';
        }

        const liq  = this.isSettled() && this.keyOnSettled();
        const hint = this.canDelete
            ? `<p class="pa-hint">Un pago se quita solo con el turno abierto de la sucursal que lo cobró, y pide el motivo${liq ? '; con el pedido liquidado, también tu contraseña' : ''}.</p>`
            : '';

        return this.summaryHtml()
            + '<div class="pa-hist-wrap"><table class="pa-hist">'
            +   '<thead><tr><th>Fecha</th><th>Forma de pago</th><th>Cobró en</th><th class="pa-hide-sm">Observación</th><th class="r">Importe</th><th class="c"></th></tr></thead>'
            +   `<tbody>${list.map((p) => this.historyRow(p, liq)).join('')}</tbody>`
            + '</table></div>'
            + hint;
    }

    // En el celular la fecha va sin año y se esconden el turno y la observación.
    historyRow(p, liq) {
        const d      = ordDate(p.paid_at) || '';
        const time   = String(p.paid_at || '').slice(11, 16);
        const hour   = /^\d{2}:\d{2}$/.test(time) ? ordHour(time) : '';
        const icon   = this.methodIcon({ code: p.method_code, name: p.method, cash: Number(p.is_cash) === 1 });
        const change = Number(p.change_amount) > 0.005 ? `<small>Cambio ${money(p.change_amount)}</small>` : '';
        const bid    = Number(p.branch_id) || 0;
        const other  = bid && bid !== this.origin ? `<span class="pa-chip" title="Otra sucursal">${this.ico('arrow-right-left')}<span>Otra sucursal</span></span>` : '';
        const turn   = [p.turn_folio ? `Turno ${esc(p.turn_folio)}` : '', esc(p.received_by || '')].filter(Boolean).join(' · ');
        const title  = liq ? 'Quitar pago (pide contraseña: liquidado)' : 'Quitar pago';

        let act = '';

        if (this.canDelete && p.turn_status !== 'closed') {
            act = `<button type="button" class="pa-del" data-act="del" data-id="${Number(p.id)}" title="${title}" aria-label="${title}">${this.ico('trash-2')}</button>`;
        } else if (this.canDelete) {
            act = `<span class="pa-lock" title="El turno ${esc(p.turn_folio || '')} ya cerró: reábrelo para quitar este pago.">${this.ico('lock')}</span>`;
        }

        return '<tr>'
            +   `<td>${d.slice(0, 5)}<span class="pa-hide-sm">${d.slice(5)}</span>${hour ? `<small>${hour}</small>` : ''}</td>`
            +   `<td><span class="pa-hist-method"><span class="pa-row-ico" style="--m:${this.methodColor(icon)}">${this.ico(icon)}</span><span><b>${esc(p.method || 'Pago')}</b>${change}</span></span></td>`
            +   `<td><span class="pa-hist-branch">${esc(p.branch || this.originBranch().name)}${other}</span>${turn ? `<small class="pa-hide-sm">${turn}</small>` : ''}</td>`
            +   `<td class="pa-hist-note pa-hide-sm" title="${esc(p.description || '')}">${esc(p.description || '')}</td>`
            +   `<td class="r"><b>${money(p.amount)}</b></td>`
            +   `<td class="c">${act}</td>`
            + '</tr>';
    }

    // -- Pie y confirmación --

    // Como alpha: el resultado en una línea y un solo botón. El historial no lleva pie.
    footHtml(lock) {
        if (lock === 'paid') {
            const n = this.payments.length;

            return '<div class="pa-foot">'
                +   `<div class="pa-res is-ok"><span>${esc(this.paidLabel())}</span><small>· ${money(this.o.paid)} en ${n} ${n === 1 ? 'pago' : 'pagos'}</small></div>`
                +   `<button type="button" class="pa-save is-quiet" data-act="view" data-value="history">${this.ico('history')}<span>Ver historial</span></button>`
                + '</div>';
        }

        let res = '<div class="pa-res" id="paRes" aria-live="polite"></div>';

        if (lock) {
            const b    = this.cobroBranch();
            const name = esc(b.name);
            const st   = this.turnState(b);
            const turn = st === 'none' ? 'Sin turno' : st === 'old' ? 'Turno sin cerrar' : esc((b.block && b.block.title) || 'No se cobra');
            const says = {
                turn:    [turn, `En ${name} no se registran pagos`],
                methods: ['Sin formas de pago', `${name} no tiene formas activas`],
                block:   [esc(this.blockView().title), '']
            }[lock];

            res = `<div class="pa-res is-bad"><span>${says[0]}</span>${says[1] ? `<small>· ${says[1]}</small>` : ''}</div>`;
        }

        // Pedido nuevo sin poder cobrar: el botón sigue vivo para guardarlo como cotización.
        const ask = !!(lock && this.draft);

        return '<div class="pa-foot">'
            +   res
            +   `<button type="button" class="pa-save${lock && !ask ? ' is-off' : ''}" id="paSave" data-act="save"><span class="pa-save-ico" id="paSaveIco" data-icon="check">${this.ico('check')}</span><span id="paSaveLabel">${ask ? 'Guardar pedido' : 'Registrar pago'}</span></button>`
            + '</div>';
    }

    // La confirmación de alpha: importe, forma, sucursal que cobra y el aviso de cobro cruzado.
    confirmHtml(c) {
        const o     = this.o;
        const b     = this.cobroBranch();
        const turn  = b.turn && b.turn.folio != null ? `Turno ${esc(b.turn.folio)}` : '';
        const after = Math.max(0, ordRound(c.balance - c.applied));
        const disc  = c.applied <= 0;
        const draft = !!this.draft;
        const ask   = draft
            ? (disc ? '¿Guardar pedido y aplicar descuento?' : '¿Guardar pedido y registrar pago?')
            : (disc ? '¿Aplicar descuento?' : '¿Registrar pago?');
        const yes   = draft ? 'Sí, guardar' : (disc ? 'Sí, aplicar' : 'Sí, registrar');
        const tag   = draft ? 'Pedido nuevo' : `#${this.prefix()}${esc(o.folio)}`;
        const name  = (id) => { const m = this.methodOf(id); return m ? esc(m.name) : 'Pago'; };
        const row   = (dt, dd, rowCls = '', ddCls = '') => `<div${rowCls ? ` class="${rowCls}"` : ''}><dt>${dt}</dt><dd${ddCls ? ` class="${ddCls}"` : ''}>${dd}</dd></div>`;

        let how = '';

        if (c.payments.length === 1)    how = row('Forma de pago', name(c.payments[0].method_id));
        else if (c.payments.length > 1) how = c.payments.map((p) => row(name(p.method_id), money(p.amount))).join('');

        const cross = this.isCross()
            ? `<p class="pa-confirm-warn">${this.ico('triangle-alert')}<span>Cobro cruzado: ${this.theNoun()} es de <b>${esc(this.originBranch().name)}</b>, pero el cobro entra al ${turn || 'turno'} de <b>${esc(b.name)}</b>.</span></p>`
            : '';

        return '<div class="pa-confirm" id="paConfirm" role="alertdialog" aria-modal="true" aria-labelledby="paConfirmTitle">'
            +   '<div class="pa-confirm-card">'
            +     `<div class="pa-confirm-head"><div class="pa-head-ico">${this.ico(disc ? 'percent' : 'hand-coins')}</div><h3 id="paConfirmTitle">${ask}</h3><p>${tag} · ${esc(o.customer || this.noClient())}</p></div>`
            +     '<dl class="pa-confirm-rows">'
            +       row(disc ? 'Descuento' : 'Importe', money(disc ? c.d.amount : c.applied), 'is-big')
            +       how
            +       (c.change > 0.005 ? row('Recibe', `${money(c.cashGiven)} · cambio ${money(c.change)}`) : '')
            +       (c.d.amount > 0 && !disc ? row('Descuento', `−${money(c.d.amount)} · ${esc(c.d.reason.name)}`) : '')
            +       (c.note ? row('Observación', esc(c.note)) : '')
            +       row('Sucursal que cobra', `${esc(b.name)}${turn ? ` · ${turn}` : ''}`, '', 'is-brand')
            +       row('Saldo después', after <= 0.005 ? 'Queda pagado' : money(after))
            +     '</dl>'
            +     cross
            +     '<div class="pa-confirm-foot">'
            +       '<button type="button" class="pa-btn" data-act="confirm-no">Cancelar</button>'
            +       `<button type="button" class="pa-btn is-primary" id="paConfirmYes" data-act="confirm-yes"><span data-label>${yes}</span></button>`
            +     '</div>'
            +   '</div>'
            + '</div>';
    }

    delKeyHtml() {
        return '<div class="pa-field pa-del-field" id="paDelKeyField">'
            +   this.label('Contraseña')
            +   '<input type="password" id="paDelKey" class="pa-input" placeholder="••••••••" autocomplete="off" aria-label="Contraseña">'
            +   '<p class="pa-del-msg" id="paDelKeyMsg" hidden>Escribe tu contraseña.</p>'
            + '</div>';
    }

    // El motivo de alpha: sin motivo no se quita; con el pedido liquidado, también la contraseña.
    delHtml(p) {
        const liq  = this.isSettled() && this.keyOnSettled();
        const day  = (ordDate(p.paid_at) || '').slice(0, 5);
        const what = `<b>${money(p.amount)}</b> en ${esc(p.method || 'Pago')}${day ? ` del ${day}` : ''}`;
        const who  = this.theNoun().charAt(0).toUpperCase() + this.theNoun().slice(1);
        const text = liq
            ? `Ingresa tu contraseña para quitar el pago de ${what}. ${who} regresa a pendiente.`
            : `Se quita el pago de ${what} de forma permanente.`;

        return '<div class="pa-confirm" id="paDel" role="alertdialog" aria-modal="true" aria-labelledby="paDelTitle">'
            +   '<div class="pa-confirm-card">'
            +     `<div class="pa-confirm-head"><div class="pa-head-ico is-bad">${this.ico(liq ? 'lock' : 'trash-2')}</div><h3 id="paDelTitle">${liq ? `${this.noun()} liquidado` : '¿Quitar pago?'}</h3>`
            +       `<p>${text}</p></div>`
            +     (liq ? this.delKeyHtml() : '')
            +     '<div class="pa-field pa-del-field" id="paDelReasonField">'
            +       this.label('Motivo')
            +       '<textarea id="paDelReason" class="pa-input pa-textarea" rows="2" maxlength="200" placeholder="Ej. el pago se registró dos veces" aria-label="Motivo"></textarea>'
            +       '<p class="pa-del-msg" id="paDelMsg" hidden>Escribe el motivo.</p>'
            +     '</div>'
            +     '<div class="pa-confirm-foot">'
            +       '<button type="button" class="pa-btn" data-act="del-no">Cancelar</button>'
            +       '<button type="button" class="pa-btn is-danger" id="paDelYes" data-act="del-yes">Quitar pago</button>'
            +     '</div>'
            +   '</div>'
            + '</div>';
    }

    // -- Pintar --

    render() {
        const win = $('#paWin');

        if (!win.length) return;

        const pay  = this.view === 'pay';
        const lock = this.lockState();

        win.html(
            this.headHtml()
            + `<div class="pa-body">${pay ? this.payHtml(lock) : this.historyHtml()}</div>`
            + (pay ? this.footHtml(lock) : '')
        );

        this.icons();

        if (pay && lock === '') {
            this.paintCalc();
            this.focusField(this.active);
        } else {
            this.paintStatic();
        }
    }

    // Con descuento, el total de antes sale tachado (como en alpha).
    totalNote(cut) {
        const o = this.o;

        let note = '';

        if (cut > 0)                    note = `<s>${money(o.total)}</s>`;
        else if (o.discount_amount > 0) note = `<s>${money(o.subtotal)}</s>`;

        return note + this.totalExtra(note !== '');
    }

    // dueNote: el saldo de antes, tachado, mientras se escribe un cobro.
    paintSummary(v) {
        $('#paSumTotal').text(money(v.total));
        $('#paSumTotalNote').html(v.totalNote || '');
        $('#paSumPaid').text(money(v.paid));
        $('#paSumDue').text(money(v.due));
        $('#paSumDueNote').html(v.dueNote || '');
        $('#paSumDueBox').toggleClass('is-done', v.total > 0.005 && v.due <= 0.005);
    }

    // Pagado, sin turno o historial: el resumen sin cobro en curso.
    paintStatic() {
        const o = this.o;

        this.paintSummary({ total: o.total, totalNote: this.totalNote(0), paid: o.paid, due: Math.max(0, ordRound(o.total - o.paid)) });
    }

    /*  Las filas no se vuelven a pintar al teclear (se perdería el foco); solo
        cambian su marca, su pista y, la que cubre lo que falta, su monto. */
    paintCalc() {
        if (!document.getElementById('paPayForm') || this.lockState() !== '') return;

        const c = this.calc();
        const o = this.o;

        c.rows.forEach((r) => {
            const input = this.fieldInput(r.m.id);

            if (!input) return;

            const row  = input.closest('.pa-row');
            const hint = row ? row.querySelector('[data-hint]') : null;
            const auto = r.m.id === this.auto;

            if (auto) input.value = r.amount > 0 ? r.amount.toFixed(2) : '';

            if (row) row.classList.toggle('is-auto', auto);
            if (hint) hint.textContent = this.rowHint(r, c);

            input.parentElement.classList.toggle('is-bad', c.bad === r.m);
        });

        // «Recibe» sale solo cuando Efectivo lleva monto.
        const recvRow = document.getElementById('paRecvRow');
        const recv    = document.getElementById('paRecv');

        if (recv && recvRow) {
            if (c.cashPaid <= 0 && recv.value !== '') recv.value = '';

            recvRow.hidden   = c.cashPaid <= 0;
            recv.placeholder = c.cashPaid > 0 ? c.cashPaid.toFixed(2) : '0.00';
            recv.parentElement.classList.toggle('is-bad', c.badRec);
        }

        if ((!recvRow || recvRow.hidden) && this.active === 'received') this.active = this.homeId();

        // Restante baja con lo que se escribe; el saldo de antes queda tachado debajo.
        const after = Math.max(0, ordRound(c.balance - c.applied));

        this.paintSummary({
            total:     c.total,
            totalNote: this.totalNote(c.d.amount),
            paid:      o.paid,
            due:       after,
            dueNote:   c.applied > 0 ? `<s>${money(c.balance)}</s>` : ''
        });

        this.paintResult(c);
        this.paintDiscount(c);
        this.paintActive();
        this.paintSave(c);
    }

    // El ícono solo se cambia cuando cambia la forma (lucide reemplaza el <i> por un <svg>).
    paintSave(c) {
        const ask          = !!this.draft && this.noAmount(c);
        const [text, icon] = ask ? ['Guardar pedido', 'check'] : this.saveLabel(c);
        const box          = document.getElementById('paSaveIco');

        $('#paSaveLabel').text(text);
        $('#paSave').toggleClass('is-off', !ask && this.problem(c) !== '');

        if (!box || box.dataset.icon === icon) return;

        box.dataset.icon = icon;
        box.innerHTML    = this.ico(icon);
        this.icons();
    }

    // Lo que va a pasar, en una sola línea del pie.
    paintResult(c) {
        const res = document.getElementById('paRes');

        if (!res) return;

        // El saldo que queda ya lo dice Restante arriba.
        const after = Math.max(0, ordRound(c.balance - c.applied));
        const tail  = after <= 0.005 ? 'Queda pagado' : 'Queda como abono';

        let st;   // [clase, etiqueta, monto, nota]

        if (c.d.error)                                      st = ['is-bad', 'Corrige', '', 'El descuento no es válido'];
        else if (c.bad)                                     st = ['is-bad', 'Corrige', '', `El monto de ${c.bad.name} no es válido`];
        else if (c.badRec)                                  st = ['is-bad', 'Corrige', '', 'Lo recibido en efectivo no es válido'];
        else if (c.over > 0.005)                            st = ['is-bad', 'Sobran', money(c.over), 'No se cobra de más: baja algún monto'];
        else if (c.applied <= 0 && c.d.amount > 0)          st = ['is-info', 'Solo descuento', money(c.d.amount), `El total queda en ${money(c.total)}`];
        else if (c.applied <= 0)                            st = ['', 'Sin monto', '', 'Escribe cuánto paga el cliente'];
        else if (c.missing > 0.005)                         st = ['is-bad', 'Faltan', money(c.missing), 'El efectivo recibido no alcanza'];
        else if (c.change > 0.005)                          st = ['is-ok', 'Cambio', money(c.change), tail];
        else if (c.payments.length === 1 && c.cashPaid > 0) st = ['is-ok', 'Efectivo exacto', '', tail];
        else                                                st = ['is-ok', 'Cobra', money(c.applied), tail];

        res.className = `pa-res${st[0] ? ` ${st[0]}` : ''}`;
        res.innerHTML = `<span>${esc(st[1])}</span>${st[2] ? `<b>${st[2]}</b>` : ''}<small>· ${esc(st[3])}</small>`;
    }

    paintDiscount(c) {
        const msg = document.getElementById('paDiscMsg');

        if (!msg) return;

        const d = c.d;

        msg.className = `pa-disc-msg${d.error ? ' is-bad' : (d.amount ? ' is-ok' : '')}`;
        msg.innerHTML = d.error
            ? esc(d.error)
            : (d.amount ? `Descuento de <b>${money(d.amount)}</b> (${d.percent} %). El total queda en ${money(c.total)}.` : 'Elige el motivo y escribe el descuento.');

        $('#paDiscBtn').toggleClass('is-on', this.discOpen).attr('aria-pressed', String(this.discOpen));

        $('#modalOrderPay button.pa-seg-btn').each((i, el) => {
            el.classList.toggle('is-active', el.dataset.value === this.discMode);
        });
    }

    // La fila (o el campo) donde escribe el teclado lleva la barra de color.
    paintActive() {
        $('#modalOrderPay .pa-row').each((i, el) => {
            el.classList.toggle('is-active', el.dataset.field === String(this.active));
        });

        $('#paDiscField').toggleClass('is-active', this.active === 'disc');
    }

    // -- Teclado --

    focusField(f) {
        const input = this.fieldInput(f);

        if (!input) return;

        input.focus({ preventScroll: true });
        input.select();
    }

    // Mismo orden que la tabla: las formas, «Recibe» y el descuento.
    visibleFields() {
        const list = this.payMethods().map((m) => String(m.id));
        const recv = document.getElementById('paRecvRow');

        if (recv && !recv.hidden) list.push('received');
        if (this.discOpen)        list.push('disc');

        return list;
    }

    nextField() {
        const list = this.visibleFields();

        if (!list.length) return;

        const at = list.indexOf(String(this.active));

        this.focusField(list[(at + 1) % list.length]);
    }

    // Los importes solo llevan dígitos y un punto con dos decimales: el signo de
    // menos, las letras y los símbolos se quitan al teclear o al pegar.
    clean(input) {
        const raw = input.value;

        let v = raw.replace(/[^\d.]/g, '');

        const dot = v.indexOf('.');

        if (dot >= 0) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '').slice(0, 2);

        if (v === raw) return;

        // El cursor se queda donde iba, no brinca al final.
        const at = Math.max(0, (input.selectionStart || 0) - (raw.length - v.length));

        input.value = v;
        input.setSelectionRange(at, at);
    }

    // Escribir en la fila que cubre lo que falta la vuelve fija.
    typed(input) {
        this.fresh = false;

        if (String(this.auto) === input.dataset.field) this.auto = 0;

        this.paintCalc();
    }

    press(k) {
        if (k === 'next') return this.nextField();

        const input = this.fieldInput(this.active);

        if (!input) return;

        let v = this.fresh && k !== 'back' ? '' : input.value;

        if (k === 'back') {
            v = v.slice(0, -1);
        } else if (k === 'clear') {
            v = '';
        } else if (k === '.') {
            if (v.includes('.')) return;
            v = `${v || '0'}.`;
        } else {
            const dot = v.indexOf('.');
            const dec = dot < 0 ? -1 : v.length - dot - 1;

            if (dec >= 2) return;

            v = (v === '0' ? '' : v) + (k === '00' && dec === 1 ? '0' : k);

            if (/^0+$/.test(v)) v = '0';
        }

        input.value = v;
        this.typed(input);
    }

    // Tocar el nombre de una forma: esa cubre lo que falta (la anterior se limpia).
    takeRest(id) {
        const old = this.fieldInput(this.auto);

        if (old && this.auto !== id) old.value = '';

        this.auto = id;
        this.paintCalc();
        this.focusField(String(id));
    }

    toggleDisc() {
        const panel = document.getElementById('paDisc');

        if (!panel || !document.getElementById('paPayForm') || this.lockState() !== '') return;

        this.discOpen = !this.discOpen;
        panel.hidden  = !this.discOpen;

        if (this.discOpen) {
            panel.scrollIntoView({ block: 'nearest' });
            document.getElementById('paReason').focus({ preventScroll: true });
        } else {
            $('#paReason, #paDiscValue').val('');

            if (this.active === 'disc') this.active = this.homeId();

            this.focusField(this.active);
        }

        this.paintCalc();
    }

    // Otra sucursal que cobra: otro turno y otro catálogo de formas de pago. La observación se queda.
    pickBranch(id) {
        if (!this.branchOf(id) || Number(id) === this.cobro) return;

        const note = $('#paNote').val() || '';

        this.cobro = Number(id);
        this.resetForm();
        this.render();

        $('#paNote').val(note);
    }

    // -- Guardar --

    // El botón, Enter o F2: revisa y pide la confirmación. Nada se guarda todavía.
    save() {
        // asking: la pregunta «¿Cómo se guarda?» está abierta (Enter o F2 no la repiten).
        if (this.confirmCalc || this.delPay || this.busy || this.asking) return;

        // En el historial, F2 lleva a registrar.
        if (!document.getElementById('paPayForm')) {
            if (this.view === 'history' && this.lockState() === '') {
                this.view = 'pay';
                this.resetForm();
                this.render();
            }
            return;
        }

        // El botón apagado avisa por qué. Pedido nuevo que no se puede cobrar: aún se guarda como cotización.
        const lock = this.lockState();

        if (lock && this.draft) return this.askDraft(this.lockText(lock));
        if (lock) return this.warn(this.lockText(lock));

        const c   = this.calc();
        const why = this.problem(c);

        if (this.draft && this.noAmount(c)) return this.askDraft('');
        if (why) return this.warn(why);

        c.note           = String($('#paNote').val() || '').trim();
        this.confirmCalc = c;

        $('#paWin').append(this.confirmHtml(c));
        this.icons();
        $('#paConfirmYes').trigger('focus');
    }

    closeConfirm() {
        if (this.busy) return;

        this.confirmCalc = null;
        $('#paConfirm').remove();

        this.focusField(this.active);
    }

    // Mientras se registra no se cierra la ventana ni se vuelve a cobrar.
    setBusy(on) {
        this.busy = on;

        $('#modalOrderPay').toggleClass('is-busy', on);
        $('#paWin button.pa-x').prop('disabled', on);
    }

    /*  Pedido nuevo: se guarda aquí, al confirmar el cobro. true = ya existe (this.o.id).
        Si no se guardó, la captura sigue abierta con todo lo escrito. El token de la
        captura evita un pedido doble si se vuelve a confirmar. */
    async saveDraft(draft, how = '') {
        const made = await draft.save(how);

        if (made && made.status == 200 && made.id) {
            this.o.id    = Number(made.id);
            this.o.folio = made.folio || made.id;
            this.draft   = null;

            return true;
        }

        if (made && made.status == 423) {
            this.closeQuiet('modalOrderPay', this.modal.close);
            this.busy = false;

            orderTurn.locked(made, () => this.openDraft(draft));

            return false;
        }

        this.setBusy(false);
        this.confirmCalc = null;
        $('#paConfirm').remove();

        alert({
            icon:     made && made.status && made.status < 500 ? 'warning' : 'error',
            title:    'No se guardó el pedido',
            text:     (made && made.message) || 'Revisa la conexión y vuelve a intentar. No se guarda dos veces.',
            btn1:     true,
            btn1Text: 'Entendido'
        });

        return false;
    }

    /*  Pedido nuevo sin importe: «¿Cómo se guarda?» (la pregunta es de la captura).
        Cotización se guarda sin dinero; Pendiente, sin anticipo y con todo el
        saldo por cobrar. Las dos guardan y cierran la ventana y la captura.
        Cerrada sin elegir, regresa al importe. block = por qué no se cobra;
        entonces solo queda Cotización. */
    async askDraft(block) {
        if (this.asking) return;

        const draft = this.draft;

        this.asking = true;

        const how = await draft.ask(block);

        this.asking = false;

        if (how !== 'quote' && how !== 'pending') return this.focusField(this.active);
        if (this.busy || this.draft !== draft) return;

        this.setBusy(true);

        if (!(await this.saveDraft(draft, how))) return;

        this.closeQuiet('modalOrderPay', this.modal.close);
        this.busy = false;
        this.afterChange();

        alert({ icon: 'success', title: `${this.noun()} ${this.prefix()}${this.o.folio} guardado como ${how === 'pending' ? 'pendiente' : 'cotización'}`, timer: 1600 });
    }

    // «Sí, registrar»: el candado (busy) y el token impiden un segundo cobro con doble clic o doble Enter.
    async commit() {
        if (this.busy || !this.confirmCalc) return;

        const c          = this.confirmCalc;
        const fromDetail = this.fromDetail;
        const deliver    = this.thenDeliver;
        const cross      = this.isCross();
        const draft      = this.draft;
        const created    = !!draft;

        this.setBusy(true);
        $('#paConfirmYes').prop('disabled', true).find('[data-label]').text(draft ? 'Guardando…' : 'Registrando…');

        // Pedido nuevo: primero se guarda; si no se guardó, no se cobra.
        if (draft && !(await this.saveDraft(draft))) return;

        const id = this.o.id;

        const discount = c.d.amount > 0
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
                opc:        'payOrder',
                id:         id,
                token:      this.token,
                payments:   c.payments.length ? JSON.stringify(c.payments) : '',
                discount:   discount,
                note:       c.note || '',
                pay_branch: this.cobro
            }
        });

        // Sin turno: en la sesión se ofrece abrirlo; en otra sucursal solo se avisa y se vuelve a abrir.
        if (data && data.status == 423) {
            const reopen = () => this.open(id, fromDetail, { deliver: deliver });
            const home   = this.cobroBranch().session;

            this.closeQuiet('modalOrderPay', this.modal.close);
            this.busy = false;

            if (created) this.afterChange();

            if (home) return orderTurn.locked(data, reopen);

            await alert({ icon: 'warning', title: data.title || 'Sin turno abierto', text: data.message || '', btn1: true, btn1Text: 'Entendido' });

            return reopen();
        }

        // Pedido recién guardado y el cobro no entró: queda como cotización y se abren sus pagos.
        if (created && (!data || data.status != 200)) {
            this.closeQuiet('modalOrderPay', this.modal.close);
            this.busy = false;
            this.afterChange();

            await alert({
                icon:     'warning',
                title:    `Pedido P${id} guardado sin anticipo`,
                text:     `${(data && data.message) || 'No se confirmó el cobro.'} Quedó como cotización: revisa sus pagos y registra el anticipo si falta.`,
                btn1:     true,
                btn1Text: 'Entendido'
            });

            return this.open(id);
        }

        if (!data || data.status != 200) {
            this.setBusy(false);
            this.confirmCalc = null;
            $('#paConfirm').remove();

            alert({
                icon:     data && data.status && data.status < 500 ? 'warning' : 'error',
                title:    'No se registró el cobro',
                text:     (data && data.message) || 'Revisa la conexión y vuelve a intentar. No se cobra dos veces.',
                btn1:     true,
                btn1Text: 'Entendido'
            });
            return;
        }

        this.token = ordToken();
        this.closeQuiet('modalOrderPay', this.modal.close);
        this.busy = false;
        this.afterChange();

        const print  = orders.can('print');
        const change = Number(data.change) > 0.005
            ? `<p class="text-[12px] font-semibold uppercase tracking-wide mb-0">Cambio</p><p class="text-[32px] font-bold text-emerald-600 leading-tight mb-2">${money(data.change)}</p>`
            : '';
        const owes   = Number(data.balance) > 0.005;
        const left   = owes ? `Saldo pendiente: <b>${money(data.balance)}</b>` : `<b>${this.paidShort()}</b>`;

        // «Cobrar y entregar» solo entrega si el cobro dejó el saldo en cero.
        const handOver = this.thenDeliver && !owes;
        const pending  = this.thenDeliver && owes ? '<p class="text-[12.5px] mt-1 mb-0" style="color:rgb(var(--brand-600))">No se entrega todavía: falta cobrar el saldo.</p>' : '';
        const saved    = created ? `<p class="text-[13px] mb-1">Pedido <b>P${id}</b> guardado.</p>` : '';

        const answer = await alert({
            icon:     'success',
            title:    data.message,
            html:     `${saved}${change}<p class="text-[14px] mb-0">${left}</p>${pending}`,
            btn1:     print,
            btn1Text: 'Imprimir ticket',
            btn2:     true,
            btn2Text: handOver ? 'Entregar pedido' : 'Listo'
        });

        if (answer && answer.isConfirmed) await orderDetail.print(this.o.id);

        // La entrega pide la contraseña: esa ventana es la confirmación.
        if (handOver) return orderDetail.deliver(this.o.id, { fromDetail: this.fromDetail });

        this.back();
    }

    // -- Quitar un pago (en la ventana) --

    openDel(id) {
        if (this.delPay || this.confirmCalc || this.busy) return;

        const p = this.payments.find((x) => Number(x.id) === Number(id));

        if (!p) return;

        this.delPay = p;

        $('#paWin').append(this.delHtml(p));
        this.icons();

        (document.getElementById('paDelKey') || document.getElementById('paDelReason')).focus();
    }

    closeDel() {
        if (this.busy) return;

        this.delPay = null;
        $('#paDel').remove();
    }

    // Marca el campo que falta y lo enfoca.
    delMissing(field, msg) {
        $(`#${msg}`).prop('hidden', false);
        $(`#${field}`).addClass('is-bad').trigger('focus');
    }

    // Sin motivo no se quita (el ctrl lo exige y lo deja en la bitácora); liquidado, tampoco sin contraseña.
    async removePay() {
        if (this.busy || !this.delPay) return;

        const p      = this.delPay;
        const keyEl  = document.getElementById('paDelKey');
        const reason = String($('#paDelReason').val() || '').trim();

        if (keyEl && !keyEl.value) return this.delMissing('paDelKey', 'paDelKeyMsg');
        if (!reason)               return this.delMissing('paDelReason', 'paDelMsg');

        const id         = this.o.id;
        const fromDetail = this.fromDetail;
        const deliver    = this.thenDeliver;

        this.setBusy(true);
        $('#paDelYes').prop('disabled', true);

        const data = await useFetch({
            url:  this._link,
            data: { opc: 'deletePayment', id: id, payment_id: Number(p.id), reason: reason, key: keyEl ? keyEl.value : '' }
        });

        this.setBusy(false);
        $('#paDelYes').prop('disabled', false);

        // El ctrl pide (o rechaza) la contraseña: el campo aparece o se marca.
        if (data && data.key) {
            if (!document.getElementById('paDelKey')) $('#paDelReasonField').before(this.delKeyHtml());

            $('#paDelKeyMsg').text(data.message || 'Escribe tu contraseña.').prop('hidden', false);
            $('#paDelKey').addClass('is-bad').val('').trigger('focus');
            return;
        }

        if (!data || data.status != 200) {
            alert({
                icon:     data && data.status == 409 ? 'warning' : 'error',
                title:    'No se quitó el pago',
                text:     (data && data.message) || 'Revisa la conexión y vuelve a intentar.',
                btn1:     true,
                btn1Text: 'Entendido'
            });
            return;
        }

        this.delPay = null;
        this.closeQuiet('modalOrderPay', this.modal.close);
        this.afterChange();
        this.open(id, fromDetail, { tab: 'history', deliver: deliver });

        alert({ icon: 'success', title: data.message, timer: 1800 });
    }

    // -- Quitar un pago (desde el detalle) --

    removePayment(orderId, paymentId) {
        $('#modalOrderDetails .cs-modal-x').trigger('click');

        const d        = typeof orderDetail !== 'undefined' ? orderDetail.last : null;
        const same     = !!(d && d.order && Number(d.order.id) === Number(orderId));
        const p        = same ? (d.payments || []).find((x) => Number(x.id) === Number(paymentId)) : null;
        const settled  = same && Number(d.order.total) > 0 && ordRound(Number(d.order.total) - Number(d.order.paid)) <= 0.005;
        const key      = settled && this.keyOnSettled();
        const back     = () => orderDetail.show(orderId);
        const subtitle = `${this.noun()} #${this.prefix()}${(same && d.order.folio) || orderId}${p ? ' · ' + p.method + ' ' + money(p.amount) : ''}`;
        const json     = [];

        if (key) json.push({ id: 'pd_key', lbl: 'Contraseña', class: 'w-full' });

        json.push({ id: 'pd_reason', lbl: 'Motivo', tipo: 'textarea', required: true, maxlength: 200, rows: 3, ph: 'Ej. Se registró dos veces', class: 'w-full' });

        this.csModal({
            id:         'modalOrderPayDelete',
            title:      'Quitar pago',
            subtitle:   subtitle,
            lucideIcon: 'trash-2',
            width:      'max-w-lg',
            saveText:   'Quitar pago',
            cancelText: 'Volver',
            info:       'El pago queda en la bitácora como quitado.',
            json:       json,
            onSave:     (values, close) => this.saveRemove(orderId, paymentId, values, close, back)
        });

        if (key) $('#pd_key').attr('type', 'password').attr('autocomplete', 'off');

        this.onDismiss('modalOrderPayDelete', back);

        $(key ? '#pd_key' : '#pd_reason').trigger('focus');
    }

    async saveRemove(orderId, paymentId, values, close, back) {
        if (this.saving) return;

        const reason = String(values.pd_reason || '').trim();

        if (!reason) return this.warn('Escribe por qué se quita el pago.');

        this.saving = true;

        const button = $('#modalOrderPayDelete .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({
            url:  this._link,
            data: { opc: 'deletePayment', id: orderId, payment_id: paymentId, reason: reason, key: String($('#pd_key').val() || '') }
        });

        this.saving = false;
        button.prop('disabled', false);

        // El pedido quedó liquidado después de abrir el detalle: el ctrl pide la contraseña.
        if (data && data.key) {
            if (!$('#pd_key').length) {
                $('#pd_reason').closest('div').before(
                    '<div class="w-full px-2 mt-[12px]"><label for="pd_key" class="block text-xs font-semibold text-gray-500 mb-1.5">Contraseña</label><input id="pd_key" type="password" autocomplete="off" class="w-full text-sm text-gray-800 bg-[#fff] border-[1px] border-gray-300 rounded-lg px-[12px] py-2 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"><p id="pd_key_msg" class="text-xs text-rose-600 mt-1 mb-0"></p></div>'
                );
            }

            $('#pd_key_msg').text(data.message || '');
            $('#pd_key').trigger('focus');
            return;
        }

        if (!data || data.status != 200) {
            alert({
                icon:     data && data.status == 409 ? 'warning' : 'error',
                title:    'No se quitó el pago',
                text:     (data && data.message) || 'Revisa la conexión y vuelve a intentar.',
                btn1:     true,
                btn1Text: 'Entendido'
            });
            return;
        }

        this.closeQuiet('modalOrderPayDelete', close);
        this.afterChange();

        (back || (() => orderDetail.show(orderId)))();

        alert({ icon: 'success', title: data.message, timer: 1800 });
    }

    // -- Eventos --

    bind() {
        const modal = $('#modalOrderPay');

        // :disabled también cubre los botones dentro de un fieldset apagado.
        modal.on('click', '#paWin [data-act]', (e) => {
            const el = e.currentTarget;

            if (!el.matches(':disabled')) this.act(el.dataset.act, el);
        });

        // El teclado no le quita el foco al campo.
        modal.on('mousedown', 'button.pa-key', (e) => e.preventDefault());

        modal.on('input', '#paWin input, #paWin textarea', (e) => {
            const el = e.target;

            if (el.id === 'paDelReason' || el.id === 'paDelKey') {
                $(el.id === 'paDelKey' ? '#paDelKeyMsg' : '#paDelMsg').prop('hidden', true);
                el.classList.remove('is-bad');
                return;
            }

            if (el.id === 'paNote' || !el.closest('#paPayForm')) return;

            if (el.dataset.field) {
                this.clean(el);
                this.typed(el);
            } else {
                this.paintCalc();
            }
        });

        modal.on('change', '#paReason', () => this.paintCalc());

        modal.on('change', '#paCobro', (e) => this.pickBranch(Number(e.target.value)));

        modal.on('focusin', '#paPayForm input[data-field]', (e) => {
            this.active = String(e.currentTarget.dataset.field);
            this.fresh  = true;
            this.paintActive();
        });
    }

    act(name, el) {
        const value = el.dataset.value;

        switch (name) {
            case 'close':
                if (!this.busy) $('#modalOrderPay .cs-modal-x').trigger('click');
                break;

            case 'view':
                if (this.view === value) return;
                this.view = value === 'history' ? 'history' : 'pay';
                this.resetForm();
                this.render();
                break;

            case 'rest':        this.takeRest(Number(el.dataset.id)); break;
            case 'key':         this.press(el.dataset.key); break;
            case 'disc':        this.toggleDisc(); break;
            case 'save':        this.save(); break;
            case 'confirm-no':  this.closeConfirm(); break;
            case 'confirm-yes': this.commit(); break;
            case 'del':         this.openDel(el.dataset.id); break;
            case 'del-no':      this.closeDel(); break;
            case 'del-yes':     this.removePay(); break;
            case 'cobro-here':  this.pickBranch(this.sessionBranch().id); break;

            case 'mode':
                this.discMode = value === 'amount' ? 'amount' : 'percent';
                this.paintCalc();
                break;

            case 'go':
                if (this.lockState() === 'block' && this.blockView().go === 'Editar pedido') this.goEdit();
                else this.goTurn();
                break;
        }
    }

    /*  En captura (antes que csModal): con la confirmación o el quitar pago
        abiertos, Esc y Enter son de ellos y no llegan al Escape de csModal. Un
        Esc libre sí le llega y cierra la ventana. Con un aviso (Swal) encima,
        Esc cierra solo el aviso. */
    bindKeys() {
        this.unbindKeys();

        this.keyHandler = (e) => {
            if (!document.getElementById('paWin')) return this.unbindKeys();

            const stop = () => {
                e.stopPropagation();
                e.preventDefault();
            };

            if (window.Swal && Swal.isVisible()) {
                if (e.key === 'Escape') {
                    stop();
                    Swal.close();
                }
                return;
            }

            if (this.busy) {
                if (['Escape', 'Enter', 'F2'].includes(e.key)) stop();
                return;
            }

            // Quitar un pago: Esc cancela; Enter quita (Shift+Enter hace otra línea en el motivo).
            if (this.delPay) {
                if (e.key === 'Escape') {
                    stop();
                    this.closeDel();
                } else if (e.key === 'Enter' && !e.shiftKey) {
                    stop();
                    this.removePay();
                }
                return;
            }

            // Con la confirmación abierta solo cuentan Esc (cancelar) y Enter / F2 (registrar).
            if (this.confirmCalc) {
                if (e.key === 'Escape') {
                    stop();
                    this.closeConfirm();
                } else if (e.key === 'Enter' || e.key === 'F2') {
                    stop();
                    this.commit();
                }
                return;
            }

            if (e.key === 'F2') {
                stop();
                this.save();
            } else if (e.key === 'F4') {
                stop();
                this.toggleDisc();
            } else if (e.key === 'Enter' && e.target && e.target.matches && e.target.matches('#paPayForm input')) {
                stop();
                this.save();
            }
        };

        document.addEventListener('keydown', this.keyHandler, true);
    }

    unbindKeys() {
        if (!this.keyHandler) return;

        document.removeEventListener('keydown', this.keyHandler, true);
        this.keyHandler = null;
    }

    // La página se recarga al cambiar de sucursal; si la ventana sigue abierta, se cierra sin volver al detalle.
    onBranchChange() {
        if (this.isOpen && this.modal && $('#paWin').length) this.closeQuiet('modalOrderPay', this.modal.close);
    }

    // -- Complements --

    methodOf(id) {
        return this.payMethods().find((m) => m.id === Number(id)) || null;
    }

    methodIcon(m) {
        if (!m) return 'wallet';
        if (m.cash) return 'banknote';

        const name = `${m.code || ''} ${m.name || ''}`.toLowerCase();

        if (/tarj|card|cr[eé]d|d[eé]b/.test(name)) return 'credit-card';
        if (/transf|spei/.test(name))             return 'arrow-left-right';

        return 'wallet';
    }

    methodHint(m) {
        const hints = { 'banknote': 'Pago en efectivo', 'credit-card': 'Débito o crédito', 'arrow-left-right': 'Depósito o SPEI' };

        return hints[this.methodIcon(m)] || 'Otro método';
    }

    methodColor(icon) {
        const colors = { 'banknote': '#16A34A', 'credit-card': '#2563EB', 'arrow-left-right': '#7C3AED', 'wallet': '#0891B2' };

        return colors[icon] || colors.wallet;
    }

    // ordAmount es estricto: aquí también pasan «5.», «.5», «$1,200».
    num(raw) {
        let s = String(raw == null ? '' : raw).replace(/[$,\s]/g, '');

        if (/^\d+\.$/.test(s)) s = s.slice(0, -1);
        if (/^\.\d+$/.test(s)) s = '0' + s;

        return ordAmount(s);
    }

    dateOf(v) {
        const s = String(v || '');

        return !s || /^0000/.test(s) ? '' : ordDate(s);
    }

    ico(name) {
        return `<i data-lucide="${name}"></i>`;
    }

    icons() {
        if (window.lucide) lucide.createIcons();
    }

    /*  csModal no avisa cuando lo cierran a mano (X, Volver, fondo o Escape).
        Su Escape se enlazó antes que este, así que al llegar aquí el modal ya
        no está en el DOM si se cerró. */
    onDismiss(id, fn) {
        const ns   = `keydown.${id}`;
        const done = () => {
            $(document).off(ns);
            fn();
        };

        $(`#${id}`).on('click', '.cs-modal-x, .cs-modal-cancel, .cs-modal-bg', done);

        $(document).off(ns).on(ns, (e) => {
            if (e.key === 'Escape' && !$(`#${id}`).length) done();
        });
    }

    // Cierra sin el «volver» de onDismiss. Otras ventanas (entregar, cancelar venta…) también la usan.
    closeQuiet(id, close) {
        if (id === 'modalOrderPay') {
            this.isOpen = false;
            this.unbindKeys();
            $('#modalOrderPay').removeClass('is-busy');
        }

        $(document).off(`keydown.${id}`);
        close();
    }

    warn(text) {
        alert({ icon: 'warning', title: 'Revisa el cobro', text: text, btn1: true, btn1Text: 'Entendido' });
    }
}
