let apiCierre = 'ctrl/ctrl-cierre.php';

class Cierre {
    constructor(api) {
        this.api = api;
        this._closureData = null;
        this._closureResponse = null;
        this._dailyView = 'reporte';
        this._reportZoom = 80;
    }

    async initCierre() {
        let rangePicker     = getDataRangePicker("calendarDailyClose");
        let date            = rangePicker.fi;
        let subsidiaries_id = rol == 1 ? $('#subsidiariesDailyClose').val() : null;

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
        this.renderChecklist(data, date, subsidiaries_id);
    }

    renderChecklist(data, date, subsidiaries_id) {
        const svgOk = `<svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>`;
        const svgWarn = `<svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`;
        const svgBlock = `<svg class="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>`;

        let checksHtml = '';
        data.checks.forEach((check, idx) => {
            if (check.ok) {
                checksHtml += `
                    <div class="flex items-center gap-3 bg-[#1a2332] rounded-lg p-3 border border-green-600/30">
                        <div class="w-7 h-7 rounded-full bg-green-600/20 flex items-center justify-center flex-shrink-0">${svgOk}</div>
                        <div class="flex-1">
                            <p class="text-sm font-semibold text-white">${check.label}</p>
                            <p class="text-[11px] text-gray-500">${check.detail || ''}</p>
                        </div>
                    </div>`;
            } else if (check.blocker) {
                checksHtml += `
                    <div class="flex items-center gap-3 bg-[#1a2332] rounded-lg p-3 border border-red-600/30">
                        <div class="w-7 h-7 rounded-full bg-red-600/20 flex items-center justify-center flex-shrink-0">${svgBlock}</div>
                        <div class="flex-1">
                            <p class="text-sm font-semibold text-white">${check.label}</p>
                            <p class="text-[11px] text-red-400/70">Bloquea el cierre</p>
                        </div>
                    </div>`;
            } else {
                let itemsHtml = '';
                if (check.items && check.items.length > 0) {
                    if (check.key === 'pending_balance') {
                        itemsHtml = check.items.map(item => `
                            <div class="flex items-center justify-between bg-[#151d2a] rounded-md px-3 py-2">
                                <div>
                                    <p class="text-xs font-semibold text-white">${item.folio || '-'}</p>
                                    <p class="text-[10px] text-gray-500">${item.date ? moment(item.date).format('DD/MM/YYYY hh:mm A') : ''}</p>
                                </div>
                                <div class="text-right">
                                    <p class="text-xs font-bold text-white">${formatPrice(item.total)}</p>
                                    <p class="text-[10px] text-red-400">Saldo: ${formatPrice(item.pending)}</p>
                                </div>
                            </div>
                        `).join('');
                    } else {
                        itemsHtml = check.items.map(item => `
                            <div class="flex items-center justify-between bg-[#151d2a] rounded-md px-3 py-2">
                                <div>
                                    <p class="text-xs font-semibold text-white">${item.folio || item.name || '-'}</p>
                                    <p class="text-[10px] text-gray-500">${item.date ? moment(item.date).format('DD/MM/YYYY hh:mm A') : (item.opened_at ? moment(item.opened_at).format('DD/MM/YYYY hh:mm A') : '')}</p>
                                </div>
                                <span class="text-xs font-bold text-white">${item.total ? formatPrice(item.total) : (item.employee || '')}</span>
                            </div>
                        `).join('');
                    }
                }

                checksHtml += `
                    <div class="bg-[#1a2332] rounded-lg border border-yellow-600/30 overflow-hidden">
                        <div class="flex items-center gap-3 p-3 cursor-pointer hover:bg-[#1e2a3a] transition-colors" onclick="cierre.toggleDetail('check-${idx}')">
                            <div class="w-7 h-7 rounded-full bg-yellow-600/20 flex items-center justify-center flex-shrink-0">${svgWarn}</div>
                            <div class="flex-1">
                                <p class="text-sm font-semibold text-white">${check.label}</p>
                                <p class="text-[11px] text-yellow-400/70">No bloquea el cierre</p>
                            </div>
                            <svg id="arrow-check-${idx}" class="w-4 h-4 text-gray-500 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                        </div>
                        <div id="detail-check-${idx}" class="hidden border-t border-yellow-600/20 px-3 pb-3 pt-2 space-y-1.5">${itemsHtml}</div>
                    </div>`;
            }
        });

        const s = data.summary;
        const html = `
            <h2 class="text-base font-bold text-white mb-1">Checklist de Cierre</h2>
            <p class="text-xs text-gray-500 mb-4">${data.subsidiary_name} — ${moment(date).format('DD/MM/YYYY')}</p>
            <div class="grid grid-cols-3 gap-3 mb-3">
                <div class="bg-[#1a2332] rounded-lg p-3 text-center border border-gray-700/50">
                    <p class="text-lg font-bold text-green-400">${formatPrice(s.total_sales)}</p>
                    <p class="text-[10px] text-gray-500">Ventas</p>
                </div>
                <div class="bg-[#1a2332] rounded-lg p-3 text-center border border-gray-700/50">
                    <p class="text-lg font-bold text-white">${s.total_orders}</p>
                    <p class="text-[10px] text-gray-500">Pedidos</p>
                </div>
                <div class="bg-[#1a2332] rounded-lg p-3 text-center border border-gray-700/50">
                    <p class="text-lg font-bold text-white">${s.total_shifts}</p>
                    <p class="text-[10px] text-gray-500">Turnos</p>
                </div>
            </div>
            <div class="space-y-2.5 mb-6">${checksHtml}</div>
            <div class="flex gap-3">
                <button class="flex-1 py-2 rounded-lg text-sm font-semibold bg-gray-600 hover:bg-gray-700 text-white" onclick="cierre.cancelChecklist()">Cancelar</button>
                <button class="flex-1 py-2 rounded-lg text-sm font-semibold ${data.can_close ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-600 opacity-50 cursor-not-allowed'} text-white" ${data.can_close ? '' : 'disabled'} onclick="cierre.confirmClose('${date}', '${subsidiaries_id}')">Confirmar Cierre</button>
            </div>
        `;

        $('#ticketContainer').html(html);
        $('#btnOpenShift, #btnCloseShift, #btnPrintTicket').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
    }

    toggleDetail(id) {
        const detail = $(`#detail-${id}`);
        const arrow  = $(`#arrow-${id}`);
        detail.toggleClass('hidden');
        arrow.css('transform', detail.hasClass('hidden') ? '' : 'rotate(180deg)');
    }

    cancelChecklist() {
        $('#btnCerrarDia').prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');
        app.loadShifts();
    }

    async confirmClose(date, subsidiariesId) {
        const s = this._closureData.summary;
        const result = await Swal.fire({
            title: 'Confirmar Cierre Diario',
            html: `
                <div class="text-left text-sm">
                    <p class="mb-2">Se consolidaran <strong>${s.total_shifts} turno(s)</strong> con <strong>${s.total_orders} pedido(s)</strong>.</p>
                    <p class="text-gray-400 text-xs">Total del dia: <strong>${formatPrice(s.total_sales)}</strong></p>
                    <p class="text-red-400 text-xs mt-2">Esta accion no se puede deshacer facilmente.</p>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ea580c',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Si, cerrar dia',
            cancelButtonText: 'Cancelar',
            background: '#1F2A37',
            color: '#fff'
        });

        if (!result.isConfirmed) return;

        const res = await useFetch({ url: this.api, data: { opc: 'addCierre', date: date, subsidiaries_id: subsidiariesId } });

        if (res.status === 200) {
            Swal.fire({ title: 'Cierre realizado', text: res.message, icon: 'success', background: '#1F2A37', color: '#fff', confirmButtonColor: '#ea580c' });
            dailyClosure = { is_closed: true, closure_id: res.closure_id };
            await this.loadClosedView(date, subsidiariesId);
        } else {
            Swal.fire({ title: 'Error', text: res.message || 'Error al realizar el cierre', icon: 'error', background: '#1F2A37', color: '#fff' });
            this.cancelChecklist();
        }
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

        let btnArea = $('#btnCerrarDia').parent();
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
        this._dailyView = 'reporte';
        this.renderDaily();
    }

    renderDaily() {
        if (this._dailyView === 'ticket') {
            this.renderDailyTicket(this._closureResponse);
        } else {
            this.renderExecutiveSummary(this._closureResponse);
        }
    }

    setDailyView(mode) {
        this._dailyView = mode;
        this.renderDaily();
    }

    dailyViewToggle() {
        const active   = 'bg-purple-600 text-white shadow-sm';
        const inactive = 'text-gray-400 hover:text-gray-200';
        const isReport = this._dailyView !== 'ticket';
        const maxed    = this._reportZoom >= 100;

        // Controles de zoom: solo aplican a la vista Reporte (Corte Z).
        const zoomBar = !isReport ? '' : `
            <div class="absolute right-0 inline-flex items-center gap-0.5 bg-[#1a2332] p-1 rounded-lg border border-gray-700/50 text-[11px]">
                <button class="p-1 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-700/40 transition-all" title="Alejar" onclick="cierre.zoomReport(-10)">${lucideIcon('zoom-out', 'w-3.5 h-3.5')}</button>
                <button id="reportZoomPct" class="px-1 py-0.5 rounded-md font-semibold text-gray-300 hover:text-white min-w-[36px] text-center transition-all" title="Restablecer zoom" onclick="cierre.setReportZoom(80)">${this._reportZoom}%</button>
                <button class="p-1 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-700/40 transition-all" title="Acercar" onclick="cierre.zoomReport(10)">${lucideIcon('zoom-in', 'w-3.5 h-3.5')}</button>
                <button id="btnReportZoomMax" class="p-1 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-700/40 transition-all" title="${maxed ? 'Minimizar' : 'Maximizar'}" onclick="cierre.toggleReportZoomMax()">${lucideIcon(maxed ? 'minimize' : 'maximize', 'w-3.5 h-3.5')}</button>
            </div>
        `;

        return `
            <div class="relative flex justify-center items-center mb-3">
                <div class="inline-flex items-center gap-1 bg-[#1a2332] p-1 rounded-lg border border-gray-700/50 text-[11px]">
                    <button class="px-4 py-1 rounded-md font-semibold transition-all ${isReport ? active : inactive}" onclick="cierre.setDailyView('reporte')">Reporte</button>
                    <button class="px-4 py-1 rounded-md font-semibold transition-all ${!isReport ? active : inactive}" onclick="cierre.setDailyView('ticket')">Ticket</button>
                </div>
                ${zoomBar}
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
        const maxed = this._reportZoom >= 100;
        $('#btnReportZoomMax').attr('title', maxed ? 'Minimizar' : 'Maximizar').html(lucideIcon(maxed ? 'minimize' : 'maximize', 'w-3.5 h-3.5'));
    }

    toggleReportZoomMax() {
        this.setReportZoom(this._reportZoom >= 100 ? 80 : 100);
    }

    // Estilos del corte Z (mismo sistema pdf-* de alpha/pedidos-reportes):
    // documento blanco tanto en pantalla como al imprimir (WYSIWYG).
    pdfBaseCss() {
        return `
            .pdf-document { background: #fff; color: #2c3e50; max-width: 1000px; margin: 0 auto; padding: 28px 32px; border-radius: 3px; box-shadow: 0 2px 12px rgba(0,0,0,0.5); font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; font-size: 13px; }
            .pdf-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 3px double #2c3e50; }
            .pdf-header h2 { font-size: 20px; font-weight: 700; color: #1a252f; letter-spacing: 1.5px; margin: 0; }
            .pdf-header .meta { font-size: 12px; color: #7f8c8d; }
            .pdf-header .meta span { color: #2c3e50; font-weight: 600; }
            .pdf-totals-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
            .pdf-totals-bar .total-item { padding: 8px 10px; background: #f7f9fb; border: 1px solid #dce3ea; border-radius: 4px; border-top: 3px solid #bdc3c7; }
            .pdf-totals-bar .total-item .label { font-size: 9px; color: #7f8c8d; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 2px; font-weight: 600; }
            .pdf-totals-bar .total-item .value { font-size: 15px; font-weight: 700; color: #2c3e50; font-family: 'Consolas', 'Courier New', monospace; }
            .pdf-totals-bar .total-item.highlight { background: #3d4f5f; border-color: #3d4f5f; border-top-color: #2c3e50; }
            .pdf-totals-bar .total-item.highlight .label { color: #b0bec5; }
            .pdf-totals-bar .total-item.highlight .value { color: #eceff1; }
            .pdf-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 18px; }
            @media (max-width: 900px) { .pdf-grid { grid-template-columns: 1fr 1fr; } }
            @media (max-width: 600px) { .pdf-grid { grid-template-columns: 1fr; } }
            .pdf-section { border: 1px solid #dce3ea; border-radius: 3px; overflow: hidden; background: #fff; }
            .pdf-section-title { background: linear-gradient(180deg, #f0f3f6 0%, #e4e9ee 100%); padding: 8px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #4a5568; border-bottom: 1px solid #d1d9e0; }
            .pdf-section-body { padding: 10px 12px; }
            .pdf-kv { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid #f0f2f5; }
            .pdf-kv:last-child { border-bottom: none; }
            .pdf-kv .kv-label { color: #5a6a7a; font-size: 12px; }
            .pdf-kv .kv-value { font-weight: 600; font-size: 13px; color: #2c3e50; text-align: right; font-family: 'Consolas', 'Courier New', monospace; }
            .pdf-kv.total-row { border-top: 1px solid #95a5a6; border-bottom: none; padding: 6px 12px 5px; margin: 4px -12px 0; background: #f7f9fb; }
            .pdf-kv.total-row .kv-label { font-weight: 700; color: #2c3e50; }
            .pdf-kv.total-row .kv-value { font-weight: 800; font-size: 14px; color: #1a252f; }
            .pdf-kv .kv-value.negative { color: #943030; }
            .pdf-sub-title { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #95a5a6; letter-spacing: 1px; margin: 8px 0 4px; padding-bottom: 3px; border-bottom: 1px solid #e8ecf0; }
            .pdf-pct-bar { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; }
            .pdf-pct-bar .bar { flex: 1; height: 5px; background: #e8ecf0; border-radius: 2px; overflow: hidden; }
            .pdf-pct-bar .bar .fill { height: 100%; border-radius: 2px; }
            .pdf-pct-bar .pct-text { font-size: 9px; color: #7f8c8d; min-width: 30px; text-align: right; font-family: 'Consolas', monospace; }
            .pdf-grid-bottom { display: grid; grid-template-columns: 1fr 2fr; gap: 12px; margin-bottom: 18px; }
            @media (max-width: 768px) { .pdf-grid-bottom { grid-template-columns: 1fr; } }
            table.pdf-table { width: 100%; border-collapse: collapse; font-size: 12px; }
            table.pdf-table thead th { background: linear-gradient(180deg, #f0f3f6 0%, #e4e9ee 100%); color: #4a5568; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; padding: 6px 10px; text-align: left; border-bottom: 1px solid #d1d9e0; }
            table.pdf-table tbody tr { border-bottom: 1px solid #f0f2f5; }
            table.pdf-table tbody tr:nth-child(even) { background: #fafbfc; }
            table.pdf-table tbody td { padding: 5px 10px; color: #2c3e50; white-space: nowrap; font-family: 'Consolas', 'Courier New', monospace; }
            table.pdf-table .text-right { text-align: right; }
            table.pdf-table .text-center { text-align: center; }
            table.pdf-table .col-importe { font-weight: 700; color: #1a252f; background: #f0f3f6; }
            table.pdf-table .col-efectivo { color: #2c3e50; font-weight: 600; }
            table.pdf-table .col-tarjeta { color: #2c3e50; font-weight: 600; }
            .pdf-footer { margin-top: 24px; padding-top: 12px; border-top: 3px double #bdc3c7; display: flex; justify-content: space-between; font-size: 10px; color: #95a5a6; letter-spacing: 0.5px; }
        `;
    }

    pdfPrintCss() {
        return `
            body { background: #fff !important; margin: 0; }
            .pdf-document { background: #fff !important; color: #2c3e50 !important; box-shadow: none !important; padding: 15px !important; max-width: 100% !important; }
            .pdf-header { border-bottom-color: #2c3e50 !important; }
            .pdf-header h2 { color: #1a252f !important; }
            .pdf-header .meta { color: #7f8c8d !important; }
            .pdf-header .meta span { color: #2c3e50 !important; }
            .pdf-totals-bar .total-item { background: #f7f9fb !important; border-color: #dce3ea !important; border-top-color: #bdc3c7 !important; }
            .pdf-totals-bar .total-item .label { color: #7f8c8d !important; }
            .pdf-totals-bar .total-item .value { color: #2c3e50 !important; }
            .pdf-totals-bar .total-item.highlight { background: #3d4f5f !important; border-color: #3d4f5f !important; border-top-color: #2c3e50 !important; }
            .pdf-totals-bar .total-item.highlight .label { color: #b0bec5 !important; }
            .pdf-totals-bar .total-item.highlight .value { color: #eceff1 !important; }
            .pdf-section { background: #fff !important; border-color: #dce3ea !important; }
            .pdf-section-title { background: linear-gradient(180deg, #f0f3f6 0%, #e4e9ee 100%) !important; color: #4a5568 !important; border-bottom-color: #d1d9e0 !important; }
            .pdf-kv { border-bottom-color: #f0f2f5 !important; }
            .pdf-kv .kv-label { color: #5a6a7a !important; }
            .pdf-kv .kv-value { color: #2c3e50 !important; }
            .pdf-kv.total-row { background: #f7f9fb !important; border-top-color: #95a5a6 !important; }
            .pdf-kv.total-row .kv-label { color: #2c3e50 !important; }
            .pdf-kv.total-row .kv-value { color: #1a252f !important; }
            .pdf-kv .kv-value.negative { color: #943030 !important; }
            .pdf-sub-title { color: #95a5a6 !important; border-bottom-color: #e8ecf0 !important; }
            .pdf-pct-bar .bar { background: #e8ecf0 !important; }
            .pdf-pct-bar .pct-text { color: #7f8c8d !important; }
            table.pdf-table thead th { background: linear-gradient(180deg, #f0f3f6 0%, #e4e9ee 100%) !important; color: #4a5568 !important; border-bottom-color: #d1d9e0 !important; }
            table.pdf-table tbody tr { border-bottom-color: #f0f2f5 !important; }
            table.pdf-table tbody tr:nth-child(even) { background: #fafbfc !important; }
            table.pdf-table tbody td { color: #2c3e50 !important; }
            table.pdf-table .col-importe { color: #1a252f !important; background: #f0f3f6 !important; }
            table.pdf-table .col-efectivo { color: #2c3e50 !important; }
            table.pdf-table .col-tarjeta { color: #2c3e50 !important; }
            .pdf-footer { border-top-color: #bdc3c7 !important; color: #95a5a6 !important; }
        `;
    }

    injectPdfStyles() {
        if ($('#pdf-cierre-styles').length) return;
        $('head').append(`<style id="pdf-cierre-styles">${this.pdfBaseCss()} @media print { ${this.pdfPrintCss()} }</style>`);
    }

    renderDailyTicket(res) {
        const c = res.closure;
        const ticketAvg = c.total_orders > 0 ? (c.total_sales / c.total_orders) : 0;

        let shiftsHtml = '';
        if (res.shifts && res.shifts.length > 0) {
            shiftsHtml = res.shifts.map(shift => `
                <div class="bg-gray-50 rounded p-2 mb-1.5">
                    <div class="flex justify-between font-semibold"><span>${shift.shift_name || moment(shift.opened_at).format('hh:mm A')}</span><span>${formatPrice(shift.total_sales || 0)}</span></div>
                    <div class="text-[10px] text-gray-500">${moment(shift.opened_at).format('hh:mm A')}${shift.closed_at ? ' - ' + moment(shift.closed_at).format('hh:mm A') : ''} | ${shift.total_orders || 0} pedidos</div>
                </div>
            `).join('');
        }

        // Pagos cruzados: mismo tratamiento que el ticket de turno (ticketShiftClose).
        const prevPayments  = res.prev_payments || [];
        const crossPayments = res.cross_payments || [];
        const money = (v) => `$${parseFloat(v || 0).toFixed(2)}`;

        let prevHtml = '';
        if (prevPayments.length > 0) {
            const prevTotal = prevPayments.reduce((sum, o) => sum + parseFloat(o.payment_real || 0), 0);

            const prevRows = prevPayments.map(o => {
                const total     = parseFloat(o.total_pay || 0);
                const discount  = parseFloat(o.discount || 0);
                const abono     = parseFloat(o.payment_real || 0);
                const paidUpto  = parseFloat(o.total_paid_upto || 0);
                const quedoRaw  = total - discount - paidUpto;
                const quedo     = quedoRaw < 0 ? 0 : quedoRaw;
                const debia     = quedo + abono;
                const liquidado = quedoRaw <= 0.005;
                const badge = liquidado
                    ? `<span class="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[9px] font-bold">LIQUIDADO</span>`
                    : `<span class="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[9px] font-bold">PENDIENTE</span>`;
                const originLine = o.is_cross
                    ? `<div class="text-[10px] text-gray-500 mb-0.5">Origen: ${o.origin_subsidiary || 'Otra sucursal'}</div>`
                    : '';
                return `
                    <div class="flex justify-between items-center mt-2 pt-1 border-t border-dashed border-gray-200">
                        <div class="italic truncate" style="max-width:150px">${o.folio || 'Folio #' + o.id}</div>
                        ${badge}
                    </div>
                    <div class="text-[10px] text-gray-500 mb-0.5">${o.client_name || 'Sin cliente'}</div>
                    ${originLine}
                    <div class="flex justify-between text-[11px]"><span class="text-gray-600">Debía</span><span>${money(debia)} <span class="text-gray-400">de ${money(total)}</span></span></div>
                    <div class="flex justify-between text-[11px] text-green-700"><span>Abonó</span><span>${money(abono)}</span></div>
                    <div class="flex justify-between text-[11px] font-semibold border-t border-dashed pt-0.5 mt-0.5"><span>Quedó</span><span>${money(quedo)}</span></div>
                `;
            }).join('');

            prevHtml = `
                <hr class="border-dashed border-t border-gray-400 my-2" />
                <div class="text-xs">
                    <div class="font-semibold mb-1">ABONOS DE PEDIDOS ANTERIORES</div>
                    ${prevRows}
                    <div class="flex justify-between items-center font-semibold border-t border-dashed pt-1 mt-1 text-green-700">
                        <div>TOTAL COBRADO</div>
                        <div>${formatPrice(prevTotal)}</div>
                    </div>
                </div>
            `;
        }

        let crossHtml = '';
        if (crossPayments.length > 0) {
            const crossTotal = crossPayments.reduce((sum, o) => sum + parseFloat(o.payment_cross || 0), 0);

            const crossRows = crossPayments.map(o => `
                <div class="flex items-center mt-2">
                    <div class="font-bold text-gray-900 truncate flex-1">${o.folio || 'Folio #' + o.id}</div>
                    <div class="text-right text-gray-900" style="width:72px">${formatPrice(o.payment_cross)}</div>
                </div>
                <div class="text-[10px] text-purple-400">${o.client_name || 'Sin cliente'}</div>
                <div class="text-[10px] text-purple-500"><i class="icon-shop"></i> Cobrado en: ${o.charged_subsidiary || 'Otra sucursal'}</div>
            `).join('');

            crossHtml = `
                <div class="bg-purple-50 border border-purple-200 rounded-lg p-3 mt-2 text-xs">
                    <div class="font-semibold text-purple-700"><i class="icon-bank"></i> COBRADO EN OTRA SUCURSAL</div>
                    <div class="text-[10px] text-purple-400 mb-1">No entra a tu caja (informativo).</div>
                    ${crossRows}
                    <div class="flex justify-between items-center font-semibold border-t border-dashed border-purple-200 pt-1 mt-2">
                        <div class="text-gray-900">Total en otra sucursal</div>
                        <div class="text-gray-900">${formatPrice(crossTotal)}</div>
                    </div>
                </div>
            `;
        }

        const html = `
            ${this.dailyViewToggle()}
            <div class="flex justify-center p-4">
                <div id="ticketPasteleria" class="bg-white p-5 rounded-lg shadow-lg text-gray-900 border border-gray-200" style="max-width: 320px; width: 100%; font-family: 'Courier New', monospace; font-size: 12px;">
                    <div class="flex flex-col items-center mb-3">
                        <div style="width:60px;height:60px;border-radius:50%;background:#7c3aed;display:flex;align-items:center;justify-content:center;" class="mb-2">
                            <span style="color:white;font-size:24px;font-weight:bold;">R</span>
                        </div>
                        <h1 class="text-sm font-bold uppercase">${res.company_name || 'Reginas Pasteleria'}</h1>
                        <div class="text-xs font-semibold">PEDIDOS DE PASTELERIA</div>
                        <div class="text-xs text-gray-600 mt-0.5">Cierre Diarios</div>
                        <div class="bg-green-100 text-green-800 px-3 py-0.5 rounded-full text-[10px] font-bold mt-1.5">CERRADO</div>
                        <div class="text-[10px] text-gray-500 mt-0.5">Por: ${c.closed_by || 'Admin'}</div>
                    </div>
                    <div class="text-xs space-y-0.5 mb-2">
                        <div class="flex justify-between"><span>Sucursal:</span><span>${res.subsidiary_name}</span></div>
                        <div class="flex justify-between"><span>Fecha:</span><span class="font-semibold">${moment(c.closure_date).locale('es').format('DD/MMM/YYYY')} ${moment(c.created_at).format('hh:mm A')}</span></div>
                    </div>
                    <hr class="border-dashed border-t border-gray-400 my-2" />
                    <div class="text-xs mb-2">
                        <div class="font-bold text-center mb-1.5">RESUMEN DE TURNOS (${c.total_shifts})</div>
                        ${shiftsHtml}
                    </div>
                    ${prevHtml}
                    ${crossHtml}
                    <hr class="border-dashed border-t border-gray-400 my-2" />
                    <div class="text-xs space-y-0.5">
                        <div class="flex justify-between"><span class="font-semibold">EFECTIVO:</span><span>${formatPrice(c.total_cash)}</span></div>
                        <div class="flex justify-between"><span class="font-semibold">TARJETA:</span><span>${formatPrice(c.total_card)}</span></div>
                        <div class="flex justify-between"><span class="font-semibold">TRANSFERENCIA:</span><span>${formatPrice(c.total_transfer)}</span></div>
                    </div>
                    <hr class="border-dashed border-t border-gray-400 my-2" />
                    <div class="text-xs">
                        <div class="flex justify-between"><span class="font-semibold">DESCUENTOS:</span><span class="text-red-600">-${formatPrice(c.total_discount)}</span></div>
                    </div>
                    <hr class="border-dashed border-t border-gray-400 my-2" />
                    <div class="flex justify-between items-center text-sm font-bold">
                        <span>TOTAL DEL DIA:</span>
                        <span class="text-base">${formatPrice(c.total_sales)}</span>
                    </div>
                    <hr class="border-dashed border-t border-gray-400 my-2" />
                    <div class="text-xs space-y-0.5">
                        <div class="flex justify-between"><span class="font-semibold">TOTAL PEDIDOS:</span><span class="font-bold">${c.total_orders}</span></div>
                        <div class="flex justify-between"><span class="font-semibold">PAGADOS:</span><span>${(c.total_orders || 0) - (res.counts.quotations || 0) - (res.counts.cancelled || 0) - (res.counts.pending || 0)}</span></div>
                        <div class="flex justify-between"><span class="font-semibold">PENDIENTES:</span><span>${res.counts.pending}</span></div>
                        <div class="flex justify-between"><span class="font-semibold">COTIZACIONES:</span><span>${res.counts.quotations}</span></div>
                        <div class="flex justify-between"><span class="font-semibold">ENTREGADOS:</span><span>${res.counts.delivered}</span></div>
                        <div class="flex justify-between"><span class="font-semibold">CANCELADOS:</span><span>${res.counts.cancelled}</span></div>
                        <div class="flex justify-between"><span class="font-semibold">TICKET PROMEDIO:</span><span>${formatPrice(ticketAvg)}</span></div>
                    </div>
                    <div class="text-center mt-4 text-[10px] font-bold text-gray-900 space-y-1">
                        <p>GRACIAS POR SU PREFERENCIA</p>
                        <p class="text-purple-800 text-xs">Huubie</p>
                        <p class="text-gray-500 font-normal text-[9px]">Generado: ${moment().format('DD/MM/YYYY HH:mm:ss')}</p>
                    </div>
                </div>
            </div>
        `;

        $('#ticketContainer').html(html);
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

    renderExecutiveSummary(res) {
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
            <div class="pdf-kv${opts.total ? ' total-row' : ''}">
                <span class="kv-label">${label}</span>
                <span class="kv-value${opts.negative ? ' negative' : ''}">${value}</span>
            </div>
        `;

        const totalsBar = `
            <div class="pdf-totals-bar">
                <div class="total-item"><div class="label">Desc./Cort.</div><div class="value">${formatPrice(ventas.descuentos || 0)}</div></div>
                <div class="total-item highlight"><div class="label">Venta Bruta</div><div class="value">${formatPrice(ventas.venta_bruta || 0)}</div></div>
                <div class="total-item"><div class="label">Efectivo</div><div class="value">${formatPrice(caja.efectivo || 0)}</div></div>
                <div class="total-item"><div class="label">Tarjeta</div><div class="value">${formatPrice(caja.tarjeta || 0)}</div></div>
            </div>
        `;

        const cuentasHtml = `
            <div class="pdf-section">
                <div class="pdf-section-title">Cuentas</div>
                <div class="pdf-section-body">
                    ${kv('Total Cuentas', cta.total || 0)}
                    ${kv('Cotizaciones', cta.cotizaciones || 0)}
                    ${kv('Pendientes', cta.pendientes || 0)}
                    ${kv('Pagadas', cta.pagadas || 0)}
                    ${kv('Canceladas', cta.canceladas || 0)}
                    ${kv('Con Descuento', `${cta.con_descuento || 0} &mdash; ${formatPrice(cta.importe_descuentos || 0)}`)}
                    ${kv('Cuenta Promedio', formatPrice(cta.cuenta_promedio || 0))}
                    <div class="pdf-sub-title">Folios</div>
                    ${kv('Folio Inicial', cta.folio_inicial || '-')}
                    ${kv('Folio Final', cta.folio_final || '-')}
                </div>
            </div>
        `;

        const cajaHtml = `
            <div class="pdf-section">
                <div class="pdf-section-title">Caja</div>
                <div class="pdf-section-body">
                    ${kv('+ Efectivo Inicial', formatPrice(caja.efectivo_inicial || 0))}
                    ${kv('+ Efectivo', formatPrice(caja.efectivo || 0))}
                    ${kv('+ Tarjeta', formatPrice(caja.tarjeta || 0))}
                    ${kv('+ Transferencia', formatPrice(caja.transferencia || 0))}
                    ${kv('= Saldo Final', formatPrice(caja.saldo_final || 0), { total: true })}
                </div>
            </div>
        `;

        const descuentosHtml = `
            <div class="pdf-section">
                <div class="pdf-section-title">Descuentos y Cortesias</div>
                <div class="pdf-section-body">
                    <div class="pdf-sub-title">Cortesias</div>
                    ${kv('Total Cortesias', '-')}
                    <div class="pdf-sub-title">Descuentos</div>
                    ${kv('Total Descuentos', formatPrice(ventas.descuentos || 0))}
                    ${kv('Total', formatPrice(ventas.descuentos || 0), { total: true })}
                </div>
            </div>
        `;

        const catColors = ['#4a6785', '#7f9bb5', '#a3b8cc', '#5b7d9a', '#6e94b3'];
        const catTotal  = categorias.reduce((sum, cat) => sum + parseFloat(cat.total || 0), 0);
        let catHtml = '';
        categorias.forEach((cat, idx) => {
            const pct = catTotal > 0 ? Math.round((cat.total / catTotal) * 100) : 0;
            catHtml += `
                ${kv(cat.categoria, `${formatPrice(cat.total)} <small style="color:#7f8c8d">(${pct}%)</small>`)}
                <div class="pdf-pct-bar">
                    <div class="bar"><div class="fill" style="width:${pct}%;background:${catColors[idx % catColors.length]}"></div></div>
                    <span class="pct-text">${pct}%</span>
                </div>
            `;
        });

        const ventasHtml = `
            <div class="pdf-section">
                <div class="pdf-section-title">Ventas</div>
                <div class="pdf-section-body">
                    <div class="pdf-sub-title">Por Tipo de Producto</div>
                    ${catHtml || '<p style="text-align:center;color:#95a5a6;padding:8px 0;font-size:11px">Sin ventas por categoría</p>'}
                    <div class="pdf-sub-title">Resumen</div>
                    ${kv('Subtotal', formatPrice(ventas.subtotal || 0))}
                    ${kv('- Desc. / Cort.', formatPrice(ventas.descuentos || 0), { negative: true })}
                    ${kv('Venta Neta', formatPrice(ventas.venta_neta || 0))}
                    ${kv('Venta Bruta', formatPrice(ventas.venta_bruta || 0), { total: true })}
                </div>
            </div>
        `;

        // Cobros cruzados: mismo tratamiento que el corte de turno.
        let prevSection = '';
        if (prevPayments.length > 0) {
            const prevTotal = prevPayments.reduce((sum, o) => sum + parseFloat(o.payment_real || 0), 0);
            const prevRows = prevPayments.map(o => {
                const total    = parseFloat(o.total_pay || 0);
                const discount = parseFloat(o.discount || 0);
                const abono    = parseFloat(o.payment_real || 0);
                const paidUpto = parseFloat(o.total_paid_upto || 0);
                const quedoRaw = total - discount - paidUpto;
                const quedo    = quedoRaw < 0 ? 0 : quedoRaw;
                const debia    = quedo + abono;
                return `
                    <tr>
                        <td>${o.folio || 'Folio #' + o.id}</td>
                        <td>${o.client_name || 'Sin cliente'}</td>
                        <td>${o.is_cross ? (o.origin_subsidiary || 'Otra sucursal') : '&mdash;'}</td>
                        <td class="text-right">${formatPrice(debia)}</td>
                        <td class="text-right col-importe">${formatPrice(abono)}</td>
                        <td class="text-right">${formatPrice(quedo)}</td>
                    </tr>
                `;
            }).join('');

            prevSection = `
                <div class="pdf-section" style="margin-bottom:12px">
                    <div class="pdf-section-title">Abonos de Pedidos Anteriores &mdash; cobrados este día</div>
                    <div style="overflow-x:auto">
                        <table class="pdf-table">
                            <thead>
                                <tr>
                                    <th>Folio</th>
                                    <th>Cliente</th>
                                    <th>Origen</th>
                                    <th class="text-right">Debía</th>
                                    <th class="text-right">Abonó</th>
                                    <th class="text-right">Quedó</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${prevRows}
                                <tr>
                                    <td colspan="4" style="font-weight:700">TOTAL COBRADO</td>
                                    <td class="text-right col-importe" style="font-weight:800">${formatPrice(prevTotal)}</td>
                                    <td></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        let crossSection = '';
        if (crossPayments.length > 0) {
            const crossTotal = crossPayments.reduce((sum, o) => sum + parseFloat(o.payment_cross || 0), 0);
            const crossRows = crossPayments.map(o => `
                <tr>
                    <td>${o.folio || 'Folio #' + o.id}</td>
                    <td>${o.client_name || 'Sin cliente'}</td>
                    <td>${o.charged_subsidiary || 'Otra sucursal'}</td>
                    <td class="text-right col-importe">${formatPrice(o.payment_cross)}</td>
                </tr>
            `).join('');

            crossSection = `
                <div class="pdf-section" style="margin-bottom:12px">
                    <div class="pdf-section-title">Cobrado en Otra Sucursal &mdash; no entra a esta caja (informativo)</div>
                    <div style="overflow-x:auto">
                        <table class="pdf-table">
                            <thead>
                                <tr>
                                    <th>Folio</th>
                                    <th>Cliente</th>
                                    <th>Cobrado en</th>
                                    <th class="text-right">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${crossRows}
                                <tr>
                                    <td colspan="3" style="font-weight:700">TOTAL EN OTRAS SUCURSALES</td>
                                    <td class="text-right col-importe" style="font-weight:800">${formatPrice(crossTotal)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }

        const pagoVentasHtml = `
            <div class="pdf-section">
                <div class="pdf-section-title">Forma de Pago Ventas</div>
                <div class="pdf-section-body">
                    ${kv('Efectivo', formatPrice(caja.efectivo || 0))}
                    ${kv('Tarjeta', formatPrice(caja.tarjeta || 0))}
                    ${kv('Transferencia', formatPrice(caja.transferencia || 0))}
                    ${kv('Total', formatPrice((caja.efectivo || 0) + (caja.tarjeta || 0) + (caja.transferencia || 0)), { total: true })}
                </div>
            </div>
        `;

        let shiftsRows = '';
        shifts.forEach(shift => {
            shiftsRows += `
                <tr>
                    <td>${shift.cajero || 'Sin cajero'}</td>
                    <td>${shift.apertura ? moment(shift.apertura).format('DD/MM/YYYY hh:mm A') : '-'}</td>
                    <td>${shift.cierre ? moment(shift.cierre).format('hh:mm A') : 'Abierto'}</td>
                    <td class="text-right col-importe">${formatPrice(shift.total || 0)}</td>
                    <td class="text-right col-efectivo">${formatPrice(shift.efectivo || 0)}</td>
                    <td class="text-right col-tarjeta">${formatPrice(shift.tarjeta || 0)}</td>
                    <td class="text-right">${formatPrice(shift.transferencia || 0)}</td>
                </tr>
            `;
        });

        const shiftsTableHtml = shifts.length > 0 ? `
            <div class="pdf-section">
                <div class="pdf-section-title" style="display:flex;justify-content:space-between;align-items:center">
                    <span>Corte de Caja X</span>
                    <span style="font-size:10px;color:#95a5a6;font-weight:400">${shifts.length} turno(s)</span>
                </div>
                <div style="overflow-x:auto">
                    <table class="pdf-table">
                        <thead>
                            <tr>
                                <th>Responsable</th>
                                <th>Apertura</th>
                                <th>Cierre</th>
                                <th class="text-right">Total</th>
                                <th class="text-right">Efectivo</th>
                                <th class="text-right">Tarjeta</th>
                                <th class="text-right">Transferencia</th>
                            </tr>
                        </thead>
                        <tbody>${shiftsRows}</tbody>
                    </table>
                </div>
            </div>
        ` : `
            <div class="pdf-section">
                <div class="pdf-section-title">Corte de Caja X</div>
                <div class="pdf-section-body" style="text-align:center;color:#95a5a6;padding:20px">Sin turnos registrados</div>
            </div>
        `;

        let ordersRows = '';
        if (orders.length > 0) {
            ordersRows = orders.map(o => `
                <tr>
                    <td>P-${String(o.folio).padStart(3, '0')}</td>
                    <td>${o.date ? moment(o.date).format('hh:mm a') : '&mdash;'}</td>
                    <td>${o.client || '&mdash;'}</td>
                    <td class="text-center">${statusMap[o.status] || 'Desconocido'}</td>
                    <td class="text-right col-importe">${formatPrice(o.total)}</td>
                    <td class="text-right">${o.method || '&mdash;'}</td>
                </tr>
            `).join('');
        } else {
            ordersRows = '<tr><td colspan="6" style="text-align:center;color:#95a5a6;padding:14px">Sin pedidos registrados</td></tr>';
        }

        const html = `
            ${this.dailyViewToggle()}
            <div id="reportZoomWrap" style="zoom:${this._reportZoom / 100}">
            <div id="ticketDailyClose" class="pdf-document">
                <div class="pdf-header">
                    <div>
                        <h2>CORTE Z</h2>
                        <div class="meta">Sucursal: <span>${res.subsidiary_name || ''}</span></div>
                        <div class="meta">${res.company_name || ''}</div>
                    </div>
                    <div style="text-align:right">
                        <div class="meta">Fecha: <span>${moment(c.closure_date).format('DD/MM/YYYY')}</span></div>
                        <div class="meta">Cerrado por: <span>${c.closed_by || 'Admin'} &mdash; ${moment(c.created_at).format('hh:mm A')}</span></div>
                        <div class="meta">Generado: <span>${moment().format('DD/MM/YYYY hh:mm A')}</span></div>
                    </div>
                </div>

                ${totalsBar}

                <div class="pdf-grid">
                    ${cuentasHtml}
                    ${cajaHtml}
                    ${descuentosHtml}
                    ${ventasHtml}
                </div>

                ${prevSection}
                ${crossSection}

                <div class="pdf-grid-bottom">
                    ${pagoVentasHtml}
                    ${shiftsTableHtml}
                </div>

                <div class="pdf-section" style="margin-bottom:12px">
                    <div class="pdf-section-title" style="display:flex;justify-content:space-between;align-items:center;cursor:pointer" onclick="cierre.toggleOrdersBreakdown()">
                        <span>Desglose de Pedidos</span>
                        <span style="font-size:10px;color:#95a5a6;font-weight:400">${orders.length} pedido(s)</span>
                    </div>
                    <div id="ordersBreakdownBody" style="overflow-x:auto">
                        <table class="pdf-table">
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
                            <tbody>${ordersRows}</tbody>
                        </table>
                    </div>
                </div>

                <div class="pdf-footer">
                    <span>Documento generado automaticamente</span>
                    <span>Pagina 1 de 1</span>
                </div>
            </div>
            </div>
        `;

        $('#ticketContainer').html(html);
    }

    toggleOrdersBreakdown() {
        const body  = $('#ordersBreakdownBody');
        const arrow = $('#ordersBreakdownArrow');
        body.toggleClass('hidden');
        arrow.css('transform', body.hasClass('hidden') ? '' : 'rotate(180deg)');
    }

    printDaily() {
        const report = document.getElementById('ticketDailyClose') || document.getElementById('ticketPasteleria');
        if (!report) {
            Swal.fire({ title: 'Sin contenido', text: 'No hay nada para imprimir.', icon: 'warning', background: '#1F2A37', color: '#fff', confirmButtonColor: '#ea580c' });
            return;
        }

        const isTicket = report.id === 'ticketPasteleria';
        const isPdfDoc = report.classList.contains('pdf-document');
        // Corte Z: se imprime con los estilos pdf-* ya en su variante clara (documento).
        const headAssets = isPdfDoc
            ? `<style>${this.pdfBaseCss()} ${this.pdfPrintCss()}</style>`
            : `<script src="https://cdn.tailwindcss.com"><\/script>`;

        const printWindow = window.open('', '', isTicket ? 'height=700,width=420' : 'height=800,width=1020');
        printWindow.document.write(`
            <html>
                <head>
                    <title>${isTicket ? 'Ticket de cierre' : 'Corte Z'}</title>
                    ${headAssets}
                    <style>@media print { body { margin: 0; } #ticketDailyClose, #ticketPasteleria { border: none !important; box-shadow: none !important; } }</style>
                </head>
                <body class="${isTicket ? 'p-2' : 'p-4'}">${report.outerHTML}</body>
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
        let subsidiaries_id = rol == 1 ? $('#subsidiariesDailyClose').val() : null;

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
        let subsidiaries_id = rol == 1 ? $('#subsidiariesDailyClose').val() : null;

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
}
