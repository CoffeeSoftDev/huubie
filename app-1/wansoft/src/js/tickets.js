let apiTickets = '/app/wansoft/ctrl/ctrl-facture2-tickets.php';
let app, tickets, ticketsView;

const apiCargas = '/app/wansoft/ctrl/ctrl-facture2-cargas.php';

const UPLOAD_TAB   = 'sales-report';
const COMMANDS_TAB = 'commands';

const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

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
        this.metaOkDia    = null;
    }

    async init() {
        this.dataInit = await useFetch({ url: apiTickets, data: { opc: 'init', dia: this.getParam('dia') } });
        this.meta     = this.loadMeta();

        this.hideTitleOnPrint();
        this.render();
        this.bindGotoFolio();
    }

    // -- Salto a un folio reasignado --

    // Un solo manejador para los badges de la tabla y los folios del aviso de
    // mudados: ambos llevan data-goto-folio.
    bindGotoFolio() {
        $(document).on('click', '[data-goto-folio]', (e) => {
            e.stopPropagation();
            this.goToFolio($(e.currentTarget).attr('data-goto-folio'));
        });
    }

    // Muestra la fila del folio y abre su ticket igual que un clic sobre ella.
    goToFolio(folio) {
        const celda = $(`#tb${this.PROJECT_NAME} [data-folio="${folio}"]`);

        if (!celda.length) {
            this.alertBox({ type: 'message', title: `El folio ${folio} no está en la lista de este día` });
            return;
        }

        const fila = celda.closest('tr');

        fila[0].scrollIntoView({ block: 'center', behavior: 'smooth' });

        const accion = fila.find('td:last-child a').first();

        if (accion.length) accion.trigger('click');
        else this.selectTicket(folio);
    }

    // -- Ancho del panel del ticket --

    static get PANEL_MIN() { return 380; }
    static get PANEL_MAX() { return 720; }
    static get PANEL_DEF() { return 420; }

    panelKey() {
        return `facture:detailWidth:${this.PROJECT_NAME}`;
    }

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

        tirador.addEventListener('dblclick', () => this.aplicarAncho(App.PANEL_DEF, true));
    }

    // -- Meta de facturacion --

    loadMeta() {
        const base = {
            modo:  'pct',
            valor: this.dataInit.metaPct,
            cero:  100 - this.dataInit.metaPct
        };

        try {
            const guardado = JSON.parse(localStorage.getItem(META_KEY));

            if (guardado && (guardado.modo === 'pct' || guardado.modo === 'monto') && guardado.valor >= 0) {
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

        const detailResizer = {
            type:  'button',
            id:    'detailResizer'
        };

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

    // Los anchos y el orden de la fila los pone wansoft-theme.css (#filterBarTickets):
    // la rejilla de doce columnas no da para cuatro botones iguales.
    filterBar() {
        const filters = [
            {
                opc:      'input',
                id:       'fDia',
                lbl:      'Dia:',
                type:     'date',
                class:    'ws-bar-dia',
                value:    this.dataInit.dia,
                required: false,
                onchange: 'app.onChangeFilters()'
            },
            {
                opc:       'button',
                id:        'btnCargarVentas',
                text:      'Subir ventas',
                color_btn: 'light',
                class:     'ws-bar-paso',
                className: 'ws-paso',
                onClick:   () => app.openUploadModal()
            },
            {
                opc:       'button',
                id:        'btnGenerarTodos',
                text:      'Generar tickets',
                color_btn: 'light',
                class:     'ws-bar-paso',
                className: 'ws-paso',
                onClick:   () => tickets.startGenerate()
            },
            {
                opc:       'button',
                id:        'btnImprimirTodos',
                text:      'Imprimir tickets',
                color_btn: 'light',
                class:     'ws-bar-paso',
                className: 'ws-paso',
                onClick:   () => tickets.imprimir()
            },
            {
                opc:       'button',
                id:        'btnVerMes',
                text:      'Ver mes',
                color_btn: 'light',
                class:     'ws-bar-paso',
                className: 'ws-paso',
                onClick:   () => tickets.showMonth()
            },
            {
                opc:       'button',
                id:        'btnMetaConfig',
                text:      '',
                color_btn: 'light',
                class:     'ws-bar-meta',
                className: 'ws-meta-link',
                onClick:   () => app.openMetaModal()
            }
        ];

        this.createfilterBar({
            parent:     'filterBar',
            id:         'filterBarTickets',
            coffeesoft: true,
            theme:      FACTURE_THEME,
            data:       filters
        });

        this.decorateMetaButton();
        this.decorateStepButtons();
        this.syncActionButtons();
    }

    decorateStepButtons() {
        this.stepContent('btnCargarVentas', 'Subir ventas', 'upload');

        this.generarCompleto = false;
    }

    // El icono va antes del texto: el de subir en verde Excel y la palomita del
    // paso cumplido en el color del boton.
    stepContent(id, texto, icono) {
        const boton = $(`#${id}`).empty();

        if (icono) boton.append($('<i>', { 'data-lucide': icono, class: icono === 'upload' ? 'w-4 h-4 ws-ico-excel' : 'w-4 h-4' }));

        boton.append($('<span>', { text: texto }));

        if (window.lucide) lucide.createIcons();
    }

    // La barra sigue al mes del dia elegido. «Generar tickets» va en azul mientras
    // falten dias por repartir y pasa a «Tickets generados» con el mes completo; aun
    // asi abre su ventana, que es donde se rehace un dia. «Imprimir tickets» toma el
    // azul cuando ya no falta nada. «Ver mes» e «Imprimir tickets» se apagan, no se
    // esconden, mientras el mes no tenga nada generado: con la fila pegada a la
    // derecha, esconder uno movia de lugar a los demas.
    syncActionButtons() {
        const mes      = this.dataMes || {};
        const completo = mes.dias > 0 && mes.pendientes === 0;

        if (this.generarCompleto !== completo) {
            this.generarCompleto = completo;

            this.stepContent('btnGenerarTodos', completo ? 'Tickets generados' : 'Generar tickets', completo ? 'check' : null);
        }

        $('#btnGenerarTodos')
            .prop('disabled', !mes.dias)
            .toggleClass('ws-paso-sig', mes.pendientes > 0)
            .toggleClass('ws-paso-hecho', completo);

        $('#btnImprimirTodos')
            .prop('disabled', !mes.generados)
            .toggleClass('ws-paso-sig', completo);

        $('#btnVerMes').prop('disabled', !mes.generados);
    }

    // -- Sello de impresion --

    // El sello llega al imprimir: se pinta sin recargar la tabla, para no perder el
    // ticket que el usuario tiene abierto.
    aplicaSello(sello) {
        this.dataSello = sello || null;

        ticketsView.renderStats(this.dataKpis || {}, this.dataCounts || {});
        this.syncActionButtons();
    }

    // -- Dia sin datos --

    // Un dia sin ventas no apaga la barra: el mes puede tener otros dias por generar
    // o por imprimir. Sin respuesta del servidor no hay mes, y los pasos se apagan.
    emptyDay(data) {
        $('#statsRow').hide();

        if (this.selectedId) this.selectTicket(null);

        ticketsView.renderCutNote(null);
        ticketsView.renderMudadosLink([]);

        this.dataKpis    = {};
        this.dataCounts  = {};
        this.dataSello   = null;
        this.dataMudados = [];
        this.dataMes     = (data && data.mes) || null;

        this.syncActionButtons();
        this.updateFooterInfo('');
        this.syncMetaButton();
    }

    // `lock` pide el dia sin reparto mientras no se haya generado: el servidor
    // manda los hechos del POS y deja el resto bajo llave. Viaja en todas las
    // peticiones porque el filtro es uno solo, pero unicamente lsTickets lo mira, y
    // el dia ya generado lo ignora: ahi las tasas son un hecho, no una propuesta.
    getFilters() {
        return {
            dia:       $('#fDia').val() || this.dataInit.dia,
            lock:      1,
            metaModo:  this.meta.modo,
            metaValor: this.meta.valor,
            metaCero:  this.meta.cero
        };
    }

    // -- Event handlers --

    async onChangeFilters() {
        // El acuerdo del 16%/0% es de un dia, no del modulo: al mover el filtro deja
        // de estar confirmado y el proximo Generar vuelve a pedirlo.
        this.metaOkDia = null;

        await tickets.lsTickets();

        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectTicket(null);
        }
    }

    isVisibleAfterFilters(folio) {
        return $(`#tb${this.PROJECT_NAME} [data-folio="${folio}"]`).length > 0;
    }

    // -- Distribucion IVA 16% / IVA 0% --

    // `alAplicar` es el paso que sigue cuando el modal se abrio como puerta del
    // cierre (12-13 antes de 14) y no desde el engrane de la barra.
    openMetaModal(alAplicar) {
        if (this.metaModal) return;

        this.metaNext    = alAplicar || null;
        this.metaTouched = { valor: true, cero: false };

        this.metaModal = this.cfModal({
            title:         'Distribución IVA 16% / IVA 0%',
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
                    lbl:      this.rotuloMeta(16, this.meta.modo),
                    type:     'number',
                    tipo:     'numero',
                    class:    'col-12 col-sm-6',
                    value:    this.meta.valor,
                    required: false
                },
                {
                    opc:      'input',
                    id:       'fMetaCero',
                    lbl:      this.rotuloMeta(0, this.meta.modo),
                    type:     'number',
                    tipo:     'numero',
                    class:    'col-12 col-sm-6',
                    value:    this.metaCeroValor(),
                    required: false
                }
            ]
        });

        $('#fMetaValor').on('input', () => this.onInputMeta('valor'));
        $('#fMetaCero').on('input',  () => this.onInputMeta('cero'));

        this.renderMetaPreview();
    }

    metaCeroValor() {
        if (this.meta.cero !== undefined && this.meta.cero !== '') return this.meta.cero;

        const total = parseFloat(this.dataKpis.total) || 0;
        const valor = parseFloat(this.meta.valor) || 0;

        if (this.meta.modo === 'monto') return Math.max(0, Math.round((total - valor) * 100) / 100);

        return Math.round((100 - valor) * 100) / 100;
    }

    // El campo que todavia no se toca sigue al otro; en cuanto se tocan los dos,
    // ninguno se autocompleta y pueden no cuadrar, que es lo que la validacion
    // atrapa.
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

    // El rotulo dice que se escribe: en porcentaje un "70" no es un monto, y
    // "Monto IVA 16%" con un 70 adentro se leia como setenta pesos.
    rotuloMeta(tasa, modo) {
        return `IVA ${tasa}% (${modo === 'monto' ? '$' : '%'}):`;
    }

    onChangeMetaModo() {
        const modo  = $('#fMetaModo').val();
        const total = parseFloat(this.dataKpis.total) || 0;

        $('label[for$="fMetaValor"]').text(this.rotuloMeta(16, modo));
        $('label[for$="fMetaCero"]').text(this.rotuloMeta(0, modo));

        const convertir = (v) => modo === 'monto'
            ? total * v / 100
            : (total > 0 ? v / total * 100 : this.dataInit.metaPct);

        const valor = parseFloat($('#fMetaValor').val()) || 0;
        const cero  = parseFloat($('#fMetaCero').val())  || 0;

        $('#fMetaValor').val(Math.round(convertir(valor) * 100) / 100);
        $('#fMetaCero').val(Math.round(convertir(cero) * 100) / 100);

        this.renderMetaPreview();
    }

    renderMetaPreview() {
        const total = parseFloat(this.dataKpis.total) || 0;
        const modo  = $('#fMetaModo').val();

        const enPesos = (v) => modo === 'monto' ? v : total * v / 100;

        const monto16 = enPesos(parseFloat($('#fMetaValor').val()) || 0);
        const monto0  = enPesos(parseFloat($('#fMetaCero').val())  || 0);
        const suma    = monto16 + monto0;
        const dif     = suma - total;

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
            sugerido:     !this.metaTouched.cero ? '0' : (!this.metaTouched.valor ? '16' : '')
        });
    }

    lockMetaOk(bloquear) {
        if (!this.metaModal) return;

        this.metaModal.footer.find('button').last()
            .prop('disabled', bloquear)
            .toggleClass('opacity-50 cursor-not-allowed', bloquear);
    }

    async applyMeta() {
        const valor = parseFloat($('#fMetaValor').val());
        const cero  = parseFloat($('#fMetaCero').val());

        this.meta = {
            modo:  $('#fMetaModo').val(),
            valor: isNaN(valor) || valor < 0 ? 0 : valor,
            cero:  isNaN(cero)  || cero  < 0 ? 0 : cero
        };

        this.saveMeta();

        // Queda confirmado para este dia: la propuesta ya no vuelve a preguntarlo.
        this.metaOkDia = this.getFilters().dia;

        const seguir = this.metaNext;

        this.metaNext = null;

        this.metaModal.close();

        await tickets.lsTickets();

        if (seguir) seguir();
    }

    // La puerta del paso 14: sin acuerdo capturado el servidor repartiria con el
    // META_FACTURACION del sistema y nadie se enteraria de que hubo un default.
    conMeta(accion) {
        if (this.metaOkDia === this.getFilters().dia) return accion();

        this.openMetaModal(accion);
    }

    // -- Subir ventas del POS --

    openUploadModal() {
        if (this.uploadModal) return;

        this.uploadFiles       = [];
        this.progressTimer     = null;
        this.progressFrom      = 0;
        this.mesesElegidos     = null;
        this.mesesPermitidos   = null;
        this.repartoConfirmado = false;

        this.cargasHechas = [];

        this.pendienteTab = null;
        this.periodosTab  = {};

        this.uploadModal = this.cfModal({
            title:         'Subir ventas del POS',
            size:          'large',
            theme:         FACTURE_THEME,
            okLabel:       'Subir ventas',
            cancelLabel:   'Cancelar',
            closeButton:   false,
            backdropClose: false,
            onOk:          () => this.sendUpload(),
            onClose:       () => { this.stopProgress(); this.uploadModal = null; }
        });

        this.createLayout({
            parent: this.uploadModal.body.attr('id') || this.uploadModalHost(),
            design: false,
            data: {
                id:        'uploadModalBox',
                class:     'h-[22rem] flex flex-col overflow-y-auto overflow-x-hidden scroll-thin',
                container: [
                    {
                        type: 'div',
                        id:   'uploadModalDrop'
                    },
                    {
                        type: 'div',
                        id:   'uploadModalFiles'
                    },
                    {
                        type: 'div',
                        id:   'uploadModalState'
                    }
                ]
            }
        });

        // Sin selector: el mes arranca en el del dia de Tickets y lo cambia el
        // archivo al revisarse.
        const hoy = new Date(this.dataInit.dia + 'T00:00:00');

        this.periodoUpload = { mes: hoy.getMonth() + 1, anio: hoy.getFullYear() };

        this.renderUploadList();

        this.loadPeriodFiles();
    }

    async loadPeriodFiles() {
        this.periodosTab = this.periodosTab || {};

        for (const slot of this.uploadSlots()) {
            const data = await useFetch({
                url:  apiCargas,
                data: {
                    opc: 'lsPeriodosCargados',
                    tab: slot.tipo
                }
            });

            this.periodosTab[slot.tipo] = (data && data.periodos) || [];
        }

        this.showPeriodFiles();

        this.renderUploadList();
    }

    showPeriodFiles() {
        if (!this.uploadModal) return;

        ticketsView.renderPeriodFiles(
            this.uploadSlots().map((s) => ({
                slot:    s,
                cargado: this.slotCargado(s.tipo),
                carga:   (this.cargasHechas || []).find((c) => c.slot.tipo === s.tipo) || null
            })),
            this.periodoTexto()
        );
    }

    uploadModalHost() {
        this.uploadModal.body.attr('id', 'uploadModalBody');

        return 'uploadModalBody';
    }

    // -- Los dos archivos del dia --

    uploadSlots() {
        return [
            {
                tipo:     UPLOAD_TAB,
                nombre:   'Reporte de ventas',
                archivo:  'ReporteVentasPorFormaDePago',
                desglosa: 'Trae los folios, los montos y la forma de cobro del día'
            },
            {
                tipo:     COMMANDS_TAB,
                nombre:   'Detalle de ventas',
                archivo:  'ReporteDetalleDeVentas',
                desglosa: 'Desglosa las ventas: sin él los tickets del 16% dicen CONSUMO'
            }
        ];
    }

    slotDelNombre(fileName) {
        const raiz = (txt) => String(txt || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const name = raiz(fileName);

        return this.uploadSlots().find((s) => name.indexOf(raiz(s.archivo)) === 0) || null;
    }

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

    renderUploadList() {
        const puestos = this.uploadFiles.map((f) => this.slotDelNombre(f.name));

        const faltan = this.slotsQueFaltan(puestos);
        const lleno  = !faltan.length;

        this.mesesElegidos     = null;
        this.repartoConfirmado = false;
        this.revisadosPrevios  = null;

        this.setUploadAction('Subir ventas', () => this.sendUpload());
        this.setUploadCancel(null);

        $('#uploadModalFiles').show();
        $('#uploadModalDrop').show().css({ opacity: '', 'pointer-events': '' });

        const falta = this.slotFaltante(puestos);

        ticketsView.renderPickedFiles(
            this.uploadFiles.map((f, i) => ({
                nombre: f.name,
                peso:   this.fileSizeText(f.size),
                slot:   (puestos[i] || {}).nombre || ''
            })),
            lleno,
            falta
        );

        ticketsView.renderUploadHint(
            this.uploadFiles.length,
            this.uploadSlots(),
            this.slotsPendientes(),
            falta,
            faltan.length
        );

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
        return this.periodoUpload;
    }

    periodoTexto(periodo) {
        const p = periodo || this.periodoUpload;

        return `${MESES[p.mes - 1]} ${p.anio}`;
    }

    // Revisar, confirmar el mes y cargar, en ese orden: inspectFile lee el libro SIN
    // guardar nada y de ahi salen su pestaña y su mes —los decide el CONTENIDO, no
    // el nombre ni la pantalla—. Las ventas se suben antes que las comandas, que
    // cuelgan de sus folios.
    async sendUpload() {
        if (!this.uploadFiles.length) return;

        this.lockUploadOk(true);

        const revisados = (this.repartoConfirmado && this.revisadosPrevios) || [];

        for (const file of (revisados.length ? [] : this.uploadFiles)) {
            ticketsView.renderUploadStep(`Revisando ${file.name}...`);

            const porNombre = this.slotDelNombre(file.name);
            const revision  = await this.postFile('inspectFile', { mes: 0, anio: 0 }, (porNombre || {}).tipo || UPLOAD_TAB, file);

            if (!revision || revision.status !== 200) {
                ticketsView.renderUploadError(
                    (revision && revision.message) ||
                    `No se pudo leer ${file.name}: el servidor no devolvió una respuesta. Suele pasar con archivos muy grandes.`
                );
                this.lockUploadOk(false);
                return;
            }

            const destino = revision.destino || UPLOAD_TAB;
            const slot    = this.uploadSlots().find((x) => x.tipo === destino);

            const mudado = UploadCheck.mueve(revision.validacion) && !!slot;

            if (revision.validacion && !mudado) {
                return this.rejectUpload(revision.validacion, file.name, destino);
            }

            if (!slot) {
                ticketsView.renderUploadError(`${file.name} no es el reporte de ventas ni el detalle de ventas: súbelo desde Importación.`);
                this.lockUploadOk(false);
                return;
            }

            if (revisados.some((r) => r.destino === destino)) {
                ticketsView.renderUploadError(`Elegiste dos veces el ${slot.nombre.toLowerCase()}: falta el otro archivo.`);
                this.lockUploadOk(false);
                return;
            }

            revisados.push({
                file:    file,
                destino: destino,
                slot:    slot,
                reparto: revision.reparto || [],
                periodo: revision.periodo || null
            });
        }

        if (!this.repartoConfirmado) return this.confirmarMes(revisados);

        this.repartoConfirmado = false;
        this.revisadosPrevios  = null;

        revisados.sort((a, b) => (a.destino === UPLOAD_TAB ? -1 : 1));

        for (const item of revisados) {
            ticketsView.renderUploadStep(`Subiendo ${item.file.name}...`, this.fileSizeText(item.file.size));

            await this.watchProgress(item);

            const carga = await this.postFile('uploadFile', this.periodoDeCarga(item), item.destino, item.file);

            this.stopProgress();

            if (carga.status !== 200) {
                if (carga.validacion) return this.rejectUpload(carga.validacion, item.file.name, item.destino);

                ticketsView.renderUploadError(carga.message || `No se pudo procesar ${item.file.name}`);
                this.lockUploadOk(false);
                return;
            }

            this.anotarCarga(item.slot, carga, this.periodoDeCarga(item), this.mesesSubidos(item));
        }

        // El mes de la subida es el del reporte de ventas: con sus ventas se reparte
        // y de sus folios cuelgan las comandas. Antes mandaba el del primer archivo
        // elegido, y si ese era el detalle el alcance miraba otro mes y salia «Listo».
        const base    = revisados.find((r) => r.destino === UPLOAD_TAB) || revisados[0];
        const cargado = this.periodoDeCarga(base);

        this.setUploadPeriod(cargado.mes, cargado.anio);

        ticketsView.renderUploadDone(this.cargasHechas, this.slotsPendientes());

        await tickets.lsTickets();

        const alcance    = await this.scopeDelPeriodo();
        const porGenerar = !!alcance && alcance.pendientes > 0;

        if (porGenerar) ticketsView.renderUploadInvite(alcance);

        // Con un archivo del periodo sin subir el boton queda apagado (abajo) y dice
        // lo que sigue despues de subirlo, no «Listo».
        if (porGenerar || this.slotsPendientes().length > 0) {
            this.setUploadAction('Generar tickets', () => porGenerar && this.abreScope(alcance));
        } else {
            this.setUploadAction('Listo', () => this.uploadModal.close());
        }

        this.setUploadCancel(null);

        // Con un archivo del periodo sin subir no se continua: se sube desde el
        // aviso de lo que falta.
        this.lockUploadOk(this.slotsPendientes().length > 0);
    }

    // El mes sale del archivo y aqui solo se confirma. El archivo que trae varios
    // meses pregunta cuales subir.
    confirmarMes(revisados) {
        this.revisadosPrevios = revisados;

        const antes     = this.periodoUpload;
        const detectado = revisados.map((r) => r.periodo).find(Boolean);

        if (detectado) this.setUploadPeriod(detectado.mes, detectado.anio);

        this.setUploadCancel(() => this.backToPick());

        // Lo ya subido en este modal tambien cuenta: el archivo que faltaba se sube
        // despues, desde su aviso, y tiene que ser del mismo mes que el otro.
        const subidos = (this.cargasHechas || [])
            .filter((c) => c.periodo && !revisados.some((r) => r.destino === c.slot.tipo))
            .map((c) => ({
                slot:    c.slot,
                periodo: { mes: c.periodo.mes, anio: c.periodo.anio, texto: this.periodoTexto(c.periodo) },
                reparto: [],
                meses:   c.meses
            }));

        const archivos = revisados.concat(subidos);

        const meses = archivos
            .map((r) => (r.periodo || {}).texto || this.periodoTexto())
            .filter((m, i, todos) => todos.indexOf(m) === i);

        // El detalle se liga a los folios del reporte: si no comparten ni un mes no
        // se encuentran y las comandas quedan sueltas. No se sube; con «Volver» se
        // quita el que no corresponde.
        //
        // Basta un mes en comun, no el mismo mes con mas movimientos: un export que
        // cruza de mes trae los dos, y el reporte cuenta pagos y el detalle
        // renglones, asi que cada uno puede salir con un mes mayoritario distinto.
        const comunes = archivos
            .map((a) => a.meses || this.mesesDelArchivo(a))
            .reduce((acc, ms) => acc.filter((m) => ms.indexOf(m) >= 0));

        if (!comunes.length) {
            ticketsView.renderPeriodoDetectado(archivos, meses, true);
            this.lockUploadOk(true);

            // Al volver, el modal sigue en el mes que tenia: el de este archivo no
            // se subio.
            this.periodoUpload = antes;

            return;
        }

        this.mesesPermitidos = this.mesesPermitidosDelDetalle(revisados);

        const conVariosMeses = revisados.find((r) => this.mesesDelReparto(r.reparto).length > 1);

        if (conVariosMeses) {
            ticketsView.renderRepartoPrevio(conVariosMeses);

            // Los meses sin reporte nacen desmarcados: lo normal es subir el detalle
            // del mes que ya se subio.
            const permitidos = this.mesesPermitidos;

            if (permitidos) {
                $('#uploadModalState .chk-mes').each(function () {
                    if (permitidos.indexOf(this.value) < 0) this.checked = false;
                });
            }

            this.syncSeleccion({ reparto: conVariosMeses.reparto });

            return;
        }

        ticketsView.renderPeriodoDetectado(revisados, meses, false);

        this.setUploadAction(meses.length === 1 ? `Subir ${meses[0]}` : 'Subir los archivos', () => this.confirmarPeriodo());
        this.lockUploadOk(false);
    }

    // Los meses que trae un archivo, como claves «2026-07». Salen del reparto de su
    // revision; sin reparto, del mes que se le detecto.
    mesesDelArchivo(r) {
        const traen = this.mesesDelReparto(r.reparto).map((m) => UploadCheck.claveDeMes(m));

        if (traen.length) return traen;

        return [UploadCheck.claveDeMes(r.periodo || this.periodoUpload)];
    }

    // Los meses que de verdad entraron de un archivo: los marcados en el reparto,
    // o todos los que trae si no hubo que elegir.
    mesesSubidos(item) {
        const traen    = this.mesesDelArchivo(item);
        const elegidos = this.mesesElegidos || [];
        const marcados = traen.filter((m) => elegidos.indexOf(m) >= 0);

        return marcados.length ? marcados : traen;
    }

    confirmarPeriodo() {
        this.repartoConfirmado = true;

        return this.sendUpload();
    }

    // Cada archivo viaja con su mes. Si ese mes se desmarco, con el primero que
    // quedo marcado.
    periodoDeCarga(item) {
        const periodo  = item.periodo || this.uploadPeriod();
        const elegidos = this.mesesElegidos || [];

        if (!elegidos.length || elegidos.indexOf(UploadCheck.claveDeMes(periodo)) >= 0) return periodo;

        const partes = elegidos[0].split('-');

        return { mes: Number(partes[1]), anio: Number(partes[0]) };
    }

    async scopeDelPeriodo() {
        const periodo = this.uploadPeriod();

        if (!periodo.mes || !periodo.anio) return null;

        const mes = `${periodo.anio}-${String(periodo.mes).padStart(2, '0')}`;

        const data = await useFetch({
            url:  apiTickets,
            data: Object.assign({ opc: 'scopeMonth', mes: mes }, this.getFilters())
        });

        return data.status === 200 ? data : null;
    }

    // Desde la subida tambien se pasa por la meta: el 16% y el 0% se capturan antes
    // de pedir propuesta, se llegue a generar por el boton de la barra o por aqui.
    // Antes este camino saltaba directo al alcance y repartia con la meta que
    // hubiera quedado guardada en el navegador.
    //
    // La meta se captura sobre el total del dia del filtro, y recien subido el
    // archivo ese filtro suele estar en un dia sin ventas —hoy—: el modal pediria
    // repartir $0.00. Por eso primero se mueve al primer dia pendiente del periodo,
    // el mismo que el alcance propone.
    async abreScope(info) {
        this.uploadModal.close();

        const primero = (info.dias || []).find((d) => d.sinRepartir);

        if (primero && primero.dia !== this.getFilters().dia) {
            $('#fDia').val(primero.dia);

            await this.onChangeFilters();
        }

        this.conMeta(() => this.openScopeModal(info));
    }

    // Cada carga guarda el mes con el que se subio —la tarjeta del resultado dice el
    // de su archivo, no el general del modal— y los meses que de verdad entraron,
    // contra los que se compara el archivo que se suba despues.
    anotarCarga(slot, data, periodo, meses) {
        this.cargasHechas = (this.cargasHechas || []).filter((c) => c.slot.tipo !== slot.tipo);

        this.cargasHechas.push({ slot: slot, data: data, periodo: periodo || null, meses: meses || null });
    }

    slotsQueFaltan(puestos) {
        const traidos = (puestos || []).filter(Boolean);

        return this.uploadSlots().filter((s) =>
            !traidos.some((p) => p.tipo === s.tipo) && !this.slotCargado(s.tipo)
        );
    }

    slotFaltante(puestos) {
        const traidos = (puestos || []).filter(Boolean);

        if (!this.uploadFiles.length || traidos.length !== this.uploadFiles.length) return null;

        return this.slotsQueFaltan(puestos)[0] || null;
    }

    slotsPendientes() {
        return this.uploadSlots().filter((s) => !this.slotCargado(s.tipo));
    }

    // Lo subido en este modal cuenta solo para sus meses: el reporte de julio no
    // completa el par de agosto. Antes bastaba con haberlo subido, y un detalle de
    // agosto tras un reporte de julio terminaba en «Listo».
    slotCargado(tipo) {
        const periodo = this.uploadPeriod();
        const clave   = UploadCheck.claveDeMes(periodo);

        if ((this.cargasHechas || []).some((c) => c.slot.tipo === tipo && (!c.meses || c.meses.indexOf(clave) >= 0))) return true;

        const meses   = (this.periodosTab || {})[tipo] || [];

        return meses.some((p) => Number(p.mes) === Number(periodo.mes) && Number(p.anio) === Number(periodo.anio));
    }

    async retomarUpload(tipo) {
        this.uploadFiles  = [];
        this.pendienteTab = tipo || null;

        this.renderUploadList();

        if (!tipo) return;

        const data = await useFetch({ url: apiCargas, data: { opc: 'lsPeriodosCargados', tab: tipo } });

        this.periodosTab        = this.periodosTab || {};
        this.periodosTab[tipo]  = (data && data.periodos) || [];

        this.showPeriodFiles();
    }

    rejectUpload(v, fileName, destino) {
        this.mesesPermitidos = null;

        ticketsView.renderUploadRejected(v, fileName, destino);
        this.lockUploadOk(false);
        this.setUploadCancel(() => this.backToPick());

        if (!UploadCheck.mudaPeriodo(v)) {
            return this.setUploadAction('Subir otro archivo', () => this.subirOtroArchivo(fileName));
        }

        this.syncSeleccion(v);
    }

    // El archivo rechazado sale de la lista y se abre el selector para elegir el
    // que va en su lugar.
    subirOtroArchivo(fileName) {
        this.uploadFiles = this.uploadFiles.filter((f) => f.name !== fileName);

        this.renderUploadList();

        $('#fUpFile').trigger('click');
    }

    mesesDelReparto(reparto) {
        return (reparto || []).filter((m) => m.movimientos > 0);
    }

    confirmarReparto() {
        if (!(this.mesesElegidos || []).length || this.mesesSinReporte().length) return;

        this.repartoConfirmado = true;

        return this.sendUpload();
    }

    syncSeleccion(v) {
        const elegidos = UploadCheck.mesesMarcados('#uploadModalState');

        $('#uploadModalState .chk-mes').each(function () {
            $(this).closest('tr').toggleClass('chk-off', !this.checked);
        });

        this.mesesElegidos = elegidos;

        const accion = UploadCheck.mudaPeriodo(v)
            ? () => this.moveSeleccion()
            : () => this.confirmarReparto();

        const sinReporte = this.mesesSinReporte();

        ticketsView.renderMesesSinReporte(sinReporte, this.mesesPermitidos);

        this.setUploadAction(UploadCheck.accionMover(v, elegidos), accion);
        this.lockUploadOk(elegidos.length === 0 || sinReporte.length > 0);
    }

    // -- El detalle va con su reporte --

    // Los meses que ya tienen su reporte de ventas: los que se subieron en este
    // modal y los que la base ya tenia.
    mesesConReporte() {
        const enModal = (this.cargasHechas || [])
            .filter((c) => c.slot.tipo === UPLOAD_TAB)
            .reduce((todos, c) => todos.concat(c.meses || (c.periodo ? [UploadCheck.claveDeMes(c.periodo)] : [])), []);

        const enBase = ((this.periodosTab || {})[UPLOAD_TAB] || [])
            .map((p) => UploadCheck.claveDeMes({ mes: Number(p.mes), anio: Number(p.anio) }));

        return enModal.concat(enBase).filter((m, i, todos) => todos.indexOf(m) === i);
    }

    // Los meses del detalle que se pueden subir cuando llega sin su reporte: los que
    // ya tienen el suyo. Los dos archivos traen julio y agosto, y al subir el
    // detalle despues del reporte de julio era facil marcar agosto: se guardaba
    // suelto y el modal terminaba en «Listo».
    //
    // null = sin restriccion: la subida trae su propio reporte, o ningun mes del
    // detalle tiene reporte todavia. Ese ultimo es valido —llega antes que el suyo
    // y linkOrphanDetailToSale lo liga cuando entran sus ventas—.
    mesesPermitidosDelDetalle(revisados) {
        const detalle = revisados.find((r) => r.destino === COMMANDS_TAB);

        if (!detalle || revisados.some((r) => r.destino === UPLOAD_TAB)) return null;

        const conReporte = this.mesesConReporte();
        const permitidos = this.mesesDelArchivo(detalle).filter((m) => conReporte.indexOf(m) >= 0);

        return permitidos.length ? permitidos : null;
    }

    mesesSinReporte() {
        if (!this.mesesPermitidos) return [];

        return (this.mesesElegidos || []).filter((m) => this.mesesPermitidos.indexOf(m) < 0);
    }

    moveSeleccion() {
        const elegidos = this.mesesElegidos || [];

        if (!elegidos.length) return;

        this.repartoConfirmado = true;

        const primero = elegidos[0].split('-');

        return this.movePeriodTo(Number(primero[1]), Number(primero[0]));
    }

    movePeriod(v) {
        return this.movePeriodTo(v.mesArchivo, v.anioArchivo);
    }

    movePeriodTo(mes, anio) {
        this.setUploadPeriod(mes, anio);

        this.setUploadAction('Subir ventas', () => this.sendUpload());

        return this.sendUpload();
    }

    setUploadAction(texto, accion) {
        if (!this.uploadModal) return;

        this.uploadModal.footer.find('button').last()
            .text(texto)
            .off('click')
            .on('click', accion);
    }

    setUploadCancel(accion) {
        if (!this.uploadModal) return;

        const boton = this.uploadModal.footer.find('button').first();

        // El boton que regresa no cancela: se llama por lo que hace.
        boton.off('click').text(accion ? 'Volver' : 'Cancelar');

        if (accion) boton.on('click', accion);
        else        boton.on('click', () => this.confirmaSalirDeSubida());
    }

    // Sin la × del modal, Cancelar es la unica salida: pregunta antes de cerrar.
    confirmaSalirDeSubida() {
        this.swalQuestion({
            extends: true,
            opts: {
                title:             '¿Realmente quieres salir?',
                text:              'Se cierra la subida de ventas del POS.',
                icon:              'question',
                confirmButtonText: 'Sí, salir',
                cancelButtonText:  'No'
            }
        }).then((result) => {
            if (result.isConfirmed && this.uploadModal) this.uploadModal.close();
        });
    }

    backToPick() {
        this.mesesElegidos     = null;
        this.mesesPermitidos   = null;
        this.repartoConfirmado = false;
        this.revisadosPrevios  = null;

        this.renderUploadList();
        this.showPeriodFiles();
    }

    setUploadPeriod(mes, anio) {
        this.periodoUpload = { mes: Number(mes), anio: Number(anio) };
    }

    // -- Cuanto lleva guardado --

    async watchProgress(item) {
        this.stopProgress();

        const arranque = await useFetch({ url: apiCargas, data: { opc: 'ultimoLoteId' } });

        this.progressFrom = Number(arranque) || 0;

        this.progressBase = null;

        this.progressTimer = setInterval(() => this.askProgress(item), 600);

        this.askProgress(item);
    }

    stopProgress() {
        if (!this.progressTimer) return;

        clearInterval(this.progressTimer);
        this.progressTimer = null;
    }

    async askProgress(item) {
        const avance = await useFetch({
            url:  apiCargas,
            data: {
                opc:      'uploadProgress',
                fileName: item.file.name,
                desdeId:  this.progressFrom
            }
        });

        if (!this.progressTimer) return;

        if (!avance || !avance.filas) return ticketsView.renderUploadStep(...this.faseCarga(item, avance));

        ticketsView.renderUploadProgress(item.slot.nombre, this.conRitmo(avance));
    }

    faseCarga(item, avance) {
        const paso  = (avance || {}).paso || {};
        const miles = (n) => Number(n || 0).toLocaleString('en-US');

        if (paso.fase === 'columnas') {
            return [`Abriendo ${item.file.name}...`, 'Comprobando que las columnas estén donde el reporte las pone'];
        }

        if (paso.fase === 'bloque') {
            return [
                `Leyendo ${item.file.name}...`,
                `Parte ${paso.bloque} de ${paso.bloques} · ${miles(paso.leidas)} filas leídas`
            ];
        }

        if (paso.fase === 'enlaces') {
            return ['Cerrando la carga...', 'Enlazando cada renglón con su venta y su producto'];
        }

        if (avance && avance.lotes > 0) {
            return [`Guardando ${item.slot.nombre.toLowerCase()}...`, 'Escribiendo las primeras filas'];
        }

        return [
            `Leyendo ${item.file.name}...`,
            'El archivo se lee entero antes de escribir nada. Los grandes tardan un poco en abrirse.'
        ];
    }

    conRitmo(avance) {
        const total = Number(avance.total) || 0;
        const filas = Number(avance.filas) || 0;

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

    postFile(opc, periodo, tipo, file) {
        const formData = new FormData();

        formData.append('opc',         opc);
        formData.append('tipo',        tipo || UPLOAD_TAB);
        formData.append('mes',         periodo.mes);
        formData.append('anio',        periodo.anio);
        formData.append('excel_file0', file);

        const elegidos = this.mesesElegidos || [];

        if (opc === 'uploadFile' && elegidos.length) formData.append('meses', elegidos.join(','));

        return fetch(apiCargas, { method: 'POST', body: formData })
            .then(r => r.json())
            .catch(() => ({ status: 500, message: 'No se pudo leer el archivo' }));
    }

    decorateMetaButton() {
        $('#btnMetaConfig')
            .empty()
            .append($('<i>', { 'data-lucide': 'settings', class: 'w-4 h-4' }))
            .append($('<span>', { id: 'btnMetaConfig_txt' }));

        if (window.lucide) lucide.createIcons();

        this.syncMetaButton();
    }

    // El enlace dice la meta vigente —«Meta 70/30»— y el titulo la explica.
    syncMetaButton() {
        const valor = this.meta.modo === 'monto'
            ? (this.dataKpis.objetivoTexto || this.moneyText(this.meta.valor))
            : `${this.pctText(this.meta.valor)}%`;

        const texto = this.meta.modo === 'monto'
            ? `Meta ${this.moneyText(this.meta.valor)}`
            : `Meta ${this.pctText(this.meta.valor)}/${this.pctText(this.metaCeroValor())}`;

        $('#btnMetaConfig_txt').text(texto);
        $('#btnMetaConfig').attr('title', `Distribución IVA 16% / IVA 0% · al 16%: ${valor}`);
    }

    moneyText(n) {
        return '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    pctText(pct) {
        return String(Math.round((Number(pct) || 0) * 10) / 10);
    }

    updateFooterInfo(text) {
        $('#viewFooter_info').text(text);
    }

    avisoMudados() {
        if (!(this.dataMudados || []).length) return;

        ticketsView.toggleMudadosToast(this.dataMudados);
    }

    // -- Vista previa del cierre (punto 20) --

    openPreviewModal(data) {
        if (this.previewModal) return ticketsView.renderPreviewDay(data);

        if (this.scopeModal) this.scopeModal.close();

        this.previewScope    = data.mes ? 'mes' : 'dia';
        this.previewDiaSel   = null;
        this.previewSemillas = {};
        this.previewMudanzaAbierta = false;

        this.previewModal = this.cfModal({
            title:         data.mes ? `Vista previa del reparto · ${data.fechaTexto}` : 'Vista previa del reparto',
            size:          data.mes ? 'xl' : 'default',
            theme:         FACTURE_THEME,
            okLabel:       data.mes ? 'Confirmar el mes' : 'Confirmar',
            cancelLabel:   'Cancelar',
            backdropClose: false,
            onOk:          () => this.confirmPreview(),
            onClose:       () => { this.previewModal = null; }
        });

        this.previewModal.body.append($('<div>', { id: 'previewDayBody' }));

        this.decoratePreviewFooter();

        ticketsView.renderPreviewDay(data);
    }

    decoratePreviewFooter() {
        const cancelar = this.previewModal.footer.find('button').first();
        const ok       = this.previewModal.footer.find('button').last();

        ok.removeClass('bg-[#1C64F2] hover:bg-[#1a53d4]')
          .addClass('bg-[#047857] hover:bg-[#036B4A] text-white');

        if (!this.scopeInfo) return;

        // "Volver" regresa al alcance y reemplaza a "Cancelar", en el dia y en el mes:
        // Cancelar vive solo en el inicio del flujo, y para salir sin generar quedan
        // Volver y la ×. Sin alcance la propuesta es el inicio, por eso ahi se queda.
        cancelar.remove();

        const volver = $('<button>', {
            type:  'button',
            text:  '‹ Volver',
            class: 'mr-auto rounded-lg text-sm font-medium px-3 py-2 ' + (FACTURE_THEME_IS_LIGHT
                ? 'text-gray-600 hover:bg-gray-100'
                : 'text-[#9CA3AF] hover:bg-[#283341] hover:text-white')
        });

        volver.on('click', () => this.volverAlAlcance());

        this.previewModal.footer.prepend(volver);

        // En el modal de un dia los botones del pie se partian en dos renglones. Un
        // renglon cada uno y menos aire.
        this.previewModal.footer.find('button')
            .removeClass('px-4')
            .addClass('px-3 whitespace-nowrap');
    }

    volverAlAlcance() {
        const info = this.scopeInfo;

        this.previewModal.close();
        this.previewModal = null;

        this.openScopeModal(info);
    }

    // El cierre ya escribio: su unico boton extra es llevarse la hoja. Va antes del
    // Entendido para que el orden sea el del trabajo — imprimir y luego cerrar.
    decorateCierreFooter() {
        const ok = this.cierreModal.footer.find('button').last();

        ok.removeClass('bg-[#1C64F2] hover:bg-[#1a53d4]')
          .addClass('bg-[#047857] hover:bg-[#036B4A] text-white');

        const imprimir = $('<button>', {
            type:  'button',
            text:  'Imprimir tickets del día',
            class: 'rounded-lg text-sm font-medium px-4 py-2 ' + (FACTURE_THEME_IS_LIGHT
                ? 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                : 'bg-[#1a2332] text-[#9CA3AF] border border-[#374151] hover:bg-[#283341] hover:text-white')
        });

        imprimir.on('click', () => this.imprimeDiaDelCierre());

        ok.before(imprimir);
    }

    // La hoja es de un dia: se imprime la del dia que el panel tiene abierto.
    async imprimeDiaDelCierre() {
        const dia = this.previewDiaSel;

        if (!dia) return;

        $('#fDia').val(dia);

        await tickets.lsTickets();
        await tickets.printSheet();
    }

    lockPreview(bloquear) {
        if (!this.previewModal) return;

        this.previewModal.footer.find('button')
            .prop('disabled', bloquear)
            .toggleClass('opacity-50 cursor-not-allowed', bloquear);
    }

    // Regla 1: un dia a la vez. El clic reemplaza la seleccion, nunca abre un
    // segundo panel.
    selectPreviewDay(dia) {
        ticketsView.renderMonthPanel(dia);
    }

    confirmPreview() {
        this.previewModal.close();

        if (this.previewScope === 'mes') return tickets.generateMonth();

        tickets.generateDay();
    }

    // -- Alcance del cierre --

    async askScope(mes) {
        const data = await useFetch({
            url:  apiTickets,
            data: Object.assign({ opc: 'scopeMonth', mes: mes || '' }, this.getFilters())
        });

        if (data.status !== 200 || !(data.dias || []).length) {
            return tickets.previewDay();
        }

        this.openScopeModal(data);
    }

    openScopeModal(info) {
        if (this.scopeModal) return;

        this.scopeInfo = info;

        this.scopeModal = this.cfModal({
            title:         'Generar tickets',
            size:          'small',
            theme:         FACTURE_THEME,
            okLabel:       'Ver propuesta',
            cancelLabel:   'Cancelar',
            backdropClose: true,
            onOk:          () => this.applyScope(),
            onClose:       () => { this.scopeModal = null; }
        });

        // Sin scroll propio en el cuerpo: lo que trae cabe entero. En una pantalla
        // baja se desplaza el modal completo, con la barra fina, en vez de salirle una
        // barra gris al cuerpo mientras se arma la propuesta.
        this.scopeModal.body.removeClass('max-h-[72vh] overflow-y-auto');
        this.scopeModal.el.addClass('ws-scroll');

        this.scopeModal.body.append($('<div>', { id: 'scopeModalBody' }));

        const dia      = this.getFilters().dia;
        const enElMes  = info.dias.find((d) => d.dia === dia);
        const primero  = info.dias.find((d) => d.sinRepartir) || info.dias[0];

        ticketsView.renderScope(info, (enElMes || primero).dia);

        $('#scopeModalBody input[name="scopeKind"]').on('change', () => ticketsView.syncScope());

        // Elegir un dia es elegir «Un dia».
        $('#fScopeDia').on('change', () => {
            $('#scopeModalBody input[name="scopeKind"][value="dia"]').prop('checked', true);
            ticketsView.syncScope();
        });
    }

    // Un dia sellado no se rehace: el servidor lo rechazaria, asi que la ventana no
    // deja pedir su propuesta.
    // Mientras se arma la propuesta el pie lo controla lockScope: cambiar el dia en
    // ese rato no debe volver a encender «Ver propuesta».
    lockScopeOk(bloquear) {
        if (!this.scopeModal || $('#scopeLoading').length) return;

        this.scopeModal.footer.find('button').last()
            .prop('disabled', bloquear)
            .toggleClass('opacity-50 cursor-not-allowed', bloquear);
    }

    // El modal no se cierra al pedir la propuesta: armarla es leer el dia entero, y
    // en el mes son 31 lecturas. Se queda a la vista, ocupado, para que el tiempo
    // tenga donde ocurrir; lo cierra openPreviewModal cuando ya hay algo que ensenar.
    async applyScope() {
        const alcance = $('#scopeModalBody input[name="scopeKind"]:checked').val() || 'dia';
        const dia     = $('#fScopeDia').val();
        const mes     = (this.scopeInfo || {}).mes || '';
        const cuantos = alcance === 'mes' ? ((this.scopeInfo || {}).pendientes || 0) : 0;

        // Un dia ya generado pasa por la pregunta de siempre: rehacerlo o solo
        // eliminar sus tickets.
        if (alcance === 'dia' && $('#fScopeDia option:selected').attr('data-estado') === 'hecho') {
            const decision = await tickets.askRedo();

            if (!decision) return;

            if (decision === 'eliminar') {
                this.scopeModal.close();

                if (dia !== this.getFilters().dia) {
                    $('#fDia').val(dia);
                    await this.onChangeFilters();
                }

                return tickets.deleteDay();
            }
        }

        const desde = Date.now();

        this.lockScope(alcance === 'mes'
            ? `Armando la propuesta de ${cuantos} ${cuantos !== 1 ? 'días' : 'día'}...`
            : 'Armando la propuesta del día...');

        // Un dia responde en un parpadeo y el aviso no daba tiempo ni a leerse. El
        // mes no espera nada de mas: para cuando llega, el minimo ya se cumplio.
        tickets.beforeOpen = () => this.esperaMinima(desde, 500);

        try {
            if (alcance === 'mes') return await tickets.previewMonth(0, mes);

            if (dia && dia !== this.getFilters().dia) {
                $('#fDia').val(dia);
                await this.onChangeFilters();

                // La meta en pesos es de un dia: sobre otro dia no cuadra y el
                // servidor la rechaza. Se vuelve a capturar para el dia elegido.
                if (this.meta.modo === 'monto') return this.conMeta(() => tickets.previewDay());
            }

            await tickets.previewDay();
        } finally {
            tickets.beforeOpen = null;

            this.unlockScope();
        }
    }

    esperaMinima(desde, minimo) {
        const falta = minimo - (Date.now() - desde);

        if (falta <= 0) return Promise.resolve();

        return new Promise((listo) => setTimeout(listo, falta));
    }

    lockScope(texto) {
        if (!this.scopeModal) return;

        this.scopeModal.footer.find('button')
            .prop('disabled', true)
            .addClass('opacity-50 cursor-not-allowed');

        ticketsView.renderScopeLoading(texto);
    }

    // Solo actua si la propuesta no llego: cuando llega, el modal ya se cerro.
    unlockScope() {
        if (!this.scopeModal) return;

        this.scopeModal.footer.find('button')
            .prop('disabled', false)
            .removeClass('opacity-50 cursor-not-allowed');

        $('#scopeLoading').remove();
        $('#scopeNote').show();

        ticketsView.syncScope();
    }

    // -- Facade --

    async selectTicket(folio) {
        this.selectedId    = folio;
        this.ticketAbierto = null;
        $(`#tb${this.PROJECT_NAME} tbody tr`).removeClass('row-active');

        if (!folio) return ticketsView.renderPreview(null);

        $(`#tb${this.PROJECT_NAME} [data-folio="${folio}"]`).closest('tr').addClass('row-active');

        const data = await useFetch({ url: apiTickets, data: { opc: 'getTicket', folio: folio } });

        if (data.status !== 200) {
            ticketsView.renderPreview(null, data.message);
            return;
        }

        // Imprimirlo sella el dia solo si es un ticket generado (ver printTicket).
        this.ticketAbierto = data.ticket;

        ticketsView.renderPreview(data.ticket);
    }
}

class Tickets extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'tickets';
        this.generating   = false;
        this.semilla      = 0;

        // Lo que tiene que ocurrir antes de ensenar la propuesta. Lo usa el modal
        // de alcance para que su aviso de espera no parpadee.
        this.beforeOpen   = null;

        // El cuadro de avance de «Generar el mes» y su pregunta periodica.
        this.progresoMes   = null;
        this.progresoTimer = null;
        this.progresoTotal = 0;
        this.preguntando   = false;
    }

    // Una corrida a la vez: el cierre tarda segundos y el segundo clic entra cuando
    // el primero todavia no guarda, asi que las dos peticiones leen "esta venta no
    // tiene ticket" y el mismo cobro termina con dos notas (sale_id no es UNIQUE).
    async runLocked(task) {
        if (this.generating) return;

        this.generating = true;

        const boton = $('#btnGenerarTodos').prop('disabled', true);

        try {
            await task();
        } finally {
            this.generating = false;
            boton.prop('disabled', false);

            app.syncActionButtons();
        }
    }

    async lsTickets() {
        const data = await useFetch({ url: apiTickets, data: Object.assign({ opc: 'lsTickets' }, app.getFilters()) });

        // El dia bajo llave no trae filas, y eso no es un dia vacio: trae cuantas
        // ventas hay para poder dibujar su silueta.
        if (data && data.bloqueado) return this.lockedDay(data);

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

        this.rowSelect();

        const counts = data.counts || { facturados: 0, cero: 0, generados: 0, mostrados: 0, servicio: 0 };

        app.dataKpis   = data.kpis || {};
        app.dataCounts = counts;
        app.dataSello  = data.sello || null;
        app.dataMes    = data.mes || null;

        app.dataMudados = data.mudados || [];

        $('#statsRow').show();

        ticketsView.renderStats(app.dataKpis, counts);
        ticketsView.renderCutNote(data.corte);
        ticketsView.renderMudadosLink(app.dataMudados);
        app.syncActionButtons();
        app.syncMetaButton();

        const servicio = counts.servicio || 0;
        const aparte   = servicio > 0 ? `, ${servicio} de servicio de mesa` : '';

        app.updateFooterInfo(`Mostrando ${counts.mostrados} ticket${counts.mostrados !== 1 ? 's' : ''} del día${aparte}`);
    }

    dataTable(id, data) {
        if (!(data.row || []).length) return;

        if (typeof simple_data_table === 'function') simple_data_table(id, 100);
    }

    // Clic en la fila = clic en su boton de accion, para que una fila facturada o con
    // papel pendiente haga lo mismo que su boton y nunca ensene lo que el boton oculta.
    rowSelect() {
        $(`#tb${this.PROJECT_NAME}`).on('click', 'tbody tr', function (e) {
            if ($(e.target).closest('a, [data-goto-folio]').length) return;

            $(this).find('td:last-child a').first().trigger('click');
        });
    }

    // El dia sin generar, con la tabla cerrada. Todo lo de alrededor se sincroniza
    // igual que en un dia normal —los recuadros, los botones, la meta—: lo unico que
    // cambia es que en lugar del listado va su silueta.
    lockedDay(data) {
        const counts = data.counts || {};
        const ventas = counts.mostrados || 0;

        app.dataKpis    = data.kpis || {};
        app.dataCounts  = counts;
        app.dataSello   = null;
        app.dataMes     = data.mes || null;
        app.dataMudados = [];

        if (app.selectedId) app.selectTicket(null);

        $('#statsRow').show();

        ticketsView.renderStats(app.dataKpis, counts);
        ticketsView.renderLockedDay(ventas);
        ticketsView.renderCutNote(null);
        ticketsView.renderMudadosLink([]);

        app.syncActionButtons();
        app.syncMetaButton();

        app.updateFooterInfo(`${ventas} venta${ventas !== 1 ? 's' : ''} del día, sin repartir`);
    }

    // -- Actions --

    async previewDay(semilla = 0) {
        this.semilla = semilla;

        app.lockPreview(true);

        const data = await useFetch({
            url:  apiTickets,
            data: Object.assign({ opc: 'previewDay', semilla: this.semilla }, app.getFilters())
        });

        app.lockPreview(false);

        if (data.status !== 200) {
            this.alertBox({ theme: FACTURE_THEME, type: 'error', title: data.message, timer: 0 });
            return;
        }

        if (this.beforeOpen) await this.beforeOpen();

        app.openPreviewModal(data);
    }

    // Generar tickets ya no salta a la propuesta: primero pasa por la meta (12-13),
    // que es el paso que el roadmap pone antes del 14.
    async startGenerate() {
        app.scopeInfo = null;

        if (((app.dataCounts || {}).mostrados || 0) > 0) return app.conMeta(() => this.scopeOrPreview());

        // Parado en un dia sin ventas la meta se pediria sobre $0.00. Igual que al
        // terminar de subir (abreScope), primero se mueve al primer dia pendiente.
        const info = await useFetch({
            url:  apiTickets,
            data: Object.assign({ opc: 'scopeMonth' }, app.getFilters())
        });

        const dias    = (info && info.dias) || [];
        const destino = dias.find((d) => d.sinRepartir) || dias[0];

        if (!destino) return;

        $('#fDia').val(destino.dia);
        await app.onChangeFilters();

        app.conMeta(() => app.openScopeModal(info));
    }

    // La ventana sale siempre que el mes tenga ventas: es donde se elige el dia que
    // falta y donde se rehace uno ya generado. Antes, con un solo dia pendiente, se
    // iba directo a la propuesta del dia del filtro, y si ese ya estaba generado lo
    // rehacia en vez de generar el que faltaba.
    async scopeOrPreview() {
        const data = await useFetch({
            url:  apiTickets,
            data: Object.assign({ opc: 'scopeMonth' }, app.getFilters())
        });

        if (data.status !== 200 || !(data.dias || []).length) return this.previewDay();

        app.openScopeModal(data);
    }

    async previewMonth(semilla = 0, mes = '') {
        this.semilla  = semilla;
        this.scopeMes = mes || this.scopeMes || '';

        app.lockPreview(true);

        const data = await useFetch({
            url:  apiTickets,
            data: Object.assign(
                { opc: 'previewMonth', semilla: this.semilla, mes: this.scopeMes, semillas: JSON.stringify(app.previewSemillas || {}) },
                app.getFilters()
            )
        });

        app.lockPreview(false);

        if (data.status !== 200) {
            this.alertBox({ theme: FACTURE_THEME, type: 'error', title: data.message, timer: 0 });
            return;
        }

        if (this.beforeOpen) await this.beforeOpen();

        app.openPreviewModal(data);
    }

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

    async generateMonth() {
        await this.runLocked(async () => {
            // La clave con la que el servidor apunta el avance de ESTA generacion.
            const avance = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

            this.openMonthProgress(avance);

            let response;

            try {
                response = await useFetch({
                    url:  apiTickets,
                    data: Object.assign(
                        {
                            opc:      'generateMonth',
                            semilla:  this.semilla,
                            mes:      this.scopeMes || '',
                            semillas: JSON.stringify(app.previewSemillas || {}),
                            avance:   avance
                        },
                        app.getFilters()
                    )
                });

                this.stopMonthProgress();

                if (response && response.status === 200) {
                    const cerrados = (response.dias || []).filter((d) => !d.error).length;

                    ticketsView.renderMonthProgress({ listo: true, hechos: cerrados, total: Math.max(cerrados, this.progresoTotal) });
                }

                // Sin respuesta (la peticion se corto) el mes pudo quedar a medias: la
                // lista se relee igual para ensenar los dias que si se cerraron.
                if (!response || response.status === 200) await this.lsTickets();
            } finally {
                this.closeMonthProgress();
            }

            if (!response || response.status !== 200) {
                this.alertBox({
                    theme: FACTURE_THEME,
                    type:  'error',
                    title: (response && response.message) || 'No se pudo terminar de generar el mes. Revisa qué días quedaron generados.',
                    timer: 0
                });

                return;
            }

            ticketsView.renderResumenReparto(response);
        });
    }

    // Sin ×, sin clic afuera y sin Escape: el avance se ve hasta el final y lo
    // cierra generateMonth. cfModal no deja apagar Escape, por eso se suelta aqui;
    // la vista previa ya se cerro y no queda otro cfModal escuchando.
    openMonthProgress(avance) {
        const alcance = app.scopeInfo || {};

        this.progresoMes = this.cfModal({
            title:         alcance.mesTexto ? `Generando los tickets de ${alcance.mesTexto.toLowerCase()}` : 'Generando los tickets del mes',
            size:          'small',
            theme:         FACTURE_THEME,
            closeButton:   false,
            backdropClose: false,
            onClose:       () => { this.progresoMes = null; }
        });

        $(document).off('keydown.cfmodal');

        this.progresoMes.footer.remove();
        this.progresoMes.body.append($('<div>', { id: 'monthProgressBody' }));

        this.progresoTotal = alcance.pendientes || 0;

        ticketsView.renderMonthProgress({ actual: 0, total: this.progresoTotal });

        this.preguntando   = false;
        this.progresoTimer = setInterval(() => this.askMonthProgress(avance), 600);
    }

    // Una pregunta a la vez: con el servidor ocupado una respuesta puede tardar mas
    // que el intervalo, y dos al vuelo podian llegar al reves y regresar la barra.
    async askMonthProgress(avance) {
        if (this.preguntando) return;

        this.preguntando = true;

        const parte = await useFetch({ url: apiTickets, data: { opc: 'generateProgress', avance: avance } });

        this.preguntando = false;

        if (!this.progresoTimer || !parte || !parte.actual) return;

        this.progresoTotal = Number(parte.total) || this.progresoTotal;

        ticketsView.renderMonthProgress(parte);
    }

    stopMonthProgress() {
        if (!this.progresoTimer) return;

        clearInterval(this.progresoTimer);
        this.progresoTimer = null;
    }

    closeMonthProgress() {
        this.stopMonthProgress();

        if (this.progresoMes) this.progresoMes.close();

        this.progresoMes = null;
    }

    // Leer el mes son tantas lecturas como dias: el boton se apaga mientras llega
    // para que un segundo clic no abra otro modal.
    async showMonth() {
        $('#btnVerMes').prop('disabled', true);

        const data = await useFetch({ url: apiTickets, data: Object.assign({ opc: 'showMonth' }, app.getFilters()) });

        // Lo vuelve a encender el mes que este a la vista, no el que se pidio: el
        // filtro pudo cambiar mientras llegaba.
        app.syncActionButtons();

        if (data.status !== 200) {
            this.alertBox({ theme: FACTURE_THEME, type: 'error', title: data.message, timer: 0 });
            return;
        }

        ticketsView.renderMesRepartido(data);
    }

    // La ventana de Generar tickets pregunta esto antes de rehacer un dia ya
    // generado. Devuelve 'rehacer', 'eliminar' o '' si el usuario se arrepiente.
    askRedo() {
        return this.swalQuestion({
            extends: true,
            opts: {
                title:             'Rehacer el reparto del día',
                text:              'Rehacer vuelve a repartir la venta del día entre IVA 16% e IVA 0% y reemplaza los tickets ya generados; las notas no cambian. Solo eliminar borra los tickets del día y deja el día sin repartir; la generación que los creó queda registrada como anulada.',
                icon:              'question',
                showDenyButton:    true,
                confirmButtonText: 'Si, rehacer',
                denyButtonText:    'Solo eliminar',
                cancelButtonText:  'No'
            }
        }).then((result) => {
            if (result.isConfirmed) return 'rehacer';
            if (result.isDenied)    return 'eliminar';

            return '';
        });
    }

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

    // «Imprimir tickets» de la barra. Con el mes completo imprime todo sin preguntar
    // cual; con dias por generar pregunta si va solo el dia elegido o todo lo que ya
    // esta creado. Esa pregunta ya avisa del sello, asi que no se pide dos veces.
    async imprimir() {
        const mes = app.dataMes || {};

        if (!mes.generados) return;

        if (!mes.pendientes) return this.printMonth();

        const dia      = app.getFilters().dia;
        const diaHecho = ((app.dataCounts || {}).generados || 0) > 0;
        const ddmm     = dia.split('-').reverse().slice(0, 2).join('/');
        const sellar   = mes.sellados < mes.generados;

        const result = await this.swalQuestion({
            extends: true,
            opts: {
                title:             '¿Qué tickets imprimo?',
                text:              `A ${mes.mesTexto.toLowerCase()} le faltan ${mes.pendientes} ${mes.pendientes !== 1 ? 'días' : 'día'} por generar. Puedes imprimir solo el día elegido o todo lo que ya está creado.`
                                   + (sellar ? ' Lo que se imprime queda sellado: ya no se podrá cancelar ni rehacer.' : ''),
                icon:              'question',
                showDenyButton:    true,
                confirmButtonText: `Solo el ${ddmm}`,
                denyButtonText:    `Todos los creados (${mes.generados} ${mes.generados !== 1 ? 'días' : 'día'})`,
                cancelButtonText:  'Cancelar',
                didOpen:           (popup) => {
                    popup.classList.add('ws-swal-imprime');

                    if (!diaHecho) {
                        Swal.getConfirmButton().disabled = true;
                        Swal.getConfirmButton().title    = 'Ese día todavía no tiene tickets';
                    }
                }
            }
        });

        if (result.isConfirmed) return this.printSheet(true);
        if (result.isDenied)    return this.printMonth(true);
    }

    // Imprimir sella el dia (migra-24): desde ese momento sus tickets ya no se
    // cancelan ni se rehacen. La primera vez se avisa y se pide el si; un dia ya
    // sellado imprime directo, porque volver a imprimir no cambia nada.
    async printSheet(confirmado) {
        if (!app.dataSello && !confirmado && !(await this.confirmaSello())) return;

        const filtros = app.getFilters();
        const data    = await useFetch({ url: apiTickets, data: Object.assign({ opc: 'showPrintSheet', sellar: 1 }, filtros) });

        if (data.status !== 200) {
            this.alertBox({ type: 'error', title: data.message, timer: 0 });
            return;
        }

        this.afterPrintSheet(data, filtros.dia);
    }

    // Todos los dias generados del mes en una sola hoja. Son cientos de tickets: el
    // boton se apaga mientras llega la hoja para que un segundo clic no la pida otra vez.
    async printMonth(confirmado) {
        const mes = app.dataMes || {};

        if (!confirmado && mes.sellados < mes.generados && !(await this.confirmaSello(true))) return;

        $('#btnImprimirTodos').prop('disabled', true);

        const filtros = app.getFilters();
        const data    = await useFetch({ url: apiTickets, data: Object.assign({ opc: 'showPrintSheetMonth', sellar: 1 }, filtros) });

        if (data.status !== 200) {
            app.syncActionButtons();
            this.alertBox({ type: 'error', title: data.message, timer: 0 });
            return;
        }

        this.afterPrintSheet(data, filtros.dia);
    }

    // El mes y el sello que regresan son los del dia que pidio la hoja. Si el filtro
    // se movio mientras llegaba, la barra se queda con el dia que esta a la vista.
    afterPrintSheet(data, dia) {
        const mismoDia = dia === app.getFilters().dia;

        if (mismoDia && data.mes) app.dataMes = data.mes;

        if (mismoDia && data.sello && !app.dataSello) app.aplicaSello(data.sello);
        else app.syncActionButtons();

        ticketsView.renderPrintSheet(data.tickets, data.emisor);

        $('body').addClass('printing-sheet');
        window.print();
        $('body').removeClass('printing-sheet');
    }

    confirmaSello(delMes) {
        return this.swalQuestion({
            extends: true,
            opts: {
                title:             'Imprimir sella los tickets',
                text:              `Al imprimir, los tickets ${delMes ? 'del mes' : 'del día'} quedan sellados: ya no se podrán cancelar ni rehacer. Reimprimirlos sigue disponible.`,
                icon:              'warning',
                confirmButtonText: 'Sí, imprimir',
                cancelButtonText:  'No'
            }
        }).then((result) => !!(result && result.isConfirmed));
    }

    generateAllZero() {
        this.swalQuestion({
            extends: true,
            opts: {
                title:             'Generar tickets virtuales',
                text:              'Se generarán los tickets virtuales del día que van al 0% y aún no tienen uno.',
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

    // Un ticket generado que sale por la impresora tambien sella su dia: rehacer el
    // reparto le cambiaria el papel que ya se entrego. El consumo real no sella.
    async printTicket() {
        if (!app.selectedId) {
            this.alertBox({ type: 'message', title: 'Selecciona un ticket de la lista' });
            return;
        }

        const sella = !app.dataSello && !!(app.ticketAbierto && app.ticketAbierto.generado);

        if (sella) {
            if (!(await this.confirmaSello())) return;

            const data = await useFetch({ url: apiTickets, data: { opc: 'sealTicket', folio: app.selectedId } });

            if (data && data.sello) app.aplicaSello(data.sello);
        }

        window.print();
    }

    pendingNotice(motivo) {
        const titulo = {
            'sin-comanda':     'Esta venta llegó sin su comanda: su papel se arma al generar los tickets del día',
            'comanda-parcial': 'El folio ampara solo parte de la cuenta: su papel se arma al generar los tickets del día'
        }[motivo] || 'Su papel se arma al generar los tickets del día';

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

class TicketsView extends Templates {
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'tickets';
    }

    // -- Render helpers --

    renderFooter() {
        const info = $('<div>', { class: 'flex items-center gap-3 min-w-0 text-[10px] text-gray-400' });

        info.append($('<span>', { id: 'viewFooter_info' }));
        info.append($('<span>', { id: 'viewFooter_cut' }));

        const mudados = $('<button>', {
            type:  'button',
            id:    'btnMudados',
            class: 'ws-help flex-shrink-0',
            css:   { display: 'none' }
        });

        mudados.append($('<span>', { id: 'btnMudados_txt' }));
        mudados.append($('<span>', { text: '›' }));

        mudados.on('click', () => app.avisoMudados());

        const wrap = $('<div>', { id: 'mudadosWrap', class: 'relative flex-shrink-0' });

        wrap.append(mudados);

        $('#viewFooterRow').empty().append(info).append(wrap);
    }

    renderMudadosLink(mudados) {
        const n = (mudados || []).length;

        $('#btnMudados').toggle(n > 0);
        $('#btnMudados_txt').text(n === 1 ? '1 cargo cambio de folio' : `${n} cargos cambiaron de folio`);
    }

    mudadosLineas(mudados) {
        const folioLink = (folio) => $('<a>', {
            href: '#', 'data-goto-folio': folio, text: folio,
            class: 'underline font-semibold', title: `Ir al folio ${folio}`
        }).on('click', (e) => e.preventDefault());

        const lineas = (mudados || []).slice(0, 3).map((mov) =>
            $('<span>')
                .append(`El cargo de ${mov.montoTexto} de la cuenta `)
                .append(folioLink(mov.origen))
                .append(' lo factura ahora el folio ')
                .append(folioLink(mov.destino))
                .append(`, que se cobro en ${mov.pagoDestino}.`)
        );

        const resto = (mudados || []).length - lineas.length;

        if (resto > 0) lineas.push(`Y ${resto} cargo${resto !== 1 ? 's' : ''} mas.`);

        return lineas;
    }

    toggleMudadosToast(mudados) {
        let toast = $('#mudadosToast');

        if (toast.hasClass('is-on')) return this.hideMudadosToast();

        if (!toast.length) {
            toast = $('<div>', { id: 'mudadosToast', class: 'ws-toast' });
            $('#mudadosWrap').append(toast);
        }

        toast.empty();

        this.mudadosLineas(mudados).forEach((linea, i) => {
            toast.append($('<div>', { class: i ? 'mt-1.5' : '' }).append(linea));
        });

        requestAnimationFrame(() => toast.addClass('is-on'));

        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => this.hideMudadosToast(), 6000);

        setTimeout(() => $(document).one('click.mudados', () => this.hideMudadosToast()), 0);
    }

    hideMudadosToast() {
        clearTimeout(this.toastTimer);

        $(document).off('click.mudados');
        $('#mudadosToast').removeClass('is-on');
    }

    // -- Pantalla sin datos --

    renderEmptyDay(data) {
        const fecha = String(app.getFilters().dia || '').split('-').reverse().join('/');

        app.emptyDay(data);

        EmptyState.render({
            parent: 'tableWrap',
            json: data
                ? {
                    motivo: 'vacio',
                    icon:   'calendar-x',
                    title:  `Sin ventas cargadas el ${fecha}`,
                    text:   'El reporte del punto de venta se sube en Importación. Cuando entre el de este día, aquí salen sus tickets y se habilita el reparto.'
                }
                : {
                    motivo: 'error',
                    title:  'No se pudo cargar el día',
                    text:   'El servidor no devolvió el listado. Vuelve a intentarlo; si sigue igual, el detalle queda en el log del módulo.',
                    action: { text: 'Reintentar', icon: 'refresh-cw', onClick: () => tickets.lsTickets() }
                }
        });
    }

    renderCutNote(corte) {
        const texto = corte && corte.hay
            ? `· la línea ámbar corta el IVA 16%: ${corte.cuenta16} ventas por ${corte.logradoTexto} de ${corte.objetivoTexto}, y ${corte.cuenta0} al IVA 0% (${corte.monto0Texto})`
            : '';

        $('#viewFooter_cut').text(texto);
    }

    renderStats(k, counts) {
        const pctCero = k.metaCeroPct || 30;

        const rotulo16 = k.metaModo === 'monto'
            ? `IVA 16% · cantidad fija`
            : `IVA 16% · ${k.metaPct || 70}%`;

        const row = $('<div>', { class: 'w-full flex items-center flex-wrap gap-y-2' });

        const servicio = k.servicio
            ? ` · ${k.servicio} de servicio de mesa, que no facturan`
            : '';

        row.append(this.statCell('Tarjeta de crédito', k.totalTexto, 'ws-stat-hero',
            `${k.tickets || 0} folios con cargo a tarjeta${servicio}`));

        // Antes de capturar la meta del dia la division no es un hecho: sale de la
        // ultima meta guardada en el navegador y se leia como si el dia ya estuviera
        // repartido. Se muestra al aplicar la meta, o si el dia ya se genero.
        const porCapturar = (counts.generados || 0) === 0 && app.metaOkDia !== app.getFilters().dia;

        if (porCapturar) {
            row.append(this.statCell('IVA 16%', 'Por capturar', 'ws-stat-pend',
                'Se define al capturar la meta en «Generar tickets»', 'se define al generar'));

            row.append(this.statCell('IVA 0%', 'Por capturar', 'ws-stat-pend',
                'Se define al capturar la meta en «Generar tickets»', 'se define al generar'));
        } else {
            row.append(this.statCell(rotulo16, k.objetivoTexto, 'ws-stat-blue',
                `${k.metaPct || 70}% de la venta con tarjeta`));

            row.append(this.statCell(`IVA 0% · ${pctCero}%`,
                k.ceroGenerado ? k.obtenidoCeroTexto : k.objetivoCeroTexto, '',
                k.ceroGenerado ? `generado · objetivo ${k.objetivoCeroTexto}` : `${pctCero}% de la venta con tarjeta`));
        }

        row.append(this.statCell('Ya facturado', k.facturadoTexto, 'ws-stat-ok',
            `${k.facturados || 0} tickets facturados realmente`));

        const marcas = $('<div>', { class: 'ml-auto flex items-center gap-1.5' });

        // El sello dice por que el dia ya no se puede rehacer.
        const sello = app.dataSello;

        if (sello) {
            marcas.append($('<span>', {
                class: 'badge-base b-green',
                title: `Se imprimió el ${sello.fecha} a las ${sello.hora}${sello.usuario ? ` (${sello.usuario})` : ''}: sus tickets ya no se pueden cancelar ni rehacer`,
                html:  '<i data-lucide="lock" class="w-3 h-3"></i>Sellado'
            }));
        }

        marcas.append($('<span>', {
            class: `badge-base ${(counts.generados || 0) > 0 ? 'b-blue' : 'b-gray'}`,
            text:  (counts.generados || 0) > 0 ? `${counts.generados} generados` : 'sin repartir'
        }));

        row.append(marcas);

        $('#statsRow').empty().append(row);

        if (window.lucide) lucide.createIcons();
    }

    statCell(label, value, tone, detalle, nota) {
        const cell = $('<div>', { class: `ws-stat ${tone}`.trim(), title: detalle || '' });

        cell.append($('<div>', { class: 'ws-stat-lbl', text: label }));
        cell.append($('<div>', { class: 'ws-stat-val', text: value || '$0.00' }));

        if (nota) cell.append($('<div>', { class: 'ws-stat-nota', text: nota }));

        return cell;
    }

    // -- El dia bajo llave --
    //
    // La silueta del dia: la tabla con su encabezado y un renglon por venta, dibujado
    // en barras. No hay nada que tapar —el servidor no manda las filas—, asi que esto
    // no es el listado cubierto: es el hueco que deja, con el boton que lo abre.
    //
    // Los renglones se topan en diez. Un dia de trescientas ventas no dice mas por
    // pintar trescientas barras, y el numero exacto ya lo dice el cartel.
    renderLockedDay(ventas) {
        const filas  = Math.min(Math.max(ventas || 0, 1), 10);
        const anchos = ['tk-sk-w3', 'tk-sk-w5', 'tk-sk-w4'];

        const renglon = (i) => `
            <tr>
                <td><span class="tk-sk-bar tk-sk-w1"></span></td>
                <td><span class="tk-sk-bar tk-sk-w2"></span></td>
                <td><span class="tk-sk-bar ${anchos[i % anchos.length]}"></span></td>
                <td class="text-right"><span class="tk-sk-bar ${i % 2 ? 'tk-sk-w2' : 'tk-sk-w4'}"></span></td>
                <td></td>
            </tr>
        `;

        const cuerpo = Array.from({ length: filas }, (_, i) => renglon(i)).join('');

        $('#tableWrap').html(`
            <div class="tk-sk-wrap">
                <table class="tk-sk-table">
                    <thead>
                        <tr>
                            <th>Nota</th>
                            <th>Folio</th>
                            <th>Estado</th>
                            <th class="text-right">Monto</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${cuerpo}</tbody>
                </table>

                <div class="tk-lock-note">
                    <span class="tk-lock-ico"><i data-lucide="lock" class="w-4 h-4"></i></span>
                    <span class="tk-lock-txt">
                        <b>${ventas} venta${ventas !== 1 ? 's' : ''} sin repartir</b>
                        <span>Dale a Generar tickets para ver el detalle del día</span>
                    </span>
                    <button type="button" class="tk-lock-btn" onclick="tickets.startGenerate()">Generar tickets</button>
                </div>
            </div>
        `);

        if (window.lucide) lucide.createIcons();
    }

    // -- Alcance del cierre --

    renderScope(info, diaSugerido) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const marco = FACTURE_THEME_IS_LIGHT ? 'border-gray-200' : 'border-[#374151]';
        const valor = FACTURE_THEME_IS_LIGHT ? 'text-gray-900' : 'text-white';
        const label = FACTURE_THEME_IS_LIGHT ? 'text-gray-600' : 'text-gray-400';
        const campo = FACTURE_THEME_IS_LIGHT
            ? 'bg-white border-gray-300 text-gray-900'
            : 'bg-[#111827] border-[#374151] text-white';

        // El estado viaja en la opcion: syncScope lo lee para rotular «Rehacer un dia».
        const estado = (d) => d.sinRepartir ? 'pendiente' : (d.sellado ? 'sellado' : 'hecho');

        const opcion = (d) => `
            <option value="${esc(d.dia)}" data-estado="${estado(d)}" ${d.dia === diaSugerido ? 'selected' : ''}>
                ${esc(d.fechaTexto)} · ${esc(d.totalTexto)}${d.sinRepartir ? '' : (d.sellado ? ' · sellado' : ' · ya repartido')}
            </option>
        `;

        const pendientes = info.dias.filter((d) => d.sinRepartir).length;

        // Parado en un dia ya generado y con dias por repartir, lo que se busca es
        // generar los que faltan: la ventana abre en «Todo el mes».
        const sugerido = info.dias.find((d) => d.dia === diaSugerido) || {};
        const alMes    = pendientes > 0 && sugerido.sinRepartir === false;

        const mesTexto = pendientes
            ? `Los ${esc(pendientes)} ${pendientes !== 1 ? 'días' : 'día'} sin repartir · ${esc(info.movPendientes)} movimientos`
            : `${esc(info.mesTexto)} ya está completo`;

        $('#scopeModalBody').html(`
            <p class="text-[11px] ${label}">${esc(info.mesTexto)} · ${esc(info.dias.length)} ${info.dias.length !== 1 ? 'días' : 'día'} con ventas · ${esc(pendientes)} sin repartir</p>

            <label class="mt-3 block rounded-lg border ${marco} p-3 cursor-pointer" data-scope="dia">
                <span class="flex items-center gap-2">
                    <input type="radio" name="scopeKind" value="dia" ${alMes ? '' : 'checked'} class="accent-[#1C64F2]">
                    <span id="scopeDiaLbl" class="text-[12.5px] font-semibold ${valor}">Un día</span>
                </span>
                <select id="fScopeDia" class="mt-2 w-full rounded-lg border px-2 py-1.5 text-[12px] ${campo}">
                    ${info.dias.map(opcion).join('')}
                </select>
                <span id="scopeDiaNota" class="mt-2 block text-[10.5px] facture-warn"></span>
            </label>

            <label class="mt-2 block rounded-lg border ${marco} p-3 ${pendientes ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'}" data-scope="mes">
                <span class="flex items-center gap-2">
                    <input type="radio" name="scopeKind" value="mes" ${alMes ? 'checked' : ''} ${pendientes ? '' : 'disabled'} class="accent-[#1C64F2]">
                    <span class="text-[12.5px] font-semibold ${valor}">Todo el mes</span>
                    <span class="ml-auto text-[12px] font-bold ${valor}">${pendientes ? esc(info.pendienteTexto) : ''}</span>
                </span>
                <span class="mt-1 block pl-6 text-[10.5px] ${label}">${mesTexto}</span>
            </label>

            <p id="scopeNote" class="mt-2 text-[10.5px] facture-warn">
                El mes se genera día por día con la misma meta. Cada día numera sus tickets desde el 1.
            </p>
        `);

        this.syncScope();
    }

    renderScopeLoading(texto) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        $('#scopeLoading').remove();

        // El aviso toma el lugar de la nota: sumado debajo, el cuerpo del modal crecia
        // y en pantallas bajas le salia barra de scroll mientras se armaba la propuesta.
        $('#scopeNote').hide();

        $('#scopeModalBody').append(`
            <p id="scopeLoading" class="mt-2 flex items-center gap-2 text-[12px] facture-info">
                <i data-lucide="loader-2" class="w-3.5 h-3.5 shrink-0 animate-spin"></i>
                <span>${esc(texto)}</span>
            </p>
        `);

        if (window.lucide) lucide.createIcons();
    }

    syncScope() {
        const elegido = $('#scopeModalBody input[name="scopeKind"]:checked').val();
        const apagado = FACTURE_THEME_IS_LIGHT ? '#E5E7EB' : '#374151';

        $('#scopeModalBody [data-scope]').each(function () {
            const activo = $(this).attr('data-scope') === elegido;

            $(this).css('border-color', activo ? '#1C64F2' : apagado);
        });

        // El dia elegido ya generado se rehace; el sellado ya se imprimio y no se toca.
        const estado = $('#fScopeDia option:selected').attr('data-estado');

        const nota = {
            hecho:   'Rehacer reemplaza los tickets ya generados de ese día.',
            sellado: 'Ese día ya se imprimió: está sellado y no se puede rehacer.'
        }[estado] || '';

        $('#scopeDiaLbl').text(estado === 'pendiente' ? 'Un día' : 'Rehacer un día');
        $('#scopeDiaNota').text(nota).toggle(!!nota);

        app.lockScopeOk(elegido === 'dia' && estado === 'sellado');
    }

    renderMetaPreview(p) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const panel = FACTURE_THEME_IS_LIGHT ? 'bg-gray-50 border-gray-200' : 'bg-[#141d2b] border-[#374151]';
        const linea = FACTURE_THEME_IS_LIGHT ? 'border-gray-200' : 'border-[#374151]';
        const valor = FACTURE_THEME_IS_LIGHT ? 'text-gray-900' : 'text-white';
        const label = FACTURE_THEME_IS_LIGHT ? 'text-gray-600' : 'text-gray-400';

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

        const sugerido = p.sugerido ? `
            <p class="mt-2 text-[10px] facture-info">El monto al IVA ${esc(p.sugerido)}% es el resto del total. Corrígelo si el acuerdo es otro.</p>
        ` : '';

        const aviso = p.cuadra ? '' : `
            <p class="mt-2 text-[10px] facture-warn flex items-start gap-1.5">
                <i data-lucide="alert-triangle" class="w-3 h-3 shrink-0 mt-[1px]"></i>
                ${p.sobra ? 'Sobran' : 'Faltan'} ${esc(p.difTexto)} para que las dos tasas sumen el Total Tarjeta de Crédito.
            </p>
        `;

        $('#metaModalPreview').html(`
            <div class="mt-4 rounded-lg border ${panel} px-3 py-2">
                <div class="flex items-center justify-between pb-1.5 border-b ${linea}">
                    <span class="text-[11px] ${label}">Total Tarjeta de Crédito</span>
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

    // Las clases de tema se resuelven aqui y no con los tokens del modulo:
    // facture-theme traduce la paleta bajo #mainContainer y cfModal monta su panel
    // al final del <body>, fuera de ese scope.
    renderPreviewDay(p) {
        if (p.mes) return this.renderPreviewMonth(p);

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const linea = FACTURE_THEME_IS_LIGHT ? 'border-gray-200' : 'border-[#374151]';
        const valor = FACTURE_THEME_IS_LIGHT ? 'text-gray-900' : 'text-white';
        const label = FACTURE_THEME_IS_LIGHT ? 'text-gray-600' : 'text-gray-400';

        const detalle = this.detalleTickets(p);

        const host = $('#previewDayBody');

        // Todo cabe en el modal: si no alcanza, el que cede es la lista de folios
        // reasignados y solo ella se desplaza. El cuerpo del modal ya no lleva scroll.
        host.addClass('flex flex-col min-h-0');
        host.parent().addClass('ws-scroll flex flex-col');
        host.closest('.cf-modal').addClass('ws-scroll');

        host.html(`
            <p class="text-[11px] ${label}">${esc(p.fechaTexto)} · todavía no se guarda nada</p>

            <div class="mt-3">
                <p class="text-[9.5px] uppercase tracking-wider ${label}">Tarjeta de crédito</p>
                <p class="text-[22px] font-bold leading-tight ${valor}">${esc(p.totalTexto)}</p>
                <p class="text-[11px] ${label}">${esc(p.movimientos)} movimientos · ${esc(p.conCargo)} con cargo a tarjeta</p>
            </div>

            <div class="mt-3 pt-3 border-t ${linea}">
                <div class="flex h-4 rounded overflow-hidden text-[10px] font-semibold text-white">
                    <div class="flex items-center justify-center" style="flex:${esc(p.pct16)};background:#1C64F2;">${esc(p.pct16)}%</div>
                    <div class="flex items-center justify-center" style="flex:${esc(p.pct0)};background:#F59E0B;">${esc(p.pct0)}%</div>
                </div>
                ${this.tablaReparto(p)}
            </div>

            <div class="mt-3 pt-3 border-t ${linea}">
                <div class="flex items-baseline justify-between">
                    <span class="text-[12.5px] font-bold ${valor}">Tickets del día</span>
                    <span class="text-[12.5px] font-bold ${valor}">${esc(p.tickets)}</span>
                </div>
                ${detalle ? `<p class="text-[11px] ${label}">${esc(detalle)}</p>` : ''}
            </div>

            ${this.mudanzaPlegada(p.reasignados)}
        `);

        this.bindMudanza();

        if (window.lucide) lucide.createIcons();
    }

    // -- Piezas del dia --

    // El $0.00 se abre en sus dos origenes (servicio de mesa que presta folio y
    // $0.00 de origen que nunca cobro) en una sola linea, sin los ceros. Lo ya
    // facturado cuenta como ticket del dia pero no se le arma papel nuevo. La usan
    // la vista de un dia y el panel del mes.
    detalleTickets(p) {
        const g = p.grupos || {};

        const partesCero = [];
        if (g.servicio)   partesCero.push(`${g.servicio} de servicio de mesa`);
        if (g.ceroOrigen) partesCero.push(`${g.ceroOrigen} de origen`);

        const detalle = [];
        if (Number(p.cero) > 0) detalle.push(`${p.cero} de $0.00` + (partesCero.length ? ` (${partesCero.join(', ')})` : ''));
        if (g.facturados)       detalle.push(`${g.facturados} ya facturado${g.facturados !== 1 ? 's' : ''}`);

        return detalle.join(' · ');
    }

    // Cada mudanza lleva su motivo: un folio que cambia de dueño sin decir por que
    // es justo lo que hay que poder explicar. Va plegada: es el detalle que mas
    // alarga el modal y se consulta poco.
    mudanzaPlegada(movidos) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const linea = FACTURE_THEME_IS_LIGHT ? 'border-gray-200' : 'border-[#374151]';
        const valor = FACTURE_THEME_IS_LIGHT ? 'text-gray-900' : 'text-white';
        const label = FACTURE_THEME_IS_LIGHT ? 'text-gray-600' : 'text-gray-400';

        const lista   = movidos || [];
        const abierta = !!app.previewMudanzaAbierta;

        if (!lista.length) return '';

        return `
            <div class="mt-3 pt-3 border-t ${linea} flex flex-col min-h-0">
                <button type="button" id="btnMudanzaDia" class="flex items-center gap-2 w-full text-left">
                    <span class="text-[9.5px] font-semibold uppercase tracking-wider ${label}">Folios reasignados</span>
                    <span class="rounded-full border ${linea} px-1.5 text-[10px] font-semibold tabular-nums ${valor}">${esc(lista.length)}</span>
                    <i data-lucide="chevron-down" id="chevMudanzaDia" class="ml-auto w-4 h-4 ${label} transition-transform ${abierta ? 'rotate-180' : ''}"></i>
                </button>
                <div id="listaMudanzaDia" class="min-h-0 overflow-y-auto ws-scroll pr-1 ${abierta ? '' : 'hidden'}">
                    ${lista.map(m => `
                        <div class="mt-1.5">
                            <div class="flex items-baseline gap-2 text-[12px]">
                                <span class="font-semibold ${valor}">${esc(m.origen)}</span>
                                ${m.destino
                                    ? `<span class="${label}">&rsaquo;</span><span class="font-semibold text-[#1C64F2]">${esc(m.destino)}</span>`
                                    : `<span class="text-[10.5px] facture-warn">sin folio libre</span>`}
                                <span class="ml-auto ${valor}">${esc(m.montoTexto)}</span>
                            </div>
                            ${m.motivo ? `<p class="mt-0.5 text-[10.5px] ${label}">${esc(m.motivo)}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // El plegado vive en app y no en el DOM: al elegir otro dia del mes el panel se
    // vuelve a pintar, y la lista se queda como el usuario la dejo.
    bindMudanza() {
        $('#btnMudanzaDia').on('click', () => {
            app.previewMudanzaAbierta = !app.previewMudanzaAbierta;
            $('#listaMudanzaDia').toggleClass('hidden', !app.previewMudanzaAbierta);
            $('#chevMudanzaDia').toggleClass('rotate-180', app.previewMudanzaAbierta);
        });
    }

    // -- Meta contra generado --

    // Meta, generado y diferencia de las dos tasas en una sola tabla. La usan la
    // vista de un dia, el panel del mes y la columna del mes, para que las tres se
    // lean igual. La diferencia en cero se dice con palabras: un "+$0.00" se leia
    // como descuadre. La columna del mes no repite la nota de los tickets que no se
    // parten: ya la dice el panel del dia, a su lado.
    tablaReparto(p, compacto) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const linea = FACTURE_THEME_IS_LIGHT ? 'border-gray-200' : 'border-[#374151]';
        const valor = FACTURE_THEME_IS_LIGHT ? 'text-gray-900' : 'text-white';
        const label = FACTURE_THEME_IS_LIGHT ? 'text-gray-600' : 'text-gray-400';

        const titulo = `pb-1 pl-2 text-right text-[9.5px] font-medium uppercase tracking-wider whitespace-nowrap ${label}`;
        const celda  = `py-1.5 pl-2 text-right align-top whitespace-nowrap border-t ${linea}`;

        const cuenta = (n) => compacto ? `${n} tk` : `${n} ticket${Number(n) !== 1 ? 's' : ''}`;

        const fila = (color, nombre, meta, metaPct, generado, pct, tickets, dif) => `
            <tr>
                <td class="py-1.5 align-top whitespace-nowrap border-t ${linea}">
                    <span class="inline-flex items-center gap-1.5 text-[11.5px] font-semibold ${valor}">
                        <span class="w-2 h-2 rounded-full shrink-0" style="background:${color};"></span>${esc(nombre)}
                    </span>
                </td>
                <td class="${celda}">
                    <span class="block ${compacto ? 'text-[11px]' : 'text-[12px]'} font-semibold ${label}">${esc(meta)}</span>
                    ${compacto ? '' : `<span class="block text-[10px] ${label}">${esc(metaPct)}%</span>`}
                </td>
                <td class="${celda}">
                    <span class="block ${compacto ? 'text-[11.5px]' : 'text-[12.5px]'} font-bold ${valor}">${esc(generado)}</span>
                    <span class="block text-[10px] ${label}">${esc(pct)}% · ${esc(cuenta(tickets))}</span>
                </td>
                <td class="${celda}">
                    ${p.difCero
                        ? '<span class="text-[10.5px] font-semibold text-[#047857]">Sin diferencia</span>'
                        : `<span class="text-[11.5px] font-semibold" style="color:${color};">${esc(dif)}</span>`}
                </td>
            </tr>
        `;

        return `
            <div class="mt-2 overflow-x-auto ws-scroll">
                <table class="w-full tabular-nums">
                    <thead>
                        <tr>
                            <th class="pb-1 text-left text-[9.5px] font-medium uppercase tracking-wider ${label}">${compacto ? 'Mes' : 'Tasa'}</th>
                            <th class="${titulo}">Meta</th>
                            <th class="${titulo}">Generado</th>
                            <th class="${titulo}">${compacto ? 'Dif.' : 'Diferencia'}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${fila('#1C64F2', compacto ? '16%' : 'IVA 16%', p.objetivoTexto,     p.metaPct,     p.monto16Texto, p.pct16, p.cuenta16, p.difTexto)}
                        ${fila('#F59E0B', compacto ? '0%'  : 'IVA 0%',  p.objetivoCeroTexto, p.metaCeroPct, p.monto0Texto,  p.pct0,  p.cuenta0,  p.dif0Texto)}
                    </tbody>
                </table>
            </div>
            ${p.difCero || compacto ? '' : `<p class="mt-1 text-[10.5px] ${label}">Los tickets no se parten: el que cruza la meta entra completo.</p>`}
        `;
    }

    // -- El mes en dos zonas: la lista elige, el panel explica --

    // La lista de dias a la izquierda y el detalle del dia elegido a la derecha.
    // Cada columna tiene su propio scroll: si el detalle empujara la lista, el
    // usuario perderia el renglon donde iba.
    renderPreviewMonth(p) {
        this.renderTwoZones({
            host:      'previewDayBody',
            modo:      'preview',
            dias:      p.dias || [],
            tituloMes: p.fechaTexto,
            totalTexto: p.totalTexto,
            subtitulo: `${p.movimientos} movimientos · todavía no se guarda nada`,
            resumen:   p
        });
    }

    // Las dos zonas: la lista de dias elige y el panel de la derecha explica. La
    // usan la vista previa y el resumen del cierre, para que lo que se revisa antes
    // y lo que se lee despues se dibujen con la misma pieza.
    renderTwoZones(cfg) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const linea = FACTURE_THEME_IS_LIGHT ? 'border-gray-200' : 'border-[#374151]';
        const valor = FACTURE_THEME_IS_LIGHT ? 'text-gray-900' : 'text-white';
        const label = FACTURE_THEME_IS_LIGHT ? 'text-gray-600' : 'text-gray-400';
        const fondo = FACTURE_THEME_IS_LIGHT ? 'bg-white' : 'bg-[#111827]';

        const dias = cfg.dias || [];

        app.previewDias = dias;
        app.previewModo = cfg.modo;

        const renglon = (d) => {
            const activo = d.dia === app.previewDiaSel;
            const marca  = activo
                ? 'border-[#1C64F2] ' + (FACTURE_THEME_IS_LIGHT ? 'bg-[#EBF2FF]' : 'bg-[#16233B]')
                : `${linea} hover:border-[#1C64F2]`;

            // Los dos porcentajes con el color de su tasa, igual que la barra del
            // panel: el azul es lo que va al 16% y el ambar el resto, al 0%.
            const cifras = d.error
                ? `<span class="facture-warn text-[10.5px] truncate">${esc(d.error)}</span>`
                : `<span class="text-[11.5px] font-semibold tabular-nums ${valor}">${esc(d.totalTexto)}</span>
                   <span class="ml-auto flex items-baseline gap-1 text-[11px] font-semibold tabular-nums">
                       <span style="color:#1C64F2;">${esc(d.pct16)}%</span>
                       <span class="${label} font-normal">/</span>
                       <span style="color:#F59E0B;">${esc(d.pct0)}%</span>
                   </span>`;

            return `
                <button type="button" data-dia="${esc(d.dia)}"
                        class="w-full flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left ${marca}">
                    <span class="w-9 shrink-0 text-[11.5px] font-bold ${valor}">${esc(d.fechaTexto)}</span>
                    ${cifras}
                    ${d.repartido && cfg.modo === 'preview' ? '<span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:#047857;"></span>' : ''}
                </button>
            `;
        };

        // Lo que el Confirmar va a escribir en todo el mes, antes de bajar al detalle
        // de cada dia. Solo en la vista previa: el cierre ya tiene su resumen.
        const r = cfg.resumen;

        const totalesMes = r ? `
            <div class="mt-2 pt-2 border-t ${linea}">
                ${this.tablaReparto(r, true)}
                <div class="mt-2 flex items-baseline justify-between">
                    <span class="text-[12px] font-bold ${valor}">Tickets del mes</span>
                    <span class="text-[12px] font-bold tabular-nums ${valor}">${esc(r.tickets)}</span>
                </div>
                ${Number(r.cero) > 0 ? `<p class="text-[11px] ${label}">${esc(r.cero)} de $0.00</p>` : ''}
            </div>
        ` : '';

        const host = $('#' + cfg.host);

        // En md el cuerpo del modal deja de desplazarse: las dos zonas llenan su alto.
        // La lista de dias lleva su scroll y el panel solo el de los folios
        // reasignados; con el del cuerpo encima, el panel quedaba con dos barras.
        host.addClass('md:flex-1 md:min-h-0');
        host.parent().addClass('ws-scroll md:h-[72vh] md:flex md:flex-col');
        host.closest('.cf-modal').addClass('ws-scroll');

        host.html(`
            <div class="flex flex-col md:flex-row md:gap-4 md:h-full">
                <div class="md:w-[38%] md:shrink-0 md:flex md:flex-col md:min-h-0">
                    <p class="flex items-baseline justify-between gap-2">
                        <span class="text-[12.5px] font-bold ${valor}">${esc(cfg.tituloMes)}</span>
                        <span class="text-[10.5px] ${label}">${dias.length} ${dias.length !== 1 ? 'días' : 'día'}</span>
                    </p>
                    <p class="text-[20px] font-bold leading-tight ${valor}">${esc(cfg.totalTexto)}</p>
                    <p class="text-[10.5px] ${label}">${esc(cfg.subtitulo)}</p>
                    ${totalesMes}

                    <div id="previewMonthList" class="mt-2 grid content-start gap-1 overflow-y-auto ws-scroll pr-1 max-h-[52vh] md:max-h-none md:flex-1 md:min-h-0">
                        ${dias.map(renglon).join('')}
                    </div>
                </div>

                <div id="previewMonthPanel"
                     class="flex flex-col hidden md:flex md:flex-1 md:min-w-0 fixed md:static inset-x-0 bottom-0 z-[70] md:z-auto
                            h-[70vh] md:h-auto overflow-y-auto ws-scroll
                            border ${linea} ${fondo} rounded-t-2xl md:rounded-lg shadow-2xl md:shadow-none p-3">
                </div>
            </div>
        `);

        $('#previewMonthList [data-dia]').on('click', function () {
            app.selectPreviewDay($(this).attr('data-dia'));
        });

        // Al abrir, el primer dia util ya viene elegido: el panel no se ve vacio y
        // el usuario empieza a leer sin un clic de cortesia.
        const vigente = dias.some((d) => d.dia === app.previewDiaSel) ? app.previewDiaSel : null;
        const primero = dias.find((d) => !d.error && (cfg.modo === 'cierre' || !d.repartido)) || dias[0];

        this.renderMonthPanel(vigente || (primero ? primero.dia : null), !vigente);
    }

    // El panel del dia elegido: total, reparto, tickets y folios reasignados, y el
    // sello de solo lectura cuando al dia ya lo cerro una corrida anterior.
    renderMonthPanel(dia, silencioso) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const linea = FACTURE_THEME_IS_LIGHT ? 'border-gray-200' : 'border-[#374151]';
        const valor = FACTURE_THEME_IS_LIGHT ? 'text-gray-900' : 'text-white';
        const label = FACTURE_THEME_IS_LIGHT ? 'text-gray-600' : 'text-gray-400';

        const d = (app.previewDias || []).find((x) => x.dia === dia);

        app.previewDiaSel = d ? d.dia : null;

        $('#previewMonthList [data-dia]').each(function () {
            const activo = $(this).attr('data-dia') === app.previewDiaSel;

            $(this)
                .toggleClass('border-[#1C64F2]', activo)
                .toggleClass(FACTURE_THEME_IS_LIGHT ? 'bg-[#EBF2FF]' : 'bg-[#16233B]', activo)
                .toggleClass(linea, !activo)
                .toggleClass('hover:border-[#1C64F2]', !activo);
        });

        const asa = `
            <div class="md:hidden relative mb-2 h-4">
                <span class="mx-auto block w-10 h-1 rounded-full ${FACTURE_THEME_IS_LIGHT ? 'bg-gray-300' : 'bg-[#374151]'}"></span>
                <button type="button" id="previewPanelClose" class="absolute right-0 top-0 ${label}">
                    <i data-lucide="x" class="w-4 h-4"></i>
                </button>
            </div>
        `;

        if (!d) {
            $('#previewMonthPanel').html(`
                ${asa}
                <p class="py-10 text-center text-[11.5px] ${label}">Selecciona un día de la lista para ver su detalle</p>
            `);

            if (window.lucide) lucide.createIcons();

            return;
        }

        if (d.error) {
            $('#previewMonthPanel').html(`
                ${asa}
                <p class="text-[13px] font-bold ${valor}">${esc(d.fechaLarga)}</p>
                <p class="mt-2 text-[11.5px] facture-warn">${esc(d.error)}</p>
            `);

            this.afterPanel(silencioso);

            return;
        }

        const detalle = this.detalleTickets(d);

        const cerrado = app.previewModo === 'cierre';

        const sello = d.repartido
            ? `<span class="inline-flex items-center rounded-full px-2 py-[1px] text-[10px] font-semibold"
                     style="background:#0478571A;color:#047857;">${cerrado ? esc(d.generacion || 'cerrado') : 'ya repartido'}</span>`
            : '';

        // En la vista previa, el dia que ya cerro una corrida va solo para consulta:
        // el Confirmar del mes no lo reescribe.
        const accion = !cerrado && d.repartido
            ? `<p class="mt-3 text-[10.5px] ${label}">Este día ya se generó antes: aquí va solo para consulta.</p>`
            : '';

        // Se lee igual que la vista previa de un dia. Si no cabe, cede la lista de
        // folios reasignados, que es la unica que se desplaza.
        $('#previewMonthPanel').html(`
            ${asa}
            <div class="flex items-baseline gap-2">
                <p class="text-[13px] font-bold ${valor}">${esc(d.fechaLarga)}</p>
                ${sello}
            </div>

            <div class="mt-2">
                <p class="text-[9.5px] uppercase tracking-wider ${label}">Tarjeta de crédito</p>
                <p class="text-[22px] font-bold leading-tight ${valor}">${esc(d.totalTexto)}</p>
                <p class="text-[11px] ${label}">${esc(d.movimientos)} movimientos · ${esc(d.conCargo)} con cargo a tarjeta</p>
            </div>

            <div class="mt-3 pt-3 border-t ${linea}">
                <div class="flex h-4 rounded overflow-hidden text-[10px] font-semibold text-white">
                    <div class="flex items-center justify-center" style="flex:${esc(d.pct16)};background:#1C64F2;">${esc(d.pct16)}%</div>
                    <div class="flex items-center justify-center" style="flex:${esc(d.pct0)};background:#F59E0B;">${esc(d.pct0)}%</div>
                </div>
                ${this.tablaReparto(d)}
            </div>

            <div class="mt-3 pt-3 border-t ${linea}">
                <div class="flex items-baseline justify-between">
                    <span class="text-[12.5px] font-bold ${valor}">Tickets del día</span>
                    <span class="text-[12.5px] font-bold tabular-nums ${valor}">${esc(d.tickets)}</span>
                </div>
                ${detalle ? `<p class="text-[11px] ${label}">${esc(detalle)}</p>` : ''}
            </div>

            ${this.mudanzaPlegada(d.reasignados)}

            ${accion}
        `);

        this.bindMudanza();
        this.afterPanel(silencioso);
    }

    afterPanel(silencioso) {
        if (window.lucide) lucide.createIcons();

        $('#previewPanelClose').on('click', () => $('#previewMonthPanel').addClass('hidden'));

        // En angosto el panel es un cajon: solo sube cuando el usuario elige un dia,
        // nunca al abrir el modal.
        if (!silencioso) $('#previewMonthPanel').removeClass('hidden');
    }

    // La barra cuenta los dias ya cerrados: el que esta en curso todavia no la empuja.
    // `listo` es el cierre: el servidor ya contesto y solo falta releer la lista.
    renderMonthProgress(avance) {
        const total  = Number(avance.total) || 0;
        const actual = Number(avance.actual) || 0;
        const hechos = avance.listo ? Number(avance.hechos) || 0 : Math.max(0, actual - 1);
        const pct    = total > 0 ? Math.min(100, Math.round(hechos * 100 / total)) : 0;
        const dias   = (n) => `${n} ${n !== 1 ? 'días' : 'día'}`;

        const titulo = avance.listo ? 'Actualizando la lista de tickets...'
                     : actual > 0   ? `Creando los tickets del ${avance.fechaTexto}...`
                     : 'Preparando el mes...';

        const cuenta = avance.listo ? `${hechos} de ${dias(total)} generados`
                     : actual > 0   ? `Día ${actual} de ${total}`
                     : total > 0    ? `${dias(total)} por generar`
                     : '';

        if (!$('#monthProgressFill').length) this.layoutMonthProgress();

        $('#monthProgressTitle').text(titulo);
        $('#monthProgressPct').text(`${pct}%`);
        $('#monthProgressFill').css('width', `${pct}%`);
        $('#monthProgressCount').text(cuenta);
    }

    layoutMonthProgress() {
        const marco = FACTURE_THEME_IS_LIGHT ? 'bg-gray-200' : 'bg-[#374151]';

        const cabeza = $('<p>', { class: 'flex items-center justify-between gap-2 text-[12px] facture-info' });
        const titulo = $('<span>', { class: 'flex items-center gap-2' });

        titulo.append($('<i>', { 'data-lucide': 'loader-2', class: 'w-3.5 h-3.5 shrink-0 animate-spin' }));
        titulo.append($('<span>', { id: 'monthProgressTitle' }));

        cabeza.append(titulo, $('<strong>', { id: 'monthProgressPct' }));

        const barra = $('<div>', { class: `mt-2 h-1.5 w-full rounded-full ${marco} overflow-hidden` });

        barra.append($('<div>', {
            id:    'monthProgressFill',
            class: 'h-full rounded-full transition-all duration-500',
            css:   { width: '0%', background: 'var(--ws-blue, #1C64F2)' }
        }));

        $('#monthProgressBody').append(
            cabeza,
            barra,
            $('<p>', { id: 'monthProgressCount', class: 'mt-1.5 text-[11px] text-gray-500' })
        );

        if (window.lucide) lucide.createIcons();
    }

    // El cierre del mes no cabe en un aviso: son 31 dias y todas sus mudanzas de
    // folio en una tira. Se lee con la misma pieza que la vista previa.
    // cfModal no cierra solo con su boton principal: sin onOk, «Entendido» no hacia nada.
    renderCierreMes(r) {
        const dias = r.dias || [];

        app.previewDiaSel = null;
        app.cierreModal   = app.cfModal({
            title:         `Reparto de ${r.fechaTexto} · ${dias.filter((d) => !d.error).length} día(s) cerrados`,
            size:          'xl',
            theme:         FACTURE_THEME,
            okLabel:       'Entendido',
            backdropClose: false,
            onOk:          () => app.cierreModal.close(),
            onClose:       () => { app.cierreModal = null; }
        });

        if (r.falla) {
            app.cierreModal.body.append($('<p>', {
                class: 'mb-2 rounded-lg border px-3 py-2 text-[11.5px] facture-warn',
                style: 'border-color:#F59E0B;',
                text:  `El mes se detuvo en ${r.falla.fechaTexto}: ${r.falla.message}`
            }));
        }

        app.cierreModal.body.append($('<div>', { id: 'cierreMesBody' }));

        app.decorateCierreFooter();

        this.renderTwoZones({
            host:       'cierreMesBody',
            modo:       'cierre',
            dias:       dias,
            tituloMes:  r.fechaTexto,
            totalTexto: r.totalTexto,
            subtitulo:  `${r.tickets} tickets con cargo · ${(r.reasignados || []).length} folios reasignados`
        });
    }

    // El mes ya repartido, con la misma pieza y los mismos totales que su vista
    // previa. Solo se lee: el pie no lleva mas que Cerrar.
    renderMesRepartido(r) {
        const dias = r.dias || [];

        app.previewDiaSel = null;

        const modal = app.cfModal({
            title:         `Movimientos del mes · ${r.fechaTexto}`,
            size:          'xl',
            theme:         FACTURE_THEME,
            okLabel:       'Cerrar',
            backdropClose: true,
            onOk:          () => modal.close()
        });

        modal.footer.find('button').first().remove();
        modal.body.append($('<div>', { id: 'mesRepartidoBody' }));

        this.renderTwoZones({
            host:       'mesRepartidoBody',
            modo:       'cierre',
            dias:       dias,
            tituloMes:  r.fechaTexto,
            totalTexto: r.totalTexto,
            subtitulo:  `${r.movimientos} movimientos · ${r.repartidos} de ${dias.length} días repartidos`,
            resumen:    r
        });
    }

    // Los renglones van con <span class="block"> y no con <div>: alertBox mete este
    // html dentro de un <p>, y un <div> ahi adentro lo parte en dos.
    renderResumenReparto(r) {
        if (r.mes) return this.renderCierreMes(r);

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const dif = (texto) => {
            const color = String(texto).startsWith('+') ? 'text-[#1C64F2]' : 'text-amber-400';
            return `<span class="${color} ml-2">${esc(texto)}</span>`;
        };

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

        const conteo = (etiqueta, cuantos) => `
            <span class="block text-left pl-3">
                <span class="text-gray-500">${esc(etiqueta)}
                    <span class="font-mono text-gray-300 font-semibold ml-1">${esc(cuantos)}</span>
                </span>
            </span>
        `;

        const detalle = (texto, tono) => `
            <span class="block text-left pl-6 text-[11px] ${tono || 'text-gray-500'}">${esc(texto)}</span>
        `;

        const separador = '<span class="block border-t border-[#374151] my-2.5"></span>';

        const conComanda = Math.max(0, (r.cuenta16 || 0) - (r.armados16 || 0));
        const partes16   = [];

        if (r.facturados) partes16.push(`${r.facturados} ya facturados`);
        if (conComanda)   partes16.push(`${conComanda} con su comanda`);
        if (r.armados16)  partes16.push(`${r.armados16} con papel armado`);

        const desfase = parseFloat(String(r.dif16Texto || '').replace(/[^0-9.]/g, '')) > 0
            ? `<span class="block text-left text-[11px] text-gray-500 mt-2">Los tickets no se parten: el que cruza la meta entra completo, asi que el 16% se pasa ${esc(r.dif16Texto)} y al 0% le falta lo mismo.</span>`
            : '';

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

        const periodo = r.mes ? 'del mes' : 'del día';

        const cerrados = (r.dias || []).length ? `
            ${separador}
            <span class="block text-left text-gray-300 font-semibold">${esc(r.dias.length)} día(s) cerrados</span>
            ${r.dias.map(d => renglon(`${d.fechaTexto} · ${d.generacion || ''}`, `${d.tickets} con cargo`)).join('')}
        ` : '';

        this.alertBox({
            theme:   FACTURE_THEME,
            type:    'success',
            title:   r.mes ? `Reparto de ${r.fechaTexto}` : `Reparto del ${r.fechaTexto}`,
            width:   'w-[430px]',
            timer:   0,
            okLabel: 'Entendido',
            detailHtml: `
                <span class="block flex items-baseline justify-between gap-3">
                    <span class="text-gray-300 font-semibold">Monto ${periodo}</span>
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
                ${cerrados}
            `
        });
    }

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

    // -- Subir ventas del POS --

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

        $('#uploadModalDrop').addClass('flex-1').html(`
            <label id="dropVentas" for="fUpFile"
                   class="mt-2.5 flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed ${marco} px-4 py-4 text-center cursor-pointer">
                <i data-lucide="file-spreadsheet" class="w-7 h-7" style="color:#217346"></i>
                <span class="text-[12.5px] font-semibold ${texto}">Arrastra los reportes o haz clic para elegirlos</span>
                <span class="flex flex-wrap items-center justify-center gap-1.5">${esperados}</span>
                <span class="text-[11px] ${sub}">Los dos de Wansoft, con la fecha detrás · .xls o .xlsx</span>
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

    renderPeriodFiles(archivos, periodo) {
        const cargados = (archivos || []).filter((a) => a.cargado);

        if (!cargados.length) return $('#uploadModalFiles').empty();

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const ficha = (a) => `
            <span class="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1"
                  style="border-color:${this.tonoCargado('borde')};background:${this.tonoCargado('fondo')}"
                  title="${esc(this.textoArchivo(a))}">
                <i data-lucide="file-spreadsheet" class="w-4 h-4 shrink-0" style="color:#217346"></i>
                <span class="text-[11px] font-medium">${esc(a.slot.archivo)}</span>
                <i data-lucide="check" class="w-3.5 h-3.5 shrink-0" style="color:#047857"></i>
            </span>
        `;

        const p   = app.uploadPeriod();
        const mes = String(p.mes || '').padStart(2, '0');

        const completo = cargados.length === archivos.length;

        $('#uploadModalFiles').html(`
            <a href="/app/wansoft/cargas.php?mes=${encodeURIComponent(mes)}&anio=${encodeURIComponent(p.anio)}"
               target="_blank" rel="noopener"
               class="mt-2.5 block group">
                <p class="flex items-center gap-1 text-[10.5px] font-semibold text-gray-500 mb-1.5 group-hover:underline">
                    Ya cargado en ${esc(periodo)}
                    <i data-lucide="external-link" class="w-3 h-3"></i>
                </p>
                <div class="flex flex-wrap gap-1.5">${cargados.map(ficha).join('')}</div>
            </a>
            ${completo
                ? `<p class="mt-1.5 text-[11.5px] font-medium text-gray-700">${esc(periodo)} ya está completo. Si vuelves a subir, solo entran los movimientos nuevos.</p>`
                : ''}
        `);

        if (window.lucide) lucide.createIcons();
    }

    textoArchivo(a) {
        if (!a.carga) return a.slot.desglosa;

        const acta  = this.bitacoraCarga(a.carga.data.hojas || []);
        const miles = (n) => Number(n || 0).toLocaleString('en-US');

        if (acta.nuevos      > 0) return `${miles(acta.nuevos)} movimiento(s) guardado(s)`;
        if (acta.refrescados > 0) return `${miles(acta.refrescados)} refrescado(s), ninguno nuevo`;
        if (acta.yaEstaban   > 0) return `sus ${miles(acta.yaEstaban)} movimientos ya estaban`;

        return 'sin movimientos nuevos';
    }

    renderPickedFiles(archivos, lleno, falta) {
        if (!archivos.length) return this.renderDropZone();

        const marco = FACTURE_THEME_IS_LIGHT ? 'border-gray-300' : 'border-[#374151]';
        const texto = FACTURE_THEME_IS_LIGHT ? 'text-gray-900' : 'text-white';
        const sub   = FACTURE_THEME_IS_LIGHT ? 'text-gray-500' : 'text-gray-400';

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const fila = (a, i) => `
            <div class="flex items-center gap-2 rounded-lg border ${marco} px-3 py-2">
                <i data-lucide="file-spreadsheet" class="w-4 h-4 shrink-0" style="color:#217346"></i>
                <span class="text-[12px] font-medium ${texto} truncate">${esc(a.nombre)}</span>
                <span class="text-[11px] ${sub} shrink-0">${esc(a.peso)}</span>
                ${a.slot
                    ? `<span class="text-[10.5px] shrink-0 px-1.5 py-0.5 rounded border ${marco} ${sub}">${esc(a.slot)}</span>`
                    : `<span class="text-[10.5px] font-semibold shrink-0 facture-warn">No es el archivo correcto</span>`}
                <span class="flex-1"></span>
                <button type="button" data-quitar="${i}" class="text-[11.5px] px-2 py-1 rounded border ${marco} ${sub}">Quitar</button>
            </div>
        `;

        const pendiente = () => `
            <label for="fUpFile" class="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 cursor-pointer"
                   style="border-color:${this.tonoPendiente('borde')};background:${this.tonoPendiente('fondo')}">
                <i data-lucide="file-spreadsheet" class="w-4 h-4 shrink-0" style="color:#217346"></i>
                <span class="min-w-0">
                    <span class="block text-[12px] font-medium ${texto} truncate">${esc(falta.archivo)}</span>
                    <span class="block text-[10.5px] ${sub} truncate">${esc(falta.desglosa)}</span>
                </span>
                <span class="flex-1"></span>
                <span class="text-[10.5px] font-semibold facture-warn shrink-0">pendiente</span>
                <span class="inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium facture-warn shrink-0"
                      style="border-color:${this.tonoPendiente('borde')}">
                    <i data-lucide="plus" class="w-3 h-3"></i>
                    Agregar archivo
                </span>
                <input type="file" id="fUpFile" accept=".xls,.xlsx" class="hidden" multiple>
            </label>
        `;

        const otro = lleno ? '' : (falta ? pendiente() : `
            <label for="fUpFile" class="flex items-center justify-center gap-2 rounded-lg border border-dashed ${marco} px-3 py-2 cursor-pointer">
                <i data-lucide="plus" class="w-3.5 h-3.5 ${sub}"></i>
                <span class="text-[11.5px] ${sub}">Agregar el otro archivo</span>
                <input type="file" id="fUpFile" accept=".xls,.xlsx" class="hidden" multiple>
            </label>
        `);

        $('#uploadModalDrop').removeClass('flex-1').html(`<div class="mt-3 flex flex-col gap-2">${archivos.map(fila).join('')}${otro}</div>`);

        if (window.lucide) lucide.createIcons();

        $('#fUpFile').on('change', (e) => app.onPickFile(e.target.files));

        $('#uploadModalDrop [data-quitar]').on('click', function () {
            app.removeFile(Number($(this).attr('data-quitar')));
        });
    }

    renderUploadHint(cuantos, slots, pendientes, falta, cuantosFaltan) {
        const total = slots.length;

        if (!cuantos) {
            const faltan = pendientes || slots;

            if (faltan.length && faltan.length < total) {
                return $('#uploadModalState').html(`
                    <p class="mt-2.5 text-[11.5px] text-gray-500">
                        Falta el <strong>${faltan[0].nombre.toLowerCase()}</strong>:
                        ${faltan[0].desglosa.charAt(0).toLowerCase()}${faltan[0].desglosa.slice(1)}
                    </p>
                `);
            }

            return $('#uploadModalState').empty();
        }

        if (cuantos < total) {
            if (falta || !cuantosFaltan) return $('#uploadModalState').empty();

            return $('#uploadModalState').html(`
                <p class="mt-3 flex items-start gap-2 text-[11.5px] facture-warn">
                    <i data-lucide="alert-triangle" class="w-3.5 h-3.5 shrink-0 mt-[1px]"></i>
                    <span>Falta 1 archivo de ${total}. Puedes subir este, pero para continuar hay que subir los dos.</span>
                </p>
            `) && (window.lucide ? lucide.createIcons() : null);
        }

        $('#uploadModalState').html(`
            <p class="mt-3 flex items-start gap-2 text-[11.5px] facture-info">
                <i data-lucide="check" class="w-3.5 h-3.5 shrink-0 mt-[1px]"></i>
                Se subirán los ${total} archivos del día.
            </p>
            <p class="mt-1 text-[11px] text-gray-500">
                Cada movimiento se guarda en el mes de su fecha. Los que ya se procesaron se omiten: solo entran los nuevos.
            </p>
        `);

        if (window.lucide) lucide.createIcons();
    }

    renderUploadStep(texto, nota) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        $('#uploadModalDrop').show().css({ opacity: '.55', 'pointer-events': 'none' });

        if ($('#uploadStepBox').length) {
            $('#uploadStepText').text(texto);
            $('#uploadStepNote').text(nota || '').toggle(!!nota);

            return;
        }

        $('#uploadModalState').html(`
            <div id="uploadStepBox" class="mt-3">
                <p class="flex items-center gap-2 text-[12px] facture-info">
                    <i data-lucide="loader-2" class="w-3.5 h-3.5 shrink-0 animate-spin"></i>
                    <span id="uploadStepText">${esc(texto)}</span>
                    <span id="uploadStepClock" class="text-[11px] text-gray-400 tabular-nums"></span>
                </p>
                <p id="uploadStepNote" class="mt-1 pl-5 text-[11px] text-gray-500" ${nota ? '' : 'style="display:none"'}>${esc(nota || '')}</p>
            </div>
        `);

        if (window.lucide) lucide.createIcons();

        this.startStepClock();
    }

    startStepClock() {
        clearInterval(this.stepClock);

        const inicio = Date.now();

        this.stepClock = setInterval(() => {
            const nodo = document.getElementById('uploadStepClock');

            if (!nodo) return clearInterval(this.stepClock);

            const s = Math.round((Date.now() - inicio) / 1000);

            nodo.textContent = s < 60 ? `· ${s} s` : `· ${Math.floor(s / 60)} min ${s % 60} s`;
        }, 1000);
    }

    renderRepartoPrevio(item) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const meses = app.mesesDelReparto(item.reparto);
        const total = meses.reduce((n, m) => n + m.movimientos, 0);

        this.hidePickStep();

        $('#uploadModalState').html(`
            <div class="mt-3">
                <p class="flex items-start gap-2 text-[12px] facture-info mb-2">
                    <i data-lucide="calendar-range" class="w-3.5 h-3.5 shrink-0 mt-[1px]"></i>
                    <span class="font-semibold">Este archivo trae ${esc(meses.length)} meses</span>
                </p>
                <div class="chk-box">
                    <p class="chk-lead">Sus <strong>${esc(Number(total).toLocaleString('en-US'))}</strong> movimientos se guardan en el mes de cada uno. Si desmarcas un mes, sus movimientos no se suben:</p>
                    ${UploadCheck.reparto({ reparto: item.reparto })}
                </div>
            </div>
        `);

        $('#uploadModalState .chk-mes').on('change', () => app.syncSeleccion({ reparto: item.reparto }));

        if (window.lucide) lucide.createIcons();
    }

    // Debajo de la lista de meses del detalle: los marcados que no tienen su reporte
    // de ventas, y cual es el mes que si se puede subir.
    renderMesesSinReporte(sinReporte, permitidos) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        $('#uploadMesSinReporte').remove();

        if (!sinReporte.length) return;

        const lista = (claves) => UploadCheck.listaDeMeses(claves.map((k) => {
            const p = { mes: Number(k.slice(5, 7)), anio: Number(k.slice(0, 4)) };

            return { anio: p.anio, periodo: app.periodoTexto(p) };
        }), 'y');

        $('#uploadModalState').append(`
            <p id="uploadMesSinReporte" class="mt-2 flex items-start gap-2 text-[12px] facture-warn">
                <i data-lucide="alert-triangle" class="w-3.5 h-3.5 shrink-0 mt-[1px]"></i>
                <span>Sube el detalle de <b>${esc(lista(permitidos))}</b>: es el mes del reporte de ventas que ya está cargado. ${esc(lista(sinReporte))} no tiene su reporte: desmárcalo, o sube primero su reporte de ventas.</span>
            </p>
        `);

        if (window.lucide) lucide.createIcons();
    }

    // El mes que trae cada archivo, para confirmarlo antes de subir.
    renderPeriodoDetectado(revisados, meses, mezclados) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const marco = FACTURE_THEME_IS_LIGHT ? 'border-gray-300' : 'border-[#374151]';

        // En el aviso cada archivo dice TODOS sus meses, no solo el que mas pesa: es
        // la prueba de que no comparten ninguno.
        const todos = (r) => (r.reparto || [])
            .filter((m) => m.movimientos > 0)
            .map((m) => `${app.periodoTexto(m)} · ${Number(m.movimientos).toLocaleString('en-US')} movimientos`)
            .join(' + ');

        const fila = (r) => {
            const p     = r.periodo || app.uploadPeriod();
            const suyo  = (r.reparto || []).find((m) => m.mes === p.mes && m.anio === p.anio);
            const texto = (mezclados && todos(r)) || (r.periodo || {}).texto || app.periodoTexto();
            const movs  = suyo && !(mezclados && todos(r)) ? ` · ${Number(suyo.movimientos).toLocaleString('en-US')} movimientos` : '';

            return `
                <div class="flex items-center gap-2 rounded-lg border ${marco} px-3 py-2">
                    <i data-lucide="file-spreadsheet" class="w-4 h-4 shrink-0" style="color:#217346"></i>
                    <span class="text-[12px] font-medium truncate">${esc(r.slot.nombre)}</span>
                    <span class="flex-1"></span>
                    <span class="text-[11.5px] font-semibold facture-info shrink-0">${esc(texto)}${esc(movs)}</span>
                </div>
            `;
        };

        const titulo = mezclados
            ? 'Los dos archivos tienen que ser del mismo mes'
            : (meses.length === 1
                ? `${revisados.length > 1 ? 'Estos archivos son' : 'Este archivo es'} de ${meses[0]}`
                : 'Cada archivo trae un mes distinto');

        const ayuda = mezclados
            ? `<p class="mt-2 text-[11px] text-gray-500">El detalle de ventas se liga a los folios del reporte de ventas: con meses distintos no se encuentran. Pulsa «Volver», quita el que no corresponde y elige el del mismo mes. La fecha del nombre del archivo es la del día en que se exportó, no la del mes que trae.</p>`
            : '';

        this.hidePickStep();

        $('#uploadModalState').html(`
            <div class="mt-3">
                <p class="flex items-start gap-2 text-[12px] ${mezclados ? 'facture-warn' : 'facture-info'} mb-2">
                    <i data-lucide="${mezclados ? 'calendar-x' : 'calendar-check'}" class="w-3.5 h-3.5 shrink-0 mt-[1px]"></i>
                    <span class="font-semibold">${esc(titulo)}</span>
                </p>
                <div class="flex flex-col gap-2">${revisados.map(fila).join('')}</div>
                ${ayuda}
            </div>
        `);

        if (window.lucide) lucide.createIcons();
    }

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

        const cola = pct >= 100      ? 'cerrando el lote...'
                   : avance.restante > 0 ? `faltan ${this.tiempoAprox(avance.restante)}`
                   : '';

        const falta = cola ? `<span class="text-[11px] text-gray-500">· ${esc(cola)}</span>` : '';

        if ($('#uploadBarBox').length) {
            $('#uploadBarTitle').text(`Guardando ${nombre.toLowerCase()}...`);
            $('#uploadBarPct').text(`${pct}%`);
            $('#uploadBarFill').css('width', `${pct}%`);
            $('#uploadBarRows').html(`<strong>${miles(avance.filas)}</strong> de ${miles(avance.total)} filas guardadas ${falta}`);
            $('#uploadBarMonths').html(meses);

            return;
        }

        $('#uploadModalState').html(`
            <div id="uploadBarBox" class="mt-3">
                <p class="flex items-center justify-between gap-2 text-[12px] facture-info">
                    <span class="flex items-center gap-2">
                        <i data-lucide="loader-2" class="w-3.5 h-3.5 shrink-0 animate-spin"></i>
                        <span id="uploadBarTitle">Guardando ${esc(nombre.toLowerCase())}...</span>
                    </span>
                    <strong id="uploadBarPct">${pct}%</strong>
                </p>
                <div class="mt-2 h-1.5 w-full rounded-full ${marco} overflow-hidden">
                    <div id="uploadBarFill" class="h-full rounded-full transition-all duration-500" style="width:${pct}%;background:#217346"></div>
                </div>
                <p class="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-gray-500">
                    <span id="uploadBarRows"><strong>${miles(avance.filas)}</strong> de ${miles(avance.total)} filas guardadas ${falta}</span>
                    <span id="uploadBarMonths">${meses}</span>
                </p>
            </div>
        `);

        if (window.lucide) lucide.createIcons();
    }

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

    renderUploadRejected(v, fileName, destino) {
        const nombre = (tipo) => (app.uploadSlots().find((x) => x.tipo === tipo) || {}).nombre || tipo || '';

        const ctx = {
            titulo:   nombre(destino || UPLOAD_TAB),
            periodo:  app.periodoTexto(),
            sugerido: nombre(v.sugerido)
        };

        this.hidePickStep();

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

        $('#uploadModalState .chk-mes').on('change', () => app.syncSeleccion(v));

        const aviso = document.getElementById('uploadModalState');

        if (aviso) aviso.scrollIntoView({ block: 'start' });

        if (window.lucide) lucide.createIcons();
    }

    hidePickStep() {
        $('#uploadModalFiles').hide();
        $('#uploadModalDrop').hide();
    }

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
            <div class="mt-1.5 ml-5 rounded-lg border ${marco} px-2.5 py-2">
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

    bitacoraCarga(hojas) {
        const acta = {
            nuevos: 0, yaEstaban: 0, refrescados: 0, perdidos: 0, rechazados: 0,
            de: { nuevos: [], yaEstaban: [], refrescados: [], perdidos: [], rechazados: [], sinDatos: [] }
        };

        (hojas || []).forEach((h) => {
            const entraron   = Number(h.filas) || 0;
            const borradas   = Number(h.reemplazadas) || 0;
            const omitidos   = Number(h.omitidos) || 0;
            const rechazadas = Number(h.rechazadas) || 0;

            const refrescados = Math.min(entraron, borradas);

            const perdidos = Math.max(0, borradas - entraron);

            const anota = (campo, cuanto) => {
                if (cuanto <= 0) return;

                acta[campo] += cuanto;
                acta.de[campo].push(h.nombre);
            };

            anota('nuevos',      entraron - refrescados);
            anota('yaEstaban',   omitidos);
            anota('refrescados', refrescados);
            anota('perdidos',    perdidos);
            anota('rechazados',  rechazadas);

            if ((Number(h.leidas) || 0) === 0) acta.de.sinDatos.push(h.nombre);
        });

        return acta;
    }

    actosCarga(a) {
        const hojas = (lista) => lista.join(' · ');
        const actos = [{
            icono:  'check',
            tono:   a.nuevos > 0 ? 'ok' : 'mute',
            cifra:  a.nuevos,
            titulo: 'se guardaron',
            nota:   a.nuevos > 0 ? hojas(a.de.nuevos) : 'ningún movimiento nuevo entró al periodo'
        }];

        if (a.yaEstaban > 0) actos.push({
            icono:  'equal',
            tono:   'neutro',
            cifra:  a.yaEstaban,
            titulo: 'ya estaban',
            nota:   hojas(a.de.yaEstaban)
        });

        if (a.refrescados > 0) actos.push({
            icono:  'refresh-cw',
            tono:   'warn',
            cifra:  a.refrescados,
            titulo: 'se refrescaron',
            nota:   hojas(a.de.refrescados) + ' · son los mismos de antes: esta hoja se reescribe entera en cada carga'
        });

        if (a.perdidos > 0) actos.push({
            icono:  'file-minus',
            tono:   'warn',
            cifra:  a.perdidos,
            titulo: 'ya no vienen en el archivo',
            nota:   hojas(a.de.perdidos) + ' · estaban en la carga anterior y se fueron con ella'
        });

        if (a.rechazados > 0) actos.push({
            icono:  'alert-triangle',
            tono:   'warn',
            cifra:  a.rechazados,
            titulo: 'se rechazaron',
            nota:   hojas(a.de.rechazados) + ' · el renglón venía incompleto'
        });

        if (a.de.sinDatos.length) actos.push({
            icono:  'minus',
            tono:   'mute',
            cifra:  a.de.sinDatos.length,
            titulo: a.de.sinDatos.length === 1 ? 'hoja sin movimientos' : 'hojas sin movimientos',
            nota:   hojas(a.de.sinDatos)
        });

        return actos;
    }

    tonoActo(nombre) {
        const claro  = { ok: '#047857', neutro: '#374151', warn: '#B45309', mute: '#9CA3AF' };
        const oscuro = { ok: '#34D399', neutro: '#E5E7EB', warn: '#FBBF24', mute: '#9CA3AF' };

        return (FACTURE_THEME_IS_LIGHT ? claro : oscuro)[nombre];
    }

    renderUploadDone(cargas, pendientes) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const marco   = FACTURE_THEME_IS_LIGHT ? 'border-gray-200' : 'border-[#374151]';
        const periodo = app.periodoTexto();

        const renglon = (acto) => `
            <div class="flex items-start gap-2">
                <i data-lucide="${acto.icono}" class="w-3.5 h-3.5 shrink-0 mt-[2px]" style="color:${this.tonoActo(acto.tono)}"></i>
                <span class="w-12 shrink-0 text-right text-[13.5px] font-semibold leading-[17px] tabular-nums" style="color:${this.tonoActo(acto.tono)}">
                    ${Number(acto.cifra || 0).toLocaleString('en-US')}
                </span>
                <span class="min-w-0">
                    <span class="block text-[12px] font-semibold leading-[17px]">${esc(acto.titulo)}</span>
                    <span class="block text-[10.5px] leading-[14px] text-gray-500">${esc(acto.nota)}</span>
                </span>
            </div>
        `;

        const bloque = (c) => {
            const hojas = c.data.hojas || [];

            return `
                <div class="mt-1.5 rounded-lg border ${marco} px-3 py-2">
                    <p class="flex items-baseline justify-between gap-2 mb-1.5">
                        <span class="text-[12.5px] font-semibold">${esc(c.slot.nombre)}</span>
                        <span class="text-[10.5px] text-gray-500">${esc(c.periodo ? app.periodoTexto(c.periodo) : periodo)}</span>
                    </p>
                    <div class="grid gap-1.5">
                        ${this.actosCarga(this.bitacoraCarga(hojas)).map(renglon).join('')}
                    </div>
                    ${hojas.map(h => this.cambiosDeImporte(h)).join('')}
                </div>
            `;
        };

        const pendiente = (slot) => `
            <div class="mt-1.5 flex items-center gap-2.5 rounded-lg border border-dashed px-2.5 py-1.5"
                 style="border-color:${this.tonoPendiente('borde')};background:${this.tonoPendiente('fondo')}">
                <i data-lucide="file-spreadsheet" class="w-4 h-4 shrink-0" style="color:#217346"></i>
                <span class="min-w-0">
                    <span class="block text-[11.5px] facture-warn">Falta el archivo <strong>${esc(slot.archivo)}</strong>: súbelo para continuar</span>
                    <span class="block text-[10.5px] text-gray-500">${esc(slot.desglosa)}</span>
                </span>
                <span class="flex-1"></span>
                <button type="button" data-pendiente="${esc(slot.tipo)}"
                        class="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium facture-warn shrink-0"
                        style="border-color:${this.tonoPendiente('borde')}">
                    <i data-lucide="upload" class="w-3 h-3"></i>
                    Subir
                </button>
            </div>
        `;

        const enlace = `
            <p class="mt-1.5">
                <a href="/app/wansoft/cargas.php" target="_blank" rel="noopener"
                   class="inline-flex items-center gap-1.5 text-[11px] font-medium facture-info hover:underline">
                    Ver detalle en Importación mensual
                    <i data-lucide="external-link" class="w-3 h-3"></i>
                </a>
            </p>
        `;

        this.hidePickStep();
        $('#uploadModalDrop').empty();
        $('#uploadModalState').html(`
            <div class="mt-1">
                ${cargas.map(bloque).join('')}
                ${cargas.length ? enlace : ''}
                ${(pendientes || []).map(pendiente).join('')}
            </div>
        `);

        if (window.lucide) lucide.createIcons();

        $('#uploadModalState [data-pendiente]').on('click', function () {
            app.retomarUpload($(this).attr('data-pendiente'));
        });
    }

    renderUploadInvite(info) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const dias = (info.dias || []).filter((d) => d.sinRepartir);
        const lista = dias.slice(0, 3).map((d) => d.fechaTexto).join(', ')
                    + (dias.length > 3 ? ` y ${dias.length - 3} más` : '');

        $('#uploadModalState').append(`
            <div class="mt-1.5 flex items-start gap-2.5 rounded-lg border px-2.5 py-1.5"
                 style="border-color:#C7D7FB;background:${FACTURE_THEME_IS_LIGHT ? '#F5F8FF' : '#111B2E'}">
                <i data-lucide="receipt" class="w-4 h-4 shrink-0 facture-info mt-[1px]"></i>
                <span class="min-w-0">
                    <span class="block text-[11.5px] facture-info">
                        ${esc(info.mesTexto)} tiene ${esc(dias.length)} ${dias.length !== 1 ? 'días' : 'día'} sin tickets: ${esc(lista)}
                    </span>
                    <span class="block text-[10.5px] text-gray-500">Continúa con la generación y elige si repartes uno o el mes completo.</span>
                </span>
            </div>
        `);

        if (window.lucide) lucide.createIcons();
    }

    tonoCargado(parte) {
        const claro  = { borde: '#BBE5CD', fondo: '#F1F9F4' };
        const oscuro = { borde: '#265E42', fondo: '#13291E' };

        return (FACTURE_THEME_IS_LIGHT ? claro : oscuro)[parte];
    }

    tonoPendiente(parte) {
        const claro  = { borde: '#E0CBA8', fondo: '#FDFAF4' };
        const oscuro = { borde: '#4A3B28', fondo: '#221B12' };

        return (FACTURE_THEME_IS_LIGHT ? claro : oscuro)[parte];
    }

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
                icon:   'receipt',
                title:  ticket ? `Ticket virtual · Nota ${ticket.nota}` : 'Ticket virtual',
                action: ticket
                    ? { id: 'btnImprimir', icon: 'printer', text: 'Imprimir', title: 'Imprimir este ticket', fn: () => tickets.printTicket() }
                    : null,
                badges: ticket
                    ? [
                        ticket.grupo === 'servicio'
                            ? { text: 'Servicio de mesa', tone: 'b-gray' }
                            : { text: ticket.tasaText === '0%' ? 'IVA 0%' : `IVA ${ticket.tasaText}`, tone: ticket.tasaText === '0%' ? 'b-yellow' : 'b-terra' },
                        ticket.generado
                            ? { text: 'papel guardado', tone: 'b-blue' }
                            : (ticket.grupo === 'ivaGenerado' || ticket.grupo === 'servicio'
                                ? { text: 'propuesta', tone: 'b-yellow' }
                                : { text: 'consumo real', tone: 'b-gray' }),
                        ...(ticket.fueraTolerancia ? [{ text: `Descuento ${ticket.descuento}`, tone: 'b-yellow' }] : [])
                      ]
                    : []
            }
        });

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

    previewNote(ticket) {
        if (ticket.grupo === 'servicio') {
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

    ajusteText(ticket) {
        if (!ticket.conAjuste) return '';
        if (ticket.grupo !== 'cero' && ticket.grupo !== 'ivaGenerado') return '';

        if (ticket.fueraTolerancia) {
            return ` Se cuadro con un descuento de ${ticket.descuento}, que pasa la tolerancia de ${ticket.tolerancia}.`;
        }

        // El excedente de la tolerancia no desaparece: se le cargo al producto que
        // remata el papel, y la nota lo dice para que el ajuste no quede escondido.
        if (ticket.conAlProducto) {
            return ` Se cuadro con un descuento de ${ticket.descuento}, el tope de la tolerancia; los ${ticket.alProducto} restantes se descontaron del importe del producto.`;
        }

        return ` Se cuadro con un descuento de ${ticket.descuento}.`;
    }

    // -- Components --

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
