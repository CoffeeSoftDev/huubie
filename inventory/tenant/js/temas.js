// -- Themes --

// Temas del navbar, como la sección "Personalización" de erp-pro/pro/app/dev.
// Un tema pinta la barra superior, el acento y el primario, y elige el fondo
// de la página: el gris claro de siempre o uno de los dos oscuros.
class Themes extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Themes';
        this.options = {};
    }

    async render() {
        if ($(`#filterBar${this.PROJECT_NAME}`).length) return;

        this.options = await useFetch({ url: this._link, data: { opc: 'init' } }) || {};
        this.layout();
        this.filterBar();
        this.lsThemes();
    }

    layout() {
        $('#container-grp-personalizacion').html(`<div id="filterBar${this.PROJECT_NAME}" class="mb-2"></div><div id="container${this.PROJECT_NAME}"></div>`);
    }

    filterBar() {
        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            coffeesoft: true,
            data: [
                {
                    opc: 'select',
                    id: 'active',
                    lbl: 'Estado',
                    class: 'col-12 col-md-2',
                    data: this.options.statusFilter || [],
                    onchange: 'themes.lsThemes()'
                },
                {
                    opc: 'button',
                    class: 'col-12 col-md-2',
                    id: 'btnNewTheme',
                    text: 'Nuevo tema',
                    onClick: () => this.addTheme()
                }
            ]
        });
    }

    lsThemes() {
        this.createTable({
            parent: `container${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: 'lsThemes' },
            coffeesoft: true,
            conf: { datatable: true, pag: 10 },
            attr: {
                id: `tb${this.PROJECT_NAME}`,
                theme: 'light',
                striped: true,
                center: [3, 6, 7, 8],
                right: []
            }
        });
    }

    addTheme() {
        this.createModalForm({
            id: 'formThemeAdd',
            data: { opc: 'addTheme' },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Nuevo tema' },
            json: this.jsonTheme(),
            success: (r) => afterSave(r, () => this.lsThemes())
        });

        this.mountThemePreview('formThemeAdd', '');
    }

    async editTheme(id) {
        const request = await useFetch({ url: this._link, data: { opc: 'getTheme', id: id } });

        if (request.status !== 200) {
            alert({ icon: 'error', text: request.message || 'No se pudo cargar el tema', btn1: true });
            return;
        }

        const data = request.data;

        this.createModalForm({
            id: 'formThemeEdit',
            data: { opc: 'editTheme', id: id },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: `Editar tema · <span class="text-blue-600 font-bold">${esc(data.name)}</span>` },
            autofill: data,
            json: this.jsonTheme(),
            success: (r) => afterSave(r, () => this.lsThemes())
        });

        this.mountThemePreview('formThemeEdit', data.image_url || '');
    }

    statusTheme(id, active) {
        this.swalQuestion({
            opts: {
                title: active == 1 ? '¿Activar tema?' : '¿Desactivar tema?',
                text: active == 1
                    ? 'Volverá a aparecer en el selector de la barra.'
                    : 'Desaparece del selector. Quien lo tenga puesto pasa al tema por defecto.',
                icon: 'warning'
            },
            data: { opc: 'statusTheme', id: id, active: active },
            methods: { send: (r) => afterSave(r, () => this.lsThemes()) }
        });
    }

    // El gesto de temporada: le cambia la barra a todos los que nunca han
    // elegido tema. A quien ya eligió no se le toca.
    defaultTheme(id) {
        this.swalQuestion({
            opts: {
                title: '¿Poner por defecto?',
                text: 'Será el tema de todos los que nunca han elegido el suyo. A quien ya eligió no se le cambia nada.',
                icon: 'question'
            },
            data: { opc: 'defaultTheme', id: id },
            methods: { send: (r) => afterSave(r, () => this.lsThemes()) }
        });
    }

    // La imagen va por FormData y fetch directo: useFetch serializa con
    // URLSearchParams y un File se vuelve "[object File]".
    uploadTheme(id) {
        const input = $('<input>', {
            type: 'file',
            accept: 'image/jpeg,image/png,image/webp'
        });

        input.on('change', async () => {
            const file = input[0].files && input[0].files[0];
            if (!file) return;

            const fd = new FormData();
            fd.append('opc', 'uploadTheme');
            fd.append('id', id);
            fd.append('file', file);

            let response = null;
            try {
                const r = await fetch(this._link, { method: 'POST', credentials: 'same-origin', body: fd });
                response = await r.json();
            } catch (e) {
                response = { status: 500, message: 'No se pudo subir la imagen' };
            }

            afterSave(response, () => this.lsThemes());
        });

        input.trigger('click');
    }

    jsonTheme() {
        return [
            {
                opc: 'input',
                id: 'name',
                lbl: 'Nombre',
                placeholder: 'Navidad 2026',
                class: 'col-12 col-md-8 mb-3'
            },
            {
                opc: 'input',
                id: 'orden',
                lbl: 'Orden',
                type: 'number',
                value: '4',
                class: 'col-12 col-md-4 mb-3'
            },
            {
                opc: 'select',
                id: 'tipo',
                lbl: '¿Cómo es el fondo?',
                data: this.options.tipos || [],
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'select',
                id: 'mode',
                lbl: 'Color del texto',
                data: this.options.modes || [],
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'color',
                lbl: 'Color de fondo',
                value: '#FFFFFF',
                placeholder: '#0F2740',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'badge',
                lbl: 'Etiqueta',
                placeholder: 'NUEVO',
                required: false,
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'select',
                id: 'scheme',
                lbl: 'Fondo de la página',
                data: this.options.schemes || [],
                class: 'col-12 mb-3'
            },
            {
                opc: 'input',
                id: 'accent',
                lbl: 'Acento (pestañas, chips)',
                value: '#C05A40',
                placeholder: '#C05A40',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'primary_color',
                lbl: 'Primario (botones)',
                value: '#C05A40',
                placeholder: '#292524',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'secondary_color',
                lbl: 'Secundario (sucursal, foco, hover)',
                value: '#C05A40',
                placeholder: '#7C3AED',
                class: 'col-12 col-md-6 mb-3'
            }
        ];
    }

    // -- Vista previa --

    // Selector de color nativo junto a cada hexadecimal y una muestra que se
    // repinta con cada cambio: la barra, y debajo una pestaña con el acento y
    // un botón con el primario, que es lo que de verdad se juzga.
    // El primario y el secundario SIGUEN al acento mientras sean iguales; si
    // se cambian a mano, se sueltan (así Claro conserva su grafito y Huubie su
    // morado aunque se toque el acento).
    mountThemePreview(formId, imageUrl) {
        const $form      = $(`#${formId}`);
        const $hex       = $form.find('[name="color"]');
        const $accent    = $form.find('[name="accent"]');
        const $primary   = $form.find('[name="primary_color"]');
        const $secondary = $form.find('[name="secondary_color"]');
        const $tipo    = $form.find('[name="tipo"]');
        const $mode    = $form.find('[name="mode"]');
        const $scheme  = $form.find('[name="scheme"]');

        // Fondo de página de cada scheme (dark-mode.css / themes.css).
        const pages = {
            light: '#F3F4F6',
            huubie: '#111928',
            midnight: '#0B1420'
        };

        let linked    = this.hexOf($accent.val(), '') === this.hexOf($primary.val(), '');
        let linkedSec = this.hexOf($accent.val(), '') === this.hexOf($secondary.val(), '');

        const $title    = $('<span>', { class: 'text-[15px] font-bold leading-tight', text: 'CoffeeSoft' });
        const $subtitle = $('<span>', { class: 'text-[10px] uppercase tracking-[.12em]', text: 'Vista previa' });
        const $user     = $('<span>', { class: 'text-[13px] font-semibold', text: 'Usuario' });
        const $chip     = $('<span>', { class: 'text-[12px] font-bold px-2.5 py-1 rounded-lg border', text: 'Sucursal' });
        const $bar      = $('<div>', { class: 'h-14 rounded-lg border border-gray-200 px-4 flex items-center justify-between' })
            .append(
                $('<div>', { class: 'flex flex-col' }).append($title, $subtitle),
                $('<div>', { class: 'flex items-center gap-3' }).append($chip, $user)
            );

        const $tab    = $('<span>', { class: 'text-[12px] font-semibold px-3 py-1.5 rounded-lg', text: 'Pestaña activa' });
        const $button = $('<span>', { class: 'text-[12px] font-semibold px-4 py-1.5 rounded-lg text-white', text: 'Botón primario' });
        const $page   = $('<div>', { class: 'mt-2 rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between' })
            .append($tab, $button);

        $form.append(
            $('<div>', { class: 'col-span-12 mb-2' }).append(
                $('<label>', { class: 'form-label fw-semibold', text: 'Así se verá' }),
                $bar,
                $page
            )
        );

        const paint = () => {
            const color   = this.hexOf($hex.val(), '#FFFFFF');
            const accent  = this.hexOf($accent.val(), '#C05A40');
            const primary = this.hexOf($primary.val(), '#292524');
            const second  = this.hexOf($secondary.val(), accent);
            const dark    = $mode.val() === 'dark';
            const image   = $tipo.val() === 'imagen' && imageUrl ? imageUrl : '';
            // Mismo velo que applyTheme() de navbar.js (aquí no se carga en modo embebido).
            const veil    = dark ? 'rgba(20, 22, 28, .34)' : 'rgba(255, 255, 255, .55)';

            $bar.css({
                background: image ? `url("${image}") center/cover no-repeat, ${color}` : color,
                boxShadow: image ? `inset 0 0 0 9999px ${veil}` : 'none'
            });
            $title.add($user).css('color', dark ? '#F8FAFC' : '#111827');
            $subtitle.css('color', dark ? 'rgba(255,255,255,.62)' : '#9CA3AF');

            // En barra oscura la píldora se vuelve translúcida, como en navbar.js.
            // En clara lleva el secundario, que es el color de la barra.
            $chip.css(dark
                ? { color: '#F8FAFC', background: 'rgba(255,255,255,.08)', borderColor: 'rgba(255,255,255,.18)' }
                : { color: second, background: `${second}1F`, borderColor: `${second}47` });

            $tab.css({ color: accent, background: `${accent}1A` });
            $button.css({ background: primary });
            $page.css({ background: pages[$scheme.val()] || pages.light });
        };

        this.mountColorPicker($hex, paint);
        this.mountColorPicker($primary, () => {
            linked = this.hexOf($accent.val(), '') === this.hexOf($primary.val(), '');
            paint();
        });
        this.mountColorPicker($secondary, () => {
            linkedSec = this.hexOf($accent.val(), '') === this.hexOf($secondary.val(), '');
            paint();
        });
        this.mountColorPicker($accent, () => {
            if (linked)    $primary.val($accent.val()).trigger('sync');
            if (linkedSec) $secondary.val($accent.val()).trigger('sync');
            paint();
        });

        $tipo.add($mode).add($scheme).on('change', paint);

        paint();
    }

    // Pone un <input type="color"> junto al campo hexadecimal y los mantiene
    // iguales en los dos sentidos. El evento 'sync' repinta solo el recuadro
    // cuando otro campo le cambia el valor por código.
    mountColorPicker($hex, onChange) {
        const $picker = $('<input>', {
            type: 'color',
            class: 'w-11 h-[38px] rounded-md border border-gray-300 bg-white p-0.5 cursor-pointer shrink-0'
        });
        const $row = $('<div>', { class: 'flex items-center gap-2' });

        $hex.before($row);
        $row.append($picker, $hex);

        const syncPicker = () => {
            const hex = this.hexOf($hex.val(), '');
            if (/^#[0-9A-Fa-f]{6}$/.test(hex)) $picker.val(hex);
        };

        $picker.on('input', () => {
            $hex.val($picker.val().toUpperCase());
            onChange();
        });
        $hex.on('input', () => {
            syncPicker();
            onChange();
        });
        $hex.on('sync', syncPicker);

        syncPicker();
    }

    // #RGB se expande a #RRGGBB: el <input type="color"> solo acepta el largo.
    hexOf(value, fallback) {
        const v = String(value || '').trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toUpperCase();
        if (/^#[0-9A-Fa-f]{3}$/.test(v)) return ('#' + v.slice(1).replace(/(.)/g, '$1$1')).toUpperCase();
        return fallback;
    }
}
