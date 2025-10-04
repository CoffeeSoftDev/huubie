let api = 'ctrl/ctrl-dashboard.php';
let app;

$(async () => {
    app = new App(api, 'root');
    app.init();
});

class App extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "analiticsOrder";
    }

    init() {
        this.render();
    }

    async render() {
        await this.layoutDashboard();
        this.createFilterBar();
        await this.renderDashboard();
    }

    createFilterBar() {
        // Obtener el mes actual (0-11) y sumar 1 para que sea 1-12
        const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');

        this.createfilterBar({
            parent: `filterBarDashboard`,
            data: [
                {
                    opc: "select",
                    class: "col-sm-3",
                    id: "mes",
                    lbl: "Mes: ",
                    data: Array.from({ length: 12 }, (_, i) => ({
                        id: String(i + 1).padStart(2, '0'),
                        valor: new Date(0, i).toLocaleString('es-MX', { month: 'long' })
                    })),
                },
                {
                    opc: "select",
                    class: "col-sm-3",
                    id: "anio",
                    lbl: "Año: ",
                    data: Array.from({ length: 3 }, (_, i) => {
                        const year = 2025 - i;
                        return { id: String(year), valor: String(year) };
                    })
                },
                {
                    opc: "button",
                    class: "col-sm-2 d-flex align-items-end",
                    className: 'w-100 mt-4',
                    color_btn: "success",
                    id: "btnBuscar",
                    text: "Buscar",
                    fn: "app.renderDashboard()"
                }
            ],
        });

        // seleccionar Mes actual 
        $(`#mes`).val(currentMonth);
    }

    async layoutDashboard() {
        this.dashboardComponent({
            parent: "root",
            title: "📊 Dashboard de Pedidos",
            subtitle: "Resumen mensual · Estadísticas · Gráficos · Reportes",
            json: [
                // { type: "grafico", id: "statusChart", title: "Pedidos por Estado" },
                { type: "card", id: "cardDashboard", title: "Estadísticas de Pedidos" },
                { type: "alerts", id: "alertsContainer", title: "Alertas del Sistema" },
                { type: "tabla", id: "topProducts", title: "Productos Más Vendidos" },
                { type: "tabla", id: "recentOrders", title: "Pedidos Recientes" }
            ]
        });
    }



    async renderDashboard() {
        console.log('renderDashboard called');
        try {
            const mes = $(`#mes`).val() || String(new Date().getMonth() + 1).padStart(2, '0');
            const anio = $(`#anio`).val() || String(new Date().getFullYear());
            console.log('Filters:', { mes, anio });

            const response = await useFetch({
                url: this._link,
                data: {
                    opc: 'getDashboardStats',
                    mes: mes,
                    anio: anio
                }
            });

            if (response.status === 200) {
                const cards = { ...response.data.stats };
                cards.revenue = response.data.revenue;

                // Mostrar tarjetas de estadísticas
                this.showCardsDashboard(cards);

                // Cargar sistema de alertas
                this.loadAlertsSystem();

                // Cargar gráficos interactivos
                this.loadInteractiveCharts(response.data);

                // Cargar tablas con filtros aplicados
                $('#topProducts').html(this.renderTopProducts(response.data.topProducts || []));
                $('#recentOrders').html(this.renderRecentOrders(response.data.recentOrders || []));

            } else {
                this.showError(response.message);
            }
        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showError('Error de conexión al cargar el dashboard');
        }
    }



    showCardsDashboard(stats) {
        console.log('showCardsDashboard called with:', stats);

        let revenue = stats.revenue;

        this.cardsDashboard({
            parent: 'cardDashboard',
            theme: 'dark',
            json: [
                {
                    title: "Total de Pedidos",
                    id: "totalPedidos",
                    data: {
                        value: stats.total_orders || 0,
                        description: "Pedidos registrados en el sistema",
                        color: "text-blue-400"
                    }
                },
                {
                    title: "Pedidos de Hoy",
                    id: "pedidosHoy",
                    data: {
                        value: stats.today_orders || 0,
                        description: "Pedidos creados hoy",
                        color: "text-green-400"
                    }
                },
                {
                    title: "Pedidos Pendientes",
                    id: "pedidosPendientes",
                    data: {
                        value: stats.pending_orders || 0,
                        description: "Pedidos por procesar",
                        color: "text-yellow-400"
                    }
                },
                {
                    title: "Ingresos del Mes",
                    id: "ingresosMes",
                    data: {
                        value: `$${parseFloat(revenue.month || 0).toFixed(2)}`,
                        description: `Total: $${parseFloat(revenue.total || 0).toFixed(2)} • Hoy: $${parseFloat(revenue.today || 0).toFixed(2)}`,
                        color: "text-purple-400"
                    }
                }
            ]
        });
    }




    renderStatsCards(stats, revenue) {
        return `
            <!-- Total de Pedidos -->
            <div class="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-4 text-white">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-blue-100 text-sm">Total de Pedidos</p>
                        <p class="text-2xl font-bold">${stats.total_orders || 0}</p>
                    </div>
                    <div class="bg-blue-500 bg-opacity-30 rounded-full p-3">
                        <i class="icon-doc text-2xl"></i>
                    </div>
                </div>
            </div>
            
            <!-- Pedidos de Hoy -->
            <div class="bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-4 text-white">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-green-100 text-sm">Pedidos de Hoy</p>
                        <p class="text-2xl font-bold">${stats.today_orders || 0}</p>
                    </div>
                    <div class="bg-green-500 bg-opacity-30 rounded-full p-3">
                        <i class="icon-calendar text-2xl"></i>
                    </div>
                </div>
            </div>
            
            <!-- Pedidos Pendientes -->
            <div class="bg-gradient-to-r from-yellow-600 to-yellow-700 rounded-lg p-4 text-white">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-yellow-100 text-sm">Pendientes</p>
                        <p class="text-2xl font-bold">${stats.pending_orders || 0}</p>
                    </div>
                    <div class="bg-yellow-500 bg-opacity-30 rounded-full p-3">
                        <i class="icon-clock text-2xl"></i>
                    </div>
                </div>
            </div>
            
            <!-- Ingresos del Mes -->
            <div class="bg-gradient-to-r from-purple-600 to-purple-700 rounded-lg p-4 text-white">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-purple-100 text-sm">Ingresos del Mes</p>
                        <p class="text-2xl font-bold">$${parseFloat(revenue.month || 0).toFixed(2)}</p>
                    </div>
                    <div class="bg-purple-500 bg-opacity-30 rounded-full p-3">
                        <i class="icon-money text-2xl"></i>
                    </div>
                </div>
            </div>
        `;
    }

    renderStatusChart(ordersByStatus) {
        if (!ordersByStatus || ordersByStatus.length === 0) {
            return '<p class="text-gray-400 text-center py-8">No hay datos disponibles</p>';
        }

        return ordersByStatus.map(status => {
            const percentage = status.total > 0 ? (status.total / ordersByStatus.reduce((sum, s) => sum + parseInt(s.total), 0)) * 100 : 0;
            const colorClass = this.getStatusColor(status.status_id);

            return `
                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-3">
                        <div class="w-4 h-4 rounded ${colorClass}"></div>
                        <span class="text-gray-300">${status.status_name}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-white font-semibold">${status.total}</span>
                        <span class="text-gray-400 text-sm">(${percentage.toFixed(1)}%)</span>
                    </div>
                </div>
                <div class="w-full bg-gray-700 rounded-full h-2 mb-4">
                    <div class="${colorClass} h-2 rounded-full" style="width: ${percentage}%"></div>
                </div>
            `;
        }).join('');
    }

    renderTopProducts(topProducts) {
        if (!topProducts || topProducts.length === 0) {
            return '<p class="text-gray-400 text-center py-8">No hay productos disponibles</p>';
        }

        return topProducts.map((product, index) => `
            <div class="flex items-center justify-between p-3 bg-[#283341] rounded border border-gray-600 mb-2">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        ${index + 1}
                    </div>
                    <div>
                        <p class="text-white font-semibold">${product.product_name}</p>
                        <p class="text-gray-400 text-sm">${product.total_orders} pedidos</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-white font-semibold">${product.total_quantity} unidades</p>
                    <p class="text-green-400 text-sm">$${parseFloat(product.total_revenue).toFixed(2)}</p>
                </div>
            </div>
        `).join('');
    }

    renderRecentOrders(recentOrders) {
        if (!recentOrders || recentOrders.length === 0) {
            return '<p class="text-gray-400 text-center py-8">No hay pedidos recientes</p>';
        }

        const tableHtml = `
            <div class="overflow-x-auto">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="border-b border-gray-600">
                            <th class="text-left text-gray-400 pb-2">Folio</th>
                            <th class="text-left text-gray-400 pb-2">Cliente</th>
                            <th class="text-left text-gray-400 pb-2">Fecha Entrega</th>
                            <th class="text-right text-gray-400 pb-2">Total</th>
                            <th class="text-center text-gray-400 pb-2">Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${recentOrders.map(order => `
                            <tr class="border-b border-gray-700">
                                <td class="py-2 text-white">P-${String(order.id).padStart(4, '0')}</td>
                                <td class="py-2 text-gray-300">${order.client_name}</td>
                                <td class="py-2 text-gray-300">${this.formatDate(order.date_order)} ${order.time_order || ''}</td>
                                <td class="py-2 text-right text-green-400 font-semibold">$${parseFloat(order.total_pay).toFixed(2)}</td>
                                <td class="py-2 text-center">${this.getStatusBadge(order.status_id)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        return tableHtml;
    }

    async loadAlerts() {
        try {
            const response = await useFetch({
                url: this._link,
                data: { opc: 'getDashboardAlerts' }
            });

            if (response.status === 200 && response.data.length > 0) {
                this.renderAlerts(response.data);
            }
        } catch (error) {
            console.error('Error loading alerts:', error);
        }
    }

    renderAlerts(alerts) {
        const alertsHtml = alerts.map(alert => `
            <div class="bg-${alert.type === 'danger' ? 'red' : alert.type === 'warning' ? 'yellow' : 'blue'}-900 border border-${alert.type === 'danger' ? 'red' : alert.type === 'warning' ? 'yellow' : 'blue'}-500 rounded-lg p-4 mb-4">
                <div class="flex items-center gap-3">
                    <i class="${alert.icon} text-${alert.type === 'danger' ? 'red' : alert.type === 'warning' ? 'yellow' : 'blue'}-400 text-xl"></i>
                    <div>
                        <h4 class="text-white font-semibold">${alert.title}</h4>
                        <p class="text-gray-300 text-sm">${alert.message}</p>
                    </div>
                </div>
            </div>
        `).join('');

        $('#alertsContainer').html(alertsHtml);
    }

    async changePeriod() {
        const period = $('#periodSelect').val();

        try {
            const response = await useFetch({
                url: this._link,
                data: { opc: 'getOrdersSummary', period: period }
            });

            if (response.status === 200) {
                // Actualizar las estadísticas con el nuevo período
                this.updateStatsCards(response.data);
            }
        } catch (error) {
            console.error('Error changing period:', error);
        }
    }

    updateStatsCards(data) {
        // Actualizar las tarjetas de estadísticas con los nuevos datos
        // Esta función se puede expandir según las necesidades
        console.log('Updating stats with period data:', data);
    }

    showError(message) {
        $('#container' + this.PROJECT_NAME).html(`
            <div class="flex items-center justify-center h-64">
                <div class="text-center">
                    <i class="icon-attention text-4xl text-red-500 mb-4"></i>
                    <p class="text-gray-400">${message}</p>
                    <button class="btn btn-primary mt-4" onclick="app.renderDashboard()">
                        Reintentar
                    </button>
                </div>
            </div>
        `);
    }

    // Funciones auxiliares
    getStatusColor(statusId) {
        switch (parseInt(statusId)) {
            case 1: return 'bg-blue-500';
            case 2: return 'bg-yellow-500';
            case 3: return 'bg-green-500';
            case 4: return 'bg-red-500';
            default: return 'bg-gray-500';
        }
    }

    getStatusBadge(statusId) {
        switch (parseInt(statusId)) {
            case 1:
                return '<span class="bg-blue-900 text-blue-300 text-xs font-semibold px-2 py-1 rounded">COTIZACIÓN</span>';
            case 2:
                return '<span class="bg-yellow-900 text-yellow-300 text-xs font-semibold px-2 py-1 rounded">PENDIENTE</span>';
            case 3:
                return '<span class="bg-green-900 text-green-300 text-xs font-semibold px-2 py-1 rounded">PAGADO</span>';
            case 4:
                return '<span class="bg-red-900 text-red-300 text-xs font-semibold px-2 py-1 rounded">CANCELADO</span>';
            default:
                return '<span class="bg-gray-900 text-gray-300 text-xs font-semibold px-2 py-1 rounded">DESCONOCIDO</span>';
        }
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    // Chart.js Configuration
    getChartConfig() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: '#E5E7EB',
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: '#1F2937',
                    titleColor: '#F9FAFB',
                    bodyColor: '#E5E7EB',
                    borderColor: '#374151',
                    borderWidth: 1
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#9CA3AF'
                    },
                    grid: {
                        color: '#374151'
                    }
                },
                y: {
                    ticks: {
                        color: '#9CA3AF'
                    },
                    grid: {
                        color: '#374151'
                    }
                }
            }
        };
    }

    // Interactive Charts Component
    interactiveCharts(options) {
        const defaults = {
            parent: "chartsContainer",
            charts: []
        };

        const opts = Object.assign(defaults, options);

        opts.charts.forEach(chartConfig => {
            const chartContainer = $(`
                <div class="chart-container" style="position: relative; height: 300px;">
                    <canvas id="${chartConfig.id}"></canvas>
                </div>
            `);

            $(`#${opts.parent}`).append(chartContainer);

            const ctx = document.getElementById(chartConfig.id).getContext('2d');
            const config = Object.assign({}, this.getChartConfig(), {
                type: chartConfig.type,
                data: chartConfig.data,
                options: {
                    ...this.getChartConfig(),
                    onClick: (event, elements) => {
                        if (elements.length > 0 && chartConfig.onClick) {
                            const element = elements[0];
                            const dataIndex = element.index;
                            const data = chartConfig.data.datasets[element.datasetIndex].data[dataIndex];
                            const label = chartConfig.data.labels[dataIndex];
                            chartConfig.onClick({ data, label, index: dataIndex });
                        }
                    }
                }
            });

            new Chart(ctx, config);
        });
    }

    // Load Interactive Charts
    async loadInteractiveCharts(dashboardData) {
        try {
            // Obtener datos específicos para gráficos
            const chartResponse = await useFetch({
                url: this._link,
                data: {
                    opc: 'getChartData',
                    mes: $(`#mes${this.PROJECT_NAME}`).val() || '01',
                    anio: $(`#anio${this.PROJECT_NAME}`).val() || '2025'
                }
            });

            if (chartResponse.status === 200) {
                const chartData = chartResponse.data;

                // Limpiar contenedor de gráficos
                $('#statusChart').html('<div id="statusChartContainer"></div>');

                // Crear gráfico de dona para estados
                this.interactiveCharts({
                    parent: "statusChartContainer",
                    charts: [
                        {
                            type: "doughnut",
                            id: "statusDistributionChart",
                            title: "Distribución por Estado",
                            data: {
                                labels: chartData.statusDistribution?.labels || ['Sin datos'],
                                datasets: [{
                                    data: chartData.statusDistribution?.data || [1],
                                    backgroundColor: [
                                        '#3B82F6', // Azul - Cotización
                                        '#EAB308', // Amarillo - Pendiente  
                                        '#10B981', // Verde - Pagado
                                        '#EF4444'  // Rojo - Cancelado
                                    ],
                                    borderColor: '#374151',
                                    borderWidth: 2
                                }]
                            },
                            onClick: (data) => {
                                console.log('Status clicked:', data);
                                // Aquí se puede implementar drill-down
                            }
                        }
                    ]
                });

                // Si hay datos de tendencia mensual, crear gráfico de barras
                if (chartData.monthlyTrend) {
                    // Agregar contenedor para gráfico mensual si no existe
                    if ($('#monthlyTrendContainer').length === 0) {
                        $('#content-dashboardComponent').append(`
                            <div id="monthlyTrendContainer" class="bg-slate-800 p-4 rounded-xl shadow min-h-[300px] lg:col-span-2">
                                <h3 class="text-sm font-bold mb-2">📈 Tendencia Mensual</h3>
                                <div id="monthlyChartContainer"></div>
                            </div>
                        `);
                    }

                    this.interactiveCharts({
                        parent: "monthlyChartContainer",
                        charts: [
                            {
                                type: "bar",
                                id: "monthlyTrendChart",
                                title: "Pedidos por Mes",
                                data: {
                                    labels: chartData.monthlyTrend.labels,
                                    datasets: [{
                                        label: 'Pedidos',
                                        data: chartData.monthlyTrend.orders,
                                        backgroundColor: '#3B82F6',
                                        borderColor: '#1D4ED8',
                                        borderWidth: 1
                                    }, {
                                        label: 'Ingresos',
                                        data: chartData.monthlyTrend.revenue,
                                        backgroundColor: '#10B981',
                                        borderColor: '#059669',
                                        borderWidth: 1,
                                        yAxisID: 'y1'
                                    }]
                                },
                                onClick: (data) => {
                                    console.log('Month clicked:', data);
                                    // Implementar drill-down por mes
                                }
                            }
                        ]
                    });
                }

            } else {
                // Fallback si no hay datos de gráficos
                $('#statusChart').html(this.renderStatusChart(dashboardData.ordersByStatus || []));
            }

        } catch (error) {
            console.error('Error loading charts:', error);
            // Fallback a gráfico estático
            $('#statusChart').html(this.renderStatusChart(dashboardData.ordersByStatus || []));
        }
    }

    // Chart Data Processing Utilities
    processChartData(rawData, chartType) {
        switch (chartType) {
            case 'doughnut':
                return {
                    labels: rawData.map(item => item.label),
                    data: rawData.map(item => item.value)
                };
            case 'bar':
                return {
                    labels: rawData.map(item => item.label),
                    datasets: [{
                        data: rawData.map(item => item.value),
                        backgroundColor: '#3B82F6'
                    }]
                };
            default:
                return rawData;
        }
    }

    // Custom Tooltip Function
    customTooltip(context) {
        const tooltipEl = document.getElementById('chartjs-tooltip');
        const tooltipModel = context.tooltip;

        if (tooltipModel.opacity === 0) {
            tooltipEl.style.opacity = 0;
            return;
        }

        // Personalizar contenido del tooltip
        const titleLines = tooltipModel.title || [];
        const bodyLines = tooltipModel.body.map(b => b.lines);

        let innerHtml = '<thead>';
        titleLines.forEach(title => {
            innerHtml += '<tr><th>' + title + '</th></tr>';
        });
        innerHtml += '</thead><tbody>';

        bodyLines.forEach((body, i) => {
            const colors = tooltipModel.labelColors[i];
            let style = 'background:' + colors.backgroundColor;
            style += '; border-color:' + colors.borderColor;
            style += '; border-width: 2px';
            const span = '<span style="' + style + '"></span>';
            innerHtml += '<tr><td>' + span + body + '</td></tr>';
        });
        innerHtml += '</tbody>';

        const tableRoot = tooltipEl.querySelector('table');
        tableRoot.innerHTML = innerHtml;

        const position = context.chart.canvas.getBoundingClientRect();
        tooltipEl.style.opacity = 1;
        tooltipEl.style.position = 'absolute';
        tooltipEl.style.left = position.left + window.pageXOffset + tooltipModel.caretX + 'px';
        tooltipEl.style.top = position.top + window.pageYOffset + tooltipModel.caretY + 'px';
    }

    // Smart Alerts Manager Component
    alertsManager(options) {
        const defaults = {
            parent: "filterBarDashboard",
            id: "advancedFiltersContainer",
            title: "🔍 Filtros Avanzados",
            collapsible: true,
            presets: true,
            filters: [
                {
                    type: "daterange",
                    id: "dateRange",
                    label: "Rango de Fechas",
                    class: "col-md-3"
                },
                {
                    type: "multiselect",
                    id: "clients",
                    label: "Clientes",
                    class: "col-md-3",
                    data: []
                },
                {
                    type: "multiselect",
                    id: "products",
                    label: "Productos",
                    class: "col-md-3",
                    data: []
                },
                {
                    type: "select",
                    id: "status",
                    label: "Estado",
                    class: "col-md-3",
                    data: []
                }
            ],
            onFilterChange: null,
            onPresetSave: null,
            onPresetLoad: null
        };

        const opts = Object.assign(defaults, options);

        // Crear contenedor principal
        const container = $(`
            <div id="${opts.id}" class="advanced-filters-container bg-slate-800 rounded-lg p-4 mb-4">
                <div class="filters-header flex items-center justify-between mb-4">
                    <h3 class="text-white font-semibold flex items-center gap-2">
                        ${opts.title}
                        ${opts.collapsible ? '<i id="toggleFilters" class="icon-down-open cursor-pointer text-gray-400 hover:text-white"></i>' : ''}
                    </h3>
                    <div class="filters-actions flex items-center gap-2">
                        ${opts.presets ? `
                            <select id="filterPresets" class="bg-gray-700 text-white text-sm rounded px-2 py-1 border border-gray-600">
                                <option value="">Seleccionar preset...</option>
                            </select>
                            <button id="savePreset" class="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded">
                                Guardar
                            </button>
                        ` : ''}
                        <button id="resetFilters" class="bg-gray-600 hover:bg-gray-700 text-white text-xs px-3 py-1 rounded">
                            Limpiar
                        </button>
                    </div>
                </div>
                <div id="filtersContent" class="filters-content">
                    <div class="row" id="filtersRow">
                        <!-- Los filtros se renderizan aquí -->
                    </div>
                    <div class="filters-controls mt-3 flex items-center justify-between">
                        <div class="filters-summary text-sm text-gray-400">
                            <span id="activeFiltersCount">0 filtros activos</span>
                        </div>
                        <div class="filters-buttons flex gap-2">
                            <button id="applyFilters" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                                Aplicar Filtros
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `);

        $(`#${opts.parent}`).html(container);

        // Renderizar filtros individuales
        this.renderFilterControls(opts.filters);

        // Configurar eventos
        this.setupFilterEvents(opts);

        // Cargar presets guardados
        if (opts.presets) {
            this.loadFilterPresets();
        }

        // Inicializar con valores por defecto
        this.initializeDefaultFilters();
    }

    // Render Filter Controls
    renderFilterControls(filters) {
        const filtersRow = $('#filtersRow');

        filters.forEach(filter => {
            let filterHtml = '';

            switch (filter.type) {
                case 'daterange':
                    filterHtml = `
                        <div class="${filter.class}">
                            <label class="block text-sm font-medium text-gray-300 mb-1">${filter.label}</label>
                            <div class="relative">
                                <input type="text" id="${filter.id}" 
                                       class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                                       placeholder="Seleccionar rango..." readonly>
                                <i class="icon-calendar absolute right-3 top-2.5 text-gray-400"></i>
                            </div>
                        </div>
                    `;
                    break;

                case 'multiselect':
                    filterHtml = `
                        <div class="${filter.class}">
                            <label class="block text-sm font-medium text-gray-300 mb-1">${filter.label}</label>
                            <div class="relative">
                                <select id="${filter.id}" multiple 
                                        class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                                        style="min-height: 38px;">
                                    <option value="">Cargando...</option>
                                </select>
                                <div id="${filter.id}Selected" class="selected-items mt-1 flex flex-wrap gap-1"></div>
                            </div>
                        </div>
                    `;
                    break;

                case 'select':
                    filterHtml = `
                        <div class="${filter.class}">
                            <label class="block text-sm font-medium text-gray-300 mb-1">${filter.label}</label>
                            <select id="${filter.id}" 
                                    class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm">
                                <option value="">Todos</option>
                            </select>
                        </div>
                    `;
                    break;

                default:
                    filterHtml = `
                        <div class="${filter.class}">
                            <label class="block text-sm font-medium text-gray-300 mb-1">${filter.label}</label>
                            <input type="text" id="${filter.id}" 
                                   class="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                                   placeholder="${filter.placeholder || ''}">
                        </div>
                    `;
            }

            filtersRow.append(filterHtml);
        });
    }

    // Setup Filter Events
    setupFilterEvents(opts) {
        // Toggle collapsible
        $('#toggleFilters').on('click', () => {
            const content = $('#filtersContent');
            const icon = $('#toggleFilters');

            content.slideToggle(300);
            icon.toggleClass('icon-down-open icon-up-open');
        });

        // Apply filters
        $('#applyFilters').on('click', () => {
            const filters = this.collectFilterValues();
            this.updateActiveFiltersCount(filters);

            if (opts.onFilterChange) {
                opts.onFilterChange(filters);
            }
        });

        // Reset filters
        $('#resetFilters').on('click', () => {
            this.resetAllFilters();
            $('#activeFiltersCount').text('0 filtros activos');

            if (opts.onFilterChange) {
                opts.onFilterChange({});
            }
        });

        // Save preset
        $('#savePreset').on('click', () => {
            this.showSavePresetDialog(opts);
        });

        // Load preset
        $('#filterPresets').on('change', (e) => {
            const presetName = $(e.target).val();
            if (presetName && opts.onPresetLoad) {
                opts.onPresetLoad(presetName);
            }
        });

        // Date range picker
        this.initializeDateRangePicker();

        // Multi-select handlers
        this.setupMultiSelectHandlers();
    }

    // Initialize Date Range Picker
    initializeDateRangePicker() {
        const currentDate = new Date();
        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        $('#dateRange').daterangepicker({
            startDate: firstDay,
            endDate: lastDay,
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
                monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
                firstDay: 1
            },
            ranges: {
                'Hoy': [moment(), moment()],
                'Ayer': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
                'Últimos 7 días': [moment().subtract(6, 'days'), moment()],
                'Últimos 30 días': [moment().subtract(29, 'days'), moment()],
                'Este mes': [moment().startOf('month'), moment().endOf('month')],
                'Mes pasado': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
            }
        });
    }

    // Setup Multi-Select Handlers
    setupMultiSelectHandlers() {
        // Convertir selects múltiples en componentes más amigables
        $('select[multiple]').each(function () {
            const selectId = $(this).attr('id');
            const container = $(`#${selectId}Selected`);

            $(this).on('change', function () {
                const selectedValues = $(this).val() || [];
                const selectedTexts = [];

                $(this).find('option:selected').each(function () {
                    selectedTexts.push($(this).text());
                });

                // Renderizar tags seleccionados
                container.empty();
                selectedTexts.forEach(text => {
                    const tag = $(`
                        <span class="bg-blue-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                            ${text}
                            <i class="icon-cancel cursor-pointer hover:text-red-300" data-value="${text}"></i>
                        </span>
                    `);
                    container.append(tag);
                });

                // Handler para remover tags
                container.find('.icon-cancel').on('click', function () {
                    const valueToRemove = $(this).data('value');
                    $(`#${selectId} option`).each(function () {
                        if ($(this).text() === valueToRemove) {
                            $(this).prop('selected', false);
                        }
                    });
                    $(`#${selectId}`).trigger('change');
                });
            });
        });
    }

    // Advanced Filters Support Methods
    async initAdvancedFilters() {
        try {
            // Cargar datos para los filtros
            const response = await useFetch({
                url: this._link,
                data: { opc: 'getFilterData' }
            });

            if (response.status === 200) {
                this.filterData = response.data;
            } else {
                console.warn('No se pudieron cargar los datos de filtros');
                this.filterData = { clients: [], products: [], status: [] };
            }
        } catch (error) {
            console.error('Error loading filter data:', error);
            this.filterData = { clients: [], products: [], status: [] };
        }
    }

    initializeDefaultFilters() {
        // Establecer valores por defecto
        const currentDate = new Date();
        const currentMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
        const currentYear = String(currentDate.getFullYear());

        // Cargar datos en los selects
        setTimeout(() => {
            this.populateFilterSelects();
        }, 100);
    }

    populateFilterSelects() {
        if (!this.filterData) return;

        // Poblar select de clientes
        const clientsSelect = $('#clients');
        clientsSelect.empty().append('<option value="">Todos los clientes</option>');
        this.filterData.clients.forEach(client => {
            clientsSelect.append(`<option value="${client.id}">${client.name}</option>`);
        });

        // Poblar select de productos
        const productsSelect = $('#products');
        productsSelect.empty().append('<option value="">Todos los productos</option>');
        this.filterData.products.forEach(product => {
            productsSelect.append(`<option value="${product.id}">${product.name}</option>`);
        });

        // Poblar select de estados
        const statusSelect = $('#status');
        statusSelect.empty().append('<option value="">Todos los estados</option>');
        this.filterData.status.forEach(status => {
            statusSelect.append(`<option value="${status.id}">${status.name}</option>`);
        });
    }

    collectFilterValues() {
        const filters = {};

        // Date range
        const dateRange = $('#dateRange').val();
        if (dateRange) {
            const dates = dateRange.split(' - ');
            filters.dateStart = moment(dates[0], 'DD/MM/YYYY').format('YYYY-MM-DD');
            filters.dateEnd = moment(dates[1], 'DD/MM/YYYY').format('YYYY-MM-DD');
        }

        // Clients
        const selectedClients = $('#clients').val();
        if (selectedClients && selectedClients.length > 0) {
            filters.clients = selectedClients.filter(c => c !== '');
        }

        // Products
        const selectedProducts = $('#products').val();
        if (selectedProducts && selectedProducts.length > 0) {
            filters.products = selectedProducts.filter(p => p !== '');
        }

        // Status
        const selectedStatus = $('#status').val();
        if (selectedStatus) {
            filters.status = selectedStatus;
        }

        return filters;
    }

    updateActiveFiltersCount(filters) {
        let count = 0;

        if (filters.dateStart && filters.dateEnd) count++;
        if (filters.clients && filters.clients.length > 0) count++;
        if (filters.products && filters.products.length > 0) count++;
        if (filters.status) count++;

        $('#activeFiltersCount').text(`${count} filtro${count !== 1 ? 's' : ''} activo${count !== 1 ? 's' : ''}`);
    }

    resetAllFilters() {
        // Reset date range to current month
        const currentDate = new Date();
        const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        $('#dateRange').data('daterangepicker').setStartDate(firstDay);
        $('#dateRange').data('daterangepicker').setEndDate(lastDay);

        // Reset selects
        $('#clients').val([]).trigger('change');
        $('#products').val([]).trigger('change');
        $('#status').val('');

        // Clear selected tags
        $('.selected-items').empty();
    }

    applyFilters(filters) {
        console.log('Applying filters:', filters);

        // Guardar filtros en el estado
        this.currentFilters = filters;

        // Recargar dashboard con filtros
        this.renderDashboard();
    }

    // Filter Presets Management
    saveFilterPreset(presetName) {
        const filters = this.collectFilterValues();
        const presets = this.getStoredPresets();

        presets[presetName] = {
            filters: filters,
            created: new Date().toISOString(),
            name: presetName
        };

        localStorage.setItem('dashboardFilterPresets', JSON.stringify(presets));
        this.loadFilterPresets();

        // Mostrar confirmación
        this.showNotification('Preset guardado correctamente', 'success');
    }

    loadFilterPreset(presetName) {
        const presets = this.getStoredPresets();
        const preset = presets[presetName];

        if (preset) {
            this.applyPresetFilters(preset.filters);
            this.showNotification(`Preset "${presetName}" aplicado`, 'info');
        }
    }

    applyPresetFilters(filters) {
        // Aplicar date range
        if (filters.dateStart && filters.dateEnd) {
            const startDate = moment(filters.dateStart);
            const endDate = moment(filters.dateEnd);
            $('#dateRange').data('daterangepicker').setStartDate(startDate);
            $('#dateRange').data('daterangepicker').setEndDate(endDate);
        }

        // Aplicar clients
        if (filters.clients) {
            $('#clients').val(filters.clients).trigger('change');
        }

        // Aplicar products
        if (filters.products) {
            $('#products').val(filters.products).trigger('change');
        }

        // Aplicar status
        if (filters.status) {
            $('#status').val(filters.status);
        }

        // Actualizar contador y aplicar
        this.updateActiveFiltersCount(filters);
        this.applyFilters(filters);
    }

    getStoredPresets() {
        const stored = localStorage.getItem('dashboardFilterPresets');
        return stored ? JSON.parse(stored) : {};
    }

    loadFilterPresets() {
        const presets = this.getStoredPresets();
        const select = $('#filterPresets');

        select.empty().append('<option value="">Seleccionar preset...</option>');

        Object.keys(presets).forEach(presetName => {
            select.append(`<option value="${presetName}">${presetName}</option>`);
        });
    }

    showSavePresetDialog(opts) {
        const filters = this.collectFilterValues();
        const hasFilters = Object.keys(filters).length > 0;

        if (!hasFilters) {
            this.showNotification('No hay filtros activos para guardar', 'warning');
            return;
        }

        const presetName = prompt('Nombre del preset:');
        if (presetName && presetName.trim()) {
            this.saveFilterPreset(presetName.trim());
        }
    }

    showNotification(message, type = 'info') {
        const colors = {
            success: 'bg-green-600',
            error: 'bg-red-600',
            warning: 'bg-yellow-600',
            info: 'bg-blue-600'
        };

        const notification = $(`
            <div class="fixed top-4 right-4 ${colors[type]} text-white px-4 py-2 rounded shadow-lg z-50 notification-toast">
                ${message}
            </div>
        `);

        $('body').append(notification);

        setTimeout(() => {
            notification.fadeOut(300, () => notification.remove());
        }, 3000);
    }

    // Smart Alerts Manager Component
    alertsManager(options) {
        const defaults = {
            parent: "alertsContainer",
            id: "alertsManager",
            title: "🚨 Alertas del Sistema",
            maxAlerts: 5,
            autoRefresh: true,
            refreshInterval: 30000, // 30 segundos
            rules: [],
            onAlertClick: null
        };

        const opts = Object.assign(defaults, options);

        // Crear contenedor principal
        const container = $(`
            <div id="${opts.id}" class="alerts-manager">
                <div class="alerts-header flex items-center justify-between mb-3">
                    <h3 class="text-sm font-bold text-white">${opts.title}</h3>
                    <div class="alerts-controls flex items-center gap-2">
                        <button id="refreshAlerts" class="text-gray-400 hover:text-white text-sm">
                            <i class="icon-refresh"></i>
                        </button>
                        <span id="alertsCount" class="bg-red-600 text-white text-xs px-2 py-1 rounded-full">0</span>
                    </div>
                </div>
                <div id="alertsList" class="alerts-list space-y-2 max-h-64 overflow-y-auto">
                    <div class="text-gray-400 text-sm text-center py-4">
                        <i class="icon-clock text-lg mb-2"></i>
                        <p>Cargando alertas...</p>
                    </div>
                </div>
            </div>
        `);

        $(`#${opts.parent}`).html(container);

        // Configurar eventos
        $('#refreshAlerts').on('click', () => {
            this.loadAlertsSystem();
        });

        // Auto-refresh si está habilitado
        if (opts.autoRefresh) {
            setInterval(() => {
                this.loadAlertsSystem();
            }, opts.refreshInterval);
        }

        // Cargar alertas iniciales
        this.loadAlertsSystem();
    }

    // Load Alerts System
    async loadAlertsSystem() {
        try {
            const response = await useFetch({
                url: this._link,
                data: { opc: 'getDashboardAlerts' }
            });

            if (response.status === 200) {
                this.renderAlertsManager(response.data);
            } else {
                this.renderAlertsError('Error al cargar alertas');
            }
        } catch (error) {
            console.error('Error loading alerts:', error);
            this.renderAlertsError('Error de conexión');
        }
    }

    // Render Alerts Manager
    renderAlertsManager(alerts) {
        const alertsList = $('#alertsList');
        const alertsCount = $('#alertsCount');

        // Actualizar contador
        alertsCount.text(alerts.length);
        alertsCount.removeClass('bg-red-600 bg-yellow-600 bg-blue-600');

        if (alerts.length === 0) {
            alertsList.html(`
                <div class="text-gray-400 text-sm text-center py-4">
                    <i class="icon-check text-lg mb-2 text-green-400"></i>
                    <p>No hay alertas pendientes</p>
                </div>
            `);
            alertsCount.addClass('bg-gray-600');
            return;
        }

        // Determinar color del contador según prioridad más alta
        const highPriorityAlerts = alerts.filter(alert => alert.priority === 'high');
        const mediumPriorityAlerts = alerts.filter(alert => alert.priority === 'medium');

        if (highPriorityAlerts.length > 0) {
            alertsCount.addClass('bg-red-600');
        } else if (mediumPriorityAlerts.length > 0) {
            alertsCount.addClass('bg-yellow-600');
        } else {
            alertsCount.addClass('bg-blue-600');
        }

        // Renderizar alertas
        const alertsHtml = alerts.map(alert => this.renderSingleAlert(alert)).join('');
        alertsList.html(alertsHtml);

        // Configurar eventos de click
        $('.alert-item').on('click', (e) => {
            const alertId = $(e.currentTarget).data('alert-id');
            const alert = alerts.find(a => a.id === alertId);
            if (alert) {
                this.handleAlertClick(alert);
            }
        });
    }

    // Render Single Alert
    renderSingleAlert(alert) {
        const priorityColors = {
            'high': 'border-red-500 bg-red-900/20',
            'medium': 'border-yellow-500 bg-yellow-900/20',
            'low': 'border-blue-500 bg-blue-900/20'
        };

        const typeColors = {
            'danger': 'text-red-400',
            'warning': 'text-yellow-400',
            'info': 'text-blue-400',
            'success': 'text-green-400'
        };

        const priorityIcons = {
            'high': 'icon-attention',
            'medium': 'icon-clock',
            'low': 'icon-info'
        };

        const colorClass = priorityColors[alert.priority] || priorityColors['low'];
        const textColor = typeColors[alert.type] || typeColors['info'];
        const priorityIcon = priorityIcons[alert.priority] || priorityIcons['low'];

        return `
            <div class="alert-item ${colorClass} border-l-4 p-3 rounded cursor-pointer hover:bg-opacity-30 transition-all duration-200" 
                 data-alert-id="${alert.id}">
                <div class="flex items-start gap-3">
                    <div class="flex-shrink-0">
                        <i class="${alert.icon || priorityIcon} ${textColor} text-lg"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-1">
                            <h4 class="text-white font-semibold text-sm truncate">${alert.title}</h4>
                            <span class="priority-badge priority-${alert.priority} text-xs px-2 py-1 rounded">
                                ${alert.priority.toUpperCase()}
                            </span>
                        </div>
                        <p class="text-gray-300 text-xs mb-2 line-clamp-2">${alert.message}</p>
                        <div class="flex items-center justify-between text-xs text-gray-400">
                            <span>${this.formatAlertTime(alert.timestamp)}</span>
                            ${alert.action_url ? '<i class="icon-right-open"></i>' : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Handle Alert Click
    handleAlertClick(alert) {
        console.log('Alert clicked:', alert);

        // Mostrar detalles del alert
        this.showAlertDetails(alert);

        // Navegar si tiene URL de acción
        if (alert.action_url) {
            // Aquí puedes implementar la navegación
            console.log('Navigate to:', alert.action_url);

            // Ejemplo de navegación basada en el tipo de alerta
            switch (alert.id) {
                case 'pending_today':
                    // Navegar a pedidos pendientes
                    break;
                case 'overdue_orders':
                    // Navegar a pedidos vencidos
                    break;
                case 'low_revenue':
                    // Mostrar análisis de ingresos
                    break;
                default:
                    break;
            }
        }
    }

    // Show Alert Details
    showAlertDetails(alert) {
        const detailsHtml = `
            <div class="alert-details p-4">
                <div class="flex items-center gap-3 mb-3">
                    <i class="${alert.icon} text-2xl ${this.getAlertTypeColor(alert.type)}"></i>
                    <div>
                        <h3 class="text-white font-bold">${alert.title}</h3>
                        <span class="text-xs text-gray-400">Prioridad: ${alert.priority.toUpperCase()}</span>
                    </div>
                </div>
                <p class="text-gray-300 mb-4">${alert.message}</p>
                <div class="flex items-center justify-between text-sm text-gray-400">
                    <span>Generada: ${this.formatAlertTime(alert.timestamp)}</span>
                    ${alert.action_url ? `<button class="text-blue-400 hover:text-blue-300">Ver detalles →</button>` : ''}
                </div>
            </div>
        `;

        // Mostrar en modal o tooltip
        this.showTooltip(detailsHtml);
    }

    // Render Alerts Error
    renderAlertsError(message) {
        $('#alertsList').html(`
            <div class="text-red-400 text-sm text-center py-4">
                <i class="icon-attention text-lg mb-2"></i>
                <p>${message}</p>
                <button onclick="app.loadAlertsSystem()" class="text-blue-400 hover:text-blue-300 text-xs mt-2">
                    Reintentar
                </button>
            </div>
        `);
        $('#alertsCount').text('!').addClass('bg-red-600');
    }

    // Helper Methods
    formatAlertTime(timestamp) {
        if (!timestamp) return 'Hace un momento';

        const now = new Date();
        const alertTime = new Date(timestamp);
        const diffMs = now - alertTime;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Hace un momento';
        if (diffMins < 60) return `Hace ${diffMins} min`;
        if (diffHours < 24) return `Hace ${diffHours}h`;
        if (diffDays < 7) return `Hace ${diffDays}d`;

        return alertTime.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    getAlertTypeColor(type) {
        const colors = {
            'danger': 'text-red-400',
            'warning': 'text-yellow-400',
            'info': 'text-blue-400',
            'success': 'text-green-400'
        };
        return colors[type] || colors['info'];
    }

    showTooltip(content) {
        // Implementación simple de tooltip
        const tooltip = $(`
            <div class="alert-tooltip fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
                        bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 max-w-md">
                ${content}
                <button class="absolute top-2 right-2 text-gray-400 hover:text-white" onclick="$(this).parent().remove()">
                    <i class="icon-cancel"></i>
                </button>
            </div>
        `);

        $('body').append(tooltip);

        // Auto-remove después de 5 segundos
        setTimeout(() => {
            tooltip.remove();
        }, 5000);
    }




}