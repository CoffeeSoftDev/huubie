let apiEmisor = '/app/facture/ctrl/ctrl-facture-emisor.php';
let app, emisor, emisorView;

// El ticket de la muestra es el mismo consumo en los dos sistemas: cambia el
// papel, no la cuenta. Asi al mover el select se ve que lo que cambia es el
// formato con el que imprime la sucursal, y no los datos del ejemplo.
const SAMPLE_TICKET = {
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
};

// Wansoft imprime la operacion de piso: el movimiento del PDV, las tres horas de
// la mesa y el desglose de la forma de pago con su propina. Son renglones que el
// otro papel no tiene, asi que la muestra los trae aparte.
const SAMPLE_TICKET_WANSOFT = Object.assign({}, SAMPLE_TICKET, {
    cuenta:         '150',
    movimiento:     '4478',
    fechaOperacion: '01/07/2026',
    tipoOrden:      'Venta en Mesa',
    horaEntrada:    '03:58:53 p. m.',
    horaPreticket:  '04:41:36 p. m.',
    horaCierre:     '04:47:14 p. m.',
    iva:            '$0.00',
    terminal:       '1 -- SERVER1',
    fechaImpresion: '01/07/2026 16:47:14',
    pagos: [
        { nombre: 'Tarjeta de crédito', monto: '$250.00', propina: '$0.00', cambio: '$0.00' }
    ]
});

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

    // -- Logo --

    // El logo no viaja con el resto del emisor: es un archivo y useFetch manda
    // urlencoded, que no admite binarios. Va por FormData, el mismo camino que la
    // subida de Importacion.
    async saveLogo(file) {
        const formData = new FormData();
        formData.append('opc',  'saveLogo');
        formData.append('logo', file);

        const response = await fetch(apiEmisor, { method: 'POST', body: formData }).then(r => r.json());

        this.afterLogo(response);
    }

    // Quitar el logo borra el archivo del servidor, asi que se pregunta antes: el
    // papel vuelve a encabezarse con la razon social y la imagen ya no se recupera
    // desde aqui.
    deleteLogo() {
        this.alertBox({
            theme:      FACTURE_THEME,
            type:       'cancel',
            title:      'Quitar el logo del ticket',
            detailHtml: 'El papel vuelve a encabezarse con la razon social y la imagen se borra del servidor.',
            okLabel:    'Quitar',
            onOk: async () => {
                const response = await useFetch({ url: apiEmisor, data: { opc: 'deleteLogo' } });

                this.afterLogo(response);
            }
        });
    }

    // Subir y quitar terminan igual: la pantalla se repinta con el emisor que
    // devuelve el servidor, pero conservando lo que haya tecleado el usuario y no
    // haya guardado todavia. Perderle el membrete a medio capturar por cambiar el
    // logo seria un castigo por usar la pantalla.
    afterLogo(response) {
        if (response.status === 200) {
            app.dataInit.emisor = response.emisor;

            emisorView.renderEmisor(
                Object.assign({}, response.emisor, emisorView.getEmisorForm()),
                emisorView.posList
            );
        }

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
                back:     { href: '/app/facture/index.php', title: 'Regresar al Facturador' }
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
                    // El logo va en su propio cuadro a la derecha y no como un campo
                    // mas: no se teclea, se ve. El formulario ocupa el resto.
                    {
                        type:  'div',
                        id:    'emisorCardBody',
                        class: 'flex flex-col sm:flex-row gap-4 items-start',
                        children: [
                            {
                                id:    'formEmisor',
                                class: 'flex-1 min-w-0 w-full'
                            },
                            // El mt-1 es el que traen los campos del formulario: sin
                            // el, el cuadro arranca un renglon mas arriba que el
                            // primer campo y la tarjeta se ve desalineada.
                            {
                                id:    'logoSlot',
                                class: 'w-full sm:w-[190px] flex-shrink-0 mt-1'
                            }
                        ]
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
                    // El papel no arranca pegado a la banda: la tira sale de la
                    // impresora con un respiro alrededor y sin el se lee como si
                    // estuviera cortada contra el borde del panel.
                    {
                        type:  'div',
                        id:    'ticketPrintArea',
                        class: 'py-4'
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

        this.renderLogoBox(emisorData);

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
                // El sistema encabeza el formulario porque es el que manda sobre todo
                // lo demas: decide con que papel se imprime el ticket (ver
                // renderEmisorPreview) y como se lee el reporte que entra por
                // Importacion. Se captura primero y el resto del membrete se llena
                // viendo ya el papel bueno.
                {
                    opc:      'select',
                    id:       'pos_id',
                    lbl:      'Sistema de punto de venta',
                    selected: 'Sin definir',
                    value:    emisorData.pos_id,
                    data:     this.posList,
                    class:    'col-12 mb-3'
                },
                // El membrete va sin `tipo`: el validador de "texto" solo deja pasar
                // letras y espacios, y estos renglones se imprimen tal como se
                // capturan —"S.A. DE C.V.", un RFC con sus digitos, la calle con su
                // numero—. Un campo que borra lo que se teclea no valida nada, nada
                // mas impide escribir el dato bueno.
                {
                    opc:   'input',
                    id:    'razon',
                    lbl:   'Razon social',
                    class: 'col-12 mb-3'
                },
                // El lema es el renglon que va bajo la razon social. Se guarda en la
                // empresa, igual que el domicilio fiscal: son los dos datos del
                // membrete que no cambian de una sucursal a otra.
                {
                    opc:   'input',
                    id:    'lema',
                    lbl:   'Lema',
                    class: 'col-12 mb-3'
                },
                {
                    opc:   'input',
                    id:    'rfc',
                    lbl:   'RFC',
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
                    class: 'col-12 mb-3'
                },
                {
                    opc:   'input',
                    id:    'expedicion',
                    lbl:   'Lugar de expedicion (sucursal)',
                    class: 'col-12 mb-3'
                },
                // No se imprime en el ticket: es hasta cuanto acepta la casa
                // que el ticket virtual se cuadre con un descuento. El papel que se
                // pase igual se genera, pero sale marcado en Tickets.
                {
                    opc:   'input',
                    id:    'tolerancia',
                    lbl:   'Tolerancia del ajuste de cuadre ($)',
                    tipo:  'cifra',
                    class: 'col-12 col-md-6 mb-3'
                },
                // Media fila: con el cuadro del logo al lado el formulario perdio
                // ancho, y en un tercio el texto del boton se partia en dos.
                {
                    opc:       'button',
                    id:        'btnGuardarEmisor',
                    text:      'Guardar emisor',
                    color_btn: 'primary',
                    class:     'col-12 col-md-6',
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

    // El cuadro del logo vive fuera del formulario: la imagen se sube al elegirla,
    // sin esperar a "Guardar emisor", porque un archivo no cabe en el POST del
    // resto del membrete (ver saveLogo).
    renderLogoBox(emisorData) {
        this.logoBox({
            parent: 'logoSlot',
            json:   { logo: emisorData.logo || '' },
            onPick:   file => emisor.saveLogo(file),
            onRemove: ()   => emisor.deleteLogo()
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
            pos_id:     $('#pos_id').val(),
            tolerancia: $('#tolerancia').val()
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
    //
    // Cada sistema imprime su propio papel, asi que el que se ve es el del select y
    // no el que tiene guardado la sucursal: quien esta por cambiar de POS ve antes
    // de guardar con que formato le va a salir el ticket.
    renderEmisorPreview(emisorData) {
        const code  = this.posItem(emisorData.pos_id).code || emisorData.pos_code || '';
        const papel = TicketPaper.papel({ pos: code });

        this.renderPreviewHead(papel);

        // El logo no se teclea, se sube: no viene en el formulario y la muestra lo
        // toma del emisor guardado, que es lo unico que el papel puede imprimir.
        const emisorPapel = Object.assign({}, emisorData, { logo: app.dataInit.emisor.logo || '' });

        this.ticketPaper({
            parent: 'ticketPrintArea',
            emisor: emisorPapel,
            pos:    code,
            json:   papel === 'wansoft' ? SAMPLE_TICKET_WANSOFT : SAMPLE_TICKET
        });
    }

    // Hay papeles que encabezan solo con el nombre del negocio: el lema, el RFC y
    // el domicilio se siguen capturando —los pide la factura— pero no se imprimen
    // ahi. La banda lo dice, o al cambiar de sistema pareceria que se perdieron.
    //
    // Quien lo decide es el papel y no el sistema: mientras Wansoft imprima con
    // papel prestado (ver TicketPaper.PRESTADO) su membrete sale completo.
    renderPreviewHead(papel) {
        const badge = [{ text: 'muestra', tone: 'b-gray' }];

        if (TicketPaper.MEMBRETE[papel].indexOf('rfc') < 0) badge.push({ text: 'sin membrete fiscal', tone: 'b-yellow' });

        this.panelHead({
            parent: 'previewHead',
            json: {
                icon:  'printer',
                title: 'Vista previa del ticket',
                badge: badge
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

    // Cuadro de carga del logo. Ensena la imagen y no el nombre del archivo: lo que
    // se esta eligiendo es el encabezado del papel, asi que se decide mirandolo.
    // Vacio invita a subir uno; con logo cargado, la miniatura ES el control —se
    // pulsa para cambiarlo— y debajo queda el unico enlace que lo quita.
    logoBox(options) {
        const defaults = {
            parent: 'root',
            id:     'logoBox',
            json:   {
                title: 'Logo del ticket',
                empty: 'Subir logo',
                hint:  'PNG, JPG o WEBP · 2 MB',
                logo:  ''
            },
            onPick:   null,
            onRemove: null
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json  = Object.assign({}, defaults.json, o.json || {});

        const j    = opts.json;
        const wrap = $('<div>', { id: opts.id, class: 'w-full' });

        // El titulo lleva la misma clase que los labels del formulario (CF_CSS.label
        // en coffeeSoft.js): el cuadro es una columna mas de la tarjeta, no un
        // recuadro aparte pegado al lado.
        wrap.html(`
            <label for="${opts.id}File" class="block text-xs font-semibold text-gray-300 mb-1.5 cursor-pointer">${esc(j.title)}</label>
            <label for="${opts.id}File"
                   class="flex items-center justify-center w-full h-[190px] p-3 rounded-lg border-2 border-dashed border-[#374151] bg-[#1F2A37] cursor-pointer overflow-hidden hover:border-blue-400 transition-colors">
                ${j.logo
                    ? `<img src="${esc(j.logo)}" alt="${esc(j.title)}" class="max-w-full max-h-full object-contain">`
                    : `<span class="flex flex-col items-center gap-2 text-gray-400">
                           <i data-lucide="image-plus" class="w-7 h-7"></i>
                           <span class="text-[11px] font-semibold">${esc(j.empty)}</span>
                       </span>`}
            </label>
            <input type="file" id="${opts.id}File" class="hidden" accept="image/png, image/jpeg, image/webp">
            <p class="mt-2 text-[10px] text-gray-400 text-center leading-tight">${esc(j.hint)}</p>
            ${j.logo ? `<button type="button" id="${opts.id}Remove" class="mt-2 w-full text-[11px] font-semibold text-red-400 hover:text-red-300">Quitar logo</button>` : ''}
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

        $(`#${opts.id}File`).on('change', function () {
            const file = this.files && this.files[0];

            if (file && typeof opts.onPick === 'function') opts.onPick(file);
        });

        $(`#${opts.id}Remove`).on('click', () => {
            if (typeof opts.onRemove === 'function') opts.onRemove();
        });
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
