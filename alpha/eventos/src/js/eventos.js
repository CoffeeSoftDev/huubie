let id_event = 0;

class Eventos extends App {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.menusSeleccionados = [];
        this.menuSeleccionadoParaVer = null;
        this.extrasSeleccionados = [];
        this.clasificaciones = [];
    }

    initComponents() {
        this.filterBar();
    }

    removeItem(id) {
        this.swalQuestion({
            opts: {
                title: `¿Esta seguro?`,
                text: "Estas apunto de cancelar el evento",
            },
            data: { opc: "cancelEvent", status_process_id: 4, id: id },
            methods: {
                request: (data) => {
                    this.ls();
                },
            },
        });
    }

    // EVENTO O SUBEVENTO
    showTypeEvent() {
        let modal = bootbox.dialog({
            // title: "Selecciona el tipo de evento",
            closeButton: true,
            message: '<div id="containerTypeEvents"></div>',
            id: "modal",
            size: 'large'
        });

        this.createItemCard({
            parent: 'containerTypeEvents',
            title: 'Selecciona el tipo de evento: ',
            json: [
                {
                    titulo: "Evento",
                    descripcion: "Dar de alta un nuevo evento",
                    imagen: "/alpha/src/img/eventos.svg",

                    onClick: () => {
                        calendario.redirectToEventos();
                        modal.modal('hide');
                    }
                },
                {
                    titulo: "Multiples Eventos",
                    descripcion: "Dar de alta más de un evento",
                    img: [
                        {
                            src: "/alpha/src/img/eventos.svg",
                            title: 'events'
                        },
                        {
                            src: "/alpha/src/img/eventos.svg",
                            title: 'events'
                        }
                    ],
                    onClick: () => {
                        sub.layout();
                        modal.modal('hide');
                    }

                }
            ]
        });

    }


    // EVENTO -----------------------------------
    // Ver
    async showEvent(id, category) {
        let response = await useFetch({
            url: this._link,
            data: { opc: "getByIdCalendario", id: id, category: category },
        });

        let event = response.data.event || {};
        let menuList = response.data.menu || [];
        let extras = response.data.extras || [];

        let metodoPago = "N/A";
        if (event.method_pay_id == 1) {
            metodoPago = "Efectivo";
        } else if (event.method_pay_id == 2) {
            metodoPago = "Tarjeta";
        } else if (event.method_pay_id == 3) {
            metodoPago = "Transferencia";
        }

        // 📦 Datos del evento
        let titulo = event.name_event || "N/A";
        let locacion = event.location || "N/A";
        let status = this.eventStatus(event.status);
        let fechaCreacion = event.date_creation ? formatSpanishDate(event.date_creation) : "N/A";
        let fechaInicio = event.date_start ? formatSpanishDate(event.date_start) : "N/A";
        let horaInicio = event.time_start || "";
        let fechaFin = event.date_end ? formatSpanishDate(event.date_end) : "N/A";
        let horaFin = event.time_end || "";
        let cliente = event.name_client || "N/A";
        let telefono = event.phone || "N/A";
        let correo = event.email || "N/A";
        let tipoEvento = event.type_event || "N/A";
        let cantidadPersonas = event.quantity_people || "N/A";
        let notes = event.notes || "";
        let icon = "📆";

        // 📋 Render modal
        bootbox.dialog({
            title: `
            <div>
                <h5>${icon} ${titulo}</h5>
                <p class="font-11 text-muted mb-0 pb-0 mt-1"><i class="icon-location-6"></i>${locacion}</p>
            </div>`,
            size: '',
            closeButton: true,
            message: `
            <div id="container-menu-details" class= " "></div>
        `
        }).on("shown.bs.modal", function () {
            $('.modal-body').css('min-height', '520px');
        });

        if (category == "Evento") {
            // Contenido del modal
            this.tabLayout({
                parent: "container-menu-details",
                id: "tabComponent",
                content: { class: "" },
                theme: "dark",
                json: [
                    { id: "event", tab: "Evento", active: true },
                    { id: "menu", tab: "Menú" },
                ],
            });
        } else {
            // Contenido del modal
            this.tabLayout({
                parent: "container-menu-details",
                id: "tabComponent",
                content: { class: "" },
                theme: "dark",
                json: [
                    { id: "event", tab: "Evento", active: true },
                    { id: "subeventos", tab: "Subeventos" },
                ],
            });
        }

        // 🎨 Diseño de evento
        let eventDetails = `
            <div class="">
                <div class="mb-3"><strong><i class="icon-spinner"></i> Estado:</strong> ${status}</div>
                <div class="mb-3"><strong><i class="icon-clock"></i> Fecha creación:</strong> <small>${fechaCreacion}</small></div>
                <div class="mb-3"><strong><i class="icon-calendar"></i> Fecha:</strong> <small>${fechaInicio} ${horaInicio} al ${fechaFin} ${horaFin}</small></div>
                <div class="mb-3"><strong><i class="icon-user-5"></i> Cliente:</strong> <small>${cliente}</small></div>
                <div class="mb-3"><strong><i class="icon-phone"></i> Teléfono:</strong> <small>${telefono}</small></div>
                <div class="mb-3"><strong><i class="icon-mail"></i> Correo:</strong> <small>${correo}</small></div>
                <div class="mb-3"><strong><i class="icon-tags-2"></i> Tipo de evento:</strong> <small>${tipoEvento}</small></div>
                <div class="mb-3"><strong><i class="icon-users-2"></i> Total de personas:</strong> <small>${cantidadPersonas}</small></div>
                <div class="mb-3"><strong><i class="icon-money"></i> Forma de pago (anticipo):</strong> <small>${metodoPago}</small></div>

                <hr class="mt-3">
                <div class="text-sm min-h-12 bg-[#333D4C] flex flex-col justify-center pe-3 ps-3 pb-3 pt-2 rounded-bl-lg rounded-br-lg">
                    <p class="text-gray-300 mb-1">Notas:</p>
                    <p class="">${notes || ''}</p>
                </div>

            </div>`;

        $("#container-event").html(eventDetails);

        if (category == "Evento") {
            // Calcular el total de paquetes
            const totalPaquetes = menuList.reduce((sum, pkg) => sum + (parseFloat(pkg.price) || 0), 0);

            // Calcular el total de extras
            const totalExtras = (Array.isArray(extras) && extras.length > 0)
                ? extras.reduce((sum, extra) => sum + (parseFloat(extra.price) || 0), 0)
                : 0;

            // Calcular el total general
            const totalGeneral = totalPaquetes + totalExtras;

            const extrasHtml = (Array.isArray(extras) && extras.length > 0)
                ? `<div class="mt-4">
                <h3 class="text-sm font-semibold text-white mb-2">Extras</h3>
                ${extras.map(extra => `
                    <div class="flex justify-between items-center text-xs text-white py-1 border-b border-dashed">
                        <span class="w-1/4 text-left">(${extra.quantity || 0})</span>
                        <span class="w-1/2 text-start">${extra.name || ""}</span>
                        <span class="w-1/4 text-right">$${extra.price.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                `).join("")}
                </div>` : "";

            let menuVisual = `
            <div class="text-xs mt-3">
                <h3 class="text-sm font-bold text-white mb-2">Menú</h3>
                <div class="flex justify-between text-[13px] text-white font-semibold border-b pb-1 mb-2">
                <div class="w-1/4 text-left"><i class="icon-basket-alt"></i> Cantidad</div>
                <div class="w-1/2 text-center"><i class="icon-dropbox"></i> Paquete</div>
                <div class="w-1/4 text-right"><i class="icon-dollar"></i> Precio</div>
                </div>
                ${menuList.map(pkg => `
                    <div class="mb-3">
                        <div class="flex justify-between text-white font-medium py-1 border-b border-dashed">
                            <div class="w-1/4 text-left">(${pkg.quantity})</div>
                            <div class="w-1/2 text-start">${pkg.name}</div>
                            <div class="w-1/4 text-right">$${parseFloat(pkg.price).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                        ${Array.isArray(pkg.dishes) && pkg.dishes.length > 0 ? `
                        <ul class="text-xs text-white pl-4 mt-1">
                            ${pkg.dishes.map(d => `<li>- ${d.quantity} ${d.name}</li>`).join("")}
                        </ul>
                        ` : ""}
                    </div>
                `).join("")}
                ${extrasHtml}
                <!-- Total en la parte inferior derecha -->
                <div class="mt-4 pt-3">
                    <div class="flex justify-end">
                        <div class="text-white text-lg font-bold">
                            Total: $${totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>
            </div>
            `;

            $("#container-menu").html(menuVisual);
        }

        else {
            let html = response.data.subevents.map((sub) => `
                <div class="border rounded-lg shadow mb-3 bg-[#1F2A37] text-sm text-gray-200">
                    <div class="cursor-pointer px-4 py-3 flex justify-between items-center bg-[#1F2937] hover:bg-[#19232D] transition-colors duration-200"
                        onclick="eventos.toggleSubeventoDetails('subevent-${sub.id}', this)">
                        <div class="flex items-center gap-2">
                            <i class="icon-right-open-big transition-transform duration-300 transform"></i>
                            🎯
                            <div>
                                <span class="font-bold text-md">${sub.name}</span>
                                <p class="text-xs text-gray-400"><i class="icon-location-6"></i>${sub.location}</p>
                            </div>
                        </div>
                        <div class="text-xs text-gray-400">
                            ${sub.date_start} - ${sub.time_start}
                        </div>
                    </div>

                    <div id="subevent-${sub.id}" class="hidden px-4 py-3 bg-[#1F2937] rounded-b-lg">
                        <div id="tabsSubEvent-${sub.id}" class="pt-2"></div>
                    </div>
                </div>
            `).join('');

            $("#container-subeventos").removeClass("p-3").html(html);

            response.data.subevents.forEach((sub) => {
                // Tabs
                app.tabLayout({
                    parent: `tabsSubEvent-${sub.id}`,
                    id: `tab-${sub.id}`,
                    content: { class: "" },
                    theme: "dark",
                    json: [
                        { id: `detalles-${sub.id}`, tab: "Detalles", active: true },
                        { id: `menu-${sub.id}`, tab: "Menú" },
                    ],
                });

                $(`#container-detalles-${sub.id}`).removeClass("p-3");
                $(`#container-menu-${sub.id}`).removeClass("p-3");

                let estadoHtml = eventos.showStatusSubevent(sub.status_process_id);
                let money = formatPrice(sub.total_pay);

                // <p class="inline-flex me-1 mb-3"><strong><i class="icon-spinner"></i>Estado:</strong>${estadoHtml}</p>
                // Contenido de Detalles
                $(`#container-detalles-${sub.id}`).html(`
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
                        <div class="space-y-1">
                            <p class="mb-3"><strong><i class="icon-clock"></i>Hora:</strong> De ${sub.time_start} a ${sub.time_end}</p>
                            <p class="mb-2"><strong><i class="icon-cube"></i>Tipo de evento:</strong> ${sub.type}</p>
                        </div>
                        <div class="space-y-1">
                            <p class="mb-3"><strong><i class="icon-users-1"></i>Total de personas:</strong> ${sub.quantity_people}</p>
                            <p class="mb-2"><strong><i class="icon-money-1"></i>Total:</strong> ${money || 0}</p>
                        </div>
                    </div>
                    <hr class="mt-3 text-gray-300">
                    <div class="text-sm min-h-12 bg-[#333D4C] flex flex-col justify-center pe-3 ps-3 pb-3 pt-2 rounded-bl-lg rounded-br-lg text-gray-300">
                        <p class="mb-1"><strong>Notas:</strong></p>
                        <p class="text-gray-300">${notes || ""}</p>
                    </div>
                `);
                const totalPaquetes = (sub.menu && Array.isArray(sub.menu))
                    ? sub.menu.reduce((sum, pkg) => sum + (parseFloat(pkg.price) || 0), 0)
                    : 0;
                const totalExtras = (Array.isArray(sub.extras) && sub.extras.length > 0)
                    ? sub.extras.reduce((sum, extra) => sum + (parseFloat(extra.price) || 0), 0)    
                    : 0;
                // Total general
                const totalGeneral = totalPaquetes + totalExtras;
                // Contenido del Menú
                const extrasHtml = (Array.isArray(sub.extras) && sub.extras.length > 0)
                    ? `<div class="mt-4">
                    <h3 class="text-sm font-semibold text-gray-300 mb-2">Extras</h3>
                    ${sub.extras.map(extra => `
                        <div class="flex justify-between items-center text-xs text-gray-300 py-1 border-b border-dashed">
                            <span class="w-1/4 text-left">(${extra.quantity || 0})</span>
                            <span class="w-1/2 text-start">${extra.name || ""}</span>
                            <span class="w-1/4 text-right">$${parseFloat(extra.price).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    `).join("")}
                </div>` : "";

                const menuHtml = `
                    <div class="text-xs mt-3">
                        <h3 class="text-sm font-bold text-gray-300 mb-2">Menú</h3>
                        <div class="flex justify-between text-[13px] text-gray-300 font-semibold border-b pb-1 mb-2">
                            <div class="w-1/4 text-left"><i class="icon-basket-alt"></i> Cantidad</div>
                            <div class="w-1/2 text-center"><i class="icon-dropbox"></i> Paquete</div>
                            <div class="w-1/4 text-right"><i class="icon-dollar"></i> Precio</div>
                        </div>
                        ${sub.menu.map(pkg => `
                            <div class="mb-3">
                                <div class="flex justify-between text-gray-300 font-medium py-1 border-b border-dashed">
                                    <div class="w-1/4 text-left">(${pkg.quantity})</div>
                                    <div class="w-1/2 text-start">${pkg.name}</div>
                                    <div class="w-1/4 text-right">$${parseFloat(pkg.price).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                </div>
                                ${Array.isArray(pkg.dishes) && pkg.dishes.length > 0 ? `
                                <ul class="text-xs text-gray-300 pl-4 mt-1">
                                    ${pkg.dishes.map(d => `<li>- ${d.quantity} ${d.name}</li>`).join("")}
                                </ul>
                                ` : ""}
                            </div>
                        `).join("")}
                        ${extrasHtml}
                        <!-- Total en la parte inferior derecha -->
                        <div class="mt-4 pt-3">
                            <div class="flex justify-end">
                                <div class="text-white text-lg font-bold">
                                    Total: $${totalGeneral.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                $(`#container-menu-${sub.id}`).html(menuHtml);

            });

        }

    }

    toggleSubeventoDetails(id, headerEl) {
        const el = document.getElementById(id);
        if (el) el.classList.toggle("hidden");

        const icon = headerEl.querySelector("i.icon-right-open-big, i.icon-down-open-big");
        if (icon) {
            if (icon.classList.contains("icon-right-open-big")) {
                icon.classList.remove("icon-right-open-big");
                icon.classList.add("icon-down-open-big");
            } else {
                icon.classList.remove("icon-down-open-big");
                icon.classList.add("icon-right-open-big");
            }
        }
    }

    showStatusSubevent(statusId) {
        let estado = "";
        switch (statusId) {
            case 1:
                estado = `<div class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent hover:bg-[#465261] bg-[#697C92] text-white">
                    Cotización
                    </div>
                    `;
                break;
            case 2:
                estado = `<div class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent hover:bg-red-600 bg-red-500 text-white">
                    Pendiente
                    </div>
                    `;
                break;
            case 3:
                estado = `<div class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent hover:bg-green-600 bg-green-500 text-white">
                    Pagado
                    </div>
                    `;
                break;
            case 4:
                estado = `<div class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent hover:bg-gray-600 bg-gray-500 text-white">
                    Cancelado
                    </div>
                    `;
                break;

        }
        return estado;
    }

    // Crear
    newEventTabs() {
        this.primaryLayout({
            parent: "root",
            id: "NewEvent", // nombre referencia.
            class: 'flex mx-2 my-2 h-100 mt-5 p-2',

            card: {
                filterBar: {
                    id: "filterBarNewEvent",
                    class: ""
                },
                container: {
                    class: "w-full my-3 bg-[#1F2A37] rounded-lg",
                },
            },
        });

        // Opcional: puedes agregar controles al filterBar si lo deseas
        this.createfilterBar({
            parent: "filterBarNewEvent",
            data: [
                {
                    opc: "button",
                    class: "col-sm-2",
                    id: "btnRegresar",
                    text: "<i class='icon-reply'></i><span class='text-sm'> Back</span>",
                    className: '',
                    onClick: () => this.closeEvent()
                },
            ],
        });

        // $("#containerNewEvent").removeClass("d-flex mx-2 my-2 h-100 mt-5 p-4");

        $("#containerNewEvent").simple_json_tab({
            class: "p-4",
            id: "tabss",
            data: [
                {
                    tab: "Nuevo Evento",
                    id: "containerAddEvent",
                    active: true,
                    fn: this.newEventLayout(),
                },
                {
                    tab: "Crear Menú",
                    id: "containerAddMenu",
                    fn: this.newMenuLayout()
                },
            ],
        });

        this.newEventLayout();
    }

    newEventLayout() {
        $("#containerAddEvent").append(`
            <form class="" id="formEvent" novalidate>
                <div class="row" id="divEvent">
                    <div class="col-12 fw-bold text-lg mt-2 mb-2">
                        <label opc="label" id="lblEvento" class="col-12 fw-bold text-lg mt-2 mb-2 border-b p-1">Datos del cliente</label>
                    </div>
                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="name_client">Contacto</label>
                        <input type="text" class="form-control bg-[#1F2A37]" required id="name_client" placeholder="Nombre del contacto">
                    </div>
                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="phone">Teléfono</label>
                        <input type="tel" tipo="cifra" class="form-control bg-[#1F2A37]" required id="phone" placeholder="999-999-9999">
                    </div>
                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="email">Correo electrónico</label>
                        <input type="email" class="form-control bg-[#1F2A37]" id="email" placeholder="cliente@gmail.com">
                    </div>

                    <div class="col-12 fw-bold text-lg mt-2 mb-2">
                        <label opc="label" id="lblEvento" class="col-12 fw-bold text-lg mt-2 mb-2 border-b p-1">Datos del evento</label>
                    </div>

                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="name_event">Evento</label>
                        <input type="text" class="form-control bg-[#1F2A37]" required id="name_event" placeholder="Nombre del evento">
                    </div>
                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="location">Locación</label>
                        <input type="text" class="form-control bg-[#1F2A37]" required id="location" placeholder="Locación">
                    </div>
                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="date_start">Fecha de inicio</label>
                       <input type="date" class="form-control bg-[#1F2A37]" required id="date_start" placeholder="Fecha del inicio">
                    </div>
                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="time_start">Hora de inicio</label>
                        <input type="time" class="form-control bg-[#1F2A37]" required id="time_start" placeholder="Hora de inicio">
                    </div>
                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="date_end">Fecha de cierre</label>
                        <input type="date" class="form-control bg-[#1F2A37]" required id="date_end" placeholder="Fecha del cierre">
                    </div>
                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="time_end">Hora de cierre</label>
                        <input type="time" class="form-control bg-[#1F2A37]" required id="time_end" placeholder="Hora de cierre">
                    </div>
                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="type_event">Tipo de evento</label>
                        <select class="form-control bg-[#1F2A37]" required id="type_event">
                            <option value="Privado">Privado</option>
                            <option value="Abierto">Abierto</option>
                        </select>
                    </div>
                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="quantity_people">Total de personas</label>
                        <input type="text" tipo="cifra" class="form-control bg-[#1F2A37] text-end" required id="quantity_people" placeholder="0">
                    </div>

                    <div class="col-12 col-sm-12 col-md-12 col-lg-12 mb-3">
                        <label for="notes">Observaciones</label>
                        <textarea class="form-control bg-[#1F2A37]" rows="3" id="notes"></textarea>
                    </div>
                </div>

                <div class="row d-flex justify-content-end gap-2 m-0" id="btnsForm">
                    <button type="submit" class="btn btn-primary col-5 col-sm-3 col-md-2 col-lg-1 text-sm">Guardar</button>
                    <button type="button" class="btn btn-danger col-5 col-sm-3 col-md-2 col-lg-1 text-sm" onclick="eventos.closeEvent()">Salir</button>
                </div>
            </form>
        `);

        // <div class="col-12 col-sm-4 col-lg-3 mb-3">
        //             <label for="">Anticipo</label>
        //             <input type="text" tipo="cifra" class="form-control bg-[#1F2A37] text-end" id="advanced_pay" placeholder="0.00">
        //         </div>
        //         <div class="col-12 col-sm-4 col-lg-3 mb-3">
        //             <label for="">Forma de pago</label>
        //             <select class="form-control bg-[#1F2A37]" id="method_pay_id">
        //                 <option value="0">Selecciona una opción</option>
        //                 <option value="1">Efectivo</option>
        //                 <option value="2">Tarjeta</option>
        //                 <option value="3">Transferencia</option>
        //             </select>
        //         </div>

        $("#phone").on("input", function () {
            let value = $(this).val().replace(/\D/g, ""); // Elimina caracteres no numéricos
            if (value.length > 10) {
                value = value.slice(0, 10); // Limita a 9 dígitos
            }
            $(this).val(value);
        });
        $("#date_end").on("change", function () {
            let date_start = $("#date_start").val();
            let date_end = $("#date_end").val();
            if (date_end < date_start) {
                alert({
                    icon: "error",
                    text: "La fecha de cierre no puede ser menor a la fecha de inicio",
                });
                $("#date_end").val("");
            }
        });

        $("#date_start").val(new Date().toISOString().split("T")[0]);
        $("#date_end").val(new Date().toISOString().split("T")[0]);

        $("#date_start").on("change", function () {
            $("#date_end").val($("#date_start").val());
        });


        $('#formEvent').on('keypress', 'input, select, textarea', function (e) {
            if (e.which == 13) { // 🔍 13 es el código de la tecla Enter
                e.preventDefault(); // 🛑 Detiene el envío

                let inputs = $('#formEvent').find('input:visible, select:visible, textarea:visible').filter(':not([disabled])');
                let idx = inputs.index(this);

                if (idx > -1 && (idx + 1) < inputs.length) {
                    inputs.eq(idx + 1).focus(); // ✨ ¡Siguiente campo activado!
                }
            }
        });

        $("#formEvent").validation_form({}, function (result) {
            const advancedPay = $("#advanced_pay").val();
            const methodPayId = $("#method_pay_id").val();

            // if (advancedPay || methodPayId != 0) {
            //     if (!advancedPay && methodPayId != 0) {
            //         alert({ icon: "error", title: "Agrega el anticipo", btn1: true, btn1Text: "Ok" });
            //     } else if (advancedPay && methodPayId == 0) {
            //         alert({ icon: "error", title: "Agrega la forma de pago", btn1: true, btn1Text: "Ok" });
            //     } else {
            //         $("#formEvent button[type='submit']").attr("disabled", "disabled");
            //         eventos.addEvent();
            //     }
            // } else {
            $("#formEvent button[type='submit']").attr("disabled", "disabled");
            eventos.addEvent();
            // }
        });
    }

    addEvent() {

        let datos = {
            opc: "addEvent",
            name_client: $("#name_client").val(),
            phone: $("#phone").val(),
            email: $("#email").val(),
            name_event: $("#name_event").val(),
            location: $("#location").val(),
            date_start: $("#date_start").val(),
            time_start: $("#time_start").val(),
            date_end: $("#date_end").val(),
            time_end: $("#time_end").val(),
            type_event: $("#type_event").val(),
            quantity_people: $("#quantity_people").val(),
            advanced_pay: $("#advanced_pay").val(),
            method_pay_id: $("#method_pay_id").val(),
            notes: $("#notes").val(),
        };

        fn_ajax(datos, link).then((response) => {
            if (response.status == 200) {
                alert({
                    icon: "success",
                    title: "Evento creado con éxito",
                    text: response.message,
                    btn1: true,
                    btn1Text: "Ok",
                });

                $("#formEvent button[type='submit']").removeAttr("disabled");

                // Poner disabled a los inputs
                $("#formEvent input").attr("disabled", "disabled");
                // Poner disabled al select
                $("#formEvent select").attr("disabled", "disabled");
                // Poner disabled al textarea
                $("#formEvent textarea").attr("disabled", "disabled");
                // Poner disabled al botón
                $("#formEvent button").attr("disabled", "disabled");



                // Mostrar formulario de menú
                $("#containerAddMenu-tab").tab("show");
                // Quitar disabled a los inputs
                $("#formMenu input").removeAttr("disabled");
                $("#formMenu select").removeAttr("disabled");
                $("#formMenu button").removeAttr("disabled");

                $("#total_pay").attr("disabled", "disabled");
                // Botones ocultar/mostrar
                // $("#btnsForm").addClass("d-none");
                $("#btnsFormMenu").removeClass("d-none");
                id_event = response.data.id;
            } else {
                alert({
                    icon: "error",
                    text: response.message,
                    btn1: true,
                    btn1Text: "Ok",
                });
                $("#formEvent button[type='submit']").removeAttr("disabled");
            }
        });
    }


    // Editar
    editEventTabs = (id) => {
        this.primaryLayout({
            parent: "root",
            id: "EditEvent", // nombre referencia.
            class: 'flex mx-2 my-2 h-100 mt-5 p-2',

            card: {
                filterBar: {
                    id: "filterBarEditEvent",
                    class: ""
                },
                container: {
                    class: "w-full my-3 bg-[#1F2A37] rounded-lg",
                },
            },
        });

        // Filterbar con botón regresar
        this.createfilterBar({
            parent: "filterBarEditEvent",
            data: [
                {
                    opc: "button",
                    class: "col-sm-2",
                    id: "btnRegresarEdit",
                    text: "<i class='icon-reply'></i><span class='text-sm'> Back</span>",
                    color_btn: "",
                    onClick: () => this.closeEvent()
                },
            ],
        });
        // $("#containerEditEvent").removeClass("d-flex mx-2 my-2 h-100 mt-5 p-4");

        $("#containerEditEvent").simple_json_tab({
            class: "p-4",
            id: "tabss",
            data: [
                {
                    tab: "Editar Evento",
                    id: "containerEditEvent2",
                    active: true,
                },
                {
                    tab: "Editar Menú",
                    id: "containerAddMenu",
                },
            ],
        });

        id_event = id;

        this.editEventLayout(id);
        this.editMenuLayout(id);
    }

    async editEventLayout(id) {
        let data = await useFetch({ url: link, data: { opc: "getEvent", id: id } });

        let evento = data.data.event;

        $("#containerEditEvent2").append(`
            <form class="" id="formEvent" novalidate>
                <div class="row" id="divEvent">
                    <div class="col-12 fw-bold text-lg mt-2 mb-2">
                        <label opc="label" id="lblEvento" class="col-12 fw-bold text-lg mt-2 mb-2 border-b p-1">Datos del cliente</label>
                    </div>
                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="name_client">Contacto</label>
                        <input type="text" class="form-control bg-[#1F2A37]" required id="name_client" placeholder="Nombre del contacto" value="${evento.name_client}">
                    </div>
                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="phone">Teléfono</label>
                        <input type="tel" tipo="cifra" class="form-control bg-[#1F2A37]" required id="phone" placeholder="999-999-9999" value="${evento.phone}">
                    </div>
                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="email">Correo electrónico</label>
                        <input type="email" class="form-control bg-[#1F2A37]" id="email" placeholder="cliente@gmail.com" value="${evento.email ? evento.email : ""}">
                    </div>

                    <div class="col-12 fw-bold text-lg mt-2 mb-2">
                        <label opc="label" id="lblEvento" class="col-12 fw-bold text-lg mt-2 mb-2 border-b p-1">Datos del evento</label>
                    </div>
                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="name_event">Evento</label>
                        <input type="text" class="form-control bg-[#1F2A37]" required id="name_event" placeholder="Nombre del evento" value="${evento.name_event}">
                    </div>
                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="location">Locación</label>
                        <input type="text" class="form-control bg-[#1F2A37]" required id="location" placeholder="Locación" value="${evento.location}">
                    </div>
                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="date_start">Fecha de inicio</label>
                        <input type="date" class="form-control bg-[#1F2A37]" required id="date_start" placeholder="Fecha del inicio" value="${evento.date_start}">
                    </div>
                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="time_start">Hora de inicio</label>
                        <input type="time" class="form-control bg-[#1F2A37]" required id="time_start" placeholder="Hora de inicio" value="${evento.time_start}">
                    </div>
                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="date_end">Fecha de cierre</label>
                        <input type="date" class="form-control bg-[#1F2A37]" required id="date_end" placeholder="Fecha del cierre" value="${evento.date_end}">
                    </div>
                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="time_end">Hora de cierre</label>
                        <input type="time" class="form-control bg-[#1F2A37]" required id="time_end" placeholder="Hora de cierre" value="${evento.time_end}">
                    </div>
                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="type_event">Tipo de evento</label>
                        <select class="form-control bg-[#1F2A37]" required id="type_event">
                            <option value="Privado">Privado</option>
                            <option value="Abierto">Abierto</option>
                        </select>
                    </div>
                    <div class="col-12 col-sm-4 col-lg-3 mb-3">
                        <label for="quantity_people">Total de personas</label>
                        <input type="text" tipo="cifra" class="form-control bg-[#1F2A37] text-end" required id="quantity_people" placeholder="0" value="${evento.quantity_people}">
                    </div>

                    <div class="col-12 col-sm-12 col-md-12 col-lg-12 mb-3">
                        <label for="notes">Observaciones</label>
                        <textarea class="form-control bg-[#1F2A37]" rows="3" id="notes">${evento.notes ? evento.notes : ""}</textarea>
                    </div>
                </div>
                <div class="row d-flex justify-content-end gap-2 m-0" id="btnsForm">
                    <button type="submit" class="btn btn-primary col-5 col-sm-3 col-md-2 col-lg-1 text-sm">Actualizar</button>
                    <button type="button" class="btn bg-[#4b5563] hover:bg-[#374151] text-[#fff] col-5 col-sm-3 col-md-2 col-lg-1 text-sm" onclick="eventos.closeEvent()">Cerrar</button>
                </div>
            </form>`);

        //    <div class="col-12 col-sm-4 col-lg-3 mb-3">
        //                 <label for="">Anticipo</label>
        //                 <input type="text" tipo="cifra" class="form-control bg-[#1F2A37] text-end" id="advanced_pay" placeholder="0.00" value="${evento.advanced_pay ? evento.advanced_pay : ""}">
        //             </div>
        //             <div class="col-12 col-sm-4 col-lg-3 mb-3">
        //                 <label for="">Forma de pago</label>
        //                 <select class="form-control bg-[#1F2A37]" id="method_pay_id">
        //                     <option value="0">Selecciona una opción</option>
        //                     <option value="1">Efectivo</option>
        //                     <option value="2">Tarjeta</option>
        //                     <option value="3">Transferencia</option>
        //                 </select>
        //             </div>

        if (evento.method_pay_id) {
            $("#method_pay_id").val(evento.method_pay_id);
        }

        $("#phone").on("input", function () {
            let value = $(this).val().replace(/\D/g, ""); // Elimina caracteres no numéricos
            if (value.length > 10) {
                value = value.slice(0, 10); // Limita a 9 dígitos
            }
            $(this).val(value);
        });
        $("#type_event").val(evento.type_event);

        $("#date_end").on("change", function () {
            let date_start = $("#date_start").val();
            let date_end = $("#date_end").val();
            if (date_end < date_start) {
                alert({
                    icon: "error",
                    text: "La fecha de cierre no puede ser menor a la fecha de inicio",
                });
                $("#date_end").val("");
            }
        });

        $("#date_start").on("change", function () {
            $("#date_end").val($("#date_start").val());
        });

        $('#formEvent').on('keypress', 'input, select, textarea', function (e) {
            if (e.which == 13) { // 🔍 13 es el código de la tecla Enter
                e.preventDefault(); // 🛑 Detiene el envío

                let inputs = $('#formEvent').find('input:visible, select:visible, textarea:visible').filter(':not([disabled])');
                let idx = inputs.index(this);

                if (idx > -1 && (idx + 1) < inputs.length) {
                    inputs.eq(idx + 1).focus(); // ✨ ¡Siguiente campo activado!
                }
            }
        });

        $("#formEvent").validation_form({}, function (result) {
            const advancedPay = $("#advanced_pay").val();
            const methodPayId = $("#method_pay_id").val();

            // if (advancedPay || methodPayId != 0) {
            //     if (!advancedPay && methodPayId != 0) {
            //         alert({ icon: "error", title: "Agrega el anticipo", btn1: true, btn1Text: "Ok" });
            //     } else if (advancedPay && methodPayId == 0) {
            //         alert({ icon: "error", title: "Agrega la forma de pago", btn1: true, btn1Text: "Ok" });
            //     } else {
            //         $("#formEvent button[type='submit']").attr("disabled", "disabled");
            //         eventos.updateEvent(id);
            //     }
            // } else {
            $("#formEvent button[type='submit']").attr("disabled", "disabled");
            eventos.updateEvent(id);
            // }
        });
    }

    updateEvent(id) {
        // Si no hay método, entonces no se envía el campo
        let metodo = null;
        if ($("#method_pay_id").val() != "0") {
            metodo = $("#method_pay_id").val();
        }

        // Si cambia el anticipo, entonces cambia el estado a "Pendiente de pago"
        let status_process = 1; // Cotización

        let datos = {
            opc: "editEvent",
            name_client: $("#name_client").val(),
            phone: $("#phone").val(),
            email: $("#email").val(),
            name_event: $("#name_event").val(),
            location: $("#location").val(),
            date_start: $("#date_start").val(),
            time_start: $("#time_start").val(),
            date_end: $("#date_end").val(),
            time_end: $("#time_end").val(),
            type_event: $("#type_event").val(),
            quantity_people: $("#quantity_people").val(),
            advanced_pay: $("#advanced_pay").val(),
            notes: $("#notes").val(),
            method_pay_id: metodo,
            status_process_id: status_process,
            id: id,
        };

        fn_ajax(datos, link).then((response) => {
            if (response.status == 200) {
                alert({
                    icon: "success",
                    title: "Evento actualizado con éxito",
                    text: response.message,
                    btn1: true,
                    btn1Text: "Ok",
                });

                $("#formEvent button[type='submit']").removeAttr("disabled");
            } else {
                alert({
                    icon: "error",
                    text: response.message,
                    btn1: true,
                    btn1Text: "Ok",
                });
                $("#formEvent button[type='submit']").removeAttr("disabled");
            }
        });
    }


    // MENU -------------------------------------
    async newMenuLayout(id = null) {
        let menusPrecargadosData = await useFetch({ url: link, data: { opc: "getPackages" } });
        let extrasDisponiblesData = await useFetch({ url: link, data: { opc: "getProducts" } });
        let clasificacionesData = await useFetch({ url: link, data: { opc: "getClassifications" } });

        let menusPrecargados = menusPrecargadosData.data;
        let extrasDisponibles = extrasDisponiblesData.data;
        let clasificaciones = clasificacionesData.data;


        $("#containerAddMenu").append(`
            <div class="flex justify-end mb-2">
                <button id="" onclick="window.location.href='https://huubie.com.mx/alpha/catalogos/'"
                    class="flex items-center justify-center gap-2 bg-[#1A56DB] hover:bg-[#274DCD] text-white font-medium py-2 px-6 rounded-md shadow-md">
                    Panel de administración
                </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

              <!-- Card Selecciona Paquetes -->
              <div id="divPaquetes" class="md:col-span-2">
                <div class="bg-[#1F2A37] rounded-lg border border-gray-700 shadow-md p-6 text-white">
                  <div class="mb-4">
                    <h3 class="text-xl font-bold">Selecciona Paquetes</h3>
                    <p class="text-sm text-gray-400">Elija uno o más menús/paquetes y la cantidad de personas</p>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                      <label for="selectMenu" class="block text-sm font-medium text-gray-300 mb-1">Paquete Precargado</label>
                      <select id="selectMenu" class="w-full rounded-md bg-gray-800 text-white border border-gray-600 p-2">
                        <option value="">Seleccione un menú</option>
                      </select>
                    </div>
                    <div>
                      <label for="cantidadPersonas" class="block text-sm font-medium text-gray-300 mb-1">Cantidad</label>
                      <input type="number" min="1" value="1" id="cantidadPersonas" class="w-full rounded-md bg-gray-800 text-white border border-gray-600 p-2" />
                    </div>
                    <div class="flex items-end">
                      <button id="btnAgregarMenu" class="w-full flex items-center justify-center gap-2 bg-[#1A56DB] hover:bg-[#274DCD] text-white font-medium py-2 px-4 rounded-md">
                        <i class="icon-plus-circle"></i> Agregar Menú
                      </button>
                    </div>
                  </div>

                  <hr class="border-gray-700 mb-4" />

                  <div>
                    <h4 class="font-semibold text-white mb-2">Menús seleccionados</h4>
                    <div id="contentPaquetes" class="bg-gray-900 text-gray-400 p-4 rounded-md text-center">
                      No hay menús seleccionados
                    </div>
                    <div id="detalleMenuSeleccionado" class="mt-6"></div>

                  </div>
                </div>
              </div>

              <!-- Card Resumen -->
              <div id="divResumen">
                <div class="bg-[#1F2A37] h-full rounded-lg border border-gray-700 shadow-md p-6 text-white">
                  <div class="mb-4">
                    <h3 class="text-xl font-bold">Resumen del Pedido</h3>
                    <p class="text-sm text-gray-400">Detalles de su selección</p>
                  </div>

                  <div id="contentResumen" class="bg-gray-900 text-gray-400 p-4 rounded-md text-center">
                    Seleccione al menos un menú para ver el resumen
                  </div>
                </div>
              </div>
            </div>

            <!-- Card Agregar Extras -->
            <div id="divExtras" class="col-span-3 mt-4">
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
                                    <select id="selectExtra" class="w-full rounded-md bg-gray-800 text-white border border-gray-600 p-2">
                                        <option value="">Seleccione un extra</option>
                                    </select>
                                    <input id="extraCantidad" type="number" min="1" value="1" class="w-20 rounded-md bg-gray-800 text-white border border-gray-600 p-2" placeholder="Cantidad">
                                    <button id="btnAgregarExtra" class="w-50 px-4 py-2 text-white rounded bg-[#1A56DB] hover:bg-[#274DCD]"><i class="icon-plus-circle"></i>Agregar</button>
                                </div>
                            </div>

                            <div class="mb-4">
                                <h4 class="font-semibold mb-2">Extra personalizado</h4>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <label class="block text-sm text-gray-300 mb-1">Nombre del platillo</label>
                                        <input id="extraNombre" type="text" class="w-full rounded-md bg-gray-800 text-white border border-gray-600 p-2" placeholder="Ej. Postre especial">
                                    </div>
                                    <div>
                                        <label class="block text-sm text-gray-300 mb-1">Clasificación</label>
                                        <select id="selectClass" class="w-full rounded-md bg-gray-800 text-white border border-gray-600 p-2">
                                            <option value="">Seleccione una clasificación</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block text-sm text-gray-300 mb-1">Precio (MXN)</label>
                                        <input id="extraPrecio" type="number" min="0" class="w-full rounded-md bg-gray-800 text-white border border-gray-600 p-2" placeholder="Ej. 250">
                                    </div>
                                    <div>
                                        <label class="block text-sm text-gray-300 mb-1">Cantidad</label>
                                        <input id="extraCantidadCustom" type="number" min="1" value="1" class="w-full rounded-md bg-gray-800 text-white border border-gray-600 p-2" placeholder="Cantidad">
                                    </div>

                                    <div>
                                        <button id="btnAgregarExtraPersonalizado" class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#1A56DB] text-white rounded hover:bg-[#274DCD]">
                                            <i class="icon-plus-circle"></i> Agregar extra personalizado
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Lista de extras agregados -->
                        <div>
                            <h4 class="font-semibold mb-2">Extras agregados</h4>
                            <div id="contentExtras" class="bg-gray-900 text-gray-400 p-4 rounded-md min-h-[300px] overflow-auto text-center">
                            No hay extras agregados
                            </div>
                        </div>
                    </div>

                    <div class="mt-6 text-right">
                        <button id="saveMenuEvent" class="px-6 py-2 font-semibold rounded-md bg-[#1A56DB] hover:bg-[#274DCD]">Guardar</button>
                        <button id="btnCancelarMenu" class="px-6 py-2 font-semibold rounded-md bg-[#4b5563] hover:bg-[#374151] text-[#fff]" onclick="eventos.closeEvent()">Cancelar</button>
                    </div>
                </div>
            </div>

        `);


        // MENUS PRECARGADOS --------------------
        // Cargar opciones en el select
        menusPrecargados.forEach(menu => {
            $("#selectMenu").append(`<option value="${menu.id}">${menu.nombre} - $${menu.precioPorPersona}/persona</option>`);
        });

        // Escuchar clic en Agregar Menú
        $("#btnAgregarMenu").on("click", () => {
            const idSeleccionado = $("#selectMenu").val();
            const cantidad = parseInt($("#cantidadPersonas").val()) || 1;
            const menu = menusPrecargados.find(m => m.id == idSeleccionado);


            if (!idSeleccionado || cantidad <= 0) {
                alert({ icon: "warning", text: "Debe seleccionar un paquete y una cantidad válida." });
                return;
            }

            if (!menu) return;


            const existente = this.menusSeleccionados.find(item => item.menu.id == idSeleccionado);

            if (existente) {
                existente.cantidadPersonas += cantidad;
            } else {
                this.menusSeleccionados.push({ menu, cantidadPersonas: cantidad });
            }

            // $("#divExtras").removeClass("d-none");
            $("#selectMenu").val("");
            $("#cantidadPersonas").val(1);

            eventos.renderPaquetes();
            eventos.renderResumen();
        });


        // Función para cambiar cantidad de personas
        window.cambiarCantidad = (index, delta) => {
            const nuevaCantidad = eventos.menusSeleccionados[index].cantidadPersonas + delta;
            if (nuevaCantidad > 0) {
                eventos.menusSeleccionados[index].cantidadPersonas = nuevaCantidad;
                eventos.renderPaquetes();
                eventos.renderResumen();
            }
        };

        // Función para eliminar menú
        window.eliminarMenu = (index) => {
            eventos.menusSeleccionados.splice(index, 1);
            if (eventos.menusSeleccionados.length == 0) {
                // $("#divExtras").addClass("d-none");
            }
            eventos.renderPaquetes();
            eventos.renderResumen();
        };



        // EXTRAS ------------------------------
        extrasDisponibles.forEach(extra => {
            $("#selectExtra").append(`<option value="${extra.id}">${extra.nombre} - $${extra.precio}</option>`);
        });

        // Evento único de Agregar Extra
        $(document).off("click", "#btnAgregarExtra").on("click", "#btnAgregarExtra", () => {

            const id = $("#selectExtra").val();
            const cantidad = parseInt($("#extraCantidad").val()) || 1;
            const extra = extrasDisponibles.find(e => e.id == id);

            if (!id || cantidad <= 0) {
                alert({ icon: "warning", text: "Debe seleccionar un extra y una cantidad válida." });
                return;
            }

            if (extra && cantidad > 0) {
                const yaExiste = this.extrasSeleccionados.find(e => e.id == extra.id && !e.custom);
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

                $("#selectExtra").val("");
                $("#extraCantidad").val("1");
                eventos.renderExtras();
            }
        });

        // Evento de Extra Personalizado
        $(document).off("click", "#btnAgregarExtraPersonalizado").on("click", "#btnAgregarExtraPersonalizado", () => {
            const nombre = $("#extraNombre").val().trim();
            const precio = parseFloat($("#extraPrecio").val());
            const cantidad = parseInt($("#extraCantidadCustom").val()) || 1;
            const id_classification = $("#selectClass").val();

            if (nombre && !isNaN(precio) && precio > 0 && cantidad > 0 && id_classification) {
                const data = {
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
                        $("#extraNombre").val("");
                        $("#extraPrecio").val("");
                        $("#extraCantidadCustom").val("1");
                        $("#selectClass").val("");

                        eventos.renderExtras();
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
            eventos.renderExtras();
        };

        // Función para cambiar cantidad de extras
        window.cambiarCantidadExtra = (index, delta) => {
            const extra = eventos.extrasSeleccionados[index];
            const nuevaCantidad = extra.cantidad + delta;

            if (nuevaCantidad > 0) {
                extra.cantidad = nuevaCantidad;
                eventos.renderExtras();
            }
        };


        // CLASIFICACIONES -------------------
        this.clasificaciones = clasificaciones;
        clasificaciones.forEach(clas => {
            $("#selectClass").append(`<option value="${clas.id}">${clas.nombre}</option>`);
        });


        // GUARDAR MENÚ ----------------------
        $("#saveMenuEvent").on("click", () => {
            // Validar que se haya guardado el evento
            if (!id_event || id_event == 0) {
                alert({
                    icon: "error",
                    text: "No has creado un evento aún.",
                    btn1: true,
                    btn1Text: "Ok"
                });
                return;
            }

            // Validar que se haya seleccionado al menos un menú
            if (eventos.menusSeleccionados.length == 0 && eventos.extrasSeleccionados.length == 0) {
                alert({
                    icon: "error",
                    text: "Agrega al menos un menú o producto",
                    btn1: true,
                    btn1Text: "Ok"
                });
                return;
            }

            // 🔎 Detectar si es edición o creación
            const isEdit = !!id;
            const action = isEdit ? "editEventMenus" : "addEventMenus";

            const data = {
                opc: action,
                id_event: id_event,
                menus: JSON.stringify(eventos.menusSeleccionados),
                extras: JSON.stringify(eventos.extrasSeleccionados),
                total: $(`#pagoTotal`).text().replace("$", "").replace(",", "")
            };

            fn_ajax(data, link).then((response) => {
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        text: response.message,
                        timer: 2000,
                    });

                    // Solo cerrar si es nuevo (no edición)
                    if (!isEdit) {
                        eventos.closeEvent();
                    }
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
    renderPaquetes() {
        const contenedor = $("#contentPaquetes");
        contenedor.html(`<p>No hay paquetes seleccionados!!!!! </p>`);

        if (eventos.menusSeleccionados.length == 0) {
            contenedor.html(`<p>No hay menús seleccionados</p>`);
            return;
        }

        contenedor.empty();
        eventos.menusSeleccionados.forEach((item, index) => {
            const total = item.menu.precioPorPersona * item.cantidadPersonas;
            const html = `
            <div class="border border-gray-700 p-3 rounded-lg bg-gray-800 mb-3">
              <div class="grid grid-cols-12 items-center gap-4">

                <!-- Info del menú -->
                <div class="col-span-6 flex flex-col justify-start text-left">
                  <div class="flex items-center gap-2">
                    <h4 class="font-semibold text-white truncate">${item.menu.nombre}</h4>
                    <button onclick="eventos.verDetallesMenu(${index})" class="text-sm px-2 py-1 bg-[#333D4C] text-blue-300 hover:text-blue-100 hover:bg-[#3f4b5c] border border-gray-600 rounded-md transition-colors duration-200">
                      Ver detalles
                    </button>
                  </div>
                  <p class="text-gray-400 text-sm truncate">${item.menu.descripcion ? item.menu.descripcion : 'Sin descripción'}</p>
                </div>

                <!-- Stepper -->
                <div class="col-span-3 flex justify-end items-center">
                  <div class="inline-flex items-center border border-gray-600 rounded-md overflow-hidden bg-gray-700 h-9">
                    <button onclick="cambiarCantidad(${index}, -1)" class="px-2 text-white hover:bg-gray-600 h-full">−</button>
                    <span id="cantidadIndex${index}" class="px-4 text-white text-center font-medium min-w-[30px] h-full flex items-center justify-center">
                      ${item.cantidadPersonas}
                    </span>
                    <button onclick="cambiarCantidad(${index}, 1)" class="px-2 text-white hover:bg-gray-600 h-full">+</button>
                  </div>
                </div>

                <!-- Total alineado a la derecha -->
                <div class="col-span-2 flex justify-end text-right">
                  <span class="text-[#3FC189] font-bold block">${formatPrice(total)}</span>
                </div>

                <!-- Eliminar -->
                <div class="col-span-1 flex justify-end">
                  <button class="text-red-400 hover:text-red-600" onclick="eliminarMenu(${index})">
                    <i class="icon-trash"></i>
                  </button>
                </div>

              </div>
            </div>
        `;
            contenedor.append(html);
        });
    }

    renderExtras() {
        const cont = $("#contentExtras");


        if (eventos.extrasSeleccionados.length == 0) {
            cont.html(`<p>No hay extras agregados</p>`);
            eventos.renderResumen();
            return;
        }

        cont.empty();

        eventos.extrasSeleccionados.forEach((extra, i) => {
            const total = extra.precio * extra.cantidad;
            let clasificacion = this.clasificaciones.find(c => c.id == extra.id_clasificacion);
            if (!clasificacion) {
                clasificacion = { nombre: "Sin clasificación" };
            }

            cont.append(`
            <div class="border border-gray-700 p-3 rounded-lg bg-gray-800 mb-3">
              <div class="grid grid-cols-12 items-center gap-4">

                <!-- Info del extra -->
                <div class="col-span-6 flex flex-col justify-start text-left">
                  <h4 class="font-semibold text-white truncate">${extra.nombre}</h4>
                  <p class="text-gray-400 text-sm truncate">${clasificacion.nombre}</p>
                </div>

                <!-- Stepper cantidad -->
                <div class="col-span-3 flex justify-center items-center">
                  <div class="inline-flex items-center border border-gray-600 rounded-md overflow-hidden bg-gray-700 h-9">
                    <button onclick="cambiarCantidadExtra(${i}, -1)" class="px-2 text-white hover:bg-gray-600 h-full">−</button>
                    <span id="cantidadExtra${i}" class="px-4 text-white text-center font-medium min-w-[30px] h-full flex items-center justify-center">
                      ${extra.cantidad}
                    </span>
                    <button onclick="cambiarCantidadExtra(${i}, 1)" class="px-2 text-white hover:bg-gray-600 h-full">+</button>
                  </div>
                </div>

                <!-- Total -->
                <div class="col-span-2 flex justify-end">
                  <span class="text-[#3FC189] font-bold block">${formatPrice(total)}</span>
                </div>

                <!-- Eliminar -->
                <div class="col-span-1 flex justify-end">
                  <button class="text-red-400 hover:text-red-600" onclick="eliminarExtra(${i})">
                    <i class="icon-trash"></i>
                  </button>
                </div>

              </div>
            </div>
          `);
        });

        eventos.renderResumen();
    }

    // Render resumen con cantidad de extras y precio total

    renderResumen() {
        const contenedor = $("#contentResumen");
        const menus = eventos.menusSeleccionados;
        const extras = eventos.extrasSeleccionados;

        if (menus.length == 0 && extras.length == 0) {
            contenedor.html(`<p>Seleccione al menos un menú o un extra para ver el resumen</p>`);
            return;
        }

        let total = 0;

        const resumenMenus = menus.length > 0
            ? `<h4 class="text-sm font-semibold text-white mb-2">Menús:</h4>` +
            menus.map((item) => {
                const subtotal = item.menu.precioPorPersona * item.cantidadPersonas;
                total += subtotal;
                return `<div class="flex justify-between text-xs text-white mb-1">
                        <span class="w-1/2 truncate">(${item.cantidadPersonas}) ${item.menu.nombre}</span>
                        <span class="text-end w-1/4">${formatPrice(item.menu.precioPorPersona)}</span>
                        <span class="text-end w-1/4">${formatPrice(subtotal)}</span>
                    </div>`;
            }).join("")
            : "";

        const resumenExtras = extras.length > 0
            ? `<h4 class="text-sm font-semibold text-white mt-4 mb-2">Extras:</h4>` +
            extras.map((extra) => {
                const subtotal = extra.precio * extra.cantidad;
                total += subtotal;
                return `<div class="flex justify-between text-xs text-white mb-1">
                        <span class="w-1/2 truncate">(${extra.cantidad}) ${extra.nombre}</span>
                        <span class="text-end w-1/4 ">${formatPrice(extra.precio)}</span>
                        <span class="text-end w-1/4 ">${formatPrice(subtotal)}</span>
                    </div>`;
            }).join("")
            : "";

        contenedor.html(`
            <div class="text-left">
                ${resumenMenus}
                ${resumenExtras}
            </div>
            <hr class="border-gray-600 my-3" />
            <div class="flex justify-between font-bold text-white text-lg">
                <span>Total:</span>
                <span id="pagoTotal" class="text-right">${formatPrice(total)}</span>
            </div>
        `);
    }

    verDetallesMenu(index) {
        this.menuSeleccionadoParaVer = this.menusSeleccionados[index].menu;
        this.renderDetallesMenu();
    }

    cerrarDetallesMenu() {
        this.menuSeleccionadoParaVer = null;
        $("#detalleMenuSeleccionado").empty();
    }

    renderDetallesMenu() {
        const menu = this.menuSeleccionadoParaVer;
        const cont = $("#detalleMenuSeleccionado");
        if (!menu) return cont.empty();

        const html = `
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
              <button onclick="eventos.cerrarDetallesMenu()" class="text-blue-400 hover:underline">Cerrar detalles</button>
            </div>
          </div>
        `;
        cont.html(html);
    }

    async editMenuLayout(id) {
        // 📦 Obtener los menús y extras del evento desde el backend
        let response = await useFetch({
            url: link,
            data: { opc: "getEventMenus", id_event: id }
        });

        // 🧼 Limpiar las listas actuales
        this.menusSeleccionados = [];
        this.extrasSeleccionados = [];

        // 📌 Paso el id y renderizo interfaz
        this.newMenuLayout(id);

        // 🔁 Prellenar menús seleccionados
        if (Array.isArray(response.menus)) {
            response.menus.forEach(item => {
                this.menusSeleccionados.push({
                    menu: item.menu,
                    cantidadPersonas: parseInt(item.cantidadPersonas)
                });
            });
        }


        // 🔁 Prellenar extras seleccionados
        if (Array.isArray(response.extras)) {
            response.extras.forEach(extra => {
                this.extrasSeleccionados.push({
                    id: extra.id,
                    nombre: extra.nombre,
                    precio: parseFloat(extra.precio),
                    cantidad: parseInt(extra.cantidad),
                    id_clasificacion: extra.id_clasificacion,
                    custom: !!extra.custom
                });
            });
        }

        // 🔄 Refrescar la vista con los datos cargados
        setTimeout(() => {
            // $("#divExtras").removeClass("d-none");
            $("#selectMenu").val("");
            $("#cantidadPersonas").val(1);
            eventos.renderPaquetes();
            eventos.renderResumen();
            eventos.renderExtras();
        }, 600);
    }

    // FUNCIONES AUXILIARES ------------------
    // Cerrar formulario
    closeEvent() {
        id_event = null;
        window.history.pushState({}, document.title, window.location.pathname);
        app.init();
    }

    // Devuelve el estado con frontend : Pendiente, Pagado, Cancelado
    eventStatus(statusEvent) {
        let status = "";
        switch (statusEvent) {
            case "Cotización":
                status = `
        <div class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-[#6E95C0] text-white">
            <div style="margin-right: 5px; border-radius: 99px; height: 8px; width: 8px; background-color: #496380; display: inline-block; flex-shrink: 0;"></div>
            ${statusEvent}
        </div>`;
                break;

            case "Pendiente":
                status = `
        <div class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-[#FE6F00] text-white">
            <div style="margin-right: 5px; border-radius: 99px; height: 8px; width: 8px; background-color: #A94A00; display: inline-block; flex-shrink: 0;"></div>
            ${statusEvent}
        </div>`;
                break;

            case "Pagado":
                status = `
        <div class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-[#0E9E6E] text-white">
            <div style="margin-right: 5px; border-radius: 99px; height: 8px; width: 8px; background-color: #096949; display: inline-block; flex-shrink: 0;"></div>
            ${statusEvent}
        </div>`;
                break;

            case "Cancelado":
                status = `
        <div class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-[#E00001] text-white">
            <div style="margin-right: 5px; border-radius: 99px; height: 8px; width: 8px; background-color: #950000; display: inline-block; flex-shrink: 0;"></div>
            ${statusEvent}
        </div>`;
                break;
        }
        return status;

    }
}

function formatSpanishDate(fecha = null, type = "normal") {
    let date;

    if (!fecha) {
        // Si no se pasa nada, usamos la fecha actual
        date = new Date();
    } else {
        // Dividimos fecha y hora si existe
        // ejemplo: "2025-03-08 09:14" => ["2025-03-08", "09:14"]
        const [fechaPart, horaPart] = fecha.split(" ");

        // Descomponer "YYYY-MM-DD"
        const [year, month, day] = fechaPart.split("-").map(Number);

        if (horaPart) {
            // Si hay hora, por ejemplo "09:14"
            const [hours, minutes] = horaPart.split(":").map(Number);
            // Crear Date con hora local
            date = new Date(year, month - 1, day, hours, minutes);
        } else {
            // Solo fecha
            date = new Date(year, month - 1, day);
        }
    }

    // Extraer partes de la fecha
    const dia = date.getDate();
    const anio = date.getFullYear();

    // Obtenemos el mes en español (México).
    // Nota: El mes corto en español a veces incluye punto (ej: "mar."). Lo eliminamos:
    const mesCorto = date
        .toLocaleString("es-MX", { month: "short" })
        .replace(".", "");
    const mesLargo = date.toLocaleString("es-MX", { month: "long" });

    // Asegurar que el día tenga 2 dígitos
    const diaPadded = String(dia).padStart(2, "0");

    // Formatos deseados
    const formatos = {
        short: `${diaPadded}/${mesCorto}/${anio}`, // p.ej. "08/mar/2025"
        normal: `${diaPadded} de ${mesLargo} del ${anio}`, // p.ej. "08 de marzo del 2025"
    };

    // Devolvemos el formato según type
    return formatos[type] || formatos.short;
}
