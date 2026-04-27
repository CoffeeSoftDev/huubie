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
}
