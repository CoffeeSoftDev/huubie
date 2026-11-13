/*  Pedidos › cierre del día: ver lo vendido y lo cobrado de un día,
    cerrarlo y reabrirlo con motivo.

    Lo abren el botón «Cierre del día» del encabezado y el aviso del turno
    cuando el día ya se cerró o falta cerrar uno anterior.

    Quién puede lo decide el ctrl en data.can: cerrar = create,
    reabrir = cancel (Dueño y Supervisor). Las tablas y el tono de la
    diferencia se toman de orderTurn para que ambos cortes se vean igual. */

// -- Cierre del día --

class OrderClosure extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'OrderClosure';
        this.loading      = false;
        this.saving       = false;
        this.token        = '';
    }

    // -- Entrada --

    // Sin fecha abre hoy.
    async open(date) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

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

        let info = '';

        if (!data.closed && !data.can.close && orders.can('create') && data.turns.length) info = data.can.close_reason;
        else if (data.closed && !data.can.reopen && orders.can('cancel')) info = data.can.reopen_reason;

        this.token = ordToken();

        const modal = this.csModal({
            id:         'modalOrderClosure',
            title:      `Cierre del día ${ordDate(data.date)}`,
            subtitle:   data.branch + (data.date === data.today ? ' · hoy' : ''),
            lucideIcon: 'calendar-check',
            width:      'max-w-3xl',
            saveText:   closing ? 'Cerrar día' : reopen ? 'Reabrir día' : false,
            cancelText: 'Volver',
            info:       info,
            action:     canPrint && data.turns.length ? { text: data.closed ? 'Imprimir cierre' : 'Imprimir parcial', lucideIcon: 'printer', onClick: () => this.printDay(data) } : null,
            json: [
                { id: 'dc_nav', tipo: 'html', class: 'w-full', html: this.nav(data) },
                ...this.alerts(data),
                { id: 'dc_kpis', tipo: 'html', class: 'w-full', html: this.kpis(data) },
                { id: 'dc_methods', tipo: 'html', class: 'w-full md:w-1/2', html: this.methodsTable(data.summary) },
                { id: 'dc_statuses', tipo: 'html', class: 'w-full md:w-1/2', html: this.statusesTable(data.summary) },
                { id: 'dc_turns', tipo: 'html', class: 'w-full', html: this.turnsTable(data) },
                ...this.closeFields(data, closing)
            ],
            onSave: (values, close) => closing ? this.saveClose(data, values, close) : this.reopenForm(data, close)
        });

        $('#modalOrderClosure .cs-modal-title').after(this.badges(data));

        // csModal enfoca la nota y baja hasta ella: aquí se lee primero el resumen.
        $('#modalOrderClosure :focus').trigger('blur');
        $('#modalOrderClosure, #modalOrderClosure *').filter((i, el) => el.scrollTop > 0).scrollTop(0);

        $('#modalOrderClosure').on('click', 'button.ord-day-nav', (e) => this.go($(e.currentTarget).attr('data-date'), modal));

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
                ${chips}
            </div>`;
    }

    alerts(data) {
        if (!(data.warnings || []).length) return [];

        const items = data.warnings.map((w) => `<li>${esc(w)}</li>`).join('');

        return [{
            id:    'dc_alerts',
            tipo:  'html',
            class: 'w-full',
            html:  `<div class="ord-day-alert rounded-xl border-[1px] border-amber-200 bg-amber-50 px-[14px] py-[10px] text-[13px] text-amber-800"><ul class="mb-0 pl-[18px] list-disc">${items}</ul></div>`
        }];
    }

    kpis(data) {
        const s      = data.summary;
        const closed = data.turns.filter((t) => t.closed);
        const open   = data.turns.length - closed.length;
        const turns  = data.turns.length || (data.closure ? data.closure.turns : 0);
        const abono  = (s.methods || []).filter((m) => m.source === 'abono').reduce((sum, m) => sum + Number(m.amount), 0);
        const diff   = ordRound(closed.reduce((sum, t) => sum + Number(t.difference || 0), 0));
        const tone   = closed.length ? orderTurn.diffTone(diff) : null;

        // tone = clases de color de la diferencia; sin tone es un mosaico gris normal.
        const tile = (label, value, hint, tone, strong) => `
            <div class="${tone || 'ord-tile border-gray-200 bg-gray-50'} rounded-xl border-[1px] px-[14px] py-[10px]">
                <p class="text-[11px] font-semibold uppercase tracking-wide mb-1 ${tone ? '' : 'text-gray-500'}">${label}</p>
                <p class="text-[18px] font-bold mb-0 ${tone ? '' : strong ? 'text-blue-700' : 'text-gray-800'}">${value}</p>
                ${hint ? `<p class="text-[11px] mt-0.5 mb-0 ${tone ? 'opacity-70' : 'text-gray-400'}">${hint}</p>` : ''}
            </div>`;

        return `
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-[8px]">
                ${tile('Vendido', money(s.total), 'Pendientes y pagados', '', true)}
                ${tile('Cobrado', money(s.collected), abono > 0.004 ? `Incluye ${money(abono)} de abonos` : 'Todos los métodos')}
                ${tile('Efectivo', money(s.cash), 'Cobrado en efectivo')}
                ${tone ? tile('Caja', tone.text, 'Contado vs esperado', tone.cls) : tile('Caja', '—', 'Sin turnos cerrados')}
                ${tile('Pedidos · Mostrador', `${Number(s.orders_count)} · ${Number(s.sales_count)}`, s.first_folio ? `Folios ${esc(s.first_folio)} a ${esc(s.last_folio)}` : '')}
                ${tile('Canceladas', Number(s.cancelled_count))}
                ${tile('Descuentos', money(s.discount), Number(s.tip) > 0 ? `Propinas ${money(s.tip)}` : '')}
                ${tile('Turnos', Number(turns), open ? `${open} sigue${open > 1 ? 'n' : ''} abierto${open > 1 ? 's' : ''}` : '')}
            </div>`;
    }

    methodsTable(s) {
        const rows = (s.methods || []).map((m) => `
            <tr class="border-t-[1px] border-gray-100">
                <td class="py-1.5">${esc(m.name || 'Sin método')}${m.source === 'abono' ? ' <span class="text-[11px] text-gray-400">· abono</span>' : ''}</td>
                <td class="py-1.5 text-right">${Number(m.payments)}</td>
                <td class="py-1.5 text-right font-semibold">${money(m.amount)}</td>
            </tr>`).join('');

        const foot = rows
            ? `<tr class="border-t-[1px] border-gray-200 font-bold"><td class="py-1.5" colspan="2">Total cobrado</td><td class="py-1.5 text-right">${money(s.collected)}</td></tr>`
            : '';

        return orderTurn.miniTable('Cobrado por método', ['Método', 'Pagos', 'Monto'], rows || this.emptyRow('Sin cobros este día.', 3), foot);
    }

    statusesTable(s) {
        const rows = (s.statuses || []).map((st) => `
            <tr class="border-t-[1px] border-gray-100">
                <td class="py-1.5">${esc(st.name || 'Sin estado')}</td>
                <td class="py-1.5 text-right">${Number(st.orders)}</td>
                <td class="py-1.5 text-right font-semibold">${money(st.amount)}</td>
            </tr>`).join('');

        return orderTurn.miniTable('Pedidos por estado', ['Estado', 'Pedidos', 'Monto'], rows || this.emptyRow('Sin pedidos este día.', 3), '');
    }

    turnsTable(data) {
        const pill = 'inline-flex items-center px-2 py-0.5 rounded-full border-[1px] text-[11px] font-semibold whitespace-nowrap';

        const rows = data.turns.map((t) => {
            const start = ordHour(String(t.opened_at || '').slice(11, 16));
            const end   = !t.closed ? `Desde ${start} · sigue abierto`
                : String(t.closed_at).slice(0, 10) === data.date ? `${start} a ${ordHour(String(t.closed_at).slice(11, 16))}`
                : `${start} a ${ordDate(t.closed_at, true)}`;
            const tone  = t.closed ? orderTurn.diffTone(Number(t.difference)) : { text: 'Abierto', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
            const by    = t.opened_by ? ` · ${esc(t.opened_by)}` : '';

            return `
                <tr class="border-t-[1px] border-gray-100">
                    <td class="py-1.5">
                        <span class="font-semibold">Turno ${esc(t.folio)}</span>
                        <span class="block text-[11px] text-gray-400">${end}${by}</span>
                    </td>
                    <td class="py-1.5 text-right">
                        ${money(t.sold)}
                        ${t.changed ? `<span class="block text-[11px] text-amber-700">hoy ${money(t.live)}</span>` : ''}
                    </td>
                    <td class="py-1.5 text-right">${money(t.collected)}</td>
                    <td class="py-1.5 text-right"><span class="${pill} ${tone.cls}">${tone.text}</span></td>
                    <td class="py-1.5 text-right"><button type="button" class="ord-day-turn" data-id="${Number(t.id)}">Ver corte</button></td>
                </tr>`;
        }).join('');

        return orderTurn.miniTable('Turnos del día', ['Turno', 'Vendido', 'Cobrado', 'Caja', ''], rows || this.emptyRow('No hubo turnos este día.', 5), '');
    }

    emptyRow(text, cols) {
        return `<tr><td colspan="${cols}" class="py-3 text-center text-gray-400">${text}</td></tr>`;
    }

    closeFields(data, closing) {
        const fields = [];
        const c      = data.closure;

        if (closing) {
            fields.push({ id: 'dc_note', lbl: 'Nota del cierre (opcional)', tipo: 'textarea', maxlength: 255, rows: 2, ph: 'Ej. El efectivo se entregó a Dirección', class: 'w-full' });
        }

        if (c) {
            const note = c.note ? `<p class="text-[12.5px] text-gray-600 mt-1 mb-0">Nota: ${esc(c.note)}</p>` : '';

            fields.push({
                id:    'dc_closed',
                tipo:  'html',
                class: 'w-full',
                html:  `<p class="text-[12px] text-gray-400 mb-0">Cierre ${esc(c.folio)} · cerró ${esc(c.closed_by || '—')} el ${ordDate(c.closed_at, true)}.</p>${note}`
            });
        }

        if ((data.reopens || []).length) {
            const items = data.reopens.map((r) => `<li>Cierre ${esc(r.folio)} (${money(r.total)}): reabrió ${esc(r.reopened_by || '—')} el ${ordDate(r.reopened_at, true)}. ${esc(r.reopen_reason)}</li>`).join('');

            fields.push({
                id:    'dc_reopens',
                tipo:  'html',
                class: 'w-full',
                html:  `<p class="text-xs font-semibold text-gray-500 mb-1">Reaperturas</p><ul class="text-[12.5px] text-gray-600 mb-0 pl-[18px] list-disc">${items}</ul>`
            });
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

        const print = orders.can('print');
        const done  = await alert({
            icon:     'success',
            title:    answer.message,
            text:     print ? '¿Imprimes el cierre?' : '',
            btn1:     print,
            btn1Text: 'Imprimir cierre',
            btn2:     true,
            btn2Text: 'Listo'
        });

        if (!done || !done.isConfirmed) return;

        const fresh = await this.fetchDay(data.date);

        if (fresh) this.printDay(fresh);
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

    printDay(data) {
        const s   = data.summary;
        const c   = data.closure;
        const row = (a, b, strong) => `<tr${strong ? ' class="b"' : ''}><td>${a}</td><td class="r">${b}</td></tr>`;

        const methods = (s.methods || []).length
            ? s.methods.map((m) => row(`${esc(m.name || 'Sin método')}${m.source === 'abono' ? ' · abono' : ''} (${Number(m.payments)})`, money(m.amount))).join('') + row('Total cobrado', money(s.collected), true)
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
            ${c && c.note ? `<hr><p class="s">Nota: ${esc(c.note)}</p>` : ''}
            <hr><p class="c s">Impreso ${ordNow()}</p>`;

        ordPrint(`Cierre del día ${ordDate(data.date)}`, body);
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
