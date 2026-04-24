let api = 'ctrl/ctrl-reportes.php';
let appReportes;
let sucursales = [];
let rol, subId;

$(async () => {
    const data = await useFetch({ url: api, data: { opc: "init" } });

    if (data.status === 403) {
        alert({ icon: "error", title: "Sin permisos", text: "No tienes permisos para acceder a esta sección.", btn1: true, btn1Text: "Aceptar" });
        return;
    }

    sucursales = data.sucursales || [];
    rol        = data.access;
    subId      = data.sub_id;

    appReportes = new AppReportes(api, 'root');
    appReportes.render();
});

class AppReportes extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = "Reportes";
        this.currentTab   = 'corte';
        this.dateMode     = 'single';
    }

    render() {
        this.layout();
        this.createFilterBar();
        this.lsCorte();
    }

    layout() {
        this.primaryLayout({
            parent: "root",
            id: this.PROJECT_NAME,
            class: 'flex mx-2 p-2',
            heightPreset: 'auto',
            card: {
                filterBar: { class: 'w-full', id: 'filterBar' + this.PROJECT_NAME },
                container: { class: 'w-full my-2 bg-[#1F2A37] rounded p-3', id: 'container' + this.PROJECT_NAME }
            }
        });

        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: "dark",
            type: "short",
            json: [
                {
                    id: "corte",
                    tab: "Resumen Corte",
                    active: true,
                    onClick: () => {
                        this.currentTab = 'corte';
                        this.lsCorte();
                    }
                },
                {
                    id: "tickets",
                    tab: "Detalle de Tickets",
                    onClick: () => {
                        this.currentTab = 'tickets';
                        this.lsTickets();
                    }
                },
                {
                    id: "turnos",
                    tab: "Corte de Caja X",
                    onClick: () => {
                        this.currentTab = 'turnos';
                        this.lsShifts();
                    }
                },
                {
                    id: "daily",
                    tab: "Ticket Diario",
                    onClick: () => {
                        this.currentTab = 'daily';
                        this.lsDailyTickets();
                    }
                },
               
               
            ]
        });

        $(`#content-tabs${this.PROJECT_NAME}`).removeClass('h-screen');
    }

    createFilterBar() {
        let filterBar = [];

        if (rol == 1) {
            filterBar.push({
                opc: "select",
                id: "subsidiaries_id",
                lbl: "Filtrar por sucursal:",
                class: "col-12 col-md-3 col-lg-2",
                onchange: "appReportes.refreshCurrentTab()",
                data: [
                    { id: "0", valor: "Todas las sucursales" },
                    ...sucursales
                ]
            });
        }

        filterBar.push(
            {
                opc: "select",
                id: "dateMode" + this.PROJECT_NAME,
                lbl: "Modo de consulta:",
                class: "col-12 col-md-3 col-lg-2",
                onchange: "appReportes.toggleDateMode()",
                data: [
                    { id: "single", valor: "Dia unico" },
                    { id: "range", valor: "Rango de fechas" }
                ]
            },
            {
                opc: "input-calendar",
                class: "col-12 col-md-3 col-lg-2",
                id: "calendar" + this.PROJECT_NAME,
                lbl: "Consultar fecha: ",
            },
            {
                opc: "button",
                class: "col-12 col-md-2 col-lg-1",
                color_btn: "primary",
                id: "btnBuscar",
                text: "Buscar",
                className: 'w-full',
                icono: "icon-search",
                onClick: () => this.refreshCurrentTab()
            }
        );

        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: filterBar
        });

        $(`#dateMode${this.PROJECT_NAME}`).val(this.dateMode);
        this._renderDatePicker();
    }

    _renderDatePicker() {
        const parentId = "calendar" + this.PROJECT_NAME;

        $(`#${parentId}`).empty();

        if (this.dateMode === 'single') {
            dataPicker({
                parent: parentId,
                type: 'simple',
                rangeDefault: {
                    startDate: moment(),
                    singleDatePicker: true,
                    showDropdowns: true,
                    autoApply: true,
                    maxDate: moment(),
                    locale: { format: "DD-MM-YYYY" }
                },
                onSelect: () => this.refreshCurrentTab()
            });
            return;
        }

        dataPicker({
            parent: parentId,
            type: 'all',
            rangepicker: {
                startDate: moment().startOf("day"),
                endDate: moment().endOf("day"),
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
            onSelect: () => this.refreshCurrentTab(),
        });
    }

    toggleDateMode() {
        this.dateMode = $(`#dateMode${this.PROJECT_NAME}`).val();
        this._renderDatePicker();
        this.refreshCurrentTab();
    }

    refreshCurrentTab() {
        switch (this.currentTab) {
            case 'corte':   this.lsCorte(); break;
            case 'tickets': this.lsTickets(); break;
            case 'turnos':  this.lsShifts(); break;
            default:        this.lsDailyTickets(); break;
        }
    }

    getFilterParams() {
        let rangePicker = getDataRangePicker("calendar" + this.PROJECT_NAME);
        let sub_id = $(`#filterBar${this.PROJECT_NAME} #subsidiaries_id`).val() || '0';

        let fi = rangePicker.fi;
        let ff = this.dateMode === 'single' ? rangePicker.fi : rangePicker.ff;

        return {
            fi: fi,
            ff: ff,
            sub_id: sub_id
        };
    }

    // TAB: RESUMEN CORTE
    async lsCorte() {
        let params = this.getFilterParams();
        const data = await useFetch({ url: this._link, data: { opc: "lsCorte", ...params } });

        if (data.status === 403) return;

        const container = $(`#container-corte`);
        container.empty();

        const s          = data.summary || {};
        const c          = data.cuentas || {};
        const p          = data.pagos || {};
        const categorias = data.categorias || [];
        const shifts     = data.shifts || [];

        let subName = 'Todas';
        if (sucursales.length > 0) {
            let found = sucursales.find(x => x.id == params.sub_id);
            if (found) subName = found.valor;
        }1

        let now = moment().format('DD/MM/YYYY hh:mm A');

        container.html(`
            <div class="pdf-document">
                <div class="pdf-header">
                    <div>
                        <h2>CORTE DE CAJA</h2>
                        <div class="meta">Sucursal: <span>${subName}</span></div>
                    </div>
                    <div style="text-align:right;display:flex;align-items:flex-start;gap:12px">
                        <div>
                            <div class="meta">${this.dateMode === 'single' ? 'Dia' : 'Periodo'}: <span>${this.dateMode === 'single' ? params.fi : `${params.fi} al ${params.ff}`}</span></div>
                            <div class="meta">Generado: <span>${now}</span></div>
                        </div>
                        <button onclick="window.print()" class="btn-print">Imprimir</button>
                    </div>
                </div>

                <div class="pdf-totals-bar" id="corte-totals-bar"></div>

                <div class="pdf-grid">
                    <div id="corte-cuentas"></div>
                    <div id="corte-caja"></div>
                    <div id="corte-descuentos"></div>
                    <div id="corte-ventas"></div>
                </div>

                <div class="pdf-grid-bottom">
                    <div id="corte-pago-ventas"></div>
                    <div id="corte-shifts-table"></div>
                </div>

                <div class="pdf-footer">
                    <span>Documento generado automaticamente</span>
                    <span>Pagina 1 de 1</span>
                </div>
            </div>
        `);

        this._injectPdfStyles();
        this._renderCorteTotalsBar(s);
        this._renderCorteCuentas(c);
        this._renderCorteCaja(s, p);
        this._renderCorteDescuentos(c);
        this._renderCorteVentas(categorias, s);
        this._renderCortePagoVentas(p);
        this._renderCorteShiftsTable(shifts);
    }

    _injectPdfStyles() {
        if ($('#pdf-corte-styles').length) return;

        $('head').append(`
            <style id="pdf-corte-styles">
                /* ===== DARK MODE (pantalla) ===== */
                .pdf-document {
                    background: #1a1f2e;
                    color: #d1d5db;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 40px 50px;
                    border-radius: 3px;
                    box-shadow: 0 1px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05);
                    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
                    font-size: 13px;
                }
                .pdf-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 20px;
                    padding-bottom: 14px;
                    border-bottom: 3px double #4b5563;
                }
                .pdf-header h2 {
                    font-size: 20px;
                    font-weight: 700;
                    color: #f3f4f6;
                    letter-spacing: 1.5px;
                }
                .pdf-header .meta {
                    font-size: 12px;
                    color: #9ca3af;
                }
                .pdf-header .meta span {
                    color: #e5e7eb;
                    font-weight: 600;
                }
                .pdf-totals-bar {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                    margin-bottom: 20px;
                }
                .pdf-totals-bar .total-item {
                    padding: 8px 10px;
                    background: #242937;
                    border: 1px solid #374151;
                    border-radius: 4px;
                    border-top: 3px solid #4b5563;
                }
                .pdf-totals-bar .total-item .label {
                    font-size: 9px;
                    color: #9ca3af;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    margin-bottom: 2px;
                    font-weight: 600;
                }
                .pdf-totals-bar .total-item .value {
                    font-size: 15px;
                    font-weight: 700;
                    color: #f3f4f6;
                    font-family: 'Consolas', 'Courier New', monospace;
                }
                .pdf-totals-bar .total-item.highlight {
                    background: #1e3a5f;
                    border-color: #1e3a5f;
                    border-top-color: #3b82f6;
                }
                .pdf-totals-bar .total-item.highlight .label { color: #93c5fd; }
                .pdf-totals-bar .total-item.highlight .value { color: #dbeafe; }
                .pdf-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr 1fr;
                    gap: 12px;
                    margin-bottom: 18px;
                }
                @media (max-width: 900px) { .pdf-grid { grid-template-columns: 1fr 1fr; } }
                @media (max-width: 600px) { .pdf-grid { grid-template-columns: 1fr; } }
                .pdf-section {
                    border: 1px solid #374151;
                    border-radius: 3px;
                    overflow: hidden;
                    background: #1f2937;
                }
                .pdf-section-title {
                    background: linear-gradient(180deg, #2d3748 0%, #252d3a 100%);
                    padding: 8px 14px;
                    font-size: 11px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 1.2px;
                    color: #9ca3af;
                    border-bottom: 1px solid #374151;
                }
                .pdf-section-body { padding: 10px 12px; }
                .pdf-kv {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 4px 0;
                    border-bottom: 1px solid #2d3748;
                }
                .pdf-kv:last-child { border-bottom: none; }
                .pdf-kv .kv-label { color: #9ca3af; font-size: 12px; }
                .pdf-kv .kv-value {
                    font-weight: 600;
                    font-size: 13px;
                    color: #e5e7eb;
                    text-align: right;
                    font-family: 'Consolas', 'Courier New', monospace;
                }
                .pdf-kv.total-row {
                    border-top: 1px solid #4b5563;
                    border-bottom: none;
                    padding-top: 6px;
                    margin-top: 4px;
                    background: #242937;
                    margin-left: -12px;
                    margin-right: -12px;
                    padding-left: 12px;
                    padding-right: 12px;
                    padding-bottom: 5px;
                }
                .pdf-kv.total-row .kv-label { font-weight: 700; color: #e5e7eb; }
                .pdf-kv.total-row .kv-value { font-weight: 800; font-size: 14px; color: #f3f4f6; }
                .pdf-kv .kv-value.negative { color: #f87171; }
                .pdf-sub-title {
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #6b7280;
                    letter-spacing: 1px;
                    margin: 8px 0 4px;
                    padding-bottom: 3px;
                    border-bottom: 1px solid #2d3748;
                }
                .pdf-pct-bar {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    margin-bottom: 5px;
                }
                .pdf-pct-bar .bar {
                    flex: 1;
                    height: 5px;
                    background: #2d3748;
                    border-radius: 2px;
                    overflow: hidden;
                }
                .pdf-pct-bar .bar .fill { height: 100%; border-radius: 2px; }
                .pdf-pct-bar .pct-text {
                    font-size: 9px;
                    color: #9ca3af;
                    min-width: 30px;
                    text-align: right;
                    font-family: 'Consolas', monospace;
                }
                .pdf-grid-bottom {
                    display: grid;
                    grid-template-columns: 1fr 2fr;
                    gap: 12px;
                    margin-bottom: 18px;
                }
                @media (max-width: 768px) { .pdf-grid-bottom { grid-template-columns: 1fr; } }
                table.pdf-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                }
                table.pdf-table thead th {
                    background: linear-gradient(180deg, #2d3748 0%, #252d3a 100%);
                    color: #9ca3af;
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    padding: 6px 10px;
                    text-align: left;
                    border-bottom: 1px solid #374151;
                }
                table.pdf-table tbody tr { border-bottom: 1px solid #2d3748; }
                table.pdf-table tbody tr:nth-child(even) { background: #242937; }
                table.pdf-table tbody td {
                    padding: 5px 10px;
                    color: #e5e7eb;
                    white-space: nowrap;
                    font-family: 'Consolas', 'Courier New', monospace;
                }
                table.pdf-table .text-right { text-align: right; }
                table.pdf-table .text-center { text-align: center; }
                table.pdf-table .col-importe { font-weight: 700; color: #f3f4f6; background: #242937; }
                table.pdf-table .col-efectivo { color: #e5e7eb; font-weight: 600; }
                table.pdf-table .col-tarjeta { color: #e5e7eb; font-weight: 600; }
                .btn-print {
                    background: #3b82f6;
                    color: #fff;
                    border: 1px solid #2563eb;
                    padding: 6px 16px;
                    border-radius: 3px;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                    transition: background 0.2s;
                }
                .btn-print:hover { background: #2563eb; }
                .pdf-footer {
                    margin-top: 24px;
                    padding-top: 12px;
                    border-top: 3px double #4b5563;
                    display: flex;
                    justify-content: space-between;
                    font-size: 10px;
                    color: #6b7280;
                    letter-spacing: 0.5px;
                }

                /* ===== PRINT: revierte a blanco ===== */
                @media print {
                    html, body {
                        height: auto !important;
                        min-height: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                        background: #fff !important;
                    }
                    #menu-navbar, #menu-sidebar { display: none !important; }
                    #mainContainer {
                        margin: 0 !important;
                        padding: 0 !important;
                        height: auto !important;
                        min-height: 0 !important;
                        background: #fff !important;
                    }
                    #root, #Reportes, #singleLayout,
                    [id^="container"], [id^="content-"] {
                        height: auto !important;
                        min-height: 0 !important;
                        overflow: visible !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #fff !important;
                    }
                    #filterBarReportes { display: none !important; }
                    #tabsReportes { display: none !important; }
                    .btn-print { display: none !important; }

                    .pdf-document {
                        background: #fff !important;
                        color: #2c3e50 !important;
                        box-shadow: none !important;
                        margin: 0 !important;
                        padding: 15px !important;
                        max-width: 100% !important;
                    }
                    .pdf-header { border-bottom-color: #2c3e50 !important; }
                    .pdf-header h2 { color: #1a252f !important; }
                    .pdf-header .meta { color: #7f8c8d !important; }
                    .pdf-header .meta span { color: #2c3e50 !important; }

                    .pdf-totals-bar .total-item {
                        background: #f7f9fb !important;
                        border-color: #dce3ea !important;
                        border-top-color: #bdc3c7 !important;
                    }
                    .pdf-totals-bar .total-item .label { color: #7f8c8d !important; }
                    .pdf-totals-bar .total-item .value { color: #2c3e50 !important; }
                    .pdf-totals-bar .total-item.highlight {
                        background: #3d4f5f !important;
                        border-color: #3d4f5f !important;
                        border-top-color: #2c3e50 !important;
                    }
                    .pdf-totals-bar .total-item.highlight .label { color: #b0bec5 !important; }
                    .pdf-totals-bar .total-item.highlight .value { color: #eceff1 !important; }

                    .pdf-section {
                        background: #fff !important;
                        border-color: #dce3ea !important;
                    }
                    .pdf-section-title {
                        background: linear-gradient(180deg, #f0f3f6 0%, #e4e9ee 100%) !important;
                        color: #4a5568 !important;
                        border-bottom-color: #d1d9e0 !important;
                    }
                    .pdf-kv { border-bottom-color: #f0f2f5 !important; }
                    .pdf-kv .kv-label { color: #5a6a7a !important; }
                    .pdf-kv .kv-value { color: #2c3e50 !important; }
                    .pdf-kv.total-row {
                        background: #f7f9fb !important;
                        border-top-color: #95a5a6 !important;
                    }
                    .pdf-kv.total-row .kv-label { color: #2c3e50 !important; }
                    .pdf-kv.total-row .kv-value { color: #1a252f !important; }
                    .pdf-kv .kv-value.negative { color: #943030 !important; }
                    .pdf-sub-title { color: #95a5a6 !important; border-bottom-color: #e8ecf0 !important; }

                    .pdf-pct-bar .bar { background: #e8ecf0 !important; }
                    .pdf-pct-bar .pct-text { color: #7f8c8d !important; }

                    table.pdf-table thead th {
                        background: linear-gradient(180deg, #f0f3f6 0%, #e4e9ee 100%) !important;
                        color: #4a5568 !important;
                        border-bottom-color: #d1d9e0 !important;
                    }
                    table.pdf-table tbody tr { border-bottom-color: #f0f2f5 !important; }
                    table.pdf-table tbody tr:nth-child(even) { background: #fafbfc !important; }
                    table.pdf-table tbody td { color: #2c3e50 !important; }
                    table.pdf-table .col-importe { color: #1a252f !important; background: #f0f3f6 !important; }
                    table.pdf-table .col-efectivo { color: #2c3e50 !important; }
                    table.pdf-table .col-tarjeta { color: #2c3e50 !important; }

                    .pdf-footer { border-top-color: #bdc3c7 !important; color: #95a5a6 !important; }
                }
            </style>
        `);
    }

    _renderCorteTotalsBar(s) {
        const items = [
            { label: 'Desc./Cort.',  value: s.total_descuentos },
            { label: 'Venta Bruta',  value: s.venta_bruta, highlight: true },
            { label: 'Efectivo',     value: s.total_efectivo },
            { label: 'Tarjeta',      value: s.total_tarjeta },
        ];

        let html = items.map(i => `
            <div class="total-item ${i.highlight ? 'highlight' : ''}">
                <div class="label">${i.label}</div>
                <div class="value">${i.value}</div>
            </div>
        `).join('');

        $(`#corte-totals-bar`).html(html);
    }

    _renderPdfSection(parent, title, rows) {
        let rowsHtml = rows.map(r => {
            if (r.isSubTitle) {
                return `<div class="pdf-sub-title">${r.label}</div>`;
            }

            let totalClass = r.total ? ' total-row' : '';
            let valClass   = r.negative ? ' negative' : '';

            return `
                <div class="pdf-kv${totalClass}">
                    <span class="kv-label">${r.label}</span>
                    <span class="kv-value${valClass}">${r.value}</span>
                </div>
            `;
        }).join('');

        $(`#${parent}`).html(`
            <div class="pdf-section">
                <div class="pdf-section-title">${title}</div>
                <div class="pdf-section-body">${rowsHtml}</div>
            </div>
        `);
    }

    _renderCorteCuentas(c) {
        this._renderPdfSection('corte-cuentas', 'Cuentas', [
            { label: 'Total Cuentas',   value: c.total },
            { label: 'Cotizaciones',    value: c.cotizaciones },
            { label: 'Pendientes',      value: c.pendientes },
            { label: 'Pagadas',         value: c.pagadas },
            { label: 'Canceladas',      value: c.canceladas },
            { label: 'Con Descuento',   value: `${c.con_descuento} &mdash; ${c.importe_descuentos}` },
            { label: 'Cuenta Promedio',  value: c.cuenta_promedio },
            { isSubTitle: true, label: 'Folios' },
            { label: 'Folio Inicial',   value: c.folio_inicial },
            { label: 'Folio Final',     value: c.folio_final },
        ]);
    }

    _renderCorteCaja(s, p) {
        this._renderPdfSection('corte-caja', 'Caja', [
            { label: '+ Efectivo Inicial', value: s.efectivo_inicial },
            { label: '+ Efectivo',         value: p.efectivo },
            { label: '+ Tarjeta',          value: p.tarjeta },
            { label: '+ Transferencia',    value: p.transferencia },
            { label: '= Saldo Final',      value: s.saldo_final, total: true },
        ]);
    }

    _renderCorteDescuentos(c) {
        this._renderPdfSection('corte-descuentos', 'Descuentos y Cortesias', [
            { isSubTitle: true, label: 'Cortesias' },
            { label: 'Total Cortesias',  value: '-' },
            { isSubTitle: true, label: 'Descuentos' },
            { label: 'Total Descuentos', value: c.importe_descuentos },
            { label: 'Total',            value: c.importe_descuentos, total: true },
        ]);
    }

    _renderCorteVentas(categorias, s) {
        let totalCategorias = 0;
        categorias.forEach(cat => { totalCategorias += cat.total; });

        let catHtml = '';
        const colors = ['#4a6785', '#7f9bb5', '#a3b8cc', '#5b7d9a', '#6e94b3'];

        categorias.forEach((cat, idx) => {
            let pct = totalCategorias > 0 ? Math.round((cat.total / totalCategorias) * 100) : 0;
            let color = colors[idx % colors.length];

            catHtml += `
                <div class="pdf-kv">
                    <span class="kv-label">${cat.categoria}</span>
                    <span class="kv-value">$${cat.total.toLocaleString('en-US', {minimumFractionDigits:2})} <small style="color:#7f8c8d">(${pct}%)</small></span>
                </div>
                <div class="pdf-pct-bar">
                    <div class="bar"><div class="fill" style="width:${pct}%;background:${color}"></div></div>
                    <span class="pct-text">${pct}%</span>
                </div>
            `;
        });

        $(`#corte-ventas`).html(`
            <div class="pdf-section">
                <div class="pdf-section-title">Ventas</div>
                <div class="pdf-section-body">
                    <div class="pdf-sub-title">Por Tipo de Producto</div>
                    ${catHtml}
                    <div class="pdf-sub-title">Resumen</div>
                    <div class="pdf-kv"><span class="kv-label">Subtotal</span><span class="kv-value">${s.venta_bruta}</span></div>
                    <div class="pdf-kv"><span class="kv-label">- Desc. / Cort.</span><span class="kv-value negative">${s.total_descuentos}</span></div>
                    <div class="pdf-kv"><span class="kv-label">Venta Neta</span><span class="kv-value">${s.venta_neta}</span></div>
                    <div class="pdf-kv total-row"><span class="kv-label">Venta Bruta</span><span class="kv-value">${s.venta_bruta}</span></div>
                </div>
            </div>
        `);
    }

    _renderCortePagoVentas(p) {
        this._renderPdfSection('corte-pago-ventas', 'Forma de Pago Ventas', [
            { label: 'Efectivo',      value: p.efectivo },
            { label: 'Tarjeta',       value: p.tarjeta },
            { label: 'Transferencia', value: p.transferencia },
        ]);
    }

    _renderCorteShiftsTable(shifts) {
        if (!shifts.length) {
            $(`#corte-shifts-table`).html(`
                <div class="pdf-section">
                    <div class="pdf-section-title">Corte de Caja X</div>
                    <div class="pdf-section-body" style="text-align:center;color:#95a5a6;padding:20px">No hay turnos en este periodo</div>
                </div>
            `);
            return;
        }

        let rows = shifts.map(shift => `
            <tr>
                <td>${shift.employee_name}</td>
                <td>${shift.opened_at}</td>
                <td>${shift.closed_at}</td>
                <td class="text-right col-importe">${shift.total_sales}</td>
                <td class="text-right col-efectivo">${shift.total_cash}</td>
                <td class="text-right col-tarjeta">${shift.total_card}</td>
            </tr>
        `).join('');

        $(`#corte-shifts-table`).html(`
            <div class="pdf-section">
                <div class="pdf-section-title" style="display:flex;justify-content:space-between;align-items:center">
                    <span>Corte de Caja X</span>
                    <span style="font-size:10px;color:#95a5a6;font-weight:400">GERENTE</span>
                </div>
                <div style="overflow-x:auto">
                    <table class="pdf-table">
                        <thead>
                            <tr>
                                <th>Responsable</th>
                                <th>Apertura</th>
                                <th>Cierre</th>
                                <th class="text-right">Total</th>
                                <th class="text-right">Efectivo</th>
                                <th class="text-right">Tarjeta</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `);
    }

    // TAB: DETALLE DE TICKETS
    async lsTickets() {
        let params = this.getFilterParams();

        const container = $(`#container-tickets`);
        container.empty();
        container.html(`<div id="tickets-table-container"></div>`);

        this._loadAllTickets(params);
    }

    async _loadAllTickets(params) {
        const data = await useFetch({ url: this._link, data: { opc: "lsShiftsWithTickets", ...params } });
        this._allTicketsData = data;

        this.createCoffeeTable3({
            parent: 'tickets-table-container',
            id: `tb${this.PROJECT_NAME}Tickets`,
            theme: 'dark',
            title: 'Detalle de Tickets por Turno',
            subtitle: 'Haz clic en un turno para ver sus tickets',
            center: [3, 4],
            right: [5, 6, 7, 8, 9],
            extends: true,
            scrollable: false,
            folding: true,
            collapsed: true,
            data: data,
        });

        if (data.totals) {
            this.renderTotalsBar(data.totals, 'tickets-table-container');
        }
    }

    renderTotalsBar(totals, parent) {
        let existingBar = $(`#totalsBar${this.PROJECT_NAME}`);
        if (existingBar.length) existingBar.remove();

        let html = `
            <div id="totalsBar${this.PROJECT_NAME}" class="row g-2 mb-3 mt-2">
                <div class="col">
                    <div class="p-2 rounded text-center" style="background:#283341;border:1px solid #374151">
                        <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase">Total Tickets</div>
                        <div class="fw-bold text-white" style="font-size:15px">${totals.total_tickets}</div>
                    </div>
                </div>
                <div class="col">
                    <div class="p-2 rounded text-center" style="background:#283341;border:1px solid #10B981">
                        <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase">Importe Total</div>
                        <div class="fw-bold" style="font-size:15px;color:#34D399">${totals.importe}</div>
                    </div>
                </div>
                <div class="col">
                    <div class="p-2 rounded text-center" style="background:#283341;border:1px solid #374151">
                        <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase">Efectivo</div>
                        <div class="fw-bold text-info" style="font-size:15px">${totals.efectivo}</div>
                    </div>
                </div>
                <div class="col">
                    <div class="p-2 rounded text-center" style="background:#283341;border:1px solid #374151">
                        <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase">Tarjeta</div>
                        <div class="fw-bold" style="font-size:15px;color:#A78BFA">${totals.tarjeta}</div>
                    </div>
                </div>
                <div class="col">
                    <div class="p-2 rounded text-center" style="background:#283341;border:1px solid #374151">
                        <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase">Transferencia</div>
                        <div class="fw-bold text-warning" style="font-size:15px">${totals.transferencia}</div>
                    </div>
                </div>
                <div class="col">
                    <div class="p-2 rounded text-center" style="background:#283341;border:1px solid #374151">
                        <div style="font-size:10px;color:#9CA3AF;text-transform:uppercase">Descuentos</div>
                        <div class="fw-bold text-danger" style="font-size:15px">${totals.descuento}</div>
                    </div>
                </div>
            </div>
        `;

        $(`#${parent}`).prepend(html);
    }

    // TAB: CORTE DE CAJA X (TURNOS)
    async lsShifts() {
        let params = this.getFilterParams();
        const data = await useFetch({ url: this._link, data: { opc: "lsShifts", ...params } });

        this.createCoffeeTable3({
            parent: 'container-turnos',
            id: `tb${this.PROJECT_NAME}Shifts`,
            theme: 'dark',
            title: 'Corte de Caja X',
            subtitle: '',
            center: [8, 9],
            right: [4, 5, 6, 7],
            extends: true,
            scrollable: false,
            data: data,
        });

        simple_data_table(`#tb${this.PROJECT_NAME}Shifts`, 15);
    }

    // TAB: TICKET DIARIO
    async lsDailyTickets() {
        let params = this.getFilterParams();
        const data = await useFetch({ url: this._link, data: { opc: "lsDailyTickets", ...params } });

        this.createCoffeeTable3({
            parent: 'container-daily',
            id: `tb${this.PROJECT_NAME}Daily`,
            theme: 'dark',
            title: 'Ticket Diario',
            subtitle: '',
            center: [2],
            right: [3, 4, 5, 6, 7],
            extends: true,
            scrollable: false,
            data: data,
        });

        if (data.totals) {
            this.renderTotalsBar(data.totals, 'container-daily');
        }

        simple_data_table(`#tb${this.PROJECT_NAME}Daily`, 25);
    }

    // IMPRESION
    printReport() {
        let params = this.getFilterParams();
        let subName = '';
        if (sucursales.length > 0) {
            let found = sucursales.find(s => s.id == params.sub_id);
            subName = found ? found.valor : 'Todas';
        }

        switch (this.currentTab) {
            case 'corte':   window.print(); break;
            case 'tickets': this.printTicketsReport(params, subName); break;
            default:        this.printShiftsReport(params, subName); break;
        }
    }

    async printTicketsReport(params, subName) {
        const data = await useFetch({ url: this._link, data: { opc: "lsTickets", ...params } });

        if (!data.row || data.row.length === 0) {
            alert({ icon: "info", text: "No hay datos para imprimir.", btn1: true, btn1Text: "Aceptar" });
            return;
        }

        const t = data.totals;
        let rowsHtml = '';
        data.row.forEach(r => {
            rowsHtml += `
                <tr>
                    <td>${r['Folio']}</td>
                    <td>${r['Fecha']}</td>
                    <td>${r['Cuenta']}</td>
                    <td class="text-right">${r['Descuento'].html}</td>
                    <td class="text-right" style="font-weight:bold;background:#f0f0f0">${r['Importe'].html}</td>
                    <td class="text-right">${r['Efectivo'].html}</td>
                    <td class="text-right">${r['Tarjeta'].html}</td>
                    <td class="text-right">${r['Transferencia'].html}</td>
                </tr>
            `;
        });

        let printContent = `
            <html>
            <head>
                <title>Reporte de Tickets</title>
                <style>
                    * { margin:0; padding:0; box-sizing:border-box; }
                    body { font-family:'Courier New',monospace; font-size:11px; color:#000; padding:10px; }
                    h2 { text-align:center; margin-bottom:5px; font-size:14px; }
                    .info { text-align:center; margin-bottom:10px; font-size:11px; color:#555; }
                    table { width:100%; border-collapse:collapse; margin-bottom:10px; }
                    th, td { border:1px solid #999; padding:3px 5px; font-size:10px; }
                    th { background:#ddd; font-weight:bold; text-align:center; }
                    .text-right { text-align:right; }
                    .totals-row { font-weight:bold; background:#eee; }
                    .summary { margin-top:10px; }
                    .summary table { width:auto; margin:0 auto; }
                    .summary td { padding:2px 10px; border:none; }
                    .summary .label { text-align:right; font-weight:bold; }
                    .summary .value { text-align:right; }
                    @media print { body { padding:5px; } }
                </style>
            </head>
            <body>
                <h2>DETALLE DE TICKETS</h2>
                <p class="info">Sucursal: ${subName} | ${params.fi === params.ff ? `Dia: ${params.fi}` : `Periodo: ${params.fi} al ${params.ff}`}</p>
                <table>
                    <thead>
                        <tr>
                            <th>FOLIO</th><th>FECHA</th><th>CUENTA</th>
                            <th>DESCUENTO</th><th>IMPORTE</th>
                            <th>EFECTIVO</th><th>TARJETA</th><th>TRANSFERENCIA</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                        <tr class="totals-row">
                            <td colspan="3" class="text-right">TOTALES:</td>
                            <td class="text-right">${t.descuento}</td>
                            <td class="text-right">${t.importe}</td>
                            <td class="text-right">${t.efectivo}</td>
                            <td class="text-right">${t.tarjeta}</td>
                            <td class="text-right">${t.transferencia}</td>
                        </tr>
                    </tbody>
                </table>
                <div class="summary">
                    <table>
                        <tr><td class="label">TOTAL TICKETS:</td><td class="value">${t.total_tickets}</td></tr>
                        <tr><td class="label">EFECTIVO:</td><td class="value">${t.efectivo}</td></tr>
                        <tr><td class="label">TARJETA:</td><td class="value">${t.tarjeta}</td></tr>
                        <tr><td class="label">TRANSFERENCIA:</td><td class="value">${t.transferencia}</td></tr>
                        <tr><td class="label" style="border-top:2px solid #000;padding-top:5px">VENTA BRUTA:</td><td class="value" style="border-top:2px solid #000;padding-top:5px;font-weight:bold">${t.importe}</td></tr>
                    </table>
                </div>
            </body>
            </html>
        `;

        let printWindow = window.open('', '_blank', 'width=900,height=700');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }

    async printShiftsReport(params, subName) {
        const data = await useFetch({ url: this._link, data: { opc: "lsShifts", ...params } });

        if (!data.row || data.row.length === 0) {
            alert({ icon: "info", text: "No hay turnos para imprimir.", btn1: true, btn1Text: "Aceptar" });
            return;
        }

        let rowsHtml = '';
        data.row.forEach(r => {
            rowsHtml += `
                <tr>
                    <td>${r['Responsable']}</td>
                    <td class="text-center">${r['Apertura']}</td>
                    <td class="text-center">${r['Cierre']}</td>
                    <td class="text-right" style="font-weight:bold;background:#f0f0f0">${r['Total'].html}</td>
                    <td class="text-right">${r['Efectivo'].html}</td>
                    <td class="text-right">${r['Tarjeta'].html}</td>
                    <td class="text-right">${r['Transferencia'].html}</td>
                    <td class="text-center">${r['Pedidos'].html}</td>
                    <td class="text-center">${r['Estado']}</td>
                </tr>
            `;
        });

        let printContent = `
            <html>
            <head>
                <title>Reporte de Turnos</title>
                <style>
                    * { margin:0; padding:0; box-sizing:border-box; }
                    body { font-family:'Courier New',monospace; font-size:11px; color:#000; padding:10px; }
                    h2 { text-align:center; margin-bottom:5px; font-size:14px; }
                    .info { text-align:center; margin-bottom:10px; font-size:11px; color:#555; }
                    table { width:100%; border-collapse:collapse; }
                    th, td { border:1px solid #999; padding:3px 5px; font-size:10px; }
                    th { background:#ddd; font-weight:bold; text-align:center; }
                    .text-right { text-align:right; }
                    .text-center { text-align:center; }
                    @media print { body { padding:5px; } }
                </style>
            </head>
            <body>
                <h2>**** CORTE DE CAJA ****</h2>
                <p class="info">Sucursal: ${subName} | ${params.fi === params.ff ? `Dia: ${params.fi}` : `Periodo: ${params.fi} al ${params.ff}`}</p>
                <table>
                    <thead>
                        <tr>
                            <th>RESPONSABLE</th><th>APERTURA</th><th>CIERRE</th>
                            <th>TOTAL</th><th>EFECTIVO</th><th>TARJETA</th>
                            <th>TRANSFERENCIA</th><th>PEDIDOS</th><th>ESTADO</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </body>
            </html>
        `;

        let printWindow = window.open('', '_blank', 'width=1000,height=700');
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }
}
