// let calendario;

// const ctrl = "https://erp-varoch.com/DEV/calendarizacion/ctrl/app.php";
// const link = "ctrl/ctrl-eventos.php";

$(function () {

});

class Calendar extends Eventos {
    constructor(link, div_modulo) {
        super(link, div_modulo);
    }
    init() {
        this.layout();
        this.createCalendar();
    }

    layout() {
        const name = "Calendario";

        this.primaryLayout({
            parent: "root2",
            id: name,
            class: 'd-flex mx-2 my-2 h-100 mt-5 p-2 ',
            card: {
                // filterBar: { class: 'w-full my-3 ', id: 'filterBar' + name },
                container: { class: 'w-full h-auto my-3 rounded-lg p-3 bg-[#1F2A37]', id: 'container' + name }
            }
        });
    }

    async createCalendar() {
        $('#containerCalendario').append(`
            <div class="p-2 flex flex-wrap items-center justify-between gap-3">
                <button title="Regresar" type="button"
                    class="btn bg-gray-700 hover:bg-purple-950 text-white px-4 py-2 rounded w-full sm:w-auto"
                    onclick="window.location.href = '/alpha/eventos/'">
                    <small><i class="icon-reply"></i> Volver</small>
                </button>

                <button title="Agregar evento" type="button"
                    class="btn btn-primary px-4 py-2 rounded w-full sm:w-auto"
                    onclick="calendario.redirectToEventos()">
                    <small><i class="icon-plus"></i> Añadir evento</small>
                </button>

                <select class="form-select px-5 py-2 rounded w-full sm:w-auto" id="selectStatus">
                    <option value="pagado">📆 Evento</option>
                </select>

                <div class="flex flex-wrap items-center gap-2 ml-auto text-xs sm:text-sm">
                    <p class="flex items-center"><i class="icon-blank text-lg" style="color: #6E95C0"></i> Cotización</p>
                    <p class="flex items-center"><i class="icon-blank text-lg" style="color: #0E9E6E"></i> Pagado</p>
                    <p class="flex items-center"><i class="icon-blank text-lg" style="color: #FE6F00"></i> Pendiente de pago</p>
                    <p class="flex items-center"><i class="icon-blank text-lg" style="color: #E60001"></i> Cancelado</p>
                </div>
            </div>

            <div class="row h-full">
                <div class="bg-[#111928] rounded-lg p-4 h-100" id="calendarFull">
                </div>
            </div>
        `);
        let data = await useFetch({ url: link, data: { opc: 'getCalendario' } });
        var calendarEl = document.getElementById('calendarFull');

        var calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth', // Vista por defecto (mes)
            locale: 'es', // Idioma españolcustomButtons: {
            //  customButtons: {
            //   addEventButton: {
            //     text: '➕ Evento',
            //     click: function () {
            //       eventos.showModal(); // método tuyo
            //     }
            //   }
            // },
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: ''
            },
            // slotLabelFormat: {
            //     hour: '2-digit',
            //     minute: '2-digit',
            //     hour12: true // cambia a false para formato 24h
            // },
            // eventDidMount: function (info) {
            //     info.el.setAttribute("title", `${info.event.title} - ${info.event.extendedProps.client || ""}`);
            //     info.el.classList.add('cursor-pointer');
            // },
            // select: function (info) {
            //     app.redirectToEventos();
            //     // eventos.newEventTabs();
            // },
            // eventDidMount: function (info) {
            //     const now = new Date();
            //     const isPast = new Date(info.event.end || info.event.start) < now;
            //     if (isPast) info.el.style.opacity = '0.4';
            // },
            // scrollTime: '08:00:00',



            // selectable: true,
            // selectMirror: true,
            // dayMaxEvents: true, // Activa "+X más"

            events: data,
            eventDidMount: function (info) {
                info.el.classList.add('cursor-pointer');
            },
            datesSet: function () {
                document.querySelectorAll('.fc-day-today').forEach(el => {
                    el.style.backgroundColor = '#2C3E50';
                });

                document.querySelectorAll('.fc-daygrid-day').forEach(el => {
                    el.style.border = '1px solid #1F2A37'; // Cambia el color del borde
                });

                document.querySelectorAll('.fc-scrollgrid').forEach(el => {
                    el.style.border = '1px solid #1F2A37'; // Cambia el color del borde
                });

                document.querySelectorAll('.fc-theme-standard td, .fc-theme-standard th').forEach(el => {
                    el.style.border = '1px solid #1F2A37'; // Cambia el color del borde
                });
            },

            // Cómo se mostrará el evento en el calendario
            eventContent: function (arg) {
                let titleEl = document.createElement("div");
                let client = document.createElement("div");
                let location = document.createElement("div");

                titleEl.classList.add("font-12", "font-bold");
                location.classList.add("font-10", "text-gray-200");
                client.classList.add("font-10", "text-gray-200");

                titleEl.innerHTML = "📅" + arg.event.title;
                // client.innerHTML = "<span class='font-semibold'>" + arg.event.extendedProps.category + "</span> " + arg.event.extendedProps.client;
                client.innerHTML = "<i class='icon-user-5'></i>" + arg.event.extendedProps.client;
                location.innerHTML = "<i class='icon-location'></i>" + arg.event.extendedProps.location;

                let arrayOfDomNodes = [titleEl, location, client,];

                return { domNodes: arrayOfDomNodes };
            },

            // Click en el evento
            eventClick: function (info) {
                // let fecha = new Date(info.event.start).toISOString().split("T")[0];
                eventos.showEvent(info.event.id, info.event.extendedProps.category);
            },
        });

        calendar.render();
    }


    redirectToEventos() {
        window.location.href = '/alpha/eventos/?newEvent=true';
    }
}