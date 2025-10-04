// Componente Modal para Detalles de Pedido
// Ubicación: C:\wamp64\www\dev\src\components\orderDetailsModal.js

orderDetailsModal(options) {
    const defaults = {
        parent: "root",
        id: "orderDetailsModal",
        orderId: null,
        onClose: () => { },
        data: {
            order: {},
            details: [],
            payments: []
        }
    };

    const opts = Object.assign({}, defaults, options);

    // Crear el modal usando bootbox
    const modalContent = $("<div>", {
        id: opts.id,
        class: "order-details-modal"
    });

    // Header del modal con título y botón cerrar
    const modalHeader = $(`
        <div class="flex items-center justify-between p-4 border-b border-gray-700 bg-[#1F2A37]">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                    <i class="icon-doc text-white text-sm"></i>
                </div>
                <h2 class="text-lg font-semibold text-white">Pedido</h2>
            </div>
            <div class="text-gray-400 text-sm">
                ${new Date().toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })}
            </div>
        </div>
    `);

    // Sistema de tabs
    const tabsContainer = $(`
        <div class="bg-[#1F2A37] px-4">
            <div class="flex gap-1">
                <button id="tab-details" class="tab-button active px-4 py-2 rounded-t-lg bg-blue-600 text-white font-medium">
                    Detalles del pedido
                </button>
                <button id="tab-order" class="tab-button px-4 py-2 rounded-t-lg bg-gray-700 text-gray-300 hover:bg-gray-600">
                    Pedido
                </button>
            </div>
        </div>
    `);

    // Contenido de las tabs
    const tabContent = $(`
        <div class="bg-[#283341] min-h-[500px]">
            <!-- Tab Detalles del Pedido -->
            <div id="content-details" class="tab-content active p-6">
                <div class="space-y-6">
                    <!-- Información básica del pedido -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="space-y-4">
                            <div class="flex items-center gap-3">
                                <i class="icon-doc text-gray-400"></i>
                                <div>
                                    <p class="text-gray-400 text-sm">Folio:</p>
                                    <p class="text-white font-semibold" id="order-folio">${opts.data.order.folio || 'P-0028'}</p>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-3">
                                <i class="icon-user text-gray-400"></i>
                                <div>
                                    <p class="text-gray-400 text-sm">Nombre:</p>
                                    <p class="text-white font-semibold" id="order-client">${opts.data.order.name_client || 'Anita'}</p>
                                </div>
                            </div>
                        </div>
                        
                        <div class="space-y-4">
                            <div class="flex items-center gap-3">
                                <i class="icon-calendar text-gray-400"></i>
                                <div>
                                    <p class="text-gray-400 text-sm">Fecha del pedido:</p>
                                    <p class="text-white font-semibold" id="order-date">${opts.data.order.date_order || '15/09/2025'}</p>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-3">
                                <i class="icon-clock text-gray-400"></i>
                                <div>
                                    <p class="text-gray-400 text-sm">Hora de entrega:</p>
                                    <p class="text-white font-semibold" id="order-time">${opts.data.order.time_order || '10:00 AM'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Observaciones -->
                    <div class="bg-[#1F2A37] rounded-lg p-4">
                        <p class="text-gray-400 text-sm mb-2">Observación:</p>
                        <p class="text-gray-300" id="order-notes">${opts.data.order.note || 'Sin observaciones'}</p>
                    </div>
                    
                    <!-- Resumen financiero -->
                    <div class="bg-[#1F2A37] rounded-lg p-4">
                        <h3 class="text-white font-semibold mb-4">Resumen Financiero</h3>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div class="text-center">
                                <p class="text-gray-400 text-sm">Total</p>
                                <p class="text-white font-bold text-lg" id="order-total">$${opts.data.order.total_pay || '0.00'}</p>
                            </div>
                            <div class="text-center">
                                <p class="text-gray-400 text-sm">Pagado</p>
                                <p class="text-green-400 font-bold text-lg" id="order-paid">$${opts.data.order.total_paid || '0.00'}</p>
                            </div>
                            <div class="text-center">
                                <p class="text-gray-400 text-sm">Descuento</p>
                                <p class="text-yellow-400 font-bold text-lg" id="order-discount">$${opts.data.order.discount || '0.00'}</p>
                            </div>
                            <div class="text-center">
                                <p class="text-gray-400 text-sm">Saldo</p>
                                <p class="text-red-400 font-bold text-lg" id="order-balance">$${(opts.data.order.total_pay || 0) - (opts.data.order.total_paid || 0)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Tab Pedido -->
            <div id="content-order" class="tab-content hidden p-6">
                <div class="space-y-6">
                    <!-- Tipo de pedido -->
                    <div class="bg-[#1F2A37] rounded-lg p-4">
                        <h3 class="text-white font-semibold mb-4">Tipo de Pedido</h3>
                        <div id="order-type-container">
                            <!-- Se llenará dinámicamente -->
                        </div>
                    </div>
                    
                    <!-- Detalles de productos -->
                    <div class="bg-[#1F2A37] rounded-lg p-4">
                        <h3 class="text-white font-semibold mb-4">Productos del Pedido</h3>
                        <div id="order-products-container" class="space-y-3">
                            <!-- Se llenará dinámicamente -->
                        </div>
                    </div>
                    
                    <!-- Historial de pagos -->
                    <div class="bg-[#1F2A37] rounded-lg p-4">
                        <h3 class="text-white font-semibold mb-4">Historial de Pagos</h3>
                        <div id="order-payments-container">
                            <!-- Se llenará dinámicamente -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `);

    // Ensamblar el modal
    modalContent.append(modalHeader, tabsContainer, tabContent);

    // Crear el modal con bootbox
    const modal = bootbox.dialog({
        message: modalContent,
        size: 'xl',
        closeButton: false,
        className: 'order-details-modal-dialog',
        onEscape: true
    });

    // Agregar estilos CSS
    $("<style>").text(`
        .order-details-modal-dialog .modal-dialog {
            max-width: 90vw !important;
            width: 1200px !important;
        }
        
        .order-details-modal-dialog .modal-content {
            background: #283341 !important;
            border: none !important;
            border-radius: 12px !important;
        }
        
        .order-details-modal-dialog .modal-body {
            padding: 0 !important;
        }
        
        .tab-button.active {
            background-color: #2563eb !important;
            color: white !important;
        }
        
        .tab-content {
            display: none;
        }
        
        .tab-content.active {
            display: block;
        }
        
        .order-details-modal {
            border-radius: 12px;
            overflow: hidden;
        }
    `).appendTo("head");

    // Funcionalidad de tabs
    $('.tab-button').on('click', function () {
        const tabId = $(this).attr('id');
        const contentId = tabId.replace('tab-', 'content-');

        // Remover clase active de todos los tabs
        $('.tab-button').removeClass('active').addClass('bg-gray-700 text-gray-300').removeClass('bg-blue-600 text-white');
        $('.tab-content').removeClass('active').addClass('hidden');

        // Activar tab seleccionado
        $(this).addClass('active bg-blue-600 text-white').removeClass('bg-gray-700 text-gray-300');
        $(`#${contentId}`).addClass('active').removeClass('hidden');
    });

    // Botón cerrar personalizado
    modalHeader.find('.text-gray-400').after(`
        <button class="text-gray-400 hover:text-white transition-colors" onclick="$('.bootbox-close-button').click()">
            <i class="icon-cancel text-xl"></i>
        </button>
    `);

    // Cargar datos del pedido si se proporciona orderId
    if (opts.orderId) {
        loadOrderDetails(opts.orderId);
    }

    // Función para cargar detalles del pedido
    function loadOrderDetails(orderId) {
        // Aquí harías la llamada AJAX para obtener los detalles
        useFetch({
            url: 'ctrl/ctrl-pedidos.php',
            data: { opc: 'getOrder', id: orderId },
            success: (response) => {
                if (response.status === 200) {
                    updateModalContent(response.data);
                }
            }
        });
    }

    // Función para actualizar el contenido del modal
    function updateModalContent(orderData) {
        // Actualizar información básica
        $('#order-folio').text(orderData.folio || 'N/A');
        $('#order-client').text(orderData.name_client || 'N/A');
        $('#order-date').text(orderData.date_order || 'N/A');
        $('#order-time').text(orderData.time_order || 'N/A');
        $('#order-notes').text(orderData.note || 'Sin observaciones');

        // Actualizar resumen financiero
        $('#order-total').text(`$${parseFloat(orderData.total_pay || 0).toFixed(2)}`);
        $('#order-paid').text(`$${parseFloat(orderData.total_paid || 0).toFixed(2)}`);
        $('#order-discount').text(`$${parseFloat(orderData.discount || 0).toFixed(2)}`);

        const balance = (parseFloat(orderData.total_pay || 0) - parseFloat(orderData.total_paid || 0));
        $('#order-balance').text(`$${balance.toFixed(2)}`);

        // Determinar tipo de pedido
        const orderTypeHtml = determineOrderType(orderData);
        $('#order-type-container').html(orderTypeHtml);

        // Cargar productos del pedido
        loadOrderProducts(orderData.id);

        // Cargar historial de pagos
        loadOrderPayments(orderData.id);
    }

    // Función para determinar el tipo de pedido
    function determineOrderType(orderData) {
        const isCustom = orderData.type_id === 2; // Asumiendo que 2 es personalizado

        if (isCustom) {
            return `
                <div class="flex items-center gap-3 p-3 bg-purple-900/30 border border-purple-500 rounded-lg">
                    <i class="icon-magic text-purple-400 text-xl"></i>
                    <div>
                        <p class="text-purple-400 font-semibold">Pedido Personalizado</p>
                        <p class="text-gray-300 text-sm">Este pedido incluye productos personalizados según especificaciones del cliente</p>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="flex items-center gap-3 p-3 bg-blue-900/30 border border-blue-500 rounded-lg">
                    <i class="icon-list text-blue-400 text-xl"></i>
                    <div>
                        <p class="text-blue-400 font-semibold">Pedido Normal</p>
                        <p class="text-gray-300 text-sm">Pedido estándar con productos del catálogo</p>
                    </div>
                </div>
            `;
        }
    }

    // Función para cargar productos del pedido
    function loadOrderProducts(orderId) {
        // Aquí harías la llamada para obtener los productos del pedido
        // Por ahora, mostrar un placeholder
        $('#order-products-container').html(`
            <div class="text-center py-8 text-gray-400">
                <i class="icon-box text-3xl mb-2"></i>
                <p>Cargando productos del pedido...</p>
            </div>
        `);
    }

    // Función para cargar historial de pagos
    function loadOrderPayments(orderId) {
        useFetch({
            url: 'ctrl/ctrl-pedidos.php',
            data: { opc: 'listPayment', id: orderId },
            success: (response) => {
                if (response.row && response.row.length > 0) {
                    let paymentsHtml = '';
                    response.row.forEach(payment => {
                        paymentsHtml += `
                            <div class="flex items-center justify-between p-3 bg-[#283341] rounded-lg border border-gray-600">
                                <div class="flex items-center gap-3">
                                    ${payment.Método.html}
                                    <div>
                                        ${payment['Fecha de Pago'].html}
                                    </div>
                                </div>
                                <div class="text-green-400 font-semibold">
                                    ${payment.Monto.html}
                                </div>
                            </div>
                        `;
                    });
                    $('#order-payments-container').html(paymentsHtml);
                } else {
                    $('#order-payments-container').html(`
                        <div class="text-center py-8 text-gray-400">
                            <i class="icon-credit-card text-3xl mb-2"></i>
                            <p>No hay pagos registrados</p>
                        </div>
                    `);
                }
            }
        });
    }

    return modal;
}