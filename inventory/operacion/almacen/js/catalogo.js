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
            parent: "root",
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
            theme: "dark",
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
                }
            ]
        });

        category.filterBarCategory();
        zone.filterBarZone();
        area.filterBarArea();

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

const apiCatalogo = 'ctrl/ctrl-catalogo.php';
let catalogo, category, area, zone;

$(() => {
    catalogo = new Catalogo(apiCatalogo, 'root');
    category = new Category(apiCatalogo, 'root');
    area     = new Area(apiCatalogo, 'root');
    zone     = new Zone(apiCatalogo, 'root');
    catalogo.render();
});
