class Catalogo extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "catalogo";
    }

    render() {
        this.layout();
    }

    layout() {
        this.primaryLayout({
            parent: "container-catalogo",
            id: this.PROJECT_NAME,
            class: "w-full",
            card: {
                filterBar: { class: "w-full", id: `filterBar${this.PROJECT_NAME}` },
                // Sin h-full: el contenedor crece en vertical con la tabla; el scroll
                // vertical lo maneja #main__content del shell (mismo criterio que Productos).
                container: { class: "w-full", id: `container${this.PROJECT_NAME}` }
            }
        });

        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: "light",
            type: "button",
            json: [
            
            ]
        });

        category.filterBarCategory();
        unit.filterBarUnit();
        area.filterBarArea();
        warehouse.filterBarWarehouse();
        inflow.filterBarInflow();
        shrinkage.filterBarShrinkage();
        supplier.filterBarSupplier();
        transferStatus.filterBarTransferStatus();

        category.lsCategory();
    }
}

class Category extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "category";
    }

    filterBarCategory() {
        const container = $("#container-categorias");
        // El panel del tab es flex-col: la tabla toma el alto sobrante y scrollea sola.
        container.html('<div id="filterbar-category" class="mb-2 flex-shrink-0"></div><div id="table-category" class="flex-1 min-h-0 overflow-auto"></div>');

        this.createfilterBar({
            parent: "filterbar-category",
            data: [
                {
                    opc: "select",
                    id: "active",
                    lbl: "Estado",
                    class: "col-12 col-md-2",
                    data: [
                        { id: "1", valor: "Activos" },
                        { id: "0", valor: "Inactivos" }
                    ],
                    onchange: "category.lsCategory()"
                },
                {
                    opc: "button",
                    class: "col-12 col-md-2",
                    className: 'w-100',
                    id: "btnNewCategory",
                    color_btn: "primary",
                    text: "Nueva categoría",
                    onClick: () => this.addCategory()
                }
            ]
        });
    }

    lsCategory() {
        this.createTable({
            parent: "table-category",
            idFilterBar: "filterbar-category",
            data: { opc: "lsCategory" },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: "tbCategory",
                theme: "light",
                striped: true,
                title: "Categorías de productos",
                subtitle: "Clasificación de los productos del almacén",
                center: [2]
            }
        });
    }

    addCategory() {
        this.createModalForm({
            id: "formCategoryAdd",
            data: { opc: "addCategory" },
            theme: 'light',
            coffeesoft: true,
            bootbox: {
                title: "Agregar categoría",
                size: 'small',
                closeButton: true
            },
            json: this.jsonCategory(),
            success: (response) => {
                if (response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                    this.lsCategory();
                    products.reloadCategorias();
                } else {
                    this.alertBox({ type: "error", theme: "light", title: response.message });
                }
            }
        });
    }

    async editCategory(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getCategory", id: id } });

        if (request.status === 200) {
            this.createModalForm({
                id: "formCategoryEdit",
                data: { opc: "editCategory", id: id },
                theme: 'light',
                coffeesoft: true,
                bootbox: { title: "Editar categoría", size: 'small', closeButton: true },
                autofill: request.data,
                json: this.jsonCategory(),
                success: (response) => {
                    if (response.status === 200) {
                        this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                        this.lsCategory();
                        products.reloadCategorias();
                    } else {
                        this.alertBox({ type: "error", theme: "light", title: response.message });
                    }
                }
            });
        }
    }

    // Confirmación con alertBox, igual que Productos: desactivar en rojo ('cancel'), activar en 'confirm'.
    // Eliminar no va aquí: es un botón propio en las filas de Inactivos.
    statusCategory(id, active) {
        const activar = active !== 1;

        this.alertBox({
            type:       activar ? "confirm" : "cancel",
            theme:      "light",
            title:      activar ? "¿Activar categoría?" : "¿Desactivar categoría?",
            detailHtml: `Esta acción ${activar ? "activará" : "desactivará"} la categoría`,
            okLabel:    activar ? "Activar" : "Desactivar",
            onOk: async () => {
                const response = await useFetch({
                    url:  this._link,
                    data: { opc: "statusCategory", active: activar ? 1 : 0, id: id }
                });

                if (response && response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                    this.lsCategory();
                    products.reloadCategorias();
                } else {
                    this.alertBox({ type: "error", theme: "light", title: (response && response.message) || "No se pudo actualizar el estado" });
                }
            }
        });
    }

    // Los productos de la categoría no se borran: el servidor les deja la categoría en NULL.
    deleteCategory(id) {
        this.alertBox({
            type:       "cancel",
            theme:      "light",
            title:      "¿Eliminar categoría?",
            detailHtml: "Se borra para siempre. Los productos que la usan se quedan sin categoría.",
            okLabel:    "Eliminar",
            okBg:       "bg-red-600 hover:bg-red-700",
            onOk: async () => {
                const response = await useFetch({
                    url:  this._link,
                    data: { opc: "deleteCategory", id: id }
                });

                if (response && response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 2000 });
                    this.lsCategory();
                    products.reloadCategorias();
                } else {
                    this.alertBox({ type: "warning", theme: "light", title: "No se pudo eliminar", detailHtml: (response && response.message) || "Inténtalo otra vez." });
                }
            }
        });
    }

    // La categoría dice QUÉ es el producto; dónde se guarda lo dice el Área.
    jsonCategory() {
        return [
            {
                opc: "input",
                id: "name",
                lbl: "Nombre de la categoría",
                tipo: "texto",
                class: "col-12 mb-3",
                required: true
            }
        ];
    }
}

class Area extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "area";
    }

    filterBarArea() {
        const container = $("#container-areas");
        container.html('<div id="filterbar-area" class="mb-2 flex-shrink-0"></div><div id="table-area" class="flex-1 min-h-0 overflow-auto"></div>');

        this.createfilterBar({
            parent: "filterbar-area",
            data: [
                {
                    opc: "select",
                    id: "active",
                    lbl: "Estado",
                    class: "col-12 col-md-2",
                    data: [
                        { id: "1", valor: "Activos" },
                        { id: "0", valor: "Inactivos" }
                    ],
                    onchange: "area.lsArea()"
                },
                {
                    opc: "button",
                    class: "col-12 col-md-2",
                    className: 'w-100',
                    id: "btnNewArea",
                    color_btn: "primary",
                    text: "Nueva área",
                    onClick: () => this.addArea()
                }
            ]
        });
    }

    lsArea() {
        this.createTable({
            parent: "table-area",
            idFilterBar: "filterbar-area",
            data: { opc: "lsArea" },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: "tbArea",
                theme: "light",
                striped: true,
                title: "Áreas del almacén",
                subtitle: "Espacios físicos del almacén",
                center: [3, 4]
            }
        });
    }

    // `onCreated(id)`: el formulario de Productos la recibe ya con `areas` recargado.
    addArea(onCreated = null) {
        this.createModalForm({
            id: "formAreaAdd",
            data: { opc: "addArea" },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: "Agregar área", size: 'small', closeButton: true },
            json: this.jsonArea(),
            success: async (response) => {
                if (response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                    this.lsArea();
                    await products.reloadAreas();
                    if (onCreated) onCreated(response.id);
                } else {
                    this.alertBox({ type: "error", theme: "light", title: response.message });
                }
            }
        });

        wireBadgeSimulator("formAreaAdd", "rounded-full", true, true);
    }

    async editArea(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getArea", id: id } });

        if (request.status === 200) {
            this.createModalForm({
                id: "formAreaEdit",
                data: { opc: "editArea", id: id },
                theme: 'light',
                coffeesoft: true,
                bootbox: { title: "Editar área", size: 'small', closeButton: true },
                autofill: request.data,
                json: this.jsonArea(),
                success: (response) => {
                    if (response.status === 200) {
                        this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                        this.lsArea();
                        products.reloadAreas();
                    } else {
                        this.alertBox({ type: "error", theme: "light", title: response.message });
                    }
                }
            });

            wireBadgeSimulator("formAreaEdit", "rounded-full", false, true);
        }
    }

    statusArea(id, active) {
        const activar = active !== 1;

        this.alertBox({
            type:       activar ? "confirm" : "cancel",
            theme:      "light",
            title:      activar ? "¿Activar área?" : "¿Desactivar área?",
            detailHtml: `Esta acción ${activar ? "activará" : "desactivará"} el área`,
            okLabel:    activar ? "Activar" : "Desactivar",
            onOk: async () => {
                const response = await useFetch({
                    url:  this._link,
                    data: { opc: "statusArea", active: activar ? 1 : 0, id: id }
                });

                if (response && response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                    this.lsArea();
                    products.reloadAreas();
                } else {
                    this.alertBox({ type: "error", theme: "light", title: (response && response.message) || "No se pudo actualizar el estado" });
                }
            }
        });
    }

    // Los productos del área no se borran: el servidor les deja el área en NULL.
    deleteArea(id) {
        this.alertBox({
            type:       "cancel",
            theme:      "light",
            title:      "¿Eliminar área?",
            detailHtml: "Se borra para siempre. Los productos que la usan se quedan sin área.",
            okLabel:    "Eliminar",
            okBg:       "bg-red-600 hover:bg-red-700",
            onOk: async () => {
                const response = await useFetch({
                    url:  this._link,
                    data: { opc: "deleteArea", id: id }
                });

                if (response && response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 2000 });
                    this.lsArea();
                    products.reloadAreas();
                } else {
                    this.alertBox({ type: "warning", theme: "light", title: "No se pudo eliminar", detailHtml: (response && response.message) || "Inténtalo otra vez." });
                }
            }
        });
    }

    // El área es un lugar dentro de UN almacén: el nombre se puede repetir en otro almacén.
    jsonArea() {
        return [
            {
                opc: "select",
                id: "warehouse_id",
                lbl: "Almacén",
                class: "col-12 mb-3",
                data: almacenes,
                required: true
            },
            {
                opc: "input",
                id: "name",
                lbl: "Nombre del área",
                // tipo: "texto",
                class: "col-12 mb-3",
                required: true
            },
            {
                opc: "input",
                id: "description",
                lbl: "Descripción",
                // tipo: "texto",
                class: "col-12 mb-3",
                required: false
            },
            // Un solo color: el texto del badge; el fondo es su tono claro (areaTint).
            {
                opc: "input",
                id: "color_hex",
                lbl: "Color del badge",
                type: "color",
                class: "col-12 col-md-10 mb-3",
                required: false
            },
            badgeWandField(),
            badgePreviewField()
        ];
    }
}

class Unit extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "unit";
    }

    filterBarUnit() {
        const container = $("#container-unidades");
        container.html('<div id="filterbar-unit" class="mb-2 flex-shrink-0"></div><div id="table-unit" class="flex-1 min-h-0 overflow-auto"></div>');

        this.createfilterBar({
            parent: "filterbar-unit",
            data: [
                {
                    opc: "select",
                    id: "active",
                    lbl: "Estado",
                    class: "col-12 col-md-2",
                    data: [
                        { id: "1", valor: "Activos" },
                        { id: "0", valor: "Inactivos" }
                    ],
                    onchange: "unit.lsUnit()"
                },
                {
                    opc: "button",
                    class: "col-12 col-md-2",
                    className: 'w-100',
                    id: "btnNewUnit",
                    color_btn: "primary",
                    text: "Nueva unidad",
                    onClick: () => this.addUnit()
                }
            ]
        });
    }

    // Mismo formato que Motivos de salida: orden por arrastre, sin DataTable.
    lsUnit() {
        this.createTable({
            parent: "table-unit",
            idFilterBar: "filterbar-unit",
            data: { opc: "lsUnit" },
            coffeesoft: true,
            conf: { datatable: false },
            attr: {
                id: "tbUnit",
                theme: "light",
                striped: true,
                title: "Unidades de medida",
                subtitle: "Unidades para capturar insumos (pza, kg, lt)",
                center: [1, 4]
            },
            success: () => setTimeout(() => this.bindSortUnit(), 0)
        });
    }

    // `onCreated(id)`: el formulario de Productos la recibe ya con `unidades` recargado.
    addUnit(onCreated = null) {
        this.createModalForm({
            id: "formUnitAdd",
            data: { opc: "addUnit" },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: "Agregar unidad", size: 'small', closeButton: true },
            json: this.jsonUnit(),
            success: async (response) => {
                if (response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                    this.lsUnit();
                    await products.reloadUnidades();
                    if (onCreated) onCreated(response.id);
                } else {
                    this.alertBox({ type: "error", theme: "light", title: response.message });
                }
            }
        });
    }

    async editUnit(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getUnit", id: id } });

        if (request.status === 200) {
            this.createModalForm({
                id: "formUnitEdit",
                data: { opc: "editUnit", id: id },
                theme: 'light',
                coffeesoft: true,
                bootbox: { title: "Editar unidad", size: 'small', closeButton: true },
                autofill: request.data,
                json: this.jsonUnit(),
                success: (response) => {
                    if (response.status === 200) {
                        this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                        this.lsUnit();
                        products.reloadUnidades();
                    } else {
                        this.alertBox({ type: "error", theme: "light", title: response.message });
                    }
                }
            });
        }
    }

    // Eliminar no va aquí: es un botón propio en las filas de Inactivos.
    statusUnit(id, active) {
        const activar = active !== 1;

        this.alertBox({
            type:       activar ? "confirm" : "cancel",
            theme:      "light",
            title:      activar ? "¿Activar unidad?" : "¿Desactivar unidad?",
            detailHtml: `Esta acción ${activar ? "activará" : "desactivará"} la unidad`,
            okLabel:    activar ? "Activar" : "Desactivar",
            onOk: async () => {
                const response = await useFetch({
                    url:  this._link,
                    data: { opc: "statusUnit", active: activar ? 1 : 0, id: id }
                });

                if (response && response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                    this.lsUnit();
                    products.reloadUnidades();
                } else {
                    this.alertBox({ type: "error", theme: "light", title: (response && response.message) || "No se pudo actualizar el estado" });
                }
            }
        });
    }

    // Solo las activas se ordenan: ese orden es el de los selectores de Productos y Entradas.
    bindSortUnit() {
        if ($("#filterbar-unit #active").val() !== "1") return;
        sortableRows("tbUnit", (ids) => this.sortUnit(ids));
    }

    async sortUnit(ids) {
        const response = await useFetch({ url: this._link, data: { opc: "sortUnit", ids: JSON.stringify(ids) } });

        if (!response || response.status !== 200) {
            this.alertBox({ type: "error", theme: "light", title: (response && response.message) || "No se pudo guardar el orden" });
        }

        this.lsUnit();
        products.reloadUnidades();
    }

    // El servidor lo niega si algún producto o movimiento usa la unidad.
    deleteUnit(id) {
        this.alertBox({
            type:       "cancel",
            theme:      "light",
            title:      "¿Eliminar unidad?",
            detailHtml: "Se borra para siempre y no se puede deshacer.",
            okLabel:    "Eliminar",
            okBg:       "bg-red-600 hover:bg-red-700",
            onOk: async () => {
                const response = await useFetch({
                    url:  this._link,
                    data: { opc: "deleteUnit", id: id }
                });

                if (response && response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                    this.lsUnit();
                    products.reloadUnidades();
                } else {
                    this.alertBox({ type: "warning", theme: "light", title: "No se pudo eliminar", detailHtml: (response && response.message) || "Inténtalo otra vez." });
                }
            }
        });
    }

    jsonUnit() {
        return [
            {
                opc: "input",
                id: "code",
                lbl: "Código",
                tipo: "texto",
                class: "col-12 col-md-4 mb-3",
                required: true
            },
            {
                opc: "input",
                id: "name",
                lbl: "Nombre de la unidad",
                tipo: "texto",
                class: "col-12 col-md-8 mb-3",
                required: true
            }
        ];
    }
}

class Warehouse extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "warehouse";
    }

    filterBarWarehouse() {
        const container = $("#container-warehouses");
        container.html('<div id="filterbar-warehouse" class="mb-2 flex-shrink-0"></div><div id="table-warehouse" class="flex-1 min-h-0 overflow-auto"></div>');

        this.createfilterBar({
            parent: "filterbar-warehouse",
            data: [
                {
                    opc: "select",
                    id: "active",
                    lbl: "Estado",
                    class: "col-12 col-md-2",
                    data: [
                        { id: "1", valor: "Activos" },
                        { id: "0", valor: "Inactivos" }
                    ],
                    onchange: "warehouse.lsWarehouse()"
                },
                {
                    opc: "button",
                    class: "col-12 col-md-2",
                    className: 'w-100',
                    id: "btnNewWarehouse",
                    color_btn: "primary",
                    text: "Nuevo almacén",
                    onClick: () => this.addWarehouse()
                }
            ]
        });
    }

    lsWarehouse() {
        this.createTable({
            parent: "table-warehouse",
            idFilterBar: "filterbar-warehouse",
            data: { opc: "lsWarehouse" },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: "tbWarehouse",
                theme: "light",
                striped: true,
                title: "Almacenes",
                subtitle: "Almacenes físicos de la sucursal",
                center: [3, 4]
            }
        });
    }

    // Carga las sucursales accesibles para el select del formulario
    async getBranches() {
        const request = await useFetch({ url: this._link, data: { opc: "lsBranchesSelect" } });
        return (request.status === 200 && request.data) ? request.data : [];
    }

    async addWarehouse() {
        const branches = await this.getBranches();

        this.createModalForm({
            id: "formWarehouseAdd",
            data: { opc: "addWarehouse" },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: "Agregar almacén", size: 'small', closeButton: true },
            json: this.jsonWarehouse(branches),
            success: (response) => {
                if (response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                    this.lsWarehouse();
                    products.reloadAlmacenes();
                } else {
                    this.alertBox({ type: "error", theme: "light", title: response.message });
                }
            }
        });
    }

    async editWarehouse(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getWarehouse", id: id } });

        if (request.status === 200) {
            const branches = await this.getBranches();

            this.createModalForm({
                id: "formWarehouseEdit",
                data: { opc: "editWarehouse", id: id },
                theme: 'light',
                coffeesoft: true,
                bootbox: { title: "Editar almacén", size: 'small', closeButton: true },
                autofill: request.data,
                json: this.jsonWarehouse(branches),
                success: (response) => {
                    if (response.status === 200) {
                        this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                        this.lsWarehouse();
                        products.reloadAlmacenes();
                    } else {
                        this.alertBox({ type: "error", theme: "light", title: response.message });
                    }
                }
            });
        }
    }

    statusWarehouse(id, active) {
        const activar = active !== 1;

        this.alertBox({
            type:       activar ? "confirm" : "cancel",
            theme:      "light",
            title:      activar ? "¿Activar almacén?" : "¿Desactivar almacén?",
            detailHtml: `Esta acción ${activar ? "activará" : "desactivará"} el almacén`,
            okLabel:    activar ? "Activar" : "Desactivar",
            onOk: async () => {
                const response = await useFetch({
                    url:  this._link,
                    data: { opc: "statusWarehouse", active: activar ? 1 : 0, id: id }
                });

                if (response && response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                    this.lsWarehouse();
                    products.reloadAlmacenes();
                } else {
                    this.alertBox({ type: "error", theme: "light", title: (response && response.message) || "No se pudo actualizar el estado" });
                }
            }
        });
    }

    // El servidor lo niega si el almacén tiene stock, movimientos, órdenes o áreas.
    deleteWarehouse(id) {
        this.alertBox({
            type:       "cancel",
            theme:      "light",
            title:      "¿Eliminar almacén?",
            detailHtml: "Se borra para siempre y no se puede deshacer.",
            okLabel:    "Eliminar",
            okBg:       "bg-red-600 hover:bg-red-700",
            onOk: async () => {
                const response = await useFetch({
                    url:  this._link,
                    data: { opc: "deleteWarehouse", id: id }
                });

                if (response && response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                    this.lsWarehouse();
                    products.reloadAlmacenes();
                } else {
                    this.alertBox({ type: "warning", theme: "light", title: "No se pudo eliminar", detailHtml: (response && response.message) || "Inténtalo otra vez." });
                }
            }
        });
    }

    // El almacén ya no lleva Área: las áreas (anaqueles, refrigerador...) son del producto.
    // El nombre va sin tipo "texto": ese tipo borra los dígitos y hay almacenes como "Bodega 2".
    jsonWarehouse(branches) {
        return [
            {
                opc: "input",
                id: "name",
                lbl: "Nombre del almacén",
                class: "col-12 mb-3",
                required: true
            },
            {
                opc: "select",
                id: "branch_id",
                lbl: "Sucursal",
                class: "col-12 mb-3",
                data: branches,
                required: true
            },
            {
                opc: "select",
                id: "is_default",
                lbl: "Almacén por defecto",
                class: "col-12 mb-3",
                data: [
                    { id: "0", valor: "No" },
                    { id: "1", valor: "Sí" }
                ]
            }
        ];
    }
}

class InflowOrigin extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "inflow";
    }

    filterBarInflow() {
        const container = $("#container-inflows");
        container.html('<div id="filterbar-inflow" class="mb-2 flex-shrink-0"></div><div id="table-inflow" class="flex-1 min-h-0 overflow-auto"></div>');

        this.createfilterBar({
            parent: "filterbar-inflow",
            data: [
                {
                    opc: "select",
                    id: "active",
                    lbl: "Estado",
                    class: "col-12 col-md-2",
                    data: [
                        { id: "1", valor: "Activos" },
                        { id: "0", valor: "Inactivos" }
                    ],
                    onchange: "inflow.lsInflow()"
                },
                {
                    opc: "button",
                    class: "col-12 col-md-2",
                    className: 'w-100',
                    id: "btnNewInflow",
                    color_btn: "primary",
                    text: "Nuevo origen",
                    onClick: () => this.addInflow()
                }
            ]
        });
    }

    // Sin DataTable: el orden es manual (arrastre) y se ve la lista completa, sin páginas
    // ni orden por columna. `success` corre antes de pintar la tabla, por eso el arrastre
    // se engancha en el siguiente ciclo.
    lsInflow() {
        this.createTable({
            parent: "table-inflow",
            idFilterBar: "filterbar-inflow",
            data: { opc: "lsInflow" },
            coffeesoft: true,
            conf: { datatable: false },
            attr: {
                id: "tbInflow",
                theme: "light",
                striped: true,
                title: "Orígenes de entrada",
                subtitle: "Clasificación del origen de las entradas al almacén",
                center: [1, 3, 4, 5]
            },
            success: () => setTimeout(() => this.bindSortInflow(), 0)
        });
    }

    addInflow() {
        this.createModalForm({
            id: "formInflowAdd",
            data: { opc: "addInflow" },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: "Agregar origen", size: 'small', closeButton: true },
            json: this.jsonInflow(),
            success: (response) => {
                if (response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                    this.lsInflow();
                } else {
                    this.alertBox({ type: "error", theme: "light", title: response.message });
                }
            }
        });
        this.mountIconField("formInflowAdd");
        wireBadgeSimulator("formInflowAdd", "rounded-full", true);
    }

    async editInflow(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getInflow", id: id } });

        if (request.status === 200) {
            this.createModalForm({
                id: "formInflowEdit",
                data: { opc: "editInflow", id: id },
                theme: 'light',
                coffeesoft: true,
                bootbox: { title: "Editar origen", size: 'small', closeButton: true },
                autofill: request.data,
                json: this.jsonInflow(),
                success: (response) => {
                    if (response.status === 200) {
                        this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                        this.lsInflow();
                    } else {
                        this.alertBox({ type: "error", theme: "light", title: response.message });
                    }
                }
            });
            this.mountIconField("formInflowEdit", request.data ? request.data.icon : "");
            wireBadgeSimulator("formInflowEdit", "rounded-full");
        }
    }

    // Mismo selector que el Admin del Tenant (cs-icon-picker.js), en su forma compacta:
    // un recuadro antes del nombre que abre el selector con un clic. No es un campo de
    // coffeeForm: se planta junto a #name ya montado el modal, y el `name` del valor
    // oculto es lo que hace que el icono viaje en el FormData. Es obligatorio: con
    // `required`, cfValidateForm no deja guardar y el recuadro se pinta de rojo.
    // Fuera del Super Admin no se ve el nombre del icono, ni en el tooltip ni en el selector.
    mountIconField(formId, value) {
        const $name = $(`#${formId}`).find("#name");
        if (!$name.length) return;

        // La columna del nombre (label, input, error) pasa a rejilla: el recuadro y el
        // input comparten fila, y el error sigue como hermano del input, que es donde
        // cfValidateForm lo busca para el "El campo es requerido".
        const $col = $name.parent();
        $col.css({ display: "grid", gridTemplateColumns: "auto 1fr", columnGap: "8px" });
        $col.children("label, .tw-error").css("gridColumn", "1 / -1");

        $name.before(this.csIconField({
            id: "icon",
            name: "icon",
            value: value || "",
            showName: isSuperAdmin(),
            compact: true,
            required: true
        }));
        this.csIconFieldBind($col);
        if (typeof lucide !== "undefined") lucide.createIcons();
    }

    statusInflow(id, active) {
        const activar = active !== 1;
        const aviso   = activar
            ? { type: "confirm", title: "¿Activar origen?", detailHtml: "Esta acción activará el origen", okLabel: "Activar" }
            : deactivateAlert("Vas a dar de baja este origen: ya no aparecerá al registrar entradas.");

        this.alertBox({
            ...aviso,
            theme: "light",
            onOk: async () => {
                const response = await useFetch({
                    url:  this._link,
                    data: { opc: "statusInflow", active: activar ? 1 : 0, id: id }
                });

                if (response && response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                    this.lsInflow();
                } else {
                    this.alertBox({ type: "error", theme: "light", title: (response && response.message) || "No se pudo actualizar el estado" });
                }
            }
        });
    }

    // Solo los activos se ordenan: ese orden es el del selector de Entradas.
    bindSortInflow() {
        if ($("#filterbar-inflow #active").val() !== "1") return;
        sortableRows("tbInflow", (ids) => this.sortInflow(ids));
    }

    async sortInflow(ids) {
        const response = await useFetch({ url: this._link, data: { opc: "sortInflow", ids: JSON.stringify(ids) } });

        if (!response || response.status !== 200) {
            this.alertBox({ type: "error", theme: "light", title: (response && response.message) || "No se pudo guardar el orden" });
        }

        this.lsInflow();
    }

    // El servidor lo niega si alguna entrada usa el origen.
    deleteInflow(id) {
        this.alertBox({
            type:       "cancel",
            theme:      "light",
            title:      "¿Eliminar origen?",
            detailHtml: "Se borra para siempre y no se puede deshacer.",
            okLabel:    "Eliminar",
            okBg:       "bg-red-600 hover:bg-red-700",
            onOk: async () => {
                const response = await useFetch({
                    url:  this._link,
                    data: { opc: "deleteInflow", id: id }
                });

                if (response && response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                    this.lsInflow();
                } else {
                    this.alertBox({ type: "warning", theme: "light", title: "No se pudo eliminar", detailHtml: (response && response.message) || "Inténtalo otra vez." });
                }
            }
        });
    }

    // Sin campo Código: lo genera el servidor a partir del nombre (addInflow).
    jsonInflow() {
        return [
            {
                opc: "input",
                id: "name",
                lbl: "Nombre del origen",
                tipo: "texto",
                class: "col-12 mb-3",
                required: true
            },
            {
                opc: "select",
                id: "requires_supplier",
                lbl: "¿Requiere proveedor?",
                class: "col-12 mb-3",
                data: [
                    { id: "0", valor: "No" },
                    { id: "1", valor: "Sí" }
                ]
            },
            {
                opc: "input",
                id: "color_hex",
                lbl: "Color de texto",
                type: "color",
                class: "col-12 col-md-5 mb-3"
            },
            {
                opc: "input",
                id: "bg_hex",
                lbl: "Color de fondo",
                type: "color",
                class: "col-12 col-md-5 mb-3"
            },
            badgeWandField(),
            badgePreviewField()
        ];
    }
}

class ShrinkageReason extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "shrinkage";
    }

    filterBarShrinkage() {
        const container = $("#container-shrinkages");
        container.html('<div id="filterbar-shrinkage" class="mb-2 flex-shrink-0"></div><div id="table-shrinkage" class="flex-1 min-h-0 overflow-auto"></div>');

        this.createfilterBar({
            parent: "filterbar-shrinkage",
            data: [
                {
                    opc: "select",
                    id: "active",
                    lbl: "Estado",
                    class: "col-12 col-md-2",
                    data: [
                        { id: "1", valor: "Activos" },
                        { id: "0", valor: "Inactivos" }
                    ],
                    onchange: "shrinkage.lsShrinkage()"
                },
                {
                    opc: "button",
                    class: "col-12 col-md-2",
                    className: 'w-100',
                    id: "btnNewShrinkage",
                    color_btn: "primary",
                    text: "Nuevo motivo",
                    onClick: () => this.addShrinkage()
                }
            ]
        });
    }

    // Mismo formato que Orígenes de entrada: orden por arrastre, sin DataTable.
    lsShrinkage() {
        this.createTable({
            parent: "table-shrinkage",
            idFilterBar: "filterbar-shrinkage",
            data: { opc: "lsShrinkage" },
            coffeesoft: true,
            conf: { datatable: false },
            attr: {
                id: "tbShrinkage",
                theme: "light",
                striped: true,
                title: "Motivos de salida",
                subtitle: "Razones de salida del almacén",
                center: [1, 3, 4]
            },
            success: () => setTimeout(() => this.bindSortShrinkage(), 0)
        });
    }

    addShrinkage() {
        this.createModalForm({
            id: "formShrinkageAdd",
            data: { opc: "addShrinkage" },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: "Agregar motivo", size: 'small', closeButton: true },
            json: this.jsonShrinkage(),
            success: (response) => {
                if (response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                    this.lsShrinkage();
                } else {
                    this.alertBox({ type: "error", theme: "light", title: response.message });
                }
            }
        });
        inflow.mountIconField("formShrinkageAdd");
        wireBadgeSimulator("formShrinkageAdd", "rounded-full", true);
    }

    async editShrinkage(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getShrinkage", id: id } });

        if (request.status === 200) {
            this.createModalForm({
                id: "formShrinkageEdit",
                data: { opc: "editShrinkage", id: id },
                theme: 'light',
                coffeesoft: true,
                bootbox: { title: "Editar motivo", size: 'small', closeButton: true },
                autofill: request.data,
                json: this.jsonShrinkage(),
                success: (response) => {
                    if (response.status === 200) {
                        this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                        this.lsShrinkage();
                    } else {
                        this.alertBox({ type: "error", theme: "light", title: response.message });
                    }
                }
            });
            inflow.mountIconField("formShrinkageEdit", request.data ? request.data.icon : "");
            wireBadgeSimulator("formShrinkageEdit", "rounded-full");
        }
    }

    statusShrinkage(id, active) {
        const activar = active !== 1;
        const aviso   = activar
            ? { type: "confirm", title: "¿Activar motivo?", detailHtml: "Esta acción activará el motivo", okLabel: "Activar" }
            : deactivateAlert("Vas a dar de baja este motivo: ya no aparecerá al registrar salidas.");

        this.alertBox({
            ...aviso,
            theme: "light",
            onOk: async () => {
                const response = await useFetch({
                    url:  this._link,
                    data: { opc: "statusShrinkage", active: activar ? 1 : 0, id: id }
                });

                if (response && response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                    this.lsShrinkage();
                } else {
                    this.alertBox({ type: "error", theme: "light", title: (response && response.message) || "No se pudo actualizar el estado" });
                }
            }
        });
    }

    // Solo los activos se ordenan: ese orden es el del selector de Salidas.
    bindSortShrinkage() {
        if ($("#filterbar-shrinkage #active").val() !== "1") return;
        sortableRows("tbShrinkage", (ids) => this.sortShrinkage(ids));
    }

    async sortShrinkage(ids) {
        const response = await useFetch({ url: this._link, data: { opc: "sortShrinkage", ids: JSON.stringify(ids) } });

        if (!response || response.status !== 200) {
            this.alertBox({ type: "error", theme: "light", title: (response && response.message) || "No se pudo guardar el orden" });
        }

        this.lsShrinkage();
    }

    // El servidor lo niega si alguna salida usa el motivo.
    deleteShrinkage(id) {
        this.alertBox({
            type:       "cancel",
            theme:      "light",
            title:      "¿Eliminar motivo?",
            detailHtml: "Se borra para siempre y no se puede deshacer.",
            okLabel:    "Eliminar",
            okBg:       "bg-red-600 hover:bg-red-700",
            onOk: async () => {
                const response = await useFetch({
                    url:  this._link,
                    data: { opc: "deleteShrinkage", id: id }
                });

                if (response && response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                    this.lsShrinkage();
                } else {
                    this.alertBox({ type: "warning", theme: "light", title: "No se pudo eliminar", detailHtml: (response && response.message) || "Inténtalo otra vez." });
                }
            }
        });
    }

    // Sin campo Código: lo genera el servidor a partir del nombre (addShrinkage).
    jsonShrinkage() {
        return [
            {
                opc: "input",
                id: "name",
                lbl: "Nombre del motivo",
                tipo: "texto",
                class: "col-12 mb-3",
                required: true
            },
            {
                opc: "input",
                id: "color_hex",
                lbl: "Color de texto",
                type: "color",
                class: "col-12 col-md-5 mb-3"
            },
            {
                opc: "input",
                id: "bg_hex",
                lbl: "Color de fondo",
                type: "color",
                class: "col-12 col-md-5 mb-3"
            },
            badgeWandField(),
            badgePreviewField()
        ];
    }
}

class Supplier extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "supplier";
    }

    filterBarSupplier() {
        const container = $("#container-suppliers");
        container.html('<div id="filterbar-supplier" class="mb-2 flex-shrink-0"></div><div id="table-supplier" class="flex-1 min-h-0 overflow-auto"></div>');

        this.createfilterBar({
            parent: "filterbar-supplier",
            data: [
                {
                    opc: "select",
                    id: "active",
                    lbl: "Estado",
                    class: "col-12 col-md-2",
                    data: [
                        { id: "1", valor: "Activos" },
                        { id: "0", valor: "Inactivos" }
                    ],
                    onchange: "supplier.lsSupplier()"
                },
                {
                    opc: "button",
                    class: "col-12 col-md-2",
                    className: 'w-100',
                    id: "btnNewSupplier",
                    color_btn: "primary",
                    text: "Nuevo proveedor",
                    onClick: () => this.addSupplier()
                }
            ]
        });
    }

    lsSupplier() {
        this.createTable({
            parent: "table-supplier",
            idFilterBar: "filterbar-supplier",
            data: { opc: "lsSupplier" },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: "tbSupplier",
                theme: "light",
                striped: true,
                title: "Proveedores",
                subtitle: "Maestro de proveedores de la empresa",
                center: [5]
            }
        });
    }

    addSupplier() {
        this.createModalForm({
            id: "formSupplierAdd",
            data: { opc: "addSupplier" },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: "Agregar proveedor", size: 'small', closeButton: true },
            json: this.jsonSupplier(),
            success: (response) => {
                if (response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                    this.lsSupplier();
                } else {
                    this.alertBox({ type: "error", theme: "light", title: response.message });
                }
            }
        });
        this.mountSupplierFields("formSupplierAdd");
    }

    async editSupplier(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getSupplier", id: id } });

        if (request.status === 200) {
            this.createModalForm({
                id: "formSupplierEdit",
                data: { opc: "editSupplier", id: id },
                theme: 'light',
                coffeesoft: true,
                bootbox: { title: "Editar proveedor", size: 'small', closeButton: true },
                autofill: request.data,
                json: this.jsonSupplier(),
                success: (response) => {
                    if (response.status === 200) {
                        this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                        this.lsSupplier();
                    } else {
                        this.alertBox({ type: "error", theme: "light", title: response.message });
                    }
                }
            });
            this.mountSupplierFields("formSupplierEdit");
        }
    }

    // Iconos de contacto, teléfono y email. El teléfono son 10 dígitos: tipo "numero" ya
    // borra lo que no sea dígito; aquí se limita el largo y se alinea a la izquierda.
    mountSupplierFields(formId) {
        mountInputIcons(formId, { contact_name: "user", phone: "phone", email: "mail" });
        $(`#${formId} [name="phone"]`).attr({ maxlength: 10, inputmode: "numeric" }).removeClass("text-right");
    }

    statusSupplier(id, active) {
        const activar = active !== 1;

        this.alertBox({
            type:       activar ? "confirm" : "cancel",
            theme:      "light",
            title:      activar ? "¿Activar proveedor?" : "¿Desactivar proveedor?",
            detailHtml: `Esta acción ${activar ? "activará" : "desactivará"} el proveedor`,
            okLabel:    activar ? "Activar" : "Desactivar",
            onOk: async () => {
                const response = await useFetch({
                    url:  this._link,
                    data: { opc: "statusSupplier", active: activar ? 1 : 0, id: id }
                });

                if (response && response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                    this.lsSupplier();
                } else {
                    this.alertBox({ type: "error", theme: "light", title: (response && response.message) || "No se pudo actualizar el estado" });
                }
            }
        });
    }

    // El servidor lo niega si alguna entrada u orden de compra usa el proveedor.
    deleteSupplier(id) {
        this.alertBox({
            type:       "cancel",
            theme:      "light",
            title:      "¿Eliminar proveedor?",
            detailHtml: "Se borra para siempre y no se puede deshacer.",
            okLabel:    "Eliminar",
            okBg:       "bg-red-600 hover:bg-red-700",
            onOk: async () => {
                const response = await useFetch({
                    url:  this._link,
                    data: { opc: "deleteSupplier", id: id }
                });

                if (response && response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                    this.lsSupplier();
                } else {
                    this.alertBox({ type: "warning", theme: "light", title: "No se pudo eliminar", detailHtml: (response && response.message) || "Inténtalo otra vez." });
                }
            }
        });
    }

    jsonSupplier() {
        return [
            {
                opc: "input",
                id: "name",
                lbl: "Nombre del proveedor",
                tipo: "texto",
                class: "col-12 mb-3",
                required: true
            },
            {
                opc: "input",
                id: "contact_name",
                lbl: "Nombre de contacto",
                tipo: "texto",
                class: "col-12 col-md-6 mb-3",
                required: false
            },
            {
                opc: "input",
                id: "phone",
                lbl: "Teléfono",
                tipo: "numero",
                placeholder: "10 dígitos",
                class: "col-12 col-md-6 mb-3",
                required: false

            },
            {
                opc: "input",
                id: "email",
                lbl: "Email",
                tipo: "email",
                class: "col-12 mb-3",
                required: false

            }
        ];
    }
}

class TransferStatus extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "transferStatus";
    }

    filterBarTransferStatus() {
        const container = $("#container-transfer-status");
        container.html('<div id="filterbar-transfer-status" class="mb-2 flex-shrink-0"></div><div id="table-transfer-status" class="flex-1 min-h-0 overflow-auto"></div>');

        this.createfilterBar({
            parent: "filterbar-transfer-status",
            data: [
                {
                    opc: "select",
                    id: "active",
                    lbl: "Estado",
                    class: "col-12 col-md-2",
                    data: [
                        { id: "1", valor: "Activos" },
                        { id: "0", valor: "Inactivos" }
                    ],
                    onchange: "transferStatus.lsTransferStatus()"
                }
            ]
        });
    }

    // Mismo formato que Motivos de salida: orden por arrastre, sin DataTable. La columna
    // Código (solo Super Admin) va al final, así los índices de center no cambian.
    lsTransferStatus() {
        this.createTable({
            parent: "table-transfer-status",
            idFilterBar: "filterbar-transfer-status",
            data: { opc: "lsTransferStatus" },
            coffeesoft: true,
            conf: { datatable: false },
            attr: {
                id: "tbTransferStatus",
                theme: "light",
                striped: true,
                title: "Estados de traspaso",
                subtitle: "Texto que ve la sucursal que envía y la que recibe",
                center: [1, 5, 6]
            },
            success: () => setTimeout(() => this.bindSortTransferStatus(), 0)
        });
    }

    async editTransferStatus(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getTransferStatus", id: id } });

        if (request.status === 200) {
            this.createModalForm({
                id: "formTransferStatusEdit",
                data: { opc: "editTransferStatus", id: id },
                theme: 'light',
                coffeesoft: true,
                bootbox: { title: "Editar estado de traspaso", size: 'small', closeButton: true },
                autofill: request.data,
                json: this.jsonTransferStatus(),
                success: (response) => {
                    if (response.status === 200) {
                        this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                        this.lsTransferStatus();
                    } else {
                        this.alertBox({ type: "error", theme: "light", title: response.message });
                    }
                }
            });
            mountFieldHints("formTransferStatusEdit", {
                name_out: "La sucursal de donde sale la mercancía.",
                name_in:  "La sucursal a donde llega la mercancía."
            });
            wireBadgeSimulator("formTransferStatusEdit");
        }
    }

    statusTransferStatus(id, active) {
        const activar = active !== 1;
        const aviso   = activar
            ? { type: "confirm", title: "¿Activar estado?", detailHtml: "Esta acción activará el estado de traspaso", okLabel: "Activar" }
            : deactivateAlert("Vas a dar de baja este estado: dejará de mostrarse en Traspasos.");

        this.alertBox({
            ...aviso,
            theme: "light",
            onOk: async () => {
                const response = await useFetch({
                    url:  this._link,
                    data: { opc: "statusTransferStatus", active: activar ? 1 : 0, id: id }
                });

                if (response && response.status === 200) {
                    this.alertBox({ type: "success", theme: "light", title: response.message, timer: 1500 });
                    this.lsTransferStatus();
                } else {
                    this.alertBox({ type: "error", theme: "light", title: (response && response.message) || "No se pudo actualizar el estado" });
                }
            }
        });
    }

    // Solo los activos se ordenan: ese orden es el del filtro de estados de Traspasos.
    bindSortTransferStatus() {
        if ($("#filterbar-transfer-status #active").val() !== "1") return;
        sortableRows("tbTransferStatus", (ids) => this.sortTransferStatus(ids));
    }

    async sortTransferStatus(ids) {
        const response = await useFetch({ url: this._link, data: { opc: "sortTransferStatus", ids: JSON.stringify(ids) } });

        if (!response || response.status !== 200) {
            this.alertBox({ type: "error", theme: "light", title: (response && response.message) || "No se pudo guardar el orden" });
        }

        this.lsTransferStatus();
    }

    // name_out / name_in: cómo se llama el estado para la sucursal que envía y para la
    // que recibe (relativeStatusName en ctrl-traspasos). Vacíos, se usa el nombre general.
    // Sin campo Orden: se acomoda arrastrando la fila en la tabla.
    jsonTransferStatus() {
        return [
            {
                opc: "input",
                id: "name",
                lbl: "Nombre general",
                tipo: "texto",
                class: "col-12 mb-3",
                required: true
            },
            {
                opc: "label",
                id: "lblTransferNames",
                text: "Cada sucursal puede verlo con otro nombre. Si lo dejas vacío, ve el nombre general.",
                class: "col-12 pb-1 text-[11px] text-gray-500"
            },
            {
                opc: "input",
                id: "name_out",
                lbl: "Texto que ve quien envía",
                tipo: "texto",
                placeholder: "Ej. Enviado",
                class: "col-12 col-md-6 mb-3",
                required: false
            },
            {
                opc: "input",
                id: "name_in",
                lbl: "Texto que ve quien recibe",
                tipo: "texto",
                placeholder: "Ej. Por recibir",
                class: "col-12 col-md-6 mb-3",
                required: false
            },
            {
                opc: "input",
                id: "color_hex",
                lbl: "Color de texto",
                type: "color",
                class: "col-12 col-md-5 mb-3"
            },
            {
                opc: "input",
                id: "bg_hex",
                lbl: "Color de fondo",
                type: "color",
                class: "col-12 col-md-5 mb-3"
            },
            badgeWandField(),
            badgePreviewField()
        ];
    }
}

// -- Helpers --

// Bandera `superadmin` del init (ctrl-almacen y ctrl-catalogo usan la misma consulta de
// rol). La carga el orquestador almacen.js; sin él, el catálogo se ve como usuario normal.
function isSuperAdmin() {
    return typeof superAdmin !== "undefined" && superAdmin === true;
}

// Opciones de alertBox para "dar de baja": rojo y explícito, porque el registro sale de
// los selectores. `detail` dice qué deja de pasar; se completa con cómo deshacerlo.
function deactivateAlert(detail) {
    return {
        type:       "cancel",
        title:      "¡Cuidado!",
        detailHtml: `${detail}<br>Podrás reactivarlo desde <b>Inactivos</b>.`,
        okLabel:    "Sí, dar de baja",
        okBg:       "bg-red-600 hover:bg-red-700"
    };
}

// Orden manual: cada fila de la tabla se arrastra y se suelta en su nuevo lugar
// (mismo SortableJS que el Admin del Tenant). Los botones de la fila siguen
// respondiendo al clic. Al soltar entrega los ids en el nuevo orden; el id sale
// del id de la primera celda (createCoffeeTable3 la nombra `${columna}_${id}`).
function sortableRows(tableId, onSort) {
    const tbody = $(`#${tableId} tbody`);
    if (!tbody.length || typeof Sortable === "undefined") return;

    tbody.children("tr").addClass("cursor-grab");

    Sortable.create(tbody[0], {
        animation: 150,
        ghostClass: "opacity-40",
        filter: "a, button",
        preventOnFilter: false,
        onEnd: (evt) => {
            if (evt.oldIndex === evt.newIndex) return;
            const ids = tbody.children("tr").map((_, tr) => Number($(tr).children("td").first().attr("id").split("_").pop())).get();
            onSort(ids);
        }
    });
}

// Icono Lucide a la izquierda de inputs de un form de coffeeForm. `icons` = { name: "icono" }.
// El input trae px-3 y en inventory Bootstrap lo fuerza con !important: se cambia por
// valores arbitrarios para dejar hueco al icono. El aviso de error entra al envoltorio
// para que coffeeForm lo siga encontrando junto al input.
function mountInputIcons(formId, icons) {
    const $form = $(`#${formId}`);

    Object.keys(icons).forEach((name) => {
        const $input = $form.find(`[name="${name}"]`);
        if (!$input.length) return;

        const $error = $input.next(".tw-error");
        const $wrap  = $("<div>", { class: "relative" });

        $input.before($wrap).removeClass("px-3").addClass("pl-[36px] pr-[12px]");
        $wrap.append(
            $("<i>", { "data-lucide": icons[name], class: "w-4 h-4 text-gray-400 absolute left-3 top-[10px] pointer-events-none" }),
            $input,
            $error
        );
    });

    if (typeof lucide !== "undefined") lucide.createIcons();
}

// Nota corta debajo de inputs de un form de coffeeForm. `hints` = { name: "texto" }.
// Va al final del contenedor del input, después del aviso de error.
function mountFieldHints(formId, hints) {
    const $form = $(`#${formId}`);

    Object.keys(hints).forEach((name) => {
        const $input = $form.find(`input[name="${name}"]`);
        if (!$input.length) return;

        $input.parent().append($("<p>", { class: "mt-1 text-[11px] leading-snug text-gray-400", text: hints[name] }));
    });
}

// -- Selector de badge --
// Espejo JS de badge() en conf/_Utileria.php. Modelo de 2 colores: color_hex = texto,
// bg_hex = fondo. Si no hay bg_hex se cae al modelo clasico (el color es el fondo y el
// texto se deriva, via badgeColors). Mantener ambos en sync.

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

// Modelo de 2 colores: fg = color del texto, bg = color del fondo (espejo de badge() PHP).
// Si no se recibe bg, se cae al modelo clasico (el color es el fondo y el texto se deriva).
// `icon` = nombre lucide ya validado; va a la izquierda, igual que en la tabla.
function badgePreview(text, fg, bg, radius = "rounded", icon = "") {
    const label = (text == null || text === "") ? "-" : text;
    const ico   = icon ? `<i data-lucide="${icon}" class="w-3 h-3"></i> ` : "";
    const cls   = ico
        ? `inline-flex items-center gap-1 text-[10px] font-semibold px-3 py-1 ${radius}`
        : `text-[10px] font-semibold px-3 py-1 ${radius}`;

    if (bg) {
        return `<span class="${cls}" style="background:${bg};color:${fg || "#475569"};">${ico}${label}</span>`;
    }
    const c = badgeColors(fg);
    return `<span class="${cls}" style="background:${c.bg};color:${c.fg};">${ico}${label}</span>`;
}

// Campo de vista previa del badge para inyectar en el json() de un form (theme light).
// Los HEX solo los ve el Super Admin: al resto le basta ver cómo queda.
function badgePreviewField() {
    const hex = isSuperAdmin()
        ? `<span class="text-[10px] text-gray-500 whitespace-nowrap">Fondo <code id="badgePreviewBg" class="text-gray-700"></code> &middot; Texto <code id="badgePreviewFg" class="text-gray-700"></code></span>`
        : "";

    return {
        opc: "div",
        id: "badgePreview",
        class: "col-12 mb-3",
        html: `
            <label class="block text-[11px] font-medium text-gray-500 mb-1">Vista previa</label>
            <div class="flex items-center gap-3 flex-wrap p-3 rounded-lg bg-gray-50 border border-gray-200">
                <span id="badgePreviewBadge"></span>
                ${hex}
            </div>`
    };
}

// Varita junto a los colores: cada clic arma otra combinación al azar (la cablea
// wireBadgeSimulator). Va al final de la fila de colores; en móvil ocupa la fila y
// dice qué hace.
function badgeWandField() {
    return {
        opc: "div",
        id: "badgeWand",
        class: "col-12 col-md-2 mb-3 flex flex-col justify-end",
        html: `
            <button type="button" id="badgeWandBtn" title="Probar otra combinación de colores"
                class="w-full min-h-[27px] inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white text-gray-500 text-xs font-medium transition hover:border-blue-600 hover:text-blue-600">
                <i data-lucide="wand-sparkles" class="w-4 h-4"></i>
                <span class="md:hidden">Probar otra combinación</span>
            </button>`
    };
}

// Combinación al azar que siempre se lee bien. Dos estilos: suave (fondo pastel y texto
// oscuro del mismo tono, como la mayoría de los badges) o sólido (fondo intenso y texto
// blanco). Con `prevHue` el tono nuevo cae al menos 60° lejos del anterior, para que
// cada clic de la varita se note.
function randomBadgeCombo(prevHue) {
    const rnd = (min, max) => min + Math.random() * (max - min);
    const hue = prevHue == null ? rnd(0, 360) : (prevHue + rnd(60, 300)) % 360;

    if (Math.random() < 0.7) {
        const bg = hslToHex(hue, rnd(0.65, 0.9), rnd(0.9, 0.95));
        return { hue: hue, bg: bg, fg: readableHex(hue, rnd(0.6, 0.8), rnd(0.25, 0.32), bg) };
    }

    return { hue: hue, bg: readableHex(hue, rnd(0.55, 0.75), rnd(0.4, 0.5), "#FFFFFF"), fg: "#FFFFFF" };
}

// Oscurece el tono hasta que contraste AA (4.5:1) contra `other`. Los amarillos y verdes
// son los que más bajan: a la misma luminosidad se ven mucho más claros que un azul.
function readableHex(h, s, l, other) {
    let hex = hslToHex(h, s, l);

    while (l > 0.12 && contrastRatio(hex, other) < 4.5) {
        l -= 0.02;
        hex = hslToHex(h, s, l);
    }
    return hex;
}

// h en grados, s y l de 0 a 1.
function hslToHex(h, s, l) {
    const k  = (n) => (n + h / 30) % 12;
    const a  = s * Math.min(l, 1 - l);
    const f  = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    const hx = (x) => Math.round(x * 255).toString(16).padStart(2, "0").toUpperCase();

    return `#${hx(f(0))}${hx(f(8))}${hx(f(4))}`;
}

// Contraste WCAG entre dos HEX de 6 dígitos (1 = iguales, 21 = negro sobre blanco).
function contrastRatio(a, b) {
    const lum = (hex) => {
        const c = String(hex).replace("#", "").match(/../g).map((x) => {
            const v = parseInt(x, 16) / 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const la = lum(a), lb = lum(b);

    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Fondo del badge de un área: su color 85 % hacia blanco. Espejo de areaColors() en
// conf/_Utileria.php; mantener ambos en sync.
function areaTint(hex) {
    const n   = parseInt(String(hex || "#475569").replace("#", ""), 16);
    const mix = (c) => Math.round(c + (255 - c) * 0.85).toString(16).padStart(2, "0").toUpperCase();

    return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
}

// Cablea la vista previa del badge: la actualiza al cambiar el color, el nombre o el
// icono (el selector dispara `input` al elegir). `radius` = el mismo redondeo que usa
// la tabla (rounded | rounded-full). `randomColors` arranca con una combinación al azar
// (formularios de alta: el input color vacío pinta negro sobre negro). `tint` = modelo
// de un solo color (Área): color_hex es el texto y el fondo sale de areaTint().
function wireBadgeSimulator(formId, radius = "rounded", randomColors = false, tint = false) {
    setTimeout(() => {
        const $form  = $("#" + formId);
        const $color = $form.find('[name="color_hex"], #color_hex').first();
        const $bgInp = $form.find('[name="bg_hex"], #bg_hex').first();
        const $name  = $form.find('[name="name"], #name').first();
        const $icon  = $form.find('[name="icon"]').first();
        const $badge = $form.find("#badgePreviewBadge");
        const $bg    = $form.find("#badgePreviewBg");
        const $fg    = $form.find("#badgePreviewFg");
        if (!$color.length || !$badge.length) return;

        const render = () => {
            const fg   = $color.val() || "#475569";
            const bg   = $bgInp.length ? ($bgInp.val() || "#F1F5F9") : (tint ? areaTint(fg) : "");
            const name = ($name.val() || "Etiqueta").toString();
            const icon = String($icon.val() || "").trim();
            const ok   = icon !== "" && typeof csIconExists === "function" && csIconExists(icon);

            $badge.html(badgePreview(name, fg, bg, radius, ok ? icon : ""));
            if (ok) csIconRender($badge[0]);
            $bg.text(bg || "-");
            $fg.text(fg);
        };

        // Varita: escribe la combinación en los dos inputs color, así viaja al guardar.
        // En modo `tint` solo hay un color: un tono oscuro que se lee sobre su fondo claro.
        let hue = null;
        const shuffle = () => {
            const combo = randomBadgeCombo(hue);
            hue = combo.hue;
            $color.val(tint ? readableHex(hue, 0.7, 0.4, "#FFFFFF") : combo.fg);
            $bgInp.val(combo.bg);
            render();
        };

        $color.off("input.sim change.sim").on("input.sim change.sim", render);
        $bgInp.off("input.sim change.sim").on("input.sim change.sim", render);
        $name.off("input.sim").on("input.sim", render);
        $icon.off("input.sim").on("input.sim", render);
        // La varita toma el alto del input color, que es más bajo que un input de texto.
        const $wand = $form.find("#badgeWandBtn");
        if ($color.outerHeight()) $wand.css("height", $color.outerHeight());
        $wand.off("click.sim").on("click.sim", shuffle);
        if (typeof lucide !== "undefined") lucide.createIcons();

        if (randomColors && ($bgInp.length || tint)) shuffle();
        else render();
    }, 30);
}

// El arranque del catalogo lo hace el orquestador almacen.js (index.php):
// declara las globales (cataloge, category, area, unit) e instancia/renderiza
// estas clases. Aqui solo se definen las clases para evitar la doble
// declaracion `let category` que rompia el parseo de catalogo.js.
