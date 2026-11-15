/*  Pedidos › gestión de pagos: cobrar, ver los pagos y quitar uno (Etapa 3).

    Entra desde la tabla (los importes Total, Abono y Saldo, y el menú
    «Cobrar» o «Pagos»), desde el detalle, el calendario y Clientes. Si vino
    del detalle, al terminar o al cerrar vuelve a abrirlo.

    La ventana abre siempre. Sin saldo, sin turno o sin permiso queda en
    consulta: dice por qué y, si se puede resolver (abrir el turno, ver el
    cierre del día), trae el botón que lo resuelve. Dos pestañas: «Registrar
    pago» e «Historial de pagos».

    Lo que manda es el ctrl: aquí solo se arma el cobro y se avisa antes de
    mandar. Un cobro admite varios métodos: hay una fila por forma de pago y
    en cada una se escribe cuánto se paga con ella. Una de las filas «cubre
    lo que falta»: se ajusta sola con lo que se escribe en las demás (100 en
    MercadoPago, lo demás en efectivo). En efectivo se anota lo recibido para
    calcular el cambio. El descuento es uno por pedido y va con motivo. */

// -- Cobro --

class OrderPay extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'OrderPay';
        this.loading      = false;
        this.saving       = false;
        this.token        = '';
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
        const o = data.order;

        this.o = {
            id:              Number(o.id),
            folio:           o.folio,
            customer:        o.customer,
            subtotal:        Number(o.subtotal),
            discount_amount: Number(o.discount_amount),
            discount_reason: o.discount_reason,
            total:           Number(o.total),
            paid:            Number(o.paid),
            cancelled:       !!o.cancelled,
            delivered:       !!o.delivered
        };

        this.methods      = (data.methods || []).map((m) => ({ id: Number(m.id), name: m.name, code: m.code, cash: Number(m.is_cash) === 1 }));
        this.payments     = data.payments || [];
        this.canDelete    = !!data.can_delete;
        this.canPay       = !!data.can_pay;
        this.payBlock     = data.pay_block || null;
        this.reasons      = data.reasons || [];
        this.canAuthorize = !!data.can_authorize;
        this.discBlock    = data.disc_block || '';
        this.fromDetail   = fromDetail;
        this.token        = ordToken();
        this.discOpen     = false;
        this.discMode     = 'percent';

        if (this.canPay && !this.methods.length) {
            this.canPay   = false;
            this.payBlock = { kind: 'methods', title: 'Sin métodos de pago', message: 'La empresa no tiene métodos de pago activos.', day: false };
        }

        /*  cash = el método en efectivo: lleva lo recibido y el cambio.
            auto = la fila que cubre lo que falta del saldo. Arranca en efectivo
            (o en el primer método) con todo el saldo; se apaga al escribir en ella. */
        this.cash = this.methods.find((m) => m.cash) || null;
        this.auto = this.methods.length ? (this.cash || this.methods[0]).id : 0;

        // Sin pestaña pedida: cobrar si se puede o si falta el turno; si no, los pagos que ya hay.
        const kind = this.payBlock ? this.payBlock.kind : '';

        this.tab = ['pay', 'history'].includes(opts.tab)
            ? opts.tab
            : (this.canPay || kind === 'turn' || !this.payments.length ? 'pay' : 'history');

        this.modal = this.csModal({
            id:         'modalOrderPay',
            title:      'Gestión de pagos',
            subtitle:   `Pedido #P${this.o.folio} · ${this.o.customer || 'Sin cliente'}`,
            lucideIcon: 'wallet',
            width:      'max-w-2xl',
            saveText:   this.canPay ? (this.thenDeliver ? 'Cobrar y entregar' : 'Registrar pago') : false,
            cancelText: fromDetail ? 'Volver' : 'Cerrar',
            json:       this.fields(),
            onSave:     (values, close) => this.save(close)
        });

        if (this.canPay) this.dress();

        // Primero pintar y luego la pestaña: el foco cae en el monto ya escrito y lo deja seleccionado.
        this.bind();
        this.paint();
        this.setTab(this.tab);
        this.onDismiss('modalOrderPay', () => this.back());
    }

    back() {
        if (this.fromDetail) orderDetail.show(this.o.id);
    }

    // -- Campos --

    fields() {
        // Un <label> con la misma clase que csModal: compact.css le da el mismo
        // tamaño y margen que a «Recibe en efectivo», y los billetes quedan a la par del input.
        const label   = (text) => `<label class="block text-xs font-semibold text-gray-500 mb-1.5">${text}</label>`;
        const pane    = (list) => list.map((f) => Object.assign({}, f, { class: `${f.class || 'w-full sm:w-1/2'} op-pane-pay` }));
        const history = { id: 'op_history', tipo: 'html', class: 'w-full op-pane-history', html: this.historyHtml() };
        const top     = [
            { id: 'op_head', tipo: 'html', class: 'w-full', html: this.head() },
            { id: 'op_tabs', tipo: 'html', class: 'w-full', html: this.tabs() }
        ];

        if (!this.canPay) {
            return top.concat([{ id: 'op_block', tipo: 'html', class: 'w-full op-pane-pay', html: this.blockHtml() }, history]);
        }

        const form = pane([
            { id: 'op_methods', tipo: 'html', class: 'w-full', html: this.methodsHead() },
            ...this.methodFields(label),
            { id: 'op_note', lbl: 'Observación (opcional)', tipo: 'text', maxlength: 200, ph: 'Ej. Referencia de la transferencia', class: 'w-full' },
            ...this.discountFields(),
            { id: 'op_totals', tipo: 'html', class: 'w-full', html: '<div id="op_sum"></div>' }
        ]);

        return top.concat(form, [history]);
    }

    // -- Formas de pago --

    methodsHead() {
        const text = this.methods.length > 1
            ? 'Escribe cuánto paga con cada una. Toca el nombre de una forma para cobrar con ella lo que falta.'
            : 'Escribe cuánto paga.';

        return `
            <div class="ord-pay-forms">
                <p class="ord-pay-forms-title">Formas de pago</p>
                <p class="ord-pay-forms-text">${text}</p>
            </div>`;
    }

    /*  Una fila por forma de pago: un campo number de csModal con el nombre
        del método de etiqueta. order.css lo acomoda como fila (nombre a la
        izquierda, monto a la derecha). Debajo de la de efectivo va lo que
        entrega el cliente, para el cambio. */
    methodFields(label) {
        const list = [];

        this.methods.forEach((m) => {
            list.push({ id: `op_amt_${m.id}`, lbl: m.name, tipo: 'number', min: 0, step: '0.01', ph: '0.00', icon: 'dollar-sign', help: this.methodHint(m), class: 'w-full op-row' });

            if (!this.cash || m.id !== this.cash.id) return;

            list.push({ id: 'op_received', lbl: 'Recibe en efectivo', tipo: 'number', min: 0, step: '0.01', class: 'w-full sm:w-2/5 op-cash' });
            list.push({ id: 'op_bills', tipo: 'html', class: 'w-full sm:w-3/5 op-cash', html: label('Billetes') + '<div id="op_bill_chips" class="flex flex-wrap gap-[8px]"></div>' });
        });

        return list;
    }

    // Viste cada fila ya pintada: el ícono del método delante del nombre. El campo sigue siendo el de csModal.
    dress() {
        this.methods.forEach((m) => {
            const row = $(`#op_amt_${m.id}`).closest('.op-row');

            row.attr('data-id', m.id).prepend(`<span class="ord-method-ico"><i data-lucide="${this.methodIcon(m)}" class="w-5 h-5"></i></span>`);
            row.children('label').attr('title', `Cobrar lo que falta con ${m.name}`);
        });
    }

    // El método que se toca cubre lo que falta; el que lo cubría se vacía.
    takeRest(id) {
        if (this.auto && this.auto !== id) $(`#op_amt_${this.auto}`).val('');

        this.auto = id;
        this.paint();
        this.focusRow(id);
    }

    // Foco en el monto de una fila, con lo escrito seleccionado: teclear lo reemplaza.
    focusRow(id) {
        const input = document.getElementById(`op_amt_${id}`);

        if (!input) return;

        input.focus();
        input.select();
    }

    // Tres mosaicos (Total, Pagado, Restante) y la barra de avance. Los llena paintHead.
    head() {
        const tile = (id, tone, label) => `
            <div id="${id}" class="ord-pay-tile ${tone}">
                <p class="ord-pay-tile-lbl" id="${id}_lbl">${label}</p>
                <p class="ord-pay-tile-val" id="${id}_val"></p>
                <p class="ord-pay-tile-sub" id="${id}_sub"></p>
            </div>`;

        return `
            <div class="grid grid-cols-3 gap-[8px]">
                ${tile('op_t_total', '', 'Total')}
                ${tile('op_t_paid', 'is-paid', 'Pagado')}
                ${tile('op_t_rest', 'is-due', 'Restante')}
            </div>
            <div class="ord-pay-bar"><span id="op_bar"></span></div>`;
    }

    // total = el del pedido con el descuento que se está capturando.
    paintHead(total) {
        const o       = this.o;
        const cut     = ordRound(o.discount_amount + (o.total - total));
        const gross   = o.discount_amount > 0 ? o.subtotal : o.total;
        const balance = ordRound(total - o.paid);
        const n       = this.payments.length;
        const pct     = total > 0
            ? (o.paid + 0.005 >= total ? 100 : Math.max(0, Math.floor(o.paid / total * 100)))
            : (o.paid > 0 ? 100 : 0);

        const set = (id, tone, label, value, sub) => {
            $(`#${id}`).attr('class', `ord-pay-tile ${tone}`.trim());
            $(`#${id}_lbl`).text(label);
            $(`#${id}_val`).text(value);
            $(`#${id}_sub`).html(sub);
        };

        set('op_t_total', '', 'Total', money(total), cut > 0.005 ? `<s>${money(gross)}</s> · descuento ${money(cut)}` : 'Sin descuento');
        set('op_t_paid', o.paid > 0 ? 'is-paid' : 'is-muted', 'Pagado', money(o.paid), n ? `${n} ${n === 1 ? 'pago' : 'pagos'} · ${pct} %` : 'Sin pagos');

        let rest = ['is-due', 'Restante', money(balance), 'Por cobrar'];

        if (o.cancelled)                  rest = ['is-muted', 'Cancelado', '-', 'No se cobra'];
        else if (Math.abs(total) < 0.005) rest = ['is-muted', 'Restante', '-', 'Sin importe'];
        else if (balance < -0.005)        rest = ['is-credit', 'A favor', money(Math.abs(balance)), 'Pagó de más'];
        else if (balance <= 0.005)        rest = ['is-done', 'Restante', money(0), 'Pedido liquidado'];

        set('op_t_rest', ...rest);

        $('#op_bar').css('width', `${pct}%`);
    }

    tabs() {
        const icon = this.canPay ? 'banknote' : this.blockView().icon;

        return `
            <div class="ord-pay-tabs" role="tablist">
                <button type="button" class="ord-pay-tab" data-tab="pay" role="tab" aria-selected="false">
                    <i data-lucide="${icon}" class="w-4 h-4"></i><span>Registrar pago</span>
                </button>
                <button type="button" class="ord-pay-tab" data-tab="history" role="tab" aria-selected="false">
                    <i data-lucide="history" class="w-4 h-4"></i><span>Historial de pagos</span><span class="ord-pay-count">${this.payments.length}</span>
                </button>
            </div>`;
    }

    setTab(tab) {
        this.tab = tab === 'history' ? 'history' : 'pay';

        const modal = $('#modalOrderPay');

        modal.toggleClass('is-history', this.tab === 'history');

        modal.find('button.ord-pay-tab').each((i, el) => {
            const on = $(el).data('tab') === this.tab;

            $(el).toggleClass('is-active', on).attr('aria-selected', on ? 'true' : 'false');
        });

        if (this.tab === 'pay' && this.canPay) this.focusRow(this.auto || this.methods[0].id);
    }

    // -- Sin cobro: por qué --

    // El aviso de la pestaña «Registrar pago» cuando no se puede cobrar. go = el botón que lo resuelve.
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

    blockHtml() {
        const v     = this.blockView();
        const icons = { 'Abrir turno': 'lock-open', 'Ver turno': 'clock', 'Ver cierre del día': 'calendar-days', 'Editar pedido': 'pencil' };
        const go    = v.go
            ? `<button type="button" class="ord-pay-go"><i data-lucide="${icons[v.go] || 'lock-open'}" class="w-4 h-4"></i>${esc(v.go)}</button>`
            : '';

        return `
            <div class="ord-pay-state ${v.tone}">
                <span class="ord-pay-state-ico"><i data-lucide="${v.icon}" class="w-5 h-5"></i></span>
                <div class="min-w-0">
                    <p class="ord-pay-state-title">${esc(v.title)}</p>
                    <p class="ord-pay-state-text">${esc(v.text)}</p>
                    ${go}
                </div>
            </div>`;
    }

    // Abre el turno (o el cierre del día) y, con el turno abierto, regresa a este cobro.
    goTurn() {
        const id         = this.o.id;
        const fromDetail = this.fromDetail;
        const deliver    = this.thenDeliver;
        const day        = !!(this.payBlock && this.payBlock.day);

        const next = () => this.open(id, fromDetail, { deliver: deliver });

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

        if (!list.length) {
            return `
                <div class="ord-pay-empty">
                    <i data-lucide="inbox" class="w-8 h-8"></i>
                    <p class="ord-pay-empty-title">Aún no se ha realizado ningún abono</p>
                    <p class="ord-pay-empty-text">Los pagos registrados aparecerán aquí.</p>
                </div>`;
        }

        const sum = ordRound(list.reduce((s, p) => s + Number(p.amount), 0));

        return `
            <div class="ord-pay-list">${list.map((p) => this.historyRow(p)).join('')}</div>
            <div class="ord-pay-total">
                <span>Total pagado · ${list.length} ${list.length === 1 ? 'pago' : 'pagos'}</span>
                <b>${money(sum)}</b>
            </div>`;
    }

    // Un pago: método, concepto, cuándo, quién cobró y el cambio. La papelera solo con el turno abierto.
    historyRow(p) {
        const icon   = this.methodIcon({ code: p.method_code, name: p.method, cash: Number(p.is_cash) === 1 });
        const who    = p.received_by ? `<span>Cobró ${esc(p.received_by)}</span>` : '';
        const change = Number(p.change_amount) > 0.005
            ? `<span>Recibió ${money(p.tendered_amount)} · cambio ${money(p.change_amount)}</span>`
            : '';

        let action = '';

        if (this.canDelete && p.turn_status !== 'closed') {
            action = `<button type="button" class="ord-pay-del" data-payment="${Number(p.id)}" aria-label="Quitar este pago"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`;
        } else if (this.canDelete) {
            action = `<span class="ord-pay-lock" title="El turno ${esc(p.turn_folio || '')} ya cerró: reábrelo para quitar este pago."><i data-lucide="lock" class="w-3.5 h-3.5"></i>Turno cerrado</span>`;
        }

        return `
            <div class="ord-pay-row">
                <span class="ord-pay-row-ico"><i data-lucide="${icon}" class="w-4 h-4"></i></span>
                <div class="min-w-0 flex-1">
                    <p class="ord-pay-row-title">${esc(p.method || 'Pago')}<span>${esc(p.description || '')}</span></p>
                    <p class="ord-pay-row-meta"><span>${ordDate(p.paid_at, true)}</span>${who}${change}</p>
                </div>
                <b class="ord-pay-row-amount">${money(p.amount)}</b>
                ${action}
            </div>`;
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

    // -- Eventos --

    bind() {
        const modal = $('#modalOrderPay');

        modal.on('click', 'button.ord-pay-tab', (e) => this.setTab(String($(e.currentTarget).data('tab'))));

        modal.on('click', 'button.ord-pay-del', (e) => this.removePayment(this.o.id, Number($(e.currentTarget).data('payment')), true));

        modal.on('click', 'button.ord-pay-go', () => this.blockView().go === 'Editar pedido' ? this.goEdit() : this.goTurn());

        // Escribir en la fila que cubría lo que falta la deja con lo escrito.
        modal.on('input', '.op-row input', (e) => {
            if (Number($(e.currentTarget).closest('.op-row').data('id')) === this.auto) this.auto = 0;

            this.paint();
        });

        // Tocar el nombre o el ícono: esa forma de pago cubre lo que falta.
        modal.on('click', '.op-row > label, .op-row > .ord-method-ico', (e) => {
            e.preventDefault();
            this.takeRest(Number($(e.currentTarget).closest('.op-row').data('id')));
        });

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

    // -- Calculo --

    calc() {
        const o       = this.o;
        const d       = this.discountCalc();
        const total   = ordRound(o.total - d.amount);
        const balance = Math.max(0, ordRound(total - o.paid));

        // Lo escrito en cada fila. La que cubre lo que falta no se lee: toma lo que dejan las demás.
        let bad = null;

        const rows = this.methods.map((m) => {
            if (m.id === this.auto) return { m: m, amount: 0 };

            const raw   = String($(`#op_amt_${m.id}`).val() || '').trim();
            const value = raw === '' ? 0 : ordAmount(raw);

            if (value === null && !bad) bad = m;

            return { m: m, amount: value || 0 };
        });

        const fixed = ordRound(rows.reduce((s, r) => s + r.amount, 0));
        const auto  = rows.find((r) => r.m.id === this.auto);

        if (auto) auto.amount = Math.max(0, ordRound(balance - fixed));

        /*  Efectivo: lo escrito en su fila es «hasta cuánto». Se aplica lo que
            cabe en el saldo después de los demás métodos y lo que sobra es
            cambio. «Recibe en efectivo», si se llena, es el billete entregado. */
        const cashRow   = this.cash ? rows.find((r) => r.m.id === this.cash.id) : null;
        const cashTyped = cashRow ? cashRow.amount : 0;
        const others    = ordRound(rows.reduce((s, r) => s + (r === cashRow ? 0 : r.amount), 0));
        const room      = Math.max(0, ordRound(balance - others));
        const cashPaid  = ordRound(Math.min(cashTyped, room));
        const rawRec    = String($('#op_received').val() || '').trim();
        const rec       = rawRec === '' || cashPaid <= 0 ? null : ordAmount(rawRec);
        const badRec    = rawRec !== '' && cashPaid > 0 && rec === null;
        const cashGiven = rec === null ? cashTyped : rec;

        const payments = [];

        rows.forEach((r) => {
            const amount = r === cashRow ? cashPaid : r.amount;

            if (amount <= 0) return;

            payments.push({ method_id: r.m.id, amount: amount, tendered: r === cashRow ? cashGiven : amount });
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

    // -- Pintar --

    paint() {
        if (!this.canPay) {
            this.paintHead(this.o.total);

            if (window.lucide) lucide.createIcons();
            return;
        }

        const c = this.calc();

        this.paintHead(c.total);
        this.paintRows(c);

        // Lo recibido y los billetes acompañan a la fila de efectivo solo cuando lleva monto.
        if (c.cashPaid <= 0 && $('#op_received').val() !== '') $('#op_received').val('');

        $('#modalOrderPay .op-cash').toggleClass('hidden', c.cashPaid <= 0);
        $('#op_received').attr('placeholder', c.cashPaid > 0 ? `Exacto: ${money(c.cashPaid)}` : '0.00');
        $('#op_bill_chips').html(this.bills(c.cashPaid));

        $('#op_sum').html(this.summary(c));

        $('#modalOrderPay .cs-modal-save').text(this.saveLabel(c));

        this.paintDiscount(c);

        if (window.lucide) lucide.createIcons();
    }

    /*  Las filas no se vuelven a pintar (se perdería el foco al teclear): solo
        se les cambia la marca, la pista y, a la que cubre lo que falta, el monto.
        is-on = lleva monto; is-auto = cubre lo que falta. */
    paintRows(c) {
        c.rows.forEach((r) => {
            const input = $(`#op_amt_${r.m.id}`);
            const row   = input.closest('.op-row');
            const auto  = r.m.id === this.auto;

            if (auto) input.val(r.amount > 0 ? r.amount.toFixed(2) : '');

            row.toggleClass('is-on', r.amount > 0).toggleClass('is-auto', auto);
            row.children('p').text(this.rowHint(r, c));
        });
    }

    rowHint(r, c) {
        if (this.cash && r.m.id === this.cash.id && c.cashPaid > 0 && c.cashTyped > c.cashPaid + 0.005) {
            return `Se aplican ${money(c.cashPaid)}; lo demás es cambio`;
        }

        if (r.m.id === this.auto) return 'Cubre lo que falta del saldo';

        return this.methodHint(r.m);
    }

    // El botón dice lo que va a pasar: el monto, solo el descuento o cobrar y entregar.
    saveLabel(c) {
        if (c.bad || c.over > 0.005)                                              return 'Registrar pago';
        if (c.applied <= 0 && c.d.amount > 0)                                     return 'Aplicar descuento';
        if (this.thenDeliver && c.applied > 0 && c.applied + 0.005 >= c.balance)  return 'Cobrar y entregar';

        return c.applied > 0 ? `Registrar pago · ${money(c.applied)}` : 'Registrar pago';
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

    // A la izquierda el desglose (cada método si son varios, lo que abona y lo recibido); a la derecha el aviso.
    summary(c) {
        const row   = (label, value) => `<div class="flex items-center justify-between text-[13px] text-gray-600"><span>${label}</span><span class="font-semibold text-gray-800">${value}</span></div>`;
        const after = Math.max(0, ordRound(c.balance - c.applied));
        const used  = c.payments.map((p) => ({ m: this.methodOf(p.method_id), amount: p.amount })).filter((u) => u.m);
        const names = esc(used.map((u) => u.m.name).join(' + '));
        const cash  = c.cashPaid > 0;

        let state = '';

        if (c.bad) {
            state = `<p class="ord-sum-big text-rose-600">Monto no válido</p><p class="text-[12px] text-rose-600 mb-0">Revisa lo escrito en ${esc(c.bad.name)}.</p>`;
        } else if (c.badRec) {
            state = '<p class="ord-sum-big text-rose-600">Monto recibido no válido</p>';
        } else if (c.over > 0.005) {
            state = `<p class="ord-sum-big text-rose-600">Sobran ${money(c.over)}</p><p class="text-[12px] text-rose-600 mb-0">No se cobra de más: baja algún monto.</p>`;
        } else if (c.applied <= 0 && c.d.amount > 0) {
            state = `<p class="ord-sum-big text-blue-700">Solo descuento</p><p class="text-[12px] text-gray-500 mb-0">El total queda en ${money(c.total)}.</p>`;
        } else if (c.applied <= 0) {
            state = '<p class="text-[12.5px] text-gray-500 mb-0">Escribe cuánto paga el cliente.</p>';
        } else if (c.missing > 0.005) {
            state = `<p class="ord-sum-big text-rose-600">Faltan ${money(c.missing)}</p><p class="text-[12px] text-gray-500 mb-0">El efectivo recibido no alcanza.</p>`;
        } else if (c.change > 0.005) {
            state = `<p class="text-[12px] font-semibold uppercase tracking-wide text-emerald-700 mb-0">Cambio</p><p class="ord-sum-big text-emerald-600">${money(c.change)}</p>`;
        } else if (used.length === 1 && cash) {
            state = '<p class="ord-sum-big text-emerald-600">Exacto, sin cambio</p>';
        } else {
            state = `<p class="text-[12px] font-semibold uppercase tracking-wide text-emerald-700 mb-0">Cobra con ${names}</p><p class="ord-sum-big text-emerald-600">${money(c.applied)}</p>`;
        }

        // Con algo por corregir no se promete «Queda pagado»: se deja el saldo de hoy.
        const stuck = c.bad || c.badRec || c.over > 0.005 || c.missing > 0.005;

        let end = `Saldo después: <b>${money(after)}</b>`;

        if (stuck)                                                  end = `Saldo: <b>${money(c.balance)}</b>`;
        else if (after <= 0.005 && (c.applied > 0 || c.d.amount > 0)) end = '<span class="text-emerald-700 font-semibold">Queda pagado</span>';

        return `
            <div class="ord-sum rounded-xl border-[1px] border-gray-200 bg-gray-50 px-[14px] py-[12px] flex flex-col sm:flex-row gap-[12px] sm:items-center">
                <div class="flex-1 flex flex-col gap-[4px]">
                    ${used.length > 1 ? used.map((u) => row(esc(u.m.name), money(u.amount))).join('') : ''}
                    ${row('Abona', money(c.applied))}
                    ${cash ? row('Efectivo recibido', money(c.cashGiven)) : ''}
                    <div class="text-[12.5px] text-gray-500 mt-1">${end}</div>
                </div>
                <div class="sm:text-right sm:min-w-[200px]">${state}</div>
            </div>`;
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

    // -- Guardar --

    async save(close) {
        if (this.saving) return;

        const c = this.calc();

        if (c.d.error) return this.warn(c.d.error);
        if (c.bad) return this.warn(`El monto de ${c.bad.name} no es válido.`);
        if (c.badRec) return this.warn('El monto recibido en efectivo no es válido.');
        if (c.over > 0.005) return this.warn(`Los pagos pasan del saldo por ${money(c.over)}. El saldo es ${money(c.balance)}: no se cobra de más.`);
        if (c.applied <= 0 && !c.d.amount) return this.warn('Escribe cuánto paga el cliente.');
        if (c.payments.length > 6) return this.warn('Un cobro admite hasta 6 métodos de pago.');
        if (c.missing > 0.005) return this.warn(`Faltan ${money(c.missing)} por recibir en efectivo.`);

        const discount = c.d.amount > 0
            ? JSON.stringify({
                reason_id: c.d.reason.id,
                percent:   this.discMode === 'percent' ? c.d.value : '',
                amount:    this.discMode === 'amount' ? c.d.value : '',
                note:      String($('#op_disc_note').val() || '').trim()
            })
            : '';

        const payload = {
            opc:      'payOrder',
            id:       this.o.id,
            token:    this.token,
            payments: c.payments.length ? JSON.stringify(c.payments) : '',
            discount: discount,
            note:     String($('#op_note').val() || '').trim()
        };

        this.saving = true;

        const button = $('#modalOrderPay .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: payload });

        this.saving = false;
        button.prop('disabled', false);

        if (data && data.status == 423) {
            const id = this.o.id; const fromDetail = this.fromDetail; const deliver = this.thenDeliver;

            this.closeQuiet('modalOrderPay', close);
            orderTurn.locked(data, () => this.open(id, fromDetail, { deliver: deliver }));
            return;
        }

        if (!data || data.status != 200) {
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
        this.closeQuiet('modalOrderPay', close);

        orders.lsOrders();
        orderTurn.touch();

        const print  = orders.can('print');
        const change = Number(data.change) > 0.005
            ? `<p class="text-[12px] font-semibold uppercase tracking-wide mb-0">Cambio</p><p class="text-[32px] font-bold text-emerald-600 leading-tight mb-2">${money(data.change)}</p>`
            : '';
        const owes   = Number(data.balance) > 0.005;
        const left   = owes ? `Saldo pendiente: <b>${money(data.balance)}</b>` : '<b>Pedido pagado.</b>';

        // «Cobrar y entregar» solo entrega si el cobro dejó el saldo en cero.
        const deliver = this.thenDeliver && !owes;
        const pending = this.thenDeliver && owes ? '<p class="text-[12.5px] text-amber-700 mt-1 mb-0">No se entrega todavía: falta cobrar el saldo.</p>' : '';

        const answer = await alert({
            icon:     'success',
            title:    data.message,
            html:     `${change}<p class="text-[14px] mb-0">${left}</p>${pending}`,
            btn1:     print,
            btn1Text: 'Imprimir ticket',
            btn2:     true,
            btn2Text: deliver ? 'Entregar pedido' : 'Listo'
        });

        if (answer && answer.isConfirmed) await orderDetail.print(this.o.id);

        // La entrega pide la contraseña: esa ventana es la confirmación.
        if (deliver) return orderDetail.deliver(this.o.id, { fromDetail: this.fromDetail });

        this.back();
    }

    // -- Quitar un pago --

    // Desde el detalle (papelera del pago) o desde el historial de esta ventana (fromPay).
    removePayment(orderId, paymentId, fromPay) {
        let subtitle = `Pedido #P${orderId}`;
        let back     = () => orderDetail.show(orderId);

        if (fromPay && this.o) {
            const p          = this.payments.find((x) => Number(x.id) === Number(paymentId));
            const fromDetail = this.fromDetail;
            const deliver    = this.thenDeliver;

            subtitle = `Pedido #P${this.o.folio}${p ? ' · ' + p.method + ' ' + money(p.amount) : ''}`;
            back     = () => this.open(orderId, fromDetail, { tab: 'history', deliver: deliver });

            this.closeQuiet('modalOrderPay', this.modal.close);
        } else {
            $('#modalOrderDetails .cs-modal-x').trigger('click');
        }

        this.csModal({
            id:         'modalOrderPayDelete',
            title:      'Quitar pago',
            subtitle:   subtitle,
            lucideIcon: 'trash-2',
            width:      'max-w-lg',
            saveText:   'Quitar pago',
            cancelText: 'Volver',
            info:       'El pago queda en la bitácora como quitado.',
            json: [
                { id: 'pd_reason', lbl: 'Motivo', tipo: 'textarea', required: true, maxlength: 200, rows: 3, ph: 'Ej. Se registró dos veces', class: 'w-full' }
            ],
            onSave: (values, close) => this.saveRemove(orderId, paymentId, values, close, back)
        });

        this.onDismiss('modalOrderPayDelete', back);

        $('#pd_reason').trigger('focus');
    }

    async saveRemove(orderId, paymentId, values, close, back) {
        if (this.saving) return;

        const reason = String(values.pd_reason || '').trim();

        if (!reason) return this.warn('Escribe por qué se quita el pago.');

        this.saving = true;

        const button = $('#modalOrderPayDelete .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: { opc: 'deletePayment', id: orderId, payment_id: paymentId, reason: reason } });

        this.saving = false;
        button.prop('disabled', false);

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

        orders.lsOrders();
        orderTurn.touch();

        (back || (() => orderDetail.show(orderId)))();

        alert({ icon: 'success', title: data.message, timer: 1800 });
    }

    // -- Complements --

    methodOf(id) {
        return this.methods.find((m) => m.id === Number(id)) || null;
    }

    /*  csModal no avisa cuando lo cierran a mano (X, Volver, fondo o Escape).
        Su Escape se enlazo antes que este, asi que al llegar aqui el modal ya
        no esta en el DOM si se cerro. */
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

    closeQuiet(id, close) {
        $(document).off(`keydown.${id}`);
        close();
    }

    warn(text) {
        alert({ icon: 'warning', title: 'Revisa el cobro', text: text, btn1: true, btn1Text: 'Entendido' });
    }
}
