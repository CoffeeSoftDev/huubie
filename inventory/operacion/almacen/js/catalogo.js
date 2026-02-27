

class Catalogo extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "catalogo";
    }

    render() {
        this.layout();
        zone.lsZone();
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
            theme: "dark",
            type: "button",
            json: [
                {
                    id: "zonas",
                    tab: "Departamento",
                    lucideIcon: "building-2",
                    active: true,
                    onClick: () => zone.lsZone()
                },
                {
                    id: "categorias",
                    tab: "Presentación",
                    lucideIcon: "folder-tree",
                    class: "mb-1",
                   
                    onClick: () => category.lsCategory()
                },
                {
                    id: "areas",
                    tab: "Grupos",
                    lucideIcon: "map-pin",
                    onClick: () => area.lsArea()
                },
              
            ]
        });

        category.filterBarCategory();
        area.filterBarArea();
        zone.filterBarZone();

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
                    text: "Nueva Presentación",
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
                striped:true,
                title: "Lista de Categorías",
                subtitle: "Clasificación de materiales e insumos",
                center: [ 2, 3]
            }
        });
    }

    addCategory() {
        this.createModalForm({
            id: "formCategoryAdd",
            data: { opc: "addCategory" },
            bootbox: {
                title: "Agregar Categoría",
                size:'small',
                closeButton: true
            },
            json: this.jsonCategory(),
            success: (response) => {
                if (response.status === 200) {
                    alert({
                        icon: "success",
                        text: response.message,
                        timer: 1500,
                        showConfirmButton: false
                    });
                    this.lsCategory();
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });
                }
            }
        });
    }

    async editCategory(id) {
        const request = await useFetch({
            url: this._link,
            data: { opc: "getCategory", id: id }
        });

        if (request.status === 200) {
            const data = request.data;

            this.createModalForm({
                id: "formCategoryEdit",
                data: { opc: "editCategory", idcategoria: id },
                bootbox: {
                    title: "Editar Categoría",
                    size: 'small',
                    closeButton: true
                },
                autofill: data,
                json: this.jsonCategory(),
                success: (response) => {
                    if (response.status === 200) {
                        alert({
                            icon: "success",
                            text: response.message,
                            timer: 1500,
                            showConfirmButton: false
                        });
                        this.lsCategory();
                    } else {
                        alert({
                            icon: "error",
                            text: response.message,
                            btn1: true,
                            btn1Text: "Ok"
                        });
                    }
                }
            });
        }
    }

    statusCategory(id, active) {
        const action = active === 1 ? "desactivar" : "activar";
        const actionTitle = active === 1 ? "Desactivar" : "Activar";

        this.swalQuestion({
            opts: {
                title: `¿${actionTitle} Categoría?`,
                text: `Esta acción ${action}á la categoría`,
                icon: "warning"
            },
            data: {
                opc: "statusCategory",
              
                active: active === 1 ? 0 : 1,
                idcategoria: id,
            },
            methods: {
                send: (response) => {
                    if (response.status === 200) {
                        alert({
                            icon: "success",
                            text: response.message,
                            timer: 1500,
                            showConfirmButton: false
                        });
                        this.lsCategory();
                    } else {
                        alert({
                            icon: "error",
                            text: response.message,
                            btn1: true
                        });
                    }
                }
            }
        });
    }

    jsonCategory() {
        return [
            {
                opc: "input",
                id: "nombreCategoria",
                lbl: "Nombre de la Categoría",
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
                    opc      : "button",
                    class    : "col-12 col-md-2",
                    className: 'w-100',
                    id       : "btnNewArea",
                    text     : "Nuevo grupo",
                    onClick  : () => this.addArea()
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
               
                title: "Lista de Áreas",
                subtitle: "Espacios físicos del almacén",
                center: [2, 3]
            }
        });
    }

    addArea() {
        this.createModalForm({
            id: "formAreaAdd",
            data: { opc: "addArea" },
            bootbox: {
                title: "Agregar Área",
                size: 'small',
                closeButton: true
            },
            json: this.jsonArea(),
            success: (response) => {
                if (response.status === 200) {
                    alert({
                        icon: "success",
                        text: response.message,
                        timer: 1500,
                        showConfirmButton: false
                    });
                    this.lsArea();
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });
                }
            }
        });
    }

    async editArea(id) {
        const request = await useFetch({
            url: this._link,
            data: { opc: "getArea", id: id }
        });

        if (request.status === 200) {
            const data = request.data;

            console.log(data);
            this.createModalForm({
                id: "formAreaEdit",
                data: { opc: "editArea", idArea: id },
                bootbox: {
                    title: "Editar Área",
                    size: 'small',
                    closeButton: true
                },
                autofill: data,
                json: this.jsonArea(),
                success: (response) => {
                    if (response.status === 200) {
                        alert({
                            icon: "success",
                            text: response.message,
                            timer: 1500,
                            showConfirmButton: false
                        });
                        this.lsArea();
                    } else {
                        alert({
                            icon: "error",
                            text: response.message,
                            btn1: true,
                            btn1Text: "Ok"
                        });
                    }
                }
            });
        }
    }

    statusArea(id, active) {
        const action = active === 1 ? "desactivar" : "activar";
        const actionTitle = active === 1 ? "Desactivar" : "Activar";

        this.swalQuestion({
            opts: {
                title: `¿${actionTitle} Área?`,
                text: `Esta acción ${action}á el área`,
                icon: "warning"
            },
            data: {
                opc: "statusArea",
                active: active === 1 ? 0 : 1,
                idArea: id,
            },
            methods: {
                send: (response) => {
                    if (response.status === 200) {
                        alert({
                            icon: "success",
                            text: response.message,
                            timer: 1500,
                            showConfirmButton: false
                        });
                        this.lsArea();
                    } else {
                        alert({
                            icon: "error",
                            text: response.message,
                            btn1: true
                        });
                    }
                }
            }
        });
    }

    jsonArea() {
        return [
            {
                opc: "input",
                id: "nombre_area",
                lbl: "Nombre del Área",
                tipo: "texto",
                class: "col-12 mb-3",
                required: true
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
        const container = $("#container-zonas");
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
                    className:'w-100',
                    id: "btnNewZone",
                    text: "Nuevo departamento",
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
                // title: "Lista de Zonas",
                // subtitle: "Subdivisiones internas del almacén",
                center: [ 2, 3]
            }
        });
    }

    addZone() {
        this.createModalForm({
            id: "formZoneAdd",
            data: { opc: "addZone" },
            bootbox: {
                title: "Agregar departamento",
                size:'small',
                closeButton: true
            },
            json: this.jsonZone(),
            success: (response) => {
                if (response.status === 200) {
                    alert({
                        icon: "success",
                        text: response.message,
                        timer: 1500,
                        showConfirmButton: false
                    });
                    this.lsZone();
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });
                }
            }
        });
    }

    async editZone(id) {
        const request = await useFetch({
            url: this._link,
            data: { opc: "getZone", id: id }
        });

        if (request.status === 200) {
            const data = request.data;

            this.createModalForm({
                id: "formZoneEdit",
                data: { opc: "editZone", id_zona: id },
                bootbox: {
                    title: "Editar Zona",
                    size: 'small',
                    closeButton: true
                },
                autofill: data,
                json: this.jsonZone(),
                success: (response) => {
                    if (response.status === 200) {
                        alert({
                            icon: "success",
                            text: response.message,
                            timer: 1500,
                            showConfirmButton: false
                        });
                        this.lsZone();
                    } else {
                        alert({
                            icon: "error",
                            text: response.message,
                            btn1: true,
                            btn1Text: "Ok"
                        });
                    }
                }
            });
        }
    }

    statusZone(id, active) {
        const action = active === 1 ? "desactivar" : "activar";
        const actionTitle = active === 1 ? "Desactivar" : "Activar";

        this.swalQuestion({
            opts: {
                title: `¿${actionTitle} Departamento?`,
                text: `Esta acción ${action}á la Departamento`,
                icon: "warning"
            },
            data: {
                opc: "statusZone",
                active: active === 1 ? 0 : 1,
                id_zona: id,
            },
            methods: {
                send: (response) => {
                    if (response.status === 200) {
                        alert({
                            icon: "success",
                            text: response.message,
                            timer: 1500,
                            showConfirmButton: false
                        });
                        this.lsZone();
                    } else {
                        alert({
                            icon: "error",
                            text: response.message,
                            btn1: true
                        });
                    }
                }
            }
        });
    }

    jsonZone() {
        return [
            {
                opc: "input",
                id: "nombre_zona",
                lbl: "Nombre",
                tipo: "texto",
                class: "col-12 mb-3",
                required: true
            }
        ];
    }
}

class Negocio extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "negocio";
    }

    filterBarNegocio() {
        const container = $("#container-negocios");
        container.html('<div id="filterbar-negocio" class="mb-2"></div><div id="table-negocio"></div>');

        this.createfilterBar({
            parent: "filterbar-negocio",
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
                    onchange: "negocio.lsNegocio()"
                },
                {
                    opc: "button",
                    class: "col-12 col-md-3",
                    id: "btnNewNegocio",
                    text: "Nuevo Negocio",
                    onClick: () => this.addNegocio()
                }
            ]
        });
    }

    lsNegocio() {
        this.createTable({
            parent: "table-negocio",
            idFilterBar: "filterbar-negocio",
            data: { opc: "lsZone" },
            coffeesoft: true,
            conf: { datatable: true, pag: 15 },
            attr: {
                id: "tbNegocio",
                theme: "light",
                title: "Lista de Negocios",
                subtitle: "Unidades de negocio del sistema",
                center: [1, 2, 3]
            }
        });
    }

    addNegocio() {
        this.createModalForm({
            id: "formNegocioAdd",
            data: { opc: "addZone" },
            bootbox: {
                title: "Agregar Negocio",
                closeButton: true
            },
            json: this.jsonNegocio(),
            success: (response) => {
                if (response.status === 200) {
                    alert({
                        icon: "success",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Aceptar"
                    });
                    this.lsNegocio();
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });
                }
            }
        });
    }

    async editNegocio(id) {
        const request = await useFetch({
            url: this._link,
            data: { opc: "getZone", id: id }
        });

        if (request.status === 200) {
            const data = request.data;

            this.createModalForm({
                id: "formNegocioEdit",
                data: { opc: "editZone", id: id },
                bootbox: {
                    title: "Editar Negocio",
                    closeButton: true
                },
                autofill: data,
                json: this.jsonNegocio(),
                success: (response) => {
                    if (response.status === 200) {
                        alert({
                            icon: "success",
                            text: response.message,
                            btn1: true,
                            btn1Text: "Aceptar"
                        });
                        this.lsNegocio();
                    } else {
                        alert({
                            icon: "error",
                            text: response.message,
                            btn1: true,
                            btn1Text: "Ok"
                        });
                    }
                }
            });
        }
    }

    statusNegocio(id, active) {
        const action = active === 1 ? "desactivar" : "activar";
        const actionTitle = active === 1 ? "Desactivar" : "Activar";

        this.swalQuestion({
            opts: {
                title: `¿${actionTitle} Negocio?`,
                text: `Esta acción ${action}á el negocio`,
                icon: "warning"
            },
            data: {
                opc: "statusZone",
                id_zona: id,
                active: active === 1 ? 0 : 1
            },
            methods: {
                send: (response) => {
                    if (response.status === 200) {
                        alert({
                            icon: "success",
                            text: response.message,
                            btn1: true
                        });
                        this.lsNegocio();
                    } else {
                        alert({
                            icon: "error",
                            text: response.message,
                            btn1: true
                        });
                    }
                }
            }
        });
    }

    jsonNegocio() {
        return [
            {
                opc: "input",
                id: "nombre_zona",
                lbl: "Nombre del Negocio",
                tipo: "texto",
                class: "col-12 mb-3",
                required: true
            }
        ];
    }
}
