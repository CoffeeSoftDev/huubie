let url = '../ctrl/ctrl-admin.php';
let api = 'http://www.coffeehuubie.com/dev/pedidos/ctrl/ctrl-pedidos.php';

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
                        <i class=" icon-birthday text-white text-sm"></i>
                    </div>
                    <div>
                        <h2 class="text-lg font-semibold text-white">Pedido</h2>
                    </div>
                </div>
            `,
            message: '<div id="orderDetailsContainer" class="  m-3 min-h-[400px]"></div>',
            size: 'small',
            closeButton: true,
            className: 'order-details-modal-dialog'
        });

        this.tabLayout({
            parent: "orderDetailsContainer",
            id: "orderDetailsTabs",
            theme: "dark",
            type: "large",
            renderContainer: true,
            content: { class: "p-2" },
            json: [
                {
                    id: "details",
                    tab: "Detalles del pedido",
                },
                {
                    id: "order",
                    tab: "Pedido",
                    active: true,
                }
            ]
        });

        setTimeout(() => {
            this.renderOrderDetails({ json: response.data.order });
            this.renderOrder(response.data);
        }, 100);

        $("<style>").text(`
            .order-details-modal-dialog .modal-dialog {
                max-width: 800px !important;
                width: 90vw !important;
            }
            .order-details-modal-dialog .modal-body {
                padding: 0 !important;
            }
        `).appendTo("head");

        return modal;
    }

    renderOrderDetails(options) {
        const defaults = {
            parent: "container-details",
            json: {
                folio: "P-0028",
                name: "Cliente",
                formatted_date_order: "15/09/2025",
                date_order: "",
                time_order: "10:00 AM",
                note: "Sin observaciones",
                total_pay: 0,
                total_paid: 0,
                discount: 0,
                balance: 0,
            },
        };

        const opts = Object.assign({}, defaults, options);
        const d = opts.json;

        const html = `
        <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-3">
                <div class="flex items-center gap-3">
                <i class="icon-doc-text-1 text-gray-400"></i>
                <div>
                    <p class="text-gray-400 text-sm">Folio:</p>
                    <p class="text-white font-semibold">${d.folio}</p>
                </div>
                </div>
                <div class="flex items-center gap-3">
                <i class="icon-user-1 text-gray-400"></i>
                <div>
                    <p class="text-gray-400 text-sm">Nombre:</p>
                    <p class="text-white font-semibold">${d.name}</p>
                </div>
                </div>
            </div>

            <div class="space-y-3">
                <div class="flex items-center gap-3">
                <i class="icon-calendar text-gray-400"></i>
                <div>
                    <p class="text-gray-400 text-sm">Fecha del pedido:</p>
                    <p class="text-white font-semibold">${d.formatted_date_order || d.date_order}</p>
                </div>
                </div>
                <div class="flex items-center gap-3">
                <i class="icon-clock text-gray-400"></i>
                <div>
                    <p class="text-gray-400 text-sm">Hora de entrega:</p>
                    <p class="text-white font-semibold">${d.time_order}</p>
                </div>
                </div>
            </div>
            </div>

            <div class="bg-[#283341] rounded-lg p-3">
            <p class="text-gray-400 text-sm mb-2">Observación:</p>
            <p class="text-gray-300">${d.note ?? ''}</p>
            </div>

            <div class="bg-[#283341] rounded-lg p-3">
            <h3 class="text-white font-semibold mb-3">Resumen</h3>
            <div class="grid grid-cols-3 md:grid-cols-3 gap-3">
                <div class="text-center">
                <p class="text-gray-400 text-sm">Total</p>
                <p class="text-white font-bold">$${parseFloat(d.total_pay).toFixed(2)}</p>
                </div>
                <div class="text-center">
                <p class="text-gray-400 text-sm">Pagado</p>
                <p class="text-green-400 font-bold">$${parseFloat(d.total_paid).toFixed(2)}</p>
                </div>
               
                <div class="text-center">
                <p class="text-gray-400 text-sm">Saldo</p>
                <p class="text-red-400 font-bold">$${parseFloat(d.balance).toFixed(2)}</p>
                </div>
            </div>
            </div>
        </div>`;

        $(`#${opts.parent}`).html(html);
    }

    renderOrder(data) {
        const orderData = data.order || {};
        const products = data.products || [];
        const payments = data.payments || [];

        const orderHtml = `
            <div class="space-y-4">
                <div class="">
                    <div id="container-products" class="space-y-3 max-h-96 overflow-y-auto"></div>
                </div>
            </div>
        `;

        $('#container-order').html(orderHtml);

        this.orderProductList({
            parent: "container-products",
            json: products
        });
    }

    orderProductList(options) {
        const defaults = {
            parent: "container-products",
            json: []
        };

        const opts = Object.assign({}, defaults, options);

        const totalItems = opts.json.reduce((acc, item) => acc + parseInt(item.quantity || 1), 0);

        if (!opts.json || opts.json.length === 0) {
            $(`#${opts.parent}`).html(`
            <div class="text-center py-8">
                <i class="icon-basket text-gray-500 text-3xl mb-2"></i>
                <p class="text-gray-400">No hay productos en este pedido</p>
            </div>
        `);
            return;
        }

        let productsHtml = `
        <div class="text-right text-gray-300 font-semibold mb-3">
            Total de productos: ${totalItems}
        </div>
    `;

        opts.json.forEach(product => {
            const total = parseFloat(product.price || 0) * parseInt(product.quantity || 1);
            // Detect custom products: if is_custom is true, apply purple theme and show "personalizado" label
            const isCustomProduct = product.is_custom === true;

            const hasImage = product.image && product.image.trim() !== '';
            let imageContent;

            if (isCustomProduct) {
                imageContent = `<div class="w-full h-full flex items-center justify-center bg-purple-500">
                    <i class="icon-birthday text-purple-200 text-3xl"></i>
                </div>`;
            } else {
                imageContent = hasImage
                    ? `<img src="${product.image.startsWith('http') ? product.image : `https://huubie.com.mx/${product.image}`}" 
                         alt="${product.name}" 
                         class="object-cover w-full h-full"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="w-full h-full items-center justify-center hidden">
                        <i class="icon-birthday text-gray-500 text-2xl"></i>
                    </div>`
                    : `<div class="w-full h-full flex items-center justify-center">
                        <i class="icon-birthday text-gray-500 text-2xl"></i>
                   </div>`;
            }

            let thumbnailsHtml = '';
            if (product.images && Array.isArray(product.images) && product.images.length > 0) {
                thumbnailsHtml = '<div class="flex gap-2 mt-2 flex-wrap">';
                product.images.forEach(img => {
                    let thumbUrl = img.path.startsWith('http') ? img.path : `https://huubie.com.mx/${img.path}`;
                    thumbnailsHtml += `
                    <div class="w-16 h-16 rounded overflow-hidden bg-[#1F2A37] cursor-pointer hover:border-blue-500 transition-colors">
                        <img src="${thumbUrl}" alt="${img.original_name || 'Imagen'}" 
                             class="object-cover w-full h-full"
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="w-full h-full items-center justify-center hidden">
                            <i class="icon-picture text-gray-500 text-sm"></i>
                        </div>
                    </div>
                `;
                });
                thumbnailsHtml += '</div>';
            }


            productsHtml += `
            <div class="bg-[#283341] rounded-lg p-3 space-y-2">
                <div class="flex gap-4">
                    <!-- 📷 Imagen principal -->
                    <div class="w-28 h-28 rounded-md overflow-hidden bg-[#1F2A37] flex-shrink-0">
                        ${imageContent}
                    </div>

                    <!-- 🧾 Info + totales -->
                    <div class="flex-1 flex justify-between">
                        <!-- Info textual -->
                        <div class="flex-1">
                            <h4 class="text-white font-semibold text-lg uppercase mb-1">${product.name || 'Producto sin nombre'}</h4>
                            ${isCustomProduct ? '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-600 text-purple-100 mb-2"><i class="icon-magic mr-1"></i>personalizado</span>' : ''}
                            <p class="text-blue-400 font-medium mb-1">$${parseFloat(product.price || 0).toFixed(2)}</p>

                            ${product.dedication ? `
                                <div class="mb-1">
                                    <span class="text-gray-400 text-sm">Dedicatoria:</span>
                                    <p class="text-gray-300">${product.dedication}</p>
                                </div>
                            ` : ''}

                            ${product.order_details ? `
                                <div class="mb-1">
                                    <span class="text-gray-400 text-sm">Detalles:</span>
                                    <p class="text-gray-300">${product.order_details}</p>
                                </div>
                            ` : ''}
                        </div>

                        <!-- Cantidad y Total -->
                        <div class="flex flex-col justify-between items-end ml-4">
                            <div class="flex items-center gap-2">
                                <span class="text-gray-400 text-sm">Cantidad:</span>
                                <span class="bg-[#1F2A37] text-white px-3 py-1 rounded-md font-medium">${product.quantity || 1}</span>
                            </div>

                            <div class="text-right mt-auto">
                                <div class="text-gray-400 text-sm mb-1">Total:</div>
                                <div class="text-white font-bold text-xl">$${total.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- ➗ Línea divisora + Thumbnails abajo -->
                <div class="border-t border-gray-700 pt-2">
                    ${thumbnailsHtml}
                </div>

                ${isCustomProduct && product.customer_products && product.customer_products.length > 0 ? `
                    <!-- 🎨 Sección de Productos Personalizados -->
                    <div class="border-t border-gray-600 pt-4 mt-3">
                        <div class="flex items-center gap-2 mb-3">
                            <i class="icon-magic-wand text-purple-400"></i>
                            <h5 class="text-purple-300 font-semibold">Personalización</h5>
                        </div>
                        
                        <div class="space-y-2">
                            ${product.customer_products.map(customItem => `
                                <div class="flex justify-between items-center py-2">
                                    <div class="flex-1">
                                        <span class="text-purple-300 font-medium">${customItem.modifier_name}:</span>
                                        <span class="text-gray-300">${customItem.custom_details || 'N/A'}</span>
                                        ${customItem.quantity > 1 ? `<span class="text-gray-500 text-xs ml-1">(x${customItem.quantity})</span>` : ''}
                                    </div>
                                    <div class="text-purple-300 font-medium">
                                        $${parseFloat(customItem.custom_price || 0).toFixed(2)}
                                    </div>
                                </div>
                            `).join('')}
                            
                            <div class="border-t border-purple-500/30 pt-2 mt-3">
                                <div class="flex justify-between items-center">
                                    <span class="text-purple-300 font-semibold">💜 Precio sugerido:</span>
                                    <span class="text-purple-300 font-bold text-lg">
                                        $${product.customer_products.reduce((sum, item) => sum + parseFloat(item.custom_price || 0), 0).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        });

        $(`#${opts.parent}`).html(productsHtml);
    }




}
