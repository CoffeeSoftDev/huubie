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
    (head, box, line, grid, alertBar, softFoot) las reusa el cierre del día.

    Un turno abierto (Cerrar turno, F3) abre el módulo de alpha (desk): a la
    izquierda sucursal, fecha, turno, efectivo contado (opcional) y los botones
    Cerrar e Imprimir; a la derecha el ticket «Cierre x turno» de alpha en
    Resumido o Detallado. Abrir turno y Cierre del día no viven aquí.
    Cerrar confirma con la diferencia en grande (o «sin contar») y esperado,
    contado y cobrado abajo. Al cerrar, la ventana sigue abierta: el ticket
    pasa a Cerrado y «Cerrar turno» se apaga. */

/*  Estilos del ticket «Cierre x turno» de alpha (alpha/pedidos › shift-ticket.js).
    Una sola fuente: la vista previa los pone en <head> (shiftCss) y la
    impresión los manda al iframe. Todo con prefijo sh- y sin <p>, <h*> ni
    tablas: order.css y dark-mode.css pisan esas etiquetas dentro de .ord-ticket. */
const ORD_SHIFT_CSS = `
    .sh { color: #111827; font-family: Consolas, 'Roboto Mono', 'Lucida Console', monospace; font-size: 12px; line-height: 1.5; text-align: left; }
    .sh * { box-sizing: border-box; }
    .sh hr { height: 0; margin: 4px 0; border: 0; border-top: 1px dashed #D1D5DB; opacity: 1; }
    .sh-head { display: flex; flex-direction: column; align-items: center; margin-bottom: 12px; text-align: center; }
    .sh-logo { width: 60px; height: 60px; margin-bottom: 4px; border-radius: 50%; overflow: hidden; }
    .sh-logo img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .sh-logo span { display: none; }
    .sh-logo.sh-none { display: flex; align-items: center; justify-content: center; background: #7C3AED; }
    .sh-logo.sh-none img { display: none; }
    .sh-logo.sh-none span { display: block; color: #FFFFFF; font-size: 24px; font-weight: 700; }
    .sh-co { font-size: 14px; font-weight: 700; text-transform: uppercase; }
    .sh-branch { color: #7C3AED; font-weight: 600; }
    .sh-kind { font-weight: 600; }
    .sh-muted { color: #4B5563; }
    .sh-tag { margin-top: 4px; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 700; }
    .sh-tag.sh-closed { background: #DCFCE7; color: #166534; }
    .sh-tag.sh-live { background: #DBEAFE; color: #1E40AF; }
    .sh-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
    .sh-row > :last-child { text-align: right; white-space: nowrap; }
    .sh-b { font-weight: 600; }
    .sh-big > :last-child { font-size: 14px; }
    .sh-gap { height: 8px; }
    .sh-title { margin: 8px 0 4px; font-weight: 600; }
    .sh-cols { display: flex; align-items: baseline; }
    .sh-cols > :first-child { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 700; }
    .sh-cols > :not(:first-child) { width: 72px; flex-shrink: 0; text-align: right; white-space: nowrap; }
    .sh-cols.sh-th { margin-bottom: 2px; font-size: 9px; color: #9CA3AF; }
    .sh-cols.sh-th > :first-child { font-weight: 400; }
    .sh-sub { margin-bottom: 4px; font-size: 10px; color: #6B7280; }
    .sh-green { color: #15803D; }
    .sh-sum { margin-top: 4px; padding-top: 4px; border-top: 1px dashed #D1D5DB; font-weight: 600; }
    .sh-prev { margin-top: 12px; padding-top: 8px; border-top: 1px dashed #E5E7EB; }
    .sh-prev .sh-sub { margin-bottom: 2px; }
    .sh-prev > .sh-row:first-child > :first-child { font-style: italic; }
    .sh-sm { font-size: 11px; }
    .sh-sm small { color: #9CA3AF; font-size: 11px; }
    .sh-badge { padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; }
    .sh-badge.sh-ok { background: #DCFCE7; color: #15803D; }
    .sh-badge.sh-due { background: #F3F4F6; color: #4B5563; }
    .sh-cross { margin-top: 8px; padding: 12px; border: 1px solid #E9D5FF; border-radius: 8px; background: #FAF5FF; }
    .sh-cross .sh-sub { margin-bottom: 0; color: #8B5CF6; }
    .sh-note { font-size: 10px; color: #6B7280; text-align: right; }
    .sh-foot { margin-top: 16px; text-align: center; font-size: 10px; font-weight: 700; }
    .sh-foot > div + div { margin-top: 4px; }
    .sh-brand { color: #6B21A8; font-size: 12px; }
    .sh-stamp { color: #6B7280; font-size: 9px; font-weight: 400; }`;

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

    // opts.afterOpen: lo que sigue cuando el turno queda abierto (p. ej. volver al cobro).
    async open(id, opts = {}) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        this.afterOpen = (opts && opts.afterOpen) || null;

        const data = await this.fetchTurn(id);
        if (!data) return;

        if (!id && !data.brief && data.can.open) return this.openForm(data);

        if (!id && !data.brief && data.can.open_reason) {
            return this.locked({ title: dataInit.day && dataInit.day.closed ? 'Día cerrado' : 'Día pendiente de cierre', message: data.can.open_reason, day: true }, this.afterOpen);
        }

        if (!data.turn) {
            alert({ icon: 'info', title: 'Sin turnos', text: 'Esta sucursal todavía no tiene turnos de caja.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        // Turno abierto: el módulo de alpha. El corte completo queda para ver un turno cerrado.
        if (!data.turn.closed) return this.desk(data);

        this.cut(data);
    }

    // 423 del ctrl. Con day = true el bloqueo es el día (cerrado o pendiente), no el turno.
    // next: lo que sigue cuando quede un turno abierto hoy (p. ej. volver al cobro).
    async locked(data, next) {
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

        if (day) return orderClosure.open(this.blockedDay(), { afterClose: next });

        this.open(0, { afterOpen: next });
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

        this.paintStrip();

        if (!orders) return;

        orders.paintTurn();

        if (reload) orders.lsOrders();
    }

    // -- Franja de caja --

    // La pantalla la enciende una vez (paintStrip(true)) cuando ya sabe que puede verla.
    // Después sync() la repinta sola con cada cambio del turno.
    paintStrip(enable) {
        if (enable) this.stripOn = true;

        if (!this.stripOn) return;

        if (!this.strip) this.strip = new CajaStrip(this._link, 'root');

        this.strip.paint();
    }

    // Tras guardar un pedido, venta o cobro: pide solo el turno y el día para que
    // «Vendido» y los conteos de la franja no se queden viejos. Varios guardados
    // seguidos hacen una sola consulta.
    touch() {
        if (!this.stripOn) return;

        clearTimeout(this.touchTimer);

        this.touchTimer = setTimeout(async () => {
            const data = await useFetch({ url: this._link, data: { opc: 'getBrief' } });

            if (data && data.status == 200) this.sync(data.brief, false, data.day);
        }, 400);
    }

    // -- Abrir --

    // Igual al "Abrir Turno" de alpha/pedidos: createCoffeeModalForm con sucursal,
    // responsable y fondo inicial, y una confirmación antes de abrir.
    openForm(data) {
        const last   = data.turn;
        const branch = data.branch || '';
        const icon   = (name) => `<i data-lucide="${name}" class="w-4 h-4"></i>`;

        this.token = ordToken();

        const modal = this.createCoffeeModalForm({
            id:          'modalOrderTurnOpen',
            title:       'Abrir turno',
            iconSvg:     '<i data-lucide="clock" class="w-5 h-5"></i>',
            iconBg:      'bg-emerald-600',
            confirmText: 'Confirmar apertura',
            cancelText:  'Cancelar',
            footerNote:  last
                ? `Último: turno ${esc(last.folio)}, cerrado ${esc(ordDate(last.closed_at, true))} · <button type="button" class="ord-last-cut underline underline-offset-2">Ver corte</button>`
                : '',
            // La sucursal va en negritas: es lo que se revisa antes de abrir (display pinta el HTML tal cual).
            json: [
                { opc: 'display', id: 'sucursal',    lbl: 'Sucursal',              icon: icon('house'), value: `<strong class="font-bold">${esc(branch)}</strong>` },
                { opc: 'display', id: 'responsable', lbl: 'Responsable',           icon: icon('user'),  value: esc(data.user || 'Sin asignar') },
                { opc: 'money',   id: 'openingAmount', lbl: 'Fondo inicial de caja (opcional)', placeholder: '0.00', min: 0, step: 0.01, autofocus: true }
            ],
            onConfirm: (values, modal) => { this.saveOpen(values, modal, branch); }
        });

        modal.el.on('click', 'button.ord-last-cut', () => {
            modal.close();
            this.cut(data);
        });

        this.enterSaves('#modalOrderTurnOpen', '#modalOrderTurnOpen-openingAmount');
    }

    async saveOpen(values, modal, branch) {
        if (this.saving) return;

        // El fondo es opcional: vacío abre el turno en $0.
        const raw  = String(values.openingAmount == null ? '' : values.openingAmount).trim();
        const cash = raw === '' ? 0 : ordAmount(raw);

        if (cash === null) return this.warn('El fondo inicial no es una cantidad válida.');

        const fund = cash > 0 ? `con un fondo inicial de <strong>${money(cash)}</strong>` : '<strong>sin fondo inicial</strong>';

        // La sucursal va aparte y resaltada (.ord-turn-branch): es lo que se revisa antes de confirmar.
        const answer = await alert({
            icon:     'question',
            title:    '¿Aperturar turno?',
            html:     '<p>Se abrirá un nuevo turno de caja en</p>'
                    + `<div class="ord-turn-branch"><i class="icon-home"></i>${esc(branch)}</div>`
                    + `<p>${fund}.</p>`,
            btn1Text: 'Sí, aperturar',
            btn2Text: 'Cancelar'
        });

        if (!answer || !answer.isConfirmed) return;

        const data = await this.send('#modalOrderTurnOpen', { opc: 'openTurn', opening_cash: cash, token: this.token }, 'No se abrió el turno');
        if (!data) return;

        modal.close();

        this.sync(data.brief, true, data.day);

        const next = this.afterOpen;

        this.afterOpen = null;

        await alert({ icon: 'success', title: data.message, timer: next ? 1200 : 1800 });

        if (next) next();
    }

    // -- Cierre de turno (módulo de alpha) --

    /*  El «Cierre del Día» de alpha/pedidos, solo para cerrar turno: a la
        izquierda la sucursal, el día, el turno, el efectivo contado y los
        botones Cerrar e Imprimir; a la derecha el ticket «Cierre x turno» del
        turno elegido (Resumido o Detallado), el mismo papel que se imprime.
        El día, el turno y el modo se cambian sin cerrar la ventana. */
    desk(data) {
        const t = data.turn;

        this.deskDay     = String(t.opened_at || data.today).slice(0, 10);
        this.deskToday   = data.today;
        this.deskTurns   = [];
        this.deskCan     = data.can;
        this.deskReq     = 0;
        this.deskView    = 'summary';
        this.deskCountId = null;
        this.deskClosed  = false;
        this.token       = ordToken();

        this.deskModal = this.csModal({
            id:         'modalOrderTurnDesk',
            title:      'Cierre de turno',
            subtitle:   data.branch || '',
            lucideIcon: 'calculator',
            width:      'max-w-4xl',
            saveText:   false,
            cancelText: 'Volver',
            body:       this.deskBody(data)
        });

        $('#modalOrderTurnDesk')
            .on('change', '#td_turn', (e) => this.deskTurn(Number($(e.currentTarget).val())))
            .on('click', 'button.ord-desk-go', (e) => this.deskGo(String($(e.currentTarget).attr('data-date'))))
            .on('click', 'button[data-desk]', (e) => this.deskAction(String($(e.currentTarget).attr('data-desk'))))
            .on('click', 'button.ord-seg', (e) => this.deskMode(String($(e.currentTarget).attr('data-mode'))))
            .on('click', '.cs-modal-x, .cs-modal-cancel, .cs-modal-bg', () => this.deskExit())
            .on('input', '#tc_counted', () => this.paintDiff(this.deskData.turn))
            .on('keydown', '#tc_counted', (e) => {
                if (e.key !== 'Enter') return;

                e.preventDefault();
                this.deskAction('close');
            });

        // Esc lo atiende csModal primero (quita la ventana): si ya no está, se sale igual que con «Volver».
        $(document).off('keydown.ordDesk').on('keydown.ordDesk', (e) => {
            if (e.key !== 'Escape' || $('#modalOrderTurnDesk').length) return;

            this.deskExit();
        });

        this.deskPicker();
        this.deskPending(data.day);
        this.deskPaint(data);
        this.deskList(t.id);

        $('#tc_counted').trigger('focus');
    }

    deskBody(data) {
        const button = (kind, icon, text) => `<button type="button" class="ord-desk-btn is-${kind}" data-desk="${kind}" disabled><i data-lucide="${icon}" class="w-4 h-4"></i>${text}</button>`;
        const mode   = (key, text) => `<button type="button" class="ord-seg${key === this.deskView ? ' is-active' : ''}" data-mode="${key}" aria-pressed="${key === this.deskView}">${text}</button>`;

        return `
            <div class="ord-desk">
                <aside class="ord-desk-side">
                    <div class="ord-desk-field"><span>Sucursal</span><b>${esc(data.branch || '—')}</b></div>
                    <div class="ord-desk-field">
                        <label for="td_date">Fecha</label>
                        <div class="ord-desk-pick"><input type="text" id="td_date" readonly autocomplete="off"><i data-lucide="calendar" class="w-4 h-4"></i></div>
                    </div>
                    <div id="td_pending"></div>
                    <div class="ord-desk-field">
                        <label for="td_turn">Turno</label>
                        <select id="td_turn" class="ord-desk-select"></select>
                    </div>
                    <div id="td_count"></div>
                    <div class="ord-desk-btns">
                        ${button('close', 'lock', 'Cerrar turno')}
                        ${button('print', 'printer', 'Imprimir')}
                    </div>
                </aside>
                <section class="ord-desk-view">
                    <div class="ord-desk-modes">
                        <span>Vista previa de impresión</span>
                        <div class="ord-viewer-modes">${mode('summary', 'Resumido')}${mode('detailed', 'Detallado')}</div>
                    </div>
                    <div id="td_paper" class="ord-viewer-desk ord-desk-paper" aria-label="Vista previa del corte"></div>
                </section>
            </div>`;
    }

    // Calendario de un día, hasta hoy (como alpha). El popup vive en <body>: se borra el de la vez anterior.
    deskPicker() {
        $('.daterangepicker.ord-desk-picker').remove();

        dataPicker({
            parent: 'td_date',
            type:   'simple',
            rangeDefault: {
                singleDatePicker: true,
                showDropdowns:    true,
                autoApply:        true,
                startDate:        moment(this.deskDay, 'YYYY-MM-DD'),
                maxDate:          moment(this.deskToday, 'YYYY-MM-DD'),
                locale: {
                    format:     'DD/MM/YYYY',
                    firstDay:   1,
                    daysOfWeek: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'],
                    monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
                }
            },
            onSelect: (start) => this.deskGo(start.format('YYYY-MM-DD'))
        });

        const dp = $('#td_date').data('daterangepicker');
        if (dp) dp.container.addClass('ord-desk-picker');
    }

    // Días anteriores sin cerrar (como alpha): cada uno lleva el módulo a esa fecha.
    deskPending(day) {
        const pending = (day && day.pending) || [];

        $('#td_pending').html(pending.length ? `
            <div class="ord-desk-alert">
                <p><i data-lucide="triangle-alert" class="w-4 h-4"></i>Días sin cerrar</p>
                ${pending.map((d) => `<button type="button" class="ord-desk-go${d === this.deskDay ? ' is-active' : ''}" data-date="${esc(d)}"><span>${ordDate(d)}</span><i data-lucide="chevron-right" class="w-4 h-4"></i></button>`).join('')}
            </div>` : '');

        if (window.lucide) lucide.createIcons();
    }

    // Otro día: el calendario lo refleja y se piden sus turnos.
    deskGo(date) {
        if (!date || date === this.deskDay) return;

        this.deskDay = date;

        const dp = $('#td_date').data('daterangepicker');

        if (dp) {
            dp.setStartDate(moment(date, 'YYYY-MM-DD'));
            dp.setEndDate(moment(date, 'YYYY-MM-DD'));
        }

        this.deskList(0);
    }

    // Los turnos del día en el selector. keepId: el que se queda elegido; si no está, el más nuevo.
    // force: vuelve a pedir ese turno aunque ya esté pintado (después de cerrarlo).
    async deskList(keepId, force) {
        const request = ++this.deskReq;
        const data    = await useFetch({ url: this._link, data: { opc: 'lsDayTurns', date: this.deskDay } });

        if (request !== this.deskReq || !$('#modalOrderTurnDesk').length) return;

        if (!data || data.status != 200) {
            alert({ icon: 'error', title: 'No se cargaron los turnos', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        this.deskTurns = data.items || [];
        this.deskPending(data.day);

        const pick = this.deskTurns.find((t) => t.id === keepId) || this.deskTurns[0];

        $('#td_turn').html(this.deskTurns.length
            ? this.deskTurns.map((t) => `<option value="${t.id}">${esc(this.deskOption(t))}</option>`).join('')
            : '<option value="">Sin turnos este día</option>');

        if (!pick) return this.deskPaint(null);

        $('#td_turn').val(String(pick.id));

        // El turno con el que abrió la ventana ya está pintado: no se vuelve a pedir (salvo que falte su Detallado).
        const shown = this.deskData && this.deskData.turn && this.deskData.turn.id === pick.id;

        if (shown && !force && (this.deskView !== 'detailed' || this.deskData.shift)) return this.deskButtons();

        this.deskTurn(pick.id);
    }

    deskOption(t) {
        return `Turno ${t.folio} · ${ordHour(String(t.opened_at || '').slice(11, 16))} · ${t.closed ? 'Cerrado' : 'Abierto'}`;
    }

    async deskTurn(id) {
        if (!id) return;

        const request = ++this.deskReq;

        $('#td_paper').addClass('is-loading');

        // shift: el Detallado viene siempre, así cambiar de modo no vuelve a pedir nada.
        const data = await useFetch({ url: this._link, data: { opc: 'getTurn', id: id, shift: 1 } });

        if (request !== this.deskReq || !$('#modalOrderTurnDesk').length) return;

        $('#td_paper').removeClass('is-loading');

        if (!data || data.status != 200) {
            alert({ icon: 'error', title: 'No se abrió el turno', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        this.deskPaint(data);
    }

    // El ticket del turno elegido, el efectivo contado (solo si se puede cerrar) y los botones.
    deskPaint(data) {
        const t = data ? data.turn : null;

        this.deskData = data;

        if (data) this.deskCan = data.can;

        this.deskPaper();

        // El campo se pinta una vez por turno: repintar el ticket (modo, recarga) no borra lo escrito.
        const count = t && !t.closed && data.can.close ? t.id : 0;

        if (count !== this.deskCountId) {
            $('#td_count').html(count ? this.deskCount(t) : '');
            this.deskCountId = count;
        } else if (count) {
            $('#tc_expected').text(money(t.expected_cash));
            this.paintDiff(t);
        }

        this.deskButtons();

        if (window.lucide) lucide.createIcons();
    }

    deskPaper() {
        const data = this.deskData;

        $('#td_paper').html(data && data.turn
            ? `<article class="ord-ticket">${this.cutTicket(data, this.deskView === 'detailed')}</article>`
            : '<div class="ord-viewer-empty"><i data-lucide="clock" class="w-7 h-7"></i><p>No hay turnos para esta fecha.</p></div>');
    }

    // Esperado arriba, el campo (opcional) y la diferencia en vivo (paintDiff). Un turno de otro día lo avisa.
    deskCount(t) {
        const old = t.old ? '<p class="ord-desk-warn">Turno de otro día: ciérralo para seguir capturando y cobrando.</p>' : '';

        return `${old}
            <div class="ord-desk-count">
                <div class="ord-cut-row is-strong"><span>Esperado</span><b id="tc_expected" class="ord-cut-v">${money(t.expected_cash)}</b></div>
                <div class="ord-cut-row is-strong"><label for="tc_counted">Contado</label><input type="number" id="tc_counted" class="ord-cut-input" min="0" step="0.01" placeholder="Opcional" inputmode="decimal" autocomplete="off"></div>
                <div class="ord-cut-row"><span>Diferencia</span><b id="tc_diff_box" class="ord-cut-v is-muted">—</b></div>
            </div>`;
    }

    // Cada botón según el turno elegido y lo que deja el ctrl (can). El motivo de uno apagado va en su title.
    deskButtons() {
        const data = this.deskData;
        const t    = data ? data.turn : null;
        const can  = this.deskCan || {};

        const set = (kind, on, why) => {
            $(`#modalOrderTurnDesk button[data-desk="${kind}"]`).prop('disabled', !on).attr('title', on ? '' : why);
        };

        set('close', Boolean(t && !t.closed && can.close), !t ? 'No hay turno elegido.' : t.closed ? 'Este turno ya se cerró.' : 'Tu rol no puede cerrar turnos.');
        set('print', Boolean(t) && orders.can('print'), !t ? 'No hay turno elegido.' : 'Tu rol no puede imprimir cortes.');
    }

    deskAction(kind) {
        const data = this.deskData;

        if (!data || !data.turn || $(`#modalOrderTurnDesk button[data-desk="${kind}"]`).prop('disabled')) return;

        if (kind === 'close') return this.saveClose(data.turn);
        if (kind === 'print') return this.printCut(data, this.deskView === 'detailed');
    }

    // Resumido | Detallado, como alpha. El turno con el que abrió la ventana no trae el Detallado: se pide.
    deskMode(mode) {
        this.deskView = mode === 'detailed' ? 'detailed' : 'summary';

        $('#modalOrderTurnDesk button.ord-seg').each((i, el) => {
            const on = $(el).attr('data-mode') === this.deskView;

            $(el).toggleClass('is-active', on).attr('aria-pressed', String(on));
        });

        const data = this.deskData;

        if (!data || !data.turn) return;
        if (this.deskView === 'detailed' && !data.shift) return this.deskTurn(data.turn.id);

        this.deskPaper();
    }

    // Venía de un cobro frenado por un turno viejo: al salir con ese turno ya cerrado, sigue con el de hoy.
    deskExit() {
        $(document).off('keydown.ordDesk');

        const next = this.deskClosed ? this.afterOpen : null;

        this.deskClosed = false;

        if (!next) return;

        this.afterOpen = null;
        this.open(0, { afterOpen: next });
    }

    // -- Corte --

    // El corte de un turno CERRADO (Cortes, Cierre del día, «Ver corte»): reabrir y recalcular viven aquí.
    // Un turno abierto no llega: open() lo manda al módulo de alpha (desk).
    cut(data) {
        const t        = data.turn;
        const reopen   = data.can.reopen;
        const canPrint = orders.can('print');

        this.token = ordToken();

        const modal = this.csModal({
            id:         'modalOrderTurn',
            title:      `Turno ${t.folio}`,
            subtitle:   'Corte Z · el turno ya se cerró',
            lucideIcon: 'calculator',
            width:      'max-w-4xl',
            saveText:   reopen ? 'Reabrir turno' : false,
            cancelText: 'Volver',
            json: [
                { id: 'tc_head', tipo: 'html', class: 'w-full', html: this.head(this.turnHead(t, data.branch)) },
                { id: 'tc_boxes', tipo: 'html', class: 'w-full', html: this.cols([this.methodsBox(t.methods, t.collected), this.cashBox(t), this.salesBox(t)]) },
                { id: 'tc_statuses', tipo: 'html', class: 'w-full', html: this.statusGrid(t.statuses, t.total_sales, Number(t.orders_count) + Number(t.sales_count), 'Sin pedidos en este turno.') },
                ...this.turnAlerts(t, data.can),
                ...this.reopens(t)
            ],
            onSave: (values, close) => this.reopenForm(t, close)
        });

        $('#modalOrderTurn .cs-modal-title').after(this.badges(t));

        this.softFoot('#modalOrderTurn', canPrint ? { text: 'Imprimir corte Z', onClick: () => this.printCut(data) } : null);

        $('#modalOrderTurn').on('click', 'button.ord-recalc', () => this.recalc(t, modal));

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

    cashBox(t) {
        let rows = this.line('Fondo inicial', money(t.opening_cash))
                 + this.line('+ Cobrado en efectivo', money(t.cash_sales))
                 + this.line('Efectivo esperado', money(t.expected_cash), 'is-total');

        if (t.closed) {
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

    /*  Lo contado vive en el panel del módulo (desk) y es opcional, como en
        alpha: vacío cierra sin contar (el ctrl guarda lo esperado). La ventana
        sigue abierta debajo de la confirmación («Revisar» regresa al campo) y
        también después de cerrar: el ticket pasa a Cerrado y «Cerrar turno»
        se apaga. Para salir, «Volver». */
    async saveClose(t) {
        if (this.saving) return;

        const raw     = String($('#tc_counted').val() || '').trim();
        const counted = raw === '' ? null : ordAmount(raw);

        if (raw !== '' && counted === null) return this.warn('El efectivo contado no es una cantidad válida.');

        const head = counted === null
            ? this.closeBlind()
            : this.closeDiff(this.diffTone(ordRound(counted - Number(t.expected_cash))));

        // SweetAlert regresa el foco a lo que lo tenía al abrir: así «Revisar» deja el cursor en el campo.
        $('#tc_counted').trigger('focus');

        const sure = await alert({
            icon:     'question',
            title:    `¿Cerrar el turno ${t.folio}?`,
            html:     head
                    + this.closeRows(t, counted)
                    + '<p class="ord-close-note">Después del corte ya no se capturan ni se cobran pedidos en este turno.</p>',
            btn1Text: 'Sí, cerrar turno',
            btn2Text: 'Revisar'
        });

        if (!sure || !sure.isConfirmed) return;

        const data = await this.send('#modalOrderTurnDesk', { opc: 'closeTurn', id: t.id, counted_cash: counted === null ? '' : counted, token: this.token }, 'No se cerró el turno');
        if (!data) return;

        // send() vuelve a encender el botón: el turno ya no se cierra ni se cuenta otra vez.
        $('#modalOrderTurnDesk button[data-desk="close"]').prop('disabled', true).attr('title', 'Este turno ya se cerró.');
        $('#td_count').empty();

        this.deskCountId = 0;
        this.deskClosed  = true;
        this.token       = ordToken();

        this.sync(data.brief, true);

        // El selector y el ticket del mismo turno, ya cerrado (sello Cerrado, contado y diferencia).
        this.deskList(t.id, true);

        alert({
            icon:  'success',
            title: `Turno ${t.folio} cerrado`,
            html:  data.counted ? this.closeDiff(this.diffTone(Number(data.difference))) : this.closeBlind(),
            timer: 2200
        });
    }

    // La diferencia en grande, con el color de diffTone: verde cuadra, ámbar sobra, rojo falta.
    closeDiff(tone) {
        return `<div class="ord-close-diff is-${tone.tone}"><span>Diferencia en caja</span><b>${tone.text}</b></div>`;
    }

    // Sin contar no hay diferencia: se dice qué queda guardado.
    closeBlind() {
        return '<div class="ord-close-diff is-blind"><span>Sin contar la caja</span><b>Se guarda lo esperado</b></div>';
    }

    // Las cifras que explican la diferencia, una por renglón con el importe a la derecha.
    closeRows(t, counted) {
        const row = (label, value) => `<div class="ord-close-row"><span>${label}</span><b>${value}</b></div>`;

        return `<div class="ord-close-rows">${row('Esperado en caja', money(t.expected_cash))}${row('Efectivo contado', counted === null ? 'Sin contar' : money(counted))}${row('Total cobrado', money(t.collected))}</div>`;
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

    // El papel del ticket con sus propios estilos (ORD_SHIFT_CSS). detail = modo Detallado.
    printCut(data, detail) {
        const t     = data.turn;
        const title = t.closed ? 'Corte Z' : 'Corte X';
        const css   = '@page { margin: 4mm; } html, body { margin: 0; background: #FFFFFF; } body { width: 300px; margin: 0 auto; }' + ORD_SHIFT_CSS;

        ordPrintDoc(`${title} turno ${t.folio}`, css, this.cutTicket(data, detail));
    }

    // Los estilos del ticket una sola vez en <head> para la vista previa (módulo y visor de Cortes).
    shiftCss() {
        if (!document.getElementById('ordShiftCss')) $('<style>', { id: 'ordShiftCss' }).text(ORD_SHIFT_CSS).appendTo('head');
    }

    /*  El ticket «Cierre x turno» de alpha (alpha/pedidos › shift-ticket.js),
        renglón por renglón: logo, empresa, sucursal, sello Cerrado / En curso,
        quién y cuándo abrió, formas de pago, total de caja, pedidos por estado y
        abonos de pedidos anteriores. Detallado (detail y data.shift) suma los
        pedidos del turno, los abonos con Debía · Abonó · Quedó y lo cobrado en
        otra sucursal. Suma lo que alpha no tenía: turno, quién cerró, esperado,
        contado y diferencia, y las reaperturas. Lo usan el módulo de cierre,
        printCut y el visor de Cortes. */
    cutTicket(data, detail) {
        this.shiftCss();

        const t       = data.turn;
        const company = data.company || data.branch || '';
        const initial = esc(String(company || 'H').charAt(0).toUpperCase());
        const shift   = detail && data.shift ? data.shift : null;
        const dash    = (v) => Math.abs(Number(v)) >= 0.005 ? money(v) : '-';
        const row     = (a, b, cls) => `<div class="sh-row${cls ? ' ' + cls : ''}"><span>${a}</span><span>${b}</span></div>`;

        // Sin logo, o si la imagen no carga, el círculo con la inicial (como alpha).
        const logo = data.logo
            ? `<div class="sh-logo"><img src="${esc(data.logo)}" alt="" onerror="this.parentNode.className='sh-logo sh-none'"><span>${initial}</span></div>`
            : `<div class="sh-logo sh-none"><span>${initial}</span></div>`;

        const branch = data.branch && data.branch !== company ? `<div class="sh-branch">${esc(data.branch)}</div>` : '';
        const stamp  = t.closed ? '<div class="sh-tag sh-closed">CERRADO</div>' : '<div class="sh-tag sh-live">EN CURSO</div>';

        // Formas de pago en mayúsculas, como alpha. Efectivo sale siempre, aunque no haya cobros.
        const methods = (t.methods || []).slice();

        if (!methods.some((m) => Number(m.is_cash) === 1)) methods.unshift({ name: 'Efectivo', amount: 0 });

        const pays = methods.map((m) => row(`${esc(String(m.name || 'Sin método').toUpperCase())}:`, dash(m.amount), 'sh-b')).join('');

        // Lo de caja que alpha no tenía. Contado y diferencia, solo con el turno cerrado.
        const counted = t.closed ? Number(t.counted_cash) : null;
        const cash    = row('EFECTIVO ESPERADO:', money(t.expected_cash), 'sh-b')
            + (counted === null ? '' : row('CONTADO:', money(counted), 'sh-b') + row('DIFERENCIA:', this.diffTone(ordRound(counted - Number(t.expected_cash))).text, 'sh-b'));

        // Conteo por estado de todo lo creado en el turno. Un corte cuya foto cambió no guarda conteos: guion.
        const count = (id) => {
            const s = (t.statuses || []).find((x) => Number(x.id) === id);

            return s && s.orders !== null ? Number(s.orders) : 0;
        };

        const created = [1, 2, 3, 4].reduce((sum, id) => sum + count(id), 0);
        const prev    = t.prev || {};

        const prevLine = Number(prev.orders) > 0 ? `
            <hr>
            ${row('ABONOS DE PED. ANTERIORES:', Number(prev.orders), 'sh-b')}
            <div class="sh-note">${Number(prev.settled)} liquidado${Number(prev.settled) === 1 ? '' : 's'} · ${Number(prev.pending)} con saldo</div>` : '';

        const reopens = t.reopen_reason
            ? `<hr><div class="sh-title">REAPERTURAS Y RECÁLCULOS</div><div class="sh-sub">${esc(t.reopen_reason).replace(/\n/g, '<br>')}</div>`
            : '';

        return `
            <div class="sh">
                <div class="sh-head">
                    ${logo}
                    <div class="sh-co">${esc(company)}</div>
                    ${branch}
                    <div class="sh-kind">PEDIDOS Y VENTAS</div>
                    <div class="sh-muted">Cierre x Turno</div>
                    ${stamp}
                </div>
                ${row('Turno:', esc(t.folio))}
                ${row('Aperturó:', esc(t.opened_by || 'N/A'))}
                ${row('Apertura:', ordDate(t.opened_at, true))}
                ${t.closed ? row('Cerró:', esc(t.closed_by || 'N/A')) + row('Cierre:', ordDate(t.closed_at, true)) : row('Corte al:', ordNow())}
                ${row('Inicio de caja:', money(t.opening_cash))}
                <hr>
                ${shift ? this.shiftDetail(shift, row, dash) : ''}
                ${pays}
                <hr>
                ${row('TOTAL CAJA:', dash(t.collected), 'sh-b sh-big')}
                <hr>
                ${cash}
                <hr>
                ${row('NÚMERO DE PEDIDOS DEL TURNO:', created || '-', 'sh-b')}
                <div class="sh-gap"></div>
                ${row('PAGADOS:', count(3) || '-', 'sh-b')}
                ${row('PENDIENTES:', count(2) || '-', 'sh-b')}
                ${row('COTIZACIONES:', count(1) || '-', 'sh-b')}
                ${row('CANCELADOS:', count(4) || '-', 'sh-b')}
                ${prevLine}
                ${reopens}
                <div class="sh-foot">
                    <div>GRACIAS POR SU PREFERENCIA</div>
                    <div class="sh-brand">Huubie</div>
                    <div class="sh-stamp">Generado: ${ordNow()}</div>
                </div>
            </div>`;
    }

    // Las tres partes del Detallado de alpha. Cada una sale solo si tiene algo.
    shiftDetail(shift, row, dash) {
        const sum    = (list, key) => list.reduce((total, x) => total + Number(x[key] || 0), 0);
        const orders = shift.orders || [];
        const prev   = shift.prev || [];
        const cross  = shift.cross || [];
        let html     = '';

        // 1. Pedidos y ventas del turno: total y lo que se cobró de cada uno en este turno.
        if (orders.length) {
            html += `
                <div class="sh-title">PEDIDOS DEL TURNO</div>
                <div class="sh-cols sh-th"><span>FOLIO</span><span>TOTAL</span><span>ABONO</span></div>
                ${orders.map((o) => `
                    <div class="sh-cols"><b>${esc(o.folio)}</b><span>${money(o.total)}</span><span class="sh-green">${dash(o.paid)}</span></div>
                    <div class="sh-sub">${esc(o.customer || (o.order ? 'Sin cliente' : 'Mostrador'))}</div>`).join('')}
                ${row('TOTAL PEDIDOS', money(sum(orders, 'total')), 'sh-sum')}
                ${row('COBRADO EN TURNO', money(sum(orders, 'paid')), 'sh-green')}
                <hr>`;
        }

        // 2. Abonos a pedidos de otros turnos: cuánto debía, cuánto abonó aquí y cuánto quedó.
        if (prev.length) {
            html += `
                <div class="sh-title">ABONOS DE PEDIDOS ANTERIORES</div>
                ${prev.map((o) => `
                    <div class="sh-prev">
                        <div class="sh-row"><span>${esc(o.folio)}</span>${Number(o.left) <= 0 ? '<span class="sh-badge sh-ok">LIQUIDADO</span>' : '<span class="sh-badge sh-due">PENDIENTE</span>'}</div>
                        <div class="sh-sub">${esc(o.customer || 'Sin cliente')}</div>
                        ${o.origin ? `<div class="sh-sub">Origen: ${esc(o.origin)}</div>` : ''}
                        ${row('Debía', `${money(o.owed)} <small>de ${money(o.total)}</small>`, 'sh-sm')}
                        ${row('Abonó', money(o.paid), 'sh-sm sh-green')}
                        ${row('Quedó', money(o.left), 'sh-sm sh-sum')}
                    </div>`).join('')}
                ${row('TOTAL COBRADO', money(sum(prev, 'paid')), 'sh-sum sh-green')}
                <hr>`;
        }

        // 3. Lo que otra sucursal cobró de pedidos de este turno: no entra a esta caja.
        if (cross.length) {
            html += `
                <div class="sh-cross">
                    <div class="sh-b">COBRADO EN OTRA SUCURSAL</div>
                    <div class="sh-sub">No entra a tu caja (informativo).</div>
                    ${cross.map((o) => `
                        <div class="sh-cols"><b>${esc(o.folio)}</b><span>${money(o.amount)}</span></div>
                        <div class="sh-sub">${esc(o.customer || 'Sin cliente')} · Cobrado en: ${esc(o.branch || 'Otra sucursal')}</div>`).join('')}
                    ${row('Total en otra sucursal', money(sum(cross, 'amount')), 'sh-sum')}
                </div>
                <hr>`;
        }

        return html;
    }

    // Cada pedido y cada cobro, uno por renglón. other = el texto para un abono de fuera.
    detailTicket(detail, other) {
        const sales    = detail.sales || [];
        const payments = detail.payments || [];
        const hour     = (at) => ordHour(String(at || '').slice(11, 16));
        const line     = (a, sub, b, off) => `<tr${off ? ' class="x"' : ''}><td>${a}<span class="s d">${sub}</span></td><td class="r">${b}</td></tr>`;

        const saleRows = sales.length
            ? sales.map((s) => line(
                `${esc(s.folio)} ${esc(s.customer || (s.order ? 'Sin cliente' : 'Mostrador'))}`,
                `${esc(s.status)} · ${hour(s.at)}`,
                money(s.total),
                [1, 4].includes(Number(s.status_id))
            )).join('')
            : line('Sin pedidos', '', money(0));

        const payRows = payments.length
            ? payments.map((p) => line(
                `${hour(p.at)} · ${esc(p.method)}`,
                `${p.folio ? `${esc(p.folio)} ` : ''}${esc(p.customer || 'Sin cliente')}${p.other ? ` · ${other}` : ''}`,
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

        // .cs-modal-save en csModal; .cf-confirm en createCoffeeModalForm (abrir turno); data-desk en el módulo.
        const button = $(`${modal} .cs-modal-save, ${modal} .cf-confirm, ${modal} button[data-desk="close"]`).prop('disabled', true);
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
            $(`${modal} .cs-modal-save, ${modal} .cf-confirm`).first().trigger('click');
        });
    }

    warn(text) {
        alert({ icon: 'warning', title: 'Falta un dato', text: text, btn1: true, btn1Text: 'Entendido' });
    }
}
