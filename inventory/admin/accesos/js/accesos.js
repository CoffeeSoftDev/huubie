let api = 'ctrl/ctrl-accesos.php';
let app, subsidiaries, users;
let statusFilter = [];
let sucursalesData = [];
let dataInit = {};

const USER_COLOR_PALETTE = [
    '#F4B8A4', '#A9CBD4', '#B8C4E0', '#B7D9A0',
    '#E8CBA0', '#C7B8E3', '#A3D0DE', '#E6B4C0',
    '#A6DDBF', '#E0C68A'
];

/*  La foto del colaborador se reduce a 320px y se entrega como dataURL: va a
    salir siempre dentro de un círculo de 64px o menos, y así el POST no carga
    con la foto original del celular. Mismo procedimiento que la evidencia de
    mermas, con el lado más chico porque aquí es un avatar. */
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
            class: 'px-2 pt-3 pb-3'
        });

        container.html(`
            <h2 class="text-2xl font-semibold">🏢 Administrador de Accesos</h2>
            <p class="text-gray-400">
                Empresa: <span class="font-semibold text-gray-600">${company}</span>
                · Tienes acceso a
                <span class="font-semibold text-gray-600">${total}</span>
                sucursal${total !== 1 ? 'es' : ''}
            </p>
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
        const modal = this.createModalForm({
            id: 'formUserAdd',
            data: { opc: 'addUser' },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Nuevo Usuario' },
            json: this.jsonUser(false),
            success: (r) => this._afterSave(r)
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
            autofill: data,
            json: this.jsonUser(true),
            success: (r) => this._afterSave(r)
        });
        this.injectSucursalChips('edit_sucursales_chips', branchIds);
        this.renderPhotoPicker('formUserEdit', data.photo_url || '', color);
        this.renderColorSwatches('formUserEdit', color);
        this.guardPasswordMatch(modal);
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
    }

    // jsonUser() pinta branch_ids como <select>; aqui se saca ese select y en
    // su lugar quedan el hidden que viaja al ctrl y la caja de chips (mismo
    // patron portado de admin/usuarios/js/admin.js, que a su vez viene de
    // app/admin/src/js/app.js).
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
        manda como dataURL en un campo de texto (`photo_b64`), igual que la
        evidencia de mermas. `photo_clear` avisa cuando se quitó. */
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
