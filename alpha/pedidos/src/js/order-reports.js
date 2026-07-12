let reports;

$(async () => {
    reports = new OrderReports(api, "root");
});

// Visor de Cierre del Día (SOLO CONSULTA).
// Layout tipo visor: panel izquierdo = lista columnar (FOLIO · TURNOS/HORA · PEDIDOS · TOTAL)
// de los turnos/cierres del periodo; panel derecho = vista previa del reporte.
// NO reimplementa el formato de los reportes: reutiliza los renderers ya probados:
//   - Turno          -> app.ticketShiftClose({..., containerId})        (Cierre x Turno)
//   - Corte Z (dia)  -> cierre.renderExecutiveSummary(res, containerId)  (Corte Z)
// El ticket interno de ambos lleva id #ticketDailyClose, por eso Imprimir delega en
// cierre.printDaily() sin distinguir el tipo.
class OrderReports extends Templates {
    // Ancho compartido: el panel izquierdo (lista de folios) y el control
    // "Período de consulta" miden lo mismo, por eso el valor vive en un solo lugar.
    static LIST_WIDTH = 440;

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "OrderReports";
        this.reportType = "cierre";  // 'turno' | 'cierre'
        this.reportMode = "summary"; // 'summary' | 'detailed' (solo Turno)
        this.periodMode = "fecha";   // 'fecha' | 'rango'
        this.items = [];
        this.selectedKey = null;
    }

    render() {
        this.layout();
    }

    layout() {
        this.createLayout({
            parent: "container-reportes",
            design: false,
            data: {
                id: this.PROJECT_NAME,
                class: 'flex',
                container: [
                    {
                        type: "div",
                        id: "singleLayout" + this.PROJECT_NAME,
                        class: "flex flex-col col-12",
                        children: [
                            { type: "div", class: 'w-full', id: 'header' + this.PROJECT_NAME },
                            { type: "div", class: 'w-full  mb-4', id: 'filterBar' + this.PROJECT_NAME },
                            { type: "div", class: 'w-full', id: 'container' + this.PROJECT_NAME }
                        ]
                    }
                ]
            }
        });

        this.renderHeader();
        this.createFilterBar();
        this.renderBody();
        this.bindEvents();
        this.loadList();
    }

    // Titulo del visor: div propio dentro del createLayout, separado del filterBar.
    renderHeader() {
        $(`#header${this.PROJECT_NAME}`).html(`
            <div class="flex items-center gap-3 px-1 pt-2 pb-3">
                <button onclick="app.render()" title="Volver a Pedidos"
                    class="flex items-center justify-center w-9 h-9 rounded-full border border-gray-700 bg-[#1F2A37] text-gray-400 hover:text-white hover:border-gray-500 transition-colors flex-shrink-0">
                    ${lucideIcon('arrow-left', 'w-4 h-4')}
                </button>
                <div>
                    <h2 class="text-xl font-bold text-white leading-tight">Visor de Cierre del Día</h2>
                    <p class="text-gray-500 text-xs">Cortes Z, turnos y recepciones por sucursal.</p>
                </div>
            </div>
        `);
    }

    // === Filter bar (componente del framework) ===
    // "Período de consulta" es un control compuesto (radios Fecha/Rango + su calendario
    // inline) que el filterBar no trae de fabrica. Se declara con `opc: "div"`, que cae en
    // el `default` de content_json_form y crea el elemento con los atributos del objeto.
    createFilterBar() {
        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: [
                {
                    opc: "div",
                    id: "periodGroup",
                    lbl: "Período de consulta",
                    // col-auto: la columna se ajusta al pill, que va fijo al ancho del
                    // panel "Cortes Z" (OrderReports.LIST_WIDTH).
                    class: "col-auto",
                },
                {
                    opc: "select",
                    id: "reportSucursal",
                    lbl: "Sucursal",
                    class: "col-12 col-md-3 col-lg-2",
                    data: lsSucursales,
                    onchange: "reports.loadList()",
                },
                {
                    opc: "select",
                    id: "reportType",
                    lbl: "Tipo de Reporte",
                    class: "col-12 col-md-3 col-lg-2",
                    data: [
                        { id: "cierre", valor: "Cierre diario — Corte Z" },
                        { id: "turno", valor: "Cierre de turno — Corte X" },
                    ],
                    onchange: "reports.changeReportType()",
                },
                {
                    opc: "button",
                    id: "btnPrintReport",
                    text: "Imprimir",
                    icon: "icon-print",
                    class: "col-12 col-md-3 col-lg-2",
                    className: "w-100",
                    color_btn: "primary",
                    onClick: () => this.printReport(),
                },
            ],
        });

        // El `default` de content_json_form copia los atributos del objeto al elemento, asi
        // que #periodGroup nace con las clases de columna duplicadas: se limpian y se pinta
        // el control compuesto dentro (los ids reportFecha/reportRango los toma dataPicker).
        //
        // El wrapper reusa las MISMAS clases que el framework da a sus campos
        // (`form-control input-sm bg-[#1F2A37]`), asi hereda padding, borde, radio, alto y
        // ancho (100% de la columna) => alinea exacto con Sucursal / Tipo de Reporte.
        // Altura EXACTA del .form-select/.form-control de Bootstrap:
        //   line-height 1.5 * 1rem + padding .375rem*2 + borde 1px*2  ->  calc(1.5em + .75rem + 2px)
        // Se anula el padding vertical y se fija la altura para que los radios/inputs internos
        // no empujen la caja; el ancho lo da el 100% de la columna, igual que Sucursal.
        const periodBoxStyle = `height: calc(1.5em + 0.75rem + 2px); padding-top: 0; padding-bottom: 0; width: ${OrderReports.LIST_WIDTH}px;`;
        const innerReset = "height: 100%; line-height: 1;";

        $("#periodGroup").attr("class", "").html(`
            <div class="form-control input-sm bg-[#1F2A37] d-flex align-items-center gap-2" style="${periodBoxStyle}">
                <label class="d-flex align-items-center gap-1 text-sm text-gray-200 cursor-pointer whitespace-nowrap mb-0" style="${innerReset}">
                    <input type="radio" name="reportPeriodMode" value="fecha" class="accent-blue-500 m-0" checked
                        onchange="reports.setPeriodMode('fecha')"> Fecha
                </label>
                <label class="d-flex align-items-center gap-1 text-sm text-gray-200 cursor-pointer whitespace-nowrap mb-0" style="${innerReset}">
                    <input type="radio" name="reportPeriodMode" value="rango" class="accent-blue-500 m-0"
                        onchange="reports.setPeriodMode('rango')"> Rango
                </label>
                <span class="w-px bg-gray-600 flex-shrink-0" style="height: 16px;"></span>
                <input type="text" id="reportFecha"
                    class="period-fecha flex-1 min-w-0 bg-transparent text-white text-sm border-0 outline-none p-0 m-0" style="${innerReset}" />
                <input type="text" id="reportRango"
                    class="period-rango flex-1 min-w-0 bg-transparent text-white text-sm border-0 outline-none p-0 m-0" style="${innerReset}" />
                <span class="text-gray-400 flex-shrink-0 d-flex align-items-center">${lucideIcon('calendar', 'w-4 h-4')}</span>
            </div>
        `);

        // type 'simple' => singleDatePicker + autoApply (sin botones Aplicar/Cancelar).
        dataPicker({
            parent: "reportFecha",
            type: "simple",
            onSelect: () => this.loadList(),
        });

        dataPicker({
            parent: "reportRango",
            type: "all",
            rangepicker: {
                startDate: moment().subtract(6, "days"),
                endDate: moment(),
                showDropdowns: true,
                ranges: {
                    "Hoy": [moment(), moment()],
                    "Últimos 7 días": [moment().subtract(6, "days"), moment()],
                    "Mes actual": [moment().startOf("month"), moment()],
                    "Mes anterior": [moment().subtract(1, "month").startOf("month"), moment().subtract(1, "month").endOf("month")],
                },
                locale: { format: "DD-MM-YYYY" },
            },
            onSelect: () => this.loadList(),
        });

        this.applyPeriodMode();
    }

    // Muestra el calendario que corresponde al modo de periodo activo.
    applyPeriodMode() {
        $(".period-fecha").toggle(this.periodMode === "fecha");
        $(".period-rango").toggle(this.periodMode === "rango");
    }

    setPeriodMode(mode) {
        this.periodMode = mode;
        this.applyPeriodMode();
        this.loadList();
    }

    changeReportType() {
        this.reportType = $("#reportType").val();
        $("#reportListTitle").text(this.reportType === "turno" ? "Turnos" : "Cortes Z");
        this.loadList();
    }

    // === Cuerpo: lista (izq) + preview (der) ===
    renderBody() {
        $(`#container${this.PROJECT_NAME}`).html(`
            <div class="flex gap-4" style="height: calc(100vh - 190px)">
                <!-- Panel izquierdo -->
                <div style="width: ${OrderReports.LIST_WIDTH}px" class="flex-shrink-0 bg-[#1F2A37] rounded-xl flex flex-col overflow-hidden">
                    <div class="p-3 border-b border-gray-700">
                        <div class="flex items-center gap-2 mb-2">
                            <i class="icon-doc-text text-blue-400"></i>
                            <span id="reportListTitle" class="text-sm font-bold text-white flex-1">Cortes Z</span>
                            <span id="reportListCount" class="text-[11px] text-gray-400">0 resultados</span>
                        </div>
                        <div class="relative">
                            <i class="icon-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
                            <input type="text" id="reportSearch" placeholder="Buscar por folio o fecha..."
                                class="w-full bg-[#111827] border border-gray-700 text-white text-sm rounded-lg pl-8 pr-3 py-2 outline-none" />
                        </div>
                    </div>
                    <!-- Encabezado de columnas -->
                    <div id="reportListHead" class="grid grid-cols-[1fr_62px_66px_104px] gap-1 px-3 py-2 border-b border-gray-700/60 text-[10px] font-semibold text-gray-500 uppercase tracking-wide"></div>
                    <div id="reportList" class="flex-1 overflow-y-auto"></div>
                </div>

                <!-- Panel derecho -->
                <div class="flex-1 bg-[#1F2A37] rounded-xl flex flex-col overflow-hidden">
                    <div class="flex items-center justify-between p-3 border-b border-gray-700">
                        <span class="text-sm text-gray-400">Vista previa de impresión</span>
                        <div id="reportModeBar" class="inline-flex bg-[#111827] rounded-lg p-0.5">
                            <button id="btnRepSummary" class="px-3 py-1 rounded-md text-sm font-semibold bg-purple-600 text-white" onclick="reports.setReportMode('summary')">Resumido</button>
                            <button id="btnRepDetailed" class="px-3 py-1 rounded-md text-sm font-semibold text-gray-400 hover:text-gray-200" onclick="reports.setReportMode('detailed')">Detallado</button>
                        </div>
                    </div>
                    <div id="reportPreview" class="flex-1 overflow-y-auto p-4"></div>
                </div>
            </div>
        `);

        this.emptyPreview("Selecciona un elemento de la lista para ver su reporte.");
    }

    // Los controles del filterBar (radios, calendarios, selects, boton) ya enganchan
    // sus handlers via createfilterBar/dataPicker; aqui solo queda el buscador de la lista.
    bindEvents() {
        $("#reportSearch").off("input").on("input", () => this.renderList());
    }

    // Fechas del periodo (array de YYYY-MM-DD). En modo 'fecha' el picker es
    // singleDatePicker, asi que fi === ff y devuelve un solo dia.
    getReportDates() {
        const id = this.periodMode === "fecha" ? "reportFecha" : "reportRango";
        if (!$("#" + id).data("daterangepicker")) return [];

        const { fi, ff } = getDataRangePicker(id);
        const dates = [];
        const cursor = moment(fi);
        const end = moment(ff);
        while (cursor.isSameOrBefore(end, "day") && dates.length < 92) {
            dates.push(cursor.format("YYYY-MM-DD"));
            cursor.add(1, "day");
        }
        return dates;
    }

    getSubsidiaryId() {
        return $("#reportSucursal").val() || null;
    }

    getSubsidiaryName() {
        return $("#reportSucursal option:selected").text() || "";
    }

    // Columnas del encabezado segun tipo de reporte.
    columnsFor() {
        return this.reportType === "turno"
            ? ["FOLIO", "TURNO", "PEDIDOS", "TOTAL"]
            : ["FOLIO", "TURNOS", "PEDIDOS", "TOTAL CAJA"];
    }

    // === Carga de la lista ===
    async loadList() {
        const dates = this.getReportDates();
        const subsidiaries_id = this.getSubsidiaryId();

        // Encabezado de columnas.
        $("#reportListHead").html(this.columnsFor().map((c, i) =>
            `<span class="${i === 0 ? "" : "text-right"}">${c}</span>`).join(""));

        $("#reportList").html(`<div class="text-center text-gray-500 py-8 text-sm">Cargando...</div>`);
        this.selectedKey = null;

        if (!dates.length) {
            this.items = [];
            this.renderList();
            this.emptyPreview("Selecciona una fecha o rango.");
            return;
        }

        this.items = this.reportType === "turno"
            ? await this.fetchTurnos(dates, subsidiaries_id)
            : await this.fetchCierres(dates, subsidiaries_id);

        this.renderList();

        if (this.items.length) {
            this.selectItem(this.items[0].key);
        } else {
            this.emptyPreview(this.reportType === "turno"
                ? "No hay turnos en este período."
                : "No hay cortes Z en este período.");
        }
    }

    async fetchTurnos(dates, subsidiaries_id) {
        const subName = this.getSubsidiaryName();
        const results = await Promise.all(dates.map(date =>
            useFetch({ url: api, data: { opc: "getShiftsByDate", date, subsidiaries_id } })
                .then(r => ({ date, shifts: r.shifts || [] }))
        ));

        const items = [];
        results.forEach(({ date, shifts }) => {
            shifts.forEach(s => {
                const caja = parseFloat(s.total_sales || 0)
                    || (parseFloat(s.cash || 0) + parseFloat(s.card || 0) + parseFloat(s.transfer || 0));
                items.push({
                    key: `turno:${s.id}`,
                    type: "turno",
                    id: s.id,
                    date,
                    folio: "TN-" + String(s.id).padStart(5, "0"),
                    hora: moment(s.opened_at).format("hh:mm A"),
                    sub1: s.employee_name || "Sin vendedor",
                    sub2: moment(s.opened_at).locale("es").format("DD/MM/YYYY") + " · " + subName,
                    col2: moment(s.opened_at).format("HH:mm"),  // TURNO (hora inicio)
                    col3: parseInt(s.total_orders || 0),        // PEDIDOS
                    col4: caja,                                 // TOTAL
                    status: s.status,
                    raw: s,
                });
            });
        });
        items.sort((a, b) => moment(b.raw.opened_at) - moment(a.raw.opened_at));
        return items;
    }

    async fetchCierres(dates, subsidiaries_id) {
        const subName = this.getSubsidiaryName();
        const results = await Promise.all(dates.map(date =>
            useFetch({ url: apiCierre, data: { opc: "getCierre", date, subsidiaries_id } })
                .then(res => ({ date, res }))
        ));

        const items = [];
        results.forEach(({ date, res }) => {
            if (res.status === 200 && res.closure) {
                const c = res.closure;
                const rShifts = (res.report && res.report.shifts) || res.shifts || [];
                const totalCaja = rShifts.reduce((t, s) =>
                    t + parseFloat(s.efectivo || 0) + parseFloat(s.tarjeta || 0) + parseFloat(s.transferencia || 0), 0);
                const pedidos = (res.orders || []).length;
                const horaCierre = c.created_at ? moment(c.created_at).format("hh:mm A") : "";

                items.push({
                    key: `cierre:${date}`,
                    type: "cierre",
                    id: c.id,
                    date,
                    folio: "#" + String(c.id || 0).padStart(3, "0"),
                    hora: horaCierre,
                    sub1: "",
                    sub2: moment(date).format("DD/MM/YYYY") + " · " + subName,
                    col2: rShifts.length,   // TURNOS
                    col3: pedidos,          // PEDIDOS
                    col4: totalCaja,        // TOTAL CAJA
                    status: "closed",
                    raw: res,
                });
            }
        });
        items.sort((a, b) => moment(b.date) - moment(a.date));
        return items;
    }

    // === Render de la lista columnar ===
    renderList() {
        const q = ($("#reportSearch").val() || "").toLowerCase().trim();
        const filtered = q
            ? this.items.filter(i => (i.folio + " " + i.sub1 + " " + i.sub2).toLowerCase().includes(q))
            : this.items;

        $("#reportListCount").text(`${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`);

        if (!filtered.length) {
            $("#reportList").html(`<div class="text-center text-gray-500 py-8 text-sm">Sin resultados</div>`);
            return;
        }

        const dot = (st) => st === "open"
            ? `<span class="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse flex-shrink-0"></span>`
            : `<span class="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0"></span>`;

        const unitFor = this.reportType === "turno" ? "" : "TURN";

        const rowHtml = (i) => {
            const active = i.key === this.selectedKey;
            return `
                <button type="button"
                    class="w-full text-left grid grid-cols-[1fr_62px_66px_104px] gap-1 items-center px-3 py-2.5 border-l-2 border-b border-gray-800 transition-colors ${active ? "border-l-purple-500 bg-purple-600/10" : "border-l-transparent hover:bg-[#111827]"}"
                    onclick="reports.selectItem('${i.key}')">
                    <div class="min-w-0">
                        <div class="flex items-center gap-1.5">
                            ${dot(i.status)}
                            <span class="text-sm font-bold text-white">${i.folio}</span>
                            <span class="text-[10px] text-gray-500">${i.hora}</span>
                        </div>
                        <div class="text-[10px] text-gray-400 truncate mt-0.5">${i.sub1 ? i.sub1 + " · " : ""}${i.sub2}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-sm font-semibold text-white leading-none">${i.col2}</div>
                        <div class="text-[9px] text-gray-500 uppercase">${unitFor}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-sm font-semibold text-white leading-none">${i.col3}</div>
                        <div class="text-[9px] text-gray-500 uppercase">PED</div>
                    </div>
                    <div class="text-right">
                        <div class="text-sm font-semibold ${i.col4 ? "text-green-400" : "text-gray-500"} leading-none">${formatPrice(i.col4)}</div>
                        <div class="text-[9px] text-gray-500 uppercase">MXN</div>
                    </div>
                </button>
            `;
        };

        // En modo Rango la lista se separa por dia (los items ya vienen ordenados desc,
        // asi que basta con agruparlos en el orden en que aparecen).
        const html = this.periodMode === "rango"
            ? this.groupByDate(filtered).map(g => `
                <div class="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 bg-[#161f2b] border-b border-gray-800">
                    <span class="text-gray-500 flex-shrink-0 d-flex">${lucideIcon('calendar', 'w-3 h-3')}</span>
                    <span class="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                        ${moment(g.date).locale("es").format("dddd DD [de] MMMM [de] YYYY")}
                    </span>
                    <span class="ml-auto text-[10px] text-gray-500">${g.items.length}</span>
                </div>
                ${g.items.map(rowHtml).join("")}
            `).join("")
            : filtered.map(rowHtml).join("");

        $("#reportList").html(html);
    }

    // Agrupa los items por su fecha respetando el orden de entrada.
    groupByDate(items) {
        const groups = [];
        items.forEach(i => {
            const g = groups.find(x => x.date === i.date);
            if (g) g.items.push(i);
            else groups.push({ date: i.date, items: [i] });
        });
        return groups;
    }

    // === Seleccion -> render del reporte ===
    selectItem(key) {
        this.selectedKey = key;
        this.renderList();

        const item = this.items.find(i => i.key === key);
        if (!item) return;

        if (item.type === "turno") this.renderTurnoReport(item);
        else this.renderCierreReport(item);
    }

    async renderTurnoReport(item) {
        $("#reportModeBar").show();
        app.reportMode = this.reportMode; // ticketShiftClose lee app.reportMode
        this.loadingPreview("Cargando ticket del turno...");

        const metricsRes = await useFetch({ url: api, data: { opc: "getShiftMetrics", shift_id: item.id } });
        if (metricsRes.status !== 200) {
            this.emptyPreview(metricsRes.message || "Error al obtener el turno.");
            return;
        }

        let orders = [], externalPayments = [], crossPayments = [];
        if (this.reportMode === "detailed") {
            const ordersRes = await useFetch({ url: api, data: { opc: "getShiftOrders", shift_id: item.id } });
            orders           = ordersRes.orders || [];
            externalPayments = ordersRes.external_payments || [];
            crossPayments    = ordersRes.cross_payments || [];
        }

        app.ticketShiftClose({
            data: metricsRes.data,
            shift: metricsRes.shift,
            subsidiary_name: metricsRes.subsidiary_name,
            company_name: metricsRes.company_name,
            logo: metricsRes.logo,
            orders,
            externalPayments,
            crossPayments,
            containerId: "reportPreview",
        });
    }

    renderCierreReport(item) {
        $("#reportModeBar").hide(); // el Corte Z siempre es completo
        cierre.renderExecutiveSummary(item.raw, "reportPreview");
    }

    setReportMode(mode) {
        this.reportMode = mode;
        $("#btnRepSummary").toggleClass("bg-purple-600 text-white", mode === "summary").toggleClass("text-gray-400 hover:text-gray-200", mode !== "summary");
        $("#btnRepDetailed").toggleClass("bg-purple-600 text-white", mode === "detailed").toggleClass("text-gray-400 hover:text-gray-200", mode !== "detailed");

        const item = this.items.find(i => i.key === this.selectedKey);
        if (item && item.type === "turno") this.renderTurnoReport(item);
    }

    printReport() {
        if (!document.getElementById("ticketDailyClose")) {
            alert({ icon: "warning", title: "Sin contenido", text: "Selecciona un reporte antes de imprimir.", btn1: true, btn1Text: "Aceptar" });
            return;
        }
        cierre.printDaily();
    }

    emptyPreview(msg) {
        $("#reportPreview").html(`
            <div class="flex flex-col items-center justify-center h-full text-gray-500 py-16">
                <i class="icon-doc-text text-5xl mb-3"></i>
                <p class="text-sm">${msg}</p>
            </div>
        `);
    }

    loadingPreview(msg) {
        $("#reportPreview").html(`
            <div class="flex flex-col items-center justify-center h-full text-gray-400 py-16">
                <div class="animate-spin w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full mb-4"></div>
                <p class="text-sm">${msg}</p>
            </div>
        `);
    }
}
