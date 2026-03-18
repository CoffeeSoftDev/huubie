let reports;

$(async () => {
    reports = new OrderReports(api, "root");
});

class OrderReports extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "OrderReports";
    }

    render() {
        this.layout();
        this.filterBar();
    }

    layout() {
        this.primaryLayout({
            parent: "container-reportes",
            id: this.PROJECT_NAME,
            class: "w-full",
            card: {
                filterBar: { class: "w-full border-b pb-3", id: "filterBar" + this.PROJECT_NAME },
                container: { class: "w-full h-full", id: "container" + this.PROJECT_NAME },
            },
        });

        $(`#filterBar${this.PROJECT_NAME}`).prepend(`
            <div class="px-4 pt-3 pb-3">
                <h2 class="text-2xl font-semibold text-white">📊 Reportes de Pedidos</h2>
                <p class="text-gray-400">Genera y consulta reportes detallados de pedidos, ventas y clientes.</p>
            </div>
        `);

        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id: `tabsReports`,
            theme: "dark",
            type: "short",
            json: [
                {
                    id: "ventas",
                    tab: "Reporte de Ventas",
                    active: true,
                    onClick: () => this.renderVentasReport()
                },
                {
                    id: "productos",
                    tab: "Productos",
                    onClick: () => this.renderProductosReport()
                },
                {
                    id: "clientes",
                    tab: "Clientes",
                    onClick: () => this.renderClientesReport()
                },
            ]
        });

        $('#content-tabsReports').removeClass('h-screen');
        
        setTimeout(() => {
            this.renderVentasReport();
        }, 100);
    }

    filterBar() {
        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: [
                {
                    opc: "select",
                    id: "sucursal",
                    lbl: "Sucursal",
                    class: "col-sm-3",
                    data: lsSucursales,
                    onchange: "reports.refreshCurrentReport()",
                },
                {
                    opc: "select",
                    id: "periodo",
                    lbl: "Período",
                    class: "col-sm-3",
                    data: [
                        { id: "month", valor: "Este mes" },
                        { id: "lastMonth", valor: "Mes anterior" },
                        { id: "quarter", valor: "Último trimestre" },
                        { id: "year", valor: "Este año" },
                        { id: "custom", valor: "Personalizado" }
                    ],
                    onchange: "reports.handlePeriodChange()",
                },
                {
                    opc: "div",
                    id: "customDateRange",
                    class: "col-sm-4",
                    html: `
                        <label class="form-label">Rango personalizado</label>
                        <input 
                            type="text" 
                            id="dateRange" 
                            class="form-control"
                            placeholder="Seleccionar rango"
                            style="display: none;"
                        />
                    `
                },
                {
                    opc: "button",
                    id: "btnExport",
                    text: "Exportar",
                    class: "col-sm-2",
                    className: "w-100",
                    color_btn: "success",
                    icono: "icon-download",
                    onClick: () => this.exportReport()
                },
            ],
        });

        this.initDateRangePicker();
    }

    initDateRangePicker() {
        $('#dateRange').daterangepicker({
            locale: {
                format: 'DD/MM/YYYY',
                separator: ' - ',
                applyLabel: 'Aplicar',
                cancelLabel: 'Cancelar',
                fromLabel: 'Desde',
                toLabel: 'Hasta',
                customRangeLabel: 'Personalizado',
                weekLabel: 'S',
                daysOfWeek: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'],
                monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
            }
        }, (start, end) => {
            this.refreshCurrentReport();
        });
    }

    handlePeriodChange() {
        const periodo = $('#filterBarOrderReports #periodo').val();
        if (periodo === 'custom') {
            $('#dateRange').show();
        } else {
            $('#dateRange').hide();
            this.refreshCurrentReport();
        }
    }

    refreshCurrentReport() {
        const activeTab = $('#tabsReports .tab-item[data-state="active"]').attr('id');
        
        if (activeTab === 'tab-ventas') {
            this.renderVentasReport();
        } else if (activeTab === 'tab-productos') {
            this.renderProductosReport();
        } else if (activeTab === 'tab-clientes') {
            this.renderClientesReport();
        }
    }

    async renderVentasReport() {
        const params = this.getReportParams();
        
        const data = await useFetch({
            url: api,
            data: {
                opc: "reportVentas",
                ...params
            }
        });

        $('#container-ventas').html(`
            <div class="p-4">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div class="bg-[#1F2A37] p-4 rounded-xl border border-gray-700">
                        <p class="text-sm text-gray-400">Total Pedidos</p>
                        <p class="text-2xl font-bold text-white">${data.summary?.totalPedidos || 0}</p>
                    </div>
                    <div class="bg-[#1F2A37] p-4 rounded-xl border border-gray-700">
                        <p class="text-sm text-gray-400">Ventas Totales</p>
                        <p class="text-2xl font-bold text-green-400">${data.summary?.ventasTotales || '$0'}</p>
                    </div>
                    <div class="bg-[#1F2A37] p-4 rounded-xl border border-gray-700">
                        <p class="text-sm text-gray-400">Ticket Promedio</p>
                        <p class="text-2xl font-bold text-blue-400">${data.summary?.ticketPromedio || '$0'}</p>
                    </div>
                    <div class="bg-[#1F2A37] p-4 rounded-xl border border-gray-700">
                        <p class="text-sm text-gray-400">Pendiente Cobrar</p>
                        <p class="text-2xl font-bold text-red-400">${data.summary?.pendienteCobrar || '$0'}</p>
                    </div>
                </div>

                <div class="bg-[#1F2A37] p-4 rounded-xl border border-gray-700 mb-4">
                    <h3 class="text-lg font-semibold text-white mb-4">📈 Ventas por Estado</h3>
                    <div class="w-full" style="height: 300px; max-height: 300px;">
                        <canvas id="chartVentasEstado"></canvas>
                    </div>
                </div>

                <div class="bg-[#1F2A37] p-4 rounded-xl border border-gray-700">
                    <h3 class="text-lg font-semibold text-white mb-4">📋 Detalle de Ventas</h3>
                    <div id="tableVentas"></div>
                </div>
            </div>
        `);

        this.renderChartVentasEstado(data.chartData);
        this.renderTableVentas(data.details);
    }

    renderChartVentasEstado(chartData) {
        const canvas = document.getElementById('chartVentasEstado');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (window.chartVentasEstado && typeof window.chartVentasEstado.destroy === 'function') {
            window.chartVentasEstado.destroy();
        }

        window.chartVentasEstado = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Cotizaciones', 'Abonados', 'Pagados', 'Cancelados'],
                datasets: [{
                    label: 'Número de Pedidos',
                    data: chartData || [0, 0, 0, 0],
                    backgroundColor: ['#2A55A3', '#F2C215', '#3FC189', '#E05562']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        display: false 
                    }
                },
                scales: {
                    y: { 
                        beginAtZero: true,
                        ticks: {
                            color: '#9CA3AF'
                        },
                        grid: {
                            color: 'rgba(156, 163, 175, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#9CA3AF'
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    renderTableVentas(details) {
        if (!details || details.length === 0) {
            $('#tableVentas').html(`
                <div class="text-center py-8 text-gray-400">
                    <i class="icon-doc-text text-4xl mb-2"></i>
                    <p>No hay datos para mostrar en este período</p>
                </div>
            `);
            return;
        }

        this.createCoffeTable({
            parent: "tableVentas",
            id: "tbVentas",
            theme: "dark",
            data: {
                thead: ["Folio", "Cliente", "Fecha", "Total", "Estado"],
                row: details
            }
        });
    }

    async renderProductosReport() {
        const params = this.getReportParams();
        
        const data = await useFetch({
            url: api,
            data: {
                opc: "reportProductos",
                ...params
            }
        });

        const topProductos = data?.topProductos || [];
        const allProductos = data?.allProductos || [];

        $('#container-productos').html(`
            <div class="p-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div class="bg-[#1F2A37] p-4 rounded-xl border border-gray-700">
                        <h3 class="text-lg font-semibold text-white mb-4">🏆 Top 10 Productos Más Vendidos</h3>
                        <div id="topProductos"></div>
                    </div>
                    <div class="bg-[#1F2A37] p-4 rounded-xl border border-gray-700">
                        <h3 class="text-lg font-semibold text-white mb-4">📊 Ventas por Producto</h3>
                        <div class="w-full" style="height: 300px; max-height: 300px;">
                            <canvas id="chartProductos"></canvas>
                        </div>
                    </div>
                </div>

                <div class="bg-[#1F2A37] p-4 rounded-xl border border-gray-700">
                    <h3 class="text-lg font-semibold text-white mb-4">📋 Detalle de Productos</h3>
                    <div id="tableProductos"></div>
                </div>
            </div>
        `);

        this.renderTopProductos(topProductos);
        this.renderChartProductos(topProductos);
        this.renderTableProductos(allProductos);
    }

    renderTopProductos(topProductos) {
        if (!topProductos || topProductos.length === 0) {
            $('#topProductos').html('<p class="text-gray-400 text-center py-4">No hay datos</p>');
            return;
        }

        const colores = [
            'bg-yellow-500', 'bg-gray-400', 'bg-orange-600',
            'bg-blue-500', 'bg-purple-500', 'bg-green-500',
            'bg-pink-500', 'bg-indigo-500', 'bg-red-500', 'bg-teal-500'
        ];

        let html = '<div class="space-y-2">';
        topProductos.slice(0, 10).forEach((producto, index) => {
            html += `
                <div class="flex items-center gap-3 p-2 rounded-lg bg-gray-800">
                    <span class="flex items-center justify-center w-8 h-8 rounded-full ${colores[index]} text-white font-bold text-sm">
                        ${index + 1}
                    </span>
                    <div class="flex-1">
                        <p class="text-white font-semibold">${producto.name}</p>
                        <p class="text-sm text-gray-400">${producto.quantity} unidades</p>
                    </div>
                    <span class="text-white font-bold">${producto.total || '$0'}</span>
                </div>
            `;
        });
        html += '</div>';

        $('#topProductos').html(html);
    }

    renderChartProductos(topProductos) {
        if (!topProductos || topProductos.length === 0) return;

        const canvas = document.getElementById('chartProductos');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (window.chartProductos && typeof window.chartProductos.destroy === 'function') {
            window.chartProductos.destroy();
        }

        const top5 = topProductos.slice(0, 5);

        window.chartProductos = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: top5.map(p => p.name),
                datasets: [{
                    data: top5.map(p => p.quantity),
                    backgroundColor: ['#3FC189', '#2A55A3', '#F2C215', '#E05562', '#8CC63F']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    renderTableProductos(allProductos) {
        if (!allProductos || allProductos.length === 0) {
            $('#tableProductos').html(`
                <div class="text-center py-8 text-gray-400">
                    <i class="icon-basket text-4xl mb-2"></i>
                    <p>No hay productos vendidos en este período</p>
                </div>
            `);
            return;
        }

        this.createCoffeTable({
            parent: "tableProductos",
            id: "tbProductos",
            theme: "dark",
            data: {
                thead: ["#", "Producto", "Cantidad", "Total Ventas"],
                row: allProductos
            }
        });
    }

    async renderClientesReport() {
        const params = this.getReportParams();
        
        const data = await useFetch({
            url: api,
            data: {
                opc: "reportClientes",
                ...params
            }
        });

        const summary = data?.summary || { totalClientes: 0, clientesNuevos: 0, clientesFrecuentes: 0 };
        const topClientes = data?.topClientes || [];
        const allClientes = data?.allClientes || [];

        $('#container-clientes').html(`
            <div class="p-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div class="bg-[#1F2A37] p-4 rounded-xl border border-gray-700">
                        <p class="text-sm text-gray-400">Total Clientes</p>
                        <p class="text-2xl font-bold text-white">${summary.totalClientes}</p>
                    </div>
                    <div class="bg-[#1F2A37] p-4 rounded-xl border border-gray-700">
                        <p class="text-sm text-gray-400">Clientes Nuevos</p>
                        <p class="text-2xl font-bold text-green-400">${summary.clientesNuevos}</p>
                    </div>
                    <div class="bg-[#1F2A37] p-4 rounded-xl border border-gray-700">
                        <p class="text-sm text-gray-400">Clientes Frecuentes</p>
                        <p class="text-2xl font-bold text-blue-400">${summary.clientesFrecuentes}</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div class="bg-[#1F2A37] p-4 rounded-xl border border-gray-700">
                        <h3 class="text-lg font-semibold text-white mb-4">👥 Top 10 Clientes</h3>
                        <div id="topClientes"></div>
                    </div>
                    <div class="bg-[#1F2A37] p-4 rounded-xl border border-gray-700">
                        <h3 class="text-lg font-semibold text-white mb-4">📊 Distribución de Compras</h3>
                        <div class="w-full" style="height: 300px; max-height: 300px;">
                            <canvas id="chartClientes"></canvas>
                        </div>
                    </div>
                </div>

                <div class="bg-[#1F2A37] p-4 rounded-xl border border-gray-700">
                    <h3 class="text-lg font-semibold text-white mb-4">📋 Detalle de Clientes</h3>
                    <div id="tableClientes"></div>
                </div>
            </div>
        `);

        this.renderTopClientes(topClientes);
        this.renderChartClientes(topClientes);
        this.renderTableClientes(allClientes);
    }

    renderTopClientes(topClientes) {
        if (!topClientes || topClientes.length === 0) {
            $('#topClientes').html('<p class="text-gray-400 text-center py-4">No hay datos</p>');
            return;
        }

        const colores = [
            'bg-green-500', 'bg-blue-500', 'bg-purple-500',
            'bg-orange-500', 'bg-pink-500', 'bg-indigo-500',
            'bg-red-500', 'bg-teal-500', 'bg-yellow-500', 'bg-gray-500'
        ];

        let html = '<div class="space-y-2">';
        topClientes.slice(0, 10).forEach((cliente, index) => {
            html += `
                <div class="flex items-center gap-3 p-2 rounded-lg bg-gray-800">
                    <span class="flex items-center justify-center w-8 h-8 rounded-full ${colores[index]} text-white font-bold text-sm">
                        ${index + 1}
                    </span>
                    <div class="flex-1">
                        <p class="text-white font-semibold">${cliente.name}</p>
                        <p class="text-sm text-gray-400">${cliente.purchases} compras</p>
                    </div>
                    <span class="text-white font-bold">${cliente.total || '$0'}</span>
                </div>
            `;
        });
        html += '</div>';

        $('#topClientes').html(html);
    }

    renderChartClientes(topClientes) {
        if (!topClientes || topClientes.length === 0) return;

        const canvas = document.getElementById('chartClientes');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        if (window.chartClientes && typeof window.chartClientes.destroy === 'function') {
            window.chartClientes.destroy();
        }

        const top5 = topClientes.slice(0, 5);

        window.chartClientes = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: top5.map(c => c.name),
                datasets: [{
                    data: top5.map(c => c.purchases),
                    backgroundColor: ['#3FC189', '#2A55A3', '#F2C215', '#E05562', '#8CC63F']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }

    renderTableClientes(allClientes) {
        if (!allClientes || allClientes.length === 0) {
            $('#tableClientes').html(`
                <div class="text-center py-8 text-gray-400">
                    <i class="icon-users text-4xl mb-2"></i>
                    <p>No hay clientes en este período</p>
                </div>
            `);
            return;
        }

        this.createCoffeTable({
            parent: "tableClientes",
            id: "tbClientes",
            theme: "dark",
            data: {
                thead: ["#", "Cliente", "Teléfono", "Compras", "Total Gastado"],
                row: allClientes
            }
        });
    }

    getReportParams() {
        const sucursal = $('#filterBarOrderReports #sucursal').val() || 'all';
        const periodo = $('#filterBarOrderReports #periodo').val() || 'month';
        
        let fechaInicio, fechaFin;
        const now = moment();

        switch (periodo) {
            case 'month':
                fechaInicio = now.startOf('month').format('YYYY-MM-DD');
                fechaFin = now.endOf('month').format('YYYY-MM-DD');
                break;
            case 'lastMonth':
                fechaInicio = now.subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
                fechaFin = now.subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
                break;
            case 'quarter':
                fechaInicio = now.subtract(3, 'months').startOf('month').format('YYYY-MM-DD');
                fechaFin = now.endOf('month').format('YYYY-MM-DD');
                break;
            case 'year':
                fechaInicio = now.startOf('year').format('YYYY-MM-DD');
                fechaFin = now.endOf('year').format('YYYY-MM-DD');
                break;
            case 'custom':
                const dateRange = $('#dateRange').data('daterangepicker');
                if (dateRange) {
                    fechaInicio = dateRange.startDate.format('YYYY-MM-DD');
                    fechaFin = dateRange.endDate.format('YYYY-MM-DD');
                }
                break;
        }

        return {
            sucursal,
            fechaInicio,
            fechaFin
        };
    }

    exportReport() {
        alert({
            icon: "info",
            title: "Exportar Reporte",
            text: "La funcionalidad de exportación estará disponible próximamente",
            btn1: true,
            btn1Text: "Aceptar"
        });
    }
}
