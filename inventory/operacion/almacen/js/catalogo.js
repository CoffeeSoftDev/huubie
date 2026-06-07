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
                container: { class: "w-full h-full", id: `container${this.PROJECT_NAME}` }
            }
        });

        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: "light",
            type: "button",
            json: [
                {
                    id: "categorias",
                    tab: "Categoría",
                    lucideIcon: "folder-tree",
                    active: true,
                    onClick: () => category.lsCategory()
                },
                {
                    id: "unidades",
                    tab: "Unidad",
                    lucideIcon: "ruler",
                    class: "mb-1",
                    onClick: () => zone.lsZone()
                },
                {
                    id: "areas",
                    tab: "Área",
                    lucideIcon: "map-pin",
                    onClick: () => area.lsArea()
                },
                {
                    id: "warehouses",
                    tab: "Almacenes",
                    lucideIcon: "warehouse",
                    onClick: () => warehouse.lsWarehouse()
                },
                {
                    id: "inflows",
                    tab: "Origen entradas",
                    lucideIcon: "log-in",
                    onClick: () => inflow.lsInflow()
                },
                {
                    id: "shrinkages",
                    tab: "Motivos salida",
                    lucideIcon: "log-out",
                    onClick: () => shrinkage.lsShrinkage()
                }
            ]
        });

        category.filterBarCategory();
        zone.filterBarZone();
        area.filterBarArea();
        warehouse.filterBarWarehouse();
        inflow.filterBarInflow();
        shrinkage.filterBarShrinkage();

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
                tipo: "texto",
                class: "col-12 mb-3",
                required: true
            },
            {
                opc: "input",
                id: "description",
                lbl: "Descripción",
                tipo: "texto",
                class: "col-12 mb-3"
            }
        ];
    }
}

class Zone extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "zone";
    }

    filterBarZone() {
        const container = $("#container-unidades");
        container.html('<div id="filterbar-zone" class="mb-2"></div><div id="table-zone"></div>');

        this.createfilterBar({
            parent: "filterbar-zone",
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
                    onchange: "zone.lsZone()"
                },
                {
                    opc: "button",
                    class: "col-12 col-md-2",
                    className: 'w-100',
                    id: "btnNewZone",
                    text: "Nueva unidad",
                    onClick: () => this.addZone()
                }
            ]
        });
    }

    lsZone() {
        this.createTable({
            parent: "table-zone",
            idFilterBar: "filterbar-zone",
            data: { opc: "lsZone" },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: "tbZone",
                theme: "light",
                title: "Unidades de medida",
                subtitle: "Unidades para capturar insumos (pza, kg, lt)",
                center: [3]
            }
        });
    }

    addZone() {
        this.createModalForm({
            id: "formZoneAdd",
            data: { opc: "addZone" },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: "Agregar unidad", size: 'small', closeButton: true },
            json: this.jsonZone(),
            success: (response) => {
                if (response.status === 200) {
                    alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                    this.lsZone();
                } else {
                    alert({ icon: "error", text: response.message, btn1: true, btn1Text: "Ok" });
                }
            }
        });
    }

    async editZone(id) {
        const request = await useFetch({ url: this._link, data: { opc: "getZone", id: id } });

        if (request.status === 200) {
            this.createModalForm({
                id: "formZoneEdit",
                data: { opc: "editZone", id: id },
                theme: 'light',
                coffeesoft: true,
                bootbox: { title: "Editar unidad", size: 'small', closeButton: true },
                autofill: request.data,
                json: this.jsonZone(),
                success: (response) => {
                    if (response.status === 200) {
                        alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                        this.lsZone();
                    } else {
                        alert({ icon: "error", text: response.message, btn1: true, btn1Text: "Ok" });
                    }
                }
            });
        }
    }

    statusZone(id, active) {
        const action = active === 1 ? "desactivar" : "activar";
        const actionTitle = active === 1 ? "Desactivar" : "Activar";

        this.swalQuestion({
            opts: { title: `¿${actionTitle} unidad?`, text: `Esta acción ${action}á la unidad`, icon: "warning" },
            data: { opc: "statusZone", active: active === 1 ? 0 : 1, id: id },
            methods: {
                send: (response) => {
                    if (response.status === 200) {
                        alert({ icon: "success", text: response.message, timer: 1500, showConfirmButton: false });
                        this.lsZone();
                    } else {
                        alert({ icon: "error", text: response.message, btn1: true });
                    }
                }
            }
        });
    }

    jsonZone() {
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
                center: [3, 4]
            }
        });
    }

    // Carga las areas activas para el select del formulario
    async getAreas() {
        const request = await useFetch({ url: this._link, data: { opc: "lsAreasSelect" } });
        const areas = (request.status === 200 && request.data) ? request.data : [];
        return [{ id: "", valor: "Sin área" }, ...areas];
    }

    async addWarehouse() {
        const areas = await this.getAreas();

        this.createModalForm({
            id: "formWarehouseAdd",
            data: { opc: "addWarehouse" },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: "Agregar almacén", size: 'small', closeButton: true },
            json: this.jsonWarehouse(areas),
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
            const areas = await this.getAreas();

            this.createModalForm({
                id: "formWarehouseEdit",
                data: { opc: "editWarehouse", id: id },
                theme: 'light',
                coffeesoft: true,
                bootbox: { title: "Editar almacén", size: 'small', closeButton: true },
                autofill: request.data,
                json: this.jsonWarehouse(areas),
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

    jsonWarehouse(areas) {
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
                lbl: "Color (hex)",
                type: "color",
                class: "col-12 col-md-6 mb-3"
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
                lbl: "Color (hex)",
                type: "color",
                class: "col-12 col-md-6 mb-3"
            },
            badgePreviewField()
        ];
    }
}

// -- Selector de badge --
// Espejo JS EXACTO de badge() en app/conf/_Utileria.php: el color es el FONDO y el
// texto se adapta (mismo matiz, mas claro y vivo). Mantener ambos en sync.

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
        const $name  = $form.find('[name="name"], #name').first();
        const $badge = $form.find("#badgePreviewBadge");
        const $bg    = $form.find("#badgePreviewBg");
        const $fg    = $form.find("#badgePreviewFg");
        if (!$color.length || !$badge.length) return;

        const render = () => {
            const hex  = $color.val() || "#9CA3AF";
            const name = ($name.val() || "Etiqueta").toString();
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

// El arranque del catalogo lo hace el orquestador almacen.js (index.php):
// declara las globales (cataloge, category, area, zone) e instancia/renderiza
// estas clases. Aqui solo se definen las clases para evitar la doble
// declaracion `let category` que rompia el parseo de catalogo.js.
