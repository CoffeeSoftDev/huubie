let api = 'config/ctrl/ctrl-config.php';
let app, companies, customers, modules, adminUsers;
let lsCustomersData, lsCompaniesData, lsModulesData;

$(async () => {
    const data = await useFetch({ url: api, data: { opc: "init" } });
    lsCustomersData = data.customers;
    lsCompaniesData = data.companies;
    lsModulesData   = data.modules;

    app        = new App(api, "root");
    companies  = new Companies(api, "root");
    customers  = new Customers(api, "root");
    modules    = new Modules(api, "root");
    adminUsers = new AdminUsers(api, "root");

    app.render();
});

class App extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Config";
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
                class: 'w-full min-h-screen p-4',
                container: [
                    {
                        type: 'div',
                        id: `container${this.PROJECT_NAME}`,
                        class: 'w-full bg-[#1F2A37] rounded-lg p-3 min-h-screen',
                        children: [
                            {
                                id: 'titleConfig',
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

        $("#titleConfig").html(`
            <h2 class="text-2xl font-semibold text-white">Administrador del Sistema</h2>
            <p class="text-gray-400">Gestiona empresas, clientes, módulos y usuarios de fayxzvov_admin.</p>
        `);
    }

    renderTabs() {
        this.tabLayout({
            parent: `tabs${this.PROJECT_NAME}`,
            id: `tabsLayout${this.PROJECT_NAME}`,
            theme: "dark",
            type: "short",
            showBorder: false,
            json: [
                {
                    id: "tab-companies",
                    tab: "Empresas",
                    lucideIcon: "building-2",
                    iconColor: "text-white",
                    active: true,
                    onClick: () => companies.render()
                },
                {
                    id: "tab-customers",
                    tab: "Clientes",
                    lucideIcon: "contact",
                    iconColor: "text-white",
                    onClick: () => customers.render()
                },
                {
                    id: "tab-modules",
                    tab: "Módulos",
                    lucideIcon: "layout-dashboard",
                    iconColor: "text-white",
                    onClick: () => modules.render()
                },
                {
                    id: "tab-admin-users",
                    tab: "Usuarios Admin",
                    lucideIcon: "shield-check",
                    iconColor: "text-white",
                    onClick: () => adminUsers.render()
                },
            ],
        });
    }

    renderActiveTab() {
        companies.render();
    }
}

// Companies

class Companies extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Companies";
    }

    render() {
        this.layout();
    }

    layout() {
        const container = $("#container-tab-companies");
        container.html('<div id="filterbar-companies" class="mb-2"></div><div id="tabla-companies"></div>');

        this.createfilterBar({
            parent: "filterbar-companies",
            data: [
                {
                    opc: "select",
                    id: "enabledCompany",
                    class: "col-12 col-md-3",
                    data: [
                        { id: "1", valor: "Activos" },
                        { id: "0", valor: "Inactivos" }
                    ],
                    onchange: 'companies.ls()'
                },
                {
                    opc: "button",
                    class: "col-12 col-md-3",
                    id: "btnNuevaEmpresa",
                    text: "Nueva Empresa",
                    onClick: () => this.add(),
                },
            ],
        });

        this.ls();
    }

    json() {
        return [
            {
                opc: "input",
                lbl: "Razón Social(Nombre)",
                id: "social_name",
                tipo: "texto",
                class: "col-12 col-sm-6 mb-3"
            },
            {
                opc: "input",
                lbl: "RFC",
                id: "rfc",
                class: "col-12 col-sm-6 mb-3"
            },
            {
                opc: "input",
                lbl: "Dirección",
                id: "address",
                class: "col-12 col-sm-6 mb-3",
                required: false
            },
            {
                opc: "input",
                lbl: "Ubicación",
                id: "ubication",
                class: "col-12 col-sm-6 mb-3",
                required: false
            },
            {
                opc: "input",
                lbl: "Teléfono",
                id: "phone",
                tipo: "tel",
                class: "col-12 col-sm-6 mb-3",
                required: false
            },
            {
                opc: "input",
                lbl: "Nombre BD",
                id: "name_bd",
                class: "col-12 col-sm-6 mb-3",
                required: false
            },
            {
                opc: "select",
                lbl: "Cliente",
                id: "customers_id",
                class: "col-12 col-sm-6 mb-3",
                data: lsCustomersData
            },
            {
                opc: "div",
                class:'col-12'
            }
        ];
    }

    ls() {
        this.createTable({
            parent: "tabla-companies",
            idFilterBar: "filterbar-companies",
            coffeesoft: true,
            data: { opc: "lsCompanies", enabled: $('#enabledCompany').val() || '1' },
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbCompanies",
                theme: 'dark',
                title: 'Empresas',
                subtitle: 'fayxzvov_admin.companies',
            },
        });
    }

    add() {
        this.createModalForm({
            id: "formModalCompany",
            data: { opc: "addCompany" },
            bootbox: { title: "<strong>Nueva Empresa</strong>" },
            json: this.json(),
            success: (res) => {
                if (res.status === 200) {
                    alert({ icon: 'success', text: res.message });
                    this.ls();
                } else {
                    alert({ icon: 'error', title: 'Oops...', text: res.message, btn1: true, btn1Text: 'Ok' });
                }
            },
        });
    }

    async edit(id) {
        const res = await useFetch({ url: this._link, data: { opc: "getCompany", id } });

        this.createModalForm({
            id: "formModalCompany",
            data: { opc: "editCompany", id },
            bootbox: { title: "<strong>Editar Empresa</strong>" },
            autofill: res.data,
            json: this.json(),
            success: (res) => {
                if (res.status === 200) {
                    alert({ icon: 'success', text: res.message });
                    this.ls();
                } else {
                    alert({ icon: 'error', title: 'Oops...', text: res.message, btn1: true, btn1Text: 'Ok' });
                }
            },
        });
    }

    toggleStatus(id, enabled) {
        let tr = $(event.target).closest("tr");
        let title = tr.find("td").eq(0).text();
        let accion = enabled == 1 ? "activar" : "desactivar";

        this.swalQuestion({
            opts: {
                title: `¿Deseas ${accion} la empresa ${title}?`
            },
            data: {
                opc: "toggleStatusCompany",
                enabled: enabled,
                id: id,
            },
            methods: {
                request: (response) => {
                    if (response.status == 200) {
                        alert({ icon: "success", text: response.message });
                        this.ls();
                    } else {
                        alert({ icon: "error", text: response.message });
                    }
                }
            }
        });
    }

    async showModules(companyId) {
        const res = await useFetch({ url: this._link, data: { opc: "lsModuleCompany", company_id: companyId } });

        let content = `
            <div id="moduleCompanyList" class="mb-3"></div>
            <div id="formLinkModule"></div>
        `;

        bootbox.dialog({
            title: '<strong>Módulos vinculados</strong>',
            message: content,
            size: 'large',
            closeButton: true,
            buttons: {
                cancel: { label: "Cerrar", className: "btn-secondary" }
            }
        });

        this.createCoffeTable({
            parent: "moduleCompanyList",
            id: "tbModuleCompany",
            theme: 'corporativo',
            title: 'Módulos asignados',
            data: {
                thead: res.thead || '',
                row: res.row
            },
        });

        this.coffeeForm({
            parent: 'formLinkModule',
            id: 'formAddModuleCompany',
            class: 'flex flex-wrap items-end gap-y-2',
            data: [
                {
                    opc: "select",
                    id: "module_id_link",
                    lbl: "Módulo a vincular",
                    class: "w-full sm:w-1/2 px-2 mt-1",
                    data: lsModulesData
                },
                {
                    opc: "button",
                    id: "btnLinkModule",
                    text: "Vincular",
                    class: "w-full sm:w-1/4 px-2 mt-1",
                    onClick: async () => {
                        const moduleId = $('#module_id_link').val();
                        if (!moduleId) return;

                        const result = await useFetch({
                            url: api,
                            data: { opc: "addModuleCompany", module_id: moduleId, company_id: companyId }
                        });

                        if (result.status === 200) {
                            alert({ icon: 'success', text: result.message });
                            this.showModules(companyId);
                        } else {
                            alert({ icon: 'error', text: result.message, btn1: true, btn1Text: 'Ok' });
                        }
                    }
                }
            ]
        });
    }

    unlinkModule(id) {
        this.swalQuestion({
            opts: {
                title: '¿Desvincular este módulo?',
                html: 'Se eliminará la relación módulo-empresa.',
            },
            data: { opc: "deleteModuleCompany", id: id },
            methods: {
                request: (response) => {
                    if (response.status == 200) {
                        alert({ icon: "success", text: response.message });
                    } else {
                        alert({ icon: "error", text: response.message });
                    }
                }
            }
        });
    }
}

// Customers

class Customers extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Customers";
    }

    render() {
        this.layout();
    }

    layout() {
        const container = $("#container-tab-customers");
        container.html('<div id="filterbar-customers" class="mb-2"></div><div id="tabla-customers"></div>');

        this.createfilterBar({
            parent: "filterbar-customers",
            data: [
                {
                    opc: "select",
                    id: "enabledCustomer",
                    class: "col-12 col-md-3",
                    data: [
                        { id: "1", valor: "Activos" },
                        { id: "0", valor: "Inactivos" }
                    ],
                    onchange: 'customers.ls()'
                },
                {
                    opc: "button",
                    class: "col-12 col-md-3",
                    id: "btnNuevoCliente",
                    text: "Nuevo Cliente",
                    onClick: () => this.add(),
                },
            ],
        });

        this.ls();
    }

    json() {
        return [
            {
                opc: "input",
                lbl: "Nombre",
                id: "name",
                tipo: "texto",
                class: "col-12 col-sm-4 mb-3"
            },
            {
                opc: "input",
                lbl: "Apellido Paterno",
                id: "paternal_surname",
                tipo: "texto",
                class: "col-12 col-sm-4 mb-3"
            },
            {
                opc: "input",
                lbl: "Apellido Materno",
                id: "maternal_surname",
                tipo: "texto",
                class: "col-12 col-sm-4 mb-3"
            },
        ];
    }

    ls() {
        this.createTable({
            parent: "tabla-customers",
            idFilterBar: "filterbar-customers",
            coffeesoft: true,
            data: { opc: "lsCustomers", enabled: $('#enabledCustomer').val() || '1' },
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbCustomers",
                theme: 'dark',
                title: 'Clientes',
                subtitle: 'fayxzvov_admin.customers',
            },
        });
    }

    add() {
        this.createModalForm({
            id: "formModalCustomer",
            data: { opc: "addCustomer" },
            bootbox: { title: "<strong>Nuevo Cliente</strong>" },
            json: this.json(),
            success: (res) => {
                if (res.status === 200) {
                    alert({ icon: 'success', text: res.message });
                    this.ls();
                } else {
                    alert({ icon: 'error', title: 'Oops...', text: res.message, btn1: true, btn1Text: 'Ok' });
                }
            },
        });
    }

    async edit(id) {
        const res = await useFetch({ url: this._link, data: { opc: "getCustomer", id } });

        this.createModalForm({
            id: "formModalCustomer",
            data: { opc: "editCustomer", id },
            bootbox: { title: "<strong>Editar Cliente</strong>" },
            autofill: res.data,
            json: this.json(),
            success: (res) => {
                if (res.status === 200) {
                    alert({ icon: 'success', text: res.message });
                    this.ls();
                } else {
                    alert({ icon: 'error', title: 'Oops...', text: res.message, btn1: true, btn1Text: 'Ok' });
                }
            },
        });
    }

    toggleStatus(id, enabled) {
        let tr = $(event.target).closest("tr");
        let title = tr.find("td").eq(0).text();
        let accion = enabled == 1 ? "activar" : "desactivar";

        this.swalQuestion({
            opts: {
                title: `¿Deseas ${accion} al cliente ${title}?`
            },
            data: {
                opc: "toggleStatusCustomer",
                enabled: enabled,
                id: id,
            },
            methods: {
                request: (response) => {
                    if (response.status == 200) {
                        alert({ icon: "success", text: response.message });
                        this.ls();
                    } else {
                        alert({ icon: "error", text: response.message });
                    }
                }
            }
        });
    }
}

// Modules

class Modules extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Modules";
    }

    render() {
        this.layout();
    }

    layout() {
        const container = $("#container-tab-modules");
        container.html('<div id="filterbar-modules" class="mb-2"></div><div id="tabla-modules"></div>');

        this.createfilterBar({
            parent: "filterbar-modules",
            data: [
                {
                    opc: "button",
                    class: "col-12 col-md-3",
                    id: "btnNuevoModulo",
                    text: "Nuevo Módulo",
                    onClick: () => this.add(),
                },
            ],
        });

        this.ls();
    }

    json() {
        return [
            {
                opc: "input",
                lbl: "Nombre",
                id: "name",
                tipo: "texto",
                class: "col-12 col-sm-6 mb-3"
            },
            {
                opc: "input",
                lbl: "Nickname",
                id: "nickname",
                tipo: "texto",
                class: "col-12 col-sm-6 mb-3"
            },
            {
                opc: "input",
                lbl: "Ruta",
                id: "route",
                class: "col-12 col-sm-6 mb-3"
            },
            {
                opc: "input",
                lbl: "File Path",
                id: "file_path",
                class: "col-12 col-sm-6 mb-3",
                required: false
            },
            {
                opc: "input",
                lbl: "Imagen",
                id: "image",
                class: "col-12 col-sm-6 mb-3",
                required: false
            },
            {
                opc: "textarea",
                id: "description",
                lbl: "Descripción",
                rows: 3,
                class: "col-12 mb-3",
                required: false
            },
        ];
    }

    ls() {
        this.createTable({
            parent: "tabla-modules",
            idFilterBar: "filterbar-modules",
            coffeesoft: true,
            data: { opc: "lsModules" },
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbModules",
                theme: 'dark',
                title: 'Módulos',
                subtitle: 'fayxzvov_admin.modules',
            },
        });
    }

    add() {
        this.createModalForm({
            id: "formModalModule",
            data: { opc: "addModule" },
            bootbox: { title: "<strong>Nuevo Módulo</strong>" },
            json: this.json(),
            success: (res) => {
                if (res.status === 200) {
                    alert({ icon: 'success', text: res.message });
                    this.ls();
                } else {
                    alert({ icon: 'error', title: 'Oops...', text: res.message, btn1: true, btn1Text: 'Ok' });
                }
            },
        });
    }

    async edit(id) {
        const res = await useFetch({ url: this._link, data: { opc: "getModule", id } });

        this.createModalForm({
            id: "formModalModule",
            data: { opc: "editModule", id },
            bootbox: { title: "<strong>Editar Módulo</strong>" },
            autofill: res.data,
            json: this.json(),
            success: (res) => {
                if (res.status === 200) {
                    alert({ icon: 'success', text: res.message });
                    this.ls();
                } else {
                    alert({ icon: 'error', title: 'Oops...', text: res.message, btn1: true, btn1Text: 'Ok' });
                }
            },
        });
    }

    deleteModule(id) {
        this.swalQuestion({
            opts: {
                title: '¿Eliminar este módulo?',
                html: 'Esta acción eliminará el módulo permanentemente.',
            },
            data: { opc: "deleteModule", id: id },
            methods: {
                request: (response) => {
                    if (response.status == 200) {
                        alert({ icon: "success", text: response.message });
                        this.ls();
                    } else {
                        alert({ icon: "error", text: response.message });
                    }
                }
            }
        });
    }
}

// Admin Users

class AdminUsers extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "AdminUsers";
    }

    render() {
        this.layout();
    }

    layout() {
        const container = $("#container-tab-admin-users");
        container.html('<div id="filterbar-admin-users" class="mb-2"></div><div id="tabla-admin-users"></div>');

        this.createfilterBar({
            parent: "filterbar-admin-users",
            data: [
                {
                    opc: "select",
                    id: "enabledAdminUser",
                    class: "col-12 col-md-3",
                    data: [
                        { id: "1", valor: "Activos" },
                        { id: "0", valor: "Inactivos" }
                    ],
                    onchange: 'adminUsers.ls()'
                },
                {
                    opc: "button",
                    class: "col-12 col-md-3",
                    id: "btnNuevoAdminUser",
                    text: "Nuevo Usuario",
                    onClick: () => this.add(),
                },
            ],
        });

        this.ls();
    }

    json(mode = 'add') {
        return [
            {
                opc: "input",
                lbl: "Usuario",
                id: "user",
                tipo: "texto",
                class: "col-12 col-sm-6 mb-3"
            },
            {
                opc: "input-group",
                lbl: mode === 'edit' ? 'Nueva contraseña (vacío = sin cambio)' : 'Contraseña',
                id: "key",
                icon: "icon-key",
                type: "password",
                class: "col-12 col-sm-6 mb-3",
                required: mode === 'add'
            },
            {
                opc: "select",
                lbl: "Cliente",
                id: "customers_id",
                class: "col-12 col-sm-6 mb-3",
                data: lsCustomersData,
                required: false
            },
            {
                opc: "input",
                lbl: "Base de datos",
                id: "name_database",
                class: "col-12 col-sm-6 mb-3",
                required: false
            },
        ];
    }

    ls() {
        this.createTable({
            parent: "tabla-admin-users",
            idFilterBar: "filterbar-admin-users",
            coffeesoft: true,
            data: { opc: "lsAdminUsers", enabled: $('#enabledAdminUser').val() || '1' },
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbAdminUsers",
                theme: 'dark',
                title: 'Usuarios Admin',
                subtitle: 'fayxzvov_admin.users',
            },
        });
    }

    add() {
        this.createModalForm({
            id: "formModalAdminUser",
            data: { opc: "addAdminUser" },
            bootbox: { title: "<strong>Nuevo Usuario Admin</strong>" },
            json: this.json('add'),
            success: (res) => {
                if (res.status === 200) {
                    alert({ icon: 'success', text: res.message });
                    this.ls();
                } else {
                    alert({ icon: 'error', title: 'Oops...', text: res.message, btn1: true, btn1Text: 'Ok' });
                }
            },
        });
    }

    async edit(id) {
        const res = await useFetch({ url: this._link, data: { opc: "getAdminUser", id } });

        this.createModalForm({
            id: "formModalAdminUser",
            data: { opc: "editAdminUser", id },
            bootbox: { title: "<strong>Editar Usuario Admin</strong>" },
            autofill: res.data,
            json: this.json('edit'),
            success: (res) => {
                if (res.status === 200) {
                    alert({ icon: 'success', text: res.message });
                    this.ls();
                } else {
                    alert({ icon: 'error', title: 'Oops...', text: res.message, btn1: true, btn1Text: 'Ok' });
                }
            },
        });
    }

    toggleStatus(id, enabled) {
        let tr = $(event.target).closest("tr");
        let title = tr.find("td").eq(0).text();
        let accion = enabled == 1 ? "activar" : "desactivar";

        this.swalQuestion({
            opts: {
                title: `¿Deseas ${accion} al usuario ${title}?`
            },
            data: {
                opc: "toggleStatusAdminUser",
                enabled: enabled,
                id: id,
            },
            methods: {
                request: (response) => {
                    if (response.status == 200) {
                        alert({ icon: "success", text: response.message });
                        this.ls();
                    } else {
                        alert({ icon: "error", text: response.message });
                    }
                }
            }
        });
    }
}
