let api = 'ctrl/ctrl-accesos.php';
let app, modules, submodules, sections, typePermissions, roles, permissions, users;
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

    app = new App(api, 'root');
    app.render();
});

// -- Helpers --

// Opciones del filtro Empresa: la primera es la de arranque ('system' en Roles y
// Permisos, 'all' en Usuarios) y después cada empresa activa.
function companyOptions(first) {
    const labels = {
        system: 'Roles del sistema',
        all: 'Todas las empresas'
    };

    return [{ id: first, valor: labels[first] }].concat(dataInit.companies || []);
}

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
                    // min-h-0 solo desde lg: en escritorio los paneles llenan la pantalla
                    // y scrollean por dentro; en celular la página crece con su contenido.
                    { type: 'div', id: `container${this.PROJECT_NAME}`, class: 'w-full rounded p-2 flex-1 lg:min-h-0 flex flex-col' }
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
                    $('<p>', { class: 'text-sm text-gray-400', text: 'Tipos de permiso, módulos, roles con sus permisos y usuarios' })
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
            content: { class: 'flex-1 lg:min-h-0 flex flex-col' },
            json: [

                {
                    id: 'permisos',
                    tab: 'Roles y Permisos',
                    lucideIcon: 'shield-check',
                    class: 'flex-1 lg:min-h-0 flex flex-col',
                    onClick: () => { permissions.render(); permissions.lsRoles(); }
                },
                {
                    id: 'usuarios',
                    tab: 'Usuarios',
                    lucideIcon: 'user-cog',
                    class: 'flex-1 lg:min-h-0 flex flex-col',
                    onClick: () => { users.render(); users.lsUsers(); }
                },
                {
                    id: 'tipos-permiso',
                    tab: 'Tipos de permiso',
                    lucideIcon: 'key-round',
                    class: 'flex-1 lg:min-h-0 flex flex-col',
                    active: true,
                    onClick: () => { typePermissions.render(); typePermissions.lsTypePermissions(); }
                },
                {
                    id: 'modulos',
                    tab: 'Módulos',
                    lucideIcon: 'layout-grid',
                    class: 'flex-1 lg:min-h-0 flex flex-col',
                    onClick: () => { sections.render(); sections.lsSections(); }
                }
            ]
        });
    }

    // Render perezoso: solo la pestaña activa; las demás se pintan al abrirlas.
    renderActiveTab() {
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

    // Sin pestaña propia: se administra desde el panel de la pestaña Módulos,
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

        // Al editar, el código no sigue al nombre: con él la pantalla de empresas
        // encuentra la tarjeta de Developer.
        $('#formModuleEdit #name').removeAttr('onkeyup');

        this.mountIconField('formModuleEdit', request.data ? request.data.icon : '');
    }

    /*  Planta el selector de íconos dentro del hueco que dejó jsonModule.
        Va aparte y no como un `opc` del formulario porque csIconField no es un
        campo de CoffeeSoft: es un componente propio (cs-icon-picker.js) que se
        inyecta ya montado el modal. El `name` es lo que hace que el valor viaje
        en el FormData del form. */
    // button: false quita el botón de elegir; quedan la muestra del icono (que al
    // clic abre el selector) y el texto para escribir su nombre.
    mountIconField(formId, value, button = true) {
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
            button: button,
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

    // coffeeForm marca todo campo como obligatorio salvo required:false, y un select
    // en su placeholder (valor 0) cuenta como vacío.
    jsonModule() {
        return [
            { opc: 'input', id: 'name', lbl: 'Nombre del módulo', class: 'col-12 col-md-6 mb-3', required: true, onkeyup: 'autoCode(this.value)' },
            { opc: 'input', id: 'code', lbl: 'Código (automático)', class: 'col-12 col-md-6 mb-3', readonly: true, required: false },
            // Hueco vacío: lo rellena mountIconField() con el selector de íconos.
            { opc: 'div', id: 'iconFieldWrap', lbl: 'Ícono', class: 'col-12 col-md-6 mb-3', required: false },
            { opc: 'select', id: 'route', lbl: 'Ruta', class: 'col-12 col-md-6 mb-3', selected: '-- Selecciona --', select2: true, required: false, data: dataInit.routes || [] },
            { opc: 'input', id: 'description', lbl: 'Descripción', class: 'col-12 col-md-8 mb-3', required: false, placeholder: 'Texto que se muestra en la tarjeta' },
            // Lo que se cobra por el módulo en el plan Personalizado (Facturación).
            { opc: 'input', id: 'price', lbl: 'Precio mensual sin IVA', type: 'number', class: 'col-12 col-md-4 mb-3', required: false, placeholder: 'Plan Personalizado' }
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

    // Sin pestaña propia: se crean desde la pestaña Módulos y se editan o apagan
    // desde la cabecera de su acordeón, que pasa en onSaved cómo refrescarse.

    addSubmodule(moduleId, onSaved) {
        if (!(dataInit.modules || []).length) { alert({ icon: 'info', text: 'Primero registra al menos un módulo activo', btn1: true }); return; }

        const inherits = (dataInit.modules || []).some(m => String(m.id) === String(moduleId));

        this.createModalForm({
            id: 'formSubmoduleAdd', data: { opc: 'addSubmodule' }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Nuevo Submódulo' },
            autofill: inherits ? { module_id: String(moduleId) } : false,
            json: this.jsonSubmodule(),
            success: (r) => afterSave(r, onSaved)
        });
        modules.mountIconField('formSubmoduleAdd');
    }

    async editSubmodule(id, onSaved) {
        const request = await useFetch({ url: this._link, data: { opc: 'getSubmodule', id: id } });
        if (request.status !== 200) { alert({ icon: 'error', text: request.message || 'No se pudo cargar el submódulo', btn1: true }); return; }

        const name  = request.data && request.data.name ? request.data.name : '';
        const title = name
            ? `Editar Submódulo · <span class="text-blue-600 font-bold">${esc(name)}</span>`
            : 'Editar Submódulo';

        this.createModalForm({
            id: 'formSubmoduleEdit', data: { opc: 'editSubmodule', id: id }, theme: 'light', coffeesoft: true,
            bootbox: { title: title }, autofill: request.data, json: this.jsonSubmodule(),
            success: (r) => afterSave(r, onSaved)
        });
        modules.mountIconField('formSubmoduleEdit', request.data ? request.data.icon : '');
    }

    toggleSubmodule(id, active, onSaved) {
        this.swalQuestion({
            opts: { title: `¿${active == 1 ? 'Activar' : 'Desactivar'} submódulo?`, text: `¿Deseas ${active == 1 ? 'activar' : 'desactivar'} este submódulo?`, icon: 'warning' },
            data: { opc: 'toggleSubmodule', id: id, active: active },
            methods: { send: (r) => afterSave(r, onSaved) }
        });
    }

    deleteSubmodule(id, onSaved) {
        this.swalQuestion({
            opts: {
                title: '¿Eliminar submódulo para siempre?',
                text: 'Sus secciones no se borran: pasan a «Sin submódulo» del mismo módulo. Esta acción no se puede deshacer.',
                icon: 'warning'
            },
            data: { opc: 'deleteSubmodule', id: id },
            methods: { send: (r) => afterSave(r, onSaved) }
        });
    }

    jsonSubmodule() {
        return [
            { opc: 'input', id: 'name', lbl: 'Nombre del submódulo', class: 'col-12 col-md-6 mb-3', required: true, onkeyup: 'autoCode(this.value)' },
            { opc: 'select', id: 'module_id', lbl: 'Módulo', class: 'col-12 col-md-6 mb-3', required: true, data: dataInit.modules || [] },
            { opc: 'input', id: 'code', lbl: 'Código (automático)', class: 'col-12 col-md-6 mb-3', readonly: true, required: false },
            // Hueco vacío: lo rellena modules.mountIconField() con el selector de íconos.
            { opc: 'div', id: 'iconFieldWrap', lbl: 'Ícono', class: 'col-12 col-md-6 mb-3', required: false },
            { opc: 'select', id: 'route', lbl: 'Ruta', class: 'col-12 col-md-6 mb-3', selected: '-- Selecciona --', select2: true, required: false, data: dataInit.routes || [] },
            { opc: 'input', id: 'description', lbl: 'Descripción', class: 'col-12 col-md-6 mb-3', required: false, placeholder: 'Texto que se muestra en la tarjeta' },
            { opc: 'input', id: 'orden', lbl: 'Orden', type: 'number', class: 'col-12 col-md-6 mb-3', required: false }
        ];
    }
}

// -- Secciones (pestaña Módulos) --
// Módulos en tarjetas a la izquierda; a la derecha sus submódulos en bloques con
// las secciones en tarjetas, cada una con sus permisos (tipos de permiso) como
// chips. Desde aquí se crean los tres niveles y se eligen los permisos de cada sección.

class Sections extends Templates {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Sections';
        this.rows = [];
        this.moduleCatalog = [];
        this.submoduleCatalog = [];
        this.types = [];
        this.catalog = {};
        this.activeModuleId = 0;
        this.search = '';
        this.moduleQuery = '';
        this.collapsed = {};
    }

    get status() {
        return String($('#filterbar-sections #active').val() || '1');
    }

    // -- Interface --

    render() {
        this.search = '';
        this.moduleQuery = '';
        this.layout();
        this.filterBar();
    }

    layout() {
        this.createLayout({
            parent: 'container-modulos',
            design: false,
            data: {
                id: 'sectionsBoard',
                class: 'flex flex-col gap-2 flex-1 lg:min-h-0',
                container: [
                    {
                        type: 'div',
                        id: 'filterbar-sections',
                        class: 'w-full'
                    },
                    {
                        // Módulos: media pulgada (48px) menos que su antiguo col-span-3,
                        // que medía 25% - 6px por los huecos de la rejilla de 12.
                        type: 'div',
                        id: 'sections-body',
                        class: 'grid grid-cols-1 lg:grid-cols-[calc(25%-54px)_minmax(0,1fr)] gap-2 items-stretch flex-1 lg:min-h-0',
                        children: [
                            {
                                id: 'sections-modules',
                                class: 'min-h-0 min-w-0'
                            },
                            {
                                id: 'sections-list',
                                class: 'min-h-0 min-w-0'
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
                    // En celular, Nuevo Módulo y Nuevo Submódulo comparten renglón.
                    opc: 'button',
                    id: 'btnNewModule',
                    class: 'col-6 col-sm-4 col-lg-2',
                    text: 'Nuevo Módulo',
                    color_btn: 'outline',
                    onClick: () => modules.addModule(() => this.lsSections())
                },
                {
                    opc: 'button',
                    id: 'btnNewSubmodule',
                    class: 'col-6 col-sm-4 col-lg-2',
                    text: 'Nuevo Submódulo',
                    color_btn: 'outline',
                    onClick: () => submodules.addSubmodule(this.activeModuleId, () => this.lsSections())
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

        // El outline trae bg-white y border, que Bootstrap marca con !important: le
        // ganaban al hover:bg-blue-600 y el botón no se rellenaba. Mismo gris en
        // reposo, con ring en vez de border para que el hover pinte el contorno.
        $('#btnNewModule, #btnNewSubmodule')
            .removeClass('bg-white border')
            .addClass('bg-[#fff] ring-1 ring-inset ring-gray-200 hover:ring-blue-600');
    }

    // Panel izquierdo. El buscador se pinta aquí y la lista aparte (renderModuleCards)
    // para que escribir no lo re-pinte y pierda el foco.
    renderModules() {
        const input = $('<input>', {
            type: 'search',
            value: this.moduleQuery,
            placeholder: 'Buscar módulo…',
            class: 'flex-1 min-w-0 px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-1 focus:ring-blue-600/30'
        }).on('input', (e) => {
            this.moduleQuery = e.currentTarget.value || '';
            this.renderModuleCards();
        });

        const panel = $('<div>', { class: 'bg-white border border-gray-200 rounded-xl h-full min-h-0 flex flex-col overflow-hidden' }).append(
            $('<div>', { class: 'flex items-center gap-2 px-3 py-2 border-b border-gray-100 shrink-0' }).append(
                $('<span>', { class: 'text-sm font-semibold text-gray-800 shrink-0', text: 'Módulos' }),
                input
            ),
            // En celular, con tope de alto: si hay muchos módulos no empujan las secciones.
            $('<div>', { id: 'sectionsModuleCards', class: 'flex-1 min-h-0 max-h-[55vh] lg:max-h-none overflow-y-auto p-2 bg-gray-50 flex flex-col gap-2' })
        );

        $('#sections-modules').html(panel);
        this.renderModuleCards();
    }

    renderModuleCards() {
        const query = this.normalize(this.moduleQuery.trim());
        const items = this.buildModuleItems().filter(m => !query || this.normalize(m.label).includes(query));
        const $list = $('#sectionsModuleCards').empty();

        items.forEach((m) => $list.append(this.moduleCard(m)));

        if (!items.length) {
            $list.append($('<p>', {
                class: 'text-xs text-gray-400 text-center px-3 py-6 mb-0',
                text: query ? `Sin módulos para «${this.moduleQuery.trim()}»` : 'Sin módulos todavía. Usa «Nuevo Módulo».'
            }));
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // Contorno con ring y no con border: Bootstrap marca .border con !important y
    // le ganaría al resaltado del módulo elegido.
    moduleCard(item) {
        const selected = item.id === Number(this.activeModuleId);
        const dim = item.muted ? ' opacity-60' : '';

        const actions = $('<div>', { class: 'flex items-center gap-1.5 shrink-0' });
        if (item.editable) actions.append(this.iconButton('pencil', 'Editar módulo', () => modules.editModule(item.id, () => this.lsSections())));
        if (item.switchable) actions.append(csGlSwitch(item.on, () => modules.toggleModule(item.id, item.on ? 0 : 1, () => this.lsSections())));

        const title = $('<p>', { class: 'flex items-center gap-2 text-lg font-bold text-gray-900 leading-tight mb-1' }).append(
            $('<span>', { class: 'truncate', text: item.label })
        );
        if (item.tag) title.append(this.tag(item.tag));

        const card = $('<div>', {
            role: 'button',
            tabindex: 0,
            'aria-pressed': selected ? 'true' : 'false',
            class: 'flex flex-col gap-3 p-4 rounded-xl bg-white cursor-pointer transition '
                + (selected ? 'ring-1 ring-blue-600 shadow-md' : 'ring-1 ring-inset ring-gray-200 hover:shadow-md')
        }).append(
            $('<div>', { class: 'flex items-start justify-between gap-2' }).append(
                $('<span>', { class: 'shrink-0 w-12 h-12 inline-flex items-center justify-center rounded-xl bg-blue-600/10 text-blue-600' + dim })
                    .append($('<i>', { 'data-lucide': item.icon, class: 'w-6 h-6' })),
                actions
            ),
            $('<div>', { class: 'min-w-0' + dim }).append(
                title,
                item.description ? $('<p>', { class: 'text-sm text-gray-500 mb-0', text: item.description }) : null
            )
        );

        card.on('click', () => this.onModuleSelect(item.id));
        card.on('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            this.onModuleSelect(item.id);
        });

        return card;
    }

    // Panel derecho: bloques por submódulo (o por módulo, buscando) con las secciones
    // en tarjetas. Conserva el scroll, porque se re-pinta tras cada cambio.
    renderBoard() {
        const searching = this.search !== '';
        const top = $('#listSections').scrollTop() || 0;
        const groups = searching ? this.buildSearchGroups() : this.buildSubmoduleGroups();

        const board = $('<div>', { id: 'listSections', class: 'bg-white border border-gray-200 rounded-xl h-full min-h-0 overflow-y-auto p-3 flex flex-col gap-3' });

        if (groups.length) {
            groups.forEach((g) => board.append(this.groupBlock(g, !searching)));
        } else if (searching) {
            const hints = {
                '1': 'Revisa cómo está escrito o cambia Estado a Inactivos: las secciones apagadas viven ahí.',
                '0': 'Revisa cómo está escrito o cambia Estado a Activos: aquí solo se buscan las apagadas.',
                all: 'Revisa cómo está escrito.'
            };
            board.append(this.emptyState('search-x', `Sin resultados para «${this.search}»`, hints[this.status] || hints.all));
        } else {
            board.append(this.emptyState('layout-grid', 'Todavía no hay módulos', 'Crea el primero con «Nuevo Módulo».'));
        }

        $('#sections-list').html(board);
        $('#listSections').scrollTop(top);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    groupBlock(group, sortable) {
        const open = !this.collapsed[group.id];

        const side = $('<span>', { class: 'flex items-center gap-2 shrink-0' }).append(
            $('<span>', { class: 'text-[11px] font-medium text-gray-400', text: group.count !== undefined ? group.count : group.items.length })
        );
        // Apagado, el submódulo también se puede eliminar (como las secciones).
        if (group.submoduleId) {
            side.append(this.iconButton('pencil', 'Editar submódulo', () => submodules.editSubmodule(group.submoduleId, () => this.lsSections())));
            if (!group.on) {
                side.append(this.iconButton('trash-2', 'Eliminar submódulo', () => submodules.deleteSubmodule(group.submoduleId, () => this.lsSections()), 'hover:text-red-600'));
            }
            side.append(csGlSwitch(group.on, () => submodules.toggleSubmodule(group.submoduleId, group.on ? 0 : 1, () => this.lsSections())));
        }

        const title = $('<span>', { class: 'flex items-center gap-2 min-w-0' }).append(
            $('<i>', { 'data-lucide': 'chevron-down', class: 'cs-sec-chevron w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform' + (open ? '' : ' -rotate-90') }),
            $('<span>', { class: 'text-sm font-semibold truncate ' + (group.muted ? 'text-gray-500' : 'text-gray-800'), text: group.title })
        );
        if (group.tag) title.append(this.tag(group.tag));

        const head = $('<div>', {
            role: 'button',
            class: 'flex items-center justify-between gap-2 px-3 py-2.5 bg-gray-50 cursor-pointer select-none'
        }).append(title, side);

        const body = $('<div>', { class: open ? '' : 'hidden' });

        // Ordenando, todos los grupos del módulo comparten el arrastre (group de
        // Sortable): una sección se reordena en el suyo o se suelta en otro
        // submódulo, también en uno vacío.
        if (sortable && typeof Sortable !== 'undefined') {
            const grid = $('<div>', {
                class: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3 min-h-[52px]',
                'data-submodule': group.submoduleId || 0
            });
            group.items.forEach((row) => grid.append(this.sectionCard(row, true)));
            if (!group.items.length) {
                grid.append($('<p>', { class: 'col-span-full px-1 py-1 text-xs text-gray-400 mb-0', text: group.emptyText }));
            }
            body.append(grid);

            Sortable.create(grid[0], {
                group: `sections-${this.activeModuleId}`,
                handle: '.cs-sec-handle',
                draggable: '.cs-sec-card',
                animation: 150,
                ghostClass: 'opacity-40',
                onEnd: (evt) => {
                    const ids = $(evt.to).children('.cs-sec-card').map((_i, el) => $(el).data('id')).get();

                    if (evt.from !== evt.to) {
                        this.moveSection($(evt.item).data('id'), Number($(evt.to).data('submodule')), ids);
                        return;
                    }
                    if (evt.oldIndex !== evt.newIndex) this.sortSections(ids);
                }
            });
        } else if (group.items.length) {
            const grid = $('<div>', { class: 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 p-3' });
            group.items.forEach((row) => grid.append(this.sectionCard(row, false)));
            body.append(grid);
        } else {
            body.append($('<p>', { class: 'px-4 py-3 text-xs text-gray-400 mb-0', text: group.emptyText }));
        }

        head.on('click', () => {
            const isOpen = !body.hasClass('hidden');
            body.toggleClass('hidden', isOpen);
            head.find('.cs-sec-chevron').toggleClass('-rotate-90', isOpen);
            this.collapsed[group.id] = isOpen;
        });

        return $('<div>', { class: 'rounded-xl ring-1 ring-inset ring-gray-200 overflow-hidden shrink-0' }).append(head, body);
    }

    // Accesos encendida no lleva interruptor: el ctrl no deja apagarla (deja fuera a todos).
    sectionCard(row, sortable) {
        const on = Number(row.is_active) === 1;
        const locked = row.code === 'accesos' && on;
        const types = this.types.filter(t => this.isOn(row.id, t.id));

        const actions = $('<div>', { class: 'flex items-center gap-1.5 shrink-0' }).append(
            this.iconButton('pencil', 'Editar sección', () => this.editSection(row.id))
        );
        if (!on) actions.append(this.iconButton('trash-2', 'Eliminar sección', () => this.deleteSection(row.id), 'hover:text-red-600'));
        if (!locked) actions.append(csGlSwitch(on, () => this.toggleSection(row.id, on ? 0 : 1)));

        const chips = $('<div>', { class: 'flex flex-wrap gap-1.5' });
        types.forEach((t) => chips.append(this.typeChip(row, t)));
        if (!types.length) {
            chips.append($('<span>', { class: 'text-[11px] italic text-gray-400', text: 'Sin permisos: agrégalos con el lápiz' }));
        }

        const card = $('<div>', {
            'data-id': row.id,
            class: 'cs-sec-card relative flex flex-col gap-2.5 p-3 rounded-xl bg-white ring-1 ring-inset ring-gray-200 hover:shadow-sm transition' + (sortable ? ' pl-6' : '')
        });

        if (sortable) {
            card.append($('<span>', {
                class: 'cs-sec-handle absolute left-1 top-1/2 -translate-y-1/2 inline-flex text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing'
            }).attr('title', 'Arrastra para ordenar').append($('<i>', { 'data-lucide': 'grip-vertical', class: 'w-3.5 h-3.5' })));
        }

        card.append(
            $('<div>', { class: 'flex items-start gap-2.5 min-w-0' }).append(
                $('<span>', { class: 'shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg ring-1 ring-inset ring-gray-200 text-gray-500' + (on ? '' : ' opacity-60') })
                    .append($('<i>', { 'data-lucide': row.icon || 'square', class: 'w-4 h-4' })),
                $('<div>', { class: 'min-w-0 flex-1' + (on ? '' : ' opacity-60') }).append(
                    $('<p>', { class: 'text-[13px] font-semibold text-gray-800 truncate mb-0', text: row.name }),
                    $('<p>', { class: 'text-[11px] text-gray-400 font-mono truncate mb-0', text: row.route || 'Sin ruta' })
                ),
                actions
            ),
            chips
        );

        if (!on && row.duplicate_of) {
            card.append($('<p>', {
                class: 'text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 mb-0',
                text: `Duplica a «${row.duplicate_of}» activa: misma ruta ${row.route || ''}. Encenderla pintaría dos items idénticos en el menú.`
            }));
        }

        card.on('contextmenu', (e) => this.openSectionMenu(e, row));

        return card;
    }

    // -- Menú del clic derecho --

    /*  Lo que se puede hacer con la sección, y sus permisos para prenderlos o
        apagarlos sin abrir el modal. Va colgado de <body> y no de la tarjeta: el
        tablero se re-pinta tras cada cambio y el menú sigue abierto encima. */
    openSectionMenu(e, row) {
        e.preventDefault();
        this.closeSectionMenu();

        const on = Number(row.is_active) === 1;
        const locked = row.code === 'accesos' && on;

        const menu = $('<div>', {
            id: 'sectionMenu',
            role: 'menu',
            class: 'fixed z-[60] w-60 max-h-[80vh] overflow-y-auto py-1.5 rounded-xl bg-white ring-1 ring-gray-200 shadow-xl text-sm'
        }).append(
            $('<div>', { class: 'px-3 pt-1 pb-2 mb-1 border-b border-gray-100' }).append(
                $('<p>', { class: 'text-[13px] font-semibold text-gray-800 truncate mb-0', text: row.name }),
                $('<p>', { class: 'text-[11px] text-gray-400 font-mono truncate mb-0', text: row.route || 'Sin ruta' })
            ),
            this.menuItem('pencil', 'Editar sección', () => this.editSection(row.id))
        );

        if (this.types.length) {
            menu.append($('<p>', { class: 'px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0', text: 'Permisos' }));
            this.types.forEach((t) => menu.append(this.menuTypeItem(row, t)));
        }

        if (!locked || !on) menu.append($('<div>', { class: 'my-1 border-b border-gray-100' }));
        if (!locked) menu.append(this.menuItem('power', on ? 'Desactivar sección' : 'Activar sección', () => this.toggleSection(row.id, on ? 0 : 1)));
        if (!on) menu.append(this.menuItem('trash-2', 'Eliminar sección', () => this.deleteSection(row.id), true));

        $('body').append(menu);
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Donde se hizo el clic, sin salirse de la ventana.
        menu.css({
            left: Math.max(8, Math.min(e.clientX, window.innerWidth - menu.outerWidth() - 8)),
            top: Math.max(8, Math.min(e.clientY, window.innerHeight - menu.outerHeight() - 8))
        });

        // Se cierra con un clic fuera, Escape, al cambiar de ventana o al hacer scroll fuera de él.
        $(document).on('mousedown.sectionMenu', (ev) => {
            if (!$(ev.target).closest('#sectionMenu').length) this.closeSectionMenu();
        });
        $(document).on('keydown.sectionMenu', (ev) => {
            if (ev.key === 'Escape') this.closeSectionMenu();
        });
        $(window).on('resize.sectionMenu blur.sectionMenu', () => this.closeSectionMenu());

        this.menuScroll = (ev) => {
            if (!menu[0].contains(ev.target)) this.closeSectionMenu();
        };
        document.addEventListener('scroll', this.menuScroll, true);
    }

    closeSectionMenu() {
        $('#sectionMenu').remove();
        $(document).off('.sectionMenu');
        $(window).off('.sectionMenu');
        if (this.menuScroll) {
            document.removeEventListener('scroll', this.menuScroll, true);
            this.menuScroll = null;
        }
    }

    menuItem(icon, label, onClick, danger = false) {
        return $('<button>', {
            type: 'button',
            role: 'menuitem',
            class: 'w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition '
                + (danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50')
        }).append(
            $('<i>', { 'data-lucide': icon, class: 'w-4 h-4 shrink-0 ' + (danger ? '' : 'text-gray-400') }),
            $('<span>', { text: label })
        ).on('click', () => {
            this.closeSectionMenu();
            onClick();
        });
    }

    // El permiso cambia sin cerrar el menú, para marcar varios seguidos.
    menuTypeItem(row, type) {
        const item = $('<button>', {
            type: 'button',
            role: 'menuitemcheckbox',
            class: 'w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-gray-700 hover:bg-gray-50 transition disabled:opacity-50'
        });

        const paint = () => {
            const on = this.isOn(row.id, type.id);
            item.attr('aria-checked', on ? 'true' : 'false').empty().append(
                $('<span>', { class: 'shrink-0 w-4 h-4 inline-flex items-center justify-center rounded ' + (on ? 'bg-blue-600 text-white' : 'ring-1 ring-inset ring-gray-300') })
                    .append(on ? $('<i>', { 'data-lucide': 'check', class: 'w-3 h-3' }) : null),
                $('<span>', { class: 'flex-1 truncate', text: type.name })
            );
            if (typeof lucide !== 'undefined') lucide.createIcons();
        };

        item.on('click', async () => {
            item.prop('disabled', true);
            await this.setType(row, type, this.isOn(row.id, type.id) ? 0 : 1);
            item.prop('disabled', false);
            paint();
        });

        paint();
        return item;
    }

    typeChip(row, type) {
        const permission = this.catalog[this.key(row.id, type.id)];

        const remove = $('<button>', {
            type: 'button',
            'aria-label': `Quitar ${type.name} de ${row.name}`,
            class: 'inline-flex items-center justify-center w-4 h-4 rounded-full text-blue-600/60 hover:text-white hover:bg-blue-600 transition'
        }).attr('title', `Quitar ${type.name}`).append($('<i>', { 'data-lucide': 'x', class: 'w-3 h-3' }));

        remove.on('click', (e) => {
            e.stopPropagation();
            this.setType(row, type, 0);
        });

        return $('<span>', {
            class: 'inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium bg-blue-600/10 text-blue-700'
        }).attr('title', this.typeTitle(type, permission)).append($('<span>', { text: type.name }), remove);
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
        this.types = request.types || [];
        this.catalog = {};
        (request.permissions || []).forEach((p) => { this.catalog[this.key(p.section_id, p.type_permission_id)] = p; });
        this.sortRows();

        // Los selects de Módulo y Submódulo de los modales salen de dataInit: se
        // refrescan aquí porque los tres niveles se crean y apagan desde este panel.
        dataInit.modules = this.moduleCatalog
            .filter(m => Number(m.is_active) === 1)
            .map(m => ({
                id: m.id,
                valor: m.name
            }));

        // También los apagados: editar una sección que vive en uno no debe sacarla de él.
        dataInit.submodules = this.submoduleCatalog.map(s => ({
            id: s.id,
            valor: Number(s.is_active) === 1 ? s.name : `${s.name} (apagado)`,
            module_id: s.module_id
        }));

        // Sin "Todos": si el elegido ya no está en la lista, queda el primero.
        const items = this.buildModuleItems();
        if (!items.some(m => String(m.id) === String(this.activeModuleId))) {
            this.activeModuleId = items.length ? items[0].id : 0;
        }

        this.renderModules();
        this.renderBoard();
    }

    // Reparte los mismos números de orden del grupo en el nuevo acomodo (sin
    // empates) y deja solo las secciones cuyo orden cambió.
    orderItems(ids) {
        const rows = ids.map(id => this.rows.find(r => Number(r.id) === Number(id))).filter(Boolean);
        const slots = rows.map(r => Number(r.orden)).sort((a, b) => a - b);

        let prev = -Infinity;
        return rows
            .map((r, i) => {
                const orden = Math.max(slots[i], prev + 1);
                prev = orden;
                return {
                    id: Number(r.id),
                    orden: orden
                };
            })
            .filter(x => Number(this.rows.find(r => Number(r.id) === x.id).orden) !== x.orden);
    }

    async sortSections(ids) {
        const items = this.orderItems(ids);
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

    // Soltada en otro submódulo: cambia de grupo y el de destino se reordena con
    // ella. Si falla, renderBoard la regresa a donde estaba.
    async moveSection(id, submoduleId, ids) {
        const items = this.orderItems(ids);

        const request = await useFetch({
            url: this._link,
            data: {
                opc: 'moveSection',
                id: id,
                submodule_id: submoduleId,
                items: JSON.stringify(items)
            }
        });

        if (request && request.status === 200) {
            const row = this.rows.find(r => Number(r.id) === Number(id));
            if (row) row.submodule_id = submoduleId || null;
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

        this.bindSubmoduleSelect('formSectionAdd', '');
        modules.mountIconField('formSectionAdd', '', false);
        this.mountTypesField('formSectionAdd', []);
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

        this.bindSubmoduleSelect('formSectionEdit', request.data ? request.data.submodule_id : '');
        modules.mountIconField('formSectionEdit', request.data ? request.data.icon : '', false);
        this.mountTypesField('formSectionEdit', request.type_ids || []);
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
                title: '¿Eliminar sección para siempre?',
                text: 'Se borran la sección, sus permisos y lo que los roles tenían de ella. La carpeta y sus archivos no se tocan. Esta acción no se puede deshacer.',
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

    // Prende o apaga un permiso de la sección (chip × y menú del clic derecho).
    // Quitar uno que ya tienen roles se confirma: deja de aparecer en sus
    // permisos, aunque lo recuperan si se vuelve a poner. true si cambió.
    async setType(row, type, active) {
        const permission = this.catalog[this.key(row.id, type.id)];
        const roles = permission ? permission.roles : 0;

        if (!active && roles > 0) {
            const answer = await this.swalQuestion({
                extends: true,
                opts: {
                    title: `¿Quitar «${esc(type.name)}» de ${esc(row.name)}?`,
                    text: `Lo ${roles === 1 ? 'tiene 1 rol' : `tienen ${roles} roles`}: deja de aparecer en sus permisos. Si lo vuelves a poner, lo recuperan.`,
                    icon: 'warning'
                }
            });

            if (!answer.isConfirmed) return false;
        }

        const request = await useFetch({
            url: this._link,
            data: {
                opc: 'togglePermission',
                section_id: row.id,
                type_permission_id: type.id,
                active: active
            }
        });

        if (!request || request.status !== 200) {
            notify(request);
            return false;
        }

        if (request.permission) this.catalog[this.key(row.id, type.id)] = request.permission;
        this.renderBoard();
        return true;
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
                // Las opciones las pone bindSubmoduleSelect() según el módulo elegido.
                opc: 'select',
                id: 'submodule_id',
                lbl: 'Submódulo (opcional)',
                class: 'col-12 col-md-6 mb-3',
                required: false,
                data: []
            },
            {
                opc: 'input',
                id: 'code',
                lbl: 'Código (automático)',
                class: 'col-12 col-md-6 mb-3',
                readonly: true,
                required: false
            },
            {
                opc: 'div',
                id: 'iconFieldWrap',
                lbl: 'Ícono',
                class: 'col-12 col-md-6 mb-3',
                required: false
            },
            {
                opc: 'input',
                id: 'orden',
                lbl: 'Orden',
                type: 'number',
                class: 'col-12 col-md-6 mb-3',
                required: false
            },
            {
                opc: 'select',
                id: 'route',
                lbl: 'Ruta',
                class: 'col-12 mb-3',
                selected: '-- Selecciona --',
                select2: true,
                required: false,
                data: dataInit.routes || []
            },
            {
                // Hueco vacío: lo rellena mountTypesField() con el select de permisos.
                opc: 'div',
                id: 'typesFieldWrap',
                lbl: 'Permisos de la sección',
                class: 'col-12 mb-3',
                required: false
            }
        ];
    }

    // -- Complements --

    /*  Permisos de la sección: select2 múltiple con los tipos de permiso activos.
        Viajan como JSON en el hidden `type_ids` y no como el select: el modal arma
        su envío con FormData y de un select múltiple solo se quedaría el último.
        Debajo va "+ Nuevo permiso" (typeCreator) para crear uno sin salir del modal. */
    mountTypesField(formId, selected) {
        const $wrap = $(`#${formId}`).find('#typesFieldWrap');
        if (!$wrap.length) return;

        const picked = (selected || []).map(Number);
        const $input = $('<input>', { type: 'hidden', name: 'type_ids' });
        const $select = $('<select>', { id: `${formId}Types`, multiple: true, class: 'w-full' });

        this.types.forEach((t) => $select.append($('<option>', {
            value: t.id,
            text: t.name,
            selected: picked.includes(Number(t.id))
        })));

        $wrap.empty().append(
            $select,
            $input,
            this.typeCreator($select),
            $('<p>', { class: 'text-[11px] text-gray-400 mt-1 mb-0', text: 'Quitar uno que ya tienen roles lo oculta de sus permisos; si lo vuelves a poner, lo recuperan.' })
        );

        const sync = () => $input.val(JSON.stringify(($select.val() || []).map(Number)));
        $select.on('change', sync);
        sync();

        // Anclado al modal: fuera de él el dropdown quedaría detrás (head.php baja
        // .select2-dropdown a z-index 1).
        if ($.fn.select2) {
            const cfg = {
                theme: 'bootstrap-5',
                width: '100%',
                placeholder: this.types.length ? 'Elige los permisos de la sección' : 'Crea el primero con «Nuevo permiso»',
                closeOnSelect: false
            };
            const $modal = $select.closest('.cf-modal, .modal, .bootbox');
            if ($modal.length) cfg.dropdownParent = $modal;
            $select.select2(cfg);
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    /*  "+ Nuevo permiso": crea el tipo de permiso ahí mismo (queda en el catálogo,
        para todas las secciones) y lo deja elegido en el select. El texto no lleva
        name, así que no viaja con la sección, y su Enter / Escape se detienen aquí:
        el modal escucha esas teclas en document para Aceptar y cerrar. */
    typeCreator($select) {
        const $toggle = $('<button>', {
            type: 'button',
            class: 'inline-flex items-center gap-1 mt-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700'
        }).append(
            $('<i>', { 'data-lucide': 'plus', class: 'w-3.5 h-3.5' }),
            $('<span>', { text: 'Nuevo permiso' })
        );

        const $name = $('<input>', {
            type: 'text',
            maxlength: 60,
            placeholder: 'Ej. Exportar',
            'aria-label': 'Nombre del nuevo permiso',
            class: this.cfThemedClass(CF_CSS.input, 'light') + ' flex-1 min-w-0 py-1.5'
        });
        const $add = $('<button>', {
            type: 'button',
            class: 'shrink-0 px-3 py-1.5 rounded-lg bg-main text-white text-xs font-semibold hover:bg-main-hover disabled:opacity-50',
            text: 'Agregar'
        });
        const $cancel = $('<button>', {
            type: 'button',
            class: 'shrink-0 px-2 py-1.5 rounded-lg text-xs font-medium text-gray-500 hover:text-gray-800',
            text: 'Cancelar'
        });
        const $row = $('<div>', { class: 'hidden flex items-center gap-2 mt-2' }).append($name, $add, $cancel);

        const open = (show) => {
            $row.toggleClass('hidden', !show);
            $toggle.toggleClass('hidden', show);
            if (show) $name.val('').trigger('focus');
        };

        const save = async () => {
            const name = String($name.val() || '').trim();
            if (!name) {
                $name.trigger('focus');
                return;
            }

            $add.prop('disabled', true);
            const request = await useFetch({ url: this._link, data: { opc: 'addTypePermission', name: name } });
            $add.prop('disabled', false);

            if (!request || request.status !== 200) {
                notify(request);
                return;
            }

            const type = { id: Number(request.type.id), name: request.type.name };
            this.types.push(type);
            $select.append(new Option(type.name, type.id, true, true)).trigger('change');
            open(false);
        };

        $toggle.on('click', () => open(true));
        $cancel.on('click', () => open(false));
        $add.on('click', save);
        $name.on('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== 'Escape') return;
            e.preventDefault();
            e.stopPropagation();
            if (e.key === 'Enter') save();
            else open(false);
        });

        return $('<div>').append($toggle, $row);
    }

    // El select de submódulo solo ofrece los del módulo elegido y se rehace al
    // cambiarlo. Valor 0 = sin submódulo (el ctrl lo guarda como NULL).
    bindSubmoduleSelect(formId, selected) {
        const $form = $(`#${formId}`);
        const $module = $form.find('#module_id');
        const $sub = $form.find('#submodule_id');

        const fill = (keep) => {
            const options = (dataInit.submodules || []).filter(s => String(s.module_id) === String($module.val()));

            $sub.empty().append($('<option>', { value: '0', text: '-- Sin submódulo --' }));
            options.forEach((s) => $sub.append($('<option>', { value: s.id, text: s.valor })));
            $sub.val(options.some(s => String(s.id) === String(keep)) ? String(keep) : '0');
        };

        fill(selected);
        $module.on('change', () => fill($sub.val()));
    }

    onModuleSelect(id) {
        if (String(id) === String(this.activeModuleId)) return;
        this.activeModuleId = id;
        this.renderModuleCards();
        this.renderBoard();
    }

    onSearch(value) {
        const search = (value || '').trim();
        if (search === this.search) return;
        this.search = search;
        this.renderBoard();
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

        return catalog
            .map((m) => {
                const count = this.rows.filter(r => Number(r.module_id) === Number(m.id)).length;
                const off = Number(m.is_active) !== 1;
                // Developer encendido no lleva interruptor: apagarlo deja a todos fuera.
                const locked = m.code === 'developer' && !off;
                return {
                    id: Number(m.id),
                    label: m.name,
                    icon: m.icon || 'layout-grid',
                    description: m.description || '',
                    count: count,
                    tag: off ? 'apagado' : '',
                    muted: off,
                    off: off,
                    on: !off,
                    editable: !m.orphan,
                    switchable: !m.orphan && !locked
                };
            })
            .filter(m => !m.off || m.count > 0 || status !== '1');
    }

    // "Sin submódulo" primero; luego todos los submódulos del módulo, incluidos los
    // apagados, cada uno con su editar e interruptor en la cabecera.
    buildSubmoduleGroups() {
        const moduleId = Number(this.activeModuleId);
        if (!moduleId) return [];

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
                items: rows.filter(r => !r.submodule_id)
            }
        ];

        subs.forEach((s) => {
            const off = Number(s.is_active) !== 1;
            groups.push({
                id: `${moduleId}-${s.id}`,
                submoduleId: Number(s.id),
                title: s.name,
                on: !off,
                tag: off ? 'apagado' : '',
                muted: off,
                emptyText: inactive
                    ? 'No hay secciones apagadas en este submódulo.'
                    : 'Sin secciones en este submódulo.',
                items: rows.filter(r => Number(r.submodule_id) === Number(s.id))
            });
        });

        return groups;
    }

    // La búsqueda ignora el módulo elegido: cruza todos y agrupa por módulo.
    buildSearchGroups() {
        const query = this.normalize(this.search);

        return this.buildModuleItems()
            .map((m) => {
                const items = this.rows.filter(r => Number(r.module_id) === m.id && this.normalize(r.name).includes(query));
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

    // title con .attr(): como prop de $('<el>', {...}) jQuery llama a $.fn.title
    // (complementos.js), que lo vuelve popover y queda huérfano al re-pintar.
    iconButton(icon, label, onClick, hover = 'hover:text-blue-600') {
        return $('<button>', {
            type: 'button',
            'aria-label': label,
            class: `w-7 h-7 inline-flex items-center justify-center rounded-md text-gray-400 ${hover} hover:bg-gray-100 transition`
        }).attr('title', label).append($('<i>', { 'data-lucide': icon, class: 'w-3.5 h-3.5' })).on('click', (e) => {
            e.stopPropagation();
            onClick();
        });
    }

    tag(text) {
        return $('<span>', { class: 'shrink-0 px-1.5 rounded bg-amber-50 text-amber-700 text-[11px] font-medium', text: text });
    }

    emptyState(icon, title, text) {
        return $('<div>', { class: 'flex-1 flex flex-col items-center justify-center text-center py-14 px-6' }).append(
            $('<i>', { 'data-lucide': icon, class: 'w-8 h-8 text-gray-300 mb-2' }),
            $('<p>', { class: 'text-sm font-medium text-gray-600 mb-0', text: title }),
            $('<p>', { class: 'text-xs text-gray-400 mt-1 mb-0 max-w-sm', text: text })
        );
    }

    isOn(sectionId, typeId) {
        const permission = this.catalog[this.key(sectionId, typeId)];
        return !!permission && permission.is_active === 1;
    }

    typeTitle(type, permission) {
        const roles = permission ? permission.roles : 0;
        if (!roles) return type.name;
        return `${type.name} · lo ${roles === 1 ? 'tiene 1 rol' : `tienen ${roles} roles`}`;
    }

    key(sectionId, typeId) {
        return `${sectionId}_${typeId}`;
    }

    sortRows() {
        this.rows.sort((a, b) => (Number(a.orden) - Number(b.orden)) || (Number(a.id) - Number(b.id)));
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
            <div id="table-types" class="overflow-x-auto"></div>
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

    // Sin pestaña propia: se administra desde el panel de roles de la pestaña
    // Permisos, que pasa en onSaved cómo refrescarse al guardar.

    // El rol nace donde esté el filtro: en esa empresa, o del sistema con Roles del sistema.
    addRole(companyId, onSaved) {
        const value = String(companyId);

        this.createModalForm({
            id: 'formRoleAdd', data: { opc: 'addRole' }, theme: 'light', coffeesoft: true,
            bootbox: { title: 'Nuevo Rol' }, json: this.jsonRole(false, this.companySelect(value === 'system' || /^\d+$/.test(value) ? value : '')),
            success: (r) => afterSave(r, () => onSaved(r))
        });
    }

    async editRole(id, onSaved) {
        const request = await useFetch({ url: this._link, data: { opc: 'getRole', id: id } });
        if (request.status !== 200) { alert({ icon: 'error', text: request.message || 'No se pudo cargar el rol', btn1: true }); return; }

        const name  = request.data && request.data.name ? request.data.name : '';
        const title = name
            ? `Editar Rol · <span class="text-blue-600 font-bold">${esc(name)}</span>`
            : 'Editar Rol';

        this.createModalForm({
            id: 'formRoleEdit', data: { opc: 'editRole', id: id }, theme: 'light', coffeesoft: true,
            bootbox: { title: title }, autofill: request.data,
            json: this.jsonRole(request.data.code === 'root', this.companyReadonly()),
            success: (r) => afterSave(r, onSaved)
        });
    }

    // Uno del sistema puede estar dado en sucursales de cualquier empresa: el aviso lo dice.
    toggleRole(id, active, onSaved, isSystem) {
        const where = isSystem ? 'una sucursal de cualquier empresa' : 'una sucursal';

        this.swalQuestion({
            opts: {
                title: `¿${active == 1 ? 'Activar' : 'Dar de baja el'} rol?`,
                text: active == 1
                    ? 'El rol vuelve a darse en las sucursales y a sumar sus permisos.'
                    : `Quien lo tenga en ${where} deja de tener sus permisos ahí. Sus permisos y asignaciones se guardan para cuando lo actives.`,
                icon: 'warning'
            },
            data: { opc: 'toggleRole', id: id, active: active },
            methods: { send: (r) => afterSave(r, onSaved) }
        });
    }

    // El código de root es el que le da el acceso total: no se edita.
    jsonRole(locked, company) {
        return [
            company,
            { opc: 'input', id: 'code', lbl: 'Código', class: 'col-12 col-md-6 mb-3', readonly: locked, required: false },
            { opc: 'input', id: 'name', lbl: 'Nombre del rol', class: 'col-12 col-md-6 mb-3', required: true }
        ];
    }

    // -- Empresa del rol --

    // 'system' = rol del sistema: sin empresa y se puede dar en las sucursales de todas.
    companySelect(companyId) {
        return {
            opc: 'select',
            id: 'company_id',
            lbl: 'Empresa',
            class: 'col-12 mb-3',
            required: true,
            selected: 'Elige una empresa',
            value: companyId,
            data: [{ id: 'system', valor: 'Sistema (todas las empresas)' }].concat(dataInit.companies || [])
        };
    }

    // Un rol no cambia de empresa (ni pasa a ser del sistema): sus usuarios ya
    // están asignados en sucursales de esa empresa.
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
}

// -- Permisos --
// Pantalla de roles: a la izquierda se eligen, crean, editan y dan de baja; a la
// derecha se marcan las acciones de cada sección que tiene el rol elegido. Las
// acciones que admite cada sección se eligen en la pestaña Módulos.

class Permissions extends Templates {

    // -- Initial --

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Permissions';
        this.company = 'system';
        this.active = '1';
        this.roles = [];
        this.roleId = 0;
        this.access = null;
        this.saved = '';
    }

    // -- Interface --

    render() {
        this.layout();
        this.filterBar();
    }

    layout() {
        this.createLayout({
            parent: 'container-permisos',
            design: false,
            data: {
                id: 'permissionsBoard',
                class: 'flex flex-col gap-2 flex-1 lg:min-h-0',
                container: [
                    {
                        type: 'div',
                        id: 'filterbar-permissions',
                        class: 'w-full'
                    },
                    {
                        type: 'div',
                        id: 'permissions-body',
                        class: 'grid grid-cols-1 lg:grid-cols-12 gap-2 items-stretch flex-1 lg:min-h-0',
                        children: [
                            {
                                id: 'permissions-roles',
                                class: 'lg:col-span-3 min-h-0'
                            },
                            {
                                id: 'permissions-picker',
                                class: 'lg:col-span-9 min-h-0'
                            }
                        ]
                    }
                ]
            }
        });
    }

    // prefijo: Usuarios también tiene un company_id con select2, y select2 se
    // monta buscando por id. El ctrl lo recibe por name, sin prefijo.
    filterBar() {
        this.createfilterBar({
            parent: 'filterbar-permissions',
            prefijo: 'perm-',
            data: [
                {
                    opc: 'select',
                    id: 'company_id',
                    lbl: 'Empresa',
                    class: 'col-12 col-sm-6 col-lg-3',
                    select2: true,
                    value: this.company,
                    data: companyOptions('system'),
                    onchange: 'permissions.onFilter()'
                },
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    class: 'col-12 col-sm-3 col-lg-2',
                    value: this.active,
                    data: dataInit.statusFilter || [],
                    onchange: 'permissions.onFilter()'
                },
                {
                    opc: 'button',
                    id: 'btnNewRole',
                    class: 'col-12 col-sm-3 col-lg-2',
                    text: 'Nuevo Rol',
                    onClick: () => this.addRole()
                }
            ]
        });
    }

    // Lápiz en todos; interruptor en todos menos root, que no se da de baja.
    renderRoles() {
        const inactive = this.active === '0';
        let empty = this.company === 'system'
            ? 'No hay roles del sistema encendidos. Créalos con «Nuevo Rol».'
            : 'Esta empresa no tiene roles encendidos. Créalos con «Nuevo Rol».';
        if (inactive) empty = 'No hay roles dados de baja con este filtro.';

        this.csNavList({
            parent: 'permissions-roles',
            id: 'navPermissionRoles',
            title: 'Roles',
            active: this.roleId,
            showEdit: true,
            empty: empty,
            json: this.roles.map((r) => ({
                id: r.id,
                label: r.name,
                icon: r.code === 'root' ? 'shield-check' : 'user',
                meta: r.code === 'root'
                    ? 'Acceso total'
                    : `${r.actions} ${r.actions === 1 ? 'acción' : 'acciones'} · ${r.sections} ${r.sections === 1 ? 'sección' : 'secciones'}`,
                tag: r.is_system ? 'sistema' : '',
                muted: r.is_active !== 1,
                editable: true,
                switchable: r.code !== 'root',
                check: false,
                on: r.is_active === 1
            })),
            onSelect: (item) => this.onRoleSelect(item.id),
            onEdit: (item) => this.editRole(item.id),
            onToggle: (item) => this.toggleRole(item.id, item.on ? 0 : 1)
        });
    }

    renderPicker(access) {
        this.access = access;

        const role = this.roles.find(r => r.id === this.roleId);
        const modules = access && !access.fullAccess ? access.modules || [] : [];
        const editable = modules.length > 0;

        const card = $('<div>', { class: 'bg-white border border-gray-200 rounded-xl h-full min-h-0 flex flex-col overflow-hidden' });

        const head = $('<div>', { class: 'flex items-start justify-between gap-3 flex-wrap px-3 py-2.5 border-b border-gray-100 shrink-0' }).append(
            $('<div>', { class: 'min-w-0' }).append(
                $('<h3>', { id: 'permissionsTitle', class: 'text-sm font-semibold text-gray-800 truncate', text: role ? `Permisos de ${role.name}` : 'Permisos' }),
                $('<p>', { class: 'text-[11px] text-gray-400', text: 'Marca lo que puede hacer en cada sección. Solo salen las secciones con permisos definidos en la pestaña Módulos.' })
            )
        );

        if (editable) {
            head.append($('<div>', { class: 'flex items-center gap-2 shrink-0' }).append(
                $('<span>', { id: 'permissionsCount', class: 'text-xs font-medium text-gray-500' }),
                actionButton('rotate-ccw', 'Deshacer', () => this.renderPicker(this.access)).attr('id', 'btnPermissionsUndo'),
                actionButton('save', 'Guardar', () => this.savePermissions(), true).attr('id', 'btnPermissionsSave')
            ));
        }

        const $list = $('<div>', { id: 'permissionsList', class: 'flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2' });

        if (!role) {
            $list.append(accessNote('mouse-pointer-click', 'Elige un rol para ver y asignar sus permisos.'));
        } else if (access && access.fullAccess) {
            $list.append(accessNote('shield-check', 'Rol root: tiene acceso total a todos los módulos y secciones, por eso sus permisos no se editan.'));
        } else if (!modules.length) {
            $list.append(accessNote('info', 'Todavía no hay permisos definidos en las secciones. Agrégalos en la pestaña Módulos y vuelve aquí para asignarlos.'));
        } else {
            modules.forEach((m) => $list.append(this.pickerModule(m)));
        }

        if (role && role.is_active !== 1) {
            $list.prepend(accessNote('archive', 'Rol dado de baja: nadie usa estos permisos hasta que lo actives con su interruptor. Se pueden ajustar desde ya.'));
        }

        card.append(head, $list);
        $('#permissions-picker').html(card);

        if (editable) {
            $list.on('change', '.perm-action', () => this.refreshState());
            $list.on('change', '.perm-section', (e) => {
                $(e.currentTarget).closest('.perm-section-row').find('.perm-action').prop('checked', e.currentTarget.checked);
                this.refreshState();
            });
            $list.on('change', '.perm-module', (e) => {
                $(e.currentTarget).closest('.perm-module-card').find('.perm-action').prop('checked', e.currentTarget.checked);
                this.refreshState();
            });

            this.saved = this.signature(this.checkedIds());
            this.refreshState();
        } else {
            this.saved = '';
        }

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

        return $('<div>', { class: 'perm-module-card border border-gray-200 rounded-xl overflow-hidden shrink-0' }).append(head, body);
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

    // -- CRUD --

    async lsRoles() {
        const request = await useFetch({
            url: this._link,
            data: {
                opc: 'lsPermissionRoles',
                company_id: this.company,
                active: this.active
            }
        });

        if (!request || request.status !== 200) {
            notify(request);
            return;
        }

        this.roles = request.roles || [];
        if (!this.roles.some(r => r.id === this.roleId)) this.roleId = this.roles.length ? this.roles[0].id : 0;

        this.renderRoles();
        this.loadRole();
    }

    async loadRole() {
        if (!this.roleId) {
            this.renderPicker(null);
            return;
        }

        const request = await useFetch({
            url: this._link,
            data: {
                opc: 'getRolePermissions',
                id: this.roleId
            }
        });

        if (!request || request.status !== 200) {
            notify(request);
            return;
        }

        this.renderPicker(request);
    }

    async savePermissions() {
        const ids = this.checkedIds();

        const request = await useFetch({
            url: this._link,
            data: {
                opc: 'saveRolePermissions',
                id: this.roleId,
                permissions: JSON.stringify(ids)
            }
        });

        notify(request);
        if (!request || request.status !== 200) return;

        // Lo guardado pasa a ser el punto al que regresa Deshacer.
        this.access.modules.forEach((m) => m.sections.forEach((s) => s.actions.forEach((a) => { a.granted = ids.includes(a.id); })));
        this.saved = this.signature(ids);
        this.refreshState();
        this.refreshCounts();
    }

    // Solo el panel de roles (conteos y nombres), sin re-pintar lo marcado a la derecha.
    async refreshCounts() {
        const request = await useFetch({
            url: this._link,
            data: {
                opc: 'lsPermissionRoles',
                company_id: this.company,
                active: this.active
            }
        });

        if (!request || request.status !== 200) return;

        this.roles = request.roles || [];
        this.renderRoles();
    }

    // El rol nuevo queda elegido: si nació en otra empresa o con el filtro en
    // Inactivos, el filtro se mueve a donde aparece. Estado antes que Empresa:
    // el change.select2 vuelve a llamar onFilter y debe encontrar los dos al día.
    async addRole() {
        if (!(await this.confirmDiscard())) return;

        roles.addRole(this.company, (r) => {
            this.company = String(r.company_id);
            this.active = '1';
            this.roleId = Number(r.id);
            $('#perm-active').val(this.active);
            $('#perm-company_id').val(this.company).trigger('change.select2');
            this.lsRoles();
        });
    }

    // Renombrar no toca lo marcado: solo se refrescan la lista y el título.
    editRole(id) {
        roles.editRole(id, async () => {
            await this.refreshCounts();
            const role = this.roles.find(r => r.id === this.roleId);
            if (role) $('#permissionsTitle').text(`Permisos de ${role.name}`);
        });
    }

    // Al darlo de baja sale de la lista del filtro, así que se pierde lo no guardado.
    async toggleRole(id, active) {
        if (id === this.roleId && !(await this.confirmDiscard())) return;

        const role = this.roles.find(r => r.id === id);
        roles.toggleRole(id, active, () => this.lsRoles(), !!(role && role.is_system));
    }

    // -- Complements --

    async onRoleSelect(id) {
        if (id === this.roleId) return;
        if (!(await this.confirmDiscard())) return;

        this.roleId = id;
        this.renderRoles();
        this.loadRole();
    }

    async onFilter() {
        const company = String($('#perm-company_id').val() || 'system');
        const active = String($('#perm-active').val() || '1');
        if (company === this.company && active === this.active) return;

        // Revertir con change.select2 vuelve a llamar onFilter: con Estado ya
        // revertido antes, sale en la comparación de arriba.
        if (!(await this.confirmDiscard())) {
            $('#perm-active').val(this.active);
            $('#perm-company_id').val(this.company).trigger('change.select2');
            return;
        }

        this.company = company;
        this.active = active;
        this.roleId = 0;
        this.lsRoles();
    }

    async confirmDiscard() {
        if (!this.isDirty()) return true;

        const answer = await this.swalQuestion({
            extends: true,
            opts: {
                title: '¿Descartar los cambios?',
                text: 'Hay permisos marcados en este rol que todavía no se guardan.',
                icon: 'warning'
            }
        });

        return !!(answer && answer.isConfirmed);
    }

    refreshState() {
        const $list = $('#permissionsList');
        const ids = this.checkedIds();
        const total = $list.find('.perm-action').length;
        const dirty = this.isDirty();

        $('#permissionsCount').text(`${ids.length} de ${total} ${total === 1 ? 'acción' : 'acciones'}${dirty ? ' · sin guardar' : ''}`);
        $('#btnPermissionsSave, #btnPermissionsUndo').prop('disabled', !dirty);

        $list.find('.perm-section-row').each((_i, row) => { this.pickerSync($(row), '.perm-section'); });
        $list.find('.perm-module-card').each((_i, card) => {
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

    checkedIds() {
        return $('#permissionsList .perm-action:checked').map((_i, el) => Number(el.value)).get();
    }

    signature(ids) {
        return ids.slice().sort((a, b) => a - b).join(',');
    }

    isDirty() {
        return $('#permissionsList .perm-action').length > 0 && this.signature(this.checkedIds()) !== this.saved;
    }
}

// -- Usuarios (todas las empresas) --
// La lista de todas las empresas (y los de plataforma, como root). El modal de
// alta y edición es UserForm (src/js/user-form.js), el mismo del detalle de
// cada empresa en Facturación.

class Users extends UserForm {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Users';
    }

    render() {
        this.layout();
        this.filterBar();
    }

    layout() {
        this.createLayout({
            parent: 'container-usuarios',
            design: false,
            data: {
                id: 'usersBoard',
                class: 'flex flex-col gap-2',
                container: [
                    { type: 'div', id: 'filterbar-users', class: 'w-full' },
                    // La tabla scrollea de lado aquí dentro y no arrastra la página en celular.
                    { type: 'div', id: 'table-users', class: 'w-full overflow-x-auto' }
                ]
            }
        });
    }

    filterBar() {
        this.createfilterBar({
            parent: 'filterbar-users',
            prefijo: 'users-',
            data: [
                {
                    opc: 'select',
                    id: 'company_id',
                    lbl: 'Empresa',
                    class: 'col-12 col-md-4 col-lg-3',
                    select2: true,
                    data: companyOptions('all'),
                    onchange: 'users.lsUsers()'
                },
                {
                    // Los dueños (is_owner) son quienes pagan la suscripción.
                    opc: 'select',
                    id: 'owner',
                    lbl: 'Tipo',
                    class: 'col-12 col-md-3 col-lg-2',
                    data: [
                        { id: 'all', valor: 'Todos' },
                        { id: 'owners', valor: 'Solo dueños' }
                    ],
                    onchange: 'users.lsUsers()'
                },
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    class: 'col-12 col-md-3 col-lg-2',
                    data: dataInit.userStatusFilter || [],
                    onchange: 'users.lsUsers()'
                },
                {
                    opc: 'button',
                    class: 'col-12 col-md-3 col-lg-2',
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
            attr: { id: 'tbUsers', theme: 'light', striped: true, center: [6], right: [] }
        });
    }

    // Con una empresa filtrada, el usuario nace en ella. Aquí se refresca la tabla
    // (los botones de sus filas llaman users.editUser / users.toggleUser).
    addUser(preset = null, onSaved = () => this.lsUsers()) {
        return super.addUser(preset || $('#filterbar-users [name="company_id"]').val(), onSaved);
    }

    editUser(id, onSaved = () => this.lsUsers()) {
        return super.editUser(id, onSaved);
    }

    toggleUser(id, active, onSaved = () => this.lsUsers()) {
        return super.toggleUser(id, active, onSaved);
    }
}
