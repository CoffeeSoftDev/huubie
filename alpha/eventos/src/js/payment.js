class Payments extends App {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "Payments";
    }

    init() {
        this.render();
    }


    async addHistory() {

        useFetch({
            url: api,
            data: {
                opc: 'addHistory',
                evt_events_id: 6,
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

    async printNote(id) {

        let modal = bootbox.dialog({
            title: 'Imprimir nota de evento',
            closeButton: true,
            size: 'xl',
            message: '<div id="ContainerTicket"></div> <div class="flex justify-content-end  mt-3" id="containerButtons"></div>',
            id: 'modal'

        }); // Crear componente modal.


        let data = await useFetch({
            url: this._link,
            data: {

                opc: 'getEvent',
                idEvent: id,

            }
        });

        this.createPDF({
            parent: 'ContainerTicket',

            data_header: data.Event,
            dataMenu: data.Menu,
            dataPayment: data.Payment,

            clauses: [
                "El Horario de Inicio y Finalización estipulado en la orden de servicio deberá ser respetado.",
                "Concluidas las 5 horas del servicio este se suspende teniendo como máximo 30 minutos para desalojar el salón.",
                "No se pueden introducir alimentos ni bebidas (snacks, antojitos, pan dulce o cualquier bebida).",
                "En caso de adquirir un paquete de buffet (niños o padres) se deberá pagar el evento.",
                "En caso de haber ingresado bebidas alcohólicas los invitados deberán tener mínimo 18 años cumplidos.",
                "En caso de cancelación el evento se realizará a través de eventos o vales de consumo dentro del restaurante con una penalización del 10%.",
                "Cualquier cambio en la logística del evento quedará sujeto a disponibilidad de espacios y áreas involucradas para su realización.",
                "El restaurant no se hace responsable por objetos olvidados dentro del evento.",
                "No se permite el uso de fuegos artificiales, confeti o cualquier tipo de papel que afecte al medio ambiente.",
                "La empresa solo se hace responsable con la paquetería en este orden de servicio."
            ]

        });

        // Función para imprimir y cerrar el modal correctamente
        let printDiv = () => {

            let divToPrint = document.getElementById("docEvent");
            let popupWin = window.open("", "_blank");

            popupWin.document.open();
            popupWin.document.write(`
                <html>
                <head>
                    <link href="https://15-92.com/ERP3/src/plugin/bootstrap-5/css/bootstrap.min.css" rel="stylesheet" type="text/css">
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style type="text/css" media="print">
                        @page { margin: 5px; }
                        body { margin: 0; padding: 10px; }
                    </style>
                </head>
                <body>
                    ${divToPrint.innerHTML}
                    <script>
                        window.onload = function() {
                            setTimeout(() => {
                               
                            }, 500);
                        };
                    <\/script>
                </body>
                </html>`);
          
            // window.print();
            // window.close();

            popupWin.document.close();

            // Cierra el modal inmediatamente después de lanzar la impresión
            modal.modal('hide');

        };

        $('#containerButtons').append(
            $('<button>', {
                class: 'btn btn-primary',

                html: '<i class="icon-print"></i> Imprimir ',
                click: function () {
                    printDiv();
                }
            }),

        );


    }

    // Print pdf
    async onShowDocument(id) {

        let modal = bootbox.dialog({

            title: "Imprimir nota de evento",
            closeButton: true,
            size: "xl",
            message:
                '<div class="flex justify-content-end  mt-3" id="containerButtons"></div><div class="flex justify-content-center  mt-3" id="containerPDF"></div> ',
            id: "modalDocument",
        }); 


        let data = await useFetch({
            url: this._link,
            data: { opc: 'getFormatedEvent', idEvent: id, }
        });

        this.createPDFComponent({
            parent: "containerPDF",

            dataEvent: data.Event,
            dataSubEvent: data.SubEvent,
            dataPayment: data.Payment,
            dataMenu: data.menu,
            dataExtra: data.extras,
            logo: data.company.logo,
            location: data.company.location,
            type: data.type,
            clauses: data.clausules


        });

        // // Función para imprimir y cerrar el modal correctamente
        let printDiv = () => {

          let divToPrint = document.getElementById("containerPdfEvent");
          let popupWin = window.open("", "_blank");

          popupWin.document.open();
          
            popupWin.document.write(`
                <html>
                <head>
                    <link href="https://15-92.com/ERP3/src/plugin/bootstrap-5/css/bootstrap.min.css" rel="stylesheet" type="text/css">
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style type="text/css" media="print">
                        @page { margin: 5px; }
                        body { margin: 5px; padding: 10px; }
                    </style>
                </head>
                <body>
                    ${divToPrint.innerHTML}
                    <script>
                    
                        window.onload = function() {
                            setTimeout(() => {

                              window.print();
                              window.close();
                              
                            }, 500);
                        };

                    <\/script>
                </body>
                </html>`);
          
            

            popupWin.document.close();

            // Cierra el modal inmediatamente después de lanzar la impresión
            modal.modal('hide');

        };

        $('#containerButtons').append(
            $('<button>', {
                class: 'btn btn-primary text-white',

                html: '<i class="icon-print"></i> Imprimir ',
                click: function () {
                    printDiv();
                }
            }),

        );


    }

    // Payment.
    addPayment(id) {

        let tr = $(event.target).closest("tr");

        // Obtiene la celda de la cantidad (columna 5)
        let saldo         = tr.find("td").eq(5).text();
        let saldoOriginal = tr.find("td").eq(5).text().replace(/[^0-9.-]+/g, "");
        let total         = parseFloat(saldoOriginal);

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

    // History.
    async addHistory(id) {
        useFetch({
            url: this._link,
            data: {
                opc: 'addHistory',
                evt_events_id: id,
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

    async historyPay(id) {

        let data = await useFetch({ url: this._link, data: { opc: 'getHistory', id: id } });

        bootbox.dialog({
            title: ``,
            size: "large",
            id: 'modalAdvance',
            closeButton: true,
            message: `<div id="containerChat"></div>`,
        });

        this.tabLayout({
            parent: "containerChat",
            id: "tabComponent",
            content: { class: "h-[600px-2rem]" },
            theme: "dark",
            json: [
                {
                    id: "payment",
                    tab: "Lista de pagos",
                    active: true,
                    onClick: () => { },
                },

                {
                    id: "recorder",
                    tab: "Bitácora",
                    icon: "",
                    onClick: () => { },
                },
            ],
        });

        $('#container-payment').html(`
            <div id="container-info-payment"></div>
            <div id="container-list-payment"></div>
        `);


        this.createTimeLine2({
            parent: 'container-recorder',
            data: data.history,
            success: () => {
                this.addHistory(id);
            }
        });

        this.renderResumenPagos(data.info);
        this.lsPay(id);

    }

    renderResumenPagos(totales) {
        const totalPagado = totales?.pagado ?? 0;
        const discount    = totales?.discount ?? 0;
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

        let originalHTML = `<p class="text-2xl font-bold text-blue-900" id="totalEvento">${fmt(totalEvento)}</p>`;

        // Si hay descuento, mostrar desglose visual
        if (discount > 0) {
            originalHTML = `
            <p class="text-2xl font-bold text-blue-900" id="totalEvento">${fmt(totalConDescuento)}</p>
            <p class="text-sm text-gray-400 line-through -mt-1">${fmt(totalEvento)}</p>
            <p class="text-sm text-blue-700 mt-1">
                <i class="icon-tag"></i> Descuento:
                <span class="font-semibold">${fmt(discount)}</span>
            </p>
        `;
        }

        $('#container-info-payment').prepend(`
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">

            <div class="bg-green-100 p-4 rounded-lg text-center shadow">
                <p class="text-sm text-green-700">Total Pagado</p>
                <p class="text-2xl font-bold text-green-900" id="totalPagado">${fmt(totalPagado)}</p>
            </div>

            <div class="bg-blue-100 p-4 rounded-lg text-center shadow">
                <p class="text-sm text-blue-700">Total del Evento</p>
                ${originalHTML}
            </div>

            <div class="bg-red-100 p-4 rounded-lg text-center shadow">
                <p class="text-sm text-red-700">Restante</p>
                <p class="text-2xl font-bold text-red-900" id="totalRestante">${fmt(restante)}</p>
            </div>

        </div>
    `);
    }

    lsPay(id) {

        this.createTable({
            parent: "container-list-payment",
            idFilterBar: "filterBarEventos",
            data: { opc: 'listPagos', id: id },
            conf: { datatable: false, pag: 8 },
            coffeesoft: true,
            attr: {
                id: "tablaEventos",
                theme: 'dark',
                center: [1, , 3, 6, 7],
                right: [4,],
                extends: true,
            },
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

    // Components.
    createPDF(options) {

        const defaults = {
            parent: 'containerNote',
            dataPackage: [],
            dataMenu: [],
            dataPayment: [],
            data_header: {
                email: "[email]",
                phone: "[phone]",
                contact: "[contact]",
                idEvent: "[idEvent]",
                location: "[location]",
                date_creation: "[date_creation]",
                date_start: "[date_start]",
                date_start_hr: "[date_start_hr]",
                date_end: "[date_end]",
                date_end_hr: "[date_end_hr]",
                day: "[day]",
                quantity_people: "[quantity_people]",
                advance_pay: "[advance_pay]",
                total_pay: "[total_pay]",
                notes: "[notes]",
                type_event: "[type_event]"
            },
            clauses: ["", "", "", "", "", "", "", "", "", ""] // 📌 Cláusulas configurables
        };

        const opts = Object.assign({}, defaults, options);

        // 📜 Construcción del encabezado del PDF con logo
        const header = `
        <div class="flex justify-end mb-4">
            <img src="https://huubie.com.mx/alpha/src/img/logo/logo.ico" alt="Logo" class="h-16 p-1">
        </div>
        <div class="event-header text-sm text-gray-800">
            <p><strong>CLIENTE:</strong> ${opts.data_header.contact}</p>
            <p><strong>TELÉFONO:</strong> ${opts.data_header.phone}</p>
            <p><strong>CORREO:</strong> ${opts.data_header.email}</p>
            <p><strong>TIPO :</strong> ${opts.data_header.type_event}</p>
        </div>`;

        // 📜 Construcción del cuerpo del PDF
        const template = `
        <div class="event-details mt-6 text-sm text-gray-800">
            <p>Agradecemos su preferencia por celebrar su evento con nosotros el día
            <strong>${opts.data_header.day}</strong>,
            <strong>${opts.data_header.date_start} ${opts.data_header.date_start_hr}</strong> a
            <strong>${opts.data_header.date_end} ${opts.data_header.date_end_hr}</strong>, en el salón
            <strong>${opts.data_header.location}</strong>.</p>
            <p>Estamos encantados de recibir a <strong>${opts.data_header.quantity_people}</strong> invitados y nos aseguraremos de que cada detalle esté a la altura de sus expectativas.</p>
            <br>
            ${opts.data_header.notes ? `<p><strong>NOTAS:</strong> ${opts.data_header.notes}</p>` : ""}
        </div>`;


        // 📜 Desgloze de Menu
        let menu = opts.dataMenu.data;

        const template_menu = `
         <div class="text-gray-800 mt-4" id="containerMenu">
            <div class=" text-sm font-bold mb-2">Menú</div>
            <div class = "d-inline-flex gap-3">
            <div>
                <strong>Paquete:</strong>
                <small>${menu.package_type}</small>
            </div>
            <div>
            <strong> Cantidad:</strong>
            <small>${menu.quantity}</small>
            </div>
            <div>
            <strong> Precio:</strong>
            <small>${formatPrice(menu.price)}</small>
            </div>

            </div>
        </div>
        `;

        console.log(opts.dataPayment)

        let templatePayment = '';

        opts.dataPayment.forEach((item) => {
            templatePayment += `
            <div class="flex justify-between ">
                <p class="font-bold">${item.method_pay}</p>
                <p> ${formatPrice(item.valor)}</p>
            </div>
            `;
        });


        // 📜 Estructura principal del documento
        const docs = `
        <div id="docEvent" class=" px-6 py-6 bg-white shadow-lg text-gray-800 rounded-lg">
            ${header}
            ${template}
            ${template_menu}
            <div class="text-gray-800 mt-4" id="containerEndFormat"></div>

            <!-- 📜 Sección de Totales (Subtotal, Total y Saldo) -->
            <div class="mt-6 mb-2  text-sm text-gray-800 flex justify-end">
                <div class="w-1/3">
                    <div class="flex justify-between  pt-2">
                        <p class="font-bold">Total</p>
                        <p>${formatPrice(opts.data_header.total_pay)}</p>
                    </div>
                    <div class="flex justify-between">
                        <p class="font-bold">Anticipo</p>
                        <p>${formatPrice(opts.data_header.advance_pay)}</p>
                    </div>
                    <div class="flex justify-between ">
                        <p class="font-bold"> Saldo</p>
                        <p>${formatPrice(opts.data_header.total_pay - opts.data_header.advance_pay)}</p>
                    </div>


                </div>
            </div>

            <div class="flex text-sm justify-end">
            <div class="w-1/3">
                <p class="font-bold  border-t my-1"> Forma de pago </p>
                ${templatePayment}
            </div>
            </div>

            <!-- 📜 Cláusulas configurables -->

            <div class="mt-8 mb-4 text-xs">
                <p class="font-bold"> Cláusulas </p>
                <ul class="list-decimal pl-5">
                    ${opts.clauses.map(clause => `<li>${clause}</li>`).join('')}
                </ul>
            </div>
        </div>`;

        $('#' + opts.parent).append(docs);

        // 📜 Aplicación del plugin rpt_json_table2 a la tabla del menú
        $('#containerEndFormat').rpt_json_table3({
            data: opts.dataMenu,
            color_th: 'bg-gray-200 p-1 text-center uppercase text-xs',
            class: 'w-full border-collapse  bg-white rounded-lg',
            center: [1],
            extends: true
        });
    }

    createPDFComponent(options) {
        // Valores por defecto
        const defaults = {
            parent: 'containerprimaryLayout',
            dataPackage: [],
            dataMenu: [],
            dataExtra: [],
            dataPayment: [],
            dataSubEvent: [],
            logo: "",
            location: 'Tapachula,Chis ',
            link: 'https://huubie.com.mx/alpha',
            type: 'Event',
            dataEvent: {
                name: "[name]",
                email: "[email]",
                phone: "[phone]",
                contact: "[contact]",
                idEvent: "[idEvent]",
                location: "[location]",
                date_creation: "[date_creation]",
                date_start: "[date_start]",
                date_start_hr: "[date_start_hr]",
                date_end: "[date_end]",
                date_end_hr: "[date_end_hr]",
                day: "[day]",
                quantity_people: "[quantity_people]",
                advance_pay: "[advance_pay]",
                total_pay: "[total_pay]",
                notes: "[notes]",
                type_event: "[type_event]",
                status: "[status]"
            },
            clauses: ["", "", "", ""]
        };

        const opts = Object.assign({}, defaults, options);

        // --- ENCABEZADO EVENTO ---
        const header = `
        <div class="flex justify-between items-start mb-2">
            ${opts.logo ? `<img src="${opts.link + opts.logo}" alt="Logo" class="w-20 h-20 rounded-full object-cover">` : ""}
            <p id="location-label">${opts.location ? opts.location : '<span class="text-gray-400">Ubicación no disponible </span>'}, a ${opts.dataEvent.date_creation}</p>
        </div>

        <div class="event-header text-sm text-gray-800 mb-2">
            <p class="font-bold uppercase">${opts.dataEvent.name}</p>
            ${opts.dataEvent.status === 'Cotización' ? `<p class="font-bold uppercase text-red-500">${opts.dataEvent.status}</p>` : ''}
            <p>${opts.dataEvent.date_start} ${opts.dataEvent.date_start_hr}</p>
            <p id="location-event"><strong>Lugar: </strong> ${opts.dataEvent.location ? opts.dataEvent.location : '<span class="text-gray-400">Obteniendo ubicación...</span>'}</p>
        </div>

        <div class="mb-2 text-justify">
            <p>Agradecemos su preferencia por celebrar su evento con nosotros el día
            <strong>${opts.dataEvent.day}</strong>,
            <strong>${opts.dataEvent.date_start} ${opts.dataEvent.date_start_hr}</strong>
            a <strong>${opts.dataEvent.date_end} ${opts.dataEvent.date_end_hr}</strong>, en el lugar
            <strong id="location-detail">${opts.dataEvent.location ? opts.dataEvent.location : '...'}</strong>.</p>
            <p>Estamos encantados de recibir a <strong>${opts.dataEvent.quantity_people}</strong> invitados y nos aseguraremos de que cada detalle esté a la altura de sus expectativas.</p>
            <br>
            ${opts.dataEvent.notes ? `<p><strong>NOTA:</strong> ${opts.dataEvent.notes}</p>` : ""}
        </div>
    `;

        // --- CONTENIDO (Menus, SubEventos o Extras) ---
        let subEvents = "";

        if (opts.type == 'Event') {
            // Menús del evento principal
            opts.dataMenu.forEach(menu => {
                subEvents += `
                <div class="mb-3 text-sm leading-5 ">
                    <p><strong>${menu.name || ""} (${menu.quantity || 0})</strong></p>
                    ${Array.isArray(menu.dishes) && menu.dishes.length > 0
                        ? `<ul class="text-[12px] mt-1 pl-6">
                            ${menu.dishes.map(d => `<li>- ${d.name} <span class="text-gray-400">(${d.quantity})</span></li>`).join("")}
                           </ul>`
                        : ""
                    }
                    <p class="mt-2"><strong>Costo:</strong>$ ${menu.price}</p>
                </div>
            `;
            });

            // Extras (adicionales al evento principal)
            const totalExtras = Array.isArray(opts.dataExtra)
                ? opts.dataExtra.reduce((acc, extra) => {
                    const quantity = Number(extra.quantity) || 0;
                    const price = Number(extra.price) || 0;
                    return acc + (quantity * price);
                }, 0)
                : 0;

            const extraItems = Array.isArray(opts.dataExtra) && opts.dataExtra.length > 0
                ? `
                <div class="mt-2 text-sm">
                    <p class="font-semibold">Extras</p>
                    <ul class="list-disc list-inside pl-6">
                        ${opts.dataExtra.map(extra => `
                            <li class="text-gray-700 text-[13px]">
                                ${extra.name || ""}
                                <span class="text-gray-400">${extra.quantity ? `(${extra.quantity})` : ""}</span>
                            </li>`).join("")}
                    </ul>
                    <div class="mt-2 flex">
                        <p class="mt-2"><strong>Costo:</strong>$ ${totalExtras.toLocaleString('es-MX')}</p>
                    </div>
                </div>`
                : "";

            subEvents += `
            <div class="mb-3 text-sm leading-6">
                ${extraItems}
            </div>
        `;

        } else {
            // SubEventos (evento compuesto)
            if (Array.isArray(opts.dataSubEvent) && opts.dataSubEvent.length > 0) {
                opts.dataSubEvent.forEach(sub => {
                    if (!sub) return;

                    let menuPackages = "";

                    if (sub.menu && typeof sub.menu === 'object' && Object.keys(sub.menu).some(key => !isNaN(key))) {
                        menuPackages = Object.entries(sub.menu)
                            .filter(([key]) => !isNaN(key))
                            .map(([key, pkg]) => {
                                const pkgDishes = (sub.menu.dishes || [])
                                    .filter(dish => dish.package_id === pkg.package_id)
                                    .map(dish => `<li class="mb-0.5 text-[12px] text-gray-600">${dish.name}${dish.quantity ? ` <span class="text-gray-400">(${dish.quantity})</span>` : ""}</li>`)
                                    .join("");

                                return `
                                <div class="">
                                    <div class="text-[14px] text-black mb-1">${pkg.name || "Paquete"}</div>
                                    <ul class="pl-5">${pkgDishes}</ul>
                                </div>`;
                            }).join("");
                    }

                    const extraItems = Array.isArray(sub.extras) && sub.extras.length > 0
                        ? `
                        <div class="mt-2 text-sm">
                            <p class="font-semibold">Extras</p>
                            <ul class="list-disc list-inside pl-6">
                                ${sub.extras.map(extra => `
                                    <li class="text-gray-700 text-[12px]">
                                        ${extra.name || ""} (${extra.quantity || 0})
                                    </li>`).join("")}
                            </ul>
                        </div>`
                        : "";

                    let costo = sub.total_pay !== null && sub.total_pay !== undefined && !isNaN(sub.total_pay)
                        ? `$${parseFloat(sub.total_pay).toLocaleString('es-MX')}`
                        : "-";

                    subEvents += `
                    <div class="mb-3 text-sm leading-5">
                        <p><strong>${sub.name_subevent || ""} para ${sub.quantity_people || 0} personas</strong>
                        (${sub.time_start || "-"} a ${sub.time_end || "-"} horas)</p>
                        <p class="text-capitalize font-semibold">${sub.location || ""}</p>
                        ${menuPackages}
                        ${extraItems}
                        <p class="mt-2"><strong>Costo:</strong> ${costo}</p>
                    </div>
                `;
                });
            }
        }

        // --- PAGOS Y TOTALES ---
        const total = parseFloat(opts.dataEvent.total_pay) || 0;
        const advance = parseFloat(opts.dataEvent.advance_pay) || 0;
        const discount = parseFloat(opts.dataEvent.discount || 0);

        let totalPagos = 0;
        let templatePayment = '';

        // Ciclo de pagos
        opts.dataPayment.forEach((item) => {
            const monto = parseFloat(item.valor) || 0;
            totalPagos += monto;
            templatePayment += `
            <div class="flex justify-between text-xs">
                <p class="font-semibold">${item.method_pay}</p>
                <p>${monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
            </div>`;
        });

        // Totales finales de pagos
        templatePayment += `
            <div class="flex justify-between text-xs border-t pt-2 mt-2">
                <p class="font-bold">Total Pagado</p>
                <p>${totalPagos.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
            </div>
            <div class="flex justify-between text-xs mt-3 border-t">
                <p class="font-bold">Restante</p>
                <p>${(total - advance - discount - totalPagos).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
            </div>`;

        // Bloque completo de totales
        const blockTotals = `
            <div class="text-xs w-full">
                <div class="flex flex-col gap-1">
                    <div class="flex justify-between"><p class="font-bold">Total</p><p>${total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p></div>
                    <div class="flex justify-between"><p class="font-bold">Anticipo</p><p>${advance.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p></div>
                    <div class="flex justify-between"><p class="font-bold">Descuento</p><p>${discount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p></div>
                    <div class="flex justify-between"><p class="font-bold">Saldo</p><p>${(total - advance - discount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p></div>
                </div>
                <div class="mt-3">
                    <p class="font-bold border-t my-1">Forma de pago</p>
                    ${templatePayment}
                </div>
            </div>`;

        // --- CLÁUSULAS ---
        let templateClauses = `
        <div class="mb-4  text-xs">
            <p class="font-bold">Cláusulas</p>
            <ul class="list-decimal pl-5">`;

        opts.clauses.forEach((clause, index) => {
            templateClauses += `<li>${clause.name}</li>`;
            if ((index + 1) % 5 === 0 && index + 1 < opts.clauses.length) {
                templateClauses += `</ul><div style="page-break-after: always;"></div><ul class='list-decimal pl-5'>`;
            }
        });

        templateClauses += `</ul></div>`;

        // --- DOCUMENTO FINAL ---
      const docs = `
        <div id="containerPdfEvent"> 
        <div id="docEvent"
            class="flex flex-col justify-between px-12 py-10 bg-white text-gray-800 shadow-lg rounded-lg"
            style="width: 816px; min-height: 1056px; background-image: url('https://huubie.com.mx/alpha/eventos/src/img/background.png'); background-repeat: no-repeat; background-size: 90% 100%; background-position: left top;">
            
            <!-- Cabecera + contenidos -->
            <div class="w-full pl-[120px] grow">
                ${header}
                ${subEvents}
            </div>

            <!-- Cláusulas y Totales -->
            <div class="w-full pl-[120px] mt-10 flex items-stretch gap-2">
                
                <!-- Cláusulas -->
                <div class="w-3/4 pr-2 border-r border-gray-200">
                    ${templateClauses}
                </div>

                <!-- Totales -->
                <div class="w-1/4 pl-2">
                    ${blockTotals}
                </div>
                
            </div>
        </div> 
        </div>
        `;

        // --- INYECTAR PDF EN CONTENEDOR ---
        $('#' + opts.parent).append(docs);

    }


    // createPDFComponent(options) {

    //     const defaults = {
    //         parent: 'containerprimaryLayout',
    //         dataPackage: [],
    //         dataMenu: [],
    //         dataExtra: [],
    //         dataPayment: [],
    //         dataSubEvent: [],
    //         logo: "",
    //         location: 'Tapachula,Chis ',
    //         link: 'https://huubie.com.mx/alpha',
    //         type: 'Event',
    //         dataEvent: {
    //             name: "[name]",
    //             email: "[email]",
    //             phone: "[phone]",
    //             contact: "[contact]",
    //             idEvent: "[idEvent]",
    //             location: "[location]",
    //             date_creation: "[date_creation]",
    //             date_start: "[date_start]",
    //             date_start_hr: "[date_start_hr]",
    //             date_end: "[date_end]",
    //             date_end_hr: "[date_end_hr]",
    //             day: "[day]",
    //             quantity_people: "[quantity_people]",
    //             advance_pay: "[advance_pay]",
    //             total_pay: "[total_pay]",
    //             notes: "[notes]",
    //             type_event: "[type_event]",
    //             status: "[status]"
    //         },
    //         clauses: ["", "", "", ""]
    //     };

    //     const opts = Object.assign({}, defaults, options);


    //     const header = `
    //         <div class="flex justify-between items-start mb-4">
    //             ${opts.logo ? `<img src="${opts.link + opts.logo}" alt="Logo" class="w-20 h-20 rounded-full object-cover">` : ""}
    //             <p id="location-label">${opts.location ? opts.location : '<span class="text-gray-400">Ubicación no disponible </span>'}, a ${opts.dataEvent.date_creation}</p>
    //         </div>

    //         <div class="event-header text-sm text-gray-800 mb-4">
    //             <p class="font-bold uppercase">${opts.dataEvent.name}</p>
    //             ${opts.dataEvent.status === 'Cotización' ? `<p class="font-bold uppercase text-red-500">${opts.dataEvent.status}</p>` : ''}
    //             <p>${opts.dataEvent.date_start} ${opts.dataEvent.date_start_hr}</p>
    //             <p id="location-event">${opts.dataEvent.location ? opts.dataEvent.location : '<span class="text-gray-400">Obteniendo ubicación...</span>'}</p>
    //         </div>

    //         <div class="mb-3 text-justify">
    //             <p>Agradecemos su preferencia por celebrar su evento con nosotros el día
    //             <strong>${opts.dataEvent.day}</strong>,
    //             <strong>${opts.dataEvent.date_start} ${opts.dataEvent.date_start_hr}</strong>
    //             a <strong>${opts.dataEvent.date_end} ${opts.dataEvent.date_end_hr}</strong>, en el salón
    //             <strong id="location-detail">${opts.dataEvent.location ? opts.dataEvent.location : '...'}</strong>.</p>
    //             <p>Estamos encantados de recibir a <strong>${opts.dataEvent.quantity_people}</strong> invitados y nos aseguraremos de que cada detalle esté a la altura de sus expectativas.</p>
    //             <br>
    //             ${opts.dataEvent.notes ? `<p><strong>NOTAS:</strong> ${opts.dataEvent.notes}</p>` : ""}
    //         </div>`;



    //     let subEvents = "";

    //     if (opts.type == 'Event') {


    //         opts.dataMenu.forEach(menu => {

    //             subEvents += `
    //                 <div class="mb-3 text-sm leading-5 ">
    //                 <p><strong>${menu.name || ""}  (${menu.quantity || 0
    //                 })</strong>
    //                 ${Array.isArray(menu.dishes) && menu.dishes.length > 0
    //                     ? `
    //                         <ul class=" text-[12px]  mt-1 pl-6">
    //                             ${menu.dishes
    //                         .map(
    //                             (d) =>
    //                                 `<li>- ${d.name}  <span class="text-gray-400">(${d.quantity})</span></li>`
    //                         )
    //                         .join("")}
    //                         </ul>
    //                     `
    //                     : ""
    //                 }
    //                 <p class="mt-2"><strong>Costo:</strong>$ ${menu.price}</p>
    //                 </div>
    //                 `;
    //         });

    //         // ------ EXTRAS ------

    //         // Calcula el costo total de los extras (cantidad * precio, suma todo)
    //         const totalExtras = Array.isArray(opts.dataExtra)
    //             ? opts.dataExtra.reduce((acc, extra) => {
    //                 const quantity = Number(extra.quantity) || 0;
    //                 const price = Number(extra.price) || 0;
    //                 return acc + (quantity * price);
    //             }, 0)
    //             : 0;

    //         // Render extras con lista y total elegante
    //         const extraItems =
    //             Array.isArray(opts.dataExtra) && opts.dataExtra.length > 0
    //                 ? `
    //             <div class="mt-2 text-sm">
    //                 <p class="font-semibold">Extras</p>
    //                 <ul class="list-disc list-inside pl-6">
    //                 ${opts.dataExtra
    //                     .map(
    //                         (extra) => `
    //                         <li class="text-gray-700 text-[13px]">
    //                         ${extra.name || ""}
    //                         <span class="text-gray-400">
    //                             ${extra.quantity ? `(${extra.quantity})` : ""}
    //                         </span>

    //                         </li>`
    //                     )
    //                     .join("")}
    //                 </ul>
    //                 <div class="mt-2 flex ">
    //                 <p class="mt-2"><strong>Costo:</strong>$ ${totalExtras.toLocaleString('es-MX')}</p>

    //                 </div>
    //             </div>`
    //                 : "";

    //         // Ejemplo de uso:
    //         subEvents += `
    //         <div class="mb-3 text-sm leading-6">
    //             ${extraItems}
    //         </div>
    //         `;

    //     } else {

    //         if (Array.isArray(opts.dataSubEvent) && opts.dataSubEvent.length > 0) {
    //             opts.dataSubEvent.forEach(sub => {

    //                 if (!sub) return;

    //                 // ------ PAQUETES ------
    //                 let menuPackages = "";
    //                 if (
    //                     sub.menu &&
    //                     typeof sub.menu === 'object' &&
    //                     Object.keys(sub.menu).some(key => !isNaN(key))
    //                 ) {
    //                     menuPackages = Object.entries(sub.menu)
    //                         .filter(([key]) => !isNaN(key)) // solo claves numéricas
    //                         .map(([key, pkg]) => {
    //                             const pkgDishes = (sub.menu.dishes || [])
    //                                 .filter(dish => dish.package_id === pkg.package_id)
    //                                 .map(dish =>
    //                                     `<li class="mb-0.5 text-[12px] text-gray-600">${dish.name}${dish.quantity ? ` <span class="text-gray-400">(${dish.quantity})</span>` : ""}</li>`
    //                                 ).join("");
    //                             return `
    //                 <div class="">
    //                     <div class=" text-[14px] text-black mb-1">${pkg.name || "Paquete"}</div>
    //                     <ul class=" pl-5">
    //                         ${pkgDishes}
    //                     </ul>
    //                 </div>`;
    //                         }).join("");
    //                 }

    //                 // ------ EXTRAS ------
    //                 const extraItems = Array.isArray(sub.extras) && sub.extras.length > 0
    //                     ? `
    //                     <div class="mt-2 text-sm">
    //                         <p class="font-semibold">Extras</p>
    //                         <ul class="list-disc list-inside pl-6">
    //                             ${sub.extras.map(extra => `
    //                                 <li class="text-gray-700 text-[12px]">
    //                                     ${extra.name || ""} (${extra.quantity || 0})
    //                                 </li>`).join("")}
    //                         </ul>
    //                     </div>`
    //                     : "";

    //                 // ------ Costo seguro ------
    //                 let costo = sub.total_pay !== null && sub.total_pay !== undefined && !isNaN(sub.total_pay)
    //                     ? `$${parseFloat(sub.total_pay).toLocaleString('es-MX')}`
    //                     : "-";

    //                 // ------ Render Subevento ------
    //                 subEvents += `
    //                     <div class="mb-3 text-sm leading-5">
    //                         <p><strong>${sub.name_subevent || ""} para ${sub.quantity_people || 0} personas</strong>
    //                         (${sub.time_start || "-"} a ${sub.time_end || "-"} horas)</p>
    //                         <p class="text-capitalize font-semibold">${sub.location || ""}</p>
    //                         ${menuPackages}
    //                         ${extraItems}
    //                         <p class="mt-2"><strong>Costo:</strong> ${costo}</p>
    //                     </div>
    //                 `;
    //             });
    //         }


    //     }







    //     const total = parseFloat(opts.dataEvent.total_pay) || 0;
    //     const advance = parseFloat(opts.dataEvent.advance_pay) || 0;
    //     const discount = parseFloat(opts.dataEvent.discount || 0);     // nuevo campo opcional

    //     let totalPagos = 0;
    //     let templatePayment = '';

    //     opts.dataPayment.forEach((item) => {
    //         const monto = parseFloat(item.valor) || 0;
    //         totalPagos += monto;
    //         templatePayment += `
    //         <div class="flex justify-between text-sm">
    //             <p class="font-semibold">${item.method_pay}</p>
    //             <p>${monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
    //         </div>`;
    //     });




    //     templatePayment += `

    //         <div class="flex justify-between text-sm border-t pt-2 mt-2">
    //             <p class="font-bold">Total Pagado</p>
    //             <p class="">${totalPagos.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
    //         </div>

    //         <div class="flex justify-between text-sm mt-3 border-t">
    //             <p class="font-bold"> Restante</p>
    //             <p class="">${(total - advance - discount - totalPagos).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
    //         </div>`;

    //     const blockTotals = `
    //         <div class="mt-6 mb-2 text-sm  flex justify-end">
    //             <div class="w-1/3">
    //                 <div class="flex justify-between pt-2">
    //                     <p class="font-bold"> Total </p>
    //                     <p>${total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
    //                 </div>
    //                 <div class="flex justify-between">
    //                     <p class="font-bold"> Anticipo </p>
    //                     <p>${advance.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
    //                 </div>
    //                 <div class="flex justify-between">
    //                     <p class="font-bold"> Descuento </p>
    //                     <p>${discount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
    //                 </div>
    //                 <div class="flex justify-between">
    //                     <p class="font-bold"> Saldo </p>
    //                     <p>${(total - advance - discount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
    //                 </div>
    //             </div>
    //         </div>

    //         <div class="flex text-sm justify-end mt-2">
    //             <div class="w-1/3">
    //                 <p class="font-bold border-t my-1">Forma de pago</p>
    //                 ${templatePayment}
    //             </div>
    //         </div>`;


    //     let templateClauses = `
    //         <div class="mb-4 mt-3 text-xs">
    //             <p class="font-bold">Cláusulas</p>
    //             <ul class="list-decimal pl-5">`;

    //     opts.clauses.forEach((clause, index) => {

    //         templateClauses += `<li>${clause}</li>`;
    //         if ((index + 1) % 5 === 0 && index + 1 < opts.clauses.length) {
    //             templateClauses += `</ul><div style="page-break-after: always;"></div><ul class='list-decimal pl-5'>`;
    //         }
    //     });

    //     templateClauses += `</ul></div>`;

    //     const docs = `
    //     <div id="docEvent"
    //         class="flex flex-col justify-between px-12 py-10 bg-white text-gray-800 shadow-lg rounded-lg"
    //         style="
    //             width: 816px;
    //             min-height: 1056px;
    //             background-image: url('https://huubie.com.mx/alpha/eventos/src/img/background.png');
    //             background-repeat: no-repeat;
    //             background-size: 90% 100%;
    //             background-position: left top;
    //         ">

    //         <div class="w-full pl-[120px] grow">
    //             ${header}
    //             ${subEvents}
    //         </div>

    //         <div class="w-full pl-[120px] mt-10">
    //             ${blockTotals}
    //             ${templateClauses}
    //         </div>
    //     </div>`;

    //     $('#' + opts.parent).append(docs);
    // }

    //  createPDFComponent(options) {

    //     const defaults = {
    //         parent: 'containerprimaryLayout',
    //         dataPackage: [],
    //         dataMenu: [],
    //         dataPayment: [],
    //         dataSubEvent: [],
    //         logo: "",
    //         location: 'Tapachula,Chis ',
    //         link: 'https://huubie.com.mx/alpha',

    //         dataEvent: {
    //             name: "[name]",
    //             email: "[email]",
    //             phone: "[phone]",
    //             contact: "[contact]",
    //             idEvent: "[idEvent]",
    //             location: "[location]",
    //             date_creation: "[date_creation]",
    //             date_start: "[date_start]",
    //             date_start_hr: "[date_start_hr]",
    //             date_end: "[date_end]",
    //             date_end_hr: "[date_end_hr]",
    //             day: "[day]",
    //             quantity_people: "[quantity_people]",
    //             advance_pay: "[advance_pay]",
    //             total_pay: "[total_pay]",
    //             notes: "[notes]",
    //             type_event: "[type_event]",
    //             status: "[status]"
    //         },
    //         clauses: ["", "", "", ""]
    //     };

    //     const opts = Object.assign({}, defaults, options);

    //     const header = `
    //         <div class="flex justify-between items-start mb-4">
    //             ${opts.logo ? `<img src="${opts.link + opts.logo}" alt="Logo" class="w-20 h-20 rounded-full object-cover">` : ""}
    //             <p id="location-label">${opts.location ? opts.location : '<span class="text-gray-400">Ubicación no disponible </span>'}, a ${opts.dataEvent.date_creation}</p>
    //         </div>

    //         <div class="event-header text-sm text-gray-800 mb-4">
    //             <p class="font-bold uppercase">${opts.dataEvent.name}</p>
    //             ${opts.dataEvent.status === 'Cotización' ? `<p class="font-bold uppercase text-red-500">${opts.dataEvent.status}</p>` : ''}
    //             <p>${opts.dataEvent.date_start} ${opts.dataEvent.date_start_hr}</p>
    //             <p id="location-event">${opts.dataEvent.location ? opts.dataEvent.location : '<span class="text-gray-400">Obteniendo ubicación...</span>'}</p>
    //         </div>

    //         <div class="mb-6 text-justify">
    //             <p>Agradecemos su preferencia por celebrar su evento con nosotros el día
    //             <strong>${opts.dataEvent.day}</strong>,
    //             <strong>${opts.dataEvent.date_start} ${opts.dataEvent.date_start_hr}</strong>
    //             a <strong>${opts.dataEvent.date_end} ${opts.dataEvent.date_end_hr}</strong>, en el salón
    //             <strong id="location-detail">${opts.dataEvent.location ? opts.dataEvent.location : '...'}</strong>.</p>
    //             <p>Estamos encantados de recibir a <strong>${opts.dataEvent.quantity_people}</strong> invitados y nos aseguraremos de que cada detalle esté a la altura de sus expectativas.</p>
    //             <br>
    //             ${opts.dataEvent.notes ? `<p><strong>NOTAS:</strong> ${opts.dataEvent.notes}</p>` : ""}
    //         </div>
    //     `;
    //     let subEvents = "";

    //     if (Array.isArray(opts.dataSubEvent) && opts.dataSubEvent.length > 0) {
    //         opts.dataSubEvent.forEach(sub => {

    //             if (!sub) return;

    //             // ------ PAQUETES ------
    //             let menuPackages = "";
    //             if (
    //                 sub.menu &&
    //                 typeof sub.menu === 'object' &&
    //                 Object.keys(sub.menu).some(key => !isNaN(key))
    //             ) {
    //                 menuPackages = Object.entries(sub.menu)
    //                     .filter(([key]) => !isNaN(key)) // solo claves numéricas
    //                     .map(([key, pkg]) => {
    //                         const pkgDishes = (sub.menu.dishes || [])
    //                             .filter(dish => dish.package_id === pkg.package_id)
    //                             .map(dish => `<li class="text-gray-700 text-[12px] ml-6">- ${dish.name} (${dish.quantity}) </li>`)
    //                             .join("");
    //                         return `
    //                     <div class="mt-2">
    //                         <p class="font-semibold"> ${pkg.name || ""}</p>
    //                         <ul class="list-none">${pkgDishes}</ul>
    //                     </div>`;
    //                     }).join("");
    //             }

    //             // ------ EXTRAS ------
    //             const extraItems = Array.isArray(sub.extras) && sub.extras.length > 0
    //                 ? `
    //                 <div class="mt-3 text-sm">
    //                     <p class="font-semibold">Extras</p>
    //                     <ul class="list-disc list-inside pl-6">
    //                         ${sub.extras.map(extra => `
    //                             <li class="text-gray-700 text-[12px]">
    //                                 ${extra.name || ""} (${extra.quantity || 0})
    //                             </li>`).join("")}
    //                     </ul>
    //                 </div>`
    //                 : "";

    //             // ------ Costo seguro ------
    //             let costo = sub.total_pay !== null && sub.total_pay !== undefined && !isNaN(sub.total_pay)
    //                 ? `$${parseFloat(sub.total_pay).toLocaleString('es-MX')}`
    //                 : "-";

    //             // ------ Render Subevento ------
    //             subEvents += `
    //                 <div class="mb-6 text-sm leading-6">
    //                     <p><strong>${sub.name_subevent || ""} para ${sub.quantity_people || 0} personas</strong>
    //                     (${sub.time_start || "-"} a ${sub.time_end || "-"} horas)</p>
    //                     <p>!${sub.location || ""}</p>
    //                     ${menuPackages}
    //                     ${extraItems}
    //                     <p class="mt-2"><strong>Costo:</strong> ${costo}</p>
    //                 </div>
    //             `;
    //         });
    //     }

    //     const total    = parseFloat(opts.dataEvent.total_pay) || 0;
    //     const advance  = parseFloat(opts.dataEvent.advance_pay) || 0;
    //     const discount = parseFloat(opts.dataEvent.discount || 0);     // nuevo campo opcional

    //     let totalPagos = 0;
    //     let templatePayment = '';

    //     opts.dataPayment.forEach((item) => {
    //         const monto = parseFloat(item.valor) || 0;
    //         totalPagos += monto;
    //         templatePayment += `
    //         <div class="flex justify-between text-sm">
    //             <p class="font-semibold">${item.method_pay}</p>
    //             <p>${monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
    //         </div>`;
    //     });




    //     templatePayment += `

    //         <div class="flex justify-between text-sm border-t pt-2 mt-2">
    //             <p class="font-bold">Total Pagado</p>
    //             <p class="">${totalPagos.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
    //         </div>

    //         <div class="flex justify-between text-sm mt-3 border-t">
    //             <p class="font-bold"> Restante</p>
    //             <p class="">${(total - advance - discount - totalPagos).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
    //         </div>`;

    //     const blockTotals = `
    //         <div class="mt-6 mb-2 text-sm  flex justify-end">
    //             <div class="w-1/3">
    //                 <div class="flex justify-between pt-2">
    //                     <p class="font-bold"> Total </p>
    //                     <p>${total.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
    //                 </div>
    //                 <div class="flex justify-between">
    //                     <p class="font-bold"> Anticipo </p>
    //                     <p>${advance.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
    //                 </div>
    //                 <div class="flex justify-between">
    //                     <p class="font-bold"> Descuento </p>
    //                     <p>${discount.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
    //                 </div>
    //                 <div class="flex justify-between">
    //                     <p class="font-bold"> Saldo </p>
    //                     <p>${(total - advance - discount).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' })}</p>
    //                 </div>
    //             </div>
    //         </div>

    //         <div class="flex text-sm justify-end mt-2">
    //             <div class="w-1/3">
    //                 <p class="font-bold border-t my-1">Forma de pago</p>
    //                 ${templatePayment}
    //             </div>
    //         </div>`;


    //     let templateClauses = `
    //         <div class="mb-4 mt-3 text-xs">
    //             <p class="font-bold">Cláusulas</p>
    //             <ul class="list-decimal pl-5">`;

    //     opts.clauses.forEach((clause, index) => {

    //         templateClauses += `<li>${clause}</li>`;
    //         if ((index + 1) % 5 === 0 && index + 1 < opts.clauses.length) {
    //             templateClauses += `</ul><div style="page-break-after: always;"></div><ul class='list-decimal pl-5'>`;
    //         }
    //     });

    //     templateClauses += `</ul></div>`;

    //     const docs = `
    //     <div id="docEvent"
    //         class="flex flex-col justify-between px-12 py-10 bg-white text-gray-800 shadow-lg rounded-lg"
    //         style="
    //             width: 816px;
    //             min-height: 1056px;
    //             background-image: url('https://huubie.com.mx/alpha/eventos/src/img/background.png');
    //             background-repeat: no-repeat;
    //             background-size: 90% 100%;
    //             background-position: left top;
    //         ">

    //         <div class="w-full pl-[120px] grow">
    //             ${header}
    //             ${subEvents}
    //         </div>

    //         <div class="w-full pl-[120px] mt-10">
    //             ${blockTotals}
    //             ${templateClauses}
    //         </div>
    //     </div>`;

    //     $('#' + opts.parent).append(docs);
    // }



}


function formatPrice(amount, locale = 'es-MX', currency = 'MXN') {
    // Verificar si el monto es null, undefined o 0
    if (!amount) {
        return '-';
    }
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency
    }).format(amount);
}
