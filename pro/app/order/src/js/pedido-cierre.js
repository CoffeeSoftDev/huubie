/*  Pedidos › cierre del día: el «Cierre del Día» de alpha, sin turnos.

    A la izquierda, en pasos como la ventana «Corte Z» de Soft Restaurant:
    la sucursal, la fecha (con su sello, la jornada y quién cerró), los días
    anteriores sin cerrar, Reporte (Concentrado | Detallado), Hoja carta
    (Horizontal | Vertical), Destino (Impresora, PDF o Excel) y un botón que
    dice qué va a salir; aparte abajo, «Cerrar día» o «Reabrir día».
    Como Soft, un día sin cerrar no se imprime ni se descarga: en pantalla
    se ve como «PRECORTE Z». A la derecha el Corte Z de alpha (pedidos-cierre.js ›
    renderExecutiveSummary): una hoja carta con el desglose por turno, los
    cobros cruzados, las cotizaciones, el corte de caja por turno y el resumen
    del día. Es el mismo papel que se imprime y que enseña el visor de Cortes.
    La fecha se cambia sin cerrar la ventana; al cerrar o reabrir, se repinta.

    Lo abren «Cierre del día» (franja de caja, Cortes, Historial) y el aviso
    del turno cuando el día ya se cerró o falta cerrar uno anterior.

    Quién puede lo decide el ctrl en data.can: cerrar = create; reabrir = solo
    root (can.root). Las preguntas van con el alertBox (orderTurn.ask).
    Un día sin cerrar llega sin Corte Z a quien no tiene 'ver-corte-z' (data.hidden,
    como alpha): la hoja dice por qué y no se imprime hasta cerrarlo. */

/*  El Corte Z claro, al estilo del corte de Soft Restaurant (manual SR 9.5,
    p. 131): blanco y negro, líneas en vez de bandas grises; gris claro solo
    en subtotales y totales. Va en un iframe (paintReport) y en la hoja de
    impresión: así dark-mode.css y compact.css, que pisan toda celda con
    !important, no lo tocan. */
const ORD_DAY_CSS = `
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #FFFFFF; }
    .z-doc { width: 100%; padding: 24px 26px; background: #FFFFFF; color: #111111; font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-size: 10.5px; line-height: 1.35; font-variant-numeric: tabular-nums; }
    .z-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-bottom: 10px; border-bottom: 2px solid #111111; }
    .z-head h2 { display: flex; align-items: baseline; gap: 10px; margin: 0 0 6px; font-size: 26px; font-weight: 800; letter-spacing: .02em; line-height: 1; white-space: nowrap; }
    .z-kind { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #444444; }
    .z-meta { font-size: 10.5px; line-height: 1.55; color: #333333; }
    .z-meta b { font-weight: 600; color: #111111; }
    .z-right { text-align: right; }
    .z-banner { margin-top: 12px; padding: 6px 10px; border: 2px dashed #111111; text-align: center; font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
    .z-sec { margin-top: 20px; }
    .z-sec-title { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; padding-bottom: 3px; border-bottom: 1.5px solid #111111; font-size: 11.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
    .z-sec-title > span + span { font-size: 10px; font-weight: 700; letter-spacing: .05em; }
    .z-sec-title small { font-size: 10px; font-weight: 400; letter-spacing: 0; text-transform: none; }
    .z-subhead { padding: 6px 6px 0; font-size: 9px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: #555555; }
    .z-wrap { overflow-x: auto; }
    table.z-table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    table.z-table th { padding: 6px 6px 4px; border-bottom: 1px solid #999999; font-size: 9px; font-weight: 600; letter-spacing: .05em; text-align: left; text-transform: uppercase; color: #666666; }
    table.z-table td { padding: 4px 6px; border-bottom: 1px solid #E2E2E2; vertical-align: top; }
    table.z-table .r { text-align: right; white-space: nowrap; }
    table.z-table .c { text-align: center; }
    .z-folio { white-space: nowrap; }
    .z-nw { white-space: nowrap; }
    .z-small { margin-top: 1px; font-size: 9.5px; line-height: 1.2; color: #555555; }
    .z-grey { color: #777777; font-weight: 400; }
    .z-struck { color: #777777; font-size: 9.5px; font-weight: 400; text-decoration: line-through; }
    .z-note { margin-top: 1px; font-size: 9.5px; font-weight: 700; line-height: 1.2; }
    .z-state { font-size: 9px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
    tr.z-shift td { padding: 14px 6px 4px; border-bottom: 1px solid #111111; font-weight: 800; }
    tr.z-div td { padding: 8px 6px 3px; border-bottom: 1px solid #999999; font-size: 9px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: #555555; }
    tr.z-total td { padding: 4px 6px; border-top: 1px solid #111111; border-bottom: 0; background: #F3F3F3; font-weight: 700; }
    tr.z-total td:first-child { text-align: right; font-size: 9.5px; letter-spacing: .05em; text-transform: uppercase; }
    tr.z-total.is-grand td { border-top: 2px solid #111111; background: #EAEAEA; font-size: 11px; font-weight: 800; }
    tr.z-empty td { padding: 9px; text-align: center; font-style: italic; color: #666666; }
    tr.z-row { cursor: pointer; }
    tr.z-row:hover td { background: #EEF2FF; }
    .z-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-top: 10px; }
    .z-card { display: flex; flex-direction: column; border: 1px solid #111111; }
    .z-card-title { padding: 6px 10px 5px; border-bottom: 1px solid #111111; font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
    .z-card-sub { padding: 4px 10px; border-bottom: 1px solid #E2E2E2; font-size: 9.5px; color: #555555; }
    .z-kv { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 4px 10px; border-bottom: 1px solid #E2E2E2; }
    .z-kv:last-child { border-bottom: 0; }
    .z-kv span:last-child { text-align: right; white-space: nowrap; }
    .z-kv.is-hl { font-weight: 700; }
    .z-kv.is-total { border-top: 1.5px solid #111111; background: #EAEAEA; font-size: 11px; font-weight: 800; }
    .z-notes { padding: 6px; border-bottom: 1px solid #E2E2E2; }
    .z-notes div + div { margin-top: 3px; }
    .z-foot { display: flex; justify-content: space-between; margin-top: 20px; padding-top: 6px; border-top: 1px solid #111111; font-size: 9.5px; color: #444444; }
    @media (max-width: 640px) { .z-cards { grid-template-columns: minmax(0, 1fr); } }
    @media print {
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        .z-doc { padding: 12px; }
        .z-wrap { overflow: visible; }
        table.z-table { table-layout: fixed; }
        table.z-table td, table.z-table th { overflow-wrap: break-word; word-break: break-word; }
        table.z-table .r { white-space: normal; }
        .z-cards { page-break-inside: avoid; }
        .z-keep { break-inside: avoid; page-break-inside: avoid; }   /* el título de la sección no se queda solo al pie de una hoja */
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

/*  La ventana de impresión (printDay), con lo que alpha le pone en printDaily:
    pdfPrintCss SIN @media print (también en pantalla: fondo blanco, relleno de
    12 px y tablas ajustadas). El papel es carta con 8 mm de margen, vertical
    (como alpha) u horizontal; en pantalla, la hoja con sombra: 816 px (8.5 in)
    vertical o 1056 px (11 in) horizontal. */
function ordDayWindowCss(landscape) {
    const sheet = landscape ? 1056 : 816;

    return `
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    html, body { background: #FFFFFF; }
    .z-doc { padding: 12px; }
    .z-wrap { overflow: visible; }
    table.z-table { table-layout: fixed; }
    table.z-table td, table.z-table th { white-space: normal !important; overflow-wrap: break-word; word-break: break-word; }
    .z-cards { page-break-inside: avoid; }
    .z-keep { break-inside: avoid; page-break-inside: avoid; }
    tr.z-shift, tr.z-div { page-break-after: avoid; }
    @page { size: letter ${landscape ? 'landscape' : 'portrait'}; margin: 8mm; }
    @media screen {
        body { padding: 24px 0; }
        .z-doc { width: ${sheet}px; max-width: ${sheet}px; margin: 0 auto; box-shadow: 0 0 14px rgba(0, 0, 0, .45); }
    }`;
}

// 'GALILEA BARTOLOME' -> 'Galilea bartolome': nombres del Corte Z en formato oración (solo la primera letra en mayúscula).
function ordSentence(value) {
    const text = String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-MX');

    return text ? text.charAt(0).toLocaleUpperCase('es-MX') + text.slice(1) : '';
}

// -- Descargas del Corte Z --

/*  Las librerías de PDF y Excel pesan ~900 KB cada una: se cargan la primera
    vez que alguien descarga, no con la página. html2pdf.js 0.10.1 (jsPDF +
    html2canvas, copia local verificada contra cdnjs) y ExcelJS (la del framework). */
const ORD_DAY_LIBS = {
    pdf:   'assets/plugins/html2pdf/html2pdf.bundle.min.js',
    excel: 'assets/plugins/exceljs/exceljs.min.js'
};

// Los 3 destinos del Corte Z (los de Soft: Impresora, Pantalla y Excel; aquí PDF en lugar de Pantalla).
const ORD_DAY_DEST = {
    printer: { label: 'Impresora', icon: 'printer',   run: 'Imprimir Corte Z' },
    pdf:     { label: 'PDF',       icon: 'file-down', run: 'Descargar PDF' },
    excel:   { label: 'Excel',     icon: 'sheet',     run: 'Descargar Excel' }
};

// Ruta del plugin desde app/order/ (todas las páginas que cargan pedido-cierre.js viven ahí).
function ordPluginUrl(path) {
    return new URL('../../' + path, window.location.href).href;
}

// Un <script> una sola vez por página; la promesa se reusa (y se olvida si falló, para reintentar).
const ordScripts = {};

function ordLoadScript(url) {
    if (!ordScripts[url]) {
        ordScripts[url] = new Promise((resolve, reject) => {
            const tag = document.createElement('script');

            tag.src     = url;
            tag.onload  = () => resolve();
            tag.onerror = () => { delete ordScripts[url]; tag.remove(); reject(new Error('No cargó ' + url)); };

            document.head.appendChild(tag);
        });
    }

    return ordScripts[url];
}

/*  Guarda el archivo como el createExcel de coffeeSoft: con el diálogo de
    «Guardar como» si el navegador lo tiene; si no, descarga directa. El
    diálogo se abre ANTES de armar el archivo (make), mientras dura el gesto
    del clic; si el navegador ya no lo deja, descarga directa. Devuelve false
    si la persona canceló. */
async function ordSaveFile(name, description, accept, make) {
    let handle = null;

    if (window.showSaveFilePicker) {
        try {
            handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description, accept }] });
        } catch (err) {
            if (err && err.name === 'AbortError') return false;
            // Sin el gesto del clic (SecurityError) u otro fallo del diálogo: descarga directa.
        }
    }

    const blob = await make();

    if (handle) {
        const writable = await handle.createWritable();

        await writable.write(blob);
        await writable.close();

        return true;
    }

    const link = document.createElement('a');

    link.href     = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);

    return true;
}

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
        this.modeKey      = 'pro:cierre:mode:v1';
        this.mode         = this.savedMode();   // 'detail' = Detallado (todos los movimientos) · 'summary' = Concentrado
        this.orientKey    = 'pro:cierre:orient:v1';
        this.landscape    = this.savedOrient();   // hoja carta al imprimir: true = horizontal · false = vertical
        this.destKey      = 'pro:cierre:dest:v1';
        this.dest         = this.savedDest();     // 'printer' · 'pdf' · 'excel'
        this.running      = false;                // armando el PDF o el Excel
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

        // Del tamaño del «Cierre del Día» de alpha (940 px, 82vw): las medidas van en order.css › #modalOrderClosure.
        this.csModal({
            id:         'modalOrderClosure',
            title:      'Cierre del día',
            subtitle:   data.branch || '',
            lucideIcon: 'calendar-check',
            width:      'max-w-[940px]',
            saveText:   false,
            cancelText: 'Volver',
            body:       this.deskBody(data)
        });

        $('#modalOrderClosure')
            .on('click', 'button.ord-desk-go', (e) => this.deskGo(String($(e.currentTarget).attr('data-date'))))
            .on('click', 'button[data-day]', (e) => this.deskAction(String($(e.currentTarget).attr('data-day'))))
            .on('click', 'button.ord-seg[data-mode]', (e) => this.setMode(String($(e.currentTarget).attr('data-mode'))))
            .on('click', 'button.ord-seg[data-orient]', (e) => this.setOrient($(e.currentTarget).attr('data-orient') === 'landscape'))
            .on('click', 'button[data-dest]', (e) => this.setDest(String($(e.currentTarget).attr('data-dest'))))
            .on('click', '.cs-modal-x, .cs-modal-cancel, .cs-modal-bg', () => this.deskExit());

        // Esc lo atiende csModal primero (quita la ventana): si ya no está, se sale igual que con «Volver».
        $(document).off('keydown.ordDayDesk').on('keydown.ordDayDesk', (e) => {
            if (e.key !== 'Escape' || $('#modalOrderClosure').length) return;

            this.deskExit();
        });

        this.deskPicker();
        this.deskPaint(data);
    }

    // Los pasos de la ventana «Corte Z» de Soft: Fecha → Reporte → Hoja carta → Destino → el botón que lo saca.
    deskBody(data) {
        const dest = Object.entries(ORD_DAY_DEST).map(([key, d]) => `
            <button type="button" class="${this.dest === key ? 'is-active' : ''}" data-dest="${key}" aria-pressed="${this.dest === key}"><i data-lucide="${d.icon}"></i>${d.label}</button>`).join('');

        return `
            <div class="ord-desk">
                <aside class="ord-desk-side">
                    <div class="ord-desk-field"><span>Sucursal</span><b>${esc(data.branch || '—')}</b></div>
                    <div class="ord-desk-field">
                        <div class="ord-desk-head"><label for="dc_date">Fecha</label><span id="dc_state"></span></div>
                        <div class="ord-desk-pick"><input type="text" id="dc_date" readonly autocomplete="off"><i data-lucide="calendar" class="w-4 h-4"></i></div>
                        <p id="dc_span" class="ord-desk-by"></p>
                        <p id="dc_by" class="ord-desk-by"></p>
                    </div>
                    <div id="dc_pending"></div>
                    <div id="dc_why"></div>
                    <div class="ord-desk-field">
                        <span>Reporte</span>
                        <div class="ord-desk-seg">${this.modeButtons()}</div>
                    </div>
                    <div class="ord-desk-field" id="dc_sheet">
                        <span>Hoja carta</span>
                        <div class="ord-desk-seg">${this.orientButtons()}</div>
                    </div>
                    <div class="ord-desk-field">
                        <span>Destino</span>
                        <div class="ord-desk-dest">${dest}</div>
                    </div>
                    <div class="ord-desk-btns">
                        <button type="button" class="ord-desk-btn is-run" data-day="run" disabled></button>
                        <p id="dc_run_why" class="ord-desk-hint"></p>
                    </div>
                    <div id="dc_action" class="ord-desk-day"></div>
                </aside>
                <section class="ord-desk-view">
                    <div class="ord-desk-modes"><span id="dc_caption"></span></div>
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

    // El sello, la jornada y quién cerró, los días pendientes, por qué no se puede, los botones y la hoja.
    deskPaint(data) {
        const c     = data.closure;
        const state = this.state(data);
        const why   = this.reason(data);

        this.deskData = data;

        $('#dc_state').html(state ? `<span class="ord-desk-badge is-${state.tone}">${state.text}</span>` : '');
        $('#dc_span').html(this.span(data));
        $('#dc_by').html(!c ? '' : c.closed_by ? `Por: <b>${esc(c.closed_by)}</b> — ${ordDate(c.closed_at, true)}` : `Cerrado el ${ordDate(c.closed_at, true)}`);
        $('#modalOrderClosure .ord-desk-pick').toggleClass('is-closed', !!data.closed);

        this.deskPending(data);

        $('#dc_why').html(why ? `<p class="ord-desk-warn mb-0">${esc(why)}</p>` : '');
        $('#dc_action').html(this.dayButton(data));

        this.deskOutput();
        this.deskPaper();

        if (window.lucide) lucide.createIcons();
    }

    /*  Lo que abarca el corte, como el horario bajo la fecha en Soft: de la
        primera apertura al último cierre de los turnos del día. Si el último
        cerró otro día, lleva la fecha (dd/mm); con uno abierto, «en curso». */
    span(data) {
        const turns = data.turns || [];

        if (!turns.length) return '';

        const open  = turns.filter((t) => !t.closed).length;
        const first = turns.map((t) => String(t.opened_at || '')).sort()[0];
        const last  = turns.map((t) => String(t.closed_at || '')).sort().pop();
        const end   = open ? 'en curso' : (last.slice(0, 10) === data.date ? '' : ordDate(last).slice(0, 5) + ' ') + ordHour(last.slice(11, 16));
        const count = `${turns.length} turno${turns.length === 1 ? '' : 's'}${open ? ` · ${open} abierto${open === 1 ? '' : 's'}` : ''}`;

        return `Jornada <b>${ordHour(first.slice(11, 16))} – ${end}</b> · ${count}`;
    }

    // -- Salida: impresora, PDF o Excel --

    /*  Por qué no sale el Corte Z; '' = sí sale. Como Soft («Existen turnos
        abiertos. No es posible imprimir el corte Z»): un día sin cerrar se ve
        en pantalla como precorte, pero no se imprime ni se descarga. */
    outputBlock(data) {
        if (!data) return 'Elige un día.';
        if (typeof orders !== 'undefined' && orders && !orders.can('print')) return 'Tu rol no puede imprimir cortes.';
        if (!data.closed && !(data.turns || []).length) return 'No hubo operación este día.';
        if (!data.closed) return 'El Corte Z se imprime al cerrar el día.';

        return '';
    }

    // El botón dice qué va a salir; apagado, abajo dice por qué. Con Excel la hoja carta no aplica.
    deskOutput() {
        const data  = this.deskData;
        const dest  = ORD_DAY_DEST[this.dest];
        const block = this.running ? '' : this.outputBlock(data);
        const off   = this.running || block !== '';

        $('#modalOrderClosure button[data-day="run"]')
            .prop('disabled', off)
            .attr('title', block)
            .html(this.running
                ? `<i data-lucide="loader-circle" class="w-4 h-4 animate-spin"></i>${this.dest === 'excel' ? 'Armando el Excel…' : 'Armando el PDF…'}`
                : `<i data-lucide="${dest.icon}" class="w-4 h-4"></i>${dest.run}`);

        $('#dc_run_why').text(block);
        $('#dc_sheet').toggleClass('is-off', this.dest === 'excel').find('button').prop('disabled', this.dest === 'excel');
        $('#dc_caption').html(this.caption(data));

        if (window.lucide) lucide.createIcons();
    }

    // Arriba de la hoja: qué va a salir (o, sin cerrar, que es un precorte que todavía no sale).
    caption(data) {
        const mode  = this.mode === 'summary' ? 'concentrado' : 'detallado';
        const sheet = `carta ${this.landscape ? 'horizontal' : 'vertical'}`;

        if (data && !data.closed) return `Vista previa · <b>Precorte Z</b> ${mode} · se imprime al cerrar el día`;

        const out = { printer: sheet, pdf: `PDF ${sheet}`, excel: 'Excel' }[this.dest];

        return `Así saldrá · <b>Corte Z</b> ${mode} · ${out}`;
    }

    setDest(dest) {
        if (!ORD_DAY_DEST[dest] || this.running) return;

        this.dest = dest;

        try {
            localStorage.setItem(this.destKey, dest);
        } catch (e) {
            // Sin almacenamiento: el destino dura lo que dure la página.
        }

        $('#modalOrderClosure button[data-dest]').each((i, el) => {
            const active = $(el).attr('data-dest') === dest;

            $(el).toggleClass('is-active', active).attr('aria-pressed', String(active));
        });

        this.deskOutput();
    }

    // Sin elección guardada: Impresora, lo de siempre.
    savedDest() {
        try {
            const dest = localStorage.getItem(this.destKey);

            return ORD_DAY_DEST[dest] ? dest : 'printer';
        } catch (e) {
            return 'printer';
        }
    }

    // El botón del panel: lo manda al destino elegido.
    async runDay(data) {
        const block = this.outputBlock(data);

        if (block) return alert({ icon: 'warning', title: block, btn1: true, btn1Text: 'Entendido' });

        if (this.dest === 'printer') return this.printDay(data);

        this.running = true;
        this.deskOutput();

        try {
            if (this.dest === 'pdf') await this.pdfDay(data);
            else await this.excelDay(data);
        } catch (e) {
            alert({ icon: 'error', title: this.dest === 'pdf' ? 'No se armó el PDF' : 'No se armó el Excel', text: 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });
        }

        this.running = false;
        this.deskOutput();
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

    // -- Concentrado | Detallado --

    /*  Como el Corte Z de Soft Restaurant (Resumido o Detallado): el Detallado
        trae todos los movimientos (cada pedido, venta y abono por turno, cobros
        cruzados y cotizaciones); el Concentrado, solo lo importante: corte de
        caja por turno, el resumen con sus 3 cajas y las notas. Lo que se ve es
        lo que se imprime. La elección se guarda en el navegador. */
    modeButtons() {
        return [['summary', 'Concentrado'], ['detail', 'Detallado']].map(([mode, text]) => {
            const active = this.mode === mode;

            return `<button type="button" class="ord-seg${active ? ' is-active' : ''}" data-mode="${mode}" aria-pressed="${active}">${text}</button>`;
        }).join('');
    }

    setMode(mode) {
        this.mode = mode === 'summary' ? 'summary' : 'detail';

        try {
            localStorage.setItem(this.modeKey, this.mode);
        } catch (e) {
            // Sin almacenamiento: el modo dura lo que dure la página.
        }

        $('#modalOrderClosure button.ord-seg[data-mode]').each((i, el) => {
            const active = $(el).attr('data-mode') === this.mode;

            $(el).toggleClass('is-active', active).attr('aria-pressed', String(active));
        });

        if (this.deskData) {
            this.deskOutput();
            this.deskPaper();
        }
    }

    // Sin elección guardada: Detallado, el corte de siempre.
    savedMode() {
        try {
            return localStorage.getItem(this.modeKey) === 'summary' ? 'summary' : 'detail';
        } catch (e) {
            return 'detail';
        }
    }

    // -- Orientación --

    // «Hoja carta»: Horizontal | Vertical (la vale para la impresora y el PDF).
    orientButtons() {
        return [['landscape', 'Horizontal'], ['portrait', 'Vertical']].map(([key, text]) => {
            const active = (key === 'landscape') === this.landscape;

            return `<button type="button" class="ord-seg${active ? ' is-active' : ''}" data-orient="${key}" aria-pressed="${active}">${text}</button>`;
        }).join('');
    }

    // Se guarda en el navegador; el visor de Cortes imprime con la misma.
    setOrient(landscape) {
        this.landscape = Boolean(landscape);

        try {
            localStorage.setItem(this.orientKey, this.landscape ? 'landscape' : 'portrait');
        } catch (e) {
            // Sin almacenamiento: la orientación dura lo que dure la página.
        }

        $('#modalOrderClosure button.ord-seg[data-orient]').each((i, el) => {
            const active = ($(el).attr('data-orient') === 'landscape') === this.landscape;

            $(el).toggleClass('is-active', active).attr('aria-pressed', String(active));
        });

        if (this.deskData) this.deskOutput();
    }

    // Sin elección guardada: horizontal.
    savedOrient() {
        try {
            return localStorage.getItem(this.orientKey) !== 'portrait';
        } catch (e) {
            return true;
        }
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
        if (kind === 'run')    return this.runDay(data);
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

    /*  Como alpha (pedidos-cierre.js › printDaily), en carta vertical u
        horizontal según el select «Orientación» (this.landscape): una ventana
        con el Corte Z en su hoja y, a los 600 ms, el diálogo de impresión ya
        orientado (@page de ordDayWindowCss). En la ventana van las reglas de
        papel de alpha (pdfPrintCss): relleno de 12 px y tablas ajustadas. Lo
        usan el Cierre del día y el visor de Cortes (mode: el suyo).
        Como Soft, un día sin cerrar no se imprime (también desde el visor). */
    printDay(data, mode = this.mode) {
        if (!data.closed) return this.notClosedWarn(data);

        const landscape = this.landscape;
        const win       = window.open('', '', landscape ? 'height=900,width=1140' : 'height=900,width=900');

        if (!win) return alert({ icon: 'warning', title: 'No se abrió la impresión', text: 'El navegador bloqueó la ventana. Permite las ventanas emergentes de Huubie y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });

        win.document.write('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">'
            + `<title>Corte Z ${mode === 'summary' ? 'concentrado' : 'detallado'} ${esc(ordDate(data.date))}</title>`
            + `<style>${ORD_DAY_CSS}${ordDayWindowCss(landscape)}</style></head>`
            + `<body>${this.dayReport(data, { mode })}</body></html>`);
        win.document.close();

        setTimeout(() => {
            win.focus();
            win.print();
        }, 600);
    }

    // El aviso de Soft («Existen turnos abiertos. No es posible imprimir el corte Z»), con lo que falta.
    notClosedWarn(data) {
        const open = (data.turns || []).filter((t) => !t.closed).length;

        return alert({
            icon:     'warning',
            title:    'El Corte Z se imprime al cerrar el día',
            text:     open ? `Hay ${open} turno${open === 1 ? '' : 's'} abierto${open === 1 ? '' : 's'}. Ciérralo${open === 1 ? '' : 's'} y cierra el día para imprimir o descargar el corte.` : 'Cierra el día para imprimir o descargar el corte.',
            btn1:     true,
            btn1Text: 'Entendido'
        });
    }

    // 'Corte Z 18-11-2026 Reginas Cuarta detallado': sin los caracteres que Windows no deja en un nombre de archivo.
    fileName(data, mode) {
        const [y, m, d] = String(data.date).split('-');
        const name      = `Corte Z ${d}-${m}-${y} ${data.branch || ''} ${mode === 'summary' ? 'concentrado' : 'detallado'}`;

        return name.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // -- PDF (descarga directa) --

    /*  La misma hoja que sale en la impresora, hecha PDF carta (8 mm de margen)
        con html2pdf.js. Se arma en un iframe aparte con solo ORD_DAY_CSS: así
        Bootstrap, compact.css y el modo oscuro de la página no la tocan. El
        ancho es el del papel menos los márgenes (995 px horizontal, 755 px
        vertical), el mismo con que la acomoda el diálogo de impresión. Una
        fila, el encabezado y las 3 cajas del resumen no se parten entre hojas. */
    pdfDay(data, mode = this.mode) {
        if (!data.closed) return this.notClosedWarn(data);

        const landscape = this.landscape;
        const width     = landscape ? 995 : 755;

        return ordSaveFile(this.fileName(data, mode) + '.pdf', 'Documento PDF', { 'application/pdf': ['.pdf'] }, async () => {
            const frame = document.createElement('iframe');

            frame.setAttribute('aria-hidden', 'true');
            frame.setAttribute('tabindex', '-1');
            frame.style.cssText = `position: fixed; top: 0; left: -10000px; width: ${width}px; height: 600px; border: 0;`;

            const loaded = new Promise((resolve, reject) => {
                frame.onload  = resolve;
                frame.onerror = reject;
            });

            frame.srcdoc = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="color-scheme" content="light">'
                + `<style>${ORD_DAY_CSS}
                    html, body { background: #FFFFFF; }
                    .z-doc { padding: 12px; }
                    .z-wrap { overflow: visible; }
                    table.z-table { table-layout: fixed; }
                    table.z-table td, table.z-table th { white-space: normal !important; overflow-wrap: break-word; word-break: break-word; }
                    .z-keep { break-inside: avoid; }
                </style>`
                + `<script src="${ordPluginUrl(ORD_DAY_LIBS.pdf)}"><\/script></head>`
                + `<body>${this.dayReport(data, { mode })}</body></html>`;

            document.body.appendChild(frame);

            try {
                await loaded;

                const win = frame.contentWindow;

                if (typeof win.html2pdf !== 'function') throw new Error('No cargó html2pdf');

                return await win.html2pdf().set({
                    margin:      8,
                    image:       { type: 'jpeg', quality: 0.96 },
                    html2canvas: { scale: 2, backgroundColor: '#FFFFFF', windowWidth: width },
                    jsPDF:       { unit: 'mm', format: 'letter', orientation: landscape ? 'landscape' : 'portrait' },
                    pagebreak:   { mode: ['css', 'legacy'], avoid: ['tr', '.z-head', '.z-sec-title', '.z-subhead', '.z-banner', '.z-keep', '.z-foot'] }
                }).from(win.document.querySelector('.z-doc')).outputPdf('blob');
            } finally {
                frame.remove();
            }
        });
    }

    // -- Excel --

    /*  Las mismas tablas de la hoja (Concentrado o Detallado), en una hoja
        «Corte Z» de ExcelJS: los importes van como número con formato de
        dinero, para poder sumarlos. Se arma de la hoja ya pintada (dayReport)
        para que el Excel diga exactamente lo mismo que el papel. */
    excelDay(data, mode = this.mode) {
        if (!data.closed) return this.notClosedWarn(data);

        const type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

        return ordSaveFile(this.fileName(data, mode) + '.xlsx', 'Archivo Excel', { [type]: ['.xlsx'] }, async () => {
            await ordLoadScript(ordPluginUrl(ORD_DAY_LIBS.excel));

            const doc    = new DOMParser().parseFromString(this.dayReport(data, { mode }), 'text/html');
            const buffer = await this.zWorkbook(doc.querySelector('.z-doc')).xlsx.writeBuffer();

            return new Blob([buffer], { type });
        });
    }

    /*  La hoja del Corte Z armada como el papel: sin cuadrícula; encabezado en
        dos lados (folios a la izquierda, fecha y cierre a la derecha) con su
        raya; títulos de sección en mayúsculas; cada tabla con su encabezado
        gris, sus filas con línea tenue y los subtotales sombreados; las 3 cajas
        del resumen con su marco, una debajo de otra; notas y pie.
        Los importes son números con formato de dinero (el cero se ve «—», como
        en el papel) para poder sumarlos. Cada columna toma el ancho de lo más
        largo que trae, y los renglones combinados crecen si su texto no cabe. */
    zWorkbook(root) {
        const book   = new ExcelJS.Workbook();
        const across = (table) => Math.max(0, ...[...table.rows].map((tr) => [...tr.cells].reduce((n, td) => n + (td.colSpan || 1), 0)));
        const WIDTH  = Math.max(8, ...[...root.querySelectorAll('table.z-table')].map(across));
        const HALF   = 3;      // encabezado y pie: izquierda A:C, derecha D:última
        const CARD   = 4;      // cajas del resumen: etiqueta A:C, cifra en D
        const MONEY  = '"$"#,##0.00;-"$"#,##0.00;"—"';
        const widths = Array(WIDTH).fill(0);
        const tall   = [];
        let row      = 0;

        book.creator = 'Huubie';

        const sheet = book.addWorksheet('Corte Z', {
            views:        [{ showGridLines: false }],
            pageSetup:    {
                paperSize: 1, orientation: this.landscape ? 'landscape' : 'portrait',
                fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
                margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 }
            },
            headerFooter: { oddFooter: '&L&8Huubie · Corte Z&R&8Página &P de &N' }
        });

        const clean = (t) => String(t || '').replace(/\s+/g, ' ').trim();
        const upper = (t) => clean(t).toLocaleUpperCase('es-MX');
        const edge  = (style = 'thin', argb = 'FF111111') => ({ style, color: { argb } });
        const solid = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
        const font  = (size, bold = false, argb = '') => Object.assign({ size, bold }, argb ? { color: { argb } } : {});
        const plain = (v) => v && v.richText ? v.richText.map((r) => r.text).join('') : String(v == null ? '' : v);

        // '$1,234.50' o '-$55.00' -> número; '—' -> 0 (el formato lo pinta «—»); lo demás -> null.
        const amount = (t) => {
            const text = clean(t);
            const m    = text.match(/^(-?)\$([\d,]+(?:\.\d+)?)$/);

            if (text === '—') return 0;

            return m ? Number(m[2].replace(/,/g, '')) * (m[1] ? -1 : 1) : null;
        };

        // Lo más largo que trae cada columna (las celdas combinadas no cuentan).
        const measure = (col, text, size = 10) => {
            const longest = Math.max(0, ...String(text).split('\n').map((s) => s.length));

            widths[col - 1] = Math.max(widths[col - 1], longest * size / 10);
        };

        // Un nodo como richText: <b> en negritas, <small> más chico, .z-grey en gris; caps = mayúsculas (salvo <small>).
        const rich = (node, base = font(10), caps = false) => {
            const runs = [];
            const walk = (n, f, up) => {
                if (n.nodeType === 3) {
                    const text = n.textContent.replace(/\s+/g, ' ');

                    if (text) runs.push({ text: up ? text.toLocaleUpperCase('es-MX') : text, font: f });
                    return;
                }
                if (n.nodeType !== 1) return;

                let next = f;

                if (/^(B|STRONG)$/.test(n.tagName))  next = { ...next, bold: true };
                if (n.tagName === 'SMALL')           next = { ...next, bold: false, size: next.size - 1.5 };
                if (n.classList.contains('z-grey'))  next = { ...next, bold: false, color: { argb: 'FF777777' } };

                n.childNodes.forEach((c) => walk(c, next, up && n.tagName !== 'SMALL'));
            };

            walk(node, base, caps);

            // Sin espacios dobles entre tramos ni en las orillas.
            const out = runs.reduce((list, r) => {
                const prev = list[list.length - 1];
                const text = !prev || / $/.test(prev.text) ? r.text.replace(/^ +/, '') : r.text;

                if (text) list.push({ text, font: r.font });
                return list;
            }, []);

            if (out.length) out[out.length - 1].text = out[out.length - 1].text.replace(/ +$/, '');

            return out.length ? { richText: out } : '';
        };

        /*  Un tramo combinado del renglón actual (columnas from a to). El fondo y
            las rayas de arriba/abajo van en todas sus celdas; la izquierda en la
            primera y la derecha en la última (y en la primera, que es la que
            Excel toma para el combinado). */
        const span = (from, to, value, style = {}) => {
            if (to > from) sheet.mergeCells(row, from, row, to);

            const cell = sheet.getCell(row, from);
            const f    = style.font || font(10);

            cell.value     = value;
            cell.font      = f;
            cell.alignment = { vertical: style.valign || 'middle', horizontal: style.align || 'left', wrapText: true };

            for (let c = from; c <= to; c++) {
                const each = sheet.getCell(row, c);

                if (style.fill) each.fill = solid(style.fill);

                if (style.border) {
                    const { left, right, ...rest } = style.border;

                    each.border = Object.assign({}, rest, c === from && left ? { left } : {}, (c === to || c === from) && right ? { right } : {});
                }
            }

            const sizes = value && value.richText ? value.richText.map((r) => r.font.size || 10) : [];

            tall.push({ row, from, to, text: plain(value), size: Math.max(f.size, ...sizes) });

            return cell;
        };

        const line = (value, style) => { row++; return span(1, WIDTH, value, style); };
        const gap  = (height) => { row++; sheet.getRow(row).height = height; };

        // El importe de una celda de dinero: sin el tachado (antes del descuento) ni el «de $Total».
        const cellAmount = (td) => {
            const copy = td.cloneNode(true);

            copy.querySelectorAll('.z-struck, .z-grey, br').forEach((n) => n.remove());

            return amount(copy.textContent);
        };

        // Una celda de texto: el nombre y, debajo, sus notas (descuento, propina, fecha, origen) en gris. El turno (solo dígitos) va como número.
        const cellValue = (td, f) => {
            const notes = [...td.querySelectorAll('.z-note, .z-small')];
            const copy  = td.cloneNode(true);

            copy.querySelectorAll('.z-note, .z-small').forEach((n) => n.remove());

            const main = clean(copy.textContent);

            if (td.querySelector('.z-state')) { f.size = 9; f.bold = true; return upper(main); }
            if (!notes.length) return /^\d+$/.test(main) ? Number(main) : main;

            return { richText: [{ text: main, font: { ...f } }, ...notes.map((n) => ({ text: '\n' + clean(n.textContent), font: font(9, n.classList.contains('z-note'), 'FF555555') }))] };
        };

        // Un renglón de tabla: encabezado gris, filas con línea tenue, turno / división / vacío a lo ancho y subtotales sombreados.
        const tableRow = (tr, wide) => {
            const head  = tr.parentElement.tagName === 'THEAD';
            const total = tr.classList.contains('z-total');
            const grand = tr.classList.contains('is-grand');

            row++;

            if (tr.classList.contains('z-shift')) {
                sheet.getRow(row).height = 22;
                return span(1, wide, clean(tr.textContent), { font: font(10, true), valign: 'bottom', border: { bottom: edge() } });
            }
            if (tr.classList.contains('z-div'))   return span(1, wide, upper(tr.textContent), { font: font(9, true, 'FF555555'), valign: 'bottom', border: { bottom: edge('thin', 'FF999999') } });
            if (tr.classList.contains('z-empty')) return span(1, wide, clean(tr.textContent), { font: { ...font(10, false, 'FF666666'), italic: true }, align: 'center' });

            let col = 1;

            [...tr.cells].forEach((td, i) => {
                const cols  = td.colSpan || 1;
                const right = td.classList.contains('r');
                const label = total && i === 0;
                const cash  = !head && right ? cellAmount(td) : null;
                const cell  = sheet.getCell(row, col);
                const f     = head ? font(9, true, 'FF666666') : font(grand ? 11 : label ? 9.5 : 10, total);

                if (cols > 1) sheet.mergeCells(row, col, row, col + cols - 1);

                cell.value     = head || label ? upper(td.textContent) : cash !== null ? cash : cellValue(td, f);
                cell.font      = f;
                cell.alignment = { vertical: 'top', wrapText: true, horizontal: right || label ? 'right' : td.classList.contains('c') ? 'center' : 'left' };
                if (cash !== null) cell.numFmt = MONEY;

                for (let c = col; c < col + cols; c++) {
                    const each = sheet.getCell(row, c);

                    if (head)       each.border = { bottom: edge('thin', 'FF999999') };
                    else if (total) { each.fill = solid(grand ? 'FFEAEAEA' : 'FFF3F3F3'); each.border = { top: grand ? edge('medium') : edge() }; }
                    else            each.border = { bottom: edge('thin', 'FFE2E2E2') };
                }

                if (cols === 1) measure(col, cash !== null ? money(cash) : plain(cell.value), head ? 10.5 : f.size);

                col += cols;
            });
        };

        // Marco de una caja del resumen, como en el papel.
        const frame = (top, bottom) => {
            const add = (r, c, side) => {
                const cell = sheet.getCell(r, c);

                [cell, cell.master].forEach((x) => { x.border = Object.assign({}, x.border, { [side]: edge() }); });
            };

            for (let r = top; r <= bottom; r++) { add(r, 1, 'left'); add(r, CARD, 'right'); }
            for (let c = 1; c <= CARD; c++)     { add(top, c, 'top'); add(bottom, c, 'bottom'); }
        };

        // -- Encabezado: título y folios a la izquierda; fecha, cierre y generado a la derecha --

        const head  = root.querySelector('.z-head');
        const h2    = head.querySelector('h2').cloneNode(true);
        const kind  = h2.querySelector('.z-kind');
        const left  = [...head.querySelectorAll(':scope > div:first-child > .z-meta')];
        const right = [...head.querySelectorAll('.z-right > .z-meta')];
        const rows  = Math.max(1 + left.length, right.length);

        if (kind) kind.remove();

        const title = { richText: [{ text: clean(h2.textContent), font: font(18, true) }].concat(kind ? [{ text: '   ' + upper(kind.textContent), font: font(9, true, 'FF444444') }] : []) };

        for (let i = 0; i < rows; i++) {
            const rule = i === rows - 1 ? { bottom: edge('medium') } : null;

            row++;
            span(1, HALF, i === 0 ? title : left[i - 1] ? rich(left[i - 1]) : '', { border: rule, valign: i === 0 ? 'bottom' : 'middle' });
            span(HALF + 1, WIDTH, right[i] ? rich(right[i]) : '', { border: rule, align: 'right' });
        }

        root.querySelectorAll('.z-banner').forEach((b) => {
            const dash = edge('dashed');

            gap(8);
            line(upper(b.textContent), { font: font(9.5, true), align: 'center', border: { top: dash, bottom: dash, left: dash, right: dash } });
        });

        // -- Secciones: título con su cifra a la derecha, subtítulo, tablas, cajas y notas --

        root.querySelectorAll('.z-sec').forEach((sec) => {
            const [name, count] = sec.querySelectorAll('.z-sec-title > span');
            const rule          = { bottom: edge('medium') };

            gap(12);
            row++;
            sheet.getRow(row).height = 20;
            span(1, WIDTH - 3, name ? rich(name, font(11, true), true) : '', { valign: 'bottom', border: rule });
            span(WIDTH - 2, WIDTH, count ? upper(count.textContent) : '', { font: font(9, true), valign: 'bottom', align: 'right', border: rule });

            sec.querySelectorAll('.z-subhead').forEach((s) => line(upper(s.textContent), { font: font(9, true, 'FF555555'), valign: 'bottom' }));
            sec.querySelectorAll('table.z-table').forEach((table) => {
                const wide = across(table);

                [...table.rows].forEach((tr) => tableRow(tr, wide));
            });

            sec.querySelectorAll('.z-card').forEach((card) => {
                gap(10);
                row++;

                const top = row;

                span(1, CARD, upper(card.querySelector('.z-card-title').textContent), { font: font(10.5, true), border: { bottom: edge() } });

                card.querySelectorAll('.z-card-sub').forEach((s) => {
                    row++;
                    span(1, CARD, clean(s.textContent), { font: font(9, false, 'FF555555'), border: { bottom: edge('thin', 'FFE2E2E2') } });
                });

                card.querySelectorAll('.z-kv').forEach((kv) => {
                    const [label, value] = [...kv.querySelectorAll(':scope > span')].map((s) => s.cloneNode(true));
                    const grand = kv.classList.contains('is-total');
                    const f     = font(grand ? 11 : 10, grand || kv.classList.contains('is-hl'));
                    const times = label.querySelector('.z-grey');      // cuántos cobros de esa forma de pago
                    const n     = times ? Number(clean(times.textContent)) : null;

                    if (times) times.remove();

                    const text  = clean(value.textContent);
                    const cash  = amount(text);
                    const style = grand ? { fill: 'FFEAEAEA', border: { top: edge('medium') } } : { border: { bottom: edge('thin', 'FFE2E2E2') } };

                    row++;
                    span(1, CARD - 1, clean(label.textContent) + (n !== null ? ` · ${n} ${n === 1 ? 'cobro' : 'cobros'}` : ''), { font: f, ...style });

                    const cell = sheet.getCell(row, CARD);

                    cell.value     = cash !== null ? cash : /^\d+$/.test(text) ? Number(text) : text;
                    cell.font      = f;
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    cell.border    = style.border;
                    if (style.fill)    cell.fill   = solid(style.fill);
                    if (cash !== null) cell.numFmt = MONEY;

                    measure(CARD, cash !== null ? money(cash) : text, f.size);
                });

                frame(top, row);
            });

            sec.querySelectorAll('.z-notes > div').forEach((n) => line(rich(n), { border: { bottom: edge('thin', 'FFE2E2E2') } }));
        });

        // -- Pie --

        const [end, stamp] = root.querySelectorAll('.z-foot > span');

        gap(14);
        row++;
        span(1, HALF, clean(end && end.textContent), { font: font(9, false, 'FF444444'), border: { top: edge() } });
        span(HALF + 1, WIDTH, clean(stamp && stamp.textContent), { font: font(9, false, 'FF444444'), align: 'right', border: { top: edge() } });

        // Anchos: lo más largo de cada columna (entre 9 y 40). Luego, el alto de los combinados que no caben en una línea.
        widths.forEach((w, i) => { sheet.getColumn(i + 1).width = Math.min(40, Math.max(9, Math.ceil(w) + 3)); });

        tall.forEach((t) => {
            let room = 0;

            for (let c = t.from; c <= t.to; c++) room += sheet.getColumn(c).width;

            const lines  = t.text.split('\n').reduce((n, s) => n + Math.max(1, Math.ceil(s.length * t.size / 10 / Math.max(1, room - 2))), 0);
            const height = Math.ceil(lines * t.size * 1.4 + 3);
            const now    = sheet.getRow(t.row).height || 15;

            if ((lines > 1 || t.size > 11) && height > now) sheet.getRow(t.row).height = height;
        });

        return book;
    }

    // -- Corte Z (pantalla) --

    /*  El Corte Z en un iframe con ORD_DAY_CSS: se ve igual que impreso y los
        estilos de la página no lo tocan. Arriba a la derecha, el zoom de alpha
        (reportToolbar): alejar, el porcentaje (vuelve a 100 %), acercar y
        maximizar (130 %). El alto del iframe sigue al contenido (también al
        cambiar el ancho o el zoom). onRow(id): clic en un pedido o venta del
        día (el visor de Cortes abre su ticket); sin él, las filas no se pulsan.
        mode: Concentrado o Detallado (el del módulo, salvo que el visor mande el suyo). */
    paintReport(target, data, onRow, mode = this.mode) {
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
            + `<body><div class="z-zoom" style="zoom:${this.zoom / 100}">${this.dayReport(data, { clickable: !!onRow, mode })}</div></body></html>`;
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
        las formas de pago de la sucursal, la nota del cierre y sus reaperturas.
        opts.mode 'summary' = Concentrado: sin el desglose, los cobros cruzados
        ni las cotizaciones. Arriba, del primer al último folio del día.
        Un día sin cerrar se titula «PRECORTE Z» (así le dice Soft): solo se
        ve en pantalla, no sale. Los nombres de clientes y cajeros van en
        formato oración. */
    dayReport(data, opts = {}) {
        const detail    = opts.mode !== 'summary';
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
        const person    = (name, none = '') => esc(ordSentence(name) || none);
        const who       = (s) => person(s.customer, s.kind === 'counter' ? 'Público en general' : 'Sin cliente');
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
                    <td class="r">${cell}</td>
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
                    <td>${person(p.customer, 'Sin cliente')}${p.origin ? `<div class="z-small">Origen: ${esc(p.origin)}</div>` : ''}</td>
                    <td>${p.methods ? esc(p.methods) : '&mdash;'}</td>
                    <td class="r">${amount(p.owed)} <span class="z-grey">de ${amount(p.total)}</span></td>
                    <td class="r">${amount(p.paid)}</td>
                    <td class="r">${amount(p.left)}</td>
                    <td class="c"><span class="z-state">${Number(p.left) <= 0.005 ? 'LIQUIDADO' : 'PENDIENTE'}</span></td>
                </tr>`;

        // grand: el total (línea doble y gris un poco más oscuro); sin él, un subtotal.
        const subtotal = (label, t, grand = false) => `
                <tr class="z-total${grand ? ' is-grand' : ''}">
                    <td colspan="4">${label}</td>
                    <td class="r">${amount(t.importe)}</td>
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

            if (list.length)     rows += `<tr class="z-div"><td colspan="8">Pedidos y ventas del turno</td></tr>${list.map(saleRow).join('')}${subtotal('Subtotal del turno', a)}`;
            if (prevList.length) rows += `<tr class="z-div"><td colspan="8">Abonos de pedidos anteriores</td></tr>${prevList.map(prevRow).join('')}${subtotal('Subtotal abonos anteriores', b)}`;
            if (!rows)           rows  = '<tr class="z-empty"><td colspan="8">Sin movimientos en este turno</td></tr>';
            if (list.length && prevList.length) rows += subtotal('Total del turno', add(a, b), true);

            return `<tr class="z-shift"><td colspan="8">${title} · ${list.length + prevList.length} cuenta(s)</td></tr>${rows}`;
        };

        const groups = turns.map((t) => group(
            `Turno ${esc(t.folio)} · ${hour(t.opened_at)} · ${person(t.opened_by, 'Sin responsable')}`,
            sold.filter((s) => s.turn_id === t.id),
            prev.filter((p) => p.turn_id === t.id)
        )).join('');

        const breakdown = `
            <div class="z-sec">
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
                                <td>${person(x.customer, 'Sin cliente')}</td>
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
                            <tr class="z-total is-grand"><td colspan="4">Total cotizado</td><td class="r">${amount(quotesTotal)}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>` : '';

        // -- Corte de caja X: lo que entró en cada turno, por forma de pago --

        const shiftRows = turns.map((t) => `
            <tr>
                <td>${esc(t.folio)}</td>
                <td>${person(t.opened_by, 'Sin responsable')}</td>
                <td class="z-nw">${ordDate(t.opened_at, true)}</td>
                <td class="z-nw">${t.closed ? hour(t.closed_at) : 'Abierto'}</td>
                <td class="r">${amount(t.collected)}</td>
                ${methods.map((m) => `<td class="r">${amount((t.by_method || {})[m.id])}</td>`).join('')}
            </tr>`).join('');

        const cashTotal = turns.reduce((t, x) => t + Number(x.collected), 0);
        const shiftHtml = `
            <div class="z-sec z-keep">
                <div class="z-sec-title"><span>*** Corte de caja X (cierre por turno) ***</span><span>${turns.length} turno(s)</span></div>
                <div class="z-subhead">Dinero en caja por turno · pedidos y ventas del día + abonos de días anteriores</div>
                <div class="z-wrap">
                    <table class="z-table is-sub">
                        <thead><tr><th>Turno</th><th>Responsable</th><th>Apertura</th><th>Cierre</th><th class="r">En caja</th>${methods.map((m) => `<th class="r">${esc(m.name)}</th>`).join('')}</tr></thead>
                        <tbody>
                            ${shiftRows || `<tr class="z-empty"><td colspan="${5 + methods.length}">Sin turnos registrados</td></tr>`}
                            <tr class="z-total is-grand">
                                <td colspan="4">Total caja</td>
                                <td class="r">${amount(cashTotal)}</td>
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
            <div class="z-sec z-keep">
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
            ...(data.reopens || []).map((x) => `<div><b>Reapertura del cierre ${esc(x.folio)}:</b> ${person(x.reopened_by, '—')} · ${ordDate(x.reopened_at, true)}. ${esc(x.reopen_reason)}</div>`)
        ].filter(Boolean).join('');

        const notesHtml = notes ? `<div class="z-sec z-keep"><div class="z-sec-title"><span>Notas</span></div><div class="z-notes">${notes}</div></div>` : '';

        // Del primer al último folio del día, por serie (P pedidos, V mostrador): todos, también cotizaciones y cancelados.
        const series = {};

        sales.forEach((s) => {
            const m = String(s.folio || '').match(/^([A-Z]*)(\d+)$/);
            if (!m) return;

            const n = Number(m[2]);
            const g = series[m[1]] || (series[m[1]] = { min: n, max: n });

            g.min = Math.min(g.min, n);
            g.max = Math.max(g.max, n);
        });

        const folios = Object.keys(series).sort().map((k) => {
            const g     = series[k];
            const label = k === 'V' ? 'Mostrador' : 'Pedidos';

            return `<div class="z-meta">${label}: ${g.min === g.max ? `folio <b>${k}${g.min}</b>` : `del folio <b>${k}${g.min}</b> al <b>${k}${g.max}</b>`}</div>`;
        }).join('') || '<div class="z-meta">Folios: <b>sin ventas</b></div>';

        return `
            <div class="z-doc">
                <div class="z-head">
                    <div>
                        <h2>${c ? 'CORTE Z' : 'PRECORTE Z'} <span class="z-kind">${detail ? 'Detallado' : 'Concentrado'}</span></h2>
                        <div class="z-meta">Folio cierre: <b>${c ? esc(c.folio) : '&mdash;'}</b></div>
                        ${folios}
                        <div class="z-meta">Sucursal: <b>${esc(data.branch || '')}</b> · ${esc(data.company || '')}</div>
                    </div>
                    <div class="z-right">
                        <div class="z-meta">Fecha: <b>${ordDate(data.date)}</b></div>
                        <div class="z-meta">${!c ? `Estado: <b>${data.date === data.today ? 'EN CURSO' : 'PENDIENTE DE CIERRE'}</b>`
                            : c.closed_by ? `Cerrado por: <b>${person(c.closed_by)} — ${ordDate(c.closed_at, true)}</b>`
                            : `Cerrado: <b>${ordDate(c.closed_at, true)}</b>`}</div>
                        <div class="z-meta">Generado: <b>${ordNow()}</b></div>
                    </div>
                </div>
                ${banners}
                ${detail ? breakdown + crossHtml + quotesHtml : ''}
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
