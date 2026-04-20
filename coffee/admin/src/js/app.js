let api = "/coffee/admin/ctrl/ctrl-admin.php";
let app, usuarios, sucursales, company, clausulas;
let rol, sucursal, nameCompany, idCompany;

$(function () {
    fn_ajax({ opc: "init" }, api).then((data) => {
        idCompany = data.companies.id;
        rol = data.rol;
        sucursal = data.sucursal;
        nameCompany = data.nameCompany;

        app = new App(api, "root");
        usuarios = new Usuarios(api, "root");
        sucursales = new Sucursales(api, "root");
        company = new Company(api, "root");
        clausulas = new Clausulas(api, "root");

        app.render();

    });
});

class App extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Admin";
    }

    render() {
        this.layout();
        this.renderTabs();
        this.renderActiveTab();
    }

    layout() {
        this.createLayout({
            parent: 'root',
            design:false,
            data: {
                id: this.PROJECT_NAME,
                class: 'w-full min-h-screen p-4',
                container: [
                    {
                        type: 'div',
                        id: `container${this.PROJECT_NAME}`,
                        class: 'w-full bg-[#1F2A37] rounded-lg p-3 min-h-screen',
                        children: [
                            {
                                id: 'titleAdmin',
                                class: 'px-4 pt-3 pb-3'
                            },
                            {
                                id: `tabs${this.PROJECT_NAME}`,
                                class: 'w-full p-3 '
                            }
                        ]
                    }
                ]
            }
        });

        $("#titleAdmin").html(`
            <h2 class="text-2xl font-semibold text-white">⚙️ Configuración de ${nameCompany}</h2>
            <p class="text-gray-400">Administra los datos de la empresa, los usuarios y sucursales de la aplicacion.</p>
        `);
    }

    renderTabs() {
        this.tabLayout({
            parent: `tabsAdmin`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: "dark",
            type: "short",
            showBorder: false,
            json: [
                {
                    id: "tab-company",
                    tab: "Empresa",
                    lucideIcon: "building-2",
                    iconColor: "text-white",
                    active: true,
                    onClick: () => company.render()
                },
                {
                    id: "tab-usuarios",
                    tab: "Usuarios",
                    lucideIcon: "users",
                    iconColor: "text-white",
                    onClick: () => usuarios.render()
                },
                {
                    id: "tab-sucursales",
                    tab: "Sucursal",
                    lucideIcon: "map-pin",
                    iconColor: "text-white",
                    onClick: () => sucursales.render()
                },
                {
                    id: "tab-clausules",
                    tab: "Clausulas",
                    lucideIcon: "file-text",
                    iconColor: "text-white",
                    onClick: () => clausulas.ls()
                },
            ],
        });
    }

    renderActiveTab() {
        usuarios.render();
        sucursales.render();
        company.render();
        clausulas.render();
    }
}

class Company extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Companies";
    }

    render() {
        this.layoutCompanies();
    }

    async layoutCompanies() {
        let data = await useFetch({
            url: api,
            data: { opc: 'init' }
        });

        let companie = data.companies;
        $("#container-tab-company").html(`
            <div class="grid md:grid-cols-[180px_1fr] gap-8">
                <div class=" rounded-lg md:p-6 lg:p-8">
                    <div class="flex flex-col items-center gap-4">
                        <div class="relative">
                            <div class="w-48 h-48 rounded-full bg-slate-700 border-4 border-slate-600 flex items-center justify-center overflow-hidden">
                                <img
                                    src="https://huubie.com.mx/alpha/src/img/logo/huubie.svg"
                                    alt="Foto de perfil"
                                    class="w-full h-full object-cover"
                                    id="logo"
                                />
                            </div>
                            <button class="absolute bottom-2 right-2 rounded-full w-10 h-10 p-0 bg-blue-700 hover:bg-blue-800 flex items-center justify-center" id="btnEditLogo">
                                <i class="icon-pencil text-white text-sm"></i>
                            </button>
                            <input type="file" accept="image/*" id="inputLogoUpload" class="hidden" />
                        </div>
                    </div>
                </div>
                <div class=" rounded-lg md:p-6 lg:p-8" id="container-info-companies">
                    <form id="formCompanies" novalidate></form>
                </div>
            </div>
        `);

        if (companie.id) {
            let fotito = 'https://huubie.com.mx/alpha' + companie.logo;
            $('#logo').attr('src', fotito);
        }

        // Activar input file al hacer clic en el botón
        $('#btnEditLogo').on('click', function () {
            $('#inputLogoUpload').click();
        });

        // Subir imagen y mostrar preview
        $('#inputLogoUpload').on('change', async function (e) {
            let file = e.target.files[0];
            if (!file) return;

            let url = URL.createObjectURL(file);
            $('#logo').attr('src', url);

            let formData = new FormData();
            formData.append('opc', 'editPhotoCompany');
            formData.append('id', companie.id);
            const fileC = $('#inputLogoUpload')[0].files[0];
            if (fileC) {
                formData.append('logo', fileC); // ✅ Asegura que sea con el mismo nombre usado en PHP ($_FILES['photo'])
            }

            Swal.fire({
                title: 'Subiendo imagen...',
                text: 'Por favor, espera un momento. 😊',
                background: '#1f2937',
                color: '#f9fafb',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            fetch(api, {
                method: 'POST',
                body: formData
            }).then(response => {
                Swal.close();
                if (response.status == 200) {
                    alert({ icon: "success", title: "Éxito", text: response.message, btn1: true, btn1Text: "Ok" });
                } else {
                    alert({ icon: "error", title: "Oops!...", text: response.message, btn1: true, btn1Text: "Ok" });
                }
            }).catch(error => {
                console.error('Error:', error);
                alert({ icon: "error", title: "Error", text: "No se pudo completar la solicitud." });
            });
        });

        this.createForm({
            parent: "formCompanies",
            id: "formPerfilUsuario2",
            data: { opc: "editCompany", id: companie.id },
            autofill: companie,
            json: [
                {
                    opc: "input",
                    lbl: '<i class="icon-building mr-2"></i> Nombre de la compañía',
                    id: "social_name",
                    class: "col-12 col-sm-6 col-md-4 col-lg-6 mb-3",
                },
                {
                    opc: "input",
                    lbl: '<i class="icon-location mr-2"></i> Ubicación',
                    id: "ubication",
                    class: "col-12 col-sm-6 col-md-4 col-lg-6 mb-3",
                },
                {
                    opc: "input",
                    lbl: '<i class="icon-location mr-2"></i> Dirección',
                    id: "address",
                    class: "col-12 col-sm-6 col-md-4 col-lg-6 mb-3",
                },
                {
                    opc: "input",
                    lbl: '<i class="icon-user mr-2"></i> RFC ',
                    id: "rfc",
                    class: "col-12 col-sm-6 col-md-4 col-lg-6 mb-3",
                },
                {
                    opc: "input",
                    lbl: '<i class="icon-phone mr-2"></i> Teléfono',
                    id: "phone",
                    class: "col-12 col-sm-6 col-md-4 col-lg-6 mb-3",
                },
                {
                    opc: "btn-submit",
                    id: "btnGuardarPerfil",
                    text: "Actualizar datos",
                    class: "col-sm-4 offset-md-8",
                },
            ],
            success: (res) => {
                if (res.status == 200) {
                    alert({ icon: "success", text: res.message });
                } else {
                    alert({ icon: "error", title: 'Oops...', text: res.message, btn1: true, btn1Text: 'Ok' });
                }
            },
        });
    }
}

class Usuarios extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Usuarios";

    }

    render() {
        this.layout();
    }

    layout() {
        const container = $("#container-tab-usuarios");
        container.html('<div id="filterbar-usuarios" class="mb-2"></div><div id="tabla-usuarios" class="row"></div>');

        this.createfilterBar({
            parent: "filterbar-usuarios",
            data: [
                {
                    opc: "select",
                    id: "active",
                    class: "col-12 col-md-3",
                    data: [
                        { id: "1", valor: "Activos" },
                        { id: "0", valor: "Inactivos" }
                    ],
                    'onchange': 'usuarios.ls()'
                },
                {
                    opc: "select",
                    id: "filterSucursal",
                    class: "col-12 col-md-3",
                    data: [{ id: "", valor: "Todas las sucursales" }, ...sucursal],
                    'onchange': 'usuarios.ls()'
                },
                {
                    opc: "button",
                    class: "col-12 col-md-3",
                    id: "btnNuevoUsuario",
                    text: "Nuevo Usuario",
                    onClick: () => this.add(),
                },
            ],
        });

        this.ls();
    }

    json(mode = 'add') {
        return [
            {
                opc: "select",
                lbl: "Rol",
                id: "usr_rols_id",
                class: "col-12 mb-3",
                data: rol,
            },
            {
                opc: "select",
                lbl: "Sucursales asignadas",
                id: "subsidiaries_id",
                class: "col-12 mb-3",
                data: sucursal,
            },
            {
                opc: "input",
                lbl: "Nombre completo",
                id: "fullname",
                class: "col-12 mb-3",
                required: true
            },
            {
                opc: "input",
                lbl: "Usuario (correo electrónico)",
                id: "user",
                class: "col-12 mb-3",
                type: "email",
                placeholder: 'Ej. luis@huubie.com',
                oninput: "this.value=this.value.toLowerCase().replace(/[^a-z0-9._%+\\-@]/g,'')",
                required: true
            },
            {
                opc: "input-group",
                lbl: mode === 'edit' ? 'Nueva contraseña (vacío = sin cambio)' : 'Contraseña',
                id: "key",
                icon: "icon-key",
                type: "password",
                class: "col-12 mb-3 ",
                required: mode === 'add'
            },
        ];
    }

    ls() {
        const filterSub = $('#filterSucursal').val() || '';
        this.createTable({
            parent: "tabla-usuarios",
            idFilterBar: "filterbar-usuarios",
            coffeesoft: true,
            data: { opc: "lsUsers", idCompany: idCompany, filterSucursal: filterSub },
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbUsuarios",
                theme: 'dark'
            },
        });
    }

    _renderSucursalChips(containerId, selectedIds = []) {
        const $container = $(`#${containerId}`);
        $container.empty();
        sucursal.forEach(s => {
            const isSelected = selectedIds.includes(String(s.id));
            const chip = $(`<span class="d-inline-flex align-items-center me-1 mb-1 px-3 py-1 rounded-pill text-sm cursor-pointer user-select-none ${isSelected ? 'bg-primary text-white fw-semibold' : 'text-light'}" data-sub-id="${s.id}" style="cursor:pointer;${isSelected ? '' : 'opacity:.5;'}">
                ${s.valor}${isSelected ? ' <span class="ms-1" style="cursor:pointer;">&times;</span>' : ''}
            </span>`);
            chip.on('click', () => {
                const idx = selectedIds.indexOf(String(s.id));
                if (idx > -1) selectedIds.splice(idx, 1);
                else selectedIds.push(String(s.id));
                this._renderSucursalChips(containerId, selectedIds);
            });
            $container.append(chip);
        });
        $container.data('selected', selectedIds);
        $('#subsidiaries_id').val(selectedIds.join(','));
    }

    _injectChips(chipsId, selectedIds = []) {
        const $select = $('#subsidiaries_id');
        $select.replaceWith(`
            <input type="hidden" id="subsidiaries_id" name="subsidiaries_id" value="${selectedIds.join(',')}">
            <div id="${chipsId}" class="bg-[#1F2A37] border border-secondary rounded p-2 d-flex flex-wrap"></div>
        `);
        this._renderSucursalChips(chipsId, selectedIds);
    }

    add() {
        this.createModalForm({
            id: "formModalUsuario",
            data: { opc: "addUser" },
            bootbox: { title: "<strong>Nuevo Usuario</strong>" },
            json: this.json('add'),
            success: (res) => {
                if (res.status === 200) {
                    alert({ icon: 'success', text: res.message });
                    this.ls();
                } else {
                    alert({ icon: 'error', title: 'Oops...', text: res.message, btn1: true, btn1Text: 'Ok' });
                }
            },
        });

        this._injectChips('add_sucursales_chips', []);
    }

    async editar(id) {
        const res = await useFetch({ url: this._link, data: { opc: "getUser", id: id } });
        const u = res.data;
        const currentSubs = u.subsidiaries_id ? String(u.subsidiaries_id).split(',').map(s => s.trim()) : [];

        this.createModalForm({
            id: "formModalUsuario",
            data: { opc: "editUser", id },
            bootbox: { title: "<strong>Editar Usuario</strong>" },
            autofill: u,
            json: this.json('edit'),
            success: (res) => {
                if (res.status === 200) {
                    alert({ icon: 'success', text: res.message });
                    this.ls();
                } else {
                    alert({ icon: 'error', title: 'Oops...', text: res.message, btn1: true, btn1Text: 'Ok' });
                }
            },
        });

        this._injectChips('edit_sucursales_chips', currentSubs);
    }

    toggleStatus(id, active) {
        let tr = $(event.target).closest("tr");
        let title = tr.find("td").eq(0).text();
        let accion = active == 1 ? "activar" : "desactivar";

        this.swalQuestion({
            opts: {
                title: `¿Deseas ${accion} al usuario ${title}?`
            },
            data: {
                opc: "toggleStatusUser",
                active: active,
                id: id,
            },
            methods: {
                request: (response) => {
                    if (response.status == 200) {
                        alert({ icon: "success", text: response.message });
                        this.ls();
                    } else {
                        alert({ icon: "error", text: response.message });
                    }
                }
            }
        });
    }
}

class Sucursales extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Sucursales";
    }

    render() {
        this.layout();
    }

    layout() {
        const container = $("#container-tab-sucursales");
        container.html('<div id="filterbar-sucursales" class="mb-2"></div><div id="tabla-sucursales"></div>');

        this.createfilterBar({
            parent: "filterbar-sucursales",
            data: [
                {
                    opc: "select",
                    id: "active",
                    class: "col-12 col-md-3",
                    data: [
                        { id: "1", valor: "Activos" },
                        { id: "0", valor: "Inactivos" }
                    ],
                    'onchange': 'sucursales.ls()'
                },
                {
                    opc: "button",
                    class: "col-12 col-md-3",
                    id: "btnNuevaSucursal",
                    text: "Nueva Sucursal",
                    onClick: () => this.add(),
                },
            ],
        });

        this.ls();
    }

    json() {
        return [
            {
                opc: "input",
                lbl: "Nombre de la sucursal",
                id: "name",
                class: "col-12 mb-3",
                tipo: "texto",
                required: true,
            },
            {
                opc: "input",
                lbl: "Ubicación",
                id: "ubication",
                class: "col-12 mb-3",
                tipo: "texto",
                required: true,
            },
        ]
    }

    ls() {
        this.createTable({
            parent: "tabla-sucursales",
            idFilterBar: "filterbar-sucursales",
            data: { opc: "lsSucursales", idCompany: idCompany },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbSucursales",
                theme:'dark',
                hover:true
            },
        });
    }

    add() {
        this.createModalForm({
            id: "formModalSucursal",
            data: { opc: "addSucursal" },

            bootbox: {
                title: "<strong>Nueva Sucursal</strong>",
            },
            json: this.json(),
            success: (res) => {
                if (res.status === 200) {
                    alert({ icon: "success", text: res.message });
                    this.ls();
                } else {
                    alert({ icon: "error", title: 'Oops...', text: res.message, btn1: true, btn1Text: 'Ok' });
                }
            },
        });
    }

    async edit(id) {
        const res = await useFetch({ url: this._link, data: { opc: "getSucursal", id } });
        this.createModalForm({
            id: "formModalSucursal",
            data: { opc: "editSucursal", id },
            bootbox: {
                title: "<strong>Editar Sucursal</strong>",
            },
            autofill: res.data,
            json: this.json(),
            autofill: res.data,
            success: (res) => {
                if (res.status === 200) {
                    alert({ icon: "success", text: res.message });
                    this.ls();
                } else {
                    alert({ icon: "error", title: 'Oops...', text: res.message, btn1: true, btn1Text: 'Ok' });
                }
            },
        });
    }

    toggleStatus(id, active) {
        let tr = $(event.target).closest("tr");
        let title = tr.find("td").eq(0).text();
        let accion = active === 1 ? "activar" : "desactivar";

        this.swalQuestion({
            opts: {
                title: `¿Deseas ${accion} la sucursal ${title}?`
            },
            data: {
                opc: "toggleStatusSucursal",
                active: active,
                id: id,
            },
            methods: {
                request: (response) => {
                    if (response.status === 200) {
                        alert({ icon: "success", text: response.message });
                        this.ls();
                    } else {
                        alert({ icon: "error", text: response.message });
                    }
                }
            }
        });
    }
}

class Clausulas extends Templates {
    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = "Clausulas";
    }

    render() {
        this.layout();
    }

    layout() {
        const container = $("#container-tab-clausules");
        container.html('<div id="filterbar-clausules" class="mb-2"></div><div id="tabla-clausules"></div>');

        this.createfilterBar({
            parent: "filterbar-clausules",
            data: [
                {
                    opc: "select",
                    id: "active",
                    class: "col-12 col-md-3",
                    data: [
                        { id: "1", valor: "Activos" },
                        { id: "0", valor: "Inactivos" }
                    ],
                    'onchange': 'clausulas.ls()'
                },
                {
                    opc: "button",
                    class: "col-12 col-md-3",
                    id: "btnNuevaClausula",
                    text: "Nueva Clausula",
                    onClick: () => clausulas.add(),
                },
            ],
        });

        clausulas.ls();
    }

    json() {
        return [
            {
                opc: "input",
                lbl: "Nombre de la clausula",
                placeholder: "1. No ingresar al área de cocina.",
                id: "name",
                class: "col-12 mb-3",
                tipo: "texto",
                required: true,
            },

        ]
    }

    ls() {
        this.createTable({
            parent: "tabla-clausules",
            idFilterBar: "filterbar-clausules",
            data: { opc: "lsClausulas", idCompany: idCompany },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbClausules",
                theme:'dark'
            },
        });
    }

    add() {
        this.createModalForm({
            id: "formModalClausula",
            data: { opc: "addClausula" },
            bootbox: {
                title: "<strong>Nueva Clausula</strong>",
            },
            json: this.json(),
            success: (res) => {
                if (res.status === 200) {
                    alert({ icon: "success", text: res.message });
                    this.ls();
                } else {
                    alert({ icon: "error", title: 'Oops...', text: res.message, btn1: true, btn1Text: 'Ok' });
                }
            },
        });
    }

    async edit(id) {
        const res = await useFetch({ url: this._link, data: { opc: "getClausula", id } });
        this.createModalForm({
            id: "formModalClausula",
            data: { opc: "editClausula", id },
            bootbox: {
                title: "<strong>Editar Clausula</strong>",
            },
            autofill: res.data,
            json: this.json(),
            success: (res) => {
                if (res.status === 200) {
                    alert({ icon: "success", text: res.message });
                    this.ls();
                } else {
                    alert({ icon: "error", title: 'Oops...', text: res.message, btn1: true, btn1Text: 'Ok' });
                }
            },
        });
    }

    toggleStatus(id, active) {
        let tr = $(event.target).closest("tr");
        let title = tr.find("td").eq(0).text();
        let accion = active === 1 ? "activar" : "desactivar";

        this.swalQuestion({
            opts: {
                title: `¿Deseas ${accion} la clausula ${title}?`
            },
            data: {
                opc: "toggleStatusClausula",
                active: active,
                id: id,
            },
            methods: {
                request: (response) => {
                    if (response.status === 200) {
                        alert({ icon: "success", text: response.message });
                        this.ls();
                    } else {
                        alert({ icon: "error", text: response.message });
                    }
                }
            }
        });
    }
}

// function auxiliar

function validarPassword(input) {
    const messageId = "msg-password";
    const $input = $(input);
    const $inputGroup = $input.closest(".input-group");
    const $form = $("#formModalUsuario");

    // Eliminar mensaje previo si existe
    $inputGroup.next("#" + messageId).remove();

    if (input.value.length < 5) {
        // Mostrar mensaje justo después del bloque input-group
        $("<div>", {
            id: messageId,
            class: "text-red-500 text-sm mt-1",
            text: "⚠️ La contraseña debe tener al menos 5 caracteres.",
        }).insertAfter($inputGroup);

        // Bloquear el botón Aceptar
        $form.find("#btnSuccess").prop("disabled", true);
    } else {
        // Quitar mensaje de error
        $inputGroup.next("#" + messageId).remove();

        // Habilitar el botón Aceptar
        $form.find("#btnSuccess").prop("disabled", false);
    }
}
