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
        this.previewActions();
        ticketsView.renderFooter();
        ticketsView.renderListNote();
        this.updateHeaderTitle();
        ticketsView.renderPreview(null);
        tickets.lsTickets();
    }

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
                    id:    'filterBar',
                    class: 'px-3 pt-3 pb-1 bg-[#0E1521] flex-shrink-0'
                },
                {
                    id:    'kpisRow',
                    class: 'px-3 pt-1 pb-3 bg-[#0E1521] flex-shrink-0'
                },
                {
                    id:    'tableRow',
                    class: 'p-3 flex-1 min-h-0 flex flex-col'
                },
                {
                    id:    'listNote',
                    class: 'px-4 py-2 bg-[#141d2b] flex-shrink-0'
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
                    },
                    {
                        type:  'div',
                        id:    'detailActions',
                        class: 'px-3 py-2 bg-[#0E1521] flex-shrink-0'
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
                class: 'w-full flex-1 min-h-0 bg-[#1F2A37] rounded-lg p-4 flex flex-col',
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
            {
                opc:       'button',
                id:        'btnGenerarTodos',
                text:      'Generar tickets del dia',
                color_btn: 'invernal',
                class:     'col-12 col-md-4 col-lg-3',
                onClick:   () => tickets.generateDay()
            },
            {
                opc:       'button',
                id:        'btnImprimirTodos',
                text:      'Imprimir tickets',
                color_btn: 'invernal',
                class:     'col-12 col-md-4 col-lg-3',
                onClick:   () => tickets.printSheet()
            },
            {
                opc:       'button',
                id:        'btnRehacer',
                text:      'Rehacer reparto',
                color_btn: 'secondary',
                class:     'col-12 col-md-4 col-lg-3',
                onClick:   () => tickets.redoDay()
            },
            // Cuanto de la venta se factura al 16% es un acuerdo del mes, no un filtro
            // del dia: vive detras del engrane y no en la barra, donde dos campos mas
            // competian por el renglon con la fecha y las acciones.
            //
            // Va al final y en la ultima columna (col-start-12) para quedar pegado al
            // borde, separado de las acciones: se toca una vez al mes y no compite con
            // los botones que se usan a diario. La meta vigente la sigue mostrando la
            // tarjeta del objetivo al 16%, no este boton.
            {
                opc:       'button',
                id:        'btnMetaConfig',
                text:      '',
                color_btn: 'light',
                class:     'col-6 col-lg-1 lg:col-start-12 flex flex-col items-end',
                className: '!w-10 !h-9 !px-0 flex items-center justify-center',
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

    // Acciones del ticket virtual: viven en el pie del aside, no en la filterBar,
    // porque operan sobre el ticket seleccionado y no sobre el listado.
    previewActions() {
        this.createfilterBar({
            parent:     'detailActions',
            id:         'frmActionsTickets',
            coffeesoft: true,
            theme:      FACTURE_THEME,
            data: [
                {
                    opc:       'button',
                    id:        'btnRegenerar',
                    text:      'Generar',
                    color_btn: 'secondary',
                    class:     'col-6',
                    onClick:   () => tickets.generate()
                },
                {
                    opc:       'button',
                    id:        'btnImprimir',
                    text:      'Imprimir',
                    color_btn: 'invernal',
                    class:     'col-6',
                    onClick:   () => tickets.printTicket()
                }
            ]
        });
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
        this.updateHeaderTitle();
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

    // Copy de la cabecera del modulo. No son datos: tickets, emisor y renglones del
    // ticket virtual se consultan al servidor.
    updateHeaderTitle() {
        const header = {
            title:    'Tickets',
            subtitle: 'Tickets virtuales del dia, de lo pagado con tarjeta de credito. Las demas formas de pago no se muestran. Las notas se reinician cada dia',
            back:     { href: '/app/facture2/inicio.php', title: 'Regresar a la Terminal' }
        };

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const f         = this.getFilters();
        const fecha     = String(f.dia || '').split('-').reverse().join('/');
        const titleHtml = `${header.title} <span class="font-bold" style="color:#1C64F2;">&middot; ${esc(fecha)}</span>`;

        ticketsView.renderHeader(Object.assign({}, header, { titleHtml }));
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
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

        const botones = $('#btnGenerarTodos, #btnRehacer, #btnRegenerar')
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
            emptyMessage: 'No hay cobros con tarjeta de credito en el dia seleccionado',
            emptyIcon:    'ic-file-text',
            data:         data
        });

        if (window.lucide) lucide.createIcons();

        this.dataTable(`#tb${this.PROJECT_NAME}`, data);

        const counts = data.counts || { facturados: 0, cero: 0, generados: 0, mostrados: 0 };

        app.dataKpis = data.kpis || {};

        ticketsView.renderKpis(app.dataKpis);
        ticketsView.renderListNote(data.corte);
        app.syncActionButtons(counts);
        app.syncMetaButton();

        app.updateFooterInfo(`Mostrando ${counts.mostrados} ticket${counts.mostrados !== 1 ? 's' : ''} pagados con tarjeta de credito`);
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

    renderHeader(data) {
        this.viewHeader({
            parent: 'viewHeader',
            id:     'hdrTickets',
            json:   data
        });
    }

    renderFooter() {
        this.viewFooter({
            parent: 'viewFooterRow',
            id:     'viewFooter',
            json: {
                info: '',
                legends: [
                    { tone: 'success', label: 'Facturado (bloqueado)'   },
                    { tone: 'info',    label: 'Ticket IVA 16%'  },
                    { tone: 'default', label: 'Ticket IVA 0%'   },
                    { tone: 'warning', label: 'Requiere ticket virtual' },
                    { tone: 'default', label: 'No facturado'   }
                ]
            }
        });
    }

    // El pie del listado. Cuando el dia tiene corte previsto la nota lo dice primero:
    // la linea de la tabla es una marca muda sin los numeros que la ponen ahi.
    //
    // Sin corte no hay linea que explicar —toda la venta cabe en el 16%— y la nota
    // se queda con lo de siempre.
    renderListNote(corte) {
        const base = 'Al generar, los que caen al IVA 0% estrenan una lista de productos de tasa 0% que suma su total. Los del IVA 16% conservan lo que trae su comanda, y solo los que llegaron sin detalle se arman con el catalogo de IVA. Los productos se dan de alta en Catalogos; el sistema busca la combinacion que da el total exacto y el descuento solo aparece cuando ninguna cuadra. El ticket cuyo descuento pase la tolerancia capturada en Emisor lo dice al abrirlo.';

        const linea = corte && corte.hay
            ? `La linea ambar marca hasta donde llega el IVA 16%: las ${corte.cuenta16} ventas de arriba suman ${corte.logradoTexto} para un objetivo de ${corte.objetivoTexto}, y las ${corte.cuenta0} de abajo (${corte.monto0Texto}) caen al IVA 0%. `
            : '';

        this.noteBox({
            parent: 'listNote',
            json:   { text: linea + base }
        });
    }

    // Tarjetas del dia: la venta con tarjeta, la meta a la que hay que llegar, lo que
    // ya quedo cubierto y lo que falta. Los montos llegan escritos del servidor; lo
    // unico que se arma aqui es el copy que los acompana.
    //
    // El fondo se elige por tema: Resumen lo trae fijo en oscuro y en la vista clara
    // se le ven tarjetas negras. Aqui no.
    renderKpis(k) {
        const bgColor     = FACTURE_THEME_IS_LIGHT ? 'bg-white' : 'bg-[#141d2b]';
        const borderColor = FACTURE_THEME_IS_LIGHT ? 'border-gray-200' : 'border-transparent';
        const textColor   = FACTURE_THEME_IS_LIGHT ? 'text-gray-900' : 'text-white';

        const card = (id, title, lucideIcon, value, subtitle, color) => ({
            id, title, lucideIcon, bgColor, borderColor,
            data: { value: value || '$0.00', subtitle: subtitle, color: color }
        });

        const pctCero      = k.metaCeroPct || 30;
        const tituloCero   = k.ceroGenerado ? 'Generado al IVA 0%' : 'Monto objetivo para IVA 0%';
        const valorCero    = k.ceroGenerado ? k.obtenidoCeroTexto : k.objetivoCeroTexto;
        const subtituloCero = k.ceroGenerado
            ? `${pctCero}% de la venta · objetivo ${k.objetivoCeroTexto}`
            : `${pctCero}% de la venta con tarjeta`;

        // Cuando la meta se fija como cantidad, el porcentaje sigue siendo cierto
        // pero ya no es lo que se capturo: la tarjeta lo dice para que nadie lea un
        // 44.8% como si alguien lo hubiera elegido asi.
        const subtituloMeta = k.metaModo === 'monto'
            ? `cantidad fija · ${k.metaPct || 70}% de la venta con tarjeta`
            : `${k.metaPct || 70}% de la venta con tarjeta`;

        this.infoCard({
            parent: 'kpisRow',
            id:     'kpisTickets',
            theme:  FACTURE_THEME,
            style:  'file',
            cols:   5,
            json: [
                // De las cinco tarjetas esta es la unica cifra que el modulo procesa
                // de verdad —la suma de los movimientos validos— y de ella salen los
                // dos objetivos. Por eso va destacada y no como las demas: el nombre
                // es el del documento y el subtitulo dice las dos reglas que la
                // forman, que es justo lo que la separa del total de Resumen.
                //
                // Las clases kpi-hero* no pintan aqui: el color vive en
                // wansoft-theme.css, que es donde debe estar (TRM-007).
                {
                    id:          'kpiTotalDia',
                    title:       'Total Tarjeta de Credito',
                    lucideIcon:  'credit-card',
                    bgColor:     'kpi-hero',
                    borderColor: 'kpi-hero-bd',
                    data: {
                        value:    k.totalTexto || '$0.00',
                        subtitle: `${k.tickets || 0} movimientos validos · Pagada + tarjeta de credito`,
                        color:    'kpi-hero-val'
                    }
                },

                card('kpiMeta', 'Monto objetivo para IVA 16%', 'target', k.objetivoTexto,
                     subtituloMeta, textColor),

                card('kpiFacturado', 'Ya facturado', 'lock', k.facturadoTexto,
                     `${k.facturados || 0} tickets facturados realmente`, 'text-green-600'),

                card('kpiPorFacturar', 'Por facturar al IVA 16%', 'alert-circle', k.porFacturarTexto,
                     `${k.metaPct || 70}% de la venta - Facturado`, 'text-[#1C64F2]'),

                // El monto que el reparto armo al 0%. El objetivo baja al subtitulo:
                // el dato que se lee es lo generado, no la comparacion.
                // Mientras el dia no tenga reparto corrido se muestra el objetivo.
                card('kpiObjetivoCero', tituloCero, 'alert-circle', valorCero,
                     subtituloCero, 'text-[#1C64F2]')
            ]
        });
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
                ${titulo('Objetivo IVA 16%', r.metaPct, r.objetivoTexto)}
                ${r.facturados ? renglon('ya facturado', r.facturadoTexto) + renglon('por cubrir con tickets', r.porCubrirTexto) : ''}
                ${renglon('logrado', r.logrado16Texto, dif(r.dif16Texto))}
                ${separador}
                ${titulo('Objetivo IVA 0%', r.metaCeroPct, r.objetivoCeroTexto)}
                ${renglon('logrado', r.logrado0Texto, dif(r.dif0Texto))}
                ${desfase}
                ${separador}
                <span class="block text-left text-gray-300 font-semibold mt-1">${esc(r.tickets)} tickets del dia</span>
                ${conteo('al IVA 16%', r.cuenta16Total)}
                ${partes16.length ? detalle(partes16.join(' · ')) : ''}
                ${conteo('al IVA 0%', r.cuenta0)}
                ${detalle('con ticket virtual del catalogo de tasa 0%')}
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
                icon:   'printer',
                title:  ticket ? `Ticket virtual · Nota ${ticket.nota}` : 'Ticket virtual',
                badges: ticket
                    ? [
                        { text: ticket.tasaText === '0%' ? 'IVA 0%' : `IVA ${ticket.tasaText}`, tone: ticket.tasaText === '0%' ? 'b-yellow' : 'b-terra' },
                        // Tres estados y no dos: el papel guardado, el consumo real
                        // con el que la venta se factura al 16%, y la propuesta que
                        // se le arma a la venta que llego sin comanda y todavia no
                        // se guarda.
                        ticket.generado
                            ? { text: 'papel guardado', tone: 'b-blue' }
                            : (ticket.grupo === 'ivaGenerado'
                                ? { text: 'propuesta', tone: 'b-yellow' }
                                : { text: 'consumo real', tone: 'b-gray' }),
                        // El ajuste que se paso del tope se ve sin leer la nota: es
                        // el mismo aviso que lleva la fila en el listado.
                        ...(ticket.fueraTolerancia ? [{ text: `Descuento ${ticket.descuento}`, tone: 'b-yellow' }] : [])
                      ]
                    : []
            }
        });

        this.noteBox({
            parent: 'detailNote',
            class:  'text-[10px] text-gray-400 text-center',
            json: {
                icon: '',
                text: ticket ? this.previewNote(ticket) : (motivo || 'Selecciona un ticket de la lista para armar su ticket virtual.')
            }
        });
    }

    // El copy depende de que papel se esta viendo:
    //
    //   cero         inventado con productos de tasa 0%, explica el cuadre.
    //   ivaGenerado  inventado con el catalogo de IVA, para la venta que llego sin
    //                comanda: explica de donde salieron los renglones y su desglose.
    //   real         el consumo que trajo el POS, explica solo el desglose.
    previewNote(ticket) {
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

        const iconHtml   = opts.json.icon ? `<i data-lucide="${esc(opts.json.icon)}" class="${opts.json.iconClass}"></i>` : '';
        const badgesHtml = (opts.json.badges || [])
            .map(b => `<span class="badge-base ${esc(b.tone || 'b-gray')}">${esc(b.text)}</span>`)
            .join('');

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html(`
            <h3 class="${opts.classes.title}">${iconHtml}${esc(opts.json.title)}</h3>
            <div class="flex items-center gap-2">${badgesHtml}</div>
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
    }

    viewHeader(options) {
        const defaults = {
            parent: 'root',
            id:     'viewHeader',
            class:  'flex items-center justify-between w-full',
            json:   { title: '', titleHtml: '', subtitle: '', toggles: [], back: null },
            classes: {
                title:    'text-lg font-bold text-white',
                subtitle: 'text-xs text-gray-400',
                groupLbl: 'text-[9px] text-gray-400 uppercase tracking-wider font-bold',
                btn:      'demo-toggle px-2.5 py-1 rounded text-[11px] border border-[#374151] text-gray-400 hover:bg-[#1F2A37] transition-colors',
                btnActive:'demo-toggle active px-2.5 py-1 rounded text-[11px] border border-blue-400 bg-[rgba(28,100,242,0.12)] text-blue-300',
                sep:      'text-gray-300',
                backBtn:  'w-8 h-8 rounded-full bg-[#1F2A37] hover:bg-[rgba(28,100,242,0.12)] border border-[#374151] hover:border-blue-400 flex items-center justify-center text-gray-400 hover:text-blue-300 transition-colors flex-shrink-0'
            },
            onToggle: () => { },
            onBack:   null
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const state = {};
        (opts.json.toggles || []).forEach(g => { state[g.key] = g.value; });

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const toggleGroup = (g) => {
            const buttons = (g.options || []).map(op => {
                const active = state[g.key] === op.value;
                return `<button type="button"
                                data-toggle-key="${esc(g.key)}"
                                data-toggle-value="${esc(op.value)}"
                                class="${active ? opts.classes.btnActive : opts.classes.btn}">${esc(op.label)}</button>`;
            }).join('');
            return `
                <div class="flex items-center gap-2">
                    <span class="${opts.classes.groupLbl}">${esc(g.label)}</span>
                    ${buttons}
                </div>
            `;
        };

        const backCfg   = opts.json.back;
        const backHref  = typeof backCfg === 'string' ? backCfg : (backCfg && backCfg.href) || '';
        const backTitle = (backCfg && backCfg.title) || 'Regresar';
        const backHtml  = backCfg ? `
            <button type="button" id="${opts.id}_back" class="${opts.classes.backBtn}" title="${esc(backTitle)}">
                <i data-lucide="chevron-left" class="w-4 h-4"></i>
            </button>
        ` : '';

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        const togglesHtml = (opts.json.toggles || [])
            .map((g, i, arr) => toggleGroup(g) + (i < arr.length - 1 ? `<span class="${opts.classes.sep}">|</span>` : ''))
            .join('');

        wrap.html(`
            <div class="flex items-center gap-3">
                ${backHtml}
                <div>
                    <h1 class="${opts.classes.title}">${opts.json.titleHtml || esc(opts.json.title)}</h1>
                    ${opts.json.subtitle ? `<p class="${opts.classes.subtitle}">${esc(opts.json.subtitle)}</p>` : ''}
                </div>
            </div>
            <div class="flex items-center gap-4">
                ${togglesHtml}
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

        wrap.on('click', '[data-toggle-key]', (e) => {
            const $btn = $(e.currentTarget);
            const key  = $btn.attr('data-toggle-key');
            const val  = $btn.attr('data-toggle-value');
            state[key] = val;

            $btn.siblings('[data-toggle-key="' + key + '"]').addBack().each(function () {
                const isActive = $(this).attr('data-toggle-value') === val;
                this.className = isActive ? opts.classes.btnActive : opts.classes.btn;
            });

            opts.onToggle(key, val, Object.assign({}, state));
        });

        if (backCfg) {
            $(`#${opts.id}_back`).on('click', () => {
                if (typeof opts.onBack === 'function') return opts.onBack();
                if (backHref) window.location.href = backHref;
            });
        }
    }

    viewFooter(options) {
        const defaults = {
            parent: 'root',
            id:     'viewFooter',
            class:  'flex items-center justify-between w-full',
            json:   { info: '', legends: [] },
            tones: {
                default: '#9CA3AF',
                success: 'var(--cs-success,#3FC189)',
                warning: 'var(--cs-warning,#FBBF24)',
                danger:  'var(--cs-danger,#E02424)',
                info:    'var(--cs-info,#1C64F2)',
                purple:  'var(--cs-accent-purple,#7C3AED)'
            },
            classes: {
                info:   'text-[10px] text-gray-400',
                legend: 'flex items-center gap-3 text-[10px] text-gray-400',
                item:   'flex items-center gap-1'
            }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.tones   = Object.assign({}, defaults.tones,   o.tones   || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const toneColor  = (tone) => opts.tones[tone] || opts.tones.default;
        const legendItem = (lg) => `
            <span class="${opts.classes.item}">
                <span class="w-2 h-2 rounded-full" style="background:${toneColor(lg.tone)};"></span>
                ${esc(lg.label)}
            </span>
        `;

        const wrap = $('<div>', { id: opts.id, class: opts.class });
        const legendsHtml = (opts.json.legends || []).map(legendItem).join('');

        wrap.html(`
            <p id="${opts.id}_info" class="${opts.classes.info}">${esc(opts.json.info)}</p>
            <div class="${opts.classes.legend}">${legendsHtml}</div>
        `);

        $(`#${opts.parent}`).html(wrap);
    }
}
