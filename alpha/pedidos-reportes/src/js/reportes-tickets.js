class TicketsReport extends AppReportes {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "ReportesTickets";
    }

    async render() {
        let params = appReportes.getFilterParams();

        const container = $(`#container-tickets`);
        container.empty();
        container.html(`<div id="tickets-table-container"></div>`);

        const data = await useFetch({ url: this._link, data: { opc: "lsShiftsWithTickets", ...params } });
        this._allTicketsData = data;

        this.createCoffeeTable3({
            parent: 'tickets-table-container',
            id: `tbReportesTickets`,
            theme: 'dark',
            title: 'Detalle de Tickets por Turno',
            subtitle: `Sucursal: ${appReportes.getSubName()} · Haz clic en un turno para ver sus tickets`,
            center: [3, 4],
            right: [6, 7, 8, 9, 10],
            extends: true,
            scrollable: false,
            folding: true,
            bordered:true,
            data: data,
        });

        if (data.totals) {
            appReportes.renderTotalsBar(data.totals, 'tickets-table-container');
        }
    }

    async printTickets(params, subName) {
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
                    <td class="text-right">${r['Descuento'].html}</td>
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
                    * { margin:0; padding:0; box-sizing:border-box; }
                    body { font-family:'Courier New',monospace; font-size:11px; color:#000; padding:10px; }
                    h2 { text-align:center; margin-bottom:5px; font-size:14px; }
                    .info { text-align:center; margin-bottom:10px; font-size:11px; color:#555; }
                    table { width:100%; border-collapse:collapse; margin-bottom:10px; }
                    th, td { border:1px solid #999; padding:3px 5px; font-size:10px; }
                    th { background:#ddd; font-weight:bold; text-align:center; }
                    .text-right { text-align:right; }
                    .totals-row { font-weight:bold; background:#eee; }
                    .summary { margin-top:10px; }
                    .summary table { width:auto; margin:0 auto; }
                    .summary td { padding:2px 10px; border:none; }
                    .summary .label { text-align:right; font-weight:bold; }
                    .summary .value { text-align:right; }
                    @media print { body { padding:5px; } }
                </style>
            </head>
            <body>
                <h2>DETALLE DE TICKETS</h2>
                <p class="info">Sucursal: ${subName} | ${params.fi === params.ff ? `Dia: ${params.fi}` : `Periodo: ${params.fi} al ${params.ff}`}</p>
                <table>
                    <thead>
                        <tr>
                            <th>FOLIO</th><th>FECHA</th><th>CUENTA</th>
                            <th>DESCUENTO</th><th>IMPORTE</th>
                            <th>EFECTIVO</th><th>TARJETA</th><th>TRANSFERENCIA</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                        <tr class="totals-row">
                            <td colspan="3" class="text-right">TOTALES:</td>
                            <td class="text-right">${t.descuento}</td>
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
                        <tr><td class="label">EFECTIVO:</td><td class="value">${t.efectivo}</td></tr>
                        <tr><td class="label">TARJETA:</td><td class="value">${t.tarjeta}</td></tr>
                        <tr><td class="label">TRANSFERENCIA:</td><td class="value">${t.transferencia}</td></tr>
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
}
