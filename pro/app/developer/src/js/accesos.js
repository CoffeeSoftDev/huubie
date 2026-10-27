let api = 'ctrl/ctrl-accesos.php';
let app, modules, submodules, sections, typePermissions, roles, permissions, users, branches;
let dataInit = {};

$(async () => {
    dataInit = await useFetch({ url: api, data: { opc: 'init' } }) || {};

    modules = new Modules(api, 'root');
    submodules = new Submodules(api, 'root');
    sections = new Sections(api, 'root');
    typePermissions = new TypePermissions(api, 'root');
    roles = new Roles(api, 'root');
    permissions = new Permissions(api, 'root');
    users = new Users(api, 'root');
    branches = new Branches(api, 'root');

    app = new App(api, 'root');
    app.render();
});

// -- App --

class App extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Accesos';
    }

    render() {
        this.layout();
        this.headerBar({ parent: `header${this.PROJECT_NAME}` });
        this.renderTabs();
        this.renderActiveTab();
    }

    layout() {
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id: this.PROJECT_NAME,
                class: 'flex flex-col mx-2 flex-1',
                container: [
                    { type: 'div', id: `header${this.PROJECT_NAME}`, class: 'w-full' },
                    { type: 'div', id: `container${this.PROJECT_NAME}`, class: 'w-full rounded p-2 flex-1 min-h-0 flex flex-col' }
                ]
            }
        });
    }

    headerBar(options) {
        $(`#${options.parent}`).empty().append(
            $('<div>', { class: 'flex items-center gap-3 px-2 pt-2 pb-2' }).append(
                $('<div>', { class: 'flex items-center justify-center w-11 h-11 rounded-xl bg-blue-50 text-blue-600' })
                    .append($('<i>', { 'data-lucide': 'shield', class: 'w-6 h-6' })),
                $('<div>').append(
                    $('<h2>', { class: 'text-2xl font-semibold tracking-tight', text: 'Accesos' }),
                    $('<p>', { class: 'text-sm text-gray-400', text: 'Secciones, roles, permisos y usuarios' })
                )
            )
        );
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    renderTabs() {
        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: 'light',
            type: 'button',
            content: { class: 'flex-1 min-h-0 flex flex-col' },
            json: [
                {
                    id: 'tipos-permiso',
                    tab: 'Tipos de permiso',
                    lucideIcon: 'key-round',
                    class: 'p-3 flex-1 min-h-0 flex flex-col',
                    active: true,
                    onClick: () => { typePermissions.render(); typePermissions.lsTypePermissions(); }
                },
                {
                    id: 'secciones',
                    tab: 'Secciones',
                    lucideIcon: 'layout-list',
                    class: 'p-3 flex-1 min-h-0 flex flex-col',
                    onClick: () => { sections.render(); sections.lsSections(); }
                },
                {
                    id: 'submodulos',
                    tab: 'Submódulos',
                    lucideIcon: 'folder-tree',
                    class: 'p-3 flex-1 min-h-0 flex flex-col',
                    onClick: () => { submodules.render(); submodules.lsSubmodules(); }
                },
                {
                    id: 'roles',
                    tab: 'Roles',
                    lucideIcon: 'users',
                    class: 'p-3 flex-1 min-h-0 flex flex-col',
                    onClick: () => { roles.render(); roles.lsRoles(); }
                },
                {
                    id: 'permisos',
                    tab: 'Permisos',
                    lucideIcon: 'shield-check',
                    class: 'p-3 flex-1 min-h-0 flex flex-col',
                    onClick: () => { permissions.render(); permissions.lsPermissions(); }
                },
                {
                    id: 'usuarios',
                    tab: 'Usuarios',
                    lucideIcon: 'user-cog',
                    class: 'p-3 flex-1 min-h-0 flex flex-col',
                    onClick: () => { users.render(); users.lsUsers(); }
                },
                {
                    id: 'sucursales',
                    tab: 'Sucursales',
                    lucideIcon: 'map-pin',
                    class: 'p-3 flex-1 min-h-0 flex flex-col',
                    onClick: () => branches.render()
                }
            ]
        });
    }

    renderActiveTab() {
        sections.render();
        sections.lsSections();
        typePermissions.render();
        typePermissions.lsTypePermissions();
    }
}

// -- Módulos --

class Modules extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Modules';
    }

    // Ya no tiene pestaña propia: se administra desde el panel de la pestaña Secciones,
    // que pasa en onSaved cómo refrescarse al guardar.

    addModule(onSaved) {
        this.createModalForm({
            id: 'formModuleAdd',
            data: {
                opc: 'addModule'
            },
            theme: 'light',
            coffeesoft: true,
            bootbox: {
                title: 'Nuevo Módulo'
            },
            json: this.jsonModule(),
            success: (r) => afterSave(r, onSaved)
        });
        this.mountIconField('formModuleAdd');
    }

    async editModule(id, onSaved) {
        const request = await useFetch({ url: this._link, data: { opc: 'getModule', id: id } });
        if (request.status !== 200) { alert({ icon: 'error', text: request.message || 'No se pudo cargar el módulo', btn1: true }); return; }

        // El título del modal acepta HTML (cfModal lo pinta con .html), así que el
        // nombre del módulo se resalta con el acento del tema (blue-* remapeado).
        const name  = request.data && request.data.name ? request.data.name : '';
        const title = name
            ? `Editar Módulo · <span class="text-blue-600 font-bold">${this.esc(name)}</span>`
            : 'Editar Módulo';

        this.createModalForm({
            id: 'formModuleEdit',
            data: {
                opc: 'editModule',
                id: id
            },
            theme: 'light',
            coffeesoft: true,
            bootbox: {
                title: title
            },
            autofill: request.data,
            json: this.jsonModule(),
            success: (r) => afterSave(r, onSaved)
        });
        this.mountIconField('formModuleEdit', request.data ? request.data.icon : '');
    }

    /*  Planta el selector de íconos dentro del hueco que dejó jsonModule.
        Va aparte y no como un `opc` del formulario porque csIconField no es un
        campo de CoffeeSoft: es un componente propio (cs-icon-picker.js) que se
        inyecta ya montado el modal. El `name` es lo que hace que el valor viaje
        en el FormData del form. */
    mountIconField(formId, value) {
        const $wrap = $(`#${formId}`).find('#iconFieldWrap');
        if (!$wrap.length) return;

        /*  `inputClass` no es opcional en la práctica: csIconField pinta el <input>
            con la clase que le pasen y nada más, así que sin esto sale sin borde ni
            alto y desentona con el resto del formulario. Le damos la MISMA clase que
            coffeeForm usa en sus inputs (CF_CSS.input, filtrada al tema claro). */
        $wrap.html(this.csIconField({
            id: 'icon',
            name: 'icon',
            value: value || '',
            inputClass: this.cfThemedClass(CF_CSS.input, 'light')
        }));
        this.csIconFieldBind($wrap);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    toggleModule(id, active, onSaved) {
        this.swalQuestion({
            opts: {
                title: `¿${active == 1 ? 'Activar' : 'Desactivar'} módulo?`,
                text: `¿Deseas ${active == 1 ? 'activar' : 'desactivar'} este módulo?`,
                icon: 'warning'
            },
            data: {
                opc: 'toggleModule',
                id: id,
                active: active
            },
            methods: {
                send: (r) => afterSave(r, onSaved)
            }
        });
    }

    jsonModule() {
        return [
            { opc: 'input', id: 'name', lbl: 'Nombre del módulo', class: 'col-12 col-md-6 mb-3', required: true, onkeyup: 'autoCode(this.value)' },
            { opc: 'input', id: 'code', lbl: 'Código (automático)', class: 'col-12 col-md-6 mb-3', readonly: true },
            // Hueco vacío: lo rellena mountIconField() con el selector de íconos.
            { opc: 'div', id: 'iconFieldWrap', lbl: 'Ícono', class: 'col-12 col-md-6 mb-3' },
            { opc: 'select', id: 'route', lbl: 'Ruta', class: 'col-12 col-md-6 mb-3', selected: '-- Selecciona --', select2: true, data: dataInit.routes || [] },
            { opc: 'input', id: 'description', lbl: 'Descripción', class: 'col-12 mb-3', placeholder: 'Texto que se muestra en la tarjeta' }
        ];
    }

    esc(t) {
        return (t == null ? '' : String(t)).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
            attr: { id: 'tbSubmodules', theme: 'light', striped: true, center: [5, 6], right: [] }
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

        const name  = request.data && request.data.name ? request.data.name : '';
        const title = name
            ? `Editar Submódulo · <span class="text-blue-600 font-bold">${esc(name)}</span>`
            : 'Editar Submódulo';

        this.createModalForm({
            id: 'formSubmoduleEdit', data: { opc: 'editSubmodule', id: id }, theme: 'light', coffeesoft: true,
            bootbox: { title: title }, autofill: request.data, json: this.jsonSubmodule(),
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

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Sections';
        this.rows = [];
        this.moduleCatalog = [];
        this.submoduleCatalog = [];
        this.activeModuleId = 0;
        this.search = '';
        this.collapsed = {};
    }

    get status() {
        return String($('#filterbar-sections #active').val() || '1');
    }

    // -- Interface --

    render() {
        this.search = '';
        this.layout();
        this.filterBar();
    }

    layout() {
        this.createLayout({
            parent: 'container-secciones',
            design: false,
            data: {
                id: 'sectionsBoard',
                class: 'flex flex-col gap-2 flex-1 min-h-0',
                container: [
                    {
                        type: 'div',
                        id: 'filterbar-sections',
                        class: 'w-full'
                    },
                    {
                        type: 'div',
                        id: 'sections-body',
                        class: 'grid grid-cols-1 lg:grid-cols-12 gap-2 items-stretch flex-1 min-h-0',
                        children: [
                            {
                                id: 'sections-modules',
                                class: 'lg:col-span-3 min-h-0'
                            },
                            {
                                id: 'sections-list',
                                class: 'lg:col-span-9 min-h-0'
                            }
                        ]
                    }
                ]
            }
        });
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterbar-sections',
            data: [
                {
                    opc: 'input',
                    id: 'searchSection',
                    lbl: 'Buscar',
                    placeholder: 'Buscar sección…',
                    class: 'col-12 col-sm-4 col-lg-2',
                    required: false,
                    onkeyup: 'sections.onSearch(this.value)'
                },
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    class: 'col-12 col-sm-4 col-lg-2',
                    data: (dataInit.statusFilter || []).concat([
                        {
                            id: 'all',
                            valor: 'Todos'
                        }
                    ]),
                    onchange: 'sections.lsSections()'
                },
                {
                    opc: 'button',
                    id: 'btnNewSection',
                    class: 'col-12 col-sm-4 col-lg-2',
                    text: 'Nueva Sección',
                    onClick: () => this.addSection()
                }
            ]
        });
    }

    renderModules() {
        this.csNavList({
            parent: 'sections-modules',
            id: 'navSectionModules',
            title: 'Módulos',
            addTitle: 'Nuevo módulo',
            active: this.activeModuleId,
            json: this.buildModuleItems(),
            onSelect: (item) => this.onModuleSelect(item),
            onAdd: () => modules.addModule(() => this.lsSections()),
            onEdit: (item) => modules.editModule(item.id, () => this.lsSections()),
            onToggle: (item) => modules.toggleModule(item.id, item.on ? 0 : 1, () => this.lsSections())
        });
    }

    renderBoard() {
        const searching = this.search !== '';
        const hints = {
            '1': 'Revisa cómo está escrito o cambia Estado a Inactivos: las secciones apagadas viven ahí.',
            '0': 'Revisa cómo está escrito o cambia Estado a Activos: aquí solo se buscan las apagadas.',
            all: 'Revisa cómo está escrito.'
        };

        let empty = {
            icon: 'mouse-pointer-click',
            title: 'Elige un módulo para ver sus secciones',
            text: 'El panel izquierdo las cuenta por módulo, o escribe en el buscador para cruzarlas todas.'
        };

        if (searching) {
            empty = {
                icon: 'search-x',
                title: `Sin resultados para «${this.search}»`,
                text: hints[this.status] || hints.all
            };
        }

        this.csGroupedList({
            parent: 'sections-list',
            id: 'listSections',
            sortable: !searching,
            switchable: true,
            renamable: true,
            empty: empty,
            json: searching
                ? this.buildSearchGroups()
                : (this.activeModuleId ? this.buildSubmoduleGroups() : []),
            onSelect: (item) => this.editSection(item.id),
            onSort: (group, ids) => this.sortSections(group, ids),
            onToggle: (item) => this.toggleSection(item.id, item.on ? 0 : 1),
            onRename: (group, name) => this.renameSubmodule(group.submoduleId, name),
            onRenameItem: (item, name) => this.renameSection(item.id, name),
            onDelete: (item) => this.deleteSection(item.id),
            onGroupToggle: (group, open) => this.onGroupToggle(group, open)
        });
    }

    // -- CRUD --

    async lsSections() {
        const request = await useFetch({
            url: this._link,
            data: {
                opc: 'lsSections',
                active: this.status
            }
        });

        if (!request || request.status !== 200) {
            notify(request);
            return;
        }

        this.rows = request.ls || [];
        this.moduleCatalog = request.modules || [];
        this.submoduleCatalog = request.submodules || [];
        this.sortRows();

        // Los selects de Módulo (modal de sección y de submódulo) salen de dataInit:
        // se refrescan aquí porque los módulos ahora se crean y apagan desde este panel.
        dataInit.modules = this.moduleCatalog
            .filter(m => Number(m.is_active) === 1)
            .map(m => ({
                id: m.id,
                valor: m.name
            }));

        const visible = this.buildModuleItems().some(m => m.id && String(m.id) === String(this.activeModuleId));
        if (!visible) this.activeModuleId = 0;

        this.renderModules();
        this.renderBoard();
    }

    // Reparte los mismos números de orden del grupo en el nuevo acomodo (sin empates)
    // y solo envía las secciones cuyo orden cambió.
    async sortSections(group, ids) {
        const rows = ids.map(id => this.rows.find(r => Number(r.id) === Number(id))).filter(Boolean);
        const slots = rows.map(r => Number(r.orden)).sort((a, b) => a - b);

        let prev = -Infinity;
        const items = rows
            .map((r, i) => {
                const orden = Math.max(slots[i], prev + 1);
                prev = orden;
                return {
                    id: Number(r.id),
                    orden: orden
                };
            })
            .filter(x => Number(this.rows.find(r => Number(r.id) === x.id).orden) !== x.orden);

        if (!items.length) return;

        const request = await useFetch({
            url: this._link,
            data: {
                opc: 'sortSections',
                items: JSON.stringify(items)
            }
        });

        if (request && request.status === 200) {
            items.forEach((x) => { this.rows.find(r => Number(r.id) === x.id).orden = x.orden; });
            this.sortRows();
        } else {
            notify(request);
        }

        this.renderBoard();
    }

    addSection() {
        if (!(dataInit.modules || []).length) {
            alert({
                icon: 'info',
                text: 'Primero registra al menos un módulo activo',
                btn1: true
            });
            return;
        }

        const inherits = (dataInit.modules || []).some(m => String(m.id) === String(this.activeModuleId));

        this.createModalForm({
            id: 'formSectionAdd',
            data: {
                opc: 'addSection'
            },
            theme: 'light',
            coffeesoft: true,
            bootbox: {
                title: 'Nueva Sección'
            },
            autofill: inherits ? { module_id: String(this.activeModuleId) } : false,
            json: this.jsonSection(),
            success: (r) => afterSave(r, () => this.lsSections())
        });

        modules.mountIconField('formSectionAdd');
    }

    async editSection(id) {
        const request = await useFetch({
            url: this._link,
            data: {
                opc: 'getSection',
                id: id
            }
        });

        if (request.status !== 200) {
            alert({
                icon: 'error',
                text: request.message || 'No se pudo cargar la sección',
                btn1: true
            });
            return;
        }

        const name = request.data && request.data.name ? request.data.name : '';
        const title = name
            ? `Editar Sección · <span class="text-blue-600 font-bold">${esc(name)}</span>`
            : 'Editar Sección';

        this.createModalForm({
            id: 'formSectionEdit',
            data: {
                opc: 'editSection',
                id: id
            },
            theme: 'light',
            coffeesoft: true,
            bootbox: {
                title: title
            },
            autofill: request.data,
            json: this.jsonSection(),
            success: (r) => afterSave(r, () => this.lsSections())
        });

        // Al editar, el código no sigue al nombre: es la llave de los permisos.
        $('#formSectionEdit #name').removeAttr('onkeyup');

        modules.mountIconField('formSectionEdit', request.data ? request.data.icon : '');
    }

    toggleSection(id, active) {
        this.swalQuestion({
            opts: {
                title: `¿${active == 1 ? 'Activar' : 'Desactivar'} sección?`,
                text: `¿Deseas ${active == 1 ? 'activar' : 'desactivar'} esta sección?`,
                icon: 'warning'
            },
            data: {
                opc: 'toggleSection',
                id: id,
                active: active
            },
            methods: {
                send: (r) => afterSave(r, () => this.lsSections())
            }
        });
    }

    deleteSection(id) {
        this.swalQuestion({
            opts: {
                title: '¿Eliminar sección?',
                text: 'Se borran la sección y sus permisos. La carpeta y sus archivos no se tocan. Esta acción no se puede deshacer.',
                icon: 'warning'
            },
            data: {
                opc: 'deleteSection',
                id: id
            },
            methods: {
                send: (r) => afterSave(r, () => this.lsSections())
            }
        });
    }

    async renameSection(id, name) {
        const request = await useFetch({
            url: this._link,
            data: {
                opc: 'renameSection',
                id: id,
                name: name
            }
        });

        notify(request);

        if (request && request.status === 200) {
            this.lsSections();
            return;
        }

        this.renderBoard();
    }

    async renameSubmodule(id, name) {
        const request = await useFetch({
            url: this._link,
            data: {
                opc: 'renameSubmodule',
                id: id,
                name: name
            }
        });

        notify(request);

        if (request && request.status === 200) {
            const option = (dataInit.submodules || []).find(s => Number(s.id) === Number(id));
            if (option) option.valor = name;
            this.lsSections();
            return;
        }

        this.renderBoard();
    }

    jsonSection() {
        return [
            {
                opc: 'input',
                id: 'name',
                lbl: 'Nombre de la sección',
                class: 'col-12 col-md-6 mb-3',
                required: true,
                onkeyup: 'autoCode(this.value)'
            },
            {
                opc: 'select',
                id: 'module_id',
                lbl: 'Módulo',
                class: 'col-12 col-md-6 mb-3',
                required: true,
                data: dataInit.modules || []
            },
            {
                opc: 'select',
                id: 'submodule_id',
                lbl: 'Submódulo (opcional)',
                class: 'col-12 col-md-6 mb-3',
                selected: '-- Selecciona --',
                data: dataInit.submodules || []
            },
            {
                opc: 'input',
                id: 'code',
                lbl: 'Código (automático)',
                class: 'col-12 col-md-6 mb-3',
                readonly: true
            },
            {
                opc: 'div',
                id: 'iconFieldWrap',
                lbl: 'Ícono',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'orden',
                lbl: 'Orden',
                type: 'number',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'select',
                id: 'route',
                lbl: 'Ruta',
                class: 'col-12 mb-3',
                selected: '-- Selecciona --',
                select2: true,
                data: dataInit.routes || []
            }
        ];
    }

    // -- Complements --

    onModuleSelect(item) {
        this.activeModuleId = item.id;
        this.renderModules();
        this.renderBoard();
    }

    onSearch(value) {
        const search = (value || '').trim();
        if (search === this.search) return;
        this.search = search;
        this.renderBoard();
    }

    onGroupToggle(group, open) {
        this.collapsed[group.id] = !open;
    }

    // Activos: módulos encendidos + apagados que guarden secciones del filtro.
    // Inactivos/Todos: todos los módulos, para poder encender los apagados.
    buildModuleItems() {
        const status = this.status;
        const catalog = this.moduleCatalog.slice();

        this.rows.forEach((r) => {
            if (!catalog.some(m => Number(m.id) === Number(r.module_id))) {
                catalog.push({
                    id: r.module_id,
                    name: r.module_name || 'Sin módulo',
                    is_active: 0,
                    orphan: true
                });
            }
        });

        const items = catalog
            .map((m) => {
                const count = this.rows.filter(r => Number(r.module_id) === Number(m.id)).length;
                const off = Number(m.is_active) !== 1;
                return {
                    id: Number(m.id),
                    label: m.name,
                    icon: m.icon || 'layout-grid',
                    count: count,
                    meta: this.countLabel(count, status, false),
                    tag: off ? 'módulo apagado' : '',
                    muted: off,
                    off: off,
                    on: !off,
                    editable: !m.orphan,
                    switchable: !m.orphan
                };
            })
            .filter(m => !m.off || m.count > 0 || status !== '1');

        items.unshift({
            id: 0,
            label: 'Todos',
            icon: 'layers',
            count: this.rows.length,
            meta: this.countLabel(this.rows.length, status, true)
        });

        return items;
    }

    // "Sin submódulo" primero; luego todos los submódulos del módulo, incluidos los apagados.
    buildSubmoduleGroups() {
        const moduleId = Number(this.activeModuleId);
        const inactive = this.status === '0';
        const rows = this.rows.filter(r => Number(r.module_id) === moduleId);

        const subs = this.submoduleCatalog.filter(s => Number(s.module_id) === moduleId);
        rows.forEach((r) => {
            if (r.submodule_id && !subs.some(s => Number(s.id) === Number(r.submodule_id))) {
                subs.push({
                    id: r.submodule_id,
                    name: r.submodule_name || 'Submódulo',
                    is_active: 1
                });
            }
        });

        const groups = [
            {
                id: `${moduleId}-0`,
                title: 'Sin submódulo',
                emptyText: inactive
                    ? 'No hay secciones apagadas sin submódulo.'
                    : 'Sin secciones todavía. Usa «Nueva Sección» para registrar la primera.',
                items: rows.filter(r => !r.submodule_id).map(r => this.sectionItem(r))
            }
        ];

        subs.forEach((s) => {
            const off = Number(s.is_active) !== 1;
            groups.push({
                id: `${moduleId}-${s.id}`,
                submoduleId: Number(s.id),
                title: s.name,
                editable: true,
                tag: off ? 'apagado' : '',
                muted: off,
                emptyText: inactive
                    ? 'No hay secciones apagadas en este submódulo.'
                    : 'Sin secciones en este submódulo.',
                items: rows.filter(r => Number(r.submodule_id) === Number(s.id)).map(r => this.sectionItem(r))
            });
        });

        groups.forEach((g) => { g.open = !this.collapsed[g.id]; });

        return groups;
    }

    // La búsqueda ignora el módulo elegido: cruza todos y agrupa por módulo.
    buildSearchGroups() {
        const query = this.normalize(this.search);

        return this.buildModuleItems()
            .filter(m => m.id)
            .map((m) => {
                const items = this.rows
                    .filter(r => Number(r.module_id) === m.id && this.normalize(r.name).includes(query))
                    .map(r => this.sectionItem(r));
                return {
                    id: `search-${m.id}`,
                    title: m.label,
                    tag: m.tag,
                    count: `${items.length} ${items.length === 1 ? 'resultado' : 'resultados'}`,
                    items: items
                };
            })
            .filter(g => g.items.length);
    }

    sectionItem(row) {
        const on = Number(row.is_active) === 1;
        const note = !on && row.duplicate_of
            ? `Duplica a «${row.duplicate_of}» activa: misma ruta ${row.route || ''}. Encenderla pintaría dos items idénticos en el menú.`
            : '';

        return {
            id: Number(row.id),
            title: row.name,
            subtitle: row.route || 'Sin ruta',
            icon: row.icon || 'square',
            on: on,
            deletable: !on,
            muted: !on,
            note: note
        };
    }

    sortRows() {
        this.rows.sort((a, b) => (Number(a.orden) - Number(b.orden)) || (Number(a.id) - Number(b.id)));
    }

    countLabel(count, status, all) {
        const noun = `${count} ${count === 1 ? 'sección' : 'secciones'}`;
        if (all && status === '1') return `${noun} ${count === 1 ? 'activa' : 'activas'}`;
        if (all && status === '0') return `${noun} ${count === 1 ? 'inactiva' : 'inactivas'}`;
        if (all) return noun;
        if (status === '0') return `${count} ${count === 1 ? 'inactiva' : 'inactivas'}`;
        if (!count) return 'sin secciones aún';
        return `${count} ${count === 1 ? 'sección' : 'secciones'}`;
    }

    normalize(text) {
        return (text || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
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
            attr: { id: 'tbTypes', theme: 'light', striped: true, center: [2, 3], right: [] }
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

        const name  = request.data && request.data.name ? request.data.name : '';
        const title = name
            ? `Editar Tipo de Permiso · <span class="text-blue-600 font-bold">${esc(name)}</span>`
            : 'Editar Tipo de Permiso';

        this.createModalForm({
            id: 'formTypeEdit', data: { opc: 'editTypePermission', id: id }, theme: 'light', coffeesoft: true,
            bootbox: { title: title }, autofill: request.data, json: this.jsonType(),
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

    deleteTypePermission(id) {
        this.swalQuestion({
            opts: { title: '¿Eliminar tipo de permiso?', text: 'Esta acción no se puede deshacer.', icon: 'warning' },
            data: { opc: 'deleteTypePermission', id: id },
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
                {
                    opc: 'select',
                    id: 'company_id',
                    lbl: 'Empresa',
                    class: 'col-12 col-md-3',
                    data: this.companyFilter(),
                    onchange: 'roles.lsRoles()'
                },
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    class: 'col-12 col-md-3',
                    data: dataInit.statusFilter || [],
                    onchange: 'roles.lsRoles()'
                },
                {
                    opc: 'button',
                    id: 'btnNewRole',
                    class: 'col-12 col-md-3',
                    text: 'Nuevo Rol',
                    onClick: () => this.addRole()
                }
            ]
        });
    }

    lsRoles() {
        this.createTable({
            parent: 'table-roles', idFilterBar: 'filterbar-roles',
            data: { opc: 'lsRoles' }, coffeesoft: true, conf: { datatable: true, pag: 10 },
            attr: { id: 'tbRoles', theme: 'light', striped: true, center: [4, 5, 6], right: [] }
        });
    }

    // El rol nuevo nace en la empresa que esté filtrada; con Todas o Sistema se elige en el modal.
    async addRole() {
        if (!(dataInit.companies || []).length) {
            alert({ icon: 'info', text: 'Primero registra al menos una empresa activa', btn1: true });
            return;
        }

        const access = await useFetch({ url: this._link, data: { opc: 'getRolePermissions', id: 0 } });
        if (!access || access.status !== 200) { notify(access); return; }

        const filter = String($('#filterbar-roles [name="company_id"]').val() || '');

        this.createModalForm({
            id: 'formRoleAdd', data: { opc: 'addRole' }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Nuevo Rol', size: 'xl' }, json: this.jsonRole(false, this.companySelect(/^\d+$/.test(filter) ? filter : '')),
            success: (r) => afterSave(r, () => this.lsRoles())
        });
        this.permissionPicker(access);
    }

    async editRole(id) {
        const [request, access] = await Promise.all([
            useFetch({ url: this._link, data: { opc: 'getRole', id: id } }),
            useFetch({ url: this._link, data: { opc: 'getRolePermissions', id: id } })
        ]);
        if (request.status !== 200) { alert({ icon: 'error', text: request.message || 'No se pudo cargar el rol', btn1: true }); return; }
        if (!access || access.status !== 200) { notify(access); return; }

        const name  = request.data && request.data.name ? request.data.name : '';
        const title = name
            ? `Editar Rol · <span class="text-blue-600 font-bold">${esc(name)}</span>`
            : 'Editar Rol';

        this.createModalForm({
            id: 'formRoleEdit', data: { opc: 'editRole', id: id }, theme: 'light', coffeesoft: true,
            bootbox: { title: title, size: 'xl' }, autofill: request.data, json: this.jsonRole(access.fullAccess, this.companyReadonly()),
            success: (r) => afterSave(r, () => this.lsRoles())
        });
        this.permissionPicker(access);
    }

    toggleRole(id, active) {
        this.swalQuestion({
            opts: { title: `¿${active == 1 ? 'Activar' : 'Desactivar'} rol?`, text: `¿Deseas ${active == 1 ? 'activar' : 'desactivar'} este rol?`, icon: 'warning' },
            data: { opc: 'toggleRole', id: id, active: active },
            methods: { send: (r) => afterSave(r, () => this.lsRoles()) }
        });
    }

    // El código del Super Admin es el que le da el acceso total: no se edita.
    jsonRole(fullAccess, company) {
        return [
            company,
            { opc: 'input', id: 'code', lbl: 'Código', class: 'col-12 col-md-6 mb-3', readonly: fullAccess },
            { opc: 'input', id: 'name', lbl: 'Nombre del rol', class: 'col-12 col-md-6 mb-3', required: true },
            // Hueco vacío: lo rellena permissionPicker() con las acciones de cada sección.
            { opc: 'div', id: 'rolePermissionsWrap', class: 'col-12', required: false }
        ];
    }

    // -- Empresa del rol --

    companyFilter() {
        return [
            {
                id: 'all',
                valor: 'Todas'
            },
            {
                id: 'system',
                valor: 'Roles del sistema'
            }
        ].concat(dataInit.companies || []);
    }

    companySelect(companyId) {
        return {
            opc: 'select',
            id: 'company_id',
            lbl: 'Empresa',
            class: 'col-12 mb-3',
            required: true,
            selected: 'Elige una empresa',
            value: companyId,
            data: dataInit.companies || []
        };
    }

    // Un rol no cambia de empresa: sus usuarios ya están asignados en sucursales de esa empresa.
    companyReadonly() {
        return {
            opc: 'input',
            id: 'company_name',
            lbl: 'Empresa',
            class: 'col-12 mb-3',
            required: false,
            disabled: true
        };
    }

    // -- Permission picker --

    // Módulo > sección > acciones del catálogo. Las marcadas viajan como JSON en el
    // hidden `permissions`; sin ese campo (Super Admin o catálogo vacío) el ctrl no
    // toca los permisos del rol.
    permissionPicker(access) {
        const $wrap = $('#rolePermissionsWrap');
        if (!$wrap.length) return;

        const modules = access.modules || [];

        if (access.fullAccess || !modules.length) {
            $wrap.html(this.pickerNote(
                access.fullAccess ? 'shield-check' : 'info',
                access.fullAccess
                    ? 'Rol del sistema: tiene acceso total a todos los módulos y secciones, por eso sus permisos no se editan.'
                    : 'Todavía no hay acciones definidas. Agrégalas en la pestaña Permisos y vuelve aquí para asignarlas.'
            ));
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        const $input = $('<input>', { type: 'hidden', name: 'permissions' });
        const $count = $('<span>', { class: 'text-xs font-medium text-gray-500 shrink-0' });

        const header = $('<div>', { class: 'flex items-start justify-between gap-3 mb-2' }).append(
            $('<div>').append(
                $('<p>', { class: 'text-sm font-semibold text-gray-800', text: 'Permisos por sección' }),
                $('<p>', { class: 'text-xs text-gray-400', text: 'Solo aparecen las secciones con acciones definidas en la pestaña Permisos.' })
            ),
            $count
        );

        const $list = $('<div>', { class: 'flex flex-col gap-2' });
        modules.forEach(m => $list.append(this.pickerModule(m)));

        $wrap.empty().append(header, $list, $input);

        const refresh = () => this.pickerRefresh($wrap, $input, $count);

        $wrap.on('change', '.perm-action', refresh);
        $wrap.on('change', '.perm-section', (e) => {
            $(e.currentTarget).closest('.perm-section-row').find('.perm-action').prop('checked', e.currentTarget.checked);
            refresh();
        });
        $wrap.on('change', '.perm-module', (e) => {
            $(e.currentTarget).closest('.perm-module-card').find('.perm-action').prop('checked', e.currentTarget.checked);
            refresh();
        });

        refresh();
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    pickerModule(module) {
        const head = $('<div>', { class: 'flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100' }).append(
            $('<label>', { class: 'flex items-center gap-2 cursor-pointer select-none min-w-0' }).append(
                $('<input>', { type: 'checkbox', class: 'perm-module w-4 h-4 accent-blue-600 cursor-pointer' }),
                $('<i>', { 'data-lucide': module.icon, class: 'w-4 h-4 text-gray-500 shrink-0' }),
                $('<span>', { class: 'text-sm font-semibold text-gray-800 truncate', text: module.name })
            ),
            $('<span>', { class: 'perm-module-count text-[11px] font-medium text-gray-400 shrink-0' })
        );

        const body = $('<div>', { class: 'divide-y divide-gray-100' });
        module.sections.forEach(s => body.append(this.pickerSection(s)));

        return $('<div>', { class: 'perm-module-card border border-gray-200 rounded-xl overflow-hidden' }).append(head, body);
    }

    pickerSection(section) {
        const chips = $('<div>', { class: 'flex flex-wrap gap-1.5' });
        section.actions.forEach(a => chips.append(this.pickerChip(a)));

        return $('<div>', { class: 'perm-section-row flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2' }).append(
            $('<label>', { class: 'flex items-center gap-2 cursor-pointer select-none sm:w-48 shrink-0 min-w-0' }).append(
                $('<input>', { type: 'checkbox', class: 'perm-section w-3.5 h-3.5 accent-blue-600 cursor-pointer' }),
                $('<i>', { 'data-lucide': section.icon, class: 'w-3.5 h-3.5 text-gray-400 shrink-0' }),
                $('<span>', { class: 'text-[13px] font-medium text-gray-700 truncate', text: section.name })
            ),
            chips
        );
    }

    // Contorno con ring y sin bg-white/border: Bootstrap marca esas dos clases con
    // !important y le ganarían a peer-checked (quedaba texto blanco sobre blanco).
    pickerChip(action) {
        return $('<label>', { class: 'cursor-pointer select-none' }).append(
            $('<input>', { type: 'checkbox', class: 'perm-action peer sr-only', value: action.id, checked: action.granted }),
            $('<span>', {
                class: 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition '
                    + 'ring-1 ring-inset ring-gray-200 text-gray-600 hover:bg-gray-50 '
                    + 'peer-checked:bg-blue-600 peer-checked:ring-blue-600 peer-checked:text-white '
                    + 'peer-focus-visible:ring-2 peer-focus-visible:ring-blue-600/40',
                text: action.name
            })
        );
    }

    pickerRefresh($wrap, $input, $count) {
        const ids   = $wrap.find('.perm-action:checked').map((_i, el) => Number(el.value)).get();
        const total = $wrap.find('.perm-action').length;

        $input.val(JSON.stringify(ids));
        $count.text(`${ids.length} de ${total} ${total === 1 ? 'acción' : 'acciones'}`);

        $wrap.find('.perm-section-row').each((_i, row) => { this.pickerSync($(row), '.perm-section'); });
        $wrap.find('.perm-module-card').each((_i, card) => {
            const n = this.pickerSync($(card), '.perm-module');
            $(card).find('.perm-module-count').text(`${n.on}/${n.total}`);
        });
    }

    // La casilla de "todas": marcada si están todas, a medias si solo algunas.
    pickerSync($scope, selector) {
        const total = $scope.find('.perm-action').length;
        const on    = $scope.find('.perm-action:checked').length;

        $scope.find(selector).first().prop({
            checked: total > 0 && on === total,
            indeterminate: on > 0 && on < total
        });

        return { on: on, total: total };
    }

    pickerNote(icon, text) {
        return $('<div>', { class: 'flex items-start gap-2 p-3 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-500' }).append(
            $('<i>', { 'data-lucide': icon, class: 'w-4 h-4 shrink-0 text-gray-400' }),
            $('<span>', { text: text })
        );
    }
}

// -- Permisos --
// Catálogo de acciones de cada sección (permissions). Qué acciones tiene cada
// rol se elige en el modal del rol (pestaña Roles).

class Permissions extends Templates {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Permissions';
        this.modules = [];
        this.sections = [];
        this.types = [];
        this.catalog = {};
        this.activeModuleId = 0;
    }

    // -- Interface --

    render() {
        this.layout();
    }

    layout() {
        this.createLayout({
            parent: 'container-permisos',
            design: false,
            data: {
                id: 'permissionsBoard',
                class: 'grid grid-cols-1 lg:grid-cols-12 gap-2 items-stretch flex-1 min-h-0',
                container: [
                    {
                        type: 'div',
                        id: 'permissions-modules',
                        class: 'lg:col-span-3 min-h-0'
                    },
                    {
                        type: 'div',
                        id: 'permissions-matrix',
                        class: 'lg:col-span-9 min-h-0'
                    }
                ]
            }
        });
    }

    renderModules() {
        this.csNavList({
            parent: 'permissions-modules',
            id: 'navPermissionModules',
            title: 'Módulos',
            active: this.activeModuleId,
            json: this.buildModuleItems(),
            onSelect: (item) => this.onModuleSelect(item)
        });
    }

    renderMatrix() {
        const module   = this.modules.find(m => m.id === this.activeModuleId);
        const sections = this.sections.filter(s => s.module_id === this.activeModuleId);

        const card = $('<div>', { class: 'bg-white border border-gray-200 rounded-xl h-full min-h-0 flex flex-col overflow-hidden' });

        card.append($('<div>', { class: 'px-3 py-2.5 border-b border-gray-100 shrink-0' }).append(
            $('<h3>', { class: 'text-sm font-semibold text-gray-800', text: module ? `Acciones de ${module.name}` : 'Acciones por sección' }),
            $('<p>', { class: 'text-[11px] text-gray-400', text: 'Marca lo que se puede hacer en cada sección. Qué acciones tiene cada rol se elige en la pestaña Roles.' })
        ));

        if (!sections.length || !this.types.length) {
            card.append(this.emptyState(this.types.length
                ? 'Elige un módulo con secciones encendidas.'
                : 'No hay tipos de permiso activos. Crea uno en la pestaña Tipos de permiso.'));
            $('#permissions-matrix').html(card);
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        const headRow = $('<tr>').append($('<th>', {
            class: 'sticky left-0 z-10 bg-white text-left text-xs font-medium text-gray-500 px-3 py-2',
            text: 'Sección'
        }));

        this.types.forEach((t) => {
            headRow.append($('<th>', {
                class: 'text-center text-xs font-medium text-gray-500 px-2 py-2 whitespace-nowrap',
                text: t.name
            }));
        });

        const body = $('<tbody>', { class: 'divide-y divide-gray-100' });
        sections.forEach((s) => body.append(this.sectionRow(s)));

        const table = $('<table>', { class: 'w-full text-sm' }).append(
            $('<thead>', { class: 'border-b border-gray-100' }).append(headRow),
            body
        );

        card.append($('<div>', { class: 'flex-1 min-h-0 overflow-auto' }).append(table));
        $('#permissions-matrix').html(card);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    sectionRow(section) {
        const row = $('<tr>');

        row.append($('<td>', { class: 'sticky left-0 bg-white px-3 py-2' }).append(
            $('<div>', { class: 'flex items-center gap-2 min-w-[180px]' }).append(
                $('<span>', { class: 'shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-lg bg-gray-100 text-gray-500' })
                    .append($('<i>', { 'data-lucide': section.icon, class: 'w-3.5 h-3.5' })),
                $('<div>', { class: 'min-w-0' }).append(
                    $('<p>', { class: 'text-[13px] font-medium text-gray-800 truncate', text: section.name }),
                    $('<p>', { class: 'text-[11px] text-gray-400 truncate', text: section.route || 'Sin ruta' })
                )
            )
        ));

        this.types.forEach((t) => {
            row.append($('<td>', { class: 'text-center px-2 py-2' }).append(this.actionCheck(section, t)));
        });

        return row;
    }

    actionCheck(section, type) {
        const permission = this.catalog[this.key(section.id, type.id)];

        const box = $('<input>', {
            type: 'checkbox',
            class: 'w-4 h-4 accent-blue-600 cursor-pointer align-middle',
            checked: this.isOn(section.id, type.id),
            title: this.actionTitle(type, permission),
            'aria-label': `${type.name} en ${section.name}`
        });

        box.on('change', (e) => this.toggleAction(section, type, e.currentTarget.checked ? 1 : 0, $(e.currentTarget)));

        return box;
    }

    // -- CRUD --

    async lsPermissions() {
        const request = await useFetch({
            url: this._link,
            data: {
                opc: 'lsPermissions'
            }
        });

        if (!request || request.status !== 200) {
            notify(request);
            return;
        }

        this.modules  = request.modules || [];
        this.sections = request.sections || [];
        this.types    = request.types || [];
        this.catalog  = {};
        (request.permissions || []).forEach((p) => { this.catalog[this.key(p.section_id, p.type_permission_id)] = p; });

        if (!this.modules.some(m => m.id === this.activeModuleId)) {
            this.activeModuleId = this.modules.length ? this.modules[0].id : 0;
        }

        this.renderModules();
        this.renderMatrix();
    }

    // Quitar una acción que ya tienen roles se confirma: deja de aparecer en sus
    // permisos, aunque la recuperan si se vuelve a marcar.
    async toggleAction(section, type, active, $box) {
        const permission = this.catalog[this.key(section.id, type.id)];
        const roles = permission ? permission.roles : 0;

        if (!active && roles > 0) {
            const answer = await this.swalQuestion({
                extends: true,
                opts: {
                    title: `¿Quitar «${esc(type.name)}» de ${esc(section.name)}?`,
                    text: `La ${roles === 1 ? 'tiene 1 rol' : `tienen ${roles} roles`}: deja de aparecer en sus permisos. Si la vuelves a marcar, la recuperan.`,
                    icon: 'warning'
                }
            });

            if (!answer.isConfirmed) {
                $box.prop('checked', true);
                return;
            }
        }

        $box.prop('disabled', true);

        const request = await useFetch({
            url: this._link,
            data: {
                opc: 'togglePermission',
                section_id: section.id,
                type_permission_id: type.id,
                active: active
            }
        });

        $box.prop('disabled', false);

        if (!request || request.status !== 200) {
            notify(request);
            $box.prop('checked', !active);
            return;
        }

        if (request.permission) this.catalog[this.key(section.id, type.id)] = request.permission;
        $box.attr('title', this.actionTitle(type, request.permission));
        this.renderModules();
    }

    // -- Complements --

    onModuleSelect(item) {
        this.activeModuleId = item.id;
        this.renderModules();
        this.renderMatrix();
    }

    buildModuleItems() {
        return this.modules.map((m) => {
            const sections = this.sections.filter(s => s.module_id === m.id);
            const actions  = sections.reduce((n, s) => n + this.types.filter(t => this.isOn(s.id, t.id)).length, 0);

            return {
                id: m.id,
                label: m.name,
                icon: m.icon,
                meta: `${actions} ${actions === 1 ? 'acción' : 'acciones'} · ${sections.length} ${sections.length === 1 ? 'sección' : 'secciones'}`
            };
        });
    }

    isOn(sectionId, typeId) {
        const permission = this.catalog[this.key(sectionId, typeId)];
        return !!permission && permission.is_active === 1;
    }

    actionTitle(type, permission) {
        const roles = permission ? permission.roles : 0;
        if (!roles) return type.name;

        if (permission.is_active === 1) {
            return `${type.name} · la ${roles === 1 ? 'tiene 1 rol' : `tienen ${roles} roles`}`;
        }
        return `${type.name} · apagada; ${roles === 1 ? '1 rol la recupera' : `${roles} roles la recuperan`} al marcarla`;
    }

    key(sectionId, typeId) {
        return `${sectionId}_${typeId}`;
    }

    emptyState(text) {
        return $('<div>', { class: 'flex flex-col items-center justify-center text-center text-gray-400 flex-1 py-12 px-4 gap-2' }).append(
            $('<i>', { 'data-lucide': 'mouse-pointer-click', class: 'w-8 h-8 text-gray-300' }),
            $('<p>', { class: 'text-xs', text: text })
        );
    }
}

// -- Usuarios (CRUD completo con rol) --

// Tonos de avatar de las cuentas de Google y Microsoft: todos sostienen el
// ícono blanco con contraste de 4.5:1 o más. Mismos 10 en admin/accesos/js/accesos.js.
const USER_COLOR_PALETTE = [
    '#1A73E8', '#038387', '#188038', '#986F0B',
    '#CA5010', '#D93025', '#E3008C', '#8764B8',
    '#5C2E91', '#69797E'
];

/*  La foto del colaborador se reduce a 320px y se entrega como dataURL: va a
    salir siempre dentro de un círculo de 64px o menos, y así el POST no carga
    con la foto original del celular. */
function compressAvatar(file, cb) {
    const reader = new FileReader();

    reader.onload = (ev) => {
        const img = new Image();

        img.onload = () => {
            const max = 320;
            let w = img.width, h = img.height;
            if (w > max || h > max) {
                const s = max / Math.max(w, h);
                w = Math.round(w * s);
                h = Math.round(h * s);
            }

            const canvas = document.createElement('canvas');
            canvas.width  = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);

            cb(canvas.toDataURL('image/jpeg', 0.85));
        };

        img.onerror = () => cb(ev.target.result);
        img.src = ev.target.result;
    };

    reader.readAsDataURL(file);
}

class Users extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Users';
    }

    render() {
        $('#container-usuarios').html(`
            <div id="filterbar-users" class="mb-2"></div>
            <div id="table-users"></div>
        `);
        this.createfilterBar({
            parent: 'filterbar-users',
            data: [
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    class: 'col-12 col-md-3',
                    data: dataInit.userStatusFilter || [],
                    onchange: 'users.lsUsers()'
                },
                {
                    opc: 'button',
                    class: 'col-12 col-md-3',
                    id: 'btnNewUser',
                    text: 'Nuevo Usuario',
                    onClick: () => this.addUser()
                }
            ]
        });
    }

    lsUsers() {
        this.createTable({
            parent: 'table-users',
            idFilterBar: 'filterbar-users',
            data: { opc: 'lsUsers' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: { id: 'tbUsers', theme: 'light', striped: true, center: [5], right: [] }
        });
    }

    addUser() {
        if (!(dataInit.roles || []).length) {
            alert({ icon: 'info', text: 'Primero registra al menos un rol activo', btn1: true });
            return;
        }

        const modal = this.createModalForm({
            id: 'formUserAdd',
            data: { opc: 'addUser' },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Nuevo Usuario' },
            json: this.jsonUser(false),
            success: (r) => afterSave(r, () => this.lsUsers())
        });
        this.injectSucursalChips('add_sucursales_chips', []);
        this.renderPhotoPicker('formUserAdd', '', null);
        this.renderColorSwatches('formUserAdd', null);
        this.guardPasswordMatch(modal);
        this.mountPasswordEyes();
    }

    async editUser(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getUser', id: id } });
        if (request.status !== 200) {
            alert({ icon: 'error', text: request.message || 'No se pudo cargar el usuario', btn1: true });
            return;
        }

        const data = request.data;
        const branchIds = Array.isArray(data.branch_ids) ? data.branch_ids.map(String) : [];
        const color = data.color || null;

        const modal = this.createModalForm({
            id: 'formUserEdit',
            data: { opc: 'editUser', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Editar Usuario' },
            autofill: Object.assign({}, data, { role_id: String(data.role_id || '') }),
            json: this.jsonUser(true),
            success: (r) => afterSave(r, () => this.lsUsers())
        });
        this.injectSucursalChips('edit_sucursales_chips', branchIds);
        this.renderPhotoPicker('formUserEdit', data.photo_url || '', color);
        this.renderColorSwatches('formUserEdit', color);
        this.guardPasswordMatch(modal);
        this.mountPasswordEyes();
    }

    toggleUser(id, active) {
        const action = active == 1 ? 'activar' : 'desactivar';
        this.swalQuestion({
            opts: {
                title: `¿${active == 1 ? 'Activar' : 'Desactivar'} usuario?`,
                text: `¿Deseas ${action} este usuario?`,
                icon: 'warning'
            },
            data: { opc: 'toggleUser', id: id, active: active },
            methods: { send: (r) => afterSave(r, () => this.lsUsers()) }
        });
    }

    // -- Selector multiple de sucursal --

    renderSucursalChips(containerId, selectedIds = []) {
        const $container = $('#' + containerId).empty();

        (dataInit.branches || []).forEach(s => {
            const isSelected = selectedIds.includes(String(s.id));

            const $chip = $('<span>', {
                class: 'inline-flex items-center gap-1 me-1 mb-1 px-3 py-1 rounded-full border text-sm font-medium cursor-pointer select-none transition ' +
                       (isSelected
                           ? 'bg-blue-100 text-blue-700 border-blue-200'
                           : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300')
            });

            $chip.append($('<span>', { text: s.valor }));
            if (isSelected) $chip.append($('<span>', { html: '&times;' }));

            $chip.on('click', () => {
                const idx = selectedIds.indexOf(String(s.id));
                if (idx > -1) selectedIds.splice(idx, 1);
                else selectedIds.push(String(s.id));
                this.renderSucursalChips(containerId, selectedIds);
            });

            $container.append($chip);
        });

        $('#branch_ids').val(selectedIds.join(','));
    }

    // jsonUser() pinta branch_ids como <select>; aqui se saca ese select y en
    // su lugar quedan el hidden que viaja al ctrl y la caja de chips.
    injectSucursalChips(chipsId, selectedIds = []) {
        const $hidden = $('<input>', {
            type: 'hidden', id: 'branch_ids', name: 'branch_ids', value: selectedIds.join(',')
        });
        const $box = $('<div>', {
            id: chipsId, class: 'flex flex-wrap bg-white border border-gray-200 rounded-lg p-2'
        });

        const $select = $('#branch_ids');
        $select.siblings().remove(); // quita el chevron que dejo el <select>
        $select.replaceWith($hidden);
        $hidden.after($box);

        this.renderSucursalChips(chipsId, selectedIds);
    }

    // -- Foto del colaborador --

    /*  La foto NO viaja como archivo: createModalForm manda el formulario por
        useFetch, que arma un URLSearchParams, y ahí un File se vuelve
        "[object File]". Por eso la imagen se comprime en el navegador y se
        manda como dataURL en un campo de texto (`photo_b64`). `photo_clear`
        avisa cuando se quitó. Mismo widget que admin/accesos. */
    renderPhotoPicker(formId, photoUrl, color) {
        const $form = $('#' + formId);

        const $b64   = $('<input>', { type: 'hidden', name: 'photo_b64',   value: '' });
        const $clear = $('<input>', { type: 'hidden', name: 'photo_clear', value: '' });

        const $avatar = $('<span>', {
            class: 'w-16 h-16 rounded-full flex items-center justify-center shrink-0 text-white',
            css: { backgroundColor: color || '#9CA3AF' }
        });

        const $file = $('<input>', {
            type: 'file', accept: 'image/*', class: 'hidden', id: formId + '_file'
        });

        const $pick = $('<label>', {
            class: 'px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer',
            text: 'Subir foto',
            for: formId + '_file'
        });

        const $remove = $('<button>', {
            type: 'button',
            class: 'px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-800',
            text: 'Quitar'
        });

        // Sin foto queda el ícono blanco sobre el color, lo mismo que enseñan la
        // navbar y el login.
        const paint = (src) => {
            $avatar.empty().append(src
                ? $('<img>', { src: src, class: 'w-full h-full rounded-full object-cover' })
                : $('<i>', { 'data-lucide': 'user', class: 'w-7 h-7' }));
            $remove.toggle(!!src);
            if (typeof lucide !== 'undefined') lucide.createIcons();
        };

        $file.on('change', function () {
            const file = this.files && this.files[0];
            if (!file) return;
            compressAvatar(file, (dataUrl) => {
                paint(dataUrl);
                $b64.val(dataUrl);
                $clear.val('');
            });
        });

        $remove.on('click', () => {
            paint('');
            $b64.val('');
            $clear.val('1');
            $file.val('');
        });

        const $wrap = $('<div>', { class: 'col-span-12 mb-3 flex items-center gap-3' })
            .append($avatar, $pick, $remove, $file, $b64, $clear);

        $form.prepend($wrap);
        paint(photoUrl || '');
    }

    // El color elegido repinta el fondo del avatar sin recargar el formulario.
    repaintPhotoBg(formId, hex) {
        $('#' + formId).find('.w-16.h-16.rounded-full').css('backgroundColor', hex);
    }

    // -- Color del colaborador --

    renderColorSwatches(formId, selectedColor) {
        const $form = $('#' + formId);

        const $colorWrap = $('<div>', { class: 'col-span-12 mb-3' });
        $colorWrap.append($('<label>', { class: 'form-label fw-semibold', text: 'Color del colaborador' }));
        const $swatches = $('<div>', { class: 'flex flex-wrap gap-2 mt-1' });

        USER_COLOR_PALETTE.forEach(hex => {
            const isActive = hex === selectedColor;
            const $swatch = $('<button>', {
                type: 'button',
                class: 'w-7 h-7 rounded-full border-2 transition ' + (isActive ? 'border-gray-800 scale-110' : 'border-transparent'),
                css: { backgroundColor: hex }
            });
            $swatch.on('click', () => {
                $swatches.find('button').removeClass('border-gray-800 scale-110').addClass('border-transparent');
                $swatch.removeClass('border-transparent').addClass('border-gray-800 scale-110');
                $form.find('[name="color"]').val(hex);
                this.repaintPhotoBg(formId, hex);
            });
            $swatches.append($swatch);
        });

        if (selectedColor) {
            $form.find('[name="color"]').val(selectedColor);
        }

        $colorWrap.append($swatches);
        $form.find('[name="color"]').closest('div').after($colorWrap);
    }

    // -- Doble confirmacion de contrasena --

    // El cfModal no expone un hook previo al envio: el boton Aceptar dispara
    // cfModalForm.trigger('submit') desde su propio click, y el atajo Enter
    // llama onOk() desde un keydown en document. Se frenan los dos en fase de
    // captura sobre el overlay, que corre antes que ambos manejadores.
    guardPasswordMatch(modal) {
        const btnOk = modal.footer.find('button').last()[0];
        if (!btnOk) return;

        const match = () => $('#password').val() === $('#password_confirmation').val();
        const block = (e) => {
            e.preventDefault();
            e.stopPropagation();
            alert({ icon: 'error', text: 'Las contraseñas no coinciden', btn1: true });
        };

        modal.el[0].addEventListener('click', (e) => {
            if (e.target.closest('button') !== btnOk) return;
            if (match()) return;
            block(e);
        }, true);

        modal.el[0].addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            const tag = (e.target.tagName || '').toLowerCase();
            if (tag !== 'input' && tag !== 'select') return;
            if (match()) return;
            block(e);
        }, true);

        $('#password, #password_confirmation').on('input', function () {
            const confirm = $('#password_confirmation').val();
            const mismatch = confirm !== '' && confirm !== $('#password').val();
            $('#password_confirmation').css('border-color', mismatch ? '#9D3434' : '');
        });
    }

    // -- Ojo de contraseña --

    mountPasswordEyes() {
        ['password', 'password_confirmation'].forEach((id) => {
            const $input = $('#' + id);
            if (!$input.length) return;

            $input.wrap($('<div>', { class: 'relative' }));
            $input.addClass('pr-9');

            const $btn = $('<button>', {
                type: 'button',
                id: id + '_eye',
                class: 'absolute inset-y-0 right-0 flex items-center pr-2.5 text-gray-400 hover:text-gray-600'
            }).append($('<i>', { 'data-lucide': 'eye', class: 'w-4 h-4' }));

            $btn.on('click', () => this.togglePasswordVisibility(id));

            $input.after($btn);
        });

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    togglePasswordVisibility(id) {
        const $input = $('#' + id);
        const show = $input.attr('type') === 'password';
        $input.attr('type', show ? 'text' : 'password');

        $('#' + id + '_eye').empty().append($('<i>', {
            'data-lucide': show ? 'eye-off' : 'eye',
            class: 'w-4 h-4'
        }));
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    jsonUser(isEdit) {
        const fields = [
            {
                opc: 'input',
                id: 'name',
                lbl: 'Nombre(s)',
                class: 'col-12 col-md-6 mb-3',
                required: true
            },
            {
                opc: 'input',
                id: 'last_name',
                lbl: 'Apellidos',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'email',
                lbl: 'Correo (con el que inicia sesión)',
                type: 'email',
                class: 'col-12 mb-3',
                required: true
            },
            {
                opc: 'select',
                id: 'role_id',
                lbl: 'Rol',
                class: 'col-12 mb-3',
                required: true,
                selected: 'Elige un rol',
                data: dataInit.roles || []
            },
            {
                opc: 'select',
                id: 'branch_ids',
                lbl: 'Sucursales asignadas',
                class: 'col-12 mb-3',
                data: dataInit.branches || []
            },
            {
                opc: 'input',
                id: 'color',
                type: 'hidden',
                lbl: '',
                class: 'col-12',
                required: false
            }
        ];

        if (isEdit) {
            fields.push(
                {
                    opc: 'input',
                    id: 'password',
                    lbl: 'Nueva contraseña (vacío = no se modifica)',
                    type: 'password',
                    class: 'col-12 mb-3',
                    required: false
                },
                {
                    opc: 'input',
                    id: 'password_confirmation',
                    lbl: 'Confirmar nueva contraseña',
                    type: 'password',
                    class: 'col-12 mb-3',
                    required: false
                }
            );
        } else {
            fields.push(
                {
                    opc: 'input',
                    id: 'password',
                    lbl: 'Contraseña',
                    type: 'password',
                    class: 'col-12 mb-3',
                    required: true
                },
                {
                    opc: 'input',
                    id: 'password_confirmation',
                    lbl: 'Confirmar contraseña',
                    type: 'password',
                    class: 'col-12 mb-3',
                    required: true
                }
            );
        }

        return fields;
    }
}

// -- Sucursales (el admin elige empresa y reparte su gente por sucursal) --

const AVATAR_TONES = [
    'bg-blue-600/15 text-blue-600',
    'bg-[#059669]/15 text-[#059669]',
    'bg-[#2563EB]/15 text-[#2563EB]',
    'bg-[#D97706]/15 text-[#D97706]',
    'bg-[#7C3AED]/15 text-[#7C3AED]',
    'bg-[#0891B2]/15 text-[#0891B2]'
];

class Branches extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Branches';
        this.companyId    = 0;
        this.companies    = [];
        this.branches     = [];
        this.candidates   = [];
        this.plan         = null;
        this.branchId     = 0;
        this.query        = '';
        this.selectName   = '';
    }

    render() {
        this.layout();
        this.lsBranches();
    }

    layout() {
        this.createLayout({
            parent: 'container-sucursales',
            design: false,
            data: {
                id: 'branchesEditor',
                class: 'flex flex-col gap-3',
                container: [
                    {
                        type: 'div',
                        id: 'branchesCompany',
                        class: 'w-full'
                    },
                    {
                        type: 'div',
                        id: 'branchesKpis',
                        class: 'w-full'
                    },
                    {
                        type: 'div',
                        id: 'branchesBody',
                        class: 'flex flex-col lg:flex-row gap-4 min-h-[420px]',
                        children: [
                            {
                                id: 'branchesList',
                                class: 'w-full lg:w-[260px] lg:flex-none flex flex-col gap-2.5'
                            },
                            {
                                id: 'branchesDetail',
                                class: 'flex-1 min-w-0 flex flex-col gap-3'
                            }
                        ]
                    }
                ]
            }
        });
    }

    async lsBranches(companyId = this.companyId) {
        const res = await useFetch({ url: this._link, data: { opc: 'lsBranches', company_id: companyId } });
        if (!res || res.status !== 200) {
            alert({ icon: 'error', text: (res && res.message) || 'No se pudieron cargar las sucursales', btn1: true });
            return;
        }

        this.companyId  = Number(res.company_id);
        this.companies  = res.companies || [];
        this.branches   = res.branches || [];
        this.candidates = res.candidates || [];
        this.plan       = res.plan || null;
        if (res.selectBranches) dataInit.branches = res.selectBranches;

        // Tras crear una sucursal se abre la nueva: el ctrl no devuelve su id,
        // pero el nombre es único dentro de la empresa.
        const wanted = this.selectName.trim().toLowerCase();
        const target = (wanted && this.branches.find(b => b.name.toLowerCase() === wanted))
            || this.branches.find(b => b.id === this.branchId)
            || this.branches[0];
        this.branchId   = target ? target.id : 0;
        this.selectName = '';

        this.renderCompanyBar();
        this.renderInfoCards();
        this.renderBranchList();
        this.renderBranchDetail();
    }

    switchCompany(id) {
        this.branchId = 0;
        this.lsBranches(id);
    }

    selectBranch(id) {
        this.branchId = id;
        this.renderBranchCards();
        this.renderBranchDetail();
    }

    // -- Barra de empresa --

    renderCompanyBar() {
        const company = this.currentCompany();

        const $current = $('<div>', { class: 'flex items-center gap-3 min-w-0' }).append(
            this.avatar(company.name, company.id, 'w-[34px] h-[34px] rounded-[10px] text-[12.5px]'),
            $('<div>', { class: 'min-w-0' }).append(
                $('<p>', { class: 'text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-0', text: 'Empresa activa' }),
                $('<p>', { class: 'text-[13.5px] font-semibold text-gray-900 truncate mb-0', text: company.name })
            )
        );

        const $button = $('<button>', {
            type: 'button',
            class: 'flex items-center gap-2.5 min-w-[220px] sm:min-w-[250px] pl-2 pr-2.5 py-1.5 rounded-xl border border-gray-200 bg-white shadow-sm'
        }).append(
            this.avatar(company.name, company.id, 'w-8 h-8 rounded-[9px] text-xs'),
            $('<div>', { class: 'flex-1 min-w-0 text-left' }).append(
                $('<p>', { class: 'text-[12.5px] font-semibold text-gray-900 truncate mb-0', text: company.name }),
                $('<p>', { class: 'text-[10px] text-gray-500 mb-0', text: `${company.total_branches} sucursales · ${company.assignments} asignaciones` })
            ),
            $('<i>', { 'data-lucide': 'chevron-down', class: 'w-3.5 h-3.5 text-gray-400 shrink-0' })
        );

        const $panel = $('<div>', {
            class: 'hidden absolute right-0 top-full mt-1.5 z-30 w-full min-w-[280px] bg-white border border-gray-200 rounded-xl shadow-lg p-1.5'
        });

        this.companies.forEach(c => {
            const selected = Number(c.id) === this.companyId;
            $panel.append(
                $('<div>', {
                    class: 'flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition ' + (selected ? 'bg-blue-600/10' : 'hover:bg-gray-50')
                }).append(
                    this.avatar(c.name, c.id, 'w-[30px] h-[30px] rounded-lg text-[11px]'),
                    $('<div>', { class: 'flex-1 min-w-0' }).append(
                        $('<p>', { class: 'text-[12.5px] font-semibold text-gray-900 truncate mb-0', text: c.name }),
                        $('<p>', { class: 'text-[10px] text-gray-500 mb-0', text: `${c.active_branches} activas de ${c.total_branches}` })
                    ),
                    selected ? $('<i>', { 'data-lucide': 'check', class: 'w-4 h-4 text-blue-600 shrink-0' }) : null
                ).on('click', () => this.switchCompany(c.id))
            );
        });

        const toggle = (open) => {
            $panel.toggleClass('hidden', !open);
            $button.toggleClass('border-blue-600 ring-2 ring-blue-600/15', open);
        };
        $button.on('click', (e) => {
            e.stopPropagation();
            toggle($panel.hasClass('hidden'));
        });
        $(document).off('click.branchesCompany').on('click.branchesCompany', () => toggle(false));

        $('#branchesCompany').empty().append(
            $('<div>', {
                class: 'flex items-center justify-between gap-3 flex-wrap p-3 px-4 rounded-xl border border-gray-200 bg-white shadow-sm'
            }).append(
                $current,
                $('<div>', { class: 'flex items-center gap-2.5' }).append(
                    $('<span>', {
                        class: 'hidden sm:inline text-[11px] text-gray-500 whitespace-nowrap',
                        text: `${company.active_branches} de ${company.total_branches} activas`
                    }),
                    $('<div>', { class: 'relative' }).append($button, $panel)
                )
            )
        );
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // -- KPIs --

    // kpisRow y no infoCard: infoCard no deja achicar padding ni tipografía, y
    // aquí los KPIs van compactos.
    renderInfoCards() {
        const limit = this.planLimit();

        this.kpisRow({
            parent: 'branchesKpis',
            id: 'kpiBranches',
            class: 'grid grid-cols-4 gap-2',
            cardClass: 'bg-white rounded-lg border border-gray-200 px-2.5 py-4',
            activeClass: '',
            labelClass: 'text-[9px] uppercase tracking-wider font-semibold text-gray-500 truncate mb-0',
            valueClass: 'text-sm font-bold leading-tight mb-0',
            iconWrapClass: 'w-5 h-5 rounded flex items-center justify-center flex-shrink-0',
            iconClass: 'w-3 h-3',
            tones: {
                brand: 'text-blue-600'
            },
            iconBgTones: {
                brand: 'bg-blue-600/10'
            },
            json: [
                {
                    id: 'kpiActive',
                    label: 'Sucursales activas',
                    value: this.activeCount(),
                    icon: 'building-2',
                    tone: 'brand'
                },
                {
                    id: 'kpiAssignments',
                    label: 'Asignaciones totales',
                    value: this.branches.reduce((sum, b) => sum + b.users, 0),
                    icon: 'users',
                    tone: 'brand'
                },
                {
                    id: 'kpiLimit',
                    label: 'Límite de sucursales',
                    value: limit.value,
                    icon: 'badge-check',
                    tone: 'brand'
                }
            ]
        });

        $('#kpiLimit').attr('title', limit.subtitle).append(
            $('<div>', { class: 'h-0.5 rounded-full bg-gray-100 mt-1 overflow-hidden' }).append(
                $('<div>', { class: 'h-full rounded-full bg-blue-600', css: { width: `${limit.percent}%` } })
            )
        );
    }

    // puede crear = plan.max_branches − sucursales activas. Sin plan, o con un plan
    // sin tope, no hay límite y el botón Nueva nunca se apaga.
    planLimit() {
        const active = this.activeCount();
        const plan   = this.plan;
        const max    = plan && plan.max_branches !== null && plan.max_branches !== '' ? Number(plan.max_branches) : null;

        if (!plan) {
            return {
                value: 'Sin plan',
                subtitle: 'Sin límite de sucursales',
                hint: 'Sin plan activo: sin límite de sucursales',
                percent: 0,
                canCreate: true
            };
        }
        if (max === null) {
            return {
                value: plan.name,
                subtitle: 'Sin límite de sucursales',
                hint: `Plan ${plan.name}: sin límite de sucursales`,
                percent: 0,
                canCreate: true
            };
        }

        const left = Math.max(max - active, 0);
        return {
            value: `${active} / ${max}`,
            subtitle: left ? `Plan ${plan.name} · quedan ${left}` : `Plan ${plan.name} · lleno`,
            hint: `Plan ${plan.name}: quedan ${left} de ${max} sucursales activas`,
            percent: max > 0 ? Math.min(active / max * 100, 100) : 100,
            canCreate: left > 0
        };
    }

    // -- Lista de sucursales --

    renderBranchList() {
        const canCreate = this.planLimit().canCreate;
        this.query = '';

        const $new = $('<button>', {
            type: 'button',
            class: 'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-main text-white hover:bg-main-hover transition disabled:opacity-40 disabled:cursor-not-allowed',
            title: canCreate ? 'Nueva sucursal' : 'El plan ya no admite más sucursales activas',
            disabled: !canCreate
        }).append(
            $('<i>', { 'data-lucide': 'plus', class: 'w-3.5 h-3.5' }),
            'Nueva'
        ).on('click', () => this.addBranch());

        const $search = $('<div>', { class: 'relative' }).append(
            $('<i>', { 'data-lucide': 'search', class: 'w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2' }),
            $('<input>', {
                type: 'text',
                placeholder: 'Buscar sucursal…',
                class: 'w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/30'
            }).on('input', (e) => {
                this.query = e.currentTarget.value || '';
                this.renderBranchCards();
            })
        );

        $('#branchesList').empty().append(
            $('<div>', { class: 'flex items-center justify-between' }).append(
                $('<span>', { class: 'text-[13px] font-bold text-gray-900', text: 'Sucursales' }),
                $new
            ),
            $search,
            $('<div>', { id: 'branchCards', class: 'flex flex-col gap-2 max-h-[60vh] overflow-y-auto p-0.5' })
        );

        this.renderBranchCards();
    }

    // El buscador filtra en el navegador: la lista completa ya llegó con lsBranches.
    renderBranchCards() {
        const q       = this.query.trim().toLowerCase();
        const visible = this.branches.filter(b => !q || `${b.name} ${b.ubication || ''}`.toLowerCase().includes(q));
        const $cards  = $('#branchCards').empty();

        visible.forEach(b => $cards.append(this.branchCard(b)));

        if (q && !visible.length) {
            $cards.append($('<p>', { class: 'text-center text-xs italic text-gray-400 py-5 mb-0', text: `Sin resultados para «${this.query.trim()}»` }));
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    branchCard(b) {
        const selected = b.id === this.branchId;
        const state    = selected
            ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600 shadow-md'
            : 'border-gray-200 bg-white shadow-sm hover:border-blue-600/40 hover:-translate-y-px hover:shadow-md';

        const $users = $('<p>', { class: 'flex items-center gap-1 text-[10.5px] text-gray-500 mt-0.5 mb-0' }).append(
            $('<i>', { 'data-lucide': 'users', class: 'w-[11px] h-[11px] shrink-0' }),
            document.createTextNode(`${b.users} ${b.users === 1 ? 'usuario' : 'usuarios'}`)
        );
        if (!b.is_active) {
            $users.append(document.createTextNode(' · '), $('<span>', { class: 'font-semibold text-amber-700', text: 'Inactiva' }));
        }

        return $('<div>', {
            class: `relative flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${state}` + (b.is_active ? '' : ' opacity-60 hover:opacity-100')
        }).append(
            selected ? $('<span>', { class: 'absolute -left-px top-2.5 bottom-2.5 w-[3px] rounded-full bg-blue-600' }) : null,
            $('<div>', { class: 'flex-1 min-w-0' }).append(
                $('<p>', { class: 'text-[13px] font-semibold text-gray-900 leading-tight truncate mb-0', text: b.name }),
                $('<p>', { class: 'flex items-center gap-1 text-[10.5px] text-gray-500 mt-1 mb-0' }).append(
                    $('<i>', { 'data-lucide': 'map-pin', class: 'w-[11px] h-[11px] shrink-0' }),
                    $('<span>', { class: 'truncate', text: b.ubication || 'Sin ubicación' })
                ),
                $users
            )
        ).on('click', () => this.selectBranch(b.id));
    }

    // -- Detalle de la sucursal --

    renderBranchDetail() {
        const b       = this.branches.find(x => x.id === this.branchId);
        const $detail = $('#branchesDetail').empty();

        if (!b) {
            $detail.append(this.emptyState('building-2', 'Esta empresa no tiene sucursales todavía — crea la primera con el botón «Nueva»'));
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        const $head = $('<div>', {
            class: 'flex items-center justify-between gap-3 flex-wrap p-4 rounded-xl border border-gray-200 bg-white shadow-sm'
        }).append(
            $('<div>', { class: 'flex items-center gap-3 min-w-0' }).append(
                $('<div>', { class: 'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-blue-600/10 text-blue-600' }).append(
                    $('<i>', { 'data-lucide': 'building-2', class: 'w-5 h-5' })
                ),
                $('<div>', { class: 'min-w-0' }).append(
                    $('<div>', { class: 'flex items-center gap-2 flex-wrap' }).append(
                        $('<h3>', { class: 'text-base font-semibold text-gray-900 mb-0', text: b.name }),
                        this.statusPill(b.is_active)
                    ),
                    $('<p>', { class: 'flex items-center gap-1 text-[11px] text-gray-500 mt-0.5 mb-0' }).append(
                        $('<i>', { 'data-lucide': 'map-pin', class: 'w-3 h-3 shrink-0' }),
                        document.createTextNode(`${b.ubication || 'Sin ubicación'} · creada ${b.created || '—'} · `),
                        $('<b>', { class: 'text-gray-900', text: b.users }),
                        document.createTextNode(` ${b.users === 1 ? 'usuario' : 'usuarios'}`)
                    )
                )
            ),
            $('<div>', { class: 'flex items-center gap-1.5 flex-wrap' }).append(
                this.actionButton('pencil', 'Editar', () => this.editBranch(b.id)),
                this.actionButton(b.is_active ? 'ban' : 'circle-check', b.is_active ? 'Desactivar' : 'Activar', () => this.toggleBranch(b.id, b.is_active ? 0 : 1)),
                this.actionButton('plus', 'Añadir usuario', () => this.assignUser(b.id), true, !b.is_active)
            )
        );

        const $table = $('<div>', { id: 'branchUsers' });
        $detail.append($head, $table);

        if (b.row.length) {
            this.createCoffeeTable3({
                parent: 'branchUsers',
                id: 'tbBranchUsers',
                theme: 'light',
                data: { row: b.row },
                f_size: 13
            });
        } else {
            $table.append(this.emptyState('users', b.is_active
                ? 'Nadie trabaja aquí todavía — añade el primer usuario'
                : 'Sucursal desactivada: reactívala para poder asignar gente'));
        }

        if (!b.is_active && b.users > 0) {
            $detail.append(
                $('<div>', { class: 'flex items-start gap-2 px-3.5 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-700' }).append(
                    $('<i>', { 'data-lucide': 'triangle-alert', class: 'w-4 h-4 shrink-0 mt-px' }),
                    $('<span>').append(
                        $('<b>', { text: 'Sucursal desactivada: ' }),
                        document.createTextNode(`reactívala para poder asignar gente. Sus ${b.users} asignaciones siguen guardadas.`)
                    )
                )
            );
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // -- Sucursal: nueva, editar, activar --

    addBranch() {
        const company = this.currentCompany();
        this.createModalForm({
            id: 'formBranchAdd',
            data: { opc: 'addBranch', company_id: this.companyId },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: `Nueva sucursal · <span class="text-blue-600 font-bold">${esc(company.name)}</span>` },
            json: this.jsonBranch(true),
            success: (r) => {
                this.selectName = $('#formBranchAdd [name="name"]').val() || '';
                afterSave(r, () => this.lsBranches());
            }
        });
    }

    editBranch(id) {
        const b = this.branches.find(x => x.id === id);
        if (!b) return;

        this.createModalForm({
            id: 'formBranchEdit',
            data: { opc: 'editBranch', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: `Editar sucursal · <span class="text-blue-600 font-bold">${esc(b.name)}</span>` },
            autofill: {
                name: b.name,
                ubication: b.ubication || ''
            },
            json: this.jsonBranch(false),
            success: (r) => afterSave(r, () => this.lsBranches())
        });
    }

    toggleBranch(id, active) {
        const b = this.branches.find(x => x.id === id);
        if (!b) return;

        let text = `«${b.name}» volverá a aceptar asignaciones.`;
        if (active != 1) {
            text = b.users
                ? `Sus ${b.users} asignaciones quedan guardadas para cuando la reactives.`
                : `«${b.name}» dejará de aceptar asignaciones.`;
        }

        this.swalQuestion({
            opts: {
                title: `¿${active == 1 ? 'Activar' : 'Desactivar'} sucursal?`,
                text: text,
                icon: 'warning'
            },
            data: { opc: 'toggleBranch', id: id, active: active },
            methods: { send: (r) => afterSave(r, () => this.lsBranches()) }
        });
    }

    jsonBranch(isNew) {
        const fields = [
            {
                opc: 'input',
                id: 'name',
                lbl: 'Nombre',
                placeholder: 'Ej: Reginas Centro',
                class: 'col-12 mb-3',
                required: true
            },
            {
                opc: 'input',
                id: 'ubication',
                lbl: 'Ubicación',
                placeholder: 'Ej: Av. Central 128',
                class: 'col-12 mb-3',
                required: false
            }
        ];

        if (isNew) {
            fields.push({
                opc: 'p',
                id: 'branchPlanHint',
                class: 'col-12',
                style: 'font-size:12px;color:#6B7280;margin:0',
                text: this.planLimit().hint
            });
        }

        return fields;
    }

    // -- Gente de la sucursal: asignar, cambiar rol, quitar --

    // El select de usuario excluye a quien ya está en la sucursal: se filtra con
    // los user_id de sus asignaciones, que ya vinieron en lsBranches.
    assignUser(branchId) {
        const b = this.branches.find(x => x.id === branchId);
        if (!b || !b.is_active) return;

        const assigned  = b.members.map(m => m.user_id);
        const available = this.candidates.filter(u => !assigned.includes(Number(u.id)));

        if (!this.candidates.length) {
            alert({ icon: 'info', text: `${this.currentCompany().name} no tiene usuarios activos: primero hay que dar de alta a su gente`, btn1: true });
            return;
        }
        if (!available.length) {
            alert({ icon: 'info', text: `Todos los usuarios activos de ${this.currentCompany().name} ya están en ${b.name}`, btn1: true });
            return;
        }
        if (!(dataInit.roles || []).length) {
            alert({ icon: 'info', text: 'Primero registra al menos un rol activo', btn1: true });
            return;
        }

        this.createModalForm({
            id: 'formBranchAssign',
            data: { opc: 'assignUserRole', branch_id: branchId },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: `Añadir usuario a <span class="text-blue-600 font-bold">${esc(b.name)}</span>` },
            json: [
                {
                    opc: 'p',
                    id: 'assignHint',
                    class: 'col-12 mb-2',
                    style: 'font-size:12px;color:#6B7280;margin:0',
                    text: 'El usuario obtendrá acceso a esta sucursal con el rol elegido'
                },
                {
                    opc: 'select',
                    id: 'user_id',
                    lbl: 'Usuario',
                    class: 'col-12 mb-3',
                    required: true,
                    selected: 'Selecciona un usuario…',
                    data: available
                },
                {
                    opc: 'select',
                    id: 'role_id',
                    lbl: 'Rol',
                    class: 'col-12 mb-3',
                    required: true,
                    selected: 'Selecciona un rol…',
                    data: dataInit.roles || []
                }
            ],
            success: (r) => afterSave(r, () => this.lsBranches())
        });
    }

    editUserRole(assignmentId) {
        const member = this.findMember(assignmentId);
        if (!member) return;

        this.createModalForm({
            id: 'formBranchRole',
            data: { opc: 'updateUserRole', assignment_id: assignmentId },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Cambiar rol' },
            autofill: { role_id: String(member.role_id || '') },
            json: [
                {
                    opc: 'p',
                    id: 'roleHint',
                    class: 'col-12 mb-2',
                    style: 'font-size:12px;color:#6B7280;margin:0',
                    text: `Solo cambia el rol en ${member.branch}`
                },
                {
                    opc: 'input',
                    id: 'user_name',
                    lbl: 'Usuario',
                    value: member.name,
                    class: 'col-12 mb-3',
                    required: false,
                    disabled: true
                },
                {
                    opc: 'select',
                    id: 'role_id',
                    lbl: 'Nuevo rol',
                    class: 'col-12 mb-3',
                    required: true,
                    data: dataInit.roles || []
                }
            ],
            success: (r) => afterSave(r, () => this.lsBranches())
        });
    }

    removeUserRole(assignmentId) {
        const member = this.findMember(assignmentId);
        if (!member) return;

        this.swalQuestion({
            opts: {
                title: '¿Quitar asignación?',
                text: `${member.name} dejará de tener acceso a «${member.branch}».`,
                icon: 'warning'
            },
            data: { opc: 'removeUserRole', assignment_id: assignmentId },
            methods: { send: (r) => afterSave(r, () => this.lsBranches()) }
        });
    }

    // -- Helpers de la clase --

    currentCompany() {
        return this.companies.find(c => Number(c.id) === this.companyId) || {
            id: this.companyId,
            name: '—',
            total_branches: 0,
            active_branches: 0,
            assignments: 0
        };
    }

    activeCount() {
        return this.branches.filter(b => b.is_active === 1).length;
    }

    findMember(assignmentId) {
        for (const b of this.branches) {
            const m = b.members.find(x => x.assignment_id === assignmentId);
            if (m) return Object.assign({ branch: b.name }, m);
        }
        return null;
    }

    // Iniciales de las palabras que empiezan con letra: "Reginas - Pastelería" -> "RP".
    avatar(name, seed, size) {
        const words = String(name || '').trim().split(/\s+/).filter(w => /\p{L}/u.test(w.charAt(0)));
        const text  = words.slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('') || '?';
        const sum   = String(seed).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        return $('<span>', {
            class: `inline-flex items-center justify-center font-bold shrink-0 select-none ${AVATAR_TONES[sum % AVATAR_TONES.length]} ${size}`,
            text: text
        });
    }

    statusPill(active) {
        return $('<span>', {
            class: 'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full '
                + (active ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')
        }).append(
            $('<span>', { class: 'w-1.5 h-1.5 rounded-full bg-current' }),
            active ? 'Activa' : 'Inactiva'
        );
    }

    actionButton(icon, text, onClick, primary = false, disabled = false) {
        const look = primary
            ? 'bg-main text-white hover:bg-main-hover border border-main'
            : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-400';
        return $('<button>', {
            type: 'button',
            class: `inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${look}`,
            disabled: disabled
        }).append(
            $('<i>', { 'data-lucide': icon, class: 'w-3.5 h-3.5' }),
            text
        ).on('click', onClick);
    }

    emptyState(icon, text) {
        return $('<div>', {
            class: 'flex flex-col items-center justify-center gap-2 py-10 px-4 rounded-xl border border-dashed border-gray-200 bg-white text-center'
        }).append(
            $('<i>', { 'data-lucide': icon, class: 'w-6 h-6 text-gray-300' }),
            $('<p>', { class: 'text-sm italic text-gray-400 mb-0', text: text })
        );
    }
}
