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
