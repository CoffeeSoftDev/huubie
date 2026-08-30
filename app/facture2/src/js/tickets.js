let apiTickets = '/app/facture/ctrl/ctrl-facture-tickets.php';
let app, tickets, ticketsView;

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
        const base = { modo: 'pct', valor: this.dataInit.metaPct };

        try {
            const guardado = JSON.parse(localStorage.getItem(META_KEY));

            if (guardado && (guardado.modo === 'pct' || guardado.modo === 'monto') && guardado.valor >= 0) {
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
            {
                opc:       'button',
                id:        'btnGenerarTodos',
                text:      'Generar ticket',
                color_btn: 'invernal',
                class:     'col-12 col-md-4 col-lg-3 lg:col-start-9',
                onClick:   () => tickets.generateDay()
            },
            {
                opc:       'button',
                id:        'btnRehacer',
                text:      'Rehacer reparto',
                color_btn: 'secondary',
                class:     'col-12 col-md-4 col-lg-3 lg:col-start-6',
                onClick:   () => tickets.redoDay()
            },
            {
                opc:       'button',
                id:        'btnImprimirTodos',
                text:      'Imprimir tickets',
                color_btn: 'invernal',
                class:     'col-12 col-md-4 col-lg-3 lg:col-start-9',
                onClick:   () => tickets.printSheet()
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

        // El panel no sobrevive a un dia sin reparto: si se cambia de fecha, el
        // papel que quedaba en pantalla es el de otro dia y ya no se puede abrir
        // ninguno para reemplazarlo.
        if (!repartido && this.selectedId) this.selectTicket(null);

        columna('btnGenerarTodos').toggle(!repartido);
        columna('btnImprimirTodos').toggle(repartido);
        columna('btnRehacer').toggle(repartido);
    }


    // La meta viaja con el dia en todas las peticiones: decide que ticket va a que
    // tasa, asi que el listado, el cierre y la hoja tienen que verla igual.
    getFilters() {
        return {
            dia:       $('#fDia').val() || this.dataInit.dia,
            metaModo:  this.meta.modo,
            metaValor: this.meta.valor
        };
    }

    // -- Event handlers --

    onChangeFilters() {
        tickets.lsTickets();

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
    // dicen lo mismo: cuanto de la venta con tarjeta se factura al 16%. Solo se
    // captura esa mitad; la del 0% es el resto, asi que las dos siempre suman el
    // Total Tarjeta de Credito y el reparto no se puede dejar sin cuadrar.
    //
    // El modal muestra lo que la barra no podia: las dos tasas con su monto mientras
    // se captura, y no solo el campo suelto de la que se escribe.
    openMetaModal() {
        if (this.metaModal) return;

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
                    lbl:      'Cuanto se factura al IVA 16%:',
                    type:     'number',
                    tipo:     'numero',
                    class:    'col-12',
                    value:    this.meta.valor,
                    required: false
                }
            ]
        });

        // El reparto se recalcula tecla a tecla: es lo que se esta mirando mientras
        // se captura, y con onchange solo aparece al salir del campo.
        $('#fMetaValor').on('input', () => this.renderMetaPreview());

        this.renderMetaPreview();
    }

    // Cambiar de unidad no cambia la meta: la traduce. El 70% de la venta y su
    // importe son el mismo acuerdo escrito de dos formas, y quien alterna el
    // selector espera ver la conversion, no un campo que se reinicia.
    onChangeMetaModo() {
        const modo  = $('#fMetaModo').val();
        const total = parseFloat(this.dataKpis.total) || 0;
        const valor = parseFloat($('#fMetaValor').val()) || 0;

        // Sin venta en el dia no hay de que sacar el porcentaje: se vuelve al
        // default en vez de dejar el campo en cero, que repartiria todo al 0%.
        const convertido = modo === 'monto'
            ? total * valor / 100
            : (total > 0 ? valor / total * 100 : this.dataInit.metaPct);

        $('#fMetaValor').val(Math.round(convertido * 100) / 100);

        this.renderMetaPreview();
    }

    // El reparto que se va a aplicar, con la misma cuenta que metaDelDia() hace en el
    // servidor: el 16% se acota a la venta del dia y el 0% es el complemento. Es la
    // unica cifra que el modulo calcula en pantalla, y solo porque se mira antes de
    // que exista la peticion que la confirmaria.
    renderMetaPreview() {
        const total     = parseFloat(this.dataKpis.total) || 0;
        const modo      = $('#fMetaModo').val();
        const valor     = parseFloat($('#fMetaValor').val()) || 0;
        const capturado = modo === 'monto' ? valor : total * valor / 100;
        const objetivo  = Math.max(0, Math.min(capturado, total));

        ticketsView.renderMetaPreview({
            totalTexto: this.moneyText(total),
            texto16:    this.moneyText(objetivo),
            texto0:     this.moneyText(total - objetivo),
            pct16:      this.pctText(total > 0 ? objetivo / total * 100 : 0),
            pct0:       this.pctText(total > 0 ? (total - objetivo) / total * 100 : 0),
            // Pedir mas de lo que se vendio es la unica captura que el reparto no
            // puede respetar: se acota, y se avisa, porque el campo sigue mostrando
            // lo que se escribio.
            recortado:  capturado > total
        });
    }

    // Aplicar cierra el modal y vuelve a pedir el dia: la meta viaja en cada
    // peticion, asi que el listado, los KPIs y el reparto tienen que verla igual.
    applyMeta() {
        const valor = parseFloat($('#fMetaValor').val());

        this.meta = {
            modo:  $('#fMetaModo').val(),
            valor: isNaN(valor) || valor < 0 ? 0 : valor
        };

        this.saveMeta();
        this.metaModal.close();
        tickets.lsTickets();
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
            emptyMessage: 'No hay ventas pagadas en el dia seleccionado',
            emptyIcon:    'ic-file-text',
            data:         data
        });

        if (window.lucide) lucide.createIcons();

        this.dataTable(`#tb${this.PROJECT_NAME}`, data);

        const counts = data.counts || { facturados: 0, cero: 0, generados: 0, mostrados: 0, servicio: 0 };

        app.dataKpis = data.kpis || {};

        app.dataMudados = data.mudados || [];

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

    // El cierre del dia: el servidor decide que se factura al 16% y que se manda al
    // 0%, y arma el papel que a cada grupo le falte —el del cero siempre, el del 16%
    // solo cuando la venta llego sin su comanda—. No imprime nada; el papel sale con
    // el otro boton, que aparece justo cuando esto termina.
    //
    // Va sin preguntar porque solo se ofrece en el dia que todavia no se reparte: no
    // hay nada que reemplazar. El que si pregunta es redoDay().
    async generateDay() {
        await this.runLocked(async () => {
            const response = await useFetch({ url: apiTickets, data: Object.assign({ opc: 'generateDay' }, app.getFilters()) });

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
            if (result.isConfirmed)   this.generateDay();
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

    // El ojo esta apagado mientras el dia no se reparte. El aviso dice con que
    // boton aparece el papel, que es lo unico que quien hizo clic necesita saber.
    pendingNotice() {
        this.alertBox({
            theme: FACTURE_THEME,
            type:  'message',
            title: 'Genera los tickets del dia para ver el papel de cada ticket'
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

        const aviso = p.recortado ? `
            <p class="mt-2 text-[10px] facture-warn flex items-start gap-1.5">
                <i data-lucide="alert-triangle" class="w-3 h-3 shrink-0 mt-[1px]"></i>
                Se capturo mas que la venta del dia: el reparto se acota al total y no queda nada al IVA 0%.
            </p>
        ` : '';

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
                        <i data-lucide="check" class="w-3 h-3 text-green-600"></i>
                        Suma de las dos tasas
                    </span>
                    <span class="text-[12px] font-semibold ${valor}">${esc(p.totalTexto)}</span>
                </div>
            </div>
            ${aviso}
        `);

        if (window.lucide) lucide.createIcons();
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
