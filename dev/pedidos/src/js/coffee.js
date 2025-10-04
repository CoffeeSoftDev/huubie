let url = 'https://huubie.com.mx/dev/pedidos/ctrl/ctrl-admin.php';
let api = "pedidos/ctrl/ctrl-pedidos.php";

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
        this.orderDetailsModal(25);


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
                    active: true,
                },
                {
                    id: "order",
                    tab: "Pedido",
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
        const orderData = data.order || {};
        const products = data.products || [];
        const payments = data.payments || [];

        const orderHtml = `
            <div class="space-y-4">
                <!-- Tipo de pedido -->
                <div class="bg-[#1F2A37] rounded-lg p-3">
                    <h3 class="text-white font-semibold mb-3">Tipo de Pedido</h3>
                    <div>
                        ${this.determineOrderType(orderData)}
                    </div>
                </div>
                
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
            json: [

                {
                    product_name: "Pastel de Chocolate",
                    description: "Bizcocho esponjoso con ganache",
                    order_details: "Sin nuez",
                    dedication: "¡Feliz cumpleaños, Rosi! 🎂",
                    quantity: 2,
                    unit_price: 180,
                    total_price: 360,
                    image: "https://via.placeholder.com/64x64.png?text=🍫"
                },
                {
                    product_name: "Pay de Limón",
                    description: "Corteza crujiente y relleno cremoso",
                    quantity: 1,
                    unit_price: 95,
                    total_price: 95,
                    image: ""
                }
            ]
        };

        const opts = Object.assign({}, defaults, options);
        const products = opts.json;

        let html = "";

        if (!products || products.length === 0) {
            html = `
      <div class="text-center py-4 text-gray-400">
        <i class="icon-box text-2xl mb-1"></i>
        <p class="text-sm">No hay productos en este pedido</p>
      </div>`;
        } else {
            html = products.map(product => `
      <div class="flex items-center justify-between p-2 bg-[#283341] rounded border border-gray-600 mb-2">
        <div class="flex items-center gap-2">
          ${product.image
                    ? `<img src="${product.image}" alt="${product.product_name}" class="w-8 h-8 rounded object-cover">`
                    : `<div class="w-8 h-8 bg-gray-600 rounded flex items-center justify-center"><i class="icon-box text-gray-400 text-xs"></i></div>`}
          <div>
            <p class="text-white font-semibold text-sm">${product.product_name}</p>
            <p class="text-gray-400 text-xs">${product.description || ""}</p>
            ${product.order_details ? `<p class="text-gray-500 text-xs">${product.order_details}</p>` : ""}
            ${product.dedication ? `<p class="text-yellow-400 text-xs"><i class="icon-heart"></i> ${product.dedication}</p>` : ""}
          </div>
        </div>
        <div class="text-right">
          <p class="text-white text-sm">Cant: ${product.quantity}</p>
          <p class="text-gray-400 text-xs">$${parseFloat(product.unit_price).toFixed(2)} c/u</p>
          <p class="text-green-400 font-bold text-sm">$${parseFloat(product.total_price).toFixed(2)}</p>
        </div>
      </div>
    `).join('');
        }

        $(`#${opts.parent}`).html(html);
    }





}