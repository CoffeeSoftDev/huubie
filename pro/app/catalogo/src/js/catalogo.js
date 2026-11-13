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

    header() {
        const scope = dataInit.scope || {};
        const where = [scope.company, scope.branch].filter(Boolean).map(esc).join(' · ');

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
            { id: 'modifierGroups', tab: 'Grupos de modificadores', icon: 'layers',             obj: () => modifierGroups },
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

function notify(r) {
    if (r && r.status == 200) alert({ icon: 'success', text: r.message, timer: 1400 });
    else alert({ icon: 'error', text: (r && r.message) || 'Ocurrió un error', btn1: true });
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

function productPhotoError(img) {
    if (!img.dataset.fileFallback) {
        img.dataset.fileFallback = '1';
        img.src = CATALOGO_FILES_REMOTE + new URL(img.src, location.origin).pathname;
        return;
    }

    $(img).replaceWith('<div class="cp-foto cp-foto-vacia"><i class="icon-birthday"></i></div>');
}

function catalogoPlantilla() {
    alert({ icon: 'info', text: 'Es una plantilla de Huubie: la ven todas las empresas y no se edita.', btn1: true });
}
