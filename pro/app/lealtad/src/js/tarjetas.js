/*  Lealtad › Tarjetas (antes Ventas › Puntos, V4 del plan de Ventas).

    Arriba, el resumen (infoCard): tarjetas activas y saldo en monederos, de
    hoy; ventas con tarjeta, descuento dado y puntos abonados, del mes.
    Dos pestañas: «Tipos de tarjeta», que es la que abre, es una galería: cada
    tipo es su tarjeta, lisa y de su color, con lo que da; debajo, cuántas
    tarjetas tiene, lo que vendió en el mes y sus botones (un clic en la tarjeta
    o «Ver tarjetas» abre la otra pestaña ya filtrada).
    «Tarjetas» es la lista del plástico (número, titular y, si se
    quiere, un cliente dueño), con filtro por tipo; «Ver tarjeta» abre su ficha
    de solo lectura: el dibujo, el cliente, sus cifras y sus últimas compras.
    Un tipo da descuento O puntos, nunca los dos; el ctrl también lo revisa.
    No se borra: se desactiva. Una tarjeta inactiva, o con su tipo inactivo,
    deja de leerse en «Vender».

    La tarjeta no guarda saldo: los puntos caen en el monedero del cliente y se
    gastan pagando con «Monedero». Leer la tarjeta al cobrar es de «Vender»;
    esta página solo las administra (hoy, solo el Dueño).

    Tarjeta digital (el QR de la fila o el botón de la ficha): un enlace que el
    cliente abre en su teléfono sin cuenta (tarjeta.php) y enseña en caja; su QR
    lleva el número, lo mismo que escribe el lector en Vender. La ventana usa
    qrcode-generator y ticketCopy / ticketPhone (los carga tarjetas.php).

    Los dos formularios llevan a la izquierda el dibujo de la tarjeta, que se
    repinta con lo que se escribe. Es un rectángulo de un solo color, sin
    recortes ni filos: el de su tipo (card_type.color); sin color, el celeste
    claro que manda el ctrl en dataInit.cardColor.

    Esta página no carga el detalle, el turno ni el cobro de Pedidos: esc(),
    money() y LOY_TABLE van aquí abajo, en «Ayudantes». */

let api = 'ctrl/ctrl-tarjetas.php';
let loyalty;
let dataInit = {};

$(async () => {
    dataInit = (await useFetch({ url: api, data: { opc: 'init' } })) || {};

    loyalty = new Loyalty(api, 'root');
    loyalty.init();
});

// -- Ayudantes --

// Texto seguro para meterlo en HTML.
function esc(t) {
    return (t == null ? '' : String(t)).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// $1,234.50. Con 0 da $0.00. El signo va antes del $: "-$55.00".
function money(n) {
    const value = Math.round(Number(n || 0) * 100) / 100;
    const text  = Math.abs(value).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (value < 0 ? '-' : '') + '$' + text;
}

// El color de las tablas de Catálogo con encabezado centrado y sin mayúsculas (el ORD_TABLE de Pedidos).
const LOY_TABLE = { design: 'flowbite', th_case: 'capitalize', th_align: 'center' };

// -- Loyalty --

class Loyalty extends Templates {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Loyalty';
        this.tab          = 'types';
        this.requests     = { cards: 0, types: 0, summary: 0 };
        this.pageLength   = { cards: 15 };
        this.saving       = false;
        this.term         = '';
        this.activeTypes  = 0;
        this.cardType     = 'all';
        this.galleryShown = false;

        // Lo que la vista previa necesita del formulario abierto.
        this.formTypes     = [];
        this.formCustomers = [];

        // El enlace de la ventana «Tarjeta digital» abierta.
        this.shareData = null;

        // Colores rápidos del tipo de tarjeta: los de Catálogo › Métodos de pago (donde está la «Tarjeta de regalo»).
        this.colors = ['#16A34A', '#2563EB', '#7C3AED', '#DB2777', '#DC2626', '#EA580C', '#CA8A04', '#0891B2', '#64748B'];

        // Filtro propio de DataTables: solo actúa sobre la tabla de tarjetas (cliente, número, titular y tipo).
        $.fn.dataTable.ext.search.push((settings, row) => settings.nTable.id !== 'tbLoyCards' || this.matches([row[0], row[1], row[2]].join(' ')));
    }

    // -- Interface --

    init() {
        this.render();
    }

    render() {
        this.layout();
        this.header();

        if (dataInit.status != 200) return this.blocked(dataInit.message || 'No se pudo cargar Tarjetas. Recarga la página.');

        if (!this.allow('show')) return this.blocked('Tu rol no tiene permiso para ver tarjetas y puntos en esta sucursal.');

        this.tabs();
        this.filterCards();
        this.filterTypes();
        this.lsCardTypes();
        this.lsSummary();
    }

    // flex-1 en la página, el cuerpo y la tarjeta: llenan el alto de la pantalla, como Catálogo.
    layout() {
        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:    `page${this.PROJECT_NAME}`,
                class: 'flex flex-1 flex-col gap-[16px]',
                container: [
                    { type: 'div', id: `header${this.PROJECT_NAME}`, class: 'w-full' },
                    { type: 'div', id: `summary${this.PROJECT_NAME}`, class: 'w-full hidden' },
                    { type: 'div', id: `body${this.PROJECT_NAME}`, class: 'w-full flex flex-1 flex-col' }
                ]
            }
        });
    }

    header() {
        const scope = dataInit.scope || {};

        this.createLayout({
            parent: `header${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `title${this.PROJECT_NAME}`,
                class: 'w-full',
                container: [
                    {
                        type:  'div',
                        class: 'flex items-end justify-between gap-[12px] flex-wrap',
                        children: [
                            { type: 'div', id: `headerText${this.PROJECT_NAME}`, class: 'min-w-0' },
                            { type: 'div', id: `headerActions${this.PROJECT_NAME}`, class: 'shrink-0' }
                        ]
                    }
                ]
            }
        });

        this.createLayout({
            parent: `headerText${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `headerTextBody${this.PROJECT_NAME}`,
                class: 'w-full',
                container: [
                    { type: 'h1', class: 'cp-pagina-titulo', text: 'Tarjetas' },
                    { type: 'p', class: 'cp-pagina-subtitulo', text: [scope.company, scope.branch].filter(Boolean).join(' · ') || 'Tarjetas de lealtad de la sucursal' }
                ]
            }
        });

        if (dataInit.status != 200 || !this.allow('show') || !this.allow('create')) return;

        this.coffeeForm({
            parent:       `headerActions${this.PROJECT_NAME}`,
            id:           'formHeaderLoyalty',
            class:        'flex gap-[8px]',
            showRequired: false,
            json: [
                { opc: 'button', id: 'btnNewCardType', class: 'col-auto', text: 'Nuevo tipo', icon: 'icon-tags', color_btn: 'outline', onClick: () => this.addType() },
                { opc: 'button', id: 'btnNewCard', class: 'col-auto', text: 'Nueva tarjeta', icon: 'icon-plus', color_btn: 'primary', onClick: () => this.addCard() }
            ]
        });
    }

    // El id empieza con «tabs»: así lo cubre el modo oscuro de dark-mode.css.
    tabs() {
        this.createLayout({
            parent: `body${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `card${this.PROJECT_NAME}`,
                class: 'ord-card flex-1',
                container: [
                    { type: 'div', id: `container${this.PROJECT_NAME}`, class: 'w-full' }
                ]
            }
        });

        this.tabLayout({
            parent: `container${this.PROJECT_NAME}`,
            id:     'tabsLoyalty',
            theme:  'light',
            type:   'button',
            json: [
                { id: 'loyTypes', tab: 'Tipos de tarjeta', lucideIcon: 'layers', active: true, onClick: () => this.showTab('types') },
                { id: 'loyCards', tab: 'Tarjetas', lucideIcon: 'credit-card', onClick: () => this.showTab('cards') }
            ]
        });

        // Los filtros van fuera de la tabla: createCoffeeTable3 la reescribe y el buscador perdería el foco.
        this.createLayout({
            parent: 'container-loyCards',
            design: false,
            data: {
                id:    'listLoyCards',
                class: 'w-full',
                container: [
                    { type: 'div', id: 'filterLoyCards', class: 'w-full mb-[14px]' },
                    { type: 'div', id: 'tableLoyCards', class: 'w-full' }
                ]
            }
        });

        this.createLayout({
            parent: 'container-loyTypes',
            design: false,
            data: {
                id:    'listLoyTypes',
                class: 'w-full',
                container: [
                    { type: 'div', id: 'filterLoyTypes', class: 'w-full mb-[14px]' },
                    { type: 'div', id: 'tableLoyTypes', class: 'w-full' }
                ]
            }
        });
    }

    filterCards() {
        this.createfilterBar({
            parent:     'filterLoyCards',
            id:         'fbLoyCards',
            prefijo:    'loyc_',
            coffeesoft: true,
            data: [
                {
                    opc:      'select',
                    id:       'status',
                    lbl:      'Estado',
                    required: false,
                    class:    'col-6 col-md-4 col-lg-3 col-xl-2',
                    data:     [{ id: '1', valor: 'Activas' }, { id: '0', valor: 'Inactivas' }, { id: 'all', valor: 'Todas' }],
                    onchange: 'loyalty.lsCards()'
                },
                {
                    opc:      'select',
                    id:       'type',
                    lbl:      'Tipo',
                    required: false,
                    class:    'col-6 col-md-4 col-lg-3 col-xl-2',
                    data:     [{ id: 'all', valor: 'Todos los tipos' }],
                    onchange: 'loyalty.pickType()'
                },
                {
                    opc:         'input',
                    id:          'q',
                    lbl:         'Buscar',
                    type:        'search',
                    placeholder: 'Número, titular, tipo o cliente',
                    required:    false,
                    class:       'col-12 col-md-4 col-lg-4 col-xl-3'
                }
            ]
        });

        $('#loyc_q')
            .attr({ maxlength: 60, autocomplete: 'off', 'aria-label': 'Buscar tarjeta' })
            .on('input', (e) => this.onSearchInput(e));
    }

    filterTypes() {
        this.createfilterBar({
            parent:     'filterLoyTypes',
            id:         'fbLoyTypes',
            prefijo:    'loyt_',
            coffeesoft: true,
            data: [
                {
                    opc:      'select',
                    id:       'status',
                    lbl:      'Estado',
                    required: false,
                    class:    'col-6 col-md-4 col-lg-3 col-xl-2',
                    data:     [{ id: '1', valor: 'Activos' }, { id: '0', valor: 'Inactivos' }, { id: 'all', valor: 'Todos' }],
                    onchange: 'loyalty.lsCardTypes()'
                }
            ]
        });
    }

    // tabLayout no corre el onClick de la pestaña activa al crearla: la primera lista se pide en render().
    showTab(tab) {
        this.tab = tab;

        if (tab === 'types') return this.lsCardTypes();

        this.lsCards();
    }

    blocked(message) {
        this.createLayout({
            parent: `body${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `blocked${this.PROJECT_NAME}`,
                class: 'ord-aviso',
                container: [
                    { type: 'i', class: 'icon-lock text-[22px]' },
                    {
                        type:  'div',
                        class: 'flex flex-col',
                        children: [
                            { type: 'p', class: 'ord-aviso-titulo', text: message },
                            { type: 'p', class: 'ord-aviso-texto', text: 'Si crees que es un error, pide acceso a quien administra Huubie.' }
                        ]
                    }
                ]
            }
        });
    }

    // -- Resumen --

    // Las cifras de arriba (el ctrl ya las manda con formato). Van escondidas hasta que llegan; si fallan, no se muestran.
    async lsSummary() {
        const request = ++this.requests.summary;
        const data    = await useFetch({ url: this._link, data: { opc: 'getSummary' } });

        if (request !== this.requests.summary) return;

        if (!data || data.status != 200 || !Array.isArray(data.tiles)) return $(`#summary${this.PROJECT_NAME}`).addClass('hidden');

        this.renderSummary(data);
    }

    renderSummary(data) {
        this.createLayout({
            parent: `summary${this.PROJECT_NAME}`,
            design: false,
            data: {
                id:    `summaryBody${this.PROJECT_NAME}`,
                class: 'w-full flex flex-col gap-[8px]',
                container: [
                    { type: 'p', class: 'ord-dash-note', text: data.note || '' },
                    { type: 'div', id: `kpis${this.PROJECT_NAME}`, class: 'w-full' }
                ]
            }
        });

        this.infoCard({
            parent: `kpis${this.PROJECT_NAME}`,
            id:     `kpiCards${this.PROJECT_NAME}`,
            style:  'file',
            cols:   Math.min(6, Math.max(4, data.tiles.length)),
            json:   data.tiles.map((t) => ({ title: t.label, accent: t.tone, lucideIcon: t.icon, data: { value: t.value, subtitle: t.hint } }))
        });

        $(`#summary${this.PROJECT_NAME}`).removeClass('hidden');
    }

    // -- Tarjetas --

    async lsCards() {
        const request = ++this.requests.cards;

        $('#tableLoyCards').addClass('opacity-50');

        const data = await useFetch({ url: this._link, data: { opc: 'lsCards', status: $('#loyc_status').val() || '1', type: this.cardType } });

        if (request !== this.requests.cards) return;

        const loaded = Boolean(data && data.status == 200);

        if (!loaded) alert({ icon: 'error', title: 'No se pudo cargar la lista', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });

        if (loaded) {
            this.activeTypes = Number(data.types) || 0;

            if (this.fillTypeFilter(data.typeFilter || [])) return this.lsCards();
        }

        $('#tableLoyCards').removeClass('opacity-50');

        this.createCoffeeTable3({
            parent:  'tableLoyCards',
            id:      'tbLoyCards',
            theme:   'light',
            data:    loaded && data.row ? data : { thead: [], row: [] },
            striped: true,
            hover:   true,
            f_size:  13,
            center:  [4, 5, 7],
            right:   [6],
            ...LOY_TABLE,
            ...this.emptyCards(loaded)
        });

        if (!loaded || !data.row || !data.row.length) return;

        this.dataTable('tbLoyCards', 'cards', 'tarjetas', 'Ninguna tarjeta coincide con la búsqueda');
    }

    /*  Llena el filtro «Tipo» (todos los tipos de la empresa) y deja marcado el
        elegido. Devuelve true si el elegido ya no está en la lista: el filtro
        vuelve a «Todos» y hay que pedir la lista otra vez. */
    fillTypeFilter(list) {
        const found = this.cardType === 'all' || list.some((t) => String(t.id) === this.cardType);

        $('#loyc_type').option_select({ data: [{ id: 'all', valor: 'Todos los tipos' }, ...list], placeholder: '' });

        if (!found) this.cardType = 'all';

        $('#loyc_type').val(this.cardType);

        return !found;
    }

    pickType() {
        this.cardType = String($('#loyc_type').val() || 'all');
        this.lsCards();
    }

    // «Ver tarjetas» de la galería: abre la pestaña Tarjetas ya filtrada por ese tipo (su onClick pide la lista).
    showCards(typeId) {
        this.cardType = String(typeId);
        $('#tab-loyCards').trigger('click');
    }

    // typeId: el tipo que ya viene elegido cuando el alta sale de la galería.
    addCard(typeId = 0) {
        this.formCard(0, typeId);
    }

    editCard(id) {
        this.formCard(id);
    }

    // Con id 0 es un alta: el ctrl solo devuelve las opciones del formulario. typeId: el tipo ya elegido (alta desde la galería).
    async formCard(id, typeId = 0) {
        if (this.saving) return;

        const data = await useFetch({ url: this._link, data: { opc: 'getCard', id: id } });

        if (!data || data.status != 200) return this.fail(data, 'No se pudo abrir la tarjeta');

        const card  = data.row || null;
        const types = data.types || [];
        const scope = dataInit.scope || {};

        if (!types.length) return this.needType();

        this.formTypes     = types;
        this.formCustomers = data.customers || [];

        const json = [
            { id: 'lc_preview', tipo: 'html', class: 'loy-preview', html: this.cardFace() },
            { id: 'lc_number', lbl: 'Número', required: true, maxlength: 40, ph: 'Escríbelo o léelo con el lector', value: card ? card.number : '', help: 'Letras, números y guiones. No se repite en la sucursal.', class: 'w-full' },
            { id: 'lc_type', lbl: 'Tipo de tarjeta', tipo: 'select', required: true, data: types, value: card ? card.card_type_id : (typeId || (types.length === 1 ? types[0].id : '')), class: 'w-full' },
            { id: 'lc_holder', lbl: 'Titular', maxlength: 150, ph: 'Opcional: el nombre impreso', value: card ? card.holder : '', class: 'w-full' },
            { id: 'lc_customer', lbl: 'Cliente', tipo: 'select2', data: this.formCustomers, empty: 'Sin cliente', value: card ? card.customer_id : '', class: 'w-full' }
        ];

        // Solo en el alta y si la empresa tiene número de WhatsApp: su tarjeta digital le llega sola. paintCard() lo prende o lo apaga según el cliente.
        if (!card && this.waReady()) json.push({ id: 'lc_send_wa', lbl: 'Mandarle su tarjeta digital por WhatsApp', tipo: 'switch', value: 1, help: ' ', class: 'w-full' });

        this.csModal({
            id:         'modalLoyCard',
            title:      card ? 'Editar tarjeta' : 'Nueva tarjeta',
            subtitle:   scope.branch ? `Sucursal ${scope.branch}` : '',
            lucideIcon: card ? 'pencil' : 'credit-card',
            width:      'max-w-3xl',
            saveText:   card ? 'Guardar cambios' : 'Agregar tarjeta',
            cancelText: 'Cancelar',
            json:       json,
            onSave:     (values, close) => this.saveCard(card, values, close)
        });

        $('#lc_number')
            .attr({ autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' })
            .on('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/\s+/g, ''); });

        this.preview('modalLoyCard', '#lc_number, #lc_type, #lc_holder, #lc_customer', () => this.paintCard());

        if (!card) $('#lc_number').trigger('focus');
    }

    async saveCard(card, values, close) {
        if (this.saving) return;

        const number   = String(values.lc_number || '').toUpperCase().replace(/\s+/g, '');
        const holder   = String(values.lc_holder || '').trim().replace(/\s+/g, ' ');
        const type     = String($('#lc_type').val() || '');
        const customer = String($('#lc_customer').val() || '');

        if (!number) return this.warn('Escribe o lee el número de la tarjeta.');
        if (!/^[A-Z0-9-]{3,40}$/.test(number)) return this.warn('El número lleva de 3 a 40 letras, números o guiones (sin acentos ni otros signos).');
        if (!type) return this.warn('Elige el tipo de tarjeta.');

        const sendWa = $('#lc_send_wa').is(':checked') && !$('#lc_send_wa').prop('disabled');

        this.saving = true;

        const button = $('#modalLoyCard .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({
            url:  this._link,
            data: { opc: card ? 'editCard' : 'addCard', id: card ? card.id : 0, number: number, holder: holder, card_type_id: type, customer_id: customer, send_wa: sendWa ? 1 : 0 }
        });

        this.saving = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) return this.fail(data, 'No se guardó la tarjeta');

        close();
        this.savedAlert(data);
        this.reload();
    }

    // La tarjeta ya quedó guardada; si se pidió el WhatsApp, cómo salió (si no salió, se avisa sin quitar lo guardado).
    savedAlert(data) {
        const wa = data.wa;

        if (!wa) return alert({ icon: 'success', title: data.message, timer: 1400 });

        if (wa.status === 'sent' || wa.status === 'simulated') {
            return alert({
                icon:  'success',
                title: data.message,
                text:  wa.status === 'sent' ? 'Le mandamos su tarjeta digital por WhatsApp.' : 'WhatsApp simulado: sin token de Meta no sale a la red. Quedó en Ventas › WhatsApp.',
                timer: 2600
            });
        }

        alert({ icon: 'warning', title: `${data.message} El WhatsApp no salió.`, text: wa.detail || 'Revisa Ventas › WhatsApp.', btn1: true, btn1Text: 'Entendido' });
    }

    // La empresa tiene número de WhatsApp (wa_agent) para mandar la tarjeta digital.
    waReady() {
        return Boolean((dataInit.whatsapp || {}).ready);
    }

    // No borra: desactiva. La tarjeta deja de leerse en Vender.
    async statusCard(id, active) {
        if (this.saving) return;

        const data = await useFetch({ url: this._link, data: { opc: 'getCard', id: id } });

        if (!data || data.status != 200 || !data.row) return this.fail(data, 'No se pudo abrir la tarjeta');

        const number = data.row.number;
        const r      = await alert({
            icon:     active ? 'question' : 'warning',
            title:    active ? `¿Reactivar la tarjeta ${number}?` : `¿Desactivar la tarjeta ${number}?`,
            text:     active ? 'Volverá a leerse en Vender.' : 'Dejará de leerse en Vender. Las ventas que ya la usaron no cambian.',
            btn1:     true,
            btn1Text: active ? 'Reactivar' : 'Desactivar',
            btn2:     true,
            btn2Text: 'Cancelar'
        });

        if (!r || !r.isConfirmed || this.saving) return;

        this.saving = true;

        const res = await useFetch({ url: this._link, data: { opc: 'statusCard', id: id, active: active } });

        this.saving = false;

        if (!res || res.status != 200) return this.fail(res, 'No se cambió el estado');

        alert({ icon: 'success', title: res.message, timer: 1800 });
        this.reload();
    }

    // Sin un tipo activo no hay qué asignarle a la tarjeta.
    async needType() {
        const create = this.allow('create');
        const r      = await alert({
            icon:     'info',
            title:    'Primero crea un tipo de tarjeta',
            text:     'El tipo dice qué da la tarjeta: un descuento o puntos al monedero. Aún no hay ninguno activo en esta sucursal.',
            btn1:     true,
            btn1Text: create ? 'Crear tipo' : 'Entendido',
            btn2:     create,
            btn2Text: 'Ahora no'
        });

        if (create && r && r.isConfirmed) this.addType();
    }

    // -- Tarjetas: ficha --

    /*  Solo lectura: el dibujo, el cliente, sus cifras y sus últimas compras.
        Con permiso de editar, «Editar» cierra la ficha y abre el formulario de siempre. */
    async viewCard(id) {
        const data = await useFetch({ url: this._link, data: { opc: 'getCardDetail', id: id } });

        if (!data || data.status != 200 || !data.card) return this.fail(data, 'No se pudo abrir la tarjeta');

        const card  = data.card;
        const modal = this.csModal({
            id:         'modalLoyDetail',
            title:      `Tarjeta ${card.number}`,
            subtitle:   [card.type, card.benefit].filter(Boolean).join(' · '),
            lucideIcon: 'credit-card',
            width:      'max-w-4xl',
            saveText:   false,
            cancelText: 'Cerrar',
            action:     this.allow('update') ? { text: 'Editar', lucideIcon: 'pencil', onClick: () => { modal.close(); this.editCard(card.id); } } : null,
            json: [
                { id: 'ld_face', tipo: 'html', class: 'loy-detail-face', html: this.cardFace() },
                { id: 'ld_side', tipo: 'html', class: 'loy-detail-side', html: '' },
                { id: 'ld_moves', tipo: 'html', class: 'w-full', html: '' }
            ]
        });

        this.paintFace('ld_face', {
            color:    card.color,
            type:     card.type,
            number:   card.number,
            holder:   card.holder || (card.owner ? card.customer : ''),
            discount: card.discount,
            points:   card.points,
            goal:     card.goal,
            stamps:   card.stamps,
            icon:     card.icon,
            caption:  ''
        });

        // «Tarjeta digital» cierra la ficha y abre su ventana (dos csModal a la vez se enciman).
        this.detailSide(card, data.totals || [], () => { modal.close(); this.shareCard(card.id); });
        this.detailMoves(data.moves || [], data.moreText || '');

        if (window.lucide) lucide.createIcons();
    }

    /*  A la derecha del dibujo: el cliente, la nota si algo impide usarla, el botón
        de la tarjeta digital y las cifras (las cajas cus-tile de Clientes). */
    detailSide(card, totals, share) {
        const owner = [
            { type: 'span', class: 'loy-avatar' + (card.owner ? '' : ' is-empty'), 'aria-hidden': 'true', html: '<i data-lucide="user-round" class="w-4 h-4"></i>' },
            { type: 'p', class: 'loy-detail-name', text: card.customer }
        ];

        if (card.phone || card.owner) owner.push({ type: 'p', class: 'ord-sub', text: card.phone || 'Sin teléfono' });
        if (card.note) owner.push({ type: 'p', class: 'loy-detail-note', text: card.note });

        this.createLayout({
            parent: 'ld_side',
            design: false,
            data: {
                id:    'ldSide',
                class: 'flex flex-col gap-[14px]',
                container: [
                    { type: 'div', class: 'loy-detail-owner', children: owner },
                    { type: 'div', class: 'loy-detail-acts', children: [this.tileButton('qr-code', 'Tarjeta digital', share)] },
                    { type: 'div', id: 'ldTiles', class: 'w-full' }
                ]
            }
        });

        this.createLayout({
            parent: 'ldTiles',
            design: false,
            data: {
                id:    'ldTilesGrid',
                class: 'loy-detail-tiles',
                container: totals.map((t) => ({
                    type:     'div',
                    class:    `cus-tile ${t.tone || ''}`,
                    children: [
                        { type: 'p', class: 'cus-tile-label', text: t.label },
                        { type: 'p', class: 'cus-tile-value', text: t.value }
                    ]
                }))
            }
        });
    }

    // Abajo: las últimas compras con la tarjeta y lo que dio cada una (descuento o puntos).
    detailMoves(moves, moreText) {
        const container = [
            { type: 'p', class: 'loy-detail-title', text: 'Últimas compras' },
            { type: 'div', id: 'ldMovesTable', class: 'w-full' }
        ];

        if (moreText) container.push({ type: 'p', class: 'loy-note mt-[8px]', text: moreText });

        this.createLayout({
            parent: 'ld_moves',
            design: false,
            data:   { id: 'ldMoves', class: 'w-full', container: container }
        });

        this.createCoffeeTable3({
            parent:       'ldMovesTable',
            id:           'tbLoyMoves',
            theme:        'light',
            data:         moves.length ? { row: moves } : { thead: [], row: [] },
            striped:      true,
            hover:        false,
            f_size:       13,
            center:       [1, 2, 5],
            right:        [4],
            ...LOY_TABLE,
            emptyMessage: 'Aún no hay compras con esta tarjeta',
            emptyIcon:    'icon-credit-card'
        });
    }

    // -- Tarjetas: tarjeta digital --

    /*  La tarjeta digital es una página que el cliente abre en su teléfono sin
        cuenta (tarjeta.php): su tarjeta y un QR con el número, que en caja se
        lee igual que el plástico. Esta ventana da su enlace: un QR del ENLACE
        para que el cliente lo escanee en el mostrador, «Copiar enlace» y WhatsApp.
        Pedirla la primera vez crea el enlace (el ctrl pide permiso de editar). */
    async shareCard(id) {
        if (this.saving) return;

        const res = await useFetch({ url: this._link, data: { opc: 'getCardLink', id: id } });

        if (!res || res.status != 200) return this.fail(res, 'No se pudo abrir la tarjeta digital');

        this.shareData = res;

        // Con número de WhatsApp de la empresa y permiso de editar: también se puede mandar desde la tienda.
        const store = this.waReady() && res.can_renew;

        this.csModal({
            id:         'modalLoyShare',
            title:      'Tarjeta digital',
            subtitle:   [`Tarjeta ${res.number}`, res.type].filter(Boolean).join(' · '),
            lucideIcon: 'qr-code',
            width:      'max-w-3xl',
            saveText:   'Abrir mi WhatsApp',
            cancelText: 'Cerrar',
            info:       'El cliente la abre sin cuenta ni contraseña.',
            action:     { text: 'Copiar enlace', lucideIcon: 'copy', onClick: () => this.copyCardLink() },
            json: [
                { id: 'ls_qr', tipo: 'html', class: 'loy-preview', html: '' },
                { id: 'ls_phone', lbl: 'WhatsApp del cliente', tipo: 'text', icon: 'phone', value: res.phone, ph: '10 dígitos', maxlength: 16, help: store ? '' : 'Vacío: WhatsApp te deja elegir el contacto.', class: 'w-full' },
                ...(store ? [{ id: 'ls_send', tipo: 'html', class: 'w-full', html: '' }] : []),
                { id: 'ls_message', lbl: 'Mensaje', tipo: 'textarea', rows: 4, maxlength: 1000, value: this.shareMessage(res), help: '«Abrir mi WhatsApp» lo manda desde tu teléfono o tu WhatsApp Web.', class: 'w-full' },
                { id: 'ls_link', tipo: 'html', class: 'w-full', html: '' }
            ],
            onSave: (values, close) => this.sendCardLink(values, close)
        });

        // El QR va a la izquierda de los campos, como el dibujo en las altas.
        $('#modalLoyShare .loy-preview').parent().addClass('loy-split');

        if (store) this.storeSendBox();

        this.shareBox(res);
    }

    // Bajo el teléfono: mandar la plantilla desde el número de la empresa (queda en Ventas › WhatsApp).
    storeSendBox() {
        const simulated = Boolean((dataInit.whatsapp || {}).simulated);

        this.createLayout({
            parent: 'ls_send',
            design: false,
            data: {
                id:    'lsSendBody',
                class: 'loy-share-send',
                container: [
                    this.tileButton('send', 'Mandar desde el WhatsApp de la tienda', () => this.sendCardWa()),
                    { type: 'p', class: 'loy-note', text: simulated ? 'Simulado: sin token de Meta no sale a la red.' : 'Sale del número de la empresa y queda en Ventas › WhatsApp.' }
                ]
            }
        });
    }

    // La plantilla al teléfono escrito. El ctrl revisa el número, BAJA y que la tarjeta esté activa.
    async sendCardWa() {
        const data  = this.shareData;
        const phone = String($('#ls_phone').val() || '').replace(/\D/g, '');

        if (!data || this.saving) return;
        if (!/^(52)?\d{10}$/.test(phone)) return this.warn('Escribe el WhatsApp del cliente: 10 dígitos.');

        this.saving = true;

        const button = $('#lsSendBody button').prop('disabled', true);
        const res    = await useFetch({ url: this._link, data: { opc: 'sendCardWhatsApp', id: data.id, phone: phone } });

        this.saving = false;
        button.prop('disabled', false);

        if (!res || res.status != 200) return this.fail(res, 'No salió el WhatsApp');

        alert({ icon: 'success', title: res.message, timer: 2400 });
    }

    // A la izquierda, el QR del enlace; abajo de los campos, el enlace y «Nuevo enlace».
    shareBox(res) {
        const left = [
            { type: 'figure', class: 'loy-qr', role: 'img', 'aria-label': 'QR del enlace de la tarjeta digital', html: this.qrSvg(res.link) },
            { type: 'p', class: 'loy-card-caption', text: 'Que el cliente lo escanee con la cámara de su teléfono: se abre su tarjeta y ahí la guarda.' }
        ];

        if (!res.usable) left.push({ type: 'p', class: 'loy-share-off', text: 'La tarjeta o su tipo están inactivos: el enlace no abre hasta reactivarlos.' });

        this.createLayout({ parent: 'ls_qr', design: false, data: { id: 'lsQrBody', class: 'w-full', container: left } });

        const foot = [{ type: 'span', text: res.usable ? 'Enlace activo' : 'No abre mientras esté inactiva' }];

        if (res.can_renew) foot.push(this.tileButton('refresh-cw', 'Nuevo enlace', () => this.renewCardLink()));

        this.createLayout({
            parent: 'ls_link',
            design: false,
            data: {
                id:    'lsLinkBody',
                class: 'loy-share-link',
                container: [
                    { type: 'a', class: 'loy-share-url', href: res.link, target: '_blank', rel: 'noopener', text: res.link },
                    { type: 'div', class: 'loy-share-foot', children: foot }
                ]
            }
        });

        if (window.lucide) lucide.createIcons();
    }

    // Un QR en SVG (qrcode-generator, en assets/plugins/qrcode). Corrección M y margen de 4 módulos, el mínimo para leerlo.
    qrSvg(text) {
        if (typeof qrcode !== 'function') return '';

        const qr = qrcode(0, 'M');

        qr.addData(String(text));
        qr.make();

        return qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
    }

    // El mensaje de WhatsApp: saludo con el primer nombre (con mayúscula), qué es y el enlace.
    shareMessage(res) {
        const word  = String(res.name || '').trim().split(/\s+/)[0] || '';
        const first = word ? word.charAt(0).toUpperCase() + word.slice(1) : '';
        const store = (dataInit.scope || {}).company || '';

        return `${first ? `Hola ${first}` : 'Hola'}, esta es tu tarjeta${res.type ? ` ${res.type}` : ''}${store ? ` de ${store}` : ''}.\n`
             + 'Ábrela en tu teléfono y enséñala en caja para usarla:\n'
             + res.link;
    }

    async copyCardLink() {
        const link = this.shareData && this.shareData.link;

        if (!link) return;

        const done = await ticketCopy(link);

        alert(done
            ? { icon: 'success', title: 'Enlace copiado', timer: 1200 }
            : { icon: 'warning', title: 'No se pudo copiar', text: 'Selecciona el enlace y cópialo a mano.', btn1: true, btn1Text: 'Entendido' });
    }

    // Token nuevo: el enlace anterior deja de abrir. El mensaje ya escrito se queda; solo cambia el enlace.
    async renewCardLink() {
        const data = this.shareData;

        if (!data || this.saving) return;

        const ask = await alert({
            icon:     'warning',
            title:    '¿Crear un enlace nuevo?',
            text:     'El enlace anterior deja de abrir. Úsalo si lo mandaste a otra persona por error.',
            btn1:     true,
            btn1Text: 'Crear enlace nuevo',
            btn2:     true,
            btn2Text: 'Cancelar'
        });

        if (!ask || !ask.isConfirmed || this.saving) return;

        this.saving = true;

        const res = await useFetch({ url: this._link, data: { opc: 'newCardLink', id: data.id } });

        this.saving = false;

        if (!res || res.status != 200) return this.fail(res, 'No se cambió el enlace');

        this.shareData = res;

        const message = $('#ls_message');
        const text    = String(message.val() || '');

        message.val(text.includes(data.link) ? text.split(data.link).join(res.link) : this.shareMessage(res));

        this.shareBox(res);

        alert({ icon: 'success', title: res.message || 'Enlace nuevo listo.', timer: 1600 });
    }

    // Sin el enlace el mensaje no sirve: si lo borraron, va al final.
    sendCardLink(values, close) {
        const data  = this.shareData;
        const phone = ticketPhone(values.ls_phone);

        if (!data) return;

        if (phone === null) {
            return alert({ icon: 'warning', title: 'Teléfono no válido', text: 'Escribe los 10 dígitos o deja el campo vacío.', btn1: true, btn1Text: 'Entendido' });
        }

        let text = String(values.ls_message || '').trim();

        if (!text.includes(data.link)) text = (text !== '' ? text + '\n' : '') + data.link;

        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');

        close();
    }

    // -- Tipos de tarjeta --

    async lsCardTypes() {
        const request = ++this.requests.types;

        $('#tableLoyTypes').addClass('opacity-50');

        const data = await useFetch({ url: this._link, data: { opc: 'lsCardTypes', status: $('#loyt_status').val() || '1' } });

        if (request !== this.requests.types) return;

        const loaded = Boolean(data && data.status == 200);

        if (!loaded) alert({ icon: 'error', title: 'No se pudo cargar la lista', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });

        $('#tableLoyTypes').removeClass('opacity-50');

        if (loaded && Array.isArray(data.types) && data.types.length) return this.gallery(data.types);

        this.emptyGallery(loaded);
    }

    // -- Tipos: galería --

    // Una tarjeta por tipo. Al recargar (is-still) los dibujos ya no vuelven a entrar animados.
    gallery(types) {
        this.createLayout({
            parent: 'tableLoyTypes',
            design: false,
            data: {
                id:        'galleryLoyTypes',
                class:     'loy-gallery' + (this.galleryShown ? ' is-still' : ''),
                container: types.map((t) => ({ type: 'div', id: `loyTile${t.id}`, class: 'loy-tile' + (t.active ? '' : ' is-off') }))
            }
        });

        types.forEach((t) => this.tile(t));

        // Los botones de solo ícono enseñan su nombre al pasar el ratón. Con .attr(): como prop de jQuery, title abre un popover.
        $('#galleryLoyTypes .loy-act.is-icon, #galleryLoyTypes .loy-act.is-squeeze').each((i, el) => $(el).attr('title', $(el).attr('aria-label')));

        this.galleryShown = true;

        if (window.lucide) lucide.createIcons();
    }

    /*  Un tipo: su tarjeta (la cara «tipo»: el nombre y lo que da), y debajo
        cuántas tarjetas tiene, lo que vendió en el mes y sus botones.
        Un clic en la tarjeta (o Enter con el foco en ella) abre sus tarjetas.
        Lo que escribió el usuario entra con text: nada se lee como HTML. */
    tile(t) {
        const open  = () => this.showCards(t.id);
        const facts = [
            { type: 'p', class: 'loy-tile-count', text: t.cardsText },
            { type: 'p', class: 'loy-tile-fact', text: t.salesText }
        ];

        // Sellos: qué se gana y cuánto vale (la cara solo dice cuántos sellos).
        if (t.goal > 0) facts.splice(1, 0, { type: 'p', class: 'loy-tile-fact', text: `1 sello por cada ${this.moneyShort(t.stampAmount)} · ${t.goal} = ${t.reward} (hasta ${money(t.rewardValue)})` });

        if (!t.active) facts.push({ type: 'p', class: 'loy-tile-off', text: 'Inactivo: sus tarjetas no se leen en Vender.' });

        const buttons = [this.tileButton('credit-card', 'Ver tarjetas', open)];

        if (t.active && this.allow('create')) buttons.push(this.tileButton('plus', 'Nueva tarjeta', () => this.addCard(t.id), 'is-squeeze'));

        if (this.allow('update')) {
            buttons.push(this.tileButton('pencil', `Editar el tipo ${t.name}`, () => this.editType(t.id), 'is-icon is-push'));
            buttons.push(t.active
                ? this.tileButton('power', `Desactivar el tipo ${t.name}`, () => this.statusType(t.id, 0), 'is-icon is-danger')
                : this.tileButton('power', 'Activar', () => this.statusType(t.id, 1)));
        }

        this.createLayout({
            parent: `loyTile${t.id}`,
            design: false,
            data: {
                id:    `loyTileBody${t.id}`,
                class: 'loy-tile-body',
                container: [
                    {
                        type:         'section',
                        id:           `loyFace${t.id}`,
                        class:        'loy-tile-face',
                        role:         'button',
                        tabindex:     0,
                        'aria-label': `Ver las tarjetas del tipo ${t.name}`,
                        html:         this.cardFace('type'),
                        click:        open,
                        keydown:      (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }
                    },
                    { type: 'div', class: 'loy-tile-facts', children: facts },
                    { type: 'div', class: 'loy-tile-actions', children: buttons }
                ]
            }
        });

        this.paintFace(`loyFace${t.id}`, { color: t.color, type: t.name, discount: t.discount, points: t.points, goal: t.goal, icon: t.icon, caption: '' });
    }

    /*  Un botón de la galería: píldora plana (loy-act) con ícono y texto.
        tone 'is-icon' = solo el ícono (su nombre también va en title, que pone gallery());
        'is-squeeze' = el CSS le quita el texto si el mosaico es angosto.
        aria-label siempre: el nombre se oye aunque el texto no se vea. */
    tileButton(icon, text, click, tone = '') {
        const only = tone.includes('is-icon');

        return {
            type:         'button',
            class:        `loy-act ${tone}`.trim(),
            'aria-label': text,
            html:         `<i data-lucide="${icon}" class="w-4 h-4" aria-hidden="true"></i>` + (only ? '' : `<span class="loy-act-text">${esc(text)}</span>`),
            click:        click
        };
    }

    // Sin tipos que mostrar: un aviso (ord-aviso) en lugar de la galería.
    emptyGallery(loaded) {
        const status = $('#loyt_status').val() || '1';
        const add    = this.allow('create')
                     ? 'Crea uno con «Nuevo tipo»: dice si la tarjeta da descuento o puntos y de qué color se dibuja.'
                     : 'Pide a quien administra las tarjetas que cree uno.';
        const notice = !loaded ? ['No se pudieron cargar los tipos de tarjeta', 'Revisa la conexión y vuelve a intentar.']
                     : status === '0' ? ['No hay tipos de tarjeta inactivos', 'Aquí aparecen los que desactives.']
                     : [status === '1' ? 'Aún no hay tipos de tarjeta activos' : 'Aún no hay tipos de tarjeta', add];

        this.createLayout({
            parent: 'tableLoyTypes',
            design: false,
            data: {
                id:    'emptyLoyTypes',
                class: 'ord-aviso',
                container: [
                    { type: 'i', class: (loaded ? 'icon-tags' : 'icon-attention') + ' text-[22px]' },
                    {
                        type:  'div',
                        class: 'flex flex-col',
                        children: [
                            { type: 'p', class: 'ord-aviso-titulo', text: notice[0] },
                            { type: 'p', class: 'ord-aviso-texto', text: notice[1] }
                        ]
                    }
                ]
            }
        });
    }

    addType() {
        this.formType(null);
    }

    async editType(id) {
        const data = await useFetch({ url: this._link, data: { opc: 'getCardType', id: id } });

        if (!data || data.status != 200 || !data.row) return this.fail(data, 'No se pudo abrir el tipo de tarjeta');

        this.formType(data.row);
    }

    /*  Un tipo da descuento, puntos o sellos: uno solo. Uno de antes de esa regla
        puede traer descuento y puntos: abre en «Descuento», avisa y, al cambiar
        el beneficio, trae el porcentaje que tenía el otro.
        Sellos: $ por sello, cuántos para el premio, el premio y su valor; el
        porcentaje se esconde (y los campos de sellos con los otros beneficios). */
    formType(type) {
        if (this.saving) return;

        const scope    = dataInit.scope || {};
        const discount = type ? Number(type.discount_percent) || 0 : 0;
        const points   = type ? Number(type.points_percent) || 0 : 0;
        const goal     = type ? Number(type.stamp_goal) || 0 : 0;
        const both     = discount > 0 && points > 0;
        const benefit  = goal > 0 ? 'stamps' : (points > 0 && discount <= 0 ? 'points' : 'discount');
        const percent  = benefit === 'points' ? points : discount;
        const amount   = (field) => (type && Number(type[field]) > 0 ? Number(type[field]) : '');
        const json     = [
            { id: 'lt_preview', tipo: 'html', class: 'loy-preview', html: this.cardFace('type') },
            { id: 'lt_name', lbl: 'Nombre', required: true, maxlength: 80, ph: 'Ej. Oro, Cliente frecuente', value: type ? type.name : '', class: 'w-full' },
            { id: 'lt_benefit', lbl: 'Beneficio', tipo: 'select', required: true, empty: false, data: [{ id: 'discount', valor: 'Descuento al pagar' }, { id: 'points', valor: 'Puntos al monedero' }, { id: 'stamps', valor: 'Sellos: junta y llévate un premio' }], value: benefit, class: 'w-full sm:w-1/2' },
            { id: 'lt_percent', lbl: 'Porcentaje (%)', tipo: 'number', required: true, min: 0, max: 100, step: '0.01', ph: '0', value: percent > 0 ? percent : '', class: 'w-full sm:w-1/2' },
            { id: 'lt_stamp_amount', lbl: '1 sello por cada ($)', tipo: 'number', required: true, min: 1, step: '0.01', ph: 'Ej. 100', value: amount('stamp_amount'), class: 'w-full sm:w-1/2' },
            { id: 'lt_stamp_goal', lbl: 'Sellos para el premio', tipo: 'number', required: true, min: 2, max: 20, step: '1', ph: 'De 2 a 20', value: goal > 0 ? goal : '', class: 'w-full sm:w-1/2' },
            { id: 'lt_reward_value', lbl: 'Valor del premio ($)', tipo: 'number', required: true, min: 1, step: '0.01', ph: 'Lo más que descuenta', value: amount('reward_value'), class: 'w-full sm:w-1/2' },
            { id: 'lt_reward_name', lbl: 'Premio', required: true, maxlength: 80, ph: 'Ej. Café gratis', value: type ? type.reward_name || '' : '', class: 'w-full' },
            { id: 'lt_stamp_icon', lbl: 'Icono del sello', tipo: 'icon', ph: 'Ej. coffee, star, cake-slice', value: goal > 0 ? type.stamp_icon || '' : 'star', class: 'w-full' },
            { id: 'lt_color', lbl: 'Color', tipo: 'color', ph: this.defaultColor(), value: type && type.color ? type.color : this.defaultColor(), class: 'w-full sm:w-1/2' },
            { id: 'lt_swatches', tipo: 'html', class: 'w-full sm:w-1/2', html: this.swatchesHtml() },
            { id: 'lt_note', tipo: 'html', class: 'w-full', html: '<p class="loy-note"></p>' }
        ];

        if (both) {
            json.splice(2, 0, {
                id:    'lt_legacy',
                tipo:  'html',
                class: 'w-full',
                html:  `<p class="loy-legacy">Este tipo da ${this.pct(discount)} de descuento y ${this.pct(points)} de puntos. Ahora una tarjeta da uno solo: elige cuál se queda. Si guardas así, se queda el descuento.</p>`
            });
        }

        this.csModal({
            id:         'modalLoyType',
            title:      type ? 'Editar tipo de tarjeta' : 'Nuevo tipo de tarjeta',
            subtitle:   scope.branch ? `Sucursal ${scope.branch}` : '',
            lucideIcon: type ? 'pencil' : 'layers',
            width:      'max-w-3xl',
            saveText:   type ? 'Guardar cambios' : 'Agregar tipo',
            cancelText: 'Cancelar',
            json:       json,
            onSave:     (values, close) => this.saveType(type, values, close)
        });

        // Atado al select, corre antes que el repintado (que escucha en el modal): el dibujo ya sale con el porcentaje nuevo.
        if (both) $('#lt_benefit').on('change', (e) => $('#lt_percent').val(e.target.value === 'points' ? points : discount));

        // También antes del repintado: muestra los campos del beneficio elegido.
        $('#lt_benefit').on('change', () => this.benefitFields());
        this.benefitFields();

        // Un color rápido escribe en el campo; el evento input mueve la muestra y repinta.
        $('#modalLoyType').on('click', '.loy-color', (e) => $('#lt_color').val(String($(e.currentTarget).data('color')).toUpperCase()).trigger('input'));

        // «Otro color» abre el selector de la muestra del campo Color; lo elegido llega por su evento input.
        $('#modalLoyType').on('click', '.loy-color-other', () => this.pickColor());

        this.preview('modalLoyType', '#lt_name, #lt_benefit, #lt_percent, #lt_stamp_amount, #lt_stamp_goal, #lt_reward_name, #lt_reward_value, #lt_stamp_icon, #lt_color, #lt_color__pick', () => this.paintType());

        if (!type) $('#lt_name').trigger('focus');
    }

    // Con «Sellos» se ven sus 4 campos y se esconde el porcentaje; con descuento o puntos, al revés.
    benefitFields() {
        const stamps = $('#lt_benefit').val() === 'stamps';

        $('#lt_percent').closest('.px-2').toggle(!stamps);
        $('#lt_stamp_amount, #lt_stamp_goal, #lt_reward_value, #lt_reward_name, #lt_stamp_icon').closest('.px-2').toggle(stamps);
    }

    // Lo que se escribió de sellos: números ya revisados (null = inválido), el premio limpio y el icono (Lucide; '' = círculo).
    stampValues() {
        const goalText = String($('#lt_stamp_goal').val() || '').trim();

        return {
            amount: this.amount($('#lt_stamp_amount').val()),
            goal:   /^\d{1,2}$/.test(goalText) ? Number(goalText) : (goalText === '' ? 0 : null),
            reward: String($('#lt_reward_name').val() || '').trim().replace(/\s+/g, ' '),
            value:  this.amount($('#lt_reward_value').val()),
            icon:   this.stampIcon($('#lt_stamp_icon').val())
        };
    }

    // Un nombre de icono de Lucide que exista; si no, '' (el sello sale como círculo liso).
    stampIcon(raw) {
        const name = String(raw || '').trim().toLowerCase();

        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 40) return '';
        if (typeof csIconExists === 'function' && !csIconExists(name)) return '';

        return name;
    }

    // Un monto en pesos con hasta 2 decimales. Vacío = 0; inválido = null.
    amount(raw) {
        const text = String(raw === null || raw === undefined ? '' : raw).trim().replace(/[$,\s]/g, '');

        if (text === '') return 0;
        if (!/^\d{1,6}(\.\d{1,2})?$/.test(text)) return null;

        return Number(text);
    }

    // Lo mismo que «Colores rápidos» de Catálogo › Métodos de pago, más «Otro color» para elegir uno que no esté en la lista.
    swatchesHtml() {
        const buttons = this.colors.map((color) => `<button type="button" class="loy-color" data-color="${color}" style="background-color:${color}" aria-label="Color ${color}" aria-pressed="false"></button>`).join('');
        const other   = '<button type="button" class="loy-color-other" aria-pressed="false"><span class="loy-color-other-dot" aria-hidden="true"></span>Otro color</button>';

        return '<label class="block text-xs font-semibold text-gray-500 mb-1.5">Colores rápidos</label>'
             + `<div class="loy-colores">${buttons}${other}</div>`;
    }

    // Abre el selector de color del navegador (el de la muestra del campo Color).
    pickColor() {
        const pick = $('#lt_color__pick')[0];

        if (!pick) return;

        // Sin showPicker (navegador viejo) o si lo niega, el clic abre el mismo selector.
        try {
            pick.showPicker();
        } catch (e) {
            pick.click();
        }
    }

    async saveType(type, values, close) {
        if (this.saving) return;

        const name    = String(values.lt_name || '').trim().replace(/\s+/g, ' ');
        const benefit = ['points', 'stamps'].includes($('#lt_benefit').val()) ? $('#lt_benefit').val() : 'discount';
        const percent = benefit === 'stamps' ? 0 : this.percent($('#lt_percent').val());
        const stamp   = benefit === 'stamps' ? this.stampValues() : null;
        const text    = String($('#lt_color').val() || '').trim();

        if (!name) return this.warn('Escribe el nombre del tipo de tarjeta.');

        if (stamp) {
            if (stamp.amount === null || stamp.amount <= 0) return this.warn('Pon cuántos pesos dan un sello, por ejemplo 100.');
            if (stamp.goal === null || stamp.goal < 2 || stamp.goal > 20) return this.warn('Los sellos para el premio van de 2 a 20.');
            if (!stamp.reward) return this.warn('Escribe el premio, por ejemplo «Café gratis».');
            if (stamp.value === null || stamp.value <= 0) return this.warn('Pon el valor del premio: lo más que descuenta.');
        } else {
            if (percent === null) return this.warn('El porcentaje va de 0 a 100, con hasta 2 decimales.');
            if (percent <= 0) return this.warn(benefit === 'points' ? 'Pon cuántos puntos da (%): si no, la tarjeta no hace nada.' : 'Pon cuánto descuenta (%): si no, la tarjeta no hace nada.');
        }

        if (text && !/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(text)) return this.warn(`El color va como # y 6 letras o números, por ejemplo ${this.defaultColor()}.`);

        this.saving = true;

        const button = $('#modalLoyType .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({
            url:  this._link,
            data: {
                opc:              type ? 'editCardType' : 'addCardType',
                id:               type ? type.id : 0,
                name:             name,
                discount_percent: benefit === 'discount' ? percent : 0,
                points_percent:   benefit === 'points' ? percent : 0,
                stamp_amount:     stamp ? stamp.amount : '',
                stamp_goal:       stamp ? stamp.goal : '',
                reward_name:      stamp ? stamp.reward : '',
                reward_value:     stamp ? stamp.value : '',
                stamp_icon:       stamp ? stamp.icon : '',
                color:            text ? hex6(text).toUpperCase() : ''
            }
        });

        this.saving = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) return this.fail(data, 'No se guardó el tipo de tarjeta');

        close();
        alert({ icon: 'success', title: data.message, timer: 1400 });
        this.reload();
    }

    // Al desactivar un tipo, sus tarjetas dejan de leerse en Vender.
    async statusType(id, active) {
        if (this.saving) return;

        const data = await useFetch({ url: this._link, data: { opc: 'getCardType', id: id } });

        if (!data || data.status != 200 || !data.row) return this.fail(data, 'No se pudo abrir el tipo de tarjeta');

        const name = data.row.name;
        const r    = await alert({
            icon:     active ? 'question' : 'warning',
            title:    active ? `¿Reactivar el tipo ${name}?` : `¿Desactivar el tipo ${name}?`,
            text:     active ? 'Sus tarjetas volverán a leerse en Vender.' : 'Sus tarjetas dejarán de leerse en Vender hasta que lo reactives. Las ventas ya cobradas no cambian.',
            btn1:     true,
            btn1Text: active ? 'Reactivar' : 'Desactivar',
            btn2:     true,
            btn2Text: 'Cancelar'
        });

        if (!r || !r.isConfirmed || this.saving) return;

        this.saving = true;

        const res = await useFetch({ url: this._link, data: { opc: 'statusCardType', id: id, active: active } });

        this.saving = false;

        if (!res || res.status != 200) return this.fail(res, 'No se cambió el estado');

        alert({ icon: 'success', title: res.message, timer: 1400 });
        this.reload();
    }

    // -- Vista previa --

    /*  El dibujo de la tarjeta: un rectángulo liso de un solo color, sin
        recortes, filos ni marca de agua. No es un campo: no guarda nada y lo
        llena paintFace().
        kind 'card' (alta de tarjeta y ficha): número, titular y lo que da.
        kind 'type' (galería y alta de tipo): el nombre y, en grande, lo que da.
        La marca de arriba es la empresa: la tarjeta vale en todas sus sucursales. */
    cardFace(kind = 'card') {
        const scope = dataInit.scope || {};
        const card  = kind !== 'type';
        const owner = '<div class="loy-card-owner"><span class="loy-card-label">Titular</span><span class="loy-card-holder"></span></div>';

        return `
            <div class="loy-card${card ? '' : ' is-type'}" data-ink="dark" style="--loy-color:${this.defaultColor()}">
                <div class="loy-card-top">
                    <span class="loy-card-type"></span>
                    <span class="loy-card-brand">${esc(scope.company || scope.branch || '')}</span>
                </div>
                ${card ? '<p class="loy-card-number"></p>' : ''}
                <div class="loy-card-stamps" aria-hidden="true"></div>
                <div class="loy-card-bottom">
                    ${card ? owner : ''}
                    <div class="loy-card-perks"></div>
                </div>
            </div>
            <p class="loy-card-caption"></p>`;
    }

    // Acomoda el dibujo a la izquierda de los campos y lo repinta con cada cambio (select2 avisa con change).
    preview(modal, fields, paint) {
        $(`#${modal} .loy-preview`).parent().addClass('loy-split');
        $(`#${modal}`).on('input change', fields, () => paint(false));

        paint(true);
    }

    // -- Animación de la tarjeta --

    // Vuelve a correr una animación de CSS: quita la clase, fuerza el redibujo y la pone otra vez.
    replay(el, name) {
        if (!el) return;

        el.classList.remove(name);
        void el.offsetWidth;
        el.classList.add(name);
    }

    // Sin titular escrito, la tarjeta lleva el nombre del cliente.
    paintCard() {
        const pick     = (list, field) => list.find((item) => String(item.id) === String($(field).val() || '')) || null;
        const type     = pick(this.formTypes, '#lc_type');
        const customer = pick(this.formCustomers, '#lc_customer');
        const holder   = String($('#lc_holder').val() || '').trim();

        this.paintFace('modalLoyCard', {
            color:    type ? type.color : this.defaultColor(),
            type:     type ? type.name : '',
            number:   $('#lc_number').val(),
            holder:   holder || (customer ? customer.name : ''),
            discount: type ? type.discount : 0,
            points:   type ? type.points : 0,
            goal:     type ? type.goal : 0,
            icon:     type ? type.icon : '',
            caption:  this.cardCaption(type, customer)
        });

        this.paintSendWa(customer);
    }

    // El interruptor del WhatsApp: solo con un cliente que tenga WhatsApp de 10 dígitos; abajo, a qué número sale.
    paintSendWa(customer) {
        const box = $('#lc_send_wa');

        if (!box.length) return;

        const phone = customer && customer.wa ? String(customer.wa) : '';
        const hint  = !customer ? 'Elige un cliente con WhatsApp para mandársela.'
                    : !phone    ? 'Ese cliente no tiene un WhatsApp de 10 dígitos.'
                    : `Sale del WhatsApp de la tienda al ${phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3')}.`;

        box.prop('disabled', !phone).closest('label').toggleClass('opacity-50', !phone).toggleClass('cursor-pointer', Boolean(phone));
        box.closest('.px-2').find('p').text(hint);
    }

    // El tipo con su color y su único beneficio; abajo, qué hace en pesos y la nota del beneficio elegido.
    paintType() {
        const modal   = $('#modalLoyType');
        const name    = String($('#lt_name').val() || '').trim().replace(/\s+/g, ' ');
        const benefit = ['points', 'stamps'].includes($('#lt_benefit').val()) ? $('#lt_benefit').val() : 'discount';
        const stamp   = benefit === 'stamps' ? this.stampValues() : null;
        const goal    = stamp && stamp.goal >= 2 && stamp.goal <= 20 ? stamp.goal : 0;
        const percent = stamp ? 0 : this.percent($('#lt_percent').val()) || 0;
        const color   = this.pickedColor();
        const notes   = {
            discount: 'El descuento se aplica al leer la tarjeta en Vender. Esa venta ya no admite otro descuento.',
            points:   'Los puntos son dinero a favor: van al monedero del cliente y se gastan pagando con «Monedero». Lo pagado con Monedero y lo que queda a crédito no da puntos.',
            stamps:   'Los sellos son de la tarjeta (sirve aunque no tenga cliente) y no caducan. Cuentan lo pagado, sin propina, monedero ni crédito. El premio se canjea en Vender cuando el cliente quiera.'
        };

        this.paintFace('modalLoyType', {
            color:    color,
            type:     name,
            discount: benefit === 'discount' ? percent : 0,
            points:   benefit === 'points' ? percent : 0,
            goal:     goal,
            stamps:   goal ? Math.min(3, goal) : 0,
            icon:     stamp ? stamp.icon : '',
            empty:    { discount: 'descuento', points: 'puntos', stamps: 'sellos' }[benefit],
            caption:  stamp ? this.stampCaption(stamp) : this.typeCaption(benefit, percent)
        });

        modal.find('.loy-note').text(notes[benefit]);

        modal.find('.loy-color').each((i, el) => {
            const on = String($(el).data('color')).toUpperCase() === color;

            $(el).toggleClass('is-active', on).attr('aria-pressed', String(on));
        });

        // Un color que no está en los rápidos: se marca «Otro color» y su punto lo muestra.
        const custom = !this.colors.includes(color);

        modal.find('.loy-color-other').toggleClass('is-active', custom).attr('aria-pressed', String(custom)).css('--loy-pick', custom ? color : '');
    }

    // El color escrito si ya es válido; vacío, el celeste; a medio teclear, el último bueno (el de la muestra).
    pickedColor() {
        const text = String($('#lt_color').val() || '').trim();

        if (!text) return this.defaultColor();
        if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(text)) return hex6(text).toUpperCase();

        return hex6($('#lt_color__pick').val()).toUpperCase();
    }

    /*  Lo que falta se pinta apagado (is-empty). Todo entra con .text(): nada de lo escrito se interpreta como HTML.
        face.empty ('descuento', 'puntos' o 'sellos'): sin valor todavía, pinta «0 %» (o «0»)
        apagado con esa palabra (alta de tipo); sin empty, no pinta nada.
        Sellos: face.goal (la meta), face.stamps (los juntados) y face.icon (Lucide).
        Lo animado, solo al cambiar: color → se funde (is-painted prende esa transición
        después del primer pintado, para que al abrir no se funda desde el celeste);
        el beneficio → da un salto (is-pop). La entrada es del CSS.
        box: el id de lo que contiene el dibujo (un formulario, una tarjeta de la galería o la ficha). */
    paintFace(box, face) {
        const card   = $(`#${box} .loy-card`);
        const number = String(face.number || '').trim();
        const color  = hex6(face.color || this.defaultColor()).toUpperCase();
        const goal   = Math.max(0, Math.min(20, Math.floor(Number(face.goal) || 0)));
        const have   = Math.max(0, Math.min(goal, Math.floor(Number(face.stamps) || 0)));
        const perk   = (text, label, cls = '') => `<span class="loy-card-perk${cls}"><b>${text}</b>${label}</span>`;
        // Sellos: en una tarjeta con sus sellos (la ficha), el avance «7/10»; en el tipo o el alta, la meta.
        const count  = face.stamps !== undefined && face.number ? `${have}/${goal}` : goal;
        const perks  = (Number(face.discount) > 0 ? perk(this.pct(face.discount), 'descuento') : '')
                     + (Number(face.points) > 0 ? perk(this.pct(face.points), 'puntos') : '')
                     + (goal > 0 ? perk(count, 'sellos') : '');
        const empty  = face.empty ? perk(face.empty === 'sellos' ? '0' : this.pct(0), face.empty, ' is-empty') : '';
        const before = card.data('face');

        card[0].style.setProperty('--loy-color', color);
        card.attr('data-ink', this.inkOf(color));

        card.find('.loy-card-type').text(face.type || 'Tipo de tarjeta').toggleClass('is-empty', !face.type);
        card.find('.loy-card-number').text(number || '0000-0000').toggleClass('is-empty', !number).toggleClass('is-long', number.length > 16);
        card.find('.loy-card-holder').text(face.holder || 'Al portador').toggleClass('is-empty', !face.holder);
        card.find('.loy-card-perks').html(perks || empty);

        // Sellos: uno por sello de la meta, con el icono del tipo (sin icono, un círculo liso); los juntados, llenos.
        const icon = this.stampIcon(face.icon);
        const mark = icon ? `<i data-lucide="${icon}"></i>` : '';

        card.find('.loy-card-stamps').html(Array.from({ length: goal }, (v, i) => `<span class="loy-stamp${i < have ? ' is-on' : ''}${icon ? ' has-icon' : ''}">${mark}</span>`).join(''));

        if (icon && window.lucide) lucide.createIcons();

        if (before) {
            if (before.perks !== perks && perks) this.replay(card.find('.loy-card-perks')[0], 'is-pop');
        } else {
            void card[0].offsetWidth;
            card.addClass('is-painted');
        }

        card.data('face', { perks: perks });

        $(`#${box} .loy-card-caption`).text(face.caption);
    }

    /*  Letra oscura sobre colores claros y blanca sobre los fuertes. Sale de la
        luminancia de WCAG: arriba de 0.24 contrasta más la oscura. */
    inkOf(color) {
        const hex     = hex6(color);
        const channel = (at) => {
            const value = parseInt(hex.slice(at, at + 2), 16) / 255;

            return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
        };
        const light   = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);

        return light > 0.24 ? 'dark' : 'light';
    }

    // El celeste claro de los tipos sin color (lo manda el ctrl).
    defaultColor() {
        return hex6(dataInit.cardColor || '#BAE6FD').toUpperCase();
    }

    // A quién le sirve la tarjeta y a dónde van sus puntos (o qué junta, si es de sellos).
    cardCaption(type, customer) {
        if (!type) return 'Elige el tipo: dice si la tarjeta da descuento, puntos o sellos, y de qué color se ve.';

        const points = Number(type.points) > 0;
        const stamps = Number(type.goal) > 0 ? ` Junta 1 sello por cada ${this.moneyShort(type.stampAmount)}; con ${type.goal}: ${type.reward}.` : '';

        if (customer) return `Solo vale en compras de ${customer.name}` + (points ? '; los puntos van a su monedero.' : '.') + stamps;

        return 'Sin cliente: vale para quien la presente' + (points ? ' y los puntos van al cliente de esa venta.' : '.') + stamps;
    }

    // Un ejemplo de sellos sobre una compra de $250.00 y lo que da el premio.
    stampCaption(s) {
        if (!s.amount || s.amount <= 0) return 'Pon cuántos pesos dan un sello para ver un ejemplo.';

        const sale  = 250;
        const count = Math.floor(sale / s.amount);
        const gift  = s.reward ? `«${s.reward}»` : 'el premio';
        const goal  = s.goal >= 2 && s.goal <= 20 ? `Con ${s.goal} sellos, ${gift}` : 'Con la meta de sellos, el premio';
        const worth = s.value > 0 ? ` descuenta hasta ${money(s.value)}.` : '.';

        return `Una compra de ${money(sale)} da ${count} ${count === 1 ? 'sello' : 'sellos'}. ${goal}${worth}`;
    }

    // 100 → «$100»; 99.5 → «$99.50».
    moneyShort(value) {
        const n = Math.round(Number(value || 0) * 100) / 100;

        return Number.isInteger(n) ? '$' + n.toLocaleString('es-MX') : money(n);
    }

    // Un ejemplo en pesos sobre una compra de $200.00.
    typeCaption(benefit, percent) {
        const sale   = 200;
        const amount = Math.round(sale * percent) / 100;

        if (amount <= 0) return benefit === 'points' ? 'Pon el porcentaje para ver cuánto deja en el monedero.' : 'Pon el porcentaje para ver cuánto descuenta.';
        if (benefit === 'points') return `En una compra de ${money(sale)} deja ${money(amount)} en el monedero del cliente.`;

        return `En una compra de ${money(sale)} descuenta ${money(amount)}: se cobran ${money(sale - amount)}.`;
    }

    // 10 → «10 %»; 7.5 → «7.5 %».
    pct(value) {
        return `${Math.round(Number(value) * 100) / 100} %`;
    }

    // -- Complements --

    // La navbar avisa al cambiar de sucursal.
    onBranchChange() {
        location.reload();
    }

    // Un cambio en un tipo o en una tarjeta se ve en la galería, en la lista y en el resumen.
    reload() {
        this.lsCardTypes();
        this.lsCards();
        this.lsSummary();
    }

    dataTable(id, key, noun, zero) {
        $(`#${id}`).DataTable({
            dom:          '<"ord-dt-top"l><"ord-dt-scroll"t><"ord-dt-foot"ip>',
            pageLength:   this.pageLength[key],
            lengthMenu:   [10, 15, 25, 50],
            ordering:     false,
            searching:    true,
            lengthChange: true,
            destroy:      true,
            autoWidth:    false,
            language: {
                lengthMenu:   'Mostrar _MENU_ registros por página',
                info:         `Mostrando _START_ a _END_ de _TOTAL_ ${noun}`,
                infoEmpty:    `Sin ${noun}`,
                infoFiltered: '(de _MAX_ en total)',
                emptyTable:   `Sin ${noun}`,
                zeroRecords:  zero,
                paginate:     { first: 'Primera', last: 'Última', next: '›', previous: '‹' }
            },
            drawCallback: () => {
                if (window.lucide) lucide.createIcons();
            }
        }).on('length.dt', (e, settings, len) => { this.pageLength[key] = len; });
    }

    onSearchInput(e) {
        this.term = this.plain(e.target.value.trim());

        if ($.fn.DataTable.isDataTable('#tbLoyCards')) $('#tbLoyCards').DataTable().draw();
    }

    // Sin acentos ni mayúsculas.
    matches(cells) {
        if (!this.term) return true;

        return this.plain(String(cells || '').replace(/<[^>]*>/g, ' ')).includes(this.term);
    }

    plain(text) {
        return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    }

    // Un porcentaje de 0 a 100 con hasta 2 decimales. Vacío = 0; inválido = null.
    percent(raw) {
        const text = String(raw === null || raw === undefined ? '' : raw).trim().replace(',', '.');

        if (text === '') return 0;
        if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return null;

        const value = Number(text);

        return value > 100 ? null : value;
    }

    // Permisos de la sección Tarjetas (code pos-puntos).
    allow(action) {
        return (dataInit.points || []).includes(action);
    }

    emptyCards(loaded) {
        if (!loaded) return { emptyMessage: 'No se pudo cargar la lista de tarjetas', emptyIcon: 'icon-attention' };

        if (!this.activeTypes) return { emptyMessage: 'Empieza por crear un tipo de tarjeta: dice si da descuento o puntos', emptyIcon: 'icon-tags' };

        return { emptyMessage: 'No hay tarjetas con este filtro', emptyIcon: 'icon-credit-card' };
    }

    warn(text) {
        alert({ icon: 'warning', title: 'Falta un dato', text: text, btn1: true, btn1Text: 'Entendido' });
    }

    fail(data, title) {
        const soft = data && [403, 404, 409, 422].includes(Number(data.status));

        alert({
            icon:     soft ? 'warning' : 'error',
            title:    title,
            text:     (data && data.message) || 'Revisa la conexión y vuelve a intentar.',
            btn1:     true,
            btn1Text: 'Entendido'
        });
    }
}
