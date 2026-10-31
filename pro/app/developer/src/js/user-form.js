// -- Formulario de usuario --
// El alta y la edición de un usuario (foto, color, dueño, sucursal a la que
// pertenece, acceso por sucursal con su rol y contraseña) que comparten
// Accesos › Usuarios y el detalle de una empresa en Facturación › Empresas.
// Habla con ctrl/ctrl-accesos.php (getUser, getCompanyAccess, addUser,
// editUser, toggleUser) desde las dos páginas.

// Tonos de avatar de las cuentas de Google y Microsoft: todos sostienen el
// ícono blanco con contraste de 4.5:1 o más. Mismos 10 en admin/accesos/js/accesos.js.
const USER_COLOR_PALETTE = [
    '#1A73E8', '#038387', '#188038', '#986F0B',
    '#CA5010', '#D93025', '#E3008C', '#8764B8',
    '#5C2E91', '#69797E'
];

/*  La foto del colaborador se reduce a 320px y se entrega como dataURL: va a
    salir siempre dentro de un círculo de 64px o menos, y así el POST no carga
    con la foto original del celular. */
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

class UserForm extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'UserForm';
        // Sucursales y roles de la empresa del modal abierto; rows = {branch_id: role_id}.
        this.access = { branches: [], roles: [], rows: {} };
    }

    // companyId: el usuario nace en esa empresa y el modal abre con sus sucursales.
    // onSaved: cómo se refresca quien abrió el modal (la tabla de Usuarios o el
    // detalle de la empresa).
    async addUser(companyId = null, onSaved = () => {}) {
        if (!(dataInit.companies || []).length) {
            alert({ icon: 'info', text: 'Primero registra al menos una empresa activa', btn1: true });
            return;
        }

        const filter = String(companyId || '');
        const company = /^\d+$/.test(filter) ? filter : '';
        const options = company ? await this.fetchCompany(company) : { branches: [], roles: [] };
        if (!options) return;

        const modal = this.createModalForm({
            id: 'formUserAdd',
            data: { opc: 'addUser' },
            theme: 'light',
            coffeesoft: true,
            closeOnError: false,
            bootbox: { title: 'Nuevo Usuario', size: 'large' },
            autofill: company ? { company_id: company } : false,
            json: this.jsonUser(false, options.branches, false),
            success: (r) => afterSave(r, onSaved)
        });

        this.mountUserForm('formUserAdd', modal, { photo: '', color: null, options: options, access: [], isRoot: false, isOwner: false });
    }

    async editUser(id, onSaved = () => {}) {
        const request = await useFetch({ url: this._link, data: { opc: 'getUser', id: id } });
        if (!request || request.status !== 200) {
            alert({ icon: 'error', text: (request && request.message) || 'No se pudo cargar el usuario', btn1: true });
            return;
        }

        const data = request.data;
        const name = `${data.name || ''} ${data.last_name || ''}`.trim();

        const modal = this.createModalForm({
            id: 'formUserEdit',
            data: { opc: 'editUser', id: id },
            theme: 'light',
            coffeesoft: true,
            closeOnError: false,
            bootbox: {
                title: name ? `Editar Usuario · <span class="text-blue-600 font-bold">${esc(name)}</span>` : 'Editar Usuario',
                size: 'large'
            },
            autofill: data,
            json: this.jsonUser(true, request.options.branches, request.isRoot),
            success: (r) => afterSave(r, onSaved)
        });

        this.mountUserForm('formUserEdit', modal, {
            photo: data.photo_url || '',
            color: data.color || null,
            options: request.options,
            access: request.access || [],
            isRoot: request.isRoot,
            isOwner: Number(data.is_owner) === 1
        });
    }

    toggleUser(id, active, onSaved = () => {}) {
        const action = active == 1 ? 'activar' : 'desactivar';
        this.swalQuestion({
            opts: {
                title: `¿${active == 1 ? 'Activar' : 'Desactivar'} usuario?`,
                text: `¿Deseas ${action} este usuario?`,
                icon: 'warning'
            },
            data: { opc: 'toggleUser', id: id, active: active },
            methods: { send: (r) => afterSave(r, onSaved) }
        });
    }

    mountUserForm(formId, modal, cfg) {
        this.renderPhotoPicker(formId, cfg.photo, cfg.color);
        this.renderColorSwatches(formId, cfg.color);
        this.mountOwnerField(formId, cfg.isOwner);
        this.mountAccess(formId, cfg);
        this.guardPasswordMatch(modal);
        this.mountPasswordEyes();
    }

    // Dueño de la empresa: paga la suscripción y entra a todas sus sucursales.
    // Viaja como 1/0 en el hidden is_owner: una casilla sin marcar no viajaría.
    // root no lleva el hueco (no tiene empresa) y el ctrl le deja el suyo.
    mountOwnerField(formId, isOwner) {
        const $wrap = $(`#${formId}`).find('#ownerWrap');
        if (!$wrap.length) return;

        const $input = $('<input>', { type: 'hidden', name: 'is_owner', value: isOwner ? 1 : 0 });
        const $check = $('<input>', { type: 'checkbox', class: 'w-4 h-4 mt-0.5 accent-blue-600 cursor-pointer shrink-0', checked: !!isOwner })
            .on('change', (e) => $input.val(e.currentTarget.checked ? 1 : 0));

        $wrap.empty().append(
            $('<label>', { class: 'flex items-start gap-2.5 p-3 rounded-xl ring-1 ring-inset ring-gray-200 cursor-pointer select-none mb-0' }).append(
                $check,
                $('<span>', { class: 'min-w-0' }).append(
                    $('<span>', { class: 'block text-sm font-semibold text-gray-800', text: 'Dueño de la empresa' }),
                    $('<span>', { class: 'block text-xs text-gray-400', text: 'Es quien paga la suscripción. Entra a todas las sucursales de su empresa.' })
                )
            ),
            $input
        );
    }

    // -- Acceso por sucursal --

    /*  Una fila por sucursal de la empresa: la casilla da acceso y el select dice
        con qué rol (admin en una, cajero en otra). Viaja como JSON en el hidden
        `access`. Cambiar la empresa trae sus sucursales y roles y empieza de cero;
        elegir la sucursal a la que pertenece la marca con acceso. */
    mountAccess(formId, cfg) {
        const $form = $(`#${formId}`);
        const $wrap = $form.find('#accessWrap');

        if (cfg.isRoot) {
            $wrap.html(accessNote('shield-check', 'Usuario de plataforma (root): entra a todas las empresas con acceso total. Aquí solo se editan sus datos; sus accesos no se tocan.'));
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        this.access = {
            branches: cfg.options.branches || [],
            roles: cfg.options.roles || [],
            rows: {}
        };
        (cfg.access || []).forEach((a) => { this.access.rows[a.branch_id] = String(a.role_id || ''); });

        $wrap.empty().append(
            $('<div>', { class: 'flex items-start justify-between gap-3 mb-2' }).append(
                $('<div>').append(
                    $('<p>', { class: 'text-sm font-semibold text-gray-800', text: 'Acceso por sucursal' }),
                    $('<p>', { class: 'text-xs text-gray-400', text: 'Marca a qué sucursales entra y con qué rol en cada una.' })
                ),
                $('<span>', { class: 'cs-access-count text-xs font-medium text-gray-500 shrink-0' })
            ),
            $('<div>', { id: `${formId}Access` }),
            $('<input>', { type: 'hidden', name: 'access' })
        );

        const $company = $form.find('#company_id');
        const $home = $form.find('#branch_id');

        $company.on('change', async () => {
            const id = String($company.val() || '');
            const options = /^\d+$/.test(id) && id !== '0' ? await this.fetchCompany(id) : null;

            this.access = {
                branches: options ? options.branches : [],
                roles: options ? options.roles : [],
                rows: {}
            };

            $home.empty().append($('<option>', { value: '0', text: 'Elige una sucursal' }));
            this.branchOptions(this.access.branches).forEach((b) => $home.append($('<option>', { value: b.id, text: b.valor })));

            this.renderAccess(formId);
        });

        $home.on('change', () => {
            const id = String($home.val() || '');
            if (id && id !== '0' && !(id in this.access.rows)) this.access.rows[id] = '';
            this.renderAccess(formId);
        });

        this.renderAccess(formId);
    }

    renderAccess(formId) {
        const $form = $(`#${formId}`);
        const $list = $(`#${formId}Access`).empty();
        const home = String($form.find('#branch_id').val() || '');
        const hasCompany = Number($form.find('#company_id').val()) > 0;

        if (!this.access.branches.length) {
            $list.append(accessNote('building-2', hasCompany
                ? 'Esta empresa no tiene sucursales. Créalas en Facturación › Empresas.'
                : 'Elige la empresa para ver sus sucursales.'));
        } else if (!this.access.roles.length) {
            $list.append(accessNote('users', 'Esta empresa no tiene roles que asignar. Créalos en Accesos › Roles y Permisos.'));
        } else {
            const box = $('<div>', { class: 'rounded-xl ring-1 ring-inset ring-gray-200 divide-y divide-gray-100 overflow-hidden' });
            this.access.branches.forEach((b) => box.append(this.accessRow(formId, b, home)));
            $list.append(box);
        }

        this.syncAccess(formId);
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    accessRow(formId, branch, home) {
        const id = String(branch.id);
        const on = id in this.access.rows;

        const check = $('<input>', { type: 'checkbox', class: 'w-4 h-4 accent-blue-600 cursor-pointer shrink-0', checked: on });

        const select = $('<select>', {
            class: this.cfThemedClass(CF_CSS.select, 'light') + ' py-1.5 disabled:opacity-50 disabled:cursor-not-allowed',
            disabled: !on,
            'aria-label': `Rol en ${branch.valor}`
        }).append($('<option>', { value: '', text: 'Elige un rol' }));

        this.access.roles.forEach((r) => select.append($('<option>', {
            value: r.id,
            text: Number(r.is_system) === 1 ? `${r.valor} (sistema)` : r.valor
        })));
        select.val(on ? this.access.rows[id] : '');

        check.on('change', () => {
            if (check.prop('checked')) this.access.rows[id] = String(select.val() || '');
            else delete this.access.rows[id];
            select.prop('disabled', !check.prop('checked'));
            this.syncAccess(formId);
        });

        select.on('change', () => {
            this.access.rows[id] = String(select.val() || '');
            this.syncAccess(formId);
        });

        const name = $('<label>', { class: 'flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer select-none mb-0' }).append(
            check,
            $('<span>', { class: 'text-sm font-medium text-gray-800 truncate', text: branch.valor })
        );
        if (id === home) name.append(this.tag('Pertenece', 'bg-blue-600/10 text-blue-700'));
        if (Number(branch.is_active) !== 1) name.append(this.tag('Inactiva', 'bg-amber-50 text-amber-700'));

        return $('<div>', { class: 'flex items-center gap-3 px-3 py-2' }).append(
            name,
            $('<div>', { class: 'w-44 shrink-0' }).append(select)
        );
    }

    syncAccess(formId) {
        const rows = Object.keys(this.access.rows).map((id) => ({
            branch_id: Number(id),
            role_id: Number(this.access.rows[id]) || 0
        }));
        const missing = rows.filter(r => !r.role_id).length;
        const total = this.access.branches.length;

        $(`#${formId} [name="access"]`).val(JSON.stringify(rows));
        $(`#${formId} .cs-access-count`).text(total
            ? `${rows.length} de ${total} ${total === 1 ? 'sucursal' : 'sucursales'}${missing ? ` · ${missing} sin rol` : ''}`
            : '');
    }

    async fetchCompany(companyId) {
        const request = await useFetch({ url: this._link, data: { opc: 'getCompanyAccess', company_id: companyId } });
        if (!request || request.status !== 200) {
            notify(request);
            return null;
        }
        return request;
    }

    branchOptions(list) {
        return (list || []).map((b) => ({
            id: b.id,
            valor: Number(b.is_active) === 1 ? b.valor : `${b.valor} (inactiva)`
        }));
    }

    tag(text, tone) {
        return $('<span>', { class: `px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0 ${tone}`, text: text });
    }

    // -- Foto del colaborador --

    /*  La foto NO viaja como archivo: createModalForm manda el formulario por
        useFetch, que arma un URLSearchParams, y ahí un File se vuelve
        "[object File]". Por eso la imagen se comprime en el navegador y se
        manda como dataURL en un campo de texto (`photo_b64`). `photo_clear`
        avisa cuando se quitó. Mismo widget que admin/accesos. */
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

    // root no lleva Empresa ni Sucursal: es de plataforma y sus accesos no se
    // editan aquí (ver editUser en el ctrl).
    jsonUser(isEdit, branchList, isRoot) {
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
                class: 'col-12 col-md-6 mb-3',
                required: false
            },
            {
                opc: 'input',
                id: 'email',
                lbl: 'Correo (con el que inicia sesión)',
                type: 'email',
                class: 'col-12 mb-3',
                required: true
            }
        ];

        if (!isRoot) {
            fields.push(
                {
                    opc: 'select',
                    id: 'company_id',
                    lbl: 'Empresa',
                    class: 'col-12 col-md-6 mb-3',
                    required: true,
                    select2: true,
                    selected: 'Elige una empresa',
                    data: dataInit.companies || []
                },
                {
                    opc: 'select',
                    id: 'branch_id',
                    lbl: 'Sucursal a la que pertenece',
                    class: 'col-12 col-md-6 mb-3',
                    required: true,
                    selected: 'Elige una sucursal',
                    data: this.branchOptions(branchList)
                },
                // Hueco vacío: lo rellena mountOwnerField() con la casilla de dueño.
                {
                    opc: 'div',
                    id: 'ownerWrap',
                    class: 'col-12 mb-3',
                    required: false
                }
            );
        }

        fields.push(
            // Hueco vacío: lo rellena mountAccess() con el acceso por sucursal.
            {
                opc: 'div',
                id: 'accessWrap',
                class: 'col-12 mb-3',
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
        );

        if (isEdit) {
            fields.push(
                {
                    opc: 'input',
                    id: 'password',
                    lbl: 'Nueva contraseña (vacío = no se modifica)',
                    type: 'password',
                    class: 'col-12 col-md-6 mb-3',
                    required: false
                },
                {
                    opc: 'input',
                    id: 'password_confirmation',
                    lbl: 'Confirmar nueva contraseña',
                    type: 'password',
                    class: 'col-12 col-md-6 mb-3',
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
                    class: 'col-12 col-md-6 mb-3',
                    required: true
                },
                {
                    opc: 'input',
                    id: 'password_confirmation',
                    lbl: 'Confirmar contraseña',
                    type: 'password',
                    class: 'col-12 col-md-6 mb-3',
                    required: true
                }
            );
        }

        return fields;
    }
}
