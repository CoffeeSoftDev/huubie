// -- Catálogo de insumos --
// Inventarios › inv-catalogo: lo que se compra y se cuenta. Mismo estilo y misma
// lógica que el Catálogo de venta (CRUD multi-entidad de CoffeeSoft): título,
// pestañas con contador (csTabs) y una clase por pestaña en src/js/catalogo/,
// cada una con su ctrl. Esta página las instancia y abre solo la activa.
// Comunes de Inventarios (can, invEsc, invBlocked...) en inventarios.js.

let api = 'ctrl/ctrl-catalogo.php';
let app, productos, insumos, grupos, unidades, almacenes, areas, proveedores, tiposEntrada, motivosSalida, estados, estadosReq, departamentos;
let dataInit = {};

const CATALOGO_INSUMOS_TAB_KEY = 'inv-catalogo:tab:v1';

// -- Arranque --

$(async () => {
    dataInit = (await useFetch({ url: api, data: { opc: 'init' } })) || {};

    if (dataInit.status !== 200) return invBlocked(dataInit.message);

    INV_ACTIONS = dataInit.actions || [];

    // Una pestaña cuyo archivo no se cargó simplemente no se crea.
    if (typeof Productos === 'function')       productos     = new Productos('ctrl/ctrl-productos.php', 'root');
    if (typeof Insumos === 'function')        insumos       = new Insumos('ctrl/ctrl-insumos.php', 'root');
    if (typeof Grupos === 'function')          grupos        = new Grupos('ctrl/ctrl-grupos.php', 'root');
    if (typeof Unidades === 'function')        unidades      = new Unidades('ctrl/ctrl-unidades.php', 'root');
    if (typeof Almacenes === 'function')       almacenes     = new Almacenes('ctrl/ctrl-almacenes.php', 'root');
    if (typeof Areas === 'function')           areas         = new Areas('ctrl/ctrl-areas.php', 'root');
    if (typeof Proveedores === 'function')     proveedores   = new Proveedores('ctrl/ctrl-proveedores.php', 'root');
    if (typeof TiposEntrada === 'function')    tiposEntrada  = new TiposEntrada('ctrl/ctrl-tipos-entrada.php', 'root');
    if (typeof MotivosSalida === 'function')   motivosSalida = new MotivosSalida('ctrl/ctrl-motivos-salida.php', 'root');
    if (typeof EstadosTraspaso === 'function') estados       = new EstadosTraspaso('ctrl/ctrl-estados-traspaso.php', 'root');
    if (typeof EstadosRequisicion === 'function') estadosReq = new EstadosRequisicion('ctrl/ctrl-estados-requisicion.php', 'root');
    if (typeof Departamentos === 'function')   departamentos = new Departamentos('ctrl/ctrl-departamentos.php', 'root');

    app = new App(api, 'root');
    app.render();
});

// -- Página --

class App extends Templates {

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'CatalogoInsumos';
        this.opened = {};
    }

    // Todo el catálogo depende de la sucursal: al cambiarla se vuelve a pintar completo.
    onBranchChange() {
        location.reload();
    }

    render() {
        this.layout();
        this.header();
        this.tabs();
    }

    // cp-tabs-juntas (inventarios.css): las diez pestañas un poco más juntas para que quepan en una fila.
    layout() {
        $('#root').html(`
            <div class="cp-pagina flex flex-1 flex-col gap-[16px]">
                <div id="headerCatalogo"></div>
                <div id="tabbarCatalogo" class="cp-tabs-juntas flex flex-1 flex-col"></div>
            </div>
        `);
    }

    // La sucursal va resaltada: es la que manda en todo lo que se ve abajo.
    header() {
        const scope  = dataInit.scope || {};
        const branch = scope.branch ? `<span class="cp-pagina-sucursal">${esc(scope.branch)}</span>` : '';
        const where  = [scope.company ? esc(scope.company) : '', branch].filter(Boolean).join(' · ');

        $('#headerCatalogo').html(`
            <h1 class="cp-pagina-titulo">Catálogo de insumos</h1>
            <p class="cp-pagina-subtitulo">${where || 'Lo que se compra y se cuenta: insumos, unidades, almacenes y proveedores'}</p>
        `);
    }

    // Doce pestañas: sin ícono para que quepan, como en la propuesta B.
    tabsList() {
        return [
            { id: 'productos',     tab: 'Productos',         obj: () => productos },
            { id: 'insumos',       tab: 'Insumos',           obj: () => insumos },
            { id: 'grupos',        tab: 'Grupos',            obj: () => grupos },
            { id: 'unidades',      tab: 'Unidades',          obj: () => unidades },
            { id: 'almacenes',     tab: 'Almacenes',         obj: () => almacenes },
            { id: 'areas',         tab: 'Áreas',             obj: () => areas },
            { id: 'proveedores',   tab: 'Proveedores',       obj: () => proveedores },
            { id: 'tiposEntrada',  tab: 'Tipos de entrada',  obj: () => tiposEntrada },
            { id: 'motivosSalida', tab: 'Motivos de salida', obj: () => motivosSalida },
            { id: 'estados',       tab: 'Estados traspaso',    obj: () => estados },
            { id: 'estadosReq',    tab: 'Estados requisición', obj: () => estadosReq },
            { id: 'departamentos', tab: 'Departamentos',       obj: () => departamentos }
        ];
    }

    // Prioridad: ?tab= en la URL, luego la última abierta, luego la primera.
    activeTab(list) {
        const exists  = (id) => list.some((t) => t.id === id);
        const fromUrl = new URLSearchParams(location.search).get('tab');

        if (fromUrl && exists(fromUrl)) return fromUrl;

        let saved = null;
        try { saved = localStorage.getItem(CATALOGO_INSUMOS_TAB_KEY); } catch (e) { saved = null; }

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

        try { localStorage.setItem(CATALOGO_INSUMOS_TAB_KEY, id); } catch (e) { /* sin storage solo no se recuerda */ }

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
// Los mismos del Catálogo de venta: avisos y preguntas con el alertBox del framework.

function esc(t) {
    return invEsc(t);
}

function notify(r) {
    if (r && r.status == 200) app.alertBox({ type: 'success', title: esc(r.message), timer: 1400 });
    else app.alertBox({ type: 'error', title: esc((r && r.message) || 'Ocurrió un error') });
}

// Aviso con un solo botón: 'warning' (falta algo) o 'message' (informativo).
function warnBox(text, type = 'warning') {
    app.alertBox({ type, title: esc(text) });
}

/*  Pregunta antes de mandar `data` al ctrl de la pestaña; si confirma, done(response)
    recibe la respuesta tal cual. danger: true pinta la advertencia roja (dar de baja). */
function confirmSend(tab, { title, text, data, done, danger = false, okLabel = 'Sí, continuar' }) {
    tab.alertBox({
        type: danger ? 'cancel' : 'confirm',
        title: esc(title),
        detailHtml: esc(text),
        okLabel,
        onOk: async () => done(await useFetch({ url: tab._link, data }))
    });
}

function afterSave(response, reload) {
    notify(response);

    if (response && response.status == 200 && typeof reload === 'function') reload();
}

// csModal no bloquea su botón: esto evita el doble guardado por doble clic.
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

// -- Piezas de cada pestaña --

// El select Estado (Activos / Inactivos) de la barra de filtros. tab: la global ('grupos').
function statusFilterField(tab) {
    return {
        opc: 'select',
        id: 'active',
        lbl: 'Estado',
        required: false,
        class: 'col-12 col-lg-2',
        data: dataInit.statusFilter || [],
        onchange: `${tab}.ls()`
    };
}

// El botón de alta, solo con la casilla «agregar».
function newButtonField(id, text, onClick) {
    if (!can('agregar')) return null;

    return { opc: 'button', id, class: 'col-12 col-lg-2', text, onClick };
}

// La tabla de cada pestaña, como las del Catálogo de venta.
function tableAttr(id, center = [], right = []) {
    return { id, theme: 'light', f_size: 12, design: 'flowbite', striped: true, center, right };
}

/*  Las insignias traen su ícono como <i data-lucide>: DataTables saca del
    documento las filas de las otras páginas y lucide no las alcanza. Cada vez
    que la tabla se vuelve a dibujar se pintan los que falten. */
function lucideOnDraw(containerId) {
    $(`#${containerId}`)
        .off('draw.dt.lucide')
        .on('draw.dt.lucide', () => { if (window.lucide) lucide.createIcons(); });
}

// Título de sección dentro de un csModal: un bloque 'html', no viaja en los values.
function formSection(id, text) {
    return { id, tipo: 'html', class: 'w-full cp-seccion', html: `<p>${esc(text)}</p>` };
}

// Nota gris con ícono dentro de un csModal.
function formNote(id, html) {
    return {
        id,
        tipo: 'html',
        class: 'w-full',
        html: `<div class="flex items-start gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-500"><i data-lucide="info" class="w-4 h-4 flex-shrink-0 mt-px"></i><span>${html}</span></div>`
    };
}

/*  Guarda lo del modal: opc del ctrl de la pestaña y, si sale bien, cierra,
    avisa y vuelve a leer la tabla. check(values) devuelve el texto de lo que
    falta o '' si está completo. */
function saveTab(tab, modalId, opc, values, close, check = () => '') {
    const missing = check(values);

    if (missing) return warnBox(missing);

    return saveFrom(modalId, async () => {
        const response = await useFetch({ url: tab._link, data: { opc, ...values } });

        if (response && response.status == 200) {
            close();
            afterSave(response, () => tab.ls());
        } else {
            notify(response);
        }
    });
}

// Dar de baja / reactivar. what: «el grupo», «la unidad».
function statusTab(tab, opc, id, active, what, offText = 'Deja de ofrecerse en las capturas. No se borra: lo reactivas desde «Inactivos».') {
    confirmSend(tab, {
        title: active ? `¿Activar ${what}?` : `¿Dar de baja ${what}?`,
        text: active ? 'Vuelve a ofrecerse en las capturas y en las fichas.' : offText,
        danger: !active,
        okLabel: active ? 'Activar' : 'Dar de baja',
        data: { opc, id, active },
        done: (response) => afterSave(response, () => tab.ls())
    });
}
