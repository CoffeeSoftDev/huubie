let apiTickets = 'ctrl/ctrl-tickets.php';
let tickets;
let ticketConfig = null;

$(async () => {
    const req = await useFetch({ url: apiTickets, data: { opc: "init" } });
    ticketConfig = req.config;

    tickets = new TicketManager(apiTickets, 'root');
});

class TicketManager extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Tickets";
    }

    async generateSaleTicket(orderId, saleData) {
        const response = await useFetch({
            url: this._link,
            data: { opc: 'getTicketData', order_id: orderId }
        });

        if (response.status !== 200) {
            alert({ icon: "error", text: response.message, btn1: true });
            return;
        }

        const order     = response.order;
        const items     = response.items;
        const payments  = response.payments;
        const config    = response.config;
        const logo      = response.logo;
        const subsidiary = response.subsidiary;
        const totalPaid = response.total_paid;
        const change    = response.change;

        const businessName = config ? config.business_name : (subsidiary ? subsidiary.name : 'Mi Negocio');
        const address      = config ? config.address : '';
        const phone        = config ? config.phone : '';
        const footerText   = config ? config.footer_text : 'Gracias por su compra';
        const showLogo     = config ? config.show_logo : 1;

        let itemsHtml = '';
        if (is_array_safe(items)) {
            items.forEach(item => {
                const qty   = parseInt(item.quantity);
                const price = parseFloat(item.unit_price);
                const subtotal = qty * price;
                itemsHtml += `
                    <div class="flex justify-between text-xs">
                        <span class="flex-1">${item.product_name}</span>
                        <span class="w-8 text-center">${qty}</span>
                        <span class="w-16 text-right">${formatPrice(price)}</span>
                        <span class="w-16 text-right">${formatPrice(subtotal)}</span>
                    </div>
                `;
            });
        }

        let paymentsHtml = '';
        if (is_array_safe(payments)) {
            payments.forEach(p => {
                paymentsHtml += `
                    <div class="flex justify-between text-xs">
                        <span>${p.method_pay}</span>
                        <span>${formatPrice(p.pay)}</span>
                    </div>
                `;
            });
        }

        const folio = order.folio_ticket || '#' + order.id;
        const discount = parseFloat(order.discount || 0);

        const ticketHtml = `
            <div id="ticketVenta" class="bg-white p-4 rounded-lg shadow-lg font-mono text-gray-900 border border-gray-200" style="max-width: 320px; width: 100%; margin: 0 auto;">
                <div class="flex flex-col items-center mb-3">
                    ${showLogo && logo ? `<div style="width:60px;height:60px;border-radius:50%;overflow:hidden;" class="mb-1">
                        <img src="https://huubie.com.mx/alpha${logo}" alt="" style="width:100%;height:100%;object-fit:cover;" />
                    </div>` : ''}
                    <h1 class="text-sm font-bold uppercase text-center">${businessName}</h1>
                    ${address ? `<p class="text-[10px] text-gray-500 text-center">${address}</p>` : ''}
                    ${phone ? `<p class="text-[10px] text-gray-500">Tel: ${phone}</p>` : ''}
                </div>

                <hr class="border-dashed border-t my-1" />

                <div class="text-xs space-y-0.5 mb-2">
                    <div class="flex justify-between"><span>Folio:</span><span class="font-bold">${folio}</span></div>
                    <div class="flex justify-between"><span>Fecha:</span><span>${moment(order.date_creation).format('DD/MM/YYYY HH:mm')}</span></div>
                    <div class="flex justify-between"><span>Cliente:</span><span>${order.client_name || 'Mostrador'}</span></div>
                    ${order.order_type === 'pedido' ? `<div class="flex justify-between"><span>Tipo:</span><span>Pedido</span></div>` : ''}
                </div>

                <hr class="border-dashed border-t my-1" />

                <div class="flex justify-between text-xs font-bold mb-1">
                    <span class="flex-1">Producto</span>
                    <span class="w-8 text-center">Qty</span>
                    <span class="w-16 text-right">P.Unit</span>
                    <span class="w-16 text-right">Importe</span>
                </div>
                <hr class="border-t my-0.5" />
                ${itemsHtml}

                <hr class="border-dashed border-t my-1" />

                <div class="text-xs space-y-0.5">
                    <div class="flex justify-between"><span>Subtotal:</span><span>${formatPrice(parseFloat(order.total_pay) + discount)}</span></div>
                    ${discount > 0 ? `<div class="flex justify-between text-red-600"><span>Descuento:</span><span>-${formatPrice(discount)}</span></div>` : ''}
                    <div class="flex justify-between font-bold text-sm"><span>TOTAL:</span><span>${formatPrice(order.total_pay)}</span></div>
                </div>

                <hr class="border-dashed border-t my-1" />

                <div class="text-xs font-bold mb-1">FORMA DE PAGO</div>
                ${paymentsHtml}
                ${change > 0 ? `
                    <hr class="border-t my-0.5" />
                    <div class="flex justify-between text-xs font-bold">
                        <span>Cambio:</span>
                        <span>${formatPrice(change)}</span>
                    </div>
                ` : ''}

                <div class="text-center mt-4 text-[10px] text-gray-500 space-y-0.5">
                    <p>${footerText}</p>
                    <p>${moment().format('DD/MM/YYYY HH:mm:ss')}</p>
                </div>
            </div>
        `;

        return ticketHtml;
    }

    async printSaleTicket(orderId) {
        const ticketHtml = await this.generateSaleTicket(orderId);

        bootbox.dialog({
            title: `<div class="flex items-center gap-2 text-white"><i class="icon-print text-green-400"></i> Ticket de Venta</div>`,
            message: `
                <div class="flex justify-center p-4">${ticketHtml}</div>
                <div class="flex justify-center gap-2 mt-3">
                    <button class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold" onclick="tickets.doPrint('ticketVenta', ${orderId}, 'venta')">
                        <i class="icon-print"></i> Imprimir
                    </button>
                </div>
            `,
            closeButton: true,
            className: 'modal-ticket-venta'
        });

        $('.modal-ticket-venta .modal-dialog').css('max-width', '420px');
    }

    async reprintTicket(orderId) {
        const ticketHtml = await this.generateSaleTicket(orderId);

        bootbox.dialog({
            title: `<div class="flex items-center gap-2 text-white"><i class="icon-clock text-yellow-400"></i> Reimprimir Ticket</div>`,
            message: `
                <div class="flex justify-center p-4">${ticketHtml}</div>
                <div class="flex justify-center gap-2 mt-3">
                    <button class="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm font-semibold" onclick="tickets.doPrint('ticketVenta', ${orderId}, 'reimpresion')">
                        <i class="icon-print"></i> Reimprimir
                    </button>
                </div>
            `,
            closeButton: true,
            className: 'modal-ticket-reprint'
        });

        $('.modal-ticket-reprint .modal-dialog').css('max-width', '420px');
    }

    async printComanda(orderId) {
        const response = await useFetch({
            url: this._link,
            data: { opc: 'getComandaData', order_id: orderId }
        });

        if (response.status !== 200) {
            alert({ icon: "error", text: response.message, btn1: true });
            return;
        }

        const order = response.order;
        const items = response.items;

        let itemsHtml = '';
        if (is_array_safe(items)) {
            items.forEach(item => {
                itemsHtml += `
                    <div class="flex justify-between text-sm py-1 border-b border-dashed">
                        <span class="font-bold">${parseInt(item.quantity)}x</span>
                        <span class="flex-1 ml-2">${item.product_name}</span>
                    </div>
                `;
            });
        }

        const comandaHtml = `
            <div id="ticketComanda" class="bg-white p-4 rounded-lg shadow-lg font-mono text-gray-900 border border-gray-200" style="max-width: 320px; width: 100%; margin: 0 auto;">
                <div class="text-center mb-3">
                    <h1 class="text-lg font-bold uppercase">COMANDA DE COCINA</h1>
                    <hr class="border-t-2 border-black my-1" />
                </div>

                <div class="text-xs space-y-0.5 mb-3">
                    <div class="flex justify-between"><span>Orden:</span><span class="font-bold text-lg">#${order.id}</span></div>
                    <div class="flex justify-between"><span>Fecha:</span><span>${moment(order.date_creation).format('DD/MM/YYYY HH:mm')}</span></div>
                    <div class="flex justify-between"><span>Cliente:</span><span>${order.client_name || 'Mostrador'}</span></div>
                </div>

                <hr class="border-t-2 border-black my-1" />
                <div class="space-y-1 my-2">
                    ${itemsHtml}
                </div>

                ${order.note ? `
                    <hr class="border-t-2 border-black my-1" />
                    <div class="text-sm mt-2">
                        <p class="font-bold">NOTAS:</p>
                        <p class="italic">${order.note}</p>
                    </div>
                ` : ''}

                <div class="text-center mt-4 text-[10px] text-gray-500">
                    <p>Impreso: ${moment().format('DD/MM/YYYY HH:mm:ss')}</p>
                </div>
            </div>
        `;

        bootbox.dialog({
            title: `<div class="flex items-center gap-2 text-white"><i class="icon-food text-orange-400"></i> Comanda de Cocina</div>`,
            message: `
                <div class="flex justify-center p-4">${comandaHtml}</div>
                <div class="flex justify-center gap-2 mt-3">
                    <button class="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-semibold" onclick="tickets.doPrint('ticketComanda', ${orderId}, 'comanda')">
                        <i class="icon-print"></i> Imprimir Comanda
                    </button>
                </div>
            `,
            closeButton: true,
            className: 'modal-comanda'
        });

        $('.modal-comanda .modal-dialog').css('max-width', '420px');
    }

    async doPrint(elementId, orderId, type) {
        const ticketContent = document.getElementById(elementId);
        if (!ticketContent) return;

        await useFetch({
            url: this._link,
            data: {
                opc: 'addTicketLog',
                order_id: orderId || 0,
                cash_shift_id: (typeof posShift !== 'undefined' && posShift.shift_id) ? posShift.shift_id : 0,
                type: type
            }
        });

        const printWindow = window.open('', '', 'height=600,width=400');
        printWindow.document.write('<html><head><title>Ticket</title>');
        printWindow.document.write(this.getPrintStyles());
        printWindow.document.write('</head><body>');
        printWindow.document.write(ticketContent.outerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); }, 250);
    }

    getPrintStyles() {
        return `
            <style>
                body { font-family: 'Courier New', monospace; padding: 10px; max-width: 320px; margin: 0 auto; }
                .bg-white { background-color: white; }
                .p-4 { padding: 1rem; }
                .rounded-lg { border-radius: 0.5rem; }
                .font-mono { font-family: 'Courier New', monospace; }
                .text-gray-900 { color: #111827; }
                .flex { display: flex; }
                .flex-col { flex-direction: column; }
                .flex-1 { flex: 1 1 0%; }
                .items-center { align-items: center; }
                .justify-between { justify-content: space-between; }
                .mb-3 { margin-bottom: 0.75rem; }
                .mb-2 { margin-bottom: 0.5rem; }
                .mb-1 { margin-bottom: 0.25rem; }
                .mt-4 { margin-top: 1rem; }
                .mt-2 { margin-top: 0.5rem; }
                .ml-2 { margin-left: 0.5rem; }
                .my-1 { margin-top: 0.25rem; margin-bottom: 0.25rem; }
                .my-2 { margin-top: 0.5rem; margin-bottom: 0.5rem; }
                .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
                .text-sm { font-size: 0.875rem; }
                .text-xs { font-size: 0.75rem; }
                .text-lg { font-size: 1.125rem; }
                .text-\\[10px\\] { font-size: 10px; }
                .font-bold { font-weight: bold; }
                .font-semibold { font-weight: 600; }
                .text-gray-500, .text-gray-600 { color: #6B7280; }
                .text-red-600 { color: #dc2626; }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .uppercase { text-transform: uppercase; }
                .italic { font-style: italic; }
                .w-8 { width: 2rem; }
                .w-16 { width: 4rem; }
                .space-y-0\\.5 > * + * { margin-top: 0.125rem; }
                .space-y-1 > * + * { margin-top: 0.25rem; }
                hr { border: 0; border-top: 1px dashed #D1D5DB; margin: 0.5rem 0; }
                .border-t-2 { border-top: 2px solid black; }
                .border-b { border-bottom: 1px dashed #D1D5DB; }
                .border-dashed { border-style: dashed; }
                .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                @media print { body { padding: 0; } }
            </style>
        `;
    }
}

function is_array_safe(arr) {
    return Array.isArray(arr) && arr.length > 0;
}
