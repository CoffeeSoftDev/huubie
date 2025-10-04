let api = 'ctrl/ctrl-reservaciones.php';

let app;

let estado;

$(async () => {
    const init = await useFetch({ url: api, data: { opc: "init" } });
    estado = init.status;
    app = new App(api, 'root');

    app.init();
    app.actualizarFechaHora({ label: 'Reservaciones' });

    setInterval(() => {
        app.actualizarFechaHora({label:'Reservaciones'});
    }, 60000);
});

class App extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "Reservation";
    }

    init() {
        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        this.ls();
    }

    layout() {
        this.primaryLayout({
            parent: "root",
            id: this.PROJECT_NAME,
            class: "flex mx-2 my-2 h-100 mt-5 p-2",
            card: {
                filterBar: { class: "w-full my-3 ", id: "filterBar" },
                container: {
                    class: "w-full my-3 bg-[#1F2A37] h-[calc(100vh)] rounded p-3",
                    id: "container" + this.PROJECT_NAME,
                },
            },
        });
        // Filter bar.
        $("#filterBar").html(`
            <div id="containerHours"></div>
            <div id="filterBar${this.PROJECT_NAME}" class="w-full my-3 " ></div>
        `);
    }

    filterBar() {
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
                    id: "selectStatusPedido",
                    class: "col-sm-3",
                    onchange: "app.ls()",
                    data: [{ id: "", valor: "Todos los estados" }, ...estado],
                },

                {
                    opc: "button",
                    id: "btnNuevoPedido",
                    class: "col-sm-2",
                    text: "Nueva Reservación",
                    className: "btn-danger w-100",
                    onClick: () => this.addReservation(),
                },

                {
                    opc: "button",
                    className: "w-100",
                    class: "col-sm-2",
                    color_btn: "secondary",
                    id: "btnCalendario",
                    text: "Calendario",
                    onClick: () => {
                        this.ls();
                        // window.location.href = '/dev/calendario/'
                    },
                },
            ],
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
                    "Próxima semana": [
                        moment().add(1, "week").startOf("week"),
                        moment().add(1, "week").endOf("week"),
                    ],
                    "Próximo mes": [
                        moment().add(1, "month").startOf("month"),
                        moment().add(1, "month").endOf("month"),
                    ],
                    "Mes anterior": [
                        moment().subtract(1, "month").startOf("month"),
                        moment().subtract(1, "month").endOf("month"),
                    ],
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

    // Reservation

    ls() {
        let rangePicker = getDataRangePicker("calendar");

        this.createTable({
            parent: `container${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: "lsReservation", fi: rangePicker.fi, ff: rangePicker.ff },
            conf: { datatable: true, pag: 10 },
            coffeesoft: true,

            attr: {
                id: `tb${this.PROJECT_NAME}`,
                theme: "dark",
                center: [1, 2, 4, 5, 7, 8, 9],
                right: [6],
                extends: true,
            },
        });
    }

    layoutReservation() {

        this.primaryLayout({
            parent: "root",
            id: this.PROJECT_NAME,
            class: "flex mx-2 my-2 h-100 mt-5 p-2",
            card: {
                filterBar: {
                    class: "w-full my-3 ",
                    id: "filterBar" + this.PROJECT_NAME,
                },
                container: {
                    class: "w-full my-3 bg-[#1F2A37] h-[calc(100vh)] p-3 rounded",
                    id: "container" + this.PROJECT_NAME,
                },
            },
        });


    }

    addReservation() {

        this.layoutReservation()

        $("#container" + this.PROJECT_NAME).html(
            `<div><form id="formAddReservacion" novalidate></form></div>`
        );

        $("#formAddReservacion").prepend(`
        <div class="px-2 pt-3 pb-3">
        <h2 class="text-2xl font-semibold text-white">📆 Nueva Reservación</h2>
        <p class="text-gray-400"></p>
        </div>`);


        this.createForm({
            id: "formAddReservacion",
            data: { opc: "addReservation" },
            parent: "formAddReservacion",
            json: this.jsonReservacion(),

            success: (response) => {
                if (response.status === 200) {
                    alert({
                        icon: "success",
                        title: "Reservación creada",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok",
                    });

                    app.render();
                    app.actualizarFechaHora();
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok",
                    });
                }
            },
        });

        $("#date_start").val(new Date().toISOString().split("T")[0]);
        $("#phone").on("input", function () {
            let value = $(this).val().replace(/\D/g, ""); // Solo números
            if (value.length > 10) value = value.slice(0, 10);
            $(this).val(value);
        });

        $("#lblCliente").addClass("border-b p-1");
        $("#lblEvento").addClass("border-b p-1");
    }

    async editReservation(id) {

        this.layoutReservation();

        $("#container" + this.PROJECT_NAME).html(
            `<div><form id="formEditReservacion" novalidate></form></div>`
        );

        $("#formEditReservacion").prepend(`
        <div class="px-2 pt-3 pb-3">
        <h2 class="text-2xl font-semibold text-white">📆 Editar Reservación</h2>
        <p class="text-gray-400"></p>
        </div>`);

        const req = await useFetch({ opc: "get", id });
        const data = req?.data ?? {};

        this.createForm({
            id: "formEditRes",
            parent: 'formEditReservacion',
            data: { opc: "edit", id },
            autofill: data,
            json: this.jsonReservacion(),
            success: (response) => {
                if (response.status === 200) {
                    alert({
                        icon: "success",
                        title: "Actualizado",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok",
                    });
                    this.ls();
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok",
                    });
                }
            },
        });

        $("#lblCliente").addClass("border-b p-1");
        $("#lblEvento").addClass("border-b p-1");


    }

   
    cancelReservation(id) {
        const row = event.target.closest('tr');
        const folio = row.querySelectorAll('td')[0]?.innerText || '';

        this.swalQuestion({
            opts: {
                title: `¿Esta seguro?`,
                html: `¿Deseas cancelar el pedido con folio <strong>${folio}</strong>?
                Esta acción actualizará el estado a "Cancelado" en la tabla [reservaciones].`,
            },
            data: { opc: "cancelReservation", status_reservation_id: 4, id: id },
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

    jsonReservacion() {
        return [
            {
                opc: "label",
                text: "Datos del Cliente",
                id: "lblCliente",
                class: "col-12 fw-bold text-lg mb-2",
            },
            {
                opc: "input",
                lbl: "Contacto",
                id: "name_client",
                class: "col-12 col-sm-4 col-lg-3 mb-3",
                tipo: "texto",
                placeholder: "Nombre del contacto",
            },
            {
                opc: "input",
                lbl: "Teléfono",
                id: "phone",
                class: "col-12 col-sm-4 col-lg-3",
                tipo: "tel",
                placeholder: "999-999-9999",
            },
            {
                opc: "input",
                lbl: "Correo electrónico",
                id: "email",
                class: "col-12 col-sm-4 col-lg-3",
                tipo: "email",
                placeholder: "cliente@gmail.com",
            },

            {
                opc: "label",
                text: "Datos de la Reservación",
                id: "lblEvento",
                class: "col-12 fw-bold text-lg mt-2 mb-2",
            },
            {
                opc: "input",
                lbl: "Nombre",
                id: "name_event",
                class: "col-12 col-sm-4 col-lg-3",
                tipo: "texto",
                placeholder: "Nombre de la reservación",
            },
            {
                opc: "input",
                lbl: "Locación",
                id: "location",
                class: "col-12 col-sm-4 col-lg-3 mb-3",
                tipo: "texto",
                placeholder: "Locación",
            },
            {
                opc: "input",
                lbl: "Fecha de inicio",
                id: "date_start",
                class: "col-12 col-sm-4 col-lg-3",
                type: "date",
            },

            {
                opc: "input",
                lbl: "Hora de inicio",
                id: "time_start",
                tipo: "hora",
                type: "time",
                class: "col-12 col-sm-4 col-lg-3 mb-3",
                required: false
            },

            {
                opc: "input",
                lbl: "Total a pagar",
                id: "total_pay",
                tipo: "cifra",
                class: "col-12 col-sm-4 col-lg-3 mb-3",
                required: false
            },
            {
                opc: "textarea",
                lbl: "Observaciones",
                id: "notes",
                class: "col-12 col-sm-12 col-md-12 col-lg-12",
                rows: 3,
            },
            // 📏 Botones
            {
                opc: "btn-submit",
                id: "btnGuardar",
                text: "Guardar",
                class: "col-5 col-sm-2 col-md-2 col-lg-2 offset-lg-8",
            },
            {
                opc: "button",
                id: "btnCancelar",
                text: "Cancelar",
                class: "col-6 col-sm-2 col-md-2 col-lg-2",
                color_btn: "danger",
                className: "w-full",
                onClick: () => {

                    app.render()
                    app.actualizarFechaHora();
                }
            },
        ];
    }

    // Reservation / Estatus.

    async viewReservation(id) {
        // Obtener datos de la reservación
        const res = await useFetch({
            url: this._link,
            data: { opc: "getReservation", id }
        });

        const data = res.data;
        const estado = this.getStatusReservation(data.status_reservation_id);

        // Construcción del contenido del detalle
        const datos = [
            { text: "Locación", value: data.location, icon: "icon-location" },
            { text: "Estado", value: estado.label, type: "status", icon: "icon-spinner", color: estado.color },
            { text: "Evento", value: data.name_event, icon: "icon-calendar" },
            { text: "Nombre", value: data.name_client, icon: "icon-user-1" },
            { text: "Teléfono", value: data.phone, icon: "icon-phone-1" },
            { text: "Creado el", value: data.date_creation, icon: "icon-calendar-1" },
            { text: "Correo", value: data.email, icon: "icon-mail-1" },
            { text: "Total", value: formatPrice(data.total_pay), icon: "icon-money" },
            { type: "observacion", value: data.notes }
        ];

        // Agregar botones si está en estado activo
        if (data.status_reservation_id === 1) {
            datos.push({
                type: "div",
                html: `
                    <div class="flex gap-2 mt-4 justify-end">
                        <button class="bg-green-600 hover:bg-green-700 text-white font-semibold text-sm px-4 py-2 rounded flex items-center gap-2"
                            id="btnShowReservation" data-id="${data.id}">
                            <i class="icon-ok"></i> Show
                        </button>
                        <button class="bg-red-600 hover:bg-red-700 text-white font-semibold text-sm px-4 py-2 rounded flex items-center gap-2"
                            id="btnNoShowReservation" data-id="${data.id}">
                            <i class="icon-block-1"></i> No Show
                        </button>
                    </div>
                `
            });
        }

        // Mostrar modal y renderizar contenido
        bootbox.dialog({
            title: "📅 Reservación",
            closeButton: true,
            message: '<div id="containerInfoReservation"></div>',
        });

        this.detailCard({
            parent: "containerInfoReservation",
            data: datos
        });

        // Asignar eventos a botones
        if (data.status_reservation_id === 1) {
            $("#btnShowReservation").on("click", () => this.showReservation(data.id));
            $("#btnNoShowReservation").on("click", () => this.noShowReservation(data.id));
        }
    }

    getStatusReservation(id) {
        const map = {
            1: { label: "Reservación", color: "bg-[#EBD9FF] text-[#6B3FA0]" },
            2: { label: "Si llego", color: "bg-[#B9FCD3] text-[#032B1A]" },
            3: { label: "No llego", color: "bg-[#E5E7EB] text-[#374151]" }
        };
        return map[id] || { label: "-", color: "bg-gray-500 text-white" };
    }

    showReservation(id) {
        this.swalQuestion({
            
            opts: {
                title: "¿Confirmar asistencia del cliente?",
                text: "Esta acción marcará esta reservación como 'Show'.",
                icon: "question"
            },

            data: {
                opc: "editReservation",
                status_reservation_id: 2,
                id: id,
            },

            methods: {
                send: (res) => {
                    if (res.status === 200) {
                        alert({
                            icon: "success",
                            text: "La reservación fue marcada como Show",
                            btn1: true
                        });
                        this.ls();
                        bootbox.hideAll();

                    } else {
                        alert({
                            icon: "error",
                            text: res.message,
                            btn1: true
                        });
                    }
                }
            }
        });
    }

    noShowReservation(id) {
        this.swalQuestion({
            opts: {
                title: "¿Marcar como No Show?",
                text: "Esta acción marcará la reservación como No Show. ¿Deseas continuar?",
                icon: "warning"
            },
            data: {
                opc: "editReservation",
                status_reservation_id: 3,
                id: id,
            },
            methods: {
                send: (res) => {
                    if (res.status === 200) {
                        alert({
                            icon: "success",
                            text: "La reservación fue marcada como No Show",
                            btn1: true
                        });
                        this.ls();
                        bootbox.hideAll();
                    } else {
                        alert({
                            icon: "error",
                            text: res.message,
                            btn1: true
                        });
                    }
                }
            }
        });
    }

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

    // History.

    async history(id) {

        let data = await useFetch({ url: this._link, data: { opc: 'getHistory', id: id } });

        bootbox.dialog({
            title: ``,
            size: "large",
            id: 'modalAdvance',
            closeButton: true,
            message: `<div id="containerChat"></div>`,
        });

    
        this.createTimeLine2({
            parent: 'containerChat',
            data: data.history,
            success: () => {
                this.addHistory(id);
            }
        });

    }

    async addHistory(id) {
        console.log(id)
        useFetch({
            url: this._link,
            data: {
                opc: 'addHistory',
                reservation_id: id,
                comment: $('#iptHistorial').val(),
                action: $('#iptHistorial').val(),
                title: 'comentario',
                type: 'comment'
            },

            success: (data) => {
                $('#iptHistorial').val('');

                this.createTimeLine2({
                    parent: 'containerChat',
                    data: data.history,
                    success: () => {
                        this.addHistory();
                    }
                });
            }
        });
    }

    createTimeLine2(options) {
        let defaults = {
            parent: "",
            id: "historial",
            data: [],
            success: () => { console.log('addLine') },
            input_id: "iptHistorial",
            class: "p-3 bg-gray-900 text-white rounded-lg h-[500px] overflow-y-auto",
            user_photo: "https://w7.pngwing.com/pngs/81/570/png-transparent-profile-logo-computer-icons-user-user-blue-heroes-logo-thumbnail.png",
            icons: {
                payment: "💵",
                comment: "💬",
                event: "📅",
                default: "🔹"
            }
        };

        let opts = Object.assign(defaults, options);

        $('#' + opts.parent).empty();

        let historialContainer = $('<div>', { class: opts.class + " flex flex-col h-full", id: opts.id });

        // 📜 **Contenedor de línea de tiempo**
        let timeline = $('<div>', { class: "relative flex flex-col gap-4 flex-grow overflow-y-auto p-3" });

        // 📜 **Generar los elementos del historial**
        opts.data.forEach((item, index) => {
            let entry = $('<div>', { class: "flex items-start gap-3 relative" });

            // 🔵 **Seleccionar el icono basado en el `type`**
            let iconType = opts.icons[item.type] || opts.icons.default;

            // 🔵 **Columna de iconos y líneas**
            let iconContainer = $('<div>', { class: "flex flex-col items-center relative" }).append(
                // Icono del evento
                $('<div>', {
                    class: "w-8 h-8 flex items-center justify-center bg-gray-700 text-white rounded-full",
                    html: iconType
                }),
                // 📏 Línea de tiempo (solo si no es el último elemento)
                index !== opts.data.length - 1
                    ? $('<div>', { class: "w-[2px] min-h-[28px] bg-gray-600 flex-1 mt-2" })
                    : ""
            );
            // 📝 **Fila con título y fecha alineados**
            let titleRow = $('<div>', { class: "flex justify-between items-center w-full" }).append(
                $('<span>', { class: "font-semibold text-gray-200", text: item.valor }), // Título
                $('<small>', { class: "text-gray-400 text-xs", text: item.date }) // Fecha
            );

            // 👤 **Nombre del responsable**
            let authorRow = $('<div>', { class: "text-gray-400 text-xs mt-1 italic" }).text(`Realizado por: ${item.author || 'Desconocido'}`);

            // 💬 **Mensaje o descripción del evento**
            let details = $('<div>', { class: "text-sm bg-gray-800 p-2 rounded-md shadow-md w-full" })
                .append(titleRow)
                .append(authorRow);


            if (item.message) {
                let messageBox = $('<div>', { class: " text-gray-300 text-xs p-2 rounded-md mt-1", text: item.message });
                details.append(messageBox);
            }

            entry.append(iconContainer, details);
            timeline.append(entry);
        });

        historialContainer.append(timeline);

        // 📝 **Barra de entrada de mensaje (oscura)**
        let messageBar = $('<div>', { class: "bg-gray-800 rounded-lg flex items-center p-2 border-t border-gray-700 mt-auto" }).append(
            $('<input>', {
                id: opts.input_id,
                class: "w-full px-3 py-2 border-none outline-none bg-gray-700 text-white placeholder-gray-400 text-sm",
                placeholder: "Escribe aquí..."
            }),
            $('<button>', {
                class: "bg-blue-700 hover:bg-blue-600 text-white p-2 rounded-sm ml-2 flex items-center justify-center transition",
                click: opts.success
            }).append(
                $('<i>', { class: "icon-direction-outline" }) // Icono de envío
            )
        );

        historialContainer.append(messageBar);

        // Renderizar el componente
        $('#' + opts.parent).empty().append(historialContainer);
    }




}

