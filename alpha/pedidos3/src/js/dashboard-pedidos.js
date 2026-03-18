let apis = '../pedidos/ctrl/ctrl-pedidos.php';
let dashboard, dashboardPedidos;

let lsSucursales, lsStatus;

$(async () => {
    const data = await useFetch({ url: api, data: { opc: "init" } });
    lsSucursales = data.sucursales || [];
    lsStatus = data.status || [];

    dashboard = new AppDashboard(api, "root");
    dashboardPedidos = new DashboardPedidos(api, "root");

    // dashboard.render();
});

class AppDashboard extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "DashboardPedidos";
    }

    render() {
        this.layout();
        dashboardPedidos.render();
    }

    layout() {
        this.primaryLayout({
            parent: "root",
            id: this.PROJECT_NAME,
            class: "w-full",
            card: {
                filterBar: { class: "w-full", id: "filterBar" + this.PROJECT_NAME },
                container: { class: "w-full h-full", id: "container" + this.PROJECT_NAME },
            },
        });

        // this.headerBar({
        //     parent: `filterBar${this.PROJECT_NAME}`,
        //     title: "📊 Dashboard de Pedidos",
        //     subtitle: "Consulta las métricas y análisis de pedidos por sucursal.",
        //     onClick: () => app.render(),
        // });

        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: "dark",
            class: '',
            type: "short",
            json: [
                {
                    id: "dashboard",
                    tab: "Dashboard",
                    class: "mb-1",
                    active: true,
                    onClick: () => dashboardPedidos.renderDashboard()
                },
                {
                    id: "pedidos",
                    tab: "Pedidos",
                    onClick: () => {
                        if (typeof app !== 'undefined' && app.render) {
                            $('#container-pedidos').html('<div id="root-pedidos"></div>');
                            app._div_modulo = 'root-pedidos';
                            app.render();
                        }
                    }
                },
                {
                    id: "reportes",
                    tab: "Reportes",
                    onClick: () => {
                        if (typeof reports !== 'undefined' && reports.render) {
                            reports.render();
                        }
                    }
                },
            ]
        });

        $('#content-tabs' + this.PROJECT_NAME).removeClass('h-screen');
    }

    headerBar(options) {
        const defaults = {
            parent: "root",
            title: "Título por defecto",
            subtitle: "Subtítulo por defecto",
            icon: "icon-home",
            textBtn: "Inicio",
            classBtn: "bg-blue-600 hover:bg-blue-700",
            onClick: null,
        };

        const opts = Object.assign({}, defaults, options);

        const container = $("<div>", {
            class: "flex justify-between items-center px-2 pt-3 pb-3"
        });

        const leftSection = $("<div>").append(
            $("<h2>", {
                class: "text-2xl font-semibold",
                text: opts.title
            }),
            $("<p>", {
                class: "text-gray-400",
                text: opts.subtitle
            })
        );

        const rightSection = $("<div>").append(
            $("<button>", {
                class: `${opts.classBtn} text-white font-semibold px-4 py-2 rounded transition flex items-center`,
                html: `<i class="${opts.icon} mr-2"></i>${opts.textBtn}`,
                click: () => {
                    if (typeof opts.onClick === "function") {
                        opts.onClick();
                    }
                }
            })
        );

        container.append(leftSection, rightSection);
        $(`#${opts.parent}`).html(container);
    }
}

class DashboardPedidos extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "DashboardPedidos";
    }

    render() {
        this.layout();
    }

    layout() {

        this.dashboardComponent({
            parent: "container-dashboard",
            id: "dashboardComponent",
            theme: 'dark',
            title: "📊 Dashboard de Pedidos",
            subtitle: "Análisis comparativo de pedidos entre dos períodos",
            json: [
                { type: "grafico", id: "containerChequePro" },
                { type: "grafico", id: "barProductMargen", title: "" },
                { type: "grafico", id: "ventasDiasSemana", title: "Ventas por Día de la Semana" },
                { type: "grafico", id: "Tendencia", title: "Tendencia de Ventas" },
            ]
        });

        this.filterBarDashboard();

    }

    async renderDashboard() {
        let sucursal = $('#filterBarDashboard #sucursal').val();
        let periodo1 = $('#filterBarDashboard #periodo1').val();
        let [anio1, mes1] = periodo1.split('-');
        let periodo2 = $('#filterBarDashboard #periodo2').val();
        let [anio2, mes2] = periodo2.split('-');

        let mkt = await useFetch({
            url: api,
            data: {
                opc: "apiDashboard",
                sucursal: sucursal,
                anio1: anio1,
                mes1: mes1,
                anio2: anio2,
                mes2: mes2,
            },
        });

        this.showCards(mkt.dashboard);

        this.chequeComparativo({
            data: mkt.barras.dataset,
            anioA: mkt.barras.anioA,
            anioB: mkt.barras.anioB,
        });

        this.comparativaIngresosDiarios({ data: mkt.linear });
        this.ventasPorDiaSemana(mkt.barDays);

        this.topDiasSemana({
            parent: "Tendencia",
            title: "📊 Ranking por Promedio Semanal",
            subtitle: "Promedio de pedidos por día de la semana en el mes seleccionado",
            data: mkt.topWeek
        });
    }

    filterBarDashboard() {

        this.createfilterBar({
            parent: `filterBarDashboard`,
            data: [
                {
                    opc: "select",
                    id: "sucursal",
                    lbl: "Sucursal",
                    class: "col-sm-4",
                    data: lsSucursales,
                    onchange: `dashboardPedidos.renderDashboard()`,
                },
                {
                    opc: "div",
                    id: "containerPeriodo1",
                    lbl: "Consultar con:",
                    class: "col-lg-3 col-sm-4",
                    html: `
                        <input 
                            type="month" 
                            id="periodo1" 
                            class="form-control"
                            style="width: 100%; min-width: 100%; display: block;"
                            onchange="dashboardPedidos.renderDashboard()"
                        />
                    `
                },
                {
                    opc: "div",
                    id: "containerPeriodo2",
                    lbl: "Comparar con:",
                    class: "col-lg-3 col-sm-4",
                    html: `
                        <input 
                            type="month" 
                            id="periodo2" 
                            class="form-control"
                            onchange="dashboardPedidos.renderDashboard()"
                        />
                    `
                },
            ],
        });

        const currentYear = moment().year();
        const currentMonth = moment().month() + 1;
        const lastYear = currentYear - 1;

        const periodo1 = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        const periodo2 = `${lastYear}-${String(currentMonth).padStart(2, '0')}`;

        $('#containerPeriodo1').removeClass('col-lg-3 col-sm-4');
        $('#containerPeriodo2').removeClass('col-lg-3 col-sm-4');

        setTimeout(() => {
            $(`#filterBarDashboard #periodo1`).val(periodo1).trigger("change");
            $(`#filterBarDashboard #periodo2`).val(periodo2).trigger("change");
        }, 100);
    }

    dashboardComponent(options) {
        const defaults = {
            parent: "root",
            id: "dashboardComponent",
            title: "📊 Dashboard",
            subtitle: "Resumen de métricas",
            json: [],
            theme: "light"
        };

        const opts = Object.assign(defaults, options);
        const isDark = opts.theme === "dark";

        // 🎨 Paleta exacta corregida
        const theme = {
            bgMain: isDark ? "bg-[#0E1521]" : "bg-white",
            textMain: isDark ? "text-white" : "text-[#103B60]",
            textSecondary: isDark ? "text-gray-400" : "text-gray-600",
            cardBg: isDark ? "bg-[#1F2A37]" : "bg-white",
            cardText: isDark ? "text-gray-300" : "text-gray-800",
            titleColor: isDark ? "text-white" : "text-[#103B60]",
        };

        const container = $(`
        <div id="${opts.id}" class="w-full ${theme.bgMain} min-h-screen p-6">
            <div class="pb-4">
                <div class="mx-auto">
                    <h1 class="text-2xl font-bold ${theme.titleColor}">${opts.title}</h1>
                    <p class="text-sm ${theme.textSecondary}">${opts.subtitle}</p>
                </div>
            </div>

            <div id="filterBarDashboard" class="mx-auto px-2 py-4"></div>
            <section id="cardDashboard" class=""></section>
            <section id="content-${opts.id}" class="mx-auto px-2 py-6 grid gap-6 grid-cols-1 md:grid-cols-2"></section>
        </div>
    `);

        opts.json.forEach(item => {
            let block = $("<div>", {
                id: item.id,
                class: `${theme.cardBg} p-4 rounded-xl shadow-sm min-h-[180px] w-full transition duration-300`,
            });

            if (item.title) {
                const defaultEmojis = {
                    'grafico': '📊',
                    'tabla': '📋',
                    'doc': '📄',
                    'filterBar': '🔍'
                };

                const emoji = item.emoji || defaultEmojis[item.type] || '';
                const iconHtml = item.icon ? `<i class="${item.icon}"></i> ` : '';
                const titleContent = `${emoji} ${iconHtml}${item.title}`;

                block.prepend(`<h3 class="text-base font-semibold ${theme.cardText} mb-3">${titleContent}</h3>`);
            }

            $(`#content-${opts.id}`, container).append(block);
        });

        $(`#${opts.parent}`).html(container);
    }

    // Cards.
    showCards(data) {
        this.infoCard({
            parent: "cardDashboard",
            theme: "dark",
            class: "w-full",
            json: [
                {
                    id: "kpiCotizaciones",
                    title: "Cotizaciones del Mes",
                    data: {
                        value: data.cotizaciones || 0,
                        color: "text-purple-400"
                    },
                },
                {
                    id: "kpiVentas",
                    title: "Ventas Totales",
                    data: {
                        value: data.ventasTotales || "$0",
                        color: "text-pink-400"
                    },
                },
                {
                    title: "Ingresos del Mes",
                    data: {
                        value: data.ingresos || "$0",
                        color: "text-cyan-400"
                    },
                },
                {
                    id: "kpiPendiente",
                    title: "Pendiente por Cobrar",
                    data: {
                        value: data.pendienteCobrar || "$0",
                        color: "text-red-400"
                    },
                },
            ],
        });
    }

    infoCard(options) {
        const defaults = {
            parent: "root",
            id: "infoCardKPI",
            class: "",
            theme: "light",
            json: [],
        };
        const opts = Object.assign({}, defaults, options);
        const isDark = opts.theme === "dark";
        const cardBase = isDark
            ? "bg-[#1F2A37] text-white rounded-xl shadow"
            : "bg-white text-gray-800 rounded-xl shadow";
        const titleColor = isDark ? "text-gray-300" : "text-gray-600";

        const renderCard = (card, i = "") => {
            const box = $("<div>", {
                id: `${opts.id}_${i}`,
                class: `${cardBase} p-4`
            });
            const title = $("<p>", {
                class: `text-sm ${titleColor}`,
                html: card.title
            });
            const value = $("<p>", {
                id: card.id || "",
                class: `text-2xl font-bold ${card.data?.color || "text-white"}`,
                html: card.data?.value
            });
            const description = $("<p>", {
                class: `text-xs mt-1 ${card.data?.color || "text-gray-500"}`,
                html: card.data?.description || ""
            });
            box.append(title, value, description);
            return box;
        };

        const container = $("<div>", {
            id: opts.id,
            class: `grid grid-cols-2 md:grid-cols-4 gap-4 ${opts.class}`
        });

        opts.json.forEach((item, i) => {
            container.append(renderCard(item, i));
        });

        $(`#${opts.parent}`).html(container);
    }

    // Grapighs.


    chequeComparativo(options) {
        const defaults = {
            parent: "containerChequePro",
            id: "chart",
            title: "Comparativa por Categorías",
            class: "p-4 rounded-xl",
            data: {},
            anioA: new Date().getFullYear(),
            anioB: new Date().getFullYear() - 1,
        };
        const opts = Object.assign({}, defaults, options);

        const periodo1 = $('#filterBarDashboard #periodo1').val();
        const [anio1, mesNum1] = periodo1.split('-');
        const mes1 = moment().month(parseInt(mesNum1) - 1).format('MMMM');

        const periodo2 = $('#filterBarDashboard #periodo2').val();
        const [anio2, mesNum2] = periodo2.split('-');
        const mes2 = moment().month(parseInt(mesNum2) - 1).format('MMMM');

        const container = $("<div>", { class: opts.class });
        const title = $("<h2>", {
            class: "text-lg font-bold mb-2",
            text: `Comparativa: ${mes1} ${anio1} vs ${mes2} ${anio2}`
        });
        const canvasWrapper = $("<div>", {
            class: "w-full",
            css: { height: "300px" }
        });
        const canvas = $("<canvas>", {
            id: opts.id,
            class: "w-full h-full"
        });
        canvasWrapper.append(canvas);
        container.append(title, canvasWrapper);

        $('#' + opts.parent).html(container);

        const ctx = document.getElementById(opts.id).getContext("2d");
        if (window._chq) window._chq.destroy();

        // Colores para cada categoría
        const coloresPeriodo1 = ["#4A90E2", "#E94B8A", "#2ECC71", "#FF8C42"];
        const coloresPeriodo2 = ["#5BA3F5", "#F55C9B", "#3FDD82", "#FFA055"];

        window._chq = new Chart(ctx, {
            type: "bar",
            data: {
                labels: opts.data.labels,
                datasets: [
                    {
                        label: `${mes1} ${anio1}`,
                        data: opts.data.A,
                        backgroundColor: coloresPeriodo1
                    },
                    {
                        label: `${mes2} ${anio2}`,
                        data: opts.data.B,
                        backgroundColor: coloresPeriodo2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "bottom" },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${formatPrice(ctx.parsed.y)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (v) => formatPrice(v)
                        }
                    }
                }
            }
        });
    }

    comparativaIngresosDiarios(options) {
        let periodo1 = $('#filterBarDashboard #periodo1').val();
        let [anio1, mesNum1] = periodo1.split('-');
        let mes1 = moment().month(parseInt(mesNum1) - 1).format('MMMM');

        let periodo2 = $('#filterBarDashboard #periodo2').val();
        let [anio2, mesNum2] = periodo2.split('-');
        let mes2 = moment().month(parseInt(mesNum2) - 1).format('MMMM');

        this.linearChart({
            parent: "barProductMargen",
            id: "chartLine",
            title: `📈 Comparativa: ${mes1} ${anio1} vs ${mes2} ${anio2}`,
            data: options.data
        });
    }

    ventasPorDiaSemana(data) {
        this.barChart({
            parent: 'ventasDiasSemana',
            title: 'Pedidos por Día de Semana',
            ...data
        });
    }

    // Components.

    linearChart(options) {
        const defaults = {
            parent: "containerLineChart",
            id: "linearChart",
            title: "",
            class: "p-4 rounded-xl",
            data: {},
        };
        const opts = Object.assign({}, defaults, options);
        const container = $("<div>", { class: opts.class });
        const title = $("<h2>", {
            class: "text-lg font-bold mb-2",
            text: opts.title
        });
        const canvasWrapper = $("<div>", {
            class: "w-full",
            css: { height: "300px" }
        });
        const canvas = $("<canvas>", {
            id: opts.id,
            class: "w-full h-full"
        });
        canvasWrapper.append(canvas);
        container.append(title, canvasWrapper);
        $('#' + opts.parent).html(container);

        const ctx = document.getElementById(opts.id).getContext("2d");
        if (!window._charts) window._charts = {};
        if (window._charts[opts.id]) {
            window._charts[opts.id].destroy();
        }

        // Aplicar colores a los datasets
        const coloresLinea = ["#4A90E2", "#2ECC71"];
        if (opts.data.datasets) {
            opts.data.datasets.forEach((dataset, index) => {
                dataset.borderColor = coloresLinea[index] || "#4A90E2";
                dataset.backgroundColor = coloresLinea[index] || "#4A90E2";
                dataset.tension = 0.4;
            });
        }

        window._charts[opts.id] = new Chart(ctx, {
            type: "line",
            data: opts.data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: "bottom" },
                    tooltip: {
                        callbacks: {
                            title: (items) => {
                                const index = items[0].dataIndex;
                                const tooltips = opts.data.tooltip || opts.data.labels;
                                return tooltips[index];
                            },
                            label: (ctx) => `${ctx.dataset.label}: ${formatPrice(ctx.parsed.y)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (v) => formatPrice(v)
                        }
                    }
                }
            }
        });
    }

    barChart(options) {
        const defaults = {
            parent: "containerBarChart",
            id: "chartBar",
            title: "Comparativa por Categorías",
            class: "p-4 rounded-xl",
            labels: [],
            dataA: [],
            dataB: [],
            yearA: new Date().getFullYear() - 1,
            yearB: new Date().getFullYear(),
        };

        const opts = Object.assign({}, defaults, options);

        const container = $("<div>", { class: opts.class });
        const title = $("<h2>", {
            class: "text-lg font-bold mb-2",
            text: opts.title
        });
        const canvasWrapper = $("<div>", {
            class: "w-full",
            css: { height: "300px" }
        });
        const canvas = $("<canvas>", {
            id: opts.id,
            class: "w-full h-full"
        });

        canvasWrapper.append(canvas);
        container.append(title, canvasWrapper);
        $("#" + opts.parent).html(container);

        const ctx = document.getElementById(opts.id).getContext("2d");
        if (window._barChart) window._barChart.destroy();

        // Colores para cada día de la semana
        const coloresDias = ["#4A90E2", "#E94B8A", "#2ECC71", "#FF8C42", "#9B59B6", "#F39C12", "#1ABC9C"];

        window._barChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: opts.labels,
                datasets: [
                    {
                        label: `Año ${opts.yearB}`,
                        data: opts.dataA,
                        backgroundColor: coloresDias
                    },
                    {
                        label: `Año ${opts.yearA}`,
                        data: opts.dataB,
                        backgroundColor: coloresDias.map(color => color + "CC") // Añade transparencia
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: {
                                size: 13,
                                weight: "600"
                            },
                            color: "#333"
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.dataset.label}: ${formatPrice(ctx.parsed.y)}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (v) => formatPrice(v),
                            color: "#333",
                            font: { size: 12 }
                        },
                        grid: { color: "rgba(0,0,0,0.05)" }
                    },
                    x: {
                        ticks: {
                            color: "#333",
                            font: { size: 12 }
                        },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    topDiasSemana(options) {
        const defaults = {
            parent: "containerTopDiasSemana",
            title: "📊 Ranking por Promedio Semanal",
            subtitle: "",
            data: [],
            theme: "dark" // o 'dark'
        };

        const opts = Object.assign({}, defaults, options);
        const isDark = opts.theme === "dark";

        // 🎨 Paleta Huubie dark
        const theme = {
            bgMain: isDark ? "bg-[#1F2A37]" : "bg-white",
            textMain: isDark ? "text-white" : "text-gray-900",
            textSecondary: isDark ? "text-gray-400" : "text-gray-500",
            textMeta: isDark ? "text-gray-300" : "text-gray-600",
            card: isDark ? "bg-[#111827]" : "bg-gray-100",
        };

        const container = $("<div>", {
            class: `p-4 rounded-xl ${theme.bgMain}`
        });

        const header = $("<div>", { class: "mb-4" })
            .append($("<h2>", { class: `text-lg font-bold ${theme.textMain}`, text: opts.title }))
            .append($("<p>", { class: `text-sm ${theme.textSecondary}`, text: opts.subtitle }));

        const list = $("<div>", { class: "space-y-3" });

        const colores = [
            { bg: "bg-green-600/20", circle: "bg-green-500 text-white" },
            { bg: "bg-blue-600/20", circle: "bg-blue-500 text-white" },
            { bg: "bg-purple-600/20", circle: "bg-purple-500 text-white" },
            { bg: "bg-orange-600/20", circle: "bg-orange-500 text-white" },
            { bg: "bg-pink-600/20", circle: "bg-pink-500 text-white" },
            { bg: "bg-yellow-600/20", circle: "bg-yellow-500 text-white" },
            { bg: "bg-gray-600/20", circle: "bg-gray-500 text-white" }
        ];

        opts.data.forEach((item, i) => {
            const rank = i + 1;
            const palette = colores[i] || { bg: "bg-gray-700/20", circle: "bg-gray-400 text-black" };

            const row = $("<div>", {
                class: `flex items-center gap-3 p-3 rounded-lg ${palette.bg}`
            });

            row.append(
                $("<span>", {
                    class: `flex items-center justify-center w-8 h-8 rounded-full font-bold ${palette.circle}`,
                    text: rank
                })
            );

            const content = $("<div>", { class: "flex-1" });
            content.append(
                $("<div>", { class: "flex justify-between" })
                    .append($("<span>", { class: `font-semibold ${theme.textMain}`, text: item.dia }))
                    .append($("<span>", { class: `font-bold ${theme.textMain}`, text: formatPrice(item.promedio) }))
            );

            content.append(
                $("<div>", { class: `text-sm ${theme.textMeta} flex justify-between` })
                    .append($("<span>", {
                        text: `${item.veces} días con ${item.clientes} clientes`
                    }))
                    .append($("<span>", {
                        class: "italic",
                        text: rank === 1 ? "⭐ Mejor día" : ""
                    }))
            );

            row.append(content);
            list.append(row);
        });

        container.append(header, list);
        $("#" + opts.parent).html(container);
    }

}
