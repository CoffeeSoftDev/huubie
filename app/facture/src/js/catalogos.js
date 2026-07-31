let apiCatalogos = '/app/facture/ctrl/ctrl-facture-catalogos.php';
let app, catalogos, catalogosView;

$(async () => {
    catalogosView = new CatalogosView(apiCatalogos, 'root');
    catalogos     = new Catalogos(apiCatalogos, 'root');
    app           = new App(apiCatalogos, 'root');
    await app.init();
});

// -- Clase principal --

class App extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'catalogos';
        this.view         = 'productos';
    }

    async init() {
        this.dataInit = await useFetch({ url: apiCatalogos, data: { opc: 'init' } });

        this.render();
    }

    render() {
        this.layout();
        catalogosView.renderHeader();
        this.renderView();
    }

    // -- Layout --

    // Un solo panel: las tres vistas del modulo se turnan en la misma tarjeta y se
    // eligen desde el conmutador de la cabecera, no desde un costado fijo.
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
                    class: 'px-3 pt-3 bg-[#0E1521] flex-shrink-0'
                },
                {
                    id:    'kpisRow',
                    class: 'px-3 pt-1 pb-3 bg-[#0E1521] flex-shrink-0'
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

    // La tarjeta es el marco de la vista activa: dentro va la tabla del catalogo o
    // el formulario del emisor, nunca las dos cosas. El scroll vive aqui, de modo
    // que cabecera, filtros y tarjetas se quedan fijos arriba.
    cardLayout() {
        this.createLayout({
            parent: 'contentRow',
            design: false,
            data: {
                // p-4 como el panel de cada pestana en Cargas: el aire lo pone la
                // tarjeta, no el contenido, asi la tabla y el formulario del emisor
                // se separan igual de sus bordes sin repetir el margen cada uno.
                id:        'cardCatalogo',
                class:     'w-full flex-1 min-h-0 bg-[#141d2b] rounded-lg p-4 flex flex-col overflow-hidden',
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

    // -- Filter bar --

    filterBar() {
        if (this.view === 'emisor') return $('#filterBar').empty();

        this.createfilterBar({
            parent:     'filterBar',
            id:         `filterBar${this.PROJECT_NAME}`,
            coffeesoft: true,
            theme:      FACTURE_THEME,
            data:       this.view === 'meseros' ? this.jsonFiltroMeseros() : this.jsonFiltroProductos()
        });
    }

    jsonFiltroProductos() {
        return [
            {
                opc:         'input',
                id:          'qBuscar',
                lbl:         'Buscar producto',
                class:       'col-12 col-md-6 col-lg-6',
                placeholder: 'Codigo o nombre...',
                required:    false,
                onkeyup:     'app.onChangeFilters()'
            },
            {
                opc:      'select',
                id:       'fTipo',
                lbl:      'Tipo',
                class:    'col-12 col-md-3 col-lg-3',
                value:    '',
                required: false,
                onchange: 'app.onChangeFilters()',
                data:     this.dataInit.tipos
            },
            {
                opc:       'button',
                id:        'btnNuevoProducto',
                text:      'Nuevo producto',
                icon:      'ic-plus',
                color_btn: 'primary',
                class:     'col-12 col-md-3 col-lg-3',
                onClick:   () => catalogosView.openProductoForm()
            }
        ];
    }

    jsonFiltroMeseros() {
        return [
            {
                opc:         'input',
                id:          'qBuscar',
                lbl:         'Buscar mesero',
                class:       'col-12 col-md-8 col-lg-9',
                placeholder: 'Clave o nombre...',
                required:    false,
                onkeyup:     'app.onChangeFilters()'
            },
            {
                opc:       'button',
                id:        'btnNuevoMesero',
                text:      'Nuevo mesero',
                icon:      'ic-plus',
                color_btn: 'primary',
                class:     'col-12 col-md-4 col-lg-3',
                onClick:   () => catalogosView.openMeseroForm()
            }
        ];
    }

    // El tipo solo existe en la vista de productos: en meseros el campo no esta
    // pintado y el filtro viaja vacio.
    getFilters() {
        return {
            q:    $('#qBuscar').val() || '',
            tipo: $('#fTipo').val()   || ''
        };
    }

    // -- Vistas --

    renderView() {
        const vistas = {
            productos: () => {
                catalogos.lsProductos();
                catalogos.lsKpis();
            },
            meseros: () => {
                catalogos.lsMeseros();
                catalogos.lsKpis();
            },
            emisor: () => {
                $('#kpisRow').empty();
                catalogosView.renderEmisor(this.dataInit.emisor);
            }
        };

        this.filterBar();
        vistas[this.view]();
    }

    setView(view) {
        this.view = view;
        this.renderView();
    }

    lsView() {
        this.view === 'meseros' ? catalogos.lsMeseros() : catalogos.lsProductos();
    }

    // -- Event handlers --

    onChangeFilters() {
        this.lsView();
        catalogos.lsKpis();
    }
}

// -- Catalogos --

class Catalogos extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'catalogos';
    }

    // -- Data --

    // Columnas: 1 Codigo, 2 Nombre, 3 Precio, 4 Puente, 5 Modificador, 6 Estatus.
    //
    // Misma configuracion que las tablas de Cargas: la paleta se deja al tema y
    // solo se apaga el borde exterior, porque la tarjeta que las contiene ya
    // dibuja el marco. Fijar aqui los colores dark rompia la variante clara del
    // modulo, que se elige desde facture-theme.js.
    async lsProductos() {
        const data = await useFetch({ url: apiCatalogos, data: Object.assign({ opc: 'lsProductos' }, app.getFilters()) });

        this.createCoffeeTable3({
            parent:        'viewBody',
            id:            'tbProductos',
            theme:         FACTURE_THEME,
            center:        [4, 5, 6],
            right:         [3],
            actionsAlign:  'center',
            extends:       true,
            scrollable:    false,
            hover:         true,
            f_size:        11,
            border_table:  'border-0',
            emptyMessage:  'No se encontraron productos',
            emptyIcon:     'ic-box',
            data:          data
        });

        if (window.lucide) lucide.createIcons();

        this.dataTable('#tbProductos', data);
    }

    async lsMeseros() {
        const data = await useFetch({ url: apiCatalogos, data: Object.assign({ opc: 'lsMeseros' }, app.getFilters()) });

        this.createCoffeeTable3({
            parent:        'viewBody',
            id:            'tbMeseros',
            theme:         FACTURE_THEME,
            center:        [3],
            actionsAlign:  'center',
            extends:       true,
            scrollable:    false,
            hover:         true,
            f_size:        11,
            border_table:  'border-0',
            emptyMessage:  'No se encontraron meseros',
            emptyIcon:     'ic-users',
            data:          data
        });

        if (window.lucide) lucide.createIcons();

        this.dataTable('#tbMeseros', data);
    }

    // Paginado y ordenamiento de la tabla ya pintada. Sin filas createCoffeeTable3
    // no arma un <table> sino el aviso de vacio, asi que montar DataTables ahi
    // dejaria la paginacion colgando debajo del mensaje.
    dataTable(id, data) {
        if (!(data.row || []).length) return;

        if (typeof simple_data_table === 'function') simple_data_table(id, 12);
    }

    // Una sola consulta sirve a las dos vistas: el buscador es comun y cambiar de
    // pestaña no vuelve a pedir cifras al servidor.
    async lsKpis() {
        const kpis = await useFetch({ url: apiCatalogos, data: Object.assign({ opc: 'showKpis' }, app.getFilters()) });

        catalogosView.renderInfoCards(kpis);
    }

    // -- Actions --

    // La clave anterior viaja aparte: es la que localiza la fila cuando la edicion
    // cambia la clave del POS, y sin ella se daria de alta un producto nuevo.
    async saveProducto(code, data) {
        const response = await useFetch({ url: apiCatalogos, data: Object.assign({ opc: 'saveProducto', previo: code || '' }, data) });

        this.afterSave(response);
    }

    async saveMesero(code, data) {
        const response = await useFetch({ url: apiCatalogos, data: Object.assign({ opc: 'saveMesero', previo: code || '' }, data) });

        this.afterSave(response);
    }

    async saveEmisor() {
        const response = await useFetch({
            url: apiCatalogos,
            data: {
                opc:       'saveEmisor',
                razon:     $('#razon').val(),
                rfc:       $('#rfc').val(),
                telefono:  $('#telefono').val(),
                domicilio: $('#domicilio').val()
            }
        });

        if (response.status === 200) app.dataInit.emisor = response.emisor;

        this.alertBox({
            type:  response.status === 200 ? 'success' : 'error',
            title: response.message,
            timer: response.status === 200 ? 1600 : 0
        });
    }

    // El interruptor de la fila escribe la marca contraria a la que muestra. Un
    // producto puente cambia tambien de sitio en la tabla y las cifras de las
    // tarjetas, asi que la vista se relee entera.
    async editProductoFlag(code, campo, valor) {
        const response = await useFetch({
            url: apiCatalogos,
            data: {
                opc:   'editProductoFlag',
                code:  code,
                campo: campo,
                valor: valor
            }
        });

        if (response.status === 200) return this.refresh();

        this.alertBox({ type: 'error', title: response.message });
    }

    // Activar es directo; dar de baja se confirma, porque el producto deja de estar
    // disponible para armar tickets virtuales.
    editProductoStatus(code, valor) {
        if (valor === 1) return this.saveStatus('editProductoStatus', code, valor);

        this.swalQuestion({
            extends: true,
            opts: {
                title:             'Dar de baja el producto',
                text:              `Se retirara la clave ${code} del catalogo activo. Los renglones ya cargados la conservan y podras volver a activarla.`,
                icon:              'warning',
                confirmButtonText: 'Si, dar de baja',
                cancelButtonText:  'No'
            }
        }).then((result) => {
            if (result.isConfirmed) this.saveStatus('editProductoStatus', code, valor);
        });
    }

    editMeseroStatus(code, valor) {
        if (valor === 1) return this.saveStatus('editMeseroStatus', code, valor);

        this.swalQuestion({
            extends: true,
            opts: {
                title:             'Dar de baja el mesero',
                text:              `Se retirara la clave ${code} del catalogo activo. Podras volver a activarla cuando haga falta.`,
                icon:              'warning',
                confirmButtonText: 'Si, dar de baja',
                cancelButtonText:  'No'
            }
        }).then((result) => {
            if (result.isConfirmed) this.saveStatus('editMeseroStatus', code, valor);
        });
    }

    async saveStatus(opc, code, valor) {
        const response = await useFetch({
            url: apiCatalogos,
            data: {
                opc:   opc,
                code:  code,
                valor: valor
            }
        });

        this.afterSave(response);
    }

    afterSave(response) {
        if (response.status === 200) this.refresh();

        this.alertBox({
            type:  response.status === 200 ? 'success' : 'error',
            title: response.message,
            timer: response.status === 200 ? 1600 : 0
        });
    }

    // La tabla y las tarjetas se releen juntas: un producto marcado como puente
    // cambia tambien los conteos del encabezado.
    refresh() {
        app.lsView();
        this.lsKpis();
    }
}

// -- Vista --

class CatalogosView extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'catalogos';
    }

    // -- Render helpers --

    // Copy de la cabecera del modulo. No son datos: productos, meseros y emisor se
    // consultan al servidor.
    renderHeader() {
        this.viewHeader({
            parent: 'viewHeader',
            id:     'hdrCatalogos',
            json: {
                title:    'Catalogos',
                subtitle: 'Productos del punto de venta y datos del ticket virtual',
                back:     { href: '/app/facture/index.php', title: 'Regresar al Facturador' },
                toggles: [
                    {
                        key:   'vista',
                        label: '',
                        value: app.view,
                        options: [
                            {
                                value: 'productos',
                                label: 'Productos'
                            },
                            {
                                value: 'meseros',
                                label: 'Meseros'
                            },
                            {
                                value: 'emisor',
                                label: 'Ticket / Emisor'
                            }
                        ]
                    }
                ]
            },
            onToggle: (key, value) => app.setView(value)
        });
    }

    // La vista viaja como atributo de la fila: el tinte del icono de cada tarjeta
    // depende de su posicion, y esa cambia con la vista.
    renderInfoCards(kpis) {
        $('#kpisRow').attr('data-view', app.view);

        this.infoCard({
            parent: 'kpisRow',
            id:     'kpisCatalogos',
            theme:  FACTURE_THEME,
            style:  'file',
            cols:   4,
            json:   app.view === 'meseros' ? this.jsonKpisMeseros(kpis) : this.jsonKpisProductos(kpis)
        });
    }

    jsonKpisProductos(kpis) {
        return [
            {
                id:          'kpiProductos',
                title:       'Productos',
                lucideIcon:  'package',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value: kpis.productos,
                    color: 'text-white'
                }
            },
            {
                id:          'kpiPuente',
                title:       'Puente',
                lucideIcon:  'link',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value: kpis.puente,
                    color: 'text-[#3FC189]'
                }
            },
            {
                id:          'kpiModificadores',
                title:       'Modificadores',
                lucideIcon:  'layers',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value: kpis.modificadores,
                    color: 'text-amber-500'
                }
            },
            {
                id:          'kpiPrecio',
                title:       'Precio promedio',
                lucideIcon:  'banknote',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value: kpis.precioPromedio,
                    color: 'text-[#1C64F2]'
                }
            }
        ];
    }

    jsonKpisMeseros(kpis) {
        return [
            {
                id:          'kpiMeseros',
                title:       'Meseros',
                lucideIcon:  'users',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value: kpis.meseros,
                    color: 'text-white'
                }
            },
            {
                id:          'kpiMeserosActivos',
                title:       'Activos',
                lucideIcon:  'user-check',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value: kpis.meserosActivos,
                    color: 'text-[#3FC189]'
                }
            },
            {
                id:          'kpiMeserosBaja',
                title:       'Dados de baja',
                lucideIcon:  'user-x',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value: kpis.meserosBaja,
                    color: 'text-red-400'
                }
            },
            {
                id:          'kpiMeserosSinNombre',
                title:       'Sin nombre',
                lucideIcon:  'badge-alert',
                bgColor:     'bg-[#141d2b]',
                borderColor: 'border-transparent',
                data: {
                    value: kpis.meserosSinNombre,
                    color: 'text-amber-500'
                }
            }
        ];
    }

    // -- Forms --

    renderEmisor(emisor) {
        // Sin margen horizontal propio: el aire ya lo pone el p-4 de la tarjeta, y
        // repetirlo aqui dejaba el separador del encabezado sin llegar a sus bordes.
        $('#viewBody').html('<div id="emisorHead" class="pb-3 border-b border-[#374151]"></div><div id="formEmisor" class="pt-4 max-w-3xl"></div>');

        this.panelHead({
            parent: 'emisorHead',
            json: {
                icon:  'building-2',
                title: 'Emisor del ticket virtual',
                badge: {
                    text: 'sucursal',
                    tone: 'b-gray'
                }
            }
        });

        this.coffeeForm({
            parent:       'formEmisor',
            id:           'frmEmisor',
            theme:        FACTURE_THEME,
            showRequired: false,
            autofill:     emisor,
            json:         this.jsonEmisor()
        });
    }

    jsonEmisor() {
        return [
            {
                opc:   'input',
                id:    'razon',
                lbl:   'Razon social',
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
                lbl:   'Domicilio fiscal',
                tipo:  'texto',
                class: 'col-12 mb-3'
            },
            {
                opc:       'button',
                id:        'btnGuardarEmisor',
                text:      'Guardar emisor',
                color_btn: 'primary',
                class:     'col-12 col-md-4',
                onClick:   () => catalogos.saveEmisor()
            }
        ];
    }

    jsonProducto() {
        return [
            {
                opc:   'input',
                id:    'code',
                lbl:   'Codigo',
                tipo:  'texto',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc:   'input',
                id:    'nombre',
                lbl:   'Nombre del producto',
                tipo:  'texto',
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc:   'input',
                id:    'precio',
                lbl:   'Precio',
                tipo:  'cifra',
                class: 'col-12 col-md-4 mb-3'
            },
            {
                opc:      'select',
                id:       'puente',
                lbl:      'Es producto puente',
                class:    'col-12 col-md-4 mb-3',
                required: false,
                data:     app.dataInit.sino
            },
            {
                opc:      'select',
                id:       'modificador',
                lbl:      'Es modificador',
                class:    'col-12 col-md-4 mb-3',
                required: false,
                data:     app.dataInit.sino
            }
        ];
    }

    jsonMesero() {
        return [
            {
                opc:   'input',
                id:    'code',
                lbl:   'Codigo',
                tipo:  'texto',
                class: 'col-12 col-md-4 mb-3'
            },
            {
                opc:   'input',
                id:    'nombre',
                lbl:   'Nombre del mesero',
                tipo:  'texto',
                class: 'col-12 col-md-8 mb-3'
            }
        ];
    }

    // El registro se pide al servidor y no se guarda una copia en el cliente: la
    // tabla ya viene armada como HTML, asi que el formulario necesita los campos
    // en crudo y esos solo los tiene la consulta.
    async openProductoForm(code) {
        const data     = code ? await useFetch({ url: apiCatalogos, data: { opc: 'getProducto', code: code } }) : {};
        const producto = data.producto || null;

        this.formModal({
            id:       'frmProducto',
            title:    producto ? `Editar ${producto.nombre}` : 'Nuevo producto',
            autofill: producto || false,
            json:     this.jsonProducto(),
            onSave:   (form) => catalogos.saveProducto(code || '', form)
        });
    }

    async openMeseroForm(code) {
        const data   = code ? await useFetch({ url: apiCatalogos, data: { opc: 'getMesero', code: code } }) : {};
        const mesero = data.mesero || null;

        this.formModal({
            id:       'frmMesero',
            title:    mesero ? `Editar ${mesero.nombre}` : 'Nuevo mesero',
            size:     'default',
            autofill: mesero || false,
            json:     this.jsonMesero(),
            onSave:   (form) => catalogos.saveMesero(code || '', form)
        });
    }

    editProducto(code) {
        this.openProductoForm(code);
    }

    editMesero(code) {
        this.openMeseroForm(code);
    }

    // -- Components --

    formModal(options) {
        const defaults = {
            id:       'frmModal',
            title:    '',
            size:     'large',
            theme:    FACTURE_THEME,
            autofill: false,
            json:     [],
            onSave:   () => { }
        };

        const opts = Object.assign({}, defaults, options || {});
        const host = $('<div>', { id: `${opts.id}Host` });

        let form;
        const modal = this.cfModal({
            title:       opts.title,
            size:        opts.size,
            theme:       opts.theme,
            closeButton: true,
            onOk:        () => form.trigger('submit')
        });

        modal.body.append(host);

        form = this.coffeeForm({
            parent:   `${opts.id}Host`,
            id:       opts.id,
            Element:  'form',
            theme:    opts.theme,
            autofill: opts.autofill,
            json:     opts.json,
            onSave:   (data) => {
                opts.onSave(data);
                modal.close();
            }
        });

        return modal;
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

    // El grupo de toggles va como control segmentado: son las vistas del modulo, no
    // un filtro mas, y el activo se pinta relleno para que se lea como pestaña.
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
                group:    'flex items-center gap-1 p-1 rounded-lg border border-[#374151] bg-[#141d2b]',
                btn:      'demo-toggle px-3 py-1.5 rounded-md text-[12px] text-gray-400 hover:bg-[#1F2A37] hover:text-white transition-colors',
                btnActive:'demo-toggle active px-3 py-1.5 rounded-md text-[12px] font-semibold bg-[#1C64F2] text-white',
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
            const label = g.label ? `<span class="${opts.classes.groupLbl}">${esc(g.label)}</span>` : '';
            return `
                ${label}
                <div class="${opts.classes.group}">
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
