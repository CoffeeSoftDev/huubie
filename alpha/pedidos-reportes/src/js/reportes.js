let api = 'ctrl/ctrl-reportes.php';
let appReportes;
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

    appReportes = new AppReportes(api, 'root');
    appReportes.render();
});

class AppReportes extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "Reportes";
        this.currentTab = 'tickets';
    }

    render() {
        this.layout();
        this.createFilterBar();
        // this.lsTickets();
        this.lsDailyTickets();
    }

    layout() {
        this.primaryLayout({
            parent: "root",
            id: this.PROJECT_NAME,
            class: 'flex mx-2 p-2',
            heightPreset: 'viewport',
            card: {
                filterBar: { class: 'w-full', id: 'filterBar' + this.PROJECT_NAME },
                container: { class: 'w-full my-2 bg-[#1F2A37] rounded p-3', id: 'container' + this.PROJECT_NAME }
            }
        });

        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: "dark",
            type: "short",
            json: [
                {
                    id: "daily",
                    tab: "Ticket Diario",
                    active:true,
                    onClick: () => {
                        this.currentTab = 'daily';
                        this.lsDailyTickets();
                    }
                },
                // {
                //     id: "tickets",
                //     tab: "Detalle de Tickets",
                //     active: true,
                //     onClick: () => {
                //         this.currentTab = 'tickets';
                //         this.lsTickets();
                //     }
                // },
                // {
                //     id: "turnos",
                //     tab: "Turnos",
                //     onClick: () => {
                //         this.currentTab = 'turnos';
                //         this.lsShifts();
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
                class: "col-12 col-md-2 col-lg-1",
                color_btn: "secondary",
                id: "btnImprimir",
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

        dataPicker({
            parent: "calendar" + this.PROJECT_NAME,
            rangepicker: {
                startDate: moment().startOf("week"),
                endDate: moment(),
                showDropdowns: true,
                autoApply: true,
                locale: { format: "DD-MM-YYYY" },
                ranges: {
                    'Semana actual': [moment().startOf("week"), moment()],
                    'Semana anterior': [moment().subtract(1, "week").startOf("week"), moment().subtract(1, "week").endOf("week")],
                    'Mes actual': [moment().startOf("month"), moment()],
                    'Mes anterior': [moment().subtract(1, "month").startOf("month"), moment().subtract(1, "month").endOf("month")],
                },
            },
            onSelect: () => this.refreshCurrentTab(),
        });
    }

    refreshCurrentTab() {
        if (this.currentTab === 'tickets') {
            this.lsTickets();
        } else if (this.currentTab === 'turnos') {
            this.lsShifts();
        } else {
            this.lsDailyTickets();
        }
    }

    getFilterParams() {
        let rangePicker = getDataRangePicker("calendar" + this.PROJECT_NAME);
        let sub_id = $(`#filterBar${this.PROJECT_NAME} #subsidiaries_id`).val() || '0';

        return {
            fi: rangePicker.fi,
            ff: rangePicker.ff,
            sub_id: sub_id
        };
    }

    async lsTickets() {
        let params = this.getFilterParams();
        const data = await useFetch({ url: this._link, data: { opc: "lsTickets", ...params } });

        this.createCoffeeTable3({
            parent: 'container-tickets',
            id: `tb${this.PROJECT_NAME}Tickets`,
            theme: 'dark',
            title: 'Detalle de Tickets',
            subtitle: '',
            center: [3, 4],
            right: [5, 6, 7, 8, 9, 10],
            extends: true,
            scrollable: false,
            data: data,
        });

        if (data.totals) {
            this.renderTotalsBar(data.totals, 'container-tickets');
        }

        simple_data_table(`#tb${this.PROJECT_NAME}Tickets`, 25);
    }

    renderTotalsBar(totals, parent) {
        let existingBar = $(`#totalsBar${this.PROJECT_NAME}`);
        if (existingBar.length) existingBar.remove();

        let html = `
            <div id="totalsBar${this.PROJECT_NAME}" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4 mt-3">
                <div class="bg-[#283341] p-3 rounded-lg border border-gray-700">
                    <p class="text-xs text-gray-400">Total Tickets</p>
                    <p class="text-lg font-bold text-white">${totals.total_tickets}</p>
                </div>
                <div class="bg-[#283341] p-3 rounded-lg border border-gray-700">
                    <p class="text-xs text-gray-400">Importe Total</p>
                    <p class="text-lg font-bold text-green-400">${totals.importe}</p>
                </div>
                <div class="bg-[#283341] p-3 rounded-lg border border-gray-700">
                    <p class="text-xs text-gray-400">Efectivo</p>
                    <p class="text-lg font-bold text-blue-400">${totals.efectivo}</p>
                </div>
                <div class="bg-[#283341] p-3 rounded-lg border border-gray-700">
                    <p class="text-xs text-gray-400">Tarjeta</p>
                    <p class="text-lg font-bold text-purple-400">${totals.tarjeta}</p>
                </div>
                <div class="bg-[#283341] p-3 rounded-lg border border-gray-700">
                    <p class="text-xs text-gray-400">Transferencia</p>
                    <p class="text-lg font-bold text-yellow-400">${totals.transferencia}</p>
                </div>
                <div class="bg-[#283341] p-3 rounded-lg border border-gray-700">
                    <p class="text-xs text-gray-400">Propinas</p>
                    <p class="text-lg font-bold text-teal-400">${totals.propina}</p>
                </div>
                <div class="bg-[#283341] p-3 rounded-lg border border-gray-700">
                    <p class="text-xs text-gray-400">Descuentos</p>
                    <p class="text-lg font-bold text-red-400">${totals.descuento}</p>
                </div>
            </div>
        `;

        $(`#${parent}`).prepend(html);
    }

    async lsShifts() {
        let params = this.getFilterParams();
        const data = await useFetch({ url: this._link, data: { opc: "lsShifts", ...params } });

        this.createCoffeeTable3({
            parent: 'container-turnos',
            id: `tb${this.PROJECT_NAME}Shifts`,
            theme: 'dark',
            title: 'Historial de Turnos',
            subtitle: '',
            center: [10, 12],
            right: [4, 5, 6, 7, 8, 9, 11],
            extends: true,
            scrollable: false,
            data: data,
        });

        simple_data_table(`#tb${this.PROJECT_NAME}Shifts`, 15);
    }

    async lsDailyTickets() {
        let params = this.getFilterParams();
        const data = await useFetch({ url: this._link, data: { opc: "lsDailyTickets", ...params } });

        this.createCoffeeTable3({
            parent: 'container-daily',
            id: `tb${this.PROJECT_NAME}Daily`,
            theme: 'dark',
            title: 'Ticket Diario',
            subtitle: '',
            center: [2],
            right: [3, 4, 5, 6, 7],
            extends: true,
            scrollable: false,
            data: data,
        });

        if (data.totals) {
            this.renderTotalsBar(data.totals, 'container-daily');
        }

        simple_data_table(`#tb${this.PROJECT_NAME}Daily`, 25);
    }

    printReport() {
        let params = this.getFilterParams();
        let subName = '';
        if (sucursales.length > 0) {
            let found = sucursales.find(s => s.id == params.sub_id);
            subName = found ? found.valor : 'Todas';
        }

        if (this.currentTab === 'tickets') {
            this.printTicketsReport(params, subName);
        } else {
            this.printShiftsReport(params, subName);
        }
    }

    async printTicketsReport(params, subName) {
        const data = await useFetch({ url: this._link, data: { opc: "lsTickets", ...params } });

        if (!data.row || data.row.length === 0) {
            alert({ icon: "info", text: "No hay datos para imprimir.", btn1: true, btn1Text: "Aceptar" });
            return;
        }

        const t = data.totals;
        let rowsHtml = '';
        data.row.forEach(r => {
            rowsHtml += `
                <tr>
                    <td>${r['Folio']}</td>
                    <td>${r['Fecha']}</td>
                    <td>${r['Cuenta']}</td>
                    <td>${r['Tipo']}</td>
                    <td class="text-right">${r['Descuento'].html}</td>
                    <td class="text-right">${r['Propina'].html}</td>
                    <td class="text-right" style="font-weight:bold;background:#f0f0f0">${r['Importe'].html}</td>
                    <td class="text-right">${r['Efectivo'].html}</td>
                    <td class="text-right">${r['Tarjeta'].html}</td>
                    <td class="text-right">${r['Transferencia'].html}</td>
                </tr>
            `;
        });

        let printContent = `
            <html>
            <head>
                <title>Reporte de Tickets</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; padding: 10px; }
                    h2 { text-align: center; margin-bottom: 5px; font-size: 14px; }
                    .info { text-align: center; margin-bottom: 10px; font-size: 11px; color: #555; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
                    th, td { border: 1px solid #999; padding: 3px 5px; font-size: 10px; }
                    th { background: #ddd; font-weight: bold; text-align: center; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .totals-row { font-weight: bold; background: #eee; }
                    .summary { margin-top: 10px; }
                    .summary table { width: auto; margin: 0 auto; }
                    .summary td { padding: 2px 10px; border: none; }
                    .summary .label { text-align: right; font-weight: bold; }
                    .summary .value { text-align: right; }
                    @media print { body { padding: 5px; } }
                </style>
            </head>
            <body>
                <h2>DETALLE DE TICKETS</h2>
                <p class="info">Sucursal: ${subName} | Periodo: ${params.fi} al ${params.ff}</p>

                <table>
                    <thead>
                        <tr>
                            <th>FOLIO CUENTA</th>
                            <th>FECHA</th>
                            <th>CUENTA</th>
                            <th>TIPO</th>
                            <th>DESCUENTO</th>
                            <th>PROPINA</th>
                            <th>IMPORTE</th>
                            <th>EFECTIVO</th>
                            <th>TARJETA</th>
                            <th>TRANSFERENCIA</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                        <tr class="totals-row">
                            <td colspan="4" class="text-right">TOTALES:</td>
                            <td class="text-right">${t.descuento}</td>
                            <td class="text-right">${t.propina}</td>
                            <td class="text-right">${t.importe}</td>
                            <td class="text-right">${t.efectivo}</td>
                            <td class="text-right">${t.tarjeta}</td>
                            <td class="text-right">${t.transferencia}</td>
                        </tr>
                    </tbody>
                </table>

                <div class="summary">
                    <table>
                        <tr><td class="label">TOTAL TICKETS:</td><td class="value">${t.total_tickets}</td></tr>
                        <tr><td class="label">FORMA DE PAGO VENTAS:</td><td></td></tr>
                        <tr><td class="label">EFECTIVO:</td><td class="value">${t.efectivo}</td></tr>
                        <tr><td class="label">TARJETA:</td><td class="value">${t.tarjeta}</td></tr>
                        <tr><td class="label">TRANSFERENCIA:</td><td class="value">${t.transferencia}</td></tr>
                        <tr><td class="label">PROPINAS:</td><td class="value">${t.propina}</td></tr>
                        <tr><td class="label">DESCUENTOS:</td><td class="value">${t.descuento}</td></tr>
                        <tr><td class="label" style="border-top:2px solid #000;padding-top:5px">VENTA BRUTA:</td><td class="value" style="border-top:2px solid #000;padding-top:5px;font-weight:bold">${t.importe}</td></tr>
                    </table>
                </div>
            </body>
            </html>
        `;

        let printWindow = window.open('', '_blank', 'width=900,height=700');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }

    async printShiftsReport(params, subName) {
        const data = await useFetch({ url: this._link, data: { opc: "lsShifts", ...params } });

        if (!data.row || data.row.length === 0) {
            alert({ icon: "info", text: "No hay turnos para imprimir.", btn1: true, btn1Text: "Aceptar" });
            return;
        }

        let rowsHtml = '';
        data.row.forEach(r => {
            rowsHtml += `
                <tr>
                    <td>${r['Cajero']}</td>
                    <td class="text-center">${r['Apertura']}</td>
                    <td class="text-center">${r['Cierre']}</td>
                    <td class="text-right" style="font-weight:bold;background:#f0f0f0">${r['Total'].html}</td>
                    <td class="text-right">${r['Efectivo'].html}</td>
                    <td class="text-right">${r['Tarjeta'].html}</td>
                    <td class="text-right">${r['Transferencia'].html}</td>
                    <td class="text-right">${r['Propinas'].html}</td>
                    <td class="text-right">${r['Descuentos'].html}</td>
                    <td class="text-center">${r['Pedidos'].html}</td>
                    <td class="text-right">${r['Diferencia'].html}</td>
                    <td class="text-center">${r['Estado']}</td>
                </tr>
            `;
        });

        let printContent = `
            <html>
            <head>
                <title>Reporte de Turnos</title>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; padding: 10px; }
                    h2 { text-align: center; margin-bottom: 5px; font-size: 14px; }
                    .info { text-align: center; margin-bottom: 10px; font-size: 11px; color: #555; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #999; padding: 3px 5px; font-size: 10px; }
                    th { background: #ddd; font-weight: bold; text-align: center; }
                    .text-right { text-align: right; }
                    .text-center { text-align: center; }
                    .badge { padding: 2px 6px; border-radius: 3px; font-size: 9px; }
                    .bg-success { background: #28a745; color: #fff; }
                    .bg-secondary { background: #6c757d; color: #fff; }
                    @media print { body { padding: 5px; } }
                </style>
            </head>
            <body>
                <h2>**** CORTE DE CAJA ****</h2>
                <p class="info">Sucursal: ${subName} | Periodo: ${params.fi} al ${params.ff}</p>

                <table>
                    <thead>
                        <tr>
                            <th>CAJERO</th>
                            <th>APERTURA</th>
                            <th>CIERRE</th>
                            <th>TOTAL</th>
                            <th>EFECTIVO</th>
                            <th>TARJETA</th>
                            <th>TRANSFERENCIA</th>
                            <th>PROPINA</th>
                            <th>DESCUENTOS</th>
                            <th>PEDIDOS</th>
                            <th>DIFERENCIA</th>
                            <th>ESTADO</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        let printWindow = window.open('', '_blank', 'width=1000,height=700');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }
}
