let url = '../ctrl/ctrl-admin.php';
let api = 'http://www.coffeehuubie.com/dev/pedidos/ctrl/ctrl-pedidos.php';

$(async () => {



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
            url: this._link,
            data: { opc: 'getOrderDetails', id: orderId }
        });

        // Debug: Mostrar datos del pedido
        console.log('📦 RESPUESTA COMPLETA:', response);

        if (response.data && response.data.products) {
            console.log('🍰 PRODUCTOS:', response.data.products);

            // Buscar productos personalizados
            response.data.products.forEach((product, index) => {
                console.log(`🍰 Producto ${index + 1}:`, {
                    nombre: product.product_name,
                    customer_id: product.customer_id,
                    es_personalizado: !!product.customer_id,
                    datos_completos: product
                });

                if (product.customer_id) {
                    console.log(`🎨 ¡PRODUCTO PERSONALIZADO ENCONTRADO!`, product);
                    if (product.images && product.images.length > 0) {
                        console.log(`🖼️ Imágenes del producto personalizado:`, product.images);
                    }
                }
            });
        } else {
            console.log('❌ No se encontraron productos en la respuesta');
        }


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

        // Agregar estilos CSS para el modal (tamaño pequeño)
        $("<style>").text(`
            .order-details-modal-dialog .modal-dialog {
                max-width: 800px !important;
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

        // <div class="text-center">
        //     <p class="text-gray-400 text-sm">Descuento</p>
        //     <p class="text-yellow-400 font-bold">$${parseFloat(d.discount).toFixed(2)}</p>
        // </div>

        $(`#${opts.parent}`).html(html);
    }

    renderOrder(data) {
        const orderData = data.order || {};
        const products = data.products || [];
        const payments = data.payments || [];

        const orderHtml = `
            <div class="space-y-4">
                <!-- Productos del Pedido -->
                <div class="">
                    <h3 class="text-white font-semibold mb-3">Productos del Pedido</h3>
                    <div id="container-products" class="space-y-3 max-h-96 overflow-y-auto">
                     
                    </div>
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
        const products = opts.json;

        let html = "";

        if (!products || products.length === 0) {
            html = `
            <div class="text-center py-6 text-gray-400">
                <i class="icon-box text-3xl mb-2"></i>
                <p class="text-sm">No hay productos en este pedido</p>
            </div>`;
        } else {
            html = products.map((product, index) => {
                // Determinar si es producto personalizado basado en customer_id
                const isCustom = product.customer_id && product.customer_id !== null;

                // Log detallado de cada producto
                console.log(`🍰 Renderizando producto #${index + 1}:`, {
                    nombre: product.product_name,
                    es_personalizado: isCustom,
                    customer_id: product.customer_id,
                    datos_completos: product
                });

                return `
                <div class="bg-[#374151] rounded-lg p-3 mb-3">
                    <!-- Layout responsive: vertical en móvil, horizontal en desktop -->
                    <div class="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                        <!-- Imagen del producto -->
                        <div class="flex-shrink-0 self-center md:self-auto">
                            ${isCustom ? `
                                <!-- Producto personalizado: icono púrpura o miniaturas -->
                                ${product.images && product.images.length > 0 ? `
                                    <div class="relative">
                                        <div class="w-16 h-16 md:w-20 md:h-20 bg-purple-600 rounded-xl flex items-center justify-center">
                                            <i class="icon-birthday text-white text-xl md:text-2xl"></i>
                                        </div>
                                        <div class="absolute -bottom-1 -right-1 bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                            ${product.images.length}
                                        </div>
                                    </div>
                                ` : `
                                    <div class="w-16 h-16 md:w-20 md:h-20 bg-purple-600 rounded-xl flex items-center justify-center">
                                        <i class="icon-birthday text-white text-xl md:text-2xl"></i>
                                    </div>
                                `}
                            ` : `
                                <!-- Producto normal: imagen o icono amarillo -->
                                ${product.image && product.image.trim() !== "" ? `
                                    <img src="https://huubie.com.mx/${product.image}" alt="${product.product_name}" class="w-16 h-16 md:w-20 md:h-20 rounded-xl object-cover">
                                ` : `
                                    <div class="w-16 h-16 md:w-20 md:h-20 bg-yellow-400 rounded-xl flex items-center justify-center">
                                        <i class="icon-birthday text-gray-800 text-xl md:text-2xl"></i>
                                    </div>
                                `}
                            `}
                        </div>
                        
                        <!-- Información del producto -->
                        <div class="flex-1">
                            <div class="flex flex-col lg:flex-row  lg:items-center lg:justify-between gap-2 lg:gap-4">
                                <div class="flex-1  md:text-left lg:text-left">
                                    <h4 class="text-white font-semibold text-sm lg:text-base uppercase mb-1 lg:mb-2">${product.product_name || product.name}</h4>
                                    ${isCustom ? `
                                    <div class="inline-flex items-center gap-1 bg-purple-500 text-purple-200 px-2 py-1 lg:px-3 lg:py-1 rounded-full text-xs lg:text-sm font-medium">
                                        <i class="icon-magic text-xs lg:text-sm"></i>
                                        <span class="hidden lg:inline">Producto Personalizado</span>
                                        <span class="lg:hidden">Personalizado</span>
                                    </div>` : ""}
                                </div>
                                <div class="text-center lg:text-right">
                                    <p class="text-gray-400 text-xs lg:text-sm mb-1">Cant: ${product.quantity}</p>
                                    <p class="text-green-400 font-bold text-2xl">$${parseFloat(product.total_price || (product.price * product.quantity)).toFixed(2)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Detalles de personalización (solo si es personalizado) -->
                    ${isCustom ? `
                    <div class="mt-3 lg:mt-4 bg-gray-800/50 rounded-lg p-2 lg:p-3">
                        <div class="space-y-2">
                            ${product.data_customer || product.customer_product_name ? `
                            <div class="flex items-center gap-2 text-blue-400">
                                <i class="icon-user text-xs lg:text-sm"></i>
                                <p class="text-xs lg:text-sm font-medium">Cliente: ${product.data_customer || product.customer_product_name}</p>
                            </div>` : ""}
                            
                            ${product.customer_portion_qty ? `
                            <div class="flex items-center gap-2 text-orange-400">
                                <i class="icon-layers text-xs lg:text-sm"></i>
                                <p class="text-xs lg:text-sm font-medium">Porciones: ${product.customer_portion_qty}</p>
                            </div>` : ""}
                            
                            ${product.customer_base_price && product.customer_real_price ? `
                            <div class="flex items-center gap-2 text-purple-400">
                                <i class="icon-dollar text-xs lg:text-sm"></i>
                                <p class="text-xs lg:text-sm">Precio base: $${parseFloat(product.customer_base_price).toFixed(2)} → Final: $${parseFloat(product.customer_real_price).toFixed(2)}</p>
                            </div>` : ""}
                            
                            ${product.custom_details ? `
                            <div class="flex items-start gap-2 text-yellow-400">
                                <i class="icon-doc-text text-xs lg:text-sm mt-1"></i>
                                <div>
                                    <p class="text-xs lg:text-sm font-medium">Detalles personalizados:</p>
                                    <p class="text-xs lg:text-sm text-gray-300">${product.custom_details}</p>
                                </div>
                            </div>` : ""}
                            
                            ${product.order_details ? `
                            <div class="flex items-start gap-2 text-cyan-400">
                                <i class="icon-list text-xs lg:text-sm mt-1"></i>
                                <div>
                                    <p class="text-xs lg:text-sm font-medium">Instrucciones del pedido:</p>
                                    <p class="text-xs lg:text-sm text-gray-300">${product.order_details}</p>
                                </div>
                            </div>` : ""}
                            
                            ${product.dedication ? `
                            <div class="flex items-start gap-2 text-pink-400">
                                <i class="icon-heart text-xs lg:text-sm mt-1"></i>
                                <div>
                                    <p class="text-xs lg:text-sm font-medium">Dedicatoria:</p>
                                    <p class="text-xs lg:text-sm text-gray-300 italic">"${product.dedication}"</p>
                                </div>
                            </div>` : ""}
                            
                            ${product.images && product.images.length > 0 ? `
                            <div class="space-y-2">
                                <div class="flex items-center gap-2 text-green-400">
                                    <i class="icon-camera text-xs lg:text-sm"></i>
                                    <p class="text-xs lg:text-sm">${product.images.length} imagen${product.images.length > 1 ? 'es' : ''} adjunta${product.images.length > 1 ? 's' : ''}</p>
                                </div>
                                <!-- Contenedor de miniaturas -->
                                <div class="bg-gray-900/50 border-2 border-dashed border-gray-600 rounded-lg p-3">
                                    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                        ${product.images.map((image, imgIndex) => `
                                            <div class="relative group cursor-pointer" onclick="app.viewImage('${image.image_path || image.path}', '${image.image_name || image.name || image.original_name}')">
                                                <div class="aspect-square bg-gray-800 rounded-lg overflow-hidden border border-gray-600 hover:border-green-500 transition-colors">
                                                    <img src="https://huubie.com.mx/${image.image_path || image.path}" 
                                                         alt="${image.image_name || image.name || image.original_name}" 
                                                         class="w-full h-full object-cover"
                                                         onerror="this.parentElement.innerHTML='<div class=\\'w-full h-full flex items-center justify-center text-gray-500\\'>📷<br><span class=\\'text-xs\\'>Error</span></div>'">
                                                </div>
                                                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                                                    <i class="icon-eye text-white opacity-0 group-hover:opacity-100 transition-opacity"></i>
                                                </div>
                                                <div class="absolute bottom-1 left-1 right-1">
                                                    <p class="text-xs text-white bg-black/70 rounded px-1 py-0.5 truncate">
                                                        ${(image.original_name || image.image_name || image.name || 'Imagen').replace(/\.[^/.]+$/, '')}
                                                    </p>
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>` : ""}
                            
                            ${!product.data_customer && !product.customer_product_name && !product.custom_details && !product.order_details && !product.dedication && !product.customer_portion_qty && (!product.images || product.images.length === 0) ? `
                            <div class="flex items-center gap-2 text-gray-400">
                                <i class="icon-info text-xs lg:text-sm"></i>
                                <p class="text-xs lg:text-sm">Producto personalizado sin detalles adicionales</p>
                            </div>` : ""}
                        </div>
                    </div>` : ""}
                </div>
                `;
            }).join('');
        }

        $(`#${opts.parent}`).html(html);
    }

    viewImage(imagePath, imageName) {
        const modal = bootbox.dialog({
            title: `
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-green-600 rounded flex items-center justify-center">
                        <i class="icon-picture text-white text-sm"></i>
                    </div>
                    <div>
                        <h2 class="text-lg font-semibold text-white">${imageName || 'Imagen del producto'}</h2>
                    </div>
                </div>
            `,
            message: `
                <div class="flex justify-center items-center p-4">
                    <img src="https://huubie.com.mx/${imagePath}" 
                         alt="${imageName}" 
                         class="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg">
                </div>
            `,
            size: 'large',
            closeButton: true,
            className: 'image-viewer-modal'
        });

        // Estilos para el modal de imagen
        $("<style>").text(`
            .image-viewer-modal .modal-dialog {
                max-width: 90vw !important;
            }
            .image-viewer-modal .modal-body {
                padding: 0 !important;
                background: #1a1a1a;
            }
        `).appendTo("head");

        return modal;
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