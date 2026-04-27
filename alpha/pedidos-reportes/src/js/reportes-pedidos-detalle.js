class OrderDetailsReport extends AppReportes {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "ReportesPedidosDetalle";
    }

    async render() {
        let params = appReportes.getFilterParams();

        const container = $(`#container-pedidos-detalle`);
        container.empty();
        container.html(`<div id="pedidos-detalle-table-container"></div>`);

        const data = await useFetch({ url: this._link, data: { opc: "lsPedidosDetalle", ...params } });

        this.createCoffeeTable3({
            parent: 'pedidos-detalle-table-container',
            id: `tbReportesPedidosDetalle`,
            theme: 'dark',
            title: 'Detalles de Pedidos',
            subtitle: `Sucursal: ${appReportes.getSubName()} · Haz clic en un pedido para ver sus items`,
            center: [8, 9, 10],
            right: [4, 5, 6],
            extends: true,
            scrollable: false,
            folding: true,
            bordered: true,
            data: data,
        });

        if (data.totals) {
            this.renderPedidosTotalsBar(data.totals, 'pedidos-detalle-table-container');
        }
    }

    renderPedidosTotalsBar(totals, parent) {
        let existingBar = $(`#totalsBarReportesPedidosDetalle`);
        if (existingBar.length) existingBar.remove();

        let html = `
            <div id="totalsBarReportesPedidosDetalle" class="row g-2 mb-3 mt-2">
                <div class="col">
                    <div class="p-2 rounded text-center" style="background:#283341;border:1px solid #374151">
                        <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase">Pedidos</div>
                        <div class="fw-bold text-white" style="font-size:15px">${totals.total_pedidos}</div>
                    </div>
                </div>
                <div class="col">
                    <div class="p-2 rounded text-center" style="background:#283341;border:1px solid #10B981">
                        <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase">Importe Total</div>
                        <div class="fw-bold" style="font-size:15px;color:#34D399">${totals.importe}</div>
                    </div>
                </div>
                <div class="col">
                    <div class="p-2 rounded text-center" style="background:#283341;border:1px solid #34D399">
                        <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase">Abonado</div>
                        <div class="fw-bold" style="font-size:15px;color:#34D399">${totals.abono}</div>
                    </div>
                </div>
                <div class="col">
                    <div class="p-2 rounded text-center" style="background:#283341;border:1px solid #F87171">
                        <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase">Saldo</div>
                        <div class="fw-bold" style="font-size:15px;color:#F87171">${totals.saldo}</div>
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

    _stripHtml(html) {
        let tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    _renderPdfTotalsBar(totals) {
        const items = [
            { label: 'Pedidos',        value: totals.total_pedidos },
            { label: 'Importe Total',  value: totals.importe, highlight: true },
            { label: 'Abonado',        value: totals.abono },
            { label: 'Saldo',          value: totals.saldo },
            { label: 'Efectivo',       value: totals.efectivo },
            { label: 'Tarjeta',        value: totals.tarjeta },
            { label: 'Transferencia',  value: totals.transferencia },
            { label: 'Descuentos',     value: totals.descuento },
        ];

        let html = items.map(i => `
            <div class="total-item ${i.highlight ? 'highlight' : ''}">
                <div class="label">${i.label}</div>
                <div class="value">${i.value}</div>
            </div>
        `).join('');

        $(`#pedidos-pdf-totals-bar`).html(html);
    }

    _renderPdfTable(rows) {
        let bodyHtml = '';

        rows.forEach(row => {
            if (row.opc === 1) {
                let cliente  = row.Cliente && row.Cliente.html ? this._stripHtml(row.Cliente.html) : '';
                let abono    = row.Abono && row.Abono.html ? this._stripHtml(row.Abono.html) : '';
                let total    = row.Total && row.Total.html ? this._stripHtml(row.Total.html) : '';
                let saldo    = row.Saldo && row.Saldo.html ? this._stripHtml(row.Saldo.html) : '';
                let estado   = row.Estado && row.Estado.html ? this._stripHtml(row.Estado.html) : '';

                bodyHtml += `
                    <tr>
                        <td>${row.Folio}</td>
                        <td>${cliente}</td>
                        <td>${row.Fecha}</td>
                        <td class="text-right">${abono}</td>
                        <td class="text-right">${total}</td>
                        <td class="text-right">${saldo}</td>
                        <td>${row.Entrega}</td>
                        <td class="text-center">${estado}</td>
                    </tr>
                `;
            } else if (row.opc === 0) {
                let itemName = row.Cliente && row.Cliente.html ? this._stripHtml(row.Cliente.html) : '';
                let itemTotal = row.Total && row.Total.html ? this._stripHtml(row.Total.html) : '';

                bodyHtml += `
                    <tr class="pdf-item-row">
                        <td></td>
                        <td>${itemName}</td>
                        <td></td>
                        <td></td>
                        <td class="text-right">${itemTotal}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                `;
            }
        });

        let tableHtml = `
            <table class="pdf-table">
                <thead>
                    <tr>
                        <th>Folio</th>
                        <th>Cliente</th>
                        <th>Fecha</th>
                        <th class="text-right">Abono</th>
                        <th class="text-right">Total</th>
                        <th class="text-right">Saldo</th>
                        <th>Entrega</th>
                        <th class="text-center">Estado</th>
                    </tr>
                </thead>
                <tbody>${bodyHtml}</tbody>
            </table>
        `;

        $(`#pedidos-pdf-table-section`).html(tableHtml);
    }

    async printPedidosDetalle() {
        let params  = appReportes.getFilterParams();
        let subName = appReportes.getSubName();

        const data = await useFetch({ url: this._link, data: { opc: "lsPedidosDetalle", ...params } });

        const container = $(`#container-pedidos-detalle`);
        container.empty();

        if (!data.row || data.row.length === 0) {
            container.html(`
                <div class="pdf-document">
                    <div style="text-align:center;padding:40px;color:#9ca3af">
                        No hay datos disponibles para el periodo consultado
                    </div>
                </div>
            `);
            PdfStyles.inject();
            return;
        }

        let now = moment().format('DD/MM/YYYY hh:mm A');

        container.html(`
            <div class="pdf-document">
                <div class="pdf-header">
                    <div>
                        <h2>DETALLES DE PEDIDOS</h2>
                        <div class="meta">Sucursal: <span>${subName}</span></div>
                    </div>
                    <div style="text-align:right;display:flex;align-items:flex-start;gap:12px">
                        <div>
                            <div class="meta">${appReportes.dateMode === 'single' ? 'Dia' : 'Periodo'}: <span>${appReportes.dateMode === 'single' ? params.fi : `${params.fi} al ${params.ff}`}</span></div>
                            <div class="meta">Generado: <span>${now}</span></div>
                        </div>
                        <button onclick="window.print()" class="btn-print">Imprimir</button>
                    </div>
                </div>

                <div class="pdf-totals-bar cols-8" id="pedidos-pdf-totals-bar"></div>

                <div class="pdf-section" id="pedidos-pdf-table-section"></div>

                <div class="pdf-footer">
                    <span>Documento generado automaticamente</span>
                    <span>Pagina 1 de 1</span>
                </div>
            </div>
        `);

        PdfStyles.inject();
        this._renderPdfTotalsBar(data.totals);
        this._renderPdfTable(data.row);
    }
}
