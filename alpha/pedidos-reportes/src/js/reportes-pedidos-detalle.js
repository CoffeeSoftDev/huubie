class OrderDetailsReport extends AppReportes {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "ReportesPedidosDetalle";

        this._estadoVal     = '2';
        this._descuentoVal  = 'todos';
        this._dateModeLocal = 'range';
        this._fiLocal       = moment().startOf('month').format('YYYY-MM-DD');
        this._ffLocal       = moment().format('YYYY-MM-DD');
    }

    render() {
        this.layoutPedidosDetalle();
        this.filterBarPedidosDetalle();
        this.lsPedidosDetalle();
    }

    layoutPedidosDetalle() {
        const container = $(`#container-pedidos-detalle`);

        container.empty();
        container.append(
            $("<div>", { id: 'pedidos-detalle-filter-bar', class: "mb-2" }),
            $("<div>", { id: 'pedidos-detalle-table-container' })
        );
    }

    async lsPedidosDetalle() {
        this._estadoVal    = $(`#filtroEstadoPedidosDetalle`).val()    || this._estadoVal;
        this._descuentoVal = $(`#filtroDescuentoPedidosDetalle`).val() || this._descuentoVal;

        const params = this.getFilterParams();

        this._renderLoader('pedidos-detalle-table-container');

        const data = await useFetch({ url: this._link, data: { opc: "lsPedidosDetalle", ...params } });

        this.createCoffeeTable3({
            parent: 'pedidos-detalle-table-container',
            id:     `tb${this.PROJECT_NAME}`,
            theme:  'dark',

            center: [1, 6, 7, 8, 9],
            right:  [3, 4, 5],

            extends:    true,
            f_size:     12,
            scrollable: false,
            hover:      true,

            folding:     true,
            collapsed:   true,
            color_group: 'bg-[#2D3A4A] text-gray-300 !py-1',

            data: data,
        });

        simple_data_table(`#tb${this.PROJECT_NAME}`, 20);

        if (data.totals) {
            this.renderPedidosTotalsBar(data.totals, 'pedidos-detalle-table-container');
        }
    }

    _renderLoader(parentId) {
        const wrapper = $("<div>", { class: "flex flex-col items-center justify-center py-16" });
        const spinner = $("<div>", { class: "w-10 h-10 border-4 border-gray-600 border-t-blue-400 rounded-full animate-spin mb-4" });
        const text    = $("<p>", { class: "text-gray-400 text-sm", text: "Cargando datos..." });

        wrapper.append(spinner, text);
        $(`#${parentId}`).html(wrapper);
    }

    filterBarPedidosDetalle() {
        this.createfilterBar({
            parent: 'pedidos-detalle-filter-bar',
            data: [
                {
                    opc: "select",
                    id: 'dateModePedidosDetalle',
                    lbl: "Modo de consulta:",
                    class: "col-12 col-md-3 col-lg-2",
                    onchange: "orderDetailsReport.toggleDateModeLocal()",
                    data: [
                        { id: "single", valor: "Dia unico" },
                        { id: "range",  valor: "Rango de fechas" }
                    ]
                },
                {
                    opc: "input-calendar",
                    id: 'calendarPedidosDetalle',
                    lbl: "Consultar fecha: ",
                    class: "col-12 col-md-3 col-lg-2",
                },
                {
                    opc: "select",
                    id: 'filtroEstadoPedidosDetalle',
                    lbl: "Estado:",
                    class: "col-12 col-md-3 col-lg-2",
                    onchange: "orderDetailsReport.render()",
                    data: [
                        { id: "0", valor: "Todos" },
                        { id: "1", valor: "Cotización" },
                        { id: "2", valor: "Pendiente" },
                        { id: "3", valor: "Pagado" },
                        { id: "4", valor: "Cancelado" }
                    ]
                },
                {
                    opc: "select",
                    id: 'filtroDescuentoPedidosDetalle',
                    lbl: "Filtrar por:",
                    class: "col-12 col-md-3 col-lg-2",
                    onchange: "orderDetailsReport.render()",
                    data: [
                        { id: "todos", valor: "Sin filtro" },
                        { id: "con",   valor: "Con descuento" },
                        { id: "sin",   valor: "Sin descuento" }
                    ]
                },
            ]
        });

        $(`#dateModePedidosDetalle`).val(this._dateModeLocal);
        $(`#filtroEstadoPedidosDetalle`).val(this._estadoVal);
        $(`#filtroDescuentoPedidosDetalle`).val(this._descuentoVal);

        this._renderDatePickerLocal();
    }

    _renderDatePickerLocal() {
        const parentId = 'calendarPedidosDetalle';

        $(`#${parentId}`).empty();

        if (this._dateModeLocal === 'single') {
            dataPicker({
                parent: parentId,
                type: 'simple',
                rangeDefault: {
                    startDate: moment(this._ffLocal),
                    singleDatePicker: true,
                    showDropdowns: true,
                    autoApply: true,
                    maxDate: moment(),
                    locale: { format: "DD-MM-YYYY" }
                },
                onSelect: (start, end) => {
                    this._fiLocal = start.format('YYYY-MM-DD');
                    this._ffLocal = end.format('YYYY-MM-DD');
                    this.render();
                }
            });
            return;
        }

        dataPicker({
            parent: parentId,
            type: 'all',
            rangepicker: {
                startDate: moment(this._fiLocal),
                endDate:   moment(this._ffLocal),
                showDropdowns: true,
                autoApply: true,
                locale: { format: "DD-MM-YYYY" },
                ranges: {
                    'Hoy': [moment().startOf("day"), moment().endOf("day")],
                    'Ayer': [moment().subtract(1, "day").startOf("day"), moment().subtract(1, "day").endOf("day")],
                    'Semana actual': [moment().startOf("week"), moment()],
                    'Semana anterior': [moment().subtract(1, "week").startOf("week"), moment().subtract(1, "week").endOf("week")],
                    'Mes actual': [moment().startOf("month"), moment()],
                    'Mes anterior': [moment().subtract(1, "month").startOf("month"), moment().subtract(1, "month").endOf("month")],
                    'Personalizar': [moment().startOf("month"), moment()],
                },
            },
            onSelect: (start, end) => {
                this._fiLocal = start.format('YYYY-MM-DD');
                this._ffLocal = end.format('YYYY-MM-DD');
                this.render();
            }
        });
    }

    toggleDateModeLocal() {
        this._dateModeLocal = $(`#dateModePedidosDetalle`).val();

        if (this._dateModeLocal === 'single') {
            this._fiLocal = moment().format('YYYY-MM-DD');
            this._ffLocal = moment().format('YYYY-MM-DD');
        } else {
            this._fiLocal = moment().startOf('month').format('YYYY-MM-DD');
            this._ffLocal = moment().format('YYYY-MM-DD');
        }

        this._renderDatePickerLocal();
        this.render();
    }

    getFilterParams() {
        let rangePicker = getDataRangePicker('calendarPedidosDetalle');
        let sub_id    = $(`#filterBar${appReportes.PROJECT_NAME} #subsidiaries_id`).val() || '0';
        let estado    = $(`#filtroEstadoPedidosDetalle`).val() || '0';
        let descuento = $(`#filtroDescuentoPedidosDetalle`).val() || 'todos';

        let fi = rangePicker.fi;
        let ff = this._dateModeLocal === 'single' ? rangePicker.fi : rangePicker.ff;

        this._fiLocal = fi;
        this._ffLocal = ff;

        return {
            fi: fi,
            ff: ff,
            sub_id: sub_id,
            estado: estado,
            descuento: descuento
        };
    }

    renderPedidosTotalsBar(totals, parent) {
        const wrapperId = `totalsBar${this.PROJECT_NAME}`;
        $(`#${wrapperId}`).remove();

        $(`#${parent}`).prepend(`<div id="${wrapperId}" class="mb-3 mt-2"></div>`);

        const json = [
            { title: "Pedidos",       data: { value: totals.total_pedidos, color: "text-white" } },
            { title: "Total Bruto",   data: { value: totals.bruto,         color: "text-white" } },
            { title: "Descuentos",    data: { value: totals.descuento,     color: "text-[#FBBF24]" } },
            { title: "Total Neto",    data: { value: totals.neto,          color: "text-[#34D399]" } },
            { title: "Abonado",       data: { value: totals.abono,         color: "text-[#34D399]" } },
            { title: "Saldo",         data: { value: totals.saldo,         color: "text-[#F87171]" } },
            { title: "Efectivo",      data: { value: totals.efectivo,      color: "text-info" } },
            { title: "Tarjeta",       data: { value: totals.tarjeta,       color: "text-[#A78BFA]" } },
            { title: "Transferencia", data: { value: totals.transferencia, color: "text-warning" } },
        ];

        this.coffeeCards({
            parent: wrapperId,
            id:     `kpi${this.PROJECT_NAME}`,
            theme:  "dark",
            class:  "grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-2",
            json:   json
        });
    }


    coffeeCards(options) {
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

        const chipMap = {
            "text-white":     "bg-gray-500/20 text-gray-400",
            "text-[#FBBF24]": "bg-yellow-500/20 text-yellow-400",
            "text-[#34D399]": "bg-green-500/20 text-green-400",
            "text-info":      "bg-blue-500/20 text-blue-400",
            "text-[#A78BFA]": "bg-purple-500/20 text-purple-400",
            "text-warning":   "bg-orange-500/20 text-orange-400",
            "text-[#F87171]": "bg-red-500/20 text-red-400"
        };

        const bgMap = {
            "text-white":     "!bg-gray-500/20 !border-gray-500/40",
            "text-[#FBBF24]": "!bg-yellow-500/20 !border-yellow-500/40",
            "text-[#34D399]": "!bg-green-500/20 !border-green-500/40",
            "text-info":      "!bg-blue-500/20 !border-blue-500/40",
            "text-[#A78BFA]": "!bg-purple-500/20 !border-purple-500/40",
            "text-warning":   "!bg-orange-500/20 !border-orange-500/40",
            "text-[#F87171]": "!bg-red-500/20 !border-red-500/40"
        };

        const cardBase = isDark
            ? "bg-[#1F2A37] border border-gray-700/60 rounded-xl"
            : "bg-white border border-[#e5e7eb] rounded-xl";

        const valuePrimary = isDark ? "text-white" : "text-[#111928]";
        const titlePrimary = isDark ? "text-white" : "text-[#111928]";

        const renderCard = (card, i = "") => {
            const colorKey  = card.data?.color || valuePrimary;
            const chipClass = chipMap[colorKey] || chipMap["text-white"];
            const bgClass   = bgMap[colorKey]   || bgMap["text-white"];

            const box = $("<div>", {
                id: `${opts.id}_${i}`,
                class: `${cardBase} ${bgClass} p-3`
            });

            const topRow = $("<div>", { class: "flex items-start justify-between mb-1 gap-2" });

            const value = $("<p>", {
                id: card.id || "",
                class: `text-xl lg:text-2xl font-bold tabular-nums tracking-tight truncate ${valuePrimary}`,
                text: card.data?.value
            });

            const chip = $("<span>", {
                class: `w-2 h-2 rounded-full mt-2 flex-shrink-0 !${chipClass}`
            });

            topRow.append(value, chip);

            const title = $("<p>", {
                class: `text-xs font-semibold truncate ${titlePrimary}`,
                text: card.title
            });

            box.append(topRow, title);

            if (card.data?.description) {
                const description = $("<p>", {
                    class: `text-[10px] text-gray-500 truncate mt-0.5`,
                    text: card.data.description
                });
                box.append(description);
            }

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

    _stripHtml(html) {
        let tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    _renderPdfTotalsBar(totals) {
        const items = [
            { label: 'Pedidos',        value: totals.total_pedidos },
            { label: 'Total Bruto',    value: totals.bruto },
            { label: 'Descuentos',     value: totals.descuento },
            { label: 'Total Neto',     value: totals.neto, highlight: true },
            { label: 'Abonado',        value: totals.abono },
            { label: 'Saldo',          value: totals.saldo },
            { label: 'Efectivo',       value: totals.efectivo },
            { label: 'Tarjeta',        value: totals.tarjeta },
            { label: 'Transferencia',  value: totals.transferencia },
        ];

        let html = items.map(i => `
            <div class="total-item ${i.highlight ? 'highlight' : ''}">
                <div class="label">${i.label}</div>
                <div class="value">${i.value}</div>
            </div>
        `).join('');

        $(`#pedidos-pdf-totals-bar`).html(html);
    }

    _renderPdfTable(rows) {
        let bodyHtml = '';

        rows.forEach(row => {
            if (row.opc === 1) {
                let cliente   = row.Cliente && row.Cliente.html ? this._stripHtml(row.Cliente.html) : '';
                let total     = row.Total && row.Total.html ? this._stripHtml(row.Total.html) : '';
                let descuento = row.Descuento && row.Descuento.html ? this._stripHtml(row.Descuento.html) : '';
                let totalNeto = row['Total Neto'] && row['Total Neto'].html ? this._stripHtml(row['Total Neto'].html) : '';
                let abono     = row.Abono && row.Abono.html ? this._stripHtml(row.Abono.html) : '';
                let saldo     = row.Saldo && row.Saldo.html ? this._stripHtml(row.Saldo.html) : '';
                let estado    = row.Estado && row.Estado.html ? this._stripHtml(row.Estado.html) : '';

                bodyHtml += `
                    <tr>
                        <td>${row.Folio}</td>
                        <td>${cliente}</td>
                        <td>${row.Fecha}</td>
                        <td class="text-right">${total}</td>
                        <td class="text-right">${descuento}</td>
                        <td class="text-right">${totalNeto}</td>
                        <td class="text-right">${abono}</td>
                        <td class="text-right">${saldo}</td>
                        <td>${row.Entrega}</td>
                        <td class="text-center">${estado}</td>
                    </tr>
                `;
            } else if (row.opc === 0) {
                let itemName = row.Cliente && row.Cliente.html ? this._stripHtml(row.Cliente.html) : '';
                let itemTotal = row.Total && row.Total.html ? this._stripHtml(row.Total.html) : '';

                bodyHtml += `
                    <tr class="pdf-item-row">
                        <td></td>
                        <td>${itemName}</td>
                        <td></td>
                        <td class="text-right">${itemTotal}</td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                    </tr>
                `;
            }
        });

        let tableHtml = `
            <table class="pdf-table">
                <thead>
                    <tr>
                        <th>Folio</th>
                        <th>Cliente</th>
                        <th>Fecha</th>
                        <th class="text-right">Total</th>
                        <th class="text-right">Descuento</th>
                        <th class="text-right">Total Neto</th>
                        <th class="text-right">Abono</th>
                        <th class="text-right">Saldo</th>
                        <th>Entrega</th>
                        <th class="text-center">Estado</th>
                    </tr>
                </thead>
                <tbody>${bodyHtml}</tbody>
            </table>
        `;

        $(`#pedidos-pdf-table-section`).html(tableHtml);
    }

    async printPedidosDetalle() {
        let params  = this.getFilterParams();
        let subName = appReportes.getSubName();

        const data = await useFetch({ url: this._link, data: { opc: "lsPedidosDetalle", ...params } });

        const container = $(`#container-pedidos-detalle`);
        container.empty();

        if (!data.row || data.row.length === 0) {
            container.html(`
                <div class="pdf-document">
                    <div style="text-align:center;padding:40px;color:#9ca3af">
                        No hay datos disponibles para el periodo consultado
                    </div>
                </div>
            `);
            PdfStyles.inject();
            return;
        }

        let now = moment().format('DD/MM/YYYY hh:mm A');

        container.html(`
            <div class="pdf-document">
                <div class="pdf-header">
                    <div>
                        <h2>DETALLES DE PEDIDOS</h2>
                        <div class="meta">Sucursal: <span>${subName}</span></div>
                    </div>
                    <div style="text-align:right;display:flex;align-items:flex-start;gap:12px">
                        <div>
                            <div class="meta">${this._dateModeLocal === 'single' ? 'Dia' : 'Periodo'}: <span>${this._dateModeLocal === 'single' ? params.fi : `${params.fi} al ${params.ff}`}</span></div>
                            <div class="meta">Generado: <span>${now}</span></div>
                        </div>
                        <button onclick="window.print()" class="btn-print">Imprimir</button>
                    </div>
                </div>

                <div class="pdf-totals-bar cols-9" id="pedidos-pdf-totals-bar"></div>

                <div class="pdf-section" id="pedidos-pdf-table-section"></div>

                <div class="pdf-footer">
                    <span>Documento generado automaticamente</span>
                    <span>Pagina 1 de 1</span>
                </div>
            </div>
        `);

        PdfStyles.inject();
        this._renderPdfTotalsBar(data.totals);
        this._renderPdfTable(data.row);
    }
}
