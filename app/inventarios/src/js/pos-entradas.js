let api = 'ctrl/ctrl-pos-entradas.php';
let app, entradas, entradasView;

let turno, subsidiaries_id;

window.updateSession = () => { };


$(async () => {
    entradasView = new EntradasView(api, 'root');
    entradas     = new Entradas(api, 'root');
    app          = new App(api, 'root');
    await app.init();
});

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSEntradas';
        this.subId        = null;
        this.selectedId   = null;
    }

    async init() {
        const r = await fn_ajax({ opc: 'init' }, api).catch(() => null);
        if (r && r.status === 200) {
            this.dataInit = {
                subsidiaries_id: r.subsidiaries_id || '',
                sucursales:      r.sucursales        || [],
                origenes:        r.origenes_entrada  || [],
                estados:         r.estados_entrada   || [],
                almacenes:       r.almacenes         || [],
                proveedores:     r.proveedores       || [],
                productos:       r.productos         || []
            };
        } else {
            this.dataInit = {
                subsidiaries_id: '',
                sucursales:      [],
                origenes:        [],
                estados:         [],
                almacenes:       [],
                proveedores:     [],
                productos:       []
            };
        }
        this.subId      = this.dataInit.subsidiaries_id;
        subsidiaries_id = this.subId;

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        entradasView.renderHeader({
            title:    'Visor de Entradas',
            subtitle: 'Recepciones de produccion, compras y transferencias por sucursal',
            back:     { href: '/app/inventarios/index.php', title: 'Regresar al inicio' }
        });
        // entradasView.renderFooter({
        //     info: '',
        //     legends: [
        //         { tone: 'purple',  label: 'Produccion'    },
        //         { tone: 'warning', label: 'Proveedor'     },
        //         { tone: 'info',    label: 'Transferencia' },
        //         { tone: 'danger',  label: 'Devolucion'    }
        //     ]
        // });
        // entradasView.renderTabs(this.PROJECT_NAME);
        entradasView.renderDetail(null);
        this.populateFilters();
        entradas.lsEntradas();
        entradas.lsKpis();
    }

    // -- Layout --

    layout() {

        const mainPanel = {
            type: 'div',
            id:   'mainPanel',
            class:'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 w-full',
            children: [
                {
                    id:    'viewHeader',
                    text:  '#viewHeader',
                    class: 'flex items-center justify-between px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id: 'filterBar',
                    class: 'px-4 py-3 bg-[#141d2b] border-b border-[#374151] flex-shrink-0'
                },
         
                {
                    id:    'kpisRow',
                    class: 'px-3 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
              
                {
                    id:    'tableWrap',
                    text:  '#tableWrap',
                    class: 'p-3 flex-1 min-h-0 overflow-auto'
                },
                // {
                //     id:    'viewFooter',
                //     text:  '#viewFooter',
                //     class: 'px-4 py-2 bg-[#141d2b] border-t border-[#374151] flex items-center justify-between flex-shrink-0'
                // }
            ]
        };

        const detailPanel = {
            type: 'aside',
            id:   'detailPanel',
            class:'w-full md:w-[480px] flex-shrink-0 bg-[#141d2b] border-t md:border-t-0 md:border-l border-[#374151] flex flex-col overflow-hidden',
            children: [
                {
                    id:    'emptyDetail',
                    text:  '#emptyDetail',
                    class: 'flex-1 flex flex-col items-center justify-center text-center px-6'
                },
                {
                    id:    'detailContent',
                    text:  '#detailContent',
                    class: 'hidden flex-1 flex flex-col overflow-hidden'
                }
            ]
        };

        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'flex-1 min-h-0 w-full flex flex-col md:flex-row overflow-hidden',
                container: [mainPanel, detailPanel]
            }
        });
    }

    // -- Filter bar --

    filterBar() {

        let filters = [

            {
                opc:         'input',
                id:          'fRango',
                lbl:         'Rango:',
                class:       'col-12 col-md-4 col-lg-3',
                readonly:    true,
                placeholder: 'Selecciona un rango',
                value:       '',
                required:    false
            },
            {
                opc:      'select',
                id:       'subsidiaries_id',
                lbl:      'Sucursal:',
                class:    'col-12 col-md-4 col-lg-2',
                onchange: 'app.onChangeFilters()',
                data:     [{ id: '', valor: '-- Todas --' }]
            },
            {
                opc:      'select',
                id:       'fOrigen',
                lbl:      'Origen:',
                class:    'col-12 col-md-4 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    '',
                data:     [{ id: '', valor: '-- Todos --' }].concat(this.dataInit.origenes || [])
            },
            {
                opc:      'select',
                id:       'fEstado',
                lbl:      'Estado:',
                class:    'col-12 col-md-6 col-lg-2',
                onchange: 'app.onChangeFilters()',
                value:    'Activas',
                data:     this.dataInit.estados || []
            },
            {
                opc:       'button',
                id:        'btnNuevaEntrada',
                text:      'Agregar Entrada',
                color_btn: 'primary',
                class:     'col-12 col-md-6 col-lg-3',
                onClick:   () => entradasView.openEntradaForm()
            }
        ];

        this.createfilterBar({
            parent: 'filterBar',
            coffeesoft:true,
            theme:'dark',
            data:   filters
        });

        this.initRangePicker();
    }

    // Rango de fechas via bootstrap-daterangepicker sobre #fRango. Default: ultimos 7 dias.
    initRangePicker() {
        // Semilla del rango por defecto; la tabla y los KPIs lo leen via getFilters().
        this.rangeFi = moment().subtract(6, 'days').format('YYYY-MM-DD');
        this.rangeFf = moment().format('YYYY-MM-DD');

        dataPicker({
            parent: 'fRango',
            type:   'all',
            rangepicker: {
                startDate:           moment().subtract(6, 'days'),
                endDate:             moment(),
                showDropdowns:       true,
                alwaysShowCalendars: true,
                ranges: {
                    'Hoy':             [moment(), moment()],
                    'Ayer':            [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
                    'Ultimos 7 dias':  [moment().subtract(6, 'days'), moment()],
                    'Semana actual':   [moment().startOf('isoWeek'), moment().endOf('isoWeek')],
                    'Semana anterior': [moment().subtract(1, 'week').startOf('isoWeek'), moment().subtract(1, 'week').endOf('isoWeek')],
                    'Mes actual':      [moment().startOf('month'), moment().endOf('month')],
                    'Mes anterior':    [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
                },
                locale: {
                    format:           'YYYY-MM-DD',
                    separator:        '  a  ',
                    applyLabel:       'Aplicar',
                    cancelLabel:      'Cancelar',
                    customRangeLabel: 'Personalizado',
                    daysOfWeek:       ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'],
                    monthNames:       ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
                    firstDay:         1
                }
            },
            onSelect: (start, end) => {
                this.rangeFi = start.format('YYYY-MM-DD');
                this.rangeFf = end.format('YYYY-MM-DD');
                this.onChangeFilters();
            }
        });
    }

    populateFilters() {
        const sucursales = this.dataInit.sucursales || [];
        if (sucursales.length) {
            this.populateSelect('subsidiaries_id', sucursales);
            $('#subsidiaries_id').val(this.subId);
        }
    }

    populateSelect(id, data) {
        const $sel = $(`#${id}`);
        if (!$sel.length) return;
        $sel.find('option:not(:first)').remove();
        data.forEach(item => {
            // Evita duplicar la opcion "Todas..." si ya viene en data
            if (item.id === '' && $sel.find('option').first().val() === '') return;
            $sel.append(`<option value="${item.id}">${item.valor}</option>`);
        });
    }

    getFilters() {
        return {
            subsidiaries_id: $('#subsidiaries_id').val() || this.subId || '',
            origen:          $('#fOrigen').val()        || '',
            estado:          $('#fEstado').val()        || '',
            fi:              this.rangeFi               || '',
            ff:              this.rangeFf               || '',
            q:               $('#qBuscar').val()        || ''
        };
    }

    // -- Event handlers --

    async onChangeFilters() {
        entradas.lsEntradas();
        await entradas.lsKpis();

        // Si la entrada seleccionada se filtra fuera, cerrar panel
        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectEntrada(null);
        }
    }

    onChangeSucursal() {
        entradas.lsEntradas();
        entradas.lsKpis();
        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectEntrada(null);
        }
    }

    isVisibleAfterFilters(folio) {
        return $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
            return $(this).text().includes(folio);
        }).length > 0;
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }

    // -- Facade --

    selectEntrada(folio, id) {
        this.selectedId = folio;
        // Resaltar fila activa
        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');
        if (folio) {
            const $row = $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
                return $(this).text().includes(folio);
            });
            $row.addClass('row-active');
            // El detalle se consulta por id numerico (el folio solo resalta la fila).
            entradas.getEntrada(id);
        } else {
            // Panel fijo: al deseleccionar se muestra el estado vacio (no se oculta).
            entradasView.renderDetail(null);
        }
    }

    editEntrada(folio) {
        console.log('[editEntrada]', folio);
        // En modo fake solo seleccionamos
        this.selectEntrada(folio);
    }

    renderDetail(entrada) {
        entradasView.renderDetail(entrada);
    }
}

class Entradas extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSEntradas';
    }

    // -- Data --

    async lsEntradas() {
        const f = app.getFilters();
        const r = await fn_ajax(Object.assign({ opc: 'lsEntradas' }, {
            subsidiaries_id: f.subsidiaries_id,
            origin_id:       f.origen,
            status:          f.estado,
            fi:              f.fi,
            ff:              f.ff,
            q:               f.q
        }), api).catch(() => null);

        const data = (r && r.status === 200) ? { row: r.row } : { row: [] };

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'dark',
            title:        '',
            subtitle:     '',
            center:       [2, 3, 7],
            right:        [4],
            actionsAlign: 'left',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       12,
            emptyMessage: 'No se encontraron entradas con los filtros aplicados',
            emptyIcon:    'icon-arrow-down-to-line',
            data:         data
        });

        if (window.lucide) lucide.createIcons();

        const total = (data.row || []).length;

        // DataTable CoffeeSoft (paginacion/orden) sobre la tabla ya renderizada.
        if (total > 0 && typeof simple_data_table === 'function') {
            simple_data_table(`#tb${this.PROJECT_NAME}`, 10);
        }

        app.updateFooterInfo(`Mostrando ${total} entrada${total !== 1 ? 's' : ''}`);
    }

    async lsKpis() {
        const f = app.getFilters();
        const r = await fn_ajax({
            opc:             'showEntradas',
            subsidiaries_id: f.subsidiaries_id,
            origin_id:       f.origen,
            status:          f.estado,
            fi:              f.fi,
            ff:              f.ff,
            q:               f.q
        }, api).catch(() => null);

        const c = (r && r.status === 200) ? r.counts : {};
        const costo = Number(c.total_costo || 0);

        const kpis = [
            { id: 'kpiEntradas',  label: 'Entradas',      value: parseInt(c.total_entradas  || 0, 10), tone: 'success' },
            { id: 'kpiCosto',     label: 'Costo Total',   value: '$' + Math.round(costo).toLocaleString('en-US'), tone: 'default' },
            { id: 'kpiUnidades',  label: 'Unidades',      value: parseInt(c.total_unidades  || 0, 10), tone: 'warning' },
            { id: 'kpiAplicadas', label: 'Aplicadas',     value: parseInt(c.total_aplicadas || 0, 10), tone: 'purple'  }
        ];
        entradasView.renderInfoCards(kpis);
    }

    async getEntrada(id) {
        const r = await fn_ajax({ opc: 'getEntrada', id: id }, api).catch(() => null);
        if (r && r.status === 200) {
            entradasView.renderDetail(this.mapEntradaDetail(r.header || {}, r.detail || []));
        } else {
            entradasView.renderDetail(null);
        }
    }

    // Normaliza la respuesta del backend (columnas DB) al shape que espera entradaDetailPanel.
    mapEntradaDetail(h, detail) {
        const raw     = String(h.date_inflow || '');
        const iso     = raw.length <= 10 ? (raw ? raw + 'T00:00:00' : '') : raw.replace(' ', 'T');
        const confRaw = String(h.confirmed_at || '');
        return {
            id:            h.id,
            folio:         h.folio,
            fechaIso:      iso,
            estado:        h.status,
            origen:        h.origin_name,
            origenCode:    h.origin_code,
            sucursal:      h.subsidiary_name,
            almacen:       h.warehouse_name,
            proveedor:     h.supplier_name,
            registrado:    h.user_name,
            confirmadoPor: h.confirmed_user_name || '',
            confirmadoIso: confRaw ? confRaw.replace(' ', 'T') : '',
            nota:          h.note,
            productos:  (detail || []).map(d => ({
                detailId:  d.id,
                nombre:    d.product_name,
                sku:       d.sku,
                cant:      Number(d.quantity || 0),                                                  // reportada
                cantReal:  d.confirmed_quantity != null ? Number(d.confirmed_quantity) : Number(d.quantity || 0), // real que entro
                confirmada: d.confirmed_quantity != null,
                costo:     Number(d.cost || 0),
                stockPrev: Number(d.previous_stock || 0),
                image:     d.image || '',
                icon:      'package',
                bg:        'bg-gray-700/40',
                color:     'text-gray-300'
            }))
        };
    }

    // -- Actions --

    // Genera un comprobante imprimible (documento tamano carta, B/N) de la entrada.
    // Acepta el objeto entrada ya cargado (lo pasa el panel) o un id (fetch getEntrada).
    async printEntrada(arg) {
        let e = arg;
        if (!e || typeof e !== 'object') {
            const r = await fn_ajax({ opc: 'getEntrada', id: arg }, api).catch(() => null);
            if (!(r && r.status === 200)) {
                if (typeof alert === 'function') alert({ icon: 'error', text: 'No se pudo cargar la entrada para imprimir' });
                return;
            }
            e = this.mapEntradaDetail(r.header || {}, r.detail || []);
        }
        this.renderEntradaDoc(e);
    }

    // Construye el comprobante de entrada como documento tamano carta en blanco y negro,
    // filas compactas, y lo abre en una ventana nueva (vista de documento con boton Imprimir).
    renderEntradaDoc(e) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
        const fmtMoney = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        const DOW = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
        const MON = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const fmtFecha = (iso) => {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso || '';
            const base = `${DOW[d.getDay()]} ${String(d.getDate()).padStart(2, '0')} ${MON[d.getMonth()]} ${d.getFullYear()}`;
            if (d.getHours() === 0 && d.getMinutes() === 0) return base;
            let   h    = d.getHours();
            const min  = String(d.getMinutes()).padStart(2, '0');
            const ampm = h >= 12 ? 'pm' : 'am';
            h = h % 12 || 12;
            return `${base} ${h}:${min} ${ampm}`;
        };

        const productos = e.productos || [];

        // Cantidad efectiva = la real confirmada (cae a la reportada si no se confirmo).
        const qtyOf = (it) => it.cantReal != null ? Number(it.cantReal) : Number(it.cant || 0);

        const totals = productos.reduce((acc, it) => {
            const q = qtyOf(it);
            acc.uds   += q;
            acc.costo += q * Number(it.costo || 0);
            return acc;
        }, { uds: 0, costo: 0 });
        const tipos = productos.length;
        const uds   = totals.uds;
        const costo = totals.costo;

        const rowsHtml = productos.map(it => {
            const q  = qtyOf(it);
            const cu = Number(it.costo || 0);
            return `
                <tr>
                    <td class="prod"><span class="prod-name">${esc(it.nombre)}</span>${it.sku ? ` <span class="sku">${esc(it.sku)}</span>` : ''}</td>
                    <td class="c">${esc(q)}</td>
                    <td class="r">${fmtMoney(cu)}</td>
                    <td class="r">${fmtMoney(q * cu)}</td>
                </tr>`;
        }).join('');

        // Filas de la cabecera (solo las que tienen dato).
        const infoItem = (k, v) => `<div class="info-item"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`;
        const infoHtml = [
            infoItem('Origen', e.origen || '-'),
            e.proveedor ? infoItem('Proveedor', e.proveedor) : '',
            infoItem('Fecha', fmtFecha(e.fechaIso)),
            infoItem('Sucursal', e.sucursal || '-'),
            infoItem('Almacen', e.almacen || '-'),
            infoItem('Registrado por', e.registrado || '-'),
            e.confirmadoPor ? infoItem('Confirmado por', e.confirmadoPor) : '',
            `<div class="info-item"><span class="k">Productos</span><span class="v">${tipos} tipos &middot; ${uds} uds</span></div>`
        ].join('');

        const fechaImpresion = fmtFecha(new Date().toISOString());

        const html = `
            <!doctype html>
            <html lang="es">
            <head>
                <meta charset="utf-8">
                <title>Entrada ${esc(e.folio || '')}</title>
                <style>
                    * { margin:0; padding:0; box-sizing:border-box; }
                    body { font-family:'Segoe UI', Arial, sans-serif; background:#c8c8c8; color:#000; padding:24px; }

                    .toolbar { width:816px; max-width:100%; margin:0 auto 16px; display:flex; justify-content:flex-end; gap:8px; }
                    .btn { cursor:pointer; border:1px solid #000; border-radius:4px; padding:8px 16px; font-size:13px; font-weight:600; color:#fff; background:#333; }
                    .btn:hover { opacity:.85; }
                    .btn.gray { background:#777; }

                    .sheet { width:816px; max-width:100%; min-height:1056px; margin:0 auto; background:#fff; padding:40px 48px; box-shadow:0 2px 10px rgba(0,0,0,.25); }

                    .doc-header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #000; padding-bottom:12px; margin-bottom:18px; }
                    .doc-title { font-size:22px; font-weight:800; letter-spacing:.5px; color:#000; }
                    .doc-sub { font-size:12px; color:#555; margin-top:3px; }
                    .folio-box { text-align:right; }
                    .folio { font-size:20px; font-weight:800; color:#000; }
                    .status { display:inline-block; margin-top:6px; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; padding:2px 10px; border:1px solid #000; border-radius:3px; color:#000; }

                    .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:4px 40px; margin-bottom:18px; }
                    .info-item { display:flex; justify-content:space-between; align-items:baseline; border-bottom:1px solid #ccc; padding-bottom:4px; font-size:12px; }
                    .info-item .k { color:#555; }
                    .info-item .v { font-weight:700; text-align:right; color:#000; }

                    table { width:100%; border-collapse:collapse; margin-bottom:18px; }
                    thead th { border-bottom:1.5px solid #000; font-size:10px; text-transform:uppercase; letter-spacing:.5px; color:#000; padding:4px 8px; text-align:left; }
                    thead th.r { text-align:right; }
                    thead th.c { text-align:center; }
                    tbody td { padding:3px 8px; font-size:11px; line-height:1.25; border-bottom:1px solid #e2e2e2; vertical-align:top; color:#000; }
                    tbody td.r { text-align:right; white-space:nowrap; }
                    tbody td.c { text-align:center; white-space:nowrap; }
                    .prod-name { font-weight:600; }
                    .sku { color:#777; font-size:10px; }

                    .totals { display:flex; justify-content:flex-end; }
                    .totals-box { width:280px; border:1px solid #000; border-radius:4px; padding:10px 14px; }
                    .totals-row { display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px; color:#000; }
                    .totals-row.grand { border-top:1.5px solid #000; margin-top:4px; padding-top:8px; font-size:16px; font-weight:800; color:#000; }

                    .nota { margin-top:18px; border-left:3px solid #000; background:#f7f7f7; padding:10px 14px; font-size:12px; color:#222; }
                    .nota b { display:block; margin-bottom:3px; text-transform:uppercase; font-size:10px; letter-spacing:.5px; color:#555; }

                    .doc-footer { margin-top:28px; display:flex; justify-content:space-between; font-size:10px; color:#777; border-top:1px solid #ccc; padding-top:10px; }

                    @page { size:letter; margin:1.4cm; }
                    @media print {
                        body { background:#fff; padding:0; }
                        .toolbar { display:none; }
                        .sheet { width:auto; min-height:auto; box-shadow:none; padding:0; }
                    }
                </style>
            </head>
            <body>
                <div class="toolbar">
                    <button class="btn" onclick="window.print()">Imprimir</button>
                    <button class="btn gray" onclick="window.close()">Cerrar</button>
                </div>
                <div class="sheet">
                    <div class="doc-header">
                        <div>
                            <div class="doc-title">Comprobante de Entrada</div>
                            <div class="doc-sub">${esc(e.sucursal || '')}${e.almacen ? ' &middot; ' + esc(e.almacen) : ''}</div>
                        </div>
                        <div class="folio-box">
                            <div class="folio">${esc(e.folio || '-')}</div>
                            ${e.estado ? `<span class="status">${esc(e.estado)}</span>` : ''}
                        </div>
                    </div>

                    <div class="info-grid">${infoHtml}</div>

                    <table>
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th class="c">Cant</th>
                                <th class="r">Costo unit.</th>
                                <th class="r">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHtml || `<tr><td colspan="4" class="c">Sin productos</td></tr>`}</tbody>
                    </table>

                    <div class="totals">
                        <div class="totals-box">
                            <div class="totals-row"><span>Tipos de producto</span><span>${tipos}</span></div>
                            <div class="totals-row"><span>Unidades</span><span>${uds}</span></div>
                            <div class="totals-row grand"><span>Costo total</span><span>${fmtMoney(costo)}</span></div>
                        </div>
                    </div>

                    ${e.nota ? `<div class="nota"><b>Nota</b>${esc(e.nota)}</div>` : ''}

                    <div class="doc-footer">
                        <span>Huubie &middot; Inventarios &middot; Comprobante de entrada</span>
                        <span>Generado: ${esc(fechaImpresion)}</span>
                    </div>
                </div>
            </body>
            </html>
        `;

        const w = window.open('', '_blank', 'width=900,height=1000');
        if (!w) {
            if (typeof alert === 'function') alert({ icon: 'warning', text: 'Permite las ventanas emergentes para poder ver el documento.' });
            return;
        }
        w.document.write(html);
        w.document.close();
        w.focus();
    }

    viewEntrada(folio) {
        console.log('[viewEntrada]', folio);
        app.selectEntrada(folio);
    }
}

class EntradasView extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSEntradas';
    }

    // -- Render helpers --

    renderDetail(entrada, editMode = false) {
        this.entradaDetailPanel({
            parent:   'detailPanel',
            json:     entrada,
            editMode: editMode,
            onClose: () => {
                app.selectEntrada(null);
            },
            onPrint:   (e) => { if (e) entradas.printEntrada(e); },
            onReverse: (e) => this.cancelEntrada(e),
            onConfirm: (e) => this.confirmEntrada(e),
            onEdit:       (e) => this.renderDetail(e, true),   // entra a modo edicion
            onCancelEdit: (e) => this.renderDetail(e, false),  // sale sin guardar
            onSaveEdit:   (e) => this.saveEntradaEdit(e)       // persiste los cambios
        });
    }

    // Guarda la edicion de cantidades de una entrada ya aplicada (patron CoffeeSoft:
    // recoge inputs -> swalQuestion -> editEntrada -> recarga lista, kpis y detalle).
    saveEntradaEdit(e) {
        if (!e || !e.id) return;
        const quantities = {};
        $('#detailPanel .entrada-real-qty').each(function () {
            const did = $(this).attr('data-detail-id');
            const val = parseFloat($(this).val());
            quantities[did] = isNaN(val) || val < 0 ? 0 : val;
        });

        this.swalQuestion({
            opts: {
                title:             `Editar entrada ${e.folio || ''}`.trim(),
                text:              'Se ajustara el stock del almacen con las nuevas cantidades que entraron.',
                icon:              'question',
                confirmButtonText: 'Si, guardar',
                cancelButtonText:  'No'
            },
            data: { opc: 'editEntrada', id: e.id, quantities: JSON.stringify(quantities) },
            methods: {
                send: (r) => {
                    if (r && r.status === 200) {
                        if (typeof alert === 'function') alert({ icon: 'success', text: r.message || 'Entrada actualizada' });
                        app.selectEntrada(e.folio, e.id); // recarga el detalle en modo lectura
                        entradas.lsEntradas();
                        entradas.lsKpis();
                    } else {
                        if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo actualizar la entrada' });
                    }
                }
            }
        });
    }

    // Cancela (revierte) una entrada siguiendo el patron CoffeeSoft: swalQuestion -> reverseEntrada.
    cancelEntrada(e) {
        if (!e || !e.id) return;
        if (e.estado === 'Cancelada') {
            if (typeof alert === 'function') alert({ icon: 'info', text: 'La entrada ya esta cancelada' });
            return;
        }
        this.swalQuestion({
            opts: {
                title:             `Cancelar entrada ${e.folio || ''}`.trim(),
                text:              'Se revertira el stock agregado y la entrada pasara a estado Cancelada. Esta accion no se puede deshacer.',
                icon:              'warning',
                confirmButtonText: 'Si, cancelar',
                cancelButtonText:  'No'
            },
            data: { opc: 'reverseEntrada', id: e.id },
            methods: {
                send: (r) => {
                    if (r && r.status === 200) {
                        if (typeof alert === 'function') alert({ icon: 'success', text: r.message || 'Entrada cancelada' });
                        app.selectEntrada(null);
                        entradas.lsEntradas();
                        entradas.lsKpis();
                    } else {
                        if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo cancelar la entrada' });
                    }
                }
            }
        });
    }

    // Confirma una orden de produccion Pendiente: aplica stock y pasa a Aplicada.
    confirmEntrada(e) {
        if (!e || !e.id) return;
        if (e.estado !== 'Pendiente') {
            if (typeof alert === 'function') alert({ icon: 'info', text: 'La entrada no esta pendiente de confirmar' });
            return;
        }
        // Recoge la cantidad real que entro por renglon (editada en el panel).
        const quantities = {};
        $('#detailPanel .entrada-real-qty').each(function () {
            const did = $(this).attr('data-detail-id');
            const val = parseFloat($(this).val());
            quantities[did] = isNaN(val) || val < 0 ? 0 : val;
        });

        this.swalQuestion({
            opts: {
                title:             `Confirmar produccion ${e.folio || ''}`.trim(),
                text:              'Se aplicara al almacen la cantidad que realmente entro y la entrada pasara a estado Aplicada.',
                icon:              'question',
                confirmButtonText: 'Si, confirmar',
                cancelButtonText:  'No'
            },
            data: { opc: 'confirmEntrada', id: e.id, quantities: JSON.stringify(quantities) },
            methods: {
                send: (r) => {
                    if (r && r.status === 200) {
                        if (typeof alert === 'function') alert({ icon: 'success', text: r.message || 'Produccion confirmada' });
                        app.selectEntrada(null);
                        entradas.lsEntradas();
                        entradas.lsKpis();
                    } else {
                        if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo confirmar la produccion' });
                    }
                }
            }
        });
    }

    renderInfoCards(rows) {
        this.kpisRow({
            parent:  'kpisRow',
            json:    rows,
            onClick: (kpi) => console.log('[kpisRow] click', kpi.id)
        });
    }

    renderHeader(data) {
        this.viewHeader({
            parent:   'viewHeader',
            json:     data,
            onToggle: (key, value) => console.log('[viewHeader] toggle', key, '->', value)
        });
    }

    renderFooter(data) {
        this.viewFooter({
            parent: 'viewFooter',
            json:   data
        });
    }

    renderTabs(project) {
        this.tabsBar({
            parent: 'tabsRow',
            json: [
                { id: 'stock',        label: 'Stock Actual',  active: false },
                { id: 'movimientos',  label: 'Movimientos',   active: false },
                { id: 'entradas',     label: 'Entradas',      active: true  },
                { id: 'traspasos',    label: 'Traspasos',     active: false },
                { id: 'ajustes',      label: 'Ajustes',       active: false }
            ],
            onChange: (tab) => console.log('[tabsBar]', tab.id)
        });
    }

    openEntradaForm() {
        // Sucursal destino por defecto = la seleccionada en el navbar.
        const curSub = $('#subsidiaries_id').val() || app.subId;
        if (!this.entradaFormApi) {
            this.entradaFormApi = this.entradaForm({
                parent: 'body',
                id:     'entradaFormModal',
                json:   app.dataInit.productos || [],
                data: {
                    origenes:        (app.dataInit.origenes   || []).filter(o => o.id !== ''),
                    sucursales:      (app.dataInit.sucursales || []).filter(s => s.id !== ''),
                    almacenes:       app.dataInit.almacenes || [],
                    fecha:           moment().format('YYYY-MM-DD'),
                    subsidiaries_id: curSub
                },
                onAdd: async (payload) => {
                    // El estado (Aplicada / Pendiente) lo decide el backend segun el origen:
                    // produccion entra Pendiente y no aplica stock hasta confirmarse.
                    const backendPayload = {
                        note:             payload.nota || null,
                        date_inflow:      payload.fecha,
                        inflow_origin_id: payload.origen,
                        warehouse_id:     payload.warehouseId,
                        subsidiaries_id:  payload.sucursalId,
                        productos:        payload.productos.map(p => ({
                            product_id: p.id,
                            quantity:   p.cant,
                            cost:       p.costo
                        }))
                    };

                    const r = await fn_ajax({
                        opc:     'saveEntrada',
                        payload: JSON.stringify(backendPayload)
                    }, api).catch(() => null);

                    if (r && r.status === 200) {
                        if (typeof alert === 'function') alert({ icon: r.pending ? 'info' : 'success', text: r.message || ('Entrada ' + r.folio + ' registrada') });
                        entradas.lsEntradas();
                        entradas.lsKpis();
                    } else {
                        if (typeof alert === 'function') alert({ icon: 'error', text: (r && r.message) || 'No se pudo registrar la entrada' });
                    }
                },
                onClose: () => console.log('[entradaForm] cerrado')
            });
        }
        // Sincroniza la sucursal del navbar (y sus almacenes) en cada apertura.
        this.entradaFormApi.setData({ subsidiaries_id: curSub, fecha: moment().format('YYYY-MM-DD') });
        this.entradaFormApi.open();
    }

    // -- Components --

    kpisRow(options) {
        const defaults = {
            parent: 'root',
            id:     'kpisRow',
            class:  'grid grid-cols-2 md:grid-cols-4 gap-3',
            json:   [],
            labels: {
                empty: 'Sin indicadores'
            },
            tones: {
                default: 'text-white',
                success: 'cs-text-success text-[var(--cs-success,#3FC189)]',
                warning: 'cs-text-warning text-[var(--cs-warning,#FBBF24)]',
                danger:  'cs-text-danger  text-[var(--cs-danger,#E02424)]',
                info:    'cs-text-info    text-[var(--cs-info,#1C64F2)]',
                purple:  'cs-text-purple  text-[var(--cs-accent-purple,#7C3AED)]'
            },
            cardClass:  'cs-kpi-card bg-[var(--cs-bg-input,#1F2937)] rounded-lg px-3 py-3 cursor-pointer hover:bg-[var(--cs-bg-header,#141d2b)] transition-colors',
            labelClass: 'cs-kpi-label text-[10px] uppercase tracking-wider font-bold text-[var(--cs-text-muted,#9CA3AF)]',
            valueClass: 'cs-kpi-value text-sm font-bold',
            onClick:    () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});
        opts.tones  = Object.assign({}, defaults.tones,  o.tones  || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const toneClass = (tone) => opts.tones[tone] || opts.tones.default;

        const kpiCard = (kpi, idx) => {
            const cardId = kpi.id || `${opts.id}_${idx}`;
            return `
                <div id="${cardId}" data-kpi-idx="${idx}" class="${opts.cardClass}">
                    <p class="${opts.labelClass}">${esc(kpi.label)}</p>
                    <p class="${opts.valueClass} ${toneClass(kpi.tone)}" id="${cardId}_value">${esc(kpi.value)}</p>
                </div>
            `;
        };

        const grid = $('<div>', { id: opts.id, class: opts.class });

        if (!opts.json || opts.json.length === 0) {
            grid.html(`
                <p class="col-span-full text-[10px] text-[var(--cs-text-muted,#9CA3AF)] italic text-center py-2">
                    ${esc(opts.labels.empty)}
                </p>
            `);
            $(`#${opts.parent}`).html(grid);
            return;
        }

        grid.html(opts.json.map((kpi, idx) => kpiCard(kpi, idx)).join(''));
        $(`#${opts.parent}`).html(grid);

        grid.find('[data-kpi-idx]').on('click', (e) => {
            const idx = parseInt($(e.currentTarget).attr('data-kpi-idx'), 10);
            const kpi = opts.json[idx];
            opts.onClick(kpi, idx);
        });
    }

    viewHeader(options) {
        const defaults = {
            parent: 'root',
            id:     'viewHeader',
            class:  'flex items-center justify-between w-full',
            json:   { title: '', subtitle: '', toggles: [], back: null },
            classes: {
                title:    'text-base font-bold text-white',
                subtitle: 'text-[10px] text-[var(--cs-text-secondary,#D1D5DB)]',
                groupLbl: 'text-[9px] text-[var(--cs-text-muted,#9CA3AF)] uppercase tracking-wider font-bold',
                btn:      'demo-toggle px-2.5 py-1 rounded text-[11px] border border-[var(--cs-border,#374151)] text-[var(--cs-text-secondary,#D1D5DB)] hover:bg-[var(--cs-bg-input,#1F2937)] transition-colors',
                btnActive:'demo-toggle active px-2.5 py-1 rounded text-[11px] border border-[var(--cs-accent-purple,#7C3AED)] bg-[var(--cs-accent-purple,#7C3AED)]/15 text-white',
                sep:      'text-[var(--cs-border,#374151)]',
                backBtn:  'w-8 h-8 rounded-full bg-[var(--cs-bg-input,#1F2937)] hover:bg-[var(--cs-accent-purple,#7C3AED)]/15 border border-[var(--cs-border,#374151)] hover:border-[var(--cs-accent-purple,#7C3AED)] flex items-center justify-center text-[var(--cs-text-secondary,#D1D5DB)] hover:text-white transition-colors flex-shrink-0'
            },
            onToggle: () => { },
            onBack:   null
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const state = {};
        (opts.json.toggles || []).forEach(g => { state[g.key] = g.value; });

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const toggleGroup = (g) => {
            const buttons = (g.options || []).map(op => {
                const active = state[g.key] === op.value;
                return `<button type="button"
                                data-toggle-key="${esc(g.key)}"
                                data-toggle-value="${esc(op.value)}"
                                class="${active ? opts.classes.btnActive : opts.classes.btn}">${esc(op.label)}</button>`;
            }).join('');
            return `
                <div class="flex items-center gap-2">
                    <span class="${opts.classes.groupLbl}">${esc(g.label)}</span>
                    ${buttons}
                </div>
            `;
        };

        const backCfg   = opts.json.back;
        const backHref  = typeof backCfg === 'string' ? backCfg : (backCfg && backCfg.href) || '';
        const backTitle = (backCfg && backCfg.title) || 'Regresar';
        const backHtml  = backCfg ? `
            <button type="button" id="${opts.id}_back" class="${opts.classes.backBtn}" title="${esc(backTitle)}">
                <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>
        ` : '';

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        const togglesHtml = (opts.json.toggles || [])
            .map((g, i, arr) => toggleGroup(g) + (i < arr.length - 1 ? `<span class="${opts.classes.sep}">|</span>` : ''))
            .join('');

        wrap.html(`
            <div class="flex items-center gap-3">
                ${backHtml}
                <div>
                    <h1 class="${opts.classes.title}">${esc(opts.json.title)}</h1>
                    ${opts.json.subtitle ? `<p class="${opts.classes.subtitle}">${esc(opts.json.subtitle)}</p>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-4">
                ${togglesHtml}
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

        wrap.on('click', '[data-toggle-key]', (e) => {
            const $btn = $(e.currentTarget);
            const key  = $btn.attr('data-toggle-key');
            const val  = $btn.attr('data-toggle-value');
            state[key] = val;

            $btn.siblings('[data-toggle-key="' + key + '"]').addBack().each(function () {
                const isActive  = $(this).attr('data-toggle-value') === val;
                this.className  = isActive ? opts.classes.btnActive : opts.classes.btn;
            });

            opts.onToggle(key, val, Object.assign({}, state));
        });

        if (backCfg) {
            $(`#${opts.id}_back`).on('click', () => {
                if (typeof opts.onBack === 'function') return opts.onBack();
                if (backHref) window.location.href = backHref;
            });
        }
    }

    viewFooter(options) {
        const defaults = {
            parent: 'root',
            id:     'viewFooter',
            class:  'flex items-center justify-between w-full',
            json:   { info: '', legends: [] },
            tones: {
                default: '#9CA3AF',
                success: 'var(--cs-success,#3FC189)',
                warning: 'var(--cs-warning,#FBBF24)',
                danger:  'var(--cs-danger,#E02424)',
                info:    'var(--cs-info,#1C64F2)',
                purple:  'var(--cs-accent-purple,#7C3AED)'
            },
            classes: {
                info:   'text-[10px] text-[var(--cs-text-muted,#9CA3AF)]',
                legend: 'flex items-center gap-3 text-[10px] text-[var(--cs-text-muted,#9CA3AF)]',
                item:   'flex items-center gap-1'
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.tones   = Object.assign({}, defaults.tones,   o.tones   || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const toneColor = (tone) => opts.tones[tone] || opts.tones.default;
        const legendItem = (lg) => `
            <span class="${opts.classes.item}">
                <span class="w-2 h-2 rounded-full" style="background:${toneColor(lg.tone)};"></span>
                ${esc(lg.label)}
            </span>
        `;

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        const legendsHtml = (opts.json.legends || []).map(legendItem).join('');

        wrap.html(`
            <p id="${opts.id}_info" class="${opts.classes.info}">${esc(opts.json.info)}</p>
            <div class="${opts.classes.legend}">${legendsHtml}</div>
        `);

        $(`#${opts.parent}`).html(wrap);
    }

    tabsBar(options) {
        const defaults = {
            parent: 'root',
            id:     'tabsBar',
            class:  'flex items-center gap-1 border-b border-transparent',
            json:   [],
            classes: {
                tab:       'px-3 py-2 text-[11px] font-medium text-[var(--cs-text-muted,#9CA3AF)] border-b-2 border-transparent hover:text-white transition-colors cursor-pointer',
                tabActive: 'px-3 py-2 text-[11px] font-bold text-[var(--cs-accent-purple,#A78BFA)] border-b-2 border-[var(--cs-accent-purple,#7C3AED)] cursor-pointer'
            },
            onChange: () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        wrap.html((opts.json || []).map(tab => `
            <button type="button"
                    data-tab-id="${esc(tab.id)}"
                    class="${tab.active ? opts.classes.tabActive : opts.classes.tab}">
                ${esc(tab.label)}
            </button>
        `).join(''));

        $(`#${opts.parent}`).html(wrap);

        wrap.on('click', '[data-tab-id]', (e) => {
            const id = $(e.currentTarget).attr('data-tab-id');
            wrap.find('[data-tab-id]').each(function () {
                const isActive = $(this).attr('data-tab-id') === id;
                this.className = isActive ? opts.classes.tabActive : opts.classes.tab;
            });
            const tab = (opts.json || []).find(t => t.id === id);
            opts.onChange(tab || { id });
        });
    }

    entradaDetailPanel(options) {

        // -- Config --

        const defaults = {
            parent:    'root',
            id:        'entradaDetailPanel',
            class:     'w-full h-full flex-shrink-0 bg-[#141d2b] border-l border-[#374151] flex flex-col overflow-hidden',
            json:      null,
            labels: {
                emptyTitle:  'Selecciona una entrada',
                emptyHint:   'Haz click en cualquier fila o en el icono ojo para ver el detalle aqui.',
                subtitleLbl: 'Detalle de recepcion',
                origen:      'Origen',
                sucursal:    'Sucursal',
                registrado:  'Registrado por',
                productos:   'Productos',
                costoTot:    'Costo total',
                detalleLbl:  'Detalle de Productos',
                notaLbl:     'Nota',
                cant:        'Cant',
                costo:       'Costo',
                subtotal:    'Subtot.',
                stockLbl:    'Stock',
                imprimir:    'Imprimir',
                reversar:    'Cancelar',
                confirmar:   'Confirmar produccion',
                confirmado:  'Confirmado por',
                editar:      'Editar',
                guardar:     'Guardar cambios',
                cancelarEd:  'Cancelar'
            },
            origenPalettes: {
                'Produccion':    { bg: 'rgba(124,58,237,0.15)', fg: '#A78BFA' },
                'Proveedor':     { bg: 'rgba(251,191,36,0.15)', fg: '#FBBF24' },
                'Transferencia': { bg: 'rgba(28,100,242,0.15)', fg: '#60A5FA' },
                'Devolucion':    { bg: 'rgba(244,63,94,0.15)',  fg: '#F43F5E' }
            },
            estadoPalettes: {
                'Aplicada':  { bg: 'rgba(63,193,137,0.15)', fg: '#3FC189' },
                'Pendiente': { bg: 'rgba(251,191,36,0.15)', fg: '#FBBF24' },
                'Cancelada': { bg: 'rgba(244,63,94,0.15)',  fg: '#F43F5E' }
            },
            editMode:  false,
            onClose:   () => { },
            onPrint:   () => { },
            onReverse: () => { },
            onConfirm: () => { },
            onEdit:       () => { },
            onSaveEdit:   () => { },
            onCancelEdit: () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels         = Object.assign({}, defaults.labels,         o.labels         || {});
        opts.origenPalettes = Object.assign({}, defaults.origenPalettes, o.origenPalettes || {});
        opts.estadoPalettes = Object.assign({}, defaults.estadoPalettes, o.estadoPalettes || {});

        // -- Helpers de formato --

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const fmtMoney      = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const fmtMoneyShort = (n) => '$' + Number(n).toLocaleString('en-US');

        const DOW = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
        const MON = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
        const fmtFecha = (iso) => {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return iso || '';
            const dow  = DOW[d.getDay()];
            const day  = String(d.getDate()).padStart(2, '0');
            const mon  = MON[d.getMonth()];
            let   h    = d.getHours();
            const m    = String(d.getMinutes()).padStart(2, '0');
            const ampm = h >= 12 ? 'pm' : 'am';
            h = h % 12 || 12;
            return `${dow} ${day} ${mon} ${String(h).padStart(2, '0')}:${m} ${ampm}`;
        };

        // -- Bloques de UI --

        // Botonera inferior, sin borde. Depende del estado:
        //   editando   -> Guardar cambios (verde) + Cancelar edicion (gris)
        //   pendiente  -> Confirmar produccion (verde) + Cancelar (rojo)
        //   aplicada   -> Imprimir (celeste) + Editar (ambar)
        //   resto      -> Imprimir (celeste, off en vacio) + Cancelar (rojo, off en vacio/cancelada)
        const actionsBar = (state) => {
            const s          = state || {};
            const empty      = !!s.empty;
            const pendiente  = !!s.pendiente;
            const cancelada  = !!s.cancelada;
            const aplicada   = !!s.aplicada;
            const editing    = !!s.editing;
            const base       = 'flex-1 px-3 py-1.5 text-[11px] font-semibold text-white rounded-lg flex items-center justify-center gap-1.5';
            const off        = 'opacity-40 cursor-not-allowed';
            const wrap       = (inner) => `
                <div class="px-4 py-3 border-t border-[#374151] flex gap-2 flex-shrink-0">${inner}</div>`;

            // Modo edicion (sobre una entrada Aplicada): Guardar + Cancelar edicion.
            if (editing) {
                return wrap(`
                    <button id="${opts.id}_saveEdit" class="${base} bg-green-600 hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20 transition-all">
                        <i data-lucide="save" class="w-3.5 h-3.5"></i>${esc(opts.labels.guardar)}
                    </button>
                    <button id="${opts.id}_cancelEdit" class="${base} bg-gray-600 hover:bg-gray-500 transition-all">
                        <i data-lucide="x" class="w-3.5 h-3.5"></i>${esc(opts.labels.cancelarEd)}
                    </button>`);
            }

            const leftBtn = pendiente
                ? `<button id="${opts.id}_confirm" class="${base} bg-green-600 hover:bg-green-500 hover:shadow-lg hover:shadow-green-500/20 transition-all">
                       <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>${esc(opts.labels.confirmar)}
                   </button>`
                : `<button id="${opts.id}_print" ${empty ? 'disabled' : ''} class="${base} bg-sky-600 ${empty ? off : 'hover:bg-sky-500 hover:shadow-lg hover:shadow-sky-500/20 transition-all'}">
                       <i data-lucide="printer" class="w-3.5 h-3.5"></i>${esc(opts.labels.imprimir)}
                   </button>`;

            // Boton derecho: Editar si esta Aplicada; si no, Cancelar.
            let rightBtn;
            if (aplicada) {
                rightBtn = `<button id="${opts.id}_edit" class="${base} bg-amber-600 hover:bg-amber-500 hover:shadow-lg hover:shadow-amber-500/20 transition-all">
                       <i data-lucide="pencil" class="w-3.5 h-3.5"></i>${esc(opts.labels.editar)}
                   </button>`;
            } else {
                const reverseOff = empty || cancelada;
                const revTitle   = cancelada ? ' title="La entrada ya esta cancelada"' : '';
                rightBtn = `<button id="${opts.id}_reverse" ${reverseOff ? 'disabled' : ''}${revTitle} class="${base} bg-red-600 ${reverseOff ? off : 'hover:bg-red-500 hover:shadow-lg hover:shadow-red-500/20 transition-all'}">
                       <i data-lucide="ban" class="w-3.5 h-3.5"></i>${esc(opts.labels.reversar)}
                   </button>`;
            }

            return wrap(`
                    ${leftBtn}
                    ${rightBtn}`);
        };

        // Estado vacio: sin entrada seleccionada.
        const emptyView = () => `
            <div class="px-3 py-3 border-b border-[#374151] flex-shrink-0 flex items-center justify-between">
                <div>
                    <h3 class="text-sm font-bold text-white">Vista de la Entrada</h3>
                    <p class="text-[10px] text-[#9CA3AF]">${esc(opts.labels.subtitleLbl)}</p>
                </div>
            </div>
            <div class="flex-1 flex flex-col items-center justify-center text-center px-6">
                <div class="w-14 h-14 rounded-full bg-[#1F2937] border border-[#374151] flex items-center justify-center mb-3">
                    <i data-lucide="arrow-down-to-line" class="w-6 h-6 text-[#9CA3AF]"></i>
                </div>
                <p class="text-[11px] text-[#9CA3AF]">${esc(opts.labels.emptyTitle)}</p>
                <p class="text-[10px] text-[#9CA3AF] mt-1 max-w-[220px]">${esc(opts.labels.emptyHint)}</p>
            </div>
            ${actionsBar({ empty: true })}
        `;

        // Detalle de productos en formato tabla. En ordenes de produccion se muestran
        // dos columnas de cantidad: la reportada (planeada) y la que realmente entro.
        // El input "Entro" es editable al confirmar produccion (parte de la reportada)
        // o al editar una entrada ya aplicada (parte de lo que ya entro); en otros casos
        // es solo lectura.
        const productTable = (e, editable, mostrarReportada, startFromConfirmed) => {
            const cols = mostrarReportada ? 5 : 4;

            let totReportada = 0, totEntro = 0, totSubtotal = 0;

            const rows = (e.productos || []).map(p => {
                // Valor inicial del input: en edicion parte de la cantidad confirmada (lo
                // que ya entro); al confirmar produccion, de la reportada.
                const startQty = startFromConfirmed ? Number(p.cantReal) : Number(p.cant);
                const real     = editable ? startQty : Number(p.cantReal);
                const subtotal = real * Number(p.costo);

                totReportada += Number(p.cant || 0);
                totEntro     += real;
                totSubtotal  += subtotal;

                const entroCell = editable
                    ? `<input type="number" min="0" step="any"
                              class="entrada-real-qty no-spin w-16 px-1.5 py-1 text-right rounded bg-[#141d2b] border border-[#374151] text-white text-[13px] focus:border-[#7C3AED] focus:outline-none"
                              data-detail-id="${p.detailId}" data-costo="${p.costo}" value="${startQty}">`
                    : `<span class="text-green-400 font-bold">+${real}</span>`;

                const reportadaCol = mostrarReportada
                    ? `<td class="py-1.5 px-2 text-center text-[#9CA3AF]">${p.cant}</td>`
                    : '';

                return `
                    <tr class="border-b border-[#374151]/40 hover:bg-[#1F2937]/40 transition-colors">
                        <td class="py-1.5 px-2">
                            <p class="text-[12px] font-bold text-white leading-tight truncate">${esc(p.nombre)}</p>
                        </td>
                        ${reportadaCol}
                        <td class="py-1.5 px-2 text-center whitespace-nowrap">${entroCell}</td>
                        <td class="py-1.5 px-2 text-right text-white whitespace-nowrap">${fmtMoney(p.costo)}</td>
                        <td class="py-1.5 px-2 text-right text-white font-bold whitespace-nowrap" data-subtotal-for="${p.detailId}">${fmtMoneyShort(subtotal)}</td>
                    </tr>`;
            }).join('');

            const reportadaHead = mostrarReportada
                ? `<th class="py-2 px-2 text-center font-bold">Rep.</th>`
                : '';
            const entroLabel = mostrarReportada ? 'Entró' : esc(opts.labels.cant);

            // Fila TOTAL al pie: suma de Entró (verde) y Subtotal (negrita). Las columnas
            // sin agregado (Rep., Costo) muestran un guion.
            const reportadaFoot = mostrarReportada
                ? `<td class="py-2 px-2 text-center text-[#6B7280]">—</td>`
                : '';
            const totalFoot = (e.productos || []).length ? `
                    <tfoot>
                        <tr class="border-t border-[#374151] bg-[#0E1521]/60">
                            <td class="py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">Total</td>
                            ${reportadaFoot}
                            <td class="py-2 px-2 text-center font-bold text-green-400 whitespace-nowrap" id="${opts.id}_footEntro">+${totEntro}</td>
                            <td class="py-2 px-2 text-right text-[#6B7280]">—</td>
                            <td class="py-2 px-2 text-right font-bold text-white whitespace-nowrap" id="${opts.id}_footSubtotal">${fmtMoney(totSubtotal)}</td>
                        </tr>
                    </tfoot>` : '';

            return `
                <table class="w-full text-[11px] border-collapse">
                    <thead>
                        <tr class="text-[10px] text-[#9CA3AF] uppercase tracking-wider bg-[#0E1521] border-b border-[#374151]">
                            <th class="py-2 px-2 text-left font-bold">Producto</th>
                            ${reportadaHead}
                            <th class="py-2 px-2 text-center font-bold">${entroLabel}</th>
                            <th class="py-2 px-2 text-right font-bold">${esc(opts.labels.costo)}</th>
                            <th class="py-2 px-2 text-right font-bold">${esc(opts.labels.subtotal)}</th>
                        </tr>
                    </thead>
                    <tbody>${rows || `<tr><td colspan="${cols}" class="py-2 text-center text-[12px] text-gray-500 italic">Sin productos</td></tr>`}</tbody>
                    ${totalFoot}
                </table>`;
        };

        // Estado con entrada: cabecera + resumen + productos + nota + botonera.
        const filledView = (e) => {
            const totals = (e.productos || []).reduce((acc, p) => {
                acc.uds   += Number(p.cantReal || 0);
                acc.costo += Number(p.cantReal || 0) * Number(p.costo || 0);
                return acc;
            }, { uds: 0, costo: 0 });

            const pendiente    = e.estado === 'Pendiente';
            const cancelada    = e.estado === 'Cancelada';
            const aplicada     = e.estado === 'Aplicada';
            const esProduccion = e.origenCode === 'PRODUCTION';
            // Modo edicion: solo sobre una entrada ya Aplicada cuando se pidio editar.
            const editing      = !!opts.editMode && aplicada;
            // Inputs editables al confirmar produccion pendiente o al editar una aplicada.
            const editable     = pendiente || editing;
            // En edicion partimos de la cantidad ya confirmada (lo que entro).
            const hint = editing
                ? 'Edita la cantidad que entro'
                : (pendiente && esProduccion ? 'Ajusta la cantidad que realmente entro' : '');
            const origenC   = opts.origenPalettes[e.origen] || { bg: 'rgba(156,163,175,0.18)', fg: '#9CA3AF' };
            const estadoC   = opts.estadoPalettes[e.estado] || { bg: 'rgba(63,193,137,0.15)',  fg: '#3FC189' };
            const folioCol  = e.origen === 'Transferencia' ? 'text-blue-400' : 'text-green-400';

            const origenBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style="background:${origenC.bg};color:${origenC.fg};">${esc(e.origen)}</span>`;
            const estadoBadge = `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style="background:${estadoC.bg};color:${estadoC.fg};">${esc(e.estado)}</span>`;

            return `
                <div class="px-3 py-3 border-b border-[#374151] flex-shrink-0 flex items-center justify-between">
                    <div>
                        <h3 class="text-sm font-bold ${folioCol}">Entrada ${esc(e.folio)}</h3>
                        <p class="text-[10px] text-[#9CA3AF]">${esc(fmtFecha(e.fechaIso))}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        ${estadoBadge}
                        <button id="${opts.id}_close" class="text-[#D1D5DB] hover:text-white transition-colors p-1" title="Cerrar">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto cs-scroll px-3 py-3 space-y-3">

                    <!-- Resumen -->
                    <div class="bg-[#1F2937] rounded-lg p-2 border border-[#374151] space-y-2">
                        <div class="flex justify-between items-center text-[11px]">
                            <span class="text-[#9CA3AF]">${esc(opts.labels.origen)}</span>
                            ${origenBadge}
                        </div>
                        <div class="flex justify-between text-[11px]">
                            <span class="text-[#9CA3AF]">${esc(opts.labels.sucursal)}</span>
                            <span class="text-white">${esc(e.sucursal || '-')}</span>
                        </div>
                        <div class="flex justify-between text-[11px]">
                            <span class="text-[#9CA3AF]">${esc(opts.labels.registrado)}</span>
                            <span class="text-white">${esc(e.registrado || '-')}</span>
                        </div>
                        ${e.confirmadoPor ? `
                        <div class="flex justify-between text-[11px]">
                            <span class="text-[#9CA3AF]">${esc(opts.labels.confirmado)}</span>
                            <span class="text-white">${esc(e.confirmadoPor)}${e.confirmadoIso ? ` <span class="text-[#9CA3AF]">&middot; ${esc(fmtFecha(e.confirmadoIso))}</span>` : ''}</span>
                        </div>` : ''}
                        <div class="flex justify-between text-[11px]">
                            <span class="text-[#9CA3AF]">${esc(opts.labels.productos)}</span>
                            <span class="text-white font-bold" id="${opts.id}_totUds">${e.productos.length} tipos / ${totals.uds} uds</span>
                        </div>
                        <div class="flex justify-between text-[11px]">
                            <span class="text-[#9CA3AF]">${esc(opts.labels.costoTot)}</span>
                            <span class="font-bold text-green-400" id="${opts.id}_totCosto">${fmtMoney(totals.costo)}</span>
                        </div>
                    </div>

                    <!-- Detalle de productos -->
                    <div>
                        <div class="flex items-center justify-between gap-2 mb-2">
                            <p class="text-[9px] text-[#9CA3AF] uppercase tracking-wider">${esc(opts.labels.detalleLbl)}</p>
                            ${hint ? `<span class="text-[10px] text-[#9CA3AF] text-right">${esc(hint)}</span>` : ''}
                        </div>
                        <div class="overflow-x-auto rounded-lg border border-[#374151]">${productTable(e, editable, esProduccion, editing)}</div>
                    </div>

                    <!-- Nota -->
                    ${e.nota ? `
                    <div class="bg-[#1F2937] rounded-lg p-3 border border-[#374151]">
                        <p class="text-[9px] text-[#9CA3AF] uppercase tracking-wider mb-1">${esc(opts.labels.notaLbl)}</p>
                        <p class="text-[11px] text-gray-300">${esc(e.nota)}</p>
                    </div>` : ''}
                </div>

                ${actionsBar({ pendiente, cancelada, aplicada, editing })}
            `;
        };

        // -- Construccion e insercion al DOM --

        // Oculta las flechitas (spinners) del input number "Entro". Autocontenido:
        // el panel trae su propio CSS para no depender del modal de entrada.
        if (!document.getElementById('entradaDetailPanelStyles')) {
            const style = document.createElement('style');
            style.id = 'entradaDetailPanelStyles';
            style.textContent = `
                input.no-spin::-webkit-inner-spin-button,
                input.no-spin::-webkit-outer-spin-button { -webkit-appearance: none !important; appearance: none !important; margin: 0 !important; }
                input.no-spin { -moz-appearance: textfield !important; appearance: textfield !important; }`;
            document.head.appendChild(style);
        }

        const aside = $('<aside>', { id: opts.id, class: opts.class });
        aside.html(opts.json ? filledView(opts.json) : emptyView());

        $(`#${opts.parent}`).html(aside);
        if (window.lucide) lucide.createIcons();

        // -- Eventos (solo con entrada seleccionada) --

        if (opts.json) {
            const e        = opts.json;
            const aplicada = e.estado === 'Aplicada';
            const editing  = !!opts.editMode && aplicada;

            $(`#${opts.id}_close`).on('click', () => opts.onClose(e));

            // Recalculo en vivo de subtotales/totales + captura comoda por teclado.
            // Se usa siempre que hay inputs editables: confirmar produccion pendiente
            // o editar una entrada ya aplicada.
            const bindQtyEditing = () => {
                const recalc = () => {
                    let uds = 0, costo = 0;
                    $(`#${opts.id} .entrada-real-qty`).each(function () {
                        const qty = parseFloat($(this).val()) || 0;
                        const c   = parseFloat($(this).attr('data-costo')) || 0;
                        const did = $(this).attr('data-detail-id');
                        uds   += qty;
                        costo += qty * c;
                        $(`#${opts.id} [data-subtotal-for="${did}"]`).text(fmtMoneyShort(qty * c));
                    });
                    $(`#${opts.id}_totUds`).text(`${(e.productos || []).length} tipos / ${uds} uds`);
                    $(`#${opts.id}_totCosto`).text(fmtMoney(costo));
                    $(`#${opts.id}_footEntro`).text('+' + uds);
                    $(`#${opts.id}_footSubtotal`).text(fmtMoney(costo));
                };
                $(`#${opts.id}`).on('input', '.entrada-real-qty', recalc);

                // Captura comoda:
                //  - al enfocar un input se selecciona su contenido (sobrescribir de un teclazo)
                //  - Enter salta al siguiente renglon; en el ultimo, quita el foco
                //  - al abrir, el primer input recibe foco automaticamente
                const $qtys = $(`#${opts.id} .entrada-real-qty`);
                $qtys.on('focus', function () { this.select(); });
                $(`#${opts.id}`).on('keydown', '.entrada-real-qty', function (ev) {
                    if (ev.key !== 'Enter') return;
                    ev.preventDefault();
                    const next = $qtys.get($qtys.index(this) + 1);
                    if (next) next.focus();
                    else this.blur();
                });
                if ($qtys.length) {
                    const first = $qtys.get(0);
                    first.focus({ preventScroll: true });
                    first.select();
                }
            };

            if (editing) {
                bindQtyEditing();
                $(`#${opts.id}_saveEdit`).on('click', () => opts.onSaveEdit(e));
                $(`#${opts.id}_cancelEdit`).on('click', () => opts.onCancelEdit(e));
            } else if (e.estado === 'Pendiente') {
                $(`#${opts.id}_confirm`).on('click', () => opts.onConfirm(e));
                bindQtyEditing();
                $(`#${opts.id}_reverse`).on('click', () => opts.onReverse(e));
            } else {
                $(`#${opts.id}_print`).on('click', () => opts.onPrint(e));
                if (aplicada) {
                    $(`#${opts.id}_edit`).on('click', () => opts.onEdit(e));
                } else {
                    $(`#${opts.id}_reverse`).on('click', () => opts.onReverse(e));
                }
            }
        }
    }

}
