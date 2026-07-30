let apiCargas = '/app/facture/ctrl/ctrl-facture-cargas.php';
let app, cargas, cargasView;

// useFetch del framework resuelve por callback y no admite archivos; aqui se
// necesita await en todo el modulo, asi que las llamadas pasan por este helper.
const fnAjax = (data, url) => fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams(data)
}).then(r => r.json());

// La subida no pasa por form_data_ajax: ese helper no rechaza la promesa cuando
// el servidor falla, y el roadmap se quedaria animado sin cerrar nunca.
const fnUpload = (formData, url) => fetch(url, {
    method: 'POST',
    body:   formData
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
        this.hojas        = [];
        this.hojaActiva   = 0;

        // Lotes y hoja abierta por pestana: cada tab recuerda en que hoja se quedo,
        // asi volver al tab no lo devuelve a la bitacora.
        this.lotes   = {};
        this.hojaTab = {};
    }

    async init() {
        const data = await fnAjax({ opc: 'init' }, apiCargas);

        this.dataInit = {
            meses:    data.meses,
            anios:    data.anios,
            archivos: SAMPLE_CARGAS_ARCHIVOS,
            hojas:    data.hojas || SAMPLE_CARGAS_HOJAS
        };

        this.render();
    }

    render() {
        this.layout();
        this.filterBar();
        this.renderTabs();
        cargasView.renderHeader(SAMPLE_VIEW_HEADER_CARGAS);
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
                    class: 'px-4 py-3 bg-[#111827] border-b border-[#374151] flex-shrink-0'
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

    // Zona scrolleable: los tabs ocupan todo el alto porque la bitacora vive
    // dentro del panel de cada uno.
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
    //
    // La bitacora es de la pestana, no del modulo: cada archivo tiene su propia
    // caja, asi las cargas de comandas no se leen como si fueran del reporte de
    // ventas. Dentro del panel no va una tabla sino la tira de hojas, que la
    // bitacora arma cuando sabe que lotes trae el periodo.
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
            json: SAMPLE_CARGAS_TABS.map(t => Object.assign({}, t, {
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

        // El panel lateral es el mismo en las dos pestanas: cada una anuncia las
        // hojas que se leen de su archivo. El roadmap no se pinta al entrar (es el
        // avance de una carga): startRoadmap() lo agrega cuando se sube un archivo.
        cargasView.renderAsideHead({ icon: 'scan', title: 'Hojas detectadas' });
        this.asideLayout();

        // Ninguna hoja arranca abierta: el mapeo de columnas es un detalle que se
        // pide, y el indice de la pestana anterior no significa lo mismo aqui.
        this.hojaActiva = -1;
        this.renderHojas(id);
    }

    // El panel lateral se parte en tres: las hojas del archivo, las columnas de la
    // hoja elegida y el roadmap con el avance de la carga.
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

    // Segundo nivel de tabLayout: la bitacora deja de ser un modo del que hay que
    // salir y pasa a ser la primera pestana; cada lote del periodo es una hermana
    // suya. tabLayout conserva los paneles en el DOM (solo les pone `hidden`), asi
    // que una hoja ya abierta mantiene su tabla y la pagina de DataTables donde se
    // quedo: moverse entre hojas no vuelve a consultar.
    //
    // La tira se arma con los lotes que reporta la bitacora, por eso se monta
    // desde lsBitacora y no en el layout: antes de la consulta no se sabe que
    // hojas tiene cargado el periodo.
    sheetTabs(tabId, lotes) {
        this.lotes[tabId] = lotes || [];

        // La hoja abierta se conserva al repintar mientras su lote siga existiendo;
        // si se elimino, la tira vuelve a abrir en la bitacora.
        const previa = this.hojaTab[tabId];
        const vive   = this.lotes[tabId].some(l => sheetKey(l.id) === previa);
        const activa = vive ? previa : logKey(tabId);

        this.hojaTab[tabId] = activa;

        const hojas = this.lotes[tabId].map(lote => ({
            id:         sheetKey(lote.id),
            tab:        `${lote.sheet_name} <span class="badge-base b-gray ml-2">${Number(lote.row_count).toLocaleString('en-US')}</span>`,
            lucideIcon: hojaIcono(lote.sheet_name),
            active:     sheetKey(lote.id) === activa,
            class:      'flex-1 min-h-0',
            content:    sheetShell(sheetKey(lote.id)),
            onClick:    () => this.onSelectSheet(tabId, lote)
        }));

        const bitacora = {
            id:         logKey(tabId),
            tab:        'Bitacora',
            lucideIcon: 'activity',
            active:     activa === logKey(tabId),
            class:      'flex-1 min-h-0',
            content:    sheetShell(logKey(tabId)),
            onClick:    () => this.onSelectSheet(tabId, null)
        };

        this.tabLayout({
            parent:          `sheetsHost-${tabId}`,
            id:              `tabsSheets-${tabId}`,
            theme:           FACTURE_THEME,
            type:            'short',
            class:           'flex-shrink-0 self-start',
            showBorder:      false,
            renderContainer: true,
            content:         { class: 'flex-1 min-h-0 flex flex-col' },
            json:            [bitacora].concat(hojas)
        });
    }

    // Abre la hoja de un lote desde fuera de la tira (el nombre del archivo y el
    // ojo de la bitacora): se dispara la pestana en vez de reemplazar la tabla.
    openSheet(loteId) {
        $(`#tab-${sheetKey(loteId)}`).trigger('click');
    }

    openLog(tabId) {
        $(`#tab-${logKey(tabId)}`).trigger('click');
    }

    // Render perezoso: la hoja se consulta la primera vez que se abre. Despues su
    // panel ya vive en el DOM y cambiar de pestana no cuesta una peticion.
    onSelectSheet(tabId, lote) {
        this.hojaTab[tabId] = lote ? sheetKey(lote.id) : logKey(tabId);

        if (!lote) return;

        const parent = `sheetBody-${sheetKey(lote.id)}`;
        if ($(`#${parent}`).children().length) return;

        cargas.lsRegistros(lote.id, tabId);
    }

    // -- Hojas del panel --

    hojasTab(tabId) {
        return this.dataInit.hojas[tabId] || [];
    }

    // Las hojas de reposo salen del contrato del importador; la carga las reemplaza
    // por las que trajo el archivo. La hoja abierta se conserva mientras exista en
    // la lista nueva, para que el mapeo no se cierre solo al repintar el panel.
    renderHojas(tabId, hojas) {
        this.hojas = hojas || this.hojasTab(tabId);

        if (!this.hojas[this.hojaActiva]) this.hojaActiva = -1;

        this.paintHojas();
    }

    // Sin hoja abierta el bloque de columnas no se pinta vacio: se esconde, para
    // que el panel sea la lista de hojas hasta que se pida el detalle de una.
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

    // La tarjeta abre y cierra su mapeo: volver a darle clic deja el panel como
    // estaba, sin columnas.
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

    // -- Data --

    // Bitacora por pestana: cada tab lista unicamente las cargas de su archivo.
    // La consulta es tambien la que define la tira de hojas, porque hasta aqui no
    // se sabe que lotes tiene el periodo.
    async lsBitacora(tabId) {
        const tipo = tabId || app.activeTab;
        const data = await fnAjax(Object.assign({ opc: 'lsBitacora', tipo: tipo }, app.getFilters()), apiCargas);
        const rows = data.row || [];

        app.sheetTabs(tipo, data.lotes);

        const log = logKey(tipo);

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

        // El periodo manda sobre la fila de carga: si ya entraron lotes en ese
        // mes la pestana deja de decir "pendiente" y muestra que ya hay datos.
        if (data.archivo) {
            cargasView.renderUploadRow(tipo, Object.assign(app.dataInit.archivos[tipo], data.archivo));
        }

        if (window.lucide) lucide.createIcons();

        if (rows.length > 0 && typeof simple_data_table === 'function') {
            simple_data_table(`#tbLog-${tipo}`, 10);
        }
    }

    // Columnas que se leen de la hoja seleccionada: es el contrato con el que se
    // valida el Excel, asi que dice exactamente que necesita traer el archivo para
    // que la informacion se pueda migrar.
    lsColumnas(hoja) {
        cargasView.renderColumnasHead(hoja);

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
            data:         _columnasTable(hoja)
        });
    }

    // Registros de un lote: se pintan en el panel de SU hoja, que es el que
    // tabLayout mantiene oculto hasta que la pestana se abre. Ya no reemplazan la
    // tabla de la bitacora, asi que no hace falta un boton para volver.
    async lsRegistros(id, tabId) {
        const tipo  = tabId || app.activeTab;
        const hoja  = sheetKey(id);
        const lote  = (app.lotes[tipo] || []).find(l => Number(l.id) === Number(id));

        this.loader({ parent: `sheetBody-${hoja}`, text: 'Leyendo los registros de la carga...', size: 'sm', type: 'aurora' });

        const data = await fnAjax({ opc: 'lsRegistros', id: id }, apiCargas);

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

        // El pie toma el lugar del encabezado con el boton de volver: mientras se
        // leen los registros sigue a la vista de que archivo salieron, su control y
        // la accion de borrar el lote.
        cargasView.renderSheetFoot(hoja, sheetFoot(lote, data));

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

        const pasos    = SAMPLE_CARGAS_ROADMAP;
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

    // Sin pasos del servidor (respuesta rota o sin llegar) el roadmap no puede
    // quedarse girando: el paso en curso se marca en error con el motivo.
    failRoadmap(detalle) {
        this.stopRoadmap();

        cargasView.renderRoadmap(SAMPLE_CARGAS_ROADMAP.map((p, i) => Object.assign({}, p, {
            estado:  i < this.pasoVivo ? 'ok' : (i === this.pasoVivo ? 'error' : 'pendiente'),
            detalle: i === this.pasoVivo ? detalle : p.detalle
        })));
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
            this.confirmarPeriodo(file, tipo);
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
            if (result.isConfirmed) this.confirmarPeriodo(file, tipo);
        });
    }

    // El periodo lo fija el filtro del modulo, no el nombre del archivo: se
    // confirma a que mes y anio va la carga antes de tocar la base. Si ese periodo
    // ya tiene datos de la pestana se avisa que se sobreescriben, porque la carga
    // reemplaza a la anterior en lugar de sumarse a ella.
    confirmarPeriodo(file, tipo) {
        const filtros = app.getFilters();

        if (!filtros.mes || !filtros.anio) {
            alert({ icon: 'warning', title: 'Selecciona mes y anio antes de subir el archivo', btn1: true });
            return;
        }

        const archivo = app.dataInit.archivos[tipo];
        const periodo = `${$('#fMes option:selected').text()} ${filtros.anio}`;
        const existe  = archivo.estado === 'ok';

        const aviso = existe
            ? `<p class="text-[12px] text-yellow-300 mt-2">Este periodo ya tiene datos cargados
                   (<strong>${archivo.cargado}</strong>) y se <strong>sobreescriben</strong> con este archivo.</p>`
            : '';

        alert({
            icon:     existe ? 'warning' : 'question',
            title:    `Cargar en ${periodo}`,
            html:     `<p class="text-[12px]">Se va a subir <strong>${file.name}</strong> a
                           <strong>${archivo.titulo}</strong> del periodo <strong>${periodo}</strong>.</p>${aviso}`,
            btn1:     true,
            btn1Text: existe ? 'Sobreescribir periodo' : 'Subir archivo',
            btn2:     true,
            btn2Text: 'Cancelar'
        }).then(result => {
            if (result.isConfirmed) this.subirArchivo(file, tipo);
        });
    }

    subirArchivo(file, tipo) {
        const filtros = app.getFilters();

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

        // La carga se sigue desde la bitacora: si el usuario estaba viendo una hoja
        // se la trae de vuelta, porque los lotes de esa hoja estan por cambiar.
        app.openLog(tipo);

        // loader() hace append: sin vaciar la tabla el aviso queda debajo de la
        // bitacora, donde no se ve mientras dura el proceso.
        $(`#sheetBody-${logKey(tipo)}`).empty();
        this.loader({ parent: `sheetBody-${logKey(tipo)}`, text: `Procesando ${file.name}...`, size: 'sm', type: 'aurora' });

        fnUpload(formData, apiCargas).then((response) => {
            const data    = response || {};
            const archivo = app.dataInit.archivos[tipo];

            archivo.estado  = data.status === 200 ? 'ok' : 'pendiente';
            archivo.cargado = data.status === 200 ? file.name : '';

            cargasView.renderUploadRow(tipo, archivo);

            // Sin hojas reconocidas las tarjetas vuelven a su estado de reposo: si
            // se quedaran con la barra en marcha dirian que siguen leyendose.
            app.renderHojas(tipo, (data.hojas && data.hojas.length)
                ? _hojasCargadas(app.hojasTab(tipo), data.hojas)
                : null);

            if (data.steps) {
                this.stopRoadmap();
                cargasView.renderRoadmap(data.steps);
            } else {
                this.failRoadmap(data.message || 'El servidor no devolvio el detalle del proceso');
            }

            this.lsBitacora(tipo);

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

    // Pie de la hoja abierta: lo que antes decia el encabezado con el boton de
    // volver, ahora dicho debajo de la tabla y sin sacar al usuario de la hoja.
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

    // Las hojas llegan como vienen del contrato o de la carga: la tarjeta se arma
    // aqui para que ambos origenes se pinten igual.
    renderHojas(rows, selected, onSelect) {
        this.detectList({
            parent:   'detailSheets',
            json:     (rows || []).map(_hojaCard),
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

        // El input nativo se mantiene oculto: el boton verde lo dispara para no
        // romper la fila con el control por defecto del navegador.
        wrap.find('.upload-row-btn').on('click', () => $(`#${inputId}`).trigger('click'));

        wrap.find(`#${inputId}`).on('change', (e) => opts.onChange(e.target, opts.json.id));
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

        // El paso en curso se distingue del resto: circulo azul con el icono
        // girando, para que la carga no se lea como una lista congelada.
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

        // La hoja seleccionada se marca con anillo: es la que manda el mapeo de
        // columnas que se ve debajo, y sin la marca no se sabria de cual es.
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

        // Un encabezado puede necesitar varias etiquetas (la hoja del Excel y el
        // conteo, por ejemplo). `badge` en singular se conserva porque el resto de
        // los encabezados del modulo ya lo pasan asi.
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
