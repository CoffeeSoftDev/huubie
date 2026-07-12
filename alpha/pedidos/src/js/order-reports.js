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
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "OrderReports";
        this.reportType = "cierre";  // 'turno' | 'cierre'
        this.reportMode = "summary"; // 'summary' | 'detailed' (solo Turno)
        this.periodMode = "rango";   // 'rango' | 'fecha'  (rango por defecto -> lista poblada)
        this.items = [];
        this.selectedKey = null;
    }

    render() {
        this.layout();
    }

    layout() {
        this.primaryLayout({
            parent: "container-reportes",
            id: this.PROJECT_NAME,
            class: "w-full",
            card: {
                filterBar: { class: "w-full", id: "filterBar" + this.PROJECT_NAME },
                container: { class: "w-full h-full", id: "container" + this.PROJECT_NAME },
            },
        });

        this.renderToolbar();
        this.renderBody();
        this.bindEvents();
        this.loadList();
    }

    // === Barra superior ===
    renderToolbar() {
        const hoy = moment().format("YYYY-MM-DD");
        const sucursalOptions = (lsSucursales || [])
            .map(s => `<option value="${s.id}">${s.valor}</option>`)
            .join("");

        $(`#filterBar${this.PROJECT_NAME}`).html(`
            <div class="flex items-center gap-3 px-1 pt-2 pb-3">
                <button onclick="app.render()" class="text-gray-400 hover:text-white text-xl leading-none">&larr;</button>
                <div>
                    <h2 class="text-xl font-bold text-white leading-tight">Visor de Cierre del Día</h2>
                    <p class="text-gray-500 text-xs">Cortes Z, turnos y recepciones por sucursal.</p>
                </div>
            </div>

            <div class="flex flex-wrap items-end gap-3 border-b border-gray-700/60 pb-3 mb-3">
                <!-- Periodo -->
                <div>
                    <label class="block text-[11px] font-semibold text-gray-400 mb-1">Período de consulta</label>
                    <div class="flex items-center gap-2 bg-[#111827] border border-gray-700 rounded-lg px-3 py-2 h-[42px]">
                        <label class="flex items-center gap-1.5 text-sm text-gray-200 cursor-pointer">
                            <input type="radio" name="reportPeriodMode" value="rango" class="accent-blue-500" checked> Rango
                        </label>
                        <label class="flex items-center gap-1.5 text-sm text-gray-200 cursor-pointer">
                            <input type="radio" name="reportPeriodMode" value="fecha" class="accent-blue-500"> Fecha
                        </label>
                        <span class="w-px h-5 bg-gray-700"></span>
                        <i class="icon-calendar text-gray-500 text-sm"></i>
                        <input type="date" id="reportFecha" value="${hoy}"
                            class="hidden bg-transparent text-white text-sm outline-none" />
                        <input type="text" id="reportRango" placeholder="Rango"
                            class="bg-transparent text-white text-sm outline-none min-w-[180px]" />
                    </div>
                </div>

                <!-- Sucursal -->
                <div>
                    <label class="block text-[11px] font-semibold text-gray-400 mb-1">Sucursal</label>
                    <select id="reportSucursal"
                        class="bg-[#111827] border border-gray-700 text-white rounded-lg px-3 h-[42px] text-sm min-w-[220px]">
                        ${sucursalOptions}
                    </select>
                </div>

                <!-- Tipo de reporte -->
                <div>
                    <label class="block text-[11px] font-semibold text-gray-400 mb-1">Tipo de Reporte</label>
                    <select id="reportType"
                        class="bg-[#111827] border border-gray-700 text-white rounded-lg px-3 h-[42px] text-sm min-w-[180px]">
                        <option value="cierre">Corte Z</option>
                        <option value="turno">Turno</option>
                    </select>
                </div>

                <div class="flex-1"></div>

                <button id="btnPrintReport"
                    class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 h-[42px] rounded-lg flex items-center gap-2">
                    <i class="icon-print"></i> Imprimir
                </button>
            </div>
        `);

        this.initRangePicker();
    }

    initRangePicker() {
        $("#reportRango").daterangepicker({
            startDate: moment().subtract(6, "days"),
            endDate: moment(),
            locale: {
                format: "DD/MM/YYYY",
                separator: " — ",
                applyLabel: "Aplicar",
                cancelLabel: "Cancelar",
                daysOfWeek: ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"],
                monthNames: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
            },
        }, () => this.loadList());
    }

    // === Cuerpo: lista (izq) + preview (der) ===
    renderBody() {
        $(`#container${this.PROJECT_NAME}`).html(`
            <div class="flex gap-4" style="height: calc(100vh - 190px)">
                <!-- Panel izquierdo -->
                <div class="w-[340px] flex-shrink-0 bg-[#1F2A37] border border-gray-700 rounded-xl flex flex-col overflow-hidden">
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
                    <div id="reportListHead" class="grid grid-cols-[1fr_50px_54px_86px] gap-1 px-3 py-2 border-b border-gray-700/60 text-[10px] font-semibold text-gray-500 uppercase tracking-wide"></div>
                    <div id="reportList" class="flex-1 overflow-y-auto"></div>
                </div>

                <!-- Panel derecho -->
                <div class="flex-1 bg-[#1F2A37] border border-gray-700 rounded-xl flex flex-col overflow-hidden">
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

    bindEvents() {
        $(`input[name="reportPeriodMode"]`).off("change").on("change", (e) => {
            this.periodMode = e.target.value;
            $("#reportFecha").toggleClass("hidden", this.periodMode === "rango");
            $("#reportRango").toggleClass("hidden", this.periodMode === "fecha");
            this.loadList();
        });

        $("#reportFecha").off("change").on("change", () => this.loadList());
        $("#reportSucursal").off("change").on("change", () => this.loadList());
        $("#reportType").off("change").on("change", (e) => {
            this.reportType = e.target.value;
            $("#reportListTitle").text(this.reportType === "turno" ? "Turnos" : "Cortes Z");
            this.loadList();
        });
        $("#reportSearch").off("input").on("input", () => this.renderList());
        $("#btnPrintReport").off("click").on("click", () => this.printReport());
    }

    getReportDates() {
        if (this.periodMode === "fecha") {
            const d = $("#reportFecha").val();
            return d ? [d] : [];
        }
        const rp = $("#reportRango").data("daterangepicker");
        if (!rp) return [];
        const dates = [];
        const cursor = rp.startDate.clone();
        while (cursor.isSameOrBefore(rp.endDate, "day") && dates.length < 92) {
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

        const html = filtered.map(i => {
            const active = i.key === this.selectedKey;
            return `
                <button type="button"
                    class="w-full text-left grid grid-cols-[1fr_50px_54px_86px] gap-1 items-center px-3 py-2.5 border-l-2 border-b border-gray-800 transition-colors ${active ? "border-l-purple-500 bg-purple-600/10" : "border-l-transparent hover:bg-[#111827]"}"
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
        }).join("");

        $("#reportList").html(html);
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
