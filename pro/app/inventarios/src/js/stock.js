// -- Stock --
// Existencias de los productos del Catálogo con inventario y los lotes por caducar.
// Ayudantes (notify, esc, InvPage) en inventarios.js.

let stock;

$(() => {
    stock = new Stock('ctrl/ctrl-stock.php', 'root');
    stock.init();
});

class Stock extends InvPage {

    constructor(link, div_modulo) {
        super(link, div_modulo, {
            name: 'Stock',
            title: 'Stock',
            help: 'Lo que hay de cada producto en los almacenes de la sucursal',
            tabKey: 'inventarios:stock:tab:v1'
        });
    }

    tabsList() {
        return [
            { id: 'stock', tab: 'Existencias', icon: 'boxes', render: () => this.renderStock(), reopen: () => this.lsStock() },
            { id: 'lots', tab: 'Por caducar', icon: 'calendar-clock', render: () => this.renderLots(), reopen: () => this.lsLots() }
        ];
    }

    // -- Existencias --

    renderStock() {
        $('#container-stock').html(`
            <div id="filterBarStock" class="mb-[8px]"></div>
            <div id="summaryStock" class="inv-resumen"></div>
            <div id="containerStock"></div>
        `);

        this.createfilterBar({
            parent: 'filterBarStock',
            id: 'fbStock',
            prefijo: 'stk_',
            coffeesoft: true,
            data: [
                ...this.warehouseFilter('stock.lsStock()'),
                {
                    opc: 'select', id: 'category', lbl: 'Categoría', required: false, class: 'col-12 col-lg-2',
                    data: [{ id: '', valor: 'Todas' }, ...(this.data.categories || [])], onchange: 'stock.lsStock()'
                },
                {
                    opc: 'select', id: 'kind', lbl: 'Tipo', required: false, class: 'col-12 col-lg-2',
                    data: [{ id: '', valor: 'Todos' }, { id: 'product', valor: 'Productos' }, { id: 'supply', valor: 'Insumos' }],
                    onchange: 'stock.lsStock()'
                },
                {
                    opc: 'select', id: 'level', lbl: 'Estado', required: false, class: 'col-12 col-lg-2',
                    data: [
                        { id: '', valor: 'Todos' },
                        { id: 'low', valor: 'Bajo mínimo' },
                        { id: 'out', valor: 'Agotados' },
                        { id: 'over', valor: 'Sobre máximo' },
                        { id: 'ok', valor: 'Normal' }
                    ],
                    onchange: 'stock.lsStock()'
                }
            ]
        });

        this.lsStock();
    }

    lsStock() {
        // Columnas: Producto, Categoría, Tipo, Existencia, Mín/Máx, Estado, Caduca, Último mov. [, Costo, Valor]
        this.table({
            parent: 'containerStock',
            filterBar: 'filterBarStock',
            id: 'tbStock',
            data: { opc: 'lsStock' },
            right: this.costs ? [4, 5, 9, 10] : [4, 5],
            center: [3, 6],
            success: (data) => {
                if (!data || data.status != 200) return notify(data);

                const s = data.summary || {};

                this.csTabCount('stock', data.count);
                this.paintSummary('summaryStock', [
                    { html: `<b>${s.products || 0}</b> ${s.products === 1 ? 'producto' : 'productos'}` },
                    s.low ? { html: `<b>${s.low}</b> bajo mínimo`, tone: 'amber' } : null,
                    s.out ? { html: `<b>${s.out}</b> agotados`, tone: 'red' } : null,
                    s.value !== undefined ? { html: `Valor <b>${money(s.value)}</b>` } : null
                ]);
            }
        });
    }

    // -- Por caducar --

    renderLots() {
        $('#container-lots').html(`
            <div id="filterBarLots" class="mb-[8px]"></div>
            <div id="containerLots"></div>
        `);

        this.createfilterBar({
            parent: 'filterBarLots',
            id: 'fbLots',
            prefijo: 'lot_',
            coffeesoft: true,
            data: [
                ...this.warehouseFilter('stock.lsLots()'),
                {
                    opc: 'select', id: 'days', lbl: 'Vencen en', required: false, class: 'col-12 col-lg-2',
                    data: [
                        { id: '7', valor: '7 días o menos' },
                        { id: '15', valor: '15 días o menos' },
                        { id: '30', valor: '30 días o menos' },
                        { id: '', valor: 'Todos los lotes' }
                    ],
                    onchange: 'stock.lsLots()'
                }
            ]
        });

        this.lsLots();
    }

    lsLots() {
        // Columnas: Producto, Lote, Almacén, Quedan, Producido, Caduca, Faltan [, Valor]
        this.table({
            parent: 'containerLots',
            filterBar: 'filterBarLots',
            id: 'tbLots',
            data: { opc: 'lsLots' },
            right: this.costs ? [4, 8] : [4],
            center: [5, 6, 7],
            success: (data) => {
                if (!data || data.status != 200) return notify(data);

                this.csTabCount('lots', data.count);
            }
        });
    }

    // -- Kárdex del producto --

    async kardex(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getKardex', id, warehouse_id: $('#stk_warehouse_id').val() || 0 } });

        if (!response || response.status != 200) return notify(response);

        const p = response.product;

        this.csModal({
            id: 'modalKardex',
            title: `Kárdex · ${p.name}`,
            subtitle: (p.sku ? `${p.sku} · ` : '') + `Movimientos en ${p.unit}, del más reciente al más viejo`,
            lucideIcon: 'history',
            width: 'max-w-5xl',
            saveText: false,
            cancelText: 'Cerrar',
            body: '<div class="inv-detalle"><div id="kardexLines"></div></div>'
        });

        // Columnas: Fecha, Tipo, Folio, Cantidad, Antes, Quedó [, Costo], Usuario
        this.createCoffeeTable3({
            parent: 'kardexLines',
            id: 'tbKardex',
            theme: 'light',
            design: 'flowbite',
            f_size: 12,
            striped: true,
            data: { row: response.row || [] },
            right: this.costs ? [4, 5, 6, 7] : [4, 5, 6],
            center: [2],
            emptyMessage: 'Todavía no tiene movimientos'
        });
    }

    // -- Mínimo, máximo y lotes --

    async setting(id) {
        const response = await useFetch({ url: this._link, data: { opc: 'getSetting', id } });

        if (!response || response.status != 200) return notify(response);

        const d     = response.data;
        const areas = response.areas || [];
        const half  = 'w-full sm:w-1/2';
        const json  = [
            { id: 'stock_min', lbl: `Mínimo (${d.unit})`, tipo: 'number', icon: 'arrow-down-to-line', min: 0, step: '0.001', ph: '0', class: half, value: d.stock_min, help: 'Debajo de esto sale «Bajo mínimo».' },
            { id: 'stock_max', lbl: `Máximo (${d.unit})`, tipo: 'number', icon: 'arrow-up-to-line', min: 0, step: '0.001', ph: '0 = sin máximo', class: half, value: d.stock_max },
            {
                id: 'track_lots', lbl: 'Lleva lote y caducidad', tipo: 'switch', class: 'w-full', value: d.track_lots,
                help: d.shelf_life_days
                    ? `Vida útil en el Catálogo: ${d.shelf_life_days} días. La caducidad se sugiere sola al dar la entrada.`
                    : 'Al dar la entrada se pide la caducidad; las salidas toman del lote que vence primero.'
            }
        ];

        if (areas.length) {
            json.push({ id: 'warehouse_area_id', lbl: 'Dónde se guarda', tipo: 'select', empty: 'Sin área', class: half, data: areas, value: d.warehouse_area_id });
        }

        this.csModal({
            id: 'modalSetting',
            title: d.name,
            subtitle: 'Mínimo, máximo y lotes en el inventario',
            lucideIcon: 'sliders-horizontal',
            width: 'max-w-lg',
            json,
            onSave: (values, close) => {
                const min = String(values.stock_min || '').trim();
                const max = String(values.stock_max || '').trim();

                if ((min !== '' && !(Number(min) >= 0)) || (max !== '' && !(Number(max) >= 0))) return warnBox('El mínimo y el máximo deben ser números mayores o iguales a 0.');
                if (max !== '' && Number(max) > 0 && Number(max) < Number(min || 0)) return warnBox('El máximo debe ser mayor que el mínimo (o 0 para no tener máximo).');

                return saveFrom('modalSetting', async () => {
                    const r = await useFetch({ url: this._link, data: { opc: 'saveSetting', id, ...values } });

                    if (r && r.status == 200) {
                        close();
                        notify(r);
                        this.lsStock();
                    } else {
                        notify(r);
                    }
                });
            }
        });
    }
}
