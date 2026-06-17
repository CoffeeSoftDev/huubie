// -- Módulos --

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
            success: (r) => afterSave(r, () => this.lsModules())
        });
    }

    async editModule(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getModule', id: id } });
        if (request.status !== 200) { alert({ icon: 'error', text: request.message || 'No se pudo cargar el módulo', btn1: true }); return; }
        this.createModalForm({
            id: 'formModuleEdit', data: { opc: 'editModule', id: id }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Editar Módulo' }, autofill: request.data, json: this.jsonModule(),
            success: (r) => afterSave(r, () => this.lsModules())
        });
    }

    toggleModule(id, active) {
        this.swalQuestion({
            opts: { title: `¿${active == 1 ? 'Activar' : 'Desactivar'} módulo?`, text: `¿Deseas ${active == 1 ? 'activar' : 'desactivar'} este módulo?`, icon: 'warning' },
            data: { opc: 'toggleModule', id: id, active: active },
            methods: { send: (r) => afterSave(r, () => this.lsModules()) }
        });
    }

    jsonModule() {
        return [
            { opc: 'input', id: 'name', lbl: 'Nombre del módulo', class: 'col-12 col-md-6 mb-3', required: true, onkeyup: 'autoCode(this.value)' },
            { opc: 'input', id: 'code', lbl: 'Código (automático)', class: 'col-12 col-md-6 mb-3', readonly: true },
            { opc: 'input', id: 'icon', lbl: 'Ícono (Lucide)', class: 'col-12 col-md-6 mb-3', placeholder: 'ej. package, dollar-sign' },
            { opc: 'select', id: 'route', lbl: 'Ruta', class: 'col-12 col-md-6 mb-3', selected: '-- Selecciona --', select2: true, data: dataInit.routes || [] },
            { opc: 'input', id: 'description', lbl: 'Descripción', class: 'col-12 col-md-8 mb-3', placeholder: 'Texto que se muestra en la tarjeta' },
            { opc: 'input', id: 'orden', lbl: 'Orden', type: 'number', class: 'col-12 col-md-4 mb-3' }
        ];
    }
}

// -- Submódulos --

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
            success: (r) => afterSave(r, () => this.lsSubmodules())
        });
    }

    async editSubmodule(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getSubmodule', id: id } });
        if (request.status !== 200) { alert({ icon: 'error', text: request.message || 'No se pudo cargar el submódulo', btn1: true }); return; }
        this.createModalForm({
            id: 'formSubmoduleEdit', data: { opc: 'editSubmodule', id: id }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Editar Submódulo' }, autofill: request.data, json: this.jsonSubmodule(),
            success: (r) => afterSave(r, () => this.lsSubmodules())
        });
    }

    toggleSubmodule(id, active) {
        this.swalQuestion({
            opts: { title: `¿${active == 1 ? 'Activar' : 'Desactivar'} submódulo?`, text: `¿Deseas ${active == 1 ? 'activar' : 'desactivar'} este submódulo?`, icon: 'warning' },
            data: { opc: 'toggleSubmodule', id: id, active: active },
            methods: { send: (r) => afterSave(r, () => this.lsSubmodules()) }
        });
    }

    jsonSubmodule() {
        return [
            { opc: 'input', id: 'name', lbl: 'Nombre del submódulo', class: 'col-12 col-md-6 mb-3', required: true, onkeyup: 'autoCode(this.value)' },
            { opc: 'select', id: 'module_id', lbl: 'Módulo', class: 'col-12 col-md-6 mb-3', required: true, data: dataInit.modules || [] },
            { opc: 'input', id: 'code', lbl: 'Código (automático)', class: 'col-12 col-md-6 mb-3', readonly: true },
            { opc: 'input', id: 'icon', lbl: 'Ícono (Lucide)', class: 'col-12 col-md-6 mb-3', placeholder: 'ej. folder-tree, box' },
            { opc: 'select', id: 'route', lbl: 'Ruta', class: 'col-12 col-md-6 mb-3', selected: '-- Selecciona --', select2: true, data: dataInit.routes || [] },
            { opc: 'input', id: 'description', lbl: 'Descripción', class: 'col-12 col-md-6 mb-3', placeholder: 'Texto que se muestra en la tarjeta' },
            { opc: 'input', id: 'orden', lbl: 'Orden', type: 'number', class: 'col-12 col-md-6 mb-3' }
        ];
    }
}

// -- Secciones --

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
            success: (r) => afterSave(r, () => this.lsSections())
        });
    }

    async editSection(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getSection', id: id } });
        if (request.status !== 200) { alert({ icon: 'error', text: request.message || 'No se pudo cargar la sección', btn1: true }); return; }
        this.createModalForm({
            id: 'formSectionEdit', data: { opc: 'editSection', id: id }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Editar Sección' }, autofill: request.data, json: this.jsonSection(),
            success: (r) => afterSave(r, () => this.lsSections())
        });
    }

    toggleSection(id, active) {
        this.swalQuestion({
            opts: { title: `¿${active == 1 ? 'Activar' : 'Desactivar'} sección?`, text: `¿Deseas ${active == 1 ? 'activar' : 'desactivar'} esta sección?`, icon: 'warning' },
            data: { opc: 'toggleSection', id: id, active: active },
            methods: { send: (r) => afterSave(r, () => this.lsSections()) }
        });
    }

    jsonSection() {
        return [
            { opc: 'input', id: 'name', lbl: 'Nombre de la sección', class: 'col-12 col-md-6 mb-3', required: true, onkeyup: 'autoCode(this.value)' },
            { opc: 'select', id: 'module_id', lbl: 'Módulo', class: 'col-12 col-md-6 mb-3', required: true, data: dataInit.modules || [] },
            { opc: 'select', id: 'submodule_id', lbl: 'Submódulo (opcional)', class: 'col-12 col-md-6 mb-3', selected: '-- Selecciona --', data: dataInit.submodules || [] },
            { opc: 'input', id: 'code', lbl: 'Código (automático)', class: 'col-12 col-md-6 mb-3', readonly: true },
            { opc: 'input', id: 'icon', lbl: 'Ícono (Lucide)', class: 'col-12 col-md-6 mb-3', placeholder: 'ej. boxes, house, shopping-cart' },
            { opc: 'select', id: 'route', lbl: 'Ruta', class: 'col-12 col-md-6 mb-3', selected: '-- Selecciona --', select2: true, data: dataInit.routes || [] },
            { opc: 'input', id: 'orden', lbl: 'Orden', type: 'number', class: 'col-12 col-md-6 mb-3' }
        ];
    }
}

// -- Tipos de permiso --

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
            success: (r) => afterSave(r, () => this.lsTypePermissions())
        });
    }

    async editTypePermission(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getTypePermission', id: id } });
        if (request.status !== 200) { alert({ icon: 'error', text: request.message || 'No se pudo cargar el tipo', btn1: true }); return; }
        this.createModalForm({
            id: 'formTypeEdit', data: { opc: 'editTypePermission', id: id }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Editar Tipo de Permiso' }, autofill: request.data, json: this.jsonType(),
            success: (r) => afterSave(r, () => this.lsTypePermissions())
        });
    }

    toggleTypePermission(id, active) {
        this.swalQuestion({
            opts: { title: `¿${active == 1 ? 'Activar' : 'Desactivar'} tipo?`, text: `¿Deseas ${active == 1 ? 'activar' : 'desactivar'} este tipo de permiso?`, icon: 'warning' },
            data: { opc: 'toggleTypePermission', id: id, active: active },
            methods: { send: (r) => afterSave(r, () => this.lsTypePermissions()) }
        });
    }

    jsonType() {
        return [
            { opc: 'input', id: 'name', lbl: 'Nombre del tipo de permiso', class: 'col-12 mb-3', required: true }
        ];
    }
}

// -- Roles --

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
            success: (r) => afterSave(r, () => this.lsRoles())
        });
    }

    async editRole(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getRole', id: id } });
        if (request.status !== 200) { alert({ icon: 'error', text: request.message || 'No se pudo cargar el rol', btn1: true }); return; }
        this.createModalForm({
            id: 'formRoleEdit', data: { opc: 'editRole', id: id }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Editar Rol' }, autofill: request.data, json: this.jsonRole(),
            success: (r) => afterSave(r, () => this.lsRoles())
        });
    }

    toggleRole(id, active) {
        this.swalQuestion({
            opts: { title: `¿${active == 1 ? 'Activar' : 'Desactivar'} rol?`, text: `¿Deseas ${active == 1 ? 'activar' : 'desactivar'} este rol?`, icon: 'warning' },
            data: { opc: 'toggleRole', id: id, active: active },
            methods: { send: (r) => afterSave(r, () => this.lsRoles()) }
        });
    }

    jsonRole() {
        return [
            { opc: 'input', id: 'code', lbl: 'Código', class: 'col-12 col-md-6 mb-3' },
            { opc: 'input', id: 'name', lbl: 'Nombre del rol', class: 'col-12 col-md-6 mb-3', required: true }
        ];
    }
}

// -- Permisos (editor visual rol x sección, multi-tipo, modo edición batch) --
// Layout master-detail de 3 columnas: Roles | Módulos+secciones | Tipos de permiso de la sección.

const SAMPLE_ACCESS = {
    roles: [
        { id: 1, code: 'superadmin', name: 'Super Admin', is_system: 1, total_sections: 10, granted: 10 },
        { id: 2, code: 'admin', name: 'Administrador', is_system: 0, total_sections: 10, granted: 10 },
        { id: 3, code: 'operador', name: 'Operador', is_system: 0, total_sections: 10, granted: 7 }
    ],
    sections: [
        { section_id: 1, section_name: 'Entradas', module_id: 1, module_name: 'Inventario', submodule_id: 0, submodule_name: null, has_access: true }
    ]
};

class Permissions extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Permissions';
        this.roles = [];
        this.sections = [];
        this.activeRoleId = 0;
        this.activeSectionId = 0;
        this.isSystemRole = false;
        this.editing = false;
        this.pending = { access: {}, types: {} };
    }

    render() {
        this.layout();
        this.loadRoles();
    }

    layout() {
        this.createLayout({
            parent: 'container-permisos',
            design: false,
            data: {
                id: 'permEditor',
                class: 'flex flex-col gap-2 flex-1 min-h-0',
                container: [
                    { type: 'div', id: 'perm-header', class: 'w-full' },
                    {
                        type: 'div', id: 'perm-body',
                        class: 'grid grid-cols-1 lg:grid-cols-12 gap-2 items-stretch flex-1 min-h-0',
                        children: [
                            { type: 'div', id: 'perm-roles',   class: 'lg:col-span-3' },
                            { type: 'div', id: 'perm-modules', class: 'lg:col-span-5' },
                            { type: 'div', id: 'perm-detail',  class: 'lg:col-span-4' }
                        ]
                    }
                ]
            }
        });
    }

    lsPermissions() {
        if (!this.roles.length) this.loadRoles();
    }

    /* ===== Carga de datos ===== */

    async loadRoles() {
        const res = await useFetch({ url: this._link, data: { opc: 'accessRoles' } });
        if (!res || res.status !== 200) {
            $('#perm-roles').html(this.emptyCard('No se pudieron cargar los roles'));
            return;
        }
        this.roles = res.roles || [];
        if (!this.roles.length) {
            $('#perm-roles').html(this.emptyCard('Crea un rol para administrar sus accesos.'));
            $('#perm-header').empty();
            return;
        }
        const stillThere = this.roles.find(r => r.id === this.activeRoleId);
        this.activeRoleId = stillThere ? this.activeRoleId : this.roles[0].id;
        this.renderRoles();
        this.selectRole(this.activeRoleId);
    }

    async loadMatrix(roleId) {
        const res = await useFetch({ url: this._link, data: { opc: 'accessMatrix', role_id: roleId } });
        if (!res || res.status !== 200) {
            $('#perm-modules').html(this.emptyCard(res && res.message || 'No se pudo cargar la matriz'));
            return;
        }
        this.sections = res.sections || [];
        this.isSystemRole = (res.is_system === 1 || res.is_system === true);
        this.activeSectionId = 0;
        this.editing = false;
        this.pending = { access: {}, types: {} };
        this.renderHeader();
        this.renderModules();
        this.renderDetail();
    }

    /* ===== Columna 1: Roles ===== */

    renderRoles() {
        const items = this.roles.map(r => this.roleItem(r)).join('');
        $('#perm-roles').html(`
            <div class="bg-white border border-gray-200 rounded-xl flex flex-col h-full overflow-hidden">
                <div class="p-2.5 border-b border-gray-100 shrink-0">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="text-sm font-semibold text-gray-800">Roles</h3>
                        <button id="perm-add-role" class="w-6 h-6 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-[#C05A40]" title="Nuevo rol">
                            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                    <div class="relative">
                        <i data-lucide="search" class="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2"></i>
                        <input id="perm-role-search" type="text" placeholder="Buscar rol..."
                            class="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#C05A40]/30">
                    </div>
                </div>
                <div id="perm-role-list" class="flex flex-col gap-1 p-2 max-h-[70vh] overflow-y-auto">${items}</div>
            </div>
        `);

        $('#perm-add-role').off('click').on('click', () => { if (typeof roles !== 'undefined') roles.addRole(); });

        $('#perm-role-search').off('input').on('input', (e) => {
            const q = (e.currentTarget.value || '').toLowerCase();
            $('#perm-role-list .perm-role-item').each(function () {
                const name = ($(this).data('name') || '').toString().toLowerCase();
                $(this).toggle(name.indexOf(q) !== -1);
            });
        });

        $('#perm-role-list .perm-role-item').off('click').on('click', (e) => {
            this.selectRole($(e.currentTarget).data('id'));
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    roleItem(r) {
        const active = r.id === this.activeRoleId;
        const sel = active ? 'bg-gray-100' : 'hover:bg-gray-50';
        const check = active ? '<i data-lucide="check" class="w-3.5 h-3.5 text-gray-900 shrink-0"></i>' : '';
        return `
            <div class="perm-role-item flex items-center gap-2.5 p-2 rounded-lg ${sel} cursor-pointer transition"
                 data-id="${r.id}" data-name="${this.esc(r.name)}">
                ${this.avatar(r.name, 'w-8 h-8 text-[11px]')}
                <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-gray-800 truncate leading-tight">${this.esc(r.name)}</p>
                    <p class="text-[11px] text-gray-400">${r.granted}/${r.total_sections} sesiones</p>
                </div>
                ${check}
            </div>
        `;
    }

    selectRole(roleId) {
        this.activeRoleId = roleId;
        $('#perm-role-list .perm-role-item').each(function () {
            const on = $(this).data('id') === roleId;
            $(this).toggleClass('bg-gray-100', on);
            $(this).toggleClass('hover:bg-gray-50', !on);
            $(this).find('[data-lucide="check"]').remove();
            if (on) $(this).append('<i data-lucide="check" class="w-4 h-4 text-gray-900 shrink-0"></i>');
        });
        if (typeof lucide !== 'undefined') lucide.createIcons();
        this.loadMatrix(roleId);
    }

    /* ===== Header: rol activo + botones de modo ===== */

    renderHeader() {
        const role = this.roles.find(r => r.id === this.activeRoleId);
        if (!role) { $('#perm-header').empty(); return; }

        const granted = this.sections.filter(s => s.has_access).length;
        const accessTag = `<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#0b3a5c]/10 text-[#0b3a5c]">${granted} accesos</span>`;

        let modeTag = '';
        let actions = '';

        if (this.isSystemRole) {
            modeTag = '<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-50 text-sky-700 inline-flex items-center gap-1"><i data-lucide="lock" class="w-3 h-3"></i> Sistema</span>';
        } else if (this.editing) {
            modeTag = '<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 inline-flex items-center gap-1"><i data-lucide="pencil" class="w-3 h-3"></i> Editando</span>';
            actions = `
                <button id="perm-cancel" class="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
                    <i data-lucide="x" class="w-3.5 h-3.5"></i> Cancelar
                </button>
                <button id="perm-save" class="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-[#C05A40] text-white hover:bg-[#a94c35]">
                    <i data-lucide="save" class="w-3.5 h-3.5"></i> Guardar
                </button>
            `;
        } else {
            modeTag = '<span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-500 inline-flex items-center gap-1"><i data-lucide="eye" class="w-3 h-3"></i> Lectura</span>';
            actions = `
                <button id="perm-edit" class="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-[#1f2937] text-white hover:bg-[#111827]">
                    <i data-lucide="pencil" class="w-3.5 h-3.5"></i> Editar
                </button>
            `;
        }

        $('#perm-header').html(`
            <div class="bg-white border border-gray-200 rounded-xl px-3 py-2 flex items-center justify-between flex-wrap gap-2">
                <div class="flex items-center gap-2.5">
                    ${this.avatar(role.name, 'w-9 h-9 text-xs')}
                    <div>
                        <div class="flex items-center gap-2">
                            <h2 class="text-base font-semibold text-gray-800">${this.esc(role.name)}</h2>
                            ${accessTag}
                            ${modeTag}
                        </div>
                        <p class="text-[11px] text-gray-400">${role.code ? this.esc(role.code) : 'Rol personalizado'}</p>
                    </div>
                </div>
                <div class="flex items-center gap-1.5">${actions}</div>
            </div>
        `);

        $('#perm-edit').off('click').on('click', () => this.enterEditMode());
        $('#perm-save').off('click').on('click', () => this.save());
        $('#perm-cancel').off('click').on('click', () => this.cancelEdit());
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    enterEditMode() {
        this.editing = true;
        this.pending = { access: {}, types: {} };
        this.renderHeader();
        this.applyEditState();
    }

    cancelEdit() {
        this.editing = false;
        this.pending = { access: {}, types: {} };
        this.loadMatrix(this.activeRoleId);
    }

    applyEditState() {
        const disabled = !this.editing || this.isSystemRole;
        $('#perm-modules .perm-access').prop('disabled', disabled);
        $('#perm-detail .perm-type-check').prop('disabled', disabled);
    }

    /* ===== Columna 2: Módulos (acordeón) → secciones ===== */

    renderModules() {
        if (!this.sections.length) {
            $('#perm-modules').html(this.emptyCard('No hay secciones activas. Crea secciones primero.'));
            return;
        }
        const groups = this.groupByModule();
        const blocks = Object.keys(groups).map(mid => {
            const g = groups[mid];
            const granted = g.items.filter(s => s.has_access).length;
            const rows = g.items.map(s => this.sectionRow(s)).join('');
            return `
                <div class="perm-module bg-gray-50 rounded-lg overflow-hidden">
                    <button class="perm-module-head w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-100" data-module="${mid}">
                        <span class="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-gray-400 transition-transform perm-chevron -rotate-90"></i>
                            <i data-lucide="${g.icon}" class="w-3.5 h-3.5 text-emerald-600"></i>
                            ${this.esc(g.name)}
                        </span>
                        <span class="text-[11px] font-medium text-gray-400">${granted}/${g.items.length}</span>
                    </button>
                    <div class="perm-module-body hidden">${rows}</div>
                </div>
            `;
        }).join('');

        $('#perm-modules').html(`
            <div class="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col h-full">
                <div class="px-3 py-2.5 border-b border-gray-100 shrink-0">
                    <h3 class="text-sm font-semibold text-gray-800">Módulos</h3>
                    <p class="text-[11px] text-gray-400">Selecciona una sección para configurar sus tipos</p>
                </div>
                <div class="p-2 flex flex-col gap-2">${blocks}</div>
            </div>
        `);

        this.wireModules();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    sectionRow(s) {
        const active = s.section_id === this.activeSectionId;
        const bg = active ? 'bg-[#C05A40]/5' : 'hover:bg-gray-100';
        const disabled = (!this.editing || this.isSystemRole) ? 'disabled' : '';
        return `
            <div class="perm-section flex items-center justify-between pl-8 pr-3 py-1.5 cursor-pointer ${bg}"
                 data-section="${s.section_id}" data-module="${s.module_id}">
                <label class="flex items-center gap-2 cursor-pointer flex-1" onclick="event.stopPropagation()">
                    <input type="checkbox" class="perm-access w-3.5 h-3.5 accent-[#C05A40]"
                           data-section="${s.section_id}" ${s.has_access ? 'checked' : ''} ${disabled}>
                    <span class="text-[13px] text-gray-700">${this.esc(s.section_name)}</span>
                </label>
                <span class="text-[11px] text-gray-300 perm-section-flag">${s.has_access ? '1/1' : '0/1'}</span>
            </div>
        `;
    }

    wireModules() {
        $('#perm-modules .perm-module-head').off('click').on('click', (e) => {
            const $body = $(e.currentTarget).next('.perm-module-body');
            const $chev = $(e.currentTarget).find('.perm-chevron');
            if ($body.hasClass('hidden')) {
                $body.removeClass('hidden').hide().slideDown(120);
                $chev.removeClass('-rotate-90');
            } else {
                $body.slideUp(120, () => $body.addClass('hidden').removeAttr('style'));
                $chev.addClass('-rotate-90');
            }
        });

        $('#perm-modules .perm-section').off('click').on('click', (e) => {
            this.activeSectionId = $(e.currentTarget).data('section');
            this.highlightSection();
            this.loadSectionTypes(this.activeSectionId);
        });

        $('#perm-modules .perm-access').off('change').on('change', (e) => {
            e.stopPropagation();
            if (!this.editing) return;
            const cb = e.currentTarget;
            const secId = $(cb).data('section');
            const grant = cb.checked ? 1 : 0;
            this.pending.access[secId] = { section_id: secId, grant: grant };
            const sec = this.sections.find(x => x.section_id === secId);
            if (sec) sec.has_access = grant === 1;
            this.refreshCounters();
        });
    }

    highlightSection() {
        $('#perm-modules .perm-section').each((_i, el) => {
            const on = $(el).data('section') === this.activeSectionId;
            $(el).toggleClass('bg-[#C05A40]/5', on);
        });
    }

    /* ===== Columna 3: Tipos de permiso de la sección ===== */

    async loadSectionTypes(sectionId) {
        const s = this.sections.find(x => x.section_id === sectionId);
        if (!s) { this.renderDetail(null, []); return; }

        const res = await useFetch({
            url: this._link,
            data: { opc: 'sectionPermissionTypes', role_id: this.activeRoleId, section_id: sectionId }
        });

        if (!res || res.status !== 200) {
            this.renderDetail(s, []);
            return;
        }

        const types = (res.types || []).map(t => {
            const pendingKey = `${sectionId}_${t.id}`;
            if (this.pending.types[pendingKey] !== undefined) {
                return Object.assign({}, t, { granted: this.pending.types[pendingKey].grant === 1 });
            }
            return t;
        });

        this.renderDetail(s, types);
    }

    detailHeader() {
        const canBulk = this.editing && !this.isSystemRole;
        const bulk = canBulk ? `
            <div class="flex items-center gap-1.5">
                <button id="perm-enable-all" class="px-2 py-1 text-[11px] rounded-lg bg-[#C05A40] text-white hover:bg-[#a94c35]">Habilitar todas</button>
                <button id="perm-disable-all" class="px-2 py-1 text-[11px] rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Deshabilitar todas</button>
            </div>
        ` : '';
        return `
            <div class="px-3 py-2.5 border-b border-gray-100 shrink-0 flex items-center justify-between gap-2 flex-wrap">
                <h3 class="text-sm font-semibold text-gray-800">Tipos de permiso</h3>
                ${bulk}
            </div>
        `;
    }

    renderDetail(s, types) {
        if (!s) {
            $('#perm-detail').html(`
                <div class="bg-white border border-gray-200 rounded-xl flex flex-col h-full overflow-hidden">
                    ${this.detailHeader()}
                    <div class="flex flex-col items-center justify-center text-center text-gray-300 flex-1 py-12 px-4">
                        <i data-lucide="mouse-pointer-click" class="w-8 h-8 mb-2"></i>
                        <p class="text-xs">Selecciona una sección para ver sus permisos</p>
                    </div>
                </div>
            `);
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        const path = [s.module_name, s.submodule_name, s.section_name].filter(Boolean).map(t => this.esc(t)).join(' › ');
        const stateTag = s.has_access
            ? '<span class="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700">Con acceso</span>'
            : '<span class="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-500">Sin acceso</span>';

        const disabled = (!this.editing || this.isSystemRole) ? 'disabled' : '';

        const typeRows = types.map(t => `
            <div class="flex items-center justify-between px-2.5 py-2 rounded-lg border border-gray-100 bg-gray-50">
                <div class="flex items-center gap-2">
                    <i data-lucide="shield-check" class="w-3.5 h-3.5 text-[#C05A40]"></i>
                    <p class="text-[13px] font-medium text-gray-700">${this.esc(t.name)}</p>
                </div>
                <input type="checkbox" class="perm-type-check w-4 h-4 accent-[#C05A40]"
                       data-section="${s.section_id}" data-type="${t.id}" ${t.granted ? 'checked' : ''} ${disabled}>
            </div>
        `).join('');

        $('#perm-detail').html(`
            <div class="bg-white border border-gray-200 rounded-xl flex flex-col h-full overflow-hidden">
                ${this.detailHeader()}
                <div class="p-3">
                    <div class="flex items-center gap-2.5 mb-1">
                        ${this.avatar(s.section_name, 'w-8 h-8 text-[11px]')}
                        <div class="min-w-0">
                            <p class="text-sm font-medium text-gray-800 truncate leading-tight">${this.esc(s.section_name)}</p>
                            <div class="mt-0.5">${stateTag}</div>
                        </div>
                    </div>
                    <p class="text-[11px] text-gray-400 mb-3">${path}</p>
                    <div class="flex flex-col gap-1.5">${typeRows || '<p class="text-[11px] text-gray-400">No hay tipos de permiso activos</p>'}</div>
                    ${this.isSystemRole ? '<p class="text-[11px] text-gray-400 mt-2.5 flex items-center gap-1.5"><i data-lucide="lock" class="w-3 h-3"></i> Rol del sistema: accesos no editables</p>' : ''}
                </div>
            </div>
        `);

        $('#perm-detail .perm-type-check').off('change').on('change', (e) => {
            if (!this.editing) return;
            const cb = e.currentTarget;
            const secId  = $(cb).data('section');
            const typeId = $(cb).data('type');
            const grant  = cb.checked ? 1 : 0;
            const key = `${secId}_${typeId}`;
            this.pending.types[key] = { section_id: secId, type_id: typeId, grant: grant };
        });

        $('#perm-enable-all').off('click').on('click', () => {
            if (!this.editing) return;
            const moduleId = s ? (s.module_id || 0) : 0;
            this.bulkSections(1, moduleId);
        });
        $('#perm-disable-all').off('click').on('click', () => {
            if (!this.editing) return;
            const moduleId = s ? (s.module_id || 0) : 0;
            this.bulkSections(0, moduleId);
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /* ===== Guardado batch ===== */

    async save() {
        const accessList = Object.values(this.pending.access);
        const typesList  = Object.values(this.pending.types);

        if (!accessList.length && !typesList.length) {
            this.editing = false;
            this.renderHeader();
            this.applyEditState();
            return;
        }

        const changes = JSON.stringify({ access: accessList, types: typesList });
        const r = await useFetch({
            url: this._link,
            data: { opc: 'savePermissions', role_id: this.activeRoleId, changes: changes }
        });

        notify(r);
        if (r && r.status === 200) {
            this.editing = false;
            this.pending = { access: {}, types: {} };
            await this.loadMatrix(this.activeRoleId);
            await this.loadRoles();
        }
    }

    /* ===== Bulk de acceso (modo edición, solo actualiza pending) ===== */

    bulkSections(grant, moduleId) {
        if (!this.editing || this.isSystemRole) return;
        const targets = moduleId
            ? this.sections.filter(s => s.module_id === moduleId)
            : this.sections;
        targets.forEach(s => {
            this.pending.access[s.section_id] = { section_id: s.section_id, grant: grant };
            s.has_access = grant === 1;
        });
        this.renderModules();
        if (this.activeSectionId) this.loadSectionTypes(this.activeSectionId);
    }

    /* ===== Contadores ===== */

    refreshCounters() {
        const groups = this.groupByModule();
        Object.keys(groups).forEach(mid => {
            const g = groups[mid];
            const granted = g.items.filter(s => s.has_access).length;
            $(`#perm-modules .perm-module-head[data-module="${mid}"] span:last-child`).text(`${granted}/${g.items.length}`);
        });
        this.sections.forEach(s => {
            $(`#perm-modules .perm-section[data-section="${s.section_id}"] .perm-section-flag`).text(s.has_access ? '1/1' : '0/1');
        });
        const totalGranted = this.sections.filter(s => s.has_access).length;
        $(`#perm-role-list .perm-role-item[data-id="${this.activeRoleId}"] .text-gray-400`).text(`${totalGranted}/${this.sections.length} sesiones`);
        const role = this.roles.find(r => r.id === this.activeRoleId);
        if (role) role.granted = totalGranted;
        this.renderHeader();
    }

    /* ===== Helpers ===== */

    groupByModule() {
        const groups = {};
        const icons = { Inventario: 'package', Ventas: 'shopping-cart' };
        this.sections.forEach(s => {
            const mid = s.module_id || 0;
            if (!groups[mid]) groups[mid] = { name: s.module_name || 'Sin módulo', icon: icons[s.module_name] || 'layout-grid', items: [] };
            groups[mid].items.push(s);
        });
        return groups;
    }

    avatar(name, size = 'w-9 h-9 text-xs') {
        const parts = (name || '?').trim().split(/\s+/);
        let ini = (parts[0] || '?').charAt(0);
        if (parts.length > 1) ini += parts[parts.length - 1].charAt(0);
        else if (parts[0].length > 1) ini += parts[0].charAt(1);
        const norm = (name || '').trim().toLowerCase();
        if (norm === 'super admin' || norm === 'superadmin') {
            return `<span class="inline-flex items-center justify-center ${size} rounded-full bg-gray-900 text-white font-semibold shrink-0">${this.esc(ini.toUpperCase())}</span>`;
        }
        const palette = [
            'bg-slate-100 text-slate-700', 'bg-rose-100 text-rose-700', 'bg-amber-100 text-amber-700',
            'bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-violet-100 text-violet-700',
            'bg-fuchsia-100 text-fuchsia-700', 'bg-cyan-100 text-cyan-700', 'bg-orange-100 text-orange-700',
            'bg-teal-100 text-teal-700', 'bg-indigo-100 text-indigo-700', 'bg-lime-100 text-lime-700'
        ];
        let h = 0; for (const c of (name || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
        const color = palette[h % palette.length];
        return `<span class="inline-flex items-center justify-center ${size} rounded-full ${color} font-semibold shrink-0">${this.esc(ini.toUpperCase())}</span>`;
    }

    emptyCard(msg) {
        return `<div class="bg-white border border-gray-200 rounded-xl p-6 text-sm text-gray-400">${this.esc(msg)}</div>`;
    }

    esc(t) {
        return (t == null ? '' : String(t)).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }
}
