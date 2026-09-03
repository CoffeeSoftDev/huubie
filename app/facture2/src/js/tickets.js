let apiTickets = '/app/facture/ctrl/ctrl-facture-tickets.php';
let app, tickets, ticketsView;

// La subida reusa el controlador de Cargas: es el que sabe leer el libro, validar
// sus columnas contra el contrato del POS y guardar el lote del periodo. Aqui solo
// se le manda el archivo desde la pantalla donde se echa de menos.
const apiCargas = '/app/facture/ctrl/ctrl-facture-cargas.php';

// Las dos pestanas del contrato a las que pertenece lo que este modulo necesita:
// el reporte por forma de pago —de donde salen los folios y los montos— y el
// detalle de comandas, que es lo que el ticket del 16% imprime.
const UPLOAD_TAB   = 'sales-report';
const COMMANDS_TAB = 'commands';

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

// La meta con la que se cerro el ultimo dia sobrevive al refresco: es un acuerdo
// del mes, no del momento, y volver a capturarla en cada entrada invitaria a
// repartir un dia con la meta de otro sin notarlo.
const META_KEY = 'facture2.tickets.meta';


$(async () => {
    ticketsView = new TicketsView(apiTickets, 'root');
    tickets     = new Tickets(apiTickets, 'root');
    app         = new App(apiTickets, 'root');
    await app.init();
});

class App extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'tickets';
        this.selectedId   = null;
        this.dataKpis     = {};
    }

    // El dia lo resuelve el servidor: el Excel del POS se sube en diferido, asi que
    // el modulo abre en el ultimo dia con cobros con tarjeta. Con ?dia= entra a ese.
    async init() {
        this.dataInit = await useFetch({ url: apiTickets, data: { opc: 'init', dia: this.getParam('dia') } });
        this.meta     = this.loadMeta();

        this.hideTitleOnPrint();
        this.render();
    }

    // -- Ancho del panel del ticket --

    // Limites del arrastre. El minimo no baja de lo que mide el papel: la tira son
    // 340px fijos (.ticket-paper en facture.css) mas el aire de su contenedor, y por
    // debajo el ticket se leeria con scroll horizontal. El maximo evita que el panel
    // se coma el listado, que es lo que se vino a ver.
    static get PANEL_MIN() { return 380; }
    static get PANEL_MAX() { return 720; }
    static get PANEL_DEF() { return 420; }

    panelKey() {
        return `facture:detailWidth:${this.PROJECT_NAME}`;
    }

    // El ancho se guarda por modulo y sobrevive a la recarga: reajustarlo cada vez
    // que se entra a Tickets seria pedirle al usuario que repita la misma decision.
    aplicarAncho(px, guardar) {
        const ancho = Math.round(Math.min(App.PANEL_MAX, Math.max(App.PANEL_MIN, px)));

        document.documentElement.style.setProperty('--detail-w', `${ancho}px`);

        const tirador = document.getElementById('detailResizer');
        if (tirador) tirador.setAttribute('aria-valuenow', ancho);

        if (guardar) {
            try { localStorage.setItem(this.panelKey(), ancho); } catch (e) { /* sin storage se pierde al salir, nada mas */ }
        }

        return ancho;
    }

    anchoGuardado() {
        try {
            const px = Number(localStorage.getItem(this.panelKey()));
            return px > 0 ? px : null;
        } catch (e) {
            return null;
        }
    }

    // Arrastrar el borde del panel. Se escucha con pointer events y no con mouse:
    // asi el mismo gesto sirve con dedo y con lapiz, y setPointerCapture mantiene
    // el arrastre aunque el puntero se salga del tirador o de la ventana.
    resizePanel() {
        const tirador = document.getElementById('detailResizer');
        const panel   = document.getElementById('detailPanel');
        if (!tirador || !panel) return;

        this.aplicarAncho(this.anchoGuardado() || App.PANEL_DEF, false);

        tirador.setAttribute('role', 'separator');
        tirador.setAttribute('aria-orientation', 'vertical');
        tirador.setAttribute('aria-label', 'Ancho del panel del ticket');
        tirador.setAttribute('aria-valuemin', App.PANEL_MIN);
        tirador.setAttribute('aria-valuemax', App.PANEL_MAX);
        tirador.setAttribute('type', 'button');

        // El ancho se mide desde el borde derecho de la ventana hasta el puntero,
        // no como un delta acumulado: si el arrastre se sale de los limites y
        // vuelve, el panel sigue pegado al cursor en vez de quedar desfasado.
        const mover = (e) => this.aplicarAncho(window.innerWidth - e.clientX, false);

        tirador.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;

            e.preventDefault();
            tirador.setPointerCapture(e.pointerId);
            tirador.classList.add('is-dragging');
            document.body.classList.add('is-resizing');

            const soltar = () => {
                tirador.classList.remove('is-dragging');
                document.body.classList.remove('is-resizing');
                tirador.removeEventListener('pointermove', mover);
                this.aplicarAncho(panel.getBoundingClientRect().width, true);
            };

            tirador.addEventListener('pointermove', mover);
            tirador.addEventListener('pointerup', soltar, { once: true });
            tirador.addEventListener('pointercancel', soltar, { once: true });
        });

        // Teclado: el panel se mueve de 16 en 16, y de 64 con Shift. Home y End
        // van a los topes.
        tirador.addEventListener('keydown', (e) => {
            const paso = e.shiftKey ? 64 : 16;
            const hoy  = panel.getBoundingClientRect().width;

            const destino = {
                ArrowLeft:  hoy + paso,
                ArrowRight: hoy - paso,
                Home:       App.PANEL_MAX,
                End:        App.PANEL_MIN
            }[e.key];

            if (destino === undefined) return;

            e.preventDefault();
            this.aplicarAncho(destino, true);
        });

        // Doble clic devuelve el ancho de fabrica: es la salida para quien arrastro
        // de mas y no sabe con que numero volver.
        tirador.addEventListener('dblclick', () => this.aplicarAncho(App.PANEL_DEF, true));
    }

    // -- Meta de facturacion --

    // El default lo manda el servidor, que es donde vive la politica de la casa.
    // Lo guardado solo se acepta si esta completo: un localStorage a medias dejaria
    // el dia repartiendose contra una meta vacia.
    loadMeta() {
        const base = {
            modo:  'pct',
            valor: this.dataInit.metaPct,
            cero:  100 - this.dataInit.metaPct
        };

        try {
            const guardado = JSON.parse(localStorage.getItem(META_KEY));

            if (guardado && (guardado.modo === 'pct' || guardado.modo === 'monto') && guardado.valor >= 0) {
                // Lo guardado antes de que existiera el segundo campo no trae el 0%:
                // se completa con el resto en vez de descartar la meta entera.
                if (guardado.cero === undefined) {
                    guardado.cero = guardado.modo === 'pct' ? 100 - guardado.valor : '';
                }

                return guardado;
            }
        } catch (e) { }

        return base;
    }

    saveMeta() {
        localStorage.setItem(META_KEY, JSON.stringify(this.meta));
    }

    getParam(name) {
        return new URLSearchParams(window.location.search).get(name) || '';
    }

    // El encabezado que el navegador estampa en cada hoja se arma con la fecha y el
    // titulo de la pagina, y el ticket entregado no tiene por que anunciar de que
    // sistema salio. El titulo se vacia mientras dura la impresion y se repone al
    // cerrar el dialogo, porque en pantalla si nombra a la pestana.
    //
    // El @page sin margen de facture.css es lo que quita el encabezado completo;
    // esto es el respaldo para cuando el usuario imprime con "Encabezados y pies de
    // pagina" marcado, que es ajuste del navegador y no se puede tocar desde aqui.
    hideTitleOnPrint() {
        const titulo = document.title;

        window.addEventListener('beforeprint', () => { document.title = ''; });
        window.addEventListener('afterprint',  () => { document.title = titulo; });
    }

    render() {
        this.layout();
        this.resizePanel();
        this.filterBar();
        ticketsView.renderFooter();
        ticketsView.renderPreview(null);
        tickets.lsTickets();
    }

    // Tres bandas y no siete. La banda azul de la terminal ya rotula la pantalla y
    // ya ofrece el regreso al menu, asi que el encabezado del modulo repetia el
    // nombre, la fecha y el boton de volver un renglon mas abajo; y la nota del
    // reparto era un parrafo fijo que ahora vive detras del boton del pie.
    //
    // Queda: la barra de operacion (fecha y acciones), la franja de cifras del dia
    // y la tabla, que empieza donde antes terminaban las tarjetas.
    layout() {
        const mainPanel = {
            type:  'div',
            id:    'mainPanel',
            class: 'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 w-full',
            children: [
                {
                    id:    'filterBar',
                    class: 'px-3 pt-3 pb-1 bg-[#0E1521] flex-shrink-0'
                },
                {
                    id:    'statsRow',
                    class: 'px-4 py-2 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'tableRow',
                    class: 'px-3 py-2 flex-1 min-h-0 flex flex-col'
                },
                // La hoja del dia solo existe para el papel: en pantalla no se ve y
                // @media print la saca a imprimir, igual que #ticketPrintArea.
                {
                    id:    'printSheet',
                    class: 'hidden'
                },
                {
                    id:    'viewFooterRow',
                    class: 'flex items-center justify-between px-4 py-2 bg-[#0E1521] flex-shrink-0'
                }
            ]
        };

        // El tirador que separa las dos columnas. Va como <button> y no como <div>
        // para que entre en el orden de tabulacion: quien no puede arrastrar con el
        // raton mueve el panel con las flechas. Lo viste facture.css por id, igual
        // que en Cargas.
        const detailResizer = {
            type:  'button',
            id:    'detailResizer'
        };

        // createLayout solo itera children en type 'div': para un aside caen en el
        // default y jQuery los toma como metodo. Las zonas del panel se arman aparte.
        //
        // El ancho no vive aqui: lo pone --detail-w desde el CSS, que es quien sabe
        // si la pantalla esta en una columna o en dos.
        const detailPanel = {
            type:  'aside',
            id:    'detailPanel',
            class: 'w-full flex-shrink-0 bg-[#141d2b] border-t md:border-t-0 md:border-l border-[#374151] flex flex-col overflow-hidden'
        };

        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'flex-1 min-h-0 w-full flex flex-col md:flex-row overflow-hidden',
                container: [mainPanel, detailResizer, detailPanel]
            }
        });

        this.createLayout({
            parent: 'detailPanel',
            design: false,
            data: {
                id:        'detailInner',
                class:     'flex-1 min-h-0 flex flex-col overflow-hidden',
                container: [
                    {
                        type:  'div',
                        id:    'detailHead',
                        class: 'px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex items-center justify-between flex-wrap gap-2 flex-shrink-0'
                    },
                    {
                        type:  'div',
                        id:    'ticketPrintArea',
                        class: 'flex-1 min-h-0 overflow-auto scroll-thin px-4 py-4 bg-[#0E1521]'
                    },
                    {
                        type:  'div',
                        id:    'detailNote',
                        class: 'px-4 py-2 flex-shrink-0'
                    }
                ]
            }
        });

        this.tableLayout();
    }

    // La tabla vive en una tarjeta, como la bitacora de cargas: el p-3 de la fila
    // queda como margen exterior y el fondo de la tarjeta la separa del panel.
    tableLayout() {
        this.createLayout({
            parent: 'tableRow',
            design: false,
            data: {
                id:    'cardTable',
                class: 'w-full flex-1 min-h-0 bg-[#1F2A37] rounded-lg px-3 py-2 flex flex-col',
                container: [
                    {
                        type:  'div',
                        id:    'tableWrap',
                        class: 'flex-1 min-h-0 overflow-auto scroll-thin'
                    }
                ]
            }
        });
    }

    // Los tres botones se pintan de una vez y se muestran segun el estado del dia
    // (ver syncActionButtons). Repintar la barra en cada listado le quitaria el foco
    // al selector de fecha justo cuando se esta usando.
    filterBar() {
        const filters = [
            {
                opc:      'input',
                id:       'fDia',
                lbl:      'Dia:',
                type:     'date',
                class:    'col-12 col-md-4 col-lg-2',
                value:    this.dataInit.dia,
                required: false,
                onchange: 'app.onChangeFilters()'
            },
            // Las acciones se agrupan a la derecha y la fecha se queda sola a la
            // izquierda: en un renglon unico eso separa lo que se consulta de lo que
            // se ejecuta, sin necesidad de un titulo que lo explique.
            //
            // Cada boton lleva su col-start fijo porque no se muestran los tres a la
            // vez (ver syncActionButtons): con el sitio reservado, el que aparece cae
            // siempre en la misma columna y la barra no baila al repartir el dia.
            //
            // El primario va pegado al engrane y el secundario a su izquierda, en el
            // mismo orden en que estan aqui: asi la lectura y el orden de tabulacion
            // coinciden.
            // Rehacer se corre a la primera columna del grupo para dejarle su sitio a
            // la subida: los dos solo coinciden en pantalla cuando el dia ya se
            // repartio, y ahi la barra se lee de izquierda a derecha en el orden en
            // que se usan —deshacer, subir, imprimir—.
            {
                opc:       'button',
                id:        'btnRehacer',
                text:      'Rehacer reparto',
                color_btn: 'secondary',
                class:     'col-12 col-md-4 col-lg-2 lg:col-start-6',
                className: 'whitespace-nowrap !px-2',
                onClick:   () => tickets.redoDay()
            },
            {
                opc:       'button',
                id:        'btnGenerarTodos',
                text:      'Generar ticket',
                color_btn: 'invernal',
                class:     'col-12 col-md-4 col-lg-2 lg:col-start-8',
                className: 'whitespace-nowrap !px-2',
                onClick:   () => tickets.previewDay()
            },
            {
                opc:       'button',
                id:        'btnImprimirTodos',
                text:      'Imprimir tickets',
                color_btn: 'invernal',
                class:     'col-12 col-md-4 col-lg-2 lg:col-start-8',
                className: 'whitespace-nowrap !px-2',
                onClick:   () => tickets.printSheet()
            },
            // Las ventas del dia salen de una carga, y cuando el dia que se busca no
            // esta es porque esa carga falta. Va con las acciones y no junto a la
            // fecha: subir el Excel es algo que se hace, no un filtro.
            //
            // Y va pegado al engrane, en la ultima columna del grupo: es el unico
            // boton que se ve en los dos estados del dia, asi que con las acciones
            // ocultas —el dia sin ventas cargadas— se quedaba flotando en medio de
            // la barra. Ahi tambien importa el orden de declaracion: el grid coloca
            // las celdas segun el DOM, y un col-start menor despues de uno mayor cae
            // en el renglon siguiente.
            {
                opc:       'button',
                id:        'btnCargarVentas',
                text:      'Subir Excel',
                color_btn: 'light',
                class:     'col-12 col-md-4 col-lg-2 lg:col-start-10',
                className: 'whitespace-nowrap !px-2',
                onClick:   () => app.openUploadModal()
            },
            // Cuanto de la venta se factura al 16% es un acuerdo del mes, no un filtro
            // del dia: vive detras del engrane y no en la barra, donde dos campos mas
            // competian por el renglon con la fecha y las acciones.
            //
            // Va al final, en la ultima columna (col-start-12) y pegado al boton que
            // le precede: alineado al borde derecho de su columna quedaba un hueco de
            // medio ancho de columna que lo dejaba flotando lejos de las acciones.
            // La meta vigente la sigue diciendo la cifra del IVA 16% de la franja, no
            // este boton.
            //
            // El flex-col no sobra: cada celda de la barra trae una etiqueta vacia
            // que reserva el renglon del rotulo, y solo apilando —etiqueta arriba,
            // control abajo— este boton cae a la misma altura que los demas. En fila
            // se centraba en la celda y quedaba diez pixeles mas alto.
            //
            // Y ocupa su columna entera en vez de ser un cuadro de 40px: la columna
            // mide casi el doble, asi que un boton mas estrecho dejaba sobrando ese
            // resto —a un lado o al otro, segun se alineara— y se leia como un hueco
            // en la barra. Ancho completo, cero sobrante.
            {
                opc:       'button',
                id:        'btnMetaConfig',
                text:      '',
                color_btn: 'light',
                class:     'col-6 col-lg-1 lg:col-start-12 flex flex-col items-stretch',
                className: '!h-9 !px-0 flex items-center justify-center',
                onClick:   () => app.openMetaModal()
            }
        ];

        this.createfilterBar({
            parent:     'filterBar',
            coffeesoft: true,
            theme:      FACTURE_THEME,
            data:       filters
        });

        this.decorateMetaButton();
        this.decorateUploadButton();
        this.hideActionButtons();
    }

    // El icono va delante del texto: en una barra donde los demas botones son
    // palabras, la flecha de subir es lo que distingue el que abre el explorador de
    // archivos de los que ejecutan el cierre.
    decorateUploadButton() {
        // El verde es el de Excel, el mismo del icono de la zona de arrastre: en una
        // barra donde el color lo llevan las acciones del cierre, marca que este
        // boton va por un archivo y no reparte nada.
        $('#btnCargarVentas')
            .addClass('flex items-center justify-center gap-2')
            .prepend($('<i>', { 'data-lucide': 'upload', class: 'w-4 h-4', style: 'color:#217346' }));

        if (window.lucide) lucide.createIcons();
    }

    // Las tres acciones nacen ocultas y solo aparece la que toca, cuando el
    // listado dice en que estado esta el dia.
    //
    // La barra se pinta antes de que lleguen esos datos, asi que si nacieran
    // visibles se verian las tres —o dos, con el engrane— durante el parpadeo de
    // la carga, para desaparecer un instante despues. Se mostraba justo lo que no
    // se podia hacer todavia.
    //
    // Se esconde la COLUMNA y no el boton, igual que en syncActionButtons: el
    // <button> vive dentro de su celda de la rejilla y ocultarlo solo dejaria el
    // hueco reservado.
    hideActionButtons() {
        ['btnGenerarTodos', 'btnImprimirTodos', 'btnRehacer'].forEach(id => {
            $(`#${id}`).closest('[class*="col-"]').hide();
        });
    }

    // Repartir el dia y sacar el papel son dos momentos distintos, y solo uno de los
    // dos tiene sentido a la vez: mientras el dia no se reparte no hay nada que
    // imprimir, y una vez repartido volver a correrlo es rehacerlo.
    //
    // Se esconde la columna, no el boton: el <button> vive dentro de su celda de la
    // rejilla y ocultarlo solo dejaria el hueco.
    syncActionButtons(counts) {
        const repartido = (counts.generados || 0) > 0;
        const columna   = (id) => $(`#${id}`).closest('[class*="col-"]');

        // El papel abierto se queda aunque el dia no este repartido: desde que las
        // ventas con comanda cargada se pueden ver antes del reparto, cerrarlo aqui
        // vaciaria el panel en cada repintado del listado. Del cambio de fecha se
        // encarga onChangeFilters, que suelta el folio si dejo de estar en la lista.
        columna('btnGenerarTodos').toggle(!repartido);
        columna('btnImprimirTodos').toggle(repartido);
        columna('btnRehacer').toggle(repartido);
    }

    // -- Dia sin datos --

    // Un dia sin ventas apaga todo lo que cuelga de ellas: las tres acciones, que
    // trabajarian sobre un dia vacio; la franja de cifras, que saldria en ceros; y
    // las notas del pie, que hablan de un reparto que no existe. Se van tambien las
    // que quedaron pintadas del dia anterior, porque al cambiar de fecha ya son de
    // otro dia.
    //
    // Se quedan la fecha y la meta: son lo unico con lo que se sale del vacio.
    emptyDay() {
        this.hideActionButtons();

        $('#statsRow').hide();

        if (this.selectedId) this.selectTicket(null);

        ticketsView.renderCutNote(null);
        ticketsView.renderMudadosLink([]);

        this.dataKpis    = {};
        this.dataMudados = [];

        this.updateFooterInfo('');
        this.syncMetaButton();
    }


    // La meta viaja con el dia en todas las peticiones: decide que ticket va a que
    // tasa, asi que el listado, el cierre y la hoja tienen que verla igual.
    getFilters() {
        return {
            dia:       $('#fDia').val() || this.dataInit.dia,
            metaModo:  this.meta.modo,
            metaValor: this.meta.valor,
            metaCero:  this.meta.cero
        };
    }

    // -- Event handlers --

    // Se espera al repintado antes de preguntar por el folio: sin el await la
    // comprobacion corre sobre la tabla anterior, que todavia lo tiene, y el papel
    // de un dia se quedaria abierto sobre el listado de otro.
    async onChangeFilters() {
        await tickets.lsTickets();

        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectTicket(null);
        }
    }

    // El listado ya viene filtrado del servidor: basta con ver si el folio
    // seleccionado sobrevivio al repintado.
    isVisibleAfterFilters(folio) {
        return $(`#tb${this.PROJECT_NAME} [data-folio="${folio}"]`).length > 0;
    }

    // -- Distribucion IVA 16% / IVA 0% --

    // El acuerdo se escribe de dos formas —"el 70%" o "$15,000 cerrados"— y las dos
    // dicen lo mismo: cuanto de la venta con tarjeta se factura a cada tasa.
    //
    // Las DOS cifras se capturan, no una. El 0% dejo de ser el resto que nadie
    // escribe: se propone —el campo que no se ha tocado sigue al otro— pero se
    // puede corregir, y entonces las dos tienen que sumar el Total Tarjeta de
    // Credito. Mientras no sumen, Aplicar no deja pasar el reparto.
    openMetaModal() {
        if (this.metaModal) return;

        // El campo que el usuario todavia no toca sigue al otro. En cuanto toca los
        // dos, ninguno se autocompleta: las dos cifras son suyas y pueden no cuadrar,
        // que es lo que la validacion tiene que atrapar.
        this.metaTouched = { valor: true, cero: false };

        this.metaModal = this.cfModal({
            title:         'Distribucion IVA 16% / IVA 0%',
            size:          'small',
            theme:         FACTURE_THEME,
            okLabel:       'Aplicar',
            cancelLabel:   'Cancelar',
            backdropClose: true,
            onOk:          () => this.applyMeta(),
            onClose:       () => { this.metaModal = null; }
        });

        this.metaModal.body.append($('<div>', { id: 'metaModalForm' }));
        this.metaModal.body.append($('<div>', { id: 'metaModalPreview' }));

        this.createfilterBar({
            parent:     'metaModalForm',
            id:         'frmMetaTickets',
            coffeesoft: true,
            theme:      FACTURE_THEME,
            data: [
                {
                    opc:      'select',
                    id:       'fMetaModo',
                    lbl:      'Aplicar por:',
                    class:    'col-12',
                    value:    this.meta.modo,
                    required: false,
                    onchange: 'app.onChangeMetaModo()',
                    data: [
                        { id: 'pct',   valor: 'Porcentaje (%)' },
                        { id: 'monto', valor: 'Cantidad ($)'   }
                    ]
                },
                {
                    opc:      'input',
                    id:       'fMetaValor',
                    lbl:      'Monto IVA 16%:',
                    type:     'number',
                    tipo:     'numero',
                    class:    'col-12 col-sm-6',
                    value:    this.meta.valor,
                    required: false
                },
                {
                    opc:      'input',
                    id:       'fMetaCero',
                    lbl:      'Monto IVA 0%:',
                    type:     'number',
                    tipo:     'numero',
                    class:    'col-12 col-sm-6',
                    value:    this.metaCeroValor(),
                    required: false
                }
            ]
        });

        // El reparto se recalcula tecla a tecla: es lo que se esta mirando mientras
        // se captura, y con onchange solo aparece al salir del campo.
        $('#fMetaValor').on('input', () => this.onInputMeta('valor'));
        $('#fMetaCero').on('input',  () => this.onInputMeta('cero'));

        this.renderMetaPreview();
    }

    // El complemento con el que abre el campo del 0%: lo que le falta al 16% para
    // llegar al total del dia, en la unidad que este puesta.
    metaCeroValor() {
        if (this.meta.cero !== undefined && this.meta.cero !== '') return this.meta.cero;

        const total = parseFloat(this.dataKpis.total) || 0;
        const valor = parseFloat(this.meta.valor) || 0;

        if (this.meta.modo === 'monto') return Math.max(0, Math.round((total - valor) * 100) / 100);

        return Math.round((100 - valor) * 100) / 100;
    }

    // Escribir en un campo propone el resto en el otro, mientras ese otro siga sin
    // tocarse. Es lo que hace que capturar dos cifras cueste un solo gesto.
    onInputMeta(campo) {
        this.metaTouched[campo] = true;

        const total = parseFloat(this.dataKpis.total) || 0;
        const otro  = campo === 'valor' ? 'cero' : 'valor';

        if (!this.metaTouched[otro]) {
            const escrito = parseFloat($(campo === 'valor' ? '#fMetaValor' : '#fMetaCero').val()) || 0;
            const resto   = $('#fMetaModo').val() === 'monto'
                ? Math.max(0, total - escrito)
                : Math.max(0, 100 - escrito);

            $(otro === 'valor' ? '#fMetaValor' : '#fMetaCero').val(Math.round(resto * 100) / 100);
        }

        this.renderMetaPreview();
    }

    // Cambiar de unidad no cambia la meta: la traduce. El 70% de la venta y su
    // importe son el mismo acuerdo escrito de dos formas, y quien alterna el
    // selector espera ver la conversion, no un campo que se reinicia.
    onChangeMetaModo() {
        const modo  = $('#fMetaModo').val();
        const total = parseFloat(this.dataKpis.total) || 0;

        // Sin venta en el dia no hay de que sacar el porcentaje: se vuelve al
        // default en vez de dejar el campo en cero, que repartiria todo al 0%.
        const convertir = (v) => modo === 'monto'
            ? total * v / 100
            : (total > 0 ? v / total * 100 : this.dataInit.metaPct);

        const valor = parseFloat($('#fMetaValor').val()) || 0;
        const cero  = parseFloat($('#fMetaCero').val())  || 0;

        $('#fMetaValor').val(Math.round(convertir(valor) * 100) / 100);
        $('#fMetaCero').val(Math.round(convertir(cero) * 100) / 100);

        this.renderMetaPreview();
    }

    // El reparto que se va a aplicar, con la misma cuenta que metaDelDia() hace en el
    // servidor. Las dos cifras se leen de sus campos y se comparan contra el total:
    // esa diferencia es lo unico que el modulo calcula en pantalla, y solo porque se
    // mira antes de que exista la peticion que la confirmaria.
    renderMetaPreview() {
        const total = parseFloat(this.dataKpis.total) || 0;
        const modo  = $('#fMetaModo').val();

        const enPesos = (v) => modo === 'monto' ? v : total * v / 100;

        const monto16 = enPesos(parseFloat($('#fMetaValor').val()) || 0);
        const monto0  = enPesos(parseFloat($('#fMetaCero').val())  || 0);
        const suma    = monto16 + monto0;
        const dif     = suma - total;

        // La misma tolerancia con la que el modulo compara montos en el cierre: por
        // debajo de medio centavo el reparto se da por cuadrado.
        const cuadra = Math.abs(dif) < 0.005;

        this.lockMetaOk(!cuadra);

        ticketsView.renderMetaPreview({
            totalTexto:   this.moneyText(total),
            texto16:      this.moneyText(monto16),
            texto0:       this.moneyText(monto0),
            pct16:        this.pctText(total > 0 ? monto16 / total * 100 : 0),
            pct0:         this.pctText(total > 0 ? monto0 / total * 100 : 0),
            sumaTexto:    this.moneyText(suma),
            difTexto:     this.moneyText(Math.abs(dif)),
            sobra:        dif > 0,
            cuadra:       cuadra,
            // El campo que todavia sigue al otro se rotula, para que se vea que la
            // cifra es una propuesta y no algo que alguien capturo.
            sugerido:     !this.metaTouched.cero ? '0' : (!this.metaTouched.valor ? '16' : '')
        });
    }

    // Aplicar solo existe cuando el reparto cuadra: el boton del cfModal es el
    // ultimo del pie, y se apaga con la clase que el resto del modulo usa para lo
    // deshabilitado.
    lockMetaOk(bloquear) {
        if (!this.metaModal) return;

        this.metaModal.footer.find('button').last()
            .prop('disabled', bloquear)
            .toggleClass('opacity-50 cursor-not-allowed', bloquear);
    }

    // Aplicar cierra el modal y vuelve a pedir el dia: la meta viaja en cada
    // peticion, asi que el listado, los KPIs y el reparto tienen que verla igual.
    applyMeta() {
        const valor = parseFloat($('#fMetaValor').val());
        const cero  = parseFloat($('#fMetaCero').val());

        this.meta = {
            modo:  $('#fMetaModo').val(),
            valor: isNaN(valor) || valor < 0 ? 0 : valor,
            cero:  isNaN(cero)  || cero  < 0 ? 0 : cero
        };

        this.saveMeta();
        this.metaModal.close();
        tickets.lsTickets();
    }

    // -- Actualizar ventas --

    // El paso 2 del proceso, dentro del modulo: traer del Excel las ventas que
    // falten. Por dentro son las mismas dos peticiones del modulo Cargas
    // —inspectFile revisa el libro sin guardar, uploadFile lo carga— y el periodo
    // se captura antes que el archivo, porque es lo que decide donde caen las filas.
    //
    // Cargas sigue existiendo para lo demas: comandas, archivos bancarios y la
    // bitacora de lotes. Esta ruta es solo la del reporte de ventas.
    openUploadModal() {
        if (this.uploadModal) return;

        this.uploadFiles       = [];
        this.progressTimer     = null;
        this.progressFrom      = 0;
        this.mesesElegidos     = null;
        this.repartoConfirmado = false;

        this.uploadModal = this.cfModal({
            title:         'Actualizar ventas',
            // El periodo y el archivo caben en un renglon cada uno, pero en el
            // ancho corto el rotulo de la zona de arrastre se parte en dos y el
            // nombre del archivo elegido se recorta a la mitad.
            size:          'large',
            theme:         FACTURE_THEME,
            okLabel:       'Subir ventas',
            cancelLabel:   'Cancelar',
            backdropClose: false,
            onOk:          () => this.sendUpload(),
            // Cerrar el modal a media carga no debe dejar la consulta del avance
            // preguntando cada dos segundos por una pantalla que ya no existe.
            onClose:       () => { this.stopProgress(); this.uploadModal = null; }
        });

        // El alto no cambia entre pasos: elegir los archivos, subirlos y ver el
        // resultado ocupan el mismo hueco, para que el dialogo no salte bajo el
        // cursor mientras se trabaja en el.
        this.createLayout({
            parent: this.uploadModal.body.attr('id') || this.uploadModalHost(),
            design: false,
            data: {
                id:        'uploadModalBox',
                class:     'h-[22rem] overflow-y-auto overflow-x-hidden scroll-thin',
                container: [
                    {
                        type: 'div',
                        id:   'uploadModalForm'
                    },
                    {
                        type: 'div',
                        id:   'uploadModalDrop'
                    },
                    {
                        type: 'div',
                        id:   'uploadModalState'
                    }
                ]
            }
        });

        const hoy = new Date(this.dataInit.dia + 'T00:00:00');

        this.createfilterBar({
            parent:     'uploadModalForm',
            id:         'frmUploadTickets',
            coffeesoft: true,
            theme:      FACTURE_THEME,
            data: [
                {
                    opc:      'select',
                    id:       'fUpMes',
                    lbl:      'Mes de estas ventas:',
                    class:    'col-12 col-sm-7',
                    value:    String(hoy.getMonth() + 1),
                    required: false,
                    data: MESES.map((m, i) => ({ id: String(i + 1), valor: m }))
                },
                {
                    opc:      'select',
                    id:       'fUpAnio',
                    lbl:      'Año:',
                    class:    'col-12 col-sm-5',
                    value:    String(hoy.getFullYear()),
                    required: false,
                    data:     this.uploadYears()
                }
            ]
        });

        this.renderUploadList();
    }

    // El cuerpo del cfModal nace sin id y createLayout necesita uno para colgarse.
    uploadModalHost() {
        this.uploadModal.body.attr('id', 'uploadModalBody');

        return 'uploadModalBody';
    }

    // Los años que se pueden elegir. Escribir el año a mano invitaba a un 2062 por
    // un dedazo, y el lote se habria guardado ahi sin que nada lo objetara: son los
    // dos ultimos ejercicios y el que corre, que es todo lo que un POS reexporta.
    uploadYears() {
        const actual = new Date(this.dataInit.dia + 'T00:00:00').getFullYear();

        return [0, 1, 2].map((n) => ({ id: String(actual - n), valor: String(actual - n) }));
    }

    // -- Los dos archivos del dia --

    // Wansoft exporta el dia en dos libros y el modulo necesita los dos:
    //
    //   ventas    el reporte por forma de pago, de donde salen los folios, los
    //             montos y las formas de cobro. Sin el no hay dia que repartir.
    //   comandas  el detalle de lo consumido. Sin el, el ticket del 16% sale con
    //             un unico renglon que dice CONSUMO en vez de los platillos.
    //
    // `archivo` es el nombre con el que Wansoft los exporta, y con el que llegan
    // salvo que alguien los renombre: el POS les pega la fecha detras
    // —ReporteVentasPorFormaDePago2026-08-23.xlsx— pero la raiz no cambia. Es lo
    // primero que se mira para saber cual es cual; si no coincide, lo dice el
    // contenido (ver slotDelNombre).
    uploadSlots() {
        return [
            {
                tipo:    UPLOAD_TAB,
                nombre:  'Reporte de ventas',
                archivo: 'ReporteVentasPorFormaDePago',
                falta:   'Sin el no se puede repartir el dia.'
            },
            {
                tipo:    COMMANDS_TAB,
                nombre:  'Detalle de comandas',
                archivo: 'ReporteDetalleDeVentas',
                falta:   'Sin el, los tickets del 16% salen sin el detalle de lo que consumieron.'
            }
        ];
    }

    // Cual de los dos es, por el nombre del archivo.
    //
    // El nombre es el camino corto y el bueno: cuando el export llega como sale del
    // POS ya dice lo que es, y con eso la revision se pregunta contra la pestana
    // correcta —asi el de comandas se valida como comandas en vez de volver marcado
    // como "de otra pestana"—.
    //
    // Se compara sobre la raiz y sin puntuacion: la fecha que el POS pega detras, un
    // «(1)» de descarga repetida o los guiones bajos de quien lo guardo a mano no
    // deberian romper el reconocimiento.
    //
    // Devuelve null cuando el nombre no dice nada, y entonces manda el contenido:
    // renombrar un archivo es demasiado facil como para fiarse solo de esto.
    slotDelNombre(fileName) {
        const raiz = (txt) => String(txt || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const name = raiz(fileName);

        return this.uploadSlots().find((s) => name.indexOf(raiz(s.archivo)) === 0) || null;
    }

    // El archivo se elige con el input escondido de la zona de arrastre, y tambien
    // arrastrandolo encima: las dos formas terminan aqui. Se aceptan varios de una
    // vez, y el mismo archivo no se apunta dos veces.
    //
    // La extension se comprueba aqui y no al revisar: el <input> ya filtra por ella
    // pero el arrastre no, y por ahi entra cualquier cosa. Mandarla al servidor solo
    // cambiaria "esto no es un Excel" por "no se pudo leer el archivo".
    onPickFile(files) {
        const nuevos = Array.from(files || []);

        if (!nuevos.length) return;

        if (nuevos.some((f) => !/\.xlsx?$/i.test(f.name))) {
            return this.alertBox({
                theme: FACTURE_THEME,
                type:  'message',
                title: 'Solo se pueden subir archivos de Excel (.xlsx o .xls)'
            });
        }

        nuevos.forEach((file) => {
            const repetido = this.uploadFiles.some((f) => f.name === file.name && f.size === file.size);

            if (!repetido && this.uploadFiles.length < this.uploadSlots().length) this.uploadFiles.push(file);
        });

        this.renderUploadList();
    }

    removeFile(indice) {
        this.uploadFiles.splice(indice, 1);
        this.renderUploadList();
    }

    clearPickedFile() {
        this.uploadFiles = [];
        this.renderUploadList();
    }

    // La lista de lo elegido y lo que falta. Mientras no este el reporte de ventas
    // no se puede subir nada: es el que trae el dia.
    renderUploadList() {
        const lleno = this.uploadFiles.length >= this.uploadSlots().length;

        // Lo que el nombre de cada archivo ya dice: con eso la lista se nombra sola
        // y el aviso de abajo puede decir cual de los dos falta en vez de suponerlo.
        const puestos = this.uploadFiles.map((f) => this.slotDelNombre(f.name));

        // Volver a tocar los archivos devuelve el pie a lo que hace este paso: si el
        // intento anterior dejo el boton en "Cargar Julio...", ese mes ya no tiene
        // que ver con lo que ahora hay elegido. Y la seleccion de meses se olvida:
        // era la de otro archivo.
        this.mesesElegidos     = null;
        this.repartoConfirmado = false;
        this.revisadosPrevios  = null;

        this.setUploadAction('Subir ventas', () => this.sendUpload());

        ticketsView.growUploadBox(false);

        ticketsView.renderPickedFiles(
            this.uploadFiles.map((f, i) => ({
                nombre: f.name,
                peso:   this.fileSizeText(f.size),
                slot:   (puestos[i] || {}).nombre || ''
            })),
            lleno
        );

        ticketsView.renderUploadHint(this.uploadFiles.length, this.uploadSlots(), puestos.filter(Boolean));

        this.lockUploadOk(this.uploadFiles.length === 0);
    }

    fileSizeText(bytes) {
        if (bytes < 1024)    return bytes + ' B';
        if (bytes < 1048576) return Math.round(bytes / 1024) + ' KB';

        return (bytes / 1048576).toFixed(1) + ' MB';
    }

    lockUploadOk(bloquear) {
        if (!this.uploadModal) return;

        this.uploadModal.footer.find('button').last()
            .prop('disabled', bloquear)
            .toggleClass('opacity-50 cursor-not-allowed', bloquear);
    }

    uploadPeriod() {
        return {
            mes:  $('#fUpMes').val(),
            anio: $('#fUpAnio').val()
        };
    }

    // Revisar y cargar, en ese orden y con una sola espera de cara al usuario.
    //
    // Cada archivo se revisa por separado —inspectFile lee su libro SIN guardar
    // nada— y de ahi sale a que pestana pertenece. Si alguno no es de este modulo,
    // o si el mes no admite cargas, se dice antes de tocar la base.
    //
    // La revision se pregunta contra lo que dice el NOMBRE del archivo, no siempre
    // contra el reporte de ventas: asi el servidor compara las columnas del de
    // comandas con las de comandas y objeta lo que de verdad este mal, en vez de
    // devolverlo entero por no ser el otro.
    //
    // Los dos se suben en el mismo orden en que el importador los necesita: primero
    // las ventas, que son las que crean los folios, y despues las comandas, que se
    // cuelgan de ellos.
    async sendUpload() {
        if (!this.uploadFiles.length) return;

        const periodo = this.uploadPeriod();

        if (!periodo.mes || !periodo.anio) {
            return this.alertBox({ theme: FACTURE_THEME, type: 'message', title: 'Indica el mes y el año de estas ventas' });
        }

        this.lockUploadOk(true);

        // Al volver de la pantalla de meses la revision ya esta hecha y los archivos
        // son los mismos: se reusa en vez de leerlos otra vez.
        const revisados = (this.repartoConfirmado && this.revisadosPrevios) || [];

        for (const file of (revisados.length ? [] : this.uploadFiles)) {
            ticketsView.renderUploadStep(`Revisando ${file.name}...`);

            const porNombre = this.slotDelNombre(file.name);
            const revision  = await this.postFile('inspectFile', periodo, (porNombre || {}).tipo || UPLOAD_TAB, file);

            if (revision.status !== 200) {
                ticketsView.renderUploadError(revision.message || `No se pudo leer ${file.name}`);
                this.lockUploadOk(false);
                return;
            }

            // La ultima palabra la tiene el CONTENIDO: el nombre solo dice contra que
            // pestana preguntar, y renombrar un archivo no lo convierte en otro.
            const destino = revision.destino || UPLOAD_TAB;
            const slot    = this.uploadSlots().find((x) => x.tipo === destino);

            // Al archivo que llega sin su nombre de origen se le pregunta desde el
            // reporte de ventas, asi que si era el de comandas vuelve marcado como
            // "de otra pestana". Eso no es un rechazo: el modal pide justamente los
            // dos archivos del dia, y ese aviso es el que dice cual de los dos es. Es
            // lo que en Importacion hace `movido`, donde el archivo se lleva a la
            // pestana a la que pertenece en vez de devolverlo.
            //
            // Se rebota solo cuando ese destino no es de este modulo —las hojas
            // bancarias, las propinas—: eso se sube desde Importacion.
            const mudado = UploadCheck.mueve(revision.validacion) && !!slot;

            if (revision.validacion && !mudado) {
                return this.rejectUpload(revision.validacion, file.name, destino);
            }

            if (!slot) {
                ticketsView.renderUploadError(`${file.name} no es el reporte de ventas ni el de comandas: subelo desde Importacion.`);
                this.lockUploadOk(false);
                return;
            }

            if (revisados.some((r) => r.destino === destino)) {
                ticketsView.renderUploadError(`Elegiste dos veces el ${slot.nombre.toLowerCase()}: falta el otro archivo.`);
                this.lockUploadOk(false);
                return;
            }

            revisados.push({ file: file, destino: destino, slot: slot, reparto: revision.reparto || [] });
        }

        // El archivo que abarca varios meses se pregunta SIEMPRE, no solo cuando el
        // filtro no coincide.
        //
        // Antes la lista de meses solo salia con la objecion de periodo, asi que
        // poder elegir dependia de que el filtro estuviera en un mes ajeno: con el
        // filtro ya en Julio, el mismo archivo de julio y agosto entraba entero y en
        // silencio. La eleccion no tiene que ver con el filtro, sino con que el
        // archivo trae mas de un mes.
        //
        // Solo se pregunta una vez: al confirmar se vuelve a entrar aqui con la
        // seleccion hecha y la carga sigue de largo.
        const conVariosMeses = revisados.find((r) => this.mesesDelReparto(r.reparto).length > 1);

        if (conVariosMeses && !this.repartoConfirmado) {
            // La revision se guarda para no repetirla al confirmar: leer las fechas
            // del archivo de comandas cuesta segundos, y volver a hacerlo para
            // enterarse de lo mismo seria hacer esperar por nada.
            this.revisadosPrevios = revisados;

            ticketsView.renderRepartoPrevio(conVariosMeses);
            this.syncSeleccion({ reparto: conVariosMeses.reparto });

            return;
        }

        this.repartoConfirmado = false;
        this.revisadosPrevios  = null;

        // Las ventas primero: las comandas se cuelgan de sus folios.
        revisados.sort((a, b) => (a.destino === UPLOAD_TAB ? -1 : 1));

        const cargas = [];

        for (const item of revisados) {
            ticketsView.renderUploadStep(`Guardando ${item.slot.nombre.toLowerCase()}...`);

            // El detalle de comandas son megas de renglones y su carga tarda
            // minutos. Mientras el servidor trabaja se le pregunta cuanto lleva
            // escrito, para que la espera muestre lo que ya entro y no un giro.
            await this.watchProgress(item);

            const carga = await this.postFile('uploadFile', periodo, item.destino, item.file);

            this.stopProgress();

            if (carga.status !== 200) {
                if (carga.validacion) return this.rejectUpload(carga.validacion, item.file.name, item.destino);

                ticketsView.renderUploadError(carga.message || `No se pudo procesar ${item.file.name}`);
                this.lockUploadOk(false);
                return;
            }

            cargas.push({ slot: item.slot, data: carga });
        }

        ticketsView.renderUploadDone(cargas);

        // El dia se relee con lo que acaba de entrar: puede haber ganado ventas, y
        // el listado abierto seguiria mostrando las de antes.
        await tickets.lsTickets();

        this.setUploadAction('Listo', () => this.uploadModal.close());

        this.lockUploadOk(false);
    }

    // El archivo que no entro, con su detalle en el modal.
    //
    // El de otro mes es el unico que tiene salida: se ofrece moverlo al mes que de
    // verdad contiene, y si se acepta la carga se reintenta entera contra ese
    // periodo. Los demas motivos solo se pueden corregir en el archivo.
    //
    // La oferta va en el pie del modal y no en un dialogo aparte: el aviso —con los
    // dos periodos enfrentados y los dias del archivo— ya esta en pantalla, y un
    // cuadro encima repetiria lo que el usuario acaba de leer para taparselo.
    rejectUpload(v, fileName, destino) {
        ticketsView.renderUploadRejected(v, fileName, destino);
        this.lockUploadOk(false);

        if (!UploadCheck.mudaPeriodo(v)) return;

        this.syncSeleccion(v);
    }

    // Los meses del reparto que de verdad traen movimientos. El mes en cero esta en
    // la lista para explicar por que el archivo no es de el, pero no es un mes que
    // se pueda cargar ni que cuente para decidir si hay algo que elegir.
    mesesDelReparto(reparto) {
        return (reparto || []).filter((m) => m.movimientos > 0);
    }

    // Confirma la seleccion y sigue con la carga. El flag evita volver a preguntar
    // en la vuelta siguiente, que entra por el mismo sitio.
    confirmarReparto() {
        if (!(this.mesesElegidos || []).length) return;

        this.repartoConfirmado = true;

        return this.sendUpload();
    }

    // El pie dice lo que va a entrar segun lo marcado, y se apaga cuando no queda
    // ningun mes: sin meses no hay carga que hacer.
    syncSeleccion(v) {
        const elegidos = UploadCheck.mesesMarcados('#uploadModalState');

        $('#uploadModalState .chk-mes').each(function () {
            $(this).closest('tr').toggleClass('chk-off', !this.checked);
        });

        this.mesesElegidos = elegidos;

        // De donde viene la pantalla decide que hace el boton: si hubo objecion de
        // periodo hay que mover el filtro antes de cargar; si no, el filtro ya esta
        // bien y solo falta confirmar lo marcado.
        const accion = UploadCheck.mudaPeriodo(v)
            ? () => this.moveSeleccion()
            : () => this.confirmarReparto();

        this.setUploadAction(UploadCheck.accionMover(v, elegidos), accion);
        this.lockUploadOk(elegidos.length === 0);
    }

    // Carga con lo que quedo marcado. El periodo del filtro se pone en el primero de
    // los meses elegidos: tiene que ser uno de ellos, o la revision volveria a
    // objetar por un mes que el usuario acaba de dejar fuera.
    moveSeleccion() {
        const elegidos = this.mesesElegidos || [];

        if (!elegidos.length) return;

        // La seleccion ya se hizo AQUI, en el aviso del periodo. Mover el filtro
        // relanza la carga y la revision vuelve a pasar —el periodo cambio y hay que
        // rehacerla—, pero preguntar otra vez cuales meses seria pedir dos veces lo
        // mismo: con el filtro ya en Agosto el archivo deja de objetarse y caia
        // directo en la pantalla de "este archivo trae 2 meses".
        this.repartoConfirmado = true;

        const primero = elegidos[0].split('-');

        return this.movePeriodTo(Number(primero[1]), Number(primero[0]));
    }

    // Reintento en el mes que manda del archivo, que es lo que ofrece el pie.
    movePeriod(v) {
        return this.movePeriodTo(v.mesArchivo, v.anioArchivo);
    }

    // Reintento en un mes concreto: el que manda o el que el usuario eligio de los
    // botones del aviso.
    movePeriodTo(mes, anio) {
        if (!this.setUploadPeriod(mes, anio)) {
            return ticketsView.renderUploadError(
                `El año ${anio} no esta en la lista del modal: esa carga se hace desde Importacion.`
            );
        }

        this.setUploadAction('Subir ventas', () => this.sendUpload());

        return this.sendUpload();
    }

    // Que hace el boton principal del modal. Cambia con el paso: subir mientras se
    // eligen los archivos, mover cuando el aviso ofrece otro mes y cerrar cuando la
    // carga termino (renderUploadDone).
    setUploadAction(texto, accion) {
        if (!this.uploadModal) return;

        this.uploadModal.footer.find('button').last()
            .text(texto)
            .off('click')
            .on('click', accion);
    }

    // Los selectores del modal se mueven al periodo destino antes de reintentar: la
    // carga sale de ellos, y dejarlos en el mes viejo haria que el siguiente intento
    // volviera a preguntar lo mismo.
    //
    // Devuelve si el periodo quedo puesto de verdad. El año se elige de una lista
    // corta —los tres ultimos ejercicios— y uno que no este ahi dejaria el selector
    // como estaba: sin comprobarlo, el reintento repetiria el mismo aviso para
    // siempre.
    setUploadPeriod(mes, anio) {
        $('#fUpMes').val(String(mes));
        $('#fUpAnio').val(String(anio));

        return $('#fUpMes').val() === String(mes) && $('#fUpAnio').val() === String(anio);
    }

    // -- Cuanto lleva guardado --

    // Arranca la vigilancia de la carga que esta por lanzarse.
    //
    // Primero se apunta el ultimo lote que existe AHORA: lo que aparezca despues de
    // ese id es de esta carga y de ninguna otra. Sin esa marca, un archivo que ya se
    // habia subido antes contaria sus lotes viejos y la barra saldria llena de
    // entrada.
    async watchProgress(item) {
        this.stopProgress();

        const arranque = await useFetch({ url: apiCargas, data: { opc: 'ultimoLoteId' } });

        this.progressFrom = Number(arranque) || 0;

        // El reloj del avance no arranca aqui sino en la primera lectura con filas: lo
        // que pasa antes es la subida del archivo, que no escribe una sola fila y
        // falsearia el ritmo hacia abajo.
        this.progressBase = null;

        // La primera consulta no espera la vuelta del reloj. El reporte de ventas son
        // mil filas y se escribe en menos de lo que tardaba un tick: la barra aparecia
        // una sola vez, ya casi llena, y se leia como un salto.
        this.progressTimer = setInterval(() => this.askProgress(item), 1200);

        this.askProgress(item);
    }

    stopProgress() {
        if (!this.progressTimer) return;

        clearInterval(this.progressTimer);
        this.progressTimer = null;
    }

    // Una vuelta de la consulta. Se pinta solo si trajo filas: hasta que el
    // importador abre su primer lote no hay nada que contar, y un cero parpadeando
    // se leeria como que la carga no arranco.
    async askProgress(item) {
        const avance = await useFetch({
            url:  apiCargas,
            data: {
                opc:      'uploadProgress',
                fileName: item.file.name,
                desdeId:  this.progressFrom
            }
        });

        if (!this.progressTimer || !avance || !avance.filas) return;

        ticketsView.renderUploadProgress(item.slot.nombre, this.conRitmo(avance));
    }

    // El avance con lo que se puede deducir de el: cuanto lleva hecho y cuanto
    // queda por delante.
    //
    // El tiempo sale del ritmo MEDIDO entre la primera lectura con filas y esta, no
    // de una tabla de tamanos: cada archivo y cada servidor van a lo suyo. Hasta
    // tener dos lecturas no hay ritmo que medir y no se dice nada, porque un numero
    // inventado en el primer segundo es peor que ninguno.
    conRitmo(avance) {
        const total = Number(avance.total) || 0;
        const filas = Number(avance.filas) || 0;

        // El tope era 99 para no cantar un final que aun no llega, pero con las filas
        // ya escritas eso deja la barra clavada en un numero que no avanza. Llega a
        // 100 y lo que sigue lo dice el texto: lo que queda no son filas.
        avance.pct = total > 0 ? Math.min(100, Math.round(filas * 100 / total)) : 0;

        if (!this.progressBase) {
            this.progressBase = { t: Date.now(), filas: filas };

            return avance;
        }

        const seg     = (Date.now() - this.progressBase.t) / 1000;
        const escritas = filas - this.progressBase.filas;

        if (seg < 1 || escritas <= 0 || total <= filas) return avance;

        avance.restante = Math.round((total - filas) / (escritas / seg));

        return avance;
    }

    // useFetch manda urlencoded y no admite archivos: la subida necesita FormData,
    // con los mismos campos que el modulo Cargas.
    postFile(opc, periodo, tipo, file) {
        const formData = new FormData();

        formData.append('opc',         opc);
        formData.append('tipo',        tipo || UPLOAD_TAB);
        formData.append('mes',         periodo.mes);
        formData.append('anio',        periodo.anio);
        formData.append('excel_file0', file);

        // Los meses que el usuario dejo marcados en el aviso. Sin esto entra el
        // archivo completo, que es el caso normal: la lista solo viaja cuando de
        // verdad se descarto algun mes.
        const elegidos = this.mesesElegidos || [];

        if (opc === 'uploadFile' && elegidos.length) formData.append('meses', elegidos.join(','));

        return fetch(apiCargas, { method: 'POST', body: formData })
            .then(r => r.json())
            .catch(() => ({ status: 500, message: 'No se pudo leer el archivo' }));
    }

    // El boton nace vacio: opc:'button' pinta su icono como clase CSS y aqui los
    // iconos son Lucide, que se monta por atributo.
    decorateMetaButton() {
        $('#btnMetaConfig')
            .empty()
            .append($('<i>', { 'data-lucide': 'settings', class: 'w-4 h-4' }));

        if (window.lucide) lucide.createIcons();

        this.syncMetaButton();
    }

    // Sin etiqueta el boton no puede rotular la meta, asi que la dice al pasar por
    // encima, y en la unidad con la que se capturo: un porcentaje se mueve con la
    // venta y una cantidad no, y esa diferencia importa a media jornada. En pantalla
    // el monto sigue estando en la tarjeta del objetivo al 16%.
    syncMetaButton() {
        const valor = this.meta.modo === 'monto'
            ? (this.dataKpis.objetivoTexto || this.moneyText(this.meta.valor))
            : `${this.pctText(this.meta.valor)}%`;

        $('#btnMetaConfig').attr('title', `Distribucion IVA 16% / IVA 0% · al 16%: ${valor}`);
    }

    // Gemelos de money() y pctTexto() del controlador, para el reparto que el modal
    // muestra antes de mandarlo. Todo lo demas llega escrito del servidor.
    moneyText(n) {
        return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    pctText(pct) {
        return String(Math.round((Number(pct) || 0) * 10) / 10);
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }


    // Que se hizo con los cargos que cambiaron de folio. Va en un globo colgado del
    // propio aviso del pie, no en un cuadro en medio de la pantalla: es el detalle
    // de esa linea y no interrumpe nada. Se arma con lo que ya vino en el listado,
    // asi que no pide nada al servidor.
    avisoMudados() {
        if (!(this.dataMudados || []).length) return;

        ticketsView.toggleMudadosToast(this.dataMudados);
    }

    // -- Vista previa del cierre (punto 20) --

    // Lo que se va a escribir, antes de escribirlo. El modal se abre una sola vez:
    // Regenerar vuelve a pedir la propuesta y solo repinta el cuerpo, porque cerrar
    // y volver a abrir haria parpadear la pantalla en cada intento.
    openPreviewModal(data) {
        if (this.previewModal) return ticketsView.renderPreviewDay(data);

        this.previewModal = this.cfModal({
            title:         'Vista previa del reparto',
            size:          'default',
            theme:         FACTURE_THEME,
            okLabel:       'Confirmar',
            cancelLabel:   'Cancelar',
            // Sin cierre por clic fuera: el modal es el unico punto del modulo
            // donde se autoriza escribir el dia, y salir de el por accidente
            // dejaria al usuario sin saber si el cierre corrio.
            backdropClose: false,
            onOk:          () => this.confirmPreview(),
            onClose:       () => { this.previewModal = null; }
        });

        this.previewModal.body.append($('<div>', { id: 'previewDayBody' }));

        this.decoratePreviewFooter();

        ticketsView.renderPreviewDay(data);
    }

    // Tres salidas y no dos. Regenerar se mete entre Cancelar y Confirmar porque es
    // lo que se hace ANTES de aceptar: la barra se lee de izquierda a derecha en el
    // orden en que se usa.
    //
    // Confirmar va en verde y no en el azul que pone cfModal: el azul de la terminal
    // es el de las acciones del dia —generar, imprimir— y este boton es el unico del
    // modulo que escribe el cierre completo. Es el mismo verde con el que el modulo
    // marca lo ya facturado.
    decoratePreviewFooter() {
        const ok = this.previewModal.footer.find('button').last();

        ok.removeClass('bg-[#1C64F2] hover:bg-[#1a53d4]')
          .addClass('bg-[#047857] hover:bg-[#036B4A] text-white');

        const regenerar = $('<button>', {
            type:  'button',
            text:  'Regenerar',
            class: 'rounded-lg text-sm font-medium px-4 py-2 ' + (FACTURE_THEME_IS_LIGHT
                ? 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                : 'bg-[#1a2332] text-[#9CA3AF] border border-[#374151] hover:bg-[#283341] hover:text-white')
        });

        regenerar.on('click', () => tickets.regenerate());

        ok.before(regenerar);
    }

    // Mientras la propuesta viaja no hay nada que confirmar ni que regenerar. Se
    // apaga el pie entero y no un boton: los tres actuan sobre una propuesta que en
    // ese momento ya no es la que se esta viendo.
    lockPreview(bloquear) {
        if (!this.previewModal) return;

        this.previewModal.footer.find('button')
            .prop('disabled', bloquear)
            .toggleClass('opacity-50 cursor-not-allowed', bloquear);
    }

    // El modal se va antes de que arranque el cierre: lo que sigue es el resumen del
    // reparto, y dos capas encimadas taparian justo lo que se acaba de autorizar. Si
    // el cierre falla, su aviso lo dice y la propuesta se puede volver a abrir.
    confirmPreview() {
        this.previewModal.close();

        tickets.generateDay();
    }

    // -- Facade --

    // El papel se pide al servidor: si el ticket ya se genero llegan los renglones
    // guardados y si no, la propuesta con la que se armaria.
    async selectTicket(folio) {
        this.selectedId = folio;
        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');

        if (!folio) return ticketsView.renderPreview(null);

        $(`#tb${this.PROJECT_NAME} [data-folio="${folio}"]`).closest('tr').addClass('row-active');

        const data = await useFetch({ url: apiTickets, data: { opc: 'getTicket', folio: folio } });

        if (data.status !== 200) {
            ticketsView.renderPreview(null, data.message);
            return;
        }

        ticketsView.renderPreview(data.ticket);
    }
}

class Tickets extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'tickets';
        this.generating   = false;
        // Con que combinacion de productos se arman los papeles inventados. Cada
        // Regenerar de la vista previa la mueve un numero, y el confirmar manda la
        // que el usuario acepto. El 0 es la de siempre.
        this.semilla      = 0;
    }

    // Una corrida de tickets a la vez.
    //
    // Generar el dia son decenas de papeles y la peticion tarda segundos sin avisar
    // nada en pantalla, asi que el segundo clic entra cuando el primero todavia no
    // guarda: las dos peticiones leen "esta venta no tiene ticket" y las dos se lo
    // arman. La base no lo impide —virtual_ticket.sale_id no es UNIQUE— y el mismo
    // cobro termina con dos notas.
    //
    // El candado va en el metodo y no en el boton porque las tres formas de generar
    // (el dia, los del 0% y el ticket seleccionado) escriben en la misma tabla. Los
    // botones se apagan de paso, para que se vea que la corrida ya arranco.
    async runLocked(task) {
        if (this.generating) return;

        this.generating = true;

        const botones = $('#btnGenerarTodos, #btnRehacer')
            .prop('disabled', true)
            .addClass('opacity-60 cursor-not-allowed');

        try {
            await task();
        } finally {
            this.generating = false;
            botones.prop('disabled', false).removeClass('opacity-60 cursor-not-allowed');
        }
    }

    // Tabla de tickets
    async lsTickets() {
        const data = await useFetch({ url: apiTickets, data: Object.assign({ opc: 'lsTickets' }, app.getFilters()) });

        // Un dia sin ventas no es una tabla vacia: es una pantalla que tiene que
        // decir que falta y por donde se arregla. Y si el servidor no contesta, el
        // vacio lo dice en vez de dejar el listado en blanco como si el dia no
        // hubiera tenido nada.
        if (!data || !(data.row || []).length) return ticketsView.renderEmptyDay(data);

        this.createCoffeeTable3({
            parent:       'tableWrap',
            id:           `tb${this.PROJECT_NAME}`,
            theme:        FACTURE_THEME,
            center:       [1, 2, 3, 4],
            right:        [5],
            actionsAlign: 'right',
            extends:      true,
            scrollable:   false,
            hover:        true,
            f_size:       11,
            data:         data
        });

        if (window.lucide) lucide.createIcons();

        this.dataTable(`#tb${this.PROJECT_NAME}`, data);

        const counts = data.counts || { facturados: 0, cero: 0, generados: 0, mostrados: 0, servicio: 0 };

        app.dataKpis = data.kpis || {};

        app.dataMudados = data.mudados || [];

        $('#statsRow').show();

        ticketsView.renderStats(app.dataKpis, counts);
        ticketsView.renderCutNote(data.corte);
        ticketsView.renderMudadosLink(app.dataMudados);
        app.syncActionButtons(counts);
        app.syncMetaButton();

        // El pie nombra las dos poblaciones del listado. Sin la segunda cifra, un
        // dia con veinte tickets en $0.00 se lee como un dia sin ventas.
        const servicio = counts.servicio || 0;
        const aparte   = servicio > 0 ? `, ${servicio} de servicio de mesa` : '';

        app.updateFooterInfo(`Mostrando ${counts.mostrados} ticket${counts.mostrados !== 1 ? 's' : ''} del dia${aparte}`);
    }

    // Paginado, buscador y ordenamiento de la tabla ya pintada. Sin filas
    // createCoffeeTable3 no arma un <table> sino el aviso de vacio, asi que montar
    // DataTables ahi dejaria la paginacion colgando debajo del mensaje.
    dataTable(id, data) {
        if (!(data.row || []).length) return;

        if (typeof simple_data_table === 'function') simple_data_table(id, 100);
    }

    // -- Actions --

    // El paso previo a escribir el dia (punto 20): se pide la propuesta —el mismo
    // reparto, sin guardar nada— y se enseña. El cierre cuelga del Confirmar del
    // modal, no de este metodo.
    //
    // La semilla es el argumento: entrar por el boton la reinicia en 0, y Regenerar
    // vuelve a entrar aqui con la siguiente. Es lo unico que cambia entre una
    // propuesta y otra del mismo dia.
    async previewDay(semilla = 0) {
        this.semilla = semilla;

        app.lockPreview(true);

        const data = await useFetch({
            url:  apiTickets,
            data: Object.assign({ opc: 'previewDay', semilla: this.semilla }, app.getFilters())
        });

        app.lockPreview(false);

        // Lo que detiene el cierre detiene la propuesta, y con el mismo mensaje: sin
        // catalogo puente, sin ventas o con el reparto sin cuadrar no hay nada que
        // enseñar.
        if (data.status !== 200) {
            this.alertBox({ theme: FACTURE_THEME, type: 'error', title: data.message, timer: 0 });
            return;
        }

        app.openPreviewModal(data);
    }

    // Otra combinacion de productos para la misma propuesta. No vuelve a repartir el
    // dia —la tasa de cada venta y su monto no dependen del catalogo—: solo cambia
    // con que renglones se arma el papel de cada una.
    regenerate() {
        this.previewDay(this.semilla + 1);
    }

    // El cierre del dia: el servidor decide que se factura al 16% y que se manda al
    // 0%, y arma el papel que a cada grupo le falte —el del cero siempre, el del 16%
    // solo cuando la venta llego sin su comanda—. No imprime nada; el papel sale con
    // el otro boton, que aparece justo cuando esto termina.
    //
    // Ya no se llama desde la barra: el boton abre la vista previa y esto corre
    // cuando el usuario confirma lo que vio. La semilla viaja con la peticion para
    // que se guarde exactamente la combinacion que se aprobo.
    async generateDay() {
        await this.runLocked(async () => {
            const response = await useFetch({
                url:  apiTickets,
                data: Object.assign({ opc: 'generateDay', semilla: this.semilla }, app.getFilters())
            });

            if (response.status !== 200) {
                this.alertBox({ theme: FACTURE_THEME, type: 'error', title: response.message, timer: 0 });
                return;
            }

            await this.lsTickets();

            ticketsView.renderResumenReparto(response);
        });
    }

    // Las dos maneras de deshacer un dia ya cerrado, en la misma pregunta: rehacerlo
    // o eliminarlo. Salen juntas porque parten del mismo estado —el dia repartido— y
    // el usuario decide entre ellas, no entre dos botones separados de la barra.
    //
    // El texto dice lo que hace cada una porque no son reversibles: rehacer REEMPLAZA
    // el reparto anterior (un ticket que estaba al 0% puede pasar al 16% y soltar su
    // papel) y eliminar no deja nada en su lugar.
    redoDay() {
        this.swalQuestion({
            extends: true,
            opts: {
                title:             'Rehacer el reparto del dia',
                text:              'Rehacer vuelve a repartir la venta del dia entre IVA 16% e IVA 0% y reemplaza los tickets ya generados; las notas no cambian. Solo eliminar borra los tickets del dia y la corrida que los genero, y deja el dia sin repartir.',
                icon:              'question',
                showDenyButton:    true,
                confirmButtonText: 'Si, rehacer',
                denyButtonText:    'Solo eliminar',
                cancelButtonText:  'No'
            }
        }).then((result) => {
            // Rehacer tambien escribe el dia, asi que tambien pasa por la vista
            // previa: la pregunta de arriba decide entre rehacer y eliminar, no
            // autoriza el reparto que va a quedar.
            if (result.isConfirmed)   this.previewDay();
            else if (result.isDenied) this.deleteDay();
        });
    }

    // Deshacer el reparto del dia. El panel se vacia junto con la tabla: el papel que
    // estuviera abierto es de un ticket que acaba de dejar de existir.
    async deleteDay() {
        await this.runLocked(async () => {
            const response = await useFetch({ url: apiTickets, data: Object.assign({ opc: 'deleteDay' }, app.getFilters()) });

            if (response.status === 200) {
                app.selectedId = null;
                ticketsView.renderPreview(null);

                await this.lsTickets();
            }

            this.alertBox({
                theme: FACTURE_THEME,
                type:  response.status === 200 ? 'success' : 'error',
                title: response.message,
                timer: response.status === 200 ? 1800 : 0
            });
        });
    }

    // La hoja del dia: se piden los papeles ya armados, se pintan en el contenedor
    // que solo existe para imprimir y se abre el dialogo del navegador. El PDF lo
    // guarda el usuario desde ahi.
    async printSheet() {
        const data = await useFetch({ url: apiTickets, data: Object.assign({ opc: 'showPrintSheet' }, app.getFilters()) });

        if (data.status !== 200) {
            this.alertBox({ type: 'error', title: data.message, timer: 0 });
            return;
        }

        ticketsView.renderPrintSheet(data.tickets, data.emisor);

        // La clase le dice al @media print cual de los dos trabajos es: la hoja
        // del dia o el ticket del panel. Se quita al cerrar el dialogo para que la
        // siguiente impresion vuelva a ser la del ticket seleccionado.
        $('body').addClass('printing-sheet');
        window.print();
        $('body').removeClass('printing-sheet');
    }

    // Los del 0% son el trabajo del cierre: sin IVA trasladado el ticket del POS no
    // sirve para facturar, asi que se les arma su ticket virtual de una pasada.
    generateAllZero() {
        this.swalQuestion({
            extends: true,
            opts: {
                title:             'Generar tickets virtuales',
                text:              'Se generaran los tickets virtuales del dia que van al 0% y aun no tienen uno.',
                icon:              'question',
                confirmButtonText: 'Si, generar',
                cancelButtonText:  'No'
            }
        }).then(async (result) => {
            if (!result.isConfirmed) return;

            await this.runLocked(async () => {
                const response = await useFetch({ url: apiTickets, data: Object.assign({ opc: 'generateAllZero' }, app.getFilters()) });

                this.afterGenerate(response, response.folio);
            });
        });
    }

    // Genera (o vuelve a generar) el ticket seleccionado. Regenerar conserva su
    // numero de nota: ya se entrego y no puede cambiar.
    async generate() {
        if (!app.selectedId) {
            this.alertBox({ type: 'message', title: 'Selecciona un ticket de la lista' });
            return;
        }

        await this.runLocked(async () => {
            const response = await useFetch({ url: apiTickets, data: { opc: 'generate', folio: app.selectedId } });

            this.afterGenerate(response, app.selectedId);
        });
    }

    afterGenerate(response, folio) {
        if (response.status === 200) {
            this.lsTickets();
            if (folio) app.selectTicket(folio);
        }

        this.alertBox({
            type:  response.status === 200 ? 'success' : 'error',
            title: response.message,
            timer: response.status === 200 ? 1800 : 0
        });
    }

    printTicket() {
        if (!app.selectedId) {
            this.alertBox({ type: 'message', title: 'Selecciona un ticket de la lista' });
            return;
        }
        window.print();
    }

    // El ojo apagado del dia sin repartir. Ya no es uno solo para todas las filas:
    // las que traen su comanda cargada si abren, asi que el aviso tiene que decir
    // que le falta a ESTA para poder verse. El motivo lo manda el servidor con la
    // fila, que es quien sabe por que la apago.
    pendingNotice(motivo) {
        const titulo = {
            'sin-comanda':     'Esta venta llego sin su comanda: su papel se arma al generar los tickets del dia',
            'comanda-parcial': 'El folio ampara solo parte de la cuenta: su papel se arma al generar los tickets del dia'
        }[motivo] || 'Su papel se arma al generar los tickets del dia';

        this.alertBox({
            theme: FACTURE_THEME,
            type:  'message',
            title: titulo
        });
    }

    async lockedNotice(folio) {
        const data = await useFetch({ url: apiTickets, data: { opc: 'getTicket', folio: folio } });

        if (data.status !== 200) return;

        this.alertBox({ type: 'message', title: `El ticket ya esta facturado con el folio ${data.ticket.factura}` });
    }
}

// Vista lateral del ticket seleccionado.
class TicketsView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'tickets';
    }

    // -- Render helpers --

    // El pie: a la izquierda lo que se esta viendo, a la derecha la puerta al manual
    // del reparto. Las cinco leyendas de color que vivian aqui repetian lo que ya
    // dice el badge de la columna Estado, fila por fila.
    renderFooter() {
        const info = $('<div>', { class: 'flex items-center gap-3 min-w-0 text-[10px] text-gray-400' });

        info.append($('<span>', { id: 'viewFooter_info' }));
        info.append($('<span>', { id: 'viewFooter_cut' }));

        // El dia con cargos cambiados de folio lo dice aqui y no fila por fila: es
        // un hecho del dia, no de una venta, y asi la tabla se queda como esta.
        // Nace escondido porque la mayoria de los dias no hay ninguno.
        const mudados = $('<button>', {
            type:  'button',
            id:    'btnMudados',
            class: 'ws-help flex-shrink-0',
            css:   { display: 'none' }
        });

        mudados.append($('<span>', { id: 'btnMudados_txt' }));
        mudados.append($('<span>', { text: '›' }));

        mudados.on('click', () => app.avisoMudados());

        // El globo del aviso se cuelga de aqui, para que salga del propio boton.
        const wrap = $('<div>', { id: 'mudadosWrap', class: 'relative flex-shrink-0' });

        wrap.append(mudados);

        $('#viewFooterRow').empty().append(info).append(wrap);
    }

    // El aviso del pie: cuantas cuentas se cobraron con mas de una tarjeta hoy.
    renderMudadosLink(mudados) {
        const n = (mudados || []).length;

        $('#btnMudados').toggle(n > 0);
        $('#btnMudados_txt').text(n === 1 ? '1 cargo cambio de folio' : `${n} cargos cambiaron de folio`);
    }

    // Las lineas del aviso: una por cargo, cada una dicha como se diria en voz alta.
    // Se cortan en tres porque esto es un aviso, no un reporte: con mas movimientos
    // la ultima linea dice cuantos quedan.
    mudadosLineas(mudados) {
        const lineas = (mudados || []).slice(0, 3).map((mov) =>
            `El cargo de ${mov.montoTexto} de la cuenta ${mov.origen} lo factura ahora el folio ${mov.destino}, que se cobro en ${mov.pagoDestino}.`
        );

        const resto = (mudados || []).length - lineas.length;

        if (resto > 0) lineas.push(`Y ${resto} cargo${resto !== 1 ? 's' : ''} mas.`);

        return lineas;
    }

    // El globo del pie. Sale del aviso, se va solo a los seis segundos y se cierra
    // con un toque fuera o volviendo a tocar el aviso.
    toggleMudadosToast(mudados) {
        let toast = $('#mudadosToast');

        if (toast.hasClass('is-on')) return this.hideMudadosToast();

        if (!toast.length) {
            toast = $('<div>', { id: 'mudadosToast', class: 'ws-toast' });
            $('#mudadosWrap').append(toast);
        }

        toast.empty();

        this.mudadosLineas(mudados).forEach((linea, i) => {
            toast.append($('<div>', { class: i ? 'mt-1.5' : '', text: linea }));
        });

        // La caja tiene que estar puesta antes de la clase que la anima; si no, el
        // navegador pinta las dos cosas a la vez y no hay transicion que ver.
        requestAnimationFrame(() => toast.addClass('is-on'));

        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => this.hideMudadosToast(), 6000);

        // El cierre por toque fuera se engancha en el siguiente ciclo: si no, el
        // mismo clic que abrio el globo lo cerraria al llegar al documento.
        setTimeout(() => $(document).one('click.mudados', () => this.hideMudadosToast()), 0);
    }

    hideMudadosToast() {
        clearTimeout(this.toastTimer);

        $(document).off('click.mudados');
        $('#mudadosToast').removeClass('is-on');
    }

    // La linea del corte, que es lo unico del manual que cambia cada dia: sin ella
    // la marca ambar de la tabla es una raya muda. Sin corte previsto no hay nada
    // que explicar —toda la venta cabe en el 16%— y el hueco se queda vacio.
    // -- Pantalla sin datos --

    // El vacio dice las tres cosas que hacen falta: que falta, por que falta y por
    // donde se arregla. La fecha va con todas sus letras porque el dia que se esta
    // mirando es justo lo que hay que cambiar cuando el vacio no era lo esperado.
    //
    // Que el servidor no conteste tambien es un vacio, pero de otro tipo: se dice
    // asi en vez de dejar la pantalla en blanco como si el dia no hubiera tenido
    // ventas, que es lo que pasaba antes.
    renderEmptyDay(data) {
        const fecha = String(app.getFilters().dia || '').split('-').reverse().join('/');

        app.emptyDay();

        EmptyState.render({
            parent: 'tableWrap',
            json: data
                ? {
                    motivo: 'vacio',
                    icon:   'calendar-x',
                    title:  `Sin ventas cargadas el ${fecha}`,
                    text:   'El reporte del punto de venta se sube en Importacion. Cuando entre el de este dia, aqui salen sus tickets y se habilita el reparto.',
                    action: { text: 'Ir a Importacion', icon: 'upload', href: '/app/facture2/cargas.php' }
                }
                : {
                    motivo: 'error',
                    title:  'No se pudo cargar el dia',
                    text:   'El servidor no devolvio el listado. Vuelve a intentarlo; si sigue igual, el detalle queda en el log del modulo.',
                    action: { text: 'Reintentar', icon: 'refresh-cw', onClick: () => tickets.lsTickets() }
                }
        });
    }

    renderCutNote(corte) {
        const texto = corte && corte.hay
            ? `· la linea ambar corta el IVA 16%: ${corte.cuenta16} ventas por ${corte.logradoTexto} de ${corte.objetivoTexto}, y ${corte.cuenta0} al IVA 0% (${corte.monto0Texto})`
            : '';

        $('#viewFooter_cut').text(texto);
    }

    // Las cuatro cifras del dia en un renglon: la venta con tarjeta, las dos tasas
    // en que se reparte y lo que ya quedo facturado. Antes eran cinco tarjetas de
    // infoCard —una banda entera— y las cinco salian de la misma cuenta.
    //
    // El total de tarjeta abre la fila y va un cuerpo mas grande: es el unico monto
    // que el modulo procesa y de el salen los dos objetivos. Los montos llegan
    // escritos del servidor; aqui solo se arma el rotulo que los acompana.
    //
    // Los tamanos y los colores viven en wansoft-theme.css (TRM-007): el JS pone
    // .ws-stat y sus variantes.
    renderStats(k, counts) {
        const pctCero = k.metaCeroPct || 30;

        // Cada cifra ocupa dos renglones —rotulo y monto— y nada mas: el reparto que
        // las relaciona cabe en el propio rotulo. Lo que no cabe ahi (el objetivo del
        // 0% una vez generado, cuantos movimientos suman el total) viaja en el title
        // de la celda, que es donde se consulta un detalle sin pedirle sitio a la
        // pantalla todos los dias.
        //
        // Cuando la meta se fija como cantidad el porcentaje sigue siendo cierto pero
        // ya no es lo que se capturo: el rotulo lo dice para que nadie lea un 44.8%
        // como si alguien lo hubiera elegido asi.
        const rotulo16 = k.metaModo === 'monto'
            ? `IVA 16% · cantidad fija`
            : `IVA 16% · ${k.metaPct || 70}%`;

        const row = $('<div>', { class: 'w-full flex items-center flex-wrap gap-y-2' });

        // El detalle del hero dice de cuantos folios sale la cifra y cuantos se
        // quedaron fuera: el listado muestra el dia completo, pero solo la tarjeta
        // de credito construye este monto.
        const servicio = k.servicio
            ? ` · ${k.servicio} de servicio de mesa, que no facturan`
            : '';

        row.append(this.statCell('Tarjeta de credito', k.totalTexto, 'ws-stat-hero',
            `${k.tickets || 0} folios con cargo a tarjeta${servicio}`));

        row.append(this.statCell(rotulo16, k.objetivoTexto, 'ws-stat-blue',
            `${k.metaPct || 70}% de la venta con tarjeta`));

        // Mientras el dia no tenga reparto corrido se muestra el objetivo del 0%; ya
        // repartido, lo que el reparto armo de verdad.
        row.append(this.statCell(`IVA 0% · ${pctCero}%`,
            k.ceroGenerado ? k.obtenidoCeroTexto : k.objetivoCeroTexto, '',
            k.ceroGenerado ? `generado · objetivo ${k.objetivoCeroTexto}` : `${pctCero}% de la venta con tarjeta`));

        row.append(this.statCell('Ya facturado', k.facturadoTexto, 'ws-stat-ok',
            `${k.facturados || 0} tickets facturados realmente`));

        row.append($('<div>', { class: 'ml-auto' }).append($('<span>', {
            class: `badge-base ${(counts.generados || 0) > 0 ? 'b-blue' : 'b-gray'}`,
            text:  (counts.generados || 0) > 0 ? `${counts.generados} generados` : 'sin repartir'
        })));

        $('#statsRow').empty().append(row);
    }

    statCell(label, value, tone, detalle) {
        const cell = $('<div>', { class: `ws-stat ${tone}`.trim(), title: detalle || '' });

        cell.append($('<div>', { class: 'ws-stat-lbl', text: label }));
        cell.append($('<div>', { class: 'ws-stat-val', text: value || '$0.00' }));

        return cell;
    }

    // El cuadre del modal de distribucion: las dos tasas y su suma contra el Total
    // Tarjeta de Credito. El 0% no se captura, se deriva del 16%, asi que la suma
    // siempre da el total; mostrarla es lo que deja ver que el reparto cuadra antes
    // de aplicarlo.
    //
    // Va con las clases de tema resueltas aqui y no con los tokens del modulo:
    // facture-theme traduce la paleta bajo #mainContainer, y cfModal monta su panel
    // al final del <body>, fuera de ese scope, igual que el popup de SweetAlert.
    renderMetaPreview(p) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const panel = FACTURE_THEME_IS_LIGHT ? 'bg-gray-50 border-gray-200' : 'bg-[#141d2b] border-[#374151]';
        const linea = FACTURE_THEME_IS_LIGHT ? 'border-gray-200' : 'border-[#374151]';
        const valor = FACTURE_THEME_IS_LIGHT ? 'text-gray-900' : 'text-white';
        const label = FACTURE_THEME_IS_LIGHT ? 'text-gray-600' : 'text-gray-400';

        // El punto de color es el mismo par que separa las dos tasas en el resto del
        // modulo: azul la que se factura, ambar la que pide ticket virtual.
        const fila = (color, texto, pct, monto) => `
            <div class="flex items-center justify-between py-1.5">
                <span class="flex items-center gap-2 text-[11px] ${label}">
                    <span class="w-2 h-2 rounded-full" style="background:${color};"></span>
                    ${esc(texto)}
                    <span class="text-[10px] opacity-70">${esc(pct)}%</span>
                </span>
                <span class="text-[12px] font-semibold ${valor}">${esc(monto)}</span>
            </div>
        `;

        // El campo que todavia sigue al otro se dice, para que la cifra se lea como
        // propuesta y no como algo que alguien capturo.
        const sugerido = p.sugerido ? `
            <p class="mt-2 text-[10px] facture-info">El monto al IVA ${esc(p.sugerido)}% es el resto del total. Corrigelo si el acuerdo es otro.</p>
        ` : '';

        // Sin cuadrar no hay reparto: se nombra la diferencia y de que lado esta,
        // que es lo unico con lo que el usuario puede corregir la captura.
        const aviso = p.cuadra ? '' : `
            <p class="mt-2 text-[10px] facture-warn flex items-start gap-1.5">
                <i data-lucide="alert-triangle" class="w-3 h-3 shrink-0 mt-[1px]"></i>
                ${p.sobra ? 'Sobran' : 'Faltan'} ${esc(p.difTexto)} para que las dos tasas sumen el Total Tarjeta de Credito.
            </p>
        `;

        $('#metaModalPreview').html(`
            <div class="mt-4 rounded-lg border ${panel} px-3 py-2">
                <div class="flex items-center justify-between pb-1.5 border-b ${linea}">
                    <span class="text-[11px] ${label}">Total Tarjeta de Credito</span>
                    <span class="text-[12px] font-bold ${valor}">${esc(p.totalTexto)}</span>
                </div>
                ${fila('#1C64F2', 'IVA 16%', p.pct16, p.texto16)}
                ${fila('#F59E0B', 'IVA 0%',  p.pct0,  p.texto0)}
                <div class="flex items-center justify-between pt-1.5 border-t ${linea}">
                    <span class="flex items-center gap-1.5 text-[11px] ${label}">
                        <i data-lucide="${p.cuadra ? 'check' : 'x'}" class="w-3 h-3 ${p.cuadra ? 'text-green-600' : 'text-red-600'}"></i>
                        Suma de las dos tasas
                    </span>
                    <span class="text-[12px] font-semibold ${p.cuadra ? valor : 'text-red-600'}">${esc(p.sumaTexto)}</span>
                </div>
            </div>
            ${sugerido}
            ${aviso}
        `);

        if (window.lucide) lucide.createIcons();
    }

    // La propuesta del dia antes de escribirla (punto 20). Cuatro bloques: lo que
    // se va a repartir, como queda repartido, cuantos papeles salen de ahi y que
    // folios cambian de mano.
    //
    // No lleva la diferencia contra la meta capturada: los tickets no se parten, asi
    // que el que cruza la meta entra completo y esa diferencia SIEMPRE existe.
    // Ponerla delante de quien tiene que autorizar es enseñarle un numero que parece
    // un error. Se sigue diciendo despues, en el resumen del cierre, que es donde ya
    // viene explicada.
    //
    // Va con las clases de tema resueltas aqui y no con los tokens del modulo, por lo
    // mismo que renderMetaPreview: cfModal monta su panel al final del <body>, fuera
    // del scope de facture-theme.
    renderPreviewDay(p) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const linea = FACTURE_THEME_IS_LIGHT ? 'border-gray-200' : 'border-[#374151]';
        const valor = FACTURE_THEME_IS_LIGHT ? 'text-gray-900' : 'text-white';
        const label = FACTURE_THEME_IS_LIGHT ? 'text-gray-600' : 'text-gray-400';

        // El mismo par que separa las dos tasas en el modal de distribucion: azul la
        // que se factura, ambar la que pide ticket virtual.
        const tasa = (color, nombre, tickets, monto) => `
            <div class="flex items-baseline gap-2.5 py-1.5">
                <span class="w-2 h-2 rounded-full shrink-0" style="background:${color};"></span>
                <span class="text-[12px] font-semibold ${valor}">${esc(nombre)}</span>
                <span class="text-[10.5px] ${label}">${esc(tickets)} ticket${Number(tickets) !== 1 ? 's' : ''}</span>
                <span class="ml-auto text-[13px] font-bold ${valor}">${esc(monto)}</span>
            </div>
        `;

        // Los folios que cambian de mano se enseñan uno por uno y no como conteo: es
        // lo unico del cierre que reescribe un dato del POS, y quien confirma tiene
        // que poder reconocer cada folio que va a quedar distinto de su ticket
        // impreso. La banda entera no se pinta cuando el dia no tuvo ninguno.
        const movidos = p.reasignados || [];

        const mudanza = movidos.length ? `
            <div class="mt-3 pt-3 border-t ${linea}">
                <p class="text-[9.5px] font-semibold uppercase tracking-wider ${label}">Folios reasignados</p>
                ${movidos.map(m => `
                    <div class="flex items-baseline gap-2 mt-1.5 text-[12px]">
                        <span class="font-semibold ${valor}">${esc(m.origen)}</span>
                        ${m.destino
                            ? `<span class="${label}">&rsaquo;</span><span class="font-semibold text-[#1C64F2]">${esc(m.destino)}</span>`
                            : `<span class="text-[10.5px] facture-warn">sin folio libre</span>`}
                        <span class="ml-auto ${valor}">${esc(m.montoTexto)}</span>
                    </div>
                `).join('')}
            </div>
        ` : '';

        $('#previewDayBody').html(`
            <p class="text-[11px] ${label}">${esc(p.fechaTexto)} · todavia no se guarda nada</p>

            <div class="mt-3">
                <p class="text-[9.5px] uppercase tracking-wider ${label}">Tarjeta de credito</p>
                <p class="text-[26px] font-bold leading-tight ${valor}">${esc(p.totalTexto)}</p>
                <p class="text-[11px] ${label}">${esc(p.movimientos)} movimientos · ${esc(p.conCargo)} con cargo a tarjeta</p>
            </div>

            <div class="mt-4 pt-3 border-t ${linea}">
                <div class="flex h-2 rounded overflow-hidden">
                    <div style="flex:${esc(p.pct16)};background:#1C64F2;"></div>
                    <div style="flex:${esc(p.pct0)};background:#F59E0B;"></div>
                </div>
                <div class="mt-2">
                    ${tasa('#1C64F2', 'IVA 16%', p.cuenta16, p.monto16Texto)}
                    ${tasa('#F59E0B', 'IVA 0%',  p.cuenta0,  p.monto0Texto)}
                </div>
            </div>

            <div class="mt-3 pt-3 border-t ${linea}">
                <div class="flex items-baseline justify-between">
                    <span class="text-[12.5px] font-bold ${valor}">Tickets del dia</span>
                    <span class="text-[12.5px] font-bold ${valor}">${esc(p.tickets)}</span>
                </div>
                <div class="flex items-baseline justify-between mt-1">
                    <span class="text-[11.5px] ${label}">de $0.00</span>
                    <span class="text-[11.5px] ${label}">${esc(p.cero)}</span>
                </div>
            </div>

            ${mudanza}
        `);
    }

    // El corte que se muestra al terminar el reparto. Todos los montos llegan
    // escritos del servidor; aqui solo se acomodan en dos columnas.
    //
    // Los renglones van con <span class="block"> y no con <div>: alertBox mete este
    // html dentro de un <p>, y un <div> ahi adentro lo parte en dos.
    renderResumenReparto(r) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        // Rebasar el objetivo no es un error: el ticket que cruza la meta entra
        // completo. Se pinta en azul, y en ambar solo lo que se quedo corto.
        const dif = (texto) => {
            const color = String(texto).startsWith('+') ? 'text-[#1C64F2]' : 'text-amber-400';
            return `<span class="${color} ml-2">${esc(texto)}</span>`;
        };

        // El titulo de cada bloque lleva la tasa —que es de lo que habla el reparto—
        // y a un lado, en chico, que tajada de la venta le toca.
        const titulo = (texto, pct, monto) => `
            <span class="block flex items-baseline justify-between gap-3 mt-1">
                <span class="text-gray-300 font-semibold">${esc(texto)}
                    <span class="text-gray-500 font-normal ml-1">${esc(pct)}% de la venta</span>
                </span>
                <span class="font-mono text-gray-200 font-semibold whitespace-nowrap">${esc(monto)}</span>
            </span>
        `;

        const renglon = (etiqueta, monto, extra) => `
            <span class="block flex items-baseline justify-between gap-3 pl-3">
                <span class="text-gray-500">${esc(etiqueta)}</span>
                <span class="font-mono text-gray-400 whitespace-nowrap">${esc(monto)}${extra || ''}</span>
            </span>
        `;

        // Los conteos no son montos: el numero va pegado a su etiqueta y no en la
        // columna de la derecha, para no leerlos como una cifra de dinero.
        const conteo = (etiqueta, cuantos) => `
            <span class="block text-left pl-3">
                <span class="text-gray-500">${esc(etiqueta)}
                    <span class="font-mono text-gray-300 font-semibold ml-1">${esc(cuantos)}</span>
                </span>
            </span>
        `;

        // De que se compone cada grupo. Va debajo del conteo y no a su derecha: con
        // tres cifras (facturados, con comanda, armados) no cabe en el ancho del
        // modal y la frase se partia a media palabra.
        const detalle = (texto, tono) => `
            <span class="block text-left pl-6 text-[11px] ${tono || 'text-gray-500'}">${esc(texto)}</span>
        `;

        const separador = '<span class="block border-t border-[#374151] my-2.5"></span>';

        // El 16% se compone de hasta tres cosas y solo se nombran las que hay: los
        // que ya venian facturados, los que imprimen su comanda y los que estrenan
        // papel del catalogo.
        const conComanda = Math.max(0, (r.cuenta16 || 0) - (r.armados16 || 0));
        const partes16   = [];

        if (r.facturados) partes16.push(`${r.facturados} ya facturados`);
        if (conComanda)   partes16.push(`${conComanda} con su comanda`);
        if (r.armados16)  partes16.push(`${r.armados16} con papel armado`);

        // Rebasar el objetivo no es un error y el modal tiene que decirlo, que es lo
        // que mas se pregunta al ver el resumen: la venta no se parte, asi que el
        // ticket que cruza la meta entra completo al 16% y esa misma cantidad es la
        // que le falta al 0%.
        const desfase = parseFloat(String(r.dif16Texto || '').replace(/[^0-9.]/g, '')) > 0
            ? `<span class="block text-left text-[11px] text-gray-500 mt-2">Los tickets no se parten: el que cruza la meta entra completo, asi que el 16% se pasa ${esc(r.dif16Texto)} y al 0% le falta lo mismo.</span>`
            : '';

        // Los cargos que cambiaron de folio. Es lo primero que hace el cierre y lo
        // unico que reescribe un dato del POS, asi que se enseña movimiento por
        // movimiento y no como un conteo: quien cierra el dia tiene que poder
        // reconocer cada folio que quedo distinto de su ticket impreso.
        //
        // Va arriba del reparto porque es lo que lo precede: los montos que el
        // reparto acaba de repartir ya salieron de aqui.
        const movidos = r.reasignados || [];

        const mudanza = movidos.length ? `
            <span class="block text-left text-gray-300 font-semibold mt-1">${esc(movidos.length)} cargo(s) con tarjeta reasignados</span>
            ${movidos.map(m => m.destino
                ? renglon(`${m.origen} → ${m.destino}`, m.montoTexto)
                : renglon(`${m.origen} · sin folio libre`, m.montoTexto)).join('')}
            ${detalle('el folio se queda con su primer cargo · el resto pasa al proximo que no cobro con tarjeta')}
            ${movidos.some(m => !m.destino)
                ? detalle('los que dicen «sin folio libre» se quedaron donde estaban: ese dia no hubo servicio de mesa disponible', 'text-amber-500')
                : ''}
            ${separador}
        ` : '';

        this.alertBox({
            theme:   FACTURE_THEME,
            type:    'success',
            title:   `Reparto del ${r.fechaTexto}`,
            width:   'w-[430px]',
            timer:   0,
            okLabel: 'Entendido',
            detailHtml: `
                <span class="block flex items-baseline justify-between gap-3">
                    <span class="text-gray-300 font-semibold">Monto del dia</span>
                    <span class="font-mono text-gray-200 font-semibold">${esc(r.totalTexto)}</span>
                </span>
                ${separador}
                ${mudanza}
                ${titulo('Objetivo IVA 16%', r.metaPct, r.objetivoTexto)}
                ${r.facturados ? renglon('ya facturado', r.facturadoTexto) + renglon('por cubrir con tickets', r.porCubrirTexto) : ''}
                ${renglon('logrado', r.logrado16Texto, dif(r.dif16Texto))}
                ${separador}
                ${titulo('Objetivo IVA 0%', r.metaCeroPct, r.objetivoCeroTexto)}
                ${renglon('logrado', r.logrado0Texto, dif(r.dif0Texto))}
                ${desfase}
                ${separador}
                <span class="block text-left text-gray-300 font-semibold mt-1">${esc(r.tickets)} tickets con cargo a tarjeta</span>
                ${conteo('al IVA 16%', r.cuenta16Total)}
                ${partes16.length ? detalle(partes16.join(' · ')) : ''}
                ${conteo('al IVA 0%', r.cuenta0)}
                ${detalle('con ticket virtual del catalogo de tasa 0%')}
                ${r.servicio ? conteo('servicio de mesa', r.servicio) + detalle('cuentas cobradas sin tarjeta · su papel no factura') : ''}
                ${r.sinPapel ? conteo('sin papel', r.sinPapel) + detalle('faltan productos en el catalogo', 'text-amber-500') : ''}
            `
        });
    }

    // La hoja del dia: un papel por venta, todos con el mismo componente que pinta
    // el ticket del panel lateral. Cada uno estrena su propio contenedor porque
    // ticketPaper reemplaza el contenido de su padre, no lo acumula.
    renderPrintSheet(tickets, emisor) {
        const host = $('#printSheet');

        host.empty();

        (tickets || []).forEach((ticket, i) => {
            host.append($('<div>', { id: `printTicket${i}` }));

            this.ticketPaper({
                parent: `printTicket${i}`,
                id:     `paperTicket${i}`,
                json:   ticket,
                emisor: emisor
            });
        });
    }

    // -- Actualizar ventas --

    // La zona donde se sueltan los Excel. El input vive escondido dentro de la
    // etiqueta, que es lo que la vuelve pulsable sin un boton aparte, y acepta
    // varios de una vez: el dia son dos archivos.
    //
    // Los dos van nombrados tal como Wansoft los exporta. "Los dos Excel que
    // descargas de Wansoft" obligaba a saberse de memoria cuales son, y el POS
    // exporta mas de dos.
    renderDropZone() {
        const marco = FACTURE_THEME_IS_LIGHT ? 'border-gray-300 bg-gray-50' : 'border-[#374151] bg-[#141d2b]';
        const texto = FACTURE_THEME_IS_LIGHT ? 'text-gray-900' : 'text-white';
        const sub   = FACTURE_THEME_IS_LIGHT ? 'text-gray-500' : 'text-gray-400';
        const chip  = FACTURE_THEME_IS_LIGHT ? 'bg-white border-gray-200 text-gray-600' : 'bg-[#1F2A37] border-[#374151] text-gray-300';

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const esperados = app.uploadSlots().map((s) => `
            <span class="inline-flex items-center gap-1 rounded border ${chip} px-1.5 py-0.5 font-mono text-[10.5px]">
                ${esc(s.archivo)}
            </span>
        `).join('');

        $('#uploadModalDrop').html(`
            <label id="dropVentas" for="fUpFile"
                   class="mt-3 flex flex-col items-center gap-2 rounded-lg border border-dashed ${marco} px-4 py-6 text-center cursor-pointer">
                <i data-lucide="file-spreadsheet" class="w-9 h-9" style="color:#217346"></i>
                <span class="text-[12.5px] font-semibold ${texto}">Arrastra los reportes o haz clic para elegirlos</span>
                <span class="flex flex-wrap items-center justify-center gap-1.5">${esperados}</span>
                <span class="text-[11px] ${sub}">Los dos que descargas de Wansoft, con la fecha detras · .xls o .xlsx</span>
                <input type="file" id="fUpFile" accept=".xls,.xlsx" class="hidden" multiple>
            </label>
        `);

        if (window.lucide) lucide.createIcons();

        $('#fUpFile').on('change', (e) => app.onPickFile(e.target.files));

        const zona = $('#dropVentas');

        ['dragover', 'dragleave', 'drop'].forEach((ev) => {
            zona.on(ev, (e) => {
                e.preventDefault();

                zona.toggleClass('border-blue-500', ev === 'dragover');

                if (ev === 'drop') app.onPickFile(e.originalEvent.dataTransfer.files);
            });
        });
    }

    // Los archivos elegidos, uno por renglon. Con los dos puestos la zona de
    // arrastre se retira: ya no hay nada mas que soltar.
    renderPickedFiles(archivos, lleno) {
        if (!archivos.length) return this.renderDropZone();

        const marco = FACTURE_THEME_IS_LIGHT ? 'border-gray-300' : 'border-[#374151]';
        const texto = FACTURE_THEME_IS_LIGHT ? 'text-gray-900' : 'text-white';
        const sub   = FACTURE_THEME_IS_LIGHT ? 'text-gray-500' : 'text-gray-400';

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        // Cada renglon dice que archivo es, cuando su nombre lo delata: con dos
        // exports que empiezan igual —«Reporte…»— y la fecha al final, el nombre
        // solo no distingue uno de otro de un vistazo. El que llega renombrado no
        // se etiqueta: lo dira el servidor al revisarlo, y adivinarlo aqui seria
        // prometer un destino que puede no ser.
        const fila = (a, i) => `
            <div class="flex items-center gap-2 rounded-lg border ${marco} px-3 py-2">
                <i data-lucide="file-spreadsheet" class="w-4 h-4 shrink-0" style="color:#217346"></i>
                <span class="text-[12px] font-medium ${texto} truncate">${esc(a.nombre)}</span>
                <span class="text-[11px] ${sub} shrink-0">${esc(a.peso)}</span>
                ${a.slot
                    ? `<span class="text-[10.5px] shrink-0 px-1.5 py-0.5 rounded border ${marco} ${sub}">${esc(a.slot)}</span>`
                    : ''}
                <span class="flex-1"></span>
                <button type="button" data-quitar="${i}" class="text-[11.5px] px-2 py-1 rounded border ${marco} ${sub}">Quitar</button>
            </div>
        `;

        const otro = lleno ? '' : `
            <label for="fUpFile" class="flex items-center justify-center gap-2 rounded-lg border border-dashed ${marco} px-3 py-2 cursor-pointer">
                <i data-lucide="plus" class="w-3.5 h-3.5 ${sub}"></i>
                <span class="text-[11.5px] ${sub}">Agregar el otro archivo</span>
                <input type="file" id="fUpFile" accept=".xls,.xlsx" class="hidden" multiple>
            </label>
        `;

        $('#uploadModalDrop').html(`<div class="mt-3 flex flex-col gap-2">${archivos.map(fila).join('')}${otro}</div>`);

        if (window.lucide) lucide.createIcons();

        $('#fUpFile').on('change', (e) => app.onPickFile(e.target.files));

        $('#uploadModalDrop [data-quitar]').on('click', function () {
            app.removeFile(Number($(this).attr('data-quitar')));
        });
    }

    // Cuantos archivos hay y cuantos se esperan. Es lo que responde la pregunta de
    // "¿ya estan los dos?" sin tener que contar los renglones de arriba.
    //
    // `puestos` son los que su nombre ya identifico. Con eso el aviso nombra el que
    // falta de verdad: antes daba por hecho que el ausente era el segundo, y quien
    // subia primero las comandas leia que le faltaban las comandas.
    renderUploadHint(cuantos, slots, puestos) {
        const total  = slots.length;
        const traidos = puestos || [];

        if (!cuantos) {
            return $('#uploadModalState').html(`
                <p class="mt-3 text-[11.5px] text-gray-500">
                    El dia son <strong>${total} archivos</strong>: el reporte de ventas y el detalle de comandas.
                </p>
            `);
        }

        if (cuantos < total) {
            // Solo se puede nombrar al ausente si los que hay se reconocieron por su
            // nombre; si no, se dice cuantos faltan y ya.
            const falta = traidos.length === cuantos
                ? slots.find((s) => !traidos.some((p) => p.tipo === s.tipo))
                : null;

            const cola = falta
                ? `Falta el <strong>${falta.nombre.toLowerCase()}</strong>. Se puede subir asi, pero ${falta.falta.charAt(0).toLowerCase()}${falta.falta.slice(1)}`
                : `Falta 1 archivo de ${total}. Se puede subir asi, pero el dia queda incompleto.`;

            return $('#uploadModalState').html(`
                <p class="mt-3 flex items-start gap-2 text-[11.5px] facture-warn">
                    <i data-lucide="alert-triangle" class="w-3.5 h-3.5 shrink-0 mt-[1px]"></i>
                    <span>${cola}</span>
                </p>
            `) && (window.lucide ? lucide.createIcons() : null);
        }

        // Lo que antes decia el dialogo de confirmacion, ahora en el sitio donde se
        // decide: la carga es incremental, asi que volver a subir el mismo archivo
        // no duplica nada. Es la respuesta a "¿y si ya lo habia subido?", y como
        // aviso se lee antes de pulsar en vez de interrumpir despues.
        $('#uploadModalState').html(`
            <p class="mt-3 flex items-start gap-2 text-[11.5px] facture-info">
                <i data-lucide="check" class="w-3.5 h-3.5 shrink-0 mt-[1px]"></i>
                Se subiran los ${total} archivos del dia.
            </p>
            <p class="mt-1 text-[11px] text-gray-500">
                Cada movimiento se guarda en el mes de su fecha. Los que ya se procesaron se omiten: solo entran los nuevos.
            </p>
        `);

        if (window.lucide) lucide.createIcons();
    }

    renderUploadStep(texto) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        $('#uploadModalState').html(`
            <p class="mt-3 flex items-center gap-2 text-[12px] facture-info">
                <i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>${esc(texto)}
            </p>
        `);

        if (window.lucide) lucide.createIcons();
    }

    // El reparto ANTES de cargar, cuando el archivo trae varios meses y no hay nada
    // que reprochar.
    //
    // Es el mismo cuadro del aviso de periodo pero sin la advertencia: aqui no hay
    // error, hay una decision. La lista lleva sus casillas, asi que lo que se ve es
    // lo que se va a guardar.
    renderRepartoPrevio(item) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const meses = app.mesesDelReparto(item.reparto);
        const total = meses.reduce((n, m) => n + m.movimientos, 0);

        $('#uploadModalState').html(`
            <div class="mt-3">
                <p class="flex items-start gap-2 text-[12px] facture-info mb-2">
                    <i data-lucide="calendar-range" class="w-3.5 h-3.5 shrink-0 mt-[1px]"></i>
                    <span class="font-semibold">Este archivo trae ${esc(meses.length)} meses</span>
                </p>
                <div class="chk-box">
                    <p class="chk-lead">Sus <strong>${esc(Number(total).toLocaleString('en-US'))}</strong> movimientos se guardan en el mes de cada uno. Desmarca el que no quieras cargar:</p>
                    ${UploadCheck.reparto({ reparto: item.reparto })}
                </div>
            </div>
        `);

        $('#uploadModalState .chk-mes').on('change', () => app.syncSeleccion({ reparto: item.reparto }));

        this.growUploadBox(true);

        if (window.lucide) lucide.createIcons();
    }

    // Lo que la carga lleva escrito, mientras la escribe.
    //
    // Las cifras son filas que ya estan en base, no una estimacion, y por eso el
    // texto las nombra: "3,600 de 13,240 renglones" responde la pregunta que el
    // giro de un spinner deja abierta. Los meses aparecen conforme el importador
    // abre su lote, asi que el reparto se ve ocurrir.
    //
    // La barra puede quedarse corta y no pasa nada: el denominador son las filas
    // del archivo y en una carga incremental muchas se omiten por repetidas, asi
    // que llegar al 100 % no es lo que anuncia el final.
    renderUploadProgress(nombre, avance) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const miles = (n) => Number(n || 0).toLocaleString('en-US');
        const pct   = avance.pct || 0;
        const marco = FACTURE_THEME_IS_LIGHT ? 'bg-gray-200' : 'bg-[#374151]';

        const meses = (avance.meses || []).length
            ? `<span class="text-[11px] text-gray-500">${esc((avance.meses || []).join(' · '))}</span>`
            : '';

        // Con las filas ya escritas lo que queda no se cuenta en filas: son los
        // enlaces a folio y el cierre del lote, que van a su propio paso. Decirlo
        // explica por que la barra esta llena y el modal sigue trabajando.
        //
        // El tiempo solo aparece cuando hay ritmo con el que calcularlo, y sin
        // decimales: es una proyeccion, no una cuenta atras.
        const cola = pct >= 100      ? 'cerrando el lote...'
                   : avance.restante > 0 ? `faltan ${this.tiempoAprox(avance.restante)}`
                   : '';

        const falta = cola ? `<span class="text-[11px] text-gray-500">· ${esc(cola)}</span>` : '';

        $('#uploadModalState').html(`
            <div class="mt-3">
                <p class="flex items-center justify-between gap-2 text-[12px] facture-info">
                    <span class="flex items-center gap-2">
                        <i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>
                        Guardando ${esc(nombre.toLowerCase())}...
                    </span>
                    <strong>${pct}%</strong>
                </p>
                <div class="mt-2 h-1.5 w-full rounded-full ${marco} overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-500" style="width:${pct}%;background:#217346"></div>
                </div>
                <p class="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-gray-500">
                    <span><strong>${miles(avance.filas)}</strong> de ${miles(avance.total)} filas guardadas ${falta}</span>
                    ${meses}
                </p>
            </div>
        `);

        if (window.lucide) lucide.createIcons();
    }

    // Los segundos que faltan, dichos como los diria una persona.
    //
    // Se redondea hacia arriba y en tramos: "faltan 47 s" finge una precision que
    // una proyeccion no tiene, y ademas obliga a leer un numero que cambia en cada
    // vuelta. Por debajo del minuto no se cuenta: se dice que ya casi.
    tiempoAprox(segundos) {
        const s = Math.max(0, Math.round(segundos));

        if (s < 45)   return 'menos de 1 min';
        if (s < 3600) return `${Math.ceil(s / 60)} min`;

        const horas = Math.floor(s / 3600);
        const min   = Math.round((s % 3600) / 60);

        return min > 0 ? `${horas} h ${min} min` : `${horas} h`;
    }

    renderUploadError(mensaje) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        $('#uploadModalState').html(`
            <p class="mt-3 flex items-start gap-2 text-[12px] facture-warn">
                <i data-lucide="alert-triangle" class="w-3.5 h-3.5 shrink-0 mt-[1px]"></i>${esc(mensaje)}
            </p>
        `);

        if (window.lucide) lucide.createIcons();
    }

    // Lo que hay que corregir en el Excel. El cuadro es el mismo que dibuja el
    // aviso de Importacion —UploadCheck—, con el libro de hojas enfrentado y la
    // fila de encabezados columna por columna: una columna corrida o un mes que no
    // es el del filtro no caben en un renglon de texto, y son lo unico con lo que
    // el usuario puede arreglar su archivo.
    //
    // Lo que cambia respecto de Importacion es el marco: alli el aviso abre un
    // dialogo, aqui se pinta dentro del modal que ya esta abierto, que es donde el
    // usuario dejo sus archivos.
    renderUploadRejected(v, fileName, destino) {
        const nombre = (tipo) => (app.uploadSlots().find((x) => x.tipo === tipo) || {}).nombre || tipo || '';

        const ctx = {
            titulo:   nombre(destino || UPLOAD_TAB),
            periodo:  `${$('#fUpMes option:selected').text()} ${$('#fUpAnio').val()}`,
            sugerido: nombre(v.sugerido)
        };

        $('#uploadModalState').html(`
            <div class="mt-3">
                <p class="flex items-start gap-2 text-[12px] facture-warn mb-2">
                    <i data-lucide="alert-triangle" class="w-3.5 h-3.5 shrink-0 mt-[1px]"></i>
                    <span class="font-semibold">${UploadCheck.title(v, ctx)}</span>
                </p>
                ${UploadCheck.box(v, fileName, ctx, { compacto: true })}
            </div>
        `);

        UploadCheck.settle('#uploadModalState');

        // La lista de meses es tambien la seleccion de lo que se va a cargar: al
        // marcar o desmarcar uno, el boton del pie se reescribe con lo que queda.
        $('#uploadModalState .chk-mes').on('change', () => app.syncSeleccion(v));

        // El cuerpo deja de medir lo mismo que en los demas pasos: el libro dibujado
        // y la fila de encabezados no caben en el alto fijo, y ahi el salto del
        // dialogo es lo de menos. En Importacion no hace falta porque el aviso abre
        // su propia ventana de 720px.
        this.growUploadBox(true);

        // El cuadro nace debajo de los archivos elegidos: sin traerlo a la vista el
        // modal se queda mostrando la lista de siempre y parece que el boton no hizo
        // nada.
        const aviso = document.getElementById('uploadModalState');

        if (aviso) aviso.scrollIntoView({ block: 'start' });

        if (window.lucide) lucide.createIcons();
    }

    // El alto del cuerpo: fijo mientras se eligen los archivos —para que el dialogo
    // no salte bajo el cursor— y libre cuando lo que se muestra es el aviso de por
    // que uno no entro.
    growUploadBox(crecer) {
        $('#uploadModalBox')
            .toggleClass('h-[22rem]', !crecer)
            .toggleClass('max-h-[60vh]', !!crecer);
    }

    // Que entro con cada archivo. Se listan los dos porque cada uno responde por lo
    // suyo: las ventas por los folios del dia, las comandas por el detalle que el
    // ticket imprime.
    // Los movimientos que ya estaban pero HOY traen otro importe.
    //
    // No se cargaron ni se corrigieron: la carga solo agrega, y tocar el importe de
    // un ticket ya emitido cambiaria por detras un papel que alguien tiene en la
    // mano. Lo que hace falta es saber cuales son, con las dos cifras al lado, para
    // ir a revisarlos al POS y decidir alli.
    cambiosDeImporte(hoja) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const lista = hoja.diferencias || [];

        if (!lista.length) return '';

        const dinero = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
        const total  = Number(hoja.difieren) || lista.length;
        const marco  = FACTURE_THEME_IS_LIGHT ? 'border-gray-200' : 'border-[#374151]';

        const fila = (d) => `
            <tr>
                <td class="chk-col">${esc(d.folio || d.pdv)}</td>
                <td class="chk-right">${esc(dinero(d.guardado))}</td>
                <td class="chk-right"><span class="chk-warn-txt">${esc(dinero(d.archivo))}</span></td>
            </tr>
        `;

        return `
            <div class="mt-2 ml-5 rounded-lg border ${marco} p-2.5">
                <p class="flex items-start gap-2 text-[11.5px] facture-warn">
                    <i data-lucide="alert-triangle" class="w-3.5 h-3.5 shrink-0 mt-[1px]"></i>
                    <span><strong>${esc(total)}</strong> movimiento(s) ya cargados traen hoy otro importe. <strong>No se modificaron.</strong></span>
                </p>
                <table class="chk-table mt-1.5">
                    <thead><tr><th>Ticket</th><th class="chk-right">Guardado</th><th class="chk-right">En el archivo</th></tr></thead>
                    <tbody>${lista.map(fila).join('')}</tbody>
                </table>
                ${total > lista.length ? `<p class="chk-note">y ${esc(total - lista.length)} mas</p>` : ''}
            </div>
        `;
    }

    renderUploadDone(cargas) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const bloque = (c) => {
            const hojas = (c.data.hojas || []).filter(h => (h.filas || 0) > 0);
            const filas = hojas.reduce((n, h) => n + (h.filas || 0), 0);

            return `
                <p class="mt-2 flex items-start gap-2 text-[12px] facture-info">
                    <i data-lucide="check-circle" class="w-3.5 h-3.5 shrink-0 mt-[1px] text-green-600"></i>
                    <span>
                        <span class="block font-semibold">${esc(c.slot.nombre)}</span>
                        <span class="block text-[11px] opacity-90">${filas.toLocaleString('en-US')} registro(s) en ${hojas.length} hoja(s)</span>
                    </span>
                </p>
                ${(c.data.hojas || []).map(h => `
                    <p class="mt-1 text-[11px] text-gray-500 flex items-start gap-1.5 pl-5">
                        <span class="w-1.5 h-1.5 rounded-full mt-[5px] shrink-0" style="background:${h.estado === 'ok' ? '#047857' : '#B45309'}"></span>
                        <span><span class="font-medium">${esc(h.nombre)}</span> · ${esc(h.detalle)}</span>
                    </p>
                    ${this.cambiosDeImporte(h)}
                `).join('')}
            `;
        };

        // Lo que entro se ve entero en Importacion: sus lotes, hoja por hoja, y la
        // bitacora con quien los cargo. Este resumen dice cuanto entro, no en que
        // quedo, y despues de una carga repartida en varios meses eso es justo lo
        // que se quiere mirar.
        //
        // Abre en otra pestana a proposito: el modal esta dentro de la terminal del
        // dia y el usuario no ha terminado con ella. Llevarselo de aqui le costaria
        // volver a cargar la pantalla y a buscar su fecha.
        const marco = FACTURE_THEME_IS_LIGHT ? 'border-gray-200' : 'border-[#374151]';

        const enlace = `
            <p class="mt-3 pt-2.5 border-t ${marco}">
                <a href="/app/facture2/cargas.php" target="_blank" rel="noopener"
                   class="inline-flex items-center gap-1.5 text-[11.5px] font-medium facture-info hover:underline">
                    <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                    Ver el detalle en Importación mensual
                </a>
            </p>
        `;

        $('#uploadModalDrop').empty();
        $('#uploadModalState').html(`<div class="mt-1">${cargas.map(bloque).join('')}${enlace}</div>`);

        if (window.lucide) lucide.createIcons();
    }

    // El aviso del pie explica el ticket que se esta viendo: cuando no se pudo
    // armar (sin productos de tasa 0% dados de alta) dice por que en vez de
    // quedarse mudo.
    renderPreview(ticket, motivo) {
        this.ticketPaper({
            parent: 'ticketPrintArea',
            json:   ticket,
            emisor: app.dataInit.emisor,
            labels: { empty: motivo || 'Sin ticket seleccionado' }
        });

        this.panelHead({
            parent: 'detailHead',
            json: {
                // El icono del titulo deja la impresora al boton de imprimir y se
                // queda con el del documento, que es lo que el panel ensena.
                icon:   'receipt',
                title:  ticket ? `Ticket virtual · Nota ${ticket.nota}` : 'Ticket virtual',
                // Imprimir vive en el encabezado, junto al ticket que va a salir, y
                // solo aparece cuando hay uno abierto: sin papel no hay nada que
                // mandar a la impresora.
                action: ticket
                    ? { id: 'btnImprimir', icon: 'printer', text: 'Imprimir', title: 'Imprimir este ticket', fn: () => tickets.printTicket() }
                    : null,
                badges: ticket
                    ? [
                        // El servicio de mesa se rotula por lo que es y no por su
                        // tasa: dice 0% como los del reparto, pero no salio de una
                        // decision de reparto sino de no haber cobrado con tarjeta.
                        ticket.grupo === 'servicio'
                            ? { text: 'Servicio de mesa', tone: 'b-gray' }
                            : { text: ticket.tasaText === '0%' ? 'IVA 0%' : `IVA ${ticket.tasaText}`, tone: ticket.tasaText === '0%' ? 'b-yellow' : 'b-terra' },
                        // Tres estados y no dos: el papel guardado, el consumo real
                        // con el que la venta se factura al 16%, y la propuesta que
                        // se le arma a la venta que llego sin comanda y todavia no
                        // se guarda.
                        ticket.generado
                            ? { text: 'papel guardado', tone: 'b-blue' }
                            : (ticket.grupo === 'ivaGenerado' || ticket.grupo === 'servicio'
                                ? { text: 'propuesta', tone: 'b-yellow' }
                                : { text: 'consumo real', tone: 'b-gray' }),
                        // El ajuste que se paso del tope se ve sin leer la nota: es
                        // el mismo aviso que lleva la fila en el listado.
                        ...(ticket.fueraTolerancia ? [{ text: `Descuento ${ticket.descuento}`, tone: 'b-yellow' }] : [])
                      ]
                    : []
            }
        });

        // Sin ticket abierto la banda de la nota no se pinta: el papel ya dice "Sin
        // ticket seleccionado" en su propio hueco, y repetirlo debajo era decir dos
        // veces lo mismo en la misma columna. El aviso vuelve en cuanto hay algo que
        // explicar —la nota del papel abierto, o el motivo por el que no se pudo
        // armar—, y mientras tanto el div se esconde para no dejar una franja con
        // padding y sin contenido.
        // El hueco del papel va gris con un ticket abierto —es la mesa sobre la que
        // se apoya la hoja— y blanco mientras no hay ninguno, que es cuando no hay
        // hoja que despegar. El color vive en wansoft-theme.css (.tk-vacio).
        $('#ticketPrintArea').toggleClass('tk-vacio', !ticket);

        const nota = ticket ? this.previewNote(ticket) : motivo;

        $('#detailNote').toggle(!!nota).empty();

        if (!nota) return;

        this.noteBox({
            parent: 'detailNote',
            class:  'text-[10px] text-gray-400 text-center',
            json: {
                icon: '',
                text: nota
            }
        });
    }

    // El copy depende de que papel se esta viendo:
    //
    //   servicio     la cuenta que no se cobro con tarjeta: dice por que su papel
    //                no lleva productos.
    //   cero         inventado con productos de tasa 0%, explica el cuadre.
    //   ivaGenerado  inventado con el catalogo de IVA, para la venta que llego sin
    //                comanda: explica de donde salieron los renglones y su desglose.
    //   real         el consumo que trajo el POS, explica solo el desglose.
    previewNote(ticket) {
        if (ticket.grupo === 'servicio') {
            // Los dos papeles en cero se explican distinto: el movimiento que llego
            // con Total $0.00 no tiene cobro que nombrar, y decir que se cobro con
            // tarjeta manda a buscar un importe que el Excel nunca trajo.
            if (ticket.ceroDeOrigen) {
                return `El movimiento vino sin importe en la carga: no cobro nada, asi que no factura y sale en ${ticket.total}. Imprime un solo renglon de servicio de mesa, en vez del consumo.`;
            }

            return `La cuenta se cobro con ${String(ticket.metodo || '').toLowerCase()}: el papel no ampara ningun cargo con tarjeta, asi que no factura y sale en ${ticket.total}. Imprime un solo renglon de servicio de mesa, en vez del consumo.`;
        }

        if (ticket.grupo === 'cero') {
            return `${ticket.lineas.length} renglon(es) de productos de tasa 0% suman ${ticket.subtotal} contra los ${ticket.total} del ticket.` + this.ajusteText(ticket);
        }

        const desglose = `${ticket.subtotal} de base mas ${ticket.iva} de IVA ${ticket.tasaText} dan los ${ticket.total} que se cobraron.`;

        if (ticket.grupo === 'ivaGenerado') {
            return `Papel armado del catalogo de IVA porque la venta llego sin su comanda: ${ticket.lineas.length} renglon(es) suman el total del ticket. ${desglose}` + this.ajusteText(ticket);
        }

        return `Consumo real del ticket: ${desglose}` + this.ajusteText(ticket);
    }

    // Lo que se dice del ajuste con el que se cuadro el papel. Se dice SIEMPRE que
    // exista, y no solo en el del 0%: el armado con el catalogo de IVA tambien puede
    // cerrar con diferencia, y una diferencia que no se ve es una silenciosa.
    //
    // Solo el papel inventado se cuadra con un ajuste. El descuento de un papel real
    // es una cortesia que el POS ya cobro asi, y llamarle ajuste de cuadre seria
    // decir que el sistema lo puso, cuando no lo puso.
    //
    // Sin tope capturado la tolerancia llega en cero y la frase solo informa el
    // ajuste, sin veredicto que no se pidio.
    ajusteText(ticket) {
        if (!ticket.conAjuste) return '';
        if (ticket.grupo !== 'cero' && ticket.grupo !== 'ivaGenerado') return '';

        if (ticket.fueraTolerancia) {
            return ` Se cuadro con un descuento de ${ticket.descuento}, que pasa la tolerancia de ${ticket.tolerancia}.`;
        }

        return ` Se cuadro con un descuento de ${ticket.descuento}.`;
    }

    // -- Components --

    // El papel del ticket vive en components/ticketPaper.js: lo comparten este
    // modulo y la vista previa del emisor en Catalogos, que muestran el mismo
    // papel y tienen que verse identicos.
    ticketPaper(options) {
        TicketPaper.render(options);
    }

    noteBox(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'text-[10px] text-gray-400 flex items-start gap-2',
            json:   { icon: 'info', text: '' }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json  = Object.assign({}, defaults.json, o.json || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const iconHtml = opts.json.icon
            ? `<i data-lucide="${esc(opts.json.icon)}" class="w-3.5 h-3.5 text-gray-400 shrink-0 mt-[1px]"></i>`
            : '';

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html(`${iconHtml}<span>${esc(opts.json.text)}</span>`);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
    }

    panelHead(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'flex items-center justify-between w-full gap-2 flex-wrap',
            json:   { icon: '', iconClass: 'w-4 h-4 text-gray-400', title: '', badges: [] },
            classes: {
                title: 'text-[12px] font-bold text-gray-300 flex items-center gap-2'
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const iconHtml = opts.json.icon ? `<i data-lucide="${esc(opts.json.icon)}" class="${opts.json.iconClass}"></i>` : '';

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });

        wrap.html(`<h3 class="${opts.classes.title}">${iconHtml}${esc(opts.json.title)}</h3>`);

        // La derecha del encabezado: primero lo que el ticket es —sus badges— y al
        // final lo que se puede hacer con el. La accion se arma aparte y no con el
        // resto del html porque lleva handler.
        const derecha = $('<div>', { class: 'flex items-center gap-2' });

        (opts.json.badges || []).forEach((b) => derecha.append($('<span>', {
            class: `badge-base ${b.tone || 'b-gray'}`,
            text:  b.text
        })));

        if (opts.json.action) derecha.append(this.panelAction(opts.json.action));

        wrap.append(derecha);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
    }

    // El boton de accion del encabezado. Va en blanco y no en azul: el azul de la
    // terminal es el de las acciones del dia —generar, imprimir el dia— y esta
    // opera sobre un ticket, que es una escala mas chica. Los colores viven en
    // wansoft-theme.css (.ws-act).
    panelAction(action) {
        const btn = $('<button>', {
            type:  'button',
            id:    action.id || 'panelAction',
            class: 'ws-act',
            title: action.title || action.text || ''
        });

        if (action.icon) btn.append($('<i>', { 'data-lucide': action.icon, class: 'w-3.5 h-3.5' }));
        if (action.text) btn.append($('<span>', { text: action.text }));

        if (action.fn) btn.on('click', action.fn);

        return btn;
    }
}
