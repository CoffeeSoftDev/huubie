

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
    // Ancho del panel izquierdo (lista de folios).
    static LIST_WIDTH = 560;

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "OrderVisor";
        this.reportType = "cierre";  // 'turno' | 'cierre'
        this.reportMode = "summary"; // 'summary' | 'detailed' (solo Turno)
        this.periodMode = "fecha";   // 'fecha' | 'rango'
        this.items = [];
        this.selectedKey = null;
        // Ancho ajustable del panel de lista (splitter): la vista previa toma el resto
        // via flex-1. Persiste entre sesiones; se acota por si quedo guardado un ancho
        // mayor que la pantalla actual. LIST_WIDTH queda como default (doble clic).
        const saved = parseInt(localStorage.getItem("orderVisorListWidth"), 10);
        this.listWidth = Math.min(Math.max(saved || OrderVisor.LIST_WIDTH, 380), 1000);
    }

    render() {
        this.layout();
    }

    layout() {
        this.createLayout({
            parent: "root",
            design: false,
            // Cadena flex de altura: cada eslabon lleva flex-1 min-h-0 para que
            // #container llene el viewport y el scroll quede DENTRO de los paneles.
            data: {
                id: this.PROJECT_NAME,
                class: 'flex mx-2 flex-1 min-h-0',
                container: [
                    {
                        type: "div",
                        id: "singleLayout" + this.PROJECT_NAME,
                        class: "flex flex-col col-12 min-h-0",
                        children: [
                            { type: "div", class: 'w-full', id: 'header' + this.PROJECT_NAME },
                            { type: "div", class: 'w-full mb-4', id: 'filterBar' + this.PROJECT_NAME },
                            { type: "div", class: 'w-full flex-1 min-h-0', id: 'container' + this.PROJECT_NAME }
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
                        { id: "tickets", valor: "Reporte por tickets" },
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
        // Sin width fijo: el control mide lo que ocupa su contenido (los inputs de fecha
        // llevan ancho propio segun su formato, asi el box no se estira de mas).
        const periodBoxStyle = `height: calc(1.5em + 0.75rem + 2px); padding-top: 0; padding-bottom: 0; width: auto;`;
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
                    class="period-fecha bg-transparent text-white text-sm border-0 outline-none p-0 m-0" style="${innerReset} width: 92px;" />
                <input type="text" id="reportRango"
                    class="period-rango bg-transparent text-white text-sm border-0 outline-none p-0 m-0" style="${innerReset} width: 188px;" />
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
        const titles = { turno: "Turnos", cierre: "Cortes Z", tickets: "Tickets" };
        $("#reportListTitle").text(titles[this.reportType] || "Cortes Z");
        this.loadList();
    }

    // === Cuerpo: lista (izq) + preview (der) ===
    renderBody() {
        $(`#container${this.PROJECT_NAME}`).html(`
            <div class="flex h-full min-h-0">
                <div id="reportListPanel" style="width: ${this.listWidth}px" class="flex-shrink-0 bg-[#1F2A37] rounded-xl flex flex-col overflow-hidden">
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
                    <div id="reportListHead" class="grid gap-1 px-3 py-2 border-b border-gray-700/60 text-[10px] font-semibold text-gray-500 uppercase tracking-wide"></div>
                    <div id="reportList" class="flex-1 overflow-y-auto"></div>
                    <div id="reportListFoot" class="flex items-center justify-between px-3 py-2.5 border-t border-gray-700 bg-[#161f2b]"></div>
                </div>

                <!-- Splitter: mismo ancho (16px) que el gap-4 que separaba los paneles,
                     asi el diseño no se mueve; solo se vuelve arrastrable. -->
                <div id="reportSplitter" class="flex-shrink-0 flex items-center justify-center group" style="width: 16px; cursor: col-resize;" title="Arrastrar para ajustar la vista previa · doble clic restablece">
                    <div class="w-1 h-12 rounded-full bg-gray-700 group-hover:bg-gray-500 transition-colors"></div>
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
        this.initSplitter();
    }

    // Splitter lista/vista previa: arrastrar ajusta el ancho del panel izquierdo y la
    // vista previa absorbe el resto (flex-1). Vive solo en este modulo: no toca nada
    // de CoffeeSoft ni el layout del framework. Doble clic vuelve al ancho default.
    initSplitter() {
        const MIN_LIST    = 380; // que la lista no colapse
        const MIN_PREVIEW = 420; // que el reporte siga legible

        const apply = (w) => {
            this.listWidth = w;
            $("#reportListPanel").css("width", w + "px");
        };

        $("#reportSplitter")
            .off("mousedown dblclick")
            .on("dblclick", () => {
                apply(OrderVisor.LIST_WIDTH);
                localStorage.setItem("orderVisorListWidth", OrderVisor.LIST_WIDTH);
            })
            .on("mousedown", (e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startW = $("#reportListPanel").outerWidth();
                const maxW   = Math.max($(`#container${this.PROJECT_NAME}`).width() - MIN_PREVIEW, MIN_LIST);

                // Sin user-select:none el arrastre va seleccionando el texto de los paneles.
                $("body").css({ "user-select": "none", cursor: "col-resize" });

                $(document)
                    .on("mousemove.visorSplitter", (ev) => {
                        apply(Math.min(Math.max(startW + (ev.clientX - startX), MIN_LIST), maxW));
                    })
                    .on("mouseup.visorSplitter", () => {
                        $(document).off(".visorSplitter");
                        $("body").css({ "user-select": "", cursor: "" });
                        localStorage.setItem("orderVisorListWidth", Math.round(this.listWidth));
                    });
            });
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

    // Con id: resuelve el nombre desde lsSucursales (necesario en tickets cuando el
    // filtro es "Todas" y cada fila puede pertenecer a una sucursal distinta).
    // Sin id: nombre de la sucursal actualmente seleccionada en el filtro.
    getSubsidiaryName(subsidiaries_id) {
        if (subsidiaries_id !== undefined && subsidiaries_id !== null) {
            const found = lsSucursales.find(s => String(s.id) === String(subsidiaries_id));
            if (found) return found.valor;
        }
        return $("#reportSucursal option:selected").text() || "";
    }

    columnsFor() {
        if (this.reportType === "turno") return ["FOLIO", "HORARIO", "PEDIDOS", "TOTAL EN CAJA"];
        if (this.reportType === "tickets") return ["FOLIO", "HORA", "PAGADO", "TOTAL"];
        return ["FOLIO", "TURNOS", "PEDIDOS", "TOTAL CAJA"];
    }

    // En turnos la columna HORARIO muestra "08:30 → 14:15" y necesita mas ancho.
    gridColsFor() {
        if (this.reportType === "turno") return "1fr 112px 52px 104px";
        if (this.reportType === "tickets") return "1fr 70px 78px 104px";
        return "1fr 62px 66px 104px";
    }

    async loadList() {
        const dates = this.getReportDates();
        const subsidiaries_id = this.getSubsidiaryId();

        $("#reportListHead")
            .css("grid-template-columns", this.gridColsFor())
            .html(this.columnsFor().map((c, i) =>
                `<span class="${i === 0 ? "" : "text-right"}">${c}</span>`).join(""));

        $("#reportList").html(`<div class="text-center text-gray-500 py-8 text-sm">Cargando...</div>`);
        this.selectedKey = null;

        if (!dates.length) {
            this.items = [];
            this.renderList();
            this.emptyPreview("Selecciona una fecha o rango.");
            return;
        }

        if (this.reportType === "turno") {
            this.items = await this.fetchTurnos(dates, subsidiaries_id);
        } else if (this.reportType === "tickets") {
            this.items = await this.fetchTickets(dates, subsidiaries_id);
        } else {
            this.items = await this.fetchCierres(dates, subsidiaries_id);
        }

        this.renderList();

        if (this.items.length) {
            this.selectItem(this.items[0].key);
        } else {
            const emptyMsg = {
                turno: "No hay turnos en este período.",
                tickets: "No hay tickets en este período.",
            };
            this.emptyPreview(emptyMsg[this.reportType] || "No hay cortes Z en este período.");
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
                    hora: "", // el horario completo va en su propia columna (col2/col2Sub)
                    sub1: s.employee_name || "Sin vendedor",
                    sub2: moment(s.opened_at).format("DD/MM/YYYY") + " · " + subName,
                    col2: this.formatHorario(s),
                    col2Sub: this.formatDuracion(s),
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
        // preview: 1 -> si el dia aun no tiene cierre diario, el backend (SOLO admin)
        // responde el Corte Z armado con datos en vivo y marcado con res.pending;
        // para el resto de roles el flag se ignora y siguen recibiendo 404.
        const results = await Promise.all(dates.map(date =>
            useFetch({ url: API_CIERRE, data: { opc: "getCierre", date, subsidiaries_id, preview: 1 } })
                .then(res => ({ date, res }))
        ));

        const items = [];
        results.forEach(({ date, res }) => {
            if (res.status === 200 && res.closure) {
                const c = res.closure;
                const pending = !!res.pending;
                const rShifts = (res.report && res.report.shifts) || res.shifts || [];
                const totalCaja = rShifts.reduce((t, s) =>
                    t + parseFloat(s.efectivo || 0) + parseFloat(s.tarjeta || 0) + parseFloat(s.transferencia || 0), 0);

                // Dia pendiente SIN actividad (sin turnos ni pedidos): no aporta nada y en
                // modo rango inundaria la lista con filas vacias de dias no laborados.
                if (pending && !rShifts.length && !(res.orders || []).length) return;

                items.push({
                    key: `cierre:${date}`,
                    type: "cierre",
                    id: c.id,
                    date,
                    folio: pending ? "SIN CIERRE" : "#" + String(c.id || 0).padStart(3, "0"),
                    hora: c.created_at ? moment(c.created_at).format("hh:mm A") : "",
                    sub1: pending ? "Pendiente cierre" : "",
                    sub2: moment(date).format("DD/MM/YYYY") + " · " + subName,
                    col2: rShifts.length,
                    col3: (res.orders || []).length,
                    col4: totalCaja,
                    // "open" reusa el punto naranja pulsante de turnos abiertos.
                    status: pending ? "open" : "closed",
                    raw: res,
                });
            }
        });
        items.sort((a, b) => moment(b.date) - moment(a.date));
        return items;
    }

    // A diferencia de turnos/cierres (un fetch por dia), aqui basta UNA llamada con
    // fi = primera fecha del rango y ff = ultima: listOrdersTicket ya acepta rango
    // (reusa getOrders() del modelo, igual que listOrders).
    async fetchTickets(dates, subsidiaries_id) {
        const fi = dates[0];
        const ff = dates[dates.length - 1];

        const res = await useFetch({ url: API_PEDIDOS, data: { opc: "listOrdersTicket", fi, ff, subsidiaries_id } });
        const orders = (res && res.data) || [];

        const items = orders.map(o => ({
            key: `ticket:${o.id}`,
            type: "ticket",
            id: o.id,
            date: o.date_creation,
            folio: o.folio,
            hora: "", // el horario de entrega va en su propia columna (col2), igual que turno
            sub1: o.name_client || "Sin cliente",
            sub2: moment(o.date_creation).format("DD/MM/YYYY") + " · " + this.getSubsidiaryName(o.subsidiaries_id),
            col2: o.time_order || "—",
            col3: parseFloat(o.total_paid || 0),
            col4: parseFloat(o.total_pay || 0) - parseFloat(o.discount || 0),
            status: o.status,
            raw: o,
        }));

        // Dentro del mismo dia, getOrders() ya ordena por date_creation DESC; el sort
        // por dia es estable, asi que ese orden fino se conserva.
        items.sort((a, b) => moment(b.date) - moment(a.date));
        return items;
    }

    // Horario del turno: "08:30 → 14:15"; si sigue abierto, "08:30 → —".
    formatHorario(s) {
        const cierre = s.status === "closed" && s.closed_at
            ? moment(s.closed_at).format("HH:mm")
            : "—";
        return moment(s.opened_at).format("HH:mm") + " → " + cierre;
    }

    // Sublinea del horario: duracion del turno cerrado ("5h 45m") o "ABIERTO".
    formatDuracion(s) {
        if (s.status !== "closed" || !s.closed_at) return "ABIERTO";
        const mins = moment(s.closed_at).diff(moment(s.opened_at), "minutes");
        return Math.floor(mins / 60) + "h " + String(mins % 60).padStart(2, "0") + "m";
    }

    // === Render de la lista columnar ===
    renderList() {
        const q = ($("#reportSearch").val() || "").toLowerCase().trim();
        const filtered = q
            ? this.items.filter(i => (i.folio + " " + i.sub1 + " " + i.sub2).toLowerCase().includes(q))
            : this.items;

        $("#reportListCount").text(`${filtered.length} resultado${filtered.length === 1 ? "" : "s"}`);

        // Total general de todo lo listado (se recalcula si el buscador filtra).
        // En tickets col4 ya es el total con descuento aplicado -> "vendido", no "en caja"
        // (un ticket puede seguir con saldo pendiente, a diferencia del dinero en caja).
        const grandTotal = filtered.reduce((t, it) => t + (parseFloat(it.col4) || 0), 0);
        const footLabel = this.reportType === "tickets" ? "Total vendido" : "Total en caja";
        $("#reportListFoot").html(`
            <span class="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                ${footLabel} ${this.periodMode === "rango" ? "del período" : "del día"}
            </span>
            <span class="text-base font-bold text-green-400">${formatPrice(grandTotal)}</span>
        `);

        if (!filtered.length) {
            $("#reportList").html(`<div class="text-center text-gray-500 py-8 text-sm">Sin resultados</div>`);
            return;
        }

        // status_process: 1=cotizacion, 2=pendiente, 3=pagado, 4=cancelado.
        const TICKET_STATUS_DOT = { 1: "bg-gray-400", 2: "bg-orange-400", 3: "bg-green-400", 4: "bg-red-400" };
        const dot = (st) => {
            if (this.reportType === "tickets") {
                return `<span class="w-1.5 h-1.5 rounded-full ${TICKET_STATUS_DOT[st] || "bg-gray-400"} flex-shrink-0"></span>`;
            }
            return st === "open"
                ? `<span class="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse flex-shrink-0"></span>`
                : `<span class="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0"></span>`;
        };

        const unitFor = this.reportType === "cierre" ? "TURN" : "";
        const col3Label = this.reportType === "tickets" ? "ABONO" : "PED";

        const rowHtml = (i) => {
            const active = i.key === this.selectedKey;
            return `
                <button type="button" style="grid-template-columns: ${this.gridColsFor()}"
                    class="w-full text-left grid gap-1 items-center px-3 py-2.5 border-l-2 border-b border-gray-800 transition-colors ${active ? "border-l-purple-500 bg-purple-600/10" : "border-l-transparent hover:bg-[#111827]"}"
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
                        <div class="text-sm font-semibold text-white leading-none whitespace-nowrap">${i.col2}</div>
                        <div class="text-[9px] ${i.col2Sub === "ABIERTO" ? "text-orange-400 font-bold" : "text-gray-500"}">${i.col2Sub || unitFor}</div>
                    </div>
                    <div class="text-right">
                        <div class="text-sm font-semibold text-white leading-none">${this.reportType === "tickets" ? formatPrice(i.col3) : i.col3}</div>
                        <div class="text-[9px] text-gray-500 uppercase">${col3Label}</div>
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
        else if (item.type === "ticket") this.renderTicketReport(item);
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

    // Instancia unica y perezosa de CatalogProduct (pedidos-catalogo.js), fuente unica
    // del formato del ticket de pedido. Mismo patron de reuso que calendario-pedidos.js
    // (printOrder) y app.js (printOrder): `new CatalogProduct(link, div).ticketPasteleria(...)`.
    get ticketPrinter() {
        if (!this._ticketPrinter) this._ticketPrinter = new CatalogProduct(API_PEDIDOS, "root");
        return this._ticketPrinter;
    }

    async renderTicketReport(item) {
        $("#reportModeBar").hide(); // el ticket de un pedido no tiene modo resumido/detallado
        this.loadingPreview("Cargando ticket...");

        const res = await useFetch({ url: API_PEDIDOS, data: { opc: "getOrderDetails", id: item.id } });
        if (res.status !== 200) {
            this.emptyPreview(res.message || "Error al obtener el pedido.");
            return;
        }

        // ticketPasteleria llena el 100% de su parent; se le da un wrapper angosto
        // (mismo ancho que el ticket del Corte X en shift-ticket.js) para que la vista
        // previa se vea en formato ticket. A su derecha va una columna con el historial
        // de pagos arriba y la bitacora del pedido (order_histories) debajo; con
        // flex-wrap esa columna baja debajo del ticket si el panel se queda angosto.
        $("#reportPreview").html(`
            <div class="flex flex-wrap justify-center items-start gap-4">
                <div id="ticketPreviewWrap" class="flex-shrink-0" style="width: 320px;"></div>
                <div class="flex-shrink-0 flex flex-col gap-4" style="width: 340px;">
                    <div id="ticketPaymentsWrap"></div>
                    <div id="ticketHistoryWrap"></div>
                </div>
            </div>
        `);

        this.ticketPrinter.ticketPasteleria({
            parent: "ticketPreviewWrap",
            data: {
                head: res.data.order,
                products: res.data.products,
                paymentMethods: res.data.paymentMethods || [],
                clausules: res.data.clausules || []
            }
        });

        // Se oculta (no se elimina) el boton de imprimir propio del ticket: el "Imprimir"
        // del filterBar lo sigue disparando via click programatico en printReport().
        $("#ticketPreviewWrap .no-print").hide();

        this.renderPaymentHistory(res.data);
        this.renderOrderHistory(item.id);
    }

    // Panel de historial de pagos junto al ticket (tema dark del visor: no forma parte
    // del ticket imprimible, por eso vive fuera de #ticketPreviewWrap).
    renderPaymentHistory(data) {
        const payments = data.payments || [];
        const summary  = data.summary || {};
        const orderSub = data.order ? data.order.subsidiaries_id : null;

        const METHOD_ICON = { "Efectivo": "banknote", "Transferencia": "arrow-right-left" };

        const rows = payments.map(p => {
            // Cobro cruzado: el pago se recibio en una sucursal distinta a la del pedido.
            const esCruzado = p.subsidiaries_id && String(p.subsidiaries_id) !== String(orderSub);
            const subBadge = esCruzado
                ? `<span class="ml-1.5 px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300 text-[9px]" title="Cobrado en sucursal distinta a la del pedido">${p.subsidiary_name || "—"}</span>`
                : "";
            return `
                <div class="flex items-center gap-3 px-3 py-2.5 border-b border-gray-800">
                    <span class="text-gray-400 d-flex flex-shrink-0">${lucideIcon(METHOD_ICON[p.method_pay] || "credit-card", "w-4 h-4")}</span>
                    <div class="min-w-0 flex-1">
                        <div class="text-sm text-white">${p.method_pay}${subBadge}</div>
                        <div class="text-[10px] text-gray-500">${moment(p.date_pay).format("DD/MM/YYYY hh:mm A")}</div>
                    </div>
                    <span class="text-sm font-semibold text-green-400 flex-shrink-0">${formatPrice(p.pay)}</span>
                </div>
            `;
        }).join("");

        const body = payments.length
            ? rows
            : `<div class="text-center text-gray-500 py-8 text-sm">Sin pagos registrados.</div>`;

        const balance = parseFloat(summary.balance || 0);

        $("#ticketPaymentsWrap").html(`
            <div class="bg-[#161f2b] rounded-xl overflow-hidden">
                <div class="flex items-center gap-2 px-3 py-2.5 border-b border-gray-700">
                    <span class="text-blue-400 d-flex">${lucideIcon('wallet', 'w-4 h-4')}</span>
                    <span class="text-sm font-bold text-white flex-1">Historial de pagos</span>
                    <span class="text-[11px] text-gray-400">${payments.length} pago${payments.length === 1 ? "" : "s"}</span>
                </div>
                ${body}
                <div class="px-3 py-2.5 bg-black/20 space-y-1">
                    <div class="flex items-center justify-between">
                        <span class="text-[10px] font-bold uppercase tracking-wide text-gray-400">Total pagado</span>
                        <span class="text-sm font-bold text-green-400">${formatPrice(summary.paid || 0)}</span>
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-[10px] font-bold uppercase tracking-wide text-gray-400">Saldo</span>
                        <span class="text-sm font-bold ${balance > 0 ? "text-red-400" : "text-gray-400"}">${formatPrice(balance)}</span>
                    </div>
                </div>
            </div>
        `);
    }

    // Bitacora del pedido (order_histories) debajo del historial de pagos. Reusa el
    // mismo endpoint que alpha/pedidos (opc 'getHistory' -> listHistories); aqui es
    // solo lectura, timeline dark, sin caja de comentario.
    async renderOrderHistory(id) {
        $("#ticketHistoryWrap").html(`
            <div class="bg-[#161f2b] rounded-xl px-3 py-4 text-center text-gray-500 text-sm">
                Cargando historial...
            </div>
        `);

        const res = await useFetch({ url: API_PEDIDOS, data: { opc: "getHistory", id } });
        const history = (res && res.history) || [];

        // Icono y color del punto segun el tipo de evento registrado por logOrderHistory.
        const TYPE_META = {
            creation:     { icon: "circle-plus",      dot: "bg-blue-400" },
            payment:      { icon: "banknote",         dot: "bg-green-400" },
            edition:      { icon: "pencil",           dot: "bg-amber-400" },
            price:        { icon: "dollar-sign",      dot: "bg-emerald-400" },
            delivery:     { icon: "truck",            dot: "bg-cyan-400" },
            discount:     { icon: "percent",          dot: "bg-pink-400" },
            cancellation: { icon: "circle-x",         dot: "bg-red-400" },
            comment:      { icon: "message-circle",   dot: "bg-purple-400" },
            general:      { icon: "info",             dot: "bg-gray-400" },
        };

        const rows = history.map(h => {
            const meta = TYPE_META[h.type] || TYPE_META.general;
            return `
                <div class="flex items-start gap-3 px-3 py-2.5 border-b border-gray-800">
                    <span class="mt-1 w-2 h-2 rounded-full ${meta.dot} flex-shrink-0"></span>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5">
                            <span class="text-gray-400 d-flex flex-shrink-0">${lucideIcon(meta.icon, "w-3.5 h-3.5")}</span>
                            <span class="text-sm text-white truncate">${h.valor || "Actividad"}</span>
                        </div>
                        <div class="text-[11px] text-gray-300 mt-0.5">${h.message || ""}</div>
                        <div class="text-[10px] text-gray-500 mt-0.5">
                            ${h.date}${h.author ? " · " + h.author : ""}
                        </div>
                    </div>
                </div>
            `;
        }).join("");

        const body = history.length
            ? rows
            : `<div class="text-center text-gray-500 py-8 text-sm">Sin actividad registrada.</div>`;

        $("#ticketHistoryWrap").html(`
            <div class="bg-[#161f2b] rounded-xl overflow-hidden">
                <div class="flex items-center gap-2 px-3 py-2.5 border-b border-gray-700">
                    <span class="text-purple-400 d-flex">${lucideIcon('history', 'w-4 h-4')}</span>
                    <span class="text-sm font-bold text-white flex-1">Historial de actividad</span>
                    <span class="text-[11px] text-gray-400">${history.length} evento${history.length === 1 ? "" : "s"}</span>
                </div>
                ${body}
            </div>
        `);
    }

    setReportMode(mode) {
        this.reportMode = mode;
        $("#btnRepSummary").toggleClass("bg-purple-600 text-white", mode === "summary").toggleClass("text-gray-400 hover:text-gray-200", mode !== "summary");
        $("#btnRepDetailed").toggleClass("bg-purple-600 text-white", mode === "detailed").toggleClass("text-gray-400 hover:text-gray-200", mode !== "detailed");

        const item = this.items.find(i => i.key === this.selectedKey);
        if (item && item.type === "turno") this.renderTurnoReport(item);
    }

    printReport() {
        if (this.reportType === "tickets") {
            // ticketPasteleria trae su propio boton de impresion (abre ventana + window.print());
            // el boton "Imprimir" del filterBar solo lo dispara por consistencia de UI.
            const btnPrintTicket = document.getElementById("btnPrintTicket");
            if (btnPrintTicket) { btnPrintTicket.click(); return; }
            alert({ icon: "warning", title: "Sin contenido", text: "Selecciona un ticket antes de imprimir.", btn1: true, btn1Text: "Aceptar" });
            return;
        }

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
