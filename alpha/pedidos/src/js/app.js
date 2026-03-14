let api = 'ctrl/ctrl-pedidos.php';
let api_catalogo = 'ctrl/ctrl-pedidos-catalogo.php';
let api_custom = 'ctrl/ctrl-pedidos-personalizado.php';

let normal, app, custom; //Clases.
let idFolio, sub_name;
let categories, estado, clients;

let rol, subsidiaries, udn;
let dailyClosure = { is_closed: false };

$(async () => {
    let dataModifiers = await useFetch({ url: api, data: { opc: "getModifiers" } });
    categories = dataModifiers.data || [];

    const req          = await useFetch({ url: api, data: { opc: "init" } });
          estado       = req.status;
          clients      = req.clients || [];
          rol          = req.access;
          sub_name     = req.subsidiaries_name;
          subsidiaries = req.sucursales;
          dailyClosure = req.daily_closure || { is_closed: false };
          app          = new App(api, 'root');
          custom       = new CustomOrder(api_custom, 'root');
          normal       = new CatalogProduct(api_catalogo, 'root');

    app.render();



    setInterval(() => {
        app.actualizarFechaHora({ label: sub_name });
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
        this.actualizarFechaHora({ label: sub_name });
        // this.updateDailyClosureStatus();
    }

    layout() {
        this.primaryLayout({
            parent: "root",
            id: this.PROJECT_NAME,
            class: 'flex mx-2  p-2 ',
            heightPreset: 'viewport',
            card: {
                filterBar: { class: 'w-full ', id: 'filterBar' },
                container: { class: 'w-full my-2 bg-[#1F2A37] h-screen rounded p-3', id: 'container' + this.PROJECT_NAME }
            }
        });

        // Filter bar.
        $('#filterBar').html(`
            <div id="filterBar${this.PROJECT_NAME}" class="w-full my-3 " ></div>
            <div id="containerHours"></div>
        `);
    }

    createFilterBar() {

        let filterBar = [];

        // Agregar select de admin solo si rol == 1
        if (rol == 1) {
            filterBar.push({
                opc: "select",
                id: "subsidiaries_id",
                lbl: "Filtrar por sucursal:",
                class: "col-12 col-md-3 col-lg-2",
                onchange: "app.onSubsidiaryChange()",
                data: [
                    { id: "0", valor: "Todas las sucursales" },
                    ...subsidiaries
                ]
            });
        }

        filterBar.push(
            {
                opc: "input-calendar",
                class: "col-12 col-md-3 col-lg-2",
                id: "calendar",
                lbl: "Consultar fecha: ",
            },
            {
                opc: "select",
                id: "status",
                lbl: "Seleccionar estados:",
                class: "col-12 col-md-3 col-lg-2",
                onchange: "app.ls()",
                data: [
                    { id: "", valor: "Todos los estados" },
                    ...estado
                ]
            }
        );

        filterBar.push(
            {
                opc: 'button',
                id: 'btnNuevoPedido',
                class: 'col-6 col-md-3 col-lg-2',
                text: 'Nuevo Pedido',
                icon: 'icon-plus',
                className: 'btn-primary w-100',
                onClick: () => this.showTypePedido()
            },
            {
                opc: "button",
                id: "btnDailyClose",
                text: "Cierre del día",
                class: "col-6 col-md-3 col-lg-2",
                className: 'w-100',
                color_btn: 'success',
                icon: "icon-receipt",
                onClick: () => this.printDailyClose()
            },
            {
                opc: "button",
                className: "w-100",
                class: "col-12 col-md-3 col-lg-2",
                color_btn: "secondary",
                id: "btnCalendario",
                text: "Calendario",
                icon: "icon-calendar",
                onClick: () => {
                    window.location.href = '../pedidos/calendario/index.php'
                }
            }
        );


        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: filterBar
        });

        dataPicker({
            parent: "calendar",
            rangepicker: {
                startDate: moment().startOf("month"), // Inicia con el primer día del mes actual
                endDate: moment().endOf("month"), // Finaliza con el último día del mes actual
                showDropdowns: true,
                ranges: {
                    "Hoy": [moment(), moment()],
                    "Ayer": [moment().subtract(1, "days"), moment().subtract(1, "days")],
                 
                    "Semana actual": [moment().startOf("week"), moment().endOf("week")],
                    "Mes actual": [moment().startOf("month"), moment().endOf("month")],
                    // "Próxima semana": [moment().add(1, "week").startOf("week"), moment().add(1, "week").endOf("week")],
                    // "Próximo mes": [moment().add(1, "month").startOf("month"), moment().add(1, "month").endOf("month")],
                    "Mes anterior": [moment().subtract(1, "month").startOf("month"), moment().subtract(1, "month").endOf("month")],
                    
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
            label: "Sucursal:",
        };
        let opts = Object.assign({}, opciones, options);
        let fechaFormateada = fecha.toLocaleString("es-ES", opts);

        let div = $("<div>", {
            class: "flex justify-between border-b border-gray-300 mt-2 mb-3",
        }).append(

            $("<label>", {
                html: '<i class=" icon-location-8"></i> ' + opts.label,
                class: "text-xs font-medium text-gray-600 text-left flex-1",
                css: { 'font-size': '1rem', 'align-items': 'center', 'display': 'flex' }
            }),
            $("<label>", {
                text: fechaFormateada,
                class: "text-uppercase text-end font-semibold mb-2",
            })
        );

        $(`#${opts.parent}`).html(div);
    }

    async onSubsidiaryChange() {
        this.ls();
        await this.checkAndUpdateDailyClosure();
    }

    async checkAndUpdateDailyClosure() {
        let subsidiaries_id = rol == 1 ? $('#subsidiaries_id').val() : null;
        
        if (subsidiaries_id === '0') {
            this.enableNewOrderButton();
            return;
        }

        const request = await useFetch({
            url: this._link,
            data: { opc: "checkDailyClosure", subsidiaries_id: subsidiaries_id }
        });

        dailyClosure = request || { is_closed: false };
        this.updateDailyClosureStatus();
    }

    updateDailyClosureStatus() {
        const btn = $('#btnNuevoPedido');
        
        if (dailyClosure.is_closed) {
            btn.prop('disabled', true)
               .removeClass('btn-primary')
               .addClass('btn-secondary opacity-50 cursor-not-allowed')
               .attr('title', 'Ya se realizó el cierre del día');
            
            if ($('#dailyClosureAlert').length === 0) {
                const alertHtml = `
                    <div id="dailyClosureAlert" class="bg-yellow-900/50 border border-yellow-600 text-yellow-200 px-4 py-2 rounded-lg mb-3 flex items-center gap-2">
                        <i class="icon-lock text-yellow-400"></i>
                        <span>
                            <strong>Cierre del día realizado.</strong> 
                            No se pueden crear nuevos pedidos para hoy.
                            ${dailyClosure.closed_by ? `<br><small class="text-yellow-400">Cerrado por: ${dailyClosure.closed_by}</small>` : ''}
                        </span>
                    </div>
                `;
                $('#containerHours').after(alertHtml);
            }
        } else {
            this.enableNewOrderButton();
        }
    }

    enableNewOrderButton() {
        $('#btnNuevoPedido')
            .prop('disabled', false)
            .removeClass('btn-secondary opacity-50 cursor-not-allowed')
            .addClass('btn-primary')
            .attr('title', '');
        
        $('#dailyClosureAlert').remove();
    }

    showTypePedido() {
        if (dailyClosure.is_closed) {
            alert({
                icon: "warning",
                title: "Cierre del día realizado",
                text: "No se pueden crear nuevos pedidos porque ya se realizó el cierre del día para esta sucursal.",
                btn1: true,
                btn1Text: "Entendido"
            });
            return;
        }
        normal.render();
    }

    // Orders.

    ls() {
        let rangePicker = getDataRangePicker("calendar");
        this.createTable({
            parent: `container${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: "listOrders", fi: rangePicker.fi, ff: rangePicker.ff },
            conf: {
                datatable: true, pag: 10, fn_datatable: 'simple_data_table_filter',
            },
            coffeesoft: true,

            attr: {
                id: `tb${this.PROJECT_NAME}`,
                theme: 'dark',
                center: [1, 2, 7, 8, 9, 10, 11],
                extends: true,
                f_size:12,
            },
        });
    }

    addOrder() {

      

        normal.layoutEdit = false;
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
                    $("#subsidiaryFilter").prop("disabled", true);


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
        $('#radioDeliveryType').removeClass('col-12 col-lg-6');
        $('#subsidiaryFilter').removeClass('col-12 offset-10 col-lg-2 mb-1');
        $('#subsidiaryFilter').prev('label').remove();

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
        normal.layoutEdit = true;
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

                    this.getListClients();

                    // 🔒 Bloquear campos tras guardar
                    // $("#formPedido :input, #formPedido textarea").prop("disabled", true);

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

                    normal.initPos();

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

        $('#radioDeliveryType').removeClass('col-12 col-lg-6');
        $('#subsidiaryFilter').removeClass('col-12 offset-10 col-lg-2 mb-1');
        $('#subsidiaryFilter').prev('label').remove(); $("#date_order").val(new Date().toISOString().split("T")[0]);
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

        // ✅ Asignar radio seleccionado
        // console.log(order.delivery_type);
        // $(`input[name="delivery_type"][value="${order.delivery_type}"]`).prop("checked", true);

        // 🔄 Si borra el nombre, limpiar teléfono y correo
        $('#formPedido #name').on("input", function () {
            if ($(this).val().trim() === "") {
                $('#formPedido #phone').val("");
                $('#formPedido #email').val("");
            }
        });
    }

    cancelOrder(id) {
        const row = event.target.closest('tr');
        const folio = row.querySelectorAll('td')[0]?.innerText || '';

        this.swalQuestion({
            opts: {
                title: `¿Esta seguro?`,
                html: `¿Deseas cancelar el pedido con folio <strong>${folio}</strong>?
                Esta acción actualizará el estado a "Cancelado".`,
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

    deleteOrder(id) {
        const row = event.target.closest('tr');
        const folio = row.querySelectorAll('td')[0]?.innerText || '';

        this.swalQuestion({
            opts: {
                title: `¿Eliminar pedido?`,
                html: `¿Estás seguro de eliminar el pedido con folio <strong>${folio}</strong>?
                <br><br>
                <span class="text-red-500">⚠️ Esta acción es permanente y no se puede deshacer.</span>`,
                icon: "warning",
            },
            data: { opc: "deleteOrder", id: id },
            methods: {
                request: (data) => {
                    alert({
                        icon: "success",
                        title: "Eliminado",
                        text: "El pedido fue eliminado correctamente.",
                        btn1: true
                    });
                    this.ls();
                },
            },
        });
    }

    // Descuentos.

    async addDiscount(id) {
        const discountInfo = await useFetch({
            url: this._link,
            data: { opc: "getDiscount", id: id }
        });

        const totalPay = parseFloat(discountInfo.data?.total_pay) || 0;
        const currentDiscount = parseFloat(discountInfo.data?.discount) || 0;
        const hasDiscount = currentDiscount > 0;

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
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        title: "Descuento aplicado",
                        text: response.message,
                        btn1: true
                    });
                    this.ls();
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
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        title: "Descuento eliminado",
                        text: response.message,
                        btn1: true
                    });
                    this.ls();
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
            url: this._link,
            data: { opc: "getDiscount", id: id }
        });

        const data = discountInfo.data || {};
        const totalPay = parseFloat(data.total_pay) || 0;

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
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        title: "Descuento actualizado",
                        text: response.message,
                        btn1: true
                    });
                    this.ls();
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
        this.swalQuestion({
            opts: {
                title: '¿Eliminar descuento?',
                html: `¿Estás seguro de eliminar el descuento de este pedido?
                <br><br>
                <span class="text-yellow-500">⚠️ El total del pedido volverá a su valor original.</span>`,
                icon: 'warning'
            },
            data: { opc: 'deleteDiscount', id: id },
            methods: {
                request: (response) => {
                    alert({
                        icon: 'success',
                        title: 'Descuento eliminado',
                        text: response.message,
                        btn1: true
                    });
                    this.ls();
                }
            }
        });
    }

    async printOrder(id) {

        const pos = await useFetch({
            url: api,
            data: { opc: "getOrderDetails", id: id }
        });

        const modal = bootbox.dialog({
            closeButton: true,
            // size: 'large',
            title: ` <div class="flex items-center gap-2 text-white text-lg font-semibold">
                        <i class="icon-print text-blue-400 text-xl"></i>
                        Imprimir
                    </div>`,
            message: `
                <div class="p-2">
                    <div id="containerPrintOrder"></div>
                </div>
            `
        });



        normal.ticketPasteleria({
            parent: 'containerPrintOrder',
            data: {
                head: pos.data.order,
                products: pos.data.products,
                paymentMethods: pos.data.paymentMethods || [],
                clausules: pos.data.clausules || []
            }
        })

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

                if (response.status === 200) {
                    this.ls();
                    alert({
                        icon: 'success',
                        title: 'Estado actualizado',
                        text: response.message,
                        timer: 2000,
                        showConfirmButton: false
                    });
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

   jsonOrder() {
    const orderFields = [];



    if (rol == 1) {
        orderFields.push({
            opc: "div",
            id: "subsidiaryFilter",
            lbl: "",
            class: "col-12 offset-10 col-lg-2 mb-1",
            html: `
                <div class="flex flex-col gap-1 bg-purple-500/10 px-3 py-2 rounded-md shadow-sm w-full">
                    <label for="subsidiaries_id" class="text-sm font-medium text-white">Sucursal:</label>
                    <select id="subsidiaries_id" name="subsidiaries_id" class="w-full text-xs border border-purple-300 rounded-md px-2 py-1 focus:ring-1 focus:ring-purple-400 focus:border-purple-400">
                        ${subsidiaries.map(sub => `<option value="${sub.id}">${sub.valor}</option>`).join('')}
                    </select>
                </div>
            `
        });
    }

    orderFields.push(
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
            opc: "div",
            id: "radioDeliveryType",
            lbl: "Tipo de entrega",
            class: "col-12 col-lg-6",
            html: `
                <div class="form-check form-check-inline col-sm-3  mt-2 ">
                    <input
                        class="form-check-input me-2"
                        type="radio"
                        name="delivery_type"
                        id="local"
                        value=0
                        onclick="this.value='0'"
                        checked
                    >
                    <label class="form-check-label" for="local">Local</label>
                </div>
                <div class="form-check form-check-inline col-sm-3  mt-2  ">
                    <input
                        class="form-check-input me-2"
                        type="radio"
                        name="delivery_type"
                        id="domicilio"
                        onclick="this.value='1'"
                        value=1
                    >
                    <label class="form-check-label" for="domicilio">A domicilio</label>
                </div>
            `
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
        }
    );

        return orderFields;
   }


    async getListClients(){
       const response = await useFetch({
           url: api,
           data: { opc: "getListClients" }
       });

       if (response.status === 200) {
           clients = response.data; // Actualiza la variable global
           console.log(clients)
       }
   }



    // Payments.

    async historyPay(id) {

        const data = await useFetch({ url: this._link, data: { opc: 'initHistoryPay', id } });
        const order = data.order;

        // Modal con información mejorada
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
                { id: 'payment', tab: 'Registrar Pago', icon: 'icon-plus-circled', active: true },
                { id: 'listPayment', tab: 'Historial de Pagos', icon: 'icon-list', onClick: () => { } },
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
        this.discount = order.discount ?? 0;

        const saldoOriginal = order.total_pay;
        const discount = order.discount ?? 0;
        const saldoRestante = order.total_pay - discount - order.total_paid;
        const isPaidInFull = saldoRestante <= 0;

        // Contenedor del formulario centrado y reducido
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
                    const discount = order.discount ?? 0;
                    const restante2 = order.total_pay - discount - order.total_paid;
                    this.totalPay = order.total_pay;
                    this.totalPaid = order.total_paid;
                    this.discount = discount;

                    // Verificar si se pagó completamente
                    if (restante2 <= 0) {
                        // Recargar el formulario para mostrar estado pagado
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

        // Aplicar estilos disabled si está pagado
        if (isPaidInFull) {
            setTimeout(() => {
                $("#advanced_pay, #method_pay_id, #description, #btnSuccess").prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
            }, 100);
        }
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
            data: { opc: "deletePay", id: idFolio, amount: amount, idPay: id },
            methods: {
                success: (res) => {
                    const data = res.initHistoryPay;

                    if (res.status === 200) {
                        // Actualizar resumen y lista de pagos
                        this.renderResumenPagos(data.details);
                        this.lsPay(idFolio);
                        this.ls();

                        // Actualizar el formulario con el nuevo saldo
                        const order = data.order;
                        const discount = order.discount ?? 0;
                        const restante = order.total_pay - discount - order.total_paid;

                        // Actualizar totales
                        this.totalPay = order.total_pay;
                        this.totalPaid = order.total_paid;

                        // Recargar el formulario para reflejar el nuevo estado
                        this.addPayment(order, idFolio);

                        // Mostrar mensaje de éxito
                        alert({
                            icon: "success",
                            text: "Pago eliminado correctamente. Saldo actualizado.",
                            timer: 2000
                        });
                    } else {
                        alert({ icon: "error", text: res.message });
                    }
                }
            }
        });
    }

    async lsPay(id) {
        // Obtener los pagos primero para verificar si existen
        const response = await useFetch({
            url: this._link,
            data: { opc: 'listPayment', id: id }
        });

        // Verificar si hay pagos
        if (!response.row || response.row.length === 0) {
            // Mostrar mensaje cuando no hay pagos
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

        // Si hay pagos, mostrar la tabla
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
                f_size: 11,
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

        let originalHTML = `<p class="text-lg font-bold text-blue-900" id="totalEvento">${formatPrice(totalEvento)}</p>`;

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

    renderOrderInfo(order) {
        const html = `
            <div class="space-y-4">
                <!-- Información del Cliente -->
                <div class="bg-[#1F2A37] rounded-lg p-4">
                    <h3 class="text-white font-semibold mb-3 flex items-center gap-2">
                        <i class="icon-user text-blue-400"></i>
                        Información del Cliente
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div class="flex items-center gap-3">
                            <i class="icon-user-1 text-gray-400"></i>
                            <div>
                                <p class="text-gray-400 text-xs mb-0.5">Nombre:</p>
                                <p class="text-white font-semibold">${order.name || 'N/A'}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <i class="icon-phone text-gray-400"></i>
                            <div>
                                <p class="text-gray-400 text-xs mb-0.5">Teléfono:</p>
                                <p class="text-white font-semibold">${order.phone || 'N/A'}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <i class="icon-mail text-gray-400"></i>
                            <div>
                                <p class="text-gray-400 text-xs mb-0.5">Correo:</p>
                                <p class="text-white font-semibold">${order.email || 'N/A'}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <i class="icon-birthday text-gray-400"></i>
                            <div>
                                <p class="text-gray-400 text-xs mb-0.5">Cumpleaños:</p>
                                <p class="text-white font-semibold">${order.date_birthday || 'N/A'}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Detalles del Pedido -->
                <div class="bg-[#1F2A37] rounded-lg p-4">
                    <h3 class="text-white font-semibold mb-3 flex items-center gap-2">
                        <i class="icon-doc-text text-blue-400"></i>
                        Detalles del Pedido
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div class="flex items-center gap-3">
                            <i class="icon-doc-text-1 text-gray-400"></i>
                            <div>
                                <p class="text-gray-400 text-xs mb-0.5">Folio:</p>
                                <p class="text-white font-semibold">${order.folio || 'N/A'}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <i class="icon-calendar text-gray-400"></i>
                            <div>
                                <p class="text-gray-400 text-xs mb-0.5">Fecha de Entrega:</p>
                                <p class="text-white font-semibold">${order.formatted_date_order || order.date_order || 'N/A'}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <i class="icon-clock text-gray-400"></i>
                            <div>
                                <p class="text-gray-400 text-xs mb-0.5">Hora de Entrega:</p>
                                <p class="text-white font-semibold">${order.time_order || 'N/A'}</p>
                            </div>
                        </div>
                        <div class="flex items-center gap-3">
                            <i class="icon-money text-gray-400"></i>
                            <div>
                                <p class="text-gray-400 text-xs mb-0.5">Total:</p>
                                <p class="text-white font-semibold">${formatPrice(order.total_pay)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Observaciones -->
                ${order.note ? `
                <div class="bg-[#1F2A37] rounded-lg p-4">
                    <h3 class="text-white font-semibold mb-2 flex items-center gap-2">
                        <i class="icon-doc-text text-blue-400"></i>
                        Observaciones
                    </h3>
                    <div class="bg-[#28324c] rounded p-3 text-gray-300">
                        ${order.note}
                    </div>
                </div>
                ` : ''}
            </div>
        `;

        $('#order-details-info').html(html);
    }

    // History.
    async showHistory(id) {
        const data = await useFetch({ url: this._link, data: { opc: 'getHistory', id: id } });

        bootbox.dialog({
            title: `
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-purple-600 rounded flex items-center justify-center">
                        <i class="icon-clock text-white text-sm"></i>
                    </div>
                    <div>
                        <h2 class="text-lg font-semibold text-white">Historial del Pedido</h2>
                        <p class="text-sm text-gray-400">Actividad y comentarios</p>
                    </div>
                </div>
            `,
            size: "large",
            id: 'modalHistory',
            closeButton: true,
            message: `<div id="containerHistory"></div>`,
        });

        this.createTimelineChat({
            parent: 'containerHistory',
            data: data.history || [],
            input_id: 'iptHistorial',
            success: () => {
                this.addHistory(id);
            }
        });
    }

    async addHistory(id) {
        const comment = $('#iptHistorial').val().trim();

        if (!comment) {
            alert({
                icon: "warning",
                text: "Por favor escribe un comentario",
                timer: 1500
            });
            return;
        }

        const response = await useFetch({
            url: this._link,
            data: {
                opc: 'addHistory',
                order_id: id,
                comment: comment,
                action: comment,
                title: 'Comentario',
                type: 'comment'
            }
        });

        if (response.status === 200) {
            $('#iptHistorial').val('');

            this.createTimelineChat({
                parent: 'containerHistory',
                data: response.history || [],
                input_id: 'iptHistorial',
                success: () => {
                    this.addHistory(id);
                }
            });

            alert({
                icon: "success",
                text: "Comentario agregado",
                timer: 1000
            });


        } else {
            alert({
                icon: "error",
                text: response.message || "Error al agregar comentario"
            });
        }
    }




    // Show Order.

    async showOrder(orderId) {
        const response = await useFetch({
            url: this._link,
            data: { opc: 'getOrderDetails', id: orderId }
        });

       

        const tipo = response.data.order.delivery_type;
        const badgeTipo = this.getBadgeDeliveryType(tipo);
        const subsidiarieName = response.data.order.subsidiarie_name || '';

        const modal = bootbox.dialog({
            title: `
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                        <i class="icon-birthday text-white text-sm"></i>
                    </div>
                    <div>
                        <h2 class="text-lg font-semibold text-white">Detalles del Pedido</h2>
                        <div class="flex items-center gap-2 mt-1">
                            ${badgeTipo}
                            <span class="px-2 py-0.5 text-xs font-medium rounded bg-gray-600 text-gray-200">
                                <i class="icon-home mr-1"></i>${subsidiarieName}
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
        const discount = parseFloat(orderData.discount || 0);
        const totalPaid = parseFloat(orderData.total_paid || 0);
        const balance = parseFloat(orderData.balance || 0);
        const infoDiscount = orderData.info_discount || '';

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
                    <i class="icon-dollar text-green-400 mr-2 text-sm"></i>
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

                console.log('recorrido de product: ',product);


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

        console.log('🧩 cardCustom: ',product);

        const hasDedication    = product.dedication && product.dedication.trim()       !== '';
        const hasDetails       = product.order_details && product.order_details.trim() !== '';
        const hasImages        = product.images && Array.isArray(product.images) && product.images.length > 0;
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

        $(document).on('keydown.imagePreview', function(e) {
            if (e.key === 'Escape') {
                $('#imagePreviewModal').remove();
                $(document).off('keydown.imagePreview');
            }
        });
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

    // Cierre de pedido

    printDailyClose() {

        const modalContent = `
            <div id="filterBarDailyClose" class="mb-3"></div>
            <div id="ticketContainer">
                <div class="text-center text-gray-400 py-10">
                    <i class="icon-doc-text text-5xl mb-5"></i>
                    <p class="mt-5">Selecciona una fecha para consultar el cierre del día</p>
                </div>
            </div>
        `;

        bootbox.dialog({
            title: `<i class="icon-calendar"></i> Cierre del Día - Pedidos de Pastelería`,
            message: modalContent,
            className: 'modal-ticket-close',
            // size:'small',
            closeButton: true
        });

        // Aplicar ancho personalizado al modal
        $('.modal-ticket-close .modal-dialog').css('max-width', '650px');

        let filterBarData = [];

        // Select de sucursal solo para admin
        if (rol == 1) {
            filterBarData.push({
                opc: "select",
                id: "subsidiariesDailyClose",
                lbl: "Sucursal:",
                class: "col-sm-3 mb-2",
                onchange: "app.viewDailyClose()",
                data: subsidiaries
            });
        }

        filterBarData.push(
            {
                opc: "input-calendar",
                id: "calendarDailyClose",
                lbl: "Seleccionar fecha:",
                class: "col-sm-3 mb-2"
            },
            {
                opc: "button",
                id: "btnSaveDailyClose",
                text: " Cerrar",
                class: "col-sm-3",
                className: "opacity-50 w-100 cursor-not-allowed",
                color_btn: "secondary",
                icon: "icon-lock",
                disabled: true,
                onClick: () => {
                    if (!$('#btnSaveDailyClose').prop('disabled')) {
                        this.saveDailyClose();
                    }
                }
            },
            {
                opc: "button",
                id: "btnPrintTicket",
                text: "Imprimir",
                class: "col-sm-3",
                className: "opacity-50 w-100 cursor-not-allowed",
                color_btn: "primary",
                icon: "icon-print",
                disabled: true,
                onClick: () => {
                    if (!$('#btnPrintTicket').prop('disabled')) {
                        this.printDailyCloseTicket();
                    }
                }
            }
        );

        this.createfilterBar({
            parent: 'filterBarDailyClose',
            data: filterBarData
        });

        dataPicker({
            parent: "calendarDailyClose",
            type: 'simple',
            startDate: moment(),
            locale: {
                format: 'YYYY-MM-DD'
            },
            onSelect: (start, end) => {
                this.viewDailyClose();
            },
        });

        this.viewDailyClose();
    }


    async viewDailyClose() {

        let rangePicker = getDataRangePicker("calendarDailyClose");
        let date = rangePicker.fi;
        let subsidiaries_id = rol == 1 ? $('#subsidiariesDailyClose').val() : null;

        const request = await useFetch({
            url: this._link,
            data: { opc: "getDailyClose", date: date, subsidiaries_id: subsidiaries_id }
        });

        if (request.status === 200) {
            this.ticketDailyClose({ data: request.data, date: date });

            // Habilitar botón de impresión
            $('#btnPrintTicket')
                .prop('disabled', false)
                .removeClass('opacity-50 cursor-not-allowed')
                .addClass('hover:bg-green-700');

            // Manejar estado del botón de cierre
            if (request.data.closure_exists) {
                $('#btnSaveDailyClose')
                    .prop('disabled', true)
                    .addClass('opacity-50 cursor-not-allowed')
                    .removeClass('hover:bg-yellow-600');
            } else {
                $('#btnSaveDailyClose')
                    .prop('disabled', false)
                    .removeClass('opacity-50 cursor-not-allowed');
            }
        } else {
            $('#ticketContainer').html(`
                <div class="text-center py-10">
                    <i class="icon-attention text-5xl text-gray-400 mb-3"></i>
                    <p class="text-gray-600">${request.message || "No hay pedidos registrados para esta fecha"}</p>
                </div>
            `);

            // Deshabilitar ambos botones
            $('#btnPrintTicket')
                .prop('disabled', true)
                .addClass('opacity-50 cursor-not-allowed');

            $('#btnSaveDailyClose')
                .prop('disabled', true)
                .addClass('opacity-50 cursor-not-allowed');
        }
    }

    saveDailyClose() {
        let rangePicker = getDataRangePicker("calendarDailyClose");
        let date = rangePicker.fi;
        let subsidiaries_id = rol == 1 ? $('#subsidiariesDailyClose').val() : null;

        this.swalQuestion({
            opts: {
                title: '¿Realizar cierre del día?',
                html: `Se guardarán los movimientos del <strong>${moment(date).locale('es').format('DD [de] MMMM [de] YYYY')}</strong> y se asignará el folio de cierre a los pedidos.
                    <div class="border border-gray-500 rounded-lg p-4 mt-4 text-left">
                        <p class="font-bold text-sm uppercase mb-2">Restricciones tras el cierre:</p>
                        <ul class="list-disc list-inside text-sm space-y-1">
                            <li>No se podrá capturar pedidos de este día.</li>
                            <li>No se podrá editar pedidos existentes.</li>
                            <li>No se podrá cancelar abonos realizados.</li>
                        </ul>
                    </div>
                    <br><span class="text-red-500">Esta acción no se puede deshacer.</span>`,
            },
            data: { opc: "saveDailyClose", date: date, subsidiaries_id: subsidiaries_id },
            methods: {
                request: (data) => {
                    alert({
                        icon: "success",
                        title: "Cierre realizado",
                        text: `Folio de cierre: #${data.closure_id}`,
                        btn1: true
                    });
                    this.viewDailyClose();
                },
            },
        });
    }

    ticketDailyClose(options) {
        const defaults = {
            parent: "ticketContainer",
            id: "ticketDailyClose",
            class: "bg-white p-4 rounded-lg shadow-lg font-mono text-gray-900 border border-gray-200",
            date: moment().format("YYYY-MM-DD"),
            data: {
                total_sales: 0,
                card_sales: 0,
                cash_sales: 0,
                transfer_sales: 0,
                total_orders: 0
            }
        };

        const opts = Object.assign({}, defaults, options);
        const d = opts.data;
        const fecha = opts.date;

        const formattedDate = moment(fecha).format('DD [de] MMMM [de] YYYY');

        const layout = $("<div>", {
            id: 'layoutPrintCloseTicket',
            class: 'flex justify-center p-4'
        });


        const container = $("<div>", {
            id: opts.id,
            class: opts.class,
            css: { 'max-width': '320px', 'width': '100%' }
        });

        // Información de la sucursal
        const subsidiaryInfo = d.subsidiary_name
            ? `<div class="text-xs font-semibold text-gray-600 mt-1">${d.is_all_subsidiaries ? d.subsidiary_name : 'Sucursal: ' + d.subsidiary_name}</div>`
            : '';

        const closureBadge = d.closure_exists
            ? `<div class="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1">CERRADO - Folio #${d.closure_id}</div>
               <div class="text-[10px] text-gray-500 mt-0.5">Cerrado por: ${d.closed_by || 'N/A'}</div>
               <div class="text-[10px] text-gray-500">${d.closed_at ? moment(d.closed_at).format('DD/MM/YYYY HH:mm') : ''}</div>`
            : '';

        const header = `
        <div class="flex flex-col items-center mb-3">
            <div style="width:60px;height:60px;border-radius:50%;overflow:hidden;margin-bottom:0.25rem;" class="mb-1">
                <img src="https://huubie.com.mx/alpha${d.logo}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />
            </div>
            <h1 class="text-sm font-bold">PEDIDOS DE PASTELERÍA</h1>
            <div class="text-xs text-gray-600">Cierre del Día</div>
            <div class="text-xs text-gray-600">${formattedDate}</div>
             ${subsidiaryInfo}
             ${closureBadge}
        </div>
    `;

        // Calcular total de formas de pago
        const totalPaymentMethods = parseFloat(d.cash_sales || 0) + parseFloat(d.card_sales || 0) + parseFloat(d.transfer_sales || 0);

        const resumen = `
        <div class="text-xs space-y-1">
             <div class="flex justify-between items-center">
                <div class="font-semibold">EFECTIVO:</div>
                <div>${formatPrice(d.cash_sales)}</div>
            </div>

            <div class="flex justify-between items-center">
                <div class="font-semibold">TARJETA:</div>
                <div>${formatPrice(d.card_sales)}</div>
            </div>

            <div class="flex justify-between items-center">
                <div class="font-semibold">TRANSFERENCIA:</div>
                <div>${formatPrice(d.transfer_sales)}</div>
            </div>

            <hr class="border-dashed border-t my-1" />

            <div class="flex justify-between items-center pt-1">
                <div class="font-semibold">TOTAL FORMAS DE PAGO:</div>
                <div class="text-sm font-bold">${formatPrice(totalPaymentMethods)}</div>
            </div>

            <div class="flex justify-between items-center pt-1">
                <div class="font-semibold">NÚMERO DE PEDIDOS:</div>
                <div class="text-sm font-bold">${d.total_orders}</div>
            </div>

            <hr class="border-dashed border-t my-1" />

            <div class="flex justify-between items-center">
                <div class="font-semibold">COTIZACIONES:</div>
                <div>${d.quotation_count || 0}</div>
            </div>

            <div class="flex justify-between items-center">
                <div class="font-semibold">PENDIENTES:</div>
                <div>${d.pending_count || 0}</div>
            </div>

            <div class="flex justify-between items-center">
                <div class="font-semibold">CANCELADOS:</div>
                <div>${d.cancelled_count || 0}</div>
            </div>


        </div>
    `;

        const footer = `
        <div class="text-center mt-4 text-[10px] font-bold text-gray-900 space-y-1">
            <p class="mt-1">GRACIAS POR SU PREFERENCIA</p>
            <p>ESTE NO ES UN COMPROBANTE FISCAL</p>
            <p class="text-purple-800 text-xs">Huubie</p>
            <p class="text-gray-500 font-normal text-[9px] mt-1">
                Generado: ${moment().format('DD/MM/YYYY HH:mm:ss')}
            </p>
        </div>
    `;

        container.append(header);
        container.append(resumen);
        container.append(footer);

        layout.append(container);

        $(`#${opts.parent}`).html(layout);
    }

    printDailyCloseTicket() {
        // Obtener solo el contenido del ticket (sin el layout wrapper)
        const ticketContent = document.getElementById('ticketDailyClose');

        if (!ticketContent) {
            alert({
                icon: "warning",
                text: "No hay ticket para imprimir. Por favor consulta primero.",
                btn1: true,
                btn1Text: "Ok"
            });
            return;
        }

        const printWindow = window.open('', '', 'height=600,width=400');
        printWindow.document.write('<html><head><title>Cierre del Día</title>');
        printWindow.document.write(`
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    max-width: 400px;
                    margin: 0 auto;
                }
                .bg-white { background-color: white; }
                .p-4 { padding: 1rem; }
                .rounded-lg { border-radius: 0.5rem; }
                .shadow { box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .font-mono { font-family: 'Courier New', monospace; }
                .text-gray-900 { color: #111827; }
                .flex { display: flex; }
                .flex-col { flex-direction: column; }
                .items-center { align-items: center; }
                .justify-between { justify-content: space-between; }
                .mb-4 { margin-bottom: 1rem; }
                .mb-1 { margin-bottom: 0.25rem; }
                .w-20 { width: 5rem; }
                .text-lg { font-size: 1.125rem; }
                .text-sm { font-size: 0.875rem; }
                .text-xs { font-size: 0.75rem; }
                .font-bold { font-weight: bold; }
                .font-semibold { font-weight: 600; }
                .text-gray-600 { color: #4B5563; }
                .text-gray-500 { color: #6B7280; }
                .text-purple-800 { color: #6B21A8; }
                .space-y-2 > * + * { margin-top: 0.5rem; }
                .space-y-1 > * + * { margin-top: 0.25rem; }
                .text-center { text-align: center; }
                .mt-6 { margin-top: 1.5rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-1 { margin-top: 0.25rem; }
                .pt-1 { padding-top: 0.25rem; }
                hr { border: 0; border-top: 1px dashed #D1D5DB; margin: 0.5rem 0; }
                @media print {
                    body { padding: 0; }
                }
            </style>
        `);
        printWindow.document.write('</head><body>');
        printWindow.document.write(ticketContent.outerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();

        setTimeout(() => {
            printWindow.print();
        }, 250);
    }

}



