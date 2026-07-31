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

    // El tipo vive aqui y no en el campo: el filterBar se repinta al ir y volver
    // de la vista del emisor, y leyendolo del DOM la marca elegida se perderia en
    // cada cambio de vista. Arranca en los auxiliares, que son el catalogo del
    // modulo.
    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'catalogos';
        this.view         = 'productos';
        this.tipo         = 'puente';
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
    //
    // La leyenda va fuera del wrapper con scroll: explica las dos marcas del
    // catalogo y tiene que seguir a la vista al recorrer el listado.
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
                        id:    'viewNote',
                        class: 'flex-shrink-0'
                    },
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
            data:       this.jsonFiltroProductos()
        });
    }

    jsonFiltroProductos() {
        return [
            {
                opc:      'select',
                id:       'fTipo',
                lbl:      'Tipo de producto:',
                class:    'col-12 col-md-4 col-lg-3',
                value:    this.tipo,
                required: false,
                onchange: 'app.onChangeFilters()',
                data:     this.dataInit.tipos
            },
            {
                opc:       'button',
                id:        'btnNuevoProducto',
                text:      'Nuevo producto auxiliar',
                icon:      'ic-plus',
                color_btn: 'primary',
                class:     'col-12 col-md-4 col-lg-3',
                onClick:   () => catalogosView.openProductoForm()
            }
        ];
    }

    // El buscador no esta pintado: el catalogo son unas cuantas claves y se
    // recorren de un vistazo. Viaja vacio porque el servidor arma el LIKE con el,
    // no porque haya un campo del que leerlo.
    getFilters() {
        return {
            q:    '',
            tipo: this.tipo
        };
    }

    onChangeFilters() {
        this.tipo = $('#fTipo').val() || '';

        this.lsView();
    }

    // El aviso de vacio habla de la marca elegida: en el arranque la lista es la
    // de los auxiliares y lo que falta son altas; con cualquier otra marca lo que
    // falta son filas de esa marca, que aqui no se dan de alta.
    emptyMessage() {
        return this.tipo === 'puente'
            ? 'Aun no hay productos auxiliares dados de alta'
            : 'No hay productos con el filtro aplicado';
    }

    // -- Vistas --

    renderView() {
        const vistas = {
            productos: () => {
                catalogosView.renderNote();
                catalogos.lsProductos();
                catalogos.lsKpis();
            },
            emisor: () => {
                $('#kpisRow').empty();
                $('#viewNote').empty();
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
        catalogos.lsProductos();
    }
}

// -- Catalogos --

class Catalogos extends Templates {

    constructor(link, divModule) {
        super(link, divModule);
        this.PROJECT_NAME = 'catalogos';
    }

    // -- Data --

    // Columnas: 1 Codigo, 2 Nombre, 3 Precio, 4 Producto auxiliar, 5 Modificador,
    // 6 Estatus.
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
            emptyMessage:  app.emptyMessage(),
            emptyIcon:     'ic-box',
            data:          data
        });

        if (window.lucide) lucide.createIcons();

        this.dataTable('#tbProductos', data);
    }

    // Paginado y ordenamiento de la tabla ya pintada. Sin filas createCoffeeTable3
    // no arma un <table> sino el aviso de vacio, asi que montar DataTables ahi
    // dejaria la paginacion colgando debajo del mensaje.
    dataTable(id, data) {
        if (!(data.row || []).length) return;

        if (typeof simple_data_table === 'function') simple_data_table(id, 12);
    }

    // Las cifras son las del catalogo completo, no las del listado: el selector
    // deja ver una marca a la vez y las tarjetas son las que dicen cuantos
    // productos hay en total y cuantos de ellos estan marcados.
    async lsKpis() {
        const kpis = await useFetch({ url: apiCatalogos, data: { opc: 'showKpis' } });

        catalogosView.renderInfoCards(kpis);
    }

    // -- Actions --

    // La clave anterior viaja aparte: es la que localiza la fila cuando la edicion
    // cambia la clave del POS, y sin ella se daria de alta un producto nuevo.
    //
    // La marca no se pregunta en el formulario: aqui solo se dan de alta productos
    // auxiliares, asi que en el alta viaja fija. En la edicion viaja la que ya
    // tiene el producto, que puede ser uno del resto del catalogo abierto desde el
    // selector: guardarlo no debe convertirlo en auxiliar. La marca se quita y se
    // pone desde el interruptor de su fila.
    async saveProducto(code, data, puente) {
        const response = await useFetch({
            url:  apiCatalogos,
            data: Object.assign({ opc: 'saveProducto', previo: code || '' }, data, { puente: puente })
        });

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

    // El interruptor de la fila escribe la marca contraria a la que muestra. Tocar
    // la marca por la que esta filtrado el listado saca al producto de el, asi que
    // la vista se relee entera.
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

    // La tabla y las tarjetas se releen juntas: un producto marcado como auxiliar
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

    // Copy de la cabecera del modulo. No son datos: productos y emisor se consultan
    // al servidor.
    renderHeader() {
        this.viewHeader({
            parent: 'viewHeader',
            id:     'hdrCatalogos',
            json: {
                title:    'Catalogos',
                subtitle: 'Productos auxiliares y datos del ticket virtual',
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

    // Las dos marcas del catalogo no se explican solas: una dice que el producto
    // sirve para armar el ticket virtual y la otra que solo acompaña a un platillo.
    // La leyenda va arriba de la tabla, donde se leen las columnas que las pintan.
    //
    // El tinte es el mismo con el que la columna pinta cada marca: la caja se
    // reconoce por color antes de leerse, igual que las tarjetas de arriba.
    renderNote() {
        this.noteCard({
            parent: 'viewNote',
            json: {
                items: [
                    {
                        icon:   'link',
                        accent: '#3FC189',
                        title:  'Producto auxiliar',
                        text:   'Es el que el generador usa para armar el ticket virtual: se van sumando sus precios hasta cubrir el total cobrado. Solo estos se dan de alta aqui.'
                    },
                    {
                        icon:   'layers',
                        accent: '#F59E0B',
                        title:  'Modificador',
                        text:   'Acompaña a otro producto (extras, terminos, guarniciones) y no arma un ticket por si solo: no entra en la combinacion.'
                    }
                ]
            }
        });
    }

    // La vista viaja como atributo de la fila: el tinte del icono de cada tarjeta
    // depende de su posicion.
    renderInfoCards(kpis) {
        $('#kpisRow').attr('data-view', app.view);

        this.infoCard({
            parent: 'kpisRow',
            id:     'kpisCatalogos',
            theme:  FACTURE_THEME,
            style:  'file',
            cols:   4,
            json:   this.jsonKpisProductos(kpis)
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
                title:       'Productos auxiliares',
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
                class: 'col-12 col-md-6 mb-3'
            },
            {
                opc:      'select',
                id:       'modificador',
                lbl:      'Es modificador',
                class:    'col-12 col-md-6 mb-3',
                value:    '0',
                required: false,
                data:     app.dataInit.sino
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
            title:    producto ? `Editar ${producto.nombre}` : 'Nuevo producto auxiliar',
            autofill: producto || false,
            json:     this.jsonProducto(),
            onSave:   (form) => catalogos.saveProducto(code || '', form, producto ? Number(producto.puente) : 1)
        });
    }

    editProducto(code) {
        this.openProductoForm(code);
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

    // Leyenda de una tabla cuando lo que hay que explicar son varios conceptos: uno
    // por caja, en linea, con el icono de la columna que representan delante.
    //
    // El icono va en su propia pastilla del color del concepto y el titulo en ese
    // mismo tono, en renglon aparte: asi la caja se lee de un vistazo (que marca
    // es) y solo despues su explicacion, que baja a gris. El color no toca el
    // borde: la caja se distingue por su pastilla, no por un marco de mas.
    noteCard(options) {
        const defaults = {
            parent: 'root',
            id:     '',
            class:  'flex flex-col md:flex-row gap-2 mb-3',
            json:   { items: [] },
            classes: {
                item:  'note-card flex items-start gap-2.5 flex-1 px-3 py-2.5 rounded-lg bg-[#0E1521]',
                chip:  'note-chip flex items-center justify-center w-6 h-6 rounded-md flex-shrink-0',
                icon:  'w-3.5 h-3.5',
                body:  'flex-1 min-w-0',
                text:  'note-text text-[10px] text-gray-400 leading-relaxed mb-0',
                title: 'note-title text-[11px] font-bold mb-0.5'
            }
        };

        // El color del concepto llega en un solo dato: el titulo y el icono lo
        // llevan tal cual y el fondo de la pastilla es ese mismo color rebajado,
        // como los iconos de las tarjetas de arriba.
        const tint = (hex, alpha) => {
            const n = parseInt(String(hex || '').replace('#', ''), 16);

            if (isNaN(n)) return 'transparent';

            return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
        };

        const o    = options || {};
        const opts = Object.assign({}, defaults, o);
        opts.json    = Object.assign({}, defaults.json,    o.json    || {});
        opts.classes = Object.assign({}, defaults.classes, o.classes || {});

        const esc = (str) => String(str == null ? '' : str).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));

        const item = (it) => `
            <div class="${opts.classes.item}">
                ${it.icon ? `
                    <span class="${opts.classes.chip}" style="background: ${tint(it.accent, .15)};">
                        <i data-lucide="${esc(it.icon)}" class="${opts.classes.icon}" style="color: ${esc(it.accent || 'currentColor')};"></i>
                    </span>
                ` : ''}
                <div class="${opts.classes.body}">
                    <p class="${opts.classes.title}" style="color: ${esc(it.accent || 'currentColor')};">${esc(it.title)}</p>
                    <p class="${opts.classes.text}">${esc(it.text)}</p>
                </div>
            </div>
        `;

        const wrap = $('<div>', { id: opts.id || `${opts.parent}Wrap`, class: opts.class });
        wrap.html((opts.json.items || []).map(item).join(''));

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
