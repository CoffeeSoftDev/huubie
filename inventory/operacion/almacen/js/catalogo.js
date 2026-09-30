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
                title: "Categorías de insumos",
                subtitle: "Clasificación de materiales e insumos",
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

    addArea() {
        this.createModalForm({
            id: "formAreaAdd",
            data: { opc: "addArea" },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: "Agregar área", size: 'small', closeButton: true },
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
            }
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
                    text: "Nueva unidad",
                    onClick: () => this.addUnit()
                }
            ]
        });
    }

    lsUnit() {
        this.createTable({
            parent: "table-unit",
            idFilterBar: "filterbar-unit",
            data: { opc: "lsUnit" },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: "tbUnit",
                theme: "light",
                striped: true,
                title: "Unidades de medida",
                subtitle: "Unidades para capturar insumos (pza, kg, lt)",
                center: [3]
            }
        });
    }

    addUnit() {
        this.createModalForm({
            id: "formUnitAdd",
            data: { opc: "addUnit" },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: "Agregar unidad", size: 'small', closeButton: true },
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
                } else {
                    this.alertBox({ type: "warning", theme: "light", title: "No se pudo eliminar", detailHtml: (response && response.message) || "Inténtalo otra vez." });
                }
            }
        });
    }

    // El almacén ya no lleva Área: las áreas (anaqueles, refrigerador...) son del producto.
    jsonWarehouse(branches) {
        return [
            {
                opc: "input",
                id: "name",
                lbl: "Nombre del almacén",
                tipo: "texto",
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
        wireBadgeSimulator("formInflowAdd", "rounded-full");
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

    // Mismo selector que el Admin del Tenant (cs-icon-picker.js). No es un campo de
    // coffeeForm: se planta en el hueco #iconFieldWrap ya montado el modal, y el
    // `name` es lo que hace que el icono viaje en el FormData.
    mountIconField(formId, value) {
        const $wrap = $(`#${formId}`).find("#iconFieldWrap");
        if (!$wrap.length) return;

        $wrap.html(this.csIconField({
            id: "icon",
            name: "icon",
            value: value || "",
            inputClass: this.cfThemedClass(CF_CSS.input, "light")
        }));
        this.csIconFieldBind($wrap);
        if (typeof lucide !== "undefined") lucide.createIcons();
    }

    statusInflow(id, active) {
        const activar = active !== 1;

        this.alertBox({
            type:       activar ? "confirm" : "cancel",
            theme:      "light",
            title:      activar ? "¿Activar origen?" : "¿Desactivar origen?",
            detailHtml: `Esta acción ${activar ? "activará" : "desactivará"} el origen`,
            okLabel:    activar ? "Activar" : "Desactivar",
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

    jsonInflow() {
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
                lbl: "Nombre del origen",
                tipo: "texto",
                class: "col-12 col-md-8 mb-3",
                required: true
            },
            {
                opc: "select",
                id: "requires_supplier",
                lbl: "¿Requiere proveedor?",
                class: "col-12 col-md-6 mb-3",
                data: [
                    { id: "0", valor: "No" },
                    { id: "1", valor: "Sí" }
                ]
            },
            {
                // Hueco vacío: lo rellena mountIconField() con el selector de iconos.
                opc: "div",
                id: "iconFieldWrap",
                lbl: "Icono",
                class: "col-12 col-md-6 mb-3"
            },
            {
                opc: "input",
                id: "color_hex",
                lbl: "Color de texto",
                type: "color",
                class: "col-12 col-md-3 mb-3"
            },
            {
                opc: "input",
                id: "bg_hex",
                lbl: "Color de fondo",
                type: "color",
                class: "col-12 col-md-3 mb-3"
            },
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
        wireBadgeSimulator("formShrinkageAdd", "rounded-full");
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

        this.alertBox({
            type:       activar ? "confirm" : "cancel",
            theme:      "light",
            title:      activar ? "¿Activar motivo?" : "¿Desactivar motivo?",
            detailHtml: `Esta acción ${activar ? "activará" : "desactivará"} el motivo`,
            okLabel:    activar ? "Activar" : "Desactivar",
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

    jsonShrinkage() {
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
                lbl: "Nombre del motivo",
                tipo: "texto",
                class: "col-12 col-md-8 mb-3",
                required: true
            },
            {
                // Hueco vacío: lo rellena mountIconField() con el selector de iconos.
                opc: "div",
                id: "iconFieldWrap",
                lbl: "Icono",
                class: "col-12 col-md-6 mb-3"
            },
            {
                opc: "input",
                id: "color_hex",
                lbl: "Color de texto",
                type: "color",
                class: "col-12 col-md-3 mb-3"
            },
            {
                opc: "input",
                id: "bg_hex",
                lbl: "Color de fondo",
                type: "color",
                class: "col-12 col-md-3 mb-3"
            },
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

    lsTransferStatus() {
        this.createTable({
            parent: "table-transfer-status",
            idFilterBar: "filterbar-transfer-status",
            data: { opc: "lsTransferStatus" },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: "tbTransferStatus",
                theme: "light",
                striped: true,
                title: "Estados de traspaso",
                subtitle: "Etiquetas que ve el origen (envía) y el destino (recibe)",
                center: [4, 5, 6]
            }
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
            wireBadgeSimulator("formTransferStatusEdit");
        }
    }

    statusTransferStatus(id, active) {
        const activar = active !== 1;

        this.alertBox({
            type:       activar ? "confirm" : "cancel",
            theme:      "light",
            title:      activar ? "¿Activar estado?" : "¿Desactivar estado?",
            detailHtml: `Esta acción ${activar ? "activará" : "desactivará"} el estado de traspaso`,
            okLabel:    activar ? "Activar" : "Desactivar",
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

    jsonTransferStatus() {
        return [
            {
                opc: "input",
                id: "name",
                lbl: "Nombre global",
                tipo: "texto",
                class: "col-12 mb-3",
                required: true
            },
            {
                opc: "input",
                id: "name_out",
                lbl: "Como lo ve el origen (envía)",
                tipo: "texto",
                class: "col-12 col-md-6 mb-3"
            },
            {
                opc: "input",
                id: "name_in",
                lbl: "Como lo ve el destino (recibe)",
                tipo: "texto",
                class: "col-12 col-md-6 mb-3"
            },
            {
                opc: "input",
                id: "order_index",
                lbl: "Orden",
                type: "number",
                class: "col-12 col-md-4 mb-3"
            },
            {
                opc: "input",
                id: "color_hex",
                lbl: "Color de texto",
                type: "color",
                class: "col-12 col-md-4 mb-3"
            },
            {
                opc: "input",
                id: "bg_hex",
                lbl: "Color de fondo",
                type: "color",
                class: "col-12 col-md-4 mb-3"
            },
            badgePreviewField()
        ];
    }
}

// -- Helpers --

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
function badgePreview(text, fg, bg, radius = "rounded") {
    const label = (text == null || text === "") ? "-" : text;
    if (bg) {
        return `<span class="text-[10px] font-semibold px-3 py-1 ${radius}" style="background:${bg};color:${fg || "#475569"};">${label}</span>`;
    }
    const c = badgeColors(fg);
    return `<span class="text-[10px] font-semibold px-3 py-1 ${radius}" style="background:${c.bg};color:${c.fg};">${label}</span>`;
}

// Campo de vista previa del badge para inyectar en el json() de un form (theme light).
function badgePreviewField() {
    return {
        opc: "div",
        id: "badgePreview",
        class: "col-12 mb-3",
        html: `
            <label class="block text-[11px] font-medium text-gray-500 mb-1">Vista previa</label>
            <div class="flex items-center gap-3 flex-wrap p-3 rounded-lg bg-gray-50 border border-gray-200">
                <span id="badgePreviewBadge"></span>
                <span class="text-[10px] text-gray-500 whitespace-nowrap">Fondo <code id="badgePreviewBg" class="text-gray-700"></code> &middot; Texto <code id="badgePreviewFg" class="text-gray-700"></code></span>
            </div>`
    };
}

// Cablea la vista previa del badge: la actualiza al cambiar el color o el nombre.
// `radius` = el mismo redondeo que usa la tabla (rounded | rounded-full).
function wireBadgeSimulator(formId, radius = "rounded") {
    setTimeout(() => {
        const $form  = $("#" + formId);
        const $color = $form.find('[name="color_hex"], #color_hex').first();
        const $bgInp = $form.find('[name="bg_hex"], #bg_hex').first();
        const $name  = $form.find('[name="name"], #name').first();
        const $badge = $form.find("#badgePreviewBadge");
        const $bg    = $form.find("#badgePreviewBg");
        const $fg    = $form.find("#badgePreviewFg");
        if (!$color.length || !$badge.length) return;

        const render = () => {
            const fg   = $color.val() || "#475569";
            const bg   = $bgInp.length ? ($bgInp.val() || "#F1F5F9") : "";
            const name = ($name.val() || "Etiqueta").toString();
            $badge.html(badgePreview(name, fg, bg, radius));
            $bg.text(bg || "-");
            $fg.text(fg);
        };

        $color.off("input.sim change.sim").on("input.sim change.sim", render);
        $bgInp.off("input.sim change.sim").on("input.sim change.sim", render);
        $name.off("input.sim").on("input.sim", render);
        render();
    }, 30);
}

// El arranque del catalogo lo hace el orquestador almacen.js (index.php):
// declara las globales (cataloge, category, area, unit) e instancia/renderiza
// estas clases. Aqui solo se definen las clases para evitar la doble
// declaracion `let category` que rompia el parseo de catalogo.js.
