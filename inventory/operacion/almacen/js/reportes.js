let api = 'ctrl/ctrl-reportes.php';
let app, reportes, reportesView;

let branchId;

const VIEW_HEADER_REPORTES = {
    title:    'Reportes de inventario',
    subtitle: 'Inventario rápido y conteo físico · semanal y mensual'
};

const TIPOS_REPORTE = [
    {
        id:    'semanal',
        valor: 'Semanal'
    },
    {
        id:    'mensual',
        valor: 'Mensual'
    }
];

// Renglones del bloque de cada producto en el reporte completo. 'conceptos' se
// reemplaza por un renglón por cada tipo de entrada o motivo de salida que el
// producto tuvo en el periodo (Entrada · Compra, Salida por venta, Traspaso enviado...).
const MOVIMIENTOS_REPORTE = [
    {
        key:   'inicial',
        label: 'Existencia inicial',
        tipo:  'existencia'
    },
    {
        key:   'conceptos',
        label: '',
        tipo:  'captura'
    },
    {
        key:   'teorico',
        label: 'Teórico almacén',
        tipo:  'calculo'
    },
    {
        key:   'fisico',
        label: 'Físico almacén',
        tipo:  'fisico'
    },
    {
        key:   'diferencia',
        label: 'Diferencia almacén',
        tipo:  'calculo'
    }
];

// Sencillo: entradas y salidas en general (ventas + salidas + desperdicio en un solo renglón).
const MOVIMIENTOS_SENCILLO = [
    {
        key:   'inicial',
        label: 'Existencia inicial',
        tipo:  'existencia'
    },
    {
        key:   'entradas',
        label: 'Entradas',
        tipo:  'captura'
    },
    {
        key:   'salidas_total',
        label: 'Salidas',
        tipo:  'captura'
    },
    {
        key:   'teorico',
        label: 'Teórico almacén',
        tipo:  'calculo'
    }
];

$(async () => {
    reportesView = new ReportesView(api, 'root');
    reportes     = new Reportes(api, 'root');
    app          = new App(api, 'root');
    await app.init();
});


// -- Clase principal --

class App extends Templates {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Reportes';
        this.branchId     = null;
        this.dataInit     = {};
    }

    // -- Interface --

    async init() {
        const r = await useFetch({
            url:  api,
            data: {
                opc: 'init'
            }
        });
        const ok = r && r.status === 200;

        this.dataInit = {
            branch_id:  ok ? (r.branch_id  || '') : '',
            sucursales: ok ? (r.sucursales || []) : [],
            almacenes:  ok ? (r.almacenes  || []) : [],
            areas:      ok ? (r.areas      || []) : [],
            categorias: ok ? (r.categorias || []) : []
        };

        this.branchId = this.dataInit.branch_id;
        branchId      = this.branchId;

        this.render();
    }

    render() {
        this.layout();
        this.visorResize({
            key:   'reportes',
            label: 'Ancho de la vista previa',
            width: 860,
            min:   520,
            max:   1600
        });
        this.filterBar();
        this.renderHeader();
        reportes.lsReportes();
    }

    layout() {
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'cs-visor flex-1 min-h-0 w-full flex flex-col overflow-hidden bg-white rounded-lg border border-gray-200',
                container: [
                    {
                        type:  'div',
                        id:    'viewHeader',
                        class: 'flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0'
                    },
                    {
                        type:  'div',
                        id:    'filterBar',
                        class: 'px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0'
                    },
                    {
                        type:  'div',
                        id:    `body${this.PROJECT_NAME}`,
                        class: 'flex-1 min-h-0 w-full flex flex-col overflow-hidden'
                    }
                ]
            }
        });

        // Lista de periodos a la izquierda y vista previa a la derecha: visorResize
        // mide el panel derecho, por eso la hoja es la que se redimensiona.
        this.createLayout({
            parent: `body${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:        'reportBody',
                class:     'flex-1 min-h-0 w-full flex flex-col md:flex-row overflow-hidden',
                container: [
                    {
                        type:  'div',
                        id:    'listPanel',
                        class: 'flex-1 min-w-0 md:min-w-[320px] min-h-[280px] md:min-h-0 flex flex-col overflow-hidden bg-white border-b md:border-b-0 md:border-r border-gray-200'
                    },
                    {
                        type:  'div',
                        id:    'detailResizer',
                        class: "hidden md:block relative z-[5] flex-shrink-0 w-[6px] -mx-[3px] cursor-col-resize touch-none after:content-[''] after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] after:-translate-x-1/2 after:rounded-full after:transition-colors hover:after:bg-gray-400"
                    },
                    {
                        type:     'div',
                        id:       'detailPanel',
                        class:    'w-full md:w-[var(--reportes-detail-w,860px)] md:max-w-[75vw] min-h-[420px] md:min-h-0 flex-shrink-0 flex flex-col overflow-hidden bg-white',
                        children: [
                            {
                                id:    'reportToolbar',
                                class: 'flex-shrink-0 border-b border-gray-200 bg-gray-50'
                            },
                            {
                                id:    'reportPreview',
                                class: 'flex-1 min-h-0 overflow-auto bg-gray-100 p-4'
                            }
                        ]
                    }
                ]
            }
        });
    }

    renderHeader() {
        const sucursales = this.dataInit.sucursales || [];
        const selected   = $('#fSucursal').val() || this.branchId;
        const branch     = sucursales.find(s => String(s.id) === String(selected));
        const branchName = branch ? (branch.valor || '') : '';

        const titleHtml = branchName
            ? `${VIEW_HEADER_REPORTES.title} <span class="font-bold" style="color:rgb(var(--brand-600, 192 90 64));">&middot; ${esc(branchName)}</span>`
            : VIEW_HEADER_REPORTES.title;

        reportesView.renderHeader(Object.assign({}, VIEW_HEADER_REPORTES, { titleHtml }));
    }

    filterBar() {
        const withAll = (list, label) => [
            {
                id:    '',
                valor: label
            }
        ].concat(list || []);

        const filters = [
            {
                opc:      'select',
                id:       'fTipo',
                lbl:      'Reporte:',
                class:    'col-6 col-md-3 col-xl-1',
                onchange: 'app.onChangeType()',
                value:    'semanal',
                data:     TIPOS_REPORTE
            },
            {
                opc:   'input-calendar',
                id:    `calendar${this.PROJECT_NAME}`,
                lbl:   'Periodo:',
                class: 'col-6 col-md-3 col-xl-1'
            },
            {
                opc:      'select',
                id:       'fSucursal',
                lbl:      'Sucursal:',
                class:    'col-6 col-md-3 col-xl-1',
                onchange: 'app.onChangeBranch()',
                value:    '',
                data:     withAll(this.dataInit.sucursales, 'Todas las sucursales')
            },
            {
                opc:      'select',
                id:       'fAlmacen',
                lbl:      'Almacén:',
                class:    'col-6 col-md-3 col-xl-1',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     withAll(this.warehousesOf(this.branchId), 'Todos los almacenes')
            },
            {
                opc:      'select',
                id:       'fArea',
                lbl:      'Área:',
                class:    'col-6 col-md-3 col-xl-1',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     withAll(this.dataInit.areas, 'Todas')
            },
            {
                opc:      'select',
                id:       'fCategoria',
                lbl:      'Categoría:',
                class:    'col-6 col-md-3 col-xl-1',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     withAll(this.dataInit.categorias, 'Todas')
            },
            {
                opc:      'select',
                id:       'fProductos',
                lbl:      'Productos:',
                class:    'col-6 col-md-3 col-xl-1',
                onchange: 'app.onChangeProducts()',
                value:    '0',
                data:     [
                    {
                        id:    '0',
                        valor: 'Todos'
                    },
                    {
                        id:    '1',
                        valor: 'Solo con movimiento'
                    }
                ]
            }
        ];

        this.createfilterBar({
            parent:     'filterBar',
            id:         `filterBar${this.PROJECT_NAME}`,
            coffeesoft: true,
            theme:      'light',
            data:       filters
        });

        // Los 7 filtros miden lo mismo: en pantalla grande la rejilla pasa de 12 a 7 columnas.
        $(`#filterBar${this.PROJECT_NAME}`).addClass('xl:grid-cols-7');

        // Con una sola sucursal el select queda fijo (sin "Todas" y deshabilitado).
        const sucs = this.dataInit.sucursales || [];
        if (sucs.length <= 1) {
            $('#fSucursal').find('option[value=""]').remove();
            $('#fSucursal').val(this.branchId).prop('disabled', true);
        } else {
            $('#fSucursal').val(this.branchId);
        }
        this.fillWarehouses();

        const range = this.defaultRange('semanal');

        dataPicker({
            parent: `calendar${this.PROJECT_NAME}`,
            rangepicker: {
                startDate:     range.start,
                endDate:       range.end,
                showDropdowns: true,
                autoApply:     true,
                locale:        {
                    format: 'DD-MM-YYYY'
                },
                ranges: {
                    'Hoy':              [moment(), moment()],
                    'Últimos 7 días':   [moment().subtract(6, 'days'), moment()],
                    'Semana actual':    [moment().startOf('isoWeek'), moment()],
                    'Mes actual':       [moment().startOf('month'), moment()],
                    'Mes anterior':     [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')],
                    'Últimos 3 meses':  [moment().subtract(2, 'months').startOf('month'), moment()]
                }
            },
            onSelect: () => this.onChangeFilters()
        });
    }

    // -- Complements --

    getFilters() {
        const picker = $(`#calendar${this.PROJECT_NAME}`).data('daterangepicker');
        const range  = picker ? getDataRangePicker(`calendar${this.PROJECT_NAME}`) : {};

        return {
            tipo:            $('#fTipo').val()       || 'semanal',
            fi:              range.fi                || '',
            ff:              range.ff                || '',
            branch_id:       $('#fSucursal').val()   || '',
            warehouse_id:    $('#fAlmacen').val()    || '',
            area_id:         $('#fArea').val()       || '',
            category_id:     $('#fCategoria').val()  || '',
            solo_movimiento: $('#fProductos').val()  || '0'
        };
    }

    // Al cambiar de tipo el rango salta a uno que muestre varios periodos de ese tipo.
    onChangeType() {
        const picker = $(`#calendar${this.PROJECT_NAME}`).data('daterangepicker');
        const range  = this.defaultRange($('#fTipo').val());

        if (picker) {
            picker.setStartDate(range.start);
            picker.setEndDate(range.end);
        }
        reportes.lsReportes();
    }

    onChangeBranch() {
        this.fillWarehouses();
        this.renderHeader();
        reportes.lsReportes();
    }

    onChangeFilters() {
        reportes.lsReportes();
    }

    // "Solo con movimiento" no cambia los periodos, solo los renglones de la hoja.
    onChangeProducts() {
        if (reportes.selectedKey) reportes.getReporte(reportes.selectedKey);
    }

    onBranchChange(detail) {
        if (detail && detail.id != null) {
            this.branchId = detail.id;
            branchId      = this.branchId;
        }

        if ($(`#fSucursal option[value="${this.branchId}"]`).length) {
            $('#fSucursal').val(this.branchId);
        }

        this.fillWarehouses();
        this.renderHeader();
        reportes.lsReportes();
    }

    fillWarehouses() {
        const $sel    = $('#fAlmacen');
        const current = $sel.val() || '';
        const list    = [
            {
                id:    '',
                valor: 'Todos los almacenes'
            }
        ].concat(this.warehousesOf($('#fSucursal').val() || ''));

        $sel.empty().append(list.map(a => $('<option>', {
            value: a.id,
            text:  a.valor
        })));
        $sel.val(list.some(a => String(a.id) === String(current)) ? current : '');
    }

    warehousesOf(branch) {
        const all = this.dataInit.almacenes || [];
        if (!branch) return all;
        return all.filter(a => String(a.branch_id) === String(branch));
    }

    defaultRange(tipo) {
        if (tipo === 'mensual') {
            return {
                start: moment().subtract(2, 'months').startOf('month'),
                end:   moment()
            };
        }

        return {
            start: moment().startOf('isoWeek').subtract(3, 'weeks'),
            end:   moment()
        };
    }
}


// -- Reportes --

class Reportes extends Templates {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Reportes';
        this.items        = [];
        this.selectedKey  = null;
        this.reporte      = null;
        this.mode         = 'completo';
        this.zoom         = 100;
        this.listToken    = 0;
        this.sheetToken   = 0;
        this.EXCELJS      = 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js';
        this.ALTO_TITULOS = [18, 14, 12, 13, 22];
        this.ALTO_FILA    = 11;
        this.ALTO_BANDA   = 12;
        this.GRIS         = 'FFF3F4F6';
        this.GRIS_NA      = 'FFD1D5DB';
        this.AMARILLO     = 'FFFEF3C7';
        this.FORMATO_NUM  = 'General;-General;"-"';
    }

    // -- CRUD --

    // Un token por petición: si el usuario cambia filtros rápido, solo pinta la última.
    async lsReportes() {
        const f     = app.getFilters();
        const token = ++this.listToken;

        this.items       = [];
        this.selectedKey = null;
        this.reporte     = null;

        reportesView.renderList({
            items:   [],
            tipo:    f.tipo,
            loading: true
        });
        this.renderToolbar();
        reportesView.renderLoading('Cargando periodos...');

        const r = await useFetch({
            url:  api,
            data: {
                opc:          'lsReportes',
                tipo:         f.tipo,
                fi:           f.fi,
                ff:           f.ff,
                branch_id:    f.branch_id,
                warehouse_id: f.warehouse_id,
                area_id:      f.area_id,
                category_id:  f.category_id
            }
        });
        if (token !== this.listToken) return;

        this.items = (r && r.status === 200) ? (r.data || []) : [];
        const first = this.items.length ? this.items[0].key : null;

        reportesView.renderList({
            items:    this.items,
            tipo:     f.tipo,
            selected: first,
            onSelect: (item) => this.getReporte(item.key)
        });

        if (first) {
            this.getReporte(first);
            return;
        }

        reportesView.renderEmpty((r && r.message) || 'No hay periodos en el rango elegido. Selecciona un periodo de la lista.');
    }

    async getReporte(key) {
        const item = this.items.find(i => i.key === key);
        if (!item) return;

        const f     = app.getFilters();
        const token = ++this.sheetToken;

        this.selectedKey = key;
        this.reporte     = null;
        this.renderToolbar();
        reportesView.renderLoading(`Generando ${item.label}...`);

        const r = await useFetch({
            url:  api,
            data: {
                opc:             'getReporte',
                tipo:            item.tipo || f.tipo,
                fi:              item.fi,
                ff:              item.ff,
                branch_id:       f.branch_id,
                warehouse_id:    f.warehouse_id,
                area_id:         f.area_id,
                category_id:     f.category_id,
                solo_movimiento: f.solo_movimiento
            }
        });
        if (token !== this.sheetToken) return;

        if (!r || r.status !== 200 || !r.data) {
            reportesView.renderEmpty((r && r.message) || 'No se pudo generar el reporte.', 'file-x');
            return;
        }

        this.reporte = r.data;
        this.renderToolbar();
        reportesView.renderSheet(this.reporte, this.mode, this.zoom);
    }

    printReporte() {
        const printed = !!this.reporte && reportesView.printSheet({
            title: this.fileName('').replace(/_$/, '')
        });
        if (printed) return;

        this.alertBox({
            type:  'warning',
            theme: 'light',
            title: 'Selecciona un periodo antes de imprimir',
            timer: 2000
        });
    }

    async downloadReporte() {
        if (!this.reporte) {
            this.alertBox({
                type:  'warning',
                theme: 'light',
                title: 'Selecciona un periodo antes de descargar',
                timer: 2000
            });
            return;
        }

        try {
            await this.loadExcelJS();
        } catch (e) {
            this.alertBox({
                type:  'error',
                theme: 'light',
                title: 'No se pudo cargar el generador de Excel. Revisa la conexión.',
                timer: 3000
            });
            return;
        }

        try {
            const data     = this.reporte;
            const workbook = new ExcelJS.Workbook();
            workbook.creator = data.usuario || 'CoffeeSoft';

            const hojas  = this.sheetReport(workbook, data, this.mode);
            const buffer = await workbook.xlsx.writeBuffer();
            const link   = document.createElement('a');

            link.href     = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
            link.download = this.fileName('.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(link.href), 1000);

            this.alertBox({
                type:  'success',
                theme: 'light',
                title: `Reporte listo: ${(data.rows || []).length} productos en ${hojas} hojas`,
                timer: 2000
            });
        } catch (e) {
            console.error('[reportes] Excel:', e);
            this.alertBox({
                type:  'error',
                theme: 'light',
                title: 'No se pudo generar el Excel',
                timer: 2500
            });
        }
    }

    // -- Complements --

    renderToolbar() {
        reportesView.renderToolbar({
            mode:    this.mode,
            zoom:    this.zoom,
            enabled: !!this.reporte,
            periodo: this.reporte ? this.reporte.titulo_periodo : '',
            onMode:  (mode) => this.setMode(mode),
            onZoom:  (zoom) => this.setZoom(zoom),
            onPrint: () => this.printReporte(),
            onExcel: () => this.downloadReporte()
        });
    }

    // Cambiar de modo no consulta: repinta con el reporte que ya está en memoria.
    setMode(mode) {
        this.mode = mode === 'sencillo' ? 'sencillo' : 'completo';
        this.renderToolbar();
        if (this.reporte) reportesView.renderSheet(this.reporte, this.mode, this.zoom);
    }

    // Zoom solo de la vista previa (50% a 200%); no cambia la impresión ni el Excel.
    setZoom(zoom) {
        this.zoom = Math.min(200, Math.max(50, zoom));
        this.renderToolbar();
        $('#rptSheet').css('zoom', this.zoom / 100);
    }

    // Renglones de un producto con sus valores por columna y su total (null = no suma).
    movementRows(mode, p) {
        const base     = mode === 'sencillo' ? MOVIMIENTOS_SENCILLO : MOVIMIENTOS_REPORTE;
        const valores  = p.valores || {};
        const totales  = p.totales || {};
        const sumables = ['entradas', 'salidas_total', 'diferencia'];
        const rows     = [];

        base.forEach((m) => {
            if (m.key === 'conceptos') {
                (p.conceptos || []).forEach((c) => rows.push({
                    key:     c.sentido,
                    label:   c.label,
                    tipo:    'captura',
                    valores: c.valores || [],
                    suma:    true,
                    total:   c.total
                }));
                return;
            }

            rows.push(Object.assign({}, m, {
                valores: valores[m.key] || [],
                suma:    sumables.includes(m.key),
                total:   sumables.includes(m.key) ? totales[m.key] : null
            }));
        });

        return rows;
    }

    fileName(ext) {
        const d = this.reporte || {};
        return `Inventario_${d.tipo || 'reporte'}_${d.fi || ''}_${d.ff || ''}${ext}`;
    }

    // Saltos de página a mano: cada área empieza en hoja nueva y ningún producto
    // queda partido entre dos hojas. El área se repite arriba de la hoja que continúa.
    sheetReport(workbook, data, mode) {
        const ws    = workbook.addWorksheet('Inventario', {
            views: [
                {
                    state:  'frozen',
                    ySplit: 5
                }
            ]
        });
        const cols  = data.columnas || [];
        const total = cols.length + 5;

        this.setColumns(ws, data.tipo, cols);
        this.sheetHeader(ws, data, cols, mode);

        const escala   = this.printScale(ws);
        const altoUtil = ((7.6 * 72) / (escala / 100) - this.ALTO_TITULOS.reduce((a, b) => a + b, 0)) * 0.95;

        let r = 6, usado = 0, hojas = 1, area = null;

        (data.rows || []).forEach((p) => {
            const movs   = this.movementRows(mode, p);
            const bloque = movs.length * this.ALTO_FILA;
            let banda    = p.area_id !== area;

            if (usado > 0 && (banda || usado + bloque > altoUtil)) {
                ws.getRow(r - 1).addPageBreak();
                usado = 0;
                hojas++;
                banda = true;
            }

            if (banda) {
                this.areaBand(ws, r, p, p.area_id === area, total);
                area = p.area_id;
                usado += this.ALTO_BANDA;
                r++;
            }

            this.productBlock(ws, r, p, movs, cols);
            usado += bloque;
            r += movs.length;
        });

        this.summaryRows(ws, r + 1, data, total, mode);

        const pie = (t) => String(t || '').replace(/&/g, '&&');

        ws.pageSetup = {
            paperSize:          1,
            orientation:        'landscape',
            scale:              escala,
            fitToPage:          false,
            horizontalCentered: true,
            printTitlesRow:     '1:5',
            margins:            {
                left:   0.25,
                right:  0.25,
                top:    0.4,
                bottom: 0.45,
                header: 0.2,
                footer: 0.2
            }
        };
        ws.headerFooter.oddFooter = `&L&8Almacén: ${pie(data.almacen)}&C&8Hoja &P de &N&R&8${pie(data.titulo_periodo)}`;

        return hojas;
    }

    // Renglones 1-5, los que se repiten en cada hoja impresa.
    sheetHeader(ws, data, cols, mode) {
        const total   = cols.length + 5;
        const derecha = total >= 10 ? 4 : 2;
        const finIzq  = this.colLetter(total - derecha);
        const iniDer  = this.colLetter(total - derecha + 1);
        const fin     = this.colLetter(total);
        const gen     = String(data.generado || '');

        this.mergeText(ws, `A1:${finIzq}1`, this.reportTitle(mode), {
            bold: true,
            size: 13
        });
        this.mergeText(ws, `${iniDer}1:${fin}1`, fmtLongDate(gen), { h: 'right' });
        this.mergeText(ws, `A2:${finIzq}2`, data.empresa || '', {
            bold: true,
            size: 10
        });
        this.mergeText(ws, `${iniDer}2:${fin}2`, `Hora: ${fmtTime12(gen)}`, { h: 'right' });
        this.mergeText(ws, `A3:${finIzq}3`, this.companyLine(data, '   ·   '), { color: 'FF4B5563' });
        this.mergeText(ws, `${iniDer}3:${fin}3`, `Imprimió: ${data.usuario || '-'}`, {
            h:     'right',
            color: 'FF4B5563'
        });
        this.mergeText(ws, `A4:${fin}4`, this.filtersLine(data, '   ·   '));
        this.titleRow(ws, 5, cols);

        this.ALTO_TITULOS.forEach((h, i) => ws.getRow(i + 1).height = h);
    }

    titleRow(ws, r, cols) {
        const titulos = ['CLAVE', 'DESCRIPCIÓN', 'UNIDAD', 'MOVIMIENTO', ...cols.map((c) => `${c.nombre}\n${c.corto}`), 'TOTAL'];

        titulos.forEach((t, i) => {
            const cell = ws.getRow(r).getCell(i + 1);
            cell.value = t;
            this.paint(cell, {
                bold:   true,
                size:   7,
                fill:   'FFE5E7EB',
                h:      'center',
                wrap:   true,
                border: this.borders()
            });
        });
    }

    areaBand(ws, r, p, continua, total) {
        ws.mergeCells(`A${r}:${this.colLetter(total)}${r}`);
        ws.getCell(`A${r}`).value = `ÁREA: ${String(p.area || 'Sin área').toUpperCase()}${continua ? '   (continúa)' : ''}`;

        for (let c = 1; c <= total; c++) {
            this.paint(ws.getRow(r).getCell(c), {
                bold:   true,
                fill:   this.GRIS,
                border: this.borders()
            });
        }

        ws.getRow(r).height = this.ALTO_BANDA;
    }

    // Aquí van VALORES: teórico, físico y diferencia ya vienen calculados del backend.
    productBlock(ws, r0, p, movs, cols) {
        const fin = r0 + movs.length - 1;
        const col = cols.length + 5;

        ['A', 'B', 'C'].forEach((c) => ws.mergeCells(`${c}${r0}:${c}${fin}`));
        ws.getCell(`A${r0}`).value = p.sku || '';
        ws.getCell(`B${r0}`).value = p.name || '';
        ws.getCell(`C${r0}`).value = p.unidad || '';

        movs.forEach((m, i) => {
            const r      = r0 + i;
            const borde  = this.borders(r === fin);
            const tono   = m.tipo === 'calculo' ? this.GRIS : (m.tipo === 'fisico' ? this.AMARILLO : null);
            const fuerte = m.tipo === 'calculo' || m.tipo === 'fisico';

            ws.getRow(r).height = this.ALTO_FILA;

            this.paint(ws.getCell(`A${r}`), {
                h:      'center',
                v:      'top',
                border: borde
            });
            this.paint(ws.getCell(`B${r}`), {
                bold:   true,
                h:      'center',
                v:      'top',
                wrap:   true,
                border: borde
            });
            this.paint(ws.getCell(`C${r}`), {
                h:      'center',
                v:      'top',
                border: borde
            });

            const label = ws.getCell(`D${r}`);
            label.value = m.label;
            this.paint(label, {
                size:   7,
                bold:   fuerte,
                fill:   tono,
                border: borde
            });

            cols.forEach((c, j) => {
                const v    = this.cellValue(m.valores[j]);
                const cell = ws.getRow(r).getCell(5 + j);
                cell.value = v;
                this.paint(cell, {
                    h:      'center',
                    bold:   fuerte,
                    fill:   tono,
                    border: borde,
                    color:  this.valueColor(m.key, v)
                });
                cell.numFmt = this.FORMATO_NUM;
            });

            const totalCell = ws.getRow(r).getCell(col);
            const tv        = m.suma ? this.cellValue(m.total) : null;
            totalCell.value = tv;
            this.paint(totalCell, {
                h:      'center',
                bold:   true,
                fill:   m.suma ? tono : this.GRIS_NA,
                border: borde,
                color:  m.suma ? this.valueColor(m.key, tv) : 'FF111827'
            });
            totalCell.numFmt = this.FORMATO_NUM;
        });
    }

    // Mismas cifras que el resumen de la vista previa.
    summaryRows(ws, r, data, total, mode) {
        const s     = data.resumen || {};
        const texto = (mode === 'sencillo'
            ? [
                `Productos: ${fmtNum(s.productos)}`,
                `Entradas: ${fmtNum(s.entradas)}`,
                `Salidas: ${fmtNum(s.salidas_total)}`
            ]
            : [
                `Productos: ${fmtNum(s.productos)}`,
                `Entradas: ${fmtNum(s.entradas)}`,
                `Ventas: ${fmtNum(s.ventas)}`,
                `Salidas: ${fmtNum(s.salidas)}`,
                `Desperdicio: ${fmtNum(s.desperdicio)}`,
                `Diferencia: ${s.diferencia == null ? '—' : fmtNum(s.diferencia)}`,
                `Conteos: ${fmtNum(s.conteos)}`
            ]).join('   ·   ');

        this.mergeText(ws, `A${r}:${this.colLetter(total)}${r}`, `RESUMEN   ${texto}`, { bold: true });
        ws.getRow(r).height = 18;
    }

    cellValue(v) {
        return v == null || v === '' ? null : Number(Number(v).toFixed(3));
    }

    valueColor(key, v) {
        if (v == null) return 'FF111827';
        if (v === 0) return 'FFC4C9D0';
        if (key === 'diferencia') return v < 0 ? 'FFDC2626' : 'FF16A34A';
        return 'FF111827';
    }

    reportTitle(mode) {
        return 'REPORTE DE INVENTARIO RÁPIDO' + (mode === 'sencillo' ? '' : ' · CONTEO FÍSICO');
    }

    companyLine(data, sep) {
        return [data.rfc ? `RFC: ${data.rfc}` : '', data.ubicacion].filter(Boolean).join(sep);
    }

    filtersLine(data, sep) {
        return [
            `Sucursal: ${data.sucursal || '-'}`,
            `Almacén: ${data.almacen || '-'}`,
            data.titulo_periodo,
            data.filtro
        ].filter(Boolean).join(sep);
    }

    setColumns(ws, tipo, cols) {
        const ancho   = tipo === 'mensual' ? 9 : 8;
        const widths  = [7, 26, 6, 24, ...cols.map(() => ancho), 8];
        const usado   = widths.reduce((t, w) => t + w * 7 + 5, 0);
        const sobra   = Math.max(0, (10.5 * 96 - usado) / 7);

        // Lo que sobra de la carta horizontal (10.5" útiles) se reparte entre la descripción y las
        // columnas de periodo, para que la hoja ocupe todo el ancho sin agrandar la letra.
        widths[1] += sobra * 0.4;
        cols.forEach((c, j) => widths[4 + j] += (sobra * 0.6) / cols.length);

        ws.columns = widths.map((w) => ({ width: Math.floor(w * 10) / 10 }));
    }

    // Escala para que todas las columnas quepan a lo ancho de una carta horizontal
    // (10.5" útiles con márgenes de 0.25"). Ancho de columna en px ≈ caracteres × 7 + 5.
    printScale(ws) {
        const anchoPx = ws.columns.reduce((t, c) => t + Math.round(c.width * 7 + 5), 0);
        return Math.min(100, Math.floor((10.5 * 96) / anchoPx * 100) - 1);
    }

    borders(cierre = false) {
        const thin = {
            style: 'thin',
            color: { argb: 'FF9CA3AF' }
        };
        const medium = {
            style: 'medium',
            color: { argb: 'FF374151' }
        };

        return {
            top:    thin,
            left:   thin,
            right:  thin,
            bottom: cierre ? medium : thin
        };
    }

    // Estilo completo por celda: ExcelJS comparte el estilo entre las celdas de un rango combinado.
    paint(cell, options) {
        const opts = Object.assign({
            bold:   false,
            size:   8,
            color:  'FF111827',
            fill:   null,
            h:      'left',
            v:      'middle',
            wrap:   false,
            border: null
        }, options || {});

        cell.style = {
            font: {
                name:  'Arial',
                size:  opts.size,
                bold:  opts.bold,
                color: { argb: opts.color }
            },
            alignment: {
                horizontal: opts.h,
                vertical:   opts.v,
                wrapText:   opts.wrap
            },
            border: opts.border || {},
            fill:   opts.fill
                ? {
                    type:    'pattern',
                    pattern: 'solid',
                    fgColor: { argb: opts.fill }
                }
                : {
                    type:    'pattern',
                    pattern: 'none'
                }
        };
    }

    mergeText(ws, range, value, style = {}) {
        ws.mergeCells(range);
        const cell = ws.getCell(range.split(':')[0]);
        cell.value = value;
        this.paint(cell, Object.assign({ v: 'middle' }, style));
    }

    colLetter(n) {
        let s = '';
        while (n > 0) {
            const m = (n - 1) % 26;
            s = String.fromCharCode(65 + m) + s;
            n = Math.floor((n - 1) / 26);
        }
        return s;
    }

    loadExcelJS() {
        if (window.ExcelJS) return Promise.resolve();

        return new Promise((resolve, reject) => {
            const script   = document.createElement('script');
            script.src     = this.EXCELJS;
            script.onload  = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
}


// -- Vista --

class ReportesView extends Templates {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Reportes';
    }

    // -- Interface --

    renderHeader(data) {
        this.viewHeader({
            parent: 'viewHeader',
            json:   data
        });
    }

    renderList(options) {
        this.reportList(Object.assign({
            parent: 'listPanel'
        }, options));
    }

    renderToolbar(options) {
        this.reportToolbar(Object.assign({
            parent: 'reportToolbar'
        }, options));
    }

    renderSheet(data, mode, zoom) {
        this.inventorySheet({
            parent: 'reportPreview',
            json:   data,
            mode:   mode,
            zoom:   zoom
        });
    }

    renderEmpty(message, icon) {
        this.emptyState({
            parent: 'reportPreview',
            icon:   icon || 'file-spreadsheet',
            title:  message || 'Selecciona un periodo de la lista'
        });
    }

    renderLoading(message) {
        this.loadingState({
            parent: 'reportPreview',
            text:   message
        });
    }

    viewHeader(options) {
        const defaults = {
            parent:  'root',
            id:      'viewHeaderReportes',
            class:   'flex items-center justify-between w-full',
            json:    {
                title:     '',
                titleHtml: '',
                subtitle:  ''
            },
            classes: {
                title:    'text-lg font-bold text-gray-800',
                subtitle: 'text-xs text-gray-500'
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const wrap = $('<div>', {
            id:    opts.id,
            class: opts.class
        });
        wrap.html(`
            <div class="flex items-center" style="gap:12px;">
                <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style="background:rgb(var(--brand-600, 192 90 64) / 0.12);color:rgb(var(--brand-600, 192 90 64));">
                    <i data-lucide="file-bar-chart" class="w-5 h-5"></i>
                </div>
                <div>
                    <h1 class="${opts.classes.title}">${opts.json.titleHtml || esc(opts.json.title)}</h1>
                    ${opts.json.subtitle ? `<p class="${opts.classes.subtitle}">${esc(opts.json.subtitle)}</p>` : ''}
                </div>
            </div>`);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
    }

    // Lista de periodos (patrón de order-visor): buscador, encabezado de columnas,
    // filas con punto de estado y pie con los totales del rango.
    reportList(options) {
        const defaults = {
            parent:   'root',
            id:       'reportList',
            class:    'flex-1 min-h-0 flex flex-col',
            items:    [],
            tipo:     'semanal',
            selected: null,
            loading:  false,
            grid:     'minmax(0,1fr) 78px 78px 86px',
            titles:   {
                semanal: 'Reportes semanales',
                mensual: 'Reportes mensuales'
            },
            labels: {
                search:  'Buscar periodo...',
                empty:   'No hay periodos en el rango',
                noMatch: 'Sin resultados',
                loading: 'Cargando periodos...',
                footIn:  'Entradas del rango',
                footOut: 'Salidas del rango'
            },
            dots: {
                ajuste:     '#7C3AED',
                movimiento: '#16A34A',
                vacio:      '#D1D5DB'
            },
            rowClass:      'w-full text-left grid items-center px-3 py-2.5 border-b border-gray-100 border-l-2 transition-colors',
            activeClass:   'bg-blue-50 border-l-blue-600',
            inactiveClass: 'border-l-transparent hover:bg-gray-50',
            onSelect:      () => {}
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.titles = Object.assign({}, defaults.titles, o.titles || {});
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});
        opts.dots   = Object.assign({}, defaults.dots,   o.dots   || {});

        const items = opts.items || [];
        const gridStyle = `grid-template-columns:${opts.grid};column-gap:8px;`;

        const dotColor = (it) => {
            if (Number(it.ajustes) > 0) return opts.dots.ajuste;
            if (Number(it.movimientos) > 0) return opts.dots.movimiento;
            return opts.dots.vacio;
        };

        const numCell = (value, caption, tone) => `
            <div class="text-right min-w-0">
                <div class="text-sm font-semibold leading-none whitespace-nowrap ${tone}">${value}</div>
                <div class="text-[9px] text-gray-400 uppercase mt-0.5 whitespace-nowrap">${caption}</div>
            </div>`;

        const rowHtml = (it) => {
            const entradas = Number(it.entradas) || 0;
            const salidas  = Number(it.salidas)  || 0;
            const ajustes  = parseInt(it.ajustes, 10) || 0;
            const dif      = it.diferencia == null ? null : Number(it.diferencia);
            const difTxt   = ajustes ? `dif ${dif > 0 ? '+' : ''}${fmtNum(dif || 0)}` : 'sin conteo';
            const active   = it.key === opts.selected;

            return `
                <button type="button" data-key="${esc(it.key)}" data-search="${esc(String(it.label || '').toLowerCase())}"
                    class="${opts.rowClass} ${active ? opts.activeClass : opts.inactiveClass}" style="${gridStyle}">
                    <div class="min-w-0">
                        <div class="flex items-center" style="gap:6px;">
                            <span class="w-2 h-2 rounded-full flex-shrink-0" style="background:${dotColor(it)};"></span>
                            <span class="text-sm font-bold text-gray-800 truncate">${esc(it.label)}</span>
                        </div>
                        <div class="text-[10px] text-gray-500 truncate mt-0.5 pl-3">${fmtNum(it.productos)} productos con movimiento · ${esc(it.sublabel || '')}</div>
                    </div>
                    ${numCell(entradas ? `+${fmtNum(entradas)}` : '0', 'entradas', entradas ? 'text-green-600' : 'text-gray-300')}
                    ${numCell(salidas ? `-${fmtNum(salidas)}` : '0', 'salidas', salidas ? 'text-red-600' : 'text-gray-300')}
                    ${numCell(ajustes, difTxt, ajustes ? 'text-purple-600' : 'text-gray-300')}
                </button>`;
        };

        const totalIn  = items.reduce((t, it) => t + (Number(it.entradas) || 0), 0);
        const totalOut = items.reduce((t, it) => t + (Number(it.salidas)  || 0), 0);

        const body = opts.loading
            ? `<div class="flex flex-col items-center justify-center text-gray-400 py-10">
                    <div class="animate-spin w-6 h-6 border-2 border-gray-300 rounded-full mb-3" style="border-top-color:rgb(var(--brand-600, 192 90 64));"></div>
                    <p class="text-xs">${esc(opts.labels.loading)}</p>
               </div>`
            : (items.length
                ? items.map(rowHtml).join('') + `<p id="${opts.id}_noMatch" class="hidden text-center text-xs text-gray-400 py-8">${esc(opts.labels.noMatch)}</p>`
                : `<p class="text-center text-xs text-gray-400 py-8">${esc(opts.labels.empty)}</p>`);

        const wrap = $('<div>', {
            id:    opts.id,
            class: opts.class
        });
        wrap.html(`
            <div class="px-3 py-3 border-b border-gray-200 bg-gray-50 flex-shrink-0">
                <div class="flex items-center mb-2" style="gap:8px;">
                    <i data-lucide="calendar-range" class="w-4 h-4" style="color:rgb(var(--brand-600, 192 90 64));"></i>
                    <span class="text-sm font-bold text-gray-800 flex-1">${esc(opts.titles[opts.tipo] || opts.titles.semanal)}</span>
                    <span id="${opts.id}_count" class="text-[11px] text-gray-500">${items.length} periodo${items.length === 1 ? '' : 's'}</span>
                </div>
                <div class="relative">
                    <i data-lucide="search" class="w-4 h-4 text-gray-400 absolute top-1/2 -translate-y-1/2" style="left:10px;"></i>
                    <input type="text" id="${opts.id}_search" placeholder="${esc(opts.labels.search)}" autocomplete="off"
                        class="w-full bg-white border border-gray-300 text-gray-800 text-sm rounded-lg py-2 outline-none focus:border-blue-600" style="padding-left:32px;padding-right:12px;" />
                </div>
            </div>
            <div class="grid py-2 border-b border-gray-200 text-[10px] font-semibold text-gray-500 uppercase tracking-wide flex-shrink-0" style="${gridStyle}padding-left:14px;padding-right:12px;">
                <span>Periodo</span>
                <span class="text-right">Entradas</span>
                <span class="text-right">Salidas</span>
                <span class="text-right">Ajustes</span>
            </div>
            <div id="${opts.id}_rows" class="flex-1 min-h-0 overflow-y-auto">${body}</div>
            <div class="flex items-center justify-between px-3 py-2.5 border-t border-gray-200 bg-gray-50 flex-shrink-0" style="gap:12px;">
                <div class="min-w-0">
                    <div class="text-[10px] font-bold uppercase tracking-wide text-gray-500">${esc(opts.labels.footIn)}</div>
                    <div class="text-base font-bold text-green-600">+${fmtNum(totalIn)}</div>
                </div>
                <div class="min-w-0 text-right">
                    <div class="text-[10px] font-bold uppercase tracking-wide text-gray-500">${esc(opts.labels.footOut)}</div>
                    <div class="text-base font-bold text-red-600">-${fmtNum(totalOut)}</div>
                </div>
            </div>`);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

        // El buscador filtra en el DOM para no perder el foco al teclear.
        $(`#${opts.id}_search`).on('input', (e) => {
            const q    = String($(e.currentTarget).val() || '').toLowerCase().trim();
            const $rows = wrap.find('[data-key]');
            let visible = 0;

            $rows.each(function () {
                const show = !q || String($(this).attr('data-search')).includes(q);
                $(this).toggleClass('hidden', !show);
                if (show) visible++;
            });

            $(`#${opts.id}_count`).text(`${visible} periodo${visible === 1 ? '' : 's'}`);
            $(`#${opts.id}_noMatch`).toggleClass('hidden', visible > 0 || !$rows.length);
        });

        wrap.find('[data-key]').on('click', (e) => {
            const $btn = $(e.currentTarget);
            const key  = $btn.attr('data-key');
            const item = items.find(it => it.key === key);

            wrap.find('[data-key]').removeClass(opts.activeClass).addClass(opts.inactiveClass);
            $btn.removeClass(opts.inactiveClass).addClass(opts.activeClass);
            if (item) opts.onSelect(item);
        });
    }

    reportToolbar(options) {
        const defaults = {
            parent:  'root',
            id:      'reportToolbarBox',
            class:   'flex flex-wrap items-center justify-between px-3 py-2.5',
            mode:    'completo',
            zoom:    100,
            step:    10,
            enabled: false,
            periodo: '',
            labels:  {
                title:     'Vista previa de impresión',
                completo:  'Completo',
                sencillo:  'Sencillo',
                print:     'Imprimir',
                excel:     'Excel',
                zoomIn:    'Acercar',
                zoomOut:   'Alejar',
                zoomReset: 'Restablecer a 100%'
            },
            activeClass:   'bg-blue-600 text-white shadow-sm',
            inactiveClass: 'text-gray-500 hover:text-gray-800',
            onMode:  () => {},
            onZoom:  () => {},
            onPrint: () => {},
            onExcel: () => {}
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        const segBtn = (mode) => `
            <button type="button" data-mode="${mode}"
                class="px-3 py-1 rounded-md text-xs font-semibold transition-colors ${opts.mode === mode ? opts.activeClass : opts.inactiveClass}">
                ${esc(opts.labels[mode])}
            </button>`;

        const disabled = opts.enabled ? '' : 'disabled';
        const offClass = opts.enabled ? '' : 'opacity-50 cursor-not-allowed';

        const wrap = $('<div>', {
            id:    opts.id,
            class: opts.class,
            style: 'gap:10px;'
        });
        wrap.html(`
            <div class="min-w-0">
                <div class="flex items-center text-sm font-semibold text-gray-700" style="gap:6px;">
                    <i data-lucide="eye" class="w-4 h-4 text-gray-400"></i>
                    ${esc(opts.labels.title)}
                </div>
                <div class="text-[11px] text-gray-500 truncate">${esc(opts.periodo || '—')}</div>
            </div>
            <div class="flex items-center" style="gap:8px;">
                <div class="inline-flex items-center bg-white border border-gray-200 rounded-lg p-0.5 ${offClass}">
                    <button type="button" id="${opts.id}_zoomOut" ${disabled} title="${esc(opts.labels.zoomOut)}"
                        class="inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors">
                        <i data-lucide="minus" class="w-3.5 h-3.5"></i>
                    </button>
                    <button type="button" id="${opts.id}_zoomReset" ${disabled} title="${esc(opts.labels.zoomReset)}"
                        class="px-2 h-7 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors" style="min-width:48px;">
                        ${opts.zoom}%
                    </button>
                    <button type="button" id="${opts.id}_zoomIn" ${disabled} title="${esc(opts.labels.zoomIn)}"
                        class="inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors">
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
                <div class="inline-flex bg-white border border-gray-200 rounded-lg p-0.5">
                    ${segBtn('completo')}
                    ${segBtn('sencillo')}
                </div>
                <button type="button" id="${opts.id}_print" ${disabled}
                    class="inline-flex items-center rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors ${offClass}" style="gap:6px;padding:7px 12px;">
                    <i data-lucide="printer" class="w-4 h-4"></i> ${esc(opts.labels.print)}
                </button>
                <button type="button" id="${opts.id}_excel" ${disabled}
                    class="inline-flex items-center rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 transition-colors ${offClass}" style="gap:6px;padding:6px 12px;">
                    <i data-lucide="file-spreadsheet" class="w-4 h-4 text-green-600"></i> ${esc(opts.labels.excel)}
                </button>
            </div>`);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

        wrap.find('[data-mode]').on('click', (e) => opts.onMode($(e.currentTarget).attr('data-mode')));
        $(`#${opts.id}_zoomOut`).on('click', () => opts.onZoom(opts.zoom - opts.step));
        $(`#${opts.id}_zoomReset`).on('click', () => opts.onZoom(100));
        $(`#${opts.id}_zoomIn`).on('click', () => opts.onZoom(opts.zoom + opts.step));
        $(`#${opts.id}_print`).on('click', () => opts.onPrint());
        $(`#${opts.id}_excel`).on('click', () => opts.onExcel());
    }

    // La hoja imprimible en páginas de carta horizontal (11 × 8.5 in a 96 dpi). La
    // tabla completa se arma primero fuera de pantalla para medir anchos y altos: con
    // eso se reparten los productos por página sin partir ninguno, se fijan los anchos
    // de columna (iguales en todas las páginas) y, si la tabla es más ancha que la hoja,
    // se reduce con zoom. La impresión copia estas mismas páginas.
    inventorySheet(options) {
        const defaults = {
            parent: 'root',
            id:     'rptSheet',
            json:   null,
            mode:   'completo',
            zoom:   100,
            page:   {
                width:   1056,
                height:  816,
                padding: 24
            },
            labels: {
                tituloBase:   'REPORTE DE INVENTARIO RÁPIDO',
                tituloConteo: ' · CONTEO FÍSICO',
                sinArea:      'Sin área',
                continua:     '(continúa)',
                empty:        'Sin productos para los filtros elegidos.'
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.page   = Object.assign({}, defaults.page,   o.page   || {});
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        this.sheetStyles();

        const d = opts.json || {};
        if (!opts.json) {
            this.renderEmpty();
            return;
        }

        const cols    = d.columnas || [];
        const total   = cols.length + 5;
        const derecha = total >= 10 ? 4 : 2;
        const gen     = String(d.generado || '');
        const titulo  = opts.labels.tituloBase + (opts.mode === 'sencillo' ? '' : opts.labels.tituloConteo);

        const valCell = (key, v, cls) => {
            if (v == null || v === '') return `<td class="${cls}"></td>`;
            const n = Number(v);
            let tone = '';
            if (n === 0) return `<td class="${cls} rpt-zero">-</td>`;
            if (key === 'diferencia') tone = n < 0 ? 'rpt-neg' : 'rpt-pos';
            return `<td class="${cls} ${tone}">${fmtNum(n)}</td>`;
        };

        const rowClass = (m) => m.tipo === 'calculo' ? 'rpt-calc' : (m.tipo === 'fisico' ? 'rpt-fisico' : '');

        const productBlock = (p, band) => {
            const movs = reportes.movementRows(opts.mode, p);
            const rows = movs.map((m, i) => {
                const last  = i === movs.length - 1;
                const fixed = i === 0 ? `
                    <td class="rpt-sku rpt-last" rowspan="${movs.length}">${esc(p.sku || '')}</td>
                    <td class="rpt-name rpt-last" rowspan="${movs.length}">${esc(p.name || '')}</td>
                    <td class="rpt-unit rpt-last" rowspan="${movs.length}">${esc(p.unidad || '')}</td>` : '';
                const totalTd = m.suma
                    ? valCell(m.key, m.total, 'rpt-total')
                    : '<td class="rpt-total rpt-na"></td>';

                return `
                    <tr class="${rowClass(m)} ${last ? 'rpt-last' : ''}">
                        ${fixed}
                        <td class="rpt-mov">${esc(m.label)}</td>
                        ${cols.map((c, j) => valCell(m.key, m.valores[j], 'rpt-num')).join('')}
                        ${totalTd}
                    </tr>`;
            }).join('');

            return `<tbody class="rpt-product">${band}${rows}</tbody>`;
        };

        const areaBand = (p, continua) => `
            <tr class="rpt-band"><td colspan="${total}">ÁREA: ${esc(String(p.area || opts.labels.sinArea).toUpperCase())}${continua ? ` ${esc(opts.labels.continua)}` : ''}</td></tr>`;

        const s = d.resumen || {};
        const summaryItem = (label, value, tone) => `
            <div class="rpt-sum-item"><span class="rpt-sum-label">${esc(label)}</span><span class="rpt-sum-value ${tone || ''}">${value}</span></div>`;
        const dif = s.diferencia == null ? null : Number(s.diferencia);

        const thead = `
                <thead>
                    <tr class="rpt-h">
                        <td colspan="${total - derecha}" class="rpt-title">${esc(titulo)}</td>
                        <td colspan="${derecha}" class="rpt-right">${esc(fmtLongDate(gen))}</td>
                    </tr>
                    <tr class="rpt-h">
                        <td colspan="${total - derecha}" class="rpt-company">${esc(d.empresa || '')}</td>
                        <td colspan="${derecha}" class="rpt-right">Hora: ${esc(fmtTime12(gen))}</td>
                    </tr>
                    <tr class="rpt-h">
                        <td colspan="${total - derecha}" class="rpt-muted">${esc(reportes.companyLine(d, ' · '))}</td>
                        <td colspan="${derecha}" class="rpt-right rpt-muted">Imprimió: ${esc(d.usuario || '-')}</td>
                    </tr>
                    <tr class="rpt-h">
                        <td colspan="${total}">${esc(reportes.filtersLine(d, ' · '))}</td>
                    </tr>
                    <tr class="rpt-cols">
                        <th>CLAVE</th>
                        <th>DESCRIPCIÓN</th>
                        <th>UNIDAD</th>
                        <th>MOVIMIENTO</th>
                        ${cols.map(c => `<th class="rpt-day"><div>${esc(c.nombre)}</div><div class="rpt-day-sub">${esc(c.corto)}</div></th>`).join('')}
                        <th>TOTAL</th>
                    </tr>
                </thead>`;

        const summary = `
            <div class="rpt-summary">
                ${summaryItem('Productos', fmtNum(s.productos))}
                ${summaryItem('Entradas', fmtNum(s.entradas))}
                ${opts.mode === 'sencillo' ? summaryItem('Salidas', fmtNum(s.salidas_total)) : `
                ${summaryItem('Ventas', fmtNum(s.ventas))}
                ${summaryItem('Salidas', fmtNum(s.salidas))}
                ${summaryItem('Desperdicio', fmtNum(s.desperdicio))}
                ${summaryItem('Diferencia', dif == null ? '—' : `${dif > 0 ? '+' : ''}${fmtNum(dif)}`, dif == null || dif === 0 ? '' : (dif < 0 ? 'rpt-neg' : 'rpt-pos'))}
                ${summaryItem('Conteos', fmtNum(s.conteos))}`}
            </div>`;

        const productos = d.rows || [];
        const empty     = `<tbody><tr><td colspan="${total}" class="rpt-empty">${esc(opts.labels.empty)}</td></tr></tbody>`;
        const anchoUtil = opts.page.width - opts.page.padding * 2;
        const altoUtil  = opts.page.height - opts.page.padding * 2;

        // Medición: la tabla entera con la misma CSS de la vista previa, fuera de pantalla.
        const probe = $('<div>', {
            class: 'rpt-probe',
            style: `width:${anchoUtil}px;`
        });
        probe.html(`
            <table class="rpt-table" style="width:100%;">
                ${thead}
                <tbody>${areaBand(productos[0] || {}, true)}</tbody>
                ${productos.map((p) => productBlock(p, '')).join('') || empty}
            </table>
            ${summary}`);
        $('body').append(probe);

        const tbodies     = probe.find('tbody');
        const ancho       = Math.max(anchoUtil, probe.find('table')[0].offsetWidth);
        const escala      = Math.min(1, anchoUtil / ancho);
        const columnas    = probe.find('tr.rpt-cols th').map((i, th) => th.getBoundingClientRect().width).get();
        const altoHead    = probe.find('thead')[0].offsetHeight;
        const altoBanda   = tbodies[0].offsetHeight;
        const altos       = productos.map((p, i) => tbodies[i + 1].offsetHeight);
        const altoResumen = probe.find('.rpt-summary').outerHeight(true);
        probe.remove();

        // Reparto por página: un producto nunca se parte; la banda del área se repite
        // arriba de cada página que continúa esa área. El 2% cubre redondeos de bordes.
        const disponible = (altoUtil / escala) * 0.98 - altoHead;
        const paginas    = [];
        let actual = {
            html:  '',
            usado: 0
        };
        let area = null;

        productos.forEach((p, i) => {
            const nueva = p.area_id !== area;
            let banda   = nueva || !actual.html;
            let alto    = altos[i] + (banda ? altoBanda : 0);

            if (actual.html && actual.usado + alto > disponible) {
                paginas.push(actual);
                actual = {
                    html:  '',
                    usado: 0
                };
                banda = true;
                alto  = altos[i] + altoBanda;
            }

            actual.html  += productBlock(p, banda ? areaBand(p, !nueva) : '');
            actual.usado += alto;
            area = p.area_id;
        });

        if (!productos.length) actual.html = empty;
        if (actual.usado && actual.usado + altoResumen > disponible) {
            paginas.push(actual);
            actual = {
                html:  '',
                usado: 0
            };
        }
        actual.resumen = true;
        paginas.push(actual);

        const colgroup = `<colgroup>${columnas.map((w) => `<col style="width:${w.toFixed(2)}px;">`).join('')}</colgroup>`;

        const sheet = $('<div>', {
            id:    opts.id,
            class: 'rpt-doc',
            style: `zoom:${opts.zoom / 100};`
        });
        sheet.html(paginas.map((pg, k) => `
            <div class="rpt-sheet" style="width:${opts.page.width}px;height:${opts.page.height}px;padding:${opts.page.padding}px;">
                <div class="rpt-sheet-body" style="width:${ancho}px;zoom:${escala.toFixed(4)};">
                    <table class="rpt-table rpt-fixed" style="width:${ancho}px;">${colgroup}${thead}${pg.html}</table>
                    ${pg.resumen ? summary : ''}
                </div>
                <div class="rpt-sheet-foot" style="left:${opts.page.padding}px;right:${opts.page.padding}px;">
                    <span>Almacén: ${esc(d.almacen || '-')}</span>
                    <span>Hoja ${k + 1} de ${paginas.length}</span>
                    <span>${esc(d.titulo_periodo || '')}</span>
                </div>
            </div>`).join(''));

        $(`#${opts.parent}`).html(sheet);
    }

    // Imprime las páginas de la vista previa desde un iframe oculto con la misma CSS
    // .rpt-*. Las páginas ya vienen armadas a tamaño carta horizontal (inventorySheet),
    // así que cada .rpt-sheet es una hoja impresa; el zoom de la vista previa se anula.
    printSheet(options) {
        const defaults = {
            sheetId: 'rptSheet',
            styleId: 'rptSheetStyles',
            title:   'Reporte',
            page:    'letter landscape'
        };
        const opts  = Object.assign({}, defaults, options || {});
        const sheet = document.getElementById(opts.sheetId);
        const style = document.getElementById(opts.styleId);

        if (!sheet) return false;

        const iframe = document.createElement('iframe');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument || iframe.contentWindow.document;
        doc.open();
        doc.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(opts.title)}</title><style>${style ? style.textContent : ''}
            @page { size: ${opts.page}; margin: 0; }
            html, body { margin: 0; padding: 0; background: #fff; }
        </style></head><body>${sheet.outerHTML}</body></html>`);
        doc.close();

        const run = () => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => iframe.remove(), 1000);
        };

        if (doc.readyState === 'complete') setTimeout(run, 150);
        else iframe.onload = run;

        return true;
    }

    emptyState(options) {
        const defaults = {
            parent: 'root',
            icon:   'file-spreadsheet',
            title:  'Selecciona un periodo de la lista',
            hint:   'La hoja se arma con las entradas, ventas, salidas y conteos del periodo.'
        };
        const opts = Object.assign({}, defaults, options || {});

        const wrap = $('<div>', { class: 'h-full min-h-[240px] flex flex-col items-center justify-center text-center px-6' });
        wrap.html(`
            <div class="w-14 h-14 rounded-full bg-white border border-gray-200 flex items-center justify-center mb-3">
                <i data-lucide="${esc(opts.icon)}" class="w-6 h-6 text-gray-400"></i>
            </div>
            <p class="text-sm text-gray-600">${esc(opts.title)}</p>
            <p class="text-[11px] text-gray-400 mt-1 max-w-[320px]">${esc(opts.hint)}</p>`);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
    }

    loadingState(options) {
        const defaults = {
            parent: 'root',
            text:   'Cargando...'
        };
        const opts = Object.assign({}, defaults, options || {});

        const wrap = $('<div>', { class: 'h-full min-h-[240px] flex flex-col items-center justify-center text-gray-500' });
        wrap.html(`
            <div class="animate-spin w-8 h-8 border-2 border-gray-300 rounded-full mb-3" style="border-top-color:rgb(var(--brand-600, 192 90 64));"></div>
            <p class="text-sm">${esc(opts.text)}</p>`);

        $(`#${opts.parent}`).html(wrap);
    }

    // -- Complements --

    // Una sola hoja de estilos para pantalla e impresión (el iframe copia su textContent).
    sheetStyles() {
        if (document.getElementById('rptSheetStyles')) return;

        const style = document.createElement('style');
        style.id = 'rptSheetStyles';
        style.textContent = `
            .rpt-doc, .rpt-doc *, .rpt-probe, .rpt-probe * { box-sizing: border-box; }
            .rpt-doc { display: flex; flex-direction: column; align-items: center; gap: 16px; width: max-content; margin: 0 auto; }
            .rpt-sheet { position: relative; flex-shrink: 0; overflow: hidden; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.12), 0 10px 28px rgba(0,0,0,.08); color: #111827; font-family: Arial, Helvetica, sans-serif; }
            .rpt-sheet-foot { position: absolute; bottom: 8px; display: flex; justify-content: space-between; font-family: Arial, Helvetica, sans-serif; font-size: 8px; line-height: 1; color: #6B7280; }
            .rpt-probe { position: absolute; left: -100000px; top: 0; visibility: hidden; pointer-events: none; }
            .rpt-table { border-collapse: collapse; font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #111827; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .rpt-table.rpt-fixed { table-layout: fixed; }
            .rpt-table th, .rpt-table td { border: 1px solid #9CA3AF; padding: 0 3px !important; font-size: 9px; vertical-align: middle; line-height: 1.15; }
            .rpt-table tr.rpt-h td { border: none; padding: 0 2px !important; }
            .rpt-table .rpt-title { font-size: 14px; font-weight: 700; padding-bottom: 2px; }
            .rpt-table .rpt-company { font-size: 11px; font-weight: 700; }
            .rpt-table .rpt-right { text-align: right; white-space: nowrap; }
            .rpt-table .rpt-muted { color: #4B5563; }
            .rpt-table tr.rpt-cols th { background: #E5E7EB; font-size: 8px; font-weight: 700; text-align: center; white-space: nowrap; padding: 1px 3px !important; }
            .rpt-table .rpt-day-sub { font-weight: 400; color: #374151; }
            .rpt-table tr.rpt-band td { background: #F3F4F6; font-weight: 700; padding: 0 3px !important; }
            .rpt-table .rpt-sku { text-align: center; vertical-align: top; white-space: nowrap; }
            .rpt-table .rpt-name { font-weight: 700; text-align: center; vertical-align: top; min-width: 130px; max-width: 220px; }
            .rpt-table .rpt-unit { text-align: center; vertical-align: top; white-space: nowrap; }
            .rpt-table .rpt-mov { font-size: 8px; white-space: nowrap; }
            .rpt-table .rpt-num { text-align: center; min-width: 40px; }
            .rpt-table .rpt-total { text-align: center; min-width: 40px; font-weight: 700; }
            .rpt-table tr.rpt-calc td.rpt-mov, .rpt-table tr.rpt-calc td.rpt-num, .rpt-table tr.rpt-calc td.rpt-total { background: #F3F4F6; font-weight: 700; }
            .rpt-table tr.rpt-fisico td.rpt-mov, .rpt-table tr.rpt-fisico td.rpt-num, .rpt-table tr.rpt-fisico td.rpt-total { background: #FEF3C7; font-weight: 700; }
            .rpt-table td.rpt-na, .rpt-table tr.rpt-calc td.rpt-na, .rpt-table tr.rpt-fisico td.rpt-na { background: #D1D5DB; }
            .rpt-table tr.rpt-last td, .rpt-table td.rpt-last { border-bottom: 2px solid #374151; }
            .rpt-table .rpt-zero { color: #C4C9D0; }
            .rpt-table .rpt-neg, .rpt-summary .rpt-neg { color: #DC2626; }
            .rpt-table .rpt-pos, .rpt-summary .rpt-pos { color: #16A34A; }
            .rpt-table .rpt-empty { text-align: center; color: #6B7280; padding: 18px 6px !important; }
            .rpt-summary { display: flex; flex-wrap: wrap; margin-top: 6px; border: 1px solid #9CA3AF; font-family: Arial, Helvetica, sans-serif; font-size: 9px; line-height: 1.2; }
            .rpt-sum-item { flex: 1 1 0; min-width: 80px; padding: 2px 6px; border-right: 1px solid #D1D5DB; display: flex; flex-direction: column; }
            .rpt-sum-item:last-child { border-right: none; }
            .rpt-sum-label { font-size: 8px; text-transform: uppercase; letter-spacing: .04em; color: #6B7280; }
            .rpt-sum-value { font-size: 10px; font-weight: 700; }
            @media print {
                .rpt-doc { display: block; zoom: 1 !important; width: auto; margin: 0; }
                .rpt-sheet { box-shadow: none; margin: 0; height: calc(8.5in - 2px) !important; break-after: page; page-break-after: always; }
                .rpt-sheet:last-child { break-after: auto; page-break-after: auto; }
            }`;
        document.head.appendChild(style);
    }
}


// -- Helpers --

function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

// 'YYYY-MM-DD HH:MM:SS' -> 'Lunes 24 de octubre del 2026'.
function fmtLongDate(iso) {
    const s = String(iso || '');
    if (s.length < 10) return s;

    const dias  = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const fecha = new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));

    return `${dias[fecha.getDay()]} ${fecha.getDate()} de ${meses[fecha.getMonth()]} del ${fecha.getFullYear()}`;
}

// 'YYYY-MM-DD HH:MM:SS' -> '12:23 pm'.
function fmtTime12(iso) {
    const s = String(iso || '');
    if (s.length < 16) return '';

    const h = Number(s.slice(11, 13));
    return `${h % 12 || 12}:${s.slice(14, 16)} ${h >= 12 ? 'pm' : 'am'}`;
}

// Hasta 3 decimales sin ceros sobrantes y con separador de miles.
function fmtNum(n) {
    const v = Number(n);
    if (n == null || n === '' || isNaN(v)) return '0';
    return Number(v.toFixed(3)).toLocaleString('en-US', { maximumFractionDigits: 3 });
}
