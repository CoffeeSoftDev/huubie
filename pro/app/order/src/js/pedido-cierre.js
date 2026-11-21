/*  Pedidos › cierre del día: el «Cierre del Día» de alpha, sin turnos.

    A la izquierda la sucursal, la fecha (con su sello y quién cerró), los
    días anteriores sin cerrar, Imprimir y, aparte abajo, «Cerrar día» o
    «Reabrir día». A la derecha el Corte Z de alpha (pedidos-cierre.js ›
    renderExecutiveSummary): una hoja carta con el desglose por turno, los
    cobros cruzados, las cotizaciones, el corte de caja por turno y el resumen
    del día. Es el mismo papel que se imprime y que enseña el visor de Cortes.
    La fecha se cambia sin cerrar la ventana; al cerrar o reabrir, se repinta.

    Lo abren «Cierre del día» (franja de caja, Cortes, Historial) y el aviso
    del turno cuando el día ya se cerró o falta cerrar uno anterior.

    Quién puede lo decide el ctrl en data.can: cerrar = create; reabrir = solo
    root (can.root). Las preguntas van con el alertBox (orderTurn.ask).
    Un día sin cerrar llega sin Corte Z a quien no es Dueño (data.hidden, como
    alpha): la hoja dice por qué y no se imprime hasta cerrarlo. */

/*  El Corte Z de alpha (pdfBaseCss): monocromo tipo POS, negro sobre blanco y
    bandas grises. Va en un iframe (paintReport) y en la hoja de impresión:
    así dark-mode.css y compact.css, que pisan toda celda con !important, no lo tocan. */
const ORD_DAY_CSS = `
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #FFFFFF; }
    .z-doc { width: 100%; padding: 24px 26px; background: #FFFFFF; color: #000000; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-size: 9px; line-height: 1.3; }
    .z-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #9CA3AF; }
    .z-head h2 { margin: 0 0 3px; font-size: 22px; font-weight: 700; line-height: 1; white-space: nowrap; }
    .z-meta { font-size: 10px; line-height: 1.35; }
    .z-meta b { font-weight: 600; }
    .z-right { text-align: right; }
    .z-banner { margin-bottom: 12px; padding: 6px 10px; border: 2px dashed #000000; text-align: center; font-size: 10px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; }
    .z-sec { margin-top: 16px; }
    .z-sec-title { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 4px 8px; background: #9CA3AF; font-size: 10px; font-weight: 700; letter-spacing: .6px; text-transform: uppercase; }
    .z-sec-title small { font-size: 10px; font-weight: 400; letter-spacing: 0; text-transform: none; }
    .z-subhead { padding: 2px 8px; border-bottom: 1px solid #9CA3AF; font-size: 9px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; }
    .z-wrap { overflow-x: auto; }
    table.z-table { width: 100%; border-collapse: collapse; font-size: 9px; }
    table.z-table th { padding: 4px 8px; background: #9CA3AF; font-size: 9px; font-weight: 700; letter-spacing: .3px; text-align: left; text-transform: uppercase; }
    table.z-table.is-sub th { background: #F3F4F6; border-bottom: 1px solid #9CA3AF; }
    table.z-table td { padding: 2px 8px; border-bottom: 1px solid #D1D5DB; vertical-align: top; }
    table.z-table .r { text-align: right; white-space: nowrap; }
    table.z-table .c { text-align: center; }
    table.z-table td.z-net { background: #D1D5DB; font-weight: 600; }
    .z-folio { font-weight: 600; white-space: nowrap; }
    .z-nw { white-space: nowrap; }
    .z-small { margin-top: 1px; font-size: 8px; line-height: 1; }
    .z-grey { color: #9CA3AF; font-weight: 400; }
    .z-struck { color: #9CA3AF; font-size: 8px; font-weight: 400; text-decoration: line-through; }
    .z-note { margin-top: 1px; font-size: 8px; font-weight: 700; line-height: 1; }
    .z-state { font-size: 8px; font-weight: 700; letter-spacing: .3px; text-transform: uppercase; }
    tr.z-shift td { padding: 2px 8px; background: #9CA3AF; font-size: 8px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; }
    tr.z-div td { padding: 2px 8px; border-top: 1px solid #9CA3AF; border-bottom: 1px solid #9CA3AF; background: #E5E7EB; font-size: 8px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; }
    tr.z-total td { padding: 6px 8px; border-bottom: 0; font-size: 9px; font-weight: 700; }
    tr.z-total td:first-child { text-align: right; text-transform: uppercase; font-size: 8px; }
    tr.z-total td.r { border-top: 1px solid #9CA3AF; }
    tr.z-empty td { padding: 9px; text-align: center; font-style: italic; }
    tr.z-row { cursor: pointer; }
    tr.z-row:hover td { background: #EEF2FF; }
    .z-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 12px; }
    .z-card { overflow: hidden; border: 1px solid #9CA3AF; border-radius: 2px; }
    .z-card-title { padding: 4px 8px; border-bottom: 1px solid #9CA3AF; background: #F3F4F6; font-size: 9px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; }
    .z-card-sub { padding: 2px 8px; border-bottom: 1px solid #D1D5DB; font-size: 8px; }
    .z-kv { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 2px 8px; border-bottom: 1px solid #D1D5DB; font-size: 9px; }
    .z-kv:last-child { border-bottom: 0; }
    .z-kv span:last-child { text-align: right; white-space: nowrap; }
    .z-kv.is-hl { background: #D1D5DB; font-weight: 700; }
    .z-kv.is-total { padding: 4px 8px; border-top: 1px solid #9CA3AF; font-weight: 700; }
    .z-notes { padding: 4px 8px; font-size: 9px; }
    .z-notes div + div { margin-top: 3px; }
    .z-foot { display: flex; justify-content: space-between; margin-top: 16px; padding-top: 6px; border-top: 1px solid #9CA3AF; font-size: 9px; }
    @media (max-width: 640px) { .z-cards { grid-template-columns: minmax(0, 1fr); } }
    @media print {
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .z-doc { padding: 12px; }
        .z-wrap { overflow: visible; }
        table.z-table { table-layout: fixed; }
        table.z-table td, table.z-table th { overflow-wrap: break-word; word-break: break-word; }
        table.z-table .r { white-space: normal; }
        .z-cards { page-break-inside: avoid; }
        tr.z-shift, tr.z-div { page-break-after: avoid; }
        tr.z-row:hover td { background: inherit; }
    }`;

/*  Solo en pantalla (paintReport): la hoja de alpha (pdfBaseCss › .pdf-document)
    sobre el fondo de la página, con su sombra y esquinas casi rectas. El iframe
    queda transparente y .z-zoom lleva el zoom (el #reportZoomWrap de alpha): al
    alejar, la hoja se encoge y queda centrada; al acercar, el texto crece y la
    hoja vuelve a acomodarse al ancho. La impresión no lleva nada de esto. */
const ORD_DAY_SCREEN_CSS = `
    html, body { background: transparent; }
    html { overflow-y: hidden; }
    body { padding: 2px 14px 18px; }
    .z-doc { max-width: 1100px; margin: 0 auto; border-radius: 2px; box-shadow: 0 2px 12px rgba(0, 0, 0, .35); }`;

// -- Cierre del día --

class OrderClosure extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'OrderClosure';
        this.loading      = false;
        this.saving       = false;
        this.token        = '';
        this.afterClose   = null;
        this.deskData     = null;
        this.deskDay      = '';
        this.deskToday    = '';
        this.deskReq      = 0;
        this.deskClosed   = false;
        this.zoom         = 100;    // zoom del Corte Z en pantalla (como alpha: 50–150 %); lo comparten el módulo y el visor
    }

    // -- Entrada --

    // Sin fecha abre hoy. opts.afterClose: lo que sigue tras cerrar un día anterior (abrir turno y volver al cobro).
    async open(date, opts = {}) {
        $('ul.ct3-dropdown-menu').addClass('hidden');

        if (this.loading) return;

        this.afterClose = (opts && opts.afterClose) || null;
        this.loading    = true;

        const data = await this.fetchDay(date);

        this.loading = false;

        if (data) this.desk(data);
    }

    // report: el Corte Z del día (lo pide la cajera, con 'show' de Pedidos).
    async fetchDay(date) {
        const data = await useFetch({ url: this._link, data: { opc: 'getDay', date: date || '', report: 1 } });

        if (!data || data.status != 200) {
            alert({ icon: 'error', title: 'No se abrió el cierre del día', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
            return null;
        }

        orderTurn.sync(data.brief, false, data.day);

        return data;
    }

    // -- Módulo --

    desk(data) {
        this.deskDay    = data.date;
        this.deskToday  = data.today;
        this.deskReq    = 0;
        this.deskData   = null;
        this.deskClosed = false;
        this.token      = ordToken();

        // Más ancha que antes: el Corte Z es una hoja carta, no un ticket.
        this.csModal({
            id:         'modalOrderClosure',
            title:      'Cierre del día',
            subtitle:   data.branch || '',
            lucideIcon: 'calendar-check',
            width:      'max-w-6xl',
            saveText:   false,
            cancelText: 'Volver',
            body:       this.deskBody(data)
        });

        $('#modalOrderClosure')
            .on('click', 'button.ord-desk-go', (e) => this.deskGo(String($(e.currentTarget).attr('data-date'))))
            .on('click', 'button[data-day]', (e) => this.deskAction(String($(e.currentTarget).attr('data-day'))))
            .on('click', '.cs-modal-x, .cs-modal-cancel, .cs-modal-bg', () => this.deskExit());

        // Esc lo atiende csModal primero (quita la ventana): si ya no está, se sale igual que con «Volver».
        $(document).off('keydown.ordDayDesk').on('keydown.ordDayDesk', (e) => {
            if (e.key !== 'Escape' || $('#modalOrderClosure').length) return;

            this.deskExit();
        });

        this.deskPicker();
        this.deskPaint(data);
    }

    deskBody(data) {
        return `
            <div class="ord-desk">
                <aside class="ord-desk-side">
                    <div class="ord-desk-field"><span>Sucursal</span><b>${esc(data.branch || '—')}</b></div>
                    <div class="ord-desk-field">
                        <div class="ord-desk-head"><label for="dc_date">Fecha</label><span id="dc_state"></span></div>
                        <div class="ord-desk-pick"><input type="text" id="dc_date" readonly autocomplete="off"><i data-lucide="calendar" class="w-4 h-4"></i></div>
                        <p id="dc_by" class="ord-desk-by"></p>
                    </div>
                    <div id="dc_pending"></div>
                    <div id="dc_why"></div>
                    <div class="ord-desk-btns">
                        <button type="button" class="ord-desk-btn is-print" data-day="print" disabled><i data-lucide="printer" class="w-4 h-4"></i>Imprimir</button>
                    </div>
                    <div id="dc_action" class="ord-desk-day"></div>
                </aside>
                <section class="ord-desk-view">
                    <div class="ord-desk-modes">
                        <span>Vista previa de impresión · Corte Z (hoja carta)</span>
                    </div>
                    <div id="dc_paper" class="ord-viewer-desk ord-desk-paper" aria-label="Vista previa del cierre"></div>
                </section>
            </div>`;
    }

    // Calendario de un día, hasta hoy (como alpha). El popup vive en <body>: se borra el de la vez anterior.
    deskPicker() {
        $('.daterangepicker.ord-dc-picker').remove();

        dataPicker({
            parent: 'dc_date',
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

        const dp = $('#dc_date').data('daterangepicker');
        if (dp) dp.container.addClass('ord-dc-picker');
    }

    // Otro día: el calendario lo refleja y se pide su cierre sin cerrar la ventana.
    deskGo(date) {
        if (!date || date === this.deskDay) return;

        this.deskDay = date;

        const dp = $('#dc_date').data('daterangepicker');

        if (dp) {
            dp.setStartDate(moment(date, 'YYYY-MM-DD'));
            dp.setEndDate(moment(date, 'YYYY-MM-DD'));
        }

        this.deskLoad();
    }

    // Vuelve a pedir el día que se ve: al cambiar de fecha, al cerrar y al reabrir.
    async deskLoad() {
        const request = ++this.deskReq;

        $('#dc_paper').addClass('is-loading');

        const data = await useFetch({ url: this._link, data: { opc: 'getDay', date: this.deskDay, report: 1 } });

        if (request !== this.deskReq || !$('#modalOrderClosure').length) return;

        $('#dc_paper').removeClass('is-loading');

        if (!data || data.status != 200) {
            alert({ icon: 'error', title: 'No se cargó el día', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
            return;
        }

        orderTurn.sync(data.brief, false, data.day);

        this.deskPaint(data);
    }

    // El sello y quién cerró, los días pendientes, por qué no se puede, los botones y el ticket.
    deskPaint(data) {
        const c     = data.closure;
        const state = this.state(data);
        const why   = this.reason(data);
        const print = orders.can('print') && (data.closed || data.turns.length > 0) && !data.hidden;

        this.deskData = data;

        $('#dc_state').html(state ? `<span class="ord-desk-badge is-${state.tone}">${state.text}</span>` : '');
        $('#dc_by').html(c ? `Por: <b>${esc(c.closed_by || '—')}</b> — ${ordDate(c.closed_at, true)}` : '');
        $('#modalOrderClosure .ord-desk-pick').toggleClass('is-closed', !!data.closed);

        this.deskPending(data);

        $('#dc_why').html(why ? `<p class="ord-desk-warn mb-0">${esc(why)}</p>` : '');
        $('#dc_action').html(this.dayButton(data));

        $('#modalOrderClosure button[data-day="print"]')
            .prop('disabled', !print)
            .attr('title', print ? '' : !orders.can('print') ? 'Tu rol no puede imprimir cortes.' : data.hidden ? 'El Corte Z se imprime al cerrar el día.' : 'No hubo operación este día.');

        this.deskPaper();

        if (window.lucide) lucide.createIcons();
    }

    // El sello junto a «Fecha»: Cerrado, En curso (hoy), Por cerrar (un día anterior) o nada si no hubo operación.
    state(data) {
        if (data.closed)              return { tone: 'closed', text: 'Cerrado' };
        if (!data.turns.length)       return null;
        if (data.date === data.today) return { tone: 'live', text: 'En curso' };

        return { tone: 'wait', text: 'Por cerrar' };
    }

    // Días anteriores sin cerrar (como alpha): cada uno lleva el módulo a esa fecha.
    deskPending(data) {
        const pending = data.pending || [];

        $('#dc_pending').html(pending.length ? `
            <div class="ord-desk-alert">
                <p><i data-lucide="triangle-alert" class="w-4 h-4"></i>Días sin cerrar</p>
                <span>Ciérralos antes de operar hoy.</span>
                ${pending.map((p) => `<button type="button" class="ord-desk-go${p.date === this.deskDay ? ' is-active' : ''}" data-date="${esc(p.date)}"><span>${this.weekday(p.date)} ${ordDate(p.date)}</span><i data-lucide="chevron-right" class="w-4 h-4"></i></button>`).join('')}
            </div>` : '');
    }

    // A quien cierra, por qué no se puede (también sin turnos: sin uno cerrado no se cierra);
    // a root, por qué no se reabre. Los avisos van en la pregunta de cerrar.
    reason(data) {
        if (!data.closed && !data.can.close && orders.can('create')) return data.can.close_reason;
        if (data.closed && data.can.root && !data.can.reopen) return data.can.reopen_reason;

        return '';
    }

    // Aparte y abajo, como alpha: «Cerrar día» a quien cierra; con el día cerrado, «Reabrir día» solo a root.
    dayButton(data) {
        const button = (kind, icon, text, on, why) => `<button type="button" class="ord-desk-btn is-${kind}" data-day="${kind}"${on ? '' : ` disabled title="${esc(why)}"`}><i data-lucide="${icon}" class="w-4 h-4"></i>${text}</button>`;

        if (data.closed) {
            return data.can.root
                ? button('reopen', 'rotate-ccw', 'Reabrir día', data.can.reopen, data.can.reopen_reason) + '<p>Solo root · pide el motivo</p>'
                : '';
        }

        if (!orders.can('create')) return '';

        return button('close', 'check-check', 'Cerrar día', data.can.close, data.can.close_reason || 'No se puede cerrar el día.');
    }

    deskPaper() {
        const data = this.deskData;
        const has  = data && (data.closed || data.turns.length > 0);

        if (has && data.hidden) return $('#dc_paper').html(`<div class="ord-viewer-empty"><i data-lucide="eye-off" class="w-7 h-7"></i><p>${esc(data.hidden_reason)}</p></div>`);

        if (has) return this.paintReport($('#dc_paper'), data);

        $('#dc_paper').html('<div class="ord-viewer-empty"><i data-lucide="calendar-x" class="w-7 h-7"></i><p>No hubo operación este día.</p></div>');
    }

    deskAction(kind) {
        const data = this.deskData;

        if (!data || this.saving || $(`#modalOrderClosure button[data-day="${kind}"]`).prop('disabled')) return;

        if (kind === 'close')  return this.saveClose(data);
        if (kind === 'reopen') return this.saveReopen(data);
        if (kind === 'print')  return this.printDay(data);
    }

    // Venía de un cobro frenado por un día pendiente: al salir con ese día ya cerrado, sigue con el turno de hoy.
    deskExit() {
        $(document).off('keydown.ordDayDesk');

        const next = this.deskClosed ? this.afterClose : null;

        this.deskClosed = false;

        if (!next) return;

        this.afterClose = null;
        orderTurn.open(0, { afterOpen: next });
    }

    // 'AAAA-MM-DD' -> 'Viernes'. En UTC para no cruzar zonas.
    weekday(date) {
        const [y, m, d] = String(date).split('-').map(Number);

        return ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    }

    // -- Cerrar --

    // La pregunta de alpha («¿Deseas cerrar el día?») con las cifras, los avisos y la nota opcional.
    async saveClose(data) {
        // Cuentas de Ventas o un pedido abiertos: primero se cierran (orderTurn.busyWarn avisa).
        // Las de un día que ya pasó se descartan al cerrarlo: no pasan al día siguiente.
        if (await orderTurn.busyWarn('el día', data.date !== data.today)) return;

        const s     = data.summary;
        const today = data.date === data.today;
        const warns = data.warnings || [];
        const row   = (a, b) => `<span class="ord-ask-row"><span>${a}</span><b>${b}</b></span>`;

        const answer = await orderTurn.ask({
            id:               'ordAskCloseDay',
            icon:             'power',
            tone:             'amber',
            title:            `¿Cerrar el día ${ordDate(data.date)}?`,
            detailHtml:       '<span class="ord-ask">'
                            + `<span class="ord-ask-lead">Se guarda lo vendido y lo cobrado del día${today ? '; hoy ya no se captura ni se cobra' : ''}.</span>`
                            + '<span class="ord-ask-card">'
                            + row('Vendido', money(s.total))
                            + row('Cobrado', money(s.collected))
                            + row('Efectivo', money(s.cash))
                            + row('Pedidos · Mostrador', `${Number(s.orders_count)} · ${Number(s.sales_count)}`)
                            + '</span>'
                            + (warns.length ? `<span class="ord-ask-warn">${warns.map(esc).join('<br>')}</span>` : '')
                            + '<span class="ord-ask-foot">Para corregir algo, solo root lo reabre.</span>'
                            + '</span>',
            input:            'textarea',
            inputLabel:       'Nota del cierre (opcional)',
            inputPlaceholder: 'Ej. El efectivo se entregó a Dirección',
            inputValidator:   (value) => value.length > 255 ? 'La nota admite hasta 255 caracteres.' : '',
            okLabel:          'Sí, cerrar el día',
            cancelLabel:      'No, seguir operando'
        });

        if (!answer.ok) return;

        const res = await this.send('close', { opc: 'closeDay', date: data.date, note: answer.value, token: this.token }, 'No se cerró el día');
        if (!res) return;

        // Token nuevo: reabrir y volver a cerrar en la misma ventana no repite la respuesta guardada.
        this.token      = ordToken();
        this.deskClosed = !today;

        orderTurn.sync(res.brief, true, res.day);

        alert({ icon: 'success', title: res.message, timer: 2200 });

        this.deskLoad();
    }

    // -- Reabrir (solo root) --

    async saveReopen(data) {
        const c = data.closure;

        const answer = await orderTurn.ask({
            id:               'ordAskReopenDay',
            icon:             'rotate-ccw',
            tone:             'amber',
            title:            `¿Reabrir el día ${ordDate(data.date)}?`,
            detailHtml:       `<span class="ord-ask"><span class="ord-ask-lead">Cerrado ${ordDate(c.closed_at, true)}${c.closed_by ? ' por ' + esc(c.closed_by) : ''}. El cierre se rehace cuando se vuelva a cerrar.</span></span>`,
            input:            'textarea',
            inputLabel:       'Motivo de la reapertura',
            inputPlaceholder: 'Ej. Faltó cobrar el anticipo de un pastel',
            inputRequired:    true,
            inputError:       'Escribe por qué se reabre el día.',
            inputValidator:   (value) => value.length > 200 ? 'El motivo admite hasta 200 caracteres.' : '',
            okLabel:          'Reabrir día',
            cancelLabel:      'Cancelar'
        });

        if (!answer.ok) return;

        const res = await this.send('reopen', { opc: 'reopenDay', date: data.date, reason: answer.value }, 'No se reabrió el día');
        if (!res) return;

        this.token      = ordToken();
        this.deskClosed = false;

        orderTurn.sync(res.brief, true, res.day);

        alert({ icon: 'success', title: res.message, timer: 2200 });

        this.deskLoad();
    }

    // -- Impresion --

    // El Corte Z en hoja carta vertical, como alpha (printDaily).
    printDay(data) {
        ordPrintDoc(`Corte Z ${ordDate(data.date)}`, ORD_DAY_CSS + ' @page { size: letter portrait; margin: 8mm; }', this.dayReport(data));
    }

    // -- Corte Z (pantalla) --

    /*  El Corte Z en un iframe con ORD_DAY_CSS: se ve igual que impreso y los
        estilos de la página no lo tocan. Arriba a la derecha, el zoom de alpha
        (reportToolbar): alejar, el porcentaje (vuelve a 100 %), acercar y
        maximizar (130 %). El alto del iframe sigue al contenido (también al
        cambiar el ancho o el zoom). onRow(id): clic en un pedido o venta del
        día (el visor de Cortes abre su ticket); sin él, las filas no se pulsan. */
    paintReport(target, data, onRow) {
        const box = $(target);

        box.html(`
            <div class="ord-z-view">
                <div class="ord-z-tools" role="toolbar" aria-label="Zoom del corte Z">
                    <button type="button" class="ord-z-btn" data-zoom="out" title="Alejar" aria-label="Alejar"><i data-lucide="zoom-out"></i></button>
                    <button type="button" class="ord-z-btn ord-z-pct" data-zoom="reset" title="Restablecer zoom" aria-label="Restablecer zoom">${this.zoom}%</button>
                    <button type="button" class="ord-z-btn" data-zoom="in" title="Acercar" aria-label="Acercar"><i data-lucide="zoom-in"></i></button>
                    <button type="button" class="ord-z-btn ord-z-max" data-zoom="max"></button>
                </div>
                <article class="ord-z-paper" aria-label="Vista previa del corte Z"><iframe class="ord-z-frame" title="Corte Z"></iframe></article>
            </div>`);

        const frame = box.find('iframe.ord-z-frame')[0];

        box.off('click.ordZoom').on('click.ordZoom', 'button[data-zoom]', (e) => {
            const step = { out: this.zoom - 10, in: this.zoom + 10, reset: 100, max: this.zoom > 100 ? 100 : 130 }[$(e.currentTarget).attr('data-zoom')];

            this.zoomTo(box, step);
        });

        this.zoomBar(box);

        frame.addEventListener('load', () => {
            this.fitReport(frame);

            if (onRow) {
                frame.contentDocument.addEventListener('click', (e) => {
                    const row = e.target.closest('tr.z-row');

                    if (row) onRow(Number(row.getAttribute('data-id')));
                });
            }

            if (window.ResizeObserver) new ResizeObserver(() => this.fitReport(frame)).observe(frame);
        });

        frame.srcdoc = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="color-scheme" content="light">'
            + `<style>${ORD_DAY_CSS}${ORD_DAY_SCREEN_CSS}</style></head>`
            + `<body><div class="z-zoom" style="zoom:${this.zoom / 100}">${this.dayReport(data, { clickable: !!onRow })}</div></body></html>`;
    }

    // -- Zoom del Corte Z --

    // 50 % a 150 %, de 10 en 10, como alpha (setReportZoom). Solo la pantalla: la impresión sale al 100 %.
    zoomTo(box, value) {
        this.zoom = Math.min(150, Math.max(50, Number(value) || 100));

        const frame = box.find('iframe.ord-z-frame')[0];
        const wrap  = frame && frame.contentDocument ? frame.contentDocument.querySelector('.z-zoom') : null;

        if (wrap) wrap.style.zoom = String(this.zoom / 100);

        this.zoomBar(box);

        if (frame) this.fitReport(frame);
    }

    // El porcentaje, los topes y el botón de maximizar (minimizar arriba de 100 %).
    zoomBar(box) {
        const maxed = this.zoom > 100;
        const label = maxed ? 'Minimizar' : 'Maximizar';

        box.find('button.ord-z-pct').text(`${this.zoom}%`);
        box.find('button[data-zoom="out"]').prop('disabled', this.zoom <= 50);
        box.find('button[data-zoom="in"]').prop('disabled', this.zoom >= 150);
        box.find('button.ord-z-max').attr({ title: label, 'aria-label': label }).html(`<i data-lucide="${maxed ? 'minimize' : 'maximize'}"></i>`);

        if (window.lucide) lucide.createIcons();
    }

    /*  El alto del iframe = el de su contenido, ya con el zoom. Se mide el body:
        el scrollHeight del documento nunca baja del alto que ya tiene el iframe,
        y al alejar la hoja se quedaría un hueco abajo. */
    fitReport(frame) {
        const doc = frame.contentDocument;

        if (doc && doc.body) frame.style.height = `${Math.ceil(doc.body.getBoundingClientRect().height)}px`;
    }

    /*  El Corte Z de alpha (pedidos-cierre.js › renderExecutiveSummary) con los
        datos del POS (data.report, dayReport en ctrl-cierre): pedidos (P) y
        ventas de mostrador (V) por turno, cobros cruzados, cotizaciones, corte
        de caja por turno y el resumen del día. Pro suma a alpha las propinas,
        las formas de pago de la sucursal, la nota del cierre y sus reaperturas. */
    dayReport(data, opts = {}) {
        const r         = data.report || {};
        const c         = data.closure;
        const turns     = r.turns || [];
        const sales     = r.sales || [];
        const prev      = r.prev || [];
        const cross     = r.cross || [];
        const methods   = r.methods || [];
        const sold      = sales.filter((s) => s.status_id === 2 || s.status_id === 3);
        const quotes    = sales.filter((s) => s.status_id === 1);
        const cancelled = sales.filter((s) => s.status_id === 4);
        const amount    = (v) => Math.abs(Number(v || 0)) >= 0.005 ? money(v) : '&mdash;';
        const hour      = (at) => at ? ordHour(String(at).slice(11, 16)) : '&mdash;';
        const who       = (s) => esc(s.customer || (s.kind === 'counter' ? 'Público en general' : 'Sin cliente'));
        const click     = (id) => opts.clickable ? ` class="z-row" data-id="${Number(id)}" title="Ver el ticket"` : '';
        const add       = (a, b) => ({ importe: a.importe + b.importe, abono: a.abono + b.abono, quedo: a.quedo + b.quedo });
        const zero      = () => ({ importe: 0, abono: 0, quedo: 0 });

        const kv = (label, value, cls = '') => `<div class="z-kv ${cls}"><span>${label}</span><span>${value}</span></div>`;

        // Estado por saldo al terminar el día (como alpha): sin saldo Pagado, con abono Parcial.
        const state = (s) => Number(s.left) <= 0.005 ? 'PAGADO' : Number(s.paid) > 0.005 ? 'PARCIAL' : 'PENDIENTE';

        // -- Desglose por turno --

        const saleRow = (s) => {
            const off   = Number(s.discount) > 0.005;
            const cell  = off ? `<span class="z-struck">${money(s.subtotal)}</span><br>${money(s.total)}` : money(s.total);
            const notes = [off ? `Descuento: -${money(s.discount)}` : '', Number(s.tip) > 0.005 ? `Propina: ${money(s.tip)}` : '']
                .filter(Boolean).map((t) => `<div class="z-note">${t}</div>`).join('');

            return `
                <tr${click(s.id)}>
                    <td class="z-folio">${esc(s.folio)}</td>
                    <td class="z-nw">${hour(s.at)}</td>
                    <td>${who(s)}${notes}</td>
                    <td>${s.methods ? esc(s.methods) : '&mdash;'}</td>
                    <td class="r z-net">${cell}</td>
                    <td class="r">${amount(s.paid)}</td>
                    <td class="r">${amount(s.left)}</td>
                    <td class="c"><span class="z-state">${state(s)}</span></td>
                </tr>`;
        };

        // «Debía $X de $Total»: lo que debía antes de este abono. La fecha del pedido va bajo el folio.
        const prevRow = (p) => `
                <tr${p.origin ? '' : click(p.id)}>
                    <td class="z-folio">${esc(p.folio)}<div class="z-small z-grey">${ordDate(p.order_date)}</div></td>
                    <td class="z-nw">${hour(p.at)}</td>
                    <td>${esc(p.customer || 'Sin cliente')}${p.origin ? `<div class="z-small">Origen: ${esc(p.origin)}</div>` : ''}</td>
                    <td>${p.methods ? esc(p.methods) : '&mdash;'}</td>
                    <td class="r">${amount(p.owed)} <span class="z-grey">de ${amount(p.total)}</span></td>
                    <td class="r">${amount(p.paid)}</td>
                    <td class="r">${amount(p.left)}</td>
                    <td class="c"><span class="z-state">${Number(p.left) <= 0.005 ? 'LIQUIDADO' : 'PENDIENTE'}</span></td>
                </tr>`;

        const subtotal = (label, t, cls = '') => `
                <tr class="z-total">
                    <td colspan="4">${label}</td>
                    <td class="r ${cls}">${amount(t.importe)}</td>
                    <td class="r">${amount(t.abono)}</td>
                    <td class="r">${amount(t.quedo)}</td>
                    <td></td>
                </tr>`;

        // Lo de las ventas del día de todos los turnos: su Quedó es el «Pendiente» del resumen.
        let salesSum = zero();

        const group = (title, list, prevList) => {
            const a = list.reduce((t, s) => add(t, { importe: Number(s.total), abono: Number(s.paid), quedo: Number(s.left) }), zero());
            const b = prevList.reduce((t, p) => add(t, { importe: Number(p.owed), abono: Number(p.paid), quedo: Number(p.left) }), zero());
            let rows = '';

            salesSum = add(salesSum, a);

            if (list.length)     rows += `<tr class="z-div"><td colspan="8">Pedidos y ventas del turno</td></tr>${list.map(saleRow).join('')}${subtotal('Subtotal del turno', a, 'z-net')}`;
            if (prevList.length) rows += `<tr class="z-div"><td colspan="8">Abonos de pedidos anteriores</td></tr>${prevList.map(prevRow).join('')}${subtotal('Subtotal abonos anteriores', b)}`;
            if (!rows)           rows  = '<tr class="z-empty"><td colspan="8">Sin movimientos en este turno</td></tr>';
            if (list.length && prevList.length) rows += subtotal('Total del turno', add(a, b));

            return `<tr class="z-shift"><td colspan="8">${title} · ${list.length + prevList.length} cuenta(s)</td></tr>${rows}`;
        };

        const groups = turns.map((t) => group(
            `Turno ${esc(t.folio)} · ${hour(t.opened_at)} · ${esc(t.opened_by || 'Sin responsable')}`,
            sold.filter((s) => s.turn_id === t.id),
            prev.filter((p) => p.turn_id === t.id)
        )).join('');

        const breakdown = `
            <div class="z-sec" style="margin-top:0">
                <div class="z-sec-title"><span>Desglose de pedidos y ventas</span><span>${sold.length + prev.length} cuenta(s)</span></div>
                <div class="z-wrap">
                    <table class="z-table">
                        <thead><tr><th>Pedido</th><th>Hora</th><th>Cuenta</th><th>Método</th><th class="r">Importe</th><th class="r">Abono</th><th class="r">Quedó</th><th class="c">Estado</th></tr></thead>
                        <tbody>${groups || '<tr class="z-empty"><td colspan="8">Sin ventas registradas</td></tr>'}</tbody>
                    </table>
                </div>
            </div>`;

        // -- Cobros cruzados (salientes): no entran a esta caja --

        const crossHtml = cross.length ? `
            <div class="z-sec">
                <div class="z-sec-title"><span>*** Cobros cruzados ***</span><span>${cross.length} cuenta(s)</span></div>
                <div class="z-subhead">Ventas de esta sucursal cobradas en otra · no entran a esta caja</div>
                <div class="z-wrap">
                    <table class="z-table is-sub">
                        <thead><tr><th>Pedido</th><th>Cliente</th><th>Cobrado en</th><th class="r">Total</th><th class="r">Abono</th><th class="r">Quedó</th></tr></thead>
                        <tbody>${cross.map((x) => `
                            <tr${click(x.id)}>
                                <td class="z-folio">${esc(x.folio)}</td>
                                <td>${esc(x.customer || 'Sin cliente')}</td>
                                <td>${esc(x.branch || 'Otra sucursal')}</td>
                                <td class="r">${amount(x.total)}</td>
                                <td class="r">${amount(x.amount)}</td>
                                <td class="r">${amount(x.left)}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>` : '';

        // -- Cotizaciones: no suman a la venta --

        const quotesTotal = quotes.reduce((t, s) => t + Number(s.total), 0);
        const quotesHtml  = quotes.length ? `
            <div class="z-sec">
                <div class="z-sec-title"><span>Cotizaciones <small>(no suman a la venta)</small></span><span>${quotes.length} cuenta(s)</span></div>
                <div class="z-wrap">
                    <table class="z-table is-sub">
                        <thead><tr><th>Pedido</th><th>Hora</th><th>Cliente</th><th class="c">Estado</th><th class="r">Total</th></tr></thead>
                        <tbody>
                            ${quotes.map((s) => `
                                <tr${click(s.id)}>
                                    <td class="z-folio">${esc(s.folio)}</td>
                                    <td class="z-nw">${hour(s.at)}</td>
                                    <td>${who(s)}</td>
                                    <td class="c">${esc(s.status || 'Cotización')}</td>
                                    <td class="r">${amount(s.total)}</td>
                                </tr>`).join('')}
                            <tr class="z-total"><td colspan="4">Total cotizado</td><td class="r">${amount(quotesTotal)}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>` : '';

        // -- Corte de caja X: lo que entró en cada turno, por forma de pago --

        const shiftRows = turns.map((t) => `
            <tr>
                <td>${esc(t.folio)}</td>
                <td>${esc(t.opened_by || 'Sin responsable')}</td>
                <td class="z-nw">${ordDate(t.opened_at, true)}</td>
                <td class="z-nw">${t.closed ? hour(t.closed_at) : 'Abierto'}</td>
                <td class="r z-net">${amount(t.collected)}</td>
                ${methods.map((m) => `<td class="r">${amount((t.by_method || {})[m.id])}</td>`).join('')}
            </tr>`).join('');

        const cashTotal = turns.reduce((t, x) => t + Number(x.collected), 0);
        const shiftHtml = `
            <div class="z-sec">
                <div class="z-sec-title"><span>*** Corte de caja X (cierre por turno) ***</span><span>${turns.length} turno(s)</span></div>
                <div class="z-subhead">Dinero en caja por turno · pedidos y ventas del día + abonos de días anteriores</div>
                <div class="z-wrap">
                    <table class="z-table is-sub">
                        <thead><tr><th>Turno</th><th>Responsable</th><th>Apertura</th><th>Cierre</th><th class="r">En caja</th>${methods.map((m) => `<th class="r">${esc(m.name)}</th>`).join('')}</tr></thead>
                        <tbody>
                            ${shiftRows || `<tr class="z-empty"><td colspan="${5 + methods.length}">Sin turnos registrados</td></tr>`}
                            <tr class="z-total">
                                <td colspan="4">Total caja</td>
                                <td class="r z-net">${amount(cashTotal)}</td>
                                ${methods.map((m) => `<td class="r">${amount(m.amount)}</td>`).join('')}
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>`;

        // -- Resumen del día --

        const gross    = sold.reduce((t, s) => t + Number(s.total), 0);
        const tips     = sold.reduce((t, s) => t + Number(s.tip), 0);
        const ofDay    = methods.reduce((t, m) => t + Number(m.sale_amount), 0);
        const ofBefore = methods.reduce((t, m) => t + Number(m.prev_amount), 0);
        const inBox    = ofDay + ofBefore;
        const paidOff  = sold.filter((s) => Number(s.left) <= 0.005).length;
        const owing    = sold.length - paidOff;
        const counter  = sold.filter((s) => s.kind === 'counter').length;

        const totalsCard = `
            <div class="z-card">
                <div class="z-card-title">Totales</div>
                <div class="z-card-sub">Venta teórica (lo vendido, cobrado o no) vs dinero recibido</div>
                ${kv('Venta bruta (teórica)', amount(gross), 'is-hl')}
                ${kv('Pendiente', amount(salesSum.quedo))}
                ${kv('Pedidos y ventas del día', amount(ofDay))}
                ${kv('Abonos ant.', amount(ofBefore))}
                ${tips > 0.005 ? kv('Propinas (en caja)', amount(tips)) : ''}
                ${kv('EN CAJA', amount(inBox), 'is-total is-hl')}
            </div>`;

        const methodsCard = `
            <div class="z-card">
                <div class="z-card-title">Métodos de pago</div>
                <div class="z-card-sub">El dinero que entró en el día</div>
                ${methods.length ? methods.map((m) => kv(`${esc(m.name)} <span class="z-grey">${Number(m.payments)}</span>`, amount(m.amount))).join('') : kv('Sin cobros', '&mdash;')}
                ${kv('ENTRÓ A CAJA', amount(inBox), 'is-total')}
                ${kv('Fondo inicial', amount(r.opening))}
            </div>`;

        const accountsCard = `
            <div class="z-card">
                <div class="z-card-title">Estado de cuentas</div>
                <div class="z-card-sub">Por saldo al terminar el día</div>
                ${kv('Pagadas', paidOff)}
                ${kv('Pendientes', owing)}
                ${kv('Cotizaciones', quotes.length)}
                ${kv('TOTAL', paidOff + owing + quotes.length, 'is-total')}
                ${kv('Canceladas', cancelled.length)}
                ${kv('Con descuento', sold.filter((s) => Number(s.discount) > 0.005).length)}
                ${kv('Pedidos · Mostrador', `${sold.length - counter} · ${counter}`)}
                ${kv('Ticket promedio', sold.length ? money(gross / sold.length) : '&mdash;')}
            </div>`;

        const summaryHtml = `
            <div class="z-sec">
                <div class="z-sec-title"><span>Resumen del día</span><span>${ordDate(data.date)} · ${esc(data.branch || '')}</span></div>
                <div class="z-cards">${totalsCard}${methodsCard}${accountsCard}</div>
            </div>`;

        // -- Encabezado, avisos y notas --

        const open    = turns.filter((t) => !t.closed).length;
        const drift   = c && Math.abs(gross - Number(c.total)) >= 0.005;
        const banners = [
            !c ? `Pendiente de cierre · cifras preliminares${open ? ` · ${open} turno(s) abierto(s)` : ''}` : '',
            drift ? `Cambió después del cierre: el cierre guardó ${money(c.total)} vendido; hoy suma ${money(gross)}` : ''
        ].filter(Boolean).map((t) => `<div class="z-banner">${t}</div>`).join('');

        const notes = [
            c && c.note ? `<div><b>Nota del cierre:</b> ${esc(c.note)}</div>` : '',
            ...(data.reopens || []).map((x) => `<div><b>Reapertura del cierre ${esc(x.folio)}:</b> ${esc(x.reopened_by || '—')} · ${ordDate(x.reopened_at, true)}. ${esc(x.reopen_reason)}</div>`)
        ].filter(Boolean).join('');

        const notesHtml = notes ? `<div class="z-sec"><div class="z-sec-title"><span>Notas</span></div><div class="z-notes">${notes}</div></div>` : '';

        return `
            <div class="z-doc">
                <div class="z-head">
                    <div>
                        <h2>CORTE Z</h2>
                        <div class="z-meta">Folio cierre: <b>${c ? esc(c.folio) : '&mdash;'}</b></div>
                        <div class="z-meta">Sucursal: <b>${esc(data.branch || '')}</b></div>
                        <div class="z-meta">${esc(data.company || '')}</div>
                    </div>
                    <div class="z-right">
                        <div class="z-meta">Fecha: <b>${ordDate(data.date)}</b></div>
                        <div class="z-meta">${!c ? `Estado: <b>${data.date === data.today ? 'EN CURSO' : 'PENDIENTE DE CIERRE'}</b>`
                            : c.closed_by ? `Cerrado por: <b>${esc(c.closed_by)} — ${ordDate(c.closed_at, true)}</b>`
                            : `Cerrado: <b>${ordDate(c.closed_at, true)}</b>`}</div>
                        <div class="z-meta">Generado: <b>${ordNow()}</b></div>
                    </div>
                </div>
                ${banners}
                ${breakdown}
                ${crossHtml}
                ${quotesHtml}
                ${shiftHtml}
                ${summaryHtml}
                ${notesHtml}
                <div class="z-foot"><span>— Fin del reporte · Huubie —</span><span>Generado: ${ordNow()}</span></div>
            </div>`;
    }

    // -- Complements --

    // kind: el botón del módulo que se apaga mientras el ctrl contesta.
    async send(kind, payload, title) {
        this.saving = true;

        const button = $(`#modalOrderClosure button[data-day="${kind}"]`).prop('disabled', true);
        const data   = await useFetch({ url: this._link, data: payload });

        this.saving = false;

        if (data && data.status == 200) return data;

        button.prop('disabled', false);

        const conflict = data && data.status == 409;

        alert({ icon: conflict ? 'warning' : 'error', title: title, text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });

        // Otro lo cerró o reabrió antes: se repinta con lo de ahora.
        if (conflict) this.deskLoad();

        return null;
    }
}
