/*  Pedidos › cierre del día: ver lo vendido y lo cobrado de un día,
    cerrarlo y reabrirlo con motivo.

    Lo abren el botón «Cierre del día» del encabezado y el aviso del turno
    cuando el día ya se cerró o falta cerrar uno anterior.

    Quién puede lo decide el ctrl en data.can: cerrar = create,
    reabrir = cancel (Dueño y Supervisor). Las piezas tipo Soft (franja,
    recuadros, tabla con total, avisos y pie con teclas) se toman de
    orderTurn para que el corte del turno y el del día se vean igual. */

// -- Cierre del día --

class OrderClosure extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'OrderClosure';
        this.loading      = false;
        this.saving       = false;
        this.token        = '';
        this.afterClose   = null;
    }

    // -- Entrada --

    // Sin fecha abre hoy. opts.afterClose: lo que sigue tras cerrar el día (abrir turno y volver al cobro).
    async open(date, opts = {}) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        this.afterClose = (opts && opts.afterClose) || null;

        const data = await this.fetchDay(date);

        if (data) this.day(data);
    }

    async fetchDay(date) {
        if (this.loading) return null;

        this.loading = true;

        const data = await useFetch({ url: this._link, data: { opc: 'getDay', date: date || '' } });

        this.loading = false;

        if (!data || data.status != 200) {
            alert({ icon: 'error', title: 'No se abrió el cierre del día', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
            return null;
        }

        orderTurn.sync(data.brief, false, data.day);

        return data;
    }

    // Cambia de día sin cerrar el modal hasta tener la respuesta.
    async go(date, modal) {
        const data = await this.fetchDay(date);
        if (!data) return;

        modal.close();
        this.day(data);
    }

    // -- Vista del día --

    day(data) {
        const closing  = !data.closed && data.can.close;
        const reopen   = data.closed && data.can.reopen;
        const canPrint = orders.can('print');
        const s        = data.summary;
        const ot       = orderTurn;

        const subtitle = data.closed ? 'Cierre Z del día · ya se cerró'
            : closing ? 'Cierre Z del día · revisa los turnos y ciérralo'
            : 'Corte X del día · parcial, el día no se ha cerrado';

        this.token = ordToken();

        const modal = this.csModal({
            id:         'modalOrderClosure',
            title:      `Cierre del día ${ordDate(data.date)}`,
            subtitle:   subtitle,
            lucideIcon: 'calendar-check',
            width:      'max-w-4xl',
            saveText:   closing ? 'Cerrar día' : reopen ? 'Reabrir día' : false,
            cancelText: 'Volver',
            json: [
                { id: 'dc_nav', tipo: 'html', class: 'w-full', html: this.nav(data) },
                { id: 'dc_head', tipo: 'html', class: 'w-full', html: ot.head(this.dayHead(data)) },
                { id: 'dc_boxes', tipo: 'html', class: 'w-full', html: ot.cols([ot.methodsBox(s.methods, s.collected), this.cashBox(data), this.salesBox(s)]) },
                { id: 'dc_turns', tipo: 'html', class: 'w-full', html: this.turnsGrid(data) },
                { id: 'dc_statuses', tipo: 'html', class: 'w-full', html: ot.statusGrid(s.statuses, s.total, Number(s.orders_count) + Number(s.sales_count), 'Sin pedidos este día.') },
                ...this.alerts(data),
                ...this.closeFields(data, closing)
            ],
            onSave: (values, close) => closing ? this.saveClose(data, values, close) : this.reopenForm(data, close)
        });

        $('#modalOrderClosure .cs-modal-title').after(this.badges(data));

        ot.softFoot('#modalOrderClosure', canPrint && data.turns.length ? { text: data.closed ? 'Imprimir cierre' : 'Imprimir parcial', onClick: () => this.printDay(data) } : null);

        // csModal enfoca la nota y baja hasta ella: aquí se lee primero el resumen.
        $('#modalOrderClosure :focus').trigger('blur');
        $('#modalOrderClosure, #modalOrderClosure *').filter((i, el) => el.scrollTop > 0).scrollTop(0);

        $('#modalOrderClosure').on('click', 'button.ord-day-nav', (e) => this.go($(e.currentTarget).attr('data-date'), modal));

        this.picker(data, modal);

        $('#modalOrderClosure').on('click', 'button.ord-day-turn', (e) => {
            modal.close();
            orderTurn.open(Number($(e.currentTarget).attr('data-id')));
        });

        if (window.lucide) lucide.createIcons();
    }

    badges(data) {
        const chip    = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap';
        const today   = data.date === data.today;
        const reopens = (data.reopens || []).length;

        let state = `<span class="${chip} bg-gray-100 text-gray-600"><i data-lucide="minus" class="w-3 h-3"></i>Sin turnos</span>`;

        if (data.closed) {
            state = `<span class="${chip} bg-gray-100 text-gray-600"><i data-lucide="lock" class="w-3 h-3"></i>Cerrado</span>`;
        } else if (data.turns.length && today && data.turns.every((t) => t.closed)) {
            state = `<span class="${chip} bg-[#EAF0FA] text-[#2A55A3]"><i data-lucide="check" class="w-3 h-3"></i>Listo para cerrar</span>`;
        } else if (data.turns.length && today) {
            state = `<span class="${chip} bg-emerald-50 text-emerald-700"><i data-lucide="lock-open" class="w-3 h-3"></i>En curso</span>`;
        } else if (data.turns.length) {
            state = `<span class="${chip} bg-amber-50 text-amber-700"><i data-lucide="triangle-alert" class="w-3 h-3"></i>Pendiente de cierre</span>`;
        }

        const again = reopens
            ? `<span class="${chip} bg-[#EAF0FA] text-[#2A55A3]"><i data-lucide="rotate-ccw" class="w-3 h-3"></i>Reabierto${reopens > 1 ? ' ' + reopens + ' veces' : ''}</span>`
            : '';

        return `<div class="flex flex-wrap items-center gap-1.5 mt-1">${state}${again}</div>`;
    }

    // Día anterior / siguiente / hoy y los días que faltan por cerrar.
    nav(data) {
        const prev    = this.shift(data.date, -1);
        const next    = this.shift(data.date, 1);
        const pending = (data.pending || []).filter((p) => p.date !== data.date);

        const chips = pending.length
            ? `<span class="text-[12px] font-semibold text-amber-700 ml-auto">Falta cerrar:</span>`
              + pending.map((p) => `<button type="button" class="ord-day-nav is-warn" data-date="${esc(p.date)}">${ordDate(p.date)}</button>`).join('')
            : '';

        return `
            <div class="flex flex-wrap items-center gap-[8px]">
                <button type="button" class="ord-day-nav" data-date="${prev}" aria-label="Día anterior"><i data-lucide="chevron-left" class="w-4 h-4"></i>Anterior</button>
                <button type="button" class="ord-day-nav" data-date="${next}" aria-label="Día siguiente" ${next > data.today ? 'disabled' : ''}>Siguiente<i data-lucide="chevron-right" class="w-4 h-4"></i></button>
                ${data.date !== data.today ? `<button type="button" class="ord-day-nav" data-date="${data.today}">Hoy</button>` : ''}
                <label class="ord-day-pick" aria-label="Elegir un día del calendario">
                    <i data-lucide="calendar-days" class="w-4 h-4"></i>
                    <input type="text" id="dc_pick" readonly autocomplete="off">
                </label>
                ${chips}
            </div>`;
    }

    // Calendario de un solo día, hasta hoy. El popup vive en <body>: se borra el del modal anterior.
    picker(data, modal) {
        $('.daterangepicker.ord-day-picker').remove();

        dataPicker({
            parent: 'dc_pick',
            type:   'simple',
            rangeDefault: {
                singleDatePicker: true,
                showDropdowns:    true,
                autoApply:        true,
                startDate:        moment(data.date, 'YYYY-MM-DD'),
                maxDate:          moment(data.today, 'YYYY-MM-DD'),
                opens:            'left',
                locale: {
                    format:     'DD/MM/YYYY',
                    firstDay:   1,
                    daysOfWeek: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'],
                    monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
                }
            },
            onSelect: (start) => {
                const date = start.format('YYYY-MM-DD');
                if (date !== data.date) this.go(date, modal);
            }
        });

        const dp = $('#dc_pick').data('daterangepicker');
        if (dp) dp.container.addClass('ord-day-picker');
    }

    // Datos de la franja de arriba: [etiqueta, valor ya escapado].
    dayHead(data) {
        const s     = data.summary;
        const c     = data.closure;
        const total = data.turns.length || (c ? Number(c.turns) : 0);
        const open  = data.turns.filter((t) => !t.closed).length;

        const fields = [
            ['Día', ordDate(data.date) + (data.date === data.today ? ' · hoy' : '')],
            ['Sucursal', esc(data.branch || '—')],
            ['Turnos', `${total}${open ? ` · ${open} abierto${open > 1 ? 's' : ''}` : ''}`],
            ['Folios', s.first_folio ? `${esc(s.first_folio)} a ${esc(s.last_folio)}` : '—']
        ];

        if (c) fields.push(['Cierre', esc(c.folio)], ['Cerró', `${esc(c.closed_by || '—')} · ${ordDate(c.closed_at, true)}`]);

        return fields;
    }

    // Solo turnos cerrados: esperado y contado existen hasta el corte Z de cada turno.
    cashBox(data) {
        const ot     = orderTurn;
        const closed = data.turns.filter((t) => t.closed);
        const sum    = (key) => ordRound(closed.reduce((acc, t) => acc + Number(t[key] || 0), 0));
        const count  = ot.line('Turnos cerrados', `${closed.length} de ${data.turns.length}`);

        if (!closed.length) return ot.box('Caja · turnos cerrados', count + '<p class="ord-cut-hint">La caja se cuadra al cerrar cada turno.</p>');

        const tone = ot.diffTone(sum('difference'));

        return ot.box('Caja · turnos cerrados',
            count
            + ot.line('Fondo inicial', money(sum('opening_cash')))
            + ot.line('+ Cobrado en efectivo', money(ordRound(sum('expected_cash') - sum('opening_cash'))))
            + ot.line('Efectivo esperado', money(sum('expected_cash')), 'is-total')
            + ot.line('Efectivo contado', money(sum('counted_cash')), 'is-strong')
            + ot.line('Diferencia', tone.text, '', `is-${tone.tone}`));
    }

    salesBox(s) {
        const ot    = orderTurn;
        const count = Number(s.orders_count) + Number(s.sales_count);

        return ot.box('Ventas',
            ot.line('Subtotal', money(s.subtotal))
            + ot.line('Descuentos', money(s.discount))
            + (Number(s.tip) > 0 ? ot.line('Propinas', money(s.tip)) : '')
            + ot.line('Pedidos · Mostrador', `${Number(s.orders_count)} · ${Number(s.sales_count)}`)
            + ot.line('Canceladas', Number(s.cancelled_count))
            + ot.line('Ticket promedio', count ? money(Number(s.total) / count) : '—')
            + ot.line('Total vendido', money(s.total), 'is-total'));
    }

    // Un renglón por turno con su caja; el total suma esperado y contado solo de los cerrados.
    turnsGrid(data) {
        const closed = data.turns.filter((t) => t.closed);
        const sum    = (list, key) => ordRound(list.reduce((acc, t) => acc + Number(t[key] || 0), 0));
        const pill   = (tone, text) => `<span class="ord-cut-pill is-${tone}">${text}</span>`;

        const body = data.turns.map((t) => {
            const start = ordHour(String(t.opened_at || '').slice(11, 16));
            const end   = !t.closed ? `Desde ${start}`
                : String(t.closed_at).slice(0, 10) === data.date ? `${start} a ${ordHour(String(t.closed_at).slice(11, 16))}`
                : `${start} a ${ordDate(t.closed_at, true)}`;
            const tone  = t.closed ? orderTurn.diffTone(Number(t.difference)) : null;

            return `
                <tr>
                    <td><b>${esc(t.folio)}</b></td>
                    <td>${end}<small>${esc(t.opened_by || '—')}</small></td>
                    <td class="r">${money(t.sold)}${t.changed ? `<small class="is-over">hoy ${money(t.live)}</small>` : ''}</td>
                    <td class="r">${money(t.collected)}</td>
                    <td class="r">${t.closed ? money(t.expected_cash) : '—'}</td>
                    <td class="r">${t.closed ? money(t.counted_cash) : '—'}</td>
                    <td class="c">${tone ? pill(tone.tone, tone.text) : pill('open', 'Abierto')}</td>
                    <td class="r"><button type="button" class="ord-day-turn" data-id="${Number(t.id)}">Ver corte</button></td>
                </tr>`;
        }).join('');

        if (!body) return orderTurn.grid(['Turno', 'Horario · abrió', 'Vendido', 'Cobrado', 'Esperado', 'Contado', 'Caja', ''], 'llrrrrcr', '<tr><td colspan="8" class="ord-cut-empty">No hubo turnos este día.</td></tr>', '');

        const tone = closed.length ? orderTurn.diffTone(sum(closed, 'difference')) : null;
        const foot = `
            <tr>
                <td colspan="2">Total · ${data.turns.length} turno${data.turns.length > 1 ? 's' : ''}</td>
                <td class="r">${money(sum(data.turns, 'sold'))}</td>
                <td class="r">${money(sum(data.turns, 'collected'))}</td>
                <td class="r">${closed.length ? money(sum(closed, 'expected_cash')) : '—'}</td>
                <td class="r">${closed.length ? money(sum(closed, 'counted_cash')) : '—'}</td>
                <td class="c">${tone ? pill(tone.tone, tone.text) : '—'}</td>
                <td></td>
            </tr>`;

        return orderTurn.grid(['Turno', 'Horario · abrió', 'Vendido', 'Cobrado', 'Esperado', 'Contado', 'Caja', ''], 'llrrrrcr', body, foot);
    }

    // Avisos abajo, junto a los botones: lo que falta y por qué no se puede cerrar o reabrir.
    alerts(data) {
        const bars = [];
        const why  = this.reason(data);

        if ((data.warnings || []).length) {
            bars.push(orderTurn.alertBar(`<ul class="mb-0 pl-[18px] list-disc">${data.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>`, 'is-warn'));
        }

        if (why) bars.push(orderTurn.alertBar(esc(why), 'is-info'));

        return bars.length ? [{ id: 'dc_alerts', tipo: 'html', class: 'w-full', html: bars.join('') }] : [];
    }

    reason(data) {
        if (!data.closed && !data.can.close && orders.can('create') && data.turns.length) return data.can.close_reason;
        if (data.closed && !data.can.reopen && orders.can('cancel')) return data.can.reopen_reason;

        return '';
    }

    // La nota es campo del formulario (values.dc_note); lo demás es solo lectura.
    closeFields(data, closing) {
        const fields = [];
        const c      = data.closure;

        if (closing) {
            fields.push({ id: 'dc_note', lbl: 'Nota del cierre (opcional)', tipo: 'textarea', maxlength: 255, rows: 2, ph: 'Ej. El efectivo se entregó a Dirección', class: 'w-full' });
        }

        if (c && c.note) {
            fields.push({ id: 'dc_closed', tipo: 'html', class: 'w-full', html: orderTurn.note('Nota del cierre', `<p class="mb-0">${esc(c.note)}</p>`) });
        }

        if ((data.reopens || []).length) {
            const items = data.reopens.map((r) => `<li>Cierre ${esc(r.folio)} (${money(r.total)}): reabrió ${esc(r.reopened_by || '—')} el ${ordDate(r.reopened_at, true)}. ${esc(r.reopen_reason)}</li>`).join('');

            fields.push({ id: 'dc_reopens', tipo: 'html', class: 'w-full', html: orderTurn.note('Reaperturas', `<ul>${items}</ul>`) });
        }

        return fields;
    }

    // yyyy-mm-dd ± n días, en UTC para no cruzar zonas.
    shift(date, n) {
        const [y, m, d] = String(date).split('-').map(Number);

        return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
    }

    // -- Cerrar --

    async saveClose(data, values, close) {
        if (this.saving) return;

        const s     = data.summary;
        const note  = String(values.dc_note || '').trim();
        const today = data.date === data.today;
        const warn  = (data.warnings || []).length
            ? `<p class="text-[12px] text-amber-700 mb-2">${data.warnings.map(esc).join('<br>')}</p>`
            : '';

        const sure = await alert({
            icon:     'question',
            title:    `¿Cerrar el día ${ordDate(data.date)}?`,
            html:     `<p class="text-[14px] leading-6 mb-2">Vendido: <b>${money(s.total)}</b><br>Cobrado: <b>${money(s.collected)}</b><br>Efectivo: <b>${money(s.cash)}</b></p>${warn}`
                    + `<p class="text-[12px] mb-0">${today ? 'Hoy ya no se abren más turnos. ' : ''}Para corregir algo, un Dueño o Supervisor lo reabre.</p>`,
            btn1Text: 'Sí, cerrar día',
            btn2Text: 'Revisar'
        });

        if (!sure || !sure.isConfirmed) return;

        const answer = await this.send('#modalOrderClosure', { opc: 'closeDay', date: data.date, note: note, token: this.token }, 'No se cerró el día');
        if (!answer) return;

        close();

        orderTurn.sync(answer.brief, true, answer.day);

        const next  = today ? null : this.afterClose;
        const print = orders.can('print');

        this.afterClose = null;

        const done  = await alert({
            icon:     'success',
            title:    answer.message,
            text:     print ? '¿Imprimes el cierre?' : '',
            btn1:     print,
            btn1Text: 'Imprimir cierre',
            btn2:     true,
            btn2Text: next ? 'Seguir' : 'Listo'
        });

        if (done && done.isConfirmed) {
            const fresh = await this.fetchDay(data.date);

            if (fresh) this.printDay(fresh);
        }

        // Venía de un cobro frenado por este día: sigue con el turno de hoy.
        if (next) orderTurn.open(0, { afterOpen: next });
    }

    // -- Reabrir --

    reopenForm(data, closeDay) {
        const c = data.closure;

        closeDay();

        this.csModal({
            id:         'modalOrderClosureReopen',
            title:      `Reabrir el día ${ordDate(data.date)}`,
            subtitle:   `Cerrado ${ordDate(c.closed_at, true)}${c.closed_by ? ' por ' + c.closed_by : ''}`,
            lucideIcon: 'rotate-ccw',
            width:      'max-w-lg',
            saveText:   'Reabrir día',
            cancelText: 'Cancelar',
            info:       'El cierre se rehace cuando lo vuelvas a cerrar.',
            json: [
                { id: 'dc_reason', lbl: 'Motivo de la reapertura', tipo: 'textarea', required: true, maxlength: 200, rows: 3, ph: 'Ej. Faltó cobrar el anticipo de un pastel', class: 'w-full' }
            ],
            onSave: (values, close) => this.saveReopen(data, values, close)
        });

        $('#dc_reason').trigger('focus');
    }

    async saveReopen(data, values, close) {
        if (this.saving) return;

        const reason = String(values.dc_reason || '').trim();

        if (!reason) return orderTurn.warn('Escribe por qué se reabre el día.');

        const answer = await this.send('#modalOrderClosureReopen', { opc: 'reopenDay', date: data.date, reason: reason }, 'No se reabrió el día');
        if (!answer) return;

        close();

        orderTurn.sync(answer.brief, true, answer.day);

        alert({ icon: 'success', title: answer.message, timer: 1800 });
    }

    // -- Impresion --

    printDay(data, detail) {
        ordPrint(`Cierre del día ${ordDate(data.date)}`, `${this.dayTicket(data, detail)}<hr><p class="c s">Impreso ${ordNow()}</p>`);
    }

    // El papel del cierre: lo imprime printDay y lo muestra el visor de Cortes. detail = modo Detallado.
    dayTicket(data, detail) {
        const s   = data.summary;
        const c   = data.closure;
        const row = (a, b, strong) => `<tr${strong ? ' class="b"' : ''}><td>${a}</td><td class="r">${b}</td></tr>`;

        const methods = (s.methods || []).length
            ? s.methods.map((m) => row(`${esc(m.name || 'Sin método')}${m.source === 'abono' ? ' · abono' : ''}${Number(m.tip) > 0 ? ' · propina ' + money(m.tip) : ''} (${Number(m.payments)})`, money(m.amount))).join('') + row('Total cobrado', money(s.collected), true)
            : row('Sin cobros', money(0));

        const statuses = (s.statuses || []).length
            ? s.statuses.map((st) => row(`${esc(st.name || 'Sin estado')} (${Number(st.orders)})`, money(st.amount))).join('')
            : row('Sin pedidos', '0');

        const turns = data.turns.length
            ? data.turns.map((t) => row(`Turno ${esc(t.folio)} · ${money(t.collected)}`, t.closed ? orderTurn.diffTone(Number(t.difference)).text : 'Abierto')).join('')
            : row('Sin turnos', '');

        const body = `
            <h1>Cierre del día</h1>
            <p class="c s">${esc(data.branch)} · ${ordDate(data.date)}${c ? ' · Cierre ' + esc(c.folio) : ' (parcial: sin cerrar)'}</p>
            ${c ? `<p class="c s">Cerró ${esc(c.closed_by || '—')} · ${ordDate(c.closed_at, true)}</p>` : ''}
            <hr><h2>Ventas</h2>
            <table>
                ${row('Subtotal', money(s.subtotal))}
                ${row('Descuentos', money(s.discount))}
                ${row('Propinas', money(s.tip))}
                ${row('Vendido', money(s.total), true)}
                ${row('Pedidos', Number(s.orders_count))}
                ${row('Ventas de mostrador', Number(s.sales_count))}
                ${row('Canceladas', Number(s.cancelled_count))}
                ${s.first_folio ? row('Folios', `${esc(s.first_folio)} a ${esc(s.last_folio)}`) : ''}
            </table>
            <hr><h2>Cobrado por método</h2><table>${methods}${row('Efectivo', money(s.cash))}</table>
            <hr><h2>Pedidos por estado</h2><table>${statuses}</table>
            <hr><h2>Turnos</h2><table>${turns}</table>
            ${c && c.note ? `<hr><p class="s">Nota: ${esc(c.note)}</p>` : ''}`;

        return body + (detail ? orderTurn.detailTicket(detail, 'abono de otro día') : '');
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

        if (conflict) orderTurn.refresh();

        return null;
    }
}
