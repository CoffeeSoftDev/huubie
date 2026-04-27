class ShiftsReport extends AppReportes {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "ReportesTurnos";
    }

    async render() {
        let params = appReportes.getFilterParams();
        const data = await useFetch({ url: this._link, data: { opc: "lsShifts", ...params } });

        this.createCoffeeTable3({
            parent: 'container-turnos',
            id: `tbReportesShifts`,
            theme: 'dark',
            title: 'Corte de Caja X',
            subtitle: `Sucursal: ${appReportes.getSubName()}`,
            center: [8, 9],
            right: [4, 5, 6, 7],
            extends: true,
            scrollable: false,
            data: data,
        });

        simple_data_table(`#tbReportesShifts`, 15);
    }

    async printShifts(params, subName) {
        const data = await useFetch({ url: this._link, data: { opc: "lsShifts", ...params } });

        if (!data.row || data.row.length === 0) {
            alert({ icon: "info", text: "No hay turnos para imprimir.", btn1: true, btn1Text: "Aceptar" });
            return;
        }

        let rowsHtml = '';
        data.row.forEach(r => {
            rowsHtml += `
                <tr>
                    <td>${r['Responsable']}</td>
                    <td class="text-center">${r['Apertura']}</td>
                    <td class="text-center">${r['Cierre']}</td>
                    <td class="text-right" style="font-weight:bold;background:#f0f0f0">${r['Total'].html}</td>
                    <td class="text-right">${r['Efectivo'].html}</td>
                    <td class="text-right">${r['Tarjeta'].html}</td>
                    <td class="text-right">${r['Transferencia'].html}</td>
                    <td class="text-center">${r['Pedidos'].html}</td>
                    <td class="text-center">${r['Estado']}</td>
                </tr>
            `;
        });

        let printContent = `
            <html>
            <head>
                <title>Reporte de Turnos</title>
                <style>
                    * { margin:0; padding:0; box-sizing:border-box; }
                    body { font-family:'Courier New',monospace; font-size:11px; color:#000; padding:10px; }
                    h2 { text-align:center; margin-bottom:5px; font-size:14px; }
                    .info { text-align:center; margin-bottom:10px; font-size:11px; color:#555; }
                    table { width:100%; border-collapse:collapse; }
                    th, td { border:1px solid #999; padding:3px 5px; font-size:10px; }
                    th { background:#ddd; font-weight:bold; text-align:center; }
                    .text-right { text-align:right; }
                    .text-center { text-align:center; }
                    @media print { body { padding:5px; } }
                </style>
            </head>
            <body>
                <h2>**** CORTE DE CAJA ****</h2>
                <p class="info">Sucursal: ${subName} | ${params.fi === params.ff ? `Dia: ${params.fi}` : `Periodo: ${params.fi} al ${params.ff}`}</p>
                <table>
                    <thead>
                        <tr>
                            <th>RESPONSABLE</th><th>APERTURA</th><th>CIERRE</th>
                            <th>TOTAL</th><th>EFECTIVO</th><th>TARJETA</th>
                            <th>TRANSFERENCIA</th><th>PEDIDOS</th><th>ESTADO</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
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
