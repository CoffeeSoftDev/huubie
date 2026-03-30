let apiCierre = 'ctrl/ctrl-cierre.php';

class Cierre {
    constructor(api) {
        this.api = api;
        this._closureData = null;
        this._closureResponse = null;
    }

    async initCierre() {
        let rangePicker     = getDataRangePicker("calendarDailyClose");
        let date            = rangePicker.fi;
        let subsidiaries_id = rol == 1 ? $('#subsidiariesDailyClose').val() : null;

        $('#btnCerrarDia').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
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
            <div class="grid grid-cols-3 gap-3 mb-5">
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
                <button class="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-gray-600 hover:bg-gray-700 text-white" onclick="cierre.cancelChecklist()">Cancelar</button>
                <button class="flex-1 py-2.5 rounded-lg text-sm font-semibold ${data.can_close ? 'bg-orange-600 hover:bg-orange-700' : 'bg-gray-600 opacity-50 cursor-not-allowed'} text-white" ${data.can_close ? '' : 'disabled'} onclick="cierre.confirmClose('${date}', '${subsidiaries_id}')">Confirmar Cierre</button>
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
                select.append(`<option value="${shift.id}" data-status="${shift.status}">${time}</option>`);
            });
        }
        select.off('change').on('change', function() { cierre.onShiftSelectorChange($(this).val()); });

        $('#openShiftsAlert').html(`
            <div class="bg-green-900/20 border border-green-600/30 rounded-lg p-3">
                <div class="flex items-center gap-2 mb-1">
                    <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <span class="text-xs font-bold text-green-400 uppercase">Dia cerrado</span>
                </div>
                <p class="text-[10px] text-gray-400">Por: <strong class="text-gray-300">${res.closure.closed_by || 'Admin'}</strong> — ${moment(res.closure.created_at).format('hh:mm A')}</p>
            </div>
        `).removeClass('hidden');

        $('#btnOpenShift, #btnCloseShift').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
        $('#btnPrintTicket').prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');

        let btnArea = $('#btnCerrarDia').parent();
        if (rol == 1) {
            btnArea.html(`
                <button id="btnReabrirDia" class="w-full py-2.5 rounded-lg text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-2" onclick="cierre.reopenClosure(${res.closure.id})">
                    <i class="icon-cw"></i> Reabrir Dia
                </button>
                <p class="text-[9px] text-gray-600 mt-1 text-center">Solo admin — requiere motivo</p>
            `);
        } else {
            btnArea.html('');
        }

        this.renderDailyTicket(res);
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

        const html = `
            <div class="flex justify-center p-4">
                <div id="ticketPasteleria" class="bg-white p-5 rounded-lg shadow-lg text-gray-900 border border-gray-200" style="max-width: 320px; width: 100%; font-family: 'Courier New', monospace; font-size: 12px;">
                    <div class="flex flex-col items-center mb-3">
                        <div style="width:60px;height:60px;border-radius:50%;background:#7c3aed;display:flex;align-items:center;justify-content:center;" class="mb-2">
                            <span style="color:white;font-size:24px;font-weight:bold;">R</span>
                        </div>
                        <h1 class="text-sm font-bold uppercase">${res.company_name || 'Reginas Pasteleria'}</h1>
                        <div class="text-xs font-semibold">PEDIDOS DE PASTELERIA</div>
                        <div class="text-xs text-gray-600 mt-0.5">Cierre Diario Consolidado</div>
                        <div class="bg-green-100 text-green-800 px-3 py-0.5 rounded-full text-[10px] font-bold mt-1.5">CERRADO</div>
                        <div class="text-[10px] text-gray-500 mt-0.5">Por: ${c.closed_by || 'Admin'}</div>
                        <div class="text-[10px] text-gray-500">${moment(c.created_at).format('DD/MM/YYYY HH:mm')}</div>
                    </div>
                    <div class="text-xs space-y-0.5 mb-2">
                        <div class="flex justify-between"><span>Fecha:</span><span class="font-semibold">${moment(c.closure_date).format('DD/MM/YYYY')}</span></div>
                        <div class="flex justify-between"><span>Sucursal:</span><span>${res.subsidiary_name}</span></div>
                    </div>
                    <hr class="border-dashed border-t border-gray-400 my-2" />
                    <div class="text-xs mb-2">
                        <div class="font-bold text-center mb-1.5">RESUMEN DE TURNOS (${c.total_shifts})</div>
                        ${shiftsHtml}
                    </div>
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

    onShiftSelectorChange(value) {
        if (value === 'daily') {
            this.renderDailyTicket(this._closureResponse);
        } else {
            app._selectedShiftId = value;
            app.viewShiftPreview();
        }
    }

    async reopenClosure(closureId) {
        const result = await Swal.fire({
            title: 'Reabrir Cierre Diario',
            html: '<p class="text-sm text-gray-300">Indica el motivo de la reapertura:</p>',
            input: 'textarea',
            inputPlaceholder: 'Motivo de reapertura...',
            inputAttributes: { required: true },
            showCancelButton: true,
            confirmButtonColor: '#d97706',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Reabrir',
            cancelButtonText: 'Cancelar',
            background: '#1F2A37',
            color: '#fff',
            inputValidator: (value) => {
                if (!value || value.trim() === '') return 'Debes indicar un motivo';
            }
        });

        if (!result.isConfirmed) return;

        const res = await useFetch({ url: this.api, data: { opc: 'statusCierre', closure_id: closureId, reason: result.value } });

        if (res.status === 200) {
            Swal.fire({ title: 'Cierre reabierto', text: res.message, icon: 'success', background: '#1F2A37', color: '#fff', confirmButtonColor: '#d97706' });
            dailyClosure = { is_closed: false };
            app.loadShifts();
        } else {
            Swal.fire({ title: 'Error', text: res.message || 'Error al reabrir', icon: 'error', background: '#1F2A37', color: '#fff' });
        }
    }
}
