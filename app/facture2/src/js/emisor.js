let apiEmisor = '/app/facture/ctrl/ctrl-facture-emisor.php';
let app, emisor, emisorView;

$(async () => {
    emisorView = new EmisorView(apiEmisor, 'root');
    emisor     = new Emisor(apiEmisor, 'root');
    app        = new App(apiEmisor, 'root');
    await app.init();
});

// -- Clase principal --

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'emisor';
    }

    async init() {
        this.dataInit = await useFetch({ url: apiEmisor, data: { opc: 'init' } });

        this.render();
    }

    render() {
        this.layout();
        emisorView.renderHeader();
        emisorView.renderEmisor(this.dataInit.emisor, this.dataInit.pos);
    }

    // -- Layout --

    layout() {
        const mainPanel = {
            type:  'div',
            id:    'mainPanel',
            class: 'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 w-full',
            children: [
                {
                    id:    'viewHeader',
                    class: 'flex items-center justify-between px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'contentRow',
                    class: 'p-3 flex-1 min-h-0 flex flex-col'
                }
            ]
        };

        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'flex-1 min-h-0 w-full flex flex-col overflow-hidden',
                container: [mainPanel]
            }
        });

        this.cardLayout();
    }

    cardLayout() {
        this.createLayout({
            parent: 'contentRow',
            design: false,
            data: {
                id:        'cardEmisor',
                class:     'w-full flex-1 min-h-0 bg-[#1F2A37] rounded-lg p-4 flex flex-col overflow-hidden',
                container: [
                    {
                        type:  'div',
                        id:    'viewBody',
                        class: 'flex-1 min-h-0 overflow-auto scroll-thin'
                    }
                ]
            }
        });
    }
}

// -- Emisor --

class Emisor extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'emisor';
    }

    // -- Actions --

    async saveEmisor() {
        const response = await useFetch({
            url:  apiEmisor,
            data: Object.assign({ opc: 'saveEmisor' }, emisorView.getEmisorForm())
        });

        if (response.status === 200) app.dataInit.emisor = response.emisor;

        this.alertBox({
            theme: FACTURE_THEME,
            type:  response.status === 200 ? 'success' : 'error',
            title: response.message,
            timer: response.status === 200 ? 1600 : 0
        });
    }
}

// -- Vista --

class EmisorView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'emisor';
    }

    // -- Render helpers --

    renderHeader() {
        this.viewHeader({
            parent: 'viewHeader',
            id:     'hdrEmisor',
            json: {
                title:    'Ticket / Emisor',
                subtitle: 'Datos de la empresa que encabezan el ticket virtual',
                back:     { href: '/app/facture2/admin.php', title: 'Regresar a Configuracion' }
            }
        });
    }

    // -- Layout --

    emisorLayout() {
        this.createLayout({
            parent: 'viewBody',
            design: false,
            data: {
                id:    'emisorWrap',
                class: 'lg:h-full flex flex-col min-h-0',
                container: [
                    {
                        type:  'div',
                        id:    'emisorHead',
                        class: 'pb-3 border-b border-[#374151] flex-shrink-0'
                    },
                    {
                        type:  'div',
                        id:    'emisorRow',
                        class: 'pt-4 lg:flex-1 min-h-0 flex flex-col lg:flex-row gap-4 items-stretch',
                        children: [
                            {
                                id:    'emisorSlot',
                                class: 'w-full lg:flex-1 min-w-0 flex'
                            },
                            {
                                id:    'previewSlot',
                                class: 'w-full lg:w-[600px] flex-shrink-0 flex'
                            }
                        ]
                    }
                ]
            }
        });

        this.createLayout({
            parent: 'emisorSlot',
            design: false,
            data: {
                id:    'emisorCard',
                class: 'w-full bg-[#141d2b] rounded-lg p-4 flex flex-col min-h-0 overflow-auto scroll-thin',
                container: [
                    {
                        type:  'div',
                        id:    'emisorCardHead',
                        class: 'pb-3 mb-3 border-b border-[#374151] flex-shrink-0'
                    },
                    {
                        type: 'div',
                        id:   'formEmisor'
                    }
                ]
            }
        });

        this.createLayout({
            parent: 'previewSlot',
            design: false,
            data: {
                id:    'emisorPreview',
                class: 'w-full bg-[#141d2b] rounded-lg p-4 flex flex-col min-h-0 overflow-auto scroll-thin',
                container: [
                    {
                        type:  'div',
                        id:    'previewHead',
                        class: 'pb-3 mb-3 border-b border-[#374151] flex-shrink-0'
                    },
                    {
                        type: 'div',
                        id:   'ticketPrintArea'
                    }
                ]
            }
        });
    }

    // La banda de la vista dice de un vistazo con que sistema opera la sucursal.
    // Sin capturar sale en gris como "sin sistema": es una sucursal a la que le
    // falta un dato, no una que opere sin punto de venta.
    renderEmisorHead(emisorData) {
        const pos      = this.posItem(emisorData.pos_id);
        const posName  = pos.valor || emisorData.pos_name  || '';
        const posColor = pos.color || emisorData.pos_color || '';

        this.panelHead({
            parent: 'emisorHead',
            json: {
                icon:  'building-2',
                title: 'Emisor del ticket virtual',
                badge: [
                    { text: 'sucursal', tone: 'b-gray' },
                    posName
                        ? { text: posName,       color: posColor }
                        : { text: 'sin sistema', tone: 'b-gray'  }
                ]
            }
        });
    }

    // -- Forms --

    renderEmisor(emisorData, posList) {
        this.emisorLayout();

        this.posList = posList || [];

        this.renderEmisorHead(emisorData);

        this.panelHead({
            parent: 'emisorCardHead',
            json: {
                icon:  'building-2',
                title: 'Datos de la empresa'
            }
        });

        this.panelHead({
            parent: 'previewHead',
            json: {
                icon:  'printer',
                title: 'Vista previa del ticket',
                badge: {
                    text: 'muestra',
                    tone: 'b-gray'
                }
            }
        });

        // El autofill corre despues de armar los campos y pisaria el select con la
        // cadena vacia, dejandolo sin ninguna opcion marcada: la sucursal sin sistema
        // capturado se autollena con el 0, que es la opcion "Sin definir".
        const autofill = Object.assign({}, emisorData, { pos_id: emisorData.pos_id || '0' });

        this.coffeeForm({
            parent:       'formEmisor',
            id:           'frmEmisor',
            theme:        FACTURE_THEME,
            showRequired: false,
            autofill:     autofill,
            json: [
                {
                    opc:   'input',
                    id:    'razon',
                    lbl:   'Razon social',
                    tipo:  'texto',
                    class: 'col-12 mb-3'
                },
                // El lema es el renglon que va bajo la razon social. Se guarda en la
                // empresa, igual que el domicilio fiscal: son los dos datos del
                // membrete que no cambian de una sucursal a otra.
                {
                    opc:   'input',
                    id:    'lema',
                    lbl:   'Lema',
                    tipo:  'texto',
                    class: 'col-12 mb-3'
                },
                {
                    opc:   'input',
                    id:    'rfc',
                    lbl:   'RFC',
                    tipo:  'texto',
                    class: 'col-12 col-md-6 mb-3'
                },
                {
                    opc:   'input',
                    id:    'telefono',
                    lbl:   'Telefono',
                    tipo:  'tel',
                    class: 'col-12 col-md-6 mb-3'
                },
                {
                    opc:   'input',
                    id:    'domicilio',
                    lbl:   'Domicilio fiscal (empresa)',
                    tipo:  'texto',
                    class: 'col-12 mb-3'
                },
                {
                    opc:   'input',
                    id:    'expedicion',
                    lbl:   'Lugar de expedicion (sucursal)',
                    tipo:  'texto',
                    class: 'col-12 mb-3'
                },
                // El punto de venta no se imprime en el ticket: dice con que sistema
                // opera esta sucursal, que es lo que decide como se lee el reporte
                // que entra por Importacion.
                {
                    opc:      'select',
                    id:       'pos_id',
                    lbl:      'Sistema de punto de venta',
                    selected: 'Sin definir',
                    value:    emisorData.pos_id,
                    data:     this.posList,
                    class:    'col-12 mb-3'
                },
                {
                    opc:       'button',
                    id:        'btnGuardarEmisor',
                    text:      'Guardar emisor',
                    color_btn: 'primary',
                    class:     'col-12 col-md-4',
                    onClick:   () => emisor.saveEmisor()
                }
            ]
        });

        this.renderEmisorPreview(emisorData);

        // El select no dispara `input` en todos los navegadores: sin `change` la
        // pildora del sistema se quedaria mostrando el anterior.
        $('#frmEmisor').on('input change', () => {
            const form = this.getEmisorForm();
            this.renderEmisorPreview(form);
            this.renderEmisorHead(form);
        });
    }

    getEmisorForm() {
        return {
            razon:      $('#razon').val(),
            lema:       $('#lema').val(),
            rfc:        $('#rfc').val(),
            telefono:   $('#telefono').val(),
            domicilio:  $('#domicilio').val(),
            expedicion: $('#expedicion').val(),
            pos_id:     $('#pos_id').val()
        };
    }

    // El sistema se resuelve contra el catalogo y no contra lo guardado: asi la
    // pildora sigue al select mientras se captura, antes de guardar. El color viaja
    // en el mismo renglon, de modo que un sistema nuevo llega pintado sin tocar CSS.
    posItem(posId) {
        return (this.posList || []).find(x => String(x.id) === String(posId)) || {};
    }

    // La muestra trae todos los renglones que imprime un ticket real: se captura el
    // membrete mirando el papel completo, no una version recortada de el.
    renderEmisorPreview(emisorData) {
        this.ticketPaper({
            parent: 'ticketPrintArea',
            emisor: emisorData,
            json: {
                nota:      'A-1024',
                folio:     'MUESTRA',
                fechaHora: '01/07/2026 02:32:10 PM',
                mesa:      '12',
                mesero:    'MAFER',
                personas:  '2',
                orden:     '13',
                cajero:    'ADMINISTRACION',
                subtotal:  '$260.00',
                descuento: '$10.00',
                total:     '$250.00',
                propina:   '$0.00',
                letras:    'DOSCIENTOS CINCUENTA PESOS 00/100 M.N.',
                metodo:    'efectivo',
                lineas: [
                    { cant: 2, nombre: 'Producto tasa 0% A', importe: '$120.00' },
                    { cant: 1, nombre: 'Producto tasa 0% B', importe: '$140.00' }
                ]
            }
        });
    }

    // -- Components --

    // El papel de la vista previa es el mismo que imprime el modulo Tickets, asi
    // que sale del componente compartido: si aqui se viera distinto, el usuario
    // estaria capturando el emisor mirando un ticket que no existe.
    ticketPaper(options) {
        TicketPaper.render(options);
    }

    panelHead(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'flex items-center justify-between w-full',
            json:   { icon: '', iconClass: 'w-4 h-4 text-gray-400', title: '', badge: null },
            classes: {
                title: 'text-[12px] font-bold text-gray-300 flex items-center gap-2'
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const iconHtml = opts.json.icon ? `<i data-lucide="${esc(opts.json.icon)}" class="${opts.json.iconClass}"></i>` : '';

        // `badge` admite una pildora o varias: la banda del emisor rotula el alcance
        // y ademas el sistema que esta operando. Una pildora con `color` se pinta con
        // ese hex en vez de con una clase b-*: el color es dato del catalogo.
        const badges    = [].concat(opts.json.badge || []).filter(Boolean);
        const badgeHtml = badges.length
            ? `<div class="flex items-center gap-2">${badges.map(b => `<span class="badge-base ${b.color ? '' : esc(b.tone || 'b-gray')}"${b.color ? ` style="${badgeColorStyle(b.color)}"` : ''}>${esc(b.text)}</span>`).join('')}</div>`
            : '';

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html(`
            <h3 class="${opts.classes.title}">${iconHtml}${esc(opts.json.title)}</h3>
            ${badgeHtml}
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
    }

    // Sin toggles: la pantalla es una sola vista, asi que la banda solo rotula y
    // ofrece el regreso.
    viewHeader(options) {
        const defaults = {
            parent: 'root',
            id:     'viewHeader',
            class:  'flex items-center justify-between w-full',
            json:   { title: '', subtitle: '', back: null },
            classes: {
                title:    'text-lg font-bold text-white',
                subtitle: 'text-xs text-gray-400',
                backBtn:  'w-8 h-8 rounded-full bg-[#1F2A37] hover:bg-[rgba(28,100,242,0.12)] border border-[#374151] hover:border-blue-400 flex items-center justify-center text-gray-400 hover:text-blue-300 transition-colors flex-shrink-0'
            },
            onBack: null
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const backCfg   = opts.json.back;
        const backHref  = typeof backCfg === 'string' ? backCfg : (backCfg && backCfg.href) || '';
        const backTitle = (backCfg && backCfg.title) || 'Regresar';
        const backHtml  = backCfg ? `
            <button type="button" id="${opts.id}_back" class="${opts.classes.backBtn}" title="${esc(backTitle)}">
                <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>
        ` : '';

        const wrap = $('<div>', { id: opts.id, class: opts.class });

        wrap.html(`
            <div class="flex items-center gap-3">
                ${backHtml}
                <div>
                    <h1 class="${opts.classes.title}">${esc(opts.json.title)}</h1>
                    ${opts.json.subtitle ? `<p class="${opts.classes.subtitle}">${esc(opts.json.subtitle)}</p>` : ''}
                </div>
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

        if (backCfg) {
            $(`#${opts.id}_back`).on('click', () => {
                if (typeof opts.onBack === 'function') return opts.onBack();
                if (backHref) window.location.href = backHref;
            });
        }
    }
}

// -- Complementos --

// Misma receta que las clases b-* del tema: el hex del catalogo entra como texto
// y como fondo y borde translucidos, para que la pildora se lea igual que las demas.
// Un hex mal capturado no pinta nada en vez de romper el estilo.
function badgeColorStyle(hex) {
    const rgb = /^#([0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!rgb) return '';

    const n = parseInt(rgb[1], 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');

    return `color:rgb(${c});background:rgba(${c},.12);border-color:rgba(${c},.35)`;
}

function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}
