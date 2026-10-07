// -- Themes --

// Temas del navbar, como la sección "Personalización" de erp-pro/pro/app/dev.
// Un tema pinta la barra superior, el acento y el primario, y elige el fondo
// de la página: el gris claro de siempre o uno de los dos oscuros.
class Themes extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'Themes';
        this.options = {};
        this.assistant = new ThemeAssistant(link, divModule);
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
        this.assistant.mount(modal, 'formThemeAdd', true);
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
        this.assistant.mount(modal, 'formThemeEdit', false);
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
            midnight: '#0B1420',
            rose: '#1A1216'
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

        // CoffeeIA (ThemeAssistant) cambia los campos por código: esto vuelve a
        // medir qué colores siguen ligados, repinta los recuadros y la muestra.
        $form.data('themePreview', {
            refresh: () => {
                linked    = this.hexOf($accent.val(), '') === this.hexOf($primary.val(), '');
                linkedSec = this.hexOf($accent.val(), '') === this.hexOf($secondary.val(), '');
                $hex.add($accent).add($primary).add($secondary).trigger('sync');
                paint();
            }
        });

        paint();
    }

    // Pone un <input type="color"> chico DENTRO del campo hexadecimal, a la
    // izquierda, y los mantiene iguales en los dos sentidos. El evento 'sync'
    // repinta solo el recuadro cuando otro campo le cambia el valor por código.
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

// -- Theme Assistant --

// "Crear con CoffeeIA" del editor de temas: el chat de CoffeeIA (ia-chat.js)
// montado dentro del modal. Propone el tema desde una descripción o el logo de
// la marca; lo que se aprueba pasa al formulario y lo guarda el Aceptar de siempre.
class ThemeAssistant extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'ThemeAssistant';
        this.seq       = 0;
        this.chat      = null;
        this.modal     = null;
        this.watcher   = null;
        this.formId    = '';
        this.isNew     = false;
        this.proposals = {};
    }

    // Cada modal trae su chat: nace con el primer clic y se va con el modal
    // (cfModal quita su capa del body al cerrar). El id cambia por modal para
    // que una respuesta que llegue tarde no caiga en el chat del siguiente.
    mount(modal, formId, isNew) {
        this.destroy();

        if (!modal || !modal.el) return;

        this.seq++;
        this.modal     = modal;
        this.formId    = formId;
        this.isNew     = isNew;
        this.proposals = {};

        modal.el.attr('id', `themeModal${this.seq}`);
        $(`#${formId}`).prepend(this.launcher());
        if (window.lucide) lucide.createIcons();

        this.watcher = new MutationObserver(() => {
            if (!document.body.contains(modal.el[0])) this.destroy();
        });
        this.watcher.observe(document.body, { childList: true });
    }

    render() {
        if (!this.modal) return;

        if (!this.chat) {
            this.chat = this.iaChat({
                parent:      `themeModal${this.seq}`,
                id:          `chat${this.PROJECT_NAME}${this.seq}`,
                title:       'CoffeeIA',
                subtitle:    'Temas a partir de tu marca',
                placeholder: 'Describe la marca o adjunta su logo…',
                accept:      '.png,.jpg,.jpeg,.webp',
                maxFiles:    2,
                welcome:     'Descríbeme la marca o súbeme su logo y te propongo los colores. Nada se guarda hasta que le des Aceptar al tema.',
                suggestions: [
                    'Cafetería artesanal: café tostado y verde olivo',
                    'Navidad: rojo y dorado con la barra oscura',
                    'Tecnología: azul eléctrico y la página oscura'
                ],
                labels: {
                    attach:       'Adjuntar el logo',
                    attachHint:   'Logo o foto de la marca (PNG, JPG o WEBP)',
                    readingImage: 'Midiendo los colores…'
                },
                actions: {
                    tema:    { label: 'Tema',    tone: 'bg-gray-100 text-gray-700' },
                    barra:   { label: 'Barra',   tone: 'bg-sky-100 text-sky-700' },
                    colores: { label: 'Colores', tone: 'bg-violet-100 text-violet-700' },
                    pagina:  { label: 'Página',  tone: 'bg-amber-100 text-amber-700' }
                },
                onAttach:  (file) => this.readMarca(file),
                onSend:    (text, adjuntos, historial) => this.askTheme(text, adjuntos, historial),
                onConfirm: (token, ids) => this.applyTheme(token, ids)
            });
        }

        this.chat.toggle();

        // En la siguiente tarea: la primera vez Tailwind (CDN) aún no compila el
        // ancho del chat y el panel mide toda la pantalla.
        if (this.chat.isOpen()) setTimeout(() => this.dock(), 0);
    }

    // El botón va arriba del formulario: es lo primero que se ve al abrirlo.
    launcher() {
        return $('<button>', {
            type: 'button',
            class: 'col-span-12 mb-1 flex items-center gap-3 w-full px-3 py-2 rounded-lg border border-dashed border-blue-300 bg-blue-50/50 text-left transition-colors hover:bg-blue-50 hover:border-blue-400 dark:bg-blue-900/20 dark:border-blue-700 dark:hover:bg-blue-900/30'
        }).append(
            $('<span>', { class: 'w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0' })
                .append($('<i>', { 'data-lucide': 'sparkles', class: 'w-4 h-4' })),
            $('<span>', { class: 'flex flex-col min-w-0 leading-tight' }).append(
                $('<span>', { class: 'text-[13px] font-semibold text-gray-800 dark:text-gray-100', text: 'Crear con CoffeeIA' }),
                $('<span>', { class: 'text-[11px] text-gray-500 dark:text-gray-400 truncate', text: 'Describe la marca o sube su logo y te propongo los colores' })
            ),
            $('<i>', { 'data-lucide': 'chevron-right', class: 'w-4 h-4 ml-auto text-gray-400 shrink-0' })
        ).on('click', () => this.render());
    }

    // Junto al modal, a su derecha, si cabe; si no, se queda al centro.
    dock() {
        if (!this.chat || !this.modal) return;

        const panel = this.modal.el.find('.cf-modal-panel')[0];
        const box   = document.getElementById(this.chat.opts.id);

        if (!panel || !box) return;

        const r    = panel.getBoundingClientRect();
        const left = r.right + 12;

        if (left + box.offsetWidth + 8 <= window.innerWidth) this.chat.place(left, r.top);
    }

    destroy() {
        if (this.watcher) this.watcher.disconnect();
        if (this.chat) this.chat.destroy();

        this.watcher = null;
        this.chat    = null;
        this.modal   = null;
    }

    // -- CRUD --

    // El logo se mide aquí y se describe en el servidor: los píxeles dan los hex
    // exactos (el modelo que ve solo los aproxima); el modelo dice qué es y qué
    // color manda. Si la descripción falla, los colores medidos bastan.
    async readMarca(file) {
        let bitmap = null;

        try {
            bitmap = await createImageBitmap(file);
        } catch (e) {
            bitmap = null;
        }

        if (!bitmap) return { status: 415, message: 'No pude abrir esa imagen. Guárdala como PNG o JPG.' };

        const colores = this.paletteOf(bitmap);
        const foto    = await this.photoOf(bitmap, 1024);

        if (bitmap.close) bitmap.close();

        const vista       = foto ? await this.lookBrand(foto) : null;
        const descripcion = vista && vista.status === 200 && vista.data ? String(vista.data.texto || '') : '';

        if (!colores.list.length && !descripcion) {
            return { status: 422, message: (vista && vista.message) || 'No encontré colores en esa imagen.' };
        }

        const texto = ['COLORES MEDIDOS EN LOS PÍXELES (exactos; % de la parte visible que ocupa cada uno):'];

        colores.list.forEach((c) => texto.push(`- ${c.hex} · ${c.pct}%${c.tone ? ' · ' + c.tone : ''}`));
        if (colores.clear >= 5) texto.push(`Fondo transparente: ${colores.clear}% de la imagen.`);

        texto.push('', 'LO QUE SE VE (descripción; sus hexadecimales son aproximados):');
        texto.push(descripcion || `No se pudo describir${vista && vista.message ? ': ' + vista.message : '.'}`);

        return {
            status: 200,
            data: {
                clase:   'imagen',
                texto:   texto.join('\n'),
                detalle: `${colores.list.length} colores · ${descripcion ? 'descrita' : 'sin descripción'}`
            }
        };
    }

    async lookBrand(blob) {
        const data = new FormData();
        data.append('opc', 'readMarca');
        data.append('archivo', blob, 'marca.jpg');

        try {
            const response = await fetch(this._link, { method: 'POST', credentials: 'same-origin', body: data });
            return await response.json();
        } catch (e) {
            return { status: 500, message: 'el servidor no respondió' };
        }
    }

    async askTheme(text, adjuntos, historial) {
        const seq      = this.seq;
        const response = await useFetch({
            url: this._link,
            data: {
                opc:       'askTheme',
                mensaje:   text,
                adjuntos:  JSON.stringify(adjuntos),
                historial: JSON.stringify(historial),
                actual:    JSON.stringify(this.formValues()),
                nuevo:     this.isNew ? 1 : 0
            }
        });

        if (!response) return { status: 500, message: 'CoffeeIA no respondió. Inténtalo otra vez.' };

        // El chat solo deja confirmar con token. Aquí el servidor no guarda nada:
        // el token apunta a las filas, que se aplican en el formulario.
        if (seq === this.seq && response.status === 200 && Array.isArray(response.row) && response.row.length) {
            response.token = `tema${seq}_${Object.keys(this.proposals).length + 1}`;
            this.proposals[response.token] = response.row;
        }

        return response;
    }

    // Pasa al formulario lo marcado en la vista previa. Guardar es del Aceptar.
    applyTheme(token, ids) {
        const fields = ['name', 'color', 'mode', 'scheme', 'accent', 'primary_color', 'secondary_color'];
        const $form  = $(`#${this.formId}`);
        const rows   = (this.proposals[token] || []).filter((r) => r.valid && ids.includes(r.idx) && fields.includes(r.field));

        if (!$form.length || !rows.length) return { status: 409, message: 'Esa propuesta ya no está vigente. Pídemela otra vez.' };

        rows.forEach((r) => this.flash($form.find(`[name="${r.field}"]`).val(r.value)));

        const preview = $form.data('themePreview');
        if (preview) preview.refresh();

        return {
            status:  200,
            message: `Listo, ${rows.length === 1 ? 'pasé 1 cambio' : `pasé ${rows.length} cambios`} al formulario. Revísalo y dale Aceptar para guardar el tema.`
        };
    }

    // -- Complements --

    formValues() {
        const $form = $(`#${this.formId}`);
        const v     = {};

        ['name', 'tipo', 'color', 'mode', 'scheme', 'accent', 'primary_color', 'secondary_color'].forEach((k) => {
            v[k] = $form.find(`[name="${k}"]`).val() || '';
        });

        return v;
    }

    // Los colores de la imagen: cubetas de 16 niveles por canal y luego se juntan
    // las cercanas (el antialias y los degradados no son colores aparte).
    paletteOf(bitmap) {
        const px    = this.pixelsOf(bitmap, 96);
        const cubos = new Map();
        let opacos  = 0;

        for (let i = 0; i < px.length; i += 4) {
            if (px[i + 3] < 128) continue;

            const key = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
            const c   = cubos.get(key) || { n: 0, r: 0, g: 0, b: 0 };

            c.n++;
            c.r += px[i];
            c.g += px[i + 1];
            c.b += px[i + 2];
            cubos.set(key, c);
            opacos++;
        }

        const total = px.length / 4;
        const clear = total ? Math.round((total - opacos) / total * 100) : 0;

        if (!opacos) return { list: [], clear: clear };

        const grupos = [];

        [...cubos.values()].sort((a, b) => b.n - a.n).forEach((c) => {
            const rgb = [c.r / c.n, c.g / c.n, c.b / c.n];
            const g   = grupos.find((x) => Math.hypot(x.rgb[0] - rgb[0], x.rgb[1] - rgb[1], x.rgb[2] - rgb[2]) < 40);

            if (!g) {
                grupos.push({ rgb: rgb, n: c.n });
                return;
            }

            const n = g.n + c.n;
            g.rgb = g.rgb.map((v, k) => (v * g.n + rgb[k] * c.n) / n);
            g.n   = n;
        });

        const list = grupos
            .sort((a, b) => b.n - a.n)
            .filter((g) => g.n / opacos >= 0.01)
            .slice(0, 6)
            .map((g) => ({ hex: this.hexFromRgb(g.rgb), pct: Math.round(g.n / opacos * 100), tone: this.toneOf(g.rgb) }));

        return { list: list, clear: clear };
    }

    pixelsOf(bitmap, max) {
        const cv = this.canvasOf(bitmap, max, '');

        try {
            return cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        } catch (e) {
            return [];
        }
    }

    // La foto para el modelo que ve: encogida y en JPEG sobre blanco (un logo con
    // transparencia se ve como en una barra clara) para no chocar con el tope de subida.
    photoOf(bitmap, max) {
        const cv = this.canvasOf(bitmap, max, '#FFFFFF');

        return new Promise((resolve) => {
            try {
                cv.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
            } catch (e) {
                resolve(null);
            }
        });
    }

    canvasOf(bitmap, max, fondo) {
        const k   = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
        const cv  = document.createElement('canvas');

        cv.width  = Math.max(1, Math.round(bitmap.width * k));
        cv.height = Math.max(1, Math.round(bitmap.height * k));

        const ctx = cv.getContext('2d');

        if (fondo) {
            ctx.fillStyle = fondo;
            ctx.fillRect(0, 0, cv.width, cv.height);
        }

        ctx.drawImage(bitmap, 0, 0, cv.width, cv.height);

        return cv;
    }

    hexFromRgb(rgb) {
        return '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase();
    }

    // Los neutros se marcan: casi siempre son el fondo del logo, no color de marca.
    toneOf(rgb) {
        const max    = Math.max(...rgb) / 255;
        const min    = Math.min(...rgb) / 255;
        const luz    = (max + min) / 2;
        const croma  = max - min;

        if (luz >= 0.9 && croma < 0.12) return 'casi blanco';
        if (luz <= 0.12) return 'casi negro';
        if (croma < 0.08) return 'gris';

        return '';
    }

    // Marca un momento los campos que cambió CoffeeIA.
    flash($field) {
        $field.addClass('ring-2 ring-blue-300');
        setTimeout(() => $field.removeClass('ring-2 ring-blue-300'), 1600);
    }
}
