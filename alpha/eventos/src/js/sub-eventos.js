let idEvent;
let id_subevent = 0;
class SubEvent extends App {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "SubEvent";
        this.menusSeleccionados = [];
        this.menuSeleccionadoParaVer = null;
        this.extrasSeleccionados = [];
        this.clasificaciones = [];
    }

    layout() {
        this.primaryLayout({
            parent: "root",
            id: "SubEvent", // nombre referencia
            class: 'flex mx-2 my-2 h-100 mt-5 p-2',

            card: {
                filterBar: {
                    id: "filterBarSubEvent",
                    class: "w-full my-3 "
                },
                container: {
                    class: "w-full my-3 bg-[#1F2A37] rounded-lg",
                },
            },
        });

        // Filterbar con botón regresar
        this.createfilterBar({
            parent: "filterBarSubEvent",
            class:'border',
            data: [
                {
                    opc: "button",
                    class: "col-sm-2",
                    id: "btnRegresarSub",
                    text: "<i class='icon-reply'></i><span class='text-sm'> Back</span>",
                    className: '',
                    onClick: () => eventos.render()
                },
            ],
        });

        $("#containerSubEvent").removeClass("d-flex mx-2 my-2 h-100 mt-5 p-4");

        $("#containerSubEvent").simple_json_tab({
            class: "p-4",
            id: "tabsSubEvent",
            data: [
                { tab: "Eventos", id: "tab-new-event", active: true },
                { tab: "Sub Eventos", id: "tab-new-subevent" },
            ],
        });

        // Inicialización
        this.addEvent();
        this.showSubEvent();
    }

    layoutEditSubEvent() {
        this.primaryLayout({
            parent: "root",
            id: "SubEvent",
            class: 'flex mx-2 my-2 h-100 mt-5 p-2',

            card: {
                filterBar: {
                    id: "filterBarSubEvent",
                    class: ""
                },
                container: {
                    class: "w-full my-3 bg-[#1F2A37] rounded-lg",
                },
            },
        });

        this.createfilterBar({
            parent: "filterBarSubEvent",
            data: [
                {
                    opc: "button",
                    class: "col-sm-2",
                    id: "btnRegresarSub",
                    text: "<i class='icon-reply'></i><span class='text-sm'> Back</span>",
                    className: '',
                    onClick: () => eventos.render()
                },
            ],
        });

        $("#containerSubEvent").removeClass("d-flex mx-2 my-2 h-100 mt-5 p-4");

        $("#containerSubEvent").simple_json_tab({
            class: "p-4 h-100",
            id: "tabsSubEvent",
            data: [
                { tab: "Eventos", id: "tab-new-event", active: true },
                { tab: "Sub Eventos", id: "tab-new-subevent", onClick: () => this.showSubEvent() },
            ],
        });

        $("#tab-new-event").html(`<form id="formEvent" novalidate></form>`);
    }


    // Evento.

    addEvent() {

        $("#tab-new-event").html(`<div><form id="formEvent" novalidate></form></div>`);

        this.createForm({
            parent: 'formEvent',
            id: 'frmEvento',

            data: { opc: 'addEvent' },
            json: this.jsonEvent(),
            

            success: (response) => {
                if (response.status == 200) {

                    idEvent = response.data.id;
                    alert({
                        icon: "success",
                        title: "Evento creado con éxito!",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });


                    $('#btnAddSubEvent').removeClass('d-none');
                    console.log($("#btnNewSubEvent"))

                    $("#formEvent button[type='submit']").removeAttr("disabled");
                    $("#formEvent input").attr("disabled", "disabled");
                    $("#formEvent select").attr("disabled", "disabled");
                    $("#formEvent textarea").attr("disabled", "disabled");
                    $("#tab-new-subevent-tab").tab("show");
                    $("#btnGuardar").addClass("d-none");
                    $("#btnCancelar").addClass("d-none");




                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });
                    $("#formEvent button[type='submit']").removeAttr("disabled");
                }
            }
        });

        // initialized.
        $("#date_start").val(new Date().toISOString().split("T")[0]);
        $("#date_end").val(new Date().toISOString().split("T")[0]);
        $('#lblCliente').addClass('border-b p-1');
        $('#lblEvento').addClass('border-b p-1');

        $("#phone").on("input", function () {
            let value = $(this).val().replace(/\D/g, ""); // Elimina caracteres no numéricos
            if (value.length > 10) {
                value = value.slice(0, 10); // Limita a 9 dígitos
            }
            $(this).val(value);
        });

    }

    async editSubevent(idEvents) {

        this.layoutEditSubEvent();
        idEvent = idEvents;
        let subEvents = await useFetch({ url: this._link, data: { opc: "getEvent", id: idEvents } });
        const jsonEvent = this.jsonEvent();


        this.createForm({
            parent: 'formEvent',
            id: 'editEvents',
            autofill: subEvents.data,
            data: { opc: 'editEvents', id: idEvent },
            json: jsonEvent,

            success: (response) => {

                if (response.status == 200) {

                    alert({
                        icon: "success",
                        title: "Evento actualizado con éxito",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok",
                    });


                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok",
                    });

                    $("#formEvent button[type='submit']").removeAttr("disabled");
                }


            }
        });


        // initialized.
        $('#lblCliente').addClass('border-b p-1');
        $('#lblEvento').addClass('border-b p-1');
        $("#phone").on("input", function () {
            let value = $(this).val().replace(/\D/g, ""); // Elimina caracteres no numéricos
            if (value.length > 10) {
                value = value.slice(0, 10); // Limita a 9 dígitos
            }
            $(this).val(value);
        });

        this.showSubEvent();
    }

    jsonEvent() {
        return [
            // 📜 Datos del Cliente
            {
                opc: "label",
                id: 'lblCliente',
                text: "Datos del cliente",
                class: "col-12 fw-bold text-lg mb-2"
            },
            {
                opc: "input",
                lbl: "Contacto",
                id: "name_client",
                class: "col-12 col-sm-4 col-lg-3 mb-3",
                tipo: "texto",
                placeholder: "Nombre del contacto"
            },
            {
                opc: "input",
                lbl: "Teléfono",
                id: "phone",
                class: "col-12 col-sm-4 col-lg-3",
                tipo: "tel",
                placeholder: "999-999-9999"
            },
            {
                opc: "input",
                lbl: "Correo electrónico",
                id: "email",
                class: "col-12 col-sm-4 col-lg-3",
                tipo: "email",
                placeholder: "cliente@gmail.com"
            },

            // 📜 Datos del Evento
            {
                opc: "label",
                id: 'lblEvento',
                text: "Datos del evento",
                class: "col-12 fw-bold text-lg mt-2 mb-2"
            },
            {
                opc: "input",
                lbl: "Evento",
                id: "name_event",
                class: "col-12 col-sm-4 col-lg-3",
                tipo: "texto",
                placeholder: "Nombre del evento"
            },
            {
                opc: "input",
                lbl: "Locación",
                id: "location",
                class: "col-12 col-sm-4 col-lg-3 mb-3",
                tipo: "texto",
                placeholder: "Locación"
            },
            {
                opc: "input",
                lbl: "Fecha de inicio",
                id: "date_start",
                class: "col-12 col-sm-4 col-lg-3",
                type: "date",
            },
            {
                opc: 'input',
                lbl: 'Hora de inicio',
                id: 'time_start',
                tipo: 'hora',
                type: "time",
                class: 'col-12 col-sm-4 col-lg-3 mb-3',
                required: true
            },
            {
                opc: "input",
                lbl: "Fecha de cierre",
                id: "date_end",
                class: "col-12 col-sm-4 col-lg-3 mb-3",
                type: "date",
            },
            {
                opc: 'select',
                lbl: 'Tipo de evento',
                id: 'type_event',
                class: 'col-12 col-sm-4 col-lg-3 mb-3',
                data: [
                    { id: 'Abierto', valor: "Abierto" },
                    { id: 'Privado', valor: "Privado" }
                ]
            },
     
            {
                opc: 'input',
                placeholder: '0.00',
                lbl: 'Total',
                id: 'total_pay',
                tipo: 'cifra',
                class: 'col-12 col-sm-4 col-lg-3 mb-3',
                required: false
            },


            {
                opc: "textarea",
                lbl: "Observaciones",
                id: "notes",
                class: "col-12 col-sm-12 col-md-12 col-lg-12",
                rows: 3
            },

            // 📏 Botones
            {
                opc: "btn-submit",
                id: "btnGuardar",
                text: "Guardar",
                class: "col-5 col-sm-3 col-md-2 col-lg-2 offset-lg-8"
            },
            {
                opc: "button",
                id: "btnCancelar",
                text: "Cancelar",
                class: "col-6 col-sm-3 col-md-2 col-lg-2",
                color_btn: "danger",
                className: 'w-full',
                onClick: () => eventos.closeEvent()
            }
        ];
    }


    // Discount

    async Descuento(id) {
        let event = await useFetch({ url: this._link, data: { opc: "getEvent", id: id } });
        const totalOriginal = parseFloat(event.data.total_pay);

        this.createModalForm({
            id: "modalDescuento",
            parent: "root",
            autofill: event.data,
            data: { opc: "applyDiscount", id: id },
            class: "",

            title: "Aplicar Descuento",
            subtitle: "Aplica descuentos",
            json: [
                {
                    opc: "input-group",
                    id: "total_pay",
                    lbl: "Total a pagar",
                    icon: 'icon-dollar',
                    disabled: true,
                    tipo: "cifra",
                    class: "col-12 mb-3"
                },
                {
                    opc: "input-group",
                    id: "discount",
                    lbl: "Monto de Descuento",
                    icon: 'icon-dollar',
                    tipo: "cifra",
                    class: "col-12 mb-3",
                    placeholder: "$ 0.00",
                    required: true,
                    onkeyup: `sub.calculateDiscounted(${totalOriginal})`
                },
                {
                    opc: "input",
                    id: "info_discount",
                    lbl: "Motivo del Descuento",
                    class: "col-12",
                    placeholder: "Ej: CLIENTE FRECUENTE",
                    required: true
                },

                ...(parseFloat(event.data.discount) > 0 ? [{
                    opc: "button",
                    id: "btnremoveDiscount",
                    color_btn: "outline-info",
                    className: 'w-100',
                    text: "Quitar descuento actual",
                    class: "col-12",
                    onClick: () => {
                        this.removeDiscount(id, {
                            name_event: event.data.name_event,
                            discount: event.data.discount,
                            reason: event.data.info_discount,
                            total: event.data.total_pay,
                        });
                        $('#modalDescuento').closest('.bootbox').modal('hide');
                    }
                }] : []),

                {
                    opc: "div",
                    id: "totalDescontado",
                    class: 'col-12',
                    html: `
                    <div class="w-full mt-3 text-center bg-[#1E293B] p-4 rounded-lg ">
                        <p class="text-sm text-gray-400 font-medium mb-1">Total con Descuento</p>
                        <p id="TotalConDescuento" class="text-2xl text-white font-bold">$${totalOriginal}</p>
                    </div>
                `
                }
            ],
            bootbox: {
                title: `<h2 class="text-base font-semibold"><i class="icon-tag"></i> Aplicar Descuento a ${event.data.name_event}</h2>`,
            },
            success: (res) => {
                if (res.status === 200) {
                    alert({ icon: "success", text: res.message });
                    app.ls();
                } else {
                    alert({ icon: "error", text: res.message });
                }
            }
        });

        this.calculateDiscounted(totalOriginal);
    }

    calculateDiscounted(saldo) {
        const descuentoInput = document.getElementById("discount");
        const saldoElement = document.getElementById("TotalConDescuento");
        const applyBtn = document.querySelector(".bootbox .btn-primary");

        if (descuentoInput && saldoElement && applyBtn) {
            const saldoOriginal = parseFloat(saldo) || 0;
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
            } else {
                saldoElement.classList.remove("text-red-500");
            }

            applyBtn.disabled = nuevoTotal < 0;
        }
    }

    removeDiscount(id, event) {
        const { name_event, discount, percentage, reason, total } = event;

        this.createModalForm({
            id: "modalQuitarDescuento",
            parent: "root",
            data: { opc: "removeDiscount", id: id },
            class: "",
            json: [
                {
                    opc: "div",
                    id: "bloqueDescuentoActual",
                    class: "col-12",
                    html: `
                    <div class="bg-[#334155] text-red-400 p-4 rounded-lg">
                        <p class="text-sm">Descuento actual:</p>
                        <p class="text-lg font-bold">-$${discount.toLocaleString('es-MX')} </p>
                        <p class="text-sm text-white">${reason}</p>
                    </div>
                `
                },
                {
                    opc: "div",
                    id: "bloquePrecioSinDescuento",
                    class: "col-12",
                    html: `
                    <div class="bg-[#1E293B] p-4 rounded-lg text-center">
                        <p class="text-sm text-gray-400">Precio sin descuento</p>
                        <p class="text-2xl font-bold text-white">$${total.toLocaleString('es-MX')}</p>
                    </div>
                `
                },
                {
                    opc: "div",
                    id: "mensajeConfirmacion",
                    class: "col-12 text-center",
                    html: `<p class="text-sm text-gray-400">¿Estás seguro de que deseas quitar el descuento aplicado?</p>`
                },
            ],
            success: (response) => {

                if (response.status == 200) {
                    alert({
                        icon: "success",
                        title: "Se ha quitado el descuento con éxito",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok",
                    });
                    app.ls();
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok",
                    });
                }

            },
            bootbox: {
                title: `<i class="icon-tag"></i> Quitar Descuento de ${name_event}`,
                closeButton: true
            },

        });
    }

    // Sub evento

    addSubEvent() {
        this.createModalForm({
            id: 'frmModalSubEvent',
            data: { opc: 'addSubEvent', evt_events_id: idEvent },
            bootbox: {
                title: 'Crear nuevo sub-evento',
                size: 'large'
            },
            json: this.jsonSubEvent(),
            success: (response) => {
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        title: "Continua con el menú dando CLICK al subevento 🍜👇",
                        // text: response.message,
                        btn1: true,
                        btn1Text: "Ok",
                    });

                    this.showSubEvent();
                    $("#btnNewSubEvent").removeClass("d-none");

                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok",
                    });
                }
            }
        });

        // initialized.
        $("#frmModalSubEvent #date_start").val(new Date().toISOString().split("T")[0]);
        $("#frmModalSubEvent #date_end").val(new Date().toISOString().split("T")[0]);

    }

    async editSubEvent(item) {
        let request = await useFetch({ url: this._link, data: { opc: "getSubEvent", id: item.id, } });

        this.createModalForm({
            id: 'frmEdit',
            title: 'Editar Sub Evento',
            autofill: request.data[0],
            data: { opc: 'editSubEvent', id: item.id, evt_events_id: request.data[0].evt_events_id },
            bootbox: {
                title: 'Editar sub Evento',
                size: 'large'
            },
            json: this.jsonSubEvent(),
            success: (response) => {
                if (response.status == 200) {
                    alert({
                        icon: "success", text: response.message,
                    });
                    this.showSubEvent();
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok",
                    });

                }

            }
        });

    }

    async showSubEvent() {

        let subEvents = await useFetch({
            url: this._link,
            data: {
                opc: "listSubEvents",
                id: idEvent
            }
        });


        if (subEvents.status == 200) {
            this.accordingMenu({
                parent: 'tab-new-subevent',
                title: 'Evento  : ' + subEvents.event.name_event,
                subtitle: subEvents.event.status,
                data: subEvents.data,

                center: [1, 2, 3, 6],
                right: [5],

                onAdd: () => { this.addSubEvent() },

                onEdit: (item, index) => {
                    this.editSubEvent(item)
                },
                onDelete: (item, index) => {
                    this.cancelSubEvent(item)
                },

                onPrint: (item) => {
                    payment.onShowDocument(idEvent)
                },

                onShow: (id) => {
                    id_subevent = id;

                    this.addMenu(id);


                }
            });

        } else {
            const emptySubEvent = $(`
                    <div class="flex flex-col items-center justify-content-start py-12 text-center h-full  bg-[#1F2A37] rounded-lg">
                    <i class="icon-calendar-1 text-[52px] text-gray-100"></i>
                    <h3 class="text-xl font-medium text-gray-100 mb-2">No hay sub-eventos</h3>
                    <p class="text-gray-400 mb-4">Comienza agregando tu primer sub-evento</p>
                    <button  id="btnAddSubEvent" class=" bg-gray-600 hover:bg-gray-700  px-4 py-2 rounded text-white ">
                    <span class="icon-plus-1"></span>
                    Nuevo Sub-evento
                    </button>
                </div> `);

            emptySubEvent.find("#btnAddSubEvent").on("click", () => {
                this.addSubEvent();
            });


            // 📌 Render
            $(`#tab-new-subevent`).html(emptySubEvent);


        }

    }

    // Menu package,extra.
    async addMenu(id) {

        let response = await useFetch({
            url: this._link,
            data: { opc: "getSubEventMenus", subevent_id: id }
        });

        let initMenu = await useFetch({ url: this._link, data: { opc: "getInitMenu", subevent_id: id } });

        this.MenuComponent({
            parent: 'containerInfo' + id,
            id: id,
            menus: initMenu.packages,
            extras: initMenu.products,
            clasification: initMenu.classifications,
            sub: {
                menusSeleccionados: response.menus,
                extrasSeleccionados: response.extras
            },

            // eventos:
            onAddPackage: () => { this.addPackage(id) },
            onAddExtra: () => { this.addExtra(id) },
            onAddExtraCustom: () => { this.addExtraCustom(id) },

        });

    }

   

  
    // Components:
    accordingMenu(options) {
        const defaults = {
            parent: "tab-sub-event",
            id: "accordionTable",
            title: 'Titulo',
            subtitle: 'Subtitulo',
            color_primary: 'bg-[#1F2A37]',
            data: [],
            center: [1, 2, 5],
            right: [3, 4],
            onShow: () => { },
        };

        const opts = Object.assign(defaults, options);
        const container = $('<div>', {
            id: opts.id,
            class: `${opts.color_primary} rounded-lg my-5 border border-gray-700 overflow-hidden`
        });

        const titleRow = $(`
            <div class="flex justify-between items-center px-4 py-3 border-b border-gray-800 ">
                <div>
                    <h2 class="text-base font-semibold text-white">${opts.title}</h2>
                    ${opts.subtitle
                        ? `<span class="inline-block mt-1 text-xs font-medium text-gray-300 bg-gray-700 px-2 py-1 rounded-full">${opts.subtitle}</span>`
                        : ""
                    }
                </div>
                <div class="flex items-center gap-1 space-x-1">
                    <button id="btn-new-sub-event" class="bg-gray-600 hover:bg-gray-700 text-white text-xs px-3 py-2 rounded  border-r border-gray-700 focus:z-10 min-w-[120px] flex items-center justify-center gap-1 shadow-none">
                        <span class="text-lg">＋</span> Nuevo
                    </button>
                    <button id="btn-print-sub-event" class="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-2 rounded border-r border-gray-700 focus:z-10 min-w-[120px] flex items-center justify-center gap-1 shadow-none">
                        <span class="text-lg">🖨️</span> Imprimir
                    </button>
                    <button id="btn-action3" class="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-2 rounded focus:z-10 min-w-[120px] flex items-center justify-center gap-1 shadow-none">
                        <span class="text-lg">⚙️</span> Panel de admin
                    </button>
                </div>
            </div>
        `);


        titleRow.find("#btn-new-sub-event").on("click", () => {
            if (typeof opts.onAdd === "function") opts.onAdd();
        });
        titleRow.find("#btn-print-sub-event").on("click", () => {
            if (typeof opts.onPrint === "function") opts.onPrint();
        });
        titleRow.find("#btn-action3").on("click", () => {
            window.location.href = 'https://huubie.com.mx/alpha/catalogos/';
            if (typeof opts.configuration === "function") opts.onAction3();
        });

        container.append(titleRow);

        // Nota del evento si existe
        if (opts.data.length > 0 && opts.data[0].note) {
            const noteRow = $(`<div class="px-4 text-sm text-gray-400 mb-2">${opts.data[0].note}</div>`);
            container.append(noteRow);
        }

        // ----- Agrupador padre para thead y rows -----
        const divRowsContainer = $('<div>', { id: "rows-container" });

        // Header
        const firstItem = opts.data[0] || {};
        const keys = Object.keys(firstItem).filter(k => k !== 'body' && k !== 'id');

        const headerRow = $('<div>', {
            class: "flex justify-between items-center px-4 py-2 font-medium text-gray-400 border-b border-gray-700 text-sm"
        });
        headerRow.append(`<div class="w-6"></div>`);
        keys.forEach(key => {
            headerRow.append(`<div class="flex-1 text-center truncate">${key.charAt(0).toUpperCase() + key.slice(1)}</div>`);
        });
        headerRow.append(`<div class="flex-none text-right">Acciones</div>`);
        divRowsContainer.append(headerRow);

        // 🔁 Render de cada fila
        opts.data.forEach((opt, index) => {
            const rowId = `row-${opt.id}`;
            const row = $('<div>', { class: "border-gray-700", id: rowId });

            const collapseIcon = $('<span>', {
                class: "mr-2 cursor-pointer select-none transition-transform duration-200",
                html: '<i class="icon-right-dir"></i>',
            });

            const header = $(`<div class="flex justify-between items-center px-3 py-2 border-y border-gray-700 hover:bg-[#18212F] bg-[#313D4F] cursor-pointer"></div>`);
            header.append($('<div class="w-6 flex items-center justify-center">').append(collapseIcon));

            keys.forEach((key, i) => {
                let align = "text-left";
                if (opts.center.includes(i)) align = "text-center";
                if (opts.right.includes(i)) align = "text-end";
                header.append(`<div class="flex-1 px-3 text-gray-300 truncate ${align}">${opt[key]}</div>`);
            });

            const actions = $(`
            <div class="flex-none flex gap-2 mx-2">
                <button class="btn-edit bg-gray-700 text-white text-sm px-2 py-1 rounded" title="Editar">✏️</button>
                <button class="btn-delete bg-gray-700 text-red-500 text-sm px-2 py-1 rounded" title="Eliminar">🗑️</button>
            </div>`);
            header.append(actions);

            // Container collapsed
            let bodyWrapper = $('<div>', {
                class: "bg-[#1F2A37] hidden px-4 py-4 text-sm text-gray-300 accordion-body",
                id: 'containerInfo' + opt.id,
                html: ``
            });

            function toggleCollapseIcon(expanded) {
                collapseIcon.html(
                    expanded ? '<i class="icon-down-dir"></i>' : '<i class="icon-right-dir"></i>'
                );
            }

            header.on("click", function (e) {
                let target = $(e.target);
                if (target.closest(".btn-edit").length || target.closest(".btn-delete").length) return;

                divRowsContainer.find(".active-row").removeClass("active-row").css("background", "");
                $(".accordion-body").slideUp();
                $(".mr-2").html('<i class="icon-right-dir"></i>');

                let isVisible = bodyWrapper.is(":visible");
                if (!isVisible) {
                    header.addClass("active-row").css("background", "#111827");
                    bodyWrapper.slideDown(200);
                    toggleCollapseIcon(true);
                    if (typeof opts.onShow === 'function') opts.onShow(opt.id);
                } else {
                    header.removeClass("active-row").css("background", "");
                    bodyWrapper.slideUp(200);
                    toggleCollapseIcon(false);
                }
            });

            header.find(".btn-edit").on("click", e => {
                e.stopPropagation();
                if (typeof opts.onEdit === "function") opts.onEdit(opt, index);
            });
            header.find(".btn-delete").on("click", e => {
                e.stopPropagation();
                if (typeof opts.onDelete === "function") opts.onDelete(opt, index);
            });

            row.append(header, bodyWrapper);
            divRowsContainer.append(row);
        });

        // Inserta el padre de filas y encabezado al container principal
        container.append(divRowsContainer);

        // 📌 Calcular total general
        let totalGral = opts.data.reduce((sum, el) => {
            let clean = (el.Total || '0').toString().replace(/[^0-9.-]+/g, '');
            return sum + (parseFloat(clean) || 0);
        }, 0);

        const totalGeneralDiv = $(`
            <div class="flex justify-between items-center px-4 py-4 space-y-2 mt-3 border-t border-gray-800 text-white text-sm">
                <div class="font-semibold text-green-400 text-lg">
                    TOTAL GRAL: <span id="spanTotalGeneral">$${totalGral.toLocaleString(undefined, { minimumFractionDigits: 2, })}</span>
                </div>
                <div class="flex items-center gap-2">
                    <button type="button" class="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2 rounded focus:outline-none shadow-none" onclick="sub.addMenus()">Guardar</button>
                    <button type="button" class="bg-gray-600 hover:bg-gray-700 text-white font-medium px-6 py-2 rounded focus:outline-none shadow-none" onclick="eventos.closeEvent()">Cerrar</button>
                </div>
            </div>
        `);

        container.append(totalGeneralDiv);

        // ---- Función extender: sumar y actualizar total general ----
        container[0].totalGral = function (options) {
            let defaults = {
                id: '#accordionTable',
                position: 5

            };

            let opts = $.extend({}, defaults, options);

            let total = 0;

            $('#accordionTable #rows-container > div[id^="row-"]').each(function () {
                // Busca el div de total (por posición o por clase, si es siempre el mismo)
                let $totalDiv = $(this).find('div.flex-1').eq(opts.position);
                let val = $totalDiv.text().replace(/[^0-9.-]+/g, ''); // quita $ y comas
                total += parseFloat(val) || 0;
            });

            $('#spanTotalGeneral').html(formatPrice(total));
        };

        // Renderiza todo
        $(`#${opts.parent}`).html(container);


    }

    addMenus(){

        alert({
            icon: "success",
            text: `Menú(s) y/o extra(s) agregados correctamente. 🍽️✨`,
            timer: 2000,
        });

    }

    MenuComponent(options) {
        const defaults = {
            parent: 'root',
            id: 0,
            title: 'Selecciona Menú',
            class: '',
            sub: null,
            menus: [],
            extras: [],
            resumen: {},
            onAddPackage: () => { },
            onAddExtra: () => { },
            onSubmit: () => { },
            onAddExtraCustom: () => { }
        };

        const opts = Object.assign({}, defaults, options);

        $(`#${opts.parent}`).empty();
        // <div>
        //     <label class="block text-sm font-medium text-gray-300 mb-1">Tiempos</label>
        //     <select class="selectMenu w-full rounded-md bg-gray-800 text-white border border-gray-600 p-2">
        //     </select>
        // </div>

        // Interfaz.
        const paquetes = `
            <div class="md:col-span-2 ">
            <div class="bg-[#1F2A37] rounded-lg border border-gray-700 shadow-md p-6 text-white">
                <div class="mb-4">
                <h3 class="text-xl font-bold">${opts.title}</h3>
                <p class="text-sm text-gray-400">Elija uno o más menús/paquetes y la cantidad de personas</p>
                </div>
                <form id="formMenu${opts.id
            }" class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Paquete Precargado</label>
                        <select class="selectMenu w-full rounded-md bg-gray-800 text-white border border-gray-600 p-2">
                        <option value="">Seleccione un menú</option>
                        ${opts.menus
                .map(
                    (m) =>
                        `<option value="${m.id}">${m.nombre
                        } - ${formatPrice(
                            m.precioPorPersona
                        )} / persona</option>`
                )
                .join("")}
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300 mb-1">Cantidad</label>
                        <input type="number" min="1" value="1" class="cantidadPersonas w-full rounded-md bg-gray-800 text-white border border-gray-600 p-2" />
                    </div>



                    <div class="flex items-end">
                        <button type="button" class="btnAgregarMenu w-full flex items-center justify-center gap-2 bg-[#1A56DB] hover:bg-[#274DCD] text-white font-medium py-2 px-4 rounded-md">
                        <i class="icon-plus-circle"></i> Agregar Menú
                        </button>
                    </div>
                </form>
                <hr class="border-gray-700 mb-4" />
                <div>
                <h4 class="font-semibold text-white mb-2">Menús seleccionados</h4>
                <div class="contentPaquetes bg-gray-900 text-gray-400 p-4 rounded-md text-center">
                    No hay menús seleccionados
                </div>
                <div class="detalleMenuSeleccionado-${opts.id} mt-6"></div>
                </div>
            </div>
            </div>`;

        const resumen = `
            <div class="bg-[#1F2A37] h-full rounded-lg border border-gray-700 shadow-md p-6 text-white">
            <div class="mb-4">
                <h3 class="text-xl font-bold">Resumen del Pedido</h3>
                <p class="text-sm text-gray-400">Detalles de su selección</p>
            </div>
            <div class="contentResumen bg-gray-900 text-gray-400 p-4 rounded-md text-center">
                ${opts.resumen.mensaje || 'Seleccione al menos un menú para ver el resumen'}
            </div>
            </div>`;

        //   extras personalizado

        const extrasPredefinidos = `
            <div class="mb-6">
            <h4 class="font-semibold mb-2">Extras predefinidos</h4>
            <form id="formExtra${opts.id}" class="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                <select class="selectExtra col-span-1 rounded-md bg-gray-800 text-white border border-gray-600 p-2 text-sm">
                <option value="">Seleccione un extra</option>
                ${opts.extras.map(e => `<option value="${e.id}">${e.nombre}</option>`).join("")}
                </select>
                <input type="number" min="1" value="1" class="extraCantidad col-span-1 rounded-md bg-gray-800 text-white border border-gray-600 p-2 text-sm" placeholder="Cantidad">
                <button type="button" class="btnAgregarExtra col-span-1 px-3 py-2 text-sm text-white rounded bg-[#1A56DB] hover:bg-[#274DCD]">
                <i class="icon-plus-circle"></i> Agregar
                </button>
            </form>
            </div>
        `;

        const extrasPersonalizados = `
            <div class="mb-6">
            <h4 class="font-semibold mb-2">Extra personalizado</h4>
            <form  id="customForm${opts.id}" class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                <label class="block text-sm text-gray-300 mb-1">Nombre del platillo</label>
                <input id="extraNombre" type="text" class="w-full rounded-md bg-gray-800 text-white border border-gray-600 p-2" placeholder="Ej. Postre especial">
                </div>

                <div>
                <label class="block text-sm text-gray-300 mb-1">Clasificación</label>
                <select id="" class="selectClass w-full rounded-md bg-gray-800 text-white border border-gray-600 p-2">
                    <option value="">Seleccione una clasificación</option>
                    ${opts.clasification.map(e => `<option value="${e.id}">${e.nombre}</option>`).join("")}

                </select>
                </div>

                <div>
                <label class="block text-sm text-gray-300 mb-1">Precio (MXN)</label>
                <input id="" type="number" min="0" class="extraPrecio w-full rounded-md bg-gray-800 text-white border border-gray-600 p-2" placeholder="Ej. 250">
                </div>

                <div>
                <label class="block text-sm text-gray-300 mb-1">Cantidad</label>
                <input id="" type="number" min="1" value="1" class="extraCantidadCustom w-full rounded-md bg-gray-800 text-white border border-gray-600 p-2" placeholder="Cantidad">
                </div>

                <div class="col-span-2">
                <button type="button" id="" class="btnAgregarExtraPersonalizado w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#1A56DB] text-white rounded hover:bg-[#274DCD]">
                    <i class="icon-plus-circle"></i> Agregar extra personalizado
                </button>
                </div>
            </form>
            </div>
        `;

        const extrasAgregados = `
            <div>
                <h4 class="font-semibold mb-2">Extras agregados</h4>

                <div class="contentExtras bg-gray-900 text-gray-400 p-4 rounded-md min-h-[300px] overflow-auto text-sm">
                    No hay extras agregados
                </div>
            </div>
        `;

        const template = `
            <div class="col-span-3">
            <div class="bg-[#1F2A37] rounded-lg border border-gray-700 shadow-md p-6 text-white">
                <div class="mb-4">
                <h3 class="text-xl font-bold">Agregar Extras</h3>
                <p class="text-sm text-gray-400">Personalice su menú con opciones adicionales</p>
                </div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                    ${extrasPredefinidos}
                    ${extrasPersonalizados}
                </div>
                ${extrasAgregados}
                </div>
            </div>
            </div>
        `;


        const layout = `
        <div id="${opts.id}"
        class="grid grid-cols-1 md:grid-cols-3 gap-6 ${opts.class}">

            ${paquetes}
            ${resumen}
            ${template}

        </div>`;

        $(`#${opts.parent}`).append(layout);


        // if (opts.sub?.menusSeleccionados?.length) {

        this.renderPackages(opts.id, opts.sub);
        this.renderResumen(opts.id, opts.sub);
        this.renderExtras(opts.id, opts.sub);

        // }

        // Eventos
        $(`#${opts.id} .btnAgregarMenu`).on("click", () => opts.onAddPackage());
        $(`#${opts.id} .btnAgregarExtra`).on("click", () => opts.onAddExtra());
        $(`#${opts.id} .btnAgregarExtraPersonalizado`).on("click", () => opts.onAddExtraCustom());
        $(`#${opts.id} .saveMenuEvent`).on("click", () => opts.onSubmit());
    }


    renderPackages(id, sub) {
        const contenedor = $(`#${id} .contentPaquetes`);
        contenedor.empty();

        if (sub.menusSeleccionados.length === 0) {
            contenedor.html(`<p>No hay menús seleccionados</p>`);
            return;
        }

        sub.menusSeleccionados.forEach((item, index) => {
            const cardId = `menu-card-${index}`;
            const total = item.menu.precioPorPersona * item.cantidadPersonas;

            // <button class="btn-ver-detalles text-sm px-2 py-1 bg-[#333D4C]
            //                  text-blue-300 hover:text-blue-100 hover:bg-[#3f4b5c]
            //                   border border-gray-600 rounded-md transition-colors duration-200" title="Ver detalles">Ver detalles</button>

            const card = $(`
            <div id="${cardId}" class="border border-gray-700 p-3 rounded-lg bg-gray-800 mb-3">
                <div class="grid grid-cols-12 items-center gap-3">
                    <div class="col-span-6 flex flex-col justify-start text-left">
                        <div class="flex items-center gap-2">
                            <h4 class="font-semibold text-white truncate">${item.menu.nombre}</h4>
                          
                        </div>
                        <p class="text-gray-400 text-sm truncate">${item.menu.descripcion}</p>
                    </div>

                    <div class="col-span-3 flex justify-end items-center">
                        <div class="inline-flex items-center border border-gray-600 rounded-md overflow-hidden bg-gray-700 h-9">
                            <button class="btn-decrement px-2 text-white hover:bg-gray-600 h-full">−</button>
                            <span id="cantIndex${index}" class="px-4 text-white text-center font-medium min-w-[30px] h-full flex items-center justify-center">${item.cantidadPersonas}</span>
                            <button class="btn-increment px-2 text-white hover:bg-gray-600 h-full">+</button>
                        </div>
                    </div>

                    <div class="col-span-2 flex justify-end">
                        <span id="totalPrecio${index}" class="text-[#3FC189] font-bold block">${formatPrice(total)}</span>
                    </div>

                    <div class="col-span-1 flex justify-end">
                        <button class="btn-eliminar text-red-400 hover:text-red-600"><i class="icon-trash"></i></button>
                    </div>
                </div>
            </div>`);


            card.find(".btn-ver-detalles").on("click", (e) => {
                e.stopPropagation();
                this.renderDetails(id, item.menu.idEvt);
            });

            // Evento eliminar
            card.find(".btn-eliminar").on("click", (e) => {
                e.stopPropagation();
                this.deletePackage(id, item.menu.idEvt);
            });

            // Evento incrementar cantidad
            card.find(".btn-increment").on("click", (e) => {
                e.stopPropagation();
                item.cantidadPersonas += 1;
                $(`#cantIndex${index}`).text(item.cantidadPersonas);
                const nuevoTotal = item.menu.precioPorPersona * item.cantidadPersonas;

                $(`#totalPrecio${index}`).text(formatPrice(nuevoTotal));
                this.renderResumen(id, sub);
                this.updatePackageQuantity(id, item.menu.idEvt, item.cantidadPersonas)
            });

            // Evento decrementar cantidad
            card.find(".btn-decrement").on("click", (e) => {
                e.stopPropagation();
                if (item.cantidadPersonas > 1) {
                    item.cantidadPersonas -= 1;
                    $(`#cantIndex${index}`).text(item.cantidadPersonas);
                    const nuevoTotal = item.menu.precioPorPersona * item.cantidadPersonas;

                    $(`#totalPrecio${index}`).text(formatPrice(nuevoTotal));
                    this.renderResumen(id, sub);
                    this.updatePackageQuantity(id, item.menu.idEvt, item.cantidadPersonas)

                }
            });

            contenedor.append(card);
        });
    }

    renderResumen(id, sub) {
        // Selección de contenedores y datos
        const contenedorResumen = $(`#${id} .contentResumen`);
        const menu = sub.menusSeleccionados;
        const extras = sub.extrasSeleccionados;

        // Encontrar la row y el div de total (columna 6, index 5)
        let headerDiv = $('#row-' + id);
        let totalDiv = headerDiv.find('div.flex-1').eq(5);

        // Limpia el resumen antes de renderizar
        contenedorResumen.empty();

        // Si no hay menús ni extras seleccionados
        if (menu.length === 0 && extras.length === 0) {
            contenedorResumen.html(`
            <div class="w-full  flex items-center justify-center">
                <p class="text-sm text-gray-400">Seleccione al menos un menú o un extra para ver el resumen</p>
            </div>
        `);
            // Limpia el total visual
            totalDiv.text(formatPrice(0));
            return;
        }

        // Monto total acumulado
        let montoTotal = 0;

        // Render de Menús seleccionados
        const containerMenu = menu.length > 0
            ? `<h4 class="text-sm font-semibold text-white mb-2">Menús:</h4>` +
            menu.map(item => {
                let subtotal = item.menu.precioPorPersona * item.cantidadPersonas;
                montoTotal += subtotal;
                return `
                    <div class="flex justify-between text-xs text-white mb-1">
                        <span class="w-1/2 truncate">(${item.cantidadPersonas}) ${item.menu.nombre}</span>
                        <span class="w-1/4 text-right">${formatPrice(item.menu.precioPorPersona)}</span>
                        <span class="w-1/4 text-right">${formatPrice(subtotal)}</span>
                    </div>
                `;
            }).join("")
            : "";

        // Render de Extras seleccionados
        const containerExtra = extras.length > 0
            ? `<h4 class="text-sm font-semibold text-white mt-4 mb-2">Extras:</h4>` +
            extras.map(extra => {
                let subtotal = extra.precio * extra.cantidad;
                montoTotal += subtotal;
                return `
                    <div class="flex justify-between text-xs text-white mb-1">
                        <span class="w-1/2 truncate">(${extra.cantidad}) ${extra.nombre}</span>
                        <span class="w-1/4 text-right">${formatPrice(extra.precio)}</span>
                        <span class="w-1/4 text-right">${formatPrice(subtotal)}</span>
                    </div>
                `;
            }).join("")
            : "";

        // Render del resumen total (abarca todo el div)
        contenedorResumen.html(`
        <div class="w-full p-2">
            <div class="text-left">
                ${containerMenu}
                ${containerExtra}
            </div>
            <hr class="border-gray-600 my-3" />
            <div class="flex justify-between font-bold text-white text-lg">
                <span>Total:</span>
                <span id="pagoTotal">${formatPrice(montoTotal)}</span>
            </div>
        </div>
        `);

        // Actualiza la columna total en la row
        totalDiv.text(formatPrice(montoTotal));
        $('#accordionTable')[0].totalGral();
    }

    renderExtras(id, sub) {
        const contenedor = $(`#${id} .contentExtras`);
        contenedor.empty();

        if (!sub.extrasSeleccionados || sub.extrasSeleccionados.length === 0) {
            contenedor.html(`<p>No hay extras agregados</p>`);
            return;
        }

        sub.extrasSeleccionados.forEach((item, index) => {
            const total = item.precio * item.cantidad;
            const cardId = `extra-card-${index}`;

            const card = $(`
            <div id="${cardId}" class="border border-gray-700 p-3 rounded-lg bg-gray-800 mb-3">
                <div class="grid grid-cols-12 items-center gap-4">
                    <!-- Nombre y clasificación -->
                    <div class="col-span-6 flex flex-col justify-start text-left">
                        <h4 class="font-semibold text-white truncate">${item.nombre}</h4>
                        <p class="text-gray-400 text-sm truncate">${item.clasificacion || 'Sin clasificación'}</p>
                    </div>

                    <!-- Contador -->
                    <div class="col-span-3 flex justify-end items-center">
                        <div class="inline-flex items-center border border-gray-600 rounded-md overflow-hidden bg-gray-700 h-9">
                            <button type="button" class="btn-decrement px-2 text-white hover:bg-gray-600 h-full">−</button>
                            <span id="cantExtra${index}" class="px-4 text-white text-center font-medium min-w-[30px] h-full flex items-center justify-center">${item.cantidad}</span>
                            <button type="button" class="btn-increment px-2 text-white hover:bg-gray-600 h-full">+</button>
                        </div>
                    </div>

                    <!-- Total -->
                    <div class="col-span-2 flex justify-end">
                        <span id="totalExtra${index}" class="text-[#3FC189] font-bold block">${formatPrice(total)}</span>
                    </div>

                    <!-- Eliminar -->
                    <div class="col-span-1 flex justify-end">
                        <button type="button" class="btn-eliminar text-red-400 hover:text-red-600">
                            <i class="icon-trash"></i>
                        </button>
                    </div>
                </div>
            </div>`);

            card.find(".btn-eliminar").on("click", (e) => {
                e.stopPropagation();

                this.deleteExtra(id, item.idEvt);
            });

            // Evento incrementar cantidad
            card.find(".btn-increment").on("click", (e) => {
                e.stopPropagation();
                item.cantidad += 1;
                $(`#cantExtra${index}`).text(item.cantidad);
                $(`#totalExtra${index}`).text(formatPrice(item.precio * item.cantidad));
                this.renderResumen(id, sub);
                this.updatePackageQuantity(id, item.idEvt, item.cantidad);
            });

            // Evento decrementar cantidad
            card.find(".btn-decrement").on("click", (e) => {
                e.stopPropagation();
                if (item.cantidad > 1) {
                    item.cantidad -= 1;
                    $(`#cantExtra${index}`).text(item.cantidad);
                    $(`#totalExtra${index}`).text(formatPrice(item.precio * item.cantidad));
                    this.renderResumen(id, sub);
                    this.updatePackageQuantity(id, item.idEvt, item.cantidad);
                }
            });

            contenedor.append(card);
        });
    }

    renderDetails(id_subevent, menu) {
        const contenedor = $(`#detalleMenuSeleccionado-${id_subevent}`);
        if (!menu) return contenedor.empty();

        const detallesMenuHTML = `
            <div class="bg-[#1F2A37] rounded-lg border border-gray-700 shadow-md p-6 text-white">
                <div class="mb-4">
                    <h3 class="text-xl font-bold">Detalles del Menú: ${menu.nombre} ${formatPrice(menu.precioPorPersona)} /persona</h3>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-300">
                    <div>
                        <h4 class="font-semibold mb-2">Platillos incluidos:</h4>
                        <ul class="list-disc pl-5 space-y-1">
                            ${menu.platillos.map(p => `<li>${p.nombre}</li>`).join("")}
                        </ul>
                    </div>
                    <div>
                        <h4 class="font-semibold mb-2">Bebidas incluidas:</h4>
                        <ul class="list-disc pl-5 space-y-1">
                            ${menu.bebidas.map(b => `<li>${b.nombre}</li>`).join("")}
                        </ul>
                    </div>
                </div>
                <div class="mt-6 text-right">
                    <button onclick="sub.cerrarDetallesMenu('#detalleMenuSeleccionado-${id_subevent}')" class="text-blue-400 hover:underline">Cerrar detalles</button>
                </div>
            </div>
        `;

        contenedor.html(detallesMenuHTML);
    }

    // Package
    async addPackage(id) {
        const form = $(`#formMenu${id}`);
        const idMenu = form.find(".selectMenu").val();
        const cantidad = parseInt(form.find(".cantidadPersonas").val());

        if (!idMenu || cantidad <= 0) {
            alert({ icon: "warning", text: "Debe seleccionar un paquete y una cantidad válida." });
            return;
        }

        const response = await useFetch({
            url: this._link,
            data: {
                opc: "addPackage",
                package_id: idMenu,
                quantity: cantidad,
                evt_events_id: idEvent,

                subevent_id: id
            },
        });

        if (response.status === 200) {
            this.renderPackages(id, response.sub);
            this.renderResumen(id, response.sub);
        } else {
            alert(response.message);
        }

    }

    async deletePackage(targetId, menuId) {

        const response = await useFetch({
            url: this._link,
            data: { opc: "deletePackage", subevent_id: targetId, id: menuId, evt_events_id: idEvent },
        });

        if (response.status === 200) {

            this.renderResumen(targetId, response.sub);
            this.renderPackages(targetId, response.sub);

        } else {
            alert(response.message);
        }

    }

    async updatePackageQuantity(targetId, menuId, newQuantity) {
        const response = await useFetch({
            url: this._link,
            data: {
                opc: "updatePackageQuantity",
                subevent_id: targetId,
                id: menuId,
                quantity: newQuantity
            },
        });

        if (response.status === 200) {
            this.renderResumen(targetId, response.sub);
        } else {
            alert(response.message);
        }
    }


    // Extra & Extra Custom


    async addExtra(id) {

        const form = $(`#formExtra${id}`);
        const idExtra = form.find(".selectExtra").val();
        const cantidad = parseInt(form.find(".extraCantidad").val());

        if (!idExtra || cantidad <= 0) {
            alert({ icon: "warning", text: "Debe seleccionar un extra y una cantidad válida." });
            return;
        }

        const response = await useFetch({
            url: this._link,
            data: {
                opc          : "addExtra",
                product_id   : idExtra,
                quantity     : cantidad,
                subevent_id  : id,
                evt_events_id: idEvent

            },
        });

        if (response.status === 200) {
            this.renderExtras(id, response.sub);
            this.renderResumen(id, response.sub);

        } else {
            alert(response.message);
        }
    }

    async addExtraCustom(id) {

        const form = $(`#customForm${id}`);


        const nombre = form.find("#extraNombre").val();
        const clasificacion = form.find(".selectClass").val()
        const precio = parseFloat(form.find(".extraPrecio").val());
        const cantidad = parseInt(form.find(".extraCantidadCustom").val());

        // Validaciones básicas
        if (!nombre || !clasificacion || isNaN(precio) || isNaN(cantidad) || cantidad <= 0 || precio < 0) {
            alert({ icon: "warning", text: "Completa todos los campos correctamente para agregar el extra personalizado.", timer: 2000 });
            return;
        }

        // Construcción y envío
        const response = await useFetch({
            url: this._link,
            data: {
                opc              : "addProduct",
                name             : nombre,
                price            : precio,
                quantity         : cantidad,
                id_classification: clasificacion,
                evt_events_id: idEvent,

                subevent_id      : id
            },
        });

        if (response.status === 200) {

            this.renderExtras(id, response.sub);
            this.renderResumen(id, response.sub);
            alert({
                icon: "success",
                text: response.message,
                timer: 1000
            });
        } else {
            alert({ icon: "error", text: response.message });
        }
    }

    // delete Extra
    async deleteExtra(targetId, menuId) {

        const response = await useFetch({
            url: this._link,
            data: {
                opc: "deleteExtra",
                subevent_id: targetId,
                id: menuId,
                evt_events_id : idEvent
            },
        });

        if (response.status === 200) {
            this.renderResumen(targetId, response.sub);
            this.renderExtras(targetId, response.sub);
        } else {
            alert(response.message);
        }
    }





    // async addMenu(id){

    //     let response = await useFetch({
    //         url: this._link,
    //         data: { opc: "getSubEventMenus",  subevent_id: id }
    //     });

    //     console.log(response);



    //     if (response.status == 200 && response.menus.length > 0) {


    //         // 🧼 Limpiar listas actuales correctamente
    //         this.menusSeleccionados = [];
    //         this.extrasSeleccionados = [];

    //         sub.layoutMenu(id, true);

    //         // 🔁 Prellenar menús seleccionados
    //         if (Array.isArray(response.menus)) {
    //             response.menus.forEach(item => {
    //                 this.menusSeleccionados.push({
    //                     menu: item.menu,
    //                     cantidadPersonas: parseInt(item.cantidadPersonas)
    //                 });
    //             });
    //         }

    //         // 🔁 Prellenar extras seleccionados
    //         if (Array.isArray(response.extras)) {
    //             response.extras.forEach(extra => {
    //                 this.extrasSeleccionados.push({
    //                     id: extra.id,
    //                     nombre: extra.nombre,
    //                     precio: parseFloat(extra.precio),
    //                     cantidad: parseInt(extra.cantidad),
    //                     id_clasificacion: extra.id_clasificacion,
    //                     custom: !!extra.custom
    //                 });
    //             });
    //         }

    //         setTimeout(() => {
    //             // 📌 Renderizar interfaz y datos
    //             $(`#divExtras-${id}`).removeClass("d-none");
    //             $(`#selectMenu-${id}`).val("");
    //             $(`#cantidadPersonas-${id}`).val(1);

    //             sub.renderPaquetes("#contentPaquetes-" + id);
    //             sub.renderResumen("#contentResumen-" + id);
    //             sub.renderExtras("#contentExtras-" + id);
    //         }, 500);
    //     } else {
    //         // Si no hay menús, solo muestra layout
    //         this.menuSeleccionadoParaVer = null;
    //         sub.layoutMenu(id, false);
    //     }


    // }


    // Components

   

    cancelSubEvent(item) {
        this.swalQuestion({
            opts: {
                title: `¿Esta seguro?`,
                html: `¿Deseas eliminar  <strong> ${item.SubEvento} </strong> ?`,
            },
            data: { opc: "deleteSubEvent", id: item.id, evt_events_id: idEvent },
            methods: {
                request: (response) => {
                    if (response.status == 200) {
                        alert({
                            icon: "success",
                            text: response.message,
                        });

                        this.showSubEvent();
                    } else {
                        alert({
                            icon: "error",
                            text: response.message,
                        });
                    }
                },
            },
        });
    }

    jsonSubEvent() {

        return [
            // 📏 Información del evento
            { opc: 'input', lbl: 'Nombre del Sub Evento', id: 'name_subevent', class: 'col-6 mb-3', tipo: 'texto', required: true },
            {
            opc: 'select', lbl: 'Tipo de evento', id: 'type_event', class: 'col-6 mb-3', data: [
                { id: 'Abierto', valor: "Abierto" },
                { id: 'Privado', valor: "Privado" },
            ]
            },
            { opc: "input", value: 1, lbl: "Número de personas", id: "quantity_people", class: "col-6 mb-3 ", tipo: "cifra", required: true, placeholder: "0" },
            
            { opc: 'input', lbl: 'Localización', id: 'location', class: 'col-6', tipo: 'texto', required: true },
            { opc: "input", lbl: "Fecha de inicio", id: "date_start", class: "col-4 mb-3", type: "date", required: true },
            { opc: 'input', lbl: 'Hora de inicio', id: 'time_start', tipo: 'hora', type: "time", class: 'col-4 mb-3', required: true },
            { opc: 'input', lbl: 'Hora de cierre', id: 'time_end', tipo: 'hora', type: "time", class: 'col-4 mb-3' },

            // { opc: 'input', lbl: 'Monto', id: 'total_pay', tipo: 'cifra', class: 'col-3' },
            { opc: 'textarea', lbl: 'Observaciones', id: 'notes', class: 'col-12' },

        ];
    }

    async layoutMenu(id, isEdit) {
        $('#containerInfo' + id).empty();
        let menusPrecargadosData = await useFetch({ url: link, data: { opc: "getPackages" } });
        let extrasDisponiblesData = await useFetch({ url: link, data: { opc: "getProducts" } });
        let clasificacionesData = await useFetch({ url: link, data: { opc: "getClassifications" } });

        let menusPrecargados = menusPrecargadosData.data;
        let extrasDisponibles = extrasDisponiblesData.data;
        let clasificaciones = clasificacionesData.data;

        $('#containerInfo' + id).append(`
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

              <!-- Card Selecciona Paquetes -->
              <div id="divPaquetes-${id}" class="md:col-span-2">
                <div class="bg-[#1F2A37] rounded-lg border border-gray-700 shadow-md p-6 text-white">
                  <div class="mb-4">
                    <h3 class="text-xl font-bold">Selecciona Paquetes</h3>
                    <p class="text-sm text-gray-400">Elija uno o más menús/paquetes y la cantidad de personas</p>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                      <label for="selectMenu-${id}" class="block text-sm font-medium text-gray-300 mb-1">Paquete Precargado</label>
                      <select id="selectMenu-${id}" class="w-full rounded-md bg-gray-800 text-white border border-gray-600 p-2">
                        <option value="">Seleccione un menú</option>
                      </select>
                    </div>
                    <div>
                      <label for="cantidadPersonas-${id}" class="block text-sm font-medium text-gray-300 mb-1">Cantidad</label>
                      <input type="number" min="1" value="1" id="cantidadPersonas-${id}" class="w-full rounded-md bg-gray-800 text-white border border-gray-600 p-2" />
                    </div>
                    <div class="flex items-end">
                      <button id="btnAgregarMenu-${id}" class="w-full flex items-center justify-center gap-2 bg-[#1A56DB] hover:bg-[#274DCD] text-white font-medium py-2 px-4 rounded-md">
                        <i class="icon-plus-circle"></i> Agregar Menú
                      </button>
                    </div>
                  </div>

                  <hr class="border-gray-700 mb-4" />

                  <div>
                    <h4 class="font-semibold text-white mb-2">Menús seleccionados</h4>
                    <div id="contentPaquetes-${id}" class="bg-gray-900 text-gray-400 p-4 rounded-md text-center">
                      No hay menús seleccionados
                    </div>
                    <div id="detalleMenuSeleccionado-${id}" class="mt-6"></div>

                  </div>
                </div>
              </div>

              <!-- Card Resumen -->
              <div id="divResumen-${id}">
                <div class="bg-[#1F2A37] h-full rounded-lg border border-gray-700 shadow-md p-6 text-white">
                  <div class="mb-4">
                    <h3 class="text-xl font-bold">Resumen del Pedido</h3>
                    <p class="text-sm text-gray-400">Detalles de su selección</p>
                  </div>

                  <div id="contentResumen-${id}" class="bg-gray-900 text-gray-400 p-4 rounded-md text-center">
                    Seleccione al menos un menú para ver el resumen
                  </div>
                </div>
              </div>
            </div>

            <!-- Card Agregar Extras -->
            <div id="divExtras-${id}" class="col-span-3 mt-4 d-none">
                <div class="bg-[#1F2A37] rounded-lg border border-gray-700 shadow-md p-6 text-white">
                    <div class="mb-4">
                    <h3 class="text-xl font-bold">Agregar Extras</h3>
                    <p class="text-sm text-gray-400">Personalice su menú con opciones adicionales</p>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Formulario para agregar -->
                        <div>
                            <div class="mb-4">
                                <h4 class="font-semibold mb-2">Extras predefinidos</h4>
                                <div class="flex gap-2">
                                    <select id="selectExtra-${id}" class="w-full rounded-md bg-gray-800 text-white border border-gray-600 p-2">
                                        <option value="">Seleccione un extra</option>
                                    </select>
                                    <input id="extraCantidad-${id}" type="number" min="1" value="1" class="w-20 rounded-md bg-gray-800 text-white border border-gray-600 p-2" placeholder="Cantidad">
                                    <button id="btnAgregarExtra" class="w-50 px-4 py-2 text-white rounded bg-[#1A56DB] hover:bg-[#274DCD]"><i class="icon-plus-circle"></i>Agregar</button>
                                </div>
                            </div>

                            <div class="mb-4">
                                <h4 class="font-semibold mb-2">Extra personalizado</h4>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <label class="block text-sm text-gray-300 mb-1">Nombre del platillo</label>
                                        <input id="extraNombre-${id}" type="text" class="w-full rounded-md bg-gray-800 text-white border border-gray-600 p-2" placeholder="Ej. Postre especial">
                                    </div>
                                    <div>
                                        <label class="block text-sm text-gray-300 mb-1">Clasificación</label>
                                        <select id="selectClass-${id}" class="w-full rounded-md bg-gray-800 text-white border border-gray-600 p-2">
                                            <option value="">Seleccione una clasificación</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block text-sm text-gray-300 mb-1">Precio (MXN)</label>
                                        <input id="extraPrecio-${id}" type="number" min="0" class="w-full rounded-md bg-gray-800 text-white border border-gray-600 p-2" placeholder="Ej. 250">
                                    </div>
                                    <div>
                                        <label class="block text-sm text-gray-300 mb-1">Cantidad</label>
                                        <input id="extraCantidadCustom-${id}" type="number" min="1" value="1" class="w-full rounded-md bg-gray-800 text-white border border-gray-600 p-2" placeholder="Cantidad">
                                    </div>

                                    <div>
                                        <button id="btnAgregarExtraPersonalizado-${id}" class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#1A56DB] text-white rounded hover:bg-[#274DCD]">
                                            <i class="icon-plus-circle"></i> Agregar extra personalizado
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Lista de extras agregados -->
                        <div>
                            <h4 class="font-semibold mb-2">Extras agregados</h4>
                            <div id="contentExtras-${id}"  class="bg-gray-900 text-gray-400 p-4 rounded-md min-h-[300px] overflow-auto text-center">
                            No hay extras agregados
                            </div>
                        </div>
                    </div>

                    <div class="mt-6 text-right">
                        <button id="saveMenuEvent-${id}" class="px-6 py-2 font-semibold rounded-md bg-[#1A56DB] hover:bg-[#274DCD]">Guardar</button>
                    </div>
                </div>
            </div>

          `);


        // MENUS PRECARGADOS --------------------
        // Cargar opciones en el select
        menusPrecargados.forEach(menu => {
            $(`#selectMenu-${id}`).append(`<option value="${menu.id}">${menu.nombre} - $${menu.precioPorPersona}/persona</option>`);
        });

        // Escuchar clic en Agregar Menú
        $(`#btnAgregarMenu-${id}`).on("click", () => {
            let idSeleccionado = $(`#selectMenu-${id}`).val();
            let cantidad = parseInt($(`#cantidadPersonas-${id}`).val()) || 1;
            let menu = menusPrecargados.find(m => m.id == idSeleccionado);

            if (!menu) return;

            let existente = this.menusSeleccionados.find(item => item.menu.id == idSeleccionado);

            if (existente) {
                existente.cantidadPersonas += cantidad;
            } else {
                this.menusSeleccionados.push({ menu, cantidadPersonas: cantidad });
            }

            $(`#divExtras-${id}`).removeClass("d-none");
            $(`#selectMenu-${id}`).val("");
            $(`#cantidadPersonas-${id}`).val(1);

            sub.renderPaquetes("#contentPaquetes-" + id);
            sub.renderResumen("#contentResumen-" + id);
        });


        // Función para cambiar cantidad de personas
        window.cambiarCantidad = (index, delta) => {
            let nuevaCantidad = sub.menusSeleccionados[index].cantidadPersonas + delta;
            if (nuevaCantidad > 0) {
                sub.menusSeleccionados[index].cantidadPersonas = nuevaCantidad;
                sub.renderPaquetes("#contentPaquetes-" + id);
                sub.renderResumen("#contentResumen-" + id);
            }
        };

        // Función para eliminar menú
        window.eliminarMenu = (index) => {
            sub.menusSeleccionados.splice(index, 1);
            if (sub.menusSeleccionados.length == 0) {
                $(`#divExtras-${id}`).addClass("d-none");
            }
            sub.renderPaquetes("#contentPaquetes-" + id);
            sub.renderResumen("#contentResumen-" + id);
        };



        // EXTRAS ------------------------------
        extrasDisponibles.forEach(extra => {
            $(`#selectExtra-${id}`).append(`<option value="${extra.id}">${extra.nombre} - $${extra.precio}</option>`);
        });

        // Evento único de Agregar Extra
        $(document).off("click", "#btnAgregarExtra").on("click", "#btnAgregarExtra", () => {
            let idExtra = $(`#selectExtra-${id}`).val();
            let cantidad = parseInt($(`#extraCantidad-${id}`).val()) || 1;
            let extra = extrasDisponibles.find(e => e.id == idExtra);

            if (extra && cantidad > 0) {
                let yaExiste = this.extrasSeleccionados.find(e => e.id == extra.id && !e.custom);
                if (yaExiste) {
                    yaExiste.cantidad += cantidad;
                } else {
                    this.extrasSeleccionados.push({
                        ...extra,
                        cantidad,
                        total: extra.precio * cantidad,
                        custom: false
                    });
                }

                $(`#selectExtra-${id}`).val("");
                $(`#extraCantidad-${id}`).val("1");
                sub.renderExtras("#contentExtras-" + id);
                sub.renderResumen("#contentResumen-" + id);
            }
        });

        // Evento de Extra Personalizado
        $(document).off("click", `#btnAgregarExtraPersonalizado-${id}`).on("click", `#btnAgregarExtraPersonalizado-${id}`, () => {
            let nombre = $(`#extraNombre-${id}`).val().trim();
            let precio = parseFloat($(`#extraPrecio-${id}`).val());
            let cantidad = parseInt($(`#extraCantidadCustom-${id}`).val()) || 1;
            let id_classification = $(`#selectClass-${id}`).val();

            if (nombre && !isNaN(precio) && precio > 0 && cantidad > 0 && id_classification) {
                let data = {
                    opc: "addProduct",
                    name: nombre,
                    price: precio,
                    id_classification,
                };

                fn_ajax(data, link).then((response) => {
                    if (response.status == 200 && response.data.id) {
                        this.extrasSeleccionados.push({
                            id: response.data.id,
                            nombre,
                            precio,
                            cantidad,
                            id_clasificacion: id_classification,
                            custom: true
                        });

                        alert({
                            icon: "success",
                            text: response.message,
                            timer: 1000
                        });

                        // Limpiar inputs
                        $(`#extraNombre-${id}`).val("");
                        $(`#extraPrecio-${id}`).val("");
                        $(`#extraCantidadCustom-${id}`).val("1");
                        $(`#selectClass-${id}`).val("");

                        sub.renderExtras("#contentExtras-" + id);
                    } else {
                        alert({
                            icon: "error",
                            text: response.message,
                            btn1: true,
                            btn1Text: "Ok"
                        });
                    }
                });
            }
        });

        // Render Extras
        // Hacer pública la función para botón eliminar
        window.eliminarExtra = (index) => {
            this.extrasSeleccionados.splice(index, 1);
            sub.renderExtras("#contentExtras-" + id);
            sub.renderResumen("#contentResumen-" + id);
        };

        // Función para cambiar cantidad de extras
        window.cambiarCantidadExtra = (index, delta) => {
            let extra = sub.extrasSeleccionados[index];
            let nuevaCantidad = extra.cantidad + delta;

            if (nuevaCantidad > 0) {
                extra.cantidad = nuevaCantidad;
                sub.renderExtras("#contentExtras-" + id);
                sub.renderResumen("#contentResumen-" + id);
            }
        };

        // CLASIFICACIONES -------------------
        this.clasificaciones = clasificaciones;
        clasificaciones.forEach(clas => {
            $("#selectClass").append(`<option value="${clas.id}">${clas.nombre}</option>`);
        });

        // GUARDAR MENÚ ----------------------
        $(`#saveMenuEvent-${id}`).on("click", () => {
            // Validar que se haya guardado el evento
            if (!id_subevent || id_subevent == 0) {
                alert({
                    icon: "error",
                    text: "No has creado un evento aún.",
                    btn1: true,
                    btn1Text: "Ok"
                });
                return;
            }

            // Validar que se haya seleccionado al menos un menú
            if (sub.menusSeleccionados.length == 0) {
                alert({
                    icon: "error",
                    text: "Agrega al menos un menú",
                    btn1: true,
                    btn1Text: "Ok"
                });
                return;
            }

            // Detectar si es edición o creación
            let action = "editSubEventMenus";
            if (isEdit == false) {
                action = "addSubEventMenus";
            }

            let data = {
                opc: action,
                id_subevent: id,
                menus: JSON.stringify(sub.menusSeleccionados),
                extras: JSON.stringify(sub.extrasSeleccionados),
                total: $(`#pagoTotal`).text().replace("$", "").replace(",", "")
            };

            fn_ajax(data, this._link).then((response) => {
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        text: response.message,
                        timer: 2000,
                    });

                    // Solo cerrar si es nuevo (no edición)
                    // if (!isEdit) {
                    //     sub.closeEvent();
                    // }
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok",
                    });
                }
            });
        });
    }

    // Función para renderizar paquetes seleccionados
    // renderPaquetes(container) {
    //     let contenedor = $(container);
    //     if (sub.menusSeleccionados.length == 0) {
    //         contenedor.html(`<p>No hay menús seleccionados</p>`);
    //         return;
    //     }

    //     contenedor.empty();
    //     sub.menusSeleccionados.forEach((item, index) => {
    //         let total = item.menu.precioPorPersona * item.cantidadPersonas;
    //         let html = `
    //                 <div class="border border-gray-700 p-3 rounded-lg bg-gray-800 mb-3">
    //                   <div class="grid grid-cols-12 items-center gap-4">

    //                     <!-- Columna 1: Info del menú (Izquierda) -->
    //                     <div class="col-span-6 flex flex-col justify-start text-left">
    //                     <div class="flex items-center gap-2">
    //                         <h4 class="font-semibold text-white truncate">${item.menu.nombre}</h4>
    //                         <button onclick="sub.verDetallesMenu(${index})" class="text-sm px-2 py-1 bg-[#333D4C] text-blue-300 hover:text-blue-100 hover:bg-[#3f4b5c] border border-gray-600 rounded-md transition-colors duration-200">
    //                             Ver detalles
    //                         </button>

    //                     </div>
    //                     <p class="text-gray-400 text-sm truncate">${item.menu.descripcion}</p>
    //                     </div>


    //                     <!-- Columna 2: Stepper de cantidad (Derecha) -->
    //                     <div class="col-span-3 flex justify-end items-center">
    //                       <div class="inline-flex items-center border border-gray-600 rounded-md overflow-hidden bg-gray-700 h-9">
    //                         <button onclick="cambiarCantidad(${index}, -1)" class="px-2 text-white hover:bg-gray-600 h-full">−</button>
    //                         <span id="cantidadIndex${index}" class="px-4 text-white text-center font-medium min-w-[30px] h-full flex items-center justify-center">
    //                           ${item.cantidadPersonas}
    //                         </span>
    //                         <button onclick="cambiarCantidad(${index}, 1)" class="px-2 text-white hover:bg-gray-600 h-full">+</button>
    //                       </div>
    //                     </div>

    //                     <!-- Columna 3: Total (Derecha) -->
    //                     <div class="col-span-2 flex justify-end">
    //                       <span class="text-[#3FC189] font-bold block">$${total.toFixed(2)}</span>
    //                     </div>

    //                     <!-- Columna 4: Eliminar (Derecha) -->
    //                     <div class="col-span-1 flex justify-end">
    //                       <button class="text-red-400 hover:text-red-600" onclick="eliminarMenu(${index})">
    //                         <i class="icon-trash"></i>
    //                       </button>
    //                     </div>

    //                   </div>
    //                 </div>
    //               `;
    //         $(contenedor).append(html);
    //     });
    // }

    // renderExtras(container) {
    //     let contenedor = $(container);
    //     if (sub.extrasSeleccionados.length == 0) {
    //         contenedor.html(`<p>No hay extras agregados</p>`);
    //         return;
    //     }

    //     contenedor.empty();

    //     sub.extrasSeleccionados.forEach((extra, i) => {
    //         let total = extra.precio * extra.cantidad;
    //         let clasificacion = this.clasificaciones.find(c => c.id == extra.id_clasificacion);
    //         if (!clasificacion) {
    //             clasificacion = { nombre: "Sin clasificación" };
    //         }
    //         let html = `
    //             <div class="border border-gray-700 p-3 rounded-lg bg-gray-800 mb-3">
    //                 <div class="grid grid-cols-12 items-center gap-4">

    //                     <!-- Info del extra -->
    //                     <div class="col-span-6 flex flex-col justify-start text-left">
    //                         <h4 class="font-semibold text-white truncate">${extra.nombre}</h4>
    //                         <p class="text-gray-400 text-sm truncate">${clasificacion.nombre}</p>
    //                     </div>

    //                     <!-- Stepper cantidad -->
    //                     <div class="col-span-3 flex justify-center items-center">
    //                         <div class="inline-flex items-center border border-gray-600 rounded-md overflow-hidden bg-gray-700 h-9">
    //                             <button onclick="cambiarCantidadExtra(${i}, -1)" class="px-2 text-white hover:bg-gray-600 h-full">−</button>
    //                             <span id="cantidadExtra${i}" class="px-4 text-white text-center font-medium min-w-[30px] h-full flex items-center justify-center">
    //                             ${extra.cantidad}
    //                             </span>
    //                             <button onclick="cambiarCantidadExtra(${i}, 1)" class="px-2 text-white hover:bg-gray-600 h-full">+</button>
    //                         </div>
    //                     </div>

    //                     <!-- Total -->
    //                     <div class="col-span-2 flex justify-end">
    //                         <span class="text-[#3FC189] font-bold block">$${total.toFixed(2)}</span>
    //                     </div>

    //                     <!-- Eliminar -->
    //                     <div class="col-span-1 flex justify-end">
    //                         <button class="text-red-400 hover:text-red-600" onclick="eliminarExtra(${i})">
    //                             <i class="icon-trash"></i>
    //                         </button>
    //                     </div>

    //                 </div>
    //             </div>
    //         `;
    //         $(contenedor).append(html);
    //     });
    // }

    // Render resumen con cantidad de extras y precio total
    // renderResumen(container) {
    //     let contenedor = $(container);
    //     let menus = sub.menusSeleccionados;
    //     let extras = sub.extrasSeleccionados;

    //     if (menus.length == 0 && extras.length == 0) {
    //         contenedor.html(`<p>Seleccione al menos un menú o un extra para ver el resumen</p>`);
    //         return;
    //     }

    //     let total = 0;

    //     let resumenMenus = menus.length > 0
    //         ? `<h4 class="text-sm font-semibold text-white mb-2">Menús:</h4>` +
    //         menus.map((item) => {
    //             let subtotal = item.menu.precioPorPersona * item.cantidadPersonas;
    //             total += subtotal;
    //             return `<div class="flex justify-between text-xs text-white mb-1">
    //                     <span>(${item.cantidadPersonas})  ${item.menu.nombre}</span>
    //                     <span>$${item.menu.precioPorPersona}</span>
    //                     <span>$${subtotal.toFixed(2)}</span>
    //                   </div>`;
    //         }).join("")
    //         : "";

    //     let resumenExtras = extras.length > 0
    //         ? `<h4 class="text-sm font-semibold text-white mt-4 mb-2">Extras:</h4>` +
    //         extras.map((extra) => {
    //             let subtotal = extra.precio * extra.cantidad;
    //             total += subtotal;
    //             return `<div class="flex justify-between text-xs text-white mb-1">
    //                     <span>(${extra.cantidad})  ${extra.nombre}</span>
    //                     <span>$${extra.precio}</span>
    //                     <span>$${subtotal.toFixed(2)}</span>
    //                   </div>`;
    //         }).join("")
    //         : "";

    //     contenedor.html(`
    //         <div class="text-left">
    //             ${resumenMenus}
    //             ${resumenExtras}
    //         </div>
    //         <hr class="border-gray-600 my-3" />
    //         <div class="flex justify-between font-bold text-white text-lg">
    //             <span>Total:</span>
    //             <span id="pagoTotal">$${total.toFixed(2)}</span>
    //         </div>
    //     `);
    // }

    verDetallesMenu(index) {
        this.menuSeleccionadoParaVer = this.menusSeleccionados[index].menu;
        this.renderDetallesMenu();
    }

    cerrarDetallesMenu(container) {
        this.menuSeleccionadoParaVer = null;
        $(container).empty();
    }

    renderDetallesMenu() {
        let menu = this.menuSeleccionadoParaVer;
        let contenedor = $(`#detalleMenuSeleccionado-${id_subevent}`);
        if (!menu) return contenedor.empty();

        let html = `
            <div class="bg-[#1F2A37] rounded-lg border border-gray-700 shadow-md p-6 text-white">
                <div class="mb-4">
                    <h3 class="text-xl font-bold">Detalles del Menú: ${menu.nombre} $${menu.precioPorPersona} /persona</h3>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-300">
                    <div>
                        <h4 class="font-semibold mb-2">Platillos incluidos:</h4>
                        <ul class="list-disc pl-5 space-y-1">
                            ${menu.platillos.map(p => `<li>${p.nombre}</li>`).join("")}
                        </ul>
                    </div>
                    <div>
                        <h4 class="font-semibold mb-2">Bebidas incluidas:</h4>
                        <ul class="list-disc pl-5 space-y-1">
                            ${menu.bebidas.map(b => `<li>${b.nombre}</li>`).join("")}
                        </ul>
                    </div>
                </div>
                <div class="mt-6 text-right">
                <button onclick="sub.cerrarDetallesMenu('#detalleMenuSeleccionado-${id_subevent}')" class="text-blue-400 hover:underline">Cerrar detalles</button>
                </div>
            </div>
            `;
        contenedor.html(html);
    }

}
