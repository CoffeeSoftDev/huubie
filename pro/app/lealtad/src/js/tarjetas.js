/*  Lealtad › Tarjetas (antes Ventas › Puntos, V4 del plan de Ventas).

    Dos pestañas: «Tipos de tarjeta» (qué da y de qué color se dibuja), que es
    la que abre, y «Tarjetas» (el plástico: número, titular y, si se quiere, un
    cliente dueño).
    Un tipo da descuento O puntos, nunca los dos; el ctrl también lo revisa.
    No se borra: se desactiva. Una tarjeta inactiva, o con su tipo inactivo,
    deja de leerse en «Vender».

    La tarjeta no guarda saldo: los puntos caen en el monedero del cliente y se
    gastan pagando con «Monedero». Leer la tarjeta al cobrar es de «Vender»;
    esta página solo las administra (hoy, solo el Dueño).

    Los dos formularios llevan a la izquierda el dibujo de la tarjeta, que se
    repinta con lo que se escribe. El color es el de su tipo (card_type.color);
    sin color, el celeste claro que manda el ctrl en dataInit.cardColor.

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
        this.requests     = { cards: 0, types: 0 };
        this.pageLength   = { cards: 15, types: 15 };
        this.saving       = false;
        this.term         = '';
        this.activeTypes  = 0;

        // Lo que la vista previa necesita del formulario abierto.
        this.formTypes     = [];
        this.formCustomers = [];

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
                    opc:         'input',
                    id:          'q',
                    lbl:         'Buscar',
                    type:        'search',
                    placeholder: 'Número, titular, tipo o cliente',
                    required:    false,
                    class:       'col-6 col-md-5 col-lg-4 col-xl-3'
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

    // -- Tarjetas --

    async lsCards() {
        const request = ++this.requests.cards;

        $('#tableLoyCards').addClass('opacity-50');

        const data = await useFetch({ url: this._link, data: { opc: 'lsCards', status: $('#loyc_status').val() || '1' } });

        if (request !== this.requests.cards) return;

        const loaded = Boolean(data && data.status == 200);

        if (!loaded) alert({ icon: 'error', title: 'No se pudo cargar la lista', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });

        if (loaded) this.activeTypes = Number(data.types) || 0;

        $('#tableLoyCards').removeClass('opacity-50');

        this.createCoffeeTable3({
            parent:  'tableLoyCards',
            id:      'tbLoyCards',
            theme:   'light',
            data:    loaded && data.row ? data : { thead: [], row: [] },
            striped: true,
            hover:   true,
            f_size:  13,
            center:  [4, 5, 6],
            ...LOY_TABLE,
            ...this.emptyCards(loaded)
        });

        if (!loaded || !data.row || !data.row.length) return;

        this.dataTable('tbLoyCards', 'cards', 'tarjetas', 'Ninguna tarjeta coincide con la búsqueda');
    }

    addCard() {
        this.formCard(0);
    }

    editCard(id) {
        this.formCard(id);
    }

    // Con id 0 es un alta: el ctrl solo devuelve las opciones del formulario.
    async formCard(id) {
        if (this.saving) return;

        const data = await useFetch({ url: this._link, data: { opc: 'getCard', id: id } });

        if (!data || data.status != 200) return this.fail(data, 'No se pudo abrir la tarjeta');

        const card  = data.row || null;
        const types = data.types || [];
        const scope = dataInit.scope || {};

        if (!types.length) return this.needType();

        this.formTypes     = types;
        this.formCustomers = data.customers || [];

        this.csModal({
            id:         'modalLoyCard',
            title:      card ? 'Editar tarjeta' : 'Nueva tarjeta',
            subtitle:   scope.branch ? `Sucursal ${scope.branch}` : '',
            lucideIcon: card ? 'pencil' : 'credit-card',
            width:      'max-w-3xl',
            saveText:   card ? 'Guardar cambios' : 'Agregar tarjeta',
            cancelText: 'Cancelar',
            json: [
                { id: 'lc_preview', tipo: 'html', class: 'loy-preview', html: this.cardFace() },
                { id: 'lc_number', lbl: 'Número', required: true, maxlength: 40, ph: 'Escríbelo o léelo con el lector', value: card ? card.number : '', help: 'Letras, números y guiones. No se repite en la sucursal.', class: 'w-full' },
                { id: 'lc_type', lbl: 'Tipo de tarjeta', tipo: 'select', required: true, data: types, value: card ? card.card_type_id : (types.length === 1 ? types[0].id : ''), class: 'w-full' },
                { id: 'lc_holder', lbl: 'Titular', maxlength: 150, ph: 'Opcional: el nombre impreso', value: card ? card.holder : '', class: 'w-full' },
                { id: 'lc_customer', lbl: 'Cliente', tipo: 'select2', data: this.formCustomers, empty: 'Sin cliente', value: card ? card.customer_id : '', class: 'w-full' }
            ],
            onSave: (values, close) => this.saveCard(card, values, close)
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

        this.saving = true;

        const button = $('#modalLoyCard .cs-modal-save').prop('disabled', true);
        const data   = await useFetch({
            url:  this._link,
            data: { opc: card ? 'editCard' : 'addCard', id: card ? card.id : 0, number: number, holder: holder, card_type_id: type, customer_id: customer }
        });

        this.saving = false;
        button.prop('disabled', false);

        if (!data || data.status != 200) return this.fail(data, 'No se guardó la tarjeta');

        close();
        alert({ icon: 'success', title: data.message, timer: 1400 });
        this.lsCards();
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
        this.lsCards();
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

    // -- Tipos de tarjeta --

    async lsCardTypes() {
        const request = ++this.requests.types;

        $('#tableLoyTypes').addClass('opacity-50');

        const data = await useFetch({ url: this._link, data: { opc: 'lsCardTypes', status: $('#loyt_status').val() || '1' } });

        if (request !== this.requests.types) return;

        const loaded = Boolean(data && data.status == 200);

        if (!loaded) alert({ icon: 'error', title: 'No se pudo cargar la lista', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });

        $('#tableLoyTypes').removeClass('opacity-50');

        this.createCoffeeTable3({
            parent:  'tableLoyTypes',
            id:      'tbLoyTypes',
            theme:   'light',
            data:    loaded && data.row ? data : { thead: [], row: [] },
            striped: true,
            hover:   true,
            f_size:  13,
            center:  [2, 3, 4],
            ...LOY_TABLE,
            ...this.emptyTypes(loaded)
        });

        if (!loaded || !data.row || !data.row.length) return;

        this.dataTable('tbLoyTypes', 'types', 'tipos', 'Ningún tipo coincide con la búsqueda');
    }

    addType() {
        this.formType(null);
    }

    async editType(id) {
        const data = await useFetch({ url: this._link, data: { opc: 'getCardType', id: id } });

        if (!data || data.status != 200 || !data.row) return this.fail(data, 'No se pudo abrir el tipo de tarjeta');

        this.formType(data.row);
    }

    /*  Un tipo da descuento O puntos. Uno de antes de esa regla puede traer los
        dos: abre en «Descuento», avisa y, al cambiar el beneficio, trae el
        porcentaje que tenía el otro. */
    formType(type) {
        if (this.saving) return;

        const scope    = dataInit.scope || {};
        const discount = type ? Number(type.discount_percent) || 0 : 0;
        const points   = type ? Number(type.points_percent) || 0 : 0;
        const both     = discount > 0 && points > 0;
        const benefit  = points > 0 && discount <= 0 ? 'points' : 'discount';
        const percent  = benefit === 'points' ? points : discount;
        const json     = [
            { id: 'lt_preview', tipo: 'html', class: 'loy-preview', html: this.cardFace() },
            { id: 'lt_name', lbl: 'Nombre', required: true, maxlength: 80, ph: 'Ej. Oro, Cliente frecuente', value: type ? type.name : '', class: 'w-full' },
            { id: 'lt_benefit', lbl: 'Beneficio', tipo: 'select', required: true, empty: false, data: [{ id: 'discount', valor: 'Descuento al pagar' }, { id: 'points', valor: 'Puntos al monedero' }], value: benefit, class: 'w-full sm:w-1/2' },
            { id: 'lt_percent', lbl: 'Porcentaje (%)', tipo: 'number', required: true, min: 0, max: 100, step: '0.01', ph: '0', value: percent > 0 ? percent : '', class: 'w-full sm:w-1/2' },
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

        // Un color rápido escribe en el campo; el evento input mueve la muestra y repinta.
        $('#modalLoyType').on('click', '.loy-color', (e) => $('#lt_color').val(String($(e.currentTarget).data('color')).toUpperCase()).trigger('input'));

        // «Otro color» abre el selector de la muestra del campo Color; lo elegido llega por su evento input.
        $('#modalLoyType').on('click', '.loy-color-other', () => this.pickColor());

        this.preview('modalLoyType', '#lt_name, #lt_benefit, #lt_percent, #lt_color, #lt_color__pick', () => this.paintType());

        if (!type) $('#lt_name').trigger('focus');
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
        const benefit = $('#lt_benefit').val() === 'points' ? 'points' : 'discount';
        const percent = this.percent($('#lt_percent').val());
        const text    = String($('#lt_color').val() || '').trim();

        if (!name) return this.warn('Escribe el nombre del tipo de tarjeta.');
        if (percent === null) return this.warn('El porcentaje va de 0 a 100, con hasta 2 decimales.');
        if (percent <= 0) return this.warn(benefit === 'points' ? 'Pon cuántos puntos da (%): si no, la tarjeta no hace nada.' : 'Pon cuánto descuenta (%): si no, la tarjeta no hace nada.');
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

    /*  El dibujo de la tarjeta que acompaña a los dos formularios. No es un
        campo: no guarda nada y lo llenan paintCard() y paintType().
        Adorno (aria-hidden): la marca de agua del beneficio (% o estrella, según
        data-benefit). Es de un solo color; la forma que distingue al beneficio
        (cupón o moneda) la pone el CSS. Sin chip: no es tarjeta de banco. */
    cardFace() {
        const scope = dataInit.scope || {};
        const svg   = (cls, paths) => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

        return `
            <div class="loy-card" data-ink="dark" data-benefit="" style="--loy-color:${this.defaultColor()}">
                <span class="loy-card-mark" aria-hidden="true">
                    ${svg('is-discount', '<line x1="19" x2="5" y1="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>')}
                    ${svg('is-points', '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>')}
                </span>
                <div class="loy-card-top">
                    <span class="loy-card-type"></span>
                    <span class="loy-card-brand">${esc(scope.branch || '')}</span>
                </div>
                <p class="loy-card-number"></p>
                <div class="loy-card-bottom">
                    <div class="loy-card-owner">
                        <span class="loy-card-label">Titular</span>
                        <span class="loy-card-holder"></span>
                    </div>
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
            caption:  this.cardCaption(type, customer)
        });
    }

    // El tipo con su color y su único beneficio; abajo, qué hace en pesos y la nota del beneficio elegido.
    paintType() {
        const modal   = $('#modalLoyType');
        const name    = String($('#lt_name').val() || '').trim().replace(/\s+/g, ' ');
        const benefit = $('#lt_benefit').val() === 'points' ? 'points' : 'discount';
        const percent = this.percent($('#lt_percent').val()) || 0;
        const color   = this.pickedColor();

        this.paintFace('modalLoyType', {
            color:    color,
            type:     name,
            discount: benefit === 'discount' ? percent : 0,
            points:   benefit === 'points' ? percent : 0,
            caption:  this.typeCaption(benefit, percent)
        });

        modal.find('.loy-note').text(benefit === 'points'
            ? 'Los puntos son dinero a favor: van al monedero del cliente y se gastan pagando con «Monedero». Lo pagado con Monedero y lo que queda a crédito no da puntos.'
            : 'El descuento se aplica al leer la tarjeta en Vender. Esa venta ya no admite otro descuento.');

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
        Lo animado, solo al cambiar: color → se funde (is-painted prende esa transición
        después del primer pintado, para que al abrir no se funda desde el celeste);
        beneficio → entra su marca de agua; solo el porcentaje → el sello da un salto.
        data-benefit cambia la forma (cupón o moneda); eso y la entrada son del CSS. */
    paintFace(modal, face) {
        const card     = $(`#${modal} .loy-card`);
        const number   = String(face.number || '').trim();
        const color    = hex6(face.color || this.defaultColor()).toUpperCase();
        const discount = Number(face.discount) > 0;
        const points   = Number(face.points) > 0;
        const benefit  = discount && points ? 'both' : (points ? 'points' : (discount ? 'discount' : ''));
        const perk     = (value, label) => (Number(value) > 0 ? `<span class="loy-card-perk"><b>${this.pct(value)}</b>${label}</span>` : '');
        const perks    = perk(face.discount, 'descuento') + perk(face.points, 'puntos');
        const before   = card.data('face');

        card[0].style.setProperty('--loy-color', color);
        card.attr({ 'data-ink': this.inkOf(color), 'data-benefit': benefit });

        card.find('.loy-card-type').text(face.type || 'Tipo de tarjeta').toggleClass('is-empty', !face.type);
        card.find('.loy-card-number').text(number || '0000-0000').toggleClass('is-empty', !number).toggleClass('is-long', number.length > 16);
        card.find('.loy-card-holder').text(face.holder || 'Al portador').toggleClass('is-empty', !face.holder);
        card.find('.loy-card-perks').html(perks);

        if (before) {
            if (before.benefit !== benefit && benefit) this.replay(card.find('.loy-card-mark')[0], 'is-in');
            else if (before.perks !== perks && perks) this.replay(card.find('.loy-card-perks')[0], 'is-pop');
        } else {
            void card[0].offsetWidth;
            card.addClass('is-painted');
        }

        card.data('face', { color: color, benefit: benefit, perks: perks });

        $(`#${modal} .loy-card-caption`).text(face.caption);
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

    // A quién le sirve la tarjeta y a dónde van sus puntos.
    cardCaption(type, customer) {
        if (!type) return 'Elige el tipo: dice si la tarjeta da descuento o puntos, y de qué color se ve.';

        const points = Number(type.points) > 0;

        if (customer) return `Solo vale en compras de ${customer.name}` + (points ? '; los puntos van a su monedero.' : '.');

        return 'Sin cliente: vale para quien la presente' + (points ? ' y los puntos van al cliente de esa venta.' : '.');
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

    // Un cambio en un tipo también se ve en la lista de tarjetas (nombre, beneficio y color).
    reload() {
        this.lsCardTypes();
        this.lsCards();
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

    emptyTypes(loaded) {
        if (!loaded) return { emptyMessage: 'No se pudo cargar la lista de tipos de tarjeta', emptyIcon: 'icon-attention' };

        return { emptyMessage: 'No hay tipos de tarjeta con este filtro', emptyIcon: 'icon-tags' };
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
