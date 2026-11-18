/*  Lealtad › Tarjetas (antes Ventas › Puntos, V4 del plan de Ventas).

    Un tablero, sin pestañas. Arriba, el resumen: tarjetas activas y saldo en
    monederos, de hoy; ventas con tarjeta, descuento dado y puntos abonados,
    del mes. «Programa» (registro solo y mensajes que salen solos) es su
    propia sección, Lealtad › Programa (programa.php y programa.js): su código
    sigue en esta clase y aquella página la hereda.
    «Tipos de tarjeta» es una galería con filtro Activos / Inactivos / Todos:
    cada tipo es su tarjeta, de su color, con lo que da y adentro cuántas
    tarjetas tiene y lo que vendió en el mes; debajo, sus botones y el menú ⋯
    (un clic en la tarjeta o «Ver tarjetas» filtra la lista de abajo y la
    lleva a la vista). A un lado, «Niveles y beneficios» (la escalera) y
    «Mecánicas» (un interruptor por tipo para activarlo o desactivarlo).
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
    repinta con lo que se escribe. Sigue el estilo de los pases de Wallet
    (lealtad/docs/propuesta-diseno.html): degradado del color de su tipo
    (card_type.color) con un brillo encima; sin color, el celeste claro que
    manda el ctrl en dataInit.cardColor.

    Esta página no carga el detalle, el turno ni el cobro de Pedidos: esc(),
    money() y LOY_TABLE van aquí abajo, en «Ayudantes». */

let api = 'ctrl/ctrl-tarjetas.php';
let loyalty;
let dataInit = {};

$(async () => {
    // Lealtad › Programa carga este archivo como librería (la clase Loyalty) y arranca su propia página (programa.js).
    if (typeof LoyaltyProgramPage === 'function') return;

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

// Imprime un documento en un iframe escondido (el ordPrintDoc de Pedidos, que esta página no carga).
function loyPrintDoc(title, css, body) {
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(title)}</title>
        <style>${css}</style></head><body>${body}</body></html>`;

    $('#loyPrintFrame').remove();

    const frame = $('<iframe>', { id: 'loyPrintFrame', title: 'Impresión', 'aria-hidden': 'true' })
        .css({ position: 'fixed', right: 0, bottom: 0, width: 0, height: 0, border: 0, visibility: 'hidden' })
        .appendTo('body')
        .get(0);

    const doc = frame.contentWindow.document;

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
        // Otra impresión ya quitó este iframe.
        if (!frame.contentWindow) return;

        frame.contentWindow.focus();
        frame.contentWindow.print();
    }, 250);
}

// -- Loyalty --

class Loyalty extends Templates {

    // -- Initial --

    constructor(link, div_modulo) {
        super(link, div_modulo);
        this.PROJECT_NAME = 'Loyalty';
        this.tab          = 'types';
        this.requests     = { cards: 0, types: 0, summary: 0, program: 0 };
        this.pageLength   = { cards: 15 };
        this.saving       = false;
        this.term         = '';
        this.activeTypes  = 0;
        this.cardType     = 'all';
        this.galleryShown = false;

        // Todos los tipos que mandó lsCardTypes y el filtro de la galería ('1' activos, '0' inactivos, 'all').
        this.types      = [];
        this.typeStatus = '1';

        // Lo que la vista previa necesita del formulario abierto.
        this.formTypes     = [];
        this.formCustomers = [];

        // El enlace de la ventana «Tarjeta digital» abierta.
        this.shareData = null;

        // La ficha con sus botones (Editar, Tarjeta digital, Cambiar cumpleaños). En Programa se abre solo para leer.
        this.cardActions = true;

        // Lo último que mandó getProgram (Lealtad › Programa) y el mensaje elegido en su lista.
        this.program     = null;
        this.programPick = '';

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

        this.board();
        this.filterCards();
        this.lsCardTypes();
        this.lsCards();
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

    /*  La página como tablero (el estilo del panel SaaS de Rewardix, igual que
        Programa): «Tipos de tarjeta» (la galería, con su filtro en píldoras) y,
        a la derecha, «Niveles y beneficios» y «Mecánicas» (cada tipo con su
        interruptor); abajo, «Tarjetas» (filtros y la lista). Las tarjetas del
        tablero entran una tras otra (--i). El resumen va arriba, aparte. */
    board() {
        const box = (id, cls, i) => $('<section>', { id: id, class: `loy-bx ${cls}`, style: `--i:${i}` });

        $(`#body${this.PROJECT_NAME}`).empty().append(
            $('<div>', { id: `board${this.PROJECT_NAME}`, class: 'loy-board is-cards' }).append(
                box('lbTypes', 'is-types', 1).append(
                    this.boxHead('layers', 'Tipos de tarjeta', null).append($('<div>', { id: 'lbTypeSeg', class: 'loy-seg-wrap' })),
                    $('<div>', { id: 'tableLoyTypes', class: 'w-full' })
                ),
                $('<div>', { class: 'loy-side' }).append(
                    box('lbLevels', 'is-levels', 2),
                    box('lbMechs', 'is-mechs', 3)
                ),
                // Los filtros van fuera de la tabla: createCoffeeTable3 la reescribe y el buscador perdería el foco.
                box('lbCards', 'is-list', 4).append(
                    this.boxHead('credit-card', 'Tarjetas', ['', '']),
                    $('<div>', { id: 'filterLoyCards', class: 'w-full mb-[14px]' }),
                    $('<div>', { id: 'tableLoyCards', class: 'w-full' })
                )
            )
        );
    }

    /*  El filtro de la galería en píldoras (Activos, Inactivos, Todos) con su
        cuenta. La marca blanca se desliza a la elegida; al cambiar, la galería
        vuelve a entrar en cascada. Filtra lo que ya llegó: no pide nada. */
    typeSeg() {
        const types = this.types || [];
        const count = { '1': types.filter((t) => t.active).length, '0': types.filter((t) => !t.active).length, all: types.length };
        const opts  = [['1', 'Activos'], ['0', 'Inactivos'], ['all', 'Todos']];
        const seg   = $('<div>', { class: 'loy-seg', role: 'tablist', 'aria-label': 'Estado de los tipos' }).append($('<span>', { class: 'loy-seg-ind', 'aria-hidden': 'true' }));

        opts.forEach(([value, text]) => seg.append($('<button>', {
            type:            'button',
            role:            'tab',
            class:           'loy-seg-b' + (value === this.typeStatus ? ' is-on' : ''),
            'aria-selected': String(value === this.typeStatus),
            'data-status':   value,
            click:           () => this.pickTypeStatus(value)
        }).append(document.createTextNode(text), $('<em>').text(count[value]))));

        $('#lbTypeSeg').empty().append(seg);
        this.moveSeg(true);

        // Si cambia el ancho, la marca se vuelve a poner bajo su píldora.
        $(window).off('resize.loySeg').on('resize.loySeg', () => this.moveSeg(true));
    }

    // La marca del filtro se desliza bajo la píldora elegida (now: sin deslizarse, al pintar).
    moveSeg(now = false) {
        const seg = $('#lbTypeSeg .loy-seg');
        const on  = seg.find('.loy-seg-b.is-on')[0];
        const ind = seg.find('.loy-seg-ind');

        if (!on) return;

        ind.toggleClass('is-now', now).css({ transform: `translateX(${on.offsetLeft}px)`, width: `${on.offsetWidth}px` });

        if (now) requestAnimationFrame(() => ind.removeClass('is-now'));
    }

    pickTypeStatus(value) {
        if (value === this.typeStatus) return;

        this.typeStatus = value;

        $('#lbTypeSeg .loy-seg-b').each((i, el) => $(el).toggleClass('is-on', el.dataset.status === value).attr('aria-selected', String(el.dataset.status === value)));
        this.moveSeg();

        // Que vuelvan a entrar en cascada.
        this.galleryShown = false;
        this.paintTypes();
    }

    // La galería con el filtro de las píldoras (sobre todos los tipos que mandó el ctrl).
    paintTypes() {
        const list = (this.types || []).filter((t) => this.typeStatus === 'all' || (this.typeStatus === '1' ? t.active : !t.active));

        if (list.length) return this.gallery(list);

        this.emptyGallery(true);
    }

    /*  «Niveles y beneficios»: la escalera (tipos activos con gasto mínimo, del
        más bajo al más alto) en cuadros con su estrella (vacía, media y llena en
        el más alto) y, abajo, una barra con cuántas tarjetas hay en cada nivel,
        del color de cada tipo; los tramos crecen al entrar. Con menos de 2
        niveles, cómo armarla. */
    renderLevels() {
        const levels = (this.types || []).filter((t) => t.active && t.levelPlace > 0).sort((a, b) => a.levelPlace - b.levelPlace);
        const box    = $('#lbLevels').empty();
        const total  = levels.reduce((sum, t) => sum + (Number(t.cards) || 0), 0);

        box.append(this.boxHead('trophy', 'Niveles y beneficios', levels.length >= 2 ? [`${levels.length} niveles`, ''] : null));

        if (levels.length < 2) {
            box.append(
                $('<p>', { class: 'loy-msg-lead' }).text('Arma la escalera: tipos de descuento o de puntos con un gasto mínimo en 12 meses. La tarjeta sube sola cuando su cliente lo alcanza.'),
                this.allow('create') ? $('<div>', { class: 'loy-prog-acts mt-[12px]' }).append(this.jq(this.tileButton('plus', 'Crear un nivel', () => this.pickStructure('top')))) : null
            );

            return;
        }

        const star = (i) => i === levels.length - 1 ? 'star' : (i === 0 ? 'star' : 'star-half');

        box.append(
            $('<div>', { class: 'loy-tiers' }).append(levels.map((t, i) => $('<div>', { class: 'loy-tier' + (t.levelTop ? ' is-top' : ''), style: `--c:${t.color};--k:${i}` }).append(
                $('<span>', { class: 'loy-tier-ic' + (i === 0 ? ' is-empty' : ''), html: `<i data-lucide="${star(i)}" class="w-4 h-4" aria-hidden="true"></i>` }),
                $('<b>').text(t.name),
                $('<small>').text(this.moneyShort(t.levelMin)),
                $('<span>', { class: 'loy-tier-perk' }).text(t.discount > 0 ? `${this.pct(t.discount)} descuento` : `${this.pct(t.points)} puntos`)
            ))),
            $('<div>', { class: 'loy-dist', role: 'img', 'aria-label': total ? `Tarjetas por nivel: ${levels.map((t) => `${t.cards} en ${t.name}`).join(', ')}` : 'Aún no hay tarjetas en los niveles' }).append(
                total ? levels.map((t) => $('<i>', { style: `--c:${t.color};--w:${(Number(t.cards) || 0) / total * 100}%` })) : null
            ),
            $('<p>', { class: 'loy-dist-l' }).text(total ? levels.map((t) => `${t.cards} en ${t.name}`).join(' · ') : 'Aún no hay tarjetas en los niveles')
        );

        // Los tramos crecen desde cero.
        requestAnimationFrame(() => requestAnimationFrame(() => box.find('.loy-dist i').each((i, el) => { el.style.width = el.style.getPropertyValue('--w'); })));
    }

    /*  «Mecánicas»: cada tipo con su color, lo que da y su interruptor
        (activo o inactivo). El interruptor pregunta antes (statusType). */
    renderMechs() {
        const types = this.types || [];
        const on    = types.filter((t) => t.active).length;
        const edit  = this.allow('update');

        $('#lbMechs').empty().append(
            this.boxHead('sliders-horizontal', 'Mecánicas', [`${on} de ${types.length} activas`, on ? 'is-ok' : 'is-off']),
            types.length
                ? $('<div>', { class: 'loy-mechs' }).append(types.map((t, i) => $('<div>', { class: 'loy-mech' + (t.active ? '' : ' is-off'), style: `--k:${i}` }).append(
                    $('<span>', { class: 'loy-mech-dot', style: `--c:${t.color}`, 'aria-hidden': 'true' }),
                    $('<span>', { class: 'loy-mech-t' }).append($('<b>').text(t.name), $('<small>').text(t.benefit || '')),
                    $('<button>', {
                        type:           'button',
                        role:           'switch',
                        class:          'loy-switch' + (t.active ? ' is-on' : ''),
                        'aria-checked': String(t.active),
                        'aria-label':   `${t.name}: ${t.active ? 'activo' : 'inactivo'}`,
                        disabled:       !edit,
                        click:          () => this.statusType(t.id, t.active ? 0 : 1)
                    })
                )))
                : $('<p>', { class: 'loy-msg-lead' }).text('Aún no hay tipos de tarjeta.')
        );
    }

    // Lleva la vista a una tarjeta del tablero y la marca un momento (un filo que se enciende y se apaga).
    focusBox(id) {
        const el = document.getElementById(id);

        if (!el) return;

        el.scrollIntoView({ behavior: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
        this.replay(el, 'is-focus');
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

    /*  El resumen como una tarjeta del tablero (loy-bx, el estilo de Programa):
        las cifras en cuadros lilas, y suben al entrar la primera vez (countUp).
        El ctrl manda value ya con formato («$2.40», «3»): se lee el número, sus
        decimales y el «$» para contar con el mismo formato; lo que no sea
        número se pinta tal cual. */
    renderSummary(data) {
        const first = !this.summaryShown;
        const tiles = data.tiles.map((t) => {
            const m     = String(t.value).match(/^(\$?)([\d,]+)(?:\.(\d+))?$/);
            const value = m ? Number(m[2].replace(/,/g, '') + (m[3] ? `.${m[3]}` : '')) : null;
            const big   = $('<b>', { class: 'loy-kpi-v' }).text(t.value);

            if (m && first) big.attr({ 'data-count': value, 'data-pre': m[1], 'data-dec': m[3] ? m[3].length : 0 }).text(`${m[1]}0`);

            return $('<div>', { class: 'loy-kpi' }).append(
                $('<span>', { class: 'loy-kpi-l', html: `<i data-lucide="${esc(t.icon)}" class="w-3.5 h-3.5" aria-hidden="true"></i>` }).append(document.createTextNode(t.label)),
                big,
                $('<small>').text(t.hint || '')
            );
        });

        $(`#summary${this.PROJECT_NAME}`).empty().append(
            $('<div>', { id: `summaryBody${this.PROJECT_NAME}`, class: 'loy-bx is-summary' + (first ? '' : ' is-still') }).append(
                this.boxHead('chart-no-axes-column', 'Resumen', [data.note || '', '']),
                $('<div>', { class: 'loy-kpis is-wide' }).append(tiles)
            )
        ).removeClass('hidden');

        if (first) this.countUp($(`#summary${this.PROJECT_NAME} [data-count]`));

        this.summaryShown = true;

        if (window.lucide) lucide.createIcons();
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

        // La cuenta en la etiqueta de la tarjeta «Tarjetas» del tablero.
        const count = loaded ? Number(data.count) || 0 : 0;

        $('#lbCards .loy-bx-h .loy-chip').text(loaded ? `${count} ${count === 1 ? 'tarjeta' : 'tarjetas'}` : '');

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

    // «Ver tarjetas» de la galería: filtra la lista por ese tipo y lleva la vista hasta ella.
    showCards(typeId) {
        this.cardType = String(typeId);
        this.lsCards();
        this.focusBox('lbCards');
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
            action:     this.cardActions && this.allow('update') ? { text: 'Editar', lucideIcon: 'pencil', onClick: () => { modal.close(); this.editCard(card.id); } } : null,
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
            reward:   card.reward,
            caption:  ''
        });

        // «Tarjeta digital» cierra la ficha y abre su ventana (dos csModal a la vez se enciman).
        this.detailSide(card, data.totals || [], () => { modal.close(); this.shareCard(card.id); });
        this.detailBirthday(card, data.birthday, () => { modal.close(); this.formCardBirthday(card, data.birthday); });
        this.detailStamps(card);
        this.detailLevel(data.level, card.color);
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
                    { type: 'div', id: 'ldBirthday', class: 'w-full' },
                    { type: 'div', id: 'ldStamps', class: 'w-full' },
                    { type: 'div', id: 'ldLevel', class: 'w-full' },
                    { type: 'div', class: 'loy-detail-acts', children: this.cardActions ? [this.tileButton('qr-code', 'Tarjeta digital', share)] : [] },
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

    /*  Bajo el cliente: su cumpleaños, si acepta mensajes y cómo le fue este año.
        Solo si la tarjeta tiene cliente (el cumpleaños es del cliente). «Cambiar»
        cierra la ficha y abre la ventanita (dos csModal a la vez se enciman). */
    detailBirthday(card, b, edit) {
        if (!b) return $('#ldBirthday').remove();

        const lines = [
            { type: 'p', class: 'loy-bday-date', html: `<i data-lucide="cake" class="w-4 h-4" aria-hidden="true"></i>${b.text ? esc(b.text) : '<span class="is-empty">Sin cumpleaños</span>'}` },
            { type: 'p', class: 'loy-bday-sub', text: [b.optin, b.status].filter(Boolean).join(' · ') }
        ];

        this.createLayout({
            parent: 'ldBirthday',
            design: false,
            data: {
                id:    'ldBirthdayBody',
                class: 'loy-bday',
                container: [
                    { type: 'div', id: 'ldBirthdayText', class: 'min-w-0 flex-1' },
                    ...(this.cardActions && this.allow('update') ? [{ type: 'div', class: 'shrink-0', children: [this.tileButton('pencil', b.text ? 'Cambiar' : 'Agregar', edit)] }] : [])
                ]
            }
        });

        this.createLayout({ parent: 'ldBirthdayText', design: false, data: { id: 'ldBirthdayLines', class: 'flex flex-col gap-[2px]', container: lines } });
    }

    /*  Bajo el cumpleaños: su nivel y la barra hacia el siguiente («Faltan $1,240
        para VIP»), del mínimo de su nivel al del siguiente; en el más alto, llena. */
    detailLevel(l, color) {
        if (!l) return $('#ldLevel').remove();

        const bar = l.bar || { head: l.text, side: '', pct: 0, top: false };

        this.progressBox('ldLevel', {
            icon:  'trophy',
            title: l.title,
            head:  bar.head,
            side:  bar.side,
            pct:   bar.pct,
            color: color,
            foot:  ['Gasto de los últimos 12 meses.', l.note].filter(Boolean).join(' ')
        });
    }

    /*  Tarjeta de sellos: la barra hacia el premio («Faltan 3 sellos para Café
        gratis · 7 de 10») y, en pesos, cuánto le falta comprar. */
    detailStamps(card) {
        const goal = Number(card.goal) || 0;

        if (goal <= 0) return $('#ldStamps').remove();

        const have   = Math.max(0, Number(card.stamps) || 0);
        const left   = Math.max(0, goal - have);
        const reward = card.reward || 'su premio';

        this.progressBox('ldStamps', {
            icon:  card.icon || 'stamp',
            title: '',
            head:  left <= 0 ? `Premio listo: ${reward}` : `Faltan ${left} ${left === 1 ? 'sello' : 'sellos'} para ${reward}`,
            side:  `${Math.min(have, goal)} de ${goal}`,
            pct:   Math.min(100, (have / goal) * 100),
            color: card.color,
            foot:  left <= 0 ? 'Lo canjea en Vender cuando quiera.' : `Unos ${this.moneyShort(left * (Number(card.stampAmount) || 0))} más en compras · los sellos no caducan.`
        });
    }

    /*  Una caja de avance de la ficha: título (opcional), qué falta, la cifra a la
        derecha y la barra del color de la tarjeta, que se llena al abrir. */
    progressBox(parent, p) {
        const box = $('<div>', { class: 'loy-progress', style: `--loy-bar:${hex6(p.color || this.defaultColor())}` });

        if (p.title) box.append($('<p>', { class: 'loy-progress-title', html: `<i data-lucide="${esc(p.icon)}" class="w-4 h-4" aria-hidden="true"></i>` }).append(document.createTextNode(p.title)));

        const fill = $('<i>').css('width', '0%');

        box.append(
            $('<div>', { class: 'loy-progress-top' }).append($('<b>').text(p.head), $('<span>').text(p.side)),
            $('<div>', { class: 'loy-progress-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(p.pct) }).append(fill),
            p.foot ? $('<small>').text(p.foot) : null
        );

        $(`#${parent}`).empty().append(box);

        // Al siguiente cuadro: así la barra se llena con su transición.
        requestAnimationFrame(() => requestAnimationFrame(() => fill.css('width', `${Math.max(0, Math.min(100, Number(p.pct) || 0))}%`)));
    }

    // Día y mes (el año no se pide). Al guardar vuelve a la ficha.
    formCardBirthday(card, b) {
        if (this.saving) return;

        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        this.csModal({
            id:         'modalLoyCardBirthday',
            title:      'Cumpleaños',
            subtitle:   [card.customer, `Tarjeta ${card.number}`].filter(Boolean).join(' · '),
            lucideIcon: 'cake',
            width:      'max-w-md',
            saveText:   'Guardar',
            cancelText: 'Cancelar',
            json: [
                { id: 'lcb_day', lbl: 'Día', tipo: 'select', data: Array.from({ length: 31 }, (_, i) => ({ id: i + 1, valor: String(i + 1) })), value: b && b.day ? b.day : '', class: 'w-full sm:w-1/3' },
                { id: 'lcb_month', lbl: 'Mes', tipo: 'select', data: months.map((m, i) => ({ id: i + 1, valor: m })), value: b && b.month ? b.month : '', class: 'w-full sm:w-2/3' },
                { id: 'lcb_note', tipo: 'html', class: 'w-full', html: '<p class="loy-note">Para la felicitación y el regalo de cumpleaños. Deja los dos vacíos para borrarlo.</p>' }
            ],
            onSave: (values, close) => this.saveCardBirthday(card, close)
        });
    }

    async saveCardBirthday(card, close) {
        if (this.saving) return;

        const day   = Number($('#lcb_day').val() || 0);
        const month = Number($('#lcb_month').val() || 0);

        if ((day || month) && !(day && month)) return this.warn('Elige el día y el mes, o deja los dos vacíos para borrarlo.');

        this.saving = true;

        const button = $('#modalLoyCardBirthday .cs-modal-save').prop('disabled', true);
        const res    = await useFetch({ url: this._link, data: { opc: 'setBirthday', id: card.id, day: day, month: month } });

        this.saving = false;
        button.prop('disabled', false);

        if (!res || res.status != 200) return this.fail(res, 'No se guardó el cumpleaños');

        close();

        alert({ icon: 'success', title: res.message, timer: 1200 });

        this.viewCard(card.id);

        if (this.program) this.lsProgram();
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

    // -- Programa --

    /*  Lo que hace crecer el programa solo (docs/plan-crecimiento.html). Hoy:
        «Registro solo», un QR por sucursal (registro.php) donde el cliente se
        da de alta y recibe la tarjeta de bienvenida al momento. Los ajustes son
        de la empresa; el QR, de la sucursal de arriba. */
    async lsProgram() {
        const request = ++this.requests.program;

        $('#bodyLoyProgram').addClass('opacity-50');

        const data = await useFetch({ url: this._link, data: { opc: 'getProgram' } });

        if (request !== this.requests.program) return;

        $('#bodyLoyProgram').removeClass('opacity-50');

        if (!data || data.status != 200 || !data.signup) return this.fail(data, 'No se pudo cargar el programa');

        this.program = data;
        this.renderProgram(data);
    }

    /*  Lealtad › Programa como tablero, al estilo del panel SaaS de Rewardix:
        tarjetas blancas en mosaico sobre el fondo, cada una con su icono en un
        cuadro de la marca. Arriba, «Cómo entran los clientes» y «Este mes»;
        abajo, «Mensajes que salen solos» con su interruptor, el detalle del
        elegido y, a la derecha, «Así le llega» (el teléfono).
        Movimiento: las tarjetas entran una tras otra (--i) y las cifras suben;
        la marca de la lista se desliza al renglón elegido; el teléfono «escribe»
        antes de enseñar el mensaje. Al repintar después de guardar
        (programShown) ya no se repite la entrada. Con «reducir movimiento», nada se mueve. */
    renderProgram(data) {
        const still = Boolean(this.programShown);
        const boxes = ['lpSignup', 'lpStats', 'lpMsgs', 'lpPhone', 'lpDetail'];

        this.createLayout({
            parent: 'bodyLoyProgram',
            design: false,
            data: {
                id:        'programLoy',
                class:     'loy-board' + (still ? ' is-still' : ''),
                container: [
                    { type: 'div', id: 'lpSignup', class: 'loy-bx is-entry' + (data.signup.live ? '' : ' is-off') },
                    { type: 'div', id: 'lpStats', class: 'loy-bx is-stats' },
                    { type: 'div', id: 'lpMsgs', class: 'loy-bx is-msgs' },
                    { type: 'div', id: 'lpPhone', class: 'loy-bx is-phone' },
                    { type: 'div', id: 'lpDetail', class: 'loy-bx is-detail' }
                ]
            }
        });

        boxes.forEach((id, i) => document.getElementById(id).style.setProperty('--i', String(i)));

        this.renderSignup(data);
        this.renderStats(data, still);
        this.renderMessages(data);

        this.programShown = true;

        if (window.lucide) lucide.createIcons();
    }

    /*  El encabezado de una tarjeta del tablero: el icono en su cuadro (gradiente
        de la marca, o el del mensaje con --g), el título y, a la derecha, una
        etiqueta: [texto, tono] con tono '' | 'is-ok' | 'is-off' | 'is-warn'
        ('is-live' le pone el punto que late). */
    boxHead(icon, title, chip, gradient = '') {
        const head = $('<div>', { class: 'loy-bx-h' }).append(
            $('<span>', { class: 'loy-bx-ic', 'aria-hidden': 'true', style: gradient ? `--g:${gradient}` : null, html: `<i data-lucide="${icon}" class="w-4 h-4"></i>` }),
            $('<h2>', { class: 'loy-bx-t' }).text(title)
        );

        if (chip) head.append($('<span>', { class: `loy-chip ${chip[1] || ''}`.trim() }).text(chip[0]));

        return head;
    }

    // «Cómo entran los clientes»: el QR del registro (con su línea que lo recorre), qué es, cómo está y sus botones.
    renderSignup(data) {
        const s    = data.signup;
        const acts = [];

        if (s.url) {
            acts.push(this.tileButton('printer', 'Cartel', () => this.printPoster()));
            acts.push(this.tileButton('copy', 'Copiar enlace', () => this.copySignupLink()));
            acts.push({ type: 'a', class: 'loy-act', href: s.url, target: '_blank', rel: 'noopener', html: '<i data-lucide="external-link" class="w-4 h-4" aria-hidden="true"></i><span class="loy-act-text">Abrir</span>' });
        }

        if (data.can_edit && s.url) acts.push(this.tileButton('refresh-cw', 'Nuevo enlace', () => this.renewSignupLink()));
        if (data.can_edit) acts.push(this.tileButton('settings-2', 'Configurar', () => this.formSignup()));

        const qr = s.url
            ? $('<figure>', { class: 'loy-entry-qr', role: 'img', 'aria-label': 'QR del registro de la sucursal', html: this.qrSvg(s.url) })
            : $('<span>', { class: 'loy-entry-qr is-empty', 'aria-hidden': 'true', html: '<i data-lucide="qr-code" class="w-7 h-7"></i>' });

        const facts = [
            ['credit-card', s.type ? `Bienvenida: ${s.type}` : 'Sin tarjeta de bienvenida'],
            ['store', `QR de ${s.branch}${s.since ? ` · desde el ${s.since}` : ''}`]
        ];

        const main = $('<div>', { class: 'loy-entry-main' }).append(
            $('<b>', { class: 'loy-entry-name' }).text('Registro solo'),
            $('<p>', { class: 'loy-entry-lead' }).text('Escanean el QR del mostrador, dejan su nombre, su WhatsApp y su cumpleaños, y reciben su tarjeta al momento.'),
            $('<div>', { class: 'loy-entry-facts' }).append(facts.map(([icon, text]) => $('<span>', { html: `<i data-lucide="${icon}" class="w-3.5 h-3.5" aria-hidden="true"></i>` }).append(document.createTextNode(text)))),
            s.note ? $('<p>', { class: 'loy-prog-note' }).text(s.note) : null,
            !s.url ? $('<p>', { class: 'loy-prog-note' }).text('Aún no hay QR en esta sucursal. Pide a quien administra las tarjetas que lo cree desde aquí.') : null
        );

        $('#lpSignup').empty().append(
            this.boxHead('qr-code', 'Cómo entran los clientes', s.live ? ['Encendido', 'is-ok is-live'] : ['Apagado', 'is-off']),
            $('<div>', { class: 'loy-entry-body' }).append(qr, main),
            $('<div>', { class: 'loy-prog-acts' }).append(acts.map((a) => this.jq(a)))
        );
    }

    /*  «Este mes»: 4 cifras que suben al entrar (data-count; countUp). Salen de
        getProgram: los mensajes enviados, los registros, los que volvieron con
        «Te extrañamos» y los que subieron de nivel. */
    renderStats(data, still) {
        const sent  = (data.messages || []).reduce((sum, m) => sum + (Number(m.sent) || 0), 0);
        const wa    = data.whatsapp || {};
        const tiles = [
            ['send', 'Mensajes enviados', sent, wa.simulated ? 'Simulados: sin token de Meta' : 'Por el WhatsApp de la tienda'],
            ['user-round-plus', 'Registros', Number(data.signup.month) || 0, 'Con el QR del mostrador'],
            ['heart-handshake', 'Volvieron', Number((data.winback || {}).back) || 0, 'Después de «Te extrañamos»'],
            ['trophy', 'Subieron de nivel', Number((data.levels || {}).up) || 0, `${Number((data.levels || {}).down) || 0} bajaron`]
        ];

        $('#lpStats').empty().append(
            this.boxHead('chart-no-axes-column', 'Este mes', null),
            $('<div>', { class: 'loy-kpis' }).append(tiles.map(([icon, label, value, hint]) => $('<div>', { class: 'loy-kpi' }).append(
                $('<span>', { class: 'loy-kpi-l', html: `<i data-lucide="${icon}" class="w-3.5 h-3.5" aria-hidden="true"></i>` }).append(document.createTextNode(label)),
                $('<b>', { class: 'loy-kpi-v', 'data-count': value }).text(still ? value.toLocaleString('es-MX') : '0'),
                $('<small>').text(hint)
            )))
        );

        if (!still) this.countUp($('#lpStats [data-count]'));
    }

    /*  Las cifras suben de 0 a su valor (1.1 s, frenando al final), una tras
        otra. data-count: el valor; data-pre: lo de antes («$»); data-dec: los
        decimales. Con «reducir movimiento», salen ya puestas. */
    countUp(els) {
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        els.each((i, el) => {
            const to   = Number(el.dataset.count) || 0;
            const dec  = Number(el.dataset.dec) || 0;
            const pre  = el.dataset.pre || '';
            const show = (n) => pre + n.toLocaleString('es-MX', { minimumFractionDigits: dec, maximumFractionDigits: dec });

            if (reduce || to === 0) return void (el.textContent = show(to));

            let t0 = 0;

            setTimeout(() => requestAnimationFrame(function tick(t) {
                if (!t0) t0 = t;

                const k = Math.min(1, (t - t0) / 1100);
                const n = to * (1 - Math.pow(1 - k, 3));

                el.textContent = show(dec ? n : Math.round(n));

                if (k < 1) requestAnimationFrame(tick);
            }), 250 + i * 90);
        });
    }

    // Un botón de tileButton (objeto de createLayout) hecho elemento, para armar con jQuery.
    jq(o) {
        const { type, ...attrs } = o;

        return $(`<${type}>`, attrs);
    }

    /*  El color de cada mensaje (gradiente de su cuadro), como los iconos del
        panel de Rewardix. */
    messageTone(key) {
        return {
            tarjeta: 'linear-gradient(135deg,#52489C,#8373C5)',
            premio:  'linear-gradient(135deg,#F472B6,#FB923C)',
            cumple:  'linear-gradient(135deg,#FACC15,#F59E0B)',
            regreso: 'linear-gradient(135deg,#0EA5E9,#6366F1)',
            nivel:   'linear-gradient(135deg,#A78BFA,#6D28D9)'
        }[key] || '';
    }

    /*  «Mensajes que salen solos»: un renglón por mensaje con su interruptor (o
        «Siempre»). Detrás de los renglones corre una marca (loy-msg-ind) que se
        desliza al elegido. this.programPick guarda el elegido entre repintadas. */
    renderMessages(data) {
        const list = data.messages || [];
        const wa   = data.whatsapp || {};
        const chip = !wa.ready ? ['Sin WhatsApp', 'is-warn'] : (wa.simulated ? ['Simulado', 'is-warn'] : ['WhatsApp activo', 'is-ok is-live']);

        if (!list.some((m) => m.key === this.programPick)) this.programPick = list.some((m) => m.key === 'cumple') ? 'cumple' : (list[0] ? list[0].key : '');

        $('#lpMsgs').empty().append(
            this.boxHead('message-circle', 'Mensajes que salen solos', chip),
            $('<div>', { id: 'lpMsgList', class: 'loy-msgs', role: 'list' }).append(
                $('<span>', { class: 'loy-msg-ind', 'aria-hidden': 'true' }),
                list.map((m) => this.messageRow(m, data))
            ),
            !wa.ready ? $('<p>', { class: 'loy-prog-note' }).text('La empresa no tiene número de WhatsApp: hoy no sale ninguno. Se da de alta en Ventas › WhatsApp.') : null
        );

        this.pickMessage(this.programPick, true);

        // Si cambia el ancho, los renglones cambian de alto: la marca se vuelve a acomodar en el elegido.
        $(window).off('resize.loyMsg').on('resize.loyMsg', () => {
            const row = $(`#lpMsgList .loy-msg[data-key="${this.programPick}"]`)[0];

            if (!row) return;

            $('#lpMsgList .loy-msg-ind').addClass('is-now').css({ transform: `translateY(${row.offsetTop}px)`, height: `${row.offsetHeight}px` });
            requestAnimationFrame(() => $('#lpMsgList .loy-msg-ind').removeClass('is-now'));
        });
    }

    messageRow(m, data) {
        const picked = m.key === this.programPick;
        const pick   = $('<button>', {
            type:           'button',
            class:          'loy-msg-pick',
            'aria-pressed': String(picked),
            html:           `<span class="loy-msg-icon" aria-hidden="true" style="--g:${this.messageTone(m.key)}"><i data-lucide="${m.icon}" class="w-4 h-4"></i></span>`,
            click:          () => this.pickMessage(m.key)
        }).append(
            $('<span>', { class: 'loy-msg-main' }).append($('<b>').text(m.title), $('<span>').text(m.when)),
            $('<span>', { class: 'loy-msg-count' }).text(m.on || m.sent > 0 ? m.sentText : 'Apagado')
        );

        const state = m.toggle
            ? $('<button>', {
                type:           'button',
                role:           'switch',
                class:          'loy-switch' + (m.on ? ' is-on' : ''),
                'aria-checked': String(m.on),
                'aria-label':   `${m.title}: ${m.on ? 'encendido' : 'apagado'}`,
                disabled:       !data.can_edit,
                click:          () => this.toggleMessage(m)
            })
            : $('<span>', { class: 'loy-msg-always' }).text('Siempre');

        return $('<div>', { class: 'loy-msg' + (picked ? ' is-on' : '') + (m.on ? '' : ' is-off'), 'data-key': m.key, role: 'listitem' }).append(pick, state);
    }

    /*  Elegir un renglón: la marca se desliza hasta él, el teléfono escribe el
        mensaje nuevo y el detalle cambia. first: el pintado inicial (la marca
        llega sin deslizarse). */
    pickMessage(key, first = false) {
        const data = this.program;
        const list = $('#lpMsgList');
        const row  = list.find(`.loy-msg[data-key="${key}"]`);
        const ind  = list.find('.loy-msg-ind');

        this.programPick = key;

        list.find('.loy-msg').each((i, el) => {
            const on = el.dataset.key === key;

            $(el).toggleClass('is-on', on).find('.loy-msg-pick').attr('aria-pressed', String(on));
        });

        if (row.length) {
            ind.toggleClass('is-now', first).css({ transform: `translateY(${row[0].offsetTop}px)`, height: `${row[0].offsetHeight}px` });
            if (first) requestAnimationFrame(() => ind.removeClass('is-now'));
        }

        this.renderPhone(data, first);
        this.renderDetail(data);

        if (window.lucide) lucide.createIcons();
    }

    /*  «Así le llega»: un teléfono de verdad (marco con botones, muesca, barra de
        estado) con el chat de WhatsApp de la tienda. Primero «escribe» (tres
        puntos) y luego entra la burbuja con el texto de la plantilla. phoneSeq
        evita que una burbuja vieja llegue después de cambiar de mensaje. */
    renderPhone(data, first) {
        const m = (data.messages || []).find((x) => x.key === this.programPick);

        if (!m) return $('#lpPhone').empty();

        const business = (data.signup && data.signup.company) || (dataInit.scope || {}).company || 'Tu negocio';
        const ico      = (name, cls = 'w-4 h-4') => `<i data-lucide="${name}" class="${cls}" aria-hidden="true"></i>`;
        const reduce   = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const seq      = (this.phoneSeq = (this.phoneSeq || 0) + 1);
        const bubble   = () => $('<div>', { class: 'loy-wa-bub', html: this.waHtml(m.text) }).append($('<time>').text('10:00'));
        const chat     = $('<div>', { class: 'loy-wa-chat' }).append($('<span>', { class: 'loy-wa-day' }).text('HOY'));

        if (reduce) chat.append(bubble());
        else chat.append('<div class="loy-wa-typing" aria-hidden="true"><i></i><i></i><i></i></div>');

        const phone = $('<div>', { class: 'loy-phone', role: 'img', 'aria-label': `Vista previa en el teléfono del cliente: ${m.title}` }).append(
            $('<div>', { class: 'loy-phone-bezel' }).append(
                $('<div>', { class: 'loy-phone-screen' }).append(
                    '<span class="loy-phone-notch" aria-hidden="true"></span>',
                    $('<div>', { class: 'loy-wa-head' }).append(
                        $('<div>', { class: 'loy-phone-sb', 'aria-hidden': 'true', html: `<span>10:00</span><span>${ico('signal', 'w-3.5 h-3.5')}${ico('wifi', 'w-3.5 h-3.5')}${ico('battery-full', 'w-4 h-4')}</span>` }),
                        $('<div>', { class: 'loy-wa-bar' }).append(
                            ico('arrow-left'),
                            $('<span>', { class: 'loy-wa-av' }).text(business.charAt(0).toUpperCase()),
                            $('<span>', { class: 'loy-wa-who' }).append($('<b>').text(business), $('<small>').text('Cuenta de empresa')),
                            `<span class="loy-wa-tools">${ico('video')}${ico('phone')}${ico('ellipsis-vertical')}</span>`
                        )
                    ),
                    chat,
                    $('<div>', { class: 'loy-wa-input', 'aria-hidden': 'true', html: `<span class="loy-wa-field">${ico('smile')}<em>Mensaje</em>${ico('paperclip')}${ico('camera')}</span><span class="loy-wa-mic">${ico('mic')}</span>` }),
                    '<span class="loy-phone-home" aria-hidden="true"></span>'
                )
            )
        );

        $('#lpPhone').empty().append(
            this.boxHead('smartphone', 'Así le llega', ['Ejemplo', '']),
            phone,
            $('<p>', { class: 'loy-wa-cap' }).text('Con datos de ejemplo: a cada cliente le llega con los suyos.')
        );

        if (reduce) return;

        setTimeout(() => {
            if (seq !== this.phoneSeq) return;

            chat.find('.loy-wa-typing').remove();
            chat.append(bubble());
        }, first ? 900 : 650);
    }

    // El detalle del mensaje elegido: qué hace, sus cifras, la nota si algo falta y sus botones. Entra con un fundido.
    renderDetail(data) {
        const m = (data.messages || []).find((x) => x.key === this.programPick);

        if (!m) return $('#lpDetail').empty();

        const d    = this.messageDetail(m, data);
        const chip = m.toggle ? (m.on ? ['Encendido', 'is-ok'] : ['Apagado', 'is-off']) : ['Siempre', ''];

        $('#lpDetail').empty().append(
            this.boxHead(m.icon, m.title, chip, this.messageTone(m.key)),
            $('<div>', { class: 'loy-detail-swap' }).append(
                $('<p>', { class: 'loy-msg-lead' }).text(d.lead),
                $('<div>', { class: 'loy-msg-facts' }).append(d.facts.map(([icon, label, text]) => $('<div>', { class: 'loy-prog-fact' }).append(
                    $('<span>', { class: 'loy-prog-fact-label', html: `<i data-lucide="${icon}" class="w-4 h-4" aria-hidden="true"></i>` }).append(document.createTextNode(label)),
                    $('<span>', { class: 'loy-prog-fact-text' }).text(text)
                ))),
                d.note ? $('<p>', { class: 'loy-prog-note' }).text(d.note) : null,
                d.acts.length ? $('<div>', { class: 'loy-prog-acts' }).append(d.acts.map((a) => this.jq(a))) : null
            )
        );
    }

    /*  El texto de una plantilla en la burbuja: *negritas* de WhatsApp, un
        párrafo por cada línea en blanco y el enlace de ejemplo en azul. Todo se
        escapa antes: la plantilla lleva datos del negocio. */
    waHtml(text) {
        return String(text || '').split(/\n{2,}/).map((p) => `<p>${esc(p)
            .replace(/\*([^*\n]+)\*/g, '<b>$1</b>')
            .replace(/…\/tarjeta\.php\?t=…/g, '<span class="loy-wa-link">…/tarjeta.php?t=…</span>')
            .replace(/\n/g, '<br>')}</p>`).join('');
    }

    /*  Qué hace cada mensaje, sus cifras [ícono, etiqueta, texto], la nota y los
        botones. Los de cumpleaños, te extrañamos y niveles son los de siempre. */
    messageDetail(m, data) {
        const wa = data.whatsapp || {};
        const s  = data.signup;
        const no = !wa.ready ? 'La empresa no tiene número de WhatsApp: se da de alta en Ventas › WhatsApp.' : '';

        if (m.key === 'tarjeta') {
            return {
                lead:  'Le llega su tarjeta digital con el enlace para abrirla: al registrarse con el QR o cuando se la mandas desde una tarjeta (Tarjeta digital).',
                facts: [
                    ['credit-card', 'Tarjeta de bienvenida', s.type ? `${s.type} · ${s.benefit}` : 'Sin elegir'],
                    ['send', 'Este mes', m.sentText]
                ],
                note:  no,
                acts:  data.can_edit ? [this.tileButton('settings-2', 'Configurar registro', () => this.formSignup())] : []
            };
        }

        if (m.key === 'premio') {
            return {
                lead:  'Al cobrar la venta que le completa los sellos, le avisamos que su premio ya está listo. Lo canjea en Vender cuando quiera.',
                facts: [
                    ['stamp', 'Para', 'Tarjetas de sellos'],
                    ['send', 'Este mes', m.sentText]
                ],
                note:  no,
                acts:  []
            };
        }

        if (m.key === 'cumple')  return this.birthdayDetail(data, m);
        if (m.key === 'regreso') return this.winbackDetail(data, m);

        return this.levelsDetail(data, m);
    }

    /*  Encender o apagar un mensaje con su interruptor. Se guardan los demás
        ajustes como están. Encender pregunta antes: desde ahí sale solo. */
    async toggleMessage(m) {
        const data = this.program;

        if (!data || !data.can_edit || this.saving) return;

        const on   = !m.on;
        const warn = {
            birthday: `Desde hoy, en su cumpleaños le llega la felicitación y su regalo (${(data.birthday || {}).giftText || 'solo la felicitación'}). Solo a quien aceptó mensajes.`,
            winback:  `Le escribimos a quien lleve ${(data.winback || {}).days || 30} días sin comprar, con tope por día. Solo a quien aceptó mensajes.`,
            levels:   'Las tarjetas suben solas al cobrar y, en la revisión de cada mes, también bajan. Al cambiar le llega un WhatsApp.'
        }[m.toggle];

        if (on) {
            const ask = await alert({ icon: 'question', title: `¿Encender «${m.title}»?`, text: warn, btn1: true, btn1Text: 'Encender', btn2: true, btn2Text: 'Cancelar' });

            if (!ask || !ask.isConfirmed || this.saving) return;
        }

        const b       = data.birthday || {};
        const w       = data.winback || {};
        const payload = {
            birthday: { opc: 'saveBirthday', birthday_enabled: on ? 1 : 0, birthday_stamps: b.stamps || 0, birthday_points: b.points || 0 },
            winback:  { opc: 'saveWinback', winback_enabled: on ? 1 : 0, winback_days: w.days, winback_daily_cap: w.cap },
            levels:   { opc: 'saveLevels', levels_enabled: on ? 1 : 0 }
        }[m.toggle];

        if (!payload) return;

        this.saving = true;

        const res = await useFetch({ url: this._link, data: payload });

        this.saving = false;

        if (!res || res.status != 200) return this.fail(res, `No se ${on ? 'encendió' : 'apagó'} ${m.title}`);

        this.program = res;
        this.renderProgram(res);

        alert({ icon: 'success', title: res.message, timer: 1800 });
    }

    // Una lista en ventana (cumpleaños, te extrañamos, niveles). El ojo de cada renglón abre la ficha con listCard().
    listModal(id, title, subtitle, icon, data, center, empty, extra = {}) {
        this.listOpen = this.csModal({
            id:         id,
            title:      title,
            subtitle:   subtitle,
            lucideIcon: icon,
            width:      'max-w-5xl',
            saveText:   false,
            cancelText: 'Cerrar',
            json:       [
                { id: `${id}Table`, tipo: 'html', class: 'w-full', html: '' },
                ...(data.moreText ? [{ id: `${id}More`, tipo: 'html', class: 'w-full', html: `<p class="loy-note">${esc(data.moreText)}</p>` }] : [])
            ],
            ...extra
        });

        this.createCoffeeTable3({
            parent:       `${id}Table`,
            id:           `tb${id}`,
            theme:        'light',
            data:         data.row.length ? { row: data.row } : { thead: [], row: [] },
            striped:      true,
            hover:        false,
            f_size:       13,
            center:       center,
            ...LOY_TABLE,
            emptyMessage: empty,
            emptyIcon:    'icon-users'
        });

        if (window.lucide) lucide.createIcons();
    }

    // El ojo de una lista: cierra la lista y abre la ficha (dos csModal a la vez se enciman).
    listCard(id) {
        if (this.listOpen) this.listOpen.close();

        this.listOpen = null;
        this.viewCard(id);
    }

    // -- Programa: te extrañamos --

    /*  «Te extrañamos»: a quien lleva los días sin comprar le llega un WhatsApp
        con su motivo para volver. Una vez cada esos días y con tope diario. Sale
        solo con la tarea de cada hora; «Mandar los de hoy» lo adelanta. */
    winbackDetail(data) {
        const w    = data.winback || {};
        const acts = [];

        if (data.can_edit) acts.push(this.tileButton('settings-2', 'Configurar', () => this.formWinback()));
        if (data.can_edit && w.canSend) acts.push(this.tileButton('send', `Mandar los de hoy (${w.due})`, () => this.sendWinbacks()));

        acts.push(this.tileButton('list', 'Ver la lista', () => this.lsWinbacks()));

        return {
            lead:  'Su motivo para volver: los sellos que lleva, lo que tiene en su monedero o el descuento de su tarjeta. Una vez cada esos días, con tope por día y solo a quien aceptó mensajes. Sale en el horario del WhatsApp de la tienda; el botón lo adelanta.',
            facts: [
                ['calendar-clock', 'Le escribimos a', w.daysText],
                ['users-round', 'Sin venir', w.awayText],
                ['send', 'Hoy', `${w.dueText} · ${w.capText}`],
                ['undo-2', 'Este mes', w.monthText]
            ],
            note:  w.note,
            acts:  acts
        };
    }

    formWinback() {
        const w     = this.program && this.program.winback;
        const scope = dataInit.scope || {};

        if (!w || this.saving) return;

        this.csModal({
            id:         'modalLoyWinback',
            title:      'Te extrañamos',
            subtitle:   scope.company ? `${scope.company} · todas las sucursales` : 'Todas las sucursales',
            lucideIcon: 'heart-handshake',
            width:      'max-w-lg',
            saveText:   'Guardar',
            cancelText: 'Cancelar',
            json: [
                { id: 'lw_enabled', lbl: 'Escribir a quien lleva tiempo sin venir', tipo: 'switch', value: w.enabled ? 1 : 0, help: 'Solo a quien aceptó mensajes de la tienda.', class: 'w-full' },
                { id: 'lw_days', lbl: 'Días sin comprar', tipo: 'number', min: 7, max: 365, step: '1', value: w.days, help: 'De 7 a 365. Tampoco se le repite antes de esos días.', class: 'w-full sm:w-1/2' },
                { id: 'lw_cap', lbl: 'Tope de mensajes por día', tipo: 'number', min: 1, max: 1000, step: '1', value: w.cap, help: 'Cuida tu número: Meta limita los mensajes nuevos.', class: 'w-full sm:w-1/2' }
            ],
            onSave: (values, close) => this.saveWinback(close)
        });
    }

    async saveWinback(close) {
        if (this.saving) return;

        const days = String($('#lw_days').val() || '').trim();
        const cap  = String($('#lw_cap').val() || '').trim();

        if (!/^\d{1,3}$/.test(days) || Number(days) < 7 || Number(days) > 365) return this.warn('Los días sin comprar van de 7 a 365.');
        if (!/^\d{1,4}$/.test(cap) || Number(cap) < 1 || Number(cap) > 1000)   return this.warn('El tope por día va de 1 a 1,000 mensajes.');

        await this.saveProgramPart('modalLoyWinback', { opc: 'saveWinback', winback_enabled: $('#lw_enabled').is(':checked') ? 1 : 0, winback_days: days, winback_daily_cap: cap }, close, 'No se guardó Te extrañamos');
    }

    // Guarda una parte del programa desde su ventana y repinta la pestaña con lo que devuelve el ctrl.
    async saveProgramPart(modalId, payload, close, failTitle) {
        this.saving = true;

        const button = $(`#${modalId} .cs-modal-save`).prop('disabled', true);
        const res    = await useFetch({ url: this._link, data: payload });

        this.saving = false;
        button.prop('disabled', false);

        if (!res || res.status != 200) return this.fail(res, failTitle);

        close();

        this.program = res;
        this.renderProgram(res);

        alert({ icon: 'success', title: res.message, timer: 1800 });
    }

    async sendWinbacks() {
        const w = this.program && this.program.winback;

        if (!w || this.saving) return;

        const ask = await alert({
            icon:     'question',
            title:    `¿Mandar «te extrañamos» a ${w.due === 1 ? '1 cliente' : `${w.due} clientes`}?`,
            text:     'A cada uno con su motivo para volver. No se le repite antes de ' + w.days + ' días.',
            btn1:     true,
            btn1Text: 'Mandar',
            btn2:     true,
            btn2Text: 'Cancelar'
        });

        if (!ask || !ask.isConfirmed || this.saving) return;

        await this.runProgram('sendWinbacks', 'No salieron los mensajes');
    }

    // Corre una acción del programa (mandar, felicitar, revisar) y avisa cómo salió.
    async runProgram(opc, failTitle) {
        this.saving = true;

        const res = await useFetch({ url: this._link, data: { opc: opc } });

        this.saving = false;

        if (!res || res.status != 200) return this.fail(res, failTitle);

        this.program = res;
        this.renderProgram(res);
        this.lsSummary();

        const c = res.counts || {};

        alert({ icon: (c.failed || 0) + (c.skip || 0) > 0 ? 'warning' : 'success', title: res.message, btn1: true, btn1Text: 'Entendido' });
    }

    async lsWinbacks() {
        const data = await useFetch({ url: this._link, data: { opc: 'lsWinbacks' } });

        if (!data || data.status != 200) return this.fail(data, 'No se pudo cargar la lista');

        this.listModal('modalLoyWinbacks', 'Te extrañamos', `${data.days} días o más sin comprar · clientes con tarjeta`, 'heart-handshake', data, [5, 6],
            'Todos tus clientes con tarjeta han comprado en estos días.');
    }

    // -- Programa: niveles --

    /*  «Nuevo nivel»: la escalera (tipos con gasto mínimo en 12 meses), las
        tarjetas que hay en ella y lo que se movió este mes. «Revisar niveles»
        enseña quién sube y quién baja antes de aplicarlo. */
    levelsDetail(data) {
        const l    = data.levels || {};
        const acts = [];

        if (data.can_edit) acts.push(this.tileButton('settings-2', 'Configurar', () => this.formLevels()));
        if (data.can_edit && l.canReview) acts.push(this.tileButton('refresh-ccw', 'Revisar niveles', () => this.lsLevelChanges()));

        // Los tipos viven en Tarjetas: aquí (tablero de Tarjetas) se va a su caja; desde Programa, a la otra página.
        acts.push(this.tileButton('layers', 'Ver tipos', () => document.getElementById('lbTypes') ? this.focusBox('lbTypes') : (location.href = 'tarjetas.php')));

        return {
            lead:  'Cada nivel es un tipo de tarjeta con un gasto mínimo en 12 meses. La tarjeta sube sola al cobrar; en la revisión de cada mes (a partir del día 1) también baja si gastó menos. Las tarjetas de otros tipos no cambian.',
            facts: [
                ['trophy', 'Escalera', l.ladderText],
                ['credit-card', 'Tarjetas en niveles', l.cardsText],
                ['arrow-up-down', 'Este mes', l.monthText],
                ['calendar-check', 'Última revisión', l.reviewText]
            ],
            note:  l.note,
            acts:  acts
        };
    }

    formLevels() {
        const l     = this.program && this.program.levels;
        const scope = dataInit.scope || {};

        if (!l || this.saving) return;

        this.csModal({
            id:         'modalLoyLevels',
            title:      'Niveles',
            subtitle:   scope.company ? `${scope.company} · todas las sucursales` : 'Todas las sucursales',
            lucideIcon: 'trophy',
            width:      'max-w-lg',
            saveText:   'Guardar',
            cancelText: 'Cancelar',
            json: [
                { id: 'lv_enabled', lbl: 'Subir y bajar las tarjetas de nivel', tipo: 'switch', value: l.enabled ? 1 : 0, help: 'Apagado, ninguna tarjeta cambia de tipo.', class: 'w-full' },
                { id: 'lv_note', tipo: 'html', class: 'w-full', html: '<p class="loy-note">La escalera se arma en Tipos de tarjeta: en cada tipo de descuento o de puntos que sea nivel, llena «Gasto mínimo en 12 meses». El primero puede empezar en $0.</p>' }
            ],
            onSave: (values, close) => this.saveProgramPart('modalLoyLevels', { opc: 'saveLevels', levels_enabled: $('#lv_enabled').is(':checked') ? 1 : 0 }, close, 'No se guardó Niveles')
        });
    }

    // Antes de aplicar: quién sube y quién baja, con su gasto. «Aplicar» lo hace.
    async lsLevelChanges() {
        const data = await useFetch({ url: this._link, data: { opc: 'lsLevelChanges' } });

        if (!data || data.status != 200) return this.fail(data, 'No se pudieron revisar los niveles');

        const down = data.count - data.up;

        this.listModal('modalLoyLevelPlan', 'Revisar niveles', data.count ? `${data.up} suben · ${down} bajan · gasto de los últimos 12 meses` : 'Gasto de los últimos 12 meses', 'trophy', data, [2, 5],
            'Todas las tarjetas ya están en su nivel.',
            data.count ? { saveText: `Aplicar ${data.count === 1 ? 'el cambio' : `los ${data.count} cambios`}`, info: 'Al cambiar le llega un WhatsApp a quien aceptó mensajes.', onSave: (values, close) => { close(); this.runProgram('applyLevels', 'No se aplicaron los niveles'); } } : {});
    }

    // -- Programa: cumpleaños --

    /*  «Cumpleaños»: el día de su cumpleaños, WhatsApp de felicitación y regalo
        (sellos o dinero al monedero), una vez al año y solo a quien aceptó
        mensajes. Sale solo con la tarea de cada hora (ctrl/cron-lealtad.php);
        «Felicitar a los de hoy» lo adelanta. */
    birthdayDetail(data) {
        const b    = data.birthday || {};
        const acts = [];

        if (data.can_edit) acts.push(this.tileButton('settings-2', 'Configurar', () => this.formBirthday()));
        if (data.can_edit && b.canSend) acts.push(this.tileButton('send', `Felicitar a los de hoy (${b.due})`, () => this.sendBirthdays()));

        acts.push(this.tileButton('list', 'Ver cumpleaños', () => this.lsBirthdays()));

        return {
            lead:  'Su regalo cae solo en su tarjeta: sellos si es de sellos, dinero al monedero si es de puntos; las de descuento solo reciben la felicitación. Una vez al año y solo a quien aceptó mensajes. Sale en el horario del WhatsApp de la tienda; el botón lo adelanta.',
            facts: [
                ['gift', 'Regalo', b.giftText],
                ['cake-slice', 'Hoy', b.todayText],
                ['calendar-days', 'Próximos', b.nextText],
                ['party-popper', 'Este año', b.yearText]
            ],
            note:  b.note,
            acts:  acts
        };
    }

    // Encender, y cuánto se regala: sellos (tarjetas de sellos) y $ al monedero (tarjetas de puntos).
    formBirthday() {
        const data = this.program;

        if (!data || !data.birthday || this.saving) return;

        const b     = data.birthday;
        const scope = dataInit.scope || {};

        this.csModal({
            id:         'modalLoyBirthday',
            title:      'Cumpleaños',
            subtitle:   scope.company ? `${scope.company} · todas las sucursales` : 'Todas las sucursales',
            lucideIcon: 'cake',
            width:      'max-w-lg',
            saveText:   'Guardar',
            cancelText: 'Cancelar',
            json: [
                { id: 'lb_enabled', lbl: 'Felicitar a los clientes en su cumpleaños', tipo: 'switch', value: b.enabled ? 1 : 0, help: 'Solo a quien aceptó mensajes de la tienda.', class: 'w-full' },
                { id: 'lb_stamps', lbl: 'Sellos de regalo', tipo: 'number', min: 0, max: 20, step: '1', ph: '0', value: b.stamps > 0 ? b.stamps : '', help: 'Tarjetas de sellos. 0 = solo la felicitación.', class: 'w-full sm:w-1/2' },
                { id: 'lb_points', lbl: 'Regalo al monedero ($)', tipo: 'number', min: 0, step: '0.01', ph: '0', value: b.points > 0 ? b.points : '', help: 'Tarjetas de puntos. 0 = solo la felicitación.', class: 'w-full sm:w-1/2' }
            ],
            onSave: (values, close) => this.saveBirthday(close)
        });
    }

    async saveBirthday(close) {
        if (this.saving) return;

        const stampsText = String($('#lb_stamps').val() || '').trim();
        const stamps     = stampsText === '' ? 0 : (/^\d{1,2}$/.test(stampsText) ? Number(stampsText) : null);
        const points     = this.amount($('#lb_points').val());

        if (stamps === null || stamps > 20)        return this.warn('Los sellos de regalo van de 0 a 20.');
        if (points === null || points > 10000)     return this.warn('El regalo al monedero va de $0 a $10,000.00.');

        await this.saveProgramPart('modalLoyBirthday', { opc: 'saveBirthday', birthday_enabled: $('#lb_enabled').is(':checked') ? 1 : 0, birthday_stamps: stamps, birthday_points: points }, close, 'No se guardó Cumpleaños');
    }

    // El regalo y el WhatsApp a quien le toca hoy. Primero se pregunta: el regalo no se deshace.
    async sendBirthdays() {
        const b = this.program && this.program.birthday;

        if (!b || this.saving) return;

        const ask = await alert({
            icon:     'question',
            title:    `¿Felicitar a ${b.due === 1 ? 'la persona' : `las ${b.due} personas`} que cumplen hoy?`,
            text:     `Le llega su WhatsApp y su regalo (${b.giftText}). No se repite este año.`,
            btn1:     true,
            btn1Text: 'Felicitar',
            btn2:     true,
            btn2Text: 'Cancelar'
        });

        if (!ask || !ask.isConfirmed || this.saving) return;

        await this.runProgram('sendBirthdays', 'No se felicitó');
    }

    // De 7 días atrás a 30 adelante: quién cumple, su regalo y cómo va.
    async lsBirthdays() {
        const data = await useFetch({ url: this._link, data: { opc: 'lsBirthdays' } });

        if (!data || data.status != 200) return this.fail(data, 'No se pudo cargar la lista');

        this.listModal('modalLoyBirthdays', 'Cumpleaños', 'De hace 7 días a los próximos 30 · clientes con tarjeta', 'cake', data, [5, 6],
            'Nadie con tarjeta cumple años en estos días. El cumpleaños se captura en la ficha de la tarjeta o en el registro.');
    }

    // Encender el registro y elegir la tarjeta de bienvenida (los ajustes son de toda la empresa).
    formSignup() {
        const data = this.program;

        if (!data || this.saving) return;
        if (!data.types.length) return this.needType();

        const s = data.signup;

        this.csModal({
            id:         'modalLoySignup',
            title:      'Registro solo',
            subtitle:   s.company ? `${s.company} · todas las sucursales` : 'Todas las sucursales',
            lucideIcon: 'qr-code',
            width:      'max-w-lg',
            saveText:   'Guardar',
            cancelText: 'Cancelar',
            json: [
                { id: 'lp_enabled', lbl: 'El cliente se registra solo con el QR', tipo: 'switch', value: s.enabled ? 1 : 0, help: 'Apagado, el QR dice «Pide tu tarjeta en caja».', class: 'w-full' },
                { id: 'lp_type', lbl: 'Tarjeta de bienvenida', tipo: 'select', data: data.types, value: s.type_id || (data.types.length === 1 ? data.types[0].id : ''), help: 'La que recibe quien se registra. Su número sale solo: 8 dígitos al azar.', class: 'w-full' }
            ],
            onSave: (values, close) => this.saveSignup(close)
        });
    }

    async saveSignup(close) {
        if (this.saving) return;

        const enabled = $('#lp_enabled').is(':checked');
        const type    = String($('#lp_type').val() || '');

        if (enabled && !type) return this.warn('Elige la tarjeta que recibe quien se registra.');

        this.saving = true;

        const button = $('#modalLoySignup .cs-modal-save').prop('disabled', true);
        const res    = await useFetch({ url: this._link, data: { opc: 'saveSignup', signup_enabled: enabled ? 1 : 0, signup_type_id: type } });

        this.saving = false;
        button.prop('disabled', false);

        if (!res || res.status != 200) return this.fail(res, 'No se guardó el registro');

        close();

        this.program = res;
        this.renderProgram(res);

        alert({ icon: 'success', title: res.message, timer: 1800 });
    }

    async copySignupLink() {
        const url = this.program && this.program.signup.url;

        if (!url) return;

        const done = await ticketCopy(url);

        alert(done
            ? { icon: 'success', title: 'Enlace copiado', timer: 1200 }
            : { icon: 'warning', title: 'No se pudo copiar', text: 'Abre el enlace y cópialo desde el navegador.', btn1: true, btn1Text: 'Entendido' });
    }

    // Token nuevo: el QR impreso deja de abrir (para cuando el cartel se quedó donde no debía).
    async renewSignupLink() {
        if (!this.program || this.saving) return;

        const ask = await alert({
            icon:     'warning',
            title:    '¿Crear un QR nuevo?',
            text:     'El cartel que ya imprimiste deja de abrir. Tendrás que imprimir el nuevo.',
            btn1:     true,
            btn1Text: 'Crear QR nuevo',
            btn2:     true,
            btn2Text: 'Cancelar'
        });

        if (!ask || !ask.isConfirmed || this.saving) return;

        this.saving = true;

        const res = await useFetch({ url: this._link, data: { opc: 'newSignupLink' } });

        this.saving = false;

        if (!res || res.status != 200) return this.fail(res, 'No se cambió el QR');

        this.program = res;
        this.renderProgram(res);

        alert({ icon: 'success', title: res.message, timer: 2200 });
    }

    /*  El cartel del mostrador, en una hoja carta: la tienda, qué da la tarjeta
        y el QR grande. Va en blanco y negro con una franja del color de la
        tarjeta de bienvenida. Con el registro apagado, primero se pregunta. */
    async printPoster() {
        const data = this.program;

        if (!data || !data.signup.url) return;

        const s = data.signup;

        if (!s.live) {
            const ask = await alert({
                icon:     'warning',
                title:    'El registro no está dando tarjetas',
                text:     `${s.note} ¿Imprimir el cartel de todos modos?`,
                btn1:     true,
                btn1Text: 'Imprimir',
                btn2:     true,
                btn2Text: 'Cancelar'
            });

            if (!ask || !ask.isConfirmed) return;
        }

        const store = s.company || s.branch;
        const css   = `
            @page { size: letter portrait; margin: 14mm; }
            * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { margin: 0; font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #0F172A; }
            .sheet { display: flex; flex-direction: column; align-items: center; gap: 8mm; min-height: 245mm; padding: 4mm 0; text-align: center; }
            .band { width: 100%; height: 9mm; border-radius: 4mm; background: ${s.color}; }
            .store { margin: 0; font-size: 15pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #5B6577; }
            h1 { margin: 0; font-size: 36pt; line-height: 1.05; font-weight: 800; letter-spacing: -.02em; }
            .lead { margin: 0; max-width: 150mm; font-size: 16pt; line-height: 1.35; color: #334155; }
            .qr { width: 100mm; height: 100mm; }
            .qr svg { display: block; width: 100%; height: 100%; }
            .perk { margin: 0; padding: 4mm 7mm; border-radius: 4mm; background: #F1F5F9; font-size: 15pt; font-weight: 700; }
            .steps { display: flex; gap: 6mm; margin: 0; padding: 0; list-style: none; font-size: 12pt; color: #334155; }
            .steps b { display: block; font-size: 20pt; color: #0F172A; }
            .foot { margin-top: auto; font-size: 9pt; color: #94A3B8; word-break: break-all; }`;

        const body = `
            <main class="sheet">
                <div class="band"></div>
                <p class="store">${esc(store)}</p>
                <h1>Tu tarjeta de cliente,<br>gratis y en tu teléfono</h1>
                <p class="lead">Escanea el código con la cámara, escribe tu nombre y tu WhatsApp, y listo.</p>
                <div class="qr">${this.qrSvg(s.url)}</div>
                ${s.perk ? `<p class="perk">${esc(s.perk)}</p>` : ''}
                <ol class="steps">
                    <li><b>1</b>Escanea</li>
                    <li><b>2</b>Regístrate</li>
                    <li><b>3</b>Enséñala en caja</li>
                </ol>
                <p class="foot">${esc(s.branch)} · ${esc(s.url)}</p>
            </main>`;

        loyPrintDoc(`Cartel de registro · ${store}`, css, body);
    }

    // -- Tipos de tarjeta --

    /*  Pide TODOS los tipos (activos e inactivos): la galería los filtra con sus
        píldoras y «Niveles y beneficios» y «Mecánicas» los usan completos. */
    async lsCardTypes() {
        const request = ++this.requests.types;

        $('#tableLoyTypes').addClass('opacity-50');

        const data = await useFetch({ url: this._link, data: { opc: 'lsCardTypes', status: 'all' } });

        if (request !== this.requests.types) return;

        const loaded = Boolean(data && data.status == 200);

        if (!loaded) alert({ icon: 'error', title: 'No se pudo cargar la lista', text: (data && data.message) || 'Revisa la conexión y vuelve a intentar.', btn1: true, btn1Text: 'Entendido' });

        $('#tableLoyTypes').removeClass('opacity-50');

        if (!loaded) return this.emptyGallery(false);

        // Al recargar (después de guardar), el tablero ya no repite la entrada de niveles y mecánicas.
        if (this.typesShown) $(`#board${this.PROJECT_NAME}`).addClass('is-still');

        this.typesShown = true;
        this.types      = Array.isArray(data.types) ? data.types : [];

        this.typeSeg();
        this.paintTypes();
        this.renderLevels();
        this.renderMechs();

        if (window.lucide) lucide.createIcons();
    }

    // -- Tipos: galería --

    /*  Una tarjeta por tipo. La primera vez suben una tras otra (--i es su lugar
        en la fila de espera); al recargar (is-still) ya no vuelven a entrar. */
    gallery(types) {
        this.closeMenus();

        this.createLayout({
            parent: 'tableLoyTypes',
            design: false,
            data: {
                id:        'galleryLoyTypes',
                class:     'loy-gallery' + (this.galleryShown ? ' is-still' : ''),
                container: types.map((t) => ({ type: 'div', id: `loyTile${t.id}`, class: 'loy-tile' + (t.active ? '' : ' is-off') }))
            }
        });

        types.forEach((t, i) => {
            document.getElementById(`loyTile${t.id}`).style.setProperty('--i', String(i));
            this.tile(t);
        });

        // Los botones de solo ícono enseñan su nombre al pasar el ratón. Con .attr(): como prop de jQuery, title abre un popover.
        $('#galleryLoyTypes .loy-act.is-icon, #galleryLoyTypes .loy-act.is-squeeze').each((i, el) => $(el).attr('title', $(el).attr('aria-label')));

        this.galleryShown = true;

        if (window.lucide) lucide.createIcons();
    }

    /*  Un tipo: su tarjeta (la cara «tipo») con sus cifras adentro (Tarjetas ·
        Ventas del mes · Premio, Descontado o Puntos dados) y, debajo, sus botones:
        «Ver tarjetas», «Nueva» y el menú ⋯ con Editar y Desactivar.
        Un clic en la tarjeta (o Enter con el foco en ella) abre sus tarjetas.
        Lo que escribió el usuario entra con text: nada se lee como HTML. */
    tile(t) {
        const open    = () => this.showCards(t.id);
        const facts   = t.active ? [] : [{ type: 'p', class: 'loy-tile-off', text: 'Inactivo: sus tarjetas no se leen en Vender.' }];
        const buttons = [this.tileButton('credit-card', 'Ver tarjetas', open)];

        if (t.active && this.allow('create')) buttons.push(this.tileButton('plus', 'Nueva', () => this.addCard(t.id), 'is-squeeze'));
        if (!t.active && this.allow('update')) buttons.push(this.tileButton('power', 'Activar', () => this.statusType(t.id, 1)));

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
                    { type: 'div', id: `loyTileActs${t.id}`, class: 'loy-tile-actions', children: buttons }
                ]
            }
        });

        if (this.allow('update')) {
            const menu = [{ icon: 'pencil', text: 'Editar tipo', click: () => this.editType(t.id) }];

            if (t.active) menu.push({ icon: 'power', text: 'Desactivar', click: () => this.statusType(t.id, 0), danger: true });

            $(`#loyTileActs${t.id}`).append(this.tileMenu(t, menu));
        }

        this.paintFace(`loyFace${t.id}`, {
            color:    t.color,
            type:     t.name,
            discount: t.discount,
            points:   t.points,
            goal:     t.goal,
            icon:     t.icon,
            say:      t.goal > 0 ? this.stampRule(t.stampAmount, t.goal, t.reward) : '',
            level:    t.levelTag ? { tag: t.levelTag, from: t.levelFrom, top: t.levelTop } : null,
            fields:   this.tileFields(t),
            caption:  ''
        });
    }

    // Las cifras dentro de la tarjeta del tipo. La tercera depende de lo que da: el premio, lo descontado o los puntos del mes.
    tileFields(t) {
        const fields = [
            ['Tarjetas', t.cards > 0 ? (t.cards === 1 ? '1 activa' : `${t.cards} activas`) : 'Ninguna'],
            ['Ventas mes', t.sales > 0 ? `${t.sales} · ${this.moneyShort(t.sold)}` : '—']
        ];

        if (t.goal > 0)          fields.push(['Premio', `hasta ${this.moneyShort(t.rewardValue)}`]);
        else if (t.discount > 0) fields.push(['Descontado', this.moneyShort(t.discountGiven)]);
        else if (t.points > 0)   fields.push(['Puntos dados', this.moneyShort(t.pointsGiven)]);

        return fields;
    }

    /*  El menú ⋯ de un tipo: un botón que abre una lista de acciones debajo.
        Se cierra con otro clic, con un clic fuera o con Escape (toggleMenu). */
    tileMenu(t, items) {
        const list = $('<div>', { id: `loyMenu${t.id}`, class: 'loy-menu-list', role: 'menu' });

        items.forEach((m) => list.append($('<button>', {
            type:  'button',
            class: 'loy-menu-item' + (m.danger ? ' is-danger' : ''),
            role:  'menuitem',
            html:  `<i data-lucide="${m.icon}" class="w-4 h-4" aria-hidden="true"></i>`,
            click: () => { this.closeMenus(); m.click(); }
        }).append($('<span>').text(m.text))));

        const button = $('<button>', {
            type:            'button',
            class:           'loy-act is-icon',
            'aria-label':    `Más opciones del tipo ${t.name}`,
            'aria-haspopup': 'menu',
            'aria-expanded': 'false',
            'aria-controls': `loyMenu${t.id}`,
            html:            '<i data-lucide="ellipsis" class="w-4 h-4" aria-hidden="true"></i>',
            click:           (e) => this.toggleMenu(e.currentTarget)
        });

        return $('<div>', { class: 'loy-menu' }).append(button, list);
    }

    // Abre (o cierra) el menú del botón. Su mosaico sube (is-raised) para que la lista no quede detrás del de abajo.
    toggleMenu(button) {
        const menu = $(button).closest('.loy-menu');
        const open = !menu.hasClass('is-open');

        this.closeMenus();

        if (!open) return;

        menu.addClass('is-open').closest('.loy-tile').addClass('is-raised');
        $(button).attr('aria-expanded', 'true');
        menu.find('.loy-menu-item').first().trigger('focus');

        // Al siguiente tic: el clic que abrió no debe cerrarlo.
        setTimeout(() => {
            $(document)
                .on('click.loyMenu', (e) => { if (!$(e.target).closest('.loy-menu').length) this.closeMenus(); })
                .on('keydown.loyMenu', (e) => { if (e.key === 'Escape') this.closeMenus(true); });
        });
    }

    // Cierra los menús abiertos. focus: regresa el foco al botón ⋯ (al cerrar con Escape).
    closeMenus(focus = false) {
        const open = $('.loy-menu.is-open');

        open.removeClass('is-open').closest('.loy-tile').removeClass('is-raised');
        open.find('> button').attr('aria-expanded', 'false');
        $(document).off('.loyMenu');

        if (focus) open.find('> button').trigger('focus');
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
        const status = this.typeStatus;
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

    // Un tipo nuevo empieza por el objetivo (pickStructure); «Editar» entra directo al formulario.
    addType() {
        this.pickStructure();
    }

    // -- Tipos: paso 1, el objetivo --

    /*  Lo que puede querer el negocio y qué estructuras le sirven. La primera de
        cada objetivo es la recomendada. */
    goals() {
        return [
            { id: 'repeat', icon: 'repeat', text: 'Que vuelvan más seguido', fits: ['stamps', 'points'] },
            { id: 'spend', icon: 'trending-up', text: 'Que gasten más por visita', fits: ['points', 'levels'] },
            { id: 'top', icon: 'crown', text: 'Premiar a los que más compran', fits: ['levels'] },
            { id: 'group', icon: 'users', text: 'Un descuento fijo a un grupo', fits: ['discount'] }
        ];
    }

    /*  Las 4 estructuras. benefit: el que queda elegido en el formulario (Niveles
        es un tipo de descuento o puntos con gasto mínimo). level: 1 a 3, qué tanto
        hay que configurar. sample: el dibujo de ejemplo (lo pinta paintFace). */
    structures() {
        return [
            {
                id: 'stamps', benefit: 'stamps', icon: 'stamp', color: '#7C3AED', name: 'Sellos', level: 1,
                text: 'Un sello por cada $X pagados. Al juntar la meta, un premio.',
                goal: 'Que el cliente regrese: cada visita lo acerca al premio.',
                fit:  'Café, panadería, comida rápida: compras chicas y frecuentes.',
                use:  'Un premio claro y cercano. Ej.: 1 sello por cada $100 · 10 sellos = Café gratis.',
                sample: { type: 'Café Lover', goal: 10, stamps: 3, icon: 'coffee', say: this.stampRule(100, 10, 'Café gratis') }
            },
            {
                id: 'points', benefit: 'points', icon: 'star', color: '#0891B2', name: 'Puntos', level: 2,
                text: 'Un % de lo que paga cae a su monedero y lo gasta cuando quiera.',
                goal: 'Que regrese a gastar lo que juntó.',
                fit:  'Tickets medianos y variados; clientes que vienen seguido.',
                use:  'Entre 3 % y 10 %. Ej.: con 5 %, una compra de $200 deja $10 en el monedero.',
                sample: { type: 'Monedero', points: 5 }
            },
            {
                id: 'levels', benefit: 'discount', icon: 'trophy', color: '#CA8A04', name: 'Niveles', level: 3,
                text: 'Tarjetas que suben solas según lo que gasta en 12 meses.',
                goal: 'Premiar a los que más compran y darles ganas de subir.',
                fit:  'Negocios con clientes fieles que gastan distinto.',
                use:  '2 o 3 niveles. Ej.: Cliente Frecuente 5 % desde $0 · VIP 10 % desde $3,000. Se encienden en Programa › Niveles.',
                sample: { type: 'VIP', discount: 10, level: { tag: 'Nivel 2', from: 'Desde $3,000 en 12 meses', top: true } }
            },
            {
                id: 'discount', benefit: 'discount', icon: 'badge-percent', color: '#DB2777', name: 'Descuento', level: 1,
                text: 'Un % menos en cada compra, sin juntar nada.',
                goal: 'Dar un trato fijo a un grupo.',
                fit:  'Empleados, convenios, socios.',
                use:  'Ej.: Descuento de empleado 20 %. Esa venta ya no admite otro descuento.',
                sample: { type: 'Descuento de empleado', discount: 20 }
            }
        ];
    }

    /*  Paso 1 de 2: «¿Qué quieres lograr?». Cada objetivo prende sus estructuras
        (las otras se ven tenues, pero se pueden elegir). A la derecha de los
        datos, la tarjeta de ejemplo de la estructura elegida.
        «Siguiente» abre el formulario de siempre con el beneficio ya puesto.
        goal: el objetivo que ya viene marcado («Crear un nivel» manda 'top'). */
    pickStructure(goal = '') {
        if (this.saving) return;

        const scope  = dataInit.scope || {};
        const goals  = this.goals();
        const start  = goals.find((g) => g.id === goal) || goals[0];
        const pick   = { goal: start.id, structure: start.fits[0] };
        const chips  = goals.map((g) => `<button type="button" class="loy-goal-chip" data-goal="${g.id}"><i data-lucide="${g.icon}" class="w-4 h-4" aria-hidden="true"></i>${esc(g.text)}</button>`).join('');
        const cards  = this.structures().map((s) => `
            <button type="button" class="loy-struct" data-structure="${s.id}" aria-pressed="false">
                <span class="loy-struct-badge">Recomendado</span>
                <span class="loy-struct-icon" style="background:${s.color}"><i data-lucide="${s.icon}" class="w-4 h-4" aria-hidden="true"></i></span>
                <b>${esc(s.name)}</b>
                <span class="loy-struct-text">${esc(s.text)}</span>
                <span class="loy-struct-level">Complejidad <span>${[1, 2, 3].map((n) => `<i class="${n <= s.level ? 'is-on' : ''}"></i>`).join('')}</span> ${['baja', 'media', 'alta'][s.level - 1]}</span>
            </button>`).join('');

        this.csModal({
            id:         'modalLoyGoal',
            title:      'Nuevo tipo de tarjeta',
            subtitle:   ['Paso 1 de 2', scope.branch ? `Sucursal ${scope.branch}` : ''].filter(Boolean).join(' · '),
            lucideIcon: 'layers',
            width:      'max-w-4xl',
            saveText:   'Siguiente',
            cancelText: 'Cancelar',
            json: [
                { id: 'lg_goals', tipo: 'html', class: 'w-full', html: `<p class="loy-goal-q">¿Qué quieres lograr?</p><div class="loy-goal-chips" role="group" aria-label="Objetivo">${chips}</div>` },
                { id: 'lg_structs', tipo: 'html', class: 'w-full', html: `<div class="loy-structs">${cards}</div>` },
                { id: 'lg_detail', tipo: 'html', class: 'w-full', html: `<div class="loy-struct-detail"><div id="lg_preview" class="loy-struct-preview">${this.cardFace('type')}</div><div class="loy-struct-facts"></div></div>` }
            ],
            onSave: (values, close) => {
                const chosen = this.structures().find((s) => s.id === pick.structure);

                close();
                this.formType(null, chosen ? chosen.id : 'discount');
            }
        });

        const modal = $('#modalLoyGoal');
        const paint = () => {
            const fits = goals.find((g) => g.id === pick.goal).fits;
            const s    = this.structures().find((x) => x.id === pick.structure);

            modal.find('.loy-goal-chip').each((i, el) => $(el).toggleClass('is-on', el.dataset.goal === pick.goal).attr('aria-pressed', String(el.dataset.goal === pick.goal)));
            modal.find('.loy-struct').each((i, el) => {
                const id = el.dataset.structure;

                $(el).toggleClass('is-on', id === pick.structure).toggleClass('is-dim', !fits.includes(id)).toggleClass('is-best', id === fits[0]).attr('aria-pressed', String(id === pick.structure));
            });

            modal.find('.loy-struct-facts').empty().append([['Objetivo principal', s.goal], ['Ideal para', s.fit], ['Mejor uso', s.use]].map(([label, text]) =>
                $('<div>').append($('<small>').text(label), $('<p>').text(text))));

            this.paintFace('lg_preview', Object.assign({ color: s.color, caption: '' }, s.sample));
        };

        // Un objetivo elige su estructura recomendada; una estructura se elige sola.
        modal.on('click', '.loy-goal-chip', (e) => {
            pick.goal      = e.currentTarget.dataset.goal;
            pick.structure = goals.find((g) => g.id === pick.goal).fits[0];
            paint();
        });

        modal.on('click', '.loy-struct', (e) => {
            pick.structure = e.currentTarget.dataset.structure;
            paint();
        });

        paint();

        if (window.lucide) lucide.createIcons();
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
        porcentaje se esconde (y los campos de sellos con los otros beneficios).
        structure (alta, del paso 1): 'stamps', 'points', 'discount' o 'levels'
        (descuento con el gasto mínimo del nivel a la vista). */
    formType(type, structure = '') {
        if (this.saving) return;

        const scope    = dataInit.scope || {};
        const discount = type ? Number(type.discount_percent) || 0 : 0;
        const points   = type ? Number(type.points_percent) || 0 : 0;
        const goal     = type ? Number(type.stamp_goal) || 0 : 0;
        const both     = discount > 0 && points > 0;
        const preset   = !type && ['stamps', 'points'].includes(structure) ? structure : 'discount';
        const benefit  = type ? (goal > 0 ? 'stamps' : (points > 0 && discount <= 0 ? 'points' : 'discount')) : preset;
        const percent  = benefit === 'points' ? points : discount;
        const amount   = (field) => (type && Number(type[field]) > 0 ? Number(type[field]) : '');
        const json     = [
            { id: 'lt_preview', tipo: 'html', class: 'loy-preview', html: this.cardFace('type') },
            { id: 'lt_name', lbl: 'Nombre', required: true, maxlength: 80, ph: 'Ej. Oro, Cliente frecuente', value: type ? type.name : '', class: 'w-full' },
            { id: 'lt_benefit', lbl: 'Beneficio', tipo: 'select', required: true, empty: false, data: [{ id: 'discount', valor: 'Descuento al pagar' }, { id: 'points', valor: 'Puntos al monedero' }, { id: 'stamps', valor: 'Sellos: junta y llévate un premio' }], value: benefit, class: 'w-full sm:w-1/2' },
            { id: 'lt_percent', lbl: 'Porcentaje (%)', tipo: 'number', required: true, min: 0, max: 100, step: '0.01', ph: '0', value: percent > 0 ? percent : '', class: 'w-full sm:w-1/2' },
            { id: 'lt_level', lbl: 'Nivel: gasto mínimo en 12 meses ($)', tipo: 'number', min: 0, step: '0.01', ph: 'Vacío = no es nivel', value: type && type.level_min_spend !== null && type.level_min_spend !== undefined ? type.level_min_spend : '', help: 'Lealtad › Programa › Niveles: la tarjeta sube a este tipo cuando su cliente gasta eso en 12 meses. El primero puede ser $0.', class: 'w-full' },
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
            subtitle:   [type ? '' : 'Paso 2 de 2', scope.branch ? `Sucursal ${scope.branch}` : ''].filter(Boolean).join(' · '),
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

        if (type) return;

        // Niveles: el gasto mínimo es lo que lo hace nivel; se marca para que no se pase.
        if (structure === 'levels') $('#lt_level').closest('.px-2').addClass('loy-field-mark');

        $('#lt_name').trigger('focus');
    }

    // Con «Sellos» se ven sus 4 campos y se esconde el porcentaje; con descuento o puntos, al revés.
    benefitFields() {
        const stamps = $('#lt_benefit').val() === 'stamps';

        // Un tipo de sellos no puede ser nivel: el campo se esconde con el porcentaje.
        $('#lt_percent, #lt_level').closest('.px-2').toggle(!stamps);
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

        // Nivel: vacío = no es nivel. Solo descuento o puntos.
        const levelText = stamp ? '' : String($('#lt_level').val() || '').trim();
        const level     = levelText === '' ? '' : this.amount(levelText);

        if (level === null) return this.warn('El gasto mínimo del nivel va en pesos, con hasta 2 decimales.');

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
                level_min_spend:  level,
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

    /*  El dibujo de la tarjeta, al estilo de los pases de Wallet: degradado del
        color del tipo con un brillo encima. Arriba el icono del tipo, su nombre
        y la cifra (SELLOS 7/10 · DESCUENTO 5 %); al centro los sellos punteados
        o el porcentaje en grande; abajo los campos. No es un campo del
        formulario: no guarda nada y lo llena paintFace().
        kind 'card' (alta de tarjeta y ficha): campos Titular, Premio y Número.
        kind 'type' (galería y alta de tipo): los campos los manda quien pinta.
        La marca de arriba es la empresa: la tarjeta vale en todas sus sucursales. */
    cardFace(kind = 'card') {
        const scope = dataInit.scope || {};

        return `
            <div class="loy-card${kind === 'type' ? ' is-type' : ''}" data-ink="dark" style="--loy-color:${this.defaultColor()}">
                <div class="loy-card-head">
                    <span class="loy-card-logo" aria-hidden="true"></span>
                    <div class="loy-card-name">
                        <span class="loy-card-type"></span>
                        <span class="loy-card-brand">${esc(scope.company || scope.branch || '')}</span>
                    </div>
                    <div class="loy-card-value"><span class="loy-card-label"></span><b></b></div>
                </div>
                <div class="loy-card-body">
                    <div class="loy-card-stamps" aria-hidden="true"></div>
                    <div class="loy-card-big"></div>
                    <div class="loy-card-tier"></div>
                    <p class="loy-card-say"></p>
                </div>
                <div class="loy-card-fields"></div>
                <i class="loy-card-sheen" aria-hidden="true"></i>
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
            reward:   type ? type.reward : '',
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
            reward:   stamp ? stamp.reward : '',
            say:      goal && stamp.amount > 0 ? this.stampRule(stamp.amount, goal, stamp.reward) : '',
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

    /*  Pinta el dibujo. Lo que falta sale apagado (is-empty). Todo lo escrito
        entra con .text(): nada se interpreta como HTML.
        face: color, type (el nombre), number y holder (tarjeta), discount, points,
          goal (meta de sellos), stamps (los juntados), icon (Lucide del sello),
          reward (el premio), say (la frase del centro; sin ella, en una tarjeta de
          sellos, lo que le falta), level ({ tag, from, top }: su insignia),
          fields ([[etiqueta, valor], ...]; la cara 'card' trae los suyos),
          empty ('descuento', 'puntos' o 'sellos': sin valor todavía, «0 %» apagado
          con esa palabra) y caption (el pie, fuera del dibujo).
        Lo animado, solo al cambiar: color → se funde (is-painted prende esa
        transición después del primer pintado, para que al abrir no se funda
        desde el celeste); la cifra de arriba → da un salto (is-pop).
        box: el id de lo que contiene el dibujo (un formulario, la galería o la ficha). */
    paintFace(box, face) {
        const card     = $(`#${box} .loy-card`);
        const isCard   = !card.hasClass('is-type');
        const number   = String(face.number || '').trim();
        const color    = hex6(face.color || this.defaultColor()).toUpperCase();
        const goal     = Math.max(0, Math.min(20, Math.floor(Number(face.goal) || 0)));
        const have     = Math.max(0, Math.min(goal, Math.floor(Number(face.stamps) || 0)));
        const discount = Number(face.discount) || 0;
        const points   = Number(face.points) || 0;
        const icon     = this.stampIcon(face.icon);
        const reward   = String(face.reward || '').trim();
        const before   = card.data('face');

        card[0].style.setProperty('--loy-color', color);
        card.attr('data-ink', this.inkOf(color));

        // Arriba: el icono del tipo, el nombre y la cifra. Sellos: en una tarjeta con sus sellos (la ficha), «7/10»; en el tipo o el alta, la meta.
        const logo  = goal > 0 || face.empty === 'sellos' ? (icon || 'stamp')
                    : face.level ? 'crown'
                    : discount > 0 || face.empty === 'descuento' ? 'badge-percent'
                    : points > 0 || face.empty === 'puntos' ? 'star'
                    : 'credit-card';
        const value = goal > 0      ? ['Sellos', face.stamps !== undefined && number ? `${have}/${goal}` : String(goal)]
                    : discount > 0  ? ['Descuento', this.pct(discount)]
                    : points > 0    ? ['Puntos', this.pct(points)]
                    : face.empty    ? [face.empty, face.empty === 'sellos' ? '0' : this.pct(0)]
                    : ['', ''];

        card.find('.loy-card-logo').html(`<i data-lucide="${logo}"></i>`);
        card.find('.loy-card-type').text(face.type || 'Tipo de tarjeta').toggleClass('is-empty', !face.type);
        card.find('.loy-card-value .loy-card-label').text(value[0]);
        card.find('.loy-card-value b').text(value[1]).toggleClass('is-empty', !goal && !discount && !points);

        // Sellos: uno por sello de la meta, punteado; los juntados, llenos con el icono del tipo. El último es el premio (regalo).
        const mark = icon ? `<i data-lucide="${icon}"></i>` : '';

        card.find('.loy-card-stamps')
            .toggleClass('is-many', goal > 10)
            .html(Array.from({ length: goal }, (v, i) => {
                const gift = i === goal - 1;

                return `<span class="loy-stamp${i < have ? ' is-on' : ''}${gift ? ' is-gift' : ''}">${gift ? '<i data-lucide="gift"></i>' : mark}</span>`;
            }).join(''));

        // Descuento o puntos: el porcentaje en grande y qué es. Uno de antes con los dos: el descuento y, al lado, los puntos.
        const big = card.find('.loy-card-big').empty().removeClass('is-empty');

        if (!goal && (discount > 0 || points > 0)) {
            const what = discount > 0 ? (points > 0 ? `de descuento + ${this.pct(points)} en puntos` : 'de descuento') : 'en puntos al monedero';

            big.append($('<b>').text(this.pct(discount > 0 ? discount : points)), $('<span>').text(what));
        } else if (!goal && face.empty && face.empty !== 'sellos') {
            big.addClass('is-empty').append($('<b>').text(this.pct(0)), $('<span>').text(face.empty === 'puntos' ? 'en puntos al monedero' : 'de descuento'));
        }

        // Nivel: la insignia (dorada en el más alto) y desde cuánto gasto.
        const tier = card.find('.loy-card-tier').empty();

        if (face.level && face.level.tag) {
            tier.append(
                $('<span>', { class: 'loy-card-badge' + (face.level.top ? ' is-top' : '') }).append('<i data-lucide="trophy"></i>', $('<em>').text(face.level.tag)),
                $('<span>').text(face.level.from || '')
            );
        }

        // La frase: la que manda quien pinta o, en una tarjeta de sellos, cuántos le faltan.
        const say = face.say !== undefined ? face.say : (goal > 0 && number && face.stamps !== undefined ? this.stampsLeft(have, goal, reward) : '');

        card.find('.loy-card-say').text(say || '');

        // Los campos: los de la tarjeta (Titular, Premio si es de sellos, Número) o los que mande quien pinta.
        const fields = face.fields || (isCard ? [
            ['Titular', face.holder || '', 'Al portador'],
            ...(goal > 0 ? [['Premio', reward, 'Sin premio']] : []),
            ['Número', number, '0000-0000']
        ] : []);

        card.find('.loy-card-fields').empty().append(fields.map(([label, text, empty]) => $('<span>', { class: 'loy-card-field' }).append(
            $('<span>', { class: 'loy-card-label' }).text(label),
            $('<b>').text(text || empty || '—').toggleClass('is-empty', !text && Boolean(empty))
        )));

        if (window.lucide) lucide.createIcons();

        if (before) {
            if (before.value !== value[1] && value[1]) this.replay(card.find('.loy-card-value b')[0], 'is-pop');
        } else {
            void card[0].offsetWidth;
            card.addClass('is-painted');
        }

        card.data('face', { value: value[1] });

        $(`#${box} .loy-card-caption`).text(face.caption || '');
    }

    // La regla de un tipo de sellos en una línea: «1 sello por cada $100 · 10 = Café gratis».
    stampRule(amount, goal, reward) {
        return `1 sello por cada ${this.moneyShort(amount)} · ${goal} = ${reward || 'premio'}`;
    }

    // Lo que le falta a una tarjeta de sellos: «Te faltan 3 sellos para tu Café gratis», «¡Solo 1 sello…!» o el premio listo.
    stampsLeft(have, goal, reward) {
        const left  = goal - have;
        const prize = reward ? `tu ${reward}` : 'tu premio';

        if (left <= 0) return reward ? `¡Premio listo: ${reward}!` : '¡Premio listo!';
        if (left === 1) return `¡Solo 1 sello para ${prize}!`;

        return `Te faltan ${left} sellos para ${prize}`;
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

        // Un tipo desactivado puede ser el de bienvenida: «Programa» lo avisa.
        if (this.program) this.lsProgram();
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
