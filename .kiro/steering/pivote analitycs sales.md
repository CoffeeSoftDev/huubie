# 🧭 Pivote Estratégico — Módulo de Ventas (Sales Module)

---

## 🎯 Propósito General
El **módulo de ventas** centraliza la administración de **ingresos, estadísticas y comparativas de ventas** dentro del sistema ERP CoffeeSoft.  
Permite visualizar métricas en tiempo real, generar reportes por unidad de negocio (UDN), comparar ventas mensuales y calcular promedios acumulados, facilitando la toma de decisiones financieras y operativas.

---

## ⚙️ Key Features

- 🔹 **Dashboard de ventas dinámico** con gráficos de desempeño, ventas por día y cheque promedio.  
- 🔹 **Comparativas mensuales** con vistas interactivas año vs año, incluyendo ventas e ingresos.  
- 🔹 **Promedios acumulados** con filtros automáticos por año, mes y UDN.  
- 🔹 **Filtros inteligentes** para seleccionar períodos, tipos de reporte y clasificación de ventas.  
- 🔹 **Tablas interactivas CoffeeSoft** con paginación, filtros dinámicos y estilos corporativos.  
- 🔹 **Visualización modular por pestañas (tabs)**: Dashboard, Ventas, Comparativas, Promedios.  
- 🔹 **Integración con Chart.js** para generar gráficos lineales, de barras y comparativos.  
- 🔹 **Diseño adaptable y limpio**, optimizado para pantallas corporativas y responsive.

## 🧭 Notas de Diseño

- 🧩 Cada submódulo (Dashboard, Sales, MonthlySales, CumulativeAverages) hereda de la clase base `Templates`, asegurando consistencia visual y lógica.  
- 💡 Se utiliza el patrón de inicialización modular: cada clase tiene sus propios métodos `render()` y `layout()` con independencia funcional.  
- 🖌️ Paleta de colores CoffeeSoft:
  - Azul corporativo: `#103B60`
  - Verde acción: `#8CC63F`
  - Gris claro: `#EAEAEA`

## 🧩 Estructura Técnica

| Clase / Archivo | Descripción | Ejemplo / Función |
|------------------|-------------|--------------------|
| `App` | Clase principal que define la estructura del módulo, tabs, layout y control global. | `app = new App(api, "root")` |
| `SalesDashboard` | Renderiza el dashboard de métricas de ventas, incluyendo gráficas comparativas y KPIs. | `salesDashboard.renderDashboard()` |
| `Sales` | Controla el listado y captura de ventas diarias, con filtros por mes, año y tipo. | `sales.listSales()` |
| `MonthlySales` | Genera comparativas mensuales de ingresos y promedios año contra año. | `monthlySales.lsComparativa()` |
| `CumulativeAverages` | Calcula y visualiza los promedios acumulados del año seleccionado. | `cumulativeAverages.ls()` |
| `ctrl-ingresos.php` | Controlador PHP para consultas de ventas, comparativas y promedios. | `opc: "init", "list", "listComparative"` |
| `mdl-ingresos.php` | Modelo de base de datos para obtener registros de ventas y métricas. | Métodos de lectura y agregación SQL. |

---
## Código

### FRONT-JS [analitycs-sales.js]

```javascript
let api = 'ctrl/ctrl-ingresos.php';
let app, sales, salesDashboard, monthlySales, cumulativeAverages;

let udn, lsudn, clasificacion;

$(async () => {
    app = new App(api, "root");

    const data          = await useFetch({ url: api, data: { opc: "init" } });
          udn           = data.udn;
          lsudn         = data.lsudn;
          clasificacion = data.clasification;

    // ** Instancias **
    app = new App(api, "root");


    salesDashboard     = new SalesDashboard(api, "root");
    sales              = new Sales(api, "root");
    monthlySales       = new MonthlySales(api, "root");
    cumulativeAverages = new CumulativeAverages(api, "root");


    app.render();


});

class App extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "orders";
    }


    render() {
        this.layout();

        // init instancias.

        sales.render();
        salesDashboard.render();
        monthlySales.render();
        cumulativeAverages.render();

    }

    layout() {
        this.primaryLayout({
            parent: "root",
            id: this.PROJECT_NAME,
            class: "w-full",
            card: {
                filterBar: { class: "w-full", id: "filterBarVentas" },
                container: { class: "w-full h-full", id: "containerVentas" },
            },
        });

        this.headerBar({
            parent: `filterBarVentas`,
            title: "📊 Módulo de ventas",
            subtitle: "Consulta las métricas de ventas.",
            onClick: () => app.init(),
        });

        this.tabLayout({
            parent: `containerVentas`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: "light",
            class: '',
            type: "short",
            json: [
                {
                    id: "dashboard",
                    tab: "Dashboard",
                    class: "mb-1",
                    active: true,
                    onClick: () => salesDashboard.renderDashboard()
                },
                {
                    id: "sales",
                    tab: "Módulo ventas",
                    onClick: () => {
                    }
                },
                {
                    id: "comparativasMensuales",
                    tab: "Comparativas mensuales",
                    onClick: () => {
                    }
                },
                // {
                //     id: "promediosDiarios",
                //     tab: "Promedios diarios",
                //     onClick: () => {
                //     }
                // },
                {
                    id: "promediosAcumulados",
                    tab: "Promedios acumulados",
                    onClick: () => {
                    }
                },
            ]
        });

        $('#content-tabsVentas').removeClass('h-screen');
    }


    // Components.


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
                class: "text-2xl font-semibold ",
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

class SalesDashboard extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "order";
    }

    render() {
        this.layout();
    }

    layout() {
        this.dashboardComponent({
            parent: "container-dashboard",
            id: "dashboardComponent",
            title: "📊 Dashboard de Ventas",
            subtitle: "Análisis comparativo de ventas entre dos períodos",
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

        let udn = $('#filterBarDashboard #udn').val();
        let periodo1 = $('#filterBarDashboard #periodo1').val();
        let [anio1, mes1] = periodo1.split('-');
        let periodo2 = $('#filterBarDashboard #periodo2').val();
        let [anio2, mes2] = periodo2.split('-');

        let mkt = await useFetch({
            url: api,
            data: {
                opc: "apiPromediosDiarios",
                udn: udn,
                anio1: anio1,
                mes1: mes1,
                anio2: anio2,
                mes2: mes2,
            },
        });

        this.showCards(mkt.dashboard);

        // Graficos.

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
            subtitle: "Promedio de ventas por día de la semana en el mes seleccionado",
            data: mkt.topWeek
        });



    }


    filterBarDashboard() {
        this.createfilterBar({
            parent: `filterBarDashboard`,
            data: [
                {
                    opc: "select",
                    id: "udn",
                    lbl: "UDN",
                    class: "col-sm-4",
                    data: lsudn,
                    onchange: `salesDashboard.renderDashboard()`,
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
                            onchange="salesDashboard.renderDashboard()"
                        />
                    `
                },
                {
                    opc: "div",
                    id: "containerPeriodo2",
                    lbl: "Comparar con:",
                    class: "col-lg-3 col-sm-4 ",
                    html: `
                        <input 
                            type="month" 
                            id="periodo2" 
                            class="form-control"
                            onchange="salesDashboard.renderDashboard()"
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


    showCards(data) {
        // KPIs visuales
        this.infoCard({
            parent: "cardDashboard",
            theme: "light",
            json: [
                {
                    id: "kpiDia",
                    title: "Venta del día de ayer",
                    data: {
                        value: data.ventaDia,
                        // description: "+12% vs ayer",
                        color: "text-[#8CC63F]",
                    },
                },
                {
                    id: "kpiMes",
                    title: "Venta del Mes",
                    data: {
                        value: data.ventaMes,
                        // description: "+8% vs mes anterior",
                        color: "text-green-800",
                    },
                },
                {
                    title: "Clientes",
                    data: {
                        value: data.Clientes,
                        // description: "+5% vs período anterior",
                        color: "text-[#103B60]",
                    },
                },
                {
                    id: "kpiCheque",
                    title: "Cheque Promedio",
                    data: {
                        value: data.ChequePromedio,
                        // description: "-2% vs período anterior",
                        color: "text-red-600",
                    },
                },
            ],
        });
    }

    // graphigs.

    chequeComparativo(options) {
        const defaults = {
            parent: "containerChequePro",
            id: "chart",
            title: "Comparativa por Categorías",
            class: "border p-4 rounded-xl",
            data: {},
            json: [],
            anioA: new Date().getFullYear(),
            anioB: new Date().getFullYear() - 1,
            onShow: () => { },
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
        window._chq = new Chart(ctx, {
            type: "bar",
            data: {
                labels: opts.data.labels,
                datasets: [
                    {
                        label: `${mes1} ${anio1}`,
                        data: opts.data.A,
                        backgroundColor: "#103B60"
                    },
                    {
                        label: `${mes2} ${anio2}`,
                        data: opts.data.B,
                        backgroundColor: "#8CC63F"
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: {
                    onComplete: function () {
                        const chart = this;
                        const ctx = chart.ctx;
                        ctx.font = "12px sans-serif";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "bottom";
                        ctx.fillStyle = "#000";
                        chart.data.datasets.forEach(function (dataset, i) {
                            const meta = chart.getDatasetMeta(i);
                            meta.data.forEach(function (bar, index) {
                                const value = dataset.data[index];
                                const label = typeof formatPrice === "function" ? formatPrice(value) : value;
                                ctx.fillText(label, bar.x, bar.y - 5);
                            });
                        });
                    }
                },
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
            title: 'Ventas por Día de Semana',
            ...data

        })
    }



    // components.
    dashboardComponent(options) {
        const defaults = {
            parent: "root",
            id: "dashboardComponent",
            title: "📊 Huubie · Dashboard de Eventos",
            subtitle: "Resumen mensual · Cotizaciones · Pagados · Cancelados",
            json: [
                { type: "grafico", id: "barChartContainer", title: "Eventos por sucursal" },
                { type: "tabla", id: "tableSucursal", title: "Tabla de sucursales" },
                { type: "grafico", id: "donutChartContainer", title: "Ventas vs Entrada de dinero" },
                { type: "grafico", id: "topClientsChartContainer", title: "Top 10 clientes" },
                { type: "tabla", id: "tableClientes", title: "Tabla de clientes" }
            ]
        };

        const opts = Object.assign(defaults, options);

        const container = $(`
        <div id="${opts.id}" class="w-full ">
            <!-- Header -->
            <div class="p-6 border-b border-gray-200 ">
                <div class=" mx-auto">
                    <h1 class="text-2xl font-bold text-[#103B60]">${opts.title}</h1>
                    <p class="text-sm text-gray-600">${opts.subtitle}</p>
                </div>
            </div>

            <!-- FilterBar -->
            <div id="filterBarDashboard" class=" mx-auto px-4 py-4">
          
            </div>

             <section id="cardDashboard" class=" mx-auto px-4 py-4">
              
            </section>

            <!-- Content -->
            <section id="content-${opts.id}" class="mx-auto px-4 py-6 grid gap-6 grid-cols-1 md:grid-cols-2"></section>
        </div>`);

        // Renderizar contenedores desde JSON
        opts.json.forEach(item => {
            let block = $("<div>", {
                id: item.id,
                class: "bg-white p-2 rounded-xl shadow-md border border-gray-200 min-h-[200px] w-full"
            });

            if (item.title) {
                const defaultEmojis = {
                    'grafico': '📊',
                    'tabla': '�',
                    'doc': '�',
                    'filterBar': '🔍'
                };

                const emoji = item.emoji || defaultEmojis[item.type] || '';
                const iconHtml = item.icon ? `<i class="${item.icon}"></i> ` : '';
                const titleContent = `${emoji} ${iconHtml}${item.title}`;

                block.prepend(`<h3 class="text-sm font-semibold text-gray-800 mb-3">${titleContent}</h3>`);
            }

            if (item.content && Array.isArray(item.content)) {
                item.content.forEach(contentItem => {
                    const element = $(`<${contentItem.type}>`, {
                        id: contentItem.id || '',
                        class: contentItem.class || '',
                        text: contentItem.text || ''
                    });

                    if (contentItem.attributes) {
                        Object.keys(contentItem.attributes).forEach(attr => {
                            element.attr(attr, contentItem.attributes[attr]);
                        });
                    }

                    if (contentItem.html) {
                        element.html(contentItem.html);
                    }

                    block.append(element);
                });
            }

            $(`#content-${opts.id}`, container).append(block);
        });

        $(`#${opts.parent}`).html(container);
    }

    infoCard(options) {
        const defaults = {
            parent: "root",
            id: "infoCardKPI",
            class: "",
            theme: "light", // light | dark
            json: [],
            data: {
                value: "0",
                description: "",
                color: "text-gray-800"
            },
            onClick: () => { }
        };
        const opts = Object.assign({}, defaults, options);
        const isDark = opts.theme === "dark";
        const cardBase = isDark
            ? "bg-[#1F2A37] text-white rounded-xl shadow"
            : "bg-white text-gray-800 rounded-xl shadow";
        const titleColor = isDark ? "text-gray-300" : "text-gray-600";
        const descColor = isDark ? "text-gray-400" : "text-gray-500";
        const renderCard = (card, i = "") => {
            const box = $("<div>", {
                id: `${opts.id}_${i}`,
                class: `${cardBase} p-4`
            });
            const title = $("<p>", {
                class: `text-sm ${titleColor}`,
                text: card.title
            });
            const value = $("<p>", {
                id: card.id || "",
                class: `text-2xl font-bold ${card.data?.color || "text-white"}`,
                text: card.data?.value
            });
            const description = $("<p>", {
                class: `text-xs mt-1 ${card.data?.color || descColor}`,
                text: card.data?.description
            });
            box.append(title, value, description);
            return box;
        };
        const container = $("<div>", {
            id: opts.id,
            class: `grid grid-cols-2 md:grid-cols-4 gap-4 ${opts.class}`
        });
        if (opts.json.length > 0) {
            opts.json.forEach((item, i) => {
                container.append(renderCard(item, i));
            });
        } else {
            container.append(renderCard(opts));
        }
        $(`#${opts.parent}`).html(container);
    }

    linearChart(options) {
        const defaults = {
            parent: "containerLineChart",
            id: "linearChart",
            title: "",
            class: "border p-4 rounded-xl",
            data: {},   // <- puede contener { labels: [], datasets: [], tooltip: [] }
            json: [],
            onShow: () => { },
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
            class: "border p-4 rounded-xl",
            labels: [],
            dataA: [], // Año anterior
            dataB: [], // Año actual
            yearA: new Date().getFullYear() - 1, // 2024
            yearB: new Date().getFullYear(),     // 2025
        };

        const opts = Object.assign({}, defaults, options);

        // 📦 Crear contenedor
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

        // 🎨 Colores: Azul para período 1 (consulta), Verde para período 2 (comparación)
        const colorPeriodo1 = "#103B60"; // Azul oscuro - Período de consulta
        const colorPeriodo2 = "#8CC63F"; // Verde - Período de comparación

        // 📊 Crear gráfico
        window._barChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: opts.labels,
                datasets: [
                    {
                        label: `Año ${opts.yearB}`, // Período 1 (consulta) - dataA
                        data: opts.dataA,
                        backgroundColor: colorPeriodo1
                    },
                    {
                        label: `Año ${opts.yearA}`, // Período 2 (comparación) - dataB
                        data: opts.dataB,
                        backgroundColor: colorPeriodo2
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
                            label: (ctx) =>
                                `${ctx.dataset.label}: ${formatPrice(ctx.parsed.y)}`
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

    topDiasMes(options) {
        const defaults = {
            parent: "containerTopDias",
            title: "Mejores Días del Mes",
            subtitle: "",
            data: [] // [{fecha, dia, clientes, total, nota}]
        };

        const opts = Object.assign({}, defaults, options);
        const container = $("<div>", { class: "border p-4 rounded-xl bg-white " });

        // Título
        const header = $("<div>", { class: "mb-3" })
            .append($("<h2>", { class: "text-lg font-bold", text: opts.title }))
            .append($("<p>", { class: "text-sm text-gray-500", text: opts.subtitle }));

        // Lista
        const list = $("<div>", { class: "space-y-3" });

        const colores = [
            { bg: "bg-green-100", circle: "bg-green-500 text-white" },
            { bg: "bg-blue-100", circle: "bg-blue-500 text-white" },
            { bg: "bg-purple-100", circle: "bg-purple-500 text-white" },
            { bg: "bg-orange-100", circle: "bg-orange-500 text-white" },
            { bg: "bg-gray-100", circle: "bg-gray-600 text-white" }
        ];

        opts.data.forEach((item, i) => {
            const rank = i + 1;
            const palette = colores[i] || { bg: "bg-white", circle: "bg-gray-300 text-black" };

            // Fila con fondo dinámico
            const row = $("<div>", {
                class: `flex items-center gap-3 p-3 rounded-lg ${palette.bg}`
            });

            // Número ranking con círculo dinámico
            row.append(
                $("<span>", {
                    class: `flex items-center justify-center w-8 h-8 rounded-full font-bold ${palette.circle}`,
                    text: rank
                })
            );

            // Datos
            const content = $("<div>", { class: "flex-1" });
            content.append(
                $("<div>", { class: "flex justify-between" })
                    .append($("<span>", { class: "font-semibold", text: `${item.dia}, ${item.fecha}` }))
                    .append($("<span>", { class: "font-bold", text: formatPrice(item.total) }))
            );
            content.append(
                $("<div>", { class: "text-sm text-gray-600 flex justify-between" })
                    .append($("<span>", { text: `${item.clientes} clientes` }))
                    .append($("<span>", { class: "italic", text: item.nota }))
            );

            row.append(content);
            list.append(row);
        });

        container.append(header, list);
        $("#" + opts.parent).html(container);
    }

    topDiasSemana(options) {
        const defaults = {
            parent: "containerTopDiasSemana",
            title: "📊 Ranking por Promedio Semanal",
            subtitle: "",
            data: [] // [{dia, promedio, veces}]
        };

        const opts = Object.assign({}, defaults, options);
        const container = $("<div>", { class: "border p-4 rounded-xl bg-white " });

        // Título
        const header = $("<div>", { class: "mb-3" })
            .append($("<h2>", { class: "text-lg font-bold", text: opts.title }))
            .append($("<p>", { class: "text-sm text-gray-500", text: opts.subtitle }));

        // Lista
        const list = $("<div>", { class: "space-y-3" });

        const colores = [
            { bg: "bg-green-100", circle: "bg-green-500 text-white" },
            { bg: "bg-blue-100", circle: "bg-blue-500 text-white" },
            { bg: "bg-purple-100", circle: "bg-purple-500 text-white" },
            { bg: "bg-orange-100", circle: "bg-orange-500 text-white" },
            { bg: "bg-pink-100", circle: "bg-pink-500 text-white" },
            { bg: "bg-yellow-100", circle: "bg-yellow-600 text-white" },
            { bg: "bg-gray-100", circle: "bg-gray-600 text-white" }
        ];

        opts.data.forEach((item, i) => {
            const rank = i + 1;
            const palette = colores[i] || { bg: "bg-white", circle: "bg-gray-300 text-black" };

            // Fila con fondo dinámico
            const row = $("<div>", {
                class: `flex items-center gap-3 p-3 rounded-lg ${palette.bg}`
            });

            // Número ranking con círculo dinámico
            row.append(
                $("<span>", {
                    class: `flex items-center justify-center w-8 h-8 rounded-full font-bold ${palette.circle}`,
                    text: rank
                })
            );

            // Datos
            const content = $("<div>", { class: "flex-1" });
            content.append(
                $("<div>", { class: "flex justify-between" })
                    .append($("<span>", { class: "font-semibold", text: item.dia }))
                    .append($("<span>", { class: "font-bold", text: formatPrice(item.promedio) }))
            );
            content.append(
                $("<div>", { class: "text-sm text-gray-600 flex justify-between" })
                    .append($("<span>", { text: `${item.veces} días con ${item.clientes} clientes` }))
                    .append($("<span>", { class: "italic", text: rank === 1 ? "⭐ Mejor día" : "" }))
            );

            row.append(content);
            list.append(row);
        });

        container.append(header, list);
        $("#" + opts.parent).html(container);
    }
}

class Sales extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "sales";
    }

    render() {
        this.layout();
        this.filterBar();
        this.listSales()
    }



    layout() {
        this.primaryLayout({
            parent: `container-sales`,
            id: this.PROJECT_NAME,
            card: {
                filterBar: { class: 'w-full  border-b pb-2 ', id: `filterBar${this.PROJECT_NAME}` },
                container: { class: 'w-full my-2 h-full ', id: `container${this.PROJECT_NAME}` }
            }
        });
    }

    filterBar() {
        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: [
                {
                    opc: "select",
                    id: "udn",
                    lbl: "Seleccionar udn",
                    class: "col-sm-3",
                    data: lsudn,
                    onchange: `sales.listSales()`,
                },
                {
                    opc: "select",
                    id: "anio",
                    lbl: "Año",
                    class: "col-sm-3",
                    data: Array.from({ length: 5 }, (_, i) => {
                        const year = moment().year() - i;
                        return { id: year, valor: year.toString() };
                    }),
                    onchange: `sales.listSales()`,
                },
                {
                    opc: "select",
                    id: "mes",
                    lbl: "Mes",
                    class: "col-sm-3",
                    data: moment.months().map((m, i) => ({ id: i + 1, valor: m })),
                    onchange: `sales.listSales()`,
                },
                {
                    opc: "select",
                    id: "type",
                    lbl: "Consultar",
                    class: "col-sm-3",
                    data: [
                        { id: "3", valor: "Promedios Diarios" },
                        { id: "1", valor: " Ingresos por día" },
                        { id: "2", valor: "Captura de sales" },
                    ],
                    onchange: `sales.listSales()`,
                },
            ],
        });
        const currentMonth = moment().month() + 1; // Mes actual (1-12)
        setTimeout(() => {
            $(`#filterBar${this.PROJECT_NAME} #mes`).val(currentMonth).trigger("change");
        }, 100);
    }

    listSales() {
        const monthText = $("#filterBarsales #mes option:selected").text();
        $("#containersales").html(`
            <div class="px-2 pt-2 pb-2">
                <h2 class="text-2xl font-semibold ">📦 VENTAS DIARIAS</h2>
                <p class="text-gray-400">Consultar y capturar ventas diaria por unidad de negocio (sales)</p>
            </div>
            <div id="container-table-sales"></div>
        `);
        this.createTable({
            parent: "container-table-sales",
            idFilterBar: `filterBarsales`,
            data: { opc: 'list', monthText: monthText },
            coffeesoft: true,
            conf: { datatable: false, pag: 15 },
            attr: {
                id: "tbIngresos",
                theme: 'corporativo',
                color_group: "bg-gray-300",
                // center: [2],
                right: [4]
            },
        });
    }
}

class MonthlySales extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "ComparativaMensual";
    }

    render() {
        this.layout();
        this.filterBar();
        this.lsComparativa();
    }

    layout() {
        this.primaryLayout({
            parent: `container-comparativasMensuales`,
            id: this.PROJECT_NAME,
            card: {
                filterBar: { class: 'w-full  border-b pb-2 ', id: `filterBar${this.PROJECT_NAME}` },
                container: { class: 'w-full my-2 h-full ', id: `container${this.PROJECT_NAME}` }
            }
        });
    }

    filterBar() {
        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: [
                {
                    opc: "select",
                    id: "udn",
                    lbl: "UDN:",
                    class: "col-sm-3",
                    data: lsudn,
                    onchange: `monthlySales.lsComparativa()`,
                },
                {
                    opc: "select",
                    id: "anio",
                    lbl: "Año",
                    class: "col-sm-3",
                    data: [
                        { id: "2025", valor: "2025" },
                        { id: "2024", valor: "2024" },
                        { id: "2023", valor: "2023" },
                    ],
                    onchange: `monthlySales.lsComparativa()`,
                },
                {
                    opc: "select",
                    id: "mes",
                    lbl: "Mes",
                    class: "col-sm-3",
                    data: moment.months().map((m, i) => ({ id: i + 1, valor: m })),
                    onchange: `monthlySales.lsComparativa()`,
                },
                {
                    opc: "select",
                    id: "type",
                    lbl: "Consultar",
                    class: "col-sm-3",
                    data: [
                        { id: "1", valor: "Consulta de promedios" },
                        { id: "2", valor: "Consulta de ingresos" },
                    ],
                    onchange: `monthlySales.lsComparativa()`,
                },
            ],
        });
        setTimeout(() => {
            // $(`#filterBar${this.PROJECT_NAME} #mes`).val(currentMonth).trigger("change");
        }, 100);
    }

    lsComparativa() {
        $(`#container${this.PROJECT_NAME}`).html(`
            <div class="px-2 pt-2 pb-2">
                <h2 class="text-2xl font-semibold ">📦 Comparativas Mensuales </h2>
                <p class="text-gray-400">Consulta las ventas (ingresos) y el cheque promedio (Promedios) mensual contra el año seleccionado. </p>
            </div>
            <div id="container-table-comparativa"></div>
        `);
        this.createTable({
            parent: "container-table-comparativa",
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: 'listComparative' },
            coffeesoft: true,
            conf: { datatable: false, pag: 15 },
            attr: {
                id: "tbIngresos",
                theme: 'corporativo',
                center: [1, 2, 3],
                right: [6]
            },
        });
    }
}

class CumulativeAverages extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "promediosAcumulados";
    }

    render() {
        this.layout();
        this.filterBar();
        this.ls();
    }

    layout() {
        this.primaryLayout({
            parent: `container-promediosAcumulados`,
            id: this.PROJECT_NAME,
            card: {
                filterBar: { class: 'w-full  border-b pb-2 ', id: `filterBar${this.PROJECT_NAME}` },
                container: { class: 'w-full my-2 h-full ', id: `container${this.PROJECT_NAME}` }
            }
        });
    }

    filterBar() {
        const currentMonth = moment().month(); // Índice de mes actual (0-11)
        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: [
                {
                    opc: "select",
                    id: "udn",
                    lbl: "Seleccionar udn",
                    class: "col-sm-3",
                    data: lsudn,
                    onchange: `cumulativeAverages.ls()`,
                },
                {
                    opc: "select",
                    id: "anio",
                    lbl: "Año",
                    class: "col-sm-3",
                    data: Array.from({ length: 5 }, (_, i) => {
                        const year = moment().year() - i;
                        return { id: year, valor: year.toString() };
                    }),
                    onchange: `cumulativeAverages.ls()`,
                },
                {
                    opc: "select",
                    id: "mes",
                    lbl: "Mes",
                    class: "col-sm-3",
                    data: moment.months().map((m, i) => ({
                        id: i + 1,
                        valor: m,
                        selected: i === currentMonth
                    })),
                    onchange: `cumulativeAverages.ls()`,
                },
            ],
        });
        // initialized.
        setTimeout(() => {
            // $(`#filterBar${this.PROJECT_NAME} #mes`).val(currentMonth + 1).trigger("change");
        }, 100);
    }

    ls() {
        $(`#container${this.PROJECT_NAME}`).html(`
            <div class="px-2 pt-2 pb-2">
                <h2 class="text-2xl font-semibold ">📦Ch </h2>
                <p class="text-gray-400">
                Consulta los promedios acumulados del año seleccionado, hasta el mes seleccionado.
                </p>
            </div>
            <div id="container-table-acumulados"></div>
        `);
        this.createTable({
            parent: "container-table-acumulados",
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: 'listAcumulados' },
            coffeesoft: true,
            conf: { datatable: false, pag: 15 },
            attr: {
                id: "tbI",
                theme: 'corporativo',
                center: [1, 2, 3],
                right: [6]
            },
        });
    }
}

```