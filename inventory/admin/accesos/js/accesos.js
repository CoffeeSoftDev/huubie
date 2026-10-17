let api = 'ctrl/ctrl-accesos.php';
let app, resumen, users, roles, subsidiaries, bitacora;
let statusFilter = [];
let sucursalesData = [];
let rolesData = [];
let usuariosData = [];
let dataInit = {};

// Vistas de Configuración: la navegación de la izquierda (como el panel de
// referencia: Resumen, Usuarios, Roles y permisos, Sucursales y Bitácora).
const CONFIG_VIEWS = [
    {
        id: 'resumen',
        icon: 'layout-dashboard',
        label: 'Resumen',
        meta: 'Indicadores y actividad'
    },
    {
        id: 'usuarios',
        icon: 'users',
        label: 'Usuarios',
        meta: 'Altas, sucursales y roles'
    },
    {
        id: 'roles',
        icon: 'shield-check',
        label: 'Roles y permisos',
        meta: 'Qué puede hacer cada rol'
    },
    {
        id: 'sucursales',
        icon: 'building-2',
        label: 'Sucursales',
        meta: 'Datos de cada sucursal'
    },
    {
        id: 'bitacora',
        icon: 'scroll-text',
        label: 'Bitácora',
        meta: 'Movimientos de acceso'
    }
];

// Tonos de avatar de las cuentas de Google y Microsoft: todos sostienen el
// ícono blanco con contraste de 4.5:1 o más. Mismos 10 en tenant/js/saas.js.
const USER_COLOR_PALETTE = [
    '#1A73E8', '#038387', '#188038', '#986F0B',
    '#CA5010', '#D93025', '#E3008C', '#8764B8',
    '#5C2E91', '#69797E'
];

/*  La imagen (foto del colaborador o logo de la sucursal) se reduce a 320px y se
    entrega como dataURL: va a salir siempre en un recuadro de 64px o menos, y así
    el POST no carga con la foto original del celular. Mismo procedimiento que la
    evidencia de mermas, con el lado más chico porque aquí es un avatar. */
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

// Notificación: éxito se cierra solo (sin botón => respeta el timer de alert()),
// error mantiene botón para que el mensaje pueda leerse.
function notify(r) {
    if (r && r.status == 200) {
        alert({ icon: 'success', text: r.message, timer: 1400 });
    } else {
        alert({ icon: 'error', text: (r && r.message) || 'Ocurrió un error', btn1: true });
    }
}

$(async () => {
    dataInit       = await useFetch({ url: api, data: { opc: 'init' } });
    statusFilter   = dataInit.statusFilter || [];
    sucursalesData = dataInit.sucursales   || [];
    rolesData      = dataInit.roles        || [];
    usuariosData   = dataInit.usuarios     || [];

    app          = new App(api, 'root');
    resumen      = new Resumen(api, 'root');
    users        = new Users(api, 'root');
    roles        = new Roles(api, 'root');
    subsidiaries = new Subsidiaries(api, 'root');
    bitacora     = new Bitacora(api, 'root');

    app.render();
});

class App extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Configuracion';
        this.view = 'resumen';
    }

    render() {
        this.layout();
        this.renderHeader();
        this.navigate(this.initialView());
    }

    // Página que crece con su contenido: el único scroll es el de #main__content.
    layout() {
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id: this.PROJECT_NAME,
                class: 'flex flex-col gap-4 px-1 pb-2',
                container: [
                    {
                        type: 'div',
                        id: `header${this.PROJECT_NAME}`
                    },
                    {
                        type: 'div',
                        id: `body${this.PROJECT_NAME}`,
                        class: 'grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-4 items-start',
                        children: [
                            {
                                id: `nav${this.PROJECT_NAME}`,
                                class: 'lg:sticky lg:top-0'
                            },
                            {
                                id: `container${this.PROJECT_NAME}`,
                                class: 'min-w-0'
                            }
                        ]
                    }
                ]
            }
        });
    }

    renderHeader() {
        const company = dataInit.company_name || '—';

        $(`#header${this.PROJECT_NAME}`).html($('<div>', { class: 'flex items-center gap-3 px-1 pt-1' }).append(
            $('<span>', { class: 'w-11 h-11 rounded-xl bg-blue-600 text-white inline-flex items-center justify-center shrink-0 shadow-sm' })
                .append($('<i>', { 'data-lucide': 'settings', class: 'w-5 h-5' })),
            $('<div>', { class: 'min-w-0' }).append(
                $('<h2>', { class: 'text-2xl font-bold text-gray-800 leading-tight', text: 'Configuración' }),
                $('<p>', { class: 'text-sm text-gray-500' }).append(
                    document.createTextNode('Empresa: '),
                    $('<span>', { class: 'font-semibold text-gray-700', text: company }),
                    document.createTextNode(' · usuarios, roles, sucursales y bitácora de accesos')
                )
            )
        ));
        if (window.lucide) lucide.createIcons();
    }

    renderNav() {
        this.csNavList({
            parent: `nav${this.PROJECT_NAME}`,
            id: 'navConfiguracion',
            class: 'bg-white border border-gray-200 rounded-xl flex flex-col overflow-hidden',
            active: this.view,
            json: CONFIG_VIEWS,
            onSelect: (item) => this.navigate(item.id)
        });
    }

    // Cada vista se arma al entrar (datos frescos) y la elegida queda en el #hash
    // para que una recarga vuelva a ella.
    navigate(view, arg) {
        const views = {
            resumen: resumen,
            usuarios: users,
            roles: roles,
            sucursales: subsidiaries,
            bitacora: bitacora
        };

        this.view = views[view] ? view : 'resumen';
        this.renderNav();
        $(`#container${this.PROJECT_NAME}`).empty();
        views[this.view].render(arg);

        try { history.replaceState(null, '', '#' + this.view); } catch (e) { }
    }

    initialView() {
        const hash = (window.location.hash || '').replace('#', '');
        return CONFIG_VIEWS.some(v => v.id === hash) ? hash : 'resumen';
    }

    // -- Piezas compartidas por las vistas --

    // Título de la vista con su acción principal a la derecha.
    viewHeader(options) {
        const opts = Object.assign({ title: '', subtitle: '', action: null }, options);
        const wrap = $('<div>', { class: 'flex flex-col sm:flex-row sm:items-center justify-between gap-3' });

        wrap.append($('<div>').append(
            $('<h3>', { class: 'text-xl font-bold text-gray-800', text: opts.title }),
            $('<p>', { class: 'text-sm text-gray-500 mt-0.5', text: opts.subtitle })
        ));

        if (opts.action) {
            const btn = $('<button>', {
                type: 'button',
                id: opts.action.id || '',
                class: 'shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-sm transition'
            }).append(
                $('<i>', { 'data-lucide': opts.action.icon || 'plus', class: 'w-4 h-4' }),
                $('<span>', { text: opts.action.text })
            );
            btn.on('click', opts.action.onClick);
            wrap.append(btn);
        }

        return wrap;
    }

    // Vista con título, barra de filtros y contenedor, todo en tarjetas.
    viewLayout(name, withFilterBar) {
        const container = [
            {
                type: 'div',
                id: `header${name}`
            }
        ];

        if (withFilterBar) {
            container.push({
                type: 'div',
                id: `filterBar${name}`,
                class: 'bg-white border border-gray-200 rounded-xl px-3 pt-2 pb-1'
            });
        }

        container.push({
            type: 'div',
            id: `container${name}`,
            class: 'bg-white border border-gray-200 rounded-xl p-3'
        });

        this.createLayout({
            parent: 'containerConfiguracion',
            design: false,
            data: {
                id: `view${name}`,
                class: 'flex flex-col gap-4',
                container: container
            }
        });
    }

    // Modal de solo lectura con una tabla: el detalle de un movimiento.
    detailModal(options) {
        const defaults = {
            id: 'detail',
            title: '',
            value: '',
            subtitle: '',
            size: 'large',
            center: [],
            right: [],
            emptyMessage: 'Sin información',
            data: { row: [] }
        };

        const opts  = Object.assign({}, defaults, options || {});
        const modal = this.cfModal({ title: opts.title, size: opts.size, backdropClose: true });

        // Solo lectura: se cierra con la X, Escape o clic afuera.
        modal.footer.remove();
        modal.body.attr('id', `${opts.id}Modal`);

        this.createCoffeeTable3({
            parent: `${opts.id}Modal`,
            id: `tb${opts.id}Modal`,
            theme: 'light',
            title: opts.value,
            subtitle: opts.subtitle,
            center: opts.center,
            right: opts.right,
            extends: true,
            scrollable: false,
            striped: true,
            f_size: 12,
            emptyMessage: opts.emptyMessage,
            emptyIcon: 'icon-doc-text',
            data: opts.data
        });

        if (window.lucide) lucide.createIcons();
    }

    /*  Imagen del formulario (foto del colaborador o logo de la sucursal). NO
        viaja como archivo: createModalForm manda el formulario por useFetch, que
        arma un URLSearchParams, y ahí un File se vuelve "[object File]". Por eso
        se comprime en el navegador y se manda como dataURL en un campo de texto
        (`{field}_b64`), igual que la evidencia de mermas. `{field}_clear` avisa
        cuando se quitó. */
    renderImagePicker(formId, options) {
        const opts = Object.assign({
            field: 'photo',
            url: '',
            color: null,
            icon: 'user',
            shape: 'rounded-full',
            pickLabel: 'Subir foto'
        }, options);

        const $form = $('#' + formId);

        const $b64   = $('<input>', { type: 'hidden', name: `${opts.field}_b64`, value: '' });
        const $clear = $('<input>', { type: 'hidden', name: `${opts.field}_clear`, value: '' });

        const $preview = $('<span>', {
            'data-image-preview': opts.field,
            class: `w-16 h-16 ${opts.shape} flex items-center justify-center shrink-0 text-white overflow-hidden`,
            css: { backgroundColor: opts.color || '#9CA3AF' }
        });

        const $file = $('<input>', {
            type: 'file', accept: 'image/*', class: 'hidden', id: `${formId}_${opts.field}_file`
        });

        const $pick = $('<label>', {
            class: 'px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer',
            text: opts.pickLabel,
            for: `${formId}_${opts.field}_file`
        });

        const $remove = $('<button>', {
            type: 'button',
            class: 'px-3 py-1.5 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-800',
            text: 'Quitar'
        });

        // Sin imagen queda el ícono blanco sobre el color, lo mismo que enseñan la
        // navbar y el login.
        const paint = (src) => {
            $preview.empty().append(src
                ? $('<img>', { src: src, class: `w-full h-full ${opts.shape} object-cover` })
                : $('<i>', { 'data-lucide': opts.icon, class: 'w-7 h-7' }));
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
            .append($preview, $pick, $remove, $file, $b64, $clear);

        $form.prepend($wrap);
        paint(opts.url || '');
    }
}

// -- Resumen --

class Resumen extends App {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Resumen';
    }

    render() {
        this.createLayout({
            parent: 'containerConfiguracion',
            design: false,
            data: {
                id: `view${this.PROJECT_NAME}`,
                class: 'flex flex-col gap-4',
                container: [
                    {
                        type: 'div',
                        id: `header${this.PROJECT_NAME}`
                    },
                    {
                        type: 'div',
                        id: `kpis${this.PROJECT_NAME}`
                    },
                    {
                        type: 'div',
                        id: `grid${this.PROJECT_NAME}`,
                        class: 'grid grid-cols-1 xl:grid-cols-3 gap-4 items-start',
                        children: [
                            {
                                id: `actividad${this.PROJECT_NAME}`,
                                class: 'xl:col-span-2 min-w-0'
                            },
                            {
                                id: `roles${this.PROJECT_NAME}`,
                                class: 'min-w-0'
                            }
                        ]
                    }
                ]
            }
        });

        $(`#header${this.PROJECT_NAME}`).html(this.viewHeader({
            title: 'Resumen',
            subtitle: 'Usuarios, roles, sucursales y movimientos de acceso de la empresa'
        }));

        this.showResumen();
    }

    async showResumen() {
        const request = await useFetch({ url: this._link, data: { opc: 'showResumen' } });
        if (!(request && request.status === 200)) {
            notify(request);
            return;
        }

        const c = request.counts || {};

        this.kpisRow({
            parent: `kpis${this.PROJECT_NAME}`,
            cardClass: 'bg-white rounded-xl border border-gray-200 px-4 py-4 cursor-pointer hover:shadow-md transition-shadow',
            valueClass: 'text-2xl font-bold text-right',
            iconWrapClass: 'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
            iconClass: 'w-4 h-4',
            json: [
                {
                    id: 'kpiUsuarios',
                    view: 'usuarios',
                    label: 'Usuarios activos',
                    value: `${c.usuarios_activos || 0} / ${c.usuarios_total || 0}`,
                    tone: 'info',
                    icon: 'users'
                },
                {
                    id: 'kpiRoles',
                    view: 'roles',
                    label: 'Roles de la empresa',
                    value: c.roles || 0,
                    tone: 'purple',
                    icon: 'shield-check'
                },
                {
                    id: 'kpiSucursales',
                    view: 'sucursales',
                    label: 'Sucursales activas',
                    value: c.sucursales || 0,
                    tone: 'success',
                    icon: 'building-2'
                },
                {
                    id: 'kpiMovimientos',
                    view: 'bitacora',
                    label: 'Movimientos hoy',
                    value: c.movimientos_hoy || 0,
                    tone: 'warning',
                    icon: 'activity'
                }
            ],
            onClick: (kpi) => app.navigate(kpi.view)
        });

        this.csNavList({
            parent: `actividad${this.PROJECT_NAME}`,
            id: 'navActividad',
            title: 'Actividad reciente',
            class: 'bg-white border border-gray-200 rounded-xl flex flex-col overflow-hidden',
            empty: 'Todavía no hay movimientos en la bitácora.',
            json: request.actividad || [],
            onSelect: (item) => bitacora.getBitacora(item.id)
        });

        this.csNavList({
            parent: `roles${this.PROJECT_NAME}`,
            id: 'navRolesResumen',
            title: 'Roles de la empresa',
            class: 'bg-white border border-gray-200 rounded-xl flex flex-col overflow-hidden',
            empty: 'La empresa todavía no tiene roles.',
            json: (request.roles || []).map(r => ({
                id: r.id,
                icon: 'shield',
                label: r.name,
                meta: `${r.users} usuario${r.users !== 1 ? 's' : ''} · ${r.actions} acci${r.actions !== 1 ? 'ones' : 'ón'}`
            })),
            onSelect: (item) => app.navigate('roles', item.id)
        });
    }
}

// -- Usuarios --

class Users extends App {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'UsersAcc';
    }

    render() {
        this.viewLayout(this.PROJECT_NAME, true);

        $(`#header${this.PROJECT_NAME}`).html(this.viewHeader({
            title: 'Usuarios',
            subtitle: 'Quién entra al sistema, en qué sucursales y con qué rol',
            action: can('agregar') ? {
                id: 'btnNewUser',
                icon: 'user-plus',
                text: 'Nuevo usuario',
                onClick: () => this.addUser()
            } : null
        }));

        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: [
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    class: 'col-12 col-md-3',
                    data: statusFilter,
                    onchange: 'users.lsUsers()'
                }
            ]
        });

        if (window.lucide) lucide.createIcons();
        this.lsUsers();
    }

    lsUsers() {
        this.createTable({
            parent: `container${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: 'lsUsers' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbUsersAcc',
                theme: 'light',
                center: [5],
                right: []
            }
        });
    }

    addUser() {
        const modal = this.createModalForm({
            id: 'formUserAdd',
            data: { opc: 'addUser' },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Nuevo Usuario' },
            json: this.jsonUser(false),
            success: (r) => this.afterSave(r)
        });
        this.injectSucursalChips('add_sucursales_chips', [], {});
        this.renderPhotoPicker('formUserAdd', '', null);
        this.renderColorSwatches('formUserAdd', null);
        this.guardUserForm(modal);
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
            autofill: data,
            json: this.jsonUser(true),
            success: (r) => this.afterSave(r)
        });
        this.injectSucursalChips('edit_sucursales_chips', branchIds, data.branch_roles || {});
        this.renderPhotoPicker('formUserEdit', data.photo_url || '', color);
        this.renderColorSwatches('formUserEdit', color);
        this.guardUserForm(modal);
        this.mountPasswordEyes();
    }

    // -- Selector multiple de sucursal --

    renderSucursalChips(containerId, selectedIds = []) {
        const $container = $('#' + containerId).empty();

        sucursalesData.forEach(s => {
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
        this.renderBranchRoles(containerId, selectedIds);
    }

    // jsonUser() pinta branch_ids como <select>; aqui se saca ese select y en
    // su lugar quedan el hidden que viaja al ctrl y la caja de chips (mismo
    // patron portado de admin/usuarios/js/admin.js, que a su vez viene de
    // app/admin/src/js/app.js). Debajo va el rol de cada sucursal elegida.
    injectSucursalChips(chipsId, selectedIds = [], branchRoles = {}) {
        const $hidden = $('<input>', {
            type: 'hidden', id: 'branch_ids', name: 'branch_ids', value: selectedIds.join(',')
        });
        const $rolesHidden = $('<input>', {
            type: 'hidden', id: 'branch_roles', name: 'branch_roles', value: '{}'
        });
        const $box = $('<div>', {
            id: chipsId, class: 'flex flex-wrap bg-white border border-gray-200 rounded-lg p-2'
        });
        const $roles = $('<div>', { id: chipsId + '_rolesBlock', class: 'mt-3 hidden' })
            .append($('<label>', { class: 'block text-xs font-semibold text-gray-600 mb-1.5', text: 'Rol en cada sucursal' }))
            .append($('<div>', { id: chipsId + '_roles', class: 'bg-white border border-gray-200 rounded-lg divide-y divide-gray-100' }));

        // Rol elegido por sucursal (branch_id => role_id, en texto), propio de este formulario.
        this.branchRoles = {};
        Object.keys(branchRoles || {}).forEach(bid => {
            if (branchRoles[bid] != null) this.branchRoles[String(bid)] = String(branchRoles[bid]);
        });

        const $select = $('#branch_ids');
        $select.siblings().remove(); // quita el chevron que dejo el <select>
        $select.replaceWith($hidden);
        $hidden.after($rolesHidden, $box, $roles);

        this.renderSucursalChips(chipsId, selectedIds);
    }

    // -- Rol por sucursal --

    // Las opciones son los roles de la empresa (rolesData, sin el 1). Donde el
    // usuario ya es Super Admin (rol 1, del sistema) el renglón queda fijo: no se
    // asigna ni se quita desde aquí, y el ctrl lo conserva. Una sucursal recién
    // marcada toma el rol que ya tienen las demás, para no elegirlo cada vez.
    renderBranchRoles(chipsId, selectedIds) {
        const $list     = $('#' + chipsId + '_roles').empty();
        const selected  = sucursalesData.filter(s => selectedIds.includes(String(s.id)));
        const inherited = selected.map(s => this.branchRoles[String(s.id)]).find(r => r && r !== '1') || '';

        $('#' + chipsId + '_rolesBlock').toggleClass('hidden', !selected.length);

        selected.forEach(s => {
            const bid = String(s.id);
            if (!this.branchRoles[bid]) this.branchRoles[bid] = inherited;

            const $row = $('<div>', { class: 'flex items-center justify-between gap-3 px-3 py-2' })
                .append($('<span>', { class: 'text-sm text-gray-700 truncate', text: s.valor }));

            if (this.branchRoles[bid] === '1') {
                $row.append($('<span>', {
                    class: 'shrink-0 px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-600',
                    text:  'Super Admin',
                    title: 'Rol del sistema: no se cambia desde Accesos'
                }));
            } else {
                const $sel = $('<select>', {
                    class: 'tw-input w-44 shrink-0 rounded-lg border border-gray-100 dark:border-gray-600 px-3 py-2 text-sm text-gray-800 dark:text-gray-200 outline-none focus:border-blue-600 bg-white dark:bg-gray-700 cursor-pointer'
                }).append($('<option>', { value: '', text: '-- Elige rol --' }));

                rolesData.forEach(r => {
                    $sel.append($('<option>', { value: r.id, text: r.valor, selected: String(r.id) === this.branchRoles[bid] }));
                });

                $sel.on('change', () => {
                    this.branchRoles[bid] = $sel.val();
                    this.syncBranchRoles(selectedIds);
                });

                $row.append($sel);
            }

            $list.append($row);
        });

        this.syncBranchRoles(selectedIds);
    }

    // Lo que viaja al ctrl: solo los roles asignables (el Super Admin lo conserva el ctrl).
    syncBranchRoles(selectedIds) {
        const map = {};
        selectedIds.forEach(bid => {
            const role = this.branchRoles[bid];
            if (role && role !== '1') map[bid] = role;
        });
        $('#branch_roles').val(JSON.stringify(map));
    }

    missingBranchRole() {
        const selectedIds = ($('#branch_ids').val() || '').split(',').filter(Boolean);
        return selectedIds.some(bid => !this.branchRoles[bid]);
    }

    // -- Foto del colaborador --

    renderPhotoPicker(formId, photoUrl, color) {
        this.renderImagePicker(formId, {
            field: 'photo',
            url: photoUrl,
            color: color,
            icon: 'user',
            shape: 'rounded-full',
            pickLabel: 'Subir foto'
        });
    }

    // El color elegido repinta el fondo del avatar sin recargar el formulario.
    repaintPhotoBg(formId, hex) {
        $('#' + formId).find('[data-image-preview="photo"]').css('backgroundColor', hex);
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

    // -- Validacion antes de enviar: contrasena doble y rol por sucursal --

    // El cfModal no expone un hook previo al envio: el boton Aceptar dispara
    // cfModalForm.trigger('submit') desde su propio click, y el atajo Enter
    // llama onOk() desde un keydown en document. Se frenan los dos en fase de
    // captura sobre el overlay, que corre antes que ambos manejadores.
    guardUserForm(modal) {
        const btnOk = modal.footer.find('button').last()[0];
        if (!btnOk) return;

        const problem = () => {
            if ($('#password').val() !== $('#password_confirmation').val()) return 'Las contraseñas no coinciden';
            if (this.missingBranchRole()) return 'Elige el rol del usuario en cada sucursal';
            return '';
        };
        const block = (e) => {
            const msg = problem();
            if (!msg) return;
            e.preventDefault();
            e.stopPropagation();
            alert({ icon: 'error', text: msg, btn1: true });
        };

        modal.el[0].addEventListener('click', (e) => {
            if (e.target.closest('button') === btnOk) block(e);
        }, true);

        modal.el[0].addEventListener('keydown', (e) => {
            if (e.key !== 'Enter') return;
            const tag = (e.target.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'select') block(e);
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

    toggleUser(id, active) {
        const action = active == 1 ? 'activar' : 'desactivar';
        this.swalQuestion({
            opts: {
                title: `¿${active == 1 ? 'Activar' : 'Desactivar'} usuario?`,
                text: `¿Deseas ${action} este usuario?`,
                icon: 'warning'
            },
            data: { opc: 'toggleUser', id: id, active: active },
            methods: { send: (r) => this.afterSave(r) }
        });
    }

    afterSave(r) {
        notify(r);
        if (r.status == 200) this.lsUsers();
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
                id: 'branch_ids',
                lbl: 'Sucursales asignadas',
                class: 'col-12 mb-3',
                data: sucursalesData
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

// -- Roles y permisos --
// Solo los roles de la empresa (is_system = 0): los del sistema ni salen ni se
// pueden pedir. La matriz es de solo lectura cuando el rol está bloqueado para
// quien la ve (el rol Dueño, o el rol que él mismo tiene) o su rol no edita.

class Roles extends App {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Roles';
        this.list = [];
        this.templates = [];
        this.activeId = null;
    }

    render(roleId) {
        if (roleId) this.activeId = roleId;

        this.createLayout({
            parent: 'containerConfiguracion',
            design: false,
            data: {
                id: `view${this.PROJECT_NAME}`,
                class: 'flex flex-col gap-4',
                container: [
                    {
                        type: 'div',
                        id: `header${this.PROJECT_NAME}`
                    },
                    {
                        type: 'div',
                        id: `board${this.PROJECT_NAME}`,
                        class: 'grid grid-cols-1 lg:grid-cols-[230px_minmax(0,1fr)] gap-4 items-start',
                        children: [
                            {
                                id: `list${this.PROJECT_NAME}`,
                                class: 'min-w-0'
                            },
                            {
                                id: `detail${this.PROJECT_NAME}`,
                                class: 'min-w-0 bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-4'
                            }
                        ]
                    }
                ]
            }
        });

        $(`#header${this.PROJECT_NAME}`).html(this.viewHeader({
            title: 'Roles y permisos',
            subtitle: 'Define qué puede hacer cada rol de la empresa en cada sección',
            action: can('agregar') ? {
                id: 'btnNewRole',
                icon: 'shield-plus',
                text: 'Nuevo rol',
                onClick: () => this.addRole()
            } : null
        }));

        if (window.lucide) lucide.createIcons();
        this.lsRoles();
    }

    async lsRoles(selectId) {
        const request = await useFetch({ url: this._link, data: { opc: 'lsRoles' } });
        if (!(request && request.status === 200)) {
            notify(request);
            return;
        }

        this.list      = request.roles || [];
        this.templates = request.templates || [];

        if (selectId) this.activeId = selectId;
        if (!this.list.some(r => r.id === this.activeId)) {
            this.activeId = this.list.length ? this.list[0].id : null;
        }

        this.renderList();
        this.getRole(this.activeId);
    }

    renderList() {
        this.csNavList({
            parent: `list${this.PROJECT_NAME}`,
            id: 'navRoles',
            title: 'Roles de la empresa',
            class: 'bg-white border border-gray-200 rounded-xl flex flex-col overflow-hidden',
            addTitle: 'Nuevo rol',
            onAdd: can('agregar') ? () => this.addRole() : null,
            empty: 'La empresa todavía no tiene roles.',
            active: this.activeId,
            json: this.list.map(r => ({
                id: r.id,
                icon: r.lock ? 'lock' : 'shield',
                label: r.name,
                meta: `${r.users} usuario${r.users !== 1 ? 's' : ''} · ${r.actions} acci${r.actions !== 1 ? 'ones' : 'ón'}`
            })),
            onSelect: (item) => {
                this.activeId = item.id;
                this.renderList();
                this.getRole(item.id);
            }
        });
    }

    async getRole(id) {
        const $detail = $(`#detail${this.PROJECT_NAME}`);

        if (!id) {
            $detail.html($('<div>', { class: 'flex flex-col items-center justify-center text-center text-gray-400 py-12 gap-2' }).append(
                $('<i>', { 'data-lucide': 'shield-plus', class: 'w-8 h-8 text-gray-300' }),
                $('<p>', { class: 'text-sm', text: 'Crea el primer rol de la empresa para asignarle permisos.' })
            ));
            if (window.lucide) lucide.createIcons();
            return;
        }

        const request = await useFetch({ url: this._link, data: { opc: 'getRole', id: id } });
        if (!(request && request.status === 200)) {
            notify(request);
            return;
        }

        const role     = request.role || {};
        const readonly = !can('editar') || !!role.lock;

        $detail.empty().append(this.roleHeader(role), $('<div>', { id: `matrix${this.PROJECT_NAME}` }));

        this.csPermissionMatrix({
            parent: `matrix${this.PROJECT_NAME}`,
            id: 'matrixRole',
            json: request.catalog || {},
            readonly: readonly,
            note: role.lock || (readonly ? 'Tu rol puede ver los permisos, pero no cambiarlos.' : ''),
            users: role.users,
            onSave: (ids, done) => this.saveRolePermissions(role, ids, done)
        });

        if (window.lucide) lucide.createIcons();
    }

    // Nombre, descripción y a cuántos alcanza el rol, con sus acciones.
    roleHeader(role) {
        const actions = $('<div>', { class: 'flex items-center gap-2 shrink-0' });

        if (can('editar') && !role.lock) {
            actions.append(this.headerButton('pencil', 'Editar', () => this.editRole(role)));
        }

        if (can('eliminar')) {
            const btn = this.headerButton('trash-2', 'Eliminar', () => this.deleteRole(role), true);
            if (role.deleteLock) btn.prop('disabled', true).attr('title', role.deleteLock).addClass('opacity-50 cursor-not-allowed');
            actions.append(btn);
        }

        return $('<div>', { class: 'flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-gray-100' }).append(
            $('<div>', { class: 'flex items-start gap-3 min-w-0' }).append(
                $('<span>', { class: 'w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 inline-flex items-center justify-center shrink-0' })
                    .append($('<i>', { 'data-lucide': role.lock ? 'lock' : 'shield', class: 'w-5 h-5' })),
                $('<div>', { class: 'min-w-0' }).append(
                    $('<h4>', { class: 'text-lg font-bold text-gray-800 truncate', text: role.name }),
                    $('<p>', { class: 'text-sm text-gray-500', text: role.description || 'Sin descripción' }),
                    $('<p>', {
                        class: 'text-xs text-gray-400 mt-1',
                        text: `${role.users} usuario${role.users !== 1 ? 's' : ''} con este rol · ${role.actions} acci${role.actions !== 1 ? 'ones' : 'ón'} concedida${role.actions !== 1 ? 's' : ''}`
                    })
                )
            ),
            actions
        );
    }

    headerButton(icon, text, onClick, danger) {
        const btn = $('<button>', {
            type: 'button',
            class: 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition '
                + (danger ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-gray-200 text-gray-700 hover:bg-gray-50')
        }).append(
            $('<i>', { 'data-lucide': icon, class: 'w-4 h-4' }),
            $('<span>', { text: text })
        );
        btn.on('click', onClick);
        return btn;
    }

    addRole() {
        this.createModalForm({
            id: 'formRoleAdd',
            data: { opc: 'addRole' },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Nuevo rol' },
            json: this.jsonRole(true),
            success: (r) => {
                notify(r);
                if (r && r.status == 200) this.lsRoles(r.id);
            }
        });
    }

    editRole(role) {
        this.createModalForm({
            id: 'formRoleEdit',
            data: { opc: 'editRole', id: role.id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Editar rol' },
            autofill: {
                name: role.name,
                description: role.description
            },
            json: this.jsonRole(false),
            success: (r) => {
                notify(r);
                if (r && r.status == 200) this.lsRoles(role.id);
            }
        });
    }

    deleteRole(role) {
        if (role.deleteLock) {
            alert({ icon: 'info', text: role.deleteLock, btn1: true });
            return;
        }

        this.swalQuestion({
            opts: {
                title: `¿Eliminar el rol «${role.name}»?`,
                text: 'Se borra el rol con todos sus permisos. Esta acción no se puede deshacer.',
                icon: 'warning'
            },
            data: { opc: 'deleteRole', id: role.id },
            methods: {
                send: (r) => {
                    notify(r);
                    if (r && r.status == 200) {
                        this.activeId = null;
                        this.lsRoles();
                    }
                }
            }
        });
    }

    async saveRolePermissions(role, ids, done) {
        const request = await useFetch({
            url: this._link,
            data: {
                opc: 'saveRolePermissions',
                id: role.id,
                permissions: JSON.stringify(ids)
            }
        });

        notify(request);

        const ok = request && request.status == 200;
        done(ok);
        if (ok) this.lsRoles(role.id);
    }

    jsonRole(isNew) {
        const fields = [
            {
                opc: 'input',
                id: 'name',
                lbl: 'Nombre del rol',
                placeholder: 'Ej. Gerente de sucursal',
                class: 'col-12 mb-3',
                required: true
            },
            {
                opc: 'textarea',
                id: 'description',
                lbl: 'Descripción',
                placeholder: 'Qué hace quien tiene este rol',
                class: 'col-12 mb-3',
                required: false
            }
        ];

        if (isNew) {
            fields.push({
                opc: 'select',
                id: 'template_id',
                lbl: 'Copiar los permisos de',
                class: 'col-12 mb-3',
                required: false,
                data: [{ id: '', valor: 'Empezar sin permisos' }].concat(this.templates)
            });
        }

        return fields;
    }
}

// -- Sucursales --

class Subsidiaries extends App {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Subsidiaries';
    }

    render() {
        this.viewLayout(this.PROJECT_NAME, true);

        $(`#header${this.PROJECT_NAME}`).html(this.viewHeader({
            title: 'Sucursales',
            subtitle: 'Datos de cada sucursal: dirección, contacto, responsable y logo',
            action: can('agregar') ? {
                id: 'btnNewSubsidiary',
                icon: 'plus',
                text: 'Nueva sucursal',
                onClick: () => this.addSubsidiary()
            } : null
        }));

        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: [
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    class: 'col-12 col-md-3',
                    data: statusFilter,
                    onchange: 'subsidiaries.lsSubsidiaries()'
                }
            ]
        });

        if (window.lucide) lucide.createIcons();
        this.lsSubsidiaries();
    }

    lsSubsidiaries() {
        this.createTable({
            parent: `container${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: 'lsBranches' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbSubsidiaries',
                theme: 'light',
                center: [6],
                right: []
            }
        });
    }

    addSubsidiary() {
        this.createModalForm({
            id: 'formSubsidiaryAdd',
            data: { opc: 'addBranch' },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Nueva sucursal' },
            json: this.jsonSubsidiary(),
            success: (r) => this.afterSave(r)
        });
        this.renderLogoPicker('formSubsidiaryAdd', '');
    }

    async editSubsidiary(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getBranch', id: id } });
        if (request.status !== 200) {
            alert({ icon: 'error', text: request.message || 'No se pudo cargar la sucursal', btn1: true });
            return;
        }

        this.createModalForm({
            id: 'formSubsidiaryEdit',
            data: { opc: 'editBranch', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Configurar sucursal' },
            autofill: request.data,
            json: this.jsonSubsidiary(),
            success: (r) => this.afterSave(r)
        });
        this.renderLogoPicker('formSubsidiaryEdit', request.data.logo_url || '');
    }

    renderLogoPicker(formId, url) {
        this.renderImagePicker(formId, {
            field: 'logo',
            url: url,
            color: '#9CA3AF',
            icon: 'store',
            shape: 'rounded-xl',
            pickLabel: 'Subir logo'
        });
    }

    toggleSubsidiary(id, active) {
        const action = active == 1 ? 'activar' : 'desactivar';
        this.swalQuestion({
            opts: {
                title: `¿${active == 1 ? 'Activar' : 'Desactivar'} sucursal?`,
                text: `¿Deseas ${action} esta sucursal?`,
                icon: 'warning'
            },
            data: { opc: 'toggleBranch', id: id, active: active },
            methods: { send: (r) => this.afterSave(r) }
        });
    }

    afterSave(r) {
        notify(r);
        if (r.status == 200) this.lsSubsidiaries();
    }

    jsonSubsidiary() {
        return [
            {
                opc: 'input',
                id: 'name',
                lbl: 'Nombre de la sucursal',
                class: 'col-12 mb-3',
                required: true
            },
            {
                opc: 'input',
                id: 'ubication',
                lbl: 'Dirección',
                class: 'col-12 mb-3',
                required: false
            },
            {
                opc: 'input',
                id: 'phone',
                lbl: 'Teléfono',
                type: 'tel',
                class: 'col-12 col-md-6 mb-3',
                required: false
            },
            {
                opc: 'input',
                id: 'email',
                lbl: 'Correo',
                type: 'email',
                class: 'col-12 col-md-6 mb-3',
                required: false
            },
            {
                opc: 'select',
                id: 'manager_id',
                lbl: 'Responsable',
                class: 'col-12 mb-3',
                required: false,
                data: [{ id: '', valor: 'Sin responsable' }].concat(usuariosData)
            }
        ];
    }
}

// -- Bitácora --
// Quién hizo qué en usuarios, roles y sucursales, y cuándo entró o salió. Solo
// lectura: la escriben los ctrl (conf/_Auditoria.php).

class Bitacora extends App {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Bitacora';
        this.fi = moment().subtract(6, 'days');
        this.ff = moment();
    }

    render() {
        this.createLayout({
            parent: 'containerConfiguracion',
            design: false,
            data: {
                id: `view${this.PROJECT_NAME}`,
                class: 'flex flex-col gap-4',
                container: [
                    {
                        type: 'div',
                        id: `header${this.PROJECT_NAME}`
                    },
                    {
                        type: 'div',
                        id: `filterBar${this.PROJECT_NAME}`,
                        class: 'bg-white border border-gray-200 rounded-xl px-3 pt-2 pb-1'
                    },
                    {
                        type: 'div',
                        id: `kpis${this.PROJECT_NAME}`
                    },
                    {
                        type: 'div',
                        id: `container${this.PROJECT_NAME}`,
                        class: 'bg-white border border-gray-200 rounded-xl p-3 overflow-x-auto'
                    }
                ]
            }
        });

        $(`#header${this.PROJECT_NAME}`).html(this.viewHeader({
            title: 'Bitácora',
            subtitle: 'Movimientos de acceso: altas, cambios, permisos, bajas e inicios de sesión'
        }));

        this.filterBar();
        this.onChangeFilters();
    }

    filterBar() {
        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            data: [
                {
                    opc: 'input-calendar',
                    id: 'fRangoBitacora',
                    lbl: 'Periodo',
                    class: 'col-12 col-md-4',
                    readonly: true,
                    required: false
                },
                {
                    opc: 'select',
                    id: 'fUsuarioBitacora',
                    lbl: 'Usuario',
                    class: 'col-12 col-md-4',
                    data: [{ id: '', valor: 'Todos' }],
                    onchange: 'bitacora.onChangeFilters()'
                },
                {
                    opc: 'select',
                    id: 'fEntidadBitacora',
                    lbl: 'Elemento',
                    class: 'col-12 col-md-4',
                    data: [
                        { id: '', valor: 'Todos' },
                        { id: 'users', valor: 'Usuarios' },
                        { id: 'roles', valor: 'Roles' },
                        { id: 'branches', valor: 'Sucursales' },
                        { id: 'sesion', valor: 'Sesiones' }
                    ],
                    onchange: 'bitacora.onChangeFilters()'
                }
            ]
        });

        dataPicker({
            parent: 'fRangoBitacora',
            type: 'all',
            rangepicker: {
                startDate: this.fi,
                endDate: this.ff,
                showDropdowns: true,
                alwaysShowCalendars: true,
                ranges: {
                    'Hoy': [moment(), moment()],
                    'Ayer': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
                    'Últimos 7 días': [moment().subtract(6, 'days'), moment()],
                    'Mes actual': [moment().startOf('month'), moment().endOf('month')],
                    'Mes anterior': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
                },
                locale: {
                    format: 'DD-MM-YYYY',
                    separator: '  a  ',
                    applyLabel: 'Aplicar',
                    cancelLabel: 'Cancelar',
                    customRangeLabel: 'Personalizado',
                    daysOfWeek: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'],
                    monthNames: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
                    firstDay: 1
                }
            },
            onSelect: (start, end) => {
                this.fi = start;
                this.ff = end;
                this.onChangeFilters();
            }
        });
    }

    getFilters() {
        return {
            fi: this.fi.format('YYYY-MM-DD'),
            ff: this.ff.format('YYYY-MM-DD'),
            user_id: $('#fUsuarioBitacora').val() || '',
            entity: $('#fEntidadBitacora').val() || ''
        };
    }

    onChangeFilters() {
        this.showBitacora();
        this.lsBitacora();
    }

    async showBitacora() {
        const request = await useFetch({ url: this._link, data: Object.assign({ opc: 'showBitacora' }, this.getFilters()) });
        if (!(request && request.status === 200)) return;

        const c = request.counts || {};

        this.kpisRow({
            parent: `kpis${this.PROJECT_NAME}`,
            cardClass: 'bg-white rounded-xl border border-gray-200 px-4 py-3',
            json: [
                {
                    id: 'kpiTotalBitacora',
                    label: 'Movimientos',
                    value: c.total || 0,
                    tone: 'default',
                    icon: 'scroll-text'
                },
                {
                    id: 'kpiSesionesBitacora',
                    label: 'Sesiones',
                    value: c.sesiones || 0,
                    tone: 'info',
                    icon: 'log-in'
                },
                {
                    id: 'kpiCambiosBitacora',
                    label: 'Altas y cambios',
                    value: c.cambios || 0,
                    tone: 'success',
                    icon: 'pencil'
                },
                {
                    id: 'kpiBajasBitacora',
                    label: 'Bajas y eliminaciones',
                    value: c.bajas || 0,
                    tone: 'danger',
                    icon: 'trash-2'
                }
            ]
        });

        // Las opciones de usuario son quienes aparecen en la bitácora; se conserva
        // el elegido aunque se repinten.
        const $user    = $('#fUsuarioBitacora');
        const selected = $user.val() || '';
        $user.empty().append($('<option>', { value: '', text: 'Todos' }));
        (request.usuarios || []).forEach(u => $user.append($('<option>', { value: u.id, text: u.valor })));
        $user.val(selected);
    }

    async lsBitacora() {
        const request = await useFetch({ url: this._link, data: Object.assign({ opc: 'lsBitacora' }, this.getFilters()) });
        const row = request && request.status === 200 ? request.row || [] : [];

        this.createCoffeeTable3({
            parent: `container${this.PROJECT_NAME}`,
            id: `tb${this.PROJECT_NAME}`,
            theme: 'light',
            center: [3],
            right: [],
            extends: true,
            scrollable: false,
            striped: true,
            f_size: 12,
            emptyMessage: 'No hay movimientos con los filtros aplicados',
            emptyIcon: 'icon-doc-text',
            data: { row: row }
        });

        if (window.lucide) lucide.createIcons();

        if (row.length > 15 && typeof simple_data_table === 'function') {
            simple_data_table(`#tb${this.PROJECT_NAME}`, 15);
        }
    }

    // El ojo de la bitácora: el antes y el después de cada campo.
    async getBitacora(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getBitacora', id: id } });
        if (!(request && request.status === 200)) {
            notify(request);
            return;
        }

        const h   = request.header || {};
        const esc = (str) => $('<span>').text(str == null ? '' : String(str)).html();

        this.detailModal({
            id: 'bitacora',
            title: 'Detalle del movimiento',
            value: `${h.badge} <span class="ml-1">${esc(h.elemento)}</span>`,
            subtitle: `${esc(h.fecha)} · ${esc(h.usuario)} · IP ${esc(h.ip)}`,
            emptyMessage: 'El movimiento no guardó detalle',
            data: { row: request.row || [] }
        });
    }
}
