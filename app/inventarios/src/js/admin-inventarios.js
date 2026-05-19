let api = '/app/inventarios/ctrl/ctrl-admin-inventarios.php';
let app, productos, almacenes;
let areas, sucursales, estados, idCompany;

$(function () {
    // MODO FAKE — cuando exista el backend usar: fn_ajax({ opc: 'init' }, api).then(...)
    areas      = SAMPLE_ADMIN_AREAS;
    sucursales = SAMPLE_ADMIN_SUCURSALES;
    estados    = SAMPLE_ADMIN_ESTADOS;
    idCompany  = 1;

    app       = new App(api, 'root');
    productos = new Productos(api, 'root');
    almacenes = new Almacenes(api, 'root');

    app.render();
});

class App extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'AdminInventarios';
    }

    render() {
        this.layout();
        this.renderTabs();
        this.renderActiveTab();
    }

    layout() {
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id: this.PROJECT_NAME,
                class: 'w-full min-h-screen p-3',
                container: [
                    {
                        type: 'div',
                        id: `container${this.PROJECT_NAME}`,
                        class: 'w-full bg-[#1F2A37] rounded-lg p-3 min-h-screen',
                        children: [
                            {
                                id: 'titleAdminInventarios',
                                class: 'px-4 pt-3 pb-3'
                            },
                            {
                                id: `tabs${this.PROJECT_NAME}`,
                                class: 'w-full p-3'
                            }
                        ]
                    }
                ]
            }
        });

        $('#titleAdminInventarios').html(`
            <h2 class="text-2xl font-semibold text-white">📦 Administrador de Inventarios</h2>
            <p class="text-gray-400">Gestiona productos y almacenes del catálogo.</p>
        `);
    }

    renderTabs() {
        this.tabLayout({
            parent: 'tabsAdminInventarios',
            id: `tabs${this.PROJECT_NAME}`,
            theme: 'dark',
            type: 'short',
            showBorder: false,
            json: [
                {
                    id: 'tab-productos',
                    tab: 'Productos',
                    lucideIcon: 'box',
                    iconColor: 'text-white',
                    active: true,
                    onClick: () => productos.render()
                },
                {
                    id: 'tab-almacenes',
                    tab: 'Almacenes',
                    lucideIcon: 'warehouse',
                    iconColor: 'text-white',
                    onClick: () => almacenes.render()
                }
            ]
        });

        if (window.lucide) lucide.createIcons();
    }

    renderActiveTab() {
        productos.render();
        almacenes.render();
    }
}

class Productos extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Productos';
    }

    render() {
        this.layout();
    }

    layout() {
        const container = $('#container-tab-productos');
        container.html('<div id="filterbar-productos" class="mb-3"></div><div id="tabla-productos"></div>');

        this.createfilterBar({
            parent: 'filterbar-productos',
            data: [
                {
                    opc: 'select',
                    id: 'active',
                    class: 'col-12 col-md-3',
                    data: estados,
                    onchange: 'productos.ls()'
                },
                {
                    opc: 'select',
                    id: 'filterArea',
                    class: 'col-12 col-md-3',
                    data: [{ id: '', valor: 'Todas las áreas' }, ...areas.filter(a => a.id !== '')],
                    onchange: 'productos.ls()'
                },
                
                {
                    opc: 'button',
                    class: 'col-12 col-md-3',
                    id: 'btnNuevoProducto',
                    text: 'Nuevo Producto',
                    className:'w-100',
                    onClick: () => this.add()
                }
            ]
        });

        this.ls();
    }

    json() {
        return [
            {
                opc: 'input',
                lbl: 'SKU',
                id: 'sku',
                class: 'col-12 col-md-6 mb-3',
                required: true
            },
            {
                opc: 'input',
                lbl: 'Nombre del producto',
                id: 'name',
                class: 'col-12 col-md-6 mb-3',
                required: true
            },
            {
                opc: 'select',
                lbl: 'Área de almacén',
                id: 'area',
                class: 'col-12 mb-3',
                data: areas,
                required: true
            },
            {
                opc: 'input',
                lbl: 'Máximo',
                id: 'max',
                class: 'col-12 col-md-4 mb-3',
                type: 'number'
            },
            {
                opc: 'input',
                lbl: 'Mínimo',
                id: 'min',
                class: 'col-12 col-md-4 mb-3',
                type: 'number'
            },
            {
                opc: 'input',
                lbl: 'Vida útil (días)',
                id: 'vida_util',
                class: 'col-12 col-md-4 mb-3',
                type: 'number'
            },
            {
                opc: 'input',
                lbl: 'Costo de producción',
                id: 'costo',
                class: 'col-12 mb-3',
                type: 'number'
            }
        ];
    }

    ls() {
        // MODO FAKE — cuando exista el backend usar: this.createTable({ data: { opc: 'lsProductos', ... } })
        const fActive = $('#active').val();
        const fArea   = $('#filterArea').val() || '';
        const q       = ($('#qProducto').val() || '').toLowerCase();

        const filtered = Object.values(SAMPLE_PRODUCTOS_DB).filter(p => {
            const okA = fActive == null || fActive === '' || String(p.active) === fActive;
            const okR = !fArea || p.area === fArea;
            const okQ = !q || `${p.name} ${p.sku} ${p.area} ${p.category || ''}`.toLowerCase().includes(q);
            return okA && okR && okQ;
        });

        this.createCoffeeTable3({
            parent: 'tabla-productos',
            id: 'tbProductos',
            theme: 'dark',
            center: [3, 4, 6, 7],
            right: [5],
            extends: true,
            scrollable: false,
            f_size: 12,
            emptyMessage: 'No se encontraron productos con los filtros aplicados',
            emptyIcon: 'icon-box',
            data: { row: filtered.map(_productoRow) }
        });

        if (window.lucide) lucide.createIcons();
    }

    add() {
        this.createModalForm({
            id: 'formModalProducto',
            data: { opc: 'addProducto', idCompany: idCompany },
            bootbox: { title: '<strong>Nuevo Producto</strong>' },
            json: this.json(),
            success: (res) => {
                if (res.status === 200) {
                    alert({ icon: 'success', text: res.message });
                    this.ls();
                } else {
                    alert({ icon: 'error', title: 'Oops...', text: res.message, btn1: true, btn1Text: 'Ok' });
                }
            }
        });
    }

    async edit(id) {
        // MODO FAKE — cuando exista el backend usar: useFetch({ url: this._link, data: { opc: 'getProducto', id } })
        const p = SAMPLE_PRODUCTOS_DB[id];
        if (!p) return;

        this.createModalForm({
            id: 'formModalProducto',
            data: { opc: 'editProducto', id },
            bootbox: { title: '<strong>Editar Producto</strong>' },
            autofill: p,
            json: this.json(),
            success: (res) => {
                if (res.status === 200) {
                    alert({ icon: 'success', text: res.message });
                    this.ls();
                } else {
                    alert({ icon: 'error', title: 'Oops...', text: res.message, btn1: true, btn1Text: 'Ok' });
                }
            }
        });
    }

    toggleStatus(id, active) {
        let tr = $(event.target).closest('tr');
        let title = tr.find('td').eq(0).text();
        let accion = active == 1 ? 'activar' : 'desactivar';

        this.swalQuestion({
            opts: {
                title: `¿Deseas ${accion} el producto ${title}?`
            },
            data: {
                opc: 'toggleStatusProducto',
                active: active,
                id: id
            },
            methods: {
                request: (response) => {
                    if (response.status === 200) {
                        alert({ icon: 'success', text: response.message });
                        this.ls();
                    } else {
                        alert({ icon: 'error', text: response.message });
                    }
                }
            }
        });
    }
}

class Almacenes extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Almacenes';
    }

    render() {
        this.layout();
    }

    layout() {
        const container = $('#container-tab-almacenes');
        container.html('<div id="filterbar-almacenes" class="mb-2"></div><div id="tabla-almacenes"></div>');

        this.createfilterBar({
            parent: 'filterbar-almacenes',
            data: [
                {
                    opc: 'select',
                    id: 'active',
                    class: 'col-12 col-md-3',
                    data: estados,
                    onchange: 'almacenes.ls()'
                },
                {
                    opc: 'select',
                    id: 'filterSucursal',
                    class: 'col-12 col-md-3',
                    data: [{ id: '', valor: 'Todas las sucursales' }, ...sucursales.filter(s => s.id !== '')],
                    onchange: 'almacenes.ls()'
                },
                {
                    opc: 'input',
                    id: 'qAlmacen',
                    class: 'col-12 col-md-3',
                    placeholder: 'Nombre, sucursal, dirección...',
                    onkeyup: 'almacenes.ls()'
                },
                {
                    opc: 'button',
                    class: 'col-12 col-md-3',
                    id: 'btnNuevoAlmacen',
                    text: 'Nuevo Almacén',
                    onClick: () => this.add()
                }
            ]
        });

        this.ls();
    }

    json() {
        return [
            {
                opc: 'input',
                lbl: 'Nombre del almacén',
                id: 'name',
                class: 'col-12 mb-3',
                required: true
            },
           
            {
                opc: 'input',
                lbl: 'Dirección / Ubicación',
                id: 'address',
                class: 'col-12 mb-3'
            },
            {
                opc: 'select',
                lbl: 'Almacén general por defecto',
                id: 'general_default',
                class: 'col-12 mb-3',
                data: [
                    { id: 0, valor: 'No' },
                    { id: 1, valor: 'Sí' }
                ]
            }
        ];
    }

    ls() {
        // MODO FAKE — cuando exista el backend usar: this.createTable({ data: { opc: 'lsAlmacenes', ... } })
        const fActive   = $('#active').val();
        const fSucursal = $('#filterSucursal').val() || '';
        const q         = ($('#qAlmacen').val() || '').toLowerCase();

        const filtered = Object.values(SAMPLE_ALMACENES_DB).filter(a => {
            const okA = fActive == null || fActive === '' || String(a.active) === fActive;
            const okS = !fSucursal || a.sucursal === fSucursal;
            const okQ = !q || `${a.name} ${a.sucursal} ${a.address || ''}`.toLowerCase().includes(q);
            return okA && okS && okQ;
        });

        this.createCoffeeTable3({
            parent: 'tabla-almacenes',
            id: 'tbAlmacenes',
            theme: 'dark',
            center: [2, 3],
            extends: true,
            scrollable: false,
            f_size: 12,
            emptyMessage: 'No se encontraron almacenes con los filtros aplicados',
            emptyIcon: 'icon-home',
            data: { row: filtered.map(_almacenRow) }
        });

        if (window.lucide) lucide.createIcons();
    }

    add() {
        this.createModalForm({
            id: 'formModalAlmacen',
            data: { opc: 'addAlmacen', idCompany: idCompany },
            bootbox: { title: '<strong>Nuevo Almacén</strong>' },
            json: this.json(),
            success: (res) => {
                if (res.status === 200) {
                    alert({ icon: 'success', text: res.message });
                    this.ls();
                } else {
                    alert({ icon: 'error', title: 'Oops...', text: res.message, btn1: true, btn1Text: 'Ok' });
                }
            }
        });
    }

    async edit(id) {
        // MODO FAKE — cuando exista el backend usar: useFetch({ url: this._link, data: { opc: 'getAlmacen', id } })
        const a = SAMPLE_ALMACENES_DB[id];
        if (!a) return;

        this.createModalForm({
            id: 'formModalAlmacen',
            data: { opc: 'editAlmacen', id },
            bootbox: { title: '<strong>Editar Almacén</strong>' },
            autofill: a,
            json: this.json(),
            success: (res) => {
                if (res.status === 200) {
                    alert({ icon: 'success', text: res.message });
                    this.ls();
                } else {
                    alert({ icon: 'error', title: 'Oops...', text: res.message, btn1: true, btn1Text: 'Ok' });
                }
            }
        });
    }

    toggleStatus(id, active) {
        let tr = $(event.target).closest('tr');
        let title = tr.find('td').eq(0).text();
        let accion = active == 1 ? 'activar' : 'desactivar';

        this.swalQuestion({
            opts: {
                title: `¿Deseas ${accion} el almacén ${title}?`
            },
            data: {
                opc: 'toggleStatusAlmacen',
                active: active,
                id: id
            },
            methods: {
                request: (response) => {
                    if (response.status === 200) {
                        alert({ icon: 'success', text: response.message });
                        this.ls();
                    } else {
                        alert({ icon: 'error', text: response.message });
                    }
                }
            }
        });
    }
}
