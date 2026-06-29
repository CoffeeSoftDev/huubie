let api          = 'ctrl/ctrl-pedidos.php';
let api_catalogo = 'ctrl/ctrl-pedidos-catalogo.php';
let api_custom   = 'ctrl/ctrl-pedidos-personalizado.php';

let normal, app, custom, cierre; //Clases.
let idFolio, sub_name, user_name;
let categories, estado, clients;

let rol, subsidiaries, udn;
let subsidiariesCobro = []; // Sucursales para el selector "Sucursal de cobro" (todos los roles).
let dailyClosure = { is_closed: false };
let openShift = { has_open_shift: false };

$(async () => {
    let dataModifiers = await useFetch({ url: api, data: { opc: "getModifiers" } });
    categories = dataModifiers.data || [];

    const req          = await useFetch({ url: api, data: { opc: "init" } });
          estado       = req.status;
          clients      = req.clients || [];
          rol          = req.access;
          sub_name     = req.subsidiaries_name;
          user_name    = req.user_name;
          subsidiaries = req.sucursales;
          subsidiariesCobro = req.sucursales_cobro || [];
          dailyClosure = req.daily_closure || { is_closed: false };
          udn          = dailyClosure.subsidiary_id;
          openShift    = req.open_shift || { has_open_shift: false };
          app          = new App(api, 'root');
          custom       = new CustomOrder(api_custom, 'root');
          normal       = new CatalogProduct(api_catalogo, 'root');
          cierre       = new Cierre(apiCierre);

    app.render();

    // La navbar es la duena del filtro de sucursal (solo admin). Cuando el
    // admin cambia de sucursal alli, replicamos el comportamiento del filtro.
    document.addEventListener('branchChanged', () => app.onSubsidiaryChange());

    setInterval(() => {
        app.actualizarFechaHora({ label: app.getSubsidiaryLabel() });
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
        this.actualizarFechaHora({ label: this.getSubsidiaryLabel() });
        this.updateDailyClosureStatus();
    }

    layout() {
        this.createLayout({
            parent: "root",
            design: false,
            data: {
                id: this.PROJECT_NAME,
                class: 'flex mx-2 min-h-screen',
                container: [
                    {
                        type: "div",
                        id: "singleLayout",
                        class: "flex flex-col col-12",
                        children: [
                            { type: "div", class: 'w-full ', id: 'filterBar' },
                            { type: "div", class: 'w-full my-2 bg-[#1F2A37] h-screen rounded p-3 overflow-auto', id: 'container' + this.PROJECT_NAME }
                        ]
                    }
                ]
            }
        });

        // Filter bar.
        $('#filterBar').html(`
            <div id="filterBar${this.PROJECT_NAME}" class="w-full mb-3 " ></div>
            <div id="containerHours"></div>
        `);
    }

    createFilterBar() {

        let filterBar = [];

        // El filtro de sucursal vive ahora en la navbar (solo admin).
        // Aqui ya no se agrega; se reacciona a su evento 'subsidiaryChanged'.

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
                    if (!this.requireOpenShift()) return;
                    window.location.href = '../pedidos/calendario/index.php'
                }
            }
        );


        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: filterBar
        });

        // El #subsidiaries_id lo provee la navbar (admin), ya preseleccionado
        // con la sucursal del usuario; aqui no se inicializa.

        const savedRange = JSON.parse(localStorage.getItem('pedidos3_calendar_range') || 'null');
        const startDate = savedRange ? moment(savedRange.fi) : moment().startOf("month");
        const endDate = savedRange ? moment(savedRange.ff) : moment().endOf("month");

        dataPicker({
            parent: "calendar",
            rangepicker: {
                startDate: startDate,
                endDate: endDate,
                showDropdowns: true,
                ranges: {
                    "Hoy": [moment(), moment()],
                    "Ayer": [moment().subtract(1, "days"), moment().subtract(1, "days")],
                    "Semana actual": [moment().startOf("week"), moment().endOf("week")],
                    "Mes actual": [moment().startOf("month"), moment().endOf("month")],
                    "Mes anterior": [moment().subtract(1, "month").startOf("month"), moment().subtract(1, "month").endOf("month")],
                },
            },
            onSelect: (start, end) => {
                localStorage.setItem('pedidos3_calendar_range', JSON.stringify({
                    fi: start.format('YYYY-MM-DD'),
                    ff: end.format('YYYY-MM-DD')
                }));
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

        const isOldShift = openShift.has_open_shift && openShift.opened_at && !moment(openShift.opened_at).isSame(moment(), 'day');

        const shiftTime = openShift.has_open_shift && openShift.opened_at
            ? moment(openShift.opened_at).format('h:mm A')
            : '';
        const showShiftInHeader = openShift.has_open_shift && openShift.opened_at && !isOldShift;
        const borderClass = showShiftInHeader ? 'border-b-2 border-green-500/30' : 'border-b border-gray-300';

        const shiftInfo = showShiftInHeader
            ? `<span class="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
                <span class="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span>
                Turno desde las ${shiftTime}
               </span>
               <span class="text-gray-700">|</span>`
            : '';

        let div = $("<div>", {
            class: `flex justify-between ${borderClass} mt-2 mb-3`,
        }).append(

            $("<label>", {
                html: '<i class=" icon-location-8"></i> ' + opts.label,
                class: "text-xs font-medium text-gray-600 text-left flex-1",
                css: { 'font-size': '1rem', 'align-items': 'center', 'display': 'flex' }
            }),
            $("<div>", {
                class: "flex items-center gap-3",
                html: `${shiftInfo}<span class="text-uppercase font-semibold mb-2">${fechaFormateada}</span>`
            })
        );

        $(`#${opts.parent}`).html(div);
    }

    getSubsidiaryLabel() {
        const selected = $('#subsidiaries_id');
        // "Todas" aplica a cualquier rol (admin o cajero en modo consulta).
        if (selected.length && selected.val() === '0') return 'Todas las sucursales';
        if (rol != 1) return sub_name;
        if (!selected.length) return sub_name;
        const selectedName = selected.find('option:selected').text();
        const isOwnSubsidiary = selected.val() == udn;
        return isOwnSubsidiary ? `${selectedName} (Mi sucursal)` : selectedName;
    }

    // Sucursal con la que se FILTRA la lista (solo consulta). Admin filtra por el
    // selector de navbar (incluye "0" = todas). Operadores solo usan "0" como
    // consulta de todas; en cualquier otro caso null => el backend usa su sesion.
    getListFilterSubsidiary() {
        const $sel = $('#subsidiaries_id');
        if (!$sel.length) return null;
        const v = $sel.val();
        if (v === '0') return '0';
        return rol == 1 ? (v || '0') : null;
    }

    async onSubsidiaryChange() {
        this.ls();
        await this.checkAndUpdateDailyClosure();
    }

    async checkAndUpdateDailyClosure() {
        let subsidiaries_id = this.getListFilterSubsidiary();

        if (subsidiaries_id === '0') {
            openShift = { has_open_shift: true };
            dailyClosure = { is_closed: false };
            this.enableNewOrderButton();
            this.actualizarFechaHora({ label: 'Todas las sucursales' });
            return;
        }

        const request = await useFetch({
            url: this._link,
            data: { opc: "checkDailyClosure", subsidiaries_id: subsidiaries_id }
        });

        dailyClosure = request || { is_closed: false };

        if (request.open_shift) {
            openShift = request.open_shift;
        } else {
            openShift = { has_open_shift: false };
        }

        this.updateDailyClosureStatus();
        this.actualizarFechaHora({ label: this.getSubsidiaryLabel() });
    }

    updateDailyClosureStatus() {
        const btn = $('#btnNuevoPedido');

        // Limpiar todas las alertas previas antes de evaluar el nuevo estado
        $('#dailyClosureAlert, #shiftAlert, #shiftOldAlert').remove();

        if (dailyClosure.is_closed) {
            btn.prop('disabled', true)
               .removeClass('btn-primary')
               .addClass('btn-secondary opacity-50 cursor-not-allowed')
               .attr('title', 'Ya se realizó el cierre del día');

            if ($('#dailyClosureAlert').length === 0) {
                const alertHtml = `
                    <div id="dailyClosureAlert" class="flex items-center gap-2 mb-3 pl-1">
                        <span class="w-2 h-2 bg-red-400 rounded-full flex-shrink-0"></span>
                        <p class="text-[11px] text-gray-400">
                            Día cerrado <span class="text-gray-600">—</span> <span class="text-gray-500">${dailyClosure.closed_by || ''}${dailyClosure.closed_at ? ', ' + moment(dailyClosure.closed_at).format('hh:mm A') : ''}</span>
                        </p>
                    </div>
                `;
                $('#containerHours').after(alertHtml);
            }
        } else if (!openShift.has_open_shift) {
            btn.prop('disabled', true)
               .removeClass('btn-primary')
               .addClass('btn-secondary opacity-50 cursor-not-allowed')
               .attr('title', 'Debes abrir un turno de caja');

            if ($('#shiftAlert').length === 0) {
                const alertHtml = `
                    <div id="shiftAlert" class="flex items-center gap-2 mb-3 pl-1">
                        <span class="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse flex-shrink-0"></span>
                        <p class="text-[11px] text-gray-500">
                            Sin turno abierto —
                            <a href="javascript:void(0)" onclick="app.printDailyClose()" class="text-amber-400/80 hover:text-amber-300 underline underline-offset-2">abrir turno</a>
                            en "Cierre del día" para crear pedidos
                        </p>
                    </div>
                `;
                $('#containerHours').after(alertHtml);
            }
        } else if (openShift.has_open_shift && openShift.opened_at && !moment(openShift.opened_at).isSame(moment(), 'day')) {
            const shiftDate = moment(openShift.opened_at).locale('es').format('DD/MMM/YYYY');
            btn.prop('disabled', true)
               .removeClass('btn-primary')
               .addClass('btn-secondary opacity-50 cursor-not-allowed')
               .attr('title', 'Existe un turno abierto de otro día');

            if ($('#shiftOldAlert').length === 0) {
                const alertHtml = `
                    <div id="shiftOldAlert" class="flex items-center gap-2 mb-3 pl-1">
                        <span class="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse flex-shrink-0"></span>
                        <p class="text-[11px] text-gray-500">
                            Turno del <span class="text-amber-400/70">${shiftDate}</span> sin cerrar —
                            <a href="javascript:void(0)" onclick="app.printDailyClose()" class="text-amber-400/80 hover:text-amber-300 underline underline-offset-2">cerrar turno</a>
                            para crear nuevos pedidos
                        </p>
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
        $('#shiftAlert').remove();
        $('#shiftOldAlert').remove();
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
        if (!openShift.has_open_shift) {
            alert({
                icon: "warning",
                title: "Sin turno abierto",
                text: "Debes abrir un turno de caja antes de crear pedidos. Ve a 'Cierre del día' para abrir turno.",
                btn1: true,
                btn1Text: "Entendido"
            });
            return;
        }
        if (openShift.has_open_shift && openShift.opened_at && !moment(openShift.opened_at).isSame(moment(), 'day')) {
            alert({
                icon: "warning",
                title: "Turno pendiente de otro día",
                text: "Existe un turno abierto que no corresponde al día de hoy. Debes cerrarlo antes de continuar.",
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
        // El selector de sucursal vive en la navbar; lo enviamos explicitamente
        // porque ya no forma parte de la filterBar. "0" = todas (admin y, en modo
        // consulta, tambien el operador via selector hibrido).
        let subsidiaries_id = this.getListFilterSubsidiary();
        this.createTable({
            parent: `container${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: "listOrders", fi: rangePicker.fi, ff: rangePicker.ff, subsidiaries_id: subsidiaries_id },
            conf: {
                datatable: true, pag: 10, fn_datatable: 'simple_data_table_filter',
            },
            coffeesoft: true,

            attr: {
                id: `tb${this.PROJECT_NAME}`,
                theme: 'dark',
                center: [1, 2,7, 8, 9, 10, 11, 12],
                extends: true,
                f_size:12,
            },
        });

        this.injectShiftPulseStyle();
    }

    injectShiftPulseStyle() {
        if ($('#shiftPulseStyle').length) return;
        $('<style id="shiftPulseStyle">').text(
            `.shift-pulse { animation: shiftPulse 3s ease-in-out infinite; }` +
            `@keyframes shiftPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`
        ).appendTo('head');
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

    requireOpenShift() {
        if (typeof openShift !== 'undefined' && openShift && openShift.has_open_shift) return true;
        Swal.fire({
            icon: 'warning',
            title: 'No hay turno abierto',
            text: 'Debes abrir un turno antes de continuar.',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#7c3aed',
            background: '#1F2A37',
            color: '#fff'
        });
        return false;
    }

    async editOrder(id) {
        if (!this.requireOpenShift()) return;
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
        $('#subsidiaryFilter').prev('label').remove();

        // En edición la sucursal del pedido es fija: mostrar la real y bloquear el cambio.
        $('#formPedido #subsidiaries_id').val(order.subsidiaries_id).prop('disabled', true);

        $("#date_order").val(new Date().toISOString().split("T")[0]);
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
        if (!this.requireOpenShift()) return;
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
        if (!this.requireOpenShift()) return;
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
                    <select id="subsidiaries_id" name="subsidiaries_id" class="w-full text-xs border border-purple-300 rounded-md px-2 py-1 focus:ring-1 focus:ring-purple-400 focus:border-purple-400" onchange="app.validateOrderSubsidiary()">
                        ${subsidiaries.map(sub => `<option value="${sub.id}" ${dailyClosure.subsidiary_id == sub.id ? 'selected' : ''}>${sub.valor}</option>`).join('')}
                    </select>
                    <div id="orderSubsidiaryAlert"></div>
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
           clients = response.data;
       }
   }

    async validateOrderSubsidiary() {
        const subsidiaries_id = $('#formPedido #subsidiaries_id').val();
        const btn = $('#btnGuardarPedido');
        const alertDiv = $('#orderSubsidiaryAlert');

        const response = await useFetch({
            url: this._link,
            data: { opc: "checkDailyClosure", subsidiaries_id: subsidiaries_id }
        });

        const shift = response.open_shift || { has_open_shift: false };
        const isClosed = response.is_closed || false;
        const isOldShift = shift.has_open_shift && shift.opened_at && !moment(shift.opened_at).isSame(moment(), 'day');

        if (isClosed) {
            btn.prop('disabled', true).removeClass('btn-primary').addClass('btn-secondary opacity-50 cursor-not-allowed');
            alertDiv.html(`
                <div class="flex items-center gap-1.5 mt-1.5 px-2 py-1 bg-yellow-900/40 border border-yellow-600/50 rounded text-[11px] text-yellow-300">
                    <i class="icon-lock"></i> Cierre del día realizado en esta sucursal
                </div>
            `);
        } else if (!shift.has_open_shift) {
            btn.prop('disabled', true).removeClass('btn-primary').addClass('btn-secondary opacity-50 cursor-not-allowed');
            alertDiv.html(`
                <div class="flex items-center gap-1.5 mt-1.5 px-2 py-1 bg-amber-900/40 border border-amber-600/50 rounded text-[11px] text-amber-300">
                    <i class="icon-attention"></i> Sin turno abierto en esta sucursal
                </div>
            `);
        } else if (isOldShift) {
            btn.prop('disabled', true).removeClass('btn-primary').addClass('btn-secondary opacity-50 cursor-not-allowed');
            alertDiv.html(`
                <div class="flex items-center gap-1.5 mt-1.5 px-2 py-1 bg-amber-900/40 border border-amber-600/50 rounded text-[11px] text-amber-300">
                    <i class="icon-attention"></i> Turno pendiente de otro día sin cerrar
                </div>
            `);
        } else {
            btn.prop('disabled', false).removeClass('btn-secondary opacity-50 cursor-not-allowed').addClass('btn-primary');
            alertDiv.html('');
        }
    }


    // Payments.

    async historyPay(id) {
        if (!this.requireOpenShift()) return;

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

        // Sucursal de cobro (cobro cruzado): la eligen admin y cajero. Default = sucursal
        // activa: admin -> filtro de la navbar (si "Todas"/0, la del pedido); cajero -> su
        // sucursal de sesion (udn). Fallback final: la sucursal del pedido.
        const navbarSub = (rol == 1) ? ($('#subsidiaries_id').val() || '') : '';
        const defaultCobroSub = (navbarSub && navbarSub !== '0')
            ? navbarSub
            : ((rol != 1 && udn) ? udn : (order.subsidiaries_id ?? ''));

        // Sucursal de origen del pedido (referencia para el cobro cruzado).
        const origenSub    = (subsidiariesCobro || []).find(s => String(s.id) === String(order.subsidiaries_id));
        const origenNombre = origenSub ? origenSub.valor : '—';

        // Estado inicial de la tarjeta "Sucursal que cobrará".
        const origenSubId      = String(order.subsidiaries_id ?? '');
        const cobroSubSel      = (subsidiariesCobro || []).find(s => String(s.id) === String(defaultCobroSub));
        const cobroNombre      = cobroSubSel ? cobroSubSel.valor : origenNombre;
        const cobroEsMismaSuc  = String(defaultCobroSub) === origenSubId;
        const cobroSubtitulo   = cobroEsMismaSuc ? 'Misma sucursal de origen' : 'Cobro en otra sucursal';
        const cobroOptionsHtml = (subsidiariesCobro || [])
            .map(s => `<option value="${s.id}" ${String(s.id) === String(defaultCobroSub) ? 'selected' : ''}>${s.valor}</option>`)
            .join('');

        // Metodos de pago del dropdown custom (.js-dd). El value es el id que espera
        // el backend (1=Efectivo, 2=Tarjeta, 3=Transferencia) y vive en el input
        // hidden #method_pay_id que lee el form al registrar el pago.
        const metodosPago = [
            { id: '1', label: 'Efectivo',      sub: 'Pago en efectivo', icon: 'banknote' },
            { id: '2', label: 'Tarjeta',       sub: 'Débito o crédito', icon: 'credit-card' },
            { id: '3', label: 'Transferencia', sub: 'Depósito o SPEI',  icon: 'arrow-right-left' }
        ];
        const metodoDefault = metodosPago[0];
        const methodPayOptionsHtml = metodosPago.map((m, i) => `
            <div class="js-dd-option flex items-center gap-2.5 px-2.5 py-2 cursor-pointer hover:bg-slate-700/50"
                data-value="${m.id}" data-label="${m.label}" data-sub="${m.sub}" data-icon="${m.icon}">
                <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-700/60 text-gray-300 shrink-0">
                    ${window.lucideIcon(m.icon, 'w-4 h-4')}
                </div>
                <div class="flex flex-col leading-tight flex-1 min-w-0">
                    <span class="text-sm text-white font-semibold truncate">${m.label}</span>
                    <span class="text-[11px] text-gray-400">${m.sub}</span>
                </div>
                <span class="js-dd-check text-emerald-400 shrink-0 ${i === 0 ? '' : 'opacity-0'}">${window.lucideIcon('check', 'w-4 h-4')}</span>
            </div>`).join('');

        const methodPayCardHtml = `
            <input type="hidden" id="method_pay_id" name="method_pay_id" value="${metodoDefault.id}" required>
            <div class="js-dd relative">
                <div class="js-dd-trigger flex items-center gap-2.5 bg-[#1E293B] border border-slate-700 rounded-lg px-2.5 py-1.5 ${isPaidInFull ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}" ${isPaidInFull ? 'disabled' : ''}>
                    <div class="js-dd-trigger-icon flex items-center justify-center w-8 h-8 rounded-lg bg-slate-700/60 text-gray-300 shrink-0">
                        ${window.lucideIcon(metodoDefault.icon, 'w-4 h-4')}
                    </div>
                    <div class="flex flex-col leading-tight flex-1 min-w-0">
                        <span class="js-dd-trigger-label text-sm text-white font-semibold truncate">${metodoDefault.label}</span>
                        <span class="js-dd-trigger-sub text-[11px] text-gray-400">${metodoDefault.sub}</span>
                    </div>
                    <span class="js-dd-chevron text-gray-400 shrink-0 transition-transform">${window.lucideIcon('chevron-down', 'w-4 h-4')}</span>
                </div>
                <div class="js-dd-menu hidden absolute left-0 right-0 mt-1 z-20 bg-[#1E293B] border border-slate-700 rounded-lg shadow-xl overflow-hidden">
                    ${methodPayOptionsHtml}
                </div>
            </div>`;

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
                                <p class="text-xs text-green-400 flex items-center justify-center gap-1">${lucideIcon('tag', 'w-3 h-3')} Descuento aplicado: -${formatPrice(discount)}</p>
                            </div>
                        ` : ''}
                        ${isPaidInFull ? lucideIcon('circle-check', 'w-7 h-7 text-green-400 mt-2 inline-block') : ''}
                    </div>`
                },
                {
                    opc: "div",
                    id: "cardMethodPay",
                    class: "col-12 mb-2",
                    lbl: "Método de pago",
                    html: methodPayCardHtml
                },
                {
                    opc: "div",
                    id: "origenPedido",
                    lbl: "Origen del pedido",
                    class: "col-12 mb-2",
                    html: `<div class="flex items-center gap-2.5 bg-[#1E293B] border border-slate-700 rounded-lg px-2.5 py-1.5">
                        <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-700/60 text-gray-300 shrink-0">
                            ${lucideIcon('house', 'w-4 h-4')}
                        </div>
                        <div class="flex flex-col leading-tight min-w-0">
                            <span class="text-sm text-white font-semibold truncate">${origenNombre}</span>
                            <span class="text-[11px] text-gray-400">Sucursal donde se generó la venta</span>
                        </div>
                    </div>`
                },
                {
                    opc: "div",
                    id: "cobroWrapper",
                    lbl: "Sucursal que cobrará",
                    class: "col-12 mb-3",
                    html: `<div class="relative">
                        <div id="cobroCard" class="flex items-center gap-2.5 bg-[#1E293B] border ${cobroEsMismaSuc ? 'border-slate-700' : 'border-amber-500/60'} rounded-lg px-2.5 py-1.5 pointer-events-none">
                            <div id="cobroCardIcon" class="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-700/60 ${cobroEsMismaSuc ? 'text-blue-400' : 'text-amber-400'} shrink-0">
                                ${lucideIcon('landmark', 'w-4 h-4')}
                            </div>
                            <div class="flex flex-col leading-tight flex-1 min-w-0">
                                <span id="cobroCardName" class="text-sm text-white font-semibold truncate">${cobroNombre}</span>
                                <span id="cobroCardSub" class="text-[11px] text-gray-400">${cobroSubtitulo}</span>
                            </div>
                            ${lucideIcon('chevron-down', 'w-4 h-4 text-gray-400 shrink-0')}
                        </div>
                        <select id="payment_subsidiaries_id" name="payment_subsidiaries_id" data-origen="${origenSubId}" required
                            class="absolute inset-0 w-full h-full opacity-0 ${isPaidInFull ? 'cursor-not-allowed' : 'cursor-pointer'}"
                            ${isPaidInFull ? 'disabled' : ''} onchange="app.onCobroChange(this)">
                            ${cobroOptionsHtml}
                        </select>
                    </div>`
                },
                {
                    opc: "input",
                    type: "number",
                    id: "advanced_pay",
                    lbl: "Importe",
                    class: "col-12 mb-2",
                    placeholder: "0.00",
                    required: true,
                    min: 0,
                    onkeyup: "app.updateTotal()",
                    disabled: isPaidInFull
                },
                {
                    opc: "textarea",
                    id: "description",
                    lbl: "Observación",
                    class: "col-12 mb-2",
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

        // ── Interacción de los dropdowns (abrir/cerrar, seleccionar) ───────────
        const $payRoot = $('#container-payment');
        $payRoot.off('click.dd');

        // Abrir / cerrar al pulsar el trigger.
        $payRoot.on('click.dd', '.js-dd-trigger:not([disabled])', function (e) {
            e.stopPropagation();
            const $menu = $(this).siblings('.js-dd-menu');
            const willOpen = $menu.hasClass('hidden');
            // Cerrar cualquier otro menú abierto.
            $payRoot.find('.js-dd-menu').addClass('hidden');
            $payRoot.find('.js-dd-chevron').removeClass('rotate-180');
            if (willOpen) {
                $menu.removeClass('hidden');
                $(this).find('.js-dd-chevron').addClass('rotate-180');
            }
        });

        // Seleccionar una opción: actualiza hidden + trigger + check y cierra.
        $payRoot.on('click.dd', '.js-dd-option', function (e) {
            e.stopPropagation();
            const $opt = $(this);
            const $dd = $opt.closest('.js-dd');
            const value = $opt.attr('data-value');
            const label = $opt.attr('data-label');
            const sub = $opt.attr('data-sub') || '';
            const icon = $opt.attr('data-icon');

            // Valor real (id) para el envío del formulario.
            $dd.prevAll('input[type="hidden"]').first().val(value);

            // Reflejar la selección en el trigger.
            const $trigger = $dd.find('.js-dd-trigger');
            $trigger.find('.js-dd-trigger-icon').html(window.lucideIcon(icon, 'w-4 h-4'));
            $trigger.find('.js-dd-trigger-label').text(label);
            $trigger.find('.js-dd-trigger-sub').text(sub);

            // Mover el check a la opción elegida.
            $dd.find('.js-dd-check').addClass('opacity-0');
            $opt.find('.js-dd-check').removeClass('opacity-0');

            // Cerrar.
            $dd.find('.js-dd-menu').addClass('hidden');
            $trigger.find('.js-dd-chevron').removeClass('rotate-180');
        });

        // Cerrar al hacer click fuera de cualquier dropdown.
        $(document).off('click.payDD').on('click.payDD', function () {
            $('#container-payment .js-dd-menu').addClass('hidden');
            $('#container-payment .js-dd-chevron').removeClass('rotate-180');
        });

        // Confirmación antes de registrar el pago. Se intercepta el submit en fase
        // de captura (antes de validation_form): si no está confirmado, se bloquea,
        // se valida el importe y se pregunta; al confirmar se reenvía con bandera
        // para que el flujo normal (validación + AJAX) continúe.
        const formEl = document.getElementById('form-payment');
        if (formEl) {
            formEl.addEventListener('submit', async (e) => {
                if (formEl.dataset.payConfirmed === '1') {
                    formEl.dataset.payConfirmed = '';
                    return; // ya confirmado: dejar pasar a validation_form
                }
                e.preventDefault();
                e.stopImmediatePropagation();

                const importe = parseFloat($('#advanced_pay').val()) || 0;
                if (importe <= 0) {
                    alert({ icon: 'error', text: 'Ingresa un importe válido para registrar el pago.', btn1: true, btn1Text: 'Ok' });
                    return;
                }

                // Datos legibles para que el usuario entienda cómo se registrará el pago.
                const metodos = { '1': 'Efectivo', '2': 'Tarjeta', '3': 'Transferencia' };
                const metodoTxt = metodos[String($('#method_pay_id').val())] || '—';
                const subCobroId = String($('#payment_subsidiaries_id').val() || '');
                const subCobroObj = (subsidiariesCobro || []).find(s => String(s.id) === subCobroId);
                const subCobroNombre = subCobroObj ? subCobroObj.valor : origenNombre;
                // Cobro cruzado: la sucursal que cobra es distinta a la de origen del pedido.
                const esCruzado = subCobroId !== '' && String(order.subsidiaries_id ?? '') !== subCobroId;

                const row = (lbl, val, color = '#fff') => `
                    <div style="display:flex;justify-content:space-between;gap:16px;padding:3px 0;">
                        <span style="color:#9ca3af;">${lbl}</span><b style="color:${color};">${val}</b>
                    </div>`;

                const htmlConfirm = `
                    <div style="text-align:left;font-size:14px;line-height:1.5;">
                        ${row('Importe', formatPrice(importe))}
                        ${row('Método de pago', metodoTxt)}
                        ${row('Sucursal que cobra', subCobroNombre, '#A78BFA')}
                        ${esCruzado ? `
                        <div style="margin-top:10px;padding:8px 10px;border-radius:8px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.4);color:#fcd34d;font-size:12.5px;line-height:1.45;">
                            Cobro cruzado: el pedido es de <b>${origenNombre}</b>, pero el cobro se registrará en <b>${subCobroNombre}</b>.
                        </div>` : ''}
                    </div>`;

                const res = await alert({
                    icon: 'question',
                    title: '¿Registrar pago?',
                    html: htmlConfirm,
                    btn1Text: 'Sí, registrar',
                    btn2Text: 'Cancelar'
                });

                if (res && res.isConfirmed) {
                    formEl.dataset.payConfirmed = '1';
                    formEl.requestSubmit();
                }
            }, true);
        }

        // Aplicar estilos disabled si está pagado
        if (isPaidInFull) {
            setTimeout(() => {
                $("#advanced_pay, #description, #btnSuccess").prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
            }, 100);
        }
    }

    onCobroChange(sel) {
        const $sel   = $(sel);
        const id     = String($sel.val() || '');
        const nombre = $sel.find('option:selected').text().trim();
        const origen = String($sel.data('origen') || '');
        const same   = id === origen;

        $('#cobroCardName').text(nombre);
        $('#cobroCardSub').text(same ? 'Misma sucursal de origen' : 'Cobro en otra sucursal');
        $('#cobroCard')
            .toggleClass('border-slate-700', same)
            .toggleClass('border-amber-500/60', !same);
        $('#cobroCardIcon')
            .toggleClass('text-blue-400', same)
            .toggleClass('text-amber-400', !same);
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
                        ${lucideIcon('cake', 'w-4 h-4 text-white')}
                    </div>
                    <div>
                        <h2 class="text-lg font-semibold text-white">Detalles del Pedido</h2>
                        <div class="flex items-center gap-2 mt-1">
                            ${badgeTipo}
                            <span class="px-2 py-0.5 text-xs font-medium rounded bg-gray-600 text-gray-200 inline-flex items-center gap-1">
                                ${lucideIcon('house', 'w-3.5 h-3.5')}${subsidiarieName}
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
            const paymentMethods = response.data.paymentMethods || [];

            const container = $('#orderDetailsContainer');
            container.html(`
                <div id="orderInfoPanel" class="w-full lg:w-1/3 mb-6 lg:mb-0 lg:pr-3">
                    <div class="lg:sticky lg:top-4">
                        ${this.detailsCard(orderData, paymentMethods)}
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
            return `<span class="px-3 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700 inline-flex items-center gap-1 w-24 justify-center">${lucideIcon('house', 'w-3.5 h-3.5')} Local</span>`;
        } else if (tipo == 1 || tipo === '1') {
            return `<span class="px-3 py-1 rounded text-xs font-semibold bg-amber-100 text-amber-700 inline-flex items-center gap-1 w-28 justify-center">${lucideIcon('truck', 'w-3.5 h-3.5')} Domicilio</span>`;
        }
        return '<span class="px-3 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-700 inline-block w-24 text-center">Sin especificar</span>';
    }

    detailsCard(orderData, paymentMethods = []) {
        return `
            <div class="space-y-3">
                ${this.infoOrder(orderData)}
                ${this.infoSales(orderData, paymentMethods)}
            </div>
        `;
    }

    infoOrder(orderData) {
        return `
            <div class="bg-[#2C3E50] rounded-lg p-3">
                <h3 class="text-white font-semibold text-base mb-2 flex items-center">
                    ${lucideIcon('info', 'w-4 h-4 text-blue-400 mr-2')}
                    Información del Pedido
                </h3>

                <div class="space-y-1.5">
                    <div class="flex items-center gap-2">
                        ${lucideIcon('file-text', 'w-4 h-4 text-gray-400 shrink-0')}
                        <span class="text-gray-400 text-xs">Folio:</span>
                        <span class="text-white font-semibold text-sm ml-auto text-right">${orderData.folio || 'N/A'}</span>
                    </div>

                    <div class="flex items-center gap-2">
                        ${lucideIcon('user', 'w-4 h-4 text-gray-400 shrink-0')}
                        <span class="text-gray-400 text-xs">Cliente:</span>
                        <span class="text-white font-semibold text-sm ml-auto text-right">${orderData.name || 'N/A'}</span>
                    </div>

                    <div class="flex items-center gap-2">
                        ${lucideIcon('calendar', 'w-4 h-4 text-gray-400 shrink-0')}
                        <span class="text-gray-400 text-xs">Fecha de entrega:</span>
                        <span class="text-white font-semibold text-sm ml-auto text-right">${orderData.formatted_date_order || orderData.date_order || 'N/A'}</span>
                    </div>

                    <div class="flex items-center gap-2">
                        ${lucideIcon('clock', 'w-4 h-4 text-gray-400 shrink-0')}
                        <span class="text-gray-400 text-xs">Hora:</span>
                        <span class="text-white font-semibold text-sm ml-auto text-right">${orderData.time_order || 'N/A'}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        ${lucideIcon('truck', 'w-4 h-4 text-gray-400 shrink-0')}
                        <span class="text-gray-400 text-xs">Estado de entrega:</span>
                        <span class="text-white font-semibold text-sm ml-auto text-right">${orderData.delivery_status || 'N/A'}</span>
                    </div>
                </div>
            </div>
        `;
    }

    infoSales(orderData, paymentMethods = []) {
        const totalPay = parseFloat(orderData.total_pay || 0);
        const discount = parseFloat(orderData.discount || 0);
        const totalPaid = parseFloat(orderData.total_paid || 0);
        const balance = parseFloat(orderData.balance || 0);
        const infoDiscount = orderData.info_discount || '';

        const methodsHtml = (Array.isArray(paymentMethods) && paymentMethods.length > 0) ? `
                    <div class="pl-2 space-y-1 border-l-2 border-gray-600">
                        ${paymentMethods.map(m => `
                        <div class="flex items-center justify-between">
                            <span class="text-gray-500 text-xs flex items-center gap-1.5">
                                ${lucideIcon('credit-card', 'w-3.5 h-3.5')}
                                ${m.method_pay || 'Sin método'}:
                            </span>
                            <span class="text-gray-300 text-xs">$${parseFloat(m.pay || 0).toFixed(2)}</span>
                        </div>
                        `).join('')}
                    </div>
        ` : '';

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
                    ${lucideIcon('dollar-sign', 'w-4 h-4 text-green-400 mr-2')}
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

                    ${methodsHtml}

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
                    ${lucideIcon('shopping-basket', 'w-12 h-12 text-gray-500 mb-4')}
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
                            ${lucideIcon('shopping-basket', 'w-5 h-5 mr-2 text-blue-400')}
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

    // =============================================
    // Cierre del Día - Sistema de Turnos
    // =============================================

    printDailyClose() {
        this.reportMode = 'summary';
        this._selectedShiftId = null;

        const subsidiarySelect = rol == 1 ? `
            <div>
                <label class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">Sucursal</label>
                <select id="subsidiariesDailyClose" class="w-full bg-[#1F2A37] border border-[rgba(51,65,85,0.6)] text-[#F1F5F9] rounded-lg px-3 py-2 text-sm font-normal" onchange="app.onDailyCloseFilterChange()">
                    ${subsidiaries.map(s => `<option value="${s.id}" ${dailyClosure.subsidiary_id == s.id ? 'selected' : ''}>${s.valor}</option>`).join('')}
                </select>
            </div>
        ` : `
            <div>
                <label class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">Sucursal</label>
                <div class="flex items-center gap-2 w-full bg-[#1F2A37] border border-purple-500/40 rounded-lg px-3 py-2" title="Abrirás, cerrarás turno y harás el cierre de esta sucursal">
                    <i class="icon-location-8 text-purple-400"></i>
                    <span class="text-sm font-semibold text-white truncate">${sub_name || 'Mi sucursal'}</span>
                </div>
            </div>
        `;

        const modalContent = `
            <div class="flex flex-col lg:flex-row gap-4 lg:min-h-[480px]">
                <!-- Sidebar -->
                <div class="w-full lg:w-[280px] flex-shrink-0 space-y-4">
                    <div class="grid grid-cols-2 md:grid-cols-1 gap-3">
                        ${subsidiarySelect}
                        <div id="dateFieldWrapper">
                            <label class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">Fecha</label>
                            <div class="relative">
                                <input type="text" id="calendarDailyClose" class="w-full bg-[#1F2A37] border border-[rgba(51,65,85,0.6)] text-[#F1F5F9] rounded-lg pl-3 pr-9 py-2 text-sm font-normal cursor-pointer focus:border-purple-500 focus:outline-none" readonly placeholder="Fecha" />
                                <span class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-300 pointer-events-none">
                                    ${lucideIcon('calendar', 'w-[18px] h-[18px]')}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div id="openShiftsAlert" class="hidden"></div>
                    <div>
                        <label class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1 block">Seleccionar turno</label>
                        <select id="shiftSelector" class="w-full bg-[#1F2A37] border border-[rgba(51,65,85,0.6)] text-[#F1F5F9] rounded-lg px-3 py-2 text-sm font-normal" onchange="app.viewShiftPreview()">
                            <option value="">-- Seleccionar --</option>
                        </select>
                    </div>
                    <div class="grid grid-cols-3 md:grid-cols-1 gap-2 mt-2">
                        <button id="btnOpenShift" class="py-2.5 rounded-lg text-xs md:text-sm font-semibold bg-green-600 hover:bg-green-700 text-white flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2" onclick="app.openShift()">
                            ${lucideIcon('circle-plus')} <span>Abrir<span class="hidden md:inline"> Turno</span></span>
                        </button>
                        <button id="btnCloseShift" class="py-2.5 rounded-lg text-xs md:text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 opacity-50 cursor-not-allowed" disabled onclick="app.closeShift()">
                            ${lucideIcon('lock')} <span>Cerrar<span class="hidden md:inline"> Turno</span></span>
                        </button>
                        <button id="btnPrintTicket" class="py-2.5 rounded-lg text-xs md:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white flex flex-col md:flex-row items-center justify-center gap-1 md:gap-2 opacity-50 cursor-not-allowed" disabled onclick="app.printDailyCloseTicket()">
                            ${lucideIcon('printer')} <span>Imprimir<span class="hidden md:inline"> Ticket</span></span>
                        </button>
                    </div>
                    <div class="border-t border-gray-600 pt-2 mt-2 space-y-2">
                        <button id="btnCerrarDia" class="w-full py-2.5 rounded-lg text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center gap-2 opacity-50 cursor-not-allowed" disabled onclick="cierre.initCierre()">
                            ${lucideIcon('check-check')} Cerrar Dia
                        </button>
                    </div>
                </div>
                <!-- Ticket Preview -->
                <div class="flex-1 relative">
                    <div id="ticketPreview" class="relative lg:absolute lg:inset-0 w-full min-h-[420px] lg:min-h-0 bg-[#151d2a] rounded-lg p-4 overflow-y-auto">
                        <div id="ticketModeBar" class="flex items-center justify-between mb-3 gap-3 hidden">
                            <p class="text-xs text-gray-500">Vista previa de impresión</p>
                            <div class="inline-flex items-center gap-1 bg-[#1a2332] p-1 rounded-lg border border-gray-700/50 text-[11px] flex-shrink-0">
                                <button id="btnModeSummary" class="px-3 py-1 rounded-md font-semibold bg-purple-600 text-white shadow-sm transition-all" onclick="app.toggleReportMode('summary')">Resumido</button>
                                <button id="btnModeDetailed" class="px-3 py-1 rounded-md font-semibold text-gray-400 hover:text-gray-200 transition-all" onclick="app.toggleReportMode('detailed')">Detallado</button>
                            </div>
                        </div>
                        <div id="ticketContainer">
                            <div class="text-center text-gray-400 py-16">
                                <i class="icon-doc-text text-5xl mb-4"></i>
                                <p class="mt-4">Selecciona un turno para ver el ticket</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const dialog = bootbox.dialog({
            title: `
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                        ${lucideIcon('calendar', 'w-5 h-5 text-white')}
                    </div>
                    <span class="text-lg font-bold text-white">Cierre del Día</span>
                </div>`,
            message: modalContent,
            size:'large',
            closeButton: true
        });

        dialog.on('shown.bs.modal', () => {
            dataPicker({
                parent: "calendarDailyClose",
                type: 'simple',
                rangeDefault: {
                    singleDatePicker: true,
                    showDropdowns: true,
                    autoApply: true,
                    startDate: moment(),
                    locale: { format: 'YYYY-MM-DD' }
                },
            });

            // Recargar turnos al seleccionar una fecha en el calendario
            $('#calendarDailyClose').on('apply.daterangepicker', () => this.loadShifts());

            this.loadShifts();
        });
    }

    onDailyCloseFilterChange() {
        this.loadShifts();
    }

    async loadShifts() {
        let rangePicker     = getDataRangePicker("calendarDailyClose");
        let date            = rangePicker.fi;
        let subsidiaries_id = rol == 1 ? $('#subsidiariesDailyClose').val() : null;

        // Limpiar badge de cierre (opcion C) y restaurar boton Cerrar Dia
        $('.closure-badge').remove();
        const wrapper = $('.closure-wrapper');
        if (wrapper.length) {
            const label = wrapper.find('label');
            label.removeClass('!mb-0').addClass('mb-1');
            wrapper.replaceWith(label);
        }
        $('#calendarDailyClose').removeClass('!border-green-600/50');
        let btnArea = $('#btnCerrarDia').parent();
        if (!$('#btnCerrarDia').length) {
            btnArea = $('#btnReabrirDia').parent();
            btnArea.html(`
                <button id="btnCerrarDia" class="w-full py-2.5 rounded-lg text-sm font-semibold bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center gap-2 opacity-50 cursor-not-allowed" disabled onclick="cierre.initCierre()">
                    <i class="icon-check"></i> Cerrar Dia
                </button>
            `);
        }

        const [response, openRes] = await Promise.all([
            useFetch({ url: this._link, data: { opc: "getShiftsByDate", date: date, subsidiaries_id: subsidiaries_id } }),
            useFetch({ url: this._link, data: { opc: "getOpenShifts", subsidiaries_id: subsidiaries_id } })
        ]);

        const shifts = response.shifts || [];
        const today = moment().format('YYYY-MM-DD');
        const allOpenShifts = openRes.shifts || [];
        const openShifts = allOpenShifts.filter(s => !moment(s.opened_at).isSame(today, 'day'));
        const hasAnyOpenShift = allOpenShifts.length > 0;
        const select = $('#shiftSelector');
        select.html('<option value="">-- Cerrar turno --</option>');

        shifts.forEach(s => {
            const time = moment(s.opened_at).format('YYYY-MM-DD hh:mm A');
            const badge = s.status === 'open' ? ' [ABIERTO]' : ' [CERRADO]';
            select.append(`<option value="${s.id}" data-status="${s.status}">${time}${badge}</option>`);
        });

        // Mostrar turnos abiertos pendientes
        const alertContainer = $('#openShiftsAlert');
        if (openShifts.length > 0) {
            const shiftItems = openShifts.map(s => {
                const date = moment(s.opened_at).format('DD/MM/YYYY');
                const time = moment(s.opened_at).format('hh:mm A');
                const name = s.shift_name || time;
                return `
                    <div class="flex items-center justify-between py-1.5 px-2 bg-[#1a2332] rounded-md cursor-pointer hover:bg-[#243044] transition-colors" onclick="app.selectOpenShift('${s.id}', '${moment(s.opened_at).format('YYYY-MM-DD')}')">
                        <div class="flex items-center gap-2">
                            <span class="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
                            <span class="text-xs text-gray-300">${name}</span>
                        </div>
                        <span class="text-[10px] text-gray-500">${date}</span>
                    </div>
                `;
            }).join('');

            alertContainer.html(`
                <div class="bg-orange-900/30 rounded-lg p-3">
                    <div class="flex items-center gap-2 mb-2">
                        <i class="icon-attention text-orange-400 text-sm"></i>
                        <span class="text-xs font-bold text-orange-400 uppercase">Turnos sin cerrar (${openShifts.length})</span>
                    </div>
                    <div class="space-y-1">${shiftItems}</div>
                </div>
            `).removeClass('hidden');

        } else {
            alertContainer.addClass('hidden').html('');
        }

        // Deshabilitar abrir turno si hay cualquier turno abierto (hoy u otros días)
        if (hasAnyOpenShift) {
            $('#btnOpenShift').prop('disabled', true).addClass('opacity-50 cursor-not-allowed').removeClass('hover:bg-green-700');
        } else {
            $('#btnOpenShift').prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');
        }

        // Si hay turnos, seleccionar el primero (más reciente)
        if (shifts.length > 0) {
            select.val(shifts[0].id);
            this.viewShiftPreview();
        } else {
            $('#ticketContainer').html(`
                <div class="text-center text-gray-400 py-16">
                    <i class="icon-clock text-5xl mb-4"></i>
                    <p class="mt-4">No hay turnos para esta fecha</p>
                    <p class="text-sm mt-2">Abre un turno para comenzar</p>
                </div>
            `);
            $('#btnCloseShift').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
            $('#btnPrintTicket').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
            $('#ticketModeBar').addClass('hidden');
        }

        // Habilitar botón Cerrar Día solo si hay al menos un turno cerrado
        const hasClosedShifts = shifts.some(s => s.status === 'closed');
        if (hasClosedShifts) {
            $('#btnCerrarDia').prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');
        } else {
            $('#btnCerrarDia').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
        }

        const closureCheck = await useFetch({ url: cierre.api, data: { opc: 'getCierre', date: date, subsidiaries_id: subsidiaries_id } });
        if (closureCheck.status === 200 && closureCheck.closure) {
            cierre.loadClosedView(date, subsidiaries_id);
        } else if (date === moment().format('YYYY-MM-DD')) {
            // Sincronizar estado de la pantalla principal si hoy no hay cierre activo
            dailyClosure = { is_closed: false, subsidiary_id: subsidiaries_id || udn };
            this.updateDailyClosureStatus();
        }
    }

    async selectOpenShift(shiftId, date) {
        const picker = $('#calendarDailyClose').data('daterangepicker');
        const momentDate = moment(date);
        picker.setStartDate(momentDate);
        picker.setEndDate(momentDate);
        await this.loadShifts();
        $('#shiftSelector').val(shiftId).trigger('change');
    }

    async viewShiftPreview() {
        const shiftId = $('#shiftSelector').val();
        if (!shiftId) {
            $('#btnCloseShift').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
            $('#btnPrintTicket').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
            $('#ticketModeBar').addClass('hidden');
            return;
        }

        this._selectedShiftId = shiftId;
        const selectedOption = $(`#shiftSelector option[value="${shiftId}"]`);
        const shiftStatus = selectedOption.data('status');

        // Obtener métricas
        const metricsRes = await useFetch({
            url: this._link,
            data: { opc: "getShiftMetrics", shift_id: shiftId }
        });

        if (metricsRes.status !== 200) {
            $('#ticketContainer').html(`<p class="text-center text-gray-400 py-10">${metricsRes.message || 'Error al obtener datos'}</p>`);
            return;
        }

        // Obtener órdenes si modo detallado
        let orders = [];
        let externalPayments = [];
        let crossPayments = [];
        if (this.reportMode === 'detailed') {
            const ordersRes = await useFetch({
                url: this._link,
                data: { opc: "getShiftOrders", shift_id: shiftId }
            });
            orders            = ordersRes.orders || [];
            externalPayments  = ordersRes.external_payments || [];
            crossPayments     = ordersRes.cross_payments || [];
        }

        this.ticketShiftClose({
            data: metricsRes.data,
            shift: metricsRes.shift,
            subsidiary_name: metricsRes.subsidiary_name,
            company_name: metricsRes.company_name,
            logo: metricsRes.logo,
            orders: orders,
            externalPayments: externalPayments,
            crossPayments: crossPayments
        });

        // Habilitar botón imprimir
        $('#btnPrintTicket').prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');

        // Botón cerrar caja: solo si turno está abierto
        if (shiftStatus === 'open') {
            $('#btnCloseShift').prop('disabled', false).removeClass('opacity-50 cursor-not-allowed');
        } else {
            $('#btnCloseShift').prop('disabled', true).addClass('opacity-50 cursor-not-allowed');
        }
    }

    ticketShiftClose(options) {
        const d = options.data || {};
        const shift = options.shift || {};
        const subsidiaryName = options.subsidiary_name || '';
        const companyName = options.company_name || subsidiaryName;
        const logo = options.logo || '';
        const orders = options.orders || [];
        const isDetailed = this.reportMode === 'detailed';

        const aperturaFull = moment(shift.opened_at).locale('es').format('DD/MMM/YYYY hh:mm a');
        const cierreFull   = shift.closed_at ? moment(shift.closed_at).locale('es').format('DD/MMM/YYYY hh:mm a') : '-';

        const isClosed = shift.status === 'closed';

        const subsidiaryHeader = (subsidiaryName && subsidiaryName !== companyName)
            ? `<div class="text-xs font-semibold" style="color:#7c3aed;">${subsidiaryName}</div>`
            : '';

        const closedBadge = isClosed
            ? `<div class="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1">CERRADO</div>`
            : `<div class="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1">EN CURSO</div>`;

        // Desglose de ventas (modo detallado)
        const externalPayments = options.externalPayments || [];
        const crossPayments    = options.crossPayments || [];
        let detailedSection = '';

        if (isDetailed) {
            // Grupo 1: pedidos creados en este turno
            if (orders.length > 0) {
                const shiftTotal = orders.reduce((sum, o) => sum + parseFloat(o.total_pay || 0), 0);
                const shiftPaid  = orders.reduce((sum, o) => sum + parseFloat(o.payment_real || 0), 0);

                const orderRows = orders.map(o => `
                    <div class="flex items-center">
                        <div class="font-bold text-gray-900 truncate flex-1">${o.folio || 'Folio #' + o.id}</div>
                        <div class="text-right" style="width:72px">${formatPrice(o.total_pay)}</div>
                        <div class="text-right text-green-700" style="width:72px">${parseFloat(o.payment_real || 0) ? formatPrice(o.payment_real) : '-'}</div>
                    </div>
                    <div class="text-[10px] text-gray-500 mb-1">${o.client_name || 'Sin cliente'}</div>
                `).join('');

                detailedSection += `
                    <div class="font-semibold mt-2 mb-1">PEDIDOS DEL TURNO</div>
                    <div class="flex text-[9px] text-gray-400 mb-0.5">
                        <span class="flex-1">FOLIO</span>
                        <span class="text-right" style="width:72px">TOTAL</span>
                        <span class="text-right" style="width:72px">ABONO</span>
                    </div>
                    ${orderRows}
                    <div class="flex justify-between items-center font-semibold border-t border-dashed pt-1 mt-1">
                        <div>TOTAL PEDIDOS</div>
                        <div>${formatPrice(shiftTotal)}</div>
                    </div>
                    <div class="flex justify-between items-center text-green-700">
                        <div>COBRADO EN TURNO</div>
                        <div>${formatPrice(shiftPaid)}</div>
                    </div>
                    <hr class="border-dashed border-t my-1" />
                `;
            }

            // Grupo 2: abonos de pedidos de turnos anteriores
            if (externalPayments.length > 0) {
                const extTotal = externalPayments.reduce((sum, o) => sum + parseFloat(o.payment_real || 0), 0);

                const money = (v) => `$${parseFloat(v || 0).toFixed(2)}`;
                const extRows = externalPayments.map(o => {
                    const total     = parseFloat(o.total_pay || 0);
                    const discount  = parseFloat(o.discount || 0);
                    const abono     = parseFloat(o.payment_real || 0);       // abonó en este turno
                    const paidUpto  = parseFloat(o.total_paid_upto || 0);    // abonado hasta el cierre (incluye este turno)
                    const quedoRaw  = total - discount - paidUpto;           // saldo restante
                    const quedo     = quedoRaw < 0 ? 0 : quedoRaw;
                    const debia     = quedo + abono;                         // saldo antes del abono de este turno
                    const liquidado = quedoRaw <= 0.005;
                    const badge = liquidado
                        ? `<span class="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[9px] font-bold">LIQUIDADO</span>`
                        : `<span class="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[9px] font-bold">PENDIENTE</span>`;
                    // Cobro cruzado: el pedido es de otra sucursal distinta a la del cierre.
                    const origin = o.origin_subsidiary || '';
                    const originLine = (origin && origin !== subsidiaryName)
                        ? `<div class="text-[10px] text-gray-500 mb-0.5">Origen: ${origin}</div>`
                        : '';
                    return `
                        <div class="flex justify-between items-center mt-3 pt-2 border-t border-dashed border-gray-200">
                            <div class="italic truncate" style="max-width:150px">${o.folio || 'Folio #' + o.id}</div>
                            ${badge}
                        </div>
                        <div class="text-[10px] text-gray-500 mb-0.5">${o.client_name || 'Sin cliente'}</div>
                        ${originLine}
                        <div class="flex justify-between text-[11px]"><span class="text-gray-600">Debía</span><span>${money(debia)} <span class="text-gray-400">de ${money(total)}</span></span></div>
                        <div class="flex justify-between text-[11px] text-green-700"><span>Abonó</span><span>${money(abono)}</span></div>
                        <div class="flex justify-between text-[11px] font-semibold border-t border-dashed pt-0.5 mt-0.5"><span>Quedó</span><span>${money(quedo)}</span></div>
                    `;
                }).join('');

                detailedSection += `
                    <div class="font-semibold mt-2 mb-1">ABONOS DE PEDIDOS ANTERIORES</div>
                    ${extRows}
                    <div class="flex justify-between items-center font-semibold border-t border-dashed pt-1 mt-1 text-green-700">
                        <div>TOTAL COBRADO</div>
                        <div>${formatPrice(extTotal)}</div>
                    </div>
                    <hr class="border-dashed border-t my-1" />
                `;
            }

            // Grupo 3: pedidos de este turno cuyo abono se cobró en otra sucursal.
            // Es informativo: NO entra a tu caja, por eso va aparte y no suma al total.
            if (crossPayments.length > 0) {
                const crossTotal = crossPayments.reduce((sum, o) => sum + parseFloat(o.payment_cross || 0), 0);

                const crossRows = crossPayments.map(o => `
                    <div class="flex items-center mt-2">
                        <div class="font-bold text-gray-900 truncate flex-1">${o.folio || 'Folio #' + o.id}</div>
                        <div class="text-right text-gray-900" style="width:72px">${formatPrice(o.payment_cross)}</div>
                    </div>
                    <div class="text-[10px] text-purple-400">${o.client_name || 'Sin cliente'}</div>
                    <div class="text-[10px] text-purple-500"><i class="icon-shop"></i> Cobrado en: ${o.charged_subsidiary || 'Otra sucursal'}</div>
                `).join('');

                detailedSection += `
                    <div class="bg-purple-50 border border-purple-200 rounded-lg p-3 mt-2">
                        <div class="font-semibold text-purple-700"><i class="icon-bank"></i> COBRADO EN OTRA SUCURSAL</div>
                        <div class="text-[10px] text-purple-400 mb-1">No entra a tu caja (informativo).</div>
                        ${crossRows}
                        <div class="flex justify-between items-center font-semibold border-t border-dashed border-purple-200 pt-1 mt-2">
                            <div class="text-gray-900">Total en otra sucursal</div>
                            <div class="text-gray-900">${formatPrice(crossTotal)}</div>
                        </div>
                    </div>
                `;
            }
        }

        const totalPayments = parseFloat(d.cash_sales || 0) + parseFloat(d.card_sales || 0) + parseFloat(d.transfer_sales || 0);

        // Actividad de pedidos del turno = creados en el turno + cobrados de turnos anteriores
        const createdOrders  = parseInt(d.total_orders)    || 0;
        const createdQuot    = parseInt(d.quotation_count) || 0;
        const createdCancel  = parseInt(d.cancelled_count) || 0;
        const createdPending = parseInt(d.pending_count)   || 0;
        const createdPaid    = createdOrders - createdQuot - createdCancel - createdPending;
        const prevCount      = parseInt(d.prev_count)   || 0; // pedidos anteriores cobrados en el turno
        const prevPaid       = parseInt(d.prev_paid)    || 0; // de esos, los que quedaron liquidados
        const prevPending    = parseInt(d.prev_pending) || 0; // de esos, los que aun tienen saldo
        const ordersTurno    = createdOrders  + prevCount;
        const paidTurno      = createdPaid    + prevPaid;
        const pendingTurno   = createdPending + prevPending;

        const ticketHtml = `
            <div id="layoutPrintCloseTicket" class="flex justify-center p-4">
                <div id="ticketDailyClose" class="bg-white p-4 rounded-lg shadow-lg text-gray-900 border border-gray-200" style="max-width: 320px; width: 100%; font-family: 'Roboto Mono', ui-monospace, 'Courier New', monospace;">
                    <!-- Header -->
                    <div class="flex flex-col items-center mb-3">
                        ${logo ? `<div style="width:60px;height:60px;border-radius:50%;overflow:hidden;margin-bottom:0.25rem;" class="mb-1">
                            <img src="/alpha${logo}" alt="" onerror="this.parentElement.outerHTML='<div style=\\'width:60px;height:60px;border-radius:50%;margin-bottom:0.25rem;background:#7c3aed;display:flex;align-items:center;justify-content:center;\\'><span style=\\'color:white;font-size:24px;font-weight:bold;\\'>${(companyName || 'H').charAt(0).toUpperCase()}</span></div>'" style="width:100%;height:100%;object-fit:cover;display:block;" />
                        </div>` : `<div style="width:60px;height:60px;border-radius:50%;margin-bottom:0.25rem;background:#7c3aed;display:flex;align-items:center;justify-content:center;" class="mb-1">
                            <span style="color:white;font-size:24px;font-weight:bold;">${(companyName || 'H').charAt(0).toUpperCase()}</span>
                        </div>`}
                        <h1 class="text-sm font-bold uppercase">${companyName}</h1>
                        ${subsidiaryHeader}
                        <div class="text-xs font-semibold">PEDIDOS DE PASTELERÍA</div>
                        <div class="text-xs text-gray-600">Cierre x Turno</div>
                        ${closedBadge}
                    </div>

                    <!-- Info -->
                    <div class="text-xs space-y-0.5 mb-2">
                        <div class="flex justify-between"><span>Aperturó:</span><span>${shift.employee_name || 'N/A'}</span></div>
                        <div class="flex justify-between"><span>Apertura:</span><span>${aperturaFull}</span></div>
                        ${isClosed ? `<div class="flex justify-between"><span>Cierre:</span><span>${cierreFull}</span></div>` : ''}
                        <div class="flex justify-between"><span>Inicio de caja:</span><span>${formatPrice(shift.opening_amount || 0)}</span></div>
                    </div>

                    <hr class="border-dashed border-t my-1" />

                    <!-- Detalle (si aplica) -->
                    <div class="text-xs space-y-0.5">
                        ${detailedSection}

                        <!-- Formas de pago -->
                        <div class="flex justify-between items-center font-semibold">
                            <div>EFECTIVO:</div>
                            <div>${parseFloat(d.cash_sales || 0) ? formatPrice(d.cash_sales) : '-'}</div>
                        </div>
                        <div class="flex justify-between items-center font-semibold">
                            <div>TARJETA:</div>
                            <div>${parseFloat(d.card_sales || 0) ? formatPrice(d.card_sales) : '-'}</div>
                        </div>
                        <div class="flex justify-between items-center font-semibold">
                            <div>TRANSFERENCIA:</div>
                            <div>${parseFloat(d.transfer_sales || 0) ? formatPrice(d.transfer_sales) : '-'}</div>
                        </div>

                        <hr class="border-dashed border-t my-1" />

                        <div class="flex justify-between items-center font-semibold">
                            <div>TOTAL CAJA:</div>
                            <div class="text-sm">${totalPayments ? formatPrice(totalPayments) : '-'}</div>
                        </div>

                        <hr class="border-dashed border-t my-1" />

                        <div class="flex justify-between items-center font-semibold">
                            <div>NÚMERO DE PEDIDOS DEL TURNO:</div>
                            <div>${ordersTurno || '-'}</div>
                        </div>
                        <div class="mt-2"></div>
                        <div class="flex justify-between items-center font-semibold">
                            <div>PAGADOS:</div>
                            <div>${paidTurno || '-'}</div>
                        </div>
                        <div class="flex justify-between items-center font-semibold">
                            <div>PENDIENTES:</div>
                            <div>${pendingTurno || '-'}</div>
                        </div>
                        <div class="flex justify-between items-center font-semibold">
                            <div>COTIZACIONES:</div>
                            <div>${createdQuot || '-'}</div>
                        </div>
                        <div class="flex justify-between items-center font-semibold">
                            <div>CANCELADOS:</div>
                            <div>${createdCancel || '-'}</div>
                        </div>
                    </div>

                    <!-- Footer -->
                    <div class="text-center mt-4 text-[10px] font-bold text-gray-900 space-y-1">
                        <p>GRACIAS POR SU PREFERENCIA</p>
                        <p class="text-purple-800 text-xs">Huubie</p>
                        <p class="text-gray-500 font-normal text-[9px]">
                            Generado: ${moment().format('DD/MM/YYYY HH:mm:ss')}
                        </p>
                    </div>
                </div>
            </div>
        `;

        $('#ticketContainer').html(ticketHtml);
        $('#ticketModeBar').removeClass('hidden');
    }

    toggleReportMode(mode) {
        this.reportMode = mode;

        if (mode === 'detailed') {
            $('#btnModeDetailed').addClass('bg-purple-600 text-white shadow-sm').removeClass('text-gray-400 hover:text-gray-200');
            $('#btnModeSummary').addClass('text-gray-400 hover:text-gray-200').removeClass('bg-purple-600 text-white shadow-sm');
        } else {
            $('#btnModeSummary').addClass('bg-purple-600 text-white shadow-sm').removeClass('text-gray-400 hover:text-gray-200');
            $('#btnModeDetailed').addClass('text-gray-400 hover:text-gray-200').removeClass('bg-purple-600 text-white shadow-sm');
        }

        if (this._selectedShiftId) {
            this.viewShiftPreview();
        }
    }

    openShift() {
        let subsidiaries_id = rol == 1 ? ($('#subsidiariesDailyClose').val() || null) : null;
        const subName = rol == 1
            ? $('#subsidiariesDailyClose option:selected').text()
            : sub_name;

        createCoffeeModalForm({
            id: 'frmOpenShift',
            title: 'Abrir Turno',
            iconSvg: lucideIcon('clock', 'w-5 h-5'),
            iconBg: 'bg-emerald-600',
            theme: 'dark',
            confirmText: 'Confirmar Apertura',
            cancelText: 'Cancelar',
            json: [
                { opc: 'display', id: 'sucursal',    lbl: 'Sucursal',             icon: lucideIcon('house', 'w-4 h-4'), value: subName },
                { opc: 'display', id: 'responsable', lbl: 'Responsable',          icon: lucideIcon('user', 'w-4 h-4'),  value: (typeof user_name !== 'undefined' && user_name) ? user_name : 'Sin asignar' },
                { opc: 'money',   id: 'openingAmount', lbl: 'Fondo inicial de caja', placeholder: '0.00', min: 0, step: 0.01, autofocus: true }
            ],
            onConfirm: async (data, modal) => {
                const opening_amount = parseFloat(data.openingAmount) || 0;

                const confirm = await Swal.fire({
                    title: '¿Aperturar turno?',
                    html: `<p>Se abrirá un nuevo turno de caja en <strong>${subName}</strong> con un fondo inicial de <strong>$${opening_amount.toFixed(2)}</strong>.</p>`,
                    icon: 'question',
                    iconColor: '#8b5cf6',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, aperturar',
                    cancelButtonText: 'Cancelar',
                    confirmButtonColor: '#8b5cf6',
                    customClass: { popup: 'bg-[#1F2A37] text-white rounded-lg' },
                    // El modal de apertura usa z-index 100000; subimos el Swal por encima.
                    didOpen: () => { const c = document.querySelector('.swal2-container'); if (c) c.style.zIndex = 100010; }
                });

                if (!confirm.isConfirmed) return;

                const response = await useFetch({
                    url: this._link,
                    data: {
                        opc: "openShift",
                        shift_name: '',
                        opening_amount: opening_amount,
                        subsidiaries_id: subsidiaries_id
                    }
                });

                modal.modal('hide');

                if (response.status === 200) {
                    alert({ icon: "success", title: "Turno abierto", text: response.message, timer: 2000 });
                    openShift = { has_open_shift: true, shift_id: response.shift_id, shift_name: null, opened_at: new Date().toISOString() };
                    this.updateDailyClosureStatus();
                    this.actualizarFechaHora({ label: sub_name });
                    await this.selectOpenShift(response.shift_id, moment().format('YYYY-MM-DD'));
                } else {
                    alert({ icon: "error", title: "Error", text: response.message, btn1: true });
                }
            }
        });
    }

    async closeShift() {
        const shiftId = this._selectedShiftId || $('#shiftSelector').val();
        if (!shiftId) return;

        const ordersRes = await useFetch({
            url: this._link,
            data: { opc: "getShiftOrders", shift_id: shiftId }
        });
        const orderCount = (ordersRes.orders || []).length;

        Swal.fire({
            title: '¿Cerrar ticket de turno?',
            html: `<p>Se procederá a realizar el corte de caja. Se cerrarán <strong><u>${orderCount}</u></strong> tickets de venta con la información actual.</p>`,
            icon: 'question',
            iconColor: '#8b5cf6',
            showCancelButton: true,
            confirmButtonText: 'Sí, cerrar turno',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#8b5cf6',
            customClass: {
                popup: 'bg-[#1F2A37] text-white rounded-lg',
            }
        }).then(async (result) => {
            if (result.isConfirmed) {
                const response = await useFetch({
                    url: this._link,
                    data: { opc: "closeShift", shift_id: shiftId }
                });

                if (response.status === 200) {
                    alert({ icon: "success", title: "Turno cerrado", text: response.message, timer: 2000 });
                    this.loadShifts();
                    this.ls();

                    openShift = { has_open_shift: false };
                    this.updateDailyClosureStatus();
                    this.actualizarFechaHora({ label: sub_name });
                } else {
                    alert({ icon: "error", title: "Error", text: response.message, btn1: true });
                }
            }
        });
    }

    printDailyCloseTicket() {
        const ticketContent = document.getElementById('ticketDailyClose');

        if (!ticketContent) {
            alert({ icon: "warning", text: "No hay ticket para imprimir.", btn1: true, btn1Text: "Ok" });
            return;
        }

        // Reutiliza el CSS de Fontello ya cargado en la pagina (href absoluto) para que
        // los iconos (icon-shop, icon-bank) se rendericen tambien en la ventana de impresion.
        const fontelloHref = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .map(l => l.href)
            .find(h => /fontello/i.test(h)) || '';

        const printWindow = window.open('', '', 'height=600,width=400');
        printWindow.document.write('<html><head><title>Cierre de Turno</title>');
        if (fontelloHref) {
            printWindow.document.write(`<link rel="stylesheet" href="${fontelloHref}">`);
        }
        printWindow.document.write(`
            <style>
                body { font-family: 'Courier New', monospace; padding: 10px; max-width: 320px; margin: 0 auto; }
                .bg-white { background-color: white; }
                .p-4 { padding: 1rem; }
                .rounded-lg { border-radius: 0.5rem; }
                .shadow-lg { box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                .font-mono { font-family: 'Courier New', monospace; }
                .text-gray-900 { color: #111827; }
                .flex { display: flex; }
                .flex-col { flex-direction: column; }
                .items-center { align-items: center; }
                .justify-between { justify-content: space-between; }
                .mb-3 { margin-bottom: 0.75rem; }
                .mb-2 { margin-bottom: 0.5rem; }
                .mb-1 { margin-bottom: 0.25rem; }
                .mt-4 { margin-top: 1rem; }
                .mt-2 { margin-top: 0.5rem; }
                .mt-1 { margin-top: 0.25rem; }
                .text-sm { font-size: 0.875rem; }
                .text-xs { font-size: 0.75rem; }
                .text-\\[10px\\] { font-size: 10px; }
                .text-\\[9px\\] { font-size: 9px; }
                .font-bold { font-weight: bold; }
                .font-semibold { font-weight: 600; }
                .text-gray-600 { color: #4B5563; }
                .text-gray-500 { color: #6B7280; }
                .text-purple-800 { color: #6B21A8; }
                .text-center { text-align: center; }
                .uppercase { text-transform: uppercase; }
                .italic { font-style: italic; }
                .space-y-1 > * + * { margin-top: 0.25rem; }
                .space-y-0\\.5 > * + * { margin-top: 0.125rem; }
                hr { border: 0; border-top: 1px dashed #D1D5DB; margin: 0.5rem 0; }
                .bg-green-100, .bg-blue-100 { padding: 2px 8px; border-radius: 9999px; display: inline-block; }
                .bg-green-100 { background: #dcfce7; color: #166534; }
                .bg-blue-100 { background: #dbeafe; color: #1e40af; }
                @media print { body { padding: 0; } }
            </style>
        `);
        printWindow.document.write('</head><body>');
        printWindow.document.write(ticketContent.outerHTML);
        printWindow.document.write('</body></html>');
        printWindow.document.close();

        // Espera a que cargue la fuente de iconos antes de imprimir; si no, fallback por tiempo.
        const triggerPrint = () => printWindow.print();
        if (printWindow.document.fonts && printWindow.document.fonts.ready) {
            printWindow.document.fonts.ready.then(() => setTimeout(triggerPrint, 100));
        } else {
            setTimeout(triggerPrint, 400);
        }
    }

}



