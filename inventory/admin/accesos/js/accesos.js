let api = 'ctrl/ctrl-accesos.php';
let app, subsidiaries, users;
let statusFilter = [];
let sucursalesData = [];
let dataInit = {};

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
            data: { opc: 'lsSubsidiaries' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: 'tbSubsidiaries',
                theme: 'light',
                center: [4, 5],
                right: []
            }
        });
    }

    addSubsidiary() {
        this.createModalForm({
            id: 'formSubsidiaryAdd',
            data: { opc: 'addSubsidiary' },
            bootbox: { title: 'Nueva Sucursal' },
            json: this.jsonSubsidiary(),
            success: (r) => this._afterSave(r)
        });
    }

    async editSubsidiary(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getSubsidiary', id: id } });
        if (request.status !== 200) {
            alert({ icon: 'error', text: request.message || 'No se pudo cargar la sucursal', btn1: true });
            return;
        }

        this.createModalForm({
            id: 'formSubsidiaryEdit',
            data: { opc: 'editSubsidiary', id: id },
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
            data: { opc: 'toggleSubsidiary', id: id, active: active },
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
                id: 'address',
                lbl: 'Dirección',
                class: 'col-12 mb-3'
            },
            {
                opc: 'input',
                id: 'phone',
                lbl: 'Teléfono',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'select',
                id: 'is_main',
                lbl: '¿Sucursal principal?',
                class: 'col-12 col-md-6 mb-3',
                data: [
                    { id: '0', valor: 'No' },
                    { id: '1', valor: 'Sí' }
                ]
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
                center: [6],
                right: []
            }
        });
    }

    addUser() {
        this.createModalForm({
            id: 'formUserAdd',
            data: { opc: 'addUser' },
            bootbox: { title: 'Nuevo Usuario' },
            json: this.jsonUser(false),
            success: (r) => this._afterSave(r)
        });
    }

    async editUser(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getUser', id: id } });
        if (request.status !== 200) {
            alert({ icon: 'error', text: request.message || 'No se pudo cargar el usuario', btn1: true });
            return;
        }

        const data = request.data;
        if (data.subsidiaries_id != null) data.subsidiaries_id = String(data.subsidiaries_id);

        this.createModalForm({
            id: 'formUserEdit',
            data: { opc: 'editUser', id: id },
            bootbox: { title: 'Editar Usuario' },
            autofill: data,
            json: this.jsonUser(true),
            success: (r) => this._afterSave(r)
        });
    }

    changePassword(id) {
        this.createModalForm({
            id: 'formUserPassword',
            data: { opc: 'changePassword', id: id },
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
                id: 'fullname',
                lbl: 'Nombre del colaborador',
                class: 'col-12 mb-3',
                required: true
            },
            {
                opc: 'input',
                id: 'username',
                lbl: 'Nombre de usuario',
                class: 'col-12 col-md-6 mb-3',
                required: true
            },
            {
                opc: 'input',
                id: 'email',
                lbl: 'Correo',
                type: 'email',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'phone',
                lbl: 'Teléfono',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'select',
                id: 'subsidiaries_id',
                lbl: 'Sucursal asignada',
                class: 'col-12 col-md-6 mb-3',
                data: [{ id: '', valor: '-- Sin asignar --' }].concat(sucursalesData)
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
