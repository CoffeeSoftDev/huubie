/*  Pedidos › turno de caja: abrir, ver el corte (X mientras sigue abierto,
    Z al cerrar), cerrar contando el efectivo y reabrir con motivo.

    Lo usan pedidos.js (boton del encabezado) y la captura y el cobro cuando el
    ctrl responde 423: sin turno abierto o con uno de otro dia.

    Quien puede que lo decide el ctrl en data.can: abrir y cerrar = create,
    reabrir y recalcular = cancel (Dueño y Supervisor).

    Un turno cerrado muestra su corte. Si sus pedidos cambiaron después,
    t.changed trae las cifras de hoy y el modal ofrece «Recalcular». */

// -- Turno --

class OrderTurn extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'OrderTurn';
        this.loading      = false;
        this.saving       = false;
        this.token        = '';
    }

    // -- Entrada --

    async open(id) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        const data = await this.fetchTurn(id);
        if (!data) return;

        if (!id && !data.brief && data.can.open) return this.openForm(data);

        if (!id && !data.brief && data.can.open_reason) {
            return this.locked({ title: dataInit.day && dataInit.day.closed ? 'Día cerrado' : 'Día pendiente de cierre', message: data.can.open_reason, day: true });
        }

        if (!data.turn) {
            alert({ icon: 'info', title: 'Sin turnos', text: 'Esta sucursal todavía no tiene turnos de caja.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        this.cut(data);
    }

    // 423 del ctrl. Con day = true el bloqueo es el día (cerrado o pendiente), no el turno.
    async locked(data) {
        const title = (data && data.title) || 'Sin turno abierto';
        const old   = /otro d[ií]a/i.test(title);
        const day   = !!(data && data.day);

        const answer = await alert({
            icon:     'warning',
            title:    title,
            text:     (data && data.message) || '',
            btn1:     true,
            btn1Text: day ? 'Ver cierre del día' : old ? 'Ver turno' : 'Abrir turno',
            btn2:     true,
            btn2Text: 'Ahora no'
        });

        if (!answer || !answer.isConfirmed) return;

        $('#modalOrderDetails .cs-modal-x').trigger('click');

        if (day) return orderClosure.open(this.blockedDay());

        this.open();
    }

    // El día que hay que atender: el pendiente más viejo o, si no, hoy.
    blockedDay() {
        const day = dataInit.day || {};

        return day.pending && day.pending.length ? day.pending[0] : '';
    }

    async fetchTurn(id) {
        if (this.loading) return null;

        this.loading = true;

        const data = await useFetch({ url: this._link, data: { opc: 'getTurn', id: id || 0 } });

        this.loading = false;

        if (!data || data.status != 200) {
            alert({ icon: 'error', title: 'No se abrió el turno', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
            return null;
        }

        this.sync(data.brief, false, data.day);

        return data;
    }

    async refresh() {
        const data = await useFetch({ url: this._link, data: { opc: 'getTurn', id: 0 } });

        if (data && data.status == 200) this.sync(data.brief, true, data.day);
    }

    // day llega solo cuando el ctrl lo manda; sin él se conserva el que había.
    sync(brief, reload, day) {
        dataInit.turn = brief || null;

        if (day !== undefined) dataInit.day = day || null;

        if (!orders) return;

        orders.paintTurn();

        if (reload) orders.lsOrders();
    }

    // -- Abrir --

    openForm(data) {
        const last  = data.turn;
        const quick = [500, 1000, 1500, 2000];

        this.token = ordToken();

        const modal = this.csModal({
            id:         'modalOrderTurnOpen',
            title:      'Abrir turno',
            subtitle:   data.branch,
            lucideIcon: 'lock-open',
            width:      'max-w-md',
            saveText:   'Abrir turno',
            cancelText: 'Cancelar',
            info:       last ? `Último: turno ${last.folio}, cerrado ${ordDate(last.closed_at, true)}` : '',
            action:     last ? { text: 'Último corte', lucideIcon: 'receipt', onClick: () => { modal.close(); this.cut(data); } } : null,
            json: [
                {
                    id:    'to_note',
                    tipo:  'html',
                    class: 'w-full',
                    html:  '<p class="text-[13px] text-gray-500 mb-0">Cuenta el efectivo con el que empieza la caja. Si no hay, escribe 0.</p>'
                },
                { id: 'to_cash', lbl: 'Fondo inicial en caja', tipo: 'number', required: true, min: 0, step: '0.01', ph: '0.00', class: 'w-full' },
                {
                    id:    'to_quick',
                    tipo:  'html',
                    class: 'w-full',
                    html:  `<div class="flex flex-wrap gap-[8px]">${quick.map((n) => `<button type="button" class="ord-quick" data-amount="${n}">$${n.toLocaleString('es-MX')}</button>`).join('')}</div>`
                }
            ],
            onSave: (values, close) => this.saveOpen(values, close)
        });

        $('#modalOrderTurnOpen').on('click', 'button.ord-quick', (e) => {
            $('#to_cash').val($(e.currentTarget).data('amount')).trigger('focus');
        });

        this.enterSaves('#modalOrderTurnOpen', '#to_cash');

        $('#to_cash').trigger('focus');
    }

    async saveOpen(values, close) {
        if (this.saving) return;

        const cash = ordAmount(values.to_cash);

        if (cash === null) return this.warn('Escribe el fondo inicial en caja. Si no hay efectivo, escribe 0.');

        const data = await this.send('#modalOrderTurnOpen', { opc: 'openTurn', opening_cash: cash, token: this.token }, 'No se abrió el turno');
        if (!data) return;

        close();

        this.sync(data.brief, true);

        alert({ icon: 'success', title: data.message, timer: 1800 });
    }

    // -- Corte --

    cut(data) {
        const t        = data.turn;
        const closing  = !t.closed && data.can.close;
        const reopen   = t.closed && data.can.reopen;
        const canPrint = orders.can('print');

        let info = '';

        if (!t.closed && t.old) info = 'Turno de otro día: ciérralo para seguir capturando y cobrando.';
        else if (t.closed && !data.can.reopen && orders.can('cancel')) info = data.can.reopen_reason;

        this.token = ordToken();

        const modal = this.csModal({
            id:         'modalOrderTurn',
            title:      `Turno ${t.folio}`,
            subtitle:   `Abierto ${ordDate(t.opened_at, true)}${t.opened_by ? ' por ' + t.opened_by : ''}`,
            lucideIcon: 'calculator',
            width:      'max-w-3xl',
            saveText:   closing ? 'Cerrar turno' : reopen ? 'Reabrir turno' : false,
            cancelText: 'Volver',
            info:       info,
            action:     canPrint ? { text: t.closed ? 'Imprimir corte Z' : 'Imprimir corte X', lucideIcon: 'printer', onClick: () => this.printCut(data) } : null,
            json: [
                ...this.driftField(t, data.can),
                { id: 'tc_kpis', tipo: 'html', class: 'w-full', html: this.kpis(t) },
                { id: 'tc_methods', tipo: 'html', class: 'w-full md:w-1/2', html: this.methodsTable(t) },
                { id: 'tc_statuses', tipo: 'html', class: 'w-full md:w-1/2', html: this.statusesTable(t) },
                ...this.closeFields(t, closing)
            ],
            onSave: (values, close) => closing ? this.saveClose(t, values, close) : this.reopenForm(t, close)
        });

        $('#modalOrderTurn .cs-modal-title').after(this.badges(t));

        $('#modalOrderTurn').on('click', 'button.ord-recalc', () => this.recalc(t, modal));

        if (closing) {
            $('#tc_counted').on('input', () => this.paintDiff(t)).trigger('focus');

            this.enterSaves('#modalOrderTurn', '#tc_counted');
        }

        if (window.lucide) lucide.createIcons();
    }

    badges(t) {
        const chip  = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap';
        const state = t.closed
            ? `<span class="${chip} bg-gray-100 text-gray-600"><i data-lucide="lock" class="w-3 h-3"></i>Cerrado</span>`
            : `<span class="${chip} bg-emerald-50 text-emerald-700"><i data-lucide="lock-open" class="w-3 h-3"></i>Abierto</span>`;

        const old    = !t.closed && t.old ? `<span class="${chip} bg-amber-50 text-amber-700"><i data-lucide="triangle-alert" class="w-3 h-3"></i>De otro día</span>` : '';
        const reopen = t.reopened_at ? `<span class="${chip} bg-[#EAF0FA] text-[#2A55A3]"><i data-lucide="rotate-ccw" class="w-3 h-3"></i>Reabierto</span>` : '';
        const drift  = t.changed ? `<span class="${chip} bg-amber-50 text-amber-700"><i data-lucide="triangle-alert" class="w-3 h-3"></i>Cambió después del corte</span>` : '';

        return `<div class="flex flex-wrap items-center gap-1.5 mt-1">${state}${old}${reopen}${drift}</div>`;
    }

    // Aviso de corte desfasado: qué cifra cambió y, si se puede, el botón para rehacerlo.
    driftField(t, can) {
        const live = t.changed;
        if (!live) return [];

        const line = (label, cut, now) => Math.abs(Number(cut) - Number(now)) < 0.005 ? '' : `<li>${label}: ${money(cut)} en el corte, ${money(now)} hoy.</li>`;
        const cnt  = (o, s) => `${Number(o)} · ${Number(s)}`;

        const counts = Number(t.orders_count) !== Number(live.orders_count) || Number(t.sales_count) !== Number(live.sales_count)
            ? `<li>Pedidos · Mostrador: ${cnt(t.orders_count, t.sales_count)} en el corte, ${cnt(live.orders_count, live.sales_count)} hoy.</li>`
            : '';

        const items = line('Vendido', t.total_sales, live.total_sales) + line('Esperado en caja', t.expected_cash, live.expected_cash) + counts
            || '<li>Cambió el reparto por estado (por ejemplo, un pendiente que ya se pagó).</li>';

        const action = can.recalc
            ? '<button type="button" class="ord-recalc"><i data-lucide="refresh-cw" class="w-[14px] h-[14px]"></i>Recalcular corte</button>'
            : `<p class="text-[12px] mt-2 mb-0">${esc(orders.can('cancel') ? can.recalc_reason : 'Avísale a Dueño o Supervisor para que lo recalcule.')}</p>`;

        return [{
            id:    'tc_drift',
            tipo:  'html',
            class: 'w-full',
            html:  `
                <div class="ord-day-alert rounded-xl border-[1px] border-amber-200 bg-amber-50 px-[14px] py-[10px] text-[13px] text-amber-800">
                    <p class="font-semibold mb-1">Sus pedidos cambiaron después del corte</p>
                    <ul class="mb-0 pl-[18px] list-disc">${items}</ul>
                    <p class="text-[12px] mt-1 mb-0">Abajo ves el corte como se cerró. Lo contado no cambia.</p>
                    ${can.recalc ? `<div class="mt-2">${action}</div>` : action}
                </div>`
        }];
    }

    kpis(t) {
        const tile = (label, value, hint, strong) => `
            <div class="ord-tile rounded-xl border-[1px] border-gray-200 bg-gray-50 px-[14px] py-[10px]">
                <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">${label}</p>
                <p class="text-[18px] font-bold mb-0 ${strong ? 'text-blue-700' : 'text-gray-800'}">${value}</p>
                ${hint ? `<p class="text-[11px] text-gray-400 mt-0.5 mb-0">${hint}</p>` : ''}
            </div>`;

        return `
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-[8px]">
                ${tile('Fondo inicial', money(t.opening_cash))}
                ${tile('Efectivo cobrado', money(t.cash_sales))}
                ${tile('Esperado en caja', money(t.expected_cash), 'Fondo + efectivo', true)}
                ${tile('Cobrado', money(t.collected), 'Todos los métodos')}
                ${tile('Vendido', money(t.total_sales), 'Pendientes y pagados')}
                ${tile('Pedidos · Mostrador', `${Number(t.orders_count)} · ${Number(t.sales_count)}`)}
            </div>`;
    }

    methodsTable(t) {
        const rows = (t.methods || []).map((m) => `
            <tr class="border-t-[1px] border-gray-100">
                <td class="py-1.5">${esc(m.name || 'Sin método')}</td>
                <td class="py-1.5 text-right">${Number(m.payments)}</td>
                <td class="py-1.5 text-right font-semibold">${money(m.amount)}</td>
            </tr>`).join('');

        const foot = rows
            ? `<tr class="border-t-[1px] border-gray-200 font-bold"><td class="py-1.5" colspan="2">Total cobrado</td><td class="py-1.5 text-right">${money(t.collected)}</td></tr>`
            : '';

        return this.miniTable('Cobrado por método', ['Método', 'Pagos', 'Monto'], rows || this.emptyRow('Sin cobros en este turno.'), foot);
    }

    statusesTable(t) {
        const rows = (t.statuses || []).map((s) => `
            <tr class="border-t-[1px] border-gray-100">
                <td class="py-1.5">${esc(s.name || 'Sin estado')}</td>
                <td class="py-1.5 text-right">${s.orders === null ? '—' : Number(s.orders)}</td>
                <td class="py-1.5 text-right font-semibold">${money(s.amount)}</td>
            </tr>`).join('');

        return this.miniTable('Pedidos por estado', ['Estado', 'Pedidos', 'Monto'], rows || this.emptyRow('Sin pedidos en este turno.'), '');
    }

    miniTable(title, heads, body, foot) {
        return `
            <div class="ord-tile rounded-xl border-[1px] border-gray-200 px-[14px] py-[10px] h-full">
                <p class="text-[12px] font-semibold text-gray-700 mb-2">${title}</p>
                <table class="w-full text-[13px]">
                    <thead><tr class="text-[11px] uppercase tracking-wide text-gray-400">${heads.map((h, i) => `<th class="pb-1 font-semibold ${i ? 'text-right' : 'text-left'}">${h}</th>`).join('')}</tr></thead>
                    <tbody>${body}</tbody>
                    ${foot ? `<tfoot>${foot}</tfoot>` : ''}
                </table>
            </div>`;
    }

    emptyRow(text) {
        return `<tr><td colspan="3" class="py-3 text-center text-gray-400">${text}</td></tr>`;
    }

    closeFields(t, closing) {
        const fields = [];

        if (closing) {
            fields.push(
                { id: 'tc_counted', lbl: 'Efectivo contado en caja', tipo: 'number', required: true, min: 0, step: '0.01', ph: '0.00', class: 'w-full sm:w-1/2', help: `Esperado ahora: ${money(t.expected_cash)}` },
                {
                    id:    'tc_diff',
                    tipo:  'html',
                    class: 'w-full sm:w-1/2',
                    html:  `<p class="block text-xs font-semibold text-gray-500 mb-1.5">Diferencia</p><div id="tc_diff_box" class="${this.diffBase()} bg-gray-50 text-gray-400 border-gray-200">Escribe lo contado</div>`
                }
            );
        }

        if (t.closed) fields.push({ id: 'tc_result', tipo: 'html', class: 'w-full', html: this.closedBlock(t) });

        if (t.reopen_reason) {
            const lines = String(t.reopen_reason).split('\n').map((line) => `<li>${esc(line)}</li>`).join('');

            fields.push({
                id:    'tc_reopens',
                tipo:  'html',
                class: 'w-full',
                html:  `<p class="text-xs font-semibold text-gray-500 mb-1">Reaperturas y recálculos</p><ul class="text-[12.5px] text-gray-600 mb-0 pl-[18px] list-disc">${lines}</ul>`
            });
        }

        return fields;
    }

    closedBlock(t) {
        const tone = this.diffTone(Number(t.difference));
        const by   = t.closed_by ? ` por ${esc(t.closed_by)}` : '';

        return `
            <div class="grid grid-cols-3 gap-[8px]">
                <div class="ord-tile rounded-xl border-[1px] border-gray-200 px-[14px] py-[10px]">
                    <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Contado</p>
                    <p class="text-[16px] font-bold text-gray-800 mb-0">${money(t.counted_cash)}</p>
                </div>
                <div class="ord-tile rounded-xl border-[1px] border-gray-200 px-[14px] py-[10px]">
                    <p class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1">Esperado</p>
                    <p class="text-[16px] font-bold text-gray-800 mb-0">${money(t.expected_cash)}</p>
                </div>
                <div class="rounded-xl border-[1px] px-[14px] py-[10px] ${tone.cls}">
                    <p class="text-[11px] font-semibold uppercase tracking-wide mb-1">Diferencia</p>
                    <p class="text-[16px] font-bold mb-0">${tone.text}</p>
                </div>
            </div>
            <p class="text-[12px] text-gray-400 mt-2 mb-0">Cerró${by} el ${ordDate(t.closed_at, true)}.</p>`;
    }

    diffBase() {
        return 'flex items-center h-[38px] px-[12px] rounded-lg border-[1px] text-sm font-semibold';
    }

    diffTone(diff) {
        if (Math.abs(diff) < 0.005) return { text: 'Cuadra', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };

        return diff > 0
            ? { text: `Sobran ${money(diff)}`, cls: 'bg-amber-50 text-amber-700 border-amber-200' }
            : { text: `Faltan ${money(-diff)}`, cls: 'bg-rose-50 text-rose-700 border-rose-200' };
    }

    paintDiff(t) {
        const counted = ordAmount($('#tc_counted').val());
        const box     = $('#tc_diff_box');

        if (counted === null) {
            box.attr('class', `${this.diffBase()} bg-gray-50 text-gray-400 border-gray-200`).text('Escribe lo contado');
            return;
        }

        const tone = this.diffTone(ordRound(counted - Number(t.expected_cash)));

        box.attr('class', `${this.diffBase()} ${tone.cls}`).text(tone.text);
    }

    // -- Cerrar --

    async saveClose(t, values, close) {
        if (this.saving) return;

        const counted = ordAmount(values.tc_counted);

        if (counted === null) return this.warn('Escribe cuánto efectivo contaste en caja. Si no hay, escribe 0.');

        const tone = this.diffTone(ordRound(counted - Number(t.expected_cash)));

        const sure = await alert({
            icon:     'question',
            title:    `¿Cerrar el turno ${t.folio}?`,
            html:     `<p class="text-[14px] leading-6 mb-2">Esperado en caja: <b>${money(t.expected_cash)}</b><br>Contado: <b>${money(counted)}</b><br><b>${tone.text}</b></p>`
                    + '<p class="text-[12px] mb-0">Después del corte ya no se capturan ni se cobran pedidos en este turno.</p>',
            btn1Text: 'Sí, cerrar turno',
            btn2Text: 'Revisar'
        });

        if (!sure || !sure.isConfirmed) return;

        const data = await this.send('#modalOrderTurn', { opc: 'closeTurn', id: t.id, counted_cash: counted, token: this.token }, 'No se cerró el turno');
        if (!data) return;

        close();

        this.sync(data.brief, true);

        const print  = orders.can('print');
        const answer = await alert({
            icon:     'success',
            title:    data.message,
            text:     print ? '¿Imprimes el corte Z?' : '',
            btn1:     print,
            btn1Text: 'Imprimir corte',
            btn2:     true,
            btn2Text: 'Listo'
        });

        if (!answer || !answer.isConfirmed) return;

        const fresh = await this.fetchTurn(t.id);

        if (fresh) this.printCut(fresh);
    }

    // -- Reabrir --

    reopenForm(t, closeCut) {
        closeCut();

        this.csModal({
            id:         'modalOrderTurnReopen',
            title:      `Reabrir turno ${t.folio}`,
            subtitle:   `Cerrado ${ordDate(t.closed_at, true)}${t.closed_by ? ' por ' + t.closed_by : ''}`,
            lucideIcon: 'rotate-ccw',
            width:      'max-w-lg',
            saveText:   'Reabrir turno',
            cancelText: 'Cancelar',
            info:       'El corte Z se rehace cuando lo vuelvas a cerrar.',
            json: [
                { id: 'tr_reason', lbl: 'Motivo de la reapertura', tipo: 'textarea', required: true, maxlength: 200, rows: 3, ph: 'Ej. Faltó registrar un pago en efectivo', class: 'w-full' }
            ],
            onSave: (values, close) => this.saveReopen(t, values, close)
        });

        $('#tr_reason').trigger('focus');
    }

    async saveReopen(t, values, close) {
        if (this.saving) return;

        const reason = String(values.tr_reason || '').trim();

        if (!reason) return this.warn('Escribe por qué se reabre el turno.');

        const data = await this.send('#modalOrderTurnReopen', { opc: 'reopenTurn', id: t.id, reason: reason }, 'No se reabrió el turno');
        if (!data) return;

        close();

        this.sync(data.brief, true);

        alert({ icon: 'success', title: data.message, timer: 1800 });
    }

    // -- Recalcular --

    // Rehace la foto del turno con sus pedidos de hoy. El ctrl vuelve a revisar permiso y día.
    async recalc(t, modal) {
        if (this.saving) return;

        const live = t.changed;
        const sure = await alert({
            icon:     'question',
            title:    `¿Recalcular el turno ${t.folio}?`,
            html:     `<p class="text-[14px] leading-6 mb-2">Vendido: <b>${money(t.total_sales)}</b> » <b>${money(live.total_sales)}</b><br>Esperado en caja: <b>${money(t.expected_cash)}</b> » <b>${money(live.expected_cash)}</b></p>`
                    + '<p class="text-[12px] mb-0">Lo contado no cambia: la diferencia se calcula contra el nuevo esperado. Queda anotado en el turno.</p>',
            btn1Text: 'Sí, recalcular',
            btn2Text: 'Revisar'
        });

        if (!sure || !sure.isConfirmed) return;

        const data = await this.send('#modalOrderTurn', { opc: 'recalcTurn', id: t.id, token: ordToken() }, 'No se recalculó el turno');
        if (!data) return;

        modal.close();

        alert({ icon: 'success', title: data.message, timer: 2200 });

        this.refresh();

        const fresh = await this.fetchTurn(t.id);

        if (fresh) this.cut(fresh);
    }

    // -- Impresion --

    printCut(data) {
        const t     = data.turn;
        const title = t.closed ? 'Corte Z' : 'Corte X';
        const row   = (a, b, strong) => `<tr${strong ? ' class="b"' : ''}><td>${a}</td><td class="r">${b}</td></tr>`;

        const methods = (t.methods || []).length
            ? t.methods.map((m) => row(`${esc(m.name || 'Sin método')} (${Number(m.payments)})`, money(m.amount))).join('') + row('Total cobrado', money(t.collected), true)
            : row('Sin cobros', money(0));

        const statuses = (t.statuses || []).length
            ? t.statuses.map((s) => row(`${esc(s.name || 'Sin estado')}${s.orders === null ? '' : ` (${Number(s.orders)})`}`, money(s.amount))).join('')
            : row('Sin pedidos', '0');

        const closed = t.closed
            ? row('Contado', money(t.counted_cash)) + row('Diferencia', this.diffTone(Number(t.difference)).text, true)
            : '';

        const reopens = t.reopen_reason
            ? `<hr><h2>Reaperturas y recálculos</h2><p class="s">${esc(t.reopen_reason).replace(/\n/g, '<br>')}</p>`
            : '';

        const body = `
            <h1>${title}</h1>
            <p class="c s">${esc(data.branch)} · Turno ${esc(t.folio)}${t.closed ? '' : ' (parcial: sigue abierto)'}</p>
            <p class="c s">Abrió ${esc(t.opened_by || '—')} · ${ordDate(t.opened_at, true)}${t.closed ? `<br>Cerró ${esc(t.closed_by || '—')} · ${ordDate(t.closed_at, true)}` : ''}</p>
            <hr><h2>Caja</h2>
            <table>
                ${row('Fondo inicial', money(t.opening_cash))}
                ${row('Efectivo cobrado', money(t.cash_sales))}
                ${row('Esperado en caja', money(t.expected_cash), true)}
                ${closed}
            </table>
            <hr><h2>Cobrado por método</h2><table>${methods}</table>
            <hr><h2>Pedidos por estado</h2><table>${statuses}</table>
            <hr>
            <table>
                ${row('Vendido', money(t.total_sales), true)}
                ${row('Pedidos', Number(t.orders_count))}
                ${row('Ventas de mostrador', Number(t.sales_count))}
            </table>
            ${reopens}
            <hr><p class="c s">Impreso ${ordNow()}</p>`;

        ordPrint(`${title} turno ${t.folio}`, body);
    }

    // -- Complements --

    async send(modal, payload, title) {
        this.saving = true;

        const button = $(`${modal} .cs-modal-save`).prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: payload });

        this.saving = false;
        button.prop('disabled', false);

        if (data && data.status == 200) return data;

        const conflict = data && data.status == 409;

        alert({ icon: conflict ? 'warning' : 'error', title: title, text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });

        if (conflict) this.refresh();

        return null;
    }

    enterSaves(modal, input) {
        $(input).on('keydown', (e) => {
            if (e.key !== 'Enter') return;

            e.preventDefault();
            $(`${modal} .cs-modal-save`).trigger('click');
        });
    }

    warn(text) {
        alert({ icon: 'warning', title: 'Falta un dato', text: text, btn1: true, btn1Text: 'Entendido' });
    }
}
