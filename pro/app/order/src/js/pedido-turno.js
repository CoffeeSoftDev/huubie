/*  Pedidos › turno de caja: abrir, ver el corte (X mientras sigue abierto,
    Z al cerrar), cerrar contando el efectivo y reabrir con motivo.

    Lo usan pedidos.js (boton del encabezado) y la captura y el cobro cuando el
    ctrl responde 423: sin turno abierto o con uno de otro dia.

    Quien puede que lo decide el ctrl en data.can: abrir y cerrar = create,
    reabrir y recalcular = cancel (Dueño y Supervisor).

    Un turno cerrado muestra su corte. Si sus pedidos cambiaron después,
    t.changed trae las cifras de hoy y el modal ofrece «Recalcular».

    El corte se dibuja como la ventana de Soft Restaurant: franja de datos,
    tres recuadros (forma de pago, caja, ventas), tabla abajo con su total,
    barra de avisos y botones con su tecla (F2 guarda, Esc cierra). Las piezas
    (head, box, line, grid, alertBar, softFoot) las reusa el cierre del día. */

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

        const subtitle = t.closed ? 'Corte Z · el turno ya se cerró'
            : closing ? 'Corte Z · cuenta el efectivo y cierra el turno'
            : 'Corte X · parcial, el turno sigue abierto';

        this.token = ordToken();

        const modal = this.csModal({
            id:         'modalOrderTurn',
            title:      `Turno ${t.folio}`,
            subtitle:   subtitle,
            lucideIcon: 'calculator',
            width:      'max-w-4xl',
            saveText:   closing ? 'Cerrar turno' : reopen ? 'Reabrir turno' : false,
            cancelText: 'Volver',
            json: [
                { id: 'tc_head', tipo: 'html', class: 'w-full', html: this.head(this.turnHead(t, data.branch)) },
                { id: 'tc_boxes', tipo: 'html', class: 'w-full', html: this.cols([this.methodsBox(t.methods, t.collected), this.cashBox(t, closing), this.salesBox(t)]) },
                { id: 'tc_statuses', tipo: 'html', class: 'w-full', html: this.statusGrid(t.statuses, t.total_sales, Number(t.orders_count) + Number(t.sales_count), 'Sin pedidos en este turno.') },
                ...this.turnAlerts(t, data.can),
                ...this.reopens(t)
            ],
            onSave: (values, close) => closing ? this.saveClose(t, close) : this.reopenForm(t, close)
        });

        $('#modalOrderTurn .cs-modal-title').after(this.badges(t));

        this.softFoot('#modalOrderTurn', canPrint ? { text: t.closed ? 'Imprimir corte Z' : 'Imprimir corte X', onClick: () => this.printCut(data) } : null);

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

    // Datos de la franja de arriba: [etiqueta, valor ya escapado].
    turnHead(t, branch) {
        const fields = [
            ['Turno', esc(t.folio)],
            ['Apertura', ordDate(t.opened_at, true)],
            [t.closed ? 'Cierre' : 'Corte al', t.closed ? ordDate(t.closed_at, true) : ordNow()],
            ['Abrió', esc(t.opened_by || '—')]
        ];

        if (t.closed) fields.push(['Cerró', esc(t.closed_by || '—')]);

        fields.push(['Sucursal', esc(branch || '—')]);

        return fields;
    }

    cashBox(t, closing) {
        let rows = this.line('Fondo inicial', money(t.opening_cash))
                 + this.line('+ Cobrado en efectivo', money(t.cash_sales))
                 + this.line('Efectivo esperado', money(t.expected_cash), 'is-total');

        if (closing) {
            rows += '<div class="ord-cut-row is-strong"><label for="tc_counted">Efectivo contado</label>'
                  + '<input type="number" id="tc_counted" class="ord-cut-input" min="0" step="0.01" placeholder="0.00" inputmode="decimal" autocomplete="off"></div>'
                  + '<div class="ord-cut-row"><span>Diferencia</span><b id="tc_diff_box" class="ord-cut-v is-muted">—</b></div>';
        } else if (t.closed) {
            const tone = this.diffTone(Number(t.difference));

            rows += this.line('Efectivo contado', money(t.counted_cash), 'is-strong')
                  + this.line('Diferencia', tone.text, '', `is-${tone.tone}`);
        }

        return this.box('Caja', rows);
    }

    salesBox(t) {
        const count = Number(t.orders_count) + Number(t.sales_count);

        return this.box('Ventas',
            this.line('Pedidos', Number(t.orders_count))
            + this.line('Mostrador', Number(t.sales_count))
            + this.line('Ticket promedio', count ? money(Number(t.total_sales) / count) : '—')
            + this.line('Total vendido', money(t.total_sales), 'is-total')
            + '<p class="ord-cut-hint">Vendido = pedidos pendientes y pagados.</p>');
    }

    // Avisos en la barra de abajo, como el aviso rojo de Soft antes de los botones.
    turnAlerts(t, can) {
        const bars = [];

        if (!t.closed && t.old) bars.push(this.alertBar('Turno de otro día: ciérralo para seguir capturando y cobrando.', 'is-warn'));
        if (t.changed) bars.push(this.driftBar(t, can));
        if (t.closed && !can.reopen && orders.can('cancel') && can.reopen_reason) bars.push(this.alertBar(esc(can.reopen_reason), 'is-info'));

        return bars.length ? [{ id: 'tc_alerts', tipo: 'html', class: 'w-full', html: bars.join('') }] : [];
    }

    // Corte desfasado: qué cifra cambió y, si se puede, el botón para rehacerlo.
    driftBar(t, can) {
        const live = t.changed;
        const line = (label, cut, now) => Math.abs(Number(cut) - Number(now)) < 0.005 ? '' : `<li>${label}: ${money(cut)} en el corte, ${money(now)} hoy.</li>`;
        const cnt  = (o, s) => `${Number(o)} · ${Number(s)}`;

        const counts = Number(t.orders_count) !== Number(live.orders_count) || Number(t.sales_count) !== Number(live.sales_count)
            ? `<li>Pedidos · Mostrador: ${cnt(t.orders_count, t.sales_count)} en el corte, ${cnt(live.orders_count, live.sales_count)} hoy.</li>`
            : '';

        const items = line('Vendido', t.total_sales, live.total_sales) + line('Esperado en caja', t.expected_cash, live.expected_cash) + counts
            || '<li>Cambió el reparto por estado (por ejemplo, un pendiente que ya se pagó).</li>';

        const action = can.recalc
            ? '<div class="mt-2"><button type="button" class="ord-recalc"><i data-lucide="refresh-cw" class="w-[14px] h-[14px]"></i>Recalcular corte</button></div>'
            : `<p class="text-[12px] font-normal mt-2 mb-0">${esc(orders.can('cancel') ? can.recalc_reason : 'Avísale a Dueño o Supervisor para que lo recalcule.')}</p>`;

        return this.alertBar(`
            <p class="mb-1">Sus pedidos cambiaron después del corte</p>
            <ul class="mb-0 pl-[18px] list-disc font-normal">${items}</ul>
            <p class="text-[12px] font-normal mt-1 mb-0">Arriba ves el corte como se cerró. Lo contado no cambia.</p>
            ${action}`, 'is-warn');
    }

    reopens(t) {
        if (!t.reopen_reason) return [];

        const lines = String(t.reopen_reason).split('\n').map((line) => `<li>${esc(line)}</li>`).join('');

        return [{ id: 'tc_reopens', tipo: 'html', class: 'w-full', html: this.note('Reaperturas y recálculos', `<ul>${lines}</ul>`) }];
    }

    // -- Piezas tipo Soft --

    // Franja de datos: etiqueta arriba y el valor en su cajita.
    head(fields) {
        return `<div class="ord-cut-head">${fields.map(([label, value]) => `<div class="ord-cut-field"><span>${label}</span><b>${value}</b></div>`).join('')}</div>`;
    }

    cols(boxes) {
        return `<div class="ord-cut-cols">${boxes.join('')}</div>`;
    }

    box(legend, body) {
        return `<fieldset class="ord-cut-box"><legend>${legend}</legend>${body}</fieldset>`;
    }

    // Renglón del recuadro: texto a la izquierda, cifra en su cajita a la derecha.
    line(label, value, row, val) {
        return `<div class="ord-cut-row${row ? ' ' + row : ''}"><span>${label}</span><b class="ord-cut-v${val ? ' ' + val : ''}">${value}</b></div>`;
    }

    methodsBox(methods, collected) {
        const rows = (methods || []).map((m) => {
            const abono = m.source === 'abono' ? ' <small>· abono</small>' : '';
            const tip   = Number(m.tip) > 0 ? ` <small>· propina ${money(m.tip)}</small>` : '';

            return this.line(`${esc(m.name || 'Sin método')}${abono}${tip} <small>(${Number(m.payments)})</small>`, money(m.amount));
        }).join('');

        return this.box('Cobrado por forma de pago', (rows || this.line('Sin cobros', money(0), 'is-muted')) + this.line('Total cobrado', money(collected), 'is-total'));
    }

    // El % solo aplica a lo vendido (pendiente y pagado); cotización y cancelado van en gris.
    statusGrid(statuses, sold, count, empty) {
        const total = Number(sold);
        const sale  = (s) => [2, 3].includes(Number(s.id));

        const body = (statuses || []).map((s) => `
            <tr${sale(s) ? '' : ' class="is-off"'}>
                <td>${esc(s.name || 'Sin estado')}</td>
                <td class="r">${s.orders === null ? '—' : Number(s.orders)}</td>
                <td class="r">${money(s.amount)}</td>
                <td class="r">${sale(s) && total > 0 ? (Number(s.amount) / total * 100).toFixed(1) + ' %' : '—'}</td>
            </tr>`).join('') || `<tr><td colspan="4" class="ord-cut-empty">${empty}</td></tr>`;

        const foot = `<tr><td>Vendido <small>(pendiente + pagado)</small></td><td class="r">${Number(count)}</td><td class="r">${money(total)}</td><td class="r">${total > 0 ? '100.0 %' : '—'}</td></tr>`;

        return this.grid(['Estado', 'Pedidos', 'Importe', '% de lo vendido'], 'lrrr', body, foot);
    }

    // Tabla de abajo con renglón de total. aligns = una letra por columna: l, r o c.
    grid(heads, aligns, body, foot) {
        const cls = { l: '', r: ' class="r"', c: ' class="c"' };

        return `
            <div class="ord-cut-grid">
                <table>
                    <thead><tr>${heads.map((h, i) => `<th${cls[aligns[i]] || ''}>${h}</th>`).join('')}</tr></thead>
                    <tbody>${body}</tbody>
                    ${foot ? `<tfoot>${foot}</tfoot>` : ''}
                </table>
            </div>`;
    }

    // mod: is-warn (ámbar), is-danger (rojo) o is-info (gris azulado).
    alertBar(html, mod) {
        const icon = mod === 'is-info' ? 'info' : 'triangle-alert';

        return `<div class="ord-cut-alert ${mod}"><i data-lucide="${icon}" class="w-[18px] h-[18px] shrink-0 mt-[1px]"></i><div class="min-w-0">${html}</div></div>`;
    }

    note(title, html) {
        return `<div class="ord-cut-note"><p>${title}</p>${html}</div>`;
    }

    // Pie como Soft: Imprimir junto a los botones y la tecla de cada uno. F2 guarda, Esc ya lo cierra csModal.
    softFoot(id, print) {
        const buttons = $(`${id} .cs-modal-foot > div`).last();

        $(id).addClass('ord-cut');

        if (print) {
            $(`<button type="button" class="ord-cut-print"><i data-lucide="printer" class="w-4 h-4"></i>${esc(print.text)}</button>`)
                .on('click', print.onClick)
                .prependTo(buttons);
        }

        $(`${id} .cs-modal-save`).append('<kbd class="ord-key">F2</kbd>');
        $(`${id} .cs-modal-cancel`).append('<kbd class="ord-key">Esc</kbd>');

        $(document).off('keydown.ordCut').on('keydown.ordCut', (e) => {
            if (!$(id).length) return $(document).off('keydown.ordCut');
            if (e.key !== 'F2' || $('.swal2-container').length) return;

            e.preventDefault();
            $(`${id} .cs-modal-save`).trigger('click');
        });
    }

    diffTone(diff) {
        if (Math.abs(diff) < 0.005) return { text: 'Cuadra', tone: 'ok', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };

        return diff > 0
            ? { text: `Sobran ${money(diff)}`, tone: 'over', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
            : { text: `Faltan ${money(-diff)}`, tone: 'short', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
    }

    paintDiff(t) {
        const counted = ordAmount($('#tc_counted').val());
        const box     = $('#tc_diff_box');

        if (counted === null) {
            box.attr('class', 'ord-cut-v is-muted').text('—');
            return;
        }

        const tone = this.diffTone(ordRound(counted - Number(t.expected_cash)));

        box.attr('class', `ord-cut-v is-${tone.tone}`).text(tone.text);
    }

    // -- Cerrar --

    // Lo contado vive dentro del recuadro «Caja» (bloque html): se lee del campo, no de values.
    async saveClose(t, close) {
        if (this.saving) return;

        const counted = ordAmount($('#tc_counted').val());

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

    printCut(data, detail) {
        const t     = data.turn;
        const title = t.closed ? 'Corte Z' : 'Corte X';

        ordPrint(`${title} turno ${t.folio}`, `${this.cutTicket(data, detail)}<hr><p class="c s">Impreso ${ordNow()}</p>`);
    }

    // El papel del corte: lo imprime printCut y lo muestra el visor de Cortes. detail = modo Detallado.
    cutTicket(data, detail) {
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
            ${reopens}`;

        return body + (detail ? this.detailTicket(detail, 'abono de otro turno') : '');
    }

    // Cada pedido y cada cobro, uno por renglón. other = el texto para un abono de fuera.
    detailTicket(detail, other) {
        const sales    = detail.sales || [];
        const payments = detail.payments || [];
        const hour     = (at) => ordHour(String(at || '').slice(11, 16));
        const line     = (a, sub, b, off) => `<tr${off ? ' class="x"' : ''}><td>${a}<span class="s d">${sub}</span></td><td class="r">${b}</td></tr>`;

        const saleRows = sales.length
            ? sales.map((s) => line(
                `#${esc(s.folio)} ${esc(s.customer || (s.order ? 'Sin cliente' : 'Mostrador'))}`,
                `${esc(s.status)} · ${hour(s.at)}`,
                money(s.total),
                [1, 4].includes(Number(s.status_id))
            )).join('')
            : line('Sin pedidos', '', money(0));

        const payRows = payments.length
            ? payments.map((p) => line(
                `${hour(p.at)} · ${esc(p.method)}`,
                `${p.folio ? `#${esc(p.folio)} ` : ''}${esc(p.customer || 'Sin cliente')}${p.other ? ` · ${other}` : ''}`,
                money(p.amount)
            )).join('')
            : line('Sin cobros', '', money(0));

        return `
            <hr><h2>Pedidos y ventas (${sales.length})</h2><table>${saleRows}</table>
            <hr><h2>Cobros (${payments.length})</h2><table>${payRows}</table>`;
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
