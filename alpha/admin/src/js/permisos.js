// Datos de fabrica para levantar la pantalla sin backend.
const SAMPLE_PERMISOS = {
    roles: [
        { id: 1, name: 'Administrador', users: 13, granted: 17 },
        { id: 2, name: 'Cajero',        users: 2,  granted: 8  },
        { id: 3, name: 'Vendedor',      users: 1,  granted: 7  },
        { id: 4, name: 'Lectura',       users: 0,  granted: 1  },
        { id: 6, name: 'Supervisor',    users: 1,  granted: 8  }
    ],
    permissions: [
        { id: 1,  code: 'view_order',          name: 'Ver pedidos',                 description: 'Consultar el listado y el detalle de un pedido', family: 'Pedidos',               is_dangerous: 0, has_scope: 1 },
        { id: 6,  code: 'delete_order',        name: 'Eliminar pedido',             description: 'Borra el pedido y todas sus partidas',           family: 'Pedidos',               is_dangerous: 1, has_scope: 0 },
        { id: 8,  code: 'edit_payment_method', name: 'Cambiar metodo de un cobro',  description: 'Solo mientras el corte de ese pago siga abierto', family: 'Pagos',                 is_dangerous: 0, has_scope: 0 },
        { id: 9,  code: 'delete_payment',      name: 'Eliminar pago',               description: 'Afecta el corte del dia de la sucursal',         family: 'Pagos',                 is_dangerous: 1, has_scope: 0 }
    ],
    granted: { 1: 'all', 8: 'all' }
};

// Ficha de permisos por rol: lista de roles a la izquierda y, a la derecha, las
// familias plegadas con su contador. Los permisos irreversibles quedan fuera del
// acordeon, siempre visibles. No existia un componente para esta forma.
//
// json  -> { roles, permissions, granted }
// data  -> lo que se manda al backend al guardar
// onSave(rolId, granted) -> se dispara con el set completo del rol
function rolePermissions(options) {

    const defaults = {
        parent:   'root',
        id:       'rolePermissions',
        class:    '',
        theme:    'dark',
        lockedRol: 1,
        json:     { roles: [], permissions: [], granted: {} },
        data:     {},
        onSelect: () => {},
        onSave:   () => {}
    };

    const opts = Object.assign({}, defaults, options);

    const state = {
        rolId:   null,
        granted: {},
        base:    {},
        open:    null
    };

    // -- Estilos por theme --
    const skin = opts.theme === 'light'
        ? {
            panel:    'bg-white border border-gray-200',
            row:      'bg-white border-gray-200 text-gray-600',
            rowOn:    'bg-blue-50 border-blue-500 text-gray-900',
            title:    'text-gray-900',
            soft:     'text-gray-500',
            body:     'bg-gray-50 border-blue-500',
            rule:     'border-gray-200'
          }
        : {
            panel:    'bg-[#1F2A37]',
            row:      'bg-[#1E293B] border-slate-700 text-gray-300',
            rowOn:    'bg-blue-600/20 border-blue-500 text-white',
            title:    'text-white',
            soft:     'text-gray-400',
            body:     'bg-[#1A2432] border-blue-500',
            rule:     'border-slate-700'
          };

    // -- Logica --
    const families = () => {
        const map = {};
        opts.json.permissions
            .filter(p => parseInt(p.is_dangerous, 10) !== 1)
            .forEach(p => {
                if (!map[p.family]) map[p.family] = [];
                map[p.family].push(p);
            });
        return map;
    };

    const dangerous = () => opts.json.permissions.filter(p => parseInt(p.is_dangerous, 10) === 1);

    const grantedCount = () => Object.keys(state.granted).length;

    const pendingCount = () => {
        const ids = new Set([...Object.keys(state.granted), ...Object.keys(state.base)]);
        let n = 0;
        ids.forEach(id => { if (state.granted[id] !== state.base[id]) n++; });
        return n;
    };

    const isLocked = () => String(state.rolId) === String(opts.lockedRol);

    // -- Render --
    const rolesHtml = () => opts.json.roles.map(rol => {
        const on = String(rol.id) === String(state.rolId);
        return $('<span>', {
            'class': `js-rol flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs cursor-pointer transition-colors ${on ? skin.rowOn : skin.row}`,
            'data-rol': rol.id,
            html: `${rol.name}<span class="ml-auto font-mono text-[10px] ${on ? 'text-blue-300' : 'text-gray-500'}">${rol.granted}</span>`
        });
    });

    const switchHtml = (permission) => {
        const scope = state.granted[permission.id];
        const on    = scope !== undefined;
        const bg    = parseInt(permission.is_dangerous, 10) === 1
            ? (on ? 'bg-red-700 border-red-500' : 'bg-slate-700 border-slate-600')
            : (on ? 'bg-blue-600 border-blue-500' : 'bg-slate-700 border-slate-600');

        return `<span class="js-switch relative inline-block w-7 h-4 rounded-full border shrink-0 cursor-pointer ${bg}"
                      data-permission="${permission.id}">
                    <span class="absolute top-px w-3 h-3 rounded-full ${on ? 'right-px bg-white' : 'left-px bg-gray-400'}"></span>
                </span>`;
    };

    const scopeHtml = (permission) => {
        if (parseInt(permission.has_scope, 10) !== 1) return '';

        const scope = state.granted[permission.id];
        const opciones = [
            { value: '',    label: 'No' },
            { value: 'own', label: 'Su sucursal' },
            { value: 'all', label: 'Todas' }
        ];

        const botones = opciones.map(opcion => {
            const on = (scope === undefined ? '' : scope) === opcion.value;
            return `<span class="js-scope px-2 py-0.5 rounded text-[10px] cursor-pointer border ${on ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-600 text-gray-400'}"
                          data-permission="${permission.id}" data-scope="${opcion.value}">${opcion.label}</span>`;
        }).join('');

        return `<span class="flex gap-1 shrink-0">${botones}</span>`;
    };

    const permissionHtml = (permission) => {
        const control = parseInt(permission.has_scope, 10) === 1
            ? scopeHtml(permission)
            : switchHtml(permission);

        return `<div class="flex items-center gap-2.5 py-1.5">
                    ${control}
                    <span class="flex flex-col leading-tight min-w-0">
                        <b class="text-[11.5px] font-medium ${skin.title}">${permission.name}</b>
                        <span class="text-[9.5px] ${skin.soft}">${permission.description || ''}</span>
                    </span>
                </div>`;
    };

    const familiesHtml = () => {
        const grupos = families();

        return Object.keys(grupos).map(family => {
            const permisos = grupos[family];
            const abierta  = state.open === family;
            const tiene    = permisos.filter(p => state.granted[p.id] !== undefined).length;

            const cabecera = `<span class="js-family flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer ${abierta ? skin.rowOn : skin.row}"
                                    data-family="${family}">
                    <span class="text-[10px]">${abierta ? '&#9660;' : '&#9654;'}</span>
                    <b class="text-[11.5px] font-medium flex-1">${family}</b>
                    <span class="font-mono text-[10px] px-2 py-px rounded-full ${abierta ? 'bg-blue-600 text-white' : 'bg-slate-700 text-gray-300'}">${tiene} de ${permisos.length}</span>
                </span>`;

            const cuerpo = abierta
                ? `<div class="border border-t-0 rounded-b-lg px-3 pb-2 pt-1 -mt-1.5 ${skin.body}">
                       ${permisos.map(permissionHtml).join('')}
                   </div>`
                : '';

            return cabecera + cuerpo;
        }).join('');
    };

    const dangerHtml = () => {
        const permisos = dangerous();
        if (!permisos.length) return '';

        return `<div class="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 mt-2">
                    <span class="block text-[9.5px] uppercase tracking-widest text-red-400 pb-1.5 mb-1 border-b border-red-500/25">
                        No se puede deshacer
                    </span>
                    ${permisos.map(permissionHtml).join('')}
                </div>`;
    };

    const saveBarHtml = () => {
        const pendientes = pendingCount();
        if (!pendientes) return '';

        const rol = opts.json.roles.find(r => String(r.id) === String(state.rolId));
        const gente = rol ? rol.users : 0;

        return `<div class="flex items-center gap-2 mt-3 px-3 py-2 rounded-lg border ${skin.rule} bg-[#19232D]">
                    <span class="text-[10.5px] ${skin.soft} flex-1">
                        <b class="${skin.title}">${pendientes} ${pendientes === 1 ? 'cambio' : 'cambios'} sin guardar</b>
                        &middot; ${gente === 1 ? 'afecta a 1 usuario' : `afectan a ${gente} usuarios`}
                    </span>
                    <span class="js-discard px-3 py-1.5 rounded-lg border ${skin.rule} text-[11px] ${skin.soft} cursor-pointer">Descartar</span>
                    <span class="js-save px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-semibold cursor-pointer">Guardar</span>
                </div>`;
    };

    const detailHtml = () => {
        if (!state.rolId) {
            return `<div class="text-center py-10 text-[11.5px] ${skin.soft}">Elige un rol para ver sus permisos.</div>`;
        }

        const rol = opts.json.roles.find(r => String(r.id) === String(state.rolId));

        if (isLocked()) {
            return `<div class="rounded-lg border ${skin.rule} px-3 py-6 text-center">
                        <b class="block text-[12.5px] ${skin.title} mb-1">${rol.name} conserva todos los permisos</b>
                        <span class="text-[10.5px] ${skin.soft}">
                            Si se le pudiera quitar alguno, el sistema podria quedarse sin nadie que lo administre.
                        </span>
                    </div>`;
        }

        return `<div class="flex items-center gap-2 pb-2.5 mb-2.5 border-b ${skin.rule}">
                    <b class="text-[13px] ${skin.title}">${rol.name}</b>
                    <span class="ml-auto text-[10.5px] ${skin.soft}">
                        ${grantedCount()} de ${opts.json.permissions.length} permisos
                        &middot; ${rol.users === 1 ? '1 usuario' : `${rol.users} usuarios`}
                    </span>
                </div>
                <div class="flex flex-col gap-1.5">${familiesHtml()}</div>
                ${dangerHtml()}
                ${saveBarHtml()}`;
    };

    const paint = () => {
        const $roles = $(`#${opts.id}Roles`).empty();
        rolesHtml().forEach($rol => $roles.append($rol));
        $(`#${opts.id}Detail`).html(detailHtml());
    };

    // -- Montaje --
    $(`#${opts.parent}`).html(
        `<div id="${opts.id}" class="flex gap-3 ${opts.class}">
            <div id="${opts.id}Roles" class="w-44 shrink-0 flex flex-col gap-1"></div>
            <div id="${opts.id}Detail" class="flex-1 min-w-0"></div>
        </div>`
    );

    // -- Eventos --
    const $root = $(`#${opts.id}`);

    $root.on('click', '.js-rol', function () {
        state.rolId = $(this).data('rol');
        state.open  = null;
        opts.onSelect(state.rolId, granted => {
            state.granted = Object.assign({}, granted);
            state.base    = Object.assign({}, granted);
            paint();
        });
    });

    $root.on('click', '.js-family', function () {
        const family = $(this).data('family');
        state.open = state.open === family ? null : family;
        paint();
    });

    $root.on('click', '.js-switch', function () {
        const id = $(this).data('permission');
        if (state.granted[id] === undefined) state.granted[id] = 'all';
        else delete state.granted[id];
        paint();
    });

    $root.on('click', '.js-scope', function () {
        const id    = $(this).data('permission');
        const scope = $(this).data('scope');
        if (scope === '') delete state.granted[id];
        else state.granted[id] = scope;
        paint();
    });

    $root.on('click', '.js-discard', function () {
        state.granted = Object.assign({}, state.base);
        paint();
    });

    $root.on('click', '.js-save', function () {
        opts.onSave(state.rolId, state.granted, () => {
            state.base = Object.assign({}, state.granted);
            paint();
        });
    });

    paint();

    return {
        refresh: paint,
        state:   state
    };
}

class Permisos extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Permisos";
        this.component = null;
    }

    init() {
        this.render();
    }

    render() {
        this.layout();
        this.onShowPermisos();
    }

    layout() {
        this.createLayout({
            parent: `container-tab-permisos`,
            design: false,
            data: {
                id: this.PROJECT_NAME,
                class: 'w-full',
                container: [
                    {
                        type:  'div',
                        id:    `header${this.PROJECT_NAME}`,
                        class: 'w-full pb-3'
                    },
                    {
                        type:  'div',
                        id:    `panel${this.PROJECT_NAME}`,
                        class: 'w-full'
                    }
                ]
            }
        });
    }

    // Trae catalogo y roles, y arma el componente con lo que devuelve el backend.
    async onShowPermisos() {
        const request = await useFetch({
            url:  this._link,
            data: { opc: "init" }
        });

        if (!request || request.status !== 200) {
            alert({
                icon:  "error",
                text:  (request && request.message) || "No se pudieron cargar los permisos.",
                btn1:  true,
                btn1Text: "Ok"
            });
            return;
        }

        this.component = rolePermissions({
            parent:    `panel${this.PROJECT_NAME}`,
            id:        `cmp${this.PROJECT_NAME}`,
            theme:     'dark',
            lockedRol: request.rolAdmin,
            json: {
                roles:       request.roles,
                permissions: request.permissions,
                granted:     {}
            },
            onSelect: (rolId, done) => this.lsRolPermissions(rolId, done),
            onSave:   (rolId, granted, done) => this.savePermissions(rolId, granted, done)
        });
    }

    async lsRolPermissions(rolId, done) {
        const request = await useFetch({
            url:  this._link,
            data: { opc: "lsRolPermissions", id: rolId }
        });

        done(request && request.status === 200 ? request.granted : {});
    }

    async savePermissions(rolId, granted, done) {
        const request = await useFetch({
            url:  this._link,
            data: {
                opc:         "savePermissions",
                id:          rolId,
                permissions: JSON.stringify(granted)
            }
        });

        if (!request || request.status !== 200) {
            alert({
                icon:  "error",
                text:  (request && request.message) || "No se pudieron guardar los permisos.",
                btn1:  true,
                btn1Text: "Ok"
            });
            return;
        }

        alert({
            icon:  "success",
            text:  request.message,
            timer: 1500
        });

        done();
    }
}
