/*  Pedidos › gestión de pagos: cobrar, ver los pagos y quitar uno (Etapa 3).

    Entra desde la tabla (los importes Total, Abono y Saldo, y el menú
    «Cobrar» o «Pagos»), desde el detalle, el calendario y Clientes. Si vino
    del detalle, al terminar o al cerrar vuelve a abrirlo.

    La ventana abre siempre. Sin saldo, sin turno o sin permiso queda en
    consulta: dice por qué y, si se puede resolver (abrir el turno, ver el
    cierre del día), trae el botón que lo resuelve. Dos pestañas: «Registrar
    pago» e «Historial de pagos».

    Lo que manda es el ctrl: aquí solo se arma el cobro y se avisa antes de
    mandar. Un cobro admite varios métodos; en efectivo se anota lo recibido
    para calcular el cambio. El descuento es uno por pedido y va con motivo. */

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
        this.mode         = 'all';
        this.lines        = [];
        this.discOpen     = false;
        this.discMode     = 'percent';

        if (this.canPay && !this.methods.length) {
            this.canPay   = false;
            this.payBlock = { kind: 'methods', title: 'Sin métodos de pago', message: 'La empresa no tiene métodos de pago activos.', day: false };
        }

        this.method = this.methods.length ? (this.methods.find((m) => m.cash) || this.methods[0]).id : 0;

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

        this.bind();
        this.setTab(this.tab);
        this.paint();
        this.onDismiss('modalOrderPay', () => this.back());
    }

    back() {
        if (this.fromDetail) orderDetail.show(this.o.id);
    }

    // -- Campos --

    fields() {
        const label   = (text) => `<p class="block text-xs font-semibold text-gray-500 mb-1.5">${text}</p>`;
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
            { id: 'op_methods', tipo: 'html', class: 'w-full', html: label('Método de pago') + '<div id="op_method_chips" class="ord-method-grid"></div>' },
            { id: 'op_target', lbl: 'Monto que abona', tipo: 'number', min: 0, step: '0.01', ph: '0.00', class: 'w-full sm:w-1/2' },
            { id: 'op_goal', tipo: 'html', class: 'w-full sm:w-1/2', html: label('Atajos') + '<div id="op_goal_chips" class="flex flex-wrap gap-[8px]"></div>' },
            { id: 'op_received', lbl: 'Recibe en efectivo', tipo: 'number', min: 0, step: '0.01', class: 'w-full sm:w-1/2' },
            { id: 'op_bills', tipo: 'html', class: 'w-full sm:w-1/2', html: label('Billetes') + '<div id="op_bill_chips" class="flex flex-wrap gap-[8px]"></div>' },
            {
                id:    'op_lines_box',
                tipo:  'html',
                class: 'w-full',
                html:  '<div id="op_lines"></div><button type="button" class="ord-split"><i data-lucide="plus" class="w-4 h-4"></i>Agregar otro método</button>'
            },
            { id: 'op_note', lbl: 'Observación (opcional)', tipo: 'text', maxlength: 200, ph: 'Ej. Referencia de la transferencia', class: 'w-full' },
            ...this.discountFields(),
            { id: 'op_totals', tipo: 'html', class: 'w-full', html: '<div id="op_sum"></div>' }
        ]);

        return top.concat(form, [history]);
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

        if (this.tab === 'pay' && this.canPay) $('#op_received').trigger('focus');
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

        modal.on('click', 'button.ord-goal', (e) => {
            this.mode = String($(e.currentTarget).data('mode'));
            this.paint();
        });

        modal.on('input', '#op_target', () => {
            this.mode = 'custom';
            this.paint();
        });

        modal.on('click', 'button.ord-method', (e) => {
            this.method = Number($(e.currentTarget).data('id'));
            $('#op_received').val('');
            this.paint();
            $('#op_received').trigger('focus');
        });

        modal.on('input', '#op_received', () => this.paint());

        modal.on('click', 'button.ord-bill', (e) => {
            $('#op_received').val(Number($(e.currentTarget).data('amount')).toFixed(2));
            this.paint();
        });

        modal.on('click', 'button.ord-split', () => this.split());

        modal.on('click', 'button.ord-line-del', (e) => {
            this.lines.splice(Number($(e.currentTarget).data('index')), 1);
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

        let target = balance;

        if (this.mode === 'half')   target = Math.min(balance, ordRound(total / 2));
        if (this.mode === 'custom') target = ordAmount($('#op_target').val()) || 0;

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

        return { d, total, balance, target, remaining, method, typed, badTyped, payments, applied, tendered, change, missing };
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
        const m = c.method;

        if (this.mode !== 'custom') $('#op_target').val(c.target > 0 ? c.target.toFixed(2) : '');

        this.paintHead(c.total);

        $('#op_goal_chips').html(this.goals(c));
        $('#op_method_chips').html(this.methodChips());

        $('label[for="op_received"]').text(m && m.cash ? 'Recibe en efectivo' : `Monto con ${m ? m.name : ''}`);
        $('#op_received').attr('placeholder', c.remaining > 0 ? `Exacto: ${money(c.remaining)}` : '0.00');

        $('#op_bills').toggleClass('hidden', !(m && m.cash) || c.remaining <= 0);
        $('#op_bill_chips').html(this.bills(c.remaining));

        $('#op_lines').html(this.linesHtml());
        $('#modalOrderPay button.ord-split').toggleClass('hidden', this.methods.length < 2 || this.lines.length >= 5);

        $('#op_sum').html(this.summary(c));

        $('#modalOrderPay .cs-modal-save').text(this.saveLabel(c));

        this.paintDiscount(c);

        if (window.lucide) lucide.createIcons();
    }

    // El botón dice lo que va a pasar: el monto, solo el descuento o cobrar y entregar.
    saveLabel(c) {
        if (c.target <= 0 && c.d.amount > 0)                     return 'Aplicar descuento';
        if (this.thenDeliver && c.target + 0.005 >= c.balance)   return 'Cobrar y entregar';

        return c.applied > 0 ? `Registrar pago · ${money(c.applied)}` : 'Registrar pago';
    }

    goals(c) {
        const chip = (mode, text, amount) => `<button type="button" class="ord-goal${this.mode === mode ? ' is-active' : ''}" data-mode="${mode}">${text} <b>${money(amount)}</b></button>`;
        const list = [chip('all', 'Liquidar saldo', c.balance)];

        if (this.o.paid <= 0 && c.balance > 0) list.push(chip('half', 'Anticipo 50 %', Math.min(c.balance, ordRound(c.total / 2))));

        return list.join('');
    }

    // Tarjetas de método: ícono, nombre y una pista. La palomita marca los que ya van en el cobro.
    methodChips() {
        const used = this.lines.map((l) => l.method_id);

        return this.methods.map((m) => `
            <button type="button" class="ord-method is-card${m.id === this.method ? ' is-active' : ''}" data-id="${m.id}" aria-pressed="${m.id === this.method}">
                <span class="ord-method-ico"><i data-lucide="${this.methodIcon(m)}" class="w-5 h-5"></i></span>
                <span class="min-w-0"><span class="ord-method-name">${esc(m.name)}</span><span class="ord-method-hint">${this.methodHint(m)}</span></span>
                ${used.includes(m.id) ? '<i data-lucide="check" class="w-4 h-4 ord-method-check"></i>' : ''}
            </button>`).join('');
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

    summary(c) {
        const row   = (label, value) => `<div class="flex items-center justify-between text-[13px] text-gray-600"><span>${label}</span><span class="font-semibold text-gray-800">${value}</span></div>`;
        const after = Math.max(0, ordRound(c.balance - c.applied));
        const name  = c.method ? c.method.name : '';
        const used  = c.payments.map((p) => this.methodOf(p.method_id)).filter(Boolean);
        const cash  = used.some((m) => m.cash);

        let state = '';

        if (c.badTyped) {
            state = '<p class="ord-sum-big text-rose-600">Monto recibido no válido</p>';
        } else if (c.applied > c.target + 0.005) {
            state = `<p class="ord-sum-big text-rose-600">Sobran ${money(c.applied - c.target)}</p><p class="text-[12px] text-rose-600 mb-0">Con ${esc(name)} no se cobra de más: baja el monto.</p>`;
        } else if (c.target <= 0 && c.d.amount > 0) {
            state = `<p class="ord-sum-big text-blue-700">Solo descuento</p><p class="text-[12px] text-gray-500 mb-0">El total queda en ${money(c.total)}.</p>`;
        } else if (c.missing > 0.005) {
            state = `<p class="ord-sum-big text-rose-600">Faltan ${money(c.missing)}</p><p class="text-[12px] text-gray-500 mb-0">Agrega otro método o baja el monto que abona.</p>`;
        } else if (c.change > 0.005) {
            state = `<p class="text-[12px] font-semibold uppercase tracking-wide text-emerald-700 mb-0">Cambio</p><p class="ord-sum-big text-emerald-600">${money(c.change)}</p>`;
        } else if (c.applied > 0 && cash) {
            state = '<p class="ord-sum-big text-emerald-600">Exacto, sin cambio</p>';
        } else if (c.applied > 0) {
            state = `<p class="text-[12px] font-semibold uppercase tracking-wide text-emerald-700 mb-0">Cobra con ${esc(used.map((m) => m.name).join(' + '))}</p><p class="ord-sum-big text-emerald-600">${money(c.applied)}</p>`;
        }

        const end = after <= 0.005 && (c.applied > 0 || c.d.amount > 0)
            ? '<span class="text-emerald-700 font-semibold">Queda pagado</span>'
            : `Saldo después: <b>${money(after)}</b>`;

        return `
            <div class="ord-sum rounded-xl border-[1px] border-gray-200 bg-gray-50 px-[14px] py-[12px] flex flex-col sm:flex-row gap-[12px] sm:items-center">
                <div class="flex-1 flex flex-col gap-[4px]">
                    ${row('Abona', money(c.target))}
                    ${cash ? row('Recibido', money(c.tendered)) : ''}
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

    // -- Varios metodos --

    split() {
        const c = this.calc();
        const m = c.method;

        if (c.badTyped)        return this.warn('El monto recibido no es válido.');
        if (c.typed === null)  return this.warn(`Escribe cuánto se paga con ${m.name} antes de agregar otro método.`);
        if (c.remaining <= 0)  return this.warn('Lo que abona ya está cubierto.');
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

    // -- Guardar --

    async save(close) {
        if (this.saving) return;

        const c         = this.calc();
        const rawTarget = String($('#op_target').val() || '').trim();

        if (c.d.error) return this.warn(c.d.error);
        if (c.badTyped) return this.warn('El monto recibido no es válido.');
        if (this.mode === 'custom' && rawTarget !== '' && ordAmount(rawTarget) === null) return this.warn('El monto que abona no es válido.');
        if (c.target > c.balance + 0.005) return this.warn(`El saldo es ${money(c.balance)}: no se cobra de más.`);
        if (c.target <= 0 && !c.d.amount) return this.warn('Escribe cuánto abona el cliente.');
        if (c.payments.length > 6) return this.warn('Un cobro admite hasta 6 métodos de pago.');
        if (c.missing > 0.005) return this.warn(`Faltan ${money(c.missing)} por recibir. Agrega otro método o baja el monto que abona.`);
        if (c.applied > c.target + 0.005) return this.warn(`Los pagos suman ${money(c.applied)} y abona ${money(c.target)}. Baja el monto con tarjeta o transferencia.`);

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
