let reports;

$(async () => {
    reports = new OrderReports(api, "root");
});

// Visor de Reportes de Cierre (SOLO CONSULTA).
// Layout tipo visor: panel izquierdo con la lista de turnos/cierres del periodo y
// panel derecho con la vista previa del reporte. NO reimplementa el formato de los
// reportes: reutiliza los renderers ya probados de alpha/pedidos:
//   - Turno         -> app.ticketShiftClose({..., containerId})   (Cierre x Turno)
//   - Cierre del Dia -> cierre.renderExecutiveSummary(res, containerId)  (Corte Z)
// El ticket interno de ambos lleva el id #ticketDailyClose, por eso Imprimir delega
// en cierre.printDaily() sin distinguir el tipo.
class OrderReports extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "OrderReports";
        this.reportType = "turno";   // 'turno' | 'cierre'
        this.reportMode = "summary"; // 'summary' | 'detailed' (solo aplica a Turno)
        this.periodMode = "fecha";   // 'fecha' | 'rango'
        this.items = [];             // items de la lista actual
        this.selectedKey = null;     // id de turno o fecha de cierre seleccionado
        this._cierreCache = {};      // date -> respuesta getCierre (para no re-consultar)
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

    // === Barra superior: titulo + periodo + sucursal + tipo de reporte + imprimir ===
    renderToolbar() {
        const hoy = moment().format("YYYY-MM-DD");
        const sucursalOptions = (lsSucursales || [])
            .map(s => `<option value="${s.id}">${s.valor}</option>`)
            .join("");

        $(`#filterBar${this.PROJECT_NAME}`).html(`
            <div class="px-1 pt-2 pb-3">
                <h2 class="text-2xl font-semibold text-white">Visor de Cierre del Día</h2>
                <p class="text-gray-400 text-sm">Cortes Z, turnos y recepciones por sucursal.</p>
            </div>

            <div class="flex flex-wrap items-end gap-3 border-b border-gray-700 pb-3 mb-3">
                <!-- Periodo -->
                <div>
                    <label class="block text-xs font-semibold text-gray-400 mb-1">Período de consulta</label>
                    <div class="flex items-center gap-2 bg-[#1F2A37] border border-gray-700 rounded-lg px-3 py-2">
                        <label class="flex items-center gap-1.5 text-sm text-gray-200 cursor-pointer">
                            <input type="radio" name="reportPeriodMode" value="rango" class="accent-blue-500"> Rango
                        </label>
                        <label class="flex items-center gap-1.5 text-sm text-gray-200 cursor-pointer">
                            <input type="radio" name="reportPeriodMode" value="fecha" class="accent-blue-500" checked> Fecha
                        </label>
                        <span class="w-px h-5 bg-gray-700"></span>
                        <input type="date" id="reportFecha" value="${hoy}"
                            class="bg-transparent text-white text-sm outline-none" />
                        <input type="text" id="reportRango" placeholder="Rango"
                            class="hidden bg-transparent text-white text-sm outline-none min-w-[190px]" />
                    </div>
                </div>

                <!-- Sucursal -->
                <div>
                    <label class="block text-xs font-semibold text-gray-400 mb-1">Sucursal</label>
                    <select id="reportSucursal"
                        class="bg-[#1F2A37] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm min-w-[200px]">
                        ${sucursalOptions}
                    </select>
                </div>

                <!-- Tipo de reporte -->
                <div>
                    <label class="block text-xs font-semibold text-gray-400 mb-1">Tipo de Reporte</label>
                    <select id="reportType"
                        class="bg-[#1F2A37] border border-gray-700 text-white rounded-lg px-3 py-2 text-sm min-w-[180px]">
                        <option value="turno">Turno</option>
                        <option value="cierre">Cierre del Día</option>
                    </select>
                </div>

                <div class="flex-1"></div>

                <button id="btnPrintReport"
                    class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-lg flex items-center gap-2">
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

    // === Cuerpo: lista (izquierda) + vista previa (derecha) ===
    renderBody() {
        $(`#container${this.PROJECT_NAME}`).html(`
            <div class="flex gap-4 h-full">
                <!-- Panel izquierdo: lista -->
                <div class="w-[320px] flex-shrink-0 bg-[#1F2A37] border border-gray-700 rounded-xl flex flex-col overflow-hidden">
                    <div class="p-3 border-b border-gray-700">
                        <div class="flex items-center justify-between mb-2">
                            <span id="reportListTitle" class="text-sm font-bold text-white">Turnos</span>
                            <span id="reportListCount" class="text-[11px] text-gray-400">0 resultados</span>
                        </div>
                        <div class="relative">
                            <i class="icon-search absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm"></i>
                            <input type="text" id="reportSearch" placeholder="Buscar por folio o fecha..."
                                class="w-full bg-[#111827] border border-gray-700 text-white text-sm rounded-lg pl-8 pr-3 py-2 outline-none" />
                        </div>
                    </div>
                    <div id="reportList" class="flex-1 overflow-y-auto p-2 space-y-1"></div>
                </div>

                <!-- Panel derecho: preview -->
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

        this.emptyPreview("Selecciona un turno de la lista para ver su reporte.");
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
            $("#reportListTitle").text(this.reportType === "turno" ? "Turnos" : "Cierres del Día");
            this.loadList();
        });
        $("#reportSearch").off("input").on("input", () => this.renderList());
        $("#btnPrintReport").off("click").on("click", () => this.printReport());
    }

    // Fechas del periodo seleccionado (array de YYYY-MM-DD).
    getReportDates() {
        if (this.periodMode === "fecha") {
            const d = $("#reportFecha").val();
            return d ? [d] : [];
        }
        const rp = $("#reportRango").data("daterangepicker");
        if (!rp) return [];
        const dates = [];
        const cursor = rp.startDate.clone();
        // Tope de seguridad: 92 dias, para no disparar cientos de peticiones.
        while (cursor.isSameOrBefore(rp.endDate, "day") && dates.length < 92) {
            dates.push(cursor.format("YYYY-MM-DD"));
            cursor.add(1, "day");
        }
        return dates;
    }

    getSubsidiaryId() {
        return $("#reportSucursal").val() || null;
    }

    // === Carga de la lista segun tipo de reporte ===
    async loadList() {
        const dates = this.getReportDates();
        const subsidiaries_id = this.getSubsidiaryId();

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
                : "No hay cierres de día en este período.");
        }
    }

    async fetchTurnos(dates, subsidiaries_id) {
        const results = await Promise.all(dates.map(date =>
            useFetch({ url: api, data: { opc: "getShiftsByDate", date, subsidiaries_id } })
                .then(r => ({ date, shifts: r.shifts || [] }))
        ));

        const items = [];
        results.forEach(({ date, shifts }) => {
            shifts.forEach(s => items.push({
                key: `turno:${s.id}`,
                type: "turno",
                id: s.id,
                date,
                title: moment(s.opened_at).format("hh:mm A"),
                subtitle: moment(s.opened_at).locale("es").format("DD [de] MMMM YYYY"),
                status: s.status,
                raw: s,
            }));
        });
        // Mas reciente primero.
        items.sort((a, b) => moment(b.raw.opened_at) - moment(a.raw.opened_at));
        return items;
    }

    async fetchCierres(dates, subsidiaries_id) {
        const results = await Promise.all(dates.map(date =>
            useFetch({ url: apiCierre, data: { opc: "getCierre", date, subsidiaries_id } })
                .then(res => ({ date, res }))
        ));

        const items = [];
        results.forEach(({ date, res }) => {
            if (res.status === 200 && res.closure) {
                this._cierreCache[date] = res;
                const c = res.closure;
                items.push({
                    key: `cierre:${date}`,
                    type: "cierre",
                    id: c.id,
                    date,
                    title: c.id ? "CZ-" + String(c.id).padStart(5, "0") : "Cierre",
                    subtitle: moment(date).locale("es").format("ddd DD MMM"),
                    status: "closed",
                    raw: res,
                });
            }
        });
        items.sort((a, b) => moment(b.date) - moment(a.date));
        return items;
    }

    // === Render de la lista (aplica filtro de busqueda) ===
    renderList() {
        const q = ($("#reportSearch").val() || "").toLowerCase().trim();
        const filtered = q
            ? this.items.filter(i => (i.title + " " + i.subtitle).toLowerCase().includes(q))
            : this.items;

        $("#reportListCount").text(`${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`);

        if (!filtered.length) {
            $("#reportList").html(`<div class="text-center text-gray-500 py-8 text-sm">Sin resultados</div>`);
            return;
        }

        const statusDot = (st) => st === "open"
            ? `<span class="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>`
            : `<span class="w-1.5 h-1.5 rounded-full bg-green-400"></span>`;

        const html = filtered.map(i => {
            const active = i.key === this.selectedKey;
            return `
                <button type="button"
                    class="w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${active ? "bg-blue-600/20 border-blue-500" : "bg-transparent border-transparent hover:bg-[#111827]"}"
                    onclick="reports.selectItem('${i.key}')">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-sm font-bold text-white">${i.title}</span>
                        ${statusDot(i.status)}
                    </div>
                    <div class="text-[11px] text-gray-400 mt-0.5">${i.subtitle}</div>
                </button>
            `;
        }).join("");

        $("#reportList").html(html);
    }

    // === Seleccion de un item -> render del reporte en #reportPreview ===
    selectItem(key) {
        this.selectedKey = key;
        this.renderList();

        const item = this.items.find(i => i.key === key);
        if (!item) return;

        if (item.type === "turno") {
            this.renderTurnoReport(item);
        } else {
            this.renderCierreReport(item);
        }
    }

    async renderTurnoReport(item) {
        // El modo Resumido/Detallado del ticket lo lee app.reportMode; lo sincronizamos.
        $("#reportModeBar").show();
        app.reportMode = this.reportMode;

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

        // Reutiliza el render del ticket de turno de app.js, apuntado a nuestro contenedor.
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
        // El Corte Z siempre es completo; el modo Resumido/Detallado no aplica aqui.
        $("#reportModeBar").hide();
        // item.raw es la respuesta de getCierre ya cacheada.
        cierre.renderExecutiveSummary(item.raw, "reportPreview");
    }

    setReportMode(mode) {
        this.reportMode = mode;
        $("#btnRepSummary").toggleClass("bg-purple-600 text-white", mode === "summary").toggleClass("text-gray-400 hover:text-gray-200", mode !== "summary");
        $("#btnRepDetailed").toggleClass("bg-purple-600 text-white", mode === "detailed").toggleClass("text-gray-400 hover:text-gray-200", mode !== "detailed");

        // Solo re-renderiza si hay un turno seleccionado (el cierre no cambia con el modo).
        const item = this.items.find(i => i.key === this.selectedKey);
        if (item && item.type === "turno") this.renderTurnoReport(item);
    }

    printReport() {
        // Ambos reportes montan su ticket con id #ticketDailyClose; printDaily lo detecta
        // y aplica los estilos correctos (Corte Z hoja carta / ticket de turno hoja angosta).
        if (!document.getElementById("ticketDailyClose")) {
            alert({ icon: "warning", title: "Sin contenido", text: "Selecciona un reporte antes de imprimir.", btn1: true, btn1Text: "Aceptar" });
            return;
        }
        cierre.printDaily();
    }

    // === Estados del preview ===
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
