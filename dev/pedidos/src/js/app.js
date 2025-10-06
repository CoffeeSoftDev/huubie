
let api = 'ctrl/ctrl-pedidos.php';
let api_catalogo = 'ctrl/ctrl-pedidos-catalogo.php';

let normal, app, custom; //Clases.
let idFolio;
let categories, estado, clients;

$(async () => {
    let dataModifiers = await useFetch({ url: api, data: { opc: "getModifiers" } });
    categories = dataModifiers.data || [];

    const req = await useFetch({ url: api, data: { opc: "init" } });
    estado = req.status;
    clients = req.clients || [];
    app = new App(api, 'root');
    custom = new CustomOrder(api, 'root');
    normal = new CatalogProduct(api_catalogo, 'root');

    app.render();
    app.actualizarFechaHora();

    // idFolio = 25;
    // app.editOrder(idFolio);

    setInterval(() => {
        app.actualizarFechaHora();
    }, 60000);
});

class App extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "Pedidos";
    }

    render() {
        this.layout();
        this.createFilterBar();
        this.ls();
    }

    layout() {
        this.primaryLayout({
            parent: "root",
            id: this.PROJECT_NAME,
            class: 'flex mx-2 my-2 p-2',
            heightPreset: 'viewport', // Usa el preset estándar
            card: {
                filterBar: { class: 'w-full my-3 ', id: 'filterBar' },
                container: { class: 'w-100 h-full my-3 bg-[#1F2A37] rounded p-3', id: 'container' + this.PROJECT_NAME }
            }
        });

        // Filter bar.
        $('#filterBar').html(`
            <div id="filterBar${this.PROJECT_NAME}" class="w-full my-3 " ></div>
            <div id="containerHours"></div>
        `);
    }

    createFilterBar() {
        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: [
                {
                    opc: "input-calendar",
                    class: "col-sm-3",
                    id: "calendar",
                    lbl: "Consultar fecha: ",
                },

                {
                    opc: "select",
                    id: "status",
                    lbl: "Seleccionar estados:",
                    class: "col-sm-3",
                    onchange: "app.ls()",
                    data: [
                        { id: "", valor: "Todos los estados" },
                        ...estado

                    ]
                },

                {
                    opc: 'button',
                    id: 'btnNuevoPedido',
                    class: 'col-sm-2',
                    text: 'Nuevo Pedido',
                    className: 'btn-primary w-100',
                    onClick: () => this.showTypePedido()
                },

                {
                    opc: "button",
                    className: "w-100",
                    class: "col-sm-2",
                    color_btn: "secondary",
                    id: "btnCalendario",
                    text: "Calendario",
                    onClick: () => {
                        this.ls()
                        // window.location.href = '/dev/calendario/'
                    }
                },

            ]
        });

        dataPicker({
            parent: "calendar",
            rangepicker: {
                startDate: moment().startOf("month"), // Inicia con el primer día del mes actual
                endDate: moment().endOf("month"), // Finaliza con el último día del mes actual
                showDropdowns: true,
                ranges: {
                    "Mes actual": [moment().startOf("month"), moment().endOf("month")],
                    "Semana actual": [moment().startOf("week"), moment().endOf("week")],
                    "Próxima semana": [moment().add(1, "week").startOf("week"), moment().add(1, "week").endOf("week")],
                    "Próximo mes": [moment().add(1, "month").startOf("month"), moment().add(1, "month").endOf("month")],
                    "Mes anterior": [moment().subtract(1, "month").startOf("month"), moment().subtract(1, "month").endOf("month")]
                },
            },
            onSelect: (start, end) => {
                this.ls();
            },
        });
    }

    actualizarFechaHora(options) {
        let fecha = new Date();
        let opciones = {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "numeric",
            hour12: true,
            parent: "containerHours",
            label: "",
        };
        let opts = Object.assign({}, opciones, options);
        let fechaFormateada = fecha.toLocaleString("es-ES", opts);

        let div = $("<div>", {
            class: "flex justify-between border-b border-gray-300 mt-2 mb-3",
        }).append(
            $("<label>", {
                text: opts.label,
                class: "text-uppercase text-start font-semibold mb-2",
            }),
            $("<label>", {
                text: fechaFormateada,
                class: "text-uppercase text-end font-semibold mb-2",
            })
        );

        $(`#${opts.parent}`).html(div);
    }

    showTypePedido() {
        normal.render();
    }

    // Orders.
    ls() {
        let rangePicker = getDataRangePicker("calendar");
        this.createTable({
            parent: `container${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: "listOrders", fi: rangePicker.fi, ff: rangePicker.ff },
            conf: { datatable: true, pag: 10 },
            coffeesoft: true,

            attr: {
                id: `tb${this.PROJECT_NAME}`,
                theme: 'dark',
                center: [1, 2, 7, 8, 9, 10, 11],
                extends: true,
            },
        });
    }

    addOrder() {
        $("#container-pedido").html(`<form id="formCreatePedido" novalidate></form>`);

        this.createForm({
            parent: "formCreatePedido",
            id: "formPedido",
            data: { opc: "addOrder" },
            json: this.jsonOrder(),

            success: (response) => {
                if (response.status == 200) {

                    alert({
                        icon: "success",
                        title: "Pedido creado con éxito",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Aceptar"
                    });

                    idFolio = response.id;
                    normal.layoutPos();


                    // 🔵 Activar la pestaña "Catálogo de productos"
                    setTimeout(() => {
                        $("#tab-package")
                            .attr("data-state", "active")
                            .addClass("bg-blue-600 text-white")
                            .removeClass("text-gray-300 hover:bg-gray-700")
                            .trigger("click"); // 👈 simula el click real

                        $("#tab-pedido")
                            .attr("data-state", "inactive")
                            .removeClass("bg-blue-600 text-white")
                            .addClass("text-gray-300 hover:bg-gray-700");
                    }, 300);

                    // 🔒 Bloquear todos los campos después de guardar
                    $("#formPedido :input, #formPedido textarea").prop("disabled", true);


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

        // render.

        $("#date_order").val(new Date().toISOString().split("T")[0]);
        $("#date_birthday").val(new Date().toISOString().split("T")[0]);

        const ahora = new Date();
        const hora = ahora.toTimeString().split(":").slice(0, 2).join(":");
        $("#time_order").val(hora);

        $("#lblCliente").addClass("border-b p-1");
        $("#lblPedido").addClass("border-b p-1");

        $("#phone").on("input", function () {
            let value = $(this).val().replace(/\D/g, ""); // Elimina caracteres no numéricos
            if (value.length > 10) {
                value = value.slice(0, 10); // Limita a 10 dígitos
            }
            $(this).val(value);
        });


        $('#formPedido #name').autocomplete({
            source: clients.map(client => ({
                label: client.name,   // lo que se muestra en el dropdown
                phone: client.phone,  // extra
                email: client.email   // extra
            })),
            select: function (event, ui) {
                $('#formPedido #phone').val(ui.item.phone);
                $('#formPedido #email').val(ui.item.email);
            }
        });

        // 🔄 Si borra el nombre, limpiar teléfono y correo
        $('#formPedido #name').on("input", function () {
            if ($(this).val().trim() === "") {
                $('#formPedido #phone').val("");
                $('#formPedido #email').val("");
            }
        });


    }

    async editOrder(id) {
        idFolio = id;
        normal.render();
        $("#container-pedido").html(`<form id="formEditPedido" novalidate></form>`);



        const request = await useFetch({
            url: this._link,
            data: { opc: "getOrder", id }
        });

        const order = request.data;


        this.createForm({
            parent: "formEditPedido",
            id: "formPedido",
            data: { opc: "editOrder", id },
            autofill: order,
            json: this.jsonOrder(),
            success: (response) => {
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        title: "Pedido actualizado",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Aceptar"
                    });



                    // 🔒 Bloquear campos tras guardar
                    $("#formPedido :input, #formPedido textarea").prop("disabled", true);

                    // 🔵 Mostrar pestaña Catálogo de productos
                    setTimeout(() => {
                        $("#tab-package")
                            .attr("data-state", "active")
                            .addClass("bg-blue-600 text-white")
                            .removeClass("text-gray-300 hover:bg-gray-700")
                            .trigger("click");

                        $("#tab-pedido")
                            .attr("data-state", "inactive")
                            .removeClass("bg-blue-600 text-white")
                            .addClass("text-gray-300 hover:bg-gray-700");
                    }, 250);

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

        if (!$("#date_order").val()) $("#date_order").val(new Date().toISOString().split("T")[0]);
        if (!$("#date_birthday").val()) $("#date_birthday").val(new Date().toISOString().split("T")[0]);

        const ahora = new Date();
        const hora = ahora.toTimeString().split(":").slice(0, 2).join(":");
        if (!$("#time_order").val()) $("#time_order").val(hora);

        $("#lblCliente").addClass("border-b p-1");
        $("#lblPedido").addClass("border-b p-1");

        $("#phone").on("input", function () {
            let value = $(this).val().replace(/\D/g, "");
            if (value.length > 10) value = value.slice(0, 10);
            $(this).val(value);
        });
    }

    cancelOrder(id) {
        const row = event.target.closest('tr');
        const folio = row.querySelectorAll('td')[0]?.innerText || '';

        this.swalQuestion({
            opts: {
                title: `¿Esta seguro?`,
                html: `¿Deseas cancelar la reservación con folio <strong>${folio}</strong>?
                Esta acción actualizará el estado a "Cancelado" en la tabla [reservaciones].`,
            },
            data: { opc: "cancelOrder", status: 4, id: id },
            methods: {
                request: (data) => {
                    alert({
                        icon: "success",
                        title: "Cancelado",
                        text: "El pedido fue cancelado exitosamente.",
                        btn1: true
                    });
                    this.ls();
                },
            },
        });
    }

    async showOrder(id) {
        // Obtener datos de la reservación
        const res = await useFetch({ url: api_catalogo, data: { opc: "getOrder", id: id } });
        const data = res.order;

        // Mostrar modal y renderizar contenido
        bootbox.dialog({
            title: "📅 Pedido",
            closeButton: true,
            message: '<div id="containerOrder"></div>',
        });

        this.tabLayout({
            parent: "containerOrder",
            id: "tabsOrderDetails",
            theme: "dark",
            content: { class: "" },
            json: [
                {
                    id: "detail",
                    tab: "Detalles del pedido",
                    active: true,

                },
                {
                    id: "product-detail",
                    tab: "Pedido"
                }
            ]
        });

        this.detailCard({
            parent: "container-detail",
            data: [
                { text: "Folio", value: 'P-00' + data.folio, icon: "icon-doc-text-1" },
                { text: "Nombre", value: data.name, icon: "icon-user-1" },
                { text: "Fecha del pedido", value: data.date_order, icon: "icon-calendar" },
                { text: "Hora de entrega", value: data.time_order, icon: "icon-clock" },
                { type: "observacion", value: data.note }
            ]
        });


    }

    async printOrder(id) {

        const pos = await useFetch({
            url: api_catalogo,
            data: { opc: "getOrder", id: id }
        });

        const modal = bootbox.dialog({
            closeButton: true,
            title: ` <div class="flex items-center gap-2 text-white text-lg font-semibold">
                        <i class="icon-print text-blue-400 text-xl"></i>
                        Imprimir
                    </div>`,
            message: `<div id="containerPrintOrder"></div>`
        });


        normal.ticketPasteleria({
            parent: 'containerPrintOrder',
            data: {
                head: pos.order,
                products: pos.products,
                paymentMethods: [
                    { method_pay: "Tarjeta", pay: 200 },
                    { method_pay: "Efectivo", pay: 100 }
                ]
            }
        })

    }

    jsonOrder() {
        return [
            {
                opc: "label",
                id: "lblCliente",
                text: "Información del cliente",
                class: "col-12 fw-bold text-lg mb-2  p-1"
            },
            {
                opc: "input",
                lbl: "Nombre del cliente",
                id: "name",
                tipo: "texto",
                class: "col-12 col-sm-6 col-lg-3 mb-3"
            },
            {
                opc: "input",
                lbl: "Teléfono",
                id: "phone",
                tipo: "tel",
                class: "col-12 col-sm-6 col-lg-3 mb-3"
            },
            {
                opc: "input",
                lbl: "Correo electrónico",
                id: "email",
                tipo: "email",
                class: "col-12 col-sm-6 col-lg-3 mb-3",
                required: false
            },

            {
                opc: "input",
                lbl: "Fecha de cumpleaños",
                id: "date_birthday",
                type: "date",
                class: "col-12 col-sm-6 col-lg-3 mb-3"
            },

            {
                opc: "label",
                id: "lblPedido",
                text: "Datos del pedido",
                class: "col-12 fw-bold text-lg  mb-2 p-1"
            },


            {
                opc: "input",
                lbl: "Fecha de entrega",
                id: "date_order",
                type: "date",
                class: "col-12 col-lg-3 mb-3"
            },

            {
                opc: "input",
                lbl: "Hora de entrega",
                id: "time_order",
                type: "time",
                class: "col-12  col-lg-3 mb-3"
            },



            {
                opc: "textarea",
                id: "note",
                lbl: "Notas adicionales",
                rows: 3,
                class: "col-12 mb-3"
            },



            {
                opc: "btn-submit",
                id: "btnGuardarPedido",
                text: "Guardar Pedido",
                class: "col-12  offset-md-8 offset-lg-6 col-md-2 col-lg-3 "
            },
            {
                opc: "button",
                id: "btnRegresar",
                text: "Salir",
                class: "col-12 col-lg-3 col-md-2 ",
                className: 'w-full',
                icono: "fas fa-arrow-left",
                color_btn: "danger",
                onClick: () => this.render()
            },
        ];

    }

    // Payments.

    async historyPay(id) {

        const data = await useFetch({ url: this._link, data: { opc: 'initHistoryPay', id } });
        const order = data.order;


        // Modal.
        bootbox.dialog({
            title: `Cliente: ${order.name} `,
            id: 'modalAdvance',
            closeButton: true,
            message: '<div id="containerChat"></div>'
        }).on('shown.bs.modal', () => $('.modal-body').css('min-height', '530px'));

        this.tabLayout({
            parent: 'containerChat',
            theme: 'dark',
            class: '',
            json: [
                { id: 'payment', tab: 'Pagos', icon: '', active: true },
                { id: 'listPayment', tab: 'Lista de pagos', onClick: () => { } }
            ]
        });

        // Renders     
        $('#container-listPayment').html(`
            <div id="container-info-payment"></div>
            <div id="container-methodPay"></div>
        `);

        this.addPayment(order, id);
        this.renderResumenPagos(data.details);
        this.lsPay(id);
    }

    async addPayment(order, id) {
        // Totales base
        this.totalPay = order.total_pay;
        this.totalPaid = order.total_paid;

        const saldoOriginal = order.total_pay;
        const saldoRestante = order.total_pay - order.total_paid;

        // Contenedor del formulario
        $("#container-payment").html(`<form id="form-payment" novalidate></form>`);

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
                    <div id="dueAmount" class="p-4 rounded-xl bg-[#1E293B] text-white text-center">
                        <p class="text-sm opacity-80">Monto restante a pagar</p>
                        <p id="SaldoEvent" class="text-2xl font-bold mt-1">
                            ${formatPrice(saldoRestante)}
                        </p>
                    </div>`
                },
                {
                    opc: "input",
                    type: "number",
                    id: "advanced_pay",
                    lbl: "Importe",
                    class: "col-12 mb-3 mt-2",
                    placeholder: "0.00",
                    required: true,
                    min: 0,
                    onkeyup: "app.updateTotal()"
                },
                {
                    opc: "select",
                    id: "method_pay_id",
                    lbl: "Método de pago del anticipo",
                    class: "col-12 mb-3",
                    data: [
                        { id: "1", valor: "Efectivo" },
                        { id: "2", valor: "Tarjeta" },
                        { id: "3", valor: "Transferencia" }
                    ],
                    required: true
                },
                {
                    opc: "textarea",
                    id: "description",
                    lbl: "Observación",
                    class: "col-12 mb-3"
                },
                {
                    opc: "btn-submit",
                    id: "btnSuccess",
                    class: "col-12",
                    text: "Aceptar"
                }
            ],
            success: async (response) => {
                if (response.status === 200) {

                    const data = response.data;

                    // ✅ Alert con cierre automático
                    alert({
                        icon: "success",
                        text: "Pago registrado correctamente ✅",
                        timer: 1000
                    });

                    // Refrescar pagos y vista general
                    this.lsPay(id);
                    this.ls();
                    this.renderResumenPagos(data.details);

                    // Recalcular saldo restante sin redibujar

                    const order = data.order;
                    const restante2 = order.total_pay - order.total_paid;
                    this.totalPay = order.total_pay;
                    this.totalPaid = order.total_paid;

                    $("#SaldoEvent").text(formatPrice(restante2));
                    $("#advanced_pay").val("");
                    $("#description").val("");
                    app.updateTotal();

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
    }

    deletePay(id, idFolio) {
        const row = event.target.closest("tr");
        const raw = row.cells[2].textContent;
        const clean = raw.replace(/[^\d.-]/g, "");
        const amount = parseFloat(clean);

        this.swalQuestion({
            opts: {
                title: "¿Confirmar eliminación?",
                text: `Se eliminará el pago de ${formatPrice(amount)} de forma permanente.`,
                icon: "warning"
            },
            data: { opc: "deletePay", id: idFolio, idPay: id },
            methods: {
                success: (res) => {
                    const data = res.initHistoryPay;

                    if (res.status === 200) {

                        this.renderResumenPagos(data.details);
                        this.lsPay(idFolio);
                        this.ls();
                    } else {
                        alert({ icon: "error", text: res.message });
                    }
                }
            }
        });
    }

    lsPay(id) {

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
                right: [4,],
                extends: true,
            },
        });

    }

    renderResumenPagos(totales) {
        const totalPagado = totales?.pagado ?? 0;
        const discount = totales?.discount ?? 0;
        const totalEvento = totales?.total ?? 0;

        // El total sin descuento es el total actual + lo descontado
        const totalConDescuento = totalEvento - discount;
        const restante = totalConDescuento - totalPagado;

        // Formateador de moneda
        const fmt = (n) => n.toLocaleString('es-MX', {
            style: 'currency',
            currency: 'MXN',
            minimumFractionDigits: 2
        });

        let originalHTML = `<p class="text-lg font-bold text-blue-900" id="totalEvento">${fmt(totalEvento)}</p>`;

        // Si hay descuento, mostrar desglose visual
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


    // Components.
    detailCard(options = {}) {
        const defaults = {
            parent: "body",
            title: "",
            subtitle: "",
            class: "space-y-2",
            data: [],
        };

        const opts = Object.assign({}, defaults, options);

        const isCols2 = opts.class.includes("cols-2");
        let contentClass = isCols2
            ? `grid grid-cols-2 ${opts.class.replace("cols-2", "")}`
            : `flex flex-col ${opts.class}`;

        let infoHtml = `<div class="${contentClass}">`;

        opts.data.forEach(item => {
            if (item.type === "div") {
                infoHtml += `<div class="${item.class || ''}">${item.html || ''}</div>`;
            } else if (item.type === "status") {
                infoHtml += `
                <div class="flex items-center mb-1">
                    <span class="text-gray-400 font-medium flex items-center text-base">
                        ${item.icon ? `<i class="${item.icon} mr-2"></i>` : ""}
                        ${item.text}:
                    </span>
                    <span class="ml-2 px-3 py-1 rounded-full text-xs font-bold ${item.color || "bg-gray-500"}">${item.value}</span>
                </div>
            `;
            } else if (item.type === "observacion") {
                infoHtml += `
                <div class="col-span-2 mt-2">
                    <label class="text-gray-400 font-medium text-base mb-1 block">${item.text || "Observación"}:</label>
                    <div class="bg-[#28324c] rounded p-3 text-gray-300 min-h-[80px]">${item.value || ""}</div>
                </div>
            `;
            } else {
                infoHtml += `
                <div class="flex items-center mb-1">
                    <span class="text-gray-400 font-medium flex items-center text-base">
                        ${item.icon ? `<i class="${item.icon} mr-2"></i>` : ""}
                        ${item.text}:
                    </span>
                    <span class="ml-2 font-semibold text-white text-base">${item.value}</span>
                </div>
            `;
            }
        });

        infoHtml += `</div>`;

        const html = `
        <div class="text-white rounded-xl p-3 min-w-[320px]">
            ${infoHtml}
        </div>
    `;

        $(`#${opts.parent}`).html(html);
    }


    updateTotal(total, totalPaid) {
        const val = parseFloat($("#advanced_pay").val()) || 0;
        const t = typeof total === 'number' ? total : (this.totalPay || 0);
        const tp = typeof totalPaid === 'number' ? totalPaid : (this.totalPaid || 0);
        const restante = (t - (tp || 0)) - val;
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

    // Ver pedido .

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
                    active: true,
                },
                {
                    id: "order",
                    tab: "Pedido",
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

            <div class="bg-[#1E293B] rounded-lg p-3">
            <p class="text-gray-400 text-sm mb-2">Observación:</p>
            <p class="text-gray-300">${d.note ?? ''}</p>
            </div>

            <div class="bg-[#1E293B] rounded-lg p-3">
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
                <div class="bg-[#1F2A37] rounded-lg p-3">
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
            html = products.map(product => {
                // Determinar si es producto personalizado basado en custom_id
                const isCustom = product.custom_id && product.custom_id !== null;

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
                                
                                ${product.data_custom ? `
                                <div class="bg-purple-800/30 border border-purple-400/40 rounded-md p-2 mb-3">
                                    <div class="flex items-start gap-2">
                                        <i class="icon-user text-purple-300 text-sm mt-1"></i>
                                        <div class="flex-1">
                                            <p class="text-purple-300 text-sm font-medium mb-1">👤 Tipo de personalización:</p>
                                            <p class="text-gray-200 text-sm font-semibold">${product.data_custom}</p>
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



}

class Order extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "Pedidos";
    }

    // Orders.
    async showOrder(id, category) {
        // let response = await useFetch({
        //     url: this._link,
        //     data: { opc: "getByIdCalendario", id: id, category: category },
        // });

        // let event = response.data.event || {};
        // let menuList = response.data.menu || [];
        // let extras = response.data.extras || [];

        // let metodoPago = "N/A";
        // if (event.method_pay_id == 1) {
        //     metodoPago = "Efectivo";
        // } else if (event.method_pay_id == 2) {
        //     metodoPago = "Tarjeta";
        // } else if (event.method_pay_id == 3) {
        //     metodoPago = "Transferencia";
        // }

        // // 📦 Datos del evento
        let titulo = event.name_event || "N/A";
        let locacion = event.location || "N/A";
        // let status = this.eventStatus(event.status);
        // let fechaCreacion = event.date_creation ? formatSpanishDate(event.date_creation) : "N/A";
        // let fechaInicio = event.date_start ? formatSpanishDate(event.date_start) : "N/A";
        // let horaInicio = event.time_start || "";
        // let fechaFin = event.date_end ? formatSpanishDate(event.date_end) : "N/A";
        // let horaFin = event.time_end || "";
        // let cliente = event.name_client || "N/A";
        // let telefono = event.phone || "N/A";
        // let correo = event.email || "N/A";
        // let tipoEvento = event.type_event || "N/A";
        // let cantidadPersonas = event.quantity_people || "N/A";
        // let notes = event.notes || "";
        let icon = "📆";

        // 📋 Render modal
        // <h5>${icon} ${titulo}</h5>

        bootbox.dialog({
            title: `
            <div>
                <p class="font-11 text-muted mb-0 pb-0 mt-1"><i class="icon-location-6"></i>${locacion}</p>
            </div>`,
            size: '',
            closeButton: true,
            message: `
            <div id="container-details" class= " "></div>
        `
        }).on("shown.bs.modal", function () {
            $('.modal-body').css('min-height', '520px');
        });

        // if (category == "Evento") {
        //     // Contenido del modal
        this.tabLayout({
            parent: "container-details",
            id: "tabComponent",
            content: { class: "" },
            theme: "dark",
            json: [
                { id: "order", tab: "Order", active: true },
                { id: "menu", tab: "Menú" },
            ],
        });
        // } else {
        //     // Contenido del modal
        //     this.tabLayout({
        //         parent: "container-menu-details",
        //         id: "tabComponent",
        //         content: { class: "" },
        //         theme: "dark",
        //         json: [
        //             { id: "event", tab: "Evento", active: true },
        //             { id: "subeventos", tab: "Subeventos" },
        //         ],
        //     });
        // }

        // // 🎨 Diseño de evento
        // let eventDetails = `
        //     <div class="">
        //         <div class="mb-3"><strong><i class="icon-spinner"></i> Estado:</strong> ${status}</div>
        //         <div class="mb-3"><strong><i class="icon-clock"></i> Fecha creación:</strong> <small>${fechaCreacion}</small></div>
        //         <div class="mb-3"><strong><i class="icon-calendar"></i> Fecha:</strong> <small>${fechaInicio} ${horaInicio} al ${fechaFin} ${horaFin}</small></div>
        //         <div class="mb-3"><strong><i class="icon-user-5"></i> Cliente:</strong> <small>${cliente}</small></div>
        //         <div class="mb-3"><strong><i class="icon-phone"></i> Teléfono:</strong> <small>${telefono}</small></div>
        //         <div class="mb-3"><strong><i class="icon-mail"></i> Correo:</strong> <small>${correo}</small></div>
        //         <div class="mb-3"><strong><i class="icon-tags-2"></i> Tipo de evento:</strong> <small>${tipoEvento}</small></div>
        //         <div class="mb-3"><strong><i class="icon-users-2"></i> Total de personas:</strong> <small>${cantidadPersonas}</small></div>
        //         <div class="mb-3"><strong><i class="icon-money"></i> Forma de pago (anticipo):</strong> <small>${metodoPago}</small></div>

        //         <hr class="mt-3">
        //         <div class="text-sm min-h-12 bg-[#333D4C] flex flex-col justify-center pe-3 ps-3 pb-3 pt-2 rounded-bl-lg rounded-br-lg">
        //             <p class="text-gray-300 mb-1">Notas:</p>
        //             <p class="">${notes || ''}</p>
        //         </div>

        //     </div>`;

        // $("#container-event").html(eventDetails);

        // if (category == "Evento") {
        //     // Calcular el total de paquetes
        //     const totalPaquetes = menuList.reduce((sum, pkg) => sum + (parseFloat(pkg.price) || 0), 0);

        //     // Calcular el total de extras
        //     const totalExtras = (Array.isArray(extras) && extras.length > 0)
        //         ? extras.reduce((sum, extra) => sum + (parseFloat(extra.price) || 0), 0)
        //         : 0;

        //     // Calcular el total general
        //     const totalGeneral = totalPaquetes + totalExtras;

        //     const extrasHtml = (Array.isArray(extras) && extras.length > 0)
        //         ? `<div class="mt-4">
        //         <h3 class="text-sm font-semibold text-white mb-2">Extras</h3>
        //         ${extras.map(extra => `
        //             <div class="flex justify-between items-center text-xs text-white py-1 border-b border-dashed">
        //                 <span class="w-1/4 text-left">(${extra.quantity || 0})</span>
        //                 <span class="w-1/2 text-start">${extra.name || ""}</span>
        //                 <span class="w-1/4 text-right">$${extra.price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        //             </div>
        //         `).join("")}
        //         </div>` : "";

        //     let menuVisual = `
        //     <div class="text-xs mt-3">
        //         <h3 class="text-sm font-bold text-white mb-2">Menú</h3>
        //         <div class="flex justify-between text-[13px] text-white font-semibold border-b pb-1 mb-2">
        //         <div class="w-1/4 text-left"><i class="icon-basket-alt"></i> Cantidad</div>
        //         <div class="w-1/2 text-center"><i class="icon-dropbox"></i> Paquete</div>
        //         <div class="w-1/4 text-right"><i class="icon-dollar"></i> Precio</div>
        //         </div>
        //         ${menuList.map(pkg => `
        //             <div class="mb-3">
        //                 <div class="flex justify-between text-white font-medium py-1 border-b border-dashed">
        //                     <div class="w-1/4 text-left">(${pkg.quantity})</div>
        //                     <div class="w-1/2 text-start">${pkg.name}</div>
        //                     <div class="w-1/4 text-right">$${parseFloat(pkg.price).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        //                 </div>
        //                 ${Array.isArray(pkg.dishes) && pkg.dishes.length > 0 ? `
        //                 <ul class="text-xs text-white pl-4 mt-1">
        //                     ${pkg.dishes.map(d => `<li>- ${d.quantity} ${d.name}</li>`).join("")}
        //                 </ul>
        //                 ` : ""}
        //             </div>
        //         `).join("")}
        //         ${extrasHtml}
        //         <!-- Total en la parte inferior derecha -->
        //         <div class="mt-4 pt-3">
        //             <div class="flex justify-end">
        //                 <div class="text-white text-lg font-bold">
        //                     Total: $${totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        //                 </div>
        //             </div>
        //         </div>
        //     </div>
        //     `;

        //     $("#container-menu").html(menuVisual);
        // }

        // else {
        //     let html = response.data.subevents.map((sub) => `
        //         <div class="border rounded-lg shadow mb-3 bg-[#1F2A37] text-sm text-gray-200">
        //             <div class="cursor-pointer px-4 py-3 flex justify-between items-center bg-[#1F2937] hover:bg-[#19232D] transition-colors duration-200"
        //                 onclick="eventos.toggleSubeventoDetails('subevent-${sub.id}', this)">
        //                 <div class="flex items-center gap-2">
        //                     <i class="icon-right-open-big transition-transform duration-300 transform"></i>
        //                     🎯
        //                     <div>
        //                         <span class="font-bold text-md">${sub.name}</span>
        //                         <p class="text-xs text-gray-400"><i class="icon-location-6"></i>${sub.location}</p>
        //                     </div>
        //                 </div>
        //                 <div class="text-xs text-gray-400">
        //                     ${sub.date_start} - ${sub.time_start}
        //                 </div>
        //             </div>

        //             <div id="subevent-${sub.id}" class="hidden px-4 py-3 bg-[#1F2937] rounded-b-lg">
        //                 <div id="tabsSubEvent-${sub.id}" class="pt-2"></div>
        //             </div>
        //         </div>
        //     `).join('');

        //     $("#container-subeventos").removeClass("p-3").html(html);

        //     response.data.subevents.forEach((sub) => {
        //         // Tabs
        //         app.tabLayout({
        //             parent: `tabsSubEvent-${sub.id}`,
        //             id: `tab-${sub.id}`,
        //             content: { class: "" },
        //             theme: "dark",
        //             json: [
        //                 { id: `detalles-${sub.id}`, tab: "Detalles", active: true },
        //                 { id: `menu-${sub.id}`, tab: "Menú" },
        //             ],
        //         });

        //         $(`#container-detalles-${sub.id}`).removeClass("p-3");
        //         $(`#container-menu-${sub.id}`).removeClass("p-3");

        //         let estadoHtml = eventos.showStatusSubevent(sub.status_process_id);
        //         let money = formatPrice(sub.total_pay);

        //         // <p class="inline-flex me-1 mb-3"><strong><i class="icon-spinner"></i>Estado:</strong>${estadoHtml}</p>
        //         // Contenido de Detalles
        //         $(`#container-detalles-${sub.id}`).html(`
        //             <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
        //                 <div class="space-y-1">
        //                     <p class="mb-3"><strong><i class="icon-clock"></i>Hora:</strong> De ${sub.time_start} a ${sub.time_end}</p>
        //                     <p class="mb-2"><strong><i class="icon-cube"></i>Tipo de evento:</strong> ${sub.type}</p>
        //                 </div>
        //                 <div class="space-y-1">
        //                     <p class="mb-3"><strong><i class="icon-users-1"></i>Total de personas:</strong> ${sub.quantity_people}</p>
        //                     <p class="mb-2"><strong><i class="icon-money-1"></i>Total:</strong> ${money || 0}</p>
        //                 </div>
        //             </div>
        //             <hr class="mt-3 text-gray-300">
        //             <div class="text-sm min-h-12 bg-[#333D4C] flex flex-col justify-center pe-3 ps-3 pb-3 pt-2 rounded-bl-lg rounded-br-lg text-gray-300">
        //                 <p class="mb-1"><strong>Notas:</strong></p>
        //                 <p class="text-gray-300">${notes || ""}</p>
        //             </div>
        //         `);
        //         const totalPaquetes = (sub.menu && Array.isArray(sub.menu))
        //             ? sub.menu.reduce((sum, pkg) => sum + (parseFloat(pkg.price) || 0), 0)
        //             : 0;
        //         const totalExtras = (Array.isArray(sub.extras) && sub.extras.length > 0)
        //             ? sub.extras.reduce((sum, extra) => sum + (parseFloat(extra.price) || 0), 0)
        //             : 0;
        //         // Total general
        //         const totalGeneral = totalPaquetes + totalExtras;
        //         // Contenido del Menú
        //         const extrasHtml = (Array.isArray(sub.extras) && sub.extras.length > 0)
        //             ? `<div class="mt-4">
        //             <h3 class="text-sm font-semibold text-gray-300 mb-2">Extras</h3>
        //             ${sub.extras.map(extra => `
        //                 <div class="flex justify-between items-center text-xs text-gray-300 py-1 border-b border-dashed">
        //                     <span class="w-1/4 text-left">(${extra.quantity || 0})</span>
        //                     <span class="w-1/2 text-start">${extra.name || ""}</span>
        //                     <span class="w-1/4 text-right">$${parseFloat(extra.price).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        //                 </div>
        //             `).join("")}
        //         </div>` : "";

        //         const menuHtml = `
        //             <div class="text-xs mt-3">
        //                 <h3 class="text-sm font-bold text-gray-300 mb-2">Menú</h3>
        //                 <div class="flex justify-between text-[13px] text-gray-300 font-semibold border-b pb-1 mb-2">
        //                     <div class="w-1/4 text-left"><i class="icon-basket-alt"></i> Cantidad</div>
        //                     <div class="w-1/2 text-center"><i class="icon-dropbox"></i> Paquete</div>
        //                     <div class="w-1/4 text-right"><i class="icon-dollar"></i> Precio</div>
        //                 </div>
        //                 ${sub.menu.map(pkg => `
        //                     <div class="mb-3">
        //                         <div class="flex justify-between text-gray-300 font-medium py-1 border-b border-dashed">
        //                             <div class="w-1/4 text-left">(${pkg.quantity})</div>
        //                             <div class="w-1/2 text-start">${pkg.name}</div>
        //                             <div class="w-1/4 text-right">$${parseFloat(pkg.price).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        //                         </div>
        //                         ${Array.isArray(pkg.dishes) && pkg.dishes.length > 0 ? `
        //                         <ul class="text-xs text-gray-300 pl-4 mt-1">
        //                             ${pkg.dishes.map(d => `<li>- ${d.quantity} ${d.name}</li>`).join("")}
        //                         </ul>
        //                         ` : ""}
        //                     </div>
        //                 `).join("")}
        //                 ${extrasHtml}
        //                 <!-- Total en la parte inferior derecha -->
        //                 <div class="mt-4 pt-3">
        //                     <div class="flex justify-end">
        //                         <div class="text-white text-lg font-bold">
        //                             Total: $${totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        //                         </div>
        //                     </div>
        //                 </div>
        //             </div>
        //         `;

        //         $(`#container-menu-${sub.id}`).html(menuHtml);

        //     });

        // }

    }



    // Payments.

    addPayment(id) {

        let tr = $(event.target).closest("tr");

        // Obtiene la celda de la cantidad (columna 5)
        let saldo = tr.find("td").eq(5).text();
        let saldoOriginal = tr.find("td").eq(5).text().replace(/[^0-9.-]+/g, "");
        let total = parseFloat(saldoOriginal);

        this.createModalForm({
            id: "modalRegisterPayment",
            bootbox: { title: "Registrar Pago", id: "registerPaymentModal", size: "medium" },
            data: { opc: 'addPayment', total: total, evt_events_id: id },
            json: [
                {
                    opc: "input",
                    type: "number",
                    id: "pay",
                    lbl: "Pago",
                    class: "col-12 mb-3",
                    placeholder: "$ 0",
                    required: true,
                    min: 0, // 📛 Evita valores negativos desde el input
                    onkeyup: 'payment.updateSaldoEvent(' + saldoOriginal + ')'
                },
                {
                    opc: "select",
                    id: "type",
                    lbl: "Tipo de pago",
                    class: "col-12 mb-3",
                    data: [
                        { id: "2", valor: "Anticipo" },
                        { id: "1", valor: "Abono" },

                    ],
                    required: true
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
                    required: true
                },
                {
                    opc: "div",
                    id: "dueAmount",
                    class: "col-12 text-center bg-gray-800 text-white p-2 rounded",
                    html: `<strong>Adeudado</strong><br> <span id="SaldoEvent">${saldo}</span>`
                }
            ],
            success: (response) => {
                if (response.status == 200) {
                    alert({ icon: "success", text: response.message, btn1: true, btn1Text: "Ok" });
                    app.ls();
                } else {
                    alert({ icon: "error", text: response.message, btn1: true, btn1Text: "Ok" });
                }
            }
        });

        $("#btnSuccess").addClass("text-white");
        $("#btnExit").addClass("text-white");
    }

    updateSaldoEvent(saldo) {
        let payInput = document.getElementById("pay");
        let saldoElement = document.getElementById("SaldoEvent");
        let pagarBtn = document.querySelector(".bootbox .btn-primary");

        if (payInput && saldoElement && pagarBtn) {
            let saldoOriginal = parseFloat(saldo) || 0;
            let pago = parseFloat(payInput.value) || 0;

            // ⛔ Bloquear si el valor es negativo
            if (pago < 0) {
                payInput.value = 0;
                pago = 0;
            }

            let nuevoSaldo = saldoOriginal - pago;

            saldoElement.textContent = formatPrice(nuevoSaldo);

            if (nuevoSaldo < 0) {
                saldoElement.classList.add("text-danger");
            } else {
                saldoElement.classList.remove("text-danger");
            }

            pagarBtn.disabled = nuevoSaldo < 0 || pago <= 0;
        }
    }

}


