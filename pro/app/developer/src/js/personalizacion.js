let api = 'ctrl/ctrl-temas.php';
let app, themes, coffeeIAConfig;

$(() => {
    themes         = new Themes('ctrl/ctrl-temas.php', 'root');
    coffeeIAConfig = new CoffeeIAConfig('ctrl/ctrl-coffeeia.php', 'root');

    app = new App(api, 'root');
    app.render();
});

// -- App --

class App extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Personalizacion';
    }

    render() {
        this.layout();
        this.headerBar({ parent: `header${this.PROJECT_NAME}` });
        this.renderTabs();
        this.renderActiveTab();
    }

    layout() {
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id: this.PROJECT_NAME,
                class: 'flex flex-col mx-2 flex-1',
                container: [
                    { type: 'div', id: `header${this.PROJECT_NAME}`, class: 'w-full' },
                    { type: 'div', id: `container${this.PROJECT_NAME}`, class: 'w-full rounded p-2 flex-1 min-h-0 flex flex-col' }
                ]
            }
        });
    }

    headerBar(options) {
        $(`#${options.parent}`).empty().append(
            $('<div>', { class: 'flex items-center gap-3 px-2 pt-2 pb-2' }).append(
                $('<div>', { class: 'flex items-center justify-center w-11 h-11 rounded-xl bg-blue-50 text-blue-600' })
                    .append($('<i>', { 'data-lucide': 'palette', class: 'w-6 h-6' })),
                $('<div>').append(
                    $('<h2>', { class: 'text-2xl font-semibold tracking-tight', text: 'Personalización' }),
                    $('<p>', { class: 'text-sm text-gray-400', text: 'Temas de la barra y configuración de CoffeeIA' })
                )
            )
        );
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    renderTabs() {
        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id: `tabs${this.PROJECT_NAME}`,
            theme: 'light',
            type: 'button',
            content: { class: 'flex-1 min-h-0 flex flex-col' },
            json: [
                {
                    id: 'grp-personalizacion',
                    tab: 'Temas',
                    lucideIcon: 'palette',
                    class: 'p-3 flex-1 min-h-0 flex flex-col',
                    active: true,
                    onClick: () => themes.render()
                },
                {
                    id: 'grp-coffeeia',
                    tab: 'CoffeeIA',
                    lucideIcon: 'sparkles',
                    class: 'p-3 flex-1 min-h-0 flex flex-col',
                    onClick: () => coffeeIAConfig.render()
                }
            ]
        });
    }

    renderActiveTab() {
        themes.render();
    }
}

// -- Themes --

// Temas del navbar, como la sección "Personalización" de erp-pro/pro/app/dev.
// Un tema pinta la navbar, la sidebar (opcional), el acento y el primario, y
// elige el fondo de la página: el gris claro de siempre o uno de los oscuros.
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
                center: [6, 7, 8],
                right: []
            }
        });
    }

    addTheme() {
        const modal = this.createModalForm({
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

        const modal = this.createModalForm({
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
                lbl: 'Navbar: ¿cómo es el fondo?',
                data: this.options.tipos || [],
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'select',
                id: 'mode',
                lbl: 'Navbar: color del texto',
                data: this.options.modes || [],
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'color',
                lbl: 'Navbar: color de fondo',
                value: '#FFFFFF',
                placeholder: '#0F2740',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'input',
                id: 'sidebar_color',
                lbl: 'Sidebar: color de fondo',
                placeholder: 'Vacío = como la página',
                required: false,
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'select',
                id: 'scheme',
                lbl: 'Fondo de la página',
                data: this.options.schemes || [],
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
    // repinta con cada cambio: la barra, y debajo la sidebar junto a una
    // pestaña con el acento y un botón con el primario, que es lo que de verdad
    // se juzga.
    // El primario y el secundario SIGUEN al acento mientras sean iguales; si
    // se cambian a mano, se sueltan (así Claro conserva su grafito y Huubie su
    // morado aunque se toque el acento).
    mountThemePreview(formId, imageUrl) {
        const $form      = $(`#${formId}`);
        const $hex       = $form.find('[name="color"]');
        const $accent    = $form.find('[name="accent"]');
        const $primary   = $form.find('[name="primary_color"]');
        const $secondary = $form.find('[name="secondary_color"]');
        const $sidebar   = $form.find('[name="sidebar_color"]');
        const $tipo    = $form.find('[name="tipo"]');
        const $mode    = $form.find('[name="mode"]');
        const $scheme  = $form.find('[name="scheme"]');

        // Fondo de página de cada scheme (dark-mode.css / themes.css).
        const pages = {
            light: '#F3F4F6',
            huubie: '#111928',
            midnight: '#0B1420',
            rose: '#1A1216'
        };

        // La sidebar sin color propio: blanca en la clara, --dk-chrome en las oscuras (themes.css).
        const rails = {
            light: '#FFFFFF',
            huubie: '#141D2B',
            midnight: '#101B29',
            rose: '#1E1519'
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
        const $page   = $('<div>', { class: 'flex-1 px-4 py-3 flex items-center justify-between gap-2' })
            .append($tab, $button);

        // El primero va como activo, igual que la página donde se está. El borde va
        // en línea: el .border de Bootstrap trae !important y no dejaría cambiarle el color.
        const $railItems = ['house', 'package', 'settings'].map((icon) =>
            $('<span>', { class: 'w-8 h-8 rounded-lg flex items-center justify-center', style: 'border:1px solid transparent' })
                .append($('<i>', { 'data-lucide': icon, class: 'w-4 h-4' }))
        );
        const $rail  = $('<div>', { class: 'w-12 shrink-0 py-2 border-r flex flex-col items-center gap-1.5' }).append($railItems);
        const $frame = $('<div>', { class: 'mt-2 rounded-lg border border-gray-200 overflow-hidden flex' }).append($rail, $page);

        $form.append(
            $('<div>', { class: 'col-span-12 mb-2' }).append(
                $('<label>', { class: 'form-label fw-semibold', text: 'Así se verá' }),
                $bar,
                $frame
            )
        );

        if (window.lucide) lucide.createIcons();

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
            // Barra clara con color (rosa, menta...): tinta translúcida, como .nav-tinted de navbar.js.
            const tinted = !dark && !image && this.isTintedBar(color);

            $title.add($user).css('color', dark ? '#F8FAFC' : '#111827');
            $subtitle.css('color', dark ? 'rgba(255,255,255,.62)' : (tinted ? 'rgba(17,24,39,.72)' : '#9CA3AF'));

            // En barra oscura la píldora se vuelve translúcida, como en navbar.js;
            // en barra clara con color, blanca translúcida. En blanca lleva el secundario.
            if (dark) {
                $chip.css({ color: '#F8FAFC', background: 'rgba(255,255,255,.08)', borderColor: 'rgba(255,255,255,.18)' });
            } else if (tinted) {
                $chip.css({ color: '#111827', background: 'rgba(255,255,255,.22)', borderColor: 'rgba(255,255,255,.40)' });
            } else {
                $chip.css({ color: second, background: `${second}1F`, borderColor: `${second}47` });
            }

            $tab.css({ color: accent, background: `${accent}1A` });
            $button.css({ background: primary });
            $frame.css({ background: pages[$scheme.val()] || pages.light });

            paintRail(accent);
        };

        // Mismos tonos que themes.css (data-sidebar) y sidebar.css (rail de la página).
        const paintRail = (accent) => {
            const own    = this.hexOf($sidebar.val(), '');
            const scheme = rails[$scheme.val()] ? $scheme.val() : 'light';
            const tone   = own
                ? (window.InventoryPalette ? InventoryPalette.sidebarTone(own) : 'white')
                : (scheme === 'light' ? 'white' : 'page');
            const tones  = {
                white:  { ink: '#6B7280', line: '#E5E7EB', on: { color: accent, background: `${accent}1A`, borderColor: `${accent}1F` } },
                page:   { ink: '#9CA3AF', line: 'rgba(255,255,255,.08)', on: { color: accent, background: `${accent}2E`, borderColor: `${accent}38` } },
                tinted: { ink: 'rgba(17,24,39,.62)', line: 'rgba(0,0,0,.10)', on: { color: '#111827', background: 'rgba(255,255,255,.70)', borderColor: 'rgba(255,255,255,.85)' } },
                dark:   { ink: 'rgba(255,255,255,.68)', line: 'rgba(0,0,0,.10)', on: { color: '#FFFFFF', background: 'rgba(255,255,255,.16)', borderColor: 'rgba(255,255,255,.20)' } }
            };
            const t      = tones[tone] || tones.white;
            const bg     = own || rails[scheme];

            $rail.css({ background: bg, borderRightColor: t.line });
            $railItems.forEach(($item, i) => {
                $item.css(i === 0 ? t.on : { color: t.ink, background: 'transparent', borderColor: 'transparent' });
            });

            // Vacío, el selector muestra el color que se está viendo (no el negro del navegador).
            if (!own) $sidebarPicker.val(bg);
        };

        this.mountColorPicker($hex, paint);
        const $sidebarPicker = this.mountColorPicker($sidebar, paint);
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

        // Quien cambie los campos por código (en inventory, el asistente de
        // CoffeeIA) llama a refresh(): vuelve a medir qué colores siguen
        // ligados, repinta los recuadros y la muestra.
        $form.data('themePreview', {
            refresh: () => {
                linked    = this.hexOf($accent.val(), '') === this.hexOf($primary.val(), '');
                linkedSec = this.hexOf($accent.val(), '') === this.hexOf($secondary.val(), '');
                $hex.add($accent).add($primary).add($secondary).add($sidebar).trigger('sync');
                paint();
            }
        });

        paint();
    }

    // Pone un <input type="color"> chico DENTRO del campo hexadecimal, a la
    // izquierda, y los mantiene iguales en los dos sentidos. El evento 'sync'
    // repinta solo el recuadro cuando otro campo le cambia el valor por código.
    // Devuelve el selector (la sidebar lo ajusta cuando su campo va vacío).
    mountColorPicker($hex, onChange) {
        const $picker = $('<input>', {
            type: 'color',
            title: 'Elegir color',
            class: 'absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 p-0 border-0 bg-transparent rounded-md cursor-pointer appearance-none '
                 + '[&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-black/15 '
                 + '[&::-moz-color-swatch]:rounded-md [&::-moz-color-swatch]:border-black/15'
        });
        const $row = $('<div>', { class: 'relative' });

        $hex.before($row);
        $row.append($picker, $hex);

        // Inline con !important: el px-3 de Bootstrap también lo lleva.
        $hex[0].style.setProperty('padding-left', '2.5rem', 'important');

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

        return $picker;
    }

    // #RGB se expande a #RRGGBB: el <input type="color"> solo acepta el largo.
    hexOf(value, fallback) {
        const v = String(value || '').trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(v)) return v.toUpperCase();
        if (/^#[0-9A-Fa-f]{3}$/.test(v)) return ('#' + v.slice(1).replace(/(.)/g, '$1$1')).toUpperCase();
        return fallback;
    }

    // Espejo de isTintedBar() de navbar.js: casi blanco (#F5F5F5) cuenta como blanca.
    isTintedBar(hex) {
        return [1, 3, 5].some((i) => parseInt(hex.substr(i, 2), 16) < 235);
    }
}

// -- CoffeeIAConfig --

// Configuración básica de coffeeIA (encendido, tono, modelos y esfuerzo). Vive al
// lado de los temas, en Personalización.
class CoffeeIAConfig extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'CoffeeIA';
        this.options = {};
    }

    async render() {
        if ($(`#filterBar${this.PROJECT_NAME}`).length) return;

        this.options = await useFetch({ url: this._link, data: { opc: 'init' } }) || {};
        this.layout();
        this.filterBar();
        this.lsCoffeeIAConfig();
    }

    layout() {
        $('#container-grp-coffeeia').html(`<div id="filterBar${this.PROJECT_NAME}" class="mb-2"></div><div id="container${this.PROJECT_NAME}"></div>`);
    }

    filterBar() {
        this.createfilterBar({
            parent: `filterBar${this.PROJECT_NAME}`,
            coffeesoft: true,
            data: [
                {
                    opc: 'button',
                    class: 'col-12 col-md-3',
                    id: 'btnEditCoffeeIA',
                    text: 'Editar configuración',
                    onClick: () => this.editCoffeeIA()
                }
            ]
        });
    }

    lsCoffeeIAConfig() {
        this.createTable({
            parent: `container${this.PROJECT_NAME}`,
            idFilterBar: `filterBar${this.PROJECT_NAME}`,
            data: { opc: 'lsCoffeeIAConfig' },
            coffeesoft: true,
            conf: { datatable: false },
            attr: {
                id: `tb${this.PROJECT_NAME}`,
                theme: 'light',
                striped: true,
                center: [],
                right: []
            }
        });
    }

    async editCoffeeIA() {
        const request = await useFetch({ url: this._link, data: { opc: 'getCoffeeIA' } });

        if (request.status !== 200) {
            alert({ icon: 'error', text: request.message || 'No se pudo cargar la configuración', btn1: true });
            return;
        }

        this.createModalForm({
            id: 'formCoffeeIAEdit',
            data: { opc: 'editCoffeeIA' },
            theme: 'light',
            coffeesoft: true,
            bootbox: { title: 'Configuración de coffeeIA' },
            autofill: request.data,
            json: this.jsonCoffeeIA(),
            success: (r) => afterSave(r, () => this.lsCoffeeIAConfig())
        });
    }

    jsonCoffeeIA() {
        return [
            {
                opc: 'select',
                id: 'active',
                lbl: 'Estado',
                data: [
                    {
                        id: '1',
                        valor: 'Encendido · disponible en los módulos que lo usen'
                    },
                    {
                        id: '0',
                        valor: 'Apagado · sin ícono ni chat de CoffeeIA en esos módulos'
                    }
                ],
                class: 'col-12 mb-3'
            },
            {
                opc: 'textarea',
                id: 'tone',
                lbl: 'Tono',
                placeholder: 'Ej. Amable y breve, tutea y usa palabras sencillas.',
                required: false,
                class: 'col-12 mb-3'
            },
            {
                opc: 'select',
                id: 'model',
                lbl: 'Modelo para razonamiento',
                data: this.options.modelos || [],
                class: 'col-12 mb-3'
            },
            {
                opc: 'select',
                id: 'effort',
                lbl: 'Esfuerzo',
                data: this.options.esfuerzos || [],
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc: 'select',
                id: 'vision_model',
                lbl: 'Modelo para imagen',
                data: this.options.visiones || [],
                class: 'col-12 col-md-6 mb-3'
            }
        ];
    }
}
