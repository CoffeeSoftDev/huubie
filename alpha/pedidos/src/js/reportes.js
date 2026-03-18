let apiReportes = 'ctrl/ctrl-reportes.php';
let rpt;
let rptSubsidiaries = [];
let rptAccess = 0;
let rptSubId = 0;

$(async () => {
    const req = await useFetch({ url: apiReportes, data: { opc: "init" } });
    rptAccess      = req.access;
    rptSubId       = req.sub_id;
    rptSubsidiaries = req.subsidiaries || [];

    rpt = new ReportesApp(apiReportes, 'root');
    rpt.render();
});

class ReportesApp extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Reportes";
        this.charts = {};
    }

    render() {
        this.layout();
        this.showDashboard();
    }

    layout() {
        this.primaryLayout({
            parent: 'root',
            id: this.PROJECT_NAME,
            class: 'flex p-2',
            card: {
                filterBar: { class: 'w-full mb-3', id: 'filterBar' + this.PROJECT_NAME },
                container: { class: 'w-full h-full', id: 'container' + this.PROJECT_NAME }
            }
        });

        $('#filterBar' + this.PROJECT_NAME).html(`
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                    <button class="bg-[#1F2A37] text-gray-300 px-3 py-2 rounded-lg hover:bg-gray-700 text-sm" onclick="window.location.href='../pedidos/index.php'">
                        <i class="icon-arrow-left"></i> Pedidos
                    </button>
                    <h2 class="text-xl font-bold text-white"><i class="icon-chart-bar"></i> Reportes Avanzados</h2>
                </div>
            </div>
            <div id="rptFilters" class="mb-3"></div>
        `);

        let filterData = [
            { opc: "input-calendar", class: "col-12 col-md-3", id: "calendarReportes", lbl: "Periodo:" },
        ];

        if (rptAccess == 1 && rptSubsidiaries.length > 0) {
            filterData.push({
                opc: "select", id: "rptSubsidiary", lbl: "Sucursal:",
                class: "col-12 col-md-3", data: rptSubsidiaries,
                onchange: "rpt.refreshCurrentTab()"
            });
        }

        this.createfilterBar({ parent: 'rptFilters', data: filterData });

        dataPicker({
            parent: "calendarReportes",
            rangepicker: {
                startDate: moment().startOf("month"),
                endDate: moment().endOf("month"),
                ranges: {
                    "Hoy": [moment(), moment()],
                    "Ayer": [moment().subtract(1, "days"), moment().subtract(1, "days")],
                    "Semana actual": [moment().startOf("week"), moment().endOf("week")],
                    "Mes actual": [moment().startOf("month"), moment().endOf("month")],
                    "Mes anterior": [moment().subtract(1, "month").startOf("month"), moment().subtract(1, "month").endOf("month")],
                    "Ultimos 3 meses": [moment().subtract(3, "months").startOf("month"), moment().endOf("month")],
                },
            },
            onSelect: () => this.refreshCurrentTab()
        });

        this.tabLayout({
            parent: 'container' + this.PROJECT_NAME,
            id: 'tabsReportes',
            theme: 'light',
            type: 'short',
            json: [
                { id: 'dashboard', tab: 'Dashboard', icon: 'icon-chart-bar', onClick: () => this.showDashboard(), active: true },
                { id: 'hora', tab: 'Ventas por Hora', icon: 'icon-clock', onClick: () => this.showSalesByHour() },
                { id: 'producto', tab: 'Por Producto', icon: 'icon-tag', onClick: () => this.showSalesByProduct() },
                { id: 'categoria', tab: 'Por Categoria', icon: 'icon-list', onClick: () => this.showSalesByCategory() },
                { id: 'empleado', tab: 'Por Cajero', icon: 'icon-user', onClick: () => this.showSalesByEmployee() },
                { id: 'comparativo', tab: 'Comparativo', icon: 'icon-chart-line', onClick: () => this.showComparative() },
                { id: 'formapago', tab: 'Formas de Pago', icon: 'icon-credit-card', onClick: () => this.showPaymentMethods() },
                { id: 'cancelaciones', tab: 'Cancelaciones', icon: 'icon-cancel', onClick: () => this.showCancellations() },
                { id: 'propinas', tab: 'Propinas', icon: 'icon-heart', onClick: () => this.showTips() },
                { id: 'cuentas', tab: 'Cuentas x Cobrar', icon: 'icon-attention', onClick: () => this.showAccountsReceivable() },
                { id: 'cortez', tab: 'Historico Cortes Z', icon: 'icon-lock', onClick: () => this.showCorteZHistory() },
            ]
        });
    }

    getSubId() {
        if (rptAccess == 1 && $('#rptSubsidiary').length) {
            return $('#rptSubsidiary').val();
        }
        return rptSubId;
    }

    getDateRange() {
        return getDataRangePicker("calendarReportes");
    }

    currentTab = 'dashboard';

    refreshCurrentTab() {
        const tabMap = {
            'dashboard': () => this.showDashboard(),
            'hora': () => this.showSalesByHour(),
            'producto': () => this.showSalesByProduct(),
            'categoria': () => this.showSalesByCategory(),
            'empleado': () => this.showSalesByEmployee(),
            'comparativo': () => this.showComparative(),
            'formapago': () => this.showPaymentMethods(),
            'cancelaciones': () => this.showCancellations(),
            'propinas': () => this.showTips(),
            'cuentas': () => this.showAccountsReceivable(),
            'cortez': () => this.showCorteZHistory(),
        };
        if (tabMap[this.currentTab]) tabMap[this.currentTab]();
    }

    destroyChart(id) {
        if (this.charts[id]) {
            this.charts[id].destroy();
            delete this.charts[id];
        }
    }

    async showDashboard() {
        this.currentTab = 'dashboard';
        const range = this.getDateRange();
        const sub = this.getSubId();
        const container = $('#container-dashboard');

        const data = await useFetch({
            url: this._link,
            data: { opc: 'showSalesSummary', fi: range.fi, ff: range.ff, sub_id: sub }
        });

        const s = data.summary;
        const c = data.cancellation;
        const d = data.discounts;

        container.html(`
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div class="bg-[#1F2A37] rounded-lg p-4 text-center">
                    <p class="text-gray-400 text-xs">Total Ventas</p>
                    <p class="text-green-400 text-2xl font-bold">${formatPrice(s.total_sales)}</p>
                </div>
                <div class="bg-[#1F2A37] rounded-lg p-4 text-center">
                    <p class="text-gray-400 text-xs">Pedidos</p>
                    <p class="text-blue-400 text-2xl font-bold">${s.total_orders}</p>
                </div>
                <div class="bg-[#1F2A37] rounded-lg p-4 text-center">
                    <p class="text-gray-400 text-xs">Ticket Promedio</p>
                    <p class="text-cyan-400 text-2xl font-bold">${formatPrice(s.avg_ticket)}</p>
                </div>
                <div class="bg-[#1F2A37] rounded-lg p-4 text-center">
                    <p class="text-gray-400 text-xs">Descuentos</p>
                    <p class="text-yellow-400 text-2xl font-bold">${formatPrice(d.total_discount)}</p>
                </div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                <div class="bg-[#1F2A37] rounded-lg p-4 text-center">
                    <p class="text-gray-400 text-xs">Cancelaciones</p>
                    <p class="text-red-400 text-xl font-bold">${c.total_cancelled} <span class="text-sm">(${formatPrice(c.total_amount)})</span></p>
                </div>
                <div class="bg-[#1F2A37] rounded-lg p-4 text-center">
                    <p class="text-gray-400 text-xs">Pedidos con Descuento</p>
                    <p class="text-yellow-400 text-xl font-bold">${d.total_with_discount}</p>
                </div>
                <div class="bg-[#1F2A37] rounded-lg p-4 text-center">
                    <p class="text-gray-400 text-xs">Venta Neta</p>
                    <p class="text-green-300 text-xl font-bold">${formatPrice(parseFloat(s.total_sales) - parseFloat(d.total_discount))}</p>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-[#1F2A37] rounded-lg p-4">
                    <h3 class="text-white font-bold mb-3">Ventas por Hora</h3>
                    <canvas id="chartDashHour" height="200"></canvas>
                </div>
                <div class="bg-[#1F2A37] rounded-lg p-4">
                    <h3 class="text-white font-bold mb-3">Formas de Pago</h3>
                    <canvas id="chartDashPayment" height="200"></canvas>
                </div>
            </div>
        `);

        const hourData = await useFetch({
            url: this._link,
            data: { opc: 'showSalesByHour', fi: range.fi, ff: range.ff, sub_id: sub }
        });

        this.destroyChart('dashHour');
        this.charts['dashHour'] = new Chart($('#chartDashHour'), {
            type: 'bar',
            data: {
                labels: hourData.hours,
                datasets: [{
                    label: 'Ventas ($)',
                    data: hourData.sales,
                    backgroundColor: 'rgba(59, 130, 246, 0.7)',
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { ticks: { color: '#9CA3AF' }, grid: { color: '#374151' } },
                    x: { ticks: { color: '#9CA3AF', maxRotation: 90 }, grid: { display: false } }
                }
            }
        });

        const payData = await useFetch({
            url: this._link,
            data: { opc: 'showPaymentMethods', fi: range.fi, ff: range.ff, sub_id: sub }
        });

        const payLabels = [];
        const payAmounts = [];
        const payColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

        if (Array.isArray(payData.data)) {
            payData.data.forEach((p, i) => {
                payLabels.push(p.method_pay);
                payAmounts.push(parseFloat(p.total_amount));
            });
        }

        this.destroyChart('dashPayment');
        this.charts['dashPayment'] = new Chart($('#chartDashPayment'), {
            type: 'doughnut',
            data: {
                labels: payLabels,
                datasets: [{
                    data: payAmounts,
                    backgroundColor: payColors.slice(0, payLabels.length),
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#9CA3AF' } }
                }
            }
        });
    }

    async showSalesByHour() {
        this.currentTab = 'hora';
        const range = this.getDateRange();
        const sub = this.getSubId();
        const container = $('#container-hora');

        const data = await useFetch({
            url: this._link,
            data: { opc: 'showSalesByHour', fi: range.fi, ff: range.ff, sub_id: sub }
        });

        container.html(`
            <div class="bg-[#1F2A37] rounded-lg p-4">
                <h3 class="text-white font-bold mb-3">Ventas Acumuladas por Hora</h3>
                <canvas id="chartSalesByHour" height="300"></canvas>
            </div>
        `);

        this.destroyChart('salesByHour');
        this.charts['salesByHour'] = new Chart($('#chartSalesByHour'), {
            type: 'bar',
            data: {
                labels: data.hours,
                datasets: [
                    {
                        label: 'Ventas ($)',
                        data: data.sales,
                        backgroundColor: 'rgba(59, 130, 246, 0.7)',
                        borderRadius: 4,
                        yAxisID: 'y',
                    },
                    {
                        label: 'Pedidos',
                        data: data.orders,
                        type: 'line',
                        borderColor: '#F59E0B',
                        backgroundColor: 'rgba(245, 158, 11, 0.2)',
                        tension: 0.3,
                        yAxisID: 'y1',
                    }
                ]
            },
            options: {
                responsive: true,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { labels: { color: '#9CA3AF' } } },
                scales: {
                    y: { position: 'left', ticks: { color: '#9CA3AF' }, grid: { color: '#374151' } },
                    y1: { position: 'right', ticks: { color: '#F59E0B' }, grid: { display: false } },
                    x: { ticks: { color: '#9CA3AF', maxRotation: 90 }, grid: { display: false } }
                }
            }
        });
    }

    async showSalesByProduct() {
        this.currentTab = 'producto';
        const range = this.getDateRange();
        const sub = this.getSubId();
        const container = $('#container-producto');

        const data = await useFetch({
            url: this._link,
            data: { opc: 'showSalesByProduct', fi: range.fi, ff: range.ff, sub_id: sub }
        });

        container.html(`
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div class="bg-[#1F2A37] rounded-lg p-4">
                    <h3 class="text-white font-bold mb-3">Top 10 Productos</h3>
                    <canvas id="chartTopProducts" height="250"></canvas>
                </div>
                <div id="tableProductos"></div>
            </div>
        `);

        const top10 = data.top10 || [];
        const labels = top10.map(p => p.product_name);
        const quantities = top10.map(p => parseInt(p.total_qty));

        this.destroyChart('topProducts');
        this.charts['topProducts'] = new Chart($('#chartTopProducts'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Cantidad vendida',
                    data: quantities,
                    backgroundColor: [
                        '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
                        '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
                    ],
                    borderRadius: 4,
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#9CA3AF' }, grid: { color: '#374151' } },
                    y: { ticks: { color: '#9CA3AF' }, grid: { display: false } }
                }
            }
        });

        this.createCoffeTable({
            parent: 'tableProductos',
            id: 'tbProductosRpt',
            theme: 'dark',
            title: 'Detalle por Producto',
            data: { thead: ['#', 'Producto', 'Cantidad', 'Monto'], row: data.row },
            center: [0, 2],
            right: [3],
        });
    }

    async showSalesByCategory() {
        this.currentTab = 'categoria';
        const range = this.getDateRange();
        const sub = this.getSubId();
        const container = $('#container-categoria');

        const data = await useFetch({
            url: this._link,
            data: { opc: 'showSalesByCategory', fi: range.fi, ff: range.ff, sub_id: sub }
        });

        container.html(`
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div class="bg-[#1F2A37] rounded-lg p-4">
                    <h3 class="text-white font-bold mb-3">Ventas por Categoria</h3>
                    <canvas id="chartCategories" height="250"></canvas>
                </div>
                <div id="tableCategories"></div>
            </div>
        `);

        const cats = data.data || [];
        const labels = cats.map(c => c.category_name);
        const amounts = cats.map(c => parseFloat(c.total_amount));
        const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

        this.destroyChart('categories');
        this.charts['categories'] = new Chart($('#chartCategories'), {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{ data: amounts, backgroundColor: colors.slice(0, labels.length) }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom', labels: { color: '#9CA3AF' } } }
            }
        });

        this.createCoffeTable({
            parent: 'tableCategories',
            id: 'tbCategoriasRpt',
            theme: 'dark',
            title: 'Detalle por Categoria',
            data: { thead: ['Categoria', 'Pedidos', 'Productos', 'Monto'], row: data.row },
            center: [1, 2],
            right: [3],
        });
    }

    async showSalesByEmployee() {
        this.currentTab = 'empleado';
        const range = this.getDateRange();
        const sub = this.getSubId();
        const container = $('#container-empleado');

        const data = await useFetch({
            url: this._link,
            data: { opc: 'showSalesByEmployee', fi: range.fi, ff: range.ff, sub_id: sub }
        });

        container.html(`
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div class="bg-[#1F2A37] rounded-lg p-4">
                    <h3 class="text-white font-bold mb-3">Ventas por Cajero/Empleado</h3>
                    <canvas id="chartEmployees" height="250"></canvas>
                </div>
                <div id="tableEmployees"></div>
            </div>
        `);

        const emps = data.data || [];
        const labels = emps.map(e => e.employee_name || 'Sin asignar');
        const sales = emps.map(e => parseFloat(e.total_sales));

        this.destroyChart('employees');
        this.charts['employees'] = new Chart($('#chartEmployees'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Ventas ($)',
                    data: sales,
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { ticks: { color: '#9CA3AF' }, grid: { color: '#374151' } },
                    x: { ticks: { color: '#9CA3AF' }, grid: { display: false } }
                }
            }
        });

        this.createCoffeTable({
            parent: 'tableEmployees',
            id: 'tbEmpleadosRpt',
            theme: 'dark',
            title: 'Detalle por Empleado',
            data: { thead: ['Empleado', 'Pedidos', 'Ventas', 'Propinas'], row: data.row },
            center: [1],
            right: [2, 3],
        });
    }

    async showComparative() {
        this.currentTab = 'comparativo';
        const sub = this.getSubId();
        const container = $('#container-comparativo');

        container.html(`
            <div class="bg-[#1F2A37] rounded-lg p-4 mb-4">
                <h3 class="text-white font-bold mb-3">Comparativo de Periodos</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label class="text-gray-400 text-sm">Periodo 1:</label>
                        <div id="calendarComp1"></div>
                    </div>
                    <div>
                        <label class="text-gray-400 text-sm">Periodo 2:</label>
                        <div id="calendarComp2"></div>
                    </div>
                </div>
                <button class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold" onclick="rpt.loadComparative()">
                    <i class="icon-chart-line"></i> Comparar
                </button>
            </div>
            <div id="comparativeResult"></div>
        `);

        dataPicker({
            parent: "calendarComp1",
            rangepicker: {
                startDate: moment().subtract(1, "month").startOf("month"),
                endDate: moment().subtract(1, "month").endOf("month"),
            }
        });

        dataPicker({
            parent: "calendarComp2",
            rangepicker: {
                startDate: moment().startOf("month"),
                endDate: moment().endOf("month"),
            }
        });
    }

    async loadComparative() {
        const r1 = getDataRangePicker("calendarComp1");
        const r2 = getDataRangePicker("calendarComp2");
        const sub = this.getSubId();

        const data = await useFetch({
            url: this._link,
            data: {
                opc: 'showComparative',
                fi1: r1.fi, ff1: r1.ff,
                fi2: r2.fi, ff2: r2.ff,
                sub_id: sub
            }
        });

        const s1 = data.summary1;
        const s2 = data.summary2;
        const growth = data.growth;
        const growthColor = growth >= 0 ? 'text-green-400' : 'text-red-400';
        const growthIcon = growth >= 0 ? 'icon-up-open' : 'icon-down-open';

        $('#comparativeResult').html(`
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div class="bg-[#1F2A37] rounded-lg p-4 text-center">
                    <p class="text-gray-400 text-xs">Periodo 1</p>
                    <p class="text-blue-400 text-xl font-bold">${formatPrice(s1.total_sales)}</p>
                    <p class="text-gray-500 text-xs">${s1.total_orders} pedidos</p>
                </div>
                <div class="bg-[#1F2A37] rounded-lg p-4 text-center">
                    <p class="text-gray-400 text-xs">Crecimiento</p>
                    <p class="${growthColor} text-2xl font-bold"><i class="${growthIcon}"></i> ${growth}%</p>
                </div>
                <div class="bg-[#1F2A37] rounded-lg p-4 text-center">
                    <p class="text-gray-400 text-xs">Periodo 2</p>
                    <p class="text-green-400 text-xl font-bold">${formatPrice(s2.total_sales)}</p>
                    <p class="text-gray-500 text-xs">${s2.total_orders} pedidos</p>
                </div>
            </div>
            <div class="bg-[#1F2A37] rounded-lg p-4">
                <canvas id="chartComparative" height="250"></canvas>
            </div>
        `);

        const p1Data = data.period1 || [];
        const p2Data = data.period2 || [];

        const allDates1 = p1Data.map(d => d.fecha);
        const allDates2 = p2Data.map(d => d.fecha);
        const maxLen = Math.max(allDates1.length, allDates2.length, 1);
        const labels = Array.from({ length: maxLen }, (_, i) => `Dia ${i + 1}`);

        this.destroyChart('comparative');
        this.charts['comparative'] = new Chart($('#chartComparative'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Periodo 1',
                        data: p1Data.map(d => parseFloat(d.total_sales)),
                        borderColor: '#3B82F6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true,
                        tension: 0.3,
                    },
                    {
                        label: 'Periodo 2',
                        data: p2Data.map(d => parseFloat(d.total_sales)),
                        borderColor: '#10B981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.3,
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#9CA3AF' } } },
                scales: {
                    y: { ticks: { color: '#9CA3AF' }, grid: { color: '#374151' } },
                    x: { ticks: { color: '#9CA3AF' }, grid: { display: false } }
                }
            }
        });
    }

    async showPaymentMethods() {
        this.currentTab = 'formapago';
        const range = this.getDateRange();
        const sub = this.getSubId();
        const container = $('#container-formapago');

        const data = await useFetch({
            url: this._link,
            data: { opc: 'showPaymentMethods', fi: range.fi, ff: range.ff, sub_id: sub }
        });

        container.html(`
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-[#1F2A37] rounded-lg p-4">
                    <h3 class="text-white font-bold mb-3">Formas de Pago</h3>
                    <canvas id="chartPayMethods" height="250"></canvas>
                </div>
                <div id="tablePayMethods"></div>
            </div>
        `);

        const pData = data.data || [];
        const labels = pData.map(p => p.method_pay);
        const amounts = pData.map(p => parseFloat(p.total_amount));
        const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

        this.destroyChart('payMethods');
        this.charts['payMethods'] = new Chart($('#chartPayMethods'), {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{ data: amounts, backgroundColor: colors.slice(0, labels.length) }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom', labels: { color: '#9CA3AF' } } }
            }
        });

        this.createCoffeTable({
            parent: 'tablePayMethods',
            id: 'tbPayMethodsRpt',
            theme: 'dark',
            title: 'Detalle Formas de Pago',
            data: { thead: ['Forma de pago', 'Pedidos', 'Monto'], row: data.row },
            center: [1],
            right: [2],
        });
    }

    async showCancellations() {
        this.currentTab = 'cancelaciones';
        const range = this.getDateRange();
        const sub = this.getSubId();
        const container = $('#container-cancelaciones');

        const data = await useFetch({
            url: this._link,
            data: { opc: 'lsCancellations', fi: range.fi, ff: range.ff, sub_id: sub }
        });

        const cc = data.cancelCounts;
        const dc = data.discountCounts;

        container.html(`
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div class="bg-[#1F2A37] rounded-lg p-3 text-center">
                    <p class="text-gray-400 text-xs">Cancelaciones</p>
                    <p class="text-red-400 text-xl font-bold">${cc.total_cancelled}</p>
                </div>
                <div class="bg-[#1F2A37] rounded-lg p-3 text-center">
                    <p class="text-gray-400 text-xs">Monto Cancelado</p>
                    <p class="text-red-400 text-xl font-bold">${formatPrice(cc.total_amount)}</p>
                </div>
                <div class="bg-[#1F2A37] rounded-lg p-3 text-center">
                    <p class="text-gray-400 text-xs">Con Descuento</p>
                    <p class="text-yellow-400 text-xl font-bold">${dc.total_with_discount}</p>
                </div>
                <div class="bg-[#1F2A37] rounded-lg p-3 text-center">
                    <p class="text-gray-400 text-xs">Total Descuentos</p>
                    <p class="text-yellow-400 text-xl font-bold">${formatPrice(dc.total_discount)}</p>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div id="tableCancelaciones"></div>
                <div id="tableDescuentos"></div>
            </div>
        `);

        this.createCoffeTable({
            parent: 'tableCancelaciones',
            id: 'tbCancelacionesRpt',
            theme: 'dark',
            title: 'Pedidos Cancelados',
            data: { thead: ['Pedido', 'Cliente', 'Total', 'Motivo', 'Responsable', 'Fecha'], row: data.rowCancel },
            right: [2],
        });

        this.createCoffeTable({
            parent: 'tableDescuentos',
            id: 'tbDescuentosRpt',
            theme: 'dark',
            title: 'Descuentos Aplicados',
            data: { thead: ['Pedido', 'Cliente', 'Total', 'Descuento', 'Motivo', 'Fecha'], row: data.rowDiscount },
            right: [2, 3],
        });
    }

    async showTips() {
        this.currentTab = 'propinas';
        const range = this.getDateRange();
        const sub = this.getSubId();
        const container = $('#container-propinas');

        const data = await useFetch({
            url: this._link,
            data: { opc: 'showTips', fi: range.fi, ff: range.ff, sub_id: sub }
        });

        container.html(`
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div id="tableTipsEmployee"></div>
                <div id="tableTipsShift"></div>
            </div>
        `);

        this.createCoffeTable({
            parent: 'tableTipsEmployee',
            id: 'tbTipsEmployee',
            theme: 'dark',
            title: 'Propinas por Empleado',
            data: { thead: ['Empleado', 'Pedidos', 'Propinas'], row: data.rowEmployee },
            center: [1],
            right: [2],
        });

        this.createCoffeTable({
            parent: 'tableTipsShift',
            id: 'tbTipsShift',
            theme: 'dark',
            title: 'Propinas por Turno',
            data: { thead: ['Turno', 'Cajero', 'Apertura', 'Cierre', 'Propinas'], row: data.rowShift },
            right: [4],
        });
    }

    async showAccountsReceivable() {
        this.currentTab = 'cuentas';
        const sub = this.getSubId();
        const container = $('#container-cuentas');

        const data = await useFetch({
            url: this._link,
            data: { opc: 'lsAccountsReceivable', sub_id: sub }
        });

        const t = data.totals;

        container.html(`
            <div class="grid grid-cols-2 gap-3 mb-4">
                <div class="bg-[#1F2A37] rounded-lg p-4 text-center">
                    <p class="text-gray-400 text-xs">Cuentas Pendientes</p>
                    <p class="text-red-400 text-2xl font-bold">${t.total_accounts}</p>
                </div>
                <div class="bg-[#1F2A37] rounded-lg p-4 text-center">
                    <p class="text-gray-400 text-xs">Saldo Total por Cobrar</p>
                    <p class="text-red-400 text-2xl font-bold">${formatPrice(t.total_balance)}</p>
                </div>
            </div>
            <div id="tableCuentas"></div>
        `);

        this.createCoffeTable({
            parent: 'tableCuentas',
            id: 'tbCuentasRpt',
            theme: 'dark',
            title: 'Cuentas por Cobrar',
            data: {
                thead: ['Pedido', 'Cliente', 'Telefono', 'Total', 'Abonado', 'Saldo', 'Dias', 'Fecha'],
                row: data.row
            },
            right: [3, 4, 5],
            center: [6],
        });
    }

    showCorteZHistory() {
        this.currentTab = 'cortez';
        const range = this.getDateRange();
        const sub = this.getSubId();

        this.createTable({
            parent: 'container-cortez',
            data: { opc: 'lsCorteZHistory', fi: range.fi, ff: range.ff, sub_id: sub },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: 'tbCorteZHistory',
                theme: 'dark',
                title: 'Historico de Cortes Z',
                right: [5, 6, 7, 8, 9],
                center: [10],
            }
        });
    }
}
