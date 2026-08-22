let apiCargas = '/app/facture/ctrl/ctrl-facture-cargas.php';
let app, cargas, cargasView;

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
        this.hojas        = [];
        this.hojaActiva   = 0;

        // Cada tab recuerda en que hoja se quedo: volver a el no lo devuelve a la bitacora.
        this.lotes   = {};
        this.hojaTab = {};
    }

    async init() {
        this.dataInit = await useFetch({ url: apiCargas, data: { opc: 'init' } });
        this.activeTab = this.dataInit.tabs[0].id;

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        this.renderTabs();
        cargasView.renderHeader();
        this.renderActiveTab();
    }

    // -- Layout --

    layout() {
        const mainPanel = {
            type:  'div',
            id:    'mainPanel',
            class: 'flex-1 flex flex-col overflow-hidden min-w-0  min-h-0 w-full',
            children: [
                {
                    id:    'headerRow',
                    class: 'px-4 py-3 bg-[#0E1521] border-b border-[#374151] flex-shrink-0'
                },
                {
                    id:    'contentWrap',
                    class: 'p-3 flex-1 min-h-0 overflow-auto flex flex-col '
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

    contentLayout() {
        this.createLayout({
            parent: 'contentWrap',
            design: false,
            data: {
                id:    'contentGrid',
                class: 'w-full flex-1 min-h-0 flex flex-col gap-4 ',
                container: [
                    {
                        type:  'div',
                        id:    'tabsHost',
                        class: 'w-full flex-1 min-h-0 flex flex-col'
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
                // h-full y no flex-1: el contenedor del tab inactivo lleva
                // `hidden`, y darle display:flex ahi seria pelearse con el.
                id:    `panel-${tabId}`,
                class: 'w-full h-full bg-[#1F2A37]  rounded-lg p-4 flex flex-col gap-3',
                container: [
                    { type: 'div', id: `uploadRow-${tabId}`, class: 'w-full flex-shrink-0' },
                    {
                        type:  'div',
                        id:    `sheetsHost-${tabId}`,
                        class: 'w-full flex-1 min-h-0 flex flex-col border-t border-[#374151] pt-3'
                    }
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

    // El contenedor del tab y su panel heredan flex-1: sin eso la bitacora de la
    // pestana no llega al fondo y la tabla se corta a la altura de sus filas.
    renderTabs() {
        this.tabLayout({
            parent:          'tabsHost',
            id:              'tabsCargas',
            theme:           FACTURE_THEME,
            type:            'short',
            class:           'flex-shrink-0',
            showBorder:      false,
            renderContainer: true,
            content:         { class: 'flex-1 min-h-0 flex flex-col' },
            json: app.dataInit.tabs.map(t => Object.assign({}, t, {
                active:  t.id === this.activeTab,
                class:   'flex-1 min-h-0',
                onClick: (id) => this.onChangeTab(id)
            }))
        });
    }

    renderActiveTab(tabId) {
        const id = tabId || this.activeTab;
        this.activeTab = id;

        // Cambiar de pestana durante una carga dejaria el roadmap animandose
        // sobre el panel de la otra.
        cargas.stopRoadmap();
        this.tabPanelLayout(id);

        const archivo = this.dataInit.archivos[id];
        cargasView.renderUploadRow(id, archivo);
        cargas.lsBitacora(id);

        cargasView.renderAsideHead({ icon: 'scan', title: 'Hojas detectadas' });
        this.asideLayout();

        this.hojaActiva = -1;
        this.renderHojas(id);
    }

    asideLayout() {
        this.createLayout({
            parent: 'detailContent',
            design: false,
            data: {
                id:    'detailStack',
                class: 'w-full flex flex-col gap-4',
                container: [
                    { type: 'div', id: 'detailSheets', class: 'w-full' },
                    {
                        type:  'div',
                        id:    'detailColumns',
                        class: 'w-full',
                        children: [
                            { id: 'headColumns',  class: 'w-full pb-2' },
                            { id: 'tableColumns', class: 'w-full' }
                        ]
                    },
                    { type: 'div', id: 'detailRoadmap', class: 'w-full' }
                ]
            }
        });
    }

    // -- Tira de hojas del periodo --

    // tabLayout nombra su boton `tab-{id}` y su panel `container-{id}`: de estas
    // llaves cuelgan el cuerpo y el pie de cada hoja.
    logKey(tabId) {
        return `log-${tabId}`;
    }

    sheetKey(loteId) {
        return `sheet-${loteId}`;
    }

    // La tira se monta desde lsBitacora y no en el layout: antes de la consulta no
    // se sabe que hojas tiene cargado el periodo.
    sheetTabs(tabId, lotes, filas) {
        this.lotes[tabId] = lotes || [];

        const conLog = (filas || []).length > 0;

        // min-w-0 en el cuerpo: sin el, una hoja de muchas columnas se desborda
        // fuera del panel en vez de scrollear dentro. El wrapper va con h-full y no
        // flex-1 porque el contenedor del tab cerrado lleva `hidden`.
        const sheetShell = (id) => `
            <div class="h-full flex flex-col">
                <div id="sheetBody-${id}" class="flex-1 min-h-0 min-w-0 overflow-auto scroll-thin"></div>
                <div id="sheetFoot-${id}" class="flex-shrink-0"></div>
            </div>
        `;

        // La hoja abierta se conserva al repintar mientras su lote siga existiendo;
        // si se elimino, la tira vuelve a abrir en la bitacora.
        const previa  = this.hojaTab[tabId];
        const vive    = this.lotes[tabId].some(l => this.sheetKey(l.id) === previa);
        const primera = this.lotes[tabId][0];
        const activa  = vive
            ? previa
            : ((conLog || !primera) ? this.logKey(tabId) : this.sheetKey(primera.id));

        this.hojaTab[tabId] = activa;

        const hojas = this.lotes[tabId].map(lote => ({
            id:         this.sheetKey(lote.id),
            tab:        `${lote.sheet_name} <span class="badge-base b-gray ml-2">${Number(lote.row_count).toLocaleString('en-US')}</span>`,
            lucideIcon: cargasView.sheetTone(lote.sheet_name).icon,
            active:     this.sheetKey(lote.id) === activa,
            class:      'flex-1 min-h-0',
            content:    sheetShell(this.sheetKey(lote.id)),
            onClick:    () => this.onSelectSheet(tabId, lote)
        }));

        const bitacora = {
            id:         this.logKey(tabId),
            tab:        'Bitacora',
            lucideIcon: 'activity',
            active:     activa === this.logKey(tabId),
            class:      'flex-1 min-h-0',
            content:    sheetShell(this.logKey(tabId)),
            onClick:    () => this.onSelectSheet(tabId, null)
        };

        const json = conLog ? [bitacora].concat(hojas) : hojas;

        // Sin pestanas que mostrar la tira no se pinta: tabLayout dejaria la barra
        // de botones vacia sobre el panel.
        if (!json.length) {
            cargasView.renderEmptySheets(tabId);
            return;
        }

        this.tabLayout({
            parent:          `sheetsHost-${tabId}`,
            id:              `tabsSheets-${tabId}`,
            theme:           FACTURE_THEME,
            type:            'short',
            class:           'flex-shrink-0 self-start',
            showBorder:      false,
            renderContainer: true,
            content:         { class: 'flex-1 min-h-0 flex flex-col' },
            json:            json
        });
    }

    hasLog(tabId) {
        return $(`#tab-${this.logKey(tabId)}`).length > 0;
    }

    openLog(tabId) {
        if (this.hasLog(tabId)) $(`#tab-${this.logKey(tabId)}`).trigger('click');
    }

    loaderHost(tabId) {
        return this.hasLog(tabId) ? `sheetBody-${this.logKey(tabId)}` : `sheetsHost-${tabId}`;
    }

    // Render perezoso: la hoja se consulta la primera vez que se abre. Despues su
    // panel ya vive en el DOM y cambiar de pestana no cuesta una peticion.
    onSelectSheet(tabId, lote) {
        this.hojaTab[tabId] = lote ? this.sheetKey(lote.id) : this.logKey(tabId);

        if (!lote) return;

        const parent = `sheetBody-${this.sheetKey(lote.id)}`;
        if ($(`#${parent}`).children().length) return;

        cargas.lsRegistros(lote.id);
    }

    // -- Hojas del panel --

    hojasTab(tabId) {
        return this.dataInit.hojas[tabId] || [];
    }

    // Las hojas de reposo salen del contrato del importador; la carga las reemplaza
    // por las que trajo el archivo.
    renderHojas(tabId, hojas) {
        this.hojas = hojas || this.hojasTab(tabId);

        if (!this.hojas[this.hojaActiva]) this.hojaActiva = -1;

        this.paintHojas();
    }

    paintHojas() {
        const hoja = this.hojas[this.hojaActiva];

        cargasView.renderHojas(this.hojas, this.hojaActiva, (i) => this.onSelectHoja(i));

        $('#detailColumns').toggleClass('hidden', !hoja);

        if (hoja) cargas.lsColumnas(hoja);
    }

    // -- Event handlers --

    onChangeTab(tabId) {
        this.renderActiveTab(tabId);
    }

    onSelectHoja(index) {
        this.hojaActiva = this.hojaActiva === index ? -1 : index;
        this.paintHojas();
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

    // -- Formato --

    miles(n) {
        return Number(n || 0).toLocaleString('en-US');
    }

    // -- Data --

    async lsBitacora(tabId) {
        const tipo = tabId || app.activeTab;
        const data = await useFetch({ url: apiCargas, data: Object.assign({ opc: 'lsBitacora', tipo: tipo }, app.getFilters()) });
        const rows = data.row || [];

        app.sheetTabs(tipo, data.lotes, rows);

        if (data.archivo) {
            cargasView.renderUploadRow(tipo, Object.assign(app.dataInit.archivos[tipo], data.archivo));
        }

        // Sin registros no hay pestana de bitacora, asi que tampoco hay panel
        // donde pintar su tabla.
        if (!rows.length) return;

        const log = app.logKey(tipo);

        const logFoot = (lotes) => {
            const ls    = lotes || [];
            const filas = ls.reduce((a, l) => a + Number(l.row_count || 0), 0);

            if (!ls.length) {
                return { text: 'El periodo no tiene cargas', note: 'Sube el Excel para que aparezcan sus hojas' };
            }

            return {
                text: `<span class="text-gray-400 font-semibold">${ls.length}</span> lote(s) en el periodo · <span class="text-gray-400">${this.miles(filas)}</span> filas`,
                note: 'Cada hoja abre en su propia pestana'
            };
        };

        this.createCoffeeTable3({
            parent:        `sheetBody-${log}`,
            id:            `tbLog-${tipo}`,
            theme:         FACTURE_THEME,
            // Archivo abre la tabla, asi que la hora se centra en la 2.
            center:        [2, 4, 5],
            actionsAlign:  'center',
            extends:       true,
            scrollable:    false,
            hover:         true,
            f_size:        11,
            border_table:  'border-0',
            emptyMessage:  'Sin registros en la bitacora de carga',
            emptyIcon:     'ic-file-text',
            data:          data
        });

        cargasView.renderSheetFoot(log, logFoot(data.lotes));

        if (window.lucide) lucide.createIcons();

        if (typeof simple_data_table === 'function') simple_data_table(`#tbLog-${tipo}`, 10);
    }

    lsColumnas(hoja) {
        cargasView.renderColumnasHead(hoja);

        const cellColumna = (letra) => `<span class="w-5 h-5 inline-flex items-center justify-center rounded bg-[#1F2A37] text-gray-400 font-mono text-[9px]">${letra}</span>`;

        const columnasTable = (h) => ({
            row: ((h && h.columnas) || []).map(c => ({
                id:    c.letra,
                Col:   cellColumna(c.letra),
                Campo: `<span class="text-gray-400">${c.campo}</span>`
            }))
        });

        this.createCoffeeTable3({
            parent:       'tableColumns',
            id:           'tbColumnas',
            theme:        FACTURE_THEME,
            center:       [1],
            extends:      true,
            scrollable:   false,
            f_size:       10,
            border_table: 'border-0',
            border_row:   'border-0',
            emptyMessage: 'Selecciona una hoja para ver sus columnas',
            emptyIcon:    'ic-list',
            data:         columnasTable(hoja)
        });
    }

    async lsRegistros(id) {
        const hoja = app.sheetKey(id);

        cargasView.renderLoader(`sheetBody-${hoja}`, 'Leyendo los registros de la carga...');

        const data = await useFetch({ url: apiCargas, data: { opc: 'lsRegistros', id: id } });

        if (data.status !== 200) {
            $(`#sheetBody-${hoja}`).empty();
            alert({ icon: 'error', title: data.message, timer: 2000 });
            return;
        }

        this.createCoffeeTable3({
            parent:        `sheetBody-${hoja}`,
            id:            `tbRegistros-${id}`,
            theme:         FACTURE_THEME,
            center:        data.center || [],
            right:         data.right  || [],
            extends:       true,
            scrollable:    false,
            hover:         true,
            f_size:        11,
            border_table:  'border-0',
            emptyMessage:  'Esta carga no tiene registros',
            emptyIcon:     'ic-file-text',
            data:          { row: data.row }
        });

        if (window.lucide) lucide.createIcons();

        if (data.row.length > 0 && typeof simple_data_table === 'function') {
            simple_data_table(`#tbRegistros-${id}`, 12);
        }
    }

    // -- Roadmap en vivo --

    // El servidor responde una sola vez, con los pasos ya resueltos: hasta
    // entonces no hay avance real que consultar. Para que la carga no se vea
    // detenida, el roadmap avanza aqui paso a paso y el ultimo se queda animado
    // hasta que llega la respuesta, que es la que pinta el detalle definitivo.
    startRoadmap() {
        this.stopRoadmap();

        const pasos    = app.dataInit.roadmap;
        this.pasoVivo  = 0;

        const pintar = () => cargasView.renderRoadmap(pasos.map((p, i) => Object.assign({}, p, {
            estado: i < this.pasoVivo ? 'ok' : (i === this.pasoVivo ? 'proceso' : 'pendiente')
        })));

        pintar();

        this.roadmapTimer = setInterval(() => {
            if (this.pasoVivo >= pasos.length - 1) return;

            this.pasoVivo++;
            pintar();
        }, 900);
    }

    stopRoadmap() {
        if (this.roadmapTimer) clearInterval(this.roadmapTimer);
        this.roadmapTimer = null;
    }

    failRoadmap(detalle) {
        this.stopRoadmap();

        cargasView.renderRoadmap(app.dataInit.roadmap.map((p, i) => Object.assign({}, p, {
            estado:  i < this.pasoVivo ? 'ok' : (i === this.pasoVivo ? 'error' : 'pendiente'),
            detalle: i === this.pasoVivo ? detalle : p.detalle
        })));
    }

    // -- Actions --

    // El archivo se lee ANTES de preguntar nada. Antes se confirmaba el periodo
    // contra la pestana del boton y solo despues, ya subido, se descubria que el
    // archivo era de otra: la primera pregunta afirmaba un destino falso y venia
    // una segunda a corregirlo. Ahora la revision decide, y se pregunta una vez.
    async onFileChange(input, tipo) {
        const file = input.files[0];
        input.value = '';
        if (!file) return;

        const filtros = app.getFilters();

        if (!filtros.mes || !filtros.anio) {
            alert({ icon: 'warning', title: 'Selecciona mes y anio antes de subir el archivo', btn1: true });
            return;
        }

        cargasView.renderUploadRow(tipo, Object.assign({}, app.dataInit.archivos[tipo], { estado: 'cargando' }));

        const revision = await this.inspeccionar(file, tipo);

        cargasView.renderUploadRow(tipo, app.dataInit.archivos[tipo]);

        if (revision.status !== 200) {
            alert({ icon: 'error', title: revision.message || 'No se pudo leer el archivo', btn1: true });
            return;
        }

        // Hojas que no son de ninguna pestana, o columnas que no cuadran: no hay
        // nada que confirmar, solo que corregir.
        if (revision.validacion) {
            cargasView.alertValidacion(revision.validacion, file.name, app.dataInit.archivos[revision.destino] || app.dataInit.archivos[tipo]);
            return;
        }

        this.confirmarPeriodo(file, revision.destino, revision.movido ? tipo : '');
    }

    // Lectura del libro sin guardar nada: devuelve a que pestana pertenece y si
    // sus columnas cuadran.
    inspeccionar(file, tipo) {
        const filtros  = app.getFilters();
        const formData = new FormData();

        formData.append('opc',         'inspectFile');
        formData.append('tipo',        tipo);
        formData.append('mes',         filtros.mes);
        formData.append('anio',        filtros.anio);
        formData.append('excel_file0', file);

        return fetch(apiCargas, { method: 'POST', body: formData })
            .then(r => r.json())
            .catch(() => ({ status: 500, message: 'No se pudo leer el archivo' }));
    }

    // El periodo lo fija el filtro del modulo, no el nombre del archivo: se
    // confirma a que mes y anio va la carga antes de tocar la base. Si ese periodo
    // ya tiene datos de la pestana se avisa que se sobreescriben, porque la carga
    // reemplaza a la anterior en lugar de sumarse a ella.
    //
    // `desde` llega cuando la revision mando el archivo a otra pestana: el destino
    // y el cambio de pestana se confirman aqui mismo, no en un aviso aparte.
    confirmarPeriodo(file, tipo, desde) {
        const filtros = app.getFilters();
        const archivo = app.dataInit.archivos[tipo];
        const periodo = `${$('#fMes option:selected').text()} ${filtros.anio}`;
        const existe  = archivo.estado === 'ok';

        const origen = desde
            ? `<p class="text-[12px] text-blue-300 mb-2">Este archivo es de
                   <strong>${archivo.titulo}</strong>, no de
                   <strong>${app.dataInit.archivos[desde].titulo}</strong>. Sus columnas ya se revisaron y estan bien.</p>`
            : '';

        const aviso = existe
            ? `<p class="text-[12px] text-yellow-300 mt-2">Este periodo ya tiene datos cargados
                   (<strong>${archivo.cargado}</strong>) y se <strong>sobreescriben</strong> con este archivo.</p>`
            : '';

        alert({
            icon:     existe ? 'warning' : 'question',
            title:    desde ? 'Este archivo va en otra pestana' : `Cargar en ${periodo}`,
            html:     `${origen}<p class="text-[12px]">Se va a subir <strong>${file.name}</strong> a
                           <strong>${archivo.titulo}</strong> del periodo <strong>${periodo}</strong>.</p>${aviso}`,
            btn1:     true,
            btn1Text: existe ? 'Sobreescribir periodo' : (desde ? `Cargar en ${archivo.titulo}` : 'Subir archivo'),
            btn2:     true,
            btn2Text: 'Cancelar'
        }).then(result => {
            if (!result.isConfirmed) return;

            if (desde) this.cargarEnOtroTab(file, tipo);
            else       this.subirArchivo(file, tipo);
        });
    }

    subirArchivo(file, tipo) {
        const filtros = app.getFilters();

        // useFetch manda urlencoded y no admite archivos: la subida necesita
        // FormData. Tampoco pasa por form_data_ajax, que no rechaza la promesa
        // cuando el servidor falla, y el roadmap se quedaria animado sin cerrar.
        const fnUpload = (body, url) => fetch(url, {
            method: 'POST',
            body:   body
        }).then(r => r.json());

        // La carga devuelve el resultado pero no el contrato: el mapeo de columnas
        // se conserva del que trajo init().
        const hojasCargadas = (base, hojas) => hojas.map(h => Object.assign(
            {}, (base || []).find(b => b.nombre === h.nombre) || {}, h
        ));

        const formData = new FormData();
        formData.append('opc',         'uploadFile');
        formData.append('tipo',        tipo);
        formData.append('mes',         filtros.mes);
        formData.append('anio',        filtros.anio);
        formData.append('excel_file0', file);

        cargasView.renderUploadRow(tipo, Object.assign({}, app.dataInit.archivos[tipo], { estado: 'cargando' }));

        app.renderHojas(tipo, app.hojasTab(tipo).map(h => Object.assign({}, h, {
            detalle:    'Leyendo el archivo...',
            procesando: true
        })));

        this.startRoadmap();

        app.openLog(tipo);

        cargasView.renderLoader(app.loaderHost(tipo), `Procesando ${file.name}...`);

        fnUpload(formData, apiCargas).then((response) => {
            const data    = response || {};
            const archivo = app.dataInit.archivos[tipo];

            archivo.estado  = data.status === 200 ? 'ok' : 'pendiente';
            archivo.cargado = data.status === 200 ? file.name : '';

            cargasView.renderUploadRow(tipo, archivo);

            app.renderHojas(tipo, (data.hojas && data.hojas.length)
                ? hojasCargadas(app.hojasTab(tipo), data.hojas)
                : null);

            if (data.steps) {
                this.stopRoadmap();
                cargasView.renderRoadmap(data.steps);
            } else {
                this.failRoadmap(data.message || 'El servidor no devolvio el detalle del proceso');
            }

            this.lsBitacora(tipo);

            // Una columna que falta o que esta corrida no cabe en el titulo de un
            // aviso: se muestra columna por columna, que es lo unico con lo que el
            // usuario puede arreglar el Excel.
            if (data.validacion) {
                cargasView.alertValidacion(data.validacion, file.name, app.dataInit.archivos[tipo])
                    .then(res => {
                        if (res && res.isConfirmed && data.validacion.motivo === 'otro-tab') {
                            this.cargarEnOtroTab(file, data.validacion.sugerido);
                        }
                    });
                return;
            }

            alert({
                icon:  data.status === 200 ? 'success' : 'error',
                title: data.message || 'Error al procesar el archivo',
                timer: data.status === 200 ? 1800 : 0,
                btn1:  data.status !== 200
            });
        }).catch((error) => {
            const archivo = app.dataInit.archivos[tipo];

            archivo.estado  = 'pendiente';
            archivo.cargado = '';

            cargasView.renderUploadRow(tipo, archivo);
            app.renderHojas(tipo);

            this.failRoadmap('El servidor corto el proceso');

            this.lsBitacora(tipo);

            alert({ icon: 'error', title: 'No se pudo procesar el archivo: ' + error.message, btn1: true });
        });
    }

    // Reintento del mismo archivo en la pestana a la que pertenece. Se cambia de
    // pestana antes de subir porque el panel de la otra no existe en el DOM hasta
    // que se visita, y la carga no tendria donde pintar su avance.
    cargarEnOtroTab(file, tab) {
        $(`#tab-${tab}`).trigger('click');

        this.subirArchivo(file, tab);
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

            const data = await useFetch({ url: apiCargas, data: { opc: 'deleteCarga', id: id } });

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

    sheetTone(nombre) {
        const tonos = {
            'Pagos':             { icon: 'credit-card',  bgClass: 'bg-[rgba(28,100,242,0.12)]', iconClass: 'text-[#1C64F2]' },
            'Reporte de ventas': { icon: 'receipt-text', bgClass: 'bg-[rgba(16,185,129,0.12)]', iconClass: 'text-green-600' },
            'comandas':          { icon: 'utensils',     bgClass: 'bg-[rgba(168,85,247,0.12)]', iconClass: 'text-purple-400' }
        };

        return tonos[nombre] || { icon: 'sheet', bgClass: 'bg-[#1F2A37]', iconClass: 'text-gray-400' };
    }

    // -- Render helpers --

    renderHeader() {
        this.viewHeader({
            parent: 'viewHeader',
            id:     'hdrCargas',
            json: {
                title:    'Importación mensual',
                subtitle: 'Sube los exports del POS en orden. Cada pestana indica el archivo exacto y las hojas que se leeran',
                back:     { href: '/app/facture2/index.php', title: 'Regresar a la Terminal' }
            }
        });
    }

    renderSheetFoot(sheetId, json) {
        this.sheetFootBar({
            parent: `sheetFoot-${sheetId}`,
            json:   json
        });
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

    // Las hojas llegan del contrato o de la carga: la tarjeta se arma aqui para que
    // ambos origenes se pinten igual.
    renderHojas(rows, selected, onSelect) {
        const hojaCard = (h) => {
            const tono  = this.sheetTone(h.nombre);
            const ok    = h.estado === 'ok';
            const error = h.estado === 'error';

            return {
                icon:       tono.icon,
                titulo:     h.nombre,
                detalle:    h.detalle,
                bgClass:    error ? 'bg-[rgba(239,68,68,0.12)]' : (ok ? 'bg-[rgba(16,185,129,0.12)]' : tono.bgClass),
                iconClass:  error ? 'text-red-400' : (ok ? 'text-green-600' : tono.iconClass),
                rightIcon:  error ? 'x-circle' : (ok ? 'check-circle-2' : 'chevron-right'),
                procesando: h.procesando,
                avance:     h.avance === undefined && h.estado ? (ok ? 100 : 0) : h.avance
            };
        };

        this.detectList({
            parent:   'detailSheets',
            json:     (rows || []).map(hojaCard),
            selected: selected,
            onSelect: onSelect
        });
    }

    renderColumnasHead(hoja) {
        this.panelHead({
            parent: 'headColumns',
            json: {
                icon:  'list',
                title: 'Columnas que se leen',
                badge: hoja ? { text: hoja.nombre, tone: 'b-blue', icon: 'table-2' } : null
            }
        });
    }

    renderRoadmap(steps) {
        this.roadmap({
            parent: 'detailRoadmap',
            json:   steps
        });
    }

    renderLoader(parent, text) {
        this.spinnerBox({
            parent: parent,
            json:   { text: text }
        });
    }

    // Aviso de lo que hay que corregir en el Excel. Son dos lecturas distintas:
    // o el archivo no es el de esta pestana (ninguna hoja conocida), o si lo es
    // pero alguna hoja trae las columnas cambiadas. En el segundo caso el pie
    // dice que si alcanzo a entrar, porque las hojas se cargan por separado y
    // anunciar "no se modifico nada" seria falso.
    alertValidacion(v, fileName, archivo) {
        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        // Las hojas se dibujan como la barra de pestanas de Excel y no como una
        // lista: es lo que el usuario ve al pie de su archivo cuando lo abre, asi
        // que puede comparar sin que nadie le explique donde mirar.
        // La fila de letras es lo que vuelve inconfundible que eso es un Excel: sin
        // ella la cuadricula sola se lee como una tabla cualquiera.
        const columnasHoja = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

        const libroExcel = (titulo, hojas) => `
            <p class="chk-lead">${titulo}</p>
            <div class="xls-book">
                <div class="xls-head">${columnasHoja.map(c => `<span>${c}</span>`).join('')}</div>
                <div class="xls-grid"></div>
                <div class="xls-tabs">
                    ${hojas.map(h => `<span class="xls-tab xls-${h.tone}">${esc(h.nombre)}</span>`).join('')}
                </div>
            </div>
        `;

        const hojasEsperadas = () => {
            const esperadas = v.esperadas || [];
            const libro     = v.libro || [];

            const trae = libro.length
                ? libro.map(h => ({ nombre: h, tone: esperadas.indexOf(h) >= 0 ? 'ok' : 'bad' }))
                : [{ nombre: 'sin hojas', tone: 'bad' }];

            return libroExcel(
                `Asi debe venir el Excel de <strong>${esc(archivo.titulo)}</strong>:`,
                esperadas.map(h => ({ nombre: h, tone: 'ok' }))
            ) + libroExcel(
                'Asi viene el que subiste:',
                trae
            );
        };

        // La fila de encabezados se dibuja como esta en la hoja, con las dos
        // versiones una debajo de otra: sin las columnas que si cuadran no se ve
        // donde empieza el desfase, que es lo que hay que corregir. Se pintan
        // todas y solo se resaltan las que fallan.
        const celda = (texto, estado) => `
            <span class="xls-cel ${estado ? 'xls-cel-' + estado : ''}" title="${esc(texto)}">${esc(texto) || '&nbsp;'}</span>
        `;

        const bloqueHoja = (item) => {
            const cols   = item.columnas || item.faltan || [];
            const faltan = item.faltan || [];
            const perdidas = faltan.filter(c => c.estado === 'ausente');
            const corridas = faltan.filter(c => c.estado === 'movida');

            const resumen = [
                perdidas.length ? `<span class="chk-bad-txt">falta ${perdidas.map(c => esc(c.esperada)).join(', ')}</span>` : '',
                corridas.length ? `<span class="chk-warn-txt">${corridas.length} columna(s) corridas de lugar</span>` : ''
            ].filter(Boolean).join(' · ');

            // Con diez columnas la fila no cabe en el dialogo: se anota cual es la
            // primera que falla para desplazar la hoja hasta ahi al abrir, y que
            // el error se vea sin tener que buscarlo.
            const primerMal = cols.findIndex(c => c.estado !== 'ok');

            return `
                <p class="chk-lead">Hoja <strong>${esc(item.hoja)}</strong>, fila ${esc(item.headerRow)}: ${resumen}</p>
                <div class="xls-book">
                    <div class="xls-scroll" data-mal="${primerMal}">
                        <div class="xls-line">
                            <span class="xls-lbl"></span>
                            ${cols.map(c => `<span class="xls-hcel">${esc(c.letra)}</span>`).join('')}
                        </div>
                        <div class="xls-line">
                            <span class="xls-lbl">Debe decir</span>
                            ${cols.map(c => celda(c.esperada, c.estado === 'ok' ? '' : 'want')).join('')}
                        </div>
                        <div class="xls-line">
                            <span class="xls-lbl">Tu archivo</span>
                            ${cols.map(c => celda(c.encontrada, c.estado === 'ok' ? '' : (c.estado === 'ausente' ? 'bad' : 'alt'))).join('')}
                        </div>
                    </div>
                </div>
            `;
        };

        // El archivo cayo en la pestana equivocada pero es valido en otra: en vez
        // de rechazarlo se ofrece cargarlo donde va. Sus hojas se pintan en ambar
        // y no en rojo porque no estan mal, solo estan en el lugar equivocado.
        const otroTab = () => {
            const destino = (app.dataInit.archivos[v.sugerido] || {}).titulo || v.sugerido;
            const suyas   = v.suyas || [];

            return `
                <p class="chk-lead">Parece que subiste el archivo de
                    <strong>${esc(destino)}</strong> en la pestana de
                    <strong>${esc(archivo.titulo)}</strong>.</p>
                ${libroExcel(
                    'Las hojas que trae son las de esa otra pestana:',
                    (v.libro || []).map(h => ({ nombre: h, tone: suyas.indexOf(h) >= 0 ? 'alt' : 'bad' }))
                )}
            `;
        };

        // Periodo con notas emitidas. Aqui no hay nada que corregir en el archivo:
        // lo que se dice es por que no se puede cargar y que habria que hacer
        // antes, con las notas nombradas para poder ir a buscarlas.
        const notasEmitidas = () => {
            const notas  = v.notas || [];
            const rango  = v.notaMin === v.notaMax
                ? `la nota <strong>#${esc(v.notaMin)}</strong>`
                : `las notas <strong>#${esc(v.notaMin)}</strong> a <strong>#${esc(v.notaMax)}</strong>`;

            const fila = (n) => `
                <tr>
                    <td class="chk-col">#${esc(n.note_number)}</td>
                    <td>${esc(n.folio)}</td>
                    <td class="chk-right">$${Number(n.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
            `;

            return `
                <p class="chk-lead">Este periodo ya tiene ${rango} emitidas sobre sus ventas.
                    Volver a cargar reemplazaria esas ventas y <strong>las notas se borrarian con ellas</strong>.</p>
                <table class="chk-table">
                    <thead><tr><th>Nota</th><th>Folio</th><th>Total</th></tr></thead>
                    <tbody>${notas.map(fila).join('')}</tbody>
                </table>
                ${v.total > notas.length
                    ? `<p class="chk-note">y ${esc(v.total - notas.length)} mas</p>`
                    : ''}
            `;
        };

        const cargadas = v.cargadas || [];
        const pie = cargadas.length
            ? `Si entro: <span class="chk-strong">${esc(cargadas.join(' · '))}</span>. El resto no se modifico.`
            : 'No se modifico ningun dato. Corrige el archivo y vuelve a subirlo.';

        const titulos = {
            'hojas':    'Este no es el archivo de esta pestana',
            'otro-tab': 'Este archivo va en otra pestana',
            'columnas': 'Revisa las columnas del archivo',
            'tickets':  'El periodo ya tiene tickets virtuales'
        };

        const cuerpos = {
            'hojas':    hojasEsperadas,
            'otro-tab': otroTab,
            'columnas': () => (v.columnas || []).map(bloqueHoja).join(''),
            'tickets':  notasEmitidas
        };

        // El caso de la pestana equivocada es el unico que pregunta: los demas no
        // tienen nada que ofrecer, solo que corregir el archivo o el periodo.
        const mover   = v.motivo === 'otro-tab';
        const cerrado = v.motivo === 'tickets';

        // El cierre del aviso de notas no manda a ninguna pantalla a proposito:
        // dar de baja una nota emitida no es una accion que el modulo ofrezca hoy,
        // y prometerla dejaria al usuario buscando un boton que no existe.
        const cierres = {
            'otro-tab': 'Todavia no se modifico nada. Si aceptas se revisan sus columnas antes de cargar.',
            'tickets':  'No se modifico ningun dato. Mientras existan esas notas el periodo no admite cargas; se puede cargar en otro mes.'
        };

        const cierre = cierres[v.motivo] || pie;

        const promesa = alert({
            icon:     mover ? 'question' : (cerrado ? 'warning' : 'error'),
            title:    titulos[v.motivo],
            width:    720,
            timer:    0,
            btn1:     true,
            btn1Text: mover ? `Si, cargar en ${(app.dataInit.archivos[v.sugerido] || {}).titulo || v.sugerido}` : 'Entendido',
            btn2:     mover,
            btn2Text: 'Cancelar',
            html: `
                <div class="chk-box">
                    <p class="chk-file">${esc(fileName)}</p>
                    ${(cuerpos[v.motivo] || cuerpos.columnas)()}
                    <p class="${mover || cerrado ? 'chk-note' : (cargadas.length ? 'chk-partial' : 'chk-safe')}">${cierre}</p>
                </div>
            `
        });

        // SweetAlert monta el dialogo en la misma vuelta, asi que la hoja ya se
        // puede desplazar: cada bloque se coloca en su primera columna con
        // problema para que el error quede a la vista al abrir.
        $('.xls-scroll').each(function () {
            const mal = Number($(this).attr('data-mal'));

            if (mal > 1) this.scrollLeft = (mal - 1) * 76;
        });

        return promesa;
    }

    renderEmptySheets(tabId) {
        const archivo = app.dataInit.archivos[tabId] || {};
        const periodo = `${$('#fMes option:selected').text()} ${$('#fAnio').val()}`;

        this.emptyBox({
            parent: `sheetsHost-${tabId}`,
            json: {
                icon:  'folder-open',
                title: `Sin cargas de ${archivo.titulo} en ${periodo}`,
                text:  `Sube ${archivo.esperado} con el boton "Subir Excel" para ver aqui las hojas del archivo y sus registros.`
            }
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
            cargando: '<span class="badge-base b-blue"><i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i>Procesando</span>',
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
                <i data-lucide="file-spreadsheet" class="w-4 h-4"></i>Subir Excel
            </button>
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

        wrap.find('.upload-row-btn').on('click', () => $(`#${inputId}`).trigger('click'));

        wrap.find(`#${inputId}`).on('change', (e) => opts.onChange(e.target, opts.json.id));
    }

    // Espera de una consulta o de una carga. Reemplaza el contenido del panel en
    // vez de agregarse a el (loader() del framework hace append y el aviso queda
    // debajo de la tabla, fuera de la vista) y se centra en el hueco que ocupa.
    spinnerBox(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'w-full h-full flex-1 min-h-[160px] flex flex-col items-center justify-center gap-3',
            json:   { text: '' }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json  = Object.assign({}, defaults.json, o.json || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html(`
            <span class="spinner-ring"></span>
            ${opts.json.text ? `<p class="text-[11px] text-gray-400">${esc(opts.json.text)}</p>` : ''}
        `);

        $(`#${opts.parent}`).html(wrap);
    }

    emptyBox(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'w-full h-full flex-1 min-h-[180px] flex flex-col items-center justify-center gap-2 text-center px-4',
            json:   { icon: 'inbox', title: '', text: '' }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json  = Object.assign({}, defaults.json, o.json || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html(`
            <div class="w-12 h-12 rounded-full bg-[#1F2A37] border border-[#374151] flex items-center justify-center text-gray-500">
                <i data-lucide="${esc(opts.json.icon)}" class="w-6 h-6"></i>
            </div>
            <p class="text-[12px] font-bold text-gray-300">${esc(opts.json.title)}</p>
            ${opts.json.text ? `<p class="text-[11px] text-gray-500 max-w-[380px]">${esc(opts.json.text)}</p>` : ''}
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
    }

    sheetFootBar(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'flex items-center justify-between gap-3 px-1 pt-2 border-t border-[rgba(55,65,81,.5)] flex-shrink-0',
            json:   { text: '', note: '', badges: [], actions: [] }
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json  = Object.assign({}, defaults.json, o.json || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        // El texto admite HTML porque los conteos del pie van resaltados; las
        // acciones y las pildoras se escapan.
        const badges = (opts.json.badges || [])
            .map(b => `<span class="badge-base ${esc(b.tone || 'b-gray')}">${esc(b.text)}</span>`).join('');

        const actions = (opts.json.actions || []).map(a =>
            `<button type="button" class="${esc(a.class || 'btn-icon-view')}" title="${esc(a.title)}" onclick="${a.onclick}">
                <i data-lucide="${esc(a.icon)}" class="w-4 h-4"></i>
            </button>`).join('');

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html(`
            <p class="text-[10px] text-gray-500 truncate min-w-0">${opts.json.text}</p>
            <div class="flex items-center gap-1 flex-shrink-0">
                ${opts.json.note ? `<span class="text-[10px] text-gray-500 mr-1">${esc(opts.json.note)}</span>` : ''}
                ${badges}${actions}
            </div>
        `);

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();
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
            ok:        { icon: 'check',    dot: 'bg-[rgba(16,185,129,0.15)] text-green-300 border-[rgba(16,185,129,0.30)]', text: 'text-gray-300', line: 'bg-[rgba(16,185,129,0.35)]' },
            proceso:   { icon: 'loader-2', dot: 'bg-[rgba(28,100,242,0.15)] text-blue-300 border-[rgba(28,100,242,0.35)]',  text: 'text-blue-300', spin: true },
            error:     { icon: 'x',        dot: 'bg-[rgba(239,68,68,0.15)] text-red-300 border-[rgba(239,68,68,0.30)]',     text: 'text-red-300'   },
            pendiente: { icon: 'circle',   dot: 'bg-[#1F2A37] text-gray-500 border-[#374151]',                               text: 'text-gray-500'  }
        };

        const paso = (s, i, total) => {
            const t    = tonos[s.estado] || tonos.pendiente;
            const line = t.line || 'bg-[#374151]';
            return `
                <div class="flex gap-3">
                    <div class="flex flex-col items-center">
                        <div class="w-6 h-6 rounded-full border flex items-center justify-center shrink-0 ${t.dot}">
                            <i data-lucide="${t.icon}" class="w-3 h-3 ${t.spin ? 'animate-spin' : ''}"></i>
                        </div>
                        ${i < total - 1 ? `<div class="w-px flex-1 ${line} my-1"></div>` : ''}
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
            parent:   'root',
            id:       '',
            class:    'flex flex-col gap-3 w-full',
            json:     [],
            selected: -1,
            onSelect: null
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

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

        const item = (h, i) => `
            <div data-hoja="${i}"
                 class="flex items-center gap-3 p-3 rounded-lg ${h.bgClass}
                        ${opts.onSelect ? 'cursor-pointer' : ''}
                        ${i === opts.selected ? 'ring-1 ring-[#1C64F2]' : ''}">
                <div class="w-8 h-8 rounded-lg bg-[#141d2b] ${h.iconClass} flex items-center justify-center shadow-sm">
                    <i data-lucide="${esc(h.icon)}" class="w-4 h-4"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-[11px] font-bold text-gray-300">${esc(h.titulo)}</p>
                    <p class="text-[9px] text-gray-400">${esc(h.detalle)}</p>
                    ${barra(h)}
                </div>
                <i data-lucide="${esc(h.rightIcon || 'check-circle-2')}" class="w-4 h-4 ${h.iconClass}"></i>
            </div>
        `;

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html((opts.json || []).map(item).join(''));

        $(`#${opts.parent}`).html(wrap);
        if (window.lucide) lucide.createIcons();

        if (typeof opts.onSelect === 'function') {
            wrap.on('click', '[data-hoja]', (e) => opts.onSelect(Number($(e.currentTarget).attr('data-hoja'))));
        }
    }

    panelHead(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'flex items-center justify-between w-full gap-3',
            json:   { icon: '', iconClass: 'w-4 h-4 text-gray-400 flex-shrink-0', title: '', badge: null, badges: [] },
            classes: {
                title: 'text-[12px] font-bold text-gray-300 flex items-center gap-2 min-w-0'
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

        // `badge` en singular se conserva porque el resto de los encabezados del
        // modulo ya lo pasan asi.
        const lista = (opts.json.badges && opts.json.badges.length)
            ? opts.json.badges
            : (opts.json.badge ? [opts.json.badge] : []);

        // Sin saltos de linea dentro del span: badge-base es nowrap y el espacio en
        // blanco se colaparia contra el padding de la pildora.
        const badgeHtml = lista.map(b => `<span class="badge-base ${esc(b.tone || 'b-gray')}">${b.icon ? `<i data-lucide="${esc(b.icon)}" class="w-3 h-3"></i>` : ''}${esc(b.text)}</span>`).join('');

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html(`
            <h3 class="${opts.classes.title}">${iconHtml}<span class="truncate">${esc(opts.json.title)}</span></h3>
            <div class="flex items-center gap-2 flex-shrink-0">${badgeHtml}</div>
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
