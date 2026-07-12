// Ticket de Cierre x Turno (formato POS, hoja angosta).
//
// Fuente UNICA del formato: lo usan tanto la vista de Cierre de Dia de alpha/pedidos
// (App.ticketShiftClose delega aqui) como el modulo independiente order-visor.
// No dependas de `this`: todo entra por `options`.
//
// options: { data, shift, subsidiary_name, company_name, logo, orders,
//            externalPayments, crossPayments, reportMode, containerId }
//   reportMode : 'summary' | 'detailed'  (detalla el desglose de pedidos)
//   containerId: destino del render (default 'ticketContainer')
function renderShiftTicket(options) {
        const d = options.data || {};
        const shift = options.shift || {};
        const subsidiaryName = options.subsidiary_name || '';
        const companyName = options.company_name || subsidiaryName;
        const logo = options.logo || '';
        const orders = options.orders || [];
        const isDetailed = options.reportMode === 'detailed';

        const aperturaFull = moment(shift.opened_at).locale('es').format('DD/MMM/YYYY hh:mm a');
        const cierreFull   = shift.closed_at ? moment(shift.closed_at).locale('es').format('DD/MMM/YYYY hh:mm a') : '-';

        const isClosed = shift.status === 'closed';

        const subsidiaryHeader = (subsidiaryName && subsidiaryName !== companyName)
            ? `<div class="text-xs font-semibold" style="color:#7c3aed;">${subsidiaryName}</div>`
            : '';

        const closedBadge = isClosed
            ? `<div class="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1">CERRADO</div>`
            : `<div class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1">EN CURSO</div>`;

        // Desglose de ventas (modo detallado)
        const externalPayments = options.externalPayments || [];
        const crossPayments    = options.crossPayments || [];
        let detailedSection = '';

        if (isDetailed) {
            // Grupo 1: pedidos creados en este turno
            if (orders.length > 0) {
                const shiftTotal = orders.reduce((sum, o) => sum + parseFloat(o.total_pay || 0), 0);
                const shiftPaid  = orders.reduce((sum, o) => sum + parseFloat(o.payment_real || 0), 0);

                const orderRows = orders.map(o => `
                    <div class="flex items-center">
                        <div class="font-bold text-gray-900 truncate flex-1">${o.folio || 'Folio #' + o.id}</div>
                        <div class="text-right" style="width:72px">${formatPrice(o.total_pay)}</div>
                        <div class="text-right text-green-700" style="width:72px">${parseFloat(o.payment_real || 0) ? formatPrice(o.payment_real) : '-'}</div>
                    </div>
                    <div class="text-[10px] text-gray-500 mb-1">${o.client_name || 'Sin cliente'}</div>
                `).join('');

                detailedSection += `
                    <div class="font-semibold mt-2 mb-1">PEDIDOS DEL TURNO</div>
                    <div class="flex text-[9px] text-gray-400 mb-0.5">
                        <span class="flex-1">FOLIO</span>
                        <span class="text-right" style="width:72px">TOTAL</span>
                        <span class="text-right" style="width:72px">ABONO</span>
                    </div>
                    ${orderRows}
                    <div class="flex justify-between items-center font-semibold border-t border-dashed pt-1 mt-1">
                        <div>TOTAL PEDIDOS</div>
                        <div>${formatPrice(shiftTotal)}</div>
                    </div>
                    <div class="flex justify-between items-center text-green-700">
                        <div>COBRADO EN TURNO</div>
                        <div>${formatPrice(shiftPaid)}</div>
                    </div>
                    <hr class="border-dashed border-t my-1" />
                `;
            }

            // Grupo 2: abonos de pedidos de turnos anteriores
            if (externalPayments.length > 0) {
                const extTotal = externalPayments.reduce((sum, o) => sum + parseFloat(o.payment_real || 0), 0);

                const money = (v) => `$${parseFloat(v || 0).toFixed(2)}`;
                const extRows = externalPayments.map(o => {
                    const total     = parseFloat(o.total_pay || 0);
                    const discount  = parseFloat(o.discount || 0);
                    const abono     = parseFloat(o.payment_real || 0);       // abonó en este turno
                    const paidUpto  = parseFloat(o.total_paid_upto || 0);    // abonado hasta el cierre (incluye este turno)
                    const quedoRaw  = total - discount - paidUpto;           // saldo restante
                    const quedo     = quedoRaw < 0 ? 0 : quedoRaw;
                    const debia     = quedo + abono;                         // saldo antes del abono de este turno
                    const liquidado = quedoRaw <= 0.005;
                    const badge = liquidado
                        ? `<span class="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[9px] font-bold">LIQUIDADO</span>`
                        : `<span class="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[9px] font-bold">PENDIENTE</span>`;
                    // Cobro cruzado: el pedido es de otra sucursal distinta a la del cierre.
                    const origin = o.origin_subsidiary || '';
                    const originLine = (origin && origin !== subsidiaryName)
                        ? `<div class="text-[10px] text-gray-500 mb-0.5">Origen: ${origin}</div>`
                        : '';
                    return `
                        <div class="flex justify-between items-center mt-3 pt-2 border-t border-dashed border-gray-200">
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

                detailedSection += `
                    <div class="font-semibold mt-2 mb-1">ABONOS DE PEDIDOS ANTERIORES</div>
                    ${extRows}
                    <div class="flex justify-between items-center font-semibold border-t border-dashed pt-1 mt-1 text-green-700">
                        <div>TOTAL COBRADO</div>
                        <div>${formatPrice(extTotal)}</div>
                    </div>
                    <hr class="border-dashed border-t my-1" />
                `;
            }

            // Grupo 3: pedidos de este turno cuyo abono se cobró en otra sucursal.
            // Es informativo: NO entra a tu caja, por eso va aparte y no suma al total.
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

                detailedSection += `
                    <div class="bg-purple-50 border border-purple-200 rounded-lg p-3 mt-2">
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
        }

        const totalPayments = parseFloat(d.cash_sales || 0) + parseFloat(d.card_sales || 0) + parseFloat(d.transfer_sales || 0);

        // Actividad de pedidos del turno = creados en el turno + cobrados de turnos anteriores
        const createdOrders  = parseInt(d.total_orders)    || 0;
        const createdQuot    = parseInt(d.quotation_count) || 0;
        const createdCancel  = parseInt(d.cancelled_count) || 0;
        const createdPending = parseInt(d.pending_count)   || 0;
        const createdPaid    = createdOrders - createdQuot - createdCancel - createdPending;
        const prevCount      = parseInt(d.prev_count)   || 0; // pedidos anteriores cobrados en el turno
        const prevPaid       = parseInt(d.prev_paid)    || 0; // de esos, los que quedaron liquidados
        const prevPending    = parseInt(d.prev_pending) || 0; // de esos, los que aun tienen saldo
        const ordersTurno    = createdOrders  + prevCount;
        const paidTurno      = createdPaid    + prevPaid;
        const pendingTurno   = createdPending + prevPending;

        const ticketHtml = `
            <div id="layoutPrintCloseTicket" class="flex justify-center p-4">
                <div id="ticketDailyClose" class="bg-white p-4 rounded-lg shadow-lg text-gray-900 border border-gray-200" style="max-width: 320px; width: 100%; font-family: 'Roboto Mono', ui-monospace, 'Courier New', monospace;">
                    <!-- Header -->
                    <div class="flex flex-col items-center mb-3">
                        ${logo ? `<div style="width:60px;height:60px;border-radius:50%;overflow:hidden;margin-bottom:0.25rem;" class="mb-1">
                            <img src="/alpha${logo}" alt="" onerror="this.parentElement.outerHTML='<div style=\\'width:60px;height:60px;border-radius:50%;margin-bottom:0.25rem;background:#7c3aed;display:flex;align-items:center;justify-content:center;\\'><span style=\\'color:white;font-size:24px;font-weight:bold;\\'>${(companyName || 'H').charAt(0).toUpperCase()}</span></div>'" style="width:100%;height:100%;object-fit:cover;display:block;" />
                        </div>` : `<div style="width:60px;height:60px;border-radius:50%;margin-bottom:0.25rem;background:#7c3aed;display:flex;align-items:center;justify-content:center;" class="mb-1">
                            <span style="color:white;font-size:24px;font-weight:bold;">${(companyName || 'H').charAt(0).toUpperCase()}</span>
                        </div>`}
                        <h1 class="text-sm font-bold uppercase">${companyName}</h1>
                        ${subsidiaryHeader}
                        <div class="text-xs font-semibold">PEDIDOS DE PASTELERÍA</div>
                        <div class="text-xs text-gray-600">Cierre x Turno</div>
                        ${closedBadge}
                    </div>

                    <!-- Info -->
                    <div class="text-xs space-y-0.5 mb-2">
                        <div class="flex justify-between"><span>Aperturó:</span><span>${shift.employee_name || 'N/A'}</span></div>
                        <div class="flex justify-between"><span>Apertura:</span><span>${aperturaFull}</span></div>
                        ${isClosed ? `<div class="flex justify-between"><span>Cierre:</span><span>${cierreFull}</span></div>` : ''}
                        <div class="flex justify-between"><span>Inicio de caja:</span><span>${formatPrice(shift.opening_amount || 0)}</span></div>
                    </div>

                    <hr class="border-dashed border-t my-1" />

                    <!-- Detalle (si aplica) -->
                    <div class="text-xs space-y-0.5">
                        ${detailedSection}

                        <!-- Formas de pago -->
                        <div class="flex justify-between items-center font-semibold">
                            <div>EFECTIVO:</div>
                            <div>${parseFloat(d.cash_sales || 0) ? formatPrice(d.cash_sales) : '-'}</div>
                        </div>
                        <div class="flex justify-between items-center font-semibold">
                            <div>TARJETA:</div>
                            <div>${parseFloat(d.card_sales || 0) ? formatPrice(d.card_sales) : '-'}</div>
                        </div>
                        <div class="flex justify-between items-center font-semibold">
                            <div>TRANSFERENCIA:</div>
                            <div>${parseFloat(d.transfer_sales || 0) ? formatPrice(d.transfer_sales) : '-'}</div>
                        </div>

                        <hr class="border-dashed border-t my-1" />

                        <div class="flex justify-between items-center font-semibold">
                            <div>TOTAL CAJA:</div>
                            <div class="text-sm">${totalPayments ? formatPrice(totalPayments) : '-'}</div>
                        </div>

                        <hr class="border-dashed border-t my-1" />

                        <div class="flex justify-between items-center font-semibold">
                            <div>NÚMERO DE PEDIDOS DEL TURNO:</div>
                            <div>${ordersTurno || '-'}</div>
                        </div>
                        <div class="mt-2"></div>
                        <div class="flex justify-between items-center font-semibold">
                            <div>PAGADOS:</div>
                            <div>${paidTurno || '-'}</div>
                        </div>
                        <div class="flex justify-between items-center font-semibold">
                            <div>PENDIENTES:</div>
                            <div>${pendingTurno || '-'}</div>
                        </div>
                        <div class="flex justify-between items-center font-semibold">
                            <div>COTIZACIONES:</div>
                            <div>${createdQuot || '-'}</div>
                        </div>
                        <div class="flex justify-between items-center font-semibold">
                            <div>CANCELADOS:</div>
                            <div>${createdCancel || '-'}</div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="text-center mt-4 text-[10px] font-bold text-gray-900 space-y-1">
                        <p>GRACIAS POR SU PREFERENCIA</p>
                        <p class="text-purple-800 text-xs">Huubie</p>
                        <p class="text-gray-500 font-normal text-[9px]">
                            Generado: ${moment().format('DD/MM/YYYY HH:mm:ss')}
                        </p>
                    </div>
                </div>
            </div>
        `;

        // containerId opcional: por defecto la vista de Cierre de Dia (#ticketContainer).
        // El visor de reportes (order-reports.js) lo reusa pasando su propio contenedor;
        // en ese caso no tocamos #ticketModeBar (el visor tiene su propia barra de modo).
        const containerId = options.containerId || 'ticketContainer';
        $('#' + containerId).html(ticketHtml);
        if (containerId === 'ticketContainer') $('#ticketModeBar').removeClass('hidden');
    }
