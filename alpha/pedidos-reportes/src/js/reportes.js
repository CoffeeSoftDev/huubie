let api = 'ctrl/ctrl-reportes.php';
let appReportes;
let summaryReport;
let ticketsReport;
let shiftsReport;
let dailyReport;
let orderDetailsReport;
let sucursales = [];
let rol, subId;

$(async () => {
    const data = await useFetch({ url: api, data: { opc: "init" } });

    if (data.status === 403) {
        alert({ icon: "error", title: "Sin permisos", text: "No tienes permisos para acceder a esta sección.", btn1: true, btn1Text: "Aceptar" });
        return;
    }

    sucursales = data.sucursales || [];
    rol        = data.access;
    subId      = data.sub_id;

    appReportes        = new AppReportes(api, 'root');
    summaryReport      = new SummaryReport(api, 'root');
    ticketsReport      = new TicketsReport(api, 'root');
    shiftsReport       = new ShiftsReport(api, 'root');
    dailyReport        = new DailyReport(api, 'root');
    orderDetailsReport = new OrderDetailsReport(api, 'root');

    appReportes.render();
    orderDetailsReport.render();
});

class AppReportes extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "Reportes";
        this.currentTab   = 'corte';
        this.dateMode     = 'single';
    }

    render() {
        this.layout();
        this.createFilterBar();
        this._toggleAdvancedFilters(true);
        this._toggleGlobalDateFilters(false);
        this.currentTab = 'pedidos-detalle';
    }

    layout() {
        this.primaryLayout({
            parent: "root",
            id: this.PROJECT_NAME,
            class: 'flex mx-2 ',
            heightPreset: 'full',
            card: {
                filterBar: { class: 'w-full ', id: 'filterBar' },
                container: { class: 'w-full my-2 bg-[#1F2A37] h-screen rounded p-3 overflow-auto', id: 'container' + this.PROJECT_NAME }
            }
        });

        // Filter bar.
        $('#filterBar').html(`
            <div id="filterBar${this.PROJECT_NAME}" class="w-full my-3 " ></div>
            <div id="containerHours"></div>
        `);

        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: "dark",
            type: "short",
            json: [
                {
                    id: "pedidos-detalle",
                    tab: "Detalles de Pedidos",
                    active: true,
                    onClick: () => {
                        this.currentTab = 'pedidos-detalle';
                        this._toggleAdvancedFilters(true);
                        this._toggleGlobalDateFilters(false);
                        orderDetailsReport.render();
                    }
                },
                {
                    id: "corte",
                    tab: "Resumen Corte",

                    onClick: () => {
                        this.currentTab = 'corte';
                        this._toggleAdvancedFilters(false);
                        this._toggleGlobalDateFilters(true);
                        summaryReport.render();
                    }
                },
                {
                    id: "tickets",
                    tab: "Detalle de Tickets",
                    onClick: () => {
                        this.currentTab = 'tickets';
                        this._toggleAdvancedFilters(false);
                        this._toggleGlobalDateFilters(true);
                        ticketsReport.render();
                    }
                },
               
             

                // {
                //     id: "turnos",
                //     tab: "Corte de Caja X",
                //     onClick: () => {
                //         this.currentTab = 'turnos';
                //         this._toggleAdvancedFilters(false);
                //         shiftsReport.render();
                //     }
                // },
                // {
                //     id: "daily",
                //     tab: "Ticket Diario",
                //     onClick: () => {
                //         this.currentTab = 'daily';
                //         this._toggleAdvancedFilters(false);
                //         dailyReport.render();
                //     }
                // },
            ]
        });

        $(`#content-tabs${this.PROJECT_NAME}`).removeClass('h-screen');
    }

    createFilterBar() {
        let filterBar = [];

        if (rol == 1) {
            filterBar.push({
                opc: "select",
                id: "subsidiaries_id",
                lbl: "Filtrar por sucursal:",
                class: "col-12 col-md-3 col-lg-2",
                onchange: "appReportes.refreshCurrentTab()",
                data: [
                    { id: "0", valor: "Todas las sucursales" },
                    ...sucursales
                ]
            });
        }

        filterBar.push(
            {
                opc: "select",
                id: "dateMode" + this.PROJECT_NAME,
                lbl: "Modo de consulta:",
                class: "col-12 col-md-3 col-lg-2",
                onchange: "appReportes.toggleDateMode()",
                data: [
                    { id: "single", valor: "Dia unico" },
                    { id: "range", valor: "Rango de fechas" }
                ]
            },
            {
                opc: "input-calendar",
                class: "col-12 col-md-3 col-lg-2",
                id: "calendar" + this.PROJECT_NAME,
                lbl: "Consultar fecha: ",
            },
            {
                opc: "button",
                class: "col-12 col-md-2 col-lg-1",
                color_btn: "primary",
                id: "btnBuscar",
                text: "Buscar",
                className: 'w-full',
                icono: "icon-search",
                onClick: () => this.refreshCurrentTab()
            },
            {
                opc: "button",
                class: "col-12 col-md-2 col-lg-1 advanced-filter",
                color_btn: "secondary",
                id: "btnPrintPedidos",
                text: "Imprimir",
                className: 'w-full',
                icono: "icon-print",
                onClick: () => this.printReport()
            }
        );

        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: filterBar
        });

        $(`#dateMode${this.PROJECT_NAME}`).val(this.dateMode);
        this._renderDatePicker();
    }

    _toggleAdvancedFilters(visible) {
        const $filters = $(`#filterBar${this.PROJECT_NAME} .advanced-filter`);
        if (visible) {
            $filters.show();
        } else {
            $filters.hide();
        }
    }

    _toggleGlobalDateFilters(visible) {
        const $dateMode = $(`#filterBar${this.PROJECT_NAME} #dateMode${this.PROJECT_NAME}`).closest('[class*="col-"]');
        const $calendar = $(`#filterBar${this.PROJECT_NAME} #calendar${this.PROJECT_NAME}`).closest('[class*="col-"]');
        const $btnBuscar = $(`#filterBar${this.PROJECT_NAME} #btnBuscar`).closest('[class*="col-"]');

        if (visible) {
            $dateMode.show();
            $calendar.show();
            $btnBuscar.show();
        } else {
            $dateMode.hide();
            $calendar.hide();
            $btnBuscar.hide();
        }
    }

    _renderDatePicker() {
        const parentId = "calendar" + this.PROJECT_NAME;

        $(`#${parentId}`).empty();

        if (this.dateMode === 'single') {
            dataPicker({
                parent: parentId,
                type: 'simple',
                rangeDefault: {
                    startDate: moment(),
                    singleDatePicker: true,
                    showDropdowns: true,
                    autoApply: true,
                    maxDate: moment(),
                    locale: { format: "DD-MM-YYYY" }
                },
                onSelect: () => this.refreshCurrentTab()
            });
            return;
        }

        dataPicker({
            parent: parentId,
            type: 'all',
            rangepicker: {
                startDate: moment().startOf("day"),
                endDate: moment().endOf("day"),
                showDropdowns: true,
                autoApply: true,
                locale: { format: "DD-MM-YYYY" },
                ranges: {
                    'Hoy': [moment().startOf("day"), moment().endOf("day")],
                    'Ayer': [moment().subtract(1, "day").startOf("day"), moment().subtract(1, "day").endOf("day")],
                    'Semana actual': [moment().startOf("week"), moment()],
                    'Semana anterior': [moment().subtract(1, "week").startOf("week"), moment().subtract(1, "week").endOf("week")],
                    'Mes actual': [moment().startOf("month"), moment()],
                    'Mes anterior': [moment().subtract(1, "month").startOf("month"), moment().subtract(1, "month").endOf("month")],
                    'Personalizar': [moment().startOf("month"), moment()],
                },
            },
            onSelect: () => this.refreshCurrentTab(),
        });
    }

    toggleDateMode() {
        this.dateMode = $(`#dateMode${this.PROJECT_NAME}`).val();
        this._renderDatePicker();
        this.refreshCurrentTab();
    }

    refreshCurrentTab() {
        switch (this.currentTab) {
            case 'corte':           summaryReport.render(); break;
            case 'tickets':         ticketsReport.render(); break;
            case 'turnos':          shiftsReport.render(); break;
            case 'pedidos-detalle': orderDetailsReport.render(); break;
            default:                dailyReport.render(); break;
        }
    }

    getFilterParams() {
        let rangePicker = getDataRangePicker("calendar" + this.PROJECT_NAME);
        let sub_id    = $(`#filterBar${this.PROJECT_NAME} #subsidiaries_id`).val() || '0';
        let estado    = $(`#filtroEstadoPedidosDetalle`).val() || '0';
        let descuento = $(`#filtroDescuentoPedidosDetalle`).val() || 'todos';

        let fi = rangePicker.fi;
        let ff = this.dateMode === 'single' ? rangePicker.fi : rangePicker.ff;

        return {
            fi: fi,
            ff: ff,
            sub_id: sub_id,
            estado: estado,
            descuento: descuento
        };
    }

    getSubName() {
        let sub_id = $(`#filterBar${this.PROJECT_NAME} #subsidiaries_id`).val() || '0';
        if (sub_id == '0') return 'Todas las sucursales';
        let found = sucursales.find(x => x.id == sub_id);
        return found ? found.valor : 'Todas las sucursales';
    }

    renderTotalsBar(totals, parent) {
        let existingBar = $(`#totalsBar${this.PROJECT_NAME}`);
        if (existingBar.length) existingBar.remove();

        let html = `
            <div id="totalsBar${this.PROJECT_NAME}" class="row g-2 mb-3 mt-2">
                <div class="col">
                    <div class="p-2 rounded text-center" style="background:#283341;border:1px solid #374151">
                        <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase">Total Tickets</div>
                        <div class="fw-bold text-white" style="font-size:15px">${totals.total_tickets}</div>
                    </div>
                </div>
                <div class="col">
                    <div class="p-2 rounded text-center" style="background:#283341;border:1px solid #10B981">
                        <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase">Importe Total</div>
                        <div class="fw-bold" style="font-size:15px;color:#34D399">${totals.importe}</div>
                    </div>
                </div>
                <div class="col">
                    <div class="p-2 rounded text-center" style="background:#283341;border:1px solid #374151">
                        <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase">Efectivo</div>
                        <div class="fw-bold text-info" style="font-size:15px">${totals.efectivo}</div>
                    </div>
                </div>
                <div class="col">
                    <div class="p-2 rounded text-center" style="background:#283341;border:1px solid #374151">
                        <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase">Tarjeta</div>
                        <div class="fw-bold" style="font-size:15px;color:#A78BFA">${totals.tarjeta}</div>
                    </div>
                </div>
                <div class="col">
                    <div class="p-2 rounded text-center" style="background:#283341;border:1px solid #374151">
                        <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase">Transferencia</div>
                        <div class="fw-bold text-warning" style="font-size:15px">${totals.transferencia}</div>
                    </div>
                </div>
                <div class="col">
                    <div class="p-2 rounded text-center" style="background:#283341;border:1px solid #374151">
                        <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase">Descuentos</div>
                        <div class="fw-bold text-danger" style="font-size:15px">${totals.descuento}</div>
                    </div>
                </div>
            </div>
        `;

        $(`#${parent}`).prepend(html);
    }

    printReport() {
        let params  = this.getFilterParams();
        let subName = this.getSubName();

        switch (this.currentTab) {
            case 'corte':           window.print(); break;
            case 'tickets':         ticketsReport.printTickets(params, subName); break;
            case 'pedidos-detalle': orderDetailsReport.printPedidosDetalle(); break;
            default:                shiftsReport.printShifts(params, subName); break;
        }
    }
}
