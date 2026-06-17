let api = 'ctrl/ctrl-accesos.php';
let app, subsidiaries, users;
let statusFilter = [];
let sucursalesData = [];
let dataInit = {};

const USER_COLOR_PALETTE = [
    '#C05A40', '#4A7C8F', '#6B7FAB', '#7A9E5F',
    '#A06B3C', '#6A5FA8', '#4D8FA8', '#9E5F6B',
    '#5F9E7A', '#8C6A3C'
];

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

    app          = new App(api, 'root');
    subsidiaries = new Subsidiaries(api, 'root');
    users        = new Users(api, 'root');

    app.render();
});

class App extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Accesos';
    }

    render() {
        this.layout();
        subsidiaries.render();
        users.render();
        // Mostrar la primera pestaña por defecto.
        subsidiaries.lsSubsidiaries();
    }

    layout() {
        this.primaryLayout({
            parent: 'root',
            id: this.PROJECT_NAME,
            class: 'w-full',
            card: {
                filterBar: { class: 'w-full', id: `filterBar${this.PROJECT_NAME}` },
                container: { class: 'w-full h-full', id: `container${this.PROJECT_NAME}` }
            }
        });

        this.headerBar({
            parent: `filterBar${this.PROJECT_NAME}`
        });

        this.layoutTabs();
    }

    headerBar(options) {
        const company = dataInit.company_name || '—';
        const total   = sucursalesData.length;

        const container = $('<div>', {
            class: 'flex justify-between items-center px-2 pt-3 pb-3'
        });

        container.html(`
            <div>
                <h2 class="text-2xl font-semibold">🏢 Administrador de Accesos</h2>
                <p class="text-gray-400">
                    Empresa: <span class="font-semibold text-gray-600">${company}</span>
                    · Tienes acceso a
                    <span class="font-semibold text-gray-600">${total}</span>
                    sucursal${total !== 1 ? 'es' : ''}
                </p>
            </div>
            <button class="bg-[#C05A40] hover:opacity-90 text-white font-semibold px-4 py-2 rounded transition flex items-center"
                onclick="app.render()">
                <i class="icon-arrows-cw mr-2"></i>Actualizar
            </button>
        `);

        $(`#${options.parent}`).html(container);
    }

    layoutTabs() {
        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: 'light',
            class: '',
            type: 'short',
            json: [
                {
                    id: 'sucursales',
                    tab: 'Sucursales',
                    class: 'mb-1',
                    active: true,
                    onClick: () => subsidiaries.lsSubsidiaries()
                },
                {
                    id: 'usuarios',
                    tab: 'Usuarios',
                    onClick: () => users.lsUsers()
                }
            ]
        });

        $(`#content-tabs${this.PROJECT_NAME}`).removeClass('h-screen');
    }
}

class Subsidiaries extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Subsidiaries';
    }

    render() {
        const container = $('#container-sucursales');
        container.html(`
            <div id="filterbar-subsidiaries" class="mb-2"></div>
            <div id="table-subsidiaries"></div>
        `);

        this.createfilterBar({
            parent: 'filterbar-subsidiaries',
            data: [
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    class: 'col-12 col-md-3',
                    data: statusFilter,
                    onchange: 'subsidiaries.lsSubsidiaries()'
                },
                {
                    opc: 'button',
                    class: 'col-12 col-md-3',
                    id: 'btnNewSubsidiary',
                    text: 'Nueva Sucursal',
                    onClick: () => this.addSubsidiary()
                }
            ]
        });
    }

    lsSubsidiaries() {
        this.createTable({
            parent: 'table-subsidiaries',
            idFilterBar: 'filterbar-subsidiaries',
            data: { opc: 'lsBranches' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbSubsidiaries',
                theme: 'light',
                center: [3],
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
            bootbox: { title: 'Nueva Sucursal' },
            json: this.jsonSubsidiary(),
            success: (r) => this._afterSave(r)
        });
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
            bootbox: { title: 'Editar Sucursal' },
            autofill: request.data,
            json: this.jsonSubsidiary(),
            success: (r) => this._afterSave(r)
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
            methods: { send: (r) => this._afterSave(r) }
        });
    }

    _afterSave(r) {
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
                lbl: 'Ubicación',
                class: 'col-12 mb-3'
            }
        ];
    }
}

class Users extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'UsersAcc';
    }

    render() {
        const container = $('#container-usuarios');
        container.html(`
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
                    data: statusFilter,
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
            attr: {
                id: 'tbUsersAcc',
                theme: 'light',
                center: [4],
                right: []
            }
        });
    }

    addUser() {
        this.createModalForm({
            id: 'formUserAdd',
            data: { opc: 'addUser' },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Nuevo Usuario' },
            json: this.jsonUser(false),
            success: (r) => this._afterSave(r)
        });
        this.renderBranchesAndColor('formUserAdd', [], null);
    }

    async editUser(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getUser', id: id } });
        if (request.status !== 200) {
            alert({ icon: 'error', text: request.message || 'No se pudo cargar el usuario', btn1: true });
            return;
        }

        const data = request.data;
        const branchIds = Array.isArray(data.branch_ids) ? data.branch_ids.map(Number) : [];
        const color = data.color || null;

        this.createModalForm({
            id: 'formUserEdit',
            data: { opc: 'editUser', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Editar Usuario' },
            autofill: data,
            json: this.jsonUser(true),
            success: (r) => this._afterSave(r)
        });
        this.renderBranchesAndColor('formUserEdit', branchIds, color);
    }

    renderBranchesAndColor(formId, selectedBranchIds, selectedColor) {
        const $form = $('#' + formId);

        const $branchWrap = $('<div>', { class: 'col-12 mb-3' });
        $branchWrap.append($('<label>', { class: 'form-label fw-semibold', text: 'Sucursales asignadas' }));
        const $checkGroup = $('<div>', { class: 'flex flex-wrap gap-2 mt-1' });

        sucursalesData.forEach(branch => {
            const checked = selectedBranchIds.includes(Number(branch.id));
            const $lbl = $('<label>', {
                class: 'flex items-center gap-1 cursor-pointer px-3 py-1 rounded-full border text-sm font-medium transition ' +
                       (checked ? 'bg-[#C05A40] text-white border-[#C05A40]' : 'bg-white text-gray-600 border-gray-300 hover:border-[#C05A40]')
            });
            const $chk = $('<input>', {
                type: 'checkbox',
                class: 'hidden branch-check',
                value: branch.id,
                checked: checked
            });
            $lbl.append($chk, $('<span>', { text: branch.valor }));

            $lbl.on('click', function () {
                const $input = $(this).find('input');
                const nowChecked = !$input.prop('checked');
                $input.prop('checked', nowChecked);
                if (nowChecked) {
                    $(this).addClass('bg-[#C05A40] text-white border-[#C05A40]').removeClass('bg-white text-gray-600 border-gray-300');
                } else {
                    $(this).removeClass('bg-[#C05A40] text-white border-[#C05A40]').addClass('bg-white text-gray-600 border-gray-300');
                }
                const ids = $form.find('.branch-check:checked').map(function () { return $(this).val(); }).get();
                $form.find('[name="branch_ids"]').val(JSON.stringify(ids));
            });

            $checkGroup.append($lbl);
        });

        $branchWrap.append($checkGroup);

        const initIds = selectedBranchIds.map(String);
        $form.find('[name="branch_ids"]').val(JSON.stringify(initIds));

        const $colorWrap = $('<div>', { class: 'col-12 mb-3' });
        $colorWrap.append($('<label>', { class: 'form-label fw-semibold', text: 'Color del colaborador' }));
        const $swatches = $('<div>', { class: 'flex flex-wrap gap-2 mt-1' });

        USER_COLOR_PALETTE.forEach(hex => {
            const isActive = hex === selectedColor;
            const $swatch = $('<button>', {
                type: 'button',
                class: 'w-7 h-7 rounded-full border-2 transition ' + (isActive ? 'border-gray-800 scale-110' : 'border-transparent'),
                css: { backgroundColor: hex }
            });
            $swatch.on('click', function () {
                $swatches.find('button').removeClass('border-gray-800 scale-110').addClass('border-transparent');
                $(this).removeClass('border-transparent').addClass('border-gray-800 scale-110');
                $form.find('[name="color"]').val(hex);
            });
            $swatches.append($swatch);
        });

        if (selectedColor) {
            $form.find('[name="color"]').val(selectedColor);
        }

        $colorWrap.append($swatches);

        const $btnRow = $form.find('#btnSuccess').closest('.col-6').parent();
        $btnRow.before($branchWrap, $colorWrap);
    }

    changePassword(id) {
        this.createModalForm({
            id: 'formUserPassword',
            data: { opc: 'changePassword', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Cambiar Contraseña' },
            json: [
                {
                    opc: 'input',
                    id: 'password',
                    lbl: 'Nueva contraseña',
                    type: 'password',
                    class: 'col-12 mb-3',
                    required: true
                }
            ],
            success: (r) => notify(r)
        });
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
            methods: { send: (r) => this._afterSave(r) }
        });
    }

    _afterSave(r) {
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
                opc: 'input',
                id: 'branch_ids',
                type: 'hidden',
                lbl: '',
                class: 'col-12',
                required: false
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

        if (!isEdit) {
            fields.push({
                opc: 'input',
                id: 'password',
                lbl: 'Contraseña',
                type: 'password',
                class: 'col-12 mb-3',
                required: true
            });
        }

        return fields;
    }
}
