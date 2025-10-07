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

        console.log('📦 Datos recibidos en renderOrder:', data);
        console.log('📦 Productos:', products);

        const orderHtml = `
            <div class="space-y-4">
                <div class="">
                    <h3 class="text-white font-semibold mb-3">Productos del Pedido</h3>
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

        if (!opts.json || opts.json.length === 0) {
            $(`#${opts.parent}`).html(`
            <div class="text-center py-8">
                <i class="icon-basket text-gray-500 text-3xl mb-2"></i>
                <p class="text-gray-400">No hay productos en este pedido</p>
            </div>
        `);
            return;
        }

        let productsHtml = '';

        opts.json.forEach(product => {
            console.log('🖼️ Producto individual:', product);
            console.log('🖼️ Images del producto:', product.images);

            const total = parseFloat(product.price || 0) * parseInt(product.quantity || 1);

            const hasImage = product.image && product.image.trim() !== '';
            let imageContent = '';

            if (hasImage) {
                let imageUrl = product.image;
                if (!imageUrl.startsWith('http')) {
                    imageUrl = `https://huubie.com.mx/${imageUrl}`;
                }

                imageContent = `
                    <img src="${imageUrl}" 
                         alt="${product.name}" 
                         class="object-cover w-full h-full"
                         onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="w-full h-full items-center justify-center hidden">
                        <i class="icon-birthday text-gray-500 text-2xl"></i>
                    </div>
                `;
            } else {
                imageContent = `
                    <div class="w-full h-full flex items-center justify-center">
                        <i class="icon-birthday text-gray-500 text-2xl"></i>
                    </div>
                `;
            }

            let thumbnailsHtml = '';
            if (product.images && Array.isArray(product.images) && product.images.length > 0) {
                thumbnailsHtml = '<div class="flex gap-2 mt-3 flex-wrap">';
                product.images.forEach(img => {
                    let thumbUrl = img.path;
                    if (!thumbUrl.startsWith('http')) {
                        thumbUrl = `https://huubie.com.mx/${thumbUrl}`;
                    }
                    thumbnailsHtml += `
                        <div class="w-16 h-16 rounded border-2 border-gray-600 overflow-hidden bg-[#1F2A37] cursor-pointer hover:border-blue-500 transition-colors">
                            <img src="${thumbUrl}" 
                                 alt="${img.original_name || 'Imagen'}" 
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
            <div class="bg-[#283341] rounded-lg p-3">
                <div class="flex gap-4">
                    <div class="flex-shrink-0">
                        <div class="w-36 h-36 rounded-md overflow-hidden bg-[#1F2A37]">
                            ${imageContent}
                        </div>
                        ${thumbnailsHtml}
                    </div>

                    <div class="w-px bg-gray-600 self-stretch"></div>

                    <div class="flex justify-between flex-1">
                        <div class="flex-1">
                            <div class="flex items-start justify-between mb-2">
                                <h4 class="text-white font-semibold text-lg uppercase">${product.name || 'Producto sin nombre'}</h4>
                                <p class="text-blue-400 font-medium text-lg ml-4">$${parseFloat(product.price || 0).toFixed(2)}</p>
                            </div>

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

                        <div class="flex flex-col justify-end items-end ml-4">
                            <div class="flex items-center gap-2 mb-2">
                                <span class="text-gray-400 text-sm">Cantidad:</span>
                                <span class="bg-[#1F2A37] text-white px-3 py-1 rounded-md font-medium">${product.quantity || 1}</span>
                            </div>

                            <div class="text-right">
                                <div class="text-gray-400 text-sm mb-1">Total:</div>
                                <div class="text-white font-bold text-xl">$${total.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        });

        $(`#${opts.parent}`).html(productsHtml);
    }
}
