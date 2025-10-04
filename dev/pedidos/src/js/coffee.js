let url = '../ctrl/ctrl-admin.php';
let api = 'pedidos/ctrl/ctrl-pedidos.php';

$(async () => {

    // Prueba de conexión al backend
    console.log('🔄 Probando conexión al backend...');

    try {
        const testResponse = await useFetch({
            url: url,
            data: { opc: "init" }
        });
        console.log('✅ Conexión exitosa:', testResponse);
    } catch (error) {
        console.error('❌ Error de conexión:', error);
    }

    // instancias.
    app = new App(api, 'root');
    orders = app; // Variable global para acceder desde el botón
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

        // interface.
        // this.orderDetailsModal(25);
        this.showOrderDetails(32)
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
            url: api,
            data: { opc: 'getOrderDetails', id: orderId }
        });


        this.orderDetailsModal({
            orderId: orderId,
            data: response.data
        });

    }

    orderDetailsModal(options) {
        const defaults = {
            orderId: null,
            data: {
                order: {},
                products: [],
                payments: []
            }
        };

        const opts = Object.assign({}, defaults, options);
        const orderData = opts.data.order || {};


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

        // Usar tabLayout de CoffeeSoft
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

        // Renderizar contenido de la tab "Detalles del pedido"
        setTimeout(() => {
            this.orderDetailsTab();
            this.renderOrderTab(opts.data);
        }, 100);

        // Agregar estilos CSS para el modal (tamaño pequeño)
        $("<style>").text(`
            .order-details-modal-dialog .modal-dialog {
                max-width: 700px !important;
                width: 90vw !important;
            }
            .order-details-modal-dialog .modal-header {
            }
            .order-details-modal-dialog .modal-body {
                padding: 0 !important;
            }
        `).appendTo("head");

        return modal;
    }

    orderDetailsTab(options) {
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

            <div class="bg-[#1F2A37] rounded-lg p-3">
            <p class="text-gray-400 text-sm mb-2">Observación:</p>
            <p class="text-gray-300">${d.note}</p>
            </div>

            <div class="bg-[#1F2A37] rounded-lg p-3">
            <h3 class="text-white font-semibold mb-3">Resumen Financiero</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div class="text-center">
                <p class="text-gray-400 text-sm">Total</p>
                <p class="text-white font-bold">$${parseFloat(d.total_pay).toFixed(2)}</p>
                </div>
                <div class="text-center">
                <p class="text-gray-400 text-sm">Pagado</p>
                <p class="text-green-400 font-bold">$${formatPrice(d.total_paid)}</p>
                </div>
                <div class="text-center">
                <p class="text-gray-400 text-sm">Descuento</p>
                <p class="text-yellow-400 font-bold">$${parseFloat(d.discount).toFixed(2)}</p>
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

    renderOrderTab(data) {
        console.log(data)
        const orderData = data.order || {};
        const products = data.products || [];
        const payments = data.payments || [];

        const orderHtml = `
            <div class="space-y-4">
               
                
                <!-- Detalles de productos -->
                <div class="bg-[#1F2A37] rounded-lg p-3">
                    <h3 class="text-white font-semibold mb-3">Productos del Pedido</h3>
                    <div id="container-products" class="space-y-2 max-h-48 overflow-y-auto">
                     
                    </div>
                </div>
                
               
            </div>
        `;

        $('#container-order').html(orderHtml);

        this.orderProductList({
            parent: "container-products",

        });
    }

    determineOrderType(orderData) {
        const isCustom = orderData?.type_id === 2; // Asumiendo que 2 es personalizado

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

    orderProductList(options) {
        const defaults = {
            parent: "container-products",
            json: []
        };

        const opts = Object.assign({}, defaults, options);
        const products = opts.json;

        let html = "";

        if (!products || products.length === 0) {
            html = `
            <div class="text-center py-6 text-gray-400">
                <i class="icon-box text-3xl mb-2"></i>
                <p class="text-sm">No hay productos en este pedido</p>
            </div>`;
        } else {
            html = products.map(product => {
                // Determinar si es producto personalizado basado en customer_id
                const isCustom = product.customer_id && product.customer_id !== null;

                return `
                <div class="${isCustom ? 'bg-purple-900/40 border-purple-500' : 'bg-[#283341] border-gray-600'} rounded-lg border p-4 mb-3">
                    <div class="flex items-start gap-3">
                        <!-- Imagen del producto -->
                        <div class="flex-shrink-0">
                            ${product.image && product.image.trim() !== ""
                        ? `<img src="https://huubie.com.mx/${product.image}" alt="${product.product_name}" class="w-16 h-16 rounded-lg object-cover">`
                        : `<div class="w-16 h-16 bg-gray-600 rounded-lg flex items-center justify-center">
                                     <i class="icon-birthday text-gray-400 text-xl"></i>
                                   </div>`
                    }
                        </div>
                        
                        <!-- Información del producto -->
                        <div class="flex-1">
                            <div class="flex items-start justify-between mb-2">
                                <div>
                                    <h4 class="text-white font-semibold text-base">${product.product_name || product.name}</h4>
                                    ${product.description ? `<p class="text-gray-400 text-sm mt-1">${product.description}</p>` : ""}
                                </div>
                                <div class="text-right">
                                    <p class="text-white font-semibold">Cant: ${product.quantity}</p>
                                    <p class="text-gray-400 text-sm">$${parseFloat(product.unit_price || product.price).toFixed(2)} c/u</p>
                                    <p class="text-green-400 font-bold text-lg">$${parseFloat(product.total_price || (product.price * product.quantity)).toFixed(2)}</p>
                                </div>
                            </div>
                            
                            <!-- Indicador de producto personalizado -->
                            ${isCustom ? `
                            <div class="bg-purple-900/30 border border-purple-500 rounded-lg p-3 mt-3">
                                <div class="flex items-center gap-2 mb-3">
                                    <i class="icon-magic text-purple-400 text-lg"></i>
                                    <span class="text-purple-400 font-semibold text-base">🎨 Producto Personalizado</span>
                                </div>
                                
                                ${product.data_customer ? `
                                <div class="bg-purple-800/30 border border-purple-400/40 rounded-md p-2 mb-3">
                                    <div class="flex items-start gap-2">
                                        <i class="icon-user text-purple-300 text-sm mt-1"></i>
                                        <div class="flex-1">
                                            <p class="text-purple-300 text-sm font-medium mb-1">👤 Tipo de personalización:</p>
                                            <p class="text-gray-200 text-sm font-semibold">${product.data_customer}</p>
                                        </div>
                                    </div>
                                </div>` : ""}
                                
                                <!-- Detalles de personalización -->
                                <div class="space-y-3">
                                    ${product.dedication ? `
                                    <div class="bg-yellow-900/20 border border-yellow-600/30 rounded-md p-2">
                                        <div class="flex items-start gap-2">
                                            <i class="icon-heart text-yellow-400 text-sm mt-1"></i>
                                            <div class="flex-1">
                                                <p class="text-yellow-400 text-sm font-medium mb-1">💝 Dedicatoria:</p>
                                                <p class="text-gray-200 text-sm italic">"${product.dedication}"</p>
                                            </div>
                                        </div>
                                    </div>` : ""}
                                    
                                    ${product.order_details ? `
                                    <div class="bg-blue-900/20 border border-blue-600/30 rounded-md p-2">
                                        <div class="flex items-start gap-2">
                                            <i class="icon-doc-text text-blue-400 text-sm mt-1"></i>
                                            <div class="flex-1">
                                                <p class="text-blue-400 text-sm font-medium mb-1">📝 Detalles especiales:</p>
                                                <p class="text-gray-200 text-sm">${product.order_details}</p>
                                            </div>
                                        </div>
                                    </div>` : ""}
                                    
                                    ${product.images && product.images.length > 0 ? `
                                    <div class="bg-green-900/20 border border-green-600/30 rounded-md p-2">
                                        <div class="flex items-start gap-2">
                                            <i class="icon-camera text-green-400 text-sm mt-1"></i>
                                            <div class="flex-1">
                                                <p class="text-green-400 text-sm font-medium mb-1">📷 Imágenes de referencia:</p>
                                                <p class="text-gray-200 text-sm">${product.images.length} imagen${product.images.length > 1 ? 's' : ''} adjunta${product.images.length > 1 ? 's' : ''}</p>
                                                <div class="flex gap-1 mt-2 flex-wrap">
                                                    ${product.images.slice(0, 3).map(img => `
                                                        <div class="w-8 h-8 bg-gray-700 rounded border border-green-500/30 flex items-center justify-center">
                                                            <i class="icon-picture text-green-400 text-xs"></i>
                                                        </div>
                                                    `).join('')}
                                                    ${product.images.length > 3 ? `<div class="w-8 h-8 bg-gray-700 rounded border border-green-500/30 flex items-center justify-center"><span class="text-green-400 text-xs">+${product.images.length - 3}</span></div>` : ''}
                                                </div>
                                            </div>
                                        </div>
                                    </div>` : ""}
                                    
                                    ${!product.dedication && !product.order_details && (!product.images || product.images.length === 0) ? `
                                    <div class="bg-gray-800/50 border border-gray-600/30 rounded-md p-2">
                                        <div class="flex items-center gap-2">
                                            <i class="icon-info text-gray-400 text-sm"></i>
                                            <p class="text-gray-400 text-sm">Producto personalizado sin detalles adicionales</p>
                                        </div>
                                    </div>` : ""}
                                </div>
                            </div>` : ""}
                        </div>
                    </div>
                </div>
                `;
            }).join('');
        }

        $(`#${opts.parent}`).html(html);
    }

    // orderProductList(options) {
    //     const defaults = {
    //         parent: "container-products",
    //         json: [

    //             {
    //                 product_name: "Pastel de Chocolate",
    //                 description: "Bizcocho esponjoso con ganache",
    //                 order_details: "Sin nuez",
    //                 dedication: "¡Feliz cumpleaños, Rosi! 🎂",
    //                 quantity: 2,
    //                 unit_price: 180,
    //                 total_price: 360,
    //                 image: "https://via.placeholder.com/64x64.png?text=🍫"
    //             },
    //             {
    //                 product_name: "Pay de Limón",
    //                 description: "Corteza crujiente y relleno cremoso",
    //                 quantity: 1,
    //                 unit_price: 95,
    //                 total_price: 95,
    //                 image: ""
    //             }
    //         ]
    //     };

    //     const opts = Object.assign({}, defaults, options);
    //     const products = opts.json;

    //     let html = "";

    //     if (!products || products.length === 0) {
    //         html = `
    //   <div class="text-center py-4 text-gray-400">
    //     <i class="icon-box text-2xl mb-1"></i>
    //     <p class="text-sm">No hay productos en este pedido</p>
    //   </div>`;
    //     } else {
    //         html = products.map(product => `
    //   <div class="flex items-center justify-between p-2 bg-[#283341] rounded border border-gray-600 mb-2">
    //     <div class="flex items-center gap-2">
    //       ${product.image
    //                 ? `<img src="${product.image}" alt="${product.product_name}" class="w-8 h-8 rounded object-cover">`
    //                 : `<div class="w-8 h-8 bg-gray-600 rounded flex items-center justify-center"><i class="icon-box text-gray-400 text-xs"></i></div>`}
    //       <div>
    //         <p class="text-white font-semibold text-sm">${product.product_name}</p>
    //         <p class="text-gray-400 text-xs">${product.description || ""}</p>
    //         ${product.order_details ? `<p class="text-gray-500 text-xs">${product.order_details}</p>` : ""}
    //         ${product.dedication ? `<p class="text-yellow-400 text-xs"><i class="icon-heart"></i> ${product.dedication}</p>` : ""}
    //       </div>
    //     </div>
    //     <div class="text-right">
    //       <p class="text-white text-sm">Cant: ${product.quantity}</p>
    //       <p class="text-gray-400 text-xs">$${parseFloat(product.unit_price).toFixed(2)} c/u</p>
    //       <p class="text-green-400 font-bold text-sm">$${parseFloat(product.total_price).toFixed(2)}</p>
    //     </div>
    //   </div>
    // `).join('');
    //     }

    //     $(`#${opts.parent}`).html(html);
    // }





}