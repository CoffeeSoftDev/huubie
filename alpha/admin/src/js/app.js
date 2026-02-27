let api = "/alpha/admin/ctrl/ctrl-admin.php";
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
    }

    layout() {
        this.primaryLayout({
            parent: `root`,
            id: this.PROJECT_NAME,
            class: "flex mx-2 my-2 h-full mt-5 p-2",
            card: {
                filterBar: { class: "w-full my-3 ", id: "filterBar" + this.PROJECT_NAME },
                container: { class: "w-full my-3 h-auto bg-[#1F2A37] rounded-lg p-3", id: "container" + this.PROJECT_NAME },
            },
        });

        $("#containerAdmin").simple_json_tab({
            class: "pb-4 px-4 bg-[#1F2A37]",
            id: "tabss",
            data: [
                { tab: "Empresa", id: "tab-company", active: true },
                { tab: "Usuarios", id: "tab-usuarios" },
                { tab: "Sucursal", id: "tab-sucursales" },
                { tab: "Clausulas", id: "tab-clausules", onClick: () => clausulas.ls() },
            ],
        });

        $("#containerAdmin").prepend(`
            <div class="px-4 pt-3 pb-3">
                <h2 class="text-2xl font-semibold text-white">⚙️ Configuración de ${nameCompany}</h2>
                <p class="text-gray-400">Administra los datos de la empresa, los usuarios y sucursales de la aplicación.</p>
            </div>
        `);

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
        $("#tab-company").html(`
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
        const container = $("#tab-usuarios");
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

    json() {
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
                lbl: "Sucursal",
                id: "subsidiaries_id",
                class: "col-12 mb-3",
                data: sucursal,
            }, 
            {
                opc: "input",
                lbl: "Nombre completo",
                id: "fullname",
                class: "col-12 mb-3",
                tipo: "texto",
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
                lbl: "Contraseña",
                id: "key",
                icon: "icon-key",
                type: "password",
                onkeyup: "validarPassword(this)",
                class: "col-12",
                required: true
            },
        ]
    }

    ls() {
        this.createTable({
            parent: "tabla-usuarios",
            idFilterBar: "filterbar-usuarios",
            coffeesoft: true,
            data: { opc: "lsUsers", idCompany: idCompany },
            conf: { datatable: true, pag: 10 },
            attr: {
                id: "tbUsuarios",
                theme: 'dark'
            },
        });
    }

    add() {
        const rolOptions      = rol.map(r      => `<option value="${r.id}">${r.valor}</option>`).join('');
        const sucursalOptions = sucursal.map(s => `<option value="${s.id}">${s.valor}</option>`).join('');

        bootbox.dialog({
            title: '<strong>Nuevo Usuario</strong>',
            message: `
                <div class="row">
                    <div class="col-12 mb-3">
                        <label class="form-label">Rol</label>
                        <select class="form-select bg-[#1F2A37]" id="add_rol" required>
                            ${rolOptions}
                        </select>
                    </div>
                    <div class="col-12 mb-3">
                        <label class="form-label">Sucursal</label>
                        <select class="form-select bg-[#1F2A37]" id="add_sub" required>
                            ${sucursalOptions}
                        </select>
                    </div>
                    <div class="col-12 mb-3">
                        <label class="form-label">Nombre completo</label>
                        <input type="text" class="form-control bg-[#1F2A37]" id="add_fullname" placeholder="" required>
                    </div>
                    <div class="col-12 mb-3">
                        <label class="form-label font-bold">Usuario (correo electrónico)</label>
                        <input type="email" class="form-control bg-[#1F2A37]" id="add_user" placeholder="Ej. luis@huubie.com"
                            oninput="this.value=this.value.toLowerCase().replace(/[^a-z0-9._%+\\-@]/g,'')">
                    </div>
                    <div class="col-12 mb-3">
                        <label class="form-label font-bold">Contraseña</label>
                        <div class="input-group">
                            <span class="input-group-text"><i class="icon-key"></i></span>
                            <input type="password" class="form-control bg-[#1F2A37]" id="add_key">
                            <button type="button" class="btn btn-outline-secondary" id="add_toggle_key"
                                onclick="const i=$('#add_key');const t=i.attr('type')==='password';i.attr('type',t?'text':'password');$('#add_toggle_key i').toggleClass('icon-eye-off icon-eye');">
                                <i class="icon-eye-off"></i>
                            </button>
                        </div>
                        <div id="add_msg_pass" class="text-danger small mt-1"></div>
                    </div>
                </div>
            `,
            buttons: {
                cancelar: {
                    label: 'Cancelar',
                    className: 'btn-secondary',
                },
                guardar: {
                    label: 'Guardar',
                    className: 'btn-primary',
                    callback: () => {
                        const usr_rols_id     = $('#add_rol').val();
                        const subsidiaries_id = $('#add_sub').val();
                        const fullname        = $('#add_fullname').val().trim();
                        const user            = $('#add_user').val().trim();
                        const key             = $('#add_key').val();

                        if (!usr_rols_id || !subsidiaries_id || !fullname || !user || !key) {
                            alert({ icon: 'warning', text: 'Por favor completa todos los campos requeridos.' });
                            return false;
                        }

                        if (key.length < 5) {
                            alert({ icon: 'warning', text: 'La contraseña debe tener al menos 5 caracteres.' });
                            return false;
                        }

                        if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(user)) {
                            alert({ icon: 'warning', text: 'El usuario debe ser un correo electrónico válido.', btn1: true, btn1Text: 'Ok' });
                            return false;
                        }

                        $.ajax({
                            url: this._link,
                            method: 'POST',
                            data: { opc: 'addUser', usr_rols_id, subsidiaries_id, fullname, user, key },
                            success: (res) => {
                                if (res.status == 200) {
                                    bootbox.hideAll();
                                    alert({ icon: 'success', text: res.message });
                                    this.ls();
                                } else {
                                    alert({ icon: 'error', title: 'Oops...', text: res.message, btn1: true, btn1Text: 'Ok' });
                                }
                            },
                            dataType: 'json',
                        });
                        return false; // mantener modal abierto hasta que responda el servidor
                    }
                }
            }
        });

    }

    async editar(id) {
        
        const res = await useFetch({ url: this._link, data: { opc: "getUser", id: id } });
        const u   = res.data;

        const rolOptions = rol.map(r =>
            `<option value="${r.id}" ${r.id == u.usr_rols_id ? 'selected' : ''}>${r.valor}</option>`
        ).join('');

        const sucursalOptions = sucursal.map(s =>
            `<option value="${s.id}" ${s.id == u.subsidiaries_id ? 'selected' : ''}>${s.valor}</option>`
        ).join('');

        bootbox.dialog({
            title: '<strong>Editar Usuario</strong>',
            message: `
                <div class="row">
                    <div class="col-12 mb-3">
                        <label class="form-label">Rol</label>
                        <select class="form-select bg-[#1F2A37]" id="edit_rol" required>
                            ${rolOptions}
                        </select>
                    </div>
                    <div class="col-12 mb-3">
                        <label class="form-label">Sucursal</label>
                        <select class="form-select bg-[#1F2A37]" id="edit_sub" required>
                            ${sucursalOptions}
                        </select>
                    </div>
                    <div class="col-12 mb-3">
                        <label class="form-label">Nombre completo</label>
                        <input type="text" class="form-control bg-[#1F2A37]" id="edit_fullname"
                            value="${u.fullname ?? ''}" required>
                    </div>
                    <div class="col-12 mb-3">
                        <label class="form-label font-bold">Usuario (correo electrónico)</label>
                        <input type="email" class="form-control bg-[#1F2A37]" id="edit_user"
                            value="${u.user ?? ''}" placeholder="Ej. luis@huubie.com"
                            oninput="this.value=this.value.toLowerCase().replace(/[^a-z0-9._%+\\-@]/g,'')">
                    </div>
                    <div class="col-12 mb-3">
                        <label class="form-label font-bold">Nueva contraseña <span class="text-muted small">(dejar vacío para no cambiar)</span></label>
                        <div class="input-group">
                            <span class="input-group-text"><i class="icon-key"></i></span>
                            <input type="password" class="form-control bg-[#1F2A37]" id="edit_key">
                            <button type="button" class="btn btn-outline-secondary" id="edit_toggle_key"
                                onclick="const i=$('#edit_key');const t=i.attr('type')==='password';i.attr('type',t?'text':'password');$('#edit_toggle_key i').toggleClass('icon-eye-off icon-eye');">
                                <i class="icon-eye-off"></i>
                            </button>
                        </div>
                        <div id="edit_msg_pass" class="text-danger small mt-1"></div>
                    </div>
                </div>
            `,
            buttons: {
                cancelar: {
                    label: 'Cancelar',
                    className: 'btn-secondary',
                },
                guardar: {
                    label: 'Guardar',
                    className: 'btn-primary',
                    callback: () => {
                        const usr_rols_id     = $('#edit_rol').val();
                        const subsidiaries_id = $('#edit_sub').val();
                        const fullname        = $('#edit_fullname').val().trim();
                        const user            = $('#edit_user').val().trim();
                        const key             = $('#edit_key').val();

                        if (!usr_rols_id || !subsidiaries_id || !fullname || !user) {
                            alert({ icon: 'warning', text: 'Por favor completa todos los campos requeridos.' });
                            return false;
                        }

                        if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/.test(user)) {
                            alert({ icon: 'warning', text: 'El usuario debe ser un correo electrónico válido.' });
                            return false;
                        }

                        if (key && key.length < 5) {
                            alert({ icon: 'warning', text: 'La contraseña debe tener al menos 5 caracteres.' });
                            return false;
                        }

                        $.ajax({
                            url: this._link,
                            method: 'POST',
                            data: { opc: 'editUser', id, usr_rols_id, subsidiaries_id, fullname, user, key },
                            success: (res) => {
                                if (res.status == 200) {
                                    bootbox.hideAll();
                                    alert({ icon: 'success', text: res.message });
                                    this.ls();
                                } else {
                                    alert({ icon: 'error', title: 'Oops...', text: res.message, btn1: true, btn1Text: 'Ok' });
                                }
                            },
                            dataType: 'json',
                        });

                        return false;
                    }
                }
            }
        });
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
        const container = $("#tab-sucursales");
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
                theme: "dark",
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
        const container = $("#tab-clausules");
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
                theme: "dark",
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
