let api         = 'ctrl/ctrl-compras.php';
let apiOrdenes  = 'ctrl/ctrl-ordenes.php';
let apiEntradas = 'ctrl/ctrl-entradas.php';
let apiAlmacen  = 'ctrl/ctrl-almacen.php';
let app, compras, calendario;

$(async () => {
    app        = new App(api, 'root');
    compras    = new Compras(api, 'root');
    calendario = new Calendario(api, 'root');
    await app.init();
});

class App extends Templates {

    // -- Bootstrap --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'compras';
    }

    async init() {
        const request = await useFetch({ url: this._link, data: { opc: 'init' } });
        this.dataInit = Object.assign({
            branch_id:   '',
            sucursales:  [],
            almacenes:   [],
            proveedores: [],
            categorias:  [],
            unidades:    [],
            compradores: [],
            productos:   [],
            tipos:       [],
            estados:     []
        }, request && request.status === 200 ? request : {});
        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        this.renderTabs();
        this.renderActiveTab();
        compras.renderDetail(null);
    }

    // -- Layout --

    layout() {
        this.primaryLayout({
            parent:       'root',
            id:           this.PROJECT_NAME,
            class:        'flex mx-2 ',
            heightPreset: 'full',
            card: {
                filterBar: { class: 'w-full ', id: 'filterBar' },
                container: { class: 'w-full my-2 h-screen rounded p-3 overflow-auto bg-white border border-gray-200', id: 'container' + this.PROJECT_NAME }
            }
        });

        this.createLayout({
            parent: 'filterBar',
            design: false,
            data: {
                id:    'filterBarWrap',
                class: 'w-full',
                container: [
                    { type: 'div', id: `filterBar${this.PROJECT_NAME}`, class: 'w-full my-3' },
                    { type: 'div', id: 'containerHours' }
                ]
            }
        });

        this.createLayout({
            parent: `container${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `visor${this.PROJECT_NAME}`,
                class: 'cs-visor h-full w-full flex flex-col md:flex-row overflow-hidden',
                container: [
                    {
                        type:  'div',
                        id:    'mainPanel',
                        class: 'flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden',
                        children: [
                            { id: 'kpisRow', class: 'pb-3 flex-shrink-0' },
                            { id: `tabs${this.PROJECT_NAME}`, class: 'flex-1 min-h-0 flex flex-col' }
                        ]
                    },
                    {
                        type:  'div',
                        id:    'detailResizer',
                        class: "!hidden md:block relative z-[5] flex-shrink-0 w-[6px] mx-1 cursor-col-resize touch-none after:content-[''] after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] after:-translate-x-1/2 after:rounded-full after:transition-colors hover:after:bg-gray-400"
                    },
                    {
                        type:  'aside',
                        id:    'detailPanel',
                        class: '!hidden w-full md:w-[var(--compras-detail-w,420px)] md:max-w-[60vw] flex-shrink-0 bg-white border border-gray-200 rounded-lg flex flex-col overflow-hidden'
                    }
                ]
            }
        });

        this.visorResize({ key: this.PROJECT_NAME, label: 'Ancho del detalle de la compra' });
    }

    toggleVisor(show) {
        $('#detailPanel, #detailResizer').toggleClass('!hidden', !show);
    }

    // -- Filter bar --

    filterBar() {
        const sucursales = this.dataInit.sucursales || [];

        this.createfilterBar({
            parent:     `filterBar${this.PROJECT_NAME}`,
            coffeesoft: true,
            theme:      'light',
            data: [
                {
                    opc:      'input',
                    id:       'fRango',
                    lbl:      'Periodo:',
                    class:    'col-12 col-md-4 col-lg-3',
                    readonly: true,
                    required: false
                },
                {
                    opc:      'select',
                    id:       'fSucursal',
                    name:     'branch_id',
                    lbl:      'Sucursal:',
                    class:    'col-12 col-md-4 col-lg-2',
                    value:    this.dataInit.branch_id,
                    data:     sucursales.length > 1 ? [{ id: '', valor: '-- Todas --' }].concat(sucursales) : sucursales,
                    onchange: 'app.onChangeFilters()'
                },
                {
                    opc:      'select',
                    id:       'fTipo',
                    name:     'purchase_type',
                    lbl:      'Tipo:',
                    class:    'col-12 col-md-4 col-lg-2',
                    data:     this.dataInit.tipos,
                    onchange: 'app.onChangeFilters()'
                },
                {
                    opc:      'select',
                    id:       'fEstado',
                    name:     'status',
                    lbl:      'Estado:',
                    class:    'col-12 col-md-4 col-lg-2',
                    value:    'Activas',
                    data:     this.dataInit.estados,
                    onchange: 'app.onChangeFilters()'
                },
                {
                    opc:         'input',
                    id:          'fBuscar',
                    name:        'q',
                    lbl:         'Buscar:',
                    class:       'col-12 col-md-4 col-lg-2',
                    placeholder: 'Folio, nombre o quién surte',
                    required:    false,
                    onkeyup:     'app.onSearch()'
                },
                {
                    opc:       'button',
                    id:        'btnNuevaCompra',
                    text:      'Nueva compra',
                    color_btn: 'invernal',
                    class:     'col-12 col-md-4 col-lg-1',
                    className: 'w-full',
                    onClick:   () => compras.addCompra()
                }
            ]
        });

        if (sucursales.length <= 1) $('#fSucursal').prop('disabled', true);
        this.initRangePicker();
    }

    initRangePicker() {
        dataPicker({
            parent: 'fRango',
            type:   'all',
            rangepicker: {
                startDate:           moment().subtract(7, 'days'),
                endDate:             moment().add(30, 'days'),
                showDropdowns:       true,
                alwaysShowCalendars: true,
                ranges: {
                    'Próximos 30 días': [moment(), moment().add(30, 'days')],
                    'Esta semana':      [moment().startOf('isoWeek'), moment().endOf('isoWeek')],
                    'Semana siguiente': [moment().add(1, 'week').startOf('isoWeek'), moment().add(1, 'week').endOf('isoWeek')],
                    'Este mes':         [moment().startOf('month'), moment().endOf('month')],
                    'Mes siguiente':    [moment().add(1, 'month').startOf('month'), moment().add(1, 'month').endOf('month')],
                    'Últimos 30 días':  [moment().subtract(30, 'days'), moment()],
                    'Mes anterior':     [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
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
            onSelect: () => setTimeout(() => this.onChangeFilters(), 0)
        });
    }

    getFilters() {
        const range = getDataRangePicker('fRango');
        return {
            branch_id:     $('#fSucursal').val() || '',
            purchase_type: $('#fTipo').val()     || '',
            status:        $('#fEstado').val()   || 'Activas',
            q:             $('#fBuscar').val()   || '',
            fi:            range.fi,
            ff:            range.ff
        };
    }

    // -- Tabs --

    renderTabs() {
        this.tabLayout({
            parent:          `tabs${this.PROJECT_NAME}`,
            id:              `tabs${this.PROJECT_NAME}Vista`,
            theme:           'light',
            type:            'button',
            renderContainer: true,
            content:         { class: 'flex-1 min-h-0 overflow-auto' },
            json: [
                { id: 'lista',      tab: 'Lista',      lucideIcon: 'list',          active: true, onClick: () => compras.lsCompras() },
                { id: 'calendario', tab: 'Calendario', lucideIcon: 'calendar-days', onClick: () => calendario.render() }
            ]
        });
    }

    renderActiveTab() {
        compras.lsCompras();
        compras.lsKpis();
    }

    // -- Event handlers --

    onChangeFilters() {
        compras.lsCompras();
        compras.lsKpis();
        calendario.refetch();
    }

    onSearch() {
        clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => this.onChangeFilters(), 350);
    }
}

class Compras extends App {

    // -- Data --

    lsCompras() {
        const filters = app.getFilters();

        this.createTable({
            parent:      'container-lista',
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data:        { opc: 'lsCompras', fi: filters.fi, ff: filters.ff },
            coffeesoft:  true,
            conf:        { datatable: true, pag: 15 },
            attr: {
                id:           `tb${this.PROJECT_NAME}`,
                theme:        'light',
                striped:      true,
                center:       [3, 6, 8],
                right:        [7],
                actionsAlign: 'left',
                f_size:       13,
                emptyMessage: 'No hay compras con estos filtros',
                extends:      true
            },
            success: () => setTimeout(() => this.markSelected(), 0)
        });
    }

    async lsKpis() {
        const filters = app.getFilters();
        const request = await useFetch({ url: this._link, data: Object.assign({ opc: 'showCompras' }, filters) });
        const counts  = request && request.status === 200 ? request.counts : {};

        this.kpisRow({
            parent: 'kpisRow',
            json: [
                { id: 'kpiPendientes', label: 'Por surtir',  value: Number(counts.pendientes || 0), tone: 'warning', icon: 'clock' },
                { id: 'kpiAtrasadas',  label: 'Atrasadas',   value: Number(counts.atrasadas  || 0), tone: Number(counts.atrasadas || 0) ? 'danger' : 'default', icon: 'alarm-clock' },
                { id: 'kpiSurtido',    label: 'En surtido',  value: Number(counts.en_surtido || 0), tone: 'info', icon: 'truck' },
                { id: 'kpiGastado',    label: 'Gastado en el periodo', value: this.fmtMoney(counts.gastado), tone: 'success', icon: 'wallet' }
            ],
            onClick: (kpi) => this.filterByKpi(kpi)
        });
    }

    async getCompraData(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getCompra', id: id } });
        if (request && request.status === 200) return request;

        this.alertBox({ type: 'error', title: (request && request.message) || 'No se pudo cargar la compra' });
        return null;
    }

    async showCompra(id) {
        this.selectedId = id;
        const data = await this.getCompraData(id);
        this.renderDetail(data);
        this.markSelected();
    }

    refresh() {
        this.lsCompras();
        this.lsKpis();
        calendario.refetch();
        if (this.selectedId) this.showCompra(this.selectedId);
    }

    // -- Event handlers --

    filterByKpi(kpi) {
        const estados = { kpiPendientes: 'Pendiente', kpiSurtido: 'En surtido', kpiGastado: 'Capturada' };
        const actual  = $('#fEstado').val();
        const estado  = estados[kpi.id] || 'Activas';
        $('#fEstado').val(actual === estado ? 'Activas' : estado);
        app.onChangeFilters();
    }

    addCompra(fecha) {
        const fechaCompra = fecha || moment().format('YYYY-MM-DD');
        this.openForm({
            tipo:      fechaCompra > moment().format('YYYY-MM-DD') ? 'Programada' : 'Esporadica',
            fecha:     fechaCompra,
            weekdays:  [moment(fechaCompra).isoWeekday()],
            branch_id: $('#fSucursal').val() || app.dataInit.branch_id
        });
    }

    editCompra(data) {
        const c = data.compra;

        this.openForm({
            id:           c.id,
            folio:        c.folio,
            tipo:         c.purchase_type,
            nombre:       c.name,
            fecha:        c.date_order,
            surte:        c.buyer_name,
            branch_id:    c.branch_id,
            warehouse_id: c.warehouse_id,
            nota:         c.note,
            productos:    this.loteFromDetail(data.detalle, true)
        });
    }

    retakeCompra(data) {
        const c = data.compra;

        this.openForm({
            tipo:         'Programada',
            origen:       c.folio,
            origen_id:    c.id,
            nombre:       c.name,
            fecha:        this.sameDateAhead(c.date_order),
            surte:        c.buyer_name,
            branch_id:    c.branch_id,
            warehouse_id: c.warehouse_id,
            nota:         c.note,
            productos:    this.loteFromDetail(data.detalle, false)
        });
    }

    async saveCompra(payload) {
        const isEdit  = !!payload.id;
        const request = await useFetch({
            url:  this._link,
            data: isEdit
                ? { opc: 'editCompra', id: payload.id, payload: JSON.stringify(payload) }
                : { opc: 'addCompra', payload: JSON.stringify(payload) }
        });

        if (request && request.status === 200) {
            this.alertBox({ type: 'success', title: request.message, timer: 2200 });
            this.selectedId = request.id;
            this.rememberBuyer(payload.buyer_name);
            this.refresh();
        } else {
            this.alertBox({ type: 'error', title: (request && request.message) || 'No se pudo guardar la compra' });
        }
    }

    async printCompra(data) {
        // La ventana se abre en el mismo clic: abierta después del fetch, el navegador la puede bloquear.
        const win = window.open('', '_blank', 'width=900,height=1000');
        if (!win) {
            this.alertBox({ type: 'warning', title: 'Permite las ventanas emergentes para ver la hoja de surtido' });
            return;
        }
        win.document.write('Preparando la hoja de surtido...');

        const request = await useFetch({ url: this._link, data: { opc: 'printCompra', id: data.compra.id } });
        if (!(request && request.status === 200)) {
            win.close();
            this.alertBox({ type: 'error', title: (request && request.message) || 'No se pudo imprimir la hoja' });
            return;
        }

        this.printSheet(request, win);
        if (data.compra.status === 'Pendiente') {
            this.alertBox({ type: 'success', title: `${data.compra.folio} pasa a En surtido`, timer: 1800 });
            this.refresh();
        }
    }

    captureCompra(data) {
        const c = data.compra;

        this.compraCaptura({
            json: {
                id:           c.id,
                folio:        c.folio,
                nombre:       c.name,
                fecha:        c.date_order,
                fechaLabel:   c.date_label,
                branch_id:    c.branch_id,
                warehouse_id: c.warehouse_id,
                surte:        c.buyer_name || '',
                productos: data.detalle.map(d => ({
                    detailId:         d.id,
                    product_id:       d.product_id,
                    nombre:           d.product_name,
                    sku:              d.sku || '',
                    unidad:           d.unit_name || '',
                    quantity_ordered: Number(d.quantity_ordered || 0),
                    cost:             Number(d.cost || 0)
                }))
            },
            data: {
                almacenes:   app.dataInit.almacenes,
                proveedores: app.dataInit.proveedores,
                productos:   app.dataInit.productos,
                compradores: app.dataInit.compradores
            },
            onCapture: async (payload, close) => {
                const request = await useFetch({ url: this._link, data: { opc: 'captureCompra', payload: JSON.stringify(payload) } });
                if (request && request.status === 200) {
                    close();
                    this.rememberBuyer(payload.buyer_name);
                    this.alertBox({ type: 'success', title: request.message, timer: 2600 });
                    this.refresh();
                } else {
                    this.alertBox({ type: 'error', title: (request && request.message) || 'No se pudo capturar la compra' });
                }
            }
        });
    }

    cancelCompra(data) {
        const c = data.compra;

        this.alertBox({
            type:        'cancel',
            title:       `Cancelar ${c.folio}`,
            detailHtml:  `La compra «${this.esc(c.name)}» quedará cancelada y ya no se podrá capturar.`,
            okLabel:     'Sí, cancelar',
            cancelLabel: 'No',
            onOk: async () => {
                const request = await useFetch({ url: this._link, data: { opc: 'cancelCompra', id: c.id } });
                this.afterAction(request, 'No se pudo cancelar la compra');
            }
        });
    }

    extendRutina(data) {
        this.alertBox({
            type:             'confirm',
            title:            'Programar más semanas',
            detailHtml:       `Se agregan fechas de la rutina ${data.compra.series_code} con los mismos materiales de la última.`,
            input:            'text',
            inputLabel:       'Semanas a programar (1 a 12)',
            inputValue:       '4',
            inputRequired:    true,
            inputValidator:   (value) => (Number(value) >= 1 && Number(value) <= 12) ? null : 'Escribe de 1 a 12 semanas',
            okLabel:          'Programar',
            cancelLabel:      'Cancelar',
            onOk: async (value) => {
                const request = await useFetch({ url: this._link, data: { opc: 'extendRutina', id: data.compra.id, weeks: Number(value) } });
                this.afterAction(request, 'No se pudo extender la rutina');
            }
        });
    }

    stopRutina(data) {
        const c = data.compra;

        this.alertBox({
            type:        'cancel',
            title:       `Detener rutina ${c.series_code}`,
            detailHtml:  `Se cancelan las fechas pendientes desde el ${this.esc(c.date_label)}. Las ya impresas o capturadas no cambian.`,
            okLabel:     'Sí, detener',
            cancelLabel: 'No',
            onOk: async () => {
                const request = await useFetch({ url: this._link, data: { opc: 'stopRutina', id: c.id } });
                this.afterAction(request, 'No se pudo detener la rutina');
            }
        });
    }

    afterAction(request, error) {
        if (request && request.status === 200) {
            this.alertBox({ type: 'success', title: request.message, timer: 2200 });
            this.refresh();
        } else {
            this.alertBox({ type: 'error', title: (request && request.message) || error });
        }
    }

    closeDetail() {
        this.selectedId = null;
        this.renderDetail(null);
        this.markSelected();
    }

    // -- Render helpers --

    renderDetail(data) {
        this.compraDetailPanel({
            parent:   'detailPanel',
            json:     data,
            onClose:  () => this.closeDetail(),
            onPrint:  (d) => this.printCompra(d),
            onCapture:(d) => this.captureCompra(d),
            onEdit:   (d) => this.editCompra(d),
            onCancel: (d) => this.cancelCompra(d),
            onRetake: (d) => this.retakeCompra(d),
            onExtend: (d) => this.extendRutina(d),
            onStop:   (d) => this.stopRutina(d)
        });
        app.toggleVisor(!!data);
    }

    markSelected() {
        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');
        if (this.selectedId) $(`#Folio_${this.selectedId}`).closest('tr').addClass('row-active');
    }

    loteFromDetail(detalle, keepCost) {
        const form     = this.compraFormInstance();
        const catalogo = app.dataInit.productos || [];

        // Al editar se conserva el costo planeado; al retomar o copiar, el costo vigente del catálogo.

        return (detalle || []).map(d => {
            const prod     = catalogo.find(p => String(p.id) === String(d.product_id)) || {};
            const cantidad = Number(d.quantity_ordered) > 0 ? Number(d.quantity_ordered) : Number(d.quantity_received || 0);
            const costo    = keepCost && d.cost != null
                ? { costo: Number(d.cost), tax: Number(d.tax || 0), costoSinTax: d.price_without_tax != null ? Number(d.price_without_tax) : form.baseFromCost(d.cost, d.tax) }
                : form.seedTax(Object.keys(prod).length ? prod : { price_without_tax: d.price_without_tax, tax: d.tax, costo: d.cost });

            return Object.assign({
                id:        String(d.product_id),
                nombre:    d.product_name,
                sku:       d.sku || '',
                categoria: d.categoria || prod.categoria || 'Sin categoria',
                unit_id:   d.unit_id || prod.unit_id || null,
                unidad:    d.unit_name || prod.unidad || '',
                image:     d.image || '',
                icon:      'package',
                bg:        'bg-gray-100',
                color:     'text-gray-500'
            }, costo, { cantidad: cantidad, stock: 0 });
        }).filter(p => p.cantidad > 0);
    }

    sameDateAhead(fecha) {
        // Las roscas del 05 ene se retoman para el próximo enero.
        const hoy  = moment().startOf('day');
        let fechaN = moment(fecha);
        while (fechaN.isSameOrBefore(hoy)) fechaN.add(1, 'year');
        return fechaN.format('YYYY-MM-DD');
    }

    rememberBuyer(nombre) {
        const lista = app.dataInit.compradores;
        if (nombre && !lista.some(c => c.valor.toLowerCase() === nombre.toLowerCase())) lista.push({ valor: nombre });
    }

    openForm(compra) {
        this.compraFormInstance().openCompra(compra);
        this.loadPlantillas();
    }

    compraFormInstance() {
        if (this.compraFormApi) return this.compraFormApi;

        this.compraFormApi = this.compraForm({
            parent: 'body',
            id:     'compraFormModal',
            json:   app.dataInit.productos || [],
            data: {
                sucursales:  app.dataInit.sucursales,
                almacenes:   app.dataInit.almacenes,
                categorias:  app.dataInit.categorias,
                unidades:    app.dataInit.unidades,
                compradores: app.dataInit.compradores,
                branch_id:   app.dataInit.branch_id,
                fecha:       moment().format('YYYY-MM-DD')
            },
            onAdd:    (payload) => this.saveCompra(payload),
            onUpdate: (payload) => this.saveCompra(payload),
            onCopy: async (id, done) => {
                const data = await this.getCompraData(id);
                if (data) done(data.compra, this.loteFromDetail(data.detalle, false));
            },
            onWarehouseChange: async (warehouseId, done) => {
                if (!warehouseId) { done({}); return; }
                const request = await useFetch({ url: apiOrdenes, data: { opc: 'stockByWarehouse', warehouse_id: warehouseId } });
                done(request && request.status === 200 ? (request.stock || {}) : {});
            },
            onCreateProduct: async (data, done) => {
                const request = await useFetch({ url: apiAlmacen, data: Object.assign({ opc: 'addProductoRapido' }, data) });
                if (!(request && request.status === 200 && request.id)) {
                    done(null, (request && request.message) || 'No se pudo crear el producto');
                    return;
                }
                done(this.productoNuevo(request, data));
            },
            onLoadFormatos: async () => {
                const request = await useFetch({ url: apiEntradas, data: { opc: 'lsFormatos' } });
                return request && request.status === 200 ? (request.formatos || []) : [];
            },
            onSaveFormato: async (data) => {
                const request = await useFetch({
                    url:  apiEntradas,
                    data: {
                        opc:       'saveFormato',
                        name:      data.name,
                        scope:     data.scope,
                        productos: JSON.stringify((data.productos || []).map(p => ({ id: p.id, cantidad: p.cantidad })))
                    }
                });
                if (!(request && request.status === 200)) {
                    this.alertBox({ type: 'error', title: (request && request.message) || 'No se pudo guardar el formato' });
                } else if (!data.silent) {
                    this.alertBox({ type: 'success', title: request.message || 'Formato guardado', timer: 1600 });
                }
            },
            onDeleteFormato: async (id) => {
                const request = await useFetch({ url: apiEntradas, data: { opc: 'deleteFormato', id: id } });
                if (!(request && request.status === 200)) {
                    this.alertBox({ type: 'error', title: (request && request.message) || 'No se pudo eliminar el formato' });
                }
            }
        });

        return this.compraFormApi;
    }

    async loadPlantillas() {
        const request = await useFetch({ url: this._link, data: { opc: 'lsPlantillas' } });
        this.compraFormApi.setPlantillas(request && request.status === 200 ? request.plantillas : []);
    }

    productoNuevo(request, data) {
        const categoria = (app.dataInit.categorias || []).find(c => String(c.id) === String(data.category_id));
        const unidad    = (app.dataInit.unidades || []).find(u => String(u.id) === String(data.unit_id));
        return {
            id:                String(request.id),
            nombre:            data.name,
            sku:               request.sku || '',
            categoria:         categoria ? categoria.valor : 'Sin categoria',
            costo:             data.costo,
            price_without_tax: data.cost_unit,
            tax:               data.cost_tax,
            unit_id:           data.unit_id || null,
            unidad:            unidad ? unidad.valor : '',
            stock:             0,
            image:             '',
            icon:              'package',
            bg:                'bg-gray-100',
            color:             'text-gray-500'
        };
    }

    fmtMoney(n) {
        return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    fmtQty(n) {
        return Number(Number(n || 0).toFixed(2));
    }

    esc(text) {
        return $('<span>').text(text == null ? '' : String(text)).html();
    }

    // -- Components --

    compraDetailPanel(options) {
        const defaults = {
            parent: 'detailPanel',
            id:     'compraDetail',
            json:   null,
            labels: {
                emptyTitle: 'Selecciona una compra',
                emptyHint:  'Haz clic en el ojo de una fila o en el calendario para ver el detalle aquí.'
            },
            onClose: () => {}, onPrint: () => {}, onCapture: () => {}, onEdit: () => {},
            onCancel: () => {}, onRetake: () => {}, onExtend: () => {}, onStop: () => {}
        };
        const opts    = Object.assign({}, defaults, options);
        const container = $(`#${opts.parent}`);
        if (!container.length) return;

        if (!opts.json) {
            container.empty().append(
                $('<div>', { class: 'flex-1 flex flex-col items-center justify-center text-center px-6 py-12' }).append(
                    $('<i>', { 'data-lucide': 'shopping-cart', class: 'w-10 h-10 text-gray-300 mb-3' }),
                    $('<p>', { class: 'text-sm font-semibold text-gray-500', text: opts.labels.emptyTitle }),
                    $('<p>', { class: 'text-xs text-gray-400 mt-1 max-w-[220px]', text: opts.labels.emptyHint })
                )
            );
            if (window.lucide) lucide.createIcons();
            return;
        }

        const data      = opts.json;
        const c         = data.compra;
        const capturada = c.status === 'Capturada';

        const iconButton = (icon, title, fn) => $('<button>', {
            type: 'button', title: title,
            class: 'w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors',
            click: () => fn(data)
        }).append($('<i>', { 'data-lucide': icon, class: 'w-3.5 h-3.5' }));

        const header = $('<div>', { class: 'px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-start justify-between gap-2 flex-shrink-0' }).append(
            $('<div>', { class: 'min-w-0' }).append(
                $('<p>', { class: 'text-xs text-gray-500 uppercase tracking-wider', text: c.folio }),
                $('<p>', { class: 'text-base font-bold text-gray-800 truncate', text: c.name }),
                $('<div>', { class: 'flex items-center gap-1.5 mt-1' }).append($('<span>').html(c.tipo_badge), $('<span>').html(c.status_badge))
            ),
            $('<div>', { class: 'flex items-center gap-1.5 flex-shrink-0' }).append(
                iconButton('printer', 'Imprimir hoja', opts.onPrint),
                iconButton('x', 'Cerrar', opts.onClose)
            )
        );

        const steps   = ['Pendiente', 'En surtido', 'Capturada'];
        const current = steps.indexOf(c.status);
        const stepper = $('<div>', { class: 'flex items-center px-4 py-2.5 border-b border-gray-200 flex-shrink-0' });
        if (c.status === 'Cancelada') {
            stepper.append($('<span>', { class: 'text-[11px] font-semibold text-gray-500', text: 'Compra cancelada' }));
        } else {
            steps.forEach((step, idx) => {
                const done = idx <= current;
                stepper.append($('<div>', { class: 'flex flex-col items-center flex-shrink-0' }).append(
                    $('<span>', { class: `w-2.5 h-2.5 rounded-full border-2 ${done ? 'bg-blue-600 border-blue-600' : 'bg-white border-gray-300'}` }),
                    $('<span>', { class: `text-[9px] font-semibold mt-0.5 ${idx === current ? 'text-blue-700' : 'text-gray-400'}`, text: step })
                ));
                if (idx < steps.length - 1) stepper.append($('<span>', { class: `h-0.5 flex-1 mx-1 mb-3 ${idx < current ? 'bg-blue-600' : 'bg-gray-200'}` }));
            });
        }

        const infoRow = (label, value, cls) => $('<div>', { class: 'flex items-start justify-between gap-2 text-xs' }).append(
            $('<span>', { class: 'text-gray-500 w-28 flex-shrink-0', text: label }),
            $('<span>', { class: `text-right ${cls || 'text-gray-700'}`, text: value })
        );

        const info = $('<div>', { class: 'px-4 py-3 border-b border-gray-200 space-y-1.5' }).append(
            infoRow(c.series_code ? 'Fecha de la rutina' : 'Fecha', c.date_label),
            infoRow('Surte', c.buyer_name || 'Sin asignar', c.buyer_name ? '' : 'text-gray-400 italic'),
            infoRow('Sucursal', c.branch_name || '-'),
            infoRow('Almacén destino', c.warehouse_name || 'Sin definir', c.warehouse_name ? '' : 'text-gray-400 italic'),
            c.origin_folio ? infoRow('Retomada de', c.origin_folio, 'text-blue-700 font-semibold') : '',
            data.entrada ? infoRow('Entrada generada', data.entrada.folio, 'text-green-700 font-semibold') : '',
            capturada && c.captured_user_name ? infoRow('Capturó', c.captured_user_name) : '',
            c.note ? $('<p>', { class: 'text-[11px] bg-amber-50 border border-amber-100 text-amber-800 rounded-md px-2.5 py-1.5 mt-2', text: c.note }) : ''
        );

        const serie = data.serie ? $('<div>', { class: 'mx-4 mt-3 rounded-lg border border-indigo-100 bg-indigo-50/50 px-3 py-2.5' }).append(
            $('<p>', { class: 'text-[11px] font-semibold text-indigo-800 flex items-center gap-1.5' }).append(
                $('<i>', { 'data-lucide': 'repeat', class: 'w-3.5 h-3.5' }),
                document.createTextNode(`${c.series_code} · cada ${c.weekdays_label}`)
            ),
            $('<p>', {
                class: 'text-[11px] text-indigo-700 mt-0.5',
                text: Number(data.serie.pendientes)
                    ? `${data.serie.pendientes} fechas pendientes · programada hasta el ${data.serie.last_label}`
                    : 'Sin fechas pendientes'
            }),
            $('<div>', { class: 'flex gap-2 mt-2' }).append(
                this.panelButton('Más semanas', 'calendar-plus', 'outline', () => opts.onExtend(data)),
                Number(data.serie.pendientes) ? this.panelButton('Detener rutina', 'square', 'danger', () => opts.onStop(data)) : ''
            )
        ) : '';

        const materiales = $('<div>', { class: 'px-4 py-3' }).append(
            $('<div>', { class: 'flex items-center justify-between mb-1' }).append(
                $('<p>', { class: 'text-xs uppercase tracking-wider text-gray-500', text: `Materiales (${data.detalle.length})` }),
                capturada ? $('<p>', { class: 'text-[10px] text-gray-400', text: 'pedido · surtido · costo' }) : ''
            ),
            data.detalle.map(d => this.materialRow(d, capturada)),
            data.historial.length ? $('<p>', { class: 'text-xs uppercase tracking-wider text-gray-500 mt-5 mb-1', text: 'Veces anteriores' }) : '',
            data.historial.map(h => $('<div>', {
                class: 'flex items-center justify-between py-2 border-b border-gray-100 text-xs cursor-pointer hover:bg-gray-50',
                click: () => this.showCompra(h.id)
            }).append(
                $('<span>', { class: 'text-gray-700', text: `${h.folio} · ${h.date_label}` }),
                $('<span>', { class: 'text-gray-500', text: this.fmtMoney(h.total_cost) })
            ))
        );

        const total = $('<div>', { class: 'cs-visor-totals px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex-shrink-0 flex items-center justify-between' }).append(
            $('<span>', { class: 'text-sm font-semibold text-gray-700', text: capturada ? 'Total gastado' : 'Estimado' }),
            $('<span>', { class: `text-lg font-bold ${capturada ? 'text-green-600' : 'text-gray-700'}`, text: this.fmtMoney(c.total_cost) })
        );

        const acciones = {
            'Pendiente':  [
                this.panelButton('Imprimir hoja', 'printer', 'primary', () => opts.onPrint(data)),
                this.panelButton('Capturar', 'clipboard-check', 'outline', () => opts.onCapture(data)),
                this.panelIconButton('pencil', 'Editar', () => opts.onEdit(data)),
                this.panelIconButton('ban', 'Cancelar', () => opts.onCancel(data), true)
            ],
            'En surtido': [
                this.panelButton('Capturar surtido', 'clipboard-check', 'primary', () => opts.onCapture(data)),
                this.panelButton('Reimprimir', 'printer', 'outline', () => opts.onPrint(data)),
                this.panelIconButton('ban', 'Cancelar', () => opts.onCancel(data), true)
            ],
            'Capturada':  [this.panelButton('Retomar en otra fecha', 'calendar-plus', 'primary', () => opts.onRetake(data))],
            'Cancelada':  [this.panelButton('Retomar', 'calendar-plus', 'outline', () => opts.onRetake(data))]
        };

        // Las acciones van arriba: con el contenedor h-screen del layout el pie del
        // panel puede quedar debajo del borde de la pantalla.
        container.empty().append(
            $('<div>', { id: opts.id, class: 'flex-1 flex flex-col overflow-hidden' }).append(
                header,
                $('<div>', { class: 'px-4 py-2.5 border-b border-gray-200 flex gap-2 flex-shrink-0' }).append(acciones[c.status] || []),
                stepper,
                $('<div>', { class: 'flex-1 min-h-0 overflow-y-auto flex flex-col' }).append(info, serie, materiales),
                total
            )
        );
        if (window.lucide) lucide.createIcons();
    }

    materialRow(d, capturada) {
        const unidad = d.unit_name ? ` ${d.unit_name}` : '';
        const right  = $('<div>', { class: 'flex items-center gap-2 flex-shrink-0 text-xs' });

        if (capturada) {
            const recibido = Number(d.quantity_received || 0);
            const pedido   = Number(d.quantity_ordered || 0);
            const color    = recibido >= pedido ? 'text-green-600' : recibido > 0 ? 'text-orange-500' : 'text-red-500';
            right.append(
                $('<span>', { class: 'text-gray-400', text: pedido ? this.fmtQty(pedido) : 'extra' }),
                $('<span>', { class: `font-bold ${color}`, text: this.fmtQty(recibido) + unidad }),
                $('<span>', { class: 'text-gray-500 w-20 text-right', text: this.fmtMoney(d.subtotal) })
            );
        } else {
            right.append($('<span>', { class: 'font-semibold text-gray-800', text: this.fmtQty(d.quantity_ordered) + unidad }));
        }

        return $('<div>', { class: 'flex items-center justify-between gap-2 py-2 border-b border-gray-100' }).append(
            $('<div>', { class: 'min-w-0' }).append(
                $('<p>', { class: 'text-xs font-medium text-gray-700 truncate', text: d.product_name }),
                capturada && d.purchase_place ? $('<p>', { class: 'text-[10px] text-gray-400 truncate', text: d.purchase_place }) : ''
            ),
            right
        );
    }

    panelButton(text, icon, tone, fn) {
        const tones = {
            primary: 'text-white bg-blue-600 hover:bg-blue-700',
            outline: 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50',
            danger:  'text-red-600 bg-white border border-red-200 hover:bg-red-50'
        };
        return $('<button>', {
            type:  'button',
            class: `flex-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors ${tones[tone]}`,
            click: fn
        }).append($('<i>', { 'data-lucide': icon, class: 'w-3.5 h-3.5' }), $('<span>', { text: text }));
    }

    panelIconButton(icon, title, fn, danger) {
        return $('<button>', {
            type:  'button',
            title: title,
            class: `px-2.5 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 ${danger ? 'text-red-500' : 'text-gray-600'}`,
            click: fn
        }).append($('<i>', { 'data-lucide': icon, class: 'w-3.5 h-3.5' }));
    }

    printSheet(data, win) {
        const c       = data.compra;
        const blank   = () => $('<div>', { class: 'blank' });
        const filas   = data.detalle.map((d, idx) => $('<tr>').append(
            $('<td>', { class: 'n', text: idx + 1 }),
            $('<td>').append($('<span>', { class: 'prod', text: d.product_name }), d.sku ? $('<span>', { class: 'sku', text: d.sku }) : ''),
            $('<td>', { class: 'c b', text: `${this.fmtQty(d.quantity_ordered)} ${d.unit_name || ''}` }),
            $('<td>').append(blank()), $('<td>').append(blank()), $('<td>').append(blank())
        ));
        const libres  = [1, 2, 3].map(n => $('<tr>').append(
            $('<td>', { class: 'n muted', text: data.detalle.length + n }),
            $('<td>').append(blank()), $('<td>').append(blank()), $('<td>').append(blank()), $('<td>').append(blank()), $('<td>').append(blank())
        ));

        const sheet = $('<div>', { class: 'sheet' }).append(
            $('<div>', { class: 'head' }).append(
                $('<div>').append(
                    $('<div>', { class: 'kicker', text: `Hoja de surtido · ${$('<div>').html(c.tipo_badge).text()}` }),
                    $('<h1>', { text: c.name }),
                    $('<div>', { class: 'muted', text: [c.branch_name, c.warehouse_name].filter(Boolean).join(' · ') })
                ),
                $('<div>', { class: 'r' }).append(
                    $('<div>', { class: 'folio', text: c.folio }),
                    $('<div>', { class: 'muted' }).append(document.createTextNode('Fecha de compra: '), $('<b>', { text: c.date_label })),
                    $('<div>', { class: 'muted', text: `Impresa: ${moment().format('DD/MM/YYYY HH:mm')}` })
                )
            ),
            $('<div>', { class: 'meta' }).append(
                $('<span>').append($('<span>', { class: 'muted', text: 'Surte: ' }), $('<b>', { text: c.buyer_name || '____________________' })),
                c.origin_folio ? $('<span>').append($('<span>', { class: 'muted', text: 'Retoma: ' }), $('<b>', { text: c.origin_folio })) : ''
            ),
            c.note ? $('<div>', { class: 'note' }).append($('<b>', { text: 'Nota: ' }), document.createTextNode(c.note)) : '',
            $('<table>').append(
                $('<thead>').append($('<tr>').append(
                    $('<th>', { class: 'n', text: '#' }),
                    $('<th>', { text: 'Producto' }),
                    $('<th>', { class: 'c w-pedido', text: 'Pedido' }),
                    $('<th>', { class: 'w-surtido', text: 'Surtido' }),
                    $('<th>', { class: 'w-costo', text: 'Costo total' }),
                    $('<th>', { class: 'w-lugar', text: 'Dónde / proveedor' })
                )),
                $('<tbody>').append(filas, libres),
                $('<tfoot>').append($('<tr>').append(
                    $('<td>', { colspan: 4, class: 'r b', text: 'TOTAL GASTADO' }),
                    $('<td>').append(blank()),
                    $('<td>')
                ))
            ),
            $('<p>', { class: 'hint', text: 'Si algo no se consiguió, anota 0 en "Surtido". Engrapa los tickets al reverso de esta hoja.' }),
            $('<div>', { class: 'firmas' }).append(
                $('<div>').append($('<b>', { text: c.buyer_name || 'Quien surte' }), $('<br>'), $('<span>', { class: 'muted', text: 'Surtió · fecha y firma' })),
                $('<div>').append($('<b>', { text: 'Recibe en almacén' }), $('<br>'), $('<span>', { class: 'muted', text: 'Nombre, fecha y firma' }))
            )
        );

        const toolbar = $('<div>', { class: 'toolbar' }).append(
            $('<button>', { class: 'btn gray', onclick: 'window.close()', text: 'Cerrar' }),
            $('<button>', { class: 'btn', onclick: 'window.print()', text: 'Imprimir' })
        );

        const css = '@page{size:letter;margin:14mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:Inter,Arial,sans-serif;color:#111;font-size:12px;background:#e5e7eb}'
            + '.toolbar{display:flex;justify-content:flex-end;gap:8px;padding:10px 16px;background:#fff;border-bottom:1px solid #d1d5db}.btn{cursor:pointer;border:1px solid #111;border-radius:6px;padding:7px 16px;font-weight:600;background:#111;color:#fff}.btn.gray{background:#fff;color:#111}'
            + '.sheet{width:816px;max-width:100%;min-height:1056px;margin:16px auto;background:#fff;padding:40px 48px}.head{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:10px}'
            + 'h1{font-size:21px;margin:2px 0}.kicker{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#555;font-weight:700}.folio{font-size:18px;font-weight:800}.muted{color:#555}.r{text-align:right}.b{font-weight:700}'
            + '.meta{display:flex;gap:40px;margin:10px 0}.note{border:1px solid #bbb;border-radius:4px;padding:6px 10px;margin:8px 0}table{width:100%;border-collapse:collapse;margin-top:12px}'
            + 'th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;text-align:left;padding:8px 6px;border-top:2px solid #111;border-bottom:2px solid #111}td{padding:10px 6px;border-bottom:1px solid #ccc;vertical-align:bottom}'
            + '.c{text-align:center}.n{width:26px;text-align:center;color:#555}.prod{font-weight:600}.sku{color:#777;font-size:10px;margin-left:6px}.w-pedido{width:90px}.w-surtido{width:90px}.w-costo{width:110px}.w-lugar{width:150px}'
            + '.blank{border-bottom:1px solid #888;height:18px}tfoot td{border-top:2px solid #111;border-bottom:none}.hint{font-size:10px;color:#555;margin-top:8px}'
            + '.firmas{display:flex;gap:60px;margin-top:70px;text-align:center}.firmas div{flex:1;border-top:1px solid #111;padding-top:6px}'
            + '@media print{body{background:#fff}.toolbar{display:none}.sheet{margin:0;padding:0;width:auto;min-height:auto}}';

        const html = '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Hoja de surtido ' + this.esc(c.folio) + '</title><style>' + css + '</style></head><body>'
            + toolbar.prop('outerHTML') + sheet.prop('outerHTML') + '</body></html>';

        win.document.open();
        win.document.write(html);
        win.document.close();
        win.focus();
    }
}

class Calendario extends App {

    // -- Bootstrap --

    render() {
        if (this.calendar) {
            this.calendar.updateSize();
            return;
        }
        if (typeof FullCalendar === 'undefined') {
            $('#container-calendario').text('No se pudo cargar el calendario.');
            return;
        }

        this.applyStyles();
        this.layout();
        this.calendar = new FullCalendar.Calendar(document.getElementById(`calendar${this.PROJECT_NAME}`), {
            initialView:   'dayGridMonth',
            locale:        'es',
            firstDay:      1,
            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek,listMonth' },
            // El bundle global no trae el locale 'es': los botones se traducen aquí (igual que en Pedidos).
            buttonText:    { today: 'Hoy', month: 'Mes', week: 'Semana', list: 'Agenda' },
            noEventsText:  'Sin compras en este periodo',
            height:        'auto',
            dayMaxEvents:  3,
            moreLinkClick: 'popover',
            moreLinkText:  (n) => `+${n} más`,
            eventOrder:    'start,title',
            events:        (info, success) => this.lsEvents(info, success),
            eventContent:  (arg) => this.renderEvent(arg),
            eventDidMount: () => this.paintIcons(),
            eventClick:    (info) => compras.showCompra(Number(info.event.id)),
            dateClick:     (info) => compras.addCompra(info.dateStr),
            datesSet:      () => this.paintIcons()
        });
        this.calendar.render();
    }

    // -- Layout --

    layout() {
        this.createLayout({
            parent: 'container-calendario',
            design: false,
            data: {
                id:    `calendarWrap${this.PROJECT_NAME}`,
                class: 'w-full',
                container: [
                    { type: 'div', id: `calendar${this.PROJECT_NAME}`, class: 'w-full' },
                    { type: 'div', id: `calendarLegend${this.PROJECT_NAME}`, class: 'flex flex-wrap items-center gap-4 mt-2 text-[11px] text-gray-500' }
                ]
            }
        });

        $(`#calendarLegend${this.PROJECT_NAME}`).append(
            Object.values(Calendario.TIPOS).map(t => $('<span>', { class: 'flex items-center gap-1.5' }).append(
                $('<span>', { class: 'w-2.5 h-2.5 rounded-full', css: { background: t.color } }),
                $('<span>', { text: t.label })
            )),
            $('<span>', { class: 'ml-auto text-gray-400', text: 'Clic en un día para programar una compra' })
        );
    }

    // -- Data --

    async lsEvents(info, success) {
        const filters = app.getFilters();
        const request = await useFetch({
            url:  this._link,
            data: {
                opc:           'lsCalendario',
                branch_id:     filters.branch_id,
                purchase_type: filters.purchase_type,
                fi:            info.startStr.slice(0, 10),
                ff:            moment(info.end).subtract(1, 'day').format('YYYY-MM-DD')
            }
        });

        success((request && request.status === 200 ? request.events : []).map(e => Object.assign(e, {
            color:      (Calendario.TIPOS[e.extendedProps.purchase_type] || {}).color,
            classNames: [e.extendedProps.status === 'Capturada' ? 'cp-done' : '', String(e.id) === String(compras.selectedId) ? 'cp-sel' : ''].filter(Boolean)
        })));
    }

    refetch() {
        if (this.calendar) this.calendar.refetchEvents();
    }

    // -- Render helpers --

    static get TIPOS() {
        return {
            Rutina:     { label: 'Rutina',     color: '#6366F1', icon: 'repeat' },
            Programada: { label: 'Programada', color: '#C05A40', icon: 'star' },
            Esporadica: { label: 'Esporádica', color: '#0D9488', icon: 'zap' }
        };
    }

    renderEvent(arg) {
        const p      = arg.event.extendedProps;
        const tipo   = Calendario.TIPOS[p.purchase_type] || { label: p.purchase_type, icon: 'circle' };
        const pills  = {
            'Pendiente':  'bg-yellow-100 text-yellow-700 border border-yellow-300',
            'En surtido': 'bg-orange-100 text-orange-700 border border-orange-300',
            'Capturada':  'bg-green-100 text-green-700 border border-green-300'
        };

        const card = $('<div>', { class: 'px-[8px] py-[6px] w-full' }).append(
            $('<div>', { class: 'font-semibold text-[12px] leading-tight mb-0.5 line-clamp-2 whitespace-normal', text: arg.event.title }),
            $('<div>', { class: 'flex items-center gap-1 text-[11px] opacity-90' }).append(
                $('<i>', { 'data-lucide': tipo.icon, class: 'w-3 h-3 flex-shrink-0' }),
                $('<span>', { class: 'truncate', text: `${tipo.label} · ${p.total_products} mat.` })
            ),
            p.buyer_name ? $('<div>', { class: 'flex items-center gap-1 text-[11px] opacity-90' }).append(
                $('<i>', { 'data-lucide': 'user', class: 'w-3 h-3 flex-shrink-0' }),
                $('<span>', { class: 'truncate', text: p.buyer_name })
            ) : '',
            $('<div>', { class: 'mt-1 flex items-center justify-between gap-1' }).append(
                $('<span>', { class: `${pills[p.status] || ''} px-1.5 py-px rounded-full text-[10px] leading-4 font-medium whitespace-nowrap`, text: p.status }),
                $('<span>', { class: 'bg-black/25 text-white text-[10px] font-semibold px-1 py-px rounded whitespace-nowrap', text: p.folio })
            )
        );
        return { domNodes: [card[0]] };
    }

    paintIcons() {
        clearTimeout(this.iconsTimer);
        this.iconsTimer = setTimeout(() => { if (window.lucide) lucide.createIcons(); }, 0);
    }

    applyStyles() {
        // Mismos ajustes que applyCalendarStyles() de Pedidos, con la paleta clara del módulo.
        if ($('#compras-calendar-styles').length) return;
        $('<style>', {
            id:   'compras-calendar-styles',
            text: `
                #calendarcompras { --fc-border-color:#e5e7eb; --fc-today-bg-color:rgb(var(--brand-50, 251 243 239)); --fc-page-bg-color:#fff; --fc-neutral-bg-color:#f9fafb; --fc-list-event-hover-bg-color:rgb(var(--brand-50, 251 243 239)); font-size:12px; }
                #calendarcompras thead { background:#f9fafb; }
                #calendarcompras .fc-col-header-cell { color:#6b7280; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.05em; padding:6px 0; }
                #calendarcompras .fc-col-header-cell-cushion, #calendarcompras .fc-daygrid-day-number { color:#4b5563; text-decoration:none; }
                #calendarcompras .fc-day-today .fc-daygrid-day-number { background:rgb(var(--brand-600, 192 90 64)); color:#fff; border-radius:999px; min-width:22px; text-align:center; margin:3px; padding:1px 6px; font-weight:700; }
                #calendarcompras .fc-daygrid-day { cursor:pointer; }
                #calendarcompras .fc-daygrid-day-frame { min-height:110px; }
                #calendarcompras .fc-toolbar-title { color:#1f2937; font-size:15px; font-weight:700; }
                #calendarcompras .fc-toolbar-title::first-letter { text-transform:uppercase; }
                #calendarcompras .fc-button { background:#fff; border:1px solid #d1d5db; color:#374151; font-size:12px; font-weight:600; padding:4px 10px; box-shadow:none; text-transform:capitalize; }
                #calendarcompras .fc-button:hover { background:#f9fafb; color:#111827; }
                #calendarcompras .fc-button-primary:not(:disabled).fc-button-active, #calendarcompras .fc-button-primary:not(:disabled):active { background:rgb(var(--brand-50, 251 243 239)); border-color:rgb(var(--brand-200, 239 201 188)); color:rgb(var(--brand-700, 168 74 51)); }
                #calendarcompras .fc-button:focus { box-shadow:0 0 0 2px rgb(var(--brand-600, 192 90 64) / .2) !important; }
                #calendarcompras .fc-event { cursor:pointer; border:none; border-radius:6px; transition:transform .2s, box-shadow .2s; }
                #calendarcompras .fc-event:hover { transform:translateY(-1px); box-shadow:0 4px 8px rgba(0,0,0,.15); }
                #calendarcompras .fc-daygrid-event { margin-bottom:2px !important; white-space:normal; }
                #calendarcompras .fc-event.cp-sel { outline:2px solid #1f2937; outline-offset:1px; }
                #calendarcompras .fc-event.cp-done { opacity:.55; }
                #calendarcompras .fc-more-link { font-size:.7rem; padding:2px 6px; background:#f3f4f6; color:#4b5563; border-radius:4px; margin-top:2px; }
                #calendarcompras .fc-popover { border:1px solid #e5e7eb; border-radius:8px; box-shadow:0 10px 30px rgba(0,0,0,.12); overflow:hidden; }
                #calendarcompras .fc-popover-header { background:#f9fafb; color:#1f2937; padding:6px 10px; font-weight:600; }
                #calendarcompras .fc-popover-body { padding:6px; min-width:220px; }
                #calendarcompras .fc-list-event { cursor:pointer; }
            `
        }).appendTo('head');
    }
}
