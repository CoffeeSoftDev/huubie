let api = 'ctrl/ctrl-admin.php';
let app, users, profiles, udn;
let statusFilter;

$(async () => {
    const data = await useFetch({ url: api, data: { opc: "init" } });
    statusFilter = data.status;

    app = new App(api, "root");
    users = new Users(api, "root");
    profiles = new Profiles(api, "root");
    udn = new UDN(api, "root");

    app.render();
});

class App extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Admin";
    }

    render() {
        this.layout();
        this.renderDashboard();
        users.render();
        profiles.render();
        udn.render();
    }

    layout() {
        this.primaryLayout({
            parent: "root",
            id: this.PROJECT_NAME,
            class: 'w-full',
            card: {
                filterBar: { class: 'w-full', id: `filterBar${this.PROJECT_NAME}` },
                container: { class: 'w-full h-full', id: `container${this.PROJECT_NAME}` }
            }
        });

        this.headerBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            title: "📊 Administrador de Perfiles",
            subtitle: "Gestiona usuarios, perfiles y unidades de negocio",
            onClick: () => app.render()
        });

        this.layoutTabs();
    }

    layoutTabs() {
        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: "light",
            class: '',
            type: "short",
            json: [
                {
                    id: "dashboard",
                    tab: "Dashboard",
                    class: "mb-1",
                    active: true,
                    onClick: () => this.renderDashboard()
                },
                {
                    id: "usuarios",
                    tab: "Usuarios",
                    onClick: () => users.lsUsers()
                },
                {
                    id: "perfiles",
                    tab: "Perfiles",
                    onClick: () => profiles.lsProfiles()
                },
                {
                    id: "udn",
                    tab: "Unidades de Negocio",
                    onClick: () => udn.lsUDN()
                }
            ]
        });

        $(`#content-tabs${this.PROJECT_NAME}`).removeClass('h-screen');
    }

    async renderDashboard() {
        const container = $(`#container-dashboard`);
        
        container.html(`
            <div class="p-6">
                <h2 class="text-2xl font-semibold mb-4">Panel de Control</h2>
                <p class="text-gray-600 mb-6">Resumen del sistema de gestión</p>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" id="dashboardCards">
                    <!-- Cards will be inserted here -->
                </div>

                <div class="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="bg-white p-6 rounded-xl shadow border">
                        <h3 class="text-lg font-semibold mb-4">Acciones Rápidas</h3>
                        <div class="space-y-3">
                            <button onclick="users.addUser()" class="w-full flex items-center gap-3 p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
                                <i class="icon-user-plus text-blue-600"></i>
                                <div class="text-left">
                                    <div class="font-semibold text-blue-900">Crear Usuario</div>
                                    <div class="text-sm text-blue-600">Agregar nuevo usuario al sistema</div>
                                </div>
                            </button>
                            <button onclick="profiles.addProfile()" class="w-full flex items-center gap-3 p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition">
                                <i class="icon-shield text-purple-600"></i>
                                <div class="text-left">
                                    <div class="font-semibold text-purple-900">Crear Perfil</div>
                                    <div class="text-sm text-purple-600">Configurar nuevo perfil de acceso</div>
                                </div>
                            </button>
                            <button onclick="udn.addUDN()" class="w-full flex items-center gap-3 p-3 bg-orange-50 hover:bg-orange-100 rounded-lg transition">
                                <i class="icon-building text-orange-600"></i>
                                <div class="text-left">
                                    <div class="font-semibold text-orange-900">Nueva Unidad</div>
                                    <div class="text-sm text-orange-600">Agregar unidad de negocio</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    <div class="bg-white p-6 rounded-xl shadow border">
                        <h3 class="text-lg font-semibold mb-4">Estado del Sistema</h3>
                        <div class="space-y-4">
                            <div class="flex justify-between items-center">
                                <span class="text-gray-600">Usuarios registrados</span>
                                <span class="font-bold text-blue-600" id="totalUsers">-</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-gray-600">Tasa de activación</span>
                                <span class="font-bold text-green-600" id="activationRate">-</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-gray-600">Perfiles disponibles</span>
                                <span class="font-bold text-purple-600" id="availableProfiles">-</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-gray-600">UDN activas</span>
                                <span class="font-bold text-orange-600" id="activeUDN">-</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `);

        this.loadDashboardMetrics();
    }

    async loadDashboardMetrics() {
        try {
            const usersData = await useFetch({ url: api, data: { opc: "lsUsers", active: 1 } });
            const profilesData = await useFetch({ url: api, data: { opc: "lsProfiles", active: 1 } });
            const udnData = await useFetch({ url: api, data: { opc: "lsUDN", active: 1 } });

            const totalUsers = usersData.ls.length;
            const activeUsers = usersData.ls.filter(u => u.active == 1).length;
            const totalProfiles = profilesData.ls.length;
            const activeUDN = udnData.ls.length;

            const cards = [
                {
                    title: "Total Usuarios",
                    value: totalUsers,
                    description: `${totalUsers} usuarios activos`,
                    icon: "icon-users",
                    color: "bg-blue-500"
                },
                {
                    title: "Usuarios Activos",
                    value: activeUsers,
                    description: "Con acceso al sistema",
                    icon: "icon-user-check",
                    color: "bg-green-500"
                },
                {
                    title: "Perfiles",
                    value: totalProfiles,
                    description: "Perfiles configurados",
                    icon: "icon-shield",
                    color: "bg-purple-500"
                },
                {
                    title: "Unidades de Negocio",
                    value: activeUDN,
                    description: `${activeUDN} activas`,
                    icon: "icon-building",
                    color: "bg-orange-500"
                }
            ];

            let cardsHTML = '';
            cards.forEach(card => {
                cardsHTML += `
                    <div class="bg-white p-6 rounded-xl shadow border hover:shadow-lg transition">
                        <div class="flex items-center justify-between mb-4">
                            <div class="${card.color} w-12 h-12 rounded-lg flex items-center justify-center">
                                <i class="${card.icon} text-white text-xl"></i>
                            </div>
                        </div>
                        <div class="text-3xl font-bold mb-1">${card.value}</div>
                        <div class="text-sm text-gray-600 mb-1">${card.title}</div>
                        <div class="text-xs text-gray-500">${card.description}</div>
                    </div>
                `;
            });

            $('#dashboardCards').html(cardsHTML);

            $('#totalUsers').text(totalUsers);
            $('#activationRate').text(totalUsers > 0 ? '100%' : '0%');
            $('#availableProfiles').text(totalProfiles);
            $('#activeUDN').text(`${activeUDN} / ${activeUDN}`);

        } catch (error) {
            console.error('Error loading dashboard metrics:', error);
        }
    }

    headerBar(options) {
        const defaults = {
            parent: "root",
            title: "Título por defecto",
            subtitle: "Subtítulo por defecto",
            icon: "icon-home",
            textBtn: "Inicio",
            classBtn: "bg-blue-600 hover:bg-blue-700",
            onClick: null
        };

        const opts = Object.assign({}, defaults, options);

        const container = $("<div>", {
            class: "flex justify-between items-center px-2 pt-3 pb-3"
        });

        const leftSection = $("<div>").append(
            $("<h2>", {
                class: "text-2xl font-semibold",
                text: opts.title
            }),
            $("<p>", {
                class: "text-gray-400",
                text: opts.subtitle
            })
        );

        const rightSection = $("<div>").append(
            $("<button>", {
                class: `${opts.classBtn} text-white font-semibold px-4 py-2 rounded transition flex items-center`,
                html: `<i class="${opts.icon} mr-2"></i>${opts.textBtn}`,
                click: () => {
                    if (typeof opts.onClick === "function") {
                        opts.onClick();
                    }
                }
            })
        );

        container.append(leftSection, rightSection);
        $(`#${opts.parent}`).html(container);
    }
}


class Users extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Users";
    }

    render() {
        this.layout();
        this.filterBarUsers();
    }

    layout() {
        this.primaryLayout({
            parent: `container-usuarios`,
            id: this.PROJECT_NAME,
            class: 'w-full',
            card: {
                filterBar: { class: 'w-full border-b pb-2', id: `filterBar${this.PROJECT_NAME}` },
                container: { class: 'w-full my-2 h-full', id: `container${this.PROJECT_NAME}` }
            }
        });
    }

    filterBarUsers() {
        const container = $(`#container-usuarios`);
        container.html(`
            <div id="filterbar-users" class="mb-2"></div>
            <div id="table-users"></div>
        `);

        this.createfilterBar({
            parent: "filterbar-users",
            data: [
                {
                    opc: "select",
                    id: "active",
                    lbl: "Estado",
                    class: "col-12 col-md-3",
                    data: statusFilter,
                    onchange: 'users.lsUsers()'
                },
                {
                    opc: "button",
                    class: "col-12 col-md-3",
                    id: "btnNewUser",
                    text: "Nuevo Usuario",
                    onClick: () => this.addUser()
                }
            ]
        });
    }

    lsUsers() {
        this.createTable({
            parent: "table-users",
            idFilterBar: "filterbar-users",
            data: { opc: "lsUsers" },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbUsers",
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
            bootbox: {
                title: 'Agregar Usuario'
            },
            json: this.jsonUser(),
            success: (response) => {
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Aceptar"
                    });
                    this.lsUsers();
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });
                }
            }
        });
    }

    async editUser(idUser) {
        const request = await useFetch({
            url: this._link,
            data: {
                opc: "getUser",
                idUser: idUser
            }
        });

        const user = request.data;
        delete user.key;
        delete user.key2;

        this.createModalForm({
            id: 'formUserEdit',
            data: { opc: 'editUser', idUser: idUser },
            bootbox: {
                title: 'Editar Usuario'
            },
            autofill: user,
            json: this.jsonUser(true),
            success: (response) => {
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Aceptar"
                    });
                    this.lsUsers();
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });
                }
            }
        });
    }

    deleteUser(idUser) {
        const row = event.target.closest('tr');
        const username = row.querySelectorAll('td')[1]?.innerText || '';

        this.swalQuestion({
            opts: {
                title: `¿Eliminar usuario?`,
                html: `¿Estás seguro de eliminar el usuario <strong>${username}</strong>?
                <br><br>
                <span class="text-red-500">⚠️ Esta acción es permanente y no se puede deshacer.</span>`,
                icon: "warning"
            },
            data: { opc: "deleteUser", idUser: idUser },
            methods: {
                send: (response) => {
                    if (response.status == 200) {
                        alert({
                            icon: "success",
                            text: response.message,
                            btn1: true
                        });
                        this.lsUsers();
                    } else {
                        alert({
                            icon: "error",
                            text: response.message,
                            btn1: true
                        });
                    }
                }
            }
        });
    }

    async assignProfile(idUser) {
        const profilesData = await useFetch({
            url: this._link,
            data: { opc: "lsProfiles", active: 1 }
        });

        const userProfilesData = await useFetch({
            url: this._link,
            data: { opc: "getUserProfiles", idUser: idUser }
        });

        const assignedIds = userProfilesData.data.map(p => p.idPerfil);
        const availableProfiles = profilesData.ls.filter(p => !assignedIds.includes(p.idPerfil));

        if (availableProfiles.length === 0) {
            alert({
                icon: "info",
                text: "Este usuario ya tiene todos los perfiles asignados",
                btn1: true
            });
            return;
        }

        this.createModalForm({
            id: 'formAssignProfile',
            data: { opc: 'assignProfile', idUser: idUser },
            bootbox: {
                title: 'Asignar Perfil'
            },
            json: [
                {
                    opc: "select",
                    id: "usr_perfil",
                    lbl: "Seleccionar Perfil",
                    class: "col-12",
                    data: availableProfiles,
                    text: "perfil",
                    value: "idPerfil"
                }
            ],
            success: (response) => {
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        text: response.message,
                        btn1: true
                    });
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true
                    });
                }
            }
        });
    }

    jsonUser(isEdit = false) {
        const fields = [
            {
                opc: "input",
                id: "usser",
                lbl: "Nombre de Usuario",
                class: "col-12 mb-3",
                required: true
            },
            {
                opc: "input",
                id: "usr_Colaborador",
                lbl: "Nombre del Colaborador",
                class: "col-12 mb-3",
                required: true
            },
            {
                opc: "input",
                id: "key",
                lbl: isEdit ? "Nueva Contraseña (dejar vacío para no cambiar)" : "Contraseña",
                type: "password",
                class: "col-12 mb-3",
                required: !isEdit
            }
        ];

        return fields;
    }
}


class Profiles extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Profiles";
    }

    render() {
        this.layout();
        this.filterBarProfiles();
    }

    layout() {
        this.primaryLayout({
            parent: `container-perfiles`,
            id: this.PROJECT_NAME,
            class: 'w-full',
            card: {
                filterBar: { class: 'w-full border-b pb-2', id: `filterBar${this.PROJECT_NAME}` },
                container: { class: 'w-full my-2 h-full', id: `container${this.PROJECT_NAME}` }
            }
        });
    }

    filterBarProfiles() {
        const container = $(`#container-perfiles`);
        container.html(`
            <div id="filterbar-profiles" class="mb-2"></div>
            <div id="table-profiles"></div>
        `);

        this.createfilterBar({
            parent: "filterbar-profiles",
            data: [
                {
                    opc: "select",
                    id: "active",
                    lbl: "Estado",
                    class: "col-12 col-md-3",
                    data: statusFilter,
                    onchange: 'profiles.lsProfiles()'
                },
                {
                    opc: "button",
                    class: "col-12 col-md-3",
                    id: "btnNewProfile",
                    text: "Nuevo Perfil",
                    onClick: () => this.addProfile()
                }
            ]
        });
    }

    lsProfiles() {
        this.createTable({
            parent: "table-profiles",
            idFilterBar: "filterbar-profiles",
            data: { opc: "lsProfiles" },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbProfiles",
                theme: 'light',
                center: [3],
                right: []
            }
        });
    }

    addProfile() {
        this.createModalForm({
            id: 'formProfileAdd',
            data: { opc: 'addProfile' },
            bootbox: {
                title: 'Agregar Perfil'
            },
            json: this.jsonProfile(),
            success: (response) => {
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Aceptar"
                    });
                    this.lsProfiles();
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });
                }
            }
        });
    }

    async editProfile(idPerfil) {
        const request = await useFetch({
            url: this._link,
            data: {
                opc: "getProfile",
                idPerfil: idPerfil
            }
        });

        const profile = request.data;

        this.createModalForm({
            id: 'formProfileEdit',
            data: { opc: 'editProfile', idPerfil: idPerfil },
            bootbox: {
                title: 'Editar Perfil'
            },
            autofill: profile,
            json: this.jsonProfile(),
            success: (response) => {
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Aceptar"
                    });
                    this.lsProfiles();
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });
                }
            }
        });
    }

    statusProfile(idPerfil, currentStatus) {
        const newStatus = currentStatus == 1 ? 0 : 1;
        const action = newStatus == 1 ? 'activar' : 'desactivar';

        this.swalQuestion({
            opts: {
                title: `¿Cambiar estado del perfil?`,
                text: `¿Deseas ${action} este perfil?`,
                icon: "warning"
            },
            data: { opc: "statusProfile", idPerfil: idPerfil, perfil_estado: newStatus },
            methods: {
                send: (response) => {
                    if (response.status == 200) {
                        alert({
                            icon: "success",
                            text: response.message,
                            btn1: true
                        });
                        this.lsProfiles();
                    } else {
                        alert({
                            icon: "error",
                            text: response.message,
                            btn1: true
                        });
                    }
                }
            }
        });
    }

    jsonProfile() {
        return [
            {
                opc: "input",
                id: "perfil",
                lbl: "Nombre del Perfil",
                class: "col-12 mb-3",
                required: true
            }
        ];
    }
}


class UDN extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "UDN";
    }

    render() {
        this.layout();
        this.filterBarUDN();
    }

    layout() {
        this.primaryLayout({
            parent: `container-udn`,
            id: this.PROJECT_NAME,
            class: 'w-full',
            card: {
                filterBar: { class: 'w-full border-b pb-2', id: `filterBar${this.PROJECT_NAME}` },
                container: { class: 'w-full my-2 h-full', id: `container${this.PROJECT_NAME}` }
            }
        });
    }

    filterBarUDN() {
        const container = $(`#container-udn`);
        container.html(`
            <div id="filterbar-udn" class="mb-2"></div>
            <div id="table-udn"></div>
        `);

        this.createfilterBar({
            parent: "filterbar-udn",
            data: [
                {
                    opc: "select",
                    id: "active",
                    lbl: "Estado",
                    class: "col-12 col-md-3",
                    data: statusFilter,
                    onchange: 'udn.lsUDN()'
                },
                {
                    opc: "button",
                    class: "col-12 col-md-3",
                    id: "btnNewUDN",
                    text: "Nueva Unidad",
                    onClick: () => this.addUDN()
                }
            ]
        });
    }

    lsUDN() {
        this.createTable({
            parent: "table-udn",
            idFilterBar: "filterbar-udn",
            data: { opc: "lsUDN" },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbUDN",
                theme: 'light',
                center: [4],
                right: []
            }
        });
    }

    addUDN() {
        this.createModalForm({
            id: 'formUDNAdd',
            data: { opc: 'addUDN' },
            bootbox: {
                title: 'Agregar Unidad de Negocio'
            },
            json: this.jsonUDN(),
            success: (response) => {
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Aceptar"
                    });
                    this.lsUDN();
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });
                }
            }
        });
    }

    async editUDN(idUDN) {
        const request = await useFetch({
            url: this._link,
            data: {
                opc: "getUDN",
                idUDN: idUDN
            }
        });

        const udnData = request.data;

        this.createModalForm({
            id: 'formUDNEdit',
            data: { opc: 'editUDN', idUDN: idUDN },
            bootbox: {
                title: 'Editar Unidad de Negocio'
            },
            autofill: udnData,
            json: this.jsonUDN(),
            success: (response) => {
                if (response.status == 200) {
                    alert({
                        icon: "success",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Aceptar"
                    });
                    this.lsUDN();
                } else {
                    alert({
                        icon: "error",
                        text: response.message,
                        btn1: true,
                        btn1Text: "Ok"
                    });
                }
            }
        });
    }

    deleteUDN(idUDN) {
        const row = event.target.closest('tr');
        const name = row.querySelectorAll('td')[1]?.innerText || '';

        this.swalQuestion({
            opts: {
                title: `¿Eliminar unidad de negocio?`,
                html: `¿Estás seguro de eliminar la unidad <strong>${name}</strong>?
                <br><br>
                <span class="text-red-500">⚠️ Esta acción es permanente y no se puede deshacer.</span>`,
                icon: "warning"
            },
            data: { opc: "deleteUDN", idUDN: idUDN },
            methods: {
                send: (response) => {
                    if (response.status == 200) {
                        alert({
                            icon: "success",
                            text: response.message,
                            btn1: true
                        });
                        this.lsUDN();
                    } else {
                        alert({
                            icon: "error",
                            text: response.message,
                            btn1: true
                        });
                    }
                }
            }
        });
    }

    jsonUDN() {
        return [
            {
                opc: "input",
                id: "UDN",
                lbl: "Nombre de la Unidad",
                class: "col-12 mb-3",
                required: true
            },
            {
                opc: "input",
                id: "Abreviatura",
                lbl: "Abreviatura",
                class: "col-12 col-md-6 mb-3",
                required: true
            },
            {
                opc: "input",
                id: "Antiguedad",
                lbl: "Antigüedad",
                type: "number",
                class: "col-12 col-md-6 mb-3"
            }
        ];
    }
}
