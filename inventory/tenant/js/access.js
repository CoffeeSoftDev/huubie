// Dominio Accesos: Módulos, Submódulos, Secciones, Roles, Tipos de permiso, Permisos.

/* ===== Módulos ===== */

class Modules extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Modules';
    }

    render() {
        $('#container-modulos').html(`
            <div id="filterbar-modules" class="mb-2"></div>
            <div id="table-modules"></div>
        `);
        this.createfilterBar({
            parent: 'filterbar-modules',
            data: [
                { opc: 'select', id: 'active', lbl: 'Estado', class: 'col-12 col-md-3', data: dataInit.statusFilter || [], onchange: 'modules.lsModules()' },
                { opc: 'button', class: 'col-12 col-md-3', id: 'btnNewModule', text: 'Nuevo Módulo', onClick: () => this.addModule() }
            ]
        });
    }

    lsModules() {
        this.createTable({
            parent: 'table-modules', idFilterBar: 'filterbar-modules',
            data: { opc: 'lsModules' }, coffeesoft: true, conf: { datatable: true, pag: 10 },
            attr: { id: 'tbModules', theme: 'light', center: [4, 5], right: [] }
        });
    }

    addModule() {
        this.createModalForm({
            id: 'formModuleAdd', data: { opc: 'addModule' }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Nuevo Módulo' }, json: this.jsonModule(),
            success: (r) => this._afterSave(r)
        });
    }

    async editModule(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getModule', id: id } });
        if (request.status !== 200) { alert({ icon: 'error', text: request.message || 'No se pudo cargar el módulo', btn1: true }); return; }
        this.createModalForm({
            id: 'formModuleEdit', data: { opc: 'editModule', id: id }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Editar Módulo' }, autofill: request.data, json: this.jsonModule(),
            success: (r) => this._afterSave(r)
        });
    }

    toggleModule(id, active) {
        this.swalQuestion({
            opts: { title: `¿${active == 1 ? 'Activar' : 'Desactivar'} módulo?`, text: `¿Deseas ${active == 1 ? 'activar' : 'desactivar'} este módulo?`, icon: 'warning' },
            data: { opc: 'toggleModule', id: id, active: active },
            methods: { send: (r) => this._afterSave(r) }
        });
    }

    _afterSave(r) { notify(r); if (r.status == 200) this.lsModules(); }

    jsonModule() {
        return [
            { opc: 'input', id: 'name', lbl: 'Nombre del módulo', class: 'col-12 col-md-6 mb-3', required: true },
            { opc: 'input', id: 'code', lbl: 'Código', class: 'col-12 col-md-6 mb-3' },
            { opc: 'input', id: 'route', lbl: 'Ruta', class: 'col-12 col-md-8 mb-3' },
            { opc: 'input', id: 'orden', lbl: 'Orden', type: 'number', class: 'col-12 col-md-4 mb-3' }
        ];
    }
}

/* ===== Submódulos ===== */

class Submodules extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Submodules';
    }

    render() {
        $('#container-submodulos').html(`
            <div id="filterbar-submodules" class="mb-2"></div>
            <div id="table-submodules"></div>
        `);
        this.createfilterBar({
            parent: 'filterbar-submodules',
            data: [
                { opc: 'select', id: 'active', lbl: 'Estado', class: 'col-12 col-md-3', data: dataInit.statusFilter || [], onchange: 'submodules.lsSubmodules()' },
                { opc: 'button', class: 'col-12 col-md-3', id: 'btnNewSubmodule', text: 'Nuevo Submódulo', onClick: () => this.addSubmodule() }
            ]
        });
    }

    lsSubmodules() {
        this.createTable({
            parent: 'table-submodules', idFilterBar: 'filterbar-submodules',
            data: { opc: 'lsSubmodules' }, coffeesoft: true, conf: { datatable: true, pag: 10 },
            attr: { id: 'tbSubmodules', theme: 'light', center: [5, 6], right: [] }
        });
    }

    addSubmodule() {
        if (!(dataInit.modules || []).length) { alert({ icon: 'info', text: 'Primero registra al menos un módulo activo', btn1: true }); return; }
        this.createModalForm({
            id: 'formSubmoduleAdd', data: { opc: 'addSubmodule' }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Nuevo Submódulo' }, json: this.jsonSubmodule(),
            success: (r) => this._afterSave(r)
        });
    }

    async editSubmodule(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getSubmodule', id: id } });
        if (request.status !== 200) { alert({ icon: 'error', text: request.message || 'No se pudo cargar el submódulo', btn1: true }); return; }
        this.createModalForm({
            id: 'formSubmoduleEdit', data: { opc: 'editSubmodule', id: id }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Editar Submódulo' }, autofill: request.data, json: this.jsonSubmodule(),
            success: (r) => this._afterSave(r)
        });
    }

    toggleSubmodule(id, active) {
        this.swalQuestion({
            opts: { title: `¿${active == 1 ? 'Activar' : 'Desactivar'} submódulo?`, text: `¿Deseas ${active == 1 ? 'activar' : 'desactivar'} este submódulo?`, icon: 'warning' },
            data: { opc: 'toggleSubmodule', id: id, active: active },
            methods: { send: (r) => this._afterSave(r) }
        });
    }

    _afterSave(r) { notify(r); if (r.status == 200) this.lsSubmodules(); }

    jsonSubmodule() {
        return [
            { opc: 'input', id: 'name', lbl: 'Nombre del submódulo', class: 'col-12 col-md-6 mb-3', required: true },
            { opc: 'select', id: 'module_id', lbl: 'Módulo', class: 'col-12 col-md-6 mb-3', required: true, data: dataInit.modules || [] },
            { opc: 'input', id: 'code', lbl: 'Código', class: 'col-12 col-md-6 mb-3' },
            { opc: 'input', id: 'route', lbl: 'Ruta', class: 'col-12 col-md-6 mb-3' },
            { opc: 'input', id: 'orden', lbl: 'Orden', type: 'number', class: 'col-12 col-md-4 mb-3' }
        ];
    }
}

/* ===== Secciones ===== */

class Sections extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Sections';
    }

    render() {
        $('#container-secciones').html(`
            <div id="filterbar-sections" class="mb-2"></div>
            <div id="table-sections"></div>
        `);
        this.createfilterBar({
            parent: 'filterbar-sections',
            data: [
                { opc: 'select', id: 'active', lbl: 'Estado', class: 'col-12 col-md-3', data: dataInit.statusFilter || [], onchange: 'sections.lsSections()' },
                { opc: 'button', class: 'col-12 col-md-3', id: 'btnNewSection', text: 'Nueva Sección', onClick: () => this.addSection() }
            ]
        });
    }

    lsSections() {
        this.createTable({
            parent: 'table-sections', idFilterBar: 'filterbar-sections',
            data: { opc: 'lsSections' }, coffeesoft: true, conf: { datatable: true, pag: 10 },
            attr: { id: 'tbSections', theme: 'light', center: [5, 6], right: [] }
        });
    }

    addSection() {
        if (!(dataInit.modules || []).length) { alert({ icon: 'info', text: 'Primero registra al menos un módulo activo', btn1: true }); return; }
        this.createModalForm({
            id: 'formSectionAdd', data: { opc: 'addSection' }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Nueva Sección' }, json: this.jsonSection(),
            success: (r) => this._afterSave(r)
        });
    }

    async editSection(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getSection', id: id } });
        if (request.status !== 200) { alert({ icon: 'error', text: request.message || 'No se pudo cargar la sección', btn1: true }); return; }
        this.createModalForm({
            id: 'formSectionEdit', data: { opc: 'editSection', id: id }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Editar Sección' }, autofill: request.data, json: this.jsonSection(),
            success: (r) => this._afterSave(r)
        });
    }

    toggleSection(id, active) {
        this.swalQuestion({
            opts: { title: `¿${active == 1 ? 'Activar' : 'Desactivar'} sección?`, text: `¿Deseas ${active == 1 ? 'activar' : 'desactivar'} esta sección?`, icon: 'warning' },
            data: { opc: 'toggleSection', id: id, active: active },
            methods: { send: (r) => this._afterSave(r) }
        });
    }

    _afterSave(r) { notify(r); if (r.status == 200) this.lsSections(); }

    jsonSection() {
        return [
            { opc: 'input', id: 'name', lbl: 'Nombre de la sección', class: 'col-12 col-md-6 mb-3', required: true },
            { opc: 'select', id: 'module_id', lbl: 'Módulo', class: 'col-12 col-md-6 mb-3', required: true, data: dataInit.modules || [] },
            { opc: 'select', id: 'submodule_id', lbl: 'Submódulo (opcional)', class: 'col-12 col-md-6 mb-3', data: dataInit.submodules || [] },
            { opc: 'input', id: 'code', lbl: 'Código', class: 'col-12 col-md-6 mb-3' },
            { opc: 'input', id: 'route', lbl: 'Ruta', class: 'col-12 col-md-8 mb-3' },
            { opc: 'input', id: 'orden', lbl: 'Orden', type: 'number', class: 'col-12 col-md-4 mb-3' }
        ];
    }
}

/* ===== Tipos de permiso ===== */

class TypePermissions extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'TypePermissions';
    }

    render() {
        $('#container-tipos-permiso').html(`
            <div id="filterbar-types" class="mb-2"></div>
            <div id="table-types"></div>
        `);
        this.createfilterBar({
            parent: 'filterbar-types',
            data: [
                { opc: 'select', id: 'active', lbl: 'Estado', class: 'col-12 col-md-3', data: dataInit.statusFilter || [], onchange: 'typePermissions.lsTypePermissions()' },
                { opc: 'button', class: 'col-12 col-md-3', id: 'btnNewType', text: 'Nuevo Tipo', onClick: () => this.addType() }
            ]
        });
    }

    lsTypePermissions() {
        this.createTable({
            parent: 'table-types', idFilterBar: 'filterbar-types',
            data: { opc: 'lsTypePermissions' }, coffeesoft: true, conf: { datatable: true, pag: 10 },
            attr: { id: 'tbTypes', theme: 'light', center: [2], right: [] }
        });
    }

    addType() {
        this.createModalForm({
            id: 'formTypeAdd', data: { opc: 'addTypePermission' }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Nuevo Tipo de Permiso' }, json: this.jsonType(),
            success: (r) => this._afterSave(r)
        });
    }

    async editTypePermission(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getTypePermission', id: id } });
        if (request.status !== 200) { alert({ icon: 'error', text: request.message || 'No se pudo cargar el tipo', btn1: true }); return; }
        this.createModalForm({
            id: 'formTypeEdit', data: { opc: 'editTypePermission', id: id }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Editar Tipo de Permiso' }, autofill: request.data, json: this.jsonType(),
            success: (r) => this._afterSave(r)
        });
    }

    toggleTypePermission(id, active) {
        this.swalQuestion({
            opts: { title: `¿${active == 1 ? 'Activar' : 'Desactivar'} tipo?`, text: `¿Deseas ${active == 1 ? 'activar' : 'desactivar'} este tipo de permiso?`, icon: 'warning' },
            data: { opc: 'toggleTypePermission', id: id, active: active },
            methods: { send: (r) => this._afterSave(r) }
        });
    }

    _afterSave(r) { notify(r); if (r.status == 200) this.lsTypePermissions(); }

    jsonType() {
        return [
            { opc: 'input', id: 'name', lbl: 'Nombre del tipo de permiso', class: 'col-12 mb-3', required: true }
        ];
    }
}

/* ===== Roles ===== */

class Roles extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Roles';
    }

    render() {
        $('#container-roles').html(`
            <div id="filterbar-roles" class="mb-2"></div>
            <div id="table-roles"></div>
        `);
        this.createfilterBar({
            parent: 'filterbar-roles',
            data: [
                { opc: 'select', id: 'active', lbl: 'Estado', class: 'col-12 col-md-3', data: dataInit.statusFilter || [], onchange: 'roles.lsRoles()' },
                { opc: 'button', class: 'col-12 col-md-3', id: 'btnNewRole', text: 'Nuevo Rol', onClick: () => this.addRole() }
            ]
        });
    }

    lsRoles() {
        this.createTable({
            parent: 'table-roles', idFilterBar: 'filterbar-roles',
            data: { opc: 'lsRoles' }, coffeesoft: true, conf: { datatable: true, pag: 10 },
            attr: { id: 'tbRoles', theme: 'light', center: [3, 4], right: [] }
        });
    }

    addRole() {
        this.createModalForm({
            id: 'formRoleAdd', data: { opc: 'addRole' }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Nuevo Rol' }, json: this.jsonRole(),
            success: (r) => this._afterSave(r)
        });
    }

    async editRole(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getRole', id: id } });
        if (request.status !== 200) { alert({ icon: 'error', text: request.message || 'No se pudo cargar el rol', btn1: true }); return; }
        this.createModalForm({
            id: 'formRoleEdit', data: { opc: 'editRole', id: id }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Editar Rol' }, autofill: request.data, json: this.jsonRole(),
            success: (r) => this._afterSave(r)
        });
    }

    toggleRole(id, active) {
        this.swalQuestion({
            opts: { title: `¿${active == 1 ? 'Activar' : 'Desactivar'} rol?`, text: `¿Deseas ${active == 1 ? 'activar' : 'desactivar'} este rol?`, icon: 'warning' },
            data: { opc: 'toggleRole', id: id, active: active },
            methods: { send: (r) => this._afterSave(r) }
        });
    }

    _afterSave(r) { notify(r); if (r.status == 200) this.lsRoles(); }

    jsonRole() {
        return [
            { opc: 'input', id: 'code', lbl: 'Código', class: 'col-12 col-md-6 mb-3' },
            { opc: 'input', id: 'name', lbl: 'Nombre del rol', class: 'col-12 col-md-6 mb-3', required: true }
        ];
    }
}

/* ===== Permisos ===== */

class Permissions extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Permissions';
    }

    render() {
        $('#container-permisos').html(`
            <div id="filterbar-permissions" class="mb-2"></div>
            <div id="table-permissions"></div>
        `);
        this.createfilterBar({
            parent: 'filterbar-permissions',
            data: [
                { opc: 'select', id: 'active', lbl: 'Estado', class: 'col-12 col-md-3', data: dataInit.statusFilter || [], onchange: 'permissions.lsPermissions()' },
                { opc: 'button', class: 'col-12 col-md-3', id: 'btnNewPermission', text: 'Asignar Permiso', onClick: () => this.addPermission() }
            ]
        });
    }

    lsPermissions() {
        this.createTable({
            parent: 'table-permissions', idFilterBar: 'filterbar-permissions',
            data: { opc: 'lsPermissions' }, coffeesoft: true, conf: { datatable: true, pag: 10 },
            attr: { id: 'tbPermissions', theme: 'light', center: [4], right: [] }
        });
    }

    addPermission() {
        if (!(dataInit.roles || []).length || !(dataInit.sections || []).length || !(dataInit.typePermissions || []).length) {
            alert({ icon: 'info', text: 'Necesitas al menos un rol, una sección y un tipo de permiso activos', btn1: true });
            return;
        }
        this.createModalForm({
            id: 'formPermissionAdd', data: { opc: 'addPermission' }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Asignar Permiso' },
            json: [
                { opc: 'select', id: 'role_id', lbl: 'Rol', class: 'col-12 mb-3', required: true, data: dataInit.roles || [] },
                { opc: 'select', id: 'section_id', lbl: 'Sección', class: 'col-12 mb-3', required: true, data: dataInit.sections || [] },
                { opc: 'select', id: 'type_permission_id', lbl: 'Tipo de permiso', class: 'col-12 mb-3', required: true, data: dataInit.typePermissions || [] }
            ],
            success: (r) => this._afterSave(r)
        });
    }

    togglePermission(id, active) {
        this.swalQuestion({
            opts: { title: `¿${active == 1 ? 'Activar' : 'Desactivar'} permiso?`, text: `¿Deseas ${active == 1 ? 'activar' : 'desactivar'} este permiso?`, icon: 'warning' },
            data: { opc: 'togglePermission', id: id, active: active },
            methods: { send: (r) => this._afterSave(r) }
        });
    }

    _afterSave(r) { notify(r); if (r.status == 200) this.lsPermissions(); }
}
