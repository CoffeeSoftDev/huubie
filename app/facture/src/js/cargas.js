let apiCargas = '/app/facture/ctrl/ctrl-facture-cargas.php';
let app, cargas, cargasView;

// useFetch del framework resuelve por callback y no admite archivos; aqui se
// necesita await en todo el modulo, asi que las llamadas pasan por este helper.
const fnAjax = (data, url) => fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams(data)
}).then(r => r.json());

$(async () => {
    cargasView = new CargasView(apiCargas, 'root');
    cargas     = new Cargas(apiCargas, 'root');
    app        = new App(apiCargas, 'root');
    await app.init();
});

// -- Clase principal --

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'cargas';
        this.activeTab    = 'sales-report';
    }

    async init() {
        const data = await fnAjax({ opc: 'init' }, apiCargas);

        this.dataInit = {
            meses:    data.meses,
            anios:    data.anios,
            archivos: SAMPLE_CARGAS_ARCHIVOS
        };

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        this.renderTabs();
        cargasView.renderHeader(SAMPLE_VIEW_HEADER_CARGAS);
        cargasView.renderLogHead();
        this.renderActiveTab();
    }

    // -- Layout --

    layout() {
        const mainPanel = {
            type:  'div',
            id:    'mainPanel',
            class: 'flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 w-full',
            children: [
                {
                    id:    'headerRow',
                    class: 'px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'contentWrap',
                    class: 'p-3 flex-1 min-h-0 overflow-auto flex flex-col'
                }
            ]
        };

        // createLayout solo itera children en type 'div': para un aside caen en el
        // default y jQuery los toma como metodo. Las zonas del panel se arman aparte.
        const detailPanel = {
            type:  'aside',
            id:    'detailPanel',
            class: 'w-full md:w-[420px] flex-shrink-0 bg-[#141d2b] border-t md:border-t-0 md:border-l border-[#374151] flex flex-col overflow-hidden'
        };

        this.createLayout({
            parent: 'root',
            design: false,
            data: {
                id:        this.PROJECT_NAME,
                class:     'flex-1 min-h-0 w-full flex flex-col md:flex-row overflow-hidden',
                container: [mainPanel, detailPanel]
            }
        });

        // Titulo y filtros comparten banda: el header queda a la izquierda y los
        // selects de mes/anio a la derecha, alineados en la misma fila.
        this.createLayout({
            parent: 'headerRow',
            design: false,
            data: {
                id:    'headerInner',
                class: 'w-full flex flex-wrap items-center justify-between gap-3',
                container: [
                    { type: 'div', id: 'viewHeader', class: 'flex-1 min-w-0' },
                    { type: 'div', id: 'filterBar',  class: 'flex-shrink-0 w-full sm:w-[300px]' }
                ]
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
                        class: 'px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex items-center justify-between flex-shrink-0'
                    },
                    {
                        type:  'div',
                        id:    'detailContent',
                        class: 'flex-1 min-h-0 overflow-auto scroll-thin px-3 py-3'
                    }
                ]
            }
        });

        this.contentLayout();
    }

    // Zona scrolleable: tabs con la carga del archivo activo y, debajo, la bitacora.
    // La bitacora crece con flex-1 hasta el fondo del panel y su tabla se
    // desplaza por dentro, en vez de cortarse a una altura fija.
    contentLayout() {
        this.createLayout({
            parent: 'contentWrap',
            design: false,
            data: {
                id:    'contentGrid',
                class: 'w-full flex-1 min-h-0 flex flex-col gap-4',
                container: [
                    {
                        type:  'div',
                        id:    'tabsHost',
                        class: 'w-full flex-shrink-0'
                    },
                    {
                        type:  'div',
                        id:    'cardLog',
                        class: 'w-full flex-1 min-h-0 flex flex-col bg-[#141d2b] rounded-lg overflow-hidden',
                        children: [
                            {
                                id:    'headLog',
                                class: 'px-4 py-3 border-b border-[#374151] flex items-center justify-between flex-shrink-0'
                            },
                            {
                                id:    'tableLog',
                                class: 'flex-1 min-h-0 overflow-auto scroll-thin p-3'
                            }
                        ]
                    }
                ]
            }
        });
    }

    // Los paneles de todos los tabs coexisten en el DOM (tabLayout solo los oculta),
    // por eso cada id lleva el sufijo del tab: sin el, `$('#uploadRow')` resolvia
    // siempre al panel del primer tab y el segundo quedaba vacio.
    tabPanelLayout(tabId) {
        this.createLayout({
            parent: `container-${tabId}`,
            design: false,
            data: {
                id:    `panel-${tabId}`,
                class: 'w-full bg-[#141d2b] rounded-lg p-4 flex flex-col gap-3',
                container: [
                    { type: 'div', id: `uploadRow-${tabId}`, class: 'w-full' }
                ]
            }
        });
    }

    // -- Filter bar --

    filterBar() {
        const filters = [
            {
                opc:      'select',
                id:       'fMes',
                lbl:      'Mes:',
                class:    'col-6',
                value:    '06',
                required: false,
                onchange: 'app.onChangeFilters()',
                data:     this.dataInit.meses
            },
            {
                opc:      'select',
                id:       'fAnio',
                lbl:      'Anio:',
                class:    'col-6',
                value:    '2026',
                required: false,
                onchange: 'app.onChangeFilters()',
                data:     this.dataInit.anios
            }
        ];

        this.createfilterBar({
            parent:     'filterBar',
            coffeesoft: true,
            theme:      FACTURE_THEME,
            data:       filters
        });
    }

    getFilters() {
        return {
            mes:  $('#fMes').val()  || '',
            anio: $('#fAnio').val() || ''
        };
    }

    // -- Tabs --

    renderTabs() {
        this.tabLayout({
            parent:          'tabsHost',
            id:              'tabsCargas',
            theme:           FACTURE_THEME,
            type:            'short',
            showBorder:      false,
            renderContainer: true,
            json: SAMPLE_CARGAS_TABS.map(t => Object.assign({}, t, {
                active:  t.id === this.activeTab,
                onClick: (id) => this.onChangeTab(id)
            }))
        });
    }

    renderActiveTab(tabId) {
        const id = tabId || this.activeTab;
        this.activeTab = id;
        this.tabPanelLayout(id);

        const archivo = this.dataInit.archivos[id];
        cargasView.renderUploadRow(id, archivo);
        cargas.lsBitacora(id);

        if (id === 'sales-report') {
            cargasView.renderAsideHead({ icon: 'scan', title: 'Hojas detectadas' });
            this.asideLayout();
            cargasView.renderHojas(SAMPLE_CARGAS_HOJAS);
            cargasView.renderRoadmap(SAMPLE_CARGAS_ROADMAP);
        } else {
            cargasView.renderAsideHead({ icon: 'list', title: 'Columnas que se leen' });
            cargas.lsColumnas();
        }
    }

    // El panel lateral de ventas se parte en dos: hojas del archivo y, debajo,
    // el roadmap con el avance de la carga.
    asideLayout() {
        this.createLayout({
            parent: 'detailContent',
            design: false,
            data: {
                id:    'detailStack',
                class: 'w-full flex flex-col gap-4',
                container: [
                    { type: 'div', id: 'detailSheets',  class: 'w-full' },
                    { type: 'div', id: 'detailRoadmap', class: 'w-full' }
                ]
            }
        });
    }

    // -- Event handlers --

    onChangeTab(tabId) {
        this.renderActiveTab(tabId);
    }

    onChangeFilters() {
        cargas.lsBitacora(this.activeTab);
    }
}

// -- Cargas --

class Cargas extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'cargas';
    }

    // -- Data --

    // Bitacora por pestana: cada tab lista unicamente las cargas de su archivo.
    async lsBitacora(tabId) {
        const tipo = tabId || app.activeTab;
        const data = await fnAjax(Object.assign({ opc: 'lsBitacora', tipo: tipo }, app.getFilters()), apiCargas);

        this.createCoffeeTable3({
            parent:       'tableLog',
            id:           `tbLog-${tipo}`,
            theme:        FACTURE_THEME,
            center:       [4, 6],
            right:        [5],
            actionsAlign: 'center',
            extends:      true,
            scrollable:   false,
            striped:      true,
            hover:        true,
            f_size:       11,
            border_table: 'border-0',
            emptyMessage: 'Sin registros en la bitacora de carga',
            emptyIcon:    'ic-file-text',
            data:         data
        });

        if (window.lucide) lucide.createIcons();
    }

    lsColumnas() {
        this.createCoffeeTable3({
            parent:       'detailContent',
            id:           'tbColumnas',
            theme:        FACTURE_THEME,
            center:       [1],
            extends:      true,
            scrollable:   false,
            f_size:       10,
            border_table: 'border-0',
            border_row:   'border-0',
            emptyMessage: 'Sin mapeo de columnas',
            emptyIcon:    'ic-list',
            data:         SAMPLE_CARGAS_COLUMNAS_TABLE
        });
    }

    // Registros que entraron al sistema con esa carga. Se pintan en el mismo
    // contenedor de la bitacora (no en modal) y el encabezado ofrece volver.
    async lsRegistros(id) {
        const data = await fnAjax({ opc: 'lsRegistros', id: id }, apiCargas);

        if (data.status !== 200) {
            alert({ icon: 'error', title: data.message, timer: 2000 });
            return;
        }

        cargasView.renderLogHead({
            icon:  'file-text',
            title: data.titulo,
            badge: { text: `${data.row.length} de ${data.total.toLocaleString('en-US')}`, tone: 'b-blue' },
            back:  true
        });

        this.createCoffeeTable3({
            parent:       'tableLog',
            id:           `tbRegistros-${id}`,
            theme:        FACTURE_THEME,
            extends:      true,
            scrollable:   false,
            striped:      true,
            f_size:       11,
            border_table: 'border-0',
            emptyMessage: 'Esta carga no tiene registros',
            emptyIcon:    'ic-file-text',
            data:         { row: data.row }
        });

        if (window.lucide) lucide.createIcons();
    }

    // -- Actions --

    // El nombre del archivo se revisa ANTES de subir: el POS exporta con nombres
    // fijos por reporte, y subir el de otra pestana cargaria datos en la tabla
    // equivocada. Si no cuadra se pide confirmacion en vez de bloquear.
    onFileChange(input, tipo) {
        const file = input.files[0];
        input.value = '';
        if (!file) return;

        const esperado   = FACTURE_ARCHIVO_ESPERADO[tipo];
        const nombreBase = file.name.replace(/\.[^.]+$/, '');
        const coincide   = esperado.patron.test(nombreBase);

        if (coincide) {
            this.subirArchivo(file, tipo);
            return;
        }

        alert({
            icon:     'question',
            title:    'El nombre del archivo no coincide',
            html:     `El archivo <strong>${nombreBase}</strong> no parece el de <strong>${esperado.nombre}</strong> (se espera algo como <strong>${esperado.ejemplo}</strong>). ¿Deseas subirlo de todas formas?`,
            btn1:     true,
            btn1Text: 'Subir de todas formas',
            btn2:     true,
            btn2Text: 'Cancelar'
        }).then(result => {
            if (result.isConfirmed) this.subirArchivo(file, tipo);
        });
    }

    subirArchivo(file, tipo) {
        const filtros = app.getFilters();

        if (!filtros.mes || !filtros.anio) {
            alert({ icon: 'warning', title: 'Selecciona mes y anio antes de subir el archivo', btn1: true });
            return;
        }

        const formData = new FormData();
        formData.append('opc',         'uploadFile');
        formData.append('tipo',        tipo);
        formData.append('mes',         filtros.mes);
        formData.append('anio',        filtros.anio);
        formData.append('excel_file0', file);

        cargasView.renderUploadRow(tipo, Object.assign({}, app.dataInit.archivos[tipo], { estado: 'cargando' }));

        if (tipo === 'sales-report') {
            cargasView.renderHojas(SAMPLE_CARGAS_HOJAS.map(h => Object.assign({}, h, {
                detalle:    'Leyendo el archivo...',
                procesando: true
            })));
            cargasView.renderRoadmap(SAMPLE_CARGAS_ROADMAP.map(p => Object.assign({}, p, { estado: 'pendiente' })));
        }

        this.loader({ parent: 'tableLog', text: `Procesando ${file.name}...`, size: 'sm', type: 'aurora' });

        form_data_ajax(formData, apiCargas).then((response) => {
            const data    = response || {};
            const archivo = app.dataInit.archivos[tipo];

            archivo.estado  = data.status === 200 ? 'ok' : 'pendiente';
            archivo.cargado = data.status === 200 ? file.name : '';

            cargasView.renderUploadRow(tipo, archivo);

            if (tipo === 'sales-report') {
                if (data.hojas && data.hojas.length) cargasView.renderHojas(data.hojas.map(_hojaCard));
                if (data.steps) cargasView.renderRoadmap(data.steps);
            }

            this.lsBitacora(tipo);

            alert({
                icon:  data.status === 200 ? 'success' : 'error',
                title: data.message || 'Error al procesar el archivo',
                timer: data.status === 200 ? 1800 : 0,
                btn1:  data.status !== 200
            });
        });
    }

    deleteCarga(id) {
        this.swalQuestion({
            extends: true,
            opts: {
                title:             'Eliminar carga',
                text:              'Se borraran tambien los registros que entraron al sistema con esta carga.',
                icon:              'warning',
                confirmButtonText: 'Si, eliminar',
                cancelButtonText:  'No'
            }
        }).then(async (result) => {
            if (!result.isConfirmed) return;

            const data = await fnAjax({ opc: 'deleteCarga', id: id }, apiCargas);

            this.lsBitacora(app.activeTab);
            alert({ icon: data.status === 200 ? 'success' : 'error', title: data.message, timer: 1600 });
        });
    }
}

// -- Vista --

class CargasView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'cargas';
    }

    // -- Render helpers --

    renderHeader(data) {
        this.viewHeader({
            parent: 'viewHeader',
            id:     'hdrCargas',
            json:   data
        });
    }

    renderLogHead(data) {
        const json = data || { icon: 'activity', title: 'Bitacora de carga' };

        this.panelHead({
            parent: 'headLog',
            json:   json
        });

        if (!json.back) return;

        // Al ver los registros de una carga el encabezado ofrece la vuelta: la
        // bitacora y el detalle comparten el mismo contenedor.
        $('#headLog').find('h3').prepend(
            '<button type="button" id="btnBackLog" class="btn-icon-view mr-1" title="Volver a la bitacora"><i data-lucide="arrow-left" class="w-4 h-4"></i></button>'
        );

        $('#btnBackLog').on('click', () => {
            cargasView.renderLogHead();
            cargas.lsBitacora(app.activeTab);
        });

        if (window.lucide) lucide.createIcons();
    }

    renderAsideHead(data) {
        this.panelHead({
            parent: 'detailHead',
            json:   data
        });
    }

    renderUploadRow(tabId, archivo) {
        this.uploadRow({
            parent:   `uploadRow-${tabId}`,
            json:     archivo,
            onChange: (input, tipo) => cargas.onFileChange(input, tipo)
        });
    }

    renderHojas(rows) {
        this.detectList({
            parent: 'detailSheets',
            json:   rows
        });
    }

    renderRoadmap(steps) {
        this.roadmap({
            parent: 'detailRoadmap',
            json:   steps
        });
    }

    // -- Components --

    uploadRow(options) {
        const defaults = {
            parent:   'root',
            id:       '',
            class:    'upload-row',
            json:     { id: '', titulo: '', esperado: '', estado: 'pendiente' },
            onChange: () => { }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json  = Object.assign({}, defaults.json, o.json || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const estado    = opts.json.estado;
        const cargando  = estado === 'cargando';
        const listo     = estado === 'ok';
        const detalle   = listo ? (opts.json.cargado || opts.json.esperado) : 'Sin archivo cargado';

        const badges = {
            ok:       '<span class="badge-base b-green"><i data-lucide="check" class="w-3 h-3"></i>Cargado</span>',
            cargando: '<span class="badge-base b-blue"><i data-lucide="loader" class="w-3 h-3"></i>Procesando</span>',
            pendiente:'<span class="badge-base b-yellow"><i data-lucide="clock" class="w-3 h-3"></i>Pendiente</span>'
        };

        const inputId = `fileUpload-${opts.json.id}`;
        const wrap    = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });

        wrap.html(`
            <div class="upload-row-icon">
                <i data-lucide="file-spreadsheet" class="w-5 h-5"></i>
            </div>
            <div class="flex-1 min-w-0">
                <h3 class="text-[13px] font-bold text-white truncate">${esc(opts.json.titulo)}</h3>
                <p class="text-[11px] text-gray-400 truncate">${cargando ? 'Leyendo el archivo...' : esc(detalle)}</p>
            </div>
            ${badges[estado] || badges.pendiente}
            <input type="file" id="${inputId}" accept=".xlsx,.xls" class="hidden">
            <button type="button" class="upload-row-btn" ${cargando ? 'disabled' : ''}>
                <i data-lucide="upload" class="w-4 h-4"></i>Subir Excel
            </button>
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

        // El input nativo se mantiene oculto: el boton verde lo dispara para no
        // romper la fila con el control por defecto del navegador.
        wrap.find('.upload-row-btn').on('click', () => $(`#${inputId}`).trigger('click'));

        wrap.find(`#${inputId}`).on('change', (e) => opts.onChange(e.target, opts.json.id));
    }

    roadmap(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'w-full',
            json:   []
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const tonos = {
            ok:        { icon: 'check',   dot: 'bg-[rgba(16,185,129,0.15)] text-green-300 border-[rgba(16,185,129,0.30)]', text: 'text-gray-300' },
            error:     { icon: 'x',       dot: 'bg-[rgba(239,68,68,0.15)] text-red-300 border-[rgba(239,68,68,0.30)]',    text: 'text-red-300'   },
            pendiente: { icon: 'circle',  dot: 'bg-[#1F2A37] text-gray-500 border-[#374151]',                              text: 'text-gray-500'  }
        };

        const paso = (s, i, total) => {
            const t = tonos[s.estado] || tonos.pendiente;
            return `
                <div class="flex gap-3">
                    <div class="flex flex-col items-center">
                        <div class="w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${t.dot}">
                            <i data-lucide="${t.icon}" class="w-3 h-3"></i>
                        </div>
                        ${i < total - 1 ? '<div class="w-px flex-1 bg-[#374151] my-1"></div>' : ''}
                    </div>
                    <div class="flex-1 pb-3">
                        <p class="text-[11px] font-bold ${t.text}">${esc(s.titulo)}</p>
                        <p class="text-[9px] text-gray-400">${esc(s.detalle)}</p>
                    </div>
                </div>
            `;
        };

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html(`
            <h4 class="text-[11px] font-bold text-gray-300 flex items-center gap-2 mb-3">
                <i data-lucide="git-commit-horizontal" class="w-4 h-4 text-gray-400"></i>Roadmap de carga
            </h4>
            <div class="flex flex-col">
                ${(opts.json || []).map((s, i) => paso(s, i, opts.json.length)).join('')}
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
    }

    detectList(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'flex flex-col gap-3 w-full',
            json:   []
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        // La barra vive dentro de la tarjeta: al subir arranca indeterminada y
        // al terminar queda en el porcentaje de filas que si entraron a la base.
        const barra = (h) => {
            if (h.avance === undefined && !h.procesando) return '';

            const clase = h.procesando ? 'prog-fill indeterminate' : 'prog-fill';
            const ancho = h.procesando ? 100 : h.avance;

            return `
                <div class="prog-track mt-1.5">
                    <div class="${clase}" style="width:${ancho}%"></div>
                </div>
            `;
        };

        const item = (h) => `
            <div class="flex items-center gap-3 p-3 rounded-lg ${h.bgClass}">
                <div class="w-8 h-8 rounded-lg bg-[#141d2b] ${h.iconClass} flex items-center justify-center shadow-sm">
                    <i data-lucide="${esc(h.icon)}" class="w-4 h-4"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-[11px] font-bold text-gray-300">${esc(h.titulo)}</p>
                    <p class="text-[9px] text-gray-400">${esc(h.detalle)}</p>
                    ${barra(h)}
                </div>
                <i data-lucide="check-circle-2" class="w-4 h-4 ${h.iconClass}"></i>
            </div>
        `;

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html((opts.json || []).map(item).join(''));

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
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

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const iconHtml  = opts.json.icon ? `<i data-lucide="${esc(opts.json.icon)}" class="${opts.json.iconClass}"></i>` : '';
        const badge     = opts.json.badge;
        const badgeHtml = badge ? `<span class="badge-base ${esc(badge.tone || 'b-gray')}">${esc(badge.text)}</span>` : '';

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html(`
            <h3 class="${opts.classes.title}">${iconHtml}${esc(opts.json.title)}</h3>
            ${badgeHtml}
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
}
