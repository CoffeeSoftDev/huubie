/*  Pedidos › cobrar un pedido (Etapa 3) y quitar un pago.

    Entra desde la tabla (menu «Cobrar») o desde el detalle (boton «Cobrar» y
    la papelera de cada pago). Si vino del detalle, al terminar o al cerrar
    vuelve a abrirlo.

    Lo que manda es el ctrl: aqui solo se arma el cobro y se avisa antes de
    mandar. Un cobro admite varios metodos; en efectivo se anota lo recibido
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

    async open(id, fromDetail) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        if (this.loading) return;

        this.loading = true;

        const data = await useFetch({ url: this._link, data: { opc: 'payOptions', id: id } });

        this.loading = false;

        if (!data || data.status != 200) return this.fail(data, 'No se puede cobrar');

        orderTurn.sync(data.turn, false);

        if (!(data.methods || []).length) {
            alert({ icon: 'warning', title: 'Sin métodos de pago', text: 'La empresa no tiene métodos de pago activos.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        if (fromDetail) $('#modalOrderDetails .cs-modal-x').trigger('click');

        this.start(data, !!fromDetail);
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

    start(data, fromDetail) {
        const o = data.order;

        this.o = {
            id:              Number(o.id),
            folio:           o.folio,
            customer:        o.customer,
            subtotal:        Number(o.subtotal),
            discount_amount: Number(o.discount_amount),
            discount_reason: o.discount_reason,
            total:           Number(o.total),
            paid:            Number(o.paid)
        };

        this.methods      = data.methods.map((m) => ({ id: Number(m.id), name: m.name, code: m.code, cash: Number(m.is_cash) === 1 }));
        this.reasons      = data.reasons || [];
        this.canAuthorize = !!data.can_authorize;
        this.discBlock    = data.disc_block || '';
        this.fromDetail   = fromDetail;
        this.token        = ordToken();
        this.mode         = 'all';
        this.lines        = [];
        this.discOpen     = false;
        this.discMode     = 'percent';
        this.method       = (this.methods.find((m) => m.cash) || this.methods[0]).id;

        this.csModal({
            id:         'modalOrderPay',
            title:      `Cobrar pedido #P${this.o.folio}`,
            subtitle:   this.o.customer || 'Sin cliente',
            lucideIcon: 'banknote',
            width:      'max-w-2xl',
            saveText:   'Cobrar',
            cancelText: 'Volver',
            json:       this.fields(),
            onSave:     (values, close) => this.save(close)
        });

        this.bind();
        this.paint();
        this.onDismiss('modalOrderPay', () => this.back());

        $('#op_received').trigger('focus');
    }

    back() {
        if (this.fromDetail) orderDetail.show(this.o.id);
    }

    // -- Campos --

    fields() {
        const label = (text) => `<p class="block text-xs font-semibold text-gray-500 mb-1.5">${text}</p>`;

        return [
            { id: 'op_head', tipo: 'html', class: 'w-full', html: this.head() },
            ...this.discountFields(),
            { id: 'op_target', lbl: 'Monto que abona', tipo: 'number', min: 0, step: '0.01', ph: '0.00', class: 'w-full sm:w-1/2' },
            { id: 'op_goal', tipo: 'html', class: 'w-full sm:w-1/2', html: label('Atajos') + '<div id="op_goal_chips" class="flex flex-wrap gap-[8px]"></div>' },
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
                ${tile('Total', '<span id="op_total"></span>')}
                ${tile('Abonado', money(this.o.paid))}
                ${tile('Saldo', '<span id="op_balance"></span>', true)}
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
            { id: 'op_disc_note', lbl: 'Nota (opcional)', tipo: 'text', maxlength: 255, ph: 'Ej. Cliente frecuente', class: 'w-full op-disc hidden' },
            { id: 'op_disc_hint', tipo: 'html', class: 'w-full op-disc hidden', html: '<div id="op_disc_msg" class="text-[12.5px]"></div>' }
        ];
    }

    // -- Eventos --

    bind() {
        const modal = $('#modalOrderPay');

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
        const c = this.calc();
        const m = c.method;

        if (this.mode !== 'custom') $('#op_target').val(c.target > 0 ? c.target.toFixed(2) : '');

        $('#op_total').html(c.d.amount > 0
            ? `<s class="text-[13px] font-medium text-gray-400 mr-1">${money(this.o.total)}</s>${money(c.total)}`
            : money(c.total));

        $('#op_balance').text(money(c.balance));
        $('#op_goal_chips').html(this.goals(c));
        $('#op_method_chips').html(this.methodChips());

        $('label[for="op_received"]').text(m && m.cash ? 'Recibe en efectivo' : `Monto con ${m ? m.name : ''}`);
        $('#op_received').attr('placeholder', c.remaining > 0 ? `Exacto: ${money(c.remaining)}` : '0.00');

        $('#op_bills').toggleClass('hidden', !(m && m.cash) || c.remaining <= 0);
        $('#op_bill_chips').html(this.bills(c.remaining));

        $('#op_lines').html(this.linesHtml());
        $('#modalOrderPay button.ord-split').toggleClass('hidden', this.methods.length < 2 || this.lines.length >= 5);

        $('#op_sum').html(this.summary(c));

        this.paintDiscount(c);

        if (window.lucide) lucide.createIcons();
    }

    goals(c) {
        const chip = (mode, text, amount) => `<button type="button" class="ord-goal${this.mode === mode ? ' is-active' : ''}" data-mode="${mode}">${text} <b>${money(amount)}</b></button>`;
        const list = [chip('all', 'Liquidar saldo', c.balance)];

        if (this.o.paid <= 0 && c.balance > 0) list.push(chip('half', 'Anticipo 50 %', Math.min(c.balance, ordRound(c.total / 2))));

        return list.join('');
    }

    methodChips() {
        const used = this.lines.map((l) => l.method_id);

        return this.methods.map((m) => `
            <button type="button" class="ord-method${m.id === this.method ? ' is-active' : ''}" data-id="${m.id}">
                <i data-lucide="${this.methodIcon(m)}" class="w-4 h-4"></i>${esc(m.name)}
                ${used.includes(m.id) ? '<i data-lucide="check" class="w-3.5 h-3.5 ord-method-check"></i>' : ''}
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
        } else if (c.applied > 0) {
            state = '<p class="ord-sum-big text-emerald-600">Exacto, sin cambio</p>';
        }

        const end = after <= 0.005 && (c.applied > 0 || c.d.amount > 0)
            ? '<span class="text-emerald-700 font-semibold">Queda pagado</span>'
            : `Saldo después: <b>${money(after)}</b>`;

        return `
            <div class="ord-sum rounded-xl border-[1px] border-gray-200 bg-gray-50 px-[14px] py-[12px] flex flex-col sm:flex-row gap-[12px] sm:items-center">
                <div class="flex-1 flex flex-col gap-[4px]">
                    ${row('Abona', money(c.target))}
                    ${row('Recibido', money(c.tendered))}
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
            discount: discount
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
        const left   = Number(data.balance) > 0.005 ? `Saldo pendiente: <b>${money(data.balance)}</b>` : '<b>Pedido pagado.</b>';

        const answer = await alert({
            icon:     'success',
            title:    data.message,
            html:     `${change}<p class="text-[14px] mb-0">${left}</p>`,
            btn1:     print,
            btn1Text: 'Imprimir ticket',
            btn2:     true,
            btn2Text: 'Listo'
        });

        if (answer && answer.isConfirmed) await orderDetail.print(this.o.id);

        this.back();
    }

    // -- Quitar un pago --

    removePayment(orderId, paymentId) {
        $('#modalOrderDetails .cs-modal-x').trigger('click');

        this.csModal({
            id:         'modalOrderPayDelete',
            title:      'Quitar pago',
            subtitle:   `Pedido #P${orderId}`,
            lucideIcon: 'trash-2',
            width:      'max-w-lg',
            saveText:   'Quitar pago',
            cancelText: 'Volver',
            info:       'El pago queda en la bitácora como quitado.',
            json: [
                { id: 'pd_reason', lbl: 'Motivo', tipo: 'textarea', required: true, maxlength: 200, rows: 3, ph: 'Ej. Se registró dos veces', class: 'w-full' }
            ],
            onSave: (values, close) => this.saveRemove(orderId, paymentId, values, close)
        });

        this.onDismiss('modalOrderPayDelete', () => orderDetail.show(orderId));

        $('#pd_reason').trigger('focus');
    }

    async saveRemove(orderId, paymentId, values, close) {
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
        orderDetail.show(orderId);

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
