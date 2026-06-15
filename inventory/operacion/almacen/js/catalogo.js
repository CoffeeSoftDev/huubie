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
        container.html('<div id="filterbar-category" class="mb-2"></div><div id="table-category"></div>');

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
                    class: "col-12 col-md-3",
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
                center: [2, 3]
            }
        });
    }

    async addCategory() {
        const warehouses = await this.getWarehouses();

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
            json: this.jsonCategory(warehouses),
            success: (response) => {
                if (response.status === 200) {
                    alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                    this.lsCategory();
                    products.reloadCategorias();
                } else {
                    alert({ icon: "error", text: response.message, btn1: true, btn1Text: "Ok" });
                }
            }
        });
    }

    async editCategory(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getCategory", id: id } });

        if (request.status === 200) {
            const warehouses = await this.getWarehouses();

            this.createModalForm({
                id: "formCategoryEdit",
                data: { opc: "editCategory", id: id },
                theme: 'light',
                coffeesoft: true,
                bootbox: { title: "Editar categoría", size: 'small', closeButton: true },
                autofill: request.data,
                json: this.jsonCategory(warehouses),
                success: (response) => {
                    if (response.status === 200) {
                        alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                        this.lsCategory();
                        products.reloadCategorias();
                    } else {
                        alert({ icon: "error", text: response.message, btn1: true, btn1Text: "Ok" });
                    }
                }
            });
        }
    }

    statusCategory(id, active) {
        const action = active === 1 ? "desactivar" : "activar";
        const actionTitle = active === 1 ? "Desactivar" : "Activar";

        this.swalQuestion({
            opts: { title: `¿${actionTitle} categoría?`, text: `Esta acción ${action}á la categoría`, icon: "warning" },
            data: { opc: "statusCategory", active: active === 1 ? 0 : 1, id: id },
            methods: {
                send: (response) => {
                    if (response.status === 200) {
                        alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                        this.lsCategory();
                        products.reloadCategorias();
                    } else {
                        alert({ icon: "error", text: response.message, btn1: true });
                    }
                }
            }
        });
    }

    // Carga los almacenes activos para el select del formulario
    async getWarehouses() {
        const request = await useFetch({ url: this._link, data: { opc: "lsWarehousesSelect" } });
        const warehouses = (request.status === 200 && request.data) ? request.data : [];
        return [{ id: "", valor: "Sin almacén" }, ...warehouses];
    }

    jsonCategory(warehouses) {
        return [
            {
                opc: "input",
                id: "name",
                lbl: "Nombre de la categoría",
                tipo: "texto",
                class: "col-12 mb-3",
                required: true
            },
            {
                opc: "select",
                id: "warehouse_id",
                lbl: "Almacén",
                class: "col-12 mb-3",
                data: warehouses
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
        container.html('<div id="filterbar-area" class="mb-2"></div><div id="table-area"></div>');

        this.createfilterBar({
            parent: "filterbar-area",
            data: [
                {
                    opc: "select",
                    id: "active",
                    lbl: "Estado",
                    class: "col-12 col-md-3",
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
                title: "Áreas del almacén",
                subtitle: "Espacios físicos del almacén",
                center: [2, 3]
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
                    alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                    this.lsArea();
                } else {
                    alert({ icon: "error", text: response.message, btn1: true, btn1Text: "Ok" });
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
                        alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                        this.lsArea();
                    } else {
                        alert({ icon: "error", text: response.message, btn1: true, btn1Text: "Ok" });
                    }
                }
            });
        }
    }

    statusArea(id, active) {
        const action = active === 1 ? "desactivar" : "activar";
        const actionTitle = active === 1 ? "Desactivar" : "Activar";

        this.swalQuestion({
            opts: { title: `¿${actionTitle} área?`, text: `Esta acción ${action}á el área`, icon: "warning" },
            data: { opc: "statusArea", active: active === 1 ? 0 : 1, id: id },
            methods: {
                send: (response) => {
                    if (response.status === 200) {
                        alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                        this.lsArea();
                    } else {
                        alert({ icon: "error", text: response.message, btn1: true });
                    }
                }
            }
        });
    }

    jsonArea() {
        return [
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
                class: "col-12 mb-3"
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
        container.html('<div id="filterbar-unit" class="mb-2"></div><div id="table-unit"></div>');

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
                    alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                    this.lsUnit();
                    products.reloadUnidades();
                } else {
                    alert({ icon: "error", text: response.message, btn1: true, btn1Text: "Ok" });
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
                        alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                        this.lsUnit();
                        products.reloadUnidades();
                    } else {
                        alert({ icon: "error", text: response.message, btn1: true, btn1Text: "Ok" });
                    }
                }
            });
        }
    }

    statusUnit(id, active) {
        const action = active === 1 ? "desactivar" : "activar";
        const actionTitle = active === 1 ? "Desactivar" : "Activar";

        this.swalQuestion({
            opts: { title: `¿${actionTitle} unidad?`, text: `Esta acción ${action}á la unidad`, icon: "warning" },
            data: { opc: "statusUnit", active: active === 1 ? 0 : 1, id: id },
            methods: {
                send: (response) => {
                    if (response.status === 200) {
                        alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                        this.lsUnit();
                        products.reloadUnidades();
                    } else {
                        alert({ icon: "error", text: response.message, btn1: true });
                    }
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
        container.html('<div id="filterbar-warehouse" class="mb-2"></div><div id="table-warehouse"></div>');

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
                center: [4, 5]
            }
        });
    }

    // Carga las areas activas para el select del formulario
    async getAreas() {
        const request = await useFetch({ url: this._link, data: { opc: "lsAreasSelect" } });
        const areas = (request.status === 200 && request.data) ? request.data : [];
        return [{ id: "", valor: "Sin área" }, ...areas];
    }

    // Carga las sucursales accesibles para el select del formulario
    async getBranches() {
        const request = await useFetch({ url: this._link, data: { opc: "lsBranchesSelect" } });
        return (request.status === 200 && request.data) ? request.data : [];
    }

    async addWarehouse() {
        const [areas, branches] = await Promise.all([this.getAreas(), this.getBranches()]);

        this.createModalForm({
            id: "formWarehouseAdd",
            data: { opc: "addWarehouse" },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: "Agregar almacén", size: 'small', closeButton: true },
            json: this.jsonWarehouse(areas, branches),
            success: (response) => {
                if (response.status === 200) {
                    alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                    this.lsWarehouse();
                } else {
                    alert({ icon: "error", text: response.message, btn1: true, btn1Text: "Ok" });
                }
            }
        });
    }

    async editWarehouse(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getWarehouse", id: id } });

        if (request.status === 200) {
            const [areas, branches] = await Promise.all([this.getAreas(), this.getBranches()]);

            this.createModalForm({
                id: "formWarehouseEdit",
                data: { opc: "editWarehouse", id: id },
                theme: 'light',
                coffeesoft: true,
                bootbox: { title: "Editar almacén", size: 'small', closeButton: true },
                autofill: request.data,
                json: this.jsonWarehouse(areas, branches),
                success: (response) => {
                    if (response.status === 200) {
                        alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                        this.lsWarehouse();
                    } else {
                        alert({ icon: "error", text: response.message, btn1: true, btn1Text: "Ok" });
                    }
                }
            });
        }
    }

    statusWarehouse(id, active) {
        const action = active === 1 ? "desactivar" : "activar";
        const actionTitle = active === 1 ? "Desactivar" : "Activar";

        this.swalQuestion({
            opts: { title: `¿${actionTitle} almacén?`, text: `Esta acción ${action}á el almacén`, icon: "warning" },
            data: { opc: "statusWarehouse", active: active === 1 ? 0 : 1, id: id },
            methods: {
                send: (response) => {
                    if (response.status === 200) {
                        alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                        this.lsWarehouse();
                    } else {
                        alert({ icon: "error", text: response.message, btn1: true });
                    }
                }
            }
        });
    }

    jsonWarehouse(areas, branches) {
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
                id: "warehouse_area_id",
                lbl: "Área",
                class: "col-12 col-md-6 mb-3",
                data: areas
            },
            {
                opc: "select",
                id: "is_default",
                lbl: "Almacén por defecto",
                class: "col-12 col-md-6 mb-3",
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
        container.html('<div id="filterbar-inflow" class="mb-2"></div><div id="table-inflow"></div>');

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
                    class: "col-12 col-md-3",
                    className: 'w-100',
                    id: "btnNewInflow",
                    text: "Nuevo origen",
                    onClick: () => this.addInflow()
                }
            ]
        });
    }

    lsInflow() {
        this.createTable({
            parent: "table-inflow",
            idFilterBar: "filterbar-inflow",
            data: { opc: "lsInflow" },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: "tbInflow",
                theme: "light",
                striped: true,
                title: "Orígenes de entrada",
                subtitle: "Clasificación del origen de las entradas al almacén",
                center: [ 3, 4]
            }
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
                    alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                    this.lsInflow();
                } else {
                    alert({ icon: "error", text: response.message, btn1: true, btn1Text: "Ok" });
                }
            }
        });
        wireBadgeSimulator("formInflowAdd");
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
                        alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                        this.lsInflow();
                    } else {
                        alert({ icon: "error", text: response.message, btn1: true, btn1Text: "Ok" });
                    }
                }
            });
            wireBadgeSimulator("formInflowEdit");
        }
    }

    statusInflow(id, active) {
        const action = active === 1 ? "desactivar" : "activar";
        const actionTitle = active === 1 ? "Desactivar" : "Activar";

        this.swalQuestion({
            opts: { title: `¿${actionTitle} origen?`, text: `Esta acción ${action}á el origen`, icon: "warning" },
            data: { opc: "statusInflow", active: active === 1 ? 0 : 1, id: id },
            methods: {
                send: (response) => {
                    if (response.status === 200) {
                        alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                        this.lsInflow();
                    } else {
                        alert({ icon: "error", text: response.message, btn1: true });
                    }
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
                opc: "input",
                id: "icon",
                lbl: "Icono",
                tipo: "texto",
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
        container.html('<div id="filterbar-shrinkage" class="mb-2"></div><div id="table-shrinkage"></div>');

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
                    class: "col-12 col-md-3",
                    className: 'w-100',
                    id: "btnNewShrinkage",
                    text: "Nuevo motivo",
                    onClick: () => this.addShrinkage()
                }
            ]
        });
    }

    lsShrinkage() {
        this.createTable({
            parent: "table-shrinkage",
            idFilterBar: "filterbar-shrinkage",
            data: { opc: "lsShrinkage" },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: "tbShrinkage",
                theme: "light",
                striped: true,
                title: "Motivos de salida",
                subtitle: "Razones de salida del almacén",
                center: [1, 3]
            }
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
                    alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                    this.lsShrinkage();
                } else {
                    alert({ icon: "error", text: response.message, btn1: true, btn1Text: "Ok" });
                }
            }
        });
        wireBadgeSimulator("formShrinkageAdd");
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
                        alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                        this.lsShrinkage();
                    } else {
                        alert({ icon: "error", text: response.message, btn1: true, btn1Text: "Ok" });
                    }
                }
            });
            wireBadgeSimulator("formShrinkageEdit");
        }
    }

    statusShrinkage(id, active) {
        const action = active === 1 ? "desactivar" : "activar";
        const actionTitle = active === 1 ? "Desactivar" : "Activar";

        this.swalQuestion({
            opts: { title: `¿${actionTitle} motivo?`, text: `Esta acción ${action}á el motivo`, icon: "warning" },
            data: { opc: "statusShrinkage", active: active === 1 ? 0 : 1, id: id },
            methods: {
                send: (response) => {
                    if (response.status === 200) {
                        alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                        this.lsShrinkage();
                    } else {
                        alert({ icon: "error", text: response.message, btn1: true });
                    }
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
                opc: "input",
                id: "icon",
                lbl: "Icono",
                tipo: "texto",
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
        container.html('<div id="filterbar-supplier" class="mb-2"></div><div id="table-supplier"></div>');

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
                    alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                    this.lsSupplier();
                } else {
                    alert({ icon: "error", text: response.message, btn1: true, btn1Text: "Ok" });
                }
            }
        });
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
                        alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                        this.lsSupplier();
                    } else {
                        alert({ icon: "error", text: response.message, btn1: true, btn1Text: "Ok" });
                    }
                }
            });
        }
    }

    statusSupplier(id, active) {
        const action = active === 1 ? "desactivar" : "activar";
        const actionTitle = active === 1 ? "Desactivar" : "Activar";

        this.swalQuestion({
            opts: { title: `¿${actionTitle} proveedor?`, text: `Esta acción ${action}á el proveedor`, icon: "warning" },
            data: { opc: "statusSupplier", active: active === 1 ? 0 : 1, id: id },
            methods: {
                send: (response) => {
                    if (response.status === 200) {
                        alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                        this.lsSupplier();
                    } else {
                        alert({ icon: "error", text: response.message, btn1: true });
                    }
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
                tipo: "texto",
                class: "col-12 col-md-6 mb-3",
                required: false

            },
            {
                opc: "input",
                id: "email",
                lbl: "Email",
                tipo: "texto",
                class: "col-12 mb-3",
                required: false

            }
        ];
    }
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
function badgePreview(text, fg, bg) {
    const label = (text == null || text === "") ? "-" : text;
    if (bg) {
        return `<span class="text-[10px] font-semibold px-3 py-1 rounded" style="background:${bg};color:${fg || "#475569"};">${label}</span>`;
    }
    const c = badgeColors(fg);
    return `<span class="text-[10px] font-semibold px-3 py-1 rounded" style="background:${c.bg};color:${c.fg};">${label}</span>`;
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
function wireBadgeSimulator(formId) {
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
            $badge.html(badgePreview(name, fg, bg));
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
