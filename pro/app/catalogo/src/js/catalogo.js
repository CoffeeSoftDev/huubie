let api = 'ctrl/ctrl-catalogo.php';
let app, products, categories, subcategories, modifierGroups, modifiers, bundles, paymentMethods, discounts;
let dataInit = {};

const CATALOGO_TAB_KEY = 'catalogo:tab:v1';

// -- Arranque --

$(async () => {
    dataInit = (await useFetch({ url: api, data: { opc: 'init' } })) || {};

    // Una pestaña cuyo archivo no se cargo simplemente no se crea.
    if (typeof Products === 'function')       products       = new Products('ctrl/ctrl-productos.php', 'root');
    if (typeof Categories === 'function')     categories     = new Categories('ctrl/ctrl-categorias.php', 'root');
    if (typeof Subcategories === 'function')  subcategories  = new Subcategories('ctrl/ctrl-subcategorias.php', 'root');
    if (typeof ModifierGroups === 'function') modifierGroups = new ModifierGroups('ctrl/ctrl-grupos-modificadores.php', 'root');
    if (typeof Modifiers === 'function')      modifiers      = new Modifiers('ctrl/ctrl-modificadores.php', 'root');
    if (typeof Bundles === 'function')        bundles        = new Bundles('ctrl/ctrl-paquetes.php', 'root');
    if (typeof PaymentMethods === 'function') paymentMethods = new PaymentMethods('ctrl/ctrl-metodos-pago.php', 'root');
    if (typeof Discounts === 'function')      discounts      = new Discounts('ctrl/ctrl-descuentos.php', 'root');

    app = new App(api, 'root');
    app.render();
});

// -- Pagina --

class App extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Catalogo';
        this.opened = {};
    }

    // Todo el catalogo depende de la sucursal: al cambiarla se vuelve a pintar completo.
    onBranchChange() {
        location.reload();
    }

    render() {
        this.layout();
        this.header();
        this.tabs();

        if (dataInit.status != 200) notify(dataInit);
    }

    layout() {
        $('#root').html(`
            <div class="cp-pagina flex flex-1 flex-col gap-[16px]">
                <div id="headerCatalogo"></div>
                <div id="tabbarCatalogo" class="flex flex-1 flex-col"></div>
            </div>
        `);
    }

    // La sucursal va resaltada: es la que manda en todo lo que se ve abajo.
    header() {
        const scope  = dataInit.scope || {};
        const branch = scope.branch ? `<span class="cp-pagina-sucursal">${esc(scope.branch)}</span>` : '';
        const where  = [scope.company ? esc(scope.company) : '', branch].filter(Boolean).join(' · ');

        $('#headerCatalogo').html(`
            <h1 class="cp-pagina-titulo">Catálogo</h1>
            <p class="cp-pagina-subtitulo">${where || 'Productos, precios y formas de cobro del punto de venta'}</p>
        `);
    }

    tabsList() {
        return [
            { id: 'products',       tab: 'Productos',               icon: 'package',            obj: () => products },
            { id: 'categories',     tab: 'Categorías',              icon: 'folder',             obj: () => categories },
            { id: 'subcategories',  tab: 'Subcategorías',           icon: 'folder-tree',        obj: () => subcategories },
            // Grupos y sus opciones en una sola pestaña: modifierGroups es su lista de la izquierda.
            { id: 'modifiers',      tab: 'Modificadores',           icon: 'sliders-horizontal', obj: () => modifiers },
            { id: 'bundles',        tab: 'Paquetes',                icon: 'gift',               obj: () => bundles },
            { id: 'paymentMethods', tab: 'Métodos de pago',         icon: 'credit-card',        obj: () => paymentMethods },
            { id: 'discounts',      tab: 'Descuentos',              icon: 'badge-percent',      obj: () => discounts }
        ];
    }

    // Prioridad: ?tab= en la URL, luego la ultima abierta, luego la primera.
    activeTab(list) {
        const exists = (id) => list.some((t) => t.id === id);
        const fromUrl = new URLSearchParams(location.search).get('tab');

        if (fromUrl && exists(fromUrl)) return fromUrl;

        let saved = null;
        try { saved = localStorage.getItem(CATALOGO_TAB_KEY); } catch (e) { saved = null; }

        if (saved && exists(saved)) return saved;

        return list.length ? list[0].id : null;
    }

    tabs() {
        const list   = this.tabsList().filter((t) => t.obj());
        const active = this.activeTab(list);
        const counts = dataInit.counts || {};

        this.csTabs({
            parent: 'tabbarCatalogo',
            id: 'tabsCatalogo',
            json: list.map((t) => ({
                id: t.id,
                tab: t.tab,
                icon: t.icon,
                count: counts[t.id],
                active: t.id === active,
                onClick: () => this.open(t.id)
            }))
        });

        // csTabs no dispara el onClick de la pestaña activa al crearse.
        if (active) this.open(active);
    }

    open(id) {
        const tab = this.tabsList().find((t) => t.id === id);
        const obj = tab ? tab.obj() : null;

        if (!obj) return;

        try { localStorage.setItem(CATALOGO_TAB_KEY, id); } catch (e) { /* sin storage solo no se recuerda */ }

        const url = new URL(location.href);
        url.searchParams.set('tab', id);
        history.replaceState(null, '', url);

        // Otra pestaña pudo cambiar sus datos: al volver se relee.
        if (this.opened[id]) {
            if (typeof obj.reopen === 'function') obj.reopen();
            else obj.ls();
            return;
        }

        this.opened[id] = true;
        obj.render();
    }
}

// -- Ayudantes compartidos por las pestañas --
// Los avisos y las preguntas van con el alertBox del framework, no con SweetAlert.

function notify(r) {
    if (r && r.status == 200) app.alertBox({ type: 'success', title: esc(r.message), timer: 1400 });
    else app.alertBox({ type: 'error', title: esc((r && r.message) || 'Ocurrió un error') });
}

// Aviso con un solo botón: 'warning' (falta algo) o 'message' (informativo).
function warnBox(text, type = 'warning') {
    app.alertBox({ type, title: esc(text) });
}

/*  Pregunta antes de mandar `data` al ctrl de la pestaña; si confirma, done(response)
    recibe la respuesta tal cual. danger: true pinta la advertencia roja (desactivar). */
function confirmSend(tab, { title, text, data, done, danger = false }) {
    tab.alertBox({
        type: danger ? 'cancel' : 'confirm',
        title: esc(title),
        detailHtml: esc(text),
        okLabel: 'Sí, continuar',
        onOk: async () => done(await useFetch({ url: tab._link, data }))
    });
}

function afterSave(response, reload) {
    notify(response);

    if (response && response.status == 200 && typeof reload === 'function') reload();
}

function esc(t) {
    return (t == null ? '' : String(t)).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function money(n) {
    return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// csModal no bloquea su boton: esto evita el doble guardado por doble clic.
async function saveFrom(modalId, request) {
    const btn = $(`#${modalId} .cs-modal-save`);

    if (btn.prop('disabled')) return;

    btn.prop('disabled', true);

    try {
        return await request();
    } finally {
        btn.prop('disabled', false);
    }
}

// -- Foto de producto --
// Las fotos subidas antes solo existen en producción: se reintenta ahí una vez.
// Si tampoco carga, queda el cuadro vacío (el mismo que pinta ctrl-productos sin foto).
const CATALOGO_FILES_REMOTE = 'https://huubie.com.mx';

// data-icon: el ícono del cuadro vacío (pastel en productos, regalo en paquetes).
function productPhotoError(img) {
    if (!img.dataset.fileFallback) {
        img.dataset.fileFallback = '1';
        img.src = CATALOGO_FILES_REMOTE + new URL(img.src, location.origin).pathname;
        return;
    }

    $(img).replaceWith(`<div class="cp-foto cp-foto-vacia"><i class="${esc(img.dataset.icon || 'icon-birthday')}"></i></div>`);
}

// La ruta guardada (pro_files/...) relativa a la raíz del sitio, como la pinta ctrl-productos.
function productPhotoUrl(path) {
    if (!path) return '';
    if (/^(https?:|data:)/i.test(path)) return path;

    return '/' + String(path).replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
}

// La foto lista para guardar: JPEG de máximo `max` px por lado (igual que inventory).
// Va sobre blanco para que lo transparente de un PNG no salga negro. "" si no se puede abrir.
function compressPhoto(file, max = 800) {
    return new Promise((resolve) => {
        if (!file || !/^image\//.test(file.type)) return resolve('');

        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
            const scale  = Math.min(1, max / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width  = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);

            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve('');
        };
        img.src = url;
    });
}

// -- Campo de foto (Productos y Paquetes) --
// Se achica en el navegador (compressPhoto) y viaja como dataURL en image_b64;
// image_remove = 1 la quita. Sin tocarla, los dos van vacíos y la foto se queda.

// Va en un bloque 'html' de csModal con id 'photoField'. El label lleva las clases de los de csModal.
function photoFieldHtml() {
    return `
        <label class="block text-xs font-semibold text-gray-500 mb-1.5">Foto</label>
        <div class="cp-foto-campo">
            <div class="cp-foto-thumb"></div>
            <div class="cp-foto-botones">
                <button type="button" class="cp-foto-subir"><i data-lucide="upload" class="w-4 h-4"></i><span>Subir foto</span></button>
                <button type="button" class="cp-foto-quitar hidden">Quitar</button>
            </div>
            <input type="file" accept="image/jpeg,image/png,image/webp" class="hidden">
        </div>
    `;
}

// Liga el #photoField del modal. Devuelve lo que viaja al guardar; se actualiza solo.
// icon: el del cuadro vacío, el mismo que pinta la tabla.
function mountPhoto(modalId, image = '', icon = 'icon-birthday') {
    const field = $(`#${modalId} #photoField`);
    const file  = field.find('input[type=file]');
    const photo = { image_b64: '', image_remove: 0 };

    const paint = (src) => {
        field.find('.cp-foto-thumb').html(src
            ? `<img src="${esc(src)}" alt="Foto" class="cp-foto" data-icon="${esc(icon)}" onerror="productPhotoError(this)">`
            : `<div class="cp-foto cp-foto-vacia"><i class="${esc(icon)}"></i></div>`);

        field.find('.cp-foto-subir span').text(src ? 'Cambiar foto' : 'Subir foto');
        field.find('.cp-foto-quitar').toggleClass('hidden', !src);
    };

    field.on('click', '.cp-foto-subir', () => file.trigger('click'));

    field.on('click', '.cp-foto-quitar', () => {
        Object.assign(photo, { image_b64: '', image_remove: 1 });
        paint('');
    });

    file.on('change', async () => {
        const picked = file[0].files[0];

        file.val('');

        if (!picked) return;

        const dataUrl = await compressPhoto(picked);

        if (!dataUrl) return warnBox('No se pudo leer la foto. Usa una imagen JPG, PNG o WEBP.');

        Object.assign(photo, { image_b64: dataUrl, image_remove: 0 });
        paint(dataUrl);
    });

    paint(productPhotoUrl(image));

    return photo;
}

// Foto a la izquierda y los campos `ids` a la derecha, en el lugar del primero.
// csModal los pinta uno tras otro; al guardar se leen por #id, así que moverlos no los pierde.
function photoBeside(modalId, ids) {
    const modal  = $(`#${modalId}`);
    const fields = ids.map((id) => modal.find(`#${id}`).closest('.flex-wrap > div')[0]);
    const row    = $('<div class="w-full cp-ident"></div>').insertBefore(fields[0]);

    row.append(
        $('<div class="cp-ident-foto"></div>').append(modal.find('#photoField')),
        $('<div class="cp-ident-campos flex flex-wrap"></div>').append(fields)
    );
}

function catalogoPlantilla() {
    warnBox('Es una plantilla de Huubie: la ven todas las empresas y no se edita.', 'message');
}
