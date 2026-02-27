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
    }

    async init() {
        const data = await useFetch({ url: this._link, data: { opc: 'init' } });
        this.subsidiaries = data.subsidiaries;
        this.isAdmin = data.isAdmin;
        this.render();
    }

    render() {
        this.layout();
        this.createCalendar();
    }

    layout() {
        this.primaryLayout({
            parent: this._div_modulo,
            id: this.PROJECT_NAME,
            class: 'd-flex mx-2 my-2 h-100 mt-5 p-2',
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

                    ${this.isAdmin ? `
                    <div class="flex flex-col gap-1 bg-purple-500/10 px-3 py-2 rounded-md shadow-sm w-fit">
                        <label for="subsidiaryFilter" class="text-xs font-medium text-purple-700">Sucursal:</label>
                        <select id="subsidiaryFilter" class="text-xs border border-purple-300 rounded-md px-2 py-1 focus:ring-1 focus:ring-purple-400 focus:border-purple-400" style="min-width: 180px;">
                            <option value="0">Todas las sucursales</option>
                        </select>
                    </div>
                    ` : ''}

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
        if (!this.isAdmin) return;

        const $select = $('#subsidiaryFilter');
        
        this.subsidiaries.forEach(sub => {
            $select.append(`<option value="${sub.id}">${sub.valor}</option>`);
        });

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

        const subsidiaryId = this.isAdmin ? ($('#subsidiaryFilter').val() || 0) : 0;

        let data = await useFetch({
            url: this._link,
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

    // Order.
    // const response = await useFetch({
    //     url: '../ctrl/ctrl-pedidos.php',
    //     data: { opc: 'getOrderDetails', id: orderId }
    // });
  
    async showOrder(orderId) {
        const response = await useFetch({
            url: '../ctrl/ctrl-pedidos.php',
            data: { opc: 'getOrderDetails', id: orderId }
        });

        console.log(response);

        const tipo = response.data.order.delivery_type;
        const badgeTipo = this.getBadgeDeliveryType(tipo);

        const modal = bootbox.dialog({
            title: `
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                        <i class="icon-birthday text-white text-sm"></i>
                    </div>
                    <div>
                        <h2 class="text-lg font-semibold text-white">Detalles del Pedido</h2>
                        ${badgeTipo}
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

            const container = $('#orderDetailsContainer');
            container.html(`
                <div id="orderInfoPanel" class="w-full lg:w-1/3 mb-6 lg:mb-0 lg:pr-3">
                    <div class="lg:sticky lg:top-4">
                        ${this.detailsCard(orderData)}
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
            return '<span class="px-3 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700 inline-block w-24 text-center"><i class="icon-home"></i> Local</span>';
        } else if (tipo == 1 || tipo === '1') {
            return '<span class="px-3 py-1 rounded text-xs font-semibold bg-amber-100 text-amber-700 inline-block w-28 text-center"><i class="icon-motorcycle"></i> Domicilio</span>';
        }
        return '<span class="px-3 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-700 inline-block w-24 text-center">Sin especificar</span>';
    }

    detailsCard(orderData) {
        return `
            <div class="space-y-3">
                ${this.infoOrder(orderData)}
                ${this.infoSales(orderData)}
            </div>
        `;
    }

    infoOrder(orderData) {
        return `
            <div class="bg-[#2C3E50] rounded-lg p-3">
                <h3 class="text-white font-semibold text-base mb-2 flex items-center">
                    <i class="icon-info text-blue-400 mr-2 text-sm"></i>
                    Información del Pedido
                </h3>

                <div class="space-y-1.5">
                    <div class="flex items-start">
                        <i class="icon-doc-text-1 text-gray-400 text-base mr-3 mt-0.5"></i>
                        <div>
                            <p class="text-gray-400 text-xs mb-0.5">Folio:</p>
                            <p class="text-white font-semibold text-sm">${orderData.folio || 'N/A'}</p>
                        </div>
                    </div>

                    <div class="flex items-start">
                        <i class="icon-user text-gray-400 text-base mr-3 mt-0.5"></i>
                        <div>
                            <p class="text-gray-400 text-xs mb-0.5">Cliente:</p>
                            <p class="text-white font-semibold text-sm">${orderData.name || 'N/A'}</p>
                        </div>
                    </div>

                    <div class="flex items-start">
                        <i class="icon-calendar text-gray-400 text-base mr-3 mt-0.5"></i>
                        <div>
                            <p class="text-gray-400 text-xs mb-0.5">Fecha de entrega:</p>
                            <p class="text-white font-semibold text-sm">${orderData.formatted_date_order || orderData.date_order || 'N/A'}</p>
                        </div>
                    </div>

                    <div class="flex items-start">
                        <i class="icon-clock text-gray-400 text-base mr-3 mt-0.5"></i>
                        <div>
                            <p class="text-gray-400 text-xs mb-0.5">Hora:</p>
                            <p class="text-white font-semibold text-sm">${orderData.time_order || 'N/A'}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    infoSales(orderData) {
        const totalPay = parseFloat(orderData.total_pay || 0);
        const totalPaid = parseFloat(orderData.total_paid || 0);
        const balance = parseFloat(orderData.balance || 0);

        return `
            <div class="bg-[#2C3E50] rounded-lg p-3">
                <h3 class="text-white font-semibold text-base mb-2 flex items-center">
                    <i class="icon-dollar text-green-400 mr-2 text-sm"></i>
                    Resumen de pago
                </h3>

                <div class="space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="text-gray-400 text-sm">Total:</span>
                        <span class="text-white font-bold text-sm">$${totalPay.toFixed(2)}</span>
                    </div>

                    <div class="flex items-center justify-between">
                        <span class="text-gray-400 text-sm">Pagado:</span>
                        <span class="text-green-400 font-bold text-sm">$${totalPaid.toFixed(2)}</span>
                    </div>

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
                    <i class="icon-basket text-gray-500 text-5xl mb-4"></i>
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
                            <i class="icon-basket mr-2 text-blue-400"></i>
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
                    <div class="w-24 h-24 rounded-lg overflow-hidden bg-[#D8B4E2] flex-shrink-0">
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

            <div class="absolute top-5 right-6 text-right">
                <span class="text-gray-400 text-sm">Cantidad: <span class="text-white font-bold text-sm">${product.quantity || 1}</span></span>
            </div>

            ${hasImages ? `
            <div class="flex gap-3 pb-4 border-b border-gray-700">
                ${product.images.slice(0, 3).map(img => {
            const thumbUrl = img.path.startsWith('http') ? img.path : `${img.path}`;
            return `
                        <div class="w-24 h-24 rounded-lg overflow-hidden bg-gray-700">
                            <img src="https://huubie.com.mx/${thumbUrl}"
                                 alt="${img.original_name || 'Imagen'}"
                                 class="object-cover w-full h-full">
                        </div>
                    `;
        }).join('')}
            </div>
            ` : ''}

            <div class="mb-3"> 
                <span class="text-gray-400 text-sm">Porción: <span class="text-white font-bold text-sm">${product.portion_qty || 1}</span></span>
            </div>

            ${(hasDedication || hasDetails) ? `
            <div class="flex gap-12 mb-6 pr-32 pt-4">
                ${hasDedication ? `
                <div class="flex-1">
                    <span class="text-gray-400 text-sm font-medium">Dedicatoria:</span>
                    <p class="text-white text-base">${product.dedication}</p>
                </div>
                ` : ''}
                ${hasDetails ? `
                <div class="flex-1">
                    <span class="text-gray-400 text-sm font-medium">Observaciones:</span>
                    <p class="text-white text-base">${product.order_details}</p>
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
                    <i class="icon-image text-gray-500 text-2xl"></i>
                </div>
            `;
        } else {
            return `
                <div class="w-full h-full flex items-center justify-center">
                    <i class="icon-image text-gray-500 text-2xl"></i>
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
                <div class="space-y-1">
                    ${leftColumn.map(([category, items]) => `
                        ${items.map(item => `
                            <div class="flex justify-between items-center gap-3">
                                <span class="text-purple-300 font-bold text-sm  tracking-wide">${category}</span>
                                <span class="text-white font-medium text-xs text-left flex-1">${item.name || 'N/A'}</span>
                            </div>
                        `).join('')}
                    `).join('')}
                </div>

                <div class="space-y-3">
                    ${rightColumn.map(([category, items]) => `
                    ${items.map(item => `
                        <div class="flex justify-between items-center gap-3">
                            <span class="text-purple-300 font-bold text-sm  tracking-wide">${category}</span>
                            <span class="text-white font-medium text-xs text-left flex-1">${item.name || 'N/A'}</span>
                        </div>
                    `).join('')}
                    `).join('')}
                </div>
            </div>
        `;
    }


}
