let url = '../ctrl/ctrl-admin.php';
let api = 'http://www.coffeehuubie.com/dev/pedidos/ctrl/ctrl-pedidos.php';
let app;
$(async () => {
    app = new App(api, 'root');
    orders = app;
    app.init();
    app.navBar({ theme: 'dark' });
    

});

class App extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "Orders";
    }

    init() {
        this.render();
    }

    render() {
        this.layout();
        this.showOrderDetails(30)
    }

    layout() {
        this.primaryLayout({
            parent: `root`,
            class: 'pt-14  p-3',
            id: this.PROJECT_NAME,
        });
    }


    async showOrderDetails(orderId) {
        const response = await useFetch({
            url: this._link,
            data: { opc: 'getOrderDetails', id: orderId }
        });

        const modal = bootbox.dialog({
            title: `
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                        <i class="icon-birthday text-white text-sm"></i>
                    </div>
                    <div>
                        <h2 class="text-lg font-semibold text-white">Detalles del Pedido</h2>
                    </div>
                </div>
            `,
            message: '<div id="orderDetailsContainer" class="min-h-[500px] max-h-[80vh] overflow-hidden"></div>',
            size: 'xl',
            closeButton: true,
            className: 'order-details-enhanced-modal'
        });

        // Initialize layout manager
        this.layoutManager = {
            isMobile: () => window.innerWidth < 768,
            isTablet: () => window.innerWidth >= 768 && window.innerWidth < 1024,
            isDesktop: () => window.innerWidth >= 1024,

            applyLayout: function () {
                const container = $('#orderDetailsContainer');
                container.removeClass('flex flex-col flex-row space-y-4 gap-4 gap-6 p-4 p-6');

                if (this.isMobile()) {
                    container.addClass('flex flex-col space-y-4 p-4');
                } else if (this.isTablet()) {
                    container.addClass('flex flex-col lg:flex-row gap-4 p-4');
                } else {
                    container.addClass('flex flex-row gap-6 p-6');
                }
            }
        };

        // Apply initial layout
        setTimeout(() => {
            this.layoutManager.applyLayout();
            this.renderEnhancedOrderDetails(response.data);

            // Add resize listener for responsive behavior
            $(window).on('resize.orderDetails', () => {
                this.layoutManager.applyLayout();
            });
        }, 100);

        // Cleanup resize listener when modal is closed
        modal.on('hidden.bs.modal', () => {
            $(window).off('resize.orderDetails');
        });

        $("<style>").text(`
            :root {
                --card-normal-bg: #283341;
                --card-personalized-bg: linear-gradient(135deg, rgba(147, 51, 234, 0.1), rgba(219, 39, 119, 0.1));
                --card-border-normal: #4B5563;
                --card-border-personalized: rgba(147, 51, 234, 0.3);
                --text-primary: #FFFFFF;
                --text-secondary: #9CA3AF;
                --accent-purple: #8B5CF6;
                --accent-blue: #60A5FA;
            }
            
            .order-details-enhanced-modal .modal-dialog {
                max-width: 1200px !important;
                width: 95vw !important;
            }
            .order-details-enhanced-modal .modal-body {
                padding: 0 !important;
            }
            
            @media (max-width: 768px) {
                .order-details-enhanced-modal .modal-dialog {
                    width: 98vw !important;
                    margin: 10px auto !important;
                }
            }
        `).appendTo("head");

        return modal;
    }

    renderEnhancedOrderDetails(data) {
        const orderData = data.order || {};
        const products = data.products || [];

        // Create main layout structure
        const orderInfoPanel = this.createOrderInfoPanel(orderData);
        const productDisplayArea = this.createProductDisplayArea(products);

        const container = $('#orderDetailsContainer');
        container.html(`
            <!-- Order Information Panel -->
            <div id="orderInfoPanel" class="w-full lg:w-1/3 mb-6 lg:mb-0 lg:pr-3">
                <div class="lg:sticky lg:top-4">
                    ${orderInfoPanel}
                </div>
            </div>
            
            <!-- Product Display Area -->
            <div id="productDisplayArea" class="w-full lg:w-2/3 lg:pl-3">
                ${productDisplayArea}
            </div>
        `);
    }

    createOrderInfoPanel(orderData) {
        return `
            <div class="space-y-4">
                ${this.renderOrderInfoCard(orderData)}
                ${this.renderFinancialSummary(orderData)}
            </div>
        `;
    }

    renderOrderInfoCard(orderData) {
        return `
            <div class="bg-[#2C3E50] rounded-lg p-6">
                <h3 class="text-white font-semibold text-lg mb-6 flex items-center">
                    <i class="icon-info text-blue-400 mr-3"></i>
                    Informaci del Pedido
                </h3>
                
                <div class="space-y-5">
                    <!-- Folio -->
                    <div class="flex items-start">
                        <i class="icon-doc-text-1 text-gray-400 text-xl mr-4 mt-1"></i>
                        <div>
                            <p class="text-gray-400 text-sm mb-1">Folio:</p>
                            <p class="text-white font-semibold text-lg">${orderData.folio || 'N/A'}</p>
                        </div>
                    </div>
                    
                    <!-- Cliente -->
                    <div class="flex items-start">
                        <i class="icon-user text-gray-400 text-xl mr-4 mt-1"></i>
                        <div>
                            <p class="text-gray-400 text-sm mb-1">Cliente:</p>
                            <p class="text-white font-semibold">${orderData.name || 'N/A'}</p>
                        </div>
                    </div>
                    
                    <!-- Fecha de entrega -->
                    <div class="flex items-start">
                        <i class="icon-calendar text-gray-400 text-xl mr-4 mt-1"></i>
                        <div>
                            <p class="text-gray-400 text-sm mb-1">Fecha de entrega:</p>
                            <p class="text-white font-semibold">${orderData.formatted_date_order || orderData.date_order || 'N/A'}</p>
                        </div>
                    </div>
                    
                    <!-- Hora -->
                    <div class="flex items-start">
                        <i class="icon-clock text-gray-400 text-xl mr-4 mt-1"></i>
                        <div>
                            <p class="text-gray-400 text-sm mb-1">Hora:</p>
                            <p class="text-white font-semibold">${orderData.time_order || 'N/A'}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderFinancialSummary(orderData) {
        const totalPay = parseFloat(orderData.total_pay || 0);
        const totalPaid = parseFloat(orderData.total_paid || 0);
        const balance = parseFloat(orderData.balance || 0);

        return `
            <div class="bg-[#2C3E50] rounded-lg p-6">
                <h3 class="text-white font-semibold text-lg mb-6 flex items-center">
                    <i class="icon-dollar-sign text-green-400 mr-3"></i>
                    Resumen Financiero
                </h3>
                
                <div class="space-y-4">
                    <!-- Total -->
                    <div class="flex items-center justify-between">
                        <span class="text-gray-400">Total:</span>
                        <span class="text-white font-bold text-2xl">$${totalPay.toFixed(2)}</span>
                    </div>
                    
                    <!-- Pagado -->
                    <div class="flex items-center justify-between">
                        <span class="text-gray-400">Pagado:</span>
                        <span class="text-green-400 font-bold text-2xl">$${totalPaid.toFixed(2)}</span>
                    </div>
                    
                    <!-- Divider -->
                    <div class="border-t border-gray-600"></div>
                    
                    <!-- Saldo -->
                    <div class="flex items-center justify-between">
                        <span class="text-gray-400">Saldo:</span>
                        <span class="text-red-400 font-bold text-2xl">$${balance.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    createProductDisplayArea(products) {
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
                <div class="bg-[#283341] rounded-lg p-3 mb-4">
                    <div class="flex items-center justify-between">
                        <h3 class="text-white font-semibold text-lg flex items-center">
                            <i class="icon-basket mr-2 text-blue-400"></i>
                            Productos del Pedido
                        </h3>
                        <span class="text-gray-300 font-medium">Total: ${totalItems} productos</span>
                    </div>
                </div>
                <div id="productsContainer" class="space-y-4 overflow-y-auto flex-1">
                    ${products.map(product => this.createProductCard(product)).join('')}
                </div>
            </div>
        `;
    }

    createProductCard(product) {
        if (product.is_custom || (product.customer_products && product.customer_products.length > 0)) {
            return this.createPersonalizedCard(product);
        } else {
            return this.createNormalCard(product);
        }
    }

    createNormalCard(product) {
        const total = parseFloat(product.price || 0) * parseInt(product.quantity || 1);
        const hasDedication = product.dedication && product.dedication.trim() !== '';
        const hasDetails = product.order_details && product.order_details.trim() !== '';

        return `
            <div class="bg-[#2C3E50] rounded-lg p-3 relative">
                <!-- Cantidad en top-right -->
                <div class="absolute top-5 right-6 text-right">
                    <span class="text-gray-400 text-sm">Cantidad: <span class="text-white font-bold text-sm">${product.quantity || 1}</span></span>
                </div>

                <div class="flex items-start gap-6 pr-32">
                    <!-- Image -->
                    <div class="w-32 h-32 rounded-2xl overflow-hidden bg-[#D8B4E2] flex-shrink-0">
                        ${this.renderProductImage(product)}
                    </div>

                    <!-- Name and Price -->
                    <div class="flex-1">
                        <h4 class="text-white font-bold text-lg mb-2 uppercase">${product.name || 'Producto sin nombre'}</h4>
                        <p class="text-blue-400 font-semibold text-sm mb-4">$${parseFloat(product.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} c/u</p>
                        
                        <!-- Dedication and Observations in same row (only if they exist) -->
                        ${(hasDedication || hasDetails) ? `
                        <div class="flex gap-12">
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
                    </div>
                </div>

                <!-- Total at bottom-right -->
                <div class="absolute bottom-5 right-6 text-right">
                    <span class="text-gray-400 text-sm block mb-1">Total:</span>
                    <p class="text-white font-bold text-lg">$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
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
    createPersonalizedCard(product) {
        const total            = parseFloat(product.price || 0) * parseInt(product.quantity || 1);
        const hasDedication    = product.dedication && product.dedication.trim()       !== '';
        const hasDetails       = product.order_details && product.order_details.trim() !== '';
        const hasImages        = product.images && Array.isArray(product.images) && product.images.length > 0;
        const hasCustomization = product.customer_products && product.customer_products.length > 0;

        // Calculate total with customizations
        const customizationTotal = product.customer_products ?
            product.customer_products.reduce((sum, item) => sum + parseFloat(item.custom_price || 0), 0) : 0;
        const finalTotal = (parseFloat(product.price || 0) + customizationTotal) * parseInt(product.quantity || 1);

        return `
        <div class="bg-[#2C3E50] rounded-lg p-3 relative">
            <!-- Header: Title and Badge -->
            <div class=" mb-6">
                <h4 class="text-white font-bold text-lg uppercase">${product.name || 'Pastel Personalizado'}</h4>
                <span class="inline-flex items-center px-4 py-2 mt-2 rounded-full text-sm font-bold bg-purple-400 text-white lowercase">
                    personalizado
                </span>
            </div>

            <!-- Cantidad en top-right -->
            <div class="absolute top-5 right-6 text-right">
                <span class="text-gray-400 text-sm">Cantidad: <span class="text-white font-bold text-sm">${product.quantity || 1}</span></span>
            </div>

            <!-- Images Grid (3 columns) -->
            ${hasImages ? `
            <div class="flex gap-3 mb-6">
                ${product.images.slice(0, 3).map(img => {
            const thumbUrl = img.path.startsWith('http') ? img.path : `https://huubie.com.mx/${img.path}`;
            return `
                        <div class="w-32 h-32 rounded-lg overflow-hidden bg-gray-700">
                            <img src="${thumbUrl}" 
                                 alt="${img.original_name || 'Imagen'}" 
                                 class="object-cover w-full h-full">
                        </div>
                    `;
        }).join('')}
            </div>
            ` : ''}

            <!-- Dedication and Observations -->
            ${(hasDedication || hasDetails) ? `
            <div class="flex gap-12 mb-6 pr-32">
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

            <!-- Personalization Section -->
            ${hasCustomization ? `
            <div class="border-t border-gray-600 pt-4 mb-6 pr-32">
                <h5 class="text-purple-300 font-bold text-sm mb-4 uppercase">Personalización:</h5>
                ${this.renderPersonalizationGrid(product.customer_products)}
            </div>
            ` : ''}

            <!-- Total at bottom-right -->
            <div class="absolute bottom-5 right-6 text-right">
                <span class="text-gray-400 text-sm block mb-1 ">Total:</span>
                <p class="text-white font-bold text-lg">$${finalTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
        </div>
    `;
    }

    renderUploadedImages(images) {
        return `
            <div class="bg-[#1F2A37] rounded-lg p-4">
                <h5 class="text-purple-300 font-semibold mb-3 flex items-center">
                    <i class="icon-camera mr-2"></i>
                    ImÃ¡genes de Referencia
                </h5>
                <div class="grid grid-cols-2 gap-2">
                    ${images.map(img => {
            const thumbUrl = img.path.startsWith('http') ? img.path : `https://huubie.com.mx/${img.path}`;
            return `
                            <div class="aspect-square rounded overflow-hidden bg-gray-700 cursor-pointer hover:opacity-80 transition-opacity">
                                <img src="${thumbUrl}" 
                                     alt="${img.original_name || 'Imagen de referencia'}" 
                                     class="object-cover w-full h-full">
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    }

    renderCustomizationDetails(customizations) {
        const grouped = {};
        customizations.forEach(item => {
            const category = item.modifier_name || 'Otros';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(item);
        });

        return `
            <div class="bg-[#1F2A37] rounded-lg p-4">
                <h5 class="text-purple-300 font-semibold mb-3 flex items-center">
                    <i class="icon-settings mr-2"></i>
                    PersonalizaciÃ³n
                </h5>
                <div class="space-y-3">
                    ${Object.entries(grouped).map(([category, items]) => `
                        <div class="border-b border-gray-600 pb-2 last:border-b-0">
                            <h6 class="text-purple-200 font-medium mb-1">${category}:</h6>
                            ${items.map(item => `
                                <div class="flex justify-between items-center text-sm">
                                    <span class="text-gray-300">${item.custom_details || 'N/A'}</span>
                                    <span class="text-purple-300">$${parseFloat(item.custom_price || 0).toFixed(2)}</span>
                                </div>
                            `).join('')}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderPersonalizedPricing(product) {
        const customizationTotal = product.customer_products ?
            product.customer_products.reduce((sum, item) => sum + parseFloat(item.custom_price || 0), 0) : 0;
        const finalTotal = (parseFloat(product.price || 0) + customizationTotal) * parseInt(product.quantity || 1);

        return `
            <div class="bg-gradient-to-r from-purple-800/30 to-pink-800/30 rounded-lg p-4 border border-purple-500/30">
                <h5 class="text-purple-300 font-semibold mb-3 flex items-center">
                    <i class="icon-dollar-sign mr-2"></i>
                    Precio Real del Pastel
                </h5>
                <div class="space-y-2">
                    <div class="flex justify-between">
                        <span class="text-gray-300">Precio base:</span>
                        <span class="text-white">$${parseFloat(product.price || 0).toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-300">PersonalizaciÃ³n:</span>
                        <span class="text-purple-300">$${customizationTotal.toFixed(2)}</span>
                    </div>
                    <div class="border-t border-purple-500/30 pt-2">
                        <div class="flex justify-between items-center">
                            <span class="text-purple-200 font-semibold">Total Final:</span>
                            <span class="text-white font-bold text-2xl">$${finalTotal.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    renderPersonalizationGrid(customizations) {
        const grouped = {};
        customizations.forEach(item => {
            const category = item.modifier_name || 'Otros';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(item);
        });

        const entries = Object.entries(grouped);
        const half = Math.ceil(entries.length / 2);
        const leftColumn = entries.slice(0, half);
        const rightColumn = entries.slice(half);

        return `
            <div class="grid grid-cols-2 gap-8">
                <!-- Left Column -->
                <div class="space-y-3">
                    ${leftColumn.map(([category, items]) => `
                        ${items.map(item => `
                            <div class="flex justify-between items-center">
                                <span class="text-purple-300 font-medium">${category}: ${item.custom_details || 'N/A'}</span>
                                <span class="text-white font-semibold">$${parseFloat(item.custom_price || 0).toFixed(2)}</span>
                            </div>
                        `).join('')}
                    `).join('')}
                </div>
                
                <!-- Right Column -->
                <div class="space-y-3">
                    ${rightColumn.map(([category, items]) => `
                        ${items.map(item => `
                            <div class="flex justify-between items-center">
                                <span class="text-purple-300 font-medium">${category}: ${item.custom_details || 'N/A'}</span>
                                ${item.custom_price && parseFloat(item.custom_price) > 0 ?
                `<span class="text-white font-semibold">$${parseFloat(item.custom_price).toFixed(2)}</span>` :
                ''
            }
                            </div>
                        `).join('')}
                    `).join('')}
                </div>
            </div>
        `;
    }
}

