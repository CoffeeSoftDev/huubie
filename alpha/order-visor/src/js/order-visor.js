

// El backend se reutiliza tal cual (no se duplica SQL): los endpoints viven en pedidos.
const API_PEDIDOS = '/alpha/pedidos/ctrl/ctrl-pedidos.php';
const API_CIERRE  = '/alpha/pedidos/ctrl/ctrl-cierre.php';
const API_ACCESS  = '/alpha/access/ctrl/ctrl-access.php';

const HOME_URL = '/alpha/menus/ventas.php';

let visor, cierre;
let lsSucursales = [];

$(async () => {
    // pedidos-cierre.js declara `apiCierre` con ruta RELATIVA ('ctrl/ctrl-cierre.php'),
    // que desde este modulo apuntaria a /alpha/order-visor/ctrl/... (inexistente).
    apiCierre = API_CIERRE;
    cierre = new Cierre(apiCierre);

    lsSucursales = await loadSubsidiaries();

    visor = new OrderVisor(API_PEDIDOS, 'root');
    visor.render();
});

// Sucursales del selector. Fuente principal: ctrl-access (opc 'company'), la MISMA que
// alimenta la navbar y que NO filtra por rol. Si por lo que sea llega vacia, se cae al
// `init` de pedidos (cuyo lsSubsidiaries() responde 403 + lista vacia si el ROLID no
// es 1/2/3, por eso no se usa como fuente principal).
async function loadSubsidiaries() {
    const access = await useFetch({ url: API_ACCESS, data: { opc: 'company' } });
    let list = (access && access.subsidiaries) || [];

    if (!list.length) {
        console.warn('[order-visor] ctrl-access no devolvio sucursales:', access);
        const init = await useFetch({ url: API_PEDIDOS, data: { opc: 'init' } });
        list = (init && init.sucursales) || [];
        if (!list.length) console.warn('[order-visor] ctrl-pedidos tampoco:', init);
    }

    console.log('[order-visor] sucursales:', list);
    return list;
}

class OrderVisor extends Templates {
    // Ancho compartido: el panel izquierdo (lista de folios) y el control
    // "Período de consulta" miden lo mismo, por eso el valor vive en un solo lugar.
    static LIST_WIDTH = 560;

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "OrderVisor";
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
            parent: "root",
            design: false,
            data: {
                id: this.PROJECT_NAME,
                class: 'flex mx-2',
                container: [
                    {
                        type: "div",
                        id: "singleLayout" + this.PROJECT_NAME,
                        class: "flex flex-col col-12",
                        children: [
                            { type: "div", class: 'w-full', id: 'header' + this.PROJECT_NAME },
                            { type: "div", class: 'w-full mb-4', id: 'filterBar' + this.PROJECT_NAME },
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

    renderHeader() {
        $(`#header${this.PROJECT_NAME}`).html(`
            <div class="flex items-center gap-3 px-1 pt-2 pb-3">
                <a href="${HOME_URL}" title="Volver al inicio"
                    class="flex items-center justify-center w-9 h-9 rounded-full border border-gray-700 bg-[#1F2A37] text-gray-400 hover:text-white hover:border-gray-500 transition-colors flex-shrink-0">
                    ${lucideIcon('arrow-left', 'w-4 h-4')}
                </a>
                <div>
                    <h2 class="text-xl font-bold text-white leading-tight">Visor de Cierre del Día</h2>
                    <p class="text-gray-500 text-xs">Cortes Z, turnos y recepciones por sucursal.</p>
                </div>
            </div>
        `);
    }

    // === Filter bar (componente del framework) ===
     createFilterBar() {
        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
              data: [
                {
                    opc: "select",
                    id: "reportType",
                    lbl: "Tipo de Reporte",
                    class: "col-12 col-md-3 col-lg-2",
                    data: [
                        { id: "cierre", valor: "Cierre diario — Corte Z" },
                        { id: "turno", valor: "Cierre de turno — Corte X" },
                    ],
                    onchange: "visor.changeReportType()",
                },
                {
                    opc: "div",
                    id: "periodGroup",
                    lbl: "Período de consulta",
                    class: "col-auto",
                },
                {
                    opc: "select",
                    id: "reportSucursal",
                    lbl: "Sucursal",
                    class: "col-12 col-md-3 col-lg-2",
                    data: lsSucursales,
                    onchange: "visor.loadList()",
                },
                {
                    opc: "button",
                    id: "btnPrintReport",
                    text: "Imprimir",
                    class: "col-12 col-md-3 col-lg-2 ms-auto",
                    className: "w-100",
                    color_btn: "primary",
                    onClick: () => this.printReport(),
                },
            ],
        });

        // El framework solo acepta `icon` como clase Fontello; el SVG Lucide se inyecta tras el render.
        $("#btnPrintReport")
            .addClass("d-inline-flex align-items-center justify-content-center gap-2")
            .html(`${lucideIcon('printer', 'w-4 h-4')} Imprimir`);

        // El `default` de content_json_form copia los atributos del objeto al elemento, asi
        // que #periodGroup nace con las clases de columna duplicadas: se limpian y se pinta
        // el control compuesto dentro (los ids reportFecha/reportRango los toma dataPicker).
        //
        // El wrapper reusa las MISMAS clases del framework (`form-control input-sm`) y la
        // altura exacta de Bootstrap -> alinea con Sucursal / Tipo de Reporte:
        //   line-height 1.5 + padding .375rem*2 + borde 1px*2 = calc(1.5em + .75rem + 2px)
        const periodBoxStyle = `height: calc(1.5em + 0.75rem + 2px); padding-top: 0; padding-bottom: 0; width: ${OrderVisor.LIST_WIDTH}px;`;
        const innerReset = "height: 100%; line-height: 1;";

        $("#periodGroup").attr("class", "").html(`
            <div class="form-control input-sm bg-[#1F2A37] d-flex align-items-center gap-2" style="${periodBoxStyle}">
                <label class="d-flex align-items-center gap-1 text-sm text-gray-200 cursor-pointer whitespace-nowrap mb-0" style="${innerReset}">
                    <input type="radio" name="reportPeriodMode" value="fecha" class="accent-blue-500 m-0" checked
                        onchange="visor.setPeriodMode('fecha')"> Fecha
                </label>
                <label class="d-flex align-items-center gap-1 text-sm text-gray-200 cursor-pointer whitespace-nowrap mb-0" style="${innerReset}">
                    <input type="radio" name="reportPeriodMode" value="rango" class="accent-blue-500 m-0"
                        onchange="visor.setPeriodMode('rango')"> Rango
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
                <div style="width: ${OrderVisor.LIST_WIDTH}px" class="flex-shrink-0 bg-[#1F2A37] rounded-xl flex flex-col overflow-hidden">
                    <div class="p-3 border-b border-gray-700">
                        <div class="flex items-center gap-2 mb-2">
                            <span class="text-blue-400 d-flex">${lucideIcon('file-text', 'w-4 h-4')}</span>
                            <span id="reportListTitle" class="text-sm font-bold text-white flex-1">Cortes Z</span>
                            <span id="reportListCount" class="text-[11px] text-gray-400">0 resultados</span>
                        </div>
                        <div class="relative">
                            <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 d-flex">${lucideIcon('search', 'w-4 h-4')}</span>
                            <input type="text" id="reportSearch" placeholder="Buscar por folio o fecha..."
                                class="w-full bg-[#111827] border border-gray-700 text-white text-sm rounded-lg pl-8 pr-3 py-2 outline-none" />
                        </div>
                    </div>
                    <div id="reportListHead" class="grid grid-cols-[1fr_62px_66px_104px] gap-1 px-3 py-2 border-b border-gray-700/60 text-[10px] font-semibold text-gray-500 uppercase tracking-wide"></div>
                    <div id="reportList" class="flex-1 overflow-y-auto"></div>
                </div>

                <div class="flex-1 bg-[#1F2A37] rounded-xl flex flex-col overflow-hidden">
                    <div class="flex items-center justify-between p-3 border-b border-gray-700">
                        <span class="text-sm text-gray-400">Vista previa de impresión</span>
                        <div id="reportModeBar" class="inline-flex bg-[#111827] rounded-lg p-0.5">
                            <button id="btnRepSummary" class="px-3 py-1 rounded-md text-sm font-semibold bg-purple-600 text-white" onclick="visor.setReportMode('summary')">Resumido</button>
                            <button id="btnRepDetailed" class="px-3 py-1 rounded-md text-sm font-semibold text-gray-400 hover:text-gray-200" onclick="visor.setReportMode('detailed')">Detallado</button>
                        </div>
                    </div>
                    <div id="reportPreview" class="flex-1 overflow-y-auto p-4"></div>
                </div>
            </div>
        `);

        this.emptyPreview("Selecciona un elemento de la lista para ver su reporte.");
    }

    bindEvents() {
        $("#reportSearch").off("input").on("input", () => this.renderList());
    }

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

    columnsFor() {
        return this.reportType === "turno"
            ? ["FOLIO", "TURNO", "PEDIDOS", "TOTAL"]
            : ["FOLIO", "TURNOS", "PEDIDOS", "TOTAL CAJA"];
    }

    async loadList() {
        const dates = this.getReportDates();
        const subsidiaries_id = this.getSubsidiaryId();

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
            useFetch({ url: API_PEDIDOS, data: { opc: "getShiftsByDate", date, subsidiaries_id } })
                .then(r => ({ date, shifts: r.shifts || [] }))
        ));

        const items = [];
        results.forEach(({ date, shifts }) => {
            shifts.forEach(s => {
                // TOTAL = dinero real en caja (cash+card+transfer), igual que el TOTAL CAJA
                // del ticket: incluye abonos de pedidos anteriores y cobros cruzados recibidos
                // en esta sucursal. total_sales es venta facturada del turno, NO caja.
                const caja = parseFloat(s.cash || 0) + parseFloat(s.card || 0) + parseFloat(s.transfer || 0);
                items.push({
                    key: `turno:${s.id}`,
                    type: "turno",
                    id: s.id,
                    date,
                    folio: "TN-" + String(s.id).padStart(5, "0"),
                    hora: moment(s.opened_at).format("hh:mm A"),
                    sub1: s.employee_name || "Sin vendedor",
                    sub2: moment(s.opened_at).format("DD/MM/YYYY") + " · " + subName,
                    col2: moment(s.opened_at).format("HH:mm"),
                    col3: parseInt(s.total_orders || 0),
                    col4: caja,
                    status: s.status,
                    raw: s,
                });
            });
        });
        // Dias recientes primero; dentro del dia los turnos van de la mañana a la tarde.
        items.sort((a, b) => a.date !== b.date
            ? moment(b.date) - moment(a.date)
            : moment(a.raw.opened_at) - moment(b.raw.opened_at));
        return items;
    }

    async fetchCierres(dates, subsidiaries_id) {
        const subName = this.getSubsidiaryName();
        const results = await Promise.all(dates.map(date =>
            useFetch({ url: API_CIERRE, data: { opc: "getCierre", date, subsidiaries_id } })
                .then(res => ({ date, res }))
        ));

        const items = [];
        results.forEach(({ date, res }) => {
            if (res.status === 200 && res.closure) {
                const c = res.closure;
                const rShifts = (res.report && res.report.shifts) || res.shifts || [];
                const totalCaja = rShifts.reduce((t, s) =>
                    t + parseFloat(s.efectivo || 0) + parseFloat(s.tarjeta || 0) + parseFloat(s.transferencia || 0), 0);

                items.push({
                    key: `cierre:${date}`,
                    type: "cierre",
                    id: c.id,
                    date,
                    folio: "#" + String(c.id || 0).padStart(3, "0"),
                    hora: c.created_at ? moment(c.created_at).format("hh:mm A") : "",
                    sub1: "",
                    sub2: moment(date).format("DD/MM/YYYY") + " · " + subName,
                    col2: rShifts.length,
                    col3: (res.orders || []).length,
                    col4: totalCaja,
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
                    onclick="visor.selectItem('${i.key}')">
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

        // En modo Rango la lista se separa por dia (los items ya vienen ordenados desc).
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
        this.loadingPreview("Cargando ticket del turno...");

        const metricsRes = await useFetch({ url: API_PEDIDOS, data: { opc: "getShiftMetrics", shift_id: item.id } });
        if (metricsRes.status !== 200) {
            this.emptyPreview(metricsRes.message || "Error al obtener el turno.");
            return;
        }

        let orders = [], externalPayments = [], crossPayments = [];
        if (this.reportMode === "detailed") {
            const ordersRes = await useFetch({ url: API_PEDIDOS, data: { opc: "getShiftOrders", shift_id: item.id } });
            orders           = ordersRes.orders || [];
            externalPayments = ordersRes.external_payments || [];
            crossPayments    = ordersRes.cross_payments || [];
        }

        // Fuente unica del formato (shift-ticket.js), la misma que usa alpha/pedidos.
        renderShiftTicket({
            data: metricsRes.data,
            shift: metricsRes.shift,
            subsidiary_name: metricsRes.subsidiary_name,
            company_name: metricsRes.company_name,
            logo: metricsRes.logo,
            orders,
            externalPayments,
            crossPayments,
            reportMode: this.reportMode,
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
                ${lucideIcon('file-text', 'w-12 h-12 mb-3')}
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
