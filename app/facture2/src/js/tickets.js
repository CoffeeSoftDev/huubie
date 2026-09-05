let apiTickets = '/app/facture/ctrl/ctrl-facture-tickets.php';
let app, tickets, ticketsView;

const apiCargas = '/app/facture/ctrl/ctrl-facture-cargas.php';

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
    }

    async init() {
        this.dataInit = await useFetch({ url: apiTickets, data: { opc: 'init', dia: this.getParam('dia') } });
        this.meta     = this.loadMeta();

        this.hideTitleOnPrint();
        this.render();
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
                onClick:   () => tickets.startGenerate()
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
            {
                opc:       'button',
                id:        'btnCargarVentas',
                text:      'Subir Excel',
                color_btn: 'light',
                class:     'col-12 col-md-4 col-lg-2 lg:col-start-10',
                className: 'whitespace-nowrap !px-2',
                onClick:   () => app.openUploadModal()
            },
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

    decorateUploadButton() {
        $('#btnCargarVentas')
            .addClass('flex items-center justify-center gap-2')
            .prepend($('<i>', { 'data-lucide': 'upload', class: 'w-4 h-4', style: 'color:#217346' }));

        if (window.lucide) lucide.createIcons();
    }

    hideActionButtons() {
        ['btnGenerarTodos', 'btnImprimirTodos', 'btnRehacer'].forEach(id => {
            $(`#${id}`).closest('[class*="col-"]').hide();
        });
    }

    syncActionButtons(counts) {
        const repartido = (counts.generados || 0) > 0;
        const columna   = (id) => $(`#${id}`).closest('[class*="col-"]');

        columna('btnGenerarTodos').toggle(!repartido);
        columna('btnImprimirTodos').toggle(repartido);
        columna('btnRehacer').toggle(repartido);
    }

    // -- Dia sin datos --

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

    getFilters() {
        return {
            dia:       $('#fDia').val() || this.dataInit.dia,
            metaModo:  this.meta.modo,
            metaValor: this.meta.valor,
            metaCero:  this.meta.cero
        };
    }

    // -- Event handlers --

    async onChangeFilters() {
        await tickets.lsTickets();

        if (this.selectedId && !this.isVisibleAfterFilters(this.selectedId)) {
            this.selectTicket(null);
        }
    }

    isVisibleAfterFilters(folio) {
        return $(`#tb${this.PROJECT_NAME} [data-folio="${folio}"]`).length > 0;
    }

    // -- Distribucion IVA 16% / IVA 0% --

    openMetaModal() {
        if (this.metaModal) return;

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

    onChangeMetaModo() {
        const modo  = $('#fMetaModo').val();
        const total = parseFloat(this.dataKpis.total) || 0;

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

    openUploadModal() {
        if (this.uploadModal) return;

        this.uploadFiles       = [];
        this.progressTimer     = null;
        this.progressFrom      = 0;
        this.mesesElegidos     = null;
        this.repartoConfirmado = false;

        this.cargasHechas = [];

        this.pendienteTab = null;
        this.periodosTab  = {};

        this.uploadModal = this.cfModal({
            title:         'Actualizar ventas',
            size:          'large',
            theme:         FACTURE_THEME,
            okLabel:       'Subir ventas',
            cancelLabel:   'Cancelar',
            backdropClose: false,
            onOk:          () => this.sendUpload(),
            onClose:       () => { this.stopProgress(); this.uploadModal = null; }
        });

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
                        id:   'uploadModalFiles'
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

        $('#fUpMes, #fUpAnio').on('change', () => this.onPeriodChange());

        this.loadPeriodFiles();
    }

    onPeriodChange() {
        this.renderUploadList();
        this.showPeriodFiles();
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

    uploadYears() {
        const actual = new Date(this.dataInit.dia + 'T00:00:00').getFullYear();

        return [0, 1, 2].map((n) => ({ id: String(actual - n), valor: String(actual - n) }));
    }

    // -- Los dos archivos del dia --

    uploadSlots() {
        return [
            {
                tipo:     UPLOAD_TAB,
                nombre:   'Reporte de ventas',
                archivo:  'ReporteVentasPorFormaDePago',
                desglosa: 'Trae los folios, los montos y la forma de cobro del día',
                falta:    'Sin el no se puede repartir el dia.'
            },
            {
                tipo:     COMMANDS_TAB,
                nombre:   'Detalle de ventas',
                archivo:  'ReporteDetalleDeVentas',
                desglosa: 'Desglosa las ventas: sin él los tickets del 16% dicen CONSUMO',
                falta:    'Sin él, los tickets del 16% se imprimen con un renglón que dice CONSUMO en vez de los platillos.'
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

        $('#uploadModalForm').show();
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
        return {
            mes:  $('#fUpMes').val(),
            anio: $('#fUpAnio').val()
        };
    }

    periodoTexto() {
        return `${$('#fUpMes option:selected').text()} ${$('#fUpAnio').val()}`;
    }

    // Revisar y cargar, en ese orden: inspectFile lee el libro SIN guardar nada y de
    // ahi sale a que pestaña pertenece —lo decide el CONTENIDO, no el nombre ni la
    // pantalla—. Las ventas se suben antes que las comandas, que cuelgan de sus folios.
    async sendUpload() {
        if (!this.uploadFiles.length) return;

        const periodo = this.uploadPeriod();

        if (!periodo.mes || !periodo.anio) {
            return this.alertBox({ theme: FACTURE_THEME, type: 'message', title: 'Indica el mes y el año de estas ventas' });
        }

        this.lockUploadOk(true);

        const revisados = (this.repartoConfirmado && this.revisadosPrevios) || [];

        for (const file of (revisados.length ? [] : this.uploadFiles)) {
            ticketsView.renderUploadStep(`Revisando ${file.name}...`);

            const porNombre = this.slotDelNombre(file.name);
            const revision  = await this.postFile('inspectFile', periodo, (porNombre || {}).tipo || UPLOAD_TAB, file);

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

            revisados.push({ file: file, destino: destino, slot: slot, reparto: revision.reparto || [] });
        }

        const conVariosMeses = revisados.find((r) => this.mesesDelReparto(r.reparto).length > 1);

        if (conVariosMeses && !this.repartoConfirmado) {
            this.revisadosPrevios = revisados;

            ticketsView.renderRepartoPrevio(conVariosMeses);
            this.syncSeleccion({ reparto: conVariosMeses.reparto });
            this.setUploadCancel(() => this.backToPick());

            return;
        }

        this.repartoConfirmado = false;
        this.revisadosPrevios  = null;

        revisados.sort((a, b) => (a.destino === UPLOAD_TAB ? -1 : 1));

        for (const item of revisados) {
            ticketsView.renderUploadStep(`Subiendo ${item.file.name}...`, this.fileSizeText(item.file.size));

            await this.watchProgress(item);

            const carga = await this.postFile('uploadFile', periodo, item.destino, item.file);

            this.stopProgress();

            if (carga.status !== 200) {
                if (carga.validacion) return this.rejectUpload(carga.validacion, item.file.name, item.destino);

                ticketsView.renderUploadError(carga.message || `No se pudo procesar ${item.file.name}`);
                this.lockUploadOk(false);
                return;
            }

            this.anotarCarga(item.slot, carga);
        }

        ticketsView.renderUploadDone(this.cargasHechas, this.slotsPendientes());

        await tickets.lsTickets();

        const alcance = await this.scopeDelPeriodo();

        if (alcance && alcance.pendientes > 0) {
            ticketsView.renderUploadInvite(alcance);
            this.setUploadAction('Generar tickets', () => this.fromUploadToScope(alcance));
        } else {
            this.setUploadAction('Listo', () => this.uploadModal.close());
        }

        this.setUploadCancel(null);

        this.lockUploadOk(false);
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

    fromUploadToScope(info) {
        this.uploadModal.close();

        this.openScopeModal(info);
    }

    anotarCarga(slot, data) {
        this.cargasHechas = (this.cargasHechas || []).filter((c) => c.slot.tipo !== slot.tipo);

        this.cargasHechas.push({ slot: slot, data: data });
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

    slotCargado(tipo) {
        if ((this.cargasHechas || []).some((c) => c.slot.tipo === tipo)) return true;

        const periodo = this.uploadPeriod();
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
        ticketsView.renderUploadRejected(v, fileName, destino);
        this.lockUploadOk(false);
        this.setUploadCancel(() => this.backToPick());

        if (!UploadCheck.mudaPeriodo(v)) return;

        this.syncSeleccion(v);
    }

    mesesDelReparto(reparto) {
        return (reparto || []).filter((m) => m.movimientos > 0);
    }

    confirmarReparto() {
        if (!(this.mesesElegidos || []).length) return;

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

        this.setUploadAction(UploadCheck.accionMover(v, elegidos), accion);
        this.lockUploadOk(elegidos.length === 0);
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
        if (!this.setUploadPeriod(mes, anio)) {
            return ticketsView.renderUploadError(
                `El año ${anio} no esta en la lista del modal: esa carga se hace desde Importacion.`
            );
        }

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

        boton.off('click');

        if (accion) boton.on('click', accion);
        else        boton.on('click', () => this.uploadModal.close());
    }

    backToPick() {
        this.mesesElegidos     = null;
        this.repartoConfirmado = false;
        this.revisadosPrevios  = null;

        this.renderUploadList();
    }

    setUploadPeriod(mes, anio) {
        $('#fUpMes').val(String(mes));
        $('#fUpAnio').val(String(anio));

        return $('#fUpMes').val() === String(mes) && $('#fUpAnio').val() === String(anio);
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
            .append($('<i>', { 'data-lucide': 'settings', class: 'w-4 h-4' }));

        if (window.lucide) lucide.createIcons();

        this.syncMetaButton();
    }

    syncMetaButton() {
        const valor = this.meta.modo === 'monto'
            ? (this.dataKpis.objetivoTexto || this.moneyText(this.meta.valor))
            : `${this.pctText(this.meta.valor)}%`;

        $('#btnMetaConfig').attr('title', `Distribucion IVA 16% / IVA 0% · al 16%: ${valor}`);
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

        this.previewScope = data.mes ? 'mes' : 'dia';

        this.previewModal = this.cfModal({
            title:         data.mes ? `Vista previa del reparto · ${data.fechaTexto}` : 'Vista previa del reparto',
            size:          'default',
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

    lockPreview(bloquear) {
        if (!this.previewModal) return;

        this.previewModal.footer.find('button')
            .prop('disabled', bloquear)
            .toggleClass('opacity-50 cursor-not-allowed', bloquear);
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

        this.scopeModal.body.append($('<div>', { id: 'scopeModalBody' }));

        const dia      = this.getFilters().dia;
        const enElMes  = info.dias.find((d) => d.dia === dia);
        const primero  = info.dias.find((d) => d.sinRepartir) || info.dias[0];

        ticketsView.renderScope(info, (enElMes || primero).dia);

        $('#scopeModalBody input[name="scopeKind"]').on('change', () => ticketsView.syncScope());
    }

    async applyScope() {
        const alcance = $('#scopeModalBody input[name="scopeKind"]:checked').val() || 'dia';
        const dia     = $('#fScopeDia').val();
        const mes     = (this.scopeInfo || {}).mes || '';

        this.scopeModal.close();

        if (alcance === 'mes') return tickets.previewMonth(0, mes);

        if (dia && dia !== this.getFilters().dia) {
            $('#fDia').val(dia);
            await this.onChangeFilters();
        }

        tickets.previewDay();
    }

    // -- Facade --

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
        this.semilla      = 0;
    }

    // Una corrida a la vez: el cierre tarda segundos y el segundo clic entra cuando
    // el primero todavia no guarda, asi que las dos peticiones leen "esta venta no
    // tiene ticket" y el mismo cobro termina con dos notas (sale_id no es UNIQUE).
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

    async lsTickets() {
        const data = await useFetch({ url: apiTickets, data: Object.assign({ opc: 'lsTickets' }, app.getFilters()) });

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

        const servicio = counts.servicio || 0;
        const aparte   = servicio > 0 ? `, ${servicio} de servicio de mesa` : '';

        app.updateFooterInfo(`Mostrando ${counts.mostrados} ticket${counts.mostrados !== 1 ? 's' : ''} del dia${aparte}`);
    }

    dataTable(id, data) {
        if (!(data.row || []).length) return;

        if (typeof simple_data_table === 'function') simple_data_table(id, 100);
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

        app.openPreviewModal(data);
    }

    async startGenerate() {
        const data = await useFetch({
            url:  apiTickets,
            data: Object.assign({ opc: 'scopeMonth' }, app.getFilters())
        });

        if (data.status !== 200 || (data.pendientes || 0) < 2) return this.previewDay();

        app.openScopeModal(data);
    }

    async previewMonth(semilla = 0, mes = '') {
        this.semilla  = semilla;
        this.scopeMes = mes || this.scopeMes || '';

        app.lockPreview(true);

        const data = await useFetch({
            url:  apiTickets,
            data: Object.assign({ opc: 'previewMonth', semilla: this.semilla, mes: this.scopeMes }, app.getFilters())
        });

        app.lockPreview(false);

        if (data.status !== 200) {
            this.alertBox({ theme: FACTURE_THEME, type: 'error', title: data.message, timer: 0 });
            return;
        }

        app.openPreviewModal(data);
    }

    regenerate() {
        if (app.previewScope === 'mes') return this.previewMonth(this.semilla + 1);

        this.previewDay(this.semilla + 1);
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
            const response = await useFetch({
                url:  apiTickets,
                data: Object.assign({ opc: 'generateMonth', semilla: this.semilla, mes: this.scopeMes || '' }, app.getFilters())
            });

            if (response.status !== 200) {
                this.alertBox({ theme: FACTURE_THEME, type: 'error', title: response.message, timer: 0 });
                return;
            }

            await this.lsTickets();

            ticketsView.renderResumenReparto(response);

            if (response.falla) {
                this.alertBox({
                    theme: FACTURE_THEME,
                    type:  'error',
                    title: `El mes se detuvo en ${response.falla.fechaTexto}: ${response.falla.message}`,
                    timer: 0
                });
            }
        });
    }

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
            if (result.isConfirmed)   this.previewDay();
            else if (result.isDenied) this.deleteDay();
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

    async printSheet() {
        const data = await useFetch({ url: apiTickets, data: Object.assign({ opc: 'showPrintSheet' }, app.getFilters()) });

        if (data.status !== 200) {
            this.alertBox({ type: 'error', title: data.message, timer: 0 });
            return;
        }

        ticketsView.renderPrintSheet(data.tickets, data.emisor);

        $('body').addClass('printing-sheet');
        window.print();
        $('body').removeClass('printing-sheet');
    }

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
        const lineas = (mudados || []).slice(0, 3).map((mov) =>
            `El cargo de ${mov.montoTexto} de la cuenta ${mov.origen} lo factura ahora el folio ${mov.destino}, que se cobro en ${mov.pagoDestino}.`
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
            toast.append($('<div>', { class: i ? 'mt-1.5' : '', text: linea }));
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

    renderStats(k, counts) {
        const pctCero = k.metaCeroPct || 30;

        const rotulo16 = k.metaModo === 'monto'
            ? `IVA 16% · cantidad fija`
            : `IVA 16% · ${k.metaPct || 70}%`;

        const row = $('<div>', { class: 'w-full flex items-center flex-wrap gap-y-2' });

        const servicio = k.servicio
            ? ` · ${k.servicio} de servicio de mesa, que no facturan`
            : '';

        row.append(this.statCell('Tarjeta de credito', k.totalTexto, 'ws-stat-hero',
            `${k.tickets || 0} folios con cargo a tarjeta${servicio}`));

        row.append(this.statCell(rotulo16, k.objetivoTexto, 'ws-stat-blue',
            `${k.metaPct || 70}% de la venta con tarjeta`));

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

        const opcion = (d) => `
            <option value="${esc(d.dia)}" ${d.dia === diaSugerido ? 'selected' : ''}>
                ${esc(d.fechaTexto)} · ${esc(d.totalTexto)}${d.sinRepartir ? '' : ' · ya repartido'}
            </option>
        `;

        const pendientes = info.dias.filter((d) => d.sinRepartir).length;

        $('#scopeModalBody').html(`
            <p class="text-[11px] ${label}">${esc(info.mesTexto)} · ${esc(info.dias.length)} dia${info.dias.length !== 1 ? 's' : ''} con ventas · ${esc(pendientes)} sin repartir</p>

            <label class="mt-3 block rounded-lg border ${marco} p-3 cursor-pointer" data-scope="dia">
                <span class="flex items-center gap-2">
                    <input type="radio" name="scopeKind" value="dia" checked class="accent-[#1C64F2]">
                    <span class="text-[12.5px] font-semibold ${valor}">Un dia</span>
                </span>
                <select id="fScopeDia" class="mt-2 w-full rounded-lg border px-2 py-1.5 text-[12px] ${campo}">
                    ${info.dias.map(opcion).join('')}
                </select>
            </label>

            <label class="mt-2 block rounded-lg border ${marco} p-3 cursor-pointer" data-scope="mes">
                <span class="flex items-center gap-2">
                    <input type="radio" name="scopeKind" value="mes" class="accent-[#1C64F2]">
                    <span class="text-[12.5px] font-semibold ${valor}">Todo el mes</span>
                    <span class="ml-auto text-[12px] font-bold ${valor}">${esc(info.totalTexto)}</span>
                </span>
                <span class="mt-1 block pl-6 text-[10.5px] ${label}">
                    ${esc(info.dias.length)} dias · ${esc(info.movimientos)} movimientos · ${esc(info.conCargo)} con cargo a tarjeta
                </span>
            </label>

            <p class="mt-2 text-[10.5px] facture-warn">
                El mes se cierra dia por dia, con la misma meta y su propia numeracion de notas: son varias corridas, no una sola del mes.
            </p>
        `);

        this.syncScope();
    }

    syncScope() {
        const elegido = $('#scopeModalBody input[name="scopeKind"]:checked').val();
        const apagado = FACTURE_THEME_IS_LIGHT ? '#E5E7EB' : '#374151';

        $('#scopeModalBody [data-scope]').each(function () {
            const activo = $(this).attr('data-scope') === elegido;

            $(this).css('border-color', activo ? '#1C64F2' : apagado);
        });
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
            <p class="mt-2 text-[10px] facture-info">El monto al IVA ${esc(p.sugerido)}% es el resto del total. Corrigelo si el acuerdo es otro.</p>
        ` : '';

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

    // Las clases de tema se resuelven aqui y no con los tokens del modulo:
    // facture-theme traduce la paleta bajo #mainContainer y cfModal monta su panel
    // al final del <body>, fuera de ese scope.
    renderPreviewDay(p) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const linea = FACTURE_THEME_IS_LIGHT ? 'border-gray-200' : 'border-[#374151]';
        const valor = FACTURE_THEME_IS_LIGHT ? 'text-gray-900' : 'text-white';
        const label = FACTURE_THEME_IS_LIGHT ? 'text-gray-600' : 'text-gray-400';

        const tasa = (color, nombre, pct, tickets, monto) => `
            <div class="flex items-baseline gap-2.5 py-1.5">
                <span class="w-2 h-2 rounded-full shrink-0" style="background:${color};"></span>
                <span class="text-[12px] font-semibold ${valor}">${esc(nombre)}</span>
                <span class="w-12 text-[11.5px] font-semibold tabular-nums ${valor}">${esc(pct)}%</span>
                <span class="text-[10.5px] ${label}">${esc(tickets)} ticket${Number(tickets) !== 1 ? 's' : ''}</span>
                <span class="ml-auto text-[13px] font-bold ${valor}">${esc(monto)}</span>
            </div>
        `;

        const tono = p.sobreMeta ? '#1C64F2' : '#F59E0B';

        const marcador = `
            <div class="flex items-baseline justify-between gap-2 mb-1.5">
                <span class="text-[10.5px] ${label}">Reparto aplicado</span>
                <span class="inline-flex items-center gap-1.5 rounded-full border px-2 py-[1px] text-[10.5px] font-semibold tabular-nums"
                      style="border-color:${tono};color:${tono};">
                    Meta ${esc(p.metaPct)}% &rarr; aplicado ${esc(p.pct16)}%
                </span>
            </div>
        `;

        const distancia = `
            <p class="mt-1 text-[10.5px] ${label}">
                Objetivo capturado ${esc(p.objetivoTexto)} ·
                ${p.sobreMeta ? 'se rebasa por' : 'faltan'} <span class="font-semibold" style="color:${tono};">${esc(String(p.difTexto).replace(/^[+-]/, ''))}</span>
            </p>
        `;

        const dias = (p.dias || []).length ? `
            <div class="mt-3 pt-3 border-t ${linea}">
                <p class="text-[9.5px] font-semibold uppercase tracking-wider ${label}">Dia por dia</p>
                <div class="mt-1.5 grid gap-1">
                    ${p.dias.map(d => d.error ? `
                        <div class="flex items-baseline gap-2 text-[11.5px]">
                            <span class="w-10 shrink-0 font-semibold ${valor}">${esc(d.fechaTexto)}</span>
                            <span class="facture-warn text-[10.5px]">${esc(d.error)}</span>
                        </div>
                    ` : `
                        <div class="flex items-baseline gap-2 text-[11.5px] tabular-nums">
                            <span class="w-10 shrink-0 font-semibold ${valor}">${esc(d.fechaTexto)}</span>
                            <span class="${valor}">${esc(d.totalTexto)}</span>
                            <span class="w-12 text-[11px] font-semibold" style="color:#1C64F2;">${esc(d.pct16)}%</span>
                            <span class="text-[10.5px] ${label}">${esc(d.cuenta16)} / ${esc(d.cuenta0)}</span>
                            <span class="ml-auto text-[10.5px] ${label}">${esc(d.tickets)} tickets</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : '';

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
            <p class="text-[11px] ${label}">${esc(p.fechaTexto)}${p.mes ? ` · ${(p.dias || []).length} dias con ventas` : ''} · todavia no se guarda nada</p>

            <div class="mt-3">
                <p class="text-[9.5px] uppercase tracking-wider ${label}">Tarjeta de credito</p>
                <p class="text-[26px] font-bold leading-tight ${valor}">${esc(p.totalTexto)}</p>
                <p class="text-[11px] ${label}">${esc(p.movimientos)} movimientos · ${esc(p.conCargo)} con cargo a tarjeta</p>
            </div>

            <div class="mt-4 pt-3 border-t ${linea}">
                ${marcador}
                <div class="flex h-5 rounded overflow-hidden text-[10px] font-semibold text-white">
                    <div class="flex items-center justify-center" style="flex:${esc(p.pct16)};background:#1C64F2;">${esc(p.pct16)}%</div>
                    <div class="flex items-center justify-center" style="flex:${esc(p.pct0)};background:#F59E0B;">${esc(p.pct0)}%</div>
                </div>
                <div class="mt-2">
                    ${tasa('#1C64F2', 'IVA 16%', p.pct16, p.cuenta16, p.monto16Texto)}
                    ${tasa('#F59E0B', 'IVA 0%',  p.pct0,  p.cuenta0,  p.monto0Texto)}
                </div>
                ${distancia}
            </div>

            ${dias}

            <div class="mt-3 pt-3 border-t ${linea}">
                <div class="flex items-baseline justify-between">
                    <span class="text-[12.5px] font-bold ${valor}">Tickets ${p.mes ? 'del mes' : 'del dia'}</span>
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

    // Los renglones van con <span class="block"> y no con <div>: alertBox mete este
    // html dentro de un <p>, y un <div> ahi adentro lo parte en dos.
    renderResumenReparto(r) {
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

        const periodo = r.mes ? 'del mes' : 'del dia';

        const cerrados = (r.dias || []).length ? `
            ${separador}
            <span class="block text-left text-gray-300 font-semibold">${esc(r.dias.length)} dia(s) cerrados</span>
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

    // -- Actualizar ventas --

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
                   class="mt-2.5 flex flex-col items-center gap-1.5 rounded-lg border border-dashed ${marco} px-4 py-4 text-center cursor-pointer">
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

        $('#uploadModalFiles').html(`
            <a href="/app/facture2/cargas.php?mes=${encodeURIComponent(mes)}&anio=${encodeURIComponent(p.anio)}"
               target="_blank" rel="noopener"
               class="mt-2.5 block group">
                <p class="flex items-center gap-1 text-[10.5px] font-semibold text-gray-500 mb-1.5 group-hover:underline">
                    Ya cargado en ${esc(periodo)}
                    <i data-lucide="external-link" class="w-3 h-3"></i>
                </p>
                <div class="flex flex-wrap gap-1.5">${cargados.map(ficha).join('')}</div>
            </a>
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
                    : ''}
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

        $('#uploadModalDrop').html(`<div class="mt-3 flex flex-col gap-2">${archivos.map(fila).join('')}${otro}</div>`);

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
                    <span>Falta 1 archivo de ${total}. Se puede subir asi, pero el dia queda incompleto.</span>
                </p>
            `) && (window.lucide ? lucide.createIcons() : null);
        }

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
                    <p class="chk-lead">Sus <strong>${esc(Number(total).toLocaleString('en-US'))}</strong> movimientos se guardan en el mes de cada uno. Desmarca el que no quieras cargar:</p>
                    ${UploadCheck.reparto({ reparto: item.reparto })}
                </div>
            </div>
        `);

        $('#uploadModalState .chk-mes').on('change', () => app.syncSeleccion({ reparto: item.reparto }));

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
        $('#uploadModalForm').hide();
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
            <div class="flex items-start gap-2.5">
                <i data-lucide="${acto.icono}" class="w-3.5 h-3.5 shrink-0 mt-[3px]" style="color:${this.tonoActo(acto.tono)}"></i>
                <span class="w-14 shrink-0 text-right text-[15px] font-semibold leading-5 tabular-nums" style="color:${this.tonoActo(acto.tono)}">
                    ${Number(acto.cifra || 0).toLocaleString('en-US')}
                </span>
                <span class="min-w-0">
                    <span class="block text-[12.5px] font-semibold">${esc(acto.titulo)}</span>
                    <span class="block text-[11px] text-gray-500">${esc(acto.nota)}</span>
                </span>
            </div>
        `;

        const bloque = (c) => {
            const hojas = c.data.hojas || [];

            return `
                <div class="mt-2 rounded-lg border ${marco} p-3">
                    <p class="flex items-baseline justify-between gap-2 mb-2.5">
                        <span class="text-[13px] font-semibold">${esc(c.slot.nombre)}</span>
                        <span class="text-[11px] text-gray-500">${esc(periodo)}</span>
                    </p>
                    <div class="grid gap-2.5">
                        ${this.actosCarga(this.bitacoraCarga(hojas)).map(renglon).join('')}
                    </div>
                    ${hojas.map(h => this.cambiosDeImporte(h)).join('')}
                    <p class="mt-2.5">
                        <a href="/app/facture2/cargas.php" target="_blank" rel="noopener"
                           class="inline-flex items-center gap-1.5 text-[11.5px] font-medium facture-info hover:underline">
                            Ver detalle en Importación mensual
                            <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                        </a>
                    </p>
                </div>
            `;
        };

        const pendiente = (slot) => `
            <div class="mt-2 flex items-center gap-2.5 rounded-lg border border-dashed px-2.5 py-2"
                 style="border-color:${this.tonoPendiente('borde')};background:${this.tonoPendiente('fondo')}">
                <i data-lucide="file-spreadsheet" class="w-5 h-5 shrink-0" style="color:#217346"></i>
                <span class="min-w-0">
                    <span class="block text-[11.5px] facture-warn">Falta el archivo <strong>${esc(slot.archivo)}</strong></span>
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

        this.hidePickStep();
        $('#uploadModalDrop').empty();
        $('#uploadModalState').html(`
            <div class="mt-1">
                ${cargas.map(bloque).join('')}
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
                    + (dias.length > 3 ? ` y ${dias.length - 3} mas` : '');

        $('#uploadModalState').append(`
            <div class="mt-2 flex items-start gap-2.5 rounded-lg border px-2.5 py-2"
                 style="border-color:#C7D7FB;background:${FACTURE_THEME_IS_LIGHT ? '#F5F8FF' : '#111B2E'}">
                <i data-lucide="receipt" class="w-5 h-5 shrink-0 facture-info"></i>
                <span class="min-w-0">
                    <span class="block text-[11.5px] facture-info">
                        ${esc(info.mesTexto)} tiene ${esc(dias.length)} dia${dias.length !== 1 ? 's' : ''} sin tickets: ${esc(lista)}
                    </span>
                    <span class="block text-[10.5px] text-gray-500">Continua con la generacion y elige si repartes uno o el mes completo.</span>
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
