let api = '/app/inventarios/ctrl/ctrl-admin-productos.php';
let cat = {};
let app, productos, categorias, almacenes, areas, unidades, proveedores, origenes, mermas, ajustes, estados;

$(async () => {
    const data = await useFetch({ url: api, data: { opc: "init" } });

    cat = {
        categorias:  (data && data.categorias)  || SAMPLE_CATALOGOS.categorias,
        areas:       (data && data.areas)        || SAMPLE_CATALOGOS.areas,
        unidades:    (data && data.unidades)     || SAMPLE_CATALOGOS.unidades,
        proveedores: (data && data.proveedores)  || SAMPLE_CATALOGOS.proveedores,
        sucursales:  (data && data.sucursales)   || SAMPLE_CATALOGOS.sucursales
    };

    app         = new App(api, "root");
    productos   = new Productos(api, "root");
    categorias  = new Categorias(api, "root");
    almacenes   = new Almacenes(api, "root");
    areas       = new Areas(api, "root");
    unidades    = new Unidades(api, "root");
    proveedores = new Proveedores(api, "root");
    origenes    = new Origenes(api, "root");
    mermas      = new Mermas(api, "root");
    ajustes     = new Ajustes(api, "root");
    estados     = new Estados(api, "root");

    app.render();
});

// -- Clase principal --

class App extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "AdminProductos";
    }

    render() {
        this.layout();
        this.renderTabs();
        this.renderActiveTab();
    }

    layout() {
        this.createLayout({
            parent: "root",
            design: false,
            data: {
                id: this.PROJECT_NAME,
                class: "flex flex-col w-full p-3 flex-1",
                container: [
                    {
                        type: "div",
                        id: `container${this.PROJECT_NAME}`,
                        class: "w-full flex-1 bg-[#1F2A37] rounded-lg p-3 overflow-auto",
                        children: [
                            {
                                id: "titleAdmin",
                                class: "px-2 pt-2 pb-3"
                            },
                            {
                                id: `tabs${this.PROJECT_NAME}`,
                                class: "w-full"
                            }
                        ]
                    }
                ]
            }
        });

        $("#titleAdmin").html(`
            <h2 class="text-2xl font-bold text-white">Productos</h2>
            <p class="text-sm text-gray-400 mt-1">Administra el catalogo de productos del inventario, categorias, areas y unidades de medida.</p>
        `);
    }

    renderTabs() {
        this.tabLayout({
            parent: `tabs${this.PROJECT_NAME}`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: "dark",
            type: "short",
            showBorder: false,
            json: [
                {
                    id: "productos",
                    tab: "Productos",
                    lucideIcon: "package",
                    active: true,
                    onClick: () => productos.render()
                },
                {
                    id: "categorias",
                    tab: "Categorias",
                    lucideIcon: "tag",
                    onClick: () => categorias.render()
                },
                {
                    id: "almacenes",
                    tab: "Almacenes",
                    lucideIcon: "warehouse",
                    onClick: () => almacenes.render()
                },
                {
                    id: "areas",
                    tab: "Areas",
                    lucideIcon: "layout-grid",
                    onClick: () => areas.render()
                },
                {
                    id: "unidades",
                    tab: "Unidades",
                    lucideIcon: "ruler",
                    onClick: () => unidades.render()
                },
                {
                    id: "proveedores",
                    tab: "Proveedores",
                    lucideIcon: "truck",
                    onClick: () => proveedores.render()
                },
                {
                    id: "motivos",
                    tab: "Motivos & Estados",
                    lucideIcon: "sliders-horizontal",
                    onClick: () => app.renderMotivos()
                }
            ]
        });

        if (window.lucide) lucide.createIcons();
    }

    renderActiveTab() {
        productos.render();
        categorias.render();
        almacenes.render();
        areas.render();
        unidades.render();
        proveedores.render();
        this.renderMotivos();
    }

    renderMotivos() {
        $("#container-motivos").html(`<div id="subtabsMotivos" class="w-full"></div>`);

        this.tabLayout({
            parent: "subtabsMotivos",
            id: "subtabsMotivos",
            theme: "dark",
            type: "short",
            showBorder: false,
            json: [
                {
                    id: "origenes",
                    tab: "Origenes de entrada",
                    lucideIcon: "arrow-down-circle",
                    active: true,
                    onClick: () => origenes.render()
                },
                {
                    id: "mermas",
                    tab: "Motivos de merma",
                    lucideIcon: "trash-2",
                    onClick: () => mermas.render()
                },
                {
                    id: "ajustes",
                    tab: "Motivos de ajuste",
                    lucideIcon: "sliders-horizontal",
                    onClick: () => ajustes.render()
                },
                {
                    id: "estados",
                    tab: "Estados de traspaso",
                    lucideIcon: "git-compare",
                    onClick: () => estados.render()
                }
            ]
        });

        if (window.lucide) lucide.createIcons();

        origenes.render();
        mermas.render();
        ajustes.render();
        estados.render();
    }
}

// -- Productos --

class Productos extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Productos";
    }

    render() {
        this.filterBar();
        this.ls();
    }

    filterBar() {
        $("#container-productos").html(`
            <div id="filterbar-productos" class="mb-2"></div>
            <div id="tabla-productos" class="w-full"></div>
        `);

        this.createfilterBar({
            parent: "filterbar-productos",
            data: [
                {
                    opc: "select",
                    id: "estadoProductos",
                    class: "col-12 col-md-2",
                    data: this.statusOptions(),
                    onchange: "productos.ls()"
                },
                {
                    opc: "select",
                    id: "categoriaProductos",
                    class: "col-12 col-md-3",
                    data: [{ id: "", valor: "Todas las categorias" }, ...cat.categorias],
                    text: "valor",
                    value: "id",
                    onchange: "productos.ls()"
                },
                {
                    opc: "select",
                    id: "areaProductos",
                    class: "col-12 col-md-2",
                    data: [{ id: "", valor: "Todas las areas" }, ...cat.areas],
                    text: "valor",
                    value: "id",
                    onchange: "productos.ls()"
                },
                {
                    opc: "select",
                    id: "unidadProductos",
                    class: "col-12 col-md-2",
                    data: [{ id: "", valor: "Todas las unidades" }, ...cat.unidades],
                    text: "valor",
                    value: "id",
                    onchange: "productos.ls()"
                },
                {
                    opc: "button",
                    id: "btnNuevoProducto",
                    class: "col-12 col-md-3",
                    text: "Nuevo Producto",
                    onClick: () => this.add()
                }
            ]
        });
    }

    ls() {
        this.createTable({
            parent: "tabla-productos",
            idFilterBar: "filterbar-productos",
            data: {
                opc: "lsProducts",
                active: $("#estadoProductos").val(),
                category_id: $("#categoriaProductos").val(),
                warehouse_area_id: $("#areaProductos").val(),
                unit_id: $("#unidadProductos").val()
            },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbProductos",
                theme: "dark",
                striped: true,
                f_size: 12,
                center: [1,5, 7],
                right: [6]
            }
        });
    }

    add() {
        this.createCoffeeModalForm({
            id: "formProductoAdd",
            data: { opc: "addProduct" },
            // coffeesoft:true,
            theme:'dark',
            bootbox: { title: "Nuevo Producto", size: "default" },
            json: this.json(),
            success: (response) => this.afterSave(response)
        });
    }

    async edit(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getProduct", id: id } });

        this.createModalForm({
            id: "formProductoEdit",
            data: { opc: "editProduct", id: id },
            coffeesoft: true,
            theme: 'dark',
            bootbox: { title: "Editar Producto", size: "large" },
            autofill: request.data,
            json: this.json(),
            success: (response) => this.afterSave(response)
        });
    }

    status(id, active) {
        this.swalQuestion({
            opts: {
                title: "Cambiar estado del producto",
                text: "Esta accion ocultara o reactivara el producto.",
                icon: "warning"
            },
            data: { opc: "statusProduct", active: active, id: id },
            methods: {
                send: () => this.ls()
            }
        });
    }

    async preview(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getProduct", id: id } });
        const p = request.data || {};

        const money = (v) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(parseFloat(v) || 0);
        const catName = (cat.categorias.find(c => c.id == p.category_id) || {}).valor || "Sin categoria";

        const src = p.image ? `https://huubie.com.mx/${String(p.image).replace(/^\/+/, "")}` : "";
        const img = src
            ? `<img src="${src}" alt="Producto" class="w-40 h-40 rounded-lg object-cover bg-gray-700 mx-auto" />`
            : `<div class="w-40 h-40 bg-[#1F2A37] rounded-lg flex items-center justify-center mx-auto">
                   <i class="icon-package text-gray-500 text-4xl"></i>
               </div>`;

        bootbox.dialog({
            closeButton: true,
            title: `<div class="flex items-center gap-2 text-white text-lg font-semibold">
                        <i class="icon-eye text-green-400"></i> Vista previa del producto
                    </div>`,
            message: `
                <div class="p-2">
                    ${img}
                    <h3 class="text-xl font-bold text-white text-center mt-4">${p.name || "Sin nombre"}</h3>
                    <p class="text-2xl font-bold text-green-400 text-center mt-1">${money(p.price)}</p>
                    <div class="mt-4 bg-[#1E293B] rounded-lg p-4 grid grid-cols-2 gap-3 text-sm">
                        <div><span class="text-gray-400 block">SKU</span><span class="text-white">${p.sku || "-"}</span></div>
                        <div><span class="text-gray-400 block">Categoria</span><span class="text-white">${catName}</span></div>
                        <div><span class="text-gray-400 block">Costo unitario</span><span class="text-white">${money(p.cost_unit)}</span></div>
                        <div><span class="text-gray-400 block">Estado</span><span class="text-white">${p.active == 1 ? "Activo" : "Inactivo"}</span></div>
                        <div><span class="text-gray-400 block">Stock minimo</span><span class="text-white">${p.stock_min ?? "-"}</span></div>
                        <div><span class="text-gray-400 block">Stock maximo</span><span class="text-white">${p.stock_max ?? "-"}</span></div>
                        <div class="col-span-2"><span class="text-gray-400 block">Descripcion</span><span class="text-white">${p.description || "Sin descripcion"}</span></div>
                    </div>
                </div>
            `
        });
    }

    afterSave(response) {
        if (response.status == 200) {
            alert({ icon: "success", text: response.message });
            this.ls();
        } else {
            alert({ icon: "info", title: "Oops!...", text: response.message, btn1: true, btn1Text: "Ok" });
        }
    }

    statusOptions() {
        return [
            { id: "1", valor: "Activos" },
            { id: "0", valor: "Inactivos" },
            { id: "", valor: "Todos" }
        ];
    }

    json() {
        return [
            {
                opc: "tabs",
                id: "tabsProducto",
                class: "col-12",
                tabs: [
                    {
                        id: "pos",
                        tab: "Catalogo POS",
                        lucideIcon: "tag",
                        active: true,
                        json: [
                            {
                                opc: "input",
                                id: "name",
                                lbl: "Nombre del producto",
                                class: "col-12 mb-3"
                            },
                            {
                                opc: "input-group",
                                id: "price",
                                lbl: "Precio venta",
                                tipo: "cifra",
                                icon: "icon-dollar",
                                class: "col-12 col-md-6 mb-3"
                            },
                            {
                                opc: "select",
                                id: "category_id",
                                lbl: "Categoria",
                                class: "col-12 col-md-6 mb-3",
                                data: cat.categorias,
                                text: "valor",
                                value: "id"
                            },
                            {
                                opc: "textarea",
                                id: "description",
                                lbl: "Descripcion",
                                rows: 2,
                                required: false,
                                class: "col-12 mb-3"
                            }
                        ]
                    },
                    {
                        id: "inv",
                        tab: "Atributos de inventario",
                        lucideIcon: "sliders-horizontal",
                        json: [
                            {
                                opc: "input",
                                id: "sku",
                                lbl: "SKU",
                                required: false,
                                placeholder: "Se autogenera si lo dejas vacio",
                                class: "col-12 col-md-6 mb-3"
                            },
                            {
                                opc: "input-group",
                                id: "cost_unit",
                                lbl: "Costo unitario",
                                tipo: "cifra",
                                icon: "icon-dollar",
                                class: "col-12 col-md-6 mb-3"
                            },
                            {
                                opc: "select",
                                id: "warehouse_area_id",
                                lbl: "Area",
                                required: false,
                                class: "col-12 col-md-6 mb-3",
                                data: [{ id: "", valor: "Sin area" }, ...cat.areas],
                                text: "valor",
                                value: "id"
                            },
                            {
                                opc: "select",
                                id: "unit_id",
                                lbl: "Unidad de medida",
                                required: false,
                                class: "col-12 col-md-6 mb-3",
                                data: [{ id: "", valor: "Sin unidad" }, ...cat.unidades],
                                text: "valor",
                                value: "id"
                            },
                            {
                                opc: "input",
                                id: "stock_min",
                                lbl: "Stock minimo",
                                tipo: "numero",
                                required: false,
                                class: "col-12 col-md-4 mb-3"
                            },
                            {
                                opc: "input",
                                id: "stock_max",
                                lbl: "Stock maximo",
                                tipo: "numero",
                                required: false,
                                class: "col-12 col-md-4 mb-3"
                            },
                            {
                                opc: "input",
                                id: "shelf_life_days",
                                lbl: "Vida util (dias)",
                                tipo: "numero",
                                required: false,
                                class: "col-12 col-md-4 mb-3"
                            },
                            {
                                opc: "textarea",
                                id: "attribute_description",
                                lbl: "Notas de inventario",
                                rows: 2,
                                required: false,
                                class: "col-12 mb-3"
                            }
                        ]
                    }
                ]
            }
        ];
    }
}

// -- Categorias --

class Categorias extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Categorias";
    }

    render() {
        this.filterBar();
        this.ls();
    }

    filterBar() {
        $("#container-categorias").html(`
            <div id="filterbar-categorias" class="mb-2"></div>
            <div id="tabla-categorias" class="w-full"></div>
        `);

        this.createfilterBar({
            parent: "filterbar-categorias",
            data: [
                {
                    opc: "select",
                    id: "estadoCategorias",
                    class: "col-12 col-md-2",
                    data: statusFilter(),
                    onchange: "categorias.ls()"
                },
                {
                    opc: "button",
                    id: "btnNuevaCategoria",
                    class: "col-12 col-md-3",
                    text: "Nueva Categoria",
                    onClick: () => this.add()
                }
            ]
        });
    }

    ls() {
        this.createTable({
            parent: "tabla-categorias",
            idFilterBar: "filterbar-categorias",
            data: { opc: "lsCategories", active: $("#estadoCategorias").val() },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: { id: "tbCategorias", theme: "dark", striped: true, center: [2] }
        });
    }

    add() {
        this.createCoffeeModalForm({
            id: "formCategoriaAdd",
            data: { opc: "addCategory" },
            coffeesoft: true,
            theme: 'dark',
            bootbox: { title: "Nueva Categoria",size:'small' },
            json: this.json(),
            success: (response) => afterSave(response, () => this.ls())
        });
    }

    async edit(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getCategory", id: id } });

        this.createModalForm({
            id: "formCategoriaEdit",
            data: { opc: "editCategory", id: id },
            coffeesoft: true,
            theme: 'dark',
            bootbox: { title: "Editar Categoria" },
            autofill: request.data,
            json: this.json(),
            success: (response) => afterSave(response, () => this.ls())
        });
    }

    status(id, active) {
        this.swalQuestion({
            opts: {
                title: "Cambiar estado de la categoria",
                text: "Esta accion activara o desactivara la categoria.",
                icon: "warning"
            },
            data: { opc: "statusCategory", active: active, id: id },
            methods: { send: () => this.ls() }
        });
    }

    json() {
        return [
            {
                opc: "input",
                id: "classification",
                lbl: "Nombre de la categoria",
                class: "col-12 mb-3"
            },
            {
                opc: "textarea",
                id: "description",
                lbl: "Descripcion",
                rows: 3,
                required: false,
                class: "col-12 mb-3"
            }
        ];
    }
}

// -- Almacenes --

class Almacenes extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Almacenes";
    }

    render() {
        this.filterBar();
        this.ls();
    }

    filterBar() {
        $("#container-almacenes").html(`
            <div id="filterbar-almacenes" class="mb-2"></div>
            <div id="tabla-almacenes" class="w-full"></div>
        `);

        this.createfilterBar({
            parent: "filterbar-almacenes",
            data: [
                {
                    opc: "select",
                    id: "estadoAlmacenes",
                    class: "col-12 col-md-2",
                    data: statusFilter(),
                    onchange: "almacenes.ls()"
                },
                {
                    opc: "button",
                    id: "btnNuevoAlmacen",
                    class: "col-12 col-md-3",
                    text: "Nuevo Almacen",
                    onClick: () => this.add()
                }
            ]
        });
    }

    ls() {
        this.createTable({
            parent: "tabla-almacenes",
            idFilterBar: "filterbar-almacenes",
            data: { opc: "lsWarehouses", active: $("#estadoAlmacenes").val() },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: { id: "tbAlmacenes", theme: "dark", striped: true, center: [4] }
        });
    }

    add() {
        this.createModalForm({
            id: "formAlmacenAdd",
            data: { opc: "addWarehouse" },
            coffeesoft: true,
            theme: 'dark',
            bootbox: { title: "Nuevo Almacen" },
            json: this.json(),
            success: (response) => afterSave(response, () => this.ls())
        });
    }

    async edit(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getWarehouse", id: id } });

        this.createModalForm({
            id: "formAlmacenEdit",
            data: { opc: "editWarehouse", id: id },
            coffeesoft: true,
            theme: 'dark',
            bootbox: { title: "Editar Almacen" },
            autofill: request.data,
            json: this.json(),
            success: (response) => afterSave(response, () => this.ls())
        });
    }

    status(id, active) {
        this.swalQuestion({
            opts: {
                title: "Cambiar estado del almacen",
                text: "Esta accion activara o desactivara el almacen.",
                icon: "warning"
            },
            data: { opc: "statusWarehouse", active: active, id: id },
            methods: { send: () => this.ls() }
        });
    }

    json() {
        return [
            {
                opc: "input",
                id: "name",
                lbl: "Nombre del almacen",
                class: "col-12 mb-3"
            },
            {
                opc: "select",
                id: "subsidiaries_id",
                lbl: "Sucursal",
                class: "col-12 col-md-6 mb-3",
                data: cat.sucursales,
                text: "valor",
                value: "id"
            },
            {
                opc: "select",
                id: "warehouse_area_id",
                lbl: "Area principal",
                required: false,
                class: "col-12 col-md-6 mb-3",
                data: [{ id: "", valor: "Sin area" }, ...cat.areas],
                text: "valor",
                value: "id"
            },
            {
                opc: "select",
                id: "is_default",
                lbl: "Almacen por defecto",
                class: "col-12 mb-3",
                data: [{ id: "0", valor: "No" }, { id: "1", valor: "Si" }]
            }
        ];
    }
}

// -- Areas --

class Areas extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Areas";
    }

    render() {
        this.filterBar();
        this.ls();
    }

    filterBar() {
        $("#container-areas").html(`
            <div id="filterbar-areas" class="mb-2"></div>
            <div id="tabla-areas" class="w-full"></div>
        `);

        this.createfilterBar({
            parent: "filterbar-areas",
            data: [
                {
                    opc: "select",
                    id: "estadoAreas",
                    class: "col-12 col-md-2",
                    data: statusFilter(),
                    onchange: "areas.ls()"
                },
                {
                    opc: "button",
                    id: "btnNuevaArea",
                    class: "col-12 col-md-3",
                    text: "Nueva Area",
                    onClick: () => this.add()
                }
            ]
        });
    }

    ls() {
        this.createTable({
            parent: "tabla-areas",
            idFilterBar: "filterbar-areas",
            data: { opc: "lsAreas", active: $("#estadoAreas").val() },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: { id: "tbAreas", theme: "dark", striped: true, center: [4] }
        });
    }

    add() {
        this.createModalForm({
            id: "formAreaAdd",
            data: { opc: "addArea" },
            coffeesoft: true,
            theme: 'dark',
            bootbox: { title: "Nueva Area" },
            json: this.json(),
            success: (response) => afterSave(response, () => this.ls())
        });
    }

    async edit(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getArea", id: id } });

        this.createModalForm({
            id: "formAreaEdit",
            data: { opc: "editArea", id: id },
            coffeesoft: true,
            theme: 'dark',
            bootbox: { title: "Editar Area" },
            autofill: request.data,
            json: this.json(),
            success: (response) => afterSave(response, () => this.ls())
        });
    }

    status(id, active) {
        this.swalQuestion({
            opts: {
                title: "Cambiar estado del area",
                text: "Esta accion activara o desactivara el area.",
                icon: "warning"
            },
            data: { opc: "statusArea", active: active, id: id },
            methods: { send: () => this.ls() }
        });
    }

    json() {
        return [
            {
                opc: "input",
                id: "name",
                lbl: "Nombre del area",
                class: "col-12 mb-3"
            },
            {
                opc: "input",
                id: "color_hex",
                lbl: "Color (hex)",
                type: "color",
                class: "col-12 col-md-4 mb-3"
            },
            {
                opc: "textarea",
                id: "description",
                lbl: "Descripcion",
                rows: 2,
                required: false,
                class: "col-12 mb-3"
            }
        ];
    }
}

// -- Unidades --

class Unidades extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Unidades";
    }

    render() {
        this.filterBar();
        this.ls();
    }

    filterBar() {
        $("#container-unidades").html(`
            <div id="filterbar-unidades" class="mb-2"></div>
            <div id="tabla-unidades" class="w-full"></div>
        `);

        this.createfilterBar({
            parent: "filterbar-unidades",
            data: [
                {
                    opc: "select",
                    id: "estadoUnidades",
                    class: "col-12 col-md-2",
                    data: statusFilter(),
                    onchange: "unidades.ls()"
                },
                {
                    opc: "button",
                    id: "btnNuevaUnidad",
                    class: "col-12 col-md-3",
                    text: "Nueva Unidad",
                    onClick: () => this.add()
                }
            ]
        });
    }

    ls() {
        this.createTable({
            parent: "tabla-unidades",
            idFilterBar: "filterbar-unidades",
            data: { opc: "lsUnits", active: $("#estadoUnidades").val() },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: { id: "tbUnidades", theme: "dark", striped: true, center: [3] }
        });
    }

    add() {
        this.createModalForm({
            id: "formUnidadAdd",
            data: { opc: "addUnit" },
            coffeesoft: true,
            theme: 'dark',
            bootbox: { title: "Nueva Unidad" },
            json: this.json(),
            success: (response) => afterSave(response, () => this.ls())
        });
    }

    async edit(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getUnit", id: id } });

        this.createModalForm({
            id: "formUnidadEdit",
            data: { opc: "editUnit", id: id },
            coffeesoft: true,
            theme: 'dark',
            bootbox: { title: "Editar Unidad" },
            autofill: request.data,
            json: this.json(),
            success: (response) => afterSave(response, () => this.ls())
        });
    }

    status(id, active) {
        this.swalQuestion({
            opts: {
                title: "Cambiar estado de la unidad",
                text: "Esta accion activara o desactivara la unidad.",
                icon: "warning"
            },
            data: { opc: "statusUnit", active: active, id: id },
            methods: { send: () => this.ls() }
        });
    }

    json() {
        return [
            {
                opc: "input",
                id: "code",
                lbl: "Codigo (ej. pza, kg)",
                class: "col-12 col-md-4 mb-3"
            },
            {
                opc: "input",
                id: "name",
                lbl: "Nombre",
                class: "col-12 col-md-8 mb-3"
            }
        ];
    }
}

// -- Proveedores --

class Proveedores extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Proveedores";
    }

    render() {
        this.filterBar();
        this.ls();
    }

    filterBar() {
        $("#container-proveedores").html(`
            <div id="filterbar-proveedores" class="mb-2"></div>
            <div id="tabla-proveedores" class="w-full"></div>
        `);

        this.createfilterBar({
            parent: "filterbar-proveedores",
            data: [
                {
                    opc: "select",
                    id: "estadoProveedores",
                    class: "col-12 col-md-2",
                    data: statusFilter(),
                    onchange: "proveedores.ls()"
                },
                {
                    opc: "button",
                    id: "btnNuevoProveedor",
                    class: "col-12 col-md-3",
                    text: "Nuevo Proveedor",
                    onClick: () => this.add()
                }
            ]
        });
    }

    ls() {
        this.createTable({
            parent: "tabla-proveedores",
            idFilterBar: "filterbar-proveedores",
            data: { opc: "lsSuppliers", active: $("#estadoProveedores").val() },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: { id: "tbProveedores", theme: "dark", striped: true, center: [5] }
        });
    }

    add() {
        this.createModalForm({
            id: "formProveedorAdd",
            data: { opc: "addSupplier" },
            coffeesoft: true,
            theme: 'dark',
            bootbox: { title: "Nuevo Proveedor" },
            json: this.json(),
            success: (response) => afterSave(response, () => this.ls())
        });
    }

    async edit(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getSupplier", id: id } });

        this.createModalForm({
            id: "formProveedorEdit",
            data: { opc: "editSupplier", id: id },
            coffeesoft: true,
            theme: 'dark',
            bootbox: { title: "Editar Proveedor" },
            autofill: request.data,
            json: this.json(),
            success: (response) => afterSave(response, () => this.ls())
        });
    }

    status(id, active) {
        this.swalQuestion({
            opts: {
                title: "Cambiar estado del proveedor",
                text: "Esta accion activara o desactivara el proveedor.",
                icon: "warning"
            },
            data: { opc: "statusSupplier", active: active, id: id },
            methods: { send: () => this.ls() }
        });
    }

    json() {
        return [
            {
                opc: "input",
                id: "name",
                lbl: "Nombre del proveedor",
                class: "col-12 mb-3"
            },
            {
                opc: "input",
                id: "contact_name",
                lbl: "Nombre de contacto",
                required: false,
                class: "col-12 col-md-6 mb-3"
            },
            {
                opc: "input",
                id: "phone",
                lbl: "Telefono",
                tipo: "tel",
                required: false,
                class: "col-12 col-md-6 mb-3"
            },
            {
                opc: "input",
                id: "email",
                lbl: "Correo electronico",
                tipo: "email",
                required: false,
                class: "col-12 mb-3"
            }
        ];
    }
}

// -- Origenes de entrada --

class Origenes extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Origenes";
    }

    render() {
        this.filterBar();
        this.ls();
    }

    filterBar() {
        $("#container-origenes").html(`
            <div id="filterbar-origenes" class="mb-2"></div>
            <div id="tabla-origenes" class="w-full"></div>
        `);

        this.createfilterBar({
            parent: "filterbar-origenes",
            data: [
                {
                    opc: "select",
                    id: "estadoOrigenes",
                    class: "col-12 col-md-2",
                    data: statusFilter(),
                    onchange: "origenes.ls()"
                },
                {
                    opc: "button",
                    id: "btnNuevoOrigen",
                    class: "col-12 col-md-3",
                    text: "Nuevo Origen",
                    onClick: () => this.add()
                }
            ]
        });
    }

    ls() {
        this.createTable({
            parent: "tabla-origenes",
            idFilterBar: "filterbar-origenes",
            data: { opc: "lsInflowOrigins", active: $("#estadoOrigenes").val() },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: { id: "tbOrigenes", theme: "dark", striped: true, center: [4] }
        });
    }

    add() {
        this.createModalForm({
            id: "formOrigenAdd",
            data: { opc: "addInflowOrigin" },
            coffeesoft: true,
            theme: 'dark',
            bootbox: { title: "Nuevo Origen de entrada" },
            json: this.json(),
            success: (response) => afterSave(response, () => this.ls())
        });
    }

    async edit(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getInflowOrigin", id: id } });

        this.createModalForm({
            id: "formOrigenEdit",
            data: { opc: "editInflowOrigin", id: id },
            coffeesoft: true,
            theme: 'dark',
            bootbox: { title: "Editar Origen de entrada" },
            autofill: request.data,
            json: this.json(),
            success: (response) => afterSave(response, () => this.ls())
        });
    }

    status(id, active) {
        this.swalQuestion({
            opts: {
                title: "Cambiar estado del origen",
                text: "Esta accion activara o desactivara el origen.",
                icon: "warning"
            },
            data: { opc: "statusInflowOrigin", active: active, id: id },
            methods: { send: () => this.ls() }
        });
    }

    json() {
        return [
            {
                opc: "input",
                id: "code",
                lbl: "Codigo (ej. SUPPLIER)",
                class: "col-12 col-md-6 mb-3"
            },
            {
                opc: "input",
                id: "name",
                lbl: "Nombre",
                class: "col-12 col-md-6 mb-3"
            },
            {
                opc: "input",
                id: "color_hex",
                lbl: "Color (hex)",
                type: "color",
                class: "col-12 col-md-4 mb-3"
            },
            {
                opc: "input",
                id: "icon",
                lbl: "Icono",
                required: false,
                class: "col-12 col-md-4 mb-3"
            },
            {
                opc: "select",
                id: "requires_supplier",
                lbl: "Requiere proveedor",
                class: "col-12 col-md-4 mb-3",
                data: [{ id: "0", valor: "No" }, { id: "1", valor: "Si" }]
            }
        ];
    }
}

// -- Motivos de merma --

class Mermas extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Mermas";
    }

    render() {
        this.filterBar();
        this.ls();
    }

    filterBar() {
        $("#container-mermas").html(`
            <div id="filterbar-mermas" class="mb-2"></div>
            <div id="tabla-mermas" class="w-full"></div>
        `);

        this.createfilterBar({
            parent: "filterbar-mermas",
            data: [
                {
                    opc: "select",
                    id: "estadoMermas",
                    class: "col-12 col-md-2",
                    data: statusFilter(),
                    onchange: "mermas.ls()"
                },
                {
                    opc: "button",
                    id: "btnNuevaMerma",
                    class: "col-12 col-md-3",
                    text: "Nuevo Motivo",
                    onClick: () => this.add()
                }
            ]
        });
    }

    ls() {
        this.createTable({
            parent: "tabla-mermas",
            idFilterBar: "filterbar-mermas",
            data: { opc: "lsShrinkageReasons", active: $("#estadoMermas").val() },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: { id: "tbMermas", theme: "dark", striped: true }
        });
    }

    add() {
        this.createModalForm({
            id: "formMermaAdd",
            data: { opc: "addShrinkageReason" },
            coffeesoft: true,
            theme: 'dark',
            bootbox: { title: "Nuevo Motivo de merma" },
            json: this.json(),
            success: (response) => afterSave(response, () => this.ls())
        });
        this.simulator("formMermaAdd");
    }

    async edit(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getShrinkageReason", id: id } });

        this.createModalForm({
            id: "formMermaEdit",
            data: { opc: "editShrinkageReason", id: id },
            coffeesoft: true,
            theme: 'dark',
            bootbox: { title: "Editar Motivo de merma" },
            autofill: request.data,
            json: this.json(),
            success: (response) => afterSave(response, () => this.ls())
        });
        this.simulator("formMermaEdit");
    }

    // Cablea la vista previa del badge (campo "mermaPreview" declarado en json()): la
    // actualiza al cambiar el color o el nombre, mostrando fondo elegido + texto adaptado.
    simulator(formId) {
        setTimeout(() => {
            const $form  = $("#" + formId);
            const $color = $form.find('[name="color_hex"], #color_hex').first();
            const $name  = $form.find('[name="name"], #name').first();
            const $badge = $form.find("#mermaPreviewBadge");
            const $bg    = $form.find("#mermaPreviewBg");
            const $fg    = $form.find("#mermaPreviewFg");
            if (!$color.length || !$badge.length) return;

            const render = () => {
                const hex  = $color.val() || "#9CA3AF";
                const name = ($name.val() || "Motivo").toString();
                const c    = badgeColors(hex);
                $badge.html(badgePreview(name, hex));
                $bg.text(c.bg);
                $fg.text(c.fg);
            };

            $color.off("input.sim change.sim").on("input.sim change.sim", render);
            $name.off("input.sim").on("input.sim", render);
            render();
        }, 30);
    }

    status(id, active) {
        this.swalQuestion({
            opts: {
                title: "Cambiar estado del motivo",
                text: "Esta accion activara o desactivara el motivo.",
                icon: "warning"
            },
            data: { opc: "statusShrinkageReason", active: active, id: id },
            methods: { send: () => this.ls() }
        });
    }

    json() {
        return [
            {
                opc: "input",
                id: "code",
                lbl: "Codigo (ej. EXPIRY)",
                class: "col-12 col-md-6 mb-3"
            },
            {
                opc: "input",
                id: "name",
                lbl: "Nombre",
                class: "col-12 col-md-6 mb-3"
            },
            {
                opc: "input",
                id: "color_hex",
                lbl: "Color (hex)",
                type: "color",
                class: "col-12 col-md-4 mb-3"
            },
            {
                opc: "input",
                id: "icon",
                lbl: "Icono",
                required: false,
                class: "col-12 col-md-8 mb-3"
            },
            {
                // Vista previa del badge (se rellena en vivo desde simulator()).
                opc: "div",
                id: "mermaPreview",
                class: "col-12 mb-3",
                html: `
                    <label class="block text-[11px] font-medium text-gray-400 mb-1">Vista previa</label>
                    <div class="flex items-center gap-3 flex-wrap p-3 rounded-lg bg-[#0f1825] border border-gray-700/60">
                        <span id="mermaPreviewBadge"></span>
                        <span class="text-[10px] text-gray-500 whitespace-nowrap">Fondo <code id="mermaPreviewBg" class="text-gray-300"></code> &middot; Texto <code id="mermaPreviewFg" class="text-gray-300"></code></span>
                    </div>`
            }
        ];
    }
}

// -- Motivos de ajuste --

class Ajustes extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Ajustes";
    }

    render() {
        this.filterBar();
        this.ls();
    }

    filterBar() {
        $("#container-ajustes").html(`
            <div id="filterbar-ajustes" class="mb-2"></div>
            <div id="tabla-ajustes" class="w-full"></div>
        `);

        this.createfilterBar({
            parent: "filterbar-ajustes",
            data: [
                {
                    opc: "select",
                    id: "estadoAjustes",
                    class: "col-12 col-md-2",
                    data: statusFilter(),
                    onchange: "ajustes.ls()"
                },
                {
                    opc: "button",
                    id: "btnNuevoAjuste",
                    class: "col-12 col-md-3",
                    text: "Nuevo Motivo",
                    onClick: () => this.add()
                }
            ]
        });
    }

    ls() {
        this.createTable({
            parent: "tabla-ajustes",
            idFilterBar: "filterbar-ajustes",
            data: { opc: "lsAdjustmentReasons", active: $("#estadoAjustes").val() },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: { id: "tbAjustes", theme: "dark", striped: true, center: [4] }
        });
    }

    add() {
        this.createModalForm({
            id: "formAjusteAdd",
            data: { opc: "addAdjustmentReason" },
            coffeesoft: true,
            theme: 'dark',
            bootbox: { title: "Nuevo Motivo de ajuste" },
            json: this.json(),
            success: (response) => afterSave(response, () => this.ls())
        });
    }

    async edit(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getAdjustmentReason", id: id } });

        this.createModalForm({
            id: "formAjusteEdit",
            data: { opc: "editAdjustmentReason", id: id },
            coffeesoft: true,
            theme: 'dark',
            bootbox: { title: "Editar Motivo de ajuste" },
            autofill: request.data,
            json: this.json(),
            success: (response) => afterSave(response, () => this.ls())
        });
    }

    status(id, active) {
        this.swalQuestion({
            opts: {
                title: "Cambiar estado del motivo",
                text: "Esta accion activara o desactivara el motivo.",
                icon: "warning"
            },
            data: { opc: "statusAdjustmentReason", active: active, id: id },
            methods: { send: () => this.ls() }
        });
    }

    json() {
        return [
            {
                opc: "input",
                id: "code",
                lbl: "Codigo (ej. MISSING)",
                class: "col-12 col-md-6 mb-3"
            },
            {
                opc: "input",
                id: "name",
                lbl: "Nombre",
                class: "col-12 col-md-6 mb-3"
            },
            {
                opc: "input",
                id: "color_hex",
                lbl: "Color (hex)",
                type: "color",
                class: "col-12 col-md-4 mb-3"
            },
            {
                opc: "input",
                id: "icon",
                lbl: "Icono",
                required: false,
                class: "col-12 col-md-4 mb-3"
            },
            {
                opc: "select",
                id: "affects_cost",
                lbl: "Afecta costo",
                class: "col-12 col-md-4 mb-3",
                data: [{ id: "0", valor: "No" }, { id: "1", valor: "Si" }]
            }
        ];
    }
}

// -- Estados de traspaso --

class Estados extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Estados";
    }

    render() {
        this.filterBar();
        this.ls();
    }

    filterBar() {
        $("#container-estados").html(`
            <div id="filterbar-estados" class="mb-2"></div>
            <div id="tabla-estados" class="w-full"></div>
        `);

        this.createfilterBar({
            parent: "filterbar-estados",
            data: [
                {
                    opc: "select",
                    id: "estadoEstados",
                    class: "col-12 col-md-2",
                    data: statusFilter(),
                    onchange: "estados.ls()"
                },
                {
                    opc: "button",
                    id: "btnNuevoEstado",
                    class: "col-12 col-md-3",
                    text: "Nuevo Estado",
                    onClick: () => this.add()
                }
            ]
        });
    }

    ls() {
        this.createTable({
            parent: "tabla-estados",
            idFilterBar: "filterbar-estados",
            data: { opc: "lsTransferStatuses", active: $("#estadoEstados").val() },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: { id: "tbEstados", theme: "dark", striped: true, center: [3, 4] }
        });
    }

    add() {
        this.createModalForm({
            id: "formEstadoAdd",
            data: { opc: "addTransferStatus" },
            coffeesoft: true,
            theme: 'dark',
            bootbox: { title: "Nuevo Estado de traspaso" },
            json: this.json(),
            success: (response) => afterSave(response, () => this.ls())
        });
    }

    async edit(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getTransferStatus", id: id } });

        this.createModalForm({
            id: "formEstadoEdit",
            data: { opc: "editTransferStatus", id: id },
            coffeesoft: true,
            theme: 'dark',
            bootbox: { title: "Editar Estado de traspaso" },
            autofill: request.data,
            json: this.json(),
            success: (response) => afterSave(response, () => this.ls())
        });
    }

    status(id, active) {
        this.swalQuestion({
            opts: {
                title: "Cambiar estado",
                text: "Esta accion activara o desactivara el estado de traspaso.",
                icon: "warning"
            },
            data: { opc: "statusTransferStatus", active: active, id: id },
            methods: { send: () => this.ls() }
        });
    }

    json() {
        return [
            {
                opc: "input",
                id: "code",
                lbl: "Codigo (ej. REQUESTED)",
                class: "col-12 col-md-6 mb-3"
            },
            {
                opc: "input",
                id: "name",
                lbl: "Nombre",
                class: "col-12 col-md-6 mb-3"
            },
            {
                opc: "input",
                id: "order_index",
                lbl: "Orden",
                tipo: "numero",
                class: "col-12 col-md-4 mb-3"
            },
            {
                opc: "input",
                id: "color_hex",
                lbl: "Color (hex)",
                type: "color",
                class: "col-12 col-md-4 mb-3"
            },
            {
                opc: "select",
                id: "is_terminal",
                lbl: "Estado terminal",
                class: "col-12 col-md-4 mb-3",
                data: [{ id: "0", valor: "No" }, { id: "1", valor: "Si" }]
            }
        ];
    }
}

// -- Helpers --

function statusFilter() {
    return [
        { id: "1", valor: "Activos" },
        { id: "0", valor: "Inactivos" },
        { id: "", valor: "Todos" }
    ];
}

function afterSave(response, reload) {
    if (response.status == 200) {
        alert({ icon: "success", text: response.message });
        if (typeof reload === "function") reload();
    } else {
        alert({ icon: "info", title: "Oops!...", text: response.message, btn1: true, btn1Text: "Ok" });
    }
}

// -- Simulador de badge --
// Espejo JS EXACTO de badge() en app/conf/_Utileria.php: el color es el FONDO y el texto
// se adapta (mismo matiz, mas claro y vivo). Mantener ambos en sync.

function badgeColors(hex) {
    hex = String(hex || "#9CA3AF").replace("#", "");
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    let l = (max + min) / 2, h = 0, s = 0;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === rn)      h = (gn - bn) / d + (gn < bn ? 6 : 0);
        else if (max === gn) h = (bn - rn) / d + 2;
        else                 h = (rn - gn) / d + 4;
        h /= 6;
    }
    s = Math.max(0.50, Math.min(0.85, s));
    l = Math.max(0.62, Math.min(0.92, l + 0.42));

    let tr, tg, tb;
    if (s === 0) {
        tr = tg = tb = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        tr = hue2rgb(p, q, h + 1 / 3);
        tg = hue2rgb(p, q, h);
        tb = hue2rgb(p, q, h - 1 / 3);
    }
    const hx = (n) => n.toString(16).padStart(2, "0").toUpperCase();
    return {
        r: r, g: g, b: b,
        bg: "#" + hex.toUpperCase(),
        fg: `#${hx(Math.round(tr * 255))}${hx(Math.round(tg * 255))}${hx(Math.round(tb * 255))}`
    };
}

function badgePreview(text, hex, degrade = 100) {
    const c = badgeColors(hex);
    const alpha = Math.max(0, Math.min(100, parseFloat(degrade) || 0)) / 100;
    const label = (text == null || text === "") ? "-" : text;
    return `<span class="text-[10px] font-semibold px-3 py-1 rounded" style="background:rgba(${c.r},${c.g},${c.b},${alpha});color:${c.fg};">${label}</span>`;
}
