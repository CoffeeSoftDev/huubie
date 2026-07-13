let apiCierre = 'ctrl/ctrl-cierre.php';

class Cierre {
    constructor(api) {
        this.api = api;
        this._closureData = null;
        this._closureResponse = null;
        this._reportZoom = 100;
    }

    async initCierre() {
        let rangePicker     = getDataRangePicker("calendarDailyClose");
        let date            = rangePicker.fi;
        let subsidiaries_id = (rol == 1 || rol == 2 || rol == 3 || rol == 6 || rol == 7) ? $('#subsidiariesDailyClose').val() : null;

        $('#btnCerrarDia').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
        $('#ticketModeBar').addClass('hidden');
        $('#ticketContainer').html(`
            <div class="text-center text-gray-400 py-16">
                <div class="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p>Validando cierre...</p>
            </div>
        `);

        const data = await useFetch({ url: this.api, data: { opc: 'showCierre', date: date, subsidiaries_id: subsidiaries_id } });

        if (data.status !== 200) {
            $('#ticketContainer').html(`<p class="text-center text-red-400 py-10">${data.message || 'Error al validar'}</p>`);
            $('#btnCerrarDia').prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');
            return;
        }

        this._closureData = data;

        // Sin checklist intermedio: si hay bloqueantes se avisan y se aborta;
        // si el día se puede cerrar, va directo al recibo de confirmación.
        if (!data.can_close) {
            const blockers = (data.checks || []).filter(c => !c.ok && c.blocker);
            await Swal.fire({
                title: 'No se puede cerrar el día',
                html: `
                    <div class="text-left text-sm space-y-1.5">
                        ${blockers.map(b => `
                            <div class="flex items-start gap-2 text-red-400">
                                <span class="leading-none">&#10007;</span><span>${b.label}${b.detail ? ` <span class="text-slate-400">(${b.detail})</span>` : ''}</span>
                            </div>`).join('')}
                    </div>
                `,
                icon: 'error',
                background: '#1F2A37',
                color: '#fff',
                confirmButtonColor: '#ea580c',
                confirmButtonText: 'Entendido'
            });
            this.resetCierreView();
            return;
        }

        await this.confirmClose(date, subsidiaries_id);
    }

    resetCierreView() {
        $('#btnCerrarDia').prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');
        app.loadShifts();
    }

    async confirmClose(date, subsidiariesId) {
        const s = this._closureData.summary;
        const warnings = (this._closureData.checks || []).filter(c => !c.ok && !c.blocker);
        const shifts = s.total_shifts;
        const orders = s.total_orders;
        const plural = shifts === 1 ? 'turno' : 'turnos';

        const row = (label, value, valueClass = 'text-white') => `
            <div class="flex items-center justify-between py-1">
                <span class="text-gray-400 text-[13px]">${label}</span>
                <span class="${valueClass} text-[13px] font-semibold">${value}</span>
            </div>`;

        const warningsHtml = warnings.length ? `
            <div class="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2.5 space-y-1">
                ${warnings.map(w => `
                    <div class="flex items-start gap-2 text-[12px] text-amber-400">
                        <span class="leading-none">&#9888;</span><span>${w.label}</span>
                    </div>`).join('')}
                <p class="text-[11px] text-amber-400/60 pt-0.5">Al cerrar aceptas estos avisos.</p>
            </div>` : '';

        // Detalle desplegable (oculto): se muestra con "Ver info del día".
        const detailHtml = `
            <div id="closeDayInfo" class="hidden space-y-2 text-left">
                <div class="bg-[#1a2332] border border-gray-600/60 rounded-lg px-3 py-2.5">
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Venta del día</p>
                    ${row('Total ventas', formatPrice(s.total_sales), 'text-green-400')}
                    ${s.total_discount > 0 ? row('Descuentos', '&minus;' + formatPrice(s.total_discount), 'text-gray-300') : ''}
                </div>
                <div class="bg-[#1a2332] border border-gray-600/60 rounded-lg px-3 py-2.5">
                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Dinero en caja</p>
                    ${row('&#128181; Efectivo', formatPrice(s.total_cash))}
                    ${row('&#128179; Tarjeta', formatPrice(s.total_card))}
                    ${row('&#128257; Transferencia', formatPrice(s.total_transfer))}
                </div>
                ${warningsHtml}
            </div>`;

        const html = `
            <div class="flex flex-col items-center text-center pt-1">
                <div class="w-16 h-16 rounded-full border border-gray-600/70 bg-white/5 flex items-center justify-center mb-4 text-amber-400">
                    ${lucideIcon('power', 'w-7 h-7')}
                </div>
                <h3 class="text-lg font-bold text-white mb-2">¿Deseas cerrar el día?</h3>
                <p class="text-[13px] text-gray-400 leading-relaxed max-w-[300px]">
                    Al cerrar el día se cerrará el sistema y se registrarán <strong class="text-white font-semibold">${shifts} ${plural}</strong> del día.
                </p>
            </div>

            <div class="bg-[#1a2332] rounded-lg px-3.5 py-3 flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                    <span class="text-[13px] text-gray-200">${shifts} ${plural} &middot; ${orders} tickets</span>
                </div>
                <button type="button" id="closeDayInfoToggle" class="text-[12px] text-gray-400 hover:text-white flex items-center gap-0.5 whitespace-nowrap">
                    <span id="closeDayInfoLabel">Ver info del día</span>
                    <span id="closeDayInfoChevron" class="inline-flex transition-transform">${lucideIcon('chevron-right', 'w-3.5 h-3.5')}</span>
                </button>
            </div>

            ${detailHtml}
        `;

        const modal = createCoffeeModalForm({
            id: 'frmCloseDay',
            theme: 'dark',
            width: 430,
            hideHeader: true,
            reverseButtons: true,
            confirmText: `<span class="inline-flex items-center justify-center gap-1.5">${lucideIcon('check', 'w-4 h-4')} Sí, cerrar el día</span>`,
            confirmBg: 'bg-blue-600 hover:bg-blue-700',
            cancelBg: 'bg-[#2a3441] hover:bg-[#333f4f] text-gray-200',
            cancelText: 'No, seguir operando',
            footerNote: 'El sistema se cerrará al confirmar el cierre',
            json: [{ opc: 'html', html: html }],
            onCancel: () => this.resetCierreView(),
            onConfirm: async (_, m) => {
                m.el.find('.cf-confirm').prop('disabled', true).addClass('opacity-60 cursor-not-allowed');

                const res = await useFetch({ url: this.api, data: { opc: 'addCierre', date: date, subsidiaries_id: subsidiariesId } });
                m.close();

                if (res.status === 200) {
                    Swal.fire({ title: 'Cierre realizado', text: res.message, icon: 'success', background: '#1F2A37', color: '#fff', confirmButtonColor: '#2563eb' });
                    dailyClosure = { is_closed: true, closure_id: res.closure_id };
                    await this.loadClosedView(date, subsidiariesId);
                } else {
                    Swal.fire({ title: 'Error', text: res.message || 'Error al realizar el cierre', icon: 'error', background: '#1F2A37', color: '#fff' });
                    this.resetCierreView();
                }
            }
        });

        // "Ver info del día": despliega el desglose y rota el chevron.
        modal.el.find('#closeDayInfoToggle').on('click', () => {
            const info = modal.el.find('#closeDayInfo');
            const willOpen = info.hasClass('hidden');
            info.toggleClass('hidden');
            modal.el.find('#closeDayInfoLabel').text(willOpen ? 'Ocultar info' : 'Ver info del día');
            modal.el.find('#closeDayInfoChevron').css('transform', willOpen ? 'rotate(90deg)' : '');
        });
    }

    async loadClosedView(date, subsidiariesId) {
        const res = await useFetch({ url: this.api, data: { opc: 'getCierre', date: date, subsidiaries_id: subsidiariesId } });

        if (res.status !== 200 || !res.closure) return;

        this._closureResponse = res;

        const select = $('#shiftSelector');
        select.html('');
        select.append(`<option value="daily" style="color: #f97316; font-weight: bold;">CIERRE DIARIO</option>`);
        if (res.shifts && res.shifts.length > 0) {
            res.shifts.forEach(shift => {
                const time = moment(shift.opened_at).format('YYYY-MM-DD hh:mm A');
                const badge = shift.status === 'open' ? ' [ABIERTO]' : ' [CERRADO]';
                select.append(`<option value="${shift.id}" data-status="${shift.status}">${time}${badge}</option>`);
            });
        }
        select.off('change').on('change', function() { cierre.onShiftSelectorChange($(this).val()); });

        $('#openShiftsAlert').addClass('hidden').html('');

        // Opcion C: badge integrado junto al label de fecha
        const dateLabel = $('#dateFieldWrapper');
        dateLabel.find('.closure-badge, .closure-wrapper').remove();
        const label = dateLabel.find('label');
        label.wrap(`<div class="closure-wrapper flex items-center justify-between mb-1"></div>`);
        label.removeClass('mb-1').addClass('!mb-0');
        label.after(`<span class="closure-badge bg-green-600 text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wide leading-none">Cerrado</span>`);
        $('#calendarDailyClose').addClass('!border-green-600/50');
        dateLabel.append(`<p class="closure-badge text-[10px] text-gray-500 mt-1">Por: <strong class="text-gray-300">${res.closure.closed_by || 'Admin'}</strong> — ${moment(res.closure.created_at).format('hh:mm A')}</p>`);

        $('#btnOpenShift, #btnCloseShift').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
        $('#btnPrintTicket').prop('disabled', false).removeClass('opacity-50 cursor-not-allowed').attr('onclick', 'cierre.printDaily()');

        // Contenedor estable del boton (#closeDayBtnArea): se referencia por id, no por
        // .parent() del boton, para que loadShifts pueda reconstruir "Cerrar Dia" al volver
        // a un dia sin cerrar aunque aqui se haya vaciado el contenedor.
        const btnArea = $('#closeDayBtnArea');
        if (rol == 1) {
            btnArea.html(`
                <button id="btnReabrirDia" class="w-full py-2 rounded-lg text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-2" onclick="cierre.reopenClosure(${res.closure.id})">
                    ${lucideIcon('rotate-cw')} Reabrir Dia
                </button>
                <p class="text-[9px] text-gray-600 mt-1 text-center">Solo admin — requiere motivo</p>
            `);
        } else {
            btnArea.html('');
        }

        $('#ticketModeBar').addClass('hidden');
        this.renderDaily();
    }

    renderDaily() {
        this.renderExecutiveSummary(this._closureResponse);
    }

    // Barra de herramientas del Corte Z: solo controles de zoom.
    reportToolbar() {
        const maxed = this._reportZoom > 100;

        return `
            <div class="relative flex justify-end items-center mb-3">
                <div class="inline-flex items-center gap-0.5 bg-[#1a2332] p-1 rounded-lg border border-gray-700/50 text-[11px]">
                    <button class="p-1 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-700/40 transition-all" title="Alejar" onclick="cierre.zoomReport(-10)">${lucideIcon('zoom-out', 'w-3.5 h-3.5')}</button>
                    <button id="reportZoomPct" class="px-1 py-0.5 rounded-md font-semibold text-gray-300 hover:text-white min-w-[36px] text-center transition-all" title="Restablecer zoom" onclick="cierre.setReportZoom(100)">${this._reportZoom}%</button>
                    <button class="p-1 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-700/40 transition-all" title="Acercar" onclick="cierre.zoomReport(10)">${lucideIcon('zoom-in', 'w-3.5 h-3.5')}</button>
                    <button id="btnReportZoomMax" class="p-1 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-700/40 transition-all" title="${maxed ? 'Minimizar' : 'Maximizar'}" onclick="cierre.toggleReportZoomMax()">${lucideIcon(maxed ? 'minimize' : 'maximize', 'w-3.5 h-3.5')}</button>
                </div>
            </div>
        `;
    }

    // Zoom del Corte Z (solo vista Reporte): 50%-150%, por defecto 80%.
    zoomReport(delta) {
        this.setReportZoom(this._reportZoom + delta);
    }

    setReportZoom(value) {
        this._reportZoom = Math.min(150, Math.max(50, value));
        $('#reportZoomWrap').css('zoom', this._reportZoom / 100);
        $('#reportZoomPct').text(this._reportZoom + '%');
        const maxed = this._reportZoom > 100;
        $('#btnReportZoomMax').attr('title', maxed ? 'Minimizar' : 'Maximizar').html(lucideIcon(maxed ? 'minimize' : 'maximize', 'w-3.5 h-3.5'));
    }

    toggleReportZoomMax() {
        this.setReportZoom(this._reportZoom > 100 ? 100 : 130);
    }

    statusBadge(statusId) {
        const map = {
            1: { label: 'cotizacion', cls: 'bg-cyan-100 text-cyan-700' },
            2: { label: 'pendiente',  cls: 'bg-amber-100 text-amber-700' },
            3: { label: 'pagado',     cls: 'bg-green-100 text-green-700' },
            4: { label: 'cancelado',  cls: 'bg-red-100 text-red-700' }
        };
        const s = map[statusId] || { label: 'desconocido', cls: 'bg-gray-100 text-gray-600' };
        return `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${s.cls}">${s.label}</span>`;
    }

    // Estilos del corte Z (mismo sistema pdf-* de alpha/pedidos-reportes):
    // documento blanco tanto en pantalla como al imprimir (WYSIWYG).
    pdfBaseCss() {
        // Corte Z — estilo monocromo tipo POS (Soft Restaurant): negro sobre blanco,
        // bandas grises (#9ca3af encabezados, #e5e7eb divisores, #f3f4f6 sub-tablas),
        // sin color de estado. WYSIWYG: se ve igual en pantalla y al imprimir.
        return `
            /* La ventana de impresion no carga Tailwind: sin este reset, width:100% + padding
               (content-box) hace que el documento se salga por el lado derecho de la hoja. */
            .pdf-document, .pdf-document * { box-sizing: border-box; }
            .pdf-document { background: #fff; color: #000; width: 100%; max-width: 1100px; margin: 0 auto; padding: 24px 26px; border-radius: 2px; box-shadow: 0 2px 12px rgba(0,0,0,0.35); font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-size: 9px; line-height: 1.3; }

            /* Membrete */
            .pdf-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #9ca3af; }
            .pdf-header h2 { font-size: 22px; font-weight: 700; color: #000; letter-spacing: 0; margin: 0 0 3px; line-height: 1; }
            .pdf-header .meta { font-size: 10px; color: #000; line-height: 1.35; }
            .pdf-header .meta span { color: #000; font-weight: 600; }

            /* Secciones */
            .pdf-section { margin-top: 16px; }
            .pdf-section-title { display: flex; justify-content: space-between; align-items: center; background: #9ca3af; color: #000; padding: 4px 8px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; border-top: 1px solid #9ca3af; border-bottom: 1px solid #9ca3af; }
            .cz-count { font-size: 10px; color: #000; font-weight: 700; text-transform: uppercase; }
            .cz-subhead { padding: 2px 8px; font-size: 9px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: #000; background: #fff; border-bottom: 1px solid #9ca3af; }
            .pdf-section-body { padding: 0; }

            /* Tabla */
            table.pdf-table { width: 100%; border-collapse: collapse; font-size: 9px; color: #000; }
            table.pdf-table thead th { background: #9ca3af; color: #000; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; padding: 4px 8px; text-align: left; border-top: 1px solid #9ca3af; border-bottom: 1px solid #9ca3af; }
            table.pdf-table.sub thead th { background: #f3f4f6; }
            table.pdf-table thead th.text-right { text-align: right; }
            table.pdf-table thead th.text-center { text-align: center; }
            table.pdf-table tbody td { padding: 2px 8px; color: #000; vertical-align: top; border-bottom: 1px solid #d1d5db; }
            table.pdf-table .text-right { text-align: right; }
            table.pdf-table .text-center { text-align: center; }
            table.pdf-table .col-importe { font-weight: 400; color: #000; background: transparent; }
            /* Origen de la Venta Neta: importe (con descuento aplicado) de las ventas del día. */
            table.pdf-table .col-venta-neta { background: #d1d5db; font-weight: 600; }
            table.pdf-table .col-efectivo, table.pdf-table .col-tarjeta { color: #000; font-weight: 400; }
            .cz-folio { font-weight: 600; color: #000; }
            .cz-origen { font-size: 8px; color: #000; line-height: 1; margin-top: 0; }
            .cz-de { color: #9ca3af; font-weight: 400; font-size: 8px; }
            .cz-tachado { text-decoration: line-through; color: #9ca3af; font-weight: 400; font-size: 8px; }
            .cz-desc { font-size: 8px; color: #000; font-weight: 700; line-height: 1; margin-top: 1px; }

            /* Encabezado de turno */
            table.pdf-table tr.cz-shift-row td { background: #9ca3af; color: #000; font-weight: 700; font-size: 8px; text-transform: uppercase; letter-spacing: 0.4px; padding: 2px 8px; border-top: 1px solid #9ca3af; border-bottom: 1px solid #9ca3af; }
            .cz-shift-count { font-weight: 700; color: #000; text-transform: uppercase; letter-spacing: 0; font-size: 8px; }

            /* Divisor de sub-bloque dentro de un turno (Pedidos del turno / Abonos anteriores) */
            table.pdf-table tr.cz-divider td { background: #e5e7eb; color: #000; font-weight: 700; font-size: 8px; text-transform: uppercase; letter-spacing: 0.4px; padding: 2px 8px; border-top: 1px solid #9ca3af; border-bottom: 1px solid #9ca3af; }

            /* Subtotales y totales: label a la derecha, montos con linea superior */
            table.pdf-table tr.cz-shift-subtotal td, table.pdf-table tr.cz-total-row td { font-weight: 700; color: #000; font-size: 9px; padding: 6px 8px; border-bottom: none; }
            table.pdf-table tr.cz-shift-subtotal td:first-child, table.pdf-table tr.cz-total-row td:first-child { text-align: right; text-transform: uppercase; font-size: 8px; }
            table.pdf-table tr.cz-shift-subtotal td.text-right, table.pdf-table tr.cz-total-row td.text-right { border-top: 1px solid #9ca3af; }

            /* Estado en texto plano negro (sin pill ni color) */
            .cz-estado { font-size: 8px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase; color: #000; }
            .cz-pagado, .cz-parcial, .cz-pend { color: #000; }

            /* Resumen del dia — 3 tarjetas */
            .cz-resumen { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
            @media (max-width: 700px) { .cz-resumen { grid-template-columns: 1fr; } }
            .cz-resumen .pdf-section { margin-top: 0; border: 1px solid #9ca3af; border-radius: 2px; overflow: hidden; }
            .cz-resumen .pdf-section-title { display: block; background: #f3f4f6; color: #000; font-size: 9px; letter-spacing: 0.4px; border-top: none; border-bottom: 1px solid #9ca3af; }
            /* Aclara que cada tarjeta mide algo distinto: venta vs dinero recibido vs cuentas. */
            .cz-resumen .cz-subhead { padding: 2px 8px; font-size: 8px; font-weight: 400; letter-spacing: 0; text-transform: none; color: #000; background: #fff; border-bottom: 1px solid #d1d5db; }
            .pdf-kv { display: flex; justify-content: space-between; align-items: center; padding: 2px 8px; border-bottom: 1px solid #d1d5db; }
            .pdf-kv:last-child { border-bottom: none; }
            .pdf-kv .kv-label { color: #000; font-size: 9px; }
            .pdf-kv .kv-value { font-weight: 400; font-size: 9px; color: #000; text-align: right; }
            .pdf-kv.cz-neta { background: #d1d5db; }
            .pdf-kv.cz-neta .kv-label, .pdf-kv.cz-neta .kv-value { font-weight: 700; }
            .pdf-kv.total-row { border-top: 1px solid #9ca3af; border-bottom: none; padding: 4px 8px; margin: 0; background: transparent; }
            .pdf-kv.total-row .kv-label { font-weight: 700; color: #000; }
            .pdf-kv.total-row .kv-value { font-weight: 700; font-size: 9px; color: #000; }
            .pdf-kv .kv-value.negative { color: #000; }
            .cz-mp-count { color: #000; font-weight: 400; font-size: 9px; }

            .pdf-footer { margin-top: 16px; padding-top: 6px; border-top: 1px solid #9ca3af; display: flex; justify-content: space-between; font-size: 9px; color: #000; }
        `;
    }

    pdfPrintCss() {
        return `
            /* Forzar impresion de las bandas grises (encabezados de seccion/turno). */
            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body { background: #fff !important; margin: 0; }
            .pdf-document { background: #fff !important; color: #000 !important; box-shadow: none !important; padding: 12px !important; max-width: 100% !important; }
            /* Tablas ajustadas al ancho de la hoja (no se cortan) y tipografia legible en papel. */
            table.pdf-table { table-layout: fixed !important; width: 100% !important; }
            table.pdf-table td, table.pdf-table th { white-space: normal !important; overflow-wrap: break-word; word-break: break-word; }
            div[style*="overflow"] { overflow: visible !important; }
            .cz-resumen { page-break-inside: avoid; }
            table.pdf-table tr.cz-shift-row, table.pdf-table tr.cz-divider { page-break-after: avoid; }
        `;
    }

    injectPdfStyles() {
        if ($('#pdf-cierre-styles').length) return;
        $('head').append(`<style id="pdf-cierre-styles">${this.pdfBaseCss()} @media print { ${this.pdfPrintCss()} }</style>`);
    }

    renderExecutiveSummary(res, containerId = 'ticketContainer') {
        this.injectPdfStyles();

        const c      = res.closure;
        const r      = res.report || {};
        const cta    = r.cuentas || {};
        const caja   = r.caja || {};
        const ventas = r.ventas || {};
        const categorias = r.categorias || [];
        const shifts = r.shifts || [];
        const orders = res.orders || [];
        const prevPayments  = res.prev_payments || [];
        const crossPayments = res.cross_payments || [];
        const statusMap = { 1: 'Cotización', 2: 'Pendiente', 3: 'Pagado', 4: 'Cancelado' };

        const kv = (label, value, opts = {}) => `
            <div class="pdf-kv${opts.total ? ' total-row' : ''}${opts.highlight ? ' cz-neta' : ''}">
                <span class="kv-label">${label}</span>
                <span class="kv-value${opts.negative ? ' negative' : ''}">${value}</span>
            </div>
        `;

        const money = (v) => parseFloat(v || 0) ? formatPrice(v) : '&mdash;';

        // === ABONOS DE PEDIDOS ANTERIORES ===
        // Pagos recibidos hoy a pedidos creados en días previos (misma sucursal o cruzados de otra).
        // Este dinero SÍ entró a esta caja; el backend atribuye cada abono al turno (shift_id) en que
        // cayó el pago. Se listan JUNTO a las ventas del día, dentro del grupo de su turno (más abajo),
        // con el mismo formato del ticket de cierre de turno (importe -> abono -> quedó, LIQUIDADO/PENDIENTE).
        const crossPrev = { importe: 0, abono: 0, quedo: 0 };

        // Saldo pendiente ANTES del abono de hoy = total - descuento - abonos previos.
        // (No es el total del pedido: pudo haber abonos en días anteriores.)
        const saldoPrevio = (o) => {
            const total    = parseFloat(o.total_pay || 0);
            const discount = parseFloat(o.discount || 0);
            const abono    = parseFloat(o.payment_real || 0);
            const paidUpto = parseFloat(o.total_paid_upto || 0);
            const quedo    = Math.max(total - discount - paidUpto, 0);
            return { total, abono, quedo, debia: quedo + abono };
        };

        const filaAbonoPrev = (o) => {
            const { total, abono, quedo, debia } = saldoPrevio(o);
            const liquidado = quedo <= 0.005;
            const origen = (o.is_cross && o.origin_subsidiary)
                ? `<div class="cz-origen">Origen: ${o.origin_subsidiary}</div>`
                : '';
            // Formato del ticket detallado: "Debía $X de $Total" (X = saldo antes del abono de hoy).
            const importeCell = `${money(debia)} <span class="cz-de">de ${money(total)}</span>`;
            return `
                    <tr>
                        <td class="cz-folio">${o.folio || '#' + o.id}</td>
                        <td>${o.client_name || 'Sin cliente'}${origen}</td>
                        <td>${o.method || '&mdash;'}</td>
                        <td class="text-right col-importe">${importeCell}</td>
                        <td class="text-right">${money(abono)}</td>
                        <td class="text-right">${money(quedo)}</td>
                        <td class="text-center"><span class="cz-estado ${liquidado ? 'cz-pagado' : 'cz-pend'}">${liquidado ? 'LIQUIDADO' : 'PENDIENTE'}</span></td>
                    </tr>
            `;
        };

        const acumulaAbonoPrev = (lista, sub) => {
            lista.forEach(o => {
                const { abono, quedo, debia } = saldoPrevio(o);
                sub.importe += debia; sub.abono += abono; sub.quedo += quedo;
                crossPrev.importe += debia; crossPrev.abono += abono; crossPrev.quedo += quedo;
            });
        };

        // Divisores de sub-bloque dentro de un turno (banda gris clara).
        const dividerPedidos = `<tr class="cz-divider"><td colspan="7">Pedidos del turno</td></tr>`;
        const dividerAbonos  = `<tr class="cz-divider"><td colspan="7">Abonos de pedidos anteriores</td></tr>`;

        // === CORTE DE CAJA X (Cierre x Turno) ===
        // Dinero en caja por turno = efectivo + tarjeta + transferencia COBRADOS en el turno.
        // Ese cobro ya incluye: pedidos del día + abonos de días anteriores + cobros cruzados entrantes.
        const shiftsTotals = { caja: 0, efectivo: 0, tarjeta: 0, transferencia: 0 };
        const shiftsRows = shifts.map(shift => {
            const efe    = parseFloat(shift.efectivo || 0);
            const tar    = parseFloat(shift.tarjeta || 0);
            const tra    = parseFloat(shift.transferencia || 0);
            const enCaja = efe + tar + tra;
            shiftsTotals.caja          += enCaja;
            shiftsTotals.efectivo      += efe;
            shiftsTotals.tarjeta       += tar;
            shiftsTotals.transferencia += tra;
            return `
                <tr>
                    <td>${shift.cajero || 'Sin cajero'}</td>
                    <td>${shift.apertura ? moment(shift.apertura).format('DD/MM/YYYY hh:mm A') : '-'}</td>
                    <td>${shift.cierre ? moment(shift.cierre).format('hh:mm A') : 'Abierto'}</td>
                    <td class="text-right col-importe">${money(enCaja)}</td>
                    <td class="text-right col-efectivo">${money(efe)}</td>
                    <td class="text-right col-tarjeta">${money(tar)}</td>
                    <td class="text-right">${money(tra)}</td>
                </tr>
            `;
        }).join('');

        const shiftsTableHtml = shifts.length > 0 ? `
            <div class="pdf-section" style="margin-bottom:14px">
                <div class="pdf-section-title cz-title" style="display:flex;justify-content:space-between;align-items:center">
                    <span>*** Corte de Caja X (Cierre x Turno) ***</span>
                    <span class="cz-count">${shifts.length} turno(s)</span>
                </div>
                <div class="cz-subhead">Dinero en caja por turno &mdash; pedidos del día + abonos de días anteriores + cobros cruzados</div>
                <div style="overflow-x:auto">
                    <table class="pdf-table sub">
                        <thead>
                            <tr>
                                <th>Responsable</th>
                                <th>Apertura</th>
                                <th>Cierre</th>
                                <th class="text-right">En Caja</th>
                                <th class="text-right">Efectivo</th>
                                <th class="text-right">Tarjeta</th>
                                <th class="text-right">Transferencia</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${shiftsRows}
                            <tr class="cz-total-row">
                                <td colspan="3">TOTAL CAJA</td>
                                <td class="text-right col-importe">${money(shiftsTotals.caja)}</td>
                                <td class="text-right">${money(shiftsTotals.efectivo)}</td>
                                <td class="text-right">${money(shiftsTotals.tarjeta)}</td>
                                <td class="text-right">${money(shiftsTotals.transferencia)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        ` : `
            <div class="pdf-section" style="margin-bottom:14px">
                <div class="pdf-section-title cz-title">*** Corte de Caja X (Cierre x Turno) ***</div>
                <div class="pdf-section-body" style="text-align:center;color:#95a5a6;padding:20px">Sin turnos registrados</div>
            </div>
        `;

        const salesOrders     = orders.filter(o => o.status === 2 || o.status === 3);
        const quoteOrders     = orders.filter(o => o.status === 1);
        const cancelledOrders = orders.filter(o => o.status === 4);

        const saldoPedido = (o) => parseFloat(o.total || 0) - parseFloat(o.discount || 0) - parseFloat(o.total_paid_upto || 0);

        // Hora del pedido: usa order_time (real o de entrega); si no hay, guion.
        const horaPedido = (o) => o.time ? moment(o.time, 'HH:mm:ss').format('hh:mm a') : '&mdash;';

        const estadoVenta = (o) => {
            if (saldoPedido(o) <= 0.005) return '<span class="cz-estado cz-pagado">PAGADO</span>';
            if (parseFloat(o.payment_real || 0) > 0) return '<span class="cz-estado cz-parcial">PARCIAL</span>';
            return '<span class="cz-estado cz-pend">PENDIENTE</span>';
        };

        // === DESGLOSE DE PEDIDOS · VENTAS DEL DÍA (agrupado por turno) ===
        const ventasTotales = { importe: 0, abono: 0, quedo: 0 };
        const cierreShifts  = res.shifts || [];   // turnos abiertos ese día (id, shift_name, opened_at)

        const filaPedido = (o) => {
            const abono = parseFloat(o.payment_real || 0);
            const quedo = Math.max(saldoPedido(o), 0);
            const total = parseFloat(o.total || 0);
            const descuento = parseFloat(o.discount || 0);
            // Con descuento: importe original tachado (gris) + importe neto (total - descuento),
            // y el monto del descuento anotado bajo la cuenta.
            const importeCell = descuento > 0.005
                ? `<span class="cz-tachado">${money(total)}</span><br>${money(total - descuento)}`
                : money(total);
            const descLine = descuento > 0.005
                ? `<div class="cz-desc">Descuento: -${money(descuento)}</div>`
                : '';
            return `
                    <tr>
                        <td class="cz-folio">${o.folio}</td>
                        <td>${o.client || '&mdash;'}${descLine}</td>
                        <td>${o.method || '&mdash;'}</td>
                        <td class="text-right col-importe col-venta-neta">${importeCell}</td>
                        <td class="text-right">${money(abono)}</td>
                        <td class="text-right">${money(quedo)}</td>
                        <td class="text-center">${estadoVenta(o)}</td>
                    </tr>
            `;
        };
        const acumula = (lista, sub) => {
            lista.forEach(o => {
                const abono = parseFloat(o.payment_real || 0);
                const quedo = Math.max(saldoPedido(o), 0);
                // Importe = venta neta (total - descuento): así el subtotal cuadra con la Venta Neta.
                const neto  = parseFloat(o.total || 0) - parseFloat(o.discount || 0);
                sub.importe += neto;
                sub.abono   += abono;
                sub.quedo   += quedo;
                ventasTotales.importe += neto;
                ventasTotales.abono   += abono;
                ventasTotales.quedo   += quedo;
            });
        };

        // Fila de subtotal (label a la derecha vía CSS, montos importe/abono/quedó).
        // importeClass permite resaltar el importe cuando alimenta la Venta Bruta.
        const subtotalRow = (label, s, importeClass = '') => `
                <tr class="cz-shift-subtotal">
                    <td colspan="3">${label}</td>
                    <td class="text-right col-importe ${importeClass}">${money(s.importe)}</td>
                    <td class="text-right">${money(s.abono)}</td>
                    <td class="text-right">${money(s.quedo)}</td>
                    <td></td>
                </tr>
        `;

        // Un grupo por turno: ventas del día + abonos a pedidos anteriores cobrados en ese turno,
        // en la misma tabla. Cada sub-bloque lleva su subtotal; el "Subtotal del turno" (combinado)
        // solo se muestra cuando el turno tiene ambos bloques (si hay uno solo, sería redundante).
        const grupoTurno = (titulo, ventasLista, abonosLista) => {
            const subVentas = { importe: 0, abono: 0, quedo: 0 };
            const subAbonos = { importe: 0, abono: 0, quedo: 0 };
            acumula(ventasLista, subVentas);
            acumulaAbonoPrev(abonosLista, subAbonos);

            let filas = '';
            if (ventasLista.length) {
                filas += dividerPedidos + ventasLista.map(filaPedido).join('') + subtotalRow('Subtotal pedidos del turno', subVentas, 'col-venta-neta');
            }
            if (abonosLista.length) {
                filas += dividerAbonos + abonosLista.map(filaAbonoPrev).join('') + subtotalRow('Subtotal abonos anteriores', subAbonos);
            }
            if (!ventasLista.length && !abonosLista.length) {
                filas = `<tr><td colspan="7" style="text-align:center;padding:9px;font-style:italic">Sin movimientos en este turno</td></tr>`;
            }

            const totalTurno = (ventasLista.length && abonosLista.length)
                ? subtotalRow('Subtotal del turno', {
                    importe: subVentas.importe + subAbonos.importe,
                    abono:   subVentas.abono   + subAbonos.abono,
                    quedo:   subVentas.quedo   + subAbonos.quedo
                })
                : '';

            const cuentas = ventasLista.length + abonosLista.length;
            return `
                <tr class="cz-shift-row">
                    <td colspan="7">${titulo} <span class="cz-shift-count">${cuentas} cuenta(s)</span></td>
                </tr>
                ${filas}
                ${totalTurno}
            `;
        };

        // Un grupo por cada turno abierto ese día (aunque no tenga movimientos), en orden de apertura.
        let ventasGroupsHtml = cierreShifts.map(shift => {
            const titulo = shift.shift_name || moment(shift.opened_at).format('hh:mm A');
            const folioTurno = '#' + String(shift.id).padStart(3, '0');
            const ventasLista = salesOrders.filter(o => o.shift_id == shift.id);
            const abonosLista = prevPayments.filter(o => o.shift_id == shift.id);
            return grupoTurno(`Turno ${folioTurno} &middot; ${titulo}`, ventasLista, abonosLista);
        }).join('');

        // Movimientos fuera de todo turno del día (huérfanos): ventas y abonos sin turno asociado.
        const cierreShiftIds  = cierreShifts.map(s => String(s.id));
        const huerfanosVentas = salesOrders.filter(o => !cierreShiftIds.includes(String(o.shift_id)));
        const huerfanosAbonos = prevPayments.filter(o => !cierreShiftIds.includes(String(o.shift_id)));
        if (huerfanosVentas.length || huerfanosAbonos.length) {
            ventasGroupsHtml += grupoTurno('Sin turno', huerfanosVentas, huerfanosAbonos);
        }

        const ventasBody = (salesOrders.length > 0 || prevPayments.length > 0 || cierreShifts.length > 0)
            ? ventasGroupsHtml
            : `<tr><td colspan="7" style="text-align:center;padding:16px;font-style:italic">Sin ventas registradas</td></tr>`;

        const desgloseSectionHtml = `
            <div class="pdf-section" style="margin-top:0">
                <div style="overflow-x:auto">
                    <table class="pdf-table">
                        <thead>
                            <tr>
                                <th>Pedido</th>
                                <th>Cuenta</th>
                                <th>Método</th>
                                <th class="text-right">Importe</th>
                                <th class="text-right">Abono</th>
                                <th class="text-right">Quedó</th>
                                <th class="text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody>${ventasBody}</tbody>
                    </table>
                </div>
            </div>
        `;

        // === COBROS CRUZADOS (salientes) ===
        // Pedidos de ESTA sucursal cuyo abono se cobró en OTRA. No entran a esta caja (informativo).
        // Los abonos ENTRANTES de otra sucursal ya se listan dentro de su turno en el desglose.
        const crossRows = crossPayments.map(o => {
            const total = parseFloat(o.total_pay || 0);
            const abono = parseFloat(o.payment_cross || 0);
            const quedo = Math.max(total - abono, 0);
            return `
                    <tr>
                        <td class="cz-folio">${o.folio || '#' + o.id}</td>
                        <td>${o.client_name || 'Sin cliente'}</td>
                        <td>${o.charged_subsidiary || 'Otra sucursal'}</td>
                        <td class="text-right col-importe">${money(total)}</td>
                        <td class="text-right">${money(abono)}</td>
                        <td class="text-right">${money(quedo)}</td>
                    </tr>
            `;
        }).join('');

        const cobrosCruzadosHtml = `
            <div class="pdf-section">
                <div class="pdf-section-title cz-title">
                    <span>*** Cobros Cruzados ***</span>
                    <span class="cz-count">${crossPayments.length} pedido(s)</span>
                </div>
                <div class="cz-subhead">Pedidos de esta sucursal cobrados en otra &mdash; no entran a esta caja</div>
                <div style="overflow-x:auto">
                    <table class="pdf-table sub">
                        <thead>
                            <tr>
                                <th>Pedido</th>
                                <th>Cliente</th>
                                <th>Cobrado en</th>
                                <th class="text-right">Total</th>
                                <th class="text-right">Abono</th>
                                <th class="text-right">Quedó</th>
                            </tr>
                        </thead>
                        <tbody>${crossPayments.length > 0 ? crossRows : `<tr><td colspan="6" style="text-align:center;padding:12px;font-style:italic">Sin cobros cruzados en esta fecha</td></tr>`}</tbody>
                    </table>
                </div>
            </div>
        `;

        // === COTIZACIONES (no suman a la venta) ===
        const quotesTotal = quoteOrders.reduce((s, o) => s + parseFloat(o.total || 0), 0);
        const quotesRows = quoteOrders.map(o => `
            <tr>
                <td>${o.folio}</td>
                <td>${horaPedido(o)}</td>
                <td>${o.client || '&mdash;'}</td>
                <td class="text-center">${statusMap[o.status] || 'Cotización'}</td>
                <td class="text-right col-importe">${money(o.total)}</td>
                <td class="text-right">${o.method || '&mdash;'}</td>
            </tr>
        `).join('');

        const cotizacionesSectionHtml = quoteOrders.length > 0 ? `
            <div class="pdf-section" style="margin-bottom:14px">
                <div class="pdf-section-title cz-title" style="display:flex;justify-content:space-between;align-items:center">
                    <span>Cotizaciones <span style="text-transform:none;letter-spacing:0;font-weight:400">(no suman a la venta)</span></span>
                    <span class="cz-count">${quoteOrders.length} pedido(s)</span>
                </div>
                <div style="overflow-x:auto">
                    <table class="pdf-table sub">
                        <thead>
                            <tr>
                                <th>Pedido</th>
                                <th>Hora</th>
                                <th>Cliente</th>
                                <th class="text-center">Estado</th>
                                <th class="text-right">Total</th>
                                <th class="text-right">Método</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${quotesRows}
                            <tr class="cz-total-row">
                                <td colspan="4">TOTAL COTIZADO</td>
                                <td class="text-right col-importe">${money(quotesTotal)}</td>
                                <td></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        ` : '';

        // === RESUMEN DEL DÍA ===
        const pay = res.payments || {};
        const mCash = pay.cash || {}, mCard = pay.card || {}, mTransfer = pay.transfer || {};
        const cobrado    = parseFloat(mCash.amount || 0) + parseFloat(mCard.amount || 0) + parseFloat(mTransfer.amount || 0);
        // La Venta Bruta ya trae los descuentos aplicados (importe - descuentos).
        const ventaBruta = parseFloat(ventas.venta_bruta || 0);
        const pendiente  = ventasTotales.quedo;
        // Abonos anteriores = lo cobrado hoy de pedidos de días previos (grupo del Desglose de Pedidos).
        // Es dinero recibido hoy, no venta de hoy: por eso "En Caja" (que los suma) puede exceder
        // la Venta Bruta del día y no cierra contra Pendiente cuando hay abonos previos.
        const cruzadosMonto = crossPrev.abono;
        // Dinero que efectivamente entró hoy: cobros de pedidos del día + abonos a pedidos anteriores.
        const enCajaHoy    = cobrado + cruzadosMonto;
        const fondoInicial = parseFloat(caja.efectivo_inicial || 0);
        // Estado de cuentas por SALDO al corte (consistente con la columna Estado de la tabla),
        // no por el status del pedido: un pedido entregado con saldo sigue siendo pendiente.
        const cuPagadas   = salesOrders.filter(o => saldoPedido(o) <= 0.005).length;
        const cuPend      = salesOrders.filter(o => saldoPedido(o) > 0.005).length;
        const cuCotiz     = quoteOrders.length;
        const cuDescuento = salesOrders.filter(o => parseFloat(o.discount || 0) > 0.005).length;
        const cuCancel    = cancelledOrders.length;
        // Ticket promedio sobre la venta neta de las cuentas del día (excluye cotizaciones y cancelados),
        // igual que el subtotal del desglose de pedidos.
        const ticketProm  = salesOrders.length > 0 ? ventasTotales.importe / salesOrders.length : 0;

        // "Venta Bruta (teórica)": todo lo vendido en productos hoy (con descuentos ya
        // aplicados), se haya cobrado o no. Lleva el mismo highlight gris que la columna
        // Importe del desglose porque es la suma de esa columna. "EN CAJA" es lo contrario:
        // solo el dinero que entró hoy.
        const rTotales = `
            <div class="pdf-section">
                <div class="pdf-section-title cz-title">Totales</div>
                <div class="cz-subhead">Venta teórica (lo vendido hoy, cobrado o no) vs dinero recibido</div>
                <div class="pdf-section-body">
                    ${kv('Venta Bruta (teórica)', money(ventaBruta), { highlight: true })}
                    ${kv('Pendiente', money(pendiente))}
                    ${kv('Pedidos del día', money(cobrado))}
                    ${kv('Abonos ant.', money(cruzadosMonto))}
                    ${kv('EN CAJA', money(enCajaHoy), { total: true, highlight: true })}
                </div>
            </div>
        `;

        const mpRow = (label, count, amount) => `
            <div class="pdf-kv">
                <span class="kv-label">${label} <span class="cz-mp-count">${count}</span></span>
                <span class="kv-value">${money(amount)}</span>
            </div>
        `;

        // Cada metodo suma lo cobrado de pedidos del dia + los abonos a pedidos anteriores
        // que entraron por ese mismo metodo (backend: payments.*.prev_amount / prev_count).
        const mpTotal = (m) => parseFloat(m.amount || 0) + parseFloat(m.prev_amount || 0);
        const mpCount = (m) => parseInt(m.count || 0) + parseInt(m.prev_count || 0);

        const rMetodos = `
            <div class="pdf-section">
                <div class="pdf-section-title cz-title">Métodos de Pago</div>
                <div class="cz-subhead">El dinero que entró hoy</div>
                <div class="pdf-section-body">
                    ${mpRow('Efectivo', mpCount(mCash), mpTotal(mCash))}
                    ${mpRow('Tarjeta', mpCount(mCard), mpTotal(mCard))}
                    ${mpRow('Transfer.', mpCount(mTransfer), mpTotal(mTransfer))}
                    ${kv('ENTRÓ A CAJA', money(enCajaHoy), { total: true })}
                    ${kv('Fondo inicial', money(fondoInicial))}
                </div>
            </div>
        `;

        const rCuentas = `
            <div class="pdf-section">
                <div class="pdf-section-title cz-title">Estado de Cuentas</div>
                <div class="cz-subhead">Por saldo al corte</div>
                <div class="pdf-section-body">
                    ${kv('Pagadas', cuPagadas)}
                    ${kv('Pendientes', cuPend)}
                    ${kv('Cotizaciones', cuCotiz)}
                    ${kv('TOTAL', cuPagadas + cuPend + cuCotiz, { total: true })}
                    ${kv('Canceladas', cuCancel)}
                    ${kv('Con descuento', cuDescuento)}
                    ${kv('Ticket promedio', money(ticketProm))}
                </div>
            </div>
        `;

        const resumenSectionHtml = `
            <div class="pdf-section" style="margin-bottom:14px">
                <div class="pdf-section-title cz-title" style="display:flex;justify-content:space-between;align-items:center">
                    <span>Resumen del Día</span>
                    <span class="cz-count">${moment(c.closure_date).format('DD/MM/YYYY')} &middot; ${res.subsidiary_name || ''}</span>
                </div>
                <div class="pdf-section-body">
                    <div class="cz-resumen">
                        ${rTotales}
                        ${rMetodos}
                        ${rCuentas}
                    </div>
                </div>
            </div>
        `;

        const html = `
            ${this.reportToolbar()}
            <div id="reportZoomWrap" style="zoom:${this._reportZoom / 100}">
            <div id="ticketDailyClose" class="pdf-document">
                <div class="pdf-header">
                    <div>
                        <h2>CORTE Z</h2>
                        <div class="meta">Folio cierre: <span>${c && c.id ? '#' + String(c.id).padStart(3, '0') : '&mdash;'}</span></div>
                        <div class="meta">Sucursal: <span>${res.subsidiary_name || ''}</span></div>
                        <div class="meta">${res.company_name || ''}</div>
                    </div>
                    <div style="text-align:right">
                        <div class="meta">Fecha: <span>${moment(c.closure_date).format('DD/MM/YYYY')}</span></div>
                        <div class="meta">Cerrado por: <span>${c.closed_by || 'Admin'} &mdash; ${moment(c.created_at).format('hh:mm A')}</span></div>
                        <div class="meta">Generado: <span>${moment().format('DD/MM/YYYY hh:mm A')}</span></div>
                    </div>
                </div>

                ${desgloseSectionHtml}
                ${cobrosCruzadosHtml}
                ${cotizacionesSectionHtml}
                ${shiftsTableHtml}
                ${resumenSectionHtml}

                <div class="pdf-footer">
                    <span>&mdash; Fin del reporte &middot; Huubie &mdash;</span>
                    <span>Generado: ${moment().format('DD/MM/YYYY hh:mm A')}</span>
                </div>
            </div>
            </div>
        `;

        $('#' + containerId).html(html);
    }


    toggleOrdersBreakdown() {
        const body  = $('#ordersBreakdownBody');
        const arrow = $('#ordersBreakdownArrow');
        body.toggleClass('hidden');
        arrow.css('transform', body.hasClass('hidden') ? '' : 'rotate(180deg)');
    }

    printDaily() {
        // #ticketDailyClose lo comparten el Corte Z (con .pdf-document) y el ticket de turno
        // que arma app.viewShiftPreview(); cada uno se imprime con sus propios estilos.
        const report = document.getElementById('ticketDailyClose');
        if (!report) {
            Swal.fire({ title: 'Sin contenido', text: 'No hay nada para imprimir.', icon: 'warning', background: '#1F2A37', color: '#fff', confirmButtonColor: '#ea580c' });
            return;
        }

        const isPdfDoc = report.classList.contains('pdf-document');
        // Corte Z: se imprime con los estilos pdf-* ya en su variante clara (documento).
        const headAssets = isPdfDoc
            ? `<style>${this.pdfBaseCss()} ${this.pdfPrintCss()}</style>`
            : `<script src="https://cdn.tailwindcss.com"><\/script>`;
        // Tamano de hoja por defecto: Carta (Letter) para el Corte Z; el turno usa hoja angosta automatica.
        const marginMm = 8;
        const pageCss = isPdfDoc
            ? `@page { size: letter portrait; margin: ${marginMm}mm; }`
            : `@page { size: auto; margin: 4mm; }`;
        // En pantalla (ventana previa) el Corte Z se ve como una hoja carta centrada, del tamano real de impresion.
        const screenCss = isPdfDoc ? `
            @media screen {
                body { background: #525659; margin: 0; padding: 24px 0; }
                #ticketDailyClose { width: 816px !important; max-width: 816px !important; margin: 0 auto !important; box-shadow: 0 0 14px rgba(0,0,0,0.45); }
            }
        ` : '';
        const printWindow = window.open('', '', 'height=900,width=900');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Corte Z</title>
                    ${headAssets}
                    <style>${pageCss} ${screenCss} @media print { body { margin: 0; background: #fff; } #ticketDailyClose { border: none !important; box-shadow: none !important; } }</style>
                </head>
                <body class="p-4">${report.outerHTML}</body>
            </html>
        `);
        printWindow.document.close();
        setTimeout(() => { printWindow.focus(); printWindow.print(); }, 600);
    }

    onShiftSelectorChange(value) {
        if (value === 'daily') {
            this.renderDaily();
        } else {
            app._selectedShiftId = value;
            app.viewShiftPreview();
        }
    }

    // Corte de Caja

    async showCorteCaja() {
        let rangePicker     = getDataRangePicker("calendarDailyClose");
        let date            = rangePicker.fi;
        let subsidiaries_id = (rol == 1 || rol == 2 || rol == 3 || rol == 6 || rol == 7) ? $('#subsidiariesDailyClose').val() : null;

        $('#ticketModeBar').addClass('hidden');
        $('#ticketContainer').html(`
            <div class="text-center text-gray-400 py-16">
                <div class="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p>Generando corte de caja...</p>
            </div>
        `);

        const data = await useFetch({ url: this.api, data: { opc: 'showCorteCaja', date: date, subsidiaries_id: subsidiaries_id } });

        if (data.status !== 200) {
            $('#ticketContainer').html(`<p class="text-center text-red-400 py-10">${data.message || 'Error al generar reporte'}</p>`);
            return;
        }

        this._corteCajaData = data;
        this.renderCorteCaja(data);
    }

    renderCorteCaja(data) {
        const c   = data.cuentas;
        const cj  = data.caja;
        const fp  = data.forma_pago;
        const cat = data.ventas_categoria;
        const shifts = data.shifts || [];
        const fecha  = moment(data.date).format('DD/MM/YYYY');

        const sectionClass = 'bg-white rounded-lg border border-gray-200 p-4 mb-4';
        const headerClass  = 'text-xs font-bold uppercase tracking-wide text-purple-700 border-b border-gray-200 pb-2 mb-3';
        const rowClass     = 'flex justify-between text-xs py-0.5';
        const valBold      = 'font-semibold text-gray-900';
        const valNormal    = 'text-gray-700';

        const row = (label, value, bold = false) =>
            `<div class="${rowClass}"><span class="${valNormal}">${label}</span><span class="${bold ? valBold : valNormal}">${value}</span></div>`;

        const moneyRow = (label, amount, bold = false) =>
            row(label, formatPrice(amount), bold);

        // Seccion CUENTAS
        const cuentasHtml = `
            <div class="${sectionClass}">
                <div class="${headerClass}">Cuentas</div>
                ${row('Normales', c.normales)}
                ${row('Canceladas', c.canceladas)}
                ${row('Con Descuento', c.con_descuento)}
                ${moneyRow('Cuenta Promedio', c.cuenta_promedio)}
                ${row('Folio Inicial', c.folio_inicial || '-')}
                ${row('Folio Final', c.folio_final || '-')}
                <div class="border-t border-gray-100 mt-2 pt-2">
                    ${moneyRow('Total Ventas', c.total_ventas, true)}
                </div>
            </div>
        `;

        // Seccion CAJA
        const cajaHtml = `
            <div class="${sectionClass}">
                <div class="${headerClass}">Caja</div>
                ${moneyRow('Efectivo Inicial', cj.efectivo_inicial)}
                ${moneyRow('Efectivo', cj.efectivo)}
                ${moneyRow('Tarjeta', cj.tarjeta)}
                ${moneyRow('Transferencia', cj.transferencia)}
                <div class="border-t border-gray-100 mt-2 pt-2">
                    ${moneyRow('Saldo Final', cj.saldo_final, true)}
                </div>
                <div class="border-t border-gray-100 mt-2 pt-2">
                    ${moneyRow('Total Descuentos', cj.total_descuentos)}
                </div>
            </div>
        `;

        // Seccion FORMA DE PAGO
        let fpRows = '';
        let fpTotal = 0;
        Object.keys(fp).forEach(key => {
            fpRows += moneyRow(key, fp[key]);
            fpTotal += fp[key];
        });

        const formaPagoHtml = `
            <div class="${sectionClass}">
                <div class="${headerClass}">Forma de Pago - Ventas</div>
                ${fpRows}
                <div class="border-t border-gray-100 mt-2 pt-2">
                    ${moneyRow('Total', fpTotal, true)}
                </div>
            </div>
        `;

        // Seccion VENTAS POR CATEGORIA
        let catRows = '';
        let catTotal = 0;
        Object.keys(cat).forEach(key => {
            catRows += moneyRow(key, cat[key]);
            catTotal += cat[key];
        });

        const ventasCatHtml = `
            <div class="${sectionClass}">
                <div class="${headerClass}">Ventas por Categoría</div>
                ${catRows}
                <div class="border-t border-gray-100 mt-2 pt-2">
                    ${moneyRow('Total', catTotal, true)}
                </div>
            </div>
        `;

        // Seccion CORTE DE CAJA X (Turnos)
        let shiftsRows = '';
        shifts.forEach(shift => {
            const apertura = shift.apertura ? moment(shift.apertura).format('hh:mm A') : '-';
            const cierre   = shift.cierre ? moment(shift.cierre).format('hh:mm A') : 'Abierto';
            const statusBg = shift.status === 'closed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700';

            // Botón de recálculo del corte: solo admin (rol == 1).
            const recalcBtn = (typeof rol !== 'undefined' && rol == 1) ? `
                    <div class="mt-2 text-right">
                        <button class="text-[10px] font-semibold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1" onclick="cierre.recalcShift(${shift.id})">
                            ${lucideIcon('rotate-cw')} Recalcular corte
                        </button>
                    </div>` : '';

            shiftsRows += `
                <div class="bg-gray-50 rounded-lg p-3 mb-2 border border-gray-100">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs font-bold text-gray-800">${shift.cajero || 'Sin cajero'}</span>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold ${statusBg}">${shift.status === 'closed' ? 'CERRADO' : 'ABIERTO'}</span>
                    </div>
                    <div class="grid grid-cols-2 gap-1 text-[11px]">
                        <div><span class="text-gray-500">Apertura:</span> <span class="font-medium">${apertura}</span></div>
                        <div><span class="text-gray-500">Cierre:</span> <span class="font-medium">${cierre}</span></div>
                        <div><span class="text-gray-500">Fondo:</span> <span class="font-medium">${formatPrice(shift.fondo_caja || 0)}</span></div>
                        <div><span class="text-gray-500">Pedidos:</span> <span class="font-medium">${shift.total_orders || 0}</span></div>
                    </div>
                    <div class="border-t border-gray-200 mt-2 pt-2 grid grid-cols-3 gap-1 text-[11px]">
                        <div class="text-center"><div class="text-gray-500">Efectivo</div><div class="font-bold">${formatPrice(shift.efectivo || 0)}</div></div>
                        <div class="text-center"><div class="text-gray-500">Tarjeta</div><div class="font-bold">${formatPrice(shift.tarjeta || 0)}</div></div>
                        <div class="text-center"><div class="text-gray-500">Transferencia</div><div class="font-bold">${formatPrice(shift.transferencia || 0)}</div></div>
                    </div>
                    <div class="border-t border-gray-200 mt-2 pt-2 flex justify-between">
                        <span class="text-xs font-bold text-gray-700">Total</span>
                        <span class="text-xs font-bold text-gray-900">${formatPrice(shift.total || 0)}</span>
                    </div>
                    ${recalcBtn}
                </div>
            `;
        });

        const shiftsHtml = `
            <div class="${sectionClass}">
                <div class="${headerClass}">Corte de Caja X - Turnos (${shifts.length})</div>
                ${shiftsRows || '<p class="text-xs text-gray-400 text-center py-3">Sin turnos registrados</p>'}
            </div>
        `;

        const html = `
            <div id="corteCajaReport" class="max-w-lg mx-auto">
                <div class="text-center mb-4">
                    <h2 class="text-base font-bold text-gray-900">CORTE DE CAJA</h2>
                    <p class="text-xs text-gray-500">${data.company_name || ''}</p>
                    <p class="text-xs text-gray-500">${data.subsidiary_name} — ${fecha}</p>
                </div>
                ${cuentasHtml}
                ${cajaHtml}
                ${formaPagoHtml}
                ${ventasCatHtml}
                ${shiftsHtml}
                <div class="text-center mt-2 mb-4">
                    <button class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg" onclick="cierre.showCorteCajaDetail()">
                        <i class="icon-doc-text mr-1"></i> Ver Detalle de Cuentas
                    </button>
                </div>
                <div id="corteCajaDetailContainer"></div>
                <p class="text-[9px] text-gray-400 text-center mt-4">Generado: ${moment().format('DD/MM/YYYY HH:mm:ss')}</p>
            </div>
        `;

        $('#ticketContainer').html(html);
        $('#btnPrintTicket').prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');
    }

    async showCorteCajaDetail() {
        let rangePicker     = getDataRangePicker("calendarDailyClose");
        let date            = rangePicker.fi;
        let subsidiaries_id = (rol == 1 || rol == 2 || rol == 3 || rol == 6 || rol == 7) ? $('#subsidiariesDailyClose').val() : null;

        $('#corteCajaDetailContainer').html(`
            <div class="text-center text-gray-400 py-4">
                <div class="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p class="text-xs">Cargando detalle...</p>
            </div>
        `);

        const data = await useFetch({ url: this.api, data: { opc: 'lsCorteCaja', date: date, subsidiaries_id: subsidiaries_id } });

        if (!data.row || data.row.length === 0) {
            $('#corteCajaDetailContainer').html('<p class="text-xs text-gray-400 text-center py-4">Sin registros para esta fecha</p>');
            return;
        }

        let totalImporte = 0, totalEfectivo = 0, totalTarjeta = 0, totalTransferencia = 0, totalDescuento = 0;

        const rows = data.row.map(r => {
            const importe = parseFloat(r.Importe?.html?.replace(/[^0-9.-]/g, '') || 0);
            const efectivo = parseFloat(r.Efectivo?.html?.replace(/[^0-9.-]/g, '') || 0);
            const tarjeta = parseFloat(r.Tarjeta?.html?.replace(/[^0-9.-]/g, '') || 0);
            const transferencia = parseFloat(r.Transferencia?.html?.replace(/[^0-9.-]/g, '') || 0);
            const descuento = parseFloat(r.Descuento?.html?.replace(/[^0-9.-]/g, '') || 0);

            totalImporte += importe;
            totalEfectivo += efectivo;
            totalTarjeta += tarjeta;
            totalTransferencia += transferencia;
            totalDescuento += descuento;

            return `
                <tr class="border-b border-gray-100 hover:bg-gray-50">
                    <td class="py-1.5 px-2 text-center">${r.Folio}</td>
                    <td class="py-1.5 px-2">${r.Fecha}</td>
                    <td class="py-1.5 px-2 text-center">${r.Estado}</td>
                    <td class="py-1.5 px-2 text-end">${r.Descuento?.html || '-'}</td>
                    <td class="py-1.5 px-2 text-end">${r.Importe?.html || '-'}</td>
                    <td class="py-1.5 px-2 text-end">${r.Efectivo?.html || '-'}</td>
                    <td class="py-1.5 px-2 text-end">${r.Tarjeta?.html || '-'}</td>
                    <td class="py-1.5 px-2 text-end">${r.Transferencia?.html || '-'}</td>
                </tr>
            `;
        }).join('');

        const html = `
            <div class="bg-white rounded-lg border border-gray-200 p-4 mb-4 overflow-x-auto">
                <div class="text-xs font-bold uppercase tracking-wide text-purple-700 border-b border-gray-200 pb-2 mb-3">Detalle de Cuentas</div>
                <table class="w-full text-[11px] text-gray-700">
                    <thead>
                        <tr class="bg-gray-100 text-gray-600 uppercase text-[10px]">
                            <th class="py-2 px-2 text-center">Folio</th>
                            <th class="py-2 px-2 text-left">Fecha</th>
                            <th class="py-2 px-2 text-center">Estado</th>
                            <th class="py-2 px-2 text-end">Descuento</th>
                            <th class="py-2 px-2 text-end">Importe</th>
                            <th class="py-2 px-2 text-end">Efectivo</th>
                            <th class="py-2 px-2 text-end">Tarjeta</th>
                            <th class="py-2 px-2 text-end">Transferencia</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                    <tfoot>
                        <tr class="bg-gray-100 font-bold text-gray-900 text-[11px]">
                            <td class="py-2 px-2" colspan="3">TOTALES</td>
                            <td class="py-2 px-2 text-end">${formatPrice(totalDescuento)}</td>
                            <td class="py-2 px-2 text-end">${formatPrice(totalImporte)}</td>
                            <td class="py-2 px-2 text-end">${formatPrice(totalEfectivo)}</td>
                            <td class="py-2 px-2 text-end">${formatPrice(totalTarjeta)}</td>
                            <td class="py-2 px-2 text-end">${formatPrice(totalTransferencia)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        $('#corteCajaDetailContainer').html(html);
    }

    reopenClosure(closureId) {
        const modal = bootbox.dialog({
            title: 'Reabrir Cierre Diario',
            message: `
                <p class="text-sm text-gray-300 mb-3">Indica el motivo de la reapertura:</p>
                <textarea id="reopenReason" class="w-full bg-[#151d2a] border border-gray-600 rounded-lg p-3 text-white text-sm focus:border-amber-500 focus:outline-none resize-none" rows="4" placeholder="Motivo de reapertura..."></textarea>
                <p id="reopenError" class="text-red-400 text-xs mt-1 hidden">Debes indicar un motivo</p>
            `,
            closeButton: true,
            buttons: {
                cancel: {
                    label: 'Cancelar',
                    className: 'btn bg-gray-600 hover:bg-gray-700 text-white border-0'
                },
                confirm: {
                    label: 'Reabrir',
                    className: 'btn bg-amber-600 hover:bg-amber-700 text-white border-0',
                    callback: () => {
                        const reason = $('#reopenReason').val();
                        if (!reason || reason.trim() === '') {
                            $('#reopenError').removeClass('hidden');
                            $('#reopenReason').addClass('!border-red-500');
                            return false;
                        }
                        this._executeReopen(closureId, reason, modal);
                        return false;
                    }
                }
            }
        });

        modal.on('shown.bs.modal', () => {
            $('#reopenReason').focus();
        });
    }

    async _executeReopen(closureId, reason, modal) {
        const res = await useFetch({ url: this.api, data: { opc: 'statusCierre', closure_id: closureId, reason: reason } });
        modal.modal('hide');

        if (res.status === 200) {
            Swal.fire({ title: 'Cierre reabierto', text: res.message, icon: 'success', background: '#1F2A37', color: '#fff', confirmButtonColor: '#d97706' });
            dailyClosure = { is_closed: false };
            app.updateDailyClosureStatus();
            app.loadShifts();
        } else {
            Swal.fire({ title: 'Error', text: res.message || 'Error al reabrir', icon: 'error', background: '#1F2A37', color: '#fff' });
        }
    }

    recalcShift(shiftId) {
        Swal.fire({
            title: 'Recalcular corte del turno',
            html: 'Se recalcularán <b>efectivo</b>, <b>tarjeta</b> y <b>transferencia</b> de este turno a partir de los pagos actuales.<br><span class="text-xs text-gray-400">Úsalo si corregiste un método de pago después de cerrar el turno.</span>',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Recalcular',
            cancelButtonText: 'Cancelar',
            background: '#1F2A37',
            color: '#fff',
            confirmButtonColor: '#7c3aed',
            cancelButtonColor: '#4b5563'
        }).then(result => {
            if (result.isConfirmed) {
                this._executeRecalc(shiftId);
            }
        });
    }

    async _executeRecalc(shiftId) {
        const res = await useFetch({ url: this.api, data: { opc: 'recalcShift', shift_id: shiftId } });

        if (res.status === 200) {
            Swal.fire({ title: 'Corte recalculado', text: res.message, icon: 'success', background: '#1F2A37', color: '#fff', confirmButtonColor: '#7c3aed' });
            this.showCorteCaja();
        } else {
            Swal.fire({ title: 'Error', text: res.message || 'No se pudo recalcular el corte', icon: 'error', background: '#1F2A37', color: '#fff' });
        }
    }
}
