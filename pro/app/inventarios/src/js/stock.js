// -- Stock --
// El «Visor de Stock» de inventory/operacion/almacen/stock aplicado al Catálogo
// de pro: tarjetas por nivel (clic = filtra), filtros, la tabla de existencias
// y la vista del producto a la derecha (con el pronóstico). Pestañas «Por
// caducar» (lo propio de pro) y «Conteos físicos» (la de inventory: la hoja de
// conteo, aplicar el ajuste y su comprobante). Comunes (can, invEsc,
// viewHeader...) en inventarios.js.

let apiStock = 'ctrl/ctrl-stock.php';
let app, stock, stockView, lots, stockPrediction, stockCount, ajustes;

const MOVIMIENTOS_STOCK = [
    { id: '',    valor: 'Todos los productos' },
    { id: 'con', valor: 'Con movimientos (últimos 30 días)' }
];

$(async () => {
    stockView       = new StockView(apiStock, 'root');
    stock           = new Stock(apiStock, 'root');
    lots            = new Lots(apiStock, 'root');
    stockPrediction = new StockPrediction(apiStock, 'root');
    stockCount      = new StockCount(apiStock, 'root');
    ajustes         = new Ajustes(apiStock, 'root');
    app             = new App(apiStock, 'root');
    await app.init();
});

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSStock';
        this.subId        = null;
        this.selectedId   = null;
        this.lotsReady    = false;
        this.ajustesReady = false;
        this.nivel        = '';
    }

    async init() {
        const r = await useFetch({ url: apiStock, data: { opc: 'init' } });

        if (!r || r.status !== 200) return invBlocked(r && r.message);

        INV_ACTIONS = r.actions || [];

        this.dataInit = {
            branch_id:      r.branch_id || '',
            branch:         (r.scope || {}).branch || '',
            sucursales:     r.sucursales || [],
            categorias:     r.categorias || [],
            areas:          r.areas || [],
            movimientoDias: r.movement_days || 30,
            lots:           r.lots || 0,
            costs:          !!r.costs,
            almacenes:      r.warehouses || [],
            estadosAjuste:  r.estados_ajuste || []
        };
        this.subId = this.dataInit.branch_id;

        this.render();
    }

    render() {
        this.layout();
        this.visorResize({ key: 'stock', label: 'Ancho del visor del producto', width: 420 });
        this.renderTabs();
        this.filterBar();
        stockView.renderDetail(null);
        this.renderHeader();
        stock.lsStock();
        stock.lsKpis();
    }

    renderHeader() {
        stockView.renderHeader({
            title:     'Visor de Stock',
            titleHtml: invTitleHtml('Visor de Stock', this.dataInit.branch),
            subtitle:  this.rangoConsultado()
        });
    }

    // Las existencias de hoy y los movimientos (Últ. Mov y el filtro) de los últimos N días.
    rangoConsultado() {
        const dias = Number(this.dataInit.movimientoDias) || 30;
        const fin  = moment();
        const ini  = moment().subtract(dias, 'days');

        return `Existencias al ${fin.format('DD/MM/YYYY')} · Movimientos del ${ini.format('DD/MM/YYYY')} al ${fin.format('DD/MM/YYYY')} (últimos ${dias} días)`;
    }

    renderTabs() {
        this.tabLayout({
            parent:          'tabsRow',
            id:              'tabsStock',
            type:            'button',
            theme:           'light',
            renderContainer: false,
            json: [
                { id: 'stock',   tab: 'Stock actual', active: true },
                { id: 'lots',    tab: this.dataInit.lots ? `Por caducar (${this.dataInit.lots})` : 'Por caducar' },
                { id: 'ajustes', tab: 'Conteos físicos' }
            ],
            onChange: (tabId) => this.onChangeTab(tabId)
        });
    }

    // Cada pestaña enseña sus filtros y su tabla; la primera vez que se abre, se pinta.
    onChangeTab(tabId) {
        const isStock = tabId === 'stock';

        if (!isStock && this.selectedId) this.selectProduct(null);

        $('#filterBar, #kpisRow, #tableWrap').toggleClass('hidden', !isStock);
        $('#detailResizer').css('display', isStock ? '' : 'none');
        $('#filterBarLots, #containerLots').toggleClass('hidden', tabId !== 'lots');
        $('#filterBarAjustes, #containerAjustes').toggleClass('hidden', tabId !== 'ajustes');

        if (tabId === 'lots') {
            if (this.lotsReady) return lots.lsLots();

            this.lotsReady = true;
            return lots.render();
        }

        if (tabId === 'ajustes') {
            if (this.ajustesReady) return ajustes.lsAjustes();

            this.ajustesReady = true;
            ajustes.render();
        }
    }

    layout() {
        const mainPanel = {
            type:  'div',
            id:    'mainPanel',
            class: 'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 w-full',
            children: [
                { id: 'headerRow',     class: 'px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0' },
                { id: 'filterBar',     class: 'px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0' },
                { id: 'kpisRow',       class: 'px-3 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0' },
                { id: 'tableWrap',     class: 'p-3 flex-1 min-h-0 overflow-auto bg-white' },
                { id: 'filterBarLots', class: 'hidden px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0' },
                { id: 'containerLots', class: 'hidden p-3 flex-1 min-h-0 overflow-auto bg-white' },
                { id: 'filterBarAjustes', class: 'hidden px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0' },
                { id: 'containerAjustes', class: 'hidden p-3 flex-1 min-h-0 overflow-auto bg-white' }
            ]
        };

        // En escritorio el tirador y el visor arrancan ocultos (md:!hidden); en
        // celular el visor es un cajón que entra deslizándose (openDetailDrawer).
        const detailResizer = {
            type:  'div',
            id:    'detailResizer',
            class: "hidden md:block md:!hidden relative z-[5] flex-shrink-0 w-[6px] -mx-[3px] cursor-col-resize touch-none after:content-[''] after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] after:-translate-x-1/2 after:rounded-full after:transition-colors hover:after:bg-gray-400"
        };

        const detailPanel = {
            type:  'aside',
            id:    'detailPanel',
            class: 'detail-drawer md:!hidden fixed inset-y-0 right-0 z-50 w-full max-w-md transform translate-x-full transition-transform duration-300 ease-out md:relative md:translate-x-0 md:w-[var(--stock-detail-w,420px)] md:max-w-[60vw] md:transition-none md:z-auto flex-shrink-0 bg-white border-t md:border-t-0 border-gray-200 flex flex-col overflow-hidden shadow-2xl md:shadow-none',
            children: [
                { id: 'emptyDetail',   class: 'flex-1 flex flex-col items-center justify-center text-center px-6' },
                { id: 'detailContent', class: 'hidden flex-1 flex flex-col overflow-hidden' }
            ]
        };

        const backdrop = { type: 'div', id: 'detailBackdrop', class: 'detail-backdrop hidden fixed inset-0 bg-black/40 z-40 md:hidden' };

        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'cs-visor flex-1 min-h-0 w-full flex flex-row overflow-hidden relative bg-white rounded-lg border border-gray-200',
                container: [mainPanel, detailResizer, detailPanel, backdrop]
            }
        });

        this.createLayout({
            parent: 'headerRow',
            design: false,
            data: {
                id:        'headerRowWrap',
                class:     'flex items-center justify-between gap-3',
                container: [
                    { type: 'div', id: 'viewHeader', class: 'flex-1 min-w-0' },
                    { type: 'div', id: 'tabsRow',    class: 'flex-shrink-0' }
                ]
            }
        });

        $('#detailBackdrop').off('click').on('click', () => this.selectProduct(null));
    }

    openDetailDrawer() {
        $('#detailPanel').removeClass('translate-x-full');
        $('#detailPanel, #detailResizer').removeClass('md:!hidden');
        $('#detailBackdrop').removeClass('hidden');
    }

    closeDetailDrawer() {
        $('#detailPanel').addClass('translate-x-full');
        $('#detailPanel, #detailResizer').addClass('md:!hidden');
        $('#detailBackdrop').addClass('hidden');
    }

    // «Conteo físico» con la casilla editar de Stock (abrir y capturar un conteo).
    filterBar() {
        const data = [
            { opc: 'select', id: 'branch_id', lbl: 'Sucursal:', class: 'col-12 col-md-3 col-lg-2', data: this.dataInit.sucursales || [] },
            {
                opc: 'select', id: 'fArea', lbl: 'Área:', class: 'col-12 col-md-3 col-lg-3', onchange: 'app.onChangeFilters()', value: '',
                data: [{ id: '', valor: 'Todas las áreas' }].concat(this.dataInit.areas || [])
            },
            {
                opc: 'select', id: 'fCategoria', lbl: 'Categoría:', class: 'col-12 col-md-3 col-lg-3', onchange: 'app.onChangeFilters()', value: '',
                data: [{ id: '', valor: 'Todas las categorías' }].concat(this.dataInit.categorias || [])
            },
            { opc: 'select', id: 'fMovimiento', lbl: 'Movimientos:', class: 'col-12 col-md-3 col-lg-2', onchange: 'app.onChangeFilters()', value: '', data: MOVIMIENTOS_STOCK }
        ];

        if (can('editar')) {
            data.push({ opc: 'button', id: 'btnConteoFisico', text: 'Conteo físico', class: 'col-12 col-md-3 col-lg-2', onClick: () => stockCount.addConteo() });
        }

        this.createfilterBar({
            parent:     'filterBar',
            id:         'filterFormStock',
            coffeesoft: true,
            theme:      'light',
            data
        });

        // La sucursal es la de la barra de arriba.
        $('#branch_id').val(String(this.subId)).prop('disabled', true);
    }

    getFilters() {
        return {
            categoria:  $('#fCategoria').val() || '',
            area:       $('#fArea').val() || '',
            nivel:      this.nivel,
            movimiento: $('#fMovimiento').val() || ''
        };
    }

    async onChangeFilters() {
        stock.lsStock();
        await stock.lsKpis();

        if (this.selectedId) this.selectProduct(null);
    }

    // Clic en una tarjeta = filtra por ese nivel; otro clic lo quita.
    filterByKpi(kpi) {
        const rel = (kpi && kpi.rel) || '';
        this.nivel = this.nivel === rel ? '' : rel;
        this.onChangeFilters();
    }

    selectProduct(productId) {
        this.selectedId = productId;

        const $rows = $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');

        if (productId) {
            $rows.filter(function () {
                return $(this).find(`[onclick*="selectProduct(${productId})"]`).length > 0;
            }).addClass('row-active');
            this.openDetailDrawer();
            stock.getProducto(productId);
        } else {
            this.closeDetailDrawer();
            stockView.renderDetail(null);
        }
    }
}

class Stock extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSStock';
    }

    filterData(opc) {
        const f = app.getFilters();
        return { opc, category_id: f.categoria, area_id: f.area, nivel: f.nivel, movimiento: f.movimiento };
    }

    // Columnas: Producto, Stock, Mín, Máx, Unidad, Estado, Últ. Mov
    async lsStock() {
        const r    = await useFetch({ url: apiStock, data: this.filterData('lsStock') });
        const data = (r && r.status === 200) ? { row: r.row } : { row: [] };

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'light',
            center:       [2, 3, 4, 5, 6, 7],
            actionsAlign: 'left',
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       12,
            emptyMessage: 'No se encontraron productos con los filtros aplicados',
            emptyIcon:    'icon-cube',
            data
        });

        if (window.lucide) lucide.createIcons();

        if ((data.row || []).length > 0 && typeof simple_data_table === 'function') simple_data_table(`#tb${this.PROJECT_NAME}`, 15);

        if (app.selectedId) {
            $(`#tb${this.PROJECT_NAME} tbody tr`).filter(function () {
                return $(this).find(`[onclick*="selectProduct(${app.selectedId})"]`).length > 0;
            }).addClass('row-active');
        }
    }

    async lsKpis() {
        const f = app.getFilters();
        const r = await useFetch({ url: apiStock, data: this.filterData('showStock') });
        const c = (r && r.status === 200) ? r.counts : {};

        const kpis = [
            { id: 'kpiTotal',   label: 'Total Productos', value: parseInt(c.total_productos || 0, 10), tone: 'default', icon: 'package',        rel: '' },
            { id: 'kpiOk',      label: 'Stock OK',        value: parseInt(c.total_ok || 0, 10),        tone: 'success', icon: 'check-circle-2', rel: 'ok' },
            { id: 'kpiBajo',    label: 'Stock Bajo',      value: parseInt(c.total_bajo || 0, 10),      tone: 'warning', icon: 'alert-triangle', rel: 'bajo' },
            { id: 'kpiAgotado', label: 'Agotado',         value: parseInt(c.total_agotado || 0, 10),   tone: 'danger',  icon: 'x-circle',       rel: 'agotado' }
        ];

        const match = kpis.find((k) => k.rel === f.nivel);

        stockView.renderInfoCards(kpis, match ? match.id : null);
    }

    async getProducto(id) {
        const r = await useFetch({ url: apiStock, data: { opc: 'getProducto', id } });

        if (r && r.status === 200) {
            stockView.renderDetail(r.producto, r.sucursales || []);
            stockPrediction.render(id);
        } else {
            stockView.renderDetail(null);
            if (r && r.message) this.alertBox({ type: 'error', title: r.message });
        }
    }

    // -- «Abrir ficha» --
    // La ficha del producto (Catálogo de venta) o del insumo (Catálogo de
    // insumos) con solo su sección Inventario para cambiar: lo de arriba se
    // ve y no se toca. Pide la casilla editar del Catálogo de insumos.

    // La ficha compartida (components/ficha-inventario.js), la misma del Catálogo de insumos › Productos.
    ficha(id) {
        this.invFicha({
            url: apiStock,
            id,
            // Si le quitaron el inventario ya no está en Stock: el visor se cierra sin aviso.
            onSaved: async () => {
                this.lsStock();
                this.lsKpis();

                const r = await useFetch({ url: apiStock, data: { opc: 'getProducto', id } });

                if (r && r.status === 200) stockView.renderDetail(r.producto, r.sucursales || []);
                else app.selectProduct(null);
            }
        });
    }
}

// -- Por caducar --

class Lots extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Lots';
    }

    render() {
        this.createfilterBar({
            parent:     'filterBarLots',
            coffeesoft: true,
            theme:      'light',
            data: [{
                opc: 'select', id: 'fDias', lbl: 'Vencen en:', class: 'col-12 col-md-4 col-lg-3', onchange: 'lots.lsLots()', value: '7',
                data: [
                    { id: '7',  valor: '7 días o menos' },
                    { id: '15', valor: '15 días o menos' },
                    { id: '30', valor: '30 días o menos' },
                    { id: '',   valor: 'Todos los lotes' }
                ]
            }]
        });

        this.lsLots();
    }

    // Columnas: Producto, Lote, Almacén, Quedan, Caduca, Faltan [, Valor]
    async lsLots() {
        const r    = await useFetch({ url: apiStock, data: { opc: 'lsLots', days: $('#fDias').val() || '' } });
        const data = (r && r.status === 200) ? { row: r.row } : { row: [] };

        this.createCoffeeTable3({
            parent:       'containerLots',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'light',
            center:       [2, 3, 5, 6],
            right:        app.dataInit.costs ? [4, 7] : [4],
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       12,
            emptyMessage: 'Ningún lote vence en ese plazo',
            emptyIcon:    'icon-calendar-1',
            data
        });

        if (window.lucide) lucide.createIcons();

        if ((data.row || []).length > 0 && typeof simple_data_table === 'function') simple_data_table(`#tb${this.PROJECT_NAME}`, 15);
    }
}

class StockView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSStock';
    }

    renderDetail(producto, sucursales = []) {
        this.productDetailPanel({
            parent:       'detailPanel',
            json:         producto,
            sucursalId:   String(app.subId),
            sucursalName: app.dataInit.branch,
            sucursales,
            onClose:      () => app.selectProduct(null),
            onFicha:      (p) => stock.ficha(p.id)
        });
    }

    renderInfoCards(rows, activeId) {
        this.kpisRow({
            parent:        'kpisRow',
            json:          rows,
            cols:          4,
            activeId,
            cardClass:     'bg-white rounded-lg border border-gray-200 px-2.5 py-1.5 cursor-pointer hover:shadow-md transition-shadow',
            labelClass:    'text-[9px] uppercase tracking-wider font-bold text-gray-500 whitespace-nowrap truncate text-left',
            valueClass:    'text-sm font-bold text-right leading-tight',
            iconWrapClass: 'w-5 h-5 rounded flex items-center justify-center flex-shrink-0',
            iconClass:     'w-3 h-3',
            onClick:       (kpi) => app.filterByKpi(kpi)
        });
    }

    renderHeader(data) {
        this.viewHeader({ parent: 'viewHeader', json: data });
    }

    // -- Vista del producto (la de inventory) --

    productDetailPanel(options) {
        const defaults = {
            parent:       'root',
            id:           'productDetailPanel',
            class:        'w-full h-full flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden',
            json:         null,
            sucursalId:   '',
            sucursalName: '',
            sucursales:   [],
            labels: {
                emptyTitle:  'Selecciona un producto',
                emptyHint:   'Haz click en la foto o en el ojo para ver el detalle aquí.',
                comportLbl:  'Comportamiento e historial',
                existencias: 'Existencias por sucursal',
                almacenes:   'Almacenes de la sucursal',
                historial:   'Historial de movimientos',
                stock:       'Stock',
                min:         'Mín',
                max:         'Máx',
                vidaUtilLbl: 'Caducidad'
            },
            statusMap: {
                ok:      { palette: 'emerald', icon: 'check-circle-2', label: 'Stock OK',   stockColor: 'text-emerald-600' },
                bajo:    { palette: 'orange',  icon: 'alert-triangle', label: 'Stock Bajo', stockColor: 'text-orange-600' },
                agotado: { palette: 'rose',    icon: 'x-circle',       label: 'Agotado',    stockColor: 'text-rose-600' }
            },
            statusPalettes: {
                emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
                orange:  { bg: 'bg-orange-50',  border: 'border-orange-200',  text: 'text-orange-700' },
                rose:    { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700' }
            },
            vidaMap: {
                critico: { palette: 'rose',    icon: 'alert-octagon', label: 'Crítica',   msg: 'Caducidad inminente, prioriza la rotación.' },
                proximo: { palette: 'amber',   icon: 'clock',         label: 'Próxima',   msg: 'Cercano a su fecha de caducidad.' },
                ok:      { palette: 'emerald', icon: 'leaf',          label: 'Saludable', msg: 'El lote que vence primero está en rango.' },
                na:      { palette: 'slate',   icon: 'minus',         label: 'No aplica', msg: 'Sin lotes con caducidad.' }
            },
            vidaPalettes: {
                rose:    { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700' },
                amber:   { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700' },
                emerald: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
                slate:   { bg: 'bg-slate-50',   border: 'border-slate-200',   text: 'text-slate-600' }
            },
            movMap: {
                in:     { bg: 'bg-green-100',  iconColor: 'text-green-600',  icon: 'arrow-down', qtyColor: 'text-green-600' },
                out:    { bg: 'bg-red-100',    iconColor: 'text-red-600',    icon: 'arrow-up',   qtyColor: 'text-red-600' },
                tr:     { bg: 'bg-purple-100', iconColor: 'text-purple-600', icon: 'repeat',     qtyColor: 'text-purple-600' },
                adjust: { bg: 'bg-orange-100', iconColor: 'text-orange-600', icon: 'settings-2', qtyColor: 'text-orange-600' }
            },
            movFilter: {
                btn:         'px-2 py-0.5 rounded text-[10px] font-medium text-gray-500 whitespace-nowrap hover:bg-gray-100 transition-colors',
                btnActive:   'px-2 py-0.5 rounded text-[10px] font-bold text-white whitespace-nowrap transition-colors',
                activeStyle: 'background:rgb(var(--brand-600, 192 90 64));'
            },
            onClose: () => {},
            onFicha: () => {}
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.labels = Object.assign({}, defaults.labels, o.labels || {});

        const esc   = invEsc;
        const aside = $('<aside>', { id: opts.id, class: opts.class });

        if (!opts.json) {
            aside.html(`
                <div class="px-4 py-3 border-b border-gray-200 flex-shrink-0 flex items-center justify-between">
                    <div>
                        <h3 class="text-sm font-bold text-gray-800">Vista del Producto</h3>
                        <p class="text-[10px] text-gray-500">${esc(opts.labels.comportLbl)}</p>
                    </div>
                </div>
                <div class="flex-1 flex flex-col items-center justify-center text-center px-6">
                    <div class="w-14 h-14 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center mb-3">
                        <i data-lucide="package-search" class="w-6 h-6 text-gray-500"></i>
                    </div>
                    <p class="text-[11px] text-gray-500">${esc(opts.labels.emptyTitle)}</p>
                    <p class="text-[10px] text-gray-500 mt-1 max-w-[220px]">${esc(opts.labels.emptyHint)}</p>
                </div>
            `);
            $(`#${opts.parent}`).html(aside);
            if (window.lucide) lucide.createIcons();
            return;
        }

        const p             = opts.json;
        const stockSuc      = p.stockSuc || {};
        const stockVal      = Number(stockSuc[opts.sucursalId] || 0);
        const status        = opts.statusMap[p.estado] || opts.statusMap.ok;
        const statusPalette = opts.statusPalettes[status.palette];
        const vida          = p.vida || {};
        const vidaCfg       = opts.vidaMap[vida.label || 'na'];
        const vidaPalette   = opts.vidaPalettes[vidaCfg.palette];
        const tieneVida     = vida.label && vida.label !== 'na';
        const vidaText      = vida.dias == null ? '' : (vida.dias < 0 ? `venció hace ${Math.abs(vida.dias)} días` : `${vida.dias} días restantes`);
        const stockColor    = (q) => q <= 0 ? 'text-red-600' : (p.min > 0 && q <= p.min ? 'text-orange-600' : 'text-green-600');

        const branchListHtml = (opts.sucursales || []).map((s) => {
            const q      = Number(stockSuc[s.id] || 0);
            const active = opts.sucursalId === s.id ? 'border-violet-400 bg-violet-50' : 'border-gray-200 bg-gray-50';

            return `
                <div class="flex items-center justify-between rounded-md px-2.5 py-1.5 border ${active}">
                    <div class="flex items-center gap-2">
                        <i data-lucide="store" class="w-5 h-5 ${q <= 0 ? 'text-gray-400' : 'text-violet-500'}"></i>
                        <span class="text-[11px] ${q <= 0 ? 'text-gray-400' : 'text-gray-800'}">${esc(s.name)}</span>
                    </div>
                    <span class="text-[11px] font-bold ${stockColor(q)}">${esc(invQty(q))}</span>
                </div>`;
        }).join('');

        const almacenesHtml = (p.almacenes || []).map((a) => `
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" style="background:rgb(var(--brand-600, 192 90 64) /0.15);color:rgb(var(--brand-600, 192 90 64));">
                <i data-lucide="warehouse" class="w-2.5 h-2.5 mr-1 inline"></i>${esc(a.name)} · ${esc(invQty(a.qty))}
            </span>`).join('') || '<span class="text-[10px] text-gray-400 italic">Sin existencia en los almacenes de la sucursal</span>';

        const movsAll = p.movs || [];

        const movItemHtml = (m) => {
            const cfg = opts.movMap[m.type] || opts.movMap.adjust;

            return `
                <div class="flex items-start gap-2 bg-gray-50 rounded-md px-2.5 py-1.5 border border-gray-200">
                    <div class="w-5 h-5 rounded ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5">
                        <i data-lucide="${cfg.icon}" class="w-2.5 h-2.5 ${cfg.iconColor}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between">
                            <p class="text-[10px] font-medium text-gray-800">${esc(m.label)}</p>
                            <span class="text-[10px] font-bold ${m.dir === 'out' ? 'text-red-600' : cfg.qtyColor}">${esc(m.qty)}</span>
                        </div>
                        <p class="text-[9px] text-gray-500">${esc(m.when)}</p>
                        ${m.branch ? `<p class="text-[9px] text-gray-500 mt-0.5 flex items-center gap-1"><i data-lucide="store" class="w-2.5 h-2.5 text-violet-500"></i><span>${esc(m.branch)}</span></p>` : ''}
                        <p class="text-[9px] text-gray-500 mt-0.5 flex items-center gap-1">
                            <span>Antes: <strong class="text-gray-700">${esc(m.prev)}</strong></span>
                            <i data-lucide="arrow-right" class="w-2.5 h-2.5 text-gray-400"></i>
                            <span>Quedó: <strong class="text-gray-700">${esc(m.post)}</strong></span>
                        </p>
                    </div>
                </div>`;
        };

        const renderMovs = (filter) => {
            const list = filter === 'todos' ? movsAll : movsAll.filter((m) => m.dir === filter);
            return list.slice(0, 10).map(movItemHtml).join('') || '<p class="text-[10px] text-gray-500 italic">Sin movimientos</p>';
        };

        aside.html(`
            <div class="px-4 py-3 border-b border-gray-200 flex-shrink-0 flex items-center justify-between">
                <div>
                    <h3 class="text-sm font-bold text-gray-800">Vista del Producto</h3>
                    <p class="text-[10px] text-gray-500">Existencias en ${esc(opts.sucursalName)}</p>
                </div>
                <div class="flex items-center gap-1">
                    ${p.can_ficha ? `<button type="button" id="${opts.id}_ficha" class="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 text-[11px] font-semibold text-gray-700 hover:border-gray-300 hover:text-gray-900 transition-colors"><i data-lucide="pencil" class="w-3.5 h-3.5"></i>Abrir ficha</button>` : ''}
                    <button id="${opts.id}_close" class="text-gray-600 hover:text-gray-800 transition-colors p-1" title="Cerrar"><i data-lucide="x" class="w-4 h-4"></i></button>
                </div>
            </div>

            <div class="flex-1 overflow-y-auto cs-scroll px-4 py-3 space-y-3">
                <div class="bg-gray-50 rounded-lg p-2 border border-gray-200">
                    <div class="flex items-center gap-2">
                        ${p.image ? `
                        <a href="${esc(p.image)}" target="_blank" rel="noopener" title="Ver foto" class="w-12 h-12 rounded-md bg-gray-100 overflow-hidden flex-shrink-0 ring-1 ring-black/5 hover:ring-2 hover:ring-blue-400/60 transition">
                            <img src="${esc(p.image)}" alt="" class="w-full h-full object-cover" onerror="this.remove();">
                        </a>` : `
                        <div class="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0"><i data-lucide="package" class="w-4 h-4"></i></div>`}
                        <div class="flex-1 min-w-0">
                            <p class="text-xs font-bold text-gray-800 truncate leading-tight">${esc(p.name)}</p>
                            <p class="text-[9px] text-gray-500 truncate">SKU: ${esc(p.sku)} · ${esc(p.categoria)}</p>
                        </div>
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${statusPalette.border} ${statusPalette.bg} ${statusPalette.text} text-[10px] font-bold flex-shrink-0">
                            <i data-lucide="${status.icon}" class="w-3 h-3"></i>${esc(status.label)}
                        </span>
                    </div>
                    <div class="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-gray-200">
                        <div class="text-center leading-tight">
                            <p class="text-[8px] text-gray-500 uppercase">${esc(opts.labels.stock)} (${esc(p.unidad)})</p>
                            <p class="text-sm font-bold ${status.stockColor}">${esc(invQty(stockVal))}</p>
                        </div>
                        <div class="text-center leading-tight">
                            <p class="text-[8px] text-gray-500 uppercase">${esc(opts.labels.min)}</p>
                            <p class="text-sm font-bold text-gray-800">${Number(p.min) > 0 ? esc(invQty(p.min)) : '-'}</p>
                        </div>
                        <div class="text-center leading-tight">
                            <p class="text-[8px] text-gray-500 uppercase">${esc(opts.labels.max)}</p>
                            <p class="text-sm font-bold text-gray-800">${Number(p.max) > 0 ? esc(invQty(p.max)) : '-'}</p>
                        </div>
                    </div>
                </div>

                ${tieneVida ? `
                <div class="rounded-lg border ${vidaPalette.border} ${vidaPalette.bg} px-3 py-2 flex items-start gap-2">
                    <i data-lucide="${vidaCfg.icon}" class="w-4 h-4 ${vidaPalette.text} flex-shrink-0 mt-0.5"></i>
                    <div class="flex-1 min-w-0">
                        <strong class="block text-xs ${vidaPalette.text}">${esc(opts.labels.vidaUtilLbl)}: ${esc(vidaCfg.label)} · ${esc(vidaText)}</strong>
                        <p class="text-[10px] text-gray-400">${esc(vidaCfg.msg)}${vida.fecha ? ' Vence el ' + esc(moment(vida.fecha).format('DD/MM/YYYY')) + '.' : ''}</p>
                    </div>
                </div>` : ''}

                <div id="aiPrediction"></div>

                <div>
                    <div class="flex items-center justify-between mb-1.5">
                        <h4 class="text-xs font-semibold uppercase tracking-wider text-gray-500 leading-tight">${esc(opts.labels.existencias)}</h4>
                        <span class="text-[9px] text-gray-500">Total: ${esc(invQty(stockSuc[''] || 0))}</span>
                    </div>
                    <div class="space-y-1.5">${branchListHtml}</div>
                </div>

                <div>
                    <h4 class="text-xs font-semibold uppercase tracking-wider text-gray-500 leading-tight mb-1.5">${esc(opts.labels.almacenes)}</h4>
                    <div class="flex flex-wrap gap-1.5">${almacenesHtml}</div>
                </div>

                <div>
                    <div class="flex items-center justify-between mb-2 gap-2">
                        <h4 class="text-xs font-semibold uppercase tracking-wider text-gray-500 leading-tight">${esc(opts.labels.historial)}</h4>
                        <div class="flex items-center gap-1 flex-shrink-0" id="${opts.id}_movFilters">
                            <button type="button" data-mov-filter="todos" class="${opts.movFilter.btnActive}" style="${opts.movFilter.activeStyle}">Todos</button>
                            <button type="button" data-mov-filter="in" class="${opts.movFilter.btn}">+ Entradas</button>
                            <button type="button" data-mov-filter="out" class="${opts.movFilter.btn}">- Salidas</button>
                        </div>
                    </div>
                    <div class="space-y-1.5" id="${opts.id}_movsList">${renderMovs('todos')}</div>
                </div>
            </div>
        `);

        $(`#${opts.parent}`).html(aside);
        if (window.lucide) lucide.createIcons();

        $(`#${opts.id}_close`).on('click', () => opts.onClose(p));
        $(`#${opts.id}_ficha`).on('click', () => opts.onFicha(p));

        const $filters = $(`#${opts.id}_movFilters`);

        $filters.on('click', '[data-mov-filter]', function () {
            const filter = $(this).attr('data-mov-filter');

            $filters.find('[data-mov-filter]').each(function () {
                const active = $(this).attr('data-mov-filter') === filter;
                this.className = active ? opts.movFilter.btnActive : opts.movFilter.btn;
                this.setAttribute('style', active ? opts.movFilter.activeStyle : '');
            });

            $(`#${opts.id}_movsList`).html(renderMovs(filter));
            if (window.lucide) lucide.createIcons();
        });
    }

    // -- Hoja del conteo físico (la de inventory) --
    // Pestañas por área arriba, la tabla con lo contado al centro y el resumen
    // con los botones abajo. Devuelve { el, close, setSummary }.

    countModal(options) {
        const defaults = {
            id:       'mdlConteo',
            title:    'Conteo físico',
            subtitle: '',
            badge:    '',
            info:     { tone: 'gray', text: '' },
            blind:    { checked: false, disabled: false },
            actions:  [],
            onBlind:  () => {},
            onSearch: () => {},
            onClose:  () => {}
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.info  = Object.assign({}, defaults.info, o.info || {});
        opts.blind = Object.assign({}, defaults.blind, o.blind || {});

        const esc = invEsc;

        const infoTone = {
            gray:    { cls: 'text-gray-500', icon: 'info' },
            blue:    { cls: 'text-blue-600 font-medium', icon: 'pencil-line' },
            emerald: { cls: 'text-emerald-700', icon: 'check-circle-2' }
        }[opts.info.tone] || { cls: 'text-gray-500', icon: 'info' };

        const btnKind = {
            primary:   'h-9 px-[12px] rounded-md bg-main hover:bg-main-hover text-[12px] font-semibold text-white inline-flex items-center gap-1.5',
            secondary: 'h-9 px-[12px] rounded-md border-[1px] border-gray-300 bg-white text-[12px] font-semibold text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5',
            ghost:     'h-9 px-[12px] rounded-md text-[12px] font-medium text-gray-500 hover:text-rose-600 hover:bg-white inline-flex items-center gap-1.5'
        };

        const actionsHtml = opts.actions.map((a) => `
            <button type="button" id="${esc(a.id)}" class="${btnKind[a.kind] || btnKind.secondary}">
                ${a.icon ? `<i data-lucide="${esc(a.icon)}" class="w-4 h-4"></i>` : ''}${esc(a.text)}
            </button>`).join('');

        const modal = $('<div>', { id: opts.id, class: 'fixed inset-0 z-[1050] bg-black/40 flex items-center justify-center p-[12px]' });

        modal.html(`
            <div class="bg-white rounded-xl shadow-2xl w-[1024px] max-w-full h-[88vh] flex flex-col overflow-hidden">
                <div class="flex items-start justify-between gap-3 px-[20px] py-[16px] border-b border-gray-200">
                    <div>
                        <h2 class="text-base font-bold text-gray-800 flex items-center gap-2">
                            <i data-lucide="clipboard-check" class="w-5 h-5 text-blue-600"></i>${esc(opts.title)}${opts.badge}
                        </h2>
                        <p class="text-[11px] text-gray-500 mt-0.5">${esc(opts.subtitle)}</p>
                    </div>
                    <button type="button" data-count-close class="p-1 text-gray-500 hover:text-gray-800"><i data-lucide="x" class="w-5 h-5"></i></button>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-3 px-[20px] py-[10px] border-b border-gray-200">
                    <div id="${opts.id}Tabs" class="min-w-0 max-w-full"></div>
                    <div class="flex flex-wrap items-center gap-3">
                        <div class="relative">
                            <i data-lucide="search" class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                            <input id="${opts.id}Search" type="text" autocomplete="off" placeholder="Buscar producto o SKU"
                                style="font-size:11px !important;height:32px !important;"
                                class="w-[220px] pl-8 pr-2 rounded-md border-[1px] border-gray-300 bg-white text-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none">
                        </div>
                        <label class="inline-flex items-center gap-2 text-[11px] ${opts.blind.disabled ? 'text-gray-400 cursor-not-allowed' : 'text-gray-600 cursor-pointer'} select-none mb-0">
                            <input id="${opts.id}Blind" type="checkbox" class="w-3.5 h-3.5 accent-blue-600" ${opts.blind.checked ? 'checked' : ''} ${opts.blind.disabled ? 'disabled' : ''}>
                            Conteo ciego <span class="text-gray-400">(oculta lo que dice el sistema)</span>
                        </label>
                    </div>
                </div>

                <div class="px-[20px] py-2 text-[10px] flex items-center gap-1.5 ${infoTone.cls}">
                    <i data-lucide="${infoTone.icon}" class="w-3 h-3 flex-shrink-0"></i>${esc(opts.info.text)}
                </div>

                <div id="${opts.id}Table" class="flex-1 min-h-0 overflow-auto px-[20px]"></div>

                <div class="flex flex-wrap items-center justify-between gap-3 px-[20px] py-[12px] border-t border-gray-200 bg-gray-50">
                    <div id="${opts.id}Summary" class="flex flex-wrap items-center gap-4 text-[10px] text-gray-600"></div>
                    <div class="flex items-center gap-2">${actionsHtml}</div>
                </div>
            </div>
        `);

        $(`#${opts.id}`).remove();
        $('body').append(modal);
        if (window.lucide) lucide.createIcons();

        const close = () => {
            $(document).off('keydown.countModal');
            modal.remove();
            opts.onClose();
        };

        modal.on('click', '[data-count-close]', close);
        modal.on('change', `#${opts.id}Blind`, () => opts.onBlind());
        modal.on('input', `#${opts.id}Search`, (e) => opts.onSearch($(e.currentTarget).val()));
        opts.actions.forEach((a) => modal.on('click', `#${a.id}`, () => a.onClick()));
        $(document).on('keydown.countModal', (e) => { if (e.key === 'Escape' && !$('[id^="alertBox_"]').length) close(); });

        const setSummary = (s) => {
            const pendientes = s.total - s.counted;
            const net        = Number(s.net || 0);

            $(`#${opts.id}Summary`).html(`
                <span><b class="text-gray-900">${s.counted}</b> de ${s.total} contados</span>
                <span class="${pendientes > 0 ? 'text-gray-500' : 'text-emerald-700'}">${pendientes} pendientes</span>
                ${s.blind ? '<span class="text-gray-400">Diferencias ocultas (conteo ciego)</span>' : `
                <span><b class="text-gray-900">${s.differences}</b> con diferencia</span>
                ${app.dataInit.costs ? `<span>Ajuste neto: <b class="${net < 0 ? 'text-rose-600' : 'text-sky-700'}">${net < 0 ? '-' : '+'}${invMoney(Math.abs(net))}</b></span>` : ''}`}
            `);
        };

        return { el: modal, close, setSummary };
    }

    // -- Tarjeta del pronóstico (la «Predicción IA» de inventory) --
    // La curva de 7 días hacia atrás y la proyección de 7 días hacia adelante
    // se dibujan siempre (son datos reales); el texto de CoffeeIA, si contestó.

    aiPredictionCard(options) {
        const defaults = {
            parent:          'aiPrediction',
            id:              'aiPredictionCard',
            state:           'loading',
            iaOk:            true,
            iaMsg:           '',
            dias:            0,
            reorden:         0,
            resumen:         '',
            tendencia:       [],
            tendenciaDelta:  null,
            proyeccion:      [],
            stockActual:     0,
            stockMin:        0,
            historicoColor:  '#94A3B8',
            proyeccionColor: '#475569',
            minLineColor:    '#CBD5E1',
            errorMsg:        'No se pudo obtener el pronóstico.',
            accentColor:     '#475569',
            accentBg:        'bg-slate-50',
            accentBorder:    'border-slate-200',
            accentText:      'text-slate-800',
            accentSubtext:   'text-slate-600'
        };

        const opts = Object.assign({}, defaults, options || {});
        const esc  = invEsc;
        let inner  = '';

        if (opts.state === 'loading') {
            inner = `
                <div class="flex items-center gap-2 py-1">
                    <svg class="animate-spin w-4 h-4 flex-shrink-0" style="color:${opts.accentColor};" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                    </svg>
                    <span class="text-[11px] ${opts.accentSubtext}">Analizando lo que sale...</span>
                </div>`;
        } else if (opts.state === 'error') {
            inner = `
                <div class="flex items-center gap-2">
                    <i data-lucide="alert-circle" class="w-4 h-4 flex-shrink-0 ${opts.accentSubtext}"></i>
                    <p class="text-[11px] ${opts.accentSubtext}">${esc(opts.errorMsg)}</p>
                </div>`;
        } else if (opts.iaOk) {
            inner = `
                <p class="text-[11px] ${opts.accentText} leading-relaxed">
                    Al ritmo actual, el stock se agotará en ~<strong class="font-bold" style="color:${opts.accentColor};">${esc(opts.dias)} días</strong>.
                    Sugerimos pedir <strong class="font-bold" style="color:${opts.accentColor};">${esc(opts.reorden)}</strong>.
                </p>
                ${opts.resumen ? `<p class="text-[10px] ${opts.accentSubtext} mt-1 leading-relaxed">${esc(opts.resumen)}</p>` : ''}`;
        } else {
            const days = opts.dias === null || opts.dias === undefined ? '' : ` Con lo que sale en promedio alcanza para ~<b>${esc(opts.dias)} días</b>.`;

            inner = `
                <p class="text-[11px] ${opts.accentSubtext} leading-relaxed flex items-start gap-1.5">
                    <i data-lucide="info" class="w-3.5 h-3.5 flex-shrink-0 mt-0.5"></i>
                    <span>${esc(opts.iaMsg || 'CoffeeIA no contestó.')}${days}</span>
                </p>`;
        }

        let chartHtml = '';

        if (opts.state === 'ready' && Array.isArray(opts.tendencia) && opts.tendencia.length) {
            const d = opts.tendenciaDelta;
            const deltaHtml = d === null || d === undefined
                ? '<span class="text-[9px] text-gray-400">Sin semana anterior</span>'
                : `<span class="text-[9px] font-bold ${d >= 0 ? 'text-emerald-600' : 'text-rose-600'}">${d >= 0 ? '+' : ''}${esc(d)}% vs semana anterior</span>`;

            // La curva de stock retrocediendo desde hoy: ayer = hoy - (entró - salió).
            const serie = [];
            let stockRev = Number(opts.stockActual) || 0;

            for (let i = opts.tendencia.length - 1; i >= 0; i--) {
                const t = opts.tendencia[i];
                serie.push({ dia: t.dia, stock: stockRev });
                stockRev -= (Number(t.entrada) || 0) - (Number(t.salida) || 0);
            }

            const hist   = serie.reverse();
            const proy   = Array.isArray(opts.proyeccion) ? opts.proyeccion : [];
            const sumAll = opts.tendencia.reduce((acc, t) => acc + (Number(t.entrada) || 0) + (Number(t.salida) || 0), 0);
            let bodyHtml;

            if (sumAll <= 0 && proy.length === 0) {
                bodyHtml = `
                    <div class="flex flex-col items-center justify-center h-16 text-center">
                        <i data-lucide="bar-chart-2" class="w-4 h-4 text-gray-300 mb-1"></i>
                        <span class="text-[9px] text-gray-400">Sin movimientos en los últimos 7 días</span>
                    </div>`;
            } else {
                const w = 280, h = 70, padL = 6, padR = 6, padT = 6, padB = 14;
                const innerW = w - padL - padR, innerH = h - padT - padB;
                const all = [...hist.map((p) => p.stock), ...proy.map((p) => Number(p.stock) || 0)];
                let yMin = Math.min(...all), yMax = Math.max(...all);

                if (yMax - yMin < 1) { yMin = Math.max(0, yMax - 1); yMax = yMax + 1; }

                const yPad = (yMax - yMin) * 0.1 || 0.5;
                yMin = Math.max(0, yMin - yPad);
                yMax = yMax + yPad;

                const xStep = innerW / 13;
                const toX = (i) => padL + i * xStep;
                const toY = (v) => padT + (1 - (v - yMin) / (yMax - yMin)) * innerH;

                const histPts = hist.map((p, i) => `${toX(i).toFixed(1)},${toY(p.stock).toFixed(1)}`).join(' ');
                const proyPts = `${toX(6).toFixed(1)},${toY(hist[hist.length - 1].stock).toFixed(1)} ` + proy.map((p, j) => `${toX(7 + j).toFixed(1)},${toY(Number(p.stock) || 0).toFixed(1)}`).join(' ');
                const markers = proy.map((p, j) => `<circle cx="${toX(7 + j).toFixed(1)}" cy="${toY(Number(p.stock) || 0).toFixed(1)}" r="2.5" fill="${opts.proyeccionColor}" stroke="white" stroke-width="0.8" />`).join('');

                let minLine = '';
                if (Number(opts.stockMin) > 0 && Number(opts.stockMin) >= yMin && Number(opts.stockMin) <= yMax) {
                    const minY = toY(Number(opts.stockMin));
                    minLine = `<line x1="${padL}" y1="${minY.toFixed(1)}" x2="${(w - padR).toFixed(1)}" y2="${minY.toFixed(1)}" stroke="${opts.minLineColor}" stroke-width="0.8" stroke-dasharray="2,2" />`
                            + `<text x="${(w - padR - 2).toFixed(1)}" y="${(minY - 2).toFixed(1)}" font-size="6" fill="${opts.minLineColor}" text-anchor="end" font-family="ui-sans-serif, system-ui">mín</text>`;
                }

                const xAxisY  = (h - padB + 4).toFixed(1);
                const xLabels = hist.map((p, i) => `<text x="${toX(i).toFixed(1)}" y="${(h - 2).toFixed(1)}" font-size="6" fill="#94A3B8" text-anchor="middle" font-family="ui-sans-serif, system-ui">${esc(i === hist.length - 1 ? 'Hoy' : p.dia)}</text>`).join('')
                              + proy.map((p, j) => `<text x="${toX(7 + j).toFixed(1)}" y="${(h - 2).toFixed(1)}" font-size="6" fill="${opts.proyeccionColor}" text-anchor="middle" font-weight="600" font-family="ui-sans-serif, system-ui">+${esc(p.offset)}</text>`).join('');

                bodyHtml = `
                    <div class="mt-1">
                        <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" class="w-full h-16 block" xmlns="http://www.w3.org/2000/svg">
                            ${minLine}
                            <line x1="${padL}" y1="${xAxisY}" x2="${(w - padR).toFixed(1)}" y2="${xAxisY}" stroke="#E2E8F0" stroke-width="0.6" />
                            <polyline points="${histPts}" fill="none" stroke="${opts.historicoColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                            ${proy.length ? `<polyline points="${proyPts}" fill="none" stroke="${opts.proyeccionColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />` : ''}
                            ${markers}
                            ${xLabels}
                        </svg>
                    </div>`;
            }

            chartHtml = `
                <div class="mt-2.5 pt-2.5 border-t" style="border-color:rgba(148,163,184,0.25);">
                    <div class="flex items-center justify-between mb-1">
                        <span class="text-[9px] font-bold uppercase tracking-wider text-slate-500">Stock · 7 días atrás y 7 adelante</span>
                        ${deltaHtml}
                    </div>
                    ${bodyHtml}
                    <div class="flex items-center gap-3 mt-1.5">
                        <span class="flex items-center gap-1 text-[8px] text-gray-500"><span class="w-2 h-0.5 rounded-full" style="background:${opts.historicoColor};"></span>Lo que pasó</span>
                        <span class="flex items-center gap-1 text-[8px] text-gray-500"><span class="w-2 h-2 rounded-full" style="background:${opts.proyeccionColor};"></span>Si sigue igual</span>
                        ${Number(opts.stockMin) > 0 ? `<span class="flex items-center gap-1 text-[8px] text-gray-500"><span class="w-3 h-0.5" style="border-top:1px dashed ${opts.minLineColor};"></span>Stock mín</span>` : ''}
                    </div>
                </div>`;
        }

        $(`#${opts.parent}`).html(`
            <div id="${opts.id}" class="rounded-lg border ${opts.accentBorder} ${opts.accentBg} px-3 py-2.5">
                <div class="flex items-center gap-2 mb-2">
                    <span class="inline-flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0" style="background:rgba(71,85,105,0.12);">
                        <i data-lucide="lightbulb" class="w-3.5 h-3.5" style="color:${opts.accentColor};"></i>
                    </span>
                    <span class="text-[11px] font-bold ${opts.accentText} uppercase tracking-wide">Pronóstico</span>
                </div>
                ${inner}
                ${chartHtml}
            </div>`);

        if (window.lucide) lucide.createIcons();
    }
}

// -- Pronóstico --

class StockPrediction extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'POSStock';
        this.currentId    = null;
    }

    // Si mientras contesta se abrió otro producto, la respuesta vieja se tira.
    async render(productId) {
        this.currentId = productId;

        if (!$('#aiPrediction').length) return;

        stockView.aiPredictionCard({ state: 'loading' });

        const r = await useFetch({ url: apiStock, data: { opc: 'predict', id: productId } });

        if (this.currentId !== productId || !$('#aiPrediction').length) return;

        if (!r || r.status !== 200) return stockView.aiPredictionCard({ state: 'error', errorMsg: (r && r.message) || 'No se pudo calcular el pronóstico.' });

        stockView.aiPredictionCard({
            state:          'ready',
            iaOk:           r.ia_ok !== false,
            iaMsg:          r.mensaje_ia || '',
            dias:           r.dias_agotamiento,
            reorden:        r.reorden_sugerido,
            resumen:        r.resumen,
            tendencia:      r.tendencia || [],
            tendenciaDelta: r.tendencia_delta === undefined ? null : r.tendencia_delta,
            proyeccion:     r.proyeccion_stock || [],
            stockActual:    r.stock_actual || 0,
            stockMin:       r.stock_min || 0
        });
    }
}

// -- Conteo físico (la hoja) --

class StockCount extends Templates {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'StockCount';
        this.id           = null;
        this.areaId       = '';
        this.q            = '';
        this.counts       = {};
        this.sheet        = [];
        this.perms        = {};
        this.modal        = null;
    }

    // -- Interface --

    async render(id) {
        this.id     = id;
        this.areaId = '';
        this.q      = '';
        this.counts = {};

        const data = await this.getConteo();
        if (!data) return;

        this.modal = stockView.countModal({
            id:       'mdlConteo',
            title:    'Conteo físico',
            subtitle: data.header.subtitle,
            badge:    ` ${data.header.badge}`,
            info:     data.header.info,
            blind: {
                checked:  data.header.is_blind === 1,
                disabled: !data.perms.edit || data.header.blind_locked
            },
            actions:  this.jsonActions(data.perms),
            onBlind:  () => this.toggleBlind(),
            onSearch: (q) => this.filterSheet(q),
            onClose:  () => this.onClose()
        });

        $('#mdlConteoTable').on('input', '[data-count]', (e) => this.onCountChange($(e.currentTarget)));
        $('#mdlConteoTable').on('keydown', '[data-count]', (e) => this.onCountKey(e));

        this.renderTabs(data.areas || []);
        this.paintSheet(data);
    }

    // Enter y la flecha abajo pasan al producto de abajo; la flecha arriba, al de arriba.
    onCountKey(e) {
        const step = { Enter: 1, ArrowDown: 1, ArrowUp: -1 }[e.key];
        if (!step) return;

        e.preventDefault();
        e.stopPropagation();

        const $fields = $('#mdlConteoTable [data-count]:enabled:visible');
        const index   = $fields.index(e.currentTarget) + step;

        if (index >= 0 && index < $fields.length) $fields.eq(index).trigger('focus').trigger('select');
    }

    // «Todas» llega con id vacío; en la pestaña va como 'todas' para que su id del DOM no quede en blanco.
    renderTabs(areas) {
        this.tabLayout({
            parent:          'mdlConteoTabs',
            id:              `tabs${this.PROJECT_NAME}`,
            type:            'short',
            theme:           'light',
            renderContainer: false,
            json:            areas.map((a) => ({ id: a.id || 'todas', tab: `${invEsc(a.valor)} (${a.total})`, active: a.id === this.areaId })),
            onChange: (tabId) => {
                this.areaId = tabId === 'todas' ? '' : tabId;
                this.lsConteo();
            }
        });
    }

    paintSheet(data) {
        this.createCoffeeTable3({
            parent:       'mdlConteoTable',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        'light',
            f_size:       11,
            class:        'w-full table-fixed text-[11px]',
            color_th:     'sticky top-0 z-10 bg-white border-b border-gray-200',
            color_group:  'bg-gray-200 text-gray-700',
            border_table: '',
            border_row:   'border-b border-gray-100',
            center:       [3, 5],
            right:        [4, 6, 7],
            emptyMessage: 'No hay productos en esta área',
            emptyIcon:    'icon-cube',
            data:         { thead: data.thead || [], row: data.row || [] }
        });

        // Anchos fijos: las columnas no se mueven al cambiar de área ni al capturar.
        const widths = ['30%', '15%', '9%', '10%', '14%', '10%', '12%'];
        $(`#tb${this.PROJECT_NAME} thead th`).each((i, th) => $(th).css('width', widths[i] || ''));

        this.restoreCounts();
        this.toggleBlind();
        if (!this.areaId && (data.row || []).some((r) => r.colgroup)) this.groupToggles();
        this.filterSheet(this.q);

        if (this.perms.edit) $(`#tb${this.PROJECT_NAME} [data-count]:enabled:visible`).first().trigger('focus');
    }

    // El buscador: deja los productos cuyo nombre o SKU trae lo escrito (sin acentos) y, en «Todas», sus áreas.
    filterSheet(q) {
        this.q = String(q || '');

        const norm   = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
        const needle = norm(this.q);

        let $group = null, rows = 0, hits = 0;
        const closeGroup = () => { if ($group) $group.css('display', needle && rows && !hits ? 'none' : ''); };

        $(`#tb${this.PROJECT_NAME} tbody tr`).each((i, tr) => {
            const $tr = $(tr);

            if (!$tr.find('[data-count]').length) {
                closeGroup();
                $group = $tr;
                rows = hits = 0;
                return;
            }

            const text  = $tr.children('td').first().find('div div').map((j, el) => $(el).text()).get().join(' ');
            const match = !needle || norm(text).includes(needle);

            rows++;
            if (match) hits++;
            $tr.css('display', !needle ? '' : (match ? 'table-row' : 'none'));
        });

        closeGroup();
    }

    // En «Todas» cada renglón de área contrae o expande sus productos.
    groupToggles() {
        const $groups = $(`#tb${this.PROJECT_NAME} tbody tr`).has('td[colspan]');

        $groups.addClass('cursor-pointer select-none').attr('aria-label', 'Contraer o expandir');
        $groups.find('td').prepend(
            $('<span>', { 'data-group-chevron': '', class: 'inline-flex align-middle mr-1.5 transition-transform' })
                .append($('<i>', { 'data-lucide': 'chevron-down', class: 'w-3.5 h-3.5' }))
        );
        if (window.lucide) lucide.createIcons();

        $groups.on('click', (e) => {
            const $group = $(e.currentTarget);
            const closed = !$group.hasClass('is-collapsed');

            $group.toggleClass('is-collapsed', closed).find('[data-group-chevron]').toggleClass('-rotate-90', closed);
            $group.nextUntil($groups).toggleClass('hidden', closed);
        });
    }

    // -- CRUD --

    async lsConteo() {
        const data = await this.getConteo();
        if (data) this.paintSheet(data);
    }

    async getConteo() {
        const r = await useFetch({ url: apiStock, data: { opc: 'getConteo', id: this.id, area_id: this.areaId } });

        if (!r || r.status !== 200) {
            this.alertBox({ type: 'error', title: invEsc((r && r.message) || 'No se pudo cargar el conteo') });
            return null;
        }

        this.sheet = r.sheet || [];
        this.perms = r.perms || {};
        return r;
    }

    // Nada se crea hasta aceptar. Si el almacén ya tiene un borrador, se retoma ese.
    addConteo() {
        const almacenes = app.dataInit.almacenes || [];

        this.csModal({
            id:         'modalNuevoConteo',
            title:      '¿Abrir un conteo físico?',
            subtitle:   'Se cuenta lo que hay en el almacén y se ajusta el stock',
            lucideIcon: 'clipboard-check',
            width:      'max-w-md',
            saveText:   'Abrir conteo',
            json: [
                {
                    id: 'conteoNota', tipo: 'html', class: 'w-full',
                    html: '<p class="text-sm text-gray-500 mb-0">Si el almacén ya tiene un conteo en borrador, se abre ese para continuar. El stock no cambia hasta que se aplica el ajuste.</p>'
                },
                { id: 'warehouse_id', lbl: 'Almacén', tipo: 'select', empty: false, class: 'w-full', data: almacenes, value: (almacenes[0] || {}).id }
            ],
            onSave: async (values, close) => {
                const r = await useFetch({ url: apiStock, data: { opc: 'addConteo', warehouse_id: values.warehouse_id } });

                if (!r || r.status !== 200) return this.alertBox({ type: 'error', title: invEsc((r && r.message) || 'No se pudo abrir el conteo') });

                close();
                this.render(r.id);
                if (app.ajustesReady) ajustes.lsAjustes();
            }
        });
    }

    async editConteo(silent = false) {
        const r = await useFetch({
            url:  apiStock,
            data: { opc: 'editConteo', id: this.id, counts: JSON.stringify(this.counts), is_blind: $('#mdlConteoBlind').is(':checked') ? 1 : 0 }
        });

        if (!r || r.status !== 200) {
            this.alertBox({ type: 'error', title: invEsc((r && r.message) || 'No se pudo guardar el conteo') });
            return false;
        }

        this.sheet.forEach((s) => {
            if (!Object.prototype.hasOwnProperty.call(this.counts, s.id)) return;
            s.qty = this.counts[s.id] === '' ? null : Number(this.counts[s.id]);
        });
        this.counts = {};

        if (!silent) this.alertBox({ type: 'success', title: invEsc(r.message), timer: 1500 });
        if (app.ajustesReady) ajustes.lsAjustes();
        return true;
    }

    // Guarda lo capturado y aplica el ajuste: cada diferencia se suma al stock.
    async statusConteo() {
        const s       = this.summary();
        const missing = s.total - s.counted;
        const res     = await this.confirm(
            '¿Aplicar el ajuste?',
            `Se ajustarán <b class="text-blue-600">${s.counted} ${s.counted === 1 ? 'producto' : 'productos'}</b>. Cada diferencia se suma al stock actual del almacén y el conteo ya no se podrá editar.${missing ? ` Quedan ${missing} productos sin contar: no se ajustarán.` : ''}`,
            'Aplicar',
            { label: 'Nota:', placeholder: 'Por qué se ajustó (opcional)' }
        );

        if (!res.ok || !(await this.editConteo(true))) return;

        const r = await useFetch({ url: apiStock, data: { opc: 'statusConteo', id: this.id, action: 'aplicar', note: res.note } });

        if (!r || r.status !== 200) return this.alertBox({ type: 'error', title: invEsc((r && r.message) || 'No se pudo aplicar el ajuste') });

        this.alertBox({ type: 'success', title: invEsc(r.message), timer: 1800 });
        this.afterChange(true);
    }

    // Contraseña y motivo, como al cancelar una entrada o una salida.
    async cancelConteo() {
        const applied = !this.perms.edit;

        const ok = await this.invAskPassword({
            url:  apiStock,
            doc:  'adjustment',
            id:   this.id,
            hint: applied ? 'Para cancelar el ajuste escribe tu contraseña.' : 'Para cancelar el conteo escribe tu contraseña.'
        });

        if (!ok) return;

        const reason = await this.invAskReason({
            title:  applied ? '¿Cancelar el ajuste?' : '¿Cancelar el conteo?',
            detail: applied
                ? 'El stock vuelve a como estaba antes de aplicar y el ajuste sale del kárdex.'
                : 'Se descarta lo capturado. El stock no cambia.'
        });

        if (!reason) return;

        const r = await useFetch({ url: apiStock, data: { opc: 'cancelConteo', id: this.id, reason } });

        if (!r || r.status !== 200) return this.alertBox({ type: 'error', title: invEsc((r && r.message) || 'No se pudo cancelar el conteo') });

        this.alertBox({ type: 'success', title: invEsc(r.message), timer: 1500 });
        this.afterChange(false);
    }

    jsonActions(perms) {
        const actions = [{ id: 'btnConteoImprimir', text: 'Imprimir', icon: 'printer', kind: 'ghost', onClick: () => this.printConteo() }];

        if (perms.cancel) actions.push({ id: 'btnConteoCancelar', text: perms.edit ? 'Cancelar conteo' : 'Cancelar ajuste', kind: 'ghost', onClick: () => this.cancelConteo() });
        if (perms.edit)   actions.push({ id: 'btnConteoBorrador', text: 'Guardar borrador', kind: 'secondary', onClick: () => this.editConteo() });
        if (perms.apply)  actions.push({ id: 'btnConteoAplicar', text: 'Aplicar ajuste', icon: 'check', kind: 'primary', onClick: () => this.statusConteo() });

        return actions;
    }

    // El formato del conteo: producto, unidad, sistema (si no es ciego) y lo contado.
    async printConteo() {
        const r = await useFetch({ url: apiStock, data: { opc: 'printConteo', id: this.id, area_id: this.areaId } });

        if (!r || r.status !== 200) return this.alertBox({ type: 'error', title: invEsc((r && r.message) || 'No se pudo preparar el formato de conteo') });

        const esc  = invEsc;
        const h    = r.header;
        const cols = h.blind ? 4 : 5;
        let grupo  = null;

        const rows = (r.items || []).map((it) => {
            const cab = it.area !== grupo ? `<tr class="grp"><td colspan="${cols}">${esc(it.area)}</td></tr>` : '';
            grupo = it.area;

            const local   = Object.prototype.hasOwnProperty.call(this.counts || {}, it.id) ? this.counts[it.id] : null;
            const contado = local !== null && local !== '' ? local : it.counted;

            return `${cab}<tr><td>${esc(it.name)}${it.sku ? ` <span class="sku">${esc(it.sku)}</span>` : ''}</td><td class="c">${esc(it.unit || '-')}</td>${h.blind ? '' : `<td class="c">${esc(it.system)}</td>`}<td class="box">${contado === null || contado === undefined ? '' : esc(contado)}</td><td class="obs"></td></tr>`;
        }).join('');

        const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Conteo físico ${esc(h.folio)}</title>
        <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#c8c8c8;color:#000;padding:24px}.toolbar{width:816px;max-width:100%;margin:0 auto 16px;display:flex;justify-content:flex-end;gap:8px}.btn{cursor:pointer;border:1px solid #000;border-radius:4px;padding:8px 16px;font-size:13px;font-weight:600;color:#fff;background:#333}.btn.gray{background:#777}.sheet{width:816px;max-width:100%;margin:0 auto;background:#fff;padding:40px 48px;box-shadow:0 2px 10px rgba(0,0,0,.25)}.doc-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:14px}.doc-title{font-size:22px;font-weight:800}.folio{font-size:20px;font-weight:800;text-align:right}.meta{font-size:12px;color:#555;margin-top:3px}.firma{display:flex;gap:40px;margin-bottom:14px;font-size:12px}.firma div{flex:1;border-bottom:1px solid #000;padding-bottom:2px;min-height:22px}table{width:100%;border-collapse:collapse}thead th{border-bottom:1.5px solid #000;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:4px 8px;text-align:left}thead th.c{text-align:center}tbody td{padding:5px 8px;font-size:11px;border-bottom:1px solid #ccc}td.c{text-align:center;white-space:nowrap}td.box{width:90px;border-left:1px solid #000;border-right:1px solid #000;text-align:center;font-weight:700;font-size:12px}td.obs{width:130px}tr.grp td{background:#e5e5e5;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.4px}.sku{color:#777;font-size:10px}tr{page-break-inside:avoid}@media print{body{background:#fff;padding:0}.toolbar{display:none}.sheet{width:auto;box-shadow:none;padding:0}thead{display:table-header-group}}</style>
        </head><body>
        <div class="toolbar"><button class="btn" onclick="window.print()">Imprimir</button><button class="btn gray" onclick="window.close()">Cerrar</button></div>
        <div class="sheet">
            <div class="doc-header"><div><div class="doc-title">Formato de conteo físico</div><div class="meta">${esc(h.warehouse)} &middot; ${esc(h.date)}${h.blind ? ' &middot; Conteo ciego' : ''}</div></div><div class="folio">${esc(h.folio)}</div></div>
            <div class="firma"><div>Contó:</div><div>Revisó:</div><div>Fecha y hora:</div></div>
            <table><thead><tr><th>Producto</th><th class="c">Unidad</th>${h.blind ? '' : '<th class="c">Sistema</th>'}<th class="c">Contado</th><th>Observaciones</th></tr></thead><tbody>${rows || `<tr><td colspan="${cols}" class="c">Sin productos</td></tr>`}</tbody></table>
        </div></body></html>`;

        const w = window.open('', '_blank', 'width=900,height=1000');
        if (!w) return this.alertBox({ type: 'warning', title: 'Permite las ventanas emergentes para poder ver el formato.' });

        w.document.write(html);
        w.document.close();
    }

    // -- Complements --

    // Al cerrar con captura sin guardar, se guarda sola como borrador.
    onClose() {
        this.modal = null;
        if (this.perms.edit && Object.keys(this.counts).length) this.editConteo();
    }

    onCountChange($input) {
        this.counts[$input.data('count')] = $input.val();
        this.paintDiff($input);
        this.renderSummary();
    }

    // Lo capturado sin guardar gana sobre lo que trae la base.
    restoreCounts() {
        $(`#tb${this.PROJECT_NAME} [data-count]`).each((_, el) => {
            const id = $(el).data('count');
            if (Object.prototype.hasOwnProperty.call(this.counts, id)) $(el).val(this.counts[id]);
            this.paintDiff($(el));
        });
    }

    paintDiff($input) {
        const id    = $input.data('count');
        const $dif  = $(`#Diferencia_${id}`);
        const $val  = $(`#Valor_${id}`);
        const tones = 'text-rose-600 text-sky-700 text-emerald-600 text-gray-300 font-bold';

        $dif.add($val).removeClass(tones);

        if ($input.val() === '') {
            $dif.text('—').addClass('text-gray-300');
            $val.text('—').addClass('text-gray-300');
            return;
        }

        const dif   = Math.round((Number($input.val()) - Number($input.data('system'))) * 100) / 100;
        const value = Math.abs(dif * Number($input.data('cost')));
        const tone  = dif < 0 ? 'text-rose-600' : 'text-sky-700';

        if (dif === 0) {
            $dif.text('0').addClass('text-emerald-600');
            $val.text('—').addClass('text-gray-300');
            return;
        }

        $dif.text((dif > 0 ? '+' : '') + dif).addClass(`${tone} font-bold`);
        $val.text(value ? (dif < 0 ? '-' : '+') + invMoney(value) : '—').addClass(value ? tone : 'text-gray-300');
    }

    // Oculta los valores sin quitar las columnas, así la hoja no se recorre.
    toggleBlind() {
        const blind = $('#mdlConteoBlind').is(':checked');

        $(`#tb${this.PROJECT_NAME}`).find('td[data-col="4"], td[data-col="6"], td[data-col="7"]').toggleClass('invisible', blind);
        this.renderSummary();
    }

    // Sin área resume todo el almacén (lo que aplica el ajuste); con área, solo esa pestaña.
    summary(areaId = '') {
        let total = 0, counted = 0, differences = 0, net = 0;

        this.sheet.forEach((s) => {
            if (areaId === 'sin' && s.area !== '') return;
            if (areaId && areaId !== 'sin' && s.area !== areaId) return;

            total++;

            const dirty = Object.prototype.hasOwnProperty.call(this.counts, s.id);
            const raw   = dirty ? this.counts[s.id] : s.qty;
            if (raw === '' || raw === null || raw === undefined) return;

            counted++;

            const dif = Math.round((Number(raw) - s.system) * 100) / 100;

            if (dif !== 0) {
                differences++;
                net += dif * s.cost;
            }
        });

        return { total, counted, differences, net, blind: $('#mdlConteoBlind').is(':checked') };
    }

    renderSummary() {
        if (this.modal) this.modal.setSummary(this.summary(this.areaId));
    }

    // Cierra sin autoguardar; al aplicar, el conteo queda marcado como nuevo en la lista.
    afterChange(applied) {
        this.counts = {};
        if (this.modal) this.modal.close();

        stock.lsStock();
        stock.lsKpis();

        if (applied) ajustes.newId = this.id;
        else if (ajustes.newId === this.id) ajustes.newId = null;
        if (app.ajustesReady) ajustes.lsAjustes();
    }

    // Con `note` ({ label, placeholder }) la confirmación lleva un cuadro de texto; resuelve { ok, note }.
    confirm(title, detail, okLabel, note) {
        return new Promise((resolve) => {
            this.alertBox(Object.assign({
                type:       'confirm',
                title,
                detailHtml: detail,
                okLabel,
                onOk:       (value) => resolve({ ok: true, note: value || '' }),
                onCancel:   () => resolve({ ok: false, note: '' })
            }, note ? { input: 'textarea', inputLabel: note.label, inputPlaceholder: note.placeholder } : {}));
        });
    }
}

// -- Conteos físicos (la pestaña) --

class Ajustes extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Ajustes';
        this.newId        = null;
    }

    render() {
        this.filterBar();
        this.lsAjustes();
    }

    filterBar() {
        const data = [{
            opc: 'select', id: 'fEstadoAjuste', lbl: 'Estado:', class: 'col-12 col-md-4 col-lg-2', onchange: 'ajustes.lsAjustes()', value: '', required: false,
            data: app.dataInit.estadosAjuste
        }];

        if (can('editar')) {
            data.push({ opc: 'button', id: 'btnConteoAjustes', text: 'Conteo físico', class: 'col-12 col-md-4 col-lg-2', onClick: () => stockCount.addConteo() });
        }

        this.createfilterBar({ parent: 'filterBarAjustes', id: `filterForm${this.PROJECT_NAME}`, coffeesoft: true, theme: 'light', data });
    }

    // Columnas: Folio, Fecha, Almacén, Estado, Contados, Diferencias, [Ajuste], Registró, Aplicó.
    lsAjustes() {
        $('#containerAjustes').off('draw.dt.lucide').on('draw.dt.lucide', () => { if (window.lucide) lucide.createIcons(); });

        this.createTable({
            parent:      'containerAjustes',
            idFilterBar: 'filterBarAjustes',
            coffeesoft:  true,
            conf:        { datatable: true, pag: 15 },
            data:        { opc: 'lsAjustes', status: $('#fEstadoAjuste').val() || '', new_id: this.newId || '' },
            attr: {
                id:           `tb${this.PROJECT_NAME}`,
                theme:        'light',
                striped:      true,
                f_size:       12,
                center:       [4, 5, 6],
                right:        app.dataInit.costs ? [7] : [],
                emptyMessage: 'Aún no hay conteos en la sucursal',
                emptyIcon:    'icon-clipboard'
            }
        });
    }

    // El comprobante del ajuste, con el formato del de las entradas.
    async printAjuste(id) {
        const r = await useFetch({ url: apiStock, data: { opc: 'getAjuste', id } });

        if (!r || r.status !== 200) return this.alertBox({ type: 'error', title: invEsc((r && r.message) || 'No se pudo cargar el ajuste') });

        const esc    = invEsc;
        const fmtNum = (n) => Math.abs(Number(n || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const sign   = (n) => (n > 0 ? '+' : n < 0 ? '-' : '');
        const h      = r.header || {};
        const items  = r.items || [];
        const money  = !!h.costs;
        const totals = items.reduce((acc, it) => {
            if (it.cost_diff > 0) acc.sobrante += it.cost_diff;
            else acc.faltante += it.cost_diff;
            return acc;
        }, { sobrante: 0, faltante: 0 });
        const neto = Math.round((totals.sobrante + totals.faltante) * 100) / 100;

        const info = [
            ['Tipo de ajuste', h.reason],
            ['Fecha', h.date],
            ['Sucursal', h.branch || '-'],
            ['Almacén', h.warehouse],
            ['Registrado por', h.registered || '-'],
            ['Aplicado por', h.authorized ? h.authorized + (h.applied_at ? ' · ' + h.applied_at : '') : '-']
        ].map(([k, v]) => `<div class="info-item"><span class="k">${k}</span><span class="v">${esc(v)}</span></div>`).join('');

        const rowsHtml = items.map((it) => `<tr><td class="prod"><span class="prod-name">${esc(it.name)}</span>${it.sku ? ` <span class="sku">${esc(it.sku)}</span>` : ''}</td><td class="c">${fmtNum(it.system)}</td><td class="c">${fmtNum(it.counted)}</td><td class="c b">${sign(it.difference)}${fmtNum(it.difference)}</td>${money ? `<td class="r">$${fmtNum(it.cost)}</td><td class="r">${sign(it.cost_diff)}$${fmtNum(it.cost_diff)}</td>` : ''}<td class="c">${esc(it.unit || '-')}</td></tr>`).join('');

        const totalsHtml = money
            ? `<div class="totals"><div class="totals-box"><div class="totals-row"><span>Productos ajustados</span><span>${items.length}</span></div><div class="totals-row"><span>Sobrantes</span><span>${sign(totals.sobrante)}$${fmtNum(totals.sobrante)}</span></div><div class="totals-row"><span>Faltantes</span><span>${sign(totals.faltante)}$${fmtNum(totals.faltante)}</span></div><div class="totals-row grand"><span>Ajuste neto</span><span>${sign(neto)}$${fmtNum(neto)}</span></div></div></div>`
            : `<div class="totals"><div class="totals-box"><div class="totals-row grand"><span>Productos ajustados</span><span>${items.length}</span></div></div></div>`;

        const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ajuste ${esc(h.folio)}</title>
        <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;background:#c8c8c8;color:#000;padding:24px}.toolbar{width:816px;max-width:100%;margin:0 auto 16px;display:flex;justify-content:flex-end;gap:8px}.btn{cursor:pointer;border:1px solid #000;border-radius:4px;padding:8px 16px;font-size:13px;font-weight:600;color:#fff;background:#333}.btn.gray{background:#777}.sheet{width:816px;max-width:100%;min-height:1056px;margin:0 auto;background:#fff;padding:40px 48px;box-shadow:0 2px 10px rgba(0,0,0,.25)}.doc-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:18px}.doc-title{font-size:22px;font-weight:800;color:#000}.folio{font-size:20px;font-weight:800;color:#000;text-align:right}.status{display:inline-block;margin-top:6px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;padding:2px 10px;border:1px solid #000;border-radius:3px;color:#000}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 40px;margin-bottom:18px}.info-item{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #ccc;padding-bottom:4px;font-size:12px}.info-item .k{color:#555}.info-item .v{font-weight:700;text-align:right;color:#000}table{width:100%;border-collapse:collapse;margin-bottom:18px}thead th{border-bottom:1.5px solid #000;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:4px 8px;text-align:left}thead th.r{text-align:right}thead th.c{text-align:center}tbody td{padding:3px 8px;font-size:11px;border-bottom:1px solid #e2e2e2;color:#000}tbody td.r{text-align:right;white-space:nowrap}tbody td.c{text-align:center;white-space:nowrap}tbody td.b{font-weight:700}.prod-name{font-weight:600}.sku{color:#777;font-size:10px}.totals{display:flex;justify-content:flex-end}.totals-box{width:280px;border:1px solid #000;border-radius:4px;padding:10px 14px}.totals-row{display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px}.totals-row.grand{border-top:1.5px solid #000;margin-top:4px;padding-top:8px;font-size:16px;font-weight:800}@media print{body{background:#fff;padding:0}.toolbar{display:none}.sheet{width:auto;min-height:auto;box-shadow:none;padding:0}}</style>
        </head><body>
        <div class="toolbar"><button class="btn" onclick="window.print()">Imprimir</button><button class="btn gray" onclick="window.close()">Cerrar</button></div>
        <div class="sheet">
            <div class="doc-header"><div><div class="doc-title">Comprobante de Ajuste</div><div style="font-size:12px;color:#555;margin-top:3px">${esc(h.branch)}${h.branch ? ' &middot; ' : ''}${esc(h.warehouse)}</div></div><div><div class="folio">${esc(h.folio || '-')}</div>${h.status ? `<span class="status">${esc(h.status)}</span>` : ''}</div></div>
            <div class="info-grid">${info}</div>
            <table><thead><tr><th>Producto</th><th class="c">Sistema</th><th class="c">Contado</th><th class="c">Ajuste</th>${money ? '<th class="r">Costo unit.</th><th class="r">Importe</th>' : ''}<th class="c">Unidad</th></tr></thead><tbody>${rowsHtml || `<tr><td colspan="${money ? 7 : 5}" class="c">Sin diferencias: no se ajustó ningún producto</td></tr>`}</tbody></table>
            ${totalsHtml}
            ${h.note ? `<div style="margin-top:18px;border-left:3px solid #000;background:#f7f7f7;padding:10px 14px;font-size:12px;color:#222"><b style="display:block;margin-bottom:3px;text-transform:uppercase;font-size:10px;letter-spacing:.5px;color:#555">Nota</b>${esc(h.note)}</div>` : ''}
        </div></body></html>`;

        const w = window.open('', '_blank', 'width=900,height=1000');
        if (!w) return this.alertBox({ type: 'warning', title: 'Permite las ventanas emergentes para poder ver el documento.' });

        w.document.write(html);
        w.document.close();
        w.focus();
    }
}
