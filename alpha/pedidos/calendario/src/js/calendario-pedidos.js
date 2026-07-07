let api = 'ctrl/ctrl-calendario.php';
let app;

$(function () {
    app = new App(api, 'root');
    app.init();
});

class App extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Calendario";
        this.calendar = null;
        this.subsidiaries = [];
        this.isAdmin = false;
        this._pedidosLink = '../ctrl/ctrl-pedidos.php';
        this._calendarLink = link;
    }

    async init() {
        const data = await useFetch({ url: this._link, data: { opc: 'init' } });
        this.subsidiaries = data.subsidiaries;
        this.subsidiariesCobro = data.subsidiariesCobro || [];
        this.isAdmin = data.isAdmin;
        this.subsidiaryName = data.subsidiaryName || '';
        this.subsidiaryId = data.subsidiaryId || null;
        this.render();

        // Sincronizar con el navbar global (menus): cuando el admin cambia de sucursal
        // en el navbar filtra la vista y dispara 'subsidiaryChanged' SIN recargar. El
        // calendario refleja ese cambio en su propio filtro (#subsidiaryFilter) y
        // recarga. (El cajero hace switch de sesion con recarga, que ya reinicia el
        // calendario por si mismo.)
        document.addEventListener('subsidiaryChanged', (e) => {
            const id = (e.detail && e.detail.id != null) ? String(e.detail.id) : '0';
            $('#subsidiaryFilter').val(id);
            this.createCalendar();
        });
    }

    render() {
        this.layout();
        this.createCalendar();
    }

    layout() {
        this.primaryLayout({
            parent: this._div_modulo,
            id: this.PROJECT_NAME,
            class: 'd-flex lg:mx-2 lg:my-2 h-100  lg:p-2',
            card: {
                container: {
                    id: `container${this.PROJECT_NAME}`,
                    class: 'w-full h-auto my-3 rounded-lg p-3 bg-[#1F2A37]'
                }
            }
        });

        $(`#container${this.PROJECT_NAME}`).html(`
            <div class="p-2 flex flex-wrap items-center justify-between gap-3">
                <button title="Regresar" type="button"
                    class="btn bg-gray-700 hover:bg-purple-950 text-white px-4 py-2 rounded w-full sm:w-auto"
                    onclick="window.location.href = '/alpha/pedidos/'">
                    <small><i class="icon-reply"></i> Volver a Lista</small>
                </button>

                <div class="flex flex-wrap items-center gap-3">
                    <div class="relative">
                        <button id="statusFilterBtn" type="button" 
                            class="flex items-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-300 text-blue-700 px-4 py-2 rounded-md text-sm font-medium transition-colors">
                            <i class="icon-filter"></i>
                            <span>Filtrar Estados</span>
                            <span id="statusCount" class="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">4</span>
                            <i class="icon-down-open text-xs"></i>
                        </button>
                        
                        <div id="statusDropdown" class="hidden absolute top-full left-0 mt-2 bg-[#2B3D4F] border border-gray-300 rounded-lg shadow-lg z-50 min-w-[240px]">
                            <div class="p-3 border-b border-gray-200">
                                <p class="text-xs font-semibold text-white uppercase">Seleccionar Estados</p>
                            </div>
                            <div class="p-2 space-y-1">
                                <label class="flex items-center gap-3 px-3 py-2 hover:bg-gray-800 rounded cursor-pointer transition-colors">
                                    <input type="checkbox" value="1" class="status-checkbox w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500" checked>
                                    <i class="icon-blank text-lg" style="color: #6E95C0"></i>
                                    <span class="text-sm text-white">Cotización</span>
                                </label>
                                <label class="flex items-center gap-3 px-3 py-2 hover:bg-gray-800 rounded cursor-pointer transition-colors">
                                    <input type="checkbox" value="2" class="status-checkbox w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500" checked>
                                    <i class="icon-blank text-lg" style="color: #FE6F00"></i>
                                    <span class="text-sm text-white">Pendiente</span>
                                </label>
                                <label class="flex items-center gap-3 px-3 py-2 hover:bg-gray-800 rounded cursor-pointer transition-colors">
                                    <input type="checkbox" value="3" class="status-checkbox w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500" checked>
                                    <i class="icon-blank text-lg" style="color: #0E9E6E"></i>
                                    <span class="text-sm text-white">Pagado</span>
                                </label>
                                <label class="flex items-center gap-3 px-3 py-2 hover:bg-gray-800 rounded cursor-pointer transition-colors">
                                    <input type="checkbox" value="4" class="status-checkbox w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500" checked>
                                    <i class="icon-blank text-lg" style="color: #E60001"></i>
                                    <span class="text-sm text-white">Cancelado</span>
                                </label>
                            </div>
                            <div class="p-2 border-t border-gray-200 flex gap-2">
                                <button id="selectAllBtn" class="flex-1 text-xs px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors">
                                    Todos
                                </button>
                                <button id="clearAllBtn" class="flex-1 text-xs px-3 py-1.5 bg-red-100 hover:bg-red-200 text-gray-700 rounded transition-colors">
                                    Ninguno
                                </button>
                            </div>
                        </div>
                    </div>

                    <div class="relative">
                        <button id="deliveryFilterBtn" type="button" 
                            class="flex items-center gap-2 bg-green-500/10 hover:bg-green-500/20 border border-green-300 text-green-700 px-4 py-2 rounded-md text-sm font-medium transition-colors">
                            <i class="icon-truck"></i>
                            <span>Estado Entrega</span>
                            <span id="deliveryCount" class="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">3</span>
                            <i class="icon-down-open text-xs"></i>
                        </button>
                        
                        <div id="deliveryDropdown" class="hidden absolute top-full left-0 mt-2 bg-[#2B3D4F] border border-gray-300 rounded-lg shadow-lg z-50 min-w-[240px]">
                            <div class="p-3 border-b border-gray-200">
                                <p class="text-xs font-semibold text-white uppercase">Estado de Entrega</p>
                            </div>
                            <div class="p-2 space-y-1">
                                <label class="flex items-center gap-3 px-3 py-2 hover:bg-gray-800 rounded cursor-pointer transition-colors">
                                    <input type="checkbox" value="1" class="delivery-checkbox w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500" checked>
                                    <i class="icon-ok text-lg text-green-400"></i>
                                    <span class="text-sm text-white">Entregado</span>
                                </label>
                                <label class="flex items-center gap-3 px-3 py-2 hover:bg-gray-800 rounded cursor-pointer transition-colors">
                                    <input type="checkbox" value="2" class="delivery-checkbox w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500" checked>
                                    <span class="text-lg">🎂</span>
                                    <span class="text-sm text-white">Para Producir</span>
                                </label>
                                <label class="flex items-center gap-3 px-3 py-2 hover:bg-gray-800 rounded cursor-pointer transition-colors">
                                    <input type="checkbox" value="0" class="delivery-checkbox w-4 h-4 text-green-600 rounded focus:ring-2 focus:ring-green-500" checked>
                                    <i class="icon-cancel text-lg text-orange-400"></i>
                                    <span class="text-sm text-white">No Entregado</span>
                                </label>
                            </div>
                            <div class="p-2 border-t border-gray-200 flex gap-2">
                                <button id="selectAllDeliveryBtn" class="flex-1 text-xs px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors">
                                    Todos
                                </button>
                                <button id="clearAllDeliveryBtn" class="flex-1 text-xs px-3 py-1.5 bg-red-100 hover:bg-red-200 text-gray-700 rounded transition-colors">
                                    Ninguno
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex flex-col gap-1 bg-purple-500/10 px-3 py-2 rounded-md shadow-sm w-fit">
                        <label for="subsidiaryFilter" class="text-xs font-medium text-purple-700">Sucursal:</label>
                        <select id="subsidiaryFilter" class="text-xs border border-purple-300 rounded-md px-2 py-1 focus:ring-1 focus:ring-purple-400 focus:border-purple-400" style="min-width: 180px;">
                            <option value="0">Todas las sucursales</option>
                        </select>
                    </div>

                    <div class="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                        <p class="flex items-center">
                            <i class="icon-blank text-lg" style="color: #6E95C0"></i> Cotización
                        </p>
                        <p class="flex items-center">
                            <i class="icon-blank text-lg" style="color: #0E9E6E"></i> Pagado
                        </p>
                        <p class="flex items-center">
                            <i class="icon-blank text-lg" style="color: #FE6F00"></i> Pendiente
                        </p>
                        <p class="flex items-center">
                            <i class="icon-blank text-lg" style="color: #E60001"></i> Cancelado
                        </p>
                    </div>
                </div>
            </div>

            <div class="row h-full mt-4">
                <div class="bg-[#111928] rounded-lg p-4 h-100 w-full" id="calendarFull"></div>
            </div>
        `);

        this.initSubsidiaryFilter();
        this.initStatusFilter();
    }

    initSubsidiaryFilter() {
        // Selector disponible para todos: permite ver una sucursal o "Todas".
        const $select = $('#subsidiaryFilter');

        this.subsidiaries.forEach(sub => {
            $select.append(`<option value="${sub.id}">${sub.valor}</option>`);
        });

        // Arranca en la sucursal activa del usuario; puede cambiar a "Todas".
        if (this.subsidiaryId) {
            $select.val(this.subsidiaryId);
        }

        $select.on('change', () => {
            this.createCalendar();
        });
    }

    initStatusFilter() {
        const $statusBtn = $('#statusFilterBtn');
        const $statusDropdown = $('#statusDropdown');
        const $statusCheckboxes = $('.status-checkbox');
        const $statusCount = $('#statusCount');

        const $deliveryBtn = $('#deliveryFilterBtn');
        const $deliveryDropdown = $('#deliveryDropdown');
        const $deliveryCheckboxes = $('.delivery-checkbox');
        const $deliveryCount = $('#deliveryCount');

        $statusBtn.on('click', (e) => {
            e.stopPropagation();
            $statusDropdown.toggleClass('hidden');
            $deliveryDropdown.addClass('hidden');
        });

        $deliveryBtn.on('click', (e) => {
            e.stopPropagation();
            $deliveryDropdown.toggleClass('hidden');
            $statusDropdown.addClass('hidden');
        });

        $(document).on('click', (e) => {
            if (!$(e.target).closest('#statusFilterBtn, #statusDropdown, #deliveryFilterBtn, #deliveryDropdown').length) {
                $statusDropdown.addClass('hidden');
                $deliveryDropdown.addClass('hidden');
            }
        });

        const updateStatusCount = () => {
            const count = $statusCheckboxes.filter(':checked').length;
            $statusCount.text(count);
        };

        const updateDeliveryCount = () => {
            const count = $deliveryCheckboxes.filter(':checked').length;
            $deliveryCount.text(count);
        };

        $statusCheckboxes.on('change', () => {
            updateStatusCount();
            this.createCalendar();
        });

        $deliveryCheckboxes.on('change', () => {
            updateDeliveryCount();
            this.createCalendar();
        });

        $('#selectAllBtn').on('click', () => {
            $statusCheckboxes.prop('checked', true);
            updateStatusCount();
            this.createCalendar();
        });

        $('#clearAllBtn').on('click', () => {
            $statusCheckboxes.prop('checked', false);
            updateStatusCount();
            this.createCalendar();
        });

        $('#selectAllDeliveryBtn').on('click', () => {
            $deliveryCheckboxes.prop('checked', true);
            updateDeliveryCount();
            this.createCalendar();
        });

        $('#clearAllDeliveryBtn').on('click', () => {
            $deliveryCheckboxes.prop('checked', false);
            updateDeliveryCount();
            this.createCalendar();
        });
    }

    async createCalendar() {
        const selectedStatuses = $('.status-checkbox:checked').map(function () {
            return $(this).val();
        }).get();

        const selectedDelivery = $('.delivery-checkbox:checked').map(function () {
            return $(this).val();
        }).get();

        if (selectedStatuses.length === 0 || selectedDelivery.length === 0) {
            if (this.calendar) {
                this.calendar.destroy();
            }
            $('#calendarFull').html('<div class="flex items-center justify-center h-full text-gray-400"><p>Selecciona al menos un estado y un tipo de entrega para ver los pedidos</p></div>');
            return;
        }

        // Cualquier usuario filtra por la sucursal elegida en el selector
        // ("0" = todas las sucursales).
        const subsidiaryId = $('#subsidiaryFilter').val() || 0;

        let data = await useFetch({
            url: this._calendarLink,
            data: {
                opc: 'getCalendar',
                statuses: selectedStatuses.join(','),
                delivery: selectedDelivery.join(','),
                subsidiaries_id: subsidiaryId
            }
        });

        const calendarEl = document.getElementById('calendarFull');

        if (!calendarEl) {
            console.error('Elemento del calendario no encontrado');
            return;
        }

        if (this.calendar) {
            this.calendar.destroy();
        }

        this.calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            locale: 'es',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            height: 'auto',
            contentHeight: 'auto',
            dayMaxEvents: 3,
            moreLinkClick: 'popover',
            eventMaxStack: 3,
            events: data,
            eventContent: (arg) => this.renderEventContent(arg),
            eventClick: (info) => this.showOrder(info.event.id),
            datesSet: () => this.customizeCalendarAppearance()
        });

        this.calendar.render();
        this.applyCalendarStyles();
    }

    renderEventContent(arg) {
        let envio_domicilio = arg.event.extendedProps.type == 'Envío a Domicilio' ? true : false;
        let entregado = arg.event.extendedProps.delivery == 'Entregado' ? true : false;
        let paraProducir = arg.event.extendedProps.delivery == 'Para Producir' ? true : false;

        // Si es para producir, usar emoji de pastel, sino usar el emoji según tipo de entrega
        let emoji = paraProducir ? "🎂" : (envio_domicilio ? "🚚" : "🏠");

        // Contenedor principal
        let containerEl = document.createElement("div");
        containerEl.classList.add("p-2", "w-full");

        // Nombre del cliente
        let titleEl = document.createElement("div");
        titleEl.classList.add("font-semibold", "text-sm", "mb-1", "truncate");
        titleEl.innerHTML = arg.event.title;

        // Tipo de entrega
        let deliveryEl = document.createElement("div");
        deliveryEl.classList.add("flex", "items-center", "gap-1", "text-xs", "mb-1", "opacity-80");
        deliveryEl.innerHTML = `
        <span>${emoji}</span>
        <span>${arg.event.extendedProps.type}</span>
    `;

        // Hora
        let timeEl = document.createElement("div");
        timeEl.classList.add("flex", "items-center", "gap-1", "text-xs", "opacity-80");
        timeEl.innerHTML = `
        <i class='icon-clock'></i>
        <span>${arg.event.extendedProps.hour}</span>
    `;

        // Badge de estado
        let badgeEl = document.createElement("div");
        badgeEl.classList.add("mt-1.5");

        let badgeClass = "bg-orange-100 text-orange-700 border-1 border-orange-300";

        if (entregado) {
            badgeClass = "bg-green-100 text-green-700 border-1 border-green-300";
        } else if (paraProducir) {
            badgeClass = "bg-purple-100 text-purple-700 border-1 border-purple-300";
        }

        badgeEl.innerHTML = `
        <span class="${badgeClass} px-2 py-0.5 rounded-full text-xs font-medium inline-block">
            ${arg.event.extendedProps.delivery}
        </span>
    `;

        // Ensamblar elementos
        containerEl.appendChild(titleEl);
        containerEl.appendChild(deliveryEl);
        containerEl.appendChild(timeEl);
        containerEl.appendChild(badgeEl);

        return { domNodes: [containerEl] };
    }

    customizeCalendarAppearance() {
        document.querySelectorAll('.fc-day-today').forEach(el => {
            el.style.backgroundColor = '#2C3E50';
        });

        document.querySelectorAll('.fc-daygrid-day, .fc-scrollgrid, .fc-theme-standard td, .fc-theme-standard th').forEach(el => {
            el.style.border = '1px solid #1F2A37';
        });
    }

    applyCalendarStyles() {
        const styleId = 'calendar-custom-styles';
        if ($('#' + styleId).length === 0) {
            $('<style>', {
                id: styleId,
                text: `
                    thead {
                        background: #2B3D4F;
                    }

                    .fc-daygrid-day-frame {
                        min-height: 120px !important;
                        max-height: 600px !important;
                    }
                    
                    .fc-daygrid-day-events {
                        max-height: 600px !important;
                        overflow-y: auto !important;
                        margin-bottom: 2px !important;
                    }
                    
                    .fc-daygrid-day-events::-webkit-scrollbar {
                        width: 4px;
                    }
                    
                    .fc-daygrid-day-events::-webkit-scrollbar-track {
                        background: #1F2A37;
                        border-radius: 2px;
                    }
                    
                    .fc-daygrid-day-events::-webkit-scrollbar-thumb {
                        background: #4B5563;
                        border-radius: 2px;
                    }
                    
                    .fc-daygrid-day-events::-webkit-scrollbar-thumb:hover {
                        background: #6B7280;
                    }
                    
                    .fc-daygrid-event {
                        margin-bottom: 2px !important;
                        font-size: 0.75rem !important;
                    }
                    
                    .fc-daygrid-event-harness {
                        margin-bottom: 2px !important;
                    }
                    
                    .fc-more-link {
                        font-size: 0.7rem !important;
                        padding: 2px 4px !important;
                        background: #374151 !important;
                        color: #9CA3AF !important;
                        border-radius: 4px !important;
                        margin-top: 2px !important;
                    }
                    
                    .fc-more-link:hover {
                        background: #4B5563 !important;
                        color: #D1D5DB !important;
                    }
                    
                    .fc-popover {
                        background: #1F2A37 !important;
                        border: 1px solid #374151 !important;
                        max-height: 600px !important;
                        overflow-y: auto !important;         
                    }
                    
                    .fc-popover-header {
                        background: #111928 !important;
                        color: #fff !important;
                        padding: 8px 12px !important;
                    }
                    
                    .fc-popover-body {
                        padding: 8px !important;
                    }
                `
            }).appendTo('head');
        }
    }



    // Show Order.

    async showOrder(orderId) {
        const response = await useFetch({
            url: this._pedidosLink,
            data: { opc: 'getOrderDetails', id: orderId }
        });



        const tipo = response.data.order.delivery_type;
        const badgeTipo = this.getBadgeDeliveryType(tipo);
        const subsidiarieName = response.data.order.subsidiarie_name || '';

        const modal = bootbox.dialog({
            title: `
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                        ${lucideIcon('cake', 'w-4 h-4 text-white')}
                    </div>
                    <div>
                        <h2 class="text-lg font-semibold text-white">Detalles del Pedido</h2>
                        <div class="flex items-center gap-2 mt-1">
                            ${badgeTipo}
                            <span class="px-2 py-0.5 text-xs font-medium rounded bg-gray-600 text-gray-200 inline-flex items-center gap-1">
                                ${lucideIcon('house', 'w-3.5 h-3.5')}${subsidiarieName}
                            </span>
                        </div>
                    </div>
                </div>
            `,
            message: '<div id="orderDetailsContainer" class="max-h-[70vh] overflow-y-auto"></div>',
            size: 'lg',
            closeButton: true,
            className: 'order-details-enhanced-modal'
        });

        this.layoutManager = {
            isMobile: () => window.innerWidth < 768,
            isTablet: () => window.innerWidth >= 768 && window.innerWidth < 1024,
            isDesktop: () => window.innerWidth >= 1024,

            applyLayout: function () {
                const container = $('#orderDetailsContainer');
                container.removeClass('flex flex-col flex-row space-y-4   p-3');

                if (this.isMobile()) {
                    container.addClass('flex flex-col space-y-4 p-3');
                } else if (this.isTablet()) {
                    container.addClass('flex flex-col lg:flex-row p-3');
                } else {
                    container.addClass('flex flex-row  p-3');
                }
            }
        };

        setTimeout(() => {
            this.layoutManager.applyLayout();
            const orderData = response.data.order || {};
            const products = response.data.products || [];
            const paymentMethods = response.data.paymentMethods || [];

            const container = $('#orderDetailsContainer');
            container.html(`
                <div id="orderInfoPanel" class="w-full lg:w-1/3 mb-6 lg:mb-0 lg:pr-3">
                    <div class="lg:sticky lg:top-4">
                        ${(orderData.is_delivered != '2') && (orderData.status != '3' && orderData.status != '4') ? `
                            <div class="grid grid-cols-3 gap-2 mb-3">
                                <button onclick="app.historyPay(${orderId})"
                                    class="flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-[11px] font-medium px-2 py-2 rounded-md transition-colors">
                                    ${lucideIcon('dollar-sign', 'w-3.5 h-3.5')} Pagar
                                </button>
                                <button onclick="app.printOrder(${orderId})"
                                    class="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium px-2 py-2 rounded-md transition-colors">
                                    ${lucideIcon('printer', 'w-3.5 h-3.5')} Imprimir
                                </button>
                                <button onclick="app.addDiscount(${orderId})"
                                    class="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-medium px-2 py-2 rounded-md transition-colors">
                                    ${lucideIcon('percent', 'w-3.5 h-3.5')} Descuento
                                </button>
                            </div>
                        ` : ''}
                        ${(orderData.is_delivered == '0' || orderData.is_delivered == null ) && (orderData.status != '4') ? `
                            <button onclick="app.handleDeliveryClick(${orderId}, ${orderData.is_delivered || 0}, '${orderData.folio || ''}')"
                                    class="w-full mb-3 flex items-center justify-center gap-1.5
                                        text-white text-[11px] font-medium px-2 py-2 rounded-md
                                        glass-purple-btn">
                                Entregar productos
                            </button>
                        ` : ''}
                        ${this.detailsCard(orderData, paymentMethods)}
                    </div>
                </div>

                <div id="productDisplayArea" class="w-full lg:w-2/3 lg:pl-3">
                    ${this.listProducts(products)}
                </div>
            `);

            $(window).on('resize.orderDetails', () => {
                // this.layoutManager.applyLayout();
            });
        }, 100);

        modal.on('hidden.bs.modal', () => {
            $(window).off('resize.orderDetails');
        });

        $("<style>").text(`
            .order-details-enhanced-modal .modal-dialog {
                max-width: 900px !important;
                width: 85vw !important;
            }
            .order-details-enhanced-modal .modal-body {
                padding: 0 !important;
                max-height: 70vh !important;
                overflow-y: auto !important;
            }
            .order-details-enhanced-modal .modal-content {
                max-height: 85vh !important;
            }

            @media (max-width: 768px) {
                .order-details-enhanced-modal .modal-dialog {
                    width: 95vw !important;
                    margin: 10px auto !important;
                }
                .order-details-enhanced-modal .modal-body {
                    max-height: 65vh !important;
                }
            }

            @media (max-width: 480px) {
                .order-details-enhanced-modal .modal-dialog {
                    width: 98vw !important;
                    margin: 5px auto !important;
                }
                .order-details-enhanced-modal .modal-body {
                    max-height: 60vh !important;
                }
            }
        `).appendTo("head");

        return modal;
    }

    getBadgeDeliveryType(tipo) {
        if (tipo == 0 || tipo === '0') {
            return `<span class="px-3 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700 inline-flex items-center gap-1 w-24 justify-center">${lucideIcon('house', 'w-3.5 h-3.5')} Local</span>`;
        } else if (tipo == 1 || tipo === '1') {
            return `<span class="px-3 py-1 rounded text-xs font-semibold bg-amber-100 text-amber-700 inline-flex items-center gap-1 w-28 justify-center">${lucideIcon('truck', 'w-3.5 h-3.5')} Domicilio</span>`;
        }
        return '<span class="px-3 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-700 inline-block w-24 text-center">Sin especificar</span>';
    }

    detailsCard(orderData, paymentMethods = []) {
        return `
            <div class="space-y-3">
                ${this.infoOrder(orderData)}
                ${this.infoSales(orderData, paymentMethods)}
            </div>
        `;
    }

    handleDeliveryClick(orderId, currentStatus, folio) {
        Swal.fire({
            title: '📦 Actualizar estado de entrega',
            html: `<p class="mb-3">Selecciona el estado del pedido <strong>${folio}</strong></p>`,
            icon: 'question',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: '✓ Entregado',
            denyButtonText: '🎂 Para producir',
            cancelButtonText: '✗ No entregado',
            confirmButtonColor: '#10b981',
            denyButtonColor: '#db2777',
            cancelButtonColor: '#ef4444',
            reverseButtons: false,
            customClass: {
                popup: 'bg-[#1F2A37] text-white rounded-lg shadow-lg px-2',
                title: 'text-2xl font-semibold',
                content: 'text-gray-300',
                confirmButton: 'bg-[#10b981] hover:bg-[#0E9E6E] text-white py-2 px-4 rounded',
                denyButton: 'bg-[#db2777] hover:bg-[#be185d] text-white py-2 px-4 rounded',
                cancelButton: 'bg-[#ef4444] hover:bg-[#dc2626] text-white py-2 px-4 rounded',
            }
        }).then(async (result) => {
            let newStatus = null;

            if (result.isConfirmed) {
                newStatus = 1; // Entregado
            } else if (result.isDenied) {
                newStatus = 2; // Para producir
            } else if (result.dismiss === Swal.DismissReason.cancel) {
                newStatus = 0; // No entregado
            }

            if (newStatus !== null) {
                const response = await useFetch({
                    url: this._link,
                    data: {
                        opc: 'updateDeliveryStatus',
                        id: orderId,
                        is_delivered: newStatus
                    }
                });

                if (response.status == 200) {
                    // Cierra el modal de detalles del pedido
                    $('.order-details-enhanced-modal').modal('hide');
                     alert({
                        icon: 'success',
                        title: 'Estado actualizado',
                        text: response.message,
                        timer: 2000,
                        showConfirmButton: false
                    });
                    // Recarga el calendario para reflejar el cambio
                    this.createCalendar();
                   
                } else {
                    alert({
                        icon: 'error',
                        title: 'Error',
                        text: response.message,
                        btn1: true,
                        btn1Text: 'Ok'
                    });
                }
            }
        });
    }

    infoOrder(orderData) {
        return `
            <div class="bg-[#2C3E50] rounded-lg p-3">
                <h3 class="text-white font-semibold text-base mb-2 flex items-center">
                    ${lucideIcon('info', 'w-4 h-4 text-blue-400 mr-2')}
                    Información del Pedido
                </h3>

                <div class="space-y-1.5">
                    <div class="flex items-center gap-2">
                        ${lucideIcon('file-text', 'w-4 h-4 text-gray-400 shrink-0')}
                        <span class="text-gray-400 text-xs">Folio:</span>
                        <span class="text-white font-semibold text-sm ml-auto text-right">${orderData.folio || 'N/A'}</span>
                    </div>

                    <div class="flex items-center gap-2">
                        ${lucideIcon('user', 'w-4 h-4 text-gray-400 shrink-0')}
                        <span class="text-gray-400 text-xs">Cliente:</span>
                        <span class="text-white font-semibold text-sm ml-auto text-right">${orderData.name || 'N/A'}</span>
                    </div>

                    <div class="flex items-center gap-2">
                        ${lucideIcon('calendar', 'w-4 h-4 text-gray-400 shrink-0')}
                        <span class="text-gray-400 text-xs">Fecha de entrega:</span>
                        <span class="text-white font-semibold text-sm ml-auto text-right">${orderData.formatted_date_order || orderData.date_order || 'N/A'}</span>
                    </div>

                    <div class="flex items-center gap-2">
                        ${lucideIcon('clock', 'w-4 h-4 text-gray-400 shrink-0')}
                        <span class="text-gray-400 text-xs">Hora:</span>
                        <span class="text-white font-semibold text-sm ml-auto text-right">${orderData.time_order || 'N/A'}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        ${lucideIcon('truck', 'w-4 h-4 text-gray-400 shrink-0')}
                        <span class="text-gray-400 text-xs">Estado de entrega:</span>
                        <span class="ml-auto">${this.statusDelivery(orderData.is_delivered)}</span>
                    </div>

                </div>
            </div>
        `;
    }

    statusDelivery(is_delivered) {
        if (is_delivered == '1') {
            return `<span class="px-2 py-0.5 text-xs font-medium rounded border-1 border-green-600 text-green-600 inline-flex items-center gap-1">
                        ${lucideIcon('check', 'w-3.5 h-3.5')} Entregado
                    </span>`;
        } else if (is_delivered == '2') {
            return `<span class="px-2 py-0.5 text-xs font-medium rounded border-1 border-purple-600 text-purple-600 inline-flex items-center gap-1">
                        ${lucideIcon('cake', 'w-3.5 h-3.5')} Para Producir
                    </span>`;
        } else {
            return `<span class="px-2 py-0.5 text-xs font-medium rounded border-1 border-red-600 text-red-600 inline-flex items-center gap-1">
                        ${lucideIcon('x', 'w-3.5 h-3.5')} No entregado
                    </span>`;
        }
    }

    infoSales(orderData, paymentMethods = []) {
        const totalPay = parseFloat(orderData.total_pay || 0);
        const discount = parseFloat(orderData.discount || 0);
        const totalPaid = parseFloat(orderData.total_paid || 0);
        const balance = parseFloat(orderData.balance || 0);
        const infoDiscount = orderData.info_discount || '';

        const methodsHtml = (Array.isArray(paymentMethods) && paymentMethods.length > 0) ? `
                    <div class="pl-2 space-y-1 border-l-2 border-gray-600">
                        ${paymentMethods.map(m => `
                        <div class="flex items-center justify-between">
                            <span class="text-gray-500 text-xs flex items-center gap-1.5">
                                ${lucideIcon('credit-card', 'w-3.5 h-3.5')}
                                ${m.method_pay || 'Sin método'}:
                            </span>
                            <span class="text-gray-300 text-xs">$${parseFloat(m.pay || 0).toFixed(2)}</span>
                        </div>
                        `).join('')}
                    </div>
        ` : '';

        const discountHtml = discount > 0 ? `
                    <div class="flex items-center justify-between">
                        <span class="text-gray-400 text-sm">Descuento:</span>
                        <span class="text-yellow-400 font-bold text-sm">-$${discount.toFixed(2)}</span>
                    </div>
                    ${infoDiscount ? `
                    <div class="flex items-center justify-start">
                        <span class="text-gray-500 text-xs italic">${infoDiscount}</span>
                    </div>
                    ` : ''}
        ` : '';

        return `
            <div class="bg-[#2C3E50] rounded-lg p-3">
                <h3 class="text-white font-semibold text-base mb-2 flex items-center">
                    ${lucideIcon('dollar-sign', 'w-4 h-4 text-green-400 mr-2')}
                    Resumen de pago
                </h3>

                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="text-gray-400 text-sm">Subtotal:</span>
                        <span class="text-white font-bold text-sm">$${totalPay.toFixed(2)}</span>
                    </div>

                    ${discountHtml}

                    <div class="flex items-center justify-between">
                        <span class="text-gray-400 text-sm">Pagado:</span>
                        <span class="text-green-400 font-bold text-sm">$${totalPaid.toFixed(2)}</span>
                    </div>

                    ${methodsHtml}

                    <div class="border-t border-gray-600 my-1.5"></div>

                    <div class="flex items-center justify-between">
                        <span class="text-gray-400 text-sm">Saldo:</span>
                        <span class="text-red-400 font-bold text-sm">$${balance.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    listProducts(products) {



        if (!products || products.length === 0) {
            return `
                <div class="bg-[#283341] rounded-lg p-2 text-center h-full flex flex-col items-center justify-center">
                    ${lucideIcon('shopping-basket', 'w-12 h-12 text-gray-500 mb-4')}
                    <h3 class="text-white text-lg font-semibold mb-2">No hay productos</h3>
                    <p class="text-gray-400">Este pedido no contiene productos.</p>
                </div>
            `;
        }

        const totalItems = products.reduce((acc, item) => acc + parseInt(item.quantity || 1), 0);

        return `
            <div class="flex flex-col h-full">
                <div class="bg-[#283341] rounded-lg p-3 mb-3">
                    <div class="flex items-center justify-between">
                        <h3 class="text-white font-semibold text-lg flex items-center">
                            ${lucideIcon('shopping-basket', 'w-5 h-5 mr-2 text-blue-400')}
                            Productos del Pedido
                        </h3>
                        <span class="text-gray-300 font-medium"> ${totalItems} productos</span>
                    </div>
                </div>
                <div id="productsContainer" class="space-y-4 overflow-y-auto flex-1">
            ${products.map(product => {

            console.log('recorrido de product: ', product);


            if (product.is_custom || (product.customer_products && product.customer_products.length > 0)) {

                return this.cardCustom(product);

            } else {
                return this.cardNormal(product);
            }
        }).join('')}
                </div>
            </div>
        `;
    }

    cardNormal(product) {
        const total = parseFloat(product.price || 0) * parseInt(product.quantity || 1);
        const hasDedication = product.dedication && product.dedication.trim() !== '';
        const hasDetails = product.order_details && product.order_details.trim() !== '';

        return `
            <div class="bg-[#2C3E50] rounded-lg p-3 relative">
                <div class="absolute top-5 right-6 text-right">
                    <span class="text-gray-400 text-sm">Cantidad: <span class="text-white font-bold text-sm">${product.quantity || 1}</span></span>
                </div>

                <div class="flex items-start gap-6 pr-32">
                    <div class="w-28 h-28 rounded-lg overflow-hidden bg-[#D8B4E2] flex-shrink-0">
                        ${this.renderProductImage(product)}
                    </div>

                    <div class="flex-1">
                        <h4 class="text-white font-bold text-lg mb-2 uppercase">${product.name || 'Producto sin nombre'}</h4>
                        <p class="text-blue-400 font-semibold text-xs mb-4">$${parseFloat(product.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} c/u</p>

                        ${(hasDedication || hasDetails) ? `
                        <div class="flex gap-12">
                            ${hasDedication ? `
                            <div class="flex-1">
                                <span class="text-gray-400 text-sm font-medium">Dedicatoria:</span>
                                <p class="text-white text-xs">${product.dedication}</p>
                            </div>
                            ` : ''}
                            ${hasDetails ? `
                            <div class="flex-1">
                                <span class="text-gray-400 text-sm font-medium">Observaciones:</span>
                                <p class="text-white text-xs">${product.order_details}</p>
                            </div>
                            ` : ''}
                        </div>
                        ` : ''}
                    </div>
                </div>

                <div class="absolute bottom-5 right-6 text-right">
                    <span class="text-gray-400 text-sm block mb-1">Total:</span>
                    <p class="text-white font-bold text-lg">$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
            </div>
        `;
    }

    cardCustom(product) {

        console.log('🧩 cardCustom: ', product);

        const hasDedication = product.dedication && product.dedication.trim() !== '';
        const hasDetails = product.order_details && product.order_details.trim() !== '';
        const hasImages = product.images && Array.isArray(product.images) && product.images.length > 0;
        const hasCustomization = product.customer_products && product.customer_products.length > 0;

        const customizationTotal = product.customer_products ?
            product.customer_products.reduce((sum, item) => sum + parseFloat(item.custom_price || 0), 0) : 0;

        const finalTotal = (parseFloat(product.price || 0) + customizationTotal) * parseInt(product.quantity || 1);


        return `
        <div class="bg-[#2C3E50] rounded-lg p-3 relative">
            <div class=" mb-6">
                <h4 class="text-white font-bold text-sm uppercase">${product.name || 'Pastel Personalizado'}</h4>
                <span class="inline-flex items-center px-3 py-2 mt-2 rounded-2xl text-[10px] font-bold bg-purple-200 text-purple-500 lowercase">
                    Personalizado
                </span>
            </div>

            <div class="absolute top-5 right-6">
                <span class="text-gray-400 text-sm">Cantidad: <span class="text-white font-bold">${product.quantity || 1}</span></span>
            </div>

            ${hasImages ? `
            <div class="flex gap-3 pb-4 border-b border-gray-700">
                ${product.images.slice(0, 3).map(img => {
            const thumbUrl = img.path.startsWith('http') ? img.path : `${img.path}`;
            const fullUrl = `https://huubie.com.mx/${thumbUrl}`;
            return `
                        <div class="w-28 h-28 rounded-lg overflow-hidden bg-gray-700 cursor-pointer hover:opacity-80 transition-opacity"
                             onclick="app.previewImage('${fullUrl}', '${(img.original_name || 'Imagen').replace(/'/g, "\\'")}')">
                            <img src="${fullUrl}"
                                 alt="${img.original_name || 'Imagen'}"
                                 class="object-cover w-full h-full pointer-events-none">
                        </div>
                    `;
        }).join('')}
            </div>
            ` : ''}

            <div class="mb-3">
                <span class="text-gray-400 text-sm">Porción: <span class="text-white font-bold text-sm">${product.portion_qty || 1}</span></span>
            </div>

            ${(hasDedication || hasDetails) ? `
            <div class="flex gap-12 mb-6 ">
                ${hasDedication ? `
                <div class="flex-1">
                    <span class="text-gray-400 text-sm font-medium">Dedicatoria:</span>
                    <p class="text-white text-base text-justify">${product.dedication}</p>
                </div>
                ` : ''}
                ${hasDetails ? `
                <div class="flex-1">
                    <span class="text-gray-400 text-sm font-medium">Observaciones:</span>
                    <p class="text-white text-base text-justify">${product.order_details}</p>
                </div>
                ` : ''}
            </div>
            ` : ''}

            ${hasCustomization ? `
            <div class="border-t border-gray-600 pt-4 mb-6 pr-32">
                <h5 class="text-purple-300 font-bold text-sm mb-2 uppercase">Personalización:</h5>
                ${this.renderPersonalizationGrid(product.customer_products)}
            </div>
            ` : ''}

            <div class="absolute bottom-5 right-6 text-right">
                <span class="text-gray-400 text-sm block mb-1 ">Total:</span>
                <p class="text-green-300 font-bold text-lg ">${formatPrice(product.price)}</p>
            </div>
        </div>
    `;
    }

    renderProductImage(product) {
        const hasImage = product.image && product.image.trim() !== '';

        if (hasImage) {
            const imageUrl = product.image.startsWith('http') ?
                product.image : `https://huubie.com.mx/${product.image}`;
            return `
                <img src="${imageUrl}" alt="${product.name}"
                     class="object-cover w-full h-full"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div class="w-full h-full items-center justify-center hidden">
                    <i class="icon-birthday text-white text-4xl"></i>
                </div>
            `;
        } else {
            return `
                <div class="w-full h-full flex items-center justify-center">
                    <i class="icon-birthday text-white text-4xl"></i>
                </div>
            `;
        }
    }

    renderPersonalizationGrid(customizations) {

        const grouped = {};
        customizations.forEach(item => {
            const category = `${item.modifier_name || ''}:` || '';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(item);
        });

        const entries = Object.entries(grouped);
        const half = Math.ceil(entries.length / 2);
        const leftColumn = entries.slice(0, half);
        const rightColumn = entries.slice(half);
        // <span class="text-white text-sm">$${parseFloat(item.custom_price || 0).toFixed(2)}</span>

        //  ${
        //     item.custom_price && parseFloat(item.custom_price) > 0 ?
        //     `<span class="text-white text-sm">$${parseFloat(item.custom_price).toFixed(2)}</span>` :
        //     ''
        // }
        return `
            <div class="grid grid-cols-2 gap-8">
                <div class="space-y-4">
                    ${leftColumn.map(([category, items]) => `
                        <div class="flex flex-col">
                            <span class="text-purple-300 font-bold text-sm tracking-wide uppercase">${category}</span>
                            ${items.map(item => `
                                <span class="text-white font-medium text-sm">${item.name || 'N/A'}</span>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>

                <div class="space-y-4">
                    ${rightColumn.map(([category, items]) => `
                        <div class="flex flex-col">
                            <span class="text-purple-300 font-bold text-sm tracking-wide uppercase">${category}</span>
                            ${items.map(item => `
                                <span class="text-white font-medium text-sm">${item.name || 'N/A'}</span>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // =============================================
    // Migrado desde app.js - Descuentos
    // =============================================

    _switchToPedidos() {
        this._calendarLink = this._link;
        this._link = this._pedidosLink;
    }

    _restoreLink() {
        this._link = this._calendarLink;
    }

    async refreshOrderDetails(orderId) {
        const response = await useFetch({
            url: this._pedidosLink,
            data: { opc: 'getOrderDetails', id: orderId }
        });
        const orderData = response.data.order || {};
        const paymentMethods = response.data.paymentMethods || [];
        $('#orderInfoPanel .lg\\:sticky').html(`
            <div class="grid grid-cols-3 gap-2 mb-3">
                <button onclick="app.historyPay(${orderId})"
                    class="flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-[11px] font-medium px-2 py-2 rounded-md transition-colors">
                    ${lucideIcon('dollar-sign', 'w-3.5 h-3.5')} Pagar
                </button>
                <button onclick="app.printOrder(${orderId})"
                    class="flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium px-2 py-2 rounded-md transition-colors">
                    ${lucideIcon('printer', 'w-3.5 h-3.5')} Imprimir
                </button>
                <button onclick="app.addDiscount(${orderId})"
                    class="flex items-center justify-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-medium px-2 py-2 rounded-md transition-colors">
                    ${lucideIcon('percent', 'w-3.5 h-3.5')} Descuento
                </button>
            </div>
            ${this.detailsCard(orderData, paymentMethods)}
        `);
    }

    async addDiscount(id) {
        const discountInfo = await useFetch({
            url: this._pedidosLink,
            data: { opc: "getDiscount", id: id }
        });

        const totalPay = parseFloat(discountInfo.data?.total_pay) || 0;
        const currentDiscount = parseFloat(discountInfo.data?.discount) || 0;
        const hasDiscount = currentDiscount > 0;

        this._switchToPedidos();
        this.createModalForm({
            id: 'formAddDiscount',
            data: { opc: 'addDiscount', id: id },
            autofill: discountInfo.data,
            bootbox: {
                title: '<i class="icon-percent text-green-400"></i> Aplicar Descuento',
                size: 'medium'
            },
            json: [
                {
                    opc: "input-group",
                    id: "total_pay",
                    lbl: "Total del pedido",
                    icon: 'icon-dollar',
                    disabled: true,
                    tipo: "cifra",
                    class: "col-12 mb-3"
                },
                {
                    opc: "input-group",
                    id: "discount",
                    lbl: "Monto del descuento",
                    icon: 'icon-dollar',
                    tipo: "cifra",
                    class: "col-12 mb-3",
                    placeholder: "$ 0.00",
                    required: true,
                    onkeyup: `app.calculateDiscounted(${totalPay})`
                },
                {
                    opc: "input",
                    id: "info_discount",
                    lbl: "Motivo del descuento",
                    class: "col-12 mb-3",
                    placeholder: "Ej: CLIENTE FRECUENTE",
                    required: true
                },
                ...(hasDiscount ? [{
                    opc: "button",
                    id: "btnRemoveDiscount",
                    color_btn: "outline-danger",
                    className: 'w-100',
                    text: "Quitar descuento actual",
                    class: "col-12",
                    onClick: () => {
                        this.removeDiscount(id, {
                            discount: currentDiscount,
                            reason: discountInfo.data?.info_discount || '',
                            total: totalPay
                        });
                        $('#formAddDiscount').closest('.bootbox').modal('hide');
                    }
                }] : []),
                {
                    opc: "div",
                    id: "totalDescontado",
                    class: 'col-12',
                    html: `
                        <div class="w-full mt-3 text-center bg-[#1E293B] p-4 rounded-lg">
                            <p class="text-sm text-gray-400 font-medium mb-1">Total con Descuento</p>
                            <p id="TotalConDescuento" class="text-2xl text-white font-bold">${formatPrice(totalPay)}</p>
                        </div>
                    `
                }
            ],
            success: (response) => {
                this._restoreLink();
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        title: "Descuento aplicado",
                        text: response.message,
                        btn1: true
                    });
                    this.refreshOrderDetails(id);
                } else {
                    alert({
                        icon: "error",
                        title: "Error",
                        text: response.message,
                        btn1: true
                    });
                }
            }
        });

        this.calculateDiscounted(totalPay);
    }

    calculateDiscounted(totalOriginal) {
        const descuentoInput = document.getElementById("discount");
        const saldoElement = document.getElementById("TotalConDescuento");
        const applyBtn = document.querySelector(".bootbox .btn-primary");

        if (descuentoInput && saldoElement && applyBtn) {
            const saldoOriginal = parseFloat(totalOriginal) || 0;
            const descuento = parseFloat(descuentoInput.value) || 0;
            const nuevoTotal = saldoOriginal - descuento;

            const totalFormateado = nuevoTotal.toLocaleString("es-MX", {
                style: "currency",
                currency: "MXN",
                minimumFractionDigits: 2
            });

            saldoElement.textContent = totalFormateado;

            if (nuevoTotal < 0) {
                saldoElement.classList.add("text-red-500");
                saldoElement.classList.remove("text-white");
            } else {
                saldoElement.classList.remove("text-red-500");
                saldoElement.classList.add("text-white");
            }

            applyBtn.disabled = nuevoTotal < 0;
        }
    }

    removeDiscount(id, orderData) {
        const { discount, reason, total } = orderData;

        this._switchToPedidos();
        this.createModalForm({
            id: "modalQuitarDescuento",
            parent: "root",
            data: { opc: "deleteDiscount", id: id },
            class: "",
            json: [
                {
                    opc: "div",
                    id: "bloqueDescuentoActual",
                    class: "col-12",
                    html: `
                        <div class="bg-[#334155] text-red-400 p-4 rounded-lg mb-3">
                            <p class="text-sm">Descuento actual:</p>
                            <p class="text-lg font-bold">-${formatPrice(discount)}</p>
                            <p class="text-sm text-white">${reason || 'Sin motivo especificado'}</p>
                        </div>
                    `
                },
                {
                    opc: "div",
                    id: "bloquePrecioSinDescuento",
                    class: "col-12",
                    html: `
                        <div class="bg-[#1E293B] p-4 rounded-lg text-center mb-3">
                            <p class="text-sm text-gray-400">Precio sin descuento</p>
                            <p class="text-2xl font-bold text-white">${formatPrice(total)}</p>
                        </div>
                    `
                },
                {
                    opc: "div",
                    id: "mensajeConfirmacion",
                    class: "col-12 text-center",
                    html: `<p class="text-sm text-gray-400">¿Estás seguro de que deseas quitar el descuento aplicado?</p>`
                }
            ],
            bootbox: {
                title: '<i class="icon-tag text-yellow-400"></i> Quitar Descuento',
                closeButton: true
            },
            success: (response) => {
                this._restoreLink();
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        title: "Descuento eliminado",
                        text: response.message,
                        btn1: true
                    });
                    this.refreshOrderDetails(id);
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true
                    });
                }
            }
        });
    }

    async editDiscount(id) {
        const discountInfo = await useFetch({
            url: this._pedidosLink,
            data: { opc: "getDiscount", id: id }
        });

        const data = discountInfo.data || {};
        const totalPay = parseFloat(data.total_pay) || 0;

        this._switchToPedidos();
        this.createModalForm({
            id: 'formEditDiscount',
            data: { opc: 'editDiscount', id: id },
            bootbox: {
                title: '<i class="icon-pencil text-yellow-400"></i> Editar Descuento',
                size: 'medium'
            },
            autofill: {
                discount: data.discount,
                info_discount: data.info_discount
            },
            json: [
                {
                    opc: "div",
                    id: "infoActual",
                    class: "col-12 mb-3",
                    html: `
                        <div class="bg-[#334155] p-3 rounded-lg">
                            <div class="flex justify-between mb-2">
                                <span class="text-gray-400">Total del pedido:</span>
                                <span class="text-white font-semibold">${formatPrice(totalPay)}</span>
                            </div>
                            <div class="flex justify-between">
                                <span class="text-gray-400">Descuento actual:</span>
                                <span class="text-red-400 font-semibold">-${formatPrice(data.discount)}</span>
                            </div>
                        </div>
                    `
                },
                {
                    opc: "input-group",
                    id: "discount",
                    lbl: "Nuevo monto del descuento",
                    icon: 'icon-dollar',
                    tipo: "cifra",
                    class: "col-12 mb-3",
                    placeholder: "$ 0.00",
                    required: true,
                    onkeyup: `app.calculateDiscounted(${totalPay})`
                },
                {
                    opc: "input",
                    id: "info_discount",
                    lbl: "Motivo del cambio",
                    class: "col-12 mb-3",
                    placeholder: "Ej: AJUSTE DE PRECIO"
                },
                {
                    opc: "div",
                    id: "totalDescontado",
                    class: 'col-12',
                    html: `
                        <div class="w-full mt-3 text-center bg-[#1E293B] p-4 rounded-lg">
                            <p class="text-sm text-gray-400 font-medium mb-1">Total con Descuento</p>
                            <p id="TotalConDescuento" class="text-2xl text-white font-bold">${formatPrice(totalPay - data.discount)}</p>
                        </div>
                    `
                }
            ],
            success: (response) => {
                this._restoreLink();
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        title: "Descuento actualizado",
                        text: response.message,
                        btn1: true
                    });
                    this.refreshOrderDetails(id);
                } else {
                    alert({
                        icon: "error",
                        title: "Error",
                        text: response.message,
                        btn1: true
                    });
                }
            }
        });

        this.calculateDiscounted(totalPay);
    }

    deleteDiscount(id) {
        this._switchToPedidos();
        this.swalQuestion({
            opts: {
                title: '¿Eliminar descuento?',
                html: `¿Estás seguro de eliminar el descuento de este pedido?
                <br><br>
                <span class="text-yellow-500">El total del pedido volverá a su valor original.</span>`,
                icon: 'warning'
            },
            data: { opc: 'deleteDiscount', id: id },
            methods: {
                request: (response) => {
                    this._restoreLink();
                    alert({
                        icon: 'success',
                        title: 'Descuento eliminado',
                        text: response.message,
                        btn1: true
                    });
                    this.refreshOrderDetails(id);
                }
            }
        });
    }

    // =============================================
    // Migrado desde app.js - Imprimir Pedido
    // =============================================

    async printOrder(id) {
        const pos = await useFetch({
            url: this._pedidosLink,
            data: { opc: "getOrderDetails", id: id }
        });

        const modal = bootbox.dialog({
            closeButton: true,
            title: `<div class="flex items-center gap-2 text-white text-lg font-semibold">
                        <i class="icon-print text-blue-400 text-xl"></i>
                        Imprimir
                    </div>`,
            message: `
                <div class="p-2">
                    <div id="containerPrintOrder"></div>
                </div>
            `
        });

        // Usa CatalogProduct (pedidos-catalogo.js) para generar el ticket
        const printer = new CatalogProduct(this._pedidosLink, 'root');
        printer.ticketPasteleria({
            parent: 'containerPrintOrder',
            data: {
                head: pos.data.order,
                products: pos.data.products,
                paymentMethods: pos.data.paymentMethods || [],
                clausules: pos.data.clausules || []
            }
        });
    }

    // =============================================
    // Migrado desde app.js - Historial de Pagos
    // =============================================

    async historyPay(id) {
        this._switchToPedidos();
        const data = await useFetch({
            url: this._pedidosLink,
            data: { opc: 'initHistoryPay', id }
        });
        const order = data.order;

        bootbox.dialog({
            title: `
                <div class="flex items-center gap-3">
                    <div>
                        <h2 class="text-lg font-semibold text-white">Gestión de Pagos</h2>
                        <p class="text-sm text-gray-400">
                            <i class="icon-doc-text-1"></i> Folio: ${order.folio} |
                            <i class="icon-calendar-1"></i> Creado: ${order.formatted_date_order || order.date_order}
                        </p>
                    </div>
                </div>
            `,
            id: 'modalAdvance',
            closeButton: true,
            message: '<div id="containerChat"></div>'
        });

        $('#modalAdvance .modal-dialog').css('max-width', '600px');

        this.tabLayout({
            parent: 'containerChat',
            theme: 'dark',
            class: '',
            json: [
                {
                    id: 'payment',
                    tab: 'Registrar Pago',
                    icon: 'icon-plus-circled',
                    active: true
                },
                {
                    id: 'listPayment',
                    tab: 'Historial de Pagos',
                    icon: 'icon-list',
                    onClick: () => { }
                },
            ]
        });

        $('#container-listPayment').html(`
            <div id="container-info-payment"></div>
            <div id="container-methodPay"></div>
        `);

        this.addPayment(order, id);
        this.renderResumenPagos(data.details);
        this.lsPay(id);
    }

    async addPayment(order, id) {
        this.totalPay = order.total_pay;
        this.totalPaid = order.total_paid;
        this.discount = order.discount ?? 0;

        const saldoOriginal = order.total_pay;
        const discount = order.discount ?? 0;
        const saldoRestante = order.total_pay - discount - order.total_paid;
        const isPaidInFull = saldoRestante <= 0;

        // Sucursal de cobro (cobro cruzado): default = sucursal activa del usuario.
        // Admin -> sucursal de sesión; cajero -> su sucursal de sesión.
        // Fallback final: la sucursal del pedido.
        const defaultCobroSub = this.subsidiaryId
            ? String(this.subsidiaryId)
            : String(order.subsidiaries_id ?? '');

        const subsidiariesCobro = this.subsidiariesCobro || [];

        // Sucursal de origen del pedido (referencia para el cobro cruzado).
        const origenSub    = subsidiariesCobro.find(s => String(s.id) === String(order.subsidiaries_id));
        const origenNombre = origenSub ? origenSub.valor : '—';

        // Estado inicial de la tarjeta "Sucursal que cobrará".
        const origenSubId     = String(order.subsidiaries_id ?? '');
        const cobroSubSel     = subsidiariesCobro.find(s => String(s.id) === String(defaultCobroSub));
        const cobroNombre     = cobroSubSel ? cobroSubSel.valor : origenNombre;
        const cobroEsMismaSuc = String(defaultCobroSub) === origenSubId;
        const cobroSubtitulo  = cobroEsMismaSuc ? 'Misma sucursal de origen' : 'Cobro en otra sucursal';
        const cobroOptionsHtml = subsidiariesCobro
            .map(s => `<option value="${s.id}" ${String(s.id) === String(defaultCobroSub) ? 'selected' : ''}>${s.valor}</option>`)
            .join('');

        $("#container-payment").html(`
            <div class="flex justify-center items-start">
                <div class="w-full">
                    <form id="form-payment" novalidate></form>
                </div>
            </div>
        `);

        this.createForm({
            id: "formRegisterPayment",
            parent: "form-payment",
            data: {
                opc: "addPayment",
                total: order.total_pay,
                saldo: saldoRestante,
                id: id
            },
            json: [
                {
                    opc: "div",
                    id: "Amount",
                    class: "col-12",
                    html: `
                    <div id="dueAmount" class="p-4 rounded-xl ${isPaidInFull ? 'bg-green-900/30 border border-green-500' : 'bg-[#1E293B]'} text-white text-center">
                        <p class="text-sm opacity-80">${isPaidInFull ? 'Pedido pagado completamente' : 'Monto restante a pagar'}</p>
                        <p id="SaldoEvent" class="text-2xl font-bold mt-1">
                            ${formatPrice(saldoRestante)}
                        </p>
                        ${discount > 0 ? `
                            <div class="mt-2 pt-2 border-t border-gray-600">
                                <p class="text-xs text-gray-400">Total original: <span class="line-through">${formatPrice(saldoOriginal)}</span></p>
                                <p class="text-xs text-green-400"><i class="icon-tag"></i> Descuento aplicado: -${formatPrice(discount)}</p>
                            </div>
                        ` : ''}
                        ${isPaidInFull ? '<i class="icon-ok-circled text-green-400 text-2xl mt-2"></i>' : ''}
                    </div>`
                },
                {
                    opc: "input",
                    type: "number",
                    id: "advanced_pay",
                    lbl: "Importe",
                    class: "col-12 mb-3",
                    placeholder: "0.00",
                    required: true,
                    min: 0,
                    onkeyup: "app.updateTotal()",
                    disabled: isPaidInFull
                },
                {
                    opc: "select",
                    id: "method_pay_id",
                    lbl: "Método de pago",
                    class: "col-12 mb-3",
                    data: [
                        { id: "1", valor: "Efectivo" },
                        { id: "2", valor: "Tarjeta" },
                        { id: "3", valor: "Transferencia" }
                    ],
                    required: true,
                    disabled: isPaidInFull
                },
                {
                    opc: "div",
                    id: "origenPedido",
                    lbl: "Origen del pedido",
                    class: "col-12 mb-2",
                    html: `<div class="flex items-center gap-2.5 bg-[#1E293B] border border-slate-700 rounded-lg px-2.5 py-1.5">
                        <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-700/60 text-gray-300 shrink-0">
                            <i class="icon-shop text-sm"></i>
                        </div>
                        <div class="flex flex-col leading-tight min-w-0">
                            <span class="text-sm text-white font-semibold truncate">${origenNombre}</span>
                            <span class="text-[11px] text-gray-400">Sucursal donde se generó la venta</span>
                        </div>
                    </div>`
                },
                {
                    opc: "div",
                    id: "cobroWrapper",
                    lbl: "Sucursal que cobrará",
                    class: "col-12 mb-3",
                    html: `<div class="relative">
                        <div id="cobroCard" class="flex items-center gap-2.5 bg-[#1E293B] border ${cobroEsMismaSuc ? 'border-slate-700' : 'border-amber-500/60'} rounded-lg px-2.5 py-1.5 pointer-events-none">
                            <div id="cobroCardIcon" class="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-700/60 ${cobroEsMismaSuc ? 'text-blue-400' : 'text-amber-400'} shrink-0">
                                <i class="icon-bank text-sm"></i>
                            </div>
                            <div class="flex flex-col leading-tight flex-1 min-w-0">
                                <span id="cobroCardName" class="text-sm text-white font-semibold truncate">${cobroNombre}</span>
                                <span id="cobroCardSub" class="text-[11px] text-gray-400">${cobroSubtitulo}</span>
                            </div>
                            <i class="icon-down-open text-gray-400 text-xs shrink-0"></i>
                        </div>
                        <select id="payment_subsidiaries_id" name="payment_subsidiaries_id" data-origen="${origenSubId}" required
                            class="absolute inset-0 w-full h-full opacity-0 ${isPaidInFull ? 'cursor-not-allowed' : 'cursor-pointer'}"
                            ${isPaidInFull ? 'disabled' : ''} onchange="app.onCobroChange(this)">
                            ${cobroOptionsHtml}
                        </select>
                    </div>`
                },
                {
                    opc: "textarea",
                    id: "description",
                    lbl: "Observación",
                    class: "col-12 mb-3",
                    disabled: isPaidInFull
                },
                {
                    opc: "btn-submit",
                    id: "btnSuccess",
                    class: "col-12",
                    text: isPaidInFull ? "Pedido Pagado" : "Registrar Pago",
                    disabled: isPaidInFull
                }
            ],
            success: async (response) => {
                if (response.status === 200) {
                    const data = response.data;

                    alert({
                        icon: "success",
                        text: "Pago registrado correctamente",
                        timer: 1000
                    });

                    this.lsPay(id);
                    this.refreshOrderDetails(id);
                    this.renderResumenPagos(data.details);

                    const order = data.order;
                    const discount = order.discount ?? 0;
                    const restante2 = order.total_pay - discount - order.total_paid;
                    this.totalPay = order.total_pay;
                    this.totalPaid = order.total_paid;
                    this.discount = discount;

                    if (restante2 <= 0) {
                        this.addPayment(order, id);
                    } else {
                        $("#SaldoEvent").text(formatPrice(restante2));
                        $("#advanced_pay").val("");
                        $("#description").val("");
                        app.updateTotal();
                    }

                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });
                }
            }
        });

        // Confirmación antes de registrar el pago.
        const formEl = document.getElementById('form-payment');
        if (formEl) {
            formEl.addEventListener('submit', async (e) => {
                if (formEl.dataset.payConfirmed === '1') {
                    formEl.dataset.payConfirmed = '';
                    return;
                }
                e.preventDefault();
                e.stopImmediatePropagation();

                const importe = parseFloat($('#advanced_pay').val()) || 0;
                if (importe <= 0) {
                    alert({ icon: 'error', text: 'Ingresa un importe válido para registrar el pago.', btn1: true, btn1Text: 'Ok' });
                    return;
                }

                const metodos = { '1': 'Efectivo', '2': 'Tarjeta', '3': 'Transferencia' };
                const metodoTxt = metodos[String($('#method_pay_id').val())] || '—';
                const subCobroId = String($('#payment_subsidiaries_id').val() || '');
                const subCobroObj = subsidiariesCobro.find(s => String(s.id) === subCobroId);
                const subCobroNombre = subCobroObj ? subCobroObj.valor : origenNombre;
                const esCruzado = subCobroId !== '' && String(order.subsidiaries_id ?? '') !== subCobroId;

                const row = (lbl, val, color = '#fff') => `
                    <div style="display:flex;justify-content:space-between;gap:16px;padding:3px 0;">
                        <span style="color:#9ca3af;">${lbl}</span><b style="color:${color};">${val}</b>
                    </div>`;

                const htmlConfirm = `
                    <div style="text-align:left;font-size:14px;line-height:1.5;">
                        ${row('Importe', formatPrice(importe))}
                        ${row('Método de pago', metodoTxt)}
                        ${row('Sucursal que cobra', subCobroNombre, '#A78BFA')}
                        ${esCruzado ? `
                        <div style="margin-top:10px;padding:8px 10px;border-radius:8px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);color:#fcd34d;font-size:12.5px;line-height:1.45;">
                            Cobro cruzado: el pedido es de <b>${origenNombre}</b>, pero el cobro se registrará en <b>${subCobroNombre}</b>.
                        </div>` : ''}
                    </div>`;

                const res = await Swal.fire({
                    icon: 'question',
                    title: '¿Registrar pago?',
                    html: htmlConfirm,
                    confirmButtonText: 'Sí, registrar',
                    cancelButtonText: 'Cancelar',
                    showCancelButton: true,
                    background: '#1F2A37',
                    color: '#fff',
                    customClass: {
                        popup: 'rounded-lg shadow-lg',
                        title: 'text-white',
                        confirmButton: 'bg-[#7C3AED] hover:bg-[#6D28D9] text-white py-2 px-4 rounded',
                        cancelButton: 'bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded'
                    }
                });

                if (res && res.isConfirmed) {
                    formEl.dataset.payConfirmed = '1';
                    formEl.requestSubmit();
                }
            }, true);
        }

        if (isPaidInFull) {
            setTimeout(() => {
                $("#advanced_pay, #method_pay_id, #description, #btnSuccess").prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
            }, 100);
        }
    }

    onCobroChange(sel) {
        const $sel   = $(sel);
        const id     = String($sel.val() || '');
        const nombre = $sel.find('option:selected').text().trim();
        const origen = String($sel.data('origen') || '');
        const same   = id === origen;

        $('#cobroCardName').text(nombre);
        $('#cobroCardSub').text(same ? 'Misma sucursal de origen' : 'Cobro en otra sucursal');
        $('#cobroCard')
            .toggleClass('border-slate-700', same)
            .toggleClass('border-amber-500/60', !same);
        $('#cobroCardIcon')
            .toggleClass('text-blue-400', same)
            .toggleClass('text-amber-400', !same);
    }

    deletePay(id, idFolio) {
        const row = event.target.closest("tr");
        const raw = row.cells[2].textContent;
        const clean = raw.replace(/[^\d.-]/g, "");
        const amount = parseFloat(clean);

        this._switchToPedidos();
        this.swalQuestion({
            opts: {
                title: "¿Confirmar eliminación?",
                text: `Se eliminará el pago de ${formatPrice(amount)} de forma permanente.`,
                icon: "warning"
            },
            data: { opc: "deletePay", id: idFolio, amount: amount, idPay: id },
            methods: {
                success: (res) => {
                    const data = res.initHistoryPay;

                    if (res.status === 200) {
                        this.renderResumenPagos(data.details);
                        this.lsPay(idFolio);

                        const order = data.order;
                        this.totalPay = order.total_pay;
                        this.totalPaid = order.total_paid;
                        this.addPayment(order, idFolio);

                        // Refrescar detalles del pedido en el modal
                        this.refreshOrderDetails(idFolio);

                        alert({
                            icon: "success",
                            text: "Pago eliminado correctamente. Saldo actualizado.",
                            timer: 2000
                        });
                    } else {
                        this._restoreLink();
                        alert({ icon: "error", text: res.message });
                    }
                }
            }
        });
    }

    async lsPay(id) {
        this._switchToPedidos();
        const response = await useFetch({
            url: this._pedidosLink,
            data: { opc: 'listPayment', id: id }
        });

        if (!response.row || response.row.length === 0) {
            $("#container-methodPay").html(`
                <div class="flex flex-col items-center justify-center py-12 text-center">
                    <div class="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mb-4">
                        <i class="icon-money text-gray-400 text-3xl"></i>
                    </div>
                    <p class="text-gray-400 text-lg font-semibold mb-2">Aún no se ha realizado ningún abono</p>
                    <p class="text-gray-500 text-sm">Los pagos registrados aparecerán aquí</p>
                </div>
            `);
            return;
        }

        this.createTable({
            parent: "container-methodPay",
            idFilterBar: "filterBarEventos",
            data: { opc: 'listPayment', id: id },
            conf: { datatable: false, pag: 8 },
            coffeesoft: true,
            attr: {
                id: "tableOrder",
                theme: 'dark',
                center: [1, , 3, 6, 7],
                right: [4],
                f_size: 11,
                extends: true,
            },
        });
    }

    renderResumenPagos(totales) {
        const totalPagado = totales?.pagado ?? 0;
        const discount = totales?.discount ?? 0;
        const totalEvento = totales?.total ?? 0;

        const totalConDescuento = totalEvento - discount;
        const restante = totalConDescuento - totalPagado;

        const fmt = (n) => n.toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 2
        });

        let originalHTML = `<p class="text-lg font-bold text-blue-900" id="totalEvento">${formatPrice(totalEvento)}</p>`;

        if (discount > 0) {
            originalHTML = `
            <p class="text-lg font-bold text-blue-900" id="totalEvento">${fmt(totalConDescuento)}</p>
            <p class="text-sm text-gray-400 line-through -mt-1">${fmt(totalEvento)}</p>
            <p class="text-sm text-blue-700 mt-1">
                <i class="icon-tag"></i> Descuento:
                <span class="font-semibold">${fmt(discount)}</span>
            </p>
        `;
        }

        $('#container-info-payment').html(`
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div class="bg-green-100 p-4 rounded-lg text-center shadow">
                <p class="text-sm text-green-700">Total Pagado</p>
                <p class="text-lg font-bold text-green-900" id="totalPagado">${fmt(totalPagado)}</p>
            </div>
            <div class="bg-blue-100 p-4 rounded-lg text-center shadow">
                <p class="text-sm text-blue-700">Total</p>
                ${originalHTML}
            </div>
            <div class="bg-red-100 p-4 rounded-lg text-center shadow">
                <p class="text-sm text-red-700">Restante</p>
                <p class="text-lg font-bold text-red-900" id="totalRestante">${fmt(restante)}</p>
            </div>
        </div>
    `);
    }

    updateTotal(total, totalPaid) {
        const val = parseFloat($("#advanced_pay").val()) || 0;
        const t = typeof total === 'number' ? total : (this.totalPay || 0);
        const tp = typeof totalPaid === 'number' ? totalPaid : (this.totalPaid || 0);
        const d = this.discount || 0;
        const restante = (t - d - (tp || 0)) - val;
        const btn = $("#btnSuccess");
        const display = $("#SaldoEvent");
        if (display && display.length) {
            display.text(formatPrice(restante < 0 ? 0 : restante));
        }
        if (restante < 0) {
            btn.prop("disabled", true).addClass("opacity-50 cursor-not-allowed");
        } else {
            btn.prop("disabled", false).removeClass("opacity-50 cursor-not-allowed");
        }
    }

    previewImage(imageUrl, imageName = 'Imagen') {
        const modal = $(`
            <div id="imagePreviewModal" class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80" onclick="if(event.target === this) $(this).remove()">
                <div class="relative max-w-4xl max-h-[90vh] p-2">
                    <button onclick="$('#imagePreviewModal').remove()"
                            class="absolute -top-2 -right-2 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xl font-bold z-10 shadow-lg">
                        ×
                    </button>
                    <img src="${imageUrl}" alt="${imageName}"
                         class="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain">
                    <p class="text-white text-center mt-3 text-sm">${imageName}</p>
                </div>
            </div>
        `);

        $('body').append(modal);

        $(document).on('keydown.imagePreview', function (e) {
            if (e.key === 'Escape') {
                $('#imagePreviewModal').remove();
                $(document).off('keydown.imagePreview');
            }
        });
    }



}
