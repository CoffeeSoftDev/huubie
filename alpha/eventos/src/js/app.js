let app, eventos, payment, calendario, sub;
const currentUrl = window.location.pathname;
const ctrl        = "https://erp-varoch.com/DEV/calendarizacion/ctrl/app.php";
const link        = slash() +"eventos/ctrl/ctrl-eventos.php";
const api_payment = slash() + "eventos/ctrl/ctrl-payment.php";
const api_sub     = slash() + "eventos/ctrl/ctrl-sub-eventos.php";

function slash() {

    let slashesCount = (window.location.href.match(/\//g) || []).length - 4;
    let slash = "";
    for (let i = 0; i < slashesCount; i++) slash += "../";
    return slash;

}

$(function () {

    fn_ajax({ opc: "init" }, link).then((data) => {

        estados    = data.estados;

        app        = new App(ctrl, "");
        eventos    = new Eventos(link, "modulos");
        payment    = new Payments(api_payment, "");
        sub        = new SubEvent(api_sub, "");
        calendario = new Calendar(link, "root2");

        calendario.init();
        app.init();
        app.actualizarFechaHora();

        // ⏱️ Actualiza la fecha y hora cada minuto
        setInterval(() => {
            app.actualizarFechaHora();

        }, 60000);

       // ✅ Verificamos si hay un nuevo evento en la URL

       const urlParams = new URLSearchParams(window.location.search);

       if (urlParams.get("newEvent") === "true") {
           eventos.newEventTabs();
       }

    });
});

class App extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
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
        const name = "Eventos";

        this.primaryLayout({
            parent: "root",
            id: name,
            class: 'd-flex mx-2 my-2 h-100 mt-5 p-2',
            card: {
                filterBar: { class: 'w-full my-3 ', id: 'filterBar'  },
                container: { class: 'w-full my-3 bg-[#1F2A37]  h-screen p-3', id: 'container' + name }
            }
        });

        // Filter bar.

        $('#filterBar').html(`
            <div id="filterBar${name}" class="w-full my-3 " ></div>
            <div id="containerHours"></div>
        `);



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
            class: "flex justify-between border-b border-gray-300 mb-3",
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

    filterBar() {
        this.createfilterBar({
            parent: "filterBarEventos",
            data: [
                {
                    opc: "input-calendar",
                    class: "col-sm-2",
                    id: "calendar",
                    lbl: "Consultar fecha: ",
                },
                {
                    opc: "select",
                    class: "col-sm-3",
                    id: "status",
                    lbl: "Seleccionar estados: ",
                    data: estados,
                    onchange: "app.ls()",
                },
                {
                    opc: "button",
                    className: "w-100",
                    class: "col-sm-2",
                    color_btn: "primary",
                    id: "btnNuevoEvento",
                    text: "Nuevo evento",
                    // onClick: () => calendario.redirectToEventos()
                    onClick: () => eventos.showTypeEvent()
                },
                {
                    opc: "button",
                    className: "w-100",
                    class: "col-sm-2",
                    color_btn: "secondary",
                    id: "btnCalendario",
                    text: "Calendario",
                    onClick: () => {
                        window.location.href = '/alpha/calendario/'
                    }
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

    ls(options) {
        let rangePicker = getDataRangePicker("calendar");
        this._link = link;

        this.createTable({
            parent: "containerEventos",
            idFilterBar: "filterBarEventos",
            data: { opc: "lsVentas", fi: rangePicker.fi, ff: rangePicker.ff },
            coffeesoft:true,
            conf: {
                datatable: true,
                pag: 10,
                fn_datatable: 'simple_data_table_filter',

             },
            attr: {
                id: "tbEventos",

                center: [1, 2, 7, 9, 10],
                right: [5],
                extends: true,
                theme: "dark",
            },
        });
    }
    redirectToEventos() {
        window.location.href = '/alpha/eventos/?newEvent=true';
    }
}


